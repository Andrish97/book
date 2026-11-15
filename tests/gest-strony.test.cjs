// Szybkie przesunięcie palcem w poziomie przy zwykłym przybliżeniu na telefonie zmienia stronę (#146);
// przesunięcie elementu i przewijanie przy powiększeniu – nie.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('telefon: szybki gest w poziomie po pustym miejscu – następna/poprzednia strona; element się przesuwa, strona zostaje', async (t) => {
  const { strona, kontekst, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Gest');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    for (let i = 2; i <= 3; i += 1) p.strony.push(P.nowaStrona(`Strona ${i}`, p.sekcje[0].id));
  });
  const cdp = await kontekst.newCDPSession(strona);
  const dotyk = (type, pkt) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pkt.map((q, i) => ({ x: q[0], y: q[1], id: i })) });
  const przesun = async (x0, y, dx, kroki = 2) => {
    await dotyk('touchStart', [[x0, y]]);
    for (let i = 1; i <= kroki; i += 1) await dotyk('touchMove', [[x0 + (dx * i) / kroki, y]]);
    await dotyk('touchEnd', []);
    await strona.waitForTimeout(400);
  };
  const indeks = () => strona.evaluate(() => window.seriodruk.stan.indeks);
  // Puste miejsce: lewy górny róg obszaru strony (na stronie nie ma elementów).
  const r = await strona.evaluate(() => { const b = window.seriodruk.edytor.canvas.upperCanvasEl.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.7 }; });
  assert.equal(await indeks(), 0);
  await przesun(r.x + 100, r.y, -160);
  assert.equal(await indeks(), 1, 'w lewo – następna strona');
  await przesun(r.x + 100, r.y, -160);
  assert.equal(await indeks(), 2);
  await przesun(r.x + 100, r.y, -160);
  assert.equal(await indeks(), 2, 'na ostatniej stronie nic się nie dzieje');
  await przesun(r.x - 100, r.y, 160);
  assert.equal(await indeks(), 1, 'w prawo – poprzednia strona');
  // Wolne przeciągnięcie (zaznaczanie ramką) nie zmienia strony.
  await dotyk('touchStart', [[r.x + 100, r.y]]);
  for (let i = 1; i <= 10; i += 1) { await dotyk('touchMove', [[r.x + 100 - i * 16, r.y]]); await strona.waitForTimeout(60); }
  await dotyk('touchEnd', []);
  await strona.waitForTimeout(300);
  assert.equal(await indeks(), 1, 'powolne przeciągnięcie to nie gest');
  assert.deepEqual(bledy, []);
});
