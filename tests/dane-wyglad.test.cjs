const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const MIESIACE = [['styczeń', 3], ['luty', 2], ['marzec', 1]]; // „miesiące” o różnej długości: 3, 2 i 1 dzień

test('tabela dodatkowa zmienia wiersz razem z kolumną tabeli głównej (np. miesiąc); bilans, braki, okno serii', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Miesiące');
  const w = await strona.evaluate(async (miesiace) => {
    const { stan, zapiszTeraz } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    const dni = miesiace.flatMap(([m, ile]) => Array.from({ length: ile }, (_, i) => [String(i + 1), m]));
    p.tabele.push({ id: 't_dni', nazwa: 'Dni', kolumny: ['dzien', 'miesiac'], wiersze: dni });
    p.tabele.push({ id: 't_mies', nazwa: 'Miesiace', kolumny: ['haslo'], wiersze: [['Zima'], ['Karnawał']] });
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: 't_dni', tryb: 'tabela', uklad: 'szeroki', ile: 1, dodatkowe: [{ tabela: 't_mies', co: 7, zmiana: 'miesiac' }] });
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty = [{ type: 'textbox', version: '5.3.0', left: 10, top: 10, width: 100, text: '{dzien} {miesiac}: {Miesiace.haslo}', styles: [], fontSize: 5, fontFamily: 'Inter', id: 'o1' }];
    await window.seriodruk.przeladuj();
    const { rozwin, wartosciPol, bilansSerii } = await import('./js/serie.js');
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { podstawWTekscie } = await import('./js/pola.js');
    const ciag = rozwin(p);
    const b = bilansSerii(p, p.serie[0], ciag)[0];
    // Kolumna, której nie ma w tabeli głównej: wraca stały krok.
    const bezKolumny = rozwin({ ...p, serie: [{ ...p.serie[0], dodatkowe: [{ tabela: 't_mies', co: 4, zmiana: 'nie_ma' }] }] });
    return {
      teksty: ciag.egzemplarze.map((e) => podstawWTekscie(e.strona.obiekty[0].text, [], wartosciPol(p, e, ciag)).text),
      wiersze: ciag.egzemplarze.map((e) => e.dodatkowe[0].nrWiersza),
      bilans: b.dodatkowe.map((d) => [d.tabela.nazwa, d.zmiana, d.potrzeba, d.jest, d.brakOd]),
      uwagi: sprawdzProjekt(p, ciag).map((u) => [u.rodzaj, u.opis]),
      staly: bezKolumny.egzemplarze.map((e) => e.dodatkowe[0].nrWiersza),
    };
  }, MIESIACE);
  // Trzy dni stycznia biorą pierwszy wiersz tabeli miesięcy, dwa dni lutego – drugi, marzec – trzeci (którego brakuje).
  assert.deepEqual(w.wiersze, [0, 0, 0, 1, 1, 2]);
  assert.deepEqual(w.teksty, ['1 styczeń: Zima', '2 styczeń: Zima', '3 styczeń: Zima', '1 luty: Karnawał', '2 luty: Karnawał', '1 marzec: ']);
  assert.deepEqual(w.bilans, [['Miesiace', 'miesiac', 3, 2, 6]]);
  assert.deepEqual(w.uwagi, [['brak_danych', 'Seria „Dni”: tabela „Miesiace” ma 2 wiersze, a potrzeba 3 (nowy wiersz, gdy zmieni się kolumna „miesiac”). Od strony 6 jej pola zostaną puste.']]);
  assert.deepEqual(w.staly, [0, 0, 0, 0, 1, 1], 'bez takiej kolumny działa stały krok');

  // Okno serii: lista „Nowy wiersz”, pola kroku schowane, podsumowanie i brak danych; zmiana na stały krok i z powrotem.
  await strona.evaluate(() => window.seriodruk.dane.otworzSerie('se1'));
  await strona.waitForSelector('#dlg-seria[open]');
  assert.equal(await strona.inputValue('.wiersz-dodatkowej [data-pole="kiedy"]'), 'k:miesiac');
  assert.deepEqual(await strona.locator('.wiersz-dodatkowej [data-pole="kiedy"] option').allTextContents(), ['co stałą liczbę stron', 'gdy zmieni się kolumna „dzien”', 'gdy zmieni się kolumna „miesiac”']);
  assert.ok(await strona.isHidden('.wiersz-dodatkowej [data-pole="co"]'));
  assert.equal(await strona.textContent('#seria-podsumowanie'), 'Blok 1 strony × 6 = 6 stron w wydruku. Tabela „Miesiace”: nowy wiersz, gdy zmieni się kolumna „miesiac” – potrzeba 3 wierszy, a jest tylko 2.');
  assert.match(await strona.textContent('#seria-braki'), /tabela „Miesiace” ma 2 wiersze, a potrzeba 3/);
  await strona.selectOption('.wiersz-dodatkowej [data-pole="kiedy"]', '');
  assert.ok(await strona.isVisible('.wiersz-dodatkowej [data-pole="co"]'));
  assert.match(await strona.textContent('#seria-podsumowanie'), /nowy wiersz co 7 stron – potrzeba 1 wiersza, jest 2\.$/);
  await strona.selectOption('.wiersz-dodatkowej [data-pole="kiedy"]', 'k:miesiac');
  await strona.click('#dlg-seria #zapisz-serie');
  await strona.waitForSelector('#dlg-seria', { state: 'hidden' });
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.serie[0].dodatkowe), [{ tabela: 't_mies', co: 7, zmiana: 'miesiac' }]);

  // Zmiana nazwy kolumny w tabeli głównej nie gubi ustawienia.
  await strona.evaluate(() => window.seriodruk.dane.otworz('t_dni'));
  await strona.waitForSelector('#dlg-dane[open]');
  await strona.click('.nazwa-kolumny[data-k="1"]');
  await strona.keyboard.press('Control+a');
  await strona.keyboard.type('mies');
  await strona.keyboard.press('Enter');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].kolumny[1] === 'mies');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.serie[0].dodatkowe[0].zmiana), 'mies');
  assert.deepEqual(bledy, []);
});

test('powtórzenia bez rozróżniania wielkości liter i zbędnych spacji – w tabeli i w kontroli przed drukiem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Powtórzenia');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    p.tabele.push({ id: 't1', nazwa: 'Hasła', kolumny: ['haslo'], wiersze: [['Praca'], ['praca '], ['Dom'], ['PRACA'], ['  dom'], ['Las'], ['']], unikalne: ['haslo'] });
    p.serie.push({ id: 'se1', nazwa: 'Hasła', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty = [{ type: 'textbox', version: '5.3.0', left: 10, top: 10, width: 100, text: '{haslo}', styles: [], fontSize: 5, fontFamily: 'Inter', id: 'o1' }];
    await window.seriodruk.przeladuj();
    const { powtorzenia, sprawdzProjekt } = await import('./js/kontrola.js');
    return { wTabeli: powtorzenia(p.tabele[0], 'haslo'), uwagi: sprawdzProjekt(p).map((u) => [u.rodzaj, u.strony, u.opis]) };
  });
  assert.deepEqual(w.wTabeli, [{ wartosc: 'Praca', wiersze: [0, 1, 3] }, { wartosc: 'Dom', wiersze: [2, 4] }]);
  assert.deepEqual(w.uwagi, [
    ['powtorzenie', [1, 2, 4], 'Wartość „Praca” z kolumny „haslo” (tabela „Hasła”) powtarza się na stronach 1, 2 i 4.'],
    ['powtorzenie', [3, 5], 'Wartość „Dom” z kolumny „haslo” (tabela „Hasła”) powtarza się na stronach 3 i 5.'],
  ]);
  // W oknie danych podświetlonych jest pięć komórek (trzy „praca” i dwie „dom”).
  await strona.evaluate(() => window.seriodruk.dane.otworz('t1'));
  await strona.waitForSelector('#dlg-dane[open]');
  assert.equal(await strona.locator('#dlg-dane td.powtorzona').count(), 5);
  assert.match(await strona.textContent('#dane-powtorzenia'), /„Praca” \(wiersze 1, 2, 4\); „Dom” \(wiersze 3, 5\)/);
  assert.deepEqual(bledy, []);
});

test('z danych: widoczność i obrót elementu; podwójne klamry jako zwykłe klamry obok pól', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wygląd');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    p.tabele.push({ id: 't1', nazwa: 'Dni', kolumny: ['dzien', 'swieto', 'kat'], wiersze: [['1', 'Nowy Rok', '90'], ['2', '', '0'], ['3', ' tak ', '-45']] });
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty = [
      { type: 'rect', version: '5.3.0', left: 10, top: 20, width: 40, height: 20, strokeWidth: 0, fill: '#ff0000', id: 'gwiazdka', z_danych: { widok: { pole: 'swieto', gdy: 'niepuste' } } },
      { type: 'rect', version: '5.3.0', left: 80, top: 20, width: 40, height: 20, strokeWidth: 0, fill: '#0000ff', id: 'zwykly', z_danych: { widok: { pole: 'swieto', gdy: 'puste' } } },
      { type: 'rect', version: '5.3.0', left: 10, top: 80, width: 40, height: 20, strokeWidth: 0, fill: '#00aa00', id: 'tak', z_danych: { widok: { pole: 'swieto', gdy: 'rowne', wartosc: 'TAK' } } },
      { type: 'rect', version: '5.3.0', left: 80, top: 80, width: 40, height: 20, strokeWidth: 0, fill: '#000000', id: 'obrot', z_danych: { obrot: 'kat' } },
      { type: 'textbox', version: '5.3.0', left: 10, top: 130, width: 120, text: 'Dzień {dzien}, wzór {{x}} i {{{dzien}}}', styles: [{ start: 6, end: 13, style: { fontWeight: 'bold' } }], fontSize: 5, fontFamily: 'Inter', id: 'tekst' },
    ];
    await window.seriodruk.przeladuj();
    const { rozwin, wartosciPol } = await import('./js/serie.js');
    const { podstawWObiektach, znajdzPola, polaZDanych, podstawWTekscie } = await import('./js/pola.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const ciag = rozwin(p);
    const strony = ciag.egzemplarze.map((e) => podstawWObiektach(p.strony[0].obiekty, wartosciPol(p, e, ciag)));
    // Kolor w środku każdego z czterech prostokątów na każdej powielonej stronie (148 px = 148 mm).
    const piksele = [];
    for (const e of ciag.egzemplarze) {
      const img = new Image();
      await new Promise(async (ok) => { img.onload = ok; img.src = await renderujCel(p, e, { szerokoscPx: 148, spad: false, ciag }); });
      const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const kolor = (px, py) => [...x.getImageData(px, py, 1, 1).data].slice(0, 3).join(',');
      piksele.push([kolor(30, 30), kolor(100, 30), kolor(30, 90), kolor(100, 75), kolor(115, 90)]);
    }
    return {
      widoczne: strony.map((s) => s.slice(0, 3).map((o) => o.visible !== false)),
      obroty: strony.map((s) => { const o = s[3]; return [o.angle || 0, Math.round(o.left * 100) / 100, Math.round(o.top * 100) / 100]; }),
      teksty: strony.map((s) => s[4].text),
      style: strony[0][4].styles.map((st) => [st.start, st.end]),
      pola: znajdzPola(p.strony[0].obiekty[4].text).map((x) => [x.nazwa, x.start]),
      zDanych: p.strony[0].obiekty.slice(0, 4).map((o) => polaZDanych(o)),
      samaKlamra: podstawWTekscie('a }} b {{ c', [], () => undefined).text,
      piksele,
      ostrzezenia: window.seriodruk.edytor.ostrzezenia.length,
    };
  });
  // Strona 1: święto „Nowy Rok”, strona 2: puste, strona 3: „tak”.
  assert.deepEqual(w.widoczne, [[true, false, false], [false, true, false], [true, false, true]]);
  // Obrót wokół środka (środek prostokąta 100, 90 zostaje na miejscu): 90° przestawia róg na (110, 70).
  assert.deepEqual(w.obroty[0], [90, 110, 70]);
  assert.deepEqual(w.obroty[1], [0, 80, 80]);
  assert.equal(w.obroty[2][0], -45);
  // Podwójne klamry stają się pojedynczymi, pole między nimi działa; pogrubienie pola „{dzien}” zostaje przy wstawionej wartości.
  assert.deepEqual(w.teksty, ['Dzień 1, wzór {x} i {1}', 'Dzień 2, wzór {x} i {2}', 'Dzień 3, wzór {x} i {3}']);
  assert.deepEqual(w.style, [[6, 7]]);
  assert.deepEqual(w.pola, [['dzien', 6], ['dzien', 30]], 'podwójne klamry nie są polami');
  assert.equal(w.samaKlamra, 'a } b { c');
  assert.deepEqual(w.zDanych, [['swieto'], ['swieto'], ['swieto'], ['kat']]);
  assert.equal(w.ostrzezenia, 0, 'znane pola i podwójne klamry nie dają ostrzeżeń');
  // Obraz stron: [czerwony, niebieski, zielony, czarny nad środkiem (widać go tylko po obrocie o 90°), czarny z boku (znika po obrocie o 90°)].
  assert.deepEqual(w.piksele, [
    ['255,0,0', '255,255,255', '255,255,255', '0,0,0', '255,255,255'],
    ['255,255,255', '0,0,255', '255,255,255', '255,255,255', '0,0,0'],
    ['255,0,0', '255,255,255', '0,170,0', w.piksele[2][3], w.piksele[2][4]],
  ]);

  // Panel „Z danych”: obrót z pola i warunek widoczności z wartością.
  await strona.evaluate(() => window.seriodruk.edytor.zaznacz('obrot'));
  await strona.selectOption('.wlasciwosci label:has-text("Pokaż element") select', 'rowne');
  await strona.selectOption('.wlasciwosci label:has-text("Pole, od którego to zależy") select', 'swieto');
  await strona.fill('.wlasciwosci label:has-text("Wartość") input', 'tak');
  await strona.press('.wlasciwosci label:has-text("Wartość") input', 'Tab');
  await strona.selectOption('.wlasciwosci label:has-text("Obrót z pola") select', 'dzien');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.id === 'obrot').z_danych), { obrot: 'dzien', widok: { pole: 'swieto', gdy: 'rowne', wartosc: 'tak' } });
  await strona.selectOption('.wlasciwosci label:has-text("Pokaż element") select', '');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.id === 'obrot').z_danych), { obrot: 'dzien' });
  assert.deepEqual(bledy, []);
});

test('obraz wypełniający ramkę: wybór zachowanej części zdjęcia; tabela, która po wypełnieniu danymi wychodzi poza stronę', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kadr');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz, edytor } = window.seriodruk;
    const p = stan.projekt;
    // Zdjęcie pionowe 100 × 300: góra czerwona, środek zielony, dół niebieski.
    const c = Object.assign(document.createElement('canvas'), { width: 100, height: 300 });
    const x = c.getContext('2d');
    ['#ff0000', '#00ff00', '#0000ff'].forEach((k, i) => { x.fillStyle = k; x.fillRect(0, i * 100, 100, 100); });
    const wzor = await edytor.dodajObraz(c.toDataURL('image/png'), 'pasy.png', p.zasoby);
    wzor.set({ left: 20, top: 20, scaleX: 0.6, scaleY: 0.2 }); // ramka 60 × 60 mm
    edytor.zatwierdz();
    await zapiszTeraz();
    p.tabele.push({ id: 't1', nazwa: 'Dane', kolumny: ['plik', 'opis'], wiersze: [['pasy.png', 'Krótko'], ['pasy.png', 'Bardzo długi opis, który w wąskiej komórce zajmie wiele wierszy i rozepchnie tabelę daleko w dół, poza dolną krawędź strony. '.repeat(3)]] });
    p.serie.push({ id: 'se1', nazwa: 'S', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    const obraz = p.strony[0].obiekty[0];
    const { rozwin } = await import('./js/serie.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const srodek = async (kadr) => {
      obraz.pole = { kolumna: 'plik', tryb: 'wypelnij', ...(kadr ? { kadr } : {}) };
      const img = new Image();
      await new Promise(async (ok) => { img.onload = ok; img.src = await renderujCel(p, p.strony[0], { szerokoscPx: 148, spad: false, ciag: rozwin(p) }); });
      const k = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
      const y = k.getContext('2d'); y.drawImage(img, 0, 0);
      return [...y.getImageData(50, 50, 1, 1).data].slice(0, 3).join(',');
    };
    const kadry = { srodek: await srodek(''), gora: await srodek('gora'), dol: await srodek('dol') };
    await window.seriodruk.przeladuj();
    return kadry;
  });
  // Kwadratowa ramka pokazuje jedną trzecią pionowego zdjęcia: środek (zielony), górę (czerwony) albo dół (niebieski).
  assert.deepEqual(w, { srodek: '0,255,0', gora: '255,0,0', dol: '0,0,255' });
  // Panel obrazu: lista „Zostaje część zdjęcia” jest tylko przy wypełnianiu ramki.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.type === 'image').id); });
  await strona.selectOption('.wlasciwosci label:has-text("Zostaje część zdjęcia") select', 'gora');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty[0].pole), { kolumna: 'plik', tryb: 'wypelnij', kadr: 'gora' });
  await strona.selectOption('.wlasciwosci label:has-text("Podmieniony obraz") select', 'zmiesc');
  assert.equal(await strona.locator('.wlasciwosci label:has-text("Zostaje część zdjęcia")').count(), 0);

  // Tabela z polem w komórce, nisko na stronie: na drugiej powielonej stronie długi opis rozpycha ją poza kartkę.
  const uwagi = await strona.evaluate(async () => {
    const { edytor, stan, zapiszTeraz } = window.seriodruk;
    edytor.odznacz();
    const tabela = edytor.dodajTabele({ wiersze: 2, kolumny: 4 });
    const komorki = edytor.komorkiTabeli(tabela);
    komorki[4].set('text', '{opis}');
    tabela.set({ nazwa: 'Opisy', top: 170 });
    tabela.setCoords();
    edytor.canvas.discardActiveObject();
    edytor.zatwierdz();
    await zapiszTeraz();
    const { sprawdzMieszczenie } = await import('./js/kontrola-skladu.js');
    const { rozwin } = await import('./js/serie.js');
    return (await sprawdzMieszczenie(stan.projekt, rozwin(stan.projekt))).map((u) => [u.rodzaj, u.strony, Boolean(u.idStrony), u.opis.replace(/o [\d,]+ mm/, 'o N mm')]);
  });
  assert.deepEqual(uwagi, [['tabela_poza_strona', [2], true, 'Tabela „Opisy” po wypełnieniu danymi wychodzi poza stronę (nawet o N mm) – strona 2.']]);
  // W oknie „Sprawdź przed drukiem” uwaga ma oba przyciski.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="kontrola"]');
  await strona.waitForFunction(() => /1 uwaga do sprawdzenia/.test(document.querySelector('#kontrola-stan').textContent));
  assert.match(await strona.textContent('#kontrola-lista li span'), /^Tabela „Opisy” po wypełnieniu danymi wychodzi poza stronę/);
  assert.deepEqual(await strona.locator('#kontrola-lista li button').allTextContents(), ['Pokaż', 'Otwórz wzór']);
  assert.deepEqual(bledy, []);
});
