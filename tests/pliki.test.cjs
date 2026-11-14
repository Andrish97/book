const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

test('eksport do pliku projektu, usunięcie i import z powrotem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Do pliku');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.setInputFiles('#plik-obraz', { name: 'a.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().length === 2);
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForTimeout(1000);
  await strona.click('[data-akcja="do-projektow"]:visible');
  await strona.waitForSelector('.karta-projektu:not(.szkielet)');

  await strona.click('.karta-projektu .menu-karty');
  const [pobranie] = await Promise.all([strona.waitForEvent('download'), strona.click('.karta-projektu [data-op="eksport"]')]);
  assert.equal(pobranie.suggestedFilename(), 'Do pliku.makietka');
  const plik = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'seriodruk-')), pobranie.suggestedFilename());
  await pobranie.saveAs(plik);
  assert.equal(fs.readFileSync(plik).subarray(0, 2).toString(), 'PK', 'plik jest archiwum ZIP');

  await strona.click('.karta-projektu .menu-karty');
  await strona.click('.karta-projektu [data-op="usun"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForSelector('#pusto-projekty', { state: 'visible' });

  await strona.setInputFiles('#plik-projekt', plik);
  await strona.waitForFunction(() => window.seriodruk.stan.projekt);
  const p = await strona.evaluate(async () => {
    const pr = window.seriodruk.stan.projekt;
    return { nazwa: pr.nazwa, strony: pr.strony.length, obraz: (await (await import('./js/zasoby.js')).dataUrlZasobu(pr, Object.keys(pr.zasoby)[0])).slice(0, 22) };
  });
  assert.deepEqual(p, { nazwa: 'Do pliku', strony: 2, obraz: 'data:image/png;base64,' });
  assert.deepEqual(bledy, []);
});

test('import pliku, który nie jest projektem, pokazuje błąd', async (t) => {
  const { strona } = await otworz(t);
  await strona.setInputFiles('#plik-projekt', { name: 'x.seriodruk', mimeType: 'application/zip', buffer: Buffer.from('to nie zip') });
  await strona.waitForSelector('#powiadomienie.blad:not([hidden])');
  assert.match(await strona.textContent('#powiadomienie'), /nie jest plik projektu/);
});
