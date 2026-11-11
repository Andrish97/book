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
