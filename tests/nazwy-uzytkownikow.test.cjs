// Nazwy użytkownika (#100): przy rejestracji (z podpowiedzią wolnej nazwy), przy pierwszym logowaniu konta bez
// nazwy (okno, którego nie da się pominąć), zapraszanie do projektu po nazwie (podpowiedzi, bez adresu e-mail
// zaproszonej osoby u zapraszającego).
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, zamknijOkno } = require('./pomoc.cjs');

const HASLO = 'Dobre#Haslo1';
const konto = (id, email, nazwa, reszta = {}) => ({ id, email, haslo: HASLO, potwierdzone: true, nazwa, ...reszta });
const ANNA = konto('11111111-1111-4111-8111-111111111111', 'anna@test.pl', 'Anna');
const BARTEK = konto('22222222-2222-4222-8222-222222222222', 'bartek@test.pl', 'Bartek');

async function zaloguj(strona, email) {
  await strona.waitForSelector('#form-logowania input[name=email]', { state: 'visible' });
  await strona.fill('#form-logowania input[name=email]', email);
  await strona.fill('#form-logowania input[name=haslo]', HASLO);
  await strona.click('#przycisk-logowania');
}

test('rejestracja: nazwa użytkownika – zasady, zajęta z propozycją, zapis przy pierwszym logowaniu', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa', konta: [ANNA, BARTEK] });
  await strona.click('#tryb-logowania label:has-text("Nowe konto")');
  await strona.fill('#form-logowania input[name=email]', 'celina@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', HASLO);
  await strona.fill('#form-logowania input[name=haslo2]', HASLO);
  // Za krótka – błąd zasad od razu.
  await strona.fill('#form-logowania input[name=nazwa]', 'Ce');
  await strona.click('#przycisk-logowania');
  assert.match(await strona.textContent('#komunikat-logowania'), /Nazwa użytkownika: 3–30 znaków/);
  // Zajęta (bez względu na wielkość liter) – podpowiedź z propozycją, wysyłka zablokowana.
  await strona.fill('#form-logowania input[name=nazwa]', 'bartek');
  await strona.waitForFunction(() => /jest już zajęta/.test(document.querySelector('#rejestracja-nazwa-podpowiedz').textContent));
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => /zajęta/.test(document.querySelector('#komunikat-logowania').textContent));
  assert.ok(!baza.konta.some((k) => k.email === 'celina@test.pl'), 'konto nie powstało');
  await strona.click('#rejestracja-nazwa-podpowiedz button');
  assert.equal(await strona.inputValue('#form-logowania input[name=nazwa]'), 'bartek2');
  await strona.waitForFunction(() => /„bartek2” jest wolna/.test(document.querySelector('#rejestracja-nazwa-podpowiedz').textContent));
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#widok-wyslano', { state: 'visible' });
  const celina = baza.konta.find((k) => k.email === 'celina@test.pl');
  assert.equal(celina.nazwaRejestracji, 'bartek2');
  // Po potwierdzeniu adresu – pierwsze logowanie zapisuje nazwę z rejestracji bez pytania.
  celina.potwierdzone = true;
  await strona.click('#widok-wyslano [data-tryb="logowanie"]');
  await zaloguj(strona, 'celina@test.pl');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  assert.equal(baza.profile.get(celina.id), 'bartek2');
  assert.equal(await strona.locator('#dlg-nazwa-uzytkownika[open]').count(), 0);
  assert.deepEqual(bledy, []);
});

test('pierwsze logowanie konta bez nazwy: okno „Wybierz nazwę użytkownika” z propozycją, bez pominięcia', async (t) => {
  const jan = konto('33333333-3333-4333-8333-333333333333', 'jan@test.pl', 'Jan Kowalski', { nazwaUzytkownika: null });
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa', konta: [jan, ANNA] });
  await zaloguj(strona, 'jan@test.pl');
  await strona.waitForSelector('#dlg-nazwa-uzytkownika[open]');
  assert.equal(await strona.inputValue('#nazwa-uzytkownika-pole'), 'Jan.Kowalski');
  await strona.waitForFunction(() => /jest wolna/.test(document.querySelector('#nazwa-uzytkownika-podpowiedz').textContent));
  // Esc nie zamyka – nazwa jest wymagana.
  await strona.keyboard.press('Escape');
  assert.equal(await strona.locator('#dlg-nazwa-uzytkownika[open]').count(), 1);
  // Zajęta – komunikat; wolna – zapis, okno znika, potem instrukcja jak zwykle.
  await strona.fill('#nazwa-uzytkownika-pole', 'anna');
  await strona.click('#form-nazwa-uzytkownika button[type=submit]');
  await strona.waitForFunction(() => /zajęta/.test(document.querySelector('#nazwa-uzytkownika-komunikat').textContent));
  await strona.fill('#nazwa-uzytkownika-pole', 'jan_k');
  await strona.click('#form-nazwa-uzytkownika button[type=submit]');
  await strona.waitForSelector('#dlg-nazwa-uzytkownika[open]', { state: 'detached' }).catch(() => {});
  await strona.waitForFunction(() => !document.querySelector('#dlg-nazwa-uzytkownika').open);
  assert.equal(baza.profile.get(jan.id), 'jan_k');
  assert.equal(jan.nazwa, 'jan_k', 'nazwa także w metadanych konta (do wyświetlania)');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await zamknijOkno(strona, '#dlg-instrukcja');
  assert.equal(await strona.textContent('#nazwa-uzytkownika'), 'jan_k');
  assert.deepEqual(bledy, []);
});

test('zaproszenie po nazwie użytkownika: podpowiedzi, bez adresu e-mail u zapraszającego, skrzynka zaproszonej osoby', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { konta: [ANNA, BARTEK] });
  await nowyProjekt(strona, 'Kalendarz wspólny');
  await strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
  await strona.click('#przycisk-wiecej');
  await strona.click('#menu-wiecej [data-akcja="wspolpraca"]');
  await strona.waitForSelector('#dlg-wspolpraca[open] #form-zaproszenia:not([hidden])');
  // Podpowiedzi: po początku nazwy (bez własnej nazwy), wybór z listy.
  await strona.fill('#wspolpraca-email', 'Ba');
  await strona.waitForSelector('#wspolpraca-podpowiedzi:not([hidden]) li');
  assert.deepEqual(await strona.locator('#wspolpraca-podpowiedzi li').allTextContents(), ['@Bartek']);
  await strona.fill('#wspolpraca-email', 'An');
  await strona.waitForFunction(() => document.querySelector('#wspolpraca-podpowiedzi').hidden, null, { timeout: 5000 });
  await strona.fill('#wspolpraca-email', 'bar');
  await strona.waitForSelector('#wspolpraca-podpowiedzi:not([hidden]) li');
  await strona.click('#wspolpraca-podpowiedzi li');
  assert.equal(await strona.inputValue('#wspolpraca-email'), 'Bartek');
  // Nieistniejąca nazwa – czytelny błąd.
  await strona.fill('#wspolpraca-email', 'nikt_taki');
  await strona.click('#wspolpraca-zapros');
  await strona.waitForFunction(() => /Nie ma konta o nazwie użytkownika „nikt_taki”/.test(document.querySelector('#powiadomienie').textContent));
  // Zaproszenie po nazwie.
  await strona.fill('#wspolpraca-email', '@bartek');
  await strona.click('#wspolpraca-zapros');
  await strona.waitForSelector('#wspolpraca-gotowe:not([hidden])');
  await strona.waitForFunction(() => [...document.querySelectorAll('#wspolpraca-osoby li')].some((li) => li.textContent.includes('@Bartek')));
  const lista = await strona.textContent('#dlg-wspolpraca');
  assert.doesNotMatch(lista, /bartek@test\.pl/, 'zapraszający nie widzi adresu e-mail zaproszonej osoby');
  assert.equal(await strona.isHidden('#wspolpraca-mail'), true, 'bez „Wyślij ze swojej poczty” – adres nieznany');
  const z = baza.zaproszenia.at(-1);
  assert.equal(z.przez_nazwe, true);
  assert.equal(z.konto, BARTEK.id);
  // Skrzynka zaproszonej osoby.
  const moje = baza.wspolpraca('moje_zaproszenia', {}, BARTEK);
  assert.equal(moje.length, 1);
  assert.equal(moje[0].projekt, 'Kalendarz wspólny');
  assert.equal(moje[0].od, 'Anna');
  assert.deepEqual(bledy, []);
});
