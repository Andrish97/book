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
  assert.equal(katalog.length, 51); // #436: reflow_thread, preview_page, page_texts
  assert.ok(!katalog.includes('generate_image') && !katalog.includes('draw_comic_panels') && katalog.includes('place_speech_bubbles'));
  assert.equal((await wolaj('https://api.makietka.app/mcp', 'tools/call', { name: 'generate_image', arguments: {} })).error?.code !== undefined, true);
  assert.doesNotMatch((await wolaj('https://api.makietka.app/mcp', 'initialize', { protocolVersion: '2025-06-18' })).result.instructions, /generate_image|draw_comic_panels|generuj_obraz|rysuj_kadry/);
  const pelny = await nazwy('https://api.makietka.app/mcp/full');
  assert.equal(pelny.length, 53);
  assert.ok(pelny.includes('generate_image') && pelny.includes('draw_comic_panels'));
  assert.equal((await nazwy(`https://api.makietka.app/mcp/${KLUCZ}`)).length, 53);
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
      assert.doesNotMatch(tx, /ALWAYS|FIRST call|tell the user|ask the user|never refuse/i, t.name);
    }
  }
});

// #410: łącznik po angielsku – nazwy narzędzi, parametrów, opisy i wartości; polskie nazwy i argumenty dalej działają.
test('łącznik po angielsku: nazwy, parametry i opisy bez polskiego; stare polskie nazwy działają', async () => {
  const { obsluzHttp } = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'mcp-http.mjs')).href);
  const env = { adres: 'http://127.0.0.1:9', kluczPubliczny: 'x', publiczny: 'https://api.makietka.app' };
  const KLUCZ = `sdk_${'a'.repeat(32)}_${'b'.repeat(24)}`;
  const wolaj = async (method, params = {}) => (await obsluzHttp(new Request('https://api.makietka.app/mcp/full', {
    method: 'POST', headers: { authorization: `Bearer ${KLUCZ}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), env)).json();
  const { tools } = (await wolaj('tools/list')).result;
  const POLSKIE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
  const parametry = [];
  const chodz = (s) => { for (const [k, v] of Object.entries(s?.properties || {})) { parametry.push(k); chodz(v); chodz(v.items); } };
  for (const t of tools) {
    assert.match(t.name, /^[a-z]+(_[a-z]+)*$/, t.name);
    assert.doesNotMatch(`${t.title} ${t.description}`.replace('[pomiń]', ''), POLSKIE, t.name);
    chodz(t.inputSchema);
    for (const v of Object.values(t.inputSchema.properties)) assert.doesNotMatch(`${v.description || ''} ${(v.enum || []).join(' ')}`, POLSKIE, `${t.name}: ${v.description}`);
  }
  for (const n of ['list_projects', 'get_project_overview', 'update_elements', 'export_pdf', 'undo_ai_changes']) assert.ok(tools.some((t) => t.name === n), n);
  for (const p of ['gdzie', 'zmiany', 'projekt', 'nazwa', 'strona', 'tresc']) assert.ok(!parametry.includes(p), p);
  const init = (await wolaj('initialize', { protocolVersion: '2025-06-18' })).result.instructions;
  assert.match(init, /^The tools read and change Makietka projects/);
  assert.doesNotMatch(init, POLSKIE);
  // Argumenty po angielsku wracają do polskich nazw i wartości (bez bazy: odmowa klucza przychodzi po przekładzie).
  const r = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs')).href);
  let widziane = null;
  const s = r.utworzSerwer({ adres: 'http://127.0.0.1:9', kluczPubliczny: 'x', klucz: 'sdk_x', angielski: true });
  const n = s.narzedzia.find((x) => x.name === 'wyrownaj_elementy');
  const stare = n.dzialaj;
  n.dzialaj = async (a) => { widziane = a; return 'ok'; };
  await s.obsluz({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'align_elements', arguments: { target: 'page:s1', id: ['a', 'b'], align: 'center', relative_to: 'page' } } });
  assert.deepEqual(widziane, { gdzie: 'strona:s1', id: ['a', 'b'], do: 'srodek', wzgledem: 'strona' });
  await s.obsluz({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'wyrownaj_elementy', arguments: { gdzie: 'strona:s1', id: ['a'], do: 'lewo' } } });
  assert.deepEqual(widziane, { gdzie: 'strona:s1', id: ['a'], do: 'lewo' });
  n.dzialaj = stare;
  // Asystent w aplikacji (bez angielski) – dalej polskie nazwy.
  const pl = r.utworzSerwer({ adres: 'http://127.0.0.1:9', kluczPubliczny: 'x', klucz: 'sdk_x' });
  assert.ok((await pl.obsluz({ jsonrpc: '2.0', id: 4, method: 'tools/list' })).result.tools.some((t) => t.name === 'przeglad_projektu'));
  // Każdy opis ma tłumaczenie (po zmianie opisu: scripts/mcp-angielski.cjs).
  const teksty = require('../supabase/functions/_shared/mcp-teksty-en.json');
  const plLista = (await pl.obsluz({ jsonrpc: '2.0', id: 5, method: 'tools/list' })).result.tools;
  const brak = [];
  const sprawdz = (x) => { if (x && !(x in teksty)) brak.push(x.slice(0, 60)); };
  const opisy = (sch) => { for (const v of Object.values(sch?.properties || {})) { sprawdz(v.description); opisy(v); opisy(v.items); } };
  for (const t of plLista) { sprawdz(t.title); sprawdz(t.description); opisy(t.inputSchema); }
  assert.deepEqual(brak, []);
});
