/* global fabric */
// Rysunek SVG rozłożony na zwykłe elementy edytora.
//
// Wstawiony plik SVG jest obrazem: wygląda dokładnie tak, jak narysuje go przeglądarka, ale nie da
// się w nim nic zmienić. „Rozłóż rysunek na elementy” zamienia taki obraz w grupę kształtów i napisów,
// które zachowują się jak narysowane w edytorze: grupę można rozgrupować, kształtom zmienić kolor
// i punkty, a napisy poprawić. Napis zostaje w swojej czcionce, jeśli jest ona w zestawie aplikacji
// albo wśród czcionek projektu; w przeciwnym razie dostaje czcionkę domyślną.
import './fabric-ustawienia.js';
import { CZCIONKI, DOMYSLNA, zapewnijRodziny, odmianyRodziny } from './czcionki.js';
import { blobZasobu } from './zasoby.js';
import { rozmiarOryginalu } from './obrazy.js';
import { ObrazyPdf } from './pdf-wektorowy.js';
import { uid } from './projekt.js';

// Czy obraz jest rysunkiem SVG.
export function toRysunekSvg(projekt, obj) {
  if (obj?.type !== 'image') return false;
  const z = projekt?.zasoby?.[obj.zasob];
  return Boolean(z) && (z.typ === 'image/svg+xml' || /^data:image\/svg\+xml/i.test(z.dataUrl || ''));
}

// Czego rozkład nie odtworzy (edytor nie ma takich rzeczy) – rysunek da się rozłożyć, ale może wyglądać inaczej.
const NIEOBSLUGIWANE = /<(filter|mask|pattern|marker|foreignObject|switch|textPath)\b|mix-blend-mode/i;

const mnoz = (a, b) => fabric.util.multiplyTransformMatrices(a, b);

// Nadaje obiektowi przekształcenie zapisane macierzą; ujemną skalę zamienia na odbicie.
function nadajMacierz(o, m) {
  fabric.util.applyTransformToObject(o, m);
  if (o.scaleY < 0) o.set({ scaleY: -o.scaleY, flipY: !o.flipY });
  if (o.scaleX < 0) o.set({ scaleX: -o.scaleX, flipX: !o.flipX });
  o.setCoords();
}

const WYGLAD = ['fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'strokeLineCap', 'strokeLineJoin', 'strokeMiterLimit', 'strokeDashOffset', 'opacity', 'fillRule', 'paintFirst', 'clipPath'];
const wyglad = (o) => Object.fromEntries(WYGLAD.map((k) => [k, o[k]]));

// Wielokąt i łamana z SVG stają się kształtem z punktami (taki sam jak z pióra): w edytorze wielokąt
// to figura foremna o zadanej liczbie boków, a łamanej nie ma wcale.
function naKsztalt(o) {
  const d = `${o.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}${o.type === 'polygon' ? ' Z' : ''}`;
  const k = new fabric.Path(d, wyglad(o));
  nadajMacierz(k, o.calcOwnMatrix());
  return k;
}

function naElipse(o) {
  const e = new fabric.Ellipse({ ...wyglad(o), rx: o.radius, ry: o.radius });
  nadajMacierz(e, o.calcOwnMatrix());
  return e;
}

// Pierwsza z wymienionych w SVG czcionek, którą aplikacja zna (zestaw albo czcionki projektu).
function znanaRodzina(projekt, zapis) {
  const znane = [...(projekt?.czcionki || []).map((c) => c.rodzina), ...CZCIONKI.map((c) => c.nazwa)];
  for (const nazwa of String(zapis || '').split(',').map((n) => n.trim().replace(/^['"]|['"]$/g, '').toLowerCase())) {
    const jest = znane.find((z) => z.toLowerCase() === nazwa);
    if (jest) return jest;
  }
  return null;
}

// Punkt zaczepienia napisu w SVG: początek, środek albo koniec wiersza (text-anchor, także odziedziczony).
function zaczep(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentNode) {
    const v = e.style?.textAnchor || e.getAttribute('text-anchor');
    if (v) return { middle: 'center', end: 'right' }[v] || 'left';
  }
  return 'left';
}

// Napis SVG → ramka tekstu edytora, w tym samym miejscu (liczy się punkt zaczepienia wiersza).
// m: przekształcenie z układu rysunku do układu strony. Zwraca { obiekt, zastapiona: nazwa albo null }.
function naTekst(projekt, t, el, m) {
  if (!t.stroke) t.set('strokeWidth', 0); // bez obrysu grubość tylko przesuwałaby napis
  const kotwica = zaczep(el);
  const punkt = fabric.util.transformPoint(t.getPointByOrigin(kotwica, 'top'), m);
  const rodzina = znanaRodzina(projekt, t.fontFamily);
  const czcionka = rodzina || DOMYSLNA;
  const ma = odmianyRodziny(projekt, czcionka);
  const gruba = t.fontWeight === 'bold' || t.fontWeight === 'bolder' || Number(t.fontWeight) >= 600;
  const { scaleX, scaleY, skewX, angle } = fabric.util.qrDecompose(mnoz(m, t.calcOwnMatrix()));
  // Równa skala trafia do rozmiaru pisma – napis ma wtedy we właściwościach prawdziwy rozmiar.
  const rowna = scaleY > 0 && Math.abs(scaleX / scaleY - 1) < 0.01 && Math.abs(skewX) < 0.01;
  const s = rowna ? scaleX : 1;
  const tb = new fabric.Textbox(t.text, {
    width: 1e6,
    fontFamily: czcionka,
    fontSize: t.fontSize * s,
    fontWeight: gruba && ma.pogrubiona ? 'bold' : 'normal',
    fontStyle: /italic|oblique/.test(t.fontStyle) && ma.kursywa ? 'italic' : 'normal',
    lineHeight: t.lineHeight,
    charSpacing: t.charSpacing,
    underline: t.underline,
    linethrough: t.linethrough,
    overline: t.overline,
    textAlign: kotwica,
    fill: t.fill,
    stroke: t.stroke,
    strokeWidth: t.stroke ? t.strokeWidth * s : 0,
    opacity: t.opacity,
    angle,
    ...(rowna ? {} : { scaleX: Math.abs(scaleX), scaleY: Math.abs(scaleY), skewX, flipY: scaleY < 0 }),
  });
  tb.set('width', tb.calcTextWidth() + tb.fontSize * 0.05);
  tb.setPositionByOrigin(punkt, kotwica, 'top');
  tb.setCoords();
  const pierwsza = String(t.fontFamily || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  return { obiekt: tb, zastapiona: rodzina ? null : (pierwsza || 'bez nazwy') };
}

// Kształt bez obrysu ma w SVG domyślną grubość 1 – niewidoczną, ale poszerzającą ramkę elementu.
function bezPustegoObrysu(o) {
  if (o.stroke || !o.strokeWidth) return;
  const srodek = o.getCenterPoint();
  o.set('strokeWidth', 0);
  o.setPositionByOrigin(srodek, 'center', 'center');
}

// Kształt z rysunku → kształt na stronie. Przy równej skali grubość obrysu zostaje stała
// (tak jak w kształtach narysowanych w edytorze), a prostokąt i elipsa dostają wymiary wprost.
function naStrone(o, m) {
  const { scaleX, scaleY, skewX } = fabric.util.qrDecompose(mnoz(m, o.calcOwnMatrix()));
  nadajMacierz(o, mnoz(m, o.calcOwnMatrix()));
  if (!(scaleY > 0 && Math.abs(scaleX / scaleY - 1) < 0.01 && Math.abs(skewX) < 0.01)) return o;
  const s = scaleX;
  const srodek = o.getCenterPoint();
  o.set({ strokeWidth: (o.strokeWidth || 0) * s, strokeUniform: true });
  if (o.strokeDashArray) o.set('strokeDashArray', o.strokeDashArray.map((v) => v * s));
  if (o.type === 'rect') o.set({ width: o.width * s, height: o.height * s, rx: (o.rx || 0) * s, ry: (o.ry || 0) * s, scaleX: 1, scaleY: 1 });
  if (o.type === 'ellipse') o.set({ rx: o.rx * s, ry: o.ry * s, scaleX: 1, scaleY: 1 });
  o.setPositionByOrigin(srodek, 'center', 'center');
  o.setCoords();
  return o;
}

// Rozkłada rysunek SVG (obraz na stronie) na elementy edytora.
// Zwraca { grupa, ile, napisy, zastapione: [nazwy czcionek], uwaga } albo { blad }.
// Grupa ma położenie, obrót i odbicie obrazu; nie jest jeszcze na stronie.
export async function rozlozRysunek(projekt, obj) {
  if (!toRysunekSvg(projekt, obj)) return { blad: 'To nie jest rysunek SVG.' };
  let kod;
  try { kod = await (await blobZasobu(projekt, obj.zasob)).text(); } catch { return { blad: 'Nie udało się odczytać pliku rysunku.' }; }
  if (/<image\b/i.test(kod)) return { blad: 'Ten rysunek zawiera wstawione zdjęcia – rozłożyć da się rysunek z samych kształtów i napisów.' };
  let wynik;
  try { wynik = await fabric.loadSVGFromString(kod); } catch { wynik = null; }
  const opcje = wynik?.options;
  const pary = (wynik?.objects || []).map((o, i) => [o, wynik.elements?.[i]]).filter(([o]) => o && o.visible !== false);
  if (!pary.length || !(opcje?.width > 0) || !(opcje?.height > 0)) return { blad: 'Tego rysunku nie da się rozłożyć na elementy.' };

  const napisy = pary.filter(([o]) => typeof o.text === 'string');
  // Czy kształty z rozkładu wyglądają jak rysunek (napisów nie porównujemy: obraz rysuje je czcionką systemu).
  const brak = NIEOBSLUGIWANE.exec(kod);
  let uwaga = brak ? `Rysunek używa elementu „${brak[1] || brak[0]}”, którego edytor nie ma – wygląd mógł się zmienić.` : '';
  if (!uwaga && !napisy.length && !ObrazyPdf.prototype._svgZgodny(obj.getElement(), pary.map(([o]) => o), opcje)) uwaga = 'Wygląd mógł się trochę zmienić.';

  // Czcionki napisów muszą być wczytane, zanim napisy zostaną zmierzone.
  await zapewnijRodziny([DOMYSLNA, ...napisy.map(([o]) => znanaRodzina(projekt, o.fontFamily)).filter(Boolean)]);

  // Układ pośredni: środek obrazu w punkcie (0,0), bez obrotu i odbicia; skala jak na stronie.
  const { nw, nh } = rozmiarOryginalu(obj);
  const sx = Math.abs(obj.scaleX); const sy = Math.abs(obj.scaleY);
  const m = [sx * (nw / opcje.width), 0, 0, sy * (nh / opcje.height), -sx * (obj.cropX + obj.width / 2), -sy * (obj.cropY + obj.height / 2)];
  const zastapione = new Set();
  const obiekty = pary.map(([o, el]) => {
    if (typeof o.text === 'string') {
      const { obiekt, zastapiona } = naTekst(projekt, o, el, m);
      if (zastapiona) zastapione.add(zastapiona);
      return obiekt;
    }
    bezPustegoObrysu(o);
    if (o.type === 'polygon' || o.type === 'polyline') return naStrone(naKsztalt(o), m);
    if (o.type === 'circle') return naStrone(naElipse(o), m);
    return naStrone(o, m);
  });
  for (const o of obiekty) o.set({ id: uid('o') });

  const grupa = new fabric.Group(obiekty, { id: uid('o'), nazwa: obj.nazwa || undefined, opacity: obj.opacity, warstwa: obj.warstwa });
  // Grupa przejmuje obrót i odbicie obrazu; jej środek trafia tam, gdzie wypada w obrazie.
  const srodek = obj.getCenterPoint();
  const naStronie = fabric.util.composeMatrix({ translateX: srodek.x, translateY: srodek.y, angle: obj.angle || 0, flipX: obj.flipX, flipY: obj.flipY });
  const srodekGrupy = fabric.util.transformPoint(grupa.getCenterPoint(), naStronie);
  grupa.set({ angle: obj.angle || 0, flipX: Boolean(obj.flipX), flipY: Boolean(obj.flipY) });
  grupa.setPositionByOrigin(srodekGrupy, 'center', 'center');
  grupa.setCoords();
  for (const o of obiekty) o.setCoords();
  const przyciety = obj.cropX > 0.5 || obj.cropY > 0.5 || obj.width < nw - 0.5 || obj.height < nh - 0.5;
  if (przyciety) uwaga = `Obraz był przycięty – po rozłożeniu widać cały rysunek.${uwaga ? ` ${uwaga}` : ''}`;
  return { grupa, ile: obiekty.length, napisy: napisy.length, zastapione: [...zastapione], uwaga };
}
