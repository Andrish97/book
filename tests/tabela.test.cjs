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
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.tabela);
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
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.isEditing);
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
  await strona.waitForFunction(() => window.seriodruk.edytor.miejsceKomorki()?.w === 0);
  await strona.keyboard.press('Control+End');
  await strona.keyboard.type('!');
  // Esc kończy pisanie i wraca do zaznaczenia całej tabeli.
  await strona.keyboard.press('Escape');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.tabela);
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
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.tabela);
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
  await strona.click('.wlasciwosci button:has-text("Dodaj wiersz")');
  await strona.click('.wlasciwosci button:has-text("Dodaj kolumnę")');
  s = await stanTabeli(strona);
  assert.deepEqual([s.wiersze.length, s.kolumny.length, s.teksty.flat().length, s.linii], [4, 4, 16, 10]);
  assert.equal(s.teksty[0][3], 'Kolumna 4', 'nowa kolumna dostaje nagłówek');
  assert.match(await strona.textContent('.wlasciwosci .licznik-tabeli'), /Wierszy: 4, kolumn: 4/);
  const szerPo = s.szer;
  assert.ok(Math.abs(s.kolumny.reduce((a, b) => a + b, 0) - szerPo) < 0.05);
  await krok(strona);
  await strona.click('.wlasciwosci button:has-text("Usuń ostatnią kolumnę")');
  await strona.click('.wlasciwosci button:has-text("Usuń ostatni wiersz")');
  s = await stanTabeli(strona);
  assert.deepEqual([s.wiersze.length, s.kolumny.length], [3, 3]);
  assert.ok(Math.abs(s.szer - szerPo) < 0.05, 'usunięcie kolumny nie zmienia szerokości tabeli');
  await krok(strona);
  // Cofnięcie przywraca usunięty wiersz i kolumnę (jeden krok historii na zmianę).
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.tabela)?.tabela.kolumny.length === 4);
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
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.tabela);
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
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.tabela).length === 2);
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
  await strona.click('.wlasciwosci button:has-text("Dodaj wiersz")');
  await strona.click('.wlasciwosci button:has-text("Dodaj kolumnę")');
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
