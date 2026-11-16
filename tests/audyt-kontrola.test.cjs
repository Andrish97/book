// Audyt testów (#160): uwagi „Sprawdź przed drukiem”, których żaden test nie wywoływał:
// pokrycie farbą ponad 300% (z profilem drukarni), odsyłacz do elementu, którego już nie ma,
// niepełny ostatni blok serii dopełniany pustymi stronami, seria stała dłuższa niż tabela wartości unikalnych.
// Do tego sprawdzenie, że w poprawnym projekcie tych uwag nie ma (bez fałszywych alarmów).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

test('kontrola przed drukiem: pokrycie farbą, zerwany odsyłacz, niepełny blok serii, za mało wartości – i brak fałszywych alarmów', async (t) => {
  const { strona, bledy } = await otworz(t);
  const wynik = await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const S = await import('./js/separacje.js');
    const rodzaje = (p) => sprawdzProjekt(P.normalizuj(p)).map((u) => u.rodzaj);
    const opisy = (p, r) => sprawdzProjekt(P.normalizuj(p)).filter((u) => u.rodzaj === r).map((u) => u.opis);
    const out = {};

    // 1. Pokrycie farbą: prosta zamiana nie przekracza 300%, profil drukarni – tak (silnik podstawiony).
    const p1 = P.nowyProjekt('Farba');
    p1.strony[0].obiekty = [{ id: 'r', type: 'rect', left: 0, top: 0, width: 10, height: 10, fill: '#101010' }];
    S.ustawSilnikTac(null);
    out.farbaBezProfilu = rodzaje(p1).includes('pokrycie_farba');
    S.ustawSilnikTac({ wektor: (r, g, b) => (r + g + b < 0.3 ? [0.85, 0.8, 0.8, 0.9] : [0, 0, 0, 0]) });
    out.farba = opisy(p1, 'pokrycie_farba');
    p1.strony[0].obiekty[0].fill = '#ffffff';
    out.farbaJasny = rodzaje(p1).includes('pokrycie_farba');
    S.ustawSilnikTac(null);

    // 2. Odsyłacz {s:…} do elementu, którego nie ma.
    const p2 = P.nowyProjekt('Odsyłacz');
    p2.strony[0].obiekty = [
      { id: 'cel', type: 'textbox', left: 10, top: 10, width: 50, text: 'Rozdział', fontFamily: 'Inter', fontSize: 4 },
      { id: 'od', type: 'textbox', left: 10, top: 30, width: 50, text: 'Zob. s. {s:cel}', fontFamily: 'Inter', fontSize: 4 },
    ];
    out.odsylaczDobry = rodzaje(p2).includes('odsylacz');
    p2.strony[0].obiekty[1].text = 'Zob. s. {s:nie-ma}';
    out.odsylacz = opisy(p2, 'odsylacz');

    // 3 i 4. Serie.
    const p3 = P.nowyProjekt('Serie');
    const sek = p3.sekcje[0].id;
    p3.tabele = [{ id: 't1', nazwa: 'Dni', kolumny: ['dzien'], wiersze: [['1'], ['2'], ['3'], ['4'], ['5']], unikalne: ['dzien'] }];
    p3.strony = [P.nowaStrona('A', sek), P.nowaStrona('B', sek)];
    p3.strony.forEach((s) => { s.seria = 's1'; s.obiekty = [{ id: `x${s.nazwa}`, type: 'textbox', left: 10, top: 10, width: 50, text: '{dzien}', fontFamily: 'Inter', fontSize: 4 }]; });
    p3.serie = [{ id: 's1', nazwa: 'Dni', tabela: 't1', tryb: 'tabela', uklad: 'dlugi', dopelnij: true }];
    out.niepelny = opisy(p3, 'niepelny_blok');
    p3.tabele[0].wiersze.push(['6']);
    out.niepelnyParzysty = rodzaje(p3).includes('niepelny_blok');
    p3.serie[0] = { id: 's1', nazwa: 'Dni', tabela: 't1', tryb: 'stala', ile: 9, uklad: 'szeroki' };
    out.malo = opisy(p3, 'za_malo_wartosci');
    p3.serie[0].ile = 6;
    out.maloRowno = rodzaje(p3).includes('za_malo_wartosci');
    return out;
  });
  assert.equal(wynik.farbaBezProfilu, false, 'bez profilu nie ma alarmu (czerń idzie samą czernią)');
  assert.equal(wynik.farba.length, 1);
  assert.match(wynik.farba[0], /#101010 .*335% pokrycia farbą \(powyżej 300%\).*Strona 1/);
  assert.equal(wynik.farbaJasny, false);
  assert.equal(wynik.odsylaczDobry, false, 'istniejący cel – bez uwagi');
  assert.match(wynik.odsylacz[0], /Odsyłacz prowadzi do elementu, którego już nie ma.*„Zob\. s\. \{s:nie-ma\}”/);
  assert.match(wynik.niepelny[0], /tabela ma 5 wierszy, a blok 2 strony – ostatnie powielenie jest dokończone/);
  assert.equal(wynik.niepelnyParzysty, false, '6 wierszy w blokach po 2 – bez uwagi');
  assert.match(wynik.malo[0], /powiela się 9 razy, a tabela ma 6 wierszy – wartości zaczną się powtarzać/);
  assert.equal(wynik.maloRowno, false);
  assert.deepEqual(bledy, []);
});
