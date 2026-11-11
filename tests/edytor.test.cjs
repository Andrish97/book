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

test('telefon: arkusz właściwości – od góry, bez krzyżyka, uchwyt, element widoczny nad arkuszem, podmiana zdjęcia', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Dziennik lekcyjny 2026');
  // Górny pasek oddaje miejsce nazwie projektu: wzorce, dane i instrukcja są na wąskim ekranie w menu ⋯.
  const pasek = () => strona.evaluate(() => {
    const p = document.querySelector('#nazwa-projektu');
    const wPasku = ['wzorce', 'dane', 'instrukcja'].filter((a) => document.querySelector(`.pasek-edytora > [data-akcja="${a}"]`).offsetParent);
    const n = document.querySelector('.pasek-narzedzi');
    const ostatni = [...n.querySelectorAll('button')].filter((b) => b.offsetParent).at(-1).getBoundingClientRect();
    return { pelnaNazwa: p.scrollWidth <= p.clientWidth, tytul: p.title, wPasku, wstawianieMiesci: n.scrollWidth <= n.clientWidth && ostatni.right <= n.getBoundingClientRect().right };
  });
  assert.deepEqual(await pasek(), { pelnaNazwa: true, tytul: 'Dziennik lekcyjny 2026', wPasku: [], wstawianieMiesci: true });
  await strona.tap('#przycisk-wiecej');
  assert.ok(await strona.isVisible('#menu-wiecej [data-akcja="dane"]'));
  await strona.tap('#menu-wiecej [data-akcja="dane"]');
  await strona.waitForSelector('#menu-wiecej', { state: 'hidden' });
  await strona.keyboard.press('Escape');
  await strona.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  await strona.setViewportSize({ width: 360, height: 800 });
  assert.equal((await pasek()).wstawianieMiesci, true, 'na 360 px mieszczą się wszystkie przyciski wstawiania');
  await strona.setViewportSize({ width: 412, height: 915 });

  // Obraz na dole strony – arkusz by go zasłonił.
  await strona.setInputFiles('#plik-obraz', { name: 'zdjecie.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'image');
  await strona.evaluate(() => {
    const { edytor: e } = window.seriodruk;
    const o = e.aktywny;
    o.set({ scaleX: 30, scaleY: 20, left: 40, top: 160 });
    o.setCoords();
    e.zatwierdz();
  });
  const widokPrzed = await strona.evaluate(() => { const k = window.seriodruk.edytor.kontener; return [k.scrollLeft, k.scrollTop, window.seriodruk.edytor.zoom]; });
  const otwarty = () => strona.waitForFunction(() => getComputedStyle(document.querySelector('.panel-inspektor')).transform === 'none');
  const stanArkusza = () => strona.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const e = window.seriodruk.edytor;
    const o = e.aktywny; o.setCoords();
    const b = o.getBoundingRect(); const v = e.canvas.viewportTransform; const c = e.canvas.upperCanvasEl.getBoundingClientRect();
    const el = { gora: c.top + v[5] + b.top * v[3], dol: c.top + v[5] + (b.top + b.height) * v[3] };
    return {
      zakladki: r('.zakladki-panelu-opak'), naglowek: r('#naglowek-wlasciwosci'), panel: r('.panel-inspektor'), pasek: r('#pasek-narzedzi'),
      el, krzyzyk: [...document.querySelectorAll('.panel-inspektor button')].some((x) => x.offsetParent && /zamknij/i.test(x.getAttribute('aria-label') || '')),
      przewiniecie: document.querySelector('.wlasciwosci').scrollTop, okno: window.innerHeight,
    };
  });
  await strona.evaluate(() => { document.querySelector('.wlasciwosci').scrollTop = 500; });
  await strona.tap('.zakladki-mobilne [data-panel="inspektor"]');
  await otwarty();
  await strona.waitForTimeout(100);
  let s = await stanArkusza();
  // Arkusz zaczyna się od góry: zakładki nad nagłówkiem elementu, nic na nic nie nachodzi; bez krzyżyka.
  assert.equal(s.przewiniecie, 0);
  assert.ok(s.zakladki.height >= 36 && s.zakladki.bottom <= s.naglowek.top + 0.5, `zakładki ${JSON.stringify(s.zakladki)} nad nagłówkiem ${JSON.stringify(s.naglowek)}`);
  assert.equal(s.krzyzyk, false);
  assert.ok(Math.abs(s.panel.height - s.okno * 0.45) < 2, `arkusz na 45% ekranu: ${s.panel.height}`);
  // Zaznaczony obraz widać nad arkuszem (pod paskiem wstawiania).
  assert.ok(s.el.gora >= s.pasek.bottom - 1 && s.el.dol <= s.panel.top + 1, `obraz ${JSON.stringify(s.el)} między paskiem ${s.pasek.bottom} a arkuszem ${s.panel.top}`);
  // Przyciski zdjęcia są zaraz pod nagłówkiem.
  assert.deepEqual(await strona.evaluate(() => [...document.querySelectorAll('.wlasciwosci > :first-child button')].map((b) => b.textContent.trim())), ['Podmień zdjęcie', 'Wgraj obrazy do projektu']);
  // Położenie i rozmiar w dwóch rzędach.
  const rzedy = await strona.evaluate(() => new Set([...document.querySelectorAll('.geometria > label')].map((l) => Math.round(l.getBoundingClientRect().top))).size);
  assert.equal(rzedy, 2);
  assert.ok(await strona.evaluate(() => [...document.querySelectorAll('.wlasciwosci input:not([type=checkbox]):not([type=radio]):not([type=color])')].filter((i) => i.offsetParent).every((i) => i.getBoundingClientRect().height >= 40)), 'pola co najmniej 40 px wysokości');

  // „Podmień zdjęcie”: nowy plik w tej samej ramce i w tym samym miejscu.
  const przed = await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; const c = o.getCenterPoint(); return { w: o.getScaledWidth(), h: o.getScaledHeight(), x: c.x, y: c.y, zasob: o.zasob }; });
  const [wybor] = await Promise.all([strona.waitForEvent('filechooser'), strona.tap('.wlasciwosci button:has-text("Podmień zdjęcie")')]);
  const PNG_4X2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGP4z8AARwzIHABvqgf5gNwAKAAAAABJRU5ErkJggg==', 'base64');
  await wybor.setFiles({ name: 'nowe.png', mimeType: 'image/png', buffer: PNG_4X2 });
  await strona.waitForFunction((z) => window.seriodruk.edytor.aktywny?.zasob !== z, przed.zasob);
  const po = await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; const c = o.getCenterPoint(); return { w: o.getScaledWidth(), h: o.getScaledHeight(), x: c.x, y: c.y, nazwa: window.seriodruk.stan.projekt.zasoby[o.zasob].nazwa, cropX: o.cropX }; });
  for (const k of ['w', 'h', 'x', 'y']) assert.ok(Math.abs(po[k] - przed[k]) < 0.01, `${k}: ${przed[k]} → ${po[k]}`);
  assert.equal(po.nazwa, 'nowe.png');
  assert.ok(po.cropX > 0, 'zdjęcie o innych proporcjach wypełnia ramkę, nadmiar jest przycięty');

  // Ponowne stuknięcie zakładki zamyka arkusz; widok wraca tam, gdzie był.
  await strona.tap('.zakladki-mobilne [data-panel="inspektor"]');
  assert.equal(await strona.evaluate(() => document.body.dataset.panel), '');
  const widok = () => strona.evaluate(() => { const k = window.seriodruk.edytor.kontener; return [k.scrollLeft, k.scrollTop, window.seriodruk.edytor.zoom]; });
  assert.deepEqual(await widok(), widokPrzed);
  await strona.tap('.zakladki-mobilne [data-panel="inspektor"]');
  await otwarty();

  // Uchwyt: przeciągnięcie w górę powiększa, stuknięcie wraca do zwykłej wysokości, w dół zamyka.
  const uchwyt = await strona.evaluate(() => { const r = document.querySelector('.panel-inspektor .uchwyt-arkusza').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const cdp = await strona.context().newCDPSession(strona);
  const ciagnij = async ([x, y], dy) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i += 1) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (dy * i) / 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await strona.waitForTimeout(350);
  };
  await ciagnij(uchwyt, -200);
  s = await stanArkusza();
  assert.equal(await strona.evaluate(() => document.body.dataset.arkusz), 'pelny');
  assert.ok(s.panel.height > s.okno * 0.75, `powiększony arkusz: ${s.panel.height}`);
  await strona.tap('.panel-inspektor .uchwyt-arkusza');
  await strona.waitForTimeout(350);
  s = await stanArkusza();
  assert.ok(Math.abs(s.panel.height - s.okno * 0.45) < 2, 'stuknięcie w uchwyt wraca do zwykłej wysokości');
  const uchwyt2 = await strona.evaluate(() => { const r = document.querySelector('.panel-inspektor .uchwyt-arkusza').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await ciagnij(uchwyt2, 200);
  assert.equal(await strona.evaluate(() => document.body.dataset.panel), '');
  assert.deepEqual(await widok(), widokPrzed);
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
