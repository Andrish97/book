const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const tekst = (strona, i = 0) => strona.evaluate((n) => {
  const o = window.seriodruk.edytor.canvas.getObjects().filter((x) => x.type === 'textbox')[n];
  return {
    styl: o.styl || null, czcionka: o.fontFamily, pt: Math.round(o.fontSize / (25.4 / 72) * 10) / 10,
    waga: o.fontWeight, odstep: o.charSpacing, podkreslenie: Boolean(o.underline), tresc: o.text,
  };
}, i);

test('tekst: odstęp liter, podkreślenie, wielkość liter', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tekst');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.fill('#wlasciwosci label:has-text("Odstęp liter") input', '120');
  await strona.press('#wlasciwosci label:has-text("Odstęp liter") input', 'Tab');
  await strona.click('#wlasciwosci button[aria-label="Podkreślenie"]');
  const szerokoscPrzed = await strona.evaluate(() => window.seriodruk.edytor.aktywny.getLineWidth(0));
  await strona.click('#wlasciwosci button[aria-label^="WSZYSTKIE WIELKIE"]');
  const o = await tekst(strona);
  assert.equal(o.odstep, 120);
  assert.equal(o.podkreslenie, true);
  // Wielkie litery to tylko wygląd: treść zostaje, wiersz robi się szerszy, a ustawienie zapisuje się z tekstem.
  assert.equal(o.tresc, 'Kliknij dwa razy, aby edytować');
  const wyglad = await strona.evaluate(async () => { const e = window.seriodruk.edytor; await window.seriodruk.zapiszTeraz(); return [e.aktywny.wielkosc_liter, e.aktywny.getLineWidth(0), window.seriodruk.stan.projekt.strony[0].obiekty[0].wielkosc_liter]; });
  assert.equal(wyglad[0], 'wielkie');
  assert.ok(wyglad[1] > szerokoscPrzed * 1.1, 'wielkie litery są szersze');
  assert.equal(wyglad[2], 'wielkie');
  // „Jak w zdaniu” zmienia treść i wyłącza wygląd.
  await strona.evaluate(() => { const o2 = window.seriodruk.edytor.aktywny; o2.set('text', 'pierwsze zdanie. drugie {pole} zdanie'); window.seriodruk.edytor.zatwierdz(); });
  await strona.click('#wlasciwosci button[aria-label^="Jak w zdaniu"]');
  assert.deepEqual(await strona.evaluate(() => { const o2 = window.seriodruk.edytor.aktywny; return [o2.text, o2.wielkosc_liter]; }), ['Pierwsze zdanie. Drugie {pole} zdanie', undefined]);
  assert.deepEqual(bledy, []);
});

test('tekst: formatowanie zaznaczonego fragmentu nie zmienia reszty', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Fragment');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const o = e.aktywny;
    o.enterEditing();
    o.setSelectionStart(0);
    o.setSelectionEnd(7); // „Kliknij”
    e.canvas.fire('text:selection:changed', { target: o });
  });
  await strona.waitForSelector('#wlasciwosci .znacznik-fragmentu:not([hidden])');
  await strona.click('#wlasciwosci button[aria-label="Pogrubienie"]');
  const w = await strona.evaluate(() => {
    const o = window.seriodruk.edytor.aktywny;
    return { cala: o.fontWeight, pierwszy: o.getSelectionStyles(0, 1, true)[0].fontWeight, dalszy: o.getSelectionStyles(10, 11, true)[0].fontWeight };
  });
  assert.deepEqual(w, { cala: 'normal', pierwszy: 'bold', dalszy: 'normal' });

  // Formatowanie fragmentu przetrwa zapis i ponowne wczytanie strony.
  await strona.evaluate(() => { window.seriodruk.edytor.aktywny.exitEditing(); });
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(0));
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0 && window.seriodruk.edytor.canvas.getObjects().length === 1);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects()[0].getSelectionStyles(0, 1, true)[0].fontWeight), 'bold');
  assert.deepEqual(bledy, []);
});

test('style tekstu: nadanie, aktualizacja zmienia teksty na innych stronach, nowy styl', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Style');
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.style.map((s) => s.nazwa)), ['Tytuł', 'Nagłówek', 'Tekst', 'Podpis']);

  // Strona 1 i 2: tekst w stylu „Nagłówek”.
  const nadajStyl = async () => {
    await strona.click('[data-akcja="dodaj-tekst"]');
    await strona.selectOption('#wlasciwosci label:has-text("Styl") select >> nth=0', { label: 'Nagłówek' });
  };
  await nadajStyl();
  let o = await tekst(strona);
  assert.deepEqual([o.pt, o.waga], [16, 'bold']);
  await strona.waitForTimeout(350);
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await nadajStyl();

  // Zmiana rozmiaru na stronie 2 → „różni się od stylu” → Aktualizuj styl.
  await strona.fill('#wlasciwosci label:has-text("Rozmiar") input', '22');
  await strona.press('#wlasciwosci label:has-text("Rozmiar") input', 'Tab');
  await strona.waitForSelector('#wlasciwosci button:has-text("Aktualizuj styl"):visible');
  await strona.click('#wlasciwosci button:has-text("Aktualizuj styl")');
  await strona.waitForFunction(() => document.querySelector('#powiadomienie').textContent.includes('zmieniono 2 teksty'));

  // Strona 1 ma nowy rozmiar, choć nie była otwarta.
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(0));
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0 && window.seriodruk.edytor.canvas.getObjects().length === 1);
  o = await tekst(strona);
  assert.equal(o.pt, 22);

  // Nowy styl z wyglądu tekstu.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.setActiveObject(e.canvas.getObjects()[0]); e._emitujZaznaczenie(); });
  await strona.click('#wlasciwosci button:has-text("Nowy styl")');
  await strona.fill('#dlg-nazwa input', 'Daty');
  await strona.click('#dlg-nazwa button[value=tak]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.style.length === 5);
  o = await tekst(strona);
  assert.equal(await strona.evaluate((id) => window.seriodruk.stan.projekt.style.find((s) => s.id === id).nazwa, o.styl), 'Daty');
  assert.deepEqual(bledy, []);
});
