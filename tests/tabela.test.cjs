const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Czytnik PDF do sprawdzenia, że tekst komórek jest w pliku prawdziwym tekstem.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WATEK = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const wstawTabele = async (strona, wiersze, kolumny) => {
  await strona.click('[data-akcja="dodaj-tabele"]');
  await strona.waitForSelector('#dlg-tabela[open]');
  await strona.fill('#dlg-tabela input[name=wiersze]', String(wiersze));
  await strona.fill('#dlg-tabela input[name=kolumny]', String(kolumny));
  await strona.click('#dlg-tabela button[value=tak]');
  await strona.waitForFunction(() => window.seriodruk.edytor?.aktywny?.tabela);
};

// Stan tabeli na płótnie: opis, wymiary, teksty komórek wierszami, wysokości wierszy, co jest zaznaczone.
const stanTabeli = (strona, ktora = 0) => strona.evaluate((nr) => {
  const e = window.seriodruk.edytor;
  const g = e.canvas.getObjects().filter((o) => o.tabela)[nr];
  if (!g) return null;
  const K = g.tabela.kolumny.length;
  const komorki = e.komorkiTabeli(g);
  const a = e.aktywny;
  const z = (x) => Math.round(x * 100) / 100;
  return {
    naPlotnie: e.canvas.getObjects().length, kolumny: g.tabela.kolumny.map(z), wiersze: g.tabela.wiersze, naglowek: g.tabela.naglowek,
    lewo: z(g.left), gora: z(g.top), szer: z(g.width), wys: z(g.height), skala: [g.scaleX, g.scaleY],
    teksty: g.tabela.wiersze.map((_, w) => komorki.slice(w * K, (w + 1) * K).map((c) => c.text)),
    wysokosci: g.tabela.wiersze.map((_, w) => z(komorki[w * K].ramka_h)),
    linii: g.getObjects().filter((o) => o.type === 'line').length,
    zaznaczone: !a ? null : (a === g ? 'tabela' : (a.group === g ? `komórka ${JSON.stringify(Object.values(e.miejsceKomorki(a)))}${a.isEditing ? ' – pisanie' : ''}` : a.type)),
    tytul: document.querySelector('#tytul-wlasciwosci').textContent,
  };
}, ktora);

// Punkt strony (mm) → punkt ekranu.
const naEkranie = (strona, x, y) => strona.evaluate(([mx, my]) => {
  const c = window.seriodruk.edytor.canvas;
  const v = c.viewportTransform;
  const r = c.upperCanvasEl.getBoundingClientRect();
  return [r.left + mx * v[0] + v[4], r.top + my * v[3] + v[5]];
}, [x, y]);

const krok = (strona) => strona.waitForTimeout(450); // osobny krok historii

test('tabela jest jednym elementem: wstawienie, pisanie w komórce po dwukliku, Tab, wiersz rośnie z tekstem, Esc', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tabela');
  await wstawTabele(strona, 3, 4);
  let s = await stanTabeli(strona);
  assert.equal(s.naPlotnie, 1, 'na stronie jest jeden element');
  assert.deepEqual([s.kolumny, s.wiersze, s.naglowek], [[32, 32, 32, 32], [9, 9, 9], true]);
  assert.deepEqual([s.lewo, s.szer, s.wys], [10, 128, 27], 'tabela na szerokość pola między marginesami');
  assert.equal(s.linii, 9);
  assert.deepEqual(s.teksty[0], ['Kolumna 1', 'Kolumna 2', 'Kolumna 3', 'Kolumna 4']);
  assert.equal(s.zaznaczone, 'tabela');
  assert.equal(s.tytul, 'Tabela');
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.map((o) => o.typ)), [], 'bez ostrzeżeń (także o marginesie)');
  // Na liście warstw tabela to jeden wiersz.
  await strona.click('#zakladki-panelu label:has-text("Warstwy")');
  assert.deepEqual(await strona.locator('#lista-warstw .warstwa-nazwa').allTextContents(), ['Tabela 3×4']);
  await strona.click('#zakladki-panelu label:has-text("Właściwości")');

  // Pojedyncze kliknięcie i przeciągnięcie przesuwa całą tabelę.
  const srodek = await naEkranie(strona, s.lewo + 60, s.gora + 13);
  await strona.mouse.move(...srodek);
  await strona.mouse.down();
  await strona.mouse.move(srodek[0], srodek[1] + 40, { steps: 5 });
  await strona.mouse.up();
  const poRuchu = await stanTabeli(strona);
  assert.ok(poRuchu.gora > s.gora + 5 && poRuchu.zaznaczone === 'tabela', 'tabela przesunięta w całości');
  s = poRuchu;

  // Dwuklik w komórkę drugiego wiersza, pierwszej kolumny: pisanie w niej; panel pokazuje tekst komórki.
  await strona.mouse.dblclick(...(await naEkranie(strona, s.lewo + 16, s.gora + 9 + 4.5)));
  await strona.waitForFunction(() => window.seriodruk.edytor?.aktywny?.isEditing);
  s = await stanTabeli(strona);
  assert.equal(s.zaznaczone, 'komórka [1,0] – pisanie');
  assert.equal(s.tytul, 'Komórka tabeli');
  await strona.keyboard.type('Długi tekst w wąskiej komórce, który zajmie kilka wierszy i podniesie cały wiersz tabeli');
  s = await stanTabeli(strona);
  assert.ok(s.wysokosci[1] > 15, `wiersz rośnie w trakcie pisania: ${s.wysokosci}`);
  assert.deepEqual([s.wysokosci[0], s.wysokosci[2]], [9, 9], 'pozostałe wiersze bez zmian');
  assert.equal(s.wys, Math.round((18 + s.wysokosci[1]) * 100) / 100, 'wysokość tabeli to suma wierszy');
  // Tab: następna komórka; Shift+Tab: poprzednia; pisanie zastępuje zaznaczoną treść komórki.
  await strona.keyboard.press('Tab');
  await strona.keyboard.type('B2');
  assert.equal((await stanTabeli(strona)).zaznaczone, 'komórka [1,1] – pisanie');
  await strona.keyboard.press('Tab');
  await strona.keyboard.press('Tab');
  await strona.keyboard.type('D2');
  await strona.keyboard.press('Shift+Tab');
  await strona.keyboard.type('C2');
  // Kliknięcie innej komórki w trakcie pisania przenosi tam pisanie.
  await strona.mouse.click(...(await naEkranie(strona, s.lewo + 32 * 3 + 20, s.gora + 4)));
  await strona.waitForFunction(() => window.seriodruk.edytor?.miejsceKomorki()?.w === 0);
  await strona.keyboard.press('Control+End');
  await strona.keyboard.type('!');
  // Esc kończy pisanie i wraca do zaznaczenia całej tabeli.
  await strona.keyboard.press('Escape');
  await strona.waitForFunction(() => window.seriodruk.edytor?.aktywny?.tabela);
  s = await stanTabeli(strona);
  assert.equal(s.zaznaczone, 'tabela');
  assert.equal(s.tytul, 'Tabela');
  assert.deepEqual(s.teksty[0], ['Kolumna 1', 'Kolumna 2', 'Kolumna 3', 'Kolumna 4!']);
  assert.deepEqual(s.teksty[1], ['Długi tekst w wąskiej komórce, który zajmie kilka wierszy i podniesie cały wiersz tabeli', 'B2', 'C2', 'D2']);

  // Tab w ostatniej komórce dodaje wiersz.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.edytujKomorke(e.aktywny, [2, 3]); });
  await strona.keyboard.type('koniec');
  await strona.keyboard.press('Tab');
  await strona.keyboard.type('nowy wiersz');
  await strona.keyboard.press('Escape');
  await strona.waitForFunction(() => window.seriodruk.edytor?.aktywny?.tabela);
  s = await stanTabeli(strona);
  assert.equal(s.wiersze.length, 4);
  assert.deepEqual(s.teksty[3], ['nowy wiersz', '', '', '']);
  assert.equal(s.linii, 10);

  // Zapis i ponowne wczytanie: ta sama tabela, nadal jeden element, komórek nie da się wskazać pojedynczym kliknięciem.
  const zapis = await strona.evaluate(async () => {
    await window.seriodruk.zapiszTeraz();
    const o = window.seriodruk.stan.projekt.strony[0].obiekty;
    return { ile: o.length, typ: o[0].type, opis: o[0].tabela, interaktywna: [o[0].interactive, o[0].subTargetCheck], dzieci: o[0].objects.length };
  });
  assert.deepEqual([zapis.ile, zapis.typ, zapis.dzieci], [1, 'group', 16 + 10]);
  assert.deepEqual(zapis.interaktywna, [false, false]);
  const przed = s;
  await strona.evaluate(() => window.seriodruk.przeladuj());
  s = await stanTabeli(strona);
  assert.deepEqual([s.kolumny, s.wiersze, s.teksty, s.wysokosci, s.lewo, s.gora, s.szer, s.wys], [przed.kolumny, przed.wiersze, przed.teksty, przed.wysokosci, przed.lewo, przed.gora, przed.szer, przed.wys]);
  await strona.mouse.click(...(await naEkranie(strona, s.lewo + 16, s.gora + 4)));
  assert.equal((await stanTabeli(strona)).zaznaczone, 'tabela');
  assert.deepEqual(bledy, []);
});

test('tabela: szerokość kolumny uchwytem i liczbą, wiersze i kolumny z panelu, skalowanie, kopia, cofanie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tabela 2');
  await wstawTabele(strona, 3, 3);
  let s = await stanTabeli(strona);
  const szer0 = s.szer;
  const kol = s.kolumny[0];
  await krok(strona);

  // Znacznik nad granicą pierwszej i drugiej kolumny: przeciągnięcie o 10 mm w prawo.
  const uchwyt = await naEkranie(strona, s.lewo + kol, s.gora);
  const cel = await naEkranie(strona, s.lewo + kol + 10, s.gora);
  await strona.mouse.move(uchwyt[0], uchwyt[1] - 12);
  await strona.mouse.down();
  await strona.mouse.move(cel[0], cel[1] - 12, { steps: 6 });
  await strona.mouse.up();
  s = await stanTabeli(strona);
  assert.ok(Math.abs(s.kolumny[0] - (kol + 10)) <= 0.5, `pierwsza kolumna szersza o 10 mm: ${s.kolumny}`);
  assert.ok(Math.abs(s.kolumny[0] + s.kolumny[1] - 2 * kol) < 0.02, 'kosztem sąsiedniej');
  assert.equal(s.szer, szer0, 'szerokość tabeli bez zmian');
  assert.equal(s.lewo, 10, 'lewy róg na miejscu');
  await krok(strona);

  // Liczbą w panelu: zmienia się tylko ta kolumna (i szerokość tabeli).
  await strona.fill('.wlasciwosci label:has-text("Kolumna 3") input', '20');
  await strona.press('.wlasciwosci label:has-text("Kolumna 3") input', 'Tab');
  s = await stanTabeli(strona);
  assert.equal(s.kolumny[2], 20);
  assert.equal(s.szer, Math.round((s.kolumny[0] + s.kolumny[1] + 20) * 100) / 100);
  assert.equal(s.lewo, 10);
  await strona.click('.wlasciwosci button:has-text("Równe szerokości")');
  s = await stanTabeli(strona);
  assert.ok(s.kolumny.every((k) => Math.abs(k - s.szer / 3) < 0.02), `równe kolumny: ${s.kolumny}`);
  await krok(strona);

  // Wiersze i kolumny przyciskami.
  await strona.click('.wlasciwosci button[aria-label="Dodaj wiersz"]');
  await strona.click('.wlasciwosci button[aria-label="Dodaj kolumnę"]');
  s = await stanTabeli(strona);
  assert.deepEqual([s.wiersze.length, s.kolumny.length, s.teksty.flat().length, s.linii], [4, 4, 16, 10]);
  assert.equal(s.teksty[0][3], 'Kolumna 4', 'nowa kolumna dostaje nagłówek');
  assert.match(await strona.getAttribute('.wlasciwosci .licznik-tabeli', 'aria-label'), /Wierszy: 4, kolumn: 4/);
  const szerPo = s.szer;
  assert.ok(Math.abs(s.kolumny.reduce((a, b) => a + b, 0) - szerPo) < 0.05);
  await krok(strona);
  await strona.click('.wlasciwosci button[aria-label="Usuń ostatnią kolumnę"]');
  await strona.click('.wlasciwosci button[aria-label="Usuń ostatni wiersz"]');
  s = await stanTabeli(strona);
  assert.deepEqual([s.wiersze.length, s.kolumny.length], [3, 3]);
  assert.ok(Math.abs(s.szer - szerPo) < 0.05, 'usunięcie kolumny nie zmienia szerokości tabeli');
  await krok(strona);
  // Cofnięcie przywraca usunięty wiersz i kolumnę (jeden krok historii na zmianę).
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().find((o) => o.tabela)?.tabela.kolumny.length === 4);
  s = await stanTabeli(strona);
  assert.deepEqual([s.wiersze.length, s.kolumny.length, s.teksty[0][3]], [4, 4, 'Kolumna 4']);

  // W trakcie pisania: wstawienie wiersza pod bieżącym i usunięcie kolumny z bieżącą komórką.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const g = e.canvas.getObjects().find((o) => o.tabela); e.canvas.setActiveObject(g); e.edytujKomorke(g, [1, 1]); });
  await strona.keyboard.type('środek');
  await strona.click('.wlasciwosci button:has-text("Wstaw wiersz poniżej")');
  s = await stanTabeli(strona);
  assert.equal(s.wiersze.length, 5);
  assert.equal(s.zaznaczone, 'komórka [1,1] – pisanie', 'pisanie trwa w tej samej komórce');
  assert.deepEqual(s.teksty[2], ['', '', '', ''], 'nowy wiersz jest pod bieżącym');
  await strona.click('.wlasciwosci button:has-text("Usuń tę kolumnę")');
  await strona.waitForFunction(() => window.seriodruk.edytor?.aktywny?.tabela);
  s = await stanTabeli(strona);
  assert.equal(s.kolumny.length, 3);
  assert.ok(!s.teksty.flat().includes('środek'), 'kolumna z komórką usunięta');
  assert.equal(s.zaznaczone, 'tabela');

  // Nagłówek, najmniejsza wysokość wiersza, linie i tekst wszystkich komórek naraz.
  await strona.fill('.wlasciwosci label:has-text("Najmniejsza wysokość wiersza") input', '12');
  await strona.press('.wlasciwosci label:has-text("Najmniejsza wysokość wiersza") input', 'Tab');
  await strona.fill('.wlasciwosci label:has-text("Grubość linii") input', '0.5');
  await strona.press('.wlasciwosci label:has-text("Grubość linii") input', 'Tab');
  await strona.selectOption('.wlasciwosci fieldset:has-text("Tekst w komórkach") label:has-text("Czcionka") select', 'Lora');
  await strona.uncheck('.wlasciwosci label:has-text("Pierwszy wiersz to nagłówek") input');
  const wyglad = await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const g = e.aktywny;
    const linie = g.getObjects().filter((o) => o.type === 'line');
    return { h: e.komorkiTabeli(g).map((c) => c.ramka_h), czcionki: [...new Set(e.komorkiTabeli(g).map((c) => c.fontFamily))], wagi: [...new Set(e.komorkiTabeli(g).map((c) => c.fontWeight))], linie: [...new Set(linie.map((l) => l.strokeWidth))] };
  });
  assert.ok(wyglad.h.every((h) => h === 12));
  assert.deepEqual([wyglad.czcionki, wyglad.wagi, wyglad.linie], [['Lora'], ['normal'], [0.5]]);

  // Skalowanie narożnym uchwytem zmienia szerokości kolumn i wysokości wierszy, nie rozmiar pisma.
  s = await stanTabeli(strona);
  const rog = await naEkranie(strona, s.lewo + s.szer, s.gora + s.wys);
  const nowyRog = await naEkranie(strona, s.lewo + s.szer * 0.8, s.gora + s.wys * 0.8);
  await strona.mouse.move(...rog);
  await strona.mouse.down();
  await strona.mouse.move(...nowyRog, { steps: 6 });
  await strona.mouse.up();
  const poSkali = await stanTabeli(strona);
  assert.deepEqual(poSkali.skala, [1, 1], 'tabela nie zostaje przeskalowana');
  assert.ok(poSkali.szer < s.szer * 0.9 && poSkali.szer > s.szer * 0.7, `tabela węższa: ${s.szer} → ${poSkali.szer}`);
  assert.equal(await strona.evaluate(() => { const e = window.seriodruk.edytor; return Math.round(e.komorkiTabeli(e.aktywny)[0].fontSize * 72 / 25.4 * 10) / 10; }), 9, 'pismo ma nadal 9 pt');
  assert.equal(poSkali.lewo, s.lewo);

  // Kopia (Ctrl+D) jest osobną tabelą: zmiana kolumny w kopii nie rusza oryginału. Rozgrupować tabeli się nie da.
  await strona.keyboard.press('Control+d');
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().filter((o) => o.tabela).length === 2);
  await strona.fill('.wlasciwosci label:has-text("Kolumna 1") input', '15');
  await strona.press('.wlasciwosci label:has-text("Kolumna 1") input', 'Tab');
  const [oryginal, kopia] = [await stanTabeli(strona, 0), await stanTabeli(strona, 1)];
  assert.equal(kopia.kolumny[0], 15);
  assert.deepEqual(oryginal.kolumny, poSkali.kolumny);
  assert.equal(kopia.zaznaczone, 'tabela');
  await strona.keyboard.press('Control+Shift+g');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().length), 2, 'tabela zostaje jednym elementem');
  assert.equal(await strona.locator('.wlasciwosci button:has-text("Rozgrupuj")').count(), 0);
  assert.deepEqual(bledy, []);
});

test('tabela z danymi: w serii wiersz rośnie zależnie od treści powielenia; PDF wektorowy niesie tekst komórek', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tabela z danymi');
  await wstawTabele(strona, 2, 2);
  const DLUGI = 'Bardzo długi opis dnia, który na pewno nie zmieści się w jednym wierszu wąskiej komórki tabeli i zajmie ich kilka.';
  const wynik = await strona.evaluate(async ([dlugi, pdfjs, watek]) => {
    const { edytor: e, stan, zapiszTeraz, przeladuj } = window.seriodruk;
    const g = e.aktywny;
    const komorki = e.komorkiTabeli(g);
    komorki[2].set('text', 'Dzień {dzien}');
    komorki[3].set('text', '{opis}');
    e.zatwierdz();
    await zapiszTeraz();
    const p = stan.projekt;
    p.tabele.push({ id: 't1', nazwa: 'Dni', kolumny: ['dzien', 'opis'], wiersze: [['1', 'Krótko.'], ['2', dlugi]] });
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    await przeladuj();
    const { rozwin } = await import('./js/serie.js');
    const { zlozCel } = await import('./js/zlozenie.js');
    const { sprawdzMieszczenie } = await import('./js/kontrola-skladu.js');
    const { eksportujPdf } = await import('./js/eksport.js');
    const ciag = rozwin(p);
    const strony = [];
    for (const egz of ciag.egzemplarze) {
      const { obiekty } = await zlozCel(p, egz, { ciag });
      const tab = obiekty.find((o) => o.tabela);
      const kom = tab.getObjects().filter((o) => o.type === 'textbox');
      strony.push({ teksty: kom.map((c) => c.text), wiersz2: Math.round(kom[2].ramka_h * 10) / 10, wys: Math.round(tab.height * 10) / 10, gora: tab.top, lewo: tab.left });
    }
    const uwagi = (await sprawdzMieszczenie(p, ciag)).map((u) => u.opis);
    // Wzór w edytorze zostaje, jaki był.
    const wzor = e.komorkiTabeli(e.canvas.getObjects().find((o) => o.tabela)).map((c) => c.text);
    // PDF wektorowy: dwie strony, tekst komórek jako tekst, nic nie idzie jako obraz.
    const pdf = await eksportujPdf(p, { tryb: 'wektor', dpi: 150, znaki: false });
    const bajty = new Uint8Array(await pdf.blob.arrayBuffer());
    await new Promise((ok, blad) => { const s = document.createElement('script'); s.src = pdfjs; s.onload = ok; s.onerror = blad; document.head.append(s); });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = watek;
    const dok = await window.pdfjsLib.getDocument({ data: bajty.slice() }).promise;
    const teksty = [];
    for (let i = 1; i <= dok.numPages; i += 1) teksty.push((await (await dok.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ').replace(/\s+/g, ' '));
    const dokument = await window.PDFLib.PDFDocument.load(bajty);
    const zasoby = dokument.getPage(0).node.Resources();
    const obrazow = zasoby.lookupMaybe(window.PDFLib.PDFName.of('XObject'), window.PDFLib.PDFDict)?.keys().length || 0;
    return { strony, uwagi, wzor, pdf: { stron: dok.numPages, teksty, jakoObraz: pdf.uwagi, obrazow } };
  }, [DLUGI, PDFJS, PDFJS_WATEK]);

  assert.deepEqual(wynik.strony[0].teksty, ['Kolumna 1', 'Kolumna 2', 'Dzień 1', 'Krótko.']);
  assert.deepEqual(wynik.strony[1].teksty, ['Kolumna 1', 'Kolumna 2', 'Dzień 2', DLUGI]);
  assert.equal(wynik.strony[0].wiersz2, 9, 'krótki tekst: wiersz ma najmniejszą wysokość');
  assert.ok(wynik.strony[1].wiersz2 > 12, `długi tekst podnosi wiersz: ${wynik.strony[1].wiersz2}`);
  assert.ok(wynik.strony[1].wys > wynik.strony[0].wys);
  assert.deepEqual([wynik.strony[0].gora, wynik.strony[0].lewo], [wynik.strony[1].gora, wynik.strony[1].lewo], 'róg tabeli w tym samym miejscu na obu stronach');
  assert.deepEqual(wynik.uwagi, [], 'tekst w tabeli zawsze się mieści – bez uwag przed drukiem');
  assert.deepEqual(wynik.wzor, ['Kolumna 1', 'Kolumna 2', 'Dzień {dzien}', '{opis}']);
  assert.equal(wynik.pdf.stron, 2);
  assert.deepEqual(wynik.pdf.jakoObraz, [], 'tabela jest w pliku wektorem');
  assert.equal(wynik.pdf.obrazow, 0);
  assert.ok(wynik.pdf.teksty[0].includes('Kolumna 1') && wynik.pdf.teksty[0].includes('Dzień 1') && wynik.pdf.teksty[0].includes('Krótko.'), wynik.pdf.teksty[0]);
  assert.ok(wynik.pdf.teksty[1].includes('Dzień 2') && wynik.pdf.teksty[1].replace(/\s+/g, '').includes(DLUGI.replace(/\s+/g, '')), wynik.pdf.teksty[1]);
  assert.deepEqual(bledy, []);
});

test('tabela: tło nagłówka i co drugiego wiersza, własna wysokość jednego wiersza, skalowanie przelicza wymiary już w trakcie przeciągania', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tabela – wygląd');
  await wstawTabele(strona, 4, 3);
  const tla = () => strona.evaluate(() => { const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.tabela); return g.getObjects().filter((o) => o.type === 'rect').map((r) => [r.fill, Math.round(r.top * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]); });
  assert.deepEqual(await tla(), [], 'nowa tabela nie ma tła');

  // Tło nagłówka i „zebra”: prostokąty na spodzie grupy, pod tekstem komórek.
  await strona.check('.wlasciwosci label:has-text("Tło wiersza nagłówka") input');
  await strona.check('.wlasciwosci label:has-text("Tło co drugiego wiersza") input');
  let s = await stanTabeli(strona);
  const p = await tla();
  assert.equal(p.length, 2, 'nagłówek i jeden z trzech wierszy treści (drugi)');
  assert.deepEqual(p.map((x) => x[0]), ['#e8e6e1', '#f4f2ee']);
  assert.ok(p.every((x) => Math.abs(x[2] - s.szer) < 0.11), 'tło na całą szerokość tabeli');
  assert.ok(Math.abs(p[1][1] - (-s.wys / 2 + s.wysokosci[0] + s.wysokosci[1])) < 0.11, 'zebra leży w trzecim wierszu tabeli (drugim wierszu treści)');
  const kolejnosc = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.tabela).getObjects().map((o) => o.type[0]).join(''));
  assert.match(kolejnosc, /^r+t+l+$/, `tło pod tekstem, linie na wierzchu: ${kolejnosc}`);
  // Dodanie wiersza i kolumny przy włączonym tle nie miesza komórek.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const g = e.aktywny; e.komorkiTabeli(g)[4].set('text', 'B2'); e.zatwierdz(); });
  await strona.click('.wlasciwosci button[aria-label="Dodaj wiersz"]');
  await strona.click('.wlasciwosci button[aria-label="Dodaj kolumnę"]');
  s = await stanTabeli(strona);
  assert.equal(s.teksty[1][1], 'B2');
  assert.deepEqual([s.teksty.length, s.teksty[0].length], [5, 4]);
  assert.equal((await tla()).length, 3, 'pięć wierszy: nagłówek i dwa wiersze zebry');
  // Zapis i ponowne wczytanie: tło zostaje, nie dubluje się.
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  assert.equal((await tla()).length, 3);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty[0].tabela.tlo), { naglowek: '#e8e6e1', zebra: '#f4f2ee' });

  // Własna najmniejsza wysokość jednego wiersza: z panelu tabeli i z panelu komórki w trakcie pisania.
  await strona.evaluate(() => window.seriodruk.edytor.zaznacz(window.seriodruk.edytor.canvas.getObjects().find((o) => o.tabela).id));
  await strona.fill('.wlasciwosci fieldset:has-text("Wysokości wierszy") label:has-text("Wiersz 3") input', '20');
  await strona.press('.wlasciwosci fieldset:has-text("Wysokości wierszy") label:has-text("Wiersz 3") input', 'Tab');
  s = await stanTabeli(strona);
  assert.deepEqual(s.wysokosci, [9, 9, 20, 9, 9]);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.edytujKomorke(e.aktywny, [1, 0]); });
  await strona.fill('.wlasciwosci label:has-text("Najmniejsza wysokość tego wiersza") input', '14');
  await strona.press('.wlasciwosci label:has-text("Najmniejsza wysokość tego wiersza") input', 'Tab');
  s = await stanTabeli(strona);
  assert.deepEqual(s.wysokosci, [9, 14, 20, 9, 9]);

  // Skalowanie narożnym uchwytem: w połowie ruchu (przed puszczeniem) tabela ma już nowe szerokości kolumn i skalę 1.
  await strona.keyboard.press('Escape');
  await strona.evaluate(() => window.seriodruk.edytor.zaznacz(window.seriodruk.edytor.canvas.getObjects().find((o) => o.tabela).id));
  s = await stanTabeli(strona);
  const rog = await naEkranie(strona, s.lewo + s.szer, s.gora + s.wys);
  const cel = await naEkranie(strona, s.lewo + s.szer * 0.75, s.gora + s.wys * 0.75);
  await strona.mouse.move(...rog);
  await strona.mouse.down();
  await strona.mouse.move(...cel, { steps: 8 });
  const wTrakcie = await stanTabeli(strona);
  assert.deepEqual(wTrakcie.skala, [1, 1], 'w trakcie przeciągania tabela nie jest rozciągnięta');
  assert.ok(wTrakcie.szer < s.szer * 0.85 && wTrakcie.szer > s.szer * 0.65, `szerokość w trakcie: ${s.szer} → ${wTrakcie.szer}`);
  assert.deepEqual([wTrakcie.lewo, wTrakcie.gora], [s.lewo, s.gora], 'lewy górny róg stoi w miejscu');
  await strona.mouse.up();
  const po = await stanTabeli(strona);
  assert.deepEqual(po.kolumny, wTrakcie.kolumny);
  assert.ok(Math.abs((await tla())[0][2] - po.szer) < 0.11, 'tło idzie za szerokością tabeli');
  assert.deepEqual(bledy, []);
});

test('tabela: scalanie komórek w poziomie i w pionie, Tab pomija schowane, wiersz rośnie od scalonej komórki, tło, wiersze i kolumny, zapis, rozdzielenie, cofnięcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Scalanie');
  await wstawTabele(strona, 4, 3);
  const opis = () => strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const g = e.canvas.getObjects().find((o) => o.tabela);
    const k = e.komorkiTabeli(g);
    const K = g.tabela.kolumny.length;
    const z = (x) => Math.round(x * 100) / 100;
    const a = e.aktywny;
    return {
      scalenia: (g.tabela.scalenia || []).map((s) => [s.w, s.k, s.ileW, s.ileK]),
      widoczne: g.tabela.wiersze.map((_, w) => k.slice(w * K, (w + 1) * K).map((c) => (c.visible ? 1 : 0)).join('')),
      teksty: g.tabela.wiersze.map((_, w) => k.slice(w * K, (w + 1) * K).map((c) => c.text)),
      szer: k.map((c) => z(c.width)), wys: k.map((c) => z(c.ramka_h)),
      kolumny: g.tabela.kolumny.map(z), wiersze: g.tabela.wiersze.length,
      linii: g.getObjects().filter((o) => o.type === 'line').length,
      pionoweNaGranicy1: g.getObjects().filter((o) => o.type === 'line' && Math.abs(o.x1 - o.x2) < 0.001 && Math.abs(o.x1 - (-g.width / 2 + g.tabela.kolumny[0])) < 0.01).map((l) => [z(Math.min(l.y1, l.y2) + g.height / 2), z(Math.max(l.y1, l.y2) + g.height / 2)]).sort((p, q) => p[0] - q[0]),
      tla: g.getObjects().filter((o) => o.type === 'rect').map((r) => [z(r.left + g.width / 2), z(r.top + g.height / 2), z(r.width), z(r.height), r.fill]),
      pisana: a?.isEditing && a.group === g ? Object.values(e.miejsceKomorki(a)) : null,
      wysTabeli: z(g.height),
    };
  });
  const pisz = (w, k) => strona.evaluate(([ww, kk]) => { const e = window.seriodruk.edytor; e.edytujKomorke(e.canvas.getObjects().find((o) => o.tabela), [ww, kk]); }, [w, k]);
  const kol = 128 / 3; // szerokość kolumny (128 mm między marginesami)
  const blisko = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

  // Treść scalonej komórki (co dzieje się z tekstem dołączanych komórek, sprawdza następny test).
  await pisz(1, 0); await strona.keyboard.insertText('Razem');
  let o = await opis();
  assert.equal(o.linii, 9);

  // Scalenie w poziomie: przycisk w panelu komórki; pisanie zostaje w scalonej komórce.
  await strona.click('.wlasciwosci button:has-text("Scal z komórką po prawej")');
  o = await opis();
  assert.deepEqual(o.scalenia, [[1, 0, 1, 2]]);
  assert.deepEqual(o.widoczne, ['111', '101', '111', '111']);
  assert.ok(blisko(o.szer[3], 2 * kol - 3), `scalona komórka ma szerokość dwóch kolumn: ${o.szer[3]}`);
  assert.deepEqual(o.pisana, [1, 0]);
  assert.deepEqual(o.pionoweNaGranicy1, [[0, 9], [18, 36]], 'linia między kolumnami 1 i 2 omija scaloną komórkę');
  assert.match(await strona.textContent('.wlasciwosci'), /Ta komórka zajmuje 2 kolumny i 1 wiersz/);

  // Scalenie w pionie: komórka 2 × 2.
  await strona.click('.wlasciwosci button:has-text("Scal z komórką poniżej")');
  o = await opis();
  assert.deepEqual(o.scalenia, [[1, 0, 2, 2]]);
  assert.deepEqual(o.widoczne, ['111', '101', '001', '111']);
  assert.equal(o.wys[3], 18, 'scalona komórka ma wysokość dwóch wierszy');
  assert.deepEqual(o.pionoweNaGranicy1, [[0, 9], [27, 36]]);
  assert.equal(o.linii, 10, 'pozioma linia między wierszami 2 i 3 zaczyna się za scaloną komórką');

  // Tab pomija komórki schowane pod scaleniem.
  await strona.keyboard.press('Tab');
  assert.deepEqual((await opis()).pisana, [1, 2]);
  await strona.keyboard.press('Tab');
  assert.deepEqual((await opis()).pisana, [2, 2]);
  await strona.keyboard.press('Shift+Tab');
  await strona.keyboard.press('Shift+Tab');
  assert.deepEqual((await opis()).pisana, [1, 0]);

  // Długi tekst w scalonej komórce wydłuża ostatni z jej wierszy; pierwszy zostaje.
  await strona.keyboard.press('Control+End');
  await strona.keyboard.insertText(` ${'i dalszy ciąg tekstu, który nie mieści się w dwóch wierszach '.repeat(6)}`);
  o = await opis();
  assert.equal(o.wys[2], 9, 'wiersz 2 (komórka obok) zostaje');
  assert.ok(o.wys[8] > 9.5, `wiersz 3 urósł: ${o.wys[8]}`);
  assert.ok(blisko(o.wys[3], 9 + o.wys[8]), 'scalona komórka = suma swoich wierszy');
  await strona.keyboard.press('Escape');

  // Tło: nagłówek na całą szerokość; „zebra” w wierszu 3 tylko poza scaloną komórką (ta ma tło swojego pierwszego wiersza – tu żadne).
  await strona.evaluate(async () => { const { ustawTloTabeli } = await import('./js/tabela-obiekt.js'); const e = window.seriodruk.edytor; ustawTloTabeli(e.canvas.getObjects().find((x) => x.tabela), { naglowek: '#dddddd', zebra: '#eeeeee' }); e.zatwierdz(); });
  o = await opis();
  assert.equal(o.tla.length, 2);
  assert.deepEqual(o.tla[0].slice(0, 3).concat(o.tla[0][4]).map((x) => (typeof x === 'number' ? Math.round(x) : x)), [0, 0, 128, '#dddddd']);
  assert.ok(blisko(o.tla[1][0], 2 * kol) && blisko(o.tla[1][2], kol) && o.tla[1][4] === '#eeeeee', `zebra tylko w trzeciej kolumnie: ${o.tla[1]}`);

  // Zapis i ponowne wczytanie: scalenie i schowane komórki zostają.
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  o = await opis();
  assert.deepEqual(o.scalenia, [[1, 0, 2, 2]]);
  assert.deepEqual(o.widoczne, ['111', '101', '001', '111']);
  assert.equal(o.teksty[1][1], '');
  // Składanie strony (podgląd, PDF) nie rysuje schowanych komórek.
  const zlozone = await strona.evaluate(async () => {
    const { zlozCel } = await import('./js/zlozenie.js');
    const p = window.seriodruk.stan.projekt;
    const { obiekty } = await zlozCel(p, p.strony[0]);
    const g = obiekty.find((x) => x.tabela);
    return g.getObjects().filter((x) => x.type === 'textbox').map((c) => (c.visible ? 1 : 0)).join('');
  });
  assert.equal(zlozone, '111101001111');

  // Nowy wiersz w środku scalenia wydłuża je; usunięcie pierwszego wiersza scalenia zostawia treść.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zmienTabele(e.canvas.getObjects().find((x) => x.tabela), 'wiersz+', 1); });
  o = await opis();
  assert.deepEqual([o.scalenia, o.wiersze], [[[1, 0, 3, 2]], 5]);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zmienTabele(e.canvas.getObjects().find((x) => x.tabela), 'wiersz-', 1); });
  o = await opis();
  assert.deepEqual([o.scalenia, o.wiersze], [[[1, 0, 2, 2]], 4]);
  assert.match(o.teksty[1][0], /^Razem i dalszy ciąg/, 'treść scalonej komórki przeszła do nowej pierwszej komórki');
  // Usunięcie pierwszej kolumny scalenia: zostaje scalenie w pionie, treść zostaje.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zmienTabele(e.canvas.getObjects().find((x) => x.tabela), 'kolumna-', 0); });
  o = await opis();
  assert.deepEqual(o.scalenia, [[1, 0, 2, 1]]);
  assert.match(o.teksty[1][0], /^Razem i dalszy ciąg/);
  assert.deepEqual(o.widoczne, ['11', '11', '01', '11']);
  await krok(strona);

  // Rozdzielenie: komórki wracają; cofnięcie przywraca scalenie.
  await pisz(1, 0);
  await strona.click('.wlasciwosci button:has-text("Rozdziel komórki")');
  o = await opis();
  assert.deepEqual([o.scalenia, o.widoczne], [[], ['11', '11', '11', '11']]);
  assert.deepEqual(o.pisana, [1, 0]);
  await strona.keyboard.press('Escape');
  await krok(strona);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().find((x) => x.tabela)?.tabela.scalenia?.length === 1);
  assert.deepEqual((await opis()).widoczne, ['11', '11', '01', '11']);
  assert.deepEqual(bledy, []);
});

test('tabela: przy scalaniu tekst dołączanych komórek przechodzi do scalonej; rozdzielenie zostawia go w pierwszej, cofnięcie przywraca', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Scalanie tekstu');
  await wstawTabele(strona, 4, 3);
  const opis = () => strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const g = e.canvas.getObjects().find((o) => o.tabela);
    const k = e.komorkiTabeli(g);
    const K = g.tabela.kolumny.length;
    return {
      scalenia: (g.tabela.scalenia || []).map((s) => [s.w, s.k, s.ileW, s.ileK]),
      teksty: g.tabela.wiersze.map((_, w) => k.slice(w * K, (w + 1) * K).map((c) => c.text)),
      // Akapity komórki (1, 0), w których są pogrubione znaki.
      pogrubione: Object.entries(k[K].styles || {}).filter(([, wiersz]) => Object.values(wiersz).some((z) => z.fontWeight === 'bold')).map(([nr]) => Number(nr)),
      wys: k.map((c) => Math.round(c.ramka_h * 100) / 100),
    };
  });
  const pisz = async (w, k, tekst) => {
    await strona.evaluate(([ww, kk]) => { const e = window.seriodruk.edytor; e.edytujKomorke(e.canvas.getObjects().find((o) => o.tabela), [ww, kk]); }, [w, k]);
    if (tekst) await strona.keyboard.insertText(tekst);
  };
  const zmien = (co, w, k) => strona.evaluate(([c, ww, kk]) => { const e = window.seriodruk.edytor; return e.zmienTabele(e.canvas.getObjects().find((o) => o.tabela), c, { w: ww, k: kk }); }, [co, w, k]);

  // Wiersz 2: trzy komórki z tekstem, środkowa z pogrubionym słowem; wiersz 3: tekst tylko w środkowej.
  await pisz(1, 1, 'Środkowa gruba');
  await strona.evaluate(() => window.seriodruk.edytor.aktywny.setSelectionStyles({ fontWeight: 'bold' }, 9, 14));
  await pisz(1, 2, 'Prawa');
  await pisz(2, 1, 'Dolna');
  await pisz(1, 0, 'Lewa');
  const przed = await opis();
  assert.deepEqual(przed.teksty.slice(1, 3), [['Lewa', 'Środkowa gruba', 'Prawa'], ['', 'Dolna', '']]);
  await krok(strona);

  // Scalenie w prawo (przycisk w panelu komórki): tekst dołączonej komórki dochodzi jako nowy akapit – z pogrubieniem;
  // dołączona komórka zostaje pusta.
  await strona.click('.wlasciwosci button:has-text("Scal z komórką po prawej")');
  let o = await opis();
  assert.deepEqual(o.scalenia, [[1, 0, 1, 2]]);
  assert.deepEqual(o.teksty[1], ['Lewa\nŚrodkowa gruba', '', 'Prawa']);
  assert.deepEqual(o.pogrubione, [1], 'pogrubienie przeszło razem z tekstem, do drugiego akapitu');
  assert.ok(o.wys[3] > przed.wys[3], 'wiersz urósł, bo scalona komórka ma dwa akapity');
  assert.match(await strona.textContent('.wlasciwosci'), /Tekst komórek, które przykryła, jest w niej dopisany/);
  // Jeszcze raz w prawo i w dół: kolejność wierszami, od lewej; puste komórki niczego nie dopisują.
  await strona.click('.wlasciwosci button:has-text("Scal z komórką po prawej")');
  await strona.click('.wlasciwosci button:has-text("Scal z komórką poniżej")');
  await strona.keyboard.press('Escape');
  o = await opis();
  assert.deepEqual(o.scalenia, [[1, 0, 2, 3]]);
  assert.deepEqual(o.teksty.slice(1, 3), [['Lewa\nŚrodkowa gruba\nPrawa\nDolna', '', ''], ['', '', '']]);

  // Zapis i wczytanie: tekst jest w scalonej komórce, schowane są puste.
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  o = await opis();
  assert.deepEqual(o.teksty.slice(1, 3), [['Lewa\nŚrodkowa gruba\nPrawa\nDolna', '', ''], ['', '', '']]);
  assert.deepEqual(o.pogrubione, [1]);

  // Rozdzielenie: osobne komórki wracają, cały tekst zostaje w pierwszej.
  await zmien('rozdziel', 1, 0);
  o = await opis();
  assert.deepEqual(o.scalenia, []);
  assert.deepEqual(o.teksty.slice(1, 3), [['Lewa\nŚrodkowa gruba\nPrawa\nDolna', '', ''], ['', '', '']]);

  // Pusta komórka scalana z niepustą przejmuje jej tekst bez pustego akapitu na początku.
  await pisz(3, 1, 'Sama');
  await pisz(3, 0);
  await krok(strona);
  await strona.click('.wlasciwosci button:has-text("Scal z komórką po prawej")');
  await strona.keyboard.press('Escape');
  o = await opis();
  assert.deepEqual([o.scalenia, o.teksty[3]], [[[3, 0, 1, 2]], ['Sama', '', '']]);
  await krok(strona);
  // Cofnięcie przywraca stan sprzed scalenia: tekst wraca do swojej komórki.
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => { const e = window.seriodruk.edytor; const g = e.canvas.getObjects().find((x) => x.tabela); return g && !g.tabela.scalenia?.length && e.komorkiTabeli(g)[10].text === 'Sama'; });
  o = await opis();
  assert.deepEqual(o.teksty[3], ['', 'Sama', '']);
  assert.deepEqual(o.teksty[1], ['Lewa\nŚrodkowa gruba\nPrawa\nDolna', '', ''], 'wcześniejsze kroki zostały');
  assert.deepEqual(bledy, []);
});

// Linie siatki tabeli: wpisy własnych krawędzi i to, co jest narysowane. Narysowana linia to np. „h1 0-3 0.5 #1a1a1a”:
// pozioma na granicy nad wierszem 1, od granicy kolumn 0 do 3, grubość w mm, kolor.
const linieTabeli = (strona) => strona.evaluate(async () => {
  const { wysokosciWierszy } = await import('./js/tabela-obiekt.js');
  const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.tabela);
  const z = (x) => Math.round(x * 100) / 100;
  const granice = (wymiary) => wymiary.reduce((lista, s) => [...lista, lista.at(-1) + s], [0]);
  const nr = (lista, x) => lista.findIndex((v) => Math.abs(v - x) < 0.02);
  const X = granice(g.tabela.kolumny);
  const Y = granice(wysokosciWierszy(g));
  return {
    wpisy: (g.tabela.linie_komorek || []).map((l) => `${l.os}${l.w},${l.k}:${l.grubosc}${l.kolor || ''}`).sort(),
    rysowane: g.getObjects().filter((o) => o.type === 'line' && o.visible).map((l) => {
      const poziom = Math.abs(l.y1 - l.y2) < 0.001;
      const [x1, x2] = [l.x1, l.x2].map((x) => nr(X, x + g.width / 2)).sort((a, b) => a - b);
      const [y1, y2] = [l.y1, l.y2].map((y) => nr(Y, y + g.height / 2)).sort((a, b) => a - b);
      return poziom ? `h${y1} ${x1}-${x2} ${z(l.strokeWidth)} ${l.stroke}` : `v${x1} ${y1}-${y2} ${z(l.strokeWidth)} ${l.stroke}`;
    }).sort(),
  };
});

test('tabela: linie pojedynczej komórki – własna i bez linii, krawędź wspólna z sąsiadem, scalona komórka, wiersze i kolumny, zapis, PDF, cofnięcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Linie komórek');
  await wstawTabele(strona, 3, 3);
  const C = '#1a1a1a';
  const pisz = (w, k) => strona.evaluate(([ww, kk]) => { const e = window.seriodruk.edytor; e.edytujKomorke(e.canvas.getObjects().find((o) => o.tabela), [ww, kk]); }, [w, k]);
  const krawedz = (ktora) => `.wlasciwosci label[data-krawedz="${ktora}"] select`;
  let l = await linieTabeli(strona);
  assert.deepEqual(l.wpisy, []);
  assert.deepEqual(l.rysowane, [`h0 0-3 0.25 ${C}`, `h1 0-3 0.5 ${C}`, `h2 0-3 0.25 ${C}`, `h3 0-3 0.25 ${C}`, `v0 0-3 0.25 ${C}`, `v1 0-3 0.25 ${C}`, `v2 0-3 0.25 ${C}`, `v3 0-3 0.25 ${C}`]);

  // Środkowa komórka: własna linia u góry (w trakcie pisania w niej) – reszta linii pod nagłówkiem zostaje, jaka była.
  await pisz(1, 1);
  assert.equal(await strona.inputValue(krawedz('gora')), '');
  await strona.selectOption(krawedz('gora'), 'wlasna');
  await strona.fill('.wlasciwosci label:has-text("Grubość (u góry)") input', '1.2');
  await strona.press('.wlasciwosci label:has-text("Grubość (u góry)") input', 'Tab');
  l = await linieTabeli(strona);
  assert.deepEqual(l.wpisy, [`h1,1:1.2${C}`]);
  assert.deepEqual(l.rysowane.filter((x) => x.startsWith('h1')), [`h1 0-1 0.5 ${C}`, `h1 1-2 1.2 ${C}`, `h1 2-3 0.5 ${C}`]);
  assert.equal((await stanTabeli(strona)).zaznaczone, 'komórka [1,1] – pisanie', 'pisanie w komórce trwa');
  // Kolor własnej linii.
  await strona.evaluate(async () => {
    const { ustawKrawedzKomorki } = await import('./js/tabela-obiekt.js');
    const e = window.seriodruk.edytor;
    ustawKrawedzKomorki(e.canvas.getObjects().find((o) => o.tabela), 1, 1, 'gora', { kolor: '#c1121f' });
    e.zatwierdz();
  });
  l = await linieTabeli(strona);
  assert.deepEqual(l.rysowane.filter((x) => x.startsWith('h1')), [`h1 0-1 0.5 ${C}`, `h1 1-2 1.2 #c1121f`, `h1 2-3 0.5 ${C}`]);

  // Bez linii z prawej: ta sama krawędź jest lewą krawędzią sąsiada – u niego widać to samo ustawienie.
  await pisz(1, 1);
  await strona.selectOption(krawedz('prawo'), 'brak');
  l = await linieTabeli(strona);
  assert.deepEqual(l.wpisy, ['h1,1:1.2#c1121f', `v1,2:0${C}`]);
  assert.deepEqual(l.rysowane.filter((x) => x.startsWith('v2')), [`v2 0-1 0.25 ${C}`, `v2 2-3 0.25 ${C}`]);
  await pisz(1, 2);
  assert.equal(await strona.inputValue(krawedz('lewo')), 'brak');
  await strona.selectOption(krawedz('lewo'), '');
  l = await linieTabeli(strona);
  assert.deepEqual(l.wpisy, ['h1,1:1.2#c1121f']);
  assert.deepEqual(l.rysowane.filter((x) => x.startsWith('v2')), [`v2 0-3 0.25 ${C}`]);

  // Scalona komórka: krawędź obejmuje wszystkie jej odcinki.
  await pisz(1, 1);
  await strona.click('.wlasciwosci button:has-text("Scal z komórką po prawej")');
  await strona.selectOption(krawedz('dol'), 'wlasna');
  l = await linieTabeli(strona);
  assert.deepEqual(l.wpisy, ['h1,1:1.2#c1121f', `h2,1:0.75${C}`, `h2,2:0.75${C}`]);
  assert.deepEqual(l.rysowane.filter((x) => x.startsWith('h2')), [`h2 0-1 0.25 ${C}`, `h2 1-3 0.75 ${C}`]);
  assert.deepEqual(l.rysowane.filter((x) => x.startsWith('v2')), [`v2 0-1 0.25 ${C}`, `v2 2-3 0.25 ${C}`], 'przez środek scalonej komórki linia nie przechodzi');
  const przedZmianami = l;

  // Nowy wiersz pod nagłówkiem: linia pod nagłówkiem zostaje pod nim, linie niższych wierszy jadą w dół. Usunięcie go przywraca stan.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zmienTabele(e.canvas.getObjects().find((o) => o.tabela), 'wiersz+', 0); });
  l = await linieTabeli(strona);
  assert.deepEqual(l.wpisy, ['h1,1:1.2#c1121f', `h3,1:0.75${C}`, `h3,2:0.75${C}`]);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zmienTabele(e.canvas.getObjects().find((o) => o.tabela), 'wiersz-', 1); });
  assert.deepEqual(await linieTabeli(strona), przedZmianami);
  // Nowa kolumna za pierwszą: linie dalszych kolumn jadą w prawo. Usunięcie jej przywraca stan.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zmienTabele(e.canvas.getObjects().find((o) => o.tabela), 'kolumna+', 0); });
  l = await linieTabeli(strona);
  assert.deepEqual(l.wpisy, ['h1,2:1.2#c1121f', `h2,2:0.75${C}`, `h2,3:0.75${C}`]);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zmienTabele(e.canvas.getObjects().find((o) => o.tabela), 'kolumna-', 1); });
  assert.deepEqual((await linieTabeli(strona)).wpisy, przedZmianami.wpisy);
  // Linia boczna wiersza przechodzi na wiersz wstawiony pod nim; usunięcie ostatniego wiersza zostawia dolny brzeg tabeli.
  const boki = await strona.evaluate(async () => {
    const { ustawKrawedzKomorki, dodajWiersz, usunWiersz } = await import('./js/tabela-obiekt.js');
    const { uid } = await import('./js/projekt.js');
    const e = window.seriodruk.edytor;
    const g = e.canvas.getObjects().find((o) => o.tabela);
    const wpisy = () => (g.tabela.linie_komorek || []).filter((x) => x.os === 'v' || x.w >= 3).map((x) => `${x.os}${x.w},${x.k}:${x.grubosc}`).sort();
    ustawKrawedzKomorki(g, 2, 0, 'lewo', { grubosc: 0 });
    ustawKrawedzKomorki(g, 2, 0, 'dol', { grubosc: 1 });
    const a = wpisy();
    dodajWiersz(g, uid, 2);
    const b = wpisy();
    usunWiersz(g, 3);
    const c = wpisy();
    ustawKrawedzKomorki(g, 2, 0, 'lewo', null);
    ustawKrawedzKomorki(g, 2, 0, 'dol', null);
    e.zatwierdz();
    return { a, b, c };
  });
  assert.deepEqual(boki.a, ['h3,0:1', 'v2,0:0']);
  assert.deepEqual(boki.b, ['h4,0:1', 'v2,0:0', 'v3,0:0'], 'nowy ostatni wiersz: dolny brzeg tabeli zostaje dolnym brzegiem, linia boczna jak w wierszu wyżej');
  assert.deepEqual(boki.c, ['h3,0:1', 'v2,0:0']);
  assert.deepEqual((await linieTabeli(strona)).wpisy, przedZmianami.wpisy);

  // Zapis i ponowne wczytanie strony; złożona strona (podgląd, PDF) ma te same linie.
  await strona.keyboard.press('Escape');
  const poWczytaniu = await strona.evaluate(async () => {
    const { zapiszTeraz, przeladuj, stan } = window.seriodruk;
    await zapiszTeraz();
    await przeladuj();
    const { rozwin } = await import('./js/serie.js');
    const { zlozCel } = await import('./js/zlozenie.js');
    const { eksportujPdf } = await import('./js/eksport.js');
    const ciag = rozwin(stan.projekt);
    const { obiekty } = await zlozCel(stan.projekt, ciag.egzemplarze[0], { ciag });
    const tab = obiekty.find((o) => o.tabela);
    const pdf = await eksportujPdf(stan.projekt, { tryb: 'wektor', dpi: 150, znaki: false });
    return {
      zapis: stan.projekt.strony[0].obiekty.find((o) => o.tabela).tabela.linie_komorek.map((x) => `${x.os}${x.w},${x.k}:${x.grubosc}`).sort(),
      zlozone: tab.getObjects().filter((o) => o.type === 'line' && o.visible).map((x) => `${Math.round(x.strokeWidth * 100) / 100} ${x.stroke}`).filter((x) => !x.startsWith('0.25 ') && !x.startsWith('0.5 ')).sort(),
      jakoObraz: pdf.uwagi,
    };
  });
  assert.deepEqual(poWczytaniu.zapis, ['h1,1:1.2', 'h2,1:0.75', 'h2,2:0.75']);
  assert.deepEqual(poWczytaniu.zlozone, [`0.75 ${C}`, '1.2 #c1121f']);
  assert.deepEqual(poWczytaniu.jakoObraz, [], 'tabela z własnymi liniami jest w PDF wektorem');
  assert.deepEqual(await linieTabeli(strona), przedZmianami);

  // Cofnięcie zmiany linii.
  await krok(strona);
  await pisz(2, 0);
  await strona.selectOption(krawedz('lewo'), 'brak');
  assert.equal((await linieTabeli(strona)).wpisy.length, 4);
  await strona.keyboard.press('Escape');
  await krok(strona);
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().find((o) => o.tabela)?.tabela.linie_komorek?.length === 3);
  assert.deepEqual(await linieTabeli(strona), przedZmianami);
  assert.deepEqual(bledy, []);
});

test('tabela na liście warstw: rozwinięcie pokazuje komórki z początkiem treści, kliknięcie komórki zaczyna w niej pisanie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tabela w warstwach');
  await wstawTabele(strona, 3, 2);
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const g = e.aktywny;
    const k = e.komorkiTabeli(g);
    k[2].set('text', 'Poniedziałek');
    k[3].set('text', 'Bardzo długi opis dnia, który na liście warstw widać tylko w skrócie, bo się nie mieści');
    k[4].set('text', 'Dwa\nwiersze');
    e.zatwierdz();
    const r = e.dodajProstokat(); r.set({ left: 20, top: 150, width: 30, height: 20 }); r.setCoords();
    e.canvas.discardActiveObject();
    e.zatwierdz();
  });
  await strona.click('#zakladki-panelu label:has-text("Warstwy")');
  const wiersze = () => strona.evaluate(() => [...document.querySelectorAll('#lista-warstw li.warstwa')].map((li) => (li.classList.contains('w-tabeli')
    ? `  ${li.querySelector('.warstwa-adres').textContent} ${li.querySelector('.warstwa-nazwa').textContent}${li.classList.contains('zaznaczona') ? ' *' : ''}`
    : `${li.querySelector('.warstwa-nazwa').textContent}${li.querySelector('.warstwa-rozwin') ? ` [${li.querySelector('.warstwa-rozwin').getAttribute('aria-expanded')}]` : ''}${li.classList.contains('zaznaczona') ? ' *' : ''}`)));
  assert.deepEqual(await wiersze(), ['Prostokąt', 'Tabela 3×2 [false]']);
  await strona.click('#lista-warstw li:has-text("Tabela") .warstwa-rozwin');
  const KOMORKI = ['  1.1 Kolumna 1', '  1.2 Kolumna 2', '  2.1 Poniedziałek', '  2.2 Bardzo długi opis dnia, który na liście …', '  3.1 Dwa wiersze', '  3.2 (pusta)'];
  assert.deepEqual(await wiersze(), ['Prostokąt', 'Tabela 3×2 [true]', ...KOMORKI]);

  // Kliknięcie komórki na liście: pisanie w tej komórce (cały jej tekst zaznaczony), wiersz listy jest podświetlony.
  await strona.click('#lista-warstw li.w-tabeli:has-text("3.2")');
  assert.equal((await stanTabeli(strona)).zaznaczone, 'komórka [2,1] – pisanie');
  await strona.keyboard.type('Wpisane z listy');
  await strona.click('#lista-warstw li.w-tabeli:has-text("Poniedziałek")');
  let s = await stanTabeli(strona);
  assert.equal(s.zaznaczone, 'komórka [1,0] – pisanie', 'kliknięcie innej komórki przenosi pisanie');
  assert.equal(s.teksty[2][1], 'Wpisane z listy');
  assert.deepEqual(await wiersze(), ['Prostokąt', 'Tabela 3×2 [true]', ...KOMORKI.slice(0, 2), '  2.1 Poniedziałek *', KOMORKI[3], KOMORKI[4], '  3.2 Wpisane z listy']);
  assert.match(await strona.textContent('#tytul-wlasciwosci'), /Komórka tabeli/);
  await strona.keyboard.type('Wtorek');
  await strona.keyboard.press('Escape');
  s = await stanTabeli(strona);
  assert.equal(s.zaznaczone, 'tabela');
  assert.equal(s.teksty[1][0], 'Wtorek');
  assert.equal((await wiersze())[1], 'Tabela 3×2 [true] *', 'po Esc zaznaczona jest cała tabela');

  // Scalona komórka jest na liście raz; schowanych pod nią nie ma.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zmienTabele(e.aktywny, 'scal-prawo', { w: 0, k: 0 }); e.canvas.discardActiveObject(); e.zatwierdz(); });
  assert.deepEqual((await wiersze()).slice(2, 4), ['  1.1 Kolumna 1 Kolumna 2', '  2.1 Wtorek']);
  // Zablokowana tabela: kliknięcie komórki niczego nie zaczyna.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.tabela).id); e.przelaczBlokade(); e.canvas.discardActiveObject(); e.zatwierdz(); });
  await strona.click('#lista-warstw li.w-tabeli:has-text("Wtorek")');
  assert.equal(await strona.evaluate(() => Boolean(window.seriodruk.edytor.aktywny?.isEditing)), false);
  // Zwinięcie.
  await strona.click('#lista-warstw li:has-text("Tabela") .warstwa-rozwin');
  assert.equal((await wiersze()).length, 2);
  assert.deepEqual(bledy, []);
});

test('tabela: linie całego wiersza, kolumny i tabeli naraz – obramowanie, linie wewnętrzne, bez linii, powrót do siatki; scalenie, zapis, cofnięcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Linie zakresu');
  await wstawTabele(strona, 4, 3);
  const C = '#1a1a1a';
  const pisz = (w, k) => strona.evaluate(([ww, kk]) => { const e = window.seriodruk.edytor; e.edytujKomorke(e.canvas.getObjects().find((o) => o.tabela), [ww, kk]); }, [w, k]);
  const pole = (ktore) => `.wlasciwosci [data-linie="${ktore}"]`;
  const ustaw = async ({ zakres, czesc, grubosc }) => {
    if (zakres) await strona.selectOption(`${pole('zakres')} select`, zakres);
    if (czesc) await strona.selectOption(`${pole('czesc')} select`, czesc);
    if (grubosc) { await strona.fill(`${pole('grubosc')} input`, String(grubosc)); await strona.press(`${pole('grubosc')} input`, 'Tab'); }
  };
  const kliknij = (napis) => strona.click(`${pole('przyciski')} button:has-text("${napis}")`);

  // W trakcie pisania w komórce [2,1]: obramowanie całego wiersza.
  await pisz(2, 1);
  await ustaw({ zakres: 'wiersz', czesc: 'obramowanie', grubosc: 0.8 });
  await kliknij('Ustaw te linie');
  let l = await linieTabeli(strona);
  assert.deepEqual(l.wpisy, [`h2,0:0.8${C}`, `h2,1:0.8${C}`, `h2,2:0.8${C}`, `h3,0:0.8${C}`, `h3,1:0.8${C}`, `h3,2:0.8${C}`, `v2,0:0.8${C}`, `v2,3:0.8${C}`]);
  assert.deepEqual(l.rysowane.filter((x) => x.includes(' 0.8 ')), [`h2 0-3 0.8 ${C}`, `h3 0-3 0.8 ${C}`, `v0 2-3 0.8 ${C}`, `v3 2-3 0.8 ${C}`]);
  assert.equal((await stanTabeli(strona)).zaznaczone, 'komórka [2,1] – pisanie', 'pisanie w komórce trwa');
  assert.equal(await strona.inputValue(`${pole('zakres')} select`), 'wiersz', 'wybór zakresu zostaje po przebudowaniu panelu');

  // Cała kolumna bez żadnych linii: znikają jej boki i poziome odcinki w tej kolumnie (także te z obramowania wiersza).
  await ustaw({ zakres: 'kolumna', czesc: 'wszystkie' });
  await kliknij('Bez linii');
  l = await linieTabeli(strona);
  assert.equal(l.wpisy.filter((x) => x.endsWith(':0')).length, 5 + 2 * 4, 'pięć poziomych i dwa razy po cztery pionowe odcinki bez linii');
  assert.deepEqual(l.rysowane.filter((x) => /^v[12] /.test(x)), [], 'boków środkowej kolumny nie ma');
  assert.deepEqual(l.rysowane.filter((x) => x.startsWith('h')), [
    `h0 0-1 0.25 ${C}`, `h0 2-3 0.25 ${C}`, `h1 0-1 0.5 ${C}`, `h1 2-3 0.5 ${C}`, `h2 0-1 0.8 ${C}`, `h2 2-3 0.8 ${C}`,
    `h3 0-1 0.8 ${C}`, `h3 2-3 0.8 ${C}`, `h4 0-1 0.25 ${C}`, `h4 2-3 0.25 ${C}`,
  ]);

  // „Jak w tabeli” dla całej tabeli zdejmuje wszystkie własne ustawienia.
  await ustaw({ zakres: 'tabela', czesc: 'wszystkie' });
  await kliknij('Jak w tabeli');
  l = await linieTabeli(strona);
  assert.deepEqual(l.wpisy, []);
  assert.equal(l.rysowane.length, 9);

  // Zaznaczona cała tabela: grube obramowanie, potem bez poziomych linii wewnętrznych.
  await strona.evaluate(() => window.seriodruk.edytor.aktywny.hiddenTextarea.focus()); // kursor wraca z panelu do komórki
  await strona.keyboard.press('Escape');
  assert.equal((await stanTabeli(strona)).zaznaczone, 'tabela');
  assert.equal(await strona.locator(`${pole('zakres')}`).count(), 0, 'przy zaznaczonej tabeli zakresem jest cała tabela');
  await ustaw({ czesc: 'obramowanie', grubosc: 1 });
  await kliknij('Ustaw te linie');
  await strona.waitForTimeout(400); // osobny krok historii
  await ustaw({ czesc: 'poziome' });
  await kliknij('Bez linii');
  l = await linieTabeli(strona);
  assert.equal(l.wpisy.length, 2 * 3 + 2 * 4 + 3 * 3);
  assert.deepEqual(l.rysowane, [`h0 0-3 1 ${C}`, `h4 0-3 1 ${C}`, `v0 0-4 1 ${C}`, `v1 0-4 0.25 ${C}`, `v2 0-4 0.25 ${C}`, `v3 0-4 1 ${C}`]);

  // Zapis w projekcie i cofnięcie ostatniego kroku (wracają linie poziome).
  await strona.waitForTimeout(400);
  const zapis = await strona.evaluate(async () => {
    await window.seriodruk.zapiszTeraz();
    return window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.tabela).tabela.linie_komorek.length;
  });
  assert.equal(zapis, 23);
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().find((o) => o.tabela)?.tabela.linie_komorek?.length === 14);
  l = await linieTabeli(strona);
  assert.deepEqual(l.rysowane.filter((x) => x.startsWith('h')), [`h0 0-3 1 ${C}`, `h1 0-3 0.5 ${C}`, `h2 0-3 0.25 ${C}`, `h3 0-3 0.25 ${C}`, `h4 0-3 1 ${C}`]);

  // Scalona komórka: odcinek przez jej środek nie dostaje wpisu; wiersz scalenia to wszystkie jego wiersze.
  const scalone = await strona.evaluate(async () => {
    const { scalKomorki, ustawLinieZakresu } = await import('./js/tabela-obiekt.js');
    const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.tabela);
    ustawLinieZakresu(g, 'tabela', {}, 'wszystkie', null);
    scalKomorki(g, 1, 0, 'prawo');
    scalKomorki(g, 1, 0, 'dol');
    const pionowe = ustawLinieZakresu(g, 'tabela', {}, 'pionowe', { grubosc: 0.6 });
    const wpisyPionowe = g.tabela.linie_komorek.map((x) => `${x.os}${x.w},${x.k}`).sort();
    ustawLinieZakresu(g, 'tabela', {}, 'wszystkie', null);
    const wiersz = ustawLinieZakresu(g, 'wiersz', { w: 2, k: 1 }, 'obramowanie', { grubosc: 0.7, kolor: '#c1121f' });
    return { pionowe, wpisyPionowe, wiersz, wpisyWiersza: g.tabela.linie_komorek.map((x) => `${x.os}${x.w},${x.k}:${x.grubosc}${x.kolor}`).sort() };
  });
  assert.equal(scalone.pionowe, 6, 'osiem odcinków wewnętrznych pionowych minus dwa w środku scalenia');
  assert.deepEqual(scalone.wpisyPionowe, ['v0,1', 'v0,2', 'v1,2', 'v2,2', 'v3,1', 'v3,2']);
  assert.equal(scalone.wiersz, 3 + 3 + 2 + 2, 'obramowanie dwóch wierszy scalenia: góra, dół i po dwa odcinki z boków');
  assert.deepEqual(scalone.wpisyWiersza.filter((x) => x.startsWith('v')), ['v1,0:0.7#c1121f', 'v1,3:0.7#c1121f', 'v2,0:0.7#c1121f', 'v2,3:0.7#c1121f']);
  assert.deepEqual(bledy, []);
});
