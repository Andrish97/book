// Dostęp dla AI: klucze konta (decyzja #94) – z menu projektu ten projekt jest zaznaczony; zmiany z klucza dochodzą
// do otwartego edytora na żywo; zakres klucza da się zmienić bez zmiany adresu.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, oknoAi } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

test('dostęp dla AI: klucz pokazany raz, zmiana z klucza dochodzi do edytora i łączy się z równoległą zmianą, odczyt i odebranie', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Projekt dla AI');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ text: 'Tytuł', top: 120 }); e.aktywny.setCoords(); e.zatwierdz(); e.odznacz(); });
  await zapisano(strona);

  // Klucze AI są tylko w ustawieniach konta (#100): w menu ⋯ projektu nie ma już „Dostęp dla AI…”.
  await strona.click('#przycisk-wiecej');
  assert.equal(await strona.locator('#menu-wiecej [data-akcja="dostep-ai"]').count(), 0);
  await strona.keyboard.press('Escape');
  // Okno (jak z ustawień konta): nowy klucz do zmian, projekt wybrany na liście.
  await oknoAi(strona);
  assert.equal(await strona.isVisible('#dostep-ai-gotowy'), false);
  await strona.waitForFunction(() => document.querySelectorAll('#dostep-ai-projekty input:checked').length === 1);
  assert.equal(await strona.isChecked('#dostep-ai-nowy input[value="wybrane"]'), true);
  assert.match(await strona.textContent('#dostep-ai-projekty'), /Projekt dla AI/);
  await strona.fill('#dostep-ai-opis', 'Claude – test');
  await strona.click('[data-akcja="dostep-ai-utworz"]');
  await strona.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  const klucz = await strona.inputValue('#dostep-ai-klucz');
  assert.match(klucz, /^sdk_[0-9a-f]{32}_[A-Za-z0-9_-]{40,}$/);
  // Na pierwszym miejscu adres zdalnego łącznika (z kluczem; w testach baza to atrapa) i kroki dla Claude i ChatGPT; reszta zwinięta.
  assert.equal(await strona.inputValue('#dostep-ai-adres'), `https://atrapa.supabase.co/functions/v1/mcp/${klucz}`);
  assert.equal(await strona.isVisible('#dostep-ai-adres'), true);
  assert.equal(await strona.isVisible('#dostep-ai-klucz'), false, 'sam klucz jest w zwiniętej części dla zaawansowanych');
  assert.match(await strona.textContent('.dostep-ai-kroki'), /Claude.*Dodaj własny łącznik.*ChatGPT.*Add custom MCP server/s);
  assert.doesNotMatch(await strona.textContent('#dlg-dostep-ai'), /dozwolon|allowlist|odblokuj domen/i);
  assert.ok((await strona.textContent('#dostep-ai-claude-code')).includes(`/functions/v1/mcp/${klucz}`), 'polecenie dla Claude Code używa zdalnego łącznika');
  assert.ok((await strona.textContent('#dostep-ai-claude-desktop')).includes(klucz), 'gotowa konfiguracja serwera u siebie zawiera klucz');
  await strona.waitForFunction(() => document.querySelectorAll('#dostep-ai-lista li').length === 1);
  assert.match(await strona.textContent('#dostep-ai-lista li'), /Claude – test.*„Projekt dla AI”.*czyta i zmienia.*ważny do.*jeszcze nieużyty/s);
  // Po zamknięciu i ponownym otwarciu klucza już nie widać.
  await strona.click('[data-akcja="dostep-ai-zamknij"]');
  await oknoAi(strona, { zaznacz: false });
  assert.equal(await strona.inputValue('#dostep-ai-klucz'), '');
  assert.equal(await strona.inputValue('#dostep-ai-adres'), '');
  assert.equal(await strona.textContent('#dostep-ai-claude-code'), '');
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
  await oknoAi(strona, { zaznacz: false });
  await strona.waitForFunction(() => document.querySelectorAll('#dostep-ai-lista li').length === 2);
  assert.match(await strona.textContent('#dostep-ai-lista'), /ostatnio użyty/);
  // Zmiana zakresu w miejscu: pełny dostęp – ten sam klucz widzi teraz wszystkie projekty konta.
  await strona.click('#dostep-ai-lista li:has-text("Claude – test") button:has-text("Zmień zakres")');
  await strona.click('#dostep-ai-lista li:has-text("Claude – test") .zmiana-zakresu input[value="pelny"]');
  await strona.click('#dostep-ai-lista li:has-text("Claude – test") button:has-text("Zapisz zakres")');
  await strona.waitForFunction(() => /pełny dostęp/.test(document.querySelector('#dostep-ai-lista').textContent));
  assert.equal(baza.ai('ai_projekty', { p_klucz: klucz }).dostep.zakres, 'pelny');
  await strona.click('#dostep-ai-lista li:has-text("Claude – test") button:has-text("Odbierz")');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => document.querySelectorAll('#dostep-ai-lista li').length === 1);
  assert.match(baza.ai('ai_projekt', { p_klucz: klucz }).blad, /odebrany/);
  assert.deepEqual(bledy, []);
});

test('zmiana od AI przy otwartym podglądzie: podgląd przerysowuje się sam, a udostępniony link idzie za nią', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Podgląd i AI');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  await zapisano(strona);

  // Podgląd z udostępnionym linkiem; okno udostępniania zamknięte, podgląd zostaje otwarty.
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');
  await strona.click('#udostepnij-utworz');
  await strona.waitForSelector('#udostepnij-komunikat.sukces', { timeout: 20000 });
  await strona.click('[data-akcja="udostepnij-zamknij"]');
  await zapisano(strona);
  const manifest = () => {
    const k = [...baza.pliki.keys()].find((x) => x.startsWith('podglady/') && x.endsWith('manifest.json'));
    return JSON.parse(baza.pliki.get(k).tresc.toString());
  };
  const linkPrzed = manifest().zaktualizowano;
  const obrazy = () => strona.evaluate(() => [...document.querySelectorAll('#podglad-tresc .podglad-strona[data-id] img')].map((i) => i.getAttribute('src')));
  await strona.waitForFunction(() => [...document.querySelectorAll('#podglad-tresc .podglad-strona[data-id] img')].every((i) => i.getAttribute('src')));
  const przed = await obrazy();

  // AI zmienia kolor prostokąta na pierwszej stronie.
  const { klucz } = await strona.evaluate(async (id) => (await import('./js/chmura.js')).utworzDostepAi(id, { opis: 'AI', dni: 1 }), await strona.evaluate(() => window.seriodruk.stan.projekt.id));
  const odczyt = baza.ai('ai_projekt', { p_klucz: klucz });
  const s = odczyt.projekt.strony[0];
  const zmiana = baza.ai('ai_zapisz', {
    p_klucz: klucz, p_znana_wersja: odczyt.wersja,
    p_zmiany: { strony: [{ ...s, obiekty: s.obiekty.map((o) => (o.type.toLowerCase() === 'rect' ? { ...o, fill: '#c1121f' } : o)) }] },
  });
  assert.equal(zmiana.strony_zapisane, 1, JSON.stringify(zmiana));

  // Podgląd: nowy obraz pierwszej strony, druga bez zmian, nadal podgląd.
  await strona.waitForFunction((stary) => document.querySelector('#podglad-tresc .podglad-strona[data-id] img')?.getAttribute('src') !== stary, przed[0], { timeout: 15000 });
  const po = await obrazy();
  assert.equal(po[1], przed[1], 'strona bez zmian nie jest rysowana od nowa');
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'podglad');
  // Link dla gości aktualizuje się sam także po zmianie od AI (nikt inny by go nie narysował).
  const start = Date.now();
  while (manifest().zaktualizowano === linkPrzed) {
    assert.ok(Date.now() - start < 30000, 'link nie zaktualizował się po zmianie od AI');
    await strona.waitForTimeout(250);
  }
  assert.deepEqual(bledy, []);
});
