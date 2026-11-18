// Zapis do InDesigna (#221): pakiet IDML – mimetype pierwszy i bez kompresji, designmap z rozkładówkami
// i historiami, strona z wymiarami i marginesami w pt, ramka tekstu z historią (czcionka, odmiana, kolor,
// wyrównanie, akapity), kształty z kolorami, obraz osadzony (PNG w base64).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('idml: pakiet, strona, historia tekstu, kształty, obraz osadzony, pobranie z menu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Do InDesigna');
  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony[0].tlo = '#fdf0d5';
    p.strony[0].obiekty.push(
      { type: 'textbox', id: 'o_t', left: 15, top: 20, width: 100, text: 'Tytuł książki\nDrugi akapit', fontFamily: 'Inter', fontSize: 8, fill: '#1f2a44', textAlign: 'center', styles: [{ start: 0, end: 5, style: { fontWeight: 'bold', fill: '#c1121f' } }] },
      { type: 'rect', id: 'o_r', left: 15, top: 60, width: 50, height: 30, fill: '#2a9d8f', stroke: '#000000', strokeWidth: 0.5, angle: 15 },
      { type: 'ellipse', id: 'o_e', left: 80, top: 60, rx: 20, ry: 10, width: 40, height: 20, fill: '#e9c46a' },
      { type: 'rect', id: 'o_cien', left: 15, top: 120, width: 40, height: 40, fill: '#264653', shadow: { color: 'rgba(0,0,0,0.5)', blur: 4, offsetX: 1, offsetY: 1 } },
    );
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const { zapiszIdml } = await import('./js/idml.js');
    const wynik = await zapiszIdml(p, JSZip);
    const surowe = new Uint8Array(await wynik.blob.arrayBuffer());
    // Pierwszy wpis ZIP: nazwa „mimetype”, metoda 0 (bez kompresji).
    const dv = new DataView(surowe.buffer);
    const pierwszy = { metoda: dv.getUint16(8, true), nazwa: new TextDecoder().decode(surowe.subarray(30, 30 + dv.getUint16(26, true))) };
    const zip = await JSZip.loadAsync(wynik.blob);
    const pliki = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    const czytaj = async (n) => new DOMParser().parseFromString(await zip.file(n).async('string'), 'application/xml');
    const bledyXml = [];
    for (const n of pliki.filter((x) => x.endsWith('.xml'))) if ((await czytaj(n)).querySelector('parsererror')) bledyXml.push(n);
    const dm = await czytaj('designmap.xml');
    const spready = [...dm.getElementsByTagName('idPkg:Spread')].map((e) => e.getAttribute('src'));
    const historie = [...dm.getElementsByTagName('idPkg:Story')].map((e) => e.getAttribute('src'));
    const sp = await czytaj(spready[0]);
    const strona = sp.querySelector('Page');
    const historia = await czytaj(historie[0]);
    const zakresy = [...historia.querySelectorAll('CharacterStyleRange')].map((c) => [c.querySelector('Content')?.textContent, c.querySelector('AppliedFont')?.textContent, c.getAttribute('FontStyle'), c.getAttribute('FillColor'), Math.round(c.getAttribute('PointSize'))]);
    const obraz = sp.querySelector('Image');
    const png = obraz ? atob(obraz.querySelector('Contents').textContent.slice(0, 8)).slice(1, 4) : '';
    return {
      pierwszy, bledyXml, mimetype: await zip.file('mimetype').async('string'), ile: wynik.ile,
      stron: spready.length, historii: historie.length, storyList: dm.documentElement.getAttribute('StoryList').split(' ').length,
      bounds: strona.getAttribute('GeometricBounds'), przes: strona.getAttribute('ItemTransform'),
      margines: Math.round(strona.querySelector('MarginPreference').getAttribute('Top')),
      zakresy, akapity: historia.querySelectorAll('ParagraphStyleRange').length,
      just: historia.querySelector('ParagraphStyleRange').getAttribute('Justification'),
      ksztalty: [...sp.querySelectorAll('Rectangle, Oval')].filter((e) => e.getAttribute('ContentType') !== 'GraphicType').map((e) => [e.tagName, e.getAttribute('FillColor'), e.querySelectorAll('PathPointType').length]),
      obrot: sp.querySelector('Rectangle[Name="rect"]').getAttribute('ItemTransform').split(' ').slice(0, 2).map((x) => Math.round(Number(x) * 1000) / 1000),
      png, kolory: [...(await czytaj('Resources/Graphic.xml')).querySelectorAll('Color')].map((c) => c.getAttribute('Name')),
    };
  });
  assert.deepEqual(w.pierwszy, { metoda: 0, nazwa: 'mimetype' });
  assert.equal(w.mimetype, 'application/vnd.adobe.indesign-idml-package');
  assert.deepEqual(w.bledyXml, []);
  assert.deepEqual(w.ile, { teksty: 1, ksztalty: 2, obrazy: 1 });
  assert.equal(w.stron, 1);
  assert.equal(w.historii, 1);
  assert.equal(w.storyList, 2, 'historia tekstu i historia zaplecza');
  assert.equal(w.bounds, '0 0 595.276 419.528');
  assert.equal(w.przes, '1 0 0 1 -209.764 -297.638');
  assert.equal(w.margines, 28);
  assert.deepEqual(w.zakresy, [
    ['Tytuł', 'Inter', 'Bold', 'Color/Makietka #c1121f', 23],
    [' książki', 'Inter', 'Regular', 'Color/Makietka #1f2a44', 23],
    ['Drugi akapit', 'Inter', 'Regular', 'Color/Makietka #1f2a44', 23],
  ]);
  assert.equal(w.akapity, 2);
  assert.equal(w.just, 'CenterAlign');
  assert.deepEqual(w.ksztalty, [['Rectangle', 'Color/Makietka #fdf0d5', 4], ['Rectangle', 'Color/Makietka #2a9d8f', 4], ['Oval', 'Color/Makietka #e9c46a', 4]]);
  assert.deepEqual(w.obrot, [0.966, 0.259], 'obrót 15°');
  assert.equal(w.png, 'PNG');
  for (const k of ['Black', 'Paper', 'Makietka #2a9d8f', 'Makietka #c1121f']) assert.ok(w.kolory.includes(k), k);

  // Z menu: najpierw raport przeniesienia (#232), pobranie po „Pobierz”.
  await strona.evaluate(() => document.querySelector('[data-akcja="idml"]').click());
  await strona.waitForSelector('#dlg-raport-przeniesienia[open]');
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#dlg-raport-przeniesienia button[value="tak"]')]);
  assert.equal(plik.suggestedFilename(), 'Do InDesigna.idml');
  assert.deepEqual(bledy, []);
});
