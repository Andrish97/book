// Arkusze stylów bez pozostałości po scalaniu i z domkniętymi blokami (#99): znacznik konfliktu „=======” po
// jednym ze scaleń zostawił otwarty blok @media (max-width: 600px) – wszystkie dalsze reguły przestały działać
// na komputerze (a część na telefonie).
// Silnik stylów (#291): warstwy w css/style/ – każdy plik domknięty sam w sobie, index.html wczytuje wszystkie,
// w kolejności warstw: tokeny, baza, komponenty, układ, ekrany, urządzenia, narzędzia.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');
const arkuszeStylu = () => fs.readdirSync(path.join(KORZEN, 'css', 'style'), { recursive: true }).filter((p) => p.endsWith('.css')).map((p) => `css/style/${p.split(path.sep).join('/')}`);

test('arkusze w css/style: bez znaczników konfliktu, nawiasy klamrowe domknięte w każdym pliku', () => {
  for (const p of arkuszeStylu()) {
    const css = fs.readFileSync(path.join(KORZEN, p), 'utf8');
    assert.doesNotMatch(css, /^(<{7}|={7}|>{7})/m, `${p}: znacznik konfliktu scalania`);
    const bezKomentarzy = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    let glebokosc = 0;
    for (const z of bezKomentarzy) {
      if (z === '{') glebokosc += 1;
      if (z === '}') { glebokosc -= 1; assert.ok(glebokosc >= 0, `${p}: nadmiarowy „}”`); }
    }
    assert.equal(glebokosc, 0, `${p}: niedomknięty blok`);
  }
});

test('index.html wczytuje warstwy stylów w kolejności i wszystkie pliki (poza katalogiem komponentów)', () => {
  const html = fs.readFileSync(path.join(KORZEN, 'index.html'), 'utf8');
  const linki = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  const warstwy = linki.filter((l) => l.startsWith('css/style/'));
  const kolejnosc = (l) => ['tokens', 'base', 'components', 'layout', 'ekrany/', 'urzadzenia', 'utilities'].findIndex((w) => l.slice('css/style/'.length).startsWith(w));
  assert.ok(warstwy.every((l) => kolejnosc(l) >= 0), 'nieznana warstwa');
  assert.deepEqual(warstwy.map(kolejnosc), [...warstwy.map(kolejnosc)].sort((a, b) => a - b), 'warstwy po kolei');
  assert.deepEqual([...warstwy].sort(), arkuszeStylu().filter((p) => p !== 'css/style/ekrany/katalog.css').sort(), 'każdy plik warstwy jest w index.html');
  assert.equal(fs.existsSync(path.join(KORZEN, 'css', 'aplikacja.css')), false, 'stary jeden arkusz zastąpiony warstwami');
});

// Ścieżki w url() liczą się od pliku arkusza – po przeniesieniu do css/style/ „../img” wskazywało w próżnię
// (znak logo bez rysunku, #291).
test('url() w arkuszach warstw wskazują na istniejące pliki', () => {
  for (const p of arkuszeStylu()) {
    const css = fs.readFileSync(path.join(KORZEN, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
      if (/^(data:|https?:|#)/.test(m[2])) continue;
      assert.ok(fs.existsSync(path.join(KORZEN, path.dirname(p), m[2])), `${p}: ${m[2]} nie istnieje`);
    }
  }
});
