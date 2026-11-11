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
const prostokatNa = (strona, lewo) => strona.waitForFunction((l) => window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'rect' && !x.zWzorca)?.left === l, lewo, { timeout: 8000 });
const otworzZListy = async (strona, nazwa) => {
  await strona.waitForFunction((n) => [...document.querySelectorAll('#siatka-projektow .karta-projektu strong')].some((e) => e.textContent === n), nazwa, { timeout: 10000 });
  await strona.click(`.karta-projektu:has(strong:text-is("${nazwa}")) .otworz-projekt`);
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk && document.body.dataset.ekran === 'edytor');
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
  await b.strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((x) => x.type === 'rect' && !x.zWzorca));
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
  await b.strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((x) => x.type === 'rect' && !x.zWzorca));
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
  await b.strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((x) => x.type === 'rect' && !x.zWzorca));
  await przesunProstokat(a.strona, 61);
  await zapisano(a.strona);
  await b.strona.waitForTimeout(1200);
  assert.equal(await prostokat(b.strona), 20, 'bez kanału drugie urządzenie jeszcze nie wie');
  assert.equal(a.baza.kanaly.wyslane, 0);
  await b.strona.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // powrót do karty
  await prostokatNa(b.strona, 61);
  assert.deepEqual([a.bledy, b.bledy], [[], []]);
});
