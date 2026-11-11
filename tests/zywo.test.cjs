// Zapis na żywo: zmiana trafia na konto po około sekundzie, drugie urządzenie dostaje ją bez
// przeładowania, a zmiany na tej samej stronie łączą się element po elemencie.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, drugieUrzadzenie, nowyProjekt } = require('./pomoc.cjs');

async function zaloguj(strona) {
  await strona.waitForSelector('#ekran-logowania', { state: 'visible' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.click('[data-akcja="zamknij-instrukcje"]');
}

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
const czekajNa = async (warunek, opis, ms = 8000) => {
  const start = Date.now();
  while (!warunek()) {
    if (Date.now() - start > ms) throw new Error(`Nie doczekano się: ${opis}`);
    await new Promise((ok) => { setTimeout(ok, 25); });
  }
  return Date.now() - start;
};

test('zmiana trafia na konto po około sekundzie; wysyłki nie biegną obok siebie i nie ma ich na każdą zmianę', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await zaloguj(strona);
  await nowyProjekt(strona, 'Na żywo 1');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await zapisano(strona);

  // Jedna zmiana: na koncie po około sekundzie (dawniej ponad trzy).
  const przed = baza.zapisy.length;
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ left: 20 }); e.aktywny.setCoords(); e.zatwierdz(); });
  const czas = await czekajNa(() => baza.zapisy.length > przed, 'zapis na koncie');
  assert.ok(czas < 2000, `zapis na koncie po ${czas} ms`);
  await zapisano(strona);

  // Wolna sieć (odpowiedź po 900 ms) i zmiany co 150 ms przez trzy sekundy: wysyłki idą jedna po drugiej,
  // żadna nie rozmija się z numerem wersji poprzedniej, a jest ich dużo mniej niż zmian.
  baza.opoznienieZapisu = 900;
  const start = baza.zapisy.length;
  for (let i = 0; i < 20; i += 1) {
    await strona.evaluate((n) => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => !x.zWzorca); o.set({ left: 20 + n }); o.setCoords(); e.zatwierdz(); }, i + 1);
    await strona.waitForTimeout(150);
  }
  await zapisano(strona);
  baza.opoznienieZapisu = 0;
  const wyslane = baza.zapisy.length - start;
  assert.ok(wyslane >= 1 && wyslane <= 6, `20 zmian dało ${wyslane} wysyłek`);
  assert.equal(baza.najwiecejNaraz, 1, 'wysyłki nie biegną jednocześnie');
  assert.equal(baza.konflikty, 0, 'żadna wysyłka nie została odrzucona');
  // Na koncie jest ostatni stan.
  const lewo = [...baza.strony.values()][0].obiekty[0].left;
  assert.equal(lewo, 40);
  assert.deepEqual(bledy, []);
});

// ---------- Dwa urządzenia na jednym koncie ----------

const prostokat = (strona) => strona.evaluate(() => {
  const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'rect' && !x.zWzorca);
  return o ? Math.round(o.left * 100) / 100 : null;
});
const przesunProstokat = (strona, lewo) => strona.evaluate((l) => {
  const e = window.seriodruk.edytor;
  const o = e.canvas.getObjects().find((x) => x.type === 'rect' && !x.zWzorca);
  o.set({ left: l }); o.setCoords(); e.zatwierdz();
}, lewo);
const prostokatNa = (strona, lewo) => strona.waitForFunction((l) => window.seriodruk.edytor?.canvas.getObjects().find((x) => x.type === 'rect' && !x.zWzorca)?.left === l, lewo, { timeout: 8000 });
const otworzZListy = async (strona, nazwa) => {
  await strona.waitForFunction((n) => [...document.querySelectorAll('#siatka-projektow .karta-projektu strong')].some((e) => e.textContent === n), nazwa, { timeout: 10000 });
  await strona.click(`.karta-projektu:has(strong:text-is("${nazwa}")) .otworz-projekt`);
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk && document.body.dataset.ekran === 'edytor');
};

test('zmiana na jednym urządzeniu pojawia się na drugim bez przeładowania; lista projektów odświeża się sama', async (t) => {
  const a = await otworz(t, { tryb: 'atrapa' });
  await zaloguj(a.strona);
  const b = await drugieUrzadzenie(a);
  await zaloguj(b.strona);
  assert.equal(await b.strona.locator('#siatka-projektow .karta-projektu').count(), 0, 'drugie urządzenie zaczyna z pustą listą');

  // A zakłada projekt – na B pojawia się na liście sam.
  await nowyProjekt(a.strona, 'Wspólny');
  await a.strona.click('[data-akcja="dodaj-prostokat"]');
  await przesunProstokat(a.strona, 20);
  await zapisano(a.strona);
  await otworzZListy(b.strona, 'Wspólny');
  await b.strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((x) => x.type === 'rect' && !x.zWzorca));
  assert.equal(await prostokat(b.strona), 20);
  await zapisano(b.strona);

  // A przesuwa prostokąt – B widzi to po chwili, bez odświeżania strony i bez żadnego pytania.
  const zapisowPrzed = a.baza.zapisy.length;
  await przesunProstokat(a.strona, 33);
  await prostokatNa(b.strona, 33);
  assert.equal(await b.strona.locator('#dlg-konflikt[open]').count(), 0);
  // B nic nie odsyła: po pobraniu ma to samo co konto.
  await a.strona.waitForTimeout(1500);
  assert.equal(a.baza.zapisy.length, zapisowPrzed + 1, 'zmianę wysłało tylko pierwsze urządzenie');
  assert.equal(a.baza.konflikty, 0);
  assert.ok(a.baza.kanaly.dolaczenia >= 2 && a.baza.kanaly.wyslane > 0, `kanał: ${JSON.stringify(a.baza.kanaly)}`);

  // W drugą stronę: B dodaje stronę z tekstem. A (na pierwszej stronie, z zaznaczonym prostokątem) dostaje ją
  // na liście stron, a płótno i zaznaczenie zostają nietknięte.
  await a.strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((x) => x.type === 'rect' && !x.zWzorca).id); window.znacznikPlotna = e.aktywny; });
  await b.strona.click('[data-akcja="strona-dodaj"]');
  await b.strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await b.strona.click('[data-akcja="dodaj-tekst"]');
  await a.strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2 && window.seriodruk.stan.projekt.strony[1].obiekty.length === 1, null, { timeout: 8000 });
  await a.strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((x) => x.type === 'rect' && !x.zWzorca).id); window.znacznikPlotna = e.aktywny; });
  await b.strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ text: 'Z drugiego urządzenia' }); e.zatwierdz(); });
  await a.strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[1]?.obiekty[0]?.text === 'Z drugiego urządzenia', null, { timeout: 8000 });
  const naA = await a.strona.evaluate(() => { const e = window.seriodruk.edytor; return [window.seriodruk.stan.indeks, e.aktywny?.type, e.aktywny === window.znacznikPlotna]; });
  assert.deepEqual(naA, [0, 'rect', true], 'zmiana treści innej strony nie rusza płótna ani zaznaczenia');

  // Okno otwarte na B wstrzymuje wczytanie zmiany strony, którą B ma na płótnie; po zamknięciu zmiana wchodzi.
  await zapisano(b.strona);
  await b.strona.evaluate(() => window.seriodruk.przejdzDoStrony(0));
  await b.strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((x) => x.type === 'rect' && !x.zWzorca));
  await b.strona.click('[data-akcja="dane"]');
  await b.strona.waitForSelector('#dlg-dane[open]');
  await przesunProstokat(a.strona, 47);
  await zapisano(a.strona);
  await b.strona.waitForTimeout(1200);
  assert.equal(await prostokat(b.strona), 33, 'przy otwartym oknie płótno czeka');
  await b.strona.click('#dane-zamknij');
  await prostokatNa(b.strona, 47);
  assert.equal(a.baza.konflikty, 0);
  assert.deepEqual([a.bledy, b.bledy], [[], []]);
});

test('bez kanału powiadomień zmiana dochodzi przy powrocie do karty', async (t) => {
  const a = await otworz(t, { tryb: 'atrapa', bezKanalu: true });
  await zaloguj(a.strona);
  await nowyProjekt(a.strona, 'Bez kanału');
  await a.strona.click('[data-akcja="dodaj-prostokat"]');
  await przesunProstokat(a.strona, 20);
  await zapisano(a.strona);
  const b = await drugieUrzadzenie(a);
  await zaloguj(b.strona);
  await otworzZListy(b.strona, 'Bez kanału');
  await b.strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((x) => x.type === 'rect' && !x.zWzorca));
  await przesunProstokat(a.strona, 61);
  await zapisano(a.strona);
  await b.strona.waitForTimeout(1200);
  assert.equal(await prostokat(b.strona), 20, 'bez kanału drugie urządzenie jeszcze nie wie');
  assert.equal(a.baza.kanaly.wyslane, 0);
  await b.strona.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // powrót do karty
  await prostokatNa(b.strona, 61);
  assert.deepEqual([a.bledy, b.bledy], [[], []]);
});

// ---------- Łączenie element po elemencie ----------

test('łączenie strony element po elemencie (obliczenia): dodane, usunięte, kolejność, ustawienia strony, tekst w połączonych ramkach', async (t) => {
  const { strona, bledy } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const { polaczProjekty, zastosujPolaczenie, postacDoPorownan, podstawaProjektu, opisElementu } = await import('./js/laczenie.js');
    const { normalizuj, nowyProjekt: nowy, nowaStrona } = await import('./js/projekt.js');
    const kopia = (x) => JSON.parse(JSON.stringify(x));
    const szkic = nowy('Elementy');
    const sekcja = szkic.sekcje[0].id;
    const el = (id, inne = {}) => ({ id, type: 'rect', left: 10, top: 10, width: 20, height: 10, ...inne });
    const ramka = (id, nr, tekst) => ({ id, type: 'textbox', left: 10, top: 40 + nr * 30, width: 60, text: tekst, watek: 'w1', watek_nr: nr });
    szkic.strony = [
      { ...nowaStrona('Strona A', sekcja), id: 'A', obiekty: [el('a1'), el('a2'), el('a3'), ramka('r1', 0, 'Pierwsza część tekstu. '), ramka('r2', 1, 'Druga część. ')] },
      { ...nowaStrona('Strona B', sekcja), id: 'B', obiekty: [el('b1'), ramka('r3', 2, 'Trzecia część.')] },
    ];
    szkic.wzorce = [{ ...szkic.wzorce[0], id: 'W', nazwa: 'Wzorzec', obiekty: [el('w1'), el('w2')] }];
    const start = normalizuj(szkic);
    const podstawa = podstawaProjektu(start);
    const str = (p, id) => p.strony.find((s) => s.id === id);
    const ob = (p, sid, eid) => (sid === 'W' ? p.wzorce[0] : str(p, sid)).obiekty.find((o) => o.id === eid);
    const polacz = (zmienMoje, zmienKonto, wybory, baza = podstawa) => {
      const moj = normalizuj(kopia(start));
      const konto = normalizuj(kopia(start));
      zmienMoje(moj); zmienKonto(konto);
      const plan = polaczProjekty(postacDoPorownan(moj), postacDoPorownan(konto), baza);
      const zmienione = zastosujPolaczenie(moj, konto, plan, new Map(wybory || []));
      return {
        pytania: plan.konflikty.map((k) => [k.klucz, k.nazwa, k.moje, k.konto]),
        zKonta: plan.zKonta,
        zmienione: [zmienione.strony, zmienione.wzorce, zmienione.inne],
        A: str(moj, 'A').obiekty.map((o) => `${o.id}@${o.left}${o.text !== undefined ? `:${o.text}` : ''}`),
        B: str(moj, 'B').obiekty.map((o) => `${o.id}@${o.left}${o.text !== undefined ? `:${o.text}` : ''}`),
        W: moj.wzorce[0].obiekty.map((o) => `${o.id}@${o.left}`),
        nazwaA: str(moj, 'A').nazwa, tloA: str(moj, 'A').tlo ?? null,
        takSamoJakKonto: JSON.stringify(podstawaProjektu(moj).listy) === JSON.stringify(podstawaProjektu(konto).listy),
      };
    };
    // Starszy stan uzgodniony: bez odcisków pojedynczych elementów.
    const stara = kopia(podstawa);
    delete stara.listy.strony.czesci; delete stara.listy.wzorce.czesci;
    return {
      opisy: [opisElementu({ type: 'Textbox', text: '  Ala ma\nkota  ' }), opisElementu({ type: 'image', nazwa: 'zdjecie.jpg' }), opisElementu({ type: 'group', tabela: { kolumny: [] } }), opisElementu({ type: 'Path' })],
      rozne: polacz(
        (m) => { ob(m, 'A', 'a1').left = 50; str(m, 'A').obiekty.push(el('m-nowy')); str(m, 'A').nazwa = 'A po mojemu'; ob(m, 'W', 'w1').left = 5; },
        (k) => { ob(k, 'A', 'a2').left = 70; str(k, 'A').obiekty = str(k, 'A').obiekty.filter((o) => o.id !== 'a3'); str(k, 'A').obiekty.splice(1, 0, el('k-nowy')); str(k, 'A').tlo = '#ffeecc'; ob(k, 'W', 'w2').left = 9; },
      ),
      tenSam: polacz((m) => { ob(m, 'A', 'a1').left = 50; ob(m, 'A', 'a2').left = 51; }, (k) => { ob(k, 'A', 'a1').left = 70; ob(k, 'A', 'a3').left = 71; }),
      tenSamKonto: polacz((m) => { ob(m, 'A', 'a1').left = 50; ob(m, 'A', 'a2').left = 51; }, (k) => { ob(k, 'A', 'a1').left = 70; ob(k, 'A', 'a3').left = 71; }, [['strony:A#a1', 'konto']]),
      usunietyTam: polacz((m) => { ob(m, 'A', 'a1').left = 50; }, (k) => { str(k, 'A').obiekty = str(k, 'A').obiekty.filter((o) => o.id !== 'a1'); ob(k, 'A', 'a2').left = 70; }),
      usunietyTamKonto: polacz((m) => { ob(m, 'A', 'a1').left = 50; }, (k) => { str(k, 'A').obiekty = str(k, 'A').obiekty.filter((o) => o.id !== 'a1'); ob(k, 'A', 'a2').left = 70; }, [['strony:A#a1', 'konto']]),
      usunietyTuKonto: polacz((m) => { str(m, 'A').obiekty = str(m, 'A').obiekty.filter((o) => o.id !== 'a1'); ob(m, 'A', 'a2').left = 51; }, (k) => { ob(k, 'A', 'a1').left = 70; }, [['strony:A#a1', 'konto']]),
      nazwaObie: polacz((m) => { str(m, 'A').nazwa = 'Moja'; ob(m, 'A', 'a1').left = 50; }, (k) => { str(k, 'A').nazwa = 'Tamta'; ob(k, 'A', 'a2').left = 70; }, [['strony:A.nazwa', 'konto']]),
      kolejnosc: polacz((m) => { ob(m, 'A', 'a1').left = 50; }, (k) => { const s = str(k, 'A'); s.obiekty = [s.obiekty[2], s.obiekty[0], s.obiekty[1], ...s.obiekty.slice(3)]; }),
      // Tekst w połączonych ramkach: ja skróciłem tekst (zmiana w r1 i r2), na koncie przesunięto r2 i r3.
      watek: polacz(
        (m) => { ob(m, 'A', 'r1').text = 'Pierwsza część. Druga '; ob(m, 'A', 'r2').text = 'część. '; ob(m, 'A', 'a1').left = 50; },
        (k) => { ob(k, 'A', 'r2').left = 99; ob(k, 'B', 'r3').left = 98; ob(k, 'B', 'b1').left = 70; },
      ),
      watekKonto: polacz(
        (m) => { ob(m, 'A', 'r1').text = 'Pierwsza część. Druga '; ob(m, 'A', 'r2').text = 'część. '; ob(m, 'A', 'a1').left = 50; },
        (k) => { ob(k, 'A', 'r2').left = 99; ob(k, 'B', 'r3').left = 98; ob(k, 'B', 'b1').left = 70; },
        [['watek:w1', 'konto']],
      ),
      // Ramki zmienione po różnych stronach, żadna w obu miejscach: bez pytania.
      watekOsobno: polacz((m) => { ob(m, 'A', 'r1').left = 33; }, (k) => { ob(k, 'B', 'r3').left = 98; ob(k, 'A', 'a2').left = 70; }),
      starszyZapis: polacz((m) => { ob(m, 'A', 'a1').left = 50; }, (k) => { ob(k, 'A', 'a2').left = 70; }, null, stara),
    };
  });

  assert.deepEqual(w.opisy, ['tekst „Ala ma kota”', 'obraz „zdjecie.jpg”', 'tabela', 'rysunek']);
  // Różne elementy tej samej strony i wzorca: wszystko przechodzi, bez pytania.
  assert.deepEqual(w.rozne.pytania, []);
  assert.deepEqual(w.rozne.A, ['a1@50', 'k-nowy@10', 'a2@70', 'r1@10:Pierwsza część tekstu. ', 'r2@10:Druga część. ', 'm-nowy@10'], 'mój przesunięty i dodany, z konta: przesunięty, dodany na swoim miejscu i usunięty');
  assert.deepEqual([w.rozne.nazwaA, w.rozne.tloA], ['A po mojemu', '#ffeecc'], 'nazwa strony z tego urządzenia, tło z konta');
  assert.deepEqual(w.rozne.W, ['w1@5', 'w2@9'], 'wzorzec łączy się tak samo');
  assert.deepEqual(w.rozne.zmienione, [['A'], ['W'], true]);
  assert.equal(w.rozne.zKonta, 2, 'z konta coś przyszło do strony A i do wzorca');
  // Ten sam element zmieniony inaczej: pytanie o niego, reszta strony łączy się sama.
  assert.deepEqual(w.tenSam.pytania, [['strony:A#a1', 'Strona „Strona A”: prostokąt', 'zmieniony tutaj', 'zmieniony na koncie']]);
  assert.deepEqual(w.tenSam.A.slice(0, 3), ['a1@50', 'a2@51', 'a3@71'], 'bez odpowiedzi sporny element zostaje mój');
  assert.deepEqual(w.tenSamKonto.A.slice(0, 3), ['a1@70', 'a2@51', 'a3@71']);
  // Usunięcie po jednej stronie, zmiana po drugiej.
  assert.deepEqual(w.usunietyTam.pytania, [['strony:A#a1', 'Strona „Strona A”: prostokąt', 'zmieniony tutaj', 'usunięty na koncie']]);
  assert.deepEqual(w.usunietyTam.A.slice(0, 2), ['a1@50', 'a2@70']);
  assert.deepEqual(w.usunietyTamKonto.A.slice(0, 2), ['a2@70', 'a3@10']);
  assert.deepEqual(w.usunietyTuKonto.A.slice(0, 2), ['a1@70', 'a2@51'], 'wybrana wersja z konta przywraca element usunięty tutaj');
  // Ustawienie strony zmienione w obu miejscach: osobne pytanie, elementy łączą się same.
  assert.deepEqual(w.nazwaObie.pytania, [['strony:A.nazwa', 'Strona „Moja”: nazwa', 'zmienione tutaj', 'zmienione na koncie']]);
  assert.deepEqual([w.nazwaObie.nazwaA, ...w.nazwaObie.A.slice(0, 2)], ['Tamta', 'a1@50', 'a2@70']);
  // Kolejność zmieniona na koncie, element zmieniony tutaj.
  assert.deepEqual([w.kolejnosc.pytania, w.kolejnosc.A.slice(0, 3)], [[], ['a3@10', 'a1@50', 'a2@10']]);
  // Tekst w połączonych ramkach: jedno pytanie o cały tekst; wybrana wersja obejmuje wszystkie ramki na obu stronach.
  assert.deepEqual(w.watek.pytania, [['watek:w1', 'Tekst w połączonych ramkach „Pierwsza część. Druga”', 'zmieniony tutaj', 'zmieniony na koncie']]);
  assert.deepEqual(w.watek.A, ['a1@50', 'a2@10', 'a3@10', 'r1@10:Pierwsza część. Druga ', 'r2@10:część. '], 'bez odpowiedzi cały tekst zostaje mój');
  assert.deepEqual(w.watek.B, ['b1@70', 'r3@10:Trzecia część.'], 'ramka z drugiej strony też zostaje moja, choć resztę tej strony zmieniło konto');
  assert.deepEqual(w.watekKonto.A, ['a1@50', 'a2@10', 'a3@10', 'r1@10:Pierwsza część tekstu. ', 'r2@99:Druga część. '], 'wersja z konta: cały tekst jak na koncie, mój prostokąt zostaje');
  assert.deepEqual(w.watekKonto.B, ['b1@70', 'r3@98:Trzecia część.']);
  assert.deepEqual([w.watekOsobno.pytania, w.watekOsobno.A[3], w.watekOsobno.B[1]], [[], 'r1@33:Pierwsza część tekstu. ', 'r3@98:Trzecia część.']);
  // Stan uzgodniony zapisany przed tą zmianą nie zna pojedynczych elementów: pytanie o całą stronę, jak dawniej.
  assert.deepEqual(w.starszyZapis.pytania, [['strony:A', 'Strona „Strona A”', 'zmieniona tutaj', 'zmieniona na koncie']]);
  assert.deepEqual(bledy, []);
});

test('dwa urządzenia na tej samej stronie: przesunięcie na jednym i pisanie na drugim łączą się bez pytania; ten sam element – pytanie', async (t) => {
  const a = await otworz(t, { tryb: 'atrapa' });
  await zaloguj(a.strona);
  await nowyProjekt(a.strona, 'Jedna strona');
  await a.strona.click('[data-akcja="dodaj-prostokat"]');
  await przesunProstokat(a.strona, 20);
  await a.strona.click('[data-akcja="dodaj-tekst"]');
  await a.strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ text: 'Tytuł', top: 150 }); e.aktywny.setCoords(); e.zatwierdz(); e.odznacz(); });
  await zapisano(a.strona);
  const b = await drugieUrzadzenie(a);
  await zaloguj(b.strona);
  await otworzZListy(b.strona, 'Jedna strona');
  await b.strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().filter((x) => !x.zWzorca).length === 2);
  await zapisano(b.strona);

  // B pisze w tekście (zostaje w trybie pisania), A w tym czasie przesuwa prostokąt.
  await b.strona.evaluate(() => { const e = window.seriodruk.edytor; const tb = e.canvas.getObjects().find((x) => x.type === 'textbox' && !x.zWzorca); e.piszWRamce(tb.id, tb.text.length); });
  await b.strona.keyboard.type(' roku', { delay: 40 });
  await przesunProstokat(a.strona, 64);
  // Na B: prostokąt z A dochodzi, tekst zostaje, pisanie trwa dalej z kursorem na końcu – bez pytania.
  await prostokatNa(b.strona, 64);
  const naB = await b.strona.evaluate(() => { const e = window.seriodruk.edytor; const tb = e.canvas.getObjects().find((x) => x.type === 'textbox' && !x.zWzorca); return [tb.text, tb.isEditing, tb.selectionStart, e.aktywny === tb]; });
  assert.deepEqual(naB, ['Tytuł roku', true, 10, true], 'po wczytaniu zmiany pisanie trwa w tym samym miejscu');
  await b.strona.keyboard.type('!', { delay: 40 });
  // Na A: tekst z B dochodzi, prostokąt zostaje.
  // B nie wyszedł z ramki – tekst w trakcie pisania jest zapisywany po krótkiej przerwie.
  await a.strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().find((x) => x.type === 'textbox' && !x.zWzorca)?.text === 'Tytuł roku!', null, { timeout: 10000 });
  assert.equal(await prostokat(a.strona), 64);
  assert.equal(await a.strona.locator('#dlg-konflikt[open]').count() + await b.strona.locator('#dlg-konflikt[open]').count(), 0);
  await b.strona.keyboard.press('Escape');
  await zapisano(a.strona);
  await zapisano(b.strona);

  // Ten sam prostokąt przesunięty na obu urządzeniach, zanim którekolwiek dowiedziało się o drugim: pytanie o ten element.
  a.baza.kanaly.wylaczone = true; // nowe połączenia odrzucane…
  await a.kontekst.setOffline(true); // …a A na chwilę traci sieć
  await przesunProstokat(a.strona, 71);
  await przesunProstokat(b.strona, 82);
  await zapisano(b.strona);
  await a.kontekst.setOffline(false);
  await a.strona.waitForSelector('#dlg-konflikt[open]', { timeout: 15000 });
  const pytania = await a.strona.$$eval('#konflikt-lista li', (l) => l.map((li) => li.querySelector('strong').textContent));
  assert.equal(pytania.length, 1);
  assert.match(pytania[0], /^Strona „.*”: prostokąt$/);
  await a.strona.click('#konflikt-zastosuj'); // zostaje wersja z A
  await zapisano(a.strona);
  assert.equal(await prostokat(a.strona), 71);
  assert.equal([...a.baza.strony.values()][0].obiekty.find((o) => o.type.toLowerCase() === 'rect').left, 71);
  assert.deepEqual([a.bledy, b.bledy], [[], []]);
});

// ---------- Cofanie po połączeniu ----------

test('„Cofnij” po dołączeniu zmian z innego urządzenia cofa tylko własne kroki – zmiany z konta zostają', async (t) => {
  const a = await otworz(t, { tryb: 'atrapa' });
  await zaloguj(a.strona);
  await nowyProjekt(a.strona, 'Cofanie');
  await a.strona.click('[data-akcja="dodaj-prostokat"]');
  await przesunProstokat(a.strona, 20);
  await a.strona.click('[data-akcja="dodaj-elipse"]');
  await zapisano(a.strona);
  const b = await drugieUrzadzenie(a);
  await zaloguj(b.strona);
  await otworzZListy(b.strona, 'Cofanie');
  await b.strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().filter((x) => !x.zWzorca).length === 2);
  await zapisano(b.strona);

  const stanA = () => a.strona.evaluate(() => {
    const s = window.seriodruk.stan.projekt.strony;
    const ob = s[0].obiekty;
    return { rect: ob.find((o) => o.type.toLowerCase() === 'rect')?.left, elipsa: ob.find((o) => o.type.toLowerCase() === 'ellipse')?.left, stron: s.length };
  });
  // A: dwa własne kroki – przesunięcie prostokąta, potem nowa strona.
  await przesunProstokat(a.strona, 35);
  await a.strona.waitForTimeout(500);
  await a.strona.click('[data-akcja="strona-dodaj"]');
  await a.strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await zapisano(a.strona);
  // B dostaje obie zmiany i przesuwa elipsę.
  await b.strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2, null, { timeout: 8000 });
  await b.strona.evaluate(() => window.seriodruk.przejdzDoStrony(0));
  await b.strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((x) => x.type === 'ellipse'));
  await b.strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const o = e.canvas.getObjects().find((x) => x.type === 'ellipse');
    o.set({ left: 90 }); o.setCoords(); e.zatwierdz();
  });
  await zapisano(b.strona);
  await a.strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.type.toLowerCase() === 'ellipse')?.left === 90, null, { timeout: 10000 });
  assert.deepEqual(await stanA(), { rect: 35, elipsa: 90, stron: 2 });

  // Cofnij: znika nowa strona z A; elipsa przesunięta na B zostaje.
  await a.strona.click('[data-akcja="cofnij"]');
  await a.strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 1);
  assert.deepEqual(await stanA(), { rect: 35, elipsa: 90, stron: 1 });
  // Jeszcze raz: wraca dawne położenie prostokąta, elipsa dalej tam, gdzie ją ustawiono na B.
  await a.strona.click('[data-akcja="cofnij"]');
  await a.strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.type.toLowerCase() === 'rect')?.left === 20);
  assert.deepEqual(await stanA(), { rect: 20, elipsa: 90, stron: 1 });
  // Ponów dwa razy: z powrotem stan po połączeniu.
  await a.strona.click('[data-akcja="ponow"]');
  await a.strona.click('[data-akcja="ponow"]');
  await a.strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  assert.deepEqual(await stanA(), { rect: 35, elipsa: 90, stron: 2 });
  // Cofnięcia idą na konto jak zwykłe zmiany i docierają do B.
  await a.strona.click('[data-akcja="cofnij"]');
  await b.strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 1, null, { timeout: 10000 });
  assert.equal(await b.strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.type.toLowerCase() === 'ellipse').left), 90);
  assert.equal(await a.strona.locator('#dlg-konflikt[open]').count() + await b.strona.locator('#dlg-konflikt[open]').count(), 0);
  assert.deepEqual([a.bledy, b.bledy], [[], []]);
});
