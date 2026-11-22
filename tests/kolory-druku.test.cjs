// Kolory do druku (decyzja #127): kolory dodatkowe (spot) jako osobne płyty Separation, uszlachetnienia na
// płytach z nadrukiem (/OP), pliki osobno albo bez uszlachetnień, tryby „Skala szarości” i „cz/b + 1 kolor”.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Eksport PDF i rozbiór pliku w przeglądarce: płyty (ColorSpace), stany grafiki z nadrukiem i treść stron.
async function eksport(strona, opcje = {}) {
  return strona.evaluate(async (o) => {
    const { stan } = window.seriodruk;
    const { zapiszTeraz } = await import('./js/app/zapis.js');
    await zapiszTeraz();
    const { eksportujPdf } = await import('./js/eksport.js');
    const w = await eksportujPdf(stan.projekt, { znaki: false, spad: false, ...o });
    const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream } = window.PDFLib;
    const pliki = [];
    const rozbierz = async (bajty, nazwa) => {
      const dok = await PDFDocument.load(bajty);
      const zas = dok.getPage(0).node.Resources();
      const cs = zas.lookupMaybe(PDFName.of('ColorSpace'), PDFDict);
      const plyty = cs ? cs.keys().map((k) => { const a = dok.context.lookup(cs.get(k), PDFArray); return { nazwa: a.get(1).decodeText ? a.get(1).decodeText() : String(a.get(1)).slice(1).replace(/#20/g, ' '), alt: String(a.get(2)) }; }) : [];
      const gs = zas.lookupMaybe(PDFName.of('ExtGState'), PDFDict);
      const nadruk = gs ? gs.keys().some((k) => String(dok.context.lookup(gs.get(k)).get(PDFName.of('OP'))) === 'true') : false;
      const xo = zas.lookupMaybe(PDFName.of('XObject'), PDFDict);
      const maski = xo ? xo.keys().filter((k) => dok.context.lookup(xo.get(k)).dict?.get(PDFName.of('ImageMask'))).length : 0;
      const szare = xo ? xo.keys().filter((k) => String(dok.context.lookup(xo.get(k)).dict?.get(PDFName.of('ColorSpace'))) === '/DeviceGray').length : 0;
      let tresc = '';
      for (const s of dok.getPage(0).node.Contents() instanceof PDFArray ? dok.getPage(0).node.Contents().asArray() : [dok.getPage(0).node.Contents()]) {
        const strumien = dok.context.lookup(s);
        const surowe = strumien instanceof PDFRawStream ? strumien.contents : strumien.getContents();
        const filtr = String(strumien.dict.get(PDFName.of('Filter')) || '');
        if (filtr === '/FlateDecode') tresc += await new Response(new Blob([surowe]).stream().pipeThrough(new DecompressionStream('deflate'))).text();
        else tresc += new TextDecoder().decode(surowe);
      }
      pliki.push({ nazwa, plyty, nadruk, maski, szare, tresc });
    };
    if (/\.zip$/.test(w.nazwa)) {
      await import('./js/biblioteki.js').then((m) => m.biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP'));
      const zip = await window.JSZip.loadAsync(await w.blob.arrayBuffer());
      for (const n of Object.keys(zip.files).filter((x) => x.endsWith('.pdf')).sort()) await rozbierz(await zip.file(n).async('uint8array'), n);
    } else await rozbierz(new Uint8Array(await w.blob.arrayBuffer()), w.nazwa);
    return { pliki, uwagi: w.uwagi };
  }, opcje);
}

test('model: odcienie koloru dodatkowego, rejestr, tryby i najbliższy dozwolony kolor, zmiana zapasu przekolorowuje projekt', async (t) => {
  const { strona, bledy } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const k = await import('./js/kolory-druku.js');
    const { normalizuj, nowyProjekt } = await import('./js/projekt.js');
    const spot = { id: 'p186', nazwa: 'PANTONE 186 C', cmyk: [0, 100, 81, 4] };
    const p = normalizuj({ ...nowyProjekt('X'), kolory_dodatkowe: [spot, { nazwa: '' }], tryb_kolorow: 'czb1', kolor_trybu: 'nie-ma' });
    const pelny = k.hexSpotu(spot, 1); const pol = k.hexSpotu(spot, 0.5);
    const mapa = k.mapaSpotow([spot]);
    p.strony[0].obiekty = [{ type: 'rect', fill: pol, stroke: '#ff8800' }, { type: 'textbox', fill: '#333333', styles: { 0: { 0: { fill: pelny } } } }];
    const zle = k.koloryPozaTrybem(p);
    const najblizszy = k.najblizszyDozwolony('#ff0000', p);
    const zmian = k.zmienZapasSpotu(p, p.kolory_dodatkowe[0], [0, 100, 100, 0]);
    return {
      liczba: p.kolory_dodatkowe.length, drugaNazwa: p.kolory_dodatkowe[1].nazwa, trybu: p.kolor_trybu, pelny, pol,
      wMapie: mapa.get(pol)?.t, zle, najblizszy, zmian, poZmianie: p.strony[0].obiekty[0].fill, nowyPol: k.hexSpotu({ cmyk: [0, 100, 100, 0] }, 0.5),
      fragment: p.strony[0].obiekty[1].styles[0][0].fill, szarosc: k.kolorDozwolony('#777777', p),
      domyslny: normalizuj(nowyProjekt('Y')).tryb_kolorow ?? 'brak',
    };
  });
  assert.equal(w.liczba, 2);
  assert.equal(w.drugaNazwa, 'Kolor dodatkowy 2');
  assert.equal(w.trybu, 'p186', 'kolor trybu: pierwszy kolor dodatkowy, gdy wskazanego nie ma');
  assert.equal(w.wMapie, 0.5);
  assert.deepEqual(w.zle, ['#ff8800'], 'pomarańczowy obrys nie pasuje do cz/b + Pantone; odcień spotu i szarość pasują');
  assert.notEqual(w.najblizszy, '#ff0000');
  assert.equal(w.zmian, 2, 'zmiana zapasu przekolorowuje wypełnienie i fragment tekstu');
  assert.equal(w.poZmianie, w.nowyPol);
  assert.equal(w.szarosc, true);
  assert.equal(w.domyslny, 'brak', 'pełny kolor to domyślny tryb – pole nie jest zapisywane');
  assert.deepEqual(bledy, []);
});

test('PDF: kolor dodatkowy jako płyta Separation; uszlachetnienia na płytach z nadrukiem; osobne pliki i pominięcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Druk');
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-elipse"]').click());
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.selectable !== false && o.type !== 'line').length >= 3);
  await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const k = await import('./js/kolory-druku.js');
    stan.projekt.kolory_dodatkowe = [{ id: 'p186', nazwa: 'PANTONE 186 C', cmyk: [0, 100, 81, 4] }];
    const obiekty = edytor.canvas.getObjects();
    const prost = obiekty.find((o) => o.type === 'rect');
    const elipsa = obiekty.find((o) => o.type === 'ellipse');
    const tekst = obiekty.find((o) => o.type === 'textbox');
    prost.set({ fill: k.hexSpotu(stan.projekt.kolory_dodatkowe[0], 0.6) });
    elipsa.set({ uszlachetnienie: 'folia', folia: 'zloto' });
    tekst.set({ uszlachetnienie: 'uv' });
    edytor.canvas.fire('object:modified', { target: prost });
  });
  // Płyty w tym samym pliku (CMYK).
  let w = await eksport(strona, { cmyk: true });
  let p = w.pliki[0];
  const nazwy = p.plyty.map((x) => x.nazwa).sort();
  assert.deepEqual(nazwy, ['Foil_Gold', 'PANTONE 186 C', 'Spot_UV'], JSON.stringify(p.plyty));
  assert.ok(p.plyty.every((x) => x.alt === '/DeviceCMYK'), 'zapas płyt w CMYK');
  assert.ok(p.nadruk, 'uszlachetnienia z nadrukiem (/OP true)');
  assert.match(p.tresc, /\/\w+ cs 0\.6 scn/, 'prostokąt w kolorze dodatkowym, odcień 60%');
  assert.match(p.tresc, /\/\w+ cs 1 scn/, 'uszlachetnienie pełną farbą płyty');
  // Osobny plik na każde uszlachetnienie; główny bez nich.
  w = await eksport(strona, { cmyk: true, uszlachetnienia: 'osobno' });
  assert.equal(w.pliki.length, 3, w.pliki.map((x) => x.nazwa).join(' | '));
  const glowny = w.pliki.find((x) => !/\(Foil_Gold\)|\(Spot_UV\)/.test(x.nazwa));
  assert.deepEqual(glowny.plyty.map((x) => x.nazwa), ['PANTONE 186 C']);
  const zloto = w.pliki.find((x) => /Foil_Gold/.test(x.nazwa));
  assert.deepEqual(zloto.plyty.map((x) => x.nazwa), ['Foil_Gold'], 'plik złocenia ma tylko płytę złocenia');
  assert.ok(!/ re f/.test(zloto.tresc.split('\n')[0] || ''), 'plik uszlachetnienia bez tła');
  // Pominięcie uszlachetnień.
  w = await eksport(strona, { cmyk: true, uszlachetnienia: 'pomin' });
  assert.deepEqual(w.pliki[0].plyty.map((x) => x.nazwa), ['PANTONE 186 C']);
  // Uszlachetnienie na zdjęciu: maska 1-bitowa w farbie płyty, nie obraz CMYK.
  await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    const plotno = document.createElement('canvas'); plotno.width = 40; plotno.height = 30;
    const x = plotno.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 40, 30);
    const img = await fabric.FabricImage.fromURL(plotno.toDataURL('image/png'));
    img.set({ left: 10, top: 10, scaleX: 0.5, scaleY: 0.5, uszlachetnienie: 'bialy', id: 'zdj' });
    edytor.canvas.add(img);
    edytor.canvas.getObjects().filter((o) => o.uszlachetnienie && o.id !== 'zdj').forEach((o) => o.set({ uszlachetnienie: undefined }));
    edytor.canvas.fire('object:modified', { target: img });
  });
  w = await eksport(strona, { cmyk: true });
  p = w.pliki[0];
  assert.ok(p.plyty.some((x) => x.nazwa === 'White'), 'biały poddruk jako płyta White');
  assert.equal(p.maski, 1, 'zdjęcie z białym poddrukiem jako maska w farbie płyty');
  assert.deepEqual(bledy, []);
});

test('PDF: „Skala szarości” – kolory samą czernią, obrazy w odcieniach szarości; „cz/b + 1 kolor” – czerń i jedna płyta', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Szary');
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'rect'));
  await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const k = await import('./js/kolory-druku.js');
    stan.projekt.kolory_dodatkowe = [{ id: 'r', nazwa: 'Czerwony 032', cmyk: [0, 90, 86, 0] }, { id: 'n', nazwa: 'Niebieski', cmyk: [100, 50, 0, 0] }];
    stan.projekt.tryb_kolorow = 'szarosc';
    const prost = edytor.canvas.getObjects().find((o) => o.type === 'rect');
    prost.set({ fill: '#ff0000' });
    const plotno = document.createElement('canvas'); plotno.width = 20; plotno.height = 20;
    plotno.getContext('2d').fillStyle = '#0a0'; plotno.getContext('2d').fillRect(0, 0, 20, 20);
    const img = await fabric.FabricImage.fromURL(plotno.toDataURL('image/png'));
    img.set({ left: 60, top: 60 });
    edytor.canvas.add(img);
    window.__spot = k.hexSpotu(stan.projekt.kolory_dodatkowe[0], 1);
    window.__inny = k.hexSpotu(stan.projekt.kolory_dodatkowe[1], 1);
    edytor.canvas.fire('object:modified', { target: prost });
  });
  let w = await eksport(strona, {});
  let p = w.pliki[0];
  assert.deepEqual(p.plyty, [], 'bez płyt w skali szarości');
  assert.ok(p.szare >= 1, 'zdjęcie w odcieniach szarości (DeviceGray)');
  assert.match(p.tresc, /0 0 0 0\.\d+ k/, 'czerwony jako sama czerń (K)');
  assert.ok(!/ rg\b/.test(p.tresc), 'bez kolorów RGB');
  await strona.evaluate(() => {
    const { stan, edytor } = window.seriodruk;
    stan.projekt.tryb_kolorow = 'czb1'; stan.projekt.kolor_trybu = 'r';
    const prost = edytor.canvas.getObjects().find((o) => o.type === 'rect');
    prost.set({ fill: window.__spot, stroke: window.__inny, strokeWidth: 1 });
    edytor.canvas.fire('object:modified', { target: prost });
  });
  w = await eksport(strona, {});
  p = w.pliki[0];
  assert.deepEqual(p.plyty.map((x) => x.nazwa), ['Czerwony 032'], 'tylko płyta koloru trybu – drugi kolor dodatkowy idzie czernią');
  assert.deepEqual(bledy, []);
});
