// Decyzja #115: warstwy w osobnym panelu (zawsze pod ręką), nagłówek panelu mówi, czego dotyczą ustawienia
// (zaznaczony element, narzędzie, strona), tabela: „Cała tabela” i „Kolumna i wiersz” klikniętej komórki.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const naglowek = (strona) => strona.evaluate(() => {
  const n = document.querySelector('#naglowek-wlasciwosci');
  return {
    rodzaj: n.dataset.rodzaj, nad: n.querySelector('.nad-tytulem')?.textContent, tytul: n.querySelector('h2').textContent,
    opis: n.querySelector('.opis-naglowka')?.hidden ? '' : n.querySelector('.opis-naglowka')?.textContent,
  };
});

test('panel: warstwy w zakładce obok właściwości (#171), nagłówek element / narzędzie / strona, pędzel dla następnych linii', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1440, height: 900 } });
  await nowyProjekt(strona, 'Panel');
  // Nic nie zaznaczone: strona; warstwy w zakładce obok – dostępne bez zaznaczenia.
  assert.deepEqual(await naglowek(strona), { rodzaj: 'strona', nad: 'Nic nie jest zaznaczone', tytul: 'Strona', opis: '' });
  assert.equal(await strona.isVisible('#lista-warstw'), false, 'na zakładce Właściwości warstw nie widać');
  await strona.click('#zakladka-warstwy');
  assert.ok(await strona.isVisible('#dok-warstw #lista-warstw'), 'warstwy bez zaznaczenia');
  assert.equal(await strona.isVisible('#wlasciwosci'), false, 'warstwy na całą wysokość, bez właściwości');
  await strona.click('#zakladka-wlasciwosci');

  // Zaznaczony element.
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny);
  assert.deepEqual(await naglowek(strona), { rodzaj: 'element', nad: 'Zaznaczony element', tytul: 'Prostokąt', opis: '' });
  assert.equal(await strona.textContent('#licznik-warstw-zakladka'), '1', 'licznik warstw na zakładce');

  // Narzędzie „Rysuj”: ustawienia pędzla, inny kolor nagłówka; warstwy dalej widać.
  await strona.click('[data-akcja="rysuj"]');
  assert.deepEqual(await naglowek(strona), { rodzaj: 'narzedzie', nad: 'Ustawienia narzędzia', tytul: 'Rysowanie', opis: 'Tak będą wyglądać następne linie.' });
  await strona.waitForTimeout(400); // przejście koloru tła
  const tla = await strona.evaluate(() => getComputedStyle(document.querySelector('#naglowek-wlasciwosci')).backgroundColor);
  assert.notEqual(tla, 'rgba(0, 0, 0, 0)', 'nagłówek narzędzia ma własne tło');
  assert.ok(await strona.isVisible('#zakladka-warstwy'), 'warstwy dostępne także przy narzędziu');
  await strona.fill('.wlasciwosci label:has-text("Grubość linii") input', '1.5');
  await strona.press('.wlasciwosci label:has-text("Grubość linii") input', 'Tab');
  const [x, y] = await strona.evaluate(() => { const r = document.querySelector('#plotno').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await strona.mouse.move(x, y);
  await strona.mouse.down();
  for (let i = 1; i <= 8; i += 1) await strona.mouse.move(x + i * 12, y + i * 6);
  await strona.mouse.up();
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'path'));
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'path').strokeWidth), 1.5, 'nowa linia z grubością narzędzia');
  await strona.click('.wlasciwosci button:has-text("Zakończ rysowanie")');
  assert.equal((await naglowek(strona)).rodzaj, 'strona');

  // Wybrana zakładka zostaje zapamiętana; F7 przełącza.
  await strona.click('#zakladka-warstwy');
  assert.ok(await strona.isVisible('#lista-warstw li.warstwa'));
  assert.equal(await strona.textContent('#licznik-warstw-zakladka'), '2', 'licznik także przy otwartych właściwościach');
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk?.edytor?.wydruk);
  assert.equal(await strona.getAttribute('#zakladka-warstwy', 'aria-selected'), 'true');
  assert.ok(await strona.isVisible('#lista-warstw'));
  await strona.keyboard.press('F7');
  assert.equal(await strona.getAttribute('#zakladka-wlasciwosci', 'aria-selected'), 'true');
  assert.ok(await strona.isVisible('#wlasciwosci'));
  assert.deepEqual(bledy, []);
});

test('tabela: kliknięta komórka – szerokość jej kolumny, wysokość wiersza, wstaw i usuń; bez list wszystkich wierszy', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1440, height: 900 } });
  await nowyProjekt(strona, 'Tabela');
  await strona.click('[data-akcja="dodaj-tabele"]');
  await strona.waitForSelector('#dlg-tabela[open]');
  await strona.fill('#dlg-tabela input[name=wiersze]', '6');
  await strona.fill('#dlg-tabela input[name=kolumny]', '3');
  await strona.click('#dlg-tabela button[value=tak]');
  await strona.waitForFunction(() => window.seriodruk.edytor?.aktywny?.tabela);
  const sekcje = await strona.locator('.wlasciwosci legend').allTextContents();
  assert.ok(sekcje.includes('Cała tabela') && sekcje.includes('Kolumna i wiersz'), `sekcje: ${sekcje}`);
  assert.equal(await strona.locator('.wlasciwosci label:has-text("Wiersz 5")').count(), 0, 'bez listy wszystkich wierszy');
  assert.match(await strona.textContent('.wlasciwosci .kolumna-i-wiersz'), /Kliknij komórkę tabeli/);

  // Kliknięcie komórki w 2. kolumnie, 3. wierszu (tabela zostaje zaznaczona w całości).
  const punkt = await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const g = e.aktywny;
    const k = e.komorkiTabeli(g)[2 * 3 + 1];
    const m = fabric.util.multiplyTransformMatrices(e.canvas.viewportTransform, k.calcTransformMatrix());
    const r = e.canvas.upperCanvasEl.getBoundingClientRect();
    return [r.left + m[4], r.top + m[5]];
  });
  await strona.mouse.click(punkt[0], punkt[1]);
  await strona.waitForFunction(() => /kolumna 2, wiersz 3/.test(document.querySelector('.wlasciwosci .wybrana-komorka')?.textContent || ''));
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny?.tabela ? 'tabela' : 'inne'), 'tabela');

  await strona.fill('.wlasciwosci label:has-text("Szerokość kolumny 2") input', '50');
  await strona.press('.wlasciwosci label:has-text("Szerokość kolumny 2") input', 'Tab');
  await strona.fill('.wlasciwosci label:has-text("Wysokość wiersza 3") input', '15');
  await strona.press('.wlasciwosci label:has-text("Wysokość wiersza 3") input', 'Tab');
  let t1 = await strona.evaluate(() => { const g = window.seriodruk.edytor.aktywny; return { k: g.tabela.kolumny, w: g.tabela.wiersze }; });
  assert.equal(t1.k[1], 50);
  assert.equal(t1.w[2], 15);
  assert.deepEqual([t1.w[1], t1.w[3]], [9, 9], 'inne wiersze bez zmian');

  await strona.click('.wlasciwosci .kolumna-i-wiersz button:has-text("Kolumna przed")');
  await strona.click('.wlasciwosci .kolumna-i-wiersz button:has-text("Usuń wiersz")');
  t1 = await strona.evaluate(() => { const g = window.seriodruk.edytor.aktywny; return { k: g.tabela.kolumny.length, w: g.tabela.wiersze.length }; });
  assert.deepEqual(t1, { k: 4, w: 5 });

  // Dwa kliknięcia – pisanie w komórce; panel komórki ma te same nazwy.
  await strona.mouse.dblclick(punkt[0], punkt[1]);
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.isEditing);
  assert.ok(await strona.isVisible('.wlasciwosci .kolumna-i-wiersz button:has-text("Wiersz pod")'));
  assert.deepEqual(bledy, []);
});

test('telefon: zakładka „Warstwy” w dolnym menu – arkusz z samą listą; we Właściwościach warstw nie ma', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Telefon');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.dodajProstokat(); e.zatwierdz(); });
  await strona.tap('.zakladki-mobilne [data-panel="warstwy"]');
  await strona.waitForFunction(() => getComputedStyle(document.querySelector('.panel-inspektor')).transform === 'none');
  assert.ok(await strona.isVisible('#lista-warstw li.warstwa'));
  assert.equal(await strona.isVisible('#wlasciwosci'), false);
  assert.equal(await strona.isVisible('#naglowek-warstw'), false);
  const wys = await strona.evaluate(() => document.querySelector('#lista-warstw li.warstwa').getBoundingClientRect().height);
  assert.ok(wys >= 44, `wiersz pod palec: ${wys}`);
  await strona.tap('.zakladki-mobilne [data-panel="inspektor"]');
  await strona.waitForTimeout(250);
  assert.ok(await strona.isVisible('#wlasciwosci'));
  assert.equal(await strona.isVisible('#dok-warstw'), false);
  assert.deepEqual(bledy, []);
});
