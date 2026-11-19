// Treść ścian składanki (#284, plan składanek krok 15): tekst, obraz, ozdobnik położony na części wchodzi na jej
// ścianę (dziecko grupy części, pole na_czesci) – jedzie z nią przy przebudowie, przesunięciu, obrocie, zapisie,
// [Rozłóż] i [Rozetnij]; można go wyjąć z powrotem na stronę.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('treść ścian: Na część → jedzie z częścią; zapis, Rozłóż, Rozetnij, Wyjmij', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Treść ścian');
  await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A4', orientacja: 'pozioma', material: 'karton', gramatura: 300, druk: 'ploter' } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
    const n = await import('./js/app/skladanka-narzedzia.js');
    n.wstawCzesci([{ nazwa: 'Pas', punkty: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 0, y: 40 }], krawedzie: Array(4).fill({ typ: 'ciecie' }), zgiecia: [{ a: { x: 50, y: 0 }, b: { x: 50, y: 40 }, rodzaj: 'gora', kat: 90 }] }]);
    // Napis na lewej ścianie (środek w punkcie części 25, 20) – zaznaczony.
    const e = window.seriodruk.edytor;
    const S = await import('./js/skladanka.js');
    const g = e.canvas.getObjects().find((o) => o.czesc);
    const sr = S.zUkladuCzesci(g, { x: 25, y: 20 });
    const tx = e.dodajTekst();
    tx.set({ text: 'Okno', fontSize: 6, originX: 'center', originY: 'center', left: sr.x, top: sr.y, angle: 0 });
    tx.setCoords();
    e.canvas.setActiveObject(tx);
  });
  await strona.click('[data-akcja="skladanka-na-czesc"]');
  // Położenie napisu w układzie części, liczba elementów na stronie i kąt napisu względem strony.
  const stan = () => strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const S = await import('./js/skladanka.js');
    const czesci = e.canvas.getObjects().filter((o) => o.czesc);
    const zTrescia = czesci.find((g) => S.trescCzesci(g).length);
    const t0 = zTrescia && S.trescCzesci(zTrescia)[0];
    return {
      czesci: czesci.length,
      luzne: e.canvas.getObjects().filter((o) => !o.czesc && o.type === 'textbox').length,
      tekst: t0?.obj.text,
      lokalnie: t0 && { x: Math.round(t0.x * 10) / 10, y: Math.round(t0.y * 10) / 10 },
      kat: t0 && Math.round(((t0.obj.angle || 0) + (zTrescia.angle || 0)) % 360),
      nr: zTrescia?.czesc.nr,
    };
  });
  let s = await stan();
  assert.deepEqual([s.czesci, s.luzne, s.tekst, s.lokalnie], [1, 0, 'Okno', { x: 25, y: 20 }], JSON.stringify(s));

  // Przebudowa (kolor), przesunięcie i obrót części – napis zostaje w tym samym miejscu ściany i obraca się z nią.
  await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const n = await import('./js/app/skladanka-narzedzia.js');
    let g = e.canvas.getObjects().find((o) => o.czesc);
    g = n.zmienCzesc(g, (d) => { d.kolor = '#ffeecc'; });
    g.set({ left: g.left + 30, top: g.top + 15, angle: 90 });
    g.setCoords();
    n.zmienCzesc(g, (d) => { d.zgiecia[0].kat = 120; });
  });
  s = await stan();
  assert.deepEqual([s.lokalnie, s.kat], [{ x: 25, y: 20 }, 90], 'po przebudowie, przesunięciu i obrocie');

  // Zapis i ponowne wczytanie strony – napis nadal na ścianie.
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.czesc));
  s = await stan();
  assert.deepEqual([s.luzne, s.tekst, s.lokalnie], [0, 'Okno', { x: 25, y: 20 }], 'po wczytaniu');

  // Rozłóż: część jedzie na arkusz razem z napisem; prostokąt leżący w całości na części wchodzi na nią sam.
  await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const S = await import('./js/skladanka.js');
    const g = e.canvas.getObjects().find((o) => o.czesc);
    const sr = S.zUkladuCzesci(g, { x: 75, y: 20 });
    const r = e.dodajProstokat();
    r.set({ width: 8, height: 8, originX: 'center', originY: 'center', left: sr.x, top: sr.y, angle: 0 });
    r.setCoords();
  });
  await strona.click('[data-akcja="skladanka-rozloz"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.czesc).some((g) => g.getObjects().filter((x) => x.na_czesci).length === 2), null, { timeout: 8000 });
  s = await stan();
  assert.deepEqual([s.luzne, s.lokalnie], [0, { x: 25, y: 20 }], 'po Rozłóż');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'rect' && !o.czesc).length), 0, 'prostokąt na ścianie');

  // Rozetnij w x = 50: napis do lewego kawałka, prostokąt do prawego.
  await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const S = await import('./js/skladanka.js');
    const n = await import('./js/app/skladanka-narzedzia.js');
    const g = e.canvas.getObjects().find((o) => o.czesc);
    const c = S.normalizujCzesc(g.czesc);
    const [a, b] = S.rozetnijCzesc(c, { x: 60, y: 0 }, { x: 60, y: 40 }, '9');
    const tresc = S.trescCzesci(g);
    const t2 = tresc.filter((x) => S.wWielokacie(b.punkty, x));
    const druga = S.zbudujCzesc({ ...structuredClone(g.czesc), ...b, nr: 'B' }, { grupa: g, tresc: t2 });
    n.zmienCzesc(g, (d) => Object.assign(d, a), { tresc: tresc.filter((x) => !t2.includes(x)) });
    e.canvas.add(druga);
  });
  const podzial = await strona.evaluate(async () => {
    const S = await import('./js/skladanka.js');
    return window.seriodruk.edytor.canvas.getObjects().filter((o) => o.czesc).map((g) => S.trescCzesci(g).map((x) => x.obj.type).join()).sort();
  });
  assert.deepEqual(podzial, ['rect', 'textbox']);

  // Wyjmij: napis wraca na stronę jako zwykły element w tym samym miejscu.
  const wyjety = await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const S = await import('./js/skladanka.js');
    const n = await import('./js/app/skladanka-narzedzia.js');
    const g = e.canvas.getObjects().find((o) => o.czesc && S.trescCzesci(o).some((x) => x.obj.type === 'textbox'));
    const przed = S.zUkladuCzesci(g, S.trescCzesci(g)[0]);
    const w = n.wyjmijZCzesci(g);
    const tx = w.obiekty[0];
    const p = tx.getCenterPoint();
    return { naStronie: e.canvas.getObjects().includes(tx), na_czesci: tx.na_czesci, ruch: Math.hypot(p.x - przed.x, p.y - przed.y), tresc: S.trescCzesci(w.czesc).length };
  });
  assert.deepEqual([wyjety.naStronie, wyjety.na_czesci, wyjety.tresc], [true, undefined, 0]);
  assert.ok(wyjety.ruch < 0.05, `napis w tym samym miejscu (${wyjety.ruch})`);
  assert.deepEqual(bledy, []);
});
