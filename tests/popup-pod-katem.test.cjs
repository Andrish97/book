// Elementy pod kątem z dowolnej części (#301, plan składanek krok 21): część przyklejona do dwóch skośnych linii
// klejenia po obu stronach grzbietu (uogólnienie zgięcia V – bez szablonu, z linii narysowanych na kartce) staje
// pod kątem wynikającym z geometrii. Panel podpowiada kąt linii do grzbietu, a przy części – kąt przy otwarciu 90°,
// zasięg i czy po zamknięciu coś wystaje.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const tekstPanelu = (strona) => strona.evaluate(() => document.querySelector('#wlasciwosci').textContent.replace(/\s+/g, ' '));

test('Pop-up: część na skośnych liniach klejenia staje pod kątem, podpowiedzi w panelu', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Pod kątem');
  const w = await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A3', orientacja: 'pozioma', material: 'karton', gramatura: 300, druk: 'domowy' } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
    const n = await import('./js/app/skladanka-narzedzia.js');
    const M = await import('./js/makieta-3d.js');
    const out = {};
    for (const a of [30, 60]) {
      const e = window.seriodruk.edytor;
      for (const o of e.canvas.getObjects().filter((x) => x.czesc)) e.canvas.remove(o);
      const r = (a * Math.PI) / 180; const g = 50; const yP = 110; const S = 100;
      const sx = Math.sin(r); const cy = Math.cos(r);
      n.wstawCzesci([
        { nazwa: 'Kartka', punkty: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 140 }, { x: 0, y: 140 }], krawedzie: Array(4).fill({ typ: 'ciecie' }), zgiecia: [{ a: { x: S, y: 0 }, b: { x: S, y: 140 }, rodzaj: 'dolina', kat: 90, grzbiet: true }],
          linie: [{ punkty: [{ x: S - g * sx, y: yP - g * cy }, { x: S, y: yP }], para: 'l' }, { punkty: [{ x: S, y: yP }, { x: S + g * sx, y: yP - g * cy }], para: 'p' }] },
        { nazwa: 'Trójkąt', punkty: [{ x: 0, y: 0 }, { x: 2 * g * sx, y: 0 }, { x: g * sx, y: g * cy }], krawedzie: [{ typ: 'ciecie' }, { typ: 'zakladka', para: 'p', szer: 8 }, { typ: 'zakladka', para: 'l', szer: 8 }], zgiecia: [{ a: { x: g * sx, y: g * cy }, b: { x: g * sx, y: 0 }, rodzaj: 'gora', kat: 90 }] },
      ]);
      const grupy = e.canvas.getObjects().filter((x) => x.czesc);
      const czesci = grupy.map((x) => ({ arkusz: 0, czesc: x.czesc, obiekt: x }));
      out[a] = { ...M.podpowiedzPopup(czesci, 1), uwagi: M.sprawdzPopup(czesci).wystaje.length };
    }
    return out;
  });
  // Kąt części do kartki wynika z kąta linii do grzbietu (większy kąt linii – trójkąt bardziej odchylony od kartki).
  for (const a of [30, 60]) {
    assert.ok(w[a].domyka && w[a].wystaje === 0 && w[a].uwagi === 0, `α ${a}°: składa się na płasko, nic nie wystaje ${JSON.stringify(w[a])}`);
    assert.ok(w[a].kat > 5 && w[a].kat < 90 && w[a].siega > 5, `α ${a}°: stoi pod kątem ${JSON.stringify(w[a])}`);
  }
  assert.ok(w[60].kat > w[30].kat, `kąt zależy od geometrii: ${w[30].kat} vs ${w[60].kat}`);

  // Panel: zaznaczona kartka – kąt linii do grzbietu; zaznaczony trójkąt – podpowiedź pop-upu.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.setActiveObject(e.canvas.getObjects().filter((x) => x.czesc)[0]); e.canvas.requestRenderAll(); });
  await strona.waitForFunction(() => /Kąt do grzbietu/.test(document.querySelector('#wlasciwosci').textContent));
  assert.match(await tekstPanelu(strona), /Kąt do grzbietu 60°, 0 mm od grzbietu – ze skośną linią/);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.setActiveObject(e.canvas.getObjects().filter((x) => x.czesc)[1]); e.canvas.requestRenderAll(); });
  await strona.waitForFunction(() => /Przy kartce otwartej na 90°/.test(document.querySelector('#wlasciwosci').textContent));
  assert.match(await tekstPanelu(strona), new RegExp(`Przy kartce otwartej na 90° stoi pod kątem ${w[60].kat}° do kartki i sięga ${w[60].siega} mm od niej\\. Po zamknięciu chowa się w kartce\\.`));
  assert.deepEqual(bledy, []);
});
