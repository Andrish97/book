// Zrzuty instrukcji do partii D (#131D): k-format.png (zmiana formatu), k-marka.png, k-marka-kolor.png,
// k-marka-zastosuj.png (zestaw marki), k-makieta.png, k-makieta-kalendarz.png (makieta 3D).
// Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutyPartiiD na końcu; tu można je zrobić osobno.
//
// Użycie:  node scripts/zrzuty-partii-d.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

// Kilka stron z kolorowymi elementami i okładka w twardej oprawie.
async function przygotujProjekt(d) {
  await d.evaluate(async () => {
    const { stan } = window.seriodruk;
    const P = await import('./js/projekt.js');
    const O = await import('./js/okladka.js');
    const p = stan.projekt;
    const srodek = p.sekcje[0];
    srodek.nazwa = 'Środek';
    const st = (n) => p.style.find((s) => s.nazwa === n) || p.style[0];
    const tekst = (id, txt, s, extra = {}) => ({ type: 'textbox', id, left: 15, top: 20, width: 118, text: txt, styl: s.id, fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, fill: s.fill, styles: [], ...extra });
    const kolory = ['#9d0208', '#1c2541', '#3a5a40', '#bc6c25', '#5f0f40', '#0b525b', '#9d0208', '#1c2541'];
    const tytuly = ['Wiosna', 'Lato', 'Jesień', 'Zima', 'Ogród', 'Morze', 'Góry', 'Miasto'];
    p.strony[0].obiekty = [
      { type: 'rect', id: 'tlo1', left: 0, top: 0, width: 148, height: 95, fill: kolory[0], strokeWidth: 0 },
      tekst('t1', tytuly[0], st('Tytuł'), { top: 110, fill: kolory[0] }),
      tekst('o1', 'Krótki opis rozdziału – kilka zdań o tym, co czeka czytelnika na kolejnych stronach.', st('Tekst'), { top: 135 }),
    ];
    for (let i = 1; i < 8; i += 1) {
      const s = P.nowaStrona(`S${i + 1}`, srodek.id);
      s.obiekty = [
        { type: 'rect', id: `tlo${i + 1}`, left: 0, top: i % 2 ? 115 : 0, width: 148, height: 95, fill: kolory[i], strokeWidth: 0 },
        tekst(`t${i + 1}`, tytuly[i], st('Tytuł'), { top: i % 2 ? 22 : 110, fill: kolory[i] }),
        tekst(`o${i + 1}`, 'Krótki opis rozdziału – kilka zdań o tym, co czeka czytelnika na kolejnych stronach.', st('Tekst'), { top: i % 2 ? 50 : 135 }),
      ];
      p.strony.push(s);
    }
    const ok = P.nowaSekcja('Okładka');
    ok.okladka = { oprawa: 'twarda' };
    p.sekcje.unshift(ok);
    const so = P.nowaStrona('Okładka', ok.id);
    so.tlo = '#1c2541';
    p.strony.unshift(so);
    O.przeliczOkladki(p);
    const g = O.geometriaOkladki(p, ok);
    const przod = g.strefy.find((z) => z.rodzaj === 'przod');
    const grzbiet = g.strefy.find((z) => z.rodzaj === 'grzbiet');
    so.obiekty = [
      { type: 'rect', id: 'pas', left: przod.x1, top: g.gora + 60, width: przod.x2 - przod.x1, height: 70, fill: '#c9a227', strokeWidth: 0 },
      tekst('tyt', 'Cztery pory roku', st('Tytuł'), { left: przod.x1 + 12, top: g.gora + 78, width: przod.x2 - przod.x1 - 24, fill: '#1c2541', textAlign: 'center' }),
      { type: 'rect', id: 'g', left: grzbiet.x1, top: g.gora + 60, width: grzbiet.x2 - grzbiet.x1, height: 70, fill: '#c9a227', strokeWidth: 0 },
    ];
    O.przeliczOkladki(p);
    const z = await import('./js/app/zapis.js');
    await z.zaladujCel({ dopasuj: true });
    await window.seriodruk.zapiszTeraz();
  });
}

async function zrobZrzutyPartiiD(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: d } = await otworz({ after: (f) => sprzatanie.push(f) });
  try {
    await d.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });

    // Zestaw marki w ustawieniach konta.
    await d.evaluate(async () => {
      const m = await import('./js/zestaw-marki.js');
      await m.zapiszMarke({
        kolory: [
          { id: 'a', nazwa: 'Granat marki', kolor: '#1c2541' },
          { id: 'b', nazwa: 'Złoto', kolor: '#c9a227', cmyk: [0, 20, 85, 20] },
          { id: 'c', nazwa: 'Kremowy', kolor: '#f4efe1' },
        ],
        czcionki: { naglowek: 'Playfair Display', tekst: 'Lora' },
        loga: [],
      });
      location.hash = '#/konto/marka';
    });
    await d.waitForSelector('#ust-marka', { state: 'visible' });
    await d.click('#ust-marka [data-akcja="marka-edytuj"]');
    await d.waitForSelector('#dlg-marka[open] #marka-kolory li');
    await d.waitForTimeout(400);
    await kadr(d, 'k-marka.png', { obszar: '#dlg-marka', zaznacz: '#marka-dodaj-kolor', margines: 8 });
    await d.click('#dlg-marka [data-akcja="marka-zamknij"]');

    await d.evaluate(() => { location.hash = '#/projekty'; });
    await d.waitForFunction(() => document.body.dataset.ekran === 'projekty');
    await nowyProjekt(d, 'Cztery pory roku');
    await d.waitForFunction(() => (globalThis.makietkaMarka?.kolory || []).length === 3);
    await przygotujProjekt(d);

    // Kolory marki w oknie koloru.
    await d.evaluate(() => window.seriodruk.edytor.zaznacz('tlo1'));
    await d.waitForTimeout(300);
    await d.click('#wlasciwosci .kolor-przycisk >> nth=0');
    await d.waitForSelector('.kolor-okienko .kolor-paleta.marki button');
    await d.waitForTimeout(300);
    await kadr(d, 'k-marka-kolor.png', { obszar: '.kolor-okienko', zaznacz: '.kolor-okienko .kolor-z-marki', margines: 8 });
    await d.keyboard.press('Escape');

    // Zastosuj markę do projektu.
    await d.evaluate(async () => (await import('./js/app/marka-zastosuj.js')).otworzZastosowanieMarki());
    await d.waitForSelector('#dlg-marka-zastosuj[open]');
    await d.waitForTimeout(300);
    await kadr(d, 'k-marka-zastosuj.png', { obszar: '#dlg-marka-zastosuj', zaznacz: '#marka-zastosuj-ok', margines: 8 });
    await d.click('#dlg-marka-zastosuj [data-akcja="marka-zastosuj-zamknij"]');

    // Zmiana formatu projektu z podglądem przed i po.
    await d.evaluate(async () => (await import('./js/app/zmiana-formatu.js')).otworzZmianeFormatu(null));
    await d.waitForSelector('#dlg-format[open]');
    await d.selectOption('#form-format select[name="format"]', { index: 1 }).catch(() => {});
    await d.evaluate(() => {
      const f = document.querySelector('#form-format');
      f.elements.szerokosc_mm.value = '210';
      f.elements.wysokosc_mm.value = '210';
      f.elements.szerokosc_mm.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await d.waitForTimeout(500);
    await kadr(d, 'k-format.png', { obszar: '#dlg-format', zaznacz: '#form-format input[value="skaluj"] + span', margines: 8 });
    await d.click('#dlg-format [data-akcja="format-zamknij"]');

    // Makieta 3D w podglądzie.
    await d.click('[data-akcja="podglad"]');
    await d.waitForSelector('.podglad-strona[data-id]');
    await d.click('[data-akcja="podglad-makieta"]');
    await d.waitForSelector('#dlg-makieta[open]');
    await d.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 30000 });
    await d.waitForTimeout(600);
    await kadr(d, 'k-makieta.png', { obszar: '#dlg-makieta', margines: 0 });
    await d.selectOption('#makieta-model', 'kalendarz_scienny');
    await d.click('#makieta-dalej');
    await d.waitForTimeout(1200);
    await d.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 30000 });
    await kadr(d, 'k-makieta-kalendarz.png', { obszar: '.makieta-scena', zaznacz: '#makieta-model', margines: 8 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyPartiiD };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyPartiiD(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
