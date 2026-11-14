// Tymczasowe: zrzuty instrukcji przed/po #114 (nie wchodzi do repozytorium).
const test = require('node:test');
const { otworz } = require('./pomoc.cjs');

const KAT = process.env.KAT;
const URZ = { tel: { width: 390, height: 780 }, tablet: { width: 820, height: 1100 }, pc: { width: 1366, height: 860 } };
const TYTULY = ['Makietka w skrócie', 'Ekran edytora', 'Tekst', 'Serie', 'Praca z AI', 'Skróty klawiszowe', 'Tabela'];

for (const [n, vp] of Object.entries(URZ)) {
  for (const motyw of ['light', 'dark']) {
    test(`${n}-${motyw}`, async (t) => {
      const { strona } = await otworz(t);
      await strona.setViewportSize(vp);
      await strona.emulateMedia({ colorScheme: motyw });
      await strona.evaluate(() => document.querySelector('[data-akcja="instrukcja"]').click());
      await strona.waitForSelector('#dlg-instrukcja[open]');
      await strona.waitForTimeout(600);
      await strona.screenshot({ path: `${KAT}/${n}-${motyw}-0start.png` });
      let k = 1;
      for (const tytul of TYTULY) {
        const ok = await strona.evaluate(async (tt) => {
          const m = await import('./js/instrukcja.js');
          const i = m.ROZDZIALY.findIndex((r) => r.tytul === tt);
          if (i < 0) return false;
          await window.seriodruk.instrukcja.otworz(i);
          return true;
        }, tytul);
        if (!ok) continue;
        await strona.waitForTimeout(700);
        await strona.screenshot({ path: `${KAT}/${n}-${motyw}-${k}.png` });
        if (n !== 'pc') {
          await strona.evaluate(() => { const c = document.querySelector('#instrukcja-tresc'); c.scrollTop = c.scrollHeight / 3; });
          await strona.waitForTimeout(400);
          await strona.screenshot({ path: `${KAT}/${n}-${motyw}-${k}b.png` });
        }
        k += 1;
      }
    });
  }
}
