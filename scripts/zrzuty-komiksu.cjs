// Zrzuty instrukcji do komiksu (#364, rozdział 10.13): k-komiks.png (strona komiksu z kadrami i dymkami, pasek
// narzędzi komiksu) i k-komiks-kadry.png (okno „Kadry”). Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje
// zrobZrzutyKomiksu na końcu; tu można je zrobić osobno.
//
// Użycie:  node scripts/zrzuty-komiksu.cjs [adres] [ciemny] [en|uk]

const { otworz } = require('../tests/pomoc.cjs');

async function zrobZrzutyKomiksu(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: d } = await otworz({ after: (f) => sprzatanie.push(f) });
  try {
    await d.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    // Nowy projekt z szablonu „Komiks” – tak jak użytkownik.
    await d.locator('[data-akcja="nowy-projekt"]:visible').first().click();
    await d.waitForSelector('#dlg-nowy[open]');
    await d.fill('#form-nowy [name="nazwa"]', 'Przygody Ali');
    await d.check('#form-nowy input[name="start"][value="szablon"]', { force: true });
    await d.click('#nowy-szablony .karta-szablonu[data-id="komiks"]');
    await d.waitForSelector('#nowy-szablony #gotowe-szczegoly:not([hidden])');
    await d.click('#gotowe-wstaw');
    await d.waitForFunction(() => !document.querySelector('#dlg-nowy').open && window.seriodruk.stan.projekt?.nazwa === 'Przygody Ali', null, { timeout: 15000 });
    await d.evaluate(async () => {
      const x = window.seriodruk.stan.projekt;
      const kom = x.sekcje.find((s) => s.typ === 'komiks');
      await window.seriodruk.przejdzDoStrony(x.strony.findIndex((s) => s.sekcja === kom.id));
    });
    await d.waitForFunction(() => document.body.classList.contains('w-komiksie'));
    await d.click('[data-akcja="komiks-dymki"]');
    await d.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.dymek).length === 3);
    await d.evaluate(() => { const c = window.seriodruk.edytor.canvas; c.discardActiveObject(); c.requestRenderAll(); document.querySelector('#powiadomienie')?.setAttribute('hidden', ''); });
    await d.waitForTimeout(600);
    await kadr(d, 'k-komiks.png', { obszar: ['#pasek-narzedzi', '#obszar-roboczy'], zaznacz: ['[data-akcja="komiks-kadry"]', '[data-akcja="komiks-dymki"]'], margines: 0 });
    // Okno „Kadry”.
    await d.click('[data-akcja="komiks-kadry"]');
    await d.waitForSelector('#dlg-kadry[open]');
    await d.waitForTimeout(300);
    await kadr(d, 'k-komiks-kadry.png', { obszar: '#dlg-kadry .formularz', zaznacz: '#dlg-kadry .uklad-kadrow:has(input:checked)', margines: 0 });
    await d.click('#dlg-kadry button[value="nie"]');
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyKomiksu };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyKomiksu(kadr, { ciemny: process.argv.slice(3).includes('ciemny') }).catch((e) => { console.error(e); process.exit(1); });
}
