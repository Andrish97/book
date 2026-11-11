const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('własne kontrolki: lista rozwijana (mysz, klawiatura, grupy) i wybór koloru zamiast systemowych', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kontrolki');
  await strona.click('[data-akcja="dodaj-tekst"]');
  const czcionka = '.wlasciwosci label:has-text("Czcionka")';

  // Każdy <select> ma własny przycisk; systemowy jest niewidoczny i nieklikalny.
  const stan = await strona.evaluate(() => {
    const wszystkie = [...document.querySelectorAll('select')];
    return { ile: wszystkie.length, ulepszone: wszystkie.filter((s) => s.closest('.wybor')?.querySelector('.wybor-przycisk')).length, widoczne: wszystkie.filter((s) => getComputedStyle(s).opacity !== '0' || getComputedStyle(s).pointerEvents !== 'none').length };
  });
  assert.ok(stan.ile > 10);
  assert.equal(stan.ulepszone, stan.ile, 'wszystkie listy są własne');
  assert.equal(stan.widoczne, 0);

  // Mysz: otwarcie, wybór pozycji, zmiana na płótnie i w podpisie przycisku.
  await strona.click(`${czcionka} .wybor-przycisk`);
  const zestaw = await strona.evaluate(async () => (await import('./js/czcionki.js')).CZCIONKI.map((c) => c.nazwa));
  assert.equal(zestaw.length, 52);
  assert.deepEqual(await strona.locator('.wybor-lista .wybor-opcja').allTextContents(), [...zestaw, '+ Wgraj własną czcionkę…']);
  assert.equal(await strona.locator('.wybor-lista .wybor-opcja:has-text("Lora")').evaluate((el) => el.style.fontFamily), 'Lora', 'pozycja listy pokazuje krój czcionki');
  await strona.click('.wybor-lista .wybor-opcja:has-text("Lora")');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.fontFamily), 'Lora');
  assert.equal(await strona.textContent(`${czcionka} .wybor-tekst`), 'Lora');
  assert.equal(await strona.locator('.wybor-lista').count(), 0, 'lista zamyka się po wyborze');

  // Klawiatura: strzałka otwiera, pisanie liter przeskakuje, Enter wybiera, Esc zamyka bez zmiany.
  await strona.focus(`${czcionka} .wybor-przycisk`);
  await strona.keyboard.press('ArrowDown');
  await strona.keyboard.type('mer');
  await strona.keyboard.press('Enter');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.fontFamily), 'Merriweather');
  await strona.keyboard.press('ArrowDown');
  await strona.keyboard.press('ArrowDown');
  await strona.keyboard.press('Escape');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.fontFamily), 'Merriweather');
  assert.equal(await strona.locator('.wybor-lista').count(), 0);

  // Wartość ustawiona z kodu (przebudowa panelu) od razu widać na przycisku; grupy pól mają nagłówki.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.formatujTekst(() => ({ fontFamily: 'Caveat' }), true); });
  assert.equal(await strona.textContent(`${czcionka} .wybor-tekst`), 'Caveat');
  await strona.click('.wlasciwosci label:has-text("Wstaw pole") .wybor-przycisk');
  assert.deepEqual(await strona.locator('.wybor-lista .wybor-grupa').allTextContents(), ['Pola dokumentu']);
  await strona.click('.wybor-lista .wybor-opcja:has-text("{nr}")');
  assert.match(await strona.evaluate(() => window.seriodruk.edytor.aktywny.text), /\{nr\}$/);

  // Kolor: własne okienko z kodem koloru i paletą; zmiana widać od razu, zapis po zamknięciu.
  const kolor = '.wlasciwosci label:has-text("Kolor")';
  await strona.click(`${kolor} .kolor-przycisk`);
  await strona.waitForSelector('.kolor-okienko');
  await strona.fill('.kolor-okienko .kolor-hex input', '#c00');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.fill), '#cc0000');
  await strona.click('.kolor-okienko .kolor-paleta button[title="#2f5bd3"]');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.fill), '#2f5bd3');
  // Przeciągnięcie po polu nasycenia i jasności do prawego górnego rogu daje czysty, jasny kolor.
  const pole = await strona.locator('.kolor-okienko .kolor-pole').boundingBox();
  await strona.mouse.move(pole.x + pole.width / 2, pole.y + pole.height / 2);
  await strona.mouse.down();
  await strona.mouse.move(pole.x + pole.width - 1, pole.y + 1, { steps: 3 });
  await strona.mouse.up();
  const poPrzeciagnieciu = await strona.evaluate(() => window.seriodruk.edytor.aktywny.fill);
  const [cz, , ni] = [1, 3, 5].map((i) => parseInt(poPrzeciagnieciu.slice(i, i + 2), 16));
  assert.ok(cz < 20 && ni > 240, `niebieski o pełnym nasyceniu i jasności (${poPrzeciagnieciu})`);
  await strona.keyboard.press('Escape');
  assert.equal(await strona.locator('.kolor-okienko').count(), 0);
  const zapis = await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); return window.seriodruk.stan.projekt.strony[0].obiekty[0].fill; });
  assert.equal(zapis, poPrzeciagnieciu);
  // Ostatnio użyty kolor wraca w drugim rzędzie palety.
  await strona.click(`${kolor} .kolor-przycisk`);
  assert.equal(await strona.locator('.kolor-okienko .kolor-paleta.ostatnie button').first().getAttribute('title'), poPrzeciagnieciu);
  await strona.keyboard.press('Escape');

  // Lista w oknie dialogowym (okno jest modalne – lista musi być w jego środku, żeby dało się ją kliknąć).
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  await strona.click('#form-pdf label:has-text("Jakość") .wybor-przycisk');
  await strona.click('#dlg-pdf .wybor-lista .wybor-opcja:has-text("150 dpi")');
  assert.equal(await strona.inputValue('#form-pdf select[name=dpi]'), '150');
  assert.deepEqual(bledy, []);
});

test('dymki z podpowiedzią zamiast systemowych: najechanie myszą, Tab, Esc, zmiana podpowiedzi w trakcie, krawędź okna, okno dialogowe', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Dymki');
  const cofnij = '.pasek-edytora [data-akcja="wzorce"]';
  const WZORCE = 'Wzorce: wspólne elementy stron – tła, stopki, numery';
  const dymek = () => strona.evaluate(() => { const d = document.querySelector('.dymek'); return d && d.isConnected ? d.textContent : null; });
  // Mysz: po chwili własny dymek; „title” przeniesiony, więc przeglądarka nie pokazuje swojego.
  await strona.hover(cofnij);
  assert.equal(await dymek(), null, 'nie od razu');
  await strona.waitForSelector('.dymek');
  assert.equal(await dymek(), WZORCE);
  const opis = await strona.evaluate((s) => {
    const b = document.querySelector(s); const d = document.querySelector('.dymek').getBoundingClientRect(); const r = b.getBoundingClientRect();
    return { title: b.getAttribute('title'), aria: b.getAttribute('aria-describedby'), rola: document.querySelector('.dymek').getAttribute('role'), pod: d.top >= r.bottom, wOknie: d.left >= 0 && d.right <= innerWidth };
  }, cofnij);
  assert.deepEqual(opis, { title: null, aria: 'dymek', rola: 'tooltip', pod: true, wOknie: true });
  // Wyjście myszą chowa dymek i oddaje „title”.
  await strona.mouse.move(600, 500);
  assert.equal(await dymek(), null);
  assert.equal(await strona.getAttribute(cofnij, 'title'), WZORCE);
  assert.equal(await strona.getAttribute(cofnij, 'aria-describedby'), null);
  // Esc chowa dymek.
  await strona.hover(cofnij);
  await strona.waitForSelector('.dymek');
  await strona.keyboard.press('Escape');
  assert.equal(await dymek(), null);
  // Przy prawej krawędzi okna dymek dalej mieści się w oknie.
  await strona.evaluate(() => document.querySelector('#przycisk-wiecej').setAttribute('title', 'Więcej poleceń dla tego projektu i jego stron'));
  await strona.hover('#przycisk-wiecej');
  await strona.waitForSelector('.dymek');
  assert.ok(await strona.evaluate(() => document.querySelector('.dymek').getBoundingClientRect().right <= innerWidth), 'dymek w oknie');
  // Kod zmienia podpowiedź w trakcie – dymek pokazuje nowy tekst, a po wyjściu wraca nowy „title”.
  await strona.evaluate(() => { document.querySelector('#przycisk-wiecej').title = 'Nowa podpowiedź'; });
  await strona.waitForFunction(() => document.querySelector('.dymek')?.textContent === 'Nowa podpowiedź');
  await strona.mouse.move(600, 500);
  assert.equal(await strona.getAttribute('#przycisk-wiecej', 'title'), 'Nowa podpowiedź');
  // Klawiatura: fokus z klawiatury pokazuje dymek od razu.
  // (Tab w edytorze obsługują skróty aplikacji – po naciśnięciu klawisza fokus ustawiony z kodu też jest „z klawiatury”.)
  await strona.keyboard.press('Shift');
  await strona.locator('.pasek-edytora [data-akcja="dane"]').focus();
  assert.equal(await strona.evaluate(() => document.activeElement.dataset.akcja), 'dane');
  assert.equal(await dymek(), 'Tabele z danymi do pól i serii');
  await strona.keyboard.press('Escape');
  // Okno dialogowe: dymek jest w oknie (inaczej leżałby pod nim).
  await strona.click('[data-akcja="wydruk"]');
  await strona.waitForSelector('dialog[open] [title]');
  await strona.locator('dialog[open] [title]').first().hover();
  await strona.waitForSelector('.dymek');
  assert.ok(await strona.evaluate(() => Boolean(document.querySelector('.dymek').closest('dialog[open]'))));
  assert.deepEqual(bledy, []);
});

test('wybór daty: własny kalendarz zamiast systemowego – data po polsku, miesiące, dni przed dzisiaj wyłączone, klawiatura, Esc', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz');
  // Pole daty dodane do strony dostaje własny wybór (tak jak listy i kolory).
  await strona.evaluate(() => {
    const l = document.createElement('label');
    l.className = 'pole';
    l.style.cssText = 'position:fixed;left:40px;top:120px;width:260px;z-index:500';
    l.innerHTML = '<span>Termin</span><input id="proba-daty" type="date" min="dzis">';
    document.body.append(l);
    window.__zmiany = 0;
    l.querySelector('input').addEventListener('change', () => { window.__zmiany += 1; });
  });
  const przycisk = '#proba-daty + .wybor-przycisk';
  await strona.waitForSelector(przycisk);
  assert.equal(await strona.evaluate(() => getComputedStyle(document.querySelector('#proba-daty')).opacity), '0', 'systemowe pole niewidoczne');
  assert.equal(await strona.textContent(`${przycisk} .wybor-tekst`), 'Wybierz dzień');
  // Wartość ustawiona z kodu pokazuje się po polsku.
  await strona.evaluate(() => { document.querySelector('#proba-daty').value = '2031-12-31'; });
  assert.equal(await strona.textContent(`${przycisk} .wybor-tekst`), '31 grudnia 2031');
  // Kalendarz otwiera się na wybranym miesiącu; poniedziałek pierwszy; nagłówek po polsku.
  await strona.click(przycisk);
  await strona.waitForSelector('.kalendarz-okienko');
  assert.equal(await strona.textContent('.kalendarz-okienko strong'), 'grudzień 2031');
  assert.deepEqual(await strona.locator('.kalendarz-dzien-tyg').allTextContents(), ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd']);
  assert.equal(await strona.getAttribute('[data-dzien="2031-12-31"]', 'aria-selected'), 'true');
  // 1 grudnia 2031 to poniedziałek – pierwsza komórka po nagłówkach.
  assert.equal(await strona.evaluate(() => document.querySelector('.kalendarz-siatka').children[7].dataset.dzien), '2031-12-01');
  // Następny miesiąc i wybór myszą.
  await strona.click('.kalendarz-okienko [data-krok="1"]');
  assert.equal(await strona.textContent('.kalendarz-okienko strong'), 'styczeń 2032');
  await strona.click('[data-dzien="2032-01-15"]');
  assert.equal(await strona.inputValue('#proba-daty'), '2032-01-15');
  assert.equal(await strona.textContent(`${przycisk} .wybor-tekst`), '15 stycznia 2032');
  assert.equal(await strona.evaluate(() => window.__zmiany), 1);
  // Dni przed dzisiaj są wyłączone; dzisiejszy zaznaczony.
  await strona.evaluate(() => { document.querySelector('#proba-daty').value = ''; });
  await strona.click(przycisk);
  const dzis = await strona.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  assert.equal(await strona.getAttribute('.kalendarz-dzien.dzis', 'data-dzien'), dzis);
  await strona.click('.kalendarz-okienko [data-krok="-1"]');
  assert.equal(await strona.locator('.kalendarz-dzien:not(:disabled)').count(), 0, 'cały poprzedni miesiąc wyłączony');
  // Klawiatura: PageDown wraca, strzałka w dół o tydzień, Enter wybiera; Esc zamyka bez zmiany.
  await strona.keyboard.press('PageDown');
  await strona.keyboard.press('Escape');
  assert.equal(await strona.locator('.kalendarz-okienko').count(), 0);
  assert.equal(await strona.inputValue('#proba-daty'), '');
  await strona.click(przycisk);
  await strona.keyboard.press('ArrowDown');
  await strona.keyboard.press('Enter');
  const zaTydzien = await strona.evaluate(() => { const d = new Date(Date.now() + 7 * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  assert.equal(await strona.inputValue('#proba-daty'), zaTydzien);
  // „Dziś” wybiera dzisiejszy dzień.
  await strona.click(przycisk);
  await strona.click('.kalendarz-okienko [data-dzis]');
  assert.equal(await strona.inputValue('#proba-daty'), dzis);
  assert.deepEqual(bledy, []);
});

test('formularze: komunikat błędu pod polem po polsku zamiast systemowego dymku; Anuluj bez sprawdzania; poprawka chowa komunikat', async (t) => {
  const { strona, bledy } = await otworz(t);
  // Nowy projekt bez nazwy: okno zostaje, pod polem komunikat, fokus na polu.
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.waitForSelector('#dlg-nowy[open]');
  assert.equal(await strona.evaluate(() => document.querySelector('#form-nowy').noValidate), true, 'bez systemowego sprawdzania');
  await strona.fill('#form-nowy input[name=nazwa]', '');
  await strona.click('#form-nowy button[value=ok]');
  assert.equal(await strona.locator('#dlg-nowy[open]').count(), 1, 'okno nie zamyka się z błędem');
  assert.equal(await strona.textContent('#form-nowy .blad-pola'), 'Uzupełnij pole „Nazwa”.');
  assert.deepEqual(await strona.evaluate(() => { const p = document.querySelector('#form-nowy input[name=nazwa]'); return [document.activeElement === p, p.getAttribute('aria-invalid'), p.classList.contains('z-bledem'), document.getElementById(p.getAttribute('aria-describedby'))?.className]; }), [true, 'true', true, 'blad-pola']);
  // Poprawka chowa komunikat od razu.
  await strona.fill('#form-nowy input[name=nazwa]', 'Projekt');
  assert.equal(await strona.locator('#form-nowy .blad-pola').count(), 0);
  // Anuluj zamyka bez sprawdzania; po ponownym otwarciu nie ma starych komunikatów.
  await strona.fill('#form-nowy input[name=nazwa]', '');
  await strona.click('#form-nowy button[value=ok]');
  await strona.click('#form-nowy button[value=anuluj] >> nth=-1');
  await strona.waitForSelector('#dlg-nowy', { state: 'hidden' });
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.waitForSelector('#dlg-nowy[open]');
  assert.equal(await strona.locator('#form-nowy .blad-pola').count(), 0);
  await strona.click('#form-nowy button[value=anuluj] >> nth=-1');
  // Ustawienia sekcji: wymiar poza zakresem – komunikat z zakresem i jednostką.
  await nowyProjekt(strona, 'Formularze');
  await strona.click('[data-akcja="wydruk"]');
  await strona.waitForSelector('#dlg-sekcja[open]');
  await strona.fill('#dlg-sekcja input[name=szerokosc_mm]', '5');
  await strona.click('#zapisz-sekcje');
  assert.equal(await strona.locator('#dlg-sekcja[open]').count(), 1);
  assert.equal(await strona.textContent('#dlg-sekcja .blad-pola'), 'Szerokość: od 20 do 1000 mm.');
  await strona.fill('#dlg-sekcja input[name=szerokosc_mm]', '150');
  assert.equal(await strona.locator('#dlg-sekcja .blad-pola').count(), 0);
  // Formularze z własną obsługą błędów (np. logowanie) nie są ruszane.
  assert.equal(await strona.evaluate(() => document.querySelector('#form-logowania')?.dataset.sprawdzanie), undefined);
  assert.deepEqual(bledy, []);
});

test('dymki: na ekranie dotykowym się nie pokazują – stuknięcie to zwykłe kliknięcie', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Dymki dotyk');
  await strona.tap('.zakladki-mobilne [data-panel="strony"]');
  await strona.waitForTimeout(700);
  assert.equal(await strona.locator('.dymek').count(), 0);
  assert.deepEqual(bledy, []);
});
