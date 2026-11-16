// Rozkładanie rysunku SVG z efektami (#173): nic nie znika. Gradient i przycięcie zostają kształtami, prosta maska
// staje się przycięciem, wzór – kafelkami przyciętymi do kształtu, a filtry (rozmycie, cień) i maska z gradientem
// zostają obrazem w swoim miejscu. Wygląd strony prawie się nie zmienia, cofnięcie przywraca rysunek.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const obrazStrony = (strona) => strona.evaluate(() => {
  const c = window.seriodruk.edytor.canvas;
  c.discardActiveObject();
  c.renderAll();
  const el = c.toCanvasElement(1);
  const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
  const wynik = [];
  for (let i = 0; i < d.length; i += 4) wynik.push(Math.round((d[i] + d[i + 1] + d[i + 2]) / 3 * (d[i + 3] / 255) + 255 - d[i + 3]));
  return wynik;
});
const roznica = (a, b) => {
  assert.equal(a.length, b.length);
  let suma = 0; let rozne = 0;
  for (let i = 0; i < a.length; i += 1) { const r = Math.abs(a[i] - b[i]); suma += r; if (r > 80) rozne += 1; }
  return { srednia: suma / a.length, rozne: rozne / a.length };
};
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WATEK = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const ADRES = '(kod) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(kod)))}`';

const RYSUNEK = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="400" height="240" viewBox="0 0 400 240">
  <defs>
    <linearGradient id="g"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#ef476f" stop-opacity="0.4"/></linearGradient>
    <clipPath id="c"><circle cx="60" cy="60" r="40"/></clipPath>
    <mask id="mp"><rect x="130" y="20" width="40" height="80" fill="#fff"/></mask>
    <mask id="mg"><rect x="200" y="20" width="80" height="80" fill="url(#g)"/></mask>
    <pattern id="w" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="3" fill="#118ab2"/></pattern>
    <filter id="rozmycie"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="cien"><feDropShadow dx="4" dy="4" stdDeviation="2" flood-color="#000" flood-opacity="0.6"/></filter>
    <symbol id="s" viewBox="0 0 10 10"><rect width="10" height="10" fill="#8338ec"/></symbol>
  </defs>
  <rect width="400" height="240" fill="#f1f6ff"/>
  <rect x="20" y="20" width="80" height="80" fill="url(#g)" clip-path="url(#c)"/>
  <rect x="110" y="20" width="80" height="80" fill="#06d6a0" mask="url(#mp)"/>
  <rect x="200" y="20" width="80" height="80" fill="#073b4c" mask="url(#mg)"/>
  <rect x="300" y="20" width="80" height="80" fill="url(#w)" stroke="#333" stroke-width="2"/>
  <g transform="translate(40 130) rotate(-8)"><rect width="90" height="60" fill="#ef476f" filter="url(#rozmycie)"/></g>
  <circle cx="200" cy="170" r="35" fill="#ffd166" filter="url(#cien)"/>
  <use href="#s" x="270" y="140" width="40" height="40"/>
  <text x="330" y="200" font-size="20" fill="#222">Abc</text>
</svg>`;

test('Rysunek SVG z efektami: nic nie znika – maska i wzór jako kształty, filtry jako obrazy w miejscu; cofanie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Efekty SVG');
  await strona.evaluate(async ({ adresKod, kod }) => {
    const { stan, edytor } = window.seriodruk;
    const adres = eval(adresKod); // eslint-disable-line no-eval
    const a = await edytor.dodajObraz(adres(kod), 'efekty.svg', stan.projekt.zasoby);
    a.set({ left: 20, top: 30, scaleX: 0.3, scaleY: 0.3 });
    a.setCoords();
    edytor.zatwierdz();
  }, { adresKod: ADRES, kod: RYSUNEK });
  await strona.waitForTimeout(300);
  const przed = await obrazStrony(strona);
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    e.canvas.setActiveObject(e.canvas.getObjects().find((o) => o.nazwa === 'efekty.svg'));
    e._emitujZaznaczenie();
  });
  await strona.click('#wlasciwosci button:has-text("Rozłóż rysunek na elementy")');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'group'));
  await strona.waitForTimeout(500);
  const komunikat = await strona.textContent('#powiadomienie');
  assert.match(komunikat, /3 fragmenty z efektami zostały obrazem – reszta jest edytowalna\./, komunikat);
  assert.doesNotMatch(komunikat, /którego edytor nie ma/);
  const grupa = await strona.evaluate(() => {
    const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'group');
    return g.getObjects().map((o) => ({ typ: o.type, przyciety: Boolean(o.clipPath), nazwa: o.nazwa || '', gradient: Boolean(o.fill?.colorStops) }));
  });
  const obrazy = grupa.filter((o) => o.typ === 'image');
  assert.equal(obrazy.length, 3, JSON.stringify(grupa));
  assert.ok(obrazy.every((o) => /fragment z efektem/.test(o.nazwa)));
  assert.ok(grupa.some((o) => o.gradient && o.przyciety), 'gradient z przycięciem zostaje kształtem');
  assert.ok(grupa.filter((o) => o.typ !== 'image' && o.przyciety).length >= 2, 'prosta maska jako przycięcie');
  assert.ok(grupa.filter((o) => o.typ === 'circle' || o.typ === 'ellipse').length >= 20, 'wzór jako kafelki');
  assert.ok(grupa.some((o) => o.typ === 'textbox'), 'napis zostaje napisem');
  const po = await obrazStrony(strona);
  const r = roznica(przed, po);
  assert.ok(r.srednia < 3 && r.rozne < 0.01, `wygląd po rozłożeniu: ${JSON.stringify(r)}`);
  // Fragmenty są obrazami projektu, w rozdzielczości do druku (≥ 300 dpi w rozmiarze na stronie).
  const dpi = await strona.evaluate(() => {
    const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'group');
    return g.getObjects().filter((o) => o.type === 'image').map((o) => o.width / ((o.getScaledWidth() * g.scaleX) / (96 / 25.4) / 25.4));
  });
  assert.ok(dpi.every((d) => d >= 290), `dpi fragmentów: ${dpi}`);
  // Cofnięcie przywraca rysunek.
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'image' && o.nazwa === 'efekty.svg'));
  assert.ok(roznica(przed, await obrazStrony(strona)).srednia < 1);
  assert.deepEqual(bledy, []);
});

test('PDF wektorowy z rozłożonym rysunkiem z efektami: wygląda jak strona, kształty zostają wektorami', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Efekty PDF');
  const w = await strona.evaluate(async ({ adresKod, kod }) => {
    const { stan, edytor } = window.seriodruk;
    const adres = eval(adresKod); // eslint-disable-line no-eval
    const a = await edytor.dodajObraz(adres(kod), 'efekty.svg', stan.projekt.zasoby);
    a.set({ left: 20, top: 30, scaleX: 0.3, scaleY: 0.3 });
    a.setCoords();
    edytor.zatwierdz();
    const { rozlozRysunek } = await import('./js/svg-elementy.js');
    const r = await rozlozRysunek(stan.projekt, a);
    edytor.zastapObiekt(a, r.grupa);
    edytor.zatwierdz();
    await window.seriodruk.zapiszTeraz();
    return { obrazy: r.obrazy, ile: r.ile };
  }, { adresKod: ADRES, kod: RYSUNEK });
  assert.equal(w.obrazy, 3);
  const pdf = await strona.evaluate(async ([pdfjs, watek]) => {
    const { stan } = window.seriodruk;
    const { eksportujPdf } = await import('./js/eksport.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const wynik = await eksportujPdf(stan.projekt, { znaki: false, spad: true });
    const bajty = new Uint8Array(await wynik.blob.arrayBuffer());
    if (!window.pdfjsLib) await new Promise((ok, blad) => { const s = document.createElement('script'); s.src = pdfjs; s.onload = ok; s.onerror = blad; document.head.append(s); });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = watek;
    const str = await (await window.pdfjsLib.getDocument({ data: bajty.slice() }).promise).getPage(1);
    const widok = str.getViewport({ scale: 924 / str.getViewport({ scale: 1 }).width });
    const a = Object.assign(document.createElement('canvas'), { width: Math.round(widok.width), height: Math.round(widok.height) });
    await str.render({ canvasContext: a.getContext('2d'), viewport: widok }).promise;
    const wzor = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); renderujCel(stan.projekt, stan.projekt.strony[0], { szerokoscPx: a.width, spad: true, oryginaly: true }).then((u) => { i.src = u; }); });
    const b = Object.assign(document.createElement('canvas'), { width: a.width, height: a.height });
    b.getContext('2d').drawImage(wzor, 0, 0, a.width, a.height);
    const da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data;
    const db = b.getContext('2d').getImageData(0, 0, a.width, a.height).data;
    let suma = 0; let rozne = 0;
    for (let i = 0; i < da.length; i += 4) { const r = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3; suma += r; if (r > 80) rozne += 1; }
    return { uwagi: wynik.uwagi, srednia: suma / (da.length / 4), rozne: rozne / (da.length / 4) };
  }, [PDFJS, PDFJS_WATEK]);
  assert.ok(pdf.srednia < 2 && pdf.rozne < 0.006, `PDF jak strona: ${JSON.stringify(pdf)}`);
  assert.ok(!(pdf.uwagi || []).some((u) => /rysunek SVG/.test(u)), `uwagi PDF: ${JSON.stringify(pdf.uwagi)}`);
  assert.deepEqual(bledy, []);
});
