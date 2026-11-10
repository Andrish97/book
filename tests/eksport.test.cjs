const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('czcionki są w repozytorium: aplikacja nie pyta serwerów Google, polskie znaki mają swój plik', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Czcionki');
  const stan = await strona.evaluate(async () => {
    const { CZCIONKI } = await import('./js/czcionki.js');
    const wynik = {};
    for (const c of CZCIONKI) {
      const zaladowane = await document.fonts.load(`700 16px "${c.nazwa}"`, 'Zażółć gęślą jaźń');
      wynik[c.nazwa] = zaladowane.length && zaladowane.every((f) => f.status === 'loaded');
    }
    return wynik;
  });
  const adresy = await strona.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
  for (const [nazwa, ok] of Object.entries(stan)) assert.ok(ok, `czcionka ${nazwa} się wczytała`);
  assert.equal(Object.keys(stan).length, 52, 'cały oficjalny zestaw');
  assert.deepEqual(adresy.filter((a) => /fonts\.(googleapis|gstatic)\.com/.test(a)), []);
  assert.ok(adresy.some((a) => /css\/czcionki\/inter-prosta-.*latin-ext\.woff2$/.test(a)), 'polskie znaki Inter z pliku w repozytorium');
  assert.deepEqual(bledy, []);
});

test('duże zdjęcie: na płótnie lżejsza kopia, w projekcie wymiary oryginału, eksport z oryginału', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Zdjęcia');
  const w = await strona.evaluate(async () => {
    const { stan, edytor, zapiszTeraz } = window.seriodruk;
    // 3000 × 2000 px: lewa połowa czerwona, prawa niebieska.
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
    const x = c.getContext('2d');
    x.fillStyle = '#ff0000'; x.fillRect(0, 0, 1500, 2000);
    x.fillStyle = '#0000ff'; x.fillRect(1500, 0, 1500, 2000);
    const obraz = await edytor.dodajObraz(c.toDataURL('image/png'), 'duze.png', stan.projekt.zasoby);
    const el = obraz.getElement();
    await edytor.duplikuj();
    await zapiszTeraz();
    const p = stan.projekt;
    const zapisane = p.strony[0].obiekty;
    const { renderujCel, zrodloObrazu } = await import('./js/zlozenie.js');
    const piksele = async (opcje, punkty) => {
      const url = await renderujCel(p, p.strony[0], { szerokoscPx: 148, spad: false, ...opcje });
      const img = new Image();
      await new Promise((ok) => { img.onload = ok; img.src = url; });
      const k = document.createElement('canvas'); k.width = img.width; k.height = img.height;
      const kx = k.getContext('2d'); kx.drawImage(img, 0, 0);
      // Kopia robocza jest zapisana stratnie, więc kolor może różnić się o włos – zaokrąglamy do pełnych barw.
      return punkty.map(([px, py]) => [...kx.getImageData(px, py, 1, 1).data].slice(0, 3).map((v) => (v > 245 ? 255 : (v < 10 ? 0 : v))).join(','));
    };
    // Strona A5 (148 × 210 mm), obraz 88,8 × 59,2 mm na środku: x 29,6–118,4, y 75,4–134,6.
    // Kopię zostawiamy tylko jedną (pierwszy obiekt), żeby sprawdzić piksele.
    p.strony[0].obiekty = [zapisane[0]];
    const punkty = [[40, 105], [110, 105], [110, 130], [15, 105]];
    const zKopii = await piksele({}, punkty);
    const zOryginalu = await piksele({ oryginaly: true }, punkty);
    // Przycięcie liczone w pikselach oryginału: zostaje tylko niebieska połowa.
    p.strony[0].obiekty = [{ ...zapisane[0], cropX: 1500, width: 1500 }];
    const przyciete = await piksele({}, [[35, 105], [70, 130], [90, 105]]);
    const id = zapisane[0].zasob;
    return {
      szerObiektu: obraz.width, wysObiektu: obraz.height, szerNaStronie: Math.round(obraz.width * obraz.scaleX * 10) / 10,
      szerElementu: el.naturalWidth, wysElementu: el.naturalHeight,
      zapisane: zapisane.map((o) => [o.type, o.width, o.height, o.src.startsWith('zasob:')]),
      robocze: zrodloObrazu(p.zasoby)(id).slice(0, 5), pelne: zrodloObrazu(p.zasoby, true)(id).slice(0, 15),
      zasob: Object.keys(p.zasoby[id]).sort(),
      zKopii, zOryginalu, przyciete,
    };
  });
  assert.deepEqual([w.szerObiektu, w.wysObiektu, w.szerNaStronie], [3000, 2000, 88.8]);
  assert.deepEqual([w.szerElementu, w.wysElementu], [1600, 1067]);
  assert.deepEqual(w.zapisane, [['image', 3000, 2000, true], ['image', 3000, 2000, true]], 'powielony obraz też ma wymiary oryginału');
  assert.equal(w.robocze, 'blob:');
  assert.equal(w.pelne, 'data:image/png;');
  assert.deepEqual(w.zasob, ['dataUrl', 'nazwa'], 'kopia robocza nie trafia do projektu');
  const oczekiwane = ['255,0,0', '0,0,255', '0,0,255', '255,255,255'];
  assert.deepEqual(w.zKopii, oczekiwane);
  assert.deepEqual(w.zOryginalu, oczekiwane);
  assert.deepEqual(w.przyciete, ['0,0,255', '0,0,255', '255,255,255']);
  assert.deepEqual(bledy, []);
});

test('eksport PDF: strony z powieleniami serii, spad i znaki cięcia, podział na części, PNG w 300 dpi', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Do druku');
  await strona.evaluate(async () => {
    const { stan, zapiszTeraz, przeladuj } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: null, tryb: 'stala', ile: 3, uklad: 'szeroki' });
    p.strony[0].obiekty = [{ type: 'rect', version: '5.3.0', left: -3, top: -3, width: 154, height: 30, fill: '#cc0000', id: 'o1' }];
    p.strony.push({ ...structuredClone(p.strony[0]), id: 's_druga', nazwa: 'Dzień', seria: 'se1', obiekty: [{ type: 'textbox', version: '5.3.0', left: 20, top: 40, width: 100, text: 'Dzień {egzemplarz}', fontSize: 8, fontFamily: 'Inter', fill: '#000000', id: 'o2' }] });
    await przeladuj();
  });

  // Okno: podsumowanie liczy powielenia; eksport do drukarni w 150 dpi.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  assert.equal(await strona.textContent('#pdf-podsumowanie'), 'Do eksportu: 4 strony (w tym 2 z powieleń serii).');
  await strona.selectOption('#form-pdf select[name=dpi]', '150');
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  assert.equal(plik.suggestedFilename(), 'Do druku.pdf');
  await strona.waitForSelector('#dlg-pdf', { state: 'hidden' });
  const pdf = await strona.evaluate(async () => {
    const dok = await window.PDFLib.PDFDocument.load(await window.seriodruk.oknoPdf.ostatni.blob.arrayBuffer());
    const mm = (pt) => Math.round((pt * 25.4 / 72) * 10) / 10;
    const pudelko = (b) => [b.x, b.y, b.width, b.height].map(mm);
    const s = dok.getPage(0);
    return { stron: dok.getPageCount(), tytul: dok.getTitle(), strona: pudelko(s.getMediaBox()), obciecie: pudelko(s.getTrimBox()), spad: pudelko(s.getBleedBox()) };
  });
  // A5 148 × 210, spad 3 mm, pas na znaki cięcia 3 + 5 + 1 = 9 mm z każdej strony.
  assert.deepEqual(pdf, { stron: 4, tytul: 'Do druku', strona: [0, 0, 166, 228], obciecie: [9, 9, 148, 210], spad: [6, 6, 154, 216] });

  // Do oglądania, strony 2–4, części po 2 strony: dwa pliki w archiwum ZIP, strona równo do formatu.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.selectOption('#form-pdf select[name=zakres]', 'strony');
  await strona.fill('#form-pdf input[name=od]', '2');
  await strona.selectOption('#form-pdf select[name=druk]', 'podglad');
  await strona.selectOption('#form-pdf select[name=dpi]', '150');
  await strona.selectOption('#form-pdf select[name=podzial]', 'czesci');
  await strona.fill('#form-pdf input[name=ile]', '2');
  assert.equal(await strona.textContent('#pdf-podsumowanie'), 'Do eksportu: 3 strony (w tym 2 z powieleń serii), 2 pliki PDF w jednym archiwum ZIP.');
  const [archiwum] = await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  assert.equal(archiwum.suggestedFilename(), 'Do druku - PDF.zip');
  const zip = await strona.evaluate(async () => {
    const z = await window.JSZip.loadAsync(window.seriodruk.oknoPdf.ostatni.blob);
    const wynik = [];
    for (const nazwa of Object.keys(z.files)) {
      const dok = await window.PDFLib.PDFDocument.load(await z.files[nazwa].async('arraybuffer'));
      const m = dok.getPage(0).getMediaBox();
      wynik.push([nazwa, dok.getPageCount(), Math.round(m.width * 25.4 / 72), Math.round(m.height * 25.4 / 72)]);
    }
    return wynik;
  });
  assert.deepEqual(zip, [['Do druku - część 1 (s. 2-3).pdf', 2, 148, 210], ['Do druku - część 2 (s. 4-4).pdf', 1, 148, 210]]);

  // PNG bieżącej strony: 300 dpi ze spadem (154 × 216 mm → 1819 × 2551 px).
  await strona.click('#przycisk-wiecej');
  const [png] = await Promise.all([strona.waitForEvent('download'), strona.click('[data-akcja="png"]')]);
  assert.equal(png.suggestedFilename(), 'Do druku-s1.png');
  const bajty = require('node:fs').readFileSync(await png.path());
  assert.deepEqual([bajty.readUInt32BE(16), bajty.readUInt32BE(20)], [1819, 2551]);
  assert.deepEqual(bledy, []);
});
