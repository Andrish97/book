// Tryb „Komiks” (#364): pasek narzędzi tylko w sekcji typu „Komiks”; kadry z gotowego układu (liczba, odstęp, spad);
// podział kadru dwoma kliknięciami; scenariusz (tabela) → „Ustaw dymki” → dymki na stronach; poprawka tekstu
// w scenariuszu zmienia tylko tekst, przesunięty dymek zostaje na miejscu; szablon projektu „Komiks”.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const kadryStrony = (strona) => strona.evaluate(() => {
  const e = window.seriodruk.edytor;
  const x0 = e.strony[e.aktywna].x;
  return e.canvas.getObjects().filter((o) => o.kadr_nr).map((o) => {
    const r = o.getBoundingRect(); // w układzie płótna (mm); obrys dodaje pół grubości linii – zaokrąglenie wystarcza
    return { nr: o.kadr_nr, x: Math.round(r.left - x0), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), punkty: o.points.length };
  }).sort((a, b) => a.nr - b.nr);
});

test('komiks: pasek tylko w komiksie, kadry z układu, podział kadru, scenariusz i dymki', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Mój komiks');
  assert.equal(await strona.locator('[data-akcja="komiks-kadry"]').isVisible(), false, 'poza komiksem pasek komiksu ukryty');
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.sekcje[0].typ = 'komiks';
    await window.seriodruk.przeladuj();
  });
  for (const a of ['komiks-dymek', 'komiks-kadry', 'komiks-podziel', 'komiks-scenariusz', 'komiks-dymki']) {
    assert.equal(await strona.locator(`[data-akcja="${a}"]`).isVisible(), true, `w sekcji komiksu widać ${a}`);
  }

  // Kadry: okno z 9 układami, siatka 2 × 2 z odstępem 4 mm (A4, marginesy 10 mm).
  await strona.click('[data-akcja="komiks-kadry"]');
  const dlg = strona.locator('#dlg-kadry');
  await dlg.waitFor();
  assert.equal(await dlg.locator('.uklad-kadrow').count(), 9);
  await dlg.locator('.uklad-kadrow').nth(5).click();
  await dlg.locator('button[value="tak"]').click();
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.kadr_nr).length === 4);
  assert.equal(await strona.textContent('#powiadomienie'), 'Ułożono 4 kadry.', 'komunikat z liczbą');
  const wydruk = await strona.evaluate(() => { const w = window.seriodruk.edytor.wydruk; return [w.szerokosc_mm, w.wysokosc_mm]; });
  let kadry = await kadryStrony(strona);
  assert.equal(kadry.length, 4, 'cztery kadry');
  const szer = (wydruk[0] - 20 - 4) / 2;
  assert.ok(Math.abs(kadry[0].w - szer) <= 1, `szerokość kadru ok. ${szer} mm`);
  assert.ok(Math.abs(kadry[1].x - (kadry[0].x + kadry[0].w + 4)) <= 1, 'odstęp 4 mm');
  assert.deepEqual(kadry.map((k) => k.nr), [1, 2, 3, 4]);
  assert.ok(kadry[1].x > kadry[0].x && kadry[2].y > kadry[0].y, 'kolejność czytania: w prawo, potem w dół');
  const ostrzezeniaKadrow = () => strona.evaluate(() => { const e = window.seriodruk.edytor; e.przeliczOstrzezenia(); const k = new Set(e.canvas.getObjects().filter((o) => o.kadr_nr).map((o) => o.id)); return e.ostrzezenia.filter((x) => k.has(x.id)).map((x) => x.typ); });
  assert.deepEqual(await ostrzezeniaKadrow(), [], 'kadry przy marginesie bez ostrzeżeń (obrys się nie liczy)');

  // Na spad: kadry przy krawędzi wychodzą poza stronę (spad 3 mm).
  await strona.click('[data-akcja="komiks-kadry"]');
  await dlg.locator('.uklad-kadrow').nth(1).click();
  await dlg.locator('input[name="spad"]').check({ force: true });
  await dlg.locator('button[value="tak"]').click();
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.kadr_nr).length === 2);
  kadry = await kadryStrony(strona);
  assert.equal(kadry.length, 2, 'nowy układ zastępuje stary');
  assert.ok(kadry[0].x <= -2 && kadry[0].y <= -2, 'kadr na spad wychodzi poza lewy i górny brzeg');
  assert.deepEqual(await ostrzezeniaKadrow(), [], 'kadry na spad bez ostrzeżeń');

  // Podział kadru: dwa kliknięcia – linia ukośna przez górny kadr.
  const kliknij = async (x, y) => {
    const p = await strona.evaluate(([mx, my]) => {
      const e = window.seriodruk.edytor;
      const v = e.canvas.viewportTransform;
      const r = e.canvas.upperCanvasEl.getBoundingClientRect();
      return { x: r.left + (e.strony[e.aktywna].x + mx) * v[0] + v[4], y: r.top + my * v[3] + v[5] };
    }, [x, y]);
    await strona.mouse.click(p.x, p.y);
  };
  await strona.click('[data-akcja="komiks-podziel"]');
  assert.equal(await strona.getAttribute('[data-akcja="komiks-podziel"]', 'aria-pressed'), 'true');
  await kliknij(20, 40);
  await kliknij(120, 60);
  kadry = await kadryStrony(strona);
  assert.equal(kadry.length, 3, 'górny kadr podzielony na dwa');
  assert.equal(await strona.getAttribute('[data-akcja="komiks-podziel"]', 'aria-pressed'), 'false');
  assert.deepEqual(kadry.map((k) => k.nr), [1, 2, 3], 'numery od nowa w kolejności czytania');

  // Kadry zapisują się z numerem i wracają po ponownym wczytaniu strony.
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  assert.deepEqual((await kadryStrony(strona)).map((k) => k.nr), [1, 2, 3]);

  // Scenariusz: tabela z kolumnami scenariusza i oknem Dane.
  await strona.click('[data-akcja="komiks-scenariusz"]');
  const tabela = await strona.evaluate(() => window.seriodruk.stan.projekt.tabele.find((x) => x.kolumny.includes('postać')));
  assert.deepEqual(tabela.kolumny, ['strona', 'kadr', 'postać', 'tekst', 'rodzaj', 'opis sceny']);
  assert.equal(tabela.wiersze.length, 1, 'przykładowy wiersz');
  await strona.keyboard.press('Escape');
  // Użytkownik wpisuje dialogi (tu – wprost w tabelę).
  await strona.evaluate((id) => {
    const tb = window.seriodruk.stan.projekt.tabele.find((x) => x.id === id);
    tb.wiersze = [['1', '1', 'Ala', 'Cześć, Olu!', 'mowa', ''], ['1', '2', 'Ola', 'Hej!', 'krzyk', ''], ['1', '3', '', 'Tymczasem…', 'narracja', '']];
  }, tabela.id);
  await strona.click('[data-akcja="komiks-dymki"]');
  const dymki = () => strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.dymek).map((o) => ({ tekst: o.text, rodzaj: o.dymek.rodzaj, x: Math.round(o.left), y: Math.round(o.top), klucz: o.z_dialogu?.klucz })));
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.dymek).length === 3);
  let d = await dymki();
  assert.deepEqual(d.map((x) => [x.tekst, x.rodzaj]), [['Cześć, Olu!', 'mowa'], ['Hej!', 'krzyk'], ['Tymczasem…', 'narracja']]);
  kadry = await kadryStrony(strona);
  const x0 = await strona.evaluate(() => window.seriodruk.edytor.strony[window.seriodruk.edytor.aktywna].x);
  const k2 = kadry[1];
  assert.ok(d[1].x - x0 >= k2.x - 1 && d[1].y >= k2.y - 1 && d[1].y < k2.y + k2.h, 'dymek kadru 2 w kadrze 2');

  // Przesunięcie dymka i poprawka tekstu w scenariuszu: tekst nowy, miejsce zostaje.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const o = e.canvas.getObjects().find((x) => x.dymek && x.text === 'Cześć, Olu!');
    o.set({ left: o.left + 7, top: o.top + 5 }); o.setCoords(); e.zatwierdz();
    const tb = window.seriodruk.stan.projekt.tabele.find((x) => x.kolumny.includes('postać'));
    tb.wiersze[0][3] = 'Dzień dobry, Olu!';
  });
  const przed = (await dymki())[0];
  await strona.click('[data-akcja="komiks-dymki"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.text === 'Dzień dobry, Olu!'));
  d = await dymki();
  assert.equal(d.length, 3);
  assert.deepEqual([d[0].x, d[0].y], [przed.x, przed.y], 'przesunięty dymek zostaje na miejscu');

  // Poza komiksem narzędzia znikają.
  await strona.evaluate(async () => { window.seriodruk.stan.projekt.sekcje[0].typ = 'zwykla'; await window.seriodruk.przeladuj(); });
  assert.equal(await strona.locator('[data-akcja="komiks-kadry"]').isVisible(), false);
  assert.deepEqual(bledy, []);
});

test('komiks: szablon projektu – okładka zeszytowa, strony z kadrami, scenariusz z przykładem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.locator('[data-akcja="nowy-projekt"]:visible').first().click();
  await strona.waitForSelector('#dlg-nowy[open]');
  await strona.fill('#form-nowy [name="nazwa"]', 'Przygody Ali');
  await strona.check('#form-nowy input[name="start"][value="szablon"]', { force: true });
  await strona.click('#nowy-szablony .karta-szablonu[data-id="komiks"]');
  await strona.waitForSelector('#nowy-szablony #gotowe-szczegoly:not([hidden])');
  await strona.click('#gotowe-wstaw');
  await strona.waitForFunction(() => !document.querySelector('#dlg-nowy').open && window.seriodruk.stan.projekt?.nazwa === 'Przygody Ali', null, { timeout: 15000 });
  const p = await strona.evaluate(() => {
    const x = window.seriodruk.stan.projekt;
    const kom = x.sekcje.find((s) => s.typ === 'komiks');
    const strony = x.strony.filter((s) => s.sekcja === kom.id);
    return {
      sekcje: x.sekcje.map((s) => s.typ), stron: strony.length, format: [kom.wydruk.szerokosc_mm, kom.wydruk.wysokosc_mm],
      kadry: strony.slice(0, 3).map((s) => s.obiekty.filter((o) => o.kadr_nr).length),
      scenariusz: x.tabele.find((tb) => tb.kolumny.includes('postać'))?.wiersze.length,
    };
  });
  assert.deepEqual(p.sekcje, ['okladka', 'komiks']);
  assert.deepEqual(await strona.evaluate(async () => { const m = await import('./js/postacie.js'); const x = window.seriodruk.stan.projekt; return [m.karty(x, 'postacie').map((k) => k.imie), m.karty(x, 'miejsca').map((k) => k.nazwa)]; }), [['Ala', 'Ola'], ['Miasteczko']], 'przykładowe karty');
  assert.equal(p.stron, 24);
  assert.deepEqual(p.format, [170, 260]);
  assert.deepEqual(p.kadry, [3, 4, 4], 'pierwsza strona – duży kadr i dwa mniejsze, dalej 2 × 2');
  assert.equal(p.scenariusz, 5);
  // Strona komiksu w edytorze: pasek komiksu i kadry na płótnie; „Ustaw dymki” stawia przykładowe dymki.
  await strona.evaluate(async () => {
    const x = window.seriodruk.stan.projekt;
    const kom = x.sekcje.find((s) => s.typ === 'komiks');
    await window.seriodruk.przejdzDoStrony(x.strony.findIndex((s) => s.sekcja === kom.id));
  });
  await strona.waitForFunction(() => document.body.classList.contains('w-komiksie'));
  const k = await kadryStrony(strona);
  assert.equal(k.length, 3);
  assert.deepEqual([k[0].x, k[0].y, k[0].w], [10, 10, 151], 'kadr w marginesach 10 mm: 170 – 2 × 10 = 150 mm + obrys 0,6 mm');
  assert.deepEqual(await strona.evaluate(() => { const e = window.seriodruk.edytor; e.przeliczOstrzezenia(); return e.ostrzezenia.map((x) => x.typ); }), [], 'strona z szablonu bez ostrzeżeń');
  await strona.click('[data-akcja="komiks-dymki"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.dymek).length === 3);
  const naStronach = await strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => (s.obiekty || []).filter((o) => o.dymek).length).slice(0, 4));
  assert.deepEqual(naStronach, [0, 3, 2, 0], 'strona 1 scenariusza = pierwsza strona komiksu (okładka się nie liczy)');
  assert.deepEqual(bledy, []);
});

test('komiks: style „Dialog” i „Efekt dźwiękowy” – dymki ze scenariusza, przyciski paska (#367)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Style komiksu');
  await strona.evaluate(async () => { window.seriodruk.stan.projekt.sekcje[0].typ = 'komiks'; await window.seriodruk.przeladuj(); });
  // Przed pierwszym użyciem stylów komiksu w projekcie nie ma.
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.style.filter((s) => s.komiks).length), 0);
  await strona.click('[data-akcja="komiks-dymek"]');
  await strona.click('[data-akcja="komiks-efekt"]');
  const wynik = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    const e = window.seriodruk.edytor;
    const styl = (r) => p.style.find((s) => s.komiks === r);
    const dymek = e.canvas.getObjects().find((o) => o.dymek);
    const efekt = e.canvas.getObjects().find((o) => o.styl === styl('efekt').id);
    return {
      style: p.style.filter((s) => s.komiks).map((s) => [s.komiks, s.nazwa, s.fontFamily]),
      dymek: [dymek.styl === styl('dialog').id, dymek.fontFamily, dymek.wielkosc_liter, dymek.textAlign],
      efekt: [efekt.text, efekt.fontFamily, efekt.stroke, efekt.paintFirst, efekt.strokeWidth > 0],
    };
  });
  assert.deepEqual(wynik.style, [['dialog', 'Dialog', 'Comic Neue'], ['efekt', 'Efekt dźwiękowy', 'Bangers']]);
  assert.deepEqual(wynik.dymek, [true, 'Comic Neue', 'wielkie', 'center']);
  assert.deepEqual(wynik.efekt, ['BUM!', 'Bangers', '#1a1a1a', 'stroke', true]);
  // Drugi dymek nie dodaje drugiego stylu.
  await strona.click('[data-akcja="komiks-dymek"]');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.style.filter((s) => s.komiks === 'dialog').length), 1);
  // Dymki ze scenariusza dostają styl „Dialog”.
  await strona.click('[data-akcja="komiks-scenariusz"]');
  await strona.keyboard.press('Escape');
  await strona.click('[data-akcja="komiks-dymki"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.z_dialogu).length === 1);
  const zeScenariusza = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.z_dialogu);
    return o.styl === p.style.find((s) => s.komiks === 'dialog').id;
  });
  assert.equal(zeScenariusza, true);
  assert.deepEqual(bledy, []);
});

test('komiks: karty postaci i miejsc – dodanie z obrazem i kolorem dymka, tabela, kolor w dymkach, poprawka, usunięcie (#368)', async (t) => {
  const { PNG_2X2 } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Postacie');
  await strona.evaluate(async () => { window.seriodruk.stan.projekt.sekcje[0].typ = 'komiks'; await window.seriodruk.przeladuj(); });
  await strona.click('[data-akcja="komiks-postacie"]');
  const dlg = strona.locator('#dlg-postacie');
  await dlg.waitFor();
  assert.equal(await dlg.locator('.karta-komiksu:not(.dodaj)').count(), 0, 'na początku bez kart');
  // Nowa postać: imię, wygląd, znak, obraz wzorcowy z urządzenia, kolor dymka.
  await dlg.locator('[data-akcja-karty="dodaj-postacie"]').click();
  await dlg.locator('input[name="imie"]').fill('Ala');
  await dlg.locator('textarea[name="wyglad"]').fill('8 lat, rude warkocze');
  await dlg.locator('input[name="znak"]').fill('żółty plecak');
  await dlg.locator('input[name="plik"]').setInputFiles({ name: 'ala.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await dlg.locator('.obraz-karty img').waitFor();
  await dlg.locator('input[name="kolor"]').evaluate((e) => { e.value = '#ffeeaa'; });
  await dlg.locator('button[value="zapisz"]').click();
  await dlg.locator('.karta-komiksu:not(.dodaj)').first().waitFor();
  assert.match(await dlg.locator('.karta-komiksu:not(.dodaj)').first().textContent(), /Ala.*żółty plecak/);
  // Miejsce.
  await dlg.locator('[data-akcja-karty="dodaj-miejsca"]').click();
  await dlg.locator('input[name="nazwa"]').fill('Rynek');
  await dlg.locator('textarea[name="opis"]').fill('brukowany plac z fontanną');
  await dlg.locator('button[value="zapisz"]').click();
  await dlg.locator('.karty-komiksu[data-rodzaj="miejsca"] .karta-komiksu:not(.dodaj)').waitFor();
  const tabele = await strona.evaluate(() => window.seriodruk.stan.projekt.tabele.map((tb) => ({ nazwa: tb.nazwa, kolumny: tb.kolumny, wiersze: tb.wiersze })));
  const postacie = tabele.find((x) => x.nazwa === 'Postacie');
  assert.deepEqual(postacie.kolumny, ['imię', 'wygląd', 'znak rozpoznawczy', 'charakter', 'obraz', 'kolor dymka']);
  assert.deepEqual(postacie.wiersze, [['Ala', '8 lat, rude warkocze', 'żółty plecak', '', 'ala.png', '#ffeeaa']]);
  assert.deepEqual(tabele.find((x) => x.nazwa === 'Miejsca').wiersze[0].slice(0, 2), ['Rynek', 'brukowany plac z fontanną']);
  assert.equal(await strona.evaluate(() => Object.values(window.seriodruk.stan.projekt.zasoby).some((z) => z.nazwa === 'ala.png')), true, 'obraz wzorcowy w obrazach projektu');
  await dlg.locator('button[value="zamknij"]').click();

  // Dymki Ali ze scenariusza mają kolor z karty.
  await strona.click('[data-akcja="komiks-scenariusz"]');
  await strona.keyboard.press('Escape');
  await strona.evaluate(() => {
    const tb = window.seriodruk.stan.projekt.tabele.find((x) => x.kolumny.includes('rodzaj'));
    tb.wiersze = [['1', '1', 'Ala', 'Cześć!', 'mowa', ''], ['1', '1', 'Ola', 'Hej!', 'mowa', '']];
  });
  await strona.click('[data-akcja="komiks-dymki"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.z_dialogu).length === 2);
  const kolory = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.z_dialogu).map((o) => [o.text, o.dymek.wypelnienie]));
  assert.deepEqual(kolory, [['Cześć!', '#ffeeaa'], ['Hej!', '#ffffff']]);

  // Poprawka karty (opis) i usunięcie.
  await strona.click('[data-akcja="komiks-postacie"]');
  await dlg.locator('.karta-komiksu:not(.dodaj)').first().click();
  assert.equal(await dlg.locator('input[name="imie"]').inputValue(), 'Ala');
  await dlg.locator('input[name="charakter"]').fill('odważna');
  await dlg.locator('button[value="zapisz"]').click();
  await dlg.locator('.karty-komiksu').first().waitFor();
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.tabele.find((x) => x.nazwa === 'Postacie').wiersze[0][3]), 'odważna');
  await dlg.locator('.karty-komiksu[data-rodzaj="miejsca"] .karta-komiksu:not(.dodaj)').click();
  await dlg.locator('[data-akcja-karty="usun"]').click();
  await strona.click('#potwierdz-tak');
  await dlg.locator('.karty-komiksu[data-rodzaj="miejsca"]').waitFor();
  assert.equal(await dlg.locator('.karty-komiksu[data-rodzaj="miejsca"] .karta-komiksu:not(.dodaj)').count(), 0);
  assert.deepEqual(bledy, []);
});

test('komiks: wgraj strony – 01.png na spad (kadry strony znikają, dymki zostają), s02-k1.png do kadru, ZIP, brakujące strony dochodzą (#369)', async (t) => {
  const { PNG_2X2 } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wgrane strony');
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.sekcje[0].typ = 'komiks';
    const { siatkaKadrow, elementKadru } = await import('./js/kadry.js');
    const { nowaStrona } = await import('./js/projekt.js');
    p.strony.push(nowaStrona('Strona 2', p.sekcje[0].id));
    for (const s of p.strony) s.obiekty = siatkaKadrow({ x: 10, y: 10, w: 128, h: 190 }, [[1], [1, 1]], 4).map((k, i) => elementKadru(k, i + 1, { id: `k${s.id}${i}` }));
    p.strony[0].obiekty.push({ type: 'textbox', id: 'dym', text: 'Hej', left: 20, top: 20, width: 30, dymek: { rodzaj: 'mowa', ogonek: null } });
    await window.seriodruk.przeladuj();
  });
  // ZIP z jedną stroną (03.png) zrobiony w przeglądarce.
  const zip = await strona.evaluate(async (b64) => {
    const { biblioteka } = await import('./js/biblioteki.js');
    const JSZip = await biblioteka('js/zewnetrzne/jszip-3.10.1.min.js', 'JSZip', 'ZIP');
    const z = new JSZip();
    z.file('komiks/03.png', b64, { base64: true });
    z.file('__MACOSX/._03.png', 'x');
    return z.generateAsync({ type: 'base64' });
  }, PNG_2X2.toString('base64'));
  await strona.click('[data-akcja="komiks-wgraj"]');
  await strona.setInputFiles('#plik-strony-komiksu', [
    { name: '01.png', mimeType: 'image/png', buffer: PNG_2X2 },
    { name: 's02-k1.png', mimeType: 'image/png', buffer: PNG_2X2 },
    { name: 's02-k7.png', mimeType: 'image/png', buffer: PNG_2X2 },
    { name: 'okladka.png', mimeType: 'image/png', buffer: PNG_2X2 },
    { name: 'strony.zip', mimeType: 'application/zip', buffer: Buffer.from(zip, 'base64') },
  ]);
  await strona.waitForFunction(() => /Wgrano/.test(document.querySelector('#powiadomienie').textContent));
  assert.match(await strona.textContent('#powiadomienie'), /Wgrano: 2 strony, obrazy w kadrach: 1\. Pominięto: okladka\.png; s02-k7\.png – na stronie 2 nie ma kadru 7/);
  const p = await strona.evaluate(() => {
    const x = window.seriodruk.stan.projekt;
    const w = x.sekcje[0].wydruk;
    return {
      stron: x.strony.length, spad: w.spad_mm, w: w.szerokosc_mm,
      s1: x.strony[0].obiekty.map((o) => [o.type, o.kadr_nr ?? null, o.type === 'image' ? [o.left, Math.round(o.width * o.scaleX * 10) / 10] : o.text ?? null]),
      s2: x.strony[1].obiekty.filter((o) => o.kadr_nr).map((o) => [o.kadr_nr, Boolean(o.zasob)]),
      s3: x.strony[2].obiekty.map((o) => o.type),
    };
  });
  assert.equal(p.stron, 3, 'strona 3 z ZIP-a doszła');
  assert.deepEqual(p.s1, [['image', null, [-p.spad, p.w + 2 * p.spad]], ['textbox', null, 'Hej']], 'strona 1: obraz na spad pod spodem, kadry znikają, dymek zostaje');
  assert.deepEqual(p.s2, [[1, true], [2, false], [3, false]], 'obraz w kadrze 1 strony 2');
  assert.deepEqual(p.s3, ['image']);
  assert.deepEqual(bledy, []);
});

test('komiks: kontrola przed drukiem – mały tekst, dymek poza stroną i na dwóch kadrach, ogonek poza kadrami, puste kadry (#370)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kontrola komiksu');
  const uwagi = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.sekcje[0].typ = 'komiks';
    const { siatkaKadrow, elementKadru } = await import('./js/kadry.js');
    const s = p.strony[0];
    // dwa kadry jeden pod drugim: y 10–103 i 107–200
    s.obiekty = siatkaKadrow({ x: 10, y: 10, w: 128, h: 190 }, [[1], [1]], 4).map((k, i) => elementKadru(k, i + 1, { id: `k${i}` }));
    s.obiekty[0].zasob = 'z_obraz';
    const dymek = (id, text, left, top, extra = {}) => ({ type: 'textbox', id, text, left, top, width: 30, height: 8, fontSize: 3.528, dymek: { rodzaj: 'mowa', ogonek: { x: 10, y: 15 } }, ...extra });
    s.obiekty.push(
      dymek('ok', 'Wszystko dobrze', 20, 20),
      dymek('maly', 'Malutki', 20, 40, { fontSize: 2 }),
      dymek('poza', 'Za brzegiem', 130, 50),
      dymek('rynna', 'Na rynnie', 40, 99, { height: 12 }),
      dymek('ogon', 'Ogonek w bok', 20, 60, { dymek: { rodzaj: 'mowa', ogonek: { x: -15, y: 5 } } }),
    );
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    return sprawdzProjekt(p).filter((u) => u.rodzaj === 'komiks').map((u) => [u.idObiektu || null, u.opis]);
  });
  const opisy = {};
  for (const [id, o] of uwagi) opisy[id || 'strona'] = `${opisy[id || 'strona'] || ''} ${o}`;
  assert.equal(opisy.ok, undefined, 'poprawny dymek bez uwag');
  assert.match(opisy.maly, /„Malutki” ma 5\.7 pt/);
  assert.match(opisy.poza, /wychodzi poza stronę/);
  assert.match(opisy.rynna, /na dwóch kadrach/);
  assert.match(opisy.ogon, /celuje poza kadry/);
  assert.match(opisy.strona, /Strona 1: puste kadry \(2\)|pusty kadr \(2\)/);
  assert.deepEqual(bledy, []);
});
