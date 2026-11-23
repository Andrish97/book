// Raport przeniesienia (#232): przed pobraniem pliku dla innego programu okno mówi, co przejdzie jako obraz, co
// uproszczono, czego nie przeniesiono („Pokaż” prowadzi do elementu, pobranie się wtedy nie odbywa); ten sam opis
// trafia do CZYTAJ-MNIE paczki serii. Po odczycie z IDML/SLA elementy uproszczone mają oznaczenie z_importu,
// są w „Sprawdź przed drukiem” („Sprawdzone” je zdejmuje). Tabela z IDML jako tekst z tabulatorami,
// pola korespondencji seryjnej z zachowanym formatowaniem fragmentów.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, zPlikow } = require('./pomoc.cjs');

test('raport przeniesienia: zapis (okno, Pokaż, Pobierz, CZYTAJ-MNIE) i odczyt (oznaczenia, kontrola, tabela, pola)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Raport');
  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony[0].obiekty.push(
      { type: 'textbox', id: 'o_t', left: 15, top: 20, width: 100, text: 'Tekst z linkiem', fontFamily: 'Inter', fontSize: 6, fill: '#000000', link: 'https://example.org', dziel_wyrazy: true },
      { type: 'rect', id: 'o_cien', left: 15, top: 60, width: 40, height: 40, fill: '#264653', shadow: { color: 'rgba(0,0,0,0.5)', blur: 4, offsetX: 1, offsetY: 1 } },
      { type: 'rect', id: 'o_r', left: 70, top: 60, width: 40, height: 40, fill: '#2a9d8f', strokeWidth: 0 },
    );
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const { Raport } = await import('./js/raport-przeniesienia.js');
    const wyniki = {};
    for (const [nazwa, zapisz] of [
      ['idml', async (raport) => (await import('./js/idml.js')).zapiszIdml(p, JSZip, { raport })],
      ['sla', async (raport) => (await import('./js/scribus.js')).zapiszSla(p, { raport })],
      ['docx', async (raport) => (await import('./js/eksport-uklad.js')).zapiszDocxUklad(p, JSZip, { raport })],
    ]) {
      const raport = new Raport();
      await zapisz(raport);
      wyniki[nazwa] = { grupy: raport.grupy().map((g) => [g.rodzaj, g.powod, g.pierwszy?.idObiektu || null]), tekst: raport.tekst() };
    }
    await window.seriodruk.przeladuj(); // płótno z obiektami dodanymi do projektu
    return wyniki;
  });
  for (const [nazwa, x] of Object.entries(w)) {
    assert.ok(x.grupy.some(([r, pw, id]) => r === 'obraz' && pw === 'element z cieniem' && id === 'o_cien'), `${nazwa}: cień → obraz, z miejscem`);
    assert.ok(x.grupy.some(([r, pw, id]) => r === 'pominiete' && /link/.test(pw) && id === 'o_t'), `${nazwa}: link`);
    assert.ok(x.grupy.some(([r, pw]) => r === 'uwaga' && /dzielenie/.test(pw)), `${nazwa}: dzielenie wyrazów`);
    assert.ok(!x.grupy.some(([, , id]) => id === 'o_r'), `${nazwa}: zwykły prostokąt bez zmian`);
    assert.match(x.tekst, /Przeniesione bez zmian: \d+/);
    assert.match(x.tekst, /Zamienione w obraz[^\n]*:\n {2}– element z cieniem – strona 1/);
  }

  // Okno przed pobraniem: „Pokaż” zamyka okno bez pobierania i zaznacza element.
  let pobrane = 0;
  strona.on('download', () => { pobrane += 1; });
  await zPlikow(strona, 'scribus');
  await strona.waitForSelector('#dlg-raport-przeniesienia[open]');
  const okno = await strona.evaluate(() => ({
    naglowki: [...document.querySelectorAll('#dlg-raport-przeniesienia h3')].map((h) => h.textContent),
    pozycje: [...document.querySelectorAll('#dlg-raport-przeniesienia li span')].map((s) => s.textContent),
  }));
  assert.ok(okno.naglowki.some((h) => h.startsWith('Zamienione w obraz')));
  assert.ok(okno.pozycje.includes('element z cieniem – strona 1'));
  await strona.evaluate(() => {
    const li = [...document.querySelectorAll('#dlg-raport-przeniesienia li')].find((x) => x.textContent.includes('element z cieniem'));
    li.querySelector('button').click();
  });
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getActiveObject()?.id === 'o_cien');
  assert.equal(pobrane, 0, '„Pokaż” – bez pobierania');
  await zPlikow(strona, 'scribus');
  await strona.waitForSelector('#dlg-raport-przeniesienia[open]');
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#dlg-raport-przeniesienia button[value="tak"]')]);
  assert.equal(plik.suggestedFilename(), 'Raport.sla');

  // Odczyt: IDML z tabelą w tekście, gradientem, cieniem i kryciem, SLA z polem i pogrubionym fragmentem.
  const r = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const { zapiszIdml } = await import('./js/idml.js');
    const { importujSklad } = await import('./js/import-skladu.js');
    const { przyjmijPlik } = await import('./js/obrazy-projektu.js');
    p.strony[0].obiekty = p.strony[0].obiekty.filter((o) => o.id !== 'o_cien');
    const zip = await JSZip.loadAsync((await zapiszIdml(p, JSZip)).blob);
    const nazwy = Object.keys(zip.files);
    // Tabela 2 × 2 za tekstem historii.
    const hist = nazwy.find((n) => n.startsWith('Stories/') && !/zaplecze/i.test(n) && n.endsWith('.xml'));
    let h = await zip.file(hist).async('string');
    const komorka = (n, txt) => `<Cell Name="${n}"><ParagraphStyleRange><CharacterStyleRange><Content>${txt}</Content></CharacterStyleRange></ParagraphStyleRange></Cell>`;
    h = h.replace(/(<Content>Tekst z linkiem<\/Content>)/, `$1<Br/><Table BodyRowCount="2" ColumnCount="2"><Row Name="0"/><Row Name="1"/><Column Name="0"/><Column Name="1"/>${komorka('0:0', 'Imię')}${komorka('1:0', 'Miasto')}${komorka('0:1', 'Ala')}${komorka('1:1', 'Kraków')}</Table>`);
    zip.file(hist, h);
    // Gradient w kolorach i prostokąt z gradientem, cieniem i kryciem 50%.
    let g = await zip.file('Resources/Graphic.xml').async('string');
    g = g.replace('</idPkg:Graphic>', '<Gradient Self="Gradient/g1" Name="g1" Type="Linear"><GradientStop Self="Gradient/g1/s0" StopColor="Color/Black" Location="0"/></Gradient></idPkg:Graphic>');
    zip.file('Resources/Graphic.xml', g);
    const sp = nazwy.find((n) => n.startsWith('Spreads/') && n.endsWith('.xml'));
    let s = await zip.file(sp).async('string');
    s = s.replace(/(<Rectangle [^>]*?)FillColor="Color\/Makietka #2a9d8f"([^>]*>)/, '$1FillColor="Gradient/g1"$2<TransparencySetting><DropShadowSetting Mode="Drop"/><BlendingSetting Opacity="50"/></TransparencySetting>');
    zip.file(sp, s);
    const idml = new File([await zip.generateAsync({ type: 'blob' })], 'Zmieniony.idml');
    const { projekt, przeniesienie } = await importujSklad(idml, JSZip, przyjmijPlik);
    const o = projekt.strony[0].obiekty;
    const tekst = o.find((e) => e.type === 'textbox');
    const prost = o.find((e) => e.z_importu && e.type !== 'textbox');
    const sla = `<?xml version="1.0" encoding="UTF-8"?><SCRIBUSUTF8NEW Version="1.5.8"><DOCUMENT ANZPAGES="1" PAGEWIDTH="595.28" PAGEHEIGHT="841.89">
      <PAGE PAGEXPOS="100" PAGEYPOS="20" PAGEWIDTH="595.28" PAGEHEIGHT="841.89" NUM="0"/>
      <PAGEOBJECT OwnPage="0" ItemID="1" PTYPE="4" XPOS="150" YPOS="70" WIDTH="200" HEIGHT="100"><StoryText><DefaultStyle FONT="Arial Regular" FONTSIZE="12"/><ITEXT CH="Drogi "/><ITEXT FONT="Arial Bold" CH="&lt;&lt;imie&gt;&gt;"/><ITEXT CH=", zapraszamy "/><ITEXT FONT="Arial Bold" CH="dziś"/><trail/></StoryText></PAGEOBJECT>
      <PAGEOBJECT OwnPage="0" ItemID="2" PTYPE="6" XPOS="150" YPOS="300" WIDTH="100" HEIGHT="50" PCOLOR="Black" GRTYP="6" TransValue="0.25" path="M0 0 L100 0 L100 50 L0 50 Z"/>
      <PAGEOBJECT OwnPage="0" ItemID="3" PTYPE="8" XPOS="150" YPOS="400" WIDTH="100" HEIGHT="50"/>
    </DOCUMENT></SCRIBUSUTF8NEW>`;
    const zSla = await importujSklad(new File([sla], 'Pole.sla'), JSZip, przyjmijPlik);
    const ts = zSla.projekt.strony[0].obiekty.find((e) => e.type === 'textbox');
    const ks = zSla.projekt.strony[0].obiekty.find((e) => e.type === 'rect' && e.fill === '#000000');
    return {
      tabela: tekst.text, tekstZnak: tekst.z_importu || '',
      prost: prost && { fill: prost.fill, opacity: prost.opacity, z: prost.z_importu },
      grupy: przeniesienie.grupy().map((x) => [x.rodzaj, x.powod, Boolean(x.pierwszy)]),
      sla: { text: ts.text, style: ts.styles.map((x) => [ts.text.replace(/\n/g, '').slice(x.start, x.end), x.style.fontWeight]) },
      slaKsztalt: ks && { opacity: ks.opacity, z: ks.z_importu },
      slaSciezka: zSla.projekt.strony[0].obiekty.some((e) => /tekst na ścieżce/.test(e.z_importu || '')),
    };
  });
  assert.equal(r.tabela, 'Tekst z linkiem\nImię\tMiasto\nAla\tKraków', 'tabela jako tekst z tabulatorami');
  assert.match(r.tekstZnak, /tabela zamieniona na tekst/);
  assert.equal(r.prost.fill, '#000000', 'gradient → pierwszy kolor');
  assert.equal(r.prost.opacity, 0.5, 'krycie przeniesione');
  assert.match(r.prost.z, /gradient zamieniony na jeden kolor/);
  assert.match(r.prost.z, /cień/);
  assert.ok(r.grupy.some(([rd, pw, gdzie]) => rd === 'uproszczone' && /gradient/.test(pw) && gdzie), 'wpis z miejscem');
  assert.ok(r.grupy.some(([rd, pw]) => rd === 'pominiete' && pw === 'cień'));
  assert.ok(r.grupy.some(([rd, pw]) => rd === 'uwaga' && /łamanie wierszy/.test(pw)));
  assert.equal(r.sla.text, 'Drogi {imie}, zapraszamy dziś');
  assert.deepEqual(r.sla.style, [['{imie}', 'bold'], ['dziś', 'bold']], 'pogrubienie zostaje przy polu i za nim');
  assert.equal(r.slaKsztalt.opacity, 0.75);
  assert.match(r.slaKsztalt.z, /gradient/);
  assert.ok(r.slaSciezka, 'tekst na ścieżce – szare pole z oznaczeniem');

  // Wczytanie z pliku: okno raportu po imporcie, oznaczenia w „Sprawdź przed drukiem”, „Sprawdzone” je zdejmuje.
  await strona.evaluate(async () => {
    const sla = `<?xml version="1.0" encoding="UTF-8"?><SCRIBUSUTF8NEW Version="1.5.8"><DOCUMENT ANZPAGES="1" PAGEWIDTH="595.28" PAGEHEIGHT="841.89">
      <PAGE PAGEXPOS="0" PAGEYPOS="0" PAGEWIDTH="595.28" PAGEHEIGHT="841.89" NUM="0"/>
      <PAGEOBJECT OwnPage="0" ItemID="2" PTYPE="6" XPOS="50" YPOS="300" WIDTH="100" HEIGHT="50" PCOLOR="Black" GRTYP="6" path="M0 0 L100 0 L100 50 L0 50 Z"/>
    </DOCUMENT></SCRIBUSUTF8NEW>`;
    const { wczytajPlikProjektu } = await import('./js/app/projekty.js');
    wczytajPlikProjektu(new File([sla], 'Gradient.sla'));
  });
  await strona.waitForSelector('#dlg-raport-przeniesienia[open]');
  assert.match(await strona.textContent('#dlg-raport-przeniesienia h2'), /Co przeszło z programu Scribus/);
  await strona.click('#dlg-raport-przeniesienia button[value="tak"]');
  await strona.waitForFunction(() => document.querySelector('#dlg-kontrola')?.open && [...document.querySelectorAll('#kontrola-lista li')].some((li) => li.textContent.includes('Z importu')));
  await strona.evaluate(() => [...document.querySelectorAll('#kontrola-lista li')].find((li) => li.textContent.includes('Z importu')).querySelector('button[title^="Usuń oznaczenie"]').click());
  await strona.waitForFunction(() => window.seriodruk.oknoKontroli.uwagi && !window.seriodruk.oknoKontroli.uwagi.some((u) => u.rodzaj === 'z_importu'));
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.some((o) => o.z_importu)), false);
  assert.deepEqual(bledy, []);
});
