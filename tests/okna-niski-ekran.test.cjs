// #202: okna na niskim ekranie telefonu – elementy się nie ściskają (dawniej opis i komunikat w oknie Udostępnij
// zwijały się do zera: tekst ucięty w pół linii i nie było czego przewijać); okno przewija się do końca.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('niski ekran telefonu: okno Udostępnij przewija się, komunikat cały', async (t) => {
  const { strona, bledy } = await otworz(t, { tryb: 'atrapa', telefon: true });
  await strona.setViewportSize({ width: 412, height: 560 });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await nowyProjekt(strona, 'Niski');
  await strona.evaluate(() => document.querySelector('[data-akcja="podglad"]').click());
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.evaluate(() => document.querySelector('[data-akcja="udostepnij"]').click());
  await strona.waitForSelector('#dlg-udostepnij[open]');
  await strona.tap('#udostepnij-utworz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces'), null, { timeout: 30000 });
  const w = await strona.evaluate(() => {
    const f = document.querySelector('#dlg-udostepnij .formularz');
    const k = document.querySelector('#udostepnij-komunikat');
    const opis = document.querySelector('#udostepnij-opis');
    f.scrollTop = f.scrollHeight;
    return { przewija: f.scrollHeight > f.clientHeight, komunikat: k.scrollHeight <= k.clientHeight + 1, opis: opis.clientHeight > 30, doKonca: f.scrollTop > 0 };
  });
  assert.deepEqual(w, { przewija: true, komunikat: true, opis: true, doKonca: true });
  assert.deepEqual(bledy, []);
});
