// Pasek postępu (plan J, uwagi 22.11: „zakrywa elementy… zawsze nad top barem, ale żeby okienka nie były
// zasłaniane”): cienki pasek na samej górze ekranu; dopóki jest widoczny, górny pasek, edytor i okna przesuwają się
// pod niego. Telefon i komputer, ekran projektu i otwarte okno; po zniknięciu – wszystko wraca na miejsce.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

async function sprawdz(strona, opis) {
  const pokaz = () => strona.evaluate(async () => { const { postep } = await import('./js/postep.js'); window.__p = postep('Wysyłanie obrazów na konto', { razem: 10, opoznienie: 0 }); window.__p.krok(3); });
  const ramki = () => strona.evaluate(() => {
    const r = (e) => (e ? e.getBoundingClientRect() : null);
    const pasek = document.querySelector('.postepy');
    const pasekApl = [...document.querySelectorAll('.ekran .pasek-aplikacji')].find((e) => e.offsetParent);
    // Przyciski górnego paska (tło paska sięga krawędzi ekranu jak przy wycięciu w telefonie – liczy się treść).
    const gora = [...pasekApl.querySelectorAll('button, h1, .tytul-ekranu')].find((e) => e.offsetParent && e.getBoundingClientRect().height > 0);
    const okno = [...document.querySelectorAll('dialog[open]')].at(-1);
    return { postep: r(pasek), gora: r(gora), okno: r(okno), wys: getComputedStyle(document.documentElement).getPropertyValue('--wys-postepu') };
  });
  const przed = await ramki();
  await pokaz();
  await strona.waitForFunction(() => 'postep' in document.documentElement.dataset);
  let w = await ramki();
  assert.ok(w.postep && w.postep.top === 0 && w.postep.height > 10 && w.postep.height < 40, `${opis}: cienki pasek na górze ${JSON.stringify(w.postep)}`);
  assert.ok(w.gora.top >= w.postep.bottom - 0.5, `${opis}: przyciski górnego paska pod paskiem postępu (${w.gora.top} < ${w.postep.bottom})`);
  assert.equal(Math.round(w.gora.height), Math.round(przed.gora.height), `${opis}: przyciski tej samej wysokości`);
  assert.match(await strona.textContent('.postepy'), /Wysyłanie obrazów na konto\s*3 z 10/);
  // Okno otwarte w trakcie: zaczyna się pod paskiem postępu.
  await strona.evaluate(() => document.querySelector('#dlg-potwierdz').showModal());
  await strona.waitForTimeout(150);
  w = await ramki();
  // Komputer: okno zaczyna się pod paskiem; telefon (zasłonka): pasek jest pierwszym wierszem okna – reszta okna pod nim.
  const nachodzi = await strona.evaluate(() => {
    const d = document.querySelector('#dlg-potwierdz');
    const p = d.querySelector('.postepy')?.getBoundingClientRect() || document.querySelector('.postepy').getBoundingClientRect();
    return [...d.children].filter((c) => !c.classList.contains('postepy') && c.offsetParent).map((c) => c.getBoundingClientRect())
      .some((r) => r.height > 0 && r.top < p.bottom - 0.5 && r.bottom > p.top + 0.5);
  });
  assert.equal(nachodzi, false, `${opis}: nic w oknie nie jest pod paskiem postępu`);
  if (!opis.startsWith('telefon')) assert.ok(w.okno.top >= w.postep.bottom - 0.5, `${opis}: okno pod paskiem postępu (${w.okno.top} < ${w.postep.bottom})`);
  assert.equal(await strona.evaluate(() => document.querySelector('.postepy').parentElement.id), 'dlg-potwierdz', `${opis}: pasek nad oknem (w nim), nie pod przyciemnieniem`);
  await strona.evaluate(() => document.querySelector('#dlg-potwierdz').close());
  await strona.evaluate(() => window.__p.koniec());
  await strona.waitForFunction(() => !('postep' in document.documentElement.dataset));
  w = await ramki();
  assert.equal(w.postep, null);
  assert.equal(Math.round(w.gora.top), Math.round(przed.gora.top), `${opis}: po zniknięciu górny pasek wraca`);
}

test('pasek postępu nad górnym paskiem – komputer: lista projektów i edytor, okno pod paskiem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await sprawdz(strona, 'komputer, projekty');
  await nowyProjekt(strona, 'Pasek postępu');
  await sprawdz(strona, 'komputer, edytor');
  assert.deepEqual(bledy, []);
});

test('pasek postępu nad górnym paskiem – telefon: edytor, zasłonka pod paskiem', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Pasek postępu');
  await sprawdz(strona, 'telefon, edytor');
  assert.deepEqual(bledy, []);
});
