const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { otworz } = require('./pomoc.cjs');

// Opis formatu dla AI (ai/format-makietka.md) musi być prawdziwy: przykłady z ai/przyklady/ wczytują się
// w aplikacji dokładnie tak, jak wczytuje je użytkownik (Importuj na liście projektów), a archiwum .makietka
// zbudowane według opisu w dokumencie też się wczytuje.

const PRZYKLADY = path.join(__dirname, '..', 'ai', 'przyklady');

async function importuj(strona, plik) {
  await strona.waitForSelector('#pusto-projekty', { state: 'visible' });
  await strona.setInputFiles('#plik-projekt', plik);
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.canvas);
  // Strona wczytuje się chwilę po otwarciu projektu (najpierw pobierają się jej czcionki).
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length > 0);
}

// Rozwinięcie, uwagi przed drukiem i złożone strony wskazane numerami (od 1).
const opisz = (strona, numery) => strona.evaluate(async (nr) => {
  const p = window.seriodruk.stan.projekt;
  const { rozwin } = await import('./js/serie.js');
  const { sprawdzProjekt } = await import('./js/kontrola.js');
  const { zlozCel } = await import('./js/zlozenie.js');
  const { dataUrlZasobu } = await import('./js/zasoby.js');
  const ciag = rozwin(p);
  const strony = {};
  for (const n of nr) {
    const { obiekty } = await zlozCel(p, ciag.egzemplarze[n - 1], { ciag });
    strony[n] = obiekty.map((o) => ({ typ: o.type, tekst: o.text, widoczny: o.visible !== false, lewo: Math.round(o.left * 10) / 10, gora: Math.round(o.top * 10) / 10, szer: Math.round(o.width * o.scaleX * 10) / 10, wys: Math.round(o.height * o.scaleY * 10) / 10, dzieci: (o._objects || []).length, obraz: o.type === 'image' ? o.getElement()?.naturalWidth : undefined }));
  }
  const zasoby = await Promise.all(Object.keys(p.zasoby).map(async (id) => [p.zasoby[id].nazwa, (await dataUrlZasobu(p, id))?.slice(0, 22)]));
  return {
    nazwa: p.nazwa, stronWProjekcie: p.strony.length, stronWDruku: ciag.egzemplarze.length,
    numery: ciag.egzemplarze.map((e) => e.nr),
    uwagi: sprawdzProjekt(p, ciag), ostrzezenia: window.seriodruk.edytor.ostrzezenia, strony, zasoby,
  };
}, numery);

test('format dla AI: przykład minimalny wczytuje się jak plik użytkownika – jedna strona, bez uwag', async (t) => {
  const { strona, bledy } = await otworz(t);
  await importuj(strona, path.join(PRZYKLADY, 'minimalny.json'));
  const w = await opisz(strona, [1]);
  assert.equal(w.nazwa, 'Przykład minimalny');
  assert.equal(w.stronWDruku, 1);
  assert.deepEqual(w.uwagi, []);
  assert.deepEqual(w.ostrzezenia, []);
  assert.deepEqual(w.strony[1].map((o) => [o.typ, o.tekst, o.lewo, o.gora]), [
    ['rect', undefined, 12, 12], ['textbox', 'Witaj w Makietce', 18, 22], ['textbox', 'Ten projekt powstał z pliku JSON napisanego ręcznie.', 12, 62],
  ]);
  assert.deepEqual(bledy, []);
});

test('format dla AI: przykład kalendarza – seria 365 dni z wierszami [pomiń], dane, zdjęcie z danych, wzorzec z numerem, tabela', async (t) => {
  const { strona, bledy } = await otworz(t);
  await importuj(strona, path.join(PRZYKLADY, 'kalendarz.json'));
  // Okładka, 365 dni (cztery wiersze [pomiń] nie dają stron) i strona z tabelą celów.
  const w = await opisz(strona, [1, 2, 4, 367 - 1, 367]);
  assert.equal(w.stronWProjekcie, 9);
  assert.equal(w.stronWDruku, 367);
  assert.deepEqual(w.uwagi, [], 'Sprawdź przed drukiem nie ma uwag');
  assert.deepEqual(w.ostrzezenia, []);
  const teksty = (n) => w.strony[n].filter((o) => o.tekst !== undefined).map((o) => o.tekst);
  // Okładka bez numeru (numeracja „brak”) i bez stopki ze wzorca, kalendarz numerowany od 1.
  assert.deepEqual(w.numery.slice(0, 3), [null, 1, 2]);
  assert.deepEqual(teksty(1), ['Kalendarz 2027']);
  // Strona 2 to 1 stycznia (piątek) – piąta strona bloku-tygodnia, bo przed nią są cztery wiersze pomijane.
  // Pierwszy tekst to stopka „{nr}” ze wzorca sekcji.
  assert.deepEqual(teksty(2), ['1', '1 styczeń 2027', 'piątek · Nowy początek']);
  assert.deepEqual(teksty(366), ['365', '31 grudzień 2027', 'piątek · Święta']);
  // Gwiazdka tylko w niedziele: 3 stycznia (strona 4) jest niedzielą.
  const gwiazdka = (n) => w.strony[n].find((o) => o.typ === 'ellipse').widoczny;
  assert.deepEqual([gwiazdka(2), gwiazdka(4)], [false, true]);
  // Zdjęcie z danych wypełnia ramkę wzoru (12 × 30 mm, 124 × 70 mm).
  const foto = w.strony[2].find((o) => o.typ === 'image');
  assert.deepEqual([foto.lewo, foto.gora, foto.szer, foto.wys, foto.obraz > 0], [12, 30, 124, 70, true]);
  // Tabela celów: jeden element w zadanym miejscu, 3 × 4 komórki z liniami i tłem nagłówka.
  const tabela = w.strony[367].find((o) => o.typ === 'group');
  assert.deepEqual([tabela.lewo, tabela.gora, tabela.szer, tabela.wys], [12, 40, 124, 36]);
  assert.ok(tabela.dzieci > 12, `komórki, linie i tło (${tabela.dzieci})`);
  // Obrazy przeszły do projektu z nazwami z pliku.
  assert.equal(w.zasoby.length, 13);
  assert.ok(w.zasoby.every(([nazwa, dane]) => /\.png$/.test(nazwa) && dane === 'data:image/png;base64,'));
  // Strona dnia otwiera się w edytorze z polami jak we wzorze.
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(1));
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.text === '{dzien} {miesiac} 2027'));
  assert.deepEqual(bledy, []);
});

test('format dla AI: archiwum .makietka zbudowane według opisu (mimetype, manifest.json, projekt.json, zasoby/) wczytuje się', async (t) => {
  const { strona, bledy } = await otworz(t);
  const json = fs.readFileSync(path.join(PRZYKLADY, 'kalendarz.json'), 'utf8');
  // Budowa archiwum dokładnie tak, jak mówi ai/format-makietka.md (JSZip w przeglądarce testowej).
  const base64 = await strona.evaluate(async (tekst) => {
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip', 'ZIP');
    const projekt = JSON.parse(tekst);
    const zip = new JSZip();
    zip.file('mimetype', 'application/vnd.seriodruk+zip', { compression: 'STORE' });
    const zasoby = {};
    const lista = [];
    for (const [id, z] of Object.entries(projekt.zasoby)) {
      const [, typ, dane] = /^data:([^;]+);base64,(.*)$/.exec(z.dataUrl);
      const plik = `zasoby/${id}.${{ 'image/png': 'png', 'image/jpeg': 'jpg' }[typ]}`;
      zip.file(plik, dane, { base64: true });
      zasoby[id] = { nazwa: z.nazwa, plik };
      lista.push({ id, plik, typ, nazwa: z.nazwa });
    }
    zip.file('manifest.json', JSON.stringify({ format: 'seriodruk', wersja_formatu: 1, aplikacja: 'Makietka', pliki: { projekt: 'projekt.json', miniatura: null }, zasoby: lista }));
    zip.file('projekt.json', JSON.stringify({ ...projekt, zasoby }));
    return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  }, json);
  const plik = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'seriodruk-ai-')), 'Kalendarz.seriodruk');
  fs.writeFileSync(plik, Buffer.from(base64, 'base64'));
  // Archiwum: „mimetype” jest pierwszym plikiem i nie jest skompresowane (nazwa i treść czytelne od 30. bajtu).
  const bajty = fs.readFileSync(plik);
  assert.equal(bajty.subarray(30, 38).toString(), 'mimetype');
  assert.equal(bajty.subarray(38, 67).toString(), 'application/vnd.seriodruk+zip');
  await importuj(strona, plik);
  const w = await opisz(strona, [2]);
  assert.equal(w.stronWDruku, 367);
  assert.deepEqual(w.uwagi, []);
  assert.equal(w.zasoby.length, 13);
  assert.ok(w.zasoby.every(([, dane]) => dane === 'data:image/png;base64,'));
  assert.ok(w.strony[2].find((o) => o.typ === 'image').obraz > 0);
  assert.deepEqual(bledy, []);
});
