// Nowe wykroje użytków (#223): naklejka okrągła/owalna i zawieszka ze ściętymi rogami i otworem na sznurek;
// gotowy szablon „Zawieszki na prezenty” (seria z tabeli); kontrola – element w otworze zostanie wycięty.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('użytki: koło, zawieszka z otworem, kontrola otworu, szablon zawieszek', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  const w = await strona.evaluate(async () => {
    const S = await import('./js/sekcje-specjalne.js');
    const P = await import('./js/projekt.js');
    const { przeliczOkladki } = await import('./js/okladka.js');
    const { rozwin } = await import('./js/serie.js');
    const geo = (par) => {
      const p = P.normalizuj(P.nowyProjekt('U'));
      p.sekcje[0].typ = 'arkusz';
      p.sekcje[0].specjalna = { rodzaj: 'arkusz', uzytek_szer_mm: 50, uzytek_wys_mm: 90, arkusz: 'A4', ...par };
      przeliczOkladki(p);
      return p;
    };
    const kolo = geo({ ksztalt: 'kolo', uzytek_szer_mm: 60, uzytek_wys_mm: 40 }).sekcje[0].specjalna.wynik;
    const pz = geo({ ksztalt: 'zawieszka', zaokraglenie_mm: 12 });
    const zaw = pz.sekcje[0].specjalna.wynik;
    const xs = (k) => k.map((q) => q.x);
    const ys = (k) => k.map((q) => q.y);
    // Element w otworze i element w ściętym rogu – oba „poza wykrojem”; element na środku – w porządku.
    const otwor = zaw.ciecie[1];
    const ox = (Math.min(...xs(otwor)) + Math.max(...xs(otwor))) / 2;
    const oy = (Math.min(...ys(otwor)) + Math.max(...ys(otwor))) / 2;
    const uwagi = (o) => { pz.strony[0].obiekty = [o]; return S.uwagiSekcjiSpecjalnych(pz, rozwin(pz)).filter((u) => /poza linią/.test(u.opis)).length; };
    return {
      kolo: { konturow: kolo.ciecie.length, szer: Math.round(Math.max(...xs(kolo.ciecie[0])) - Math.min(...xs(kolo.ciecie[0]))), wys: Math.round(Math.max(...ys(kolo.ciecie[0])) - Math.min(...ys(kolo.ciecie[0]))) },
      zaw: { konturow: zaw.ciecie.length, rogi: zaw.ciecie[0].slice(0, 2).map((q) => q.x), otwor: [Math.round(ox * 10) / 10, Math.round(Math.max(...xs(otwor)) - Math.min(...xs(otwor)))] },
      wOtworze: uwagi({ type: 'rect', left: ox - 1, top: oy - 1, width: 2, height: 2, fill: '#000' }),
      wRogu: uwagi({ type: 'rect', left: 0, top: 0, width: 3, height: 3, fill: '#000' }),
      naSrodku: uwagi({ type: 'rect', left: 20, top: 40, width: 10, height: 10, fill: '#000' }),
    };
  });
  assert.deepEqual(w.kolo, { konturow: 1, szer: 60, wys: 40 });
  assert.equal(w.zaw.konturow, 2, 'obrys i otwór');
  assert.deepEqual(w.zaw.rogi, [12, 38], 'ścięte górne rogi 12 mm');
  assert.deepEqual(w.zaw.otwor, [25, 5], 'otwór Ø 5 mm pośrodku');
  assert.equal(w.wOtworze, 1);
  assert.equal(w.wRogu, 1);
  assert.equal(w.naSrodku, 0);

  // Gotowy szablon zawieszek: seria z trzech wierszy, arkusz użytków z kształtem zawieszki, PDF z arkuszem.
  const s = await strona.evaluate(async () => {
    const { wstawGotowaSekcje } = await import('./js/gotowe-sekcje.js');
    const { rozwin } = await import('./js/serie.js');
    const p = window.seriodruk.stan.projekt;
    const { sekcja } = await wstawGotowaSekcje(p, 'zawieszki', { wlasnyFormat: true });
    const { przeliczOkladki } = await import('./js/okladka.js');
    przeliczOkladki(p);
    const egz = rozwin(p).egzemplarze.filter((e) => e.sekcja.id === sekcja.id);
    return { ksztalt: sekcja.specjalna.ksztalt, konturow: sekcja.specjalna.wynik.ciecie.length, egz: egz.length, format: [sekcja.wydruk.szerokosc_mm, sekcja.wydruk.wysokosc_mm] };
  });
  assert.deepEqual(s, { ksztalt: 'zawieszka', konturow: 2, egz: 3, format: [50, 90] });
  assert.ok(await strona.$('select[name="sp_u_ksztalt"] option[value="zawieszka"]'));
  assert.deepEqual(bledy, []);
});
