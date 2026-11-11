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
  const edycja = baza('utworz_dostep_ai', { p_projekt: 'p-1', p_opis: 'Claude', p_rola: 'edycja', p_dni: 7 }, WLASCICIEL).klucz;
  const odczyt = baza('utworz_dostep_ai', { p_projekt: 'p-1', p_opis: 'Czyta', p_rola: 'odczyt', p_dni: 1 }, WLASCICIEL).klucz;
  const serwer = http.createServer((req, res) => {
    let tresc = '';
    req.on('data', (c) => { tresc += c; });
    req.on('end', () => {
      const funkcja = req.url.replace('/rest/v1/rpc/', '');
      stan.wywolania.push({ funkcja, apikey: req.headers.apikey, authorization: req.headers.authorization });
      if (funkcja === 'ai_zapisz' && stan.wtracSie) { stan.wtracSie = false; stan.projekty[0].wersja += 1; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(baza(funkcja, JSON.parse(tresc || '{}')) ?? null));
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
  return { stan, edycja, odczyt, wyslij, nowe, narzedzie, ADRES, stanProjektu };
}

test('łącznik MCP przez HTTP: starsza wersja (initialize) i 2026-07-28, lista narzędzi, odczyt i zmiana z ponowieniem po odmowie wersji', async (t) => {
  const s = await srodowisko(t);
  // Starsi klienci (np. łącznik dodany w Claude): initialize bez sesji, odpowiedź JSON.
  const init = await s.wyslij({ naglowki: { 'mcp-protocol-version': '2025-06-18' }, cialo: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude', version: '1' } } } });
  assert.equal(init.status, 200);
  assert.match(init.naglowki.get('content-type'), /application\/json/);
  assert.equal(init.naglowki.get('mcp-session-id'), null, 'łącznik nie tworzy sesji');
  assert.equal(init.tresc.result.protocolVersion, '2025-06-18');
  assert.equal(init.tresc.result.serverInfo.name, 'seriodruk');
  const pow = await s.wyslij({ cialo: { jsonrpc: '2.0', method: 'notifications/initialized' } });
  assert.equal(pow.status, 202);
  assert.equal(pow.tresc, null);
  const lista = await s.wyslij({ cialo: { jsonrpc: '2.0', id: 2, method: 'tools/list' } });
  const nazwy = lista.tresc.result.tools.map((x) => x.name);
  for (const n of ['przeglad_projektu', 'czytaj', 'zmien_elementy', 'zmien_czesc', 'zmien_projekt', 'kontrola', 'opis_formatu']) assert.ok(nazwy.includes(n), n);
  const stara = await s.wyslij({ cialo: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'przeglad_projektu', arguments: {} } } });
  assert.match(stara.tresc.result.content[0].text, /Projekt „Kalendarz” – wersja 1/);

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
  const brak = await przeglad({ url: s.ADRES });
  assert.equal(brak.blad, true);
  assert.match(brak.tekst, /nie zawiera klucza/);
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
  // Bez OAuth: brak opisu serwera autoryzacji (Claude wybiera wtedy łącznik „bez logowania”).
  assert.equal((await s.wyslij({ metoda: 'GET', url: `${s.ADRES}/${s.edycja}/.well-known/oauth-protected-resource` })).status, 404);
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
