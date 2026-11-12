// Wspólne narzędzia testów: serwer plików, przeglądarka, podstawiony Supabase.
//
// Uruchamianie:  npm test     (albo: node --test tests/)
// Testy nie łączą się z prawdziwą bazą: js/konfiguracja.js jest podmieniany,
// a zapytania do Supabase obsługuje atrapa z tego pliku.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const { atrapaAi } = require('./atrapa-ai.cjs');

const KORZEN = path.join(__dirname, '..');
const TYPY = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.icc': 'application/vnd.iccprofile',
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

// Biblioteka Supabase wysyła pliki jako formularz wieloczęściowy – wyciągamy
// z niego samą treść pliku i jej typ.
function plikZZadania(req) {
  const cialo = req.postDataBuffer() || Buffer.alloc(0);
  const typ = req.headers()['content-type'] || 'application/octet-stream';
  const granica = /boundary=(.+)$/.exec(typ)?.[1];
  if (!granica) return { typ, tresc: cialo };
  const znacznik = Buffer.from(`--${granica}`);
  let od = 0;
  let plik = null;
  for (;;) {
    const start = cialo.indexOf(znacznik, od);
    if (start < 0) break;
    const koniecNaglowkow = cialo.indexOf('\r\n\r\n', start);
    const nastepny = cialo.indexOf(znacznik, start + znacznik.length);
    if (koniecNaglowkow < 0 || nastepny < 0) break;
    const naglowki = cialo.subarray(start, koniecNaglowkow).toString();
    if (/filename=/.test(naglowki) || /name="?"?;?\s*$/m.test(naglowki) || !plik) {
      const typPliku = /content-type:\s*([^\r\n]+)/i.exec(naglowki)?.[1];
      if (typPliku) plik = { typ: typPliku.trim(), tresc: cialo.subarray(koniecNaglowkow + 4, nastepny - 2) };
    }
    od = nastepny;
  }
  return plik || { typ, tresc: cialo };
}

// Baza trzyma projekt i strony w kolumnach jsonb, a te nie pamiętają kolejności pól: oddają je
// posortowane po długości nazwy, potem alfabetycznie. Atrapa oddaje dane tak samo, żeby żaden test
// nie przechodził dzięki kolejności, której prawdziwa baza nie zachowa.
function jakJsonb(x) {
  if (Array.isArray(x)) return x.map(jakJsonb);
  if (!x || typeof x !== 'object') return x;
  const klucze = Object.keys(x).sort((a, b) => a.length - b.length || (a < b ? -1 : (a > b ? 1 : 0)));
  return Object.fromEntries(klucze.map((k) => [k, jakJsonb(x[k])]));
}

// Atrapa Supabase: konta w pamięci, tabela projekty, storage – tyle, ile używa aplikacja.
function atrapaSupabase(kontekst, poczatkowe = {}) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const stan = {
    konta: poczatkowe.konta || [{ id: '11111111-1111-4111-8111-111111111111', email: 'anna@test.pl', haslo: 'Dobre#Haslo1', potwierdzone: true, nazwa: 'Anna' }],
    projekty: [],
    pliki: new Map(), // Storage: "bucket/ścieżka" -> { typ, tresc }
    wyslania: [], // kolejne wysłane pliki (klucze), także powtórnie
    strony: new Map(), // wiersze projekty_strony: "projekt/strona" -> dane
    zapisy: [], // kolejne zapisy projektu: które strony wysłano, ile ich jest
    opoznienieZapisu: 0, // ms – „wolna sieć” przy zapisie projektu
    wTrakcieZapisu: 0, // ile zapisów projektu czeka teraz na odpowiedź
    najwiecejNaraz: 0, // największa liczba zapisów biegnących jednocześnie
    konflikty: 0, // ile razy baza odmówiła zapisu, bo urządzenie nie znało bieżącej wersji
    wyslane: [], // „e-maile”: { typ, email }
    zadania: [],
    kanaly: { dolaczenia: 0, wyslane: 0, wylaczone: Boolean(poczatkowe.bezKanalu) }, // Realtime: ile dołączeń, ile wiadomości o zmianach
  };
  stan.ai = atrapaAi(stan); // funkcje dostępu dla AI: stan.ai(nazwa funkcji, parametry, konto)
  const sesja = (k) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const user = {
      id: k.id, email: k.email, aud: 'authenticated', role: 'authenticated',
      email_confirmed_at: k.potwierdzone ? new Date().toISOString() : null,
      user_metadata: { nazwa: k.nazwa || '', ...(k.motyw ? { motyw: k.motyw } : {}) }, new_email: k.nowyEmail || undefined,
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

  // ---------- Kanały Realtime: protokół Phoenix po WebSocket, tyle, ile używa aplikacja ----------
  // Urządzenie dołącza do tematu z listą obserwowanych zmian (postgres_changes); atrapa odpowiada tak jak
  // serwer i przy każdym zapisie projektu rozsyła wiadomość do urządzeń tego samego konta (jak RLS).
  const gniazda = new Set();
  let nrWiazania = 0;
  const kontoZTokenu = (token) => {
    try { return stan.konta.find((k) => k.id === JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString()).sub) || null; } catch { return null; }
  };
  const doGniazda = (g, temat, zdarzenie, tresc, ref = null, refDolaczenia = null) => {
    const w = g.tablica ? [refDolaczenia, ref, temat, zdarzenie, tresc] : { topic: temat, event: zdarzenie, payload: tresc, ref, join_ref: refDolaczenia };
    if (process.env.KANALY_LOG) console.log('WS <', JSON.stringify(w).slice(0, 260));
    try { g.ws.send(JSON.stringify(w)); } catch (e) { if (process.env.KANALY_LOG) console.log('WS błąd', e.message); }
  };
  const podlaczKanaly = (k) => k.routeWebSocket(/^wss:\/\/atrapa\.supabase\.co\/realtime\//, (ws) => {
    if (stan.kanaly.wylaczone) { ws.close(); return; }
    const g = { ws, tematy: new Map(), tablica: false };
    gniazda.add(g);
    ws.onClose(() => gniazda.delete(g));
    ws.onMessage((surowa) => {
      let w;
      try { w = JSON.parse(surowa); } catch { return; }
      g.tablica = Array.isArray(w);
      if (process.env.KANALY_LOG) console.log('WS >', String(surowa).slice(0, 260));
      const [refDolaczenia, ref, temat, zdarzenie, tresc] = g.tablica ? w : [w.join_ref, w.ref, w.topic, w.event, w.payload];
      const ok = (odp = {}) => doGniazda(g, temat, 'phx_reply', { status: 'ok', response: odp }, ref, refDolaczenia);
      if (zdarzenie === 'heartbeat') { ok(); return; }
      if (zdarzenie === 'phx_join') {
        const wiazania = (tresc?.config?.postgres_changes || []).map((b) => ({ id: (nrWiazania += 1), event: b.event, schema: b.schema, table: b.table, filter: b.filter }));
        g.tematy.set(temat, { konto: kontoZTokenu(tresc?.access_token), wiazania });
        stan.kanaly.dolaczenia += 1;
        if (process.env.KANALY_LOG) console.log('dołączenie', temat, JSON.stringify(tresc).slice(0, 600));
        ok({ postgres_changes: wiazania });
        doGniazda(g, temat, 'system', { status: 'ok', message: 'Subscribed to PostgreSQL', channel: temat.replace(/^realtime:/, ''), extension: 'postgres_changes' });
        return;
      }
      if (zdarzenie === 'access_token') { const t = g.tematy.get(temat); if (t) t.konto = kontoZTokenu(tresc?.access_token) || t.konto; return; }
      if (zdarzenie === 'phx_leave') { g.tematy.delete(temat); ok(); }
    });
  });
  // Rozgłasza zmianę wiersza projektu (zapis z dowolnego urządzenia) do wszystkich podłączonych urządzeń konta.
  stan.oglos = (projekt, typ = 'UPDATE') => {
    for (const g of gniazda) {
      for (const [temat, t] of g.tematy) {
        if (!t.konto || t.konto.id !== projekt.owner_id) continue; // RLS: cudzych wierszy nikt nie dostaje
        const ids = t.wiazania.filter((b) => (b.event === '*' || b.event === typ) && b.table === 'projekty' && (!b.filter || b.filter === `owner_id=eq.${projekt.owner_id}`)).map((b) => b.id);
        if (!ids.length) continue;
        stan.kanaly.wyslane += 1;
        doGniazda(g, temat, 'postgres_changes', {
          ids,
          data: {
            schema: 'public', table: 'projekty', type: typ, commit_timestamp: new Date().toISOString(), errors: null,
            columns: [{ name: 'id', type: 'uuid' }, { name: 'owner_id', type: 'uuid' }, { name: 'nazwa', type: 'text' }, { name: 'wersja', type: 'int8' }, { name: 'zmieniono', type: 'timestamptz' }],
            record: { id: projekt.id, owner_id: projekt.owner_id, nazwa: projekt.nazwa, wersja: projekt.wersja, zmieniono: projekt.zmieniono },
            old_record: { id: projekt.id },
          },
        });
      }
    }
  };

  // Podłącza atrapę do kontekstu przeglądarki – każde „urządzenie” w teście to osobny kontekst z tą samą bazą.
  stan.podlacz = (k) => { podlaczHttp(k); podlaczKanaly(k); };
  const podlaczHttp = (k) => k.route('https://atrapa.supabase.co/**', async (r) => {
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
        if (tresc.data) { k.nazwa = tresc.data.nazwa ?? k.nazwa; k.motyw = tresc.data.motyw ?? k.motyw; }
        if (tresc.email) { k.nowyEmail = tresc.email; stan.wyslane.push({ typ: 'zmiana-email', email: tresc.email }); }
      }
      return json(r, 200, sesja(k).user);
    }
    // Link chroniony (migracja udostepnienia_chronione): te same zasady co funkcje w bazie.
    if (sc.startsWith('/rest/v1/rpc/') && /udostepnieni|podglad_chroniony/.test(sc)) {
      const k = zTokenu(req);
      const funkcja = sc.slice('/rest/v1/rpc/'.length);
      stan.chronione = stan.chronione || new Map(); // "konto/projekt/kod" -> { haslo, wazny_do, nieudane, blokada_do, pliki: Map }
      if (funkcja === 'podglad_chroniony') {
        const u = stan.chronione.get(`${tresc.p_konto}/${tresc.p_projekt}/${tresc.p_kod}`);
        if (!u) return json(r, 200, { stan: 'brak' });
        if (!(k && k.id === tresc.p_konto)) {
          if (u.wazny_do && new Date(u.wazny_do) < new Date()) return json(r, 200, { stan: 'wygasl' });
          if (u.haslo) {
            if (u.blokada_do && new Date(u.blokada_do) > new Date()) return json(r, 200, { stan: 'blokada', do: u.blokada_do });
            if (!tresc.p_haslo) return json(r, 200, { stan: 'haslo', wazny_do: u.wazny_do });
            if (tresc.p_haslo !== u.haslo) {
              u.nieudane += 1;
              if (u.nieudane >= 10) { u.nieudane = 0; u.blokada_do = new Date(Date.now() + 15 * 60000).toISOString(); }
              return json(r, 200, { stan: 'zle_haslo' });
            }
            u.nieudane = 0;
          }
        }
        if (!tresc.p_nazwy) return json(r, 200, { stan: 'ok', haslo: Boolean(u.haslo), wazny_do: u.wazny_do });
        stan.pobraniaChronione = (stan.pobraniaChronione || 0) + 1;
        const pliki = {};
        for (const n of tresc.p_nazwy.slice(0, 12)) if (u.pliki.has(n)) pliki[n] = u.pliki.get(n);
        return json(r, 200, { stan: 'ok', pliki });
      }
      if (!k) return blad(r, 401, 'JWT', 'PGRST301');
      const klucz = `${k.id}/${tresc.p_projekt}/${tresc.p_kod}`;
      if (funkcja === 'ustaw_ochrone_udostepnienia') {
        if (tresc.p_zmien_haslo && tresc.p_haslo && tresc.p_haslo.length < 4) return blad(r, 400, 'Hasło do linku musi mieć co najmniej 4 znaki', 'P0001');
        const u = stan.chronione.get(klucz) || { haslo: null, wazny_do: null, nieudane: 0, blokada_do: null, pliki: new Map() };
        if (tresc.p_zmien_haslo) u.haslo = tresc.p_haslo || null;
        Object.assign(u, { wazny_do: tresc.p_wazny_do || null, nieudane: 0, blokada_do: null });
        stan.chronione.set(klucz, u);
        return json(r, 200, { haslo: Boolean(u.haslo), wazny_do: u.wazny_do });
      }
      const u = stan.chronione.get(klucz);
      if (funkcja === 'zapisz_plik_udostepnienia') {
        if (!u) return blad(r, 409, 'insert or update violates foreign key constraint', '23503');
        u.pliki.set(tresc.p_nazwa, { typ: tresc.p_typ, dane: tresc.p_dane });
        return json(r, 200, null);
      }
      if (funkcja === 'porzadkuj_pliki_udostepnienia') {
        if (u) for (const n of [...u.pliki.keys()]) if (!tresc.p_zostaja.includes(n)) u.pliki.delete(n);
        return json(r, 200, null);
      }
      if (funkcja === 'usun_udostepnienie_chronione') { stan.chronione.delete(klucz); return json(r, 200, null); }
    }
    // Dostęp dla AI (migracja dostep_ai): klucze właściciela i funkcje posiadacza klucza.
    if (sc.startsWith('/rest/v1/rpc/') && /dostep_ai|dostepy_ai|obraz_ai|pliki_do_usuniecia|pliki_usuniete|^\/rest\/v1\/rpc\/ai_/.test(sc)) {
      stan.ai = stan.ai || atrapaAi(stan);
      try {
        return json(r, 200, stan.ai(sc.slice('/rest/v1/rpc/'.length), tresc, zTokenu(req)));
      } catch (e) {
        return blad(r, e.status || 400, e.message, 'P0001');
      }
    }
    if (sc === '/rest/v1/rpc/usun_konto') {
      const k = zTokenu(req);
      stan.konta = stan.konta.filter((x) => x !== k);
      stan.projekty = stan.projekty.filter((p) => p.owner_id !== k?.id);
      return json(r, 200, null);
    }
    // Zapis projektu jedną funkcją – ta sama logika co w migracji strony_osobno.
    if (sc === '/rest/v1/rpc/zapisz_projekt') {
      const k = zTokenu(req);
      if (!k) return blad(r, 401, 'JWT', 'PGRST301');
      stan.zapisy.push({ strony: (tresc.p_strony || []).map((x) => x.id), wszystkie: tresc.p_dane.strony.length });
      stan.wTrakcieZapisu += 1;
      stan.najwiecejNaraz = Math.max(stan.najwiecejNaraz, stan.wTrakcieZapisu);
      // Wolna sieć na życzenie testu: odpowiedź przychodzi po chwili.
      if (stan.opoznienieZapisu) await new Promise((ok) => { setTimeout(ok, stan.opoznienieZapisu); });
      stan.wTrakcieZapisu -= 1;
      let p = stan.projekty.find((x) => x.id === tresc.p_id);
      if (p && p.owner_id !== k.id) return blad(r, 409, 'duplicate key value violates unique constraint', '23505');
      if (!p) {
        p = { id: tresc.p_id, owner_id: k.id, wersja: 0 };
        stan.projekty.push(p);
      } else if (!tresc.p_wymus && tresc.p_znana_wersja !== p.wersja) {
        stan.konflikty += 1;
        return json(r, 200, { konflikt: true, wersja: p.wersja, zmieniono: p.zmieniono });
      }
      Object.assign(p, { nazwa: tresc.p_nazwa, dane: tresc.p_dane, zmieniono: tresc.p_zmieniono, wersja: p.wersja + 1 });
      for (const x of tresc.p_strony || []) stan.strony.set(`${p.id}/${x.id}`, x.dane);
      const zostaja = new Set(tresc.p_dane.strony.map((id) => `${p.id}/${id}`));
      for (const klucz of [...stan.strony.keys()]) if (klucz.startsWith(`${p.id}/`) && !zostaja.has(klucz)) stan.strony.delete(klucz);
      stan.oglos(p, p.wersja === 1 ? 'INSERT' : 'UPDATE');
      return json(r, 200, { wersja: p.wersja });
    }
    if (sc === '/rest/v1/projekty_strony') {
      const k = zTokenu(req);
      if (!k) return blad(r, 401, 'JWT', 'PGRST301');
      const idProjektu = (url.searchParams.get('projekt_id') || '').replace('eq.', '');
      const p = stan.projekty.find((x) => x.id === idProjektu && x.owner_id === k.id);
      const wiersze = p ? [...stan.strony].filter(([klucz]) => klucz.startsWith(`${p.id}/`)).map(([klucz, dane]) => ({ strona_id: klucz.slice(p.id.length + 1), dane: jakJsonb(dane) })) : [];
      return json(r, 200, wiersze);
    }
    if (sc === '/rest/v1/projekty') {
      const k = zTokenu(req);
      if (!k) return blad(r, 401, 'JWT', 'PGRST301');
      const moje = stan.projekty.filter((p) => p.owner_id === k.id);
      const id = (url.searchParams.get('id') || '').replace('eq.', '');
      if (m === 'GET') {
        if (id) {
          const p = moje.find((x) => x.id === id);
          const jeden = (req.headers().accept || '').includes('vnd.pgrst.object');
          if (!p) return jeden ? blad(r, 406, 'brak wiersza', 'PGRST116') : json(r, 200, []);
          const wiersz = { dane: jakJsonb(p.dane), wersja: p.wersja, zmieniono: p.zmieniono };
          return json(r, 200, jeden ? wiersz : [wiersz]);
        }
        return json(r, 200, moje.map((p) => ({ id: p.id, nazwa: p.nazwa, zmieniono: p.zmieniono, wersja: p.wersja, miniatura: p.dane.miniatura || null, udostepnienie: p.dane.udostepnienie || null })));
      }
      if (m === 'POST') {
        const w = Array.isArray(tresc) ? tresc[0] : tresc;
        const i = stan.projekty.findIndex((p) => p.id === w.id);
        const upsert = (req.headers().prefer || '').includes('merge-duplicates');
        if (i >= 0 && !upsert) return blad(r, 409, 'duplicate key value violates unique constraint', '23505');
        const nowy = { ...w, owner_id: k.id };
        if (i >= 0) stan.projekty[i] = nowy; else stan.projekty.push(nowy);
        return json(r, 201, [nowy]);
      }
      if (m === 'PATCH') {
        const p = moje.find((x) => x.id === id);
        const oczekiwana = (url.searchParams.get('wersja') || '').replace('eq.', '');
        if (!p || (oczekiwana && String(p.wersja) !== oczekiwana)) return json(r, 200, []);
        Object.assign(p, tresc);
        stan.oglos(p);
        return json(r, 200, [{ wersja: p.wersja }]);
      }
      if (m === 'DELETE') {
        stan.projekty = stan.projekty.filter((p) => !(p.id === id && p.owner_id === k.id));
        for (const klucz of [...stan.strony.keys()]) if (klucz.startsWith(`${id}/`)) stan.strony.delete(klucz);
        return json(r, 200, []);
      }
    }
    if (sc.startsWith('/storage/v1/object/list/')) {
      // Jak w Supabase: bezpośrednie pliki folderu oraz nazwy podfolderów.
      const prefiks = `${sc.slice('/storage/v1/object/list/'.length)}/${tresc.prefix ? `${tresc.prefix}/` : ''}`;
      const nazwy = new Set();
      for (const klucz of stan.pliki.keys()) if (klucz.startsWith(prefiks)) nazwy.add(klucz.slice(prefiks.length).split('/')[0]);
      return json(r, 200, [...nazwy].map((name) => ({ name })));
    }
    if (sc.startsWith('/storage/v1/object/public/')) {
      const plik = stan.pliki.get(sc.slice('/storage/v1/object/public/'.length));
      if (!plik) return blad(r, 404, 'Object not found', 'not_found');
      return r.fulfill({ status: 200, contentType: plik.typ, body: plik.tresc, headers: { 'access-control-allow-origin': '*' } });
    }
    if (sc.startsWith('/storage/v1/object/')) {
      const klucz = sc.slice('/storage/v1/object/'.length);
      if (m === 'DELETE') {
        const bucket = klucz.split('/')[0];
        for (const p of tresc.prefixes || []) stan.pliki.delete(`${bucket}/${p}`);
        return json(r, 200, []);
      }
      if (m === 'GET') {
        const plik = stan.pliki.get(klucz.replace(/^authenticated\//, ''));
        if (!plik) return blad(r, 404, 'Object not found', 'not_found');
        return r.fulfill({ status: 200, contentType: plik.typ, body: plik.tresc });
      }
      if (m === 'POST' || m === 'PUT') {
        if (!zTokenu(req)) return blad(r, 401, 'JWT', 'unauthorized');
        stan.pliki.set(klucz, plikZZadania(req));
        stan.wyslania.push(klucz);
      }
      return json(r, 200, { Key: klucz });
    }
    return json(r, 200, {});
  });
  stan.podlacz(kontekst);
  return stan;
}

// Otwiera aplikację. tryb: 'zalogowany' (domyślnie: atrapa bazy i zalogowane konto testowe, instrukcja zamknięta),
// 'atrapa' (atrapa bazy, ekran logowania) albo 'bez-bazy' (pusta konfiguracja – sam komunikat).
// Dawna nazwa 'lokalny' znaczy to samo co 'zalogowany' (aplikacja nie ma już pracy bez konta).
async function otworz(test, { tryb = 'zalogowany', telefon = false, urzadzenie = null, konta, widok = { width: 1280, height: 800 }, sciezka = '', bezKanalu = false } = {}) {
  const serwer = await uruchomSerwer();
  // Bez „dociągania” liter do pikseli: tekst rysuje się tak samo na każdym komputerze, a testy porównujące
  // obrazy (PDF, podgląd) nie zależą od ustawień czcionek systemu, na którym biegną.
  const przegladarka = await chromium.launch({ args: ['--font-render-hinting=none'] });
  const kontekst = await przegladarka.newContext({
    // telefon: true – telefon trzymany pionowo (tak pracuje edytor); 'poziom' – poziomo.
    // urzadzenie: nazwa z listy Playwright (np. 'iPad Mini') – tablet z dotykiem.
    ...(urzadzenie ? devices[urzadzenie] : telefon ? devices[telefon === 'poziom' ? 'Pixel 7 landscape' : 'Pixel 7'] : { viewport: widok }),
    serviceWorkers: 'block',
    acceptDownloads: true,
  });
  if (tryb === 'lokalny') tryb = 'zalogowany';
  const zBaza = tryb !== 'bez-bazy';
  await kontekst.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: zBaza ? Z_ATRAPA : BEZ_BAZY }));
  const baza = zBaza ? atrapaSupabase(kontekst, { konta, bezKanalu }) : null;
  const strona = await kontekst.newPage();
  const bledy = [];
  strona.on('pageerror', (e) => bledy.push(e.message));
  test.after(async () => { await przegladarka.close(); await serwer.zamknij(); });
  await strona.goto(serwer.adres + sciezka);
  if (tryb === 'zalogowany') await zaloguj(strona, baza);
  return { strona, kontekst, baza, bledy, adres: serwer.adres, przegladarka, Z_ATRAPA };
}

// Kontekst przeglądarki podłączony do atrapy bazy – dla skryptów spoza testów (zrzuty do instrukcji).
async function podlaczAtrape(kontekst, opcje = {}) {
  await kontekst.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: Z_ATRAPA }));
  return atrapaSupabase(kontekst, opcje);
}

// Logowanie pierwszym kontem atrapy; zamyka instrukcję, która otwiera się przy pierwszym wejściu.
async function zaloguj(strona, baza) {
  const k = baza.konta[0];
  await strona.waitForSelector('#form-logowania input[name=email]', { state: 'visible' });
  await strona.fill('#form-logowania input[name=email]', k.email);
  await strona.fill('#form-logowania input[name=haslo]', k.haslo);
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await zamknijOkno(strona, '#dlg-instrukcja');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
}

// Zamyka okno dialogowe tak jak człowiek: na komputerze krzyżykiem, na telefonie i tablecie (zasłonka,
// js/zaslonki.js) – stuknięciem w uchwyt u góry. Czeka, aż okno się zamknie.
async function zamknijOkno(strona, dialog) {
  const x = strona.locator(`${dialog} .x-okna`);
  if (await x.count() && await x.isVisible()) await x.click();
  else await strona.locator(`${dialog} > .uchwyt-zaslonki`).click();
  await strona.waitForFunction((d) => !document.querySelector(d)?.open, dialog, { timeout: 5000 }).catch(() => {});
}

// Drugie urządzenie: osobny kontekst tej samej przeglądarki (własne ciasteczka, własny magazyn projektów),
// podłączony do tej samej atrapy konta. Przyjmuje wynik otworz(..., { tryb: 'atrapa' }).
async function drugieUrzadzenie({ przegladarka, baza, adres }, { widok = { width: 1280, height: 800 } } = {}) {
  const kontekst = await przegladarka.newContext({ viewport: widok, serviceWorkers: 'block', acceptDownloads: true });
  await kontekst.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: Z_ATRAPA }));
  baza.podlacz(kontekst);
  const strona = await kontekst.newPage();
  const bledy = [];
  strona.on('pageerror', (e) => bledy.push(e.message));
  await strona.goto(adres);
  return { strona, kontekst, bledy };
}

async function nowyProjekt(strona, nazwa = 'Test') {
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', nazwa);
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForSelector('#ekran-edytora', { state: 'visible' });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk);
}

const ekran = (strona) => strona.evaluate(() => document.body.dataset.ekran);
const wAplikacji = (strona, fn, arg) => strona.evaluate(fn, arg);

const PNG_2X2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBkYGBgYAAAhCAEB2eTzpAAAAABJRU5ErkJggg==', 'base64');

module.exports = { otworz, drugieUrzadzenie, nowyProjekt, ekran, wAplikacji, PNG_2X2, podlaczAtrape, zaloguj, zamknijOkno };
