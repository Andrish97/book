// Znak wodny w podglądzie z linku (#191): właściciel włącza go w oknie Udostępnij; napis jest wtopiony
// w obrazy stron linku (pusta biała strona dostaje szare piksele), wyłączenie wraca do czystych stron.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('znak wodny: włączony w oknie Udostępnij jest w obrazach linku, wyłączony znika', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await nowyProjekt(strona, 'Ze znakiem');
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');
  assert.ok(await strona.isVisible('#udostepnij-znak'));
  await strona.click('#udostepnij-utworz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 30000 });
  const obrazLinku = () => {
    const k = [...baza.pliki.keys()].find((x) => x.startsWith('podglady/') && /\.(webp|jpg)$/.test(x));
    return baza.pliki.get(k).tresc.toString('base64');
  };
  // Udział „nie-białych” pikseli w obrazie strony.
  const ciemne = (b64) => strona.evaluate(async (dane) => {
    const bajty = Uint8Array.from(atob(dane), (c) => c.charCodeAt(0));
    const obraz = await createImageBitmap(new Blob([bajty]));
    const c = new OffscreenCanvas(obraz.width, obraz.height);
    const g = c.getContext('2d');
    g.drawImage(obraz, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i] < 225) n += 1;
    return n / (d.length / 16);
  }, b64);
  const bez = await ciemne(obrazLinku());
  assert.ok(bez < 0.01, `pusta strona bez znaku: ${bez}`);

  await strona.check('#udostepnij-znak-wl');
  await strona.fill('#udostepnij-znak-tekst', 'WZÓR');
  await strona.click('#udostepnij-znak-zapisz');
  await strona.waitForFunction(() => /Znak wodny „WZÓR” jest już/.test(document.querySelector('#udostepnij-komunikat').textContent), null, { timeout: 30000 });
  const ze = await ciemne(obrazLinku());
  assert.ok(ze > 0.03, `strona ze znakiem ma napisy: ${ze}`);
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.znak_wodny), { tekst: 'WZÓR' });
  assert.match(await strona.textContent('#udostepnij-znak-stan'), /„WZÓR”/);

  await strona.uncheck('#udostepnij-znak-wl');
  await strona.click('#udostepnij-znak-zapisz');
  await strona.waitForFunction(() => /bez znaku wodnego/.test(document.querySelector('#udostepnij-komunikat').textContent), null, { timeout: 30000 });
  assert.ok(await ciemne(obrazLinku()) < 0.01, 'po wyłączeniu strona znów czysta');
  assert.deepEqual(bledy, []);
});
