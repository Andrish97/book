// Podgląd (#154): na wąskim ekranie nazwa projektu w drugiej linii paska (cała, nie „Dz…”); w podglądzie
// separacji płótno ma proporcje strony (nie jest szersze od niej).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('telefon: nazwa projektu w podglądzie w drugiej linii, w całości', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Dziennik biblijny 2027 – blok');
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForSelector('.podglad-strona[data-id]');
  const w = await strona.evaluate(() => {
    const h = document.querySelector('#podglad-tytul');
    const r = h.getBoundingClientRect();
    const p = h.closest('header').getBoundingClientRect();
    const b = document.querySelector('.pasek-podgladu [data-akcja="podglad-prezentacja"]').getBoundingClientRect();
    return { pelny: h.scrollWidth <= h.clientWidth, wPasku: r.bottom <= p.bottom + 0.5, podPrzyciskami: r.top >= b.bottom - 1 };
  });
  assert.deepEqual(w, { pelny: true, wPasku: true, podPrzyciskami: true });
  assert.deepEqual(bledy, []);
});

test('podgląd separacji: płótno w proporcjach strony', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Separacje');
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForSelector('.podglad-strona[data-id]');
  await strona.click('[data-akcja="podglad-separacje"]');
  await strona.waitForFunction(() => document.querySelector('#separacje-plotno')?.width > 0);
  await strona.waitForTimeout(300);
  const p = await strona.evaluate(() => { const c = document.querySelector('#separacje-plotno'); const r = c.getBoundingClientRect(); return { box: r.width / r.height, obraz: c.width / c.height }; });
  assert.ok(Math.abs(p.box - p.obraz) < 0.02, JSON.stringify(p));
  assert.deepEqual(bledy, []);
});
