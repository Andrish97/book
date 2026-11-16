// Błąd znaleziony przy audycie testów (#160): zmiana zrobiona tuż przed przeładowaniem albo zamknięciem karty
// (zapis w przeglądarce czekał jeszcze ok. 0,7 s) ginęła – po ponownym otwarciu był stan sprzed niej.
// Teraz zapis rusza przy zamykaniu strony; zmiana zostaje na urządzeniu i potem trafia na konto.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('zmiana tuż przed przeładowaniem karty zostaje – na urządzeniu i potem na koncie', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Szybko');
  await strona.evaluate(() => window.seriodruk.edytor.dodajProstokat());
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await strona.waitForTimeout(1500);
  for (const [kolor, czekaj] of [['#ff0000', 0], ['#00ff00', 150], ['#0000ff', 350]]) {
    await strona.evaluate((k) => { const e = window.seriodruk.edytor; e.canvas.getObjects()[0].set('fill', k); e.zatwierdz(); }, kolor);
    if (czekaj) await strona.waitForTimeout(czekaj);
    await strona.reload();
    await strona.waitForFunction(() => window.seriodruk?.edytor?.canvas?.getObjects().length === 1);
    assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects()[0].fill), kolor, `zmiana ${czekaj} ms przed przeładowaniem`);
  }
  // Wysyłka na konto idzie z zapisu na urządzeniu.
  const naKoncieJest = async (kolor) => {
    for (let i = 0; i < 8; i += 1) {
      if ([...baza.strony.values()].some((s) => (s.obiekty || []).some((o) => o.fill === kolor))) return true;
      await strona.waitForTimeout(250);
    }
    return false;
  };
  // Wysyłka z poprzedniego otwarcia mogła dojść na konto już po zamknięciu karty (odpowiedź przepadła) – wtedy
  // konto ma nowszy numer wersji i ta sama część jest zmieniona „w dwóch miejscach”. Aplikacja pyta zamiast
  // rozstrzygać po cichu; wybór „moja wersja” wysyła ostatnią zmianę.
  for (let i = 0; i < 20 && !(await naKoncieJest('#0000ff')); i += 1) {
    if (await strona.locator('#dlg-konflikt[open]').count()) {
      await strona.evaluate(() => document.querySelectorAll('#konflikt-lista input[value="moje"]').forEach((x) => { x.checked = true; }));
      await strona.click('#konflikt-zastosuj');
    }
  }
  const naKoncie = [...baza.strony.values()].flatMap((s) => s.obiekty || []).map((o) => o.fill);
  const diag = await strona.evaluate(() => ({ stan: document.querySelector('#stan-zapisu')?.title, okna: [...document.querySelectorAll('dialog[open]')].map((d) => d.id), konflikt: window.seriodruk.stan.konflikt }));
  assert.ok(naKoncie.includes('#0000ff'), `na koncie: ${naKoncie} ${JSON.stringify(diag)}`);
  assert.deepEqual(bledy, []);
});
