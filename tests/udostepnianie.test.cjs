const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, krotkieLinkiGoscia } = require('./pomoc.cjs');

test('udostępnianie podglądu linkiem: publikacja, widok bez logowania, aktualizacja, wyłączenie', async (t) => {
  const { strona, baza, bledy, przegladarka, kontekst, Z_ATRAPA } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));

  await nowyProjekt(strona, 'Do pokazania');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);

  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');
  assert.ok(await strona.isHidden('#udostepnij-link-blok'), 'przed udostępnieniem nie ma linku');
  await strona.click('#udostepnij-utworz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-teraz').disabled && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 20000 });
  const link = await strona.inputValue('#udostepnij-link');
  // Krótki link (#195): adres strony i 6 znaków (małe litery i cyfry bez 0/o, 1/l/i).
  assert.match(link, /^http:\/\/[^/]+\/[a-hj-km-np-z2-9]{6}$/);
  // Link sprzed krótkich adresów (bez krotki w projekcie) dostaje krótki kod przy otwarciu okna – ten sam,
  // bo kod linku się nie zmienił.
  await strona.click('[data-akcja="udostepnij-zamknij"]');
  await strona.evaluate(() => { delete window.seriodruk.stan.projekt.udostepnienie.krotki; });
  await strona.click('[data-akcja="udostepnij"]');
  await strona.waitForFunction((l) => document.querySelector('#udostepnij-link').value === l, link);
  assert.match(await strona.textContent('#udostepnij-stan'), /aktualny stan/);
  const pliki = [...baza.pliki.keys()].filter((k) => k.startsWith('podglady/'));
  assert.equal(pliki.filter((k) => /\.(webp|jpg)$/.test(k)).length, 2, 'po jednym obrazie na stronę');
  // Obrazy stron w WebP (lżejsze od JPEG, #89) – Chromium umie je zapisać.
  assert.equal(pliki.filter((k) => k.endsWith('.webp')).length, 2);
  assert.equal(baza.pliki.get(pliki.find((k) => k.endsWith('.webp'))).typ, 'image/webp');
  assert.equal(pliki.filter((k) => k.endsWith('manifest.json')).length, 1);
  const manifest = JSON.parse(baza.pliki.get(pliki.find((k) => k.endsWith('manifest.json'))).tresc.toString());
  assert.equal(manifest.uklad.nazwa, 'Do pokazania');
  assert.equal(JSON.stringify(manifest).includes('obiekty'), false, 'manifest nie zawiera treści projektu');

  // Osoba bez konta: osobna przeglądarka, bez sesji.
  const gosc = await przegladarka.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  await krotkieLinkiGoscia(gosc, baza);
  await gosc.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: Z_ATRAPA }));
  await gosc.route('https://atrapa.supabase.co/podglady/**', async (r) => {
    const klucz = `podglady/${decodeURIComponent(new URL(r.request().url()).pathname.slice('/podglady/'.length))}`;
    const plik = baza.pliki.get(klucz);
    if (!plik) return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    return r.fulfill({ status: 200, contentType: plik.typ, body: plik.tresc, headers: { 'access-control-allow-origin': '*' } });
  });
  const obca = await gosc.newPage();
  const bledyGoscia = [];
  obca.on('pageerror', (e) => bledyGoscia.push(e.message));
  await obca.goto(link);
  await obca.waitForFunction(() => document.body.dataset.ekran === 'podglad' && document.querySelectorAll('.podglad-strona[data-id]').length === 2);
  assert.equal(await obca.textContent('#podglad-tytul'), 'Do pokazania');
  await obca.waitForFunction(() => document.querySelector('.podglad-strona[data-id] img').naturalWidth > 0);
  assert.equal(await obca.locator('button.podglad-kartka').count(), 0, 'stron nie da się kliknąć do edycji');
  assert.ok(await obca.isHidden('[data-akcja="udostepnij"]'));
  assert.ok(await obca.isHidden('[data-akcja="podglad-zamknij"]'));
  // Stary, długi link (sprzed #195) działa dalej.
  const dlugi = await strona.evaluate(() => { const p = window.seriodruk.stan.projekt; return `${location.origin}/#/u/${p.udostepnienie.konto}/${p.id}/${p.udostepnienie.kod}`; });
  const stara = await gosc.newPage();
  await stara.goto(dlugi);
  await stara.waitForFunction(() => document.body.dataset.ekran === 'podglad' && document.querySelectorAll('.podglad-strona[data-id]').length === 2);
  assert.equal(await stara.textContent('#podglad-tytul'), 'Do pokazania');
  await stara.close();
  assert.equal(await obca.locator('canvas').count() >= 0, true);
  assert.deepEqual(bledyGoscia, []);

  // Zmiana w projekcie → link aktualizuje się sam, chwilę po zapisie na koncie; adres zostaje ten sam.
  await strona.click('[data-akcja="udostepnij-zamknij"]');
  await strona.keyboard.press('Escape');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  const przedAktualizacja = baza.wyslania.length;
  const stanPrzed = await strona.evaluate(() => window.seriodruk.stan.projekt.udostepnienie.zaktualizowano);
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.waitForFunction((z) => window.seriodruk.stan.projekt.udostepnienie.zaktualizowano !== z, stanPrzed, { timeout: 25000 });
  // Zmieniła się jedna strona z dwóch: narysowany i wysłany jest tylko jej obraz, do tego opis.
  const ponownie = baza.wyslania.slice(przedAktualizacja).filter((k) => k.startsWith('podglady/'));
  assert.equal(ponownie.filter((k) => /\.(webp|jpg)$/.test(k)).length, 1);
  assert.equal(ponownie.filter((k) => k.endsWith('manifest.json')).length, 1);
  // Otwarty u gościa link sprawdza się sam (co minutę i przy powrocie do karty): podmienia się tylko
  // obraz zmienionej strony, a druga zostaje.
  const obrazyGoscia = () => obca.evaluate(() => [...document.querySelectorAll('.podglad-strona[data-id] img')].map((i) => i.getAttribute('src')));
  const uGosciaPrzed = await obrazyGoscia();
  await obca.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await obca.waitForFunction((przed) => [...document.querySelectorAll('.podglad-strona[data-id] img')].some((i, n) => i.getAttribute('src') !== przed[n]), uGosciaPrzed, { timeout: 8000 });
  const uGosciaPo = await obrazyGoscia();
  assert.equal(uGosciaPo.filter((s, n) => s !== uGosciaPrzed[n]).length, 1, 'u gościa zmienia się obraz jednej strony');
  assert.equal(await obca.evaluate(() => document.body.dataset.ekran), 'podglad');
  assert.deepEqual(bledyGoscia, []);
  await strona.click('[data-akcja="podglad"]');
  await strona.click('[data-akcja="udostepnij"]');
  assert.match(await strona.textContent('#udostepnij-stan'), /aktualny stan/);
  assert.equal(await strona.inputValue('#udostepnij-link'), link, 'aktualizacja nie zmienia adresu');
  assert.ok(await strona.isHidden('#udostepnij-utworz'), 'projekt ma jeden link – drugiego się nie tworzy');
  assert.ok(await strona.isVisible('#udostepnij-teraz'));

  // Plakietka na karcie projektu otwiera to samo okienko – z linkiem i unieważnieniem.
  await strona.click('[data-akcja="udostepnij-zamknij"]');
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.pokazProjekty(); });
  await strona.click('.karta-projektu .plakietka-linku');
  await strona.waitForSelector('#dlg-udostepnij[open]');
  assert.equal(await strona.inputValue('#udostepnij-link'), link);

  // #190: ochronę istniejącego linku zmienisz też z listy projektów. Włączenie ochrony (data ważności) rysuje
  // strony od nowa, więc projekt się otwiera; sama zmiana daty – bez otwierania projektu.
  const zListy = async () => {
    await strona.goto(strona.url().split('#')[0]); // lista projektów (adres projektu otworzyłby edytor)
    await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && document.querySelector('.karta-projektu .plakietka-linku'));
    assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt), null, 'żaden projekt nie jest otwarty');
    await strona.click('.karta-projektu .plakietka-linku');
    await strona.waitForSelector('#dlg-udostepnij[open]');
  };
  await strona.click('[data-akcja="udostepnij-zamknij"]');
  await zListy();
  assert.ok(await strona.isVisible('#udostepnij-ochrona'), 'ochrona widoczna także z listy');
  const wybierzDzien = async (ile) => {
    await strona.click('#udostepnij-termin-pole .wybor-przycisk');
    await strona.waitForSelector('.kalendarz-okienko');
    for (let i = 0; i < ile; i += 1) await strona.keyboard.press('ArrowRight');
    await strona.keyboard.press('Enter');
  };
  await strona.check('#udostepnij-termin-wl');
  await wybierzDzien(1);
  await strona.click('#udostepnij-ochrona-zapisz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces'), null, { timeout: 30000 });
  assert.equal(baza.chronione.size, 1, 'link chroniony datą');
  const pierwszyTermin = [...baza.chronione.values()][0].wazny_do;
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'projekty', 'strony linku rysują się w tle – zostajemy na liście');
  assert.equal(plikiChronione(baza, [...baza.chronione.keys()][0]).length, 3, 'opis i dwie strony w folderze z ochroną');
  await zListy();
  assert.ok(await strona.isChecked('#udostepnij-termin-wl'));
  await wybierzDzien(2);
  await strona.click('#udostepnij-ochrona-zapisz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces'), null, { timeout: 30000 });
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'projekty', 'sama data – projekt się nie otwiera');
  assert.notEqual([...baza.chronione.values()][0].wazny_do, pierwszyTermin, 'nowa data ważności');
  // Hasło dodane z listy: nowy folder z sekretem, strony narysowane w tle.
  await zListy();
  await strona.check('#udostepnij-haslo-wl');
  await strona.fill('#udostepnij-haslo', 'z-listy');
  await strona.click('#udostepnij-ochrona-zapisz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces'), null, { timeout: 30000 });
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'projekty');
  const kluczChr = [...baza.chronione.keys()][0];
  assert.ok(baza.chronione.get(kluczChr).haslo, 'hasło ustawione');
  assert.equal(plikiChronione(baza, kluczChr).length, 3);

  // Wyłączenie linku usuwa pliki; link przestaje działać.
  await strona.click('#udostepnij-wylacz');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat').textContent === 'Link unieważniony.');
  assert.equal([...baza.pliki.keys()].filter((k) => k.startsWith('podglady/')).length, 0);
  await obca.reload();
  await obca.waitForSelector('.podglad-pusto');
  assert.match(await obca.textContent('.podglad-pusto'), /link nie działa/i);
  await gosc.close();
  assert.deepEqual(bledy, []);
  void kontekst;
});

// Gość (osobna przeglądarka bez sesji) widzi tę samą atrapę bazy co właściciel: pliki w R2 (także folder linku
// z ochroną, wydawany tylko przy żywym linku) i funkcję podglad_chroniony (te same zasady co w bazie).
// Zwraca stronę gościa i jego błędy.
async function otworzJakoGosc(przegladarka, baza, Z_ATRAPA, link) {
  const k = await przegladarka.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  await k.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: Z_ATRAPA }));
  await k.route('https://atrapa.supabase.co/**', async (r) => {
    const url = new URL(r.request().url());
    const odp = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } });
    if (url.pathname.startsWith('/podglady/')) {
      const reszta = decodeURIComponent(url.pathname.slice('/podglady/'.length));
      // Folder linku z ochroną „<kod>.<sekret>” – jak przekaźnik: plik tylko, gdy link żyje (#97).
      const cz = reszta.split('/');
      if (cz.length >= 4 && cz[2].includes('.')) {
        const u = baza.chronione?.get(`${cz[0]}/${cz[1]}/${cz[2].split('.')[0]}`);
        if (!u || u.sekret !== cz[2].slice(cz[2].indexOf('.') + 1) || (u.wazny_do && new Date(u.wazny_do) < new Date())) return odp({}, 404);
        baza.plikiGoscia = (baza.plikiGoscia || 0) + 1;
      }
      const plik = baza.pliki.get(`podglady/${reszta}`);
      if (!plik) return odp({}, 404);
      return r.fulfill({ status: 200, contentType: plik.typ, body: plik.tresc, headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.pathname === '/rest/v1/rpc/podglad_chroniony') {
      const t = JSON.parse(r.request().postData() || '{}');
      const u = baza.chronione?.get(`${t.p_konto}/${t.p_projekt}/${t.p_kod}`);
      if (!u) return odp({ stan: 'brak' });
      if (u.wazny_do && new Date(u.wazny_do) < new Date()) return odp({ stan: 'wygasl' });
      if (u.haslo) {
        if (!t.p_haslo) return odp({ stan: 'haslo' });
        if (t.p_haslo !== u.haslo) return odp({ stan: 'zle_haslo' });
      }
      if (!u.sekret) return odp({ stan: 'brak' });
      baza.pobraniaGoscia = (baza.pobraniaGoscia || 0) + 1;
      return odp({ stan: 'ok', folder: `${t.p_kod}.${u.sekret}`, haslo: Boolean(u.haslo), wazny_do: u.wazny_do });
    }
    return odp({}, 404);
  });
  await krotkieLinkiGoscia(k, baza); // po ogólnej trasie – Playwright sprawdza trasy od ostatnio dodanej
  const s = await k.newPage();
  const bledyGoscia = [];
  s.on('pageerror', (e) => bledyGoscia.push(e.message));
  await s.goto(link);
  return { s, bledy: bledyGoscia };
}

// Pliki linku z ochroną w R2: folder „<konto>/<projekt>/<kod>.<sekret>/” (#97).
const plikiChronione = (baza, klucz) => [...baza.pliki.keys()].filter((k) => k.startsWith(`podglady/${klucz}.${baza.chronione.get(klucz)?.sekret}/`));
const plikiZwykle = (baza) => [...baza.pliki.keys()].filter((k) => k.startsWith('podglady/') && !k.split('/')[3].includes('.'));

test('link z hasłem i datą ważności: obrazy w folderze z sekretem, pole hasła u gościa, zmiana hasła, ponowna publikacja, wygaśnięcie', async (t) => {
  const { strona, baza, bledy, przegladarka, Z_ATRAPA } = await otworz(t, { tryb: 'atrapa' });
  // Publikacja kończy się w finally (pole linku, przyciski) – sam komunikat „sukces” przychodzi chwilę wcześniej (#160).
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await nowyProjekt(strona, 'Tylko dla klienta');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');

  // Ochrona ustawiona przed utworzeniem linku: najpierw za krótkie hasło, potem dobre.
  assert.ok(await strona.isVisible('#udostepnij-ochrona'));
  assert.ok(await strona.isHidden('#udostepnij-haslo-pole'));
  await strona.check('#udostepnij-haslo-wl');
  assert.ok(await strona.isVisible('#udostepnij-haslo-pole'));
  await strona.fill('#udostepnij-haslo', 'abc');
  await strona.click('#udostepnij-utworz');
  await strona.waitForFunction(() => /co najmniej 4 znaki/.test(document.querySelector('#udostepnij-komunikat').textContent));
  assert.equal(await strona.evaluate(() => Boolean(window.seriodruk.stan.projekt.udostepnienie)), false);
  await strona.fill('#udostepnij-haslo', 'tajne-haslo');
  await strona.click('#udostepnij-utworz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-teraz').disabled && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 20000 });
  const link = await strona.inputValue('#udostepnij-link');
  assert.equal(plikiZwykle(baza).length, 0, 'nic w zwykłym folderze linku');
  const [klucz, u] = [...baza.chronione.entries()][0];
  assert.equal(u.haslo, 'tajne-haslo');
  assert.match(u.sekret, /^[A-Za-z0-9_-]{32}$/, 'sekret – 24 losowe bajty');
  assert.deepEqual(plikiChronione(baza, klucz).map((k) => (k.endsWith('manifest.json') ? 'manifest.json' : 'strona')).sort(), ['manifest.json', 'strona', 'strona']);
  assert.ok(plikiChronione(baza, klucz).filter((k) => !k.endsWith('manifest.json')).every((k) => /^private/.test(baza.pliki.get(k).cacheControl)), 'obrazy linku z ochroną – bez pamięci współdzielonej');
  assert.equal([...baza.krotkie.values()].find((w) => w.projekt === klucz.split('/')[1])?.kod, klucz.split('/').pop(), 'krótki kod prowadzi do kodu linku z bazy');
  assert.equal(baza.krotkie.get(link.split('/').pop())?.kod, klucz.split('/').pop());
  assert.equal(await strona.textContent('#udostepnij-ochrona-stan'), 'Link chroniony hasłem.');
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.udostepnienie.ochrona), { haslo: true, wazny_do: null });

  // Gość: pole hasła, złe hasło, dobre hasło – strony.
  const g = await otworzJakoGosc(przegladarka, baza, Z_ATRAPA, link);
  await g.s.waitForSelector('#podglad-haslo input[name=haslo]');
  assert.equal(await g.s.locator('.podglad-strona[data-id]').count(), 0);
  await g.s.fill('#podglad-haslo input[name=haslo]', 'zle');
  await g.s.click('#podglad-haslo button');
  await g.s.waitForFunction(() => /Hasło się nie zgadza/.test(document.querySelector('#podglad-haslo .komunikat').textContent));
  await g.s.fill('#podglad-haslo input[name=haslo]', 'tajne-haslo');
  await g.s.click('#podglad-haslo button');
  await g.s.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id]').length === 2);
  await g.s.waitForFunction(() => [...document.querySelectorAll('.podglad-strona[data-id] img')].every((i) => i.naturalWidth > 0));
  assert.equal(await g.s.textContent('#podglad-tytul'), 'Tylko dla klienta');
  assert.equal(baza.pobraniaGoscia, 1, 'baza podaje tylko folder – obrazy idą prosto z R2');
  assert.ok(await g.s.evaluate((s) => [...document.querySelectorAll('.podglad-strona[data-id] img')].every((i) => i.src.includes(`.${s}/`)), u.sekret), 'obrazy z folderu z sekretem');
  assert.deepEqual(g.bledy, []);

  // Zmiana hasła: nowy sekret – strony idą do nowego folderu, stary znika (stare adresy już nie działają).
  const staryFolder = `podglady/${klucz}.${u.sekret}/`;
  await strona.fill('#udostepnij-haslo', 'nowe-haslo');
  await strona.click('#udostepnij-ochrona-zapisz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-teraz').disabled && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 20000 });
  assert.notEqual(`podglady/${klucz}.${baza.chronione.get(klucz).sekret}/`, staryFolder);
  assert.equal([...baza.pliki.keys()].filter((k) => k.startsWith(staryFolder)).length, 0, 'stary folder usunięty');
  assert.equal(plikiChronione(baza, klucz).length, 3, 'opis i dwie strony w nowym folderze');
  const gN = await otworzJakoGosc(przegladarka, baza, Z_ATRAPA, link);
  await gN.s.waitForSelector('#podglad-haslo input[name=haslo]');
  await gN.s.fill('#podglad-haslo input[name=haslo]', 'tajne-haslo');
  await gN.s.click('#podglad-haslo button');
  await gN.s.waitForFunction(() => /Hasło się nie zgadza/.test(document.querySelector('#podglad-haslo .komunikat').textContent));
  await gN.s.fill('#podglad-haslo input[name=haslo]', 'nowe-haslo');
  await gN.s.click('#podglad-haslo button');
  await gN.s.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id] img').length === 2);

  // Zmiana: bez hasła, z datą ważności – link dalej chroniony, gość wchodzi bez hasła.
  await strona.uncheck('#udostepnij-haslo-wl');
  await strona.check('#udostepnij-termin-wl');
  const jutro = await strona.evaluate(() => { const d = new Date(Date.now() + 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  // Własny kalendarz: otwiera się na dzisiejszym dniu, strzałka w prawo i Enter wybierają jutro.
  await strona.click('#udostepnij-termin-pole .wybor-przycisk');
  await strona.waitForSelector('.kalendarz-okienko');
  assert.equal(await strona.locator('.kalendarz-okienko .kalendarz-dzien.dzis').count(), 1);
  await strona.keyboard.press('ArrowRight');
  await strona.keyboard.press('Enter');
  assert.equal(await strona.locator('.kalendarz-okienko').count(), 0);
  assert.equal(await strona.inputValue('#udostepnij-termin'), jutro);
  assert.match(await strona.textContent('#udostepnij-termin-pole .wybor-tekst'), /^\d+ \S+ \d{4}$/);
  await strona.click('#udostepnij-ochrona-zapisz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-teraz').disabled && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 20000 });
  assert.match(await strona.textContent('#udostepnij-komunikat'), /^Zapisano\. Link ważny do \d+ \S+ \d{4}\.$/);
  assert.equal(baza.chronione.get(klucz).haslo, null);
  const g2 = await otworzJakoGosc(przegladarka, baza, Z_ATRAPA, link);
  await g2.s.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id] img').length === 2);
  assert.equal(await g2.s.locator('#podglad-haslo').count(), 0);

  // Po dacie ważności: „Link wygasł”.
  baza.chronione.get(klucz).wazny_do = new Date(Date.now() - 60000).toISOString();
  const g3 = await otworzJakoGosc(przegladarka, baza, Z_ATRAPA, link);
  await g3.s.waitForSelector('.podglad-pusto h2');
  assert.equal(await g3.s.textContent('.podglad-pusto h2'), 'Link wygasł');

  // Bez ochrony: strony wracają do publicznego folderu, tabela pusta; ten sam adres działa jak dawniej.
  baza.chronione.get(klucz).wazny_do = new Date(Date.now() + 86400000).toISOString();
  await strona.uncheck('#udostepnij-termin-wl');
  await strona.click('#udostepnij-ochrona-zapisz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-teraz').disabled && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 20000 });
  assert.equal(baza.chronione.size, 0);
  assert.equal([...baza.pliki.keys()].filter((k) => k.startsWith('podglady/') && /\.(webp|jpg)$/.test(k)).length, 2);
  assert.match(await strona.textContent('#udostepnij-ochrona-stan'), /bez ochrony/);
  const g4 = await otworzJakoGosc(przegladarka, baza, Z_ATRAPA, link);
  await g4.s.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id] img').length === 2);

  // I z powrotem z hasłem: publiczne pliki znikają; unieważnienie czyści tabelę.
  await strona.check('#udostepnij-haslo-wl');
  await strona.fill('#udostepnij-haslo', 'drugie');
  await strona.click('#udostepnij-ochrona-zapisz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-teraz').disabled && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 20000 });
  assert.equal(plikiZwykle(baza).length, 0, 'publiczne pliki usunięte');
  assert.equal(plikiChronione(baza, klucz).length, 3);
  await strona.click('#udostepnij-wylacz');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => /unieważniony/.test(document.querySelector('#udostepnij-komunikat').textContent));
  assert.equal(baza.chronione.size, 0);
  assert.equal([...baza.pliki.keys()].filter((k) => k.startsWith('podglady/')).length, 0, 'unieważnienie usuwa też folder z sekretem');
  const g5 = await otworzJakoGosc(przegladarka, baza, Z_ATRAPA, link);
  await g5.s.waitForSelector('.podglad-pusto h2');
  assert.equal(await g5.s.textContent('.podglad-pusto h2'), 'Ten link nie działa');
  assert.deepEqual(bledy, []);
});
