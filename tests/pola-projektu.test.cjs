// Pola z ustawień projektu (#209): format, oprawa, grzbiet, liczba stron bloku, papier, rok kalendarza – wartości
// biorą się z sekcji i okładki (bez nowych ustawień) i są na liście „Wstaw pole”.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('pola z ustawień projektu: format, oprawa, grzbiet, stron bloku, papier, rok kalendarza', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona);
  const w = await strona.evaluate(async () => {
    const { zbudujProjekt } = await import('./js/szablony-projektow.js');
    const { rozwin, wartosciPol } = await import('./js/serie.js');
    const { POLA_DOKUMENTU } = await import('./js/pola.js');
    const p = await zbudujProjekt('ksiazka-twarda', { nazwa: 'K', odpowiedzi: { stron: '96' } });
    const ciag = rozwin(p);
    const blok = p.sekcje.find((s) => s.typ === 'blok');
    const egz = ciag.egzemplarze.find((e) => e.sekcja.id === blok.id);
    const f = wartosciPol(p, egz, ciag);
    const kal = await zbudujProjekt('kalendarz-scienny-plecy', { nazwa: 'Kal' });
    kal.sekcje.push({ ...kal.sekcje[0], id: 'sek_kal', typ: 'kalendarz', specjalna: { rodzaj: 'kalendarz', rok: 2028 } });
    const ck = rozwin(kal);
    return {
      format: f('format'), oprawa: f('oprawa'), grzbiet: f('grzbiet'), stron: f('stron_bloku'), papier: f('papier'),
      rok: f('rok_kalendarza'), naLiscie: ['format', 'oprawa', 'grzbiet', 'stron_bloku', 'papier', 'rok_kalendarza'].every((n) => POLA_DOKUMENTU.some(([x]) => x === n)),
      grzbietLiczba: p.sekcje.find((s) => s.okladka).okladka.wynik.grzbiet,
      rokKal: wartosciPol(kal, ck.egzemplarze[0], ck)('rok_kalendarza'),
    };
  });
  assert.equal(w.format, '148 × 210 mm');
  assert.equal(w.oprawa, 'twarda');
  assert.equal(w.grzbiet, `${String(w.grzbietLiczba).replace('.', ',')} mm`);
  assert.equal(w.stron, '96');
  assert.equal(w.papier, 'offset 90 g/m²');
  assert.equal(w.rok, '', 'bez kalendarza – puste');
  assert.ok(w.naLiscie, 'na liście „Wstaw pole”');
  assert.equal(w.rokKal, '2028');
  assert.deepEqual(bledy, []);
});
