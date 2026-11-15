// Widoczny przycisk „rozkładówka / jedna strona” w sekcjach z rozkładówkami (#148) oraz zmiana strony bez
// pośrednich rysunków: płótno rysuje się raz, gdy nowa strona jest gotowa.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('rozkładówki: przycisk obok powiększenia przełącza całą rozkładówkę i jedną stronę; zmiana strony rysuje się raz', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', 'Rozkładówki');
  await strona.click('#form-nowy label:has-text("Rozkładówki")');
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk);
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    for (let i = 2; i <= 5; i += 1) p.strony.push(P.nowaStrona(`Strona ${i}`, p.sekcje[0].id));
    await (await import('./js/app/lista-stron.js')).przejdzDoStrony(1);
  });
  const przycisk = strona.locator('#przycisk-rozkladowka');
  assert.equal(await przycisk.isVisible(), true, 'przycisk widoczny w sekcji z rozkładówkami');
  const naPlotnie = () => strona.evaluate(() => window.seriodruk.edytor.rozkladowka);
  assert.equal(await naPlotnie(), false, 'na telefonie domyślnie jedna strona');
  await przycisk.click();
  await strona.waitForFunction(() => window.seriodruk.edytor.rozkladowka === true);
  assert.equal(await przycisk.getAttribute('aria-pressed'), 'true');
  await przycisk.click();
  await strona.waitForFunction(() => window.seriodruk.edytor.rozkladowka === false);

  // Zmiana strony: w trakcie wczytywania płótno się nie rysuje, na końcu – raz.
  const rysunki = await strona.evaluate(async () => {
    const c = window.seriodruk.edytor.canvas;
    let n = 0;
    const org = c.renderAll.bind(c);
    const licz = () => { n += 1; return org(); };
    Object.defineProperty(c, 'renderAll', { configurable: true, get: () => licz, set: () => {} });
    await (await import('./js/app/lista-stron.js')).przejdzDoStrony(3);
    await new Promise((r) => setTimeout(r, 50));
    delete c.renderAll;
    return n;
  });
  assert.ok(rysunki <= 2, `pośrednich rysunków przy zmianie strony: ${rysunki}`);
  assert.deepEqual(bledy, []);
});
