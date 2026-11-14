const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { zbuduj, PLIK } = require('../scripts/instrukcja-md.cjs');

// ai/instrukcja.md to instrukcja z aplikacji w postaci dla AI – musi być taka sama jak js/instrukcja.js.
test('instrukcja dla AI (ai/instrukcja.md) jest aktualna i ma wszystkie rozdziały', async () => {
  const md = await zbuduj();
  const zapisany = fs.existsSync(PLIK) ? fs.readFileSync(PLIK, 'utf8') : '';
  assert.ok(zapisany === md, 'ai/instrukcja.md jest nieaktualny – uruchom: node scripts/instrukcja-md.cjs');
  const rozdzialy = md.match(/^## \d+\. .+$/gm) || [];
  assert.ok(rozdzialy.length >= 30, `rozdziałów: ${rozdzialy.length}`);
  // Bez znaczników HTML poza komentarzem o pochodzeniu pliku i blokami poleceń dla AI (tam <klucz> to miejsce do wpisania).
  assert.deepEqual(md.replace(/<!--[\s\S]*?-->/g, '').replace(/```text\n[\s\S]*?\n```/g, '').match(/<\/?[a-z][^>]*>/gi) || [], []);
  // Zrzuty wskazują istniejące pliki.
  for (const [, plik] of md.matchAll(/\(https:\/\/makietka\.app\/(img\/instrukcja\/[^)]+)\)/g)) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', plik)), `brak pliku ${plik}`);
  }
  // llms.txt prowadzi do obu dokumentów dla AI, a pliki istnieją.
  const llms = fs.readFileSync(path.join(__dirname, '..', 'llms.txt'), 'utf8');
  for (const plik of ['ai/instrukcja.md', 'ai/format-makietka.md', 'ai/przyklady/kalendarz.json']) {
    assert.ok(llms.includes(`https://makietka.app/${plik}`), `llms.txt bez ${plik}`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', plik)), `brak ${plik}`);
  }
});
