// Uproszczona makieta na urządzeniach bez grafiki 3D (zgłoszenie 19.11: „zrób prostszy render na kompach bez 3D”).
//
// Ta sama scena co w makiecie 3D (js/makieta-3d.js, `scena` – czworokąty z teksturami stron), ten sam interfejs
// renderera (utworzRenderer: ustawTeksture, maTeksture, przytnijStrony, rysuj…), więc okno makiety działa bez zmian:
// obracanie palcem i myszą, przewracanie kartek, ujęcia, obraz PNG, ujęcia do linku. Rysuje zwykłe płótno 2D
// (działa w każdej przeglądarce): trójkąty od najdalszego do najbliższego (algorytm malarza), strona nałożona
// przekształceniem afinicznym, jasność ściany z kierunku światła (bez cieni rzucanych, połysku i odbić), pod
// spodem miękki cień obiektu na stole albo ścianie.

import { obwiednia } from './makieta-3d.js';
import { DOMYSLNE_OPCJE, normalizujOpcje } from './makieta-ustawienia.js';

const PAPIER = '#fbfaf7';
const MAKS_PIKSELI = 1.1e6; // bufor rysowania (procesor) – większe płótno jest skalowane
const KOLORY_FAKTUR = { drewno: '#a77a52', papier: '#efe9dc', beton: '#a3a09a', marmur: '#eceae6', tkanina: '#5f6d7c', tynk: '#e9e4da' };
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const kolorRGB = (h) => { const x = String(h).replace('#', ''); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; };
const rgb = ([r, g, b]) => `rgb(${Math.round(Math.max(0, Math.min(255, r)))},${Math.round(Math.max(0, Math.min(255, g)))},${Math.round(Math.max(0, Math.min(255, b)))})`;

// Średni kolor obrazu (wypełnienie małych i powtarzanych fragmentów, np. krawędzi kartek).
function sredni(obraz) {
  try {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const g = c.getContext('2d');
    g.drawImage(obraz, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data;
    const s = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; }
    return s.map((v) => v / 64);
  } catch { return kolorRGB(PAPIER); }
}

// Trójkąt do bufora: e – [x, y, 1/w] w pikselach bufora, uv – współrzędne obrazu strony, poz – poziom obrazu
// (null – jednolity kolor kol), mn – jasność ściany na kanał. Głębokość: 1/w (większa – bliżej), uv z poprawką
// perspektywy.
function trojkat(px, gl, bw, bh, A, B, C, ta, tb, tc, poz, kol, mn) {
  const pole = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
  if (Math.abs(pole) < 1e-6) return;
  const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])));
  const x1 = Math.min(bw - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
  const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])));
  const y1 = Math.min(bh - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
  if (x0 > x1 || y0 > y1) return;
  const odw = 1 / pole;
  // Funkcje krawędzi (wagi barycentryczne) – przyrosty w x i y.
  const w0x = (B[1] - C[1]) * odw; const w0y = (C[0] - B[0]) * odw;
  const w1x = (C[1] - A[1]) * odw; const w1y = (A[0] - C[0]) * odw;
  const w0s = ((B[0] - (x0 + 0.5)) * (C[1] - (y0 + 0.5)) - (C[0] - (x0 + 0.5)) * (B[1] - (y0 + 0.5))) * odw;
  const w1s = ((C[0] - (x0 + 0.5)) * (A[1] - (y0 + 0.5)) - (A[0] - (x0 + 0.5)) * (C[1] - (y0 + 0.5))) * odw;
  const [iA, iB, iC] = [A[2], B[2], C[2]];
  const r0 = Math.min(255, kol[0] * mn[0]); const g0 = Math.min(255, kol[1] * mn[1]); const b0 = Math.min(255, kol[2] * mn[2]);
  let tw = 0; let th = 0; let td = null; let uA = 0; let uB = 0; let uC = 0; let vA = 0; let vB = 0; let vC = 0;
  if (poz) {
    tw = poz.w; th = poz.h; td = poz.d;
    uA = ta[0] * tw * iA; uB = tb[0] * tw * iB; uC = tc[0] * tw * iC;
    vA = ta[1] * th * iA; vB = tb[1] * th * iB; vC = tc[1] * th * iC;
  }
  const E = -1e-7;
  for (let y = y0; y <= y1; y += 1) {
    let w0 = w0s + (y - y0) * w0y;
    let w1 = w1s + (y - y0) * w1y;
    let i = y * bw + x0;
    for (let x = x0; x <= x1; x += 1, w0 += w0x, w1 += w1x, i += 1) {
      const w2 = 1 - w0 - w1;
      if (w0 < E || w1 < E || w2 < E) continue;
      const iw = w0 * iA + w1 * iB + w2 * iC;
      if (iw <= gl[i]) continue;
      gl[i] = iw;
      const o = i * 4;
      if (td) {
        let u = Math.floor((w0 * uA + w1 * uB + w2 * uC) / iw);
        let v = Math.floor((w0 * vA + w1 * vB + w2 * vC) / iw);
        u = u < 0 ? 0 : u >= tw ? tw - 1 : u;
        v = v < 0 ? 0 : v >= th ? th - 1 : v;
        const s = (v * tw + u) * 4;
        px[o] = td[s] * mn[0]; px[o + 1] = td[s + 1] * mn[1]; px[o + 2] = td[s + 2] * mn[2];
      } else { px[o] = r0; px[o + 1] = g0; px[o + 2] = b0; }
      px[o + 3] = 255;
    }
  }
}

export function utworzRenderer2D(plotno, { maksTekstury = 1024 } = {}) {
  let ctx = null;
  try { ctx = plotno.getContext('2d'); } catch { ctx = null; }
  if (!ctx) return null;
  const maks = Math.min(1024, maksTekstury);
  const tekstury = new Map(); // klucz → { obraz?: canvas, kolor: [r,g,b] }
  const uzycie = new Map();
  let licznik = 0;
  const wpisTekstury = (klucz) => {
    if (tekstury.has(klucz)) return tekstury.get(klucz);
    if (klucz.startsWith('kolor:')) { const t = { kolor: kolorRGB(klucz.slice(6)) }; tekstury.set(klucz, t); return t; }
    if (klucz === 'tex:krawedz') return { kolor: [236, 233, 226] };
    if (klucz === 'tex:skladki') return { kolor: [226, 222, 214] };
    if (klucz === 'tex:kapitalka') return { kolor: [168, 52, 48] };
    return { kolor: kolorRGB(PAPIER) };
  };
  const zPotrzebnych = (k) => /^(pol\|)?p:/.test(k);
  let bufor = null;

  return {
    gl: null,
    uproszczony: true,
    maTeksture: (klucz) => klucz.startsWith('kolor:') || klucz.startsWith('tex:') || tekstury.has(klucz),
    ustawMaske() { /* uszlachetnienia (połysk folii, lakier) – tylko w pełnej makiecie 3D */ },
    ileStron: () => [...tekstury.keys()].filter(zPotrzebnych).length,
    przytnijStrony(potrzebne, max) {
      const strony = [...tekstury.keys()].filter(zPotrzebnych);
      if (strony.length <= max) return [];
      const usuniete = [];
      const kolejka = strony.filter((k) => !potrzebne.has(k)).sort((a, b) => (uzycie.get(a) || 0) - (uzycie.get(b) || 0));
      for (const k of kolejka) {
        if (strony.length - usuniete.length <= max) break;
        tekstury.delete(k); uzycie.delete(k); usuniete.push(k);
      }
      return usuniete;
    },
    zapomnijStrony(wszystkie = false) {
      const re = wszystkie ? /^(pol\|)?(p|okl|obw):/ : /^(pol\|)?p:/;
      for (const k of [...tekstury.keys()]) if (re.test(k)) tekstury.delete(k);
    },
    ustawTeksture(klucz, obraz) {
      if (typeof obraz === 'string') { tekstury.set(klucz, { kolor: kolorRGB(obraz) }); return; }
      // Poziomy szczegółów: obraz strony ≤ maks px na bok i kolejne o połowę mniejsze (do 32 px).
      const poziomy = [];
      let k = Math.min(1, maks / Math.max(obraz.width || 1, obraz.height || 1));
      let zrodlo = obraz;
      for (;;) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(obraz.width * k));
        c.height = Math.max(1, Math.round(obraz.height * k));
        const g = c.getContext('2d', { willReadFrequently: true });
        g.imageSmoothingQuality = 'high';
        g.drawImage(zrodlo, 0, 0, c.width, c.height);
        poziomy.push({ w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data });
        zrodlo = c;
        if (Math.max(c.width, c.height) <= 32) break;
        k /= 2;
      }
      tekstury.set(klucz, { poziomy, kolor: sredni(zrodlo) });
    },
    rysuj(quady, kamera, opcjeRys = {}) {
      const ciemny = Boolean(opcjeRys.ciemny);
      const op = normalizujOpcje(opcjeRys);
      const W = plotno.width;
      const H = plotno.height;
      const asp = W / Math.max(1, H);
      const ob = obwiednia(quady);
      const podloze = quady.podloze || { typ: 'stol', poziom: 0 };
      const sciana = podloze.typ === 'sciana';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Tło: jak w 3D – gradient studia, jednolity kolor albo kolor faktury; przezroczyste – nic.
      if (op.tlo !== 'przezroczyste') {
        let gora; let dol;
        if (op.tlo === 'kolor') { const k = kolorRGB(op.kolorTla); gora = k; dol = k.map((v) => v * 0.9); }
        else if (KOLORY_FAKTUR[op.tlo]) { const k = kolorRGB(op.kolorTla !== DOMYSLNE_OPCJE.kolorTla ? op.kolorTla : KOLORY_FAKTUR[op.tlo]); gora = k.map((v) => v * 0.86); dol = k.map((v) => v * 0.66); }
        else [gora, dol] = (ciemny ? ['#3d4045', '#1c1d20'] : ['#faf9f6', '#d5d1c9']).map(kolorRGB);
        const gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, rgb(gora));
        gr.addColorStop(1, rgb(dol));
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);
      }

      // Kamera – to samo przekształcenie co w 3D: widok = Tz(−d) · Rx(a) · Ry(b) · T(−c), rzut perspektywiczny.
      const c = kamera.srodek || ob.srodek;
      const fov = ((Number.isFinite(kamera.fov) ? kamera.fov : 28) * Math.PI) / 180;
      const t = 1 / Math.tan(fov / 2);
      const [cb, sb, ca, sa] = [Math.cos(kamera.obrotY), Math.sin(kamera.obrotY), Math.cos(kamera.obrotX), Math.sin(kamera.obrotX)];
      const d = kamera.odleglosc;
      const blisko = Math.max(1, d / 40);
      const wid = (p) => {
        const x = p[0] - c[0]; const y = p[1] - c[1]; const z = p[2] - c[2];
        const x1 = cb * x + sb * z; const z1 = -sb * x + cb * z;
        const y2 = ca * y - sa * z1; const z2 = sa * y + ca * z1;
        return [x1, y2, z2 - d];
      };
      const naEkran = (v) => [((t / asp) * v[0] / -v[2] + 1) * 0.5 * W, (1 - (t * v[1]) / -v[2]) * 0.5 * H];
      const z0 = d * ca;
      const oko = [c[0] - z0 * sb, c[1] + d * sa, c[2] + z0 * cb];

      // Światło (jak w 3D): z lewej / prawej / z góry / z okna, obraca się z kamerą wokół osi pionowej.
      const az = -kamera.obrotY;
      const obrocY = ([x, y, z]) => [x * Math.cos(az) + z * Math.sin(az), y, -x * Math.sin(az) + z * Math.cos(az)];
      const KIER = {
        lewo: sciana ? [-0.62, 0.62, 0.8] : [-0.74, 0.8, 0.6],
        prawo: sciana ? [0.62, 0.62, 0.8] : [0.74, 0.8, 0.6],
        gora: sciana ? [-0.08, 0.95, 0.55] : [-0.12, 1, 0.22],
        okno: sciana ? [-0.95, 0.3, 0.45] : [-0.95, 0.42, -0.15],
      };
      const L0 = KIER[op.swiatlo] || KIER.lewo;
      const L = norm(obrocY(L0));
      const F = norm(obrocY(sciana ? [-L0[0] * 0.9, 0.2, 0.9] : [-L0[0] || 0.75, 0.45, 0.6]));
      const barwa = { neutralna: [1.0, 0.982, 0.955], ciepla: [1.0, 0.9, 0.76], zimna: [0.88, 0.94, 1.0] }[op.barwa] || [1, 1, 1];

      // Miękki cień pod obiektem: obrys obwiedni na podłożu, przesunięty od światła, rozmyty.
      if (op.silaCienia > 0) {
        const [mn, mx] = [ob.min, ob.max];
        const wys = sciana ? mx[2] - podloze.poziom : mx[1] - podloze.poziom;
        const przes = sciana ? [-L[0] * wys * 0.6, -L[1] * wys * 0.6] : [-L[0] * wys * 0.5, -L[2] * wys * 0.5];
        const rogi = sciana
          ? [[mn[0], mn[1]], [mx[0], mn[1]], [mx[0], mx[1]], [mn[0], mx[1]]].map(([x, y]) => [x + przes[0], y + przes[1], podloze.poziom])
          : [[mn[0], mn[2]], [mx[0], mn[2]], [mx[0], mx[2]], [mn[0], mx[2]]].map(([x, z]) => [x + przes[0], podloze.poziom, z + przes[1]]);
        const v = rogi.map(wid);
        if (v.every((p) => p[2] < -blisko)) {
          const e = v.map(naEkran);
          const rozmiar = Math.hypot(e[2][0] - e[0][0], e[2][1] - e[0][1]);
          ctx.save();
          ctx.translate(-W * 4, 0); // sam cień (obrys poza płótnem, cień przesunięty z powrotem)
          ctx.shadowColor = `rgba(0,0,0,${Math.min(0.45, 0.26 * op.silaCienia * (ciemny ? 1.3 : 1))})`;
          ctx.shadowBlur = Math.max(6, rozmiar * 0.06 * (0.4 + op.miekkosc));
          ctx.shadowOffsetX = W * 4;
          ctx.beginPath();
          e.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = '#000';
          ctx.fill();
          ctx.restore();
        }
      }

      // Trójkąty sceny rysowane programowo z buforem głębokości (jak karta graficzna, tylko na procesorze): kartki
      // leżące 0,1 mm nad sobą zasłaniają się poprawnie (kolejność „od najdalszego” myliła cienkie stosy).
      // Bufor w mniejszej rozdzielczości przy dużym płótnie – rysowanie ma zdążyć przy obracaniu.
      const skala = Math.min(1, Math.sqrt(MAKS_PIKSELI / Math.max(1, W * H)));
      const bw = Math.max(1, Math.round(W * skala));
      const bh = Math.max(1, Math.round(H * skala));
      if (!bufor || bufor.w !== bw || bufor.h !== bh) {
        const plotnoB = document.createElement('canvas');
        plotnoB.width = bw; plotnoB.height = bh;
        const gB = plotnoB.getContext('2d');
        bufor = { w: bw, h: bh, plotno: plotnoB, g: gB, obraz: gB.createImageData(bw, bh), glebia: new Float32Array(bw * bh) };
      }
      const px = bufor.obraz.data;
      px.fill(0);
      const gl = bufor.glebia;
      gl.fill(0);
      const naBufor = (v) => [((t / asp) * v[0] / -v[2] + 1) * 0.5 * bw, (1 - (t * v[1]) / -v[2]) * 0.5 * bh, 1 / -v[2]];
      const kremowy = op.papier === 'kremowy';
      for (const q of quady) {
        const v = q.p.map(wid);
        if (v.some((x) => x[2] > -blisko)) continue;
        const tex = wpisTekstury(q.tex);
        if (/^(p|okl|obw):/.test(q.tex)) uzycie.set(q.tex, ++licznik);
        const zObrazem = Boolean(tex.poziomy) && q.uv.every(([u, w]) => u > -0.01 && u < 1.01 && w > -0.01 && w < 1.01);
        let n = q.nv ? norm(q.nv.reduce((a, x) => [a[0] + x[0], a[1] + x[1], a[2] + x[2]], [0, 0, 0])) : norm(q.n || [0, 1, 0]);
        const sr = q.p.reduce((a, x) => [a[0] + x[0] / 4, a[1] + x[1] / 4, a[2] + x[2] / 4], [0, 0, 0]);
        const V = norm([oko[0] - sr[0], oko[1] - sr[1], oko[2] - sr[2]]);
        if (n[0] * V[0] + n[1] * V[1] + n[2] * V[2] < 0) n = [-n[0], -n[1], -n[2]];
        const ndl = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        const ndf = Math.max(0, n[0] * F[0] + n[1] * F[1] + n[2] * F[2]);
        const hemi = 0.3 + 0.2 * (n[1] * 0.5 + 0.5);
        const ao = q.ao ? q.ao.reduce((a, x) => a + x, 0) / 4 : 1;
        const k = Math.min(1.2, (0.62 * ndl + 0.14 * ndf + hemi * ao) * 1.08);
        const krem = kremowy && (q.mat === 'papier' || q.mat === 'krawedz');
        const mn = [k * barwa[0], k * barwa[1] * (krem ? 0.955 : 1), k * barwa[2] * (krem ? 0.86 : 1)];
        const e = v.map(naBufor);
        // Poziom szczegółów obrazu strony (zamiast mipmap): tyle pikseli obrazu, ile kartka zajmuje na ekranie.
        let poz = null;
        if (zObrazem) {
          const bok = Math.max(Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]), Math.hypot(e[3][0] - e[0][0], e[3][1] - e[0][1]));
          const duv = Math.max(Math.hypot(q.uv[1][0] - q.uv[0][0], q.uv[1][1] - q.uv[0][1]), Math.hypot(q.uv[3][0] - q.uv[0][0], q.uv[3][1] - q.uv[0][1])) || 1;
          const potrzeba = (bok / duv) * 1.4;
          poz = tex.poziomy.find((x) => Math.max(x.w, x.h) <= potrzeba) || tex.poziomy.at(-1);
          if (Math.max(poz.w, poz.h) < potrzeba && tex.poziomy.indexOf(poz) > 0) poz = tex.poziomy[tex.poziomy.indexOf(poz) - 1];
        }
        const kol = tex.kolor;
        for (const [a, b, c2] of [[0, 1, 2], [0, 2, 3]]) trojkat(px, gl, bw, bh, e[a], e[b], e[c2], q.uv[a], q.uv[b], q.uv[c2], poz, kol, mn);
      }
      bufor.g.putImageData(bufor.obraz, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bufor.plotno, 0, 0, W, H);
    },
    zwolnij() { tekstury.clear(); uzycie.clear(); },
  };
}
