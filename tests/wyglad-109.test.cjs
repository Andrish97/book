// Decyzje wyglądu #109: menu widoku z opcjami wyglądu edytora, napisy na górnym pasku tylko gdy się mieszczą,
// karta projektu z chmurką stanu wysyłki, kafelek „+” na liście stron, przeciąganie warstw za uchwyt,
// schemat marginesów w ustawieniach sekcji, kosz w oknie serii, gumka w oknie danych.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const widoczne = (strona, sel) => strona.evaluate((s) => [...document.querySelectorAll(s)].map((e) => getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0), sel);

test('menu widoku: „Wygląd edytora” – podpisy narzędzi i napisy na górnym pasku, zapamiętane na urządzeniu', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1600, height: 900 } });
  await nowyProjekt(strona, 'Wygląd');
  // Domyślnie: narzędzia bez podpisów, napisy na pasku w trybie „auto” – na szerokim ekranie się mieszczą.
  assert.deepEqual(await widoczne(strona, '#pasek-narzedzi [data-akcja="dodaj-tekst"] > span'), [false]);
  await strona.waitForFunction(() => document.querySelector('.pasek-edytora').classList.contains('z-napisami'));
  assert.deepEqual(await widoczne(strona, '.pasek-edytora .etyk-paska'), [true, true, true]);
  // Węższe okno: napisy znikają same, bez stałego progu.
  await strona.setViewportSize({ width: 1000, height: 800 });
  await strona.waitForFunction(() => !document.querySelector('.pasek-edytora').classList.contains('z-napisami'));
  assert.deepEqual(await widoczne(strona, '.pasek-edytora .etyk-paska'), [false, false, false]);
  for (const b of await strona.$$('.pasek-edytora > [data-akcja="podglad"], .pasek-edytora > [data-akcja="dane"]')) {
    assert.ok(await b.getAttribute('title') || await b.getAttribute('data-dymek'), 'podpowiedź przy ikonie');
    assert.ok(await b.getAttribute('aria-label'));
  }
  await strona.setViewportSize({ width: 1600, height: 900 });

  await strona.click('#przycisk-widok');
  assert.ok(await strona.isVisible('#menu-widoku .wyglad-edytora'));
  assert.match(await strona.textContent('#menu-widoku'), /Wygląd edytora.*Podpisy narzędzi.*Napisy na górnym pasku/s);
  assert.equal(await strona.isChecked('#widok-podpisy'), false);
  await strona.click('#menu-widoku label:has(#widok-podpisy)');
  assert.deepEqual(await widoczne(strona, '#pasek-narzedzi [data-akcja="dodaj-tekst"] > span'), [true]);
  await strona.click('#widok-napisy label:has-text("Nigdy")');
  assert.deepEqual(await widoczne(strona, '.pasek-edytora .etyk-paska'), [false, false, false]);
  const zapisane = await strona.evaluate(() => JSON.parse(localStorage.getItem('makietka.wyglad-edytora')));
  assert.deepEqual(zapisane, { podpisy: true, napisy: 'nigdy' });

  await strona.reload();
  await strona.waitForSelector('#ekran-edytora', { state: 'visible' });
  await strona.waitForFunction(() => document.querySelector('#ekran-edytora').hasAttribute('data-podpisy-narzedzi'));
  assert.equal(await strona.evaluate(() => document.querySelector('.pasek-edytora').dataset.napisy), 'nigdy');
  await strona.click('#przycisk-widok');
  await strona.click('#widok-napisy label:has-text("Zawsze")');
  assert.deepEqual(await widoczne(strona, '.pasek-edytora .etyk-paska'), [true, true, true]);
  assert.deepEqual(bledy, []);
});

test('karta projektu: chmurka stanu wysyłki przy nazwie (z podpowiedzią), data w jednej linii', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Chmurka');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
  assert.equal(baza.projekty.length, 1);
  await strona.click('[data-akcja="do-projektow"]:visible');
  await strona.waitForSelector('.karta-projektu:not(.szkielet) .stan-wysylki.chmura_ok', { timeout: 10000 });
  const karta = await strona.evaluate(() => {
    const k = document.querySelector('.karta-projektu:not(.szkielet)');
    const ik = k.querySelector('strong .stan-wysylki');
    const small = k.querySelector('.opis small');
    return { klasa: ik.className, aria: ik.getAttribute('aria-label'), zawijanie: getComputedStyle(small).whiteSpace };
  });
  assert.match(karta.klasa, /chmura_ok/);
  assert.equal(karta.aria, 'Zapisano na koncie');
  assert.equal(karta.zawijanie, 'nowrap', 'data w jednej linii');
  assert.deepEqual(bledy, []);
});

test('lista stron: kafelek „+” na końcu dodaje stronę, „+ Sekcja” na dole panelu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kafelek');
  const kafelek = '#lista-stron li.kafelek-dodaj-strone .kafelek-dodaj';
  assert.equal(await strona.locator(kafelek).count(), 1);
  assert.equal(await strona.evaluate(() => document.querySelector('#lista-stron').lastElementChild.classList.contains('kafelek-dodaj-strone')), true, 'kafelek jest ostatni na liście');
  // Wygląda jak miniatura: ta sama szerokość co miniatura strony.
  const [mini, kaf] = await strona.evaluate((k) => [document.querySelector('#lista-stron li.strona .miniatura'), document.querySelector(k)].map((e) => Math.round(e.getBoundingClientRect().width)), kafelek);
  assert.ok(Math.abs(mini - kaf) <= 2, `szerokość kafelka ${kaf} jak miniatury ${mini}`);
  await strona.click(kafelek);
  await strona.waitForFunction(() => document.querySelectorAll('#lista-stron li.strona').length === 2);
  assert.equal(await strona.locator('#stopka-strony [data-akcja="strona-dodaj"]').count(), 0, 'w stopce tylko „+ Sekcja”');
  assert.match(await strona.textContent('#stopka-strony'), /Sekcja/);
  assert.deepEqual(bledy, []);
});

test('warstwy: przeciąganie palcem za uchwyt ⋮⋮, wiersze 40+ px na dotyku', async (t) => {
  const { strona, bledy } = await otworz(t, { urzadzenie: 'iPad Mini' });
  await nowyProjekt(strona, 'Warstwy palcem');
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    for (const [nazwa, left] of [['a', 20], ['b', 40], ['c', 60]]) { const r = e.dodajProstokat(); r.set({ left, top: 30, width: 20, height: 20, nazwa }); r.setCoords(); }
    e.canvas.discardActiveObject();
    e.zatwierdz();
  });
  await strona.tap('.zakladki-mobilne [data-panel="warstwy"]');
  const lista = () => strona.locator('#lista-warstw li.warstwa .warstwa-nazwa').allTextContents();
  await strona.waitForFunction(() => document.querySelectorAll('#lista-warstw li.warstwa').length === 3);
  assert.deepEqual(await lista(), ['c', 'b', 'a']);
  const wys = await strona.evaluate(() => [...document.querySelectorAll('#lista-warstw li.warstwa')].map((li) => li.getBoundingClientRect().height));
  assert.ok(wys.every((h) => h >= 40), `wiersze na dotyku ≥ 40 px: ${wys}`);
  // Palec: zdarzenia wskaźnika typu „touch” na uchwycie „a” i przesunięcie nad „c”.
  await strona.evaluate(async () => {
    const uchwyt = document.querySelector('#lista-warstw li.warstwa:last-of-type .warstwa-uchwyt');
    const cel = document.querySelector('#lista-warstw li.warstwa').getBoundingClientRect();
    const u = uchwyt.getBoundingClientRect();
    const opcje = (x, y) => ({ bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y });
    uchwyt.dispatchEvent(new PointerEvent('pointerdown', opcje(u.x + 5, u.y + 5)));
    for (let y = u.y + 5; y > cel.top + 3; y -= 10) uchwyt.dispatchEvent(new PointerEvent('pointermove', opcje(u.x + 5, y)));
    uchwyt.dispatchEvent(new PointerEvent('pointermove', opcje(u.x + 5, cel.top + 3)));
    uchwyt.dispatchEvent(new PointerEvent('pointerup', opcje(u.x + 5, cel.top + 3)));
  });
  await strona.waitForFunction(() => document.querySelector('#lista-warstw li.warstwa .warstwa-nazwa')?.textContent === 'a');
  assert.deepEqual(await lista(), ['a', 'c', 'b']);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.nazwa).map((o) => o.nazwa)), ['b', 'c', 'a']);
  assert.equal(await strona.evaluate(() => getComputedStyle(document.querySelector('.warstwa-uchwyt')).touchAction), 'none');
  assert.deepEqual(bledy, []);
});

test('ustawienia sekcji: marginesy i spad na schemacie strony, rysowany na bieżąco', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Schemat');
  await strona.click('#przycisk-format');
  await strona.waitForSelector('#dlg-sekcja[open]');
  const pozycje = await strona.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    return { strona: r('.schemat-strona'), gora: r('.schemat-gora'), dol: r('.schemat-dol'), lewy: r('.schemat-lewy'), prawy: r('.schemat-prawy'), spad: r('.schemat-spad-pole') };
  });
  assert.ok(pozycje.gora.bottom <= pozycje.strona.top + 1, 'górny nad stroną');
  assert.ok(pozycje.dol.top >= pozycje.strona.bottom - 1, 'dolny pod stroną');
  assert.ok(pozycje.lewy.right <= pozycje.strona.left + 1, 'lewy z lewej');
  assert.ok(pozycje.prawy.left >= pozycje.strona.right - 1, 'prawy z prawej');
  assert.ok(pozycje.spad.width > 0, 'spad na schemacie');
  assert.equal(await strona.textContent('#etykieta-wewnetrzny'), 'Lewy');
  await strona.fill('#dlg-sekcja input[name=margines_gora]', '40');
  const gora = await strona.evaluate(() => document.querySelector('#schemat-marginesow').style.getPropertyValue('--m-gora'));
  assert.match(gora, /^19\.\d+%$/, `40 mm z 210 mm: ${gora}`);
  await strona.click('#dlg-sekcja label:has-text("Rozkładówki")');
  assert.equal(await strona.textContent('#etykieta-wewnetrzny'), 'Wewnętrzny');
  assert.ok(await strona.evaluate(() => document.querySelector('#schemat-marginesow').classList.contains('rozkladowki')));
  await strona.click('#zapisz-sekcje');
  if (await strona.locator('#dlg-potwierdz[open]').count()) await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].wydruk.marginesy.gora === 40, null, { timeout: 5000 });
  assert.deepEqual(bledy, []);
});

test('okna: kosz w Serii, gumka w Danych, „+” przy wzorcach standardowych; telefon – zasłonki bez „Anuluj”', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Okna');
  await strona.evaluate(() => document.querySelector('[data-akcja="wzorce"]').click());
  await strona.waitForSelector('#dlg-wzorce[open]');
  const plus = await strona.evaluate(() => { const b = document.querySelector('#wzorce-standardowe button[data-standard]'); const z = b.querySelector('.znak-dodaj'); return { tekst: z.innerText.trim(), aria: b.getAttribute('aria-label'), ikona: Boolean(z.querySelector('svg')) }; });
  assert.deepEqual([plus.tekst, plus.ikona], ['Dodaj', true], 'karta z „+ Dodaj” (#164)');
  assert.match(plus.aria, /^Dodaj wzorzec „.+” do stron sekcji „.+”$/);
  await strona.evaluate(() => document.querySelector('#dlg-wzorce').close());
  // Ustawienia sekcji jako zasłonka: bez „Anuluj”, „Zapisz” na całą szerokość.
  await strona.evaluate(() => document.querySelector('[data-akcja="wydruk"]').click());
  await strona.waitForSelector('#dlg-sekcja[open]');
  const stopka = await strona.evaluate(() => {
    const d = document.querySelector('#dlg-sekcja .przyciski-dialogu');
    const anuluj = d.querySelector('[value="anuluj"]');
    return { anuluj: getComputedStyle(anuluj).display, glowny: d.querySelector('.glowny').getBoundingClientRect().width, cala: d.getBoundingClientRect().width };
  });
  assert.equal(stopka.anuluj, 'none');
  assert.ok(stopka.glowny > stopka.cala * 0.8, `główny przycisk szeroki: ${stopka.glowny} z ${stopka.cala}`);
  await strona.keyboard.press('Escape');
  await strona.waitForFunction(() => !document.querySelector('#dlg-sekcja[open]'));
  // Potwierdzenia zostają z „Anuluj”.
  const odp = strona.evaluate(async () => { const { potwierdz } = await import('./js/ui.js'); return potwierdz('Na pewno?', 'Test', 'Tak'); });
  await strona.waitForSelector('#dlg-potwierdz[open]');
  assert.notEqual(await strona.evaluate(() => getComputedStyle(document.querySelector('#potwierdz-nie')).display), 'none');
  await strona.click('#potwierdz-nie');
  assert.equal(await odp, false);
  // Dane: gumka zamiast „Bez wyglądu”, bez napisu „Wygląd komórki:”.
  const dane = await strona.evaluate(() => { const b = document.querySelector('#dane-bez-wygladu'); return { tekst: b.textContent.trim(), aria: b.getAttribute('aria-label'), ikona: Boolean(b.querySelector('svg')), pasek: document.querySelector('.dane-wyglad-pasek').textContent }; });
  assert.deepEqual([dane.tekst, dane.aria, dane.ikona], ['', 'Wyczyść wygląd', true]);
  assert.doesNotMatch(dane.pasek, /Wygląd komórki/);
  // Seria: kosz zamiast „Usuń serię”.
  const kosz = await strona.evaluate(() => { const b = document.querySelector('#seria-usun'); return { tekst: b.textContent.trim(), aria: b.getAttribute('aria-label'), ikona: Boolean(b.querySelector('svg')) }; });
  assert.deepEqual([kosz.tekst, kosz.aria, kosz.ikona], ['', 'Usuń serię', true]);
  assert.deepEqual(bledy, []);
});
