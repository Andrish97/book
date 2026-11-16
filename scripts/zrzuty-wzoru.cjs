// Zrzut instrukcji wzoru jako wypełnienia kształtu (#182): k-wzor-ksztaltu.png – strona z kilkoma kształtami
// wypełnionymi wzorami (paski, kropki, kratka, jodełka w gwieździe) i część „Wypełnienie i obrys” panelu.
// Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutWzoru na końcu; tu można go zrobić osobno.
//
// Użycie:  node scripts/zrzuty-wzoru.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutWzoru(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: t } = await otworz({ after: (f) => sprzatanie.push(f) }, { widok: { width: 1280, height: 900 } });
  try {
    await t.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(t, 'Wzory');
    await t.evaluate(() => {
      const { edytor } = window.seriodruk;
      const ksztalt = (dodaj, pola, wzor) => {
        dodaj();
        const o = edytor.aktywny;
        o.set({ scaleX: 1, scaleY: 1, stroke: '#1f3a5f', strokeWidth: 0.4, strokeUniform: true, ...pola });
        edytor.ustawWzor(o, wzor.id, wzor);
        o.setCoords();
        return o;
      };
      ksztalt(() => edytor.dodajProstokat(), { left: 16, top: 20, width: 54, height: 40, rx: 4, ry: 4, fill: '#fdf1d8' }, { id: 'paski-skosne', kolor: '#e0a33a', skala: 1 });
      ksztalt(() => edytor.dodajElipse(), { left: 80, top: 20, rx: 24, ry: 20, width: 48, height: 40, fill: '#e6f2fb' }, { id: 'kropki', kolor: '#2f5d8a', skala: 1.2 });
      ksztalt(() => edytor.dodajProstokat(), { left: 16, top: 72, width: 54, height: 46, fill: '#ffffff' }, { id: 'kratka', kolor: '#9fb8d6', skala: 1 });
      const g = ksztalt(() => edytor.dodajWielokat(5, true), { left: 82, top: 74, fill: '#f6e3ef' }, { id: 'jodelka', kolor: '#b4508a', skala: 0.7, obrot: 45 });
      g.set({ scaleX: 1.9, scaleY: 1.9 });
      g.setCoords();
      edytor.zatwierdz();
      edytor.canvas.discardActiveObject();
      edytor.zaznacz(g.id);
    });
    await t.waitForTimeout(500);
    await t.evaluate(() => {
      for (const l of document.querySelectorAll('#wlasciwosci legend')) {
        const f = l.closest('fieldset');
        const nazwa = l.textContent.trim();
        const chcemy = /^Wypełnienie i obrys$/.test(nazwa);
        if (chcemy === f.classList.contains('zwinieta')) l.querySelector('button')?.click();
      }
    });
    await t.waitForTimeout(300);
    await t.evaluate(() => [...document.querySelectorAll('#wlasciwosci legend')].find((l) => l.textContent.trim() === 'Wypełnienie i obrys')?.scrollIntoView({ block: 'start' }));
    await kadr(t, 'k-wzor-ksztaltu.png', { obszar: ['#kontener-plotna .canvas-container', '#panel-inspektor'], margines: 8 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutWzoru };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutWzoru(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
