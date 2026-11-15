// Zrzut instrukcji obramowania obrazu i miękkich krawędzi (#156): k-obramowanie.png – strona z dwoma
// zdjęciami (zaokrąglone narożniki z przerywanym obramowaniem; owalna winieta) i części panelu.
// Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutObramowania na końcu; tu można go zrobić osobno.
//
// Użycie:  node scripts/zrzuty-obramowania.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutObramowania(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: t } = await otworz({ after: (f) => sprzatanie.push(f) }, { widok: { width: 1280, height: 900 } });
  try {
    await t.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(t, 'Album');
    await t.evaluate(async () => {
      const { edytor, stan } = window.seriodruk;
      // „Zdjęcie”: niebo, słońce, wzgórza.
      const c = document.createElement('canvas');
      c.width = 600; c.height = 450;
      const g = c.getContext('2d');
      const niebo = g.createLinearGradient(0, 0, 0, 450);
      niebo.addColorStop(0, '#5aa9e6'); niebo.addColorStop(1, '#f6d6a8');
      g.fillStyle = niebo; g.fillRect(0, 0, 600, 450);
      g.fillStyle = '#ffd166'; g.beginPath(); g.arc(440, 140, 60, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a7d44'; g.beginPath(); g.moveTo(0, 330); g.quadraticCurveTo(160, 230, 320, 320); g.quadraticCurveTo(470, 400, 600, 300); g.lineTo(600, 450); g.lineTo(0, 450); g.fill();
      g.fillStyle = '#2d6a4f'; g.beginPath(); g.moveTo(0, 400); g.quadraticCurveTo(250, 330, 600, 420); g.lineTo(600, 450); g.lineTo(0, 450); g.fill();
      const url = c.toDataURL('image/png');
      const a = await edytor.dodajObraz(url, 'pejzaz.png', stan.projekt.zasoby);
      a.set({ left: 18, top: 22, scaleX: 0.187, scaleY: 0.187, stroke: '#1f3a5f', strokeWidth: 1, strokeUniform: true, strokeDashArray: [6, 4], zaokraglenie: 6 });
      a.setCoords();
      const b = await edytor.dodajObraz(url, 'pejzaz.png', stan.projekt.zasoby, { id: a.zasob });
      b.set({ left: 18, top: 115, scaleX: 0.187, scaleY: 0.187, miekkie_krawedzie: 14, miekkie_rodzaj: 'owal' });
      b.setCoords();
      edytor.zaznacz(a.id);
      edytor.zatwierdz();
    });
    await t.waitForTimeout(500);
    // Panel: obie części rozwinięte, widoczne obok strony.
    await t.evaluate(() => {
      for (const l of document.querySelectorAll('#wlasciwosci legend')) {
        const f = l.closest('fieldset');
        const nazwa = l.textContent.trim();
        if (!/^(Obramowanie|Miękkie krawędzie)$/.test(nazwa) && !f.classList.contains('zwinieta')) l.querySelector('button')?.click();
        if (/^(Obramowanie|Miękkie krawędzie)$/.test(nazwa) && f.classList.contains('zwinieta')) l.querySelector('button')?.click();
      }
    });
    await t.waitForTimeout(300);
    await t.evaluate(() => [...document.querySelectorAll('#wlasciwosci legend')].find((l) => l.textContent.trim() === 'Obramowanie')?.scrollIntoView({ block: 'start' }));
    await kadr(t, 'k-obramowanie.png', { obszar: ['#kontener-plotna .canvas-container', '#panel-inspektor'], margines: 8 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutObramowania };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutObramowania(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
