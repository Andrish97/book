// Zatwierdzanie w czacie Makietki (#255, plan AI krok 3): przed usunięciem stron, kilku elementów, obrazów, projektu
// albo zmianą wielu stron naraz Makietka pyta; „Nie pozwalaj” – nic się nie zmienia, AI dostaje odmowę.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

test('wymagaZgody: co wymaga pytania', async () => {
  const { wymagaZgody } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'zgoda-ai.js')).href);
  assert.equal(wymagaZgody('usun_strony', { id: ['a', 'b'] }), 'usunąć 2 strony');
  assert.equal(wymagaZgody('usun_strony', { id: ['a'] }), 'usunąć 1 stronę');
  assert.equal(wymagaZgody('usun_elementy', { id: ['a', 'b'] }), null, 'dwa elementy – bez pytania');
  assert.equal(wymagaZgody('usun_elementy', { id: ['a', 'b', 'c', 'd', 'e'] }), 'usunąć 5 elementów');
  assert.match(wymagaZgody('usun_projekt', { projekt: 'x', potwierdz: 'Kalendarz' }), /cały projekt „Kalendarz”/);
  assert.equal(wymagaZgody('usun_obrazy', { nieuzywane: true }), 'usunąć wszystkie nieużywane obrazy projektu');
  assert.equal(wymagaZgody('zmien_projekt', { zmiany: { strony: [{}, {}, {}] } }), 'zmienić 3 strony naraz');
  assert.equal(wymagaZgody('zmien_projekt', { zmiany: { strony: [{}] } }), null);
  assert.equal(wymagaZgody('zmien_projekt', { zmiany: { wzorce: [] } }), 'zastąpić w całości: wzorce');
  assert.equal(wymagaZgody('zmien_elementy', { zmiany: [] }), null);
  assert.equal(wymagaZgody('nazwa_projektu', { nazwa: 'x' }), null);
});

test('kopiuj i wklej: usunięcie strony czeka na zgodę – odmowa nic nie zmienia, zgoda usuwa', async (t) => {
  const { strona, kontekst, baza, bledy } = await otworz(t);
  await kontekst.grantPermissions(['clipboard-read', 'clipboard-write']);
  await nowyProjekt(strona, 'Zgoda');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  await zapisano(strona);
  await strona.evaluate(async () => (await import('./js/app/czat-ai.js')).otworzCzatAi({ dostawca: 'schowek' }));
  await strona.waitForSelector('#dlg-czat-ai[open]');
  const idStrony = await strona.evaluate(() => window.seriodruk.stan.projekt.strony.at(-1).id);
  const ileStron = () => strona.evaluate(() => window.seriodruk.stan.projekt.strony.length);
  const przed = await ileStron();
  const wklej = async () => {
    await strona.fill('#czat-ai-tekst', `Usuwam stronę.\n\`\`\`makietka\n[{"narzedzie": "usun_strony", "parametry": {"id": ["${idStrony}"]}}]\n\`\`\``);
    await strona.press('#czat-ai-tekst', 'Enter');
    await strona.waitForSelector('.czat-ai-wiadomosci li.zgoda .rzad-przyciskow');
  };
  await wklej();
  assert.match(await strona.textContent('.czat-ai-wiadomosci li.zgoda'), /AI chce usunąć 1 stronę\. Pozwolić\?/);
  await strona.click('.czat-ai-wiadomosci li.zgoda button:has-text("Nie pozwalaj")');
  await strona.waitForFunction(() => document.querySelectorAll('.czat-ai-do-skopiowania').length === 1);
  assert.match(await strona.textContent('.czat-ai-do-skopiowania'), /BŁĄD usun_strony:\nUżytkownik nie pozwolił/);
  assert.equal(await ileStron(), przed, 'po odmowie strony zostają');

  await wklej();
  await strona.click('.czat-ai-wiadomosci li.zgoda:last-child button:has-text("Pozwól")');
  await strona.waitForFunction(() => document.querySelectorAll('.czat-ai-do-skopiowania').length === 2);
  assert.match(await strona.$$eval('.czat-ai-do-skopiowania', (l) => l[1].textContent), /WYNIK usun_strony/);
  const naKoncie = baza.projekty.find((p) => p.nazwa === 'Zgoda');
  assert.equal((naKoncie.dane.strony || []).length, przed - 1, 'po zgodzie strona usunięta na koncie');
  assert.deepEqual(bledy, []);
});
