#!/usr/bin/env node
// Część testów do równoległego przebiegu w CI (#341): node scripts/testy-czesc.cjs <nr> <ile>
// Pliki testów dzielone po kolei (posortowane) – każdy plik w dokładnie jednej części; uruchamia node --test.
const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const [nr, ile] = process.argv.slice(2).map(Number);
if (!(ile > 0) || !(nr >= 1 && nr <= ile)) { console.error('Użycie: node scripts/testy-czesc.cjs <nr> <ile>'); process.exit(2); }
const pliki = readdirSync(path.join(__dirname, '..', 'tests')).filter((f) => f.endsWith('.test.cjs')).sort()
  .filter((_, i) => i % ile === nr - 1).map((f) => `tests/${f}`);
console.log(`Część ${nr} z ${ile}: ${pliki.length} plików testów`);
const w = spawnSync(process.execPath, ['--test', '--test-concurrency=2', ...pliki], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
process.exit(w.status ?? 1);
