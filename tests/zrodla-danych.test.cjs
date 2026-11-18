// Źródło danych przypięte do tabeli (#227): plik zapisany w projekcie (nie wśród obrazów), opis na pasku,
// znacznik „zmienione w Makietce”, nowa wersja z porównaniem (kolumny używane w polach), odświeżenie z tego samego
// pliku (zapamiętany dostęp), dane z linku i odświeżenie z linku, pobranie Excela i oryginału, odpięcie.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const plik = (tekst, name = 'osoby.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(tekst, 'utf8') });

test('źródło danych: plik w projekcie, nowa wersja z porównaniem, odświeżenie z pliku i z linku, odpięcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Goście');
  // Strona serii z polem {imie} – kolumna używana w polach.
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony[0].obiekty.push({ type: 'textbox', id: 'o_t', left: 10, top: 10, width: 80, text: 'Dla {imie}', fontSize: 5, strokeWidth: 0 });
    await (await import('./js/app/zapis.js')).zaladujCel(); // strona na płótnie z nowym tekstem
    window.showOpenFilePicker = undefined; // w teście: zwykły wybór pliku
  });
  await strona.click('[data-akcja="dane"]');
  await strona.setInputFiles('#plik-dane', plik('imie,miasto\nAnna,Kraków\nBartek,Gdańsk\n'));
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele.length === 1);
  await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    p.serie.push({ id: 'se1', nazwa: 'Goście', tabela: p.tabele[0].id, tryb: 'tabela', ile: 2, uklad: 'dlugi', dodatkowe: [], dopelnij: false });
    p.strony[0].seria = 'se1';
  });
  const stan1 = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const t0 = p.tabele[0];
    const { obrazyProjektu } = await import('./js/obrazy-projektu.js');
    return { zrodlo: { plik: t0.zrodlo.plik, rodzaj: t0.zrodlo.rodzaj, maPodpis: Boolean(t0.zrodlo.podpis) }, zalacznik: p.zasoby[t0.zrodlo.zasob]?.rodzaj, obrazow: obrazyProjektu(p).length };
  });
  assert.deepEqual(stan1, { zrodlo: { plik: 'osoby.csv', rodzaj: 'plik', maPodpis: true }, zalacznik: 'dane', obrazow: 0 });
  await strona.waitForFunction(() => /Dane z: osoby\.csv/.test(document.querySelector('#dane-zrodlo-opis').textContent));
  assert.equal(await strona.isVisible('#dane-zrodlo-zmiany'), false);
  assert.equal(await strona.isVisible('#dane-zrodlo-oryginal'), true);

  // Poprawka w Makietce → znacznik.
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.tabele[0].wiersze[0][1] = 'Kraków (poprawione)';
    const { oknoDanych } = await import('./js/app/dane-okno.js').catch(() => ({}));
    (oknoDanych || window.seriodruk.dane)?.rysuj?.();
  });
  await strona.click('#dane-tabele button');
  await strona.waitForFunction(() => !document.querySelector('#dane-zrodlo-zmiany').hidden);

  // Nowa wersja pliku: bez kolumny „imie”, trzy wiersze – porównanie w pytaniu.
  await strona.click('#dane-zrodlo-wersja');
  await strona.setInputFiles('#plik-dane-wersja', plik('miasto\nKraków\nGdańsk\nPoznań\n'));
  await strona.waitForSelector('#dlg-potwierdz[open]');
  const pytanie = await strona.textContent('#potwierdz-tresc');
  assert.match(pytanie, /wierszy: 2 → 3/);
  assert.match(pytanie, /nie ma kolumn używanych w polach: imie/);
  assert.match(pytanie, /poprawiano w Makietce/);
  await strona.click('#potwierdz-nie');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.tabele[0].wiersze.length), 2, 'anulowanie zostawia dane');

  // Odśwież z tego samego pliku: zapamiętany dostęp (zastępnik uchwytu).
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const { zapamietajUchwyt } = await import('./js/zrodla-danych.js');
    await zapamietajUchwyt(p.id, p.tabele[0].id, { getFile: async () => new File(['imie,miasto\nAnna,Kraków\nBartek,Gdańsk\nCelina,Łódź\n'], 'osoby.csv', { type: 'text/csv' }) });
  });
  await strona.click('#dane-tabele button');
  await strona.waitForSelector('#dane-zrodlo-odswiez:not([hidden])');
  await strona.click('#dane-zrodlo-odswiez');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  assert.match(await strona.textContent('#potwierdz-tresc'), /wierszy: 2 → 3/);
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[0].wiersze.length === 3);
  await strona.waitForFunction(() => document.querySelector('#dane-zrodlo-zmiany').hidden, null, { timeout: 5000 });

  // Pobranie danych jako Excel i oryginału.
  const [xlsx] = await Promise.all([strona.waitForEvent('download'), strona.click('#dane-zrodlo-xlsx')]);
  assert.equal(xlsx.suggestedFilename(), 'osoby.xlsx');
  const [oryg] = await Promise.all([strona.waitForEvent('download'), strona.click('#dane-zrodlo-oryginal')]);
  assert.equal(oryg.suggestedFilename(), 'osoby.csv');

  // Dane z linku (serwer podstawiony) i odświeżenie z linku.
  let tresc = 'produkt,cena\nKawa,12\n';
  await strona.route('https://dane.example.com/cennik.csv', (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: tresc }));
  await strona.click('#dane-z-linku');
  await strona.fill('#dane-link', 'https://dane.example.com/cennik.csv');
  await strona.click('#dane-link-form button[type="submit"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele.length === 2);
  const link = await strona.evaluate(() => window.seriodruk.stan.projekt.tabele[1].zrodlo);
  assert.equal(link.rodzaj, 'link');
  assert.equal(link.url, 'https://dane.example.com/cennik.csv');
  assert.equal(link.zasob, undefined, 'z linku nie zapisuje się pliku');
  await strona.waitForSelector('#dane-zrodlo-link:not([hidden])');
  tresc = 'produkt,cena\nKawa,13\nHerbata,9\n';
  await strona.click('#dane-zrodlo-link');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  assert.match(await strona.textContent('#potwierdz-tresc'), /wierszy: 1 → 2; zmienione komórki: 1/);
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele[1].wiersze.length === 2);

  // Link do arkusza Google → eksport CSV tej samej karty.
  assert.equal(await strona.evaluate(async () => (await import('./js/zrodla-danych.js')).linkDoPobrania('https://docs.google.com/spreadsheets/d/AbC123_x/edit#gid=42')),
    'https://docs.google.com/spreadsheets/d/AbC123_x/export?format=csv&gid=42');

  // Odpięcie: źródło i załącznik znikają, dane zostają.
  await strona.click('#dane-tabele li:first-child button');
  await strona.click('#dane-zrodlo-odepnij');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => !window.seriodruk.stan.projekt.tabele[0].zrodlo);
  const po = await strona.evaluate(() => { const p = window.seriodruk.stan.projekt; return { zrodlo: p.tabele[0].zrodlo, zalacznikow: Object.values(p.zasoby).filter((z) => z.rodzaj === 'dane').length, wierszy: p.tabele[0].wiersze.length }; });
  assert.deepEqual(po, { zrodlo: undefined, zalacznikow: 0, wierszy: 3 });
  assert.deepEqual(bledy, []);
});
