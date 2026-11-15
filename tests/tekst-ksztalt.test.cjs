// Kształt tekstu (#131B): tekst po łuku, okręgu, elipsie, po ścieżce z kształtu na stronie i wyginanie.
// Panel „Kształt tekstu”, uchwyt zgięcia, pisanie (prosto) i powrót kształtu, zapis, Biblioteka „Teksty”, PDF wektorowy.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Wybór w liście panelu właściwości po etykiecie (lista może być ukryta pod własną kontrolką).
const wybierz = (strona, etykieta, wartosc) => strona.evaluate(([e, v]) => {
  const l = [...document.querySelectorAll('#wlasciwosci label')].find((x) => x.firstChild?.textContent?.trim() === e && x.querySelector('select'));
  if (!l) throw new Error(`brak listy „${e}”`);
  const s = l.querySelector('select');
  s.value = v;
  s.dispatchEvent(new Event('change', { bubbles: true }));
}, [etykieta, wartosc]);
const liczba = (strona, etykieta, wartosc) => strona.evaluate(([e, v]) => {
  const l = [...document.querySelectorAll('#wlasciwosci label')].find((x) => x.textContent.trim().startsWith(e) && x.querySelector('input[type=number]'));
  if (!l) throw new Error(`brak pola „${e}”`);
  const i = l.querySelector('input');
  i.value = String(v);
  i.dispatchEvent(new Event('change', { bubbles: true }));
}, [etykieta, wartosc]);
const tekst = (strona) => strona.evaluate(() => {
  const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'textbox' && x.id === window.seriodruk.edytor.aktywny?.id) || window.seriodruk.edytor.aktywny;
  return { w: o.width, h: o.height, k: o.ksztalt_tekstu || null, uchwyt: Boolean(o.controls?.zgiecie), cx: o.getCenterPoint().x, cy: o.getCenterPoint().y };
});

test('kształt tekstu: łuk z panelu, zgięcie, pisanie prosto i powrót kształtu, „Prosto” przywraca ramkę; okrąg, wygięcia; zapis', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Łuk');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ text: 'NAPIS PO ŁUKU W GÓRĘ' }); e.aktywny.initDimensions(); e.zatwierdz(); e.canvas.discardActiveObject(); e.zaznacz(e.canvas.getObjects().find((o) => o.type === 'textbox').id); });
  await strona.waitForTimeout(300);
  const prosto = await tekst(strona);
  assert.ok(await strona.locator('#wlasciwosci legend:has-text("Kształt tekstu")').count(), 'część „Kształt tekstu” w panelu tekstu');

  await wybierz(strona, 'Kształt', 'luk');
  await strona.waitForTimeout(300);
  const luk = await tekst(strona);
  assert.equal(luk.k.rodzaj, 'luk');
  assert.ok(Math.abs(luk.k.szer - prosto.w) < 0.01, 'zapamiętana szerokość ramki prosto');
  assert.ok(luk.h > prosto.h * 1.5, `łuk jest wyższy niż prosty wiersz: ${luk.h} vs ${prosto.h}`);
  assert.ok(luk.uchwyt, 'uchwyt zgięcia pod tekstem');
  assert.ok(Math.abs(luk.cx - prosto.cx) < 0.5, 'środek tekstu zostaje w miejscu');

  await liczba(strona, 'Zgięcie', 90);
  await strona.waitForTimeout(200);
  const mocniej = await tekst(strona);
  assert.equal(mocniej.k.zgiecie, 90);
  assert.ok(mocniej.h > luk.h, 'mocniejsze zgięcie – wyższy łuk');

  // Pisanie: tekst prosto, po wyjściu kształt wraca.
  const wPisaniu = await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; o.enterEditing(); return { w: o.width, edycja: o.isEditing }; });
  assert.ok(wPisaniu.edycja && Math.abs(wPisaniu.w - prosto.w) < 0.01, 'w trakcie pisania ramka prosto');
  await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; o.exitEditing(); window.seriodruk.edytor.zatwierdz(); });
  const poPisaniu = await tekst(strona);
  assert.ok(Math.abs(poPisaniu.h - mocniej.h) < 0.01, 'po pisaniu łuk wraca');

  // Okrąg i wygięcia.
  await wybierz(strona, 'Kształt', 'okrag');
  await strona.waitForTimeout(200);
  const okrag = await tekst(strona);
  assert.ok(Math.abs(okrag.w - okrag.h) < okrag.w * 0.25, `okrąg mniej więcej kwadratowy: ${okrag.w} × ${okrag.h}`);
  await wybierz(strona, 'Kształt', 'fala');
  await strona.waitForTimeout(200);
  assert.equal((await tekst(strona)).k.rodzaj, 'fala');

  // Zapis: pole kształtu jest w projekcie i wraca po odświeżeniu.
  await wybierz(strona, 'Kształt', 'luk');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  const wProjekcie = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.type === 'textbox')?.ksztalt_tekstu);
  assert.equal(wProjekcie?.rodzaj, 'luk');
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk?.edytor?.canvas?.getObjects().some((o) => o.type === 'textbox' && o.ksztalt_tekstu?.rodzaj === 'luk'), null, { timeout: 20000 });
  const poWczytaniu = await strona.evaluate(() => { const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'textbox'); return { h: o.height, uchwyt: Boolean(o.controls?.zgiecie) }; });
  assert.ok(poWczytaniu.h > prosto.h * 1.5 && poWczytaniu.uchwyt, 'po wczytaniu łuk i uchwyt');

  // „Prosto” przywraca szerokość ramki tekstu.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.type === 'textbox').id); });
  await strona.waitForTimeout(300);
  await wybierz(strona, 'Kształt', 'prosto');
  await strona.waitForTimeout(200);
  const znowuProsto = await tekst(strona);
  assert.equal(znowuProsto.k, null);
  assert.ok(Math.abs(znowuProsto.w - prosto.w) < 0.01 && !znowuProsto.uchwyt, 'ramka prosto i bez uchwytu');
  assert.deepEqual(bledy, []);
});

test('kształt tekstu: po ścieżce z kształtu na stronie; Biblioteka „Teksty”; PDF wektorowy z tekstem, bez obrazów', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Ścieżka');
  // Kształt (elipsa) i tekst, który pobiegnie po jej linii.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const el = e.dodajElipse();
    el.set({ left: 30, top: 60, rx: 40, ry: 25 }); el.setCoords();
    const tb = e.dodajTekst('TEKST PO LINII ELIPSY • TEKST PO LINII ELIPSY • TEKST PO LINII');
    tb.set({ left: 30, top: 60 }); tb.initDimensions(); tb.setCoords();
    e.zatwierdz();
    e.canvas.discardActiveObject();
    e.zaznacz(tb.id);
  });
  await strona.waitForTimeout(300);
  await wybierz(strona, 'Kształt', 'sciezka');
  await strona.waitForTimeout(300);
  const elipsaId = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'ellipse').id);
  await wybierz(strona, 'Linia z kształtu na stronie', elipsaId);
  await strona.waitForTimeout(300);
  const sc = await tekst(strona);
  assert.equal(sc.k.rodzaj, 'sciezka');
  assert.match(sc.k.d, /^M /, 'kopia linii kształtu w tekście');
  assert.ok(sc.w > 60 && sc.h > 30, `tekst obejmuje elipsę: ${sc.w} × ${sc.h}`);

  // Biblioteka: kategoria „Teksty” wstawia gotowy napis z kształtem.
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  await strona.click('#kategorie-biblioteki [data-kategoria="teksty"]');
  await strona.click('#dlg-biblioteka [data-element="pieczec"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.ksztalt_tekstu?.rodzaj === 'okrag'));
  await strona.evaluate(() => { document.querySelector('#dlg-biblioteka')?.close?.(); window.seriodruk.edytor.zatwierdz(); });
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());

  // PDF wektorowy: litery po kształcie zostają tekstem (polecenia Tj), żaden element nie idzie jako obraz.
  const pdf = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { eksportujPdf } = await import('./js/eksport.js');
    const wynik = await eksportujPdf(stan.projekt, { znaki: false, spad: true, tryb: 'wektor', dpi: 150 });
    const bajty = new Uint8Array(await wynik.blob.arrayBuffer());
    const { PDFDocument, PDFName, PDFDict, decodePDFRawStream, PDFRawStream } = window.PDFLib;
    const dok = await PDFDocument.load(bajty);
    const kartka = dok.getPage(0);
    const zasoby = kartka.node.Resources();
    const x = zasoby.lookupMaybe(PDFName.of('XObject'), PDFDict);
    const c = kartka.node.Contents();
    let tresc = '';
    for (const ref of (c.asArray ? c.asArray() : [c])) { const s = dok.context.lookup(ref); tresc += new TextDecoder('latin1').decode(s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : s.getUnencodedContents()); }
    return { obrazy: x ? x.keys().length : 0, tj: (tresc.match(/\bTj\b|\bTJ\b/g) || []).length, uwagi: wynik.uwagi };
  });
  assert.equal(pdf.obrazy, 0, `bez obrazów: ${JSON.stringify(pdf.uwagi)}`);
  assert.ok(pdf.tj >= 40, `litery jako tekst w PDF: ${pdf.tj}`);
  assert.deepEqual(bledy, []);
});
