const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const nazwyStron = (strona) => strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => s.nazwa));

test('cofanie operacji na stronach: usunięcie strony wraca przyciskiem i skrótem; zmiana na stronie zamyka tę możliwość', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Cofanie');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 3);

  // Usunięcie pierwszej strony (z tekstem) i cofnięcie przyciskiem w powiadomieniu.
  await strona.click('#lista-stron li.strona >> nth=0 >> .menu-miniatury');
  await strona.click('#menu-strony [data-akcja="strona-usun"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  assert.deepEqual(await nazwyStron(strona), ['Strona 2', 'Strona 3']);
  await strona.click('#powiadomienie button');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 3);
  assert.deepEqual(await nazwyStron(strona), ['Strona 1', 'Strona 2', 'Strona 3']);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.length), 1, 'strona wróciła z treścią');

  // To samo skrótem Ctrl+Z, zaraz po usunięciu.
  await strona.click('#lista-stron li.strona >> nth=1 >> .menu-miniatury');
  await strona.click('#menu-strony [data-akcja="strona-usun"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 3);

  // Po zmianie na stronie cofnięcie usunięcia nie jest już możliwe (Ctrl+Z cofa zmianę na stronie).
  await strona.click('#lista-stron li.strona >> nth=2 >> .menu-miniatury');
  await strona.click('#menu-strony [data-akcja="strona-usun"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.waitForTimeout(400);
  await strona.keyboard.press('Escape');
  await strona.keyboard.press('Control+z');
  await strona.waitForTimeout(300);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony.length), 2);
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
