// Nic nie ginie (#138): zmiany od AI (łącznik), z innego urządzenia i z innej karty nie mogą zniknąć ani zostać
// cicho cofnięte przez aplikację – karta w tle przez „pół dnia”, uśpiony telefon (karta ukryta, bez sieci),
// dwa urządzenia naraz, projekt z elementami liczonymi samymi (okładka, spis treści, kod QR, kalendarz),
// cofanie po dołączeniu zmian z konta. Każdy scenariusz kończy się sprawdzeniem: zmiany AI są na koncie i na ekranie.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, oknoAi, drugieUrzadzenie, zaloguj, zamknijAi } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 20000 });

async function kluczAi(strona) {
  await oknoAi(strona);
  await strona.click('[data-akcja="dostep-ai-utworz"]');
  await strona.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  const klucz = await strona.inputValue('#dostep-ai-klucz');
  await zamknijAi(strona);
  return klucz;
}

// Projekt: 3 strony, na każdej prostokąt (id r1, r2, r3), na pierwszej tekst (t1).
async function projektTrzyStrony(strona) {
  await nowyProjekt(strona, 'Nic nie ginie');
  for (let i = 0; i < 2; i += 1) await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 3);
  // Model zmieniany wprost razem z odłączeniem płótna, w jednym kroku: inaczej zaplanowany zapis (po „Dodaj
  // stronę”) przepisałby płótno bieżącej strony – bez nowego prostokąta – z powrotem do projektu (#160).
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony.forEach((s, i) => {
      s.obiekty.push({ type: 'Rect', id: `r${i + 1}`, left: 20, top: 20 + i * 10, width: 30, height: 20, fill: '#336699' });
    });
    p.strony[0].obiekty.push({ type: 'Textbox', id: 't1', left: 20, top: 80, width: 100, text: 'Tekst użytkownika', fontFamily: 'Inter', fontSize: 5 });
    window.seriodruk.stan.tryb = 'strona';
    window.seriodruk.stan.indeks = 0; // pierwsza strona (z tekstem) na płótnie
    await window.seriodruk.przeladuj();
    window.seriodruk.edytor.zatwierdz();
  });
  await strona.waitForFunction(() => ['r1', 'r2', 'r3', 't1'].every((id) => window.seriodruk.stan.projekt.strony.some((s) => s.obiekty.some((o) => o.id === id))));
  await zapisano(strona);
}

// Zmiana od AI tak, jak robi ją łącznik: pobierz – zmień – zapisz z numerem wersji (przy konflikcie jeszcze raz).
function zmianaAi(baza, klucz, zmien) {
  for (let proba = 0; proba < 3; proba += 1) {
    const { projekt, wersja } = baza.ai('ai_projekt', { p_klucz: klucz });
    const strony = zmien(projekt);
    const w = baza.ai('ai_zapisz', { p_klucz: klucz, p_znana_wersja: wersja, p_zmiany: { strony } });
    if (!w.konflikt) { assert.ok(!w.blad, JSON.stringify(w)); return w; }
  }
  throw new Error('AI nie zdołało zapisać');
}
const naKoncie = (baza, klucz) => baza.ai('ai_projekt', { p_klucz: klucz }).projekt;
const element = (p, id) => p.strony.flatMap((s) => s.obiekty).find((o) => o.id === id);
const ustawElement = (id, pola) => (p) => p.strony.filter((s) => s.obiekty.some((o) => o.id === id))
  .map((s) => ({ ...s, obiekty: s.obiekty.map((o) => (o.id === id ? { ...o, ...pola } : o)) }));
const naPlotnie = (strona, id) => strona.evaluate((x) => {
  const o = window.seriodruk.edytor.canvas.getObjects().find((k) => k.id === x);
  return o ? { fill: o.fill, left: Math.round(o.left * 100) / 100, text: o.text } : null;
}, id);
const wProjekcie = (strona, id) => strona.evaluate((x) => window.seriodruk.stan.projekt.strony.flatMap((s) => s.obiekty).find((o) => o.id === x) || null, id);

async function ukryj(strona) {
  await strona.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
async function pokaz(strona) {
  await strona.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
}

test('karta w tle przez „pół dnia” bez kanału na żywo: dziesiątki zmian AI zostają po powrocie, także po drobnej zmianie użytkownika', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { bezKanalu: true });
  await projektTrzyStrony(strona);
  const klucz = await kluczAi(strona);
  await ukryj(strona);
  // AI: 25 zmian – ten sam prostokąt wiele razy, inne strony, tekst na stronie otwartej w edytorze.
  for (let i = 0; i < 25; i += 1) {
    zmianaAi(baza, klucz, ustawElement('r1', { fill: `#a0${String(10 + i).padStart(2, '0')}00` }));
    if (i % 5 === 0) zmianaAi(baza, klucz, ustawElement('r2', { left: 40 + i }));
  }
  zmianaAi(baza, klucz, ustawElement('t1', { text: 'Tekst od AI' }));
  zmianaAi(baza, klucz, ustawElement('r3', { fill: '#00aa00' }));
  const koncowe = naKoncie(baza, klucz);
  await pokaz(strona);
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((k) => k.id === 't1')?.text === 'Tekst od AI', null, { timeout: 20000 });
  assert.equal((await naPlotnie(strona, 'r1')).fill, element(koncowe, 'r1').fill, 'ostatnia zmiana AI na ekranie');
  assert.equal(await strona.locator('#dlg-konflikt[open], #dlg-potwierdz[open]').count(), 0, 'bez pytań – użytkownik niczego nie zmieniał');
  // Użytkownik nic nie robi – po chwili konto dalej ma wszystko od AI.
  await strona.waitForTimeout(2500);
  let p = naKoncie(baza, klucz);
  for (const id of ['r1', 'r2', 'r3', 't1']) assert.deepEqual(element(p, id), element(koncowe, id), `${id} na koncie bez zmian`);
  // Drobna zmiana użytkownika: przesuwa prostokąt z pierwszej strony.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((k) => k.id === 'r1'); o.set({ left: 55 }); o.setCoords(); e.zatwierdz(); });
  await zapisano(strona);
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.wersja_chmury > 0);
  await strona.waitForTimeout(1500);
  p = naKoncie(baza, klucz);
  assert.equal(element(p, 'r1').left, 55, 'zmiana użytkownika na koncie');
  assert.equal(element(p, 'r1').fill, element(koncowe, 'r1').fill, 'kolor od AI został');
  assert.equal(element(p, 't1').text, 'Tekst od AI');
  assert.equal(element(p, 'r2').left, element(koncowe, 'r2').left);
  assert.equal(element(p, 'r3').fill, '#00aa00');
  assert.deepEqual(bledy, []);
});

test('uśpiony telefon bez sieci: zmiana użytkownika offline i zmiany AI w tym czasie – po powrocie sieci obie zostają', async (t) => {
  const { strona, baza, bledy, kontekst } = await otworz(t, { bezKanalu: true });
  await projektTrzyStrony(strona);
  const klucz = await kluczAi(strona);
  await kontekst.setOffline(true);
  await strona.evaluate(() => window.dispatchEvent(new Event('offline')));
  // Użytkownik offline przesuwa tekst (zostaje na urządzeniu), karta usypia.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((k) => k.id === 't1'); o.set({ left: 33 }); o.setCoords(); e.zatwierdz(); });
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await ukryj(strona);
  for (let i = 0; i < 10; i += 1) zmianaAi(baza, klucz, ustawElement('r1', { fill: `#0000${String(10 + i * 5).padStart(2, '0')}` }));
  zmianaAi(baza, klucz, ustawElement('r2', { fill: '#ff8800' }));
  const koncowe = naKoncie(baza, klucz);
  await kontekst.setOffline(false);
  await pokaz(strona);
  await strona.evaluate(() => window.dispatchEvent(new Event('online')));
  await strona.waitForFunction((f) => window.seriodruk.edytor.canvas.getObjects().find((k) => k.id === 'r1')?.fill === f, element(koncowe, 'r1').fill, { timeout: 20000 });
  await zapisano(strona);
  await strona.waitForTimeout(1500);
  const p = naKoncie(baza, klucz);
  assert.equal(element(p, 'r1').fill, element(koncowe, 'r1').fill, 'kolor od AI na koncie');
  assert.equal(element(p, 'r2').fill, '#ff8800');
  assert.equal(element(p, 't1').left, 33, 'zmiana użytkownika z czasu bez sieci też');
  assert.equal(await strona.locator('#dlg-konflikt[open], #dlg-potwierdz[open]').count(), 0, 'różne elementy – bez pytania');
  assert.deepEqual(bledy, []);
});

test('dwa urządzenia z otwartym projektem i AI naraz: nikt nikomu nie nadpisuje', async (t) => {
  const a = await otworz(t);
  await projektTrzyStrony(a.strona);
  const klucz = await kluczAi(a.strona);
  const b = await drugieUrzadzenie(a);
  await zaloguj(b.strona, a.baza);
  await b.strona.click('.karta-projektu .otworz-projekt');
  await b.strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((k) => k.id === 'r1'), null, { timeout: 20000 });
  // A przesuwa r1, B zmienia tekst, AI zmienia kolory r2 i r3 – kilka razy na zmianę.
  for (let i = 0; i < 3; i += 1) {
    await a.strona.evaluate((x) => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((k) => k.id === 'r1'); o.set({ left: 60 + x }); o.setCoords(); e.zatwierdz(); }, i);
    await b.strona.evaluate((x) => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((k) => k.id === 't1'); o.set({ text: `Tekst z B ${x}` }); o.setCoords(); e.zatwierdz(); }, i);
    zmianaAi(a.baza, klucz, ustawElement('r2', { fill: `#12${i}456` }));
    zmianaAi(a.baza, klucz, ustawElement('r3', { fill: `#65${i}321` }));
    await a.strona.waitForTimeout(700);
  }
  await zapisano(a.strona);
  await zapisano(b.strona);
  const oczekiwane = { r1: 62, t1: 'Tekst z B 2', r2: '#122456', r3: '#652321' };
  const zgodne = async (s) => s.waitForFunction((o) => {
    const ob = Object.fromEntries(window.seriodruk.stan.projekt.strony.flatMap((x) => x.obiekty).map((k) => [k.id, k]));
    return ob.r1?.left === o.r1 && ob.t1?.text === o.t1 && ob.r2?.fill === o.r2 && ob.r3?.fill === o.r3;
  }, oczekiwane, { timeout: 25000 });
  await zgodne(a.strona);
  await zgodne(b.strona);
  const p = naKoncie(a.baza, klucz);
  assert.equal(element(p, 'r1').left, 62);
  assert.equal(element(p, 't1').text, 'Tekst z B 2');
  assert.equal(element(p, 'r2').fill, '#122456');
  assert.equal(element(p, 'r3').fill, '#652321');
  assert.deepEqual([a.bledy, b.bledy], [[], []]);
});

test('elementy liczone same (okładka, spis treści, kod QR, kalendarz): otwarcie bez zmian nic nie wysyła, zmiana AI zostaje bez pytania', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await projektTrzyStrony(strona);
  await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    e.dodajKod('qr', { tresc: 'https://makietka.app' });
    e.dodajKalendarz({ rok: 2027, miesiac: 3 });
    e.dodajElementKsiazki?.('spis');
    e.zatwierdz();
  });
  await zapisano(strona);
  // Druga sekcja jako okładka (liczona sama z liczby stron).
  await strona.evaluate(async () => {
    const s = await import('./js/app/sekcje.js');
    const { nowaSekcja, nowaStrona } = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    const ok = nowaSekcja('Okładka', { ...p.sekcje[0].wydruk });
    p.sekcje.unshift(ok);
    const st = nowaStrona('Okładka', ok.id);
    st.obiekty.push({ type: 'Textbox', id: 'tytul', left: 10, top: 10, width: 60, text: 'Tytuł okładki', fontFamily: 'Inter', fontSize: 6 });
    p.strony.unshift(st);
    s.zamienNaOkladke(ok.id);
  });
  await strona.waitForTimeout(800);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await zapisano(strona);
  const klucz = await kluczAi(strona);
  // Przeładowanie (jak powrót następnego dnia): samo otwarcie nie wysyła niczego na konto.
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas?.getObjects().length > 0, null, { timeout: 20000 });
  await strona.waitForTimeout(1500);
  const przed = baza.zapisy.length;
  const wersjaPrzed = naKoncie(baza, klucz);
  await strona.waitForTimeout(4000);
  assert.equal(baza.zapisy.length, przed, `otwarcie i bezczynność nie wysyłają zapisu: ${JSON.stringify(baza.zapisy.slice(przed))}`);
  // AI zmienia tytuł okładki i prostokąt; aplikacja dołącza bez pytania i niczego nie cofa.
  zmianaAi(baza, klucz, ustawElement('tytul', { text: 'Tytuł od AI' }));
  zmianaAi(baza, klucz, ustawElement('r2', { fill: '#abcdef' }));
  await strona.evaluate(() => window.seriodruk.sprawdzKonto?.());
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.flatMap((s) => s.obiekty).find((o) => o.id === 'tytul')?.text === 'Tytuł od AI', null, { timeout: 20000 });
  await strona.waitForTimeout(3000);
  assert.equal(await strona.locator('#dlg-konflikt[open], #dlg-potwierdz[open]').count(), 0);
  const p = naKoncie(baza, klucz);
  assert.equal(element(p, 'tytul').text, 'Tytuł od AI');
  assert.equal(element(p, 'r2').fill, '#abcdef');
  assert.ok(wersjaPrzed);
  assert.deepEqual(bledy, []);
});

test('cofanie po dołączeniu zmian AI cofa tylko własne kroki – zmiany AI zostają na ekranie i na koncie', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await projektTrzyStrony(strona);
  const klucz = await kluczAi(strona);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((k) => k.id === 'r1'); o.set({ left: 70 }); o.setCoords(); e.zatwierdz(); });
  await zapisano(strona);
  zmianaAi(baza, klucz, ustawElement('t1', { text: 'Od AI przed cofnięciem' }));
  zmianaAi(baza, klucz, ustawElement('r3', { fill: '#111111' }));
  await strona.evaluate(() => window.seriodruk.sprawdzKonto?.());
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((k) => k.id === 't1')?.text === 'Od AI przed cofnięciem', null, { timeout: 20000 });
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((k) => k.id === 'r1')?.left !== 70);
  await zapisano(strona);
  await strona.waitForTimeout(1500);
  assert.equal((await naPlotnie(strona, 't1')).text, 'Od AI przed cofnięciem');
  const p = naKoncie(baza, klucz);
  assert.equal(element(p, 't1').text, 'Od AI przed cofnięciem');
  assert.equal(element(p, 'r3').fill, '#111111');
  assert.notEqual(element(p, 'r1').left, 70, 'własny krok cofnięty');
  assert.ok(await wProjekcie(strona, 'r3'));
  assert.deepEqual(bledy, []);
});

test('wyjście do listy w trakcie zapisu i ponowne otwarcie: zmiany AI z tego czasu zostają', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { bezKanalu: true });
  await projektTrzyStrony(strona);
  const klucz = await kluczAi(strona);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((k) => k.id === 'r1'); o.set({ left: 44 }); o.setCoords(); e.zatwierdz(); });
  // AI zapisuje, zanim zmiana użytkownika poszła na konto; użytkownik od razu wychodzi do listy (#109 – wysyłka przy wyjściu).
  zmianaAi(baza, klucz, ustawElement('r3', { fill: '#fedcba' }));
  await strona.click('.pasek-edytora [data-akcja="do-projektow"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  zmianaAi(baza, klucz, ustawElement('t1', { text: 'AI w czasie wyjścia' }));
  await strona.waitForTimeout(2500);
  await strona.click('.karta-projektu .otworz-projekt');
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().find((k) => k.id === 't1')?.text === 'AI w czasie wyjścia', null, { timeout: 20000 });
  await zapisano(strona);
  await strona.waitForTimeout(1500);
  const p = naKoncie(baza, klucz);
  assert.equal(element(p, 'r3').fill, '#fedcba');
  assert.equal(element(p, 't1').text, 'AI w czasie wyjścia');
  assert.equal(element(p, 'r1').left, 44, 'zmiana użytkownika sprzed wyjścia też');
  assert.deepEqual(bledy, []);
});

test('przeliczenie bez udziału użytkownika (np. okładka, kod) a zmiana AI tego samego elementu: wygrywa AI bez pytania; ręczna zmiana – pytanie', async (t) => {
  const { strona, baza, bledy, kontekst } = await otworz(t, { bezKanalu: true });
  await projektTrzyStrony(strona);
  const klucz = await kluczAi(strona);
  await kontekst.setOffline(true);
  await strona.evaluate(() => window.dispatchEvent(new Event('offline')));
  // „Przeliczenie”: element na stronie poza płótnem zmienia się w danych projektu, nie ręką użytkownika.
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const o = p.strony[1].obiekty.find((x) => x.id === 'r2');
    o.left += 7;
    const z = await import('./js/app/zapis.js');
    z.zaplanujZapis();
    await window.seriodruk.zapiszTeraz();
  });
  zmianaAi(baza, klucz, ustawElement('r2', { fill: '#c0ffee' }));
  await kontekst.setOffline(false);
  await strona.evaluate(() => window.dispatchEvent(new Event('online')));
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[1].obiekty.find((o) => o.id === 'r2')?.fill === '#c0ffee', null, { timeout: 20000 });
  assert.equal(await strona.locator('#dlg-konflikt[open]').count(), 0, 'bez pytania o element, którego użytkownik nie ruszał');
  await zapisano(strona);
  assert.equal(element(naKoncie(baza, klucz), 'r2').fill, '#c0ffee', 'zmiana AI na koncie');

  // Ręczna zmiana tego samego elementu co AI – pytanie zostaje (domyślnie wersja z konta).
  await kontekst.setOffline(true);
  await strona.evaluate(() => window.dispatchEvent(new Event('offline')));
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((k) => k.id === 'r1'); o.set({ left: 66 }); o.setCoords(); e.zatwierdz(); });
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  zmianaAi(baza, klucz, ustawElement('r1', { fill: '#bada55' }));
  await kontekst.setOffline(false);
  await strona.evaluate(() => window.dispatchEvent(new Event('online')));
  await strona.waitForSelector('#dlg-konflikt[open]', { timeout: 20000 });
  assert.equal(await strona.isChecked('#konflikt-lista li input[value="konto"]'), true);
  await strona.click('#konflikt-zastosuj');
  await zapisano(strona);
  assert.equal(element(naKoncie(baza, klucz), 'r1').fill, '#bada55');
  assert.deepEqual(bledy, []);
});

test('otwarta karta nie odpowiada zapisem na każdą zmianę AI – AI nie dostaje odmów „projekt zmienił się w międzyczasie”', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await projektTrzyStrony(strona);
  await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    e.dodajKod('qr', { tresc: 'https://makietka.app' });
    e.dodajKalendarz({ rok: 2027, miesiac: 3 });
    e.dodajElementKsiazki?.('spis');
    e.zatwierdz();
  });
  await zapisano(strona);
  const klucz = await kluczAi(strona);
  await strona.waitForTimeout(1500);
  const przed = baza.zapisy.length;
  let odmowy = 0;
  for (let i = 0; i < 12; i += 1) {
    const { projekt, wersja } = baza.ai('ai_projekt', { p_klucz: klucz });
    await strona.waitForTimeout(400); // AI „myśli” między odczytem a zapisem – w tym czasie karta mogłaby coś wysłać
    const w = baza.ai('ai_zapisz', { p_klucz: klucz, p_znana_wersja: wersja, p_zmiany: { strony: ustawElement(i % 2 ? 'r2' : 'r3', { fill: `#3${i % 10}3${i % 10}3${i % 10}` })(projekt) } });
    if (w.konflikt) odmowy += 1;
    await strona.waitForTimeout(600);
  }
  await strona.waitForTimeout(3000);
  assert.equal(odmowy, 0, `AI dostało ${odmowy} odmów, bo karta w tym czasie zapisywała: ${JSON.stringify(baza.zapisy.slice(przed))}`);
  assert.equal(baza.zapisy.length, przed, 'karta bez zmian użytkownika nic nie wysyła');
  assert.deepEqual(bledy, []);
});
