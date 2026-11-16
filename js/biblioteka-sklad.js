// Elementy złożone Biblioteki (#162): nagłówki, bloki treści, infografiki, formularze, okolicznościowe, układy
// stron, ilustracje, ikony, tła i wzory. Każdy element to lista zwykłych obiektów projektu (prostokąt, elipsa,
// ścieżka, tekst) w milimetrach, liczona dla bieżącej strony (szerokość treści, kolory i czcionki marki).
// Po wstawieniu kilka obiektów staje się jedną grupą – całość przesuwa się razem, a dwuklik otwiera grupę
// i każdy tekst, kolor czy kształt zmienia się jak zwykle (bez obrazków).
//
// Element złożony: { id, nazwa, slowa, grupa, duzy?, opis?, buduj: (ctx) => { obiekty, szer, wys, tlo? } }
//   ctx: { szer (mm treści strony), w, h, spad (mm strony), akcent, akcent2, tusz, jasny, naglowek, tekst (czcionki) }
//   tlo: element na całą stronę ze spadem, pod treścią (tła, wzory).
// Podgląd kafelka rysuje się z tych samych obiektów (podgladSkladu) – zawsze zgodny z tym, co się wstawi.

export const TUSZ = '#1a1a1a';
export const SZARY = '#8a877f';
export const JASNY = '#f1efe9';
const PT = 25.4 / 72;

// ---------- Budowanie obiektów (mm) ----------

const wspolne = (o) => ({
  fill: o.fill ?? '', stroke: o.stroke ?? '', strokeWidth: o.sw ?? (o.stroke ? 0.3 : 0), strokeUniform: o.jednolity ?? true,
  strokeDashArray: o.kreski || null, strokeLineCap: o.cap || 'round', strokeLineJoin: 'round', opacity: o.krycie ?? 1,
  ...(o.nazwa ? { nazwa: o.nazwa } : {}),
});
export const R = (x, y, w, h, o = {}) => ({ type: 'rect', left: x, top: y, width: w, height: h, rx: o.rx || 0, ry: o.rx || 0, ...wspolne(o) });
export const E = (cx, cy, rx, ry = rx, o = {}) => ({ type: 'ellipse', left: cx - rx, top: cy - ry, rx, ry, width: 2 * rx, height: 2 * ry, ...wspolne(o) });
// Ścieżka w układzie mm (współrzędne bezwzględne) – położenie liczy obwiednia (patrz obwiedniaSciezki).
export const P = (d, o = {}) => {
  const b = obwiedniaSciezki(d);
  return { type: 'path', path: d, ...polozenieSciezki(b, o.sw ?? (o.stroke ? 0.3 : 0)), ...wspolne(o), fillRule: o.evenodd ? 'evenodd' : 'nonzero', _ob: b };
};
export const L = (x1, y1, x2, y2, o = {}) => P(`M ${x1} ${y1} L ${x2} ${y2}`, { stroke: TUSZ, sw: 0.3, ...o });
export const T = (tekst, x, y, w, o = {}) => ({
  type: 'textbox', text: o.wielkie ? String(tekst).toUpperCase() : String(tekst), left: x, top: y, width: w,
  fontSize: (o.pt || 10) * PT, fontFamily: o.font || 'Inter', fontWeight: o.gruby ? 'bold' : 'normal', fontStyle: o.kursywa ? 'italic' : 'normal',
  fill: o.fill || TUSZ, textAlign: o.align || 'left', lineHeight: o.lh || 1.2, charSpacing: o.cs || 0, strokeWidth: 0,
  ...(o.nazwa ? { nazwa: o.nazwa } : {}),
});
// Wysokość tekstu (przybliżenie do układania: liczba wierszy × wysokość wiersza).
export const wysTekstu = (tekst, o = {}) => String(tekst).split('\n').length * (o.pt || 10) * PT * (o.lh || 1.2) * 1.13;

// Obwiednia ścieżki z poleceniami bezwzględnymi M L H V C Q A Z (tylko takich używamy w Bibliotece).
// Dla łuków i krzywych bierzemy punkty kontrolne i krańcowe – z zapasem, wystarcza do położenia.
export function obwiedniaSciezki(d) {
  const t = String(d).match(/[MLHVCQAZmlhvcqaz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let x = 0; let y = 0; let i = 0; let cmd = 'M';
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  const pkt = (px, py) => { minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); };
  const n = () => Number(t[i++]);
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    if (cmd === 'Z' || cmd === 'z') continue;
    if (cmd === 'M' || cmd === 'L') { x = n(); y = n(); pkt(x, y); if (cmd === 'M') cmd = 'L'; }
    else if (cmd === 'H') { x = n(); pkt(x, y); }
    else if (cmd === 'V') { y = n(); pkt(x, y); }
    else if (cmd === 'C') { pkt(n(), n()); pkt(n(), n()); x = n(); y = n(); pkt(x, y); }
    else if (cmd === 'Q') { pkt(n(), n()); x = n(); y = n(); pkt(x, y); }
    else if (cmd === 'A') {
      const rx = n(); const ry = n(); n(); n(); n(); const x2 = n(); const y2 = n();
      // Łuk: obwiednia okręgów o promieniach rx, ry wokół obu końców – zawsze obejmuje cały łuk.
      const cx = (x + x2) / 2; const cy = (y + y2) / 2;
      pkt(cx - rx, cy - ry); pkt(cx + rx, cy + ry);
      x = x2; y = y2; pkt(x, y);
    } else i += 1; // nieznane – pomijamy
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
// Fabric ustawia ścieżkę sam według jej obwiedni – położenie podajemy tylko dla kafelka (podgląd i układ).
const polozenieSciezki = (b) => ({ _x: b.x, _y: b.y });

// Okrąg i prostokąt zaokrąglony jako fragment ścieżki (bezwzględne współrzędne).
export const okrag = (cx, cy, r) => `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
export const prost = (x, y, w, h, r = 0) => (r
  ? `M ${f(x + r)} ${f(y)} H ${f(x + w - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V ${f(y + h - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} H ${f(x + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} V ${f(y + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`
  : `M ${f(x)} ${f(y)} H ${f(x + w)} V ${f(y + h)} H ${f(x)} Z`);
export const f = (v) => String(Math.round(v * 1000) / 1000);
// Ścieżka w układzie 24 × 24 (ikony) przeniesiona do (x, y) w skali s.
export function przenies(d, x, y, s) {
  let os = 0; let poz = 0; // os: 0 = x, 1 = y; w łuku A: tylko dwie ostatnie liczby to punkt
  return String(d).replace(/([MLHVCQAZ])|(-?\d*\.?\d+)/g, (m, c, l) => {
    if (c) { os = c; poz = 0; return c; }
    const v = Number(l);
    let wynik;
    if (os === 'H') wynik = x + v * s;
    else if (os === 'V') wynik = y + v * s;
    else if (os === 'A') {
      const k = poz % 7;
      wynik = k < 2 ? v * s : k < 5 ? v : k === 5 ? x + v * s : y + v * s;
    } else wynik = poz % 2 === 0 ? x + v * s : y + v * s;
    poz += 1;
    return f(wynik);
  });
}

// ---------- Kontekst strony ----------

export function kontekstStrony(e) {
  const marka = (typeof globalThis !== 'undefined' && globalThis.makietkaMarka) || null;
  const kolory = (marka?.kolory || []).map((k) => k.kolor).filter(Boolean);
  const w = e?.wydruk?.szerokosc_mm || 148;
  const h = e?.wydruk?.wysokosc_mm || 210;
  const m = e?.marg || { lewy: 12, prawy: 12, gora: 12, dol: 12 };
  return {
    w, h, spad: e?.wydruk?.spad_mm ?? 3, szer: Math.max(60, w - m.lewy - m.prawy), wysTresci: Math.max(80, h - m.gora - m.dol),
    akcent: kolory[0] || '#2f5d8a', akcent2: kolory[1] || '#c08a2e', tusz: TUSZ, jasny: JASNY,
    naglowek: marka?.czcionki?.naglowek || '', tekst: marka?.czcionki?.tekst || '',
  };
}
export const KONTEKST_PODGLADU = { w: 148, h: 210, spad: 3, szer: 96, wysTresci: 186, akcent: '#2f5d8a', akcent2: '#c08a2e', tusz: TUSZ, jasny: JASNY, naglowek: '', tekst: '' };

// ---------- Podgląd kafelka (SVG) ----------

const svgEsc = (t) => String(t).replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);
function jasnosc(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
}
// Kolory podglądu czytelne w obu motywach: czerń → kolor tuszu motywu, biel → powierzchnia, jasne szarości → tło.
function kolorPodgladu(c) {
  if (!c || c === 'transparent') return 'none';
  if (typeof c === 'object') return 'var(--akcent)';
  const j = jasnosc(c);
  if (j === null) return c;
  if (j < 0.2) return 'var(--tusz)';
  if (j > 0.97) return 'var(--powierzchnia)';
  if (j > 0.86 && Math.abs(parseInt(c.slice(1, 3), 16) - parseInt(c.slice(5, 7), 16)) < 24) return 'color-mix(in srgb, var(--tusz) 10%, var(--powierzchnia))';
  if (j > 0.45 && j < 0.62 && Math.abs(parseInt(c.slice(1, 3), 16) - parseInt(c.slice(5, 7), 16)) < 24) return 'var(--cichy)';
  return c;
}
function stylPodgladu(o, skala) {
  const sw = o.stroke ? Math.max(0.6 / skala, (o.strokeWidth || 0.3) * (o.strokeUniform === false ? 1 : 1)) : 0;
  const kr = o.strokeDashArray ? `;stroke-dasharray:${o.strokeDashArray.join(' ')}` : '';
  return `fill:${kolorPodgladu(o.fill)};stroke:${o.stroke ? kolorPodgladu(o.stroke) : 'none'};stroke-width:${f(sw)};stroke-linecap:${o.strokeLineCap || 'round'};stroke-linejoin:round;opacity:${o.opacity ?? 1}${kr}${o.fillRule === 'evenodd' ? ';fill-rule:evenodd' : ''}`;
}
function svgObiektu(o, skala) {
  if (o.type === 'rect') return `<rect x="${f(o.left)}" y="${f(o.top)}" width="${f(o.width)}" height="${f(o.height)}" rx="${f(o.rx || 0)}" style="${stylPodgladu(o, skala)}"/>`;
  if (o.type === 'ellipse') return `<ellipse cx="${f(o.left + o.rx)}" cy="${f(o.top + o.ry)}" rx="${f(o.rx)}" ry="${f(o.ry)}" style="${stylPodgladu(o, skala)}"/>`;
  if (o.type === 'path') return `<path d="${o.path}" style="${stylPodgladu(o, skala)}"/>`;
  if (o.type === 'textbox') {
    const fs = o.fontSize;
    const lh = fs * (o.lineHeight || 1.2) * 1.13;
    const x = o.textAlign === 'center' ? o.left + o.width / 2 : o.textAlign === 'right' ? o.left + o.width : o.left;
    const anchor = o.textAlign === 'center' ? 'middle' : o.textAlign === 'right' ? 'end' : 'start';
    // Zawijanie jak w ramce tekstu (przybliżone – szerokość znaku z wielkości pisma).
    const znak = fs * (/garamond|playfair|lora|serif|vibes|script|caveat|pacifico/i.test(o.fontFamily) ? 0.46 : 0.53) * (1 + (o.charSpacing || 0) / 1000);
    const naWiersz = Math.max(1, Math.floor(o.width / znak));
    const linie = String(o.text).split('\n').flatMap((akapit) => {
      const wynik = []; let w = '';
      for (const slowo of akapit.split(' ')) { if ((w ? `${w} ${slowo}` : slowo).length > naWiersz && w) { wynik.push(w); w = slowo; } else w = w ? `${w} ${slowo}` : slowo; }
      wynik.push(w);
      return wynik;
    });
    return `<text x="${f(x)}" y="${f(o.top + fs)}" text-anchor="${anchor}" style="font-family:'${svgEsc(o.fontFamily)}';font-size:${f(fs)}px;font-weight:${o.fontWeight === 'bold' ? 700 : 400};font-style:${o.fontStyle};fill:${kolorPodgladu(o.fill)};stroke:none;letter-spacing:${f((o.charSpacing || 0) / 1000 * fs)}px">${linie.map((l, i) => `<tspan x="${f(x)}" dy="${i ? f(lh) : 0}">${svgEsc(l)}</tspan>`).join('')}</text>`;
  }
  return '';
}
const cache = new Map();
// Podgląd SVG złożenia: obiekty wpisane w kafelek 70 × 52 (albo w proporcjach elementu przy kafelku dużym).
export function podgladSkladu(el, ctx = el.kontekstPodgladu || KONTEKST_PODGLADU) {
  if (cache.has(el)) return cache.get(el);
  const { obiekty, szer, wys } = el.buduj(ctx);
  const m = Math.max(szer, wys) * 0.06;
  const skala = 70 / (szer + 2 * m);
  const svg = `<svg viewBox="${f(-m)} ${f(-m)} ${f(szer + 2 * m)} ${f(wys + 2 * m)}" aria-hidden="true" class="podglad-skladu">${obiekty.map((o) => svgObiektu(o, skala)).join('')}</svg>`;
  cache.set(el, svg);
  return svg;
}

// ---------- Wstawianie ----------

// Obiekty do wstawienia: położenie względem lewego górnego rogu złożenia (0, 0), bez pól roboczych.
function doWstawienia(obiekty) {
  return obiekty.map((o) => {
    const k = { ...o };
    delete k._ob; delete k._x; delete k._y;
    return k;
  });
}

export async function wstawSklad(e, el, punkt = null) {
  const ctx = kontekstStrony(e);
  const { obiekty, szer, wys, tlo } = el.buduj(ctx);
  const projekt = typeof window !== 'undefined' ? window.seriodruk?.stan?.projekt : null;
  const bylo = e._wczytywanie;
  e._wczytywanie = true; // jedna zmiana (jeden krok cofania) zamiast osobnych: wstawienie i grupowanie
  let obj;
  try {
    obj = await e.wstawElementZBiblioteki({ obiekty: doWstawienia(obiekty), szer, wys }, projekt?.zasoby || {}, tlo ? null : punkt);
    if (obiekty.length > 1) { e.grupuj(); obj = e.aktywny; }
    if (obj) {
      obj.set('nazwa', el.nazwa);
      if (tlo) {
        // Na całą stronę ze spadem, pod treścią (pod wzorcami „pod” zostaje kolejność wzorców).
        obj.set({ left: e.strony[e.aktywna].x - ctx.spad, top: -ctx.spad });
        obj.setCoords();
        e.canvas.sendObjectToBack(obj);
        e._uporzadkujWzorce?.();
      }
    }
  } finally {
    e._wczytywanie = bylo;
  }
  e.canvas.requestRenderAll();
  e.oznaczZmiane();
  return obj;
}

// Element kategorii okna z elementu złożonego.
// Jedna ścieżka w układzie siatki (ikony 24 × 24, ilustracje 64 × 48) przeniesiona do (0, 0) w rozmiarze `szer` mm:
// obwiednia rysunku zaczyna się w lewym górnym rogu złożenia, linia rośnie razem z rysunkiem.
export function rysunek(d, szer, { kolor = TUSZ, linia = 1.5, nazwa } = {}) {
  const b = obwiedniaSciezki(d);
  const s = szer / Math.max(b.w, b.h);
  return { szer: b.w * s, wys: b.h * s, obiekty: [P(przenies(d, -b.x * s, -b.y * s, s), { stroke: kolor, sw: linia * s, jednolity: false, nazwa })] };
}

export const elementZeSkladu = (el, grupa) => ({
  id: el.id, nazwa: el.nazwa, slowa: el.slowa || '', grupa: el.grupa || grupa, duzy: el.duzy, opis: el.opis,
  get podglad() { return podgladSkladu(el); },
  wstaw: (e, punkt) => wstawSklad(e, el, punkt),
});
