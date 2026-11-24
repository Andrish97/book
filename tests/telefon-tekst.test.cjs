// #428: na telefonie tekst ze strony edytuje się w zwykłym polu (zaznaczanie, Kopiuj/Wklej i skróty systemu):
// zmiany od razu na stronie, formatowanie pozostałych fragmentów zostaje; „Formatuj fragment” wraca do pisania na
// stronie z tym samym zaznaczeniem. Wiadomości czatu mają przycisk „Kopiuj”.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('telefon: tekst ze strony w zwykłym polu, formatowanie zostaje, „Formatuj fragment”', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Tekst na telefonie');
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const o = e.dodajTekst('Ala ma kota');
    o.set({ id: 't1' });
    o.setSelectionStyles({ fontWeight: 'bold' }, 0, 3); // „Ala” pogrubione
    e.canvas.setActiveObject(o);
    o.enterEditing();
  });
  await strona.waitForSelector('#edycja-tekstu-tel:not([hidden])');
  assert.equal(await strona.inputValue('#edycja-tekstu-pole'), 'Ala ma kota');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.id === 't1').isEditing), false, 'pisanie w polu, nie na płótnie');
  await strona.fill('#edycja-tekstu-pole', 'Ala ma dwa koty');
  const w = await strona.evaluate(() => { const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 't1'); return { text: o.text, gruby: o.getStyleAtPosition(1).fontWeight, zwykly: o.getStyleAtPosition(8).fontWeight || 'normal' }; });
  assert.deepEqual(w, { text: 'Ala ma dwa koty', gruby: 'bold', zwykly: 'normal' });
  // „Formatuj fragment”: zaznaczenie „dwa” w polu → pisanie na stronie z tym zaznaczeniem.
  await strona.evaluate(() => { const p = document.querySelector('#edycja-tekstu-pole'); p.focus(); p.setSelectionRange(7, 10); });
  await strona.click('#edycja-tekstu-formatuj');
  const f = await strona.evaluate(() => { const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 't1'); return [o.isEditing, o.selectionStart, o.selectionEnd, document.querySelector('#edycja-tekstu-tel').hidden]; });
  assert.deepEqual(f, [true, 7, 10, true]);
  assert.deepEqual(bledy, []);
});

test('czat: wiadomość ma przycisk „Kopiuj”', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await nowyProjekt(strona, 'Czat');
  await strona.evaluate(async () => {
    const lista = document.querySelector('#czat-ai-wiadomosci');
    lista.closest('dialog').show();
  });
  // Dopisanie odpowiedzi tak jak robi to czat (dopisz z modułu czatu).
  await strona.evaluate(async () => { (await import('./js/app/czat-ai.js')).__dopiszDoTestu?.('ai', 'Odpowiedź do skopiowania.'); });
  await strona.waitForSelector('#czat-ai-wiadomosci li.ai .czat-ai-kopiuj', { state: 'attached' });
  await strona.evaluate(() => document.querySelector('#czat-ai-wiadomosci li.ai .czat-ai-kopiuj').click());
  await strona.waitForFunction(async () => (await navigator.clipboard.readText()) === 'Odpowiedź do skopiowania.');
  assert.deepEqual(bledy, []);
});
