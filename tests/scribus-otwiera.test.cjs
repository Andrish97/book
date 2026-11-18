// Zapis dla Scribusa i InDesigna sprawdzony w prawdziwym Scribusie (#231) – gdy Scribus jest zainstalowany
// (scribus + xvfb-run). Plik .sla i .idml z Makietki otwiera się bez pytań (czcionki znalezione po nazwach odmian
// i nazwach PostScript), zapisuje do PDF z jedną stroną we właściwym formacie, a w PDF są wszystkie użyte czcionki –
// czyli żaden fragment tekstu nie wypadł za ramkę (wcześniej ramki były niższe niż wiersz tekstu).
// Bez Scribusa test się pomija.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const jest = (p) => { try { return execFileSync('which', [p]).toString().trim(); } catch { return null; } };
const scribus = jest('scribus');
const xvfb = jest('xvfb-run');

test('Scribus otwiera pliki .sla i .idml z Makietki – pełny tekst, czcionki, format', { skip: !(scribus && xvfb && jest('pdffonts')) && 'brak Scribusa', timeout: 400000 }, async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Scribus');
  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony[0].tlo = '#fdf0d5';
    p.strony[0].obiekty.push(
      { type: 'textbox', id: 'o_t', left: 15, top: 20, width: 118, text: 'Tytuł książki\nZażółć gęślą jaźń.', fontFamily: 'DejaVu Sans', fontSize: 6, fill: '#1f2a44', strokeWidth: 0, textAlign: 'center', styles: [{ start: 0, end: 5, style: { fontWeight: 'bold', fill: '#c1121f' } }] },
      { type: 'rect', id: 'o_r', left: 15, top: 70, width: 50, height: 30, fill: '#2a9d8f', strokeWidth: 0, angle: 15 },
      { type: 'textbox', id: 'o_t2', left: 90, top: 140, width: 40, text: 'Obrócony tekst', fontFamily: 'Inter', fontSize: 4, fill: '#000000', strokeWidth: 0, angle: -20 },
      { type: 'textbox', id: 'o_t3', left: 15, top: 175, width: 118, text: 'Inter: zwykły, pogrubiony i kursywa.', fontFamily: 'Inter', fontSize: 4.5, fill: '#333333', strokeWidth: 0, styles: [{ start: 7, end: 13, style: { fontStyle: 'italic' } }, { start: 15, end: 25, style: { fontWeight: 'bold' } }] },
    );
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const idml = await (await import('./js/idml.js')).zapiszIdml(p, JSZip);
    const sla = await (await import('./js/scribus.js')).zapiszSla(p);
    return { idml: Array.from(new Uint8Array(await idml.blob.arrayBuffer())), sla: sla.sla };
  });
  const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'scribus-'));
  t.after(() => fs.rmSync(kat, { recursive: true, force: true }));
  fs.writeFileSync(path.join(kat, 't.sla'), w.sla);
  fs.writeFileSync(path.join(kat, 't.idml'), Buffer.from(w.idml));
  fs.writeFileSync(path.join(kat, 'pdf.py'), 'import sys, scribus\nscribus.openDoc(sys.argv[1])\np = scribus.PDFfile(); p.file = sys.argv[2]; p.save()\nprint("STRON", scribus.pageCount())\n');
  for (const f of ['t.sla', 't.idml']) {
    const wyj = path.join(kat, `${f}.pdf`);
    // Okno z pytaniem (np. o brakującą czcionkę) zatrzymałoby Scribusa – limit czasu to wykryje.
    const log = execFileSync(xvfb, ['-a', scribus, '-g', '-ns', '-py', path.join(kat, 'pdf.py'), path.join(kat, f), wyj], { timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    assert.match(log, /STRON 1/, `${f}: jedna strona`);
    const info = execFileSync('pdfinfo', [wyj]).toString();
    assert.match(info, /Page size:\s+436\.5\d* x 612\.2\d* pts/, `${f}: A5 ze spadem 3 mm`);
    const czcionki = execFileSync('pdffonts', [wyj]).toString();
    for (const c of ['DejaVuSans-Bold', 'DejaVuSans', 'Inter-Regular', 'Inter-Italic', 'Inter-Bold']) assert.match(czcionki, new RegExp(`\\+${c}\\s`), `${f}: czcionka ${c} użyta (tekst nie ucięty, czcionka znaleziona)`);
  }
  assert.deepEqual(bledy, []);
});
