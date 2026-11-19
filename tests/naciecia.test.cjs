// Nacięcia w edytorze (#297, plan składanek krok 17): linia cięcia w środku części albo od krawędzi, pod dowolnym
// kątem (dwa kliknięcia) albo z narysowanej linii / krzywej (jedno nacięcie z wielu odcinków). Ze zgięciami dzieli
// ścianę – skośna klapka staje się osobną ścianą na zawiasie. Kontrola: nacięcie poza częścią.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('Nacięcie: skośne klikami, krzywe z pióra, klapka na zawiasie, kontrola i instrukcja', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Nacięcia');
  await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A4', orientacja: 'pozioma', material: 'karton', gramatura: 300, druk: 'domowy' } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
    const n = await import('./js/app/skladanka-narzedzia.js');
    n.wstawCzesci([{ nazwa: 'Kartka', punkty: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }], krawedzie: Array(4).fill({ typ: 'ciecie' }), zgiecia: [{ a: { x: 30, y: 10 }, b: { x: 30, y: 50 }, rodzaj: 'gora', kat: 90 }] }]);
  });
  const kliknij = async (x, y) => {
    const p = await strona.evaluate(async ([mx, my]) => {
      const S = await import('./js/skladanka.js');
      const e = window.seriodruk.edytor;
      const g = e.canvas.getObjects().find((o) => o.czesc);
      const q = S.zUkladuCzesci(g, { x: mx, y: my });
      const v = e.canvas.viewportTransform;
      const r = e.canvas.upperCanvasEl.getBoundingClientRect();
      return { x: r.left + q.x * v[0] + v[4], y: r.top + q.y * v[3] + v[5] };
    }, [x, y]);
    await strona.mouse.click(p.x, p.y);
  };
  // Dwa skośne nacięcia od końców zgięcia do wspólnego wierzchołka – trójkątna klapka.
  await strona.click('[data-akcja="skladanka-naciecie"]');
  await kliknij(30, 10);
  await kliknij(55, 30);
  await kliknij(55, 30);
  await kliknij(30, 50);
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.czesc).czesc.szczeliny.filter((z) => z.naciecie).length === 2);
  await strona.evaluate(async () => (await import('./js/app/skladanka-narzedzia.js')).ustawNarzedzie(null));
  // Krzywa z pióra na części → jedno nacięcie z wielu odcinków.
  await strona.evaluate(async () => {
    const S = await import('./js/skladanka.js');
    const e = window.seriodruk.edytor;
    const g = e.canvas.getObjects().find((o) => o.czesc);
    const a = S.zUkladuCzesci(g, { x: 65, y: 45 });
    const b = S.zUkladuCzesci(g, { x: 90, y: 45 });
    const sc = new fabric.Path(`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${a.y - 15} ${b.x} ${b.y}`, { fill: null, stroke: '#000', strokeWidth: 0.3 });
    e.canvas.add(sc);
    e.canvas.setActiveObject(sc);
  });
  await strona.click('[data-akcja="skladanka-naciecie"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.czesc).czesc.szczeliny.filter((z) => z.naciecie).length > 3);
  const w = await strona.evaluate(async () => {
    const S = await import('./js/skladanka.js');
    const e = window.seriodruk.edytor;
    const g = e.canvas.getObjects().find((o) => o.czesc);
    const c = S.normalizujCzesc(g.czesc);
    const nac = c.szczeliny.filter((z) => z.naciecie);
    const ciagi = new Set(nac.filter((z) => z.ciag).map((z) => z.ciag));
    const { sciany, zawiasy } = S.scianyCzesci({ ...c, szczeliny: nac.filter((z) => !z.ciag) });
    const pola = sciany.map((s) => Math.round(Math.abs(S.poleWielokata(s))));
    // Kontrola: nacięcie wychodzące poza część.
    const zle = S.normalizujCzesc({ ...c, szczeliny: [...c.szczeliny, { a: { x: 90, y: 10 }, b: { x: 130, y: 10 }, szer: 0.2, naciecie: true }] });
    const o = { id: 'x', type: 'group', czesc: zle, left: 10, top: 10, width: 100, height: 60 };
    const uwagi = S.uwagiSkladanki([{ nr: 1, strona: { id: 's', obiekty: [o] }, w: 400, h: 300, margines: 0, grubosc: 0.4 }]).map((u) => u.opis);
    await window.seriodruk.zapiszTeraz();
    const p = window.seriodruk.stan.projekt;
    return {
      skosne: nac.filter((z) => !z.ciag).map((z) => (Math.atan2(z.b.y - z.a.y, z.b.x - z.a.x) * 180) / Math.PI),
      ciagi: ciagi.size, odcinkiKrzywej: nac.filter((z) => z.ciag).length,
      pola: pola.sort((a, b) => a - b), zawiasy: zawiasy.length,
      uwagi, panel: [...document.querySelectorAll('#wlasciwosci .zwijak, #wlasciwosci h3, #wlasciwosci legend')].map((x) => x.textContent).filter((x) => /Nacięcia/.test(x)).length,
      instrukcja: S.instrukcjaMontazu(p.strony.filter((s) => s.sekcja === p.sekcje[0].id), p.sekcje[0].specjalna).kroki.join(' '),
      sciezek: e.canvas.getObjects().filter((x) => x.type === 'path' && !x.czesc).length,
    };
  });
  assert.ok(w.skosne.every((k) => Math.abs(Math.min(Math.abs(k), 180 - Math.abs(k)) - 38.66) < 1.5), `nacięcia pod skosem (38,7° do poziomu): ${w.skosne}`);
  assert.equal(w.ciagi, 1, 'krzywa – jedno nacięcie');
  assert.ok(w.odcinkiKrzywej >= 4, `krzywa z wielu odcinków (${w.odcinkiKrzywej})`);
  // Trójkątna klapka: ok. 25 mm × 40 mm / 2 = 500 mm² (wierzchołek ze zwykłego kliknięcia), reszta kartki – ściana
  // o obrysie całej kartki (klapka w niej jak w otworze); połączone zawiasem (zgięciem).
  assert.ok(Math.abs(w.pola[0] - 500) < 15 && w.pola[1] === 6000, `pola ścian: ${w.pola}`);
  assert.equal(w.zawiasy, 1);
  assert.ok(w.uwagi.some((u) => /Nacięcie na części .* wychodzi poza część/.test(u)), JSON.stringify(w.uwagi));
  assert.match(w.instrukcja, /Nacięcia \(także skośne i krzywe w środku części\) przetnij nożykiem/);
  assert.equal(w.sciezek, 0, 'krzywa z pióra stała się nacięciem');
  assert.deepEqual(bledy, []);
});
