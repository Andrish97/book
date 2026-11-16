// Serwer MCP (ai/mcp/makietka-mcp.mjs) jako osobny proces, połączony z lokalnym serwerem HTTP, który
// udaje funkcje bazy (tests/atrapa-ai.cjs – te same zasady co migracja). Bez przeglądarki.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { atrapaAi } = require('./atrapa-ai.cjs');

const SERWER = path.join(__dirname, '..', 'ai', 'mcp', 'makietka-mcp.mjs');
const WLASCICIEL = { id: 'u-1' };

function projektProby() {
  const strona = (id, nazwa, obiekty, extra = {}) => ({ id, nazwa, sekcja: 'sek1', wzorce: 'z_sekcji', obiekty, ...extra });
  return {
    id: 'p-1', owner_id: WLASCICIEL.id, nazwa: 'Kalendarz', wersja: 1, zmieniono: '2026-11-01T00:00:00Z',
    dane: {
      id: 'p-1', nazwa: 'Kalendarz', strony_osobno: false, miniatura: 'data:…', zasoby: { z1: { nazwa: 'las.jpg', typ: 'image/jpeg', dane: 'data:…' } },
      sekcje: [{ id: 'sek1', nazwa: 'Środek', wydruk: { szerokosc_mm: 210, wysokosc_mm: 297, spad_mm: 3 }, wzorce: ['wz1'] }],
      wzorce: [{ id: 'wz1', nazwa: 'Stopka', obiekty: [{ id: 'nr', type: 'textbox', text: '{nr}', left: 100, top: 280, width: 10, height: 5, styl: 'st1' }] }],
      style: [{ id: 'st1', nazwa: 'Tekst', fontFamily: 'Inter', fontSize: 4, fill: '#1a1a1a' }],
      tabele: [{ id: 't1', nazwa: 'Miesiące', kolumny: ['miesiac', 'zdjecie'], wiersze: [['Styczeń', 'las.jpg'], ['Luty', 'morze.jpg']] }],
      serie: [{ id: 'ser1', nazwa: 'Miesiące', tabela: 't1', tryb: 'tabela' }],
      strony: [
        strona('s1', 'Okładka', [
          { id: 'tlo', type: 'rect', left: 0, top: 0, width: 210, height: 297, fill: '#ffffff' },
          { id: 'tyt', type: 'textbox', text: 'Kalendarz {rok}', left: 20, top: 30, width: 170, height: 20, styl: 'st1', fontSize: 9, styles: { 0: { 0: { fill: '#ff0000', fontWeight: 'bold' } } } },
        ]),
        strona('s2', 'Miesiąc', [
          { id: 'mies', type: 'textbox', text: '{miesiac} {kolor}', left: 20, top: 20, width: 100, height: 10 },
          { id: 'foto', type: 'image', zasob: 'z1', pole: { kolumna: 'zdjecie' }, left: 0, top: 40, width: 210, height: 150 },
        ], { seria: 'ser1' }),
      ],
    },
  };
}

async function srodowisko(t) {
  const stan = { projekty: [projektProby()], strony: new Map(), wywolania: [] };
  const baza = atrapaAi(stan);
  const edycja = baza('utworz_dostep_ai', { p_projekty: ['p-1'], p_opis: 'Claude', p_rola: 'edycja', p_dni: 7 }, WLASCICIEL).klucz;
  const odczyt = baza('utworz_dostep_ai', { p_projekty: ['p-1'], p_opis: 'Czyta', p_rola: 'odczyt', p_dni: 1 }, WLASCICIEL).klucz;
  const http1 = http.createServer((req, res) => {
    let tresc = '';
    req.on('data', (c) => { tresc += c; });
    req.on('end', () => {
      const funkcja = req.url.replace('/rest/v1/rpc/', '');
      stan.wywolania.push({ funkcja, apikey: req.headers.apikey });
      const dane = JSON.parse(tresc || '{}');
      // Równoległa zmiana właściciela tuż przed zapisem AI → serwer MCP musi pobrać projekt i spróbować jeszcze raz.
      if (funkcja === 'ai_zapisz' && stan.wtracSie) { stan.wtracSie = false; stan.projekty[0].wersja += 1; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(baza(funkcja, dane) ?? null));
    });
  });
  await new Promise((r) => http1.listen(0, '127.0.0.1', r));
  t.after(() => http1.close());

  const uruchom = (klucz) => {
    const proc = spawn(process.execPath, [SERWER], {
      env: { ...process.env, MAKIETKA_KLUCZ: klucz, MAKIETKA_ADRES: `http://127.0.0.1:${http1.address().port}`, MAKIETKA_KLUCZ_PUBLICZNY: 'sb_publishable_test' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    t.after(() => proc.kill());
    const czekaja = new Map();
    const linie = [];
    createInterface({ input: proc.stdout }).on('line', (l) => {
      linie.push(l);
      const o = JSON.parse(l);
      czekaja.get(o.id)?.(o);
    });
    let n = 0;
    const wyslij = (method, params, id = (n += 1)) => new Promise((r) => {
      czekaja.set(id, r);
      proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) })}\n`);
    });
    const meta = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } };
    const narzedzie = async (name, args = {}) => {
      const o = await wyslij('tools/call', { ...meta, name, arguments: args });
      assert.ok(o.result, JSON.stringify(o));
      return { tekst: o.result.content[0].text, blad: o.result.isError, wynik: o.result };
    };
    return { proc, wyslij, narzedzie, meta, linie };
  };
  const projekt = () => baza('ai_projekt', { p_klucz: edycja });
  return { stan, edycja, odczyt, uruchom, projekt };
}

test('MCP: rozpoczęcie (stara i nowa wersja protokołu), lista narzędzi, odmowa nieznanej wersji', async (t) => {
  const s = await srodowisko(t);
  const mcp = s.uruchom(s.edycja);
  const init = await mcp.wyslij('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.name, 'makietka');
  assert.equal(init.result.serverInfo.title, 'Makietka');
  assert.equal(init.result.serverInfo.icons[0].mimeType, 'image/png');
  assert.ok(init.result.capabilities.tools);
  mcp.proc.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  const lista = await mcp.wyslij('tools/list');
  const nazwy = lista.result.tools.map((x) => x.name);
  for (const n of ['przeglad_projektu', 'czytaj', 'zmien_elementy', 'dodaj_elementy', 'usun_elementy', 'dodaj_strone', 'usun_strony', 'kolejnosc_stron', 'zmien_tabele', 'zmien_czesc', 'zmien_projekt', 'kontrola', 'opis_formatu']) assert.ok(nazwy.includes(n), n);
  for (const x of lista.result.tools) {
    assert.equal(x.inputSchema.type, 'object');
    assert.ok(x.description.length > 20, x.name);
  }
  assert.equal(lista.result.resultType, undefined, 'stara wersja – bez resultType');

  const nowy = s.uruchom(s.edycja);
  const odkrycie = await nowy.wyslij('server/discover', nowy.meta);
  assert.ok(odkrycie.result.supportedVersions.includes('2026-07-28'));
  assert.equal(odkrycie.result._meta['io.modelcontextprotocol/serverInfo'].name, 'makietka');
  assert.equal(odkrycie.result.ttlMs >= 0, true, 'server/discover: ttlMs (2026-07-28)');
  assert.ok(['public', 'private'].includes(odkrycie.result.cacheScope));
  const listaNowa = (await nowy.wyslij('tools/list', nowy.meta)).result;
  assert.equal(listaNowa.resultType, 'complete');
  // Claude Desktop odrzucał listę bez wskazówek pamięci: „Invalid result for tools/list: ttlMs… cacheScope…”.
  assert.equal(typeof listaNowa.ttlMs, 'number');
  assert.ok(['public', 'private'].includes(listaNowa.cacheScope));
  // Po server/discover tools/list bez wersji w _meta też jest w trybie 2026-07-28 (tak pyta Claude Desktop).
  const bezMeta = (await nowy.wyslij('tools/list', {})).result;
  assert.equal(bezMeta.resultType, 'complete');
  assert.equal(typeof bezMeta.ttlMs, 'number');
  const zla = await nowy.wyslij('tools/list', { _meta: { 'io.modelcontextprotocol/protocolVersion': '1999-01-01' } });
  assert.equal(zla.error.code, -32022);
  assert.ok(zla.error.data.supported.includes('2026-07-28'));
  assert.equal((await nowy.wyslij('ping', nowy.meta)).result.resultType, 'complete');
  assert.equal((await nowy.wyslij('nie/ma', nowy.meta)).error.code, -32601);
  // Zapytania idą z kluczem publicznym bazy, nigdy z kluczem dostępu w nagłówku.
  await nowy.narzedzie('przeglad_projektu');
  assert.ok(s.stan.wywolania.every((w) => w.apikey === 'sb_publishable_test'));
});

test('MCP: odczyt i zmiany strony, wzorca, stylu, tabeli, serii i sekcji; odmowa wersji z ponowieniem; klucz tylko do odczytu', async (t) => {
  const s = await srodowisko(t);
  const mcp = s.uruchom(s.edycja);
  const { narzedzie } = mcp;

  const przeglad = await narzedzie('przeglad_projektu');
  assert.match(przeglad.tekst, /Projekt „Kalendarz” \(id p-1\) – wersja 1/);
  assert.match(przeglad.tekst, /s2 „Miesiąc” sekcja=sek1 seria=ser1/);
  assert.match(przeglad.tekst, /mies \(textbox: „\{miesiac\} \{kolor\}”\)/);
  assert.doesNotMatch(przeglad.tekst, /data:/, 'treści obrazów nie wychodzą z bazy');
  assert.match((await narzedzie('czytaj', { co: 'tabela', id: 't1' })).tekst, /"Styczeń"/);
  assert.equal((await narzedzie('czytaj', { co: 'strona', id: 'nie-ma' })).blad, true);

  // Strona: zmiana elementu, z równoległą zmianą tuż przed zapisem (odmowa wersji → ponowienie).
  s.stan.wtracSie = true;
  const z = await narzedzie('zmien_elementy', { gdzie: 'strona:s1', zmiany: [{ id: 'tlo', pola: { fill: '#c1121f' } }] });
  assert.equal(z.blad, false, z.tekst);
  assert.match(z.tekst, /Zapisano \(wersja 3\)/);
  assert.equal(s.projekt().projekt.strony[0].obiekty[0].fill, '#c1121f');
  // Dodanie i usunięcie elementu, nowa strona za okładką, kolejność.
  const d = await narzedzie('dodaj_elementy', { gdzie: 'strona:s1', elementy: [{ type: 'Textbox', text: 'Nowy', left: 20, top: 60, width: 50, height: 8 }] });
  assert.equal(d.blad, false, d.tekst);
  const nowy = s.projekt().projekt.strony[0].obiekty.at(-1);
  assert.equal(nowy.type, 'textbox');
  assert.equal(nowy.strokeWidth, 0);
  // Bez kroju i rozmiaru: jak przycisk „Tekst” (Inter 14 pt), nie domyślne Fabric (Times, 40 mm).
  assert.equal(nowy.fontFamily, 'Inter');
  assert.ok(Math.abs(nowy.fontSize - 4.939) < 0.01);
  assert.equal(nowy.width, 50, 'podana szerokość zostaje');
  await narzedzie('usun_elementy', { gdzie: 'strona:s1', id: [nowy.id] });
  // Kod QR / EAN (#128): skrócona postać { type: 'kod' } zapisuje się jako grupa z opisem (rysunek doda aplikacja).
  const dk = await narzedzie('dodaj_elementy', { gdzie: 'strona:s1', elementy: [{ type: 'kod', rodzaj: 'ean', tresc: '978-83-01-00000', left: 20, top: 200 }] });
  assert.equal(dk.blad, false, dk.tekst);
  const kod = s.projekt().projekt.strony[0].obiekty.at(-1);
  assert.equal(kod.type, 'group');
  assert.deepEqual([kod.kod.rodzaj, kod.kod.tresc, kod.kod.szerokosc, kod.kod.wysokosc, kod.objects.length], ['ean', '978-83-01-00000', 37.29, 25.93, 0]);
  await narzedzie('usun_elementy', { gdzie: 'strona:s1', id: [kod.id] });
  assert.equal(s.projekt().projekt.strony[0].obiekty.length, 2);
  const ns = await narzedzie('dodaj_strone', { strona: { nazwa: 'Wstęp' }, po: 's1' });
  assert.equal(ns.blad, false, ns.tekst);
  let p = s.projekt().projekt;
  assert.deepEqual(p.strony.map((x) => x.nazwa), ['Okładka', 'Wstęp', 'Miesiąc']);
  await narzedzie('kolejnosc_stron', { id: [p.strony[0].id, p.strony[2].id, p.strony[1].id] });
  await narzedzie('usun_strony', { id: [p.strony[1].id] });
  assert.deepEqual(s.projekt().projekt.strony.map((x) => x.nazwa), ['Okładka', 'Miesiąc']);

  // Wzorzec: element we wzorcu, przypisanie wzorca do strony.
  await narzedzie('zmien_elementy', { gdzie: 'wzorzec:wz1', zmiany: [{ id: 'nr', pola: { top: 285 } }] });
  await narzedzie('zmien_czesc', { czesc: 'wzorce', id: 'wz2', pola: { nazwa: 'Tło', obiekty: [{ id: 'r', type: 'rect', left: 0, top: 0, width: 10, height: 10 }] } });
  await narzedzie('zmien_strone', { id: 's2', pola: { wzorce: ['wz1', 'wz2'] } });
  p = s.projekt().projekt;
  assert.equal(p.wzorce[0].obiekty[0].top, 285);
  assert.deepEqual(p.strony[1].wzorce, ['wz1', 'wz2']);
  // Niespójność odrzuca baza – AI dostaje opis.
  const zle = await narzedzie('zmien_strone', { id: 's2', pola: { wzorce: ['nie-ma'] } });
  assert.equal(zle.blad, true);
  assert.match(zle.tekst, /„wzorce” to "z_sekcji" albo lista istniejących wzorców/);

  // Styl: zmiana przechodzi do tekstów na stronach i we wzorcach, formatowanie fragmentów ustępuje.
  const st = await narzedzie('zmien_czesc', { czesc: 'style', id: 'st1', pola: { fill: '#003366', fontSize: 5 } });
  assert.match(st.tekst, /Styl przepisany do 2 tekstów/);
  p = s.projekt().projekt;
  const tyt = p.strony[0].obiekty.find((o) => o.id === 'tyt');
  assert.equal(tyt.fill, '#003366');
  assert.equal(tyt.fontSize, 5);
  assert.deepEqual(tyt.styles[0][0], {});
  assert.equal(p.wzorce[0].obiekty[0].fill, '#003366');
  await narzedzie('zmien_czesc', { czesc: 'style', id: 'st1', usun: true });
  p = s.projekt().projekt;
  assert.equal(p.style.length, 0);
  assert.equal(p.strony[0].obiekty.find((o) => o.id === 'tyt').styl, undefined);
  assert.equal(p.strony[0].obiekty.find((o) => o.id === 'tyt').fill, '#003366', 'wygląd zostaje');

  // Tabela: komórka, nowa kolumna, wiersze (także [pomiń]), lista dozwolonych wartości.
  const tb = await narzedzie('zmien_tabele', {
    id: 't1', kolumny: ['miesiac', 'kolor', 'zdjecie'], ustaw: [{ wiersz: 0, kolumna: 'kolor', wartosc: 'czerwony' }],
    dodaj_wiersze: [['Marzec', 'zielony', 'las.jpg'], ['[pomiń]', '', '']], listy: { kolor: ['czerwony', 'zielony'] },
  });
  assert.equal(tb.blad, false, tb.tekst);
  const t1 = s.projekt().projekt.tabele[0];
  assert.deepEqual(t1.wiersze, [['Styczeń', 'czerwony', 'las.jpg'], ['Luty', '', 'morze.jpg'], ['Marzec', 'zielony', 'las.jpg'], ['[pomiń]', '', '']]);
  assert.deepEqual(t1.listy, { kolor: ['czerwony', 'zielony'] });

  // Seria i sekcja.
  await narzedzie('zmien_czesc', { czesc: 'serie', id: 'ser1', pola: { pilnuj_stron: true, dodatkowe: [] } });
  await narzedzie('zmien_czesc', { czesc: 'sekcje', id: 'sek1', pola: { wydruk: { szerokosc_mm: 297, wysokosc_mm: 210, spad_mm: 3 }, uklad: 'rozkladowki' } });
  await narzedzie('zmien_czesc', { czesc: 'sekcje', id: 'sek2', pola: { nazwa: 'Okładka', wydruk: { szerokosc_mm: 300, wysokosc_mm: 300, spad_mm: 5 } } });
  await narzedzie('zmien_strone', { id: 's1', pola: { sekcja: 'sek2' } });
  p = s.projekt().projekt;
  assert.equal(p.serie[0].pilnuj_stron, true);
  assert.equal(p.sekcje[0].uklad, 'rozkladowki');
  assert.equal(p.strony[0].sekcja, 'sek2');
  assert.equal((await narzedzie('zmien_czesc', { czesc: 'serie', id: 'ser1', pola: { tabela: 'nie-ma' } })).blad, true);

  // Kontrola: brak pliku obrazu z danych (morze.jpg) – kolumna kolor już jest w tabeli.
  const k = await narzedzie('kontrola');
  assert.match(k.tekst, /morze\.jpg/);
  assert.doesNotMatch(k.tekst, /\{kolor\}/);
  assert.match((await narzedzie('opis_formatu')).tekst, /Makietka/);
  // Ogólne narzędzie: nazwa i widok w jednym zapisie.
  await narzedzie('zmien_projekt', { zmiany: { nazwa: 'Kalendarz 2027', widok: { siatka: true } } });
  assert.equal(s.projekt().projekt.nazwa, 'Kalendarz 2027');
  assert.match((await narzedzie('zmien_projekt', { zmiany: { zasoby: {} } })).tekst, /Nieznana część projektu „zasoby”/);

  // Klucz tylko do odczytu: czyta, nie zmienia.
  const czyta = s.uruchom(s.odczyt);
  assert.match((await czyta.narzedzie('przeglad_projektu')).tekst, /tylko czytanie/);
  const odm = await czyta.narzedzie('nazwa_projektu', { nazwa: 'X' });
  assert.equal(odm.blad, true);
  assert.match(odm.tekst, /tylko czytać/);
  // Bez klucza – czytelny błąd zamiast awarii.
  const bez = s.uruchom('');
  assert.match((await bez.narzedzie('przeglad_projektu')).tekst, /MAKIETKA_KLUCZ/);
});

// Audyt testów (#160): jedyne narzędzie łącznika bez testu.
test('MCP: kolejnosc_elementow – kolejność warstw na stronie i we wzorcu; lista niepełna albo z obcym id odrzucona bez zmian; klucz tylko do odczytu', async (t) => {
  const s = await srodowisko(t);
  const { narzedzie } = s.uruchom(s.edycja);
  const ids = () => s.projekt().projekt.strony[0].obiekty.map((o) => o.id);
  assert.deepEqual(ids(), ['tlo', 'tyt']);
  const ok = await narzedzie('kolejnosc_elementow', { gdzie: 'strona:s1', id: ['tyt', 'tlo'] });
  assert.ok(!ok.blad, ok.tekst);
  assert.deepEqual(ids(), ['tyt', 'tlo'], 'od spodu do wierzchu');
  // Elementy zostają te same (bez utraty pól), tylko w innej kolejności.
  const tyt = s.projekt().projekt.strony[0].obiekty[0];
  assert.equal(tyt.text, 'Kalendarz {rok}');
  assert.equal(tyt.styles[0][0].fill, '#ff0000');
  for (const zle of [['tyt'], ['tyt', 'tlo', 'tlo'], ['tyt', 'nie-ma']]) {
    const r = await narzedzie('kolejnosc_elementow', { gdzie: 'strona:s1', id: zle });
    assert.equal(r.blad, true, `odrzucone: ${zle}`);
    assert.deepEqual(ids(), ['tyt', 'tlo'], 'po odmowie bez zmian');
  }
  // Wzorzec z jednym elementem – ta sama lista przechodzi; nieznane miejsce – błąd.
  assert.ok(!(await narzedzie('kolejnosc_elementow', { gdzie: 'wzorzec:wz1', id: ['nr'] })).blad);
  assert.equal((await narzedzie('kolejnosc_elementow', { gdzie: 'strona:nie-ma', id: [] })).blad, true);
  // Klucz tylko do odczytu.
  const czyta = s.uruchom(s.odczyt);
  const odm = await czyta.narzedzie('kolejnosc_elementow', { gdzie: 'strona:s1', id: ['tlo', 'tyt'] });
  assert.equal(odm.blad, true);
  assert.deepEqual(ids(), ['tyt', 'tlo']);
});

test('MCP: listy pól i stylów zgodne z aplikacją', async () => {
  const mcp = await import(SERWER);
  const blok = (plik, nazwa) => new RegExp(`export const ${nazwa} = \\[([\\s\\S]*?)\\];`).exec(fs.readFileSync(path.join(__dirname, '..', 'js', plik), 'utf8'))[1];
  const lista = (plik, nazwa) => [...blok(plik, nazwa).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  // POLA_DOKUMENTU w aplikacji to pary [nazwa, opis].
  assert.deepEqual(mcp.POLA_DOKUMENTU, [...blok('pola.js', 'POLA_DOKUMENTU').matchAll(/\[\s*'([^']+)'/g)].map((m) => m[1]));
  assert.deepEqual(mcp.POLA_STYLU, lista('style-tekstu.js', 'POLA_STYLU'));
  assert.deepEqual(mcp.POLA_FRAGMENTU, lista('style-tekstu.js', 'POLA_FRAGMENTU'));
});

test('openapi.json dla ChatGPT: poprawny opis funkcji z migracji dostępnych bez logowania', () => {
  const api = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ai', 'openapi.json'), 'utf8'));
  assert.equal(api.openapi, '3.1.0');
  const sql = ['20261111200000_dostep_ai.sql', '20261112090000_obrazy_ai.sql']
    .map((m) => fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', m), 'utf8')).join('\n');
  // Funkcje dla anon w migracjach = ścieżki w opisie, z tymi samymi parametrami. Zmiany obrazów (nowe nazwy,
  // usuwanie) idą trzema krokami – robi je łącznik, akcje GPT ich nie mają.
  const dlaAnon = [...new Set([...sql.matchAll(/grant execute on function public\.(\w+)\([^)]*\) to anon/g)].map((m) => m[1]))]
    .filter((f) => f !== 'ai_zmien_obrazy').sort();
  const sciezki = Object.keys(api.paths).map((p) => p.replace('/rest/v1/rpc/', '')).sort();
  assert.deepEqual(sciezki, dlaAnon);
  for (const f of dlaAnon) {
    const deklaracja = new RegExp(`function public\\.${f}\\(([^)]*)\\)`).exec(sql)[1];
    const parametry = [...deklaracja.matchAll(/(p_\w+)/g)].map((m) => m[1]);
    const wymagane = [...deklaracja.matchAll(/(p_\w+) \w+(?=\s*(,|$))/g)].map((m) => m[1]); // bez „default”
    const op = api.paths[`/rest/v1/rpc/${f}`].post;
    assert.equal(op.operationId, f);
    const schemat = op.requestBody.content['application/json'].schema;
    assert.deepEqual(Object.keys(schemat.properties), parametry, f);
    assert.deepEqual(schemat.required, wymagane, f);
  }
  // Części zmian = te, które przyjmuje migracja.
  const czesci = /v_klucz not in \(([^)]*)\)/.exec(sql)[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1));
  assert.deepEqual(Object.keys(api.paths['/rest/v1/rpc/ai_zapisz'].post.requestBody.content['application/json'].schema.properties.p_zmiany.properties), czesci);
  assert.equal(api.components.securitySchemes.kluczBazy.name, 'apikey');
  // Odnośniki w opisie wskazują istniejące pliki ai/.
  for (const [, plik] of JSON.stringify(api).matchAll(/makietka\.app\/(ai\/[\w./-]+?\.md)/g)) assert.ok(fs.existsSync(path.join(__dirname, '..', plik)), plik);
});

test('MCP: pola liczone przez aplikację są chronione – AI ich nie nadpisuje ani nie usuwa (#138, #141)', async (t) => {
  const s = await srodowisko(t);
  const p = s.stan.projekty[0];
  Object.assign(p.dane.strony[0].obiekty[0], { z: 3, ramka_pola: { left: 1, top: 2, width: 3, height: 4 } });
  p.dane.strony[0].obiekty.push({ id: 'qr', type: 'group', kod: { rodzaj: 'qr', tresc: 'https://makietka.app', narysowano: 'https://makietka.app' }, left: 10, top: 10, width: 20, height: 20, objects: [] });
  const { narzedzie } = s.uruchom(s.edycja);
  // AI próbuje ustawić albo usunąć pola liczone – zostają z projektu; zwykłe pola zmieniają się normalnie.
  const z = await narzedzie('zmien_elementy', { gdzie: 'strona:s1', zmiany: [
    { id: 'tlo', pola: { fill: '#123456', z: 9, ramka_pola: null } },
    { id: 'qr', pola: { kod: { rodzaj: 'qr', tresc: 'https://example.org', narysowano: 'udaje' } } },
  ] });
  assert.equal(z.blad, false, z.tekst);
  const obiekty = s.projekt().projekt.strony[0].obiekty;
  const o = obiekty.find((x) => x.id === 'tlo');
  assert.equal(o.fill, '#123456');
  assert.equal(o.z, 3, 'z – kolejność na rozkładówce liczy aplikacja');
  assert.deepEqual(o.ramka_pola, { left: 1, top: 2, width: 3, height: 4 });
  const qr = obiekty.find((x) => x.id === 'qr');
  assert.equal(qr.kod.tresc, 'https://example.org');
  assert.equal(qr.kod.narysowano, 'https://makietka.app', 'narysowano zostaje z projektu – aplikacja widzi nową treść i przerysuje kod');
});

test('MCP: komentarze – lista, nowy wątek, odpowiedź z rozwiązaniem, klucz tylko do czytania też komentuje (#131D)', async (t) => {
  const { atrapaWspolpracy } = require('./atrapa-wspolpraca.cjs');
  const s = await srodowisko(t);
  s.stan.konta = [{ id: WLASCICIEL.id, email: 'ola@example.com', nazwa: 'Ola' }];
  s.stan.wspolpraca = atrapaWspolpracy(s.stan);
  // Komentarz osoby z aplikacji (konto właściciela).
  const zAplikacji = s.stan.wspolpraca('dodaj_komentarz', { p_projekt: 'p-1', p_strona: 's1', p_x: 20, p_y: 30, p_tresc: 'Tytuł większy?' }, s.stan.konta[0]);
  const { narzedzie } = s.uruchom(s.edycja);

  const lista = await narzedzie('komentarze');
  assert.equal(lista.blad, false, lista.tekst);
  assert.match(lista.tekst, /#1 \[otwarty\] id [\w-]+ · strona s1, miejsce 20×30 mm · Ola/);
  assert.match(lista.tekst, /Tytuł większy\?/);

  const odp = await narzedzie('odpowiedz', { komentarz: zAplikacji.id, tresc: 'Powiększyłem do 32 pt.', rozwiaz: true });
  assert.equal(odp.blad, false, odp.tekst);
  assert.match((await narzedzie('komentarze')).tekst, /Brak nierozwiązanych/);
  const wszystkie = await narzedzie('komentarze', { wszystkie: true });
  assert.match(wszystkie.tekst, /\[rozwiązany\]/);
  assert.match(wszystkie.tekst, /↳ Claude \(AI\): Powiększyłem do 32 pt\./, 'odpowiedź AI podpisana opisem klucza');

  // Klucz tylko do czytania: komentować wolno (komentarz nie zmienia projektu), zmieniać projektu – nie.
  const czyta = s.uruchom(s.odczyt);
  const nowy = await czyta.narzedzie('skomentuj', { strona: 's2', element: 'mies', tresc: 'Literówka w nazwie miesiąca @Ola' });
  assert.equal(nowy.blad, false, nowy.tekst);
  assert.match(nowy.tekst, /przy elemencie mies/);
  const k = s.stan.komentarze.find((x) => x.element_id === 'mies');
  assert.equal(k.zrodlo, 'ai');
  assert.deepEqual(k.wzmianki, [WLASCICIEL.id], '@nazwa wspomina osobę z projektu');
  assert.equal(s.projekt().wersja, 1, 'komentarze nie zmieniają wersji projektu');
  assert.equal((await czyta.narzedzie('skomentuj', { strona: 's1', tresc: ' ' })).blad, true);
  assert.equal((await czyta.narzedzie('rozwiaz_komentarz', { komentarz: k.id })).blad, false);
  assert.equal(k.rozwiazany, true);
  assert.equal((await czyta.narzedzie('rozwiaz_komentarz', { komentarz: k.id, rozwiazany: false })).blad, false);
  assert.equal(k.rozwiazany, false);
});
