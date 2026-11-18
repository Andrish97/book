const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// #219: język interfejsu – polski, angielski, ukraiński; wybór z menu flag, zapamiętany po odświeżeniu,
// powrót do polskiego przywraca oryginały, dopisywane później okna też są tłumaczone.
test('język: przełączenie na angielski i ukraiński, zapamiętanie, powrót do polskiego', async (t) => {
  const { strona, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.waitForSelector('#ekran-logowania', { state: 'visible' });
  const napis = () => strona.textContent('#pole-email > span');
  assert.equal(await napis(), 'E-mail albo nazwa użytkownika');

  await strona.click('#ekran-logowania [data-akcja="jezyk"]');
  await strona.waitForSelector('.menu-jezyka');
  assert.deepEqual(await strona.$$eval('.menu-jezyka button', (b) => b.map((x) => [x.dataset.jezyk, x.textContent])), [['pl', 'Polski'], ['en', 'English'], ['uk', 'Українська']]);
  await strona.click('.menu-jezyka button[data-jezyk="en"]');
  await strona.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await napis(), 'Email or username');
  assert.equal(await strona.getAttribute('#ekran-logowania [data-akcja="jezyk"] img', 'src'), 'img/jezyki/lang-en.svg');

  // Komunikat dopisany później też po angielsku.
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'zle');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.querySelector('#komunikat-logowania').textContent);
  assert.notEqual(await strona.textContent('#komunikat-logowania'), 'Nieprawidłowy e-mail lub hasło.');

  await strona.reload();
  await strona.waitForFunction(() => document.documentElement.lang === 'en' && document.querySelector('#pole-email > span').textContent === 'Email or username');

  await strona.click('#ekran-logowania [data-akcja="jezyk"]');
  await strona.click('.menu-jezyka button[data-jezyk="uk"]');
  await strona.waitForFunction(() => document.documentElement.lang === 'uk');
  assert.equal(await napis(), 'Ел. пошта або ім’я користувача');

  await strona.click('#ekran-logowania [data-akcja="jezyk"]');
  await strona.click('.menu-jezyka button[data-jezyk="pl"]');
  await strona.waitForFunction(() => document.documentElement.lang === 'pl');
  assert.equal(await napis(), 'E-mail albo nazwa użytkownika');
  assert.equal(await strona.textContent('#przycisk-logowania'), 'Zaloguj się');
  assert.deepEqual(bledy, []);
});

test('język: edytor po angielsku – menu, panele i pozycja „Język” w menu ⋯', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => localStorage.setItem('makietka-jezyk', 'en'));
  await strona.reload();
  await strona.waitForFunction(() => document.documentElement.lang === 'en');
  await nowyProjekt(strona, 'Language');
  // Pozycja menu zachowuje swój napis (nie staje się flagą).
  assert.equal(await strona.$eval('[role="menuitem"][data-akcja="jezyk"]', (e) => e.textContent.trim()), 'Język / Language / Мова');
  // Polskich słów z interfejsu nie widać w głównych przyciskach paska.
  const polskie = await strona.evaluate(() => [...document.querySelectorAll('button[title]')].filter((b) => b.offsetParent).map((b) => b.title).filter((x) => /[ąęłńóśźż]/i.test(x) && !/Мова|Język:/.test(x)));
  assert.ok(polskie.length < 5, `nieprzetłumaczone podpowiedzi: ${polskie.join(' | ')}`);
  assert.deepEqual(bledy, []);
});
