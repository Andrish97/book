const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const KORZEN = path.join(__dirname, '..');
const slownik = (j) => { const t = fs.readFileSync(path.join(KORZEN, 'js', 'jezyki', 'klucze', `${j}.js`), 'utf8'); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); };

// #346: napisy kodu mają klucze (t('obszar.nazwa')) – każdy użyty klucz ma napis po polsku, angielsku i ukraińsku.
test('klucze w kodzie: każdy t(…) ma tłumaczenie w pl, en i uk', () => {
  const sl = { pl: slownik('pl'), en: slownik('en'), uk: slownik('uk') };
  const pliki = [];
  const zbierz = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (!/zewnetrzne|jezyki/.test(p)) zbierz(p); } else if (f.endsWith('.js')) pliki.push(p); } };
  zbierz(path.join(KORZEN, 'js'));
  const braki = [];
  let uzyte = 0;
  for (const p of pliki) {
    const kod = fs.readFileSync(p, 'utf8');
    const m = /import \{[^}]*\bt(?: as (\w+))?\b[^}]*\} from '[./]*jezyk\.js'/.exec(kod);
    if (!m) continue;
    const fn = m[1] || 't';
    for (const [, k] of kod.matchAll(new RegExp(`\\b${fn}\\('([A-Za-z0-9]+\\.[A-Za-z0-9]+)'`, 'g'))) {
      uzyte += 1;
      for (const j of ['pl', 'en', 'uk']) if (!sl[j][k]) braki.push(`${path.relative(KORZEN, p)}: ${k} (${j})`);
    }
  }
  assert.ok(uzyte > 1000, `kluczy w kodzie: ${uzyte}`);
  assert.deepEqual(braki, []);
});

test('klucze w kodzie: etykieta panelu z t() zmienia język bez przeładowania', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => localStorage.setItem('makietka-jezyk', 'en'));
  await strona.reload();
  await strona.waitForFunction(() => document.documentElement.lang === 'en');
  await nowyProjekt(strona, 'Keys');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  const etykieta = (tekst) => strona.waitForSelector(`#wlasciwosci label:has-text("${tekst}")`, { timeout: 5000 });
  await etykieta('Lock position and size');
  const przelacz = async (j) => {
    await strona.evaluate((x) => import('./js/jezyk.js').then((m) => m.ustawJezyk(x)), j);
    await strona.waitForFunction((x) => document.documentElement.lang === x, j);
  };
  await przelacz('uk');
  await etykieta('Заблокувати розташування і розмір');
  await przelacz('pl');
  await etykieta('Zablokuj położenie i rozmiar');
  // Po polsku nowe okno też po polsku (t() zwraca napis polskiego słownika).
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.discardActiveObject(); e.canvas.setActiveObject(e.canvas.getObjects()[0]); e._emitujZaznaczenie(); });
  await etykieta('Zablokuj położenie i rozmiar');
  assert.deepEqual(bledy, []);
});
