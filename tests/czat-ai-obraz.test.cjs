// Czat AI z narzędziami aplikacji (#376): Claude (atrapa) woła generuj_obraz – czat pyta o zgodę z kosztem (bez
// „Zawsze pozwalaj”), obraz z Gemini (atrapa) trafia do zaznaczonej ramki; odmowa – nic nie kosztuje.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
function sse(w) {
  const z = [{ type: 'message_start', message: { id: w.id, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [] } }];
  w.content.forEach((b, i) => {
    if (b.type === 'text') { z.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: b.text } }); } else {
      z.push({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } }, { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
    }
    z.push({ type: 'content_block_stop', index: i });
  });
  z.push({ type: 'message_delta', delta: { stop_reason: w.stop_reason } }, { type: 'message_stop' });
  return z.map((x) => `event: ${x.type}\ndata: ${JSON.stringify(x)}\n\n`).join('');
}

test('czat AI: generuj_obraz z zgodą na koszt, obraz w ramce; odmowa bez kosztu', async (t) => {
  const { strona, kontekst, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Czat z obrazem');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  const idRamki = await strona.evaluate(() => window.seriodruk.edytor.aktywny.id);
  await zapisano(strona);
  const claude = [];
  const gemini = [];
  await kontekst.route('https://api.anthropic.com/v1/**', async (r) => {
    if (r.request().method() === 'OPTIONS') { await r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }); return; }
    if (r.request().url().includes('/models')) { await r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: [{ id: 'claude-opus-5-5' }] }) }); return; }
    const body = JSON.parse(r.request().postData());
    claude.push(body);
    const krok = claude.length;
    const odp = krok === 1 || krok === 3
      ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: `tu${krok}`, name: 'generuj_obraz', input: { opis: 'Kot w kapeluszu', element: idRamki } }] }
      : { stop_reason: 'end_turn', content: [{ type: 'text', text: krok === 2 ? 'Gotowe, obraz w ramce.' : 'Dobrze, nie generuję.' }] };
    await r.fulfill({ contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: sse({ id: `m${krok}`, ...odp }) });
  });
  await kontekst.route('https://generativelanguage.googleapis.com/**', async (r) => {
    gemini.push(JSON.parse(r.request().postData() || '{}'));
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG_2X2.toString('base64') } }] } }], usageMetadata: { promptTokenCount: 60, candidatesTokenCount: 1120, candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }] } }) });
  });
  await strona.evaluate(async () => {
    const { sejfKonta } = await import('./js/app/sejf-ai.js'); const s = sejfKonta(); await s.zaloz('haslo-do-kluczy-1'); await s.ustaw('gemini', 'klucz-gemini'); await s.ustaw('anthropic', 'sk-ant-test');
    localStorage.setItem('makietka-czat-ai', JSON.stringify({ dostawca: 'anthropic', rola: 'edycja', dostawcy: { anthropic: { model: 'claude-opus-5-5' } } }));
  });
  await strona.evaluate(async () => (await import('./js/app/czat-ai.js')).otworzCzatAi());
  await strona.waitForSelector('#dlg-czat-ai[open]');
  await strona.fill('#czat-ai-tekst', 'Narysuj kota w kapeluszu w zaznaczonej ramce');
  await strona.press('#czat-ai-tekst', 'Enter');
  // Zgoda z kosztem, bez „Zawsze pozwalaj”.
  const zgoda = strona.locator('#czat-ai-wiadomosci .rzad-przyciskow').last();
  await zgoda.waitFor({ timeout: 20000 });
  assert.match(await strona.locator('#czat-ai-wiadomosci').textContent(), /AI chce wygenerować obraz „Kot w kapeluszu” \(koszt ok\. 0,14 zł\)/);
  assert.equal(await zgoda.locator('button').count(), 2, 'tylko Pozwól i Nie pozwalaj');
  assert.deepEqual(claude[0].tools.filter((x) => ['generuj_obraz', 'rysuj_kadry', 'ustaw_dymki', 'szacuj_koszt'].includes(x.name)).map((x) => x.name), ['generuj_obraz', 'rysuj_kadry', 'ustaw_dymki', 'szacuj_koszt']);
  await zgoda.locator('button').first().click();
  await strona.waitForFunction(() => /Gotowe, obraz w ramce/.test(document.querySelector('#czat-ai-wiadomosci').textContent), null, { timeout: 20000 });
  assert.equal(gemini.length, 1);
  assert.equal(await strona.evaluate((id) => Boolean(window.seriodruk.edytor.canvas.getObjects().find((o) => o.id === id)?.zasob), idRamki), true, 'obraz w ramce');
  assert.match(JSON.stringify(claude[1].messages.at(-1)), /gotowy w elemencie/);
  // Druga prośba – odmowa: bez wywołania Gemini.
  await strona.fill('#czat-ai-tekst', 'Jeszcze raz');
  await strona.press('#czat-ai-tekst', 'Enter');
  const zgoda2 = strona.locator('#czat-ai-wiadomosci .rzad-przyciskow').last();
  await zgoda2.waitFor({ timeout: 20000 });
  await zgoda2.locator('button').last().click();
  await strona.waitForFunction(() => /nie generuję/.test(document.querySelector('#czat-ai-wiadomosci').textContent), null, { timeout: 20000 });
  assert.equal(gemini.length, 1, 'odmowa – nic nie wygenerowano');
  assert.deepEqual(bledy, []);
});
