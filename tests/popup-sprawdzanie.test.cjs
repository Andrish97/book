// Sprawdzanie pop-upu (#300, plan składanek krok 20): kartka z grzbietem prawie zamknięta (3°) – mechanizm musi się
// domknąć (paski i ramiona V tej długości, co odległość miejsc klejenia), a żadna część nie może wystawać poza
// zamkniętą kartkę. Uwagi w „Sprawdź przed drukiem”.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('Pop-up: po zamknięciu nic nie wystaje, mechanizm składa się na płasko – uwagi w Sprawdź przed drukiem', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Pop-up');
  const w = await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A3', orientacja: 'pozioma', material: 'karton', gramatura: 300, druk: 'domowy' } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
    const n = await import('./js/app/skladanka-narzedzia.js');
    const S = await import('./js/skladanka-szablony.js');
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const uwagiPopupu = async (czesci) => {
      const e = window.seriodruk.edytor;
      for (const o of e.canvas.getObjects().filter((x) => x.czesc)) e.canvas.remove(o);
      n.wstawCzesci(czesci);
      await window.seriodruk.zapiszTeraz();
      return sprawdzProjekt(window.seriodruk.stan.projekt).filter((u) => /pop-up/.test(u.opis)).map((u) => u.opis);
    };
    const out = {};
    for (const k of ['popup_v', 'popup_platforma', 'popup']) out[k] = await uwagiPopupu(S.czesciSzablonu(k, {}, 0.3));
    // Trójkąt V przedłużony o 100 mm ponad wolny brzeg – po zamknięciu wystaje poza kartkę.
    const v = S.czesciSzablonu('popup_v', {}, 0.3);
    const tr = v[1];
    const [A0, B0, C0] = tr.punkty;
    v[1] = { ...tr, punkty: [{ x: A0.x, y: -100 }, { x: B0.x, y: -100 }, B0, C0, A0], krawedzie: [{ typ: 'ciecie' }, { typ: 'ciecie' }, tr.krawedzie[1], tr.krawedzie[2], { typ: 'ciecie' }], zgiecia: [{ ...tr.zgiecia[0], b: { x: tr.zgiecia[0].b.x, y: -100 } }] };
    out.wystaje = await uwagiPopupu(v);
    // Pasek platformy o 10 mm za długi – kartka się nie domyka.
    const pl = S.czesciSzablonu('popup_platforma', { warstwy: 1 }, 0.3);
    pl[1] = { ...pl[1], punkty: pl[1].punkty.map((q) => ({ x: q.x > 1 ? q.x + 10 : q.x, y: q.y })) };
    out.dlugi = await uwagiPopupu(pl);
    return out;
  });
  assert.deepEqual([w.popup_v, w.popup_platforma, w.popup], [[], [], []], 'gotowe wzory pop-up bez uwag');
  assert.equal(w.wystaje.length, 1, JSON.stringify(w.wystaje));
  assert.match(w.wystaje[0], /Część [A-Z]+ wystaje po zamknięciu kartki pop-up o (2[5-9]|3[0-5]) mm/);
  assert.ok(w.dlugi.some((u) => /Kartka pop-up [A-Z]+ nie zamyka się na płasko/.test(u)), JSON.stringify(w.dlugi));
  assert.deepEqual(bledy, []);
});
