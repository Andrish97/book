// #161 (sprawdzenie): okładka w trybie auto liczy format i grzbiet ze środka – sekcji bloku, bez wyklejek;
// wyklejka A4 (z typem albo bez) przy środku A5 nie zmienia formatu okładki.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('okładka: format środka z bloku – wyklejka A4 nie zmienia okładki A5', async () => {
  const P = await modul('js/projekt.js');
  const O = await modul('js/okladka.js');
  const projekt = (typWyklejki) => {
    const p = P.normalizuj(P.nowyProjekt('Książka'));
    const blok = p.sekcje[0];
    Object.assign(blok.wydruk, { szerokosc_mm: 148, wysokosc_mm: 210 });
    p.strony = [];
    for (let i = 0; i < 16; i += 1) p.strony.push(P.nowaStrona(`S${i + 1}`, blok.id));
    const wyk = P.nowaSekcja('Wyklejka');
    Object.assign(wyk.wydruk, { szerokosc_mm: 297, wysokosc_mm: 210 });
    if (typWyklejki) wyk.typ = typWyklejki;
    p.sekcje.unshift(wyk);
    p.strony.unshift(P.nowaStrona('W1', wyk.id), P.nowaStrona('W2', wyk.id));
    const ok = P.nowaSekcja('Okładka');
    ok.okladka = { oprawa: 'twarda' };
    p.sekcje.unshift(ok);
    p.strony.unshift(P.nowaStrona('Okładka', ok.id));
    return { p, ok };
  };
  for (const typ of ['wyklejka_przednia', null]) {
    const { p, ok } = projekt(typ);
    const g = O.geometriaOkladki(p, ok);
    assert.deepEqual([g.strona.sz, g.strona.wy], [148, 210], `wyklejka ${typ || 'bez typu'}: okładka dla A5`);
  }
});
