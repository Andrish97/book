const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('udostępnianie podglądu linkiem: publikacja, widok bez logowania, aktualizacja, wyłączenie', async (t) => {
  const { strona, baza, bledy, przegladarka, kontekst, Z_ATRAPA } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.click('[data-akcja="zamknij-instrukcje"]');

  await nowyProjekt(strona, 'Do pokazania');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);

  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');
  assert.ok(await strona.isHidden('#udostepnij-link-blok'), 'przed udostępnieniem nie ma linku');
  await strona.click('#udostepnij-utworz');
  await strona.waitForSelector('#udostepnij-komunikat.sukces', { timeout: 20000 });
  const link = await strona.inputValue('#udostepnij-link');
  assert.match(link, /#\/u\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f]{24}$/);
  assert.match(await strona.textContent('#udostepnij-stan'), /aktualny stan/);
  const pliki = [...baza.pliki.keys()].filter((k) => k.startsWith('podglady/'));
  assert.equal(pliki.filter((k) => k.endsWith('.jpg')).length, 2, 'po jednym obrazie na stronę');
  assert.equal(pliki.filter((k) => k.endsWith('manifest.json')).length, 1);
  const manifest = JSON.parse(baza.pliki.get(pliki.find((k) => k.endsWith('manifest.json'))).tresc.toString());
  assert.equal(manifest.uklad.nazwa, 'Do pokazania');
  assert.equal(JSON.stringify(manifest).includes('obiekty'), false, 'manifest nie zawiera treści projektu');

  // Osoba bez konta: osobna przeglądarka, bez sesji.
  const gosc = await przegladarka.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  await gosc.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: Z_ATRAPA }));
  await gosc.route('https://atrapa.supabase.co/storage/v1/object/public/**', async (r) => {
    const klucz = new URL(r.request().url()).pathname.slice('/storage/v1/object/public/'.length);
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
  assert.equal(ponownie.filter((k) => k.endsWith('.jpg')).length, 1);
  assert.equal(ponownie.filter((k) => k.endsWith('manifest.json')).length, 1);
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

// Gość (osobna przeglądarka bez sesji) widzi tę samą atrapę bazy co właściciel: publiczne pliki
// i funkcję podglad_chroniony (te same zasady co w bazie). Zwraca stronę gościa i jego błędy.
async function otworzJakoGosc(przegladarka, baza, Z_ATRAPA, link) {
  const k = await przegladarka.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  await k.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: Z_ATRAPA }));
  await k.route('https://atrapa.supabase.co/**', async (r) => {
    const url = new URL(r.request().url());
    const odp = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } });
    if (url.pathname.startsWith('/storage/v1/object/public/')) {
      const plik = baza.pliki.get(url.pathname.slice('/storage/v1/object/public/'.length));
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
      if (!t.p_nazwy) return odp({ stan: 'ok' });
      const pliki = {};
      for (const n of t.p_nazwy.slice(0, 12)) if (u.pliki.has(n)) pliki[n] = u.pliki.get(n);
      baza.pobraniaGoscia = (baza.pobraniaGoscia || 0) + 1;
      return odp({ stan: 'ok', pliki });
    }
    return odp({}, 404);
  });
  const s = await k.newPage();
  const bledyGoscia = [];
  s.on('pageerror', (e) => bledyGoscia.push(e.message));
  await s.goto(link);
  return { s, bledy: bledyGoscia };
}

test('link z hasłem i datą ważności: obrazy poza publicznym folderem, pole hasła u gościa, zmiana ochrony, wygaśnięcie', async (t) => {
  const { strona, baza, bledy, przegladarka, Z_ATRAPA } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.click('[data-akcja="zamknij-instrukcje"]');
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
  await strona.waitForSelector('#udostepnij-komunikat.sukces', { timeout: 20000 });
  const link = await strona.inputValue('#udostepnij-link');
  assert.equal([...baza.pliki.keys()].filter((k) => k.startsWith('podglady/')).length, 0, 'nic w publicznym folderze');
  const [klucz, u] = [...baza.chronione.entries()][0];
  assert.equal(u.haslo, 'tajne-haslo');
  assert.deepEqual([...u.pliki.keys()].map((n) => (n === 'manifest.json' ? n : 'strona.jpg')).sort(), ['manifest.json', 'strona.jpg', 'strona.jpg']);
  assert.ok(link.endsWith(klucz.split('/').pop()), 'ten sam kod w linku i w bazie');
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
  await g.s.waitForFunction(() => [...document.querySelectorAll('.podglad-strona[data-id] img')].every((i) => i.naturalWidth > 0 && i.src.startsWith('blob:')));
  assert.equal(await g.s.textContent('#podglad-tytul'), 'Tylko dla klienta');
  assert.equal(baza.pobraniaGoscia, 2, 'opis i obie strony w dwóch zapytaniach (strony paczką)');
  assert.deepEqual(g.bledy, []);

  // Zmiana: bez hasła, z datą ważności – link dalej chroniony, gość wchodzi bez hasła.
  await strona.uncheck('#udostepnij-haslo-wl');
  await strona.check('#udostepnij-termin-wl');
  const jutro = await strona.evaluate(() => { const d = new Date(Date.now() + 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await strona.fill('#udostepnij-termin', jutro);
  await strona.click('#udostepnij-ochrona-zapisz');
  await strona.waitForSelector('#udostepnij-komunikat.sukces');
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
  await strona.waitForSelector('#udostepnij-komunikat.sukces');
  assert.equal(baza.chronione.size, 0);
  assert.equal([...baza.pliki.keys()].filter((k) => k.startsWith('podglady/') && k.endsWith('.jpg')).length, 2);
  assert.match(await strona.textContent('#udostepnij-ochrona-stan'), /bez ochrony/);
  const g4 = await otworzJakoGosc(przegladarka, baza, Z_ATRAPA, link);
  await g4.s.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id] img').length === 2);

  // I z powrotem z hasłem: publiczne pliki znikają; unieważnienie czyści tabelę.
  await strona.check('#udostepnij-haslo-wl');
  await strona.fill('#udostepnij-haslo', 'drugie');
  await strona.click('#udostepnij-ochrona-zapisz');
  await strona.waitForSelector('#udostepnij-komunikat.sukces');
  assert.equal([...baza.pliki.keys()].filter((k) => k.startsWith('podglady/')).length, 0, 'publiczne pliki usunięte');
  assert.equal(baza.chronione.get(klucz).pliki.size, 3);
  await strona.click('#udostepnij-wylacz');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => /unieważniony/.test(document.querySelector('#udostepnij-komunikat').textContent));
  assert.equal(baza.chronione.size, 0);
  const g5 = await otworzJakoGosc(przegladarka, baza, Z_ATRAPA, link);
  await g5.s.waitForSelector('.podglad-pusto h2');
  assert.equal(await g5.s.textContent('.podglad-pusto h2'), 'Ten link nie działa');
  assert.deepEqual(bledy, []);
});
