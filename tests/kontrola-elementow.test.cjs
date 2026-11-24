// #414: kontrola przed drukiem widzi też to, co zwykle sprawdza drukarnia: rozdzielczość zdjęć, mały tekst, cienkie
// linie, brakujące czcionki, tekst przy krawędzi cięcia, element do krawędzi bez spadu, element poza stroną.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('kontrola elementów: rozdzielczość, mały tekst, cienka linia, czcionka, krawędź cięcia, spad, poza stroną', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Do drukarni');
  const uwagi = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.zasoby.zdj = { nazwa: 'zdjecie.jpg', szer: 600, wys: 400 };
    p.strony[0].obiekty = [
      { type: 'image', id: 'o1', zasob: 'zdj', nazwa: 'zdjecie.jpg', left: 20, top: 20, width: 600, height: 400, scaleX: 0.25, scaleY: 0.25 }, // 150 × 100 mm → ok. 102 dpi
      { type: 'image', id: 'o1b', zasob: 'zdj', nazwa: 'małe', left: 20, top: 150, width: 600, height: 400, scaleX: 0.05, scaleY: 0.05 }, // 30 × 20 mm → 508 dpi – dobrze
      { type: 'textbox', id: 'o2', text: 'Drobny dopisek', left: 20, top: 140, width: 60, height: 2, fontSize: 1.5, fontFamily: 'Inter' }, // ok. 4,3 pt
      { type: 'textbox', id: 'o3', text: 'Tytuł', left: 20, top: 120, width: 60, height: 8, fontSize: 6, fontFamily: 'Czcionka Spoza' },
      { type: 'textbox', id: 'o4', text: 'Numer strony', left: 1, top: 200, width: 30, height: 4, fontSize: 4, fontFamily: 'Inter' }, // 1 mm od krawędzi
      { type: 'rect', id: 'o5', left: 20, top: 60, width: 30, height: 20, fill: '', stroke: '#000000', strokeWidth: 0.05 },
      { type: 'rect', id: 'o6', nazwa: 'Pasek', left: 0, top: 0, width: 148, height: 12, fill: '#d1495b' }, // do krawędzi, bez spadu
      { type: 'rect', id: 'o7', nazwa: 'Tło', left: -3, top: -3, width: 154, height: 216, fill: '#eeeeee' }, // ze spadem – dobrze
      { type: 'rect', id: 'o8', nazwa: 'Zgubiony', left: 400, top: 50, width: 10, height: 10, fill: '#000000' },
    ];
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const r = sprawdzProjekt(p).filter((u) => u.idObiektu).map((u) => [u.rodzaj, u.idObiektu]); return r;
  });
  assert.deepEqual(uwagi.sort(), [
    ['bez_spadu', 'o6'], ['brak_czcionki', 'o3'], ['cienka_linia', 'o5'], ['maly_tekst', 'o2'], ['obraz_dpi', 'o1'], ['poza_spadem', 'o1'], ['poza_strona', 'o8'], ['przy_krawedzi', 'o4'], // #417: zdjęcie 150 mm na stronie 148 mm
  ].sort());
  // Opis po ludzku, z miejscem.
  const opis = await strona.evaluate(async () => (await import('./js/kontrola.js')).sprawdzProjekt(window.seriodruk.stan.projekt).find((u) => u.rodzaj === 'obraz_dpi').opis);
  assert.match(opis, /ok\. 102 dpi.*strona 1\.$/);
  assert.deepEqual(bledy, []);
});

// #417: podsumowanie „Sprawdź przed drukiem” ma te same uwagi co ostrzeżenia przy stronie – wchodzi w margines,
// wychodzi poza spad, skład – a pola z danymi nie dają w edytorze fałszywych „podwójnych spacji”.
test('podsumowanie ma ostrzeżenia ze strony: margines, poza spadem, skład; bez fałszywych podwójnych spacji', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Jak przy stronie');
  const w = await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    e.canvas.add(new fabric.Rect({ id: 'margines', left: 2, top: 40, width: 30, height: 20, fill: '#336699', nazwa: 'W marginesie' }));
    e.canvas.add(new fabric.Rect({ id: 'spad', left: -10, top: 80, width: 30, height: 20, fill: '#993366', nazwa: 'Za spadem' }));
    const a = e.dodajTekst('Dzień {dzien_roku} · {miesiac}'); a.set({ id: 'pola', left: 30, top: 120, width: 80 });
    // #424: łamanie pilnowane samo – uwaga o składzie z powodu znaków (podwójna spacja, proste cudzysłowy).
    const b = e.dodajTekst('Wczoraj  poszedłem do sklepu i kupiłem "chleb", masło oraz mleko.'); b.set({ id: 'sklad', left: 30, top: 140, width: 40 });
    e.canvas.requestRenderAll();
    e.zatwierdz?.();
    e.przeliczOstrzezenia();
    await window.seriodruk.zapiszTeraz?.();
    const { sprawdzWszystko } = await import('./js/kontrola-skladu.js');
    const k = await sprawdzWszystko(window.seriodruk.stan.projekt);
    return {
      edytor: e.ostrzezenia.map((o) => `${o.typ}|${o.id}`).sort(),
      podsumowanie: k.map((u) => `${u.rodzaj}|${u.idObiektu}`).sort(),
      opisy: k.filter((u) => ['w_marginesie', 'poza_spadem'].includes(u.rodzaj)).map((u) => u.opis),
    };
  });
  assert.ok(w.edytor.includes('w_marginesie|margines') && w.edytor.includes('poza_spadem|spad') && w.edytor.includes('sklad_pl|sklad'), JSON.stringify(w.edytor));
  assert.ok(!w.edytor.includes('sklad_pl|pola'), 'pola z danymi to nie podwójne spacje');
  // Nieznane pole podsumowanie zgłasza po nazwie pola (bez id elementu) – porównujemy rodzaj.
  for (const u of w.edytor) assert.ok(w.podsumowanie.includes(u) || (u.startsWith('nieznane_pole|') && w.podsumowanie.some((x) => x.startsWith('nieznane_pole|'))), `w podsumowaniu brak: ${u} (${JSON.stringify(w.podsumowanie)})`);
  assert.ok(w.opisy.some((o) => /„W marginesie” wchodzi w margines/.test(o)));
  assert.ok(w.opisy.some((o) => /„Za spadem” wychodzi poza spad/.test(o)));
  assert.deepEqual(bledy, []);
});

// #419: „Kopiuj raport” w oknie „Sprawdź przed drukiem” – wszystkie uwagi jako tekst w schowku: nagłówek z nazwą
// projektu, data, liczba uwag i uwagi ponumerowane. Przycisk pojawia się po zakończeniu sprawdzania.
test('Sprawdź przed drukiem: Kopiuj raport – wszystkie uwagi w schowku', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await nowyProjekt(strona, 'Raport');
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony[0].obiekty = [
      { type: 'textbox', version: '5.3.0', id: 'r1', text: 'Drobny dopisek', left: 20, top: 140, width: 60, height: 2, fontSize: 1.5, fontFamily: 'Inter' },
      { type: 'rect', version: '5.3.0', id: 'r2', nazwa: 'Zgubiony', left: 400, top: 50, width: 10, height: 10, fill: '#000000' },
    ];
    await window.seriodruk.przeladuj();
  });
  // #423: w trakcie sprawdzania przycisk widoczny, ale wyszarzony; po zakończeniu – aktywny.
  const stany = await strona.evaluate(async () => {
    const b = document.querySelector('#kontrola-kopiuj');
    const p = window.seriodruk.oknoKontroli.otworz();
    const wTrakcie = [b.hidden, b.disabled];
    await p;
    return [wTrakcie, [b.hidden, b.disabled]];
  });
  assert.deepEqual(stany, [[false, true], [false, false]]);
  // #422: przycisk widać od razu (także w trakcie sprawdzania tekstów); pełny raport – po zakończeniu.
  await strona.waitForSelector('#kontrola-kopiuj:not([hidden])');
  await strona.waitForFunction(() => /do sprawdzenia|w porządku/.test(document.querySelector('#kontrola-stan').textContent));
  await strona.click('#kontrola-kopiuj');
  const tekst = await strona.evaluate(() => navigator.clipboard.readText());
  const wiersze = tekst.split('\n');
  assert.equal(wiersze[0], 'Sprawdź przed drukiem – Raport');
  assert.match(wiersze[2], /2 uwagi do sprawdzenia/);
  const uwagi = wiersze.filter((w) => /^\d+\. /.test(w));
  assert.equal(uwagi.length, 2, tekst);
  assert.ok(uwagi.some((w) => /Drobny dopisek/.test(w)) && uwagi.some((w) => /Zgubiony/.test(w)));
  assert.deepEqual(bledy, []);
});

// #420: poważne uwagi (tekst ucięty, brak obrazu/czcionki, pole bez wartości, brak danych, zdjęcie < 150 dpi) na
// czerwono – w „Sprawdź przed drukiem” (na początku listy), w oknie PDF i w ostrzeżeniach edytora; eksport PDF pyta
// przy nich o potwierdzenie („Wróć i popraw” – nic się nie eksportuje).
test('poważne uwagi na czerwono i pytanie przed eksportem PDF', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Poważne');
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony[0].obiekty = [
      { type: 'textbox', version: '5.3.0', id: 'p1', text: 'Tytuł', left: 20, top: 120, width: 60, height: 8, fontSize: 6, fontFamily: 'Czcionka Spoza' },
      { type: 'textbox', version: '5.3.0', id: 'p2', text: 'Drobny dopisek', left: 20, top: 140, width: 60, height: 2, fontSize: 1.5, fontFamily: 'Inter' },
    ];
    await window.seriodruk.przeladuj();
  });
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="kontrola"]');
  await strona.waitForFunction(() => /do sprawdzenia/.test(document.querySelector('#kontrola-stan').textContent));
  const lista = await strona.evaluate(() => [...document.querySelectorAll('#kontrola-lista li')].map((li) => [li.classList.contains('powazna'), li.textContent.slice(0, 30)]));
  assert.deepEqual(lista.map((x) => x[0]), [true, false], JSON.stringify(lista));
  assert.match(lista[0][1], /Tytuł/);
  assert.match(await strona.textContent('#kontrola-stan'), /w tym 1 poważna \(na czerwono\)/);
  await strona.click('#kontrola-zamknij');
  // Edytor: czcionka nie jest ostrzeżeniem edytora; ostrzeżenie o polu bez wartości – poważne.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.dodajTekst('Data {nie_ma_takiego_pola}'); e.przeliczOstrzezenia(); });
  await strona.waitForSelector('#lista-ostrzezen li.powazna', { state: 'attached' });
  assert.ok(await strona.evaluate(() => document.querySelector('#licznik-ostrzezen').classList.contains('powazne')), 'licznik ostrzeżeń na czerwono');
  // Okno PDF: poważne na czerwono, eksport pyta – „Wróć i popraw” nie eksportuje.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#pdf-uwagi.powazne li.powazna');
  await strona.click('#pdf-eksportuj');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  assert.match(await strona.textContent('#potwierdz-tytul'), /poważn/);
  assert.equal(await strona.textContent('#potwierdz-tak'), 'Eksportuj mimo to');
  await strona.click('#potwierdz-nie');
  await strona.waitForFunction(() => !document.querySelector('#dlg-potwierdz').open);
  assert.equal(await strona.evaluate(() => window.seriodruk.oknoPdf.trwa), false, 'po „Wróć i popraw” eksport się nie zaczął');
  assert.deepEqual(bledy, []);
});

// #421: rysunek SVG (np. kod kreskowy wgrany jako obraz) jest wektorowy – bez uwagi o rozdzielczości, nawet gdy jego
// „piksele” (rozmiar z viewBox) rozciągnięte na stronie dają mało dpi; zdjęcie obok – z uwagą.
test('kontrola elementów: SVG bez uwagi o dpi', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wektor');
  const uwagi = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.zasoby.svg = { nazwa: 'kod-isbn-przyklad.svg', szer: 120, wys: 60 };
    p.zasoby.jpg = { nazwa: 'zdjecie.jpg', szer: 120, wys: 60 };
    p.strony[0].obiekty = [
      { type: 'image', id: 's1', zasob: 'svg', nazwa: 'kod-isbn-przyklad.svg', left: 20, top: 20, width: 120, height: 60, scaleX: 0.265, scaleY: 0.265 }, // ok. 96 „dpi”
      { type: 'image', id: 'j1', zasob: 'jpg', nazwa: 'zdjecie.jpg', left: 20, top: 60, width: 120, height: 60, scaleX: 0.265, scaleY: 0.265 },
    ];
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    return sprawdzProjekt(p).filter((u) => u.rodzaj === 'obraz_dpi').map((u) => u.idObiektu);
  });
  assert.deepEqual(uwagi, ['j1']);
  assert.deepEqual(bledy, []);
});
