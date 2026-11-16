// Praca (#131C): znajdź i zamień, malarz formatów, „Moje elementy” w Bibliotece, sprawdzanie pisowni.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('znajdź i zamień (rdzeń): strony, wzorce, grupy, dane, style; pola {…} nietknięte; całe słowa; wygląd fragmentów przesunięty', async () => {
  const { szukaj, zamien, przesunStyle, trafieniaWTekscie } = await modul('js/znajdz.js');
  const p = {
    strony: [
      { id: 's1', nazwa: 'Okładka', obiekty: [{ id: 't1', type: 'textbox', text: 'Kalendarz {rok} – kalendarz ścienny', styles: [{ start: 10, end: 15, style: { fontWeight: 'bold' } }] }] },
      { id: 's2', obiekty: [{ id: 'g', type: 'group', objects: [{ id: 't2', type: 'textbox', text: 'Mój kalendarzyk' }] }] },
    ],
    wzorce: [{ id: 'w1', nazwa: 'Stopka', obiekty: [{ id: 't3', type: 'textbox', text: 'Kalendarz 2027' }] }],
    tabele: [{ id: 'd1', nazwa: 'Dni', kolumny: ['opis'], wiersze: [['kalendarz'], ['inne']] }],
    style: [{ id: 'st', nazwa: 'Kalendarz – tytuł' }],
  };
  assert.equal(szukaj(p, 'kalendarz').length, 4, 'bez wielkości liter, w grupie i we wzorcu');
  assert.equal(szukaj(p, 'kalendarz', { slowa: true }).length, 3, 'całe słowa: bez „kalendarzyk”');
  assert.equal(szukaj(p, 'Kalendarz', { wielkosc: true }).length, 2);
  assert.equal(szukaj(p, 'kalendarz', { dane: true, style: true }).length, 6);
  assert.deepEqual(trafieniaWTekscie('Rok {rok} i rok', 'rok').map((t) => t.start), [0, 12], 'pole {rok} pominięte');
  assert.deepEqual(trafieniaWTekscie('Rok {rok}', '{rok}').map((t) => t.start), [4], 'pole szukane wprost');
  const t = szukaj(p, 'kalendarz', { slowa: true, dane: true });
  const z = zamien(p, t, 'planer');
  assert.equal(z.liczba, 4);
  assert.equal(p.strony[0].obiekty[0].text, 'planer {rok} – planer ścienny');
  assert.deepEqual(p.strony[0].obiekty[0].styles, [{ start: 7, end: 12, style: { fontWeight: 'bold' } }], 'pogrubione „{rok}” przesunięte razem z tekstem');
  assert.equal(p.wzorce[0].obiekty[0].text, 'planer 2027');
  assert.equal(p.strony[1].obiekty[0].objects[0].text, 'Mój kalendarzyk');
  assert.equal(p.tabele[0].wiersze[0][0], 'planer');
  assert.deepEqual(z.strony, new Set(['s1'])); assert.deepEqual(z.wzorce, new Set(['w1'])); assert.equal(z.dane, true);
  assert.deepEqual(przesunStyle([{ start: 2, end: 6, style: {} }], 3, 5, 0), [{ start: 2, end: 4, style: {} }]);
});

test('pisownia (rdzeń): odmiana przez przyrostki, „nie-”, wielkie litery, łącznik; podpowiedzi z ogonkami; pomijane pola i adresy', async (t) => {
  const { Pisownia, slowaWTekscie } = await modul('js/pisownia-rdzen.js');
  const k = path.join(__dirname, '..', 'js/zewnetrzne/slownik-pl');
  const t0 = Date.now();
  const p = new Pisownia(fs.readFileSync(path.join(k, 'pl.aff'), 'utf8'), fs.readFileSync(path.join(k, 'pl.dic'), 'utf8'));
  t.diagnostic(`słownik: ${Date.now() - t0} ms`);
  for (const w of ['książka', 'książkami', 'kalendarzach', 'Zażółć', 'gęślą', 'jaźń', 'niebieski', 'nieładny', 'KALENDARZ', 'Kraków', 'biało-czerwony', 'zrobiliśmy']) assert.ok(p.poprawne(w), w);
  for (const w of ['ksiązka', 'dziennk', 'kraków', 'wogóle']) assert.ok(!p.poprawne(w), w);
  assert.equal(p.podpowiedzi('ksiązka')[0], 'książka');
  assert.equal(p.podpowiedzi('dziennk')[0], 'dziennik');
  assert.equal(p.podpowiedzi('wogóle')[0], 'w ogóle');
  assert.ok(p.podpowiedzi('zazolc').includes('zażółć'));
  assert.ok(!p.poprawne('Drukarnix'));
  p.dodajWlasne(['Drukarnix']);
  assert.ok(p.poprawne('Drukarnix') && p.poprawne('drukarnix'));
  assert.deepEqual(slowaWTekscie('Dzień {dzien} – www.makietka.app, a@b.pl, 2027 r., Ola').map((s) => s.slowo), ['Dzień', 'Ola']);
});

test('znajdź i zamień w aplikacji: Ctrl+F, trafienia ze stron i wzorca, przejście do miejsca, „Zamień wszystkie” jednym krokiem cofania', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Szukanie');
  await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const tb = edytor.dodajTekst('Kalendarz na rok – kalendarz');
    edytor.zatwierdz();
    await window.seriodruk.zapiszTeraz();
    const { nowaStrona } = await import('./js/projekt.js');
    stan.projekt.strony.push({ ...nowaStrona('Druga', stan.projekt.sekcje[0].id), obiekty: [{ ...tb.toObject(), id: 'drugi', text: 'Mały kalendarz' }] });
    await window.seriodruk.przeladuj();
  });
  await strona.keyboard.press('Escape');
  await strona.click('.uklad-edytora main', { position: { x: 20, y: 20 } }).catch(() => {});
  await strona.evaluate(() => window.seriodruk.edytor.odznacz?.());
  await strona.keyboard.press('Control+KeyF');
  await strona.waitForSelector('#dlg-znajdz[open]');
  await strona.fill('#znajdz-fraza', 'kalendarz');
  await strona.waitForFunction(() => document.querySelectorAll('#znajdz-lista .trafienie').length === 3);
  assert.match(await strona.textContent('#znajdz-licznik'), /3 wyniki/);
  // Przejście do trafienia na drugiej stronie.
  await strona.click('#znajdz-lista li:nth-child(3) .trafienie');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1 && window.seriodruk.edytor.aktywny?.id === 'drugi');
  // Zamiana wszystkich – jeden krok cofania.
  await strona.click('#znajdz-pokaz-zamiane');
  await strona.fill('#znajdz-zamien', 'planer');
  await strona.click('#znajdz-zamien-wszystkie');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.every((s) => !/kalendarz/i.test(JSON.stringify(s.obiekty))));
  assert.match(await strona.textContent('#znajdz-licznik'), /Brak wyników/);
  // Cofanie działa też przy otwartym panelu (panel obok strony nie blokuje historii).
  await strona.waitForTimeout(800);
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => /Kalendarz na rok – kalendarz/.test(JSON.stringify(window.seriodruk.stan.projekt.strony[0].obiekty)), null, { timeout: 5000 });
  assert.ok(await strona.isVisible('#dlg-znajdz'));
  await strona.click('#znajdz-zamknij');
  assert.deepEqual(bledy, []);
});

test('malarz formatów: kopiuj wygląd prostokąta na drugi kształt, tekstu na tekst; wygląd tekstu nie trafia na zdjęcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Malarz');
  const ids = await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const a = e.dodajProstokat(); a.set({ fill: '#c1121f', stroke: '#003049', strokeWidth: 1.5, rx: 3, ry: 3, opacity: 0.8, left: 20, top: 20 });
    const b = e.dodajElipse(); b.set({ fill: '#eeeeee', left: 80, top: 80 });
    const t1 = e.dodajTekst('Tytuł'); t1.set({ fontWeight: 'bold', fill: '#2a9d8f', fontSize: 12, top: 140 });
    const t2 = e.dodajTekst('Zwykły'); t2.set({ top: 170 });
    e.canvas.requestRenderAll(); e.zatwierdz();
    return { a: a.id, b: b.id, t1: t1.id, t2: t2.id };
  });
  await strona.evaluate((id) => window.seriodruk.edytor.zaznacz(id), ids.a);
  await strona.click('#akcje-obiektu [data-akcja="malarz"]');
  assert.equal(await strona.getAttribute('#akcje-obiektu [data-akcja="malarz"]', 'aria-pressed'), 'true');
  // Kliknięcie innego elementu nakłada wygląd i kończy tryb.
  const srodek = await strona.evaluate((id) => {
    const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.id === id);
    const p = o.getCenterPoint().transform(e.canvas.viewportTransform); const r = e.canvas.upperCanvasEl.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }, ids.b);
  await strona.mouse.click(srodek.x, srodek.y);
  const b = await strona.evaluate((id) => { const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === id); return { fill: o.fill, stroke: o.stroke, sw: o.strokeWidth, op: o.opacity }; }, ids.b);
  assert.deepEqual(b, { fill: '#c1121f', stroke: '#003049', sw: 1.5, op: 0.8 });
  assert.equal(await strona.getAttribute('#akcje-obiektu [data-akcja="malarz"]', 'aria-pressed'), 'false');
  // Tekst → tekst: skrót Ctrl+Alt+C / Ctrl+Alt+V.
  await strona.evaluate((id) => window.seriodruk.edytor.zaznacz(id), ids.t1);
  await strona.keyboard.press('Control+Alt+KeyC');
  await strona.evaluate((id) => window.seriodruk.edytor.zaznacz(id), ids.t2);
  await strona.keyboard.press('Control+Alt+KeyV');
  const t2 = await strona.evaluate((id) => { const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === id); return { w: o.fontWeight, f: o.fill, s: o.fontSize, tekst: o.text }; }, ids.t2);
  assert.deepEqual(t2, { w: 'bold', f: '#2a9d8f', s: 12, tekst: 'Zwykły' }, 'wygląd przeszedł, treść została');
  // Wygląd tekstu nie trafia na kształt (poza kryciem i cieniem).
  const { nalozWyglad, wygladZ } = await modul('js/malarz.js');
  const ksztalt = { type: 'rect', fill: '#000', set(z) { Object.assign(this, z); } };
  nalozWyglad(ksztalt, wygladZ({ type: 'textbox', fill: '#f00', fontWeight: 'bold', opacity: 0.5 }));
  assert.deepEqual([ksztalt.fill, ksztalt.opacity, ksztalt.fontWeight], ['#000', 0.5, undefined]);
  assert.deepEqual(bledy, []);
});

test('Moje elementy: „Zapisz w bibliotece” zapisuje na koncie (z obrazem), wstawienie w innym projekcie kopiuje obraz; zmiana nazwy i usunięcie', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Źródło');
  await strona.setInputFiles('#plik-obraz', { name: 'logo.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'image'));
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const r = e.dodajProstokat(); r.set({ fill: '#1d3557', left: 10, top: 10 });
    e.zatwierdz();
    e.zaznaczWszystko();
  });
  // Kilka zaznaczonych elementów: „Zapisz w bibliotece” w części „Zaznaczenie” panelu.
  await strona.click('#wlasciwosci button:has-text("Zapisz w bibliotece")');
  await strona.waitForSelector('#dlg-nazwa[open]');
  await strona.fill('#dlg-nazwa input', 'Logo z ramką');
  await strona.click('#dlg-nazwa button[value="tak"]');
  await strona.waitForSelector('#dlg-biblioteka[open] [data-element]');
  assert.match(await strona.textContent('#elementy-biblioteki'), /Logo z ramką/);
  const pliki = [...baza.pliki.keys()].filter((k) => k.includes('/_elementy/'));
  assert.equal(pliki.length, 2, `spis i element: ${pliki.join(', ')}`);
  // Inny projekt: wstawienie kopiuje obraz do obrazów projektu.
  await strona.click('#biblioteka-zamknij');
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await nowyProjekt(strona, 'Cel');
  await strona.click('[data-akcja="biblioteka"]');
  await strona.click('#kategorie-biblioteki [data-kategoria="moje"]');
  await strona.waitForSelector('#elementy-biblioteki .kafel-biblioteki');
  await strona.click('#elementy-biblioteki .kafel-biblioteki');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'image') && window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'rect'));
  assert.equal(await strona.evaluate(() => Object.values(window.seriodruk.stan.projekt.zasoby).filter((z) => /logo/.test(z.nazwa)).length), 1);
  // Zmiana nazwy i usunięcie (z kafelka).
  if (!await strona.locator('#dlg-biblioteka[open]').count()) await strona.click('[data-akcja="biblioteka"]');
  await strona.click('#kategorie-biblioteki [data-kategoria="moje"]');
  await strona.click('#elementy-biblioteki [data-akcja-kafla="0"]');
  await strona.fill('#dlg-nazwa input', 'Logo');
  await strona.click('#dlg-nazwa button[value="tak"]');
  await strona.waitForFunction(() => /Logo/.test(document.querySelector('#elementy-biblioteki').textContent) && !/ramką/.test(document.querySelector('#elementy-biblioteki').textContent));
  await strona.click('#elementy-biblioteki [data-akcja-kafla="1"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => !document.querySelector('#elementy-biblioteki .kafel-biblioteki'));
  assert.equal([...baza.pliki.keys()].filter((k) => k.includes('/_elementy/') && !k.endsWith('spis.json')).length, 0);
  assert.deepEqual(bledy, []);
});

test('pisownia w edytorze: falista linia pod błędem, podpowiedź w panelu poprawia słowo, „Dodaj do słownika”; przełącznik w menu widoku', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Pisownia');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.dodajTekst('Moja ksiązka i Drukarnix'); e.zatwierdz(); });
  await strona.waitForFunction(() => {
    const e = window.seriodruk.edytor; const o = e.aktywny;
    return e.pisownia && o && e.pisownia.bledy(o).length === 2;
  }, null, { timeout: 20000 });
  await strona.waitForSelector('.lista-pisowni .blad-pisowni', { timeout: 20000 });
  assert.match(await strona.textContent('.lista-pisowni'), /ksiązka/);
  await strona.click('.blad-pisowni:has(strong:text-is("ksiązka")) button:text-is("książka")');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.text === 'Moja książka i Drukarnix');
  await strona.waitForSelector('.blad-pisowni:has(strong:text-is("Drukarnix"))', { timeout: 10000 });
  await strona.click('.blad-pisowni:has(strong:text-is("Drukarnix")) button:text-is("Dodaj do słownika")');
  await strona.waitForFunction(() => /Bez błędów/.test(document.querySelector('.lista-pisowni')?.textContent || ''), null, { timeout: 10000 });
  // Wyłączenie w menu widoku: linii i części panelu nie ma.
  await strona.click('#przycisk-widok');
  await strona.click('label:has(#widok-pisownia)');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.pisownia), null);
  assert.equal(await strona.locator('.lista-pisowni').count(), 0);
  assert.deepEqual(bledy, []);
});

test('użyte w projekcie (#136): kolory ze wszystkich stron i wzorców z liczbą użyć w okienku koloru, czcionki na górze listy', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Użyte');
  // Rdzeń: wypełnienia, obrysy, fragmenty, przejścia, tła, style; najczęstsze najpierw.
  const wynik = await strona.evaluate(async () => {
    const { uzyteKolory, uzyteCzcionki } = await import('./js/kontrolki.js');
    const p = {
      strony: [
        { tlo: '#FFFFFF', obiekty: [
          { type: 'rect', fill: '#c1121f', stroke: '#003049' },
          { type: 'group', objects: [{ type: 'rect', fill: '#C1121F' }] },
          { type: 'textbox', text: 'Ala', fill: '#003049', fontFamily: 'Lora', styles: [{ start: 0, end: 1, style: { fill: '#c1121f', fontFamily: 'Inter' } }] },
        ] },
      ],
      wzorce: [{ obiekty: [{ type: 'rect', fill: { type: 'linear', colorStops: [{ offset: 0, color: '#c1121f' }, { offset: 1, color: '#fdf0d5' }] } }, { type: 'textbox', text: 'x', fontFamily: 'Lora' }] }],
      style: [{ id: 's', fontFamily: 'Lora', fill: '#003049' }],
    };
    return { kolory: uzyteKolory(p), czcionki: uzyteCzcionki(p), pusto: uzyteKolory(null) };
  });
  assert.deepEqual(wynik.kolory, [{ kolor: '#c1121f', ile: 4 }, { kolor: '#003049', ile: 3 }, { kolor: '#ffffff', ile: 1 }, { kolor: '#fdf0d5', ile: 1 }]);
  assert.deepEqual(wynik.czcionki, [{ nazwa: 'Lora', ile: 3 }, { nazwa: 'Inter', ile: 1 }]);
  assert.deepEqual(wynik.pusto, []);

  // W aplikacji: dwa czerwone prostokąty i tekst – okienko koloru pokazuje „Użyte w projekcie”.
  await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    e.dodajProstokat().set({ fill: '#c1121f', left: 10, top: 10 });
    e.dodajProstokat().set({ fill: '#c1121f', left: 60, top: 10 });
    const tb = e.dodajTekst('Tytuł');
    tb.set({ fontFamily: 'Lora', left: 10, top: 80 });
    e.zatwierdz();
    await window.seriodruk.zapiszTeraz();
    e.zaznacz(e.canvas.getObjects().find((o) => o.type === 'rect').id);
  });
  await strona.click('#wlasciwosci .kolor-przycisk >> nth=0');
  await strona.waitForSelector('.kolor-uzyte:not([hidden])');
  assert.equal(await strona.textContent('.kolor-uzyte .kolor-podpis'), 'Użyte w projekcie');
  // Nowy projekt ma już swoje kolory (style tekstu) – czerwony z prostokątów jest wśród nich z liczbą użyć.
  const tytuly = await strona.$$eval('.kolor-paleta.projektu > *', (b) => b.map((x) => x.title));
  assert.ok(tytuly.includes('#c1121f · 2 razy w projekcie'), tytuly.join(' | '));
  await strona.keyboard.press('Escape');
  // Lista czcionek: „Użyte w projekcie” z liczbą nad wszystkimi czcionkami.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.type === 'textbox').id); });
  const grupy = await strona.evaluate(() => {
    const lista = [...document.querySelectorAll('#wlasciwosci select')].find((s) => s.querySelector('optgroup[label="Wszystkie czcionki"]'));
    return [...lista.querySelectorAll('optgroup')].map((g) => [g.label, g.children[0]?.textContent]);
  });
  assert.equal(grupy[0][0], 'Użyte w projekcie');
  assert.ok(grupy[0][1].includes(' · '), grupy[0][1]);
  assert.equal(grupy[1][0], 'Wszystkie czcionki');
  assert.ok((await strona.evaluate(() => [...document.querySelectorAll('#wlasciwosci optgroup[label="Użyte w projekcie"] option')].map((o) => o.textContent))).some((x) => /^Lora · \d+×$/.test(x)));
  assert.deepEqual(bledy, []);
});

test('widoczne miejsca (#140): lupa na górnym pasku, „Znajdź i zamień” pierwsze w ⋯, Kopiuj wygląd i Zapisz w bibliotece w ⋯ warstwy, dymek pisowni przy słowie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Miejsca');
  // Lupa na górnym pasku.
  await strona.click('.pasek-edytora > [data-akcja="znajdz"]');
  await strona.waitForSelector('#dlg-znajdz[open]');
  await strona.click('#znajdz-zamknij');
  // Menu ⋯: pierwsza widoczna pozycja.
  await strona.click('#przycisk-wiecej');
  const pierwsza = await strona.evaluate(() => [...document.querySelectorAll('#menu-wiecej [role="menuitem"]')].find((b) => b.offsetParent)?.dataset.akcja);
  assert.equal(pierwsza, 'znajdz');
  await strona.keyboard.press('Escape');
  // ⋯ na liście warstw: Kopiuj wygląd.
  const id = await strona.evaluate(() => { const e = window.seriodruk.edytor; const r = e.dodajProstokat(); r.set({ fill: '#c1121f' }); e.zatwierdz(); e.dodajProstokat(); e.zatwierdz(); return r.id; });
  await strona.click('#zakladka-warstwy'); // warstwy w zakładce prawej kolumny (#171)
  await strona.click(`li[data-id="${id}"] .warstwa-menu`);
  await strona.click('#menu-warstwy [data-op="malarz"]');
  await strona.waitForFunction(() => document.body.classList.contains('malarz-aktywny'));
  assert.equal(await strona.getAttribute('#akcje-obiektu [data-akcja="malarz"]', 'aria-pressed'), 'true');
  await strona.keyboard.press('Escape');
  assert.equal(await strona.evaluate(() => document.body.classList.contains('malarz-aktywny')), false);
  assert.equal(await strona.locator('#menu-warstwy [data-op="zapisz-w-bibliotece"]').count(), 1);
  // Dymek pisowni: kliknięcie w podkreślone słowo w pisanym tekście.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.dodajTekst('Moja ksiązka'); e.zatwierdz(); });
  await strona.waitForFunction(() => { const e = window.seriodruk.edytor; return e.pisownia && e.pisownia.bledy(e.aktywny).length === 1; }, null, { timeout: 20000 });
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor; const o = e.aktywny;
    o.enterEditing(); o.selectionStart = o.selectionEnd = 7;
    e.canvas.fire('mouse:up', { target: o, e: { clientX: 300, clientY: 300 } });
  });
  await strona.waitForSelector('#menu-pisowni:not([hidden]) .podpowiedz-pisowni', { timeout: 20000 });
  assert.match(await strona.textContent('#menu-pisowni'), /Dodaj do słownika/);
  await strona.click('#menu-pisowni .podpowiedz-pisowni:text-is("książka")');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.text === 'Moja książka');
  assert.deepEqual(bledy, []);
});
