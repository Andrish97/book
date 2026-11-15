// Malarz formatów (#131C): „Kopiuj wygląd” jednego elementu i nałożenie go na inny element albo na
// zaznaczony fragment tekstu. Kopiujemy tylko wygląd – nigdy treść, położenie, rozmiar ani dane.

import { POLA_STYLU } from './style-tekstu.js';

// Wygląd wspólny dla wszystkich elementów.
const WSPOLNE = ['opacity', 'shadow', 'uszlachetnienie', 'folia'];
// Kształty (prostokąt, elipsa, wielokąt, ścieżka, linia, obraz w kształcie).
const KSZTALT = ['fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'strokeLineCap', 'strokeLineJoin', 'rx', 'ry', 'filtry', 'miekkie_krawedzie', 'miekkie_rodzaj'];
// Obraz: filtry, zaokrąglenie narożników, obramowanie, miękkie krawędzie (#156).
const OBRAZ = ['filtry', 'stroke', 'strokeWidth', 'strokeDashArray', 'strokeLineCap', 'zaokraglenie', 'miekkie_krawedzie', 'miekkie_rodzaj'];
// Kształt ↔ obraz: to, co znaczy to samo w obu.
const KSZTALT_OBRAZ = ['filtry', 'stroke', 'strokeWidth', 'strokeDashArray', 'strokeLineCap', 'miekkie_krawedzie', 'miekkie_rodzaj'];
// Tekst: style akapitu i skład, plus nazwa stylu i obrys liter.
const TEKST = [...POLA_STYLU, 'styl', 'stroke', 'strokeWidth', 'wielkosc_liter'];
// Wygląd znaku – to, co da się nałożyć na zaznaczony fragment tekstu.
export const ZNAK = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'fill', 'stroke', 'strokeWidth'];

export const rodzajWygladu = (o) => {
  if (!o) return null;
  if (o.tabela || o.kod || o.wykres || o.kalendarz) return null; // elementy złożone – wygląd w ich panelu
  if (/^(textbox|i-text|text)$/i.test(o.type)) return 'tekst';
  if (/^image$/i.test(o.type)) return 'obraz';
  if (o.type === 'group' || o.type === 'activeselection' || o.type === 'activeSelection') return 'grupa';
  return 'ksztalt';
};

const kopia = (v) => {
  if (!v || typeof v !== 'object') return v;
  const zwykly = typeof v.toObject === 'function' ? v.toObject() : JSON.parse(JSON.stringify(v));
  // Przejście kolorów musi zostać obiektem Fabric – zwykły obiekt nie narysowałby się.
  if (zwykly?.colorStops && globalThis.fabric?.Gradient) return new globalThis.fabric.Gradient(zwykly);
  return zwykly;
};

// Wygląd elementu jako zwykły obiekt: { rodzaj, pola: { … } }. Przy zaznaczonym fragmencie pisanego tekstu –
// wygląd pierwszego znaku zaznaczenia.
export function wygladZ(o) {
  const rodzaj = rodzajWygladu(o);
  if (!rodzaj || rodzaj === 'grupa') return null;
  const lista = [...WSPOLNE, ...(rodzaj === 'tekst' ? TEKST : rodzaj === 'obraz' ? OBRAZ : KSZTALT)];
  const pola = {};
  for (const k of lista) if (o[k] !== undefined) pola[k] = kopia(o[k]);
  if (rodzaj === 'tekst' && o.isEditing && typeof o.getSelectionStyles === 'function' && o.selectionEnd > o.selectionStart) {
    const [znak] = o.getSelectionStyles(o.selectionStart, o.selectionStart + 1);
    for (const k of ZNAK) if (znak?.[k] !== undefined) pola[k] = kopia(znak[k]);
  }
  return { rodzaj, pola };
}

// Nakłada wygląd na element (albo na zaznaczony fragment pisanego tekstu). Zwraca true, gdy coś zmieniono.
// Kształt i tekst wymieniają się tylko tym, co ma sens (krycie, cień, uszlachetnienie; tekst → kształt: nic więcej).
export function nalozWyglad(o, wyglad) {
  if (!o || !wyglad) return false;
  const cel = rodzajWygladu(o);
  if (cel === 'grupa') {
    let zmiana = false;
    for (const d of o.getObjects?.() || []) zmiana = nalozWyglad(d, wyglad) || zmiana;
    return zmiana;
  }
  const { rodzaj, pola } = wyglad;
  // Fragment pisanego tekstu: wygląd znaku.
  if (cel === 'tekst' && o.isEditing && o.selectionEnd > o.selectionStart) {
    const zn = {};
    for (const k of ZNAK) if (pola[k] !== undefined) zn[k] = kopia(pola[k]);
    if (!Object.keys(zn).length) return false;
    o.setSelectionStyles(zn, o.selectionStart, o.selectionEnd);
    return true;
  }
  let dozwolone = WSPOLNE;
  if (cel === rodzaj) dozwolone = [...WSPOLNE, ...(cel === 'tekst' ? TEKST : cel === 'obraz' ? OBRAZ : KSZTALT)];
  else if ((cel === 'ksztalt' && rodzaj === 'obraz') || (cel === 'obraz' && rodzaj === 'ksztalt')) dozwolone = [...WSPOLNE, ...KSZTALT_OBRAZ];
  const zmiany = {};
  for (const k of dozwolone) if (pola[k] !== undefined) zmiany[k] = kopia(pola[k]);
  if (cel === 'tekst' && rodzaj === 'tekst') {
    // Cały tekst przyjmuje jeden wygląd – wygląd fragmentów (styles) znika, jak przy nadaniu stylu.
    o.set({ styles: {} });
  }
  if (!Object.keys(zmiany).length) return false;
  o.set(zmiany);
  if (cel === 'tekst') o.initDimensions?.();
  o.dirty = true;
  o.setCoords?.();
  return true;
}
