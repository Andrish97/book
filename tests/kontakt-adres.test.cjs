// #406: formularz kontaktowy ma własny adres makietka.app/#/kontakt (link wsparcia w katalogu łączników Claude) –
// otwiera się bez konta nad ekranem logowania i po zalogowaniu nad listą projektów; po zamknięciu adres wraca.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('#/kontakt bez konta: formularz nad ekranem logowania, po zamknięciu adres wraca', async (t) => {
  const { strona, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.waitForSelector('#ekran-logowania', { state: 'visible' });
  await strona.evaluate(() => { location.hash = '#/kontakt'; });
  await strona.waitForSelector('#dlg-kontakt[open]');
  await strona.reload();
  await strona.waitForSelector('#dlg-kontakt[open]');
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'logowanie');
  await strona.evaluate(() => document.querySelector('#dlg-kontakt').close());
  await strona.waitForFunction(() => !/kontakt/.test(location.hash));
  assert.deepEqual(bledy, []);
});

test('#/kontakt po zalogowaniu: formularz nad listą projektów z adresem konta', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => { location.hash = '#/kontakt'; });
  await strona.waitForSelector('#dlg-kontakt[open]');
  assert.equal(await strona.evaluate(() => document.body.dataset.ekran), 'projekty');
  assert.ok(await strona.inputValue('#form-kontakt [name="email"]'));
  await strona.evaluate(() => document.querySelector('#dlg-kontakt').close());
  await strona.waitForFunction(() => location.hash === '#/projekty');
  assert.deepEqual(bledy, []);
});

test('angielskie adresy: #/contact – formularz kontaktowy, #/docs/25 – instrukcja (#408)', async (t) => {
  const { strona, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.waitForSelector('#ekran-logowania', { state: 'visible' });
  await strona.evaluate(() => { location.hash = '#/contact'; });
  await strona.waitForSelector('#dlg-kontakt[open]');
  await strona.evaluate(() => document.querySelector('#dlg-kontakt').close());
  await strona.waitForFunction(() => !/contact/.test(location.hash));
  await strona.evaluate(() => { location.hash = '#/docs/25'; });
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.evaluate(() => document.querySelector('#dlg-instrukcja').close());
  await strona.waitForFunction(() => !/docs/.test(location.hash));
  assert.deepEqual(bledy, []);
});
