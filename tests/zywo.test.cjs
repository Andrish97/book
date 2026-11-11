// Zapis na żywo: zmiana trafia na konto po około sekundzie, drugie urządzenie dostaje ją bez
// przeładowania, a zmiany na tej samej stronie łączą się element po elemencie.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

async function zaloguj(strona) {
  await strona.waitForSelector('#ekran-logowania', { state: 'visible' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.click('[data-akcja="zamknij-instrukcje"]');
}

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
const czekajNa = async (warunek, opis, ms = 8000) => {
  const start = Date.now();
  while (!warunek()) {
    if (Date.now() - start > ms) throw new Error(`Nie doczekano się: ${opis}`);
    await new Promise((ok) => { setTimeout(ok, 25); });
  }
  return Date.now() - start;
};

test('zmiana trafia na konto po około sekundzie; wysyłki nie biegną obok siebie i nie ma ich na każdą zmianę', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await zaloguj(strona);
  await nowyProjekt(strona, 'Na żywo 1');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await zapisano(strona);

  // Jedna zmiana: na koncie po około sekundzie (dawniej ponad trzy).
  const przed = baza.zapisy.length;
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ left: 20 }); e.aktywny.setCoords(); e.zatwierdz(); });
  const czas = await czekajNa(() => baza.zapisy.length > przed, 'zapis na koncie');
  assert.ok(czas < 2000, `zapis na koncie po ${czas} ms`);
  await zapisano(strona);

  // Wolna sieć (odpowiedź po 900 ms) i zmiany co 150 ms przez trzy sekundy: wysyłki idą jedna po drugiej,
  // żadna nie rozmija się z numerem wersji poprzedniej, a jest ich dużo mniej niż zmian.
  baza.opoznienieZapisu = 900;
  const start = baza.zapisy.length;
  for (let i = 0; i < 20; i += 1) {
    await strona.evaluate((n) => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => !x.zWzorca); o.set({ left: 20 + n }); o.setCoords(); e.zatwierdz(); }, i + 1);
    await strona.waitForTimeout(150);
  }
  await zapisano(strona);
  baza.opoznienieZapisu = 0;
  const wyslane = baza.zapisy.length - start;
  assert.ok(wyslane >= 1 && wyslane <= 6, `20 zmian dało ${wyslane} wysyłek`);
  assert.equal(baza.najwiecejNaraz, 1, 'wysyłki nie biegną jednocześnie');
  assert.equal(baza.konflikty, 0, 'żadna wysyłka nie została odrzucona');
  // Na koncie jest ostatni stan.
  const lewo = [...baza.strony.values()][0].obiekty[0].left;
  assert.equal(lewo, 40);
  assert.deepEqual(bledy, []);
});
