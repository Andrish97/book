// Wspólne narzędzia testów: serwer plików, przeglądarka, podstawiony Supabase.
//
// Uruchamianie:  npm test     (albo: node --test tests/)
// Testy nie łączą się z prawdziwą bazą: js/konfiguracja.js jest podmieniany,
// a zapytania do Supabase obsługuje atrapa z tego pliku.

const crypto = require('node:crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const { atrapaAi } = require('./atrapa-ai.cjs');
const { atrapaWspolpracy, rolaW } = require('./atrapa-wspolpraca.cjs');

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

// Baza trzyma projekt i strony w kolumnach jsonb, a te nie pamiętają kolejności pól: oddają je
// posortowane po długości nazwy, potem alfabetycznie. Atrapa oddaje dane tak samo, żeby żaden test
// nie przechodził dzięki kolejności, której prawdziwa baza nie zachowa.
function jakJsonb(x) {
  if (Array.isArray(x)) return x.map(jakJsonb);
  if (!x || typeof x !== 'object') return x;
  const klucze = Object.keys(x).sort((a, b) => a.length - b.length || (a < b ? -1 : (a > b ? 1 : 0)));
  return Object.fromEntries(klucze.map((k) => [k, jakJsonb(x[k])]));
}

// Funkcje miejsca i sprzątania – ta sama logika co w bazie (migracje 20261114150000_miejsce_na_koncie.sql,
// 20261114180000_pliki_r2_limity.sql) i w przekaźniku plików (cloudflare/api-worker.js: _miejsce, _osierocone).
// Wiek pliku: stan.pliki.get(klucz).czas (test może go cofnąć), wiersze AI: utworzono, linki chronione: zmieniono.
function miejsceAtrapy(stan, funkcja, tresc, k) {
  const DWA_DNI = 2 * 24 * 3600 * 1000;
  const prefiks = `${k.id}/`;
  const rozmiarPliku = (p) => p.tresc?.length || 0;
  const moje = [...stan.pliki].map(([klucz, p]) => ({ bucket: klucz.split('/')[0], nazwa: klucz.slice(klucz.indexOf('/') + 1), p }))
    .filter((x) => (x.bucket === 'zasoby' || x.bucket === 'podglady') && x.nazwa.startsWith(prefiks));
  const zasobyProjektu = (pr) => Object.values(pr.dane?.zasoby || {});
  const chronione = [...(stan.chronione || new Map())].filter(([klucz]) => klucz.startsWith(prefiks));
  const ai = [...(stan.obrazyAi || new Map())].filter(([, o]) => o.owner_id === k.id);
  const bajtyAi = (o) => (o.dane?.length || 0) + [...(o.kawalki?.values() || [])].reduce((n, b) => n + b.length, 0);
  if (funkcja === 'miejsce_na_koncie') {
    // Część z bazy (migracja 20261114180000_pliki_r2_limity.sql); pliki liczy przekaźnik (/pliki/_miejsce).
    return {
      chronione: chronione.reduce((n, [, u]) => n + [...u.pliki.values()].reduce((m, f) => m + (f.dane?.length || f.tresc?.length || 0), 0), 0),
      od_ai: ai.reduce((n, [, o]) => n + bajtyAi(o), 0),
      baza_razem: stan.bazaBajty ?? 12 * 1024 * 1024,
      limit_bazy: 524288000,
      projekty: stan.projekty.filter((pr) => pr.owner_id === k.id).length,
      limit_projektow: stan.limitProjektow ?? 100,
      osoby_w_projekcie: 20,
      obrazy_w_projekcie: 1000,
    };
  }
  if (funkcja === 'pliki_miejsce') {
    // Jak GET /pliki/_miejsce w przekaźniku (cloudflare/api-worker.js).
    const suma = (f) => moje.filter(f).reduce((n, x) => n + rozmiarPliku(x.p), 0);
    const czcionki = suma((x) => x.bucket === 'zasoby' && x.nazwa.startsWith(`${prefiks}_czcionki/`));
    const obrazy = suma((x) => x.bucket === 'zasoby') - czcionki;
    const podglady = suma((x) => x.bucket === 'podglady');
    const projekty = {};
    for (const x of moje) {
      const pr = x.nazwa.split('/')[1];
      if (!pr || pr.startsWith('_')) continue;
      const w = projekty[pr] || (projekty[pr] = { bajty: 0, plikow: 0, podglady: 0 });
      if (x.bucket === 'podglady') w.podglady += rozmiarPliku(x.p); else { w.bajty += rozmiarPliku(x.p); w.plikow += 1; }
    }
    return {
      projekty,
      obrazy, czcionki, podglady, plikow: moje.length, konto: obrazy + czcionki + podglady,
      limit_konta: stan.limitKonta || 2 * 1024 * 1024 * 1024, limit_pliku: stan.limitPliku || 50 * 1024 * 1024,
      pliki_razem: [...stan.pliki].filter(([klucz]) => /^(zasoby|podglady)\//.test(klucz)).reduce((n, [, p]) => n + rozmiarPliku(p), 0) + (stan.inneKontaBajty || 0),
      limit_plikow: stan.limitPlikow || 50 * 1024 * 1024 * 1024,
    };
  }
  if (funkcja === 'pliki_osierocone') {
    const odwolania = new Set(stan.projekty.flatMap((pr) => zasobyProjektu(pr).map((z) => z?.sciezka)).filter(Boolean));
    const linki = stan.projekty.filter((pr) => pr.owner_id === k.id && pr.dane?.udostepnienie?.kod).map((pr) => `${k.id}/${pr.id}/${pr.dane.udostepnienie.kod}/`);
    return moje.filter((x) => Date.now() - (x.p.czas || 0) > DWA_DNI)
      .filter((x) => (x.bucket === 'zasoby'
        ? !x.nazwa.startsWith(`${prefiks}_czcionki/`) && !odwolania.has(x.nazwa)
        : !linki.some((l) => x.nazwa.startsWith(l))))
      .map((x) => ({ bucket: x.bucket, nazwa: x.nazwa, rozmiar: rozmiarPliku(x.p) }));
  }
  // posprzataj_konto
  const uzytyAi = (id, o) => stan.projekty.some((pr) => pr.id === o.projekt_id && zasobyProjektu(pr).some((z) => z?.sciezka === `ai:${id}`));
  const aiDoUsuniecia = ai.filter(([id, o]) => (!o.gotowy && Date.now() - o.utworzono > 24 * 3600 * 1000) || (o.gotowy && Date.now() - o.utworzono > DWA_DNI && !uzytyAi(id, o)));
  const linkiDoUsuniecia = chronione.filter(([klucz, u]) => {
    const [, idProjektu, kod] = klucz.split('/');
    return Date.now() - (u.zmieniono || 0) > DWA_DNI && !stan.projekty.some((pr) => pr.id === idProjektu && pr.dane?.udostepnienie?.kod === kod);
  });
  const wynik = {
    ai: aiDoUsuniecia.length, ai_bajty: aiDoUsuniecia.reduce((n, [, o]) => n + bajtyAi(o), 0),
    linki: linkiDoUsuniecia.length, linki_bajty: linkiDoUsuniecia.reduce((n, [, u]) => n + [...u.pliki.values()].reduce((m, f) => m + (f.dane?.length || 0), 0), 0),
  };
  if (!tresc?.p_policz) {
    for (const [id] of aiDoUsuniecia) stan.obrazyAi.delete(id);
    for (const [klucz] of linkiDoUsuniecia) stan.chronione.delete(klucz);
  }
  return wynik;
}

// Atrapa Supabase: konta w pamięci, tabela projekty, storage – tyle, ile używa aplikacja.
function atrapaSupabase(kontekst, poczatkowe = {}) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const stan = {
    konta: poczatkowe.konta || [{ id: '11111111-1111-4111-8111-111111111111', email: 'anna@test.pl', haslo: 'Dobre#Haslo1', potwierdzone: true, nazwa: 'Anna' }],
    projekty: [],
    pliki: new Map(), // Pliki w R2 (przekaźnik): "zasoby|podglady/ścieżka" -> { typ, tresc, czas, cacheControl }
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
  stan.wspolpraca = atrapaWspolpracy(stan); // współpraca między kontami: stan.wspolpraca(nazwa, parametry, konto)
  const widzi = (k, p) => Boolean(rolaW(stan, k, p.id)); // RLS: własne projekty i udostępnione temu kontu
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
    ws.onClose(() => { for (const temat of g.tematy.keys()) odejdz(g, temat); gniazda.delete(g); });
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
        const konto = kontoZTokenu(tresc?.access_token);
        // Kanał obecności w projekcie jest prywatny: dołączyć może tylko osoba z dostępem (jak reguła na realtime.messages).
        const projektObecnosci = /^realtime:obecnosc-(.+)$/.exec(temat)?.[1];
        if (projektObecnosci && !rolaW(stan, konto, projektObecnosci)) {
          doGniazda(g, temat, 'phx_reply', { status: 'error', response: { reason: 'Unauthorized' } }, ref, refDolaczenia);
          return;
        }
        g.tematy.set(temat, { konto, wiazania, obecnosc: tresc?.config?.presence ? { klucz: tresc.config.presence.key || `anon-${nrWiazania += 1}`, meta: null } : null });
        stan.kanaly.dolaczenia += 1;
        if (process.env.KANALY_LOG) console.log('dołączenie', temat, JSON.stringify(tresc).slice(0, 600));
        ok({ postgres_changes: wiazania });
        if (wiazania.length) doGniazda(g, temat, 'system', { status: 'ok', message: 'Subscribed to PostgreSQL', channel: temat.replace(/^realtime:/, ''), extension: 'postgres_changes' });
        if (g.tematy.get(temat).obecnosc) doGniazda(g, temat, 'presence_state', stanObecnosci(temat));
        return;
      }
      if (zdarzenie === 'presence') {
        const t = g.tematy.get(temat);
        if (t?.obecnosc) {
          const bylo = t.obecnosc.meta;
          if (tresc?.event === 'track') {
            t.obecnosc.meta = { ...(tresc.payload || {}), phx_ref: `r${nrWiazania += 1}` };
            rozeslijObecnosc(temat, { [t.obecnosc.klucz]: { metas: [t.obecnosc.meta] } }, bylo ? { [t.obecnosc.klucz]: { metas: [bylo] } } : {});
          } else if (tresc?.event === 'untrack' && bylo) {
            t.obecnosc.meta = null;
            rozeslijObecnosc(temat, {}, { [t.obecnosc.klucz]: { metas: [bylo] } });
          }
        }
        ok();
        return;
      }
      if (zdarzenie === 'access_token') { const t = g.tematy.get(temat); if (t) t.konto = kontoZTokenu(tresc?.access_token) || t.konto; return; }
      if (zdarzenie === 'phx_leave') { odejdz(g, temat); g.tematy.delete(temat); ok(); }
    });
  });
  // Obecność: stan kanału (wszyscy obecni) i zmiany rozsyłane do wszystkich w kanale, także do zgłaszającego.
  const stanObecnosci = (temat) => {
    const wynik = {};
    for (const g of gniazda) {
      const t = g.tematy.get(temat);
      if (t?.obecnosc?.meta) (wynik[t.obecnosc.klucz] ||= { metas: [] }).metas.push(t.obecnosc.meta);
    }
    return wynik;
  };
  const rozeslijObecnosc = (temat, joins, leaves) => {
    for (const g of gniazda) if (g.tematy.get(temat)?.obecnosc) doGniazda(g, temat, 'presence_diff', { joins, leaves });
  };
  const odejdz = (g, temat) => {
    const t = g.tematy.get(temat);
    if (!t?.obecnosc?.meta) return;
    const meta = t.obecnosc.meta;
    t.obecnosc.meta = null;
    rozeslijObecnosc(temat, {}, { [t.obecnosc.klucz]: { metas: [meta] } });
  };
  // Zmiana wiersza tabeli współpracy (zaproszenia, wspolpracownicy) – do kont, które RLS przepuszcza.
  stan.oglosWiersz = (tabela, typ, rekord, odbiorcy) => {
    for (const g of gniazda) {
      for (const [temat, t] of g.tematy) {
        if (!t.konto || !odbiorcy.includes(t.konto.id)) continue;
        const ids = t.wiazania.filter((b) => (b.event === '*' || b.event === typ) && b.table === tabela).map((b) => b.id);
        if (!ids.length) continue;
        doGniazda(g, temat, 'postgres_changes', {
          ids,
          data: {
            schema: 'public', table: tabela, type: typ, commit_timestamp: new Date().toISOString(), errors: null,
            columns: Object.keys(rekord).map((name) => ({ name, type: 'text' })),
            record: typ === 'DELETE' ? {} : rekord, old_record: typ === 'DELETE' ? rekord : {},
          },
        });
      }
    }
  };
  // Rozgłasza zmianę wiersza projektu (zapis z dowolnego urządzenia) do wszystkich podłączonych urządzeń konta.
  stan.oglos = (projekt, typ = 'UPDATE') => {
    for (const g of gniazda) {
      for (const [temat, t] of g.tematy) {
        // RLS: właściciel i osoby, którym projekt udostępniono; usunięcia (DELETE) Realtime rozsyła bez RLS – sam klucz wiersza.
        if (!t.konto || (typ !== 'DELETE' && !widzi(t.konto, projekt))) continue;
        const ids = t.wiazania.filter((b) => (b.event === '*' || b.event === typ) && b.table === 'projekty' && (!b.filter || b.filter === `owner_id=eq.${projekt.owner_id}`)).map((b) => b.id);
        if (!ids.length) continue;
        stan.kanaly.wyslane += 1;
        doGniazda(g, temat, 'postgres_changes', {
          ids,
          data: {
            schema: 'public', table: 'projekty', type: typ, commit_timestamp: new Date().toISOString(), errors: null,
            columns: [{ name: 'id', type: 'uuid' }, { name: 'owner_id', type: 'uuid' }, { name: 'nazwa', type: 'text' }, { name: 'wersja', type: 'int8' }, { name: 'zmieniono', type: 'timestamptz' }],
            record: typ === 'DELETE' ? {} : { id: projekt.id, owner_id: projekt.owner_id, nazwa: projekt.nazwa, wersja: projekt.wersja, zmieniono: projekt.zmieniono },
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
    // Link z poczty aplikacji (?token_hash=…): stan.linki – token → { email, typ }, jednorazowy.
    if (sc === '/auth/v1/verify' && m === 'POST') {
      const l = (stan.linki || new Map()).get(tresc.token_hash);
      if (!l || l.typ !== tresc.type) return blad(r, 403, 'Email link is invalid or has expired', 'otp_expired');
      stan.linki.delete(tresc.token_hash);
      const k = stan.konta.find((x) => x.email === l.email);
      if (!k) return blad(r, 403, 'Email link is invalid or has expired', 'otp_expired');
      k.potwierdzone = true;
      if (tresc.type === 'email_change' && k.nowyEmail) { k.email = k.nowyEmail; delete k.nowyEmail; }
      return json(r, 200, sesja(k));
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
        Object.assign(u, { wazny_do: tresc.p_wazny_do || null, nieudane: 0, blokada_do: null, zmieniono: Date.now() });
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
    if (sc.startsWith('/rest/v1/rpc/') && /dostep_ai|dostepy_ai|obraz_ai|obrazu_ai|pliki_do_usuniecia|pliki_usuniete|^\/rest\/v1\/rpc\/ai_/.test(sc)) {
      stan.ai = stan.ai || atrapaAi(stan);
      try {
        return json(r, 200, stan.ai(sc.slice('/rest/v1/rpc/'.length), tresc, zTokenu(req)));
      } catch (e) {
        return blad(r, e.status || 400, e.message, 'P0001');
      }
    }
    if (sc.startsWith('/rest/v1/rpc/') && stan.wspolpraca.ma(sc.slice('/rest/v1/rpc/'.length))) {
      try {
        return json(r, 200, stan.wspolpraca(sc.slice('/rest/v1/rpc/'.length), tresc, zTokenu(req)) ?? null);
      } catch (e) {
        return blad(r, e.status || 400, e.message, e.kod || 'P0001');
      }
    }
    // E-mail z zaproszeniem (Funkcja Edge poczta): atrapa zapisuje „wysłany” e-mail; stan.brevo = false
    // udaje brak skonfigurowanej poczty.
    if (sc === '/functions/v1/poczta' && m === 'POST') {
      const k = zTokenu(req);
      if (!k) return json(r, 401, { blad: 'Zaloguj się.' });
      const z = (stan.zaproszenia || []).find((x) => x.id === tresc.zaproszenie);
      const p = z && stan.projekty.find((x) => x.id === z.projekt_id);
      if (!z || p.owner_id !== k.id || z.stan !== 'czeka') return json(r, 400, { blad: 'Nie można wysłać tego zaproszenia.' });
      if (stan.brevo === false) return json(r, 200, { wyslano: false, powod: 'brak-konfiguracji' });
      stan.wyslane.push({ typ: 'zaproszenie', email: z.email, kod: z.kod });
      return json(r, 200, { wyslano: true, email: z.email });
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
      if (p && !['wlasciciel', 'edycja'].includes(rolaW(stan, k, p.id))) return blad(r, 403, 'Nie masz prawa zmieniać tego projektu', '42501');
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
      const p = stan.projekty.find((x) => x.id === idProjektu && widzi(k, x));
      // Jak w bazie: kolumna skrot (md5 treści jsonb, migracja miejsce_na_koncie), filtr strona_id=in.(…) i select.
      const tylko = /^in\.\((.*)\)$/.exec(url.searchParams.get('strona_id') || '')?.[1]?.split(',').map((x) => x.replace(/^"|"$/g, ''));
      const kolumny = (url.searchParams.get('select') || 'strona_id,dane').split(',').map((x) => x.trim());
      const wiersze = p ? [...stan.strony].filter(([klucz]) => klucz.startsWith(`${p.id}/`))
        .map(([klucz, dane]) => ({ strona_id: klucz.slice(p.id.length + 1), dane }))
        .filter((w) => !tylko || tylko.includes(w.strona_id))
        .map((w) => {
          const tekst = JSON.stringify(jakJsonb(w.dane));
          const pelny = { strona_id: w.strona_id, skrot: crypto.createHash('md5').update(tekst).digest('hex'), dane: jakJsonb(w.dane) };
          return Object.fromEntries(kolumny.filter((c) => c in pelny).map((c) => [c, pelny[c]]));
        }) : [];
      const tresc = JSON.stringify(wiersze);
      stan.pobraneStrony = (stan.pobraneStrony || 0) + Buffer.byteLength(tresc);
      return r.fulfill({ status: 200, contentType: 'application/json', body: tresc });
    }
    // Miejsce na koncie i sprzątanie (migracja 20261114150000_miejsce_na_koncie.sql).
    if (sc === '/rest/v1/rpc/uzycie_projektow') {
      // Jak w bazie (migracja 20261114180000_pliki_r2_limity.sql): własne projekty i projekty innych z dostępem.
      const k = zTokenu(req);
      if (!k) return blad(r, 401, 'JWT', 'PGRST301');
      const fonty = (d) => new Set((d?.czcionki || []).map((c) => c.id));
      const obrazy = (d) => Object.keys(d?.zasoby || {}).filter((id) => !fonty(d).has(id)).length;
      const strony = (pr) => (Array.isArray(pr.dane?.strony) ? pr.dane.strony.length : [...stan.strony.keys()].filter((x) => x.startsWith(`${pr.id}/`)).length);
      const wlasne = stan.projekty.filter((pr) => pr.owner_id === k.id).map((pr) => ({
        id: pr.id, nazwa: pr.nazwa, zmieniono: pr.zmieniono, obrazy: obrazy(pr.dane), strony: strony(pr),
        dane_bajty: JSON.stringify(pr.dane || {}).length, klucze_ai: (stan.dostepy || []).filter((d) => d.projekt_id === pr.id && !d.odwolany).length,
        link: Boolean(pr.dane?.udostepnienie?.kod), link_chroniony: [...(stan.chronione || new Map()).keys()].some((x) => x.startsWith(`${k.id}/${pr.id}/`)),
      }));
      const uInnych = stan.projekty.filter((pr) => pr.owner_id !== k.id && rolaW(stan, k, pr.id)).map((pr) => ({
        id: pr.id, nazwa: pr.nazwa, zmieniono: pr.zmieniono, obrazy: obrazy(pr.dane), strony: strony(pr), rola: rolaW(stan, k, pr.id),
        wlasciciel: stan.konta.find((x) => x.id === pr.owner_id)?.nazwa || 'ktoś',
      }));
      return json(r, 200, { wlasne, u_innych: uInnych });
    }
    if (/^\/rest\/v1\/rpc\/(miejsce_na_koncie|pliki_osierocone|posprzataj_konto)$/.test(sc)) {
      const k = zTokenu(req);
      if (!k) return blad(r, 401, 'JWT', 'PGRST301');
      return json(r, 200, miejsceAtrapy(stan, sc.slice('/rest/v1/rpc/'.length), tresc, k));
    }
    if (sc === '/rest/v1/projekty') {
      const k = zTokenu(req);
      if (!k) return blad(r, 401, 'JWT', 'PGRST301');
      const moje = stan.projekty.filter((p) => p.owner_id === k.id);
      const widoczne = stan.projekty.filter((p) => widzi(k, p));
      const id = (url.searchParams.get('id') || '').replace('eq.', '');
      if (m === 'GET') {
        if (id) {
          const p = widoczne.find((x) => x.id === id);
          const jeden = (req.headers().accept || '').includes('vnd.pgrst.object');
          if (!p) return jeden ? blad(r, 406, 'brak wiersza', 'PGRST116') : json(r, 200, []);
          const wiersz = { dane: jakJsonb(p.dane), wersja: p.wersja, zmieniono: p.zmieniono };
          return json(r, 200, jeden ? wiersz : [wiersz]);
        }
        return json(r, 200, widoczne.map((p) => ({ id: p.id, owner_id: p.owner_id, nazwa: p.nazwa, zmieniono: p.zmieniono, wersja: p.wersja, miniatura: p.dane.miniatura || null, udostepnienie: p.dane.udostepnienie || null })));
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
        const usuwany = stan.projekty.find((p) => p.id === id && p.owner_id === k.id);
        stan.projekty = stan.projekty.filter((p) => !(p.id === id && p.owner_id === k.id));
        for (const klucz of [...stan.strony.keys()]) if (klucz.startsWith(`${id}/`)) stan.strony.delete(klucz);
        if (usuwany) stan.oglos(usuwany, 'DELETE');
        return json(r, 200, []);
      }
    }
    // Pliki w R2 przez przekaźnik (cloudflare/api-worker.js, #92): te same klucze „zasoby/…” i „podglady/…”.
    if (sc.startsWith('/pliki/') || sc.startsWith('/podglady/')) {
      const publiczne = sc.startsWith('/podglady/');
      const reszta = decodeURIComponent(sc.slice(publiczne ? '/podglady/'.length : '/pliki/'.length));
      const k = zTokenu(req);
      const odp = (kod, dane) => r.fulfill({ status: kod, contentType: 'application/json', body: JSON.stringify(dane), headers: { 'access-control-allow-origin': '*' } });
      if (!publiczne && !k) return odp(401, { blad: 'Zaloguj się ponownie.' });
      if (!publiczne && reszta === '_miejsce') return odp(200, miejsceAtrapy(stan, 'pliki_miejsce', {}, k));
      if (!publiczne && reszta === '_osierocone') return odp(200, miejsceAtrapy(stan, 'pliki_osierocone', {}, k));
      if (!publiczne && reszta === '_lista') {
        const bucket = url.searchParams.get('bucket') === 'podglady' ? 'podglady' : 'zasoby';
        const prefiks = url.searchParams.get('prefiks') || '';
        if (!prefiks.startsWith(`${k.id}/`)) return odp(403, { blad: 'Lista tylko z własnego folderu.' });
        return odp(200, [...stan.pliki].filter(([klucz]) => klucz.startsWith(`${bucket}/${prefiks}`))
          .map(([klucz, p]) => ({ klucz: klucz.slice(bucket.length + 1), rozmiar: p.tresc?.length || 0, czas: p.czas || 0 })));
      }
      if (!publiczne && reszta === '_usun') {
        const bucket = tresc.bucket === 'podglady' ? 'podglady' : 'zasoby';
        let usuniete = 0;
        for (const x of tresc.klucze || []) if (stan.pliki.delete(`${bucket}/${x}`)) usuniete += 1;
        return odp(200, { usuniete, pominiete: (tresc.klucze || []).length - usuniete });
      }
      const klucz = `${publiczne ? 'podglady' : 'zasoby'}/${reszta}`;
      if (m === 'GET' || m === 'HEAD') {
        const plik = stan.pliki.get(klucz);
        if (!plik) return odp(404, { blad: 'Nie ma takiego pliku.' });
        return r.fulfill({ status: 200, contentType: plik.typ, body: plik.tresc, headers: { 'access-control-allow-origin': '*', 'cache-control': plik.cacheControl || 'private, max-age=31536000, immutable' } });
      }
      if (!k) return odp(401, { blad: 'Zaloguj się ponownie.' });
      if (m === 'DELETE') { stan.pliki.delete(klucz); return odp(200, { usuniete: 1 }); }
      if (m === 'PUT') {
        const dane = req.postDataBuffer() || Buffer.alloc(0);
        if (dane.length > (stan.limitPliku || 50 * 1024 * 1024)) return odp(413, { blad: 'Plik jest za duży (najwyżej 50 MB).', kod: 'limit_pliku' });
        const wlasciciel = reszta.split('/')[0];
        const zajete = [...stan.pliki].filter(([x]) => x.startsWith(`zasoby/${wlasciciel}/`) || x.startsWith(`podglady/${wlasciciel}/`))
          .reduce((n, [x, p]) => n + (x === klucz ? 0 : (p.tresc?.length || 0)), 0);
        if (zajete + dane.length > (stan.limitKonta || 2 * 1024 * 1024 * 1024)) {
          return odp(413, { blad: 'Na koncie nie ma już miejsca na pliki. Usuń nieużywane obrazy albo posprzątaj w ustawieniach konta (Miejsce).', kod: 'limit_konta' });
        }
        stan.pliki.set(klucz, { typ: req.headers()['content-type'] || 'application/octet-stream', tresc: dane, czas: Date.now(), cacheControl: req.headers()['x-cache-control'] || null });
        stan.wyslania.push(klucz);
        return odp(200, { klucz: reszta, rozmiar: dane.length });
      }
      return odp(405, { blad: 'Niedozwolona metoda.' });
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

// Okno „Dostęp dla AI” (tylko w ustawieniach konta, #100) – w testach otwierane wprost, nad otwartym projektem,
// z zaznaczonym otwartym projektem na liście nowego klucza (jak gdyby wybrał go użytkownik).
async function oknoAi(strona, { zaznacz = true } = {}) {
  await strona.evaluate(async (zaznaczOtwarty) => {
    const id = window.seriodruk?.stan?.projekt?.id;
    await (await import('./js/app/dostep-ai.js')).otworzDostepAi();
    const pole = id && zaznaczOtwarty && document.querySelector(`#dostep-ai-projekty input[value="${id}"]`);
    if (pole && !pole.checked) pole.click();
  }, zaznacz);
  await strona.waitForSelector('#dlg-dostep-ai[open]');
}

module.exports = { oknoAi, otworz, drugieUrzadzenie, nowyProjekt, ekran, wAplikacji, PNG_2X2, podlaczAtrape, zaloguj, zamknijOkno };
