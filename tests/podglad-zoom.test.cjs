// Podgląd: powiększanie (przyciski, Ctrl + kółko, klawiatura, dwuklik, przeciąganie) i gesty palcami
// (szczypanie, przesuwanie, podwójne stuknięcie, przewracanie i zamykanie prezentacji) – decyzja #84.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

const zoomSiatki = (s) => s.evaluate(() => parseInt(document.querySelector('#podglad-zoom').textContent, 10));
const zoomPrezentacji = (s) => s.evaluate(() => parseInt(document.querySelector('.prezentacja-wartosc').textContent, 10));
const licznik = (s) => s.textContent('.prezentacja-licznik');

// Projekt z rozkładówkami i 4 stronami, otwarty w podglądzie.
async function projektWPodgladzie(strona) {
  await strona.evaluate(() => document.querySelector('[data-akcja="nowy-projekt"]').click());
  await strona.fill('#form-nowy input[name=nazwa]', 'Powiększanie');
  await strona.click('#form-nowy label:has-text("Rozkładówki")');
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk);
  for (let i = 0; i < 3; i += 1) await strona.evaluate(() => document.querySelector('[data-akcja="strona-dodaj"]').click());
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 4);
  await strona.evaluate(() => { location.hash = `#/p/${window.seriodruk.stan.projekt.id}/podglad`; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad' && document.querySelector('#podglad-tresc .podglad-kartka img[src]'));
  await strona.evaluate(() => { document.querySelector('#podglad-tresc').scrollTop = 0; });
}

// Dotyk przez protokół przeglądarki: kilka palców naraz (Playwright ma tylko jedno stuknięcie).
async function palce(strona) {
  const cdp = await strona.context().newCDPSession(strona);
  const wyslij = (type, punkty = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: punkty.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
  return {
    async szczypnij(srodek, od, do_, kroki = 10) {
      await wyslij('touchStart', [{ x: srodek.x - od, y: srodek.y }, { x: srodek.x + od, y: srodek.y }]);
      for (let i = 1; i <= kroki; i += 1) {
        const d = od + ((do_ - od) * i) / kroki;
        await wyslij('touchMove', [{ x: srodek.x - d, y: srodek.y }, { x: srodek.x + d, y: srodek.y }]);
      }
      await wyslij('touchEnd');
    },
    async przesun(a, b, kroki = 8) {
      await wyslij('touchStart', [a]);
      for (let i = 1; i <= kroki; i += 1) await wyslij('touchMove', [{ x: a.x + ((b.x - a.x) * i) / kroki, y: a.y + ((b.y - a.y) * i) / kroki }]);
      await wyslij('touchEnd');
    },
    async stuknij(p) {
      await wyslij('touchStart', [p]);
      await wyslij('touchEnd');
    },
  };
}

test('podgląd na komputerze: przyciski, Ctrl + kółko w miejscu kursora, Ctrl + / 0, dwuklik, przeciąganie, Esc', async (t) => {
  const { strona, bledy } = await otworz(t);
  await projektWPodgladzie(strona);
  assert.equal(await zoomSiatki(strona), 100, '100% = dopasowanie do okna');
  await strona.click('[data-akcja="podglad-plus"]');
  assert.equal(await zoomSiatki(strona), 125);
  await strona.click('[data-akcja="podglad-dopasuj"]');
  assert.equal(await zoomSiatki(strona), 100);

  // Ctrl + kółko nad stroną: powiększa, a punkt strony pod kursorem zostaje pod kursorem.
  const kartka = await strona.locator('#podglad-tresc .podglad-kartka').first().boundingBox(); // strona 1 (prawa w pierwszej rozkładówce)
  const kursor = { x: kartka.x + kartka.width * 0.4, y: kartka.y + kartka.height * 0.4 };
  await strona.mouse.move(kursor.x, kursor.y);
  await strona.keyboard.down('Control');
  await strona.mouse.wheel(0, -120);
  await strona.mouse.wheel(0, -120);
  await strona.keyboard.up('Control');
  const poKolku = await zoomSiatki(strona);
  assert.ok(poKolku > 150, `Ctrl + kółko powiększa (${poKolku}%)`);
  const ulamek = await strona.evaluate(({ x, y }) => {
    const k = document.querySelectorAll('#podglad-tresc .podglad-kartka')[0].getBoundingClientRect();
    return { fx: (x - k.left) / k.width, fy: (y - k.top) / k.height };
  }, kursor);
  assert.ok(Math.abs(ulamek.fx - 0.4) < 0.03 && Math.abs(ulamek.fy - 0.4) < 0.03, `ten sam punkt strony pod kursorem (${JSON.stringify(ulamek)})`);
  // Strony dorysowują się ostrzej.
  await strona.waitForFunction(() => Number(document.querySelectorAll('#podglad-tresc .podglad-strona[data-id]')[0].dataset.px) > 1000);

  // Przeciąganie myszą przy powiększeniu przesuwa podgląd i nie otwiera strony do edycji.
  const przed = await strona.evaluate(() => document.querySelector('#podglad-tresc').scrollTop);
  await strona.mouse.move(kursor.x, kursor.y);
  await strona.mouse.down();
  await strona.mouse.move(kursor.x, kursor.y - 80, { steps: 4 });
  await strona.mouse.move(kursor.x, kursor.y - 160, { steps: 4 });
  await strona.mouse.up();
  const po = await strona.evaluate(() => document.querySelector('#podglad-tresc').scrollTop);
  assert.ok(po - przed > 120, `przeciąganie przewija (${przed} → ${po})`);
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'podglad', 'przeciągnięcie nie otwiera edycji');

  // Klawiatura: Ctrl 0 – dopasowanie, Ctrl + – powiększenie (zamiast powiększania całej strony przeglądarki).
  await strona.keyboard.press('Control+0');
  assert.equal(await zoomSiatki(strona), 100);
  await strona.keyboard.press('Control+Equal');
  assert.equal(await zoomSiatki(strona), 125);
  // Esc przy powiększeniu wraca do dopasowania, dopiero następny zamyka podgląd.
  await strona.keyboard.press('Escape');
  assert.equal(await zoomSiatki(strona), 100);
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'podglad');

  // Dwuklik w tło (między stronami): powiększenie w tym miejscu, drugi – powrót do dopasowania.
  const tlo = await strona.locator('#podglad-tresc').boundingBox();
  await strona.mouse.dblclick(tlo.x + 8, tlo.y + 8);
  assert.equal(await zoomSiatki(strona), 250);
  await strona.mouse.dblclick(tlo.x + 8, tlo.y + 8);
  assert.equal(await zoomSiatki(strona), 100);
  await strona.keyboard.press('Escape');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  assert.deepEqual(bledy, []);
});

test('prezentacja na komputerze: powiększenie ostrzy stronę, strzałki przesuwają, dwuklik, Ctrl + kółko, Esc najpierw dopasowuje', async (t) => {
  const { strona, bledy } = await otworz(t);
  await projektWPodgladzie(strona);
  await strona.click('[data-akcja="podglad-prezentacja"]');
  await strona.waitForSelector('.prezentacja');
  await strona.keyboard.press('ArrowRight'); // para 2–3
  assert.match(await licznik(strona), /2 z 3/);
  await strona.waitForFunction(() => [...document.querySelectorAll('.prezentacja-kartka img')].every((i) => i.naturalWidth > 0));
  const bazowa = await strona.evaluate(() => Number(document.querySelector('.prezentacja-kartka img').dataset.px));
  assert.equal(await zoomPrezentacji(strona), 100);

  // Przyciski i klawiatura: 4× powiększenie – strona rysuje się w wyższej rozdzielczości.
  await strona.click('.prezentacja-plus');
  assert.equal(await zoomPrezentacji(strona), 125);
  for (let i = 0; i < 5; i += 1) await strona.keyboard.press('+');
  assert.ok(await zoomPrezentacji(strona) >= 380);
  await strona.waitForFunction((b) => [...document.querySelectorAll('.prezentacja-kartka img')].every((i) => Number(i.dataset.px) > b && i.naturalWidth > b), bazowa, { timeout: 20000 });
  const ostra = await strona.evaluate(() => document.querySelector('.prezentacja-kartka img').naturalWidth);
  assert.ok(ostra > bazowa * 1.4, `ostrzejszy obraz po powiększeniu (${bazowa} → ${ostra} px)`);

  // Strzałki przy powiększeniu przesuwają stronę, nie przewracają jej.
  const przesuniecie = () => strona.evaluate(() => document.querySelector('.prezentacja-uklad').style.transform);
  const t1 = await przesuniecie();
  await strona.keyboard.press('ArrowLeft');
  await strona.waitForTimeout(300);
  assert.notEqual(await przesuniecie(), t1);
  assert.match(await licznik(strona), /2 z 3/);
  // Esc: najpierw dopasowanie…
  await strona.keyboard.press('Escape');
  assert.equal(await zoomPrezentacji(strona), 100);
  assert.equal(await strona.locator('.prezentacja').count(), 1);

  // Dwuklik w stronę: 250% w tym miejscu, drugi – dopasowanie.
  const scena = await strona.locator('.prezentacja-scena').boundingBox();
  const srodek = { x: scena.x + scena.width / 2, y: scena.y + scena.height / 2 };
  await strona.mouse.dblclick(srodek.x, srodek.y);
  assert.equal(await zoomPrezentacji(strona), 250);
  await strona.waitForTimeout(400);
  await strona.mouse.dblclick(srodek.x, srodek.y);
  assert.equal(await zoomPrezentacji(strona), 100);

  // Ctrl + kółko powiększa, samo kółko przy powiększeniu przesuwa.
  await strona.mouse.move(srodek.x, srodek.y);
  await strona.keyboard.down('Control');
  await strona.mouse.wheel(0, -120);
  await strona.keyboard.up('Control');
  assert.ok(await zoomPrezentacji(strona) > 150);
  const t2 = await przesuniecie();
  await strona.mouse.wheel(0, 200);
  assert.notEqual(await przesuniecie(), t2);
  // Przeciąganie myszą przesuwa powiększoną stronę.
  const t3 = await przesuniecie();
  await strona.mouse.move(srodek.x, srodek.y);
  await strona.mouse.down();
  await strona.mouse.move(srodek.x + 120, srodek.y + 60, { steps: 6 });
  await strona.mouse.up();
  assert.notEqual(await przesuniecie(), t3);
  // …a potem zamknięcie.
  await strona.keyboard.press('Escape');
  await strona.keyboard.press('Escape');
  await strona.waitForSelector('.prezentacja', { state: 'detached' });
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'podglad');
  assert.deepEqual(bledy, []);
});

test('telefon: szczypanie i podwójne stuknięcie w podglądzie, palcem przewracanie stron prezentacji i zamykanie', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await projektWPodgladzie(strona);
  // Natywne powiększanie całej strony wyłączone tylko w podglądzie; reszta aplikacji bez zmian.
  const dotyk = await strona.evaluate(() => ({
    podglad: getComputedStyle(document.querySelector('#podglad-tresc')).touchAction,
    body: getComputedStyle(document.body).touchAction,
  }));
  assert.equal(dotyk.podglad, 'pan-x pan-y');
  assert.equal(dotyk.body, 'auto');
  const p = await palce(strona);
  const obszar = await strona.locator('#podglad-tresc').boundingBox();
  const srodek = { x: obszar.x + obszar.width / 2, y: obszar.y + obszar.height / 2 };

  // Szczypanie dwoma palcami powiększa siatkę.
  await p.szczypnij(srodek, 40, 120);
  await strona.waitForTimeout(200);
  const poSzczypaniu = await zoomSiatki(strona);
  assert.ok(poSzczypaniu > 200, `szczypanie powiększa (${poSzczypaniu}%)`);
  // Podwójne stuknięcie w tło (nie w stronę – stuknięcie w stronę otwiera edycję) wraca do dopasowania.
  await strona.click('[data-akcja="podglad-dopasuj"]');
  assert.equal(await zoomSiatki(strona), 100);
  await p.stuknij({ x: obszar.x + 6, y: obszar.y + 6 });
  await p.stuknij({ x: obszar.x + 6, y: obszar.y + 6 });
  await strona.waitForTimeout(100);
  assert.equal(await zoomSiatki(strona), 250, 'podwójne stuknięcie powiększa');
  await strona.click('[data-akcja="podglad-dopasuj"]');

  // Prezentacja: strzałki ukryte na dotyku, przesunięcie palcem w lewo – następna strona.
  await strona.evaluate(() => { document.querySelector('#podglad-tresc').scrollTop = 0; });
  await strona.evaluate(() => document.querySelector('[data-akcja="podglad-prezentacja"]').click());
  await strona.waitForSelector('.prezentacja');
  await strona.keyboard.press('Home'); // start od strony widocznej w podglądzie – tu od pierwszej
  assert.match(await licznik(strona), /1 z 3/);
  assert.equal(await strona.isVisible('.prezentacja-strzalka.dalej'), false);
  const scena = await strona.locator('.prezentacja-scena').boundingBox();
  const sr = { x: scena.x + scena.width / 2, y: scena.y + scena.height / 2 };
  await p.przesun({ x: sr.x + 140, y: sr.y }, { x: sr.x - 140, y: sr.y });
  assert.match(await licznik(strona), /2 z 3/, 'przesunięcie w lewo – następna strona');
  await p.przesun({ x: sr.x - 140, y: sr.y }, { x: sr.x + 140, y: sr.y });
  assert.match(await licznik(strona), /1 z 3/, 'w prawo – poprzednia');
  // Krótkie przesunięcie nie przewraca strony.
  await p.przesun({ x: sr.x, y: sr.y }, { x: sr.x - 30, y: sr.y }, 2);
  await strona.waitForTimeout(400);
  assert.match(await licznik(strona), /1 z 3/);

  // Szczypanie w prezentacji powiększa, jeden palec przesuwa powiększoną stronę, a nie przewraca jej.
  await p.szczypnij(sr, 30, 110);
  const z = await zoomPrezentacji(strona);
  assert.ok(z > 200, `szczypanie w prezentacji (${z}%)`);
  const t1 = await strona.evaluate(() => document.querySelector('.prezentacja-uklad').style.transform);
  await p.przesun({ x: sr.x, y: sr.y }, { x: sr.x - 120, y: sr.y + 40 });
  await strona.waitForTimeout(500);
  assert.notEqual(await strona.evaluate(() => document.querySelector('.prezentacja-uklad').style.transform), t1);
  assert.match(await licznik(strona), /1 z 3/, 'przy powiększeniu palec przesuwa, nie przewraca');
  // Podwójne stuknięcie – powrót do dopasowania.
  await p.stuknij(sr);
  await p.stuknij(sr);
  await strona.waitForTimeout(100);
  assert.equal(await zoomPrezentacji(strona), 100);

  // Przesunięcie w dół zamyka prezentację.
  await strona.waitForTimeout(400);
  await p.przesun({ x: sr.x, y: sr.y - 100 }, { x: sr.x, y: sr.y + 150 });
  await strona.waitForSelector('.prezentacja', { state: 'detached' });
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'podglad');
  assert.deepEqual(bledy, []);
});

test('Safari (iPhone, iPad): gesty powiększania całej strony zatrzymane w podglądzie i prezentacji, poza nimi nie', async (t) => {
  const { otworz: o, nowyProjekt: n } = require('./pomoc.cjs');
  const { strona } = await o(t, { telefon: true });
  await n(strona, 'Gesty Safari');
  await strona.evaluate(async () => { const { pokazPodglad } = await import('./js/app/podglad-ekran.js'); await pokazPodglad(); });
  await strona.waitForSelector('.podglad-tresc .podglad-strona');
  const wynik = await strona.evaluate(() => {
    const gest = (el, nazwa) => { const e = new Event(nazwa, { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
    const w = document.querySelector('.podglad-tresc .podglad-strona') || document.querySelector('.podglad-tresc');
    return { start: gest(w, 'gesturestart'), zmiana: gest(w, 'gesturechange'), poza: gest(document.querySelector('header') || document.body, 'gesturestart') };
  });
  assert.deepEqual(wynik, { start: true, zmiana: true, poza: false });
});
