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
  for (const n of ['usun_projekt', 'usun_strony', 'usun_elementy', 'usun_obrazy', 'zmien_projekt', 'podmien_obraz', 'cofnij_zmiany_ai']) assert.ok(niszczace.includes(n), n);
  for (const n of ['projekty', 'czytaj', 'przeglad_projektu', 'biblioteka']) assert.equal(tools.find((t) => t.name === n).annotations.readOnlyHint, true, n);
  assert.equal(tools.find((t) => t.name === 'generuj_obraz').annotations.openWorldHint, true);
});
