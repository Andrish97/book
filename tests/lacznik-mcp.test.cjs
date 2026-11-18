// Zdalny łącznik MCP (supabase/functions/_shared/mcp-http.mjs – logika Funkcji Edge supabase/functions/mcp)
// uruchomiony w Node przez zwykłe Request/Response, połączony z lokalnym serwerem HTTP udającym funkcje bazy
// (tests/atrapa-ai.cjs). Do tego: serwer stdio jest aktualnie złożony ze wspólnego rdzenia.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { atrapaAi } = require('./atrapa-ai.cjs');

const KORZEN = path.join(__dirname, '..');
const HTTP_MCP = pathToFileURL(path.join(KORZEN, 'supabase', 'functions', '_shared', 'mcp-http.mjs')).href;
const WLASCICIEL = { id: 'u-1' };

function projekt() {
  return {
    id: 'p-1', owner_id: WLASCICIEL.id, nazwa: 'Kalendarz', wersja: 1, zmieniono: '2026-11-01T00:00:00Z',
    dane: {
      id: 'p-1', nazwa: 'Kalendarz', strony_osobno: false, zasoby: {},
      sekcje: [{ id: 'sek1', nazwa: 'Środek', wydruk: { szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3 } }],
      wzorce: [], style: [], tabele: [], serie: [],
      strony: [{ id: 's1', nazwa: 'Okładka', sekcja: 'sek1', obiekty: [{ id: 'tyt', type: 'textbox', text: 'Kalendarz', left: 10, top: 10, width: 100, height: 10 }] }],
    },
  };
}

async function srodowisko(t) {
  const stan = { projekty: [projekt()], strony: new Map(), wywolania: [] };
  const baza = atrapaAi(stan);
  const edycja = baza('utworz_dostep_ai', { p_projekty: ['p-1'], p_opis: 'Claude', p_rola: 'edycja', p_dni: 7 }, WLASCICIEL).klucz;
  const odczyt = baza('utworz_dostep_ai', { p_projekty: ['p-1'], p_opis: 'Czyta', p_rola: 'odczyt', p_dni: 1 }, WLASCICIEL).klucz;
  const serwer = http.createServer((req, res) => {
    let tresc = '';
    req.on('data', (c) => { tresc += c; });
    req.on('end', () => {
      const funkcja = req.url.replace('/rest/v1/rpc/', '');
      stan.wywolania.push({ funkcja, apikey: req.headers.apikey, authorization: req.headers.authorization });
      if (funkcja === 'ai_zapisz' && stan.wtracSie) { stan.wtracSie = false; stan.projekty[0].wersja += 1; }
      res.setHeader('content-type', 'application/json');
      try { res.end(JSON.stringify(baza(funkcja, JSON.parse(tresc || '{}')) ?? null)); } catch (e) { res.statusCode = e.status || 400; res.end(JSON.stringify({ message: e.message })); }
    });
  });
  await new Promise((r) => serwer.listen(0, '127.0.0.1', r));
  t.after(() => serwer.close());
  const { obsluzHttp } = await import(HTTP_MCP);
  const env = { adres: `http://127.0.0.1:${serwer.address().port}`, kluczPubliczny: 'sb_publishable_test' };
  const ADRES = 'https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp';
  // Jedno żądanie do łącznika; zwraca { status, naglowki, tresc }.
  const wyslij = async ({ url = `${ADRES}/${edycja}`, metoda = 'POST', naglowki = {}, cialo } = {}) => {
    const odp = await obsluzHttp(new Request(url, {
      method: metoda,
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...naglowki },
      ...(cialo === undefined ? {} : { body: typeof cialo === 'string' ? cialo : JSON.stringify(cialo) }),
    }), env);
    const tekst = await odp.text();
    return { status: odp.status, naglowki: odp.headers, tresc: tekst ? JSON.parse(tekst) : null };
  };
  const META = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' }, 'io.modelcontextprotocol/clientCapabilities': {} };
  // Żądanie w wersji 2026-07-28 z wymaganymi nagłówkami.
  let nr = 0;
  const nowe = (method, params = {}, opcje = {}) => wyslij({
    ...opcje,
    naglowki: { 'mcp-protocol-version': '2026-07-28', 'mcp-method': method, ...(params.name ? { 'mcp-name': params.name } : {}), ...(opcje.naglowki || {}) },
    cialo: { jsonrpc: '2.0', id: (nr += 1), method, params: { ...params, _meta: META } },
  });
  const narzedzie = async (name, args = {}, opcje = {}) => {
    const w = await nowe('tools/call', { name, arguments: args }, opcje);
    return { status: w.status, blad: w.tresc.result?.isError, tekst: w.tresc.result?.content?.[0]?.text, odp: w.tresc };
  };
  const stanProjektu = () => baza('ai_projekt', { p_klucz: edycja }).projekt;
  return { stan, edycja, odczyt, wyslij, nowe, narzedzie, ADRES, stanProjektu, env, baza };
}

test('łącznik MCP przez HTTP: starsza wersja (initialize) i 2026-07-28, lista narzędzi, odczyt i zmiana z ponowieniem po odmowie wersji', async (t) => {
  const s = await srodowisko(t);
  // Starsi klienci (np. łącznik dodany w Claude): initialize bez sesji, odpowiedź JSON.
  const init = await s.wyslij({ naglowki: { 'mcp-protocol-version': '2025-06-18' }, cialo: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude', version: '1' } } } });
  assert.equal(init.status, 200);
  assert.match(init.naglowki.get('content-type'), /application\/json/);
  assert.equal(init.naglowki.get('mcp-session-id'), null, 'łącznik nie tworzy sesji');
  assert.equal(init.tresc.result.protocolVersion, '2025-06-18');
  assert.equal(init.tresc.result.serverInfo.name, 'makietka');
  assert.equal(init.tresc.result.serverInfo.websiteUrl, 'https://makietka.app/');
  assert.deepEqual(init.tresc.result.serverInfo.icons.map((i) => i.src), ['https://makietka.app/img/ikony/ikona-192.png', 'https://makietka.app/img/ikony/ikona.svg']);
  const pow = await s.wyslij({ cialo: { jsonrpc: '2.0', method: 'notifications/initialized' } });
  assert.equal(pow.status, 202);
  assert.equal(pow.tresc, null);
  const lista = await s.wyslij({ cialo: { jsonrpc: '2.0', id: 2, method: 'tools/list' } });
  const nazwy = lista.tresc.result.tools.map((x) => x.name);
  for (const n of ['przeglad_projektu', 'czytaj', 'zmien_elementy', 'zmien_czesc', 'zmien_projekt', 'kontrola', 'opis_formatu']) assert.ok(nazwy.includes(n), n);
  const stara = await s.wyslij({ cialo: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'przeglad_projektu', arguments: {} } } });
  assert.match(stara.tresc.result.content[0].text, /Projekt „Kalendarz” \(id p-1\) – wersja 1/);

  // Wersja 2026-07-28: server/discover, tools/call z nagłówkami; równoległa zmiana → ponowienie.
  const odkrycie = await s.nowe('server/discover');
  assert.ok(odkrycie.tresc.result.supportedVersions.includes('2026-07-28'));
  s.stan.wtracSie = true;
  const z = await s.narzedzie('zmien_elementy', { gdzie: 'strona:s1', zmiany: [{ id: 'tyt', pola: { text: 'Kalendarz 2027' } }] });
  assert.equal(z.blad, false, z.tekst);
  assert.match(z.tekst, /Zapisano/);
  assert.equal(s.stanProjektu().strony[0].obiekty[0].text, 'Kalendarz 2027');
  // Do bazy łącznik idzie z kluczem publicznym; klucz sdk tylko w treści wywołania funkcji.
  assert.ok(s.stan.wywolania.every((w) => w.apikey === 'sb_publishable_test' && w.authorization === 'Bearer sb_publishable_test'));
});

test('łącznik MCP przez HTTP: klucz w adresie, w ?klucz= i w nagłówku; zły i brakujący klucz; klucz tylko do odczytu', async (t) => {
  const s = await srodowisko(t);
  const przeglad = (opcje) => s.narzedzie('przeglad_projektu', {}, opcje);
  assert.equal((await przeglad({ url: `${s.ADRES}/${s.edycja}` })).blad, false);
  assert.equal((await przeglad({ url: `${s.ADRES}?klucz=${s.edycja}` })).blad, false);
  assert.equal((await przeglad({ url: s.ADRES, naglowki: { authorization: `Bearer ${s.edycja}` } })).blad, false);
  // Bez klucza – 401 z opisem zasobu (klient MCP zaczyna logowanie OAuth, #244).
  const brak = await s.nowe('tools/call', { name: 'przeglad_projektu', arguments: {} }, { url: s.ADRES });
  assert.equal(brak.status, 401);
  assert.match(brak.naglowki.get('www-authenticate'), /^Bearer resource_metadata="https:\/\/api\.makietka\.app\/\.well-known\/oauth-protected-resource\/mcp"$/);
  const zly = await przeglad({ url: `${s.ADRES}/sdk_zly` });
  assert.match(zly.tekst, /nieprawidłowy klucz/i);
  const zlyPoprawnyWzor = await przeglad({ url: `${s.ADRES}/${s.edycja.slice(0, -4)}abcd` });
  assert.match(zlyPoprawnyWzor.tekst, /Nieprawidłowy klucz dostępu/);
  const czyta = await s.narzedzie('nazwa_projektu', { nazwa: 'X' }, { url: `${s.ADRES}/${s.odczyt}` });
  assert.equal(czyta.blad, true);
  assert.match(czyta.tekst, /tylko czytać/);
  assert.equal(s.stanProjektu().nazwa, 'Kalendarz');
});

test('łącznik MCP przez HTTP: CORS, OPTIONS, GET 405, brak OAuth, Origin, błędne nagłówki i wersja, zły JSON', async (t) => {
  const s = await srodowisko(t);
  const opt = await s.wyslij({ metoda: 'OPTIONS', naglowki: { origin: 'https://claude.ai' } });
  assert.equal(opt.status, 204);
  assert.equal(opt.naglowki.get('access-control-allow-origin'), 'https://claude.ai');
  assert.match(opt.naglowki.get('access-control-allow-headers'), /mcp-protocol-version/);
  const get = await s.wyslij({ metoda: 'GET' });
  assert.equal(get.status, 405);
  assert.match(get.naglowki.get('allow'), /POST/);
  assert.equal((await s.wyslij({ metoda: 'DELETE' })).status, 405);
  // OAuth (#244): opis zasobu dostępny (logowanie „Połącz z Makietką”); adres z kluczem działa dalej bez logowania.
  assert.equal((await s.wyslij({ metoda: 'GET', url: `${s.ADRES}/.well-known/oauth-protected-resource` })).status, 200);
  // Obce strony w przeglądarce – odmowa; znane – nagłówek CORS.
  assert.equal((await s.nowe('ping', {}, { naglowki: { origin: 'https://zla.example' } })).status, 403);
  const znana = await s.nowe('ping', {}, { naglowki: { origin: 'https://chatgpt.com' } });
  assert.equal(znana.status, 200);
  assert.equal(znana.naglowki.get('access-control-allow-origin'), 'https://chatgpt.com');
  // 2026-07-28: nagłówki muszą zgadzać się z treścią.
  const zleNaglowki = await s.nowe('tools/list', {}, { naglowki: { 'mcp-method': 'ping' } });
  assert.equal(zleNaglowki.status, 400);
  assert.equal(zleNaglowki.tresc.error.code, -32020);
  const zlaNazwa = await s.narzedzie('przeglad_projektu', {}, { naglowki: { 'mcp-name': 'czytaj' } });
  assert.equal(zlaNazwa.status, 400);
  const nazwaB64 = await s.narzedzie('przeglad_projektu', {}, { naglowki: { 'mcp-name': `=?base64?${Buffer.from('przeglad_projektu').toString('base64')}?=` } });
  assert.equal(nazwaB64.status, 200);
  // Nieznana wersja protokołu → 400 z listą obsługiwanych.
  const wersja = await s.wyslij({ naglowki: { 'mcp-protocol-version': '1999-01-01', 'mcp-method': 'ping' }, cialo: { jsonrpc: '2.0', id: 9, method: 'ping', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '1999-01-01' } } } });
  assert.equal(wersja.status, 400);
  assert.ok(wersja.tresc.error.data.supported.includes('2026-07-28'));
  // Nieznana metoda w 2026-07-28 → 404; w starszej wersji → 200 z błędem JSON-RPC.
  assert.equal((await s.nowe('nie/ma')).status, 404);
  assert.equal((await s.wyslij({ cialo: { jsonrpc: '2.0', id: 10, method: 'nie/ma' } })).status, 200);
  const zlyJson = await s.wyslij({ cialo: '{nie json' });
  assert.equal(zlyJson.status, 400);
  assert.equal(zlyJson.tresc.error.code, -32700);
  // Lista wiadomości (2025-03-26).
  const paczka = await s.wyslij({ cialo: [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }] });
  assert.equal(paczka.tresc.length, 1);
});

test('serwer stdio jest złożony z aktualnego rdzenia; funkcja zadeklarowana do wdrożenia bez JWT', () => {
  execFileSync(process.execPath, [path.join(KORZEN, 'scripts', 'mcp-buduj.cjs'), '--sprawdz']);
  const config = fs.readFileSync(path.join(KORZEN, 'supabase', 'config.toml'), 'utf8');
  assert.match(config, /\[functions\.mcp\]\s*\nenabled = true\s*\nverify_jwt = false\s*\nentrypoint = "\.\/functions\/mcp\/index\.ts"/);
  const funkcja = fs.readFileSync(path.join(KORZEN, 'supabase', 'functions', 'mcp', 'index.ts'), 'utf8');
  assert.match(funkcja, /from '\.\.\/_shared\/mcp-http\.mjs'/);
  assert.doesNotMatch(funkcja + fs.readFileSync(path.join(KORZEN, 'supabase', 'functions', '_shared', 'mcp-http.mjs'), 'utf8'), /SERVICE_ROLE|service_role/);
});

// #239: AI bez łącznika MCP (darmowe czaty umiejące otwierać adresy) – ten sam adres otwarty zwykłym GET daje
// opis i narzędzia w tekście; …/n/<narzędzie>?parametr=… wywołuje narzędzie (odczyt i zmiana, uprawnienia klucza).
test('łącznik przez zwykłe adresy (GET): opis z narzędziami, odczyt, zmiana, ?json=, klucz tylko do odczytu, zły klucz', async (t) => {
  const s = await srodowisko(t);
  const get = async (url) => {
    const odp = await (await import(HTTP_MCP)).obsluzHttp(new Request(url, { headers: { accept: 'text/html' } }), s.env);
    return { status: odp.status, typ: odp.headers.get('content-type'), tresc: await odp.text() };
  };
  const strona = await get(`${s.ADRES}/${s.edycja}`);
  assert.equal(strona.status, 200);
  assert.match(strona.typ, /text\/plain/);
  assert.match(strona.tresc, /DOSTĘP DLA AI PRZEZ ADRESY/);
  // Linki zawsze publiczne https (nie http:// i host bazy, pod którym funkcja widzi żądanie – #246).
  assert.ok(strona.tresc.includes(`https://api.makietka.app/mcp/${s.edycja}/n/przeglad_projektu`), 'link https na api.makietka.app');
  assert.ok(!/http:\/\//.test(strona.tresc), 'żadnych linków http://');
  assert.match(strona.tresc, /zmien_elementy\n/);
  const przeglad = await get(`${s.ADRES}/${s.edycja}/n/przeglad_projektu`);
  assert.match(przeglad.tresc, /^WYNIK narzędzia przeglad_projektu/);
  assert.match(przeglad.tresc, /Kalendarz/);
  const zmiana = await get(`${s.ADRES}/${s.edycja}/n/nazwa_projektu?nazwa=${encodeURIComponent('Kalendarz 2027')}`);
  assert.match(zmiana.tresc, /^WYNIK/);
  assert.equal(s.stanProjektu().nazwa, 'Kalendarz 2027');
  const json = await get(`${s.ADRES}/${s.edycja}/n/zmien_elementy?json=${encodeURIComponent(JSON.stringify({ gdzie: 'strona:s1', zmiany: [{ id: 'tyt', pola: { text: 'Kalendarz na rok 2027' } }] }))}`);
  assert.match(json.tresc, /^WYNIK/, json.tresc);
  assert.equal(s.stanProjektu().strony[0].obiekty[0].text, 'Kalendarz na rok 2027');
  const czyta = await get(`${s.ADRES}/${s.odczyt}/n/nazwa_projektu?nazwa=X`);
  assert.match(czyta.tresc, /^BŁĄD[\s\S]*tylko czytać/);
  assert.equal(s.stanProjektu().nazwa, 'Kalendarz 2027');
  assert.equal((await get(`${s.ADRES}?klucz=${s.edycja}`)).status, 200, 'klucz w ?klucz=');
  assert.equal((await get(`${s.ADRES}/sdk_zly`)).status, 401);
  // Klient MCP pytający GET o strumień dalej dostaje 405.
  assert.equal((await s.wyslij({ metoda: 'GET' })).status, 405);
});

// #244: logowanie OAuth 2.1 – rejestracja klienta, /authorize → strona zgody w Makietce, zgoda użytkownika,
// /token z PKCE → token (klucz dostępu z wybranym zakresem), narzędzia z Authorization: Bearer.
test('łącznik z logowaniem OAuth: opisy, rejestracja, authorize → zgoda → token z PKCE, praca z tokenem, kod jednorazowy', async (t) => {
  const s = await srodowisko(t);
  const crypto = require('node:crypto');
  const { obsluzHttp } = await import(HTTP_MCP);
  const env = { ...s.env, publiczny: 'https://api.makietka.app', aplikacja: 'https://makietka.app/' };
  const zadanie = async (url, opcje = {}) => obsluzHttp(new Request(url, opcje), env);
  const zasob = await (await zadanie('https://x.supabase.co/functions/v1/mcp/.well-known/oauth-protected-resource/mcp')).json();
  assert.deepEqual([zasob.resource, zasob.authorization_servers], ['https://api.makietka.app/mcp', ['https://api.makietka.app']]);
  const serwer = await (await zadanie('https://x.supabase.co/functions/v1/mcp/.well-known/oauth-authorization-server')).json();
  assert.equal(serwer.token_endpoint, 'https://api.makietka.app/mcp/oauth/token');
  assert.deepEqual(serwer.code_challenge_methods_supported, ['S256']);
  // Rejestracja (DCR).
  const rej = await zadanie(`${s.ADRES}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] }) });
  assert.equal(rej.status, 201);
  const { client_id: klient } = await rej.json();
  assert.match(klient, /^mk_/);
  assert.equal((await zadanie(`${s.ADRES}/oauth/register`, { method: 'POST', body: JSON.stringify({ redirect_uris: ['http://zly.example/cb'] }) })).status, 400, 'adres powrotu tylko https');
  // Authorize z PKCE → przekierowanie na stronę zgody w Makietce.
  const weryfikator = crypto.randomBytes(32).toString('base64url');
  const wyzwanie = crypto.createHash('sha256').update(weryfikator).digest('base64url');
  const powrot = 'https://claude.ai/api/mcp/auth_callback';
  const aut = await zadanie(`${s.ADRES}/oauth/authorize?response_type=code&client_id=${klient}&redirect_uri=${encodeURIComponent(powrot)}&code_challenge=${wyzwanie}&code_challenge_method=S256&state=abc`);
  assert.equal(aut.status, 302);
  const id = /#\/polacz-ai\/([0-9a-f]+)$/.exec(aut.headers.get('location'))?.[1];
  assert.ok(id, aut.headers.get('location'));
  assert.equal((await zadanie(`${s.ADRES}/oauth/authorize?response_type=code&client_id=${klient}&redirect_uri=${encodeURIComponent('https://inny.example/cb')}&code_challenge=${wyzwanie}`)).status, 400, 'obcy adres powrotu');
  // Zgoda zalogowanego użytkownika (strona w aplikacji woła oauth_zatwierdz).
  assert.deepEqual(s.baza('oauth_zadanie', { p_id: id }), { klient: 'Claude', host: 'claude.ai' });
  const { adres } = s.baza('oauth_zatwierdz', { p_id: id, p_rola: 'edycja', p_dni: 30, p_zakres: 'wybrane', p_projekty: ['p-1'] }, { id: 'u-1' });
  const kod = new URL(adres).searchParams.get('code');
  assert.equal(new URL(adres).searchParams.get('state'), 'abc');
  // Token: zły weryfikator → invalid_grant; dobry → klucz; drugi raz ten sam kod → invalid_grant.
  const token = (w) => zadanie(`${s.ADRES}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: kod, code_verifier: w, client_id: klient, redirect_uri: powrot }).toString() });
  const zly = await token('x'.repeat(43));
  assert.equal(zly.status, 400);
  const dobry = await zadanie(`${s.ADRES}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: kod, code_verifier: weryfikator, client_id: klient, redirect_uri: powrot }).toString() });
  assert.equal(dobry.status, 400, 'kod już zużyty przez złą próbę – jednorazowy');
  // Nowy przebieg i poprawna wymiana.
  const aut2 = await zadanie(`${s.ADRES}/oauth/authorize?response_type=code&client_id=${klient}&redirect_uri=${encodeURIComponent(powrot)}&code_challenge=${wyzwanie}&code_challenge_method=S256`);
  const id2 = /polacz-ai\/([0-9a-f]+)$/.exec(aut2.headers.get('location'))[1];
  const kod2 = new URL(s.baza('oauth_zatwierdz', { p_id: id2, p_rola: 'edycja', p_dni: 30, p_zakres: 'wybrane', p_projekty: ['p-1'] }, { id: 'u-1' }).adres).searchParams.get('code');
  const odp = await zadanie(`${s.ADRES}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: kod2, code_verifier: weryfikator, client_id: klient, redirect_uri: powrot }).toString() });
  assert.equal(odp.status, 200);
  const tok = await odp.json();
  assert.equal(tok.token_type, 'Bearer');
  assert.match(tok.access_token, /^sdk_/);
  assert.ok(tok.expires_in > 29 * 86400);
  // Praca łącznika z tokenem w nagłówku (adres bez klucza – tak łączą się Claude i ChatGPT po zalogowaniu).
  const zToken = await s.narzedzie('przeglad_projektu', {}, { url: s.ADRES, naglowki: { authorization: `Bearer ${tok.access_token}` } });
  assert.equal(zToken.blad, false);
  assert.match(zToken.tekst, /Kalendarz/);
  // Klucz z logowania widać w ustawieniach konta jak każdy inny.
  assert.ok(s.baza('dostepy_ai', {}, { id: 'u-1' }).some((d) => d.opis === 'Łącznik: Claude'));
});

// #244: zwykłe adresy z tokenem z logowania w nagłówku: opis bez klucza w linkach, wywołanie narzędzia przez ?json=.
test('zwykłe adresy z tokenem OAuth w nagłówku : opis bez klucza w linkach, narzędzie przez ?json=', async (t) => {
  const s = await srodowisko(t);
  const { obsluzHttp } = await import(HTTP_MCP);
  const get = async (url) => (await obsluzHttp(new Request(url, { headers: { authorization: `Bearer ${s.edycja}`, accept: 'text/plain' } }), s.env)).text();
  const opis = await get(s.ADRES);
  assert.match(opis, /DOSTĘP DLA AI PRZEZ ADRESY/);
  assert.ok(!opis.includes(s.edycja), 'klucz nie wraca w treści');
  const w = await get(`${s.ADRES}/n/przeglad_projektu?json=${encodeURIComponent('{}')}`);
  assert.match(w, /^WYNIK narzędzia przeglad_projektu/);
});
