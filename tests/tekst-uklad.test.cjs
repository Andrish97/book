const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const DLUGI = 'Pierwsze zdanie tekstu, które jest dość długie. Drugie zdanie idzie zaraz po nim i też zajmuje sporo miejsca.\nNowy akapit zaczyna się tutaj i ciągnie przez kilka wierszy, żeby było co przelewać między ramkami.\nTrzeci akapit kończy całość.';

test('przelewanie (obliczenia): sklejanie i dzielenie tekstu z formatowaniem fragmentów', async (t) => {
  const { strona } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const { polaczCzesci, podzielTekst } = await import('./js/watki.js');
    const pogrubienie = { fontWeight: 'bold' };
    // „Ala ma kota\ni psa” – pogrubione „ma kota” (znaki 4–11) i „psa” (13–16; nowa linia się nie liczy).
    const tekst = 'Ala ma kota\ni psa';
    const style = [{ start: 4, end: 11, style: pogrubienie }, { start: 13, end: 16, style: pogrubienie }];
    const naSpacji = podzielTekst(tekst, style, 7); // przed „kota”
    const naAkapicie = podzielTekst(tekst, style, 12); // przed „i psa”
    const wSlowie = podzielTekst(tekst, style, 9); // w środku „kota”
    return {
      naSpacji, naAkapicie, wSlowie,
      calosc: podzielTekst(tekst, style, 99),
      zPowrotem: [naSpacji, naAkapicie, wSlowie].map((cz) => polaczCzesci(cz)),
      zPusta: polaczCzesci([{ text: 'A', styles: [] }, { text: '', styles: [], lacznik: '\n' }, { text: 'B', styles: [{ start: 0, end: 1, style: pogrubienie }], lacznik: '\n' }]),
    };
  });
  const b = { fontWeight: 'bold' };
  assert.deepEqual(w.naSpacji, [{ text: 'Ala ma', styles: [{ start: 4, end: 6, style: b }] }, { text: 'kota\ni psa', styles: [{ start: 0, end: 4, style: b }, { start: 6, end: 9, style: b }], lacznik: ' ' }]);
  assert.deepEqual(w.naAkapicie, [{ text: 'Ala ma kota', styles: [{ start: 4, end: 11, style: b }] }, { text: 'i psa', styles: [{ start: 2, end: 5, style: b }], lacznik: '\n' }]);
  assert.deepEqual(w.wSlowie.map((x) => [x.text, x.lacznik]), [['Ala ma ko', undefined], ['ta\ni psa', '']]);
  assert.deepEqual(w.calosc[1], { text: '', styles: [], lacznik: '\n' });
  for (const z of w.zPowrotem) assert.equal(z.text, 'Ala ma kota\ni psa');
  // Po sklejeniu styl przeciętego fragmentu wraca w dwóch kawałkach, ale w tych samych miejscach.
  assert.deepEqual(w.zPowrotem[0].styles, [{ start: 4, end: 6, style: b }, { start: 7, end: 11, style: b }, { start: 13, end: 16, style: b }]);
  assert.deepEqual(w.zPusta, { text: 'A\nB', styles: [{ start: 1, end: 2, style: b }] });
});

test('lista: wcięcie i znaki przed akapitami, numeracja, zapis w projekcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Lista');
  const w = await strona.evaluate(async () => {
    const { stan, edytor, zapiszTeraz } = window.seriodruk;
    const o = edytor.dodajTekst('Mleko\nChleb razowy na zakwasie, krojony, najlepiej jeszcze ciepły z piekarni za rogiem\nMasło');
    o.set({ left: 20, top: 30, width: 80, fill: '#000000' });
    const bez = { wierszy: o._textLines.length, odLewej: o._getLineLeftOffset(0) };
    edytor.formatujTekst(() => ({ lista: 'numery' }), true);
    const numery = { wierszy: o._textLines.length, odLewej: o._getLineLeftOffset(0), najszerszy: Math.max(...o._textLines.map((_, i) => o.getLineWidth(i))) };
    await zapiszTeraz();
    const { renderujCel } = await import('./js/zlozenie.js');
    // Ciemne piksele w pasie wcięcia (na lewo od tekstu) – tam stoją numery albo punkty.
    const wPasie = async () => {
      const url = await renderujCel(stan.projekt, stan.projekt.strony[0], { szerokoscPx: 592, spad: false });
      const img = new Image();
      await new Promise((ok) => { img.onload = ok; img.src = url; });
      const k = document.createElement('canvas'); k.width = img.width; k.height = img.height;
      const kx = k.getContext('2d'); kx.drawImage(img, 0, 0);
      const s = 592 / 148;
      const hw = o.getHeightOfLine(0);
      // nr wiersza → liczba ciemnych pikseli w pasie wcięcia na jego wysokości
      return (wiersz) => {
        const pas = kx.getImageData(Math.round(20 * s), Math.round((30 + wiersz * hw) * s), Math.round(numery.odLewej * s) - 2, Math.round(hw * s)).data;
        let n = 0; for (let i = 0; i < pas.length; i += 4) if (pas[i] < 100) n += 1;
        return n;
      };
    };
    const pas = await wPasie();
    return { bez, numery, szerokosc: o.width, rozmiar: o.fontSize, zapis: stan.projekt.strony[0].obiekty[0].lista, znaki: [pas(0), pas(1), pas(2)] };
  });
  assert.equal(w.bez.odLewej, 0);
  assert.ok(Math.abs(w.numery.odLewej - w.rozmiar * 1.9) < 0.001, 'tekst listy numerowanej jest wcięty o 1,9 wysokości pisma');
  assert.ok(w.numery.wierszy >= w.bez.wierszy, 'wcięty tekst zawija się nie później niż zwykły');
  assert.ok(w.numery.najszerszy <= w.szerokosc - w.numery.odLewej + 0.01, 'wiersze mieszczą się w ramce pomniejszonej o wcięcie');
  // Wiersz 0 („Mleko”) i 1 (początek drugiego akapitu) mają numer; wiersz 2 to dalszy ciąg akapitu – wcięcie jest puste.
  assert.equal(w.zapis, 'numery');
  assert.ok(w.znaki[0] > 5 && w.znaki[1] > 5, `numery są narysowane w pasie wcięcia (${w.znaki})`);
  assert.equal(w.znaki[2], 0, 'dalszy wiersz akapitu stoi równo pod pierwszym, bez znaku');
  assert.deepEqual(bledy, []);
});

test('przelewanie: ramka z ciągiem dalszym, zmiana wysokości, usunięcie ramki, kolumny', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Przelewanie');
  const stan = () => strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    return e.canvas.getObjects().filter((o) => o.type === 'textbox').map((o) => ({
      tekst: o.text, wierszy: o._textLines.length, nr: o.watek_nr, watek: Boolean(o.watek), lacznik: o.lacznik, h: Math.round(o.ramka_h * 10) / 10, miesci: (o._wysokoscTresci ?? 0) <= o.ramka_h + 0.05,
      pogrubione: Object.values(o.styles || {}).reduce((n, w) => n + Object.values(w).filter((s) => s.fontWeight === 'bold').length, 0),
    }));
  });
  await strona.evaluate((tekst) => {
    const e = window.seriodruk.edytor;
    const o = e.dodajTekst(tekst);
    o.set({ left: 15, top: 20, width: 55 });
    // Pogrubione „Drugie zdanie” – fragment, który trafi na granicę ramek.
    const start = tekst.indexOf('Drugie zdanie');
    o.setSelectionStyles({ fontWeight: 'bold' }, start, start + 'Drugie zdanie'.length);
    o.initDimensions();
    e.zatwierdz?.();
  }, DLUGI);

  // Nowa ramka z ciągiem dalszym; pierwsza dostaje wysokość trzech wierszy.
  await strona.click('.wlasciwosci button:has-text("Dodaj ramkę z ciągiem dalszym")');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.watek).length === 2);
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const pierwsza = e.canvas.getObjects().find((o) => o.watek_nr === 0);
    pierwsza.ramka_h = pierwsza.getHeightOfLine(0) * 3 + 0.01;
    pierwsza.initDimensions();
    e.oznaczZmiane();
  });
  let r = await stan();
  assert.equal(r.length, 2);
  assert.equal(r[0].wierszy, 3);
  assert.ok(r[0].miesci, 'pierwsza ramka mieści swoją część');
  assert.ok(r[1].tekst.length > 50, 'reszta tekstu jest w drugiej ramce');
  assert.equal([r[0].tekst, r[1].tekst].join(r[1].lacznik), DLUGI, 'części sklejone łącznikiem dają cały tekst');
  assert.equal(r[0].pogrubione + r[1].pogrubione, 'Drugie zdanie'.length - (r[1].lacznik === ' ' && DLUGI.indexOf('Drugie') < r[0].tekst.length + 1 && r[0].tekst.length < DLUGI.indexOf('Drugie zdanie') + 13 ? 1 : 0), 'pogrubienie wędruje z tekstem');
  assert.match(await strona.textContent('.wlasciwosci'), /Ramka 2 z 2 połączonych/);

  // Wyższa pierwsza ramka zabiera tekst z powrotem.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const pierwsza = e.canvas.getObjects().find((o) => o.watek_nr === 0);
    pierwsza.ramka_h = pierwsza.getHeightOfLine(0) * 6 + 0.01;
    pierwsza.initDimensions();
    e.oznaczZmiane();
  });
  r = await stan();
  assert.equal(r[0].wierszy, 6);
  assert.equal([r[0].tekst, r[1].tekst].join(r[1].lacznik), DLUGI);

  // Zapis i ponowne wczytanie: każda ramka ma swoją część, nic się nie przesuwa.
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  assert.deepEqual((await stan()).map((x) => x.tekst), r.map((x) => x.tekst));

  // Usunięcie drugiej ramki: tekst wraca do pierwszej, która przestaje być połączona.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    e.canvas.setActiveObject(e.canvas.getObjects().find((o) => o.watek_nr === 1));
    e.usun();
  });
  r = await stan();
  assert.deepEqual(r.map((x) => [x.tekst, x.watek]), [[DLUGI, false]]);

  // Kolumny: trzy połączone ramki obok siebie, tekst rozłożony po równo.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const o = e.canvas.getObjects().find((x) => x.type === 'textbox');
    o.ramka_h = undefined; o.set({ width: 118 }); o.initDimensions();
    e.canvas.setActiveObject(o);
    e.zatwierdz?.();
  });
  await strona.click('.wlasciwosci [aria-label="Podziel na kolumny"] button[title="3 kolumny"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.watek).length === 3);
  const kolumny = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.watek).sort((a, b) => a.watek_nr - b.watek_nr)
    .map((o) => ({ lewo: Math.round(o.left * 10) / 10, szer: Math.round(o.width * 10) / 10, h: Math.round(o.ramka_h * 100), wierszy: o._textLines.length, tekst: o.text, lacznik: o.lacznik })));
  assert.deepEqual(kolumny.map((k) => [k.lewo, k.szer]), [[15, 36.7], [55.7, 36.7], [96.3, 36.7]]);
  assert.equal(new Set(kolumny.map((k) => k.h)).size, 1, 'kolumny mają tę samą wysokość');
  assert.ok(kolumny.every((k) => k.tekst.length > 0), 'w każdej kolumnie jest tekst');
  assert.ok(Math.max(...kolumny.map((k) => k.wierszy)) - Math.min(...kolumny.map((k) => k.wierszy)) <= 2, 'tekst rozłożony mniej więcej po równo');
  assert.equal(kolumny.map((k, i) => (i ? k.lacznik : '') + k.tekst).join(''), DLUGI);

  // Rozłączenie: ramki zostają ze swoimi częściami.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.setActiveObject(e.canvas.getObjects().find((o) => o.watek_nr === 1)); e.zatwierdz?.(); });
  await strona.click('.wlasciwosci button:has-text("Rozłącz ramki")');
  r = await stan();
  assert.deepEqual(r.map((x) => x.watek), [false, false, false]);
  assert.deepEqual(r.map((x) => x.tekst), kolumny.map((k) => k.tekst));
  assert.deepEqual(bledy, []);
});

test('przelewanie z danymi i łączenie zaznaczonych ramek; wstawianie tabeli', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Dane w ramkach');
  // Dwie osobne ramki zaznaczone razem → „Połącz ramki tekstu”.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const a = e.dodajTekst('{opis}');
    a.set({ left: 15, top: 20, width: 50 });
    a.ramka_h = a.getHeightOfLine(0) * 2 + 0.01; a.initDimensions();
    const b = e.dodajTekst();
    b.set({ left: 15, top: 120, width: 50 });
    e.canvas.discardActiveObject();
    e.canvas.setActiveObject(new fabric.ActiveSelection([b, a], { canvas: e.canvas }));
    e.zatwierdz?.();
  });
  await strona.click('.wlasciwosci button:has-text("Połącz ramki tekstu")');
  const polaczone = await strona.evaluate(() => { window.seriodruk.edytor.canvas.discardActiveObject(); return window.seriodruk.edytor.canvas.getObjects(); }).then(() => strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'textbox').map((o) => [o.text, o.watek_nr, Math.round(o.top)])));
  assert.deepEqual(polaczone, [['{opis}', 0, 20], ['', 1, 120]], 'kolejność z góry na dół; tekst zachęty z drugiej ramki znika');

  // Seria z tabelą: krótki opis mieści się w pierwszej ramce, długi płynie do drugiej – osobno dla każdej strony.
  const ciemne = await strona.evaluate(async () => {
    const { stan, zapiszTeraz } = window.seriodruk;
    await zapiszTeraz();
    const p = stan.projekt;
    p.tabele.push({ id: 't1', nazwa: 'Opisy', kolumny: ['opis'], wiersze: [['Krótko.'], ['Bardzo długi opis, który na pewno nie zmieści się w dwóch wierszach wąskiej ramki i musi popłynąć dalej, do drugiej ramki niżej na stronie.']] });
    p.serie.push({ id: 'se1', nazwa: 'Opisy', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    await window.seriodruk.przeladuj();
    const { rozwin } = await import('./js/serie.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const ciag = rozwin(p);
    const wynik = [];
    for (const e of ciag.egzemplarze) {
      const url = await renderujCel(p, e, { szerokoscPx: 296, spad: false, ciag });
      const img = new Image();
      await new Promise((ok) => { img.onload = ok; img.src = url; });
      const k = document.createElement('canvas'); k.width = img.width; k.height = img.height;
      const kx = k.getContext('2d'); kx.drawImage(img, 0, 0);
      const policz = (y1, y2) => { const d = kx.getImageData(30, y1 * 2, 110, (y2 - y1) * 2).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 120) n += 1; return n; };
      wynik.push([policz(18, 60), policz(118, 160)]);
    }
    return wynik;
  });
  assert.ok(ciemne[0][0] > 0 && ciemne[0][1] === 0, `krótki opis: tylko pierwsza ramka (${ciemne[0]})`);
  assert.ok(ciemne[1][0] > 0 && ciemne[1][1] > 0, `długi opis: tekst w obu ramkach (${ciemne[1]})`);
  // W projekcie nadal jest wzór z polem, nie podstawiony tekst.
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.map((o) => o.text)), ['{opis}', '']);

  // Tabela: okno wstawiania; powstaje jeden element z komórkami i liniami w środku (szczegóły: tabela.test.cjs).
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await strona.click('[data-akcja="dodaj-tabele"]');
  await strona.waitForSelector('#dlg-tabela[open]');
  await strona.fill('#dlg-tabela input[name=wiersze]', '3');
  await strona.fill('#dlg-tabela input[name=kolumny]', '4');
  await strona.click('#dlg-tabela button[value=tak]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 1 && window.seriodruk.edytor.aktywny?.tabela);
  // Tabela jest zaznaczona w całości; żaden element nie zgłasza ostrzeżenia (także o marginesie).
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.map((o) => o.typ)), []);
  const tabela = await strona.evaluate(async () => {
    await window.seriodruk.zapiszTeraz();
    const ob = window.seriodruk.stan.projekt.strony[1].obiekty;
    const g = ob[0];
    const komorki = g.objects.filter((o) => o.type === 'textbox');
    return {
      typy: ob.map((o) => o.type).join(','), opis: g.tabela, linii: g.objects.filter((o) => o.type === 'line').length,
      naglowki: komorki.slice(0, 4).map((o) => [o.text, o.fontWeight]), reszta: komorki.slice(4).every((o) => o.text === '' && o.ramka_h === 9 && o.wyrownanie_pion === 'srodek'),
      szer: Math.round(komorki[0].width * 10) / 10, szerTabeli: g.width,
    };
  });
  assert.equal(tabela.typy, 'group', 'tabela jest jednym elementem strony');
  assert.deepEqual(tabela.opis, { kolumny: [32, 32, 32, 32], wiersze: [9, 9, 9], naglowek: true, linia: { kolor: '#1a1a1a', grubosc: 0.25 } });
  assert.equal(tabela.linii, 9);
  assert.deepEqual(tabela.naglowki, [['Kolumna 1', 'bold'], ['Kolumna 2', 'bold'], ['Kolumna 3', 'bold'], ['Kolumna 4', 'bold']]);
  assert.ok(tabela.reszta);
  assert.equal(tabela.szer, 29); // (148 − 2 × 10) / 4 − 2 × 1,5
  assert.equal(tabela.szerTabeli, 128);
  assert.deepEqual(bledy, []);
});

test('tekst płynie przez strony: ciąg dalszy na następnej stronie, zmiany wracają do obu stron, podgląd i usunięcie strony', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Przez strony');
  const proj = () => strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => s.obiekty.filter((o) => o.type === 'textbox').map((o) => ({ tekst: o.text, nr: o.watek_nr, watek: o.watek || null, lacznik: o.lacznik }))));
  const caly = (strony) => strony.flat().sort((a, b) => a.nr - b.nr).map((r, i) => (i ? (r.lacznik ?? '\n') : '') + r.tekst).join('');
  await strona.evaluate((tekst) => {
    const e = window.seriodruk.edytor;
    const o = e.dodajTekst(tekst);
    o.set({ left: 15, top: 20, width: 60, ramka_h: 14 }); // mieści trzy wiersze, reszta wystaje
    o.initDimensions();
    e.zatwierdz();
  }, DLUGI);

  // Przycisk w panelu tekstu: powstaje druga strona z ramką, do której płynie reszta tekstu.
  await strona.click('.wlasciwosci button:has-text("Ciąg dalszy na następnej stronie")');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2 && window.seriodruk.stan.indeks === 1);
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.watek_nr === 1);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  let p = await proj();
  assert.equal(p[0].length, 1); assert.equal(p[1].length, 1);
  assert.equal(p[0][0].watek, p[1][0].watek, 'obie ramki należą do jednego wątku');
  assert.deepEqual([p[0][0].nr, p[1][0].nr], [0, 1]);
  assert.ok(p[0][0].tekst.length < DLUGI.length && p[1][0].tekst.length > 0, 'tekst podzielił się między strony');
  assert.equal(caly(p), DLUGI, 'nic nie zginęło');
  const naPierwszej = p[0][0].tekst.length;
  assert.match(await strona.textContent('.wlasciwosci'), /Ramka 2 z 2 połączonych\. Część ramek leży na innej stronie\./);

  // Zwężenie ramki na drugiej stronie niczego nie zmienia na pierwszej; powrót na pierwszą przyciskiem z panelu.
  await strona.click('.wlasciwosci button:has-text("Poprzednia ramka: strona 1")');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0 && window.seriodruk.edytor.aktywny?.watek_nr === 0);
  // Wyższa ramka na pierwszej stronie zabiera tekst z drugiej – także w zapisie drugiej strony.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.aktywny; o.set({ ramka_h: 28 }); o.initDimensions(); e.zatwierdz(); });
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  p = await proj();
  assert.ok(p[0][0].tekst.length > naPierwszej, 'na pierwszej stronie jest teraz więcej tekstu');
  assert.equal(caly(p), DLUGI);

  // Pisanie w ramce: tekst przelewa się od razu, bez wychodzenia z ramki; nadmiar trafia na drugą stronę.
  const przedPisaniem = p[1][0].tekst.length;
  await strona.evaluate(() => window.seriodruk.edytor.aktywny.enterEditing());
  await strona.keyboard.press('Control+Home');
  await strona.keyboard.type('Dopisane na samym początku zdanie, które wypycha resztę dalej. ');
  const wTrakcie = await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.aktywny; return { pisze: o.isEditing, miesci: (o._wysokoscTresci ?? 0) <= o.ramka_h + 0.05, kursor: o.selectionStart, dalej: e._poza[0].o.text.length }; });
  assert.ok(wTrakcie.pisze, 'pisanie trwa');
  assert.ok(wTrakcie.miesci, 'ramka nie jest przepełniona w trakcie pisania');
  assert.equal(wTrakcie.kursor, 'Dopisane na samym początku zdanie, które wypycha resztę dalej. '.length, 'kursor stoi za wpisanym tekstem');
  assert.ok(wTrakcie.dalej > przedPisaniem, 'nadmiar popłynął do ramki na drugiej stronie');
  await strona.keyboard.press('Escape');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  p = await proj();
  assert.equal(caly(p), `Dopisane na samym początku zdanie, które wypycha resztę dalej. ${DLUGI}`);

  // Podgląd (składanie stron) pokazuje na każdej stronie jej część – bez ostrzeżenia o niemieszczącym się tekście na pierwszej.
  const uwagi = await strona.evaluate(async () => {
    const { sprawdzMieszczenie } = await import('./js/kontrola-skladu.js');
    const { rozwin } = await import('./js/serie.js');
    const pr = window.seriodruk.stan.projekt;
    return (await sprawdzMieszczenie(pr, rozwin(pr))).map((u) => u.opis);
  });
  assert.equal(uwagi.filter((u) => /stron[ay] 1\b/.test(u)).length, 0, `pierwsza strona nie ma uwagi: ${uwagi}`);

  // Kopia strony nie jest dalszym ciągiem: jej ramka zostaje zwykłą ramką ze swoim tekstem.
  await strona.click('#lista-stron li.strona >> nth=1 >> .menu-miniatury');
  await strona.click('#menu-strony [data-akcja="strona-duplikuj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 3);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  p = await proj();
  assert.equal(p[2][0].watek, null);
  assert.equal(p[2][0].tekst, p[1][0].tekst);
  assert.equal(caly(p.slice(0, 2)), `Dopisane na samym początku zdanie, które wypycha resztę dalej. ${DLUGI}`);

  // Usunięcie drugiej strony: jej tekst wraca do ramki na pierwszej, która zostaje zwykłą ramką.
  await strona.click('#lista-stron li.strona >> nth=1 >> .menu-miniatury');
  await strona.click('#menu-strony [data-akcja="strona-usun"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  p = await proj();
  assert.equal(p[0][0].watek, null);
  assert.equal(p[0][0].tekst, `Dopisane na samym początku zdanie, które wypycha resztę dalej. ${DLUGI}`);
  assert.deepEqual(bledy, []);
});

test('pisanie w połączonych ramkach na jednej stronie: tekst przelewa się na bieżąco, kursor przechodzi do następnej ramki', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Pisanie');
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const o = e.dodajTekst('Krótki początek.');
    o.set({ left: 15, top: 20, width: 50, ramka_h: 10 });
    o.initDimensions();
    e.zatwierdz();
  });
  await strona.click('.wlasciwosci button:has-text("Dodaj ramkę z ciągiem dalszym")');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.watek).length === 2);
  // Pisanie na końcu pierwszej ramki, aż tekst się przeleje.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.watek_nr === 0); e.canvas.setActiveObject(o); o.enterEditing(); });
  await strona.keyboard.press('Control+End');
  await strona.keyboard.type(' Tu dopisuję dalszy ciąg, który nie zmieści się w dwóch wierszach pierwszej ramki i musi przejść do drugiej.');
  const s = await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const [a, b] = e.canvas.getObjects().filter((o) => o.watek).sort((x, y) => x.watek_nr - y.watek_nr);
    return { a: a.text, b: b.text, lacznik: b.lacznik, piszeWDrugiej: b.isEditing, piszeWPierwszej: a.isEditing, kursor: b.selectionStart, dlB: b._text.length, miesciA: (a._wysokoscTresci ?? 0) <= a.ramka_h + 0.05 };
  });
  assert.ok(s.miesciA && s.a.length > 0 && s.b.length > 0, 'pierwsza ramka trzyma tyle, ile mieści; reszta jest w drugiej');
  assert.ok(s.piszeWDrugiej && !s.piszeWPierwszej, 'pisanie przeszło do drugiej ramki');
  assert.equal(s.kursor, s.dlB, 'kursor stoi na końcu wpisanego tekstu');
  assert.equal(s.a + s.lacznik + s.b, 'Krótki początek. Tu dopisuję dalszy ciąg, który nie zmieści się w dwóch wierszach pierwszej ramki i musi przejść do drugiej.');
  // Dalsze pisanie trafia już do drugiej ramki.
  await strona.keyboard.type(' Koniec.');
  await strona.keyboard.press('Escape');
  assert.ok(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.watek_nr === 1).text.endsWith('do drugiej. Koniec.')));
  assert.deepEqual(bledy, []);
});
