// Kod QR i kod kreskowy EAN-13 / ISBN (#128): generator na znanych wektorach, element na stronie,
// panel, zapis, seria z danych, PDF wektorowy i ostrzeżenia.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('QR: „HELLO WORLD” 1-Q z maską 6 (przykład z normy / poradnika Thonky), wersje i poziomy rosną z treścią', async () => {
  const { qrMacierz, trybQR, trescQR } = await modul('js/kody.js');
  const q = qrMacierz('HELLO WORLD', 'Q');
  assert.deepEqual([q.wersja, q.korekcja, q.maska, q.tryb], [1, 'Q', 6, 'alfanumeryczny']);
  assert.deepEqual(q.moduly.map((r) => r.map((x) => (x ? 1 : 0)).join('')), [
    '111111100001001111111', '100000101100101000001', '101110100101101011101', '101110101111101011101', '101110101101001011101',
    '100000100100101000001', '111111101010101111111', '000000001101100000000', '010111101100111011010', '101111010000111101110',
    '001010110001001100000', '101101000101100011000', '110111111110111011111', '000000001000100101000', '111111100110011001111',
    '100000101010010010111', '101110101101001000111', '101110101011100010100', '101110100100001000011', '100000101110011100110',
    '111111100101000000010',
  ]);
  assert.equal(trybQR('0123'), 'numeryczny');
  assert.equal(trybQR('Zażółć'), 'bajtowy');
  // Dłuższa treść – wyższa wersja (z informacją o wersji od 7 w górę), korekcja podnosi się, gdy się mieści.
  assert.ok(qrMacierz('x'.repeat(300), 'M').wersja >= 10);
  assert.equal(qrMacierz('HELLO WORLD', 'L').korekcja, 'Q', 'przy tej samej wersji – wyższa korekcja');
  assert.equal(qrMacierz('HELLO WORLD', 'L', { podnosKorekcje: false }).korekcja, 'L');
  assert.throws(() => qrMacierz('A'.repeat(5000), 'H'), /za długi/);
  // Treść z pól panelu.
  assert.equal(trescQR('adres', { adres: 'makietka.app' }), 'https://makietka.app');
  assert.equal(trescQR('adres', { adres: '{strona}' }), '{strona}', 'pole z danych zostaje');
  assert.equal(trescQR('email', { email: 'a@b.pl', temat: 'Druk A5' }), 'mailto:a@b.pl?subject=Druk%20A5');
  assert.equal(trescQR('telefon', { telefon: '+48 600 100 200' }), 'tel:+48600100200');
  assert.equal(trescQR('wifi', { siec: 'Dom;1', haslo: 'ta:jne', szyfrowanie: 'WPA' }), 'WIFI:T:WPA;S:Dom\\;1;P:ta\\:jne;;');
  assert.equal(trescQR('wifi', { siec: 'Gość', szyfrowanie: 'nopass', ukryta: true }), 'WIFI:T:nopass;S:Gość;H:true;;');
});

test('EAN-13 / ISBN: kreski jak w bibliotece wzorcowej (python-barcode), cyfra kontrolna, ISBN-10 → ISBN-13, błędy', async () => {
  const { ean13, cyfryEAN, cyfraKontrolnaEAN } = await modul('js/kody.js');
  const bity = (t) => ean13(t).moduly.map((x) => (x ? 1 : 0)).join('');
  assert.equal(bity('5901234123457'), '10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101');
  assert.equal(bity('978830100000'), '10101110110001001000100101111010100111001100101010111001011100101110010111001011100101011100101');
  assert.equal(cyfraKontrolnaEAN('590123412345'), 7);
  assert.equal(cyfryEAN('978-83-01-00000-4').cyfry, '9788301000004');
  assert.equal(cyfryEAN('83-01-00000-1').cyfry, '9788301000004', 'ISBN-10 zamienia się na ISBN-13');
  assert.match(cyfryEAN('9788301000001').blad, /Zła cyfra kontrolna – powinna być 4/);
  assert.match(cyfryEAN('12345').blad, /13 cyfr/);
  assert.match(cyfryEAN('97883abc').blad, /tylko cyfry/);
});

test('kod na stronie: wstawianie z palety poleceń, panel (rodzaj, treść, rozmiar), skala uchwytem, zapis, seria z danych, PDF i ostrzeżenia', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Zaproszenia');
  // Wstawianie z palety poleceń (Ctrl+K) – bez osobnego przycisku na pasku (#134).
  assert.equal(await strona.locator('[data-akcja="dodaj-kod"]').count(), 0);
  await strona.keyboard.press('Control+k');
  await strona.waitForSelector('#paleta-polecen[open]');
  await strona.fill('#paleta-polecen .paleta-pole', 'kod qr');
  await strona.keyboard.press('Enter');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.kod);
  let kod = await strona.evaluate(() => { const g = window.seriodruk.edytor.aktywny; return { ...g.kod, dzieci: g.getObjects().map((o) => o.type), w: g.width }; });
  assert.equal(kod.rodzaj, 'qr');
  assert.equal(kod.tresc, 'https://makietka.app');
  assert.deepEqual(kod.dzieci, ['rect', 'path'], 'tło i moduły jako jedna ścieżka');
  assert.equal(kod.w, 25);
  assert.match(await strona.textContent('#naglowek-wlasciwosci'), /Kod QR/);

  // Panel: e-mail – treść liczona z pól.
  await strona.evaluate(() => {
    const sel = [...document.querySelectorAll('.wlasciwosci label')].find((l) => /Co zawiera/.test(l.textContent)).querySelector('select');
    sel.value = 'email'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await strona.waitForFunction(() => [...document.querySelectorAll('.wlasciwosci label')].some((l) => /Adres e-mail/.test(l.textContent)));
  await strona.evaluate(() => {
    const inp = [...document.querySelectorAll('.wlasciwosci label')].find((l) => /Adres e-mail/.test(l.textContent)).querySelector('input');
    inp.value = 'kontakt@makietka.app'; inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny.kod.tresc === 'mailto:kontakt@makietka.app');

  // Skala uchwytem: zostaje kwadratem, rozmiar przechodzi do opisu.
  kod = await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    const g = edytor.aktywny;
    g.set({ scaleX: 1.6, scaleY: 1.2 });
    edytor.canvas.fire('object:modified', { target: g });
    return { s: g.kod.szerokosc, h: g.kod.wysokosc, sx: g.scaleX, w: g.width };
  });
  assert.deepEqual(kod, { s: 40, h: 40, sx: 1, w: 40 });

  // Kod kreskowy: zmiana rodzaju, ISBN, cyfry pod kodem.
  await strona.evaluate(() => {
    const sel = [...document.querySelectorAll('.wlasciwosci label')].find((l) => /^Rodzaj/.test(l.textContent)).querySelector('select');
    sel.value = 'ean'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny.kod.rodzaj === 'ean');
  await strona.evaluate(() => {
    const inp = [...document.querySelectorAll('.wlasciwosci label')].find((l) => /Numer EAN/.test(l.textContent)).querySelector('input');
    inp.value = '978-83-01-00000'; inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny.kod.tresc === '978-83-01-00000');
  const ean = await strona.evaluate(() => window.seriodruk.edytor.aktywny.getObjects().map((o) => o.type + (o.text ? `:${o.text}` : '')));
  assert.deepEqual(ean, ['rect', 'path', 'text:9', 'text:788301', 'text:000004']);

  // Zły numer – uwaga w panelu i w kontroli przed drukiem; rysunek przekreślony.
  await strona.evaluate(() => window.seriodruk.edytor.zmienKod({ tresc: '9788301000001' }));
  await strona.waitForFunction(() => /Zła cyfra kontrolna/.test(document.querySelector('.uwagi-kodu')?.textContent));
  await strona.evaluate(() => window.seriodruk.edytor.zmienKod({ tresc: '9788301000004', szerokosc: 20 }));
  await strona.waitForFunction(() => /80%/.test(document.querySelector('.uwagi-kodu')?.textContent));

  // Seria: QR z pola {adres} – inny kod na każdej stronie; zapis i odczyt projektu.
  await strona.evaluate(async () => {
    const { edytor, stan, zapiszTeraz, przeladuj } = window.seriodruk;
    edytor.dodajKod('qr', { typ: 'adres', dane: { adres: '{adres}' }, tresc: '{adres}', szerokosc: 30 });
    await zapiszTeraz();
    const p = stan.projekt;
    p.tabele.push({ id: 't1', nazwa: 'Goście', kolumny: ['adres'], wiersze: [['https://a.pl/1'], ['https://a.pl/2']] });
    p.serie.push({ id: 'se1', nazwa: 'Goście', tabela: 't1', tryb: 'tabela', uklad: 'dlugi', ile: 1, dodatkowe: [], dopelnij: false });
    p.strony[0].seria = 'se1';
    await przeladuj();
  });
  const sciezki = await strona.evaluate(async () => {
    const { zlozCel } = await import('./js/zlozenie.js');
    const { rozwin } = await import('./js/serie.js');
    const p = window.seriodruk.stan.projekt;
    const ciag = rozwin(p);
    const wynik = [];
    for (const egz of ciag.egzemplarze) {
      const { obiekty } = await zlozCel(p, egz, { ciag });
      const g = obiekty.find((o) => o.kod?.rodzaj === 'qr');
      wynik.push({ tresc: g.kod.tresc, d: g.getObjects().find((o) => o.type === 'path').path.length });
    }
    return wynik;
  });
  assert.deepEqual(sciezki.map((s) => s.tresc), ['https://a.pl/1', 'https://a.pl/2']);
  assert.ok(sciezki[0].d > 50, 'kod narysowany z podstawionej treści');

  // Kod zapisany bez rysunku (np. dodany przez łącznik AI) rysuje się po wczytaniu strony.
  const zAi = await strona.evaluate(async () => {
    const { stan, przeladuj, edytor } = window.seriodruk;
    stan.projekt.strony[0].obiekty.push({ type: 'group', id: 'o_ai', left: 5, top: 5, width: 20, height: 20, kod: { rodzaj: 'qr', typ: 'tekst', dane: { tekst: 'AI' }, tresc: 'AI', szerokosc: 20 }, objects: [] });
    await przeladuj();
    const g = edytor.canvas.getObjects().find((o) => o.id === 'o_ai');
    return g ? g.getObjects().map((o) => o.type) : null;
  });
  assert.deepEqual(zAi, ['rect', 'path']);
  const uwagiKontroli = await strona.evaluate(async () => (await import('./js/kontrola.js')).sprawdzProjekt(window.seriodruk.stan.projekt).filter((u) => u.rodzaj === 'kod').map((u) => u.opis).join(' | '));
  assert.match(uwagiKontroli, /80%/, 'kontrola przed drukiem: za wąski EAN');

  // PDF: kod jako wektor (prostokąty ścieżki), bez osadzonego obrazu.
  await strona.evaluate(() => document.querySelector('[data-akcja="pdf"]').click());
  await strona.waitForSelector('#dlg-pdf[open]');
  await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  const pdf = await strona.evaluate(async () => {
    const bajty = new Uint8Array(await window.seriodruk.oknoPdf.ostatni.blob.arrayBuffer());
    const dok = await window.PDFLib.PDFDocument.load(bajty);
    const t = new TextDecoder('latin1').decode(bajty);
    return { strony: dok.getPageCount(), obrazy: (t.match(/\/Subtype\s*\/Image/g) || []).length };
  });
  assert.equal(pdf.strony, 2);
  assert.equal(pdf.obrazy, 0, 'kody w PDF są wektorowe');
  assert.deepEqual(bledy, []);
});
