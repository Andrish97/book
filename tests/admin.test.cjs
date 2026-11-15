// Panel administratora (#/admin, decyzje #95, #110) i formularz kontaktowy – w przeglądarce na atrapie bazy
// (tests/atrapa-poczta.cjs, TinyMCE – zaślepka tests/atrapa-tinymce.js): tylko administrator widzi panel; skrzynka jako
// klient poczty (foldery, lista z zaznaczaniem i operacjami zbiorczymi, rozmowa z bezpieczną treścią HTML, pisanie
// z Do/DW/UDW, podpowiedziami, załącznikami, kopiami roboczymi, odpowiedź / wszystkim / przekazanie, zgłoszenia,
// zmiany na żywo), kolejka, ustawienia poczty (zapis, podpis, zła domena, bez kluczy, test), statystyki bez kont
// testowych; formularz kontaktowy z ekranu logowania i z menu; telefon – lista, rozmowa i pisanie osobno.

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

test('panel administratora: tylko dla administratora; skrzynka – rozmowy, odpowiedź przez kolejkę z cytatem i nagłówkami, archiwum; kolejka; ustawienia z podpisem; statystyki bez kont testowych', async (t) => {
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
  baza.pliki.set('poczta/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pomysl.txt', { typ: 'text/plain', tresc: Buffer.from('szablon tygodniowy') });
  baza.adminPoczta.przyjmij({
    od_email: 'ola@przyklad.pl', do_email: 'noreply@makietka.app', temat: 'Pomysł', tekst: 'Dodajcie szablon tygodniowy.',
    zalaczniki: [{ nazwa: 'pomysl.txt', typ: 'text/plain', rozmiar: 18, klucz: 'poczta/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pomysl.txt' }],
  });
  // Konto testowe (example.com) – nie liczy się do statystyk.
  baza.konta.push({ id: '55555555-5555-4555-8555-555555555555', email: 'seriodruk-test-8fcc174b40@example.com', haslo: 'x', potwierdzone: true, nazwa: 'test' });
  await jakoAdmin(strona, baza);
  await strona.click('#awatar');
  // Licznik dochodzi z bazy po chwili (pod obciążeniem dłużej) – czekamy na niego, zamiast czytać od razu (#137).
  await strona.waitForFunction(() => document.querySelector('#admin-licznik-menu')?.textContent === '2', null, { timeout: 15000 }).catch(() => {});
  assert.equal(await strona.textContent('#admin-licznik-menu'), '2', 'licznik nieprzeczytanych przy pozycji menu');
  await strona.click('#pozycja-admin');
  await naEkranie(strona, 'admin');
  assert.equal(await strona.evaluate(() => location.hash), '#/admin');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 2);
  await strona.waitForFunction(() => document.querySelector('#admin-nieprzeczytane')?.textContent === '2', null, { timeout: 15000 }).catch(() => {});
  assert.equal(await strona.textContent('#admin-nieprzeczytane'), '2');
  assert.equal(await strona.textContent('#admin-foldery [data-folder="skrzynka"] .licznik-folderu'), '2');
  assert.equal(await strona.locator('#admin-watki li.nowy').count(), 2);
  assert.equal(await strona.textContent('#admin-watki li:has-text("Pomysł") .plakietka-zrodla'), 'na noreply@');
  assert.equal(await strona.locator('#admin-watki li:has-text("Faktura") .plakietka-zrodla').count(), 0, 'na skrzynkę – bez plakietki');
  assert.equal(await strona.locator('#admin-watki li:has-text("Pomysł") [data-ikona="spinacz"]').count(), 1, 'spinacz przy rozmowie z załącznikiem');
  // Na komputerze trzy kolumny: foldery, lista i podgląd obok siebie.
  for (const sel of ['.skrzynka-foldery', '.skrzynka-lista', '#admin-watek']) assert.ok(await strona.isVisible(sel), sel);

  // Rozmowa i odpowiedź: adresat, „Re:”, podpis i cytat; wysyłka przez kolejkę z In-Reply-To i References.
  await strona.click('#admin-watki li:has-text("Faktura") .otworz');
  await strona.waitForSelector('#admin-watek .wiadomosc.przychodzaca');
  assert.match(await strona.textContent('#admin-watek'), /Proszę o fakturę za druk\./);
  assert.equal(await strona.textContent('#admin-nieprzeczytane'), '1', 'otwarta – przeczytana');
  await strona.click('#admin-watek .watek-odpowiedz [data-pisz-tryb="odpowiedz"]');
  await strona.waitForSelector('#admin-pisz:not([hidden]) .atrapa-tinymce');
  assert.deepEqual(await strona.locator('[data-adresy="do"] .adres').allTextContents(), ['jan@przyklad.pl']);
  assert.equal(await strona.inputValue('#admin-pisz-temat'), 'Re: Faktura');
  const tresc = await strona.textContent('.atrapa-tinymce');
  assert.match(tresc, /Pozdrawiamy[\s\S]*Zespół Makietki/, 'podpis');
  assert.match(tresc, /napisał\(a\):[\s\S]*Proszę o fakturę za druk\./, 'cytat');
  await strona.evaluate(() => {
    const ed = window.tinymce.get('admin-pisz-tresc');
    ed.setContent(`<p>Dzień dobry, faktura w załączniku.</p>${ed.getContent()}`);
    ed.fire('input');
  });
  await strona.click('#admin-form-pisz [type="submit"]');
  await strona.waitForSelector('#admin-watek .wiadomosc.wychodzaca');
  await strona.waitForFunction(() => /wysłano/.test(document.querySelector('#admin-watek .wiadomosc.wychodzaca .stan-wysylki')?.textContent || ''));
  const odp = baza.wyslane.find((w) => w.typ === 'odpowiedz');
  assert.equal(odp.email, 'jan@przyklad.pl');
  assert.equal(odp.temat, 'Re: Faktura');
  assert.match(odp.naglowki['In-Reply-To'], /@przyklad\.pl>$/);
  assert.equal(odp.naglowki.References, odp.naglowki['In-Reply-To']);
  assert.match(odp.html, /<p>Dzień dobry, faktura w załączniku\.<\/p>[\s\S]*<blockquote>/);
  assert.equal(baza.poczta.robocze.length, 0, 'po wysłaniu bez kopii roboczej');
  assert.equal(await strona.isVisible('#admin-pisz'), false);

  // Archiwum: rozmowa znika z odebranych i jest w archiwum.
  await strona.click('#admin-watek [data-watek-akcja="archiwum"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 1);
  await strona.click('#admin-foldery [data-folder="archiwum"]');
  await strona.waitForFunction(() => document.querySelector('#admin-watki li')?.textContent.includes('Faktura'));
  // W „Wysłanych” – rozmowa z naszą odpowiedzią, z adresatem zamiast nadawcy.
  await strona.click('#admin-foldery [data-folder="wyslane"]');
  await strona.waitForFunction(() => /Do: jan@przyklad\.pl/.test(document.querySelector('#admin-watki li .od')?.textContent || ''));
  // Rozmowa z noreply@: adres przy wiadomości, załącznik do pobrania (tylko administrator – przez Workera).
  await strona.click('#admin-foldery [data-folder="skrzynka"]');
  await strona.click('#admin-watki li:has-text("Pomysł") .otworz');
  await strona.waitForSelector('#admin-watek .na-adres');
  assert.equal(await strona.textContent('#admin-watek .na-adres'), 'na noreply@makietka.app');
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#admin-watek [data-zalacznik]')]);
  assert.equal(plik.suggestedFilename(), 'pomysl.txt');
  assert.equal(require('node:fs').readFileSync(await plik.path(), 'utf8'), 'szablon tygodniowy');
  // Wyszukiwanie.
  await strona.fill('#admin-szukaj', 'nic-takiego');
  await strona.waitForSelector('#admin-watki-pusto:not([hidden])');
  assert.match(await strona.textContent('#admin-watki-pusto'), /Nic nie pasuje/);
  await strona.fill('#admin-szukaj', '');

  // Kolejka: odpowiedź jako wysłana, dostawca z licznikiem dnia.
  await strona.click('[data-admin="kolejka"]');
  await strona.waitForSelector('#admin-kolejka li');
  assert.match(await strona.textContent('#admin-kolejka'), /wysłany.*Odpowiedź ze skrzynki → jan@przyklad\.pl/s);
  assert.match(await strona.textContent('#admin-dostawcy-stan'), /Brevo.*Dziś 1 z 300/s);

  // Ustawienia: zapis limitu dostawcy, odstępu i podpisu; obca domena nadawcy – błąd; żadnego klucza do kopiowania; test wysyłki.
  await strona.click('[data-admin="ustawienia"]');
  await strona.waitForSelector('#admin-dostawcy tbody tr');
  assert.equal(await strona.inputValue('#admin-form-ustawien [name="podpis"]'), 'Pozdrawiamy\nZespół Makietki');
  await strona.fill('#admin-dostawcy [name="dzienny_limit"]', '250');
  await strona.fill('#admin-odstepy tr[data-akcja-odstepu="kontakt:email"] [name="sekundy"]', '600');
  await strona.fill('#admin-form-ustawien [name="podpis"]', 'Anna z Makietki');
  await strona.click('#admin-form-ustawien [type="submit"]');
  await strona.waitForFunction(() => document.querySelector('#admin-ustawienia-komunikat').textContent === 'Zapisano.');
  assert.equal(baza.poczta.dostawcy[0].dzienny_limit, 250);
  assert.equal(baza.poczta.odstepy.find((o) => o.akcja === 'kontakt:email').sekundy, 600);
  assert.equal(baza.poczta.ustawienia.podpis, 'Anna z Makietki');
  // Po „Zapisano.” formularz rysuje się jeszcze raz z bazy – wpisany za wcześnie adres zostałby nadpisany zapisaną
  // wartością (pod obciążeniem bywało) – wpisujemy więc do skutku, aż serwer odrzuci adres spoza domeny (#137).
  for (let proba = 0; proba < 5; proba += 1) {
    await strona.fill('#admin-form-ustawien [name="nadawca_email"]', 'ja@gmail.com');
    await strona.click('#admin-form-ustawien [type="submit"]');
    const ok = await strona.waitForFunction(() => /domenie makietka\.app/.test(document.querySelector('#admin-ustawienia-komunikat').textContent), null, { timeout: 6000 }).then(() => true, () => false);
    if (ok) break;
  }
  await strona.waitForFunction(() => /domenie makietka\.app/.test(document.querySelector('#admin-ustawienia-komunikat').textContent));
  assert.equal(await strona.locator('#ekran-admin [id*="klucz"], #ekran-admin input[readonly]').count(), 0, 'w panelu nie ma kluczy do kopiowania');
  assert.equal(await strona.inputValue('#admin-test-adres'), baza.konta[0].email);
  await strona.click('#admin-form-test [type="submit"]');
  await strona.waitForFunction(() => /Wysłano mail testowy/.test(document.querySelector('#admin-test-komunikat').textContent));

  // Statystyki: kafelki i trzy wykresy; konto testowe (example.com) się nie liczy.
  await strona.click('[data-admin="statystyki"]');
  await strona.waitForSelector('#admin-kafelki .admin-kafelek');
  assert.ok(await strona.locator('#admin-kafelki .admin-kafelek').count() >= 8);
  assert.equal(await strona.textContent('#admin-kafelki .admin-kafelek:first-child strong'), '1', 'konto testowe nie liczy się do kont');
  assert.equal(await strona.locator('#admin-wykresy svg').count(), 3);
  // Miejsce całej aplikacji – tylko tutaj: pliki R2 z puli (Worker) i baza z największymi tabelami (rozmiary_tabel).
  assert.match(await strona.textContent('#admin-kafelki'), /Pliki \(R2\).*puli.*Baza.*12\.0 MB.*z 500 MB/s);
  assert.equal(await strona.locator('#admin-tabele tbody tr').count(), 2);
  assert.match(await strona.textContent('#admin-tabele'), /public\.strony.*6\.0 MB/s);
  assert.equal(await strona.evaluate(() => location.hash), '#/admin/statystyki');
  assert.deepEqual(bledy, []);
});

test('skrzynka: nowa wiadomość z Do/DW/UDW, podpowiedziami i załącznikiem; kopia robocza zapisana w trakcie pisania; przekazanie z załącznikiem; odpowiedź wszystkim', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  const w = baza.adminPoczta.przyjmij({
    od_email: 'ola@przyklad.pl', od_nazwa: 'Ola', temat: 'Cennik', tekst: 'Proszę o cennik.',
    do_lista: ['kontakt@makietka.app', 'piotr@przyklad.pl'], dw: ['ania@przyklad.pl'],
  });
  await jakoAdmin(strona, baza);
  await strona.evaluate(() => { location.hash = '#/admin/skrzynka'; });
  await naEkranie(strona, 'admin');
  await strona.waitForSelector('#admin-watki li');

  // Nowa wiadomość: podpowiedź adresu (znane adresy z poczty), DW i UDW, temat, treść, załącznik do R2.
  await strona.click('#admin-napisz');
  await strona.waitForSelector('#admin-pisz:not([hidden]) .atrapa-tinymce');
  assert.equal(await strona.textContent('#admin-pisz-tytul'), 'Nowa wiadomość');
  assert.match(await strona.textContent('.atrapa-tinymce'), /Zespół Makietki/, 'podpis w nowej wiadomości');
  await strona.fill('#admin-pisz-do', 'pio');
  await strona.waitForSelector('#admin-podpowiedzi:not([hidden]) li');
  assert.match(await strona.textContent('#admin-podpowiedzi'), /piotr@przyklad\.pl/);
  await strona.keyboard.press('Enter');
  assert.deepEqual(await strona.locator('[data-adresy="do"] .adres').allTextContents(), ['piotr@przyklad.pl']);
  await strona.click('#admin-pisz-kopie');
  await strona.fill('#admin-pisz-dw', 'ania@przyklad.pl,');
  await strona.fill('#admin-pisz-udw', 'szef@przyklad.pl');
  await strona.keyboard.press('Enter');
  await strona.fill('#admin-pisz-temat', 'Oferta druku');
  await strona.click('.atrapa-tinymce');
  await strona.keyboard.press('Control+Home');
  await strona.keyboard.type('Przesyłam ofertę.');
  await strona.setInputFiles('#admin-pisz-pliki', { name: 'oferta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 oferta') });
  await strona.waitForFunction(() => /kB/.test(document.querySelector('#admin-pisz-zalaczniki .zalacznik')?.textContent || ''));
  const kluczOferty = [...baza.pliki.keys()].find((k) => /^poczta\/[0-9a-f-]{36}\/oferta\.pdf$/.test(k));
  assert.ok(kluczOferty, 'załącznik w R2 pod poczta/<uuid>/');
  // Kopia robocza zapisuje się sama.
  await strona.waitForFunction(() => /Zapisano/.test(document.querySelector('#admin-pisz-stan').textContent), null, { timeout: 8000 });
  assert.equal(baza.poczta.robocze.length, 1);
  assert.deepEqual(baza.poczta.robocze[0].dw, ['ania@przyklad.pl']);
  assert.equal(baza.poczta.robocze[0].zalaczniki[0].klucz, kluczOferty);
  // Zamknięcie – zostaje w Robocze; otwarcie z folderu przywraca wszystko.
  await strona.click('#admin-form-pisz .pisz-zamknij');
  await strona.waitForFunction(() => document.querySelector('#admin-pisz').hidden);
  await strona.click('#admin-foldery [data-folder="robocze"]');
  await strona.waitForSelector('#admin-watki li .plakietka.robocza');
  assert.equal(await strona.textContent('#admin-foldery [data-folder="robocze"] .licznik-folderu'), '1');
  await strona.click('#admin-watki li .otworz');
  await strona.waitForSelector('#admin-pisz:not([hidden])');
  assert.equal(await strona.inputValue('#admin-pisz-temat'), 'Oferta druku');
  assert.deepEqual(await strona.locator('[data-adresy="udw"] .adres').allTextContents(), ['szef@przyklad.pl']);
  assert.match(await strona.textContent('.atrapa-tinymce'), /Przesyłam ofertę\./);
  await strona.click('#admin-form-pisz [type="submit"]');
  await strona.waitForSelector('#admin-watek .wiadomosc.wychodzaca');
  const nowa = baza.wyslane.find((x) => x.typ === 'wiadomosc');
  assert.deepEqual([nowa.do, nowa.dw, nowa.udw], [['piotr@przyklad.pl'], ['ania@przyklad.pl'], ['szef@przyklad.pl']]);
  assert.equal(nowa.temat, 'Oferta druku');
  assert.deepEqual(nowa.zalaczniki.map((z) => z.klucz), [kluczOferty]);
  assert.deepEqual(nowa.naglowki, {}, 'nowa wiadomość – bez nagłówków wątku');
  assert.equal(baza.poczta.robocze.length, 0, 'kopia robocza znika po wysłaniu');
  assert.match(await strona.textContent('#admin-watek .wiadomosc-adresaci'), /do: piotr@przyklad\.pl · dw: ania@przyklad\.pl · udw: szef@przyklad\.pl/);
  // Nowa rozmowa leży w Wysłanych, nie w Odebranych.
  await strona.click('#admin-foldery [data-folder="wyslane"]');
  await strona.waitForFunction(() => document.querySelector('#admin-watki li')?.textContent.includes('Oferta druku'));

  // Odpowiedź wszystkim: nadawca i pozostali adresaci (bez naszego adresu), DW zostaje.
  await strona.click('#admin-foldery [data-folder="skrzynka"]');
  await strona.click(`#admin-watki li[data-id="${w.id}"] .otworz`);
  await strona.waitForSelector('#admin-watek [data-pisz-tryb="wszystkim"]');
  await strona.click('#admin-watek .watek-odpowiedz [data-pisz-tryb="wszystkim"]');
  await strona.waitForSelector('#admin-pisz:not([hidden])');
  assert.deepEqual(await strona.locator('[data-adresy="do"] .adres').allTextContents(), ['ola@przyklad.pl', 'piotr@przyklad.pl']);
  assert.deepEqual(await strona.locator('[data-adresy="dw"] .adres').allTextContents(), ['ania@przyklad.pl']);
  // Odrzucenie – bez kopii roboczej.
  await strona.click('#admin-form-pisz [data-pisz="odrzuc"]');
  await strona.waitForFunction(() => document.querySelector('#admin-pisz').hidden);
  assert.equal(baza.poczta.robocze.length, 0);

  // Przekazanie: „Fwd:”, puste Do, treść i załączniki oryginału.
  baza.pliki.set('poczta/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cennik.pdf', { typ: 'application/pdf', tresc: Buffer.from('%PDF cennik') });
  const z = baza.adminPoczta.przyjmij({
    od_email: 'ola@przyklad.pl', temat: 'Cennik', tekst: 'Cennik w załączniku.', watek: w.id,
    zalaczniki: [{ nazwa: 'cennik.pdf', typ: 'application/pdf', rozmiar: 11, klucz: 'poczta/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cennik.pdf' }],
  });
  assert.equal(z.id, w.id);
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watek .wiadomosc').length === 2, null, { timeout: 8000 });
  await strona.click('#admin-watek .wiadomosc:last-of-type [data-pisz-tryb="przekaz"]');
  await strona.waitForSelector('#admin-pisz:not([hidden])');
  assert.equal(await strona.inputValue('#admin-pisz-temat'), 'Fwd: Cennik');
  assert.equal(await strona.locator('[data-adresy="do"] .adres').count(), 0);
  assert.match(await strona.textContent('.atrapa-tinymce'), /Przekazana wiadomość[\s\S]*Od:[\s\S]*ola@przyklad\.pl[\s\S]*Cennik w załączniku\./);
  assert.match(await strona.textContent('#admin-pisz-zalaczniki'), /cennik\.pdf/);
  // Bez adresata – komunikat, nic nie wychodzi.
  await strona.click('#admin-form-pisz [type="submit"]');
  await strona.waitForFunction(() => /Podaj adresata/.test(document.querySelector('#powiadomienie')?.textContent || ''));
  await strona.fill('#admin-pisz-do', 'druk@przyklad.pl');
  await strona.click('#admin-form-pisz [type="submit"]');
  await strona.waitForFunction(() => document.querySelector('#admin-pisz').hidden);
  const fwd = baza.wyslane.find((x) => x.temat === 'Fwd: Cennik');
  assert.deepEqual(fwd.do, ['druk@przyklad.pl']);
  assert.deepEqual(fwd.zalaczniki.map((x) => x.nazwa), ['cennik.pdf']);
  assert.deepEqual(fwd.naglowki, {}, 'przekazanie – bez In-Reply-To');
  assert.deepEqual(bledy, []);
});

test('skrzynka: zaznaczanie i operacje zbiorcze (przeczytane, gwiazdka, archiwum, spam, kosz, przywrócenie, usunięcie na zawsze), zgłoszenia z formularza, nowa poczta na żywo, bezpieczna treść HTML', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  const a = baza.adminPoczta.przyjmij({ od_email: 'a@przyklad.pl', temat: 'Pierwsza', tekst: 'Jeden' });
  const b = baza.adminPoczta.przyjmij({ od_email: 'b@przyklad.pl', temat: 'Druga', tekst: 'Dwa' });
  // Wiadomość HTML ze skryptem, zdarzeniem i obrazem z internetu.
  baza.adminPoczta.przyjmij({
    od_email: 'news@przyklad.pl', temat: 'Biuletyn', tekst: 'Biuletyn',
    html: '<html><head><style>p{color:#123456}</style><meta http-equiv="refresh" content="0;url=https://zle.example"></head><body><p id="tresc">Witaj <b>w biuletynie</b></p><img src="https://sledzenie.example/piksel.png" alt="piksel"><a href="javascript:alert(1)">klik</a><script>parent.document.title = "ZHAKOWANE"</script><img src="x" onerror="parent.document.title=\'ZHAKOWANE\'"></body></html>',
  });
  baza.poczta.sekretWorkera = true;
  baza.adminPoczta.kontakt({ email: 'klient@przyklad.pl', temat: 'Druk A5', tresc: 'Czy drukujecie w formacie A5?' }, null);
  await jakoAdmin(strona, baza);
  await strona.evaluate(() => { location.hash = '#/admin/skrzynka'; });
  await naEkranie(strona, 'admin');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 4);

  // Zgłoszenie z formularza: numer, folder Zgłoszenia, zamknięcie.
  assert.match(await strona.textContent('#admin-watki li:has-text("Druk A5") .plakietka.zgloszenie'), /^ZGL-\d{4}-0001$/);
  assert.equal(await strona.textContent('#admin-foldery [data-folder="zgloszenia"] .licznik-folderu'), '1');
  await strona.click('#admin-foldery [data-folder="zgloszenia"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 1);
  await strona.click('#admin-watki li .otworz');
  await strona.waitForSelector('#admin-watek .watek-zgloszenie');
  assert.match(await strona.textContent('#admin-watek .watek-zgloszenie'), /Zgłoszenie ZGL-\d{4}-0001.*otwarte.*z formularza/s);
  await strona.click('#admin-watek .watek-zgloszenie [data-watek-akcja="zamknij"]');
  await strona.waitForFunction(() => /zamknięte/.test(document.querySelector('#admin-watek .watek-zgloszenie')?.textContent || ''));
  assert.equal(baza.poczta.watki.find((x) => x.zgloszenie).zgloszenie_stan, 'zamkniete');
  await strona.waitForFunction(() => document.querySelector('#admin-foldery [data-folder="zgloszenia"] .licznik-folderu')?.textContent === '', null, { timeout: 15000 }).catch(() => {});
  assert.equal(await strona.textContent('#admin-foldery [data-folder="zgloszenia"] .licznik-folderu'), '');
  // Odpowiedź na zgłoszenie – numer w temacie.
  await strona.click('#admin-watek .watek-odpowiedz [data-pisz-tryb="odpowiedz"]');
  await strona.waitForSelector('#admin-pisz:not([hidden]) .atrapa-tinymce');
  await strona.click('#admin-form-pisz [type="submit"]');
  await strona.waitForFunction(() => document.querySelector('#admin-pisz').hidden);
  assert.match(baza.wyslane.at(-1).temat, /^Re: Druk A5 \[ZGL-\d{4}-0001\]$/);
  assert.equal(baza.wyslane.at(-1).email, 'klient@przyklad.pl');

  // Zaznaczanie: „wszystkie”, potem dwie; przeczytane, gwiazdka, archiwum.
  await strona.click('#admin-foldery [data-folder="skrzynka"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 4);
  await strona.check('#admin-zaznacz-wszystkie');
  assert.equal(await strona.locator('#admin-watki li.zaznaczony').count(), 4);
  assert.equal(await strona.isVisible('#admin-zbiorcze'), true);
  await strona.uncheck('#admin-zaznacz-wszystkie');
  assert.equal(await strona.isVisible('#admin-zbiorcze'), false);
  for (const id of [a.id, b.id]) await strona.check(`#admin-watki li[data-id="${id}"] .wybor input`);
  assert.equal(await strona.textContent('#admin-zaznaczone'), '2 zaznaczone');
  await strona.click('#admin-zbiorcze [data-zbiorczo="przeczytane"]');
  await strona.waitForFunction(() => !document.querySelector('#admin-watki li:has(.wybor input:checked)'));
  assert.ok([a, b].every((x) => x.przeczytany));
  await strona.click(`#admin-watki li[data-id="${a.id}"] .gwiazdka`);
  for (let i = 0; i < 50 && !a.gwiazdka; i += 1) await strona.waitForTimeout(50);
  assert.equal(a.gwiazdka, true);
  await strona.click('#admin-foldery [data-folder="gwiazdka"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 1);
  await strona.click('#admin-foldery [data-folder="skrzynka"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 4);
  for (const id of [a.id, b.id]) await strona.check(`#admin-watki li[data-id="${id}"] .wybor input`);
  await strona.click('#admin-zbiorcze [data-zbiorczo="archiwum"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 2);
  assert.deepEqual([a.folder, b.folder], ['archiwum', 'archiwum']);
  // Spam, kosz, przywrócenie, usunięcie na zawsze (z potwierdzeniem), opróżnienie kosza.
  await strona.click('#admin-foldery [data-folder="archiwum"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 2);
  await strona.check(`#admin-watki li[data-id="${b.id}"] .wybor input`);
  await strona.click('#admin-zbiorcze [data-zbiorczo="spam"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 1);
  await strona.click('#admin-foldery [data-folder="spam"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 1);
  await strona.check(`#admin-watki li[data-id="${b.id}"] .wybor input`);
  await strona.click('#admin-zbiorcze [data-zbiorczo="przywroc"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 0);
  assert.equal(b.folder, 'skrzynka');
  await strona.click('#admin-foldery [data-folder="archiwum"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 1);
  await strona.check(`#admin-watki li[data-id="${a.id}"] .wybor input`);
  await strona.click('#admin-zbiorcze [data-zbiorczo="kosz"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 0);
  await strona.click('#admin-foldery [data-folder="kosz"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 1);
  assert.equal(await strona.isVisible('#admin-oproznij'), true);
  await strona.check(`#admin-watki li[data-id="${a.id}"] .wybor input`);
  await strona.click('#admin-zbiorcze [data-zbiorczo="usun"]');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 0);
  assert.equal(baza.poczta.watki.some((x) => x.id === a.id), false, 'usunięta na zawsze');

  // Nowa poczta na żywo (Realtime) – bez odświeżania.
  await strona.click('#admin-foldery [data-folder="skrzynka"]');
  await strona.waitForFunction(() => document.querySelectorAll('#admin-watki li').length === 3);
  baza.adminPoczta.przyjmij({ od_email: 'nowy@przyklad.pl', temat: 'Na żywo', tekst: 'Przyszło przed chwilą.' });
  await strona.waitForFunction(() => document.querySelector('#admin-watki li')?.textContent.includes('Na żywo'), null, { timeout: 8000 });
  await strona.waitForFunction(() => document.querySelector('#admin-nieprzeczytane').textContent === '2');

  // Treść HTML: ramka bez skryptów (sandbox), bez meta refresh i zdarzeń, obrazy z internetu dopiero na żądanie.
  await strona.click('#admin-watki li:has-text("Biuletyn") .otworz');
  const ramka = strona.locator('#admin-watek iframe.ramka-wiadomosci');
  await ramka.waitFor();
  assert.equal(await ramka.getAttribute('sandbox'), 'allow-popups allow-popups-to-escape-sandbox allow-same-origin');
  const srcdoc = await ramka.getAttribute('srcdoc');
  assert.doesNotMatch(srcdoc, /<script|onerror|javascript:|http-equiv="refresh"/i);
  assert.match(srcdoc, /img-src data: cid:"/, 'obrazy z internetu zablokowane (CSP)');
  assert.match(srcdoc, /p\{color:#123456\}/, 'style wiadomości zostają');
  const tekst = await strona.frameLocator('#admin-watek iframe.ramka-wiadomosci').locator('#tresc').textContent();
  assert.equal(tekst, 'Witaj w biuletynie');
  assert.notEqual(await strona.title(), 'ZHAKOWANE');
  await strona.click('#admin-watek .pasek-obrazow button');
  await strona.waitForFunction(() => /img-src data: cid: https: http:/.test(document.querySelector('#admin-watek iframe.ramka-wiadomosci')?.getAttribute('srcdoc') || ''));
  assert.equal(await strona.locator('#admin-watek .pasek-obrazow').count(), 0);
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
  // Załączniki (#116): plik na liście, usuwanie z listy, wysyłka razem z wiadomością.
  await strona.setInputFiles('#kontakt-pliki', [
    { name: 'zrzut.png', mimeType: 'image/png', buffer: Buffer.from('obraz') },
    { name: 'zbedny.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
  ]);
  assert.equal(await strona.locator('#kontakt-lista-plikow li').count(), 2);
  await strona.click('#kontakt-lista-plikow li:nth-child(2) button');
  assert.equal(await strona.locator('#kontakt-lista-plikow li').count(), 1);
  await strona.click('#kontakt-wyslij');
  await zamkniete(strona);
  const zal = baza.poczta.wiadomosci.find((m) => m.od_email === 'gosc@przyklad.pl')?.zalaczniki || [];
  assert.deepEqual(zal.map((z) => z.nazwa), ['zrzut.png'], 'załącznik w zgłoszeniu');
  assert.equal(await strona.locator('#kontakt-lista-plikow li').count(), 0, 'lista czysta po wysłaniu');
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

test('skrzynka na telefonie: foldery i lista, potem rozmowa, potem pisanie – każde na cały ekran, z powrotem; nic poza ekranem', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { telefon: true });
  baza.adminPoczta.przyjmij({ od_email: 'jan@przyklad.pl', temat: 'Pytanie o druk w formacie A5 z twardą okładką', tekst: 'Dzień dobry, czy da się wydrukować kalendarz A5?' });
  await jakoAdmin(strona, baza);
  await strona.evaluate(() => { location.hash = '#/admin/skrzynka'; });
  await naEkranie(strona, 'admin');
  await strona.waitForSelector('#admin-watki li');
  const pozaEkranem = () => strona.evaluate(() => [...document.querySelectorAll('#ekran-admin button:not(.lista-folderow button), #ekran-admin input:not([type="checkbox"]):not([type="file"]), #ekran-admin .atrapa-tinymce')]
    .filter((e) => e.offsetParent && e.getClientRects().length).map((e) => e.getBoundingClientRect()).filter((r) => r.width && (r.right > innerWidth + 1 || r.left < -1)).length);
  const widoczne = (sel) => strona.isVisible(sel);
  assert.equal(await widoczne('#admin-watek'), false, 'na telefonie najpierw sama lista');
  assert.equal(await widoczne('.skrzynka-foldery'), true, 'foldery jako pasek nad listą');
  assert.equal(await widoczne('#admin-napisz'), true, '„Napisz” w rogu');
  assert.equal(await pozaEkranem(), 0);
  await strona.click('#admin-watki li .otworz');
  await strona.waitForSelector('#admin-watek .wiadomosc');
  assert.equal(await widoczne('.skrzynka-lista'), false, 'rozmowa zamiast listy');
  assert.equal(await widoczne('.skrzynka-foldery'), false);
  assert.equal(await pozaEkranem(), 0, 'żaden przycisk ani pole rozmowy nie wychodzi poza ekran');
  assert.equal(await strona.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  // Pisanie odpowiedzi – osobny ekran; wstecz wraca do rozmowy.
  await strona.click('#admin-watek .watek-odpowiedz [data-pisz-tryb="odpowiedz"]');
  await strona.waitForSelector('#admin-pisz:not([hidden]) .atrapa-tinymce');
  assert.equal(await widoczne('#admin-watek'), false);
  assert.equal(await widoczne('#admin-form-pisz .pisz-wstecz'), true);
  assert.equal(await pozaEkranem(), 0, 'żaden przycisk ani pole pisania nie wychodzi poza ekran');
  await strona.click('#admin-form-pisz .pisz-wstecz');
  await strona.waitForSelector('#admin-watek .wiadomosc', { state: 'visible' });
  await strona.click('#admin-watek .watek-wstecz');
  await strona.waitForSelector('.skrzynka-lista', { state: 'visible' });
  // Nowa wiadomość z listy.
  await strona.click('#admin-napisz');
  await strona.waitForSelector('#admin-pisz:not([hidden])');
  assert.equal(await widoczne('.skrzynka-lista'), false);
  await strona.click('#admin-form-pisz .pisz-wstecz');
  await strona.waitForSelector('.skrzynka-lista', { state: 'visible' });
  assert.deepEqual(bledy, []);
});
