/* global fabric */
// Kod QR i kod kreskowy EAN-13 / ISBN-13 jako jeden element strony (decyzja #128).
//
// Kod to grupa Fabric z opisem w polu `kod` (jak tabela – tabela-obiekt.js). Dzieci grupy są tylko
// rysunkiem: tło (prostokąt), moduły (jedna ścieżka – wektorowo na ekranie, w podglądzie i w PDF)
// i dla EAN cyfry pod kodem. ulozKod przebudowuje je z opisu – po zmianie w panelu, po skalowaniu
// uchwytem i po podstawieniu danych z serii ({kolumna} w treści).
//
// kod: {
//   rodzaj: 'qr' | 'ean',
//   typ: 'adres' | 'tekst' | 'email' | 'telefon' | 'wifi'   (QR – skąd treść),
//   dane: { … }               pola panelu dla typu (adres, tekst, email, temat, telefon, siec, haslo, szyfrowanie, ukryta),
//   tresc: '…'                treść kodu (QR: liczona z typu i danych; EAN: cyfry) – może mieć pola {kolumna},
//   korekcja: 'L'|'M'|'Q'|'H',
//   kolor: '#000000', tlo: '#ffffff' | null (przezroczyste), cisza: true (margines ciszy), napis: true (EAN: cyfry),
//   szerokosc, wysokosc       w mm (QR – kwadrat),
// }

import './fabric-ustawienia.js';
import { rysunekKodu, normalizujKod, domyslnyKod, uwagiKodu, EAN_NOMINAL, CISZA_QR, CISZA_EAN } from './kody.js';

export { rysunekKodu, normalizujKod, domyslnyKod, uwagiKodu, EAN_NOMINAL, CISZA_QR, CISZA_EAN };

const BEZ_PRZEKSZTALCEN = { scaleX: 1, scaleY: 1, angle: 0, skewX: 0, skewY: 0, flipX: false, flipY: false };
const zaokr = (x) => Math.round(x * 100) / 100;

export const toKod = (o) => Boolean(o && o.kod && typeof o.kod === 'object' && typeof o.getObjects === 'function');

// Ścieżka SVG (w mm, od środka grupy) z listy prostokątów.
function sciezka(prostokaty, szer, wys) {
  const r = (v) => Math.round(v * 1000) / 1000;
  return prostokaty.map(([x, y, w, h]) => `M ${r(x - szer / 2)} ${r(y - wys / 2)} h ${r(w)} v ${r(h)} h ${r(-w)} Z`).join(' ');
}

// Nowy kod (jeszcze poza płótnem). lewo/gora: róg w mm.
export function nowyKod({ rodzaj = 'qr', lewo = 0, gora = 0, kod = {} } = {}, uid) {
  const g = new fabric.Group([], {
    id: uid ? uid('o') : undefined, left: lewo, top: gora,
    layoutManager: new fabric.LayoutManager(new fabric.FixedLayout()),
    subTargetCheck: false, interactive: false,
    kod: normalizujKod({ ...domyslnyKod(rodzaj), ...kod }),
  });
  ulozKod(g);
  return g;
}

// Przebudowuje rysunek kodu z opisu. Lewy górny róg zostaje na miejscu.
export function ulozKod(g) {
  if (!toKod(g)) return g;
  g.kod = normalizujKod(JSON.parse(JSON.stringify(g.kod)));
  const k = g.kod;
  const W = k.szerokosc;
  const H = k.wysokosc;
  const rys = rysunekKodu(k);
  g._bladKodu = rys.blad || null;
  k.narysowano = k.tresc; // treść, z której jest rysunek (po podstawieniu danych trzeba przerysować)
  g._modulKodu = rys.modul || 0;
  const lewo = g.left;
  const gora = g.top;
  g.remove(...g.getObjects());
  const dzieci = [];
  // Tło – także przy przezroczystym (bez wypełnienia): grupa ma stały prostokąt do zaznaczania.
  dzieci.push(new fabric.Rect({ left: -W / 2, top: -H / 2, width: W, height: H, fill: k.tlo || 'rgba(0,0,0,0)', strokeWidth: 0, evented: false, selectable: false, ...BEZ_PRZEKSZTALCEN }));
  if (rys.blad) {
    // Zła treść: przekreślona ramka zamiast kodu (widać, że trzeba poprawić; kontrola przed drukiem też to mówi).
    dzieci.push(new fabric.Path(`M ${-W / 2} ${-H / 2} L ${W / 2} ${H / 2} M ${W / 2} ${-H / 2} L ${-W / 2} ${H / 2}`, { fill: '', stroke: '#c0392b', strokeWidth: Math.max(0.2, W / 100), evented: false, selectable: false }));
  } else if (rys.moduly.length) {
    const p = new fabric.Path(sciezka(rys.moduly, W, H), { fill: k.kolor || '#000000', strokeWidth: 0, evented: false, selectable: false, objectCaching: false });
    dzieci.push(p);
  }
  for (const n of rys.napis || []) {
    const t = new fabric.Text(n.tekst, {
      fontFamily: 'Inter', fontSize: n.rozmiar, fill: k.kolor || '#000000', originX: n.wyrownanie === 'right' ? 'right' : (n.wyrownanie === 'center' ? 'center' : 'left'),
      originY: 'top', left: n.x - W / 2, top: n.y - H / 2, evented: false, selectable: false, lineHeight: 1, charSpacing: 60,
    });
    dzieci.push(t);
  }
  g.add(...dzieci);
  // Ścieżka ustawia się sama według swoich punktów – przesuwamy ją tak, by jej punkty leżały w układzie grupy.
  for (const d of g.getObjects()) {
    if (d.type === 'path' && d.pathOffset) d.set({ left: d.pathOffset.x - d.width / 2, top: d.pathOffset.y - d.height / 2, originX: 'left', originY: 'top', ...BEZ_PRZEKSZTALCEN });
    d.setCoords();
  }
  g.set({ width: W, height: H, left: lewo, top: gora });
  g.setCoords();
  g.dirty = true;
  return g;
}

// Po skalowaniu uchwytem: zmienia się rozmiar kodu (QR zostaje kwadratem), rysunek liczy się od nowa.
export function utrwalSkaleKodu(g) {
  if (!toKod(g) || (Math.abs(g.scaleX - 1) < 1e-6 && Math.abs(g.scaleY - 1) < 1e-6)) return false;
  const k = g.kod;
  const sx = Math.abs(g.scaleX);
  const sy = Math.abs(g.scaleY);
  if (k.rodzaj === 'qr') {
    const s = Math.max(sx, sy);
    k.szerokosc = zaokr(k.szerokosc * s);
    k.wysokosc = k.szerokosc;
  } else {
    k.szerokosc = zaokr(k.szerokosc * sx);
    k.wysokosc = zaokr(k.wysokosc * sy);
  }
  g.set({ scaleX: 1, scaleY: 1, flipX: false, flipY: false });
  ulozKod(g);
  return true;
}

