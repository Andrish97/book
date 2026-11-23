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
  // #244: opisy logowania OAuth łącznika.
  assert.equal(adresCelu('https://api.makietka.app/.well-known/oauth-authorization-server'), `${CEL}/functions/v1/mcp/.well-known/oauth-authorization-server`);
  assert.equal(adresCelu('https://api.makietka.app/.well-known/oauth-protected-resource/mcp'), `${CEL}/functions/v1/mcp/.well-known/oauth-protected-resource/mcp`);
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
  assert.deepEqual(konf.routes, [{ pattern: 'api.makietka.app', custom_domain: true }, { pattern: 'makietka.app/*', zone_name: 'makietka.app' }, { pattern: 'www.makietka.app/*', zone_name: 'makietka.app' }]); // #352: ten sam worker podaje aplikację
});

test('ikona api.makietka.app (adres łącznika AI): /favicon.ico z plików strony, strona główna z <link rel="icon">', async () => {
  const { default: worker } = await import(pathToFileURL(WORKER).href);
  const ico = fs.readFileSync(path.join(__dirname, '..', 'favicon.ico'));
  const env = { ASSETS: { fetch: async (r) => (new URL(r.url).pathname === '/favicon.ico' ? new Response(ico) : new Response('nie', { status: 404 })) } };
  let odp = await worker.fetch(new Request('https://api.makietka.app/favicon.ico'), env);
  assert.equal(odp.status, 200);
  assert.equal(odp.headers.get('content-type'), 'image/x-icon');
  assert.deepEqual(Buffer.from(await odp.arrayBuffer()), ico);
  odp = await worker.fetch(new Request('https://api.makietka.app/'), env);
  const html = await odp.text();
  assert.match(odp.headers.get('content-type'), /text\/html/);
  assert.match(html, /<link rel="icon" href="https:\/\/makietka\.app\/img\/ikony\/ikona\.svg"/);
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'buduj-strone.sh'), 'utf8').includes('favicon.ico'), 'favicon.ico w plikach strony');
});
