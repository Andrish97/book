// Własne kontrolki wszędzie (#99): w żadnym oknie nie zostaje widoczna kontrolka systemowa (lista, data,
// kolor, pole wyboru), a lista wyboru na telefonie otwiera się jako zasłonka w obrębie ekranu i zmienia wartość.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Widoczne kontrolki systemowe w dokumencie (pomija ukryte elementy i te, które podmieniła kontrolka własna).
const NATYWNE = () => {
  const widoczny = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  const zle = [];
  for (const el of document.querySelectorAll('select')) if (!el.multiple && !el.dataset.wybor && widoczny(el)) zle.push(`select#${el.id}`);
  for (const el of document.querySelectorAll('select.wybor-natywny')) if (widoczny(el) && getComputedStyle(el).opacity !== '0') zle.push(`select (pod spodem)#${el.id}`);
  for (const el of document.querySelectorAll('input[type="date"]:not([data-data]), input[type="color"]:not([data-kolor]), input[type="range"], input[type="file"]')) if (widoczny(el)) zle.push(`${el.type}#${el.id}`);
  for (const el of document.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
    if (widoczny(el) && getComputedStyle(el).appearance !== 'none') zle.push(`${el.type}#${el.id || el.name}`);
  }
  return zle;
};

test('telefon: żadne okno nie ma kontrolek systemowych; lista „Rola” w oknie Współpraca otwiera się w ekranie i zmienia wartość', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Kontrolki');
  // Wszystkie okna z dokumentu, po kolei.
  const zle = await strona.evaluate(async (kodNatywne) => {
    const natywne = new Function(`return (${kodNatywne})()`);
    const wynik = {};
    for (const dlg of document.querySelectorAll('dialog')) {
      dlg.showModal();
      await new Promise((ok) => { setTimeout(ok, 60); });
      const z = natywne();
      if (z.length) wynik[dlg.id] = z;
      dlg.close();
    }
    return wynik;
  }, NATYWNE.toString());
  assert.deepEqual(zle, {}, 'okna z kontrolkami systemowymi');
  assert.deepEqual(await strona.evaluate(NATYWNE), [], 'ekran edytora');

  // Okno budowane w JS: Współpraca.
  await strona.click('#przycisk-wiecej');
  await strona.click('#menu-wiecej [data-akcja="wspolpraca"]');
  await strona.waitForSelector('#dlg-wspolpraca[open] #form-zaproszenia:not([hidden])');
  await strona.waitForTimeout(400);
  assert.deepEqual(await strona.evaluate(NATYWNE), []);
  await strona.locator('#dlg-wspolpraca .wybor:has(#wspolpraca-rola) .wybor-przycisk').tap();
  const lista = strona.locator('.wybor-lista');
  await lista.waitFor();
  await strona.waitForTimeout(300); // koniec wjazdu
  const r = await lista.boundingBox();
  const ekran = strona.viewportSize();
  assert.ok(r.y >= 0 && r.y + r.height <= ekran.height + 1, `lista w ekranie (${r.y}–${r.y + r.height} z ${ekran.height})`);
  assert.ok(r.width >= ekran.width - 1, `na telefonie lista jako zasłonka na całą szerokość (${r.width} z ${ekran.width})`);
  await strona.locator('.wybor-lista .wybor-opcja', { hasText: 'oglądać' }).tap();
  assert.equal(await strona.inputValue('#wspolpraca-rola'), 'odczyt');
  await strona.waitForFunction(() => !document.querySelector('.wybor-lista'));
  assert.match(await strona.textContent('#dlg-wspolpraca .wybor:has(#wspolpraca-rola) .wybor-tekst'), /oglądać/);
  // Ustawienia konta (sekcje budowane w JS: Miejsce, Dostęp dla AI).
  await strona.keyboard.press('Escape');
  await strona.evaluate(() => { location.hash = '#/konto'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'konto');
  await strona.waitForTimeout(800);
  assert.deepEqual(await strona.evaluate(NATYWNE), [], 'ustawienia konta');
  assert.deepEqual(bledy, []);
});

test('komputer: lista wyboru w oknie stoi tuż pod przyciskiem', async (t) => {
  const { strona } = await otworz(t);
  await nowyProjekt(strona, 'Kontrolki');
  await strona.click('#przycisk-wiecej');
  await strona.click('#menu-wiecej [data-akcja="wspolpraca"]');
  await strona.waitForSelector('#dlg-wspolpraca[open] #form-zaproszenia:not([hidden])');
  const przycisk = strona.locator('#dlg-wspolpraca .wybor:has(#wspolpraca-rola) .wybor-przycisk');
  await przycisk.click();
  const p = await przycisk.boundingBox();
  const l = await strona.locator('.wybor-lista').boundingBox();
  assert.ok(Math.abs(l.y - (p.y + p.height + 4)) <= 2 || Math.abs(l.y + l.height - (p.y - 4)) <= 2, `lista przy przycisku (przycisk ${p.y}, lista ${l.y})`);
  assert.ok(Math.abs(l.x - p.x) <= 2, 'wyrównana do lewej krawędzi przycisku');
});
