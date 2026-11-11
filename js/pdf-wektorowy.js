// PDF wektorowy: strona zapisana jako tekst, kształty i zdjęcia, a nie jako jeden obraz.
//
// Jak to działa: edytor (Fabric) rysuje każdy element na „kontekście rysowania”.
// Tutaj jest własny kontekst o tym samym zestawie poleceń, który zamiast pikseli
// zapisuje polecenia PDF: ścieżki, kolory, gradienty, tekst pisany osadzoną
// czcionką i zdjęcia w oryginalnej rozdzielczości. Dzięki temu PDF powstaje z tego
// samego kodu, który rysuje stronę na ekranie – układ wierszy, wypunktowania,
// pola z danych i przelewanie tekstu są takie same.
//
// Czego nie da się zapisać wektorowo (cień, element przycięty maską, znak spoza
// czcionki), trafia do PDF jako obraz tego jednego elementu w wybranej
// rozdzielczości. Lista takich miejsc wraca w `uwagi`.
//
// Tekst pisany czcionką, której nie da się osadzić (własny plik WOFF2, czcionka
// zmienna, kursywa „udawana” przez przeglądarkę), jest zapisywany jako krzywe –
// obrysy liter jako kształty. Jest ostry, ale nie da się go zaznaczyć; lista
// takich miejsc wraca w `krzywe`. Rysunki SVG są rozkładane na kształty i też
// idą jako wektory.

import './fabric-ustawienia.js';
import { CZCIONKI } from './czcionki.js';
import { spakuj } from './pdf-x.js';

const PT = 72 / 25.4;
const ROZMIAR_POMIARU = 400; // tekst mierzymy dużą czcionką i skalujemy – jak robi to edytor
const PROG_LIGATURY = 0.01; // ligatura jest „widoczna”, gdy różni się od osobnych liter ponad 1% zaczernionych punktów
const BIALY = /^\s$/u;
const MAX_PIKSELI_OBRAZU = 36e6;
const SKOS_KURSYWY = 0.25; // tak przeglądarka pochyla pismo, gdy czcionka nie ma własnej kursywy

class Niewektorowe extends Error {
  constructor(powod) { super(powod); this.niewektorowe = true; }
}

// ---------- Macierze [a, b, c, d, e, f] jak w canvas ----------
const mnoz = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const odwroc = (m) => {
  const w = m[0] * m[3] - m[1] * m[2];
  if (!w) return null;
  return [m[3] / w, -m[1] / w, -m[2] / w, m[0] / w, (m[2] * m[5] - m[3] * m[4]) / w, (m[1] * m[4] - m[0] * m[5]) / w];
};
const punkt = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const L = (n) => { const s = (+n.toFixed(4)).toString(); return s === '-0' ? '0' : s; };

// ---------- Kolory ----------
let probnik = null;
const znaneKolory = new Map();
// Dowolny zapis koloru CSS → [r, g, b, a] w zakresie 0–1.
export function rozlozKolor(kolor) {
  if (znaneKolory.has(kolor)) return znaneKolory.get(kolor);
  probnik = probnik || document.createElement('canvas').getContext('2d');
  probnik.fillStyle = '#000000';
  probnik.fillStyle = kolor;
  const s = probnik.fillStyle;
  let w;
  if (s.startsWith('#')) w = [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255, 1];
  else { const l = s.match(/[\d.]+/g).map(Number); w = [l[0] / 255, l[1] / 255, l[2] / 255, l[3] ?? 1]; }
  znaneKolory.set(kolor, w);
  return w;
}
// Prosta zamiana na CMYK: czerń i szarości idą samą czernią (K), kolory bez domieszki czerni tam, gdzie się da.
export function naCmyk([r, g, b]) {
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
}

class Gradient {
  constructor(rodzaj, wsp) { this.rodzaj = rodzaj; this.wsp = wsp; this.kolory = []; }

  addColorStop(miejsce, kolor) { this.kolory.push([Math.min(1, Math.max(0, miejsce)), rozlozKolor(kolor)]); }
}

// ---------- Czcionki ----------

const waga = (w) => (w === 'bold' ? 700 : (w === 'normal' || !w ? 400 : Number(w) || 400));
const slug = (rodzina) => rodzina.toLowerCase().replace(/\s+/g, '-');

// Plik WOFF (tabele spakowane osobno) → zwykły plik czcionki.
async function rozpakujWoff(bufor) {
  const d = new DataView(bufor);
  const ile = d.getUint16(12);
  const wpisy = [];
  for (let i = 0; i < ile; i += 1) {
    const p = 44 + i * 20;
    wpisy.push({ znacznik: d.getUint32(p), od: d.getUint32(p + 4), spakowane: d.getUint32(p + 8), dlugosc: d.getUint32(p + 12), suma: d.getUint32(p + 16) });
  }
  const dane = [];
  for (const w of wpisy) {
    const kawalek = new Uint8Array(bufor, w.od, w.spakowane);
    dane.push(w.spakowane < w.dlugosc
      ? new Uint8Array(await new Response(new Blob([kawalek]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer())
      : kawalek);
  }
  const naglowek = 12 + ile * 16;
  const razem = naglowek + dane.reduce((s, t) => s + Math.ceil(t.length / 4) * 4, 0);
  const wynik = new Uint8Array(razem);
  const o = new DataView(wynik.buffer);
  const potega = 2 ** Math.floor(Math.log2(ile));
  o.setUint32(0, d.getUint32(4)); o.setUint16(4, ile); o.setUint16(6, potega * 16); o.setUint16(8, Math.log2(potega)); o.setUint16(10, ile * 16 - potega * 16);
  let gdzie = naglowek;
  wpisy.forEach((w, i) => {
    const p = 12 + i * 16;
    o.setUint32(p, w.znacznik); o.setUint32(p + 4, w.suma); o.setUint32(p + 8, gdzie); o.setUint32(p + 12, dane[i].length);
    wynik.set(dane[i], gdzie);
    gdzie += Math.ceil(dane[i].length / 4) * 4;
  });
  return wynik;
}

// Ligatura (np. „fi” jednym znakiem czcionki) w osadzonej czcionce. Biblioteka PDF zapisuje szerokości i znaczenie
// tylko tych znaków, które czcionka ma w tabeli znaków – ligatury zwykle w niej nie ma. Dopisujemy ją więc do spisu
// znaków czcionki: stąd w pliku jej szerokość i litery, które oznacza (tekst da się zaznaczyć i wyszukać).
// Zwraca numer, pod którym ligatura jest w osadzonej czcionce, albo 0, gdy spisu nie da się uzupełnić –
// wtedy ligatura nie jest używana.
function dopiszLigature(pdfFont, glif) {
  const osadzanie = pdfFont?.embedder;
  const spis = osadzanie?.glyphCache;
  if (typeof spis?.access !== 'function') return 0;
  // Czcionka osadzana w części (tylko użyte znaki): znaki dostają w pliku własne, kolejne numery.
  if (osadzanie.subset) {
    if (typeof osadzanie.subset.includeGlyph !== 'function' || !Array.isArray(osadzanie.glyphs) || !(osadzanie.glyphIdMap instanceof Map) || typeof spis.invalidate !== 'function') return 0;
    const nr = osadzanie.subset.includeGlyph(glif.id);
    osadzanie.glyphs[nr - 1] = glif;
    osadzanie.glyphIdMap.set(glif.id, nr);
    spis.invalidate();
    pdfFont.modified = true;
    return nr;
  }
  const glify = spis.access();
  if (!Array.isArray(glify)) return 0;
  let a = 0; let b = glify.length;
  while (a < b) { const s = (a + b) >> 1; if (glify[s].id < glif.id) a = s + 1; else b = s; }
  if (glify[a]?.id === glif.id) glify[a] = glif; else glify.splice(a, 0, glif);
  pdfFont.modified = true;
  return glif.id;
}

// Nazwa czcionki osadzonej w części zaczyna się od sześciu wielkich liter i plusa (np. „QKXDPA+Lora-Regular”) –
// po tym programy rozpoznają, że w pliku jest tylko część znaków. Każda czcionka pliku dostaje inne litery.
const znacznikCzesci = (nr) => Array.from({ length: 6 }, (_, i) => String.fromCharCode(65 + (Math.floor((nr * 7919 + 104729) / 26 ** i) % 26))).join('');

// Czcionka OpenType z obrysami CFF (plik „OTTO”) jest w pliku PDF w całości, jako plik OpenType. Biblioteka PDF
// nie rozpoznaje takiego pliku osadzanego w całości i opisuje go jak czcionkę TrueType – inne programy zgłaszają
// wtedy niezgodność rodzaju czcionki. Dlatego: przy osadzaniu mówimy bibliotece, że to obrysy CFF (opisCff),
// a po zapisaniu czcionek do dokumentu poprawiamy opis strumienia z „gołej tabeli obrysów” na „OpenType”
// i usuwamy wpis, który dotyczy tylko czcionek TrueType. (Części takich czcionek nie wycinamy, więc każdy
// strumień z obrysami CFF to cały plik.)
const opisCff = (pdfFont) => { if (pdfFont?.embedder) pdfFont.embedder.isCFF = () => true; return pdfFont; };

export async function poprawOpisCzcionekOtf(PDFLib, pdf) {
  await pdf.flush();
  const { PDFName } = PDFLib;
  const rodzaj = PDFName.of('Subtype');
  for (const [, obiekt] of pdf.context.enumerateIndirectObjects()) {
    const slownik = obiekt?.dict || (typeof obiekt?.get === 'function' && typeof obiekt?.set === 'function' ? obiekt : null);
    if (!slownik) continue;
    if (slownik.get(rodzaj) === PDFName.of('CIDFontType0C')) slownik.set(rodzaj, PDFName.of('OpenType'));
    if (slownik.get(rodzaj) === PDFName.of('CIDFontType0')) slownik.delete(PDFName.of('CIDToGIDMap'));
  }
}

// Czcionki jednego pliku PDF: wyszukanie pliku dla rodziny i odmiany, wczytanie, osadzenie.
export class CzcionkiPdf {
  constructor(pdf, projekt, fontkit, { krzywe = false } = {}) {
    Object.assign(this, { pdf, projekt, fontkit, krzywe });
    this.gotowe = new Map(); // "rodzina|700|1" → { fk, pdfFont, krzywe, skos } albo { brak: powód }
    this.szerokosci = new Map(); // "czcionka pomiarowa|napis" → szerokość napisu mierzonego osobno
  }

  async _bajty(rodzina, w, kursywa) {
    const wlasne = (this.projekt.czcionki || []).filter((c) => c.rodzina === rodzina);
    if (wlasne.length) {
      const tejPochylosci = wlasne.filter((c) => Boolean(c.kursywa) === kursywa);
      // Kursywa bez własnego pliku: przeglądarka pochyla pismo proste – tutaj to samo, krzywymi.
      const skos = !tejPochylosci.length && kursywa;
      const kandydaci = tejPochylosci.length ? tejPochylosci : wlasne;
      const c = [...kandydaci].sort((a, b) => Math.abs(a.waga - w) - Math.abs(b.waga - w))[0];
      if (w >= 600 && c.waga < 600) return { brak: `„${rodzina}” nie ma pliku odmiany pogrubionej` };
      const zasob = this.projekt.zasoby?.[c.id];
      if (!zasob?.dataUrl) return { brak: `brak pliku czcionki „${rodzina}”` };
      const bufor = await (await fetch(zasob.dataUrl)).arrayBuffer();
      const znak = new TextDecoder('latin1').decode(new Uint8Array(bufor, 0, 4));
      if (znak === 'ttcf') return { brak: `„${rodzina}” to zbiór czcionek (TTC)` };
      // Pliku WOFF2 nie da się osadzić w PDF, ale da się z niego odczytać obrysy liter.
      if (znak === 'wOF2') return { bajty: new Uint8Array(bufor), woff2: true, wagaPliku: c.waga, skos };
      return { bajty: znak === 'wOFF' ? await rozpakujWoff(bufor) : new Uint8Array(bufor), wagaPliku: c.waga, skos };
    }
    if (CZCIONKI.some((c) => c.nazwa === rodzina)) {
      const plik = (pochylona) => fetch(`css/czcionki/pdf/${slug(rodzina)}-${w >= 600 ? 700 : 400}-${pochylona ? 'kursywa' : 'prosta'}.ttf`);
      let odp = await plik(kursywa);
      const skos = !odp.ok && kursywa;
      if (skos) odp = await plik(false);
      if (!odp.ok) return { brak: `„${rodzina}” nie ma tej odmiany` };
      return { bajty: new Uint8Array(await odp.arrayBuffer()), skos };
    }
    return { brak: `czcionki „${rodzina}” nie ma w projekcie` };
  }

  async _wczytaj(rodzina, w, kursywa) {
    try {
      const zrodlo = await this._bajty(rodzina, w, kursywa);
      if (zrodlo.brak) return zrodlo;
      let fk = this.fontkit.create(zrodlo.bajty);
      // Powód, dla którego tekst tą czcionką idzie jako krzywe, a nie jako tekst z osadzoną czcionką.
      let krzywe = null;
      const osie = fk.variationAxes || {};
      if (Object.keys(osie).length) {
        // Czcionka zmienna: przeglądarka rysuje ją w grubości, z jaką plik jest zapisany w projekcie.
        // Inne osie (np. rozmiar optyczny) przeglądarka dobiera sama – takiej czcionki nie odtworzymy wiernie.
        if (Object.keys(osie).some((k) => k !== 'wght')) return { brak: `„${rodzina}” to czcionka zmienna z kilkoma osiami – do PDF wgraj osobne pliki odmian` };
        const os = osie.wght;
        const grubosc = os ? Math.min(os.max, Math.max(os.min, zrodlo.wagaPliku ?? w)) : null;
        if (os && grubosc !== os.default) {
          if (zrodlo.woff2) return { brak: `„${rodzina}” to czcionka zmienna w pliku WOFF2 – do PDF wgraj plik TTF albo osobne pliki odmian` };
          fk = fk.getVariation({ wght: grubosc });
        }
        krzywe = `„${rodzina}” (czcionka zmienna)`;
      }
      if (zrodlo.woff2) krzywe = `„${rodzina}” (plik WOFF2)`;
      if (zrodlo.skos) krzywe = `„${rodzina}” (kursywa bez własnego pliku)`;
      // Do pliku trafiają tylko użyte znaki czcionki (plik jest mniejszy; przy dużej własnej czcionce – dużo mniejszy).
      // Wyjątek: czcionka OpenType z obrysami CFF (plik zaczyna się od „OTTO”) idzie w całości – jej część
      // wycięta przez bibliotekę bywa nieczytelna dla innych programów (poppler zgłasza błąd czcionki).
      const wCzesci = new TextDecoder('latin1').decode(zrodlo.bajty.subarray(0, 4)) !== 'OTTO';
      const opcje = wCzesci ? { subset: true, customName: `${znacznikCzesci(this.gotowe.size)}+${String(fk.postscriptName || rodzina).replace(/[^A-Za-z0-9-]/g, '')}` } : { subset: false };
      let pdfFont = this.krzywe || krzywe ? null : await this.pdf.embedFont(zrodlo.bajty, opcje);
      if (!wCzesci) pdfFont = opisCff(pdfFont);
      // slowa: słowo → jego ligatury; proby: czy przeglądarka naprawdę rysuje dany zlepek liter ligaturą;
      // dopisane: numery ligatur dopisanych do osadzonej czcionki (patrz KontekstPdf._ligatury).
      return { fk, pdfFont, krzywe, skos: zrodlo.skos ? SKOS_KURSYWY : 0, slowa: new Map(), proby: new Map(), dopisane: new Map() };
    } catch (e) {
      return { brak: `pliku czcionki „${rodzina}” nie udało się odczytać` };
    }
  }

  // Wczytuje czcionki użyte w tekstach podanych obiektów.
  async przygotuj(obiekty) {
    const potrzebne = new Map();
    const zbierz = (lista) => {
      for (const o of lista || []) {
        if (typeof o.text === 'string' && o.fontFamily) {
          const dodaj = (s) => {
            const r = s.fontFamily ?? o.fontFamily; const w = waga(s.fontWeight ?? o.fontWeight); const k = (s.fontStyle ?? o.fontStyle) === 'italic' || (s.fontStyle ?? o.fontStyle) === 'oblique';
            potrzebne.set(`${r}|${w >= 600 ? 700 : 400}|${k ? 1 : 0}`, [r, w >= 600 ? 700 : 400, k]);
          };
          dodaj({});
          for (const wiersz of Object.values(o.styles || {})) for (const s of Object.values(wiersz || {})) if (s && typeof s === 'object') dodaj(s.style || s);
        }
        if (Array.isArray(o._objects)) zbierz(o._objects);
      }
    };
    zbierz(obiekty);
    for (const [klucz, [r, w, k]] of potrzebne) {
      if (!this.gotowe.has(klucz)) this.gotowe.set(klucz, await this._wczytaj(r, w, k));
    }
  }

  // Deklaracja czcionki z kontekstu rysowania ("italic bold 4.2px "Lora"") → czcionka albo powód braku.
  znajdz(deklaracja) {
    const m = /^(\S+)\s+(\S+)\s+([\d.]+)px\s+(.+)$/.exec(deklaracja);
    if (!m) return { brak: `nieznany zapis czcionki: ${deklaracja}` };
    const [a, b] = [m[1], m[2]];
    const styl = /italic|oblique/.test(a) ? a : (/italic|oblique/.test(b) ? b : 'normal');
    const w = waga(/italic|oblique|normal/.test(a) && !/^\d+$|bold/.test(a) ? b : a);
    const rodzina = m[4].split(',')[0].trim().replace(/^["']|["']$/g, '');
    const klucz = `${rodzina}|${w >= 600 ? 700 : 400}|${styl === 'normal' ? 0 : 1}`;
    return { ...(this.gotowe.get(klucz) || { brak: `czcionka „${rodzina}” nie została wczytana` }), klucz, rozmiar: Number(m[3]) };
  }
}

// ---------- Obrazy ----------

// Obrót zapisany w pliku JPEG (EXIF). Przeglądarka go stosuje, PDF nie – takie zdjęcie trzeba przerysować.
function obrotJpeg(b) {
  const d = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (d.getUint16(0) !== 0xffd8) return 1;
  let p = 2;
  while (p + 4 < d.byteLength) {
    const znacznik = d.getUint16(p);
    const dl = d.getUint16(p + 2);
    if (znacznik === 0xffe1 && d.getUint32(p + 4) === 0x45786966) {
      const t = p + 10;
      const le = d.getUint16(t) === 0x4949;
      const ifd = t + d.getUint32(t + 4, le);
      const ile = d.getUint16(ifd, le);
      for (let i = 0; i < ile; i += 1) {
        const w = ifd + 2 + i * 12;
        if (w + 12 > d.byteLength) return 1;
        if (d.getUint16(w, le) === 0x0112) return d.getUint16(w + 8, le);
      }
      return 1;
    }
    if ((znacznik & 0xff00) !== 0xff00) return 1;
    p += 2 + dl;
  }
  return 1;
}

const bajtyZAdresu = async (src) => new Uint8Array(await (await fetch(src)).arrayBuffer());

// Zabezpieczenie: kształty z rozkładu narysowane w małej skali muszą wyglądać jak rysunek
// narysowany przez przeglądarkę. Jeśli nie – rysunek zostaje obrazem.
export function svgZgodny(el, czesci, opcje) {
  const nw = el.naturalWidth || el.width; const nh = el.naturalHeight || el.height;
  if (!nw || !nh || Math.abs((nw / nh) / (opcje.width / opcje.height) - 1) > 0.02) return false;
  const W = 200; const H = Math.max(1, Math.round((W * nh) / nw));
  const plotno = new fabric.StaticCanvas(undefined, { width: W, height: H, enableRetinaScaling: false, renderOnAddRemove: false });
  plotno.setViewportTransform([W / opcje.width, 0, 0, H / opcje.height, 0, 0]);
  plotno.add(...czesci);
  plotno.renderAll();
  const a = plotno.toCanvasElement().getContext('2d').getImageData(0, 0, W, H).data;
  plotno.remove(...czesci);
  plotno.dispose();
  const wzor = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const c = wzor.getContext('2d');
  c.drawImage(el, 0, 0, W, H);
  const b = c.getImageData(0, 0, W, H).data;
  // Oba obrazy na białym tle; liczy się średnia różnica i odsetek miejsc wyraźnie różnych.
  const naBialym = (d, i, k) => (d[i + k] * d[i + 3]) / 255 + 255 - d[i + 3];
  let suma = 0; let rozne = 0;
  for (let i = 0; i < a.length; i += 4) {
    const r = (Math.abs(naBialym(a, i, 0) - naBialym(b, i, 0)) + Math.abs(naBialym(a, i, 1) - naBialym(b, i, 1)) + Math.abs(naBialym(a, i, 2) - naBialym(b, i, 2))) / 3;
    suma += r; if (r > 80) rozne += 1;
  }
  const piks = a.length / 4;
  return suma / piks < 5 && rozne / piks < 0.02;
}

// Obrazy jednego pliku PDF: każdy plik graficzny jest w nim tylko raz, choćby był na stu stronach.
export class ObrazyPdf {
  // silnik: przeliczanie przez profil drukarski (js/profil-icc.js) – wtedy obrazy trafiają do pliku w CMYK.
  constructor(pdf, { silnik = null } = {}) { this.pdf = pdf; this.silnik = silnik; this.znane = new Map(); this.svg = new Map(); }

  // Rysunki SVG wśród obiektów (także w grupach) są rozkładane na kształty – raz na cały plik PDF.
  // this.svg: adres obrazu → { obiekty, w, h } albo { brak: powód } (wtedy rysunek idzie jako obraz).
  async przygotujSvg(obiekty, czcionki) {
    const elementy = new Map();
    const zbierz = (lista) => {
      for (const o of lista || []) {
        const el = typeof o.getElement === 'function' ? o.getElement() : null;
        if (el?.tagName === 'IMG' && /^data:image\/svg\+xml/i.test(el.src) && !this.svg.has(el.src)) elementy.set(el.src, el);
        if (Array.isArray(o._objects)) zbierz(o._objects);
      }
    };
    zbierz(obiekty);
    for (const [src, el] of elementy) this.svg.set(src, await this._rozlozSvg(el, czcionki));
  }

  async _rozlozSvg(el, czcionki) {
    try {
      const kod = await (await fetch(el.src)).text();
      // Rzeczy, których rozkład na kształty nie odtworzy – taki rysunek zostaje obrazem.
      const nie = /<(filter|mask|pattern|marker|foreignObject|switch|textPath|image|script)\b|@font-face|@import|@media|mix-blend-mode/i.exec(kod);
      if (nie) return { brak: `rysunek SVG z elementem „${nie[1] || nie[0]}”` };
      const { objects, options } = await fabric.loadSVGFromString(kod);
      const czesci = (objects || []).filter(Boolean);
      if (!czesci.length || !(options?.width > 0) || !(options?.height > 0)) return { brak: 'rysunek SVG, którego nie udało się rozłożyć na kształty' };
      if (czesci.some(maMaske)) return { brak: 'rysunek SVG z przycięciem (clip-path)' };
      czesci.forEach(bezPamieci);
      await czcionki.przygotuj(czesci);
      if (!svgZgodny(el, czesci, options)) return { brak: 'rysunek SVG, którego nie da się wiernie odtworzyć wektorowo' };
      return { obiekty: czesci, w: options.width, h: options.height };
    } catch {
      return { brak: 'rysunek SVG, którego nie udało się rozłożyć na kształty' };
    }
  }

  // el: <img>. Zwraca obietnicę obrazu PDF.
  osadz(el, { szerPx } = {}) {
    // W CMYK obraz jest zapisywany w rozdzielczości, w jakiej jest użyty (zaokrąglonej w górę) –
    // to samo zdjęcie użyte dużo większe dostaje osobną, dokładniejszą kopię.
    const szer = this.silnik ? this._szerokoscCmyk(el, szerPx) : 0;
    const klucz = this.silnik ? `${el.src}|${szer}` : el.src;
    if (!this.znane.has(klucz)) this.znane.set(klucz, this.silnik ? this._osadzCmyk(el, szer) : this._osadz(el, szerPx));
    return this.znane.get(klucz);
  }

  _szerokoscCmyk(el, szerPx) {
    const nw = el.naturalWidth || el.width; const nh = el.naturalHeight || el.height;
    const wektor = /^data:image\/svg\+xml/i.test(el.src);
    let szer = szerPx > 0 ? Math.ceil(szerPx / 64) * 64 : nw;
    if (!wektor) szer = Math.min(nw, szer); // zdjęcia nie powiększamy ponad oryginał
    return Math.max(1, Math.min(szer, Math.floor(Math.sqrt((MAX_PIKSELI_OBRAZU * nw) / nh))));
  }

  async _osadzCmyk(el, szer) {
    const nw = el.naturalWidth || el.width; const nh = el.naturalHeight || el.height;
    const plotno = document.createElement('canvas');
    plotno.width = szer; plotno.height = Math.max(1, Math.round((szer * nh) / nw));
    const c = plotno.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(el, 0, 0, plotno.width, plotno.height);
    return this.osadzPlotno(plotno);
  }

  // Piksele płótna → obraz PDF w CMYK (bezstratnie spakowany), przezroczystość jako osobna maska.
  async _plotnoCmyk(plotno) {
    const { width: w, height: h } = plotno;
    const rgba = plotno.getContext('2d').getImageData(0, 0, w, h).data;
    const ctx = this.pdf.context;
    const opis = { Type: 'XObject', Subtype: 'Image', Width: w, Height: h, BitsPerComponent: 8, Filter: 'FlateDecode' };
    let maska = null;
    for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 255) { maska = new Uint8Array(w * h); break; }
    if (maska) {
      for (let i = 0; i < maska.length; i += 1) maska[i] = rgba[i * 4 + 3];
      opis.SMask = ctx.register(ctx.stream(await spakuj(maska), { ...opis, ColorSpace: 'DeviceGray' }));
    }
    const ref = ctx.register(ctx.stream(await spakuj(this.silnik.obraz(rgba)), { ...opis, ColorSpace: 'DeviceCMYK' }));
    return { ref };
  }

  async _osadz(el, szerPx) {
    const typ = /^data:(image\/[a-z+.-]+)/i.exec(el.src)?.[1]?.toLowerCase();
    if (typ === 'image/jpeg' || typ === 'image/png') {
      const bajty = await bajtyZAdresu(el.src);
      if (typ === 'image/png') return this.pdf.embedPng(bajty);
      if (obrotJpeg(bajty) === 1) return this.pdf.embedJpg(bajty);
    }
    // Inne formaty (WebP, GIF, SVG) i obrócone zdjęcia: przerysowane przez przeglądarkę.
    const wektor = typ === 'image/svg+xml';
    const nw = el.naturalWidth || el.width; const nh = el.naturalHeight || el.height;
    let k = wektor && szerPx ? Math.max(1, szerPx / nw) : 1;
    k = Math.min(k, Math.sqrt(MAX_PIKSELI_OBRAZU / (nw * nh)));
    const plotno = document.createElement('canvas');
    plotno.width = Math.max(1, Math.round(nw * k)); plotno.height = Math.max(1, Math.round(nh * k));
    plotno.getContext('2d').drawImage(el, 0, 0, plotno.width, plotno.height);
    return this.osadzPlotno(plotno, typ === 'image/jpeg');
  }

  async osadzPlotno(plotno, bezPrzezroczystosci = false) {
    if (this.silnik) { const obraz = await this._plotnoCmyk(plotno); plotno.width = 0; plotno.height = 0; return obraz; }
    const url = bezPrzezroczystosci ? plotno.toDataURL('image/jpeg', 0.92) : plotno.toDataURL('image/png');
    const obraz = await (bezPrzezroczystosci ? this.pdf.embedJpg(url) : this.pdf.embedPng(url));
    plotno.width = 0; plotno.height = 0;
    return obraz;
  }
}

// ---------- Kontekst rysowania zapisujący PDF ----------

const STAN = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'globalAlpha', 'font', 'textAlign', 'textBaseline', 'direction', 'globalCompositeOperation', 'imageSmoothingEnabled', 'imageSmoothingQuality', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'letterSpacing', 'fontKerning', 'filter'];
const KONCE = { butt: 0, round: 1, square: 2 };
const LACZENIA = { miter: 0, round: 1, bevel: 2 };

class KontekstPdf {
  // strona: opis zasobów strony (patrz StronaPdf); czcionki: CzcionkiPdf; opcje: { cmyk, krzywe }
  constructor(strona, czcionki, opcje) {
    Object.assign(this, { strona, czcionki, opcje });
    this.op = []; // polecenia PDF (napisy)
    this.m = [1, 0, 0, 1, 0, 0];
    this.stos = [];
    this.sciezka = [];
    this.kreski = [];
    this.tu = null;
    this.start = null;
    this.canvas = { width: 1, height: 1, style: {}, setAttribute() {}, getAttribute() { return null; } };
    Object.assign(this, {
      fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, lineDashOffset: 0,
      globalAlpha: 1, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', direction: 'ltr', globalCompositeOperation: 'source-over',
      imageSmoothingEnabled: true, imageSmoothingQuality: 'low', shadowColor: 'rgba(0, 0, 0, 0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      letterSpacing: '0px', fontKerning: 'auto', filter: 'none',
    });
    this.pomiar = document.createElement('canvas').getContext('2d');
    // Co w rysowanym właśnie elemencie zapisano inaczej niż tekstem i wektorem: powody.
    this.krzyweTeraz = new Set();
    this.obrazyTeraz = new Set();
    this.ligaturTeraz = 0; // ile ligatur zapisał rysowany właśnie element
  }

  // --- stan ---
  save() {
    this.stos.push({ m: this.m, kreski: this.kreski, ...Object.fromEntries(STAN.map((k) => [k, this[k]])) });
    this.op.push('q');
  }

  restore() {
    const s = this.stos.pop();
    if (!s) return;
    Object.assign(this, s);
    this.op.push('Q');
  }

  transform(a, b, c, d, e, f) {
    this.m = mnoz(this.m, [a, b, c, d, e, f]);
    this.op.push(`${[a, b, c, d, e, f].map((n) => (+n.toFixed(6)).toString()).join(' ')} cm`);
  }

  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }

  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }

  rotate(kat) { const c = Math.cos(kat); const s = Math.sin(kat); this.transform(c, s, -s, c, 0, 0); }

  setTransform(a, b, c, d, e, f) {
    const cel = typeof a === 'object' && a ? [a.a, a.b, a.c, a.d, a.e, a.f] : [a, b, c, d, e, f];
    const odw = odwroc(this.m);
    if (!odw) throw new Niewektorowe('przekształcenie');
    this.transform(...mnoz(odw, cel));
  }

  resetTransform() { this.setTransform(1, 0, 0, 1, 0, 0); }

  getTransform() { const [a, b, c, d, e, f] = this.m; return { a, b, c, d, e, f }; }

  setLineDash(k) { this.kreski = [...(k || [])]; }

  getLineDash() { return [...this.kreski]; }

  // --- ścieżka (punkty w układzie strony, niezależnie od późniejszych przekształceń) ---
  beginPath() { this.sciezka = []; }

  _p(x, y) { return punkt(this.m, x, y); }

  moveTo(x, y) { const p = this._p(x, y); this.sciezka.push(['m', ...p]); this.tu = p; this.start = p; }

  lineTo(x, y) { if (!this.sciezka.length) { this.moveTo(x, y); return; } const p = this._p(x, y); this.sciezka.push(['l', ...p]); this.tu = p; }

  bezierCurveTo(x1, y1, x2, y2, x, y) {
    if (!this.sciezka.length) this.moveTo(x1, y1);
    const p = this._p(x, y);
    this.sciezka.push(['c', ...this._p(x1, y1), ...this._p(x2, y2), ...p]);
    this.tu = p;
  }

  quadraticCurveTo(x1, y1, x, y) {
    if (!this.sciezka.length) this.moveTo(x1, y1);
    const [x0, y0] = this.tu; const [cx, cy] = this._p(x1, y1); const p = this._p(x, y);
    this.sciezka.push(['c', x0 + (2 / 3) * (cx - x0), y0 + (2 / 3) * (cy - y0), p[0] + (2 / 3) * (cx - p[0]), p[1] + (2 / 3) * (cy - p[1]), ...p]);
    this.tu = p;
  }

  closePath() { if (this.sciezka.length) { this.sciezka.push(['h']); this.tu = this.start; } }

  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }

  ellipse(x, y, rx, ry, obrot, a0, a1, wstecz = false) {
    // Łuk jako krzywe Béziera, najwyżej ćwierć obrotu na odcinek.
    let rozpietosc = a1 - a0;
    const pelny = Math.PI * 2;
    if (!wstecz) { if (rozpietosc >= pelny) rozpietosc = pelny; else { rozpietosc %= pelny; if (rozpietosc < 0) rozpietosc += pelny; } }
    else if (rozpietosc <= -pelny) rozpietosc = -pelny; else { rozpietosc %= pelny; if (rozpietosc > 0) rozpietosc -= pelny; }
    const c = Math.cos(obrot); const s = Math.sin(obrot);
    const na = (kat) => { const px = rx * Math.cos(kat); const py = ry * Math.sin(kat); return [x + px * c - py * s, y + px * s + py * c]; };
    const styczna = (kat) => { const px = -rx * Math.sin(kat); const py = ry * Math.cos(kat); return [px * c - py * s, px * s + py * c]; };
    const [sx, sy] = na(a0);
    if (this.sciezka.length) this.lineTo(sx, sy); else this.moveTo(sx, sy);
    const ile = Math.max(1, Math.ceil(Math.abs(rozpietosc) / (Math.PI / 2) - 1e-9));
    const krok = rozpietosc / ile;
    const k = (4 / 3) * Math.tan(krok / 4);
    for (let i = 0; i < ile; i += 1) {
      const t0 = a0 + i * krok; const t1 = t0 + krok;
      const [p0x, p0y] = na(t0); const [p1x, p1y] = na(t1);
      const [d0x, d0y] = styczna(t0); const [d1x, d1y] = styczna(t1);
      this.bezierCurveTo(p0x + k * d0x, p0y + k * d0y, p1x - k * d1x, p1y - k * d1y, p1x, p1y);
    }
  }

  arc(x, y, r, a0, a1, wstecz = false) { this.ellipse(x, y, r, r, 0, a0, a1, wstecz); }

  // --- malowanie ---
  _sciezkaLokalnie(sciezka = this.sciezka) {
    const odw = odwroc(this.m);
    if (!odw) return null;
    const czesci = [];
    for (const [co, ...l] of sciezka) {
      const p = [];
      for (let i = 0; i < l.length; i += 2) p.push(...punkt(odw, l[i], l[i + 1]));
      czesci.push(`${p.map(L).join(' ')}${p.length ? ' ' : ''}${co}`);
    }
    return czesci;
  }

  _kolor(k, obrys) {
    const [r, g, b] = k;
    if (this.opcje.cmyk) return `${this.opcje.naCmyk([r, g, b]).map(L).join(' ')} ${obrys ? 'K' : 'k'}`;
    return `${L(r)} ${L(g)} ${L(b)} ${obrys ? 'RG' : 'rg'}`;
  }

  _krycie(a) { this.op.push(`/${this.strona.krycie(Math.min(1, Math.max(0, a)))} gs`); }

  _styl(styl, obrys) {
    if (styl instanceof Gradient) return styl;
    if (typeof styl !== 'string') throw new Niewektorowe('wypełnienie wzorem');
    const k = rozlozKolor(styl);
    this._krycie(this.globalAlpha * k[3]);
    this.op.push(this._kolor(k, obrys));
    return null;
  }

  _sprawdz() {
    if (this.globalCompositeOperation !== 'source-over') throw new Niewektorowe('tryb mieszania');
    const cien = rozlozKolor(this.shadowColor || 'rgba(0,0,0,0)');
    if (cien[3] > 0 && (this.shadowBlur || this.shadowOffsetX || this.shadowOffsetY)) throw new Niewektorowe('cień');
  }

  fill(regula) { this._wypelnij(this.sciezka, (typeof regula === 'string' ? regula : 'nonzero') === 'evenodd'); }

  _wypelnij(sciezka, parzyste) {
    this._sprawdz();
    const czesci = this._sciezkaLokalnie(sciezka);
    if (!czesci || !czesci.length) return;
    this.op.push('q');
    const gradient = this._styl(this.fillStyle, false);
    if (gradient) {
      this._krycie(this.globalAlpha);
      this.op.push(...czesci, parzyste ? 'W* n' : 'W n', `/${this.strona.cieniowanie(gradient, this.opcje.cmyk ? this.opcje.naCmyk : null)} sh`);
    } else this.op.push(...czesci, parzyste ? 'f*' : 'f');
    this.op.push('Q');
  }

  stroke() { this._obrysuj(this.sciezka); }

  _obrysuj(sciezka) {
    this._sprawdz();
    const czesci = this._sciezkaLokalnie(sciezka);
    if (!czesci || !czesci.length || !(this.lineWidth > 0)) return;
    this.op.push('q');
    if (this._styl(this.strokeStyle, true)) throw new Niewektorowe('obrys gradientem');
    this.op.push(`${L(this.lineWidth)} w`, `${KONCE[this.lineCap] ?? 0} J`, `${LACZENIA[this.lineJoin] ?? 0} j`, `${L(Math.max(1, this.miterLimit))} M`);
    if (this.kreski.length && this.kreski.some((k) => k > 0)) this.op.push(`[${this.kreski.map(L).join(' ')}] ${L(this.lineDashOffset || 0)} d`);
    this.op.push(...czesci, 'S', 'Q');
  }

  clip(regula) {
    const czesci = this._sciezkaLokalnie();
    if (!czesci) return;
    this.op.push(...czesci, (typeof regula === 'string' ? regula : 'nonzero') === 'evenodd' ? 'W* n' : 'W n');
  }

  _prostokat(x, y, w, h) {
    const p = [this._p(x, y), this._p(x + w, y), this._p(x + w, y + h), this._p(x, y + h)];
    return [['m', ...p[0]], ['l', ...p[1]], ['l', ...p[2]], ['l', ...p[3]], ['h']];
  }

  fillRect(x, y, w, h) { this._wypelnij(this._prostokat(x, y, w, h), false); }

  strokeRect(x, y, w, h) { this._obrysuj(this._prostokat(x, y, w, h)); }

  clearRect() {}

  createLinearGradient(x1, y1, x2, y2) { return new Gradient('liniowy', [x1, y1, x2, y2]); }

  createRadialGradient(x1, y1, r1, x2, y2, r2) { return new Gradient('kolowy', [x1, y1, r1, x2, y2, r2]); }

  createPattern() { throw new Niewektorowe('wypełnienie wzorem'); }

  // --- tekst ---
  measureText(tekst) { this.pomiar.font = this.font; return this.pomiar.measureText(tekst); }

  // Położenia kolejnych jednostek tekstu (znaków i ligatur) tak, jak ułożyłaby je przeglądarka.
  // Początek jednostki = szerokość tekstu do niej włącznie − szerokość jej samej; dzięki temu liczy się też
  // kerning między nią a poprzednim znakiem. Zwraca { x: początki, szer: szerokość całości }.
  _polozenia(jednostki, rozmiar) {
    const font = this.font.replace(/[\d.]+px/, `${ROZMIAR_POMIARU}px`);
    this.pomiar.font = font;
    const k = rozmiar / ROZMIAR_POMIARU;
    const pamiec = this.czcionki.szerokosci;
    const x = [];
    let dotad = '';
    let koniec = 0;
    for (const j of jednostki) {
      dotad += j.napis;
      koniec = this.pomiar.measureText(dotad).width;
      const klucz = `${font}|${j.napis}`;
      let wlasna = pamiec.get(klucz);
      if (wlasna === undefined) { wlasna = this.pomiar.measureText(j.napis).width; pamiec.set(klucz, wlasna); }
      x.push((koniec - wlasna) * k);
    }
    return { x, szer: koniec * k };
  }

  // Czy przeglądarka rysuje ten zlepek liter (np. „fi”) widocznie inaczej niż te same litery osobno – czyli ligaturą.
  // Sprawdzamy to na obrazie: plik czcionki dla ekranu i dla PDF to nie zawsze ten sam plik.
  _widacLigature(napis) {
    const R = 200;
    const font = this.font.replace(/[\d.]+px/, `${R}px`);
    this.pomiar.font = font;
    const znaki = Array.from(napis);
    const gdzie = [];
    let dotad = '';
    for (const z of znaki) { dotad += z; gdzie.push(this.pomiar.measureText(dotad).width - this.pomiar.measureText(z).width); }
    const szer = Math.ceil(this.pomiar.measureText(napis).width) + R;
    const rysuj = (calosc) => {
      const c = Object.assign(document.createElement('canvas'), { width: szer, height: R * 2 });
      const x = c.getContext('2d', { willReadFrequently: true });
      x.font = font;
      if (calosc) x.fillText(napis, R / 2, R * 1.3);
      else znaki.forEach((z, i) => x.fillText(z, R / 2 + gdzie[i], R * 1.3));
      return x.getImageData(0, 0, c.width, c.height).data;
    };
    const a = rysuj(true);
    const b = rysuj(false);
    let tusz = 0;
    let inne = 0;
    for (let i = 3; i < a.length; i += 4) { if (a[i] > 128) tusz += 1; if (Math.abs(a[i] - b[i]) > 128) inne += 1; }
    return tusz > 0 && inne / tusz > PROG_LIGATURY;
  }

  // Ligatury słowa: [[początek, długość, glif]]. Zlepki liter wskazuje czcionka (jej reguły łączenia znaków),
  // a o użyciu decyduje to, czy przeglądarka naprawdę rysuje je ligaturą – PDF ma wyglądać jak ekran.
  _ligatury(czcionka, slowo) {
    const napis = slowo.join('');
    if (czcionka.slowa.has(napis)) return czcionka.slowa.get(napis);
    const { fk, pdfFont } = czcionka;
    const wynik = [];
    try {
      const glify = fk.layout(napis).glyphs;
      if (glify.length < slowo.length) {
        // Które litery złączyły się w jeden znak: układamy coraz dłuższy początek słowa i patrzymy, kiedy znaków
        // nie przybywa. (Biblioteka nie podaje tego wiarygodnie – opis znaku pamięta z pierwszego użycia.)
        const zlepki = []; // [początek, długość]
        let dotad = '';
        slowo.forEach((z, n) => {
          dotad += z;
          const ile = n === slowo.length - 1 ? glify.length : fk.layout(dotad).glyphs.length;
          zlepki.push([n, 1]);
          while (zlepki.length > ile && zlepki.length > 1) { const [, d] = zlepki.pop(); zlepki[zlepki.length - 1][1] += d; }
          if (zlepki.length !== ile) throw new Error('układ nie do odczytania');
        });
        zlepki.forEach(([od, ile], n) => { if (ile > 1) wynik.push([od, ile, glify[n]]); });
      }
    } catch (e) {
      wynik.length = 0;
    }
    const uzywane = [];
    for (const [od, ile, znak] of wynik) {
      const litery = slowo.slice(od, od + ile);
      const zlepek = litery.join('');
      if (!czcionka.proby.has(zlepek)) czcionka.proby.set(zlepek, this._widacLigature(zlepek));
      if (!czcionka.proby.get(zlepek)) continue;
      // Własny opis znaku: numer, szerokość, obrys i litery, które oznacza.
      const glif = { id: znak.id, advanceWidth: znak.advanceWidth, codePoints: litery.map((z) => z.codePointAt(0)), get path() { return znak.path; } };
      // W pliku z tekstem ligatura musi też trafić do spisu znaków osadzonej czcionki.
      if (pdfFont && !czcionka.dopisane.has(glif.id)) czcionka.dopisane.set(glif.id, dopiszLigature(pdfFont, glif));
      if (!pdfFont || czcionka.dopisane.get(glif.id)) uzywane.push([od, ile, glif]);
    }
    czcionka.slowa.set(napis, uzywane);
    return uzywane;
  }

  // Tekst podzielony na jednostki do narysowania: [{ napis, glif }] – pojedyncze znaki (glif: null) i ligatury.
  _jednostki(czcionka, znaki) {
    const jednostki = [];
    let i = 0;
    while (i < znaki.length) {
      if (BIALY.test(znaki[i])) { jednostki.push({ napis: znaki[i], glif: null }); i += 1; continue; }
      let k = i;
      while (k < znaki.length && !BIALY.test(znaki[k])) k += 1;
      const slowo = znaki.slice(i, k);
      let n = 0;
      for (const [od, ile, glif] of (slowo.length > 1 ? this._ligatury(czcionka, slowo) : [])) {
        for (; n < od; n += 1) jednostki.push({ napis: slowo[n], glif: null });
        jednostki.push({ napis: slowo.slice(od, od + ile).join(''), glif });
        n = od + ile;
      }
      for (; n < slowo.length; n += 1) jednostki.push({ napis: slowo[n], glif: null });
      i = k;
    }
    return jednostki;
  }

  fillText(tekst, x, y) { this._tekst(tekst, x, y, false); }

  strokeText(tekst, x, y) { this._tekst(tekst, x, y, true); }

  _tekst(tekst, x, y, obrys) {
    this._sprawdz();
    if (!/^alphabetic/.test(this.textBaseline)) throw new Niewektorowe('linia bazowa tekstu');
    const czcionka = this.czcionki.znajdz(this.font);
    if (czcionka.brak) throw new Niewektorowe(czcionka.brak);
    const { fk, pdfFont, rozmiar, skos = 0 } = czcionka;
    const znaki = Array.from(String(tekst));
    if (!znaki.length || !(rozmiar > 0)) return;
    const jednostki = this._jednostki(czcionka, znaki);
    const gdzie = this._polozenia(jednostki, rozmiar);
    const { szer } = gdzie;
    const x0 = x - (this.textAlign === 'right' || this.textAlign === 'end' ? szer : (this.textAlign === 'center' ? szer / 2 : 0));
    // Widoczne jednostki: glif czcionki, jego położenie i – dla zwykłego znaku – sam znak (dla ligatury null).
    const widoczne = [];
    let ligatur = 0;
    jednostki.forEach((j, i) => {
      if (j.glif) { widoczne.push({ glif: j.glif, dx: gdzie.x[i], znak: null }); ligatur += 1; return; }
      const kod = j.napis.codePointAt(0);
      if (fk.hasGlyphForCodePoint(kod)) widoczne.push({ glif: fk.glyphForCodePoint(kod), dx: gdzie.x[i], znak: j.napis });
      else if (!/^[\s­​-‍﻿]$/u.test(j.napis)) throw new Niewektorowe(`znaku „${j.napis}” nie ma w czcionce „${czcionka.klucz.split('|')[0]}”`);
    });
    if (!widoczne.length) return;
    const styl = obrys ? this.strokeStyle : this.fillStyle;
    if (typeof styl !== 'string') throw new Niewektorowe('tekst wypełniony gradientem');
    this.ligaturTeraz += ligatur;

    if (this.opcje.krzywe || czcionka.krzywe) {
      // Tekst zamieniony na krzywe: obrysy znaków jako wypełnione kształty (z pochyleniem, gdy kursywy nie ma w pliku).
      if (!this.opcje.krzywe) this.krzyweTeraz.add(czcionka.krzywe);
      const skala = rozmiar / fk.unitsPerEm;
      const sciezka = [];
      for (const { glif, dx } of widoczne) {
        const p = (gx, gy) => this._p(x0 + dx + (gx + skos * gy) * skala, y - gy * skala);
        let tu = [0, 0];
        for (const { command: co, args: a } of glif.path.commands) {
          if (co === 'moveTo') { sciezka.push(['m', ...p(a[0], a[1])]); tu = [a[0], a[1]]; }
          else if (co === 'lineTo') { sciezka.push(['l', ...p(a[0], a[1])]); tu = [a[0], a[1]]; }
          else if (co === 'bezierCurveTo') { sciezka.push(['c', ...p(a[0], a[1]), ...p(a[2], a[3]), ...p(a[4], a[5])]); tu = [a[4], a[5]]; }
          else if (co === 'quadraticCurveTo') {
            sciezka.push(['c', ...p(tu[0] + (2 / 3) * (a[0] - tu[0]), tu[1] + (2 / 3) * (a[1] - tu[1])), ...p(a[2] + (2 / 3) * (a[0] - a[2]), a[3] + (2 / 3) * (a[1] - a[3])), ...p(a[2], a[3])]);
            tu = [a[2], a[3]];
          } else if (co === 'closePath') sciezka.push(['h']);
        }
      }
      if (obrys) this._obrysuj(sciezka); else this._wypelnij(sciezka, false);
      return;
    }

    // Prawdziwy tekst: znaki osadzonej czcionki ustawione w miejscach z pomiaru przeglądarki.
    // Ligatura to jeden znak czcionki, zapisany jego numerem; czytnik PDF odczyta z niego zwykłe litery.
    const czesci = [];
    widoczne.forEach(({ glif, dx, znak }, i) => {
      czesci.push(znak === null ? `<${czcionka.dopisane.get(glif.id).toString(16).toUpperCase().padStart(4, '0')}>` : pdfFont.encodeText(znak).toString());
      const nastepny = widoczne[i + 1];
      if (!nastepny) return;
      const wlasny = (glif.advanceWidth / fk.unitsPerEm) * rozmiar;
      const poprawka = ((wlasny - (nastepny.dx - dx)) / rozmiar) * 1000;
      if (Math.abs(poprawka) > 0.05) czesci.push(L(poprawka));
    });
    this.op.push('q');
    this._styl(styl, obrys);
    if (obrys) this.op.push(`${L(this.lineWidth)} w`, `${LACZENIA[this.lineJoin] ?? 0} j`);
    this.op.push('BT', `/${this.strona.czcionka(pdfFont)} ${L(rozmiar)} Tf`, `${obrys ? 1 : 0} Tr`, `1 0 0 -1 ${L(x0 + widoczne[0].dx)} ${L(y)} Tm`, `[${czesci.join(' ')}] TJ`, 'ET', 'Q');
  }

  // --- obrazy ---
  drawImage(el, ...a) {
    this._sprawdz();
    if (el?.tagName !== 'IMG') throw new Niewektorowe('obraz przetworzony');
    const nw = el.naturalWidth || el.width; const nh = el.naturalHeight || el.height;
    if (!nw || !nh) return;
    let [sx, sy, sw, sh, dx, dy, dw, dh] = [0, 0, nw, nh, 0, 0, nw, nh];
    if (a.length === 2) [dx, dy] = a;
    else if (a.length === 4) [dx, dy, dw, dh] = a;
    else [sx, sy, sw, sh, dx, dy, dw, dh] = a;
    if (!sw || !sh || !dw || !dh) return;
    // Rysunek SVG rozłożony na kształty idzie jako wektor; gdy się nie da – jako obraz, z powodem w uwagach.
    const svg = this.strona.obrazy.svg.get(el.src);
    if (svg && !svg.brak && this._rysujSvg(svg, nw, nh, [sx, sy, sw, sh, dx, dy, dw, dh])) return;
    if (svg?.brak) this.obrazyTeraz.add(svg.brak);
    // Szerokość w pikselach, jaką obraz zajmie w wybranej rozdzielczości – dla rysunków SVG.
    const skala = Math.hypot(this.m[0], this.m[1]);
    // Szerokość całego obrazu w pikselach przy wybranej rozdzielczości (skala jest w punktach PDF na jednostkę, stąd dzielenie przez PT).
    const nazwa = this.strona.obraz(el, { szerPx: (Math.abs(dw * (nw / sw)) * skala * this.opcje.pikseliNaJednostke) / PT });
    const kx = dw / sw; const ky = dh / sh;
    this.op.push('q');
    this._krycie(this.globalAlpha);
    if (sx > 0.01 || sy > 0.01 || sw < nw - 0.01 || sh < nh - 0.01) this.op.push(`${L(dx)} ${L(dy)} ${L(dw)} ${L(dh)} re`, 'W n');
    this.op.push(`${L(nw * kx)} 0 0 ${L(-nh * ky)} ${L(dx - sx * kx)} ${L(dy - sy * ky + nh * ky)} cm`, `/${nazwa} Do`, 'Q');
  }
}

// Rysunek SVG jako kształty w miejscu obrazu: układ rysunku → kadr → prostokąt docelowy, przycięte do kadru.
// Zwraca false (i cofa to, co zdążył zapisać), gdy któregoś kształtu nie da się zapisać wektorowo.
KontekstPdf.prototype._rysujSvg = function rysujSvg(svg, nw, nh, [sx, sy, sw, sh, dx, dy, dw, dh]) {
  const przed = { op: this.op.length, stos: this.stos.length, m: this.m, kreski: this.kreski, sciezka: this.sciezka, stan: Object.fromEntries(STAN.map((k) => [k, this[k]])) };
  const kx = dw / sw; const ky = dh / sh;
  try {
    this.save();
    this.beginPath(); this.rect(dx, dy, dw, dh); this.clip();
    this.transform((kx * nw) / svg.w, 0, 0, (ky * nh) / svg.h, dx - sx * kx, dy - sy * ky);
    for (const o of svg.obiekty) { this.save(); o.render(this); this.restore(); }
    this.restore();
    this.sciezka = przed.sciezka;
    return true;
  } catch (e) {
    if (!e.niewektorowe) throw e;
    this.op.length = przed.op; this.stos.length = przed.stos; this.m = przed.m; this.kreski = przed.kreski; this.sciezka = przed.sciezka;
    Object.assign(this, przed.stan);
    svg.brak = `rysunek SVG: ${e.message}`; // na kolejnych stronach od razu jako obraz
    return false;
  }
};

// Nieznane polecenia kontekstu kończą próbę wektorową – element trafi do PDF jako obraz.
const ostrozny = (ctx) => new Proxy(ctx, {
  get(cel, nazwa) {
    if (nazwa in cel || typeof nazwa !== 'string') return cel[nazwa];
    return () => { throw new Niewektorowe(`polecenie ${nazwa}`); };
  },
});

// ---------- Strona ----------

// Zasoby strony PDF: czcionki, obrazy, przezroczystości, gradienty.
class StronaPdf {
  constructor(PDFLib, pdf, strona, obrazy) {
    Object.assign(this, { PDFLib, pdf, strona, obrazy });
    this.uzyteCzcionki = new Set();
    this.nazwy = new Map();
    this.czekaja = [];
    this.nr = 0;
  }

  _nazwa(klucz, tworz) {
    if (!this.nazwy.has(klucz)) { this.nr += 1; const n = `Z${this.nr}`; this.nazwy.set(klucz, n); tworz(this.PDFLib.PDFName.of(n)); }
    return this.nazwy.get(klucz);
  }

  _slownik(rodzaj) {
    const { PDFName, PDFDict } = this.PDFLib;
    const { Resources } = this.strona.node.normalizedEntries();
    let s = Resources.lookupMaybe(PDFName.of(rodzaj), PDFDict);
    if (!s) { s = this.pdf.context.obj({}); Resources.set(PDFName.of(rodzaj), s); }
    return s;
  }

  czcionka(pdfFont) { this.uzyteCzcionki.add(pdfFont); return this._nazwa(pdfFont, (n) => this.strona.node.setFontDictionary(n, pdfFont.ref)); }

  krycie(a) {
    const w = Math.round(a * 1000) / 1000;
    return this._nazwa(`krycie ${w}`, (n) => this._slownik('ExtGState').set(n, this.pdf.context.obj({ Type: 'ExtGState', ca: w, CA: w })));
  }

  obraz(el, opcje) {
    return this._nazwa(el, (n) => { this.czekaja.push(this.obrazy.osadz(el, opcje).then((o) => this.strona.node.setXObject(n, o.ref))); });
  }

  obrazGotowy(pdfImage) { return this._nazwa(pdfImage, (n) => this.strona.node.setXObject(n, pdfImage.ref)); }

  // cmyk: funkcja przeliczająca kolor [r, g, b] na CMYK albo null (gradient zostaje w RGB).
  cieniowanie(g, cmyk) {
    return this._nazwa(g, (n) => {
      const kolory = [...g.kolory].sort((a, b) => a[0] - b[0]);
      if (!kolory.length) throw new Niewektorowe('gradient bez kolorów');
      if (kolory.some(([, k]) => k[3] < 1)) throw new Niewektorowe('gradient z przezroczystością');
      if (kolory.length === 1) kolory.push([1, kolory[0][1]]);
      const barwa = (k) => (cmyk ? cmyk(k) : k.slice(0, 3));
      // Punkty od 0 do 1: kolor przed pierwszym i za ostatnim przystankiem jest stały.
      const pkt = kolory.map(([miejsce, k]) => [miejsce, barwa(k)]);
      if (pkt[0][0] > 0) pkt.unshift([0, pkt[0][1]]);
      if (pkt.at(-1)[0] < 1) pkt.push([1, pkt.at(-1)[1]]);
      for (let i = 1; i < pkt.length; i += 1) if (pkt[i][0] <= pkt[i - 1][0]) pkt[i][0] = pkt[i - 1][0] + 1e-4;
      const odcinki = pkt.slice(0, -1).map((p, i) => ({ FunctionType: 2, Domain: [0, 1], C0: p[1], C1: pkt[i + 1][1], N: 1 }));
      const funkcja = odcinki.length === 1 ? odcinki[0] : {
        FunctionType: 3, Domain: [0, 1], Functions: odcinki, Bounds: pkt.slice(1, -1).map((p) => p[0]), Encode: odcinki.flatMap(() => [0, 1]),
      };
      const opis = { ShadingType: g.rodzaj === 'kolowy' ? 3 : 2, ColorSpace: cmyk ? 'DeviceCMYK' : 'DeviceRGB', Coords: g.wsp, Function: funkcja, Extend: [true, true] };
      this._slownik('Shading').set(n, this.pdf.context.register(this.pdf.context.obj(opis)));
    });
  }
}

const bezPamieci = (o) => { o.objectCaching = false; o.dirty = true; for (const d of o._objects || []) bezPamieci(d); };
const maMaske = (o) => Boolean(o.clipPath) || (o._objects || []).some(maMaske);
// Przycięcie zwykłym prostokątem liczonym względem elementu (grupa z rozłożonego rysunku SVG) da się zapisać
// w PDF jako ścieżka przycinania – element zostaje wektorowy.
const prostyKadr = (o) => {
  const k = o.clipPath;
  return k && k.type === 'rect' && !k.rx && !k.ry && !k.inverted && !k.absolutePositioned && !k.clipPath && !(o._objects || []).some(maMaske) ? k : null;
};

// Rysuje stronę na stronie PDF.
// srodowisko: { PDFLib, pdf, czcionki: CzcionkiPdf, obrazy: ObrazyPdf, cmyk, krzywe, dpi, uwagi: Map(powód → liczba elementów
// zapisanych jako obraz), jakoKrzywe: Map(czcionka → liczba elementów z tekstem zapisanym jako krzywe),
// ligatury: { ile } – licznik ligatur zapisanych w pliku }
// m: wymiary z wymiaryStronyPdf (w, h, spad, pas) w mm; obiekty: żywe obiekty Fabric w układzie strony (mm).
export async function rysujStroneWektorowo(srodowisko, strona, { obiekty, tlo, m }) {
  const { PDFLib, pdf, czcionki, obrazy, cmyk = false, krzywe = false, dpi = 300, uwagi } = srodowisko;
  await czcionki.przygotuj(obiekty);
  await obrazy.przygotujSvg(obiekty, czcionki);
  const dolicz = (mapa, powody) => { if (mapa) for (const p of powody) mapa.set(p, (mapa.get(p) || 0) + 1); };
  const zasoby = new StronaPdf(PDFLib, pdf, strona, obrazy);
  // Kolory tekstu i kształtów w CMYK: przez profil drukarni, gdy jest (PDF/X), inaczej prostym wzorem.
  const { silnik = null } = srodowisko;
  const opcje = { cmyk, krzywe, pikseliNaJednostke: dpi / 25.4, naCmyk: silnik ? (k) => silnik.wektor(k[0], k[1], k[2]) : naCmyk };
  const ctx = new KontekstPdf(zasoby, czcionki, opcje);
  const pole = [-m.spad, -m.spad, m.w + 2 * m.spad, m.h + 2 * m.spad];

  ctx.save();
  // Milimetry strony (oś Y w dół) → punkty PDF (oś Y w górę); początek w rogu strony po obcięciu.
  ctx.transform(PT, 0, 0, -PT, m.pas * PT, (m.h + m.pas) * PT);
  ctx.beginPath(); ctx.rect(...pole); ctx.clip();
  ctx.fillStyle = tlo || '#ffffff';
  ctx.fillRect(...pole);
  ctx.beginPath();

  for (const o of obiekty) {
    if (o.visible === false) continue;
    const przed = { op: ctx.op.length, stos: ctx.stos.length, m: ctx.m, stan: Object.fromEntries(STAN.map((k) => [k, ctx[k]])), kreski: ctx.kreski, czcionki: [...zasoby.uzyteCzcionki] };
    try {
      const kadr = prostyKadr(o);
      if (!kadr && maMaske(o)) throw new Niewektorowe('element przycięty maską');
      bezPamieci(o);
      ctx.krzyweTeraz = new Set(); ctx.obrazyTeraz = new Set(); ctx.ligaturTeraz = 0;
      ctx.save();
      if (kadr) {
        // Ścieżka przycinania w układzie elementu; potem rysowanie wraca do układu strony.
        const uklad = ctx.getTransform();
        ctx.transform(...fabric.util.multiplyTransformMatrices(o.calcTransformMatrix(), kadr.calcTransformMatrix()));
        ctx.beginPath(); ctx.rect(-kadr.width / 2, -kadr.height / 2, kadr.width, kadr.height); ctx.clip(); ctx.beginPath();
        ctx.setTransform(uklad);
        o.clipPath = undefined;
      }
      try { o.render(ostrozny(ctx)); } finally { if (kadr) o.clipPath = kadr; }
      ctx.restore();
      if (ctx.stos.length !== przed.stos) throw new Niewektorowe('niedomknięty stan rysowania');
      // Element zapisany wektorowo, ale z częścią jako krzywe albo z rysunkiem SVG jako obrazem.
      dolicz(srodowisko.jakoKrzywe, ctx.krzyweTeraz);
      dolicz(uwagi, ctx.obrazyTeraz);
      if (srodowisko.ligatury) srodowisko.ligatury.ile += ctx.ligaturTeraz;
    } catch (e) {
      if (!e.niewektorowe) throw e;
      // Cofnięcie tego, co element zdążył zapisać, i wstawienie go jako obrazu.
      ctx.op.length = przed.op; ctx.stos.length = przed.stos; ctx.m = przed.m; ctx.kreski = przed.kreski; Object.assign(ctx, przed.stan);
      ctx.sciezka = [];
      uwagi?.set(e.message, (uwagi.get(e.message) || 0) + 1);
      zasoby.uzyteCzcionki = new Set(przed.czcionki);
      await wstawJakoObraz(ctx, zasoby, obrazy, o, pole, dpi);
    }
  }
  ctx.restore();
  await Promise.all(zasoby.czekaja);
  for (const f of zasoby.uzyteCzcionki) srodowisko.uzyteCzcionki?.add(f);
  const { PDFOperator } = PDFLib;
  // Każde polecenie to gotowy wiersz strumienia; nazwa polecenia jest jego ostatnim słowem.
  strona.pushOperators(...ctx.op.map((w) => { const i = w.lastIndexOf(' '); return i < 0 ? PDFOperator.of(w) : PDFOperator.of(w.slice(i + 1), [w.slice(0, i)]); }));
}

// Element, którego nie da się zapisać wektorowo: obraz PNG z przezroczystością, w wybranej rozdzielczości.
async function wstawJakoObraz(ctx, zasoby, obrazy, o, pole, dpi) {
  o.setCoords();
  const rogi = Object.values(o.aCoords || {});
  if (!rogi.length) return;
  const c = o.shadow ? (o.shadow.blur || 0) + Math.max(Math.abs(o.shadow.offsetX || 0), Math.abs(o.shadow.offsetY || 0)) : 0;
  const zapas = 1 + c * Math.max(1, Math.abs(o.scaleX || 1), Math.abs(o.scaleY || 1));
  const x0 = Math.max(pole[0], Math.min(...rogi.map((p) => p.x)) - zapas);
  const y0 = Math.max(pole[1], Math.min(...rogi.map((p) => p.y)) - zapas);
  const x1 = Math.min(pole[0] + pole[2], Math.max(...rogi.map((p) => p.x)) + zapas);
  const y1 = Math.min(pole[1] + pole[3], Math.max(...rogi.map((p) => p.y)) + zapas);
  if (!(x1 > x0) || !(y1 > y0)) return;
  let k = dpi / 25.4;
  k = Math.min(k, Math.sqrt(MAX_PIKSELI_OBRAZU / ((x1 - x0) * (y1 - y0))));
  // Zwykłe płótno edytora (bez ekranu): cień i maski rysują się na nim tak jak w podglądzie.
  const plotno = new fabric.StaticCanvas(undefined, {
    width: Math.max(1, Math.round((x1 - x0) * k)), height: Math.max(1, Math.round((y1 - y0) * k)), enableRetinaScaling: false, renderOnAddRemove: false,
  });
  plotno.setViewportTransform([k, 0, 0, k, -x0 * k, -y0 * k]);
  plotno.add(o);
  plotno.renderAll();
  const obraz = await obrazy.osadzPlotno(plotno.toCanvasElement());
  plotno.remove(o);
  plotno.dispose();
  const nazwa = zasoby.obrazGotowy(obraz);
  ctx.op.push('q', `${L(x1 - x0)} 0 0 ${L(-(y1 - y0))} ${L(x0)} ${L(y1)} cm`, `/${nazwa} Do`, 'Q');
}
