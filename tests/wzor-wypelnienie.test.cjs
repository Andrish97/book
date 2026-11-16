// Wzór jako wypełnienie kształtu (#182): paski, kropki, kratka… z Biblioteki wewnątrz prostokąta, elipsy,
// wielokąta i zamkniętej ścieżki – przycięte kształtem, na tle z wypełnienia; skala i obrót; w podglądzie strony
// (składanie jak miniatury i PNG), w PDF wektorowo (bez obrazu), w zapisie, przy cofaniu, w panelu i z Biblioteki.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const piksele = (strona, punkty) => strona.evaluate(async (pkt) => {
  const { stan } = window.seriodruk;
  const { zapiszTeraz } = await import('./js/app/zapis.js');
  await zapiszTeraz();
  const { naPlotnieCelu } = await import('./js/zlozenie.js');
  return naPlotnieCelu(stan.projekt, stan.projekt.strony[0], { szerokoscPx: 148 * 8, spad: false }, (plotno) => {
    const ctx = plotno.toCanvasElement().getContext('2d');
    return Object.fromEntries(Object.entries(pkt).map(([k, [x, y]]) => [k, [...ctx.getImageData(Math.round(x * 8), Math.round(y * 8), 1, 1).data]]));
  });
}, punkty);

test('wzór w kształcie: rysowanie, przycięcie, skala, PDF wektorowy, zapis, cofanie, panel, Biblioteka', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wzory');
  // Prostokąt 40×40 mm w (20, 20): żółte tło, czerwone paski poziome (pasy 4 mm co 8 mm, od y = 0 prostokąta).
  await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    edytor.dodajProstokat();
    const r = edytor.aktywny;
    r.set({ left: 20, top: 20, width: 40, height: 40, scaleX: 1, scaleY: 1, fill: '#ffff00', stroke: '#000000', strokeWidth: 0.5, strokeUniform: true });
    r.set('wzor', { id: 'paski-poziome', kolor: '#ff0000', skala: 1, obrot: 0 });
    r.setCoords();
    edytor.zatwierdz();
  });
  // Paski wzoru są liczone od środka kwadratu obejmującego kształt – szukamy obu kolorów wzdłuż pionu.
  const pion = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { zapiszTeraz } = await import('./js/app/zapis.js');
    await zapiszTeraz();
    const { naPlotnieCelu } = await import('./js/zlozenie.js');
    return naPlotnieCelu(stan.projekt, stan.projekt.strony[0], { szerokoscPx: 148 * 8, spad: false }, (plotno) => {
      const ctx = plotno.toCanvasElement().getContext('2d');
      const kolory = new Set();
      for (let y = 22; y < 58; y += 0.5) { const d = ctx.getImageData(40 * 8, Math.round(y * 8), 1, 1).data; kolory.add(`${d[0]},${d[1]},${d[2]}`); }
      const poza = ctx.getImageData(10 * 8, 40 * 8, 1, 1).data;
      return { kolory: [...kolory], poza: [...poza] };
    });
  });
  assert.ok(pion.kolory.includes('255,0,0'), `paski wzoru: ${pion.kolory}`);
  assert.ok(pion.kolory.includes('255,255,0'), `tło między paskami: ${pion.kolory}`);
  assert.deepEqual(pion.poza.slice(0, 3), [255, 255, 255], 'poza kształtem nie ma wzoru');

  // Elipsa: wzór przycięty – w narożniku obrysu elipsy biało, w środku wzór albo tło.
  await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    edytor.dodajElipse();
    const e = edytor.aktywny;
    e.set({ left: 80, top: 20, rx: 20, ry: 20, width: 40, height: 40, scaleX: 1, scaleY: 1, fill: '#00ff00', stroke: null, strokeWidth: 0 });
    e.set('wzor', { id: 'kropki', kolor: '#0000ff', skala: 2, obrot: 30 });
    e.setCoords();
    edytor.zatwierdz();
  });
  const px = await piksele(strona, { rogElipsy: [81.5, 21.5] });
  assert.deepEqual(px.rogElipsy.slice(0, 3), [255, 255, 255], 'narożnik poza elipsą – bez wzoru');

  // PDF: wzór zostaje wektorowy – bez uwag i bez obrazów na stronie.
  const pdf = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { eksportujPdf } = await import('./js/eksport.js');
    const w = await eksportujPdf(stan.projekt, { znaki: false, spad: false });
    const { PDFDocument, PDFName, PDFDict } = window.PDFLib;
    const dok = await PDFDocument.load(new Uint8Array(await w.blob.arrayBuffer()));
    const xo = dok.getPage(0).node.Resources().lookupMaybe(PDFName.of('XObject'), PDFDict);
    return { uwagi: (w.uwagi || []).map(([k]) => k), obrazy: xo ? xo.keys().length : 0 };
  });
  assert.deepEqual(pdf.uwagi, []);
  assert.equal(pdf.obrazy, 0, 'wzór nie jest obrazem');

  // Zapis i wczytanie: pole wzoru zostaje; cofanie usuwa wzór.
  const zapis = await strona.evaluate(async () => {
    const { stan, przeladuj } = window.seriodruk;
    const { zapiszTeraz } = await import('./js/app/zapis.js');
    await zapiszTeraz();
    await przeladuj();
    return stan.projekt.strony[0].obiekty.map((o) => o.wzor?.id || null);
  });
  assert.deepEqual(zapis.filter(Boolean).sort(), ['kropki', 'paski-poziome']);

  // Panel: wybór „Wzór” w Wypełnieniu, siatka wzorów, kolor wzoru, skala, obrót.
  await strona.evaluate(() => { const { edytor } = window.seriodruk; edytor.zaznacz(edytor.canvas.getObjects().find((o) => o.type === 'ellipse').id); });
  await strona.waitForSelector('#wlasciwosci .wybor-wzoru');
  assert.ok(await strona.locator('#wlasciwosci .wybor-wzoru button[aria-pressed="true"][data-wzor="kropki"]').count());
  await strona.locator('#wlasciwosci .wybor-wzoru button[data-wzor="kratka"]').click();
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.wzor.id), 'kratka');
  await strona.waitForTimeout(400);
  await strona.evaluate(() => document.querySelector('[data-akcja="cofnij"]').click());
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'ellipse')?.wzor?.id === 'kropki');

  // Biblioteka: kafelek wzoru przy zaznaczonym kształcie pyta, co zrobić – „Wypełnij zaznaczony kształt”.
  await strona.evaluate(() => { const { edytor } = window.seriodruk; edytor.zaznacz(edytor.canvas.getObjects().find((o) => o.type === 'rect').id); });
  const { wstaw } = await strona.evaluate(async () => {
    const { wstawZBiblioteki } = await import('./js/app/biblioteka-okno.js');
    const p = wstawZBiblioteki('tla', 'wzor-jodelka');
    return { wstaw: Boolean(p) };
  });
  assert.ok(wstaw);
  await strona.waitForSelector('#dlg-potwierdz[open]');
  await strona.click('#dlg-potwierdz [value="tak"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'rect')?.wzor?.id === 'jodelka');
  const ile = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().length);
  assert.equal(ile, 2, 'wzór trafił do kształtu – na stronie nie przybyło elementów');
  assert.deepEqual(bledy, []);
});
