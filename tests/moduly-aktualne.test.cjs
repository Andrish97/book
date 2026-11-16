// Lista modułów do równoległego pobrania (#158, scripts/moduly-buduj.cjs) musi odpowiadać importom –
// inaczej nowy moduł pobierałby się dopiero poziom po poziomie, a usunięty dawałby błąd 404 przy starcie.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('lista modułów startu i edytora jest aktualna (node scripts/moduly-buduj.cjs)', () => {
  const wynik = execFileSync('node', [path.join(__dirname, '..', 'scripts', 'moduly-buduj.cjs'), '--sprawdz'], { encoding: 'utf8' });
  assert.match(wynik, /aktualna/);
});
