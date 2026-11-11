const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('obraz z danych: kadr z kolumny osobno dla każdego wiersza – słowa, procenty, pusta wartość; panel, zmiana nazwy kolumny, nieznana kolumna', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kadr z kolumny');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz, edytor } = window.seriodruk;
    const { kadrZWartosci } = await import('./js/pola.js');
    const p = stan.projekt;
    // Zdjęcie pionowe 100 × 300: góra czerwona, środek zielony, dół niebieski.
    const c = Object.assign(document.createElement('canvas'), { width: 100, height: 300 });
    const x = c.getContext('2d');
    ['#ff0000', '#00ff00', '#0000ff'].forEach((k, i) => { x.fillStyle = k; x.fillRect(0, i * 100, 100, 100); });
    const wzor = await edytor.dodajObraz(c.toDataURL('image/png'), 'pasy.png', p.zasoby);
    wzor.set({ left: 20, top: 20, scaleX: 0.6, scaleY: 0.2 }); // ramka 60 × 60 mm
    edytor.zatwierdz();
    await zapiszTeraz();
    const kadry = ['góra', 'DOL', '', '50% 100%', 'bottom', 'bzdura', '0 0', 'środek'];
    p.tabele.push({ id: 't1', nazwa: 'Dane', kolumny: ['plik', 'kadr'], wiersze: kadry.map((k) => ['pasy.png', k]) });
    p.serie.push({ id: 'se1', nazwa: 'S', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    const obraz = p.strony[0].obiekty[0];
    const { rozwin } = await import('./js/serie.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const kolory = async (pole) => {
      obraz.pole = pole;
      const ciag = rozwin(p);
      const wynik = [];
      for (const egz of ciag.egzemplarze) {
        const img = new Image();
        await new Promise(async (ok) => { img.onload = ok; img.src = await renderujCel(p, egz, { szerokoscPx: 148, spad: false, ciag }); });
        const k = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
        const y = k.getContext('2d'); y.drawImage(img, 0, 0);
        wynik.push({ '255,0,0': 'góra', '0,255,0': 'środek', '0,0,255': 'dół' }[[...y.getImageData(50, 50, 1, 1).data].slice(0, 3).join(',')]);
      }
      return wynik;
    };
    const wynik = {
      zKolumny: await kolory({ kolumna: 'plik', tryb: 'wypelnij', kadr_z: 'kadr' }),
      zKolumnyNaWzorzeDol: await kolory({ kolumna: 'plik', tryb: 'wypelnij', kadr: 'dol', kadr_z: 'kadr' }),
      wartosci: ['Góra', 'gora lewa', 'top right', ' 30% 20% ', '25', '12,5%;80', 'center', 'prawo', 'x', '10 20 30', '-5 10', ''].map((v) => kadrZWartosci(v)),
    };
    obraz.pole = { kolumna: 'plik', tryb: 'wypelnij' };
    await window.seriodruk.przeladuj();
    return wynik;
  });
  // Kwadratowa ramka pokazuje jedną trzecią pionowego zdjęcia. Pusta i niezrozumiała wartość zostawiają ustawienie wzoru.
  assert.deepEqual(w.zKolumny, ['góra', 'dół', 'środek', 'dół', 'dół', 'środek', 'góra', 'środek']);
  assert.deepEqual(w.zKolumnyNaWzorzeDol, ['góra', 'dół', 'dół', 'dół', 'dół', 'dół', 'góra', 'środek']);
  assert.deepEqual(w.wartosci, [
    { x: 0.5, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.3, y: 0.2 }, { x: 0.25, y: 0.5 }, { x: 0.125, y: 0.8 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }, null, null, null, null,
  ]);

  // Panel obrazu: „Kadr z kolumny” jest przy wypełnianiu ramki; kolumna z nazwą pliku nie jest na liście.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.type === 'image').id); });
  assert.deepEqual(await strona.locator('.wlasciwosci label:has-text("Kadr z kolumny") select option').evaluateAll((l) => l.map((o) => o.value)), ['', 'kadr']);
  await strona.selectOption('.wlasciwosci label:has-text("Kadr z kolumny") select', 'kadr');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty[0].pole), { kolumna: 'plik', tryb: 'wypelnij', kadr_z: 'kadr' });
  assert.match(await strona.textContent('.wlasciwosci'), /punkt zdjęcia w procentach od lewej i od góry/);

  // Zmiana nazwy kolumny poprawia ustawienie obrazu; kolumna, której nie ma, trafia do ostrzeżeń i do kontroli.
  const po = await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const p = stan.projekt;
    const { zmienNazwePola } = await import('./js/tabele.js');
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const ile = zmienNazwePola(p, 'kadr', 'czesc');
    const poZmianie = { ...p.strony[0].obiekty[0].pole };
    await window.seriodruk.przeladuj();
    return {
      ile, poZmianie,
      uwagi: sprawdzProjekt(p).filter((u) => u.rodzaj === 'nieznane_pole').map((u) => u.opis.replace(/ – .*/, '')),
      ostrzezenia: edytor.ostrzezenia.filter((o) => o.typ === 'nieznane_pole').map((o) => o.pola),
    };
  });
  assert.equal(po.ile, 1);
  assert.deepEqual(po.poZmianie, { kolumna: 'plik', tryb: 'wypelnij', kadr_z: 'czesc' });
  assert.deepEqual(po.uwagi, ['Pole {czesc} nie ma skąd wziąć wartości (nie ma takiej kolumny ani pola dokumentu)']);
  assert.deepEqual(po.ostrzezenia, [['czesc']]);
  assert.deepEqual(bledy, []);
});

test('kolor z danych w wypełnieniu przejściem kolorów: pierwszy albo ostatni kolor, odcienie, całe wypełnienie; starszy zapis bez zmian; panel', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Gradient');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    p.tabele.push({ id: 't1', nazwa: 'Kolory', kolumny: ['kolor'], wiersze: [['#00ff00'], ['']] });
    p.serie.push({ id: 'se1', nazwa: 'S', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    // Przejście poziome od czerwonego do niebieskiego (przystanki zapisane nie po kolei), przez ciemną czerwień w środku.
    const przejscie = () => ({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 1, y2: 0 }, colorStops: [{ offset: 1, color: '#0000ff' }, { offset: 0, color: '#ff0000' }, { offset: 0.5, color: 'rgba(128,0,0,0.5)' }] });
    const kwadrat = (id, top, kolorW) => ({ type: 'rect', version: '5.3.0', left: 20, top, width: 100, height: 20, strokeWidth: 0, fill: przejscie(), id, z_danych: { kolor: 'kolor', ...(kolorW ? { kolor_w: kolorW } : {}) } });
    p.strony[0].obiekty = [
      kwadrat('pierwszy', 10, 'pierwszy'), kwadrat('ostatni', 40, 'ostatni'), kwadrat('odcienie', 70, 'odcienie'), kwadrat('stary', 100, ''),
      { type: 'group', version: '5.3.0', left: 20, top: 130, width: 100, height: 20, id: 'grupa', z_danych: { kolor: 'kolor', kolor_w: 'pierwszy' }, objects: [
        { type: 'rect', left: -50, top: -10, width: 50, height: 20, strokeWidth: 0, fill: przejscie(), id: 'g1' },
        { type: 'rect', left: 0, top: -10, width: 50, height: 20, strokeWidth: 0, fill: '#888888', id: 'g2' },
      ] },
    ];
    await window.seriodruk.przeladuj();
    const { rozwin, wartosciPol } = await import('./js/serie.js');
    const { podstawWObiektach, przystankiZKolorem } = await import('./js/pola.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const ciag = rozwin(p);
    const kolory = (egz) => Object.fromEntries(podstawWObiektach(p.strony[0].obiekty, wartosciPol(p, egz, ciag)).map((o) => {
      const opis = (f) => (typeof f === 'string' ? f : f.colorStops.slice().sort((a, b) => a.offset - b.offset).map((s) => s.color).join(' → '));
      return [o.id, o.objects ? o.objects.map((x) => opis(x.fill)) : opis(o.fill)];
    }));
    // Obraz pierwszej strony: lewy i prawy koniec każdego paska (strona 148 mm = 444 piksele).
    const img = new Image();
    await new Promise(async (ok) => { img.onload = ok; img.src = await renderujCel(p, ciag.egzemplarze[0], { szerokoscPx: 444, spad: false, ciag }); });
    const k = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const y = k.getContext('2d'); y.drawImage(img, 0, 0);
    const piksel = (mmX, mmY) => [...y.getImageData(mmX * 3, mmY * 3, 1, 1).data].slice(0, 3);
    return {
      zKolorem: kolory(ciag.egzemplarze[0]), bezKoloru: kolory(ciag.egzemplarze[1]),
      obraz: { pierwszy: [piksel(21, 20), piksel(119, 20)], ostatni: [piksel(21, 50), piksel(119, 50)], stary: [piksel(21, 110), piksel(119, 110)] },
      jasniejsze: przystankiZKolorem([{ offset: 0, color: '#804040' }, { offset: 1, color: '#c08080' }], 'navy', 'odcienie').map((s) => s.color),
    };
  });
  assert.deepEqual(w.zKolorem, {
    pierwszy: '#00ff00 → rgba(128,0,0,0.5) → #0000ff',
    ostatni: '#ff0000 → rgba(128,0,0,0.5) → #00ff00',
    // Odcienie: pierwszy kolor to kolor z danych, środkowy jest ciemniejszy (jak we wzorze) i zachowuje przezroczystość.
    odcienie: '#00ff00 → rgba(0,128,0,0.5) → #00ff00',
    stary: '#00ff00', // bez ustawienia (starszy zapis) kolor zastępuje całe wypełnienie
    grupa: ['#00ff00 → rgba(128,0,0,0.5) → #0000ff', '#00ff00'],
  });
  // Pusta wartość zostawia wzór.
  assert.equal(w.bezKoloru.pierwszy, '#ff0000 → rgba(128,0,0,0.5) → #0000ff');
  assert.equal(w.bezKoloru.stary, '#ff0000 → rgba(128,0,0,0.5) → #0000ff');
  const blisko = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 12);
  assert.ok(blisko(w.obraz.pierwszy[0], [0, 255, 0]) && blisko(w.obraz.pierwszy[1], [0, 0, 255]), `pierwszy kolor z danych, przejście zostaje: ${JSON.stringify(w.obraz.pierwszy)}`);
  assert.ok(blisko(w.obraz.ostatni[0], [255, 0, 0]) && blisko(w.obraz.ostatni[1], [0, 255, 0]), `ostatni kolor z danych: ${JSON.stringify(w.obraz.ostatni)}`);
  assert.ok(blisko(w.obraz.stary[0], [0, 255, 0]) && blisko(w.obraz.stary[1], [0, 255, 0]), `jeden kolor: ${JSON.stringify(w.obraz.stary)}`);
  // Granat (jasność 25%) i wzór, w którym drugi kolor jest o 25 punktów jaśniejszy: wychodzi niebieski o jasności 50%.
  assert.deepEqual(w.jasniejsze, ['#000080', '#0101ff'], 'drugi kolor jest jaśniejszy o tyle, o ile we wzorze');

  // Panel: przy wypełnieniu przejściem wybranie pola od razu ustawia „pierwszy kolor”; zwykłe wypełnienie nie ma tej listy.
  await strona.evaluate(() => {
    const { stan } = window.seriodruk;
    for (const o of stan.projekt.strony[0].obiekty) delete o.z_danych;
    stan.projekt.strony[0].obiekty.push({ type: 'rect', version: '5.3.0', left: 20, top: 170, width: 30, height: 10, strokeWidth: 0, fill: '#123456', id: 'zwykly' });
    return window.seriodruk.przeladuj();
  });
  await strona.evaluate(() => window.seriodruk.edytor.zaznacz('pierwszy'));
  assert.equal(await strona.locator('.wlasciwosci label:has-text("W przejściu kolorów pole zmienia")').count(), 0);
  await strona.selectOption('.wlasciwosci label:has-text("Kolor z pola") select', 'kolor');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  const zapis = (id) => strona.evaluate((x) => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.id === x).z_danych, id);
  assert.deepEqual(await zapis('pierwszy'), { kolor: 'kolor', kolor_w: 'pierwszy' });
  await strona.selectOption('.wlasciwosci label:has-text("W przejściu kolorów pole zmienia") select', 'odcienie');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await zapis('pierwszy'), { kolor: 'kolor', kolor_w: 'odcienie' });
  await strona.selectOption('.wlasciwosci label:has-text("W przejściu kolorów pole zmienia") select', '');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await zapis('pierwszy'), { kolor: 'kolor' });
  await strona.selectOption('.wlasciwosci label:has-text("Kolor z pola") select', '');
  await strona.evaluate(() => window.seriodruk.edytor.zaznacz('zwykly'));
  await strona.selectOption('.wlasciwosci label:has-text("Kolor z pola") select', 'kolor');
  assert.equal(await strona.locator('.wlasciwosci label:has-text("W przejściu kolorów pole zmienia")').count(), 0);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await zapis('zwykly'), { kolor: 'kolor' });
  assert.deepEqual(bledy, []);
});

test('tabela dodatkowa zmienia wiersz, gdy zmieni się którakolwiek z kilku kolumn (miesiąc albo rok); okno serii, zmiana nazwy i usunięcie kolumny', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Dwie kolumny');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    // Dwa razy grudzień, ale w różnych latach; między nimi nic – sama kolumna miesiąca nie zauważy zmiany roku.
    const dni = [['30', 'grudzień', '2027'], ['31', 'grudzień', '2027'], ['30', 'grudzień', '2028'], ['31', 'grudzień', '2028'], ['1', 'styczeń', '2029']];
    p.tabele.push({ id: 't_dni', nazwa: 'Dni', kolumny: ['dzien', 'miesiac', 'rok'], wiersze: dni });
    p.tabele.push({ id: 't_okr', nazwa: 'Okresy', kolumny: ['haslo'], wiersze: [['A'], ['B'], ['C']] });
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: 't_dni', tryb: 'tabela', uklad: 'szeroki', ile: 1, dodatkowe: [{ tabela: 't_okr', co: 7, zmiana: ['miesiac', 'rok'] }] });
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty = [{ type: 'textbox', version: '5.3.0', left: 10, top: 10, width: 100, text: '{dzien} {miesiac} {rok}: {Okresy.haslo}', styles: [], fontSize: 5, fontFamily: 'Inter', id: 'o1' }];
    await window.seriodruk.przeladuj();
    const { rozwin, bilansSerii, tabeleDodatkowe } = await import('./js/serie.js');
    const { opisKroku } = await import('./js/kontrola.js');
    const numery = (zmiana) => rozwin({ ...p, serie: [{ ...p.serie[0], dodatkowe: [{ tabela: 't_okr', co: 2, zmiana }] }] }).egzemplarze.map((e) => e.dodatkowe[0].nrWiersza);
    const ciag = rozwin(p);
    return {
      dwie: ciag.egzemplarze.map((e) => e.dodatkowe[0].nrWiersza),
      jedna: numery('miesiac'),
      jednaWLiscie: numery(['miesiac']),
      zNieznana: numery(['nie_ma', 'rok']),
      sameNieznane: numery(['nie_ma', 'tez_nie']),
      bilans: bilansSerii(p, p.serie[0], ciag)[0].dodatkowe.map((d) => [d.zmiana, d.potrzeba, d.jest]),
      opis: opisKroku(tabeleDodatkowe(p, p.serie[0])[0]),
    };
  });
  assert.deepEqual(w.dwie, [0, 0, 1, 1, 2], 'grudzień 2027, grudzień 2028 i styczeń 2029 to trzy okresy');
  assert.deepEqual(w.jedna, [0, 0, 0, 0, 1], 'sama kolumna miesiąca łączy oba grudnie');
  assert.deepEqual(w.jednaWLiscie, w.jedna);
  assert.deepEqual(w.zNieznana, [0, 0, 1, 1, 2], 'kolumna, której nie ma, jest pomijana – liczy się rok');
  assert.deepEqual(w.sameNieznane, [0, 0, 1, 1, 2], 'bez żadnej znanej kolumny działa stały krok (co 2 strony)');
  assert.deepEqual(w.bilans, [[['miesiac', 'rok'], 3, 3]]);
  assert.equal(w.opis, 'nowy wiersz, gdy zmieni się kolumna „miesiac” albo „rok”');

  // Okno serii: po kolumnie „miesiac” jest lista „albo kolumna” z „rok” i pusta lista na następną.
  await strona.evaluate(() => window.seriodruk.dane.otworzSerie('se1'));
  await strona.waitForSelector('#dlg-seria[open]');
  const listy = () => strona.locator('.wiersz-dodatkowej [data-pole="kiedy-wiecej"]').evaluateAll((l) => l.map((x) => [x.value, [...x.options].map((o) => o.value)]));
  assert.equal(await strona.inputValue('.wiersz-dodatkowej [data-pole="kiedy"]'), 'k:miesiac');
  assert.deepEqual(await listy(), [['rok', ['', 'rok', 'dzien']], ['', ['', 'dzien']]]);
  assert.match(await strona.textContent('#seria-podsumowanie'), /Tabela „Okresy”: nowy wiersz, gdy zmieni się kolumna „miesiac” albo „rok” – potrzeba 3 wierszy, jest 3\.$/);
  // Zdjęcie drugiej kolumny: zostaje sam miesiąc i jedna pusta lista; podsumowanie liczy od nowa.
  await strona.selectOption('.wiersz-dodatkowej [data-pole="kiedy-wiecej"] >> nth=0', '');
  assert.deepEqual(await listy(), [['', ['', 'dzien', 'rok']]]);
  assert.match(await strona.textContent('#seria-podsumowanie'), /gdy zmieni się kolumna „miesiac” – potrzeba 2 wierszy, jest 3\.$/);
  // Stały krok chowa listy dodatkowych kolumn; powrót do kolumny pokazuje pustą listę.
  await strona.selectOption('.wiersz-dodatkowej [data-pole="kiedy"]', '');
  assert.deepEqual(await listy(), []);
  await strona.selectOption('.wiersz-dodatkowej [data-pole="kiedy"]', 'k:rok');
  assert.deepEqual(await listy(), [['', ['', 'dzien', 'miesiac']]]);
  await strona.selectOption('.wiersz-dodatkowej [data-pole="kiedy-wiecej"] >> nth=0', 'miesiac');
  assert.deepEqual(await listy(), [['miesiac', ['', 'miesiac', 'dzien']], ['', ['', 'dzien']]]);
  await strona.waitForTimeout(200); // nowa lista dostaje własną kontrolkę chwilę po dodaniu – okno musi przestać się układać
  await strona.click('#dlg-seria #zapisz-serie');
  await strona.waitForSelector('#dlg-seria', { state: 'hidden' });
  const dodatkowe = () => strona.evaluate(() => window.seriodruk.stan.projekt.serie[0].dodatkowe);
  assert.deepEqual(await dodatkowe(), [{ tabela: 't_okr', co: 7, zmiana: ['rok', 'miesiac'] }]);
  // Ustawienie przeżywa ponowne otwarcie projektu – i jako lista, i jako napis (starsze projekty).
  const poOtwarciu = await strona.evaluate(async () => {
    const { normalizuj } = await import('./js/projekt.js');
    const p = JSON.parse(JSON.stringify(window.seriodruk.stan.projekt));
    const jedna = JSON.parse(JSON.stringify(p));
    jedna.serie[0].dodatkowe[0].zmiana = 'rok';
    return [normalizuj(p).serie[0].dodatkowe, normalizuj(jedna).serie[0].dodatkowe];
  });
  assert.deepEqual(poOtwarciu, [[{ tabela: 't_okr', co: 7, zmiana: ['rok', 'miesiac'] }], [{ tabela: 't_okr', co: 7, zmiana: 'rok' }]]);

  // Zmiana nazwy kolumny tabeli głównej idzie za listą; usunięcie kolumny zostawia pozostałą jako napis.
  await strona.evaluate(() => window.seriodruk.dane.otworz('t_dni'));
  await strona.waitForSelector('#dlg-dane[open]');
  await strona.click('.nazwa-kolumny[data-k="1"]');
  await strona.keyboard.press('Control+a');
  await strona.keyboard.type('mies');
  await strona.keyboard.press('Enter');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].kolumny[1] === 'mies');
  assert.deepEqual((await dodatkowe())[0].zmiana, ['rok', 'mies']);
  await strona.click('.usun-kolumne[data-k="2"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].kolumny.length === 2);
  assert.equal((await dodatkowe())[0].zmiana, 'mies');
  assert.deepEqual(bledy, []);
});

test('szablon danych: listy rozwijane w komórkach (kadr, pliki obrazów, warunek, lista dozwolonych wartości); lista kolumny w oknie danych i w kontroli', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Listy');
  await strona.evaluate(async () => {
    const { stan, zapiszTeraz, edytor } = window.seriodruk;
    const p = stan.projekt;
    const c = Object.assign(document.createElement('canvas'), { width: 20, height: 20 });
    c.getContext('2d').fillRect(0, 0, 20, 20);
    await edytor.dodajObraz(c.toDataURL('image/png'), 'kot.png', p.zasoby);
    await edytor.dodajObraz(c.toDataURL('image/png'), 'Ala, pies.png', p.zasoby); // przecinek w nazwie: lista bierze wartości z arkusza pomocniczego
    edytor.zatwierdz();
    await zapiszTeraz();
    p.tabele.push({ id: 't1', nazwa: 'Dni', kolumny: ['dzien', 'plik', 'kadr', 'swieto', 'rodzaj', 'kolor'], wiersze: [['1', 'kot.png', 'góra', 'tak', 'praca', '#ff0000'], ['2', '', '', '', 'urlop', ''], ['3', '', '', '', 'Dom', '']] });
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    const [obraz] = p.strony[0].obiekty;
    p.strony[0].obiekty = [
      { ...obraz, id: 'obraz', pole: { kolumna: 'plik', tryb: 'wypelnij', kadr_z: 'kadr' } },
      { type: 'textbox', version: '5.3.0', left: 10, top: 10, width: 100, text: '{dzien} {rodzaj}', styles: [], fontSize: 5, fontFamily: 'Inter', id: 'tekst' },
      { type: 'rect', version: '5.3.0', left: 10, top: 60, width: 20, height: 20, strokeWidth: 0, fill: '#cccccc', id: 'znak', z_danych: { kolor: 'kolor', widok: { pole: 'swieto', gdy: 'rowne', wartosc: 'tak' } } },
    ];
    await window.seriodruk.przeladuj();
  });

  // Lista dozwolonych wartości kolumny „rodzaj”: przycisk ☰ w nagłówku; wartość spoza listy jest podświetlona.
  await strona.evaluate(() => window.seriodruk.dane.otworz('t1'));
  await strona.waitForSelector('#dlg-dane[open]');
  await strona.click('#dane-siatka .lista-kolumny[data-k="4"]');
  await strona.waitForSelector('#dlg-lista-kolumny[open]');
  await strona.fill('#lista-kolumny-wartosci', 'praca; dom ;; wolne; dom');
  await strona.click('#dlg-lista-kolumny button[value=tak]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].listy);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.tabele[0].listy), { rodzaj: ['praca', 'dom', 'wolne'] });
  assert.equal(await strona.getAttribute('#dane-siatka .lista-kolumny[data-k="4"]', 'aria-pressed'), 'true');
  // „Dom” pasuje do „dom” (wielkość liter nie ma znaczenia), „urlop” jest spoza listy.
  assert.deepEqual(await strona.locator('#dane-siatka td.spoza-listy').evaluateAll((l) => l.map((td) => td.textContent)), ['urlop']);
  assert.equal(await strona.textContent('#dane-spoza-listy'), 'Wartości spoza listy – „rodzaj”: „urlop” (wiersz 2).');
  // Zmiana nazwy kolumny zabiera listę ze sobą.
  await strona.click('.nazwa-kolumny[data-k="4"]');
  await strona.keyboard.press('Control+a');
  await strona.keyboard.type('typ');
  await strona.keyboard.press('Enter');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].kolumny[4] === 'typ');
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.tabele[0].listy), { typ: ['praca', 'dom', 'wolne'] });
  await strona.click('#dane-zamknij');

  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const k = await import('./js/kontrola.js');
    const { normalizujTabele } = await import('./js/projekt.js');
    const s = k.szablonSerii(p, p.serie[0]);
    return {
      listy: s.listy,
      opisy: Object.fromEntries(s.instrukcja.slice(4).map((x) => [x[0], x[2]])),
      jak: s.instrukcja[1][1],
      uwagi: k.sprawdzProjekt(p).filter((u) => u.rodzaj === 'spoza_listy').map((u) => u.opis),
      poOtwarciu: normalizujTabele({ ...p.tabele[0], listy: { typ: ['a', ' a ', '', 'b'], nie_ma: ['x'], dzien: [] } }).listy,
    };
  });
  assert.deepEqual(w.listy, [
    { kolumna: 1, wartosci: ['Ala, pies.png', 'kot.png'], scisla: false },
    { kolumna: 2, wartosci: ['środek', 'góra', 'dół', 'lewa', 'prawa'], scisla: false },
    { kolumna: 3, wartosci: ['tak'], scisla: false },
    { kolumna: 4, wartosci: ['praca', 'dom', 'wolne'], scisla: true },
  ]);
  assert.match(w.jak, /Komórki niektórych kolumn mają listę rozwijaną z wartościami do wyboru\.$/);
  assert.equal(w.opisy.plik, 'Nazwę pliku obrazu wgranego do projektu, np. zdjecie.jpg. W komórce jest lista rozwijana z podpowiedziami.');
  assert.match(w.opisy.kadr, /^Którą część zdjęcia pokazać: góra, dół, lewa, prawa, środek – albo punkt zdjęcia w procentach.*W komórce jest lista rozwijana z podpowiedziami\.$/);
  assert.equal(w.opisy.swieto, 'Od tej kolumny zależy, czy element jest na stronie (sprawdzana wartość: tak). W komórce jest lista rozwijana z podpowiedziami.');
  assert.equal(w.opisy.typ, 'Tekst, który pojawi się w miejscu {typ}. Tylko wartości z listy: praca, dom, wolne.');
  assert.equal(w.opisy.kolor, 'Kolor: zapis #d1495b albo nazwę po angielsku, np. navy. Pusta komórka zostawia kolor wzoru.');
  assert.equal(w.opisy.dzien, 'Tekst, który pojawi się w miejscu {dzien}.');
  assert.deepEqual(w.uwagi, ['Wartość „urlop” w kolumnie „typ” (tabela „Dni”) nie jest na liście dozwolonych wartości – wiersz 2.']);
  assert.deepEqual(w.poOtwarciu, { typ: ['a', 'b'] });

  // Plik szablonu: reguły list w arkuszu danych, arkusz pomocniczy ukryty, plik dalej czyta się jak zwykły arkusz.
  await strona.evaluate(() => window.seriodruk.dane.otworzSerie('se1'));
  await strona.waitForSelector('#dlg-seria[open]');
  await Promise.all([strona.waitForEvent('download'), strona.click('#seria-szablon')]);
  const plik = await strona.evaluate(async () => {
    const bufor = await window.seriodruk.dane.ostatniSzablon.arrayBuffer();
    const zip = await window.JSZip.loadAsync(bufor);
    const arkusz = await zip.file('xl/worksheets/sheet1.xml').async('string');
    const dok = new DOMParser().parseFromString(arkusz, 'application/xml');
    const skoroszyt = new DOMParser().parseFromString(await zip.file('xl/workbook.xml').async('string'), 'application/xml');
    const wb = window.XLSX.read(bufor, { type: 'array' });
    const { wczytajPlik } = await import('./js/tabele.js');
    const tabele = await wczytajPlik(new File([bufor], 'szablon.xlsx'));
    return {
      blad: dok.querySelector('parsererror')?.textContent || null,
      kolejnosc: [...dok.documentElement.children].map((e) => e.localName),
      ile: dok.querySelector('dataValidations').getAttribute('count'),
      reguly: [...dok.querySelectorAll('dataValidation')].map((r) => [r.getAttribute('sqref'), r.getAttribute('type'), r.getAttribute('showErrorMessage'), r.getAttribute('errorStyle'), r.querySelector('formula1').textContent]),
      arkusze: [...skoroszyt.querySelectorAll('sheet')].map((a) => [a.getAttribute('name'), a.getAttribute('state')]),
      pomocniczy: window.XLSX.utils.sheet_to_json(wb.Sheets['Listy rozwijane'], { header: 1, raw: false, defval: '' }),
      wczytane: tabele.map((x) => [x.nazwa, x.kolumny, x.wiersze.length]),
    };
  });
  assert.equal(plik.blad, null);
  // Reguły stoją w arkuszu za danymi i przed marginesami wydruku – w tej kolejności wymaga ich format pliku.
  const kol = plik.kolejnosc;
  assert.ok(kol.indexOf('sheetData') < kol.indexOf('dataValidations'), kol.join(' '));
  for (const el of ['pageMargins', 'ignoredErrors']) if (kol.includes(el)) assert.ok(kol.indexOf('dataValidations') < kol.indexOf(el), kol.join(' '));
  assert.equal(plik.ile, '4');
  assert.deepEqual(plik.reguly, [
    ['B2:B1000', 'list', '0', null, "'Listy rozwijane'!$A$1:$A$2"],
    ['C2:C1000', 'list', '0', null, '"środek,góra,dół,lewa,prawa"'],
    ['D2:D1000', 'list', '0', null, '"tak"'],
    ['E2:E1000', 'list', '1', 'stop', '"praca,dom,wolne"'],
  ]);
  assert.deepEqual(plik.arkusze, [['Dni', null], ['Instrukcja', null], ['Listy rozwijane', 'hidden']]);
  assert.deepEqual(plik.pomocniczy, [['Ala, pies.png'], ['kot.png']]);
  assert.deepEqual(plik.wczytane, [['Dni', ['dzien', 'plik', 'kadr', 'swieto', 'typ', 'kolor'], 3]], 'przy imporcie arkusze pomocnicze są pomijane');
  assert.deepEqual(bledy, []);
});

test('import z Excela przenosi wygląd komórek (pogrubienie, kursywa, kolor liter) na strony; okno danych go pokazuje i pozwala wyłączyć', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wygląd z arkusza');
  // Plik Excela ze stylami: arkusz zapisany biblioteką, a style, numery stylów komórek i tekst w kawałkach dopisane ręcznie
  // (dane zaczynają się w komórce B3, żeby sprawdzić przeliczanie położenia).
  const plik = await strona.evaluate(async () => {
    const { biblioteka } = await import('./js/biblioteki.js');
    const XLSX = await biblioteka('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX', 'arkuszy');
    const JSZip = await biblioteka('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip', 'ZIP');
    const wb = XLSX.utils.book_new();
    const dane = [['dzien', 'opis', 'uwaga'], ['1', 'Nowy Rok', 'wolne'], ['2', 'zwykły', ''], ['3', 'Trzech Króli', 'mieszany tekst'], ['4', 'cały pogrubiony', 'czarny']];
    const ws = XLSX.utils.aoa_to_sheet(dane, { origin: 'B3' });
    ws['!ref'] = 'B3:D7'; // zajęty obszar arkusza – tak zapisuje go Excel, gdy dane nie zaczynają się w A1
    XLSX.utils.book_append_sheet(wb, ws, 'Dni');
    const zip = await JSZip.loadAsync(XLSX.write(wb, { bookType: 'xlsx', type: 'array', bookSST: true }));
    const czcionka = (srodek) => `<font>${srodek}<sz val="11"/><name val="Calibri"/></font>`;
    zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="5">${czcionka('<color theme="1"/>')}${czcionka('<b/>')}${czcionka('<i/><color rgb="FFFF0000"/>')}${czcionka('<color theme="5"/>')}${czcionka('<b val="0"/><color rgb="FF000000"/>')}</fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">${[0, 1, 2, 3, 4].map((f) => `<xf numFmtId="0" fontId="${f}" fillId="0" borderId="0" xfId="0"/>`).join('')}</cellXfs>
</styleSheet>`);
    let arkusz = await zip.file('xl/worksheets/sheet1.xml').async('string');
    for (const [adres, styl] of [['C4', 1], ['D4', 2], ['C6', 3], ['D7', 4]]) {
      if (!arkusz.includes(`<c r="${adres}"`)) throw new Error(`brak komórki ${adres}`);
      arkusz = arkusz.replace(`<c r="${adres}"`, `<c r="${adres}" s="${styl}"`);
    }
    zip.file('xl/worksheets/sheet1.xml', arkusz);
    let teksty = await zip.file('xl/sharedStrings.xml').async('string');
    const kawalki = (tekst, czesci) => {
      const wzor = new RegExp(`<si><t[^>]*>${tekst}</t></si>`);
      if (!wzor.test(teksty)) throw new Error(`brak tekstu ${tekst}`);
      teksty = teksty.replace(wzor, `<si>${czesci.map(([wyglad, t]) => `<r>${wyglad === null ? '' : `<rPr>${wyglad}<sz val="11"/></rPr>`}<t xml:space="preserve">${t}</t></r>`).join('')}</si>`);
    };
    kawalki('mieszany tekst', [['<b/>', 'mieszany'], ['', ' tekst']]); // różne kawałki – wygląd części tekstu
    kawalki('cały pogrubiony', [['<b/>', 'cały '], ['<b/>', 'pogrubiony']]); // jednakowe kawałki – to wygląd komórki
    zip.file('xl/sharedStrings.xml', teksty);
    return zip.generateAsync({ type: 'base64' });
  });
  await strona.evaluate(() => window.seriodruk.dane.otworz());
  await strona.waitForSelector('#dlg-dane[open]');
  await strona.setInputFiles('#plik-dane', { name: 'Dni.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(plik, 'base64') });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele.length === 1);
  const tabela = () => strona.evaluate(() => { const x = window.seriodruk.stan.projekt.tabele[0]; return { kolumny: x.kolumny, wiersze: x.wiersze, wyglad: x.wyglad, wyl: x.wyglad_wyl }; });
  const poImporcie = await tabela();
  assert.deepEqual(poImporcie.kolumny, ['dzien', 'opis', 'uwaga']);
  assert.deepEqual(poImporcie.wiersze[3], ['4', 'cały pogrubiony', 'czarny']);
  assert.deepEqual(poImporcie.wyglad, [
    [null, { pogrubienie: true }, { kursywa: true, kolor: '#ff0000' }],
    null,
    [null, { kolor: '#c0504d' }, { czesci: [{ od: 0, do: 8, pogrubienie: true }] }], // kolor motywu arkusza; „mieszany tekst” ma różne kawałki – części
    [null, { pogrubienie: true }, null], // jednakowe kawałki dają wygląd komórki; czarny, niepogrubiony tekst to brak wyglądu
  ]);

  // Okno danych: komórki wyglądają jak w arkuszu, przełącznik jest zaznaczony.
  const wOknie = () => strona.locator('#dane-siatka td').evaluateAll((l) => l.filter((td) => td.style.fontWeight || td.style.fontStyle || td.style.color).map((td) => [td.textContent, td.style.fontWeight, td.style.fontStyle, td.style.color]));
  assert.deepEqual(await wOknie(), [['Nowy Rok', '700', '', ''], ['wolne', '', 'italic', 'rgb(255, 0, 0)'], ['Trzech Króli', '', '', 'rgb(192, 80, 77)'], ['cały pogrubiony', '700', '', '']]);
  assert.ok(await strona.isVisible('#dane-wyglad-pole'));
  assert.equal(await strona.isChecked('#dane-wyglad'), true);
  await strona.click('#dane-zamknij');

  // Na stronach: wartość pola dostaje wygląd komórki jako formatowanie fragmentu; własne formatowanie tekstu zostaje.
  const naStronach = async () => strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    if (!p.serie.length) {
      p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: p.tabele[0].id, tryb: 'tabela', uklad: 'szeroki', ile: 1 });
      p.strony[0].seria = 'se1';
      p.strony[0].obiekty = [
        { type: 'textbox', version: '5.3.0', left: 10, top: 10, width: 120, text: '{dzien}. {opis} ({uwaga})', styles: [], fontSize: 5, fontFamily: 'Inter', id: 'zwykly' },
        { type: 'textbox', version: '5.3.0', left: 10, top: 40, width: 120, text: 'Dziś: {opis}!', styles: [{ start: 0, end: 12, style: { underline: true } }, { start: 12, end: 13, style: { fontSize: 9 } }], fontSize: 5, fontFamily: 'Inter', id: 'sformatowany' },
      ];
      await window.seriodruk.przeladuj();
    }
    const { rozwin, wartosciPol } = await import('./js/serie.js');
    const { podstawWObiektach } = await import('./js/pola.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const ciag = rozwin(p);
    const teksty = ciag.egzemplarze.map((e) => podstawWObiektach(p.strony[0].obiekty, wartosciPol(p, e, ciag)).map((o) => [o.text, o.styles]));
    await renderujCel(p, ciag.egzemplarze[0], { szerokoscPx: 148, spad: false, ciag }); // strona z takim formatowaniem składa się bez błędu
    return teksty;
  });
  const strony = await naStronach();
  // Strona 1: „1. Nowy Rok (wolne)” – „Nowy Rok” pogrubione (znaki 3–11), „wolne” kursywą na czerwono (13–18).
  assert.deepEqual(strony[0][0], ['1. Nowy Rok (wolne)', [{ start: 3, end: 11, style: { fontWeight: 'bold' } }, { start: 13, end: 18, style: { fontStyle: 'italic', fill: '#ff0000' } }]]);
  // Tekst z własnym formatowaniem: podkreślenie zostaje, pogrubienie z arkusza dochodzi tylko do wartości pola.
  assert.deepEqual(strony[0][1], ['Dziś: Nowy Rok!', [{ start: 0, end: 6, style: { underline: true } }, { start: 6, end: 14, style: { underline: true, fontWeight: 'bold' } }, { start: 14, end: 15, style: { fontSize: 9 } }]]);
  assert.deepEqual(strony[1][0], ['2. zwykły ()', []], 'wiersz bez wyglądu zostaje zwykłym tekstem');
  assert.deepEqual(strony[2][0], ['3. Trzech Króli (mieszany tekst)', [{ start: 3, end: 15, style: { fill: '#c0504d' } }, { start: 17, end: 25, style: { fontWeight: 'bold' } }]]);

  // Przełącznik wyłącza przenoszenie: wygląd zostaje zapisany, ale strony i okno danych go nie pokazują.
  await strona.evaluate(() => window.seriodruk.dane.otworz());
  await strona.waitForSelector('#dlg-dane[open]');
  await strona.uncheck('#dane-wyglad');
  assert.equal((await tabela()).wyl, true);
  assert.deepEqual(await wOknie(), []);
  assert.deepEqual((await naStronach())[0][0], ['1. Nowy Rok (wolne)', []]);
  await strona.check('#dane-wyglad');
  assert.equal((await tabela()).wyl, undefined);
  assert.equal((await wOknie()).length, 4);
  // Usunięcie wiersza i kolumny przesuwa wygląd razem z danymi.
  await strona.hover('#dane-siatka tbody tr:nth-child(2) th.nr');
  await strona.click('#dane-siatka .usun-wiersz[data-w="1"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].wiersze.length === 3);
  await strona.click('#dane-siatka .usun-kolumne[data-k="0"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].kolumny.length === 2);
  assert.deepEqual((await tabela()).wyglad, [[{ pogrubienie: true }, { kursywa: true, kolor: '#ff0000' }], [{ kolor: '#c0504d' }, { czesci: [{ od: 0, do: 8, pogrubienie: true }] }], [{ pogrubienie: true }, null]]);
  assert.deepEqual((await wOknie()).map((x) => x[0]), ['Nowy Rok', 'wolne', 'Trzech Króli', 'cały pogrubiony']);
  // Ponowne otwarcie projektu zachowuje wygląd; śmieci w zapisie są odrzucane.
  const poOtwarciu = await strona.evaluate(async () => {
    const { normalizujTabele } = await import('./js/projekt.js');
    const x = window.seriodruk.stan.projekt.tabele[0];
    return [normalizujTabele(JSON.parse(JSON.stringify(x))).wyglad, normalizujTabele({ ...x, wyglad: [[{ kolor: 'czerwony' }, 'x'], [null, null], 5], wyglad_wyl: true })];
  });
  assert.deepEqual(poOtwarciu[0], [[{ pogrubienie: true }, { kursywa: true, kolor: '#ff0000' }], [{ kolor: '#c0504d' }, { czesci: [{ od: 0, do: 8, pogrubienie: true }] }], [{ pogrubienie: true }, null]]);
  assert.equal(poOtwarciu[1].wyglad, undefined);
  assert.equal(poOtwarciu[1].wyglad_wyl, undefined);
  assert.deepEqual(bledy, []);
});
