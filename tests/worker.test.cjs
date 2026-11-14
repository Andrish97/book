// Przekaźnik Cloudflare api.makietka.app → baza (cloudflare/api-worker.js): przepisywanie adresów,
// przenoszenie metody, nagłówków, treści i prośby o WebSocket. Bez Cloudflare – atrapa fetch.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WORKER = path.join(__dirname, '..', 'cloudflare', 'api-worker.js');

test('przekaźnik api.makietka.app: /mcp → /functions/v1/mcp, reszta bez zmian, zapytanie przechodzi w całości', async (t) => {
  const { default: worker, adresCelu, CEL } = await import(pathToFileURL(WORKER).href);
  assert.equal(CEL, 'https://pganajmivwtstapnwsgv.supabase.co');
  assert.equal(adresCelu('https://api.makietka.app/mcp/sdk_abc'), `${CEL}/functions/v1/mcp/sdk_abc`);
  assert.equal(adresCelu('https://api.makietka.app/mcp/sdk_abc/obraz?nazwa=a.jpg'), `${CEL}/functions/v1/mcp/sdk_abc/obraz?nazwa=a.jpg`);
  assert.equal(adresCelu('https://api.makietka.app/mcp'), `${CEL}/functions/v1/mcp`);
  assert.equal(adresCelu('https://api.makietka.app/mcpx'), `${CEL}/mcpx`, 'tylko ścieżka /mcp');
  assert.equal(adresCelu('https://api.makietka.app/rest/v1/projekty?select=id'), `${CEL}/rest/v1/projekty?select=id`);
  assert.equal(adresCelu('https://api.makietka.app/functions/v1/mcp/sdk_x'), `${CEL}/functions/v1/mcp/sdk_x`, 'pełna ścieżka też działa');
  assert.equal(adresCelu('https://api.makietka.app/realtime/v1/websocket?apikey=k&vsn=1.0.0'), `${CEL}/realtime/v1/websocket?apikey=k&vsn=1.0.0`);

  const wyslane = [];
  const prawdziwyFetch = globalThis.fetch;
  globalThis.fetch = async (req, opcje) => { wyslane.push({ req, opcje }); return new Response('ok', { status: 200 }); };
  t.after(() => { globalThis.fetch = prawdziwyFetch; });

  // POST z treścią i nagłówkami (łącznik MCP).
  await worker.fetch(new Request('https://api.makietka.app/mcp/sdk_abc', {
    method: 'POST', headers: { 'content-type': 'application/json', 'mcp-protocol-version': '2026-07-28', authorization: 'Bearer x' }, body: '{"jsonrpc":"2.0"}',
  }));
  let { req, opcje } = wyslane.at(-1);
  assert.equal(req.url, `${CEL}/functions/v1/mcp/sdk_abc`);
  assert.equal(req.method, 'POST');
  assert.equal(req.headers.get('mcp-protocol-version'), '2026-07-28');
  assert.equal(req.headers.get('authorization'), 'Bearer x');
  assert.equal(await req.text(), '{"jsonrpc":"2.0"}');
  assert.equal(opcje.redirect, 'manual');

  // Prośba o WebSocket (Realtime) – nagłówki Upgrade przechodzą.
  await worker.fetch(new Request('https://api.makietka.app/realtime/v1/websocket?apikey=k', { headers: { upgrade: 'websocket', connection: 'Upgrade', 'sec-websocket-key': 'abc' } }));
  ({ req } = wyslane.at(-1));
  assert.equal(req.url, `${CEL}/realtime/v1/websocket?apikey=k`);
  assert.equal(req.headers.get('upgrade'), 'websocket');
  assert.equal(req.headers.get('sec-websocket-key'), 'abc');

  // Strona główna przekaźnika – krótka informacja, bez przekazywania.
  const ile = wyslane.length;
  const glowna = await worker.fetch(new Request('https://api.makietka.app/'));
  assert.match(await glowna.text(), /Makietka/);
  assert.equal(wyslane.length, ile);

  // Konfiguracja wdrożenia: nazwa, plik, własna domena.
  const konf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cloudflare', 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(konf.name, 'makietka-api');
  assert.equal(konf.main, 'api-worker.js');
  assert.deepEqual(konf.routes, [{ pattern: 'api.makietka.app', custom_domain: true }]);
});
