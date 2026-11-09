// Style tekstu wspólne dla projektu (np. „Tytuł”, „Tekst”, „Podpis”).
// Tekst pamięta identyfikator stylu; zmiana stylu zmienia wszystkie teksty,
// które go używają – na każdej stronie i w każdym wzorcu.

import { uid, ptNaMm } from './projekt.js';

export const POLA_STYLU = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough',
  'lineHeight', 'charSpacing', 'fill', 'textAlign',
];

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

const wartosciStylu = (styl) => Object.fromEntries(POLA_STYLU.filter((k) => styl[k] !== undefined).map((k) => [k, styl[k]]));

export function stylZObiektu(obj, nazwa, id = uid('st')) {
  const styl = { id, nazwa };
  for (const k of POLA_STYLU) styl[k] = k === 'fontSize' ? obj.fontSize * (obj.scaleY || 1) : obj[k];
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
