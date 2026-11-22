// Katalog Biblioteki dla łącznika AI (plan H7): kategorie i elementy, które AI może wstawić narzędziem
// wstaw_z_biblioteki. Liczony w aplikacji (te same moduły co okno Biblioteki), zapisywany w rdzeniu łącznika
// (scripts/katalog-biblioteki.cjs) i sprawdzany testem (tests/biblioteka-ai.test.cjs).
// Poza katalogiem: kategorie zależne od projektu albo konta (moje, style, marka) i rzeczy otwierające okna
// (gotowe sekcje, okna komiksu).

const POMIJANE_KATEGORIE = ['moje', 'style', 'marka', 'gotowe-sekcje'];
const pomijany = (kat, id) => kat === 'komiks' && /^okno-/.test(id);

async function katalogZAplikacji(strona) {
  const surowy = await strona.evaluate(async () => {
    await import('./js/app/biblioteka-okno.js');
    const { kategorieBiblioteki } = await import('./js/biblioteka.js');
    return kategorieBiblioteki().map((k) => [k.id, k.nazwa, k.elementy().map((e) => [e.id, e.nazwa, e.slowa || ''])]);
  });
  const skroc = (s) => String(s).replace(/\s+/g, ' ').trim().split(' ').filter((w, i, a) => a.indexOf(w) === i).join(' ').slice(0, 60).trim();
  return surowy.filter(([id]) => !POMIJANE_KATEGORIE.includes(id))
    .map(([id, nazwa, el]) => [id, nazwa, el.filter(([e]) => !pomijany(id, e)).map(([e, n, s]) => [e, n, skroc(s)])])
    .filter(([, , el]) => el.length);
}

const START = '// KATALOG-BIBLIOTEKI:START (node scripts/katalog-biblioteki.cjs)';
const KONIEC = '// KATALOG-BIBLIOTEKI:KONIEC';
const doKodu = (k) => `${START}\nexport const KATALOG_BIBLIOTEKI = [\n${k.map(([id, n, el]) => `  [${JSON.stringify(id)}, ${JSON.stringify(n)}, [\n${el.map((e) => `    ${JSON.stringify(e)},`).join('\n')}\n  ]],`).join('\n')}\n];\n${KONIEC}`;

module.exports = { katalogZAplikacji, doKodu, START, KONIEC };
