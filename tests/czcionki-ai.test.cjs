// Czcionki dla AI (plan H6): lista w łączniku jest taka sama jak zestaw aplikacji (js/zestaw-czcionek.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('czcionki AI: lista w łączniku = zestaw czcionek aplikacji', async () => {
  const { ZESTAW } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'zestaw-czcionek.js')).href);
  const { CZCIONKI_MAKIETKI } = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs')).href);
  assert.deepEqual(CZCIONKI_MAKIETKI, ZESTAW.map((c) => [c.nazwa, c.rodzaj, c.pogrubiona ? 1 : 0, c.kursywa ? 1 : 0]),
    'po zmianie js/zestaw-czcionek.js przepisz listę CZCIONKI_MAKIETKI w rdzeniu łącznika');
});
