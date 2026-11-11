const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, ekran } = require('./pomoc.cjs');

test('podgląd: wszystkie strony bez edycji, rozkładówki w parach, powrót do edycji klikniętej strony', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', 'Do podglądu');
  await strona.click('#form-nowy label:has-text("Rozkładówki")');
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
  await strona.click('[data-akcja="dodaj-tekst"]');
  for (let i = 0; i < 3; i += 1) await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 4);

  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  assert.match(new URL(strona.url()).hash, /^#\/p\/[0-9a-f-]{36}\/podglad$/);
  assert.equal(await strona.locator('.podglad-strona[data-id]').count(), 4);
  // 1 sama (prawa), para 2+3, 4 sama (lewa)
  assert.deepEqual(await strona.$$eval('.podglad-wiersz', (w) => w.map((x) => x.querySelectorAll('.podglad-strona[data-id]').length)), [1, 2, 1]);
  // Podgląd otwiera się na stronie, którą edytowano (ostatniej); strony rysują się, gdy są widoczne.
  await strona.waitForFunction(() => [...document.querySelectorAll('.podglad-strona[data-id] img')].at(-1).src.startsWith('data:image/png'));
  await strona.evaluate(() => { document.querySelector('#podglad-tresc').scrollTop = 0; });
  await strona.waitForFunction(() => document.querySelector('.podglad-strona[data-id] img').src.startsWith('data:image/png'));
  assert.equal(await strona.locator('#ekran-podgladu canvas').count(), 0, 'w podglądzie nie ma płótna do edycji');

  // Odświeżenie zostaje w podglądzie.
  await strona.reload();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  assert.equal(await strona.locator('.podglad-strona[data-id]').count(), 4);

  // Kliknięcie strony 3 otwiera ją w edytorze.
  await strona.click('.podglad-strona[data-id] >> nth=2 >> button');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'edytor' && window.seriodruk.stan.indeks === 2);

  // Escape w podglądzie wraca do edytora.
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.keyboard.press('Escape');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  assert.equal(await ekran(strona), 'edytor');
  assert.deepEqual(bledy, []);
});

test('prezentacja: rozkładówka po rozkładówce, strzałki i Esc', async (t) => {
  const { otworz } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', 'Pokaz');
  await strona.click('#form-nowy label:has-text("Rozkładówki")');
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
  for (let i = 0; i < 3; i += 1) await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 4);
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.evaluate(() => { document.querySelector('#podglad-tresc').scrollTop = 0; });
  await strona.click('[data-akcja="podglad-prezentacja"]');
  await strona.waitForSelector('.prezentacja');
  const licznik = () => strona.textContent('.prezentacja-licznik');
  // Strona 1 stoi sama po prawej (pusta kartka z lewej), potem para 2–3, potem 4.
  assert.match(await licznik(), /str\. 1 · 1 z 3/);
  assert.equal(await strona.locator('.prezentacja-kartka.pusta').count(), 1);
  await strona.keyboard.press('ArrowRight');
  assert.match(await licznik(), /str\. 2–3 · 2 z 3/);
  await strona.waitForFunction(() => [...document.querySelectorAll('.prezentacja-kartka img')].every((i) => i.naturalWidth > 0));
  await strona.click('.prezentacja-strzalka.dalej');
  assert.match(await licznik(), /str\. 4 · 3 z 3/);
  assert.ok(await strona.isDisabled('.prezentacja-strzalka.dalej'));
  // Esc zamyka prezentację, ale zostaje w podglądzie.
  await strona.keyboard.press('Escape');
  await strona.waitForSelector('.prezentacja', { state: 'detached' });
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'podglad');
  assert.deepEqual(bledy, []);
});
