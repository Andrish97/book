// Wycięcia (#298, plan składanek krok 18): kawałek otoczony samymi nacięciami (bez zgięcia) wypada – w 3D go nie ma,
// a ściana wokół ma otwór; drzwiczki (trzy boki nacięte, czwarty zgięty) odchylają się na zawiasie i zostawiają
// otwór. Narzędzie [Wycięcie] robi otwór z zaznaczonego zamkniętego kształtu.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('Wycięcie: otwór wypada, drzwiczki na zawiasie, 3D z dziurą, narzędzie [Wycięcie]', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  const w = await strona.evaluate(async () => {
    const S = await import('./js/skladanka.js');
    const M = await import('./js/makieta-3d.js');
    const pr = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }];
    const kw = [{ x: 40, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 40 }, { x: 40, y: 40 }];
    const odcinki = (pk, zamk) => (zamk ? [...pk, pk[0]] : pk).slice(1).map((b, i, t2) => ({ a: (zamk ? [...pk, pk[0]] : pk)[i], b, szer: 0.2, naciecie: true, ciag: 'x' }));
    const kartka = (szczeliny, zgiecia = []) => S.normalizujCzesc({ nr: 'A', punkty: pr, krawedzie: Array(4).fill({ typ: 'ciecie' }), zgiecia, szczeliny });
    const otwor = kartka(odcinki(kw, true));
    const drzwiczki = kartka(odcinki([kw[3], kw[0], kw[1], kw[2]], false), [{ a: kw[2], b: kw[3], rodzaj: 'gora', kat: 90 }]);
    const s1 = S.scianyCzesci(otwor);
    const s2 = S.scianyCzesci(drzwiczki);
    // Pole przedniej strony w 3D (płasko, u = 0): suma trójkątów czworokątów z nadrukiem.
    const pole3d = (c) => {
      const r = S.ramkaCzesci(c);
      const uklad = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      const o = { left: 20 + r.x, top: 20 + r.y, width: r.w, height: r.h, angle: 0, originX: 'left', originY: 'top', czesc: { ...c, uklad } };
      const kartki = M.kartkiModelu('skladanka', { strony: 1, specjalna: { grubosc_mm: 0.2, wynik: { szerokosc: 300, wysokosc: 200 }, czesci: [{ arkusz: 0, czesc: o.czesc, obiekt: o }] } });
      const q = M.scena('skladanka', kartki, 0).filter((x) => x.mat === 'okladka');
      const tr = (a, b, d) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; };
      return Math.round(q.reduce((s, x) => s + tr(x.p[0], x.p[1], x.p[2]), 0));
    };
    return {
      otwor: { sciany: s1.sciany.length, odpady: s1.odpady.length, otwory: s1.otwory.length, pole3d: pole3d(otwor) },
      drzwiczki: { sciany: s2.sciany.length, odpady: s2.odpady.length, otwory: s2.otwory.length, zawiasy: s2.zawiasy.length },
      zwykla: pole3d(kartka([])),
    };
  });
  assert.deepEqual(w.otwor, { sciany: 2, odpady: 1, otwory: 1, pole3d: 5600 }, 'kwadrat 20 × 20 wypada – w 3D 6000 − 400');
  assert.deepEqual(w.drzwiczki, { sciany: 2, odpady: 0, otwory: 1, zawiasy: 1 }, 'drzwiczki na zawiasie');
  assert.equal(w.zwykla, 6000);

  // Narzędzie [Wycięcie] w edytorze: prostokąt na części → zamknięte nacięcie, odpad z kreskowaniem.
  await nowyProjekt(strona, 'Wycięcia');
  const e = await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A4', orientacja: 'pozioma', material: 'karton', gramatura: 300, druk: 'domowy' } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
    const n = await import('./js/app/skladanka-narzedzia.js');
    const S = await import('./js/skladanka.js');
    n.wstawCzesci([{ nazwa: 'Okno', punkty: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }], krawedzie: Array(4).fill({ typ: 'ciecie' }), zgiecia: [] }]);
    const ed = window.seriodruk.edytor;
    const g = ed.canvas.getObjects().find((o) => o.czesc);
    const sr = S.zUkladuCzesci(g, { x: 50, y: 30 });
    const r = ed.dodajProstokat();
    r.set({ width: 20, height: 16, originX: 'center', originY: 'center', left: sr.x, top: sr.y, angle: 0 });
    r.setCoords();
    ed.canvas.setActiveObject(r);
  });
  await strona.click('[data-akcja="skladanka-wyciecie"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.czesc).czesc.szczeliny?.length >= 4);
  const ed = await strona.evaluate(() => {
    const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.czesc);
    return {
      ciagi: new Set(g.czesc.szczeliny.map((z) => z.ciag)).size,
      odpad: g.getObjects().filter((o) => o.skladanka === 'odpad').length,
      prostokatow: window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'rect' && !o.czesc).length,
    };
  });
  assert.deepEqual(ed, { ciagi: 1, odpad: 1, prostokatow: 0 });
  assert.deepEqual(bledy, []);
});
