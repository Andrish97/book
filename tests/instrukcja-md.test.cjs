const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { zbuduj, PLIK_JS, PLIK_MD } = require('../scripts/instrukcja-buduj.cjs');

// Instrukcja (#114): źródło docs/instrukcja/*.md → js/instrukcja-tresc.js (aplikacja) i ai/instrukcja.md (AI).
test('instrukcja: pliki zbudowane z docs/instrukcja są aktualne, ai/instrukcja.md ma wszystkie rozdziały', async () => {
  const { js, md } = await zbuduj();
  assert.ok(fs.readFileSync(PLIK_JS, 'utf8') === js, 'js/instrukcja-tresc.js jest nieaktualny – uruchom: node scripts/instrukcja-buduj.cjs');
  assert.ok(fs.readFileSync(PLIK_MD, 'utf8') === md, 'ai/instrukcja.md jest nieaktualny – uruchom: node scripts/instrukcja-buduj.cjs');
  const rozdzialy = md.match(/^## \d+\. .+$/gm) || [];
  assert.ok(rozdzialy.length >= 25, `rozdziałów: ${rozdzialy.length}`);
  assert.ok((md.match(/^### \d+\.\d+ .+$/gm) || []).length >= 120, 'podrozdziały');
  // Bez znaczników HTML poza komentarzem o pochodzeniu pliku i blokami poleceń dla AI (tam <klucz> to miejsce do wpisania).
  assert.deepEqual(md.replace(/<!--[\s\S]*?-->/g, '').replace(/```text\n[\s\S]*?\n```/g, '').match(/<\/?[a-z][^>]*>/gi) || [], []);
  // Zrzuty wskazują istniejące pliki – jasne i ciemne.
  for (const [, plik] of md.matchAll(/\(https:\/\/makietka\.app\/(img\/instrukcja\/[^)]+)\)/g)) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', plik)), `brak pliku ${plik}`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', plik.replace('img/instrukcja/', 'img/instrukcja/ciemny/'))), `brak ciemnego ${plik}`);
  }
  // Treść bez technicznych szczegółów, które nic nie mówią użytkownikowi (#114).
  for (const zakazane of [/pobierają się przy pierwszym użyciu/i, /magazyn/i, /pamięci podręcznej|cache/i, /Supabase/, /Zajmie około/i]) {
    assert.doesNotMatch(md, zakazane);
  }
  // llms.txt prowadzi do obu dokumentów dla AI, a pliki istnieją.
  const llms = fs.readFileSync(path.join(__dirname, '..', 'llms.txt'), 'utf8');
  for (const plik of ['ai/instrukcja.md', 'ai/format-makietka.md', 'ai/przyklady/kalendarz.json']) {
    assert.ok(llms.includes(`https://makietka.app/${plik}`), `llms.txt bez ${plik}`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', plik)), `brak ${plik}`);
  }
});
