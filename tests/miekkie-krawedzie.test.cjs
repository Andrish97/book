// Obramowanie obrazu i miękkie krawędzie (#156): obramowanie z kryciem, rodzajem linii i zaokrągleniem
// narożników (przycina obraz), miękkie krawędzie obrazu i kształtu (równo i owal) – w podglądzie strony
// (składanie jak miniatury i PNG), w zapisie, przy cofaniu i w PDF (element jako obraz z maską przezroczystości).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Piksele strony A5 w skali 4 px/mm (składanie jak miniatury, podgląd i PNG).
const piksele = (strona, punkty) => strona.evaluate(async (pkt) => {
  const { stan } = window.seriodruk;
  const { zapiszTeraz } = await import('./js/app/zapis.js');
  await zapiszTeraz();
  const { naPlotnieCelu } = await import('./js/zlozenie.js');
  return naPlotnieCelu(stan.projekt, stan.projekt.strony[0], { szerokoscPx: 148 * 4, spad: false }, (plotno) => {
    const ctx = plotno.toCanvasElement().getContext('2d');
    return Object.fromEntries(Object.entries(pkt).map(([k, [x, y]]) => [k, [...ctx.getImageData(Math.round(x * 4), Math.round(y * 4), 1, 1).data]]));
  });
}, punkty);

test('obramowanie obrazu i miękkie krawędzie: rysowanie, panel, zapis, cofanie, PDF', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wtapianie');
  // Czerwony obraz 40×40 mm w (20, 20) i niebieski prostokąt 40×40 mm w (80, 20).
  await strona.evaluate(async () => {
    const { edytor, stan } = window.seriodruk;
    const c = document.createElement('canvas');
    c.width = 400; c.height = 400;
    const g = c.getContext('2d');
    g.fillStyle = '#ff0000'; g.fillRect(0, 0, 400, 400);
    const img = await edytor.dodajObraz(c.toDataURL('image/png'), 'czerwony.png', stan.projekt.zasoby);
    img.set({ left: 20, top: 20, scaleX: 0.1, scaleY: 0.1 });
    img.setCoords();
    edytor.dodajProstokat();
    const r = edytor.aktywny;
    r.set({ left: 80, top: 20, width: 40, height: 40, scaleX: 1, scaleY: 1, fill: '#0000ff', stroke: null, strokeWidth: 0 });
    r.setCoords();
    edytor.zaznacz(img.id);
    edytor.zatwierdz();
  });

  // Obramowanie: kolor, grubość, rodzaj, zaokrąglenie – w panelu „Obramowanie”.
  const panel = await strona.textContent('#wlasciwosci');
  assert.match(panel, /Obramowanie/);
  assert.match(panel, /Miękkie krawędzie/);
  await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    const img = edytor.canvas.getObjects().find((o) => o.type === 'image');
    img.set({ stroke: 'rgba(0,128,0,0.5)', strokeWidth: 2, strokeUniform: true, zaokraglenie: 8 });
    img.dirty = true;
    edytor.zatwierdz();
  });
  let px = await piksele(strona, { srodek: [40, 40], brzeg: [40, 20.3], rog: [20.6, 20.6] });
  assert.deepEqual(px.srodek.slice(0, 3), [255, 0, 0], 'obraz w środku');
  assert.ok(px.brzeg[1] > 60 && px.brzeg[0] > 120 && px.brzeg[0] < 250, `obramowanie zielone z kryciem 50% na czerwonym: ${px.brzeg}`);
  assert.deepEqual(px.rog.slice(0, 3), [255, 255, 255], 'zaokrąglony narożnik – obraz przycięty');
  // PDF: zaokrąglenie i przerywane obramowanie zostają wektorowe (przycięcie ścieżką, bez zamiany na obraz).
  const wektor = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { eksportujPdf } = await import('./js/eksport.js');
    const w = await eksportujPdf(stan.projekt, { znaki: false, spad: false });
    return (w.uwagi || []).map(([k]) => k);
  });
  assert.deepEqual(wektor, []);

  // Miękkie krawędzie: obraz (owal) i prostokąt (równo) – przy brzegu półprzezroczyście, w środku pełny kolor.
  await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    const [img, r] = [edytor.canvas.getObjects().find((o) => o.type === 'image'), edytor.canvas.getObjects().find((o) => o.type === 'rect')];
    img.set({ stroke: null, strokeWidth: 0, zaokraglenie: undefined, miekkie_krawedzie: 10, miekkie_rodzaj: 'owal' });
    r.set({ miekkie_krawedzie: 8 });
    img.dirty = true; r.dirty = true;
    edytor.zatwierdz();
  });
  px = await piksele(strona, { obrazSrodek: [40, 40], obrazBrzeg: [40, 21], obrazRog: [21, 21], prostSrodek: [100, 40], prostBrzeg: [100, 21], prostBlisko: [100, 25] });
  assert.deepEqual(px.obrazSrodek.slice(0, 3), [255, 0, 0]);
  assert.ok(px.obrazBrzeg[1] > 150, `owal: brzeg prawie przezroczysty (biały) ${px.obrazBrzeg}`);
  assert.deepEqual(px.obrazRog.slice(0, 3), [255, 255, 255], 'owal: narożnik przezroczysty');
  assert.deepEqual(px.prostSrodek.slice(0, 3), [0, 0, 255]);
  assert.ok(px.prostBrzeg[0] > 120, `równo: przy samym brzegu jasno ${px.prostBrzeg}`);
  assert.ok(px.prostBlisko[0] > 10 && px.prostBlisko[0] < 245, `równo: w przejściu półprzezroczyście ${px.prostBlisko}`);
  assert.ok(px.prostBlisko[0] < px.prostBrzeg[0], 'równo: im głębiej, tym pełniej');

  // Panel: zmiana szerokości przejścia liczbą i cofanie (krok historii po chwili bez zmian).
  await strona.waitForTimeout(800);
  await strona.evaluate(() => { const { edytor } = window.seriodruk; edytor.zaznacz(edytor.canvas.getObjects().find((x) => x.type === 'rect').id); });
  const pole = strona.locator('#wlasciwosci label:has-text("Szerokość przejścia") input');
  await pole.fill('3');
  await pole.press('Enter');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.miekkie_krawedzie), 3);
  await strona.waitForTimeout(200);
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'rect')?.miekkie_krawedzie === 8, null, { timeout: 5000 });

  // Zapis i wczytanie: pola zostają.
  const zapis = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { zaladujCel } = await import('./js/app/zapis.js');
    await zaladujCel();
    const o = window.seriodruk.edytor.canvas.getObjects();
    const img = o.find((x) => x.type === 'image'); const r = o.find((x) => x.type === 'rect');
    const s = stan.projekt.strony[0].obiekty;
    return { img: [img.miekkie_krawedzie, img.miekkie_rodzaj], r: [r.miekkie_krawedzie, r.miekkie_rodzaj], zapisane: s.map((x) => x.miekkie_krawedzie) };
  });
  assert.deepEqual(zapis.img, [10, 'owal']);
  assert.deepEqual(zapis.r, [8, undefined]);
  assert.deepEqual(zapis.zapisane, [10, 8]);

  // PDF: oba elementy jako obrazy z maską przezroczystości (SMask), powód „miękkie krawędzie”.
  const pdf = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { zapiszTeraz } = await import('./js/app/zapis.js');
    await zapiszTeraz();
    const { eksportujPdf } = await import('./js/eksport.js');
    const w = await eksportujPdf(stan.projekt, { znaki: false, spad: false });
    const { PDFDocument, PDFName, PDFDict } = window.PDFLib;
    const dok = await PDFDocument.load(new Uint8Array(await w.blob.arrayBuffer()));
    const xo = dok.getPage(0).node.Resources().lookupMaybe(PDFName.of('XObject'), PDFDict);
    const obrazy = xo ? xo.keys().map((k) => dok.context.lookup(xo.get(k)).dict) : [];
    return { ile: obrazy.length, maski: obrazy.filter((d) => d.get(PDFName.of('SMask'))).length, uwagi: (w.uwagi || []).map(([k]) => k) };
  });
  assert.equal(pdf.ile, 2, JSON.stringify(pdf));
  assert.equal(pdf.maski, 2, 'przezroczystość brzegu jako maska');
  assert.ok(pdf.uwagi.some((u) => /miękkie krawędzie/.test(u)), JSON.stringify(pdf.uwagi));
  assert.deepEqual(bledy, []);
});
