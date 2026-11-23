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
import { rozmiarOryginalu, przygotujKopie } from './obrazy.js';
import { zrodloObrazu } from './zlozenie.js';
import { uid } from './projekt.js';
import { t as tt } from './jezyk.js';

// Czy obraz jest rysunkiem SVG.
export function toRysunekSvg(projekt, obj) {
  if (obj?.type !== 'image') return false;
  const z = projekt?.zasoby?.[obj.zasob];
  return Boolean(z) && (z.typ === 'image/svg+xml' || /^data:image\/svg\+xml/i.test(z.dataUrl || ''));
}

// Czego rozkład nie odtworzy wprost (edytor nie ma takich rzeczy). Takie fragmenty nie znikają (#173): proste
// maski stają się przycięciem, wzory – powtórzonymi kształtami przyciętymi do kształtu, a resztę (filtry,
// mieszanie, złożone maski, znaczniki linii, tekst po ścieżce) rysuje przeglądarka i fragment zostaje obrazem
// w swoim miejscu i w swojej kolejności. Po tym zostaje tylko to, czego żaden z tych sposobów nie objął.
const NIEOBSLUGIWANE = /<(filter|mask|pattern|marker|foreignObject|switch|textPath)\b|mix-blend-mode/i;

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';
const odnosnik = (el) => el.getAttribute('href') || el.getAttributeNS(XLINK, 'href') || '';
const idZUrl = (v) => /url\(\s*["']?#([^"')\s]+)["']?\s*\)/.exec(String(v || ''))?.[1] || null;
// Elementy, które się nie rysują wprost (definicje) – w nich niczego nie zamieniamy.
const DEFINICJE = 'defs, clipPath, mask, pattern, marker, symbol, filter, linearGradient, radialGradient, style, title, desc, metadata';
const KSZTALTY_SVG = new Set(['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line']);
const BIALY = /^(white|#fff|#ffffff|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/i;
const poId = (svg, id) => (id ? svg.querySelector(`[id="${CSS.escape(id)}"]`) : null);
const definicje = (svg) => svg.querySelector(':scope > defs') || svg.insertBefore(document.createElementNS(SVG_NS, 'defs'), svg.firstChild);

// <use> → kopia wskazanego elementu w miejscu (także <symbol> z viewBox), żeby dalsze kroki widziały zwykłe kształty.
function rozwinUse(svg) {
  for (let runda = 0; runda < 8; runda += 1) {
    const uzycia = [...svg.querySelectorAll('use')].filter((u) => !u.closest('defs, clipPath, mask, pattern, marker'));
    if (!uzycia.length) return;
    for (const u of uzycia) {
      const cel = poId(svg, odnosnik(u).replace(/^#/, ''));
      const g = document.createElementNS(SVG_NS, 'g');
      for (const a of [...u.attributes]) if (!['x', 'y', 'width', 'height', 'href', 'xlink:href', 'transform'].includes(a.name)) g.setAttribute(a.name, a.value);
      const x = parseFloat(u.getAttribute('x')) || 0;
      const y = parseFloat(u.getAttribute('y')) || 0;
      let tr = `${u.getAttribute('transform') || ''} translate(${x} ${y})`;
      if (cel?.localName === 'symbol') {
        const vb = (cel.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
        const w = parseFloat(u.getAttribute('width'));
        const h = parseFloat(u.getAttribute('height'));
        if (vb.length === 4 && vb[2] > 0 && vb[3] > 0 && w > 0 && h > 0) {
          const k = Math.min(w / vb[2], h / vb[3]);
          tr += ` translate(${(w - vb[2] * k) / 2} ${(h - vb[3] * k) / 2}) scale(${k}) translate(${-vb[0]} ${-vb[1]})`;
        }
        for (const d of cel.childNodes) g.append(d.cloneNode(true));
      } else if (cel && !cel.contains(u)) {
        const k = cel.cloneNode(true);
        k.removeAttribute('id');
        g.append(k);
      }
      g.setAttribute('transform', tr.trim());
      u.replaceWith(g);
    }
  }
}

// Wartość właściwości wyglądu z obliczonego stylu (atrybut, style i klasy z <style> rysunku).
const wl = (el, nazwa) => getComputedStyle(el).getPropertyValue(nazwa).trim();
const brak = (v) => v === '' || v === 'none';

// Maska z samych białych, pełnych kształtów działa jak przycięcie – takie przycięcie edytor ma.
function maskaJakoPrzyciecie(svg, el, maska, nr) {
  if (maska?.localName !== 'mask' || maska.getAttribute('maskContentUnits') === 'objectBoundingBox' || el.getAttribute('clip-path')) return false;
  const dzieci = [...maska.children];
  const proste = dzieci.length && dzieci.every((d) => KSZTALTY_SVG.has(d.localName) && BIALY.test(wl(d, 'fill'))
    && Number(wl(d, 'opacity') || 1) === 1 && Number(wl(d, 'fill-opacity') || 1) === 1 && brak(wl(d, 'stroke')) && brak(wl(d, 'filter')));
  if (!proste) return false;
  const cp = document.createElementNS(SVG_NS, 'clipPath');
  cp.id = `rozklad-przyciecie-${nr}`;
  for (const d of dzieci) {
    const k = d.cloneNode(true);
    for (const a of ['fill', 'style', 'id', 'class']) k.removeAttribute(a);
    cp.append(k);
  }
  definicje(svg).append(cp);
  el.removeAttribute('mask');
  el.style.removeProperty('mask');
  el.setAttribute('clip-path', `url(#${cp.id})`);
  return true;
}

// Wypełnienie wzorem (<pattern>) → powtórzone kafelki z treścią wzoru, przycięte do kształtu; kształt zostaje
// z samym obrysem. Gdy kafelków byłoby za dużo albo wzór jest nietypowy – fałsz (fragment zostanie obrazem).
function wzorJakoKafelki(svg, el, wzor, nr) {
  if (!KSZTALTY_SVG.has(el.localName) || wzor?.localName !== 'pattern' || odnosnik(wzor) || wzor.getAttribute('viewBox')) return false;
  if (idZUrl(wl(el, 'stroke'))) return false;
  const bb = el.getBBox();
  if (!(bb.width > 0 && bb.height > 0)) return false;
  const obb = (wzor.getAttribute('patternUnits') || 'objectBoundingBox') === 'objectBoundingBox';
  const liczba = (a, baza) => { const v = wzor.getAttribute(a); if (v == null) return 0; if (/%$/.test(v)) return NaN; return parseFloat(v) * baza; };
  const x = liczba('x', obb ? bb.width : 1) + (obb ? bb.x : 0);
  const y = liczba('y', obb ? bb.height : 1) + (obb ? bb.y : 0);
  const w = liczba('width', obb ? bb.width : 1);
  const h = liczba('height', obb ? bb.height : 1);
  if (![x, y, w, h].every(Number.isFinite) || !(w > 0 && h > 0)) return false;
  const tr = wzor.getAttribute('patternTransform') || '';
  // Zasięg kafelków: rogi kształtu w układzie wzoru (odwrotność patternTransform).
  const g0 = document.createElementNS(SVG_NS, 'g');
  if (tr) g0.setAttribute('transform', tr);
  svg.append(g0);
  const mt = g0.transform.baseVal.consolidate()?.matrix || svg.createSVGMatrix();
  g0.remove();
  const odw = mt.inverse();
  const rogi = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].map(([px, py]) => {
    const p = svg.createSVGPoint();
    p.x = px;
    p.y = py;
    return p.matrixTransform(odw);
  });
  const i0 = Math.floor((Math.min(...rogi.map((p) => p.x)) - x) / w);
  const i1 = Math.ceil((Math.max(...rogi.map((p) => p.x)) - x) / w);
  const j0 = Math.floor((Math.min(...rogi.map((p) => p.y)) - y) / h);
  const j1 = Math.ceil((Math.max(...rogi.map((p) => p.y)) - y) / h);
  const kafelki = (i1 - i0) * (j1 - j0);
  const tresc = [...wzor.children].filter((d) => !d.matches(DEFINICJE));
  if (!tresc.length || kafelki > 400 || kafelki * wzor.querySelectorAll('*').length > 1500) return false;
  const skalaTresci = wzor.getAttribute('patternContentUnits') === 'objectBoundingBox' ? tt('svgElementy.scale', { width: bb.width, height: bb.height }) : '';
  const cp = document.createElementNS(SVG_NS, 'clipPath');
  cp.id = `rozklad-wzor-${nr}`;
  const ksztalt = el.cloneNode(false);
  for (const a of ['id', 'fill', 'stroke', 'style', 'class', 'filter', 'mask', 'clip-path', 'opacity']) ksztalt.removeAttribute(a);
  cp.append(ksztalt);
  definicje(svg).append(cp);
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('clip-path', `url(#${cp.id})`);
  const krycie = Number(wl(el, 'opacity') || 1) * Number(wl(el, 'fill-opacity') || 1);
  if (krycie < 1) g.setAttribute('opacity', String(krycie));
  const siatka = document.createElementNS(SVG_NS, 'g');
  if (tr) siatka.setAttribute('transform', tr);
  for (let i = i0; i < i1; i += 1) {
    for (let j = j0; j < j1; j += 1) {
      const k = document.createElementNS(SVG_NS, 'g');
      k.setAttribute('transform', `translate(${x + i * w} ${y + j * h})${skalaTresci}`);
      for (const d of tresc) { const c = d.cloneNode(true); c.removeAttribute('id'); k.append(c); }
      siatka.append(k);
    }
  }
  g.append(siatka);
  el.parentNode.insertBefore(g, el);
  el.setAttribute('fill', 'none');
  el.style.setProperty('fill', 'none');
  return true;
}

// Dlaczego element trzeba zostawić obrazem (albo null, gdy da się go rozłożyć).
function powodObrazu(el) {
  if (el.localName === 'foreignObject' || el.localName === 'switch') return 'obce';
  if (el.localName === 'text' && el.querySelector('textPath')) return 'tekst po ścieżce';
  if (!brak(wl(el, 'filter'))) return 'filtr';
  if (!brak(wl(el, 'mask'))) return 'maska';
  if (!['normal', ''].includes(wl(el, 'mix-blend-mode'))) return 'mieszanie';
  if (KSZTALTY_SVG.has(el.localName) && ['marker-start', 'marker-mid', 'marker-end'].some((m) => !brak(wl(el, m)))) return 'znaczniki';
  for (const w of ['fill', 'stroke']) if (poId(el.ownerSVGElement || el, idZUrl(wl(el, w)))?.localName === 'pattern') return 'wzór';
  return null;
}

// Fragment rysunku (sam element, z przodkami bez krycia) narysowany przez przeglądarkę → PNG przycięty do
// tego, co widać. k: piksele na jednostkę układu rysunku. Zwraca { url, x, y, w, h } w układzie rysunku albo null.
async function narysujFragment(svg, el, vb, k) {
  el.setAttribute('data-fragment-rysowany', '');
  const kopia = svg.cloneNode(true);
  el.removeAttribute('data-fragment-rysowany');
  const cel = kopia.querySelector('[data-fragment-rysowany]');
  cel.removeAttribute('data-fragment-rysowany');
  const przodkowie = new Set();
  for (let e = cel.parentNode; e && e !== kopia; e = e.parentNode) przodkowie.add(e);
  // Krycie przodków nałoży potem grupa w edytorze – tu bez niego, żeby nie liczyło się dwa razy.
  const sprzataj = (rodzic) => {
    for (const d of [...rodzic.children]) {
      if (d === cel || d.matches(DEFINICJE)) continue;
      if (przodkowie.has(d)) { d.removeAttribute('opacity'); d.style?.removeProperty('opacity'); sprzataj(d); } else d.remove();
    }
  };
  sprzataj(kopia);
  const W = Math.max(1, Math.round(vb[2] * k));
  const H = Math.max(1, Math.round(vb[3] * k));
  kopia.setAttribute('viewBox', vb.join(' '));
  kopia.setAttribute('width', String(W));
  kopia.setAttribute('height', String(H));
  kopia.setAttribute('preserveAspectRatio', 'none');
  kopia.removeAttribute('style');
  const adres = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(kopia)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((ok, zle) => { img.onload = ok; img.onerror = zle; img.src = adres; });
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    let x0 = W; let y0 = H; let x1 = -1; let y1 = -1;
    for (let yy = 0; yy < H; yy += 1) {
      for (let xx = 0; xx < W; xx += 1) {
        if (d[(yy * W + xx) * 4 + 3] > 1) {
          if (xx < x0) x0 = xx;
          if (xx > x1) x1 = xx;
          if (yy < y0) y0 = yy;
          if (yy > y1) y1 = yy;
        }
      }
    }
    if (x1 < 0) return null;
    const wyc = Object.assign(document.createElement('canvas'), { width: x1 - x0 + 1, height: y1 - y0 + 1 });
    wyc.getContext('2d').drawImage(c, x0, y0, wyc.width, wyc.height, 0, 0, wyc.width, wyc.height);
    return { url: wyc.toDataURL('image/png'), x: vb[0] + x0 / k, y: vb[1] + y0 / k, w: wyc.width / k, h: wyc.height / k };
  } catch { return null; } finally { URL.revokeObjectURL(adres); }
}

// Zamienia w kodzie rysunku to, czego edytor nie ma, na rzeczy, które ma (przycięcie, kafelki), a resztę
// na obrazy fragmentów. pxNaJednostke: ile pikseli obrazu na jednostkę viewBox (≥ 300 dpi w druku).
// Zwraca { kod, obrazy: liczba fragmentów zamienionych na obraz }.
async function zamienEfekty(kod, pxNaJednostke) {
  if (!NIEOBSLUGIWANE.test(kod) && !/<(use|style)\b|filter\s*:|mask\s*:/i.test(kod)) return { kod, obrazy: 0 };
  const dok = new DOMParser().parseFromString(kod, 'image/svg+xml');
  if (dok.querySelector('parsererror') || dok.documentElement.localName !== 'svg') return { kod, obrazy: 0 };
  // Rysunek w ukrytym drzewie cienia: przeglądarka liczy wymiary i style, a jego <style> nie dotyka aplikacji.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:10px;height:10px;overflow:hidden;visibility:hidden;pointer-events:none';
  const drzewo = host.attachShadow({ mode: 'open' });
  const svg = document.importNode(dok.documentElement, true);
  drzewo.append(svg);
  document.body.append(host);
  let obrazy = 0;
  try {
    rozwinUse(svg);
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    const ramka = vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? vb
      : [0, 0, parseFloat(svg.getAttribute('width')) || 300, parseFloat(svg.getAttribute('height')) || 150];
    // Rozdzielczość: co najmniej 300 dpi w druku, ale bez gigantów (bok do 6000 px, razem do 24 Mpx).
    let k = Math.min(pxNaJednostke, 6000 / ramka[2], 6000 / ramka[3], Math.sqrt(24e6 / (ramka[2] * ramka[3])));
    if (!(k > 0)) k = 1;
    let nr = 0;
    const rysowane = () => [...svg.querySelectorAll('*')].filter((e) => !e.closest(DEFINICJE) && e.localName !== 'tspan' && e.localName !== 'textPath');
    // 1. Proste maski i wzory – na rzeczy, które edytor ma.
    for (const el of rysowane()) {
      nr += 1;
      if (maskaJakoPrzyciecie(svg, el, poId(svg, idZUrl(wl(el, 'mask'))), nr)) continue;
      const wzor = poId(svg, idZUrl(wl(el, 'fill')));
      if (wzor?.localName === 'pattern' && brak(wl(el, 'filter')) && brak(wl(el, 'mask'))) wzorJakoKafelki(svg, el, wzor, nr);
    }
    // 2. Reszta: najwyższy element z efektem (z całą zawartością) → obraz w tym samym miejscu i kolejności.
    const wszystkie = rysowane();
    const zEfektem = new Set(wszystkie.filter((el) => powodObrazu(el)));
    const doObrazu = [...zEfektem].filter((el) => ![...zEfektem].some((a) => a !== el && a.contains(el)));
    for (const el of doObrazu) {
      const f = await narysujFragment(svg, el, ramka, k);
      if (!f) { el.remove(); continue; }
      const rodzic = el.parentNode;
      const img = document.createElementNS(SVG_NS, 'image');
      img.setAttribute('x', String(f.x));
      img.setAttribute('y', String(f.y));
      img.setAttribute('width', String(f.w));
      img.setAttribute('height', String(f.h));
      img.setAttribute('preserveAspectRatio', 'none');
      img.setAttribute('href', f.url);
      img.setAttribute('data-fragment', String(obrazy += 1));
      if (rodzic !== svg) {
        // Obraz leży w układzie rysunku: odwrotność przekształceń przodków.
        const m = svg.getScreenCTM().inverse().multiply(rodzic.getScreenCTM()).inverse();
        img.setAttribute('transform', `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
      }
      el.replaceWith(img);
    }
    return { kod: new XMLSerializer().serializeToString(svg), obrazy };
  } finally {
    host.remove();
  }
}

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
  return { obiekt: tb, zastapiona: rodzina ? null : (pierwsza || 'bez nazwy'), punkt, kotwica };
}

// Rozmiar pisma napisu w SVG (własny albo odziedziczony), w jednostkach rysunku.
function rozmiarPisma(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentNode) {
    const v = parseFloat(e.style?.fontSize || e.getAttribute('font-size'));
    if (v > 0) return v;
  }
  return 16;
}

// Przygotowanie kodu rysunku do rozkładu. Zwraca { kod, pominiete: liczba zdjęć spod adresów w sieci }.
// 1. Napis złożony z części o własnym położeniu (<tspan x= y= dy=>, np. kilka wierszy) Fabric skleiłby
//    w jeden wiersz. Każda taka część staje się osobnym napisem; części jednego napisu mają wspólny
//    znacznik data-napis, po którym wiersze o równych odstępach łączą się potem w jedną ramkę.
// 2. Zdjęcia wskazane adresem w sieci znikają: w rysunku wstawionym jako obraz też ich nie widać,
//    a rozkład nie może czekać na obcy serwer.
function przygotujRysunek(kod) {
  const dok = new DOMParser().parseFromString(kod, 'image/svg+xml');
  if (dok.querySelector('parsererror')) return { kod, pominiete: 0 };
  const pierwsza = (v) => String(v ?? '').trim().split(/[\s,]+/)[0];
  let pominiete = 0;
  for (const z of [...dok.querySelectorAll('image')]) {
    const adres = z.getAttribute('href') || z.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
    if (!/^data:image\//i.test(adres.trim())) { z.remove(); pominiete += 1; }
  }
  let nr = 0;
  for (const t of [...dok.querySelectorAll('text')]) {
    const em = rozmiarPisma(t);
    const liczba = (v) => parseFloat(pierwsza(v)) || 0;
    const dlugosc = (v) => liczba(v) * (/em$/.test(pierwsza(v)) ? em : 1);
    let czesc = { x: liczba(t.getAttribute('x')) + dlugosc(t.getAttribute('dx')), y: liczba(t.getAttribute('y')) + dlugosc(t.getAttribute('dy')), tekst: '', wzor: null };
    const czesci = [czesc];
    for (const w of t.childNodes) {
      if (w.nodeType === 3) czesc.tekst += w.nodeValue;
      else if (w.nodeType === 1 && w.localName === 'tspan' && (w.hasAttribute('x') || w.hasAttribute('y'))) {
        czesc = {
          x: w.hasAttribute('x') ? liczba(w.getAttribute('x')) + dlugosc(w.getAttribute('dx')) : czesc.x,
          y: (w.hasAttribute('y') ? liczba(w.getAttribute('y')) : czesc.y) + dlugosc(w.getAttribute('dy')),
          tekst: w.textContent,
          wzor: w,
        };
        czesci.push(czesc);
      } else if (w.nodeType === 1) czesc.tekst += w.textContent;
    }
    if (czesci.length < 2) continue;
    nr += 1;
    for (const c of czesci) {
      const tekst = c.tekst.replace(/\s+/g, ' ').trim();
      if (!tekst) continue;
      const n = t.cloneNode(false);
      for (const a of ['dx', 'dy', 'rotate', 'textLength']) n.removeAttribute(a);
      for (const a of c.wzor?.attributes || []) {
        if (['x', 'y', 'dx', 'dy'].includes(a.name)) continue;
        n.setAttribute(a.name, a.name === 'style' ? `${t.getAttribute('style') || ''};${a.value}` : a.value);
      }
      n.setAttribute('x', String(c.x));
      n.setAttribute('y', String(c.y));
      n.setAttribute('data-napis', String(nr));
      n.textContent = tekst;
      t.parentNode.insertBefore(n, t);
    }
    t.remove();
  }
  return { kod: new XMLSerializer().serializeToString(dok), pominiete };
}

// Kolejne wiersze jednego napisu (ten sam wygląd, to samo zaczepienie, równe odstępy) → jedna ramka tekstu.
// wiersze: [{ obiekt, punkt, kotwica }]. Zwraca listę ramek: jedną, gdy da się połączyć, inaczej wszystkie.
function polaczWiersze(wiersze) {
  const [p] = wiersze;
  const a = p.obiekt;
  const odstep = wiersze.length > 1 ? (wiersze[wiersze.length - 1].punkt.y - p.punkt.y) / (wiersze.length - 1) : 0;
  const taki = (w, i) => {
    const o = w.obiekt;
    return w.kotwica === p.kotwica && Math.abs(w.punkt.x - p.punkt.x) < a.fontSize * 0.02
      && Math.abs(w.punkt.y - (p.punkt.y + i * odstep)) < a.fontSize * 0.05
      && Math.abs(o.angle % 360) < 0.01 && o.scaleX === 1 && o.scaleY === 1
      && ['fontFamily', 'fontWeight', 'fontStyle', 'stroke', 'charSpacing'].every((k) => o[k] === a[k])
      && Math.abs(o.fontSize - a.fontSize) < a.fontSize * 0.005 && String(o.fill) === String(a.fill);
  };
  if (wiersze.length < 2 || odstep < a.fontSize * 0.5 || odstep > a.fontSize * 4 || !wiersze.every(taki)) return wiersze.map((w) => w.obiekt);
  // Odległość góry ramki od pierwszej linii pisma nie zależy od interlinii, więc pierwszy wiersz zostaje w miejscu.
  a.set({ width: 1e6, text: wiersze.map((w) => w.obiekt.text).join('\n'), lineHeight: odstep / (a.fontSize * a._fontSizeMult) });
  a.set('width', a.calcTextWidth() + a.fontSize * 0.05);
  a.setPositionByOrigin(p.punkt, p.kotwica, 'top');
  a.setCoords();
  return [a];
}

// Zdjęcie osadzone w rysunku staje się zwykłym obrazem projektu (z własnym plikiem wśród obrazów).
async function naObraz(projekt, o, nazwa) {
  const zrodlo = o.getSrc?.() || '';
  const typ = /^data:image\/([a-z0-9.+-]+)/i.exec(zrodlo);
  if (!typ) return null;
  const id = uid('z');
  projekt.zasoby[id] = { nazwa: `${nazwa}.${typ[1].toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg')}`, dataUrl: zrodlo };
  await przygotujKopie(projekt.zasoby, [{ type: 'image', zasob: id }]);
  let img;
  try { img = await fabric.FabricImage.fromURL(zrodloObrazu(projekt.zasoby)(id)); } catch { delete projekt.zasoby[id]; return null; }
  img.set({ width: o.width, height: o.height, cropX: o.cropX || 0, cropY: o.cropY || 0, opacity: o.opacity, zasob: id, nazwa: projekt.zasoby[id].nazwa });
  nadajMacierz(img, o.calcOwnMatrix());
  return img;
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
  if (o.type === 'image') return o;
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
// Zwraca { grupa, ile, napisy, zastapione: [nazwy czcionek], uwaga, obrazy: fragmenty zamienione na obraz } albo { blad }.
// Grupa ma położenie, obrót i odbicie obrazu; nie jest jeszcze na stronie.
export async function rozlozRysunek(projekt, obj) {
  if (!toRysunekSvg(projekt, obj)) return { blad: 'To nie jest rysunek SVG.' };
  let kod;
  try { kod = await (await blobZasobu(projekt, obj.zasob)).text(); } catch { return { blad: 'Nie udało się odczytać pliku rysunku.' }; }
  const gotowy = przygotujRysunek(kod);
  // 300 dpi w rozmiarze na stronie: piksele obrazu na jednostkę viewBox (strona: 96 px na cal).
  const { nw: nw0 } = rozmiarOryginalu(obj);
  const vbW = Number((/viewBox\s*=\s*["']\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)/i.exec(gotowy.kod) || [])[1]) || nw0;
  let efekty = { kod: gotowy.kod, obrazy: 0 };
  try { efekty = await zamienEfekty(gotowy.kod, (300 / 96) * Math.abs(obj.scaleX) * (nw0 / vbW)); } catch (e) { console.error(e); }
  let wynik;
  try { wynik = await fabric.loadSVGFromString(efekty.kod); } catch { wynik = null; }
  const opcje = wynik?.options;
  const pary = (wynik?.objects || []).map((o, i) => [o, wynik.elements?.[i]]).filter(([o]) => o && o.visible !== false);
  if (!pary.length || !(opcje?.width > 0) || !(opcje?.height > 0)) return { blad: 'Tego rysunku nie da się rozłożyć na elementy.' };

  const napisy = pary.filter(([o]) => typeof o.text === 'string');
  // Czy kształty z rozkładu wyglądają jak rysunek (napisów nie porównujemy: obraz rysuje je czcionką systemu).
  const brak = NIEOBSLUGIWANE.exec(efekty.kod.replace(/<defs\b[\s\S]*?<\/defs>/gi, ''));
  let uwaga = brak ? tt('svgElementy.rysunekUzywaElementuKtorego', { x: brak[1] || brak[0] }) : '';
  const zdjecia = pary.filter(([o]) => o.type === 'image');
  // Porównanie z rysunkiem robi ten sam kod co PDF wektorowy – wczytywany dopiero tu (razem z resztą zapisu PDF).
  if (!uwaga && !napisy.length && !zdjecia.length && !efekty.obrazy) {
    const { svgZgodny } = await import('./pdf-wektorowy.js');
    if (!svgZgodny(obj.getElement(), pary.map(([o]) => o), opcje)) uwaga = 'Wygląd mógł się trochę zmienić.';
  }

  // Czcionki napisów muszą być wczytane, zanim napisy zostaną zmierzone.
  await zapewnijRodziny([DOMYSLNA, ...napisy.map(([o]) => znanaRodzina(projekt, o.fontFamily)).filter(Boolean)]);

  // Układ pośredni: środek obrazu w punkcie (0,0), bez obrotu i odbicia; skala jak na stronie.
  const { nw, nh } = rozmiarOryginalu(obj);
  const sx = Math.abs(obj.scaleX); const sy = Math.abs(obj.scaleY);
  const m = [sx * (nw / opcje.width), 0, 0, sy * (nh / opcje.height), -sx * (obj.cropX + obj.width / 2), -sy * (obj.cropY + obj.height / 2)];
  const zastapione = new Set();
  const obiekty = [];
  let wiersze = []; // kolejne części jednego napisu (data-napis)
  let napis = null;
  const zamknijNapis = () => { if (wiersze.length) obiekty.push(...polaczWiersze(wiersze)); wiersze = []; napis = null; };
  const bezRozszerzenia = String(obj.nazwa || 'rysunek').replace(/\.[a-z0-9]+$/i, '');
  let { pominiete } = gotowy;
  for (const [o, el] of pary) {
    if (typeof o.text === 'string') {
      const w = naTekst(projekt, o, el, m);
      if (w.zastapiona) zastapione.add(w.zastapiona);
      const znacznik = el?.getAttribute?.('data-napis') || null;
      if (!znacznik || znacznik !== napis) zamknijNapis();
      if (znacznik) { napis = znacznik; wiersze.push(w); } else obiekty.push(w.obiekt);
      continue;
    }
    zamknijNapis();
    if (o.type === 'image') {
      const fragment = el?.getAttribute?.('data-fragment');
      const img = await naObraz(projekt, o, fragment ? tt('kod.svg.fragment', { nazwa: bezRozszerzenia, f: fragment }) : tt('kod.svg.zdjecie', { nazwa: bezRozszerzenia, n: zdjecia.filter(([, e]) => !e?.getAttribute?.('data-fragment')).findIndex(([z]) => z === o) + 1 }));
      if (img) obiekty.push(naStrone(img, m)); else pominiete += 1;
      continue;
    }
    bezPustegoObrysu(o);
    if (o.type === 'polygon' || o.type === 'polyline') obiekty.push(naStrone(naKsztalt(o), m));
    else if (o.type === 'circle') obiekty.push(naStrone(naElipse(o), m));
    else obiekty.push(naStrone(o, m));
  }
  zamknijNapis();
  if (!obiekty.length) return { blad: 'Tego rysunku nie da się rozłożyć na elementy.' };
  for (const o of obiekty) o.set({ id: uid('o') });

  const grupa = new fabric.Group(obiekty, { id: uid('o'), nazwa: obj.nazwa || undefined, opacity: obj.opacity, warstwa: obj.warstwa });
  // Przycięcie obrazu przechodzi na grupę: prostokąt widocznej części, liczony od środka grupy.
  const przyciety = obj.cropX > 0.5 || obj.cropY > 0.5 || obj.width < nw - 0.5 || obj.height < nh - 0.5;
  if (przyciety) {
    const c = grupa.getCenterPoint();
    grupa.clipPath = new fabric.Rect({ originX: 'center', originY: 'center', left: -c.x, top: -c.y, width: obj.width * sx, height: obj.height * sy, strokeWidth: 0 });
  }
  // Grupa przejmuje obrót i odbicie obrazu; jej środek trafia tam, gdzie wypada w obrazie.
  const srodek = obj.getCenterPoint();
  const naStronie = fabric.util.composeMatrix({ translateX: srodek.x, translateY: srodek.y, angle: obj.angle || 0, flipX: obj.flipX, flipY: obj.flipY });
  const srodekGrupy = fabric.util.transformPoint(grupa.getCenterPoint(), naStronie);
  grupa.set({ angle: obj.angle || 0, flipX: Boolean(obj.flipX), flipY: Boolean(obj.flipY) });
  grupa.setPositionByOrigin(srodekGrupy, 'center', 'center');
  grupa.setCoords();
  for (const o of obiekty) o.setCoords();
  const uwagi = [];
  if (przyciety) uwagi.push('Grupa jest przycięta tak jak obraz (przycięcie zdejmiesz we właściwościach grupy).');
  if (pominiete) uwagi.push('Zdjęcie wskazane adresem w sieci zostało pominięte.');
  if (uwaga) uwagi.push(uwaga);
  return { grupa, ile: obiekty.length, napisy: napisy.length, zastapione: [...zastapione], uwaga: uwagi.join(' '), obrazy: efekty.obrazy };
}
