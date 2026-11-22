// Model bez zgadywania nazw (uwaga G1): puste pole „Model” – asystent bierze zalecany model z listy dostawcy;
// na liście podpowiedzi zalecany, najtańszy i najlepszy opisane po ludzku.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('model: zalecany, najtańszy i najlepszy z listy dostawcy (moduł)', async () => {
  const m = await import('../js/ai-dostawcy.js');
  const gemini = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-transcribe', 'deep-research-preview-04-2026'];
  assert.deepEqual(m.zalecaneModele('gemini', gemini), { zalecany: 'gemini-3.8-flash', tani: 'gemini-3.5-flash-lite', najlepszy: 'gemini-2.5-pro' });
  assert.deepEqual(m.zalecaneModele('anthropic', ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']), { zalecany: 'claude-sonnet-5-5', tani: 'claude-haiku-5-5', najlepszy: 'claude-opus-5-5' });
  assert.deepEqual(m.zalecaneModele('openai', ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.1', 'gpt-5.1-mini', 'gpt-5.1-codex', 'gpt-4o-realtime-preview']), { zalecany: 'gpt-5.1-mini', tani: 'gpt-5-nano', najlepszy: 'gpt-5.1' });
  assert.equal(m.zalecaneModele('anthropic', []).zalecany, 'claude-opus-5-5', 'bez listy – wbudowany');
});

test('model: puste pole – rozmowa z zalecanym modelem, podpowiedzi po ludzku', async (t) => {
  const { strona, kontekst, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Model sam');
  const modele = [];
  await kontekst.route('https://api.anthropic.com/v1/**', async (r) => {
    if (r.request().method() === 'OPTIONS') { await r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }); return; }
    if (r.request().url().includes('/models')) { await r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-sonnet-5-5' }, { id: 'claude-haiku-5-5' }] }) }); return; }
    modele.push(JSON.parse(r.request().postData() || '{}').model ?? r.request().url());
    const z = [{ type: 'message_start', message: { id: 'm1', type: 'message', role: 'assistant', model: 'x', content: [] } }, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Odpowiedź modelu.' } }, { type: 'content_block_stop', index: 0 }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { type: 'message_stop' }];
    await r.fulfill({ contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: z.map((x) => `event: ${x.type}\ndata: ${JSON.stringify(x)}\n\n`).join('') });
  });
  await strona.evaluate(async () => {
    const { sejfKonta } = await import('./js/app/sejf-ai.js'); const s = sejfKonta(); await s.zaloz('haslo-do-kluczy-1'); await s.ustaw('anthropic', 'sk-ant-test');
    localStorage.setItem('makietka-czat-ai', JSON.stringify({ dostawca: 'anthropic', rola: 'edycja', dostawcy: { anthropic: { model: '' } } }));
  });
  await strona.evaluate(async () => (await import('./js/app/czat-ai.js')).otworzCzatAi());
  await strona.waitForSelector('#dlg-czat-ai[open]');
  await strona.waitForFunction(() => /Automatycznie – zalecany \(claude-sonnet-5-5\)/.test(document.querySelector('#dlg-czat-ai [name="model"]').placeholder), null, { timeout: 15000 });
  assert.deepEqual(await strona.evaluate(() => [...document.getElementById('czat-ai-modele').options].slice(0, 3).map((o) => [o.value, o.label])), [['claude-sonnet-5-5', 'Zalecany – szybki i rozsądny'], ['claude-haiku-5-5', 'Najtańszy'], ['claude-opus-5-5', 'Najlepszy – droższy']]);
  await strona.fill('#czat-ai-tekst', 'Cześć');
  await strona.press('#czat-ai-tekst', 'Enter');
  await strona.waitForFunction(() => /Odpowiedź modelu/.test(document.querySelector('#czat-ai-wiadomosci').textContent), null, { timeout: 20000 });
  assert.deepEqual(modele, ['claude-sonnet-5-5'], 'bez wpisanego modelu – zalecany');
  assert.deepEqual(bledy, []);
});
