#!/usr/bin/env node
// Słowniki języków interfejsu (#219): scripts/jezyki/<język>.json (polski napis → tłumaczenie) → js/jezyki/<język>.js
// (moduł z jednym obiektem, wczytywany przez js/jezyk.js). Klucze z białymi znakami zwiniętymi do pojedynczych spacji.
// Użycie: node scripts/jezyki-buduj.cjs [--sprawdz]   (--sprawdz – czy pliki są aktualne i czy index.html ma tłumaczenia)

const fs = require('node:fs');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');
const JEZYKI = ['en', 'uk'];
const norm = (t) => String(t).replace(/\s+/g, ' ').trim();

function slownik(j) {
  const plik = path.join(__dirname, 'jezyki', `${j}.json`);
  const dane = JSON.parse(fs.readFileSync(plik, 'utf8'));
  const wynik = {};
  for (const k of Object.keys(dane).sort((a, b) => a.localeCompare(b, 'pl'))) {
    const v = dane[k];
    if (typeof v === 'string' && v.trim() && norm(k)) wynik[norm(k)] = v.trim();
  }
  return wynik;
}

const tresc = (j, s) => `// PLIK SKŁADANY ze scripts/jezyki/${j}.json (node scripts/jezyki-buduj.cjs) – nie edytuj ręcznie.\n// Język interfejsu (#219): polski napis → tłumaczenie.\nexport default ${JSON.stringify(s, null, 0).replace(/","/g, '",\n"')};\n`;

let blad = false;
for (const j of JEZYKI) {
  const s = slownik(j);
  const cel = path.join(KORZEN, 'js', 'jezyki', `${j}.js`);
  const t = tresc(j, s);
  if (process.argv.includes('--sprawdz')) {
    if (!fs.existsSync(cel) || fs.readFileSync(cel, 'utf8') !== t) { console.error(`js/jezyki/${j}.js jest nieaktualny – uruchom node scripts/jezyki-buduj.cjs`); blad = true; }
  } else {
    fs.writeFileSync(cel, t);
    console.log(`js/jezyki/${j}.js: ${Object.keys(s).length} napisów`);
  }
}
if (blad) process.exit(1);
