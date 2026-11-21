// Pop-up w 3D (#299, plan składanek krok 19): kartka z grzbietem otwiera się suwakiem 0–180°, a doklejone części
// i wycinanki ruszają się mechanizmem (sztywne ściany, zawiasy, więzy klejenia). Przy 180° wszystko leży płasko,
// przy 90° element stoi na pełną wysokość, przy prawie zamkniętej kartce składa się do środka (nic nie wystaje).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('Pop-up: mechanizm otwierania 0–180° dla wzorów pop-up, suwak w makiecie, grzbiet w panelu', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  const w = await strona.evaluate(async () => {
    const S = await import('./js/skladanka-szablony.js');
    const K = await import('./js/skladanka.js');
    const M = await import('./js/makieta-3d.js');
    const U = await import('./js/makieta-ustawienia.js');
    const out = {};
    for (const klucz of ['popup', 'popup_v', 'popup_platforma']) {
      let y0 = 10;
      const czesci = S.czesciSzablonu(klucz, {}, 0.3).map((c, i) => {
        const n = K.normalizujCzesc({ ...c, nr: String.fromCharCode(65 + i) });
        const r = K.ramkaCzesci(n);
        const o = { left: 20 + r.x, top: y0 + r.y, width: r.w, height: r.h, angle: 0, originX: 'left', originY: 'top', czesc: { ...n, uklad: { x: r.x + r.w / 2, y: r.y + r.h / 2 } } };
        y0 += r.h + 20;
        return { arkusz: 0, czesc: o.czesc, obiekt: o };
      });
      const kartki = M.kartkiModelu('skladanka', { strony: 1, specjalna: { grubosc_mm: 0.2, wynik: { szerokosc: 400, wysokosc: 600 }, czesci } });
      const mech = M.mechanizmPopup(czesci.map((cz) => M.geometriaCzesci(cz, kartki, 0)));
      mech.ustaw(45);
      const zakres = {};
      for (const popup of [180, 90, 5]) {
        const q = M.scena('skladanka', kartki, 2, { popup });
        const ys = q.flatMap((x) => x.p.map((p) => p[1]));
        zakres[popup] = [Math.round(Math.min(...ys)), Math.round(Math.max(...ys))];
      }
      out[klucz] = { zakres, koszt: mech.koszt, grzbiet: czesci.some((c) => c.czesc.zgiecia.some((z) => z.grzbiet)) };
    }
    out.scena = [U.normalizujScene({ popup: 47.4 }).popup, U.normalizujScene({ popup: 300 }).popup, U.normalizujScene({}).popup];
    return out;
  });
  for (const klucz of ['popup', 'popup_v', 'popup_platforma']) {
    const r = w[klucz];
    assert.ok(r.grzbiet, `${klucz}: zgięcie grzbietu oznaczone`);
    assert.ok(r.koszt < 0.02, `${klucz}: więzy spełnione (koszt ${r.koszt})`);
    assert.deepEqual(r.zakres[180], [0, 0], `${klucz}: rozłożona płasko`);
    assert.ok(Math.abs(r.zakres[90][1] - 100) <= 2 && r.zakres[90][0] >= -1, `${klucz}: przy 90° stoi ${r.zakres[90]}`);
    assert.ok(r.zakres[5][1] <= 12 && r.zakres[5][0] >= -1, `${klucz}: przy 5° złożona do środka ${r.zakres[5]}`);
  }
  assert.deepEqual(w.scena, [47, 180, null]);

  // Suwak w oknie makiety (tylko dla składanki) i przełącznik grzbietu w panelu zgięć.
  const html = await strona.evaluate(() => ({ suwak: Boolean(document.querySelector('#makieta-popup[type=range][min="0"][max="180"]')), grupa: document.querySelector('#makieta-grupa-popup')?.hidden }));
  assert.deepEqual(html, { suwak: true, grupa: true });
  const kod = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/app/skladanka-narzedzia.js'), 'utf8');
  // napis przez klucz (#356): w kodzie klucz, polski tekst w słowniku
  assert.match(kod, /'skladankaNarzedzia\.grzbietKartkiPopUp'/);
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/jezyki/klucze/pl.js'), 'utf8'), /"skladankaNarzedzia\.grzbietKartkiPopUp": "Grzbiet kartki \(pop-up\)"/);
  assert.deepEqual(bledy, []);
});
