// Panel administratora → „Zapisy i kopie” (#138): dziennik zapisów (kto: urządzenie / AI / przywrócenie, wersje,
// zmienione i usunięte strony), filtr projektu i przywrócenie stanu sprzed zapisu. Same kopie i dziennik robią
// wyzwalacze w bazie (migracja 20261116190000_kopie_awaryjne.sql – sprawdzona na Postgresie); tu – panel.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('panel administratora: dziennik zapisów z AI i urządzenia, filtr projektu, przywrócenie stanu sprzed zapisu', async (t) => {
  const { strona, baza, kontekst, bledy } = await otworz(t);
  baza.administratorzy.add(baza.konta[0].id);
  const wywolania = [];
  const wiersze = [
    { id: 2, projekt_id: 'p-1', projekt: 'Dziennik 2027', wlasciciel: 'ja@x.pl', wersja_przed: 7, wersja_po: 8, kto: 'urządzenie', uzytkownik: 'ja@x.pl', kiedy: new Date().toISOString(), strony_zmienione: 1, strony_usuniete: 1, kopia: 22 },
    { id: 1, projekt_id: 'p-1', projekt: 'Dziennik 2027', wlasciciel: 'ja@x.pl', wersja_przed: 6, wersja_po: 7, kto: 'AI', uzytkownik: null, kiedy: new Date().toISOString(), strony_zmienione: 3, strony_usuniete: 0, kopia: 21 },
  ];
  await kontekst.route('**/rest/v1/rpc/admin_dziennik_zapisow', (r) => {
    wywolania.push(['dziennik', JSON.parse(r.request().postData() || '{}')]);
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(wiersze) });
  });
  await kontekst.route('**/rest/v1/rpc/admin_przywroc_kopie', (r) => {
    wywolania.push(['przywroc', JSON.parse(r.request().postData() || '{}')]);
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, strony: 2, wersja: 9 }) });
  });
  await strona.reload();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await strona.evaluate(() => { location.hash = '#/admin/zapisy'; });
  await strona.waitForSelector('#admin-zapisy table');
  const tekst = await strona.textContent('#admin-zapisy');
  assert.match(tekst, /Urządzenie/);
  assert.match(tekst, /AI \(łącznik\)/);
  assert.match(tekst, /7 → 8/);
  assert.match(tekst, /1 zm\., 1 usun\./);
  // Filtr projektu.
  await strona.click('[data-filtr-projektu="p-1"]');
  await strona.waitForFunction(() => document.querySelector('#admin-zapisy-projekt').value === 'p-1');
  await strona.waitForFunction(() => document.querySelector('#admin-zapisy table'));
  assert.ok(wywolania.some(([n, p]) => n === 'dziennik' && p.p_projekt === 'p-1'));
  // Przywrócenie stanu sprzed zapisu urządzenia (kopia 22) – z potwierdzeniem.
  await strona.click('[data-przywroc="22"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => /Przywrócono/.test(document.querySelector('#powiadomienie')?.textContent || ''));
  assert.deepEqual(wywolania.find(([n]) => n === 'przywroc')[1], { p_kopia: 22 });
  assert.deepEqual(bledy, []);
});
