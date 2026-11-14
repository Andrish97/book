// Instrukcja (#104): rozdziały, spis z grupami, wyszukiwarka, linki między rozdziałami, obrazy i polecenia dla AI.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { otworz } = require('./pomoc.cjs');

const pokaz = (strona, tytul) => strona.evaluate(async (t) => {
  const { ROZDZIALY } = await import('./js/instrukcja.js');
  await window.seriodruk.instrukcja.otworz(ROZDZIALY.findIndex((r) => r.tytul === t));
}, tytul);

test('instrukcja: każdy rozdział się pokazuje, obrazy istnieją, linki prowadzą do istniejących rozdziałów, wyszukiwarka i „Kopiuj”', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const dane = await strona.evaluate(async () => {
    const { ROZDZIALY } = await import('./js/instrukcja.js');
    return ROZDZIALY.map((r) => ({ tytul: r.tytul, grupa: r.grupa, obrazy: [r.obraz, r.obraz2].filter(Boolean) }));
  });
  assert.ok(dane.length >= 40, `rozdziałów: ${dane.length}`);
  assert.ok(dane.every((r) => r.grupa), 'każdy rozdział ma grupę');
  for (const r of dane) {
    for (const o of r.obrazy) {
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'img', 'instrukcja', o)), `brak zrzutu ${o}`);
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'img', 'instrukcja', 'ciemny', o)), `brak ciemnego zrzutu ${o}`);
    }
  }
  for (const tytul of ['Pierwsze kroki – pierwszy kalendarz', 'Edytor – każde narzędzie i menu', 'Panel właściwości – przewodnik', 'Dane w praktyce – przykłady krok po kroku', 'Praca z AI – krok po kroku', 'Przykład: komiks do druku z AI', 'Słowniczek']) {
    assert.ok(dane.some((r) => r.tytul === tytul), `brak rozdziału ${tytul}`);
  }
  await pokaz(strona, 'Na początek');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  // Linki data-rozdzial w każdym rozdziale wskazują istniejące tytuły.
  const zle = await strona.evaluate(async () => {
    const { ROZDZIALY } = await import('./js/instrukcja.js');
    const tytuly = new Set(ROZDZIALY.map((r) => r.tytul));
    const wynik = [];
    for (let i = 0; i < ROZDZIALY.length; i += 1) {
      await window.seriodruk.instrukcja.otworz(i);
      for (const a of document.querySelectorAll('#instrukcja-tresc [data-rozdzial]')) if (!tytuly.has(a.dataset.rozdzial)) wynik.push(`${ROZDZIALY[i].tytul} → ${a.dataset.rozdzial}`);
    }
    return wynik;
  });
  assert.deepEqual(zle, []);
  // Spis ma nagłówki grup.
  assert.ok(await strona.locator('#instrukcja-rozdzialy li.grupa-spisu').count() >= 8);
  // Link przenosi do rozdziału.
  await pokaz(strona, 'Pierwsze kroki – pierwszy kalendarz');
  await strona.click('#instrukcja-tresc a[data-rozdzial="Pola w tekście"]');
  assert.equal(await strona.textContent('#instrukcja-tresc h3'), 'Pola w tekście');
  // Wyszukiwarka zawęża spis.
  await strona.fill('#instrukcja-szukaj', 'komiks');
  const widoczne = await strona.$$eval('#instrukcja-rozdzialy li[data-i]:not([hidden]) span', (s) => s.map((x) => x.textContent));
  assert.ok(widoczne.includes('Przykład: komiks do druku z AI'), widoczne.join(', '));
  assert.ok(!widoczne.includes('Warstwy'));
  await strona.fill('#instrukcja-szukaj', '');
  assert.ok(await strona.locator('#instrukcja-rozdzialy li[data-i]:not([hidden])').count() >= 40);
  // Kopiowanie polecenia dla AI.
  await pokaz(strona, 'Praca z AI – krok po kroku');
  await strona.click('#instrukcja-tresc [data-kopiuj-prompt="0"]');
  await strona.waitForFunction(() => /Skopiowano/.test(document.querySelector('#instrukcja-tresc [data-kopiuj-prompt="0"]').textContent));
  const schowek = await strona.evaluate(() => navigator.clipboard.readText());
  assert.match(schowek, /api\.makietka\.app\/mcp/);
  assert.match(schowek, /Ustawienia konta → Dostęp dla AI/);
  assert.deepEqual(bledy, []);
});

test('workflow zrzutów instrukcji: zapisuje tylko img/instrukcja, bez pętli i bez tabulatorów', () => {
  const plik = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'zrzuty-instrukcji.yml'), 'utf8');
  assert.match(plik, /branches: \[main\]/);
  assert.match(plik, /concurrency:/);
  assert.match(plik, /img\/instrukcja/);
  assert.match(plik, /github-actions\[bot\]/);
  assert.doesNotMatch(plik, /\t/);
});
