// Kadry komiksu (#362, plan komiksu B2): geometria siatki kadrów z rynną (stały odstęp między kadrami), podział kadru
// linią (także ukośną), kadry na spad. Kadr to wielokąt (polygon) z polem `kadr` (numer w kolejności czytania) – może
// być ramką obrazu jak każdy kształt (obraz_kadr, #123), a obraz może wychodzić poza kadr (zwykły obraz nad nim).
// Wszystkie wymiary w mm, punkty w układzie strony.

const zaokr = (v) => Math.round(v * 100) / 100;

// Siatka: wiersze = [[1, 2], [1], [1, 1, 1]] – w każdym wierszu proporcje szerokości kadrów; wysokości wierszy
// równe albo z `wysokosci` (proporcje). Obszar { x, y, w, h }, rynna w mm. Zwraca listę wielokątów [[{x,y}…]].
export function siatkaKadrow(obszar, wiersze, rynna = 4, wysokosci = null) {
  const wys = wysokosci || wiersze.map(() => 1);
  const sumaW = wys.reduce((a, b) => a + b, 0);
  const wolnaH = obszar.h - rynna * (wiersze.length - 1);
  const kadry = [];
  let y = obszar.y;
  wiersze.forEach((wiersz, i) => {
    const h = (wolnaH * wys[i]) / sumaW;
    const suma = wiersz.reduce((a, b) => a + b, 0);
    const wolnaW = obszar.w - rynna * (wiersz.length - 1);
    let x = obszar.x;
    for (const p of wiersz) {
      const w = (wolnaW * p) / suma;
      kadry.push([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }].map((q) => ({ x: zaokr(q.x), y: zaokr(q.y) })));
      x += w + rynna;
    }
    y += h + rynna;
  });
  return kadry;
}

// Strona po której stronie prostej a→b leży punkt (znak iloczynu wektorowego).
const strona = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

// Przecięcie wielokąta wypukłego półpłaszczyzną strona(a, b, p) ≥ 0 przesuniętą o d (Sutherland–Hodgman).
function przytnij(punkty, a, b, d) {
  const dl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const f = (p) => strona(a, b, p) / dl - d;
  const wynik = [];
  for (let i = 0; i < punkty.length; i += 1) {
    const p = punkty[i]; const q = punkty[(i + 1) % punkty.length];
    const fp = f(p); const fq = f(q);
    if (fp >= 0) wynik.push(p);
    if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); wynik.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
  }
  return wynik.map((p) => ({ x: zaokr(p.x), y: zaokr(p.y) }));
}

// Podział kadru (wielokąt wypukły) prostą przez punkty a i b – dwa kadry z rynną (pół rynny po każdej stronie linii).
// Zwraca [kadr po lewej stronie linii a→b, kadr po prawej] albo null, gdy linia nie przecina kadru.
export function podzielKadr(punkty, a, b, rynna = 4) {
  const lewa = przytnij(punkty, a, b, rynna / 2);
  const prawa = przytnij(punkty, b, a, rynna / 2);
  if (lewa.length < 3 || prawa.length < 3) return null;
  return [lewa, prawa];
}

// Kadr na spad: brzegi leżące na krawędzi obszaru stron (w marginesach) przesunięte do krawędzi spadu.
// strona { w, h } – format netto, spad w mm, obszar – obszar kadrów (w marginesach), tol – tolerancja.
export function naSpad(punkty, obszar, strona, spad, tol = 0.5) {
  return punkty.map((p) => ({
    x: Math.abs(p.x - obszar.x) <= tol ? -spad : (Math.abs(p.x - (obszar.x + obszar.w)) <= tol ? strona.w + spad : p.x),
    y: Math.abs(p.y - obszar.y) <= tol ? -spad : (Math.abs(p.y - (obszar.y + obszar.h)) <= tol ? strona.h + spad : p.y),
  }));
}

// Kolejność czytania: od góry (wiersze z tolerancją), w wierszu od lewej.
export function numerujKadry(kadry) {
  const srodek = (k) => ({ x: k.reduce((a, p) => a + p.x, 0) / k.length, y: k.reduce((a, p) => a + p.y, 0) / k.length, gora: Math.min(...k.map((p) => p.y)) });
  return kadry.map((k) => ({ k, s: srodek(k) }))
    .sort((a, b) => (Math.abs(a.s.gora - b.s.gora) > 5 ? a.s.gora - b.s.gora : a.s.x - b.s.x))
    .map((x) => x.k);
}

// Element kadru do zapisu strony (polygon Fabric: punkty względem lewego górnego rogu, left/top = ten róg).
export function elementKadru(punkty, nr, { id, obrys = '#1a1a1a', grubosc = 0.6, tlo = '#ffffff' } = {}) {
  const minX = Math.min(...punkty.map((p) => p.x)); const minY = Math.min(...punkty.map((p) => p.y));
  const maxX = Math.max(...punkty.map((p) => p.x)); const maxY = Math.max(...punkty.map((p) => p.y));
  return {
    type: 'polygon', id, left: minX, top: minY, width: zaokr(maxX - minX), height: zaokr(maxY - minY),
    points: punkty.map((p) => ({ x: zaokr(p.x - minX), y: zaokr(p.y - minY) })),
    fill: tlo, stroke: obrys, strokeWidth: grubosc, strokeUniform: true, strokeLineJoin: 'miter',
    kadr: nr, nazwa: `Kadr ${nr}`,
  };
}
