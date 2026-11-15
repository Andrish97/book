// Projekt otwiera się na ostatnio edytowanej stronie (#147): po wyjściu do listy i ponownym otwarciu,
// także po przeładowaniu; adres z konkretną stroną ma pierwszeństwo.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('projekt otwiera się na ostatnio edytowanej stronie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Ostatnia strona');
  for (let i = 0; i < 3; i += 1) await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 4);
  await strona.evaluate(async () => (await import('./js/app/lista-stron.js')).przejdzDoStrony(2));
  const id = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[2].id);
  await strona.click('.pasek-edytora [data-akcja="do-projektow"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet)')].some((e) => e.offsetParent));
  await strona.click('.karta-projektu .otworz-projekt');
  await strona.waitForFunction((s) => window.seriodruk.stan.projekt?.strony[window.seriodruk.stan.indeks]?.id === s, id);
  // Po przeładowaniu i wejściu z listy – to samo.
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.reload();
  await strona.waitForSelector('.karta-projektu:not(.szkielet)');
  await strona.click('.karta-projektu .otworz-projekt');
  await strona.waitForFunction((s) => window.seriodruk.stan.projekt?.strony[window.seriodruk.stan.indeks]?.id === s, id);
  assert.deepEqual(bledy, []);
});
