// Pozostałości po scalaniu: znaczniki konfliktu git w plikach aplikacji i niedomknięte bloki CSS.
// (Zgubiony „}” po scaleniu zamknął całą dalszą część css/aplikacja.css w @media (max-width: 600px) –
// panel administratora i inne nowsze style działały tylko na telefonie.)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');
const KATALOGI = ['css', 'js', 'cloudflare', 'supabase', 'tests', 'scripts', 'ai'];
const ROZSZERZENIA = /\.(css|js|mjs|cjs|ts|sql|html|json|jsonc)$/;

function pliki(katalog) {
  const wynik = [];
  for (const w of fs.readdirSync(katalog, { withFileTypes: true })) {
    if (w.name === 'node_modules' || w.name.startsWith('.')) continue;
    const p = path.join(katalog, w.name);
    if (w.isDirectory()) wynik.push(...pliki(p));
    else if (ROZSZERZENIA.test(w.name)) wynik.push(p);
  }
  return wynik;
}

test('bez znaczników konfliktu git; style CSS z domkniętymi blokami', () => {
  const wszystkie = [path.join(KORZEN, 'index.html'), ...KATALOGI.flatMap((k) => pliki(path.join(KORZEN, k)))];
  const znaczniki = [];
  for (const p of wszystkie) {
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      if (/^(<{7}|={7}|>{7})( |$)/.test(l)) znaczniki.push(`${path.relative(KORZEN, p)}:${i + 1}`);
    });
  }
  assert.deepEqual(znaczniki, []);
  for (const p of wszystkie.filter((x) => x.endsWith('.css'))) {
    const css = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    let glebokosc = 0;
    css.split('\n').forEach((l, i) => {
      for (const z of l) {
        if (z === '{') glebokosc += 1;
        if (z === '}') glebokosc -= 1;
      }
      assert.ok(glebokosc >= 0, `${path.relative(KORZEN, p)}:${i + 1} – nadmiarowy „}”`);
    });
    assert.equal(glebokosc, 0, `${path.relative(KORZEN, p)} – niedomknięty blok`);
  }
});
