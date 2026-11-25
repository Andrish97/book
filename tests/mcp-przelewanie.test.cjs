// #436: zmiana z łącznika MCP w ramce wątku – tekst przelewa się przez ramki od razu, przed zapisem, w tej samej
// wersji; odpowiedź narzędzia ma raport wątku. Cała droga: rdzeń łącznika na atrapie bazy → usługa składu
// (rysuj.html w przeglądarce – jak przeglądarka serwera) → zapis.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { atrapaAi } = require('./atrapa-ai.cjs');
const { otworz } = require('./pomoc.cjs');

async function lacznik(t) {
  const JA = { id: 'u-1', email: 'ja@example.com' };
  const stan = { konta: [JA], projekty: [], strony: new Map(), wspolpracownicy: [] };
  const baza = atrapaAi(stan);
  const zapisy = [];
  const srv = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      const nazwa = req.url.replace('/rest/v1/rpc/', '');
      try {
        const cialo = JSON.parse(b || '{}');
        if (nazwa === 'ai_zapisz') zapisy.push(cialo);
        res.end(JSON.stringify(baza(nazwa, cialo) ?? null));
      } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ message: e.message })); }
    });
  });
  await new Promise((r) => { srv.listen(0, '127.0.0.1', r); });
  t.after(() => srv.close());
  // Przeglądarka składu: strona rysuj.html (ten sam kod co na serwerze).
  const { kontekst, strona, adres } = await otworz(t, { tryb: 'bez-bazy' });
  const rys = await kontekst.newPage();
  for (const n of ['__mkCzytajOpis', '__mkWyslij', '__mkLista', '__mkUsun', '__mkPobierz', '__mkPostep', '__mkEtap']) await rys.exposeFunction(n, () => null);
  await rys.goto(new URL('rysuj.html', adres || strona.url()).href);
  await rys.waitForFunction(() => window.makietkaRysujGotowe === true);
  const uzycia = [];
  const skladanie = async (a) => { uzycia.push(a.dzialania); return rys.evaluate((x) => window.makietkaRysuj.skladaj(x), a); };
  const rdzen = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs')).href);
  const klucz = baza('utworz_dostep_ai', { p_opis: 'AI', p_rola: 'edycja', p_dni: 7, p_zakres: 'pelny', p_projekty: [] }, JA).klucz;
  const s = rdzen.utworzSerwer({ adres: `http://127.0.0.1:${srv.address().port}`, kluczPubliczny: 'x', klucz, skladanie });
  const w = async (name, a) => (await s.obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: a } })).result.content[0].text;
  return { w, stan, zapisy, uzycia };
}

const OPIS = 'Dobra nowina o zbawieniu przez Jezusa Chrystusa; także nazwa czterech ksiąg o Jego życiu i nauczaniu.';

test('łącznik: zmiana tekstu ramki wątku przelewa wątek przed zapisem i zwraca raport', async (t) => {
  const { w, stan, zapisy, uzycia } = await lacznik(t);
  const np = await w('nowy_projekt', { nazwa: 'Słowniczek', format: 'A5' });
  const pid = /id ([0-9a-f-]{36})/.exec(np)[1];
  const s1 = /strona (s_\w+)/.exec(np)[1];
  const ds = await w('dodaj_strone', { projekt: pid, strona: { nazwa: 'Strona 2' } });
  const s2 = (/(s_\w+)/.exec(ds) || [])[1];
  assert.ok(s2, ds);
  const ramka = (id, nr, text) => ({ type: 'textbox', id, left: 15, top: 20, width: 100, height: 60, ramka_h: 60, fontSize: 3.5, fontFamily: 'Inter', text, watek: 'w_slow', watek_nr: nr, ...(nr ? { lacznik: '\n' } : {}), wdowy: 3, lamanie_akapitu: true });
  await w('dodaj_elementy', { projekt: pid, gdzie: `strona:${s1}`, elementy: [ramka('r1', 0, 'Krótki')] });
  await w('dodaj_elementy', { projekt: pid, gdzie: `strona:${s2}`, elementy: [ramka('r2', 1, '')] });
  // Długi tekst wpisany do pierwszej ramki – część musi przejść do drugiej.
  const tekst = Array.from({ length: 14 }, (_, i) => `Hasło${i} Dz 1:${i}\n${OPIS}`).join('\n');
  const zapisowPrzed = zapisy.length;
  const odp = await w('zmien_elementy', { projekt: pid, gdzie: `strona:${s1}`, zmiany: [{ id: 'r1', pola: { text: tekst } }] });
  assert.match(odp, /Tekst w połączonych ramkach przelany na nowo:\nWątek w_slow: 2 ramek\./, odp);
  assert.match(odp, /1\. .*„Hasło0 Dz 1:0 Dobra/);
  assert.equal(zapisy.length - zapisowPrzed, 1, 'jeden zapis (ta sama wersja)');
  assert.ok(uzycia.at(-1).some((d) => d.rodzaj === 'przelej' && d.watki.includes('w_slow')));
  const r1 = stan.strony.get(`${pid}/${s1}`).obiekty.find((o) => o.id === 'r1');
  const r2 = stan.strony.get(`${pid}/${s2}`).obiekty.find((o) => o.id === 'r2');
  assert.ok(r1.text.length < tekst.length && r2.text.length > 0, 'część tekstu w drugiej ramce');
  assert.equal(`${r1.text}${r2.lacznik ?? '\n'}${r2.text}`, tekst, 'cała treść, nic nie zginęło');
  // Za długi tekst – raport mówi, co się nie mieści.
  const odp2 = await w('zmien_elementy', { projekt: pid, gdzie: `strona:${s1}`, zmiany: [{ id: 'r1', pola: { text: `${tekst}\n${tekst}` } }] });
  assert.match(odp2, /NIE MIEŚCI SIĘ: \d+ wierszy poza ostatnią ramką/, odp2);
  // Zmiana zwykłego elementu bez tekstu – bez usługi składu.
  const ile = uzycia.length;
  await w('dodaj_elementy', { projekt: pid, gdzie: `strona:${s1}`, elementy: [{ type: 'rect', id: 'p1', left: 1, top: 1, width: 5, height: 5, fill: '#000000' }] });
  await w('zmien_elementy', { projekt: pid, gdzie: `strona:${s1}`, zmiany: [{ id: 'p1', pola: { left: 3 } }] });
  assert.equal(uzycia.length, ile, 'prostokąt nie uruchamia przeglądarki');
});
