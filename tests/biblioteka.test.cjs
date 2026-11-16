// Biblioteka (decyzje #131A, #134): jedno okno z kategoriami – kształty, strzałki i dymki, ozdobniki i ramki,
// kalendarze, wykresy, kolaże zdjęć. Kalendarz miesiąca (święta ruchome, miesiąc z danych), wykres z danych,
// kształty z biblioteki i kolaże: wstawianie, panel, zapis, składanie stron serii i PDF.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('święta ruchome i stałe: Wielkanoc, Poniedziałek Wielkanocny, Zielone Świątki, Boże Ciało; Wigilia od 2025', async () => {
  const { wielkanoc, swietaPolskie, dataZTekstu } = await modul('js/swieta.js');
  const znane = { 2019: '04-21', 2024: '03-31', 2025: '04-20', 2026: '04-05', 2027: '03-28', 2028: '04-16', 2030: '04-21', 2038: '04-25' };
  for (const [rok, data] of Object.entries(znane)) {
    const w = wielkanoc(Number(rok));
    assert.equal(`${String(w.miesiac).padStart(2, '0')}-${String(w.dzien).padStart(2, '0')}`, data, `Wielkanoc ${rok}`);
  }
  const s2027 = swietaPolskie(2027);
  assert.equal(s2027.get('2027-03-29'), 'Poniedziałek Wielkanocny');
  assert.equal(s2027.get('2027-05-16'), 'Zielone Świątki');
  assert.equal(s2027.get('2027-05-27'), 'Boże Ciało');
  assert.equal(s2027.get('2027-11-11'), 'Święto Niepodległości');
  assert.equal(s2027.get('2027-12-24'), 'Wigilia');
  assert.equal(swietaPolskie(2024).has('2024-12-24'), false, 'Wigilia wolna dopiero od 2025');
  assert.equal(swietaPolskie(2024).get('2024-05-30'), 'Boże Ciało');
  assert.deepEqual(dataZTekstu('26.05'), { rok: null, miesiac: 5, dzien: 26 });
  assert.deepEqual(dataZTekstu('2027-05-26'), { rok: 2027, miesiac: 5, dzien: 26 });
});

test('biblioteka: rejestr kategorii, wyszukiwanie we wszystkich kategoriach, kolaże i kształty', async () => {
  await modul('js/biblioteka-elementy.js');
  const { kategorieBiblioteki, szukajWBibliotece, zarejestrujKategorie, elementBiblioteki } = await modul('js/biblioteka.js');
  const { polaKolazu, KSZTALTY, KOLAZE } = await modul('js/ksztalty-biblioteka.js');
  assert.deepEqual(kategorieBiblioteki().map((k) => k.id), ['moje', 'gotowe-sekcje', 'ksztalty', 'ikony', 'ilustracje', 'strzalki', 'ramki', 'ozdobniki', 'linie', 'etykiety', 'okolicznosciowe', 'tla', 'kalendarze', 'planer', 'formularze', 'wykresy', 'infografiki', 'kolaze', 'naglowki', 'teksty', 'bloki', 'uklady', 'style', 'marka', 'ksiazka', 'kody']);
  assert.ok(KSZTALTY.length >= 400, `kształtów: ${KSZTALTY.length}`);
  assert.equal(KOLAZE.length, 12);
  // Wyszukiwanie bez polskich znaków, w każdej kategorii naraz.
  const serca = szukajWBibliotece('serce').map((x) => x.element.id);
  for (const id of ['serce', 'serce-ramka', 'linia-serce', 'zdj-serce', 'dwa-serca']) assert.ok(serca.includes(id), id);
  assert.deepEqual([...new Set(szukajWBibliotece('serce').map((x) => x.kategoria.id))], ['ksztalty', 'ikony', 'ilustracje', 'ramki', 'linie']);
  assert.ok(szukajWBibliotece('strzalka w prawo').some((x) => x.element.id === 'strzalka-prawo'));
  assert.ok(szukajWBibliotece('kalendarz').some((x) => x.kategoria.id === 'kalendarze'));
  assert.equal(szukajWBibliotece('', 'wykresy').length, 5);
  // Kolejne partie dopisują kategorie bez zmian w oknie (np. „Moje elementy”, #131C – tu zastąpiona próbną).
  zarejestrujKategorie({ id: 'moje', nazwa: 'Moje elementy', kolejnosc: 5, elementy: () => [{ id: 'stopka', nazwa: 'Stopka firmy', podglad: '', wstaw: () => 'ok' }] });
  assert.equal(kategorieBiblioteki()[0].id, 'moje');
  assert.equal(elementBiblioteki('moje', 'stopka').wstaw(), 'ok');
  // Kolaż 2 obok siebie, odstęp 4 mm: pola stykają się odstępem, zewnętrzne brzegi bez odstępu.
  const [a, b] = polaKolazu('2-pion', 100, 50, 4);
  assert.deepEqual([a.lewo, a.szerokosc, b.lewo, b.szerokosc, a.wysokosc], [0, 48, 52, 48, 50]);
});

test('kalendarz miesiąca z biblioteki: siatka marca 2027, niedziele i święta, numery tygodni, notatki; miesiąc z kolumny danych na stronach serii; PDF', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz');
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  assert.equal(await strona.locator('#kategorie-biblioteki .chip-biblioteki').count(), 27, 'z „Moimi elementami”, „Marką”, „Gotowymi sekcjami” i „Wzorcami stron”');
  await strona.click('#kategorie-biblioteki [data-kategoria="kalendarze"]');
  await strona.click('#elementy-biblioteki .kafel-biblioteki[data-element="zwykly"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.kalendarz);
  const komorki = () => strona.evaluate(() => window.seriodruk.edytor.aktywny.getObjects().filter((o) => o.type === 'textbox').map((c) => [c.text, c.fill]));
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    e.aktywny.kalendarz = { ...e.aktywny.kalendarz, rok: 2027, miesiac: 3 };
    e.zatwierdz();
  });
  let k = await komorki();
  assert.equal(k[0][0], 'Marzec 2027');
  assert.deepEqual(k.slice(7, 14).map((x) => x[0]), ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']);
  assert.equal(k[14][0], '1', '1 marca 2027 to poniedziałek – pierwsza kratka');
  const dzien = (n) => k.slice(14).find((x) => x[0].split('\n')[0] === String(n) && x[1] !== '#b5b2aa');
  assert.equal(dzien(7)[1], '#c62828', 'niedziela na czerwono');
  assert.equal(dzien(29)[1], '#c62828', 'Poniedziałek Wielkanocny na czerwono');
  assert.equal(dzien(3)[1], '#1a1a1a');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.tabela.wiersze.length), 2 + 5, 'tytuł, dni tygodnia i 5 tygodni');
  // Numery tygodni i nazwy świąt w kratkach.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    e.aktywny.kalendarz = { ...e.aktywny.kalendarz, tygodnie: true, nazwy_swiat: true, notatki: true };
    e.zatwierdz();
  });
  k = await komorki();
  assert.equal(k.length, 7 * 8, 'osiem kolumn');
  assert.equal(k[8 * 2][0], '9', 'tydzień ISO 9 (1–7 marca 2027)');
  assert.ok(k.some((x) => x[0] === '29\nPoniedziałek Wielkanocny'));
  // Panel: część „Kalendarz” i „Święta”, bez liczników wierszy tabeli.
  assert.ok(await strona.locator('#wlasciwosci fieldset > legend:has-text("Święta")').count());
  assert.equal(await strona.locator('#wlasciwosci .licznik-tabeli').count(), 0);
  // Komórek kalendarza nie da się edytować dwuklikiem.
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.edytujKomorke(window.seriodruk.edytor.aktywny, [3, 3])), null);

  // Miesiąc z kolumny: na każdej stronie serii inny miesiąc.
  const wynik = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const e = window.seriodruk.edytor;
    stan.projekt.tabele.push({ id: 'tm', nazwa: 'Miesiące', kolumny: ['miesiac', 'wolne'], wiersze: [['2027-02', ''], ['grudzień 2027', '']] });
    stan.projekt.serie = [{ id: 's1', nazwa: 'Miesiące', tabela: 'tm', tryb: 'tabela', uklad: 'dlugi', ile: 1, dodatkowe: [] }];
    stan.projekt.strony[0].seria = 's1';
    e.aktywny.kalendarz = { ...e.aktywny.kalendarz, pole_daty: 'miesiac', tygodnie: false, nazwy_swiat: false, notatki: false };
    e.zatwierdz();
    const wEdytorze = e.aktywny.getObjects().find((o) => o.type === 'textbox').text;
    await window.seriodruk.zapiszTeraz();
    const { rozwin } = await import('./js/serie.js');
    const { zlozCel } = await import('./js/zlozenie.js');
    const ciag = rozwin(stan.projekt);
    const tytuly = [];
    for (const egz of ciag.egzemplarze) {
      const { obiekty } = await zlozCel(stan.projekt, egz, { ciag });
      const kal = obiekty.find((o) => o.kalendarz);
      tytuly.push(kal.getObjects().find((o) => o.type === 'textbox').text);
    }
    return { wEdytorze, tytuly };
  });
  assert.equal(wynik.wEdytorze, 'Luty 2027', 'w edytorze – miesiąc z pierwszego wiersza');
  assert.deepEqual(wynik.tytuly, ['Luty 2027', 'Grudzień 2027']);

  // Zapis i ponowne wczytanie: kalendarz zostaje kalendarzem.
  await strona.evaluate(() => window.seriodruk.przeladuj());
  assert.ok(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.kalendarz && o.tabela)));
  // PDF wektorowy: kalendarz idzie wektorowo (bez elementów zamienionych na obraz).
  const pdf = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { zlozPdf } = await import('./js/eksport.js');
    const { rozwin } = await import('./js/serie.js');
    const ciag = rozwin(stan.projekt);
    const uwagi = new Map();
    const blob = await zlozPdf(stan.projekt, ciag.egzemplarze, { ciag, uwagi });
    return { rozmiar: blob.size, uwagi: [...uwagi.values()].flat().map(String) };
  });
  assert.ok(pdf.rozmiar > 1000);
  assert.deepEqual(pdf.uwagi, [], 'bez elementów zamienionych na obraz');
  assert.deepEqual(bledy, []);
});

test('wykres z danych, kształt z biblioteki, kolaż ze zdjęciem; przeciągnięcie z biblioteki na stronę', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Raport');
  await strona.evaluate(() => {
    window.seriodruk.stan.projekt.tabele.push({ id: 'tw', nazwa: 'Sprzedaż', kolumny: ['miesiac', 'sklep', 'internet'], wiersze: [['styczeń', '12', '5'], ['luty', '15,5', '8'], ['marzec', '9', '11']] });
  });
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  // Szukanie przeszukuje wszystkie kategorie.
  await strona.fill('#szukaj-w-bibliotece', 'słupkowy');
  await strona.click('#elementy-biblioteki .kafel-biblioteki[data-element="slupki"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.wykres);
  const w = await strona.evaluate(() => {
    const g = window.seriodruk.edytor.aktywny;
    return { opis: g.wykres, slupki: g.getObjects().filter((o) => o.type === 'rect' && o.fill !== 'rgba(0,0,0,0)' && o.width < g.wykres.szerokosc).length, napisy: g.getObjects().filter((o) => o.type === 'text').map((o) => o.text) };
  });
  assert.equal(w.opis.tabela, 'tw');
  assert.deepEqual(w.opis.wartosci, ['sklep', 'internet']);
  assert.ok(w.slupki >= 6, `słupków ${w.slupki}`);
  assert.ok(w.napisy.includes('15,5') && w.napisy.includes('luty') && w.napisy.includes('internet'), w.napisy.join('|'));
  // Zmiana rodzaju w panelu: kołowy.
  await strona.selectOption('#wlasciwosci label:has-text("Rodzaj") select', 'kolo');
  assert.ok(await strona.evaluate(() => window.seriodruk.edytor.aktywny.getObjects().filter((o) => o.type === 'path').length === 3));
  // Zmiana danych odświeża wykres po wczytaniu strony.
  await strona.evaluate(async () => { window.seriodruk.stan.projekt.tabele[0].wiersze[0][1] = '40'; await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  assert.ok(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.wykres).getObjects().some((o) => o.type === 'text' && /%$/.test(o.text))));

  // Kształt z biblioteki: edytowalna ścieżka, ramka z otworem.
  await strona.fill('#szukaj-w-bibliotece', '');
  await strona.click('#kategorie-biblioteki [data-kategoria="strzalki"]');
  await strona.click('#elementy-biblioteki [data-element="dymek"]');
  const ksztalt = await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; return [o.type, o.nazwa, o.path.some((k) => k[0] === 'Z')]; });
  assert.deepEqual(ksztalt, ['path', 'Dymek', true]);

  // Kolaż: przeciągnięcie kafelka na stronę wstawia go w miejscu upuszczenia.
  await strona.click('#kategorie-biblioteki [data-kategoria="kolaze"]');
  const cel = await strona.evaluate(() => {
    const c = window.seriodruk.edytor.canvas;
    const r = c.upperCanvasEl.getBoundingClientRect();
    const p = new window.fabric.Point(60, 60).transform(c.viewportTransform);
    return { x: r.left + p.x, y: r.top + p.y };
  });
  await strona.evaluate(({ x, y }) => {
    const dt = new DataTransfer();
    const kafel = document.querySelector('#elementy-biblioteki [data-element="3-duzy-lewo"]');
    kafel.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
    document.querySelector('#kontener-plotna').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }, cel);
  const kolaz = await strona.evaluate(() => { const g = window.seriodruk.edytor.aktywny; const s = g.getCenterPoint(); return { pola: g.getObjects().length, x: Math.round(s.x), y: Math.round(s.y), kolaz: g.kolaz }; });
  assert.equal(kolaz.pola, 3);
  assert.deepEqual([kolaz.x, kolaz.y], [60, 60], 'środek kolażu w miejscu upuszczenia');
  // Odstęp zmienia się dla całej siatki.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.kolaz = { ...e.aktywny.kolaz, odstep: 6 }; e.zatwierdz(); });
  const odstep = await strona.evaluate(() => { const [a, b] = window.seriodruk.edytor.aktywny.getObjects(); return Math.round((b.left - (a.left + a.width)) * 10) / 10; });
  assert.equal(odstep, 6);
  // Panel kolażu i zmiana układu (pól przybywa).
  await strona.selectOption('#wlasciwosci label:has-text("Układ") select', '6-siatka');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.getObjects().length), 6);
  assert.deepEqual(bledy, []);
});

test('biblioteka na telefonie: zasłonka, kategorie w jednym rzędzie, wstawienie zamyka okno', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Telefon');
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  assert.equal(await strona.evaluate(() => document.querySelector('#dlg-biblioteka').matches(':modal')), true);
  const poza = await strona.evaluate(() => [...document.querySelectorAll('#dlg-biblioteka .kafel-biblioteki')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).length);
  assert.equal(poza, 0);
  await strona.click('#elementy-biblioteki [data-element="serce"]');
  await strona.waitForFunction(() => !document.querySelector('#dlg-biblioteka').open);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny?.nazwa), 'Serce');
  assert.deepEqual(bledy, []);
});

test('elementy biblioteki dodane przez AI skrótem (grupa z opisem, bez treści): po wczytaniu strony aplikacja układa kalendarz, wykres i kolaż', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Od AI');
  const wynik = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const grupa = { type: 'group', layoutManager: { type: 'layoutManager', strategy: 'fixed' }, subTargetCheck: false, interactive: false };
    const komorka = { type: 'textbox', text: '', strokeWidth: 0, fontFamily: 'Inter', fontSize: 3.175, fill: '#1a1a1a', width: 10 };
    stan.projekt.tabele.push({ id: 'tw', nazwa: 'Wyniki', kolumny: ['klasa', 'punkty'], wiersze: [['1a', '30'], ['1b', '45']] });
    stan.projekt.strony[0].obiekty.push(
      { ...grupa, id: 'o_kal', left: 10, top: 10, width: 120, height: 72, kalendarz: { rok: 2027, miesiac: 6 }, tabela: { kolumny: Array(7).fill(120 / 7), wiersze: Array(8).fill(9), naglowek: true, linia: { kolor: '#c9c6bf', grubosc: 0.2 } }, objects: Array.from({ length: 56 }, (_, i) => ({ ...komorka, id: `o_k${i}` })) },
      { ...grupa, id: 'o_wyk', left: 10, top: 100, width: 100, height: 60, wykres: { rodzaj: 'slupki', tabela: 'tw', etykiety: 'klasa', wartosci: ['punkty'], szerokosc: 100, wysokosc: 60 }, objects: [] },
      { ...grupa, id: 'o_kol', left: 10, top: 170, width: 120, height: 90, kolaz: { uklad: '4-siatka', odstep: 3, zaokraglenie: 0, szerokosc: 120, wysokosc: 90 }, objects: Array.from({ length: 4 }, (_, i) => ({ type: 'rect', id: `o_p${i}`, left: 0, top: 0, width: 10, height: 10, fill: '#e8e6e1', strokeWidth: 0 })) },
    );
    await window.seriodruk.przeladuj();
    const c = window.seriodruk.edytor.canvas;
    const kal = c.getObjects().find((o) => o.id === 'o_kal');
    const wyk = c.getObjects().find((o) => o.id === 'o_wyk');
    const kol = c.getObjects().find((o) => o.id === 'o_kol');
    return {
      tytul: kal.getObjects().find((o) => o.type === 'textbox').text,
      wierszy: kal.tabela.wiersze.length,
      napisy: wyk.getObjects().filter((o) => o.type === 'text').map((o) => o.text),
      pole: kol.getObjects()[1].width,
    };
  });
  assert.equal(wynik.tytul, 'Czerwiec 2027');
  assert.equal(wynik.wierszy, 2 + 5);
  assert.ok(wynik.napisy.includes('45') && wynik.napisy.includes('1b'), wynik.napisy.join('|'));
  assert.equal(wynik.pole, 58.5);
  assert.deepEqual(bledy, []);
});

test('biblioteka: kategoria „Kody” wstawia kod QR i kod kreskowy EAN (#128, #134)', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kody');
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  await strona.click('#kategorie-biblioteki [data-kategoria="kody"]');
  const nazwy = await strona.$$eval('#dlg-biblioteka [data-element]', (l) => l.map((x) => x.textContent.trim()));
  assert.ok(nazwy.some((n) => /Kod QR/.test(n)) && nazwy.some((n) => /EAN/.test(n)), nazwy.join(' | '));
  await strona.click('#dlg-biblioteka [data-element="qr"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.kod?.rodzaj === 'qr'));
  assert.deepEqual(bledy, []);
});

test('biblioteka: „Style tekstu” nadaje styl zaznaczonemu tekstowi (#131A, #134)', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Style');
  await strona.click('[data-akcja="dodaj-tekst"]');
  const styl = await strona.evaluate(() => window.seriodruk.stan.projekt.style.find((s) => s.nazwa === 'Tytuł') || window.seriodruk.stan.projekt.style[0]);
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  await strona.click('#kategorie-biblioteki [data-kategoria="style"]');
  await strona.click(`#dlg-biblioteka [data-element="${styl.id}"]`);
  await strona.waitForFunction((id) => window.seriodruk.edytor.canvas.getObjects().some((o) => o.styl === id), styl.id);
  assert.deepEqual(bledy, []);
});

test('zasada #140: polecenia palety Ctrl+K mają też widoczne miejsce w interfejsie', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Zasada 140');
  const brak = await strona.evaluate(async () => {
    const { kategorieBiblioteki } = await import('./js/biblioteka.js');
    const wBibliotece = kategorieBiblioteki().flatMap((k) => k.elementy().map((e) => e.nazwa.toLowerCase()));
    const html = document.body.innerHTML.toLowerCase();
    const zrodla = (await (await fetch('./js/wlasciwosci.js')).text()).toLowerCase();
    const polecenia = (await (await fetch('./js/app/edytor-start.js')).text()).match(/dodajPolecenie\(\{ nazwa: '([^']+)'/g) || [];
    return polecenia.map((p) => p.replace(/^dodajPolecenie\(\{ nazwa: '/, '').replace(/'$/, ''))
      .filter((n) => {
        const krotko = n.toLowerCase().replace(/^wstaw /, '');
        return !wBibliotece.some((e) => e.includes(krotko) || krotko.includes(e)) && !html.includes(n.toLowerCase()) && !zrodla.includes(`'${n.toLowerCase()}'`);
      });
  });
  assert.deepEqual(brak, [], `polecenia tylko w palecie: ${brak.join(', ')}`);
  assert.deepEqual(bledy, []);
});
