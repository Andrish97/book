// Szablony składanek z parametrami (#237): siatki brył i pudełek jako definicje części (js/skladanka.js) –
// z zakładkami, zgięciami i numerami par. Grubość materiału (t) wchodzi w wymiary tam, gdzie złożenie ją
// „zjada”: wieczko nakładane jest większe od pudełka o 2 × t + luz, przegródki mają szczeliny szerokości t + luz,
// a ich wysokość jest mniejsza o t (stoją na dnie). Moduł bez DOM.
//
// Pary w szablonie są lokalne ('a', 'b'…) – wstawiający zamienia je na wolne numery projektu (numeruj()).

import { punktyLuku } from './skladanka.js';
import { rozlozSiatke } from './rozkladanie-3d.js';

const LUZ = 0.5; // mm – luz między wieczkiem a pudełkiem
const LUZ_SZCZELINY = 0.2;
const r2 = (v) => Math.round(v * 100) / 100;
const P = (x, y) => ({ x: r2(x), y: r2(y) });

// Krawędzie z listy: [['c'] | ['z', para] | ['k', para]] → definicja krawędzi (cięcie / zakładka / do sklejenia).
const kr = (lista, szer = 7) => lista.map(([t, para]) => (t === 'z' ? { typ: 'zakladka', para, szer } : t === 'k' ? { typ: 'klej', para } : { typ: 'ciecie' }));
// Zgięcia „góra” – od nadruku: nadruk zostaje na zewnątrz bryły.
const zg = (a, b, kat = 90) => ({ a: P(a[0], a[1]), b: P(b[0], b[1]), rodzaj: 'gora', kat });

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

// Pudełko z klapą wsuwaną (#268, plan składanek krok 13 – mechanizmy): jak prostopadłościan, ale wieko jest
// zawiasem przy pierwszej ścianie, a na przeciwnym brzegu ma język (wypustka bez kleju) wsuwany za trzecią ścianę.
// Boki wieka i górne brzegi ścian 2–4 są cięte – pudełko otwiera się i zamyka bez końca.
function pudelkoZKlapa({ dlugosc: L, szerokosc: W, wysokosc: H }) {
  const [c] = prostopadloscian({ dlugosc: L, szerokosc: W, wysokosc: H });
  const krawedzie = [...c.krawedzie];
  krawedzie[0] = { typ: 'wypustka', para: null, szer: Math.min(15, Math.max(5, W * 0.35)) }; // przedni brzeg wieka – język
  krawedzie[1] = { typ: 'ciecie' }; // bok wieka
  krawedzie[2] = { typ: 'ciecie' }; // górny brzeg ściany 2
  krawedzie[3] = { typ: 'ciecie' }; // górny brzeg ściany 3 (tu wchodzi język)
  krawedzie[4] = { typ: 'ciecie' }; // górny brzeg ściany 4
  krawedzie[13] = { typ: 'ciecie' }; // drugi bok wieka
  return [{ ...c, nazwa: 'Pudełko z klapą wsuwaną', opis: 'Wieko na zawiasie, język wsuwany za przednią ścianę – otwiera się i zamyka bez kleju.', krawedzie }];
}

// Pudełko z zatrzaskiem (#271): jak z klapą wsuwaną, ale język wieka wchodzi w szczelinę w przedniej (trzeciej)
// ścianie – szczelina szeroka na grubość materiału + luz, dłuższa od języka o 1 mm, kilka mm pod górnym brzegiem.
function pudelkoZZatrzaskiem({ dlugosc: L, szerokosc: W, wysokosc: H }, t = 0.3) {
  const [c] = pudelkoZKlapa({ dlugosc: L, szerokosc: W, wysokosc: H });
  const szerJ = Math.min(15, Math.max(5, W * 0.35));
  const dlJ = Math.min(L / 3, 30);
  const krawedzie = [...c.krawedzie];
  krawedzie[0] = { typ: 'wypustka', para: 'z', szer: szerJ };
  const sx = L + W + L / 2;
  const sy = W + Math.min(szerJ * 0.6, H / 3);
  return [{ ...c, nazwa: 'Pudełko z zatrzaskiem', opis: 'Wieko na zawiasie, język wsuwany w szczelinę w przedniej ścianie – zamyka się na zatrzask.', krawedzie,
    szczeliny: [{ a: P(sx - dlJ / 2 - 0.5, sy), b: P(sx + dlJ / 2 + 0.5, sy), szer: r2(t + LUZ_SZCZELINY), para: 'z' }] }];
}

// Koło obrotowe (volvelle, #278 – element ruchomy do książek): dolny krążek R i górny R − 4 mm z okienkiem (wycinek
// koła, nacięcia), oba z krzyżykiem nacięć w środku na ćwiek (spinacz dwunóżny). Okienko ma kąt jednego z n pól –
// pola dolnego krążka projektuje się nadrukiem.
function koloObrotowe({ srednica: D, pola: n0 }) {
  const n = Math.max(3, Math.min(12, Math.round(n0)));
  const R = D / 2;
  const r = R - 4;
  const bok = (rr) => Math.max(24, Math.min(96, Math.round((2 * Math.PI * rr) / 3)));
  const krazek = (rr, przes) => Array.from({ length: bok(rr) }, (_, i) => P(przes + rr * Math.cos((2 * Math.PI * i) / bok(rr)), przes + rr * Math.sin((2 * Math.PI * i) / bok(rr))));
  const krzyzyk = (c) => [{ a: P(c - 2, c), b: P(c + 2, c), szer: 0.2, para: null, naciecie: true }, { a: P(c, c - 2), b: P(c, c + 2), szer: 0.2, para: null, naciecie: true }];
  const dolny = {
    nazwa: 'Koło obrotowe – spód',
    opis: `${n} pól do zadruku; w środku krzyżyk na ćwiek.`,
    punkty: krazek(R, R),
    krawedzie: krazek(R, R).map(() => ({ typ: 'ciecie' })),
    zgiecia: [],
    szczeliny: krzyzyk(R),
  };
  // Okienko: wycinek między promieniami r1 i r2 w kącie jednego pola (z marginesem 10 %).
  const k = (2 * Math.PI) / n;
  const r1 = r * 0.35;
  const r2 = r * 0.9;
  const a0 = -Math.PI / 2 - k / 2 + k * 0.1;
  const a1 = -Math.PI / 2 + k / 2 - k * 0.1;
  const luk = (rr, od, do_) => Array.from({ length: 9 }, (_, i) => { const a = od + ((do_ - od) * i) / 8; return P(r + rr * Math.cos(a), r + rr * Math.sin(a)); });
  const okno = [...luk(r2, a0, a1), ...luk(r1, a1, a0)];
  const nacieciaOkna = okno.map((p, i) => ({ a: p, b: okno[(i + 1) % okno.length], szer: 0.2, para: null, naciecie: true }));
  const gorny = {
    nazwa: 'Koło obrotowe – wierzch z okienkiem',
    opis: 'Wytnij okienko, przebij środek obu krążków i połącz ćwiekiem – górny obraca się nad dolnym.',
    punkty: krazek(r, r),
    krawedzie: krazek(r, r).map(() => ({ typ: 'ciecie' })),
    zgiecia: [],
    szczeliny: [...krzyzyk(r), ...nacieciaOkna],
  };
  return [dolny, gorny];
}

// Suwak (pull-tab, #279 – element ruchomy do książek): kartka z nacięciem przy brzegu (długość = szerokość paska
// + 1 mm) i pasek w kształcie litery T: wąska część przechodzi przez nacięcie, szeroki koniec (o 10 mm szerszy)
// zostaje pod kartką i nie pozwala wyciągnąć paska. Ruch paska = długość wąskiej części − zapas.
function suwak({ szerokosc: S, wysokosc: H, szerokosc_paska: w0, ruch: R0 }) {
  const w = Math.min(w0, H - 30);
  const ruch = Math.min(R0, S - 30);
  const yS = (H - w - 1) / 2;
  const xS = S - 12;
  const kartka = {
    nazwa: 'Suwak – kartka',
    opis: 'Przetnij nacięcie przy prawym brzegu i przełóż przez nie pasek od spodu – szeroki koniec zostaje pod kartką.',
    punkty: [P(0, 0), P(S, 0), P(S, H), P(0, H)],
    krawedzie: kr([['c'], ['c'], ['c'], ['c']]),
    zgiecia: [],
    szczeliny: [{ a: P(xS, yS), b: P(xS, yS + w + 1), szer: 0.2, para: null, naciecie: true }],
  };
  const dl = ruch + 20; // wąska część: ruch + uchwyt
  const szer = w + 10;
  const pasek = {
    nazwa: 'Suwak – pasek',
    opis: `Ruch ${r2(ruch)} mm; uchwyt wystaje poza kartkę.`,
    punkty: [P(0, 0), P(12, 0), P(12, 5), P(12 + dl, 5), P(12 + dl, 5 + w), P(12, 5 + w), P(12, szer), P(0, szer)],
    krawedzie: kr(Array(8).fill(['c'])),
    zgiecia: [],
  };
  return [kartka, pasek];
}

// Pudełko-poduszka (#281 – zgięcia po łuku): dwie ściany W × L i zakładka boczna; na końcach każdej ściany łuk
// cięcia wypukły na zewnątrz (strzałka g) i łuk zgięcia wklęsły do środka ściany (ta sama strzałka) – po złożeniu
// końce wciska się do środka i same się domykają. Łuki próbkowane co ok. 2 mm.
function pudelkoPoduszka({ szerokosc: W, dlugosc: L, glebokosc: g0 }) {
  const g = Math.max(3, Math.min(g0, W / 2.5));
  const luk = (x0, x1, y, strz) => punktyLuku(P(x0, y), P((x0 + x1) / 2, y + strz), P(x1, y), 12).slice(1).map((q) => P(q.x, q.y));
  const punkty = [P(0, 0), ...luk(0, W, 0, -g), ...luk(W, 2 * W, 0, -g), P(2 * W, L), ...luk(2 * W, W, L, g), ...luk(W, 0, L, g)];
  punkty.pop(); // ostatni punkt łuku = P(0, L) – zostaje jako początek lewej krawędzi
  punkty.push(P(0, L));
  const krawedzie = punkty.map((p, i) => {
    const q = punkty[(i + 1) % punkty.length];
    if (p.x === 0 && q.x === 0) return { typ: 'zakladka', para: 'a', szer: 8 };
    if (p.x === 2 * W && q.x === 2 * W) return { typ: 'klej', para: 'a' };
    return { typ: 'ciecie' };
  });
  const zgiecia = [{ a: P(W, 0), b: P(W, L), rodzaj: 'dolina', kat: 170 }];
  for (const x of [0, W]) {
    zgiecia.push({ a: P(x, 0), b: P(x + W, 0), luk: P(x + W / 2, g), rodzaj: 'dolina', kat: 90 });
    zgiecia.push({ a: P(x, L), b: P(x + W, L), luk: P(x + W / 2, L - g), rodzaj: 'dolina', kat: 90 });
  }
  return [{ nazwa: 'Pudełko-poduszka', opis: 'Zegnij łuki (big po łuku) i wciśnij końce do środka – zamykają się same.', punkty, krawedzie, zgiecia }];
}

// Klapki (lift-the-flap, #280 – zawias do książek): kartka z n okienkami (1–6, w siatce), każde wycięte z trzech
// stron i zgięte na czwartej (lewej) – zgięcie jest zawiasem. Pod kartką druga kartka z polami do przyklejenia
// (obrys bez okienek – klej tylko poza klapkami), na której rysuje się to, co klapka zasłania.
function klapki({ szerokosc: S, wysokosc: H, klapki: n0, szerokosc_klapki: w0, wysokosc_klapki: h0 }) {
  const n = Math.max(1, Math.min(6, Math.round(n0)));
  const kol = n <= 2 ? n : Math.min(3, Math.ceil(n / 2));
  const wier = Math.ceil(n / kol);
  const w = Math.min(w0, (S - 10 * (kol + 1)) / kol);
  const h = Math.min(h0, (H - 10 * (wier + 1)) / wier);
  const dx = (S - kol * w) / (kol + 1);
  const dy = (H - wier * h) / (wier + 1);
  const szczeliny = [];
  const zgiecia = [];
  for (let i = 0; i < n; i += 1) {
    const x = dx + (i % kol) * (w + dx);
    const y = dy + Math.floor(i / kol) * (h + dy);
    const [A, B, C, D] = [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)];
    szczeliny.push({ a: A, b: B, szer: 0.2, para: null, naciecie: true }, { a: B, b: C, szer: 0.2, para: null, naciecie: true }, { a: C, b: D, szer: 0.2, para: null, naciecie: true });
    zgiecia.push({ a: D, b: A, rodzaj: 'gora', kat: 120 });
  }
  const prost = () => [P(0, 0), P(S, 0), P(S, H), P(0, H)];
  return [
    { nazwa: 'Klapki – kartka', opis: `${n} ${n === 1 ? 'klapka' : n < 5 ? 'klapki' : 'klapek'}: przetnij trzy boki każdej (czerwone), zegnij czwarty – to zawias.`, punkty: prost(), krawedzie: kr([['c'], ['c'], ['c'], ['c']]), zgiecia, szczeliny },
    { nazwa: 'Klapki – spód', opis: 'Narysuj tu to, co zasłaniają klapki, i przyklej kartkę na wierzch – klej tylko poza okienkami.', punkty: prost(), krawedzie: kr([['c'], ['c'], ['c'], ['c']]), zgiecia: [] },
  ];
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
    zgiecia.push(zg([A.x, A.y], [B.x, B.y], Math.atan2(h, ap) * (180 / Math.PI))); // kąt między ścianą a podstawą
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

// ---------- Pop-up (#261, plan składanek krok 8) ----------
// Kartka pop-up „wycinanka” (cut & fold): jeden arkusz, otwarta kartka szer. 2 × S, wys. H, grzbiet pionowo w x = S
// (dolina – kartka zamyka się nadrukiem do środka). Pudełko: dwa równoległe nacięcia prostopadłe do grzbietu
// (od x = S − d do S + d), między nimi grzbiet odwrócony (góra), a na końcach nacięć – doliny. Po otwarciu kartki
// pod kątem prostym pudełko wyskakuje na głębokość d. Po zamknięciu leży w środku, jeśli d < S (nic nie wystaje).
function popupWycinanka({ szerokosc: S, wysokosc: H, pudelka: n, glebokosc: d, wysokosc_pudelka: h }) {
  const ile = Math.max(1, Math.min(4, Math.round(n)));
  const gl = Math.min(d, S - 5); // nacięcie nie może dojść do brzegu kartki
  const wys = Math.min(h, (H - 10 * (ile + 1)) / ile); // pudełka z odstępami co najmniej 10 mm
  const odstep = (H - ile * wys) / (ile + 1);
  const szczeliny = [];
  const zgiecia = [];
  let y = 0;
  for (let i = 0; i < ile; i += 1) {
    const y1 = r2(odstep * (i + 1) + wys * i);
    const y2 = r2(y1 + wys);
    zgiecia.push({ a: P(S, y), b: P(S, y1), rodzaj: 'dolina', kat: 90 });
    zgiecia.push({ a: P(S, y1), b: P(S, y2), rodzaj: 'gora', kat: 90 });
    zgiecia.push({ a: P(S - gl, y1), b: P(S - gl, y2), rodzaj: 'dolina', kat: 90 });
    zgiecia.push({ a: P(S + gl, y1), b: P(S + gl, y2), rodzaj: 'dolina', kat: 90 });
    szczeliny.push({ a: P(S - gl, y1), b: P(S + gl, y1), szer: 0.2, para: null, naciecie: true }, { a: P(S - gl, y2), b: P(S + gl, y2), szer: 0.2, para: null, naciecie: true });
    y = y2;
  }
  zgiecia.push({ a: P(S, y), b: P(S, H), rodzaj: 'dolina', kat: 90 });
  return [{
    nazwa: 'Kartka pop-up',
    opis: `Nacięcia (czerwone) przetnij, zegnij według linii i otwórz kartkę pod kątem prostym – ${ile === 1 ? 'pudełko wyskoczy' : 'pudełka wyskoczą'} na ${r2(gl)} mm.`,
    punkty: [P(0, 0), P(2 * S, 0), P(2 * S, H), P(0, H)],
    krawedzie: kr([['c'], ['c'], ['c'], ['c']]),
    zgiecia,
    szczeliny,
  }];
}

// Kartka pop-up z platformą (#269): pasek (góra y + przód h, szerokość w) przyklejony zakładkami do pól na kartce –
// po lewej w odległości h od grzbietu, po prawej w odległości y. Przy kartce otwartej pod kątem prostym pasek
// tworzy pudełko: góra równoległa do prawej strony, przód do lewej; przy zamkniętej i rozłożonej leży płasko
// (długość paska y + h = odległość pól przez grzbiet). Nic nie wystaje, gdy y, h ≤ S − zakładka.
// Druga warstwa (warstwy = 2): ten sam mechanizm na zgięciu pierwszego paska – przód paska działa jak lewa strona
// kartki, góra jak prawa; mniejszy pasek (ok. połowa) z polami na pierwszym.
function popupPlatforma({ szerokosc: S, wysokosc: H, glebokosc: y0, wysokosc_pudelka: h0, szerokosc_pudelka: w0, warstwy = 1 }) {
  const zak = 8;
  const y = Math.min(y0, S - zak - 2);
  const h = Math.min(h0, S - zak - 2);
  const w = Math.min(w0, H - 20);
  const g = (H - w) / 2;
  const karta = {
    nazwa: 'Kartka pop-up – podstawa',
    opis: 'Zegnij w dolinę na grzbiecie; pasek przyklej zakładkami do pól klejenia z tymi samymi numerami.',
    punkty: [P(0, 0), P(2 * S, 0), P(2 * S, H), P(0, H)],
    krawedzie: kr([['c'], ['c'], ['c'], ['c']]),
    zgiecia: [{ a: P(S, 0), b: P(S, H), rodzaj: 'dolina', kat: 90 }],
    pola: [{ x: r2(S - h - zak - 0.5), y: r2(g), w: zak + 0.5, h: r2(w), para: 'l' }, { x: r2(S + y), y: r2(g), w: zak + 0.5, h: r2(w), para: 'p' }],
  };
  const pasek = {
    nazwa: 'Kartka pop-up – platforma',
    opis: `Góra ${r2(y)} mm, przód ${r2(h)} mm; zakładki do pól na kartce.`,
    punkty: [P(0, 0), P(y + h, 0), P(y + h, w), P(0, w)],
    krawedzie: [{ typ: 'ciecie' }, { typ: 'zakladka', para: 'p', szer: zak }, { typ: 'ciecie' }, { typ: 'zakladka', para: 'l', szer: zak }],
    zgiecia: [{ a: P(y, 0), b: P(y, w), rodzaj: 'gora', kat: 90 }],
  };
  if (Math.round(warstwy) < 2) return [karta, pasek];
  const y2 = r2(Math.max(5, (y - zak) / 2));
  const h2 = r2(Math.max(5, (h - zak) / 2));
  const w2 = r2(w * 0.6);
  const g2 = (w - w2) / 2;
  // Pola na pierwszym pasku: na przodzie (x > y) w odległości h2 od zgięcia, na górze (x < y) w odległości y2.
  pasek.pola = [{ x: r2(y + h2), y: r2(g2), w: zak + 0.5, h: w2, para: 'l2' }, { x: r2(y - y2 - zak - 0.5), y: r2(g2), w: zak + 0.5, h: w2, para: 'p2' }];
  const pasek2 = {
    nazwa: 'Kartka pop-up – druga warstwa',
    opis: `Na pierwszym pasku: góra ${y2} mm, przód ${h2} mm.`,
    punkty: [P(0, 0), P(y2 + h2, 0), P(y2 + h2, w2), P(0, w2)],
    krawedzie: [{ typ: 'ciecie' }, { typ: 'zakladka', para: 'p2', szer: zak }, { typ: 'ciecie' }, { typ: 'zakladka', para: 'l2', szer: zak }],
    zgiecia: [{ a: P(y2, 0), b: P(y2, w2), rodzaj: 'gora', kat: 90 }],
  };
  return [karta, pasek, pasek2];
}

// Kartka pop-up ze zgięciem V (#272): trójkąt z grzbietem „góra” przyklejony zakładkami wzdłuż dwóch linii, które
// wychodzą z punktu P na grzbiecie kartki pod kątem α do grzbietu. Kąt między brzegiem trójkąta a jego grzbietem
// jest taki sam (α) – dlatego trójkąt leży płasko na rozłożonej kartce, a przy zamykaniu wstaje i składa się
// w środku. Pola klejenia są obrócone o kąt linii i leżą na zewnątrz niej (od grzbietu).
function popupV({ szerokosc: S, wysokosc: H, ramie: g0, kat: alfa0 }) {
  const zak = 8;
  const a = (Math.max(15, Math.min(75, alfa0)) * Math.PI) / 180;
  const yP = H * 0.8;
  const g = Math.min(g0, (S - 5) / Math.sin(a), (yP - 5) / Math.cos(a));
  const sx = Math.sin(a);
  const cy = Math.cos(a);
  const st = (rad) => r2((rad * 180) / Math.PI);
  const karta = {
    nazwa: 'Kartka pop-up V – podstawa',
    opis: 'Zegnij grzbiet w dolinę; trójkąt przyklej zakładkami do skośnych pól z tymi samymi numerami.',
    punkty: [P(0, 0), P(2 * S, 0), P(2 * S, H), P(0, H)],
    krawedzie: kr([['c'], ['c'], ['c'], ['c']]),
    zgiecia: [{ a: P(S, 0), b: P(S, H), rodzaj: 'dolina', kat: 90 }],
    pola: [
      // Pola na zewnątrz linii (od grzbietu): zakładka leży płasko na kartce, a trójkąt obraca się wokół linii do
      // środka – przez grzbiet nic nie przechodzi. Lewa linia od końca do P, prawa od P do końca.
      { x: r2(S - g * sx), y: r2(yP - g * cy), w: r2(g), h: zak + 0.5, kat: st(Math.atan2(cy, sx)), para: 'l' },
      { x: r2(S), y: r2(yP), w: r2(g), h: zak + 0.5, kat: st(Math.atan2(-cy, sx)), para: 'p' },
    ],
  };
  const trojkat = {
    nazwa: 'Kartka pop-up V – trójkąt',
    opis: `Ramię ${r2(g)} mm, kąt ${r2((a * 180) / Math.PI)}° do grzbietu.`,
    punkty: [P(0, 0), P(2 * g * sx, 0), P(g * sx, g * cy)],
    krawedzie: [{ typ: 'ciecie' }, { typ: 'zakladka', para: 'p', szer: zak }, { typ: 'zakladka', para: 'l', szer: zak }],
    zgiecia: [{ a: P(g * sx, g * cy), b: P(g * sx, 0), rodzaj: 'gora', kat: 90 }],
  };
  return [karta, trojkat];
}

// ---------- Powierzchnie rozwijalne (#261, plan składanek krok 10): walec, stożek, stożek ścięty ----------
// Koło jako wielokąt (krawędzie co ~3 mm, co najmniej 24) – do druku i cięcia wystarczająco gładkie.
const bokiKola = (r) => Math.max(24, Math.min(96, Math.round((2 * Math.PI * r) / 3)));
function kolo(r, nazwa, para) {
  const n = bokiKola(r);
  const pkt = Array.from({ length: n }, (_, i) => P(r + r * Math.cos((2 * Math.PI * i) / n), r + r * Math.sin((2 * Math.PI * i) / n)));
  return { nazwa, punkty: pkt, krawedzie: pkt.map(() => ({ typ: 'klej', para })), zgiecia: [] };
}
// Pas zakładek wzdłuż łuku: zakładki co odcinek łuku (n odcinków) – krawędzie typu „zakładka” z jedną parą.
function walec({ srednica: D, wysokosc: H }) {
  const r = D / 2;
  const n = bokiKola(r);
  const obwod = 2 * n * r * Math.sin(Math.PI / n); // obwód wielokąta podstawy – płaszcz pasuje do niego dokładnie
  const krok = obwod / n;
  const szerZ = Math.min(6, Math.max(3, krok * 0.8));
  const dol = Array.from({ length: n + 1 }, (_, i) => P(i * krok, H));
  const gora = Array.from({ length: n + 1 }, (_, i) => P((n - i) * krok, 0));
  const punkty = [...dol, ...gora];
  const krawedzie = [
    ...Array.from({ length: n }, () => ({ typ: 'zakladka', para: 'a', szer: szerZ })),
    { typ: 'zakladka', para: 'c', szer: 7 },
    ...Array.from({ length: n }, () => ({ typ: 'zakladka', para: 'b', szer: szerZ })),
    { typ: 'klej', para: 'c' },
  ];
  return [
    { nazwa: 'Walec – płaszcz', opis: `Zwiń w rurkę (obwód ${r2(obwod)} mm), sklej zakładkę „c”, potem zakładki do podstaw.`, punkty, krawedzie, zgiecia: [] },
    kolo(r, 'Walec – dno', 'a'),
    kolo(r, 'Walec – wieko', 'b'),
  ];
}
// Stożek ścięty (r2 = 0 – zwykły stożek): pierścień kołowy o promieniach R1 = s·r1/(r1−r2), R2 = s·r2/(r1−r2),
// kąt rozwinięcia 2π·r1/R1; s – tworząca. Zakładki na łuku podstawy, szew zakładką.
function stozekSciety({ srednica_dolu: D1, srednica_gory: D2, wysokosc: H }) {
  const r1 = Math.max(D1, D2) / 2;
  const rg = Math.min(D1, D2) / 2;
  const s = Math.hypot(H, r1 - rg);
  const R1 = (s * r1) / (r1 - rg || 1e-9);
  const R2 = R1 - s;
  const n = bokiKola(r1);
  const obwod1 = 2 * n * r1 * Math.sin(Math.PI / n);
  const kat = obwod1 / R1; // łuk zewnętrzny = obwód wielokąta podstawy
  const luk = (R, odwrotnie) => Array.from({ length: n + 1 }, (_, i) => {
    const k = (kat * (odwrotnie ? n - i : i)) / n;
    return P(R1 + R * Math.sin(k - kat / 2), R1 - R * Math.cos(k - kat / 2));
  });
  const szerZ = Math.min(6, Math.max(3, (obwod1 / n) * 0.8));
  if (rg < 0.5) {
    // Stożek: wycinek koła (wierzchołek w środku), zakładki na łuku i szew.
    const punkty = [P(R1, R1), ...luk(R1, false)];
    const krawedzie = [{ typ: 'klej', para: 'c' }, ...Array.from({ length: n }, () => ({ typ: 'zakladka', para: 'a', szer: szerZ })), { typ: 'zakladka', para: 'c', szer: 7 }];
    return [{ nazwa: 'Stożek – płaszcz', opis: `Zwiń w stożek (kąt rozwinięcia ${r2((kat * 180) / Math.PI)}°), sklej zakładkę „c”, potem do dna.`, punkty, krawedzie, zgiecia: [] }, kolo(r1, 'Stożek – dno', 'a')];
  }
  const zew = luk(R1, false);
  const wew = luk(R2, true);
  const obwod2 = 2 * n * rg * Math.sin(Math.PI / n);
  const szerW = Math.min(5, Math.max(2.5, (obwod2 / n) * 0.8));
  const punkty = [...zew, ...wew];
  const krawedzie = [
    ...Array.from({ length: n }, () => ({ typ: 'zakladka', para: 'a', szer: szerZ })),
    { typ: 'zakladka', para: 'c', szer: 7 },
    ...Array.from({ length: n }, () => ({ typ: 'zakladka', para: 'b', szer: szerW })),
    { typ: 'klej', para: 'c' },
  ];
  // Wieko w tej samej liczbie boków co pierścień (krawędzie zakładek pasują długością).
  const wieko = { nazwa: 'Stożek ścięty – wieko', punkty: Array.from({ length: n }, (_, i) => P(rg + rg * Math.cos((2 * Math.PI * i) / n), rg + rg * Math.sin((2 * Math.PI * i) / n))), krawedzie: Array.from({ length: n }, () => ({ typ: 'klej', para: 'b' })), zgiecia: [] };
  const dno = { nazwa: 'Stożek ścięty – dno', punkty: Array.from({ length: n }, (_, i) => P(r1 + r1 * Math.cos((2 * Math.PI * i) / n), r1 + r1 * Math.sin((2 * Math.PI * i) / n))), krawedzie: Array.from({ length: n }, () => ({ typ: 'klej', para: 'a' })), zgiecia: [] };
  return [{ nazwa: 'Stożek ścięty – płaszcz', opis: `Zwiń (kąt rozwinięcia ${r2((kat * 180) / Math.PI)}°), sklej zakładkę „c”, potem dno i wieko.`, punkty, krawedzie, zgiecia: [] }, dno, wieko];
}
const stozek = ({ srednica: D, wysokosc: H }) => stozekSciety({ srednica_dolu: D, srednica_gory: 0, wysokosc: H });

// Kula z klinów (globus, #262): n klinów od bieguna do bieguna. Klin na wysokości y (0 – biegun południowy, π·r –
// północny) ma szerokość 2π·r·cos(φ)/n, φ = y/r − π/2. Brzegi klinów próbkowane co ~4 mm; prawy brzeg klinu i ma
// zakładki, lewy brzeg klinu i+1 – „do sklejenia” z tym samym numerem (szew po łuku).
function kula({ srednica: D, kliny: n }) {
  const r = D / 2;
  const ile = Math.max(4, Math.min(24, Math.round(n)));
  const L = Math.PI * r;
  const k = Math.max(8, Math.min(40, Math.round(L / 4)));
  const pol = (y) => (Math.PI * r * Math.cos(y / r - Math.PI / 2)) / ile;
  const ys = Array.from({ length: k + 1 }, (_, j) => (L * j) / k);
  const hMax = pol(L / 2);
  const prawy = ys.map((y) => P(hMax + pol(y), y));
  const lewy = ys.slice(1, -1).reverse().map((y) => P(hMax - pol(y), y));
  const szerZ = Math.min(5, Math.max(2.5, hMax * 0.35));
  return Array.from({ length: ile }, (_, i) => ({
    nazwa: `Kula – klin ${i + 1}`,
    punkty: [...prawy, ...lewy],
    krawedzie: [
      ...Array.from({ length: k }, () => ({ typ: 'zakladka', para: `k${i}`, szer: szerZ })),
      ...Array.from({ length: k }, () => ({ typ: 'klej', para: `k${(i + ile - 1) % ile}` })),
    ],
    zgiecia: [],
  }));
}

// ---------- Bryła z rzutu (#263, plan składanek krok 11) ----------
// Z dowolnego wielokąta (kształt z pióra, gwiazda, litera z odcinków) – jedna część: podstawa w środku, na każdym jej
// boku ściana. Graniastosłup: prostokąty boczne wysokości H, wieko odbite za pierwszą ścianą; ostrosłup: trójkąty
// z wierzchołkiem H nad środkiem ciężkości podstawy. Pary: boki sąsiednich ścian (zakładka ↔ do sklejenia), w
// graniastosłupie także górne brzegi ścian ↔ boki wieka. Zgięcia: boki podstawy (i brzeg wieka).
function zgodnieZRuchem(pkt) {
  const pole = pkt.reduce((a, p, i) => { const q = pkt[(i + 1) % pkt.length]; return a + p.x * q.y - q.x * p.y; }, 0);
  return pole < 0 ? [...pkt].reverse() : pkt;
}
const normalna = (a, b) => { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.y - a.y) / l, y: -(b.x - a.x) / l }; };
const dodaj = (p, n, d) => ({ x: p.x + n.x * d, y: p.y + n.y * d });
function przesunNaZero(czesc) {
  const minX = Math.min(...czesc.punkty.map((p) => p.x));
  const minY = Math.min(...czesc.punkty.map((p) => p.y));
  const m = (p) => P(p.x - minX, p.y - minY);
  return { ...czesc, punkty: czesc.punkty.map(m), zgiecia: czesc.zgiecia.map((z) => ({ ...z, a: m(z.a), b: m(z.b), ...(z.luk ? { luk: m(z.luk) } : {}) })) };
}
export function brylaZRzutu(punktyWejscie, { rodzaj = 'graniastoslup', wysokosc: H = 40, nazwa = 'Bryła' } = {}) {
  const pkt = zgodnieZRuchem(punktyWejscie.map((p) => ({ x: Number(p.x), y: Number(p.y) })));
  const n = pkt.length;
  if (n < 3) return [];
  const nast = (i) => pkt[(i + 1) % n];
  const szer = (l) => Math.min(8, Math.max(3, l * 0.3));
  const dl = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const zgiecia = pkt.map((p, i) => ({ a: p, b: nast(i), rodzaj: 'gora', kat: 90 }));
  const punkty = [];
  const krawedzie = [];
  if (rodzaj === 'ostroslup') {
    const c = { x: pkt.reduce((a, p) => a + p.x, 0) / n, y: pkt.reduce((a, p) => a + p.y, 0) / n };
    for (let i = 0; i < n; i += 1) {
      const a = pkt[i];
      const b = nast(i);
      const sa = Math.hypot(dl(a, c), H);
      const sb = Math.hypot(dl(b, c), H);
      const l = dl(a, b);
      // Wierzchołek trójkąta w płaszczyźnie: odległość sa od a i sb od b, po zewnętrznej stronie boku.
      const x = (sa * sa - sb * sb + l * l) / (2 * l);
      const h = Math.sqrt(Math.max(0, sa * sa - x * x));
      const u = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
      const nr = normalna(a, b);
      const w = { x: a.x + u.x * x + nr.x * h, y: a.y + u.y * x + nr.y * h };
      punkty.push(a, w);
      krawedzie.push({ typ: 'klej', para: `s${(i + n - 1) % n}` }, { typ: 'zakladka', para: `s${i}`, szer: szer(sb) });
    }
    return [przesunNaZero({ nazwa: `${nazwa} – ostrosłup`, opis: `Ostrosłup o wysokości ${r2(H)} mm z wielokąta (${n} boków).`, punkty, krawedzie, zgiecia })];
  }
  const A = dodaj(pkt[0], normalna(pkt[0], pkt[1]), H);
  const B = dodaj(pkt[1], normalna(pkt[0], pkt[1]), H);
  // Wieko: podstawa odbita względem prostej równoległej do pierwszego boku w odległości H/2 (T0 = A, T1 = B).
  const n0 = normalna(pkt[0], pkt[1]);
  const odbij = (p) => { const d = (p.x - pkt[0].x) * n0.x + (p.y - pkt[0].y) * n0.y; return dodaj(p, n0, H - 2 * d); };
  const T = pkt.map(odbij);
  for (let i = 0; i < n; i += 1) {
    const a = pkt[i];
    const b = nast(i);
    const nr = normalna(a, b);
    punkty.push(a, dodaj(a, nr, H));
    krawedzie.push({ typ: 'klej', para: `s${(i + n - 1) % n}` });
    if (i === 0) {
      // Brzeg wieka od A dookoła do B: T0 → T(n−1) → … → T2 → T1.
      krawedzie.push({ typ: 'klej', para: `t${n - 1}` });
      for (let k = n - 1; k >= 2; k -= 1) { punkty.push(T[k]); krawedzie.push({ typ: 'klej', para: `t${k - 1}` }); }
    } else krawedzie.push({ typ: 'zakladka', para: `t${i}`, szer: szer(dl(a, b)) });
    punkty.push(dodaj(b, nr, H));
    krawedzie.push({ typ: 'zakladka', para: `s${i}`, szer: szer(H) });
  }
  zgiecia.push({ a: A, b: B, rodzaj: 'gora', kat: 90 });
  return [przesunNaZero({ nazwa: `${nazwa} – graniastosłup`, opis: `Graniastosłup o wysokości ${r2(H)} mm z wielokąta (${n} boków); wieko przy pierwszej ścianie.`, punkty, krawedzie, zgiecia })];
}

// ---------- Gotowe trudniejsze modele (#265, plan składanek krok 14) ----------
// Bryła z sylwetki (bok, oś y w górę) wyciągniętej na głębokość G – jako siatka 3D rozłożona automatycznie
// (js/rozkladanie-3d.js): sama dzieli się na części, gdy ściany nachodziłyby na siebie.
function modelZSylwetki(sylwetka, G, nazwa) {
  const n = sylwetka.length;
  const wierzcholki = [...sylwetka.map(([x, y]) => [x, y, 0]), ...sylwetka.map(([x, y]) => [x, y, G])];
  const sciany = [
    sylwetka.map((_, i) => n - 1 - i), // przód (z = 0) – na zewnątrz w −z
    sylwetka.map((_, i) => n + i), // tył (z = G)
    ...sylwetka.map((_, i) => [i, (i + 1) % n, n + ((i + 1) % n), n + i]),
  ];
  const wymiar = Math.max(...sylwetka.map(([x]) => x), ...sylwetka.map(([, y]) => y), G);
  return rozlozSiatke({ wierzcholki, sciany }, { rozmiar: wymiar, nazwa }).czesci;
}
// Bryła obrotowa z profilu (#267): profil [[r, z]] od dna do góry obrócony w n segmentach; dno płaskie, góra otwarta
// (wazon) albo zamknięta. Siatka 3D rozłożona automatycznie – pasy ścian z zakładkami, dno w całości.
export function brylaObrotowa(profil, { segmenty = 12, zamknieta = false, nazwa = 'Bryła obrotowa' } = {}) {
  const n = Math.max(6, Math.min(32, Math.round(segmenty)));
  const wierzcholki = [];
  profil.forEach(([r, z]) => { for (let i = 0; i < n; i += 1) { const a = (2 * Math.PI * i) / n; wierzcholki.push([r * Math.cos(a), r * Math.sin(a), z]); } });
  const id = (k, i) => k * n + (i % n);
  const sciany = [Array.from({ length: n }, (_, i) => id(0, n - 1 - i))]; // dno (na zewnątrz w −z)
  for (let k = 0; k + 1 < profil.length; k += 1) for (let i = 0; i < n; i += 1) sciany.push([id(k, i), id(k, i + 1), id(k + 1, i + 1), id(k + 1, i)]);
  if (zamknieta) sciany.push(Array.from({ length: n }, (_, i) => id(profil.length - 1, i)));
  const wymiar = Math.max(...profil.map(([r, z]) => Math.max(2 * r, z)));
  return rozlozSiatke({ wierzcholki, sciany }, { rozmiar: wymiar, nazwa }).czesci;
}
// Wazon: dno Ø D, brzuch szerszy o połowę, szyjka węższa; wysokość H; otwarty u góry.
const wazon = ({ srednica: D, wysokosc: H, segmenty: n }) => brylaObrotowa([[D / 2, 0], [D * 0.75, H * 0.35], [D * 0.6, H * 0.7], [D * 0.38, H * 0.85], [D * 0.45, H]], { segmenty: n, nazwa: 'Wazon' });

// Żółw (#276, plan składanek krok 14 – zwierzę z siatki 3D): skorupa (kopuła z profilu, płaski spód), głowa i cztery
// łapy (prostopadłościany), ogon (ostrosłup) – kilka zamkniętych brył w jednej siatce, rozłożonych automatycznie
// (każda bryła to osobne części; głowę, łapy i ogon dokleja się pod skorupę).
function zolw({ dlugosc: L }) {
  const wierzcholki = [];
  const sciany = [];
  const prost = (x0, y0, z0, dx, dy, dz) => {
    const b = wierzcholki.length;
    for (const [x, y, z] of [[0, 0, 0], [dx, 0, 0], [dx, dy, 0], [0, dy, 0], [0, 0, dz], [dx, 0, dz], [dx, dy, dz], [0, dy, dz]]) wierzcholki.push([x0 + x, y0 + y, z0 + z]);
    sciany.push([b, b + 3, b + 2, b + 1], [b + 4, b + 5, b + 6, b + 7], [b, b + 1, b + 5, b + 4], [b + 1, b + 2, b + 6, b + 5], [b + 2, b + 3, b + 7, b + 6], [b + 3, b, b + 4, b + 7]);
  };
  // Skorupa: profil kopuły (r, z), 10 segmentów, spód płaski.
  const R = L * 0.4;
  const profil = [[R, 0], [R * 0.95, R * 0.25], [R * 0.75, R * 0.5], [R * 0.4, R * 0.68], [0.001, R * 0.72]];
  const n = 10;
  const b0 = wierzcholki.length;
  profil.forEach(([r, z]) => { for (let i = 0; i < n; i += 1) { const a = (2 * Math.PI * i) / n; wierzcholki.push([r * Math.cos(a), r * Math.sin(a), z]); } });
  const id = (k, i) => b0 + k * n + (i % n);
  sciany.push(Array.from({ length: n }, (_, i) => id(0, n - 1 - i)));
  for (let k = 0; k + 1 < profil.length; k += 1) for (let i = 0; i < n; i += 1) sciany.push([id(k, i), id(k, i + 1), id(k + 1, i + 1), id(k + 1, i)]);
  // Głowa z przodu (+x), łapy na ukos, ogon z tyłu.
  const g = L * 0.16;
  prost(R - g * 0.3, -g / 2, 0, g * 1.3, g, g * 0.9);
  const l = L * 0.12;
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) prost(sx * R * 0.6 - l / 2, sy * R * 0.75 - l / 2, 0, l, l, l * 0.6);
  const t = wierzcholki.length;
  const o = L * 0.1;
  wierzcholki.push([-R + o * 0.2, -o / 2, 0], [-R + o * 0.2, o / 2, 0], [-R + o * 0.2, 0, o * 0.6], [-R - o, 0, 0]);
  sciany.push([t, t + 1, t + 2], [t, t + 3, t + 1], [t + 1, t + 3, t + 2], [t + 2, t + 3, t]);
  return rozlozSiatke({ wierzcholki, sciany }, { rozmiar: L, nazwa: 'Żółw' }).czesci;
}

// Domek: ściany S × Hs, dach dwuspadowy wysokości Hd, głębokość G.
const domek = ({ szerokosc: S, wysokosc: Hs, dach: Hd, glebokosc: G }) => modelZSylwetki([[0, 0], [S, 0], [S, Hs], [S / 2, Hs + Hd], [0, Hs]], G, 'Domek');
// Samochód: sylwetka z maską, kabiną i bagażnikiem; L × H, szerokość W.
const samochod = ({ dlugosc: L, wysokosc: H, szerokosc: W }) => modelZSylwetki([
  [0, 0.12 * H], [0.1 * L, 0], [0.9 * L, 0], [L, 0.12 * H], [L, 0.5 * H], [0.8 * L, 0.56 * H], [0.66 * L, H], [0.32 * L, H], [0.2 * L, 0.56 * H], [0, 0.5 * H],
], W, 'Samochód');

export const SZABLONY_SKLADANEK = {
  prostopadloscian: { nazwa: 'Prostopadłościan (kostka)', opis: 'Jedna część: pas czterech ścian, wieko i dno, zakładki klejowe.', parametry: { dlugosc: 60, szerokosc: 40, wysokosc: 30 }, buduj: prostopadloscian },
  pudelko_klapa: { nazwa: 'Pudełko z klapą wsuwaną', opis: 'Mechanizm: wieko na zawiasie z językiem wsuwanym za przednią ścianę – otwiera się i zamyka bez kleju.', parametry: { dlugosc: 80, szerokosc: 50, wysokosc: 40 }, buduj: pudelkoZKlapa },
  pudelko_zatrzask: { nazwa: 'Pudełko z zatrzaskiem', opis: 'Mechanizm: wieko z językiem wsuwanym w szczelinę w przedniej ścianie – zamyka się na zatrzask (szczelina na grubość materiału).', parametry: { dlugosc: 80, szerokosc: 50, wysokosc: 40 }, buduj: pudelkoZZatrzaskiem },
  kolo_obrotowe: { nazwa: 'Koło obrotowe (do książek)', opis: 'Element ruchomy: dwa krążki na ćwieku – górny z okienkiem pokazuje kolejne pola dolnego.', parametry: { srednica: 120, pola: 6 }, buduj: koloObrotowe },
  poduszka: { nazwa: 'Pudełko-poduszka (zgięcia po łuku)', opis: 'Dwie ściany z łukami na końcach – zgięcia po łuku domykają pudełko bez kleju na końcach.', parametry: { szerokosc: 70, dlugosc: 120, glebokosc: 18 }, buduj: pudelkoPoduszka },
  klapki: { nazwa: 'Klapki (lift-the-flap, do książek)', opis: 'Okienka wycięte z trzech stron i zgięte na czwartej (zawias) – pod nimi druga kartka z ukrytym obrazkiem.', parametry: { szerokosc: 100, wysokosc: 140, klapki: 4, szerokosc_klapki: 30, wysokosc_klapki: 40 }, buduj: klapki },
  suwak: { nazwa: 'Suwak (pull-tab, do książek)', opis: 'Element ruchomy: pasek przełożony przez nacięcie w kartce – wysuwasz go za uchwyt, szeroki koniec nie pozwala go wyciągnąć.', parametry: { szerokosc: 100, wysokosc: 140, szerokosc_paska: 25, ruch: 50 }, buduj: suwak },
  tacka: { nazwa: 'Tacka (pudełko bez wieka)', opis: 'Dno i cztery ścianki, zakładki na dłuższych ściankach.', parametry: { dlugosc: 100, szerokosc: 70, wysokosc: 30 }, buduj: (p) => [tacka(p)] },
  pudelko: { nazwa: 'Pudełko z wieczkiem nakładanym', opis: 'Dwie części: pudełko i wieczko większe o dwie grubości materiału i luz – nakłada się ciasno, ale bez wciskania.', parametry: { dlugosc: 100, szerokosc: 70, wysokosc: 40, wieczko: 15 }, buduj: pudelkoZWieczkiem },
  graniastoslup: { nazwa: 'Graniastosłup (np. sześciokątny)', opis: 'Pas ścian i dwie podstawy przy pierwszej ścianie.', parametry: { boki: 6, bok: 25, wysokosc: 60 }, buduj: graniastoslup },
  ostroslup: { nazwa: 'Ostrosłup (piramida)', opis: 'Podstawa i trójkąty ścian dookoła; zakładka na każdym trójkącie.', parametry: { boki: 4, bok: 60, wysokosc: 50 }, buduj: ostroslup },
  walec: { nazwa: 'Walec', opis: 'Płaszcz z zakładkami do dna i wieka (koła z wielu krótkich boków – pasują długością do zakładek).', parametry: { srednica: 50, wysokosc: 80 }, buduj: walec },
  stozek: { nazwa: 'Stożek', opis: 'Płaszcz – wycinek koła – z zakładkami do dna; kąt rozwinięcia liczony z wysokości i średnicy.', parametry: { srednica: 60, wysokosc: 70 }, buduj: stozek },
  stozek_sciety: { nazwa: 'Stożek ścięty (np. kubek, abażur)', opis: 'Płaszcz – wycinek pierścienia – z zakładkami do dna i wieka.', parametry: { srednica_dolu: 70, srednica_gory: 45, wysokosc: 60 }, buduj: stozekSciety },
  kula: { nazwa: 'Kula z klinów (globus)', opis: 'Kliny od bieguna do bieguna (4–24) – każdy przykleja się zakładkami do następnego; im więcej klinów, tym okrąglej.', parametry: { srednica: 80, kliny: 8 }, buduj: kula },
  wazon: { nazwa: 'Wazon (bryła obrotowa)', opis: 'Profil obrócony w segmentach (6–32): pasy ścian z zakładkami i płaskie dno – rozłożone automatycznie; góra otwarta.', parametry: { srednica: 50, wysokosc: 110, segmenty: 12 }, buduj: wazon },
  zolw: { nazwa: 'Żółw (zwierzę z siatki 3D)', opis: 'Skorupa z segmentów, głowa, cztery łapy i ogon – bryły rozłożone automatycznie; głowę, łapy i ogon doklej pod skorupę.', parametry: { dlugosc: 140 }, buduj: zolw },
  domek: { nazwa: 'Domek z dachem dwuspadowym', opis: 'Ściany i dach jako jedna bryła rozłożona automatycznie – szczyty, połacie i ściany z zakładkami i numerami.', parametry: { szerokosc: 60, wysokosc: 45, dach: 30, glebokosc: 70 }, buduj: domek },
  samochod: { nazwa: 'Samochód (sylwetka)', opis: 'Nadwozie z maską, kabiną i bagażnikiem – bryła z sylwetki rozłożona automatycznie (koła dorysuj albo doklej osobno).', parametry: { dlugosc: 120, wysokosc: 45, szerokosc: 50 }, buduj: samochod },
  popup_platforma: { nazwa: 'Kartka pop-up z platformą (wklejana)', opis: 'Kartka i pasek przyklejony zakładkami po obu stronach grzbietu – po otwarciu stoi jak pudełko, po zamknięciu leży płasko w środku.', parametry: { szerokosc: 100, wysokosc: 140, glebokosc: 35, wysokosc_pudelka: 30, szerokosc_pudelka: 60, warstwy: 2 }, buduj: popupPlatforma },
  popup_v: { nazwa: 'Kartka pop-up ze zgięciem V', opis: 'Trójkąt przyklejony skośnie po obu stronach grzbietu – na rozłożonej kartce leży płasko, przy zamykaniu wstaje i składa się w środku.', parametry: { szerokosc: 100, wysokosc: 140, ramie: 60, kat: 45 }, buduj: popupV },
  popup: { nazwa: 'Kartka pop-up (wycinanka)', opis: 'Jeden arkusz: nacięcia i zgięcia – po otwarciu kartki pod kątem prostym pudełka wyskakują ze środka. Nic nie wystaje po zamknięciu (nacięcia kończą się przed brzegiem).', parametry: { szerokosc: 100, wysokosc: 140, pudelka: 2, glebokosc: 25, wysokosc_pudelka: 30 }, buduj: popupWycinanka },
  przegrodki: { nazwa: 'Przegródki wsuwane na krzyż', opis: 'Do pudełka o podanych wymiarach: dwie płytki ze szczelinami do połowy – wsuwasz jedną w drugą i wkładasz do środka.', parametry: { dlugosc: 100, szerokosc: 70, wysokosc: 40 }, buduj: przegrodki },
};

export const OPISY_PARAMETROW = { klapki: 'Liczba klapek', szerokosc_klapki: 'Szerokość klapki (mm)', wysokosc_klapki: 'Wysokość klapki (mm)', szerokosc_paska: 'Szerokość paska (mm)', ruch: 'Ruch paska (mm)', pola: 'Liczba pól (3–12)', ramie: 'Ramię trójkąta (mm)', kat: 'Kąt do grzbietu (15–75°)', warstwy: 'Warstwy (1–2)', szerokosc_pudelka: 'Szerokość pudełka (mm)', segmenty: 'Liczba segmentów (6–32)', dach: 'Wysokość dachu (mm)', kliny: 'Liczba klinów (4–24)', srednica: 'Średnica (mm)', srednica_dolu: 'Średnica dołu (mm)', srednica_gory: 'Średnica góry (mm)', pudelka: 'Liczba pudełek (1–4)', glebokosc: 'Głębokość pudełka (mm)', wysokosc_pudelka: 'Wysokość pudełka (mm)', dlugosc: 'Długość (mm)', szerokosc: 'Szerokość (mm)', wysokosc: 'Wysokość (mm)', wieczko: 'Wysokość wieczka (mm)', boki: 'Liczba boków podstawy', bok: 'Bok podstawy (mm)' };

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
  return czesci.map((c) => ({ ...c, krawedzie: c.krawedzie.map((k) => ({ ...k, para: nr(k.para) })), szczeliny: (c.szczeliny || []).map((z) => ({ ...z, para: nr(z.para) })), pola: (c.pola || []).map((x) => ({ ...x, para: nr(x.para) })) }));
}
