// Sklejony model w 3D (#286, plan składanek krok 12): części ustawiają się po parach. Krawędź do prostej linii
// klejenia – część staje prostopadle; do krzywej – wygina się wzdłuż niej; krawędź do krawędzi – sklejenie na
// płasko albo pod kątem wynikającym z innych par.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('sklejony model: linia prosta – stoi, krzywa – zawija się, krawędzie – przedłużenie i pudełko z części', async (t) => {
  const { strona, bledy } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const K = await import('./js/skladanka.js');
    const M = await import('./js/makieta-3d.js');
    const pr = (x, y) => [{ x: 0, y: 0 }, { x, y: 0 }, { x, y }, { x: 0, y }];
    const kr = (...t) => t.map((x) => (typeof x === 'string' ? { typ: 'ciecie' } : x));
    // Części na arkuszu jedna pod drugą (bez obrotu); u = 2 – sklejony model.
    const scena = (defs, u = 2) => {
      let y0 = 10;
      const czesci = defs.map((d, i) => {
        const n = K.normalizujCzesc({ nr: String.fromCharCode(65 + i), ...d });
        const r = K.ramkaCzesci(n);
        const uklad = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
        const o = { left: 20 + r.x, top: y0 + r.y, width: r.w, height: r.h, angle: 0, originX: 'left', originY: 'top', czesc: { ...n, uklad } };
        y0 += r.h + 15;
        return { arkusz: 0, czesc: o.czesc, obiekt: o };
      });
      const kartki = M.kartkiModelu('skladanka', { strony: 1, specjalna: { grubosc_mm: 0.2, wynik: { szerokosc: 420, wysokosc: 600 }, czesci } });
      const q = M.scena('skladanka', kartki, u).filter((x) => x.mat === 'okladka');
      const pkt = (nr) => q.filter((x) => x.czesc === nr).flatMap((x) => x.p);
      return { pkt, opis: M.opisPolozenia('skladanka', kartki, 2) };
    };
    // Odległość punktów od płaszczyzny podstawy (wyznaczonej z jej punktów) i ich zakres.
    const plaszczyzna = (pk) => {
      const [a, b] = [pk[0], pk.find((p) => Math.hypot(p[0] - pk[0][0], p[1] - pk[0][1], p[2] - pk[0][2]) > 10)];
      const c = pk.find((p) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const v = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > 50; });
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n);
      return (p) => Math.abs((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] + (p[2] - a[2]) * n[2]) / l;
    };
    const zakres = (pk, f) => { const d = pk.map(f); return [Math.min(...d), Math.max(...d)]; };
    // 1. Klapka 40 × 20 na prostej linii (40 mm) w środku podstawy – stoi prostopadle, wysoka na 20 mm.
    const s1 = scena([
      { punkty: pr(100, 60), krawedzie: kr('c', 'c', 'c', 'c'), zgiecia: [], linie: [{ punkty: [{ x: 30, y: 20 }, { x: 70, y: 20 }], para: '1' }] },
      { punkty: pr(40, 20), krawedzie: kr('c', 'c', { typ: 'zakladka', para: '1', szer: 5 }, 'c'), zgiecia: [] },
    ]);
    const odPodstawy1 = plaszczyzna(s1.pkt('A'));
    const klapka = zakres(s1.pkt('B'), odPodstawy1);
    // 2. Pasek o długości łuku na krzywej linii – dół na podstawie, góra 15 mm nad nią, ślad wygięty (nie prosty).
    const luk = K.punktyLuku({ x: 20, y: 45 }, { x: 50, y: 25 }, { x: 80, y: 45 }, 24);
    const dlLuku = K.dlugoscLinii({ punkty: luk });
    const s2 = scena([
      { punkty: pr(100, 60), krawedzie: kr('c', 'c', 'c', 'c'), zgiecia: [], linie: [{ punkty: luk, para: '2' }] },
      { punkty: pr(dlLuku, 15), krawedzie: kr('c', 'c', { typ: 'zakladka', para: '2', szer: 5 }, 'c'), zgiecia: [] },
    ]);
    const odPodstawy2 = plaszczyzna(s2.pkt('A'));
    const pasek = s2.pkt('B');
    const pasekZakres = zakres(pasek, odPodstawy2);
    const dol = pasek.filter((p) => odPodstawy2(p) < 1);
    const rozpietosc = Math.max(...dol.map((p) => Math.max(...dol.map((r) => Math.hypot(p[0] - r[0], p[1] - r[1], p[2] - r[2])))));
    // 3. Rozcięty pas 100 × 40 (60 + 40) sklejony krawędziami – przedłużenie na płasko (100 mm długości).
    const s3 = scena([
      { punkty: pr(60, 40), krawedzie: kr('c', { typ: 'zakladka', para: '3', szer: 6 }, 'c', 'c'), zgiecia: [] },
      { punkty: pr(40, 40), krawedzie: kr('c', 'c', 'c', { typ: 'klej', para: '3' }), zgiecia: [] },
    ]);
    const wszystkie3 = [...s3.pkt('A'), ...s3.pkt('B')];
    const plaski = zakres(wszystkie3, plaszczyzna(s3.pkt('A')));
    const dlugosc3 = Math.max(...wszystkie3.map((p) => Math.max(...wszystkie3.map((r) => Math.hypot(p[0] - r[0], p[1] - r[1], p[2] - r[2])))));
    // 4. Pudełko z dwóch części: dno ze ściankami (krzyż 40 × 40, ścianki 20, bez czwartej) i osobna czwarta
    // ścianka 40 × 20 doklejona trzema krawędziami – musi stanąć pionowo (zgodność trzech par).
    const krzyz = [{ x: 20, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 60 }, { x: 60, y: 60 }, { x: 60, y: 80 }, { x: 20, y: 80 }, { x: 20, y: 60 }, { x: 20, y: 20 }];
    const s4 = scena([
      {
        punkty: krzyz,
        // Brak lewej ścianki: lewy brzeg dna (krawędź 8) i lewe boki ścianek przedniej i tylnej (7, 9) czekają na nią.
        krawedzie: kr('c', 'c', 'c', 'c', 'c', 'c', 'c', { typ: 'zakladka', para: '5', szer: 5 }, { typ: 'klej', para: '4' }, { typ: 'zakladka', para: '6', szer: 5 }),
        zgiecia: [{ a: { x: 20, y: 20 }, b: { x: 60, y: 20 }, rodzaj: 'gora', kat: 90 }, { a: { x: 60, y: 20 }, b: { x: 60, y: 60 }, rodzaj: 'gora', kat: 90 }, { a: { x: 20, y: 60 }, b: { x: 60, y: 60 }, rodzaj: 'gora', kat: 90 }],
      },
      { punkty: pr(40, 20), krawedzie: kr({ typ: 'zakladka', para: '4', szer: 5 }, { typ: 'klej', para: '6' }, 'c', { typ: 'klej', para: '5' }), zgiecia: [] },
    ]);
    const pud = [...s4.pkt('A'), ...s4.pkt('B')];
    const wym = [0, 1, 2].map((i) => Math.round(Math.max(...pud.map((p) => p[i])) - Math.min(...pud.map((p) => p[i]))));
    return { klapka, pasekZakres, rozpietosc, dlLuku, plaski, dlugosc3, wym, opis: s1.opis };
  });
  assert.equal(w.opis, 'Sklejony model');
  assert.ok(w.klapka[0] < 0.5 && Math.abs(w.klapka[1] - 20) < 0.6, `klapka stoi: ${w.klapka}`);
  assert.ok(w.pasekZakres[0] < 0.5 && Math.abs(w.pasekZakres[1] - 15) < 0.6, `pasek stoi na krzywej: ${w.pasekZakres}`);
  assert.ok(w.rozpietosc < w.dlLuku - 3 && Math.abs(w.rozpietosc - 60) < 1.5, `pasek wygięty po łuku (cięciwa 60, długość ${w.dlLuku}): ${w.rozpietosc}`);
  assert.ok(w.plaski[1] < 0.6, `rozcięty pas sklejony na płasko: ${w.plaski}`);
  assert.ok(Math.abs(w.dlugosc3 - Math.hypot(100, 40)) < 1, `przekątna 100 × 40: ${w.dlugosc3}`);
  assert.deepEqual([...w.wym].sort((a, b) => a - b), [20, 40, 40], `pudełko 40 × 40 × 20 z dwóch części: ${w.wym}`);
  assert.deepEqual(bledy, []);
});
