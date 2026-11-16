// Zrzuty instrukcji gotowych sekcji (#166): k-gotowe-sekcje.png – galeria szablonów z miniaturami,
// k-gotowe-szczegoly.png – szczegóły szablonu (podgląd w formacie projektu, rok, kolory, „Wstaw”).
// Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutyGotowychSekcji na końcu; tu można go zrobić osobno.
//
// Użycie:  node scripts/zrzuty-gotowych-sekcji.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutyGotowychSekcji(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: t } = await otworz({ after: (f) => sprzatanie.push(f) }, { widok: { width: 1280, height: 900 } });
  try {
    await t.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(t, 'Kalendarz rodzinny');
    await t.click('#stopka-strony [data-akcja="gotowe-sekcje"]');
    await t.waitForSelector('#dlg-gotowe-sekcje[open]');
    await t.waitForFunction(() => document.querySelectorAll('#gotowe-lista .miniatura-szablonu.gotowa').length >= 8, null, { timeout: 30000 });
    await t.waitForTimeout(400);
    await kadr(t, 'k-gotowe-sekcje.png', { obszar: ['#dlg-gotowe-sekcje'], margines: 6 });
    await t.click('#gotowe-lista .karta-szablonu[data-id="kalendarz-scienny"]');
    await t.waitForFunction(() => document.querySelectorAll('#gotowe-podglad img').length >= 2, null, { timeout: 30000 });
    await t.waitForTimeout(300);
    await kadr(t, 'k-gotowe-szczegoly.png', { obszar: ['#dlg-gotowe-sekcje'], margines: 6 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyGotowychSekcji };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyGotowychSekcji(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
