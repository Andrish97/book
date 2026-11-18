// Odczyt plików Microsoft Publishera (#228) na prawdziwych plikach (dane testowe Apache POI): format strony, strony
// bez stron wzorcowych i technicznych, ramki tekstu na miejscach z treścią i wyglądem znaków (pogrubienie, kursywa,
// wielkość, czcionka), obrazy osadzone, kolor wypełnienia, wczytanie z listy projektów.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('import Publishera: Sample.pub i broszura – strony, teksty z wyglądem, obrazy; z listy projektów', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  const pliki = ['publisher-sample.pub', 'publisher-brochure.pub'].map((n) => Array.from(fs.readFileSync(path.join(__dirname, 'dane', n))));
  const w = await strona.evaluate(async ([a, b]) => {
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const { importujSklad } = await import('./js/import-skladu.js');
    const { przyjmijPlik } = await import('./js/obrazy-projektu.js');
    const opis = async (bajty, nazwa) => {
      const { projekt, raport } = await importujSklad(new File([new Uint8Array(bajty)], nazwa), JSZip, przyjmijPlik);
      return { projekt, raport };
    };
    const s = await opis(a, 'Sample.pub');
    const br = await opis(b, 'Broszura.pub');
    const t1 = s.projekt.strony[0].obiekty.filter((o) => o.type === 'textbox');
    return {
      format: [Math.round(s.projekt.sekcje[0].wydruk.szerokosc_mm), Math.round(s.projekt.sekcje[0].wydruk.wysokosc_mm)],
      stron: s.projekt.strony.length, raport: { teksty: s.raport.teksty, format: s.raport.format },
      pierwszy: { text: t1[0].text.split('\n')[0], left: Math.round(t1[0].left), top: Math.round(t1[0].top), font: t1[0].fontFamily },
      drugi: { text: t1[1].text.split('\n')[0], b: t1[1].fontWeight, i: t1[1].fontStyle, pt: Math.round(t1[1].fontSize * 72 / 25.4), font: t1[1].fontFamily },
      broszura: { stron: br.projekt.strony.length, format: [Math.round(br.projekt.sekcje[0].wydruk.szerokosc_mm), Math.round(br.projekt.sekcje[0].wydruk.wysokosc_mm)], obrazy: br.raport.obrazy, nieobsl: br.raport.nieobslugiwane, teksty: br.raport.teksty, zasobow: Object.keys(br.projekt.zasoby).length, tlo: br.projekt.strony[1].obiekty.some((o) => o.backgroundColor === '#b9b5eb') },
    };
  }, pliki);
  assert.deepEqual(w.format, [210, 297], 'A4 (8,27 × 11,69 cala)');
  assert.equal(w.stron, 2, 'bez stron wzorcowych i technicznych');
  assert.deepEqual(w.raport, { teksty: 6, format: 'Microsoft Publisher' });
  assert.deepEqual(w.pierwszy, { text: 'This is some text on the first page', left: 31, top: 26, font: 'Times New Roman' });
  assert.deepEqual(w.drugi, { text: 'This is in bold and italic', b: 'bold', i: 'italic', pt: 20, font: 'Arial' });
  assert.equal(w.broszura.stron, 2);
  assert.deepEqual(w.broszura.format, [297, 210], 'broszura pozioma');
  assert.equal(w.broszura.obrazy, 3, 'JPEG i GIF osadzone w pliku');
  assert.deepEqual(w.broszura.nieobsl, ['WMF ×5'], 'obrazy WMF – szare pola');
  assert.equal(w.broszura.zasobow, 3);
  assert.ok(w.broszura.tlo, 'ramka tekstu z tłem w kolorze z Publishera');

  // Z listy projektów.
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.setInputFiles('#plik-projekt', path.join(__dirname, 'dane', 'publisher-sample.pub'));
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa === 'publisher-sample' && document.body.dataset.ekran === 'edytor', null, { timeout: 30000 });
  assert.deepEqual(bledy, []);
});
