#!/usr/bin/env node
// Lista modułów do równoległego pobrania (#158). Aplikacja to moduły ES bez łączenia w paczkę – przeglądarka
// odkrywa import po imporcie, poziom po poziomie (start: 6 poziomów, edytor: 5). Na wolnym łączu każdy poziom
// to osobna podróż do serwera. Ten skrypt liczy statyczne importy i zapisuje:
//   – w index.html (między znacznikami moduly:start / moduly:koniec) <link rel="modulepreload"> dla modułów startu,
//   – w js/app/moduly-edytora.js listę modułów edytora (doczytaj.js dodaje je naraz przed wczytaniem edytora).
// Uruchom po zmianie importów: node scripts/moduly-buduj.cjs. Z --sprawdz tylko sprawdza (test w tests/).

const fs = require('fs');
const path = require('path');

const KAT = path.join(__dirname, '..');
const wzgl = (p) => path.relative(KAT, p).split(path.sep).join('/');

function importy(plik) {
  const t = fs.readFileSync(plik, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const w = [];
  for (const m of t.matchAll(/^\s*(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)) w.push(m[1] || m[2]);
  return w.filter((x) => x.startsWith('.')).map((x) => path.resolve(path.dirname(plik), x));
}

// Domknięcie statycznych importów, w kolejności od najpłytszych (tak przeglądarka i tak ich potrzebuje).
function domkniecie(start) {
  const glebokosc = new Map();
  const kolejka = [[path.join(KAT, start), 0]];
  while (kolejka.length) {
    const [p, g] = kolejka.shift();
    if (glebokosc.has(p) && glebokosc.get(p) <= g) continue;
    if (!fs.existsSync(p)) throw new Error(`Brak pliku ${wzgl(p)} (import)`);
    glebokosc.set(p, g);
    for (const d of importy(p)) kolejka.push([d, g + 1]);
  }
  return [...glebokosc].sort((a, b) => a[1] - b[1] || wzgl(a[0]).localeCompare(wzgl(b[0]))).map(([p]) => wzgl(p));
}

function zbuduj() {
  const start = domkniecie('js/aplikacja.js');
  const edytor = domkniecie('js/app/edytor-start.js').filter((p) => !start.includes(p));
  const html = fs.readFileSync(path.join(KAT, 'index.html'), 'utf8');
  const znaczniki = /( *)<!-- moduly:start[^>]*-->[\s\S]*?<!-- moduly:koniec -->/;
  if (!znaczniki.test(html)) throw new Error('index.html: brak znaczników <!-- moduly:start --> … <!-- moduly:koniec -->');
  const wciecie = html.match(znaczniki)[1];
  // Sam js/aplikacja.js ładuje <script type="module"> – preload pozostałych.
  const linki = start.filter((p) => p !== 'js/aplikacja.js').map((p) => `${wciecie}<link rel="modulepreload" href="${p}">`).join('\n');
  const nowyHtml = html.replace(znaczniki, `${wciecie}<!-- moduly:start (scripts/moduly-buduj.cjs – nie edytuj ręcznie) -->\n${linki}\n${wciecie}<!-- moduly:koniec -->`);
  const js = `// Plik generowany: node scripts/moduly-buduj.cjs (#158) – nie edytuj ręcznie.
// Moduły edytora poza tymi z ekranu startowego – js/app/doczytaj.js pobiera je naraz przed wczytaniem edytora.
export const MODULY_EDYTORA = [
${edytor.map((p) => `  '${p}',`).join('\n')}
];
`;
  return { html: nowyHtml, js, start, edytor };
}

const wynik = zbuduj();
const plikJs = path.join(KAT, 'js/app/moduly-edytora.js');
if (process.argv.includes('--sprawdz')) {
  const html = fs.readFileSync(path.join(KAT, 'index.html'), 'utf8');
  const js = fs.existsSync(plikJs) ? fs.readFileSync(plikJs, 'utf8') : '';
  if (html !== wynik.html || js !== wynik.js) {
    console.error('Lista modułów jest nieaktualna – uruchom: node scripts/moduly-buduj.cjs');
    process.exit(1);
  }
  console.log('Lista modułów aktualna.');
} else {
  fs.writeFileSync(path.join(KAT, 'index.html'), wynik.html);
  fs.writeFileSync(plikJs, wynik.js);
  console.log(`Start: ${wynik.start.length} modułów, edytor: ${wynik.edytor.length}.`);
}
