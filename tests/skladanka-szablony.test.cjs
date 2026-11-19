// Szablony składanek (#237): siatki z parametrami – każda para łączy dwie krawędzie równej długości, liczba ścian
// się zgadza; wieczko większe od pudełka o 2 × grubość materiału + luz, przegródki ze szczelinami grubość + luz;
// wstawienie z okna „Szablon” w sekcji składanki (wolne numery par i litery części), rozłożenie i kontrola bez uwag.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('szablony składanek: geometria, kompensacja grubości, okno, rozłożenie bez uwag', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Pudełka');
  const geo = await strona.evaluate(async () => {
    const S = await import('./js/skladanka-szablony.js');
    const K = await import('./js/skladanka.js');
    const wynik = {};
    for (const k of Object.keys(S.SZABLONY_SKLADANEK)) {
      wynik[k] = S.czesciSzablonu(k, {}, 0.4).map((c) => {
        const n = K.normalizujCzesc(c);
        const dl = (i) => Math.hypot(n.punkty[(i + 1) % n.punkty.length].x - n.punkty[i].x, n.punkty[(i + 1) % n.punkty.length].y - n.punkty[i].y);
        const pary = {};
        n.krawedzie.forEach((e, i) => { if (e.para) (pary[e.para] ||= []).push(dl(i)); });
        wynik.dlugosci ||= {};
        for (const [para, l] of Object.entries(pary)) (wynik.dlugosci[`${k}:${para}`] ||= []).push(...l);
        const r = K.ramkaCzesci({ ...n, krawedzie: n.krawedzie.map(() => ({ typ: 'ciecie' })) });
        return { nazwa: c.nazwa, sciany: K.scianyCzesci(n).sciany.length, pary: Object.values(pary).every((l) => l.length === 2 && Math.abs(l[0] - l[1]) < 0.05), w: Math.round(r.w * 100) / 100, h: Math.round(r.h * 100) / 100, szczeliny: n.szczeliny.map((z) => z.szer) };
      });
    }
    return wynik;
  });
  const { dlugosci } = geo;
  delete geo.dlugosci;
  const PROSTE = ['prostopadloscian', 'tacka', 'pudelko', 'graniastoslup', 'ostroslup', 'przegrodki'];
  const sciany = Object.fromEntries(PROSTE.map((k) => [k, geo[k].map((c) => c.sciany)]));
  assert.deepEqual(sciany, { prostopadloscian: [6], tacka: [5], pudelko: [5, 5], graniastoslup: [8], ostroslup: [5], przegrodki: [1, 1] });
  for (const k of PROSTE) for (const c of geo[k]) assert.ok(c.pary, `${k}/${c.nazwa}: każda para – dwie krawędzie tej samej długości`);
  // Gotowe modele z sylwetki (#265): rozłożone automatycznie – pary 1:1 równej długości, ściany jak bryła.
  for (const k of ['domek', 'samochod', 'pudelko_klapa']) for (const c of geo[k]) assert.ok(c.pary, `${k}/${c.nazwa}: pary`);
  // Pudełko z klapą wsuwaną (#268): 6 ścian, język na wieku, bez par do wieka.
  assert.equal(geo.pudelko_klapa[0].sciany, 6);
  const klapa = await strona.evaluate(async () => (await import('./js/skladanka-szablony.js')).czesciSzablonu('pudelko_klapa', {})[0].krawedzie);
  assert.equal(klapa.filter((k) => k.typ === 'wypustka').length, 1);
  assert.equal(new Set(klapa.filter((k) => k.para).map((k) => k.para)).size, 4, 'szew i trzy brzegi dna');
  // Zatrzask (#271): język w parze ze szczeliną szeroką na grubość materiału (0,4) + 0,2 mm luzu.
  const zatrzask = await strona.evaluate(async () => (await import('./js/skladanka-szablony.js')).czesciSzablonu('pudelko_zatrzask', {}, 0.4)[0]);
  const jezyk = zatrzask.krawedzie.find((k) => k.typ === 'wypustka');
  assert.equal(zatrzask.szczeliny[0].para, jezyk.para);
  assert.equal(zatrzask.szczeliny[0].szer, 0.6);
  // Wazon 12 segmentów: dno + 4 pasy po 12 ścian (płaska ściana przecięta między części liczy się w każdej z nich).
  assert.ok(geo.wazon.reduce((a, c) => a + c.sciany, 0) >= 1 + 4 * 12);
  assert.deepEqual(geo.domek.map((c) => c.sciany), [7]);
  assert.deepEqual(geo.samochod.map((c) => c.sciany), [12]);
  // Żółw (#276): skorupa, głowa, 4 łapy (po 6 ścian), ogon (4 ściany).
  assert.ok(geo.zolw.length >= 7);
  assert.equal(geo.zolw.filter((c) => c.sciany === 6).length, 5, 'głowa i łapy');
  // Bryły o krzywych (#261): para łączy wiele krótkich krawędzi – po obu stronach te same długości (zakładki na
  // łuku płaszcza ↔ boki koła dna); różnice tylko z zaokrąglenia punktów do 0,01 mm.
  for (const k of ['walec', 'stozek', 'stozek_sciety', 'kula', 'wazon', 'zolw']) {
    for (const [klucz, l] of Object.entries(dlugosci).filter(([x]) => x.startsWith(`${k}:`))) {
      // Każda długość ma swoją parę po drugiej stronie szwu (kliny kuli – różne długości wzdłuż południka).
      const p = [...l].sort((x, y) => x - y);
      assert.ok(p.length % 2 === 0 && p.every((v, i) => i % 2 === 1 || Math.abs(p[i + 1] - v) < 0.05), `${klucz}: ${l.length} krawędzi bez par długości`);
    }
  }
  assert.deepEqual(geo.walec.map((c) => c.sciany), [1, 1, 1]);
  // Kula Ø80 z 8 klinów: klin długi na pół obwodu (π · 40), najszerszy na równiku (2π · 40 / 8).
  assert.equal(geo.kula.length, 8);
  assert.ok(Math.abs(geo.kula[0].h - Math.PI * 40) < 0.05, `długość klinu ${geo.kula[0].h}`);
  assert.ok(Math.abs(geo.kula[0].w - (2 * Math.PI * 40) / 8) < 0.05, `szerokość klinu ${geo.kula[0].w}`);
  // Walec Ø50 × 80: płaszcz ma obwód wielokąta podstawy (≈ π · 50) i wysokość 80.
  assert.ok(Math.abs(geo.walec[0].w - Math.PI * 50) < 0.2, `obwód ${geo.walec[0].w}`);
  assert.equal(geo.walec[0].h, 80);
  // Pop-up: kartka 200 × 140 bez zakładek, dwa pudełka – po 2 nacięcia i 5 + 6 zgięć; nacięcia nie dochodzą do brzegu.
  assert.deepEqual([geo.popup[0].w, geo.popup[0].h, geo.popup[0].szczeliny.length], [200, 140, 4]);
  const pop = await strona.evaluate(async () => (await import('./js/skladanka-szablony.js')).czesciSzablonu('popup', { szerokosc: 60, glebokosc: 80 })[0]);
  assert.ok(pop.szczeliny.every((z) => Math.min(z.a.x, z.b.x) >= 5 && Math.max(z.a.x, z.b.x) <= 115), 'za głębokie pudełko skrócone – po zamknięciu nic nie wystaje');
  assert.equal(pop.zgiecia.filter((z) => z.rodzaj === 'gora').length, 2, 'grzbiet odwrócony na każdym pudełku');
  // Pop-up z platformą (#269): pasek długości y + h = odległość pól przez grzbiet (leży płasko po otwarciu na 180°).
  const pl = await strona.evaluate(async () => (await import('./js/skladanka-szablony.js')).czesciSzablonu('popup_platforma', {}));
  const [karta, pasek, pasek2] = pl;
  // Druga warstwa: tak samo – pasek 2 = odległość pól na pierwszym pasku przez jego zgięcie.
  const zg1 = pasek.zgiecia[0].a.x;
  const [q1, q2] = pasek.pola;
  assert.ok(Math.abs((q1.x - zg1) + (zg1 - (q2.x + q2.w)) - pasek2.punkty[1].x) < 0.05, 'druga warstwa leży płasko po otwarciu');
  assert.equal((await strona.evaluate(async () => (await import('./js/skladanka-szablony.js')).czesciSzablonu('popup_platforma', { warstwy: 1 }))).length, 2);
  const S = karta.punkty[1].x / 2;
  const [pl1, pl2] = karta.pola;
  assert.ok(Math.abs((S - (pl1.x + pl1.w)) + (pl2.x - S) - pasek.punkty[1].x) < 0.05, 'pasek = odległość pól przez grzbiet');
  assert.deepEqual(pasek.krawedzie.filter((k) => k.para).map((k) => k.para).sort(), ['l', 'p']);
  assert.deepEqual(pasek2.krawedzie.filter((k) => k.para).map((k) => k.para).sort(), ['l2', 'p2']);
  assert.deepEqual(karta.pola.map((x) => x.para).sort(), ['l', 'p']);
  // Zgięcie V (#272): pola skośne od punktu na grzbiecie, długość = ramię trójkąta, kąt trójkąta = kąt pól.
  const v = await strona.evaluate(async () => {
    const [k, t] = (await import('./js/skladanka-szablony.js')).czesciSzablonu('popup_v', { kat: 40 });
    const { rogiPola } = await import('./js/skladanka.js');
    return { pola: k.pola.map((x) => ({ w: x.w, r: rogiPola(x) })), t, S: k.punkty[1].x / 2 };
  });
  const ramie = Math.hypot(v.t.punkty[2].x - v.t.punkty[0].x, v.t.punkty[2].y - v.t.punkty[0].y);
  for (const p of v.pola) assert.ok(Math.abs(p.w - ramie) < 0.05, 'pole = ramię');
  // Pola na zewnątrz linii: lewe całe na lewej połowie, prawe na prawej – nic nie przechodzi przez grzbiet.
  assert.ok(v.pola[0].r.every((q) => q.x <= v.S + 0.01), 'lewe pole po lewej');
  assert.ok(v.pola[1].r.every((q) => q.x >= v.S - 0.01), 'prawe pole po prawej');
  // Linie pól spotykają się na grzbiecie (punkt P) pod kątem 40° do grzbietu.
  const L0 = v.pola[0].r;
  const kat = (Math.atan2(Math.abs(L0[1].x - L0[0].x), Math.abs(L0[1].y - L0[0].y)) * 180) / Math.PI;
  assert.ok(Math.abs(kat - 40) < 0.1, `kąt linii ${kat}`);
  assert.ok(Math.abs(L0[1].x - v.S) < 0.01 && Math.abs(v.pola[1].r[0].x - v.S) < 0.01, 'linie zaczynają się na grzbiecie');
  // Pudełko 100 × 70 × 40, wieczko 15: siatka dna 100 + 2 × 40; wieczka (100 + 2 × 0,4 + 0,5) + 2 × 15.
  assert.deepEqual([geo.pudelko[0].w, geo.pudelko[0].h], [180, 150]);
  assert.deepEqual([geo.pudelko[1].w, geo.pudelko[1].h], [131.3, 101.3]);
  // Przegródki: krótsze o 2 × grubość, niższe o grubość, szczeliny 0,4 + 0,2.
  assert.deepEqual(geo.przegrodki.map((c) => [c.w, c.h, c.szczeliny]), [[99.2, 39.6, [0.6]], [69.2, 39.6, [0.6]]]);

  // Okno w aplikacji: sekcja składanki A4 poziomo, karton 300 g (0,39 mm); pudełko z wieczkiem.
  await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A4', orientacja: 'pozioma', material: 'karton', gramatura: 300 } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
  });
  await strona.click('[data-akcja="skladanka-szablon"]');
  await strona.waitForSelector('#dlg-szablon-skladanki[open]');
  await strona.selectOption('#dlg-szablon-skladanki select[name="szablon"]', 'pudelko');
  assert.match(await strona.textContent('#dlg-szablon-skladanki .grubosc-szablonu'), /0,39 mm/);
  await strona.fill('#dlg-szablon-skladanki input[name="p_dlugosc"]', '80');
  await strona.click('#dlg-szablon-skladanki button[value="tak"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.czesc).length === 2);
  const wstawione = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.czesc).map((o) => [o.czesc.nr, o.nazwa, o.czesc.krawedzie.filter((k) => k.para).map((k) => k.para).sort((a, b) => a - b).join(',')]));
  assert.deepEqual(wstawione, [['A', 'Część A – Pudełko', '1,1,2,2,3,3,4,4'], ['B', 'Część B – Wieczko', '5,5,6,6,7,7,8,8']]);
  const po = await strona.evaluate(async () => {
    await window.seriodruk.zapiszTeraz();
    document.querySelector('[data-akcja="skladanka-rozloz"]').click();
    await new Promise((ok) => setTimeout(ok, 600));
    const p = window.seriodruk.stan.projekt;
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { rozwin } = await import('./js/serie.js');
    return { uwagi: sprawdzProjekt(p, rozwin(p)).filter((u) => u.rodzaj === 'skladanka').map((u) => u.opis), arkuszy: p.strony.length };
  });
  assert.deepEqual(po.uwagi, [], 'pudełko i wieczko: pary pełne, nic poza arkuszem, nic na sobie');
  assert.equal(po.arkuszy, 1, 'oba na jednym arkuszu A4');

  // Walec, stożek ścięty i kartka pop-up (#261): wstawione, rozłożone – kontrola bez uwag (szwy po łuku to pary
  // wielu krawędzi), panel połączeń pokazuje szew w jednej linii.
  for (const k of ['walec', 'stozek_sciety', 'popup', 'kula', 'domek', 'wazon', 'pudelko_klapa', 'popup_platforma', 'pudelko_zatrzask', 'popup_v', 'zolw']) {
    await strona.click('[data-akcja="skladanka-szablon"]');
    await strona.waitForSelector('#dlg-szablon-skladanki[open]');
    await strona.selectOption('#dlg-szablon-skladanki select[name="szablon"]', k);
    if (k === 'walec') await strona.fill('#dlg-szablon-skladanki input[name="p_wysokosc"]', '50');
    await strona.click('#dlg-szablon-skladanki button[value="tak"]');
    await strona.waitForFunction(() => !document.querySelector('#dlg-szablon-skladanki').open);
  }
  const krzywe = await strona.evaluate(async () => {
    await window.seriodruk.zapiszTeraz();
    document.querySelector('[data-akcja="skladanka-rozloz"]').click();
    await new Promise((ok) => setTimeout(ok, 800));
    const p = window.seriodruk.stan.projekt;
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { rozwin } = await import('./js/serie.js');
    return sprawdzProjekt(p, rozwin(p)).filter((u) => u.rodzaj === 'skladanka' && !/poza arkusz|wchodzi w margines|nachodzą/.test(u.opis)).map((u) => u.opis);
  });
  assert.deepEqual(krzywe, [], 'szwy po łuku bez uwag');
  assert.deepEqual(bledy, []);
});
