// #434: na telefonie tekst ze strony edytuje się wprost na stronie, jak zwykłe pole: kursor w środku, kasowanie
// i wpisywanie na miejscu; przytrzymanie zaznacza wyraz i pokazuje menu Kopiuj / Wytnij / Wklej / Wszystko, a uchwyty
// zaznaczenia przeciąga się palcem. (Wcześniej, #428, pisanie szło do osobnego pola na dole ekranu.) Wiadomości czatu
// mają przycisk „Kopiuj”.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('telefon: pisanie wprost na stronie, przytrzymanie – menu Kopiuj/Wytnij/Wklej, uchwyty zaznaczenia', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await strona.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await nowyProjekt(strona, 'Tekst na telefonie');
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const o = e.dodajTekst('Ala ma kota');
    o.set({ id: 't1', fontSize: 8, width: 120 });
    o.setSelectionStyles({ fontWeight: 'bold' }, 0, 3); // „Ala” pogrubione
    o.initDimensions();
    e.canvas.setActiveObject(o);
    o.enterEditing();
    o.selectionStart = o.selectionEnd = 6; // kursor za „ma”
    o._updateTextarea?.();
    e.canvas.requestRenderAll();
  });
  const o = (fn, arg) => strona.evaluate(fn, arg);
  assert.equal(await o(() => window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 't1').isEditing), true, 'pisanie na stronie');
  assert.equal(await o(() => Boolean(document.querySelector('#edycja-tekstu-tel'))), false, 'bez paska na dole');
  // Klawiatura: kasowanie i wpisywanie w środku tekstu.
  await strona.keyboard.press('Backspace');
  await strona.keyboard.press('Backspace');
  await strona.keyboard.type('mamy');
  const w = await o(() => { const x = window.seriodruk.edytor.canvas.getObjects().find((y) => y.id === 't1'); return { text: x.text, gruby: x.getStyleAtPosition(1).fontWeight }; });
  assert.deepEqual(w, { text: 'Ala mamy kota', gruby: 'bold' });
  // Przytrzymanie palca na „kota” → zaznaczony wyraz i menu.
  const p = await o(() => {
    const e = window.seriodruk.edytor; const x = e.canvas.getObjects().find((y) => y.id === 't1');
    const b = x._getCursorBoundaries(11, true);
    const pt = new fabric.Point(b.left + b.leftOffset, b.top + b.topOffset + 2).transform(x.calcTransformMatrix()).transform(e.canvas.viewportTransform);
    const r = e.canvas.upperCanvasEl.getBoundingClientRect(); const css = r.width / e.canvas.getWidth();
    return { x: r.left + pt.x * css, y: r.top + pt.y * css };
  });
  await o(({ x, y }) => {
    const el = window.seriodruk.edytor.canvas.upperCanvasEl;
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
  }, p);
  await strona.waitForSelector('.tekst-dotyk-menu:not([hidden]) button[data-akcja="kopiuj"]');
  const zaz = await o(() => { const x = window.seriodruk.edytor.canvas.getObjects().find((y) => y.id === 't1'); return x.text.slice(x.selectionStart, x.selectionEnd); });
  assert.equal(zaz, 'kota');
  await o(() => window.seriodruk.edytor.canvas.upperCanvasEl.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true })));
  assert.equal(await o(() => document.querySelectorAll('.tekst-dotyk-uchwyt:not([hidden])').length), 2, 'dwa uchwyty zaznaczenia');
  // Uchwyt początku przeciągnięty na początek tekstu – zaznaczenie rośnie.
  await o(() => {
    const e = window.seriodruk.edytor; const x = e.canvas.getObjects().find((y) => y.id === 't1');
    const u = document.querySelector('.tekst-dotyk-uchwyt.poczatek');
    const b = x._getCursorBoundaries(0, true);
    const pt = new fabric.Point(b.left + b.leftOffset + 1, b.top + b.topOffset + 2).transform(x.calcTransformMatrix()).transform(e.canvas.viewportTransform);
    const r = e.canvas.upperCanvasEl.getBoundingClientRect(); const css = r.width / e.canvas.getWidth();
    const h = (x.fontSize * x.lineHeight) * e.canvas.getZoom() * css;
    const cx = r.left + pt.x * css; const cy = r.top + pt.y * css + h * 0.8;
    u.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: cx, clientY: cy, bubbles: true }));
    u.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', pointerId: 7, clientX: cx, clientY: cy, bubbles: true }));
    u.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', pointerId: 7, bubbles: true }));
  });
  const caly = await o(() => { const x = window.seriodruk.edytor.canvas.getObjects().find((y) => y.id === 't1'); return [x.selectionStart, x.selectionEnd]; });
  assert.deepEqual(caly, [0, 13]);
  // Kopiuj → schowek; Wytnij → tekst znika; Wklej → wraca.
  await strona.click('.tekst-dotyk-menu button[data-akcja="kopiuj"]');
  await strona.waitForFunction(async () => (await navigator.clipboard.readText()) === 'Ala mamy kota');
  await o(() => { const x = window.seriodruk.edytor.canvas.getObjects().find((y) => y.id === 't1'); x.selectionStart = 4; x.selectionEnd = 9; x._updateTextarea?.(); window.seriodruk.edytor.canvas.fire('text:selection:changed', { target: x }); });
  await strona.click('.tekst-dotyk-menu button[data-akcja="wytnij"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((y) => y.id === 't1').text === 'Ala kota');
  await o(() => { const x = window.seriodruk.edytor.canvas.getObjects().find((y) => y.id === 't1'); x.selectionStart = x.selectionEnd = 4; x._updateTextarea?.(); });
  await o(async () => { await navigator.clipboard.writeText('ma '); });
  await o(() => { const x = window.seriodruk.edytor.canvas.getObjects().find((y) => y.id === 't1'); x.selectWord(5); window.seriodruk.edytor.canvas.fire('text:selection:changed', { target: x }); });
  await strona.click('.tekst-dotyk-menu button[data-akcja="wklej"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((y) => y.id === 't1').text === 'Ala ma ');
  assert.equal(await o(() => window.seriodruk.edytor.canvas.getObjects().find((y) => y.id === 't1').isEditing), true, 'pisanie trwa po menu');
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
