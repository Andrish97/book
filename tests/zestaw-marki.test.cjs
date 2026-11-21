// Zestaw marki (#131D): mapowanie kolorów i czcionek (js/zestaw-marki.js) i przepływ w aplikacji –
// zapis na koncie, kolory marki w wyborze koloru, czcionki marki na liście, „Zastosuj markę do projektu”.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('mapowanie marki: najbliższe kolory, czerń i biel zostają, czcionki tekst/nagłówki; zamiana w stronach, wzorcach, stylach i fragmentach', async () => {
  const { normalizujMarke, propozycjaMapowania, zastosujMapowanie, koloryDodatkoweZMarki } = await modul('js/zestaw-marki.js');
  const marka = normalizujMarke({
    kolory: [{ id: 'a', nazwa: 'Granat', kolor: '#1c2541' }, { id: 'b', nazwa: 'Złoto', kolor: '#c9a227', cmyk: [0, 20, 80, 20] }],
    czcionki: { naglowek: 'Playfair Display', tekst: 'Inter' },
  });
  const m = propozycjaMapowania([{ kolor: '#102040' }, { kolor: '#d4b030' }, { kolor: '#000000' }], [{ nazwa: 'Roboto' }, { nazwa: 'Lora' }], marka);
  assert.equal(m.kolory['#102040'], '#1c2541');
  assert.equal(m.kolory['#d4b030'], '#c9a227');
  assert.equal(m.kolory['#000000'], '#000000', 'czerń zostaje');
  assert.deepEqual(m.czcionki, { Roboto: 'Inter', Lora: 'Playfair Display' });
  const p = {
    strony: [{ tlo: '#102040', obiekty: [
      { type: 'textbox', text: 'A', fontFamily: 'Lora', fill: '#d4b030', styles: [{ start: 0, end: 1, style: { fill: '#102040', fontFamily: 'Roboto' } }] },
      { type: 'group', objects: [{ type: 'rect', fill: { type: 'linear', colorStops: [{ color: '#102040' }, { color: '#ffffff' }] } }] },
    ] }],
    wzorce: [{ obiekty: [{ type: 'rect', stroke: '#d4b030' }] }],
    style: [{ fontFamily: 'Roboto', fill: '#102040' }],
  };
  const n = zastosujMapowanie(p, m);
  assert.ok(n >= 8, `zmian: ${n}`);
  assert.equal(p.strony[0].tlo, '#1c2541');
  assert.equal(p.strony[0].obiekty[0].fontFamily, 'Playfair Display');
  assert.equal(p.strony[0].obiekty[0].styles[0].style.fontFamily, 'Inter');
  assert.equal(p.strony[0].obiekty[1].objects[0].fill.colorStops[0].color, '#1c2541');
  assert.equal(p.wzorce[0].obiekty[0].stroke, '#c9a227');
  assert.deepEqual(p.style[0], { fontFamily: 'Inter', fill: '#1c2541' });
  assert.deepEqual(koloryDodatkoweZMarki(marka).map((k) => k.nazwa), ['Złoto'], 'kolor z CMYK = kolor dodatkowy');
});

test('zestaw marki w aplikacji: zapis na koncie, „Marka” w wyborze koloru i na liście czcionek, Biblioteka, zastosowanie do projektu z cofaniem', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  // Ustawienia konta → Zestaw marki.
  await strona.evaluate(() => { location.hash = '#/konto/marka'; });
  await strona.waitForSelector('#ust-marka', { state: 'visible' });
  await strona.waitForFunction(() => /pusty/.test(document.querySelector('#podsumowanie-marki').textContent));
  await strona.click('#ust-marka [data-akcja="marka-edytuj"]');
  await strona.waitForSelector('#dlg-marka[open]');
  await strona.click('#marka-dodaj-kolor');
  await strona.fill('#marka-kolory li:last-child input.nazwa', 'Granat marki');
  await strona.fill('#marka-kolory li:last-child input.kod', '#1c2541');
  await strona.dispatchEvent('#marka-kolory li:last-child input.kod', 'change');
  await strona.evaluate(() => {
    const f = document.querySelector('#form-marka');
    f.elements.tekst.value = 'Lora';
    f.elements.tekst.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await strona.click('#marka-zapisz');
  await strona.waitForFunction(() => /Granat|1 kol/.test(document.querySelector('#podsumowanie-marki').innerHTML + document.querySelector('[data-podsumowanie="marka"]').textContent));
  // Edytor: kolor marki w wyborze koloru.
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await nowyProjekt(strona, 'Marka');
  await strona.waitForFunction(() => (globalThis.makietkaMarka?.kolory || []).length === 1);
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.waitForTimeout(400);
  await strona.click('#wlasciwosci .kolor-przycisk >> nth=0');
  await strona.waitForTimeout(500);
  await strona.waitForSelector('.kolor-okienko .kolor-paleta.marki button');
  assert.match(await strona.getAttribute('.kolor-okienko .kolor-paleta.marki button', 'title'), /Granat marki/);
  await strona.keyboard.press('Escape');
  // Biblioteka → Marka.
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  await strona.click('#kategorie-biblioteki [data-kategoria="marka"]');
  assert.ok(await strona.locator('#dlg-biblioteka [data-element="zastosuj"]').count() === 1);
  await strona.click('#dlg-biblioteka [data-element="zastosuj"]');
  await strona.waitForSelector('#dlg-marka-zastosuj[open]');
  await strona.click('#marka-zastosuj-ok');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].obiekty.some((o) => o.fill === '#1c2541'));
  assert.deepEqual(bledy, []);
});

test('kilka zestawów marki (#211): dawny plik = jeden zestaw; nowy zestaw, wybór przy projekcie – projekt go pamięta', async (t) => {
  const { normalizujPlikMarki } = await modul('js/zestaw-marki.js');
  const stary = normalizujPlikMarki({ kolory: [{ id: 'a', nazwa: 'Granat', kolor: '#1c2541' }], czcionki: { naglowek: '', tekst: 'Lora' } });
  assert.equal(stary.zestawy.length, 1);
  assert.equal(stary.zestawy[0].nazwa, 'Moja marka');
  assert.equal(stary.zestawy[0].kolory[0].kolor, '#1c2541');
  assert.equal(stary.aktywny, stary.zestawy[0].id);

  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  const nazwij = async (nazwa) => {
    await strona.waitForSelector('#dlg-nazwa[open]');
    await strona.fill('#dlg-nazwa input', nazwa);
    await strona.click('#dlg-nazwa button[value="tak"]');
  };
  const dodajKolor = async (kod) => {
    await strona.click('#marka-dodaj-kolor');
    await strona.fill('#marka-kolory li:last-child input.kod', kod);
    await strona.dispatchEvent('#marka-kolory li:last-child input.kod', 'change');
  };
  await strona.evaluate(() => { location.hash = '#/konto/marka'; });
  await strona.waitForSelector('#ust-marka', { state: 'visible' });
  await strona.click('#ust-marka [data-akcja="marka-edytuj"]');
  await strona.waitForSelector('#dlg-marka[open]');
  await dodajKolor('#1c2541');
  // Nowy zestaw – zmiany w pierwszym zapisują się same.
  await strona.click('#marka-zestaw-nowy');
  await nazwij('Klient B');
  await strona.waitForFunction(() => document.querySelectorAll('#marka-zestaw option').length === 2);
  assert.equal(await strona.locator('#marka-kolory li').count(), 0, 'nowy zestaw jest pusty');
  await dodajKolor('#c0392b');
  await strona.click('#marka-zapisz');
  await strona.waitForFunction(() => /W użyciu: Klient B/.test(document.querySelector('#podsumowanie-marki').textContent));
  // Projekt: wybór „Moja marka” w oknie marki – projekt zapamiętuje swój zestaw, konto zostaje przy wyborze.
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await nowyProjekt(strona, 'Projekt marki');
  await strona.waitForFunction(() => globalThis.makietkaMarka?.kolory?.[0]?.kolor === '#c0392b');
  await strona.evaluate(async () => (await import('./js/marka-okno.js')).otworzMarke());
  await strona.waitForSelector('#dlg-marka[open]');
  const idMoja = await strona.evaluate(() => [...document.querySelectorAll('#marka-zestaw option')].find((o) => /Moja marka/.test(o.textContent)).value);
  await strona.selectOption('#marka-zestaw', idMoja);
  await strona.waitForFunction(() => globalThis.makietkaMarka?.kolory?.[0]?.kolor === '#1c2541');
  // kolory zestawu zmieniają się chwilę przed zapamiętaniem go w projekcie – czekamy na jedno i drugie
  await strona.waitForFunction((id) => window.seriodruk.stan.projekt.zestaw_marki === id, idMoja);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.zestaw_marki), idMoja);
  assert.match(await strona.textContent('#marka-zestaw-opis'), /marką otwartego projektu/);
  assert.deepEqual(bledy, []);
});
