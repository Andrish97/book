// Tłumaczenie napisów nie kasuje ikon (zgłoszenie 23.11: „w tłumaczeniach nie ma ikon”): przycisk z data-ikona ma
// <svg> w środku, a dawne textContent = napis usuwało go po przełączeniu na angielski albo ukraiński.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('ikony przycisków zostają po angielsku i po ukraińsku; napis przetłumaczony', async (t) => {
  const { strona, bledy } = await otworz(t);
  const stan = () => strona.evaluate(() => {
    const b = [...document.querySelectorAll('[data-ikona][data-i18n]')];
    return { wszystkie: b.length, zIkona: b.filter((x) => x.querySelector('svg')).length };
  });
  const pl = await stan();
  assert.ok(pl.wszystkie > 50 && pl.zIkona === pl.wszystkie, JSON.stringify(pl));
  await strona.evaluate(async () => (await import('./js/jezyk.js')).ustawJezyk('en'));
  await strona.waitForFunction(() => document.documentElement.lang === 'en');
  assert.deepEqual(await stan(), pl, 'po angielsku');
  const przycisk = await strona.evaluate(() => {
    const b = document.querySelector('[data-ikona][data-i18n="widokFormularz.zobaczJakToDziala"]');
    return { tekst: b.textContent.trim(), svg: Boolean(b.querySelector('svg')) };
  });
  assert.equal(przycisk.svg, true);
  assert.doesNotMatch(przycisk.tekst, /Zobacz/);
  await strona.evaluate(() => localStorage.setItem('makietka-jezyk', 'uk'));
  await strona.reload();
  await strona.waitForFunction(() => document.documentElement.lang === 'uk');
  await strona.waitForFunction((n) => document.querySelectorAll('[data-ikona][data-i18n] svg').length >= n, pl.wszystkie);
  assert.deepEqual(await stan(), pl, 'po ukraińsku, po przeładowaniu');
  assert.deepEqual(bledy, []);
});
