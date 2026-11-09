const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const ramki = (strona) => strona.evaluate(() => {
  const e = window.seriodruk.edytor;
  e.canvas.discardActiveObject();
  return e.canvas.getObjects().map((o) => { o.setCoords(); const r = o.getBoundingRect(true, true); return [Math.round(r.left * 10) / 10, Math.round(r.top * 10) / 10]; });
});

async function trzyProstokaty(strona) {
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    [[20, 30], [50, 80], [110, 150]].forEach(([x, y]) => { const r = e.dodajProstokat(); r.set({ left: x, top: y, width: 20, height: 10, strokeWidth: 0 }); r.setCoords(); });
    e.zatwierdz();
    e.canvas.discardActiveObject();
    const sel = new fabric.ActiveSelection(e.canvas.getObjects(), { canvas: e.canvas });
    e.canvas.setActiveObject(sel);
    e.canvas.requestRenderAll();
    e._emitujZaznaczenie();
  });
}

test('wyrównywanie do siebie, równe odstępy i wyrównanie pojedynczego elementu do marginesów', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wyrównanie');
  await trzyProstokaty(strona);
  await strona.click('#wlasciwosci button[aria-label="Do góry"]');
  assert.deepEqual((await ramki(strona)).map((r) => r[1]), [30, 30, 30]);

  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    e.canvas.setActiveObject(new fabric.ActiveSelection(e.canvas.getObjects(), { canvas: e.canvas }));
    e._emitujZaznaczenie();
  });
  await strona.click('#wlasciwosci button[aria-label="Rozłóż równo w poziomie"]');
  assert.deepEqual((await ramki(strona)).map((r) => r[0]), [20, 65, 110]);

  // Jeden element: do prawego marginesu (148 − 10 − 20).
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.setActiveObject(e.canvas.getObjects()[0]); e._emitujZaznaczenie(); });
  await strona.click('#wlasciwosci button[aria-label="Do prawej"]');
  assert.equal((await ramki(strona))[0][0], 118);
  assert.deepEqual(bledy, []);
});

test('blokada: zablokowanego elementu nie da się przesunąć ani wyrównać, po wczytaniu nadal jest zablokowany', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Blokada');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.click('#wlasciwosci label:has-text("Zablokuj położenie") input');
  const przed = (await ramki(strona))[0];
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.setActiveObject(e.canvas.getObjects()[0]); e.przesun(10, 10); e.wyrownaj('lewo'); });
  assert.deepEqual((await ramki(strona))[0], przed);
  await strona.waitForTimeout(350);
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(0));
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0 && window.seriodruk.edytor.canvas.getObjects().length === 1);
  assert.deepEqual(await strona.evaluate(() => { const o = window.seriodruk.edytor.canvas.getObjects()[0]; return [o.zablokowany, o.lockMovementX, o.hasControls]; }), [true, true, false]);
  assert.deepEqual(bledy, []);
});

test('schowek: kopiowanie i wklejanie na innej stronie w tym samym miejscu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Schowek');
  await strona.click('[data-akcja="dodaj-tekst"]');
  const zrodlo = (await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; return [o.left, o.top, o.text]; }));
  await strona.keyboard.press('Control+c');
  await strona.waitForFunction(() => window.seriodruk.edytor.maSchowek);
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  // Przycisk we właściwościach strony (dla ekranów dotykowych).
  await strona.click('#wlasciwosci button:has-text("Wklej skopiowane elementy")');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 1);
  assert.deepEqual(await strona.evaluate(() => { const o = window.seriodruk.edytor.canvas.getObjects()[0]; return [o.left, o.top, o.text]; }), zrodlo);
  // Drugie wklejenie na tej samej stronie jest przesunięte.
  await strona.evaluate(() => window.seriodruk.edytor.canvas.discardActiveObject());
  await strona.keyboard.press('Control+v');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 2);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects()[1].left), zrodlo[0] + 5);
  assert.deepEqual(bledy, []);
});

test('duplikowanie projektu tworzy niezależną kopię', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz 2027');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.waitForTimeout(1000);
  await strona.click('[data-akcja="do-projektow"]:visible');
  await strona.waitForSelector('.karta-projektu:not(.szkielet)');
  await strona.click('.karta-projektu .menu-karty');
  await strona.click('.karta-projektu [data-op="duplikuj"]');
  await strona.waitForFunction(() => document.querySelectorAll('.karta-projektu:not(.szkielet)').length === 2);
  const nazwy = await strona.$$eval('.karta-projektu strong', (l) => l.map((x) => x.textContent).sort());
  assert.deepEqual(nazwy, ['Kalendarz 2027', 'Kalendarz 2027 (kopia)']);
  assert.deepEqual(bledy, []);
});
