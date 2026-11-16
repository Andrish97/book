// Druk w domu (#145): okno z menu ⋯ i Ctrl+P, broszura na A4 – właściwa liczba i kolejność kartek,
// „Drukuj” oddaje plik do drukowania (tu zamiast okna drukarki – funkcja testowa), ustawienia zapamiętane.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('druk w domu: menu ⋯ i Ctrl+P, broszura A4 – 2 kartki dla 6 stron, druk z ramki, zapamiętane ustawienia', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Broszura do domu');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    for (let i = 2; i <= 6; i += 1) p.strony.push(P.nowaStrona(`Strona ${i}`, p.sekcje[0].id));
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
    window.__druk = [];
    window.seriodruk.drukujTestowo = (url) => window.__druk.push(url);
  });
  // Widoczne miejsce: menu ⋯ projektu (#140, #142).
  // Projekt otwarty wprost zmienia adres – obsługa adresu przychodzi chwilę później i zamyka otwarte menu
  // (pokazEkran). Menu otwieramy, aż pozycja jest widoczna (#160).
  for (let i = 0; i < 10 && !(await strona.isVisible('#menu-wiecej [data-akcja="drukuj"]')); i += 1) {
    if (await strona.evaluate(() => document.querySelector('#menu-wiecej').hidden)) await strona.click('#przycisk-wiecej');
    await strona.waitForTimeout(300);
  }
  await strona.click('#menu-wiecej [data-akcja="drukuj"]');
  await strona.waitForSelector('#dlg-druk[open]');
  await strona.evaluate(() => {
    const s = document.querySelector('#form-druk [name="uklad"]');
    s.value = 'broszura';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await strona.waitForFunction(() => document.querySelectorAll('#druk-plan .arkusz-planu').length === 4);
  assert.match(await strona.textContent('#druk-opis'), /2 arkusze.*krótszej krawędzi.*dopełnione 2/s);
  assert.match(await strona.textContent('#druk-pomoc-tresc'), /zszyj w zgięciu/);
  await strona.click('#druk-drukuj');
  await strona.waitForFunction(() => window.__druk.length === 1, null, { timeout: 30000 });
  // Plik: 4 strony arkuszy (2 kartki × przód i tył), poziome A4.
  const pdf = await strona.evaluate(async () => {
    const bajty = new Uint8Array(await (await fetch(window.__druk[0])).arrayBuffer());
    const doc = await window.PDFLib.PDFDocument.load(bajty);
    const { width, height } = doc.getPages()[0].getSize();
    const v = doc.catalog.getViewerPreferences();
    return { strony: doc.getPageCount(), szer: width, wys: height, skala: v?.getPrintScaling(), dupleks: v?.getDuplex() };
  });
  // Ustawienia druku zapisane w pliku (#187): 100% bez dopasowania, dwustronnie po krótszej krawędzi.
  assert.equal(pdf.skala, 'None');
  assert.equal(pdf.dupleks, 'DuplexFlipShortEdge');
  assert.equal(pdf.strony, 4, 'broszura 6 stron → 2 kartki dwustronnie');
  assert.ok(Math.abs(pdf.szer - 841.89) < 1 && Math.abs(pdf.wys - 595.28) < 1, `A4 poziomo: ${pdf.szer}×${pdf.wys}`);
  // Strona próbna (#187): jedna kartka A4 pionowo z linijką; widoczne ustawienia okna drukarki.
  const probna = await strona.evaluate(async () => {
    const { stronaProbnaPdf } = await import('./js/okno-druku.js');
    const doc = await window.PDFLib.PDFDocument.load(new Uint8Array(await (await stronaProbnaPdf('A4')).arrayBuffer()));
    const { width, height } = doc.getPages()[0].getSize();
    return { strony: doc.getPageCount(), szer: width, wys: height, skala: doc.catalog.getViewerPreferences()?.getPrintScaling() };
  });
  assert.equal(probna.strony, 1);
  assert.ok(Math.abs(probna.szer - 595.28) < 1 && Math.abs(probna.wys - 841.89) < 1, `A4 pionowo: ${probna.szer}×${probna.wys}`);
  assert.equal(probna.skala, 'None');
  // Ctrl+P otwiera to samo okno, z zapamiętanym układem.
  await strona.keyboard.press('Control+p');
  await strona.waitForSelector('#dlg-druk[open]');
  assert.equal(await strona.inputValue('#form-druk [name="uklad"]'), 'broszura');
  assert.match(await strona.textContent('#druk-ustawienia'), /100%.*Nagłówki i stopki/s);
  await strona.click('#druk-probna');
  await strona.waitForFunction(() => window.__druk.length === 2, null, { timeout: 15000 });
  // Druk z menu przeglądarki: zamiast zrzutu aplikacji tylko podpowiedź (#150).
  await strona.keyboard.press('Escape');
  await strona.emulateMedia({ media: 'print' });
  const wydruk = await strona.evaluate(() => ({
    widoczne: [...document.body.children].filter((el) => getComputedStyle(el).display !== 'none').length,
    tekst: getComputedStyle(document.body, '::before').content,
  }));
  await strona.emulateMedia({ media: 'screen' });
  assert.equal(wydruk.widoczne, 0);
  assert.match(wydruk.tekst, /Drukuj w domu/);
  // W podglądzie Ctrl+P też otwiera okno druku.
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.evaluate(() => document.querySelector('#dlg-druk')?.close());
  await strona.keyboard.press('Control+p');
  await strona.waitForSelector('#dlg-druk[open]');
  assert.deepEqual(bledy, []);
});
