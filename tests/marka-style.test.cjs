// Style tekstu w zestawie marki (#167): gotowe miejsca (Tytuł, Nagłówek 1–4, Podtytuł, Akapit, Akapit wyróżniony,
// Podpis, Cytat, Lista, Przypis, Stopka / żywa pagina, Etykieta) i własne bez limitu; „Zastosuj markę do projektu”
// przenosi je do stylów projektu – styl o tej samej nazwie dostaje wygląd marki i zostaje powiązany z tekstami.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('style marki: gotowe miejsca, własne bez limitu, normalizacja i przeniesienie do stylów projektu po nazwie', async () => {
  const { normalizujMarke, gotowyStylMarki, ROLE_STYLOW, zastosujStyleMarki, stylMarkiDoProjektu } = await modul('js/zestaw-marki.js');
  const marka = normalizujMarke({ kolory: [{ id: 'g', nazwa: 'Granat', kolor: '#1c2541' }], czcionki: { naglowek: 'Playfair Display', tekst: 'Inter' } });
  assert.equal(ROLE_STYLOW.length, 14);
  assert.deepEqual(ROLE_STYLOW.map(([, n]) => n), ['Tytuł', 'Podtytuł', 'Nagłówek 1', 'Nagłówek 2', 'Nagłówek 3', 'Nagłówek 4', 'Akapit', 'Akapit wyróżniony', 'Podpis', 'Cytat', 'Lista', 'Przypis', 'Stopka / żywa pagina', 'Etykieta']);
  marka.style = ROLE_STYLOW.map(([r]) => gotowyStylMarki(r, marka));
  const tytul = marka.style[0];
  assert.equal(tytul.czcionka, 'Playfair Display', 'tytuł czcionką nagłówków marki');
  assert.equal(tytul.kolor, '#1c2541', 'nagłówki w kolorze marki');
  assert.equal(marka.style.find((s) => s.rola === 'akapit').czcionka, 'Inter');
  assert.equal(marka.style.find((s) => s.rola === 'etykieta').wielkosc_liter, 'wielkie');
  // Własne style bez limitu i normalizacja wartości.
  for (let i = 0; i < 60; i += 1) marka.style.push({ id: `w${i}`, nazwa: `Własny ${i}`, rozmiar: 'x', waga: 'gruba', kolor: 'zly', wielkosc_liter: '?' });
  const n = normalizujMarke(marka);
  assert.equal(n.style.length, 74, 'bez limitu stylów');
  assert.deepEqual([n.style[20].rozmiar, n.style[20].waga, n.style[20].kolor, n.style[20].wielkosc_liter], [10.5, 'normal', '#1a1a1a', '']);
  // Do projektu: „Tytuł” (inna wielkość liter w nazwie) aktualizuje istniejący styl z zachowaniem id; reszta dochodzi.
  const projekt = { style: [{ id: 'st_tyt', nazwa: 'tytuł', fontFamily: 'Lora', fontSize: 5 }, { id: 'st_inne', nazwa: 'Inny', fontFamily: 'Lora' }] };
  let id = 0;
  const w = zastosujStyleMarki(projekt, n, () => `nowy${id++}`);
  assert.equal(w.zmienione.length, 1);
  assert.equal(w.dodane.length, 73);
  const tyt = projekt.style.find((s) => s.id === 'st_tyt');
  assert.equal(tyt.fontFamily, 'Playfair Display');
  assert.equal(tyt.fontSize, stylMarkiDoProjektu(tytul).fontSize);
  assert.ok(Math.abs(tyt.fontSize - (32 * 25.4) / 72) < 0.01, 'rozmiar z pt na mm');
  assert.equal(projekt.style.find((s) => s.id === 'st_inne').fontFamily, 'Lora', 'styl spoza marki bez zmian');
  assert.equal(projekt.style.find((s) => s.nazwa === 'Etykieta').wielkosc_liter, 'wielkie');
});

test('zestaw marki w aplikacji: gotowe style, własny styl, zapis; „Zastosuj markę” aktualizuje styl projektu i teksty z nim', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => { location.hash = '#/konto/marka'; });
  await strona.waitForSelector('#ust-marka', { state: 'visible' });
  await strona.click('#ust-marka [data-akcja="marka-edytuj"]');
  await strona.waitForSelector('#dlg-marka[open]');
  await strona.evaluate(() => {
    const f = document.querySelector('#form-marka');
    f.elements.naglowek.value = 'Playfair Display';
    f.elements.naglowek.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await strona.click('#marka-gotowe-style');
  assert.equal(await strona.locator('#marka-style li').count(), 14);
  assert.equal(await strona.isVisible('#marka-gotowe-style'), false, 'wszystkie gotowe miejsca już są');
  await strona.click('#marka-dodaj-styl');
  await strona.fill('#marka-style li:last-child [data-pole="nazwa"]', 'Cena');
  await strona.fill('#marka-style li:last-child [data-pole="rozmiar"]', '20');
  assert.equal(await strona.textContent('#marka-style li:last-child .proba-stylu'), 'Cena', 'podgląd w wyglądzie stylu');
  await strona.click('#marka-zapisz');
  await strona.waitForFunction(() => /15 styl/.test(document.querySelector('[data-podsumowanie="marka"]')?.textContent || ''));
  // Projekt z tekstem w stylu „Tytuł” (z domyślnych stylów projektu) – po zastosowaniu marki tekst ma czcionkę marki.
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await nowyProjekt(strona, 'Style');
  await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const tytul = stan.projekt.style.find((s) => s.nazwa === 'Tytuł');
    const t = edytor.dodajTekst();
    const { zastosujStyl } = await import('./js/style-tekstu.js');
    zastosujStyl(t, tytul);
    window.__idTytulu = tytul.id;
    edytor.zatwierdz();
  });
  await strona.click('#przycisk-wiecej');
  await strona.click('#menu-wiecej [data-akcja="marka-zastosuj"]');
  await strona.waitForSelector('#dlg-marka-zastosuj[open]');
  assert.match(await strona.textContent('#marka-mapa-style'), /Tytuł.*zaktualizuje styl projektu/s);
  assert.match(await strona.textContent('#marka-mapa-style'), /Cena.*nowy styl/s);
  await strona.click('#marka-zastosuj-ok');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.style.some((s) => s.nazwa === 'Cena'));
  const w = await strona.evaluate(() => {
    const { stan } = window.seriodruk;
    const tytul = stan.projekt.style.find((s) => s.nazwa === 'Tytuł');
    const tekst = stan.projekt.strony[0].obiekty.find((o) => o.styl === tytul.id);
    return { id: tytul.id === window.__idTytulu, styl: tytul.fontFamily, tekst: tekst?.fontFamily, ile: stan.projekt.style.length };
  });
  assert.deepEqual([w.id, w.styl, w.tekst], [true, 'Playfair Display', 'Playfair Display'], 'ten sam styl (id), wygląd marki, tekst przeliczony');
  assert.ok(w.ile >= 15);
  assert.deepEqual(bledy, []);
});
