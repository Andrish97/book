// Schowek między projektami (#210): element z obrazem skopiowany w projekcie A i wklejony w B (obraz trafia do
// obrazów B), strona i cała sekcja z wzorcem, serią i tabelą danych przeniesione do innego projektu.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

const otworzProjekt = async (strona, id) => {
  await strona.evaluate((x) => { location.hash = `#/p/${x}`; }, id);
  await strona.waitForFunction((x) => window.seriodruk.stan.projekt?.id === x && window.seriodruk.edytor?.wydruk, id, { timeout: 15000 });
};

test('schowek między projektami: element z obrazem, strona i sekcja (z wzorcem, serią i tabelą) do innego projektu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Projekt A');
  const idA = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  await strona.setInputFiles('#plik-obraz', { name: 'las.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'image');
  await strona.evaluate(() => window.seriodruk.edytor.kopiuj());
  await strona.waitForFunction(() => JSON.parse(localStorage.getItem('makietka-schowek') || 'null')?.rodzaj === 'elementy');

  // Sekcja A z wzorcem, serią i tabelą – do sprawdzenia, że idą razem z nią.
  await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    p.wzorce.push({ id: 'wz_test', nazwa: 'Stopka', obiekty: [] });
    p.tabele.push({ id: 'tab_test', nazwa: 'Osoby', kolumny: ['imie'], wiersze: [['Ala'], ['Ola']] });
    p.serie.push({ id: 'ser_test', nazwa: 'Dyplomy', tabela: 'tab_test', tryb: 'tabela' });
    p.sekcje[0].wzorce = ['wz_test'];
    p.strony[0].seria = 'ser_test';
  });

  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await nowyProjekt(strona, 'Projekt B');
  const idB = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  // Pusta strona B: „Wklej skopiowane elementy” we właściwościach strony – element z A.
  await strona.locator('text=Wklej skopiowane elementy').first().waitFor();
  await strona.evaluate(async () => (await import('./js/app/schowek-okno.js')).wklejElementy());
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'image'));
  const b = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    const img = window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'image');
    return { zasob: img.zasob, zasoby: Object.keys(p.zasoby), komunikat: document.querySelector('#powiadomienie')?.textContent || '' };
  });
  assert.ok(b.zasoby.includes(b.zasob), 'obraz elementu jest w obrazach projektu B');
  assert.match(b.komunikat, /z projektu „Projekt A”/);

  // Sekcja z A → B (z wzorcem, serią i tabelą), potem sama strona.
  await otworzProjekt(strona, idA);
  await strona.evaluate(async () => (await import('./js/app/schowek-okno.js')).kopiujSekcjeDoSchowka(window.seriodruk.stan.projekt.sekcje[0].id));
  await otworzProjekt(strona, idB);
  const opis = await strona.evaluate(async () => (await import('./js/app/schowek-okno.js')).opisSchowka(['sekcja']));
  assert.match(opis, /sekcja „.*” \(1 str\.\) z „Projekt A”/);
  await strona.evaluate(async () => (await import('./js/app/schowek-okno.js')).wklejSekcjeZeSchowka(window.seriodruk.stan.projekt.sekcje[0].id));
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje.length === 2);
  const s = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    const nowa = p.sekcje[1];
    const strony = p.strony.filter((x) => x.sekcja === nowa.id);
    return { wzorce: nowa.wzorce, maWzorzec: p.wzorce.some((w) => w.id === 'wz_test'), seria: strony[0].seria, maSerie: p.serie.some((x) => x.id === 'ser_test'), maTabele: p.tabele.some((x) => x.id === 'tab_test'), stron: strony.length, kolejnosc: p.strony.map((x) => p.sekcje.findIndex((y) => y.id === x.sekcja)) };
  });
  assert.deepEqual(s, { wzorce: ['wz_test'], maWzorzec: true, seria: 'ser_test', maSerie: true, maTabele: true, stron: 1, kolejnosc: [0, 1] });

  await otworzProjekt(strona, idA);
  await strona.evaluate(async () => (await import('./js/app/schowek-okno.js')).kopiujStroneDoSchowka(0));
  await otworzProjekt(strona, idB);
  await strona.evaluate(async () => (await import('./js/app/schowek-okno.js')).wklejStronyZeSchowka(0));
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 3);
  assert.equal(await strona.evaluate(() => { const p = window.seriodruk.stan.projekt; return p.strony[1].sekcja === p.sekcje[0].id && p.strony[1].seria === 'ser_test'; }), true, 'strona wklejona za pierwszą, w jej sekcji');
  // Menu strony: „Wklej strony ze schowka” z opisem, skąd; „Wklej sekcję” nieaktywne (w schowku jest strona).
  await strona.locator('.menu-miniatury').first().click();
  await strona.waitForSelector('#menu-strony:not([hidden])');
  assert.match(await strona.textContent('#menu-strony [data-akcja="strona-ze-schowka"]'), /Wklej strony ze schowka: strona „.*” z „Projekt A”/);
  await strona.screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'schowek-menu.png') });
  await strona.keyboard.press('Escape');
  assert.deepEqual(bledy, []);
});
