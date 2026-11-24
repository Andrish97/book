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
