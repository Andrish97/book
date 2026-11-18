// Odczyt z programów do składu (#225): IDML i SLA zapisane przez Makietkę (#220, #221) wracają jako projekt –
// strony, ramka tekstu z formatowaniem, kształty, obraz osadzony; SLA z połączonymi ramkami (wątek) i polem
// korespondencji seryjnej <<imie>> → {imie}; wczytanie z listy projektów.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('import IDML i SLA: zapis i odczyt, wątki, pola scalania, wczytanie z listy projektów', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Źródło');
  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    // Obraz w projekcie (czerwony kwadrat 40 × 40 px).
    const c = document.createElement('canvas'); c.width = 40; c.height = 40;
    const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 40, 40);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    const { przyjmijPlik } = await import('./js/obrazy-projektu.js');
    const { id } = await przyjmijPlik(p, blob, 'czerwony.png');
    p.strony[0].obiekty.push(
      { type: 'textbox', id: 'o_t', left: 15, top: 20, width: 100, text: 'Tytuł książki\nDrugi akapit', fontFamily: 'Inter', fontSize: 8, fill: '#1f2a44', strokeWidth: 0, textAlign: 'center', styles: [{ start: 0, end: 5, style: { fontWeight: 'bold', fill: '#c1121f' } }] },
      { type: 'rect', id: 'o_r', left: 15, top: 60, width: 50, height: 30, fill: '#2a9d8f', strokeWidth: 0, angle: 0 },
      { type: 'ellipse', id: 'o_e', left: 80, top: 60, rx: 20, ry: 10, width: 40, height: 20, fill: '#e9c46a', strokeWidth: 0 },
      { type: 'image', id: 'o_i', src: `zasob:${id}`, zasob: id, left: 20, top: 120, width: 40, height: 40, scaleX: 1, scaleY: 1 },
    );
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const { zapiszIdml } = await import('./js/idml.js');
    const { zapiszSla } = await import('./js/scribus.js');
    const { importujSklad } = await import('./js/import-skladu.js');
    const idml = new File([(await zapiszIdml(p, JSZip)).blob], 'Książka.idml');
    const sla = new File([(await zapiszSla(p)).sla], 'Książka.sla');
    const opis = async (plik) => {
      const { projekt, raport } = await importujSklad(plik, JSZip, przyjmijPlik);
      const o = projekt.strony[0].obiekty;
      const tekst = o.find((e) => e.type === 'textbox');
      return {
        raport: { teksty: raport.teksty, ksztalty: raport.ksztalty, obrazy: raport.obrazy, stron: raport.stron, brak: raport.brakujace.length },
        format: [projekt.sekcje[0].wydruk.szerokosc_mm, projekt.sekcje[0].wydruk.wysokosc_mm, projekt.sekcje[0].wydruk.spad_mm, Math.round(projekt.sekcje[0].wydruk.marginesy.gora)],
        tekst: { text: tekst.text, rodzina: tekst.fontFamily, rozmiar: Math.round(tekst.fontSize), kolor: tekst.fill, align: tekst.textAlign, left: Math.round(tekst.left * 10) / 10, top: Math.round(tekst.top * 10) / 10, style: tekst.styles.map((s) => [s.start, s.end, s.style.fontWeight, s.style.fill]) },
        typy: o.map((e) => e.type).sort(),
        prostokat: (() => { const r = o.find((e) => e.type === 'rect' && e.fill === '#2a9d8f'); return r && [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })(),
        tlo: o.some((e) => e.type === 'rect' && e.fill === '#ffffff' && e.width > 140) || null,
        obraz: (() => { const i = o.find((e) => e.type === 'image'); return i && [Math.round(i.left), Math.round(i.top), Math.round(i.width * i.scaleX), Math.round(i.height * i.scaleY), Boolean(projekt.zasoby[i.zasob])]; })(),
      };
    };
    // Ręczny plik Scribusa: dwie połączone ramki, pole korespondencji seryjnej, kolor CMYK.
    const recznySla = `<?xml version="1.0" encoding="UTF-8"?><SCRIBUSUTF8NEW Version="1.5.8"><DOCUMENT ANZPAGES="2" PAGEWIDTH="595.28" PAGEHEIGHT="841.89" BleedTop="8.5">
      <COLOR NAME="Czerwien" SPACE="CMYK" C="0" M="100" Y="100" K="0"/>
      <PAGE PAGEXPOS="100" PAGEYPOS="20" PAGEWIDTH="595.28" PAGEHEIGHT="841.89" NUM="0" BORDERTOP="40"/>
      <PAGE PAGEXPOS="100" PAGEYPOS="900" PAGEWIDTH="595.28" PAGEHEIGHT="841.89" NUM="1"/>
      <PAGEOBJECT OwnPage="0" ItemID="11" NEXTITEM="22" PTYPE="4" XPOS="150" YPOS="70" WIDTH="200" HEIGHT="100" ROT="0"><StoryText><DefaultStyle FONT="Arial Regular" FONTSIZE="12" FCOLOR="Black"/><ITEXT CH="Drogi &lt;&lt;imie&gt;&gt;, zapraszamy."/><para ALIGN="1"/><ITEXT FONT="Arial Bold" CH="Długi tekst dalej"/><trail ALIGN="1"/></StoryText></PAGEOBJECT>
      <PAGEOBJECT OwnPage="1" ItemID="22" BACKITEM="11" PTYPE="4" XPOS="150" YPOS="950" WIDTH="200" HEIGHT="100" ROT="0"><StoryText><DefaultStyle/><trail/></StoryText></PAGEOBJECT>
      <PAGEOBJECT OwnPage="1" ItemID="33" PTYPE="6" XPOS="150" YPOS="1100" WIDTH="100" HEIGHT="50" ROT="90" PCOLOR="Czerwien" PCOLOR2="None" path="M0 0 L100 0 L100 50 L0 50 Z"/>
      <PAGEOBJECT OwnPage="1" ItemID="44" PTYPE="2" XPOS="300" YPOS="1100" WIDTH="100" HEIGHT="80" PFILE="zdjecia/las.jpg"/>
    </DOCUMENT></SCRIBUSUTF8NEW>`;
    const r = await importujSklad(new File([recznySla], 'Zaproszenie.sla'), JSZip, przyjmijPlik);
    const t1 = r.projekt.strony[0].obiekty[0];
    const t2 = r.projekt.strony[1].obiekty[0];
    const k = r.projekt.strony[1].obiekty.find((e) => e.fill === '#ff0000');
    // Pakiet ZIP: ten sam SLA z obrazem leżącym obok.
    const zip = new JSZip();
    zip.file('Zaproszenie/Zaproszenie.sla', recznySla);
    zip.file('Zaproszenie/zdjecia/las.jpg', await (await fetch(c.toDataURL('image/jpeg'))).blob());
    const zPakietu = await importujSklad(new File([await zip.generateAsync({ type: 'blob' })], 'Zaproszenie.zip'), JSZip, przyjmijPlik);
    return {
      idml: await opis(idml), sla: await opis(sla),
      reczny: {
        stron: r.raport.stron, pola: r.raport.pola, brak: r.raport.brakujace,
        tekst: t1.text, align: t1.textAlign, watek: Boolean(t1.watek) && t1.watek === t2.watek, nr: [t1.watek_nr, t2.watek_nr], drugi: t2.text,
        ramka: [Math.round(t1.left), Math.round(t1.top), Math.round(t1.width)],
        obrocony: k && [k.type, Math.round(k.left), Math.round(k.width), Math.round(k.height)],
        szare: r.projekt.strony[1].obiekty.some((e) => /Brak obrazu: las.jpg/.test(e.nazwa || '')),
      },
      pakiet: { obrazy: zPakietu.raport.obrazy, brak: zPakietu.raport.brakujace },
      idmlBlob: Array.from(new Uint8Array(await idml.arrayBuffer())),
    };
  });
  for (const [nazwa, x] of [['IDML', w.idml], ['SLA', w.sla]]) {
    assert.deepEqual(x.raport, { teksty: 1, ksztalty: 2, obrazy: 1, stron: 1, brak: 0 }, `${nazwa}: prostokąt, elipsa, obraz`);
    assert.deepEqual(x.format, [148, 210, 3, 10], `${nazwa}: format, spad, margines`);
    assert.equal(x.tekst.text, 'Tytuł książki\nDrugi akapit');
    assert.deepEqual([x.tekst.rodzina, x.tekst.rozmiar, x.tekst.kolor, x.tekst.align, x.tekst.left, x.tekst.top], ['Inter', 8, '#1f2a44', 'center', 15, 20], nazwa);
    assert.deepEqual(x.tekst.style, [[0, 5, 'bold', '#c1121f']], `${nazwa}: pogrubiony czerwony fragment`);
    assert.deepEqual(x.prostokat, [15, 60, 50, 30], nazwa);
    assert.ok(x.typy.includes('ellipse'), `${nazwa}: elipsa`);
    assert.deepEqual(x.obraz, [20, 120, 40, 40, true], `${nazwa}: obraz na miejscu, w zasobach`);
  }
  assert.equal(w.reczny.stron, 2);
  assert.deepEqual(w.reczny.pola, ['imie']);
  assert.equal(w.reczny.tekst, 'Drogi {imie}, zapraszamy.\nDługi tekst dalej');
  assert.equal(w.reczny.align, 'center');
  assert.ok(w.reczny.watek, 'ramki połączone w jeden wątek');
  assert.deepEqual(w.reczny.nr, [0, 1]);
  assert.equal(w.reczny.drugi, '');
  assert.deepEqual(w.reczny.ramka, [18, 18, 71], 'XPOS 150 − strona 100 = 50 pt ≈ 17,6 mm');
  assert.deepEqual(w.reczny.obrocony, ['rect', 0, 18, 35], 'prostokąt 100 × 50 pt obrócony o 90° wokół lewego górnego rogu');
  assert.ok(w.reczny.szare, 'brakujący obraz – szare pole z nazwą pliku');
  assert.deepEqual(w.reczny.brak, ['las.jpg']);
  assert.deepEqual(w.pakiet, { obrazy: 1, brak: [] }, 'obraz z folderu w ZIP-ie');

  // Z listy projektów: Importuj z pliku → .idml.
  const plik = path.join(os.tmpdir(), `test-${process.pid}.idml`);
  fs.writeFileSync(plik, Buffer.from(w.idmlBlob));
  t.after(() => fs.rmSync(plik, { force: true }));
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.setInputFiles('#plik-projekt', plik);
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa?.startsWith('test-') && document.body.dataset.ekran === 'edytor', null, { timeout: 20000 });
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.length), 4, 'tekst, prostokąt, elipsa, obraz');
  assert.deepEqual(bledy, []);
});
