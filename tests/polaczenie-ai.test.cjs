// Plan AI krok 4–5 (#256): „Sprawdź połączenie” i model domyślny w okienku klucza dostawcy; czytelne błędy dostawców
// i ponawianie przy przeciążeniu.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz } = require('./pomoc.cjs');

const modul = () => import(pathToFileURL(path.join(__dirname, '..', 'js', 'ai-dostawcy.js')).href);

test('błędy dostawców: czytelne komunikaty', async () => {
  const { komunikatBleduDostawcy: k } = await modul();
  assert.match(k(401, 'invalid x-api-key'), /^Dostawca odrzucił klucz – sprawdź/);
  assert.match(k(400, 'Your credit balance is too low'), /^Brak środków/);
  assert.match(k(402, ''), /^Brak środków/);
  assert.match(k(429, 'rate limit'), /^Za dużo zapytań naraz/);
  assert.match(k(404, 'model: claude-x not found'), /^Model niedostępny/);
  assert.match(k(400, 'tools are not supported for this model'), /nie obsługuje narzędzi/);
  assert.match(k(529, 'Overloaded'), /przeciążony/);
  assert.match(k(0), /Brak połączenia z dostawcą/);
});

test('przeciążenie: dwie kolejne próby, potem czytelny błąd; brak środków – bez ponawiania', async () => {
  const m = await modul();
  m.czekanie.ms = async () => {};
  const stary = globalThis.fetch;
  try {
    let n = 0;
    globalThis.fetch = async () => { n += 1; return n < 3 ? new Response('{"error":{"message":"Overloaded"}}', { status: 529 }) : new Response('{"data":[{"id":"gpt-x"}]}', { status: 200 }); };
    assert.deepEqual(await m.modeleDostawcy('openai', { klucz: 'k' }), ['gpt-x']);
    assert.equal(n, 3, 'dwie powtórki po przeciążeniu');
    n = 0;
    globalThis.fetch = async () => { n += 1; return new Response('{"error":{"message":"Overloaded"}}', { status: 503 }); };
    await assert.rejects(m.modeleDostawcy('openai', { klucz: 'k' }), /przeciążony/);
    assert.equal(n, 3);
    n = 0;
    globalThis.fetch = async () => { n += 1; return new Response('{"error":{"message":"You exceeded your current quota"}}', { status: 429 }); };
    await assert.rejects(m.modeleDostawcy('openai', { klucz: 'k' }), /Brak środków/);
    assert.equal(n, 1, 'brak środków – od razu');
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(m.modeleDostawcy('openai', { klucz: 'k' }), /Brak połączenia/);
  } finally { globalThis.fetch = stary; }
});

test('okienko klucza dostawcy: Sprawdź połączenie i model domyślny', async (t) => {
  const { strona, kontekst, bledy } = await otworz(t);
  let ok = true;
  await kontekst.route('https://api.anthropic.com/v1/**', async (r) => {
    if (r.request().method() === 'OPTIONS') { await r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }); return; }
    await r.fulfill(ok
      ? { contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-haiku-5-5' }] }) }
      : { status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: { message: 'invalid x-api-key' } }) });
  });
  await strona.evaluate(() => { location.hash = '#/konto/ai'; });
  await strona.waitForSelector('#dostep-ai[data-gotowy] [data-dodaj-klucz-ai="czat"]');
  await strona.click('[data-dodaj-klucz-ai="czat"]');
  await strona.waitForSelector('#dlg-klucz-ai[open] #ai-nowy-polaczenie');
  await strona.selectOption('#ai-nowy-dostawca', 'anthropic');
  await strona.fill('#ai-nowy-klucz', 'sk-ant-sprawdz');
  await strona.click('#ai-nowy-polaczenie button:has-text("Sprawdź połączenie")');
  await strona.waitForFunction(() => /Działa – dostawca przyjął klucz \(modeli: 2\)/.test(document.querySelector('#ai-nowy-polaczenie .wynik-polaczenia').textContent));
  await strona.fill('#klucz-ai-model', 'claude-haiku-5-5');
  ok = false;
  await strona.click('#ai-nowy-polaczenie button:has-text("Sprawdź połączenie")');
  await strona.waitForFunction(() => /Dostawca odrzucił klucz/.test(document.querySelector('#ai-nowy-polaczenie .wynik-polaczenia').textContent));
  ok = true;
  await strona.click('[data-akcja="ai-zapisz-klucz-dostawcy"]');
  await strona.waitForSelector('#dlg-sejf-ai[open]');
  await strona.fill('#dlg-sejf-ai [name="haslo"]', 'haslo-do-kluczy');
  await strona.fill('#dlg-sejf-ai [name="powtorz"]', 'haslo-do-kluczy');
  await strona.click('#dlg-sejf-ai button[value="tak"]');
  await strona.waitForFunction(() => !document.querySelector('#dlg-klucz-ai').open);
  // Model domyślny trafia do ustawień czatu (Asystent AI zacznie od niego).
  assert.equal(await strona.evaluate(() => JSON.parse(localStorage.getItem('makietka-czat-ai')).dostawcy.anthropic.model), 'claude-haiku-5-5');
  assert.deepEqual(bledy.filter((b) => !/401/.test(b)), []);
});

// Streaming (#259): OpenAI-zgodne i Gemini – tekst po kawałkach do naTekst, wywołania narzędzi złożone z kawałków.
test('streaming: zgodne z OpenAI i Gemini – tekst na bieżąco, narzędzia z kawałków', async () => {
  const m = await modul();
  const stary = globalThis.fetch;
  const sse = (zdarzenia) => new Response(zdarzenia.map((z) => `data: ${typeof z === 'string' ? z : JSON.stringify(z)}\n\n`).join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  try {
    let krok = 0;
    const zapytania = [];
    globalThis.fetch = async (url, o) => {
      zapytania.push(JSON.parse(o.body));
      krok += 1;
      if (krok === 1) {
        return sse([
          { choices: [{ delta: { content: 'Zmie' } }] }, { choices: [{ delta: { content: 'niam.' } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'nazwa_projektu', arguments: '{"naz' } }] } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'wa":"X"}' } }] } }] }, '[DONE]',
        ]);
      }
      return sse([{ choices: [{ delta: { content: 'Gotowe.' } }] }, '[DONE]']);
    };
    const r = m.nowaRozmowa({ dostawca: 'openai', model: 'gpt-x', ust: { klucz: 'k' }, system: 's', narzedzia: [{ name: 'nazwa_projektu', description: '', inputSchema: { type: 'object' } }] });
    const kawalki = [];
    const wolane = [];
    const w = await m.zapytaj(r, 'zmień nazwę', { naTekst: (t) => kawalki.push(t), wykonaj: async (n, a) => { wolane.push([n, a]); return { tekst: 'ok' }; } });
    assert.deepEqual(kawalki, ['Zmie', 'niam.', 'Gotowe.']);
    assert.deepEqual(wolane, [['nazwa_projektu', { nazwa: 'X' }]]);
    assert.equal(w.tekst, 'Gotowe.');
    assert.equal(zapytania[0].stream, true);
    assert.equal(zapytania[1].messages.find((x) => x.role === 'tool')?.content, 'ok', 'wynik narzędzia wraca do rozmowy');

    krok = 0;
    globalThis.fetch = async (url) => {
      assert.match(String(url), /:streamGenerateContent\?alt=sse/);
      krok += 1;
      if (krok === 1) return sse([{ candidates: [{ content: { parts: [{ text: 'Dzia' }] } }] }, { candidates: [{ content: { parts: [{ text: 'łam.' }, { functionCall: { name: 'czytaj', args: { co: 'projekt' } } }] } }] }]);
      return sse([{ candidates: [{ content: { parts: [{ text: 'Już.' }] } }] }]);
    };
    const g = m.nowaRozmowa({ dostawca: 'gemini', model: 'gemini-x', ust: { klucz: 'k' }, system: 's', narzedzia: [{ name: 'czytaj', description: '', inputSchema: { type: 'object' } }] });
    const gk = [];
    const gw = await m.zapytaj(g, 'czytaj', { naTekst: (t) => gk.push(t), wykonaj: async () => ({ tekst: '{}' }) });
    assert.deepEqual(gk, ['Dzia', 'łam.', 'Już.']);
    assert.equal(g.historia[1].parts[0].text, 'Działam.', 'tekst sklejony w historii');
    assert.equal(gw.tekst, 'Już.');
  } finally { globalThis.fetch = stary; }
});

test('Gemini: lista liczb w „enum” trafia do opisu – inaczej Gemini odrzuca wszystkie narzędzia (#380)', async () => {
  const m = await modul();
  const s = m.schematGemini({ type: 'object', properties: { dpi: { type: 'integer', enum: [150, 300, 600], description: 'Rozdzielczość' }, jakosc: { type: 'string', enum: ['szkic', 'pro'] } }, additionalProperties: false });
  assert.deepEqual(s, { type: 'object', properties: { dpi: { type: 'integer', description: 'Rozdzielczość (150 | 300 | 600)' }, jakosc: { type: 'string', enum: ['szkic', 'pro'] } } });
  assert.deepEqual(m.schematGemini({ type: 'string', enum: ['', 'x1a'] }), { type: 'string', enum: ['x1a'], description: '(puste = brak)' });
});
