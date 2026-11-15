// Zmiana strony bez stanów pośrednich (#149): na czas wczytywania nad płótnem leży zamrożony obraz
// poprzedniej strony, który znika dopiero po narysowaniu nowej; płótno nie jest czyszczone przez ponowne
// ustawienie tego samego rozmiaru.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('telefon: przejście na następną stronę – zamrożony obraz do końca rysowania, bez zbędnego setDimensions', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Zmiana');
  const wynik = await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    p.strony.push(P.nowaStrona('Strona 2', p.sekcje[0].id));
    const c = window.seriodruk.edytor.canvas;
    let wymiary = 0;
    const sd = c.setDimensions;
    c.setDimensions = function (...a) { wymiary += 1; return sd.apply(this, a); };
    const { przejdzDoStrony } = await import('./js/app/lista-stron.js');
    const obietnica = przejdzDoStrony(1);
    const wTrakcie = !!document.querySelector('.zamrozony-obraz');
    await obietnica;
    const poWczytaniu = !!document.querySelector('.zamrozony-obraz');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
    const naKoniec = !!document.querySelector('.zamrozony-obraz');
    delete c.setDimensions;
    return { wTrakcie, poWczytaniu, naKoniec, wymiary, indeks: window.seriodruk.stan.indeks };
  });
  assert.equal(wynik.indeks, 1);
  assert.ok(wynik.wTrakcie, 'obraz poprzedniej strony od początku wczytywania');
  assert.ok(wynik.poWczytaniu, 'obraz jeszcze leży, gdy płótno dopiero pokazuje nową stronę');
  assert.ok(!wynik.naKoniec, 'po narysowaniu obraz znika');
  assert.equal(wynik.wymiary, 0, 'ten sam rozmiar strony – płótno nie jest czyszczone');
  assert.deepEqual(bledy, []);
});
