// Makieta 3D (#185): sekcja środka w innym formacie (np. wyklejka A4 bez typu) – uwaga z przyciskiem „Ustaw typ
// sekcji…”; po ustawieniu typu wyklejki uwaga znika.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('makieta: sekcja w innym formacie niż środek – uwaga i przejście do ustawienia typu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wyklejka bez typu');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    const blok = p.sekcje[0];
    blok.wydruk.szerokosc_mm = 148; blok.wydruk.wysokosc_mm = 210;
    for (let i = 0; i < 5; i += 1) p.strony.push(P.nowaStrona(`S${i + 2}`, blok.id));
    const w = P.nowaSekcja('Wyklejka przednia (A4)');
    w.wydruk = { ...blok.wydruk, szerokosc_mm: 297, wysokosc_mm: 210 };
    p.sekcje.unshift(w);
    p.strony.unshift(P.nowaStrona('Wyklejka', w.id));
    window.seriodruk.stan.indeks = 1;
    await (await import('./js/app/zapis.js')).zaladujCel();
  });
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForSelector('.podglad-strona[data-id]');
  await strona.click('[data-akcja="podglad-makieta"]');
  await strona.waitForSelector('#dlg-makieta[open]');
  await strona.selectOption('#makieta-model', 'ksiazka_twarda');
  await strona.waitForSelector('#makieta-uwaga:not([hidden])');
  const tekst = await strona.textContent('#makieta-uwaga');
  assert.match(tekst, /Wyklejka przednia \(A4\).*297 × 210 mm.*148 × 210 mm/);
  await strona.click('#makieta-uwaga button');
  await strona.waitForSelector('#dlg-sekcja[open]');
  // Typ ustawiony (jak w oknie sekcji) – uwaga znika.
  await strona.evaluate(async () => {
    document.querySelector('#dlg-sekcja').close();
    const p = window.seriodruk.stan.projekt;
    p.sekcje[0].typ = 'wyklejka_przednia';
  });
  await strona.click('[data-akcja="podglad"]').catch(() => {});
  await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).otworzMakiete(window.seriodruk.stan.projekt));
  await strona.waitForSelector('#dlg-makieta[open]');
  await strona.selectOption('#makieta-model', 'ksiazka_twarda');
  await strona.waitForTimeout(300);
  // Uwaga o formacie znika; może zostać inna, prawdziwa uwaga (projekt bez okładki – makieta pokaże pustą okleinę).
  const po = (await strona.isVisible('#makieta-uwaga')) ? await strona.textContent('#makieta-uwaga') : '';
  assert.doesNotMatch(po, /Wyklejka przednia|297 × 210/);
  assert.deepEqual(bledy, []);
});
