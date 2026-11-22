// Przezroczystość w przejściach kolorów (decyzja #123): krycie każdego punktu przejścia w panelu;
// w PDF przejście zostaje wektorowe – z maską krycia (SMask), bez zamiany elementu na obraz.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('przejście z kryciem: panel „Krycie” przy kolorze, PDF wektorowy z maską krycia', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Przejścia');
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'rect');
  // Przejście liniowe z panelu.
  await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    const r = edytor.aktywny;
    r.set('fill', new fabric.Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 1, y2: 0 }, colorStops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] }));
    edytor.canvas.discardActiveObject();
    edytor.canvas.setActiveObject(r);
  });
  await strona.waitForFunction(() => /Kolor 2/.test(document.querySelector('#wlasciwosci').textContent));
  const pola = strona.locator('#wlasciwosci label', { hasText: /^Krycie%$/ }).locator('input');
  assert.ok(await pola.count() >= 3, `pole „Krycie” przy każdym kolorze przejścia (i całego elementu): ${await pola.count()}`);
  await pola.nth(1).fill('20');
  await pola.nth(1).press('Enter');
  await strona.waitForFunction(() => /rgba/.test(JSON.stringify(window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'rect').fill.colorStops)));
  const kolor = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'rect').fill.colorStops.find((c) => c.offset === 1).color);
  assert.equal(kolor, 'rgba(0,0,255,0.2)');
  const pdf = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { zapiszTeraz } = await import('./js/app/zapis.js');
    await zapiszTeraz();
    const { eksportujPdf } = await import('./js/eksport.js');
    const w = await eksportujPdf(stan.projekt, { znaki: false, spad: false });
    const { PDFDocument, PDFName, PDFDict } = window.PDFLib;
    const dok = await PDFDocument.load(new Uint8Array(await w.blob.arrayBuffer()));
    const zas = dok.getPage(0).node.Resources();
    const gs = zas.lookupMaybe(PDFName.of('ExtGState'), PDFDict);
    const maski = gs ? gs.keys().filter((k) => dok.context.lookup(gs.get(k)).get(PDFName.of('SMask'))).length : 0;
    const sh = zas.lookupMaybe(PDFName.of('Shading'), PDFDict);
    const xo = zas.lookupMaybe(PDFName.of('XObject'), PDFDict);
    return { maski, cieniowania: sh ? sh.keys().length : 0, obrazy: xo ? xo.keys().length : 0 };
  });
  assert.equal(pdf.maski, 1, 'maska krycia przejścia');
  assert.equal(pdf.cieniowania, 1, 'przejście jako cieniowanie (wektor)');
  assert.equal(pdf.obrazy, 0, 'prostokąt nie zamienił się w obraz');
  assert.deepEqual(bledy, []);
});
