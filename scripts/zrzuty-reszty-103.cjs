// Kadry instrukcji do reszty propozycji #103 (#182):
//   k-menu-obrazu.png    – karta obrazu w „Obrazach projektu” z otwartym menu ⋯,
//   k-seria-segmenty.png – w oknie Serii „Ile razy powielić” i „Jak czytać tabelę” jako segmenty.
// Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutyReszty103 na końcu; tu można je zrobić osobno.
//
// Użycie:  node scripts/zrzuty-reszty-103.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutyReszty103(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: t } = await otworz({ after: (f) => sprzatanie.push(f) }, { widok: { width: 1280, height: 900 } });
  try {
    await t.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(t, 'Kalendarz');
    // Obrazy projektu: trzy obrazy, menu ⋯ przy drugim.
    await t.evaluate(async () => {
      const obraz = (nazwa, a, b) => new Promise((ok) => {
        const c = document.createElement('canvas');
        c.width = 1200; c.height = 800;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 1200, 800);
        g.addColorStop(0, a); g.addColorStop(1, b);
        ctx.fillStyle = g; ctx.fillRect(0, 0, 1200, 800);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(860, 300, 170, 0, Math.PI * 2); ctx.fill();
        c.toBlob((blob) => ok(new File([blob], nazwa, { type: 'image/jpeg' })), 'image/jpeg', 0.9);
      });
      const { wgrajObrazy, otworzObrazy } = await import('./js/app/obrazy-okno.js');
      await wgrajObrazy([await obraz('gory-zima.jpg', '#1e3a8a', '#93c5fd'), await obraz('laka-wiosna.jpg', '#166534', '#fde68a'), await obraz('morze.jpg', '#0e7490', '#f0abfc')]);
      otworzObrazy();
    });
    await t.waitForSelector('#dlg-obrazy[open]');
    await t.waitForFunction(() => [...document.querySelectorAll('#obrazy-lista .obraz-wymiary')].every((e) => /px/.test(e.textContent)));
    await t.waitForTimeout(400);
    const karta = t.locator('#obrazy-lista li').nth(1);
    await karta.locator('[data-rola="wiecej"]').click();
    await t.waitForSelector('#menu-obrazu:not([hidden])');
    await t.mouse.move(5, 5);
    await kadr(t, 'k-menu-obrazu.png', { obszar: ['#obrazy-lista li:nth-child(1)', '#obrazy-lista li:nth-child(2)', '#menu-obrazu'], margines: 10 });
    await t.evaluate(() => document.querySelector('#dlg-obrazy').close());
    await t.waitForTimeout(300);
    // Seria z tabelą: segmenty.
    await t.evaluate(async () => {
      const { stan } = window.seriodruk;
      stan.projekt.tabele = [{ id: 't1', nazwa: 'Miesiące', kolumny: ['miesiac'], wiersze: [['Styczeń'], ['Luty'], ['Marzec']] }];
      const { dane } = await import('./js/app/skladniki.js');
      const s = dane.nowaSeria();
      s.nazwa = 'Miesiące';
      s.tabela = 't1';
      dane.otworzSerie(s.id);
    });
    await t.waitForSelector('#dlg-seria[open]');
    await t.click('#dlg-seria label:has(input[name="tryb"][value="tabela"])');
    await t.mouse.move(5, 5);
    await kadr(t, 'k-seria-segmenty.png', { obszar: ['#dlg-seria .przelacznik-segmentowy:has(input[name="tryb"])', '#dlg-seria .przelacznik-segmentowy:has(input[name="uklad"])'], margines: 40 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyReszty103 };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyReszty103(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
