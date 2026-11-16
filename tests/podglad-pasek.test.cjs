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

// #189: średni ekran (900 px) – nazwa w jednej linii, nie w trzech; nagłówek sekcji szerokiej okładki
// przewiniętej w bok zostaje w oknie (nie ucina się z lewej).
test('średni ekran: nazwa w jednej linii, nagłówek sekcji widoczny przy przewinięciu w bok', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 900, height: 700 } });
  await nowyProjekt(strona, 'Dziennik biblijny 2027 – blok');
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForSelector('.podglad-strona[data-id]');
  await strona.evaluate(() => { const t = document.querySelector('.podglad-tresc'); t.style.setProperty('--skala', '6'); });
  await strona.waitForTimeout(200);
  const w = await strona.evaluate(async () => {
    const t = document.querySelector('.podglad-tresc');
    t.scrollTo(t.scrollWidth, 0);
    await new Promise((ok) => { requestAnimationFrame(() => requestAnimationFrame(ok)); });
    const h = document.querySelector('#podglad-tytul');
    const lh = parseFloat(getComputedStyle(h).lineHeight) || 20;
    const n = document.querySelector('.podglad-sekcja h2').getBoundingClientRect();
    const o = t.getBoundingClientRect();
    return { przewiniete: t.scrollLeft > 0, jednaLinia: h.getBoundingClientRect().height < lh * 1.5, dymek: h.title, wOknie: n.left >= o.left && n.right <= o.right + 1 };
  });
  assert.deepEqual(w, { przewiniete: true, jednaLinia: true, dymek: 'Dziennik biblijny 2027 – blok', wOknie: true });
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
