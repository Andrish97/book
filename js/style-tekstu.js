// Style tekstu wspólne dla projektu (np. „Tytuł”, „Tekst”, „Podpis”).
// Tekst pamięta identyfikator stylu; zmiana stylu zmienia wszystkie teksty,
// które go używają – na każdej stronie i w każdym wzorcu.

import { uid, ptNaMm } from './projekt.js';

export const POLA_STYLU = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough',
  'lineHeight', 'charSpacing', 'fill', 'textAlign',
  // Skład akapitu (#131) – w stylu zapisane jako null, gdy wyłączone (żeby styl je też wyłączał).
  'dziel_wyrazy', 'dziel_min', 'dziel_przed', 'dziel_po', 'spojniki', 'wdowy', 'do_siatki',
  'inicjal', 'inicjal_czcionka', 'inicjal_kolor', 'tabulatory',
  'wielkosc_liter', // wielkość liter jako wygląd (#167: style marki, np. etykieta WIELKIMI)
];
const POLA_SKLADU_STYLU = new Set(POLA_STYLU.slice(10));
// Porównanie wartości stylu z tekstem (liczby z tolerancją, puste = wyłączone, listy po treści).
export const rowneWStylu = (a, b) => (typeof a === 'number' && typeof b === 'number'
  ? Math.abs(a - b) <= 0.001
  : JSON.stringify(a ?? false) === JSON.stringify(b ?? false));

// Właściwości, które można nadać także zaznaczonemu fragmentowi tekstu.
export const POLA_FRAGMENTU = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'fill'];

const PODSTAWA = {
  fontFamily: 'Inter', fontWeight: 'normal', fontStyle: 'normal', underline: false, linethrough: false,
  lineHeight: 1.25, charSpacing: 0, fill: '#1a1a1a', textAlign: 'left',
};

export function domyslneStyle() {
  return [
    { id: uid('st'), nazwa: 'Tytuł', ...PODSTAWA, fontFamily: 'Playfair Display', fontSize: ptNaMm(28), fontWeight: 'bold', lineHeight: 1.1 },
    { id: uid('st'), nazwa: 'Nagłówek', ...PODSTAWA, fontSize: ptNaMm(16), fontWeight: 'bold', lineHeight: 1.2 },
    { id: uid('st'), nazwa: 'Tekst', ...PODSTAWA, fontSize: ptNaMm(10.5), lineHeight: 1.35 },
    { id: uid('st'), nazwa: 'Podpis', ...PODSTAWA, fontSize: ptNaMm(8), fill: '#6b6861', charSpacing: 20 },
  ];
}

// Wartości stylu do nadania tekstowi; null (wyłączone w stylu) → undefined (tekst też bez tego ustawienia).
const wartosciStylu = (styl) => Object.fromEntries(POLA_STYLU.filter((k) => styl[k] !== undefined).map((k) => [k, styl[k] === null ? undefined : styl[k]]));

export function stylZObiektu(obj, nazwa, id = uid('st')) {
  const styl = { id, nazwa };
  for (const k of POLA_STYLU) {
    const v = k === 'fontSize' ? obj.fontSize * (obj.scaleY || 1) : obj[k];
    styl[k] = POLA_SKLADU_STYLU.has(k) ? (v === undefined ? null : JSON.parse(JSON.stringify(v))) : v;
  }
  return styl;
}

// Nadaje styl obiektowi Fabric (usuwa formatowanie fragmentów w tych właściwościach).
export function zastosujStyl(obj, styl) {
  for (const k of POLA_FRAGMENTU) obj.removeStyle?.(k);
  obj.set({ ...wartosciStylu(styl), styl: styl.id });
  if (obj.scaleY && obj.scaleY !== 1) obj.set('fontSize', styl.fontSize / obj.scaleY);
  obj.initDimensions?.();
  obj.setCoords();
}

function wJsonie(obiekty, fn) {
  let n = 0;
  for (const o of obiekty || []) {
    n += fn(o) ? 1 : 0;
    if (Array.isArray(o.objects)) n += wJsonie(o.objects, fn);
  }
  return n;
}

const wszystkieListy = (projekt) => [...projekt.strony, ...projekt.wzorce].map((c) => c.obiekty);

// Przepisuje wartości stylu do wszystkich tekstów projektu, które go używają.
export function zastosujStylWProjekcie(projekt, styl) {
  const wartosci = wartosciStylu(styl);
  let n = 0;
  for (const lista of wszystkieListy(projekt)) {
    n += wJsonie(lista, (o) => {
      if (o.styl !== styl.id) return false;
      Object.assign(o, wartosci, { scaleX: 1, scaleY: 1 });
      for (const [k, v] of Object.entries(wartosci)) if (v === undefined) delete o[k];
      // Formatowanie fragmentów w polach stylu ustępuje stylowi.
      for (const wiersz of Object.values(o.styles || {})) {
        for (const znak of Object.values(wiersz || {})) for (const k of POLA_FRAGMENTU) delete znak[k];
      }
      return true;
    });
  }
  return n;
}

export const liczbaUzyc = (projekt, id) => wszystkieListy(projekt).reduce((n, lista) => n + wJsonie(lista, (o) => o.styl === id), 0);

// Po usunięciu stylu teksty zachowują wygląd, tracą tylko powiązanie.
export function odepnijStyl(projekt, id) {
  for (const lista of wszystkieListy(projekt)) wJsonie(lista, (o) => { if (o.styl === id) delete o.styl; return false; });
}

// ---------- Style znakowe (#131) ----------
// projekt.style_znakowe: [{ id, nazwa, fontFamily?, fontSize?, fontWeight?, fontStyle?, underline?, linethrough?, fill? }]
// Fragment tekstu pamięta styl w stylu znaku (`styl_znakowy`); zmiana stylu zmienia wszystkie fragmenty z tym stylem.

export function stylZnakowyZFragmentu(wyglad, nazwa, id = uid('sz')) {
  const styl = { id, nazwa };
  for (const k of POLA_FRAGMENTU) if (wyglad[k] !== undefined) styl[k] = wyglad[k];
  return styl;
}

export const wartosciZnakowe = (styl) => Object.fromEntries(POLA_FRAGMENTU.filter((k) => styl[k] !== undefined).map((k) => [k, styl[k]]));

// Nadaje styl znakowy zaznaczeniu tekstu (obiekt Fabric w trakcie pisania albo cały tekst).
export function zastosujStylZnakowy(obj, styl, start = obj.selectionStart, end = obj.selectionEnd) {
  const od = start === end ? 0 : start;
  const doZnaku = start === end ? obj.text.length : end;
  if (!styl) {
    for (let i = od; i < doZnaku; i += 1) {
      const { lineIndex, charIndex } = obj.get2DCursorLocation(i, true);
      const st = obj.styles?.[lineIndex]?.[charIndex];
      if (st) delete st.styl_znakowy;
    }
  } else obj.setSelectionStyles({ ...wartosciZnakowe(styl), styl_znakowy: styl.id }, od, doZnaku);
  obj.initDimensions?.();
  obj.dirty = true;
}

// Styl znaku na pozycji (do pokazania w panelu).
export function stylZnakowyNaPozycji(obj, i) {
  if (!obj?.styles) return '';
  const { lineIndex, charIndex } = obj.get2DCursorLocation(Math.max(0, Math.min(i, obj.text.length - 1)), true);
  return obj.styles?.[lineIndex]?.[charIndex]?.styl_znakowy || '';
}

// Przechodzi przez style znaków zapisanego tekstu (tablica { start, end, style } albo obiekt wierszy).
function styleZnakow(o, fn) {
  if (Array.isArray(o.styles)) { for (const s of o.styles) if (s?.style) fn(s.style); return; }
  for (const wiersz of Object.values(o.styles || {})) for (const znak of Object.values(wiersz || {})) if (znak) fn(znak);
}

// Przepisuje wartości stylu znakowego do wszystkich fragmentów projektu z tym stylem.
export function zastosujStylZnakowyWProjekcie(projekt, styl) {
  const wartosci = wartosciZnakowe(styl);
  let n = 0;
  for (const lista of wszystkieListy(projekt)) {
    n += wJsonie(lista, (o) => {
      let jest = false;
      styleZnakow(o, (st) => {
        if (st.styl_znakowy !== styl.id) return;
        for (const k of POLA_FRAGMENTU) delete st[k];
        Object.assign(st, wartosci);
        jest = true;
      });
      return jest;
    });
  }
  return n;
}

export function odepnijStylZnakowy(projekt, id) {
  for (const lista of wszystkieListy(projekt)) wJsonie(lista, (o) => { styleZnakow(o, (st) => { if (st.styl_znakowy === id) delete st.styl_znakowy; }); return false; });
}
