// Zapis do Scribusa (#220): plik .sla (format Scribusa 1.5) – strony ze spadem i marginesami, teksty jako
// ramki tekstowe z czcionką i kolorem, kształty jako wielokąty z kolorami, reszta jako obrazy osadzone
// w pliku (qCompress + base64, jak czyta Scribus).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, zPlikow } = require('./pomoc.cjs');

test('scribus: strony, ramka tekstu, kształty, obraz w pliku, pobranie z menu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Do Scribusa');
  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const s = p.strony[0];
    s.tlo = '#fdf0d5';
    s.obiekty.push(
      { type: 'textbox', id: 'o_t', left: 15, top: 20, width: 100, text: 'Tytuł książki\nDrugi akapit', fontFamily: 'Inter', fontSize: 8, fill: '#1f2a44', textAlign: 'center', styles: [{ start: 0, end: 5, style: { fontWeight: 'bold', fill: '#c1121f' } }] },
      { type: 'rect', id: 'o_r', left: 15, top: 60, width: 50, height: 30, fill: '#2a9d8f', stroke: '#000000', strokeWidth: 0.5, angle: 15 },
      { type: 'ellipse', id: 'o_e', left: 80, top: 60, rx: 20, ry: 10, width: 40, height: 20, fill: '#e9c46a' },
      { type: 'rect', id: 'o_cien', left: 15, top: 120, width: 40, height: 40, fill: '#264653', shadow: { color: 'rgba(0,0,0,0.5)', blur: 4, offsetX: 1, offsetY: 1 } },
    );
    const { zapiszSla } = await import('./js/scribus.js');
    const wynik = await zapiszSla(p);
    const doc = new DOMParser().parseFromString(wynik.sla, 'application/xml');
    const blad = doc.querySelector('parsererror')?.textContent || '';
    const obj = [...doc.querySelectorAll('PAGEOBJECT')];
    const a = (el, k) => el.getAttribute(k);
    // Obraz osadzony: base64 → 4 bajty długości + zlib → PNG.
    const img = obj.find((o) => a(o, 'PTYPE') === '2');
    let png = '';
    if (img) {
      const bajty = Uint8Array.from(atob(a(img, 'ImageData')), (c) => c.charCodeAt(0));
      const dlugosc = new DataView(bajty.buffer).getUint32(0);
      const roz = new Uint8Array(await new Response(new Blob([bajty.subarray(4)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
      png = `${roz.length === dlugosc}:${String.fromCharCode(...roz.subarray(1, 4))}`;
    }
    const tekst = obj.find((o) => a(o, 'PTYPE') === '4');
    return {
      blad, ile: wynik.ile, czcionki: wynik.czcionki,
      korzen: doc.documentElement.nodeName, wersja: a(doc.documentElement, 'Version'),
      strony: [...doc.querySelectorAll('PAGE')].map((x) => [Math.round(a(x, 'PAGEWIDTH')), Math.round(a(x, 'PAGEHEIGHT')), Math.round(a(x, 'BORDERTOP'))]),
      spad: Math.round(a(doc.querySelector('DOCUMENT'), 'BleedTop') * 100) / 100,
      kolory: [...doc.querySelectorAll('COLOR')].map((c) => a(c, 'NAME')),
      itext: tekst ? [...tekst.querySelectorAll('ITEXT')].map((x) => [a(x, 'CH'), a(x, 'FONT'), a(x, 'FCOLOR'), Math.round(a(x, 'FONTSIZE'))]) : [],
      akapity: tekst ? tekst.querySelectorAll('para').length : 0,
      align: tekst?.querySelector('trail')?.getAttribute('ALIGN'),
      prostokat: obj.filter((o) => a(o, 'PTYPE') === '6').map((o) => [a(o, 'PCOLOR'), Math.round(a(o, 'ROT')), a(o, 'path').startsWith('M')]),
      png,
    };
  });
  assert.equal(w.blad, '');
  assert.equal(w.korzen, 'SCRIBUSUTF8NEW');
  assert.match(w.wersja, /^1\.5\./);
  // A5: 148 × 210 mm = 419,5 × 595,3 pt; spad 3 mm = 8,5 pt; margines 10 mm = 28,3 pt.
  assert.deepEqual(w.strony, [[420, 595, 28]]);
  assert.equal(w.spad, 8.5);
  assert.deepEqual(w.ile, { teksty: 1, ksztalty: 2, obrazy: 1 }, 'prostokąt i elipsa – kształty (tło osobno); cień – obraz');
  assert.deepEqual(w.itext, [
    ['Tytuł', 'Inter Bold', 'Makietka #c1121f', 23],
    [' książki', 'Inter Regular', 'Makietka #1f2a44', 23],
    ['Drugi akapit', 'Inter Regular', 'Makietka #1f2a44', 23],
  ]);
  assert.equal(w.akapity, 1);
  assert.equal(w.align, '1');
  assert.deepEqual(w.prostokat, [['Makietka #fdf0d5', 0, true], ['Makietka #2a9d8f', 15, true], ['Makietka #e9c46a', 0, true]]);
  for (const k of ['Makietka #fdf0d5', 'Makietka #2a9d8f', 'Makietka #c1121f', 'Makietka #000000']) assert.ok(w.kolory.includes(k), k);
  assert.equal(w.png, 'true:PNG');
  assert.deepEqual(w.czcionki.sort(), ['Inter Bold', 'Inter Regular']);

  // Z menu ⋯ – pobranie pliku .sla.
  await strona.click('#menu-projektu-przycisk, [data-akcja="menu-projektu"]').catch(() => {});
  await zPlikow(strona, 'scribus');
  await strona.waitForSelector('#dlg-raport-przeniesienia[open]');
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#dlg-raport-przeniesienia button[value="tak"]')]);
  assert.equal(plik.suggestedFilename(), 'Do Scribusa.sla');
  assert.deepEqual(bledy, []);
});
