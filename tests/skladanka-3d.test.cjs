// Makieta 3D składanki (#238): części z szablonów składają się po swoich zgięciach – złożona bryła ma wymiary
// modelu (prostopadłościan L × W × H, ostrosłup o wysokości h, graniastosłup – wysokość ścian), płasko u = 0
// leży arkusz; okno makiety pokazuje model „Składanka” dla sekcji składanki.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('składanka w 3D: wymiary złożonych brył z szablonów, płaski arkusz, model w oknie makiety', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Bryły');
  const w = await strona.evaluate(async () => {
    const S = await import('./js/skladanka-szablony.js');
    const K = await import('./js/skladanka.js');
    const M = await import('./js/makieta-3d.js');
    const bryla = (klucz, parametry) => {
      const czesci = S.czesciSzablonu(klucz, parametry, 0.3).map((c, i) => {
        const n = K.normalizujCzesc({ ...c, nr: String.fromCharCode(65 + i) });
        const r = K.ramkaCzesci(n);
        // Część na arkuszu w (20, 20): grupa bez obrotu, początek w lewym górnym rogu ramki.
        return { arkusz: 0, czesc: { ...n, uklad: { x: r.x + r.w / 2, y: r.y + r.h / 2 } }, obiekt: { left: 20 + r.x, top: 20 + r.y, width: r.w, height: r.h, angle: 0, originX: 'left', originY: 'top', czesc: { ...n, uklad: { x: r.x + r.w / 2, y: r.y + r.h / 2 } } } };
      });
      const specjalna = { grubosc_mm: 0.3, wynik: { szerokosc: 420, wysokosc: 297 }, czesci };
      const kartki = M.kartkiModelu('skladanka', { strony: 1, specjalna });
      const wymiary = (u) => {
        const q = M.scena('skladanka', kartki, u);
        const pkt = q.flatMap((x) => x.p);
        const zakres = (i) => Math.round(Math.max(...pkt.map((p) => p[i])) - Math.min(...pkt.map((p) => p[i])));
        return [zakres(0), zakres(1), zakres(2)];
      };
      return { plasko: wymiary(0), zlozone: wymiary(1), polozenia: M.polozenia('skladanka', kartki), opis: M.opisPolozenia('skladanka', kartki, 1) };
    };
    return {
      kostka: bryla('prostopadloscian', { dlugosc: 60, szerokosc: 40, wysokosc: 30 }),
      piramida: bryla('ostroslup', { boki: 4, bok: 60, wysokosc: 50 }),
      graniastoslup: bryla('graniastoslup', { boki: 6, bok: 25, wysokosc: 60 }),
      popup: bryla('popup', { szerokosc: 100, wysokosc: 140, pudelka: 2, glebokosc: 25, wysokosc_pudelka: 30 }),
      trojkaty: M.trojkatyWielokata([[0, 0], [10, 0], [10, 10], [5, 4], [0, 10]]).length,
    };
  });
  const posortowane = (a) => [...a].sort((x, y) => x - y);
  assert.deepEqual(posortowane(w.kostka.zlozone), [30, 40, 60], `prostopadłościan 60 × 40 × 30 (${w.kostka.zlozone})`);
  assert.equal(w.kostka.plasko[1], 0, 'u = 0: płasko na stole');
  assert.equal(w.piramida.zlozone[1], 50, `ostrosłup: wysokość 50 (${w.piramida.zlozone})`);
  assert.deepEqual(posortowane(w.piramida.zlozone).slice(1), [60, 60], 'podstawa 60 × 60');
  assert.ok(w.graniastoslup.zlozone.includes(60), `graniastosłup: ściany 60 mm (${w.graniastoslup.zlozone})`);
  assert.equal(w.kostka.polozenia, 1);
  assert.equal(w.kostka.opis, 'Złożone części');
  assert.equal(w.trojkaty, 3, 'wielokąt wklęsły (5 wierzchołków) – 3 trójkąty');
  // Kartka pop-up „wycinanka” (#273): ściany z podziału po nacięciach – kartka otwarta pod kątem prostym (100 × 100 × 140),
  // pudełka w środku nie wystają poza strony.
  const pop = posortowane(w.popup.zlozone);
  assert.ok(Math.abs(pop[0] - 100) <= 2 && Math.abs(pop[1] - 100) <= 2 && Math.abs(pop[2] - 140) <= 2, `pop-up złożony: ${w.popup.zlozone}`);
  assert.equal(w.popup.plasko[1], 0, 'pop-up płasko na stole');

  // Okno makiety: sekcja składanki → model „Składanka”.
  const modele = await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const { modeleProjektu } = await import('./js/makieta-opis.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A4', material: 'karton', gramatura: 300 } });
    przeliczOkladki(p);
    return modeleProjektu(p).modele;
  });
  assert.deepEqual(modele, ['skladanka']);

  // Instrukcja montażu (#238): pudełko z wieczkiem z szablonu – kroki wycinania, zginania i klejenia par po kolei;
  // „Wstaw jako stronę” dodaje sekcję za arkuszami.
  await strona.evaluate(async () => {
    await window.seriodruk.przeladuj();
    const m = await import('./js/app/skladanka-narzedzia.js');
    m.wstawSzablon('pudelko', {});
    await window.seriodruk.zapiszTeraz();
  });
  await strona.click('[data-akcja="skladanka-instrukcja"]');
  await strona.waitForSelector('#dlg-instrukcja-montazu[open]');
  const kroki = await strona.$$eval('#dlg-instrukcja-montazu li', (l) => l.map((x) => x.textContent));
  assert.match(kroki[0], /^Wydrukuj arkusz na kartonie 300 g\/m²\.$/);
  assert.match(kroki[1], /Wytnij części po ciągłej linii: A \(Pudełko\), B \(Wieczko\)/);
  assert.ok(kroki.some((k) => /^Część A \(Pudełko\): 4 zgięcia od siebie, 4 zakładki\.$/.test(k)), kroki.join(' | '));
  assert.equal(kroki.filter((k) => /^\d+\. Posmaruj klejem zakładkę \d+ \(część [AB]\) i przyklej pod krawędź \d+ części [AB] z numerem \d+\.$/.test(k)).length, 8, 'osiem par klejenia');
  await strona.click('#dlg-instrukcja-montazu button[value="strona"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje.some((s) => s.nazwa === 'Instrukcja montażu'));
  const ins = await strona.evaluate(() => { const p = window.seriodruk.stan.projekt; const s = p.sekcje.find((x) => x.nazwa === 'Instrukcja montażu'); return [p.sekcje.indexOf(s), p.strony.find((x) => x.sekcja === s.id).obiekty[1].text.split('\n').length]; });
  assert.deepEqual(ins, [1, kroki.length]);
  assert.deepEqual(bledy, []);
});
