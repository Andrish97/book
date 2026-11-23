// Zapis do Scribusa (#220): plik .sla w formacie Scribusa 1.5 (otwiera go Scribus 1.5 i 1.6) – strony
// w kolejności druku (serie rozwinięte, dane podstawione), ze spadem i marginesami sekcji. Teksty idą jako
// edytowalne ramki tekstowe (czcionka, wielkość, kolor, pogrubienie, kursywa, podkreślenie, wyrównanie,
// interlinia, akapity), prostokąty, elipsy, wielokąty, linie i ścieżki – jako kształty Scribusa z kolorami;
// wszystko inne (zdjęcia z kadrem i filtrami, tabele, grupy, gradienty, cienie, przezroczystość) – jako obraz
// strony osadzony w pliku (bez osobnych plików obok). Format sprawdzony z czytnikiem Scribusa
// (scribus150format.cpp): położenia w punktach, w układzie całego dokumentu; obrót wokół lewego górnego rogu.

/* global fabric */
import { zlozCel } from './zlozenie.js';
import { rozwin } from './serie.js';
import { sekcjaStrony } from './projekt.js';
import { plytaUszlachetnienia } from './kolory-druku.js';
import { powodObrazu, uwagiProjektu, uwagiTekstu } from './raport-przeniesienia.js';
import { t } from './jezyk.js';

export const PT = 72 / 25.4; // mm → pt
const ODSTEP_STRON = 40; // pt między stronami w widoku Scribusa
const START_X = 100; // obszar roboczy Scribusa (ScratchLeft / ScratchTop)
const START_Y = 20;
const DPI_OBRAZOW = 300;
const MAKS_PX = 5000;

const liczba = (x) => String(Math.round(x * 1000) / 1000);
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const atrybuty = (a) => Object.entries(a).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}="${xml(typeof v === 'number' ? liczba(v) : v)}"`).join(' ');

// ---------- Kolory ----------

export function hex(kolor) {
  if (!kolor || typeof kolor !== 'string') return null;
  const c = new fabric.Color(kolor);
  const [r, g, b, a] = c.getSource();
  if (a === 0) return null;
  return { hex: `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`, r, g, b, a };
}

class Kolory {
  constructor() { this.mapa = new Map(); }
  // Nazwa koloru w Scribusie albo 'None' (brak / przezroczysty).
  nazwa(kolor) {
    const h = hex(kolor);
    if (!h) return 'None';
    if (!this.mapa.has(h.hex)) this.mapa.set(h.hex, h);
    return `Makietka ${h.hex}`;
  }
  xml() {
    return [...this.mapa.values()].map((h) => `  <COLOR ${atrybuty({ NAME: `Makietka ${h.hex}`, SPACE: 'RGB', R: h.r, G: h.g, B: h.b })}/>`).join('\n');
  }
}

// ---------- Geometria ----------

// Ramka elementu bez obrotu: lewy górny róg (mm, na stronie), szerokość, wysokość i kąt – albo null,
// gdy elementu nie da się tak opisać (pochylenie, odbicie) – wtedy idzie jako obraz.
export function ramka(o) {
  const m = o.calcTransformMatrix();
  const d = fabric.util.qrDecompose(m);
  if (Math.abs(d.skewX) > 0.01 || Math.abs(d.skewY || 0) > 0.01 || d.scaleX < 0 || d.scaleY < 0 || o.flipX || o.flipY) return null;
  const w = o.width * d.scaleX;
  const h = o.height * d.scaleY;
  const lg = fabric.util.transformPoint(new fabric.Point(-o.width / 2, -o.height / 2), m);
  return { x: lg.x, y: lg.y, w, h, kat: d.angle, sx: d.scaleX, sy: d.scaleY };
}

// Ścieżka SVG w układzie ramki (pt) dla kształtu – albo null, gdy to nie prosty kształt.
export function sciezkaKsztaltu(o, r) {
  const W = r.w * PT;
  const H = r.h * PT;
  const t = String(o.type).toLowerCase();
  if (t === 'rect') {
    if ((o.rx || 0) > 0 || (o.ry || 0) > 0) {
      const rx = Math.min(o.rx || o.ry, o.width / 2) * r.sx * PT;
      const ry = Math.min(o.ry || o.rx, o.height / 2) * r.sy * PT;
      const k = 0.5523;
      return `M${rx} 0 L${W - rx} 0 C${W - rx + rx * k} 0 ${W} ${ry - ry * k} ${W} ${ry} L${W} ${H - ry} C${W} ${H - ry + ry * k} ${W - rx + rx * k} ${H} ${W - rx} ${H} L${rx} ${H} C${rx - rx * k} ${H} 0 ${H - ry + ry * k} 0 ${H - ry} L0 ${ry} C0 ${ry - ry * k} ${rx - rx * k} 0 ${rx} 0 Z`;
    }
    return `M0 0 L${W} 0 L${W} ${H} L0 ${H} L0 0 Z`;
  }
  if (t === 'ellipse' || t === 'circle') {
    const k = 0.5523;
    const a = W / 2;
    const b = H / 2;
    return `M${a} 0 C${a + a * k} 0 ${W} ${b - b * k} ${W} ${b} C${W} ${b + b * k} ${a + a * k} ${H} ${a} ${H} C${a - a * k} ${H} 0 ${b + b * k} 0 ${b} C0 ${b - b * k} ${a - a * k} 0 ${a} 0 Z`;
  }
  if (t === 'triangle') return `M${W / 2} 0 L${W} ${H} L0 ${H} Z`;
  // Punkty w układzie obiektu (środek w 0,0) → układ ramki w pt.
  const p = (x, y) => `${liczba((x + o.width / 2) * r.sx * PT)} ${liczba((y + o.height / 2) * r.sy * PT)}`;
  const off = o.pathOffset || { x: 0, y: 0 };
  if (t === 'polygon' || t === 'polyline') {
    const pkt = (o.points || []).map((q) => p(q.x - off.x, q.y - off.y));
    if (pkt.length < 2) return null;
    return `M${pkt.join(' L')}${t === 'polygon' ? ' Z' : ''}`;
  }
  if (t === 'line') {
    const { x1, y1, x2, y2 } = o.calcLinePoints();
    return `M${p(x1, y1)} L${p(x2, y2)}`;
  }
  if (t === 'path') {
    const czesci = [];
    for (const k of o.path || []) {
      const [c, ...v] = k;
      const pary = [];
      for (let i = 0; i + 1 < v.length; i += 2) pary.push(p(v[i] - off.x, v[i + 1] - off.y));
      if (c === 'M' || c === 'L' || c === 'C') czesci.push(`${c}${pary.join(' ')}`);
      else if (c === 'Q' && pary.length === 2) czesci.push(`Q${pary.join(' ')}`);
      else if (c === 'Z' || c === 'z') czesci.push('Z');
      else return null; // łuki i polecenia względne – Fabric zwykle je zamienia; inaczej obraz
    }
    return czesci.join(' ');
  }
  return null;
}

export const TYPY_KSZTALTOW = new Set(['rect', 'ellipse', 'circle', 'triangle', 'polygon', 'polyline', 'line', 'path']);
export const zwyklyKolor = (k) => k == null || k === '' || typeof k === 'string';
export const bezEfektow = (o) => !o.shadow && (o.opacity ?? 1) >= 0.999 && !o.clipPath && !o.filters?.length && (o.globalCompositeOperation || 'source-over') === 'source-over';

// ---------- Tekst ----------

const ALIGN = { left: 0, center: 1, right: 2, justify: 3, 'justify-left': 3, 'justify-center': 3, 'justify-right': 3 };

export function nazwaCzcionki(rodzina, waga, styl) {
  const { rodzina: r, odmiana } = czcionkaElementu(rodzina, waga, styl);
  return `${r} ${odmiana}`;
}

// Czcionki, których odmiany nazywają się inaczej niż Regular/Italic (nazwa odmiany w pliku czcionki) – inaczej Scribus
// i InDesign nie znajdą czcionki i podstawią inną (Scribus pyta wtedy o zamiennik).
const NAZWY_ODMIAN = {
  'DejaVu Sans': { Regular: 'Book', Italic: 'Oblique', 'Bold Italic': 'Bold Oblique' },
  'DejaVu Sans Mono': { Regular: 'Book', Italic: 'Oblique', 'Bold Italic': 'Bold Oblique' },
  'DejaVu Sans Condensed': { Regular: 'Condensed', Italic: 'Condensed Oblique', Bold: 'Condensed Bold', 'Bold Italic': 'Condensed Bold Oblique' },
  'DejaVu Serif': { Regular: 'Book' },
  Helvetica: { Italic: 'Oblique', 'Bold Italic': 'Bold Oblique' },
  'Courier New': {},
};

// Rodzina (bez zapasowych z CSS) i odmiana: Regular, Bold, Italic albo Bold Italic.
export function czcionkaElementu(rodzina, waga, styl) {
  const gruba = waga === 'bold' || Number(waga) >= 600;
  const kursywa = styl === 'italic' || styl === 'oblique';
  const odmiana = gruba && kursywa ? 'Bold Italic' : gruba ? 'Bold' : kursywa ? 'Italic' : 'Regular';
  const r = String(rodzina || 'Arial').split(',')[0].replace(/["']/g, '').trim();
  return { rodzina: r, odmiana: NAZWY_ODMIAN[r]?.[odmiana] || odmiana };
}

function storyText(o, r, kolory, czcionki) {
  const tekst = String(o.text ?? '');
  const skala = r.sy;
  const align = ALIGN[o.textAlign] ?? 0;
  const odstep = (o.fontSize || 4) * skala * PT * (o.lineHeight || 1.16) * (o._fontSizeMult || 1.13);
  const para = atrybuty({ ALIGN: align, LINESPMode: 0, LINESP: odstep });
  const czesci = [`<DefaultStyle ${para}/>`];
  let bufor = '';
  let poprzedni = null;
  const wypisz = () => {
    if (bufor) czesci.push(`<ITEXT ${poprzedni} CH="${xml(bufor)}"/>`);
    bufor = '';
  };
  for (let i = 0; i < tekst.length; i++) {
    const zn = tekst[i];
    if (zn === '\n') { wypisz(); poprzedni = null; czesci.push(`<para ${para}/>`); continue; }
    const s = o.getStyleAtPosition ? o.getStyleAtPosition(i, true) : o;
    const font = nazwaCzcionki(s.fontFamily ?? o.fontFamily, s.fontWeight ?? o.fontWeight, s.fontStyle ?? o.fontStyle);
    czcionki.add(font);
    const cechy = [(s.underline ?? o.underline) && 'underline', (s.linethrough ?? o.linethrough) && 'strike'].filter(Boolean).join(' ');
    const wyglad = atrybuty({
      FONT: font,
      FONTSIZE: (s.fontSize ?? o.fontSize) * skala * PT,
      FCOLOR: kolory.nazwa(typeof (s.fill ?? o.fill) === 'string' ? (s.fill ?? o.fill) : '#000000'),
      KERN: (s.charSpacing ?? o.charSpacing ?? 0) / 10,
      FEATURES: cechy || undefined,
    });
    if (wyglad !== poprzedni) { wypisz(); poprzedni = wyglad; }
    bufor += zn;
  }
  wypisz();
  czesci.push(`<trail ${para}/>`);
  return `<StoryText>${czesci.join('')}</StoryText>`;
}

// ---------- Obraz elementu ----------

// Rozdzielczość zapisana w pliku PNG (blok pHYs) – bez niej Scribus przyjmuje 96 dpi, a InDesign 72 dpi
// i obraz wychodzi w innym rozmiarze niż ramka.
const TABLICA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = TABLICA_CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export async function zRozdzielczoscia(blob, dpi) {
  const b = new Uint8Array(await blob.arrayBuffer());
  if (b[0] !== 0x89 || b[1] !== 0x50) return blob;
  const ppm = Math.round(dpi / 0.0254);
  const kawalek = new Uint8Array(21);
  const dv = new DataView(kawalek.buffer);
  dv.setUint32(0, 9);
  kawalek.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); kawalek[16] = 1;
  dv.setUint32(17, crc32(kawalek.subarray(4, 17)));
  const poIhdr = 8 + 25; // sygnatura + IHDR (4 + 4 + 13 + 4)
  const wynik = new Uint8Array(b.length + 21);
  wynik.set(b.subarray(0, poIhdr)); wynik.set(kawalek, poIhdr); wynik.set(b.subarray(poIhdr), poIhdr + 21);
  return new Blob([wynik], { type: 'image/png' });
}

// Wysokość ramki tekstu dla programów do składu: silnik edytora liczy ostatni wiersz bez odstępu interlinii,
// a Scribus i InDesign nie pokażą wiersza, który nie mieści się w ramce w całości – zapas na pełną interlinię.
export function zapasRamki(o, skala = 1) {
  const r = (o.fontSize || 4) * skala;
  return Math.max(0, r * ((o.lineHeight || 1.16) * (o._fontSizeMult || 1.13) - (o._fontSizeMult || 1.13))) + r * 0.25;
}

export async function obrazElementu(o) {
  const b = o.getBoundingRect();
  if (!(b.width > 0 && b.height > 0)) return null;
  const k = Math.min(DPI_OBRAZOW / 25.4, MAKS_PX / b.width, MAKS_PX / b.height);
  const W = Math.max(1, Math.ceil(b.width * k));
  const H = Math.max(1, Math.ceil(b.height * k));
  const plotno = new fabric.StaticCanvas(undefined, { width: W, height: H, renderOnAddRemove: false, enableRetinaScaling: false });
  try {
    plotno.viewportTransform = [k, 0, 0, k, -b.left * k, -b.top * k];
    plotno.add(o);
    plotno.renderAll();
    const surowy = await new Promise((ok) => plotno.getElement().toBlob(ok, 'image/png'));
    plotno.remove(o);
    const blob = surowy && await zRozdzielczoscia(surowy, k * 25.4);
    return blob ? { blob, x: b.left, y: b.top, w: b.width, h: b.height, px: W, py: H, dpi: k * 25.4 } : null;
  } finally {
    plotno.dispose();
  }
}

// qCompress Qt: 4 bajty długości (big-endian) + strumień zlib, całość w base64 – tak Scribus czyta obrazy w pliku.
async function qCompressBase64(blob) {
  const dane = new Uint8Array(await blob.arrayBuffer());
  const zlib = new Uint8Array(await new Response(new Blob([dane]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const wynik = new Uint8Array(4 + zlib.length);
  new DataView(wynik.buffer).setUint32(0, dane.length);
  wynik.set(zlib, 4);
  let s = '';
  for (let i = 0; i < wynik.length; i += 0x8000) s += String.fromCharCode.apply(null, wynik.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---------- Dokument ----------

export async function zapiszSla(projekt, { ciag = rozwin(projekt), egzemplarze = null, postep, raport = null } = {}) {
  if (raport && !egzemplarze) uwagiProjektu(projekt, raport);
  const kolory = new Kolory();
  const czcionki = new Set();
  const egz = egzemplarze || ciag.egzemplarze;
  const strony = [];
  const obiekty = [];
  const ile = { teksty: 0, ksztalty: 0, obrazy: 0 };
  let id = 1;
  let y = START_Y;
  let wydrukDok = null;

  for (let n = 0; n < egz.length; n++) {
    postep?.(n, egz.length);
    const e = egz[n];
    const { wydruk, tlo, obiekty: lista } = await zlozCel(projekt, e, { ciag, oryginaly: true, bezPodloza: true });
    wydrukDok ||= wydruk;
    const W = wydruk.szerokosc_mm * PT;
    const H = wydruk.wysokosc_mm * PT;
    const spad = (wydruk.spad_mm || 0) * PT;
    const m = wydruk.marginesy || {};
    const lewa = e.bok === 'lewa';
    const px = START_X;
    const py = y + spad;
    strony.push(`  <PAGE ${atrybuty({
      PAGEXPOS: px, PAGEYPOS: py, PAGEWIDTH: W, PAGEHEIGHT: H,
      BORDERLEFT: (lewa ? m.zewnetrzny : m.wewnetrzny ?? 0) * PT, BORDERRIGHT: (lewa ? m.wewnetrzny : m.zewnetrzny ?? 0) * PT,
      BORDERTOP: (m.gora ?? 0) * PT, BORDERBOTTOM: (m.dol ?? 0) * PT,
      NUM: n, NAM: '', MNAM: 'Normal', Size: 'Custom', Orientation: W > H ? 1 : 0, LEFT: lewa ? 1 : 0, PRESET: 0,
      VerticalGuides: '', HorizontalGuides: '',
    })}/>`);
    const naDok = (xmm, ymm) => ({ x: px + xmm * PT, y: py + ymm * PT });
    const wspolne = (r) => ({ OwnPage: n, ItemID: id++, LAYER: 0, NEXTITEM: -1, BACKITEM: -1, ROT: r.kat || 0 });

    // Tło strony (bez podłoża – biel to brak farby): prostokąt na całą stronę ze spadem.
    const t = hex(typeof tlo === 'string' ? tlo : null);
    if (t && t.hex !== '#ffffff') {
      const p = naDok(-(wydruk.spad_mm || 0), -(wydruk.spad_mm || 0));
      const w = W + 2 * spad;
      const h = H + 2 * spad;
      const sc = `M0 0 L${w} 0 L${w} ${h} L0 ${h} L0 0 Z`;
      obiekty.push(`  <PAGEOBJECT ${atrybuty({ ...wspolne({}), XPOS: p.x, YPOS: p.y, WIDTH: w, HEIGHT: h, PTYPE: 6, FRTYPE: 0, PCOLOR: kolory.nazwa(t.hex), PCOLOR2: 'None', PWIDTH: 0, ANNAME: 'Tło strony', path: sc, copath: sc })}/>`);
    }

    for (const o of lista) {
      if (o.visible === false) continue;
      const m = { idStrony: e.strona?.id, idObiektu: o.id, nr: n + 1 };
      const usz = plytaUszlachetnienia(o);
      if (usz?.techniczna) { raport?.dodaj('pominiete', 'linie wykrojnika (cięcie, big, perforacja, klej) – są w pliku dla plotera', m); continue; } // (#218)
      if (usz) raport?.dodaj('uproszczone', 'uszlachetnienie (złocenie, lakier, tłoczenie, biały poddruk) jako zwykły element – bez osobnej płyty', m);
      const typ = String(o.type).toLowerCase();
      const r = ramka(o);
      // Tekst – ramka tekstowa Scribusa.
      if (r && typ === 'textbox' && !o.tabela && bezEfektow(o) && zwyklyKolor(o.fill)) {
        const p = naDok(r.x, r.y);
        obiekty.push(`  <PAGEOBJECT ${atrybuty({
          ...wspolne(r), XPOS: p.x, YPOS: p.y, WIDTH: r.w * PT, HEIGHT: (r.h + zapasRamki(o, r.sy)) * PT, PTYPE: 4, FRTYPE: 0,
          PCOLOR: kolory.nazwa(o.backgroundColor), PCOLOR2: 'None', PWIDTH: 0, COLUMNS: 1, COLGAP: 0,
          EXTRA: 0, TEXTRA: 0, BEXTRA: 0, REXTRA: 0, ANNAME: (o.text || 'Tekst').slice(0, 40),
          path: `M0 0 L${r.w * PT} 0 L${r.w * PT} ${(r.h + zapasRamki(o, r.sy)) * PT} L0 ${(r.h + zapasRamki(o, r.sy)) * PT} L0 0 Z`,
        })}>${storyText(o, r, kolory, czcionki)}</PAGEOBJECT>`);
        ile.teksty += 1;
        raport?.bezZmian();
        if (raport) uwagiTekstu(o, raport, m);
        continue;
      }
      // Prosty kształt – wielokąt Scribusa (linia – PTYPE 5).
      const sciezka = r && TYPY_KSZTALTOW.has(typ) && bezEfektow(o) && zwyklyKolor(o.fill) && zwyklyKolor(o.stroke) && !o.strokeDashArray?.length ? sciezkaKsztaltu(o, r) : null;
      if (sciezka) {
        const p = naDok(r.x, r.y);
        const kreska = o.stroke && (o.strokeWidth || 0) > 0 ? kolory.nazwa(o.stroke) : 'None';
        const grubosc = kreska === 'None' ? 0 : o.strokeWidth * (o.strokeUniform ? 1 : Math.max(r.sx, r.sy)) * PT;
        const linia = typ === 'line' || typ === 'polyline';
        obiekty.push(`  <PAGEOBJECT ${atrybuty({
          ...wspolne(r), XPOS: p.x, YPOS: p.y, WIDTH: Math.max(r.w * PT, 0.01), HEIGHT: Math.max(r.h * PT, 0.01),
          PTYPE: linia ? 7 : 6, FRTYPE: typ === 'ellipse' || typ === 'circle' ? 1 : typ === 'rect' && !o.rx ? 0 : 3, CLIPEDIT: 1, PCOLOR: linia ? 'None' : kolory.nazwa(o.fill), PCOLOR2: kreska, PWIDTH: grubosc,
          ANNAME: typ, path: sciezka, copath: sciezka,
        })}/>`);
        ile.ksztalty += 1;
        raport?.bezZmian();
        continue;
      }
      // Reszta – obraz osadzony w pliku.
      const obraz = await obrazElementu(o);
      if (!obraz) continue;
      const powod = powodObrazu(o);
      if (powod) raport?.dodaj('obraz', powod, m); else raport?.bezZmian();
      const p = naDok(obraz.x, obraz.y);
      const w = obraz.w * PT;
      const h = obraz.h * PT;
      obiekty.push(`  <PAGEOBJECT ${atrybuty({
        OwnPage: n, ItemID: id++, LAYER: 0, NEXTITEM: -1, BACKITEM: -1, ROT: 0,
        XPOS: p.x, YPOS: p.y, WIDTH: w, HEIGHT: h, PTYPE: 2, FRTYPE: 0, PCOLOR: 'None', PCOLOR2: 'None', PWIDTH: 0,
        SCALETYPE: 0, RATIO: 0, LOCALSCX: 1, LOCALSCY: 1, LOCALX: 0, LOCALY: 0,
        isInlineImage: 1, inlineImageExt: 'png', ImageData: await qCompressBase64(obraz.blob),
        ANNAME: o.nazwa || typ, path: `M0 0 L${w} 0 L${w} ${h} L0 ${h} L0 0 Z`,
      })}/>`);
      ile.obrazy += 1;
    }
    y = py + H + spad + ODSTEP_STRON;
  }
  postep?.(egz.length, egz.length);

  const w = wydrukDok || sekcjaStrony(projekt, projekt.strony[0])?.wydruk || { szerokosc_mm: 210, wysokosc_mm: 297, spad_mm: 3, marginesy: {} };
  const m = w.marginesy || {};
  const spad = (w.spad_mm || 0) * PT;
  const ksiazka = egz.some((e) => e.bok === 'lewa');
  const pierwsza = czcionki.values().next().value || 'Arial Regular';
  const dokument = atrybuty({
    ANZPAGES: egz.length, PAGEWIDTH: w.szerokosc_mm * PT, PAGEHEIGHT: w.wysokosc_mm * PT,
    BORDERLEFT: (m.wewnetrzny ?? 0) * PT, BORDERRIGHT: (m.zewnetrzny ?? 0) * PT, BORDERTOP: (m.gora ?? 0) * PT, BORDERBOTTOM: (m.dol ?? 0) * PT,
    PRESET: 0, ORIENTATION: 0, PAGESIZE: 'Custom', FIRSTNUM: 1, BOOK: ksiazka ? 1 : 0, UNITS: 1, LANGUAGE: 'pl',
    BleedTop: spad, BleedLeft: spad, BleedRight: spad, BleedBottom: spad,
    DFONT: pierwsza, DSIZE: 12, AUTOSPALTEN: 1, ABSTSPALTEN: 11, ScratchLeft: START_X, ScratchRight: 100, ScratchTop: START_Y, ScratchBottom: 20,
    GapHorizontal: 0, GapVertical: ODSTEP_STRON, TITLE: projekt.nazwa || '', AUTHOR: 'Makietka', COMMENTS: 'Zapisano w Makietce (makietka.app)',
  });
  const sla = `<?xml version="1.0" encoding="UTF-8"?>
<SCRIBUSUTF8NEW Version="1.5.8">
 <DOCUMENT ${dokument}>
${kolory.xml()}
  <LAYERS ${atrybuty({ NUMMER: 0, LEVEL: 0, NAME: 'Makietka', SICHTBAR: 1, DRUCKEN: 1, EDIT: 1, SELECT: 0, FLOW: 1, TRANS: 1, BLEND: 0, OUTL: 0, LAYERC: '#000000' })}/>
  <PageSets>
   <Set ${atrybuty({ Name: 'Single Page', FirstPage: 0, Rows: 1, Columns: 1 })}/>
   <Set ${atrybuty({ Name: 'Facing Pages', FirstPage: 1, Rows: 1, Columns: 2 })}>
    <PageNames Name="Left Page"/>
    <PageNames Name="Right Page"/>
   </Set>
  </PageSets>
  <MASTERPAGE ${atrybuty({ PAGEXPOS: START_X, PAGEYPOS: START_Y + spad, PAGEWIDTH: w.szerokosc_mm * PT, PAGEHEIGHT: w.wysokosc_mm * PT, BORDERLEFT: (m.wewnetrzny ?? 0) * PT, BORDERRIGHT: (m.zewnetrzny ?? 0) * PT, BORDERTOP: (m.gora ?? 0) * PT, BORDERBOTTOM: (m.dol ?? 0) * PT, NUM: 0, NAM: 'Normal', MNAM: '', Size: 'Custom', Orientation: 0, LEFT: 0, PRESET: 0, VerticalGuides: '', HorizontalGuides: '' })}/>
${strony.join('\n')}
${obiekty.join('\n')}
 </DOCUMENT>
</SCRIBUSUTF8NEW>
`;
  if (raport && czcionki.size) raport.dodaj('uwaga', t('kod.idml.zainstalujCzcionki', { czcionki: [...czcionki].join(', ') }));
  return { sla, ile, czcionki: [...czcionki], stron: egz.length };
}
