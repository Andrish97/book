const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, ekran, PNG_2X2 } = require('./pomoc.cjs');

test('projekt: elementy, strony, ostrzeżenia, cofanie i zapis po odświeżeniu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz');

  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.click('[data-akcja="dodaj-elipse"]');
  await strona.click('[data-akcja="dodaj-linie"]');
  await strona.setInputFiles('#plik-obraz', { name: 'a.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().length === 5);

  // Nowy tekst mieści się w marginesach – bez ostrzeżeń.
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.length), 0);

  // Prostokąt przesunięty w margines → ostrzeżenie.
  await strona.waitForTimeout(400); // osobny krok historii
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const r = e.canvas.getObjects().find((o) => o.type === 'rect');
    e.canvas.setActiveObject(r);
    r.set({ left: 2, top: 2 });
    e.zatwierdz();
  });
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.map((o) => o.typ)), ['w_marginesie']);

  // Cofnięcie przywraca położenie.
  await strona.waitForTimeout(400);
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.edytor?.ostrzezenia.length === 0);

  // Druga strona, obraz zapisany jako zasób.
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  const projekt = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    return { strony: p.strony.length, obraz: p.strony[0].obiekty.find((o) => o.type === 'image').src, zasoby: Object.keys(p.zasoby).length };
  });
  assert.equal(projekt.strony, 2);
  assert.match(projekt.obraz, /^zasob:/);
  assert.equal(projekt.zasoby, 1);

  // Odświeżenie: ten sam projekt i ta sama strona (adres podstrony).
  await strona.waitForTimeout(1200);
  const adres = strona.url();
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk.stan.projekt);
  assert.equal(await ekran(strona), 'edytor');
  assert.equal(strona.url(), adres);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.indeks), 1);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.length), 5);
  assert.deepEqual(bledy, []);
});

test('adresy: Wstecz wraca do listy, lista → projekt', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Trasy');
  assert.match(new URL(strona.url()).hash, /^#\/p\/[0-9a-f-]{36}\/s\/s_/);
  await strona.waitForTimeout(900);
  await strona.goBack();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  assert.equal(new URL(strona.url()).hash, '#/projekty');
  await strona.click('.karta-projektu .otworz-projekt');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  assert.deepEqual(bledy, []);
});

test('format własny i orientacja z kreatora trafiają do sekcji', async (t) => {
  const { strona } = await otworz(t);
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', 'Własny');
  await strona.click('.karta-formatu:has-text("Własny")');
  await strona.fill('#form-nowy input[name=szerokosc_mm]', '100');
  await strona.fill('#form-nowy input[name=wysokosc_mm]', '200');
  await strona.click('.przelacznik-segmentowy label:has-text("Poziomo")');
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt);
  const w = await strona.evaluate(() => window.seriodruk.stan.projekt.sekcje[0].wydruk);
  assert.equal(w.szerokosc_mm, 200);
  assert.equal(w.wysokosc_mm, 100);
  assert.equal(w.format, 'wlasny');
});

test('telefon: praca w pionie – panele z dołu, schowany wielokąt; trzymany poziomo i zbyt niskie okno pokazują planszę', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Telefon');
  await strona.tap('[data-akcja="dodaj-tekst"]');

  // Ekran trzyma się okna: pasek u góry, menu na samym dole, zamknięte arkusze
  // niewidoczne i w całości poniżej ekranu, dokument nie daje się przewinąć.
  const uklad = () => strona.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { gora: Math.round(b.top), dol: Math.round(b.bottom), widac: getComputedStyle(e).visibility === 'visible' }; };
    window.scrollTo(0, 200);
    return { okno: window.innerHeight, przewiniecie: window.scrollY + document.body.scrollTop, pasek: r('#ekran-edytora > :first-child'), menu: r('.zakladki-mobilne'), strony: r('.panel-strony'), wlasciwosci: r('.panel-inspektor') };
  });
  let u = await uklad();
  assert.equal(u.przewiniecie, 0);
  assert.equal(u.pasek.gora, 0);
  assert.equal(u.menu.dol, u.okno);
  assert.ok(!u.strony.widac && u.strony.gora >= u.okno, 'zamknięty arkusz stron nie wystaje');
  assert.ok(!u.wlasciwosci.widac && u.wlasciwosci.gora >= u.okno, 'zamknięty arkusz właściwości nie wystaje');

  // Okno zmienia wysokość (chowany pasek adresu) – układ idzie za nim.
  await strona.setViewportSize({ width: 412, height: 700 });
  u = await uklad();
  assert.deepEqual([u.pasek.gora, u.menu.dol], [0, 700]);

  await strona.tap('.zakladki-mobilne [data-panel="strony"]');
  await strona.waitForFunction(() => getComputedStyle(document.querySelector('.panel-strony')).visibility === 'visible');
  await strona.tap('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  // Górny pasek mieści się na ekranie w całości – także na węższym telefonie (menu ⋯ z eksportem musi być pod palcem).
  const pasek = () => strona.evaluate(() => { const p = document.querySelector('.pasek-edytora'); const m = document.querySelector('#przycisk-wiecej').getBoundingClientRect(); return [p.scrollWidth <= p.clientWidth, m.right <= window.innerWidth]; });
  await strona.setViewportSize({ width: 412, height: 915 });
  assert.deepEqual(await pasek(), [true, true]);
  await strona.setViewportSize({ width: 360, height: 740 });
  assert.deepEqual(await pasek(), [true, true]);
  await strona.setViewportSize({ width: 412, height: 915 });
  // Trudne narzędzia (wielokąt) są na telefonie schowane; podstawowe zostają, a pióro i tabela działają dotykiem.
  await strona.tap('.zakladki-mobilne button.aktywny').catch(() => {});
  assert.deepEqual(await strona.evaluate(() => [...document.querySelectorAll('.pasek-narzedzi button')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset.akcja)), ['dodaj-tekst', 'dodaj-prostokat', 'dodaj-elipse', 'dodaj-linie', 'dodaj-obraz', 'rysuj', 'pioro', 'dodaj-tabele']);

  // Telefon trzymany poziomo (i każde zbyt niskie okno): plansza; przycisk wraca do projektów, gdzie poziom jest w porządku.
  const plansza = () => strona.evaluate(() => getComputedStyle(document.querySelector('#blokada-ekranu')).display);
  assert.equal(await plansza(), 'none');
  await strona.setViewportSize({ width: 915, height: 412 });
  assert.equal(await plansza(), 'grid');
  assert.match(await strona.textContent('#blokada-ekranu'), /trzymaj go pionowo/);
  await strona.setViewportSize({ width: 412, height: 915 });
  assert.equal(await plansza(), 'none');
  await strona.setViewportSize({ width: 915, height: 412 });
  await strona.tap('#blokada-ekranu [data-akcja="do-projektow"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  assert.equal(await plansza(), 'none');
  assert.ok(await strona.isVisible('.karta-projektu'));
  assert.deepEqual(bledy, []);
});

test('dotyk: jeden palec przesuwa element, dwa palce powiększają widok bez ruszania elementu', async (t) => {
  const { strona, kontekst } = await otworz(t, { widok: { width: 1024, height: 700 } });
  await nowyProjekt(strona, 'Dotyk');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.evaluate(() => window.seriodruk.edytor.canvas.discardActiveObject());
  const cdp = await kontekst.newCDPSession(strona);
  const p = await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const o = e.canvas.getObjects().at(-1);
    const r = e.canvas.upperCanvasEl.getBoundingClientRect();
    const c = o.getCenterPoint();
    const v = e.canvas.viewportTransform;
    return { x: r.left + v[4] + c.x * v[0], y: r.top + v[5] + c.y * v[0], left: o.left, skala: v[0] };
  });
  const dotyk = (type, pkt) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pkt.map((q, i) => ({ x: q[0], y: q[1], id: i })) });
  await dotyk('touchStart', [[p.x, p.y]]);
  for (let i = 1; i <= 10; i += 1) await dotyk('touchMove', [[p.x + i * 5, p.y]]);
  await dotyk('touchEnd', []);
  await strona.waitForTimeout(200);
  const poPrzesunieciu = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().at(-1).left);
  // Element może się „przykleić” do prowadnicy, stąd tolerancja.
  assert.ok(Math.abs(poPrzesunieciu - (p.left + 50 / p.skala)) < 4, `przesunięcie: ${p.left} → ${poPrzesunieciu}`);

  const zoomPrzed = await strona.evaluate(() => window.seriodruk.edytor.zoom);
  const x = p.x + 50;
  await dotyk('touchStart', [[x, p.y]]);
  await dotyk('touchMove', [[x + 5, p.y]]);
  await dotyk('touchStart', [[x + 5, p.y], [x + 60, p.y]]);
  for (let i = 1; i <= 10; i += 1) await dotyk('touchMove', [[x + 5 - i * 6, p.y], [x + 60 + i * 6, p.y]]);
  await dotyk('touchEnd', []);
  await strona.waitForTimeout(200);
  const po = await strona.evaluate(() => ({ zoom: window.seriodruk.edytor.zoom, left: window.seriodruk.edytor.canvas.getObjects().at(-1).left }));
  assert.ok(po.zoom > zoomPrzed * 1.5, 'szczypanie powiększa widok');
  assert.ok(Math.abs(po.left - poPrzesunieciu) < 0.01, 'element nie ruszył się przy geście dwoma palcami');
});

test('telefon: tabela, pióro i edycja punktów są dostępne i działają dotykiem – dwa stuknięcia zaczynają pisanie w komórce, punkt przeciąga się palcem', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Telefon – narzędzia');
  const naEkranie = (x, y) => strona.evaluate(([mx, my]) => {
    const c = window.seriodruk.edytor.canvas; const v = c.viewportTransform; const r = c.upperCanvasEl.getBoundingClientRect();
    return [r.left + mx * v[0] + v[4], r.top + my * v[3] + v[5]];
  }, [x, y]);
  // Pasek wstawiania mieści się na ekranie, a pióro i tabela są na nim widoczne (wielokąt zostaje schowany).
  const pasek = await strona.evaluate(() => {
    const p = document.querySelector('#pasek-narzedzi').getBoundingClientRect();
    const widac = (a) => getComputedStyle(document.querySelector(`[data-akcja="${a}"]`)).display !== 'none';
    return { lewo: p.left, prawo: p.right, okno: innerWidth, pioro: widac('pioro'), tabela: widac('dodaj-tabele'), wielokat: widac('dodaj-wielokat') };
  });
  assert.ok(pasek.lewo >= 0 && pasek.prawo <= pasek.okno, `pasek na ekranie: ${pasek.lewo}–${pasek.prawo} z ${pasek.okno}`);
  assert.deepEqual([pasek.pioro, pasek.tabela, pasek.wielokat], [true, true, false]);

  // Tabela: wstawienie z okna i dwa stuknięcia w komórkę – pisanie w niej.
  await strona.tap('[data-akcja="dodaj-tabele"]');
  await strona.waitForSelector('#dlg-tabela[open]');
  await strona.tap('#dlg-tabela button:has-text("Wstaw")');
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((o) => o.tabela));
  const tab = await strona.evaluate(() => { const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.tabela); g.setCoords(); const r = g.getBoundingRect(); return [r.left, r.top]; });
  const [x, y] = await naEkranie(tab[0] + 5, tab[1] + 13);
  await strona.touchscreen.tap(x, y);
  await strona.waitForTimeout(80);
  await strona.touchscreen.tap(x, y);
  await strona.waitForFunction(() => window.seriodruk.edytor?.aktywny?.isEditing);
  await strona.keyboard.type('Abc');
  assert.deepEqual(await strona.evaluate(() => { const a = window.seriodruk.edytor.aktywny; return [Boolean(a.group?.tabela), a.text]; }), [true, 'Abc']);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.exitEditing(); e.canvas.discardActiveObject(); e.canvas.requestRenderAll(); });

  // Pióro: stuknięcia stawiają punkty, „Zakończ kształt” w panelu właściwości kończy kształt.
  await strona.tap('[data-akcja="pioro"]');
  for (const [px, py] of [[30, 120], [90, 120], [60, 170]]) { await strona.touchscreen.tap(...(await naEkranie(px, py))); await strona.waitForTimeout(450); }
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.punktyPiora), 3);
  await strona.tap('.zakladki-mobilne [data-panel="inspektor"]');
  await strona.tap('.wlasciwosci button:has-text("Zakończ kształt")');
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'path').map((p) => p.path.length)), [3]);
  await strona.evaluate(() => window.seriodruk.edytor.ustawPioro(false));

  // Edycja punktów: przycisk jest w panelu kształtu; punkt przeciąga się palcem.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.type === 'path').id); });
  await strona.tap('.wlasciwosci button:has-text("Edytuj punkty")');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.edytujePunkty), true);
  // Arkusz właściwości zasłania dół strony – zamyka się tą samą zakładką.
  if (await strona.evaluate(() => document.body.dataset.panel)) await strona.tap('.zakladki-mobilne [data-panel="inspektor"]');
  await strona.waitForFunction(() => !document.body.dataset.panel);
  await strona.waitForTimeout(400);
  const [ax, ay] = await naEkranie(90, 120);
  const [bx, by] = await naEkranie(100, 100);
  const cdp = await strona.context().newCDPSession(strona);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ax, y: ay }] });
  for (let i = 1; i <= 6; i += 1) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ax + ((bx - ax) * i) / 6, y: ay + ((by - ay) * i) / 6 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const punkt = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'path').path[1]);
  assert.ok(Math.abs(punkt[1] - 100) < 1 && Math.abs(punkt[2] - 100) < 1, `punkt przeciągnięty palcem: ${punkt}`);
  assert.deepEqual(bledy, []);
});
