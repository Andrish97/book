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
  const kopie = { kopie: 120, strony: 900, dziennik: 130, starsze_14: 40, usuniete_projekty: 2, najstarsza: new Date(Date.now() - 40 * 864e5).toISOString(), rozmiar: 52 * 1024 * 1024 };
  await kontekst.route('**/rest/v1/rpc/admin_kopie_stan', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(kopie) }));
  await kontekst.route('**/rest/v1/rpc/admin_kopie_wyczysc', (r) => {
    wywolania.push(['wyczysc', JSON.parse(r.request().postData() || '{}')]);
    Object.assign(kopie, { kopie: 80, strony: 600, starsze_14: 0 });
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ kopie: 40, strony: 300, dziennik: 30 }) });
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
  // Tabela zostaje z poprzedniego wczytania – czekamy na samo zapytanie z filtrem, nie na tabelę (#184).
  for (let i = 0; i < 300 && !wywolania.some(([n, p]) => n === 'dziennik' && p.p_projekt === 'p-1'); i += 1) await strona.waitForTimeout(100);
  assert.ok(wywolania.some(([n, p]) => n === 'dziennik' && p.p_projekt === 'p-1'));
  await strona.waitForFunction(() => document.querySelector('#admin-zapisy table'));
  // Przywrócenie stanu sprzed zapisu urządzenia (kopia 22) – z potwierdzeniem.
  await strona.click('[data-przywroc="22"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => /Przywrócono/.test(document.querySelector('#powiadomienie')?.textContent || ''));
  assert.deepEqual(wywolania.find(([n]) => n === 'przywroc')[1], { p_kopia: 22 });

  // Sprzątanie kopii (#207): stan wszystkich kopii i usunięcie starszych niż wybrana liczba dni – z potwierdzeniem.
  await strona.waitForFunction(() => /Kopie: 120 zapisów/.test(document.querySelector('#admin-kopie-opis').textContent));
  assert.match(await strona.textContent('#admin-kopie-opis'), /52\.0 MB.*starszych niż 14 dni: 40.*z usuniętych projektów: 2/);
  await strona.selectOption('#admin-kopie-dni', '30');
  await strona.click('#admin-kopie-wyczysc');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => /Usunięto kopie: 40 zapisów/.test(document.querySelector('#powiadomienie')?.textContent || ''));
  assert.deepEqual(wywolania.find(([n]) => n === 'wyczysc')[1], { p_dni: 30 });
  await strona.waitForFunction(() => /Kopie: 80 zapisów/.test(document.querySelector('#admin-kopie-opis').textContent));
  assert.deepEqual(bledy, []);
});
