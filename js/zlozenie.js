/* global fabric */
// Składanie strony z warstw: tło → elementy wzorców „pod” → treść strony →
// elementy wzorców „nad”. Jedno miejsce używane przez edytor, miniatury,
// podgląd i (później) eksport do PDF, żeby wszędzie wyglądało to tak samo.
// W rozkładówce do treści strony dochodzą elementy sąsiedniej strony, które
// przechodzą przez grzbiet.

import {
  sekcjaStrony, wzorceStrony, zmienneStrony, stronaRozkladowki, sasiadStrony, scalRozkladowke,
  tloStrony, numeryStron,
} from './projekt.js';

const ZASTEPCZY_OBRAZ = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150">'
  + '<rect width="200" height="150" fill="#eee" stroke="#c00" stroke-width="4"/>'
  + '<path d="M0 0L200 150M200 0L0 150" stroke="#c00" stroke-width="2"/></svg>');

// Rekurencyjnie podmienia src obrazów:
//  - mapa == null: dataUrl -> "zasob:<id>" (do zapisu),
//  - mapa(id) -> dataUrl (do wczytania).
export function podmienZasoby(obiekty, mapa) {
  return (obiekty || []).map((o) => {
    const kopia = { ...o };
    if (kopia.type === 'image' && kopia.zasob) {
      kopia.src = mapa ? mapa(kopia.zasob) : `zasob:${kopia.zasob}`;
    }
    if (Array.isArray(kopia.objects)) kopia.objects = podmienZasoby(kopia.objects, mapa);
    return kopia;
  });
}

export const zrodloObrazu = (zasoby) => (id) => zasoby?.[id]?.dataUrl || ZASTEPCZY_OBRAZ;

// Podstawia {zmienna} w tekście; nieznane zmienne zostają bez zmian.
export function wstawZmienne(tekst, zmienne) {
  return tekst.replace(/\{([a-z_]+)\}/gi, (cale, nazwa) => (nazwa in zmienne ? zmienne[nazwa] : cale));
}

function zmienneWJson(obiekty, zmienne) {
  return obiekty.map((o) => {
    const k = { ...o };
    if (typeof k.text === 'string') k.text = wstawZmienne(k.text, zmienne);
    if (Array.isArray(k.objects)) k.objects = zmienneWJson(k.objects, zmienne);
    return k;
  });
}

const ozyw = (json) => new Promise((ok) => fabric.util.enlivenObjects(json, ok));

// Odbicie lustrzane położenia względem pionowej osi strony (plan 4.6):
// element przechodzi na drugą stronę, tekst i obraz nie są odwracane,
// wyrównanie tekstu zmienia się na przeciwne.
function odbij(o, szerokosc) {
  const srodek = o.getCenterPoint();
  o.set({ angle: -(o.angle || 0) });
  if (o.type === 'line') o.set('flipX', !o.flipX);
  if (typeof o.textAlign === 'string') {
    o.set('textAlign', { left: 'right', right: 'left' }[o.textAlign] || o.textAlign);
  }
  o.setPositionByOrigin(new fabric.Point(szerokosc - srodek.x, srodek.y), 'center', 'center');
  o.setCoords();
}

// Elementy wzorców dla strony jako gotowe obiekty Fabric: { pod: [], nad: [] }.
export async function warstwyWzorcow(projekt, strona, numery) {
  const wynik = { pod: [], nad: [] };
  const wzorce = wzorceStrony(projekt, strona);
  if (!wzorce.length) return wynik;
  const zmienne = zmienneStrony(projekt, strona, numery);
  const lewa = stronaRozkladowki(projekt, strona) === 'lewa';
  const szerokosc = sekcjaStrony(projekt, strona).wydruk.szerokosc_mm;
  for (const w of wzorce) {
    if (!w.obiekty.length) continue;
    const json = podmienZasoby(zmienneWJson(w.obiekty, zmienne), zrodloObrazu(projekt.zasoby));
    const obiekty = await ozyw(json);
    for (const o of obiekty) {
      if (w.lustro && lewa) odbij(o, szerokosc);
      o.set({
        zWzorca: true, selectable: false, evented: false, excludeFromExport: true, hoverCursor: 'default',
      });
      (o.warstwa === 'nad' ? wynik.nad : wynik.pod).push(o);
    }
  }
  return wynik;
}

// Czy element sąsiedniej strony może sięgać na tę stronę. Liczone z zapasem
// (okrąg opisany na elemencie), bo resztę i tak przytnie krawędź płótna.
function siegaPrzezGrzbiet(o, bokElementu, szerokosc, spad) {
  const zasieg = Math.hypot((o.width || 0) * (o.scaleX ?? 1), (o.height || 0) * (o.scaleY ?? 1)) + (o.strokeWidth || 0);
  const x = o.left || 0;
  return bokElementu === 'prawa' ? x - zasieg < spad : x + zasieg > szerokosc - spad;
}

// Elementy strony w kolejności warstw, razem z tymi z sąsiedniej strony
// rozkładówki, które przechodzą przez grzbiet (przesunięte do układu tej strony).
export function obiektyZSasiadem(projekt, strona) {
  const sasiad = sasiadStrony(projekt, strona);
  if (!sasiad) return strona.obiekty;
  const { szerokosc_mm: w, spad_mm: b } = sekcjaStrony(projekt, strona).wydruk;
  const lewa = stronaRozkladowki(projekt, strona) === 'lewa';
  const obcy = lewa ? 'prawa' : 'lewa';
  const [l, p] = lewa ? [strona.obiekty, sasiad.obiekty] : [sasiad.obiekty, strona.obiekty];
  return scalRozkladowke(l, p)
    .filter(({ o, bok }) => bok !== obcy || siegaPrzezGrzbiet(o, obcy, w, b))
    .map(({ o, bok }) => (bok === obcy ? { ...o, left: (o.left || 0) + (lewa ? w : -w) } : o));
}

// Renderuje stronę albo wzorzec do obrazu PNG (dataURL).
// opcje: szerokoscPx (z ewentualnym spadem), spad (domyślnie tak), numery.
export async function renderujCel(projekt, cel, { szerokoscPx = 200, spad = true, numery, format = 'png', jakosc = 0.88 } = {}) {
  const jestWzorcem = projekt.wzorce.includes(cel);
  const wydruk = jestWzorcem ? cel.wydruk : sekcjaStrony(projekt, cel).wydruk;
  const { szerokosc_mm: w, wysokosc_mm: h } = wydruk;
  const b = spad ? wydruk.spad_mm : 0;
  const k = szerokoscPx / (w + 2 * b);
  const plotno = new fabric.StaticCanvas(null, {
    width: Math.round((w + 2 * b) * k),
    height: Math.round((h + 2 * b) * k),
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  const tresc = jestWzorcem ? cel.obiekty : obiektyZSasiadem(projekt, cel);
  const wlasne = await ozyw(podmienZasoby(tresc, zrodloObrazu(projekt.zasoby)));
  const warstwy = jestWzorcem ? { pod: [], nad: [] } : await warstwyWzorcow(projekt, cel, numery);
  plotno.backgroundColor = jestWzorcem ? (cel.tlo || '#ffffff') : tloStrony(projekt, cel);
  for (const o of [...warstwy.pod, ...wlasne, ...warstwy.nad]) plotno.add(o);
  plotno.setViewportTransform([k, 0, 0, k, b * k, b * k]);
  plotno.renderAll();
  const url = plotno.toDataURL({ format, quality: jakosc });
  plotno.dispose();
  return url;
}

export { numeryStron };
