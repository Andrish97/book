// Wspólne narzędzia testów: serwer plików, przeglądarka, podstawiony Supabase.
//
// Uruchamianie:  npm test     (albo: node --test tests/)
// Testy nie łączą się z prawdziwą bazą: js/konfiguracja.js jest podmieniany,
// a zapytania do Supabase obsługuje atrapa z tego pliku.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const KORZEN = path.join(__dirname, '..');
const TYPY = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function uruchomSerwer() {
  const serwer = http.createServer((req, res) => {
    const sciezka = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let plik = path.join(KORZEN, sciezka);
    if (!plik.startsWith(KORZEN)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(plik) && fs.statSync(plik).isDirectory()) plik = path.join(plik, 'index.html');
    fs.readFile(plik, (blad, dane) => {
      if (blad) { res.writeHead(404).end('brak'); return; }
      res.writeHead(200, { 'Content-Type': TYPY[path.extname(plik)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(dane);
    });
  });
  return new Promise((ok) => serwer.listen(0, '127.0.0.1', () => ok({
    adres: `http://127.0.0.1:${serwer.address().port}/`,
    zamknij: () => new Promise((z) => serwer.close(z)),
  })));
}

const BEZ_BAZY = "export const SUPABASE_URL = '';\nexport const SUPABASE_ANON_KEY = '';\n";
const Z_ATRAPA = "export const SUPABASE_URL = 'https://atrapa.supabase.co';\nexport const SUPABASE_ANON_KEY = 'sb_publishable_test';\n";

// Atrapa Supabase: konta w pamięci, tabela projekty, storage – tyle, ile używa aplikacja.
function atrapaSupabase(kontekst, poczatkowe = {}) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const stan = {
    konta: poczatkowe.konta || [{ id: '11111111-1111-4111-8111-111111111111', email: 'anna@test.pl', haslo: 'Dobre#Haslo1', potwierdzone: true, nazwa: 'Anna' }],
    projekty: [],
    wyslane: [], // „e-maile”: { typ, email }
    zadania: [],
  };
  const sesja = (k) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const user = {
      id: k.id, email: k.email, aud: 'authenticated', role: 'authenticated',
      email_confirmed_at: k.potwierdzone ? new Date().toISOString() : null,
      user_metadata: { nazwa: k.nazwa || '' }, new_email: k.nowyEmail || undefined,
    };
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: k.id, email: k.email, exp, role: 'authenticated', aud: 'authenticated' })}.podpis`;
    return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: `r-${k.id}`, user };
  };
  const zTokenu = (req) => {
    const t = (req.headers().authorization || '').replace('Bearer ', '').split('.')[1];
    try { return stan.konta.find((k) => k.id === JSON.parse(Buffer.from(t, 'base64url').toString()).sub); } catch { return null; }
  };
  const json = (r, kod, tresc) => r.fulfill({ status: kod, contentType: 'application/json', body: JSON.stringify(tresc) });
  const blad = (r, kod, msg, code) => json(r, kod, { code: code || 'blad', error_code: code, msg, message: msg, error_description: msg });

  kontekst.route('https://atrapa.supabase.co/**', async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const m = req.method();
    const tresc = (() => { try { return JSON.parse(req.postData() || '{}'); } catch { return {}; } })();
    stan.zadania.push(`${m} ${url.pathname}${url.search}`);
    const sc = url.pathname;

    if (sc === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const k = stan.konta.find((x) => `r-${x.id}` === tresc.refresh_token);
        return k ? json(r, 200, sesja(k)) : blad(r, 400, 'Invalid Refresh Token', 'refresh_token_not_found');
      }
      const k = stan.konta.find((x) => x.email === tresc.email);
      if (!k || k.haslo !== tresc.password) return blad(r, 400, 'Invalid login credentials', 'invalid_credentials');
      if (!k.potwierdzone) return blad(r, 400, 'Email not confirmed', 'email_not_confirmed');
      return json(r, 200, sesja(k));
    }
    if (sc === '/auth/v1/signup') {
      const istnieje = stan.konta.find((x) => x.email === tresc.email);
      if (istnieje && istnieje.potwierdzone) return blad(r, 422, 'User already registered', 'user_already_exists');
      const k = istnieje || { id: `22222222-2222-4222-8222-${String(stan.konta.length).padStart(12, '0')}`, email: tresc.email, potwierdzone: false };
      Object.assign(k, { haslo: tresc.password, nazwa: tresc.data?.nazwa || '' });
      if (!istnieje) stan.konta.push(k);
      stan.wyslane.push({ typ: 'potwierdzenie', email: k.email });
      return json(r, 200, sesja(k).user);
    }
    if (sc === '/auth/v1/resend') { stan.wyslane.push({ typ: 'ponownie', email: tresc.email }); return json(r, 200, {}); }
    if (sc === '/auth/v1/recover') { stan.wyslane.push({ typ: 'reset', email: tresc.email }); return json(r, 200, {}); }
    if (sc === '/auth/v1/logout') return r.fulfill({ status: 204, body: '' });
    if (sc === '/auth/v1/user') {
      const k = zTokenu(req);
      if (!k) return blad(r, 401, 'invalid JWT', 'bad_jwt');
      if (m === 'PUT') {
        if (tresc.password) {
          if (tresc.password === k.haslo) return blad(r, 422, 'New password should be different from the old password.', 'same_password');
          k.haslo = tresc.password;
        }
        if (tresc.data) k.nazwa = tresc.data.nazwa ?? k.nazwa;
        if (tresc.email) { k.nowyEmail = tresc.email; stan.wyslane.push({ typ: 'zmiana-email', email: tresc.email }); }
      }
      return json(r, 200, sesja(k).user);
    }
    if (sc === '/rest/v1/rpc/usun_konto') {
      const k = zTokenu(req);
      stan.konta = stan.konta.filter((x) => x !== k);
      stan.projekty = stan.projekty.filter((p) => p.owner_id !== k?.id);
      return json(r, 200, null);
    }
    if (sc === '/rest/v1/projekty') {
      const k = zTokenu(req);
      if (!k) return blad(r, 401, 'JWT', 'PGRST301');
      const moje = stan.projekty.filter((p) => p.owner_id === k.id);
      const id = (url.searchParams.get('id') || '').replace('eq.', '');
      if (m === 'GET') {
        if (id) {
          const p = moje.find((x) => x.id === id);
          return p ? json(r, 200, { dane: p.dane, wersja: p.wersja }) : blad(r, 406, 'brak wiersza', 'PGRST116');
        }
        return json(r, 200, moje.map((p) => ({ id: p.id, nazwa: p.nazwa, zmieniono: p.zmieniono, wersja: p.wersja, miniatura: p.dane.miniatura || null })));
      }
      if (m === 'POST') {
        const w = Array.isArray(tresc) ? tresc[0] : tresc;
        const i = stan.projekty.findIndex((p) => p.id === w.id);
        const nowy = { ...w, owner_id: k.id };
        if (i >= 0) stan.projekty[i] = nowy; else stan.projekty.push(nowy);
        return json(r, 201, [nowy]);
      }
      if (m === 'PATCH') {
        const p = moje.find((x) => x.id === id);
        const oczekiwana = (url.searchParams.get('wersja') || '').replace('eq.', '');
        if (!p || (oczekiwana && String(p.wersja) !== oczekiwana)) return json(r, 200, []);
        Object.assign(p, tresc);
        return json(r, 200, [{ wersja: p.wersja }]);
      }
      if (m === 'DELETE') { stan.projekty = stan.projekty.filter((p) => !(p.id === id && p.owner_id === k.id)); return json(r, 200, []); }
    }
    if (sc.startsWith('/storage/v1/object/list/')) return json(r, 200, []);
    if (sc.startsWith('/storage/v1/object/')) return json(r, 200, { Key: sc });
    return json(r, 200, {});
  });
  return stan;
}

// Otwiera aplikację. tryb: 'lokalny' (bez bazy, „Pracuj bez konta”) albo 'atrapa'.
async function otworz(test, { tryb = 'lokalny', telefon = false, konta, widok = { width: 1280, height: 800 }, sciezka = '' } = {}) {
  const serwer = await uruchomSerwer();
  const przegladarka = await chromium.launch();
  const kontekst = await przegladarka.newContext({
    ...(telefon ? devices['Pixel 7'] : { viewport: widok }),
    serviceWorkers: 'block',
    acceptDownloads: true,
  });
  await kontekst.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: tryb === 'atrapa' ? Z_ATRAPA : BEZ_BAZY }));
  const baza = tryb === 'atrapa' ? atrapaSupabase(kontekst, { konta }) : null;
  const strona = await kontekst.newPage();
  const bledy = [];
  strona.on('pageerror', (e) => bledy.push(e.message));
  test.after(async () => { await przegladarka.close(); await serwer.zamknij(); });
  await strona.goto(serwer.adres + sciezka);
  if (tryb === 'lokalny') {
    await strona.click('#tryb-lokalny');
    await strona.waitForSelector('#dlg-instrukcja[open]');
    await strona.click('[data-akcja="zamknij-instrukcje"]');
  }
  return { strona, kontekst, baza, bledy, adres: serwer.adres, przegladarka };
}

async function nowyProjekt(strona, nazwa = 'Test') {
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', nazwa);
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForSelector('#ekran-edytora', { state: 'visible' });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
}

const ekran = (strona) => strona.evaluate(() => document.body.dataset.ekran);
const wAplikacji = (strona, fn, arg) => strona.evaluate(fn, arg);

const PNG_2X2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBkYGBgYAAAhCAEB2eTzpAAAAABJRU5ErkJggg==', 'base64');

module.exports = { otworz, nowyProjekt, ekran, wAplikacji, PNG_2X2 };
