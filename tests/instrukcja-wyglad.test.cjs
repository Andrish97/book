// Wygląd instrukcji (decyzja #112): kroki to zwykły tekst (bez układu flex, który rozbijał zdanie
// na kolumny), pole szukania z lupą, ta sama ikona książki przy „Instrukcji” na każdym ekranie.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('instrukcja: kroki jako tekst, pole szukania z lupą, ikona książki wszędzie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.setViewportSize({ width: 412, height: 860 });
  const ikony = await strona.evaluate(() => [...document.querySelectorAll('[data-akcja="instrukcja"]')].map((b) => b.dataset.ikona));
  assert.ok(ikony.length >= 2 && ikony.every((i) => i === 'ksiazka'), `ikony instrukcji: ${ikony}`);
  assert.ok(await strona.evaluate(() => [...document.querySelectorAll('[data-akcja="wzorce"]')].every((b) => b.dataset.ikona === 'wzorzec')));
  await strona.evaluate(() => document.querySelector('[data-akcja="instrukcja"]').click());
  await strona.waitForSelector('#dlg-instrukcja[open]');
  assert.equal(await strona.locator('.instrukcja-szukaj svg').count(), 1, 'lupa w polu szukania');
  await strona.evaluate(() => [...document.querySelectorAll('#instrukcja-rozdzialy button')].find((b) => /Praca z AI – krok po kroku/.test(b.textContent)).click());
  await strona.waitForSelector('#instrukcja-tresc ol.kroki > li');
  const uklad = await strona.evaluate(() => [...document.querySelectorAll('#instrukcja-tresc ol.kroki > li')].map((li) => getComputedStyle(li).display));
  assert.ok(uklad.every((d) => d === 'block'), `kroki: ${uklad}`);
  assert.deepEqual(bledy, []);
});
