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
  assert.deepEqual(await strona.locator('.wybor-lista .wybor-opcja').allTextContents(), ['Inter', 'Open Sans', 'Montserrat', 'Lora', 'Merriweather', 'Playfair Display', 'Source Serif 4', 'Caveat', '+ Wgraj własną czcionkę…']);
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
