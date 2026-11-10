const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Czytnik PDF do sprawdzenia wyniku: plik jest rysowany niezależnym programem i porównywany z tym, co rysuje aplikacja.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WATEK = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const OBIEKTY = [
  { type: 'rect', left: -3, top: -3, width: 154, height: 24, fill: '#c8102e', id: 'pas' },
  { type: 'textbox', left: 15, top: 30, width: 120, text: 'Zażółć gęślą jaźń – „Święto” 2026', fontSize: 9, fontFamily: 'Lora', fontWeight: 'bold', textAlign: 'center', fill: '#1a3c8f', styles: [], id: 'tytul' },
  { type: 'textbox', left: 15, top: 50, width: 60, text: 'Pierwszy punkt listy, który zajmuje dwa wiersze\nDrugi punkt\nTrzeci', fontSize: 4.5, fontFamily: 'Inter', lineHeight: 1.3, fill: '#111111', lista: 'numery', styles: [], id: 'lista' },
  { type: 'textbox', left: 80, top: 50, width: 55, text: 'Tekst wyjustowany w wąskiej ramce, z kursywą i kolorem w środku zdania.', fontSize: 4.5, fontFamily: 'Open Sans', textAlign: 'justify', fill: '#222222', id: 'just',
    styles: [{ start: 31, end: 39, style: { fontStyle: 'italic', fill: '#c8102e' } }] },
  { type: 'rect', left: 15, top: 95, width: 40, height: 25, rx: 4, ry: 4, fill: '#ffd166', stroke: '#073b4c', strokeWidth: 1.2, angle: 8, id: 'ramka' },
  { type: 'ellipse', left: 65, top: 95, rx: 22, ry: 13, stroke: '#118ab2', strokeWidth: 0.8, strokeDashArray: [2, 1.5], id: 'elipsa',
    fill: { type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 1, y2: 0 }, colorStops: [{ offset: 0, color: '#06d6a0' }, { offset: 0.5, color: '#ffffff' }, { offset: 1, color: '#ef476f' }] } },
  { type: 'rect', left: 115, top: 95, width: 22, height: 22, opacity: 0.5, fill: '#073b4c', id: 'pol' },
  { type: 'line', left: 15, top: 132, x1: 0, y1: 0, x2: 120, y2: 0, width: 120, height: 0, stroke: '#333333', strokeWidth: 0.5, id: 'linia' },
  { type: 'rect', left: 20, top: 145, width: 30, height: 20, fill: '#8338ec', shadow: { color: 'rgba(0,0,0,0.5)', blur: 3, offsetX: 2, offsetY: 2 }, id: 'cien' },
  { type: 'textbox', left: 60, top: 145, width: 80, text: 'WIELKIE litery jako wygląd', fontSize: 5, fontFamily: 'Montserrat', fill: '#000000', wielkosc_liter: 'wielkie', underline: true, styles: [], id: 'wielkie' },
];

// Wynik eksportu i jego opis: strony, czcionki, polecenia w treści, tekst odczytany czytnikiem, różnica obrazu.
const eksportuj = (strona, opcje) => strona.evaluate(async ([o, pdfjs, watek]) => {
  const { stan } = window.seriodruk;
  const { eksportujPdf } = await import('./js/eksport.js');
  const { renderujCel } = await import('./js/zlozenie.js');
  const wynik = await eksportujPdf(stan.projekt, { znaki: false, spad: true, ...o });
  const bajty = new Uint8Array(await wynik.blob.arrayBuffer());

  // Budowa pliku – odczytana tą samą biblioteką, która go zapisała.
  const { PDFDocument, PDFName, PDFDict, decodePDFRawStream, PDFRawStream } = window.PDFLib;
  const pdf = await PDFDocument.load(bajty);
  const kartka = pdf.getPage(0);
  const zasoby = kartka.node.Resources();
  const ile = (rodzaj) => { const s = zasoby.lookupMaybe(PDFName.of(rodzaj), PDFDict); return s ? s.keys().length : 0; };
  let tresc = '';
  const strumienie = kartka.node.Contents();
  const lista = strumienie.asArray ? strumienie.asArray() : [strumienie];
  for (const ref of lista) {
    const s = pdf.context.lookup(ref);
    tresc += new TextDecoder('latin1').decode(s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : s.getUnencodedContents());
  }
  const liczba = (wzor) => (tresc.match(wzor) || []).length;

  // Obraz strony z czytnika PDF i z aplikacji, w tej samej wielkości.
  if (!window.pdfjsLib) await new Promise((ok, blad) => { const s = document.createElement('script'); s.src = pdfjs; s.onload = ok; s.onerror = blad; document.head.append(s); });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = watek;
  const dok = await window.pdfjsLib.getDocument({ data: bajty.slice() }).promise;
  const str = await dok.getPage(1);
  const SZER = 620;
  const widok = str.getViewport({ scale: SZER / str.getViewport({ scale: 1 }).width });
  const a = Object.assign(document.createElement('canvas'), { width: Math.round(widok.width), height: Math.round(widok.height) });
  await str.render({ canvasContext: a.getContext('2d'), viewport: widok }).promise;
  const tekst = (await str.getTextContent()).items.map((i) => i.str).join('');
  const wzor = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); renderujCel(stan.projekt, stan.projekt.strony[0], { szerokoscPx: a.width, spad: true, oryginaly: true }).then((u) => { i.src = u; }); });
  const b = Object.assign(document.createElement('canvas'), { width: a.width, height: a.height });
  b.getContext('2d').drawImage(wzor, 0, 0, a.width, a.height);
  // Porównanie po uśrednieniu kwadratów 4×4 px – wygładzanie krawędzi w obu programach jest inne.
  const maly = (c) => { const m = Object.assign(document.createElement('canvas'), { width: Math.round(c.width / 4), height: Math.round(c.height / 4) }); const x = m.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, m.width, m.height); return x.getImageData(0, 0, m.width, m.height); };
  const da = maly(a); const db = maly(b);
  let suma = 0; let rozne = 0;
  const kolor = (d, x, y) => { const p = (Math.round(y * d.height / a.height) * d.width + Math.round(x * d.width / a.width)) * 4; return [d.data[p], d.data[p + 1], d.data[p + 2]]; };
  for (let i = 0; i < da.data.length; i += 4) {
    const r = (Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2])) / 3;
    suma += r; if (r > 48) rozne += 1;
  }
  const piks = da.data.length / 4;
  const skala = a.width / 154; // strona 148 mm + 2 × 3 mm spadu
  const wPunkcie = (mmX, mmY) => kolor(da, (mmX + 3) * skala, (mmY + 3) * skala);
  return {
    nazwa: wynik.nazwa, uwagi: wynik.uwagi, rozmiar: bajty.length, stron: pdf.getPageCount(),
    // Ile plików czcionek i obrazów jest w całym dokumencie (każdy powinien być osadzony raz, niezależnie od liczby stron).
    plikiCzcionek: pdf.context.enumerateIndirectObjects().filter(([, o]) => o instanceof PDFDict && String(o.get(PDFName.of('Type'))) === '/FontDescriptor').length,
    plikiObrazow: pdf.context.enumerateIndirectObjects().filter(([, o]) => o.dict && String(o.dict.get(PDFName.of('Subtype'))) === '/Image' && !o.dict.get(PDFName.of('SMask'))?.toString().includes('null') && String(o.dict.get(PDFName.of('ColorSpace'))) !== '/DeviceGray').length,
    jpeg: pdf.context.enumerateIndirectObjects().filter(([, o]) => o.dict && String(o.dict.get(PDFName.of('Filter'))) === '/DCTDecode').map(([, o]) => o.contents.length),
    czcionki: ile('Font'), obrazy: ile('XObject'), gradienty: ile('Shading'),
    tekstowe: liczba(/\bTJ\b/g), rgb: liczba(/\brg\b/g), cmyk: liczba(/ k\b/g), krzywe: liczba(/ c\b/g),
    tekst, srednia: suma / piks, rozne: rozne / piks,
    pas: wPunkcie(70, 8), zolty: wPunkcie(35, 108), polprzezroczysty: wPunkcie(126, 106), cien: wPunkcie(35, 155),
  };
}, [opcje, PDFJS, PDFJS_WATEK]);

test('PDF wektorowy: prawdziwy tekst z osadzonymi czcionkami, kształty, gradient, lista – obraz zgodny z aplikacją', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wektor');
  await strona.evaluate(async (obiekty) => {
    const { stan, zapiszTeraz, przeladuj } = window.seriodruk;
    await zapiszTeraz();
    stan.projekt.strony[0].obiekty = obiekty.map((o) => ({ version: '5.3.0', ...o }));
    await przeladuj();
    await document.fonts.ready;
  }, OBIEKTY);

  const w = await eksportuj(strona, { tryb: 'wektor', dpi: 150 });
  assert.equal(w.nazwa, 'Wektor.pdf');
  assert.equal(w.stron, 1);
  // Lora pogrubiona, Inter, Open Sans zwykła i kursywa, Montserrat – każda odmiana osadzona raz.
  assert.equal(w.czcionki, 5, 'osadzone czcionki');
  assert.ok(w.tekstowe >= 8, `tekst jest tekstem (${w.tekstowe} poleceń TJ)`);
  assert.equal(w.gradienty, 1);
  assert.equal(w.obrazy, 1, 'jedynym obrazem jest element z cieniem');
  assert.deepEqual(w.uwagi, [['cień', 1]]);
  // Tekst da się odczytać z pliku – razem z polskimi znakami, numerami listy i wielkimi literami jako wyglądem.
  for (const fragment of ['Zażółć gęślą jaźń – „Święto” 2026', '1.', '2.', '3.', 'Drugi punkt', 'kursywą', 'WIELKIE LITERY JAKO WYGLĄD']) {
    assert.ok(w.tekst.replace(/\s+/g, ' ').includes(fragment) || w.tekst.replace(/\s+/g, '').includes(fragment.replace(/\s+/g, '')), `w pliku jest tekst „${fragment}”: ${w.tekst}`);
  }
  // Kolory w wybranych miejscach i cała strona w porównaniu z obrazem z aplikacji.
  const blisko = (a, b, tol = 12) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  assert.ok(blisko(w.pas, [200, 16, 46]), `czerwony pas: ${w.pas}`);
  assert.ok(blisko(w.zolty, [255, 209, 102]), `żółty prostokąt: ${w.zolty}`);
  assert.ok(blisko(w.polprzezroczysty, [131, 157, 165]), `półprzezroczysty prostokąt: ${w.polprzezroczysty}`);
  assert.ok(blisko(w.cien, [131, 56, 236]), `element z cieniem: ${w.cien}`);
  assert.ok(w.srednia < 2.5, `średnia różnica obrazu ${w.srednia.toFixed(2)}`);
  assert.ok(w.rozne < 0.004, `odsetek wyraźnie różnych miejsc ${(w.rozne * 100).toFixed(2)}%`);

  // Tekst na krzywe: żadnych czcionek w pliku, litery są kształtami; obraz ten sam.
  const k = await eksportuj(strona, { tryb: 'wektor', krzywe: true, dpi: 150 });
  assert.equal(k.czcionki, 0);
  assert.equal(k.tekstowe, 0);
  assert.ok(k.krzywe > w.krzywe + 200, 'litery jako krzywe');
  assert.equal(k.tekst.trim(), '');
  assert.ok(k.srednia < 2.5 && k.rozne < 0.004, `obraz po zamianie na krzywe: ${k.srednia.toFixed(2)}, ${(k.rozne * 100).toFixed(2)}%`);

  // CMYK: kolory tekstu i kształtów zapisane czterema składowymi.
  const c = await eksportuj(strona, { tryb: 'wektor', cmyk: true, dpi: 150 });
  assert.equal(c.rgb, 0);
  assert.ok(c.cmyk >= w.rgb, 'kolory w CMYK');

  // Obrazy stron – dotychczasowy rodzaj pliku – zostaje.
  const o = await eksportuj(strona, { tryb: 'obraz', dpi: 150 });
  assert.equal(o.czcionki, 0);
  assert.equal(o.obrazy, 1);
  assert.equal(o.tekst.trim(), '');
  assert.ok(o.rozmiar > 0);
  assert.deepEqual(bledy, []);
});

test('PDF wektorowy: zdjęcia w oryginale z kadrem, grupy i ścieżki, własne czcionki; czego nie da się osadzić, idzie jako obraz', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wektor 2');
  const TTF = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'css', 'czcionki', 'pdf', 'playfair-display-400-prosta.ttf')).toString('base64');
  const WOFF2 = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'css', 'czcionki', 'caveat-prosta-400-700-latin.woff2')).toString('base64');
  const rozmiarJpeg = await strona.evaluate(async ([ttf, woff2]) => {
    const { stan, edytor, zapiszTeraz, przeladuj, oknoCzcionek } = window.seriodruk;
    const plik = (b64, nazwa, typ) => new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], nazwa, { type: typ });
    // Własne czcionki: plik TTF (da się osadzić) i WOFF2 (nie da się – tekst pójdzie jako obraz).
    const [ozdobna] = await oknoCzcionek.dodaj([plik(ttf, 'Ozdobna-Regular.ttf', 'font/ttf')]);
    await oknoCzcionek.zmienRodzine(ozdobna.id, 'Ozdobna');
    await oknoCzcionek.dodaj([plik(woff2, 'Odreczna-Regular.woff2', 'font/woff2')]);
    // Zdjęcie JPEG w czterech kolorach i PNG z przezroczystością.
    const c = Object.assign(document.createElement('canvas'), { width: 400, height: 200 });
    const x = c.getContext('2d');
    [['#e63946', 0, 0], ['#2a9d8f', 200, 0], ['#e9c46a', 0, 100], ['#264653', 200, 100]].forEach(([k, px, py]) => { x.fillStyle = k; x.fillRect(px, py, 200, 100); });
    const jpeg = c.toDataURL('image/jpeg', 0.95);
    const p = Object.assign(document.createElement('canvas'), { width: 120, height: 120 });
    const y = p.getContext('2d'); y.fillStyle = '#ff006e'; y.beginPath(); y.arc(60, 60, 55, 0, Math.PI * 2); y.fill();
    const zdjecie = await edytor.dodajObraz(jpeg, 'kolory.jpg', stan.projekt.zasoby);
    // Kadr: prawa połowa zdjęcia, obrócona.
    zdjecie.set({ left: 20, top: 15, scaleX: 0.25, scaleY: 0.25, cropX: 200, width: 200, angle: 10 });
    const kolo = await edytor.dodajObraz(p.toDataURL('image/png'), 'kolo.png', stan.projekt.zasoby);
    kolo.set({ left: 95, top: 15, scaleX: 0.3, scaleY: 0.3 });
    edytor.zatwierdz();
    await zapiszTeraz();
    stan.projekt.strony[0].obiekty.unshift({ type: 'rect', version: '5.3.0', left: 85, top: 10, width: 55, height: 50, fill: '#3a86ff', id: 'tlo' });
    stan.projekt.strony[0].obiekty.push(
      { type: 'group', version: '5.3.0', left: 20, top: 80, width: 50, height: 20, angle: -5, id: 'grupa', objects: [
        { type: 'rect', version: '5.3.0', left: -25, top: -10, width: 25, height: 20, fill: '#06d6a0' },
        { type: 'ellipse', version: '5.3.0', left: 0, top: -10, rx: 12.5, ry: 10, fill: '#118ab2' }] },
      { type: 'polygon', version: '5.3.0', left: 90, top: 75, points: [{ x: 0, y: 30 }, { x: 15, y: 0 }, { x: 30, y: 30 }], fill: '#ffbe0b', stroke: '#000000', strokeWidth: 0.6, id: 'trojkat' },
      { type: 'path', version: '5.3.0', left: 20, top: 115, path: [['M', 0, 20], ['Q', 30, -20, 60, 20], ['L', 100, 0]], fill: '', stroke: '#d00000', strokeWidth: 1.5, strokeLineCap: 'round', id: 'rysunek' },
      { type: 'textbox', version: '5.3.0', left: 20, top: 145, width: 110, text: 'Własna czcionka z pliku TTF', fontSize: 7, fontFamily: 'Ozdobna', fill: '#000000', styles: [], id: 't1' },
      { type: 'textbox', version: '5.3.0', left: 20, top: 160, width: 110, text: 'Czcionka WOFF2 idzie jako obraz', fontSize: 7, fontFamily: 'Odreczna', fill: '#000000', styles: [], id: 't2' },
      { type: 'textbox', version: '5.3.0', left: 20, top: 175, width: 110, text: 'Kursywa, której czcionka nie ma', fontSize: 7, fontFamily: 'Caveat', fontStyle: 'italic', fill: '#000000', styles: [], id: 't3' },
      { type: 'textbox', version: '5.3.0', left: 20, top: 190, width: 110, text: 'Znak spoza czcionki: Ж', fontSize: 6, fontFamily: 'Inter', fill: '#000000', styles: [], id: 't4' },
    );
    // Seria: ta sama strona trzy razy – zasoby w pliku mają być osadzone raz.
    stan.projekt.serie.push({ id: 'se1', nazwa: 'Trzy', tabela: null, tryb: 'stala', ile: 3, uklad: 'szeroki' });
    stan.projekt.strony[0].seria = 'se1';
    await przeladuj();
    await document.fonts.ready;
    return (await (await fetch(jpeg)).blob()).size;
  }, [TTF, WOFF2]);

  const w = await eksportuj(strona, { tryb: 'wektor', dpi: 150 });
  assert.equal(w.stron, 3);
  assert.deepEqual(w.uwagi.map(([powod, n]) => [powod.replace(/ – .*/, ''), n]).sort(), [
    ['znaku „Ж” nie ma w czcionce „Inter”', 3],
    ['„Caveat” nie ma kursywy', 3],
    ['„Odreczna” jest w formacie WOFF2', 3],
  ]);
  assert.equal(w.czcionki, 1, 'na stronie jest jedna osadzona czcionka – własna z pliku TTF');
  assert.equal(w.plikiCzcionek, 1, 'plik czcionki jest w dokumencie raz, choć stron jest trzy');
  assert.deepEqual(w.jpeg, [rozmiarJpeg], 'zdjęcie JPEG jest w pliku raz i bez ponownej kompresji');
  assert.ok(w.tekst.includes('Własna czcionka z pliku TTF'));
  assert.ok(!w.tekst.includes('WOFF2'), 'tekst zapisany jako obraz nie jest tekstem');
  assert.ok(w.srednia < 2.5, `średnia różnica obrazu ${w.srednia.toFixed(2)}`);
  assert.ok(w.rozne < 0.004, `odsetek wyraźnie różnych miejsc ${(w.rozne * 100).toFixed(2)}%`);

  // Okno eksportu: rodzaj pliku i opcje; po eksporcie informacja, co poszło jako obraz.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  assert.equal(await strona.inputValue('#form-pdf select[name=tryb]'), 'wektor');
  assert.ok(await strona.isVisible('#pdf-opcje-wektora'));
  assert.match(await strona.textContent('#pdf-opis-trybu'), /prawdziwym tekstem z osadzonymi czcionkami/);
  await strona.selectOption('#form-pdf select[name=tryb]', 'obraz');
  assert.ok(await strona.isHidden('#pdf-opcje-wektora'));
  assert.match(await strona.textContent('#pdf-opis-trybu'), /jednym obrazem/);
  await strona.selectOption('#form-pdf select[name=tryb]', 'wektor');
  await strona.check('#form-pdf input[name=krzywe]');
  assert.match(await strona.textContent('#pdf-opis-trybu'), /zamieniony na kształty liter/);
  await strona.uncheck('#form-pdf input[name=krzywe]');
  await strona.selectOption('#form-pdf select[name=dpi]', '150');
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  assert.equal(plik.suggestedFilename(), 'Wektor 2.pdf');
  await strona.waitForSelector('#dlg-pdf', { state: 'hidden' });
  assert.match(await strona.textContent('#powiadomienie'), /Jako obraz zapisanych zostało 9 elementów: .*WOFF2.*\(3\)/);
  assert.deepEqual(bledy, []);
});
