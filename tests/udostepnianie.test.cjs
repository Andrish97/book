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
