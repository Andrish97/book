// Tekst AI (#373): zaznaczona ramka tekstu → skróć / przetłumacz…, podgląd wyniku, [Zastąp] (jeden krok cofania),
// pola {…} zostają; wypełnianie kolumny tabeli. Odpowiedź Gemini podstawiona – test nic nie kosztuje.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, krokKomiksu, zMenu } = require('./pomoc.cjs');

test('tekst AI: przetłumacz zaznaczoną ramkę, podgląd, zastąp i cofnij', async (t) => {
  const { strona, bledy } = await otworz(t);
  const zapytania = [];
  await strona.route('https://generativelanguage.googleapis.com/**', async (r) => {
    const tresc = JSON.parse(r.request().postData() || '{}');
    zapytania.push({ url: r.request().url(), tresc });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Запрошуємо на свято, {imie}!' }] } }], usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 20 } }) });
  });
  await nowyProjekt(strona, 'Tekst AI');
  await strona.evaluate(async () => { const { sejfKonta } = await import('./js/app/sejf-ai.js'); const s = sejfKonta(); await s.zaloz('haslo-do-kluczy-1'); await s.ustaw('gemini', 'klucz-testowy'); });
  await zMenu(strona, 'ai-menu', 'tekst');
  assert.match(await strona.textContent('#powiadomienie'), /Najpierw zaznacz ramkę tekstu/);
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.evaluate(() => { const o = window.seriodruk.edytor.aktywny; o.set({ text: 'Zapraszamy na święto, {imie}!' }); window.seriodruk.edytor.zatwierdz?.(); });
  await strona.waitForTimeout(1200); // osobny krok cofania
  await zMenu(strona, 'ai-menu', 'tekst');
  const dlg = strona.locator('#dlg-ai-tekst');
  await dlg.waitFor();
  assert.equal(await dlg.locator('[data-czynnosc]').count(), 8);
  assert.equal(await dlg.locator('button[value="tak"]').isDisabled(), true, 'bez wyniku nie ma czego wstawić');
  await dlg.locator('[data-czynnosc="uk"]').click();
  await strona.waitForFunction(() => document.querySelector('#dlg-ai-tekst textarea').value.length > 0);
  assert.equal(await dlg.locator('textarea').inputValue(), 'Запрошуємо на свято, {imie}!');
  assert.match(await dlg.locator('.koszt-ai').textContent(), /Koszt tej zmiany: ok\. 0,01 zł/);
  const z = zapytania[0];
  assert.match(z.url, /models\/gemini-3\.1-flash-lite:generateContent$/);
  assert.match(z.tresc.systemInstruction.parts[0].text, /Translate the text into Ukrainian\..*curly braces/);
  assert.equal(z.tresc.contents[0].parts[0].text, 'Zapraszamy na święto, {imie}!');
  await dlg.locator('button[value="tak"]').click();
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.text), 'Запрошуємо на свято, {imie}!');
  assert.ok(await strona.evaluate(() => window.seriodruk.stan.projekt.ai_wydatki.zl > 0));
  await strona.waitForTimeout(600);
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.text === 'Zapraszamy na święto, {imie}!'), null, { timeout: 5000 }).catch(async () => { throw new Error(`po cofnięciu: ${await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().map((o) => o.text).join(' | '))}`); });
  assert.deepEqual(bledy, []);
});

test('tekst AI: wypełnij kolumnę tabeli – tylko puste komórki, wartości w wierszach, koszt (#373)', async (t) => {
  const { strona, bledy } = await otworz(t);
  const zapytania = [];
  await strona.route('https://generativelanguage.googleapis.com/**', async (r) => {
    zapytania.push(JSON.parse(r.request().postData() || '{}'));
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '["Dobry początek tygodnia.","Środek tygodnia, uśmiechnij się."]' }] } }], usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 30 } }) });
  });
  await nowyProjekt(strona, 'Kolumna AI');
  await strona.evaluate(async () => {
    const { sejfKonta } = await import('./js/app/sejf-ai.js'); const s = sejfKonta(); await s.zaloz('haslo-do-kluczy-1'); await s.ustaw('gemini', 'klucz-testowy');
    const p = window.seriodruk.stan.projekt;
    p.tabele = [{ id: 't_dni', nazwa: 'Dni', kolumny: ['dzien', 'mysl'], wiersze: [['poniedziałek', ''], ['wtorek', 'Już jest.'], ['środa', '']] }];
  });
  await strona.click('[data-akcja="dane"]');
  await strona.locator('.ai-kolumny[data-k="1"]').click();
  const dlg = strona.locator('#dlg-ai-kolumna');
  await dlg.waitFor();
  assert.match(await dlg.locator('h2').textContent(), /Wypełnij kolumnę „mysl” z AI/);
  assert.match(await dlg.locator('.koszt-ai').textContent(), /Wierszy: 2\./);
  await dlg.locator('textarea').fill('Krótka myśl na ten dzień');
  await dlg.locator('button[value="tak"]').click();
  await strona.waitForFunction(() => !document.querySelector('#dlg-ai-kolumna').open);
  const wiersze = await strona.evaluate(() => window.seriodruk.stan.projekt.tabele.find((x) => x.id === 't_dni').wiersze);
  assert.deepEqual(wiersze, [['poniedziałek', 'Dobry początek tygodnia.'], ['wtorek', 'Już jest.'], ['środa', 'Środek tygodnia, uśmiechnij się.']]);
  assert.match(zapytania[0].contents[0].parts[0].text, /"dzien":"poniedziałek".*"dzien":"środa"/);
  assert.doesNotMatch(zapytania[0].contents[0].parts[0].text, /wtorek/, 'wiersz z wartością pominięty');
  assert.match(await strona.textContent('#powiadomienie'), /Wypełniono 2 wiersze/);
  assert.match(await strona.locator('#dane-edytor table').first().evaluate((x) => [...x.querySelectorAll('td')].map((td) => td.textContent).join(' | ')), /Dobry początek tygodnia/);
  assert.deepEqual(bledy, []);
});
