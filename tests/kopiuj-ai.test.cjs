// „Kopiuj i wklej” jako trzecia droga w Ustawieniach → Sztuczna inteligencja (#254): wybór projektu i otwarcie go
// od razu z Asystentem AI w tym trybie (#/p/<id>/asystent).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

test('Sztuczna inteligencja → Kopiuj i wklej: projekt otwiera się z Asystentem AI w trybie kopiuj i wklej', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Do czatu');
  await zapisano(strona);
  const id = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  for (let i = 0; i < 60 && !baza.projekty.some((p) => p.id === id); i += 1) await strona.waitForTimeout(250);
  await strona.evaluate(() => { location.hash = '#/konto/ai'; });
  await strona.waitForSelector('[data-sekcja-ai="kopiuj"]');
  assert.deepEqual(await strona.$$eval('#dostep-ai [data-sekcja-ai]', (b) => b.map((x) => x.textContent)), ['Czat w Makietce', 'Łącznik w aplikacji AI', 'Kopiuj i wklej', 'Czat otwierający strony']);
  await strona.click('[data-sekcja-ai="kopiuj"]');
  const tekst = await strona.locator('#dostep-ai .sekcja-kluczy-ai:visible .wyjasnienie-ai').textContent();
  assert.match(tekst, /bez klucza i bez opłat.*darmowy ChatGPT.*nie dostaje żadnego klucza/s);
  await strona.waitForFunction((pid) => [...document.querySelectorAll('#ai-kopiuj-projekt option')].some((o) => o.value === pid), id);
  await strona.selectOption('#ai-kopiuj-projekt', id);
  await strona.click('[data-akcja="ai-kopiuj-otworz"]');
  await strona.waitForSelector('#dlg-czat-ai[open]');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.id), id);
  assert.equal(await strona.inputValue('#czat-ai-ustawienia [name="dostawca"]'), 'schowek');
  assert.equal(await strona.isVisible('#czat-ai-schowek-opis'), false, 'ustawienia zwinięte – tryb wybrany');
  await strona.waitForFunction(() => !/\/asystent$/.test(location.hash), null, { timeout: 5000 });
  assert.deepEqual(bledy, []);
});
