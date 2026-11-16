// Audyt testów (#160): operacje na stronach z menu strony – każda dotyka treści projektu, a dotąd tylko
// „Duplikuj” była sprawdzana (przy tekście płynącym). Zmień nazwę, Duplikuj (kopia niezależna od oryginału),
// Przesuń wyżej / niżej (tylko w obrębie sekcji), przeniesienie do innej sekcji (właściwości strony),
// Usuń stronę z potwierdzeniem i „Cofnij” – a na koniec wszystko po zapisie i wczytaniu od nowa.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('strony z menu: nazwa, duplikat niezależny, przesuwanie w sekcji, do innej sekcji, usunięcie i cofnięcie – po wczytaniu z konta', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Strony');
  await strona.evaluate(async () => {
    const { stan, przeladuj } = window.seriodruk;
    const P = await import('./js/projekt.js');
    const p = stan.projekt;
    const druga = P.nowaSekcja('Dodatki', p.sekcje[0].wydruk);
    p.sekcje.push(druga);
    p.strony[0].nazwa = 'A';
    p.strony[0].obiekty = [{ type: 'rect', left: 10, top: 10, width: 30, height: 20, fill: '#ff0000', id: 'rA' }];
    for (const n of ['B', 'C']) { const s = P.nowaStrona(n, p.sekcje[0].id); s.obiekty = [{ type: 'rect', left: 10, top: 10, width: 30, height: 20, fill: '#00ff00', id: `r${n}` }]; p.strony.push(s); }
    p.strony.push(P.nowaStrona('D', druga.id));
    await przeladuj();
  });
  const nazwy = () => strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => `${s.nazwa}@${window.seriodruk.stan.projekt.sekcje.findIndex((x) => x.id === s.sekcja)}`));
  const menu = async (i, akcja) => {
    await strona.click(`#lista-stron li.strona >> nth=${i} >> .menu-miniatury`);
    await strona.click(`#menu-strony [data-akcja="${akcja}"]`);
  };
  assert.deepEqual(await nazwy(), ['A@0', 'B@0', 'C@0', 'D@1']);

  // Zmień nazwę.
  await menu(1, 'strona-nazwa');
  await strona.waitForSelector('#dlg-nazwa[open]');
  await strona.fill('#dlg-nazwa input[name=wartosc]', 'Bé');
  await strona.click('#dlg-nazwa button[value=tak]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[1].nazwa === 'Bé');

  // Duplikat: tuż za oryginałem, nowe id strony i elementów; zmiana w kopii nie rusza oryginału.
  await menu(0, 'strona-duplikuj');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 5);
  const kopia = await strona.evaluate(() => {
    const [a, k] = window.seriodruk.stan.projekt.strony;
    // Kopia jest otwarta na płótnie – zmiana przez edytor, jak ręczna.
    const e = window.seriodruk.edytor;
    const o = e.canvas.getObjects().find((x) => x.id === k.obiekty[0].id);
    o.set('fill', '#0000ff');
    e.zatwierdz();
    return { nazwa: k.nazwa, idInne: a.id !== k.id, elemInne: a.obiekty[0].id !== k.obiekty[0].id, oryginal: a.obiekty[0].fill, indeks: window.seriodruk.stan.indeks };
  });
  assert.deepEqual(kopia, { nazwa: 'A (kopia)', idInne: true, elemInne: true, oryginal: '#ff0000', indeks: 1 });

  // Przesuń niżej / wyżej: zamiana z sąsiadem w tej samej sekcji; ostatnia strona sekcji nie przechodzi do następnej.
  await menu(0, 'strona-dol');
  assert.deepEqual(await nazwy(), ['A (kopia)@0', 'A@0', 'Bé@0', 'C@0', 'D@1']);
  await strona.click('#lista-stron li.strona >> nth=3 >> .menu-miniatury');
  assert.equal(await strona.isDisabled('#menu-strony [data-akcja="strona-dol"]'), true, 'ostatnia strona sekcji – „niżej” wyłączone');
  assert.equal(await strona.isDisabled('#menu-strony [data-akcja="strona-gora"]'), false);
  await strona.keyboard.press('Escape');
  await menu(2, 'strona-gora');
  assert.deepEqual(await nazwy(), ['A (kopia)@0', 'Bé@0', 'A@0', 'C@0', 'D@1']);

  // Do innej sekcji (właściwości strony): na koniec tamtej sekcji.
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    await (await import('./js/app/lista-stron.js')).przeniesStroneDoSekcji(p.strony.find((s) => s.nazwa === 'C'), p.sekcje[1].id);
  });
  assert.deepEqual(await nazwy(), ['A (kopia)@0', 'Bé@0', 'A@0', 'D@1', 'C@1']);

  // Usuń: pytanie, potem strona znika; „Cofnij” przywraca ją z treścią.
  await menu(2, 'strona-usun');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  await strona.click('#potwierdz-nie');
  assert.equal((await nazwy()).length, 5, 'Anuluj nie usuwa');
  await menu(2, 'strona-usun');
  await strona.click('#dlg-potwierdz[open] #potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 4);
  assert.deepEqual(await nazwy(), ['A (kopia)@0', 'Bé@0', 'D@1', 'C@1']);
  await strona.keyboard.press('Escape');
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 5);
  assert.deepEqual(await nazwy(), ['A (kopia)@0', 'Bé@0', 'A@0', 'D@1', 'C@1']);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[2].obiekty[0].fill), '#ff0000', 'treść przywróconej strony');

  // Po zapisie i wczytaniu z konta – ta sama kolejność, sekcje, nazwy i treść kopii.
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk?.stan?.projekt?.strony?.length === 5 && window.seriodruk.edytor?.wydruk);
  assert.deepEqual(await nazwy(), ['A (kopia)@0', 'Bé@0', 'A@0', 'D@1', 'C@1']);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => s.obiekty[0]?.fill || null)), ['#0000ff', '#00ff00', '#ff0000', null, '#00ff00']);
  assert.deepEqual(bledy, []);
});

// Błąd znaleziony przy audycie (#160): „Cofnij” w trakcie wczytywania strony po jej usunięciu (wolny telefon)
// cofało poprzednią czynność, a usunięta strona nie wracała. Wczytywanie spowolnione sztucznie.
test('cofnięcie w trakcie wczytywania po usunięciu strony cofa usunięcie, nie poprzednią czynność', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wolny telefon');
  await strona.evaluate(async () => {
    const { stan, przeladuj } = window.seriodruk;
    const P = await import('./js/projekt.js');
    for (const n of ['B', 'C']) stan.projekt.strony.push(P.nowaStrona(n, stan.projekt.sekcje[0].id));
    stan.projekt.strony[0].nazwa = 'A';
    await przeladuj();
  });
  const nazwy = () => strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => s.nazwa));
  // Poprzednia czynność: zmiana nazwy strony B (osobny krok cofania).
  await strona.click('#lista-stron li.strona >> nth=1 >> .menu-miniatury');
  await strona.click('#menu-strony [data-akcja="strona-nazwa"]');
  await strona.fill('#dlg-nazwa input[name=wartosc]', 'Bé');
  await strona.click('#dlg-nazwa button[value=tak]');
  await strona.waitForFunction(() => !window.seriodruk.stan.doHistorii && window.seriodruk.stan.projekt.strony[1].nazwa === 'Bé');
  // Wczytywanie arkusza trwa 800 ms.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const zwykle = e.wczytajArkusz.bind(e);
    e.wczytajArkusz = async (...a) => { await new Promise((r) => setTimeout(r, 800)); return zwykle(...a); };
  });
  await strona.click('#lista-stron li.strona >> nth=2 >> .menu-miniatury');
  await strona.click('#menu-strony [data-akcja="strona-usun"]');
  await strona.click('#dlg-potwierdz[open] #potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2);
  // Strona już usunięta z listy, płótno jeszcze się wczytuje – „Cofnij”.
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 3, null, { timeout: 10000 });
  assert.deepEqual(await nazwy(), ['A', 'Bé', 'C'], 'wróciła usunięta strona, zmiana nazwy została');
  assert.deepEqual(bledy, []);
});
