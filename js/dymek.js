/* global fabric */
// Dymek (#360): ramka tekstu, która sama rysuje dookoła siebie dymek – mowa, myśl, krzyk albo narracja –
// z ogonkiem wskazującym punkt. Jeden element: tekst pisze się w nim jak w zwykłej ramce, a dymek rośnie
// razem z tekstem (rysowany od wymiarów ramki przy każdym rysowaniu). Ogonek przeciąga się uchwytem.
//
// Zapis w elemencie (textbox): dymek: { rodzaj: 'mowa' | 'mysl' | 'krzyk' | 'szept' | 'narracja',
//   ogonek: { x, y } | null – punkt w mm względem lewego górnego rogu ramki tekstu (jedzie razem z dymkiem),
//   wypelnienie: '#ffffff', obrys: '#1a1a1a', grubosc: 0.35 (mm), margines: mm (domyślnie z rozmiaru pisma) }.
// Rysunek idzie przez kontekst płótna, więc tak samo w edytorze, podglądzie, obrazach i wektorowo w PDF.

export const RODZAJE_DYMKA = ['mowa', 'mysl', 'krzyk', 'szept', 'narracja'];

export const domyslnyDymek = (d = {}) => ({
  rodzaj: RODZAJE_DYMKA.includes(d.rodzaj) ? d.rodzaj : 'mowa',
  ogonek: d.ogonek && Number.isFinite(Number(d.ogonek.x)) && Number.isFinite(Number(d.ogonek.y)) ? { x: Number(d.ogonek.x), y: Number(d.ogonek.y) } : null,
  wypelnienie: d.wypelnienie || '#ffffff',
  obrys: d.obrys || '#1a1a1a',
  grubosc: Number(d.grubosc) >= 0 ? Number(d.grubosc) : 0.35,
  ...(Number(d.margines) >= 0 ? { margines: Number(d.margines) } : {}),
});

// Margines dymka wokół tekstu (mm): narracja – ciasno, mowa i krzyk – więcej (zaokrąglenia, kolce), myśl – najwięcej.
export function marginesDymka(o) {
  const d = o.dymek || {};
  if (Number(d.margines) >= 0) return Number(d.margines);
  const pismo = o.fontSize || 4;
  return pismo * ({ narracja: 0.45, mowa: 0.7, szept: 0.7, krzyk: 1.0, mysl: 1.1 }[d.rodzaj] ?? 0.7);
}

// Pudełko dymka w układzie elementu (środek ramki = 0,0) i punkt ogonka w tym samym układzie.
function geometria(o) {
  const w = o.width || 0;
  const h = o.height || 0;
  const m = marginesDymka(o);
  const og = o.dymek?.ogonek;
  return {
    x: -w / 2 - m, y: -h / 2 - m, w: w + 2 * m, h: h + 2 * m,
    ogonek: og && o.dymek.rodzaj !== 'narracja' ? { x: og.x - w / 2, y: og.y - h / 2 } : null,
  };
}

// Punkt na brzegu elipsy wpisanej w pudełko, w stronę punktu p (od środka).
function naBrzegu(g, p, skala = 1) {
  const cx = g.x + g.w / 2; const cy = g.y + g.h / 2;
  const kat = Math.atan2(p.y - cy, p.x - cx);
  return { x: cx + Math.cos(kat) * (g.w / 2) * skala, y: cy + Math.sin(kat) * (g.h / 2) * skala, kat };
}

// Ścieżki (lista figur do wypełnienia i obrysowania): każda figura to funkcja rysująca ścieżkę w kontekście.
export function figuryDymka(o) {
  const g = geometria(o);
  const rodzaj = o.dymek?.rodzaj || 'mowa';
  const cx = g.x + g.w / 2; const cy = g.y + g.h / 2;
  const rx = g.w / 2; const ry = g.h / 2;
  const figury = [];
  const trojkat = (szer) => {
    if (!g.ogonek) return;
    const b = naBrzegu(g, g.ogonek, 0.8);
    const hw = Math.min(g.w, g.h) * szer;
    const px = -Math.sin(b.kat) * hw; const py = Math.cos(b.kat) * hw;
    figury.push((ctx) => { ctx.moveTo(b.x + px, b.y + py); ctx.lineTo(g.ogonek.x, g.ogonek.y); ctx.lineTo(b.x - px, b.y - py); ctx.closePath(); });
  };
  if (rodzaj === 'narracja') {
    figury.push((ctx) => { ctx.rect(g.x, g.y, g.w, g.h); });
  } else if (rodzaj === 'mowa' || rodzaj === 'szept') {
    // Owal: zaokrąglony prostokąt o promieniu blisko połowy krótszego boku – tekst mieści się lepiej niż w elipsie.
    const r = Math.min(g.w, g.h) * 0.45;
    trojkat(0.13);
    figury.push((ctx) => {
      ctx.moveTo(g.x + r, g.y);
      ctx.lineTo(g.x + g.w - r, g.y); ctx.quadraticCurveTo(g.x + g.w, g.y, g.x + g.w, g.y + r);
      ctx.lineTo(g.x + g.w, g.y + g.h - r); ctx.quadraticCurveTo(g.x + g.w, g.y + g.h, g.x + g.w - r, g.y + g.h);
      ctx.lineTo(g.x + r, g.y + g.h); ctx.quadraticCurveTo(g.x, g.y + g.h, g.x, g.y + g.h - r);
      ctx.lineTo(g.x, g.y + r); ctx.quadraticCurveTo(g.x, g.y, g.x + r, g.y);
      ctx.closePath();
    });
  } else if (rodzaj === 'krzyk') {
    // Wybuch: kolce na obwodzie elipsy (zewnętrzne ponad nią, wewnętrzne na niej).
    trojkat(0.1);
    const n = Math.max(14, Math.round((g.w + g.h) / 6));
    figury.push((ctx) => {
      for (let i = 0; i < n * 2; i += 1) {
        const kat = (i / (n * 2)) * Math.PI * 2;
        const s = i % 2 ? 1 : 1.22;
        const x = cx + Math.cos(kat) * rx * s; const y = cy + Math.sin(kat) * ry * s;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
    });
  } else {
    // Myśl: chmurka (elipsa i bąble na obwodzie), ogonek z trzech malejących kółek.
    const n = Math.max(8, Math.round((g.w + g.h) / 9));
    const rb = Math.min(rx, ry) * 0.42;
    if (g.ogonek) {
      const b = naBrzegu(g, g.ogonek, 1.05);
      for (const [t, r] of [[0.25, 0.5], [0.55, 0.33], [0.85, 0.2]]) {
        const x = b.x + (g.ogonek.x - b.x) * t; const y = b.y + (g.ogonek.y - b.y) * t;
        figury.push((ctx) => { ctx.moveTo(x + rb * r, y); ctx.arc(x, y, rb * r, 0, Math.PI * 2); });
      }
    }
    figury.push((ctx) => { ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); });
    for (let i = 0; i < n; i += 1) {
      const kat = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(kat) * rx * 0.92; const y = cy + Math.sin(kat) * ry * 0.92;
      figury.push((ctx) => { ctx.moveTo(x + rb, y); ctx.arc(x, y, rb, 0, Math.PI * 2); });
    }
  }
  return figury;
}

// Rysowanie: najpierw wszystkie obrysy podwójną grubością, potem wszystkie wypełnienia – widać zewnętrzną połowę
// obrysu, czyli obrys całości (dymek z ogonkiem i bąblami jako jeden kształt), bez kresek w środku.
export function rysujDymek(ctx, o) {
  const d = o.dymek;
  if (!d) return;
  const figury = figuryDymka(o);
  ctx.save();
  if (d.grubosc > 0 && d.obrys && d.obrys !== 'transparent') {
    ctx.lineWidth = d.grubosc * 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = d.obrys;
    // Szept: obrys przerywany (kreski ok. 4 grubości obrysu).
    if (d.rodzaj === 'szept') ctx.setLineDash([d.grubosc * 5, d.grubosc * 4]);
    for (const f of figury) { ctx.beginPath(); f(ctx); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  ctx.fillStyle = d.wypelnienie && d.wypelnienie !== 'transparent' ? d.wypelnienie : '#ffffff';
  for (const f of figury) { ctx.beginPath(); f(ctx); ctx.fill(); }
  ctx.restore();
}

// Uchwyt ogonka: kółko w punkcie ogonka; przeciąganie zmienia punkt (w mm względem lewego górnego rogu ramki).
function kontrolkaOgonka() {
  return new fabric.Control({
    cursorStyle: 'crosshair',
    actionName: 'ogonek',
    positionHandler(wymiary, macierz, o) {
      const og = o.dymek?.ogonek;
      if (!og) return new fabric.Point(-10000, -10000);
      return new fabric.Point(og.x - o.width / 2, og.y - o.height / 2).transform(macierz);
    },
    actionHandler(zdarzenie, przeksztalcenie, x, y) {
      const o = przeksztalcenie.target;
      const lok = new fabric.Point(x, y).transform(fabric.util.invertTransform(o.calcTransformMatrix()));
      o.dymek = { ...o.dymek, ogonek: { x: Math.round((lok.x + o.width / 2) * 100) / 100, y: Math.round((lok.y + o.height / 2) * 100) / 100 } };
      o.dirty = true;
      return true;
    },
    render(ctx, left, top) {
      ctx.save();
      ctx.beginPath(); ctx.arc(left, top, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
      ctx.restore();
    },
  });
}

// Dymek dostaje uchwyt ogonka (wywoływane dla każdego dodanego obiektu – także wczytanego z zapisu).
export function przygotujDymek(o) {
  if (!o?.dymek || o.type !== 'textbox') return;
  if (!o.controls.ogonek) o.controls = { ...o.controls, ogonek: kontrolkaOgonka() };
  o.objectCaching = false; // dymek i ogonek wychodzą poza ramkę – bez pamięci podręcznej (przycięłaby je)
}

// Łatka na ramkę tekstu: dymek zamiast tła ramki.
export function zainstalujDymki() {
  const P = fabric.Textbox.prototype;
  if (P._dymkiZainstalowane) return;
  P._dymkiZainstalowane = true;
  const tlo = P._renderBackground;
  P._renderBackground = function _renderBackground(ctx) {
    if (this.dymek) { rysujDymek(ctx, this); return; }
    tlo.call(this, ctx);
  };
  const pamiec = P.shouldCache;
  P.shouldCache = function shouldCache() { return this.dymek ? false : pamiec.call(this); };
}
