// Książka (#131B) w aplikacji: spis treści z Biblioteki, przypis z panelu, odsyłacz, żywa pagina we wzorcu,
// skorowidz – na płótnie, w złożonej stronie (podgląd, miniatury) i w PDF.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WATEK = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

test('książka w aplikacji: spis treści z Biblioteki, przypis z panelu, odsyłacz, żywa pagina, skorowidz – na stronie, w podglądzie i w PDF', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Książka');
  // Strona 1: spis treści (z Biblioteki). Strony 2 i 3: rozdziały w stylu „Tytuł” i tekst.
  await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { nowaStrona } = await import('./js/projekt.js');
    const tytul = stan.projekt.style.find((s) => s.nazwa === 'Tytuł');
    const tekst = stan.projekt.style.find((s) => s.nazwa === 'Tekst');
    const sek = stan.projekt.sekcje[0].id;
    const t = (id, txt, st, extra = {}) => ({ type: 'textbox', id, left: 15, top: 20, width: 110, text: txt, styl: st.id, fontFamily: st.fontFamily, fontSize: st.fontSize, fontWeight: st.fontWeight, styles: [], ...extra });
    stan.projekt.strony.push(
      { ...nowaStrona('Rozdział 1', sek), obiekty: [t('r1', 'Kot domowy', tytul), t('b1', 'Kot to zwierzę.', tekst, { top: 50 })] },
      { ...nowaStrona('Rozdział 2', sek), obiekty: [t('r2', 'Pies', tytul), t('b2', 'Pies też.', tekst, { top: 50 })] },
    );
    const z = await import('./js/app/zapis.js');
    await z.zaladujCel();
  });
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  await strona.click('#kategorie-biblioteki [data-kategoria="ksiazka"]');
  await strona.click('#dlg-biblioteka [data-element="spis"]');
  await strona.evaluate(() => document.querySelector('#dlg-biblioteka')?.close?.());
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].obiekty.some((o) => o.ksiazka && /Kot domowy\t2/.test(o.text) && /Pies\t3/.test(o.text)), null, { timeout: 15000 });
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const s = e.canvas.getObjects().find((o) => o.ksiazka); e.zaznacz(s.id); });
  await strona.waitForSelector('#wlasciwosci :text("Kropki do numeru strony")');

  // Strona 2: przypis z panelu, odsyłacz do „Pies”, hasło skorowidza.
  await strona.evaluate(async () => { const { przejdzDoStrony } = await import('./js/app/lista-stron.js'); await przejdzDoStrony(1); });
  await strona.evaluate(() => window.seriodruk.edytor.zaznacz('b1'));
  // Część „Przypisy, odsyłacze, skorowidz” jest zwinięta, dopóki tekst nic z niej nie używa.
  await strona.click('#wlasciwosci button.zwijak:has-text("Przypisy, odsyłacze")');
  await strona.click('#wlasciwosci button:has-text("Wstaw przypis")');
  const pole = strona.locator('#wlasciwosci label:has-text("Przypis 1") textarea');
  await pole.waitFor();
  await pole.fill('Felis catus.');
  await pole.dispatchEvent('change');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz('b1'); e.wstawOdsylacz('r2', ' Zob. s. '); e.dodajDoSkorowidza('kot'); e.zatwierdz(); });
  await strona.evaluate(async () => { const z = await import('./js/app/zapis.js'); z.zapiszBiezacyCel(); await z.odswiezKsiazke(); });
  const b1 = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[1].obiekty.find((o) => o.id === 'b1'));
  assert.match(b1.text, /\{przypis:pp[^}]+\}/);
  assert.equal(Object.values(b1.przypisy)[0], 'Felis catus.');
  assert.deepEqual(b1.hasla, ['kot']);
  // Obszar przypisów jest na płótnie (warstwa nad treścią, nie do zaznaczenia).
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.przypisy_strony && o.text === '1\tFelis catus.'), null, { timeout: 15000 });

  // Żywa pagina we wzorcu-stopce i skorowidz na stronie 1.
  await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { nowyWzorzec } = await import('./js/projekt.js');
    const w = nowyWzorzec('Stopka', stan.projekt.sekcje[0].wydruk);
    w.obiekty = [{ type: 'textbox', id: 'pagina', left: 15, top: 190, width: 110, text: '{rozdzial} – {nr}', fontFamily: 'Inter', fontSize: 3, styles: [] }];
    stan.projekt.wzorce.push(w);
    stan.projekt.sekcje[0].wzorce = [w.id];
    stan.projekt.strony[0].obiekty.push({ type: 'textbox', id: 'skor', left: 15, top: 120, width: 110, text: '', fontFamily: 'Inter', fontSize: 3.7, styles: [], ksiazka: { rodzaj: 'skorowidz' } });
    const { przeliczKsiazke } = await import('./js/ksiazka.js');
    przeliczKsiazke(stan.projekt);
  });
  const zlozone = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { zlozCel } = await import('./js/zlozenie.js');
    const teksty = async (i) => (await zlozCel(stan.projekt, stan.projekt.strony[i])).obiekty.filter((o) => typeof o.text === 'string').map((o) => o.text);
    return { s1: await teksty(0), s2: await teksty(1), s3: await teksty(2) };
  });
  assert.ok(zlozone.s1.includes('kot\t2'), `skorowidz: ${zlozone.s1.join(' | ')}`);
  assert.ok(zlozone.s2.some((x) => /^Kot to zwierzę\.1 Zob\. s\. 3$/.test(x)), `odsyłacz i numer przypisu: ${zlozone.s2.join(' | ')}`);
  assert.ok(zlozone.s2.includes('1\tFelis catus.'), 'treść przypisu na dole strony');
  assert.ok(zlozone.s2.includes('Kot domowy – 2'), `żywa pagina: ${zlozone.s2.join(' | ')}`);
  assert.ok(zlozone.s3.includes('Pies – 3'));
  assert.ok(!zlozone.s3.some((x) => /Felis/.test(x)), 'przypis tylko na swojej stronie');

  // PDF: spis treści, odsyłacz, przypis i pagina jako tekst.
  const tekstPdf = await strona.evaluate(async ([pdfjs, watek]) => {
    const { stan } = window.seriodruk;
    const { eksportujPdf } = await import('./js/eksport.js');
    const wynik = await eksportujPdf(stan.projekt, { znaki: false, spad: false });
    const bajty = new Uint8Array(await wynik.blob.arrayBuffer());
    if (!window.pdfjsLib) await new Promise((ok, blad) => { const s = document.createElement('script'); s.src = pdfjs; s.onload = ok; s.onerror = blad; document.head.append(s); });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = watek;
    const dok = await window.pdfjsLib.getDocument({ data: bajty }).promise;
    const strony = [];
    for (let i = 1; i <= dok.numPages; i += 1) strony.push((await (await dok.getPage(i)).getTextContent()).items.map((x) => x.str).join(''));
    return strony;
  }, [PDFJS, PDFJS_WATEK]);
  assert.match(tekstPdf[0], /Kot domowy.*2/);
  assert.match(tekstPdf[1], /Felis catus\./);
  assert.match(tekstPdf[1], /Zob\. s\. 3/);
  assert.match(tekstPdf[2], /Pies – 3/);
  assert.deepEqual(bledy, []);
});
