const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('pola (obliczenia): podstawianie z zachowaniem formatowania fragmentów, zapisy liczb', async (t) => {
  const { strona } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const { podstawWTekscie, zapiszLiczbe, znajdzPola } = await import('./js/pola.js');
    const wartosc = (n, zapis) => ({ dzien: '7', miesiac: 'stycznia', nr: zapiszLiczbe(12, zapis) }[n]);
    return {
      // „{dzien}” pogrubione (znaki 0–7), „rok” czerwone; po podstawieniu pogrubiona jest „7”, a czerwone zostaje „rok”.
      styl: podstawWTekscie('{dzien} {miesiac}\nrok {nieznane}', [{ start: 0, end: 7, style: { fontWeight: 'bold' } }, { start: 17, end: 20, style: { fill: '#f00' } }], wartosc),
      bezStyli: podstawWTekscie('Strona {nr} ({nr:I}, {nr:000})', [], wartosc).text,
      liczby: [zapiszLiczbe(4, 'I'), zapiszLiczbe(1994, 'i'), zapiszLiczbe(28, 'A'), zapiszLiczbe(3, 'a'), zapiszLiczbe(7, '00'), zapiszLiczbe(7, '')],
      pola: znajdzPola('{a} i {b b:00} oraz {nie\npole}').map((p) => [p.nazwa, p.zapis]),
    };
  });
  assert.equal(w.styl.text, '7 stycznia\nrok {nieznane}');
  assert.deepEqual(w.styl.styles, [{ start: 0, end: 1, style: { fontWeight: 'bold' } }, { start: 10, end: 13, style: { fill: '#f00' } }]);
  assert.equal(w.bezStyli, 'Strona 12 (XII, 012)');
  assert.deepEqual(w.liczby, ['IV', 'mcmxciv', 'AB', 'c', '07', '7']);
  assert.deepEqual(w.pola, [['a', null], ['b b', '00']]);
});

test('tabele (obliczenia): CSV ze średnikami i cudzysłowami, tabulatory, Windows-1250, zapis do CSV', async (t) => {
  const { strona } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const { parsujTekst, wykryjSeparator, dekoduj, zWierszy, doCsv } = await import('./js/tabele.js');
    const csv = 'dzien;opis\r\n1;"Nowy Rok; wolne"\r\n2;"dwie\nlinie i ""cudzysłów"""\r\n';
    const win1250 = new Uint8Array([0xBF, 0xF3, 0xB3, 0x74, 0x79]); // „żółty”
    return {
      separatory: [wykryjSeparator(csv), wykryjSeparator('a,b,c\n1,2,3'), wykryjSeparator('a\tb\n1\t2')],
      wiersze: parsujTekst(csv),
      tabela: zWierszy([['a', 'b', ''], ['1', '2', ''], ['', '', '']]),
      kodowanie: [dekoduj(win1250.buffer), dekoduj(new TextEncoder().encode('żółty').buffer)],
      csv: doCsv({ kolumny: ['a', 'b'], wiersze: [['x;y', 'z "q"']] }),
    };
  });
  assert.deepEqual(w.separatory, [';', ',', '\t']);
  assert.deepEqual(w.wiersze, [['dzien', 'opis'], ['1', 'Nowy Rok; wolne'], ['2', 'dwie\nlinie i "cudzysłów"']]);
  assert.deepEqual(w.tabela, { kolumny: ['a', 'b'], wiersze: [['1', '2']] });
  assert.deepEqual(w.kodowanie, ['żółty', 'żółty']);
  assert.equal(w.csv, '﻿a;b\r\n"x;y";"z ""q"""\r\n');
});

test('serie (obliczenia): powielanie bloku, układ długi, stała liczba, numeracja i strony rozkładówek', async (t) => {
  const { strona } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const { nowyProjekt, nowaStrona, normalizuj } = await import('./js/projekt.js');
    const { rozwin, wartosciPol, arkuszStrony } = await import('./js/serie.js');
    const p = nowyProjekt('Kalendarz', undefined, 'rozkladowki');
    const sek = p.sekcje[0].id;
    p.strony = ['Tytuł', 'Dzień A', 'Dzień B', 'Koniec'].map((n) => nowaStrona(n, sek));
    p.tabele = [{ id: 't1', nazwa: 'Dni', kolumny: ['dzien', 'opis'], wiersze: [['1', 'a'], ['2', 'b'], ['3', 'c']] }];
    p.serie = [{ id: 's1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 5 }];
    p.strony[1].seria = 's1';
    p.strony[2].seria = 's1';
    const proj = normalizuj(p);
    const opis = (c) => c.egzemplarze.map((e) => `${e.strona.nazwa}${e.nrEgz ? `#${e.nrEgz}` : ''}:${e.nr}:${e.bok[0]}:${e.wiersz ? e.wiersz.dzien : '-'}`);
    const szeroki = rozwin(proj);
    const pole = wartosciPol(proj, szeroki.egzemplarze[3], szeroki); // Dzień A, powielenie 2
    const wyniki = { szeroki: opis(szeroki), pola: ['opis', 'nr', 'nr:I', 'nr_ogolny', 'egzemplarz', 'liczba_egzemplarzy', 'liczba_stron', 'seria', 'nr_strony:Koniec', 'poczatek:Główna', 'brak'].map((n) => { const [a, b] = n.split(':'); return pole(a, b ?? null); }) };
    wyniki.arkusze = proj.strony.map((s) => arkuszStrony(s, szeroki).map((x) => x.nazwa).join('+'));
    proj.serie[0].uklad = 'dlugi';
    wyniki.dlugi = opis(rozwin(proj));
    proj.serie[0].tryb = 'stala';
    proj.serie[0].ile = 2;
    wyniki.stala = opis(rozwin(proj));
    proj.strony[2].seria = undefined; // blok jednostronicowy: egzemplarze na przemian po lewej i prawej
    proj.serie[0].tryb = 'tabela'; proj.serie[0].uklad = 'szeroki';
    const jedna = rozwin(proj);
    wyniki.jedna = opis(jedna);
    wyniki.arkuszJednej = arkuszStrony(proj.strony[1], jedna).map((x) => x.nazwa).join('+');
    return wyniki;
  });
  assert.deepEqual(w.szeroki, ['Tytuł:1:p:-', 'Dzień A#1:2:l:1', 'Dzień B#1:3:p:1', 'Dzień A#2:4:l:2', 'Dzień B#2:5:p:2', 'Dzień A#3:6:l:3', 'Dzień B#3:7:p:3', 'Koniec:8:l:-']);
  assert.deepEqual(w.pola, ['b', '4', 'IV', '4', '2', '3', '8', 'Dni', '8', '1', undefined]);
  assert.deepEqual(w.arkusze, ['Tytuł', 'Dzień A+Dzień B', 'Dzień A+Dzień B', 'Koniec']);
  // Układ długi: 3 wiersze na blok 2 stron = 2 powielenia; ostatnia strona bez danych.
  assert.deepEqual(w.dlugi, ['Tytuł:1:p:-', 'Dzień A#1:2:l:1', 'Dzień B#1:3:p:2', 'Dzień A#2:4:l:3', 'Dzień B#2:5:p:undefined', 'Koniec:6:l:-']);
  assert.deepEqual(w.stala, ['Tytuł:1:p:-', 'Dzień A#1:2:l:1', 'Dzień B#1:3:p:1', 'Dzień A#2:4:l:2', 'Dzień B#2:5:p:2', 'Koniec:6:l:-']);
  assert.deepEqual(w.jedna, ['Tytuł:1:p:-', 'Dzień A#1:2:l:1', 'Dzień A#2:3:p:2', 'Dzień A#3:4:l:3', 'Dzień B:5:p:-', 'Koniec:6:l:-']);
  assert.equal(w.arkuszJednej, 'Dzień A');
});

test('dane: nowa tabela, pisanie w komórkach, wklejanie z arkusza, zmiana nazwy kolumny poprawia pola w tekście', async (t) => {
  const { strona, bledy, kontekst } = await otworz(t);
  await kontekst.grantPermissions(['clipboard-read', 'clipboard-write']);
  await nowyProjekt(strona, 'Dane');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.dodajTekst('{kolumna_1}. {kolumna_2:00}'); });
  await strona.click('[data-akcja="dane"]');
  await strona.waitForSelector('#dlg-dane[open]');
  assert.ok(await strona.isVisible('#dane-pusto'));
  await strona.click('#dane-nowa');
  await strona.fill('#dane-nazwa', 'Dni');
  await strona.press('#dane-nazwa', 'Tab');

  const komorka = (w, k) => strona.locator(`#dane-siatka td[data-w="${w}"][data-k="${k}"]`);
  await komorka(0, 0).click();
  await strona.keyboard.type('Poniedziałek');
  await strona.keyboard.press('Enter'); // nowy wiersz i przejście niżej
  await strona.keyboard.type('Wtorek');
  const tabela = () => strona.evaluate(() => { const t = window.seriodruk.stan.projekt.tabele[0]; return { nazwa: t.nazwa, kolumny: t.kolumny, wiersze: t.wiersze }; });
  assert.deepEqual(await tabela(), { nazwa: 'Dni', kolumny: ['kolumna_1', 'kolumna_2'], wiersze: [['Poniedziałek', ''], ['Wtorek', '']] });

  // Wklejenie trzech wierszy po trzy komórki od komórki (1, 1): tabela rośnie w dół i w prawo.
  await strona.evaluate(() => navigator.clipboard.writeText('2\tb\tx\n3\tc\ty\n4\td\tz'));
  await komorka(1, 1).click();
  await strona.keyboard.press('Control+v');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].wiersze.length === 4);
  assert.deepEqual((await tabela()).wiersze, [['Poniedziałek', '', '', ''], ['Wtorek', '2', 'b', 'x'], ['', '3', 'c', 'y'], ['', '4', 'd', 'z']]);

  // Zmiana nazwy kolumny przepisuje {kolumna_1} na {dzien} w tekstach projektu.
  await strona.locator('.nazwa-kolumny[data-k="0"]').click();
  await strona.keyboard.press('Control+a');
  await strona.keyboard.type('dzien');
  await strona.keyboard.press('Enter');
  assert.deepEqual((await tabela()).kolumny, ['dzien', 'kolumna_2', 'kolumna_3', 'kolumna_4']);

  await strona.hover('#dane-siatka tbody tr:nth-child(3) th.nr');
  await strona.click('#dane-siatka tbody tr:nth-child(3) .usun-wiersz');
  assert.equal((await tabela()).wiersze.length, 3);
  await strona.click('#dane-zamknij');
  await strona.waitForFunction(() => !document.querySelector('#dlg-dane').open);
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects()[0]?.text === '{dzien}. {kolumna_2:00}');
  assert.deepEqual(bledy, []);
});

test('dane: import CSV i Excela, ponowny import podmienia dane tabeli', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Import');
  await strona.click('[data-akcja="dane"]');
  await strona.setInputFiles('#plik-dane', { name: 'dni.csv', mimeType: 'text/csv', buffer: Buffer.from('dzien;miesiac;opis\n1;stycznia;"Nowy Rok"\n2;stycznia;\n', 'utf8') });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele.length === 1);
  let tabele = await strona.evaluate(() => window.seriodruk.stan.projekt.tabele.map((x) => [x.nazwa, x.kolumny, x.wiersze]));
  assert.deepEqual(tabele, [['dni', ['dzien', 'miesiac', 'opis'], [['1', 'stycznia', 'Nowy Rok'], ['2', 'stycznia', '']]]]);
  assert.equal(await strona.locator('#dane-siatka tbody tr').count(), 2);

  // Poprawiony plik o tej samej nazwie: pytanie, czy podmienić dane.
  await strona.setInputFiles('#plik-dane', { name: 'dni.csv', mimeType: 'text/csv', buffer: Buffer.from('dzien,miesiac\n1,stycznia\n2,stycznia\n3,stycznia\n', 'utf8') });
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].wiersze.length === 3);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.tabele.length), 1);

  // Plik Excela z dwoma arkuszami: po jednej tabeli na arkusz, liczby jako tekst.
  await strona.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js' });
  const base64 = await strona.evaluate(() => {
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet([['tydzien', 'od'], [1, '4 stycznia'], [2, '11 stycznia']]), 'Tygodnie');
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet([['miesiac'], ['Styczeń'], ['Luty']]), 'Miesiące');
    return window.XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  });
  await strona.setInputFiles('#plik-dane', { name: 'plan.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(base64, 'base64') });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele.length === 3);
  tabele = await strona.evaluate(() => window.seriodruk.stan.projekt.tabele.slice(1).map((x) => [x.nazwa, x.kolumny, x.wiersze]));
  assert.deepEqual(tabele, [['Tygodnie', ['tydzien', 'od'], [['1', '4 stycznia'], ['2', '11 stycznia']]], ['Miesiące', ['miesiac'], [['Styczeń'], ['Luty']]]]);
  assert.deepEqual(bledy, []);
});

test('serie: strona powielona według tabeli – lista stron, pola, ostrzeżenie o nieznanym polu, podgląd z egzemplarzami', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz');
  await strona.evaluate(() => {
    const { stan } = window.seriodruk;
    stan.projekt.tabele.push({ id: 't_dni', nazwa: 'Dni', kolumny: ['dzien', 'opis'], wiersze: [['1', 'Nowy Rok'], ['2', 'Wtorek'], ['3', 'Środa']] });
  });
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const a = e.dodajTekst('{dzien} stycznia – {opis}');
    a.set({ top: 40 });
    const b = e.dodajTekst('str. {nr} ({egzemplarz:I} z {liczba_egzemplarzy}) {literowka}');
    b.set({ top: 80 });
    e.canvas.discardActiveObject();
    e.zatwierdz();
  });

  // Bez serii pola z tabeli są nieznane.
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.filter((o) => o.typ === 'nieznane_pole').map((o) => o.pola)), [['dzien', 'opis'], ['literowka']]);

  // Nowa seria z właściwości strony; okno ustawień otwiera się samo.
  await strona.selectOption('#wlasciwosci label:has-text("Seria") select', '+');
  await strona.waitForSelector('#dlg-seria[open]');
  assert.equal(await strona.inputValue('#dlg-seria select[name=tabela]'), 't_dni');
  assert.match(await strona.textContent('#seria-podsumowanie'), /Blok 1 strony × 3 = 3 strony w wydruku/);
  await strona.fill('#dlg-seria input[name=nazwa]', 'Dni');
  await strona.click('#zapisz-serie');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.serie[0]?.nazwa === 'Dni');
  await strona.waitForSelector('#lista-stron li.w-serii .znak-serii');
  assert.equal(await strona.textContent('#lista-stron li.w-serii .znak-serii'), '×3');
  await strona.waitForFunction(() => window.seriodruk.edytor.ostrzezenia.filter((o) => o.typ === 'nieznane_pole').length === 1);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.filter((o) => o.typ === 'nieznane_pole').map((o) => o.pola)), [['literowka']]);

  // Lista „Wstaw pole” zaczyna się od tabeli tej strony.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects()[0].id); });
  assert.equal(await strona.locator('#wlasciwosci select.wstaw-pole optgroup').first().getAttribute('label'), 'Tabela tej strony: Dni');
  await strona.selectOption('#wlasciwosci select.wstaw-pole', 'nr_ogolny');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.text), '{dzien} stycznia – {opis} {nr_ogolny}');

  // Podgląd: 1 strona zwykła + 3 egzemplarze, każdy ze swoimi danymi i numerem.
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad' && document.querySelectorAll('.podglad-strona[data-id]').length === 4);
  assert.match(await strona.textContent('#podglad-opis'), /^4 strony/);
  assert.deepEqual(await strona.locator('.podglad-strona[data-id] figcaption').allTextContents(), ['1 · Strona 1', '2 · Strona 2 · 1 z 3', '3 · Strona 2 · 2 z 3', '4 · Strona 2 · 3 z 3']);
  const teksty = await strona.evaluate(async () => {
    const { rozwin, wartosciPol } = await import('./js/serie.js');
    const { podstawWObiektach } = await import('./js/pola.js');
    const p = window.seriodruk.stan.projekt;
    const ciag = rozwin(p);
    return ciag.egzemplarze.slice(1).map((e) => podstawWObiektach(e.strona.obiekty, wartosciPol(p, e, ciag)).map((o) => o.text));
  });
  assert.deepEqual(teksty, [
    ['1 stycznia – Nowy Rok 2', 'str. 2 (I z 3) {literowka}'],
    ['2 stycznia – Wtorek 3', 'str. 3 (II z 3) {literowka}'],
    ['3 stycznia – Środa 4', 'str. 4 (III z 3) {literowka}'],
  ]);
  // Obrazy egzemplarzy naprawdę się różnią (każdy ma swoje dane).
  const obrazy = await strona.evaluate(async () => {
    const { rozwin } = await import('./js/serie.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const p = window.seriodruk.stan.projekt;
    const ciag = rozwin(p);
    const wynik = [];
    for (const e of ciag.egzemplarze.slice(1)) wynik.push(await renderujCel(p, e, { szerokoscPx: 300, spad: false, ciag }));
    return wynik.map((u) => u.length + u.slice(-60));
  });
  assert.equal(new Set(obrazy).size, 3);

  // Kliknięcie egzemplarza otwiera do edycji stronę-wzór.
  await strona.click('.podglad-strona[data-id] >> nth=3 >> .podglad-kartka');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'edytor' && window.seriodruk.stan.indeks === 1);
  assert.deepEqual(bledy, []);
});
