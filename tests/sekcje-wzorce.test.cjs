const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const naPlotnie = (strona) => strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().map((o) => ({
  typ: o.type, tekst: o.text || null, zWzorca: Boolean(o.zWzorca), lewo: Math.round(o.left * 10) / 10, wyrownanie: o.textAlign || null,
})));

async function dodajWzorzec(strona, budowa) {
  await strona.click('#zakladki-listy label:has-text("Wzorce")');
  await strona.click('[data-akcja="wzorzec-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.tryb === 'wzorzec');
  await strona.evaluate(budowa);
  await strona.waitForTimeout(350);
  await strona.click('[data-akcja="wroc-do-stron"]');
  await strona.waitForFunction(() => window.seriodruk.stan.tryb === 'strona');
}

test('wzorce: kilka na stronę, pod i nad treścią, numer strony, cofanie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wzorce');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 3);

  // Wzorzec 1: stopka z numerem (pod treścią).
  await dodajWzorzec(strona, () => {
    const e = window.seriodruk.edytor;
    const tekst = e.dodajTekst('Strona {nr} z {liczba_stron}');
    tekst.set({ top: 195 });
    e.zatwierdz();
  });
  // Wzorzec 2: ramka nad treścią.
  await dodajWzorzec(strona, () => {
    const e = window.seriodruk.edytor;
    const r = e.dodajProstokat();
    r.set({ warstwa: 'nad', left: 20, top: 20 });
    e.zatwierdz();
  });

  const p = await strona.evaluate(() => {
    const pr = window.seriodruk.stan.projekt;
    return { wzorce: pr.wzorce.length, sekcja: pr.sekcje[0].wzorce.length, warstwa: pr.wzorce[1].obiekty[0].warstwa };
  });
  assert.deepEqual(p, { wzorce: 2, sekcja: 2, warstwa: 'nad' });

  // Strona 2: tekst ze wzorca na dole stosu, ramka na wierzchu, własny element pomiędzy.
  await strona.click('#lista-stron li.strona >> nth=1 >> .miniatura');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1 && window.seriodruk.edytor.canvas.getObjects().length === 2);
  await strona.click('[data-akcja="dodaj-elipse"]');
  let obiekty = await naPlotnie(strona);
  assert.deepEqual(obiekty.map((o) => [o.typ, o.zWzorca]), [['textbox', true], ['ellipse', false], ['rect', true]]);
  assert.equal(obiekty[0].tekst, 'Strona 2 z 3');

  // Elementy wzorca nie zapisują się w stronie i wracają po cofnięciu.
  await strona.waitForTimeout(400);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.obiektyStrony().length), 1);
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 2);
  obiekty = await naPlotnie(strona);
  assert.ok(obiekty.every((o) => o.zWzorca));

  // Własny wybór na stronie: tylko pierwszy wzorzec.
  await strona.selectOption('#wlasciwosci select >> nth=1', 'wlasne');
  await strona.waitForSelector('#wlasciwosci label.przelacznik:has-text("Wzorzec 2")');
  await strona.click('#wlasciwosci label.przelacznik:has-text("Wzorzec 2") input');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 1);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[1].wzorce.length), 1);
  assert.deepEqual(bledy, []);
});

test('sekcje: własny format, numeracja od zadanej liczby i bez numerów', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Sekcje');
  await strona.click('[data-akcja="strona-dodaj"]');
  await dodajWzorzec(strona, () => {
    const e = window.seriodruk.edytor;
    e.dodajTekst('{nr}');
    e.zatwierdz();
  });

  // Nowa sekcja „Okładka”: szeroka, bez numerów, bez wzorców, przesunięta na początek.
  await strona.click('[data-akcja="sekcja-dodaj"]');
  await strona.fill('#dlg-sekcja input[name=nazwa]', 'Okładka');
  await strona.fill('#dlg-sekcja input[name=szerokosc_mm]', '302');
  await strona.fill('#dlg-sekcja input[name=margines_gora]', '15');
  await strona.selectOption('#dlg-sekcja select[name=numeracja]', 'brak');
  await strona.click('#zapisz-sekcje');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje.length === 2);
  await strona.click('#lista-stron .sekcja-listy:has-text("Okładka") button');
  await strona.click('#menu-sekcji [data-akcja="sekcja-gora"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].nazwa === 'Okładka');

  const p = await strona.evaluate(() => {
    const pr = window.seriodruk.stan.projekt;
    return {
      sekcje: pr.sekcje.map((s) => [s.nazwa, s.wydruk.szerokosc_mm, s.wydruk.marginesy.gora, s.numeracja.tryb, s.wzorce.length]),
      strony: pr.strony.map((s) => pr.sekcje.find((x) => x.id === s.sekcja).nazwa),
    };
  });
  assert.deepEqual(p.sekcje, [['Okładka', 302, 15, 'brak', 0], ['Główna', 148, 10, 'ciagla', 1]]);
  assert.deepEqual(p.strony, ['Okładka', 'Główna', 'Główna']);

  // Okładka nie liczy się do numeracji: pierwsza strona środka ma numer 1.
  await strona.click('#lista-stron li.strona >> nth=1 >> .miniatura');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1 && window.seriodruk.edytor.canvas.getObjects().length === 1);
  assert.equal((await naPlotnie(strona))[0].tekst, '1');
  assert.deepEqual(await strona.$$eval('#lista-stron li.strona .numer', (l) => l.map((x) => x.textContent)), ['–', '1', '2']);

  // Numeracja od 5.
  await strona.click('#lista-stron .sekcja-listy:has-text("Główna") button');
  await strona.click('#menu-sekcji [data-akcja="sekcja-ustawienia"]');
  await strona.selectOption('#dlg-sekcja select[name=numeracja]', 'od');
  await strona.fill('#dlg-sekcja input[name=numeracja_od]', '5');
  await strona.click('#zapisz-sekcje');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects()[0]?.text === '5');
  assert.deepEqual(bledy, []);
});

test('rozkładówki: marginesy lustrzane, sąsiednia strona, wzorzec odbijany na lewych stronach', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', 'Książka');
  await strona.click('#form-nowy label:has-text("Rozkładówki")');
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
  for (let i = 0; i < 3; i += 1) await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 4);

  // Margines wewnętrzny 20, zewnętrzny 8.
  await strona.click('#lista-stron .sekcja-listy button');
  await strona.click('#menu-sekcji [data-akcja="sekcja-ustawienia"]');
  assert.equal(await strona.textContent('#etykieta-wewnetrzny'), 'Wewnętrzny');
  await strona.fill('#dlg-sekcja input[name=margines_wewnetrzny]', '20');
  await strona.fill('#dlg-sekcja input[name=margines_zewnetrzny]', '8');
  await strona.click('#zapisz-sekcje');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].wydruk.marginesy.wewnetrzny === 20);

  const marginesy = async (i) => {
    await strona.evaluate((n) => window.seriodruk.przejdzDoStrony(n), i);
    await strona.waitForFunction((n) => window.seriodruk.stan.indeks === n, i);
    return strona.evaluate(() => {
      const m = window.seriodruk.edytor.marg;
      return [m.lewy, m.prawy, m.grzbiet, !document.querySelector('#sasiad').hidden];
    });
  };
  // Strona 1: prawa, sama. 2: lewa (para z 3). 3: prawa. 4: lewa bez pary.
  assert.deepEqual(await marginesy(0), [20, 8, 'lewy', false]);
  assert.deepEqual(await marginesy(1), [8, 20, 'prawy', true]);
  assert.deepEqual(await marginesy(2), [20, 8, 'lewy', true]);
  assert.deepEqual(await marginesy(3), [8, 20, 'prawy', false]);

  // Nowy tekst trzyma się marginesów swojej strony.
  await strona.click('[data-akcja="dodaj-tekst"]');
  const t1 = await strona.evaluate(() => { const o = window.seriodruk.edytor.canvas.getObjects().at(-1); return [o.left, o.width]; });
  assert.deepEqual(t1, [8, 120]);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.length), 0);

  // Wzorzec z numerem strony w prawym dolnym rogu, odbijany na lewych stronach.
  await dodajWzorzec(strona, () => {
    const e = window.seriodruk.edytor;
    const nr = e.dodajTekst('{nr}');
    nr.set({ left: 100, top: 195, width: 40, textAlign: 'right' });
    e.zatwierdz();
    window.seriodruk.stan.projekt.wzorce[0].lustro = true;
  });
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(2));
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 2 && window.seriodruk.edytor.canvas.getObjects().some((o) => o.zWzorca));
  const prawa = (await naPlotnie(strona)).find((o) => o.zWzorca);
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(1));
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1 && window.seriodruk.edytor.canvas.getObjects().some((o) => o.zWzorca));
  const lewa = (await naPlotnie(strona)).find((o) => o.zWzorca);
  assert.deepEqual([prawa.lewo, prawa.wyrownanie, prawa.tekst], [100, 'right', '3']);
  assert.deepEqual([lewa.lewo, lewa.wyrownanie, lewa.tekst], [8, 'left', '2']); // 148 − 100 − 40

  // Kliknięcie sąsiedniej strony przełącza edycję.
  await strona.click('#sasiad');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 2);
  assert.deepEqual(bledy, []);
});
