// Cofnięcie zmian AI z aplikacji (plan H3): ⋯ → Cofnij zmiany AI… pokazuje, co zostanie cofnięte (z ostrzeżeniem
// o późniejszych zmianach), a po potwierdzeniu edytor wczytuje projekt sprzed serii zmian AI.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, oknoAi, zamknijAi } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
const kolorProstokata = (strona) => strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'rect' && !x.zWzorca)?.fill);

async function zMenuWiecej(strona, akcja) {
  for (let i = 0; i < 10 && !(await strona.isVisible(`#menu-wiecej [data-akcja="${akcja}"]`)); i += 1) {
    if (await strona.evaluate(() => document.querySelector('#menu-wiecej').hidden)) await strona.click('#przycisk-wiecej');
    await strona.waitForTimeout(100);
  }
  await strona.click(`#menu-wiecej [data-akcja="${akcja}"]`);
}

test('cofnij zmiany AI: bez zmian – informacja; po zmianie AI – pytanie i powrót do stanu sprzed AI', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Cofanie AI');
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  await zapisano(strona);
  const przed = await kolorProstokata(strona);

  await zMenuWiecej(strona, 'cofnij-ai');
  await strona.waitForFunction(() => /AI nie zmieniało|AI has not changed|ШІ не змінював/.test(document.querySelector('#powiadomienia, .powiadomienia, body').textContent));

  await oknoAi(strona);
  await strona.click('[data-akcja="dostep-ai-utworz"]');
  await strona.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  const klucz = await strona.inputValue('#dostep-ai-klucz');
  await zamknijAi(strona);

  const odczyt = baza.ai('ai_projekt', { p_klucz: klucz });
  const s = odczyt.projekt.strony[0];
  const w = baza.ai('ai_zapisz', {
    p_klucz: klucz, p_znana_wersja: odczyt.wersja,
    p_zmiany: { strony: [{ ...s, obiekty: s.obiekty.map((o) => (o.type.toLowerCase() === 'rect' ? { ...o, fill: '#c1121f' } : o)) }] },
  });
  assert.equal(w.strony_zapisane, 1, JSON.stringify(w));
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'rect' && !x.zWzorca)?.fill === '#c1121f', null, { timeout: 15000 });

  // Rezygnacja niczego nie zmienia.
  await zMenuWiecej(strona, 'cofnij-ai');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  assert.match(await strona.textContent('#potwierdz-tresc'), /AI/);
  await strona.click('#potwierdz-nie');
  assert.equal(await kolorProstokata(strona), '#c1121f');

  // Cofnięcie: edytor wraca do koloru sprzed AI, konto też.
  await zMenuWiecej(strona, 'cofnij-ai');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction((k) => window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'rect' && !x.zWzorca)?.fill === k, przed, { timeout: 15000 });
  const naKoncie = baza.ai('ai_projekt', { p_klucz: klucz }).projekt.strony[0].obiekty;
  assert.equal(naKoncie.find((o) => o.type.toLowerCase() === 'rect').fill, przed);
  assert.equal(baza.ai('ai_cofnij_zmiany', { p_klucz: klucz, p_tylko_sprawdz: true }).brak, true, 'seria oznaczona jako cofnięta');
  assert.deepEqual(bledy, []);
});
