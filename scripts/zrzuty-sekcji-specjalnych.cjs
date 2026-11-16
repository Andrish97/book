// Zrzuty instrukcji sekcji specjalnych (#177): k-sekcja-ulotka.png – okno sekcji z typem „Ulotka składana”
// (schemat paneli obu stron i wynik), k-sekcja-wykrojnik.png – strona z wykrojnikiem pudełka w edytorze (strefy,
// bigi i linia cięcia). Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutySekcjiSpecjalnych.
//
// Użycie:  node scripts/zrzuty-sekcji-specjalnych.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

async function zrobZrzutySekcjiSpecjalnych(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: t } = await otworz({ after: (f) => sprzatanie.push(f) }, { widok: { width: 1280, height: 900 } });
  try {
    await t.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(t, 'Ulotka i pudełko');
    await t.evaluate(async () => (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(null));
    await t.waitForSelector('#dlg-sekcja[open]');
    await t.click('#dlg-sekcja .karta-typu[data-typ="ulotka"]');
    await t.waitForSelector('#schemat-specjalnej svg');
    // Sama część „Ulotka składana” ze schematem paneli (#180) – karta typu wychodziła ponad kadr, schemat był ucięty.
    await t.evaluate(() => document.querySelector('#sekcja-specjalna').scrollIntoView({ block: 'start' }));
    await t.waitForTimeout(300);
    await kadr(t, 'k-sekcja-ulotka.png', { obszar: '#sekcja-specjalna', margines: 10 });
    await t.keyboard.press('Escape');
    // Pudełko: wykrojnik na stronie.
    await t.evaluate(async () => {
      const P = await import('./js/projekt.js');
      const S = await import('./js/sekcje-specjalne.js');
      const p = window.seriodruk.stan.projekt;
      const s = P.nowaSekcja('Pudełko');
      s.specjalna = { ...S.domyslnaSpecjalna('wykrojnik'), ksztalt: 'pudelko', dlugosc_mm: 90, szerokosc_mm: 50, wysokosc_mm: 120 };
      s.wydruk.marginesy = { gora: 4, dol: 4, wewnetrzny: 4, zewnetrzny: 4 };
      p.sekcje.push(s);
      const st = P.nowaStrona('Pudełko', s.id);
      p.strony.push(st);
      const { przejdzDoStrony } = await import('./js/app/lista-stron.js');
      const { przeliczOkladki } = await import('./js/okladka.js');
      przeliczOkladki(p);
      const przod = s.specjalna.wynik.strefy.find((z) => z.rodzaj === 'przod');
      st.obiekty.push({ type: 'rect', id: 'tlo', left: przod.x1, top: przod.y1, width: przod.x2 - przod.x1, height: przod.y2 - przod.y1, fill: '#f4d7b8', strokeWidth: 0 });
      st.obiekty.push({ type: 'textbox', id: 'nazwa', left: przod.x1 + 8, top: przod.y1 + 20, width: przod.x2 - przod.x1 - 16, height: 12, text: 'Herbata', fontSize: 9, fontFamily: 'Playfair Display', textAlign: 'center' });
      await przejdzDoStrony(p.strony.indexOf(st));
      window.seriodruk.edytor.dopasujDoOkna();
    });
    await t.waitForTimeout(600);
    await kadr(t, 'k-sekcja-wykrojnik.png', { obszar: ['#kontener-plotna'], margines: 0 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutySekcjiSpecjalnych };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutySekcjiSpecjalnych(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
