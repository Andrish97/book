// Zrzut instrukcji karty postępu dłuższej czynności (#159): k-postep.png – eksport PDF z licznikiem stron
// i przyciskiem „Anuluj”. Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutPostepu na końcu.
//
// Użycie:  node scripts/zrzuty-postepu.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutPostepu(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: t } = await otworz({ after: (f) => sprzatanie.push(f) });
  try {
    await t.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(t, 'Kalendarz 2027');
    // Karta jak w trakcie eksportu: stała (bez prawdziwego eksportu, żeby kadr był powtarzalny).
    await t.evaluate(async () => {
      const { postep } = await import('./js/postep.js');
      const p = postep('Eksport do PDF', { razem: 48, opoznienie: 0, anuluj: () => {} });
      p.krok(17);
      window.__postepZrzutu = p;
    });
    await t.waitForSelector('.postep');
    await t.waitForTimeout(300);
    await kadr(t, 'k-postep.png', { obszar: ['.postep'], margines: 14 });
    await t.evaluate(() => window.__postepZrzutu?.koniec());
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutPostepu };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutPostepu(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
