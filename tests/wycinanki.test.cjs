// Wycinanki i składanki (#218): linie wykrojnika jako wykończenie elementu (cięcie, big, perforacja, klej) –
// w panelu „Kolory do druku”, w edytorze zawsze widoczne, w eksporcie obrazów bez śladu, w PDF na płytach
// technicznych; kontrola „czy się wytnie i złoży”; plik SVG dla plotera w milimetrach.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('wycinanki: cięcie, big i klej – panel, kontrola, SVG dla plotera, płyty w PDF', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Pudełko na prezent');
  // Prostokąt → „Cięcie” w panelu.
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  // Część „Kolory do druku” bywa zwinięta – przycisk jest w panelu.
  await strona.waitForSelector('#wlasciwosci [data-wykonczenie="ciecie"]', { state: 'attached' });
  await strona.evaluate(() => document.querySelector('#wlasciwosci [data-wykonczenie="ciecie"]').click());
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.uszlachetnienie === 'ciecie');
  const w = await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const r = e.aktywny;
    r.set({ left: 20, top: 20, width: 100, height: 120, scaleX: 1, scaleY: 1 });
    e.zatwierdz();
    const { zapiszBiezacyCel } = await import('./js/app/zapis.js');
    zapiszBiezacyCel();
    const p = window.seriodruk.stan.projekt;
    const s = p.strony[0];
    s.obiekty.push({ type: 'line', id: 'o_big', x1: 0, y1: 0, x2: 100, y2: 0, left: 20, top: 60, width: 100, height: 0, stroke: '#000', strokeWidth: 0.3, uszlachetnienie: 'big' });
    s.obiekty.push({ type: 'rect', id: 'o_klej', left: 130, top: 20, width: 10, height: 40, fill: '#ccc', uszlachetnienie: 'klej' });
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { rozwin } = await import('./js/serie.js');
    const ciag = rozwin(p);
    const uwagi = sprawdzProjekt(p, ciag).filter((u) => u.rodzaj === 'wykrojnik').map((u) => u.opis);
    const { svgPlotera } = await import('./js/ploter.js');
    const svg = await svgPlotera(p, ciag.egzemplarze[0], { ciag });
    const { uzyteKoloryDruku } = await import('./js/kolory-druku.js');
    return { uwagi, svg: svg.svg, ile: svg.ile, plyty: uzyteKoloryDruku(p).uszlachetnienia.map((u) => u.plyta).sort() };
  });
  assert.equal(w.uwagi.length, 1, w.uwagi.join(' | '));
  assert.match(w.uwagi[0], /poza wykrojem/, 'klej poza wycinanym kawałkiem');
  assert.deepEqual(w.ile, { ciecie: 1, big: 1, perforacja: 0, klej: 1 });
  assert.match(w.svg, /width="148mm" height="210mm"/);
  assert.match(w.svg, /stroke: ?rgb\(224,0,77\)|stroke="#e0004d"|e0004d/i);
  assert.deepEqual(w.plyty, ['CutContour', 'Crease', 'Glue'].sort());
  // Linia cięcia w edytorze widoczna (czerwony kontur), w obrazie strony do eksportu – nie.
  const piksele = await strona.evaluate(async () => {
    const { pngCelu } = await import('./js/eksport.js');
    const p = window.seriodruk.stan.projekt;
    const url = await pngCelu(p, p.strony[0], 30);
    const img = new Image();
    await new Promise((ok) => { img.onload = ok; img.src = url; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let czerwone = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 80 && d[i + 2] < 120) czerwone += 1;
    return czerwone;
  });
  assert.equal(piksele, 0, 'linie wykrojnika nie drukują się w obrazie strony');
  assert.deepEqual(bledy, []);
});
