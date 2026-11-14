// Dostęp dla AI (ustawienia konta, #107): jak podłączyć w aplikacjach i gotowe polecenia z „Kopiuj” – te same
// teksty co w instrukcji; po utworzeniu klucza w poleceniu „Podłącz Makietkę” i w komendzie Claude Code jest
// prawdziwy adres łącznika.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, oknoAi } = require('./pomoc.cjs');

test('okno Dostęp dla AI: aplikacje, ograniczenia i trzy polecenia z kopiowaniem; adres wpisany po utworzeniu klucza', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await nowyProjekt(strona, 'Projekt AI');
  await oknoAi(strona);
  const przed = await strona.evaluate(() => ({
    tytuly: [...document.querySelectorAll('#dostep-ai-lista-polecen .prompt-naglowek b')].map((x) => x.textContent),
    aplikacje: document.querySelector('#dostep-ai-aplikacje').textContent,
    code: document.querySelector('#dostep-ai-polecenie-code').textContent,
  }));
  assert.deepEqual(przed.tytuly, ['Podłącz Makietkę', 'Komiks do druku', 'Kalendarz dni z tabelą']);
  for (const s of ['Claude', 'Claude Desktop', 'makietka.mcpb', 'Claude Code', 'ChatGPT', 'Ograniczenia']) assert.ok(przed.aplikacje.includes(s), s);
  assert.match(przed.code, /mcp\/<klucz>$/);
  // Te same teksty co w instrukcji.
  const zgodne = await strona.evaluate(async () => {
    const { ROZDZIAL_AI_START } = await import('./js/instrukcja-przewodnik.js');
    const { PROMPT_PODLACZENIE } = await import('./js/polecenia-ai.js');
    return ROZDZIAL_AI_START.prompty.some((p) => p.tekst === PROMPT_PODLACZENIE);
  });
  assert.equal(zgodne, true);
  await strona.evaluate(() => { document.querySelector('#dostep-ai-polecenia').open = true; });
  await strona.click('[data-kopiuj-polecenie-ai="komiks"]');
  await strona.waitForTimeout(200);
  assert.match(await strona.evaluate(() => navigator.clipboard.readText()), /komiks do druku/);

  // Po utworzeniu klucza: polecenie „Podłącz” i komenda z prawdziwym adresem, sekcja aplikacji rozwinięta.
  await strona.click('[data-akcja="dostep-ai-utworz"]');
  await strona.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  const adres = await strona.inputValue('#dostep-ai-adres');
  assert.ok(await strona.evaluate(() => document.querySelector('#dostep-ai-aplikacje').open));
  assert.equal(await strona.textContent('#dostep-ai-polecenie-code'), `claude mcp add --transport http makietka ${adres}`);
  await strona.click('[data-kopiuj-polecenie-ai="podlacz"]');
  await strona.waitForTimeout(200);
  const skopiowane = await strona.evaluate(() => navigator.clipboard.readText());
  assert.ok(skopiowane.includes(adres) && !skopiowane.includes('<klucz>'), 'adres z kluczem w poleceniu');
  // Po zamknięciu okna adres znika z poleceń.
  await strona.evaluate(async () => (await import('./js/app/dostep-ai.js')).zamknijDostepAi());
  await oknoAi(strona, { zaznacz: false });
  assert.match(await strona.textContent('#dostep-ai-polecenie-code'), /<klucz>$/);
  assert.deepEqual(bledy, []);
});
