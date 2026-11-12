// Serwer MCP (ai/mcp/seriodruk-mcp.mjs) jako osobny proces, połączony z lokalnym serwerem HTTP, który
// udaje funkcje bazy (tests/atrapa-ai.cjs – te same zasady co migracja). Bez przeglądarki.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { atrapaAi } = require('./atrapa-ai.cjs');

const SERWER = path.join(__dirname, '..', 'ai', 'mcp', 'seriodruk-mcp.mjs');
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
  const edycja = baza('utworz_dostep_ai', { p_projekt: 'p-1', p_opis: 'Claude', p_rola: 'edycja', p_dni: 7 }, WLASCICIEL).klucz;
  const odczyt = baza('utworz_dostep_ai', { p_projekt: 'p-1', p_opis: 'Czyta', p_rola: 'odczyt', p_dni: 1 }, WLASCICIEL).klucz;
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
      env: { ...process.env, SERIODRUK_KLUCZ: klucz, SERIODRUK_ADRES: `http://127.0.0.1:${http1.address().port}`, SERIODRUK_KLUCZ_PUBLICZNY: 'sb_publishable_test' },
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
  assert.equal(init.result.serverInfo.name, 'seriodruk');
  assert.equal(init.result.serverInfo.title, 'Seriodruk');
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
  assert.equal(odkrycie.result._meta['io.modelcontextprotocol/serverInfo'].name, 'seriodruk');
  assert.equal((await nowy.wyslij('tools/list', nowy.meta)).result.resultType, 'complete');
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
  assert.match(przeglad.tekst, /Projekt „Kalendarz” – wersja 1/);
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
  await narzedzie('usun_elementy', { gdzie: 'strona:s1', id: [nowy.id] });
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
  assert.match((await narzedzie('opis_formatu')).tekst, /Seriodruk/);
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
  assert.match((await bez.narzedzie('przeglad_projektu')).tekst, /SERIODRUK_KLUCZ/);
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
  for (const [, plik] of JSON.stringify(api).matchAll(/andrish97\.github\.io\/book\/(ai\/[\w./-]+?\.md)/g)) assert.ok(fs.existsSync(path.join(__dirname, '..', plik)), plik);
});
