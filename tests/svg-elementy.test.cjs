const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Obraz strony (bez uchwytów zaznaczenia) jako piksele na białym tle.
const obrazStrony = (strona) => strona.evaluate(() => {
  const c = window.seriodruk.edytor.canvas;
  c.discardActiveObject();
  c.renderAll();
  const el = c.toCanvasElement(1);
  const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
  const wynik = [];
  for (let i = 0; i < d.length; i += 4) wynik.push(Math.round((d[i] + d[i + 1] + d[i + 2]) / 3 * (d[i + 3] / 255) + 255 - d[i + 3]));
  return wynik;
});
const roznica = (a, b) => {
  assert.equal(a.length, b.length);
  let suma = 0; let rozne = 0;
  for (let i = 0; i < a.length; i += 1) { const r = Math.abs(a[i] - b[i]); suma += r; if (r > 80) rozne += 1; }
  return { srednia: suma / a.length, rozne: rozne / a.length };
};
const zaznacz = (strona, nazwa) => strona.evaluate((n) => {
  const e = window.seriodruk.edytor;
  e.canvas.setActiveObject(e.canvas.getObjects().find((o) => o.nazwa === n && !o.zWzorca));
  e._emitujZaznaczenie();
}, nazwa);
const rozloz = async (strona, nazwa) => {
  await zaznacz(strona, nazwa);
  await strona.click('#wlasciwosci button:has-text("Rozłóż rysunek na elementy")');
  await strona.waitForFunction((n) => window.seriodruk.edytor.canvas.getObjects().every((o) => !(o.type === 'image' && o.nazwa === n)), nazwa);
  await strona.waitForTimeout(400); // krok historii powstaje chwilę po zmianie
};
const ADRES = '(kod) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(kod)))}`';

test('Rysunek SVG rozkłada się na grupę zwykłych kształtów w tym samym miejscu; grupę da się rozgrupować, a zmianę cofnąć', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Rysunek 1');
  await strona.evaluate(async (adresKod) => {
    const { stan, edytor } = window.seriodruk;
    const adres = eval(adresKod); // eslint-disable-line no-eval
    // Przesunięty viewBox, grupa z przekształceniem, gradient, obrys kreskowany, krzywa, koło, wielokąt i łamana.
    const rysunek = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="10 20 300 150">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#ef476f"/></linearGradient></defs>
      <rect x="10" y="20" width="300" height="150" fill="#e8f1ff"/>
      <rect x="30" y="40" width="120" height="60" rx="10" fill="url(#g)" stroke="#073b4c" stroke-width="5"/>
      <g transform="translate(220 95) rotate(20)"><ellipse cx="0" cy="0" rx="60" ry="35" fill="#06d6a0"/><polygon points="-20,-15 25,0 -20,15" fill="#ffffff" stroke="#333" stroke-width="2"/></g>
      <path d="M30 150 C 90 90, 150 190, 290 120" fill="none" stroke="#d00000" stroke-width="6" stroke-linecap="round"/>
      <circle cx="285" cy="45" r="15" fill="#118ab2" fill-opacity="0.6"/>
      <polyline points="40,120 70,135 100,115 130,140" fill="none" stroke="#5a189a" stroke-width="3" stroke-dasharray="8 4"/>
      <line x1="170" y1="35" x2="250" y2="35" stroke="#000" stroke-width="4"/>
    </svg>`;
    const a = await edytor.dodajObraz(adres(rysunek), 'prosty.svg', stan.projekt.zasoby);
    a.set({ left: 20, top: 25, scaleX: 0.2, scaleY: 0.2 });
    const b = await edytor.dodajObraz(adres(rysunek), 'krzywy.svg', stan.projekt.zasoby);
    b.set({ left: 30, top: 90, scaleX: 0.2, scaleY: 0.2, angle: -12, flipX: true });
    for (const o of [a, b]) o.setCoords();
    edytor.zatwierdz();
  }, ADRES);
  const przed = await obrazStrony(strona);
  await rozloz(strona, 'prosty.svg');
  const opis = await strona.evaluate(() => {
    const g = window.seriodruk.edytor.aktywny;
    return { typ: g.type, nazwa: g.nazwa, typy: g.getObjects().map((o) => o.type), id: g.getObjects().every((o) => /^o/.test(o.id)), kat: g.angle, skala: [g.scaleX, g.scaleY],
      prostokat: (() => { const r = g.getObjects()[1]; return [r.width, r.height, r.rx, r.strokeWidth, r.scaleX, r.strokeUniform]; })(),
      kreski: g.getObjects().find((o) => o.strokeDashArray)?.strokeDashArray };
  });
  assert.equal(opis.typ, 'group');
  assert.equal(opis.nazwa, 'prosty.svg');
  // Koło staje się elipsą, a wielokąt i łamana kształtami z punktami – takimi, jakie edytor zna.
  assert.deepEqual(opis.typy, ['rect', 'rect', 'ellipse', 'path', 'path', 'ellipse', 'path', 'line']);
  assert.ok(opis.id, 'każdy element ma identyfikator');
  assert.deepEqual([opis.kat, ...opis.skala], [0, 1, 1]);
  // Prostokąt ma wymiary i grubość obrysu wprost w milimetrach (rysunek 300 jednostek = 60 mm, czyli 0,2 mm na jednostkę).
  assert.deepEqual(opis.prostokat.map((v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)), [24, 12, 2, 1, 1, true]);
  assert.deepEqual(opis.kreski.map((v) => Math.round(v * 1000) / 1000), [1.6, 0.8]);
  assert.match(await strona.textContent('#powiadomienie'), /^Rysunek rozłożony na 8 elementów w grupie\. Ctrl\+Z przywraca obraz\.$/);
  await rozloz(strona, 'krzywy.svg');
  const kat = await strona.evaluate(() => { const g = window.seriodruk.edytor.aktywny; return [Math.round(g.angle), g.flipX]; });
  assert.deepEqual(kat, [-12, true], 'grupa przejmuje obrót i odbicie obrazu');
  const po = await obrazStrony(strona);
  const r = roznica(przed, po);
  assert.ok(r.srednia < 0.6, `średnia różnica obrazu ${r.srednia.toFixed(3)}`);
  assert.ok(r.rozne < 0.003, `odsetek wyraźnie różnych miejsc ${(r.rozne * 100).toFixed(3)}%`);

  // Rozgrupowanie: elementy stoją osobno w tym samym miejscu.
  await zaznacz(strona, 'prosty.svg');
  await strona.click('#wlasciwosci button:has-text("Rozgrupuj")');
  const osobno = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => !o.zWzorca).map((o) => o.type));
  // Elementy stają w kolejności tam, gdzie była grupa – druga grupa zostaje nad nimi.
  assert.deepEqual(osobno, ['rect', 'rect', 'ellipse', 'path', 'path', 'ellipse', 'path', 'line', 'group']);
  await strona.waitForTimeout(400);
  const r2 = roznica(przed, await obrazStrony(strona));
  assert.ok(r2.srednia < 0.6 && r2.rozne < 0.003, `po rozgrupowaniu: ${r2.srednia.toFixed(3)}, ${(r2.rozne * 100).toFixed(3)}%`);
  // Cofnięcie trzech kroków przywraca oba obrazy.
  for (const zostaje of [['group', 'group'], ['group', 'image'], ['image', 'image']]) {
    await strona.click('[data-akcja="cofnij"]');
    await strona.waitForFunction((typy) => JSON.stringify(window.seriodruk.edytor.canvas.getObjects().filter((o) => !o.zWzorca).map((o) => o.type).sort()) === JSON.stringify(typy), zostaje);
  }
  const r3 = roznica(przed, await obrazStrony(strona));
  assert.ok(r3.srednia < 0.05, `po cofnięciu: ${r3.srednia.toFixed(3)}`);
  assert.deepEqual(bledy, []);
});

test('Napisy z rysunku SVG stają się ramkami tekstu: czcionka z zestawu zostaje, nieznaną zastępuje domyślna; zapis i ponowne otwarcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Rysunek 2');
  // Plik wstawiony tak, jak robi to użytkownik; przy wstawianiu aplikacja uprzedza o napisach.
  const rysunek = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
    <rect width="400" height="200" fill="#fff8e1"/>
    <text x="200" y="60" text-anchor="middle" font-family="'Lora', serif" font-size="32" font-weight="bold" fill="#7b2d26">Żółta łódź</text>
    <text x="380" y="120" text-anchor="end" font-family="Czcionka Nieznana" font-size="20" font-style="italic" fill="#333">do prawej</text>
    <g font-family="Bebas Neue"><text x="20" y="170" font-size="24" font-weight="700">Od lewej</text></g>
  </svg>`;
  await strona.setInputFiles('#plik-obraz', { name: 'napisy.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(rysunek) });
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'image');
  await strona.waitForFunction(() => /^Rysunek ma napisy – jako obraz pokaże je czcionką zastępczą\. „Rozłóż rysunek na elementy”/.test(document.querySelector('#powiadomienie').textContent));
  await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    const a = edytor.aktywny;
    // Rysunek ma po wstawieniu 1200 pikseli szerokości; na stronie 100 mm, czyli 0,25 mm na jednostkę rysunku.
    a.set({ left: 10, top: 30, scaleX: 100 / a.width, scaleY: 100 / a.width });
    a.setCoords();
    edytor.zatwierdz();
  });
  await rozloz(strona, 'napisy.svg');
  assert.match(await strona.textContent('#powiadomienie'), /^Rysunek rozłożony na 4 elementy w grupie\. Czcionki spoza zestawu \(Czcionka Nieznana\) zastąpiła domyślna\. Ctrl\+Z przywraca obraz\.$/);
  const napisy = () => strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const lista = [];
    const zbierz = (obiekty) => { for (const o of obiekty) { if (o.type === 'textbox') lista.push(o); else if (o._objects) zbierz(o._objects); } };
    zbierz(e.canvas.getObjects().filter((o) => !o.zWzorca));
    return lista.map((o) => {
      const r = o.getBoundingRect();
      return { tekst: o.text, czcionka: o.fontFamily, rozmiar: Math.round(o.fontSize * 100) / 100, gruba: o.fontWeight, styl: o.fontStyle, wyrownanie: o.textAlign, skala: [o.scaleX, o.scaleY],
        wiersze: o._textLines.length, lewo: r.left, prawo: r.left + r.width, gora: r.top, dol: r.top + r.height, zaladowana: document.fonts.check(`${o.fontSize}px "${o.fontFamily}"`) };
    });
  });
  const blisko = (a, b, tol, opis) => assert.ok(Math.abs(a - b) <= tol, `${opis}: ${a} wobec ${b}`);
  let n = await napisy();
  assert.deepEqual(n.map((x) => [x.tekst, x.czcionka, x.rozmiar, x.gruba, x.styl, x.wyrownanie, x.wiersze, x.zaladowana]), [
    ['Żółta łódź', 'Lora', 8, 'bold', 'normal', 'center', 1, true],
    ['do prawej', 'Inter', 5, 'normal', 'italic', 'right', 1, true],
    ['Od lewej', 'Bebas Neue', 6, 'normal', 'normal', 'left', 1, true], // Bebas Neue nie ma odmiany pogrubionej
  ]);
  for (const x of n) assert.deepEqual(x.skala, [1, 1], 'rozmiar pisma jest prawdziwy, bez skali');
  // Położenie: punkt zaczepienia wiersza (środek, prawy brzeg, lewy brzeg) i linia pisma jak w rysunku (0,25 mm na jednostkę).
  blisko((n[0].lewo + n[0].prawo) / 2, 10 + 200 * 0.25, 0.15, 'środek pierwszego napisu');
  blisko(n[1].prawo, 10 + 380 * 0.25, 0.3, 'prawy brzeg drugiego napisu');
  blisko(n[2].lewo, 10 + 20 * 0.25, 0.3, 'lewy brzeg trzeciego napisu');
  const linie = [60, 120, 170].map((y) => 30 + y * 0.25);
  n.forEach((x, i) => assert.ok(linie[i] > x.gora + (x.dol - x.gora) * 0.55 && linie[i] < x.dol, `linia pisma napisu ${i + 1}: ${linie[i]} w ${x.gora}–${x.dol}`));

  // Po rozgrupowaniu napis jest zwykłą ramką tekstu: da się go poprawić.
  await strona.click('#wlasciwosci button:has-text("Rozgrupuj")');
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const tb = e.canvas.getObjects().find((o) => o.type === 'textbox' && o.text === 'Od lewej');
    tb.set('text', 'Od lewej, poprawione');
    e.zatwierdz();
  });
  // Zapis i ponowne wczytanie strony.
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  n = await napisy();
  assert.deepEqual(n.map((x) => [x.tekst, x.czcionka]), [['Żółta łódź', 'Lora'], ['do prawej', 'Inter'], ['Od lewej, poprawione', 'Bebas Neue']]);
  blisko((n[0].lewo + n[0].prawo) / 2, 60, 0.15, 'środek pierwszego napisu po wczytaniu');
  // W PDF wektorowym rozłożony rysunek to zwykłe kształty i prawdziwy tekst: nic nie idzie jako obraz ani jako krzywe.
  const pdf = await strona.evaluate(async () => {
    const { eksportujPdf } = await import('./js/eksport.js');
    const w = await eksportujPdf(window.seriodruk.stan.projekt, { znaki: false, spad: true });
    return { uwagi: w.uwagi, krzywe: w.krzywe, rozmiar: w.blob.size };
  });
  assert.deepEqual([pdf.uwagi, pdf.krzywe], [[], []]);
  assert.ok(pdf.rozmiar > 2000);
  assert.deepEqual(bledy, []);
});

test('Rozkładanie rysunku SVG: uwagi o przycięciu i o rzeczach, których edytor nie ma; rysunek ze zdjęciem zostaje obrazem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Rysunek 3');
  await strona.evaluate(async (adresKod) => {
    const { stan, edytor } = window.seriodruk;
    const adres = eval(adresKod); // eslint-disable-line no-eval
    const dwa = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect x="10" y="10" width="80" height="80" fill="#2a9d8f"/><rect x="110" y="10" width="80" height="80" fill="#e76f51"/></svg>';
    const zFiltrem = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><defs><filter id="f"><feGaussianBlur stdDeviation="4"/></filter></defs><rect x="20" y="15" width="80" height="50" fill="#8338ec" filter="url(#f)"/></svg>';
    const zeZdjeciem = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><image href="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" width="40" height="40"/></svg>';
    const a = await edytor.dodajObraz(adres(dwa), 'przyciety.svg', stan.projekt.zasoby);
    // Widać tylko prawą połowę rysunku.
    a.set({ left: 50, top: 20, scaleX: 0.5, scaleY: 0.5, cropX: 100, width: 100 });
    const b = await edytor.dodajObraz(adres(zFiltrem), 'filtr.svg', stan.projekt.zasoby);
    b.set({ left: 20, top: 100, scaleX: 0.5, scaleY: 0.5 });
    const c = await edytor.dodajObraz(adres(zeZdjeciem), 'zdjecie.svg', stan.projekt.zasoby);
    c.set({ left: 20, top: 180, scaleX: 0.5, scaleY: 0.5 });
    for (const o of [a, b, c]) o.setCoords();
    edytor.zatwierdz();
  }, ADRES);
  await rozloz(strona, 'przyciety.svg');
  assert.match(await strona.textContent('#powiadomienie'), /^Rysunek rozłożony na 2 elementy w grupie\. Obraz był przycięty – po rozłożeniu widać cały rysunek\. Ctrl\+Z przywraca obraz\.$/);
  // Prawy kwadrat (ten, który było widać) zostaje w miejscu: w rysunku x=110, obraz zaczynał się od x=100 w punkcie 50 mm.
  const prawy = await strona.evaluate(() => { const g = window.seriodruk.edytor.aktywny; const r = g.getObjects()[1].getBoundingRect(); return [r.left, r.top, r.width]; });
  assert.deepEqual(prawy.map((v) => Math.round(v * 100) / 100), [55, 25, 40]);
  await rozloz(strona, 'filtr.svg');
  assert.match(await strona.textContent('#powiadomienie'), /Rysunek używa elementu „filter”, którego edytor nie ma – wygląd mógł się zmienić\. Ctrl\+Z przywraca obraz\.$/);
  await zaznacz(strona, 'zdjecie.svg');
  await strona.click('#wlasciwosci button:has-text("Rozłóż rysunek na elementy")');
  await strona.waitForFunction(() => /wstawione zdjęcia/.test(document.querySelector('#powiadomienie').textContent));
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.type), 'image');
  // Zwykłe zdjęcie nie ma tego przycisku.
  await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const p = Object.assign(document.createElement('canvas'), { width: 20, height: 20 });
    p.getContext('2d').fillRect(0, 0, 20, 20);
    await edytor.dodajObraz(p.toDataURL('image/png'), 'zdjecie.png', stan.projekt.zasoby);
    edytor._emitujZaznaczenie();
  });
  assert.equal(await strona.locator('#wlasciwosci button:has-text("Rozłóż rysunek na elementy")').count(), 0);
  assert.deepEqual(bledy, []);
});
