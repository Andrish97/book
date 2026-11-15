// Paski postępu przy dłuższych czynnościach (#159): karta pojawia się dopiero po chwili (krótkie czynności nie
// mrugają), ma pasek z wartością dla czytników ekranu (role=progressbar), liczy „x z y”, znika po końcu,
// a „Anuluj” przerywa eksport PDF bez pliku.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('postęp: krótka czynność nie mruga, długa pokazuje licznik i pasek z wartością, potem znika', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Postęp');
  const wynik = await strona.evaluate(async () => {
    const { postep, zPostepem } = await import('./js/postep.js');
    let pojawilaSie = false;
    const obs = new MutationObserver(() => { if (document.querySelector('.postep')) pojawilaSie = true; });
    obs.observe(document.body, { childList: true, subtree: true });
    await zPostepem('Krótko', () => new Promise((r) => setTimeout(r, 120)));
    await new Promise((r) => setTimeout(r, 400));
    const krotka = pojawilaSie;
    const p = postep('Długa czynność', { razem: 10 });
    await new Promise((r) => setTimeout(r, 450));
    p.krok(4);
    const karta = document.querySelector('.postep');
    const pasek = karta?.querySelector('[role="progressbar"]');
    const stan = { widoczna: Boolean(karta), licznik: karta?.querySelector('.postep-licznik').textContent, wartosc: pasek?.getAttribute('aria-valuenow'), etykieta: pasek?.getAttribute('aria-label') };
    p.koniec();
    obs.disconnect();
    return { krotka, stan, poKoncu: Boolean(document.querySelector('.postep')) };
  });
  assert.equal(wynik.krotka, false, 'krótka czynność bez karty');
  assert.deepEqual(wynik.stan, { widoczna: true, licznik: '4 z 10', wartosc: '40', etykieta: 'Długa czynność' });
  assert.equal(wynik.poKoncu, false);
  assert.deepEqual(bledy, []);
});

test('postęp na telefonie: karta w edytorze nie zasłania paska narzędzi', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Postęp telefon');
  const r = await strona.evaluate(async () => {
    const { postep } = await import('./js/postep.js');
    const p = postep('Coś długiego', { opoznienie: 0 });
    await new Promise((ok) => setTimeout(ok, 50));
    const k = document.querySelector('.postep').getBoundingClientRect();
    const n = document.querySelector('#pasek-narzedzi').getBoundingClientRect();
    p.koniec();
    return { kartaGora: k.top, paskaDol: n.bottom };
  });
  assert.ok(r.kartaGora >= r.paskaDol, `karta (${r.kartaGora}) pod paskiem narzędzi (${r.paskaDol})`);
  assert.deepEqual(bledy, []);
});

test('eksport PDF: postęp „strona i z n” w oknie, Anuluj przerywa bez pliku', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Duży PDF');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    for (let i = 2; i <= 30; i += 1) {
      const s = P.nowaStrona(`S${i}`, p.sekcje[0].id);
      s.obiekty.push({ type: 'textbox', left: 20, top: 20, width: 100, text: `Strona ${i} `.repeat(40), fontSize: 9, fontFamily: 'Inter', fill: '#000', id: `t${i}` });
      p.strony.push(s);
    }
  });
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  let pobrano = false;
  strona.on('download', () => { pobrano = true; });
  await strona.click('#pdf-eksportuj');
  // Karta postępu w oknie PDF z licznikiem stron.
  await strona.waitForSelector('#dlg-pdf .postep .postep-licznik:not(:empty)', { timeout: 20000 });
  const licznik = await strona.textContent('#dlg-pdf .postep .postep-licznik');
  assert.match(licznik, /^\d+ z \d+$/);
  await strona.click('#dlg-pdf .postep .postep-anuluj');
  await strona.waitForFunction(() => /przerwany/i.test(document.querySelector('#pdf-komunikat').textContent), null, { timeout: 30000 });
  await strona.waitForTimeout(300);
  assert.equal(pobrano, false, 'po Anuluj nie ma pliku');
  assert.equal(await strona.locator('.postep').count(), 0, 'karta znika');
  assert.deepEqual(bledy, []);
});
