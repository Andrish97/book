// Zrzuty instrukcji do druku (#131C, #145): k-pdf-arkusze.png (układ arkuszy w oknie eksportu), k-druk.png (Drukuj w domu) i separacje.png
// (podgląd separacji). Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutyDruku na końcu; tu można
// je zrobić osobno, gdy pełny komplet nie mieści się w pamięci maszyny.
//
// Użycie:  node scripts/zrzuty-druku.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutyDruku(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: d } = await otworz({ after: (f) => sprzatanie.push(f) });
  try {
    await d.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(d, 'Broszura');
    await d.evaluate(async () => {
      const { stan, przeladuj } = window.seriodruk;
      const p = stan.projekt;
      p.kolory_dodatkowe = [{ id: 'kd', nazwa: 'PANTONE 186 C', cmyk: [0, 100, 81, 4] }];
      const { hexSpotu } = await import('./js/kolory-druku.js');
      const { nowaStrona } = await import('./js/projekt.js');
      p.strony[0].obiekty = [
        { type: 'rect', version: '5.3.0', left: -3, top: -3, width: 154, height: 80, fill: '#1c2541', id: 'tlo' },
        { type: 'textbox', version: '5.3.0', left: 15, top: 30, width: 118, text: 'Broszura', fontSize: 14, fontFamily: 'Playfair Display', fontWeight: 'bold', fill: '#ffffff', id: 'tyt' },
        { type: 'rect', version: '5.3.0', left: 15, top: 30, width: 70, height: 16, fill: '#ffffff', id: 'uv', uszlachetnienie: 'uv' },
        { type: 'ellipse', version: '5.3.0', left: 40, top: 110, rx: 34, ry: 34, fill: hexSpotu(p.kolory_dodatkowe[0], 1), id: 'spot' },
        { type: 'textbox', version: '5.3.0', left: 15, top: 185, width: 118, text: 'Kolor dodatkowy i lakier UV', fontSize: 5, fontFamily: 'Inter', fill: '#1a1a1a', id: 'opis' },
      ];
      for (let i = 2; i <= 8; i += 1) p.strony.push({ ...nowaStrona(`Strona ${i}`, p.sekcje[0].id), obiekty: [] });
      await przeladuj();
    });
    // Okno eksportu z układem broszury i planem arkuszy.
    await d.click('#przycisk-wiecej');
    await d.click('[data-akcja="pdf"]');
    await d.waitForSelector('#dlg-pdf[open]');
    await d.selectOption('#form-pdf select[name=uklad]', 'broszura');
    await d.waitForTimeout(300);
    await kadr(d, 'k-pdf-arkusze.png', { obszar: ['#form-pdf label:has(select[name=uklad])', '#pdf-pole-arkusze'], zaznacz: '#pdf-plan-arkuszy', margines: 8 });
    await d.click('#pdf-anuluj');
    // Drukuj w domu (#145): broszura na A4, plan kartek i pomoc.
    await d.click('#przycisk-wiecej');
    await d.click('#menu-wiecej [data-akcja="drukuj"]');
    await d.waitForSelector('#dlg-druk[open]');
    await d.evaluate(() => {
      const s = document.querySelector('#form-druk [name="uklad"]');
      s.value = 'broszura';
      s.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#druk-pomoc').open = true;
    });
    await d.waitForTimeout(300);
    await kadr(d, 'k-druk.png', { obszar: '#form-druk', margines: 0 });
    await d.click('#dlg-druk [data-akcja="druk-zamknij"]');
    // Podgląd separacji.
    await d.click('[data-akcja="podglad"]');
    await d.waitForSelector('.podglad-strona[data-id]');
    await d.click('[data-akcja="podglad-separacje"]');
    await d.waitForSelector('#dlg-separacje[open]');
    await d.waitForFunction(() => /Największe pokrycie/.test(document.querySelector('#separacje-wynik').textContent), null, { timeout: 30000 });
    await d.waitForTimeout(300);
    await kadr(d, 'separacje.png', { obszar: '#dlg-separacje .formularz', margines: 0 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyDruku };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyDruku(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
