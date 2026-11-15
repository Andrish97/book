const test = require('node:test');
const fs = require('node:fs');
const { otworz } = require('./pomoc.cjs');

const zrodlo = fs.readFileSync(`${__dirname}/../scripts/zrzuty-instrukcji.cjs`, 'utf8');
const od = zrodlo.indexOf('async function przykladoweProjekty');
const doKonca = zrodlo.indexOf('\n}\n', od) + 3;
// eslint-disable-next-line no-eval
const przykladoweProjekty = eval(`(${zrodlo.slice(od, doKonca)})`);

test('przyklady', async (t) => {
  const { strona } = await otworz(t);
  if (process.env.FLAGA) await strona.evaluate((f) => { globalThis[f] = true; }, process.env.FLAGA);
  strona.on('console', (m) => { if (/LOG/.test(m.text())) console.log(m.text()); });
  strona.on('crash', () => console.log('CRASH'));
  const t0 = Date.now();
  try { await przykladoweProjekty(strona); console.log('OK', Date.now() - t0); } catch (e) { console.log('BLAD', e.message.slice(0, 200)); }
});
