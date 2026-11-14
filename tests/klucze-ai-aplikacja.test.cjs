// Klucze AI konta w aplikacji (decyzja #94): okno z ustawień konta (bez edytora), nowy projekt od AI pojawia się
// na liście na żywo, usunięty przez AI – znika z listy, a otwarty zamyka się z wyjaśnieniem.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const RDZEN = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs');
const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

// Prawdziwy rdzeń łącznika podpięty do atrapy bazy otwartej strony.
async function lacznik(t, baza, klucz) {
  const serwer = http.createServer((req, res) => {
    let tresc = '';
    req.on('data', (c) => { tresc += c; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      try { res.end(JSON.stringify(baza.ai(req.url.replace('/rest/v1/rpc/', ''), JSON.parse(tresc || '{}')) ?? null)); } catch (e) { res.statusCode = e.status || 400; res.end(JSON.stringify({ message: e.message })); }
    });
  });
  await new Promise((r) => { serwer.listen(0, '127.0.0.1', r); });
  t.after(() => serwer.close());
  const { utworzSerwer } = await import(pathToFileURL(RDZEN).href);
  const s = utworzSerwer({ adres: `http://127.0.0.1:${serwer.address().port}`, kluczPubliczny: 'sb_publishable_test', klucz });
  return async (name, args = {}) => {
    const w = await s.obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
    if (w.result.isError) throw new Error(`${name}: ${w.result.content[0].text}`);
    return w.result.content[0].text;
  };
}

test('ustawienia konta → Dostęp dla AI: klucz z pełnym dostępem; AI tworzy projekt (lista na żywo) i usuwa otwarty projekt', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Pierwszy');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await zapisano(strona);
  const idPierwszego = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  for (let i = 0; i < 60 && !baza.projekty.some((p) => p.id === idPierwszego); i += 1) await strona.waitForTimeout(250);
  // Lista projektów, potem ustawienia konta – okno kluczy działa bez edytora.
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await strona.evaluate(() => { location.hash = '#/konto'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'konto');
  await strona.waitForFunction(() => /Nie masz jeszcze żadnego klucza/.test(document.querySelector('#ust-ai-opis').textContent));
  await strona.click('[data-akcja="konto-dostep-ai"]');
  await strona.waitForSelector('#dlg-dostep-ai[open]');
  await strona.waitForFunction(() => document.querySelectorAll('#dostep-ai-projekty input').length === 1);
  assert.equal(await strona.locator('#dostep-ai-projekty input:checked').count(), 0, 'z ustawień konta nic nie jest zaznaczone z góry');
  await strona.check('#dostep-ai-nowy input[value="pelny"]');
  assert.equal(await strona.isVisible('#dostep-ai-projekty'), false, 'przy pełnym dostępie lista projektów znika');
  await strona.selectOption('#dostep-ai-dni', 'bez');
  await strona.fill('#dostep-ai-opis', 'Claude – całe konto');
  await strona.click('[data-akcja="dostep-ai-utworz"]');
  await strona.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  const klucz = await strona.inputValue('#dostep-ai-klucz');
  await strona.waitForFunction(() => /pełny dostęp.*bez terminu/s.test(document.querySelector('#dostep-ai-lista').textContent));
  await strona.click('[data-akcja="dostep-ai-zamknij"]');
  await strona.waitForFunction(() => /Aktywne klucze: 1 – „Claude – całe konto” \(pełny dostęp\)/.test(document.querySelector('#ust-ai-opis').textContent));

  // AI tworzy projekt – lista projektów pokazuje go sama.
  const ai = await lacznik(t, baza, klucz);
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  const wynik = await ai('nowy_projekt', { nazwa: 'Od AI', format: 'A4' });
  const idNowego = /\(id ([0-9a-f-]{36})\)/.exec(wynik)[1];
  await strona.waitForFunction(() => [...document.querySelectorAll('#siatka-projektow .karta-projektu')].some((k) => /Od AI/.test(k.textContent)), null, { timeout: 15000 });

  // Otwarty projekt usunięty przez AI: edytor zamyka się bez zapisu (projekt nie wraca na konto) z wyjaśnieniem.
  await strona.evaluate((id) => { location.hash = `#/p/${id}`; }, idPierwszego);
  await strona.waitForFunction(() => document.body.dataset.ekran === 'edytor');
  await ai('usun_projekt', { projekt: idPierwszego, potwierdz: 'Pierwszy' });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty', null, { timeout: 15000 });
  await strona.waitForFunction(() => /usunięty z konta/.test(document.body.textContent));
  await strona.waitForTimeout(2500);
  assert.ok(!baza.projekty.some((p) => p.id === idPierwszego), 'zamknięty edytor nie zapisał projektu od nowa');
  await strona.waitForFunction(() => ![...document.querySelectorAll('#siatka-projektow .karta-projektu')].some((k) => /Pierwszy/.test(k.textContent)));
  // Po odświeżeniu listy usunięty projekt nie wraca z kopii na urządzeniu.
  await strona.reload();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await strona.waitForFunction(() => [...document.querySelectorAll('#siatka-projektow .karta-projektu')].some((k) => /Od AI/.test(k.textContent)));
  assert.ok(!(await strona.textContent('#siatka-projektow')).includes('Pierwszy'));
  assert.ok(baza.projekty.some((p) => p.id === idNowego));
  assert.deepEqual(bledy, []);
});
