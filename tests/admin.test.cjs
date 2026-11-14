// Panel administratora (#/admin, decyzja #95) i formularz kontaktowy – w przeglądarce na atrapie bazy
// (tests/atrapa-poczta.cjs): tylko administrator widzi panel; skrzynka (wątki, odpowiedź przez kolejkę,
// foldery), kolejka, ustawienia poczty (zapis, zła domena, bez kluczy do kopiowania, test), statystyki; formularz
// kontaktowy z ekranu logowania i z menu (Worker bez sekretu – komunikat, limit – „spróbuj za…”); telefon.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

// Zamknięte okno jest niewidoczne – czekamy na sam stan, nie na widoczność.
const zamkniete = (strona) => strona.waitForFunction(() => !document.querySelector('#dlg-kontakt').open);
const naEkranie = (strona, ekran) => strona.waitForFunction((e) => document.body.dataset.ekran === e, ekran, { timeout: 15000 });

// Konto testowe staje się administratorem; po przeładowaniu sesja zostaje, a aplikacja pyta bazę od nowa.
async function jakoAdmin(strona, baza) {
  baza.administratorzy.add(baza.konta[0].id);
  await strona.reload();
  await naEkranie(strona, 'projekty');
}

test('panel administratora: tylko dla administratora; skrzynka – wątki, odpowiedź przez kolejkę, foldery; kolejka; ustawienia; statystyki', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  // Zwykłe konto: bez pozycji w menu, adres #/admin wraca do projektów.
  await strona.click('#awatar');
  assert.equal(await strona.isVisible('#pozycja-admin'), false);
  await strona.keyboard.press('Escape');
  await strona.evaluate(() => { location.hash = '#/admin'; });
  await strona.waitForFunction(() => location.hash === '#/projekty');
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'projekty');

  baza.adminPoczta.przyjmij({ od_email: 'jan@przyklad.pl', od_nazwa: 'Jan', temat: 'Faktura', tekst: 'Proszę o fakturę za druk.' });
  // Druga – na noreply@ (Email Routing → Worker), z załącznikiem zapisanym w R2.
  baza.pliki.set('poczta/u1/pomysl.txt', { typ: 'text/plain', tresc: Buffer.from('szablon tygodniowy') });
  baza.adminPoczta.przyjmij({
    od_email: 'ola@przyklad.pl', do_email: 'noreply@makietka.app', temat: 'Pomysł', tekst: 'Dodajcie szablon tygodniowy.',
    zalaczniki: [{ nazwa: 'pomysl.txt', typ: 'text/plain', rozmiar: 18, klucz: 'poczta/u1/pomysl.txt' }],
  });
  await jakoAdmin(strona, baza);
  await strona.click('#awatar');
  await strona.click('#pozycja-admin');
  await naEkranie(strona, 'admin');
  assert.equal(await strona.evaluate(() => location.hash), '#/admin');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 2);
  assert.equal(await strona.textContent('#admin-nieprzeczytane'), '2');
  assert.equal(await strona.locator('#admin-watki li.nowy').count(), 2);
  assert.equal(await strona.textContent('#admin-watki li:has-text("Pomysł") .plakietka-zrodla'), 'na noreply@');
  assert.equal(await strona.locator('#admin-watki li:has-text("Faktura") .plakietka-zrodla').count(), 0, 'na skrzynkę – bez plakietki');

  // Rozmowa i odpowiedź – idzie przez kolejkę, przebieg od razu („wysłano”).
  await strona.click('#admin-watki li:has-text("Faktura") button');
  await strona.waitForSelector('#admin-watek .wiadomosc.przychodzaca');
  assert.match(await strona.textContent('#admin-watek'), /Proszę o fakturę za druk\./);
  await strona.fill('#admin-watek textarea', 'Dzień dobry, faktura w załączniku.');
  await strona.click('#admin-watek .form-odpowiedzi [type="submit"]');
  await strona.waitForSelector('#admin-watek .wiadomosc.wychodzaca');
  await strona.waitForFunction(() => /wysłano/.test(document.querySelector('#admin-watek .wiadomosc.wychodzaca .stan-wysylki')?.textContent || ''));
  assert.ok(baza.wyslane.some((w) => w.typ === 'odpowiedz' && w.email === 'jan@przyklad.pl'), 'odpowiedź wysłana do nadawcy');
  assert.equal(await strona.textContent('#admin-nieprzeczytane'), '1');

  // Archiwum: rozmowa znika z odebranych i jest w archiwum.
  await strona.click('#admin-watek [data-przenies="archiwum"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 1);
  await strona.click('#admin-foldery [data-folder="archiwum"]');
  await strona.waitForFunction(() => document.querySelector('#admin-watki li')?.textContent.includes('Faktura'));
  // Rozmowa z noreply@: adres przy wiadomości, załącznik do pobrania (tylko administrator – przez Workera).
  await strona.click('#admin-foldery [data-folder="skrzynka"]');
  await strona.click('#admin-watki li:has-text("Pomysł") button');
  await strona.waitForSelector('#admin-watek .na-adres');
  assert.equal(await strona.textContent('#admin-watek .na-adres'), 'na noreply@makietka.app');
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#admin-watek [data-zalacznik]')]);
  assert.equal(plik.suggestedFilename(), 'pomysl.txt');
  assert.equal(require('node:fs').readFileSync(await plik.path(), 'utf8'), 'szablon tygodniowy');
  // Wyszukiwanie.
  await strona.click('#admin-foldery [data-folder="skrzynka"]');
  await strona.fill('#admin-szukaj', 'nic-takiego');
  await strona.waitForSelector('#admin-watki-pusto:not([hidden])');
  await strona.fill('#admin-szukaj', '');

  // Kolejka: odpowiedź jako wysłana, dostawca z licznikiem dnia.
  await strona.click('[data-admin="kolejka"]');
  await strona.waitForSelector('#admin-kolejka li');
  assert.match(await strona.textContent('#admin-kolejka'), /wysłany.*Odpowiedź ze skrzynki → jan@przyklad\.pl/s);
  assert.match(await strona.textContent('#admin-dostawcy-stan'), /Brevo.*Dziś 1 z 300/s);

  // Ustawienia: zapis limitu dostawcy i odstępu; obca domena nadawcy – błąd; żadnego klucza do kopiowania; test wysyłki.
  await strona.click('[data-admin="ustawienia"]');
  await strona.waitForSelector('#admin-dostawcy tbody tr');
  await strona.fill('#admin-dostawcy [name="dzienny_limit"]', '250');
  await strona.fill('#admin-odstepy tr[data-akcja-odstepu="kontakt:email"] [name="sekundy"]', '600');
  await strona.click('#admin-form-ustawien [type="submit"]');
  await strona.waitForFunction(() => document.querySelector('#admin-ustawienia-komunikat').textContent === 'Zapisano.');
  assert.equal(baza.poczta.dostawcy[0].dzienny_limit, 250);
  assert.equal(baza.poczta.odstepy.find((o) => o.akcja === 'kontakt:email').sekundy, 600);
  await strona.fill('#admin-form-ustawien [name="nadawca_email"]', 'ja@gmail.com');
  await strona.click('#admin-form-ustawien [type="submit"]');
  await strona.waitForFunction(() => /domenie makietka\.app/.test(document.querySelector('#admin-ustawienia-komunikat').textContent));
  assert.equal(await strona.locator('#ekran-admin [id*="klucz"], #ekran-admin input[readonly]').count(), 0, 'w panelu nie ma kluczy do kopiowania');
  assert.equal(await strona.inputValue('#admin-test-adres'), baza.konta[0].email);
  await strona.click('#admin-form-test [type="submit"]');
  await strona.waitForFunction(() => /Wysłano mail testowy/.test(document.querySelector('#admin-test-komunikat').textContent));

  // Statystyki: kafelki i trzy wykresy.
  await strona.click('[data-admin="statystyki"]');
  await strona.waitForSelector('#admin-kafelki .admin-kafelek');
  assert.ok(await strona.locator('#admin-kafelki .admin-kafelek').count() >= 8);
  assert.equal(await strona.locator('#admin-wykresy svg').count(), 3);
  // Miejsce całej aplikacji – tylko tutaj: pliki R2 z puli (Worker) i baza z największymi tabelami (rozmiary_tabel).
  assert.match(await strona.textContent('#admin-kafelki'), /Pliki \(R2\).*puli.*Baza.*12\.0 MB.*z 500 MB/s);
  assert.equal(await strona.locator('#admin-tabele tbody tr').count(), 2);
  assert.match(await strona.textContent('#admin-tabele'), /public\.strony.*6\.0 MB/s);
  assert.equal(await strona.evaluate(() => location.hash), '#/admin/statystyki');
  assert.deepEqual(bledy, []);
});

test('formularz kontaktowy: z ekranu logowania i z menu; Worker bez sekretu – komunikat; limit – „spróbuj za…”; wiadomość w skrzynce administratora', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await naEkranie(strona, 'logowanie');
  await strona.click('.stopka-logowania [data-akcja="kontakt"]');
  await strona.waitForSelector('#dlg-kontakt[open]');
  await strona.fill('#kontakt-email', 'gosc@przyklad.pl');
  await strona.fill('#kontakt-temat', 'Druk');
  await strona.fill('#kontakt-tresc', 'Czy obsługujecie format A5?');
  await strona.click('#kontakt-wyslij');
  await strona.waitForFunction(() => /nie działa.*kontakt@makietka\.app/.test(document.querySelector('#kontakt-komunikat').textContent));
  assert.equal(await strona.isVisible('#dlg-kontakt'), true, 'okno zostaje otwarte z komunikatem');

  baza.poczta.sekretWorkera = true;
  await strona.click('#kontakt-wyslij');
  await zamkniete(strona);
  assert.ok(baza.wyslane.some((w) => w.typ === 'kontakt' && w.email === 'gosc@przyklad.pl'), 'potwierdzenie do nadawcy');
  assert.equal(baza.poczta.watki.length, 1);
  assert.equal(baza.poczta.watki[0].zrodlo, 'formularz');
  // Pułapka: ukryte pole – „wysłane”, a w skrzynce nic nowego.
  await strona.click('.stopka-logowania [data-akcja="kontakt"]');
  await strona.fill('#kontakt-tresc', 'Kup tanie zegarki teraz!!!');
  await strona.evaluate(() => { document.querySelector('#form-kontakt [name="www"]').value = 'http://spam'; });
  await strona.click('#kontakt-wyslij');
  await zamkniete(strona);
  assert.equal(baza.poczta.watki.length, 1);
  await strona.evaluate(() => { document.querySelector('#form-kontakt [name="www"]').value = ''; });
  // Limit: druga przechodzi, trzecia – „spróbuj ponownie za…”.
  for (const [i, oczekiwane] of [[2, null], [3, /spróbuj ponownie za 5 min/]]) {
    await strona.click('.stopka-logowania [data-akcja="kontakt"]');
    await strona.fill('#kontakt-tresc', `Wiadomość numer ${i} – dłuższa treść.`);
    await strona.click('#kontakt-wyslij');
    if (oczekiwane) await strona.waitForFunction((r) => new RegExp(r).test(document.querySelector('#kontakt-komunikat').textContent), oczekiwane.source);
    else await zamkniete(strona);
  }
  assert.equal(baza.poczta.watki.length, 2);
  assert.deepEqual(bledy, []);
});

test('panel administratora na telefonie: lista rozmów, potem rozmowa na całą szerokość z powrotem do listy; nic poza ekranem', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { telefon: true });
  baza.adminPoczta.przyjmij({ od_email: 'jan@przyklad.pl', temat: 'Pytanie o druk w formacie A5 z twardą okładką', tekst: 'Dzień dobry, czy da się wydrukować kalendarz A5?' });
  await jakoAdmin(strona, baza);
  await strona.evaluate(() => { location.hash = '#/admin/skrzynka'; });
  await naEkranie(strona, 'admin');
  await strona.waitForSelector('#admin-watki li');
  assert.equal(await strona.isVisible('#admin-watek'), false, 'na telefonie najpierw sama lista');
  await strona.click('#admin-watki li button');
  await strona.waitForSelector('#admin-watek .wiadomosc');
  assert.equal(await strona.isVisible('.admin-lista'), false, 'rozmowa zamiast listy');
  const poza = await strona.evaluate(() => [...document.querySelectorAll('#ekran-admin button, #ekran-admin textarea, #ekran-admin input')]
    .filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect()).filter((r) => r.right > innerWidth + 1 || r.left < -1).length);
  assert.equal(poza, 0, 'żaden przycisk ani pole nie wychodzi poza ekran');
  assert.equal(await strona.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await strona.click('#admin-watek .watek-wstecz');
  await strona.waitForSelector('.admin-lista', { state: 'visible' });
  assert.deepEqual(bledy, []);
});
