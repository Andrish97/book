// Plik dla plotera (#218): z bieżącej strony same linie wykrojnika (cięcie, big, perforacja, klej) jako SVG
// w milimetrach – Cricut, Silhouette, ploter tnący w drukarni. Kolory linii jak w edytorze: ploter przypisuje
// operację do koloru (cięcie – czerwony, big – niebieski, perforacja – pomarańczowy, klej – zielone pole).

/* global fabric */
import { zlozCel } from './zlozenie.js';
import { plytaUszlachetnienia } from './kolory-druku.js';

// Elementy z linią wykrojnika (grupa z linią – wszystkie jej kształty), spłaszczone do listy.
function linie(obiekty, wynik = [], zGrupy = null) {
  for (const o of obiekty || []) {
    const u = plytaUszlachetnienia(o);
    const tech = u?.techniczna ? u : zGrupy;
    if (o._objects?.length || o.objects?.length) { linie(o._objects || o.objects, wynik, tech); continue; }
    if (tech) wynik.push({ o, u: tech });
  }
  return wynik;
}

// { svg, ile: { ciecie, big, perforacja, klej } } albo null, gdy na stronie nie ma linii wykrojnika.
export async function svgPlotera(projekt, egz, { ciag } = {}) {
  const { wydruk, obiekty } = await zlozCel(projekt, egz, { ciag, oryginaly: false });
  const lista = linie(obiekty);
  if (!lista.length) return null;
  const w = wydruk.szerokosc_mm;
  const h = wydruk.wysokosc_mm;
  const plotno = new fabric.StaticCanvas(undefined, { width: w, height: h, renderOnAddRemove: false, enableRetinaScaling: false });
  const ile = { ciecie: 0, big: 0, perforacja: 0, klej: 0 };
  try {
    for (const { o, u } of lista) {
      // Element z grupy: położenie na stronie z macierzy grupy.
      if (o.group) {
        const m = o.calcTransformMatrix();
        const d = fabric.util.qrDecompose(m);
        o.group = undefined;
        o.set({ left: d.translateX, top: d.translateY, angle: d.angle, scaleX: d.scaleX, scaleY: d.scaleY, skewX: d.skewX, skewY: 0, originX: 'center', originY: 'center' });
      }
      o.set({
        fill: u.id === 'klej' ? 'rgba(20,163,90,0.25)' : 'none', stroke: u.kolor, strokeWidth: 0.25, strokeUniform: true,
        strokeDashArray: u.kreska?.length ? u.kreska : null, shadow: null, opacity: 1, visible: true,
      });
      if (o.type === 'image') continue; // obraz nie ma konturu do cięcia
      ile[u.id] += 1;
      plotno.add(o);
    }
    const svg = plotno.toSVG({ width: `${w}mm`, height: `${h}mm`, viewBox: { x: 0, y: 0, width: w, height: h } });
    return { svg, ile };
  } finally {
    plotno.dispose();
  }
}
