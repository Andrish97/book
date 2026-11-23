// Seria dla innych programów (#226): szablon z polami + dane – InDesign/Affinity (IDML z <<pole>>, dane.csv
// z kolumną @obraz i plikiem w obrazy/), Scribus (SLA z %VAR_pole%), Word/Publisher (DOCX z MERGEFIELD, dane.xlsx);
// strony raz, nie powielone; pola dokumentu ({nr}) policzone; odczyt MERGEFIELD z DOCX jako pola {pole}.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, zPlikow } = require('./pomoc.cjs');

test('seria dla innych programów: IDML, SLA, DOCX z polami i dane z obrazami; MERGEFIELD z powrotem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Dyplomy');
  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const c = document.createElement('canvas'); c.width = 20; c.height = 20; c.getContext('2d').fillRect(0, 0, 20, 20);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    const { przyjmijPlik } = await import('./js/obrazy-projektu.js');
    const { id } = await przyjmijPlik(p, blob, 'anna.png');
    p.tabele.push({ id: 'tb1', nazwa: 'Osoby', kolumny: ['imie', 'foto'], wiersze: [['Anna Żak', 'anna.png'], ['Bartek', ''], ['Celina', '']] });
    p.serie.push({ id: 'se1', nazwa: 'Osoby', tabela: 'tb1', tryb: 'tabela', ile: 3, uklad: 'dlugi', dodatkowe: [], dopelnij: false });
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty.push(
      { type: 'textbox', id: 'o_t', left: 15, top: 20, width: 100, text: 'Dyplom dla {imie}\nstrona {nr}', fontFamily: 'Inter', fontSize: 6, fill: '#000000', strokeWidth: 0 },
      { type: 'image', id: 'o_f', src: `zasob:${id}`, zasob: id, left: 15, top: 60, width: 20, height: 20, scaleX: 1, scaleY: 1, pole: { kolumna: 'foto' } },
    );
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const XLSX = await biblioteka('js/zewnetrzne/xlsx-0.18.5.full.min.js', 'XLSX', 'Excel');
    const { pakietSerii } = await import('./js/eksport-serii.js');
    const wyniki = {};
    for (const prog of ['indesign', 'scribus', 'word']) {
      try {
      const r = await pakietSerii(p, prog, JSZip, { XLSX });
      const zip = await JSZip.loadAsync(r.blob);
      const pliki = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
      if (!zip.file('dane.csv')) throw new Error(prog + ': ' + pliki.join(','));
      const dane = (await zip.file('dane.csv').async('string')).replace(/^﻿/, '');
      let szablon = '';
      if (prog === 'indesign') {
        const idml = await JSZip.loadAsync(await zip.file('szablon.idml').async('blob'));
        const historie = Object.keys(idml.files).filter((n) => n.startsWith('Stories/') && !idml.files[n].dir);
        szablon = (await Promise.all(historie.map((n) => idml.file(n).async('string')))).join('');
        wyniki.stronIdml = Object.keys(idml.files).filter((n) => n.startsWith('Spreads/') && !idml.files[n].dir).length;
      } else if (prog === 'scribus') {
        szablon = await zip.file('szablon.sla').async('string');
        wyniki.stronSla = (szablon.match(/<PAGE /g) || []).length;
      } else {
        const docx = await zip.file('szablon.docx').async('blob');
        szablon = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
        const { czytajDocx } = await import('./js/import-tekstu.js');
        wyniki.zPowrotem = (await czytajDocx(await JSZip.loadAsync(docx))).akapity.map((a) => a.tekst);
        const xl = XLSX.read(await zip.file('dane.xlsx').async('uint8array'), { type: 'array' });
        wyniki.xlsx = XLSX.utils.sheet_to_json(xl.Sheets.Dane, { header: 1 });
      }
      wyniki[prog] = { pliki, dane: dane.split('\r\n').filter(Boolean), pola: r.pola, wierszy: r.wierszy, szablon, czytaj: await zip.file('CZYTAJ-MNIE.txt').async('string') };
      } catch (e) { wyniki[prog] = { blad: `${prog} ${e.stack}` }; }
    }
    return wyniki;
  });
  assert.equal(w.indesign.blad, undefined);
  for (const prog of ['indesign', 'scribus', 'word']) assert.match(w[prog].czytaj, /Co i jak się przeniosło:\nPrzeniesione bez zmian: \d+/, `${prog}: raport przeniesienia w CZYTAJ-MNIE (#232)`);
  assert.deepEqual(w.indesign.pliki, ['CZYTAJ-MNIE.txt', 'dane.csv', 'obrazy/anna.png', 'szablon.idml']);
  assert.deepEqual(w.indesign.dane, ['imie,@foto', 'Anna Żak,obrazy/anna.png', 'Bartek,', 'Celina,']);
  assert.deepEqual(w.indesign.pola, ['imie']);
  assert.equal(w.indesign.wierszy, 3);
  assert.equal(w.stronIdml, 1, 'strona raz, nie trzy');
  assert.match(w.indesign.szablon, /Dyplom dla &lt;&lt;imie&gt;&gt;/);
  assert.match(w.indesign.szablon, /strona 1/, 'pole dokumentu {nr} policzone');
  assert.equal(w.stronSla, 1);
  assert.match(w.scribus.szablon, /Dyplom dla %VAR_imie%/);
  assert.deepEqual(w.word.pliki, ['CZYTAJ-MNIE.txt', 'dane.csv', 'dane.xlsx', 'obrazy/anna.png', 'szablon.docx']);
  assert.match(w.word.szablon, /<w:fldSimple w:instr=" MERGEFIELD &quot;imie&quot; ">/);
  assert.match(w.word.szablon, /<wps:txbx>/, 'Word z układem stron – ramki tekstu');
  assert.deepEqual(w.zPowrotem.filter((x) => x.trim()), ['Dyplom dla {imie}', 'strona 1'], 'MERGEFIELD wraca jako pole (numer strony szablonu policzony)');
  assert.deepEqual(w.xlsx, [['imie', '@foto'], ['Anna Żak', 'obrazy/anna.png'], ['Bartek', ''], ['Celina', '']]);

  // Z menu ⋯: okno wyboru programu → ZIP.
  await zPlikow(strona, 'seria-programy');
  await strona.waitForSelector('#dlg-seria-programy[open]');
  await strona.click('#dlg-seria-programy label:has(input[value="scribus"])');
  await strona.screenshot({ path: '/tmp/claude-0/-home-user-book/c7489e9c-f7c8-52f9-8669-f2a79a7c09c7/scratchpad/seria-okno.png' });
  assert.ok(await strona.isChecked('#dlg-seria-programy input[value="scribus"]'));
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#seria-programy-ok')]);
  assert.equal(plik.suggestedFilename(), 'Dyplomy - szablon i dane - scribus.zip');
  assert.deepEqual(bledy, []);
});
