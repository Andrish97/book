/* global fabric */
// Wzór jako wypełnienie kształtu (#182): prostokąt, elipsa, wielokąt i zamknięty kształt (ścieżka) mogą mieć
// zamiast samego koloru powtarzalny wzór z Biblioteki (paski, kropki, kratka, jodełka, fale…).
//
// Pole elementu: `wzor: { id, kolor, skala, obrot }` – id wzoru z js/wzory-tla.js, kolor wzoru, skala (1 = jak
// w Bibliotece, 0.25–4), obrót w stopniach. Tłem jest zwykłe wypełnienie elementu (`fill`, kolor albo przejście).
//
// Wzór rysuje się wektorowo: kształt przycina (clip) jedną ścieżkę wzoru – w edytorze, miniaturach, podglądzie,
// PNG i w PDF wektorowym (te same polecenia płótna; bez wzoru Fabric/„Pattern”, który byłby obrazem).
// Kształt z obrazem w środku (obraz w kształcie, #123) wzoru nie ma.

import { WZORY_WYPELNIEN } from './wzory-tla.js';

export const WZORY = WZORY_WYPELNIEN;
const WG_ID = new Map(WZORY.map((w) => [w.id, w]));
export const TYPY_ZE_WZOREM = new Set(['rect', 'ellipse', 'polygon', 'path']);

// Czy element może mieć wzór (kształt bez obrazu w środku; ścieżka – tylko zamknięta).
export function moznaWzor(o) {
  if (!o || !TYPY_ZE_WZOREM.has(o.type) || o.zasob) return false;
  if (o.type === 'path') return Array.isArray(o.path) && o.path.some((k) => k[0] === 'Z' || k[0] === 'z');
  return true;
}

export function normalizujWzor(w) {
  if (!w || typeof w !== 'object' || !WG_ID.has(w.id)) return null;
  const liczba = (v, d, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  return {
    id: w.id,
    kolor: typeof w.kolor === 'string' && w.kolor ? w.kolor : '#2f5d8a',
    skala: liczba(w.skala, 1, 0.25, 4),
    obrot: liczba(w.obrot, 0, -360, 360),
  };
}

// Polecenia ścieżki wzoru dla kwadratu (jednostki wzoru) – w pamięci, bo wzór liczy się z geometrii.
const pamiec = new Map();
function poleceniaWzoru(wzor, D) {
  const bok = Math.max(8, Math.ceil(D / 8) * 8); // zaokrąglenie – mniej przeliczeń przy zmianie rozmiaru
  const klucz = `${wzor.id}|${bok}`;
  if (pamiec.has(klucz)) return pamiec.get(klucz);
  const w = wzor.gen(bok, bok);
  const pol = w.d ? fabric.util.makePathSimpler(fabric.util.parsePath(w.d)) : [];
  const wynik = { bok, pol, linia: w.linia || 0, krycie: w.krycie ?? 1 };
  if (pamiec.size > 60) pamiec.clear();
  pamiec.set(klucz, wynik);
  return wynik;
}

function sciezka(ctx, pol) {
  ctx.beginPath();
  for (const k of pol) {
    if (k[0] === 'M') ctx.moveTo(k[1], k[2]);
    else if (k[0] === 'L') ctx.lineTo(k[1], k[2]);
    else if (k[0] === 'C') ctx.bezierCurveTo(k[1], k[2], k[3], k[4], k[5], k[6]);
    else if (k[0] === 'Q') ctx.quadraticCurveTo(k[1], k[2], k[3], k[4]);
    else if (k[0] === 'Z' || k[0] === 'z') ctx.closePath();
  }
}

// Rysuje wzór w układzie elementu (środek elementu w 0,0), już przyciętym do kształtu.
export function rysujWzor(o, ctx) {
  const w = normalizujWzor(o.wzor);
  const def = w && WG_ID.get(w.id);
  if (!def) return;
  const s = o.getObjectScaling ? o.getObjectScaling() : { x: o.scaleX || 1, y: o.scaleY || 1 };
  const sx = Math.abs(s.x) || 1; const sy = Math.abs(s.y) || 1;
  // Wymiary w jednostkach strony (mm) – wzór nie rozciąga się razem z elementem.
  const Wp = (o.width || 0) * sx; const Hp = (o.height || 0) * sy;
  const p = poleceniaWzoru(def, Math.hypot(Wp, Hp) / w.skala + 2);
  ctx.save();
  ctx.scale(1 / sx, 1 / sy);
  if (w.obrot) ctx.rotate((w.obrot * Math.PI) / 180);
  ctx.scale(w.skala, w.skala);
  ctx.translate(-p.bok / 2, -p.bok / 2);
  sciezka(ctx, p.pol);
  ctx.globalAlpha *= p.krycie;
  if (p.linia) {
    ctx.strokeStyle = w.kolor;
    ctx.lineWidth = p.linia;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.setLineDash?.([]);
    ctx.stroke();
  } else {
    ctx.fillStyle = w.kolor;
    ctx.fill('nonzero');
  }
  ctx.restore();
}

// Podgląd wzoru (SVG) do przycisków wyboru.
export function podgladWzoru(id, { kolor = 'currentColor', bok = 28 } = {}) {
  const def = WG_ID.get(id);
  if (!def) return '';
  const w = def.gen(bok, bok);
  const styl = w.linia ? `fill="none" stroke="${kolor}" stroke-width="${Math.max(0.6, w.linia * 1.6)}"` : `fill="${kolor}"`;
  return `<svg viewBox="0 0 ${bok} ${bok}" aria-hidden="true"><path d="${w.d}" ${styl} opacity="${w.krycie ?? 1}"/></svg>`;
}

// Fabric: kształt ze wzorem rysuje się w trzech krokach – tło (wypełnienie bez obrysu), wzór przycięty
// kształtem, na końcu obrys (żeby wzór go nie zakrywał).
export function zainstalujWzory() {
  if (typeof fabric === 'undefined' || fabric.FabricObject.prototype._wzoryWypelnien) return;
  const proto = fabric.FabricObject.prototype;
  proto._wzoryWypelnien = true;
  const kolejnosc = proto._renderPaintInOrder;
  proto._renderPaintInOrder = function _renderPaintInOrder(ctx) {
    if (this._wzorKrok === 'sciezka') { ctx.clip(this.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'); return; }
    if (this._wzorKrok === 'obrys') { this._renderStroke(ctx); return; }
    kolejnosc.call(this, ctx);
  };
  for (const klasa of ['Rect', 'Ellipse', 'Polyline', 'Polygon', 'Path']) {
    const kp = fabric[klasa]?.prototype;
    // Klasa dziedzicząca już podmieniony _render (Polygon po Polyline) – bez drugiego owinięcia.
    if (!kp || kp._render?._zWzorem) continue;
    const render = kp._render;
    const zWzorem = function _render(ctx) {
      if (!this.wzor || !moznaWzor(this) || !WG_ID.has(this.wzor.id)) { render.call(this, ctx); return; }
      const obrys = this.stroke;
      this.stroke = null;
      try { render.call(this, ctx); } finally { this.stroke = obrys; }
      ctx.save();
      this._wzorKrok = 'sciezka';
      try { render.call(this, ctx); } finally { this._wzorKrok = null; }
      rysujWzor(this, ctx);
      ctx.restore();
      if (obrys && this.strokeWidth) {
        this._wzorKrok = 'obrys';
        try { render.call(this, ctx); } finally { this._wzorKrok = null; }
      }
    };
    zWzorem._zWzorem = true;
    kp._render = zWzorem;
  }
}
