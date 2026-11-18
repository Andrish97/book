// Książka (#212): długi tekst z „Dokładaj strony” sam dokłada strony z ramką w tym samym miejscu (i usuwa puste,
// gdy tekstu ubędzie); akapit „od nowej strony” (np. rozdział) zaczyna następną ramkę.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const AKAPIT = 'Litwo, ojczyzno moja, ty jesteś jak zdrowie; ile cię trzeba cenić, ten tylko się dowie, kto cię stracił. Dziś piękność twą w całej ozdobie widzę i opisuję, bo tęsknię po tobie.';

test('dokładanie stron dla długiego tekstu, akapit od nowej strony, puste strony znikają', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Książka');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'textbox');
  await strona.evaluate((tekst) => {
    const e = window.seriodruk.edytor;
    const o = e.aktywny;
    if (o.isEditing) o.exitEditing();
    o.set({ text: tekst, width: 100, top: 20, left: 20 });
    o.ramka_h = 120;
    o.initDimensions();
    e.oznaczZmiane();
  }, Array.from({ length: 30 }, (_, i) => `${i === 12 ? 'Rozdział drugi' : AKAPIT}`).join('\n'));
  // Przełącznik w panelu „Przelewanie tekstu”.
  await strona.locator('#wlasciwosci label:has-text("Dokładaj strony, aż cały tekst się zmieści")').click();
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length > 2, null, { timeout: 20000 });
  await strona.waitForTimeout(1500);
  const po = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    const ramki = p.strony.flatMap((s) => s.obiekty.filter((o) => o.watek));
    const ostatnia = ramki[ramki.length - 1];
    return { stron: p.strony.length, auto: p.strony.filter((s) => s.auto_watek).length, ramek: ramki.length, ostatniaPusta: !ostatnia.text, indeks: window.seriodruk.stan.indeks, pozycje: ramki.every((r) => r.left === ramki[0].left && r.top === ramki[0].top) };
  });
  assert.ok(po.stron >= 3, `stron: ${po.stron}`);
  assert.equal(po.auto, po.stron - 1, 'strony dołożone z wątkiem');
  assert.equal(po.ramek, po.stron);
  assert.equal(po.ostatniaPusta, false, 'tekst sięga ostatniej ramki');
  assert.equal(po.indeks, 0, 'bieżąca strona zostaje');
  assert.ok(po.pozycje, 'ramki w tym samym miejscu');

  // Rozdział od nowej strony: akapit 13 („Rozdział drugi”) zaczyna ramkę.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const o = e.canvas.getObjects().find((x) => x.watek);
    e.canvas.setActiveObject(o);
    o.enterEditing();
    o.selectionStart = o.selectionEnd = 0;
  });
  // Kursor w akapicie rozdziału – na stronie, gdzie on leży: wprost przez edytor na ramce z tym akapitem.
  const ok = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const e = window.seriodruk.edytor;
    const s = p.strony.findIndex((x) => x.obiekty.some((o) => (o.text || '').includes('Rozdział drugi')));
    const { przejdzDoStrony } = await import('./js/app/lista-stron.js');
    await przejdzDoStrony(s);
    const o = e.canvas.getObjects().find((x) => (x.text || '').includes('Rozdział drugi'));
    e.canvas.setActiveObject(o);
    o.enterEditing();
    o.selectionStart = o.selectionEnd = o.text.indexOf('Rozdział drugi') + 3;
    const w = e.ustawAkapitOdNowejStrony(true, o);
    o.exitEditing();
    return w;
  });
  assert.ok(ok);
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.some((s) => s.obiekty.some((o) => (o.text || '').startsWith('Rozdział drugi'))), null, { timeout: 20000 });

  // Mniej tekstu – puste dołożone strony na końcu znikają.
  const przed = await strona.evaluate(() => window.seriodruk.stan.projekt.strony.length);
  await strona.evaluate(async () => {
    const { przejdzDoStrony } = await import('./js/app/lista-stron.js');
    await przejdzDoStrony(0);
    const e = window.seriodruk.edytor;
    const o = e.canvas.getObjects().find((x) => x.watek);
    o.set({ text: 'Krótko.', styles: {} });
    o.initDimensions();
    e.przelejWatki();
    e.oznaczZmiane();
  });
  await strona.waitForFunction((n) => window.seriodruk.stan.projekt.strony.length < n, przed, { timeout: 20000 });
  assert.deepEqual(bledy, []);
});
