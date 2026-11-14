// Dostęp dla AI (ustawienia konta, #107): na wierzchu jedno polecenie „Podłącz Makietkę” do skopiowania (ten sam tekst
// co w instrukcji), przycisk pobrania rozszerzenia dla Claude Desktop i krótkie, zwinięte opisy aplikacji. Po
// utworzeniu klucza w poleceniu i w komendzie Claude Code jest prawdziwy adres łącznika.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, oknoAi } = require('./pomoc.cjs');

test('okno Dostęp dla AI: polecenie do skopiowania, rozszerzenie do pobrania, opisy aplikacji; adres wpisany po utworzeniu klucza', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await nowyProjekt(strona, 'Projekt AI');
  await oknoAi(strona);
  const przed = await strona.evaluate(() => ({
    polecenie: document.querySelector('#dostep-ai-polecenie').textContent,
    naWierzchu: document.querySelector('.dostep-ai-polecenie').textContent,
    widoczne: !!document.querySelector('#dostep-ai-polecenie').offsetParent,
    aplikacje: document.querySelector('#dostep-ai-aplikacje').textContent,
    zwiniete: !document.querySelector('#dostep-ai-aplikacje').open,
    code: document.querySelector('#dostep-ai-polecenie-code').textContent,
    mcpb: [document.querySelector('#dostep-ai-pobierz-mcpb').href, document.querySelector('#dostep-ai-pobierz-mcpb').hasAttribute('download')],
    inne: /Komiks|Kalendarz dni/.test(document.querySelector('#dlg-dostep-ai').textContent),
  }));
  assert.match(przed.naWierzchu, /Nie wiesz, jak podłączyć\? Skopiuj to polecenie i wklej swojemu AI – poprowadzi Cię\./);
  assert.ok(przed.widoczne, 'polecenie widać bez rozwijania');
  assert.ok(przed.zwiniete, 'opisy aplikacji zwinięte');
  assert.equal(przed.inne, false, 'w oknie nie ma poleceń „Komiks” ani „Kalendarz”');
  assert.deepEqual(przed.mcpb, ['https://makietka.app/ai/mcp/makietka.mcpb', true]);
  for (const s of ['Claude', 'Claude Desktop', 'Claude Code', 'ChatGPT', 'Ograniczenia']) assert.ok(przed.aplikacje.includes(s), s);
  assert.match(przed.code, /mcp\/<klucz>$/);
  // Ten sam tekst co w instrukcji.
  const zgodne = await strona.evaluate(async (tekst) => {
    const { ROZDZIAL_AI_START } = await import('./js/instrukcja-przewodnik.js');
    return ROZDZIAL_AI_START.prompty.some((p) => p.tekst === tekst);
  }, przed.polecenie);
  assert.equal(zgodne, true);
  await strona.click('[data-akcja="dostep-ai-kopiuj-polecenie"]');
  await strona.waitForTimeout(200);
  assert.equal(await strona.evaluate(() => navigator.clipboard.readText()), przed.polecenie);

  // Po utworzeniu klucza: polecenie i komenda z prawdziwym adresem, opisy aplikacji rozwinięte.
  await strona.click('[data-akcja="dostep-ai-utworz"]');
  await strona.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  const adres = await strona.inputValue('#dostep-ai-adres');
  assert.ok(await strona.evaluate(() => document.querySelector('#dostep-ai-aplikacje').open));
  assert.equal(await strona.textContent('#dostep-ai-polecenie-code'), `claude mcp add --transport http makietka ${adres}`);
  await strona.click('[data-akcja="dostep-ai-kopiuj-polecenie"]');
  await strona.waitForTimeout(200);
  const skopiowane = await strona.evaluate(() => navigator.clipboard.readText());
  assert.ok(skopiowane.includes(adres) && !skopiowane.includes('<klucz>'), 'adres z kluczem w poleceniu');
  // Po zamknięciu okna adres znika z polecenia.
  await strona.evaluate(async () => (await import('./js/app/dostep-ai.js')).zamknijDostepAi());
  await oknoAi(strona, { zaznacz: false });
  assert.match(await strona.textContent('#dostep-ai-polecenie-code'), /<klucz>$/);
  assert.ok((await strona.textContent('#dostep-ai-polecenie')).includes('<klucz>'));
  assert.deepEqual(bledy, []);
});
