const test = require('node:test');
const fs = require('node:fs');
const { otworz, nowyProjekt } = require('./pomoc.cjs');
test('e', async (t) => {
  const { strona } = await otworz(t);
  await nowyProjekt(strona, 'X');
  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const c = document.createElement('canvas'); c.width = 120; c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#e76f51'; x.fillRect(0, 0, 120, 80); x.fillStyle = '#264653'; x.beginPath(); x.arc(60, 40, 25, 0, 7); x.fill();
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    const { przyjmijPlik } = await import('./js/obrazy-projektu.js');
    const { id } = await przyjmijPlik(p, blob, 'z.png');
    p.strony[0].tlo = '#fdf0d5';
    p.strony[0].obiekty.push(
      { type: 'textbox', id: 'o_t', left: 15, top: 20, width: 118, text: 'Tytuł książki\nDrugi akapit, wyśrodkowany w ramce. Zażółć gęślą jaźń.', fontFamily: 'DejaVu Sans', fontSize: 6, fill: '#1f2a44', strokeWidth: 0, textAlign: 'center', styles: [{ start: 0, end: 5, style: { fontWeight: 'bold', fill: '#c1121f' } }] },
      { type: 'rect', id: 'o_r', left: 15, top: 70, width: 50, height: 30, fill: '#2a9d8f', strokeWidth: 0, angle: 15 },
      { type: 'ellipse', id: 'o_e', left: 80, top: 70, rx: 25, ry: 12, width: 50, height: 24, fill: '#e9c46a', stroke: '#264653', strokeWidth: 1, strokeUniform: true },
      { type: 'image', id: 'o_i', src: 'zasob:' + id, zasob: id, left: 20, top: 120, width: 120, height: 80, scaleX: 0.5, scaleY: 0.5 },
      { type: 'textbox', id: 'o_t2', left: 90, top: 140, width: 40, text: 'Obrócony tekst', fontFamily: 'Inter', fontSize: 4, fill: '#000000', strokeWidth: 0, angle: -20 },
      { type: 'textbox', id: 'o_t3', left: 15, top: 175, width: 118, text: 'Inter: zwykły, pogrubiony i kursywa.', fontFamily: 'Inter', fontSize: 4.5, fill: '#333333', strokeWidth: 0, styles: [{ start: 7, end: 13, style: { fontStyle: 'italic' } }, { start: 15, end: 25, style: { fontWeight: 'bold' } }] },
    );
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const { zapiszIdml } = await import('./js/idml.js');
    const { zapiszSla } = await import('./js/scribus.js');
    const { pngCelu } = await import('./js/eksport.js');
    const idml = await zapiszIdml(p, JSZip);
    const sla = await zapiszSla(p);
    const png = await pngCelu(p, p.strony[0], 100);
    return { idml: Array.from(new Uint8Array(await idml.blob.arrayBuffer())), sla: sla.sla, png };
  });
  fs.writeFileSync('/tmp/claude-0/-home-user-book/c7489e9c-f7c8-52f9-8669-f2a79a7c09c7/scratchpad/scr/test.idml', Buffer.from(w.idml));
  fs.writeFileSync('/tmp/claude-0/-home-user-book/c7489e9c-f7c8-52f9-8669-f2a79a7c09c7/scratchpad/scr/test.sla', w.sla);
  fs.writeFileSync('/tmp/claude-0/-home-user-book/c7489e9c-f7c8-52f9-8669-f2a79a7c09c7/scratchpad/scr/makietka.png', Buffer.from(w.png.split(',')[1], 'base64'));
});
