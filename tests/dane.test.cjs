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
    proj.serie[0].dopelnij = true;
    wyniki.dopelniony = opis(rozwin(proj));
    proj.serie[0].dopelnij = false;
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
  // Układ długi: 3 wiersze na blok 2 stron – seria kończy się na ostatnim wierszu, drugie powielenie ma jedną stronę.
  assert.deepEqual(w.dlugi, ['Tytuł:1:p:-', 'Dzień A#1:2:l:1', 'Dzień B#1:3:p:2', 'Dzień A#2:4:l:3', 'Koniec:5:p:-']);
  // Z opcją „dokończ blok” ostatnia strona bloku zostaje, bez danych.
  assert.deepEqual(w.dopelniony, ['Tytuł:1:p:-', 'Dzień A#1:2:l:1', 'Dzień B#1:3:p:2', 'Dzień A#2:4:l:3', 'Dzień B#2:5:p:undefined', 'Koniec:6:l:-']);
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

test('ramka tekstu i obraz z kolumny: stała wysokość, wyrównanie w pionie, zmniejszanie tekstu, podmiana obrazu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Ramka');
  await strona.click('[data-akcja="dodaj-tekst"]');
  const tekst = () => strona.evaluate(() => { const o = window.seriodruk.edytor.canvas.getObjects()[0]; return { h: Math.round(o.height * 10) / 10, pt: Math.round(o.fontSize * 72 / 25.4 * 10) / 10, gora: Math.round((o._getTopOffset() + o.height / 2) * 10) / 10, tresc: Math.round(o._wysokoscTresci * 10) / 10 }; });
  const naturalna = (await tekst()).h;

  // Stała wysokość 30 mm, tekst na środku w pionie.
  await strona.check('#wlasciwosci label:has-text("Stała wysokość ramki") input');
  await strona.fill('#wlasciwosci label:has-text("Wysokość ramki") input:not([type=checkbox])', '30');
  await strona.press('#wlasciwosci label:has-text("Wysokość ramki") input:not([type=checkbox])', 'Tab');
  await strona.click('#wlasciwosci button[title="Na środku ramki"]');
  let s = await tekst();
  assert.equal(s.h, 30);
  assert.ok(Math.abs(s.gora - (30 - naturalna) / 2) < 0.2, `treść odsunięta od góry o połowę luzu: ${JSON.stringify(s)}`);

  // Długi tekst nie mieści się w ramce: ostrzeżenie; z autodopasowaniem czcionka maleje, aż się zmieści.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.getObjects()[0].set('text', 'Bardzo długi opis dnia, który zajmuje wiele wierszy. '.repeat(12)); e.zatwierdz(); });
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.map((o) => o.typ)), ['nie_miesci_sie']);
  await strona.check('#wlasciwosci label:has-text("Zmniejszaj tekst") input');
  s = await tekst();
  assert.ok(s.pt < 14 && s.pt >= 6, `czcionka zmniejszona: ${s.pt} pt`);
  assert.ok(s.tresc <= 30.05, `treść mieści się w ramce: ${s.tresc} mm`);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.map((o) => o.typ)), []);
  // Krótszy tekst wraca do zadanego rozmiaru; ustawienia przechodzą przez zapis.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.getObjects()[0].set('text', 'Krótko'); e.zatwierdz(); });
  assert.equal((await tekst()).pt, 14);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  const zapis = await strona.evaluate(() => { const o = window.seriodruk.stan.projekt.strony[0].obiekty[0]; return [o.ramka_h, o.wyrownanie_pion, o.autodopasowanie, o.min_rozmiar, Math.round(o.rozmiar_bazowy * 72 / 25.4)]; });
  assert.deepEqual(zapis, [30, 'srodek', true, 6, 14]);

  // Obraz z kolumny: na każdym egzemplarzu plik o nazwie z tabeli, wpisany w ramkę wzoru.
  const kolory = await strona.evaluate(async () => {
    const plama = (kolor, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = kolor; x.fillRect(0, 0, w, h); return c.toDataURL('image/png'); };
    const { stan, edytor } = window.seriodruk;
    const p = stan.projekt;
    p.zasoby.z_wzor = { nazwa: 'wzor.png', dataUrl: plama('#888888', 40, 40) };
    p.zasoby.z_a = { nazwa: 'Czerwony.PNG', dataUrl: plama('#ff0000', 80, 40) };
    p.zasoby.z_b = { nazwa: 'zielony.png', dataUrl: plama('#00ff00', 20, 60) };
    p.tabele.push({ id: 't1', nazwa: 'Zdjęcia', kolumny: ['plik'], wiersze: [['czerwony'], ['zielony.png'], ['nie-ma-takiego']] });
    p.serie.push({ id: 'se1', nazwa: 'Zdjęcia', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    // Ramka wzoru: 40 × 40 mm w punkcie (50, 100).
    p.strony[0].obiekty = [{ type: 'image', version: '5.3.0', left: 50, top: 100, width: 40, height: 40, scaleX: 1, scaleY: 1, zasob: 'z_wzor', src: 'zasob:z_wzor', pole: { kolumna: 'plik' }, id: 'o_obraz' }];
    const { rozwin } = await import('./js/serie.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const ciag = rozwin(p);
    const wynik = [];
    for (const e of ciag.egzemplarze) {
      const url = await renderujCel(p, e, { szerokoscPx: 148, spad: false, ciag });
      const img = new Image();
      await new Promise((ok) => { img.onload = ok; img.src = url; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const piksel = (px, py) => [...x.getImageData(px, py, 1, 1).data].slice(0, 3).join(',');
      // środek ramki, punkt przy górnej krawędzi ramki, punkt przy lewej krawędzi ramki
      wynik.push([piksel(70, 120), piksel(70, 103), piksel(53, 120)]);
    }
    return wynik;
  });
  // Szeroki czerwony (80×40) wypełnia szerokość ramki, zostawia pasy u góry i dołu; wąski zielony – pasy po bokach.
  assert.deepEqual(kolory[0], ['255,0,0', '255,255,255', '255,0,0']);
  assert.deepEqual(kolory[1], ['0,255,0', '0,255,0', '255,255,255']);
  assert.notEqual(kolory[2][0], '255,255,255', 'brak pliku: w ramce znak zastępczy');
  assert.deepEqual(bledy, []);
});

test('szablon danych i kontrola przed drukiem: brakujące kolumny, plik Excela z instrukcją, pilnowanie powtórzeń', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Planer');
  const obliczenia = await strona.evaluate(async () => {
    const { stan, zapiszTeraz } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    p.tabele.push({ id: 't1', nazwa: 'Dni', kolumny: ['dzien', 'tag'], wiersze: [['1', 'praca'], ['2', 'dom'], ['3', 'praca'], ['4', '']], unikalne: ['tag'] });
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.zasoby.z1 = { nazwa: 'slonce.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBkYGBgYAAAhCAEB2eTzpAAAAABJRU5ErkJggg==' };
    p.strony[0].seria = 'se1';
    p.strony[0].nazwa = 'Dzień';
    p.strony[0].obiekty = [
      { type: 'textbox', version: '5.3.0', left: 10, top: 10, width: 100, text: '{dzien} – {tag}, {pogoda}, strona {nr}', styles: [], fontSize: 5, fontFamily: 'Inter', id: 'o1' },
      { type: 'image', version: '5.3.0', left: 10, top: 40, width: 2, height: 2, scaleX: 10, scaleY: 10, zasob: 'z1', src: 'zasob:z1', pole: { kolumna: 'ikona' }, id: 'o2' },
    ];
    await window.seriodruk.przeladuj(); // płótno wczytuje stronę od nowa
    const k = await import('./js/kontrola.js');
    const seria = p.serie[0];
    const szablon = k.szablonSerii(p, seria);
    return {
      potrzebne: k.kolumnySerii(p, seria).map((x) => [x.nazwa, x.obraz, x.strony]),
      brak: k.brakujaceKolumny(p, seria),
      szablon: [szablon.nazwa, szablon.kolumny, szablon.wiersze[0], szablon.instrukcja.slice(4).map((w) => w[0])],
      powtorzenia: k.powtorzenia(p.tabele[0], 'tag'),
      uwagi: k.sprawdzProjekt(p).map((u) => [u.rodzaj, u.strony, u.opis]),
    };
  });
  // {nr} to pole dokumentu – nie jest kolumną; {ikona} to obraz z kolumny.
  assert.deepEqual(obliczenia.potrzebne, [['dzien', false, ['Dzień']], ['tag', false, ['Dzień']], ['pogoda', false, ['Dzień']], ['ikona', true, ['Dzień']]]);
  assert.deepEqual(obliczenia.brak, ['pogoda', 'ikona']);
  assert.deepEqual(obliczenia.szablon, ['Dni', ['dzien', 'tag', 'pogoda', 'ikona'], ['1', 'praca', '', ''], ['dzien', 'tag', 'pogoda', 'ikona']]);
  assert.deepEqual(obliczenia.powtorzenia, [{ wartosc: 'praca', wiersze: [0, 2] }]);
  assert.deepEqual(obliczenia.uwagi, [
    ['nieznane_pole', [1, 2, 3, 4], 'Pole {pogoda} nie ma skąd wziąć wartości (nie ma takiej kolumny ani pola dokumentu) – strony 1, 2, 3 i 4.'],
    ['nieznane_pole', [1, 2, 3, 4], 'Pole {ikona} nie ma skąd wziąć wartości (nie ma takiej kolumny ani pola dokumentu) – strony 1, 2, 3 i 4.'],
    ['powtorzenie', [1, 3], 'Wartość „praca” z kolumny „tag” (tabela „Dni”) powtarza się na stronach 1 i 3.'],
  ]);

  // Okno serii: opis pól, dodanie brakujących kolumn, szablon w Excelu.
  await strona.evaluate(() => window.seriodruk.dane.otworzSerie('se1'));
  await strona.waitForSelector('#dlg-seria[open]');
  assert.equal(await strona.textContent('#seria-pola-opis'), 'Pola na stronach serii: {dzien}, {tag}, {pogoda}, {ikona}. W tabeli brakuje kolumn: pogoda, ikona.');
  await strona.click('#seria-dodaj-kolumny');
  assert.equal(await strona.textContent('#seria-pola-opis'), 'Pola na stronach serii: {dzien}, {tag}, {pogoda}, {ikona}. Tabela ma wszystkie potrzebne kolumny.');
  assert.ok(await strona.isHidden('#seria-dodaj-kolumny'));
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#seria-szablon')]);
  assert.equal(plik.suggestedFilename(), 'Planer - Dni - szablon.xlsx');
  const arkusze = await strona.evaluate(async () => {
    const wb = window.XLSX.read(await window.seriodruk.dane.ostatniSzablon.arrayBuffer(), { type: 'array' });
    return wb.SheetNames.map((n) => [n, window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' })]);
  });
  assert.deepEqual(arkusze[0], ['Dni', [['dzien', 'tag', 'pogoda', 'ikona'], ['1', 'praca', '', ''], ['2', 'dom', '', ''], ['3', 'praca', '', ''], ['4', '', '', '']]]);
  assert.equal(arkusze[1][0], 'Instrukcja');
  assert.deepEqual(arkusze[1][1][5], ['tag', 'Dzień', 'Tekst, który pojawi się w miejscu {tag}. Wartości nie mogą się powtarzać.']);
  assert.deepEqual(arkusze[1][1][7], ['ikona', 'Dzień', 'Nazwę pliku obrazu wgranego do projektu, np. zdjecie.jpg.']);
  await strona.click('#dlg-seria #zapisz-serie');

  // Wypełniony szablon wraca importem: dane podmienione, arkusz „Instrukcja” pominięty, pilnowanie zostaje.
  const wypelniony = await strona.evaluate(async () => {
    const wb = window.XLSX.read(await window.seriodruk.dane.ostatniSzablon.arrayBuffer(), { type: 'array' });
    window.XLSX.utils.sheet_add_aoa(wb.Sheets.Dni, [['1', 'praca', 'słońce', 'slonce'], ['2', 'dom', 'deszcz', 'chmura.png'], ['3', 'ogród', 'wiatr', '']], { origin: 'A2' });
    return window.XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  });
  await strona.evaluate(() => window.seriodruk.dane.otworz('t1'));
  await strona.waitForSelector('#dlg-dane[open]');
  assert.equal(await strona.locator('#dane-siatka td.powtorzona').count(), 2);
  assert.equal(await strona.textContent('#dane-powtorzenia'), 'Powtórzone wartości – „tag”: „praca” (wiersze 1, 3).');
  await strona.setInputFiles('#plik-dane', { name: 'Planer - Dni - szablon.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(wypelniony, 'base64') });
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].wiersze[2]?.[1] === 'ogród');
  const poImporcie = await strona.evaluate(() => { const p = window.seriodruk.stan.projekt; return [p.tabele.length, p.tabele[0].kolumny, p.tabele[0].wiersze.length, p.tabele[0].unikalne]; });
  assert.deepEqual(poImporcie, [1, ['dzien', 'tag', 'pogoda', 'ikona'], 4, ['tag']]);
  assert.equal(await strona.locator('#dane-siatka td.powtorzona').count(), 0);
  assert.ok(await strona.isHidden('#dane-powtorzenia'));

  // Przełącznik ≠ w nagłówku kolumny: wpisane powtórzenie od razu widać.
  await strona.click('#dane-siatka .pilnuj-kolumne[data-k="0"]');
  await strona.click('#dane-siatka td[data-w="3"][data-k="0"]');
  await strona.keyboard.press('Control+A');
  await strona.keyboard.type('2');
  assert.equal(await strona.locator('#dane-siatka td.powtorzona').count(), 2);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.tabele[0].unikalne), ['tag', 'dzien']);
  await strona.click('#dane-zamknij');

  // Okno PDF pokazuje, co sprawdzić: powtórzenie i brak pliku obrazu.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  assert.equal(await strona.textContent('#pdf-uwagi summary'), 'Do sprawdzenia przed drukiem: 2 uwagi');
  assert.deepEqual(await strona.locator('#pdf-uwagi li').allTextContents(), [
    'Nie ma w projekcie obrazu „chmura.png” (kolumna „ikona”) – strona 2.',
    'Wartość „2” z kolumny „dzien” (tabela „Dni”) powtarza się na stronach 2 i 4.',
  ]);
  assert.deepEqual(bledy, []);
});

test('serie z dodatkowymi tabelami: wiersz co kilka stron, krótszy pierwszy okres, braki danych, koniec serii na ostatnim wierszu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tygodnie');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    p.tabele.push({ id: 't_dni', nazwa: 'Dni', kolumny: ['dzien', 'haslo'], wiersze: Array.from({ length: 10 }, (_, i) => [String(i + 1), `dzień ${i + 1}`]) });
    p.tabele.push({ id: 't_tyg', nazwa: 'Tygodnie', kolumny: ['haslo', 'nr_tyg'], wiersze: [['Start', '1'], ['Rozpęd', '2']], unikalne: ['haslo'] });
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: 't_dni', tryb: 'tabela', uklad: 'dlugi', ile: 1, dodatkowe: [{ tabela: 't_tyg', co: 4, pierwszy: 2 }] });
    // Blok z trzech stron: 10 wierszy = 3 pełne powielenia i jedna strona czwartego.
    const wzor = (id, nazwa, tekst) => ({ ...structuredClone(p.strony[0]), id, nazwa, seria: 'se1', obiekty: [{ type: 'textbox', version: '5.3.0', left: 10, top: 10, width: 100, text: tekst, styles: [], fontSize: 5, fontFamily: 'Inter', id: `o_${id}` }] });
    p.strony = [wzor('s_a', 'A', '{dzien}: {haslo} / {Tygodnie.haslo} (tydzień {nr_tyg})'), wzor('s_b', 'B', '{dzien} {Dni.haslo}'), wzor('s_c', 'C', '{dzien}')];
    await window.seriodruk.przeladuj();
    const { rozwin, wartosciPol, bilansSerii, polePoTabelach } = await import('./js/serie.js');
    const { sprawdzProjekt, kolumnySerii } = await import('./js/kontrola.js');
    const { podstawWTekscie } = await import('./js/pola.js');
    const ciag = rozwin(p);
    const teksty = ciag.egzemplarze.map((e) => `${e.strona.nazwa}${e.nrEgz}: ${podstawWTekscie(e.strona.obiekty[0].text, [], wartosciPol(p, e, ciag)).text}`);
    const b = bilansSerii(p, p.serie[0], ciag)[0];
    return {
      teksty,
      bilans: [b.dlugosc, b.powielen, b.stron, b.ostatniePelne, b.dodatkowe.map((d) => [d.tabela.nazwa, d.co, d.potrzeba, d.jest, d.brakOd])],
      uwagi: sprawdzProjekt(p, ciag).map((u) => [u.rodzaj, u.opis]),
      kolumny: kolumnySerii(p, p.serie[0]).map((k) => k.nazwa),
      pola: [polePoTabelach('tygodnie.haslo', p.tabele)?.tabela.nazwa, polePoTabelach('haslo', p.tabele)?.tabela.nazwa, polePoTabelach('Tygodnie.brak', p.tabele)],
      znane: ['haslo', 'Tygodnie.haslo', 'nr_tyg', 'Tygodnie.brak', 'obce'].map((n) => window.seriodruk.edytor.znanePole(n, 0)),
    };
  });
  // Pierwszy wiersz tygodni obowiązuje przez 2 strony, potem nowy co 4; od 7. strony tygodni brakuje – pola są puste.
  assert.deepEqual(w.teksty, [
    'A1: 1: dzień 1 / Start (tydzień 1)', 'B1: 2 dzień 2', 'C1: 3',
    'A2: 4: dzień 4 / Rozpęd (tydzień 2)', 'B2: 5 dzień 5', 'C2: 6',
    'A3: 7: dzień 7 /  (tydzień )', 'B3: 8 dzień 8', 'C3: 9',
    'A4: 10: dzień 10 /  (tydzień )',
  ]);
  assert.deepEqual(w.bilans, [3, 4, 10, false, [['Tygodnie', 4, 3, 2, 7]]]);
  assert.deepEqual(w.uwagi, [['brak_danych', 'Seria „Dni”: tabela „Tygodnie” ma 2 wiersze, a potrzeba 3 (nowy wiersz co 4 strony). Od strony 7 do 10 jej pola zostaną puste.']]);
  // Szablon danych tabeli głównej nie zawiera pól z tabeli dodatkowej.
  assert.deepEqual(w.kolumny, ['dzien', 'haslo']);
  assert.deepEqual(w.pola, ['Tygodnie', 'Dni', null]);
  assert.deepEqual(w.znane, [true, true, true, false, false]);

  // Panel strony pokazuje brak danych; okno serii – bilans, pozwala dodać i usunąć tabelę dodatkową.
  assert.match(await strona.textContent('.wlasciwosci'), /3 strony × 4 powielenia = 10 stron w wydruku \(seria kończy się na ostatnim wierszu danych/);
  assert.match(await strona.textContent('.wlasciwosci'), /Brakuje danych: tabela „Tygodnie” ma 2 wiersze, a potrzeba 3 \(1 za mało\)\. Od strony 7 jej pola będą puste\./);
  await strona.evaluate(() => window.seriodruk.dane.otworzSerie('se1'));
  await strona.waitForSelector('#dlg-seria[open]');
  assert.equal(await strona.textContent('#seria-podsumowanie'), 'Blok 3 stron × 4 = 10 stron w wydruku. Seria kończy się na ostatnim wierszu danych – ostatnie powielenie bloku jest niepełne. Tabela „Tygodnie”: nowy wiersz co 4 strony – potrzeba 3 wierszy, a jest tylko 2.');
  assert.ok(await strona.isVisible('#seria-braki'));
  // Dłuższy okres (co 5 stron, pierwszy przez 5): dwa wiersze wystarczą na 10 stron.
  await strona.fill('.wiersz-dodatkowej [data-pole="co"]', '5');
  await strona.fill('.wiersz-dodatkowej [data-pole="pierwszy"]', '');
  assert.match(await strona.textContent('#seria-podsumowanie'), /nowy wiersz co 5 stron – potrzeba 2 wierszy, jest 2\.$/);
  assert.ok(await strona.isHidden('#seria-braki'));
  // „Dokończ ostatni blok”: 12 stron zamiast 10.
  await strona.check('#dlg-seria input[name=dopelnij]');
  assert.match(await strona.textContent('#seria-podsumowanie'), /^Blok 3 stron × 4 = 12 stron w wydruku\. Tabela/);
  await strona.uncheck('#dlg-seria input[name=dopelnij]');
  await strona.click('#dlg-seria #zapisz-serie');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.serie[0].dodatkowe[0].co === 5); // zapis następuje po zamknięciu okna
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.serie[0].dodatkowe), [{ tabela: 't_tyg', co: 5 }]);

  // Lista „Wstaw pole” ma grupę tabeli dodatkowej z nazwą tabeli w polu.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects()[0].id); });
  const opcje = await strona.locator('.wlasciwosci optgroup[label="Tabela dodatkowa serii: Tygodnie"] option').allTextContents();
  assert.deepEqual(opcje.map((o) => o.replace(/[{}]/g, '').trim()), ['Tygodnie.haslo', 'Tygodnie.nr_tyg']);

  // Zmiana nazwy tabeli i kolumny poprawia pola z nazwą tabeli.
  await strona.evaluate(() => { window.seriodruk.edytor.odznacz(); window.seriodruk.dane.otworz('t_tyg'); });
  await strona.waitForSelector('#dlg-dane[open]');
  await strona.fill('#dane-nazwa', 'Tyg');
  await strona.press('#dane-nazwa', 'Tab');
  await strona.click('#dane-siatka .nazwa-kolumny[data-k="0"]');
  await strona.keyboard.press('Control+A');
  await strona.keyboard.type('motto');
  await strona.keyboard.press('Enter');
  await strona.click('#dane-zamknij');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty[0].text), '{dzien}: {haslo} / {Tyg.motto} (tydzień {nr_tyg})');

  // Usunięcie tabeli dodatkowej odpina ją od serii.
  await strona.evaluate(() => window.seriodruk.dane.otworz('t_tyg'));
  await strona.click('#dane-usun');
  await strona.click('#potwierdz-tak');
  await strona.click('#dane-zamknij');
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.serie[0].dodatkowe), []);
  assert.deepEqual(bledy, []);
});

test('wygląd z danych: kolor z kolumny i przesunięcie według numeru powielenia (zakładki na brzegu strony)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Zakładki');
  const obliczenia = await strona.evaluate(async () => {
    const { kolorZWartosci, liczbaZWartosci, przesuniecieZDanych } = await import('./js/pola.js');
    const w = (v) => () => v;
    return {
      kolory: ['#C00', 'ff8800', ' rgb(1, 2, 3) ', 'navy', 'niekolor', ''].map(kolorZWartosci),
      liczby: ['3', '2,5', '-1.25', 'trzy', ''].map(liczbaZWartosci),
      // Pozycje 1–8 z krokiem 30 mm, od nowa co 6: siódma wraca na miejsce pierwszej.
      pozycje: [1, 2, 6, 7, 8].map((n) => przesuniecieZDanych({ pole: 'x', tryb: 'pozycja', krok: 30, co: 6 }, w(String(n)))),
      bezPowrotu: przesuniecieZDanych({ pole: 'x', tryb: 'pozycja', krok: 30 }, w('8')),
      mm: [przesuniecieZDanych({ pole: 'x', tryb: 'mm' }, w('12,5')), przesuniecieZDanych({ pole: 'x', tryb: 'mm' }, w('abc')), przesuniecieZDanych({ pole: 'x', tryb: 'mm' }, w(undefined))],
    };
  });
  assert.deepEqual(obliczenia.kolory, ['#C00', '#ff8800', 'rgb(1, 2, 3)', 'navy', null, null]);
  assert.deepEqual(obliczenia.liczby, [3, 2.5, -1.25, null, null]);
  assert.deepEqual(obliczenia.pozycje, [0, 30, 150, 0, 30]);
  assert.equal(obliczenia.bezPowrotu, 210);
  assert.deepEqual(obliczenia.mm, [12.5, 0, 0]);

  // Strona powielana 8 razy; tabela podaje kolor zakładki, a numer powielenia – jej położenie.
  await strona.evaluate(async () => {
    const { stan, edytor, zapiszTeraz } = window.seriodruk;
    const p = stan.projekt;
    p.tabele.push({ id: 't1', nazwa: 'Miesiące', kolumny: ['miesiac', 'barwa'], wiersze: [['Styczeń', '#ff0000'], ['Luty', '00ff00'], ['Marzec', 'blue'], ['Kwiecień', 'niekolor'], ['Maj', '#ff0000'], ['Czerwiec', '#ff0000'], ['Lipiec', '#00ff00'], ['Sierpień', '']] });
    p.serie.push({ id: 'se1', nazwa: 'Miesiące', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1, dodatkowe: [] });
    p.strony[0].seria = 'se1';
    await window.seriodruk.przeladuj();
    const r = edytor.dodajProstokat();
    r.set({ left: 130, top: 10, width: 18, height: 20, fill: '#808080', strokeWidth: 0, nazwa: 'Zakładka' });
    r.setCoords();
    edytor.zatwierdz();
    await zapiszTeraz();
  });
  // Panel „Z danych”: kolor z kolumny, przesunięcie w pionie z numeru powielenia, krok 30 mm, od nowa co 6.
  await strona.selectOption('.wlasciwosci label:has-text("Kolor z pola") select', 'barwa');
  await strona.selectOption('.wlasciwosci label:has-text("Przesunięcie w pionie z pola") select', 'egzemplarz');
  await strona.fill('.wlasciwosci label:has-text("Krok") input', '30');
  await strona.press('.wlasciwosci label:has-text("Krok") input', 'Tab');
  await strona.fill('.wlasciwosci label:has-text("Od nowa co") input', '6');
  await strona.press('.wlasciwosci label:has-text("Od nowa co") input', 'Tab');
  const zapis = await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); const o = window.seriodruk.stan.projekt.strony[0].obiekty[0]; return [o.z_danych, o.top, o.fill]; });
  assert.deepEqual(zapis, [{ kolor: 'barwa', y: { tryb: 'pozycja', krok: 30, co: 6, pole: 'egzemplarz' } }, 10, '#808080'], 'w projekcie zostaje wzór i reguła');

  const piksele = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const { rozwin } = await import('./js/serie.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const ciag = rozwin(p);
    const wynik = [];
    for (const e of ciag.egzemplarze) {
      const url = await renderujCel(p, e, { szerokoscPx: 148, spad: false, ciag });
      const img = new Image();
      await new Promise((ok) => { img.onload = ok; img.src = url; });
      const k = document.createElement('canvas'); k.width = img.width; k.height = img.height;
      const kx = k.getContext('2d'); kx.drawImage(img, 0, 0);
      const kolor = (y) => [...kx.getImageData(139, y, 1, 1).data].slice(0, 3).join(',');
      // środek zakładki w każdej z sześciu pozycji (co 30 mm od 10 mm)
      wynik.push([0, 1, 2, 3, 4, 5].map((i) => kolor(20 + 30 * i)));
    }
    return wynik;
  });
  const B = '255,255,255';
  const rzad = (pozycja, kolor) => [0, 1, 2, 3, 4, 5].map((i) => (i === pozycja ? kolor : B));
  assert.deepEqual(piksele[0], rzad(0, '255,0,0'));
  assert.deepEqual(piksele[1], rzad(1, '0,255,0'), 'kolor bez krzyżyka też działa');
  assert.deepEqual(piksele[2], rzad(2, '0,0,255'), 'nazwa koloru');
  assert.deepEqual(piksele[3], rzad(3, '128,128,128'), 'zła wartość – zostaje kolor wzoru');
  assert.deepEqual(piksele[5], rzad(5, '255,0,0'));
  assert.deepEqual(piksele[6], rzad(0, '0,255,0'), 'siódma strona wraca na pierwszą pozycję');
  assert.deepEqual(piksele[7], rzad(1, '128,128,128'), 'pusta komórka – kolor wzoru');

  // Zmiana nazwy kolumny poprawia regułę; nieznane pole trafia do ostrzeżeń i na listę przed drukiem.
  const poZmianie = await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const { zmienNazwePola } = await import('./js/tabele.js');
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const p = stan.projekt;
    p.tabele[0].kolumny[1] = 'kolor';
    zmienNazwePola(p, 'barwa', 'kolor');
    const regula = p.strony[0].obiekty[0].z_danych.kolor;
    p.strony[0].obiekty[0].z_danych.kolor = 'nie_ma_takiej';
    await window.seriodruk.przeladuj();
    return { regula, ostrzezenia: edytor.ostrzezenia.filter((o) => o.typ === 'nieznane_pole').map((o) => [o.typ, o.pola]), uwagi: sprawdzProjekt(p).map((u) => u.rodzaj) };
  });
  assert.equal(poZmianie.regula, 'kolor');
  assert.deepEqual(poZmianie.ostrzezenia, [['nieznane_pole', ['nie_ma_takiej']]]);
  assert.deepEqual(poZmianie.uwagi, ['nieznane_pole']);
  assert.deepEqual(bledy, []);
});

test('zwykłe klamry, obraz wypełniający ramkę, sprawdzenie tekstów na wszystkich powielonych stronach, długa tabela', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kontrola');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    const plama = (kolor, sz, wy) => { const c = document.createElement('canvas'); c.width = sz; c.height = wy; const x = c.getContext('2d'); x.fillStyle = kolor; x.fillRect(0, 0, sz, wy); x.fillStyle = '#0000ff'; x.fillRect(0, 0, sz / 4, wy); return c.toDataURL('image/png'); };
    p.zasoby.z_wzor = { nazwa: 'wzor.png', dataUrl: plama('#888888', 40, 40) };
    p.zasoby.z_a = { nazwa: 'szeroki.png', dataUrl: plama('#ff0000', 160, 40) }; // 4:1, lewa ćwiartka niebieska
    p.tabele.push({ id: 't1', nazwa: 'Opisy', kolumny: ['plik', 'opis'], wiersze: [['szeroki', 'Krótko'], ['szeroki', 'Bardzo długi opis, który na pewno nie zmieści się w jednym wierszu tak wąskiej ramki tekstu'], ['szeroki', 'Też krótko']] });
    p.serie.push({ id: 'se1', nazwa: 'Opisy', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1, dodatkowe: [] });
    p.strony[0].seria = 'se1';
    const tekst = (id, text, top, dodatki = {}) => ({ type: 'textbox', version: '5.3.0', left: 10, top, width: 40, text, styles: [], fontSize: 5, fontFamily: 'Inter', fill: '#000000', lineHeight: 1.2, id, ...dodatki });
    p.strony[0].obiekty = [
      tekst('o_opis', '{opis}', 10, { ramka_h: 7 }),
      tekst('o_klamry', 'Wzór: f(x) = {x + 1} i {opis}', 30, { width: 120, bez_pol: true }),
      { type: 'image', version: '5.3.0', left: 50, top: 100, width: 40, height: 40, scaleX: 1, scaleY: 1, zasob: 'z_wzor', src: 'zasob:z_wzor', pole: { kolumna: 'plik', tryb: 'wypelnij' }, id: 'o_obraz' },
    ];
    await window.seriodruk.przeladuj();
    const { rozwin, wartosciPol } = await import('./js/serie.js');
    const { podstawWObiektach } = await import('./js/pola.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const { sprawdzWszystko } = await import('./js/kontrola-skladu.js');
    const ciag = rozwin(p);
    const url = await renderujCel(p, ciag.egzemplarze[0], { szerokoscPx: 148, spad: false, ciag });
    const img = new Image();
    await new Promise((ok) => { img.onload = ok; img.src = url; });
    const k = document.createElement('canvas'); k.width = img.width; k.height = img.height;
    const kx = k.getContext('2d'); kx.drawImage(img, 0, 0);
    const piksel = (px, py) => [...kx.getImageData(px, py, 1, 1).data].slice(0, 3).join(',');
    return {
      klamry: podstawWObiektach(p.strony[0].obiekty, wartosciPol(p, ciag.egzemplarze[0], ciag)).map((o) => o.text).slice(0, 2),
      ostrzezenia: window.seriodruk.edytor.ostrzezenia.filter((o) => o.typ === 'nieznane_pole').length,
      // Ramka 40 × 40 mm od (50, 100). Obraz 4:1 wypełnia ją na wysokość: widać środkowy kwadrat, czerwony aż po rogi.
      obraz: [piksel(52, 102), piksel(88, 138), piksel(70, 120), piksel(48, 120), piksel(92, 120)],
      uwagi: (await sprawdzWszystko(p, ciag)).map((u) => [u.rodzaj, u.strony, u.idStrony === p.strony[0].id, u.idObiektu, u.opis]),
    };
  });
  assert.deepEqual(w.klamry, ['Krótko', 'Wzór: f(x) = {x + 1} i {opis}'], 'tekst z przełącznikiem zostaje dosłowny');
  assert.equal(w.ostrzezenia, 0, 'zwykłe klamry nie dają ostrzeżenia o nieznanym polu');
  assert.deepEqual(w.obraz, ['255,0,0', '255,0,0', '255,0,0', '255,255,255', '255,255,255']);
  assert.deepEqual(w.uwagi, [['nie_miesci_sie', [2], true, 'o_opis', 'Tekst „Bardzo długi opis, który na pe…” nie mieści się w ramce – strona 2.']]);

  // Okno „Sprawdź przed drukiem”: ta sama uwaga, „Pokaż” otwiera stronę i zaznacza ramkę.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="kontrola"]');
  await strona.waitForSelector('#dlg-kontrola[open]');
  await strona.waitForFunction(() => /1 uwaga do sprawdzenia/.test(document.querySelector('#kontrola-stan').textContent));
  assert.equal(await strona.textContent('#kontrola-lista li span'), 'Tekst „Bardzo długi opis, który na pe…” nie mieści się w ramce – strona 2.');
  await strona.click('#kontrola-lista li button');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.id === 'o_opis');
  // Przełącznik klamr jest w panelu tekstu, gdy w tekście są klamry.
  assert.ok(await strona.locator('.wlasciwosci label:has-text("Klamry { } to zwykły tekst")').count());
  // Okno PDF dopisuje tę uwagę po chwili.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForFunction(() => /1 uwaga/.test(document.querySelector('#pdf-uwagi summary').textContent));
  await strona.click('#pdf-anuluj');

  // Długa tabela: wiersze dorysowują się przy przewijaniu, a przejście do dalekiej komórki ją pokazuje.
  await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    p.tabele.push({ id: 't_dluga', nazwa: 'Długa', kolumny: ['nr', 'tekst'], wiersze: Array.from({ length: 2600 }, (_, i) => [String(i + 1), `wiersz ${i + 1}`]) });
    window.seriodruk.dane.otworz('t_dluga');
  });
  await strona.waitForSelector('#dlg-dane[open]');
  assert.equal(await strona.locator('#dane-siatka tbody tr').count(), 400);
  await strona.evaluate(() => { const o = document.querySelector('.dane-siatka-opak'); o.scrollTop = o.scrollHeight; });
  await strona.waitForFunction(() => document.querySelectorAll('#dane-siatka tbody tr').length === 800);
  const daleka = await strona.evaluate(() => { const d = window.seriodruk.dane; const td = d._komorka(2599, 1); return [td?.textContent, document.querySelectorAll('#dane-siatka tbody tr').length]; });
  assert.deepEqual(daleka, ['wiersz 2600', 2600]);
  await strona.click('#dane-siatka td[data-w="2599"][data-k="1"]');
  await strona.keyboard.press('Control+A');
  await strona.keyboard.type('ostatni');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.tabele[1].wiersze[2599][1]), 'ostatni');
  assert.deepEqual(bledy, []);
});
