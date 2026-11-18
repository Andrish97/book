// Szablony projektów (#208): cały projekt naraz – zestaw sekcji z ustawieniami (osobno od szablonów sekcji).
// Każdy szablon buduje się bez błędów; książka w twardej oprawie ma okładkę twardą, wyklejki i blok z krotnością 16.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('szablony projektów: każdy buduje się, książka twarda – okładka, wyklejki, blok z krotnością 16', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona); // edytor (i biblioteka płótna) wczytany
  const wynik = await strona.evaluate(async () => {
    const m = await import('./js/szablony-projektow.js');
    const out = {};
    for (const s of m.SZABLONY_PROJEKTOW) {
      const p = await m.zbudujProjekt(s.id, { nazwa: s.nazwa });
      out[s.id] = {
        sekcje: p.sekcje.map((x) => `${x.typ}${x.skladka ? `/${x.skladka}` : ''}${x.okladka ? `:${x.okladka.oprawa}` : ''}`),
        stron: p.sekcje.map((x) => p.strony.filter((y) => y.sekcja === x.id).length),
        grzbiet: p.sekcje.find((x) => x.okladka)?.okladka?.wynik?.grzbiet ?? null,
      };
    }
    return out;
  });
  assert.deepEqual(wynik['ksiazka-twarda'].sekcje, ['okladka:twarda', 'wyklejka_przednia', 'blok/16', 'wyklejka_tylna']);
  assert.equal(wynik['ksiazka-twarda'].stron[2], 64);
  assert.ok(wynik['ksiazka-twarda'].grzbiet > 3, 'grzbiet z liczby stron');
  assert.deepEqual(wynik['ksiazka-twarda-obwoluta'].sekcje, ['okladka:twarda', 'obwoluta', 'wyklejka_przednia', 'blok/16', 'wyklejka_tylna']);
  assert.deepEqual(wynik['ksiazka-miekka'].sekcje, ['okladka:miekka', 'blok/16']);
  assert.deepEqual(wynik.broszura.sekcje, ['okladka:zeszytowa', 'blok/4']);
  assert.deepEqual(wynik['planer-twardy'].sekcje, ['okladka:twarda', 'wyklejka_przednia', 'blok', 'wyklejka_tylna']);
  assert.deepEqual(wynik['kalendarz-scienny-plecy'].sekcje, ['blok', 'podkladka']);
  for (const [id, w] of Object.entries(wynik)) assert.ok(w.stron.every((n) => n >= 1), `${id}: każda sekcja ma strony`);
  assert.deepEqual(bledy, []);
});
