// Druk (#131C): układ arkuszy (broszura, składki, 2 i 4 na arkuszu), PDF do czytania (zakładki, linki),
// podgląd separacji (płyty, pokrycie farbą).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const PDFLib = require('../js/zewnetrzne/pdf-lib-1.17.1.min.js');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);
const mm = (pt) => Math.round((pt * 25.4 / 72) * 10) / 10;

test('plan arkuszy: broszura 16 stron, dopełnienie do 4, składki, 2 i 4 na arkuszu', async () => {
  const { planImpozycji, kolejnoscBroszury, opisPlanu } = await modul('js/impozycja.js');
  const b = kolejnoscBroszury(16).strony;
  assert.deepEqual(b.slice(0, 4).map((s) => [s.lewa + 1, s.prawa + 1]), [[16, 1], [2, 15], [14, 3], [4, 13]]);
  assert.equal(b.length, 8, '4 arkusze, przód i tył');
  const dziesiec = planImpozycji(10, { uklad: 'broszura' });
  assert.equal(dziesiec.puste, 2);
  assert.deepEqual(dziesiec.strony[0].pola, [null, 0], 'pierwszy arkusz: pusta | 1');
  assert.deepEqual(dziesiec.strony[1].pola, [1, null], 'tył: 2 | pusta');
  // Składki po 8: 20 stron → 3 składki (ostatnia z 4 pustymi), każda układana osobno.
  const skl = planImpozycji(20, { uklad: 'skladki', skladka: 8 });
  assert.equal(skl.skladek, 3);
  assert.equal(skl.puste, 4);
  assert.deepEqual(skl.strony[0].pola, [7, 0]);
  assert.deepEqual(skl.strony[4].pola, [15, 8], 'druga składka zaczyna się od strony 9');
  assert.deepEqual(planImpozycji(5, { uklad: 'cztery' }).strony.map((s) => s.pola), [[0, 1, 2, 3], [4, null, null, null]]);
  assert.match(opisPlanu(10, { uklad: 'broszura' }), /3 arkusze do druku dwustronnego.*dopełnione 2 pustymi stronami/);
});

test('PDF na arkuszach: broszura z 6 stron A5 – 2 arkusze A4 w poziomie, strony we właściwej kolejności, znaki złamu', async () => {
  const { impozycjaPdf, wymiaryArkusza } = await modul('js/impozycja.js');
  const zrodlo = await PDFLib.PDFDocument.create();
  const A5 = [148 * 72 / 25.4, 210 * 72 / 25.4];
  for (let i = 0; i < 6; i += 1) {
    const s = zrodlo.addPage(A5);
    s.drawText(`Strona ${i + 1}`, { x: 20, y: 300, size: 20 });
    s.setTrimBox(0, 0, A5[0], A5[1]);
  }
  const { pdf, plan } = await impozycjaPdf(PDFLib, await zrodlo.save(), { uklad: 'broszura', format: 'A4', znaki: true });
  assert.equal(plan.puste, 2);
  const zapis = await PDFLib.PDFDocument.load(await pdf.save());
  assert.equal(zapis.getPageCount(), 4, '2 arkusze × 2 strony');
  const m = zapis.getPage(0).getMediaBox();
  assert.deepEqual([mm(m.width), mm(m.height)], [297, 210], 'A4 w poziomie, A5 obok siebie bez zmniejszania');
  assert.deepEqual(wymiaryArkusza(148, 210, 2, 1, { format: 'auto', znaki: false }), { szer: 296, wys: 210, skala: 1, x: 0, y: 0, blokW: 296, blokH: 210 });
  // Kolejność: arkusz 1 przód = pusta | 1, tył = 2 | pusta – na stronie PDF jest jedna osadzona strona.
  const formy = (i) => zapis.getPage(i).node.Resources().lookup(PDFLib.PDFName.of('XObject'));
  assert.equal(formy(0).keys().length, 1);
  assert.equal(formy(2).keys().length, 2, 'arkusz 2 (tył pierwszego arkusza ma jedną stronę, drugi arkusz – dwie)');
});

test('separacje: płyty CMYK, kolor dodatkowy na własnej płycie, maska uszlachetnienia, pokrycie farbą', async () => {
  const { rozbij, obrazPlyt, maskaZRoznicy, tacKoloru } = await modul('js/separacje.js');
  // 3 piksele: czerwony, czarny, kolor spotu (#00ff00 jako przykład).
  const dane = Uint8ClampedArray.from([255, 0, 0, 255, 0, 0, 0, 255, 0, 255, 0, 255]);
  const r = rozbij(dane, 3, 1, { spoty: new Map([['#00ff00', { nazwa: 'PANTONE X', odcien: 1 }]]), maski: new Map([['Spot_UV', Uint8Array.from([1, 0, 0])]]) });
  assert.deepEqual([...r.plyty.keys()], ['C', 'M', 'Y', 'K', 'PANTONE X', 'Spot_UV']);
  assert.deepEqual(['C', 'M', 'Y', 'K'].map((id) => r.plyty.get(id)[0]), [0, 1, 1, 0], 'czerwony = M + Y');
  assert.deepEqual(['C', 'M', 'Y', 'K'].map((id) => r.plyty.get(id)[1]), [0, 0, 0, 1], 'czerń samą czernią');
  assert.equal(r.plyty.get('PANTONE X')[2], 1);
  assert.equal(r.plyty.get('C')[2], 0, 'kolor dodatkowy nie idzie na CMYK');
  assert.equal(r.tacMax, 200);
  // Jedna płyta w szarości: czerń tam, gdzie jest farba.
  const k = obrazPlyt(r, { wlaczone: new Set(['K']), kolory: new Map(), jedna: true });
  assert.deepEqual([k[0], k[4]], [255, 0]);
  // Bez płyty M czerwony zostaje żółty.
  const bezM = obrazPlyt(r, { wlaczone: new Set(['C', 'Y', 'K']), kolory: new Map([['C', [0, 174, 239]], ['Y', [255, 242, 0]], ['K', [35, 31, 32]]]) });
  assert.deepEqual([...bezM.slice(0, 3)], [255, 242, 0]);
  assert.deepEqual([...maskaZRoznicy(Uint8ClampedArray.from([255, 255, 255, 255, 10, 10, 10, 255]), 2, 1)], [0, 1]);
  assert.equal(tacKoloru('#ff0000'), 200);
  assert.equal(tacKoloru('#ff0000', { wektor: () => [0.9, 0.9, 0.9, 0.9] }), 360, 'z profilem drukarni');
});

test('PDF do czytania: zakładki z sekcji i nagłówków, link elementu, klikalny spis treści; broszura z okna eksportu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Książeczka');
  await strona.evaluate(async () => {
    const { stan, zapiszTeraz, przeladuj } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    const tytul = p.style.find((s) => /^Tytuł/.test(s.nazwa)) || p.style[0];
    p.ksiazka = { naglowki: [{ styl: tytul.id, poziom: 1 }] };
    const druga = { ...structuredClone(p.sekcje[0]), id: 'sek2', nazwa: 'Dodatek' };
    p.sekcje.push(druga);
    const tekst = (id, text, extra = {}) => ({ type: 'textbox', version: '5.3.0', left: 20, top: 30, width: 100, text, fontSize: 6, fontFamily: 'Inter', fill: '#000000', id, ...extra });
    p.strony[0].obiekty = [
      { type: 'textbox', version: '5.3.0', left: 15, top: 20, width: 110, text: '', fontSize: 5, fontFamily: 'Inter', fill: '#000000', id: 'spis', ksiazka: { rodzaj: 'spis', poziomy: 1, kropki: true } },
      { type: 'rect', version: '5.3.0', left: 20, top: 150, width: 40, height: 20, fill: '#2255aa', id: 'przycisk', link: 'makietka.app' },
    ];
    p.strony.push({ ...structuredClone(p.strony[0]), id: 's2', nazwa: 'Rozdział 1', obiekty: [tekst('n1', 'Pierwszy rozdział', { styl: tytul.id })] });
    p.strony.push({ ...structuredClone(p.strony[0]), id: 's3', nazwa: 'Rozdział 2', obiekty: [tekst('n2', 'Drugi rozdział', { styl: tytul.id })] });
    p.strony.push({ ...structuredClone(p.strony[0]), id: 's4', nazwa: 'Dodatek', sekcja: 'sek2', obiekty: [tekst('t4', 'Zob. s. {s:n2}')] });
    await przeladuj();
  });
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  await strona.selectOption('#form-pdf select[name=dpi]', '150');
  assert.equal(await strona.isChecked('#form-pdf [name=nawigacja]'), true, 'zwykły PDF – domyślnie do czytania na ekranie');
  await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  await strona.waitForSelector('#dlg-pdf', { state: 'hidden' });
  const nawigacja = await strona.evaluate(async () => {
    const P = window.PDFLib;
    const dok = await P.PDFDocument.load(await window.seriodruk.oknoPdf.ostatni.blob.arrayBuffer());
    const kat = dok.catalog;
    const wezly = [];
    let w = kat.lookup(P.PDFName.of('Outlines'))?.lookup(P.PDFName.of('First'));
    const tytul = (x) => x.lookup(P.PDFName.of('Title')).decodeText();
    while (w) {
      wezly.push(tytul(w));
      let d = w.lookup(P.PDFName.of('First'));
      while (d) { wezly.push(`  ${tytul(d)}`); d = d.lookup(P.PDFName.of('Next')); }
      w = w.lookup(P.PDFName.of('Next'));
    }
    const linki = dok.getPages().map((s) => (s.node.Annots()?.asArray() || []).map((ref) => {
      const a = dok.context.lookup(ref);
      const uri = a.lookup(P.PDFName.of('A'))?.lookup(P.PDFName.of('URI'));
      const cel = a.lookup(P.PDFName.of('Dest'));
      return uri ? uri.decodeText() : `strona ${dok.getPages().findIndex((x) => x.ref === cel.get(0)) + 1}`;
    }));
    return { wezly, linki, tryb: kat.lookup(P.PDFName.of('PageMode'))?.toString() };
  });
  assert.equal(nawigacja.tryb, '/UseOutlines');
  assert.deepEqual(nawigacja.wezly.slice(0, 3), [nawigacja.wezly[0], '  Pierwszy rozdział', '  Drugi rozdział'], nawigacja.wezly.join(' | '));
  assert.ok(nawigacja.wezly.includes('Dodatek'), 'zakładka drugiej sekcji');
  assert.ok(nawigacja.linki[0].includes('https://makietka.app'), `link elementu: ${JSON.stringify(nawigacja.linki)}`);
  assert.ok(nawigacja.linki[0].includes('strona 2') && nawigacja.linki[0].includes('strona 3'), `spis treści klikalny: ${JSON.stringify(nawigacja.linki[0])}`);
  assert.deepEqual(nawigacja.linki[3], ['strona 3'], 'odsyłacz „s. 3” prowadzi do strony 3');

  // Broszura: układ w oknie, plan arkuszy, plik z arkuszami i bez linków.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  await strona.selectOption('#form-pdf select[name=uklad]', 'broszura');
  assert.equal(await strona.isVisible('#pdf-plan-arkuszy'), true);
  assert.equal(await strona.locator('#pdf-plan-arkuszy .arkusz-planu').count(), 2, '4 strony → 1 arkusz, przód i tył');
  assert.match(await strona.textContent('#pdf-opis-arkuszy'), /1 arkusz do druku dwustronnego/);
  assert.equal(await strona.isDisabled('#form-pdf [name=nawigacja]'), true, 'arkusze – bez linków');
  await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  await strona.waitForSelector('#dlg-pdf', { state: 'hidden' });
  const arkusze = await strona.evaluate(async () => {
    const dok = await window.PDFLib.PDFDocument.load(await window.seriodruk.oknoPdf.ostatni.blob.arrayBuffer());
    const b = dok.getPage(0).getMediaBox();
    return { stron: dok.getPageCount(), w: b.width, h: b.height };
  });
  assert.equal(arkusze.stron, 2);
  assert.ok(arkusze.w > arkusze.h * 1.3, 'arkusz poziomy: dwie strony obok siebie');
  assert.deepEqual(bledy, []);
});

test('podgląd separacji: płyty strony z kolorem dodatkowym i lakierem UV, jedna płyta, pokrycie farbą', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Separacje');
  await strona.evaluate(async () => {
    const { stan, przeladuj } = window.seriodruk;
    const p = stan.projekt;
    p.kolory_dodatkowe = [{ id: 'kd', nazwa: 'PANTONE 186 C', cmyk: [0, 100, 81, 4] }];
    const { hexSpotu } = await import('./js/kolory-druku.js');
    p.strony[0].obiekty = [
      { type: 'rect', version: '5.3.0', left: 10, top: 10, width: 60, height: 40, fill: '#000000', id: 'k' },
      { type: 'rect', version: '5.3.0', left: 80, top: 10, width: 40, height: 40, fill: hexSpotu(p.kolory_dodatkowe[0], 1), id: 'spot' },
      { type: 'rect', version: '5.3.0', left: 10, top: 100, width: 60, height: 40, fill: '#1c2541', id: 'uv', uszlachetnienie: 'uv' },
    ];
    await przeladuj();
  });
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForSelector('.podglad-strona[data-id]');
  await strona.click('[data-akcja="podglad-separacje"]');
  await strona.waitForSelector('#dlg-separacje[open]');
  await strona.waitForFunction(() => /Największe pokrycie/.test(document.querySelector('#separacje-wynik').textContent), null, { timeout: 20000 });
  const plyty = await strona.$$eval('#separacje-plyty input', (l) => l.map((x) => x.value));
  assert.deepEqual(plyty, ['C', 'M', 'Y', 'K', 'PANTONE 186 C', 'Spot_UV']);
  const ile = await strona.evaluate(async () => {
    const { stanSeparacji } = await import('./js/app/separacje-okno.js');
    const s = stanSeparacji().rozbite;
    const suma = (id) => s.plyty.get(id).reduce((a, v) => a + (v > 0.5 ? 1 : 0), 0);
    return { k: suma('K'), spot: suma('PANTONE 186 C'), uv: suma('Spot_UV'), m: suma('M') };
  });
  assert.ok(ile.k > 1000 && ile.spot > 1000 && ile.uv > 1000, JSON.stringify(ile));
  assert.ok(ile.m < ile.spot, 'kolor dodatkowy nie idzie na magentę');
  // Jedna płyta w szarości i zaznaczanie pokrycia – obraz się przerysowuje.
  await strona.click('#separacje-jedna');
  await strona.click('#separacje-tac');
  assert.match(await strona.textContent('#separacje-wynik'), /pokrycie farbą na tej stronie: \d+%/);
  await strona.click('[data-akcja="separacje-zamknij"]');
  assert.deepEqual(bledy, []);
});
