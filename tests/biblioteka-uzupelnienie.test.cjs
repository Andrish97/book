// Uzupełnienie Biblioteki (#143): więcej kształtów, nowe kategorie „Linie i separatory”, „Etykiety i plakietki”
// i „Planer” (gotowe tabele, pola wyboru, kratka i kropki). Każdy element ma podgląd i wstawia się jako zwykły,
// edytowalny element (kształt, linia, tabela).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('biblioteka #143: każdy element ma podgląd i wstawia się bez błędów; planer to tabela, linie mają rodzaj; zapis i PDF', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Biblioteka 143');
  const wynik = await strona.evaluate(async () => {
    const { kategorieBiblioteki } = await import('./js/biblioteka.js');
    const e = window.seriodruk.edytor;
    const zle = [];
    let ile = 0;
    // Kategorie zależne od konta i projektu albo otwierające okna (moje, style, marka, kody, książka, gotowe sekcje, komiks – tests/komiks.test.cjs) i wzorce stron (dodają wzorzec, nie element – tests/wzorce-galeria.test.cjs) – osobne testy.
    for (const k of kategorieBiblioteki().filter((x) => !['moje', 'style', 'marka', 'kody', 'ksiazka', 'gotowe-sekcje', 'wzorce-stron', 'komiks'].includes(x.id))) {
      for (const el of k.elementy()) {
        if (!/^<svg[\s\S]*<\/svg>$/.test(el.podglad || '')) zle.push(`${k.id}/${el.id}: podgląd`);
        const przed = e.canvas.getObjects().length;
        let obj;
        try { obj = await el.wstaw(e, null); } catch (err) { zle.push(`${k.id}/${el.id}: ${err.message}`); continue; }
        if (!obj || e.canvas.getObjects().length !== przed + 1) zle.push(`${k.id}/${el.id}: nie wstawiony`);
        else if (![obj.width, obj.height, obj.left, obj.top].every(Number.isFinite)) zle.push(`${k.id}/${el.id}: wymiary`);
        ile += 1;
        e.canvas.discardActiveObject();
        e.canvas.remove(...e.canvas.getObjects());
      }
    }
    return { zle, ile };
  });
  assert.deepEqual(wynik.zle, []);
  assert.ok(wynik.ile >= 150, `elementów: ${wynik.ile}`);

  // Okno: kategoria „Planer” – tracker nawyków to tabela z dniami tygodnia.
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  await strona.click('#kategorie-biblioteki [data-kategoria="planer"]');
  await strona.click('#elementy-biblioteki .kafel-biblioteki[data-element="tracker-nawykow"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.tabela);
  const tracker = await strona.evaluate(() => {
    const g = window.seriodruk.edytor.aktywny;
    return { kolumny: g.tabela.kolumny.length, naglowek: g.getObjects().filter((o) => o.type === 'textbox').slice(0, 8).map((c) => c.text) };
  });
  assert.equal(tracker.kolumny, 8);
  assert.deepEqual(tracker.naglowek, ['Nawyk', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']);

  // Notatki w linie: bez linii pionowych, z liniami poziomymi.
  const linie = await strona.evaluate(() => {
    const t = window.seriodruk.edytor.dodajSzablonTabeli('notatki-linie').tabela;
    const l = t.linie_komorek || [];
    return { pionowe: l.filter((x) => x.os === 'v' && x.grubosc > 0).length, poziome: l.filter((x) => x.os === 'h' && x.grubosc > 0).length };
  });
  assert.equal(linie.pionowe, 0);
  assert.ok(linie.poziome >= 15, `poziomych: ${linie.poziome}`);

  // Linia przerywana z „Linii i separatorów”: rodzaj w panelu, zmiana na kropkowaną; kreski w zapisie.
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  await strona.click('#kategorie-biblioteki [data-kategoria="linie"]');
  await strona.click('#elementy-biblioteki .kafel-biblioteki[data-element="przerywana"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'line');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.strokeDashArray?.length), 2);
  const sel = strona.locator('[data-pole="rodzaj-linii"] select');
  await sel.waitFor();
  assert.equal(await sel.inputValue(), 'przerywana');
  await sel.selectOption('kropkowana');
  const po = await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; return { k: o.strokeDashArray, cap: o.strokeLineCap, json: o.toObject().strokeDashArray }; });
  assert.equal(po.k[0], 0);
  assert.equal(po.cap, 'round');
  assert.deepEqual(po.json, po.k);

  // Zapis i ponowne wczytanie, potem PDF wektorowy bez elementów zamienionych na obraz.
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  const poWczytaniu = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().map((o) => (o.tabela ? 'tabela' : o.type)).sort());
  assert.deepEqual(poWczytaniu, ['line', 'tabela', 'tabela']);
  const pdf = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { zlozPdf } = await import('./js/eksport.js');
    const { rozwin } = await import('./js/serie.js');
    const ciag = rozwin(stan.projekt);
    const uwagi = new Map();
    const blob = await zlozPdf(stan.projekt, ciag.egzemplarze, { ciag, uwagi });
    return { rozmiar: blob.size, uwagi: [...uwagi.values()].flat().map(String) };
  });
  assert.ok(pdf.rozmiar > 1000);
  assert.deepEqual(pdf.uwagi, []);
  assert.deepEqual(bledy, []);
});
