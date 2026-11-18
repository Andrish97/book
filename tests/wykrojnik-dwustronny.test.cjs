// Druga strona arkusza wykrojnika (#222): zadruk z obu stron – sekcja dostaje drugą stronę (wnętrze pudełka,
// koperty, teczki) z lustrzanym układem stref, bigów i linii cięcia; kontrola liczy się z odwróconym konturem,
// a linie wykrojnika idą do PDF tylko z pierwszej strony.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('wykrojnik z obu stron: druga strona, lustrzane linie, kontrola, bez linii w PDF na odwrocie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  const w = await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const S = await import('./js/sekcje-specjalne.js');
    const { przeliczOkladki } = await import('./js/okladka.js');
    const { rozwin } = await import('./js/serie.js');
    const { rysujLinieSpecjalne } = await import('./js/pdf-specjalne.js');
    const p = P.normalizuj(P.nowyProjekt('Pudełko'));
    const s = p.sekcje[0];
    s.typ = 'wykrojnik';
    s.specjalna = { rodzaj: 'wykrojnik', ksztalt: 'pudelko', zadruk: 'dwustronny', dlugosc_mm: 100, szerokosc_mm: 60, wysokosc_mm: 150 };
    przeliczOkladki(p);
    const wynik = s.specjalna.wynik;
    const przod = S.wynikDlaStrony(wynik, 0);
    const tyl = S.wynikDlaStrony(wynik, 1);
    const W = wynik.szerokosc;
    const zPrzod = przod.strefy.find((z) => z.rodzaj === 'przod');
    const zTyl = tyl.strefy.find((z) => z.rodzaj === 'przod');
    // Ten sam element na obu stronach: nad zakładką klejową (bez klapki) – na przodzie poza wykrojem; na odwrocie
    // to samo miejsce arkusza wypada nad klapką boku z drugiej strony – w wykroju.
    const kl = przod.strefy.find((z) => z.rodzaj === 'klej');
    const el = { type: 'rect', left: kl.x1 + 2, top: zPrzod.y1 - 7, width: 4, height: 4, fill: '#000' };
    p.strony[0].obiekty.push({ ...el });
    p.strony[1].obiekty.push({ ...el });
    const uwagi = S.uwagiSekcjiSpecjalnych(p, rozwin(p)).filter((u) => /poza linią wykrojnika/.test(u.opis)).map((u) => u.strony);
    // PDF: odwrotna strona – bez rysowania linii.
    let rysowano = 0;
    const atrapa = new Proxy({}, { get: () => () => { rysowano += 1; } });
    rysujLinieSpecjalne(window.PDFLib || {}, { context: atrapa }, atrapa, { pas: 0, h: wynik.wysokosc }, tyl);
    return {
      stron: p.strony.filter((x) => x.sekcja === s.id).length, stronWyniku: wynik.stron,
      odwrotna: [Boolean(przod.odwrotna), tyl.odwrotna],
      przod: [zPrzod.x1, zPrzod.x2], tyl: [zTyl.x1, zTyl.x2], W, nazwaTyl: zTyl.nazwa,
      ciecie: [przod.ciecie[0][0].x, tyl.ciecie[0][0].x], uwagi, rysowano,
      opis: S.opisSpecjalnej(s),
    };
  });
  assert.equal(w.stronWyniku, 2);
  assert.equal(w.stron, 2, 'sekcja dostała drugą stronę');
  assert.deepEqual(w.odwrotna, [false, true]);
  assert.deepEqual(w.tyl, [Math.round((w.W - w.przod[1]) * 10) / 10, Math.round((w.W - w.przod[0]) * 10) / 10], 'strefa odbita w poziomie');
  assert.match(w.nazwaTyl, /wnętrze/);
  assert.equal(Math.round((w.ciecie[0] + w.ciecie[1]) * 10) / 10, w.W, 'linia cięcia odbita');
  assert.deepEqual(w.uwagi, [[1]], 'kontrola odwrocia liczy się z odbitym konturem');
  assert.equal(w.rysowano, 0, 'na odwrocie PDF nie dostaje linii wykrojnika');

  // Okno sekcji: wybór zadruku przy wykrojniku.
  await strona.evaluate(async () => {
    const S = await import('./js/sekcje-specjalne.js');
    const p = window.seriodruk.stan.projekt;
    p.sekcje[0].typ = 'wykrojnik';
    p.sekcje[0].specjalna = S.domyslnaSpecjalna('wykrojnik');
  });
  assert.ok(await strona.$('select[name="sp_w_zadruk"] option[value="dwustronny"]'));
  assert.deepEqual(bledy, []);
});
