// Obrazy w czasie ładowania (#193): wolny obraz ma migoczące tło (nie puste miejsce ani napis alt),
// po wczytaniu – klasa „zaladowany”; obraz, który się nie wczytał – zastępczy rysunek zamiast ikonki
// „zepsutego obrazu”.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('obrazy: migoczące tło w czasie ładowania, klasa po wczytaniu, zastępczy rysunek przy błędzie', async (t) => {
  const { strona, bledy } = await otworz(t, { tryb: 'lokalny' });
  let pusc;
  const czekaj = new Promise((ok) => { pusc = ok; });
  await strona.route('**/wolny-obraz.png', async (r) => { await czekaj; await r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  await strona.route('**/brak-obrazu.png', (r) => r.fulfill({ status: 404, body: 'nie ma' }));
  await strona.evaluate(() => {
    for (const [id, src] of [['wolny', 'wolny-obraz.png'], ['zepsuty', 'brak-obrazu.png']]) {
      const img = Object.assign(document.createElement('img'), { id, src, alt: 'Opis obrazu' });
      img.style.cssText = 'position:fixed;top:10px;left:10px;width:120px;height:90px;z-index:99999';
      document.body.append(img);
    }
  });
  const wolny = await strona.evaluate(() => {
    const s = getComputedStyle(document.querySelector('#wolny'));
    return { klasa: document.querySelector('#wolny').className, animacja: s.animationName, tlo: s.backgroundImage.startsWith('linear-gradient'), kolor: s.color };
  });
  assert.equal(wolny.klasa, '');
  assert.equal(wolny.animacja, 'ladowanie-obrazu');
  assert.ok(wolny.tlo, 'migoczące tło');
  assert.equal(wolny.kolor, 'rgba(0, 0, 0, 0)', 'bez napisu alt');
  pusc();
  await strona.waitForFunction(() => document.querySelector('#wolny').classList.contains('zaladowany'));
  assert.equal(await strona.evaluate(() => getComputedStyle(document.querySelector('#wolny')).animationName), 'none');
  await strona.waitForFunction(() => document.querySelector('#zepsuty').classList.contains('zaladowany'));
  const zepsuty = await strona.evaluate(() => { const i = document.querySelector('#zepsuty'); return { blad: i.classList.contains('blad-obrazu'), svg: i.src.startsWith('data:image/svg+xml'), szer: i.naturalWidth }; });
  assert.deepEqual(zepsuty, { blad: true, svg: true, szer: zepsuty.szer });
  assert.ok(zepsuty.szer > 0, 'zastępczy rysunek wczytany');
  assert.deepEqual(bledy.filter((b) => !/404|brak-obrazu/.test(b)), []);
});
