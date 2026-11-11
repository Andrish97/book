// Dostęp dla AI: klucz do jednego projektu, zmiany z klucza dochodzą do otwartego edytora na żywo.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

test('dostęp dla AI: klucz pokazany raz, zmiana z klucza dochodzi do edytora i łączy się z równoległą zmianą, odczyt i odebranie', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Projekt dla AI');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ text: 'Tytuł', top: 120 }); e.aktywny.setCoords(); e.zatwierdz(); e.odznacz(); });
  await zapisano(strona);

  // Okno: nowy klucz do zmian.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="dostep-ai"]');
  await strona.waitForSelector('#dlg-dostep-ai[open]');
  assert.equal(await strona.isVisible('#dostep-ai-gotowy'), false);
  await strona.fill('#dostep-ai-opis', 'Claude – test');
  await strona.click('[data-akcja="dostep-ai-utworz"]');
  await strona.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  const klucz = await strona.inputValue('#dostep-ai-klucz');
  assert.match(klucz, /^sdk_[0-9a-f]{32}_[A-Za-z0-9_-]{40,}$/);
  assert.ok((await strona.textContent('#dostep-ai-claude-desktop')).includes(klucz), 'gotowa konfiguracja dla Claude zawiera klucz');
  await strona.waitForFunction(() => document.querySelectorAll('#dostep-ai-lista li').length === 1);
  assert.match(await strona.textContent('#dostep-ai-lista li'), /Claude – test.*czyta i zmienia.*jeszcze nieużyty/s);
  // Po zamknięciu i ponownym otwarciu klucza już nie widać.
  await strona.click('[data-akcja="dostep-ai-zamknij"]');
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="dostep-ai"]');
  await strona.waitForSelector('#dlg-dostep-ai[open]');
  assert.equal(await strona.inputValue('#dostep-ai-klucz'), '');
  assert.equal(await strona.isVisible('#dostep-ai-gotowy'), false);
  await strona.click('[data-akcja="dostep-ai-zamknij"]');

  // AI czyta projekt kluczem: strony w środku, zasoby opisane.
  const odczyt = baza.ai('ai_projekt', { p_klucz: klucz });
  assert.equal(odczyt.dostep.rola, 'edycja');
  assert.equal(odczyt.projekt.strony.length, 1);
  const s = odczyt.projekt.strony[0];
  const prostokat = s.obiekty.find((o) => o.type.toLowerCase() === 'rect');

  // Równolegle: użytkownik przesuwa tekst, a AI zmienia kolor prostokąta – różne elementy, bez pytania.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const tb = e.canvas.getObjects().find((x) => x.type === 'textbox'); tb.set({ left: 40 }); tb.setCoords(); e.zatwierdz(); });
  const zmiana = baza.ai('ai_zapisz', {
    p_klucz: klucz, p_znana_wersja: odczyt.wersja,
    p_zmiany: { strony: [{ ...s, obiekty: s.obiekty.map((o) => (o.id === prostokat.id ? { ...o, fill: '#c1121f' } : o)) }] },
  });
  assert.equal(zmiana.strony_zapisane, 1, JSON.stringify(zmiana));
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'rect')?.fill === '#c1121f', null, { timeout: 15000 });
  await zapisano(strona);
  const naKoncie = baza.ai('ai_projekt', { p_klucz: klucz }).projekt.strony[0].obiekty;
  assert.equal(naKoncie.find((o) => o.type.toLowerCase() === 'rect').fill, '#c1121f');
  assert.equal(Math.round(naKoncie.find((o) => o.type.toLowerCase() === 'textbox').left), 40, 'zmiana użytkownika została');
  assert.equal(await strona.locator('#dlg-konflikt[open]').count(), 0);

  // Stara wersja: odmowa z prośbą o pobranie projektu na nowo.
  assert.equal(baza.ai('ai_zapisz', { p_klucz: klucz, p_znana_wersja: odczyt.wersja, p_zmiany: { nazwa: 'X' } }).konflikt, true);
  // Klucz tylko do odczytu nie zmienia projektu.
  const tylkoOdczyt = await strona.evaluate(async (id) => (await import('./js/chmura.js')).utworzDostepAi(id, { opis: 'Czyta', rola: 'odczyt', dni: 1 }), odczyt.projekt.id);
  const w = baza.ai('ai_projekt', { p_klucz: tylkoOdczyt.klucz }).wersja;
  assert.match(baza.ai('ai_zapisz', { p_klucz: tylkoOdczyt.klucz, p_znana_wersja: w, p_zmiany: { nazwa: 'X' } }).blad, /tylko czytać/);

  // Odebranie z listy w oknie: klucz przestaje działać.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="dostep-ai"]');
  await strona.waitForFunction(() => document.querySelectorAll('#dostep-ai-lista li').length === 2);
  assert.match(await strona.textContent('#dostep-ai-lista'), /ostatnio użyty/);
  await strona.click('#dostep-ai-lista li:has-text("Claude – test") button');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => document.querySelectorAll('#dostep-ai-lista li').length === 1);
  assert.match(baza.ai('ai_projekt', { p_klucz: klucz }).blad, /odebrany/);
  assert.deepEqual(bledy, []);
});
