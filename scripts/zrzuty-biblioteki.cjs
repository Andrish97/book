// Zrzuty instrukcji Biblioteki (#143): k-biblioteka.png (okno z kategoriami, kształty) i k-biblioteka-planer.png
// (kategoria „Planer” z gotowymi tabelami). Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje
// zrobZrzutyBiblioteki na końcu; tu można je zrobić osobno.
//
// Użycie:  node scripts/zrzuty-biblioteki.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutyBiblioteki(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: d } = await otworz({ after: (f) => sprzatanie.push(f) });
  try {
    await d.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(d, 'Planer');
    await d.click('[data-akcja="biblioteka"]');
    await d.waitForSelector('#dlg-biblioteka[open]');
    await d.click('#kategorie-biblioteki [data-kategoria="strzalki"]');
    await d.waitForTimeout(300);
    await kadr(d, 'k-biblioteka.png', { obszar: ['#pasek-narzedzi', '#dlg-biblioteka'], zaznacz: '[data-akcja="biblioteka"]', margines: 10 });
    await d.click('#kategorie-biblioteki [data-kategoria="planer"]');
    await d.click('#elementy-biblioteki .kafel-biblioteki[data-element="tracker-nawykow"]');
    await d.waitForFunction(() => window.seriodruk.edytor.aktywny?.tabela);
    await d.evaluate(() => {
      const e = window.seriodruk.edytor;
      const g = e.aktywny;
      const nawyki = ['Woda – 2 litry', 'Spacer', 'Czytanie', 'Bez telefonu po 22', 'Modlitwa'];
      const komorki = g.getObjects().filter((o) => o.type === 'textbox');
      nawyki.forEach((n, i) => komorki[(i + 1) * 8].set('text', n));
      e.zatwierdz();
      e.canvas.discardActiveObject();
      e.canvas.requestRenderAll();
    });
    await d.waitForTimeout(400);
    await kadr(d, 'k-biblioteka-planer.png', { obszar: ['#dlg-biblioteka', '#kontener-plotna .canvas-container'], zaznacz: '#kategorie-biblioteki [data-kategoria="planer"]', margines: 10 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyBiblioteki };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyBiblioteki(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
