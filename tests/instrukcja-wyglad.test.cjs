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
  await strona.evaluate(() => [...document.querySelectorAll('#instrukcja-rozdzialy .rozdzial-przycisk')].find((b) => /Makietka w skrócie/.test(b.textContent)).click());
  await strona.waitForSelector('#instrukcja-tresc ol.kroki > li');
  const uklad = await strona.evaluate(() => [...document.querySelectorAll('#instrukcja-tresc ol.kroki > li')].map((li) => getComputedStyle(li).display));
  assert.ok(uklad.every((d) => d === 'block'), `kroki: ${uklad}`);
  assert.deepEqual(bledy, []);
});

test('instrukcja na telefonie: przewija się tylko treść, nie cały układ (#132)', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await strona.evaluate(() => document.querySelector('[data-akcja="instrukcja"]').click());
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.waitForTimeout(500);
  const uklad = await strona.evaluate(() => {
    const u = document.querySelector('#dlg-instrukcja .instrukcja');
    u.scrollTop = 500;
    return { przewiniety: u.scrollTop, overflow: getComputedStyle(u).overflowY };
  });
  assert.equal(uklad.przewiniety, 0, 'układ instrukcji nie przewija się');
  assert.equal(uklad.overflow, 'clip');
  const tresc = await strona.evaluate(() => { const t = document.querySelector('#instrukcja-tresc'); return t.scrollHeight > t.clientHeight && getComputedStyle(t).overflowY; });
  assert.ok(['auto', 'scroll'].includes(tresc), 'treść przewija się sama');
  assert.deepEqual(bledy, []);
});
