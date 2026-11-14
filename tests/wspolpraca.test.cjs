// Współpraca między kontami (decyzja #86, migracja 20261114120000_wspolpraca.sql): zaproszenie, przyjęcie,
// wspólna edycja na żywo, obecność, rola „może oglądać”, odebranie dostępu, opuszczenie projektu.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, drugieUrzadzenie, nowyProjekt, zamknijOkno, PNG_2X2 } = require('./pomoc.cjs');

const ANNA = { id: '11111111-1111-4111-8111-111111111111', email: 'anna@test.pl', haslo: 'Dobre#Haslo1', potwierdzone: true, nazwa: 'Anna' };
const BARTEK = { id: '22222222-2222-4222-8222-222222222222', email: 'bartek@test.pl', haslo: 'Dobre#Haslo2', potwierdzone: true, nazwa: 'Bartek' };
const CELINA = { id: '33333333-3333-4333-8333-333333333333', email: 'celina@test.pl', haslo: 'Dobre#Haslo3', potwierdzone: true, nazwa: 'Celina' };
const konta = () => [ANNA, BARTEK, CELINA].map((k) => ({ ...k }));

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu')?.textContent === 'Zapisano', null, { timeout: 15000 });

async function zaloguj(strona, konto) {
  await strona.waitForSelector('#form-logowania input[name=email]', { state: 'visible' });
  await strona.fill('#form-logowania input[name=email]', konto.email);
  await strona.fill('#form-logowania input[name=haslo]', konto.haslo);
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await zamknijOkno(strona, '#dlg-instrukcja');
}

async function projektAnny(t) {
  const srodowisko = await otworz(t, { konta: konta() });
  const { strona } = srodowisko;
  await nowyProjekt(strona, 'Wspólny kalendarz');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ text: 'Tytuł Anny', top: 40 }); e.aktywny.setCoords(); e.zatwierdz(); e.odznacz(); });
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.evaluate(() => window.seriodruk.edytor.odznacz());
  await zapisano(strona);
  return srodowisko;
}

// Okno „Współpraca” z otwartego projektu: zaprasza adres z rolą, zwraca link z zaproszenia.
async function zapros(strona, email, rola) {
  await strona.click('#przycisk-wiecej');
  await strona.click('#menu-wiecej [data-akcja="wspolpraca"]');
  await strona.waitForSelector('#dlg-wspolpraca[open] #form-zaproszenia:not([hidden])');
  await strona.fill('#wspolpraca-email', email);
  await strona.selectOption('#wspolpraca-rola', rola).catch(async () => {
    await strona.evaluate((r) => { const s = document.querySelector('#wspolpraca-rola'); s.value = r; s.dispatchEvent(new Event('change', { bubbles: true })); }, rola);
  });
  await strona.click('#wspolpraca-zapros');
  await strona.waitForSelector('#wspolpraca-gotowe:not([hidden])');
  const link = await strona.inputValue('#wspolpraca-link');
  await strona.waitForFunction((e) => [...document.querySelectorAll('#wspolpraca-osoby li')].some((li) => li.textContent.includes(e)), email.toLowerCase());
  return link;
}

const tekstNaPlotnie = (strona, tekst) => strona.waitForFunction((x) => window.seriodruk.edytor?.canvas?.getObjects().some((o) => o.text === x), tekst, { timeout: 15000 });

test('zaproszenie e-mailem: plakietka „Zaproszenia” na żywo, przyjęcie, projekt na liście jako udostępniony, wspólna edycja na żywo w obie strony, obecność', async (t) => {
  const anna = await projektAnny(t);
  const { baza } = anna;
  const id = baza.projekty[0].id;

  // Bartek czeka na liście projektów – zaproszenie ma przyjść bez odświeżania.
  const bartek = await drugieUrzadzenie(anna);
  await zaloguj(bartek.strona, BARTEK);
  await bartek.strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  assert.equal(await bartek.strona.locator('#przycisk-zaproszenia').isHidden(), true, 'bez zaproszeń nie ma przycisku');
  assert.equal(await bartek.strona.locator('#siatka-projektow .karta-projektu').count(), 0, 'cudzego projektu nie widać przed zaproszeniem');

  const link = await zapros(anna.strona, 'Bartek@Test.pl', 'edycja');
  assert.match(link, /#\/zaproszenie\/[\w-]+$/);
  assert.match(await anna.strona.getAttribute('#wspolpraca-mail', 'href'), /^mailto:bartek%40test\.pl\?subject=/);
  await anna.strona.waitForFunction(() => /Wysłano e-mail z zaproszeniem na adres bartek@test\.pl\. Zaproszenie czeka też/.test(document.querySelector('#wspolpraca-gotowe-opis').textContent));
  assert.deepEqual(baza.wyslane.filter((w) => w.typ === 'zaproszenie').map((w) => w.email), ['bartek@test.pl']);
  await zamknijOkno(anna.strona, '#dlg-wspolpraca');

  await bartek.strona.waitForSelector('#przycisk-zaproszenia:not([hidden])', { timeout: 15000 });
  assert.equal(await bartek.strona.textContent('#liczba-zaproszen'), '1');
  await bartek.strona.click('#przycisk-zaproszenia');
  await bartek.strona.waitForSelector('#dlg-zaproszenia[open] #zaproszenia-lista li');
  assert.match(await bartek.strona.textContent('#zaproszenia-lista'), /Wspólny kalendarz[\s\S]*Anna zaprasza · może edytować/);
  await bartek.strona.click('#zaproszenia-lista li button.glowny');
  await bartek.strona.waitForFunction((pid) => window.seriodruk.stan.projekt?.id === pid && document.body.dataset.ekran === 'edytor', id, { timeout: 15000 });
  await tekstNaPlotnie(bartek.strona, 'Tytuł Anny');
  assert.equal(await bartek.strona.evaluate(() => document.body.classList.contains('wspolpracownik')), true);
  assert.equal(await bartek.strona.locator('#menu-wiecej [data-akcja="dostep-ai"]').isHidden(), true, 'dostęp dla AI – tylko właściciel');

  // Obecność: każde widzi drugie (inicjał w pasku edytora).
  await anna.strona.waitForFunction(() => [...document.querySelectorAll('#obecnosc .awatar-obecnosci')].some((k) => k.textContent === 'B'), null, { timeout: 15000 });
  await bartek.strona.waitForFunction(() => [...document.querySelectorAll('#obecnosc .awatar-obecnosci')].some((k) => k.textContent === 'A'), null, { timeout: 15000 });

  // Bartek zmienia tytuł – Anna widzi to na żywo; Anna przesuwa prostokąt – Bartek widzi to na żywo.
  await bartek.strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.text === 'Tytuł Anny'); o.set({ text: 'Tytuł od Bartka' }); e.canvas.fire('object:modified', { target: o }); });
  await zapisano(bartek.strona);
  await tekstNaPlotnie(anna.strona, 'Tytuł od Bartka');
  const idProstokata = await anna.strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'rect').id);
  await anna.strona.evaluate((pid) => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.id === pid); o.set({ top: 150 }); o.setCoords(); e.canvas.fire('object:modified', { target: o }); }, idProstokata);
  await zapisano(anna.strona);
  await bartek.strona.waitForFunction((pid) => Math.round(window.seriodruk.edytor.canvas.getObjects().find((o) => o.id === pid)?.top) === 150, idProstokata, { timeout: 15000 });
  assert.equal(await anna.strona.locator('#dlg-konflikt[open]').count(), 0);
  assert.equal(await bartek.strona.locator('#dlg-konflikt[open]').count(), 0);

  // Obraz wgrany przez współpracownika trafia do folderu plików właściciela projektu.
  await bartek.strona.setInputFiles('#plik-obraz', { name: 'logo.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await bartek.strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'image'), null, { timeout: 15000 });
  await zapisano(bartek.strona);
  await bartek.strona.waitForFunction(() => Object.values(window.seriodruk.stan.projekt.zasoby).some((z) => z.sciezka), null, { timeout: 15000 });
  const sciezka = await bartek.strona.evaluate(() => Object.values(window.seriodruk.stan.projekt.zasoby).find((z) => z.sciezka).sciezka);
  assert.ok(sciezka.startsWith(`${ANNA.id}/${id}/`), `obraz w folderze właściciela: ${sciezka}`);
  await anna.strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'image' && o.getElement()?.naturalWidth === 2), null, { timeout: 15000 });

  // Lista projektów Bartka: projekt z plakietką „Anna · edytuje”, menu z „Opuść projekt” zamiast „Usuń”.
  await bartek.strona.click('#ekran-edytora [data-akcja="do-projektow"]');
  await bartek.strona.waitForSelector('#siatka-projektow .karta-projektu.wspoldzielony');
  assert.match(await bartek.strona.textContent('.plakietka-wspolpracy'), /Anna/);
  assert.match(await bartek.strona.textContent('.karta-projektu.wspoldzielony small'), /^Możesz edytować · /);
  assert.equal(await bartek.strona.locator('#filtry-projektow').isVisible(), true);
  assert.match(await bartek.strona.textContent('#podsumowanie-projektow'), /1 projekt – udostępniony Ci/);
  await bartek.strona.click('.karta-projektu .menu-karty');
  assert.equal(await bartek.strona.locator('.karta-projektu .menu [data-op="usun"]').count(), 0);
  assert.equal(await bartek.strona.locator('.karta-projektu .menu [data-op="opusc"]').count(), 1);
  // Na koncie: projekt dalej Anny, wersje od obojga.
  assert.equal(baza.projekty[0].owner_id, ANNA.id);
  assert.deepEqual(anna.bledy, []);
  assert.deepEqual(bartek.bledy, []);
});

test('link z zaproszeniem przed zalogowaniem; rola „może oglądać” – tylko podgląd, bez zapisu; odebranie dostępu; opuszczenie projektu', async (t) => {
  const anna = await projektAnny(t);
  const { baza } = anna;
  const id = baza.projekty[0].id;
  baza.brevo = false; // poczta aplikacji nieskonfigurowana – link do wysłania samemu
  const link = await zapros(anna.strona, 'inny-adres@example.com', 'odczyt');
  await anna.strona.waitForFunction(() => /nie wysyła jeszcze e-maili/.test(document.querySelector('#wspolpraca-gotowe-opis').textContent));
  assert.equal(baza.wyslane.filter((w) => w.typ === 'zaproszenie').length, 0);
  const kod = link.split('#/zaproszenie/')[1];
  await zamknijOkno(anna.strona, '#dlg-wspolpraca');

  // Celina dostaje link (zaproszenie poszło na inny adres) i otwiera go, zanim się zaloguje.
  const celina = await drugieUrzadzenie(anna);
  await celina.strona.goto(`${anna.adres}#/zaproszenie/${kod}`);
  await celina.strona.waitForSelector('#form-logowania input[name=email]', { state: 'visible' });
  await celina.strona.waitForFunction(() => /zaproszenie do projektu/i.test(document.body.textContent));
  await zaloguj(celina.strona, CELINA);
  await celina.strona.waitForSelector('#dlg-zaproszenie[open]', { timeout: 15000 });
  assert.match(await celina.strona.textContent('#zaproszenie-opis'), /Anna zaprasza Cię[\s\S]*może oglądać[\s\S]*inny-adres@example\.com[\s\S]*celina@test\.pl/);
  await celina.strona.click('#zaproszenie-przyjmij');
  await celina.strona.waitForFunction(() => document.body.dataset.ekran === 'podglad' && document.body.classList.contains('tylko-ogladanie'), null, { timeout: 15000 });
  assert.equal(await celina.strona.locator('[data-akcja="podglad-zamknij"]').isHidden(), true, 'oglądająca nie przejdzie do edytora');
  assert.equal(await celina.strona.locator('#ekran-podgladu [data-akcja="do-projektow"]').isVisible(), true);
  assert.equal(await celina.strona.locator('[data-akcja="udostepnij"]').isHidden(), true);
  // Esc w podglądzie nie otwiera edytora.
  await celina.strona.keyboard.press('Escape');
  await celina.strona.waitForTimeout(300);
  assert.equal(await celina.strona.evaluate(() => document.body.dataset.ekran), 'podglad');
  const zapisy = baza.zapisy.length;
  await celina.strona.waitForTimeout(2500);
  assert.equal(baza.zapisy.length, zapisy, 'oglądająca nic nie zapisuje na koncie');
  // Kod jest jednorazowy.
  assert.equal(baza.zaproszenia.find((z) => z.kod === kod).stan, 'przyjete');

  // Zmiana u Anny dochodzi do podglądu Celiny.
  await anna.strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.text === 'Tytuł Anny'); o.set({ text: 'Nowy tytuł' }); e.canvas.fire('object:modified', { target: o }); });
  await zapisano(anna.strona);
  await celina.strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].obiekty.some((o) => o.text === 'Nowy tytuł'), null, { timeout: 15000 });

  // Anna widzi Celinę na liście osób i odbiera jej dostęp – Celina traci projekt.
  await anna.strona.click('#przycisk-wiecej');
  await anna.strona.click('#menu-wiecej [data-akcja="wspolpraca"]');
  await anna.strona.waitForFunction(() => /Celina[\s\S]*może oglądać/.test(document.querySelector('#wspolpraca-osoby')?.textContent || ''));
  await anna.strona.click('#wspolpraca-osoby li.osoba-wspolpracownik button.niebezpieczny');
  await anna.strona.click('#potwierdz-tak');
  await anna.strona.waitForFunction(() => !/Celina/.test(document.querySelector('#wspolpraca-osoby')?.textContent || ''), null, { timeout: 10000 });
  assert.equal(baza.wspolpracownicy.length, 0);
  await zamknijOkno(anna.strona, '#dlg-wspolpraca');
  await celina.strona.click('#ekran-podgladu [data-akcja="do-projektow"]');
  await celina.strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && !document.querySelector('#siatka-projektow .szkielet'));
  await celina.strona.waitForFunction(() => !document.querySelector('#siatka-projektow .karta-projektu'), null, { timeout: 10000 });

  // Bartek przyjmuje zaproszenie (edycja) i sam opuszcza projekt.
  await zapros(anna.strona, 'bartek@test.pl', 'edycja');
  await zamknijOkno(anna.strona, '#dlg-wspolpraca');
  const bartek = await drugieUrzadzenie(anna);
  await zaloguj(bartek.strona, BARTEK);
  await bartek.strona.waitForSelector('#przycisk-zaproszenia:not([hidden])', { timeout: 15000 });
  await bartek.strona.click('#przycisk-zaproszenia');
  await bartek.strona.click('#zaproszenia-lista li button.glowny');
  await bartek.strona.waitForFunction((pid) => window.seriodruk.stan.projekt?.id === pid, id, { timeout: 15000 });
  await bartek.strona.click('#ekran-edytora [data-akcja="do-projektow"]');
  await bartek.strona.waitForSelector('#siatka-projektow .karta-projektu.wspoldzielony');
  await bartek.strona.click('.karta-projektu .menu-karty');
  await bartek.strona.click('.karta-projektu .menu [data-op="opusc"]');
  await bartek.strona.click('#potwierdz-tak');
  await bartek.strona.waitForFunction(() => !document.querySelector('#siatka-projektow .karta-projektu'), null, { timeout: 10000 });
  assert.equal(baza.wspolpracownicy.length, 0);
  assert.deepEqual(celina.bledy, []);
  assert.deepEqual(bartek.bledy, []);
});

test('reguły: tylko właściciel zaprasza i odbiera dostęp; obcy nie widzi projektu ani nie zapisze; oglądający nie zapisze', async (t) => {
  const anna = await projektAnny(t);
  const { baza } = anna;
  const id = baza.projekty[0].id;
  const k = (konto) => baza.konta.find((x) => x.id === konto.id);
  const wsp = (nazwa, parametry, konto) => { try { return baza.wspolpraca(nazwa, parametry, k(konto)); } catch (e) { return { blad: e.message, kod: e.kod }; } };
  assert.match(wsp('zapros_do_projektu', { p_projekt: id, p_email: 'x@test.pl', p_rola: 'edycja' }, BARTEK).blad, /tylko właściciel/);
  assert.match(wsp('zapros_do_projektu', { p_projekt: id, p_email: 'anna@test.pl', p_rola: 'edycja' }, ANNA).blad, /Twój adres/);
  assert.match(wsp('zapros_do_projektu', { p_projekt: id, p_email: 'bez-malpy', p_rola: 'edycja' }, ANNA).blad, /adres e-mail/);
  const z1 = wsp('zapros_do_projektu', { p_projekt: id, p_email: 'celina@test.pl', p_rola: 'odczyt' }, ANNA);
  const z2 = wsp('zapros_do_projektu', { p_projekt: id, p_email: 'Celina@test.pl', p_rola: 'edycja' }, ANNA);
  assert.equal(z1.kod, z2.kod, 'drugie zaproszenie na ten sam adres odnawia pierwsze');
  assert.equal(baza.zaproszenia.length, 1);
  assert.equal(wsp('moje_zaproszenia', {}, CELINA).length, 1);
  assert.equal(wsp('moje_zaproszenia', {}, BARTEK).length, 0, 'zaproszenie widzi tylko adresat');
  assert.match(wsp('osoby_projektu', { p_projekt: id }, BARTEK).blad, /Nie masz dostępu/);
  wsp('przyjmij_zaproszenie', { p_kod: z1.kod }, CELINA);
  assert.equal(wsp('zaproszenie_z_kodu', { p_kod: z1.kod }, BARTEK).stan, 'przyjete', 'kod jednorazowy');
  assert.equal(wsp('osoby_projektu', { p_projekt: id }, CELINA).find((o) => o.typ === 'wspolpracownik').rola, 'edycja');
  assert.match(wsp('usun_z_projektu', { p_projekt: id, p_uzytkownik: CELINA.id }, BARTEK).blad, /tylko właściciel/);
  wsp('zmien_role_wspolpracownika', { p_projekt: id, p_uzytkownik: CELINA.id, p_rola: 'odczyt' }, ANNA);

  // Zapis projektu: oglądająca i obcy – odmowa.
  const zapis = (konto) => anna.strona.evaluate(async ({ pid, e, h }) => {
    const sb = await (await import('./js/chmura.js')).supabase();
    const { data, error } = await sb.auth.signInWithPassword({ email: e, password: h });
    if (error) return { blad: error.message };
    const projekt = await sb.from('projekty').select('wersja').eq('id', pid).maybeSingle();
    const w = await sb.rpc('zapisz_projekt', { p_id: pid, p_znana_wersja: projekt.data?.wersja ?? 1, p_wymus: false, p_nazwa: 'X', p_dane: { strony: [], strony_osobno: true }, p_zmieniono: new Date().toISOString(), p_strony: [] });
    return { widzi: Boolean(projekt.data), kod: w.error?.code || null, ok: Boolean(w.data?.wersja), uzytkownik: data.user.id };
  }, { pid: id, e: konto.email, h: konto.haslo });
  const c = await zapis(CELINA);
  assert.deepEqual([c.widzi, c.kod, c.ok], [true, '42501', false]);
  const b = await zapis(BARTEK);
  assert.deepEqual([b.widzi, b.kod, b.ok], [false, '42501', false]);
  assert.equal(baza.projekty[0].nazwa, 'Wspólny kalendarz');
});
