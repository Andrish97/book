// Przegląd wszystkich makiet 3D (zgłoszenie 19.11: „przegląd wszystkich 3D – czy wyglądają dobrze i czy się dobrze
// budują”): każdy rodzaj na prawdziwym projekcie, leżąca i stojąca (gdzie się da), w kilku położeniach (zamknięta,
// pierwsza rozkładówka, środek, koniec) i w gotowych ujęciach – zrzut samego płótna do obejrzenia.
// Użycie: node scripts/przeglad-makiet.cjs <folder> [--telefon] [--tylko=ksiazka_twarda,...]

const fs = require('node:fs');
const path = require('node:path');
const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');

const ARG = process.argv.slice(2);
const KATALOG = ARG.find((a) => !a.startsWith('--')) || 'przeglad-makiet';
const TELEFON = ARG.includes('--telefon');
const TYLKO = ARG.find((a) => a.startsWith('--tylko='))?.slice(8).split(',');

const PROJEKTY = [
  { nazwa: 'Książka twarda', szablon: 'ksiazka-twarda' },
  { nazwa: 'Książka miękka', szablon: 'ksiazka-miekka' },
  { nazwa: 'Broszura', szablon: 'broszura' },
  { nazwa: 'Kalendarz ścienny', szablon: 'kalendarz-scienny-plecy' },
  { nazwa: 'Kalendarz biurkowy', sekcja: 'kalendarz-biurkowy' },
  { nazwa: 'Zaproszenie', sekcja: 'zaproszenie' },
  { nazwa: 'Ulotka', sekcja: 'broszura-skladana' },
  { nazwa: 'Koperta', specjalna: { typ: 'wykrojnik', ksztalt: 'koperta', koperta: 'C6' } },
  { nazwa: 'Pudełko', specjalna: { typ: 'wykrojnik', ksztalt: 'pudelko', dlugosc_mm: 100, szerokosc_mm: 60, wysokosc_mm: 150 } },
  { nazwa: 'Trójdzielny', specjalna: { typ: 'trojdzielny' } },
];

(async () => {
  fs.mkdirSync(KATALOG, { recursive: true });
  const sprzatanie = [];
  const t = { after: (fn) => sprzatanie.push(fn) };
  const { strona, bledy } = await otworz(t, TELEFON ? { telefon: true } : { widok: { width: 1280, height: 860 } });
  const gotowe = () => strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 60000 });
  const zrzut = async (nazwa) => {
    await strona.waitForTimeout(150);
    await strona.locator('#makieta-plotno').screenshot({ path: path.join(KATALOG, `${nazwa}.png`) });
  };
  try {
    await nowyProjekt(strona, 'Start');
    for (const pr of PROJEKTY) {
      await strona.evaluate(async (opis) => {
        const { zbudujProjekt } = await import('./js/szablony-projektow.js');
        const { wstawGotowaSekcje, usunPustyStart } = await import('./js/gotowe-sekcje.js');
        const P = await import('./js/projekt.js');
        const { przeliczOkladki } = await import('./js/okladka.js');
        const { otworzProjekt } = await import('./js/app/zapis.js');
        let p;
        if (opis.szablon) p = await zbudujProjekt(opis.szablon, { nazwa: opis.nazwa });
        else {
          p = P.normalizuj(P.nowyProjekt(opis.nazwa));
          if (opis.sekcja) {
            const { sekcja } = await wstawGotowaSekcje(p, opis.sekcja, { wlasnyFormat: true });
            usunPustyStart(p, sekcja);
          } else {
            const { typ, ...parametry } = opis.specjalna;
            const s = p.sekcje[0];
            s.typ = typ;
            s.specjalna = { rodzaj: typ, ...parametry };
            p = P.normalizuj(p);
          }
          przeliczOkladki(p);
        }
        // Na każdej stronie numer i kolorowy pas – widać, która strona gdzie trafia i czy nie jest odwrócona.
        for (const [i, s] of p.strony.entries()) {
          s.obiekty.push({ type: 'rect', left: 6, top: 6, width: 30, height: 12, fill: ['#2980b9', '#27ae60', '#8e44ad', '#d35400'][i % 4] });
          s.obiekty.push({ type: 'textbox', left: 8, top: 22, width: 60, text: `Strona ${i + 1}`, fontSize: 9, fill: '#222', fontFamily: 'Inter' });
        }
        await otworzProjekt(p);
      }, pr);
      await strona.waitForFunction((n) => window.seriodruk.stan.projekt?.nazwa === n && window.seriodruk.edytor?.wydruk, pr.nazwa);
      await strona.evaluate(() => { location.hash = `#/p/${window.seriodruk.stan.projekt.id}/podglad`; });
      await strona.waitForSelector('.podglad-strona[data-id]');
      await strona.evaluate(() => document.querySelector('[data-akcja="podglad-makieta"]').click());
      await strona.waitForSelector('#dlg-makieta[open]');
      const M = () => strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).stanMakiety());
      for (const model of (await M()).modele) {
        if (TYLKO && !TYLKO.includes(model)) continue;
        await strona.selectOption('#makieta-model', model);
        await gotowe();
        const { polozen } = await M();
        const stoi = await strona.evaluate(async (m) => (await import('./js/makieta-3d.js')).mozeStac(m), model);
        const przedrostek = `${pr.nazwa.replace(/\s+/g, '-')}-${model}`;
        for (const ul of stoi ? ['lezy', 'stoi'] : ['lezy']) {
          await strona.evaluate(async (u) => (await import('./js/app/makieta-okno.js')).ustawUlozenie(u), ul);
          for (const u of [...new Set([0, 1, Math.floor(polozen / 2), polozen])].filter((x) => x <= polozen)) {
            await strona.evaluate((v) => { const s = document.querySelector('#makieta-rozkladowka'); s.value = String(v); s.dispatchEvent(new Event('change')); }, u);
            await strona.waitForTimeout(1600);
            await gotowe();
            await zrzut(`${przedrostek}-${ul}-u${u}`);
          }
        }
        // Gotowe ujęcia (kafelki nad makietą).
        for (const id of await strona.$$eval('[data-ujecie]', (b) => b.filter((x) => x.offsetParent).map((x) => x.dataset.ujecie))) {
          await strona.evaluate((i) => document.querySelector(`[data-ujecie="${i}"]`).click(), id);
          await strona.waitForTimeout(1600);
          await gotowe();
          await zrzut(`${przedrostek}-ujecie-${id}`);
        }
      }
      await strona.evaluate(() => document.querySelector('[data-akcja="makieta-zamknij"]').click());
      await strona.waitForSelector('#dlg-makieta', { state: 'hidden' });
      await strona.evaluate(() => { location.hash = '#/projekty'; });
      await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
    }
  } finally {
    console.log(bledy.length ? `Błędy: ${bledy.join('\n')}` : 'Bez błędów.');
    for (const fn of sprzatanie) await fn();
  }
})();
