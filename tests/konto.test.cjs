const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, ekran } = require('./pomoc.cjs');

const HASLO = 'Dobre#Haslo1';

async function zaloguj(strona, email = 'anna@test.pl', haslo = HASLO) {
  await strona.waitForSelector('#ekran-logowania', { state: 'visible' });
  await strona.fill('#form-logowania input[name=email]', email);
  await strona.fill('#form-logowania input[name=haslo]', haslo);
  await strona.click('#przycisk-logowania');
}

async function zalogujIZamknijInstrukcje(strona) {
  await zaloguj(strona);
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.click('[data-akcja="zamknij-instrukcje"]');
}

test('logowanie: błędne hasło, poprawne hasło, sesja po odświeżeniu, wylogowanie', async (t) => {
  const { strona, bledy } = await otworz(t, { tryb: 'atrapa' });
  await zaloguj(strona, 'anna@test.pl', 'zle');
  await strona.waitForFunction(() => document.querySelector('#komunikat-logowania').textContent);
  assert.equal(await strona.textContent('#komunikat-logowania'), 'Nieprawidłowy e-mail lub hasło.');

  await zalogujIZamknijInstrukcje(strona);
  assert.equal(await ekran(strona), 'projekty');
  assert.equal(await strona.textContent('#awatar'), 'A');

  await strona.reload();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');

  await strona.click('#awatar');
  await strona.click('[data-akcja="wyloguj"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'logowanie');
  await strona.reload();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'logowanie');
  assert.deepEqual(bledy, []);
});

test('rejestracja: zasady hasła, wysłany link, ponowna wysyłka, konto już istnieje', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.click('#tryb-logowania label:has-text("Nowe konto")');
  await strona.fill('#form-logowania input[name=nazwa]', 'Jan');
  await strona.fill('#form-logowania input[name=email]', 'jan@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'slabe');
  assert.equal(await strona.locator('#zasady-hasla li.spelniona').count(), 1); // tylko mała litera
  await strona.click('#przycisk-logowania');
  assert.match(await strona.textContent('#komunikat-logowania'), /W haśle brakuje: min\. 8 znaków, wielka litera, cyfra, znak specjalny/);

  await strona.fill('#form-logowania input[name=haslo]', HASLO);
  assert.equal(await strona.locator('#zasady-hasla li.spelniona').count(), 5);
  await strona.fill('#form-logowania input[name=haslo2]', 'Inne#Haslo1');
  await strona.click('#przycisk-logowania');
  assert.equal(await strona.textContent('#komunikat-logowania'), 'Hasła nie są takie same.');

  await strona.fill('#form-logowania input[name=haslo2]', HASLO);
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#widok-wyslano', { state: 'visible' });
  assert.match(await strona.textContent('#wyslano-opis'), /jan@test\.pl/);
  assert.deepEqual(baza.wyslane, [{ typ: 'potwierdzenie', email: 'jan@test.pl' }]);
  assert.equal(baza.konta.find((k) => k.email === 'jan@test.pl').nazwa, 'Jan');
  assert.ok(await strona.isDisabled('#wyslij-ponownie'), 'ponowna wysyłka dopiero po chwili');

  // Niepotwierdzone konto nie zaloguje się – trafia na ekran z ponowną wysyłką.
  await strona.click('#widok-wyslano [data-tryb="logowanie"]');
  await zaloguj(strona, 'jan@test.pl');
  await strona.waitForSelector('#widok-wyslano', { state: 'visible' });
  assert.match(await strona.textContent('#komunikat-wyslano'), /czeka na potwierdzenie/);
  await strona.click('#wyslij-ponownie');
  await strona.waitForFunction(() => document.querySelector('#komunikat-wyslano').textContent.includes('Wysłano ponownie'));
  assert.equal(baza.wyslane.at(-1).typ, 'ponownie');

  // Adres już zarejestrowany i potwierdzony.
  await strona.click('#widok-wyslano [data-tryb="logowanie"]');
  await strona.click('#tryb-logowania label:has-text("Nowe konto")');
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', HASLO);
  await strona.fill('#form-logowania input[name=haslo2]', HASLO);
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.querySelector('#komunikat-logowania').textContent);
  assert.match(await strona.textContent('#komunikat-logowania'), /już istnieje/);
  assert.deepEqual(bledy, []);
});

test('reset hasła: prośba o link, powrót z linku i ustawienie nowego hasła', async (t) => {
  const { strona, baza, adres, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.click('#link-reset');
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#widok-wyslano', { state: 'visible' });
  assert.deepEqual(baza.wyslane, [{ typ: 'reset', email: 'anna@test.pl' }]);

  // Link z wiadomości wraca do aplikacji z tokenem w adresie.
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const k = baza.konta[0];
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: k.id, email: k.email, exp, role: 'authenticated', aud: 'authenticated' })}.podpis`;
  await strona.goto(`${adres}#access_token=${token}&refresh_token=r-${k.id}&expires_in=3600&expires_at=${exp}&token_type=bearer&type=recovery`);
  await strona.reload();
  await strona.waitForSelector('#tytul-logowania:has-text("Ustaw nowe hasło")');
  assert.equal(await ekran(strona), 'logowanie');
  await strona.fill('#form-logowania input[name=haslo]', 'Nowe#Haslo22');
  await strona.fill('#form-logowania input[name=haslo2]', 'Nowe#Haslo22');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  assert.equal(k.haslo, 'Nowe#Haslo22');
  assert.deepEqual(bledy, []);
});

test('wygasły link z e-maila pokazuje komunikat na ekranie logowania', async (t) => {
  const { strona, adres } = await otworz(t, { tryb: 'atrapa' });
  await strona.goto(`${adres}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
  await strona.reload();
  await strona.waitForFunction(() => document.querySelector('#komunikat-logowania').textContent);
  assert.match(await strona.textContent('#komunikat-logowania'), /Link wygasł/);
});

test('ustawienia konta: nazwa, e-mail, hasło, usunięcie konta', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await zalogujIZamknijInstrukcje(strona);
  await nowyProjekt(strona, 'Mój projekt');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
  assert.equal(baza.projekty.length, 1, 'projekt zapisany na koncie');
  await strona.click('[data-akcja="do-projektow"]:visible');
  await strona.waitForSelector('.karta-projektu:not(.szkielet)');

  await strona.click('#awatar');
  await strona.click('[data-akcja="ustawienia-konta"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'konto');
  assert.equal(new URL(strona.url()).hash, '#/konto');
  await strona.waitForFunction(() => document.querySelector('#konto-projekty').textContent === '1');

  // Nazwa
  await strona.fill('#form-nazwa input[name=nazwa]', 'Anna Nowak');
  await strona.click('#form-nazwa button[type=submit]');
  await strona.waitForSelector('#form-nazwa .komunikat.sukces');
  assert.equal(baza.konta[0].nazwa, 'Anna Nowak');

  // E-mail: różne adresy → błąd; zgodne → oczekiwanie na potwierdzenie
  await strona.fill('#form-email input[name=email]', 'nowa@test.pl');
  await strona.fill('#form-email input[name=email2]', 'inna@test.pl');
  await strona.click('#form-email button[type=submit]');
  assert.equal(await strona.textContent('#form-email .komunikat'), 'Adresy e-mail nie są takie same.');
  await strona.fill('#form-email input[name=email2]', 'nowa@test.pl');
  await strona.click('#form-email button[type=submit]');
  await strona.waitForSelector('#email-oczekuje', { state: 'visible' });
  assert.equal(await strona.textContent('#email-oczekuje-adres'), 'nowa@test.pl');
  assert.equal(baza.wyslane.at(-1).typ, 'zmiana-email');

  // Hasło: złe obecne → błąd; poprawne → zmiana
  await strona.fill('#form-haslo input[name=obecne]', 'zle');
  await strona.fill('#form-haslo input[name=nowe]', 'Nowe#Haslo22');
  await strona.fill('#form-haslo input[name=nowe2]', 'Nowe#Haslo22');
  await strona.click('#form-haslo button[type=submit]');
  await strona.waitForFunction(() => document.querySelector('#form-haslo .komunikat').textContent);
  assert.equal(await strona.textContent('#form-haslo .komunikat'), 'Obecne hasło jest nieprawidłowe.');
  await strona.fill('#form-haslo input[name=obecne]', HASLO);
  await strona.fill('#form-haslo input[name=nowe]', 'Nowe#Haslo22');
  await strona.fill('#form-haslo input[name=nowe2]', 'Nowe#Haslo22');
  await strona.click('#form-haslo button[type=submit]');
  await strona.waitForSelector('#form-haslo .komunikat.sukces');
  assert.equal(baza.konta[0].haslo, 'Nowe#Haslo22');

  // Odświeżenie zostaje na ustawieniach konta.
  await strona.reload();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'konto');

  // Usunięcie konta
  await strona.fill('#form-usun input[name=haslo]', 'Nowe#Haslo22');
  await strona.click('#form-usun button[type=submit]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'logowanie');
  assert.equal(baza.konta.length, 0);
  assert.equal(baza.projekty.length, 0);
  assert.deepEqual(bledy, []);
});
