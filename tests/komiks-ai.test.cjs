// Komiks z AI (#374, plan C1–C3): styl rysunków projektu, obraz wzorcowy postaci z opisu karty, [Rysuj kadry] –
// opisy kadrów ze scenariusza i kart, obrazy wzorcowe w zapytaniu, obrazy w kadrach. Atrapa Gemini – bez kosztów.

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { otworz } = require('./pomoc.cjs');

function png(r, g, b) {
  const crc = (buf) => { let c = ~0; for (const x of buf) { c ^= x; for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const blok = (typ, dane) => { const d = Buffer.concat([Buffer.from(typ), dane]); const len = Buffer.alloc(4); len.writeUInt32BE(dane.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(d)); return Buffer.concat([len, d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const wiersz = Buffer.from([0, r, g, b, r, g, b]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), blok('IHDR', ihdr), blok('IDAT', zlib.deflateSync(Buffer.concat([wiersz, wiersz]))), blok('IEND', Buffer.alloc(0))]);
}

test('komiks AI: styl, obraz wzorcowy z opisu, rysowanie kadrów strony z odniesieniami', async (t) => {
  const { strona, bledy } = await otworz(t);
  const zapytania = [];
  await strona.route('https://generativelanguage.googleapis.com/**', async (r) => {
    zapytania.push(JSON.parse(r.request().postData() || '{}'));
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png(10 * zapytania.length, 90, 160).toString('base64') } }] } }], usageMetadata: { promptTokenCount: 600, candidatesTokenCount: 1120, candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }] } }) });
  });
  // Projekt z szablonu „Komiks” (karty Ali, Oli i miasteczka, scenariusz), klucz w sejfie.
  await strona.locator('[data-akcja="nowy-projekt"]:visible').first().click();
  await strona.waitForSelector('#dlg-nowy[open]');
  await strona.fill('#form-nowy [name="nazwa"]', 'Komiks z AI');
  await strona.check('#form-nowy input[name="start"][value="szablon"]', { force: true });
  await strona.click('#nowy-szablony .karta-szablonu[data-id="komiks"]');
  await strona.waitForSelector('#nowy-szablony #gotowe-szczegoly:not([hidden])');
  await strona.click('#gotowe-wstaw');
  await strona.waitForFunction(() => !document.querySelector('#dlg-nowy').open && window.seriodruk.stan.projekt?.nazwa === 'Komiks z AI', null, { timeout: 15000 });
  await strona.evaluate(async () => {
    const { sejfKonta } = await import('./js/app/sejf-ai.js'); const s = sejfKonta(); await s.zaloz('haslo-do-kluczy-1'); await s.ustaw('gemini', 'klucz-testowy');
    const x = window.seriodruk.stan.projekt;
    await window.seriodruk.przejdzDoStrony(x.strony.findIndex((q) => q.sekcja === x.sekcje.find((s2) => s2.typ === 'komiks').id));
  });
  await strona.waitForFunction(() => document.body.classList.contains('w-komiksie'));

  // C1: styl – akwarela; C2: obraz wzorcowy Ali z opisu.
  await strona.click('[data-akcja="komiks-postacie"]');
  const dlg = strona.locator('#dlg-postacie');
  await dlg.locator('select[name="styl"]').selectOption('akwarela');
  await dlg.locator('.karta-komiksu:not(.dodaj)').first().click();
  await dlg.locator('[data-akcja-karty="obraz-ai"]').click();
  await dlg.locator('.obraz-karty img').waitFor();
  await dlg.locator('button[value="zapisz"]').click();
  await dlg.locator('.karty-komiksu').first().waitFor();
  await dlg.locator('button[value="zamknij"]').click();
  const wzor = zapytania[0];
  assert.match(wzor.contents[0].parts.at(-1).text, /^Character reference image: Ala, 8 lat, rude warkocze, zielona sukienka; distinctive feature: żółty plecak.*Style: delicate watercolour/);
  assert.equal(wzor.generationConfig.imageConfig.aspectRatio, '3:4');
  const karta = await strona.evaluate(async () => (await import('./js/postacie.js')).karty(window.seriodruk.stan.projekt, 'postacie')[0]);
  assert.match(karta.obraz, /^ai-character-reference-image-ala.*\.png$/);

  // C3: Rysuj kadry strony 1 – opisy ze scenariusza i kart, obraz Ali jako odniesienie, obrazy w kadrach.
  await strona.click('[data-akcja="komiks-rysuj"]');
  const r = strona.locator('#dlg-rysuj-kadry');
  await r.waitFor();
  assert.match(await r.locator('h2').textContent(), /strony 1/);
  assert.equal(await r.locator('.kadr-ai').count(), 3);
  const opis2 = await r.locator('textarea[name="o1"]').inputValue();
  assert.match(opis2, /Scene: Ala biegnie ulicą\. Ala: 8 lat, rude warkocze, zielona sukienka, always with żółty plecak\..*reference images.*speech bubbles/);
  assert.match(await r.locator('.koszt-ai').textContent(), /Do narysowania: 3\. Koszt: ok\. 0,4[0-9] zł/);
  await r.locator('input[name="k0"]').uncheck({ force: true });
  assert.match(await r.locator('.koszt-ai').textContent(), /Do narysowania: 2\./);
  await r.locator('button[value="tak"]').click();
  await strona.waitForFunction(() => !document.querySelector('#dlg-rysuj-kadry').open, null, { timeout: 15000 });
  assert.match(await strona.textContent('#powiadomienie'), /Narysowano 2 kadry/);
  assert.equal(zapytania.length, 3);
  const kadr2 = zapytania[1];
  assert.equal(kadr2.contents[0].parts.length, 2, 'obraz wzorcowy Ali + opis');
  assert.equal(kadr2.contents[0].parts[0].inline_data.mime_type, 'image/png');
  assert.match(kadr2.contents[0].parts[1].text, /Style: delicate watercolour.*Do not draw any text/);
  const kadry = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.kadr_nr).sort((a, b) => a.kadr_nr - b.kadr_nr).map((o) => Boolean(o.zasob)));
  assert.deepEqual(kadry, [false, true, true]);
  assert.deepEqual(bledy, []);
});

test('komiks AI: opisy kadrów ze scenariusza (moduł)', async () => {
  const { pathToFileURL } = require('node:url'); const path = require('node:path');
  const m = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'komiks-ai.js')).href);
  const projekt = { tabele: [
    { id: 'p', nazwa: 'Postacie', kolumny: ['imię', 'wygląd', 'znak rozpoznawczy', 'charakter', 'obraz', 'kolor dymka'], wiersze: [['Ala', 'rude warkocze', 'plecak', '', 'ala.png', ''], ['Ola', 'okulary', '', '', '', '']] },
    { id: 'm', nazwa: 'Miejsca', kolumny: ['miejsce', 'opis', 'pora dnia', 'światło', 'obraz'], wiersze: [['Rynek', 'fontanna', 'ranek', '', '']] },
  ] };
  const scen = { id: 's', kolumny: ['strona', 'kadr', 'postać', 'tekst', 'rodzaj', 'opis sceny', 'miejsce'], wiersze: [['1', '1', '', 'Rano…', 'narracja', 'Rynek o świcie', ''], ['1', '2', 'Ola', 'Hej!', 'mowa', 'Ola i Ala przy fontannie', 'Rynek'], ['2', '1', 'Ala', 'X', 'mowa', '', '']] };
  const k = m.kadryStrony(projekt, scen, 1, 3);
  assert.deepEqual(k.map((x) => [x.kadr, x.postacie.map((p) => p.imie), x.miejsce?.nazwa ?? null]), [[1, [], 'Rynek'], [2, ['Ala', 'Ola'], 'Rynek'], [3, [], null]]);
  assert.match(k[0].opis, /Scene: Rynek o świcie\. Place: Rynek, fontanna, time of day: ranek\./);
  assert.doesNotMatch(k[0].opis, /speech bubbles/, 'narracja bez postaci – bez miejsca na dymki? narracja ma dymek prostokątny, ale bez mówiącego');
  assert.match(k[2].opis, /establishing shot/);
  assert.equal(m.stylProjektu({ komiks_ai: { styl: 'manga' } }), m.STYLE_RYSUNKOW.manga);
});
