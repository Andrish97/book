// Kształt jako ramka obrazu (decyzja #123): obraz w elipsie i wielokącie – przycięty do kształtu,
// wypełnia go; zapis bez adresu obrazu; podgląd strony, PDF (przycięcie wektorowe i osadzony obraz),
// kadr liczbami i ramką, „Wyjmij obraz”, obraz z danych.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// PNG: lewa połowa czerwona, prawa niebieska.
async function dwukolorowy(strona) {
  const b64 = await strona.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 40; c.height = 20;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 20, 20);
    ctx.fillStyle = '#0000ff'; ctx.fillRect(20, 0, 20, 20);
    return c.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(b64, 'base64');
}

test('kształt jako ramka obrazu: wstawienie, rysowanie przycięte do kształtu, zapis, podgląd, PDF, kadr, wyjęcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Ramki');
  await strona.setInputFiles('#pliki-zasoby', { name: 'flaga.png', mimeType: 'image/png', buffer: await dwukolorowy(strona) });
  await strona.waitForFunction(() => Object.keys(window.seriodruk.stan.projekt.zasoby).length === 1);
  await strona.click('[data-akcja="dodaj-elipse"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'ellipse');

  // Panel elipsy: „Wstaw obraz do kształtu”; obraz z projektu.
  assert.match(await strona.textContent('#wlasciwosci'), /Obraz w kształcie/);
  assert.ok(await strona.locator('#wlasciwosci button:has-text("Wstaw obraz do kształtu")').isVisible());
  const wynik = await strona.evaluate(async () => {
    const { edytor, stan } = window.seriodruk;
    const e = edytor.aktywny;
    e.set({ left: 20, top: 30, rx: 40, ry: 20, fill: '#00ff00' });
    e.setCoords();
    const id = Object.keys(stan.projekt.zasoby)[0];
    await edytor.wstawObrazDoKsztaltu(e, id);
    const zapis = e.toObject();
    return { id, zasob: zapis.zasob, kadr: zapis.obraz_kadr, src: '_src_obrazu' in zapis, el: Boolean(e._obrazEl) };
  });
  assert.equal(wynik.zasob, wynik.id);
  assert.deepEqual(wynik.kadr, { x: 0, y: 0, skala: 1 });
  assert.equal(wynik.src, false, 'adres obrazu nie trafia do zapisu');
  assert.ok(wynik.el);
  assert.match(await strona.textContent('#wlasciwosci'), /Wyjmij obraz/);

  // Podgląd strony (składanie jak w miniaturach i PDF): w środku elipsy obraz, w rogu ramki elipsy tło strony.
  const piksele = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { zapiszTeraz } = await import('./js/app/zapis.js');
    await zapiszTeraz();
    const { naPlotnieCelu } = await import('./js/zlozenie.js');
    return naPlotnieCelu(stan.projekt, stan.projekt.strony[0], { szerokoscPx: 148 * 4, spad: false }, (plotno) => {
      const el = plotno.toCanvasElement();
      const ctx = el.getContext('2d');
      const px = (x, y) => [...ctx.getImageData(Math.round(x * 4), Math.round(y * 4), 1, 1).data];
      return { lewo: px(35, 50), prawo: px(85, 50), rog: px(22, 32) };
    });
  });
  assert.ok(piksele.lewo[0] > 200 && piksele.lewo[2] < 60, `lewa część elipsy czerwona: ${piksele.lewo}`);
  assert.ok(piksele.prawo[2] > 200 && piksele.prawo[0] < 60, `prawa część elipsy niebieska: ${piksele.prawo}`);
  assert.ok(piksele.rog[0] > 200 && piksele.rog[1] > 200 && piksele.rog[2] > 200, `poza elipsą tło strony: ${piksele.rog}`);

  // Kadr liczbami: powiększenie i przesunięcie – przesunięcie przycięte tak, żeby obraz zakrywał kształt.
  const kadr = await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    const e = edytor.canvas.getObjects().find((o) => o.type === 'ellipse');
    edytor.ustawKadrWKsztalcie(e, { skala: 2, x: 5 });
    return e.obraz_kadr;
  });
  assert.equal(kadr.skala, 2);
  // Elipsa 80×40 mm, obraz 2:1 → przy 200% ma 160×80 mm, więc środek przesunie się najwyżej o 40 mm = 0,5 szerokości.
  assert.ok(Math.abs(kadr.x - 0.5) < 0.001, `przesunięcie przycięte: ${kadr.x}`);

  // Kadr ramką (podwójne kliknięcie): ramka z całym obrazem; Esc wraca do kadru sprzed zmian.
  const ramka = await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    const e = edytor.canvas.getObjects().find((o) => o.type === 'ellipse');
    edytor.canvas.setActiveObject(e);
    const zaczal = edytor.kadrujWKsztalcie(e);
    const r = edytor.aktywny;
    const wynik = { zaczal, kadr: Boolean(r.kadr), szer: r.getScaledWidth() };
    r.set({ left: r.left - 10 });
    r.fire('modified');
    wynik.poRuchu = e.obraz_kadr.x;
    edytor.zakonczKadrowanie(false);
    wynik.poAnulowaniu = e.obraz_kadr.x;
    wynik.aktywny = edytor.aktywny === e;
    return wynik;
  });
  assert.ok(ramka.zaczal && ramka.kadr);
  assert.ok(Math.abs(ramka.szer - 160) < 0.5, `ramka ma cały obraz: ${ramka.szer}`);
  assert.ok(ramka.poRuchu < 0.5, 'ruch ramki przesuwa obraz w kształcie');
  assert.ok(Math.abs(ramka.poAnulowaniu - 0.5) < 0.001, 'Esc przywraca kadr');
  assert.ok(ramka.aktywny);

  // PDF wektorowy: obraz osadzony, przycięty ścieżką elipsy.
  const pdf = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { zapiszTeraz } = await import('./js/app/zapis.js');
    await zapiszTeraz();
    const { eksportujPdf } = await import('./js/eksport.js');
    const w = await eksportujPdf(stan.projekt, { znaki: false, spad: false });
    const { PDFDocument, PDFName, PDFDict, decodePDFRawStream, PDFRawStream } = window.PDFLib;
    const dok = await PDFDocument.load(new Uint8Array(await w.blob.arrayBuffer()));
    const kartka = dok.getPage(0);
    const xo = kartka.node.Resources().lookupMaybe(PDFName.of('XObject'), PDFDict);
    let tresc = '';
    const s = kartka.node.Contents();
    for (const ref of (s.asArray ? s.asArray() : [s])) {
      const st = dok.context.lookup(ref);
      tresc += new TextDecoder('latin1').decode(st instanceof PDFRawStream ? decodePDFRawStream(st).decode() : st.getUnencodedContents());
    }
    return { obrazy: xo ? xo.keys().length : 0, przyciecie: /W n/.test(tresc), krzywe: (tresc.match(/ c\n/g) || []).length, uwagi: [...(w.uwagi?.values?.() || [])].flat().map(String) };
  });
  assert.equal(pdf.obrazy, 1, 'obraz osadzony w PDF');
  assert.ok(pdf.przyciecie, 'obraz przycięty ścieżką');
  assert.ok(pdf.krzywe >= 4, 'przycięcie krzywymi elipsy');

  // „Wyjmij obraz”: zwykły obraz w miejscu kształtu, kształt bez obrazu.
  await strona.evaluate(() => { const { edytor } = window.seriodruk; edytor.canvas.setActiveObject(edytor.canvas.getObjects().find((o) => o.type === 'ellipse')); edytor.canvas.fire('selection:created'); });
  await strona.click('#wlasciwosci button:has-text("Wyjmij obraz")');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'image');
  const po = await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    const e = edytor.canvas.getObjects().find((o) => o.type === 'ellipse');
    const img = edytor.aktywny;
    return { ksztalt: e.zasob || null, obraz: img.zasob, szer: img.getScaledWidth(), wys: img.getScaledHeight() };
  });
  assert.equal(po.ksztalt, null);
  assert.ok(po.obraz);
  assert.ok(Math.abs(po.szer - 80) < 0.5 && Math.abs(po.wys - 40) < 0.5, `wyjęty obraz w rozmiarze kształtu: ${po.szer}×${po.wys}`);
  assert.deepEqual(bledy, []);
});

test('kształt jako ramka obrazu z danych: na każdej powielonej stronie obraz z kolumny', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Ramki z danych');
  const czerwony = await strona.evaluate(() => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 4, 4); return c.toDataURL('image/png').split(',')[1]; });
  const niebieski = await strona.evaluate(() => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d'); x.fillStyle = '#0000ff'; x.fillRect(0, 0, 4, 4); return c.toDataURL('image/png').split(',')[1]; });
  await strona.setInputFiles('#pliki-zasoby', [
    { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(czerwony, 'base64') },
    { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from(niebieski, 'base64') },
  ]);
  await strona.waitForFunction(() => Object.keys(window.seriodruk.stan.projekt.zasoby).length === 2);
  const kolory = await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const p = stan.projekt;
    const { zapiszTeraz } = await import('./js/app/zapis.js');
    await zapiszTeraz();
    p.tabele.push({ id: 't1', nazwa: 'Zdjęcia', kolumny: ['plik'], wiersze: [['a.png'], ['b.png']] });
    p.serie = [{ id: 'se1', nazwa: 'Seria', tabela: 't1', tryb: 'wiersze' }];
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty = [{ type: 'rect', id: 'r1', left: 10, top: 10, width: 50, height: 50, fill: '#ffffff', pole: { kolumna: 'plik' } }];
    const { rozwin } = await import('./js/serie.js');
    const { naPlotnieCelu } = await import('./js/zlozenie.js');
    const ciag = rozwin(p);
    const wynik = [];
    for (const egz of ciag.egzemplarze) {
      wynik.push(await naPlotnieCelu(p, egz, { szerokoscPx: 148 * 2, spad: false, ciag }, (plotno) => [...plotno.toCanvasElement().getContext('2d').getImageData(70, 70, 1, 1).data]));
    }
    void edytor;
    return wynik;
  });
  assert.equal(kolory.length, 2);
  assert.ok(kolory[0][0] > 200 && kolory[0][2] < 60, `pierwsza strona – czerwony: ${kolory[0]}`);
  assert.ok(kolory[1][2] > 200 && kolory[1][0] < 60, `druga strona – niebieski: ${kolory[1]}`);
  assert.deepEqual(bledy, []);
});
