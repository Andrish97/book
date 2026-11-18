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
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await strona.evaluate(() => { location.hash = '#/konto/ai'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'konto');
  await strona.waitForFunction(() => /Nie masz jeszcze żadnego klucza/.test(document.querySelector('#ust-ai-opis').textContent));
  // #247: panel wprost w sekcji ustawień – bez przycisku „Zarządzaj…” i bez osobnego okna.
  assert.equal(await strona.locator('[data-akcja="konto-dostep-ai"]').count(), 0);
  await strona.waitForSelector('#ust-ai #dostep-ai [data-tryb-ai="wybor"]');
  assert.equal(await strona.isVisible('#dlg-dostep-ai'), false);
  // #248: lista „Twoje klucze” i „Dodaj klucz” → wybór rodzaju → formularz.
  assert.equal(await strona.getAttribute('#dostep-ai', 'data-tryb'), 'lista');
  assert.equal(await strona.isVisible('#dostep-ai-pusto'), true);
  assert.equal(await strona.isVisible('#dostep-ai-nowy'), false);
  await strona.click('#dostep-ai [data-tryb-ai="wybor"]');
  assert.equal(await strona.locator('#dostep-ai .karta-wyboru:visible').count(), 3);
  await strona.click('.karta-wyboru[data-tryb-ai="lacznik"]');
  assert.match(await strona.textContent('#dostep-ai .uwaga-planu'), /płatnego planu/);
  await strona.waitForFunction(() => document.querySelectorAll('#dostep-ai-projekty input').length === 1);
  assert.equal(await strona.locator('#dostep-ai-projekty input:checked').count(), 0, 'z ustawień konta nic nie jest zaznaczone z góry');
  await strona.check('#dostep-ai-nowy input[value="pelny"]');
  assert.equal(await strona.isVisible('#dostep-ai-projekty'), false, 'przy pełnym dostępie lista projektów znika');
  await strona.selectOption('#dostep-ai-dni', 'bez');
  await strona.fill('#dostep-ai-opis', 'Claude – całe konto');
  await strona.click('[data-akcja="dostep-ai-utworz"]');
  await strona.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  const klucz = await strona.inputValue('#dostep-ai-klucz');
  await strona.click('#dostep-ai-gotowy [data-tryb-ai="lista"]');
  await strona.waitForFunction(() => /pełny dostęp.*bez terminu/s.test(document.querySelector('#dostep-ai-lista').textContent));
  assert.equal(await strona.isVisible('#dostep-ai-lista'), true, 'nowy klucz na liście „Twoje klucze”');
  assert.equal(await strona.isVisible('#dostep-ai-pusto'), false);
  await strona.waitForFunction(() => /Aktywne klucze: 1 – „Claude – całe konto” \(pełny dostęp\)/.test(document.querySelector('#ust-ai-opis').textContent));

  // AI tworzy projekt – lista projektów pokazuje go sama.
  const ai = await lacznik(t, baza, klucz);
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
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
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await strona.waitForFunction(() => [...document.querySelectorAll('#siatka-projektow .karta-projektu')].some((k) => /Od AI/.test(k.textContent)));
  assert.ok(!(await strona.textContent('#siatka-projektow')).includes('Pierwszy'));
  assert.ok(baza.projekty.some((p) => p.id === idNowego));
  assert.deepEqual(bledy, []);
});

// #243: zakładka „Czat w Makietce” – klucze dostawców w sejfie (hasło do kluczy), stan każdego dostawcy, usunięcie.
test('okno Sztuczna inteligencja: zakładki, klucz dostawcy zapisany w sejfie z okna konta', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Klucze');
  await strona.evaluate(async () => (await import('./js/app/dostep-ai.js')).otworzDostepAi());
  await strona.waitForSelector('#dlg-dostep-ai[open]');
  await strona.click('#dostep-ai [data-tryb-ai="wybor"]');
  await strona.click('.karta-wyboru[data-tryb-ai="czat"]');
  assert.match(await strona.textContent('#dlg-dostep-ai'), /także twórca Makietki/);
  await strona.selectOption('#ai-nowy-dostawca', 'anthropic');
  assert.equal(await strona.isVisible('#ai-nowy-gdzie'), true);
  await strona.fill('#ai-nowy-klucz', 'sk-ant-z-okna-1234');
  await strona.click('[data-akcja="ai-zapisz-klucz-dostawcy"]');
  await strona.waitForSelector('#dlg-sejf-ai[open]');
  await strona.fill('#dlg-sejf-ai [name="haslo"]', 'haslo-do-kluczy');
  await strona.fill('#dlg-sejf-ai [name="powtorz"]', 'haslo-do-kluczy');
  await strona.click('#dlg-sejf-ai button[value="tak"]');
  await strona.waitForFunction(() => document.querySelector('#dostep-ai').dataset.tryb === 'lista' && /zaszyfrowany \(…1234\)/.test([...document.querySelectorAll('#ai-dostawcy-lista li')].find((li) => li.textContent.includes('Anthropic'))?.textContent || ''));
  assert.equal(await strona.locator('#ai-dostawcy-lista li').count(), 1, 'na liście tylko zapisane klucze');
  assert.ok(!JSON.stringify([...baza.sejfy.values()]).includes('sk-ant-z-okna'), 'na koncie szyfrogram');
  // Zwykły czat: formularz klucza i opis, bez uwagi o płatnym planie i bez listy kluczy.
  await strona.click('#dostep-ai [data-tryb-ai="wybor"]');
  await strona.click('.karta-wyboru[data-tryb-ai="zwykly"]');
  assert.equal(await strona.isVisible('#dostep-ai-nowy'), true);
  assert.equal(await strona.isVisible('#dlg-dostep-ai .uwaga-planu'), false);
  assert.equal(await strona.isVisible('#ai-dostawcy-lista'), false);
  assert.deepEqual(bledy, []);
});
