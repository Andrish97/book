// Opis formatu dla AI (ai/format-makietka.md, narzędzie opis_formatu) musi nadążać za aplikacją (#142):
// każde pole elementu z WLASNE_POLA i każde pole projektu, sekcji i strony z nowego projektu jest w nim opisane.
// Nieaktualny opis sprawiał, że AI zapisywało pola po swojemu (#141).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const opis = fs.readFileSync(path.join(__dirname, '..', 'ai', 'format-makietka.md'), 'utf8');
const jest = (pole) => opis.includes(`\`${pole}\``) || opis.includes(`"${pole}"`);

test('opis formatu dla AI zna wszystkie pola elementów (WLASNE_POLA)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'fabric-ustawienia.js'), 'utf8');
  const blok = src.slice(src.indexOf('WLASNE_POLA'), src.indexOf('];', src.indexOf('WLASNE_POLA')));
  const pola = [...blok.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(pola.length > 30);
  assert.deepEqual(pola.filter((p) => !jest(p)), [], 'dopisz te pola do ai/format-makietka.md');
});

test('opis formatu dla AI zna pola projektu, sekcji i strony', async () => {
  const P = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'projekt.js')).href);
  const p = P.normalizuj(P.nowyProjekt('x'));
  const brak = [...Object.keys(p).map((k) => `projekt.${k}`), ...Object.keys(p.sekcje[0]).map((k) => `sekcja.${k}`), ...Object.keys(p.strony[0]).map((k) => `strona.${k}`)]
    .filter((k) => !jest(k.split('.')[1]));
  assert.deepEqual(brak, [], 'dopisz te pola do ai/format-makietka.md');
});
