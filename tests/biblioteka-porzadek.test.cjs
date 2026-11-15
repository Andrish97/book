// Biblioteka – porządek i rozbudowa (#155): każdy element w jednej, pasującej kategorii (Planer bez luźnych
// kształtów), dużo więcej kształtów i ramek, grupy z nagłówkami w długich kategoriach, ramki przerywane jako
// sam obrys, pola na zdjęcie (obraz w kształcie) i obramowania na całą stronę.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('biblioteka #155: liczności, grupy, Planer bez luźnych kształtów, nazwy bez powtórzeń', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Porządek');
  const w = await strona.evaluate(async () => {
    const { kategorieBiblioteki } = await import('./js/biblioteka.js');
    const { GRUPY_KATEGORII } = await import('./js/biblioteka-elementy.js');
    const { KSZTALTY } = await import('./js/ksztalty-biblioteka.js');
    const { SZABLONY } = await import('./js/szablony-planera.js');
    const kat = Object.fromEntries(kategorieBiblioteki().map((k) => [k.id, k.elementy()]));
    const powtorzone = [];
    for (const [id, l] of Object.entries(kat)) {
      const nazwy = l.map((e) => e.nazwa);
      for (const n of new Set(nazwy)) if (nazwy.filter((x) => x === n).length > 1) powtorzone.push(`${id}: ${n}`);
    }
    // Kształt jest w dokładnie jednej kategorii okna.
    const wKategoriach = new Map();
    const zKsztaltami = ['ksztalty', 'strzalki', 'ramki', 'ozdobniki', 'etykiety', 'linie', 'planer'];
    for (const [id, l] of Object.entries(kat)) if (zKsztaltami.includes(id)) for (const e of l) if (KSZTALTY.some((k) => k.id === e.id)) wKategoriach.set(e.id, [...(wKategoriach.get(e.id) || []), id]);
    const planer = kat.planer.map((e) => (SZABLONY.some((s) => s.id === e.id) ? 'tabela' : KSZTALTY.find((k) => k.id === e.id)?.siatka ? 'siatka' : `luźny: ${e.id}`));
    const grupyWOknie = (id) => [...new Set(kat[id].map((e) => e.grupa))];
    return {
      ile: Object.fromEntries(Object.entries(kat).map(([id, l]) => [id, l.length])),
      powtorzone,
      wielu: [...wKategoriach].filter(([, l]) => l.length > 1).map(([id]) => id),
      bezKategorii: KSZTALTY.filter((k) => !wKategoriach.has(k.id)).map((k) => k.id),
      planer: planer.filter((x) => x.startsWith('luźny')),
      bezGrupy: Object.entries(kat).filter(([id]) => GRUPY_KATEGORII[id]).flatMap(([id, l]) => l.filter((e) => !e.grupa).map((e) => `${id}/${e.id}`)),
      grupyKsztaltow: grupyWOknie('ksztalty'),
      grupyRamek: grupyWOknie('ramki').length,
    };
  });
  assert.ok(w.ile.ksztalty >= 200, `kształty: ${w.ile.ksztalty}`);
  assert.ok(w.ile.ramki >= 60, `ramki: ${w.ile.ramki}`);
  assert.ok(w.ile.strzalki >= 45, `strzałki i dymki: ${w.ile.strzalki}`);
  assert.ok(w.ile.ozdobniki >= 30, `ozdobniki: ${w.ile.ozdobniki}`);
  assert.ok(w.ile.etykiety >= 18, `etykiety: ${w.ile.etykiety}`);
  assert.ok(w.ile.linie >= 25, `linie: ${w.ile.linie}`);
  assert.deepEqual(w.powtorzone, [], 'nazwy w kategorii się nie powtarzają');
  assert.deepEqual(w.wielu, [], 'kształt tylko w jednej kategorii');
  assert.deepEqual(w.bezKategorii, [], 'każdy kształt jest w jakiejś kategorii');
  assert.deepEqual(w.planer, [], 'Planer: tylko tabele i siatki do notatek');
  assert.deepEqual(w.bezGrupy, []);
  assert.deepEqual(w.grupyKsztaltow, ['Podstawowe', 'Wielokąty', 'Gwiazdy i odznaki', 'Serca i natura', 'Symbole i ikony', 'Okolicznościowe', 'Znaki']);
  assert.equal(w.grupyRamek, 9);

  // Okno: nagłówki grup w kategorii, bez nagłówków przy szukaniu (wyniki z kilku kategorii).
  await strona.click('[data-akcja="biblioteka"]');
  await strona.click('#kategorie-biblioteki [data-kategoria="ramki"]');
  assert.equal(await strona.locator('#elementy-biblioteki .grupa-biblioteki').count(), 9);
  assert.equal(await strona.locator('#elementy-biblioteki .grupa-biblioteki').first().textContent(), 'Proste');
  await strona.fill('#szukaj-w-bibliotece', 'serce');
  assert.equal(await strona.locator('#elementy-biblioteki .grupa-biblioteki').count(), 0);
  const kategorieWynikow = await strona.evaluate(() => new Set([...document.querySelectorAll('#elementy-biblioteki .kafel-biblioteki')].map((b) => b.dataset.kategoria)).size);
  assert.ok(kategorieWynikow >= 3, `serce w ${kategorieWynikow} kategoriach`);
  assert.deepEqual(bledy, []);
});

test('biblioteka #155: ramka przerywana to sam obrys, pole na zdjęcie przyjmuje obraz, obramowanie na całą stronę', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Ramki');
  const w = await strona.evaluate(async () => {
    const { elementBiblioteki } = await import('./js/biblioteka.js');
    const { moznaWstawicObraz } = await import('./js/obraz-w-ksztalcie.js');
    const e = window.seriodruk.edytor;
    const wstaw = (k, id) => elementBiblioteki(k, id).wstaw(e, null);
    const przer = wstaw('ramki', 'ramka-przerywana');
    const zdj = wstaw('ramki', 'zdj-serce');
    const bord = wstaw('ramki', 'bordiura-podwojna');
    const r = bord.getBoundingRect();
    return {
      przer: { fill: przer.fill, kreski: przer.strokeDashArray?.length, obrys: przer.strokeWidth > 0 },
      zdj: { moze: moznaWstawicObraz(zdj), fill: zdj.fill, nazwa: zdj.nazwa },
      bord: { szer: bord.getScaledWidth(), wys: bord.getScaledHeight(), left: bord.left, top: bord.top, r: !!r },
      strona: { w: e.wydruk.szerokosc_mm, h: e.wydruk.wysokosc_mm, m: e.marg },
    };
  });
  assert.deepEqual(w.przer, { fill: '', kreski: 2, obrys: true });
  assert.equal(w.zdj.moze, true);
  assert.equal(w.zdj.fill, '#e3e1dc');
  assert.equal(w.zdj.nazwa, 'Zdjęcie w sercu');
  const { w: sw, h: sh, m } = w.strona;
  assert.ok(Math.abs(w.bord.left - m.lewy / 2) < 0.5 && Math.abs(w.bord.top - m.gora / 2) < 0.5, JSON.stringify(w.bord));
  assert.ok(Math.abs(w.bord.szer - (sw - (m.lewy + m.prawy) / 2)) < 1.5, `szerokość ${w.bord.szer}`);
  assert.ok(Math.abs(w.bord.wys - (sh - (m.gora + m.dol) / 2)) < 1.5, `wysokość ${w.bord.wys}`);
  assert.deepEqual(bledy, []);
});
