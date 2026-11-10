const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Czytnik PDF do sprawdzenia wyniku: plik jest rysowany niezależnym programem i porównywany z tym, co rysuje aplikacja.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WATEK = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Pomiary zgodności obrazu trafiają do pliku – na serwerze testów wypisuje go ostatni krok.
const zapiszPomiar = (nazwa, w) => require('node:fs').appendFileSync(require('node:path').join(__dirname, '.pomiary-pdf.txt'),
  `${nazwa.slice(0, 60)} | ${w.przegladarka} | średnia ${w.srednia.toFixed(3)} | różne ${(w.rozne * 100).toFixed(3)}%${w.ksztalt == null ? '' : ` | kształt liter ${(w.ksztalt * 100).toFixed(3)}%`} | pasy co 10 mm: ${w.pasy.join(' ')}\n`);

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
// punkty: true – dodatkowo porównanie punkt po punkcie (kształt liter), nie tylko uśrednionych kwadratów.
const eksportuj = (strona, opcje, { punkty = false } = {}) => strona.evaluate(async ([o, pdfjs, watek, punktPoPunkcie]) => {
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
  // Duży obraz: przy małym przeglądarka testowa potrafi ustawiać litery co do całego piksela i wtedy obraz
  // z aplikacji różni się od PDF samym wygładzaniem, nie treścią.
  const SZER = 1860;
  const widok = str.getViewport({ scale: SZER / str.getViewport({ scale: 1 }).width });
  const a = Object.assign(document.createElement('canvas'), { width: Math.round(widok.width), height: Math.round(widok.height) });
  await str.render({ canvasContext: a.getContext('2d'), viewport: widok }).promise;
  const tekst = (await str.getTextContent()).items.map((i) => i.str).join('');
  const wzor = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); renderujCel(stan.projekt, stan.projekt.strony[0], { szerokoscPx: a.width, spad: true, oryginaly: true }).then((u) => { i.src = u; }); });
  const b = Object.assign(document.createElement('canvas'), { width: a.width, height: a.height });
  b.getContext('2d').drawImage(wzor, 0, 0, a.width, a.height);
  // Porównanie po uśrednieniu kwadratów 12×12 px (ok. 1 mm strony) – wygładzanie krawędzi w obu programach jest inne.
  const maly = (c) => { const m = Object.assign(document.createElement('canvas'), { width: Math.round(c.width / 12), height: Math.round(c.height / 12) }); const x = m.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, m.width, m.height); return x.getImageData(0, 0, m.width, m.height); };
  const da = maly(a); const db = maly(b);
  let suma = 0; let rozne = 0;
  const kolor = (d, x, y) => { const p = (Math.round(y * d.height / a.height) * d.width + Math.round(x * d.width / a.width)) * 4; return [d.data[p], d.data[p + 1], d.data[p + 2]]; };
  for (let i = 0; i < da.data.length; i += 4) {
    const r = (Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2])) / 3;
    suma += r; if (r > 48) rozne += 1;
  }
  const piks = da.data.length / 4;
  // Średnia różnica w poziomych pasach strony po 10 mm – pokazuje, którego elementu dotyczy rozbieżność.
  const pasy = [];
  const naPas = Math.max(1, Math.round((10 * (a.width / 154)) / 12));
  for (let y0 = 0; y0 < da.height; y0 += naPas) {
    let sumaPasa = 0; let n = 0;
    for (let y = y0; y < Math.min(da.height, y0 + naPas); y += 1) for (let x = 0; x < da.width; x += 1) { const i = (y * da.width + x) * 4; sumaPasa += (Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2])) / 3; n += 1; }
    pasy.push(Math.round((sumaPasa / n) * 10) / 10);
  }
  // Kształt liter, punkt po punkcie: odsetek ciemnych punktów (tekstu), które w drugim obrazie nie mają ciemnego
  // punktu w promieniu 2 px. Przesunięcie o punkt i inne wygładzanie krawędzi nic tu nie zmieniają; litery o innym
  // kształcie (np. osobne „f” i „i” zamiast ligatury, kropka nad „i”) dają wyraźny odsetek.
  let ksztalt = null;
  if (punktPoPunkcie) {
    const jasnosc = (c) => { const d = c.getContext('2d').getImageData(0, 0, a.width, a.height).data; const j = new Uint8Array(d.length / 4); for (let i = 0; i < j.length; i += 1) j[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3; return j; };
    const ja = jasnosc(a); const jb = jasnosc(b);
    let tusz = 0; let inne = 0;
    const brakObok = (obraz, x, y) => { for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (obraz[(y + dy) * a.width + x + dx] < 160) return false; return true; };
    for (let y = 2; y < a.height - 2; y += 1) {
      for (let x = 2; x < a.width - 2; x += 1) {
        const i = y * a.width + x;
        if (ja[i] < 96) { tusz += 1; if (brakObok(jb, x, y)) inne += 1; }
        if (jb[i] < 96) { tusz += 1; if (brakObok(ja, x, y)) inne += 1; }
      }
    }
    ksztalt = inne / tusz;
  }
  const skala = a.width / 154; // strona 148 mm + 2 × 3 mm spadu
  const wPunkcie = (mmX, mmY) => kolor(da, (mmX + 3) * skala, (mmY + 3) * skala);
  return {
    nazwa: wynik.nazwa, uwagi: wynik.uwagi, jakoKrzywe: wynik.krzywe, ligatury: wynik.ligatury, rozmiar: bajty.length, stron: pdf.getPageCount(),
    // Ile plików czcionek i obrazów jest w całym dokumencie (każdy powinien być osadzony raz, niezależnie od liczby stron).
    plikiCzcionek: pdf.context.enumerateIndirectObjects().filter(([, o]) => o instanceof PDFDict && String(o.get(PDFName.of('Type'))) === '/FontDescriptor').length,
    plikiObrazow: pdf.context.enumerateIndirectObjects().filter(([, o]) => o.dict && String(o.dict.get(PDFName.of('Subtype'))) === '/Image' && !o.dict.get(PDFName.of('SMask'))?.toString().includes('null') && String(o.dict.get(PDFName.of('ColorSpace'))) !== '/DeviceGray').length,
    jpeg: pdf.context.enumerateIndirectObjects().filter(([, o]) => o.dict && String(o.dict.get(PDFName.of('Filter'))) === '/DCTDecode').map(([, o]) => o.contents.length),
    czcionki: ile('Font'), obrazy: ile('XObject'), gradienty: ile('Shading'),
    tekstowe: liczba(/\bTJ\b/g), rgb: liczba(/\brg\b/g), cmyk: liczba(/ k\b/g), krzywe: liczba(/ c\b/g),
    tekst, srednia: suma / piks, rozne: rozne / piks, ksztalt, pasy, przegladarka: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0],
    pas: wPunkcie(70, 8), zolty: wPunkcie(35, 108), polprzezroczysty: wPunkcie(126, 106), cien: wPunkcie(35, 155),
  };
}, [opcje, PDFJS, PDFJS_WATEK, punkty]);

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
  assert.deepEqual(w.jakoKrzywe, [], 'wszystkie czcionki tej strony dało się osadzić');
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
  zapiszPomiar(t.name, w);
  assert.ok(w.srednia < 2.5, `średnia różnica obrazu ${w.srednia.toFixed(2)}`);
  assert.ok(w.rozne < 0.005, `odsetek wyraźnie różnych miejsc ${(w.rozne * 100).toFixed(2)}%`);

  // Tekst na krzywe: żadnych czcionek w pliku, litery są kształtami; obraz ten sam.
  const k = await eksportuj(strona, { tryb: 'wektor', krzywe: true, dpi: 150 });
  assert.equal(k.czcionki, 0);
  assert.equal(k.tekstowe, 0);
  assert.ok(k.krzywe > w.krzywe + 200, 'litery jako krzywe');
  assert.equal(k.tekst.trim(), '');
  zapiszPomiar(`${t.name} (krzywe)`, k);
  assert.ok(k.srednia < 2.5 && k.rozne < 0.005, `obraz po zamianie na krzywe: ${k.srednia.toFixed(2)}, ${(k.rozne * 100).toFixed(2)}%`);

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
    // Własne czcionki: plik TTF (da się osadzić) i WOFF2 (nie da się osadzić – tekst pójdzie jako krzywe).
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
      { type: 'textbox', version: '5.3.0', left: 20, top: 160, width: 110, text: 'Czcionka WOFF2 idzie jako krzywe', fontSize: 7, fontFamily: 'Odreczna', fill: '#000000', styles: [], id: 't2' },
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
  // Jako obraz idzie tylko tekst ze znakiem spoza czcionki. Czcionka z pliku WOFF2 i kursywa, której czcionka
  // nie ma (przeglądarka pochyla pismo proste), są zapisane jako krzywe – ostre, ale nie do zaznaczenia.
  assert.deepEqual(w.uwagi, [['znaku „Ж” nie ma w czcionce „Inter”', 3]]);
  assert.deepEqual([...w.jakoKrzywe].sort(), [['„Caveat” (kursywa bez własnego pliku)', 3], ['„Odreczna” (plik WOFF2)', 3]]);
  assert.equal(w.obrazy, 3, 'zdjęcie, koło PNG i jeden tekst jako obraz – teksty zapisane krzywymi nie są obrazami');
  assert.equal(w.czcionki, 1, 'na stronie jest jedna osadzona czcionka – własna z pliku TTF');
  assert.equal(w.plikiCzcionek, 1, 'plik czcionki jest w dokumencie raz, choć stron jest trzy');
  assert.deepEqual(w.jpeg, [rozmiarJpeg], 'zdjęcie JPEG jest w pliku raz i bez ponownej kompresji');
  assert.ok(w.tekst.includes('Własna czcionka z pliku TTF'));
  assert.ok(!w.tekst.includes('WOFF2') && !w.tekst.includes('Kursywa'), 'tekst zapisany krzywymi nie jest tekstem do zaznaczenia');
  zapiszPomiar(t.name, w);
  assert.ok(w.srednia < 2.5, `średnia różnica obrazu ${w.srednia.toFixed(2)}`);
  assert.ok(w.rozne < 0.005, `odsetek wyraźnie różnych miejsc ${(w.rozne * 100).toFixed(2)}%`);

  // Okno eksportu: rodzaj pliku i opcje; po eksporcie informacja, co poszło jako obraz.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  assert.equal(await strona.inputValue('#form-pdf select[name=tryb]'), 'wektor');
  assert.ok(await strona.isVisible('#pdf-opcje-wektora'));
  assert.match(await strona.textContent('#pdf-opis-trybu'), /prawdziwym tekstem z osadzonymi czcionkami/);
  await strona.selectOption('#form-pdf select[name=tryb]', 'obraz');
  assert.ok(await strona.isHidden('#pdf-opcje-wektora'));
  assert.ok(await strona.isChecked('#form-pdf input[name=czcionki]'), 'plik bez czcionek w środku: pliki czcionek dołączają się same');
  assert.match(await strona.textContent('#pdf-opis-trybu'), /jednym obrazem/);
  await strona.selectOption('#form-pdf select[name=tryb]', 'wektor');
  await strona.check('#form-pdf input[name=krzywe]');
  assert.match(await strona.textContent('#pdf-opis-trybu'), /zamieniony na kształty liter/);
  await strona.uncheck('#form-pdf input[name=krzywe]');
  assert.ok(!(await strona.isChecked('#form-pdf input[name=czcionki]')), 'PDF z osadzonymi czcionkami nie potrzebuje plików obok');
  await strona.selectOption('#form-pdf select[name=dpi]', '150');
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  assert.equal(plik.suggestedFilename(), 'Wektor 2.pdf');
  await strona.waitForSelector('#dlg-pdf', { state: 'hidden' });
  assert.match(await strona.textContent('#powiadomienie'), /Jako obraz zapisane zostały 3 elementy: znaku „Ж” .*\(3\)\. Tekst jako krzywe \(nie da się go zaznaczyć\) w 6 elementach: .*plik WOFF2\) \(3\)/);
  assert.deepEqual(bledy, []);
});

test('PDF wektorowy: rysunek SVG idzie jako wektor (kadr, obrót, gradient); rysunek z filtrem zostaje obrazem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wektor 3');
  await strona.evaluate(async () => {
    const { stan, edytor, zapiszTeraz } = window.seriodruk;
    const adres = (kod) => `data:image/svg+xml;base64,${btoa(kod)}`;
    // Rysunek z przesuniętym viewBox, innymi proporcjami niż wymiar (preserveAspectRatio), grupą z przekształceniem,
    // gradientem, obrysem i krzywą.
    const rysunek = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="10 20 300 150">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#ef476f"/></linearGradient></defs>
      <rect x="10" y="20" width="300" height="150" fill="#e8f1ff"/>
      <rect x="30" y="40" width="120" height="60" rx="10" fill="url(#g)" stroke="#073b4c" stroke-width="5"/>
      <g transform="translate(220 95) rotate(20)"><ellipse cx="0" cy="0" rx="60" ry="35" fill="#06d6a0"/><polygon points="-20,-15 25,0 -20,15" fill="#ffffff"/></g>
      <path d="M30 150 C 90 90, 150 190, 290 120" fill="none" stroke="#d00000" stroke-width="6" stroke-linecap="round"/>
      <circle cx="285" cy="45" r="15" fill="#118ab2" fill-opacity="0.6"/>
    </svg>`;
    const zFiltrem = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><defs><filter id="f"><feGaussianBlur stdDeviation="4"/></filter></defs><rect x="20" y="15" width="80" height="50" fill="#8338ec" filter="url(#f)"/></svg>`;
    const a = await edytor.dodajObraz(adres(rysunek), 'rysunek.svg', stan.projekt.zasoby);
    a.set({ left: 15, top: 20, scaleX: 0.5, scaleY: 0.5 });
    // Ten sam rysunek drugi raz: obrócony i wykadrowany do prawej części.
    const b = await edytor.dodajObraz(adres(rysunek), 'rysunek.svg', stan.projekt.zasoby);
    b.set({ left: 30, top: 115, scaleX: 0.45, scaleY: 0.45, cropX: 90, cropY: 20, width: 150, height: 130, angle: -8 });
    const c = await edytor.dodajObraz(adres(zFiltrem), 'filtr.svg', stan.projekt.zasoby);
    c.set({ left: 85, top: 180, scaleX: 0.4, scaleY: 0.4 });
    edytor.canvas.discardActiveObject();
    edytor.zatwierdz();
    await zapiszTeraz();
  });

  const w = await eksportuj(strona, { tryb: 'wektor', dpi: 150 });
  assert.equal(w.obrazy, 1, 'obrazem jest tylko rysunek z filtrem');
  assert.deepEqual(w.uwagi, [['rysunek SVG z elementem „filter”', 1]]);
  assert.deepEqual(w.jakoKrzywe, []);
  assert.equal(w.gradienty, 2, 'gradient rysunku jest gradientem PDF (rysunek jest na stronie dwa razy)');
  assert.ok(w.krzywe > 20, `kształty rysunku są krzywymi PDF (${w.krzywe})`);
  zapiszPomiar(t.name, w);
  assert.ok(w.srednia < 2.5, `średnia różnica obrazu ${w.srednia.toFixed(2)}`);
  assert.ok(w.rozne < 0.005, `odsetek wyraźnie różnych miejsc ${(w.rozne * 100).toFixed(2)}%`);
  // Okno eksportu mówi, co poszło jako obraz.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  await strona.selectOption('#form-pdf select[name=dpi]', '150');
  await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  await strona.waitForSelector('#dlg-pdf', { state: 'hidden' });
  assert.match(await strona.textContent('#powiadomienie'), /Jako obraz zapisany został 1 element: rysunek SVG z elementem „filter”\.$/);
  assert.deepEqual(bledy, []);
});

// Ligatury: „fi”, „fl”, „ff” przeglądarka rysuje w wielu czcionkach jednym, połączonym znakiem. PDF ma wyglądać
// tak samo, a tekst ma się dać zaznaczyć i wyszukać zwykłymi literami.
const LIGATURY = [
  { type: 'textbox', left: 10, top: 8, width: 130, text: 'oficjalny finał – refleks', fontSize: 11, fontFamily: 'Lora', fill: '#111111', styles: [], id: 'l1' },
  { type: 'textbox', left: 10, top: 30, width: 130, text: 'grafika, fiolet, offline', fontSize: 11, fontFamily: 'Playfair Display', fill: '#1a3c8f', styles: [], id: 'l2' },
  { type: 'textbox', left: 10, top: 52, width: 130, text: 'fikcja i flet, efekt', fontSize: 11, fontFamily: 'Lora', fontStyle: 'italic', fontWeight: 'bold', fill: '#7a1f1f', styles: [], id: 'l3' },
  // Wyjustowany akapit: przeglądarka rysuje go słowo po słowie – ligatury zostają w środku słów.
  { type: 'textbox', left: 10, top: 76, width: 62, text: 'Szefowa firmy „Flora” oferuje fioletowe fiołki, flamastry i grafiki; efekt finalny bywa oficjalnie różny, a refleksje – ulotne.', fontSize: 5.5, fontFamily: 'EB Garamond', textAlign: 'justify', fill: '#222222', styles: [], id: 'l4' },
  // Litery rozstrzelone: przeglądarka rysuje każdą osobno, bez ligatur – w PDF też.
  { type: 'textbox', left: 78, top: 76, width: 62, text: 'fiolet i flaga', fontSize: 8, fontFamily: 'Lora', charSpacing: 120, fill: '#222222', styles: [], id: 'l5' },
  // Zmiana wyglądu w środku „fi” (pogrubione samo „f”) rozdziela ligaturę; w drugim słowie zostaje.
  { type: 'textbox', left: 78, top: 92, width: 62, text: 'finał filmu', fontSize: 8, fontFamily: 'EB Garamond', fill: '#222222', id: 'l6', styles: [{ start: 0, end: 1, style: { fontWeight: 'bold' } }] },
  // Czcionka bez ligatur w tych miejscach.
  { type: 'textbox', left: 10, top: 122, width: 130, text: 'Inter: oficjalny finał – refleks', fontSize: 8, fontFamily: 'Inter', fill: '#111111', styles: [], id: 'l7' },
  { type: 'textbox', left: 10, top: 140, width: 130, text: 'AVATAR Tofu: kerning', fontSize: 12, fontFamily: 'Playfair Display', fill: '#111111', styles: [], id: 'l8' },
];

test('PDF wektorowy: ligatury wyglądają jak na ekranie, a tekst zostaje zwykłymi literami', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Ligatury');
  await strona.evaluate(async (obiekty) => {
    const { stan, zapiszTeraz, przeladuj } = window.seriodruk;
    await zapiszTeraz();
    stan.projekt.strony[0].obiekty = obiekty.map((o) => ({ version: '5.3.0', ...o }));
    await przeladuj();
    await document.fonts.ready;
  }, LIGATURY);

  const w = await eksportuj(strona, { tryb: 'wektor', dpi: 150 }, { punkty: true });
  assert.deepEqual(w.uwagi, [], 'cała strona jest wektorowa');
  assert.deepEqual(w.jakoKrzywe, []);
  // Lora: fi, fi, fl; Playfair Display: fi, fi i zlepek w „offline”; kursywa pogrubiona: fi, fl; do tego wyjustowany akapit i „filmu”.
  assert.ok(w.ligatury >= 12, `w pliku są ligatury (${w.ligatury})`);
  // Tekst odczytany czytnikiem PDF to zwykłe litery – także tam, gdzie na stronie stoi ligatura.
  const bezOdstepow = w.tekst.replace(/\s+/g, '');
  for (const fragment of ['oficjalny finał – refleks', 'grafika, fiolet, offline', 'fikcja i flet, efekt', 'fioletowe fiołki, flamastry i grafiki', 'efekt finalny bywa oficjalnie', 'fiolet i flaga', 'finał filmu', 'Inter: oficjalny finał – refleks', 'AVATAR Tofu: kerning']) {
    assert.ok(bezOdstepow.includes(fragment.replace(/\s+/g, '')), `w pliku jest tekst „${fragment}”: ${w.tekst}`);
  }
  assert.ok(!/[\ufb00-\ufb06]/.test(w.tekst), 'w odczytanym tekście nie ma znaków-ligatur');
  zapiszPomiar(t.name, w);
  assert.ok(w.srednia < 2.5, `średnia różnica obrazu ${w.srednia.toFixed(2)}`);
  assert.ok(w.rozne < 0.005, `odsetek wyraźnie różnych miejsc ${(w.rozne * 100).toFixed(2)}%`);
  // Kształt liter punkt po punkcie: bez ligatur ten odsetek wynosi tu ok. 0,3%, z ligaturami – zero.
  assert.ok(w.ksztalt < 0.001, `litery mają ten sam kształt co w aplikacji (${(w.ksztalt * 100).toFixed(3)}% punktów inaczej)`);

  // Tekst na krzywe: te same ligatury jako kształty.
  const k = await eksportuj(strona, { tryb: 'wektor', krzywe: true, dpi: 150 }, { punkty: true });
  assert.equal(k.czcionki, 0);
  assert.equal(k.ligatury, w.ligatury, 'po zamianie na krzywe ligatur jest tyle samo');
  zapiszPomiar(`${t.name} (krzywe)`, k);
  assert.ok(k.srednia < 2.5 && k.rozne < 0.005, `obraz po zamianie na krzywe: ${k.srednia.toFixed(2)}, ${(k.rozne * 100).toFixed(2)}%`);
  assert.ok(k.ksztalt < 0.001, `kształt liter po zamianie na krzywe (${(k.ksztalt * 100).toFixed(3)}% punktów inaczej)`);
  assert.deepEqual(bledy, []);
});
