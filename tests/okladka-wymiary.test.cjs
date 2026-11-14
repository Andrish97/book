// Okładka – wymiary wpisane (#125) i składki z seriami (#126).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

async function projektZOkladka(oprawa, stron = 46, okladka = {}) {
  const P = await modul('js/projekt.js');
  const O = await modul('js/okladka.js');
  const p = P.nowyProjekt('Dziennik');
  const srodek = p.sekcje[0];
  srodek.nazwa = 'Środek';
  for (let i = 1; i < stron; i += 1) p.strony.push(P.nowaStrona(`S${i + 1}`, srodek.id));
  const ok = P.nowaSekcja('Okładka');
  ok.okladka = { oprawa, ...okladka };
  p.sekcje.unshift(ok);
  p.strony.unshift(P.nowaStrona('Okładka', ok.id));
  return { O, p: P.normalizuj(p) };
}

test('okładka – wymiary wpisane (#125): grzbiet od drukarni, cały rozmiar okładki, przesunięcie przodu, podpowiedź liczona', async () => {
  // Miękka, 46 stron, kartka 0,1 mm → z papieru grzbiet 2,3 mm.
  let { O, p } = await projektZOkladka('miekka', 46, { papier: { tryb: 'grubosc', grubosc_mm: 0.1 } });
  O.przeliczOkladki(p);
  const ok = p.sekcje[0];
  const strona = p.strony.find((s) => s.sekcja === ok.id);
  strona.obiekty = [{ type: 'rect', id: 'przod', left: 200, top: 50, width: 40, height: 40 }, { type: 'rect', id: 'tyl', left: 20, top: 50, width: 40, height: 40 }];
  // Grzbiet od drukarni: 5 mm – okładka szersza o 2,7 mm, przód przesuwa się, tył zostaje.
  ok.okladka.wymiary = { tryb: 'grzbiet', grzbiet_mm: 5 };
  O.przeliczOkladki(p);
  let w = ok.okladka.wynik;
  assert.equal(w.grzbiet, 5);
  assert.equal(w.szerokosc, 301);
  assert.deepEqual(w.liczone, { grzbiet: 2.3, szerokosc: 298.3, wysokosc: 210 }, 'liczone wartości zostają jako podpowiedź');
  assert.equal(ok.wydruk.szerokosc_mm, 301);
  assert.ok(Math.abs(strona.obiekty[0].left - 202.7) < 1e-9, `przód: ${strona.obiekty[0].left}`);
  assert.equal(strona.obiekty[1].left, 20);
  // Cały rozmiar: 310 × 215 – tył i przód po (310 − 5) / 2 = 152,5 mm.
  ok.okladka.wymiary = { tryb: 'rozmiar', grzbiet_mm: 5, szerokosc_mm: 310, wysokosc_mm: 215 };
  O.przeliczOkladki(p);
  w = ok.okladka.wynik;
  assert.deepEqual([w.szerokosc, w.wysokosc, w.grzbiet], [310, 215, 5]);
  assert.deepEqual(w.strefy.map((z) => [z.rodzaj, z.x1, z.x2]), [['tyl', 0, 152.5], ['grzbiet', 152.5, 157.5], ['przod', 157.5, 310]]);
  assert.equal(ok.wydruk.wysokosc_mm, 215);
  // Rozmiar bez wpisanego grzbietu – grzbiet z papieru.
  ok.okladka.wymiary = { tryb: 'rozmiar', grzbiet_mm: 0, szerokosc_mm: 310, wysokosc_mm: 215 };
  O.przeliczOkladki(p);
  assert.equal(ok.okladka.wynik.grzbiet, 2.3);
  // Twarda: zawinięcia i bigi zostają wg ustawień, panele dzielą resztę.
  ({ O, p } = await projektZOkladka('twarda', 46, { papier: { tryb: 'grubosc', grubosc_mm: 0.1 }, wymiary: { tryb: 'rozmiar', szerokosc_mm: 360, wysokosc_mm: 250, grzbiet_mm: 9 } }));
  O.przeliczOkladki(p);
  w = p.sekcje[0].okladka.wynik;
  assert.deepEqual(w.strefy.map((z) => Math.round((z.x2 - z.x1) * 10) / 10), [15, 153.5, 7, 9, 7, 153.5, 15]);
  assert.equal(w.wysokosc, 250);
  // Normalizacja: nieznany tryb → auto, liczby z zakresu.
  assert.deepEqual(O.normalizujOkladke({ wymiary: { tryb: 'cos', grzbiet_mm: -3 } }).wymiary, { tryb: 'auto', grzbiet_mm: 0, szerokosc_mm: 0, wysokosc_mm: 0 });
});

test('okładka w oknie sekcji (#125): „Wpisz grzbiet” – pole z liczoną wartością, wynik i podpowiedź; „Wpisz rozmiar”', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', 'Dziennik');
  await strona.evaluate(() => { const s = document.querySelector('#form-nowy select[name=okladka]'); s.value = 'miekka'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.sekcje.length === 2 && window.seriodruk.edytor?.wydruk);
  await strona.evaluate(async () => (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(window.seriodruk.stan.projekt.sekcje[0].id));
  await strona.waitForSelector('#dlg-sekcja[open]');
  assert.equal(await strona.isVisible('#pole-ok-wymiary'), false, 'przy „Policz same” bez pól');
  await strona.click('#dlg-sekcja label:has-text("Wpisz grzbiet")');
  assert.equal(await strona.isVisible('#pole-ok-grzbiet'), true);
  assert.equal(await strona.isVisible('#pole-ok-szerokosc'), false);
  assert.ok(Number(await strona.inputValue('#dlg-sekcja input[name=ok_grzbiet]')) > 0, 'pole dostaje liczony grzbiet');
  await strona.fill('#dlg-sekcja input[name=ok_grzbiet]', '8');
  await strona.waitForFunction(() => /Grzbiet 8 mm/.test(document.querySelector('#wynik-okladki').textContent));
  assert.match(await strona.textContent('#ok-liczone'), /Z papieru i formatu środka wychodzi: grzbiet .* mm/);
  await strona.click('#dlg-sekcja label:has-text("Wpisz rozmiar")');
  assert.equal(await strona.isVisible('#pole-ok-szerokosc'), true);
  await strona.fill('#dlg-sekcja input[name=ok_szerokosc]', '320');
  await strona.fill('#dlg-sekcja input[name=ok_wysokosc]', '220');
  await strona.waitForFunction(() => /Okładka 320 × 220 mm/.test(document.querySelector('#wynik-okladki').textContent));
  await strona.click('#zapisz-sekcje');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].wydruk.szerokosc_mm === 320);
  const w = await strona.evaluate(() => window.seriodruk.stan.projekt.sekcje[0].okladka.wymiary);
  assert.deepEqual(w, { tryb: 'rozmiar', grzbiet_mm: 8, szerokosc_mm: 320, wysokosc_mm: 220 });
  assert.deepEqual(bledy, []);
});

test('składki z serią (#126): strony powielane danymi liczą się do składki – licznik, „Dopełnij pustymi”, kontrola przed drukiem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz');
  await strona.evaluate(async () => {
    const { stan, przeladuj, zapiszTeraz } = window.seriodruk;
    const { nowaStrona } = await import('./js/projekt.js');
    const p = stan.projekt;
    const sek = p.sekcje[0].id;
    // Tytuł + strona dnia powielana serią z 31 wierszy + notatki = 33 strony; składka 16 → brakuje 15 do 48.
    p.strony = [nowaStrona('Tytuł', sek), { ...nowaStrona('Dzień', sek), seria: 'se1' }, nowaStrona('Notatki', sek)];
    p.tabele.push({ id: 't1', nazwa: 'Dni', kolumny: ['dzien'], wiersze: Array.from({ length: 31 }, (_, i) => [String(i + 1)]) });
    p.serie.push({ id: 'se1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'dlugi', ile: 1, dodatkowe: [], dopelnij: false });
    p.sekcje[0].skladka = 16;
    await przeladuj();
    await zapiszTeraz();
  });
  await strona.waitForSelector('.skladka-sekcji.brak');
  assert.match(await strona.textContent('.skladka-sekcji'), /33 z 48 – brakuje 15 do pełnej składki \(×16\)/);
  const uwagi = await strona.evaluate(async () => (await import('./js/kontrola.js')).sprawdzProjekt(window.seriodruk.stan.projekt).map((u) => u.opis).join(' | '));
  assert.match(uwagi, /ma 33 strony – do pełnej składki po 16 brakuje 15/);
  await strona.click('.skladka-sekcji button');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 18, null, { timeout: 5000 });
  await strona.waitForFunction(() => /48 stron – 3 pełne składki po 16/.test(document.querySelector('.skladka-sekcji')?.textContent));
  const poDopelnieniu = await strona.evaluate(async () => (await import('./js/kontrola.js')).sprawdzProjekt(window.seriodruk.stan.projekt).filter((u) => u.rodzaj === 'skladka').length);
  assert.equal(poDopelnieniu, 0);
  assert.deepEqual(bledy, []);
});
