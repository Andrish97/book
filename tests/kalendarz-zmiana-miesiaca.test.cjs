// Kalendarz miesiąca ze zmienionym miesiącem (23.11, test łącznika na koncie testowym): kopia strony ze styczniem,
// miesiąc zmieniony na luty – ulozKalendarz usuwał nadmiarowe wiersze w pętli na starym opisie tabeli (pierwsze
// ulozTabele podmieniało g.tabela na kopię) i zawieszał rysowanie (PDF na serwerze: „Runtime.callFunctionOn timed
// out”, etap „plik PDF, strony 1 z 2”). Cała droga: łącznik (rdzeń na atrapie bazy) → projekt → rysuj.html → PDF.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { atrapaAi } = require('./atrapa-ai.cjs');
const { otworz } = require('./pomoc.cjs');

test('kalendarz: kopia strony i zmiana miesiąca ze stycznia na luty – PDF rysuje się (bez zawieszenia)', async (t) => {
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
  const rdzen = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs')).href);
  const klucz = baza('utworz_dostep_ai', { p_opis: 'AI', p_rola: 'edycja', p_dni: 7, p_zakres: 'pelny', p_projekty: [] }, JA).klucz;
  const s = rdzen.utworzSerwer({ adres: `http://127.0.0.1:${srv.address().port}`, kluczPubliczny: 'x', klucz });
  const w = async (name, a) => (await s.obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: a } })).result.content[0].text;
  const np = await w('nowy_projekt', { nazwa: 'Calendar', format: 'A4' });
  const pid = /id ([0-9a-f-]{36})/.exec(np)[1];
  const sid = /strona (s_\w+)/.exec(np)[1];
  await w('dodaj_elementy', { projekt: pid, gdzie: `strona:${sid}`, elementy: [{ type: 'kalendarz', left: 12, top: 168, width: 186, kalendarz: { rok: 2027, miesiac: 1 } }] });
  const sid2 = /: (s_\w+)/.exec(await w('kopiuj_strone', { projekt: pid, id: sid }))[1];
  const kal = stan.strony.get(`${pid}/${sid2}`).obiekty.find((o) => o.kalendarz);
  assert.match(await w('zmien_elementy', { projekt: pid, gdzie: `strona:${sid2}`, zmiany: [{ id: kal.id, pola: { kalendarz: { rok: 2027, miesiac: 2 } } }] }), /Zmieniono 1 el/);
  const p = stan.projekty.find((x) => x.id === pid);
  const dane = JSON.parse(JSON.stringify(p.dane));
  dane.strony = dane.strony.map((id) => stan.strony.get(`${pid}/${id}`));
  delete dane.strony_osobno;

  const { kontekst, strona, adres } = await otworz(t, { tryb: 'bez-bazy' });
  const rys = await kontekst.newPage();
  for (const n of ['__mkCzytajOpis', '__mkWyslij', '__mkLista', '__mkUsun', '__mkPobierz', '__mkPostep', '__mkEtap']) await rys.exposeFunction(n, () => null);
  await rys.goto(new URL('rysuj.html', adres || strona.url()).href);
  await rys.waitForFunction(() => window.makietkaRysujGotowe === true);
  const wynik = await Promise.race([
    rys.evaluate((a) => window.makietkaRysuj.eksportuj(a).then((x) => ({ strony: x.strony, typ: x.typ })), { projekt: dane, rodzaj: 'pdf', ustawienia: { przeznaczenie: 'ekran' } }),
    new Promise((r) => { setTimeout(() => r('zawieszone (ponad 20 s)'), 20000); }),
  ]);
  assert.deepEqual(wynik, { strony: 2, typ: 'application/pdf' });
});
