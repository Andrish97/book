// Łącznik z logowaniem (#244): aplikacja AI przysyła użytkownika na #/polacz-ai/<id> – strona zgody pokazuje,
// kto prosi; „Zezwól” z wybranym projektem tworzy klucz (widoczny w ustawieniach konta) i wraca do aplikacji AI
// z jednorazowym kodem i stanem; „Odmów” wraca z error=access_denied.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('strona zgody łącznika: kto prosi, wybór projektu, Zezwól → powrót z kodem; Odmów → access_denied', async (t) => {
  const { strona, kontekst, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz dla AI');
  await strona.waitForFunction(() => document.querySelector('#stan-zapisu')?.textContent === 'Zapisano', null, { timeout: 15000 });
  await kontekst.route('https://claude.ai/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>powrót</p>' }));
  const { client_id: klient } = baza.ai('oauth_rejestruj', { p_nazwa: 'Claude', p_adresy: ['https://claude.ai/api/mcp/auth_callback'] });
  const wyzwanie = crypto.createHash('sha256').update('w'.repeat(50)).digest('base64url');
  const zadanie = () => baza.ai('oauth_rozpocznij', { p_klient: klient, p_adres: 'https://claude.ai/api/mcp/auth_callback', p_wyzwanie: wyzwanie, p_stan: 'xyz' });
  const id = zadanie();
  await strona.evaluate((i) => { location.hash = `#/polacz-ai/${i}`; }, id);
  await strona.waitForSelector('#dlg-polacz-ai[open]');
  assert.match(await strona.textContent('#dlg-polacz-ai .polacz-kto'), /„Claude” \(claude\.ai\) prosi o dostęp/);
  await strona.waitForSelector('#dlg-polacz-ai .polacz-projekty input');
  await strona.check('#dlg-polacz-ai .polacz-projekty input');
  await Promise.all([strona.waitForURL(/^https:\/\/claude\.ai\//), strona.click('#dlg-polacz-ai button[value="tak"]')]);
  const powrot = new URL(strona.url());
  assert.equal(powrot.searchParams.get('state'), 'xyz');
  assert.ok(powrot.searchParams.get('code'), 'jednorazowy kod');
  const klucz = baza.dostepy.at(-1);
  assert.deepEqual([klucz.opis, klucz.rola, klucz.zakres, klucz.projekty.length], ['Łącznik: Claude', 'edycja', 'wybrane', 1]);
  // Odmowa.
  await strona.goBack();
  await strona.waitForFunction(() => window.seriodruk?.stan?.uzytkownik);
  const id2 = zadanie();
  await strona.evaluate((i) => { location.hash = `#/polacz-ai/${i}`; }, id2);
  await strona.waitForSelector('#dlg-polacz-ai[open]');
  await Promise.all([strona.waitForURL(/error=access_denied/), strona.click('#dlg-polacz-ai button[value="nie"]')]);
  assert.equal(new URL(strona.url()).searchParams.get('state'), 'xyz');
  assert.deepEqual(bledy.filter((b) => !/claude\.ai/.test(b)), []);
});
