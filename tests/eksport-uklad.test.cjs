// Zapis z układem stron (#228): DOCX dla Worda/Publishera – strona dokumentu na stronę projektu, ramki tekstu,
// kształty i obrazy zakotwiczone do strony; z polami scalania («pole» → MERGEFIELD) w serii dla Worda; SVG stron
// w ZIP-ie. Gdy jest LibreOffice – plik otwiera się i ma tyle stron, ile projekt.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('DOCX z układem i SVG stron; seria dla Worda z polami w ramkach', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Układ');
  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony[0].tlo = '#fdf0d5';
    p.tabele.push({ id: 'tb1', nazwa: 'Osoby', kolumny: ['imie'], wiersze: [['Anna'], ['Bartek']] });
    p.serie.push({ id: 'se1', nazwa: 'Osoby', tabela: 'tb1', tryb: 'tabela', ile: 2, uklad: 'dlugi', dodatkowe: [], dopelnij: false });
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty.push(
      { type: 'textbox', id: 'o_t', left: 15, top: 20, width: 118, text: 'Dyplom dla {imie}\nZażółć gęślą jaźń', fontFamily: 'Inter', fontSize: 8, fill: '#1f2a44', strokeWidth: 0, textAlign: 'center', styles: [{ start: 0, end: 6, style: { fontWeight: 'bold', fill: '#c1121f' } }] },
      { type: 'rect', id: 'o_r', left: 15, top: 70, width: 50, height: 30, fill: '#2a9d8f', strokeWidth: 0, angle: 15 },
      { type: 'ellipse', id: 'o_e', left: 80, top: 70, rx: 25, ry: 12, width: 50, height: 24, fill: '#e9c46a', stroke: '#264653', strokeWidth: 1 },
      { type: 'rect', id: 'o_c', left: 20, top: 120, width: 30, height: 30, fill: '#264653', strokeWidth: 0, shadow: { color: 'rgba(0,0,0,0.5)', blur: 3, offsetX: 1, offsetY: 1 } },
    );
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const { zapiszDocxUklad, zapiszSvgStron } = await import('./js/eksport-uklad.js');
    const d = await zapiszDocxUklad(p, JSZip);
    const zip = await JSZip.loadAsync(d.blob);
    const doc = await zip.file('word/document.xml').async('string');
    const bladXml = new DOMParser().parseFromString(doc, 'application/xml').querySelector('parsererror')?.textContent || '';
    const svg = await JSZip.loadAsync((await zapiszSvgStron(p, JSZip)).blob);
    const plikiSvg = Object.keys(svg.files).filter((n) => !svg.files[n].dir).sort();
    const pierwszySvg = await svg.file(plikiSvg[0]).async('string');
    const { pakietSerii } = await import('./js/eksport-serii.js');
    const XLSX = await biblioteka('js/zewnetrzne/xlsx-0.18.5.full.min.js', 'XLSX', 'Excel');
    const word = await JSZip.loadAsync((await pakietSerii(p, 'word', JSZip, { XLSX })).blob);
    const szablon = await JSZip.loadAsync(await word.file('szablon.docx').async('blob'));
    const docSzablonu = await szablon.file('word/document.xml').async('string');
    return {
      ile: d.ile, stron: d.stron, bladXml,
      kotwic: (doc.match(/<wp:anchor /g) || []).length, txbx: (doc.match(/<wps:txbx>/g) || []).length,
      tekst: /Dyplom dla Anna/.test(doc) && /Zażółć gęślą jaźń/.test(doc), czerwony: /<w:b\/>.*?<w:color w:val="C1121F"\/>/.test(doc), wysrodkowany: /<w:jc w:val="center"\/>/.test(doc),
      obrot: /rot="900000"/.test(doc), tlo: /FDF0D5/.test(doc), media: Object.keys(zip.files).filter((n) => n.startsWith('word/media/') && !zip.files[n].dir).length,
      sekcji: (doc.match(/<w:sectPr>/g) || []).length,
      plikiSvg, svg: /width="148mm"/.test(pierwszySvg) && /height="210mm"/.test(pierwszySvg) && /Anna/.test(pierwszySvg),
      pole: /<w:fldSimple w:instr=" MERGEFIELD &quot;imie&quot; ">/.test(docSzablonu), stronSzablonu: (docSzablonu.match(/<w:sectPr>/g) || []).length,
      docx: Array.from(new Uint8Array(await d.blob.arrayBuffer())),
    };
  });
  assert.equal(w.bladXml, '');
  assert.deepEqual(w.ile, { teksty: 2, ksztalty: 4, obrazy: 2 }, 'na stronę: tekst, prostokąt, elipsa, cień jako obraz');
  assert.equal(w.stron, 2, 'seria – dwie strony');
  assert.equal(w.sekcji, 2);
  assert.equal(w.txbx, 2);
  assert.ok(w.tekst, 'tekst z danymi i polskimi literami');
  assert.ok(w.czerwony && w.wysrodkowany && w.obrot && w.tlo);
  assert.equal(w.media, 2);
  assert.deepEqual(w.plikiSvg, ['strona-1.svg', 'strona-2.svg']);
  assert.ok(w.svg, 'SVG w milimetrach z tekstem');
  assert.ok(w.pole, 'seria dla Worda: pole scalania w ramce tekstu');
  assert.equal(w.stronSzablonu, 1, 'szablon: strona raz');

  // LibreOffice (jeśli jest): plik otwiera się i ma dwie strony.
  let soffice = null;
  try { soffice = execFileSync('which', ['soffice']).toString().trim(); } catch { soffice = null; }
  if (soffice) {
    const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-'));
    t.after(() => fs.rmSync(kat, { recursive: true, force: true }));
    fs.writeFileSync(path.join(kat, 'u.docx'), Buffer.from(w.docx));
    execFileSync(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', kat, path.join(kat, 'u.docx')], { timeout: 120000, stdio: 'ignore' });
    const pdf = fs.readFileSync(path.join(kat, 'u.pdf'), 'latin1');
    assert.equal((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length, 2, 'LibreOffice: dwie strony');
  }
  assert.deepEqual(bledy, []);
});
