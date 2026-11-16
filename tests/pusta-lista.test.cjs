// Pusta lista projektów (#180): obok „Utwórz projekt” jest „Z gotowego szablonu” – otwiera okno nowego projektu
// z wybranym „Zacznij od: Gotowego szablonu”.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('pusta lista projektów: „Z gotowego szablonu” otwiera nowy projekt ze startem z szablonu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.waitForSelector('#pusto-projekty:not([hidden])');
  await strona.click('#pusto-projekty [data-akcja="nowy-z-szablonu"]');
  await strona.waitForSelector('#dlg-nowy[open]');
  assert.equal(await strona.evaluate(() => document.querySelector('#form-nowy').elements.start.value), 'szablon');
  // Zwykłe „Utwórz projekt” zaczyna od pustej strony.
  await strona.evaluate(() => document.querySelector('#dlg-nowy').close());
  await strona.click('#pusto-projekty [data-akcja="nowy-projekt"]');
  await strona.waitForSelector('#dlg-nowy[open]');
  assert.equal(await strona.evaluate(() => document.querySelector('#form-nowy').elements.start.value), 'pusty');
  assert.deepEqual(bledy, []);
});
