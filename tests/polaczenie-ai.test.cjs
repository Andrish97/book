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
