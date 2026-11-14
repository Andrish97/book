// Marka (decyzja #88): nigdzie poza wyjątkami nie została widoczna stara nazwa ani stary adres aplikacji.
// Po scaleniu cudzych zmian: node scripts/marka.cjs (skrypt jest powtarzalny).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('marka: scripts/marka.cjs --sprawdz nie znajduje starej nazwy ani adresu', () => {
  const w = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'marka.cjs'), '--sprawdz'], { encoding: 'utf8' });
  assert.equal(w.status, 0, `${w.stdout}\n${w.stderr}`);
});
