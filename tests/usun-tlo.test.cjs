// Usuwanie tła bez AI (decyzja #123): różdżka (ciągła i na całym obrazie), pędzel, wygładzenie krawędzi
// – rachunki w Node; okno w aplikacji: kliknięcie w tło, Cofnij, zapis jako nowy obraz w projekcie
// (oryginał zostaje), obraz na stronie dostaje nowy plik.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const rdzen = () => import(pathToFileURL(path.join(__dirname, '..', 'js', 'usun-tlo-rdzen.js')).href);

// Obraz 10×10: białe tło, czerwony kwadrat 4×4 w środku i biały piksel w rogu kwadratu odcięty od tła.
function obraz() {
  const d = new Uint8ClampedArray(10 * 10 * 4).fill(255);
  for (let y = 3; y < 7; y += 1) for (let x = 3; x < 7; x += 1) { const i = (y * 10 + x) * 4; d[i] = 220; d[i + 1] = 20; d[i + 2] = 20; }
  return d;
}

test('różdżka: tło połączone z klikniętym miejscem albo cały kolor; tolerancja; pędzel; wygładzenie', async () => {
  const { rozdzka, pedzel, wygladz, skladaj, KOD_WATKU } = await rdzen();
  const d = obraz();
  // Biała wyspa w środku czerwonego kwadratu – „ciągła” różdżka jej nie dosięga.
  const wyspa = (5 * 10 + 5) * 4; d[wyspa] = 255; d[wyspa + 1] = 255; d[wyspa + 2] = 255;
  const pelna = new Uint8Array(100).fill(255);
  const ciagla = rozdzka(d, 10, 10, pelna, 0, 0, 10, true);
  assert.equal(ciagla[0], 0, 'tło usunięte');
  assert.equal(ciagla[4 * 10 + 4], 255, 'czerwony kwadrat zostaje');
  assert.equal(ciagla[5 * 10 + 5], 255, 'biała wyspa w kwadracie zostaje przy różdżce ciągłej');
  assert.equal(pelna[0], 255, 'stara maska bez zmian (do cofania)');
  const cala = rozdzka(d, 10, 10, pelna, 0, 0, 10, false);
  assert.equal(cala[5 * 10 + 5], 0, 'różdżka na całym obrazie bierze też wyspę');
  assert.equal(rozdzka(d, 10, 10, pelna, 0, 0, 100, true).every((v) => v === 0), true, 'tolerancja 100 – wszystko');
  const m = new Uint8Array(100).fill(255);
  pedzel(m, 10, 10, 5, 5, 1.5, 0);
  assert.equal(m[5 * 10 + 5], 0);
  assert.equal(m[0], 255);
  const k = wygladz(ciagla, 10, 10, 1);
  assert.ok(k[3 * 10 + 3] > 0 && k[3 * 10 + 3] < 255, `brzeg kwadratu półprzezroczysty: ${k[33]}`);
  assert.equal(k[0], 0);
  const out = skladaj(d, k);
  assert.equal(out[3], 0, 'krycie tła 0');
  assert.match(KOD_WATKU, /onmessage/);
});

test('okno „Usuń tło”: różdżka, Cofnij, zapis jako nowy obraz – oryginał zostaje', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tło');
  const png = await strona.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 60; c.height = 40;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 60, 40);
    x.fillStyle = '#d01010'; x.fillRect(20, 10, 20, 20);
    return c.toDataURL('image/png').split(',')[1];
  });
  await strona.setInputFiles('#plik-obraz', { name: 'kubek.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'image');
  await strona.click('#wlasciwosci button:has-text("Usuń tło")');
  await strona.waitForSelector('#dlg-usun-tlo[open]');
  await strona.waitForFunction(() => /Kliknij w tło/.test(document.querySelector('#usun-tlo-stan').textContent));
  const plotno = strona.locator('#usun-tlo-plotno');
  const r = await plotno.boundingBox();
  await strona.mouse.click(r.x + 3, r.y + 3);
  await strona.waitForFunction(() => /Kliknij kolejne/.test(document.querySelector('#usun-tlo-stan').textContent));
  const krycie = () => strona.evaluate(() => {
    const c = document.querySelector('#usun-tlo-plotno').getContext('2d');
    return [c.getImageData(2, 2, 1, 1).data[3], c.getImageData(30, 20, 1, 1).data[3]];
  });
  await strona.waitForFunction(() => document.querySelector('#usun-tlo-plotno').getContext('2d').getImageData(2, 2, 1, 1).data[3] === 0);
  assert.deepEqual(await krycie(), [0, 255], 'tło przezroczyste, kubek zostaje');
  await strona.click('#usun-tlo-cofnij');
  await strona.waitForFunction(() => document.querySelector('#usun-tlo-plotno').getContext('2d').getImageData(2, 2, 1, 1).data[3] === 255);
  await strona.mouse.click(r.x + 3, r.y + 3);
  await strona.waitForFunction(() => document.querySelector('#usun-tlo-plotno').getContext('2d').getImageData(2, 2, 1, 1).data[3] === 0);
  await strona.click('#usun-tlo-zapisz');
  await strona.waitForFunction(() => !document.querySelector('#dlg-usun-tlo').open);
  const po = await strona.evaluate(() => {
    const { stan, edytor } = window.seriodruk;
    const z = stan.projekt.zasoby;
    return { nazwy: Object.values(z).map((x) => x.nazwa).sort(), element: z[edytor.aktywny.zasob]?.nazwa };
  });
  assert.deepEqual(po.nazwy, ['kubek-bez-tla.png', 'kubek.png']);
  assert.equal(po.element, 'kubek-bez-tla.png');
  assert.deepEqual(bledy, []);
});
