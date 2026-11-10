// PDF wektorowy: strona zapisana jako tekst, kształty i zdjęcia, a nie jako jeden obraz.
//
// Jak to działa: edytor (Fabric) rysuje każdy element na „kontekście rysowania”.
// Tutaj jest własny kontekst o tym samym zestawie poleceń, który zamiast pikseli
// zapisuje polecenia PDF: ścieżki, kolory, gradienty, tekst pisany osadzoną
// czcionką i zdjęcia w oryginalnej rozdzielczości. Dzięki temu PDF powstaje z tego
// samego kodu, który rysuje stronę na ekranie – układ wierszy, wypunktowania,
// pola z danych i przelewanie tekstu są takie same.
//
// Czego nie da się zapisać wektorowo (cień, element przycięty maską, czcionka
// bez pliku do osadzenia, znak spoza czcionki), trafia do PDF jako obraz tego
// jednego elementu w wybranej rozdzielczości. Lista takich miejsc wraca w `uwagi`.

import { CZCIONKI } from './czcionki.js';

const PT = 72 / 25.4;
const ROZMIAR_POMIARU = 400; // tekst mierzymy dużą czcionką i skalujemy – jak robi to edytor
const MAX_PIKSELI_OBRAZU = 36e6;

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

// Czcionki jednego pliku PDF: wyszukanie pliku dla rodziny i odmiany, wczytanie, osadzenie.
export class CzcionkiPdf {
  constructor(pdf, projekt, fontkit, { krzywe = false } = {}) {
    Object.assign(this, { pdf, projekt, fontkit, krzywe });
    this.gotowe = new Map(); // "rodzina|700|1" → { fk, pdfFont } albo { brak: powód }
  }

  async _bajty(rodzina, w, kursywa) {
    const wlasne = (this.projekt.czcionki || []).filter((c) => c.rodzina === rodzina);
    if (wlasne.length) {
      const tejPochylosci = wlasne.filter((c) => Boolean(c.kursywa) === kursywa);
      if (!tejPochylosci.length && kursywa) return { brak: `„${rodzina}” nie ma pliku kursywy` };
      const kandydaci = tejPochylosci.length ? tejPochylosci : wlasne;
      const c = [...kandydaci].sort((a, b) => Math.abs(a.waga - w) - Math.abs(b.waga - w))[0];
      if (w >= 600 && c.waga < 600) return { brak: `„${rodzina}” nie ma pliku odmiany pogrubionej` };
      const zasob = this.projekt.zasoby?.[c.id];
      if (!zasob?.dataUrl) return { brak: `brak pliku czcionki „${rodzina}”` };
      const bufor = await (await fetch(zasob.dataUrl)).arrayBuffer();
      const znak = new TextDecoder('latin1').decode(new Uint8Array(bufor, 0, 4));
      if (znak === 'wOF2') return { brak: `„${rodzina}” jest w formacie WOFF2 – do osadzenia w PDF wgraj plik TTF, OTF albo WOFF` };
      if (znak === 'ttcf') return { brak: `„${rodzina}” to zbiór czcionek (TTC)` };
      return { bajty: znak === 'wOFF' ? await rozpakujWoff(bufor) : new Uint8Array(bufor) };
    }
    if (CZCIONKI.some((c) => c.nazwa === rodzina)) {
      const odp = await fetch(`css/czcionki/pdf/${slug(rodzina)}-${w >= 600 ? 700 : 400}-${kursywa ? 'kursywa' : 'prosta'}.ttf`);
      if (!odp.ok) return { brak: `„${rodzina}” nie ma ${kursywa ? 'kursywy' : 'tej odmiany'}` };
      return { bajty: new Uint8Array(await odp.arrayBuffer()) };
    }
    return { brak: `czcionki „${rodzina}” nie ma w projekcie` };
  }

  async _wczytaj(rodzina, w, kursywa) {
    try {
      const zrodlo = await this._bajty(rodzina, w, kursywa);
      if (zrodlo.brak) return zrodlo;
      const fk = this.fontkit.create(zrodlo.bajty);
      if (fk.variationAxes && Object.keys(fk.variationAxes).length) return { brak: `„${rodzina}” to czcionka zmienna – do osadzenia w PDF wgraj osobne pliki odmian` };
      const pdfFont = this.krzywe ? null : await this.pdf.embedFont(zrodlo.bajty, { subset: false });
      return { fk, pdfFont };
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

// Obrazy jednego pliku PDF: każdy plik graficzny jest w nim tylko raz, choćby był na stu stronach.
export class ObrazyPdf {
  constructor(pdf) { this.pdf = pdf; this.znane = new Map(); }

  // el: <img>. Zwraca obietnicę obrazu PDF.
  osadz(el, { szerPx } = {}) {
    const klucz = el.src;
    if (!this.znane.has(klucz)) this.znane.set(klucz, this._osadz(el, szerPx));
    return this.znane.get(klucz);
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
    if (this.opcje.cmyk) return `${naCmyk([r, g, b]).map(L).join(' ')} ${obrys ? 'K' : 'k'}`;
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
      this.op.push(...czesci, parzyste ? 'W* n' : 'W n', `/${this.strona.cieniowanie(gradient, this.opcje.cmyk)} sh`);
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

  // Położenia kolejnych znaków tak, jak ułożyłaby je przeglądarka (z kerningiem).
  _polozenia(znaki, rozmiar) {
    this.pomiar.font = this.font.replace(/[\d.]+px/, `${ROZMIAR_POMIARU}px`);
    const k = rozmiar / ROZMIAR_POMIARU;
    const x = [0];
    let dotad = '';
    for (const z of znaki) { dotad += z; x.push(this.pomiar.measureText(dotad).width * k); }
    return x;
  }

  fillText(tekst, x, y) { this._tekst(tekst, x, y, false); }

  strokeText(tekst, x, y) { this._tekst(tekst, x, y, true); }

  _tekst(tekst, x, y, obrys) {
    this._sprawdz();
    if (!/^alphabetic/.test(this.textBaseline)) throw new Niewektorowe('linia bazowa tekstu');
    const czcionka = this.czcionki.znajdz(this.font);
    if (czcionka.brak) throw new Niewektorowe(czcionka.brak);
    const { fk, pdfFont, rozmiar } = czcionka;
    const znaki = Array.from(String(tekst));
    if (!znaki.length || !(rozmiar > 0)) return;
    const gdzie = this._polozenia(znaki, rozmiar);
    const szer = gdzie[znaki.length];
    const x0 = x - (this.textAlign === 'right' || this.textAlign === 'end' ? szer : (this.textAlign === 'center' ? szer / 2 : 0));
    const widoczne = [];
    znaki.forEach((z, i) => {
      const kod = z.codePointAt(0);
      if (fk.hasGlyphForCodePoint(kod)) widoczne.push([z, kod, gdzie[i]]);
      else if (!/^[\s­​-‍﻿]$/u.test(z)) throw new Niewektorowe(`znaku „${z}” nie ma w czcionce „${czcionka.klucz.split('|')[0]}”`);
    });
    if (!widoczne.length) return;
    const styl = obrys ? this.strokeStyle : this.fillStyle;
    if (typeof styl !== 'string') throw new Niewektorowe('tekst wypełniony gradientem');

    if (this.opcje.krzywe) {
      // Tekst zamieniony na krzywe: obrysy znaków jako wypełnione kształty.
      const skala = rozmiar / fk.unitsPerEm;
      const sciezka = [];
      for (const [, kod, dx] of widoczne) {
        const p = (gx, gy) => this._p(x0 + dx + gx * skala, y - gy * skala);
        let tu = [0, 0];
        for (const { command: co, args: a } of fk.glyphForCodePoint(kod).path.commands) {
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
    const czesci = [];
    widoczne.forEach(([z, kod, dx], i) => {
      czesci.push(pdfFont.encodeText(z).toString());
      const nastepny = widoczne[i + 1];
      if (!nastepny) return;
      const wlasny = (fk.glyphForCodePoint(kod).advanceWidth / fk.unitsPerEm) * rozmiar;
      const poprawka = ((wlasny - (nastepny[2] - dx)) / rozmiar) * 1000;
      if (Math.abs(poprawka) > 0.05) czesci.push(L(poprawka));
    });
    this.op.push('q');
    this._styl(styl, obrys);
    if (obrys) this.op.push(`${L(this.lineWidth)} w`, `${LACZENIA[this.lineJoin] ?? 0} j`);
    this.op.push('BT', `/${this.strona.czcionka(pdfFont)} ${L(rozmiar)} Tf`, `${obrys ? 1 : 0} Tr`, `1 0 0 -1 ${L(x0 + widoczne[0][2])} ${L(y)} Tm`, `[${czesci.join(' ')}] TJ`, 'ET', 'Q');
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
    // Szerokość w pikselach, jaką obraz zajmie w wybranej rozdzielczości – dla rysunków SVG.
    const skala = Math.hypot(this.m[0], this.m[1]);
    const nazwa = this.strona.obraz(el, { szerPx: Math.abs(dw * (nw / sw)) * skala * this.opcje.pikseliNaJednostke });
    const kx = dw / sw; const ky = dh / sh;
    this.op.push('q');
    this._krycie(this.globalAlpha);
    if (sx > 0.01 || sy > 0.01 || sw < nw - 0.01 || sh < nh - 0.01) this.op.push(`${L(dx)} ${L(dy)} ${L(dw)} ${L(dh)} re`, 'W n');
    this.op.push(`${L(nw * kx)} 0 0 ${L(-nh * ky)} ${L(dx - sx * kx)} ${L(dy - sy * ky + nh * ky)} cm`, `/${nazwa} Do`, 'Q');
  }
}

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

  cieniowanie(g, cmyk) {
    return this._nazwa(g, (n) => {
      const kolory = [...g.kolory].sort((a, b) => a[0] - b[0]);
      if (!kolory.length) throw new Niewektorowe('gradient bez kolorów');
      if (kolory.some(([, k]) => k[3] < 1)) throw new Niewektorowe('gradient z przezroczystością');
      if (kolory.length === 1) kolory.push([1, kolory[0][1]]);
      const barwa = (k) => (cmyk ? naCmyk(k) : k.slice(0, 3));
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

// Rysuje stronę na stronie PDF.
// srodowisko: { PDFLib, pdf, czcionki: CzcionkiPdf, obrazy: ObrazyPdf, cmyk, krzywe, dpi, uwagi: Map(powód → liczba) }
// m: wymiary z wymiaryStronyPdf (w, h, spad, pas) w mm; obiekty: żywe obiekty Fabric w układzie strony (mm).
export async function rysujStroneWektorowo(srodowisko, strona, { obiekty, tlo, m }) {
  const { PDFLib, pdf, czcionki, obrazy, cmyk = false, krzywe = false, dpi = 300, uwagi } = srodowisko;
  await czcionki.przygotuj(obiekty);
  const zasoby = new StronaPdf(PDFLib, pdf, strona, obrazy);
  const opcje = { cmyk, krzywe, pikseliNaJednostke: dpi / 25.4 };
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
      if (maMaske(o)) throw new Niewektorowe('element przycięty maską');
      bezPamieci(o);
      ctx.save();
      o.render(ostrozny(ctx));
      ctx.restore();
      if (ctx.stos.length !== przed.stos) throw new Niewektorowe('niedomknięty stan rysowania');
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
  const plotno = new fabric.StaticCanvas(null, {
    width: Math.max(1, Math.round((x1 - x0) * k)), height: Math.max(1, Math.round((y1 - y0) * k)), enableRetinaScaling: false, renderOnAddRemove: false,
  });
  plotno.setViewportTransform([k, 0, 0, k, -x0 * k, -y0 * k]);
  plotno.add(o);
  plotno.renderAll();
  const obraz = await obrazy.pdf.embedPng(plotno.toDataURL({ format: 'png' }));
  plotno.remove(o);
  plotno.dispose();
  const nazwa = zasoby.obrazGotowy(obraz);
  ctx.op.push('q', `${L(x1 - x0)} 0 0 ${L(-(y1 - y0))} ${L(x0)} ${L(y1)} cm`, `/${nazwa} Do`, 'Q');
}
