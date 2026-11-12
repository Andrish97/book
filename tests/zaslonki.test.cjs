// Okna dialogowe jako zasłonki (js/urzadzenie.js, js/zaslonki.js): na telefonie i tablecie wyjeżdżają od dołu,
// zaokrąglone tylko u góry, z uchwytem zamiast krzyżyka; uchwyt i tło zamykają je tak samo jak krzyżyk.
// Na komputerze zostają zwykłymi oknami na środku.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Położenie i wygląd otwartego okna.
const wyglad = (strona, sel) => strona.evaluate((s) => {
  const d = document.querySelector(s);
  const r = d.getBoundingClientRect();
  const st = getComputedStyle(d);
  const widoczny = (el) => Boolean(el) && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none';
  return {
    lewo: Math.round(r.left), prawo: Math.round(innerWidth - r.right), dol: Math.round(innerHeight - r.bottom), gora: Math.round(r.top),
    szerokosc: r.width / innerWidth,
    rogiGora: parseFloat(st.borderTopLeftRadius), rogiDol: parseFloat(st.borderBottomLeftRadius),
    uchwyt: widoczny(d.querySelector(':scope > .uchwyt-zaslonki')),
    x: widoczny(d.querySelector('.x-okna')),
  };
}, sel);
const poWjezdzie = (strona, sel) => strona.waitForFunction((s) => {
  const d = document.querySelector(s);
  return d?.open && !d.classList.contains('zaslonka-wjazd');
}, sel);
// Pociągnięcie uchwytu w dół o dy pikseli.
async function pociagnij(strona, sel, dy) {
  const r = await strona.locator(`${sel} > .uchwyt-zaslonki`).boundingBox();
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  await strona.mouse.move(x, y);
  await strona.mouse.down();
  for (let i = 1; i <= 6; i += 1) await strona.mouse.move(x, y + (dy * i) / 6);
  await strona.mouse.up();
}
async function otworzMenuWiecej(strona, akcja) {
  await strona.click('#przycisk-wiecej');
  await strona.locator(`#menu-wiecej [data-akcja="${akcja}"]`).click();
}

test('telefon: okno jest zasłonką – przy dolnej krawędzi, na całą szerokość, zaokrąglone u góry, uchwyt zamiast krzyżyka', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  assert.equal(await strona.evaluate(() => document.documentElement.hasAttribute('data-zaslonka')), true);
  await nowyProjekt(strona, 'Zasłonki');
  await otworzMenuWiecej(strona, 'dane');
  await poWjezdzie(strona, '#dlg-dane');
  const w = await wyglad(strona, '#dlg-dane');
  assert.deepEqual([w.lewo, w.prawo, w.dol], [0, 0, 0], 'zasłonka przylega do dołu i boków ekranu');
  assert.ok(w.rogiGora > 0 && w.rogiDol === 0, `zaokrąglenie tylko u góry (${w.rogiGora} / ${w.rogiDol})`);
  assert.ok(w.uchwyt, 'uchwyt widoczny');
  assert.equal(w.x, false, 'krzyżyk ukryty');

  // Krótkie pociągnięcie: zasłonka wraca na miejsce i zostaje otwarta.
  await pociagnij(strona, '#dlg-dane', 40);
  await strona.waitForTimeout(400);
  assert.equal(await strona.evaluate(() => document.querySelector('#dlg-dane').open), true);
  assert.equal((await wyglad(strona, '#dlg-dane')).dol, 0);

  // Długie pociągnięcie: zamyka tak jak krzyżyk (kliknięcie krzyżyka okna Dane – jego zapis przy zamknięciu).
  await strona.evaluate(() => {
    window.klikX = 0;
    document.querySelector('#dane-zamknij').addEventListener('click', () => { window.klikX += 1; });
  });
  await pociagnij(strona, '#dlg-dane', 320);
  await strona.waitForFunction(() => !document.querySelector('#dlg-dane').open);
  assert.equal(await strona.evaluate(() => window.klikX), 1, 'zamknięcie przez krzyżyk okna');

  // Potwierdzenie: stuknięcie w tło poza zasłonką zamyka i daje „nie”.
  await strona.evaluate(async () => {
    const { potwierdz } = await import('./js/ui.js');
    window.wynik = 'czeka';
    potwierdz('Usunąć?', 'Na pewno?', 'Usuń', true).then((w) => { window.wynik = w; });
  });
  await poWjezdzie(strona, '#dlg-potwierdz');
  const p = await wyglad(strona, '#dlg-potwierdz');
  assert.ok(p.gora > 100, 'małe okno zajmuje tylko dół ekranu');
  await strona.mouse.click(200, 40);
  await strona.waitForFunction(() => window.wynik !== 'czeka');
  assert.equal(await strona.evaluate(() => window.wynik), false);

  // Stuknięcie uchwytu (bez ruchu) też zamyka – nazwa zostaje bez zmian (null jak „Anuluj”).
  await strona.evaluate(async () => {
    const { zapytajONazwe } = await import('./js/ui.js');
    window.nazwa = 'czeka';
    zapytajONazwe('Nazwa', 'Nazwa', 'Styczeń').then((n) => { window.nazwa = n; });
  });
  await poWjezdzie(strona, '#dlg-nazwa');
  await strona.click('#dlg-nazwa > .uchwyt-zaslonki');
  await strona.waitForFunction(() => window.nazwa !== 'czeka');
  assert.equal(await strona.evaluate(() => window.nazwa), null);

  // Okno, które samo nie pozwala się zamknąć bez decyzji (wstrzymane „cancel”), zostaje otwarte.
  await strona.evaluate(() => {
    const d = document.querySelector('#dlg-konflikt');
    d.addEventListener('cancel', (e) => e.preventDefault());
    d.showModal();
  });
  await poWjezdzie(strona, '#dlg-konflikt');
  await strona.mouse.click(200, 40);
  await strona.waitForTimeout(500);
  assert.equal(await strona.evaluate(() => document.querySelector('#dlg-konflikt').open), true);
  assert.equal((await wyglad(strona, '#dlg-konflikt')).dol, 0, 'po próbie zamknięcia wraca na miejsce');
  await strona.evaluate(() => document.querySelector('#dlg-konflikt').close());
  assert.deepEqual(bledy, []);
});

test('tablet (dotyk): zasłonka szeroka, ale nie na całą szerokość; komputer: zwykłe okno z krzyżykiem', async (t) => {
  const tablet = await otworz(t, { urzadzenie: 'iPad Mini' });
  await nowyProjekt(tablet.strona, 'Tablet');
  await otworzMenuWiecej(tablet.strona, 'pdf');
  await poWjezdzie(tablet.strona, '#dlg-pdf');
  const w = await wyglad(tablet.strona, '#dlg-pdf');
  assert.equal(w.dol, 0, 'przy dolnej krawędzi');
  assert.ok(w.szerokosc > 0.85 && w.szerokosc < 1, `szeroka, ale nie na całą szerokość (${Math.round(w.szerokosc * 100)}%)`);
  assert.ok(Math.abs(w.lewo - w.prawo) <= 1, 'na środku');
  assert.ok(w.rogiGora > 0 && w.rogiDol === 0);
  assert.ok(w.uchwyt && !w.x);
  assert.deepEqual(tablet.bledy, []);

  const komputer = await otworz(t);
  assert.equal(await komputer.strona.evaluate(() => document.documentElement.hasAttribute('data-zaslonka')), false);
  await nowyProjekt(komputer.strona, 'Komputer');
  await komputer.strona.click('#przycisk-wiecej');
  await komputer.strona.click('#menu-wiecej [data-akcja="pdf"]');
  await komputer.strona.waitForSelector('#dlg-pdf[open]');
  const k = await wyglad(komputer.strona, '#dlg-pdf');
  assert.ok(k.gora > 0 && k.dol > 0, 'okno na środku, nie przy krawędzi');
  assert.ok(k.rogiDol > 0, 'zaokrąglone wszystkie rogi');
  assert.ok(k.x && !k.uchwyt, 'krzyżyk, bez uchwytu');
  await komputer.strona.click('#dlg-pdf .x-okna');
  await komputer.strona.waitForFunction(() => !document.querySelector('#dlg-pdf').open);
  assert.deepEqual(komputer.bledy, []);
});
