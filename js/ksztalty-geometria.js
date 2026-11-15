// Geometria kształtów Biblioteki (#131A, #155): ścieżki SVG w polu 100 × 100. Wspólne dla
// js/ksztalty-biblioteka.js i js/ksztalty-wiecej.js. Kształty z otworem (ramki, pierścienie) wypełnia się
// regułą evenodd – kierunek obiegu podścieżek nie ma wtedy znaczenia.

export const r1 = (x) => Math.round(x * 100) / 100;
export const punkty = (lista) => `M ${lista.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L ')} Z`;

// Okrąg z dwóch łuków (kierunek: 1 – zgodnie, 0 – przeciwnie do ruchu wskazówek).
export const okrag = (cx, cy, r, kier = 1) => `M ${r1(cx - r)} ${r1(cy)} A ${r1(r)} ${r1(r)} 0 1 ${kier} ${r1(cx + r)} ${r1(cy)} A ${r1(r)} ${r1(r)} 0 1 ${kier} ${r1(cx - r)} ${r1(cy)} Z`;
export const elipsa = (cx, cy, rx, ry) => `M ${r1(cx - rx)} ${r1(cy)} A ${r1(rx)} ${r1(ry)} 0 1 1 ${r1(cx + rx)} ${r1(cy)} A ${r1(rx)} ${r1(ry)} 0 1 1 ${r1(cx - rx)} ${r1(cy)} Z`;
export const prost = (x, y, w, h) => `M ${r1(x)} ${r1(y)} L ${r1(x + w)} ${r1(y)} L ${r1(x + w)} ${r1(y + h)} L ${r1(x)} ${r1(y + h)} Z`;

// Prostokąt z zaokrąglonymi rogami; kier 0 – w przeciwną stronę (otwór w ramce).
export function zaokr(x, y, w, h, r, kier = 1) {
  const a = (dx, dy) => `A ${r1(r)} ${r1(r)} 0 0 ${kier} ${r1(dx)} ${r1(dy)}`;
  if (kier) return `M ${r1(x + r)} ${r1(y)} L ${r1(x + w - r)} ${r1(y)} ${a(x + w, y + r)} L ${r1(x + w)} ${r1(y + h - r)} ${a(x + w - r, y + h)} L ${r1(x + r)} ${r1(y + h)} ${a(x, y + h - r)} L ${r1(x)} ${r1(y + r)} ${a(x + r, y)} Z`;
  return `M ${r1(x + r)} ${r1(y)} ${a(x, y + r)} L ${r1(x)} ${r1(y + h - r)} ${a(x + r, y + h)} L ${r1(x + w - r)} ${r1(y + h)} ${a(x + w, y + h - r)} L ${r1(x + w)} ${r1(y + r)} ${a(x + w - r, y)} Z`;
}

// Punkty na okręgu: n punktów, promień r, obrót (pierwszy punkt u góry).
export const naOkregu = (n, r, { cx = 50, cy = 50, obrot = -Math.PI / 2 } = {}) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(obrot + (i * 2 * Math.PI) / n), cy + r * Math.sin(obrot + (i * 2 * Math.PI) / n)]);

// Wielokąt foremny o n bokach.
export const wielokat = (n, obrot = -Math.PI / 2, r = 45) => punkty(naOkregu(n, r, { obrot }));

// Gwiazda albo wybuch: n ramion, promień wewnętrzny jako ułamek zewnętrznego.
export function gwiazda(n, wewn, obrot = -Math.PI / 2, r = 45) {
  const p = [];
  for (let i = 0; i < n * 2; i += 1) {
    const rr = i % 2 ? r * wewn : r;
    const a = obrot + (i * Math.PI) / n;
    p.push([50 + rr * Math.cos(a), 50 + rr * Math.sin(a)]);
  }
  return punkty(p);
}

// Wielokąt (lista punktów) z zaokrąglonymi wierzchołkami: łuk kwadratowy o długości ułamka boku.
export function zaokraglony(lista, u = 0.22) {
  const n = lista.length;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  let d = '';
  for (let i = 0; i < n; i += 1) {
    const p = lista[i];
    const poprz = lista[(i - 1 + n) % n];
    const nast = lista[(i + 1) % n];
    const a = lerp(p, poprz, u);
    const b = lerp(p, nast, u);
    d += `${i ? ' L' : 'M'} ${r1(a[0])} ${r1(a[1])} Q ${r1(p[0])} ${r1(p[1])} ${r1(b[0])} ${r1(b[1])}`;
  }
  return `${d} Z`;
}

// Falisty krąg (rozeta, „chmurka”): n półkolistych wypustek na okręgu o promieniu r.
export function falistyKrag(n, r = 40, { cx = 50, cy = 50 } = {}) {
  const p = naOkregu(n, r, { cx, cy });
  const bok = 2 * r * Math.sin(Math.PI / n);
  let d = `M ${r1(p[0][0])} ${r1(p[0][1])}`;
  for (let i = 1; i <= n; i += 1) { const q = p[i % n]; d += ` A ${r1(bok / 2)} ${r1(bok / 2)} 0 0 1 ${r1(q[0])} ${r1(q[1])}`; }
  return `${d} Z`;
}

// Prostokąt z falistym (wypukłe półkola) brzegiem: n półkoli na dłuższym boku.
export function falistyProst(x, y, w, h, n = 7) {
  const s = w / n;
  const m = Math.max(1, Math.round(h / s));
  const t = h / m;
  let d = `M ${r1(x)} ${r1(y)}`;
  for (let i = 0; i < n; i += 1) d += ` A ${r1(s / 2)} ${r1(s / 2)} 0 0 1 ${r1(x + (i + 1) * s)} ${r1(y)}`;
  for (let i = 0; i < m; i += 1) d += ` A ${r1(t / 2)} ${r1(t / 2)} 0 0 1 ${r1(x + w)} ${r1(y + (i + 1) * t)}`;
  for (let i = 0; i < n; i += 1) d += ` A ${r1(s / 2)} ${r1(s / 2)} 0 0 1 ${r1(x + w - (i + 1) * s)} ${r1(y + h)}`;
  for (let i = 0; i < m; i += 1) d += ` A ${r1(t / 2)} ${r1(t / 2)} 0 0 1 ${r1(x)} ${r1(y + h - (i + 1) * t)}`;
  return `${d} Z`;
}

// Prostokąt z wklęsłymi półkolami (brzeg znaczka pocztowego).
export function zabkowanyProst(x, y, w, h, n = 8) {
  const s = w / n;
  const m = Math.max(1, Math.round(h / s));
  const t = h / m;
  const rz = Math.min(s, t) / 4;
  let d = `M ${r1(x)} ${r1(y)}`;
  for (let i = 0; i < n; i += 1) { const c = x + (i + 0.5) * s; d += ` L ${r1(c - rz)} ${r1(y)} A ${r1(rz)} ${r1(rz)} 0 0 0 ${r1(c + rz)} ${r1(y)}`; }
  d += ` L ${r1(x + w)} ${r1(y)}`;
  for (let i = 0; i < m; i += 1) { const c = y + (i + 0.5) * t; d += ` L ${r1(x + w)} ${r1(c - rz)} A ${r1(rz)} ${r1(rz)} 0 0 0 ${r1(x + w)} ${r1(c + rz)}`; }
  d += ` L ${r1(x + w)} ${r1(y + h)}`;
  for (let i = 0; i < n; i += 1) { const c = x + w - (i + 0.5) * s; d += ` L ${r1(c + rz)} ${r1(y + h)} A ${r1(rz)} ${r1(rz)} 0 0 0 ${r1(c - rz)} ${r1(y + h)}`; }
  d += ` L ${r1(x)} ${r1(y + h)}`;
  for (let i = 0; i < m; i += 1) { const c = y + h - (i + 0.5) * t; d += ` L ${r1(x)} ${r1(c + rz)} A ${r1(rz)} ${r1(rz)} 0 0 0 ${r1(x)} ${r1(c - rz)}`; }
  return `${d} Z`;
}

// Serce w polu (cx, cy) o szerokości s (wysokość ok. 0,9 s).
export function serce(cx = 50, cy = 50, s = 90) {
  return przenies('M 50 90 C 20 70 5 52 5 33 C 5 18 17 8 30 8 C 40 8 47 14 50 22 C 53 14 60 8 70 8 C 83 8 95 18 95 33 C 95 52 80 70 50 90 Z', cx, cy + 1 * (s / 90), s / 90);
}

// ---------- Przekształcenia ścieżek ----------

// Rozbiór ścieżki na polecenia z liczbami (tylko bezwzględne M L C S Q T A Z – tak piszemy kształty).
function polecenia(d) {
  const wynik = [];
  const re = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
  let m;
  while ((m = re.exec(d))) wynik.push([m[1], (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number)]);
  return wynik;
}

// Przekształcenie afiniczne bez obrotu: x' = ax·x + bx, y' = ay·y + by (lustro: ujemne a).
export function przeksztalc(d, ax, bx, ay, by) {
  const lustro = (ax < 0) !== (ay < 0);
  const X = (x) => r1(ax * x + bx);
  const Y = (y) => r1(ay * y + by);
  return polecenia(d).map(([c, a]) => {
    const C = c.toUpperCase();
    if (C === 'Z') return 'Z';
    const out = [];
    if (C === 'A') {
      for (let i = 0; i + 6 < a.length + 1; i += 7) {
        const [rx, ry, rot, duzy, kier, x, y] = a.slice(i, i + 7);
        out.push(r1(rx * Math.abs(ax)), r1(ry * Math.abs(ay)), rot, duzy, lustro ? 1 - kier : kier, X(x), Y(y));
      }
    } else {
      for (let i = 0; i + 1 < a.length; i += 2) out.push(X(a[i]), Y(a[i + 1]));
    }
    return `${C} ${out.join(' ')}`;
  }).join(' ');
}

// Kształt przesunięty i pomniejszony (środek cx, cy; skala s względem pola 100 × 100).
export const przenies = (d, cx, cy, s, sy = s) => przeksztalc(d, s, cx - 50 * s, sy, cy - 50 * sy);
export const lustroX = (d) => przeksztalc(d, -1, 100, 1, 0);
export const lustroY = (d) => przeksztalc(d, 1, 0, -1, 100);

// Obrót o kąt (stopnie) wokół środka pola – łuki eliptyczne tylko z równymi promieniami (okręgi).
export function obroc(d, stopnie) {
  const a = (stopnie * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const P = (x, y) => [r1(50 + (x - 50) * cos - (y - 50) * sin), r1(50 + (x - 50) * sin + (y - 50) * cos)];
  return polecenia(d).map(([c, v]) => {
    const C = c.toUpperCase();
    if (C === 'Z') return 'Z';
    const out = [];
    if (C === 'A') {
      for (let i = 0; i + 6 < v.length + 1; i += 7) { const [rx, ry, rot, duzy, kier, x, y] = v.slice(i, i + 7); out.push(rx, ry, r1(rot + stopnie), duzy, kier, ...P(x, y)); }
    } else for (let i = 0; i + 1 < v.length; i += 2) out.push(...P(v[i], v[i + 1]));
    return `${C} ${out.join(' ')}`;
  }).join(' ');
}

// Ramka do ozdób nachodzących na nią (reguła nonzero): zewnętrzny prostokąt zgodnie z ruchem wskazówek,
// otwór przeciwnie – ozdoby (zgodnie) zostają pełne także tam, gdzie zachodzą na ramkę albo otwór.
export const ramkaProstNZ = (x, y, w, h, t) => `${prost(x, y, w, h)} M ${r1(x + t)} ${r1(y + t)} L ${r1(x + t)} ${r1(y + h - t)} L ${r1(x + w - t)} ${r1(y + h - t)} L ${r1(x + w - t)} ${r1(y + t)} Z`;

// Ramka prostokątna o grubości t (z otworem – evenodd).
export const ramkaProst = (x, y, w, h, t) => `${prost(x, y, w, h)} ${prost(x + t, y + t, w - 2 * t, h - 2 * t)}`;
export const ramkaZaokr = (x, y, w, h, t, r) => `${zaokr(x, y, w, h, r)} ${zaokr(x + t, y + t, w - 2 * t, h - 2 * t, Math.max(0.5, r - t))}`;
