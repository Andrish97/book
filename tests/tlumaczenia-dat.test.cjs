// #409 (zamknięcie): nazwy miesięcy i dni w kalendarzach, planerach i wyborze daty, polecenia dla zewnętrznego AI
// i komunikaty limitów z bazy – w języku interfejsu. Stare kalendarze (bez pola jezyk) zostają po polsku.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('po angielsku: kalendarz, dane serii, polecenia AI i limity bez polskich słów', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => localStorage.setItem('makietka-jezyk', 'en'));
  await strona.reload();
  await strona.waitForFunction(() => document.documentElement.lang === 'en');
  await nowyProjekt(strona); // edytor wczytuje fabric (kalendarz to tabela)
  const w = await strona.evaluate(async () => {
    const { nowyKalendarz, opisMiesiaca: tytulMiesiaca } = await import('./js/kalendarz-miesiaca.js');
    const { wierszeKalendarza } = await import('./js/sekcje-specjalne.js');
    const { polecenieZAdresem } = await import('./js/polecenia-ai.js');
    const { polecenieZwyklegoCzatu } = await import('./js/app/dostep-ai.js');
    const { komunikatBledu } = await import('./js/chmura.js');
    const g = nowyKalendarz({ rok: 2027, miesiac: 3 }, (() => { let i = 0; return () => `t${i += 1}`; })());
    const teksty = (g._objects || g.getObjects()).flatMap((o) => (o.getObjects ? o.getObjects() : [o])).map((o) => o.text).filter(Boolean);
    return {
      jezyk: g.kalendarz.jezyk,
      tytul: teksty.find((x) => /2027/.test(x)),
      naglowki: teksty.filter((x) => /^[A-Z][a-z]+$/.test(x)).slice(0, 7),
      stary: tytulMiesiaca(2027, 3),
      dzien: wierszeKalendarza({ rok: 2027, jednostka: 'dzien', pierwszy: 'pn', swieta: 'brak', jezyk: 'en' })[0],
      tydzien: wierszeKalendarza({ rok: 2027, jednostka: 'tydzien', pierwszy: 'pn', swieta: 'brak', jezyk: 'uk' })[1],
      staraSekcja: wierszeKalendarza({ rok: 2027, jednostka: 'miesiac', pierwszy: 'pn', swieta: 'brak' })[0][1],
      polecenie: polecenieZAdresem('', 'en'),
      zwykly: polecenieZwyklegoCzatu('https://x.test/a'),
      limit: komunikatBledu({ message: 'limit_projektow: Masz już 50 projektów – to limit jednego konta.' }),
      osoby: komunikatBledu({ message: 'limit_osob: W projekcie jest już 10 osób razem z zaproszonymi – to limit.' }),
    };
  });
  assert.equal(w.jezyk, 'en');
  assert.match(w.tytul, /^March 2027$/);
  assert.equal(w.stary, 'Marzec 2027', 'kalendarz bez języka – po polsku jak dotąd');
  assert.deepEqual(w.dzien.slice(1, 4), ['1', 'January', 'January']);
  assert.equal(w.dzien[6], 'Friday');
  assert.match(w.tydzien[2], /січня/);
  assert.equal(w.staraSekcja, 'Styczeń');
  assert.match(w.polecenie, /^Help me connect Makietka/);
  assert.match(w.polecenie, /list_projects/);
  assert.match(w.zwykly, /^You are working with my project/);
  assert.equal((w.zwykly.match(/https:\/\/x\.test\/a/g) || []).length, 5);
  assert.equal(w.limit, "You already have 50 projects – that is the limit for one account. Delete a project you don't need, or export it to a file, to create a new one.");
  assert.match(w.osoby, /^The project already has 10 people including invitations/);
  assert.doesNotMatch(JSON.stringify([w.tytul, w.dzien, w.polecenie, w.zwykly, w.limit, w.osoby]), /[ąćęłńśźż]/);
  assert.deepEqual(bledy, []);
});
