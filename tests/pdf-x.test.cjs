const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WATEK = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const PROFIL_NIEPOWLEKANY = fs.readFileSync(path.join(__dirname, '..', 'css', 'profile', 'PSO_Uncoated_ISO12647_eci.icc'));

test('profil drukarski (obliczenia): kolory wzorcowe sRGB → CMYK przez profil, szarości samą czernią, piksele zdjęcia', async (t) => {
  const { strona } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const { czytajProfil, SilnikCmyk, profilSrgb, WARUNKI_DRUKU } = await import('./js/profil-icc.js');
    const wynik = {};
    for (const [klucz, warunki] of Object.entries(WARUNKI_DRUKU)) {
      const profil = czytajProfil(await (await fetch(warunki.plik)).arrayBuffer());
      const s = new SilnikCmyk(profil);
      const roznica = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      // Kolor mieszczący się w druku po przeliczeniu ma na papierze wyglądać tak samo (ΔE – różnica barwy).
      const tamIZPowrotem = (r, g, b) => roznica(s._cel(r, g, b), s.lab(...s.cmyk(r, g, b)));
      // Piksele zdjęcia idą przez gotową siatkę – wynik ma być taki jak przy dokładnym przeliczeniu.
      const kolory = [[200, 16, 46], [26, 60, 143], [255, 209, 102], [120, 120, 120], [3, 250, 7], [255, 255, 255], [0, 0, 0], [31, 200, 180]];
      const cmyk = s.obraz(new Uint8ClampedArray(kolory.flatMap((k) => [...k, 255])));
      const odchylenie = Math.max(...kolory.map((k, i) => Math.max(...s.cmyk(k[0] / 255, k[1] / 255, k[2] / 255).map((v, j) => Math.abs(Math.min(1, Math.max(0, v)) * 255 - cmyk[i * 4 + j])))));
      wynik[klucz] = {
        opis: profil.opis, klasa: profil.klasa, przestrzen: profil.przestrzen,
        bialy: s.cmyk(1, 1, 1), czarny: s.cmyk(0, 0, 0), czerwony: s.cmyk(1, 0, 0), zielony: s.cmyk(0, 1, 0), niebieski: s.cmyk(0, 0, 1),
        szaryZdjecie: s.lab(...s.cmyk(0.5, 0.5, 0.5)), szaryCel: s._cel(0.5, 0.5, 0.5),
        tekstCzarny: s.wektor(0, 0, 0), tekstBialy: s.wektor(1, 1, 1), tekstSzary: s.wektor(0.5, 0.5, 0.5), tekstSzaryNaPapierze: s.lab(...s.wektor(0.5, 0.5, 0.5)),
        tekstKolor: s.wektor(0.1, 0.23, 0.56),
        wGamucie: [[0.9, 0.82, 0.7], [0.1, 0.23, 0.56], [0.78, 0.5, 0.45], [0.5, 0.5, 0.5], [0.95, 0.95, 0.9]].map((k) => tamIZPowrotem(...k)),
        odchylenie,
      };
    }
    const srgb = profilSrgb();
    const p = czytajProfil(srgb);
    wynik.srgb = { rozmiar: srgb.length, zapisanyRozmiar: new DataView(srgb.buffer).getUint32(0), przestrzen: p.przestrzen, pcs: p.pcs, klasa: p.klasa, tagi: [...p.tagi.keys()].sort().join(' ') };
    let blad = '';
    try { czytajProfil(new Uint8Array(200)); } catch (e) { blad = e.message; }
    wynik.zlyPlik = blad;
    return wynik;
  });
  for (const [klucz, opis, sumaFarb] of [['fogra39', 'Coated_Fogra39L_VIGC_300.icc', 3.02], ['fogra47', 'PSO Uncoated ISO12647 (ECI)', 3.02]]) {
    const k = w[klucz];
    const proc = (v) => v.map((x) => Math.round(x * 100));
    assert.equal(k.opis, opis);
    assert.deepEqual([k.klasa, k.przestrzen], ['prtr', 'CMYK']);
    assert.ok(k.bialy.every((v) => v < 0.01), `${klucz}: biel to czysty papier (${proc(k.bialy)})`);
    assert.ok(k.czarny[3] > 0.9 && k.czarny.reduce((a, b) => a + b, 0) <= sumaFarb, `${klucz}: czerń zdjęcia jest głęboka, ale mieści się w limicie farby (${proc(k.czarny)})`);
    assert.ok(k.czerwony[0] < 0.1 && k.czerwony[1] > 0.8 && k.czerwony[2] > 0.8 && k.czerwony[3] < 0.1, `${klucz}: czerwień = magenta + żółty (${proc(k.czerwony)})`);
    assert.ok(k.zielony[0] > 0.4 && k.zielony[1] < 0.1 && k.zielony[2] > 0.8, `${klucz}: zieleń = cyjan + żółty (${proc(k.zielony)})`);
    assert.ok(k.niebieski[0] > 0.85 && k.niebieski[1] > 0.6 && k.niebieski[2] < 0.1, `${klucz}: niebieski = cyjan + magenta (${proc(k.niebieski)})`);
    // Szarość na zdjęciu: z czterech farb, ale na papierze neutralna i tak jasna, jak miała być.
    assert.ok(Math.abs(k.szaryZdjecie[0] - k.szaryCel[0]) < 1 && Math.abs(k.szaryZdjecie[1]) < 2 && Math.abs(k.szaryZdjecie[2]) < 2, `${klucz}: szarość zdjęcia ${k.szaryZdjecie}`);
    // Tekst i kształty: czerń i szarości samą czarną farbą, jasność według profilu.
    assert.deepEqual(k.tekstCzarny, [0, 0, 0, 1]);
    assert.deepEqual(k.tekstBialy, [0, 0, 0, 0]);
    assert.deepEqual(k.tekstSzary.slice(0, 3), [0, 0, 0]);
    assert.ok(k.tekstSzary[3] > 0.45 && k.tekstSzary[3] < 0.75, `${klucz}: szary tekst K = ${Math.round(k.tekstSzary[3] * 100)}%`);
    assert.ok(Math.abs(k.tekstSzaryNaPapierze[0] - k.szaryCel[0]) < 0.5, `${klucz}: szary tekst ma na papierze zadaną jasność`);
    assert.ok(k.tekstKolor[0] > 0.9 && k.tekstKolor[1] > 0.7 && k.tekstKolor[2] < 0.1, `${klucz}: granat ${proc(k.tekstKolor)}`);
    // Kolory mieszczące się w druku: różnica barwy po przeliczeniu poniżej progu widoczności dla wprawnego oka (ΔE 3).
    // Granat (0.1, 0.23, 0.56) na papierze niepowlekanym leży na granicy możliwości druku – dla niego próg 7.
    assert.ok(k.wGamucie.every((d, i) => d < (i === 1 ? 7 : 3)), `${klucz}: różnice barwy ${k.wGamucie.map((d) => d.toFixed(1))}`);
    assert.ok(k.odchylenie <= 3, `${klucz}: piksel zdjęcia różni się od dokładnego przeliczenia najwyżej o ${k.odchylenie.toFixed(1)} na 255`);
  }
  assert.equal(w.srgb.rozmiar, w.srgb.zapisanyRozmiar);
  assert.deepEqual([w.srgb.klasa, w.srgb.przestrzen, w.srgb.pcs], ['mntr', 'RGB', 'XYZ']);
  assert.equal(w.srgb.tagi, 'bTRC bXYZ cprt desc gTRC gXYZ rTRC rXYZ wtpt');
  assert.equal(w.zlyPlik, 'to nie jest profil ICC');
});

// Eksport i opis budowy pliku pod kątem PDF/X-4 oraz porównanie obrazu strony z aplikacją.
const eksportuj = (strona, opcje) => strona.evaluate(async ([o, pdfjs, watek]) => {
  const { stan } = window.seriodruk;
  const { eksportujPdf } = await import('./js/eksport.js');
  const { renderujCel } = await import('./js/zlozenie.js');
  const { czytajProfil, SilnikCmyk, WARUNKI_DRUKU } = await import('./js/profil-icc.js');
  if (o.profilWlasny === 'fogra47') o.profilWlasny = { nazwa: 'od-drukarni.icc', bajty: new Uint8Array(await (await fetch(WARUNKI_DRUKU.fogra47.plik)).arrayBuffer()) };
  if (o.profilWlasny === 'srgb') o.profilWlasny = { nazwa: 'ekran.icc', bajty: (await import('./js/profil-icc.js')).profilSrgb() };
  let wynik;
  try { wynik = await eksportujPdf(stan.projekt, { znaki: true, spad: true, ...o }); } catch (e) { return { blad: e.message }; }
  const bajty = new Uint8Array(await wynik.blob.arrayBuffer());
  const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream } = window.PDFLib;
  // updateMetadata: false – inaczej biblioteka przy samym odczycie wpisałaby nową datę zmiany.
  const pdf = await PDFDocument.load(bajty, { updateMetadata: false });
  const N = (n) => PDFName.of(n);
  const tekstZ = (v) => (v && v.decodeText ? v.decodeText() : String(v));
  const rozpakuj = (s) => (s.dict.get(N('Filter')) ? decodePDFRawStream(s).decode() : s.contents);
  // Piksele obrazu: gdy wiersze są zapisane z „przewidywaniem” PNG (różnica z lewej albo z góry), odtwarzamy je.
  const piksele = (x) => {
    const dane = rozpakuj(x);
    const parametry = x.dict.lookupMaybe(N('DecodeParms'), PDFDict);
    if (!parametry) return dane;
    const kanaly = parametry.get(N('Colors')).asNumber(); const dl = parametry.get(N('Columns')).asNumber() * kanaly;
    const wierszy = dane.length / (dl + 1);
    const wynik = new Uint8Array(wierszy * dl);
    for (let w = 0; w < wierszy; w += 1) {
      const typ = dane[w * (dl + 1)];
      if (typ !== 1 && typ !== 2) throw new Error(`nieznane przewidywanie ${typ}`);
      for (let i = 0; i < dl; i += 1) {
        const obok = typ === 1 ? (i >= kanaly ? wynik[w * dl + i - kanaly] : 0) : (w ? wynik[(w - 1) * dl + i] : 0);
        wynik[w * dl + i] = (dane[w * (dl + 1) + 1 + i] + obok) & 255;
      }
    }
    return wynik;
  };
  const obiekty = pdf.context.enumerateIndirectObjects().map(([, x]) => x);
  const kartka = pdf.getPage(0);
  const zasoby = kartka.node.Resources();

  // Warunki druku i profil.
  const zamiary = pdf.catalog.lookupMaybe(N('OutputIntents'), PDFArray);
  const zamiar = zamiary ? zamiary.lookup(0, PDFDict) : null;
  let profil = null;
  if (zamiar) {
    const s = zamiar.lookup(N('DestOutputProfile'));
    const dane = rozpakuj(s);
    const wzor = o.pdfx === 'wlasny' ? o.profilWlasny.bajty : new Uint8Array(await (await fetch(WARUNKI_DRUKU[o.pdfx].plik)).arrayBuffer());
    profil = { n: String(s.dict.get(N('N'))), dlugosc: dane.length, niezmieniony: dane.length === wzor.length && dane.every((b, i) => b === wzor[i]) };
  }
  const meta = pdf.catalog.lookupMaybe(N('Metadata'), PDFRawStream);
  const info = pdf.context.lookup(pdf.context.trailerInfo.Info, PDFDict);
  const przestrzenie = zasoby.lookupMaybe(N('ColorSpace'), PDFDict);
  const domyslnyRgb = przestrzenie ? przestrzenie.lookupMaybe(N('DefaultRGB'), PDFArray) : null;

  // Treść strony i obrazy.
  let tresc = '';
  const strumienie = kartka.node.Contents();
  for (const ref of (strumienie.asArray ? strumienie.asArray() : [strumienie])) { const s = pdf.context.lookup(ref); tresc += new TextDecoder('latin1').decode(s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : s.getUnencodedContents()); }
  const liczba = (wzor) => (tresc.match(wzor) || []).length;
  const obrazy = obiekty.filter((x) => x.dict && String(x.dict.get(N('Subtype'))) === '/Image');
  const opisObrazu = (x) => `${x.dict.get(N('ImageMask')) ? 'maska' : String(x.dict.get(N('ColorSpace')))} ${String(x.dict.get(N('Filter')))} ${x.dict.get(N('Width'))}x${x.dict.get(N('Height'))}${x.dict.get(N('SMask')) ? ' +maska' : ''}${x.dict.get(N('Mask')) ? ' +wycięcie' : ''}${String(x.dict.get(N('Filter'))) === '/FlateDecode' && x.dict.get(N('DecodeParms')) ? ' +przewidywanie' : ''}`;
  const cieniowania = obiekty.filter((x) => x instanceof PDFDict && x.get(N('ShadingType'))).map((x) => String(x.get(N('ColorSpace'))));

  // Piksel ze środka największego (w pikselach) obrazu CMYK i to samo policzone wprost przez profil (zdjęcie testowe ma na środku jeden kolor).
  let piksel = null;
  const cmykowe = obrazy.filter((x) => String(x.dict.get(N('ColorSpace'))) === '/DeviceCMYK' && String(x.dict.get(N('Filter'))) === '/FlateDecode').sort((a, b) => b.dict.get(N('Width')).asNumber() * b.dict.get(N('Height')).asNumber() - a.dict.get(N('Width')).asNumber() * a.dict.get(N('Height')).asNumber());
  if (cmykowe.length && o.kolorZdjecia) {
    const x = cmykowe[0]; const dane = rozpakuj(x);
    const szer = x.dict.get(N('Width')).asNumber(); const wys = x.dict.get(N('Height')).asNumber();
    const p = (Math.floor(wys / 2) * szer + Math.floor(szer / 2)) * 4;
    const silnik = new SilnikCmyk(czytajProfil(o.pdfx === 'wlasny' ? o.profilWlasny.bajty : await (await fetch(WARUNKI_DRUKU[o.pdfx].plik)).arrayBuffer()));
    piksel = { wPliku: [...dane.slice(p, p + 4)], zProfilu: silnik.cmyk(...o.kolorZdjecia.map((v) => v / 255)).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)), wymiary: [szer, wys], dlugosc: dane.length };
  }

  // Obraz całej strony w CMYK (tryb „Obrazy stron”): piksele w podanych miejscach strony (mm) i to,
  // co daje dla wzorcowych kolorów sam profil.
  let probki = null;
  if (cmykowe.length && o.probki) {
    const x = cmykowe[0]; const dane = piksele(x);
    const szer = x.dict.get(N('Width')).asNumber(); const wys = x.dict.get(N('Height')).asNumber();
    const { szerokosc_mm: W, wysokosc_mm: H, spad_mm: S } = stan.projekt.sekcje[0].wydruk;
    const silnik = new SilnikCmyk(czytajProfil(await (await fetch(WARUNKI_DRUKU[o.pdfx].plik)).arrayBuffer()));
    const bajty255 = (v) => v.map((k) => Math.round(Math.min(1, Math.max(0, k)) * 255));
    let czystaCzern = 0; let samaCzern = 0; let czteryFarby = 0;
    for (let i = 0; i < dane.length; i += 4) {
      if (dane[i] || dane[i + 1] || dane[i + 2]) czteryFarby += 1;
      else if (dane[i + 3] === 255) czystaCzern += 1;
      else if (dane[i + 3]) samaCzern += 1;
    }
    probki = {
      wymiary: [szer, wys], dlugosc: dane.length, czystaCzern, samaCzern, czteryFarby,
      punkty: Object.fromEntries(Object.entries(o.probki).map(([nazwa, [mx, my]]) => {
        const p = (Math.round(((my + S) / (H + 2 * S)) * wys) * szer + Math.round(((mx + S) / (W + 2 * S)) * szer)) * 4;
        return [nazwa, [...dane.slice(p, p + 4)]];
      })),
      zProfilu: Object.fromEntries(Object.entries(o.wzorce || {}).map(([nazwa, k]) => [nazwa, bajty255(silnik.cmyk(...k.map((v) => v / 255)))])),
      czernSzarosci128: silnik.czernSzarosci()[128],
    };
  }

  // Obraz strony z czytnika PDF i z aplikacji.
  if (!window.pdfjsLib) await new Promise((ok, blad) => { const s = document.createElement('script'); s.src = pdfjs; s.onload = ok; s.onerror = blad; document.head.append(s); });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = watek;
  const dok = await window.pdfjsLib.getDocument({ data: bajty.slice() }).promise;
  const str = await dok.getPage(1);
  const tekst = (await str.getTextContent()).items.map((i) => i.str).join('');
  const obciecie = kartka.getTrimBox(); const calosc = kartka.getMediaBox();
  const widok = str.getViewport({ scale: 1240 / (obciecie.width) });
  const a = Object.assign(document.createElement('canvas'), { width: Math.round(widok.width), height: Math.round(widok.height) });
  await str.render({ canvasContext: a.getContext('2d'), viewport: widok }).promise;
  // Z obrazu PDF wycinamy stronę po obcięciu i porównujemy z obrazem z aplikacji bez spadu.
  const skala = a.width / calosc.width;
  const wyc = Object.assign(document.createElement('canvas'), { width: Math.round(obciecie.width * skala), height: Math.round(obciecie.height * skala) });
  wyc.getContext('2d').drawImage(a, -Math.round(obciecie.x * skala), -Math.round((calosc.height - obciecie.y - obciecie.height) * skala));
  const wzorObraz = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); renderujCel(stan.projekt, stan.projekt.strony[0], { szerokoscPx: wyc.width, spad: false, oryginaly: true }).then((u) => { i.src = u; }); });
  const b = Object.assign(document.createElement('canvas'), { width: wyc.width, height: wyc.height });
  b.getContext('2d').drawImage(wzorObraz, 0, 0, wyc.width, wyc.height);
  const maly = (c) => { const m = Object.assign(document.createElement('canvas'), { width: Math.round(c.width / 12), height: Math.round(c.height / 12) }); const x = m.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, m.width, m.height); return x.getImageData(0, 0, m.width, m.height); };
  const da = maly(wyc); const db = maly(b);
  let suma = 0; let rozne = 0; let ksztalt = 0;
  const jasnosc = (d, i) => 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
  for (let i = 0; i < da.data.length; i += 4) {
    const r = (Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2])) / 3;
    suma += r; if (r > 48) rozne += 1;
    // „Kształt”: miejsca, gdzie jedno jest wyraźnie ciemne, a drugie jasne – niezależne od odcienia.
    if (Math.abs(jasnosc(da, i) - jasnosc(db, i)) > 90) ksztalt += 1;
  }
  const piks = da.data.length / 4;
  return {
    nazwa: wynik.nazwa, rozmiar: bajty.length, naglowek: new TextDecoder('latin1').decode(bajty.slice(0, 8)), stron: pdf.getPageCount(),
    zamiar: zamiar ? { s: String(zamiar.get(N('S'))), id: tekstZ(zamiar.get(N('OutputConditionIdentifier'))), rejestr: zamiar.get(N('RegistryName')) ? tekstZ(zamiar.get(N('RegistryName'))) : null, opis: tekstZ(zamiar.get(N('OutputCondition'))) } : null,
    profil,
    meta: meta ? { tekst: new TextDecoder().decode(meta.contents), filtr: meta.dict.get(N('Filter')) ? 'spakowane' : 'jawne', typ: `${String(meta.dict.get(N('Type')))} ${String(meta.dict.get(N('Subtype')))}` } : null,
    info: { trapped: String(info.get(N('Trapped'))), wersja: info.get(N('GTS_PDFXVersion')) ? tekstZ(info.get(N('GTS_PDFXVersion'))) : null, tytul: pdf.getTitle(), utworzono: pdf.getCreationDate()?.toISOString(), zmieniono: pdf.getModificationDate()?.toISOString() },
    id: Boolean(pdf.context.trailerInfo.ID),
    domyslnyRgb: domyslnyRgb ? `${String(domyslnyRgb.get(0))} N=${String(pdf.context.lookup(domyslnyRgb.get(1)).dict.get(N('N')))}` : null,
    domyslnyRgbNaKazdej: pdf.getPages().every((k) => k.node.Resources().lookupMaybe(N('ColorSpace'), PDFDict)?.get(N('DefaultRGB'))),
    pudelka: pdf.getPages().every((k) => k.node.get(N('TrimBox')) && k.node.get(N('BleedBox'))),
    rgb: liczba(/\b(rg|RG)\b/g), cmyk: liczba(/ [kK]\b/g), czystaCzern: liczba(/\b0 0 0 1 k\b/g), tekstowe: liczba(/\bTJ\b/g),
    obrazy: obrazy.map(opisObrazu).sort(), cieniowania, czcionkiOsadzone: obiekty.filter((x) => x instanceof PDFDict && String(x.get(N('Type'))) === '/FontDescriptor').every((x) => x.get(N('FontFile2')) || x.get(N('FontFile3'))),
    piksel, probki, tekst, srednia: suma / piks, rozne: rozne / piks, ksztalt: ksztalt / piks,
  };
}, [opcje, PDFJS, PDFJS_WATEK]);

const OBIEKTY = [
  { type: 'rect', left: -3, top: -3, width: 154, height: 24, fill: '#c8102e', id: 'pas' },
  { type: 'textbox', left: 15, top: 30, width: 120, text: 'Zażółć gęślą jaźń – druk w CMYK', fontSize: 8, fontFamily: 'Lora', fontWeight: 'bold', textAlign: 'center', fill: '#000000', styles: [], id: 'tytul' },
  { type: 'textbox', left: 15, top: 48, width: 120, text: 'Szary podpis i granatowy akapit pod spodem.', fontSize: 4.5, fontFamily: 'Inter', fill: '#808080', styles: [{ start: 15, end: 43, style: { fill: '#1a3c8f' } }], id: 'podpis' },
  { type: 'ellipse', left: 15, top: 62, rx: 22, ry: 12, id: 'elipsa', fill: { type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 1, y2: 0 }, colorStops: [{ offset: 0, color: '#06d6a0' }, { offset: 1, color: '#ef476f' }] } },
  { type: 'rect', left: 70, top: 62, width: 30, height: 24, fill: '#ffd166', stroke: '#073b4c', strokeWidth: 1, opacity: 0.6, id: 'pol' },
  { type: 'rect', left: 108, top: 62, width: 26, height: 20, fill: '#8338ec', shadow: { color: 'rgba(0,0,0,0.5)', blur: 3, offsetX: 2, offsetY: 2 }, id: 'cien' },
];

test('PDF/X-4: warunki druku z profilem, metadane, kolory i zdjęcia w CMYK przez profil; bez przeliczania – RGB opisane sRGB', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Do drukarni');
  // Strona: tekst, kształty, gradient, element z cieniem oraz zdjęcie JPEG 800 × 600 (środek w jednym kolorze) i PNG z przezroczystością.
  await strona.evaluate(async (obiekty) => {
    const { stan, edytor, zapiszTeraz, przeladuj } = window.seriodruk;
    const c = Object.assign(document.createElement('canvas'), { width: 800, height: 600 });
    const x = c.getContext('2d');
    x.fillStyle = '#2a9d8f'; x.fillRect(0, 0, 800, 600); x.fillStyle = '#e63946'; x.fillRect(0, 0, 800, 120); x.fillStyle = '#264653'; x.fillRect(0, 480, 800, 120);
    const zdjecie = await edytor.dodajObraz(c.toDataURL('image/jpeg', 0.95), 'zdjecie.jpg', stan.projekt.zasoby);
    zdjecie.set({ left: 15, top: 100, scaleX: 0.075, scaleY: 0.075 }); // 60 × 45 mm
    const p = Object.assign(document.createElement('canvas'), { width: 120, height: 120 });
    const y = p.getContext('2d'); y.fillStyle = '#ff006e'; y.beginPath(); y.arc(60, 60, 55, 0, Math.PI * 2); y.fill();
    const kolo = await edytor.dodajObraz(p.toDataURL('image/png'), 'kolo.png', stan.projekt.zasoby);
    kolo.set({ left: 90, top: 105, scaleX: 0.3, scaleY: 0.3 });
    edytor.zatwierdz();
    await zapiszTeraz();
    stan.projekt.strony[0].obiekty.unshift(...obiekty.map((o) => ({ version: '5.3.0', ...o })));
    await przeladuj();
    await document.fonts.ready;
  }, OBIEKTY);

  // 1. Pełny plik do drukarni: PDF/X-4, papier niepowlekany, tekst, kształty i zdjęcia w CMYK.
  const w = await eksportuj(strona, { tryb: 'wektor', pdfx: 'fogra47', cmyk: true, zdjeciaCmyk: true, dpi: 150, kolorZdjecia: [0x2a, 0x9d, 0x8f] });
  assert.equal(w.blad, undefined);
  assert.equal(w.naglowek, '%PDF-1.6');
  assert.deepEqual(w.zamiar, { s: '/GTS_PDFX', id: 'FOGRA47', rejestr: 'http://www.color.org', opis: 'Offset arkuszowy, papier niepowlekany (offsetowy), ISO 12647-2:2004 – PSO Uncoated ISO12647 (ECI)' });
  assert.deepEqual(w.profil, { n: '4', dlugosc: PROFIL_NIEPOWLEKANY.length, niezmieniony: true }, 'profil jest w pliku w całości i bez zmian');
  assert.equal(w.meta.typ, '/Metadata /XML');
  assert.equal(w.meta.filtr, 'jawne', 'metadane nie są spakowane – programy drukarni czytają je wprost');
  for (const fragment of ['<pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion>', '<pdf:Trapped>False</pdf:Trapped>', 'Do drukarni', '<xmpMM:DocumentID>uuid:', '<xmpMM:RenditionClass>default</xmpMM:RenditionClass>']) assert.ok(w.meta.tekst.includes(fragment), `metadane: ${fragment}`);
  assert.equal(w.info.trapped, '/False');
  assert.equal(w.info.wersja, 'PDF/X-4');
  assert.equal(w.info.tytul, 'Do drukarni');
  assert.equal(w.info.utworzono, w.info.zmieniono);
  assert.ok(w.meta.tekst.includes(`<xmp:CreateDate>${w.info.utworzono.replace('.000Z', 'Z')}</xmp:CreateDate>`), 'data w metadanych zgadza się ze słownikiem informacji');
  assert.ok(w.id, 'plik ma identyfikator');
  assert.ok(w.pudelka, 'każda strona ma format po obcięciu i spad');
  assert.equal(w.domyslnyRgb, '/ICCBased N=3');
  // Kolory: nic w RGB – tekst, kształty, gradient i znaki cięcia w CMYK, czarny tekst samą czernią.
  assert.equal(w.rgb, 0, 'w treści strony nie ma kolorów RGB');
  assert.ok(w.cmyk >= 8 && w.czystaCzern >= 2, `kolory CMYK: ${w.cmyk}, w tym czysta czerń: ${w.czystaCzern}`);
  assert.deepEqual(w.cieniowania, ['/DeviceCMYK']);
  // Obrazy: zdjęcie w rozdzielczości użycia (60 mm przy 150 dpi → 384 px po zaokrągleniu), koło i element z cieniem z maską przezroczystości.
  assert.equal(w.obrazy.filter((o) => o.startsWith('/DeviceCMYK')).length, 3, w.obrazy.join(' | '));
  assert.equal(w.obrazy.filter((o) => o.startsWith('/DeviceGray')).length, 2, 'maski przezroczystości koła i elementu z cieniem');
  // Zdjęcie JPEG zostaje JPEG-iem w czterech farbach, chyba że bez strat wychodzi mniejsze – jak tutaj, bo zdjęcie
  // testowe to trzy gładkie pola. Obrazy z przezroczystością są zawsze bez strat. (Prawdziwe zdjęcie jako JPEG
  // i jego farby po odczytaniu innym programem sprawdza tests/pdf-kontrola.test.cjs.)
  assert.ok(w.obrazy.every((o) => /^\/Device(CMYK|Gray) \/FlateDecode/.test(o)), w.obrazy.join(' | '));
  assert.deepEqual(w.piksel.wymiary, [384, 288]);
  assert.ok(w.piksel.wPliku.every((v, i) => Math.abs(v - w.piksel.zProfilu[i]) <= 6), `piksel zdjęcia ${w.piksel.wPliku} ≈ kolor przeliczony przez profil ${w.piksel.zProfilu}`);
  assert.ok(w.czcionkiOsadzone);
  assert.ok(w.tekst.replace(/\s+/g, '').includes('Zażółćgęśląjaźń–drukwCMYK'), `tekst da się odczytać z pliku: ${w.tekst}`);
  // Obraz strony: czytnik testowy zamienia CMYK na ekran prostym wzorem, bez profilu, więc odcienie różnią się
  // z założenia (zmierzone: średnio 5,7 na 255 przy 0,38 dla tego samego pliku w RGB). Sprawdzamy więc kształt –
  // czy to, co ciemne, jest tam, gdzie ma być (tekst, krawędzie, zdjęcia) – a różnicę odcieni z zapasem na inną
  // przeglądarkę: próg 12, czyli dwa razy tyle, ile zmierzono.
  t.diagnostic(`PDF/X w CMYK: średnia różnica ${w.srednia.toFixed(2)}, wyraźnie różnych ${(w.rozne * 100).toFixed(2)}%, kształt ${(w.ksztalt * 100).toFixed(3)}%`);
  assert.ok(w.ksztalt < 0.003, `kształty na miejscu (${(w.ksztalt * 100).toFixed(3)}% miejsc różnych jasnością)`);
  assert.ok(w.srednia < 12, `średnia różnica odcieni ${w.srednia.toFixed(1)}`);

  // 2. PDF/X-4 bez przeliczania: kolory zostają w RGB, ale opisane profilem sRGB; zdjęcie JPEG bez zmian. Obraz jak w aplikacji.
  const r = await eksportuj(strona, { tryb: 'wektor', pdfx: 'fogra47', dpi: 150 });
  assert.equal(r.zamiar.id, 'FOGRA47');
  assert.equal(r.domyslnyRgb, '/ICCBased N=3');
  assert.ok(r.domyslnyRgbNaKazdej);
  assert.ok(r.rgb > 0, 'tekst i kształty w RGB');
  assert.ok(r.obrazy.some((o) => o.startsWith('/DeviceRGB /DCTDecode 800x600')), `zdjęcie JPEG w oryginale: ${r.obrazy.join(' | ')}`);
  t.diagnostic(`PDF/X bez przeliczania: średnia różnica ${r.srednia.toFixed(3)}, wyraźnie różnych ${(r.rozne * 100).toFixed(3)}%`);
  assert.ok(r.srednia < 2.5 && r.rozne < 0.005, `obraz zgodny z aplikacją: ${r.srednia.toFixed(2)}, ${(r.rozne * 100).toFixed(2)}%`);

  // 3. Obrazy stron też mogą być PDF/X-4: profil i opis sRGB.
  const o = await eksportuj(strona, { tryb: 'obraz', pdfx: 'fogra47', dpi: 150 });
  assert.equal(o.naglowek, '%PDF-1.6');
  assert.equal(o.zamiar.id, 'FOGRA47');
  assert.equal(o.domyslnyRgb, '/ICCBased N=3');
  assert.equal(o.info.wersja, 'PDF/X-4');
  assert.equal(o.obrazy.length, 1);
  assert.match(o.obrazy[0], /^\/DeviceRGB \/DCTDecode /, 'bez opcji CMYK obraz strony zostaje w RGB');

  // 4. Profil od drukarni: plik .icc jako warunki druku; plik, który nie jest profilem CMYK, daje jasny komunikat.
  const wl = await eksportuj(strona, { tryb: 'wektor', pdfx: 'wlasny', profilWlasny: 'fogra47', cmyk: true, dpi: 150 });
  assert.deepEqual(wl.zamiar, { s: '/GTS_PDFX', id: 'Custom', rejestr: null, opis: 'PSO Uncoated ISO12647 (ECI)' });
  assert.ok(wl.profil.niezmieniony);
  assert.equal(wl.rgb, 0);
  assert.match((await eksportuj(strona, { tryb: 'wektor', pdfx: 'wlasny', profilWlasny: 'srgb' })).blad, /nie opisuje druku w CMYK/);
  assert.match((await eksportuj(strona, { tryb: 'wektor', pdfx: 'wlasny' })).blad, /Wybierz plik profilu/);

  // 5. Zwykły eksport (bez standardu) zostaje, jaki był: wersja 1.7, bez warunków druku.
  const z = await eksportuj(strona, { tryb: 'wektor', dpi: 150 });
  assert.equal(z.naglowek, '%PDF-1.7');
  assert.equal(z.zamiar, null);
  assert.equal(z.meta, null);
  assert.equal(z.domyslnyRgb, null);
  assert.deepEqual(bledy, []);
});

test('PDF/X-4 w trybie „Obrazy stron”: obraz strony w CMYK przez profil; czerń i szarości poza zdjęciami samą czarną farbą', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Strony CMYK');
  // Kształty: czerwony, szary i czarny; czarny tekst; zdjęcie (PNG, bez strat) z polem zielonym, szarym i czarnym;
  // na zdjęciu czarna tabliczka (kształt), obok zdjęcia półprzezroczysty czarny pasek zachodzący na zdjęcie.
  await strona.evaluate(async () => {
    const { stan, edytor, zapiszTeraz, przeladuj } = window.seriodruk;
    const c = Object.assign(document.createElement('canvas'), { width: 400, height: 300 });
    const x = c.getContext('2d');
    x.fillStyle = '#2a9d8f'; x.fillRect(0, 0, 200, 300); x.fillStyle = '#808080'; x.fillRect(200, 0, 200, 150); x.fillStyle = '#000000'; x.fillRect(200, 150, 200, 150);
    const zdjecie = await edytor.dodajObraz(c.toDataURL('image/png'), 'pola.png', stan.projekt.zasoby);
    zdjecie.set({ left: 10, top: 80, scaleX: 0.2, scaleY: 0.2 }); // 80 × 60 mm
    edytor.zatwierdz();
    await zapiszTeraz();
    stan.projekt.strony[0].obiekty.push(...[
      { type: 'rect', left: 10, top: 10, width: 40, height: 20, fill: '#c8102e', strokeWidth: 0, id: 'czerwony' },
      { type: 'rect', left: 60, top: 10, width: 40, height: 20, fill: '#808080', strokeWidth: 0, id: 'szary' },
      { type: 'rect', left: 110, top: 10, width: 20, height: 20, fill: '#000000', strokeWidth: 0, id: 'czarny' },
      { type: 'textbox', left: 10, top: 40, width: 120, text: 'Zażółć gęślą jaźń', fontSize: 9, fontFamily: 'Inter', fontWeight: 'bold', fill: '#000000', styles: [], id: 'tekst' },
      { type: 'rect', left: 20, top: 128, width: 12, height: 8, fill: '#000000', strokeWidth: 0, id: 'tabliczka' },
      { type: 'rect', left: 80, top: 85, width: 30, height: 10, fill: '#000000', opacity: 0.5, strokeWidth: 0, id: 'polprzezroczysty' },
    ].map((o) => ({ version: '5.3.0', ...o })));
    await przeladuj();
    await document.fonts.ready;
  });
  const probki = { czerwony: [30, 20], szary: [80, 20], czarny: [120, 20], papier: [140, 60], zdjecieZielone: [30, 100], zdjecieSzare: [70, 100], zdjecieCzarne: [70, 125], tabliczka: [26, 132], pasekNaZdjeciu: [85, 90], pasekNaPapierze: [100, 90] };
  const wzorce = { czerwony: [0xc8, 0x10, 0x2e], zielony: [0x2a, 0x9d, 0x8f], szary: [128, 128, 128], czarny: [0, 0, 0], szaryPodPaskiem: [64, 64, 64] };
  // Najpierw cała strona bez strat (jakość 1): farby każdego miejsca da się wtedy odczytać z pliku co do piksela.
  const w = await eksportuj(strona, { tryb: 'obraz', pdfx: 'fogra47', zdjeciaCmyk: true, dpi: 150, znaki: true, jakosc: 1, probki, wzorce });
  assert.equal(w.blad, undefined);
  assert.equal(w.naglowek, '%PDF-1.6');
  assert.equal(w.zamiar.id, 'FOGRA47');
  assert.ok(w.profil.niezmieniony);
  assert.equal(w.info.wersja, 'PDF/X-4');
  // Jedyny obraz w pliku to strona ze spadem: 154 × 216 mm w 150 dpi (909 × 1275 pikseli), CMYK, spakowana bez strat.
  assert.deepEqual(w.obrazy, ['/DeviceCMYK /FlateDecode 909x1275 +przewidywanie']);
  assert.equal(w.probki.dlugosc, 909 * 1275 * 4);
  assert.equal(w.rgb, 0, 'w treści strony nie ma kolorów RGB (znaki cięcia też w CMYK)');
  const p = w.probki.punkty; const wz = w.probki.zProfilu;
  const blisko = (a, b, tol, opis) => assert.ok(a.every((v, i) => Math.abs(v - b[i]) <= tol), `${opis}: ${a} wobec ${b}`);
  // Kolor kształtu i kolor zdjęcia – przez profil.
  blisko(p.czerwony, wz.czerwony, 3, 'czerwony kształt');
  blisko(p.zdjecieZielone, wz.zielony, 3, 'zielone pole zdjęcia');
  // Poza zdjęciami czerń i szarość to sama czarna farba, biel to czysty papier.
  assert.deepEqual(p.czarny, [0, 0, 0, 255]);
  assert.deepEqual(p.szary, [0, 0, 0, w.probki.czernSzarosci128]);
  assert.ok(w.probki.czernSzarosci128 > 115 && w.probki.czernSzarosci128 < 190, `szary kształt: K = ${w.probki.czernSzarosci128}`);
  assert.deepEqual(p.papier, [0, 0, 0, 0]);
  assert.deepEqual(p.tabliczka, [0, 0, 0, 255], 'czarny kształt leżący na zdjęciu też jest samą czernią');
  assert.deepEqual(p.pasekNaPapierze.slice(0, 3), [0, 0, 0], 'półprzezroczysta czerń na papierze to szarość z samej czarnej farby');
  // Na zdjęciu szarość i czerń są z czterech farb, tak jak daje profil – także pod półprzezroczystym paskiem.
  blisko(p.zdjecieSzare, wz.szary, 3, 'szare pole zdjęcia');
  blisko(p.zdjecieCzarne, wz.czarny, 3, 'czarne pole zdjęcia');
  assert.ok(p.zdjecieSzare[0] > 40 && p.zdjecieSzare[1] > 30 && p.zdjecieSzare[2] > 30, `szarość zdjęcia z czterech farb: ${p.zdjecieSzare}`);
  assert.ok(p.zdjecieCzarne.slice(0, 3).every((v) => v > 100), `czerń zdjęcia głęboka: ${p.zdjecieCzarne}`);
  blisko(p.pasekNaZdjeciu, wz.szaryPodPaskiem, 4, 'pasek na zdjęciu');
  // Litery tekstu: wnętrze czystą czernią, wygładzone brzegi samą czarną farbą.
  assert.ok(w.probki.czystaCzern > 20000 && w.probki.samaCzern > 20000, `czysta czerń ${w.probki.czystaCzern}, szarości z samej czerni ${w.probki.samaCzern}`);
  // Obraz strony z czytnika PDF: kształty na miejscu, odcienie w granicach prostej zamiany CMYK na ekran (jak w teście wektorowym).
  t.diagnostic(`Obrazy stron w CMYK: średnia różnica ${w.srednia.toFixed(2)}, kształt ${(w.ksztalt * 100).toFixed(3)}%, plik ${(w.rozmiar / 1024).toFixed(0)} kB`);
  assert.ok(w.ksztalt < 0.003, `kształty na miejscu (${(w.ksztalt * 100).toFixed(3)}% miejsc różnych jasnością)`);
  assert.ok(w.srednia < 12, `średnia różnica odcieni ${w.srednia.toFixed(1)}`);

  // Zwykły eksport (jakość domyślna): zdjęcie idzie pod spodem osobnym obrazem, a reszta strony bez strat na
  // wierzchu, z wycięciem w miejscu pikseli zdjęcia. Zdjęcie jest JPEG-iem w czterech farbach, chyba że bez
  // strat wychodzi mniejsze – jak tutaj, bo zdjęcie testowe to trzy gładkie pola (prawdziwe zdjęcie jako JPEG
  // i zysk na wielkości pliku sprawdza tests/pdf-kontrola.test.cjs).
  const d = await eksportuj(strona, { tryb: 'obraz', pdfx: 'fogra47', zdjeciaCmyk: true, dpi: 150, znaki: true, probki, wzorce });
  assert.equal(d.blad, undefined);
  assert.equal(d.obrazy.length, 3, d.obrazy.join(' | '));
  assert.ok(d.obrazy.includes('/DeviceCMYK /FlateDecode 909x1275 +wycięcie +przewidywanie') && d.obrazy.includes('maska /FlateDecode 909x1275'), d.obrazy.join(' | '));
  const jpeg = d.obrazy.find((o) => /^\/DeviceCMYK \/FlateDecode \d+x\d+ \+przewidywanie$/.test(o));
  const [, sz, wy] = /(\d+)x(\d+) /.exec(jpeg).map(Number);
  // Zdjęcie ma 80 × 60 mm, czyli 472 × 354 piksele w 150 dpi; prostokąt JPEG to ono z kilkoma pikselami zapasu.
  assert.ok(sz >= 472 && sz <= 490 && wy >= 354 && wy <= 372, `prostokąt zdjęcia ${jpeg}`);
  assert.equal(d.rgb, 0);
  const pd = d.probki.punkty;
  // Warstwa bez strat: poza zdjęciem to samo co przedtem, w miejscu pikseli zdjęcia – nic.
  for (const nazwa of ['czerwony', 'szary', 'czarny', 'papier', 'tabliczka', 'pasekNaPapierze']) assert.deepEqual(pd[nazwa], p[nazwa], `warstwa bez strat: ${nazwa}`);
  for (const nazwa of ['zdjecieZielone', 'zdjecieSzare', 'zdjecieCzarne', 'pasekNaZdjeciu']) assert.deepEqual(pd[nazwa], [0, 0, 0, 0], `warstwa bez strat jest pusta tam, gdzie zdjęcie: ${nazwa}`);
  assert.ok(d.probki.czystaCzern > 20000 && d.probki.samaCzern > 20000, 'litery nadal bez strat, samą czarną farbą');
  // Złożona strona w czytniku PDF wygląda tak samo jak zapisana w całości bez strat.
  t.diagnostic(`Obrazy stron w CMYK, zdjęcia jako JPEG: średnia różnica ${d.srednia.toFixed(2)}, kształt ${(d.ksztalt * 100).toFixed(3)}%, plik ${(d.rozmiar / 1024).toFixed(0)} kB (bez strat ${(w.rozmiar / 1024).toFixed(0)} kB)`);
  assert.ok(d.ksztalt < 0.003 && d.srednia < 12, `obraz strony: kształt ${(d.ksztalt * 100).toFixed(3)}%, średnia ${d.srednia.toFixed(1)}`);
  assert.ok(Math.abs(d.srednia - w.srednia) < 0.5, `ten sam obraz co bez strat: ${d.srednia.toFixed(2)} wobec ${w.srednia.toFixed(2)}`);
  assert.ok(d.rozmiar < w.rozmiar + 4096, `plik nie większy niż bez strat (poza maską): ${d.rozmiar} wobec ${w.rozmiar}`);

  // Strona bez zdjęć: każda czerń i szarość samą czarną farbą.
  await strona.evaluate(async () => {
    const { stan, przeladuj } = window.seriodruk;
    stan.projekt.strony[0].obiekty = stan.projekt.strony[0].obiekty.filter((o) => o.type !== 'image');
    await przeladuj();
  });
  const b = await eksportuj(strona, { tryb: 'obraz', pdfx: 'fogra47', zdjeciaCmyk: true, dpi: 150, probki, wzorce });
  assert.deepEqual([b.probki.punkty.zdjecieSzare, b.probki.punkty.zdjecieCzarne, b.probki.punkty.tabliczka], [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 255]]);
  blisko(b.probki.punkty.czerwony, wz.czerwony, 3, 'czerwony kształt bez zdjęć');
  assert.deepEqual(bledy, []);
});

test('okno eksportu: standard dla drukarni, zdjęcia w CMYK, profil z pliku', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Okno PDFX');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.dodajTekst('Próba'); e.zatwierdz(); });
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  // Domyślnie: zwykły PDF, bez opisu standardu i bez opcji zdjęć.
  assert.equal(await strona.inputValue('#form-pdf select[name=pdfx]'), '');
  assert.ok(await strona.isHidden('#pdf-opis-pdfx'));
  assert.ok(await strona.isHidden('#pdf-pole-zdjecia'));
  await strona.selectOption('#form-pdf select[name=pdfx]', 'fogra47');
  assert.match(await strona.textContent('#pdf-opis-pdfx'), /Plik PDF\/X-4: zawiera profil barwny \(warunki druku: papier niepowlekany \(FOGRA47\)\).*Zdjęcia zostają w RGB z opisem sRGB/);
  assert.ok(await strona.isVisible('#pdf-pole-zdjecia'));
  await strona.check('#form-pdf input[name=cmyk]');
  await strona.check('#form-pdf input[name=zdjeciaCmyk]');
  assert.match(await strona.textContent('#pdf-opis-pdfx'), /Tekst i kształty są przeliczone na CMYK przez ten profil.*Zdjęcia są przeliczone na CMYK przez ten profil/);
  assert.equal(await strona.textContent('#pdf-etykieta-zdjecia'), 'Zdjęcia też w CMYK (większy plik)');
  // Obrazy stron: to samo pole przelicza cały obraz strony; opcje pliku wektorowego znikają.
  await strona.selectOption('#form-pdf select[name=tryb]', 'obraz');
  assert.ok(await strona.isHidden('#pdf-opcje-wektora'));
  assert.ok(await strona.isVisible('#pdf-pole-zdjecia'));
  assert.equal(await strona.textContent('#pdf-etykieta-zdjecia'), 'Obrazy stron w CMYK (większy plik)');
  assert.match(await strona.textContent('#pdf-opis-pdfx'), /Obrazy stron są przeliczone na CMYK przez ten profil.*samą czarną farbą/);
  assert.equal(await strona.evaluate(() => window.seriodruk.oknoPdf.opcje().zdjeciaCmyk), true);
  await strona.uncheck('#form-pdf input[name=zdjeciaCmyk]');
  assert.match(await strona.textContent('#pdf-opis-pdfx'), /Obrazy stron zostają w RGB z opisem sRGB/);
  await strona.check('#form-pdf input[name=zdjeciaCmyk]');
  await strona.selectOption('#form-pdf select[name=tryb]', 'wektor');
  // Profil od drukarni: bez pliku nie da się eksportować; po wskazaniu pliku – tak.
  await strona.selectOption('#form-pdf select[name=pdfx]', 'wlasny');
  assert.ok(await strona.isVisible('#pdf-pole-profil'));
  assert.ok(await strona.isDisabled('#pdf-eksportuj'));
  const [wybor] = await Promise.all([strona.waitForEvent('filechooser'), strona.click('#pdf-wybierz-profil')]);
  await wybor.setFiles([{ name: 'Profil drukarni.icc', mimeType: 'application/vnd.iccprofile', buffer: PROFIL_NIEPOWLEKANY }]);
  await strona.waitForFunction(() => document.querySelector('#pdf-nazwa-profilu').textContent === 'Profil drukarni.icc');
  assert.ok(await strona.isEnabled('#pdf-eksportuj'));
  await strona.selectOption('#form-pdf select[name=dpi]', '150');
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  assert.equal(plik.suggestedFilename(), 'Okno PDFX.pdf');
  await strona.waitForSelector('#dlg-pdf', { state: 'hidden' });
  const zapisany = await strona.evaluate(async () => {
    const { PDFDocument, PDFName, PDFArray, PDFDict } = window.PDFLib;
    const bajty = new Uint8Array(await window.seriodruk.oknoPdf.ostatni.blob.arrayBuffer());
    const pdf = await PDFDocument.load(bajty);
    const zamiar = pdf.catalog.lookup(PDFName.of('OutputIntents'), PDFArray).lookup(0, PDFDict);
    return [new TextDecoder('latin1').decode(bajty.slice(0, 8)), zamiar.get(PDFName.of('OutputConditionIdentifier')).decodeText(), zamiar.get(PDFName.of('Info')).decodeText()];
  });
  assert.deepEqual(zapisany, ['%PDF-1.6', 'Custom', 'PSO Uncoated ISO12647 (ECI)']);
  assert.deepEqual(bledy, []);
});

test('zdjęcie w CMYK jest w pliku JPEG-iem w czterech farbach (własny koder): tryb wektorowy i obrazy stron, obraz zgodny z aplikacją', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Zdjęcie CMYK');
  // Zdjęcie ze szczegółami (przejście barw i drobne plamy) – takie, które bez strat zajmuje dużo; obok czarny tekst.
  await strona.evaluate(async () => {
    const { stan, edytor, zapiszTeraz } = window.seriodruk;
    const c = Object.assign(document.createElement('canvas'), { width: 1003, height: 701 }); // wymiary niepodzielne przez 8
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1003, 701);
    g.addColorStop(0, '#0b132b'); g.addColorStop(0.5, '#e63946'); g.addColorStop(1, '#f1faee');
    x.fillStyle = g; x.fillRect(0, 0, 1003, 701);
    let ziarno = 4321;
    const los = () => { ziarno = (ziarno * 1103515245 + 12345) % 2147483648; return ziarno / 2147483648; };
    for (let i = 0; i < 4000; i += 1) { x.fillStyle = `rgba(${Math.floor(los() * 255)},${Math.floor(los() * 255)},${Math.floor(los() * 255)},0.3)`; x.fillRect(los() * 1003, los() * 701, 9, 9); }
    const zdjecie = await edytor.dodajObraz(c.toDataURL('image/jpeg', 0.9), 'widok.jpg', stan.projekt.zasoby);
    zdjecie.set({ left: 14, top: 20, scaleX: 0.12, scaleY: 0.12, angle: 3 });
    edytor.dodajTekst('Podpis pod zdjęciem – czarny tekst.').set({ left: 14, top: 120, width: 120, fontSize: 5, fontFamily: 'Lora', fill: '#000000' });
    edytor.canvas.discardActiveObject();
    edytor.zatwierdz();
    await zapiszTeraz();
    await document.fonts.ready;
  });
  // Wektorowy: zdjęcie jako JPEG w czterech farbach, w rozdzielczości użycia.
  const w = await eksportuj(strona, { tryb: 'wektor', pdfx: 'fogra47', cmyk: true, zdjeciaCmyk: true, dpi: 150 });
  assert.equal(w.blad, undefined);
  assert.equal(w.obrazy.length, 1, w.obrazy.join(' | '));
  assert.match(w.obrazy[0], /^\/DeviceCMYK \/DCTDecode \d+x\d+$/);
  assert.equal(w.rgb, 0);
  t.diagnostic(`wektor, zdjęcie JPEG w CMYK: średnia różnica ${w.srednia.toFixed(2)}, kształt ${(w.ksztalt * 100).toFixed(3)}%, plik ${(w.rozmiar / 1024).toFixed(0)} kB`);
  assert.ok(w.ksztalt < 0.003 && w.srednia < 12, `wektor: kształt ${(w.ksztalt * 100).toFixed(3)}%, średnia ${w.srednia.toFixed(1)}`);
  // Obrazy stron: zdjęcie jako JPEG pod warstwą bez strat; ta sama strona w całości bez strat jest kilka razy większa.
  const o = await eksportuj(strona, { tryb: 'obraz', pdfx: 'fogra47', zdjeciaCmyk: true, dpi: 150 });
  assert.equal(o.blad, undefined);
  assert.equal(o.obrazy.length, 3, o.obrazy.join(' | '));
  assert.ok(o.obrazy.some((x) => /^\/DeviceCMYK \/DCTDecode \d+x\d+$/.test(x)) && o.obrazy.includes('/DeviceCMYK /FlateDecode 909x1275 +wycięcie +przewidywanie') && o.obrazy.includes('maska /FlateDecode 909x1275'), o.obrazy.join(' | '));
  const calosc = await eksportuj(strona, { tryb: 'obraz', pdfx: 'fogra47', zdjeciaCmyk: true, dpi: 150, jakosc: 1 });
  assert.deepEqual(calosc.obrazy, ['/DeviceCMYK /FlateDecode 909x1275 +przewidywanie']);
  t.diagnostic(`obrazy stron: zdjęcie jako JPEG ${(o.rozmiar / 1024).toFixed(0)} kB, cała strona bez strat ${(calosc.rozmiar / 1024).toFixed(0)} kB; średnia różnica ${o.srednia.toFixed(2)} wobec ${calosc.srednia.toFixed(2)}`);
  assert.ok(o.ksztalt < 0.003 && o.srednia < 12, `obrazy stron: kształt ${(o.ksztalt * 100).toFixed(3)}%, średnia ${o.srednia.toFixed(1)}`);
  // Stratny zapis zdjęcia nie zmienia obrazu strony w sposób, który widać w porównaniu z aplikacją.
  assert.ok(Math.abs(o.srednia - calosc.srednia) < 0.6, `jak bez strat: ${o.srednia.toFixed(2)} wobec ${calosc.srednia.toFixed(2)}`);
  // Profil (ok. 1,8 MB) jest w obu plikach ten sam; różnica to same obrazy strony.
  assert.ok(calosc.rozmiar - o.rozmiar > 200 * 1024, `plik mniejszy o ${((calosc.rozmiar - o.rozmiar) / 1024).toFixed(0)} kB`);
  assert.deepEqual(bledy, []);
});
