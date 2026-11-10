const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const naPlotnie = (strona) => strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().map((o) => ({
  typ: o.type, tekst: o.text || null, zWzorca: Boolean(o.zWzorca), lewo: Math.round(o.left * 10) / 10, wyrownanie: o.textAlign || null,
})));

async function dodajWzorzec(strona, budowa) {
  await strona.click('[data-akcja="wzorce"]');
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
  await strona.selectOption('#wlasciwosci label:has-text("Wzorce na tej stronie") select', 'wlasne');
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

async function nowaKsiazka(strona, liczbaStron) {
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', 'Książka');
  await strona.click('#form-nowy label:has-text("Rozkładówki")');
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
  for (let i = 1; i < liczbaStron; i += 1) await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction((n) => window.seriodruk.stan.projekt.strony.length === n, liczbaStron);
}

const przejdz = async (strona, i) => {
  await strona.evaluate((n) => window.seriodruk.przejdzDoStrony(n), i);
  await strona.waitForFunction((n) => window.seriodruk.stan.indeks === n, i);
};

test('rozkładówki: marginesy lustrzane, obie strony na jednym płótnie, wzorzec odbijany na lewych stronach', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowaKsiazka(strona, 4);

  // Margines wewnętrzny 20, zewnętrzny 8.
  await strona.click('#lista-stron .sekcja-listy button');
  await strona.click('#menu-sekcji [data-akcja="sekcja-ustawienia"]');
  assert.equal(await strona.textContent('#etykieta-wewnetrzny'), 'Wewnętrzny');
  await strona.fill('#dlg-sekcja input[name=margines_wewnetrzny]', '20');
  await strona.fill('#dlg-sekcja input[name=margines_zewnetrzny]', '8');
  await strona.click('#zapisz-sekcje');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].wydruk.marginesy.wewnetrzny === 20);

  const marginesy = async (i) => {
    await przejdz(strona, i);
    return strona.evaluate(() => {
      const e = window.seriodruk.edytor;
      return [e.marg.lewy, e.marg.prawy, e.marg.grzbiet, e.strony.length, e.aktywna];
    });
  };
  // Strona 1: prawa, sama. 2: lewa (para z 3). 3: prawa. 4: lewa bez pary.
  assert.deepEqual(await marginesy(0), [20, 8, 'lewy', 1, 0]);
  assert.deepEqual(await marginesy(1), [8, 20, 'prawy', 2, 0]);
  assert.deepEqual(await marginesy(2), [20, 8, 'lewy', 2, 1]);
  assert.deepEqual(await marginesy(3), [8, 20, 'prawy', 1, 0]);

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
  await przejdz(strona, 1);
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.zWzorca).length === 2);
  const zWzorca = (await naPlotnie(strona)).filter((o) => o.zWzorca);
  const lewa = zWzorca.find((o) => o.tekst === '2');
  const prawa = zWzorca.find((o) => o.tekst === '3');
  assert.deepEqual([lewa.lewo, lewa.wyrownanie], [8, 'left']); // 148 − 100 − 40
  assert.deepEqual([prawa.lewo, prawa.wyrownanie], [248, 'right']); // 148 + 100

  // Kliknięcie w prawą stronę płótna robi z niej stronę bieżącą; nowy tekst trafia na nią.
  const ramka = await strona.locator('#kontener-plotna .upper-canvas').boundingBox();
  await strona.mouse.click(ramka.x + ramka.width * 0.75, ramka.y + ramka.height * 0.3);
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 2);
  assert.match(strona.url(), new RegExp(`/s/${await strona.evaluate(() => window.seriodruk.stan.projekt.strony[2].id)}$`));
  await strona.click('[data-akcja="dodaj-tekst"]');
  const t2 = await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; return [o.left, o.width]; });
  assert.deepEqual(t2, [168, 120]); // 148 + margines wewnętrzny 20
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  const zapis = await strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => s.obiekty.map((o) => o.left)));
  assert.deepEqual(zapis, [[], [], [20], [8]]); // położenie liczone od rogu własnej strony
  assert.deepEqual(bledy, []);
});

test('rozkładówki: element przez grzbiet widać na obu stronach, kolejność warstw zostaje po zapisie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowaKsiazka(strona, 3);
  await przejdz(strona, 1);

  // Czerwony pas przez grzbiet (środek na prawej stronie) i zielony kwadrat na lewej, nad pasem.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const pas = e.dodajProstokat();
    pas.set({ left: 60, top: 40, width: 180, height: 30, fill: '#ff0000', strokeWidth: 0, nazwa: 'pas' });
    pas.setCoords();
    const kwadrat = e.dodajProstokat();
    kwadrat.set({ left: 90, top: 30, width: 40, height: 50, fill: '#00ff00', strokeWidth: 0, nazwa: 'kwadrat' });
    e.zatwierdz();
  });
  // Pas leży świadomie na obu stronach – bez ostrzeżenia o marginesie przy grzbiecie.
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia), []);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  const zapis = () => strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => s.obiekty.map((o) => [o.nazwa, o.left, o.z])));
  assert.deepEqual(await zapis(), [[], [['kwadrat', 90, 1]], [['pas', -88, 0]]]);

  // Obraz każdej strony z osobna (tak jak w podglądzie i miniaturach).
  const piksele = (i, punkty) => strona.evaluate(async ([n, pkt]) => {
    const { renderujCel } = await import('./js/zlozenie.js');
    const p = window.seriodruk.stan.projekt;
    const url = await renderujCel(p, p.strony[n], { szerokoscPx: 148, spad: false });
    const img = new Image();
    await new Promise((ok) => { img.onload = ok; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return pkt.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3).join(','));
  }, [i, punkty]);
  // Lewa strona: pas od 60 mm do krawędzi, na nim kwadrat; poza pasem biało.
  assert.deepEqual(await piksele(1, [[70, 55], [140, 55], [110, 55], [30, 55]]), ['255,0,0', '255,0,0', '0,255,0', '255,255,255']);
  // Prawa strona: ciąg dalszy pasa do 92 mm (240 − 148).
  assert.deepEqual(await piksele(2, [[10, 55], [85, 55], [100, 55]]), ['255,0,0', '255,0,0', '255,255,255']);

  // Po wyjściu i powrocie kwadrat (lewa strona) nadal leży nad pasem (prawa strona).
  await przejdz(strona, 0);
  await przejdz(strona, 1);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().map((o) => [o.nazwa, o.left])), [['pas', 60], ['kwadrat', 90]]);
  // Miniatury obu stron powstają z jednego płótna.
  assert.equal(await strona.evaluate(() => { const { stan } = window.seriodruk; return stan.projekt.strony.slice(1).every((s) => stan.miniatury.get(s.id)?.startsWith('data:image/png')); }), true);

  // Pas przesunięty w całości na lewą stronę zmienia właściciela; cofnięcie go przywraca.
  await strona.waitForTimeout(400);
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    e.zaznacz(e.canvas.getObjects()[0].id);
    e.aktywny.set({ left: 10, width: 100 });
    e.zatwierdz();
  });
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await zapis(), [[], [['pas', 10, 0], ['kwadrat', 90, 1]], []]);
  await strona.waitForTimeout(400);
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects()[0]?.left === 60);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await zapis(), [[], [['kwadrat', 90, 1]], [['pas', -88, 0]]]);

  // Element, który tylko wystaje w pas przy grzbiecie, dostaje ostrzeżenie.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    e.zaznacz(e.canvas.getObjects()[1].id);
    e.aktywny.set({ left: 100, width: 50 });
    e.zatwierdz();
  });
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.map((o) => [o.obiekt, o.typ])), [['kwadrat', 'w_marginesie']]);
  assert.deepEqual(bledy, []);
});

test('okno „Wzorce”: wzorce standardowe, dodanie do strony i do sekcji, warstwy w prawym panelu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Szablony');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);

  // Strony są z lewej (bez zakładek), wzorce w osobnym oknie, warstwy jako zakładka prawego panelu.
  assert.equal(await strona.locator('#panel-strony #zakladki-listy').count(), 0);
  assert.ok(await strona.isHidden('#liczba-wzorcow'), 'bez wzorców nie ma licznika');
  await strona.click('[data-akcja="wzorce"]');
  await strona.waitForSelector('#dlg-wzorce[open]');
  assert.match(await strona.textContent('#lista-wzorcow'), /Brak wzorców/);
  assert.equal(await strona.locator('#wzorce-standardowe li').count(), 8);

  // Wzorzec standardowy trafia do projektu, ale nie na strony – dopóki się go nie doda.
  await strona.click('#wzorce-standardowe button[data-standard="stopka"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.wzorce.length === 1);
  let stan = await strona.evaluate(() => { const p = window.seriodruk.stan.projekt; return { nazwa: p.wzorce[0].nazwa, teksty: p.wzorce[0].obiekty.map((o) => o.text || o.type), sekcja: p.sekcje[0].wzorce, strony: p.strony.map((s) => s.wzorce) }; });
  assert.deepEqual(stan, { nazwa: 'Stopka: nazwa projektu i numer', teksty: ['rect', '{projekt}', 'str. {nr} z {liczba_stron}'], sekcja: [], strony: ['z_sekcji', 'z_sekcji'] });
  assert.equal(await strona.textContent('#liczba-wzorcow'), '1');
  assert.equal(await strona.textContent('#lista-wzorcow li small'), '0 str.');

  // „Dodaj do tej strony”: tylko bieżąca strona (druga) dostaje wzorzec.
  await strona.click('#lista-wzorcow [data-op="strona"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.zWzorca));
  stan = await strona.evaluate(() => { const p = window.seriodruk.stan.projekt; return [p.sekcje[0].wzorce.length, p.strony.map((s) => (Array.isArray(s.wzorce) ? s.wzorce.length : s.wzorce))]; });
  assert.deepEqual(stan, [0, ['z_sekcji', 1]]);
  assert.equal(await strona.getAttribute('#lista-wzorcow [data-op="strona"]', 'aria-pressed'), 'true');
  assert.equal(await strona.textContent('#lista-wzorcow li small'), '1 str.');
  // Tekst stopki ze wzorca ma na tej stronie podstawiony numer: „str. 2 z 2”.
  assert.ok(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.zWzorca && o.text === 'str. 2 z 2')));

  // „Do całej sekcji”: wzorzec dostają też strony biorące wzorce z sekcji.
  await strona.click('#lista-wzorcow [data-op="sekcja"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].wzorce.length === 1);
  assert.equal(await strona.textContent('#lista-wzorcow li small'), '2 str.');

  // Drugi raz ten sam standardowy dostaje kolejny numer w nazwie; zakładka ma regułę „z danych” i odbicie.
  await strona.click('#wzorce-standardowe button[data-standard="stopka"]');
  await strona.click('#wzorce-standardowe button[data-standard="zakladka"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.wzorce.length === 3);
  stan = await strona.evaluate(() => { const w = window.seriodruk.stan.projekt.wzorce; return [w[1].nazwa, w[2].lustro, w[2].obiekty[0].z_danych.y.pole, w[2].obiekty[0].z_danych.y.co]; });
  assert.deepEqual(stan, ['Stopka: nazwa projektu i numer 2', true, 'egzemplarz', 6]);

  // „Edytuj” zamyka okno i otwiera wzorzec; „Gotowe” wraca do strony.
  await strona.click('#lista-wzorcow li >> nth=0 >> [data-op="edytuj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.tryb === 'wzorzec');
  assert.ok(await strona.isHidden('#dlg-wzorce'));
  await strona.click('[data-akcja="wroc-do-stron"]');
  await strona.waitForFunction(() => window.seriodruk.stan.tryb === 'strona');

  // Warstwy: zakładka w prawym panelu; element wzorca jest na liście.
  await strona.click('#zakladki-panelu label:has-text("Warstwy")');
  assert.ok(await strona.isVisible('#panel-inspektor #lista-warstw'));
  assert.ok(await strona.isHidden('#wlasciwosci'));
  assert.equal(await strona.locator('#lista-warstw li.ze-wzorca').count(), 3);
  await strona.click('#zakladki-panelu label:has-text("Właściwości")');
  assert.ok(await strona.isVisible('#wlasciwosci'));
  assert.deepEqual(bledy, []);
});
