// „Podgląd” w menu kafelka projektu (decyzja #111): otwiera od razu podgląd, bez pokazywania edytora
// po drodze; płótno edytora wczytuje się dopiero przy przejściu do edycji.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('kafelek: „Podgląd” otwiera podgląd bez mignięcia edytora, „Edytuj” wczytuje płótno', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Prosto do podglądu');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].obiekty.length === 1);
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  // Odświeżenie strony: edytor nie ma nic na płótnie i musi wczytać projekt od zera.
  await strona.reload();
  await strona.waitForSelector('.karta-projektu .menu-karty');
  await strona.evaluate(() => {
    window.ekrany = [];
    new MutationObserver(() => window.ekrany.push(document.body.dataset.ekran))
      .observe(document.body, { attributes: true, attributeFilter: ['data-ekran'] });
  });
  await strona.click('.karta-projektu .menu-karty');
  await strona.click('[data-op="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.waitForTimeout(300);
  const ekrany = await strona.evaluate(() => window.ekrany);
  assert.ok(!ekrany.includes('edytor'), `edytor nie pokazał się po drodze: ${ekrany.join(' → ')}`);
  assert.match(await strona.evaluate(() => location.hash), /\/podglad$/);

  // Powrót do edycji: płótno wczytuje się teraz, z elementem strony.
  await strona.evaluate(async () => { const m = await import('./js/app/podglad-ekran.js'); m.zamknijPodglad(); });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type !== 'line' && o.selectable !== false));
  assert.ok(await strona.evaluate(() => window.seriodruk.edytor.wydruk), 'płótno wczytane');
  assert.deepEqual(bledy, []);
});
