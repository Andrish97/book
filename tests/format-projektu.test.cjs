// Zmiana formatu ze skalowaniem (#131D): geometria (js/format-projektu.js) i okno w aplikacji.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

function projektA5() {
  const wydruk = { format: 'A5', szerokosc_mm: 148, wysokosc_mm: 210, spad_mm: 3, marginesy: { gora: 10, dol: 10, wewnetrzny: 10, zewnetrzny: 10 } };
  return {
    sekcje: [{ id: 's1', nazwa: 'Środek', wydruk, wzorce: ['w1'] }, { id: 'ok', nazwa: 'Okładka', wydruk: { ...wydruk, szerokosc_mm: 300 }, okladka: { oprawa: 'miekka' }, wzorce: [] }],
    wzorce: [{ id: 'w1', wydruk: { ...wydruk }, obiekty: [{ type: 'textbox', id: 'nr', left: 69, top: 200, width: 10, fontSize: 4 }] }],
    strony: [{ id: 'p1', sekcja: 's1', nazwa: 'Strona 1', prowadnice: { x: [74], y: [] }, obiekty: [
      { type: 'rect', id: 'tlo', left: -3, top: -3, width: 154, height: 216, scaleX: 1, scaleY: 1 },
      { type: 'textbox', id: 'tytul', left: 10, top: 10, width: 128, fontSize: 8, styles: [{ start: 0, end: 3, style: { fontSize: 12 } }] },
      { type: 'rect', id: 'stopka', left: 120, top: 190, width: 18, height: 10 },
    ] }],
  };
}

test('skaluj (zmieść): A5 → A4 – elementy, pismo, marginesy, prowadnice i wzorce proporcjonalnie; okładka pominięta', async () => {
  const { zmienFormat } = await modul('js/format-projektu.js');
  const p = projektA5();
  const w = zmienFormat(p, ['s1', 'ok'], { szerokosc_mm: 210, wysokosc_mm: 297 }, { sposob: 'skaluj', dopasowanie: 'zmiesc' });
  assert.deepEqual(w.sekcje, ['s1']);
  assert.deepEqual(w.pominieteOkladki, ['Okładka']);
  const s = Math.min(210 / 148, 297 / 210);
  const sek = p.sekcje[0].wydruk;
  assert.equal(sek.format, 'A4');
  assert.ok(Math.abs(sek.marginesy.gora - 10 * s) < 0.01);
  const t = p.strony[0].obiekty.find((o) => o.id === 'tytul');
  assert.ok(Math.abs(t.fontSize - 8 * s) < 0.01, 'pismo rośnie, ramka tekstu bez skali');
  assert.ok(Math.abs(t.styles[0].style.fontSize - 12 * s) < 0.01, 'fragment o innym rozmiarze też');
  assert.equal(t.scaleX, undefined);
  const r = p.strony[0].obiekty.find((o) => o.id === 'stopka');
  assert.ok(Math.abs(r.scaleX - s) < 0.001);
  const dx = (210 - 148 * s) / 2;
  assert.ok(Math.abs(r.left - (120 * s + dx)) < 0.01, 'wyśrodkowane');
  assert.ok(Math.abs(p.strony[0].prowadnice.x[0] - (74 * s + dx)) < 0.01);
  assert.equal(p.wzorce[0].wydruk.szerokosc_mm, 210);
  assert.ok(Math.abs(p.wzorce[0].obiekty[0].fontSize - 4 * s) < 0.01, 'wzorzec sekcji też');
  assert.equal(p.sekcje[1].wydruk.szerokosc_mm, 300, 'okładka bez zmian');
});

test('przesuń: rozmiary zostają, elementy przy krawędzi trzymają się jej, tło się rozciąga; „tylko format” nic nie rusza', async () => {
  const { zmienFormat, elementyPozaStrona } = await modul('js/format-projektu.js');
  const p = projektA5();
  zmienFormat(p, ['s1'], { szerokosc_mm: 210, wysokosc_mm: 297 }, { sposob: 'przesun' });
  const o = Object.fromEntries(p.strony[0].obiekty.map((x) => [x.id, x]));
  assert.equal(o.tytul.fontSize, 8);
  assert.equal(o.tytul.width, 128 + 62, 'tekst na całą szerokość rozciąga się');
  assert.equal(o.stopka.left, 120 + 62);
  assert.equal(o.stopka.top, 190 + 87);
  assert.ok(Math.abs(o.tlo.scaleX * 154 - (154 + 62)) < 0.2);
  assert.deepEqual(p.sekcje[0].wydruk.marginesy, { gora: 10, dol: 10, wewnetrzny: 10, zewnetrzny: 10 });
  const q = projektA5();
  zmienFormat(q, ['s1'], { szerokosc_mm: 105, wysokosc_mm: 148 }, { sposob: 'format' });
  assert.equal(q.strony[0].obiekty[2].left, 120);
  assert.ok(elementyPozaStrona(q, ['s1']).length >= 1, 'stopka wychodzi poza A6');
});

test('okno „Zmień format projektu”: podgląd przed i po, zastosowanie, cofnięcie jednym krokiem', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Format');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].obiekty.length === 1);
  await strona.waitForTimeout(600);
  const przed = await strona.evaluate(() => ({ ...window.seriodruk.stan.projekt.strony[0].obiekty[0] }));
  await strona.click('#przycisk-wiecej');
  await strona.click('#menu-wiecej [data-akcja="format-projektu"]');
  await strona.waitForSelector('#dlg-format[open]');
  assert.equal(await strona.locator('#format-przed svg').count(), 1);
  assert.equal(await strona.locator('#format-po svg').count(), 1);
  await strona.evaluate(() => {
    const f = document.querySelector('#form-format');
    f.elements.format.value = 'A4';
    f.elements.format.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await strona.click('#format-zastosuj');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].wydruk.szerokosc_mm === 210);
  const po = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty[0]);
  assert.ok(po.scaleX > 1.3, `prostokąt przeskalowany (${po.scaleX})`);
  await strona.waitForTimeout(1200);
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].wydruk.szerokosc_mm === 148);
  const cofniety = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty[0]);
  assert.equal(cofniety.left, przed.left);
  // Z okna sekcji – ten sam przycisk dla jednej sekcji.
  await strona.evaluate(async () => (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(window.seriodruk.stan.projekt.sekcje[0].id));
  await strona.waitForSelector('#dlg-sekcja[open]');
  await strona.click('#dlg-sekcja [data-akcja="format-sekcji"]');
  await strona.waitForSelector('#dlg-format[open]');
  assert.match(await strona.textContent('#format-zakres'), /Sekcja/);
  assert.deepEqual(bledy, []);
});
