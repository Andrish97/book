// Moduły zależne od siebie pośrednio (okladka → serie → projekt → sekcje-specjalne → okladka) muszą dać się
// wczytać w każdej kolejności – rejestr przeliczeń w module wczytywanym później był niezainicjowany (#179).
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

for (const kolejnosc of [['okladka', 'sekcje-specjalne'], ['sekcje-specjalne', 'okladka'], ['projekt', 'okladka'], ['serie', 'sekcje-specjalne']]) {
  test(`import: ${kolejnosc.join(' → ')}`, () => {
    const kod = `for (const m of ${JSON.stringify(kolejnosc)}) await import('./js/' + m + '.js'); console.log('OK');`;
    const wynik = execFileSync(process.execPath, ['--input-type=module', '-e', kod], { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.match(wynik, /OK/);
  });
}
