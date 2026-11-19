// Silnik stylów, krok 3 (#292): katalog komponentów (katalog-komponentow.html) – te same arkusze w tej samej
// kolejności co aplikacja, żaden komponent w wyglądzie przeglądarki (strażnik), oba motywy, próbki tokenów.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { otworz } = require('./pomoc.cjs');
const { sprawdzStyle } = require('./straznik-stylow.cjs');

const arkusze = (plik) => [...fs.readFileSync(path.join(__dirname, '..', plik), 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);

test('katalog komponentów: arkusze jak w aplikacji, strażnik w obu motywach, próbki kolorów', async (t) => {
  const zAplikacji = arkusze('index.html');
  const zKatalogu = arkusze('katalog-komponentow.html');
  assert.deepEqual(zKatalogu.slice(0, zAplikacji.length), zAplikacji, 'katalog wczytuje arkusze aplikacji w tej samej kolejności');
  assert.deepEqual(zKatalogu.slice(zAplikacji.length), ['css/style/ekrany/katalog.css']);
  const { strona, bledy } = await otworz(t, { tryb: 'bez-bazy', sciezka: 'katalog-komponentow.html', widok: { width: 1200, height: 900 } });
  await strona.waitForSelector('.katalog-probka');
  const wynik = {};
  for (const motyw of ['jasny', 'ciemny']) {
    await strona.click(`[name="motyw"][value="${motyw}"] + span`);
    await strona.click('#otworz-okno');
    wynik[motyw] = {
      straznik: await sprawdzStyle(strona, motyw),
      probki: await strona.$$eval('.katalog-probka', (p) => p.length),
      tlo: await strona.evaluate(() => getComputedStyle(document.body).backgroundColor),
      ikony: await strona.$$eval('.przycisk-ikona svg', (s) => s.length),
    };
    await strona.keyboard.press('Escape');
  }
  assert.deepEqual([wynik.jasny.straznik, wynik.ciemny.straznik], [[], []]);
  assert.ok(wynik.jasny.probki >= 20, `próbek kolorów: ${wynik.jasny.probki}`);
  assert.notEqual(wynik.jasny.tlo, wynik.ciemny.tlo, 'motyw ciemny zmienia tło');
  assert.ok(wynik.jasny.ikony >= 4, 'ikony wstawione');
  assert.deepEqual(bledy, []);
});
