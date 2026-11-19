// Zrzuty instrukcji do partii D (#131D): k-format.png (zmiana formatu), k-marka.png, k-marka-kolor.png,
// k-marka-zastosuj.png (zestaw marki), k-makieta.png, k-makieta-kalendarz.png (makieta 3D); #181: k-makieta-ujecia.png
// (gotowe ujęcia), k-makieta-swiatlo.png („Ujęcie i światło”), k-makieta-stos.png (stos na drewnie), k-makieta-specjalne.png (ulotka
// i pudełko z wykrojnika).
// Pełny skrypt scripts/zrzuty-instrukcji.cjs wywołuje zrobZrzutyPartiiD na końcu; tu można je zrobić osobno.
//
// Użycie:  node scripts/zrzuty-partii-d.cjs [adres] [ciemny] [makieta]   (makieta – tylko kadry makiety 3D)

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

async function zrobZrzutyPartiiD(kadr, { ciemny = false, tylkoMakieta = false } = {}) {
  const sprzatanie = [];
  const { strona: d } = await otworz({ after: (f) => sprzatanie.push(f) });
  try {
    await d.emulateMedia({ colorScheme: ciemny ? 'dark' : 'light' });

    // Zestaw marki w ustawieniach konta.
    if (!tylkoMakieta) {
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
    }

    await d.evaluate(() => { location.hash = '#/projekty'; });
    await d.waitForFunction(() => document.body.dataset.ekran === 'projekty');
    await nowyProjekt(d, 'Cztery pory roku');
    if (!tylkoMakieta) await d.waitForFunction(() => (globalThis.makietkaMarka?.kolory || []).length === 3);
    await przygotujProjekt(d);

    if (!tylkoMakieta) {

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
    }

    // Makieta 3D w podglądzie. Do kadru sekcji specjalnych – ulotka składana i pudełko z wykrojnika (#181).
    await d.evaluate(async () => {
      const P = await import('./js/projekt.js');
      const S = await import('./js/sekcje-specjalne.js');
      const O = await import('./js/okladka.js');
      const p = window.seriodruk.stan.projekt;
      const dodaj = (nazwa, rodzaj, param, strony) => {
        const s = P.nowaSekcja(nazwa);
        s.typ = rodzaj;
        s.specjalna = { ...S.domyslnaSpecjalna(rodzaj), ...param };
        p.sekcje.push(s);
        for (const [tlo, obiekty] of strony) { const st = P.nowaStrona(nazwa, s.id); st.tlo = tlo; st.obiekty = obiekty; p.strony.push(st); }
        return s;
      };
      const napis = (id, text, left, top, fill, size = 9) => ({ type: 'textbox', id, left, top, width: 80, text, fontFamily: 'Lora', fontSize: size, fontWeight: 'bold', fill, styles: [] });
      dodaj('Ulotka', 'ulotka', { panele: 3, zlozenie: 'c' }, [
        ['#0b525b', [napis('u1', 'Ogród botaniczny', 210, 30, '#f4efe1', 10), { type: 'rect', id: 'u2', left: 205, top: 120, width: 80, height: 60, fill: '#c9a227', strokeWidth: 0 }]],
        ['#f4efe1', [napis('u3', 'Godziny otwarcia', 12, 20, '#0b525b'), napis('u4', 'Mapa', 110, 20, '#0b525b'), napis('u5', 'Bilety', 208, 20, '#0b525b')]],
      ]);
      dodaj('Pudełko', 'wykrojnik', { ksztalt: 'pudelko', dlugosc_mm: 90, szerokosc_mm: 55, wysokosc_mm: 130 }, [
        ['#5f0f40', [napis('p1', 'HERBATA', 30, 120, '#f4efe1', 12)]],
      ]);
      O.przeliczOkladki(p);
    });
    await d.click('[data-akcja="podglad"]');
    await d.waitForSelector('.podglad-strona[data-id]');
    await d.click('[data-akcja="podglad-makieta"]');
    await d.waitForSelector('#dlg-makieta[open]');
    const gotowe = async () => {
      await d.waitForTimeout(800);
      await d.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 60000 });
      await d.waitForTimeout(600);
    };
    const M = (f, ...a) => d.evaluate(async ([f, a]) => (await import('./js/app/makieta-okno.js'))[f](...a), [f, a]);
    await d.selectOption('#makieta-model', 'ksiazka_twarda');
    await M('ustawOpcjeMakiety', { tlo: 'studio', swiatlo: 'lewo', barwa: 'neutralna' });
    await gotowe();
    // Książka otwarta na rozkładówce – kartki wygięte przy grzbiecie, cień w zgięciu i pod książką.
    await d.click('#makieta-dalej');
    await d.click('#makieta-dalej');
    await gotowe();
    await kadr(d, 'k-makieta.png', { obszar: '#dlg-makieta', margines: 0 });
    // Gotowe ujęcia i „Ujęcie i światło” (#181): wachlarz kartek, ciepłe światło z okna, tło – drewno.
    await d.click('.makieta-ujecie[data-ujecie="wachlarz"]');
    await M('ustawOpcjeMakiety', { tlo: 'drewno', swiatlo: 'okno', barwa: 'ciepla' });
    await d.evaluate(() => { document.querySelector('#makieta-ustawienia').open = true; });
    await gotowe();
    await d.evaluate(() => document.querySelector('#makieta-ujecia').scrollIntoView({ block: 'start' }));
    await kadr(d, 'k-makieta-ujecia.png', { obszar: ['#makieta-ujecia', '.makieta-sterowanie'], zaznacz: '.makieta-ujecie[data-ujecie="wachlarz"]', margines: 8 });
    await d.evaluate(() => document.querySelector('#makieta-ustawienia').scrollIntoView({ block: 'end' }));
    await d.waitForTimeout(300);
    await kadr(d, 'k-makieta-swiatlo.png', { obszar: '#makieta-ustawienia', zaznacz: '#makieta-ustawienia .makieta-grupy > fieldset:nth-child(2) > label:first-of-type', margines: 8 });
    await d.evaluate(() => { document.querySelector('#makieta-ustawienia').open = false; });
    await d.click('.makieta-ujecie[data-ujecie="stos"]');
    await gotowe();
    await kadr(d, 'k-makieta-stos.png', { obszar: '.makieta-scena', margines: 0 });
    await M('ustawOpcjeMakiety', { tlo: 'studio', swiatlo: 'lewo', barwa: 'neutralna' });
    // Sekcje specjalne: ulotka w trakcie rozkładania i złożone pudełko – jedno obok drugiego.
    await d.selectOption('#makieta-model', 'ulotka');
    await M('ustawPolozenieMakiety', 0.55, { natychmiast: true });
    await M('ustawKamereMakiety', { obrotY: -0.25, obrotX: 0.75 });
    await gotowe();
    const ulotka = await d.evaluate(async () => URL.createObjectURL(await (await import('./js/app/makieta-okno.js')).obrazMakiety({ rozmiar: 'wlasny', wlasny: 900 })));
    await d.selectOption('#makieta-model', 'pudelko');
    await M('ustawPolozenieMakiety', 1, { natychmiast: true });
    await M('ustawKamereMakiety', { obrotY: -0.6, obrotX: 0.45 });
    await gotowe();
    const pudelko = await d.evaluate(async () => URL.createObjectURL(await (await import('./js/app/makieta-okno.js')).obrazMakiety({ rozmiar: 'wlasny', wlasny: 900 })));
    await d.evaluate(([a, b]) => {
      const box = document.createElement('div');
      box.id = 'kadr-specjalne';
      Object.assign(box.style, { position: 'fixed', left: '0', top: '0', display: 'flex', gap: '0', zIndex: 2147483646, background: '#fff' });
      for (const u of [a, b]) { const i = document.createElement('img'); i.src = u; i.style.width = '560px'; box.append(i); }
      document.querySelector('#dlg-makieta').append(box); // w oknie – nad nim (warstwa okna modalnego)
    }, [ulotka, pudelko]);
    await d.waitForFunction(() => [...document.querySelectorAll('#kadr-specjalne img')].every((i) => i.complete && i.naturalWidth));
    await kadr(d, 'k-makieta-specjalne.png', { obszar: '#kadr-specjalne', margines: 0 });
    await d.evaluate(() => document.querySelector('#kadr-specjalne').remove());
    await d.selectOption('#makieta-model', 'kalendarz_scienny');
    await d.click('#makieta-dalej');
    await gotowe();
    await kadr(d, 'k-makieta-kalendarz.png', { obszar: '.makieta-scena', zaznacz: '#makieta-model', margines: 8 });
  } finally {
    for (const f of sprzatanie) await f();
  }
}

module.exports = { zrobZrzutyPartiiD };

if (require.main === module) {
  const { kadr } = require('./zrzuty-instrukcji.cjs');
  zrobZrzutyPartiiD(kadr, { ciemny: process.argv[3] === 'ciemny', tylkoMakieta: process.argv.includes('makieta') }).catch((e) => { console.error(e); process.exit(1); });
}
