// Biblioteka dla AI (plan H7): katalog w łączniku = Biblioteka aplikacji; szukanie bez otwartej aplikacji;
// wstaw_z_biblioteki – otwarta Makietka wstawia element na wskazanej stronie, w podanym miejscu.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');
const { katalogZAplikacji, doKodu, START, KONIEC } = require('./katalog-biblioteki.cjs');

const RDZEN = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs');
const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
async function poczekaj(fn, ms = 40000) {
  const koniec = Date.now() + ms;
  for (;;) { const w = fn(); if (w) return w; if (Date.now() > koniec) throw new Error('Za długo'); await new Promise((r) => { setTimeout(r, 200); }); }
}

test('biblioteka AI: katalog w łączniku aktualny, szukanie, wstawienie w otwartej Makietce', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Biblioteka AI');
  const katalog = await katalogZAplikacji(strona);
  const s = fs.readFileSync(RDZEN, 'utf8');
  assert.equal(s.slice(s.indexOf(START), s.indexOf(KONIEC) + KONIEC.length), doKodu(katalog),
    'katalog Biblioteki w łączniku jest nieaktualny – uruchom node scripts/katalog-biblioteki.cjs && node scripts/mcp-buduj.cjs');
  assert.ok(!katalog.some(([id]) => ['moje', 'marka', 'gotowe-sekcje', 'style'].includes(id)));

  // Szukanie w łączniku – bez aplikacji i bez projektu.
  const rdzen = await import(pathToFileURL(RDZEN).href);
  const srv = rdzen.utworzSerwer({ adres: 'http://127.0.0.1:9', kluczPubliczny: 'x', klucz: 'sdk_x' });
  const wolaj = async (name, args = {}) => (await srv.obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })).result;
  let w = await wolaj('biblioteka');
  assert.match(w.content[0].text, /- ramki – Ramki \(\d+\)/);
  w = await wolaj('biblioteka', { szukaj: 'ramka zaokraglona' });
  assert.match(w.content[0].text, /ramki \/ \S+ – Ramka zaokrąglona/);
  w = await wolaj('biblioteka', { kategoria: 'nie-ma' });
  assert.equal(w.isError, true);

  // Wstawienie: zadanie dla otwartej Makietki.
  await zapisano(strona);
  const [pid, sid] = await strona.evaluate(() => [window.seriodruk.stan.projekt.id, window.seriodruk.stan.projekt.strony[0].id]);
  await poczekaj(() => baza.projekty.some((p) => p.id === pid));
  const { klucz } = baza.ai('utworz_dostep_ai', { p_projekty: [pid], p_opis: 'Claude', p_rola: 'edycja', p_dni: 1 }, baza.konta[0]);
  const id = (await strona.evaluate(async () => (await import('./js/biblioteka.js')).szukajWBibliotece('ramka zaokraglona', 'ramki')[0].element.id));
  const z = baza.ai('ai_zlec_zadanie', { p_klucz: klucz, p_rodzaj: 'biblioteka', p_ustawienia: { kategoria: 'ramki', element: id, gdzie: `strona:${sid}`, x: 50, y: 60 } });
  const gotowy = await poczekaj(() => { const st = baza.ai('ai_stan_eksportu', { p_klucz: klucz, p_id: z.id }); return ['gotowe', 'blad'].includes(st.stan) ? st : null; });
  assert.equal(gotowy.stan, 'gotowe', gotowy.blad);
  assert.match(gotowy.wynik.opis, /^Wstawiono „Ramka zaokrąglona” na stronie .+: element (\S+), x [\d.]+ mm/);
  const idEl = /element (\S+),/.exec(gotowy.wynik.opis)[1];
  const srodek = await strona.evaluate((i) => {
    const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.id === i); const r = o.getBoundingRect();
    return [r.left - e.strony[e.aktywna].x + r.width / 2, r.top + r.height / 2];
  }, idEl);
  assert.ok(Math.abs(srodek[0] - 50) < 1.5 && Math.abs(srodek[1] - 60) < 1.5, `środek ${srodek}`);
  await poczekaj(() => JSON.stringify(baza.ai('ai_projekt', { p_klucz: klucz }).projekt.strony[0].obiekty).includes(idEl));
  assert.deepEqual(bledy, []);
});
