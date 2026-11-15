/* global fabric, CanvasRenderingContext2D, OffscreenCanvasRenderingContext2D */
// Miękkie krawędzie i zaokrąglone narożniki obrazu (#156).
//
// `miekkie_krawedzie` (mm, 0 = brak) – brzeg elementu przechodzi płynnie w przezroczystość. Działa dla obrazów
// i kształtów (prostokąt, elipsa, wielokąt, kształt z pióra, także z obrazem w środku).
//   `miekkie_rodzaj`: brak / 'rowno' – równo wzdłuż brzegu (także kształtu i przezroczystości PNG),
//                     'owal' – winieta: owal wpisany w element, im bliżej brzegu, tym bardziej przezroczysty.
// Element rysuje się najpierw na osobnym płótnie, potem nakładana jest na nie maska przejścia. To widać tak samo
// w edytorze, miniaturach, podglądzie i PNG; w PDF element z miękkimi krawędziami idzie jako obraz z maską
// przezroczystości (jak cień) – reszta strony zostaje wektorowa.
//
// `zaokraglenie` (mm) – zaokrąglone narożniki zwykłego obrazu: obraz jest przycięty, obramowanie (obrys) idzie
// po zaokrągleniu. Obrys obrazu (stroke, strokeWidth, strokeDashArray) to zwykłe pola Fabric.

export const RODZAJE_MIEKKICH = [['rowno', 'równo wzdłuż brzegu'], ['owal', 'owalna winieta']];

export const maMiekkie = (o) => Number(o?.miekkie_krawedzie) > 0;

const prawdziwyKontekst = (ctx) => (typeof CanvasRenderingContext2D !== 'undefined' && ctx instanceof CanvasRenderingContext2D)
  || (typeof OffscreenCanvasRenderingContext2D !== 'undefined' && ctx instanceof OffscreenCanvasRenderingContext2D);

const MAKS_BOK = 4096; // płótno pomocnicze – większe elementy rysują się w mniejszej rozdzielczości
const BOK_MASKI = 320; // maska „równo” liczona w małej rozdzielczości i powiększana (gładko)

// Rozmycie pudełkowe kanału (trzy przebiegi ≈ Gauss); poza obrazem zera.
function rozmyjKanal(a, w, h, r) {
  if (r < 1) return a;
  const tmp = new Float32Array(a.length);
  const okno = 2 * r + 1;
  const przebieg = (z, na, dl, krok, linie, krokLinii) => {
    for (let l = 0; l < linie; l += 1) {
      const p0 = l * krokLinii;
      let suma = 0;
      for (let k = 0; k <= r && k < dl; k += 1) suma += z[p0 + k * krok];
      for (let k = 0; k < dl; k += 1) {
        na[p0 + k * krok] = suma / okno;
        if (k - r >= 0) suma -= z[p0 + (k - r) * krok];
        if (k + r + 1 < dl) suma += z[p0 + (k + r + 1) * krok];
      }
    }
  };
  for (let p = 0; p < 3; p += 1) { przebieg(a, tmp, w, 1, h, w); przebieg(tmp, a, h, w, w, 1); }
  return a;
}

const nowePlotno = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

// Maska „równo”: rozmyta nieprzezroczystość elementu, przesunięta tak, że na samym brzegu jest 0, a w głąb
// – po szerokości przejścia – 1.
function maskaRowno(zrodlo, pw, ph, fx, fy) {
  const r = Math.min(1, BOK_MASKI / Math.max(pw, ph));
  const mw = Math.max(2, Math.round(pw * r)); const mh = Math.max(2, Math.round(ph * r));
  const male = nowePlotno(mw, mh);
  const g = male.getContext('2d', { willReadFrequently: true });
  g.drawImage(zrodlo, 0, 0, mw, mh);
  const dane = g.getImageData(0, 0, mw, mh);
  const a = new Float32Array(mw * mh);
  for (let i = 0; i < a.length; i += 1) a[i] = dane.data[i * 4 + 3] / 255;
  rozmyjKanal(a, mw, mh, Math.max(1, Math.round((Math.min(fx, fy) * r) / 2)));
  for (let i = 0; i < a.length; i += 1) {
    const v = Math.max(0, Math.min(1, 2 * a[i] - 1));
    dane.data[i * 4] = 0; dane.data[i * 4 + 1] = 0; dane.data[i * 4 + 2] = 0; dane.data[i * 4 + 3] = Math.round(v * 255);
  }
  g.putImageData(dane, 0, 0);
  return male;
}

// Ścieżka prostokąta z zaokrąglonymi narożnikami (łuki Béziera – PDF zapisze je wektorowo).
export function sciezkaZaokraglona(ctx, x, y, w, h, rx, ry) {
  const k = 0.5522847498;
  rx = Math.max(0, Math.min(rx, w / 2)); ry = Math.max(0, Math.min(ry, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rx, y);
  ctx.lineTo(x + w - rx, y);
  ctx.bezierCurveTo(x + w - rx + rx * k, y, x + w, y + ry - ry * k, x + w, y + ry);
  ctx.lineTo(x + w, y + h - ry);
  ctx.bezierCurveTo(x + w, y + h - ry + ry * k, x + w - rx + rx * k, y + h, x + w - rx, y + h);
  ctx.lineTo(x + rx, y + h);
  ctx.bezierCurveTo(x + rx - rx * k, y + h, x, y + h - ry + ry * k, x, y + h - ry);
  ctx.lineTo(x, y + ry);
  ctx.bezierCurveTo(x, y + ry - ry * k, x + rx - rx * k, y, x + rx, y);
  ctx.closePath();
}

export function zainstalujMiekkieKrawedzie() {
  if (typeof fabric === 'undefined' || fabric.FabricObject.prototype._miekkieKrawedzie) return;
  const proto = fabric.FabricObject.prototype;
  proto._miekkieKrawedzie = true;

  const rysuj = proto.drawObject;
  proto.drawObject = function drawObject(ctx, forClipping, context) {
    if (!maMiekkie(this) || forClipping || this.type === 'group' || this.type === 'activeselection') return rysuj.call(this, ctx, forClipping, context);
    // PDF: element z miękkimi krawędziami idzie jako obraz z maską przezroczystości (js/pdf-wektorowy.js).
    if (!prawdziwyKontekst(ctx)) throw Object.assign(new Error('miękkie krawędzie'), { niewektorowe: true });
    const m = ctx.getTransform();
    let sx = Math.hypot(m.a, m.b); let sy = Math.hypot(m.c, m.d);
    if (!(sx > 0) || !(sy > 0)) return rysuj.call(this, ctx, forClipping, context);
    const skala = this.getObjectScaling();
    const ox = Math.abs(skala.x) || 1; const oy = Math.abs(skala.y) || 1;
    // Zapas na obrys (przy strokeUniform grubość jest w mm strony).
    const sw = this.stroke && this.strokeWidth ? this.strokeWidth : 0;
    const zx = (this.strokeUniform ? sw / ox : sw) / 2 + 1 / sx; const zy = (this.strokeUniform ? sw / oy : sw) / 2 + 1 / sy;
    const W = (this.width || 0) + 2 * zx; const H = (this.height || 0) + 2 * zy;
    const zmniejsz = Math.min(1, MAKS_BOK / Math.max(W * sx, H * sy, 1));
    sx *= zmniejsz; sy *= zmniejsz;
    const pw = Math.max(1, Math.ceil(W * sx)); const ph = Math.max(1, Math.ceil(H * sy));
    const plotno = nowePlotno(pw, ph);
    const p = plotno.getContext('2d');
    p.setTransform(sx, 0, 0, sy, pw / 2, ph / 2);
    rysuj.call(this, p, false, context);
    // Szerokość przejścia w pikselach płótna pomocniczego.
    const f = Number(this.miekkie_krawedzie);
    const fx = (f / ox) * sx; const fy = (f / oy) * sy;
    p.setTransform(1, 0, 0, 1, 0, 0);
    p.globalCompositeOperation = 'destination-in';
    if (this.miekkie_rodzaj === 'owal') {
      const rx = ((this.width || 0) / 2) * sx; const ry = ((this.height || 0) / 2) * sy;
      const t0 = Math.max(0, Math.min(0.999, 1 - Math.min(fx / Math.max(rx, 1e-6), fy / Math.max(ry, 1e-6))));
      p.translate(pw / 2, ph / 2);
      p.scale(Math.max(rx, 1e-6), Math.max(ry, 1e-6));
      const gr = p.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(t0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      p.fillStyle = gr;
      p.fillRect(-pw, -ph, pw * 2, ph * 2); // poza owalem – przezroczyście (ostatni przystanek)
    } else {
      p.imageSmoothingEnabled = true;
      p.drawImage(maskaRowno(plotno, pw, ph, fx, fy), 0, 0, pw, ph);
    }
    ctx.drawImage(plotno, -W / 2, -H / 2, W, H);
    return undefined;
  };

  // Zaokrąglone narożniki zwykłego obrazu: przycięcie obrazu i obrys po zaokrągleniu.
  const img = fabric.FabricImage.prototype;
  const renderObrazu = img._render;
  img._render = function _render(ctx) {
    const r = Number(this.zaokraglenie);
    if (!(r > 0) || !this._element) return renderObrazu.call(this, ctx);
    const s = this.getObjectScaling();
    const rx = r / (Math.abs(s.x) || 1); const ry = r / (Math.abs(s.y) || 1);
    const w = this.width; const h = this.height;
    ctx.imageSmoothingEnabled = this.imageSmoothing;
    ctx.save();
    sciezkaZaokraglona(ctx, -w / 2, -h / 2, w, h, rx, ry);
    ctx.clip();
    this._renderFill(ctx);
    ctx.restore();
    if (this.stroke && this.strokeWidth) {
      sciezkaZaokraglona(ctx, -w / 2, -h / 2, w, h, rx, ry);
      this._renderStroke(ctx);
    }
    return undefined;
  };
}
