// Rozkładanie modelu 3D na siatkę do wycięcia i sklejenia (#264, plan składanek krok 9 – jak Pepakura).
// Wejście: OBJ (tekst) albo STL (binarny albo tekstowy). Ściany dzielimy na trójkąty, łączymy wspólne wierzchołki,
// budujemy drzewo rozpinające ścian (najpierw krawędzie najbardziej płaskie – mniej zgięć i cięć w widocznych
// miejscach), rozkładamy trójkąty na płaszczyznę wzdłuż drzewa. Trójkąt, który nachodziłby na już rozłożone,
// zaczyna nową część. Wynik: definicje części składanki (js/skladanka.js) – obrys, krawędzie (cięcie / zakładka /
// do sklejenia z lokalnym numerem pary), zgięcia góra / dolina z kątem. Moduł bez DOM.

const EPS = 1e-9;

// ---------- Wczytywanie ----------

// OBJ: v x y z; f a b c … (indeksy od 1, ujemne – od końca, „a/b/c” – bierzemy pierwszy).
// usemtl – materiał kolejnych ścian (#277): kolor z MTL (Kd) albo – bez MTL – z palety według nazwy materiału.
export function wczytajOBJ(tekst, mtl = null) {
  const v = [];
  const vt = [];
  const sciany = [];
  const scianyUV = [];
  const kolory = [];
  const tekstury = [];
  const materialy = mtl ? wczytajMTL(mtl) : {};
  const mapy = mtl ? teksturyMTL(mtl) : {};
  let kolor = null;
  let tekstura = null;
  const nazwy = [];
  for (const linia of String(tekst).split(/\r?\n/)) {
    const t = linia.trim().split(/\s+/);
    if (t[0] === 'v' && t.length >= 4) v.push([Number(t[1]), Number(t[2]), Number(t[3])]);
    else if (t[0] === 'vt' && t.length >= 3) vt.push([Number(t[1]), Number(t[2])]);
    else if (t[0] === 'usemtl') {
      const n = t.slice(1).join(' ');
      if (!nazwy.includes(n)) nazwy.push(n);
      kolor = materialy[n] || PALETA[nazwy.indexOf(n) % PALETA.length];
      tekstura = mapy[n] || null;
    } else if (t[0] === 'f' && t.length >= 4) {
      const idx = (x, n) => { const i = parseInt(x, 10); return Number.isNaN(i) ? -1 : i < 0 ? n + i : i - 1; };
      const ids = t.slice(1).map((x) => idx(x.split('/')[0], v.length));
      const uv = t.slice(1).map((x) => idx(x.split('/')[1] ?? '', vt.length));
      if (ids.every((i) => i >= 0 && i < v.length)) {
        sciany.push(ids);
        kolory.push(kolor);
        // Tekstura (#283): współrzędne UV wierzchołków ściany, gdy materiał ma obrazek (map_Kd) i UV są kompletne.
        const pelne = tekstura && uv.every((i) => i >= 0 && i < vt.length);
        scianyUV.push(pelne ? uv : null);
        tekstury.push(pelne ? tekstura : null);
      }
    }
  }
  return {
    wierzcholki: v, sciany, ...(kolory.some(Boolean) ? { kolory } : {}),
    ...(tekstury.some(Boolean) ? { uv: vt, scianyUV, tekstury } : {}),
  };
}
const PALETA = ['#f2c14e', '#7cb7e8', '#9bd18b', '#f28f6b', '#c7a2e0', '#f5f0e6', '#8fd6cf', '#e8a0bf'];
// MTL: newmtl nazwa; Kd r g b (0–1) → { nazwa: '#rrggbb' }.
export function wczytajMTL(tekst) {
  const w = {};
  let biezacy = null;
  for (const linia of String(tekst).split(/\r?\n/)) {
    const t = linia.trim().split(/\s+/);
    if (t[0] === 'newmtl') biezacy = t.slice(1).join(' ');
    else if (t[0] === 'Kd' && biezacy && t.length >= 4) w[biezacy] = `#${t.slice(1, 4).map((x) => Math.round(Math.max(0, Math.min(1, Number(x))) * 255).toString(16).padStart(2, '0')).join('')}`;
  }
  return w;
}

// MTL: newmtl nazwa; map_Kd [opcje] plik → { nazwa: 'plik.png' } (sama nazwa pliku, bez folderów).
export function teksturyMTL(tekst) {
  const w = {};
  let biezacy = null;
  for (const linia of String(tekst).split(/\r?\n/)) {
    const t = linia.trim().split(/\s+/);
    if (t[0] === 'newmtl') biezacy = t.slice(1).join(' ');
    else if (t[0] === 'map_Kd' && biezacy && t.length >= 2) w[biezacy] = t[t.length - 1].split(/[\\/]/).pop();
  }
  return w;
}

// STL binarny (80 B nagłówka, liczba trójkątów, po 50 B na trójkąt) albo tekstowy („solid … facet … vertex”).
export function wczytajSTL(bufor) {
  const u8 = bufor instanceof Uint8Array ? bufor : new Uint8Array(bufor);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const ileBin = u8.byteLength >= 84 ? dv.getUint32(80, true) : -1;
  const trojkaty = [];
  if (ileBin >= 0 && 84 + ileBin * 50 === u8.byteLength) {
    for (let i = 0; i < ileBin; i += 1) {
      const o = 84 + i * 50 + 12;
      trojkaty.push([0, 1, 2].map((k) => [dv.getFloat32(o + k * 12, true), dv.getFloat32(o + k * 12 + 4, true), dv.getFloat32(o + k * 12 + 8, true)]));
    }
  } else {
    const tekst = new TextDecoder().decode(u8);
    const w = [...tekst.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
    for (let i = 0; i + 2 < w.length; i += 3) trojkaty.push([w[i], w[i + 1], w[i + 2]]);
  }
  // Wspólne wierzchołki (STL powtarza je w każdym trójkącie).
  const mapa = new Map();
  const wierzcholki = [];
  const klucz = (p) => p.map((x) => Math.round(x * 1e5)).join(',');
  const id = (p) => { const k = klucz(p); if (!mapa.has(k)) { mapa.set(k, wierzcholki.length); wierzcholki.push(p); } return mapa.get(k); };
  return { wierzcholki, sciany: trojkaty.map((t) => t.map(id)) };
}

// ---------- Geometria ----------

const odejmij = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const iloczyn = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const skalar = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dlug = (a) => Math.hypot(a[0], a[1], a[2]);
const normalna = (A, B, C) => { const n = iloczyn(odejmij(B, A), odejmij(C, A)); const l = dlug(n) || 1; return [n[0] / l, n[1] / l, n[2] / l]; };

// 2D: znak pola trójkąta; czy dwa trójkąty 2D nachodzą (z zapasem – wspólne krawędzie i wierzchołki nie liczą się).
const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function odcinkiSiePrzecinaja(p1, p2, p3, p4) {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}
function punktWTrojkacie(p, t) {
  const a = orient(t[0], t[1], p);
  const b = orient(t[1], t[2], p);
  const c = orient(t[2], t[0], p);
  return (a > EPS && b > EPS && c > EPS) || (a < -EPS && b < -EPS && c < -EPS);
}
// Trójkąty pomniejszone o ułamek do środka – wspólne krawędzie sąsiadów nie dają fałszywego nachodzenia.
function pomniejsz(t, k = 0.02) {
  const s = { x: (t[0].x + t[1].x + t[2].x) / 3, y: (t[0].y + t[1].y + t[2].y) / 3 };
  return t.map((p) => ({ x: p.x + (s.x - p.x) * k, y: p.y + (s.y - p.y) * k }));
}
export function trojkatyNachodza(t1, t2) {
  const a = pomniejsz(t1);
  const b = pomniejsz(t2);
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) if (odcinkiSiePrzecinaja(a[i], a[(i + 1) % 3], b[j], b[(j + 1) % 3])) return true;
  return a.some((p) => punktWTrojkacie(p, b)) || b.some((p) => punktWTrojkacie(p, a));
}

// Ściana (wielokąt płaski, indeksy) → trójkąty z zachowaniem kolejności wierzchołków. Rzut na płaszczyznę, w której
// ściana jest najszersza, potem „obcinanie uszu”.
export function trojkatySciany(f, P3) {
  if (f.length <= 3) return [f];
  // Normalna Newella – działa też dla wklęsłych.
  const n = [0, 0, 0];
  f.forEach((a, i) => { const p = P3[a]; const q = P3[f[(i + 1) % f.length]]; n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]); });
  const os = [0, 1, 2].reduce((m, k) => (Math.abs(n[k]) > Math.abs(n[m]) ? k : m), 0);
  const [ix, iy] = [[1, 2], [2, 0], [0, 1]][os];
  const znak = n[os] >= 0 ? 1 : -1;
  const p2 = (a) => ({ x: P3[a][ix], y: P3[a][iy] * znak });
  const zostaje = [...f];
  const wynik = [];
  let straz = f.length * f.length;
  while (zostaje.length > 3 && straz > 0) {
    straz -= 1;
    let obciete = false;
    for (let i = 0; i < zostaje.length; i += 1) {
      const a = zostaje[(i + zostaje.length - 1) % zostaje.length];
      const b = zostaje[i];
      const c = zostaje[(i + 1) % zostaje.length];
      if (orient(p2(a), p2(b), p2(c)) <= EPS) continue; // wklęsły wierzchołek
      const tr = [p2(a), p2(b), p2(c)];
      if (zostaje.some((d) => d !== a && d !== b && d !== c && punktWTrojkacie(p2(d), tr))) continue;
      wynik.push([a, b, c]);
      zostaje.splice(i, 1);
      obciete = true;
      break;
    }
    if (!obciete) break;
  }
  if (zostaje.length === 3) wynik.push(zostaje);
  else for (let i = 1; i + 1 < zostaje.length; i += 1) wynik.push([zostaje[0], zostaje[i], zostaje[i + 1]]); // awaryjnie
  return wynik;
}

// ---------- Rozkładanie ----------

// siatka: { wierzcholki: [[x,y,z]], sciany: [[i,j,k,…]] }. rozmiar – najdłuższy wymiar modelu w mm.
// Zwraca { czesci: [{ nazwa, punkty, krawedzie, zgiecia }], trojkatow, czesciIle }.
export function rozlozSiatke(siatka, { rozmiar = 100, nazwa = 'Model', progZgiecia = 1 } = {}) {
  const V = siatka.wierzcholki;
  if (!V.length) return { czesci: [], trojkatow: 0 };
  // Skala: najdłuższy wymiar ramki modelu = rozmiar mm.
  const min = [0, 1, 2].map((k) => Math.min(...V.map((p) => p[k])));
  const max = [0, 1, 2].map((k) => Math.max(...V.map((p) => p[k])));
  const skala = rozmiar / (Math.max(...max.map((m, k) => m - min[k])) || 1);
  const P3 = V.map((p) => p.map((x, k) => (x - min[k]) * skala));
  // Trójkąty: wielokąty dzielone metodą uszu (także wklęsłe – np. sylwetka auta), bez zdegenerowanych.
  const T = [];
  const kolorT = [];
  const uvT = []; // [[u, v] × 3] w kolejności wierzchołków trójkąta albo null
  const teksT = [];
  siatka.sciany.forEach((f, fi) => {
    const fuv = siatka.scianyUV?.[fi];
    for (const t of trojkatySciany(f, P3)) {
      if (new Set(t).size === 3 && dlug(iloczyn(odejmij(P3[t[1]], P3[t[0]]), odejmij(P3[t[2]], P3[t[0]]))) > 1e-9) {
        T.push(t);
        kolorT.push(siatka.kolory?.[fi] || null);
        uvT.push(fuv ? t.map((v) => siatka.uv[fuv[f.indexOf(v)]]) : null);
        teksT.push(fuv ? siatka.tekstury[fi] : null);
      }
    }
  });
  const N = T.map((t) => normalna(P3[t[0]], P3[t[1]], P3[t[2]]));
  // Orientacja modelu: objętość ze znakiem < 0 – ściany zwrócone do środka; wtedy góra i dolina się zamieniają.
  const objetosc = T.reduce((s, t) => s + skalar(P3[t[0]], iloczyn(P3[t[1]], P3[t[2]])), 0);
  const naZewnatrz = objetosc >= 0;
  // Krawędzie: klucz „a|b” (a < b) → [{ tri, i }] (i – indeks krawędzi w trójkącie: t[i] → t[i+1]).
  const kraw = new Map();
  const kl = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  T.forEach((t, ti) => { for (let i = 0; i < 3; i += 1) { const k = kl(t[i], t[(i + 1) % 3]); (kraw.get(k) || kraw.set(k, []).get(k)).push({ tri: ti, i }); } });
  // Kąt zgięcia (stopnie, 0 – płasko) i kierunek: góra (wypukłe – nadruk na zewnątrz) albo dolina.
  const zgiecieKrawedzi = (k) => {
    const l = kraw.get(k);
    if (!l || l.length !== 2) return null;
    const [a, b] = l;
    const kat = (Math.acos(Math.max(-1, Math.min(1, skalar(N[a.tri], N[b.tri])))) * 180) / Math.PI;
    // Wypukłość: wierzchołek trójkąta b spoza krawędzi leży pod płaszczyzną a → góra.
    const tb = T[b.tri];
    const inny = tb.find((v) => !k.split('|').map(Number).includes(v));
    const d = skalar(N[a.tri], odejmij(P3[inny], P3[T[a.tri][0]]));
    return { kat, rodzaj: (d <= 0) === naZewnatrz ? 'gora' : 'dolina' };
  };

  // Drzewo rozpinające: Prim od największego trójkąta, najpierw krawędzie z najmniejszym kątem zgięcia.
  const pole = (ti) => dlug(iloczyn(odejmij(P3[T[ti][1]], P3[T[ti][0]]), odejmij(P3[T[ti][2]], P3[T[ti][0]]))) / 2;
  const odwiedzone = new Array(T.length).fill(false);
  const pozycja = new Array(T.length).fill(null); // 2D wierzchołków trójkąta (w kolejności t)
  const czesc = new Array(T.length).fill(-1);
  const wyspy = []; // [{ trojkaty: [ti], rodzic: Map(ti → { od, klucz }) }]
  const wolne = () => { let best = -1; for (let i = 0; i < T.length; i += 1) if (!odwiedzone[i] && (best < 0 || pole(i) > pole(best))) best = i; return best; };

  // Położenie trójkąta tb w 2D, gdy jego krawędź (u, w) ma już pozycję pu, pw: trzeci wierzchołek po przeciwnej
  // stronie niż trzeci wierzchołek rodzica.
  function poloz(tb, u, w, pu, pw, strona) {
    const t = T[tb];
    const x = t.find((v) => v !== u && v !== w);
    const du = dlug(odejmij(P3[x], P3[u]));
    const dw = dlug(odejmij(P3[x], P3[w]));
    const l = Math.hypot(pw.x - pu.x, pw.y - pu.y) || 1e-9;
    const a = (du * du - dw * dw + l * l) / (2 * l);
    const h = Math.sqrt(Math.max(0, du * du - a * a));
    const ex = { x: (pw.x - pu.x) / l, y: (pw.y - pu.y) / l };
    const nx = { x: -ex.y, y: ex.x };
    const s = strona > 0 ? -1 : 1;
    const px = { x: pu.x + ex.x * a + nx.x * h * s, y: pu.y + ex.y * a + nx.y * h * s };
    const mapa = { [u]: pu, [w]: pw, [x]: px };
    return t.map((v) => mapa[v]);
  }

  for (let start = wolne(); start >= 0; start = wolne()) {
    const nr = wyspy.length;
    const wyspa = { trojkaty: [start], rodzic: new Map() };
    wyspy.push(wyspa);
    // Pierwszy trójkąt: krawędź t0→t1 na osi x.
    const t = T[start];
    const l01 = dlug(odejmij(P3[t[1]], P3[t[0]]));
    const p0 = { x: 0, y: 0 };
    const p1 = { x: l01, y: 0 };
    pozycja[start] = poloz(start, t[0], t[1], p0, p1, -1);
    odwiedzone[start] = true;
    czesc[start] = nr;
    const kolejka = [];
    const dodajSasiadow = (ti) => {
      for (let i = 0; i < 3; i += 1) {
        const k = kl(T[ti][i], T[ti][(i + 1) % 3]);
        for (const e of kraw.get(k)) if (e.tri !== ti && !odwiedzone[e.tri]) kolejka.push({ od: ti, do: e.tri, klucz: k, kat: zgiecieKrawedzi(k)?.kat ?? 180 });
      }
    };
    dodajSasiadow(start);
    while (kolejka.length) {
      kolejka.sort((a, b) => a.kat - b.kat);
      const { od, do: tb, klucz } = kolejka.shift();
      if (odwiedzone[tb]) continue;
      const [u, w] = klucz.split('|').map(Number);
      const tp = T[od];
      const pu = pozycja[od][tp.indexOf(u)];
      const pw = pozycja[od][tp.indexOf(w)];
      // Strona trzeciego wierzchołka rodzica względem krawędzi – nowy trójkąt idzie na drugą.
      const trzeci = pozycja[od][tp.findIndex((v) => v !== u && v !== w)];
      const strona = Math.sign(orient(pu, pw, trzeci)) || 1;
      const pos = poloz(tb, u, w, pu, pw, strona);
      if (wyspa.trojkaty.some((x) => trojkatyNachodza(pozycja[x], pos))) continue; // nachodzi – zostaje na później
      pozycja[tb] = pos;
      odwiedzone[tb] = true;
      czesc[tb] = nr;
      wyspa.trojkaty.push(tb);
      wyspa.rodzic.set(tb, { od, klucz });
      dodajSasiadow(tb);
    }
  }

  // Krawędzie drzewa (zgięcia w części) i pary dla krawędzi przeciętych (różne części albo nie-drzewo w tej samej).
  const drzewo = new Set();
  for (const w of wyspy) for (const [, r] of w.rodzic) drzewo.add(r.klucz);
  // Krawędź spoza drzewa, której oba trójkąty leżą w tej samej części i po rozłożeniu stykają się tymi samymi
  // punktami (np. środek wachlarza dna walca) – nie jest cięciem: traktujemy ją jak wewnętrzną.
  const blisko = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 0.01;
  for (const [k, l] of kraw) {
    if (l.length !== 2 || drzewo.has(k) || czesc[l[0].tri] !== czesc[l[1].tri] || czesc[l[0].tri] < 0) continue;
    const [u, v] = k.split('|').map(Number);
    const pt = (e, x) => pozycja[e.tri][T[e.tri].indexOf(x)];
    if (blisko(pt(l[0], u), pt(l[1], u)) && blisko(pt(l[0], v), pt(l[1], v))) drzewo.add(k);
  }
  let nrPary = 0;
  const paraKrawedzi = new Map(); // klucz → 'pN'
  const ktoMaZakladke = new Map(); // klucz → tri (pierwszy trójkąt dostaje zakładkę, drugi – do sklejenia)
  for (const [k, l] of kraw) {
    if (l.length === 2 && !drzewo.has(k)) { nrPary += 1; paraKrawedzi.set(k, `p${nrPary}`); ktoMaZakladke.set(k, l[0].tri); }
  }

  const r2 = (v) => Math.round(v * 100) / 100;
  const czesci = wyspy.map((w, iw) => {
    // Obrys: krawędzie skierowane trójkątów, których odwrotności nie ma w części. Kierunek: przeciwnie do ruchu
    // wskazówek (dodatnie pole) – trójkąty mogą mieć różną orientację w 2D, więc kierujemy każdą krawędź tak samo.
    const w2 = new Set(w.trojkaty);
    const brzegi = [];
    for (const ti of w.trojkaty) {
      const t = T[ti];
      const p = pozycja[ti];
      const ccw = orient(p[0], p[1], p[2]) > 0;
      for (let i = 0; i < 3; i += 1) {
        const a = t[i];
        const b = t[(i + 1) % 3];
        const k = kl(a, b);
        const wCzesci = kraw.get(k).some((e) => e.tri !== ti && w2.has(e.tri) && drzewo.has(k));
        if (wCzesci) continue;
        const pa = p[i];
        const pb = p[(i + 1) % 3];
        brzegi.push(ccw ? { a: pa, b: pb, k, ti } : { a: pb, b: pa, k, ti });
      }
    }
    // Łańcuch brzegów w pętlę (po współrzędnych końców).
    const kp = (q) => `${Math.round(q.x * 1000)},${Math.round(q.y * 1000)}`;
    const odPunktu = new Map();
    for (const e of brzegi) (odPunktu.get(kp(e.a)) || odPunktu.set(kp(e.a), []).get(kp(e.a))).push(e);
    const petla = [];
    let e = brzegi[0];
    const uzyte = new Set();
    while (e && !uzyte.has(e)) {
      uzyte.add(e);
      petla.push(e);
      const dalej = (odPunktu.get(kp(e.b)) || []).find((x) => !uzyte.has(x));
      e = dalej;
    }
    const minX = Math.min(...petla.map((x) => x.a.x));
    const minY = Math.min(...petla.map((x) => x.a.y));
    const P = (q) => ({ x: r2(q.x - minX), y: r2(q.y - minY) });
    const punkty = petla.map((x) => P(x.a));
    const krawedzie = petla.map((x) => {
      const para = paraKrawedzi.get(x.k);
      if (!para) return { typ: 'ciecie' };
      return ktoMaZakladke.get(x.k) === x.ti ? { typ: 'zakladka', para, szer: Math.max(2.5, Math.min(7, Math.hypot(x.b.x - x.a.x, x.b.y - x.a.y) * 0.3)) } : { typ: 'klej', para };
    });
    const zgiecia = [];
    for (const [ti, r] of w.rodzic) {
      const z = zgiecieKrawedzi(r.klucz);
      if (!z || z.kat < progZgiecia) continue; // płasko (np. czworokąt podzielony na trójkąty) – bez linii
      const [u, v] = r.klucz.split('|').map(Number);
      const t = T[ti];
      zgiecia.push({ a: P(pozycja[ti][t.indexOf(u)]), b: P(pozycja[ti][t.indexOf(v)]), rodzaj: z.rodzaj, kat: r2(z.kat) });
    }
    // Kolor części (#277): materiał o największej powierzchni w tej części.
    const pola = new Map();
    for (const ti of w.trojkaty) if (kolorT[ti]) pola.set(kolorT[ti], (pola.get(kolorT[ti]) || 0) + pole(ti));
    const kolor = [...pola.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    // Tekstura (#283): obrazek o największej powierzchni w części; trójkąty z położeniem w układzie części i UV.
    const tp = new Map();
    for (const ti of w.trojkaty) if (teksT[ti]) tp.set(teksT[ti], (tp.get(teksT[ti]) || 0) + pole(ti));
    const plik = [...tp.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const tekstura = plik ? {
      plik,
      trojkaty: w.trojkaty.filter((ti) => teksT[ti] === plik).map((ti) => ({ p: pozycja[ti].map((q) => ({ x: q.x - minX, y: q.y - minY })), uv: uvT[ti] })),
    } : null;
    return { nazwa: wyspy.length > 1 ? `${nazwa} – część ${iw + 1}` : nazwa, punkty, krawedzie, zgiecia, ...(kolor ? { kolor } : {}), ...(tekstura ? { tekstura } : {}) };
  });
  return { czesci, trojkatow: T.length, czesciIle: czesci.length };
}

// Przekształcenie afiniczne trójkąta src na trójkąt dst (#283 – malowanie tekstury): [a, b, c, d, e, f] jak
// w ctx.setTransform – punkt (x, y) → (a·x + c·y + e, b·x + d·y + f). null, gdy src jest zdegenerowany.
export function macierzTrojkata(src, dst) {
  const [s0, s1, s2] = src;
  const [d0, d1, d2] = dst;
  const ux = s1.x - s0.x; const uy = s1.y - s0.y; const vx = s2.x - s0.x; const vy = s2.y - s0.y;
  const det = ux * vy - vx * uy;
  if (Math.abs(det) < 1e-12) return null;
  const px = d1.x - d0.x; const py = d1.y - d0.y; const qx = d2.x - d0.x; const qy = d2.y - d0.y;
  // A = D · S⁻¹, S = [[ux, vx], [uy, vy]], D = [[px, qx], [py, qy]].
  const a = (px * vy - qx * uy) / det;
  const c = (qx * ux - px * vx) / det;
  const b = (py * vy - qy * uy) / det;
  const d = (qy * ux - py * vx) / det;
  return [a, b, c, d, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - d * s0.y];
}
