// #418: ostrzeżenia przy stronie liczą się po przeliczeniu danych – tekst, w którym sama nazwa pola
// („{miesiac_dopelniacz}”) nie mieści się w ramce, a wartości z tabeli się mieszczą, nie jest oznaczany. Gdy
// wartość na którejś stronie się nie mieści – uwaga z numerem tej strony, taka jak w „Sprawdź przed drukiem”.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('ostrzeżenia przy stronie po przeliczeniu: nazwa pola za długa, wartości się mieszczą – bez uwagi', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Pola w ramce');
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.tabele.push({ id: 't1', nazwa: 'Miesiące', kolumny: ['miesiac_dopelniacz'], wiersze: [['marca'], ['maja'], ['lipca']] });
    p.serie.push({ id: 'se1', nazwa: 'Miesiące', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1, dodatkowe: [] });
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty = [{ type: 'textbox', version: '5.3.0', id: 'o_pole', left: 20, top: 20, width: 40, height: 13, ramka_h: 13, text: 'Dzień {miesiac_dopelniacz} kalendarzowego', styles: [], fontSize: 5, fontFamily: 'Inter', fill: '#000000', lineHeight: 1.2 }];
    await window.seriodruk.przeladuj();
  });
  // Na płótnie wzór z nazwą pola – trzy wiersze, nie mieści się; nazwa pola nie poszerza ramki.
  const wzor = await strona.evaluate(async () => { const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 'o_pole'); return [(await import('./js/tekst-ramka.js')).nieMiesciSie(o), Math.round(o.width)]; });
  assert.deepEqual(wzor, [true, 40], 'nazwa pola nie mieści się na wzorze, ramka zostaje szeroka na 40 mm');
  // Po przeliczeniu (w tle) – bez ostrzeżenia.
  await strona.waitForFunction(() => window.seriodruk.edytor.poPrzeliczeniu(window.seriodruk.edytor.canvas.getObjects().find((o) => o.id === 'o_pole')) !== 'liczy');
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.map((o) => [o.typ, o.opis])), []);
  assert.equal(await strona.textContent('#licznik-ostrzezen'), '0');

  // Za długa wartość na drugiej stronie wydruku – ostrzeżenie z numerem strony, jak przed drukiem.
  await strona.evaluate(async () => {
    window.seriodruk.stan.projekt.tabele[0].wiersze[1] = ['bardzo długiego miesiąca w roku przestępnym'];
    window.seriodruk.edytor.przeliczOstrzezenia();
  });
  await strona.waitForFunction(() => window.seriodruk.edytor.ostrzezenia.some((o) => o.typ === 'nie_miesci_sie'), null, { timeout: 10000 });
  const w = await strona.evaluate(async () => {
    const { sprawdzMieszczenie } = await import('./js/kontrola-skladu.js');
    const k = await sprawdzMieszczenie(window.seriodruk.stan.projekt);
    return { edytor: window.seriodruk.edytor.ostrzezenia.filter((o) => o.typ === 'nie_miesci_sie').map((o) => o.opis), przedDrukiem: k.filter((u) => u.rodzaj === 'nie_miesci_sie').map((u) => u.opis) };
  });
  assert.equal(w.edytor.length, 1);
  assert.match(w.edytor[0], /nie mieści się w ramce – strona 2\./);
  assert.deepEqual(w.edytor, w.przedDrukiem, 'ta sama uwaga przy stronie i przed drukiem');
  assert.deepEqual(bledy, []);
});

test('ostrzeżenia przy stronie po przeliczeniu: położenie z danych – margines tylko na stronie, gdzie element w niego wchodzi', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Położenie z danych');
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.tabele.push({ id: 't1', nazwa: 'Kroki', kolumny: ['x'], wiersze: [['0'], ['0'], ['100']] });
    p.serie.push({ id: 'se1', nazwa: 'Kroki', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1, dodatkowe: [] });
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty = [{ type: 'rect', version: '5.3.0', id: 'o_kw', left: 20, top: 40, width: 20, height: 20, fill: '#336699', strokeWidth: 0, nazwa: 'Kwadrat', z_danych: { x: { tryb: 'mm', pole: 'x' } } }];
    await window.seriodruk.przeladuj();
  });
  await strona.waitForFunction(() => window.seriodruk.edytor.poPrzeliczeniu(window.seriodruk.edytor.canvas.getObjects().find((o) => o.id === 'o_kw')) !== 'liczy');
  const w = await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.map((o) => [o.typ, o.opis]));
  assert.equal(w.length, 1, JSON.stringify(w));
  assert.equal(w[0][0], 'w_marginesie');
  assert.match(w[0][1], /„Kwadrat” wchodzi w margines.*strona 3\./);
  assert.deepEqual(bledy, []);
});

// #435: „Apka tak strasznie laguje… klikam, a nic się nie dzieje, a potem dzieje się po kilku sekundach”. Na stronie
// serii z 365 dniami każda zmiana liczyła w tle ostrzeżenia na wszystkich dniach kawałkami po 25 stron – 13–14 blokad
// ekranu po ~0,2 s (na telefonie po sekundzie). Teraz liczenie oddaje głos co ~8 ms i nie blokuje kliknięć.
test('ostrzeżenia z danymi na stronie serii nie blokują ekranu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Bez lagów');
  await strona.evaluate(() => {
    const { stan, edytor: e } = window.seriodruk;
    const p = stan.projekt;
    p.tabele.push({ id: 'dni', nazwa: 'Dni', kolumny: ['data', 'werset', 'opis'], wiersze: Array.from({ length: 365 }, (_, i) => [`${i + 1} stycznia`, `J ${i}:1`, 'Treść czytania na ten dzień, dość długa, żeby zajęła kilka linijek w ramce tekstu. '.repeat(3)]) });
    p.serie.push({ id: 's1', nazwa: 'Dni', tabela: 'dni', tryb: 'tabela', uklad: 'dlugi' });
    p.strony[0].seria = 's1';
    for (let k = 0; k < 6; k += 1) { const o = e.dodajTekst('{data} – {werset}\n{opis}'); o.set({ left: 10, top: 10 + k * 30, width: 120, ramka_h: 25 }); }
    e.zatwierdz?.();
    window.__dlugie = [];
    new PerformanceObserver((l) => { for (const x of l.getEntries()) window.__dlugie.push(Math.round(x.duration)); }).observe({ type: 'longtask' });
  });
  await strona.waitForTimeout(2500);
  await strona.evaluate(() => { window.__dlugie = []; const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.type === 'textbox'); o.set('left', o.left + 1); e.oznaczZmiane(); e.przeliczOstrzezenia(); });
  // Liczenie kończy się w tle (wynik ostrzeżeń dla tej strony), a żadna blokada nie trwa długo.
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'textbox').every((o) => window.seriodruk.edytor.poPrzeliczeniu(o) !== 'liczy'), null, { timeout: 30000 });
  const dlugie = await strona.evaluate(() => window.__dlugie);
  assert.ok(Math.max(0, ...dlugie) < 120, `blokady ekranu: ${dlugie.join(', ')} ms`);
  assert.deepEqual(bledy, []);
});
