// #409: napisy składane w kodzie (daty, liczby z odmianą, komunikaty błędów) w języku interfejsu – po angielsku
// bez polskich słów („Changed dziś, 13:00”, „3 projekty”, „Nieprawidłowy e-mail lub hasło.”).
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('po angielsku: daty, liczba projektów i komunikaty logowania bez polskich słów', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => localStorage.setItem('makietka-jezyk', 'en'));
  await strona.reload();
  await strona.waitForFunction(() => document.documentElement.lang === 'en');
  const w = await strona.evaluate(async () => {
    const { kiedy } = await import('./js/ui.js');
    const { komunikatBledu } = await import('./js/chmura.js');
    const { t } = await import('./js/jezyk.js');
    const teraz = new Date();
    return {
      chwila: kiedy(teraz.toISOString()),
      dzis: kiedy(new Date(teraz - 2 * 3600e3 > new Date(teraz).setHours(0, 0, 0, 0) ? teraz - 2 * 3600e3 : teraz - 61e3).toISOString()),
      dawno: kiedy('2025-03-05T10:00:00Z'),
      zmieniono: t('projekty.zmieniono', { rola: t('projekty.moznaEdytowac'), kiedy: kiedy(teraz.toISOString()) }),
      ile: [t('projekty.ileWlasnych', { n: 1 }), t('projekty.ileWlasnych', { n: 3 }), t('projekty.ileWlasnychIUdostepnionych', { n: 2, u: 1 })],
      blad: komunikatBledu({ message: 'Invalid login credentials' }),
      siec: komunikatBledu({ message: 'Failed to fetch' }),
    };
  });
  assert.equal(w.chwila, 'just now');
  assert.match(w.dzis, /^(today, \d\d:\d\d|\d+ min ago)$/);
  assert.match(w.dawno, /Mar 2025/);
  assert.equal(w.zmieniono, 'You can edit · Changed just now');
  assert.deepEqual(w.ile, ['1 project', '3 projects', '2 projects · 1 shared with you']);
  assert.equal(w.blad, 'Incorrect email or password.');
  assert.equal(w.siec, 'No connection to the server. Check your internet connection.');
  assert.doesNotMatch(JSON.stringify(w), /[ąćęłńóśźż]|dziś|temu|projekty/);
  assert.deepEqual(bledy, []);
});
