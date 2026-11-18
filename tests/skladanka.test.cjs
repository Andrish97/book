// Tryb składanek (#233): sekcja „Składanka / wycinanka” – arkusz, materiał z grubością z gramatury, druk domowy
// albo drukarnia; narzędzia tylko w tej sekcji; część modelu: nowa, z kształtu, zgięcie (dwa kliknięcia na
// krawędziach), połączenie krawędzi dwóch części jednym numerem pary (zakładka ↔ krawędź do sklejenia, albo
// zakładka ↔ miejsce klejenia), miejsce klejenia, szczelina o szerokości grubości materiału + luz; panel części;
// zapis i odczyt projektu; linie dla plotera (cięcie, big, klej) z części.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('składanka: sekcja z materiałem, narzędzia, części, zgięcie, połączenie, klej, szczelina, ploter', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Domek z kartonu');
  // Sekcja: model w kodzie (jak okno sekcji) – arkusz A4 poziomo, karton 300 g.
  const sekcja = await strona.evaluate(async () => {
    const S = await import('./js/sekcje-specjalne.js');
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    const s = p.sekcje[0];
    s.typ = 'skladanka';
    s.specjalna = { rodzaj: 'skladanka', arkusz: 'A4', orientacja: 'pozioma', material: 'karton', gramatura: 300 };
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
    const domowy = S.opisSpecjalnej(s);
    const tektura = S.normalizujSpecjalna({ rodzaj: 'skladanka', material: 'tektura', grubosc_mm: 2, druk: 'drukarnia' });
    return { w: s.wydruk.szerokosc_mm, h: s.wydruk.wysokosc_mm, grubosc: s.specjalna.grubosc_mm, typ: S.typSekcji(s), domowy, tektura: [tektura.grubosc_mm, tektura.margines_mm] };
  });
  assert.deepEqual([sekcja.w, sekcja.h], [297, 210], 'A4 poziomo');
  assert.equal(sekcja.grubosc, 0.39, 'karton 300 g/m² ≈ 0,39 mm');
  assert.equal(sekcja.typ, 'skladanka');
  assert.match(sekcja.domowy, /druk domowy/);
  assert.deepEqual(sekcja.tektura, [2, 0], 'tektura – grubość wpisana; drukarnia bez marginesu drukarki');
  assert.equal(await strona.locator('[data-akcja="skladanka-czesc"]').isVisible(), true, 'narzędzia składanki widać w jej sekcji');

  // Dwie części: A (nowa) i B (z prostokąta).
  await strona.click('[data-akcja="skladanka-czesc"]');
  const poz = await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const a = e.aktywny;
    a.set({ left: 20, top: 30 }); a.setCoords();
    const r = e.dodajProstokat();
    r.set({ left: 120, top: 30, width: 60, height: 40, angle: 0 }); r.setCoords();
    e.canvas.setActiveObject(r);
    return { a: a.czesc.nr, x0: e.strony[e.aktywna].x };
  });
  await strona.click('[data-akcja="skladanka-z-ksztaltu"]');
  const czesci = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.czesc).map((o) => [o.czesc.nr, o.czesc.punkty.length]));
  assert.deepEqual(czesci, [['A', 4], ['B', 4]]);
  assert.equal(poz.a, 'A');

  // Klik w punkt strony (mm) przez prawdziwe zdarzenie myszy.
  const kliknij = async (x, y, shift = false) => {
    const p = await strona.evaluate(([mx, my]) => {
      const e = window.seriodruk.edytor;
      const v = e.canvas.viewportTransform;
      const r = e.canvas.upperCanvasEl.getBoundingClientRect();
      const X = e.strony[e.aktywna].x + mx;
      return { x: r.left + X * v[0] + v[4], y: r.top + my * v[3] + v[5] };
    }, [x, y]);
    if (shift) await strona.keyboard.down('Shift');
    await strona.mouse.click(p.x, p.y);
    if (shift) await strona.keyboard.up('Shift');
  };
  const czesc = (nr) => strona.evaluate((n) => JSON.parse(JSON.stringify(window.seriodruk.edytor.canvas.getObjects().find((o) => o.czesc?.nr === n).czesc)), nr);

  // Zgięcie w A: od górnej do dolnej krawędzi, x = 30 części (strona: 20 + 30 = 50 mm, zakładek jeszcze brak).
  await strona.click('[data-akcja="skladanka-zgiecie"]');
  await kliknij(50, 30);
  await kliknij(50, 70);
  let a = await czesc('A');
  assert.equal(a.zgiecia.length, 1, 'zgięcie dodane');
  assert.deepEqual([Math.round(a.zgiecia[0].a.x), Math.round(a.zgiecia[0].b.x)], [30, 30]);
  // Linia po krawędzi nie dzieli części – odmowa.
  await kliknij(20, 30);
  await kliknij(20, 70);
  assert.equal((await czesc('A')).zgiecia.length, 1, 'zgięcie po krawędzi odrzucone');
  await strona.keyboard.press('Escape');

  // Połącz: prawa krawędź A (x = 80) ↔ lewa krawędź B (x = 120) – para „1”.
  await strona.click('[data-akcja="skladanka-polacz"]');
  await kliknij(80, 50);
  await kliknij(120, 50);
  a = await czesc('A');
  let b = await czesc('B');
  const kA = a.krawedzie.find((k) => k.para === '1');
  const kB = b.krawedzie.find((k) => k.para === '1');
  assert.equal(kA?.typ, 'zakladka', 'A dostaje zakładkę');
  assert.equal(kB?.typ, 'klej', 'B – krawędź do sklejenia');
  // Druga para: górna krawędź B (y = 30, B przesunięta o nic) ↔ miejsce na ścianie A.
  await kliknij(150, 30);
  await kliknij(35, 50);
  a = await czesc('A');
  b = await czesc('B');
  assert.equal(b.krawedzie.find((k) => k.para === '2')?.typ, 'zakladka');
  // Miejsce: długość krawędzi (60 − 2), ale nie szersze niż ściana (lewa ściana A: 30 mm – 2 × 1 mm zapasu) i w niej.
  const pole2 = a.pola.find((x) => x.para === '2');
  assert.deepEqual([pole2?.x, pole2?.w], [1, Math.round((a.zgiecia[0].a.x - 2) * 100) / 100], 'miejsce klejenia w ścianie, w którą kliknięto');
  await strona.keyboard.press('Escape');

  // Szczelina w B: szerokość = grubość 0,39 + luz 0,2.
  await strona.click('[data-akcja="skladanka-szczelina"]');
  await kliknij(140, 45);
  await kliknij(160, 45);
  b = await czesc('B');
  assert.equal(b.szczeliny.length, 1);
  assert.equal(b.szczeliny[0].szer, 0.59);
  await strona.keyboard.press('Escape');

  // Panel części: krawędzie z numerem pary, zgięcia.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.setActiveObject(e.canvas.getObjects().find((o) => o.czesc?.nr === 'A')); e.canvas.fire('selection:created', {}); });
  await strona.waitForFunction(() => document.querySelector('#tytul-wlasciwosci')?.textContent === 'Część A');
  const panel = await strona.evaluate(() => [...document.querySelectorAll('#wlasciwosci legend')].map((h) => h.textContent.trim()));
  for (const s of ['Część', 'Krawędzie', 'Zgięcia', 'Miejsca klejenia']) assert.ok(panel.some((x) => x.startsWith(s)), `panel: ${s} (${panel.join(' | ')})`);

  // Zapis i odczyt strony; linie dla plotera z części.
  const po = await strona.evaluate(async () => {
    await window.seriodruk.zapiszTeraz();
    await window.seriodruk.przeladuj();
    const p = window.seriodruk.stan.projekt;
    const zapisane = p.strony[0].obiekty.filter((o) => o.czesc).map((o) => [o.czesc.nr, o.czesc.zgiecia.length, o.czesc.pola.length, o.czesc.szczeliny.length]);
    const { rozwin } = await import('./js/serie.js');
    const { svgPlotera } = await import('./js/ploter.js');
    const ciag = rozwin(p);
    const w = await svgPlotera(p, ciag.egzemplarze[0], { ciag });
    const naPlotnie = window.seriodruk.edytor.canvas.getObjects().filter((o) => o.czesc).map((o) => [o.czesc.nr, o.lockScalingX]);
    return { zapisane, ile: w?.ile, naPlotnie };
  });
  assert.deepEqual(po.zapisane, [['A', 1, 1, 0], ['B', 0, 0, 1]]);
  assert.deepEqual(po.naPlotnie, [['A', true], ['B', true]], 'części po wczytaniu nie skalują się');
  assert.ok(po.ile.ciecie >= 3, `cięcie: obrysy części i szczelina (${JSON.stringify(po.ile)})`);
  assert.ok(po.ile.big >= 3, 'big: zgięcie i nasady zakładek');
  assert.ok(po.ile.klej >= 1, 'klej: miejsce klejenia');

  // Poza sekcją składanki narzędzi nie widać.
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    const s = P.nowaSekcja('Zwykła');
    p.sekcje.push(s);
    p.strony.push(P.nowaStrona('Zwykła', s.id));
    await window.seriodruk.przejdzDoStrony(p.strony.length - 1);
  });
  assert.equal(await strona.locator('[data-akcja="skladanka-czesc"]').isVisible(), false);
  assert.deepEqual(bledy, []);
});
