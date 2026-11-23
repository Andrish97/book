#!/usr/bin/env node
// Ręczne przeniesienie napisów z kodu na klucze z gotowymi tłumaczeniami (#409).
// Wejście: plik JSON [{ plik, z, na?, klucz, pl, en, uk }] – „z” to dokładny fragment kodu (np. 'Zapisz' z cudzysłowem),
// „na” – czym go zastąpić (domyślnie t('klucz')). Klucze dopisywane do js/jezyki/klucze/{pl,en,uk}.js, import t
// dodawany, gdy plik go nie ma. Użycie: node scripts/i18n-przenies.cjs <wpisy.json>
const fs = require('node:fs');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');
const wpisy = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const plikKluczy = (j) => path.join(KORZEN, 'js', 'jezyki', 'klucze', `${j}.js`);
const czytaj = (j) => { const t = fs.readFileSync(plikKluczy(j), 'utf8'); return { glowa: t.slice(0, t.indexOf('{')), d: JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)), ogon: t.slice(t.lastIndexOf('}') + 1) }; };
const slowniki = Object.fromEntries(['pl', 'en', 'uk'].map((j) => [j, czytaj(j)]));
const bledy = [];
const pliki = new Map();
for (const w of wpisy) {
  for (const j of ['pl', 'en', 'uk']) {
    if (typeof w[j] !== 'string') { bledy.push(`${w.klucz}: brak ${j}`); continue; }
    const stary = slowniki[j].d[w.klucz];
    if (stary !== undefined && stary !== w[j]) bledy.push(`${w.klucz}: inny ${j} już jest („${stary}”)`);
    slowniki[j].d[w.klucz] = w[j];
  }
  if (!w.plik) continue;
  const p = path.join(KORZEN, w.plik);
  let kod = pliki.get(p) ?? fs.readFileSync(p, 'utf8');
  if (!kod.includes(w.z)) { bledy.push(`${w.plik}: nie ma ${w.z}`); continue; }
  const alias = /import\s*\{[^}]*\bt\s+as\s+(\w+)[^}]*\}\s*from\s*'[^']*jezyk\.js'/.exec(kod)?.[1];
  const nazwa = alias || 't';
  const na = (w.na ?? `t('${w.klucz}')`).replace(/^t\(/, `${nazwa}(`).replace(/([^\w.])t\('/g, `$1${nazwa}('`);
  kod = kod.split(w.z).join(na);
  if (!alias && !/import\s*\{[^}]*\bt\b[^}]*\}\s*from\s*'[^']*jezyk\.js'/.test(kod)) {
    const wzgl = path.relative(path.dirname(p), path.join(KORZEN, 'js', 'jezyk.js')).replace(/\\/g, '/');
    const imp = `import { t } from '${wzgl.startsWith('.') ? wzgl : `./${wzgl}`}';\n`;
    const ost = [...kod.matchAll(/^import[^;]*;\n/gm)].pop();
    kod = ost ? kod.slice(0, ost.index + ost[0].length) + imp + kod.slice(ost.index + ost[0].length) : imp + kod;
  }
  pliki.set(p, kod);
}
if (bledy.length) { console.error(bledy.join('\n')); process.exit(1); }
for (const [p, kod] of pliki) fs.writeFileSync(p, kod);
for (const j of ['pl', 'en', 'uk']) {
  const s = slowniki[j];
  const posort = Object.fromEntries(Object.entries(s.d).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  fs.writeFileSync(plikKluczy(j), `${s.glowa}${JSON.stringify(posort, null, 2).replace(/\n}$/, ',\n}').replace(/,\n}$/, '\n}')}${s.ogon}`);
}
console.log(`Kluczy: ${wpisy.length}, plików: ${pliki.size}`);
