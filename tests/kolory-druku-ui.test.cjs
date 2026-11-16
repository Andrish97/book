// Kolory do druku (decyzja #127) w interfejsie: okno „Kolory do druku”, kolor dodatkowy w wyborze koloru,
// uszlachetnienie w panelu i jako kopia, przełącznik widoku, naprawa trybu kolorów w „Sprawdź przed drukiem”.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('interfejs: okno „Kolory do druku”, kolor dodatkowy w wyborze koloru (dokładny odcień), uszlachetnienie w panelu i jako kopia, widok, naprawa trybu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kolory');
  // Okno z menu ⋯: dodanie koloru dodatkowego i zmiana nazwy.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="kolory-druku"]');
  await strona.waitForSelector('#dlg-kolory-druku[open]');
  await strona.click('#kolory-dodaj');
  await strona.waitForSelector('#kolory-lista .spot');
  await strona.fill('#kolory-lista .nazwa-spotu input', 'PANTONE 032 C');
  await strona.press('#kolory-lista .nazwa-spotu input', 'Tab');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.kolory_dodatkowe?.[0]?.nazwa === 'PANTONE 032 C');
  await strona.click('#dlg-kolory-druku .przyciski-dialogu [data-akcja="kolory-druku-zamknij"]');
  // Prostokąt w kolorze dodatkowym, odcień 40% – kod koloru dokładnie z rejestru.
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'rect');
  await strona.click('#wlasciwosci .kolor-przycisk >> nth=0');
  await strona.waitForSelector('.kolor-okienko .kolor-paleta.spoty button');
  await strona.fill('.kolor-okienko .kolor-odcien input', '40');
  await strona.click('.kolor-okienko .kolor-paleta.spoty button');
  const kolor = await strona.evaluate(async () => {
    const k = await import('./js/kolory-druku.js');
    const { stan, edytor } = window.seriodruk;
    return { fill: edytor.aktywny.fill, oczekiwany: k.hexSpotu(stan.projekt.kolory_dodatkowe[0], 0.4) };
  });
  assert.equal(kolor.fill, kolor.oczekiwany);
  await strona.keyboard.press('Escape');
  // Wykończenie druku w panelu (#167, część domyślnie zwinięta): „Sam efekt” – złocenie, kolor folii; potem
  // „Kolor + efekt” – kopia z lakierem nad elementem.
  await strona.click('#wlasciwosci button.zwijak:has-text("Wykończenie druku")');
  await strona.click('#wlasciwosci .jak-wykonczenie button:has-text("Sam efekt")');
  await strona.click('#wlasciwosci .wybor-wykonczenia [data-wykonczenie="folia"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.uszlachetnienie === 'folia');
  await strona.selectOption('#wlasciwosci label:has-text("Kolor folii") select', 'srebro');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.folia === 'srebro');
  assert.match(await strona.textContent('#wlasciwosci'), /Foil_Silver/);
  await strona.click('#wlasciwosci .wybor-wykonczenia [data-wykonczenie="brak"]');
  await strona.waitForFunction(() => !window.seriodruk.edytor.aktywny?.uszlachetnienie);
  await strona.click('#wlasciwosci .jak-wykonczenie button:has-text("Kolor + efekt")');
  await strona.click('#wlasciwosci .wybor-wykonczenia [data-wykonczenie="uv"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.uszlachetnienie === 'uv');
  const kopia = await strona.evaluate(() => {
    const ob = window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'rect');
    return { ile: ob.length, wyzej: ob[1].uszlachetnienie, ten: ob[0].uszlachetnienie || null, ta: ob[0].left === ob[1].left && ob[0].top === ob[1].top };
  });
  assert.deepEqual(kopia, { ile: 2, wyzej: 'uv', ten: null, ta: true }, 'kopia z lakierem dokładnie nad prostokątem');
  // Przełącznik widoku zapamiętuje się na urządzeniu.
  await strona.click('#przycisk-widok');
  assert.equal(await strona.isChecked('#widok-uszlachetnienia'), true);
  await strona.click('#menu-widoku label:has-text("Pokaż uszlachetnienia")');
  assert.equal(await strona.evaluate(() => localStorage.getItem('makietka:pokaz-uszlachetnienia')), '0');
  await strona.keyboard.press('Escape');
  // Tryb „Skala szarości”: kontrola przed drukiem pokazuje kolor spoza trybu i naprawia go.
  await strona.evaluate(() => { const r = window.seriodruk.edytor.canvas.getObjects().find((o) => o.type === 'rect'); r.set('fill', '#2266ee'); window.seriodruk.edytor.canvas.fire('object:modified', { target: r }); });
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="kolory-druku"]');
  await strona.click('#kolory-tryb label:has-text("Skala szarości")');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tryb_kolorow === 'szarosc');
  assert.equal(await strona.isVisible('#kolory-tryb-zle'), true, 'okno mówi o kolorach spoza trybu');
  await strona.click('#dlg-kolory-druku .przyciski-dialogu [data-akcja="kolory-druku-zamknij"]');
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="kontrola"]');
  await strona.waitForSelector('#kontrola-lista li:has-text("nie pasuje")');
  await strona.click('#kontrola-lista button:has-text("Zamień na dozwolone")');
  await strona.waitForFunction(async () => (await import('./js/kolory-druku.js')).koloryPozaTrybem(window.seriodruk.stan.projekt).length === 0);
  const szary = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'rect').map((o) => o.fill));
  assert.ok(szary.every((k) => /^#([0-9a-f]{2})\1\1$/.test(k)), szary.join(', '));
  assert.deepEqual(bledy, []);
});
