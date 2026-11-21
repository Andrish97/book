// Strona aplikacji do wdrożenia (#345): przepis scripts/buduj-strone.sh dla Cloudflare –
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
    // jeden worker z API (#352): pliki z ../_site budowane przy wdrożeniu, 404.html dla krótkich linków
    const konf = fs.readFileSync(path.join(__dirname, '..', 'cloudflare', 'wrangler.jsonc'), 'utf8');
    assert.match(konf, /"directory": "\.\.\/_site"/);
    assert.match(konf, /"not_found_handling": "404-page"/);
    assert.match(konf, /"command": "bash \.\.\/scripts\/buduj-strone\.sh _site"/);
  } finally {
    fs.rmSync(kat, { recursive: true, force: true });
  }
});

// #347, #352: domena makietka.app na workerze API – www przekierowuje na makietka.app, makietka.app idzie do plików,
// api.makietka.app dalej jest przekaźnikiem; trasy i plik importu DNS opisują ten sam adres.
test('hosting: www.makietka.app przekierowuje na makietka.app, trasy i rekordy DNS do importu', async () => {
  const { pathToFileURL } = require('node:url');
  const { default: worker } = await import(pathToFileURL(path.join(__dirname, '..', 'cloudflare', 'api-worker.js')).href);
  const env = { ASSETS: { fetch: async (z) => new Response(`plik ${new URL(z.url).pathname}`) } };
  const www = await worker.fetch(new Request('https://www.makietka.app/js/aplikacja.js?v=1'), env);
  assert.equal(www.status, 301);
  assert.equal(www.headers.get('location'), 'https://makietka.app/js/aplikacja.js?v=1');
  assert.equal(await (await worker.fetch(new Request('https://makietka.app/AbC123'), env)).text(), 'plik /AbC123');
  assert.match(await (await worker.fetch(new Request('https://api.makietka.app/'), env)).text(), /Makietka – API/);
  const konf = fs.readFileSync(path.join(__dirname, '..', 'cloudflare', 'wrangler.jsonc'), 'utf8');
  assert.match(konf, /"pattern": "makietka\.app\/\*", "zone_name": "makietka\.app"/);
  assert.match(konf, /"pattern": "www\.makietka\.app\/\*", "zone_name": "makietka\.app"/);
  assert.match(konf, /"pattern": "api\.makietka\.app", "custom_domain": true/);
  const dns = fs.readFileSync(path.join(__dirname, '..', 'cloudflare', 'aplikacja', 'dns-makietka-app.txt'), 'utf8');
  assert.match(dns, /^@\t1\tIN\tAAAA\t100:: ; cf_tags=cf-proxied:true$/m);
  assert.match(dns, /^www\t1\tIN\tAAAA\t100:: ; cf_tags=cf-proxied:true$/m);
});
