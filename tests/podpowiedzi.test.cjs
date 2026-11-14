// Podpowiedzi na telefonie (#96): o klawiaturze znikają na dotyku, długie zwijają się do dwóch linii.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('telefon: podpowiedzi o skrótach ukryte, długie zwinięte i rozwijane stuknięciem; komputer bez zmian', async (t) => {
  const { strona } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Podpowiedzi');
  const stan = await strona.evaluate(() => {
    const widoczne = (el) => getComputedStyle(el).display !== 'none';
    const klawisze = [...document.querySelectorAll('.podpowiedz-klawisze')];
    const zwijane = [...document.querySelectorAll('.podpowiedz-zwijana')];
    return { klawisze: klawisze.length, widoczneKlawisze: klawisze.filter(widoczne).length, zwijane: zwijane.length, urzadzenie: document.documentElement.dataset.urzadzenie };
  });
  assert.equal(stan.urzadzenie, 'telefon');
  assert.ok(stan.klawisze > 0, 'są podpowiedzi o klawiaturze');
  assert.equal(stan.widoczneKlawisze, 0, 'na telefonie ukryte');
  assert.ok(stan.zwijane > 0, 'są długie podpowiedzi');
  // Długa podpowiedź w otwartym oknie: dwie linie, po stuknięciu cała.
  const wynik = await strona.evaluate(async () => {
    const el = [...document.querySelectorAll('.podpowiedz-zwijana')].find((x) => x.closest('dialog'));
    const dlg = el.closest('dialog');
    dlg.showModal();
    await new Promise((ok) => { setTimeout(ok, 400); });
    const linia = parseFloat(getComputedStyle(el).lineHeight) || 16;
    const przed = el.getBoundingClientRect().height;
    el.click();
    const po = el.getBoundingClientRect().height;
    dlg.close();
    return { przed, po, linia, rozwinieta: el.getAttribute('aria-expanded') };
  });
  assert.ok(wynik.przed <= wynik.linia * 2 + 2, `zwinięta do dwóch linii (${wynik.przed} px)`);
  assert.ok(wynik.po > wynik.przed, 'po stuknięciu rozwinięta');
  assert.equal(wynik.rozwinieta, 'true');
});

test('komputer: podpowiedzi widoczne w całości', async (t) => {
  const { strona } = await otworz(t);
  await nowyProjekt(strona, 'Podpowiedzi');
  const widoczne = await strona.evaluate(() => {
    const el = [...document.querySelectorAll('.podpowiedz-klawisze')].find((x) => x.closest('dialog'));
    el.closest('dialog').showModal();
    const w = getComputedStyle(el).display !== 'none';
    el.closest('dialog').close();
    return w;
  });
  assert.equal(widoczne, true);
});
