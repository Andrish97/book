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

test('z danych: szerokość i wysokość elementu – procent wzoru albo milimetry, punkt zaczepienia; tekst, obraz, grupa, tabela; panel i ostrzeżenie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Rozmiar');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz, edytor } = window.seriodruk;
    const p = stan.projekt;
    // Obraz 200 × 100: lewa ćwiartka czerwona, środek zielony, prawa ćwiartka niebieska.
    const c = Object.assign(document.createElement('canvas'), { width: 200, height: 100 });
    const x = c.getContext('2d');
    [['#ff0000', 0, 50], ['#00ff00', 50, 100], ['#0000ff', 150, 50]].forEach(([k, od, ile]) => { x.fillStyle = k; x.fillRect(od, 0, ile, 100); });
    const obraz = await edytor.dodajObraz(c.toDataURL('image/png'), 'pasy.png', p.zasoby);
    obraz.set({ left: 10, top: 150, scaleX: 0.2, scaleY: 0.2 }); // 40 × 20 mm
    edytor.zatwierdz();
    await zapiszTeraz();
    const zwykly = { ...p.strony[0].obiekty[0], id: 'obraz', z_danych: { szer: { pole: 'proc', tryb: 'procent' } } };
    const zPola = { ...p.strony[0].obiekty[0], id: 'obrazZPola', left: 80, pole: { kolumna: 'plik', tryb: 'wypelnij' }, z_danych: { szer: { pole: 'proc', tryb: 'procent' }, kotwica: 'srodek' } };
    p.tabele.push({ id: 't1', nazwa: 'Dane', kolumny: ['proc', 'mm', 'zero', 'plik'], wiersze: [['100', '30', '5', 'pasy.png'], ['50', '60', '0', 'pasy.png'], ['200', '15', '', 'pasy.png'], ['bez liczby', '', '-3', 'pasy.png']] });
    p.serie.push({ id: 'se1', nazwa: 'Dane', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    const prostokat = (id, left, top, width, height, fill, zDanych) => ({ type: 'rect', version: '5.3.0', left, top, width, height, strokeWidth: 0, fill, id, z_danych: zDanych });
    p.strony[0].obiekty = [
      // Słupek: wysokość w procentach, dół zostaje na miejscu (60 mm).
      prostokat('slupek', 10, 20, 20, 40, '#ff0000', { wys: { pole: 'proc', tryb: 'procent' }, kotwica: 'dol' }),
      // Pasek: szerokość w mm, lewy górny róg zostaje.
      prostokat('pasek', 50, 20, 40, 10, '#0000ff', { szer: { pole: 'mm', tryb: 'mm' } }),
      // Oba wymiary naraz, każdy w innym trybie, środek (110, 40) zostaje.
      prostokat('srodek', 100, 30, 20, 20, '#00aa00', { szer: { pole: 'proc', tryb: 'procent' }, wys: { pole: 'mm', tryb: 'mm' }, kotwica: 'srodek' }),
      // Wymiar zerowy albo ujemny chowa element; puste pole zostawia rozmiar wzoru.
      prostokat('znika', 130, 20, 10, 10, '#000000', { wys: { pole: 'zero', tryb: 'mm' } }),
      // Obrócony o 90° pasek rosnący „w dół” od swojego rogu: szerokość biegnie wtedy pionowo.
      { ...prostokat('obrocony', 140, 60, 20, 4, '#aa00aa', { szer: { pole: 'proc', tryb: 'procent' }, kotwica: 'srodek' }), angle: 90 },
      // Tekst: zmienia się szerokość ramki, nie litery; wysokość bez stałej ramki wynika z treści.
      { type: 'textbox', version: '5.3.0', left: 10, top: 80, width: 60, text: 'Tekst, który układa się od nowa w węższej ramce', styles: [], fontSize: 3, fontFamily: 'Inter', id: 'tekst', z_danych: { szer: { pole: 'mm', tryb: 'mm' }, wys: { pole: 'proc', tryb: 'procent' } } },
      // Tekst w ramce o stałej wysokości: zmienia się wysokość ramki.
      { type: 'textbox', version: '5.3.0', left: 80, top: 80, width: 50, ramka_h: 20, strokeWidth: 0, text: 'Ramka', styles: [], fontSize: 5, fontFamily: 'Inter', id: 'ramka', z_danych: { wys: { pole: 'proc', tryb: 'procent' }, kotwica: 'dol' } },
      zwykly, zPola,
      // Grupa: skala.
      { type: 'group', version: '5.3.0', left: 10, top: 120, width: 40, height: 10, id: 'grupa', z_danych: { szer: { pole: 'proc', tryb: 'procent' } }, objects: [
        { type: 'rect', version: '5.3.0', left: -20, top: -5, width: 20, height: 10, strokeWidth: 0, fill: '#ffaa00' },
        { type: 'rect', version: '5.3.0', left: 0, top: -5, width: 20, height: 10, strokeWidth: 0, fill: '#00aaff' }] },
      // Nieznane pole → ostrzeżenie.
      prostokat('nieznane', 100, 120, 10, 10, '#777777', { szer: { pole: 'nie_ma', tryb: 'mm' } }),
    ];
    await window.seriodruk.przeladuj();
    // Tabela (element strony): kolumny i wiersze.
    const tabela = edytor.dodajTabele({ wiersze: 2, kolumny: 2 });
    tabela.set({ left: 10, top: 180, nazwa: 'Tab' });
    tabela.z_danych = { szer: { pole: 'proc', tryb: 'procent' }, wys: { pole: 'proc', tryb: 'procent' } };
    edytor.canvas.discardActiveObject();
    edytor.zatwierdz();
    await zapiszTeraz();

    const { rozwin, wartosciPol } = await import('./js/serie.js');
    const { podstawWObiektach, polaZDanych } = await import('./js/pola.js');
    const { renderujCel, zlozCel } = await import('./js/zlozenie.js');
    const ciag = rozwin(p);
    const z = (v) => Math.round(v * 100) / 100;
    const strony = ciag.egzemplarze.map((e) => Object.fromEntries(podstawWObiektach(p.strony[0].obiekty, wartosciPol(p, e, ciag)).map((o) => [o.tabela ? 'Tab' : o.id, o])));
    const ramka = (o) => (o.visible === false ? 'schowany' : [z(o.left), z(o.top), z(o.width * (o.scaleX ?? 1)), z(o.height * (o.scaleY ?? 1))]);
    // Obraz stron (tak powstają podgląd i miniatury) i żywe obiekty (z nich powstaje PDF).
    const piksele = [];
    const zlozone = [];
    for (const e of ciag.egzemplarze) {
      const img = new Image();
      await new Promise(async (ok) => { img.onload = ok; img.src = await renderujCel(p, e, { szerokoscPx: 148, spad: false, ciag }); });
      const k = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
      const y = k.getContext('2d'); y.drawImage(img, 0, 0);
      const kolor = (px, py) => [...y.getImageData(px, py, 1, 1).data].slice(0, 3).join(',');
      // [słupek u góry wzoru, słupek tuż nad dołem, 10 mm nad wzorem słupka, pasek w 75 mm, pasek w 95 mm,
      //  zwykły obraz: lewy skraj ramki, obraz z pola: środek]
      piksele.push([kolor(20, 25), kolor(20, 58), kolor(20, 10), kolor(75, 25), kolor(95, 25), kolor(12, 160), kolor(100, 160)]);
      const { obiekty } = await zlozCel(p, e, ciag);
      const zywe = Object.fromEntries(obiekty.map((o) => [o.id, o]));
      const r = (o) => { o.setCoords(); const b = o.getBoundingRect(); return [z(b.left), z(b.top), z(b.width), z(b.height)]; };
      zlozone.push({
        slupek: r(zywe.slupek), tekst: [z(zywe.tekst.width), z(zywe.tekst.fontSize), zywe.tekst.scaleX, zywe.tekst.textLines.length], ramka: r(zywe.ramka),
        obrazZPola: r(zywe.obrazZPola), tabela: [z(obiekty.find((o) => o.tabela).width), obiekty.find((o) => o.tabela).tabela.kolumny.map(z)],
      });
    }
    return {
      slupek: strony.map((s) => ramka(s.slupek)), pasek: strony.map((s) => ramka(s.pasek)), srodek: strony.map((s) => ramka(s.srodek)), znika: strony.map((s) => ramka(s.znika)),
      obrocony: strony.map((s) => [z(s.obrocony.left), z(s.obrocony.top), z(s.obrocony.width * (s.obrocony.scaleX ?? 1))]),
      tekst: strony.map((s) => [z(s.tekst.width), s.tekst.scaleX ?? 1, s.tekst.fontSize, s.tekst.ramka_h ?? null]),
      ramkaTekstu: strony.map((s) => [z(s.ramka.top), z(s.ramka.ramka_h), z(s.ramka.width)]),
      obraz: strony.map((s) => { const o = s.obraz; return [z(o.left), z(o.width * o.scaleX), z(o.height * o.scaleY), z(o.scaleX), z(o.scaleY), z(o.width), z(o.height), z(o.cropX || 0), z(o.cropY || 0)]; }),
      grupa: strony.map((s) => [z(s.grupa.left), z(s.grupa.scaleX ?? 1), z(s.grupa.scaleY ?? 1)]),
      tabela: strony.map((s) => [s.Tab.tabela.kolumny.map(z), s.Tab.tabela.wiersze.map(z)]),
      pola: p.strony[0].obiekty.filter((o) => ['slupek', 'srodek', 'nieznane'].includes(o.id)).map((o) => polaZDanych(o)),
      piksele, zlozone,
      ostrzezenia: edytor.ostrzezenia.filter((o) => o.typ === 'nieznane_pole').map((o) => [o.id, o.pola]),
      wEdytorze: (() => { const o = edytor.canvas.getObjects().find((q) => q.id === 'slupek'); return [o.left, o.top, o.getScaledWidth(), o.getScaledHeight()]; })(),
    };
  });
  // Wiersze tabeli: procent 100 / 50 / 200 / „bez liczby”; mm 30 / 60 / 15 / puste.
  // Słupek 20 × 40 mm stojący na 60 mm: wysokość 40, 20, 80 – dół zostaje; bez liczby – rozmiar wzoru.
  assert.deepEqual(w.slupek, [[10, 20, 20, 40], [10, 40, 20, 20], [10, -20, 20, 80], [10, 20, 20, 40]]);
  // Pasek: szerokość wprost w mm, lewy róg na miejscu; puste pole zostawia 40 mm wzoru.
  assert.deepEqual(w.pasek, [[50, 20, 30, 10], [50, 20, 60, 10], [50, 20, 15, 10], [50, 20, 40, 10]]);
  // Szerokość w procentach i wysokość w mm naraz; środek (110, 40) zostaje.
  assert.deepEqual(w.srodek, [[100, 25, 20, 30], [105, 10, 10, 60], [90, 32.5, 40, 15], [100, 30, 20, 20]]);
  // 5 mm, 0 (schowany), puste (wzór), −3 (schowany).
  assert.deepEqual(w.znika, [[130, 20, 10, 5], 'schowany', [130, 20, 10, 10], 'schowany']);
  // Obrócony o 90° pasek 20 × 4: jego „szerokość” biegnie w dół strony; środek zostaje, więc róg przesuwa się w pionie.
  assert.deepEqual(w.obrocony, [[140, 60, 20], [140, 65, 10], [140, 50, 40], [140, 60, 20]]);
  // Tekst: szerokość ramki 30 / 60 / 15 mm, skala i rozmiar pisma bez zmian; wysokości bez stałej ramki nie ruszamy.
  assert.deepEqual(w.tekst, [[30, 1, 3, null], [60, 1, 3, null], [15, 1, 3, null], [60, 1, 3, null]]);
  // Ramka o stałej wysokości 20 mm (dół na 100 mm): 20, 10, 40 mm – szerokość zostaje.
  assert.deepEqual(w.ramkaTekstu, [[80, 20, 50], [90, 10, 50], [60, 40, 50], [80, 20, 50]]);
  // Zwykły obraz 40 × 20 mm (200 × 100 px): ramka 20 mm pokazuje środek bez zniekształcenia (ta sama skala, przycięte boki);
  // ramka 80 mm – obraz dwa razy większy, przycięty w pionie.
  assert.deepEqual(w.obraz, [
    [10, 40, 20, 0.2, 0.2, 200, 100, 0, 0],
    [10, 20, 20, 0.2, 0.2, 100, 100, 50, 0],
    [10, 80, 20, 0.4, 0.4, 200, 50, 0, 25],
    [10, 40, 20, 0.2, 0.2, 200, 100, 0, 0],
  ]);
  // Grupa: skala w poziomie.
  assert.deepEqual(w.grupa, [[10, 1, 1], [10, 0.5, 1], [10, 2, 1], [10, 1, 1]]);
  // Tabela: kolumny i najmniejsze wysokości wierszy.
  const kolumna = w.tabela[0][0][0];
  assert.deepEqual(w.tabela.map(([k, wiersze]) => [k.map((x) => Math.round((x / kolumna) * 100) / 100), wiersze]), [[[1, 1], [9, 9]], [[0.5, 0.5], [4.5, 4.5]], [[2, 2], [18, 18]], [[1, 1], [9, 9]]]);
  assert.deepEqual(w.pola, [['proc'], ['proc', 'mm'], ['nie_ma']]);
  assert.deepEqual(w.ostrzezenia, [['nieznane', ['nie_ma']]], 'nieznane pole trafia do ostrzeżeń');
  assert.deepEqual(w.wEdytorze, [10, 20, 20, 40], 'w edytorze element ma rozmiar wzoru');

  // Obraz stron (podgląd, miniatury): słupek, pasek, obraz przycięty do środka i obraz z pola wypełniający nową ramkę.
  const [B, R, N, G] = ['255,255,255', '255,0,0', '0,0,255', '0,255,0'];
  assert.deepEqual(w.piksele, [
    [R, R, B, N, B, R, G],
    [B, R, B, N, N, G, G],
    [R, R, R, B, B, R, G],
    [R, R, B, N, B, R, G],
  ]);
  // Żywe obiekty strony (z nich powstaje PDF): te same wymiary; tekst ma węższą ramkę i więcej wierszy, nie mniejsze litery.
  assert.deepEqual(w.zlozone.map((s) => s.slupek), [[10, 20, 20, 40], [10, 40, 20, 20], [10, -20, 20, 80], [10, 20, 20, 40]]);
  assert.deepEqual(w.zlozone.map((s) => s.tekst.slice(0, 3)), [[30, 3, 1], [60, 3, 1], [15, 3, 1], [60, 3, 1]]);
  assert.ok(w.zlozone[2].tekst[3] > w.zlozone[0].tekst[3] && w.zlozone[0].tekst[3] > w.zlozone[1].tekst[3], `węższa ramka – więcej wierszy: ${w.zlozone.map((s) => s.tekst[3])}`);
  assert.deepEqual(w.zlozone.map((s) => s.ramka), [[80, 80, 50, 20], [80, 90, 50, 10], [80, 60, 50, 40], [80, 80, 50, 20]]);
  // Obraz z pola (wypełnij ramkę): ramka 40 → 20 → 80 mm wokół środka (100 mm), wysokość 20 mm.
  assert.deepEqual(w.zlozone.map((s) => s.obrazZPola), [[80, 150, 40, 20], [90, 150, 20, 20], [60, 150, 80, 20], [80, 150, 40, 20]]);
  assert.deepEqual(w.zlozone.map((s) => Math.round((s.tabela[0] / w.zlozone[0].tabela[0]) * 100) / 100), [1, 0.5, 2, 1], 'tabela ma szerokość z danych');

  // Panel „Z danych”: szerokość i wysokość z pola, tryb każdej osobno, punkt zaczepienia.
  await strona.evaluate(() => window.seriodruk.edytor.zaznacz('pasek'));
  const zapisane = async () => { await strona.evaluate(() => window.seriodruk.zapiszTeraz()); return strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.id === 'pasek').z_danych); };
  assert.equal(await strona.inputValue('.wlasciwosci label:has-text("Szerokość z pola") select'), 'mm');
  assert.equal(await strona.inputValue('.wlasciwosci label:has-text("Szerokość: wartość pola to") select'), 'mm');
  assert.equal(await strona.locator('.wlasciwosci label:has-text("Wysokość: wartość pola to")').count(), 0, 'tryb pokazuje się po wybraniu pola');
  await strona.selectOption('.wlasciwosci label:has-text("Wysokość z pola") select', 'proc');
  assert.equal(await strona.inputValue('.wlasciwosci label:has-text("Wysokość: wartość pola to") select'), 'procent', 'domyślnie procent rozmiaru wzoru');
  await strona.selectOption('.wlasciwosci label:has-text("Szerokość: wartość pola to") select', 'procent');
  await strona.selectOption('.wlasciwosci label:has-text("Przy zmianie rozmiaru na miejscu zostaje") select', 'dol');
  assert.deepEqual(await zapisane(), { szer: { pole: 'mm', tryb: 'procent' }, wys: { tryb: 'procent', pole: 'proc' }, kotwica: 'dol' });
  assert.match(await strona.textContent('.wlasciwosci'), /Element jest skalowany w wybranym kierunku\. Wartość 0 chowa element\./);
  // Wyłączenie obu wymiarów usuwa też punkt zaczepienia.
  await strona.selectOption('.wlasciwosci label:has-text("Szerokość z pola") select', '');
  await strona.selectOption('.wlasciwosci label:has-text("Wysokość z pola") select', '');
  assert.equal(await zapisane(), undefined);
  assert.equal(await strona.locator('.wlasciwosci label:has-text("Przy zmianie rozmiaru na miejscu zostaje")').count(), 0);
  // Tekst w ramce o stałej wysokości ma oba wymiary; tekst bez niej – tylko szerokość (wysokość wynika z treści).
  await strona.evaluate(() => window.seriodruk.edytor.zaznacz('ramka'));
  assert.equal(await strona.locator('.wlasciwosci label:has-text("Wysokość z pola")').count(), 1);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz('pasek'); const tekst = e.dodajTekst('Zwykły tekst'); tekst.set({ top: 5 }); e.zatwierdz(); });
  assert.equal(await strona.locator('.wlasciwosci label:has-text("Szerokość z pola")').count(), 1);
  assert.equal(await strona.locator('.wlasciwosci label:has-text("Wysokość z pola")').count(), 0);
  assert.deepEqual(bledy, []);
});
