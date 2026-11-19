// Łuki z pióra (#266, plan składanek krok 10): „Z kształtu” próbkuje krzywe Béziera gęsto – część nie spłaszcza
// łuku do cięciwy.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('Z kształtu: półkole z pióra – punkty na łuku, nie cięciwa', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Łuki');
  await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A4', orientacja: 'pozioma', material: 'karton', gramatura: 300 } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
  });
  const w = await strona.evaluate(async () => {
    const { punktySciezki } = await import('./js/skladanka.js');
    // Półkole r = 20 z dwóch krzywych C (przybliżenie koła) + podstawa.
    const k = 0.5523 * 20;
    const sciezka = [['M', 0, 20], ['C', 0, 20 - k, 20 - k, 0, 20, 0], ['C', 20 + k, 0, 40, 20 - k, 40, 20], ['L', 0, 20], ['Z']];
    const pkt = punktySciezki(sciezka);
    const odSrodka = pkt.filter(([, y]) => y < 19.9).map(([x, y]) => Math.hypot(x - 20, y - 20));
    const e = window.seriodruk.edytor;
    const path = new window.fabric.Path(sciezka.map((c) => c.join(' ')).join(' '), { left: 120, top: 60, fill: '#ffffff', stroke: '#000', strokeWidth: 0.3 });
    e.canvas.add(path);
    e.canvas.setActiveObject(path);
    document.querySelector('[data-akcja="skladanka-z-ksztaltu"]').click();
    await new Promise((r) => setTimeout(r, 300));
    const g = e.canvas.getObjects().find((o) => o.czesc);
    return { ile: pkt.length, min: Math.min(...odSrodka), max: Math.max(...odSrodka), czesc: g?.czesc.punkty.length || 0 };
  });
  assert.ok(w.ile >= 20, `punktów: ${w.ile}`);
  assert.ok(w.min > 19.8 && w.max < 20.2, `promień ${w.min}–${w.max}`);
  assert.ok(w.czesc >= 20, `część z łukiem ma ${w.czesc} punktów`);
  assert.deepEqual(bledy, []);
});
