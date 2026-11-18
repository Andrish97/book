// Ikony języków są wstawiane jako <img> – tam currentColor zawsze jest czarny, więc w ciemnym trybie tekst znikał
// (EN). Każda ikona musi mieć własne tło i tekst w stałym kolorze.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('ikony języków czytelne w jasnym i ciemnym trybie (bez currentColor w tekście, z tłem)', () => {
  const kat = path.join(__dirname, '..', 'img', 'jezyki');
  for (const f of fs.readdirSync(kat).filter((x) => x.endsWith('.svg'))) {
    const s = fs.readFileSync(path.join(kat, f), 'utf8');
    assert.doesNotMatch(s, /<text[^>]*fill="currentColor"/, `${f}: tekst w currentColor`);
    assert.match(s, /<rect[^>]*fill="#[0-9a-f]{6}"/i, `${f}: brak tła`);
  }
});
