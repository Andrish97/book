// Instrukcja – podręcznik (#114): strona główna z częściami, spis dwupoziomowy (części → rozdziały → podrozdziały),
// okruszki, „W tym rozdziale”, odnośniki do podrozdziałów, wyszukiwarka, „Kopiuj” przy poleceniach dla AI,
// spis jako zasłonka na telefonie, dostęp bez konta (ekran logowania i adres #/instrukcja), bez samoczynnego otwierania.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { otworz } = require('./pomoc.cjs');

const pokaz = (strona, tytul) => strona.evaluate(async (t) => {
  const { ROZDZIALY } = await import('./js/instrukcja.js');
  await window.seriodruk.instrukcja.otworz(ROZDZIALY.findIndex((r) => r.tytul === t));
}, tytul);

test('instrukcja: strona główna, spis dwupoziomowy, okruszki, odnośniki, wyszukiwarka i „Kopiuj”', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  // Po zalogowaniu instrukcja nie otwiera się sama – to podręcznik, nie powitanie.
  await strona.waitForTimeout(300);
  assert.equal(await strona.locator('#dlg-instrukcja[open]').count(), 0);

  const dane = await strona.evaluate(async () => {
    const { ROZDZIALY, CZESCI } = await import('./js/instrukcja.js');
    return { czesci: CZESCI.length, rozdzialy: ROZDZIALY.map((r) => ({ nr: r.nr, tytul: r.tytul, sekcje: r.sekcje.length })) };
  });
  assert.ok(dane.czesci >= 5, `części: ${dane.czesci}`);
  assert.ok(dane.rozdzialy.length >= 25, `rozdziałów: ${dane.rozdzialy.length}`);
  assert.ok(dane.rozdzialy.reduce((n, r) => n + r.sekcje, 0) >= 120, 'podrozdziały');
  const edytor = dane.rozdzialy.filter((r) => Number(r.nr) >= 4 && Number(r.nr) <= 13);
  assert.ok(edytor.length >= 10, 'część „Edytor” ma co najmniej 10 rozdziałów');

  // Strona główna: przycisk z ikoną książki.
  await strona.click('.pasek-projektow [data-akcja="instrukcja"], .naglowek-projektow [data-akcja="instrukcja"], [data-akcja="instrukcja"]:visible');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  assert.match(await strona.textContent('#instrukcja-tresc .instrukcja-h1'), /Instrukcja Makietki/);
  assert.equal(await strona.locator('#instrukcja-tresc .karta-czesci').count(), dane.czesci);
  assert.match(await strona.textContent('#instrukcja-tresc .instrukcja-lead'), /edytor publikacji do druku/);

  // Kafelek części → rozdział: okruszki, „W tym rozdziale”, spis z rozwiniętą częścią i podrozdziałami.
  await strona.click('#instrukcja-tresc .karta-czesci a:has-text("Tekst")');
  assert.match(await strona.textContent('#instrukcja-tresc .instrukcja-h1'), /Tekst/);
  assert.match(await strona.textContent('#instrukcja-tresc .okruszki'), /Instrukcja.*Część II\. Edytor/);
  assert.ok(await strona.locator('#instrukcja-tresc .w-rozdziale li').count() >= 5);
  assert.equal(await strona.locator('.czesc-spisu.otwarta').count(), 1, 'rozwinięta tylko część bieżącego rozdziału');
  assert.ok(await strona.locator('li.otwarty .podrozdzialy-spisu button').first().isVisible(), 'podrozdziały otwartego rozdziału w spisie');
  assert.equal(await strona.locator('.rozdzial-przycisk[aria-current="true"] span').textContent(), 'Tekst');

  // Podrozdział ze spisu: strona rozdziału przewinięta do niego.
  await strona.click('li.otwarty .podrozdzialy-spisu button:has-text("Style")');
  // Treść przewija się płynnie – czekamy, aż podrozdział stanie u góry.
  const widoczny = await strona.waitForFunction(() => {
    const t = document.querySelector('#instrukcja-tresc');
    const h = [...t.querySelectorAll('.podrozdzial h2')].find((x) => /Style/.test(x.textContent));
    const a = h.getBoundingClientRect().top - t.getBoundingClientRect().top;
    return a >= -2 && a < t.clientHeight / 2;
  }, null, { timeout: 4000 }).then(() => true, () => false);
  assert.ok(widoczny, 'podrozdział „Style” u góry treści');

  // Zwijanie części w spisie.
  await strona.click('.czesc-spisu:has-text("Dane i serie") .czesc-przycisk');
  assert.ok(await strona.locator('.czesc-spisu:has-text("Dane i serie") .rozdzialy-spisu').isVisible());

  // Odnośnik w treści (→ 15.1) prowadzi do innego rozdziału; okruszek „Instrukcja” wraca na stronę główną.
  await pokaz(strona, 'Przykłady');
  await strona.click('#instrukcja-tresc a[data-cel="16.1"]');
  assert.match(await strona.textContent('#instrukcja-tresc .instrukcja-h1'), /Pola w tekście/);
  await strona.click('#instrukcja-tresc .okruszki [data-instrukcja-start]');
  assert.equal(await strona.locator('#instrukcja-tresc .karta-czesci').count(), dane.czesci);

  // Wszystkie odnośniki w treści prowadzą do istniejących miejsc, a zrzuty istnieją.
  const zle = await strona.evaluate(async () => {
    const { ROZDZIALY } = await import('./js/instrukcja.js');
    const cele = new Set(ROZDZIALY.flatMap((r) => [r.nr, ...r.sekcje.map((s) => s.id)]));
    const wynik = [];
    for (const r of ROZDZIALY) for (const s of r.sekcje) {
      for (const [, c] of s.html.matchAll(/data-cel="([^"]+)"/g)) if (!cele.has(c)) wynik.push(`${s.id} → ${c}`);
    }
    return wynik;
  });
  assert.deepEqual(zle, []);
  const obrazy = await strona.evaluate(async () => {
    const { ROZDZIALY } = await import('./js/instrukcja.js');
    return [...new Set(ROZDZIALY.flatMap((r) => r.sekcje.flatMap((s) => [...s.html.matchAll(/src="img\/instrukcja\/([^"]+)"/g)].map((m) => m[1]))))];
  });
  assert.ok(obrazy.length >= 40, `zrzutów: ${obrazy.length}`);
  for (const o of obrazy) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'img', 'instrukcja', o)), `brak zrzutu ${o}`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'img', 'instrukcja', 'ciemny', o)), `brak ciemnego zrzutu ${o}`);
  }

  // Wyszukiwarka zawęża spis do rozdziałów i podrozdziałów ze wszystkimi słowami.
  await strona.fill('#instrukcja-szukaj', 'komiks');
  const widoczne = await strona.$$eval('#instrukcja-rozdzialy li[data-i]:not([hidden]) .rozdzial-przycisk span', (s) => s.map((x) => x.textContent));
  assert.ok(widoczne.includes('Przykład: komiks z AI'), widoczne.join(', '));
  assert.ok(!widoczne.includes('Warstwy'));
  await strona.fill('#instrukcja-szukaj', 'okładka z grzbietem');
  assert.ok(await strona.locator('li[data-sekcja="11.6"]:not([hidden])').isVisible(), 'trafiony podrozdział widać w spisie');
  await strona.fill('#instrukcja-szukaj', '');
  assert.equal(await strona.locator('#instrukcja-rozdzialy li[data-i]:not([hidden])').count(), dane.rozdzialy.length);

  // Kopiowanie polecenia dla AI.
  await pokaz(strona, 'Praca z AI');
  await strona.click('#instrukcja-tresc [data-kopiuj-prompt]');
  await strona.waitForFunction(() => /Skopiowano/.test(document.querySelector('#instrukcja-tresc [data-kopiuj-prompt]').textContent));
  const schowek = await strona.evaluate(() => navigator.clipboard.readText());
  assert.match(schowek, /api\.makietka\.app\/mcp/);

  // Kliknięcie zrzutu powiększa go, kliknięcie powiększenia zamyka.
  await strona.click('#instrukcja-tresc figure img');
  await strona.waitForSelector('.instrukcja-lupa');
  await strona.click('.instrukcja-lupa');
  assert.equal(await strona.locator('.instrukcja-lupa').count(), 0);
  assert.deepEqual(bledy, []);
});

test('instrukcja na telefonie: przycisk z nazwą rozdziału otwiera spis jako zasłonkę', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await strona.evaluate(async () => {
    const { ROZDZIALY } = await import('./js/instrukcja.js');
    await window.seriodruk.instrukcja.otworz(ROZDZIALY.findIndex((r) => r.tytul === 'Wzorce'));
  });
  await strona.waitForSelector('#dlg-instrukcja[open]');
  assert.ok(await strona.locator('#instrukcja-wybor').isVisible());
  assert.match(await strona.textContent('#instrukcja-wybor'), /12\. Wzorce/);
  assert.equal(await strona.locator('#instrukcja-spis').isVisible(), false, 'spis schowany');
  // Treść zaczyna się pod paskiem (okno nie jest przewinięte).
  assert.equal(await strona.evaluate(() => document.querySelector('#dlg-instrukcja .instrukcja').scrollTop), 0);
  await strona.tap('#instrukcja-wybor');
  await strona.waitForFunction(() => document.querySelector('.instrukcja').classList.contains('spis-otwarty'));
  await strona.waitForTimeout(300);
  assert.ok(await strona.locator('#instrukcja-spis').isVisible());
  assert.ok(await strona.locator('.rozdzial-przycisk[aria-current="true"]').isVisible(), 'bieżący rozdział widać w spisie');
  await strona.tap('.czesc-spisu:has-text("Gotowa publikacja") .czesc-przycisk');
  await strona.tap('.czesc-spisu:has-text("Gotowa publikacja") .rozdzial-przycisk:has-text("Eksport do PDF")');
  await strona.waitForFunction(() => !document.querySelector('.instrukcja').classList.contains('spis-otwarty'));
  assert.match(await strona.textContent('#instrukcja-wybor'), /21\. Eksport do PDF i PNG/);
  // Nic nie wystaje w bok.
  const szersze = await strona.evaluate(() => {
    const t = document.querySelector('#instrukcja-tresc');
    return [...t.querySelectorAll('*')].filter((e) => !e.closest('.tabela-instrukcji, pre') && e.getBoundingClientRect().right > t.getBoundingClientRect().right + 1).map((e) => e.className || e.tagName).slice(0, 5);
  });
  assert.deepEqual(szersze, []);
  assert.deepEqual(bledy, []);
});

test('instrukcja bez konta: „Zobacz, jak to działa” na ekranie logowania i adres #/instrukcja', async (t) => {
  const { strona, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.waitForSelector('#ekran-logowania', { state: 'visible' });
  await strona.click('.zobacz-jak');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  assert.match(await strona.textContent('#instrukcja-tresc .instrukcja-h1'), /Instrukcja Makietki/);
  await strona.click('[data-akcja="zamknij-instrukcje"]');
  await strona.waitForFunction(() => !document.querySelector('#dlg-instrukcja').open);
  // Adres prowadzi wprost do instrukcji; po zamknięciu adres wraca.
  await strona.evaluate(() => { location.hash = '#/instrukcja'; });
  await strona.reload();
  await strona.waitForSelector('#dlg-instrukcja[open]');
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'logowanie');
  await strona.click('[data-akcja="zamknij-instrukcje"]');
  await strona.waitForFunction(() => !document.querySelector('#dlg-instrukcja').open);
  await strona.waitForFunction(() => !/instrukcja/.test(location.hash), null, { timeout: 3000 }).catch(() => {});
  assert.doesNotMatch(await strona.evaluate(() => location.hash), /instrukcja/);
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
