// Zrzut instrukcji okna „Wzorce stron” (#164): k-wzorce-galeria.png – rysunek „co to jest” i początek galerii
// gotowych wzorców z podglądami. Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutWzorcow na końcu.
//
// Użycie:  node scripts/zrzuty-wzorcow.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutWzorcow(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: d } = await otworz({ after: (f) => sprzatanie.push(f) });
  try {
    await d.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await d.setViewportSize({ width: 1280, height: 1000 });
    await nowyProjekt(d, 'Planer 2027');
    await d.click('[data-akcja="wzorce"]');
    await d.waitForSelector('#dlg-wzorce[open]');
    await d.waitForTimeout(400);
    await kadr(d, 'k-wzorce-galeria.png', { obszar: ['#dlg-wzorce .wzorce-wyjasnienie', '#wzorce-standardowe li:nth-child(5)'], margines: 8 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutWzorcow };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutWzorcow(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
