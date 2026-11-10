const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const nazwyStron = (strona) => strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => s.nazwa));

test('cofanie: jedna historia całego projektu – strony, przejścia między stronami, dane, ponawianie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Cofanie');
  const krok = () => strona.waitForTimeout(450); // osobny krok historii
  const elementy = () => strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => s.obiekty.length));
  assert.ok(await strona.isDisabled('[data-akcja="cofnij"]'), 'nowy projekt nie ma czego cofać');

  await strona.click('[data-akcja="dodaj-tekst"]');
  await krok();
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await krok();
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await krok();
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await elementy(), [1, 1]);

  // Usunięcie pierwszej strony (z tekstem) i cofnięcie przyciskiem w powiadomieniu.
  await strona.click('#lista-stron li.strona >> nth=0 >> .menu-miniatury');
  await strona.click('#menu-strony [data-akcja="strona-usun"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 1);
  await strona.click('#powiadomienie button');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  assert.deepEqual(await nazwyStron(strona), ['Strona 1', 'Strona 2']);
  assert.deepEqual(await elementy(), [1, 1], 'strona wróciła z treścią');

  // Ctrl+Z cofa po kolei, także to, co zrobiono na innej stronie: prostokąt ze strony 2,
  // dodanie strony 2, a na końcu tekst ze strony 1 – edytor sam przechodzi tam, gdzie była zmiana.
  await strona.keyboard.press('Escape');
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[1]?.obiekty.length === 0);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.indeks), 1);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 1);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].obiekty.length === 0 && window.seriodruk.edytor.canvas.getObjects().length === 0);
  assert.ok(await strona.isDisabled('[data-akcja="cofnij"]'));

  // Ponów ×3 przywraca wszystko.
  for (let i = 0; i < 3; i += 1) { await strona.keyboard.press('Control+Shift+z'); await strona.waitForTimeout(250); }
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  assert.deepEqual(await elementy(), [1, 1]);
  // Dalej w przód jest jeszcze cofnięte wcześniej usunięcie strony.
  assert.ok(await strona.isEnabled('[data-akcja="ponow"]'));

  // Zmiana w tabeli też jest krokiem historii (po zamknięciu okna danych).
  await strona.click('[data-akcja="dane"]');
  await strona.click('#dane-nowa');
  await strona.locator('#dane-siatka td[data-w="0"][data-k="0"]').click();
  await strona.keyboard.type('abc');
  await strona.click('#dane-zamknij');
  await strona.waitForFunction(() => !document.querySelector('#dlg-dane').open);
  await krok();
  await strona.waitForTimeout(400);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.tabele.length), 1);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele.length === 0);

  // Nowa zmiana po cofnięciu odcina kroki „do przodu”.
  await strona.click('[data-akcja="dodaj-elipse"]');
  await krok();
  assert.ok(await strona.isDisabled('[data-akcja="ponow"]'));
  assert.deepEqual(bledy, []);
});

test('lista stron: przeciągnięcie zmienia kolejność; wzorce: kolejność z menu', async (t) => {
  // Wysokie okno: cała lista stron jest widoczna, więc przeciąganie nie zależy od przewijania listy.
  const { strona, bledy } = await otworz(t, { widok: { width: 1280, height: 1500 } });
  await nowyProjekt(strona, 'Kolejność');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 3);

  // Strona 3 przeciągnięta przed stronę 1.
  await strona.locator('#lista-stron li.strona >> nth=2').dragTo(strona.locator('#lista-stron li.strona >> nth=0'), { targetPosition: { x: 60, y: 6 } });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].nazwa === 'Strona 3');
  assert.deepEqual(await nazwyStron(strona), ['Strona 3', 'Strona 1', 'Strona 2']);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[window.seriodruk.stan.indeks].nazwa), 'Strona 3', 'bieżąca strona zostaje bieżącą');
  await strona.waitForTimeout(450);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].nazwa === 'Strona 1');

  // Dwa wzorce; drugi przesunięty wyżej leży potem pierwszy na liście (czyli niżej na stronie).
  for (let i = 0; i < 2; i += 1) {
    await strona.click('#zakladki-listy label:has-text("Wzorce")');
    await strona.click('[data-akcja="wzorzec-dodaj"]');
    await strona.waitForFunction((n) => window.seriodruk.stan.projekt.wzorce.length === n, i + 1);
    await strona.click('[data-akcja="wroc-do-stron"]');
    await strona.waitForFunction(() => window.seriodruk.stan.tryb === 'strona');
  }
  await strona.click('#zakladki-listy label:has-text("Wzorce")');
  await strona.click('#lista-wzorcow li >> nth=1 >> .menu-miniatury');
  await strona.click('#menu-wzorca [data-akcja="wzorzec-gora"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.wzorce[0].nazwa === 'Wzorzec 2');
  assert.deepEqual(bledy, []);
});

test('panel: sekcje da się zwijać i zostają zwinięte; rozkładówka jako jedna strona', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', 'Panel');
  await strona.click('#form-nowy label:has-text("Rozkładówki")');
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 2 && window.seriodruk.edytor.strony.length === 2);

  // Zwinięcie sekcji „Seria (powielanie)” chowa jej pola; po przebudowaniu panelu zostaje zwinięta.
  const pole = strona.locator('#wlasciwosci label:has-text("Seria") select');
  assert.ok(await pole.isVisible());
  await strona.click('#wlasciwosci .zwijak:has-text("Seria")');
  assert.ok(await pole.isHidden());
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.keyboard.press('Escape');
  assert.ok(await strona.locator('#wlasciwosci label:has-text("Seria") select').isHidden());
  await strona.click('#wlasciwosci .zwijak:has-text("Seria")');
  assert.ok(await strona.locator('#wlasciwosci label:has-text("Seria") select').isVisible());

  // Jedna strona zamiast rozkładówki: płótno ma jedną stronę z marginesami jej strony rozkładówki.
  await strona.click('#przycisk-widok');
  await strona.check('#widok-jedna');
  await strona.waitForFunction(() => window.seriodruk.edytor.strony.length === 1);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.marg.grzbiet), 'lewy'); // strona 3 jest prawa
  await strona.uncheck('#widok-jedna');
  await strona.waitForFunction(() => window.seriodruk.edytor.strony.length === 2);
  assert.deepEqual(bledy, []);
});

test('wzorzec z odbiciem lustrzanym odbija także układ wewnątrz grupy', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Lustro');
  const srodki = await strona.evaluate(async () => {
    const { nowyProjekt: nowy, nowaStrona, normalizuj } = await import('./js/projekt.js');
    const { warstwyWzorcow } = await import('./js/zlozenie.js');
    const { rozwin } = await import('./js/serie.js');
    const p = nowy('L', undefined, 'rozkladowki');
    p.strony.push(nowaStrona('Strona 2', p.sekcje[0].id));
    const a = new fabric.Rect({ left: 100, top: 10, width: 10, height: 10, strokeWidth: 0, nazwa: 'a' });
    const b = new fabric.Rect({ left: 130, top: 10, width: 10, height: 10, strokeWidth: 0, nazwa: 'b' });
    const grupa = new fabric.Group([a, b]);
    p.wzorce.push({ id: 'wz', nazwa: 'W', wydruk: p.sekcje[0].wydruk, tlo: null, lustro: true, obiekty: [grupa.toObject(['nazwa'])] });
    p.sekcje[0].wzorce = ['wz'];
    const proj = normalizuj(p);
    const ciag = rozwin(proj);
    const wynik = {};
    for (const s of proj.strony) {
      const { pod } = await warstwyWzorcow(proj, s, ciag);
      const g = pod[0];
      const m = g.calcTransformMatrix();
      wynik[ciag.pierwszy.get(s.id).bok] = Object.fromEntries(g.getObjects().map((o) => [o.nazwa, Math.round(fabric.util.transformPoint(o.getCenterPoint(), m).x)]));
    }
    return wynik;
  });
  // Prawa strona: a w 105, b w 135. Lewa: odbicie względem środka strony (148 mm) – a w 43, b w 13.
  assert.deepEqual(srodki, { prawa: { a: 105, b: 135 }, lewa: { a: 43, b: 13 } });
  assert.deepEqual(bledy, []);
});

test('kształty: wielokąt i gwiazda, wypełnienie gradientem, cień – zapisują się i rysują w podglądzie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kształty');
  await strona.keyboard.press('p');
  const ksztalt = () => strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; const c = o.getCenterPoint(); return { typ: o.type, punkty: o.points.length, srodek: [Math.round(c.x), Math.round(c.y)], szer: Math.round(o.getScaledWidth()) }; });
  const start = await ksztalt();
  assert.deepEqual([start.typ, start.punkty], ['polygon', 3]);

  await strona.fill('#wlasciwosci label:has-text("Liczba boków") input', '5');
  await strona.press('#wlasciwosci label:has-text("Liczba boków") input', 'Tab');
  await strona.check('#wlasciwosci label:has-text("Gwiazda") input');
  const gwiazda = await ksztalt();
  assert.equal(gwiazda.punkty, 10);
  assert.deepEqual(gwiazda.srodek, start.srodek, 'środek zostaje w miejscu');

  await strona.check('#wlasciwosci label:has-text("Przejście kolorów") input');
  await strona.click('#wlasciwosci button[title="Pionowo"]');
  await strona.check('#wlasciwosci label:has-text("Cień pod elementem") input');
  await strona.fill('#wlasciwosci label:has-text("Rozmycie") input', '4');
  await strona.press('#wlasciwosci label:has-text("Rozmycie") input', 'Tab');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  const zapis = await strona.evaluate(() => { const o = window.seriodruk.stan.projekt.strony[0].obiekty[0]; return { boki: o.boki, gwiazda: o.gwiazda, gradient: [o.fill.type, o.fill.coords.y2, o.fill.colorStops.length], cien: [o.shadow.blur, o.shadow.offsetX] }; });
  assert.deepEqual(zapis, { boki: 5, gwiazda: true, gradient: ['linear', 1, 2], cien: [4, 1.5] });

  // Po ponownym otwarciu kształt wraca z gradientem i cieniem, a strona daje się narysować.
  await strona.reload();
  await strona.click('#tryb-lokalny');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.canvas.getObjects().length === 1);
  const poWczytaniu = await strona.evaluate(async () => {
    const o = window.seriodruk.edytor.canvas.getObjects()[0];
    const { renderujCel } = await import('./js/zlozenie.js');
    const p = window.seriodruk.stan.projekt;
    const url = await renderujCel(p, p.strony[0], { szerokoscPx: 200 });
    return [o.points.length, typeof o.fill, Boolean(o.shadow), url.startsWith('data:image/png')];
  });
  assert.deepEqual(poWczytaniu, [10, 'object', true, true]);
  assert.deepEqual(bledy, []);
});

test('kadrowanie obrazu przeciąganiem: ramka wyznacza fragment, Enter zatwierdza, Esc anuluje', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kadr');
  // Obraz 200 × 100 px wstawiony w skali 0,5 mm/px: 100 × 50 mm w punkcie (20, 30).
  await strona.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 100;
    const x = c.getContext('2d'); x.fillStyle = '#2f5bd3'; x.fillRect(0, 0, 200, 100);
    const { edytor, stan } = window.seriodruk;
    const img = await edytor.dodajObraz(c.toDataURL('image/png'), 'niebieski.png', stan.projekt.zasoby);
    img.set({ left: 20, top: 30, scaleX: 0.5, scaleY: 0.5 });
    edytor.zatwierdz();
  });
  const obraz = () => strona.evaluate(() => { const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'image'); return [o.left, o.top, o.cropX, o.cropY, o.width, o.height].map((v) => Math.round(v)); });
  assert.deepEqual(await obraz(), [20, 30, 0, 0, 200, 100]);

  await strona.click('#wlasciwosci button:has-text("Kadruj przeciąganiem")');
  assert.equal(await strona.textContent('#tytul-wlasciwosci'), 'Kadrowanie');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.kadruje), true);
  // Ramka zwężona do prawej połowy i dolnych 60% obrazu.
  await strona.evaluate(() => { const r = window.seriodruk.edytor.aktywny; r.set({ left: 70, top: 50, width: 50, height: 30, scaleX: 1, scaleY: 1 }); r.setCoords(); });
  await strona.keyboard.press('Enter');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.kadruje), false);
  // 50 mm od lewej krawędzi obrazu = 100 px, 20 mm od góry = 40 px; treść obrazu nie zmienia miejsca.
  assert.deepEqual(await obraz(), [70, 50, 100, 40, 100, 60]);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().length), 1, 'ramka kadrowania znika');

  // Drugie kadrowanie pokazuje cały obraz; Esc przywraca poprzedni kadr.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.kadruj(e.aktywny); e.aktywny.set({ left: 20, top: 30, width: 10, height: 10 }); });
  await strona.keyboard.press('Escape');
  assert.deepEqual(await obraz(), [70, 50, 100, 40, 100, 60]);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.length), 1);
  assert.deepEqual(bledy, []);
});
