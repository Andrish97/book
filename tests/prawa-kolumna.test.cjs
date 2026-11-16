// Prawa kolumna na komputerze (#171): zakładki Właściwości | Warstwy na całą wysokość, ostrzeżenia w okienku
// z przycisku przy powiększeniu (licznik, kolor, Esc zamyka, kliknięcie ostrzeżenia zaznacza element);
// na telefonie bez zmian (dolne menu).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('komputer: zakładki Właściwości | Warstwy i okienko ostrzeżeń z przycisku', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1280, height: 800 } });
  await nowyProjekt(strona, 'Kolumna');
  // Bez ostrzeżeń: przycisk bez licznika, sekcja ostrzeżeń nie zajmuje miejsca w kolumnie.
  assert.equal(await strona.isVisible('#przycisk-ostrzezen'), true);
  assert.equal(await strona.isVisible('#licznik-ostrzezen-przycisk'), false);
  assert.equal(await strona.isVisible('#sekcja-ostrzezen'), false);
  // Właściwości na całą wysokość kolumny (bez warstw pod spodem).
  const wys = await strona.evaluate(() => {
    const k = document.querySelector('#panel-inspektor').getBoundingClientRect();
    const w = document.querySelector('#wlasciwosci').getBoundingClientRect();
    return { koniec: Math.round(k.bottom - w.bottom), warstwy: getComputedStyle(document.querySelector('#dok-warstw')).display };
  });
  assert.ok(wys.koniec <= 2, `właściwości do dołu kolumny (${wys.koniec})`);
  assert.equal(wys.warstwy, 'none');

  // Element poza spadem: licznik na przycisku, okienko z listą, kliknięcie zaznacza element.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    e.dodajProstokat();
    e.aktywny.set({ left: -8, nazwa: 'Wystający' });
    e.aktywny.setCoords();
    e.zatwierdz();
    e.canvas.discardActiveObject();
    e.przeliczOstrzezenia();
  });
  await strona.waitForFunction(() => !document.querySelector('#licznik-ostrzezen-przycisk').hidden);
  assert.equal(await strona.textContent('#licznik-ostrzezen-przycisk'), '1');
  assert.ok(await strona.evaluate(() => document.querySelector('#przycisk-ostrzezen').classList.contains('sa')));
  await strona.click('#przycisk-ostrzezen');
  assert.ok(await strona.isVisible('#lista-ostrzezen li:has-text("Wystający")'));
  assert.equal(await strona.getAttribute('#przycisk-ostrzezen', 'aria-pressed'), 'true');
  const okno = await strona.evaluate(() => { const r = document.querySelector('#sekcja-ostrzezen').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });
  assert.ok(okno, 'okienko w całości na ekranie');
  await strona.click('#lista-ostrzezen li:has-text("Wystający") .opis');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny?.nazwa), 'Wystający');
  assert.ok(await strona.isVisible('#sekcja-ostrzezen'), 'okienko zostaje otwarte (nieblokujące)');
  await strona.keyboard.press('Escape');
  await strona.keyboard.press('Escape');
  await strona.waitForFunction(() => !document.body.classList.contains('ostrzezenia-otwarte'));
  // F8 otwiera i zamyka.
  await strona.keyboard.press('F8');
  assert.ok(await strona.isVisible('#sekcja-ostrzezen'));
  await strona.click('#zamknij-ostrzezenia');
  assert.equal(await strona.isVisible('#sekcja-ostrzezen'), false);

  // Zakładka Warstwy: lista na całą wysokość, właściwości schowane; strzałki przełączają zakładki.
  await strona.click('#zakladka-warstwy');
  assert.ok(await strona.isVisible('#lista-warstw li.warstwa'));
  assert.equal(await strona.isVisible('#wlasciwosci'), false);
  await strona.focus('#zakladka-warstwy');
  await strona.keyboard.press('ArrowLeft');
  assert.equal(await strona.getAttribute('#zakladka-wlasciwosci', 'aria-selected'), 'true');
  assert.deepEqual(bledy, []);
});

test('telefon: bez zakładek prawej kolumny i bez przycisku ostrzeżeń – dolne menu jak dotąd', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Telefon');
  assert.equal(await strona.isVisible('#zakladki-inspektora'), false);
  assert.equal(await strona.isVisible('#przycisk-ostrzezen'), false);
  await strona.tap('.zakladki-mobilne [data-panel="ostrzezenia"]');
  await strona.waitForTimeout(300);
  assert.ok(await strona.isVisible('#lista-ostrzezen'));
  assert.deepEqual(bledy, []);
});
