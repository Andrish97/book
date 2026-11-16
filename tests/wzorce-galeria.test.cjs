// Gotowe wzorce stron (#164): galeria z podglądami, każdy wzorzec dodaje się i rysuje bez błędów (także na
// rozkładówkach – wzorce „lustro” odbijają się na lewej stronie), kolory z zestawu marki, pusty stan
// we właściwościach strony, „Wzorce tej strony…” w menu strony, przycisk przy liście stron, kategoria
// „Wzorce stron” w Bibliotece.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('gotowe wzorce: każdy dodaje się i rysuje na rozkładówkach, lustrzane odbijają się na lewej stronie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Galeria');
  const wynik = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const P = await import('./js/projekt.js');
    const p = stan.projekt;
    const s = p.sekcje[0];
    s.uklad = 'rozkladowki';
    s.wydruk.marginesy = { gora: 15, dol: 18, wewnetrzny: 20, zewnetrzny: 12 };
    for (let i = 2; i <= 4; i += 1) p.strony.push(P.nowaStrona(`Strona ${i}`, s.id));
    const { WZORCE_STANDARDOWE, podgladSvgWzorca } = await import('./js/wzorce-standardowe.js');
    const W = await import('./js/app/wzorce.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const bez = [];
    let lustrzane = 0;
    for (const def of WZORCE_STANDARDOWE) {
      // Podgląd schematyczny bez błędów.
      if (!podgladSvgWzorca(def, s.wydruk).startsWith('<svg')) bez.push(`${def.klucz}: podgląd`);
      const w = await W.dodajWzorzecStandardowy(def.klucz);
      if (!w || !p.sekcje[0].wzorce.includes(w.id)) { bez.push(`${def.klucz}: nie dodany do sekcji`); continue; }
      // Rysowanie stron 2 i 3 (rozkładówka: lewa i prawa).
      for (const st of p.strony.slice(1, 3)) {
        const url = await renderujCel(p, st, { szerokoscPx: 80 });
        if (!url.startsWith('data:image/png')) bez.push(`${def.klucz}: render`);
      }
      if (def.lustro) {
        lustrzane += 1;
        if (!w.lustro) bez.push(`${def.klucz}: brak lustra`);
      }
      // Następny wzorzec na czystej sekcji.
      p.sekcje[0].wzorce = [];
    }
    return { ile: WZORCE_STANDARDOWE.length, bez, lustrzane, wzorce: p.wzorce.length };
  });
  assert.ok(wynik.ile >= 30, `≥ 30 gotowych (${wynik.ile})`);
  assert.deepEqual(wynik.bez, []);
  assert.equal(wynik.wzorce, wynik.ile);
  assert.ok(wynik.lustrzane >= 8);
  // Lustro w praktyce: numer przy zewnętrznej krawędzi – na lewej stronie przy lewej, na prawej przy prawej.
  const strony = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const p = stan.projekt;
    const w = p.wzorce.find((x) => x.nazwa.startsWith('Numer strony przy zewnętrznej'));
    p.sekcje[0].wzorce = [w.id];
    const { zlozCel } = await import('./js/zlozenie.js');
    const wynik = [];
    for (const st of p.strony.slice(1, 3)) {
      const { obiekty } = await zlozCel(p, st);
      const nr = obiekty.find((o) => o.zWzorca && /^\d+$/.test(o.text || ''));
      wynik.push({ tekst: nr.text, wyrownanie: nr.textAlign });
    }
    return wynik;
  });
  assert.deepEqual(strony.map((x) => x.wyrownanie), ['left', 'right'], JSON.stringify(strony));
  assert.deepEqual(bledy, []);
});

test('wzorce: kolory z zestawu marki, pusty stan we właściwościach, menu strony, przycisk przy stronach, Biblioteka', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Marka');
  // Pusty stan: właściwości strony mówią, po co są wzorce, i prowadzą do galerii.
  const pusty = strona.locator('#wlasciwosci button:has-text("Wybierz gotowy wzorzec")');
  assert.equal(await pusty.count(), 1);
  await pusty.click();
  await strona.waitForSelector('#dlg-wzorce[open]');
  assert.match(await strona.textContent('#dlg-wzorce .wzorce-wyjasnienie'), /powtarza się na wielu stronach/);
  await strona.evaluate(() => document.querySelector('#dlg-wzorce').close());

  // Kolory marki trafiają do wzorca (akcent = pierwszy kolor marki).
  const kolor = await strona.evaluate(async () => {
    const { markaDoWzorcow, zbudujWzorzecStandardowy, WZORCE_STANDARDOWE } = await import('./js/wzorce-standardowe.js');
    const m = markaDoWzorcow({ kolory: [{ kolor: '#aa2200' }, { kolor: '#00aa22' }], czcionki: { naglowek: 'Lora', tekst: 'Lato' } });
    const z = zbudujWzorzecStandardowy(WZORCE_STANDARDOWE.find((d) => d.klucz === 'naglowek-pasek'), { szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, marginesy: { gora: 15, dol: 15, wewnetrzny: 15, zewnetrzny: 15 } }, m);
    return [z.obiekty[0].fill, z.obiekty[1].fontFamily];
  });
  assert.deepEqual(kolor, ['#aa2200', 'Lora']);

  // Menu strony: „Wzorce tej strony…” otwiera okno; przycisk „Wzorce” przy liście stron też.
  await strona.click('#lista-stron .strona .menu-miniatury');
  await strona.click('#menu-strony [data-akcja="strona-wzorce"]');
  await strona.waitForSelector('#dlg-wzorce[open]');
  await strona.evaluate(() => document.querySelector('#dlg-wzorce').close());
  await strona.click('#stopka-strony [data-akcja="wzorce"]');
  await strona.waitForSelector('#dlg-wzorce[open]');
  await strona.evaluate(() => document.querySelector('#dlg-wzorce').close());

  // Biblioteka: kategoria „Wzorce stron” z grupami; kliknięcie dodaje wzorzec na strony sekcji.
  await strona.click('.pasek-narzedzi [data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  await strona.click('#kategorie-biblioteki [data-kategoria="wzorce-stron"]');
  await strona.waitForSelector('#elementy-biblioteki .grupa-biblioteki');
  const ile = await strona.locator('#elementy-biblioteki .kafel-biblioteki').count();
  assert.ok(ile >= 30, `kafelki wzorców w Bibliotece (${ile})`);
  await strona.locator('#elementy-biblioteki .kafel-biblioteki').first().click();
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.wzorce.length === 1 && window.seriodruk.stan.projekt.sekcje[0].wzorce.length === 1);
  assert.equal(await strona.textContent('#liczba-wzorcow-panel'), '1');
  assert.deepEqual(bledy, []);
});
