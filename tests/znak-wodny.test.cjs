// Znak wodny w podglądzie z linku (#191): właściciel włącza go w oknie Udostępnij; napis jest wtopiony
// w obrazy stron linku (pusta biała strona dostaje szare piksele), wyłączenie wraca do czystych stron.
// Zgłoszenie 19.11: domyślnie bladszy (krycie 12 %), krycie ustawia suwak 5–50 % z podglądem na żywo.
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
    let suma = 0;
    for (let i = 0; i < d.length; i += 16) { if (d[i] < 248) n += 1; suma += 255 - d[i]; }
    return { udzial: n / (d.length / 16), ciemnosc: suma / (d.length / 16) };
  }, b64);
  const bez = (await ciemne(obrazLinku())).udzial;
  assert.ok(bez < 0.01, `pusta strona bez znaku: ${bez}`);

  await strona.check('#udostepnij-znak-wl');
  await strona.fill('#udostepnij-znak-tekst', 'WZÓR');
  await strona.click('#udostepnij-znak-zapisz');
  await strona.waitForFunction(() => /Znak wodny „WZÓR” \(krycie 12%\) jest już/.test(document.querySelector('#udostepnij-komunikat').textContent), null, { timeout: 30000 });
  const ze = await ciemne(obrazLinku());
  assert.ok(ze.udzial > 0.03, `strona ze znakiem ma napisy: ${ze.udzial}`);
  // Znak wodny należy do linku (#426: kilka linków, każdy z własnym znakiem).
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.udostepnienia?.[0]?.znak_wodny), { tekst: 'WZÓR', krycie: 12 });
  assert.match(await strona.textContent('#udostepnij-znak-stan'), /„WZÓR” \(krycie 12%\)/);
  // Suwak krycia: podgląd ciemnieje na żywo, po zapisie napis na stronach linku jest mocniejszy.
  // Biały pas między obrazkiem a tekstem podglądu (x 162–178) – ciemnieje tylko od napisu.
  const podglad = () => strona.evaluate(() => { const c = document.querySelector('#udostepnij-znak-podglad'); const d = c.getContext('2d').getImageData(162, 0, 16, c.height).data; let s2 = 0; for (let i = 0; i < d.length; i += 4) s2 += 255 - d[i]; return s2; });
  const p12 = await podglad();
  await strona.evaluate(() => { const r = document.querySelector('#udostepnij-znak-krycie'); r.value = '40'; r.dispatchEvent(new Event('input')); });
  const p40 = await podglad();
  assert.ok(p40 > p12, `podgląd ciemnieje przy większym kryciu: ${p12} → ${p40}`);
  assert.equal(await strona.textContent('#udostepnij-znak-krycie-pole output'), '40%');
  await strona.click('#udostepnij-znak-zapisz');
  await strona.waitForFunction(() => /krycie 40%/.test(document.querySelector('#udostepnij-komunikat').textContent), null, { timeout: 30000 });
  const ze40 = await ciemne(obrazLinku());
  assert.ok(ze40.ciemnosc > ze.ciemnosc * 2, `krycie 40 % ciemniejsze niż 12 %: ${ze40.ciemnosc} / ${ze.ciemnosc}`);

  await strona.uncheck('#udostepnij-znak-wl');
  await strona.click('#udostepnij-znak-zapisz');
  await strona.waitForFunction(() => /bez znaku wodnego/.test(document.querySelector('#udostepnij-komunikat').textContent), null, { timeout: 30000 });
  assert.ok((await ciemne(obrazLinku())).udzial < 0.01, 'po wyłączeniu strona znów czysta');
  assert.deepEqual(bledy, []);
});
