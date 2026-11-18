// Import tekstu z innych programów (#216): Word (.docx), ODT, Markdown i TXT → jedna ramka z dokładaniem stron;
// nagłówki i pogrubienia/kursywy zostają, rozdziały (nagłówek 1) zaczynają się od nowej strony.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const AKAPIT = 'Litwo, ojczyzno moja, ty jesteś jak zdrowie; ile cię trzeba cenić, ten tylko się dowie, kto cię stracił. ';

test('import tekstu: DOCX i ODT czytane z nagłówkami i formatowaniem, Markdown wstawiony do projektu z dokładaniem stron', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Powieść');
  const w = await strona.evaluate(async (akapit) => {
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const { czytajDocx, czytajOdt, czytajMarkdown, tekstDoRamki } = await import('./js/import-tekstu.js');
    // DOCX: styl Heading1, akapit z pogrubieniem i kursywą, tabela.
    const docx = new JSZip();
    docx.file('word/styles.xml', '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>');
    docx.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Rozdział pierwszy</w:t></w:r></w:p>
      <w:p><w:r><w:t xml:space="preserve">Zwykły </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>gruby</w:t></w:r><w:r><w:t xml:space="preserve"> i </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>pochyły</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    </w:body></w:document>`);
    const d = await czytajDocx(await JSZip.loadAsync(await docx.generateAsync({ type: 'arraybuffer' })));
    // ODT: nagłówek i pogrubiony fragment ze stylu automatycznego.
    const odt = new JSZip();
    odt.file('content.xml', `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
      <office:automatic-styles><style:style style:name="T1"><style:text-properties fo:font-weight="bold"/></style:style></office:automatic-styles>
      <office:body><office:text><text:h text:outline-level="2">Część</text:h><text:p>Ala <text:span text:style-name="T1">ma</text:span> kota</text:p></office:text></office:body></office:document-content>`);
    const o = await czytajOdt(await JSZip.loadAsync(await odt.generateAsync({ type: 'arraybuffer' })));
    const md = czytajMarkdown(`# Rozdział 1\n\n${akapit.repeat(40)}\n\n# Rozdział 2\n\nTekst **ważny** i *ładny*.`);
    const r = tekstDoRamki(md, { rozmiar: 4 });
    return { d, o, r: { akapitow: r.akapitow, rozdzialow: r.rozdzialow, podzial: r.styles.filter((s) => s.style.nowa_strona).length } };
  }, AKAPIT);
  assert.deepEqual(w.d.akapity.map((a) => [a.tekst, a.poziom]), [['Rozdział pierwszy', 1], ['Zwykły gruby i pochyły', 0], ['A\tB', 0]]);
  assert.deepEqual(w.d.akapity[1].fragmenty, [{ od: 7, do: 12, b: true }, { od: 15, do: 22, i: true }]);
  assert.deepEqual(w.o.akapity.map((a) => [a.tekst, a.poziom]), [['Część', 2], ['Ala ma kota', 0]]);
  assert.deepEqual(w.o.akapity[1].fragmenty, [{ od: 4, do: 6, b: true }]);
  assert.deepEqual(w.r, { akapitow: 4, rozdzialow: 2, podzial: 1 });

  // Markdown przez menu ⋯ → „Wstaw tekst z pliku…”: ramka, strony dochodzą same, rozdział 2 od nowej strony.
  await strona.click('[data-akcja="menu-projektu"]').catch(() => {});
  await strona.evaluate(() => import('./js/app/import-tekstu-okno.js'));
  await strona.setInputFiles('#plik-tekst', { name: 'powiesc.md', mimeType: 'text/markdown', buffer: Buffer.from(`# Rozdział 1\n\n${AKAPIT.repeat(60)}\n\n# Rozdział 2\n\nKoniec **książki**.`) });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length >= 3, null, { timeout: 30000 });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.some((s) => s.obiekty.some((o) => (o.text || '').startsWith('Rozdział 2'))), null, { timeout: 30000 });
  assert.match(await strona.textContent('#powiadomienie'), /Wstawiono 4 akapity, 2 rozdziały od nowej strony|Dodano/);

  // Zapis z powrotem: DOCX (czytany ponownie tym samym importem) i EPUB (spis treści, rozdział na plik).
  const z = await strona.evaluate(async () => {
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const E = await import('./js/eksport-tekstu.js');
    const { czytajDocx } = await import('./js/import-tekstu.js');
    const p = window.seriodruk.stan.projekt;
    const akapity = E.akapityProjektu(p);
    const docx = await czytajDocx(await JSZip.loadAsync(await (await E.zapiszDocx(p, JSZip, akapity)).arrayBuffer()));
    const epub = await JSZip.loadAsync(await (await E.zapiszEpub(p, JSZip, akapity)).arrayBuffer());
    return {
      akapitow: akapity.length,
      naglowki: docx.akapity.filter((a) => a.poziom === 1).map((a) => a.tekst),
      ostatni: docx.akapity.at(-1),
      pliki: Object.keys(epub.files).filter((f) => f.endsWith('.xhtml')).sort(),
      mimetype: await epub.file('mimetype').async('string'),
      spis: await epub.file('OEBPS/spis.xhtml').async('string'),
    };
  });
  assert.equal(z.akapitow, 4);
  assert.deepEqual(z.naglowki, ['Rozdział 1', 'Rozdział 2']);
  assert.deepEqual(z.ostatni, { tekst: 'Koniec książki.', poziom: 0, fragmenty: [{ od: 7, do: 14, b: true }] });
  assert.deepEqual(z.pliki, ['OEBPS/r1.xhtml', 'OEBPS/r2.xhtml', 'OEBPS/spis.xhtml']);
  assert.equal(z.mimetype, 'application/epub+zip');
  assert.match(z.spis, /Rozdział 2/);
  assert.deepEqual(bledy, []);
});
