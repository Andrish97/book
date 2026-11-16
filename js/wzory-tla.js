// Tła i wzory Biblioteki (#162). Wzory powtarzalne (paski, kropki, kratka, jodełka, fale, romby, gwiazdki,
// kwiatki, plaster miodu…) to jedna ścieżka wektorowa przycięta do strony ze spadem, na tle w jednym kolorze –
// w PDF zostają wektorowe (wzór Fabric – „Pattern” – byłby obrazem). Tekstury papieru liczy się z ziarna
// (zawsze ta sama), przejścia kolorów to prostokąt z przejściem, plamy i akwarela – miękkie, nieregularne kształty.
// Tła wstawiają się na całą stronę ze spadem, pod treść; plamy – jak zwykły element na środek strony.

import { R, P, f, okrag } from './biblioteka-sklad.js';

// Kolor rozjaśniony w stronę bieli (t = 0 – kolor, 1 – biel).
export function rozjasnij(hex, t) {
  const v = parseInt(String(hex).replace('#', ''), 16);
  const k = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.round(x + (255 - x) * t));
  return `#${k.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
// Liczby pseudolosowe z ziarna (mulberry32) – ten sam wzór przy każdym wstawieniu i w podglądzie.
function losowe(ziarno) {
  let a = ziarno >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Przycięcie wielokąta wypukłego do prostokąta 0..W × 0..H (Sutherland–Hodgman).
function przytnij(pkt, W, H) {
  const krawedzie = [[(p) => p[0] >= 0, (a, b) => [0, a[1] + (b[1] - a[1]) * (0 - a[0]) / (b[0] - a[0])]],
    [(p) => p[0] <= W, (a, b) => [W, a[1] + (b[1] - a[1]) * (W - a[0]) / (b[0] - a[0])]],
    [(p) => p[1] >= 0, (a, b) => [a[0] + (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1]), 0]],
    [(p) => p[1] <= H, (a, b) => [a[0] + (b[0] - a[0]) * (H - a[1]) / (b[1] - a[1]), H]]];
  let wynik = pkt;
  for (const [wew, przec] of krawedzie) {
    const wej = wynik;
    wynik = [];
    for (let i = 0; i < wej.length; i += 1) {
      const a = wej[(i + wej.length - 1) % wej.length]; const b = wej[i];
      if (wew(b)) { if (!wew(a)) wynik.push(przec(a, b)); wynik.push(b); } else if (wew(a)) wynik.push(przec(a, b));
    }
    if (!wynik.length) return [];
  }
  return wynik;
}
const wielokat = (pkt) => (pkt.length >= 3 ? `M ${pkt.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L ')} Z` : '');
const wielokaty = (lista, W, H) => lista.map((p) => wielokat(przytnij(p, W, H))).filter(Boolean).join(' ');
// Odcinek przycięty do prostokąta (Liang–Barsky) jako fragment ścieżki.
function odcinek(x1, y1, x2, y2, W, H) {
  let t0 = 0; let t1 = 1; const dx = x2 - x1; const dy = y2 - y1;
  for (const [p, q] of [[-dx, x1], [dx, W - x1], [-dy, y1], [dy, H - y1]]) {
    if (p === 0) { if (q < 0) return ''; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return ''; if (t > t0) t0 = t; } else { if (t < t0) return ''; if (t < t1) t1 = t; }
  }
  return `M ${f(x1 + t0 * dx)} ${f(y1 + t0 * dy)} L ${f(x1 + t1 * dx)} ${f(y1 + t1 * dy)}`;
}
// Linia z punktów (fale, zygzak) – punkty przycięte do szerokości, wysokość leży w środku strony.
const linia = (pkt) => `M ${pkt.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L ')}`;
const gwiazdka = (cx, cy, r, n = 5, w = 0.45) => wielokat(Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * w : r; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; }));

// Wzory: (W, H) → { d, wypelnienie: true | false (linia), grubosc? }
const WZORY = [
  ['paski-poziome', 'Paski poziome', 'paski linie poziome', (W, H) => ({ d: wielokaty(Array.from({ length: Math.ceil(H / 8) + 1 }, (_, i) => [[0, i * 8], [W, i * 8], [W, i * 8 + 4], [0, i * 8 + 4]]), W, H) })],
  ['paski-pionowe', 'Paski pionowe', 'paski linie pionowe', (W, H) => ({ d: wielokaty(Array.from({ length: Math.ceil(W / 8) + 1 }, (_, i) => [[i * 8, 0], [i * 8 + 4, 0], [i * 8 + 4, H], [i * 8, H]]), W, H) })],
  ['paski-skosne', 'Paski ukośne', 'paski skos ukosne', (W, H) => ({ d: wielokaty(Array.from({ length: Math.ceil((W + H) / 8) + 1 }, (_, i) => { const x = i * 8 - H; return [[x, H], [x + 4, H], [x + 4 + H, 0], [x + H, 0]]; }), W, H) })],
  ['kropki', 'Kropki', 'kropki groszki punkty', (W, H) => { let d = ''; for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) d += `${okrag(x, y, 1.2)} `; return { d }; }],
  ['groszki', 'Groszki', 'groszki kropki przesuniete', (W, H) => { let d = ''; let rz = 0; for (let y = 5; y < H; y += 7, rz += 1) for (let x = rz % 2 ? 9 : 3.5; x < W; x += 11) d += `${okrag(x, y, 1.8)} `; return { d }; }],
  ['kratka', 'Kratka', 'kratka siatka kwadraty', (W, H) => { let d = ''; for (let x = 0; x <= W; x += 6) d += `${odcinek(x, 0, x, H, W, H)} `; for (let y = 0; y <= H; y += 6) d += `${odcinek(0, y, W, y, W, H)} `; return { d, linia: 0.25 }; }],
  ['krata', 'Krata', 'krata szkocka obrus vichy', (W, H) => ({ d: `${wielokaty(Array.from({ length: Math.ceil(W / 10) + 1 }, (_, i) => [[i * 10, 0], [i * 10 + 5, 0], [i * 10 + 5, H], [i * 10, H]]), W, H)} ${wielokaty(Array.from({ length: Math.ceil(H / 10) + 1 }, (_, i) => [[0, i * 10], [W, i * 10], [W, i * 10 + 5], [0, i * 10 + 5]]), W, H)}`, krycie: 0.55 })],
  ['jodelka', 'Jodełka', 'jodelka parkiet zygzak', (W, H) => {
    const lista = [];
    for (let x = 0, k = 0; x < W + 10; x += 10, k += 1) for (let y = -10; y < H + 10; y += 6) lista.push(k % 2 ? [[x, y], [x + 10, y + 5], [x + 10, y + 8], [x, y + 3]] : [[x, y + 5], [x + 10, y], [x + 10, y + 3], [x, y + 8]]);
    return { d: wielokaty(lista, W, H) };
  }],
  ['fale', 'Fale', 'fale falki woda', (W, H) => { let d = ''; for (let y = 4; y < H; y += 7) { const p = []; for (let x = 0; x <= W; x += 1) p.push([x, y + Math.sin((x / 12) * Math.PI * 2) * 1.6]); d += `${linia(p)} `; } return { d, linia: 0.5 }; }],
  ['zygzak', 'Zygzak', 'zygzak chevron', (W, H) => { let d = ''; for (let y = 4; y < H; y += 8) { const p = []; for (let x = 0, i = 0; x <= W; x += 4, i += 1) p.push([x, y + (i % 2 ? 2.5 : -2.5)]); d += `${linia(p)} `; } return { d, linia: 0.6 }; }],
  ['romby', 'Romby', 'romby karo arlekin', (W, H) => { const lista = []; for (let y = 0, k = 0; y < H + 12; y += 6, k += 1) for (let x = k % 2 ? 0 : 6; x < W + 12; x += 12) lista.push([[x, y - 6], [x + 6, y], [x, y + 6], [x - 6, y]]); return { d: wielokaty(lista.filter((_, i) => i % 2 === 0), W, H) }; }],
  ['gwiazdki', 'Gwiazdki', 'gwiazdki niebo noc', (W, H) => { let d = ''; let k = 0; for (let y = 6; y < H - 2; y += 12, k += 1) for (let x = k % 2 ? 12 : 6; x < W - 2; x += 12) d += `${gwiazdka(x, y, 2.4)} `; return { d }; }],
  ['kwiatki', 'Kwiatki', 'kwiatki laczka wiosna', (W, H) => {
    let d = ''; let k = 0;
    for (let y = 8; y < H - 3; y += 14, k += 1) {
      for (let x = k % 2 ? 15 : 7; x < W - 3; x += 16) {
        for (let i = 0; i < 5; i += 1) { const a = (i / 5) * Math.PI * 2; d += `${okrag(x + Math.cos(a) * 1.9, y + Math.sin(a) * 1.9, 1.3)} `; }
      }
    }
    return { d };
  }],
  ['plaster-miodu', 'Plaster miodu', 'heksagony szesciokaty plaster', (W, H) => {
    const r = 5; const hw = Math.sqrt(3) * r; let d = '';
    for (let y = 0, k = 0; y < H + r; y += 1.5 * r, k += 1) for (let x = k % 2 ? hw / 2 : 0; x < W + hw; x += hw) {
      const pkt = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; return [x + r * Math.cos(a), y + r * Math.sin(a)]; });
      for (let i = 0; i < 6; i += 1) d += `${odcinek(...pkt[i], ...pkt[(i + 1) % 6], W, H)} `;
    }
    return { d, linia: 0.3 };
  }],
  ['luski', 'Łuski', 'luski fale polkola japonskie', (W, H) => { let d = ''; for (let y = 4, k = 0; y < H + 4; y += 4, k += 1) for (let x = k % 2 ? 4 : 0; x < W + 8; x += 8) if (x - 4 >= 0 && x + 4 <= W && y <= H) d += `M ${f(x - 4)} ${f(y)} A 4 4 0 0 1 ${f(x + 4)} ${f(y)} `; return { d, linia: 0.35 }; }],
  ['trojkaty', 'Trójkąty', 'trojkaty geometryczny', (W, H) => { const lista = []; for (let y = 0, k = 0; y < H; y += 9, k += 1) for (let x = k % 2 ? 5 : 0; x < W; x += 10) lista.push([[x + 5, y + 2], [x + 9, y + 8], [x + 1, y + 8]]); return { d: wielokaty(lista, W, H) }; }],
  ['krzyzyki', 'Krzyżyki', 'plusy krzyzyki punkty', (W, H) => { let d = ''; for (let y = 5, k = 0; y < H; y += 10, k += 1) for (let x = k % 2 ? 10 : 5; x < W; x += 10) d += `${odcinek(x - 1.5, y, x + 1.5, y, W, H)} ${odcinek(x, y - 1.5, x, y + 1.5, W, H)} `; return { d, linia: 0.45 }; }],
  ['kola', 'Koła', 'okregi kolka bable', (W, H) => { let d = ''; for (let y = 7, k = 0; y < H - 4; y += 12, k += 1) for (let x = k % 2 ? 13 : 7; x < W - 4; x += 12) d += `${okrag(x, y, 4)} `; return { d, linia: 0.35 }; }],
];

// Tekstury papieru: tło w kolorze papieru i drobne włókna / plamki (jedna ścieżka).
const TEKSTURY = [
  ['len', 'Płótno lniane', 'len tkanina plotno tekstura', '#f3efe6', '#b9ae98', (W, H) => { let d = ''; for (let x = 0; x <= W; x += 0.9) d += `${odcinek(x, 0, x, H, W, H)} `; for (let y = 0; y <= H; y += 0.9) d += `${odcinek(0, y, W, y, W, H)} `; return { d, linia: 0.08, krycie: 0.35 }; }],
  ['karton', 'Karton', 'karton tektura tekstura', '#e9e2d3', '#9c9079', (W, H) => { const los = losowe(7); let d = ''; for (let i = 0; i < (W * H) / 18; i += 1) { const x = los() * W; const y = los() * H; d += `${okrag(x, y, 0.08 + los() * 0.14)} `; } return { d, krycie: 0.5 }; }],
  ['kraft', 'Papier pakowy', 'kraft szary papier pakowy', '#c9a77c', '#8e6c45', (W, H) => { const los = losowe(11); let d = ''; for (let i = 0; i < (W * H) / 30; i += 1) { const x = los() * W; const y = los() * H; const a = los() * Math.PI; const dl = 0.6 + los() * 1.6; d += `${odcinek(x, y, x + Math.cos(a) * dl, y + Math.sin(a) * dl, W, H)} `; } return { d, linia: 0.1, krycie: 0.45 }; }],
  ['czerpany', 'Papier czerpany', 'czerpany wlokna recznie robiony', '#f6f1e4', '#c8bb9c', (W, H) => { const los = losowe(23); let d = ''; for (let i = 0; i < (W * H) / 45; i += 1) { const x = los() * (W - 4) + 2; const y = los() * (H - 4) + 2; const a = los() * Math.PI * 2; const dl = 1 + los() * 2.5; d += `M ${f(x)} ${f(y)} Q ${f(x + Math.cos(a + 0.8) * dl)} ${f(y + Math.sin(a + 0.8) * dl)} ${f(x + Math.cos(a) * dl * 1.6)} ${f(y + Math.sin(a) * dl * 1.6)} `; } return { d, linia: 0.12, krycie: 0.6 }; }],
  ['zeszytowy', 'Papier w linie z marginesem', 'zeszyt linie margines szkola', '#fdfcf8', '#9fb8d6', (W, H) => { let d = ''; for (let y = 14; y < H - 6; y += 8) d += `${odcinek(0, y, W, y, W, H)} `; return { d, linia: 0.2, dodatek: { d: `M 22 0 L 22 ${f(H)}`, kolor: '#e08a8a', linia: 0.3 } }; }],
  ['milimetrowy', 'Papier milimetrowy', 'milimetrowy siatka techniczny', '#fbfaf5', '#e3a37a', (W, H) => { let d = ''; for (let x = 0; x <= W; x += 2) d += `${odcinek(x, 0, x, H, W, H)} `; for (let y = 0; y <= H; y += 2) d += `${odcinek(0, y, W, y, W, H)} `; return { d, linia: 0.06, krycie: 0.8, dodatek: { d: (() => { let g = ''; for (let x = 0; x <= W; x += 10) g += `${odcinek(x, 0, x, H, W, H)} `; for (let y = 0; y <= H; y += 10) g += `${odcinek(0, y, W, y, W, H)} `; return g; })(), kolor: '#e3a37a', linia: 0.18 } }; }],
];

// Przejścia kolorów na całą stronę.
const PRZEJSCIA = [
  ['przejscie-pion', 'Przejście z góry na dół', 'gradient przejscie pionowe', (c, W, H) => ({ type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: H }, colorStops: [{ offset: 0, color: rozjasnij(c.akcent, 0.55) }, { offset: 1, color: '#ffffff' }] })],
  ['przejscie-poziom', 'Przejście z boku', 'gradient przejscie poziome', (c, W) => ({ type: 'linear', coords: { x1: 0, y1: 0, x2: W, y2: 0 }, colorStops: [{ offset: 0, color: rozjasnij(c.akcent, 0.6) }, { offset: 1, color: rozjasnij(c.akcent2, 0.75) }] })],
  ['przejscie-ukos', 'Przejście ukośne', 'gradient przejscie ukos', (c, W, H) => ({ type: 'linear', coords: { x1: 0, y1: 0, x2: W, y2: H }, colorStops: [{ offset: 0, color: rozjasnij(c.akcent2, 0.6) }, { offset: 0.5, color: '#ffffff' }, { offset: 1, color: rozjasnij(c.akcent, 0.6) }] })],
  ['przejscie-kolo', 'Poświata ze środka', 'gradient kolowy poswiata srodek', (c, W, H) => ({ type: 'radial', coords: { x1: W / 2, y1: H / 2, r1: 0, x2: W / 2, y2: H / 2, r2: Math.max(W, H) * 0.7 }, colorStops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: rozjasnij(c.akcent, 0.5) }] })],
  ['przejscie-zachod', 'Zachód słońca', 'gradient pomaranczowy rozowy cieply', (c, W, H) => ({ type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: H }, colorStops: [{ offset: 0, color: '#f9d9a8' }, { offset: 0.55, color: '#f4b6a6' }, { offset: 1, color: '#c9a7d8' }] })],
  ['przejscie-morze', 'Morze', 'gradient niebieski turkus chlodny', (c, W, H) => ({ type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: H }, colorStops: [{ offset: 0, color: '#e6f4f7' }, { offset: 1, color: '#7fb8c9' }] })],
  ['przejscie-noc', 'Nocne niebo', 'gradient ciemny granat noc', (c, W, H) => ({ type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: H }, colorStops: [{ offset: 0, color: '#1b2547' }, { offset: 1, color: '#46407a' }] })],
];

// Plama: zamknięty, gładki kształt z losowych promieni (krzywe Catmulla-Roma przez punkty → Béziera).
function plama(cx, cy, R, ziarno, n = 9, rozrzut = 0.28) {
  const los = losowe(ziarno);
  const pkt = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; const rr = R * (1 - rozrzut + los() * rozrzut * 2); return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; });
  let d = `M ${f(pkt[0][0])} ${f(pkt[0][1])}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = pkt[(i - 1 + n) % n]; const p1 = pkt[i]; const p2 = pkt[(i + 1) % n]; const p3 = pkt[(i + 2) % n];
    d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}
const PLAMY = [
  ['plama-1', 'Plama okrągła', 'plama blob ksztalt organiczny', (c) => [P(plama(30, 30, 28, 3), { fill: rozjasnij(c.akcent, 0.6) })]],
  ['plama-2', 'Plama podłużna', 'plama blob organiczny', (c) => [P(plama(30, 30, 28, 17, 8, 0.35), { fill: rozjasnij(c.akcent2, 0.55) })]],
  ['plama-3', 'Plama falista', 'plama blob nieregularna', (c) => [P(plama(30, 30, 28, 41, 12, 0.22), { fill: rozjasnij(c.akcent, 0.7) })]],
  ['akwarela-1', 'Akwarela – trzy warstwy', 'akwarela plama farba', (c) => [0, 1, 2].map((i) => P(plama(30 + i * 3, 30 - i * 2, 26 - i * 4, 101 + i * 7, 11, 0.3), { fill: rozjasnij(c.akcent, 0.35 + i * 0.1), krycie: 0.28 }))],
  ['akwarela-2', 'Akwarela – dwa kolory', 'akwarela plama dwa kolory', (c) => [P(plama(26, 30, 24, 211, 11, 0.3), { fill: rozjasnij(c.akcent, 0.4), krycie: 0.3 }), P(plama(36, 32, 22, 223, 11, 0.32), { fill: rozjasnij(c.akcent2, 0.35), krycie: 0.3 }), P(plama(31, 30, 15, 229, 9, 0.3), { fill: rozjasnij(c.akcent, 0.2), krycie: 0.2 })]],
  ['akwarela-pas', 'Akwarela – pas pod tytuł', 'akwarela pasek tytul podklad', (c) => [0, 1, 2].map((i) => P(`M ${f(2 + i)} ${f(8 - i)} C 20 ${f(2 + i)} 40 ${f(10 - i)} 60 ${f(4 + i)} C 80 ${f(-1 + i)} 96 ${f(6 - i)} ${f(98 - i)} ${f(10 + i)} C 99 18 96 22 ${f(92 - i)} ${f(24 - i)} C 70 ${f(28 - i)} 50 ${f(20 + i)} 30 ${f(25 - i)} C 15 ${f(28 - i)} 3 24 ${f(2 + i)} ${f(18 + i)} Z`, { fill: rozjasnij(c.akcent, 0.4 + i * 0.12), krycie: 0.3 }))],
  ['plamki', 'Rozprysk kropli', 'kropki plamki rozprysk akwarela', (c) => { const los = losowe(57); return [P(Array.from({ length: 26 }, () => { const a = los() * Math.PI * 2; const d = Math.sqrt(los()) * 26; return okrag(30 + Math.cos(a) * d, 30 + Math.sin(a) * d, 0.6 + los() * 2.4); }).join(' '), { fill: rozjasnij(c.akcent, 0.3), krycie: 0.6 })]; }],
  ['ksiezyc-plama', 'Plama półksiężyc', 'polksiezyc plama ozdoba', (c) => [P(`${plama(30, 30, 26, 307, 10, 0.12)} ${plama(38, 24, 20, 311, 10, 0.12)}`, { fill: rozjasnij(c.akcent2, 0.45), evenodd: true })]],
];

const tloStrony = (c) => ({ W: c.w + 2 * c.spad, H: c.h + 2 * c.spad });

export const TLA = [
  ...WZORY.map(([id, nazwa, slowa, gen]) => ({
    id: `wzor-${id}`, nazwa: `Wzór: ${nazwa.toLowerCase()}`, slowa: `wzor tlo ${slowa}`, grupa: 'Wzory na całą stronę',
    buduj: (c) => {
      const { W, H } = tloStrony(c);
      const w = gen(W, H);
      const kolor = rozjasnij(c.akcent, 0.62);
      return {
        szer: W, wys: H, tlo: true,
        obiekty: [R(0, 0, W, H, { fill: '#ffffff', nazwa: 'Tło' }),
          P(w.d, w.linia ? { stroke: kolor, sw: w.linia, krycie: w.krycie, cap: 'butt', nazwa: 'Wzór' } : { fill: kolor, krycie: w.krycie, nazwa: 'Wzór' })],
      };
    },
  })),
  ...TEKSTURY.map(([id, nazwa, slowa, tlo, kolor, gen]) => ({
    id: `tekstura-${id}`, nazwa, slowa: `tekstura papier tlo ${slowa}`, grupa: 'Tekstury papieru',
    buduj: (c) => {
      const { W, H } = tloStrony(c);
      const w = gen(W, H);
      const obiekty = [R(0, 0, W, H, { fill: tlo, nazwa: 'Papier' }),
        P(w.d, w.linia ? { stroke: kolor, sw: w.linia, krycie: w.krycie, cap: 'butt', nazwa: 'Faktura' } : { fill: kolor, krycie: w.krycie, nazwa: 'Faktura' })];
      if (w.dodatek) obiekty.push(P(w.dodatek.d, { stroke: w.dodatek.kolor, sw: w.dodatek.linia, cap: 'butt', nazwa: 'Linie' }));
      return { szer: W, wys: H, tlo: true, obiekty };
    },
  })),
  ...PRZEJSCIA.map(([id, nazwa, slowa, gen]) => ({
    id, nazwa: `Tło: ${nazwa.toLowerCase()}`, slowa: `tlo ${slowa}`, grupa: 'Przejścia kolorów',
    buduj: (c) => { const { W, H } = tloStrony(c); return { szer: W, wys: H, tlo: true, obiekty: [R(0, 0, W, H, { fill: gen(c, W, H), nazwa: 'Tło' })] }; },
  })),
  ...PLAMY.map(([id, nazwa, slowa, gen]) => ({
    id, nazwa, slowa, grupa: 'Plamy i akwarela',
    buduj: (c) => {
      const obiekty = gen(c);
      const b = obiekty.reduce((a, o) => ({ x2: Math.max(a.x2, o._ob.x + o._ob.w), y2: Math.max(a.y2, o._ob.y + o._ob.h) }), { x2: 0, y2: 0 });
      return { szer: b.x2, wys: b.y2, obiekty };
    },
  })),
];
