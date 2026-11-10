const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

test('wklejanie: obraz i kod SVG ze schowka systemu, plik SVG bez rozmiaru, element skopiowany w aplikacji', async (t) => {
  const { strona, kontekst, bledy } = await otworz(t);
  await kontekst.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await nowyProjekt(strona, 'Schowek');

  // Porządkowanie SVG: rozmiar z viewBox, powiększenie małej ikony, bez skryptów.
  const svg = await strona.evaluate(async () => {
    const { uporzadkujSvg } = await import('./js/wklejanie.js');
    const d = (t) => { const s = uporzadkujSvg(t); if (!s) return null; const e = new DOMParser().parseFromString(s, 'image/svg+xml').documentElement; return [e.getAttribute('width'), e.getAttribute('height'), e.getAttribute('viewBox'), e.getAttribute('xmlns'), s.includes('script')]; };
    return {
      ikona: d('<?xml version="1.0"?><svg viewBox="0 0 24 12"><script>alert(1)</script><rect width="24" height="12"/></svg>'),
      zRozmiarem: d('tekst przed <svg xmlns="http://www.w3.org/2000/svg" width="2400px" height="600"><circle r="5"/></svg> i po'),
      zly: d('<svg><g></svg>'),
      nieSvg: d('zwykły tekst'),
    };
  });
  assert.deepEqual(svg.ikona, ['1200', '600', '0 0 24 12', 'http://www.w3.org/2000/svg', false]);
  assert.deepEqual(svg.zRozmiarem, ['2400', '600', '0 0 2400 600', 'http://www.w3.org/2000/svg', false]);
  assert.equal(svg.zly, null);
  assert.equal(svg.nieSvg, null);

  // Zrzut ekranu w schowku (plik PNG) i kod SVG skopiowany jako tekst.
  const wklej = (dane) => strona.evaluate(async ({ png, tekst }) => {
    const dt = new DataTransfer();
    if (png) dt.items.add(new File([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], 'image.png', { type: 'image/png' }));
    if (tekst) dt.setData('text/plain', tekst);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, dane);
  const obrazy = () => strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'image').map((o) => [o.nazwa.replace(/\d\d\.\d\d/, 'GG.MM'), o.width, o.height, Math.round(o.getScaledWidth() * 10) / 10]));
  await wklej({ png: PNG_2X2.toString('base64') });
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 1);
  await wklej({ tekst: '<svg viewBox="0 0 40 20"><rect width="40" height="20" fill="#c00"/></svg>' });
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 2);
  // Zwykły tekst w schowku niczego nie wstawia.
  await wklej({ tekst: 'to nie jest obraz' });
  assert.deepEqual(await obrazy(), [['wklejony GG.MM.png', 2, 2, 88.8], ['wklejony.svg', 1200, 600, 88.8]]);

  // Plik SVG z dysku bez szerokości i wysokości (sam viewBox) wstawia się w dobrych proporcjach.
  await strona.setInputFiles('#plik-obraz', { name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 30"><rect width="10" height="30"/></svg>') });
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 3);
  assert.deepEqual((await obrazy())[2].slice(0, 3), ['logo.svg', 400, 1200]);

  // Zapis: obrazy są zasobami projektu, SVG zostaje wektorem.
  const zasoby = await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); const { dataUrlZasobu } = await import('./js/zasoby.js'); const p = window.seriodruk.stan.projekt; return Promise.all(Object.keys(p.zasoby).map(async (id) => (await dataUrlZasobu(p, id)).slice(0, 18))); });
  assert.deepEqual(zasoby, ['data:image/png;bas', 'data:image/svg+xml', 'data:image/svg+xml']);

  // Ctrl+C / Ctrl+V na elemencie z aplikacji działa jak dotąd (prawdziwe klawisze i prawdziwy schowek).
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.getObjects().slice().forEach((o) => e.canvas.remove(o)); e.dodajProstokat(); });
  await strona.keyboard.press('Control+c');
  await strona.waitForFunction(() => window.seriodruk.edytor.maSchowek);
  await strona.keyboard.press('Control+v');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 2);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().map((o) => o.type)), ['rect', 'rect']);

  // W trakcie pisania tekstu wklejanie należy do tekstu – nie wstawia elementów.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.dodajTekst('abc'); e.edytujTekst(); });
  await strona.keyboard.press('Control+v');
  await strona.waitForTimeout(200);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().length), 3);
  assert.deepEqual(bledy, []);
});
