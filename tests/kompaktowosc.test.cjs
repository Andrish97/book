// Kompaktowość i ikony (#103): paleta poleceń Ctrl+K, zwijane „Zaawansowane” w eksporcie PDF,
// ikony zamiast przycisków z napisem (Dane, czcionki, obrazy, import), nagłówek jednej sekcji w podglądzie.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('paleta poleceń: Ctrl+K, szukanie po kilku literach (bez polskich znaków), Enter wykonuje; Esc zamyka', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Paleta');
  await strona.keyboard.press('Control+k');
  await strona.waitForSelector('#paleta-polecen[open]');
  const lista = await strona.locator('.paleta-lista li').allTextContents();
  assert.ok(lista.length >= 5, `lista poleceń: ${lista.length}`);
  await strona.fill('.paleta-pole', 'pdf');
  assert.match(await strona.textContent('.paleta-lista li[aria-selected="true"]'), /PDF/);
  await strona.keyboard.press('Enter');
  await strona.waitForSelector('#dlg-pdf[open]');
  assert.equal(await strona.locator('#paleta-polecen[open]').count(), 0);
  await strona.keyboard.press('Escape');
  await strona.waitForFunction(() => !document.querySelector('#dlg-pdf[open]'));
  // Bez ogonków: „czcionki” znajdzie się po „czcion”, „wzorce” po „wzor”.
  await strona.keyboard.press('Control+k');
  await strona.fill('.paleta-pole', 'czcion');
  assert.match(await strona.textContent('.paleta-lista li[aria-selected="true"]'), /Czcionki/);
  await strona.keyboard.press('Escape');
  assert.deepEqual(bledy, []);
});

test('ikony zamiast napisów i zwijane ustawienia: Dane, PDF (komputer rozwinięte), czcionki, obrazy, import, podgląd', async (t) => {
  const { strona } = await otworz(t);
  await nowyProjekt(strona, 'Ikony');
  const ikony = await strona.evaluate(() => ['#dane-importuj', '#dane-nowa', '#dane-csv'].map((s) => {
    const b = document.querySelector(s);
    return { tekst: b.textContent.trim(), etykieta: b.getAttribute('aria-label'), tytul: Boolean(b.title), ikona: Boolean(b.querySelector('svg')) };
  }));
  for (const b of ikony) assert.deepEqual([b.tekst, Boolean(b.etykieta), b.tytul, b.ikona], ['', true, true, true]);
  const imp = await strona.evaluate(() => { const b = document.querySelector('.przyciski-naglowka [data-akcja="importuj-projekt"]'); return b ? b.getAttribute('aria-label') : null; });
  assert.ok(imp === null || /Importuj/.test(imp));
  // PDF: na komputerze „Zaawansowane” rozwinięte, z podsumowaniem do zwinięcia.
  await strona.evaluate(() => document.querySelector('[data-akcja="pdf"]').click());
  await strona.waitForSelector('#dlg-pdf[open]');
  assert.equal(await strona.evaluate(() => document.querySelector('#pdf-zaawansowane').open), true);
  assert.match(await strona.textContent('#pdf-zaawansowane-opis'), /dpi.*RGB|RGB/);
  await strona.keyboard.press('Escape');
  // Podgląd: projekt z jedną sekcją – bez nagłówka sekcji.
  await strona.evaluate(async () => { const { pokazPodglad } = await import('./js/app/podglad-ekran.js'); await pokazPodglad(); });
  await strona.waitForSelector('.podglad-sekcja');
  assert.equal(await strona.evaluate(() => document.querySelector('.podglad-sekcja h2').hidden), true);
});

test('telefon: „Zaawansowane” w eksporcie PDF zwinięte z podsumowaniem; czcionki zestawu z ikoną pobierania', async (t) => {
  const { strona } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Telefon');
  await strona.evaluate(() => document.querySelector('[data-akcja="pdf"]').click());
  await strona.waitForSelector('#dlg-pdf[open]');
  const pdf = await strona.evaluate(() => ({ open: document.querySelector('#pdf-zaawansowane').open, opis: document.querySelector('#pdf-zaawansowane-opis').textContent }));
  assert.equal(pdf.open, false);
  assert.ok(pdf.opis.length > 3, `podsumowanie: ${pdf.opis}`);
  await strona.evaluate(() => document.querySelector('#dlg-pdf').close());
  await strona.evaluate(() => document.querySelector('[data-akcja="czcionki"]').click());
  await strona.waitForSelector('#czcionki-zestaw li button');
  const cz = await strona.evaluate(() => { const li = document.querySelector('#czcionki-zestaw li'); const b = li.querySelector('button'); return { nazwa: li.querySelector('.nazwa-rodziny').textContent, etykieta: b.getAttribute('aria-label'), tekst: b.textContent.trim(), wys: b.getBoundingClientRect().height }; });
  assert.ok(cz.nazwa.length > 1);
  assert.match(cz.etykieta, /Pobierz pliki czcionki/);
  assert.equal(cz.tekst, '');
  assert.ok(cz.wys >= 40, `cel dotyku ${cz.wys}`);
  // Długie opisy okien zwinięte do dwóch linii (stuknięcie rozwija).
  const opisy = await strona.evaluate(() => [...document.querySelectorAll('dialog p.ciche.podpowiedz-zwijana')].length);
  assert.ok(opisy >= 3, `zwinięte opisy okien: ${opisy}`);
});

test('wybór koloru: kolory użyte w projekcie (najczęstsze najpierw) – także z obrysów, teł i grup', async (t) => {
  const { strona } = await otworz(t);
  await nowyProjekt(strona, 'Kolory');
  const kolory = await strona.evaluate(async () => {
    const { koloryProjektu } = await import('./js/kontrolki.js');
    const p = { strony: [{ tlo: '#FFEEDD', obiekty: [{ fill: '#123456' }, { fill: '#123456', stroke: '#abcdef' }, { type: 'group', objects: [{ fill: '#123456' }, { fill: 'rgba(0,0,0,.5)' }] }] }], wzorce: [{ obiekty: [{ stroke: '#ABCDEF' }] }] };
    return koloryProjektu(p);
  });
  assert.deepEqual(kolory, ['#123456', '#abcdef', '#ffeedd']);
});
