// Zrzuty instrukcji do narzędzi pracy (#131C, #136): k-znajdz.png, k-malarz.png, k-moje-elementy.png,
// k-pisownia.png, k-kolory-uzyte.png, k-czcionki-uzyte.png. Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje
// zrobZrzutyPracy na końcu; tu można je zrobić osobno, gdy pełny komplet nie mieści się w pamięci maszyny.
//
// Użycie:  node scripts/zrzuty-pracy.cjs [adres] [ciemny]

const { otworz, nowyProjekt, PNG_2X2 } = require('../tests/pomoc.cjs');

// Strona z nagłówkiem, tekstem z literówką i dwoma kolorowymi kształtami.
async function przygotujStrone(d) {
  await d.evaluate(async () => {
    const { stan } = window.seriodruk;
    const st = (n) => stan.projekt.style.find((s) => s.nazwa === n) || stan.projekt.style[0];
    const t = (id, txt, s, extra = {}) => ({ type: 'textbox', id, left: 15, top: 22, width: 118, text: txt, styl: s.id, fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, fill: s.fill, styles: [], ...extra });
    stan.projekt.strony[0].obiekty = [
      t('tytul', 'Kalendarz rodzinny 2027', st('Tytuł'), { fill: '#9d0208' }),
      t('opis', 'Na każdy miesiąc – zdjęcie z wakacji i miejsce na notatki. Kalendarz drukujemy w listopadzie, więc zdjęcia przyślijcie wcześniej.', st('Tekst'), { top: 48 }),
      t('uwaga', 'Zdjęcia przyślijcie wczesniej!', st('Tekst'), { top: 132, fontSize: 6, fill: '#370617' }),
      { type: 'rect', id: 'r1', left: 15, top: 90, width: 50, height: 30, fill: '#9d0208', rx: 3, ry: 3, stroke: '#370617', strokeWidth: 1 },
      { type: 'rect', id: 'r2', left: 80, top: 90, width: 50, height: 30, fill: '#ffba08', rx: 0, ry: 0, strokeWidth: 0 },
    ];
    const z = await import('./js/app/zapis.js');
    await z.zaladujCel({ dopasuj: true });
    await window.seriodruk.zapiszTeraz();
  });
}

// `kadr` – funkcja z scripts/zrzuty-instrukcji.cjs (katalog i motyw z jej argumentów).
async function zrobZrzutyPracy(kadr, { ciemny = false } = {}) {
  const sprzatanie = [];
  const { strona: d } = await otworz({ after: (f) => sprzatanie.push(f) });
  try {
    await d.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });
    await nowyProjekt(d, 'Kalendarz rodzinny');
    await przygotujStrone(d);

    // Znajdź i zamień: panel obok strony z trafieniami i polem zamiany.
    await d.evaluate(() => window.seriodruk.edytor.odznacz());
    await d.keyboard.press('Control+KeyH');
    await d.waitForSelector('#dlg-znajdz[open]');
    await d.fill('#znajdz-fraza', 'kalendarz');
    await d.fill('#znajdz-zamien', 'planer');
    await d.waitForFunction(() => document.querySelectorAll('#znajdz-lista .trafienie').length === 2);
    await d.click('#znajdz-lista li:nth-child(1) .trafienie');
    await d.waitForTimeout(400);
    await kadr(d, 'k-znajdz.png', { obszar: ['#dlg-znajdz', '.arkusz'], zaznacz: '#znajdz-zamien-wszystkie', margines: 8 });
    await d.click('#znajdz-zamknij');

    // Malarz formatów: przycisk w rzędzie akcji panelu (włączony).
    await d.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz('r1'); });
    await d.waitForTimeout(300);
    await d.click('#akcje-obiektu [data-akcja="malarz"]');
    await d.waitForTimeout(300);
    await kadr(d, 'k-malarz.png', { obszar: '#naglowek-wlasciwosci', zaznacz: '#akcje-obiektu [data-akcja="malarz"]', margines: 10 });
    await d.keyboard.press('Escape');

    // Użyte w projekcie: okienko koloru wypełnienia.
    await d.evaluate(() => window.seriodruk.edytor.zaznacz('r2'));
    await d.waitForTimeout(300);
    await d.click('#wlasciwosci .kolor-przycisk >> nth=0');
    await d.waitForSelector('.kolor-uzyte:not([hidden])');
    await d.waitForTimeout(300);
    await kadr(d, 'k-kolory-uzyte.png', { obszar: '.kolor-okienko', zaznacz: '.kolor-uzyte', margines: 8 });
    await d.keyboard.press('Escape');

    // Użyte w projekcie: lista czcionek tekstu.
    await d.evaluate(() => window.seriodruk.edytor.zaznacz('tytul'));
    await d.waitForTimeout(400);
    const lista = d.locator('#wlasciwosci label:has(select:has(optgroup[label="Wszystkie czcionki"])) .wybor-przycisk').first();
    await lista.scrollIntoViewIfNeeded();
    await lista.click();
    await d.waitForSelector('.wybor-grupa');
    await d.waitForTimeout(300);
    // Lista sama przewija się do wybranej czcionki – do kadru pokazujemy jej górę z „Użytymi w projekcie”.
    await d.evaluate(() => { for (const l of document.querySelectorAll('.wybor-lista')) l.scrollTop = 0; });
    await d.waitForTimeout(200);
    await kadr(d, 'k-czcionki-uzyte.png', { obszar: ['.wybor-lista:visible', '#wlasciwosci label:has(select:has(optgroup[label="Wszystkie czcionki"]))'], zaznacz: '.wybor-grupa >> nth=0', margines: 8 });
    await d.keyboard.press('Escape');

    // Pisownia: falista linia pod błędem i część „Pisownia” panelu.
    await d.evaluate(() => window.seriodruk.edytor.zaznacz('uwaga'));
    await d.waitForSelector('.lista-pisowni .blad-pisowni', { timeout: 30000 });
    await d.evaluate(() => [...document.querySelectorAll('#wlasciwosci legend')].find((l) => l.textContent.includes('Pisownia'))?.scrollIntoView({ block: 'start' }));
    await d.waitForTimeout(500);
    await kadr(d, 'k-pisownia.png', { obszar: ['.arkusz', '#panel-inspektor fieldset:has(> legend:has-text("Pisownia"))'], zaznacz: '.blad-pisowni button >> nth=0', margines: 6 });

    // Dymek pisowni przy podkreślonym słowie (#140).
    await d.evaluate(() => {
      const e = window.seriodruk.edytor;
      const o = e.canvas.getObjects().find((x) => x.id === 'uwaga');
      e.canvas.setActiveObject(o);
      const i = o.text.indexOf('wczesniej') + 3;
      o.enterEditing(); o.selectionStart = o.selectionEnd = i;
      const { lineIndex, charIndex } = o.get2DCursorLocation(i);
      const znak = o.__charBounds[lineIndex][charIndex];
      const p = new fabric.Point(o._getLeftOffset() + znak.left, o._getTopOffset() + o.getHeightOfLine(0)).transform(o.calcTransformMatrix()).transform(e.canvas.viewportTransform);
      const r = e.canvas.upperCanvasEl.getBoundingClientRect();
      e.canvas.fire('mouse:up', { target: o, e: { clientX: r.left + p.x, clientY: r.top + p.y } });
    });
    await d.waitForSelector('#menu-pisowni:not([hidden]) .podpowiedz-pisowni', { timeout: 30000 });
    await d.waitForTimeout(300);
    await kadr(d, 'k-pisownia-dymek.png', { obszar: ['#menu-pisowni', '.arkusz'], zaznacz: '#menu-pisowni .podpowiedz-pisowni >> nth=0', margines: 8 });
    await d.evaluate(() => { document.getElementById('menu-pisowni').hidden = true; window.seriodruk.edytor.aktywny?.exitEditing?.(); });

    // Moje elementy: logo z podpisem zapisane w Bibliotece.
    await d.setInputFiles('#plik-obraz', { name: 'logo.png', mimeType: 'image/png', buffer: PNG_2X2 });
    await d.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'image'));
    await d.evaluate(() => { const e = window.seriodruk.edytor; e.odznacz(); e.zaznacz('r1'); });
    await d.click('#akcje-obiektu [data-akcja="zapisz-w-bibliotece"]');
    await d.waitForSelector('#dlg-nazwa[open]');
    await d.fill('#dlg-nazwa input', 'Czerwona plakietka');
    await d.click('#dlg-nazwa button[value="tak"]');
    await d.waitForSelector('#dlg-biblioteka[open] .kafel-z-akcjami');
    await d.mouse.move(2, 2);
    await d.waitForTimeout(500);
    await kadr(d, 'k-moje-elementy.png', { obszar: ['#dlg-biblioteka', '#akcje-obiektu'], zaznacz: '#kategorie-biblioteki [data-kategoria="moje"]', margines: 8 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyPracy };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyPracy(kadr, { ciemny: process.argv[3] === 'ciemny' }).catch((e) => { console.error(e); process.exit(1); });
}
