// Komiks z AI (#374, plan C1–C3): styl rysunków projektu, obraz wzorcowy postaci z opisu karty, [Rysuj kadry] –
// opisy kadrów ze scenariusza i kart, obrazy wzorcowe w zapytaniu, obrazy w kadrach. Atrapa Gemini – bez kosztów.

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { otworz, nowyProjekt, krokKomiksu, zMenu } = require('./pomoc.cjs');

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
  await krokKomiksu(strona, 'postacie');
  const dlg = strona.locator('#dlg-postacie');
  await dlg.locator('input[name="styl"][value="akwarela"]').check({ force: true });
  await dlg.locator('.karta-komiksu:not(.dodaj)').first().click();
  await dlg.locator('[data-akcja-karty="obraz-ai"]').click();
  await dlg.locator('.obraz-karty img').waitFor();
  await dlg.locator('button[value="zapisz"]').click();
  await dlg.locator('.karty-komiksu').first().waitFor();
  await dlg.locator('button[value="zamknij"]').click();
  const wzor = zapytania[0];
  assert.match(wzor.contents[0].parts.at(-1).text, /^Obraz wzorcowy postaci: Ala, 8 lat, rude warkocze, zielona sukienka; znak rozpoznawczy: żółty plecak\. Cała sylwetka.*Style: delicate watercolour/);
  assert.equal(wzor.generationConfig.imageConfig.aspectRatio, '3:4');
  const karta = await strona.evaluate(async () => (await import('./js/postacie.js')).karty(window.seriodruk.stan.projekt, 'postacie')[0]);
  assert.match(karta.obraz, /^ai-obraz-wzorcowy-postaci-ala.*\.png$/);

  // C3: Rysuj kadry strony 1 – opisy ze scenariusza i kart, obraz Ali jako odniesienie, obrazy w kadrach.
  await zMenu(strona, 'ai-menu', 'rysuj');
  const r = strona.locator('#dlg-rysuj-kadry');
  await r.waitFor();
  assert.match(await r.locator('h2').textContent(), /strony 1/);
  assert.equal(await r.locator('.kadr-ai').count(), 3);
  const opis2 = await r.locator('textarea[name="o1"]').inputValue();
  assert.match(opis2, /^Kadr 2\. Ujęcie: plan pełny \(full shot[^)]*\)\. Scena: Ala biegnie ulicą\. W kadrze: Ala – 8 lat, rude warkocze, zielona sukienka, zawsze: żółty plecak\. Miejsce \(tło\): Miasteczko.*Obrazy wzorcowe pokazują po kolei: Ala – zachowaj ich wygląd\. Zostaw w górnej części kadru spokojne tło na dymki – nie rysuj dymków ani pustych ramek\.$/);
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
  // D11: ponownie – kadr z obrazem ma opis, z którego powstał, miniaturę i „Opis ze scenariusza”; jest odznaczony.
  await strona.evaluate(async () => { const { zapiszTeraz } = window.seriodruk; await zapiszTeraz(); });
  await zMenu(strona, 'ai-menu', 'rysuj');
  await r.waitFor();
  assert.equal(await r.locator('textarea[name="o1"]').inputValue(), opis2, 'opis zapisany przy obrazie');
  assert.equal(await r.locator('input[name="k1"]').isChecked(), false);
  assert.equal(await r.locator('.kadr-ai').nth(1).locator('img.miniatura-kadru').count(), 1);
  await r.locator('textarea[name="o1"]').fill('Ala biegnie, noc');
  await r.locator('[data-ze-scenariusza="1"]').click();
  assert.equal(await r.locator('textarea[name="o1"]').inputValue(), opis2);
  assert.equal(await r.locator('input[name="k1"]').isChecked(), true);
  // C3/E5: cała strona jednym obrazem – jedno zapytanie z opisami wszystkich kadrów, obraz na całą stronę, kadry znikają.
  await r.locator('input[name="cala"]').check({ force: true });
  assert.match(await r.locator('.koszt-ai').textContent(), /Jeden obraz na całą stronę\. Koszt: ok\. 0,1[0-9] zł/);
  await r.locator('button[value="tak"]').click();
  await strona.waitForFunction(() => !document.querySelector('#dlg-rysuj-kadry').open, null, { timeout: 15000 });
  assert.match(await strona.textContent('#powiadomienie'), /Strona narysowana jednym obrazem/);
  assert.equal(zapytania.length, 4, 'jeden obraz zamiast trzech');
  const cala = zapytania[3];
  assert.match(cala.contents[0].parts.at(-1).text, /^One complete comic book page with 3 panels in reading order \(row 1: 1 panel, row 2: 2 panels\).*Kadr 1\..*Kadr 2\..*Kadr 3\..*Style: delicate watercolour/);
  assert.equal(cala.contents[0].parts[0].inline_data.mime_type, 'image/png', 'obraz wzorcowy Ali');
  const naStronie = await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects(); return { kadry: o.filter((x) => x.kadr_nr).length, obraz: o.filter((x) => x.type === 'image' && x.zasob).length }; });
  assert.deepEqual(naStronie, { kadry: 0, obraz: 1 });
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
  assert.match(k[0].opis, /^Kadr 1\. Scena: Rynek o świcie\. Miejsce \(tło\): Rynek, fontanna, pora dnia: ranek\. Zostaw/);
  assert.match(k[2].opis, /Kadr otwierający/);
  // ujęcie i osoba w kadrze bez kwestii (#378)
  const sc2 = { id: 's2', kolumny: ['strona', 'kadr', 'ujęcie', 'w kadrze', 'emocje i działania', 'opis sceny', 'postać', 'tekst', 'rodzaj'], wiersze: [['1', '1', 'zbliżenie', 'Ola', 'Ola (zaskoczenie): upuszcza kubek', 'Ola się dziwi', '', '', '']] };
  const z = m.kadryStrony(projekt, sc2, 1, 1, 'en')[0];
  assert.deepEqual(z.postacie.map((p) => p.imie), ['Ola']);
  assert.match(z.opis, /^Panel 1\. Shot: zbliżenie \(close-up on the face[^)]*\)\. Scene: Ola się dziwi\. In the panel: Ola – okulary, emotion: zaskoczenie, doing: upuszcza kubek\.$/);
  assert.equal(m.stylProjektu({ komiks_ai: { styl: 'manga' } }), m.STYLE_RYSUNKOW.manga);
});

test('komiks AI: scenariusz z pomysłu i z dokumentu – podgląd, zapis do tabeli i kart, kadry na stronach (#375)', async (t) => {
  const { strona, bledy } = await otworz(t);
  const zapytania = [];
  const odpowiedz = { tytul: 'Kotek w paczce', postacie: [{ imie: 'Ala', wyglad: 'rude warkocze', znak: 'plecak', charakter: 'odważna' }, { imie: 'Kot Filemon', wyglad: 'rudy kotek', znak: 'biała łatka', charakter: '' }], miejsca: [{ nazwa: 'Podwórko', opis: 'trawa i płot', pora: 'ranek' }],
    sceny: [{ strona: 1, kadr: 1, postac: '', tekst: 'Był ranek.', rodzaj: 'narracja', opis_sceny: 'Podwórko', miejsce: 'Podwórko' }, { strona: 1, kadr: 2, postac: 'Ala', tekst: 'Paczka!', rodzaj: 'krzyk', opis_sceny: 'Ala widzi paczkę', miejsce: 'Podwórko' },
      { strona: 2, kadr: 1, postac: 'Ala', tekst: 'Kotek!', rodzaj: 'zly-rodzaj', opis_sceny: 'Kotek w paczce', miejsce: '' }, { strona: 2, kadr: 2, postac: 'Ala', tekst: 'Zostaje z nami.', rodzaj: 'mowa', opis_sceny: '', miejsce: '' }, { strona: 2, kadr: 3, postac: 'Kot Filemon', tekst: 'Miau!', rodzaj: 'mowa', opis_sceny: 'Kotek się uśmiecha', miejsce: '' }] };
  await strona.route('https://generativelanguage.googleapis.com/**', async (r) => {
    zapytania.push(JSON.parse(r.request().postData() || '{}'));
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(odpowiedz) }] } }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 700 } }) });
  });
  await nowyProjekt(strona, 'Scenariusz AI');
  await strona.evaluate(async () => {
    const { sejfKonta } = await import('./js/app/sejf-ai.js'); const s = sejfKonta(); await s.zaloz('haslo-do-kluczy-1'); await s.ustaw('gemini', 'klucz-testowy');
    const p = window.seriodruk.stan.projekt;
    p.sekcje[0].typ = 'komiks';
    const { zapiszKarte } = await import('./js/postacie.js');
    zapiszKarte(p, 'postacie', { imie: 'Ala', wyglad: '', znak: 'żółty plecak' });
    await window.seriodruk.przeladuj();
  });
  await krokKomiksu(strona, 'scenariusz-ai');
  const dlg = strona.locator('#dlg-scenariusz-ai');
  await dlg.waitFor();
  await dlg.locator('textarea[name="pomysl"]').fill('Ala znajduje paczkę z kotkiem.');
  await dlg.locator('input[name="stron"]').fill('2');
  assert.equal(await dlg.locator('button[value="tak"]').isDisabled(), true);
  await dlg.locator('[data-rola="rozpisz"]').click();
  await dlg.locator('.podglad-scenariusza:not([hidden])').waitFor();
  assert.match(await dlg.locator('.podglad-scenariusza').textContent(), /Kotek w paczce – 2 strony, 5 wierszy.*Ala, Kot Filemon.*Podwórko/s);
  assert.match(zapytania[0].systemInstruction.parts[0].text, /exactly 2 pages, 3 panels per page.*language with code "pl"/s);
  assert.equal(zapytania[0].generationConfig.responseMimeType, 'application/json');
  await dlg.locator('button[value="tak"]').click();
  await strona.waitForFunction(() => !document.querySelector('#dlg-scenariusz-ai').open);
  const p = await strona.evaluate(async () => {
    const x = window.seriodruk.stan.projekt;
    const { karty } = await import('./js/postacie.js');
    const tb = x.tabele.find((q) => q.kolumny.includes('opis sceny'));
    return { kolumny: tb.kolumny, wiersze: tb.wiersze, postacie: karty(x, 'postacie').map((k) => [k.imie, k.znak, k.wyglad]), miejsca: karty(x, 'miejsca').map((k) => k.nazwa), stron: x.strony.length, kadry: x.strony.map((s) => (s.obiekty || []).filter((o) => o.kadr_nr).length) };
  });
  assert.deepEqual(p.kolumny, ['strona', 'kadr', 'ujęcie', 'miejsce', 'w kadrze', 'emocje i działania', 'opis sceny', 'postać', 'tekst', 'rodzaj']);
  assert.deepEqual(p.wiersze[2], ['2', '1', '', '', '', '', 'Kotek w paczce', 'Ala', 'Kotek!', 'mowa'], 'zły rodzaj dymka → mowa');
  assert.deepEqual(p.postacie, [['Ala', 'żółty plecak', 'rude warkocze'], ['Kot Filemon', 'biała łatka', 'rudy kotek']], 'istniejąca karta: puste pola uzupełnione, wypełnione zostają');
  assert.deepEqual(p.miejsca, ['Podwórko']);
  assert.equal(p.stron, 2, 'strona 2 doszła');
  assert.deepEqual(p.kadry, [2, 3], 'kadry według scenariusza');

  // Z dokumentu: plik tekstowy, dialogi dosłownie.
  await krokKomiksu(strona, 'scenariusz-ai');
  await dlg.locator('input[name="zrodlo"][value="dokument"]').check({ force: true });
  await dlg.locator('input[name="plik"]').setInputFiles({ name: 'scenariusz.txt', mimeType: 'text/plain', buffer: Buffer.from('STRONA 1\nAla: Paczka!\nNarrator: Był ranek.') });
  await dlg.locator('[data-rola="rozpisz"]').click();
  await dlg.locator('.podglad-scenariusza:not([hidden])').waitFor();
  assert.match(zapytania[1].systemInstruction.parts[0].text, /Keep the dialogue text exactly/);
  assert.equal(zapytania[1].contents[0].parts[0].text, 'STRONA 1\nAla: Paczka!\nNarrator: Był ranek.');
  assert.deepEqual(bledy, []);
});
