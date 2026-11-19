// Ręczne dzielenie części (#274): „Rozetnij” – linia od krawędzi do krawędzi dzieli część na dwie; krawędzie
// zachowują rodzaj i parę, na linii cięcia para zakładka ↔ do sklejenia, zgięcia trafiają do właściwej części.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('rozetnijCzesc: pas 100 × 40 ze zgięciami co 25 mm, cięcie w x = 60', async () => {
  globalThis.fabric = globalThis.fabric || {};
  const K = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'skladanka.js')).href);
  const c = K.normalizujCzesc({
    nr: 'A',
    punkty: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 0, y: 40 }],
    krawedzie: [{ typ: 'ciecie' }, { typ: 'zakladka', para: '3', szer: 7 }, { typ: 'ciecie' }, { typ: 'klej', para: '3' }],
    zgiecia: [25, 50, 75].map((x) => ({ a: { x, y: 0 }, b: { x, y: 40 }, rodzaj: 'gora', kat: 90 })),
    pola: [{ x: 80, y: 10, w: 10, h: 10, para: '4' }],
  });
  const w = K.rozetnijCzesc(c, { x: 60, y: 0 }, { x: 60, y: 40 }, '9');
  assert.ok(w);
  const [l, p] = w.map((x) => ({ ...x, xs: x.punkty.map((q) => q.x) }));
  // Jedna część od 0 do 60, druga od 60 do 100 (kolejność dowolna).
  const lewa = Math.max(...l.xs) <= 60.01 ? l : p;
  const prawa = lewa === l ? p : l;
  assert.deepEqual([Math.min(...lewa.xs), Math.max(...lewa.xs), Math.min(...prawa.xs), Math.max(...prawa.xs)], [0, 60, 60, 100]);
  assert.deepEqual(lewa.zgiecia.map((z) => z.a.x).sort((a, b) => a - b), [25, 50]);
  assert.deepEqual(prawa.zgiecia.map((z) => z.a.x), [75]);
  // Para cięcia: zakładka w jednej, do sklejenia w drugiej; dawna para 3 zostaje na swoich krawędziach.
  const typy = (x, para) => x.krawedzie.filter((k) => k.para === para).map((k) => k.typ);
  assert.deepEqual([...typy(l, '9'), ...typy(p, '9')].sort(), ['klej', 'zakladka']);
  assert.deepEqual(typy(prawa, '3'), ['zakladka'], 'prawa krawędź z zakładką 3');
  assert.deepEqual(typy(lewa, '3'), ['klej'], 'lewa krawędź do sklejenia 3');
  assert.equal(prawa.pola.length, 1, 'pole klejenia w prawej części');
  assert.equal(lewa.pola.length, 0);
  // Zgięcie skośne przez linię cięcia – przycięte do niej.
  const c2 = K.normalizujCzesc({ ...c, zgiecia: [{ a: { x: 40, y: 0 }, b: { x: 80, y: 40 }, rodzaj: 'gora', kat: 90 }] });
  const [a1, a2] = K.rozetnijCzesc(c2, { x: 60, y: 0 }, { x: 60, y: 40 }, '9');
  const konce = [...a1.zgiecia, ...a2.zgiecia].flatMap((z) => [z.a.x, z.b.x]);
  assert.ok(konce.filter((x) => Math.abs(x - 60) < 0.01).length === 2, `zgięcie przycięte do cięcia: ${konce}`);
  // Linia, która nie dzieli (po krawędzi) – null.
  assert.equal(K.rozetnijCzesc(c, { x: 0, y: 0 }, { x: 100, y: 0 }, '9'), null);
});

const { otworz, nowyProjekt } = require('./pomoc.cjs');
test('narzędzie Rozetnij w aplikacji: dwa kliknięcia na krawędziach – dwie części z parą', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Rozcinanie');
  await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A4', orientacja: 'pozioma', material: 'karton', gramatura: 300, druk: 'ploter' } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
    const n = await import('./js/app/skladanka-narzedzia.js');
    n.wstawCzesci([{ nazwa: 'Pas', punkty: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 0, y: 40 }], krawedzie: [{ typ: 'ciecie' }, { typ: 'ciecie' }, { typ: 'ciecie' }, { typ: 'ciecie' }], zgiecia: [] }]);
    n.ustawNarzedzie('rozetnij');
  });
  const kliknij = async (x, y) => {
    const p = await strona.evaluate(([mx, my]) => {
      const e = window.seriodruk.edytor;
      const g = e.canvas.getObjects().find((o) => o.czesc);
      const r0 = g.getBoundingRect();
      const v = e.canvas.viewportTransform;
      const r = e.canvas.upperCanvasEl.getBoundingClientRect();
      // Część (bez zakładek) zaczyna się w lewym górnym rogu ramki grupy.
      return { x: r.left + (r0.left + mx) * v[0] + v[4], y: r.top + (r0.top + my) * v[3] + v[5] };
    }, [x, y]);
    await strona.mouse.click(p.x, p.y);
  };
  await kliknij(60, 0.2);
  await kliknij(60, 39.8);
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.czesc).length === 2);
  const czesci = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.czesc).map((o) => [o.czesc.nr, o.czesc.krawedzie.filter((k) => k.para).map((k) => k.typ).join()]));
  assert.deepEqual(czesci.map((c) => c[0]).sort(), ['A', 'B']);
  assert.deepEqual(czesci.map((c) => c[1]).sort(), ['klej', 'zakladka']);
  assert.deepEqual(bledy, []);
});

// Scalenie (#275): odwrotność rozcięcia – dwa kwadraty po parze w jeden prostokąt ze zgięciem; nachodzenie – odmowa.
test('scalCzesci: dwa kwadraty po parze 5 → prostokąt 80 × 40 ze zgięciem; rozcięty pas scala się z powrotem', async () => {
  globalThis.fabric = globalThis.fabric || {};
  const K = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'skladanka.js')).href);
  const kw = (x0, y0, kr) => K.normalizujCzesc({ nr: 'X', punkty: [{ x: x0, y: y0 }, { x: x0 + 40, y: y0 }, { x: x0 + 40, y: y0 + 40 }, { x: x0, y: y0 + 40 }], krawedzie: kr, zgiecia: [] });
  const c1 = kw(0, 0, [{ typ: 'ciecie' }, { typ: 'zakladka', para: '5', szer: 7 }, { typ: 'ciecie' }, { typ: 'ciecie' }]);
  const c2 = kw(300, 120, [{ typ: 'ciecie' }, { typ: 'ciecie' }, { typ: 'ciecie' }, { typ: 'klej', para: '5' }]);
  const w = K.scalCzesci(c1, 1, c2, 3);
  assert.ok(w);
  const xs = w.punkty.map((q) => q.x);
  const ys = w.punkty.map((q) => q.y);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [0, 80, 0, 40]);
  assert.equal(w.krawedzie.filter((k) => k.para === '5').length, 0, 'para zniknęła');
  assert.equal(w.punkty.length, w.krawedzie.length);
  assert.deepEqual(w.zgiecia.map((z) => [z.a.x, z.b.x]), [[40, 40]], 'zgięcie w miejscu pary');
  // Rozcięty pas wraca do jednej części.
  const pas = K.normalizujCzesc({ nr: 'A', punkty: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 0, y: 40 }], krawedzie: Array(4).fill({ typ: 'ciecie' }), zgiecia: [] });
  const [r1, r2] = K.rozetnijCzesc(pas, { x: 60, y: 0 }, { x: 60, y: 40 }, '9').map((x) => K.normalizujCzesc({ nr: 'A', ...x }));
  const i1 = r1.krawedzie.findIndex((k) => k.para === '9');
  const i2 = r2.krawedzie.findIndex((k) => k.para === '9');
  const z = K.scalCzesci(r1, i1, r2, i2);
  assert.ok(z && Math.abs(Math.abs(K.poleWielokata(z.punkty)) - 4000) < 1, 'pole jak przed rozcięciem');
  // Część z ramieniem, na które druga weszłaby po złączeniu – odmowa (ten sam obieg, ta sama długość krawędzi).
  const zRamieniem = K.normalizujCzesc({ nr: 'R', punkty: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }, { x: 80, y: 30 }, { x: 80, y: 40 }, { x: 0, y: 40 }], krawedzie: [{ typ: 'ciecie' }, { typ: 'zakladka', para: '6', szer: 7 }, ...Array(4).fill({ typ: 'ciecie' })], zgiecia: [] });
  const wysoka = K.normalizujCzesc({ nr: 'W', punkty: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 45 }, { x: 10, y: 45 }, { x: 10, y: 30 }, { x: 0, y: 30 }], krawedzie: [...Array(5).fill({ typ: 'ciecie' }), { typ: 'klej', para: '6' }], zgiecia: [] });
  assert.equal(Math.sign(K.poleWielokata(zRamieniem.punkty)), Math.sign(K.poleWielokata(wysoka.punkty)), 'ten sam obieg');
  assert.equal(K.scalCzesci(zRamieniem, 1, wysoka, 5), null, 'nachodzenie – odmowa');
  // Bez ramienia ta sama para się scala.
  const bez = K.normalizujCzesc({ ...zRamieniem, punkty: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }, { x: 40, y: 40 }, { x: 0, y: 40 }], krawedzie: [{ typ: 'ciecie' }, { typ: 'zakladka', para: '6', szer: 7 }, ...Array(3).fill({ typ: 'ciecie' })] });
  assert.ok(K.scalCzesci(bez, 1, wysoka, 5), 'bez ramienia – scala');
});
