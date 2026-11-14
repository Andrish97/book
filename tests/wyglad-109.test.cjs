// Decyzje wyglądu #109: menu widoku z opcjami wyglądu edytora, napisy na górnym pasku tylko gdy się mieszczą,
// karta projektu z chmurką stanu wysyłki, kafelek „+” na liście stron, przeciąganie warstw za uchwyt,
// schemat marginesów w ustawieniach sekcji, kosz w oknie serii, gumka w oknie danych.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const widoczne = (strona, sel) => strona.evaluate((s) => [...document.querySelectorAll(s)].map((e) => getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0), sel);

test('menu widoku: „Wygląd edytora” – podpisy narzędzi i napisy na górnym pasku, zapamiętane na urządzeniu', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1600, height: 900 } });
  await nowyProjekt(strona, 'Wygląd');
  // Domyślnie: narzędzia bez podpisów, napisy na pasku w trybie „auto” – na szerokim ekranie się mieszczą.
  assert.deepEqual(await widoczne(strona, '#pasek-narzedzi [data-akcja="dodaj-tekst"] > span'), [false]);
  await strona.waitForFunction(() => document.querySelector('.pasek-edytora').classList.contains('z-napisami'));
  assert.deepEqual(await widoczne(strona, '.pasek-edytora .etyk-paska'), [true, true, true]);
  // Węższe okno: napisy znikają same, bez stałego progu.
  await strona.setViewportSize({ width: 1000, height: 800 });
  await strona.waitForFunction(() => !document.querySelector('.pasek-edytora').classList.contains('z-napisami'));
  assert.deepEqual(await widoczne(strona, '.pasek-edytora .etyk-paska'), [false, false, false]);
  for (const b of await strona.$$('.pasek-edytora > [data-akcja="podglad"], .pasek-edytora > [data-akcja="dane"]')) {
    assert.ok(await b.getAttribute('title') || await b.getAttribute('data-dymek'), 'podpowiedź przy ikonie');
    assert.ok(await b.getAttribute('aria-label'));
  }
  await strona.setViewportSize({ width: 1600, height: 900 });

  await strona.click('#przycisk-widok');
  assert.ok(await strona.isVisible('#menu-widoku .wyglad-edytora'));
  assert.match(await strona.textContent('#menu-widoku'), /Wygląd edytora.*Podpisy narzędzi.*Napisy na górnym pasku/s);
  assert.equal(await strona.isChecked('#widok-podpisy'), false);
  await strona.click('#menu-widoku label:has(#widok-podpisy)');
  assert.deepEqual(await widoczne(strona, '#pasek-narzedzi [data-akcja="dodaj-tekst"] > span'), [true]);
  await strona.click('#widok-napisy label:has-text("Nigdy")');
  assert.deepEqual(await widoczne(strona, '.pasek-edytora .etyk-paska'), [false, false, false]);
  const zapisane = await strona.evaluate(() => JSON.parse(localStorage.getItem('makietka.wyglad-edytora')));
  assert.deepEqual(zapisane, { podpisy: true, napisy: 'nigdy' });

  await strona.reload();
  await strona.waitForSelector('#ekran-edytora', { state: 'visible' });
  await strona.waitForFunction(() => document.querySelector('#ekran-edytora').hasAttribute('data-podpisy-narzedzi'));
  assert.equal(await strona.evaluate(() => document.querySelector('.pasek-edytora').dataset.napisy), 'nigdy');
  await strona.click('#przycisk-widok');
  await strona.click('#widok-napisy label:has-text("Zawsze")');
  assert.deepEqual(await widoczne(strona, '.pasek-edytora .etyk-paska'), [true, true, true]);
  assert.deepEqual(bledy, []);
});
