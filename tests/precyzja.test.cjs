const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Punkt na ekranie odpowiadający położeniu (mm) na arkuszu.
const naEkranie = (strona, x, y) => strona.evaluate(([mx, my]) => {
  const e = window.seriodruk.edytor;
  const r = e.canvas.upperCanvasEl.getBoundingClientRect();
  const v = e.canvas.viewportTransform;
  return { x: r.left + v[4] + mx * v[0], y: r.top + v[5] + my * v[3] };
}, [x, y]);

// Przeciąga myszą z punktu do punktu (mm); zatrzymuje się przed puszczeniem przycisku.
async function przeciagnij(strona, z, d, { pusc = true, klawisz = null } = {}) {
  const a = await naEkranie(strona, ...z);
  const b = await naEkranie(strona, ...d);
  if (klawisz) await strona.keyboard.down(klawisz);
  await strona.mouse.move(a.x, a.y);
  await strona.mouse.down();
  await strona.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await strona.mouse.move(b.x, b.y, { steps: 4 });
  if (pusc) await strona.mouse.up();
  if (klawisz && pusc) await strona.keyboard.up(klawisz);
}

const prostokaty = (strona, lista) => strona.evaluate((dane) => {
  const e = window.seriodruk.edytor;
  for (const [nazwa, left, top, width, height] of dane) {
    const r = e.dodajProstokat();
    r.set({ left, top, width, height, strokeWidth: 0, nazwa });
    r.setCoords();
  }
  e.canvas.discardActiveObject();
  e.zatwierdz();
}, lista);

const polozenie = (strona, nazwa) => strona.evaluate((n) => {
  const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.nazwa === n);
  return [Math.round(o.left * 100) / 100, Math.round(o.top * 100) / 100];
}, nazwa);

test('przyciąganie (obliczenia): krawędzie, środek między sąsiadami, powtórzony odstęp, siatka', async (t) => {
  const { strona } = await otworz(t);
  const wynik = await strona.evaluate(async () => {
    const { przyciagnij, pomiary } = await import('./js/przyciaganie.js');
    const a = { x: 10, y: 10, w: 20, h: 20 };
    const b = { x: 40, y: 10, w: 20, h: 20 };
    const c = { x: 100, y: 10, w: 20, h: 20 };
    return {
      // lewa krawędź do lewej krawędzi innego elementu (leży niżej, więc bez równych odstępów)
      krawedz: przyciagnij({ x: 10.6, y: 60, w: 30, h: 10 }, { inne: [a], prog: 1 }),
      // środek między b i c: wolne 40 − 20 = 20, po 10 z każdej strony
      srodek: przyciagnij({ x: 70.7, y: 12, w: 20, h: 10 }, { inne: [b, c], prog: 1 }),
      // odstęp a–b wynosi 10; trzeci element staje 10 za b
      powtorzony: przyciagnij({ x: 69.5, y: 12, w: 5, h: 10 }, { inne: [a, b], prog: 1 }),
      // nic w zasięgu – najbliższa linia siatki co 5 mm
      siatka: przyciagnij({ x: 22.2, y: 71.4, w: 7, h: 7 }, { inne: [], siatkaX: { krok: 5, poczatek: 0 }, siatkaY: { krok: 5, poczatek: 0 }, prog: 1 }),
      // prowadnica ma pierwszeństwo przed siatką
      linia: przyciagnij({ x: 22.6, y: 71.4, w: 7, h: 7 }, { linieX: [23], siatkaX: { krok: 5, poczatek: 0 }, prog: 1 }),
      doKrawedzi: pomiary({ x: 30, y: 40, w: 10, h: 10 }, [], { x: 0, y: 0, w: 100, h: 200 }),
    };
  });
  const zaokr = (v) => Math.round(v * 100) / 100;
  assert.equal(zaokr(wynik.krawedz.dx), -0.6);
  assert.deepEqual(wynik.krawedz.linie.map((l) => [l.os, l.poz]), [['x', 10]]);
  assert.equal(zaokr(wynik.srodek.dx), -0.7);
  assert.deepEqual(wynik.srodek.pomiary.filter((m) => m.os === 'x').map((m) => [zaokr(m.wartosc), m.rowne]), [[10, true], [10, true]]);
  assert.equal(zaokr(wynik.powtorzony.dx), 0.5);
  assert.deepEqual(wynik.powtorzony.pomiary.filter((m) => m.rowne).map((m) => [m.od, m.do]).sort((p, q) => p[0] - q[0]), [[30, 40], [60, 70]]);
  assert.deepEqual([zaokr(wynik.siatka.dx), zaokr(wynik.siatka.dy)], [-2.2, -1.4]);
  assert.equal(zaokr(wynik.linia.dx), 0.4);
  assert.deepEqual(wynik.doKrawedzi.map((m) => [m.os, m.wartosc]), [['x', 30], ['x', 60], ['y', 40], ['y', 150]]);
});

test('siatka: widoczna z menu, element przeciągnięty myszą staje na linii siatki; Ctrl wyłącza przyciąganie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Siatka');
  await prostokaty(strona, [['a', 30, 30, 20, 20]]);

  await strona.click('#przycisk-widok');
  await strona.check('#widok-do-siatki');
  await strona.fill('#widok-krok', '10');
  await strona.press('#widok-krok', 'Tab');
  assert.deepEqual(await strona.evaluate(() => { const w = window.seriodruk.stan.projekt.widok; return [w.siatka, w.do_siatki, w.siatka_mm]; }), [true, true, 10]);
  await strona.keyboard.press('Escape');

  await przeciagnij(strona, [40, 40], [53, 68]); // lewy górny róg trafiłby w (43, 58), z dala od prowadnic strony
  assert.deepEqual(await polozenie(strona, 'a'), [40, 60]);

  await przeciagnij(strona, [50, 70], [63, 88], { klawisz: 'Control' });
  const swobodnie = await polozenie(strona, 'a');
  assert.ok(Math.abs(swobodnie[0] - 53) < 0.6 && Math.abs(swobodnie[1] - 78) < 0.6, `bez przyciągania: ${swobodnie}`);

  // Ustawienia siatki wracają po ponownym otwarciu projektu.
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await strona.reload();
  await strona.click('#tryb-lokalny');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
  assert.deepEqual(await strona.evaluate(() => { const w = window.seriodruk.edytor.widok; return [w.siatka, w.do_siatki, w.siatka_mm]; }), [true, true, 10]);
  assert.deepEqual(bledy, []);
});

test('odległości: wyrównanie do innego elementu, strzałki z odległością, równe odstępy', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Odległości');
  await prostokaty(strona, [['a', 20, 30, 20, 20], ['b', 50, 30, 20, 20], ['c', 100, 80, 20, 20]]);

  // c pod a: lewa krawędź c trafia w lewą krawędź a (20 mm), widać linię wyrównania.
  await przeciagnij(strona, [110, 90], [30.7, 90], { pusc: false });
  let stan = await strona.evaluate(() => { const e = window.seriodruk.edytor; return { linie: e._liniePrzyciagania.map((l) => [l.os, Math.round(l.poz)]), pomiary: e._pomiary.map((m) => [m.os, Math.round(m.wartosc * 10) / 10]) }; });
  // a i c mają tę samą szerokość, więc pasują naraz lewe krawędzie, środki i prawe.
  assert.deepEqual(stan.linie.filter((l) => l[0] === 'x').map((l) => l[1]).sort((p, q) => p - q), [20, 30, 40]);
  assert.deepEqual(stan.pomiary, [['y', 30]]); // odległość w pionie od a: 80 − 50
  await strona.mouse.up();
  assert.deepEqual(await polozenie(strona, 'c'), [20, 80]);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor._pomiary.length), 0, 'po puszczeniu strzałki znikają');

  // c w rząd za b: odstęp a–b to 10 mm, więc c staje w 80 mm i oba odstępy są oznaczone jako równe.
  await przeciagnij(strona, [30, 90], [90.6, 40.4], { pusc: false });
  stan = await strona.evaluate(() => window.seriodruk.edytor._pomiary.filter((m) => m.rowne).map((m) => [m.od, m.do]).sort((p, q) => p[0] - q[0]));
  assert.deepEqual(stan, [[40, 50], [70, 80]]);
  await strona.mouse.up();
  assert.deepEqual(await polozenie(strona, 'c'), [80, 30]);

  // Alt przy zaznaczonym elemencie pokazuje odległości także do krawędzi strony.
  await strona.keyboard.down('Alt');
  const stale = await strona.evaluate(() => window.seriodruk.edytor._pomiary.map((m) => [m.os, Math.round(m.wartosc), Boolean(m.doKrawedzi)]));
  assert.deepEqual(stale, [['x', 10, false], ['x', 48, true], ['y', 30, true], ['y', 160, true]]);
  await strona.keyboard.up('Alt');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor._pomiary.length), 0);
  assert.deepEqual(bledy, []);
});

test('skróty: zaznaczanie, kolejność, blokada, tekst, widok, kopia z Alt, ruch w jednej osi z Shift', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Skróty');
  await prostokaty(strona, [['a', 20, 30, 20, 20], ['b', 60, 30, 20, 20]]);
  const nazwy = () => strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().map((o) => o.nazwa || o.type));
  const aktywny = () => strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; return o ? (o.type === 'activeSelection' ? `zaznaczenie:${o.size()}` : o.nazwa || o.type) : null; });

  await strona.keyboard.press('Control+a');
  assert.equal(await aktywny(), 'zaznaczenie:2');
  await strona.keyboard.press('Escape');
  assert.equal(await aktywny(), null);
  await strona.keyboard.press('Tab');
  assert.equal(await aktywny(), 'a');
  await strona.keyboard.press('Tab');
  assert.equal(await aktywny(), 'b');
  await strona.keyboard.press('Shift+Tab');
  assert.equal(await aktywny(), 'a');

  // Kolejność warstw i blokada.
  await strona.keyboard.press('Control+Shift+BracketRight');
  assert.deepEqual(await nazwy(), ['b', 'a']);
  await strona.keyboard.press('Control+BracketLeft');
  assert.deepEqual(await nazwy(), ['a', 'b']);
  await strona.keyboard.press('Control+l');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.zablokowany), true);
  await strona.keyboard.press('ArrowRight');
  assert.deepEqual(await polozenie(strona, 'a'), [20, 30], 'zablokowany element nie rusza się strzałkami');
  await strona.keyboard.press('Control+l');
  await strona.keyboard.press('Shift+ArrowRight');
  assert.deepEqual(await polozenie(strona, 'a'), [30, 30]);

  // Tekst: pogrubienie, wyrównanie, rozmiar; w trakcie pisania – tylko zaznaczony fragment.
  await strona.keyboard.press('t');
  const tekst = () => strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; return [o.fontWeight, o.textAlign, Math.round(o.fontSize * 72 / 25.4)]; });
  await strona.keyboard.press('Control+b');
  await strona.keyboard.press('Control+Shift+e');
  await strona.keyboard.press('Control+Shift+Period');
  assert.deepEqual(await tekst(), ['bold', 'center', 15]);
  await strona.keyboard.press('Control+b');
  await strona.keyboard.press('Enter');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.isEditing), true);
  await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; o.setSelectionStart(0); o.setSelectionEnd(7); });
  await strona.keyboard.press('Control+i');
  const style = await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; return [o.fontStyle, o.getSelectionStyles(0, 1)[0].fontStyle, o.getSelectionStyles(10, 11)[0].fontStyle || null]; });
  assert.deepEqual(style, ['normal', 'italic', null]);
  await strona.evaluate(() => window.seriodruk.edytor.aktywny.exitEditing());
  await strona.keyboard.press('Delete');

  // Widok: linie pomocnicze, siatka, powiększenie.
  await strona.keyboard.press('w');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.pokazProwadnice), false);
  await strona.keyboard.press('w');
  await strona.keyboard.press('Control+Quote');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.widok.siatka), true);
  await strona.keyboard.press('Control+Quote');
  await strona.keyboard.press('Control+1');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.zoom), 1);
  await strona.keyboard.press('Control+0');

  // Alt przy przeciąganiu zostawia kopię w miejscu startu.
  await przeciagnij(strona, [70, 40], [70, 90], { klawisz: 'Alt' });
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().length === 3);
  const b = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.nazwa === 'b').map((o) => [Math.round(o.left), Math.round(o.top)]).sort((p, q) => p[1] - q[1]));
  assert.deepEqual(b, [[60, 30], [60, 80]]);

  // Shift: ruch tylko w osi, w której przesunięcie jest większe.
  await strona.keyboard.press('Escape');
  await przeciagnij(strona, [40, 40], [47, 96.3], { klawisz: 'Shift' });
  const a = await polozenie(strona, 'a');
  assert.equal(a[0], 30, 'w poziomie bez zmian');
  assert.ok(Math.abs(a[1] - 86) < 1.5, `w pionie przesunięty: ${a}`);

  // ? otwiera listę skrótów w instrukcji.
  await strona.keyboard.press('Shift+Slash');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  assert.equal(await strona.textContent('#instrukcja-tresc h3'), 'Skróty klawiszowe');
  assert.ok(await strona.locator('#instrukcja-tresc table.skroty tr').count() > 40);
  assert.deepEqual(bledy, []);
});

test('linijki i prowadnice: wyciągnięcie z linijki, przyciąganie do prowadnicy, zapis ze stroną, usunięcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Prowadnice');
  await prostokaty(strona, [['a', 30, 30, 20, 20]]);
  assert.ok(await strona.isVisible('.linijka-x'), 'linijki są domyślnie widoczne');

  // Pionowa prowadnica z lewej linijki na 60 mm, pozioma z górnej na 90 mm.
  const cel = await naEkranie(strona, 60.2, 50);
  const lewa = await strona.locator('.linijka-y').boundingBox();
  await strona.mouse.move(lewa.x + 8, cel.y);
  await strona.mouse.down();
  await strona.mouse.move(cel.x, cel.y, { steps: 5 });
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor._prowadnicaWRuchu?.os), 'x');
  await strona.mouse.up();
  const cel2 = await naEkranie(strona, 50, 89.9);
  const gorna = await strona.locator('.linijka-x').boundingBox();
  await strona.mouse.move(cel2.x, gorna.y + 8);
  await strona.mouse.down();
  await strona.mouse.move(cel2.x, cel2.y, { steps: 5 });
  await strona.mouse.up();
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.prowadniceStron()), [{ x: [60], y: [90] }]);

  // Element przyciąga się do prowadnicy (lewa krawędź w 60 mm).
  await przeciagnij(strona, [40, 40], [70.8, 40]);
  assert.deepEqual(await polozenie(strona, 'a'), [60, 30]);

  // Prowadnice zapisują się ze stroną i wracają po przejściu na inną stronę i z powrotem.
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].prowadnice), { x: [60], y: [90] });
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.prowadnice.length), 0);
  await strona.evaluate(() => window.seriodruk.przejdzDoStrony(0));
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0 && window.seriodruk.edytor.prowadnice.length === 2);

  // Prowadnica przeciągnięta poza stronę znika.
  const p = await naEkranie(strona, 60, 150);
  const poza = await naEkranie(strona, -30, 150);
  await strona.mouse.move(p.x, p.y);
  await strona.mouse.down();
  await strona.mouse.move(poza.x, poza.y, { steps: 5 });
  await strona.mouse.up();
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.prowadniceStron()), [{ x: [], y: [90] }]);

  // Skrót chowa linijki; menu usuwa pozostałe prowadnice.
  await strona.keyboard.press('Shift+r');
  assert.ok(await strona.isHidden('.linijka-x'));
  await strona.click('#przycisk-widok');
  await strona.click('[data-akcja="prowadnice-usun"]');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].prowadnice), undefined);
  assert.deepEqual(bledy, []);
});

test('warstwy: lista od wierzchu, zaznaczanie, ukrywanie, blokada, zmiana kolejności przeciąganiem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Warstwy');
  await prostokaty(strona, [['dół', 20, 30, 40, 40], ['środek', 30, 40, 40, 40], ['góra', 40, 50, 40, 40]]);
  await strona.click('#zakladki-listy label:has-text("Warstwy")');
  const lista = () => strona.locator('#lista-warstw .warstwa-nazwa').allTextContents();
  assert.deepEqual(await lista(), ['góra', 'środek', 'dół']);

  await strona.click('#lista-warstw li:has-text("środek") .warstwa-nazwa');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.nazwa), 'środek');
  assert.ok(await strona.locator('#lista-warstw li.zaznaczona:has-text("środek")').count());

  // Ukryty element znika ze strony i z jej obrazu, ale zostaje w projekcie.
  await strona.click('#lista-warstw li:has-text("góra") .warstwa-oko');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.nazwa === 'góra').visible), false);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.nazwa === 'góra').visible), false);
  await strona.click('#lista-warstw li:has-text("góra") .warstwa-oko');

  await strona.hover('#lista-warstw li:has-text("dół")');
  await strona.click('#lista-warstw li:has-text("dół") .warstwa-klodka');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.nazwa === 'dół').zablokowany), true);

  // „dół” przeciągnięty na samą górę listy = na wierzch stosu.
  await strona.locator('#lista-warstw li:has-text("dół")').dragTo(strona.locator('#lista-warstw li:has-text("góra")'), { targetPosition: { x: 60, y: 4 } });
  assert.deepEqual(await lista(), ['dół', 'góra', 'środek']);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().map((o) => o.nazwa)), ['środek', 'góra', 'dół']);
  assert.deepEqual(bledy, []);
});
