// Nowe działy Biblioteki (#162): ikony, ilustracje, okolicznościowe, tła i wzory, formularze, infografiki,
// nagłówki, bloki treści, układy stron i rozbudowany Planer. Każdy element wstawia się jako jeden element
// (kompozycja = grupa zwykłych tekstów, kształtów i ścieżek), jednym krokiem cofania; tła leżą na całej
// stronie ze spadem, pod treścią; PDF z wzorem, przejściem kolorów i kompozycjami zostaje wektorowy.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const NOWE = ['ikony', 'ilustracje', 'okolicznosciowe', 'tla', 'formularze', 'infografiki', 'naglowki', 'bloki', 'uklady'];

test('biblioteka #162: liczności, każdy element nowych działów wstawia się jako jeden element, nazwy bez powtórzeń', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Działy');
  const w = await strona.evaluate(async (nowe) => {
    const { kategorieBiblioteki } = await import('./js/biblioteka.js');
    const e = window.seriodruk.edytor;
    const kat = Object.fromEntries(kategorieBiblioteki().map((k) => [k.id, k.elementy()]));
    const zle = [];
    const powtorzone = [];
    for (const id of [...nowe, 'planer']) {
      const nazwy = kat[id].map((x) => x.nazwa);
      for (const n of new Set(nazwy)) if (nazwy.filter((x) => x === n).length > 1) powtorzone.push(`${id}: ${n}`);
      for (const el of kat[id]) {
        if (!/^<svg[\s\S]*<\/svg>$/.test(el.podglad || '')) zle.push(`${id}/${el.id}: podgląd`);
        if (!el.grupa) zle.push(`${id}/${el.id}: bez grupy`);
        const przed = e.canvas.getObjects().length;
        let obj;
        try { obj = await el.wstaw(e, null); } catch (err) { zle.push(`${id}/${el.id}: ${err.message}`); continue; }
        if (!obj || e.canvas.getObjects().length !== przed + 1) zle.push(`${id}/${el.id}: nie jeden element`);
        else if (![obj.width, obj.height, obj.left, obj.top].every(Number.isFinite)) zle.push(`${id}/${el.id}: wymiary`);
        e.canvas.discardActiveObject();
        e.canvas.remove(...e.canvas.getObjects());
      }
    }
    // Ikony: zwykła ścieżka z obrysem, bez wypełnienia; linia rośnie z ikoną.
    const ikona = await kat.ikony.find((x) => x.id === 'ikona-krzyz').wstaw(e, null);
    const ik = { typ: ikona.type, fill: ikona.fill, obrys: ikona.stroke, jednolity: ikona.strokeUniform, nazwa: ikona.nazwa };
    return { ile: Object.fromEntries([...nowe, 'planer'].map((id) => [id, kat[id].length])), zle, powtorzone, ik };
  }, NOWE);
  assert.deepEqual(w.zle, []);
  assert.deepEqual(w.powtorzone, []);
  const min = { ikony: 250, ilustracje: 20, okolicznosciowe: 28, tla: 30, formularze: 10, infografiki: 12, naglowki: 15, bloki: 12, uklady: 6, planer: 25 };
  for (const [id, n] of Object.entries(min)) assert.ok(w.ile[id] >= n, `${id}: ${w.ile[id]} < ${n}`);
  assert.deepEqual(w.ik, { typ: 'path', fill: '', obrys: '#1a1a1a', jednolity: false, nazwa: 'Krzyż' });
  assert.deepEqual(bledy, []);
});

test('biblioteka #162: tło na całą stronę ze spadem pod treścią, kompozycja jako grupa z edytowalnym tekstem, jeden krok cofania, zapis i PDF wektorowy', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tła');
  const w = await strona.evaluate(async () => {
    const { elementBiblioteki } = await import('./js/biblioteka.js');
    const e = window.seriodruk.edytor;
    e.dodajProstokat();
    const tresc = e.aktywny;
    const tlo = await elementBiblioteki('tla', 'wzor-kropki').wstaw(e, null);
    const r = { left: tlo.left, top: tlo.top, szer: tlo.getScaledWidth(), wys: tlo.getScaledHeight(), naSpodzie: e.canvas.getObjects().indexOf(tlo) < e.canvas.getObjects().indexOf(tresc) };
    const wydruk = { w: e.wydruk.szerokosc_mm, h: e.wydruk.wysokosc_mm, spad: e.wydruk.spad_mm, x: e.strony[e.aktywna].x };
    const nagl = await elementBiblioteki('naglowki', 'tytul-podtytul').wstaw(e, null);
    const teksty = nagl.getObjects().filter((o) => o.type === 'textbox').map((o) => o.text);
    await elementBiblioteki('tla', 'przejscie-kolo').wstaw(e, null);
    await elementBiblioteki('planer', 'kalendarz-roczny').wstaw(e, null);
    await elementBiblioteki('formularze', 'zamowienie').wstaw(e, null);
    return { r, wydruk, typ: nagl.type, teksty };
  });
  // Krok historii powstaje po chwili bez zmian – ikona osobno, żeby cofnięcie dotyczyło tylko jej.
  await strona.waitForTimeout(900);
  w.ile = await strona.evaluate(async () => {
    const { elementBiblioteki } = await import('./js/biblioteka.js');
    const e = window.seriodruk.edytor;
    await elementBiblioteki('ikony', 'ikona-golebica').wstaw(e, null);
    return e.canvas.getObjects().length;
  });
  await strona.waitForTimeout(900);
  const { w: sw, h: sh, spad, x } = w.wydruk;
  assert.ok(Math.abs(w.r.left - (x - spad)) < 0.6 && Math.abs(w.r.top + spad) < 0.6, JSON.stringify(w.r));
  assert.ok(Math.abs(w.r.szer - (sw + 2 * spad)) < 1 && Math.abs(w.r.wys - (sh + 2 * spad)) < 1, JSON.stringify(w.r));
  assert.equal(w.r.naSpodzie, true, 'tło pod wcześniejszą treścią');
  assert.equal(w.typ, 'group');
  assert.deepEqual(w.teksty, ['Tytuł rozdziału', 'Podtytuł albo krótkie wprowadzenie']);
  assert.equal(w.ile, 7);

  // Jedno cofnięcie zdejmuje całą ostatnią wstawkę (ikonę), reszta zostaje.
  await strona.click('[data-akcja="cofnij"]');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().length), 6);

  // Zapis, ponowne wczytanie i PDF: bez elementów zamienionych na obraz.
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().length), 6);
  const pdf = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { zlozPdf } = await import('./js/eksport.js');
    const { rozwin } = await import('./js/serie.js');
    const ciag = rozwin(stan.projekt);
    const uwagi = new Map();
    const blob = await zlozPdf(stan.projekt, ciag.egzemplarze, { ciag, uwagi });
    return { rozmiar: blob.size, uwagi: [...uwagi.values()].flat().map(String) };
  });
  assert.ok(pdf.rozmiar > 1000);
  assert.deepEqual(pdf.uwagi, [], 'wzór, przejście, kalendarz roczny, tabela i ikona – wektorowo');
  assert.deepEqual(bledy, []);
});

test('biblioteka #162: okno – kategorie w kolejności, grupy z nagłówkami, szukanie po polsku, panel z kategoriami w trzech rzędach', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Okno');
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  await strona.click('#kategorie-biblioteki [data-kategoria="ikony"]');
  const grupy = await strona.locator('#elementy-biblioteki .grupa-biblioteki').allTextContents();
  assert.deepEqual(grupy, ['Kontakt', 'Czas i kalendarz', 'Pogoda', 'Jedzenie', 'Podróże', 'Szkoła i nauka', 'Wiara', 'Zdrowie', 'Finanse', 'Dom', 'Natura', 'Technologia', 'Strzałki']);
  await strona.fill('#szukaj-w-bibliotece', 'golebica');
  const kat = await strona.evaluate(() => [...new Set([...document.querySelectorAll('#elementy-biblioteki .kafel-biblioteki')].map((b) => b.dataset.kategoria))]);
  for (const k of ['ikony', 'ilustracje', 'okolicznosciowe']) assert.ok(kat.includes(k), `gołębica w ${k}: ${kat}`);
  // Panel obok strony: kategorie zajmują najwyżej trzy rzędy (reszta po przewinięciu).
  const h = await strona.evaluate(() => document.querySelector('#kategorie-biblioteki').getBoundingClientRect().height);
  assert.ok(h <= 114, `wysokość kategorii ${h}`);
  assert.deepEqual(bledy, []);
});
