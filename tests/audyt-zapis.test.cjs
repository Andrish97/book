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
  // Wysyłka z poprzedniego otwarcia mogła dojść na konto już po zamknięciu karty (odpowiedź przepadła) – wtedy
  // konto ma nowszy numer wersji i ta sama część jest zmieniona „w dwóch miejscach”. Aplikacja pyta zamiast
  // rozstrzygać po cichu; wybór „moja wersja” zostawia ostatnią zmianę z tego urządzenia.
  const mojaWersja = async () => {
    if (!(await strona.locator('#dlg-konflikt[open]').count())) return false;
    await strona.evaluate(() => document.querySelectorAll('#konflikt-lista input[value="moje"]').forEach((x) => { x.checked = true; }));
    await strona.click('#konflikt-zastosuj');
    return true;
  };
  for (const [kolor, czekaj] of [['#ff0000', 0], ['#00ff00', 150], ['#0000ff', 350]]) {
    // Pod obciążeniem po zapisie dołączają się jeszcze zmiany z konta i strona wczytuje się od nowa – w tym czasie
    // edytor nie zgłasza zmian (zmiana „pod spodem” zostałaby nadpisana). Zmieniamy dopiero na wczytanej stronie (#184).
    const wczytana = () => strona.evaluate(() => !window.seriodruk.edytor._wczytywanie && Boolean(window.seriodruk.stan.projekt) && !window.seriodruk.stan.konflikt);
    for (let i = 0; i < 300 && !(await wczytana()); i += 1) if (!(await mojaWersja())) await strona.waitForTimeout(100);
    assert.ok(await wczytana(), 'strona wczytana, bez otwartego pytania o wersję');
    await strona.evaluate((k) => { const e = window.seriodruk.edytor; e.canvas.getObjects()[0].set('fill', k); e.zatwierdz(); }, kolor);
    assert.ok(await strona.evaluate(() => Boolean(window.seriodruk.stan.timerZapisu)), 'zmiana zgłoszona – zapis zaplanowany');
    if (czekaj) await strona.waitForTimeout(czekaj);
    await strona.reload();
    await strona.waitForFunction(() => window.seriodruk?.edytor?.canvas?.getObjects().length === 1);
    const naPlotnie = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects()[0].fill);
    // Opis błędu: co jest w zapisie na urządzeniu i co na koncie – żeby było wiadomo, gdzie zmiana zginęła.
    const stanZapisu = naPlotnie === kolor ? '' : await strona.evaluate(async () => {
      const { wczytajLokalnie } = await import('./js/lokalny.js');
      const r = await wczytajLokalnie(window.seriodruk.stan.projekt.id);
      return JSON.stringify({ urzadzenie: r?.projekt?.strony?.[0]?.obiekty?.[0]?.fill, doWyslania: r?.doSynchronizacji, wersja: r?.projekt?.wersja_chmury, konflikt: window.seriodruk.stan.konflikt, dotkniete: localStorage.getItem(`makietka:dotkniete:${window.seriodruk.stan.projekt.id}`) });
    });
    const naKoncieTeraz = [...baza.strony.values()].flatMap((s) => s.obiekty || []).map((o) => o.fill);
    assert.equal(naPlotnie, kolor, `zmiana ${czekaj} ms przed przeładowaniem ${stanZapisu} konto: ${naKoncieTeraz}`);
  }
  // Wysyłka na konto idzie z zapisu na urządzeniu.
  const naKoncieJest = async (kolor) => {
    for (let i = 0; i < 8; i += 1) {
      if ([...baza.strony.values()].some((s) => (s.obiekty || []).some((o) => o.fill === kolor))) return true;
      await strona.waitForTimeout(250);
    }
    return false;
  };
  for (let i = 0; i < 20 && !(await naKoncieJest('#0000ff')); i += 1) await mojaWersja();
  const naKoncie = [...baza.strony.values()].flatMap((s) => s.obiekty || []).map((o) => o.fill);
  const diag = await strona.evaluate(() => ({ stan: document.querySelector('#stan-zapisu')?.title, okna: [...document.querySelectorAll('dialog[open]')].map((d) => d.id), konflikt: window.seriodruk.stan.konflikt }));
  assert.ok(naKoncie.includes('#0000ff'), `na koncie: ${naKoncie} ${JSON.stringify(diag)}`);
  assert.deepEqual(bledy, []);
});
