// Miniatury stron zapisane na urządzeniu (#193): po ponownym otwarciu projektu miniatura z pamięci jest użyta
// bez rysowania (tu – podmieniona na znacznik), a zmieniona strona rysuje się od nowa (inny odcisk).
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const ZNACZNIK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

test('miniatury stron: zapis na urządzeniu, użycie po ponownym otwarciu, zmieniona strona od nowa', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Miniatury z pamięci');
  const id = await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    for (let i = 2; i <= 6; i += 1) p.strony.push(P.nowaStrona(`S${i}`, p.sekcje[0].id));
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
    return p.id;
  });
  const wpisy = () => strona.evaluate(async (pid) => (await import('./js/miniatury-stron.js')).wczytajMiniaturyProjektu(pid).then((m) => Object.fromEntries([...m].map(([k, v]) => [k, v.odcisk]))), id);
  const s2 = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[1].id);
  // Wszystkie strony narysowane i zapisane (paczka zapisuje się w tle).
  // (waitForFunction nie czeka na obietnice – sprawdzamy w pętli.)
  const czekajNa = async (warunek, ms = 30000) => {
    const start = Date.now();
    while (!(await warunek())) {
      if (Date.now() - start > ms) throw new Error('Nie doczekano się miniatur w pamięci');
      await strona.waitForTimeout(300);
    }
  };
  await czekajNa(async () => Object.keys(await wpisy()).length >= 6);
  const przed = await wpisy();
  // Podmieniamy zapisaną miniaturę strony 2 na znacznik (ten sam odcisk) i otwieramy projekt od nowa.
  await strona.evaluate(async ({ pid, sid, znacznik }) => {
    const M = await import('./js/miniatury-stron.js');
    const w = (await M.wczytajMiniaturyProjektu(pid)).get(sid);
    M.zapiszMiniatureStrony(pid, sid, w.odcisk, znacznik);
    await new Promise((ok) => { setTimeout(ok, 1200); });
    const p = window.seriodruk.stan.projekt;
    window.seriodruk.stan.miniatury.clear();
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  }, { pid: id, sid: s2, znacznik: ZNACZNIK });
  await strona.waitForFunction((sid) => document.querySelector(`#lista-stron li[data-id="${sid}"] .miniatura img`)?.src.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'), s2, { timeout: 15000 });
  // Zmiana strony 2: odcisk inny – miniatura rysuje się od nowa i zapisuje z nowym odciskiem.
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony[1].tlo = '#ffcc00';
    window.seriodruk.stan.miniatury.clear();
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  });
  await strona.waitForFunction((sid) => { const s = document.querySelector(`#lista-stron li[data-id="${sid}"] .miniatura img`)?.src || ''; return s && !s.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'); }, s2, { timeout: 15000 });
  await czekajNa(async () => (await wpisy())[s2] !== przed[s2]);
  const po = await wpisy();
  const s3 = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[2].id);
  assert.equal(po[s3], przed[s3], 'niezmieniona strona – ten sam odcisk');
  assert.deepEqual(bledy, []);
});
