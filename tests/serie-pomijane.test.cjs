const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('wiersze pomijane (obliczenia): rok 365 dni w bloku 8 stron zaczyna się i kończy w środku bloku; tabela dodatkowa, numeracja, układy serii', async (t) => {
  const { strona } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const { nowyProjekt: nowy, nowaStrona, normalizuj } = await import('./js/projekt.js');
    const { rozwin, wartosciPol, bilansSerii, wierszPomijany } = await import('./js/serie.js');
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { parsujTekst, zWierszy } = await import('./js/tabele.js');
    const p = nowy('Kalendarz');
    const sek = p.sekcje[0].id;
    p.strony = ['Tytuł', ...Array.from({ length: 8 }, (_, i) => `D${i + 1}`), 'Koniec'].map((n) => nowaStrona(n, sek));
    for (const s of p.strony.slice(1, 9)) s.seria = 's1';
    // Dwa wiersze pomijane na początku (pisane różnie), potem 365 dni; miesiąc zmienia się co 31 dni (dla prostoty).
    const dni = Array.from({ length: 365 }, (_, i) => [String(i + 1), String(Math.floor(i / 31) + 1)]);
    p.tabele = [
      { id: 't1', nazwa: 'Dni', kolumny: ['dzien', 'miesiac'], wiersze: [['[pomiń]', ''], [' [POMIN] ', 'cokolwiek'], ...dni], unikalne: ['dzien'] },
      { id: 't2', nazwa: 'Okresy', kolumny: ['okres'], wiersze: Array.from({ length: 60 }, (_, i) => [`okres ${i + 1}`]) },
      { id: 't3', nazwa: 'Miesiace', kolumny: ['nazwa_m'], wiersze: Array.from({ length: 12 }, (_, i) => [`m${i + 1}`]) },
    ];
    p.serie = [{ id: 's1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'dlugi', ile: 1, dodatkowe: [{ tabela: 't2', co: 8 }, { tabela: 't3', co: 1, zmiana: 'miesiac' }] }];
    const proj = normalizuj(p);
    const seria = proj.serie[0];
    const ciag = rozwin(proj);
    const e = ciag.egzemplarze;
    const dane = (x) => `${x.strona.nazwa}:${x.wiersz ? x.wiersz.dzien : '-'}:egz${x.nrEgz}:${x.dodatkowe.map((d) => d.wiersz?.okres || d.wiersz?.nazwa_m).join('/')}:nr${x.nr}`;
    const wyniki = {
      stron: e.length,
      poczatek: e.slice(0, 8).map(dane),
      koniec: e.slice(-3).map(dane),
      bilans: bilansSerii(proj, seria, ciag).map((b) => [b.dlugosc, b.powielen, b.stron, b.pominietych, b.ostatniePelne]),
      pola: (() => { const pole = wartosciPol(proj, e[7], ciag); return ['dzien', 'egzemplarz', 'liczba_egzemplarzy', 'liczba_stron', 'nr', 'Okresy.okres', 'Miesiace.nazwa_m'].map((n) => pole(n, null)); })(),
      kontrola: sprawdzProjekt(proj, ciag).map((u) => u.rodzaj),
      rozpoznane: ['[pomiń]', '[POMIŃ]', '[pomin]', '[ Pomiń ]', 'pomiń', '[pomiń] x', ''].map((v) => wierszPomijany([v, 'a'])),
      zPliku: zWierszy(parsujTekst('dzien;opis\n[pomiń];\n1;a\n[pomin];x\n2;b\n')).wiersze.map((x) => [x[0], wierszPomijany(x)]),
    };
    // Wszystkie wiersze pomijane: seria nie daje stron, ale strony bloku mają wzór do edycji.
    const kopia = structuredClone(proj);
    kopia.tabele[0].wiersze = [['[pomiń]', ''], ['[pomiń]', '']];
    const pusty = rozwin(kopia);
    wyniki.pusty = { strony: pusty.egzemplarze.map((x) => x.strona.nazwa), wzory: kopia.strony.slice(1, 9).map((s) => Boolean(pusty.pierwszy.get(s.id).widmo)), nr: pusty.pierwszy.get(kopia.strony[1].id).nr, uwagi: sprawdzProjekt(kopia, pusty).map((u) => u.rodzaj) };
    // Jeden wiersz na cały blok: wiersz pomijany pomija całe powielenie; numer powielenia liczy miejsca.
    const szer = structuredClone(proj);
    for (const s of szer.strony.slice(3, 9)) delete s.seria; // blok 2 stron: D1, D2
    szer.serie[0] = { ...szer.serie[0], uklad: 'szeroki', dodatkowe: [{ tabela: 't2', co: 2 }] };
    szer.tabele[0].wiersze = [['a', ''], ['[pomiń]', ''], ['c', '']];
    wyniki.szeroki = rozwin(szer).egzemplarze.filter((x) => x.seria).map(dane);
    // Stała liczba powieleń: dane idą w kółko tylko po wierszach z danymi.
    szer.serie[0] = { ...szer.serie[0], tryb: 'stala', ile: 3, dodatkowe: [] };
    wyniki.stala = rozwin(szer).egzemplarze.filter((x) => x.seria && x.strona.nazwa === 'D1').map((x) => x.wiersz.dzien);
    // „Dokończ ostatni blok” dalej dopisuje strony bez danych.
    const dop = structuredClone(proj);
    dop.serie[0].dopelnij = true;
    const dopelniony = rozwin(dop);
    wyniki.dopelniony = [dopelniony.egzemplarze.length, dopelniony.egzemplarze.at(-2).strona.nazwa, dopelniony.egzemplarze.at(-2).wiersz.dzien ?? null];
    return wyniki;
  });
  // 365 stron; pierwsza to trzecia strona bloku, a ósma strona wydruku to pierwsza strona drugiego powielenia.
  assert.equal(w.stron, 1 + 365 + 1);
  assert.deepEqual(w.poczatek, [
    'Tytuł:-:egznull::nr1',
    'D3:1:egz1:okres 1/m1:nr2', 'D4:2:egz1:okres 1/m1:nr3', 'D5:3:egz1:okres 1/m1:nr4', 'D6:4:egz1:okres 1/m1:nr5', 'D7:5:egz1:okres 1/m1:nr6', 'D8:6:egz1:okres 1/m1:nr7',
    'D1:7:egz2:okres 2/m1:nr8',
  ]);
  // Rok kończy się w środku bloku: 2 + 365 = 367 miejsc = 45 pełnych bloków i 7 stron; ostatnia strona to D7.
  assert.deepEqual(w.koniec, ['D6:364:egz46:okres 46/m12:nr365', 'D7:365:egz46:okres 46/m12:nr366', 'Koniec:-:egznull::nr367']);
  assert.deepEqual(w.bilans, [[8, 46, 365, 2, false]]);
  assert.deepEqual(w.pola, ['7', '2', '46', '367', '8', 'okres 2', 'm1']);
  // Znacznik powtórzony w pilnowanej kolumnie nie jest powtórzeniem; brak uwag.
  assert.deepEqual(w.kontrola, []);
  assert.deepEqual(w.rozpoznane, [true, true, true, true, false, false, false]);
  assert.deepEqual(w.zPliku, [['[pomiń]', true], ['1', false], ['[pomin]', true], ['2', false]]);
  assert.deepEqual(w.pusty, { strony: ['Tytuł', 'Koniec'], wzory: Array(8).fill(true), nr: null, uwagi: ['seria_bez_stron'] });
  assert.deepEqual(w.szeroki, ['D1:a:egz1:okres 1:nr2', 'D2:a:egz1:okres 1:nr3', 'D1:c:egz3:okres 3:nr4', 'D2:c:egz3:okres 3:nr5']);
  assert.deepEqual(w.stala, ['a', 'c', 'a']);
  assert.deepEqual(w.dopelniony, [1 + 366 + 1, 'D8', null]);
});

test('wiersze pomijane w aplikacji: przycisk i znacznik w oknie Dane, okno serii, lista stron, podgląd, PDF, szablon danych', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tygodnik');
  await strona.evaluate(async () => {
    const { stan, zapiszTeraz, przeladuj } = window.seriodruk;
    const { nowaStrona } = await import('./js/projekt.js');
    const p = stan.projekt;
    const sek = p.sekcje[0].id;
    const tekst = (t0) => ({ type: 'textbox', left: 15, top: 30, width: 110, text: t0, fontSize: 5, fontFamily: 'Inter', fill: '#111111', styles: [], id: `o_${Math.random().toString(36).slice(2, 8)}` });
    p.strony = ['A', 'B', 'C'].map((n) => ({ ...nowaStrona(n, sek), seria: 'se1', obiekty: [tekst(`${n}: {dzien} str. {nr} z {liczba_stron}`)] }));
    p.tabele.push({ id: 't1', nazwa: 'Dni', kolumny: ['dzien', 'opis'], wiersze: [['pon', 'a'], ['wt', 'b'], ['śr', 'c'], ['czw', 'd']] });
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'dlugi', ile: 1, dodatkowe: [], dopelnij: false });
    await przeladuj();
    await zapiszTeraz();
    await window.seriodruk.przejdzDoStrony(0);
  });
  await strona.waitForSelector('#lista-stron li.w-serii .znak-serii');
  const znaczki = () => strona.locator('#lista-stron li.w-serii .znak-serii').allTextContents();
  assert.deepEqual(await znaczki(), ['×2', '×1', '×1']);

  // Okno Dane: bez kursora przycisk wstawia wiersz pomijany na początku tabeli.
  await strona.evaluate(() => window.seriodruk.dane.otworz('t1'));
  await strona.waitForSelector('#dlg-dane[open]');
  await strona.click('#dane-pomijany');
  const wiersze = () => strona.evaluate(() => [...document.querySelectorAll('#dane-siatka tbody tr')].map((tr) => `${tr.classList.contains('pomijany') ? '*' : ''}${tr.cells[1].textContent}`));
  assert.deepEqual(await wiersze(), ['*[pomiń]', 'pon', 'wt', 'śr', 'czw']);
  assert.match(await strona.textContent('#dane-pomijane'), /^1 wiersz pomijany \(\[pomiń\] w pierwszej komórce\): zajmuje miejsce w bloku serii, ale strona dla niego nie powstaje\.$/);
  // Z kursorem w wierszu „śr” – nad tym wierszem.
  await strona.click('#dane-siatka td[data-w="3"][data-k="1"]');
  await strona.click('#dane-pomijany');
  assert.deepEqual(await wiersze(), ['*[pomiń]', 'pon', 'wt', '*[pomiń]', 'śr', 'czw']);
  // Znacznik wpisany ręcznie (bez polskiego znaku, wielkimi literami) też oznacza wiersz; skasowany – zdejmuje oznaczenie.
  await strona.click('#dane-siatka td[data-w="5"][data-k="0"]');
  await strona.keyboard.press('Control+A');
  await strona.keyboard.type('[POMIN]');
  assert.deepEqual(await wiersze(), ['*[pomiń]', 'pon', 'wt', '*[pomiń]', 'śr', '*[POMIN]']);
  assert.match(await strona.textContent('#dane-pomijane'), /^3 wiersze pomijane/);
  await strona.keyboard.press('Control+A');
  await strona.keyboard.type('czw');
  assert.deepEqual(await wiersze(), ['*[pomiń]', 'pon', 'wt', '*[pomiń]', 'śr', 'czw']);
  await strona.click('#dane-zamknij');

  // Blok 3 stron, miejsca: [pomiń] pon wt | [pomiń] śr czw → strony B, C, B, C; strony A nie ma w wydruku.
  await strona.waitForFunction(() => document.querySelector('#lista-stron li.w-serii .znak-serii')?.textContent === '×0');
  assert.deepEqual(await znaczki(), ['×0', '×2', '×2']);
  assert.match(await strona.getAttribute('#lista-stron li.w-serii .miniatura', 'title'), /tej strony nie ma w wydruku – wszystkie jej wiersze są pomijane/);
  assert.match(await strona.textContent('.wlasciwosci'), /3 strony w bloku, 4 strony w wydruku – 2 wiersze pomijane/);
  await strona.evaluate(() => window.seriodruk.dane.otworzSerie('se1'));
  await strona.waitForSelector('#dlg-seria[open]');
  assert.equal(await strona.textContent('#seria-podsumowanie'), 'Blok 3 stron: w wydruku 4 strony. 2 wiersze tabeli są pomijane ([pomiń]) – zajmują miejsce w bloku, ale ich strony nie powstają.');
  assert.ok(await strona.isVisible('#seria-opis-pomijania'));
  await strona.click('#dlg-seria button[value=anuluj]:not(.przycisk-ikona)');

  // Edytor otwiera stronę, której nie ma w wydruku (wzór), bez błędów.
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(0));
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((o) => o.text?.startsWith('A:')));

  // Podgląd, numeracja i PDF: cztery strony.
  const wynik = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { rozwin, wartosciPol } = await import('./js/serie.js');
    const { ukladProjektu, stronyUkladu } = await import('./js/podglad.js');
    const { eksportujPdf } = await import('./js/eksport.js');
    const { szablonSerii } = await import('./js/kontrola.js');
    const ciag = rozwin(stan.projekt);
    const teksty = ciag.egzemplarze.map((e) => { const w = wartosciPol(stan.projekt, e, ciag); return `${e.strona.nazwa}: ${w('dzien')} str. ${w('nr')} z ${w('liczba_stron')}`; });
    const pdf = await eksportujPdf(stan.projekt, { znaki: false, spad: false });
    const dok = await window.PDFLib.PDFDocument.load(new Uint8Array(await pdf.blob.arrayBuffer()));
    const sz = szablonSerii(stan.projekt, stan.projekt.serie[0]);
    return { teksty, podglad: stronyUkladu(ukladProjektu(stan.projekt, ciag)).map((s) => `${s.nazwa} ${s.egz}`), pdf: dok.getPageCount(), szablon: sz.instrukcja[1][1], wierszeSzablonu: sz.wiersze.map((x) => x[0]) };
  });
  assert.deepEqual(wynik.teksty, ['B: pon str. 1 z 4', 'C: wt str. 2 z 4', 'B: śr str. 3 z 4', 'C: czw str. 4 z 4']);
  assert.deepEqual(wynik.podglad, ['B 1 z 2', 'C 1 z 2', 'B 2 z 2', 'C 2 z 2']);
  assert.equal(wynik.pdf, 4);
  assert.match(wynik.szablon, /Wiersz pomijany: wpisz \[pomiń\] w pierwszej komórce wiersza \(kolumna „dzien”\), a strona dla tego wiersza nie powstanie, choć wiersz zajmie swoje miejsce w bloku/);
  assert.deepEqual(wynik.wierszeSzablonu, ['[pomiń]', 'pon', 'wt', '[pomiń]', 'śr', 'czw']);

  // Kontrola przed drukiem nie zgłasza nic w związku z pomijanymi wierszami.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="kontrola"]');
  await strona.waitForSelector('#dlg-kontrola[open]');
  await strona.waitForFunction(() => /bez uwag|uwag/.test(document.querySelector('#dlg-kontrola').textContent) && !/Sprawdzam/.test(document.querySelector('#dlg-kontrola').textContent));
  assert.match(await strona.textContent('#dlg-kontrola'), /Wszystko w porządku: 4 strony bez uwag\./);
  assert.deepEqual(bledy, []);
});

test('lewa i prawa strona (obliczenia): puste strony na początku serii, w jej środku i za nią; wzór bloku w edytorze; bez pilnowania – uwaga o zamianie stron', async (t) => {
  const { strona } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const { nowyProjekt: nowy, nowaStrona, normalizuj } = await import('./js/projekt.js');
    const { rozwin, arkuszStrony, bokStrony, bilansSerii, wartosciPol } = await import('./js/serie.js');
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { ukladProjektu } = await import('./js/podglad.js');
    const p = nowy('Kalendarz', undefined, 'rozkladowki');
    const sek = p.sekcje[0].id;
    p.strony = ['Tytuł', ...Array.from({ length: 8 }, (_, i) => `D${i + 1}`), 'Koniec'].map((n) => nowaStrona(n, sek));
    for (const s of p.strony.slice(1, 9)) s.seria = 's1';
    // Trzy wiersze pomijane, potem 10 dni: dane kończą się na piątej stronie bloku (lewej).
    p.tabele = [{ id: 't1', nazwa: 'Dni', kolumny: ['dzien'], wiersze: [['[pomiń]'], ['[pomiń]'], ['[pomiń]'], ...Array.from({ length: 10 }, (_, i) => [String(i + 1)])] }];
    p.serie = [{ id: 's1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'dlugi', ile: 1, pilnuj_stron: true }];
    const proj = normalizuj(p);
    const opis = (c) => c.egzemplarze.map((e) => `${e.pusta ? 'pusta' : e.strona.nazwa}:${e.bok[0]}:${e.nr}`);
    const ciag = rozwin(proj);
    const wyniki = {
      pilnowane: opis(ciag),
      // Wzór w edytorze: strony stoją parami jak w układzie stron, choć pierwsze trzy nie mają egzemplarza w pierwszym powieleniu.
      arkusze: proj.strony.map((s) => arkuszStrony(s, ciag).map((x) => x.nazwa).join('+')),
      boki: proj.strony.map((s) => bokStrony(s, ciag)[0]).join(''),
      wzory: proj.strony.slice(1, 9).map((s) => Boolean(ciag.pierwszy.get(s.id).widmo)),
      // Wzór strony D1 pokazuje dane jej pierwszego prawdziwego egzemplarza (dzień 6, drugie powielenie).
      wzorD1: (() => { const e = ciag.pierwszy.get(proj.strony[1].id); const pole = wartosciPol(proj, e, ciag); return [pole('dzien', null), pole('nr', null), e.sasiad?.strona.nazwa]; })(),
      bilans: bilansSerii(proj, proj.serie[0], ciag).map((b) => [b.stron, b.pominietych, b.puste, b.zamianaOd]),
      uwagi: sprawdzProjekt(proj, ciag).map((u) => [u.rodzaj, u.strony, u.opis]),
      podglad: ukladProjektu(proj, ciag).sekcje[0].wiersze.map((r) => r.map((s) => (s ? `${s.pusta ? 'pusta' : s.nazwa}${s.pusta ? `→${proj.strony.find((x) => x.id === s.strona).nazwa}` : ''}` : '·')).join('|')),
      liczbaStron: ciag.liczbaStron,
    };
    // To samo bez pilnowania: żadnych pustych stron, strony bloku po przeciwnej stronie – uwaga przed drukiem.
    proj.serie[0].pilnuj_stron = false;
    const bez = rozwin(proj);
    wyniki.bez = opis(bez).slice(0, 4);
    wyniki.bezUwagi = sprawdzProjekt(proj, bez).map((u) => [u.rodzaj, u.strony]);
    wyniki.bezOpis = sprawdzProjekt(proj, bez)[0].opis;
    wyniki.bezBilans = bilansSerii(proj, proj.serie[0], bez).map((b) => [b.puste, b.zamianaOd]);
    // Wiersz pomijany w środku bloku dwóch stron: pusta strona w miejscu pominiętej.
    const srodek = normalizuj({ ...p, strony: ['A', 'B', 'Koniec'].map((n) => nowaStrona(n, sek)) });
    srodek.strony[0].seria = 's1'; srodek.strony[1].seria = 's1';
    srodek.serie[0].pilnuj_stron = true;
    srodek.tabele[0].wiersze = [['a'], ['b'], ['[pomiń]'], ['d']];
    wyniki.srodek = opis(rozwin(srodek));
    // Blok jednostronicowy: strony z natury na przemian; pilnowana jest tylko strona za serią.
    const jedna = normalizuj({ ...p, strony: ['Tytuł', 'Dzień', 'Koniec'].map((n) => nowaStrona(n, sek)) });
    jedna.strony[1].seria = 's1';
    jedna.serie[0].pilnuj_stron = true;
    jedna.tabele[0].wiersze = [['a'], ['[pomiń]'], ['c']];
    wyniki.jednaParzyscie = opis(rozwin(jedna)); // dwie strony dni: za nimi pusta
    jedna.tabele[0].wiersze = [['a'], ['b'], ['c']];
    wyniki.jednaNieparzyscie = opis(rozwin(jedna)); // trzy strony dni: bez pustej
    // Seria na końcu sekcji nie dostaje pustej strony za sobą.
    jedna.strony.pop();
    jedna.tabele[0].wiersze = [['a'], ['b']];
    wyniki.naKoncu = opis(rozwin(jedna));
    // Starsza seria (bez ustawienia) zachowuje się jak dotąd.
    wyniki.starsza = normalizuj({ ...p, serie: [{ id: 's1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'dlugi', ile: 1 }] }).serie[0].pilnuj_stron;
    return wyniki;
  });
  // Tytuł po prawej; D4 ma stać po prawej, więc przed nim pusta lewa. Dane kończą się na D5 (lewa): po prawej pusta,
  // a „Koniec” staje po lewej – tak jak w układzie stron.
  assert.deepEqual(w.pilnowane, ['Tytuł:p:1', 'pusta:l:2', 'D4:p:3', 'D5:l:4', 'D6:p:5', 'D7:l:6', 'D8:p:7', 'D1:l:8', 'D2:p:9', 'D3:l:10', 'D4:p:11', 'D5:l:12', 'pusta:p:13', 'Koniec:l:14']);
  assert.equal(w.liczbaStron, 14);
  assert.deepEqual(w.arkusze, ['Tytuł', 'D1+D2', 'D1+D2', 'D3+D4', 'D3+D4', 'D5+D6', 'D5+D6', 'D7+D8', 'D7+D8', 'Koniec']);
  assert.equal(w.boki, 'plplplplpl');
  assert.deepEqual(w.wzory, [true, true, true, false, false, false, false, false]);
  assert.deepEqual(w.wzorD1, ['6', '8', 'D2']);
  assert.deepEqual(w.bilans, [[10, 3, [2, 13], null]]);
  assert.deepEqual(w.uwagi.map((u) => [u[0], u[1]]), [['pusta_strona', [2, 13]]]);
  assert.equal(w.uwagi[0][2], 'Seria „Dni”: wstawione zostały puste strony (strony 2 i 13), żeby strony lewe zostały po lewej, a prawe po prawej. Pusta strona jest biała i liczy się w numeracji.');
  // Podgląd w parach: pusta strona zajmuje swoje miejsce w rozkładówce i prowadzi do strony serii.
  assert.deepEqual(w.podglad, ['·|Tytuł', 'pusta→D4|D4', 'D5|D6', 'D7|D8', 'D1|D2', 'D3|D4', 'D5|pusta→D8', 'Koniec|·']);
  assert.deepEqual(w.bez, ['Tytuł:p:1', 'D4:l:2', 'D5:p:3', 'D6:l:4']);
  assert.deepEqual(w.bezUwagi, [['zamiana_stron', [2]]]);
  assert.match(w.bezOpis, /^Seria „Dni”: od strony 2 strony bloku wychodzą po przeciwnej stronie rozkładówki niż w układzie stron .* Zaznacz w oknie serii „Pilnuj lewej i prawej strony”, a w takim miejscu stanie pusta strona\.$/);
  assert.deepEqual(w.bezBilans, [[[], 2]]);
  // Sekcja zaczyna się od prawej: A po prawej, B po lewej; po wierszu pomijanym B ma znów stać po lewej.
  assert.deepEqual(w.srodek, ['A:p:1', 'B:l:2', 'pusta:p:3', 'B:l:4', 'Koniec:p:5']);
  assert.deepEqual(w.jednaParzyscie, ['Tytuł:p:1', 'Dzień:l:2', 'Dzień:p:3', 'pusta:l:4', 'Koniec:p:5']);
  assert.deepEqual(w.jednaNieparzyscie, ['Tytuł:p:1', 'Dzień:l:2', 'Dzień:p:3', 'Dzień:l:4', 'Koniec:p:5']);
  assert.deepEqual(w.naKoncu, ['Tytuł:p:1', 'Dzień:l:2', 'Dzień:p:3']);
  assert.equal(w.starsza, false);
});

test('lewa i prawa strona w aplikacji: ustawienie w oknie serii, edytor otwiera parę ze wzorem, podgląd, PDF i „Sprawdź przed drukiem” z pustymi stronami', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Rozkładówki');
  // W projekcie bez rozkładówek ustawienia nie ma, a nowa seria go nie włącza.
  await strona.evaluate(() => { window.seriodruk.stan.projekt.tabele.push({ id: 't1', nazwa: 'Dni', kolumny: ['dzien'], wiersze: [['[pomiń]'], ['pon'], ['wt'], ['śr']] }); });
  await strona.selectOption('#wlasciwosci label:has-text("Seria") select', '+');
  await strona.waitForSelector('#dlg-seria[open]');
  assert.ok(await strona.isHidden('#seria-pole-strony'));
  await strona.click('#zapisz-serie');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.serie.length === 1);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.serie[0].pilnuj_stron), false);

  // Projekt z rozkładówkami: Tytuł, blok A+B (jeden wiersz na stronę), Koniec.
  await strona.evaluate(async () => {
    const { stan, zapiszTeraz, przeladuj, przejdzDoStrony } = window.seriodruk;
    const { nowaStrona } = await import('./js/projekt.js');
    const p = stan.projekt;
    const sek = p.sekcje[0];
    sek.uklad = 'rozkladowki';
    sek.pierwsza = 'prawa';
    p.serie = [];
    const tekst = (t0) => ({ type: 'textbox', left: 15, top: 30, width: 110, text: t0, fontSize: 6, fontFamily: 'Inter', fill: '#111111', styles: [], id: `o_${Math.random().toString(36).slice(2, 8)}` });
    p.strony = [
      { ...nowaStrona('Tytuł', sek.id), obiekty: [tekst('Tytuł')] },
      { ...nowaStrona('A', sek.id), obiekty: [tekst('A {dzien}')] },
      { ...nowaStrona('B', sek.id), obiekty: [tekst('B {dzien}')] },
      { ...nowaStrona('Koniec', sek.id), obiekty: [tekst('Koniec {nr}')] },
    ];
    await przeladuj();
    await zapiszTeraz();
    await przejdzDoStrony(1);
  });
  // Nowa seria w projekcie z rozkładówkami ma pilnowanie włączone i widoczne w oknie.
  await strona.selectOption('#wlasciwosci label:has-text("Seria") select', '+');
  await strona.waitForSelector('#dlg-seria[open]');
  assert.ok(await strona.isVisible('#seria-pole-strony'));
  assert.equal(await strona.isChecked('#dlg-seria input[name=pilnuj_stron]'), true);
  await strona.check('#dlg-seria input[name=uklad][value=dlugi]');
  await strona.fill('#dlg-seria input[name=nazwa]', 'Dni');
  await strona.click('#zapisz-serie');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.serie[0]?.nazwa === 'Dni');
  await strona.evaluate(async () => { window.seriodruk.stan.projekt.strony[2].seria = window.seriodruk.stan.projekt.serie[0].id; await window.seriodruk.przeladuj(); await window.seriodruk.zapiszTeraz(); });
  // Miejsca: [pomiń] pon | wt śr → B(pon), A(wt), B(śr). A stoi po lewej, B po prawej: przed pierwszym B pusta lewa strona.
  const ciag = () => strona.evaluate(async () => {
    const { rozwin } = await import('./js/serie.js');
    return rozwin(window.seriodruk.stan.projekt).egzemplarze.map((e) => `${e.pusta ? 'pusta' : e.strona.nazwa}:${e.bok[0]}`);
  });
  assert.deepEqual(await ciag(), ['Tytuł:p', 'pusta:l', 'B:p', 'A:l', 'B:p', 'Koniec:l']);
  await strona.evaluate(() => window.seriodruk.dane.otworzSerie(window.seriodruk.stan.projekt.serie[0].id));
  await strona.waitForSelector('#dlg-seria[open]');
  assert.equal(await strona.textContent('#seria-podsumowanie'), 'Blok 2 stron: w wydruku 3 strony. 1 wiersz tabeli jest pomijany ([pomiń]) – zajmuje miejsce w bloku, ale jego strona nie powstaje. Do tego 1 pusta strona (strona 2), żeby lewe strony zostały po lewej, a prawe po prawej.');
  // Wyłączenie pilnowania w oknie od razu pokazuje ostrzeżenie w podsumowaniu.
  await strona.uncheck('#dlg-seria input[name=pilnuj_stron]');
  assert.match(await strona.textContent('#seria-podsumowanie'), /Uwaga: od strony 2 strony bloku wychodzą po przeciwnej stronie rozkładówki – zaznacz „Pilnuj lewej i prawej strony”\.$/);
  await strona.check('#dlg-seria input[name=pilnuj_stron]');
  await strona.click('#zapisz-serie');

  // Edytor: strona A (jej pierwszego powielenia nie ma w wydruku) otwiera się w parze z B, A po lewej.
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(1));
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().filter((o) => /^[AB] /.test(o.text || '')).length === 2);
  const naPlotnie = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => /^[AB] /.test(o.text || '')).sort((a, b) => a.left - b.left).map((o) => o.text));
  assert.deepEqual(naPlotnie, ['A {dzien}', 'B {dzien}']);
  assert.deepEqual(await strona.evaluate(() => [...document.querySelectorAll('#lista-stron li.strona')].map((li) => `${li.querySelector('.nazwa').title}:${li.classList.contains('lewa') ? 'l' : 'p'}`)), ['Tytuł:p', 'A:l', 'B:p', 'Koniec:l']);

  // Podgląd, PDF (pusta strona jest w pliku i jest biała), kontrola przed drukiem.
  const wynik = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { rozwin } = await import('./js/serie.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const { eksportujPdf } = await import('./js/eksport.js');
    const ciagP = rozwin(stan.projekt);
    const pdf = await eksportujPdf(stan.projekt, { znaki: false, spad: false });
    const dok = await window.PDFLib.PDFDocument.load(new Uint8Array(await pdf.blob.arrayBuffer()));
    const obraz = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); renderujCel(stan.projekt, ciagP.egzemplarze[1], { szerokoscPx: 60, ciag: ciagP }).then((u) => { i.src = u; }); });
    const c = Object.assign(document.createElement('canvas'), { width: obraz.width, height: obraz.height });
    c.getContext('2d').drawImage(obraz, 0, 0);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let niebiale = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) niebiale += 1;
    return { pdf: dok.getPageCount(), uwagi: pdf.uwagi, niebiale };
  });
  assert.equal(wynik.pdf, 6);
  assert.equal(wynik.niebiale, 0, 'pusta strona jest biała');
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  assert.deepEqual(await strona.locator('.podglad-strona figcaption').allTextContents(), ['1 · Tytuł', '2 · Pusta strona', '3 · B · 1 z 2', '4 · A · 2 z 2', '5 · B · 2 z 2', '6 · Koniec']);
  await strona.click('[data-akcja="podglad-zamknij"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="kontrola"]');
  await strona.waitForSelector('#dlg-kontrola[open]');
  await strona.waitForFunction(() => /do sprawdzenia|bez uwag/.test(document.querySelector('#kontrola-stan').textContent));
  assert.match(await strona.textContent('#kontrola-lista'), /Seria „Dni”: wstawiona została pusta strona \(strona 2\), żeby strony lewe zostały po lewej, a prawe po prawej\./);
  assert.deepEqual(bledy, []);
});
