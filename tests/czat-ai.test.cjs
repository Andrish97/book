// Czat AI w Makietce (#217): własny klucz dostawcy (tu Anthropic – podstawiony serwer), te same narzędzia co
// łącznik MCP uruchomione w przeglądarce na otwartym projekcie (atrapa bazy), jednodniowy klucz dostępu tylko do
// tego projektu, pętla narzędzi aż do odpowiedzi, zmiana widoczna w projekcie.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

test('czat AI: klucz Anthropic, narzędzia na otwartym projekcie, zmiana nazwy przez AI', async (t) => {
  const { strona, kontekst, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz firmowy');
  await zapisano(strona);
  const zapytania = [];
  await kontekst.route('https://api.anthropic.com/v1/**', async (r) => {
    const url = r.request().url();
    if (r.request().method() === 'OPTIONS') { await r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }); return; }
    if (url.includes('/models')) { await r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-sonnet-5-5' }] }) }); return; }
    const body = JSON.parse(r.request().postData());
    zapytania.push({ naglowki: r.request().headers(), body });
    const krok = zapytania.length;
    const odp = krok === 1
      ? { stop_reason: 'tool_use', content: [{ type: 'text', text: 'Sprawdzam projekt.' }, { type: 'tool_use', id: 'tu1', name: 'przeglad_projektu', input: {} }] }
      : krok === 2
        ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu2', name: 'nazwa_projektu', input: { nazwa: 'Kalendarz 2027' } }] }
        : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Zmieniłem nazwę projektu na „Kalendarz 2027”.' }] };
    await r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: `m${krok}`, type: 'message', role: 'assistant', model: body.model, ...odp }) });
  });
  await strona.evaluate(async () => (await import('./js/app/czat-ai.js')).otworzCzatAi());
  await strona.waitForSelector('#dlg-czat-ai[open]');
  assert.ok(await strona.isVisible('#czat-ai-ustawienia'), 'bez klucza – ustawienia otwarte');
  await strona.fill('#czat-ai-ustawienia [name="klucz"]', 'sk-ant-test');
  await strona.dispatchEvent('#czat-ai-ustawienia [name="klucz"]', 'change');
  await strona.waitForFunction(() => document.querySelector('#czat-ai-ustawienia [name="model"]').value === 'claude-opus-5-5');
  await strona.fill('#czat-ai-tekst', 'Zmień nazwę projektu na Kalendarz 2027');
  await strona.press('#czat-ai-tekst', 'Enter');
  await strona.waitForFunction(() => /Zmieniłem nazwę/.test(document.querySelector('#czat-ai-wiadomosci').textContent), null, { timeout: 20000 });
  // Zapytania: nagłówki dostępu z przeglądarki, narzędzia bez narzędzi innych projektów, wyniki narzędzi z powrotem.
  assert.equal(zapytania.length, 3);
  assert.equal(zapytania[0].naglowki['x-api-key'], 'sk-ant-test');
  assert.equal(zapytania[0].naglowki['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(zapytania[0].body.model, 'claude-opus-5-5');
  const nazwy = zapytania[0].body.tools.map((x) => x.name);
  assert.ok(nazwy.includes('przeglad_projektu') && nazwy.includes('zmien_elementy'));
  assert.ok(!nazwy.includes('nowy_projekt') && !nazwy.includes('usun_projekt'), 'bez narzędzi do innych projektów');
  assert.ok(!('projekt' in (zapytania[0].body.tools.find((x) => x.name === 'przeglad_projektu').input_schema.properties || {})), 'projekt ustalony – bez parametru');
  assert.match(zapytania[0].body.system, /„Kalendarz firmowy”/);
  const wynik1 = zapytania[1].body.messages.at(-1).content[0];
  assert.equal(wynik1.type, 'tool_result');
  assert.equal(wynik1.tool_use_id, 'tu1');
  assert.ok(!wynik1.is_error, wynik1.content);
  assert.deepEqual(zapytania[1].body.messages.at(-2).content.map((b) => b.type), ['text', 'tool_use'], 'cała odpowiedź wraca do historii');
  // Zmiana w bazie przez jednodniowy klucz tylko do tego projektu.
  assert.equal(baza.projekty[0].nazwa, 'Kalendarz 2027');
  const klucz = (baza.dostepy || baza.ai?.dostepy || []).at(-1);
  if (klucz) assert.deepEqual([klucz.opis, klucz.rola, klucz.projekty.length], ['Czat w Makietce', 'edycja', 1], 'jednodniowy klucz tylko do tego projektu');
  assert.match(await strona.textContent('#czat-ai-wiadomosci'), /🔧 przeglad_projektu[\s\S]*🔧 nazwa_projektu/);
  assert.deepEqual(bledy, []);
});
