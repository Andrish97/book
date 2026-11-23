// Okładka liczona sama (decyzja #119) i składki środka (#120): obliczenia (grzbiet, format, strefy,
// przesuwanie elementów) oraz aplikacja – kreator, okno sekcji, przeliczanie po dodaniu stron, składki.

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
  return { P, O, p: P.normalizuj(p) };
}

test('okładka: grzbiet z gramatury albo grubości kartki, format miękkiej, zeszytowej i twardej, liczba stron wpisana', async () => {
  let { O, p } = await projektZOkladka('miekka', 46, { papier: { tryb: 'grubosc', grubosc_mm: 0.1 } });
  assert.deepEqual(O.przeliczOkladki(p), [p.sekcje[0].id]);
  let w = p.sekcje[0].okladka.wynik;
  assert.equal(w.stron, 46);
  assert.equal(w.kartek, 23);
  assert.equal(w.grzbiet, 2.3);
  assert.equal(w.szerokosc, 298.3); // 148 + 2,3 + 148
  assert.equal(w.wysokosc, 210);
  assert.deepEqual(w.strefy.map((z) => z.rodzaj), ['tyl', 'grzbiet', 'przod']);
  assert.equal(p.sekcje[0].wydruk.szerokosc_mm, 298.3);
  assert.deepEqual(O.przeliczOkladki(p), [], 'bez zmian – nic do przeliczenia');

  // Gramatura: 90 g offset (wolumen 1,25) → 0,1125 mm na kartkę.
  ({ O, p } = await projektZOkladka('miekka', 100, { papier: { tryb: 'gramatura', gramatura: 90, rodzaj: 'offset' } }));
  O.przeliczOkladki(p);
  assert.equal(p.sekcje[0].okladka.wynik.grzbiet, 5.6); // 50 kartek × 0,1125
  assert.equal(O.gruboscKartki({ tryb: 'gramatura', gramatura: 100, rodzaj: 'kredowy_blysk' }), 0.08);

  ({ O, p } = await projektZOkladka('zeszytowa', 16));
  O.przeliczOkladki(p);
  w = p.sekcje[0].okladka.wynik;
  assert.equal(w.grzbiet, 0);
  assert.equal(w.szerokosc, 296);
  assert.deepEqual(w.strefy.map((z) => z.rodzaj), ['tyl', 'przod']);

  // Twarda: zawinięcie 15, naddatek 3, big 7, tektura 2 – A5, 46 stron, kartka 0,1 mm.
  ({ O, p } = await projektZOkladka('twarda', 46, { papier: { tryb: 'grubosc', grubosc_mm: 0.1 } }));
  O.przeliczOkladki(p);
  w = p.sekcje[0].okladka.wynik;
  assert.equal(w.grzbiet, 6.3); // 2,3 + 2 × 2
  assert.equal(w.szerokosc, 15 + 151 + 7 + 6.3 + 7 + 151 + 15);
  assert.equal(w.wysokosc, 210 + 6 + 30);
  assert.equal(w.gora, 15);
  assert.equal(w.dol, 231);
  assert.deepEqual(w.strefy.map((z) => z.rodzaj), ['zawiniecie_l', 'tyl', 'big_l', 'grzbiet', 'big_p', 'przod', 'zawiniecie_p']);
  assert.equal(p.sekcje[0].uklad, 'pojedyncze');

  // Liczba stron wpisana ręcznie – niezależna od stron w projekcie.
  ({ O, p } = await projektZOkladka('miekka', 4, { strony: { tryb: 'reczne', liczba: 200 }, papier: { tryb: 'grubosc', grubosc_mm: 0.1 } }));
  O.przeliczOkladki(p);
  assert.equal(p.sekcje[0].okladka.wynik.grzbiet, 10);
});

test('okładka: po dodaniu stron grzbiet rośnie – element grzbietu zostaje na środku, przód przesuwa się, tło się rozciąga', async () => {
  const { P, O, p } = await projektZOkladka('miekka', 46, { papier: { tryb: 'grubosc', grubosc_mm: 0.1 } });
  O.przeliczOkladki(p);
  const okl = p.strony[0];
  const w0 = p.sekcje[0].okladka.wynik;
  const sg = (w0.strefy[1].x1 + w0.strefy[1].x2) / 2;
  okl.obiekty = [
    { type: 'rect', id: 'tlo', left: -3, top: -3, width: w0.szerokosc + 6, height: 216, scaleX: 1, scaleY: 1 },
    { type: 'textbox', id: 'tytul', left: 180, top: 40, width: 100, height: 20 },
    { type: 'textbox', id: 'naGrzbiecie', left: sg + 1, top: 20, width: 150, height: 2, angle: 90 },
    { type: 'textbox', id: 'naTyle', left: 20, top: 150, width: 100, height: 20 },
    { type: 'rect', id: 'pasek', left: sg - 1, top: 0, width: 2, height: 210, okladka: 'grzbiet', okladka_dopasuj: true },
  ];
  const srodek = p.sekcje[1].id;
  for (let i = 0; i < 16; i += 1) p.strony.push(P.nowaStrona(`N${i}`, srodek));
  assert.deepEqual(O.przeliczOkladki(p), [p.sekcje[0].id]);
  const w1 = p.sekcje[0].okladka.wynik;
  assert.equal(w1.grzbiet, 3.1); // 62 strony → 31 kartek
  const o = Object.fromEntries(okl.obiekty.map((x) => [x.id, x]));
  assert.ok(Math.abs(o.tytul.left - (180 + 0.8)) < 1e-6, 'przód przesuwa się o różnicę grzbietu');
  assert.equal(o.naTyle.left, 20, 'tył zostaje');
  const ng = (w1.strefy[1].x1 + w1.strefy[1].x2) / 2;
  assert.ok(Math.abs(o.naGrzbiecie.left - (ng + 1)) < 1e-6, 'tekst grzbietu zostaje na środku grzbietu');
  assert.ok(Math.abs(o.tlo.width * o.tlo.scaleX - (w1.szerokosc + 6)) < 1e-6, 'tło rozciąga się na całą okładkę ze spadem');
  assert.equal(o.tlo.left, -3);
  assert.ok(Math.abs(o.pasek.width * o.pasek.scaleX - 3.1) < 1e-6, 'pasek dopasowany do szerokości grzbietu');
  assert.ok(Math.abs(o.pasek.left + 1.55 - ng) < 1e-6);
  assert.equal(p.sekcje[0].wydruk.szerokosc_mm, w1.szerokosc);
});

test('składki: bilans, opis i uwaga przed drukiem', async () => {
  const P = await modul('js/projekt.js');
  const O = await modul('js/okladka.js');
  const { rozwin } = await modul('js/serie.js');
  const p = P.nowyProjekt('Kalendarz');
  for (let i = 1; i < 46; i += 1) p.strony.push(P.nowaStrona(`S${i + 1}`, p.sekcje[0].id));
  p.sekcje[0].skladka = 16;
  const n = P.normalizuj(p);
  const b = O.bilansSkladki(n.sekcje[0], rozwin(n));
  assert.deepEqual(b, { stron: 46, skladka: 16, brakuje: 2, doPelnej: 48, skladek: 3 });
  assert.equal(O.opisSkladki(b), '46 z 48 – brakuje 2 do pełnej składki (×16)');
  assert.equal(O.opisSkladki({ stron: 48, skladka: 16, brakuje: 0, doPelnej: 48, skladek: 3 }), '48 stron – 3 pełne składki po 16');
  assert.equal(P.normalizuj({ ...n, sekcje: [{ ...n.sekcje[0], skladka: 12 }] }).sekcje[0].skladka, undefined, 'nieznana składka znika');
});

test('okładka w aplikacji: kreator z twardą okładką, schemat i wynik w oknie, przeliczenie po nowych stronach, „Zamień na okładkę”', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', 'Dziennik');
  await strona.evaluate(() => { const s = document.querySelector('#form-nowy select[name=okladka]'); s.value = 'twarda'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.sekcje.length === 2 && window.seriodruk.edytor?.wydruk);
  const sekcje = await strona.evaluate(() => window.seriodruk.stan.projekt.sekcje.map((s) => ({ nazwa: s.nazwa, okladka: s.okladka?.oprawa, w: s.wydruk.szerokosc_mm })));
  assert.deepEqual(sekcje.map((s) => s.nazwa), ['Okładka', 'Środek']);
  assert.equal(sekcje[0].okladka, 'twarda');
  const przed = sekcje[0].w;

  // Strony w środku: okładka przelicza się sama (grzbiet rośnie).
  await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const P = await import('./js/projekt.js');
    const srodek = stan.projekt.sekcje[1].id;
    for (let i = 0; i < 99; i += 1) stan.projekt.strony.push(P.nowaStrona(`S${i}`, srodek));
    (await import('./js/app/zapis.js')).zaplanujZapis();
  });
  await strona.waitForFunction((w) => window.seriodruk.stan.projekt.sekcje[0].wydruk.szerokosc_mm > w, przed);
  const wynik = await strona.evaluate(() => window.seriodruk.stan.projekt.sekcje[0].okladka.wynik);
  assert.equal(wynik.stron, 100);
  assert.ok(wynik.grzbiet > 9, `grzbiet ${wynik.grzbiet}`);

  // Okno ustawień okładki: schemat stref i wynik; zmiana papieru na grubość kartki 0,2 mm → szerszy grzbiet.
  await strona.evaluate(async () => (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(window.seriodruk.stan.projekt.sekcje[0].id));
  await strona.waitForSelector('#dlg-sekcja[open]');
  assert.equal(await strona.isVisible('#sekcja-okladka'), true);
  assert.equal(await strona.isVisible('#sekcja-format'), false, 'format okładki liczy się sam');
  assert.equal(await strona.locator('#schemat-okladki .strefa-okladki').count(), 7);
  assert.match(await strona.textContent('#wynik-okladki'), /Grzbiet .* mm · Okładka .* × .* mm/);
  await strona.click('#dlg-sekcja label:has-text("Grubość kartki")');
  await strona.fill('#dlg-sekcja input[name=ok_grubosc]', '0.2');
  await strona.waitForFunction(() => /Grzbiet 14 mm/.test(document.querySelector('#wynik-okladki').textContent));
  await strona.click('#zapisz-sekcje');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].okladka.wynik.grzbiet === 14);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.wydruk.okladka?.grzbiet), 14, 'edytor ma strefy okładki');

  // „Zamień na okładkę” na zwykłej sekcji: okno od razu z rodzajem okładki.
  await strona.evaluate(async () => (await import('./js/app/sekcje.js')).zamienNaOkladke(window.seriodruk.stan.projekt.sekcje[1].id));
  await strona.waitForSelector('#dlg-sekcja[open]');
  assert.equal(await strona.isVisible('#sekcja-okladka'), true);
  await strona.click('#dlg-sekcja .naglowek-dialogu [value=anuluj]');
  assert.deepEqual(bledy, []);
});

test('składki w aplikacji: licznik na liście stron, „Dopełnij pustymi” i cofnięcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz');
  await strona.evaluate(async () => (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(window.seriodruk.stan.projekt.sekcje[0].id));
  await strona.waitForSelector('#dlg-sekcja[open]');
  await strona.evaluate(() => { const s = document.querySelector('#dlg-sekcja select[name=skladka]'); s.value = '4'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.match(await strona.textContent('#opis-skladki'), /1 z 4 – brakuje 3/);
  await strona.click('#zapisz-sekcje');
  await strona.waitForSelector('.skladka-sekcji.brak');
  assert.match(await strona.textContent('.skladka-sekcji'), /1 z 4 – brakuje 3 do pełnej składki/);
  const uwagi = await strona.evaluate(async () => (await import('./js/kontrola.js')).sprawdzProjekt(window.seriodruk.stan.projekt).map((u) => u.opis).join(' | '));
  assert.match(uwagi, /do pełnej składki po 4 brakuje 3/, 'uwaga przed drukiem');
  await strona.click('.skladka-sekcji button');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 4);
  await strona.waitForFunction(() => !document.querySelector('.skladka-sekcji.brak') && /4 stron – 1 pełna składka/.test(document.querySelector('.skladka-sekcji')?.textContent));
  await strona.waitForTimeout(400);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 1);
  assert.deepEqual(bledy, []);
});

test('ostrzeżenia: linia od spadu do spadu nie „wychodzi poza spad”; na okładce – obszar bezpieczny tyłu i przodu, element szerszy niż grzbiet', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Linie');
  const typy = await strona.evaluate(() => {
    const { edytor } = window.seriodruk;
    const c = edytor.canvas;
    c.add(
      new fabric.Line([-3, 50, 151, 50], { id: 'l1', stroke: '#000', strokeWidth: 1.5 }), // pozioma, od spadu do spadu
      new fabric.Line([74, -3, 74, 213], { id: 'l2', stroke: '#000', strokeWidth: 1.5 }), // pionowa
      new fabric.Line([-4, 80, 152, 80], { id: 'l3', stroke: '#000', strokeWidth: 1 }), // naprawdę poza spadem
    );
    edytor.przeliczOstrzezenia();
    return Object.fromEntries(['l1', 'l2', 'l3'].map((id) => [id, edytor.ostrzezenia.filter((o) => o.id === id).map((o) => o.typ).join(',')]));
  });
  // #417: element puszczony na spad przechodzi przez margines świadomie – bez „wchodzi w margines”.
  assert.equal(typy.l1, '');
  assert.equal(typy.l2, '');
  assert.equal(typy.l3, 'poza_spadem');

  // Okładka miękka (A5, 1 strona środka → grzbiet 0,1 mm): tekst na przodzie w jego obszarze bezpiecznym – bez uwag;
  // szeroki pasek na grzbiecie – „szerszy niż grzbiet”.
  const okl = await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const P = await import('./js/projekt.js');
    const O = await import('./js/okladka.js');
    const ok = P.nowaSekcja('Okładka');
    ok.okladka = O.normalizujOkladke({ oprawa: 'miekka', strony: { tryb: 'reczne', liczba: 80 }, papier: { tryb: 'grubosc', grubosc_mm: 0.1 } });
    stan.projekt.sekcje.unshift(ok);
    const s = P.nowaStrona('Okładka', ok.id);
    stan.projekt.strony.unshift(s);
    O.przeliczOkladki(stan.projekt);
    s.obiekty = [
      { type: 'textbox', id: 'przod', text: 'Tytuł', left: 170, top: 30, width: 100, fontSize: 5 },
      { type: 'rect', id: 'grzbiet', left: 146, top: 30, width: 8, height: 100, fill: '#000' },
    ];
    stan.indeks = 0;
    await (await import('./js/app/zapis.js')).zaladujCel({ dopasuj: true });
    edytor.przeliczOstrzezenia();
    return { w: edytor.wydruk.szerokosc_mm, typy: edytor.ostrzezenia.map((o) => `${o.id}:${o.typ}`) };
  });
  assert.equal(okl.w, 300);
  assert.ok(!okl.typy.some((x) => x.startsWith('przod:')), okl.typy.join(' '));
  assert.ok(okl.typy.includes('grzbiet:szerszy_niz_grzbiet'), okl.typy.join(' '));
  assert.deepEqual(bledy, []);
});

test('okładka zapisana spoza aplikacji (strefy jako obiekt, np. przez AI): projekt się otwiera, wymiary i elementy zostają (#141)', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Okładka od AI');
  const w = await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = JSON.parse(JSON.stringify(window.seriodruk.stan.projekt));
    const srodek = p.sekcje[0];
    const ok = P.nowaSekcja('Okładka', { ...srodek.wydruk, szerokosc_mm: 357.4, wysokosc_mm: 240.2, format: 'wlasny' });
    ok.okladka = {
      oprawa: 'twarda', zawiniecie_mm: 15, big_mm: 7, naddatek_mm: 3, tektura_mm: 2, srodek: [srodek.id],
      papier: { tryb: 'gramatura', rodzaj: 'offset', gramatura: 80, grubosc_mm: 0.1 }, strony: { tryb: 'auto', liczba: 0 },
      wymiary: { tryb: 'auto', grzbiet_mm: 0, szerokosc_mm: 0, wysokosc_mm: 0 },
      wynik: { gora: 12.1, dol: 228.1, zawiniecie_l: { x1: 0, x2: 15 }, tyl: { x1: 15, x2: 166 }, big_l: { x1: 166, x2: 166 }, grzbiet: { x1: 166, x2: 191.4 }, big_p: { x1: 191.4, x2: 191.4 }, przod: { x1: 191.4, x2: 342.4 }, zawiniecie_p: { x1: 342.4, x2: 357.4 } },
    };
    p.sekcje.unshift(ok);
    const s = P.nowaStrona('Okładka', ok.id);
    s.obiekty = [{ type: 'textbox', id: 'tytul', left: 250, top: 60, width: 60, text: 'Tytuł', fontFamily: 'Inter', fontSize: 6, styles: [] }];
    p.strony.unshift(s);
    const z = await import('./js/app/zapis.js');
    await z.otworzProjekt(P.normalizuj(p));
    const q = window.seriodruk.stan.projekt;
    const o = q.strony[0].obiekty.find((x) => x.id === 'tytul');
    return { wym: [q.sekcje[0].wydruk.szerokosc_mm, q.sekcje[0].wydruk.wysokosc_mm], grzbiet: q.sekcje[0].okladka.wynik.grzbiet, poz: [o.left, o.top] };
  });
  assert.deepEqual(w.wym, [357.4, 240.2]);
  assert.equal(w.grzbiet, 25.4);
  assert.deepEqual(w.poz, [250, 60], 'elementy okładki nie przesunęły się');
  assert.deepEqual(bledy, []);
});

test('przejście na okładkę zaraz po dodaniu stron w środku pokazuje okładkę już przeliczoną (#144)', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Okładka na bieżąco');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const { normalizujOkladke } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    const ok = P.nowaSekcja('Okładka', { ...p.sekcje[0].wydruk });
    ok.okladka = normalizujOkladke({ oprawa: 'miekka', srodek: [p.sekcje[0].id] });
    p.sekcje.unshift(ok);
    p.strony.unshift(P.nowaStrona('Okładka', ok.id));
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  });
  const szerokosc = () => strona.evaluate(() => window.seriodruk.edytor.wydruk.szerokosc_mm);
  const naOkladce = () => strona.evaluate(async () => (await import('./js/app/lista-stron.js')).przejdzDoStrony(0));
  await naOkladce();
  const przed = await szerokosc();
  // Środek: 40 nowych stron, od razu (bez czekania na przeliczenie w tle) przejście na okładkę.
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const { przejdzDoStrony } = await import('./js/app/lista-stron.js');
    const p = window.seriodruk.stan.projekt;
    await przejdzDoStrony(1);
    for (let i = 0; i < 40; i += 1) p.strony.push(P.nowaStrona(`S${i}`, p.sekcje[1].id));
    await przejdzDoStrony(0);
  });
  const po = await szerokosc();
  assert.ok(po > przed + 1, `grzbiet urósł od razu: ${przed} → ${po}`);
  assert.deepEqual(bledy, []);
});
