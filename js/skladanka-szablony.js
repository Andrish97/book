// Szablony składanek z parametrami (#237): siatki brył i pudełek jako definicje części (js/skladanka.js) –
// z zakładkami, zgięciami i numerami par. Grubość materiału (t) wchodzi w wymiary tam, gdzie złożenie ją
// „zjada”: wieczko nakładane jest większe od pudełka o 2 × t + luz, przegródki mają szczeliny szerokości t + luz,
// a ich wysokość jest mniejsza o t (stoją na dnie). Moduł bez DOM.
//
// Pary w szablonie są lokalne ('a', 'b'…) – wstawiający zamienia je na wolne numery projektu (numeruj()).

const LUZ = 0.5; // mm – luz między wieczkiem a pudełkiem
const LUZ_SZCZELINY = 0.2;
const r2 = (v) => Math.round(v * 100) / 100;
const P = (x, y) => ({ x: r2(x), y: r2(y) });

// Krawędzie z listy: [['c'] | ['z', para] | ['k', para]] → definicja krawędzi (cięcie / zakładka / do sklejenia).
const kr = (lista, szer = 7) => lista.map(([t, para]) => (t === 'z' ? { typ: 'zakladka', para, szer } : t === 'k' ? { typ: 'klej', para } : { typ: 'ciecie' }));
const zg = (a, b, kat = 90) => ({ a: P(a[0], a[1]), b: P(b[0], b[1]), rodzaj: 'dolina', kat });

// Prostopadłościan L × W × H: pas czterech ścian, wieko i dno przy pierwszej ścianie.
function prostopadloscian({ dlugosc: L, szerokosc: W, wysokosc: H }) {
  const pkt = [[0, 0], [L, 0], [L, W], [L + W, W], [2 * L + W, W], [2 * L + 2 * W, W], [2 * L + 2 * W, W + H], [2 * L + W, W + H], [L + W, W + H], [L, W + H], [L, 2 * W + H], [0, 2 * W + H], [0, W + H], [0, W]];
  return [{
    nazwa: 'Prostopadłościan',
    punkty: pkt.map(([x, y]) => P(x, y)),
    krawedzie: kr([['k', 'a'], ['k', 'b'], ['z', 'b'], ['z', 'a'], ['z', 'c'], ['z', 'd'], ['z', 'e'], ['z', 'f'], ['z', 'g'], ['k', 'g'], ['k', 'f'], ['k', 'e'], ['k', 'd'], ['k', 'c']], Math.min(8, Math.max(4, Math.min(L, W, H) * 0.25))),
    zgiecia: [zg([L, W], [L, W + H]), zg([L + W, W], [L + W, W + H]), zg([2 * L + W, W], [2 * L + W, W + H]), zg([0, W], [L, W]), zg([0, W + H], [L, W + H])],
  }];
}

// Tacka (pudełko bez wieka) L × W, ścianki H: dno pośrodku, ścianki dookoła, zakładki na dłuższych ściankach.
function tacka({ dlugosc: L, szerokosc: W, wysokosc: H }, nazwa = 'Tacka', p = ['a', 'b', 'c', 'd']) {
  const pkt = [[H, 0], [H + L, 0], [H + L, H], [2 * H + L, H], [2 * H + L, H + W], [H + L, H + W], [H + L, 2 * H + W], [H, 2 * H + W], [H, H + W], [0, H + W], [0, H], [H, H]];
  return {
    nazwa,
    punkty: pkt.map(([x, y]) => P(x, y)),
    krawedzie: kr([['c'], ['z', p[0]], ['k', p[0]], ['c'], ['k', p[1]], ['z', p[1]], ['c'], ['z', p[2]], ['k', p[2]], ['c'], ['k', p[3]], ['z', p[3]]], Math.min(10, Math.max(4, H * 0.6))),
    zgiecia: [zg([H, H], [H + L, H]), zg([H + L, H], [H + L, H + W]), zg([H, H + W], [H + L, H + W]), zg([H, H], [H, H + W])],
  };
}

// Pudełko z wieczkiem nakładanym: dno (tacka) i wieczko większe o 2 × grubość + luz, niższe (wysokość wieczka).
function pudelkoZWieczkiem({ dlugosc: L, szerokosc: W, wysokosc: H, wieczko: Hw }, t) {
  const d = 2 * t + LUZ;
  return [tacka({ dlugosc: L, szerokosc: W, wysokosc: H }, 'Pudełko', ['a', 'b', 'c', 'd']), tacka({ dlugosc: L + d, szerokosc: W + d, wysokosc: Math.min(Hw, H) }, 'Wieczko', ['e', 'f', 'g', 'h'])];
}

// Regularny n-kąt o boku a, zbudowany na odcinku p0 → p1, po stronie `strona` (−1: y w górę od odcinka poziomego).
function wielokatNaBoku(p0, p1, n, strona) {
  const a = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const ap = a / (2 * Math.tan(Math.PI / n));
  const m = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const nx = -(p1.y - p0.y) / a * strona;
  const ny = (p1.x - p0.x) / a * strona;
  const c = { x: m.x + nx * ap, y: m.y + ny * ap };
  const k0 = Math.atan2(p0.y - c.y, p0.x - c.x);
  const R = a / (2 * Math.sin(Math.PI / n));
  const krok = (2 * Math.PI) / n;
  // Kierunek obrotu: tak, by drugi wierzchołek nie był p1 (idziemy dookoła od p0 do p1 przez drugą stronę).
  const wierz = (kier) => Array.from({ length: n }, (_, i) => ({ x: c.x + R * Math.cos(k0 + kier * i * krok), y: c.y + R * Math.sin(k0 + kier * i * krok) }));
  const w1 = wierz(1);
  const w = Math.hypot(w1[1].x - p1.x, w1[1].y - p1.y) < 0.01 ? wierz(-1) : w1;
  return w; // w[0] = p0, w[n-1] = p1
}

// Graniastosłup prawidłowy: n ścian a × h w pasie, podstawy (n-kąty) przy pierwszej ścianie.
function graniastoslup({ boki: n, bok: a, wysokosc: h }) {
  const pary = 'abcdefghijklmnopqrstuvwxyz';
  let i = 0;
  const nowa = () => pary[i++] || `p${i}`;
  const gora = wielokatNaBoku({ x: 0, y: 0 }, { x: a, y: 0 }, n, -1);
  const dol = wielokatNaBoku({ x: a, y: h }, { x: 0, y: h }, n, -1);
  const pkt = [];
  const kraw = [];
  const paryGory = Array.from({ length: n - 1 }, () => nowa());
  const paryDolu = Array.from({ length: n - 1 }, () => nowa());
  const koniec = nowa();
  // Górna podstawa: od (0,0) dookoła do (a,0) – krawędź przy (0,0) łączy się z ostatnią ścianą pasa.
  for (let k = 0; k < n - 1; k += 1) { pkt.push(gora[k]); kraw.push(['k', paryGory[n - 2 - k]]); }
  // Górna krawędź pasa: ściany 1…n-1 (zakładki).
  for (let s = 1; s < n; s += 1) { pkt.push({ x: s * a, y: 0 }); kraw.push(['z', paryGory[s - 1]]); }
  pkt.push({ x: n * a, y: 0 }); kraw.push(['z', koniec]);
  // Dolna krawędź pasa (od prawej): ściany n-1…1.
  for (let s = n; s > 1; s -= 1) { pkt.push({ x: s * a, y: h }); kraw.push(['z', paryDolu[s - 2]]); }
  // Dolna podstawa: od (a,h) dookoła do (0,h) – krawędź przy (a,h) łączy się ze ścianą 1.
  for (let k = 0; k < n - 1; k += 1) { pkt.push(dol[k]); kraw.push(['k', paryDolu[k]]); }
  pkt.push({ x: 0, y: h }); kraw.push(['k', koniec]);
  const zgiecia = [zg([0, 0], [a, 0]), zg([a, h], [0, h])];
  for (let s = 1; s < n; s += 1) zgiecia.push(zg([s * a, 0], [s * a, h], 180 - 360 / n));
  return [{ nazwa: `Graniastosłup ${n}-kątny`, punkty: pkt.map((q) => P(q.x, q.y)), krawedzie: kr(kraw, Math.min(7, Math.max(4, Math.min(a, h) * 0.3))), zgiecia }];
}

// Ostrosłup prawidłowy: podstawa n-kąt o boku a, wysokość h; trójkąty ścian dookoła podstawy.
function ostroslup({ boki: n, bok: a, wysokosc: h }) {
  const R = a / (2 * Math.sin(Math.PI / n));
  const ap = a / (2 * Math.tan(Math.PI / n));
  const s = Math.hypot(h, ap); // wysokość ściany bocznej
  const c = { x: R + s, y: R + s };
  const baza = Array.from({ length: n }, (_, i) => { const k = -Math.PI / 2 + Math.PI / n + (i * 2 * Math.PI) / n; return { x: c.x + R * Math.cos(k), y: c.y + R * Math.sin(k) }; });
  const pkt = [];
  const kraw = [];
  const zgiecia = [];
  const pary = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < n; i += 1) {
    const A = baza[i];
    const B = baza[(i + 1) % n];
    const m = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const d = Math.hypot(m.x - c.x, m.y - c.y) || 1;
    const T = { x: m.x + ((m.x - c.x) / d) * s, y: m.y + ((m.y - c.y) / d) * s };
    pkt.push(A, T);
    // A → T: lewy bok trójkąta i – do sklejenia z zakładką prawego boku trójkąta i-1; T → B: prawy bok – zakładka.
    kraw.push(['k', pary[(i - 1 + n) % n]], ['z', pary[i]]);
    zgiecia.push(zg([A.x, A.y], [B.x, B.y], 180 - Math.atan2(h, ap) * (180 / Math.PI)));
  }
  const minX = Math.min(...pkt.map((q) => q.x));
  const minY = Math.min(...pkt.map((q) => q.y));
  return [{ nazwa: `Ostrosłup ${n}-kątny`, punkty: pkt.map((q) => P(q.x - minX, q.y - minY)), krawedzie: kr(kraw, Math.min(7, Math.max(4, a * 0.25))), zgiecia: zgiecia.map((z) => ({ ...z, a: P(z.a.x - minX, z.a.y - minY), b: P(z.b.x - minX, z.b.y - minY) })) }];
}

// Przegródki wsuwane na krzyż do pudełka L × W × H: dwie płytki ze szczelinami do połowy (od góry i od dołu),
// szczeliny szerokości t + luz; płytki niższe o t (stoją na dnie) i krótsze o 2 × t (ścianki pudełka).
function przegrodki({ dlugosc: L, szerokosc: W, wysokosc: H }, t) {
  const h = H - t;
  const s = t + LUZ_SZCZELINY;
  const plytka = (dl, nazwa, odGory) => ({
    nazwa,
    punkty: [P(0, 0), P(dl, 0), P(dl, h), P(0, h)],
    krawedzie: kr([['c'], ['c'], ['c'], ['c']]),
    zgiecia: [],
    szczeliny: [{ a: P(dl / 2, odGory ? 0 : h / 2), b: P(dl / 2, odGory ? h / 2 : h), szer: r2(s), para: null }],
  });
  return [plytka(L - 2 * t, 'Przegródka wzdłuż', true), plytka(W - 2 * t, 'Przegródka w poprzek', false)];
}

export const SZABLONY_SKLADANEK = {
  prostopadloscian: { nazwa: 'Prostopadłościan (kostka)', opis: 'Jedna część: pas czterech ścian, wieko i dno, zakładki klejowe.', parametry: { dlugosc: 60, szerokosc: 40, wysokosc: 30 }, buduj: prostopadloscian },
  tacka: { nazwa: 'Tacka (pudełko bez wieka)', opis: 'Dno i cztery ścianki, zakładki na dłuższych ściankach.', parametry: { dlugosc: 100, szerokosc: 70, wysokosc: 30 }, buduj: (p) => [tacka(p)] },
  pudelko: { nazwa: 'Pudełko z wieczkiem nakładanym', opis: 'Dwie części: pudełko i wieczko większe o dwie grubości materiału i luz – nakłada się ciasno, ale bez wciskania.', parametry: { dlugosc: 100, szerokosc: 70, wysokosc: 40, wieczko: 15 }, buduj: pudelkoZWieczkiem },
  graniastoslup: { nazwa: 'Graniastosłup (np. sześciokątny)', opis: 'Pas ścian i dwie podstawy przy pierwszej ścianie.', parametry: { boki: 6, bok: 25, wysokosc: 60 }, buduj: graniastoslup },
  ostroslup: { nazwa: 'Ostrosłup (piramida)', opis: 'Podstawa i trójkąty ścian dookoła; zakładka na każdym trójkącie.', parametry: { boki: 4, bok: 60, wysokosc: 50 }, buduj: ostroslup },
  przegrodki: { nazwa: 'Przegródki wsuwane na krzyż', opis: 'Do pudełka o podanych wymiarach: dwie płytki ze szczelinami do połowy – wsuwasz jedną w drugą i wkładasz do środka.', parametry: { dlugosc: 100, szerokosc: 70, wysokosc: 40 }, buduj: przegrodki },
};

export const OPISY_PARAMETROW = { dlugosc: 'Długość (mm)', szerokosc: 'Szerokość (mm)', wysokosc: 'Wysokość (mm)', wieczko: 'Wysokość wieczka (mm)', boki: 'Liczba boków podstawy', bok: 'Bok podstawy (mm)' };

// Części szablonu: [{ nazwa, punkty, krawedzie, zgiecia, szczeliny? }] – pary lokalne.
export function czesciSzablonu(klucz, parametry = {}, grubosc = 0.3) {
  const s = SZABLONY_SKLADANEK[klucz];
  if (!s) return [];
  const p = { ...s.parametry };
  for (const [k, v] of Object.entries(parametry)) if (Number.isFinite(Number(v)) && Number(v) > 0) p[k] = Number(v);
  if (p.boki) p.boki = Math.max(3, Math.min(12, Math.round(p.boki)));
  return s.buduj(p, grubosc);
}

// Pary lokalne → kolejne wolne numery (wolny(): następny wolny numer).
export function numeruj(czesci, wolny) {
  const mapa = new Map();
  const nr = (p) => { if (!p) return null; if (!mapa.has(p)) mapa.set(p, wolny()); return mapa.get(p); };
  return czesci.map((c) => ({ ...c, krawedzie: c.krawedzie.map((k) => ({ ...k, para: nr(k.para) })), szczeliny: (c.szczeliny || []).map((z) => ({ ...z, para: nr(z.para) })) }));
}
