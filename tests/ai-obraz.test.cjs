// Obraz AI (#372): okno z kosztem przed generowaniem, klucz Gemini z sejfu, proporcje z ramki, obraz do ramki
// (kształt / kadr) albo na stronę, zapis w obrazach projektu z opisem i modelem, licznik wydatków (miesiąc, projekt),
// limit miesięczny, czytelny błąd bez klucza. Odpowiedź Gemini podstawiona – test nic nie kosztuje.

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { otworz, nowyProjekt, krokKomiksu, zMenu } = require('./pomoc.cjs');

// PNG 2 × 2 w jednym kolorze (każde wywołanie atrapy – inny obraz).
function png(r, g, b) {
  const crc = (buf) => { let c = ~0; for (const x of buf) { c ^= x; for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const blok = (typ, dane) => { const d = Buffer.concat([Buffer.from(typ), dane]); const len = Buffer.alloc(4); len.writeUInt32BE(dane.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(d)); return Buffer.concat([len, d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const wiersz = Buffer.from([0, r, g, b, r, g, b]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), blok('IHDR', ihdr), blok('IDAT', zlib.deflateSync(Buffer.concat([wiersz, wiersz]))), blok('IEND', Buffer.alloc(0))]);
}

test('obraz AI: koszt, klucz z sejfu, ramka, obrazy projektu, licznik i limit', async (t) => {
  const { strona, bledy } = await otworz(t);
  const zapytania = [];
  await strona.route('https://generativelanguage.googleapis.com/**', async (r) => {
    zapytania.push({ url: r.request().url(), klucz: r.request().headers()['x-goog-api-key'], tresc: JSON.parse(r.request().postData() || '{}') });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png(40 * zapytania.length, 120, 200).toString('base64') } }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 60, candidatesTokenCount: 1120, candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }] },
    }) });
  });
  await nowyProjekt(strona, 'Z obrazem AI');
  await strona.evaluate(() => localStorage.removeItem('makietka-ai-wydatki'));
  // Bez klucza: czytelny komunikat w oknie (sejf otwarty, ale pusty).
  await strona.evaluate(async () => { const { sejfKonta } = await import('./js/app/sejf-ai.js'); await sejfKonta().zaloz('haslo-do-kluczy-1'); });
  await zMenu(strona, 'ai-menu', 'obraz');
  const dlg = strona.locator('#dlg-ai-obraz');
  await dlg.waitFor();
  assert.match(await dlg.locator('.koszt-ai').textContent(), /Koszt: ok\. 0,14 zł\. W tym miesiącu: 0,00 zł\./);
  await dlg.locator('textarea[name="opis"]').fill('Kot w kapeluszu');
  await dlg.locator('button[value="tak"]').click();
  await dlg.locator('.blad-ai:not([hidden])').waitFor();
  assert.match(await dlg.locator('.blad-ai').textContent(), /Najpierw dodaj klucz Google Gemini/);
  assert.equal(zapytania.length, 0);
  await dlg.locator('[data-rola="anuluj"]').click();
  await strona.evaluate(async () => { const { sejfKonta } = await import('./js/app/sejf-ai.js'); await sejfKonta().ustaw('gemini', 'klucz-testowy'); });

  // Ramka: prostokąt 60 × 80 mm → proporcje 3:4, obraz w środku prostokąta.
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; o.set({ width: 60, height: 80, scaleX: 1, scaleY: 1 }); o.setCoords(); });
  await zMenu(strona, 'ai-menu', 'obraz');
  await dlg.waitFor();
  assert.equal(await dlg.locator('select[name="proporcja"]').inputValue(), '3:4');
  assert.match(await dlg.locator('p.ciche').textContent(), /wypełni zaznaczoną ramkę/);
  await dlg.locator('textarea[name="opis"]').fill('Kot w kapeluszu na dachu');
  await dlg.locator('select[name="jakosc"]').selectOption('dokladny');
  assert.match(await dlg.locator('.koszt-ai').textContent(), /Koszt: ok\. 0,41 zł/);
  await dlg.locator('select[name="jakosc"]').selectOption('szkic');
  await dlg.locator('button[value="tak"]').click();
  await strona.waitForFunction(() => !document.querySelector('#dlg-ai-obraz').open);
  assert.match(await strona.textContent('#powiadomienie'), /Obraz gotowy \(koszt ok\. 0,14 zł\)/);
  assert.equal(zapytania.length, 1);
  const z = zapytania[0];
  assert.match(z.url, /models\/gemini-3\.1-flash-lite-image:generateContent$/);
  assert.equal(z.klucz, 'klucz-testowy');
  assert.deepEqual(z.tresc.generationConfig, { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4', imageSize: '1K' } });
  assert.match(z.tresc.contents[0].parts.at(-1).text, /^Kot w kapeluszu na dachu .*Do not draw any text/);
  const wynik = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    const o = window.seriodruk.edytor.aktywny;
    const [id, zas] = Object.entries(p.zasoby).find(([, x]) => x.ai);
    return { wRamce: o.type === 'rect' && o.zasob === id, nazwa: zas.nazwa, ai: { opis: zas.ai.opis, model: zas.ai.model, proporcja: zas.ai.proporcja }, projekt: p.ai_wydatki.zl, miesiac: JSON.parse(localStorage.getItem('makietka-ai-wydatki')).zl };
  });
  assert.equal(wynik.wRamce, true, 'obraz w zaznaczonym prostokącie');
  assert.equal(wynik.nazwa, 'ai-kot-w-kapeluszu-na-dachu.png');
  assert.deepEqual(wynik.ai, { opis: 'Kot w kapeluszu na dachu', model: 'gemini-3.1-flash-lite-image', proporcja: '3:4' });
  assert.ok(wynik.projekt > 0.13 && wynik.projekt < 0.15, 'koszt z rzeczywistego zużycia w projekcie');
  assert.ok(Math.abs(wynik.miesiac - wynik.projekt) < 1e-6);

  // Ta sama ramka jeszcze raz: okno z poprzednim opisem; poprzedni obraz zostaje w obrazach projektu.
  await zMenu(strona, 'ai-menu', 'obraz');
  assert.equal(await dlg.locator('textarea[name="opis"]').inputValue(), 'Kot w kapeluszu na dachu');
  assert.match(await dlg.locator('p.ciche').textContent(), /poprzednia wersja zostaje w obrazach projektu/);
  await dlg.locator('textarea[name="opis"]').fill('Kot w kapeluszu na dachu, noc');
  await dlg.locator('button[value="tak"]').click();
  await strona.waitForFunction(() => !document.querySelector('#dlg-ai-obraz').open);
  assert.equal(await strona.evaluate(() => Object.values(window.seriodruk.stan.projekt.zasoby).filter((x) => x.ai).length), 2, 'dwie wersje w obrazach projektu');
  // Limit miesięczny: 0,10 zł – kolejne generowanie odmówione bez zapytania.
  await strona.evaluate(async () => (await import('./js/ai-koszty.js')).ustawLimit(0.1));
  await strona.evaluate(() => window.seriodruk.edytor.canvas.discardActiveObject());
  await zMenu(strona, 'ai-menu', 'obraz');
  await dlg.locator('textarea[name="opis"]').fill('Pies');
  assert.match(await dlg.locator('.koszt-ai').textContent(), /Limit: 0,10 zł/);
  await dlg.locator('button[value="tak"]').click();
  await dlg.locator('.blad-ai:not([hidden])').waitFor();
  assert.match(await dlg.locator('.blad-ai').textContent(), /przekroczyłoby miesięczny limit/);
  assert.equal(zapytania.length, 2);
  assert.deepEqual(bledy, []);
});

test('obraz AI: proporcje ramki i treść zapytania (moduł)', async () => {
  const { pathToFileURL } = require('node:url');
  const path = require('node:path');
  const m = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'ai-obrazy.js')).href);
  assert.equal(m.proporcjaRamki(60, 80), '3:4');
  assert.equal(m.proporcjaRamki(210, 100), '21:9');
  assert.equal(m.proporcjaRamki(100, 100), '1:1');
  assert.equal(m.proporcjaRamki(148, 210), '2:3');
  assert.throws(() => m.obrazZOdpowiedzi({ promptFeedback: { blockReason: 'SAFETY' } }), /SAFETY/);
});

test('obraz AI: limit wydatków w ustawieniach AI i suma z miesiąca (#372)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => localStorage.setItem('makietka-ai-wydatki', JSON.stringify({ miesiac: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, zl: 0.27, limit: 0 })));
  await strona.evaluate(() => { location.hash = '#/konto/ai'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'konto');
  await strona.waitForFunction(() => /0,27 zł/.test(document.querySelector('#ust-ai-wydatki').textContent));
  assert.equal(await strona.inputValue('#ust-ai-limit'), '0');
  await strona.fill('#ust-ai-limit', '20');
  await strona.press('#ust-ai-limit', 'Tab');
  assert.equal(await strona.evaluate(() => JSON.parse(localStorage.getItem('makietka-ai-wydatki')).limit), 20);
  assert.deepEqual(bledy, []);
});
