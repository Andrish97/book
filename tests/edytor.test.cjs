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
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 5);

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
  await strona.waitForFunction(() => window.seriodruk.edytor.ostrzezenia.length === 0);

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
  await strona.click('#tryb-lokalny');
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

test('telefon: praca w poziomie – panele z boków, ukryte trudne narzędzia; w pionie i w zbyt niskim oknie plansza', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Telefon');
  await strona.tap('[data-akcja="dodaj-tekst"]');

  // Ekran trzyma się okna: pasek u góry, listwa paneli po prawej na całą wysokość, zamknięte
  // panele niewidoczne i w całości poza ekranem, dokument nie daje się przewinąć.
  const uklad = () => strona.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { lewo: Math.round(b.left), prawo: Math.round(b.right), gora: Math.round(b.top), dol: Math.round(b.bottom), widac: getComputedStyle(e).visibility === 'visible' }; };
    window.scrollTo(0, 200);
    return { okno: [window.innerWidth, window.innerHeight], przewiniecie: window.scrollY + document.body.scrollTop, pasek: r('#ekran-edytora > :first-child'), listwa: r('.zakladki-mobilne'), strony: r('.panel-strony'), wlasciwosci: r('.panel-inspektor'), plansza: getComputedStyle(document.querySelector('#blokada-ekranu')).display };
  });
  let u = await uklad();
  assert.equal(u.przewiniecie, 0);
  assert.equal(u.plansza, 'none');
  assert.deepEqual([u.pasek.gora, u.pasek.dol], [0, 48]);
  assert.deepEqual([u.listwa.prawo, u.listwa.gora, u.listwa.dol], [u.okno[0], 48, u.okno[1]]);
  assert.ok(!u.strony.widac && u.strony.prawo <= 0, 'zamknięty panel stron jest poza lewą krawędzią');
  assert.ok(!u.wlasciwosci.widac && u.wlasciwosci.lewo >= u.okno[0], 'zamknięty panel właściwości jest poza prawą krawędzią');
  // Trudne narzędzia są schowane; podstawowe zostają.
  assert.deepEqual(await strona.evaluate(() => [...document.querySelectorAll('.pasek-narzedzi button')].filter((b) => b.offsetParent).map((b) => b.dataset.akcja)), ['dodaj-tekst', 'dodaj-prostokat', 'dodaj-elipse', 'dodaj-linie', 'dodaj-obraz', 'rysuj']);

  // Właściwości wysuwają się z prawej, na całą wysokość pod paskiem; strona odsuwa się spod panelu.
  await strona.tap('.zakladki-mobilne [data-panel="inspektor"]');
  await strona.waitForFunction(() => getComputedStyle(document.querySelector('.panel-inspektor')).visibility === 'visible');
  await strona.waitForTimeout(300);
  u = await uklad();
  assert.deepEqual([u.wlasciwosci.gora, u.wlasciwosci.dol, u.wlasciwosci.prawo], [48, u.okno[1], u.listwa.lewo]);
  const stronaNaEkranie = await strona.evaluate(() => { const b = document.querySelector('.arkusz .canvas-container').getBoundingClientRect(); return Math.round(b.right); });
  assert.ok(stronaNaEkranie <= u.wlasciwosci.lewo + 2, `strona mieści się obok panelu (${stronaNaEkranie} ≤ ${u.wlasciwosci.lewo})`);

  // Strony – z lewej; dodanie strony działa.
  await strona.tap('.zakladki-mobilne [data-panel="strony"]');
  await strona.waitForFunction(() => getComputedStyle(document.querySelector('.panel-strony')).visibility === 'visible');
  await strona.waitForTimeout(300);
  u = await uklad();
  assert.deepEqual([u.strony.lewo, u.strony.gora, u.strony.dol], [0, 48, u.okno[1]]);
  await strona.tap('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);

  // Telefon obrócony do pionu: plansza „Obróć telefon poziomo”; przycisk wraca do projektów, gdzie pion jest w porządku.
  await strona.setViewportSize({ width: 412, height: 915 });
  assert.equal((await uklad()).plansza, 'grid');
  assert.ok(await strona.isVisible('#blokada-ekranu h2.obroc'));
  assert.ok(await strona.isHidden('#blokada-ekranu h2.za-niskie'));
  // Zbyt niskie okno (np. klawiatura ekranowa w poziomie): osobny komunikat.
  await strona.setViewportSize({ width: 800, height: 280 });
  assert.ok(await strona.isVisible('#blokada-ekranu h2.za-niskie'));
  assert.ok(await strona.isHidden('#blokada-ekranu h2.obroc'));
  await strona.setViewportSize({ width: 412, height: 915 });
  await strona.tap('#blokada-ekranu [data-akcja="do-projektow"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  assert.equal(await strona.evaluate(() => getComputedStyle(document.querySelector('#blokada-ekranu')).display), 'none');
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
