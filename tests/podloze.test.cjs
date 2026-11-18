// Podłoże (#213): kolorowy papier i przezroczysta folia – tło stron w edytorze i podglądzie, w PDF bez farby;
// kontrola przed drukiem ostrzega przed bielą (to brak farby) i folią bez białego poddruku.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('podłoże: kolorowy papier w edytorze, biel w PDF, ostrzeżenia; folia na szachownicy', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Zaproszenie na kremowym');
  // Ustawienia sekcji → Podłoże: kolorowy papier.
  await strona.evaluate(async () => (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(window.seriodruk.stan.projekt.sekcje[0].id));
  await strona.waitForSelector('#dlg-sekcja[open]');
  await strona.selectOption('#dlg-sekcja select[name="podloze"]', 'kolor');
  assert.ok(await strona.isVisible('#pole-podloze-kolor'));
  assert.match(await strona.textContent('#opis-podloza'), /nie drukuje się/);
  await strona.evaluate(() => { const i = document.querySelector('#dlg-sekcja input[name="podloze_kolor"]'); i.value = '#f3e4c2'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await strona.click('#dlg-sekcja button[value="ok"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].podloze?.kolor === '#f3e4c2');
  await strona.waitForFunction(() => window.seriodruk.edytor.tloAktywnej === '#f3e4c2');
  // Biały tekst na kremowym papierze – ostrzeżenie; PDF: tło białe (bez farby), podgląd: kolor papieru.
  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony[0].obiekty.push({ type: 'textbox', id: 'o_bialy', text: 'Biały napis', left: 10, top: 10, width: 60, fill: '#ffffff', fontSize: 6 });
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { zlozCel } = await import('./js/zlozenie.js');
    const { rozwin } = await import('./js/serie.js');
    const ciag = rozwin(p);
    const uwagi = sprawdzProjekt(p, ciag).filter((u) => u.rodzaj === 'podloze');
    const druk = await zlozCel(p, ciag.egzemplarze[0], { ciag, bezPodloza: true });
    const ekran = await zlozCel(p, ciag.egzemplarze[0], { ciag });
    p.strony[0].obiekty.pop();
    return { uwagi: uwagi.map((u) => u.opis), druk: druk.tlo, ekran: ekran.tlo };
  });
  assert.equal(w.druk, '#ffffff', 'w PDF papier się nie drukuje');
  assert.equal(w.ekran, '#f3e4c2', 'podgląd w kolorze papieru');
  assert.equal(w.uwagi.length, 1);
  assert.match(w.uwagi[0], /kolorowym papierze: białe elementy nie wydrukują się/);
  // Folia: szachownica i przypomnienie o białym poddruku.
  await strona.evaluate(() => { const p = window.seriodruk.stan.projekt; p.sekcje[0].podloze = { rodzaj: 'folia' }; });
  const f = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { tloStrony } = await import('./js/projekt.js');
    return { tlo: tloStrony(p, p.strony[0]), uwagi: sprawdzProjekt(p).filter((u) => u.rodzaj === 'podloze').map((u) => u.opis) };
  });
  assert.equal(f.tlo, 'transparent');
  assert.match(f.uwagi.join(' '), /żaden element nie ma białego poddruku/);
  assert.deepEqual(bledy, []);
});
