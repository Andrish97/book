// Strona aplikacji do wdrożenia (#345): jeden przepis (scripts/buduj-strone.sh) dla Cloudflare i GitHub Pages –
// komplet plików, wersja service workera, 404.html dla krótkich linków, nagłówki pamięci podręcznej.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('hosting: strona zbudowana jednym przepisem – pliki, wersja, 404, nagłówki', () => {
  const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'makietka-strona-'));
  try {
    execFileSync('bash', ['scripts/buduj-strone.sh', kat, '0123456789abcdef'], { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
    for (const p of ['index.html', 'rysuj.html', '404.html', 'sw.js', 'manifest.webmanifest', 'llms.txt', '_headers', 'js/aplikacja.js', 'js/rysuj.js', 'css/czcionki.css', 'ai/mcp/makietka.mcpb']) {
      assert.ok(fs.existsSync(path.join(kat, p)), `jest ${p}`);
    }
    const sw = fs.readFileSync(path.join(kat, 'sw.js'), 'utf8');
    assert.match(sw, /const WERSJA = '0123456789ab';/, 'wersja service workera z commita');
    assert.doesNotMatch(sw, /const PLIKI = \[\];/, 'lista plików kodu wpisana');
    assert.equal(fs.readFileSync(path.join(kat, '404.html'), 'utf8'), fs.readFileSync(path.join(kat, 'index.html'), 'utf8'), 'krótkie linki – ta sama aplikacja');
    const n = fs.readFileSync(path.join(kat, '_headers'), 'utf8');
    assert.match(n, /\/sw\.js\n\s+Cache-Control: no-cache/);
    assert.match(n, /\/js\/zewnetrzne\/\*\.js\n\s+Cache-Control: public, max-age=31536000, immutable/, 'biblioteki z wersją w nazwie – rok');
    assert.match(n, /X-Content-Type-Options: nosniff/);
    // biblioteki „na rok” muszą mieć wersję w nazwie pliku – inaczej zmiana nie dotarłaby do użytkowników
    const bezWersji = fs.readdirSync(path.join(kat, 'js', 'zewnetrzne')).filter((f) => f.endsWith('.js') && !/-\d+\.\d+\.\d+/.test(f));
    assert.deepEqual(bezWersji, []);
    // konfiguracja workera aplikacji wskazuje zbudowany katalog i 404.html
    const konf = fs.readFileSync(path.join(__dirname, '..', 'cloudflare', 'aplikacja', 'wrangler.jsonc'), 'utf8');
    assert.match(konf, /"directory": "\.\.\/\.\.\/_site"/);
    assert.match(konf, /"not_found_handling": "404-page"/);
  } finally {
    fs.rmSync(kat, { recursive: true, force: true });
  }
});
