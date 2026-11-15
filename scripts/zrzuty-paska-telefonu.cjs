// Zrzut instrukcji menu ⋯ paska wstawiania na telefonie (#139): k-wstaw-telefon.png. Pełny skrypt
// scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutPaskaTelefonu na końcu; tu można go zrobić osobno.
//
// Użycie:  node scripts/zrzuty-paska-telefonu.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutPaskaTelefonu(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: t } = await otworz({ after: (f) => sprzatanie.push(f) }, { telefon: true });
  try {
    await t.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(t, 'Planer');
    await t.tap('#przycisk-narzedzia-wiecej');
    await t.waitForSelector('#menu-narzedzi:not([hidden])');
    await kadr(t, 'k-wstaw-telefon.png', { obszar: ['#pasek-narzedzi', '#menu-narzedzi'], zaznacz: '#przycisk-narzedzia-wiecej', margines: 10 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutPaskaTelefonu };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutPaskaTelefonu(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
