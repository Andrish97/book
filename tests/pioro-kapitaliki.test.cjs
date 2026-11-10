const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Czytnik PDF: strona z pliku jest rysowana niezależnym programem i porównywana z obrazem z aplikacji.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WATEK = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Punkt strony (mm) → punkt ekranu.
const naEkranie = (strona, x, y) => strona.evaluate(([mx, my]) => {
  const c = window.seriodruk.edytor.canvas;
  const v = c.viewportTransform;
  const r = c.upperCanvasEl.getBoundingClientRect();
  return [r.left + mx * v[0] + v[4], r.top + my * v[3] + v[5]];
}, [x, y]);
const klik = async (strona, x, y) => strona.mouse.click(...(await naEkranie(strona, x, y)));
// Kliknięcie z przeciągnięciem: punkt w (x, y), uchwyt wyciągnięty do (ux, uy).
const klikZLukiem = async (strona, x, y, ux, uy) => {
  await strona.mouse.move(...(await naEkranie(strona, x, y)));
  await strona.mouse.down();
  await strona.mouse.move(...(await naEkranie(strona, ux, uy)), { steps: 5 });
  await strona.mouse.up();
};
// Porównanie z tolerancją: mysz trafia w całe piksele ekranu, czyli z dokładnością ok. 0,4 mm strony.
const blisko = (a, b, tol = 0.6) => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => blisko(x, b[i], tol));
  return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= tol : a === b;
};
const zgodne = (a, b, opis = '', tol = 0.6) => assert.ok(blisko(a, b, tol), `${opis}: ${JSON.stringify(a)} wobec ${JSON.stringify(b)}`);
const sciezki = (strona) => strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'path').map((o) => ({
  id: Boolean(o.id), fill: o.fill, stroke: o.stroke, grubosc: o.strokeWidth, kat: o.angle,
  polecenia: o.path.map(([co, ...l]) => [co, ...l.map((n) => Math.round(n * 10) / 10)]),
  ramka: (() => { const b = o.getBoundingRect(); return [b.left, b.top, b.width, b.height].map((n) => Math.round(n * 10) / 10); })(),
})));

test('pióro: punkty i łuki, cofanie punktu, kształt otwarty i zamknięty, wypełnienie, zapis, cofnięcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Pióro');
  const przycisk = '[data-akcja="pioro"]';
  await strona.click(przycisk);
  assert.equal(await strona.getAttribute(przycisk, 'aria-pressed'), 'true');
  assert.equal(await strona.textContent('#tytul-wlasciwosci'), 'Pióro');
  const ile = () => strona.evaluate(() => window.seriodruk.edytor.punktyPiora);

  // Dwa zwykłe punkty i trzeci z łukiem (przeciągnięcie wyciąga uchwyty).
  await klik(strona, 30, 40);
  await klik(strona, 60, 40);
  await klikZLukiem(strona, 90, 70, 100, 80);
  assert.equal(await ile(), 3);
  assert.match(await strona.textContent('.wlasciwosci'), /Punktów w zaczętym kształcie: 3/);
  // Backspace cofa ostatni punkt; stawiamy go jeszcze raz.
  await strona.keyboard.press('Backspace');
  assert.equal(await ile(), 2);
  await klikZLukiem(strona, 90, 70, 100, 80);
  // Enter kończy kształt otwarty; pióro zostaje włączone.
  await strona.keyboard.press('Enter');
  let s = await sciezki(strona);
  assert.equal(s.length, 1);
  zgodne(s[0].polecenia, [['M', 30, 40], ['L', 60, 40], ['C', 60, 40, 80, 60, 90, 70]], 'odcinek prosty i krzywa z uchwytem lustrzanym do wyciągniętego', 0.9);
  assert.deepEqual([s[0].id, s[0].fill, s[0].grubosc], [true, '', 0.6]);
  assert.equal(await ile(), 0);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.pioro), true);

  // Kształt zamknięty: kliknięcie w pierwszy punkt.
  await strona.waitForTimeout(450);
  await klik(strona, 30, 100);
  await klik(strona, 70, 100);
  await klik(strona, 50, 130);
  await klik(strona, 30, 100);
  s = await sciezki(strona);
  assert.equal(s.length, 2);
  zgodne(s[1].polecenia, [['M', 30, 100], ['L', 70, 100], ['L', 50, 130], ['Z']], 'zamknięty trójkąt');

  // Esc porzuca zaczęty kształt; drugi Esc wyłącza pióro.
  await klik(strona, 100, 150);
  assert.equal(await ile(), 1);
  await strona.keyboard.press('Escape');
  assert.equal(await ile(), 0);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.pioro), true);
  await strona.keyboard.press('Escape');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.pioro), false);
  assert.equal(await strona.getAttribute(przycisk, 'aria-pressed'), 'false');
  assert.equal((await sciezki(strona)).length, 2, 'porzucony kształt nie zostawia elementu');

  // Zamknięty kształt jest zwykłym elementem: zaznacza się kliknięciem, ma kolor linii i wypełnienie.
  await klik(strona, 50, 100);
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'path');
  assert.equal(await strona.textContent('#tytul-wlasciwosci'), 'Rysunek');
  assert.ok(await strona.isVisible('.wlasciwosci label:has-text("Wypełnienie")'));
  await strona.waitForTimeout(450); // narysowanie kształtu i zmiana wypełnienia to osobne kroki cofania
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set('fill', '#ffd166'); e.zatwierdz(); });
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  const zapis = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.map((o) => [o.type, o.fill, Boolean(o.id)]));
  assert.deepEqual(zapis, [['path', '', true], ['path', '#ffd166', true]]);

  // Klawisz N włącza pióro, drugi raz wyłącza; cofnięcie zdejmuje wypełnienie, potem drugi kształt.
  await strona.keyboard.press('Escape');
  await strona.keyboard.press('n');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.pioro), true);
  await strona.keyboard.press('n');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.pioro), false);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'path').at(-1)?.fill === '');
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'path').length === 1);
  assert.deepEqual(bledy, []);
});

test('edycja punktów kształtu: przesuwanie punktu i uchwytu, dodanie i usunięcie punktu, anulowanie, kształt obrócony', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Punkty');
  // Trójkąt z pióra i krzywa (jak z rysowania odręcznego), wpisane wprost do strony.
  await strona.evaluate(async () => {
    const { stan, zapiszTeraz, przeladuj } = window.seriodruk;
    await zapiszTeraz();
    stan.projekt.strony[0].obiekty = [
      { type: 'path', left: 29.7, top: 99.7, path: [['M', 30, 100], ['L', 70, 100], ['L', 50, 130], ['Z']], fill: '', stroke: '#1a1a1a', strokeWidth: 0.6, strokeUniform: true, id: 'trojkat' },
      { type: 'path', left: 29.7, top: 34.7, path: [['M', 30, 50], ['C', 40, 30, 60, 30, 70, 50], ['C', 80, 70, 100, 70, 110, 50]], fill: '', stroke: '#d00000', strokeWidth: 0.6, strokeUniform: true, id: 'fala' },
    ];
    await przeladuj();
    window.seriodruk.edytor.oznaczZmiane(); // stan wyjściowy jako krok historii
  });
  await strona.waitForTimeout(450);
  const punkty = () => strona.evaluate(() => { const p = window.seriodruk.edytor.punktyKsztaltu; return p && { ...p, punkty: p.punkty.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]) }; });
  const ksztalt = (id) => strona.evaluate((i) => { const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === i); const b = o.getBoundingRect(); const r = (n) => Math.round(n * 10) / 10; return { kat: o.angle, ramka: [b.left, b.top, b.width, b.height].map(r), polecen: o.path.length }; }, id);

  // Podwójne kliknięcie kształtu zaczyna edycję punktów.
  await strona.mouse.dblclick(...(await naEkranie(strona, 50, 110)));
  await strona.waitForFunction(() => window.seriodruk.edytor.edytujePunkty);
  assert.equal(await strona.textContent('#tytul-wlasciwosci'), 'Punkty kształtu');
  let p = await punkty();
  assert.equal(p.ile, 3);
  zgodne(p.punkty, [[30, 100], [70, 100], [50, 130]], 'punkty trójkąta', 0.05);

  // Przeciągnięcie punktu myszą.
  await strona.mouse.move(...(await naEkranie(strona, 70, 100)));
  await strona.mouse.down();
  await strona.mouse.move(...(await naEkranie(strona, 80, 90)), { steps: 5 });
  await strona.mouse.up();
  p = await punkty();
  zgodne(p.punkty, [[30, 100], [80, 90], [50, 130]], 'punkt po przeciągnięciu');
  assert.equal(p.wybrany, 1);
  assert.match(await strona.textContent('.wlasciwosci'), /Punktów: 3 · zaznaczony 2/);

  // Podwójne kliknięcie w linię dodaje punkt; Delete usuwa zaznaczony.
  await strona.mouse.dblclick(...(await naEkranie(strona, 55, 95)));
  p = await punkty();
  assert.equal(p.ile, 4);
  zgodne(p.punkty[1], [55, 95], 'nowy punkt na linii');
  assert.equal(p.wybrany, 1, 'nowy punkt jest zaznaczony');
  await strona.keyboard.press('Delete');
  p = await punkty();
  assert.equal(p.ile, 3);
  zgodne(p.punkty, [[30, 100], [80, 90], [50, 130]], 'po usunięciu dodanego punktu');
  // Kształt zamknięty nie może zejść poniżej trzech punktów.
  await klik(strona, 30, 100);
  await strona.keyboard.press('Delete');
  assert.equal((await punkty()).ile, 3);

  // Enter zatwierdza: element ma nową ramkę i jest zaznaczony; cofnięcie przywraca dawny kształt.
  await strona.keyboard.press('Enter');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.edytujePunkty), false);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny?.id), 'trojkat');
  let k = await ksztalt('trojkat');
  zgodne(k.ramka, [29.7, 89.7, 50.6, 40.6], 'ramka obejmuje przesunięty punkt (z grubością linii)');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await strona.waitForTimeout(450);
  await strona.keyboard.press('Escape');
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => { const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 'trojkat'); return o && Math.abs(o.getBoundingRect().width - 40.6) < 0.2; });

  // Krzywa: zaznaczony punkt pokazuje uchwyty; przesunięcie uchwytu zmienia łuk, punkt zostaje.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.edytujPunkty(e.canvas.getObjects().find((x) => x.id === 'fala')); });
  p = await punkty();
  zgodne(p.punkty, [[30, 50], [70, 50], [110, 50]], 'punkty krzywej', 0.05);
  await klik(strona, 70, 50);
  assert.equal((await punkty()).wybrany, 1);
  // Uchwyt wchodzący środkowego punktu leży w (60, 30).
  await strona.mouse.move(...(await naEkranie(strona, 60, 30)));
  await strona.mouse.down();
  await strona.mouse.move(...(await naEkranie(strona, 60, 20)), { steps: 4 });
  await strona.mouse.up();
  const fala = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 'fala').path.map(([co, ...l]) => [co, ...l.map((n) => Math.round(n))]));
  zgodne(fala, [['M', 30, 50], ['C', 40, 30, 60, 20, 70, 50], ['C', 80, 70, 100, 70, 110, 50]], 'przesunięty tylko uchwyt', 1);
  // Przesunięcie punktu zabiera oba jego uchwyty.
  await strona.evaluate(() => window.seriodruk.edytor.przesunPunkt(1, 0, 10));
  const fala2 = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 'fala').path.map(([co, ...l]) => [co, ...l.map((n) => Math.round(n))]));
  zgodne(fala2, [['M', 30, 50], ['C', 40, 30, 60, 30, 70, 60], ['C', 80, 80, 100, 70, 110, 50]], 'punkt zabrał oba uchwyty', 1);
  // Esc przywraca kształt sprzed edycji.
  await strona.keyboard.press('Escape');
  const fala3 = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 'fala').path.map(([co, ...l]) => [co, ...l.map((n) => Math.round(n))]));
  zgodne(fala3, [['M', 30, 50], ['C', 40, 30, 60, 30, 70, 50], ['C', 80, 70, 100, 70, 110, 50]], 'kształt sprzed edycji', 0.05);

  // Kształt obrócony i powiększony: wejście w edycję i wyjście bez zmian nie rusza go z miejsca;
  // punkty są pokazywane tam, gdzie je widać na stronie.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.id === 'fala'); o.set({ angle: 30, scaleX: 1.5, scaleY: 1.5 }); o.setCoords(); e.zatwierdz(); });
  const przed = await ksztalt('fala');
  // Gdzie na stronie leżą punkty obróconego kształtu (liczone z jego przekształcenia).
  const naStronie = await strona.evaluate(() => {
    const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 'fala');
    const m = o.calcTransformMatrix();
    return o.path.map((k) => { const p = new fabric.Point(k.at(-2) - o.pathOffset.x, k.at(-1) - o.pathOffset.y).transform(m); return [p.x, p.y]; });
  });
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.edytujPunkty(e.canvas.getObjects().find((x) => x.id === 'fala')); });
  const wTrakcie = await ksztalt('fala');
  assert.equal(wTrakcie.kat, 0, 'na czas edycji obrót jest wpisany w punkty');
  zgodne((await punkty()).punkty, naStronie, 'punkty leżą tam, gdzie widać kształt', 0.06);
  assert.ok(Math.abs(naStronie[2][0] - naStronie[0][0] - 120 * Math.cos(Math.PI / 6)) < 0.01, 'kształt jest obrócony i półtora raza większy');
  await strona.keyboard.press('Escape');
  k = await ksztalt('fala');
  assert.deepEqual([k.kat, k.ramka], [30, przed.ramka], 'anulowanie przywraca obrót i położenie');
  assert.deepEqual(bledy, []);
});

test('kapitaliki: małe litery jako mniejsze wielkie – tylko wygląd; pomiar, zapis, pisanie i PDF wektorowy zgodne z ekranem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kapitaliki');
  await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const o = e.dodajTekst('Żółta Łódź i mała gęś 2027');
    o.set({ left: 15, top: 30, width: 120, fontSize: 8, fontFamily: 'Lora' });
    await document.fonts.load('16px "Lora"', 'Zażółć gęślą jaźń');
    await document.fonts.ready;
    o.initDimensions();
    e.zatwierdz();
  });
  // Najpierw szerokość wiersza: to ona każe zmierzyć znaki, jeśli pomiar został wyczyszczony (np. po doczytaniu czcionki).
  const pomiar = () => strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; const wiersz = o.getLineWidth(0); return { tresc: o.text, tryb: o.wielkosc_liter, szer: o.__charBounds[0].slice(0, o._textLines[0].length).map((b) => b.width), wiersz, wysokosc: o.getHeightOfLine(0) }; });
  await strona.click('#wlasciwosci button[aria-label^="WSZYSTKIE WIELKIE"]');
  const wielkie = await pomiar();
  await strona.click('#wlasciwosci button[aria-label^="Kapitaliki"]');
  const kap = await pomiar();
  assert.equal(kap.tryb, 'kapitaliki');
  assert.equal(kap.tresc, 'Żółta Łódź i mała gęś 2027', 'treść zostaje, jak wpisana');
  // Wielkie litery, spacje i cyfry mają szerokość jak przy „WIELKICH”, małe – 0,8 tej szerokości.
  [...kap.tresc].forEach((znak, i) => {
    const mala = znak.toLocaleUpperCase('pl') !== znak;
    assert.ok(Math.abs(kap.szer[i] - wielkie.szer[i] * (mala ? 0.8 : 1)) < 0.002, `znak „${znak}”: ${kap.szer[i]} wobec ${wielkie.szer[i]}`);
  });
  assert.ok(kap.wiersz < wielkie.wiersz * 0.9, 'wiersz jest węższy niż pisany samymi wielkimi');
  assert.equal(kap.wysokosc, wielkie.wysokosc, 'wysokość wiersza się nie zmienia');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await strona.evaluate(() => { const o = window.seriodruk.stan.projekt.strony[0].obiekty[0]; return [o.text, o.wielkosc_liter]; }), ['Żółta Łódź i mała gęś 2027', 'kapitaliki']);

  // Pisanie: kursor na końcu stoi na końcu wiersza, dopisane litery od razu są kapitalikami.
  await strona.evaluate(() => window.seriodruk.edytor.aktywny.enterEditing());
  await strona.keyboard.press('Control+End');
  await strona.keyboard.type(' rok');
  const poPisaniu = await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; const k = o._getCursorBoundaries(o.selectionStart); return { tresc: o.text, kursor: k.left + k.leftOffset, wiersz: o.getLineWidth(0), lewo: o._getLeftOffset() }; });
  assert.equal(poPisaniu.tresc, 'Żółta Łódź i mała gęś 2027 rok');
  assert.ok(Math.abs(poPisaniu.kursor - (poPisaniu.lewo + poPisaniu.wiersz)) < 0.05, `kursor na końcu wiersza: ${JSON.stringify(poPisaniu)}`);
  await strona.keyboard.press('Escape');

  // PDF wektorowy: tekst jest tekstem (wielkimi literami), a obraz strony zgadza się z aplikacją.
  await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const drugi = e.dodajTekst('Kapitaliki w wyjustowanym akapicie, który zajmuje więcej niż jeden wiersz i ma Wielkie Litery na początku słów.');
    drugi.set({ left: 15, top: 60, width: 70, fontSize: 5, fontFamily: 'Inter', textAlign: 'justify', wielkosc_liter: 'kapitaliki', lista: 'punkty' });
    drugi.initDimensions();
    e.canvas.discardActiveObject();
    e.zatwierdz();
    await window.seriodruk.zapiszTeraz();
    await document.fonts.ready;
  });
  const w = await strona.evaluate(async ([pdfjs, watek]) => {
    const { stan } = window.seriodruk;
    const { eksportujPdf } = await import('./js/eksport.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const wynik = await eksportujPdf(stan.projekt, { tryb: 'wektor', dpi: 150, znaki: false, spad: true });
    const bajty = new Uint8Array(await wynik.blob.arrayBuffer());
    if (!window.pdfjsLib) await new Promise((ok, blad) => { const s = document.createElement('script'); s.src = pdfjs; s.onload = ok; s.onerror = blad; document.head.append(s); });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = watek;
    const str = await (await window.pdfjsLib.getDocument({ data: bajty.slice() }).promise).getPage(1);
    const widok = str.getViewport({ scale: 1860 / str.getViewport({ scale: 1 }).width });
    const a = Object.assign(document.createElement('canvas'), { width: Math.round(widok.width), height: Math.round(widok.height) });
    await str.render({ canvasContext: a.getContext('2d'), viewport: widok }).promise;
    const tekst = (await str.getTextContent()).items.map((i) => i.str).join('');
    const wzor = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); renderujCel(stan.projekt, stan.projekt.strony[0], { szerokoscPx: a.width, spad: true, oryginaly: true }).then((u) => { i.src = u; }); });
    const b = Object.assign(document.createElement('canvas'), { width: a.width, height: a.height });
    b.getContext('2d').drawImage(wzor, 0, 0, a.width, a.height);
    const maly = (c) => { const m = Object.assign(document.createElement('canvas'), { width: Math.round(c.width / 12), height: Math.round(c.height / 12) }); const x = m.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, m.width, m.height); return x.getImageData(0, 0, m.width, m.height); };
    const da = maly(a); const db = maly(b);
    let suma = 0; let rozne = 0; let ciemne = 0;
    for (let i = 0; i < da.data.length; i += 4) {
      const r = (Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2])) / 3;
      suma += r; if (r > 48) rozne += 1; if (db.data[i] < 235) ciemne += 1;
    }
    return { tekst, srednia: suma / (da.data.length / 4), rozne: rozne / (da.data.length / 4), ciemne, uwagi: wynik.uwagi, krzywe: wynik.krzywe || [] };
  }, [PDFJS, PDFJS_WATEK]);
  const bezOdstepow = w.tekst.replace(/\s+/g, '');
  assert.ok(bezOdstepow.includes('ŻÓŁTAŁÓDŹIMAŁAGĘŚ2027ROK'), `tekst w pliku wielkimi literami: ${w.tekst}`);
  assert.ok(bezOdstepow.includes('KAPITALIKIWWYJUSTOWANYMAKAPICIE'), w.tekst);
  assert.deepEqual([w.uwagi, w.krzywe], [[], []], 'nic nie poszło jako obraz ani jako krzywe');
  assert.ok(w.ciemne > 100, 'na stronie jest tekst');
  assert.ok(w.srednia < 2.5, `średnia różnica obrazu ${w.srednia.toFixed(3)}`);
  assert.ok(w.rozne < 0.005, `odsetek wyraźnie różnych miejsc ${(w.rozne * 100).toFixed(3)}%`);
  assert.deepEqual(bledy, []);
});
