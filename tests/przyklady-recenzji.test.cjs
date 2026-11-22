// Przykładowe projekty dla konta testowego recenzentów katalogu łączników Claude (plan I8,
// scripts/przyklady-recenzji.cjs): pliki .makietka otwierają się w aplikacji i mają spodziewaną treść.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('przykłady dla recenzentów: trzy pliki .makietka otwierają się w aplikacji', async (t) => {
  const { strona, bledy } = await otworz(t);
  const wynik = await strona.evaluate(async () => {
    const { wczytajPlikProjektu } = await import('./js/plik-projektu.js');
    const out = {};
    for (const n of ['wall-calendar-2027', 'comic-the-parcel', 'brochure-spring-fair']) {
      const blob = await (await fetch(`ai/przyklady/recenzja/${n}.makietka`)).blob();
      const p = await wczytajPlikProjektu(new File([blob], `${n}.makietka`));
      out[n] = { nazwa: p.nazwa, stron: p.strony.length, sekcje: p.sekcje.map((s) => s.nazwa), tabele: (p.tabele || []).map((x) => x.nazwa) };
    }
    return out;
  });
  assert.equal(wynik['wall-calendar-2027'].nazwa, 'Wall calendar 2027');
  assert.ok(wynik['wall-calendar-2027'].tabele.includes('Months 2027'));
  assert.equal(wynik['comic-the-parcel'].nazwa, 'Comic – The Parcel');
  assert.ok(wynik['comic-the-parcel'].tabele.includes('Script'));
  assert.ok(wynik['comic-the-parcel'].stron >= 8);
  assert.deepEqual(wynik['brochure-spring-fair'].sekcje, ['Saddle-stitched cover', 'Inside pages']);
  assert.deepEqual(bledy, []);
});
