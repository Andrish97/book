// Zrzuty instrukcji do rozdziału „Książka” (#131B): ksiazka.png, k-spis-tresci.png, k-przypisy.png.
// Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutyKsiazki na końcu; tu można je zrobić osobno,
// gdy pełny komplet nie mieści się w pamięci maszyny.
//
// Użycie:  node scripts/zrzuty-ksiazki.cjs [adres] [ciemny]

const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

// Projekt książki na otwartej stronie aplikacji: spis treści, dwa rozdziały, przypis, odsyłacz, stopka z paginą.
async function przygotujKsiazke(d) {
  await d.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { nowaStrona, nowyWzorzec } = await import('./js/projekt.js');
    const st = (n) => stan.projekt.style.find((s) => s.nazwa === n);
    const sek = stan.projekt.sekcje[0];
    const t = (id, txt, s, extra = {}) => ({ type: 'textbox', id, left: 15, top: 22, width: 118, text: txt, styl: s.id, fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, fill: s.fill, styles: [], ...extra });
    const tresc = 'Kot domowy towarzyszy człowiekowi od tysięcy lat. Łowi myszy, śpi szesnaście godzin na dobę i sam decyduje, kiedy ma ochotę na towarzystwo.';
    stan.projekt.strony[0].obiekty = [
      { type: 'textbox', id: 'tyt', left: 15, top: 22, width: 118, text: 'Spis treści', fontFamily: 'Playfair Display', fontSize: 7, fontWeight: 'bold', fill: '#1a1a1a', styles: [] },
      { type: 'textbox', id: 'spis', left: 15, top: 40, width: 118, text: '', fontFamily: 'Inter', fontSize: 3.7, lineHeight: 1.6, fill: '#1a1a1a', styles: [], ksiazka: { rodzaj: 'spis', poziomy: 2, kropki: true } },
    ];
    stan.projekt.strony.push(
      { ...nowaStrona('Koty', sek.id), obiekty: [
        t('r1', 'Koty', st('Tytuł')),
        t('n1', 'Pochodzenie', st('Nagłówek'), { top: 45 }),
        t('b1', `${tresc} {przypis:pp1}Zob. też psy, s. {s:r2}.`, st('Tekst'), { top: 58, przypisy: { pp1: 'Felis catus – kot domowy, udomowiony ok. 9500 lat temu.' }, hasla: ['kot'],
          styles: [{ start: tresc.length + 1, end: tresc.length + 1 + '{przypis:pp1}'.length, style: { fontSize: st('Tekst').fontSize * 0.62, deltaY: -st('Tekst').fontSize * 0.36 } }] }),
      ] },
      { ...nowaStrona('Psy', sek.id), obiekty: [t('r2', 'Psy', st('Tytuł')), t('b2', 'Pies to najlepszy przyjaciel kota – zwykle.', st('Tekst'), { top: 45 })] },
    );
    const w = nowyWzorzec('Stopka', sek.wydruk);
    w.obiekty = [{ type: 'textbox', id: 'pagina', left: 15, top: 202, width: 118, text: '{rozdzial}\t{nr}', fontFamily: 'Inter', fontSize: 3, fill: '#6b6861', styles: [], tabulatory: [{ poz: 117.5, rodzaj: 'prawy', wypelniacz: '' }] }];
    stan.projekt.wzorce.push(w);
    sek.wzorce = [w.id];
    const { przeliczKsiazke } = await import('./js/ksiazka.js');
    przeliczKsiazke(stan.projekt);
    const z = await import('./js/app/zapis.js');
    await z.zaladujCel({ dopasuj: true });
  });
}

// Trzy kadry rozdziału „Książka”. `kadr` – funkcja z scripts/zrzuty-instrukcji.cjs (katalog i motyw z jej argumentów).
async function zrobZrzutyKsiazki(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: d } = await otworz({ after: (f) => sprzatanie.push(f) });
  try {
    await d.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(d, 'Książka o zwierzętach');
    await przygotujKsiazke(d);
    // Strona 2: rozdział z przypisem i paginą w stopce.
    await d.evaluate(async () => { const { przejdzDoStrony } = await import('./js/app/lista-stron.js'); await przejdzDoStrony(1); window.seriodruk.edytor.dopasujDoOkna(); });
    await d.waitForTimeout(500);
    await kadr(d, 'ksiazka.png', { obszar: '.arkusz', margines: 6 });
    await d.evaluate(() => window.seriodruk.edytor.zaznacz('b1'));
    await d.waitForTimeout(300);
    await d.evaluate(() => [...document.querySelectorAll('#wlasciwosci legend')].find((l) => l.textContent.includes('Przypisy, odsyłacze'))?.scrollIntoView({ block: 'start' }));
    await d.waitForTimeout(300);
    await kadr(d, 'k-przypisy.png', { obszar: ['#panel-inspektor fieldset:has(> legend:has-text("Przypisy, odsyłacze"))'], zaznacz: '#wlasciwosci button:has-text("Wstaw przypis")', margines: 8 });
    // Strona 1: spis treści i jego panel.
    await d.evaluate(async () => { const { przejdzDoStrony } = await import('./js/app/lista-stron.js'); await przejdzDoStrony(0); window.seriodruk.edytor.zaznacz('spis'); });
    await d.waitForTimeout(500);
    await d.evaluate(() => [...document.querySelectorAll('#wlasciwosci legend')].find((l) => l.textContent.includes('Spis treści'))?.scrollIntoView({ block: 'start' }));
    await kadr(d, 'k-spis-tresci.png', { obszar: ['.arkusz', '#panel-inspektor fieldset:has(> legend:has-text("Spis treści"))'], margines: 6 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { przygotujKsiazke, zrobZrzutyKsiazki };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyKsiazki(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
