// Arkusz stylów bez pozostałości po scalaniu i z domkniętymi blokami (#99): znacznik konfliktu „=======” po
// jednym ze scaleń zostawił otwarty blok @media (max-width: 600px) – wszystkie dalsze reguły przestały działać
// na komputerze (a część na telefonie).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('css/aplikacja.css: bez znaczników konfliktu, nawiasy klamrowe domknięte, żaden blok nie zostaje otwarty', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'aplikacja.css'), 'utf8');
  assert.doesNotMatch(css, /^(<{7}|={7}|>{7})/m, 'znacznik konfliktu scalania');
  const bezKomentarzy = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  let glebokosc = 0;
  for (const z of bezKomentarzy) {
    if (z === '{') glebokosc += 1;
    if (z === '}') { glebokosc -= 1; assert.ok(glebokosc >= 0, 'nadmiarowy „}”'); }
  }
  assert.equal(glebokosc, 0, 'niedomknięty blok');
});
