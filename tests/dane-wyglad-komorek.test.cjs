const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Plik Excela z tekstem w kawałkach o różnym wyglądzie (jedno słowo pogrubione, jedno czerwone kursywą).
const plikZKawalkami = (strona) => strona.evaluate(async () => {
  const { biblioteka } = await import('./js/biblioteki.js');
  const XLSX = await biblioteka('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX', 'arkuszy');
  const JSZip = await biblioteka('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip', 'ZIP');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['dzien', 'opis'], ['1', 'Święto Trzech Króli'], ['2', 'zwykły dzień']]), 'Dni');
  const zip = await JSZip.loadAsync(XLSX.write(wb, { bookType: 'xlsx', type: 'array', bookSST: true }));
  const czcionka = (srodek) => `<font>${srodek}<sz val="11"/><name val="Calibri"/></font>`;
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">${czcionka('<color theme="1"/>')}${czcionka('<color rgb="FF0000FF"/>')}</fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`);
  // Komórka B2 ma niebieski kolor: kawałek bez własnego opisu czcionki („Trzech ”) dostaje wygląd komórki.
  let arkusz = await zip.file('xl/worksheets/sheet1.xml').async('string');
  arkusz = arkusz.replace('<c r="B2"', '<c r="B2" s="1"');
  zip.file('xl/worksheets/sheet1.xml', arkusz);
  let teksty = await zip.file('xl/sharedStrings.xml').async('string');
  teksty = teksty.replace(/<si><t[^>]*>Święto Trzech Króli<\/t><\/si>/, '<si><r><rPr><b/><sz val="11"/></rPr><t xml:space="preserve">Święto </t></r><r><t xml:space="preserve">Trzech </t></r><r><rPr><i/><color rgb="FFFF0000"/><sz val="11"/></rPr><t>Króli</t></r></si>');
  zip.file('xl/sharedStrings.xml', teksty);
  return zip.generateAsync({ type: 'base64' });
});

const tabela = (strona) => strona.evaluate(() => { const x = window.seriodruk.stan.projekt.tabele[0]; return JSON.parse(JSON.stringify({ wiersze: x.wiersze, wyglad: x.wyglad, wyl: x.wyglad_wyl, listy: x.listy })); });
const importuj = async (strona, nazwa, typ, bufor) => {
  await strona.setInputFiles('#plik-dane', { name: nazwa, mimeType: typ, buffer: bufor });
};
// Tekst pierwszej strony serii po podstawieniu pól: [text, styles] dla każdego egzemplarza.
const naStronach = (strona) => strona.evaluate(async () => {
  const p = window.seriodruk.stan.projekt;
  if (!p.serie.length) {
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: p.tabele[0].id, tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty = [{ type: 'textbox', version: '5.3.0', left: 10, top: 10, width: 120, text: '{dzien}: {opis}', styles: [], fontSize: 5, fontFamily: 'Inter', id: 't1' }];
    await window.seriodruk.przeladuj();
  }
  const { rozwin, wartosciPol } = await import('./js/serie.js');
  const { podstawWObiektach } = await import('./js/pola.js');
  const { renderujCel } = await import('./js/zlozenie.js');
  const ciag = rozwin(p);
  await renderujCel(p, ciag.egzemplarze[0], { szerokoscPx: 148, spad: false, ciag });
  return ciag.egzemplarze.map((e) => { const [o] = podstawWObiektach(p.strony[0].obiekty, wartosciPol(p, e, ciag)); return [o.text, o.styles]; });
});

test('wygląd części komórki z Excela: kawałki tekstu o różnym wyglądzie przechodzą na stronę jako formatowanie fragmentów; okno danych je pokazuje; edycja komórki je zdejmuje', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Części komórki');
  const plik = await plikZKawalkami(strona);
  await strona.evaluate(() => window.seriodruk.dane.otworz());
  await strona.waitForSelector('#dlg-dane[open]');
  await importuj(strona, 'Dni.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', Buffer.from(plik, 'base64'));
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele.length === 1);
  // „Święto ” pogrubione, „Trzech ” w kolorze komórki (niebieski), „Króli” kursywą na czerwono.
  assert.deepEqual((await tabela(strona)).wyglad, [[null, { czesci: [{ od: 0, do: 7, pogrubienie: true }, { od: 7, do: 14, kolor: '#0000ff' }, { od: 14, do: 19, kursywa: true, kolor: '#ff0000' }] }], null]);
  // Okno danych: części jako fragmenty komórki.
  const czesciWOknie = await strona.locator('#dane-siatka td[data-w="0"][data-k="1"] span').evaluateAll((l) => l.map((s) => [s.textContent, s.style.fontWeight, s.style.fontStyle, s.style.color]));
  assert.deepEqual(czesciWOknie, [['Święto ', '700', '', ''], ['Trzech ', '', '', 'rgb(0, 0, 255)'], ['Króli', '', 'italic', 'rgb(255, 0, 0)']]);
  await strona.click('#dane-zamknij');
  // Na stronie: „1: ” i potem trzy fragmenty z własnym wyglądem.
  const strony = await naStronach(strona);
  assert.deepEqual(strony[0], ['1: Święto Trzech Króli', [
    { start: 3, end: 10, style: { fontWeight: 'bold' } },
    { start: 10, end: 17, style: { fill: '#0000ff' } },
    { start: 17, end: 22, style: { fontStyle: 'italic', fill: '#ff0000' } },
  ]]);
  assert.deepEqual(strony[1], ['2: zwykły dzień', []]);
  // Zapis i normalizacja zachowują części; część wychodząca poza tekst jest odrzucana.
  const norm = await strona.evaluate(async () => {
    const { normalizujTabele } = await import('./js/projekt.js');
    const x = JSON.parse(JSON.stringify(window.seriodruk.stan.projekt.tabele[0]));
    const zly = normalizujTabele({ ...x, wyglad: [[null, { czesci: [{ od: 0, do: 99, pogrubienie: true }, { od: 2, do: 1, kursywa: true }, { od: 0, do: 3 }] }]] });
    return [normalizujTabele(x).wyglad[0][1].czesci.length, zly.wyglad];
  });
  assert.deepEqual(norm, [3, undefined]);
  // Zmiana tekstu komórki w oknie danych zdejmuje części (przestały pasować), wygląd całej komórki zostaje.
  await strona.evaluate(() => window.seriodruk.dane.otworz());
  await strona.waitForSelector('#dlg-dane[open]');
  await strona.click('#dane-siatka td[data-w="0"][data-k="1"]');
  await strona.keyboard.press('End');
  await strona.keyboard.type('!');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].wiersze[0][1].endsWith('!'));
  assert.equal((await tabela(strona)).wyglad, undefined, 'komórka nie miała wyglądu całej komórki, tylko części');
  assert.deepEqual(bledy, []);
});

test('import pliku bez wyglądu (CSV) w miejsce tabeli zachowuje wygląd komórek, których wartość się nie zmieniła', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Import bez wyglądu');
  await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    p.tabele.push({ id: 't1', nazwa: 'Dni', kolumny: ['dzien', 'opis'], wiersze: [['1', 'Nowy Rok'], ['2', 'zwykły'], ['3', 'Trzech Króli']],
      wyglad: [[null, { pogrubienie: true }], [{ kursywa: true }, { kolor: '#ff0000' }], [null, { czesci: [{ od: 0, do: 6, pogrubienie: true }] }]] });
  });
  await strona.evaluate(() => window.seriodruk.dane.otworz());
  await strona.waitForSelector('#dlg-dane[open]');
  // CSV: kolumny w innej kolejności, wiersz 2 ma zmieniony opis, wiersz 3 bez zmian, doszedł wiersz 4.
  await importuj(strona, 'Dni.csv', 'text/csv', Buffer.from('opis;dzien\nNowy Rok;1\ninny opis;2\nTrzech Króli;3\nNowy;4\n'));
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].wiersze.length === 4);
  const t1 = await tabela(strona);
  assert.deepEqual(t1.wiersze, [['Nowy Rok', '1'], ['inny opis', '2'], ['Trzech Króli', '3'], ['Nowy', '4']]);
  // Wygląd idzie za kolumną; zmieniona wartość traci wygląd, niezmieniona go zachowuje (także części).
  assert.deepEqual(t1.wyglad, [[{ pogrubienie: true }, null], [null, { kursywa: true }], [{ czesci: [{ od: 0, do: 6, pogrubienie: true }] }, null], null]);
  assert.match(await strona.textContent('#powiadomienie'), /Plik nie niesie wyglądu komórek: wygląd został w 3 z 4 komórek – tam, gdzie wartość się nie zmieniła\./);
  // Plik, w którym nic się nie powtarza, zdejmuje wygląd całkiem.
  await importuj(strona, 'Dni.csv', 'text/csv', Buffer.from('dzien;opis\n10;a\n11;b\n'));
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].wiersze.length === 2);
  assert.equal((await tabela(strona)).wyglad, undefined);
  assert.deepEqual(bledy, []);
});

test('lista dozwolonych wartości kolumny: okno z wartościami w wierszach, zapis, anulowanie i „Usuń listę”', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Lista kolumny');
  await strona.evaluate(() => {
    window.seriodruk.stan.projekt.tabele.push({ id: 't1', nazwa: 'Dni', kolumny: ['dzien', 'typ'], wiersze: [['1', 'święto'], ['2', 'zwykły']] });
  });
  await strona.evaluate(() => window.seriodruk.dane.otworz());
  await strona.waitForSelector('#dlg-dane[open]');
  await strona.click('#dane-siatka .lista-kolumny[data-k="1"]');
  await strona.waitForSelector('#dlg-lista-kolumny[open]');
  assert.equal(await strona.isVisible('#lista-kolumny-usun'), false, 'bez listy nie ma czego usuwać');
  await strona.fill('#lista-kolumny-wartosci', 'święto\nwolne; zwykły\n\nświęto');
  await strona.click('#dlg-lista-kolumny button[value="tak"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].listy);
  assert.deepEqual((await tabela(strona)).listy, { typ: ['święto', 'wolne', 'zwykły'] });
  assert.equal(await strona.getAttribute('#dane-siatka .lista-kolumny[data-k="1"]', 'aria-pressed'), 'true');
  // Anulowanie niczego nie zmienia; okno pokazuje wartości po jednej w wierszu.
  await strona.click('#dane-siatka .lista-kolumny[data-k="1"]');
  assert.equal(await strona.inputValue('#lista-kolumny-wartosci'), 'święto\nwolne\nzwykły');
  await strona.click('#dlg-lista-kolumny button[value="nie"]');
  await strona.waitForSelector('#dlg-lista-kolumny', { state: 'hidden' });
  assert.deepEqual((await tabela(strona)).listy, { typ: ['święto', 'wolne', 'zwykły'] });
  // „Usuń listę” usuwa ją jednym kliknięciem.
  await strona.click('#dane-siatka .lista-kolumny[data-k="1"]');
  await strona.click('#lista-kolumny-usun');
  await strona.waitForFunction(() => !window.seriodruk.stan.projekt.tabele[0].listy);
  assert.equal((await tabela(strona)).listy, undefined);
  assert.equal(await strona.getAttribute('#dane-siatka .lista-kolumny[data-k="1"]', 'aria-pressed'), 'false');
  assert.deepEqual(bledy, []);
});

test('wygląd komórki ustawiany w oknie danych: pogrubienie, kursywa, kolor i „Bez wyglądu” dla jednej albo kilku komórek; przechodzi na strony', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wygląd w oknie');
  await strona.evaluate(() => {
    window.seriodruk.stan.projekt.tabele.push({ id: 't1', nazwa: 'Dni', kolumny: ['dzien', 'opis'], wiersze: [['1', 'Nowy Rok'], ['2', 'zwykły'], ['3', 'Trzech Króli']],
      wyglad: [null, null, [null, { czesci: [{ od: 0, do: 6, kursywa: true, kolor: '#00ff00' }] }]] });
  });
  await strona.evaluate(() => window.seriodruk.dane.otworz());
  await strona.waitForSelector('#dlg-dane[open]');
  // Bez zaznaczonej komórki – podpowiedź.
  await strona.click('#dane-pogrubienie');
  assert.match(await strona.textContent('#powiadomienie'), /Kliknij komórkę/);
  // Jedna komórka: pogrubienie.
  await strona.click('#dane-siatka td[data-w="0"][data-k="1"]');
  await strona.click('#dane-pogrubienie');
  assert.deepEqual((await tabela(strona)).wyglad, [[null, { pogrubienie: true }], null, [null, { czesci: [{ od: 0, do: 6, kursywa: true, kolor: '#00ff00' }] }]]);
  assert.equal(await strona.locator('#dane-siatka td[data-w="0"][data-k="1"]').evaluate((td) => td.style.fontWeight), '700');
  assert.ok(await strona.isVisible('#dane-wyglad-pole'));
  // Kilka komórek (Shift+kliknięcie): kursywa i kolor; kursywa ustawiona na komórce znika z jej części.
  await strona.click('#dane-siatka td[data-w="1"][data-k="0"]');
  await strona.click('#dane-siatka td[data-w="2"][data-k="1"]', { modifiers: ['Shift'] });
  assert.equal(await strona.locator('#dane-siatka td.zaznaczona').count(), 4);
  await strona.click('#dane-kursywa');
  await strona.locator('#dane-kolor').evaluate((el) => { el.value = '#1d3557'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.deepEqual((await tabela(strona)).wyglad, [
    [null, { pogrubienie: true }],
    [{ kursywa: true, kolor: '#1d3557' }, { kursywa: true, kolor: '#1d3557' }],
    [{ kursywa: true, kolor: '#1d3557' }, { kursywa: true, kolor: '#1d3557' }],
  ]);
  // Drugie kliknięcie kursywy na komórkach, które wszystkie ją mają – zdejmuje ją.
  await strona.click('#dane-kursywa');
  assert.deepEqual((await tabela(strona)).wyglad[1], [{ kolor: '#1d3557' }, { kolor: '#1d3557' }]);
  await strona.click('#dane-zamknij');
  const strony = await naStronach(strona);
  assert.deepEqual(strony[0], ['1: Nowy Rok', [{ start: 3, end: 11, style: { fontWeight: 'bold' } }]]);
  assert.deepEqual(strony[1], ['2: zwykły', [{ start: 0, end: 1, style: { fill: '#1d3557' } }, { start: 3, end: 9, style: { fill: '#1d3557' } }]]);
  // „Bez wyglądu” na wszystkich komórkach zdejmuje wygląd z tabeli.
  await strona.evaluate(() => window.seriodruk.dane.otworz());
  await strona.waitForSelector('#dlg-dane[open]');
  await strona.click('#dane-siatka td[data-w="0"][data-k="0"]');
  await strona.click('#dane-siatka td[data-w="2"][data-k="1"]', { modifiers: ['Shift'] });
  await strona.click('#dane-bez-wygladu');
  const t1 = await tabela(strona);
  assert.equal(t1.wyglad, undefined);
  assert.equal(await strona.isVisible('#dane-wyglad-pole'), false);
  assert.deepEqual(bledy, []);
});
