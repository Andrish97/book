// Zrzuty instrukcji kolorów projektu (#167): k-kolory-druku.png – okno „Kolory projektu” dla sekcji „Środek”
// (kolory sekcji, tryb druku „Skala szarości”, kolor dodatkowy, wykończenia) i k-uszlachetnienie.png – część
// „Wykończenie druku” we Właściwościach (kafelki, „Jak”, farba specjalna), k-marka-style.png – style tekstu marki.
// Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutyKolorow na końcu; tu można je zrobić osobno.
//
// Użycie:  node scripts/zrzuty-kolorow.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutyKolorow(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: t } = await otworz({ after: (f) => sprzatanie.push(f) }, { widok: { width: 1280, height: 900 } });
  try {
    await t.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(t, 'Kalendarz');
    await t.evaluate(async () => {
      const P = await import('./js/projekt.js');
      const p = P.nowyProjekt('Kalendarz 2027');
      const okl = p.sekcje[0];
      okl.nazwa = 'Okładka';
      const srodek = P.nowaSekcja('Środek', okl.wydruk);
      srodek.tryb_kolorow = 'szarosc';
      p.sekcje.push(srodek);
      p.kolory_dodatkowe = [{ id: 'kd186', nazwa: 'PANTONE 186 C', cmyk: [0, 100, 81, 4] }];
      const prost = (id, left, top, w, h, fill, extra = {}) => ({ type: 'rect', version: '5.3.0', left, top, width: w, height: h, fill, id, ...extra });
      p.strony[0].obiekty = [prost('tlo', 0, 0, 148, 210, '#1c2541'), prost('tyt', 20, 40, 108, 30, '#d4a72c', { uszlachetnienie: 'folia', folia: 'zloto' })];
      const s2 = P.nowaStrona('Styczeń', srodek.id);
      s2.obiekty = [prost('n', 14, 14, 120, 14, '#333333'), prost('d', 14, 34, 120, 150, '#e6e6e6'), prost('w', 14, 190, 40, 8, '#b42318')];
      p.strony.push(s2);
      const { otworzProjekt } = await import('./js/app/zapis.js');
      await otworzProjekt(P.normalizuj(p), { strona: s2.id });
    });
    await t.waitForTimeout(600);
    await t.evaluate(async () => (await import('./js/app/kolory-druku-okno.js')).otworzKoloryDruku({ zakresStart: 'sekcja' }));
    await t.waitForSelector('#dlg-kolory-druku[open]');
    await t.waitForTimeout(500);
    await kadr(t, 'k-kolory-druku.png', { obszar: '#dlg-kolory-druku .formularz', margines: 0 });
    await t.evaluate(() => document.querySelector('#dlg-kolory-druku').close());
    // Wykończenie druku przy zaznaczonym prostokącie na stronie środka (pełny kolor nie jest tu potrzebny).
    await t.evaluate(async () => {
      const { stan } = window.seriodruk;
      const { przejdzDoStrony } = await import('./js/app/lista-stron.js');
      await przejdzDoStrony(0);
      stan.projekt.sekcje[1].tryb_kolorow = undefined;
      window.seriodruk.edytor.zaznacz('tyt');
    });
    await t.waitForTimeout(400);
    await t.evaluate(() => {
      for (const l of document.querySelectorAll('#wlasciwosci legend')) {
        const f = l.closest('fieldset');
        const nasza = /Wykończenie druku/.test(l.textContent);
        if (nasza === f.classList.contains('zwinieta')) l.querySelector('button')?.click();
      }
    });
    await t.waitForTimeout(300);
    await t.evaluate(() => [...document.querySelectorAll('#wlasciwosci legend')].find((l) => /Wykończenie druku/.test(l.textContent))?.scrollIntoView({ block: 'start' }));
    await t.waitForTimeout(300);
    await kadr(t, 'k-uszlachetnienie.png', { obszar: '#panel-inspektor fieldset:has(> legend:has-text("Wykończenie druku"))', margines: 8 });
    // Style tekstu w zestawie marki (#167): gotowe style w czcionkach i kolorach marki, jeden rozwinięty.
    await t.evaluate(async () => {
      const m = await import('./js/zestaw-marki.js');
      const marka = m.normalizujMarke({
        kolory: [{ id: 'a', nazwa: 'Granat marki', kolor: '#1c2541' }, { id: 'b', nazwa: 'Złoto', kolor: '#c9a227' }],
        czcionki: { naglowek: 'Playfair Display', tekst: 'Lora' }, loga: [],
      });
      marka.style = m.ROLE_STYLOW.slice(0, 8).map(([r]) => m.gotowyStylMarki(r, marka));
      await m.zapiszMarke(marka);
      (await import('./js/marka-okno.js')).otworzMarke();
    });
    await t.waitForSelector('#dlg-marka[open] #marka-style li');
    await t.evaluate(() => {
      document.querySelector('#marka-style li details').open = true;
      document.querySelector('#marka-style').closest('fieldset').scrollIntoView({ block: 'start' });
    });
    await t.waitForTimeout(500);
    await kadr(t, 'k-marka-style.png', { obszar: '#dlg-marka fieldset:has(#marka-style)', margines: 8 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyKolorow };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyKolorow(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
