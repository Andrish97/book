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
