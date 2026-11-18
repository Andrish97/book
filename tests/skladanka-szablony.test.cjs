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
        const r = K.ramkaCzesci({ ...n, krawedzie: n.krawedzie.map(() => ({ typ: 'ciecie' })) });
        return { nazwa: c.nazwa, sciany: K.scianyCzesci(n).sciany.length, pary: Object.values(pary).every((l) => l.length === 2 && Math.abs(l[0] - l[1]) < 0.05), w: Math.round(r.w * 100) / 100, h: Math.round(r.h * 100) / 100, szczeliny: n.szczeliny.map((z) => z.szer) };
      });
    }
    return wynik;
  });
  const sciany = Object.fromEntries(Object.entries(geo).map(([k, l]) => [k, l.map((c) => c.sciany)]));
  assert.deepEqual(sciany, { prostopadloscian: [6], tacka: [5], pudelko: [5, 5], graniastoslup: [8], ostroslup: [5], przegrodki: [1, 1] });
  for (const [k, l] of Object.entries(geo)) for (const c of l) assert.ok(c.pary, `${k}/${c.nazwa}: każda para – dwie krawędzie tej samej długości`);
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
  assert.deepEqual(bledy, []);
});
