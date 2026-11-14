// Filtry obrazu bez zmiany pliku (decyzja #123): rachunki na pikselach; w aplikacji – panel „Filtry”,
// obraz na stronie i w złożonej stronie (miniatury, PDF) w odcieniach szarości, plik w projekcie bez zmian.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('filtry na pikselach: jasność, kontrast, szarość, sepia, rozmycie', async () => {
  const { filtrujPiksele, maFiltry } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'filtry-obrazu.js')).href);
  const px = () => new Uint8ClampedArray([200, 50, 50, 255]);
  let d = px(); filtrujPiksele(d, 1, 1, { szarosc: true });
  assert.equal(d[0], d[1]); assert.equal(d[1], d[2]);
  d = px(); filtrujPiksele(d, 1, 1, { jasnosc: 20 });
  assert.equal(d[1], 101);
  d = px(); filtrujPiksele(d, 1, 1, { kontrast: 50 });
  assert.ok(d[0] > 200 && d[1] < 50);
  d = px(); filtrujPiksele(d, 1, 1, { sepia: true });
  assert.ok(d[0] > d[1] && d[1] > d[2]);
  d = new Uint8ClampedArray(100 * 4).fill(0);
  for (let i = 0; i < 4; i += 1) d[50 * 4 + i] = 255;
  filtrujPiksele(d, 100, 1, { rozmycie: 100 });
  assert.ok(d[48 * 4] > 0 && d[50 * 4] < 255, 'jasny punkt rozlany na sąsiadów');
  assert.equal(maFiltry({ jasnosc: 0, szarosc: false }), false);
  assert.equal(maFiltry({ sepia: true }), true);
});

test('panel „Filtry”: odcień szarości na stronie i w złożonej stronie, plik bez zmian', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Filtry');
  const png = await strona.evaluate(() => { const c = document.createElement('canvas'); c.width = 20; c.height = 20; const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 20, 20); return c.toDataURL('image/png').split(',')[1]; });
  await strona.setInputFiles('#plik-obraz', { name: 'czerwony.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'image');
  await strona.click('#wlasciwosci button.zwijak:text-is("Filtry")');
  await strona.locator('#wlasciwosci label', { hasText: 'Odcień szarości' }).click();
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.filtry?.szarosc === true);
  const wynik = await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const o = edytor.aktywny;
    o.set({ left: 10, top: 10 });
    const { zapiszTeraz } = await import('./js/app/zapis.js');
    await zapiszTeraz();
    const { naPlotnieCelu } = await import('./js/zlozenie.js');
    const r = o.left + o.getScaledWidth() / 2; const g = o.top + o.getScaledHeight() / 2;
    const piksel = await naPlotnieCelu(stan.projekt, stan.projekt.strony[0], { szerokoscPx: 148 * 2, spad: false }, (p) => [...p.toCanvasElement().getContext('2d').getImageData(Math.round(r * 2), Math.round(g * 2), 1, 1).data]);
    return { piksel, zapis: stan.projekt.strony[0].obiekty[0].filtry, pliki: Object.keys(stan.projekt.zasoby).length };
  });
  assert.equal(wynik.piksel[0], wynik.piksel[1], `szary piksel: ${wynik.piksel}`);
  assert.ok(wynik.piksel[0] < 120, 'czerwień w szarości jest ciemna');
  assert.deepEqual(wynik.zapis, { szarosc: true });
  assert.equal(wynik.pliki, 1, 'bez nowego pliku');
  assert.deepEqual(bledy, []);
});
