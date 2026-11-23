// Wymagania katalogu łączników Claude (claude.ai/directory): każde narzędzie ma title i adnotację readOnlyHint,
// a narzędzie zmieniające – także destructiveHint; usuwające i zastępujące dane są oznaczone jako niszczące.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('łącznik: title i adnotacje każdego narzędzia', async () => {
  const r = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs')).href);
  const s = r.utworzSerwer({ adres: 'http://127.0.0.1:9', kluczPubliczny: 'x', klucz: 'sdk_x' });
  const { tools } = (await s.obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result;
  for (const t of tools) {
    assert.ok(t.title && t.title.length <= 60, `${t.name}: title`);
    assert.equal(typeof t.annotations.readOnlyHint, 'boolean', `${t.name}: readOnlyHint`);
    if (!t.annotations.readOnlyHint) assert.equal(typeof t.annotations.destructiveHint, 'boolean', `${t.name}: destructiveHint`);
  }
  const niszczace = tools.filter((t) => t.annotations.destructiveHint).map((t) => t.name).sort();
  for (const n of ['usun_projekt', 'usun_strony', 'usun_elementy', 'usun_obrazy', 'usun_z_tabeli', 'usun_czesc', 'zmien_projekt', 'podmien_obraz', 'cofnij_zmiany_ai']) assert.ok(niszczace.includes(n), n);
  // Zwykła edycja bez oznaczenia (podział 23.11: usuwanie wierszy, kolumn i części – osobnymi narzędziami).
  for (const n of ['zmien_tabele', 'zmien_czesc', 'zmien_elementy', 'dodaj_elementy']) assert.equal(tools.find((t) => t.name === n).annotations.destructiveHint, false, n);
  assert.ok(!('usun' in tools.find((t) => t.name === 'zmien_czesc').inputSchema.properties));
  assert.ok(!('usun_wiersze' in tools.find((t) => t.name === 'zmien_tabele').inputSchema.properties));
  for (const n of ['projekty', 'czytaj', 'przeglad_projektu', 'biblioteka']) assert.equal(tools.find((t) => t.name === n).annotations.readOnlyHint, true, n);
  assert.equal(tools.find((t) => t.name === 'generuj_obraz').annotations.openWorldHint, true);
});

// #408: zasady katalogu Claude – łącznik z katalogu (/mcp z logowaniem) bez rysowania obrazów modelem AI;
// pełny łącznik pod /mcp/full (i adresy z kluczem). Opisy narzędzi bez odwołań do innych narzędzi i bez poleceń dla AI.
test('łącznik z katalogu: bez rysowania obrazów, /mcp/full – pełny; opisy bez odwołań do innych narzędzi', async () => {
  const { obsluzHttp } = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'mcp-http.mjs')).href);
  const env = { adres: 'http://127.0.0.1:9', kluczPubliczny: 'x', publiczny: 'https://api.makietka.app' };
  const KLUCZ = `sdk_${'a'.repeat(32)}_${'b'.repeat(24)}`;
  const wolaj = async (url, method, params = {}) => (await obsluzHttp(new Request(url, {
    method: 'POST', headers: { authorization: `Bearer ${KLUCZ}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), env)).json();
  const nazwy = async (url) => (await wolaj(url, 'tools/list')).result.tools.map((t) => t.name);
  const katalog = await nazwy('https://api.makietka.app/mcp');
  assert.equal(katalog.length, 48);
  assert.ok(!katalog.includes('generuj_obraz') && !katalog.includes('rysuj_kadry') && katalog.includes('ustaw_dymki'));
  assert.equal((await wolaj('https://api.makietka.app/mcp', 'tools/call', { name: 'generuj_obraz', arguments: {} })).error?.code !== undefined, true);
  assert.doesNotMatch((await wolaj('https://api.makietka.app/mcp', 'initialize', { protocolVersion: '2025-06-18' })).result.instructions, /generuj_obraz|rysuj_kadry/);
  const pelny = await nazwy('https://api.makietka.app/mcp/full');
  assert.equal(pelny.length, 50);
  assert.ok(pelny.includes('generuj_obraz') && pelny.includes('rysuj_kadry'));
  assert.equal((await nazwy(`https://api.makietka.app/mcp/${KLUCZ}`)).length, 50);
  // Logowanie OAuth pod pełnym adresem: zasób /mcp/full.
  const bez = await obsluzHttp(new Request('https://api.makietka.app/mcp/full', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' }), env);
  assert.equal(bez.status, 401);
  assert.match(bez.headers.get('www-authenticate'), /oauth-protected-resource\/mcp\/full"$/);
  const zasob = await (await obsluzHttp(new Request('https://x.supabase.co/functions/v1/mcp/.well-known/oauth-protected-resource/mcp/full'), env)).json();
  assert.equal(zasob.resource, 'https://api.makietka.app/mcp/full');
  // Opisy (także parametrów) nie odsyłają do innych narzędzi i nie wydają poleceń AI.
  const { tools } = (await wolaj('https://api.makietka.app/mcp', 'tools/list')).result;
  const re = new RegExp(`\\b(${tools.map((t) => t.name).join('|')})\\b`);
  for (const t of tools) {
    const teksty = [t.description, ...Object.values(t.inputSchema.properties).map((v) => v.description || '')];
    for (const tx of teksty) {
      // Pola zmian (usun_strony?, kolejnosc_stron?) i zwykłe słowo „czcionki” to nie odwołania do narzędzi.
      assert.doesNotMatch(tx.replaceAll(t.name, '').replace(/\b[a-z_]+\?/g, '').replace(/czcionki/g, ''), re, `${t.name}: ${tx.slice(0, 80)}`);
      assert.doesNotMatch(tx, /ZAWSZE|NAJPIERW|NIE odmawiaj|powiedz użytkownikowi|zapytaj|przeczytaj/i, t.name);
    }
  }
});
