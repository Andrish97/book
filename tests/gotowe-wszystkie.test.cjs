// Gotowe szablony (#166, uwaga 14 z 18.11): każdy szablon wstawia się do świeżego projektu i jego pierwsza
// strona się rysuje – bez błędów (pilnuje, żeby żaden szablon nie zepsuł się po cichu).
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('gotowe szablony: każdy wstawia się i rysuje bez błędów', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wszystkie szablony');
  const wynik = await strona.evaluate(async () => {
    const G = await import('./js/gotowe-sekcje.js');
    const P = await import('./js/projekt.js');
    const Z = await import('./js/zlozenie.js');
    const S = await import('./js/serie.js');
    const out = [];
    for (const s of G.SZABLONY_SEKCJI) {
      const p = P.normalizuj(JSON.parse(JSON.stringify(window.seriodruk.stan.projekt)));
      try {
        const r = await G.wstawGotowaSekcje(p, s.id, { wydruk: p.sekcje[0].wydruk, wlasnyFormat: true, odpowiedzi: G.domyslneOpcje(s), poIndeksie: 0 });
        const ciag = S.rozwin(p);
        const egz = ciag.egzemplarze.find((e) => e.sekcja.id === r.sekcja.id);
        if (!egz) throw new Error('brak stron w rozwinięciu');
        const url = await Z.renderujCel(p, egz, { szerokoscPx: 120, ciag });
        if (!String(url).startsWith('data:image/')) throw new Error('brak obrazu strony');
        out.push([s.id, 'ok']);
      } catch (e) { out.push([s.id, String(e.message || e).slice(0, 160)]); }
    }
    return out;
  });
  assert.ok(wynik.length >= 30, `szablonów: ${wynik.length}`);
  assert.deepEqual(wynik.filter(([, w]) => w !== 'ok'), []);
  assert.deepEqual(bledy, []);
});
