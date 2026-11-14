// Rozszerzenie Claude Desktop (.mcpb): plik buduje scripts/rozszerzenie-mcpb.py przy wdrożeniu.
// Test pakuje je, rozpakowuje i uruchamia serwer tak, jak robi to Claude Desktop (polecenie i zmienne
// z manifestu, z podstawionymi ${__dirname} i ${user_config.klucz}), potem rozmawia z nim protokołem MCP.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const KORZEN = path.join(__dirname, '..');

test('rozszerzenie .mcpb: manifest zgodny ze specyfikacją 0.3, serwer startuje z kluczem z okna instalacji i odpowiada na MCP bez sieci', async () => {
  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpb-'));
  const plik = path.join(katalog, 'makietka.mcpb');
  execFileSync('python3', [path.join(KORZEN, 'scripts', 'rozszerzenie-mcpb.py'), plik]);
  const rozpakowany = path.join(katalog, 'x');
  execFileSync('python3', ['-I', '-c', 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', plik, rozpakowany]);
  const m = JSON.parse(fs.readFileSync(path.join(rozpakowany, 'manifest.json'), 'utf8'));
  for (const pole of ['manifest_version', 'name', 'version', 'description', 'author', 'server']) assert.ok(m[pole], `brak pola ${pole}`);
  assert.equal(m.manifest_version, '0.3');
  assert.match(m.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'wersja w formacie semver');
  assert.equal(m.server.type, 'node');
  assert.ok(fs.existsSync(path.join(rozpakowany, m.server.entry_point)), 'plik startowy jest w paczce');
  assert.ok(fs.existsSync(path.join(rozpakowany, m.icon)), 'ikona jest w paczce');
  assert.deepEqual(m.user_config.klucz && [m.user_config.klucz.type, m.user_config.klucz.sensitive, m.user_config.klucz.required], ['string', true, true]);

  // Uruchomienie jak w Claude Desktop.
  const podstaw = (s) => s.replaceAll('${__dirname}', rozpakowany).replaceAll('${user_config.klucz}', 'sdk_00000000000000000000000000000000_proba-klucza-testowego');
  const { command, args, env } = m.server.mcp_config;
  const proces = spawn(command === 'node' ? process.execPath : command, args.map(podstaw), {
    env: { ...process.env, ...Object.fromEntries(Object.entries(env).map(([k, v]) => [k, podstaw(v)])), MAKIETKA_ADRES: 'http://127.0.0.1:9' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const odpowiedzi = new Map();
  let bufor = '';
  proces.stdout.on('data', (d) => {
    bufor += d;
    for (let i = bufor.indexOf('\n'); i >= 0; i = bufor.indexOf('\n')) {
      const linia = bufor.slice(0, i); bufor = bufor.slice(i + 1);
      if (linia.trim()) { const o = JSON.parse(linia); if (o.id != null) odpowiedzi.set(o.id, o); }
    }
  });
  const wyslij = (o) => proces.stdin.write(`${JSON.stringify(o)}\n`);
  const czekaj = async (id) => { for (let i = 0; i < 100 && !odpowiedzi.has(id); i += 1) await new Promise((r) => setTimeout(r, 50)); return odpowiedzi.get(id); };
  try {
    wyslij({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
    const init = await czekaj(1);
    assert.ok(init?.result?.serverInfo, `initialize: ${JSON.stringify(init)}`);
    wyslij({ jsonrpc: '2.0', method: 'notifications/initialized' });
    wyslij({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const lista = await czekaj(2);
    const nazwy = lista.result.tools.map((t) => t.name);
    for (const n of ['przeglad_projektu', 'zmien_elementy', 'opis_formatu', 'kontrola']) assert.ok(nazwy.includes(n), `brak narzędzia ${n}`);
    // Opis formatu jest w paczce – działa bez sieci (adres bazy w teście prowadzi donikąd).
    wyslij({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'opis_formatu', arguments: {} } });
    const opis = await czekaj(3);
    assert.match(opis.result.content[0].text, /Format pliku projektu|Makietka/);
  } finally {
    proces.kill();
    fs.rmSync(katalog, { recursive: true, force: true });
  }
});
