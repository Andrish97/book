// Skład akapitu (#131): dzielenie wyrazów, spójniki, tabulatory, inicjał, oblewanie tekstem, wdowy
// i sieroty, siatka linii bazowych, style znakowe. Układ wierszy sprawdzany na żywych obiektach edytora.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const DLUGI = 'Przedsiębiorstwo telekomunikacyjne przygotowało niezapominajkowe kalendarze z przepięknymi ilustracjami i kolorowymi zakładkami dla wszystkich czytelników w całym kraju.';

// Tekst na stronie z podanymi właściwościami; zwraca opis jego wierszy.
async function tekst(strona, wlasciwosci) {
  return strona.evaluate(async ({ w, dlugi }) => {
    const { edytor } = window.seriodruk;
    await (await import('./js/dzielenie.js')).dzielenieGotowe;
    const t = edytor.dodajTekst(w.text ?? dlugi);
    t.set({ width: 60, ...w });
    t.initDimensions();
    edytor.ulozSkladStrony({ teraz: true });
    window.__t = t;
    return {
      linie: t._textLines.map((l) => ({ tekst: l.join(''), lacznik: Boolean(l.lacznik), x0: l.x0 ?? 0, w: l.w ?? null })),
      text: t.text,
    };
  }, { w: wlasciwosci, dlugi: DLUGI });
}

test('dzielenie wyrazów: łącznik na końcu wiersza, treść bez zmian, kursor trafia w te same znaki', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Skład');
  const bez = await tekst(strona, { dziel_wyrazy: false });
  const z = await tekst(strona, { dziel_wyrazy: true });
  assert.equal(z.text, bez.text, 'treść się nie zmienia');
  assert.ok(z.linie.some((l) => l.lacznik), 'co najmniej jeden wiersz kończy się łącznikiem');
  assert.ok(!bez.linie.some((l) => l.lacznik));
  // Każdy podział w środku słowa jest w miejscu dozwolonym przez wzorce (np. „przed|się|bior|stwo”).
  for (const l of z.linie.filter((x) => x.lacznik)) assert.match(l.tekst, /\p{L}{2,}$/u);
  // Wiersze z łącznikiem nie tracą znaków: suma długości + usunięte spacje = długość tekstu.
  const zgodnosc = await strona.evaluate(() => {
    const o = window.__t;
    let i = 0;
    for (let w = 0; w < o._textLines.length; w += 1) i += o._textLines[w].length + o.missingNewlineOffset(w);
    const koniec = o.get2DCursorLocation(o.text.length);
    const z = o.get2DCursorLocation(o.text.indexOf('ilustracjami') + 3);
    return { suma: i - 1, dlugosc: o.text.length, ostatni: koniec.lineIndex === o._textLines.length - 1, znak: o._textLines[z.lineIndex][z.charIndex] };
  });
  assert.equal(zgodnosc.suma, zgodnosc.dlugosc);
  assert.ok(zgodnosc.ostatni);
  assert.equal(zgodnosc.znak, 's', 'kursor wskazuje właściwą literę także za podzielonym wierszem');
  // Węższe wiersze niż bez dzielenia: mniej wierszy albo tyle samo.
  assert.ok(z.linie.length <= bez.linie.length);
  assert.deepEqual(bledy, []);
});

test('spójniki: jednoliterowe nie zostają na końcu wiersza; wyłączone – mogą', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Spójniki');
  const text = 'Mama i tata w domu z dziećmi o świcie a potem u babci i w ogrodzie z psem w cieniu a dalej o zmroku z latarką i w ciszy.';
  for (const szer of [30, 38, 45, 52, 61]) {
    const z = await tekst(strona, { text, width: szer, spojniki: true });
    for (const l of z.linie.slice(0, -1)) assert.doesNotMatch(l.tekst, /(^|\s)[aiouwzAIOUWZ]$/u, `wiersz „${l.tekst}” (szerokość ${szer})`);
  }
  let byl = false;
  for (const szer of [30, 38, 45, 52, 61]) {
    const z = await tekst(strona, { text, width: szer, spojniki: undefined });
    if (z.linie.slice(0, -1).some((l) => /\s[aiouwz]$/u.test(l.tekst))) byl = true;
  }
  assert.ok(byl, 'bez ustawienia spójnik zostaje czasem na końcu wiersza');
  assert.deepEqual(bledy, []);
});

test('tabulatory: tekst za tabulatorem w ustawionych pozycjach (lewy, prawy z kropkami, domyślny co 12,5 mm)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tabulatory');
  const wynik = await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    const o = edytor.dodajTekst('Data\tGodzina\tSala\nA\tB');
    o.set({ width: 100, tabulatory: [{ poz: 30, rodzaj: 'lewy' }, { poz: 90, rodzaj: 'prawy', wypelniacz: '.' }] });
    o.initDimensions();
    const x = (w, z) => o.__charBounds[w][z].left;
    o.getLineWidth(0); o.getLineWidth(1);
    const g = o.__charBounds[0];
    const kon = (w, z) => o.__charBounds[w][z].left + o.__charBounds[w][z].kernedWidth;
    return { godzina: x(0, 5), sala: kon(0, 16), b: x(1, 2), tab: g[4].tab?.poz };
  });
  assert.ok(Math.abs(wynik.godzina - 30) < 0.2, `„Godzina” od 30 mm (${wynik.godzina})`);
  assert.ok(Math.abs(wynik.sala - 90) < 0.3, `„Sala” kończy się na 90 mm (${wynik.sala})`);
  assert.ok(Math.abs(wynik.b - 30) < 0.2, 'drugi akapit też');
  assert.equal(wynik.tab, 30);
  // Tab w pisanym tekście wstawia znak tabulacji.
  await strona.evaluate(() => {
    const o = window.seriodruk.edytor.dodajTekst('AB');
    window.seriodruk.edytor.canvas.setActiveObject(o);
    o.enterEditing();
    o.selectionStart = 1; o.selectionEnd = 1;
    o.hiddenTextarea.selectionStart = 1; o.hiddenTextarea.selectionEnd = 1;
    window.__o = o;
  });
  await strona.keyboard.press('Tab');
  assert.equal(await strona.evaluate(() => window.__o.text), 'A\tB');
  assert.deepEqual(bledy, []);
});

test('inicjał: pierwsza litera na 3 wiersze, trzy pierwsze wiersze odsunięte, litera nie zajmuje miejsca w wierszu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Inicjał');
  const z = await tekst(strona, { inicjal: 3, width: 80 });
  assert.ok(z.linie[0].x0 > 3 && z.linie[1].x0 > 3 && z.linie[2].x0 > 3, JSON.stringify(z.linie.slice(0, 4)));
  assert.equal(z.linie[3].x0, 0);
  const geo = await strona.evaluate(() => ({ szer: window.__t.__charBounds[0][0].width, g: window.__t._inicjal }));
  assert.equal(geo.szer, 0);
  assert.equal(geo.g.litera, 'P');
  assert.ok(geo.g.rozmiar > geo.g.n, 'inicjał większy niż tekst');
  assert.deepEqual(bledy, []);
});

test('oblewanie: tekst opływa prostokąt, przeskakuje pod element; „Nie opływaj” wyłącza', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Oblewanie');
  const wynik = await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    const o = edytor.dodajTekst(`${'Słowo '.repeat(120)}koniec.`);
    o.set({ left: 20, top: 30, width: 100 });
    o.initDimensions();
    const r = edytor.dodajProstokat();
    r.set({ left: 80, top: 40, width: 40, height: 25, oblewanie: 'prostokat', oblewanie_odstep: 2 });
    r.setCoords();
    edytor.ulozSkladStrony({ teraz: true });
    const obok = o._textLines.filter((l) => l.w !== undefined).map((l) => [l.x0, l.w]);
    r.set('oblewanie', 'skok');
    edytor.ulozSkladStrony({ teraz: true });
    const skok = o._textLines.reduce((s, l) => s + (l.odstepPo || 0), 0) + (o._odstepGory || 0);
    o.set('bez_oblewania', true);
    edytor.ulozSkladStrony({ teraz: true });
    return { obok, skok, bez: o._textLines.filter((l) => l.w !== undefined).length };
  });
  assert.ok(wynik.obok.length >= 3, 'kilka wierszy obok prostokąta');
  for (const [x0, w] of wynik.obok) assert.ok(x0 === 0 && w < 60, `wiersz po lewej stronie prostokąta (${x0}, ${w})`);
  assert.ok(wynik.skok >= 25, `skok pod prostokąt (${wynik.skok} mm)`);
  assert.equal(wynik.bez, 0);
  assert.deepEqual(bledy, []);
});

test('wdowy i sieroty: akapit przecięty granicą ramek zostawia po obu stronach co najmniej 2 wiersze', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wdowy');
  const wynik = await strona.evaluate(async () => {
    const { poprawWdowy } = await import('./js/sklad.js');
    const { edytor } = window.seriodruk;
    const o = edytor.dodajTekst(`Krótki akapit.\n${'Długi akapit z wieloma słowami do łamania. '.repeat(4)}`);
    o.set({ width: 50 });
    o.initDimensions();
    const linie = o._textLines.length;
    const akapit = (i) => o._styleMap[i].line;
    o.wdowy = 2;
    // Granica po pierwszym wierszu drugiego akapitu (sierota) i przed jego ostatnim wierszem (wdowa).
    const pierwszyDrugiego = o._textLines.findIndex((_, i) => akapit(i) === 1);
    return {
      sierota: poprawWdowy(o, pierwszyDrugiego + 1), pierwszyDrugiego,
      wdowa: poprawWdowy(o, linie - 1), linie,
      bez: (() => { o.wdowy = 0; return poprawWdowy(o, linie - 1); })(),
    };
  });
  assert.equal(wynik.sierota, wynik.pierwszyDrugiego, 'pierwszy wiersz akapitu idzie razem z resztą do następnej ramki');
  assert.equal(wynik.wdowa, wynik.linie - 2, 'ostatni wiersz akapitu nie zostaje sam w następnej ramce');
  assert.equal(wynik.bez, wynik.linie - 1);
  assert.deepEqual(bledy, []);
});

test('siatka linii bazowych: wiersze tekstu z „Wyrównaj do siatki” stoją na liniach siatki sekcji', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Siatka');
  const wynik = await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    edytor.wydruk.siatka_bazowa = { odstep: 6, przesuniecie: 12 };
    const o = edytor.dodajTekst('Pierwszy wiersz\nDrugi\nTrzeci akapit');
    o.set({ top: 17.3, lineHeight: 1.1, do_siatki: true });
    edytor.ulozSkladStrony({ teraz: true });
    const bazowe = [];
    let y = o._odstepGory || 0;
    for (let i = 0; i < o._textLines.length; i += 1) {
      bazowe.push(o.top + y + o.getHeightOfLineImpl(i) * (1 - o._fontSizeFraction));
      y += o.getHeightOfLine(i);
    }
    return bazowe.map((b) => ((b - 12) % 6 + 6) % 6);
  });
  for (const r of wynik) assert.ok(r < 0.01 || r > 5.99, `linia bazowa na siatce (reszta ${r})`);
  assert.deepEqual(bledy, []);
});

test('style: skład zapisuje się w stylu akapitu; styl znakowy zmienia wszystkie fragmenty z tym stylem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Style');
  const wynik = await strona.evaluate(async () => {
    const S = await import('./js/style-tekstu.js');
    const { edytor } = window.seriodruk;
    const o = edytor.dodajTekst('Jeden dwa trzy');
    o.set({ dziel_wyrazy: true, wdowy: 3 });
    const st = S.stylZObiektu(o, 'Książka');
    const inny = edytor.dodajTekst('Inny tekst');
    S.zastosujStyl(inny, st);
    const zStylu = { dziel: inny.dziel_wyrazy, wdowy: inny.wdowy, inicjal: inny.inicjal };
    const znak = S.stylZnakowyZFragmentu({ fontWeight: 'bold', fill: '#cc0000' }, 'Wyróżnienie');
    S.zastosujStylZnakowy(o, znak, 0, 5);
    const projekt = { strony: [{ obiekty: [o.toObject()] }], wzorce: [] };
    znak.fill = '#0000ff';
    const n = S.zastosujStylZnakowyWProjekcie(projekt, znak);
    const zapis = projekt.strony[0].obiekty[0].styles;
    return { zStylu, n, kolory: zapis.map((s) => s.style.fill), id: zapis[0].style.styl_znakowy === znak.id };
  });
  assert.deepEqual(wynik.zStylu, { dziel: true, wdowy: 3, inicjal: undefined });
  assert.equal(wynik.n, 1);
  assert.ok(wynik.kolory.every((k) => k === '#0000ff'), JSON.stringify(wynik.kolory));
  assert.ok(wynik.id);
  assert.deepEqual(bledy, []);
});

test('PDF: tekst z dzieleniem, inicjałem i tabulatorami z kropkami zostaje wektorowy (bez zamiany na obraz)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'PDF');
  const wynik = await strona.evaluate(async (dlugi) => {
    const { edytor, stan } = window.seriodruk;
    await (await import('./js/dzielenie.js')).dzielenieGotowe;
    const a = edytor.dodajTekst(dlugi);
    a.set({ width: 60, dziel_wyrazy: true, inicjal: 3, textAlign: 'justify' });
    const b = edytor.dodajTekst('Styczeń\t12\nLuty\t7');
    b.set({ top: 120, width: 80, tabulatory: [{ poz: 70, rodzaj: 'prawy', wypelniacz: '.' }] });
    (await import('./js/app/zapis.js')).zapiszBiezacyCel();
    const { zlozPdf, wybierzEgzemplarze } = await import('./js/eksport.js');
    const { rozwin } = await import('./js/serie.js');
    const ciag = rozwin(stan.projekt);
    const uwagi = new Map();
    const blob = await zlozPdf(stan.projekt, wybierzEgzemplarze(ciag), { uwagi, ciag });
    return { rozmiar: blob.size, uwagi: [...uwagi] };
  }, DLUGI);
  assert.ok(wynik.rozmiar > 1000);
  assert.deepEqual(wynik.uwagi, [], 'żaden element nie trafił do PDF jako obraz');
  assert.deepEqual(bledy, []);
});
