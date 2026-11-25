// #436: tekst z łącznika MCP jak pisany w edytorze – style fragmentów przesuwają się przy zmianie tekstu, styl po
// fragmencie tekstu (bez liczenia pozycji), poprawne znaki według polskich zasad (ta sama reguła co w aplikacji).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { atrapaAi } = require('./atrapa-ai.cjs');

const rdzen = () => import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs')).href);

test('style przesuwają się razem z tekstem; styl po fragmencie', async () => {
  const { przesunStyle, styleFragmentow } = await rdzen();
  const B = { fontWeight: 'bold' };
  // „Ala” pogrubione, „kota” kursywą; wstawienie w środku.
  const st = [{ start: 0, end: 3, style: B }, { start: 7, end: 11, style: { fontStyle: 'italic' } }];
  assert.deepEqual(przesunStyle('Ala ma kota', 'Ala ma dwa kota', st), [{ start: 0, end: 3, style: B }, { start: 11, end: 15, style: { fontStyle: 'italic' } }]);
  // Nowe linie nie liczą się w indeksach (jak w Fabric).
  assert.deepEqual(przesunStyle('Ala\nkot', 'Nowy wstęp\nAla\nkot', [{ start: 0, end: 3, style: B }]), [{ start: 10, end: 13, style: B }]);
  // Dopisany znak wewnątrz pogrubienia dostaje pogrubienie (jak przy pisaniu).
  assert.deepEqual(przesunStyle('Ala ma', 'Alla ma', [{ start: 0, end: 3, style: B }]), [{ start: 0, end: 4, style: B }]);
  // Fragmenty: wszystkie wystąpienia, albo wskazane; nieznaleziony zgłoszony.
  const f = styleFragmentow('Abba Mk 1:1\nAbba to ojciec', [], [{ fragment: 'Abba', styl: { fontWeight: 600 } }, { fragment: 'Mk 1:1', wystapienie: 1, styl: { fill: '#888888' } }, { fragment: 'Nie ma', styl: B }]);
  assert.deepEqual(f.styles, [{ start: 0, end: 4, style: { fontWeight: 600 } }, { start: 5, end: 11, style: { fill: '#888888' } }, { start: 11, end: 15, style: { fontWeight: 600 } }]);
  assert.deepEqual(f.nieZnalezione, ['Nie ma']);
});

test('poprawki znaków w łączniku = poprawki w aplikacji (zasady-skladu.js)', async () => {
  const { poprawkiZnakowTekstu } = await rdzen();
  const { poprawkiZnakow } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'zasady-skladu.js')).href);
  for (const t of ['Powiedział "tak" - i poszedł...', 'Tekst  z  podwójnymi spacjami , i ( nawiasem )', '„Już dobrze” – {pole "x"} ...', 'Liczba 3 .5 i koniec .', '']) {
    assert.deepEqual(poprawkiZnakowTekstu(t), poprawkiZnakow(t), t);
  }
});

test('zmien_elementy i dodaj_elementy: style przesunięte, znaki poprawione, style_fragmentow, znaki_bez_zmian', async (t) => {
  const JA = { id: 'u-1', email: 'ja@example.com' };
  const stan = { konta: [JA], projekty: [], strony: new Map(), wspolpracownicy: [] };
  const baza = atrapaAi(stan);
  const srv = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      try { res.end(JSON.stringify(baza(req.url.replace('/rest/v1/rpc/', ''), JSON.parse(b || '{}')) ?? null)); } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ message: e.message })); }
    });
  });
  await new Promise((r) => { srv.listen(0, '127.0.0.1', r); });
  t.after(() => srv.close());
  const r = await rdzen();
  const klucz = baza('utworz_dostep_ai', { p_opis: 'AI', p_rola: 'edycja', p_dni: 7, p_zakres: 'pelny', p_projekty: [] }, JA).klucz;
  const s = r.utworzSerwer({ adres: `http://127.0.0.1:${srv.address().port}`, kluczPubliczny: 'x', klucz });
  const w = async (name, a) => (await s.obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: a } })).result.content[0].text;
  const np = await w('nowy_projekt', { nazwa: 'Style', format: 'A5' });
  const pid = /id ([0-9a-f-]{36})/.exec(np)[1];
  const sid = /strona (s_\w+)/.exec(np)[1];
  await w('dodaj_elementy', { projekt: pid, gdzie: `strona:${sid}`, elementy: [
    { type: 'textbox', id: 't1', text: 'Abba Mk 14:36 - "Ojcze"...', style_fragmentow: [{ fragment: 'Abba', styl: { fontWeight: 600 } }] },
    { type: 'textbox', id: 't2', text: 'Zostaw "proste"', znaki_bez_zmian: true },
  ] });
  const el = (id) => stan.strony.get(`${pid}/${sid}`).obiekty.find((o) => o.id === id);
  assert.equal(el('t1').text, 'Abba Mk 14:36 – „Ojcze”…', 'znaki jak po pisaniu w edytorze');
  assert.deepEqual(el('t1').styles, [{ start: 0, end: 4, style: { fontWeight: 600 } }]);
  assert.equal(el('t2').text, 'Zostaw "proste"', 'znaki_bez_zmian – bez poprawek');
  assert.equal(el('t1').style_fragmentow, undefined, 'pole pomocnicze nie trafia do projektu');
  // Zmiana tekstu: pogrubienie „Abba” zostaje na swoim miejscu, choć tekst przed nim się zmienił.
  await w('zmien_elementy', { projekt: pid, gdzie: `strona:${sid}`, zmiany: [{ id: 't1', pola: { text: 'Hasło: Abba Mk 14:36 – „Ojcze”…', style_fragmentow: [{ fragment: 'Mk 14:36', styl: { fill: '#888888' } }] } }] });
  assert.deepEqual(el('t1').styles, [{ start: 7, end: 11, style: { fontWeight: 600 } }, { start: 12, end: 20, style: { fill: '#888888' } }]);
  assert.match(await w('zmien_elementy', { projekt: pid, gdzie: `strona:${sid}`, zmiany: [{ id: 't1', pola: { style_fragmentow: [{ fragment: 'brak', styl: { fill: '#ff0000' } }] } }] }), /nie ma: „brak”/);
});
