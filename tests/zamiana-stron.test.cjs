// Szybka zamiana stron lewa ↔ prawa (zgłoszenie 19.11: „czy da się zrobić szybką zmianę układu z prawego na lewy?
// np. dodaję pojedynczą stronę”): w panelu strony sekcji z rozkładówkami przełącznik „Zacznij sekcję od lewej strony”
// – to samo co „Pierwsza strona sekcji” w ustawieniach, jednym kliknięciem.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('przełącznik w panelu zamienia strony lewe i prawe w rozkładówkach', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Zamiana');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    p.sekcje[0].uklad = 'rozkladowki';
    for (let i = 2; i <= 4; i += 1) p.strony.push(P.nowaStrona(`S${i}`, p.sekcje[0].id));
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  });
  await strona.waitForFunction(() => window.seriodruk.edytor?.wydruk);
  const boki = () => strona.evaluate(async () => {
    const { rozwin, bokStrony } = await import('./js/serie.js');
    const p = window.seriodruk.stan.projekt;
    const c = rozwin(p);
    return p.strony.map((s) => bokStrony(s, c));
  });
  const przed = await boki();
  assert.equal(przed[0], 'prawa');
  await strona.evaluate(() => window.seriodruk.edytor.odznacz());
  const przel = strona.locator('#wlasciwosci label', { hasText: 'Zacznij sekcję od lewej strony' });
  await przel.click();
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].pierwsza === 'lewa');
  const po = await boki();
  assert.equal(po[0], 'lewa');
  assert.deepEqual(po, przed.map((b) => (b === 'lewa' ? 'prawa' : b === 'prawa' ? 'lewa' : b)), 'wszystkie strony zamienione');
  await przel.click();
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].pierwsza === 'prawa');
  assert.deepEqual(await boki(), przed);
  assert.deepEqual(bledy, []);
});
