/* global fabric */
// Składanie strony z warstw: tło → elementy wzorców „pod” → treść strony →
// elementy wzorców „nad”. Jedno miejsce używane przez edytor, miniatury,
// podgląd, udostępnianie i (później) eksport do PDF, żeby wszędzie wyglądało
// to tak samo.
//
// Składa się zawsze konkretny egzemplarz strony z rozwiniętego ciągu
// (serie.js): z jego numerem, stroną rozkładówki, wierszem danych i sąsiadem,
// którego elementy mogą przechodzić przez grzbiet.

import { sekcjaStrony, wzorceStrony, scalRozkladowke, tloStrony } from './projekt.js';
import { rozwin, wartosciPol } from './serie.js';
import { podstawWObiektach } from './pola.js';
import './tekst-ramka.js'; // ramka o stałej wysokości i autodopasowanie – także przy składaniu

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

const ozyw = (json) => new Promise((ok) => fabric.util.enlivenObjects(json, ok));

// Obraz z pola: kolumna tabeli podaje nazwę pliku wgranego do projektu.
// Podmieniony obraz wpisuje się w ramkę obrazu-wzoru (ramka_pola), bez zmiany proporcji.
const bezRozszerzenia = (n) => String(n || '').trim().toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '');

function obrazyZPol(obiekty, wartosc, zasoby) {
  return obiekty.map((o) => {
    if (Array.isArray(o.objects)) return { ...o, objects: obrazyZPol(o.objects, wartosc, zasoby) };
    if (o.type !== 'image' || !o.pole?.kolumna) return o;
    const nazwa = wartosc(o.pole.kolumna, null);
    if (nazwa === undefined) return o;
    const id = Object.keys(zasoby || {}).find((k) => bezRozszerzenia(zasoby[k].nazwa) === bezRozszerzenia(nazwa));
    const ramka = { w: (o.width || 0) * (o.scaleX ?? 1), h: (o.height || 0) * (o.scaleY ?? 1) };
    // Rozmiar i przycięcie należały do obrazu-wzoru; podmieniony obraz ma własne.
    const { width, height, cropX, cropY, ...reszta } = o;
    // Brak pliku o tej nazwie: znak „brak obrazu” w miejscu ramki.
    return { ...reszta, zasob: id || 'brak-pliku', ramka_pola: ramka };
  });
}

function wpiszWRamki(obiekty) {
  for (const o of obiekty) {
    if (o.type === 'group') { wpiszWRamki(o.getObjects()); continue; }
    const r = o.ramka_pola;
    if (o.type !== 'image' || !r || !o.width || !o.height) continue;
    const skala = Math.min(r.w / o.width, r.h / o.height);
    const srodek = { x: o.left + r.w / 2, y: o.top + r.h / 2 }; // obrót ramki pomijamy przy środkowaniu
    o.set({ scaleX: skala, scaleY: skala, left: srodek.x - (o.width * skala) / 2, top: srodek.y - (o.height * skala) / 2 });
    o.setCoords();
  }
}

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

// cel: strona projektu albo egzemplarz z ciągu → egzemplarz (dla strony: pierwszy).
const egzemplarz = (cel, ciag) => (cel && cel.klucz && cel.strona ? cel : ciag.pierwszy.get(cel.id));

// Treść egzemplarza z podstawionymi polami (teksty i obrazy z kolumn).
function trescEgzemplarza(projekt, egz, ciag) {
  const wartosc = wartosciPol(projekt, egz, ciag);
  return obrazyZPol(podstawWObiektach(egz.strona.obiekty, wartosc), wartosc, projekt.zasoby);
}

// Elementy wzorców dla strony (jej pierwszego egzemplarza) albo dla egzemplarza,
// jako gotowe obiekty Fabric: { pod: [], nad: [] }.
export async function warstwyWzorcow(projekt, cel, ciag = rozwin(projekt)) {
  const wynik = { pod: [], nad: [] };
  const egz = egzemplarz(cel, ciag);
  const wzorce = wzorceStrony(projekt, egz.strona);
  if (!wzorce.length) return wynik;
  const wartosc = wartosciPol(projekt, egz, ciag);
  const lewa = egz.bok === 'lewa';
  const szerokosc = egz.sekcja.wydruk.szerokosc_mm;
  for (const w of wzorce) {
    if (!w.obiekty.length) continue;
    const json = podmienZasoby(obrazyZPol(podstawWObiektach(w.obiekty, wartosc), wartosc, projekt.zasoby), zrodloObrazu(projekt.zasoby));
    const obiekty = await ozyw(json);
    wpiszWRamki(obiekty);
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

// Elementy egzemplarza w kolejności warstw, razem z tymi z sąsiedniej strony
// rozkładówki, które przechodzą przez grzbiet (przesunięte do układu tej strony).
// Każda strona ma podstawione własne dane.
export function obiektyZSasiadem(projekt, cel, ciag = rozwin(projekt)) {
  const egz = egzemplarz(cel, ciag);
  const wlasne = trescEgzemplarza(projekt, egz, ciag);
  if (!egz.sasiad) return wlasne;
  const obce = trescEgzemplarza(projekt, egz.sasiad, ciag);
  const { szerokosc_mm: w, spad_mm: b } = egz.sekcja.wydruk;
  const lewa = egz.bok === 'lewa';
  const obcy = lewa ? 'prawa' : 'lewa';
  const [l, p] = lewa ? [wlasne, obce] : [obce, wlasne];
  return scalRozkladowke(l, p)
    .filter(({ o, bok }) => bok !== obcy || siegaPrzezGrzbiet(o, obcy, w, b))
    .map(({ o, bok }) => (bok === obcy ? { ...o, left: (o.left || 0) + (lewa ? w : -w) } : o));
}

// Renderuje stronę (jej pierwszy egzemplarz), egzemplarz z ciągu albo wzorzec
// do obrazu (dataURL). opcje: szerokoscPx (z ewentualnym spadem), spad
// (domyślnie tak), ciag (rozwinięty projekt – warto podać przy wielu stronach).
export async function renderujCel(projekt, cel, { szerokoscPx = 200, spad = true, ciag, format = 'png', jakosc = 0.88 } = {}) {
  const jestWzorcem = projekt.wzorce.includes(cel);
  const rozwiniety = jestWzorcem ? null : (ciag || rozwin(projekt));
  const egz = jestWzorcem ? null : egzemplarz(cel, rozwiniety);
  const wydruk = jestWzorcem ? cel.wydruk : sekcjaStrony(projekt, egz.strona).wydruk;
  const { szerokosc_mm: w, wysokosc_mm: h } = wydruk;
  const b = spad ? wydruk.spad_mm : 0;
  const k = szerokoscPx / (w + 2 * b);
  const plotno = new fabric.StaticCanvas(null, {
    width: Math.round((w + 2 * b) * k),
    height: Math.round((h + 2 * b) * k),
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  const tresc = jestWzorcem ? cel.obiekty : obiektyZSasiadem(projekt, egz, rozwiniety);
  const wlasne = await ozyw(podmienZasoby(tresc, zrodloObrazu(projekt.zasoby)));
  wpiszWRamki(wlasne);
  const warstwy = jestWzorcem ? { pod: [], nad: [] } : await warstwyWzorcow(projekt, egz, rozwiniety);
  plotno.backgroundColor = jestWzorcem ? (cel.tlo || '#ffffff') : tloStrony(projekt, egz.strona);
  for (const o of [...warstwy.pod, ...wlasne, ...warstwy.nad]) plotno.add(o);
  plotno.setViewportTransform([k, 0, 0, k, b * k, b * k]);
  plotno.renderAll();
  const url = plotno.toDataURL({ format, quality: jakosc });
  plotno.dispose();
  return url;
}
