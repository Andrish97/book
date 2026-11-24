// Podgląd z linku na telefonie (#296): przyciski w pasku gościa (prezentacja, makieta) wysokie na palec – reguła
// „dzieci paska bez minimalnej wysokości” (zawijanie nazwy projektu) zmniejszała je do 22 px.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('telefon: przyciski w pasku podglądu z linku mają co najmniej 40 px', async (t) => {
  const { strona, kontekst, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Gość');
  await strona.waitForTimeout(800);
  await strona.evaluate(() => { location.hash = `#/p/${window.seriodruk.stan.projekt.id}/podglad`; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.evaluate(() => [...document.querySelectorAll('[data-akcja="udostepnij"]')].find((b) => b.offsetParent)?.click());
  await strona.waitForSelector('#dlg-udostepnij[open]');
  await strona.click('#udostepnij-utworz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces'), null, { timeout: 60000 });
  const link = await strona.evaluate(() => { const p = window.seriodruk.stan.projekt; return `${location.origin}${location.pathname}#/u/${p.udostepnienia[0].konto}/${p.id}/${p.udostepnienia[0].kod}`; });
  const g = await kontekst.newPage();
  await g.goto(link);
  await g.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id]').length > 0, null, { timeout: 30000 });
  const wysokosci = await g.evaluate(() => [...document.querySelectorAll('.pasek-podgladu :is(.przycisk, .przycisk-ikona)')].filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().height)));
  assert.ok(wysokosci.length >= 2, `przyciski w pasku: ${wysokosci}`);
  assert.ok(wysokosci.every((h) => h >= 40), `wysokości: ${wysokosci}`);
  assert.deepEqual(bledy, []);
});
