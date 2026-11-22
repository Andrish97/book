#!/usr/bin/env node
// Przykładowe projekty dla konta testowego recenzentów katalogu łączników Claude (plan I8): po angielsku,
// zbudowane z szablonów aplikacji, zapisane jako pliki .makietka w ai/przyklady/recenzja/. Właściciel otwiera je
// na koncie testowym (Projekty → przeciągnij plik albo „Otwórz plik”), a projekty trafiają na konto.
//   node scripts/przyklady-recenzji.cjs
const fs = require('node:fs');
const path = require('node:path');
const { otworz } = require('../tests/pomoc.cjs');

const CEL = path.join(__dirname, '..', 'ai', 'przyklady', 'recenzja');
const PRZYKLADY = [
  ['kalendarz-scienny-plecy', 'Wall calendar 2027', 'wall-calendar-2027'],
  ['komiks', 'Comic – The Parcel', 'comic-the-parcel'],
  ['broszura', 'Brochure – Spring Fair', 'brochure-spring-fair'],
];

(async () => {
  const sprzatanie = [];
  try {
    const { strona } = await otworz({ after: (f) => sprzatanie.push(f) });
    await strona.evaluate(() => localStorage.setItem('makietka-jezyk', 'en'));
    await strona.reload();
    await strona.waitForFunction(() => document.documentElement.lang === 'en');
    fs.mkdirSync(CEL, { recursive: true });
    for (const [szablon, nazwa, plik] of PRZYKLADY) {
      const b64 = await strona.evaluate(async ([s, n]) => {
        await (await import('./js/app/doczytaj.js')).czekajNaEdytor(); // biblioteka płótna dla szablonów
        const { zbudujProjekt } = await import('./js/szablony-projektow.js');
        const { normalizuj } = await import('./js/projekt.js');
        const { zapiszPlikProjektu } = await import('./js/plik-projektu.js');
        const p = normalizuj(await zbudujProjekt(s, { nazwa: n }));
        // Nazwy części i przykładowy akapit z szablonów są po polsku – dla recenzentów po angielsku (kalendarz zostaje
        // polski: polskie święta, dni i miesiące to cecha kalendarza Makietki).
        const NAZWY = { 'Okładka zeszytowa': 'Saddle-stitched cover', 'Blok (środek)': 'Inside pages', Komiks: 'Comic', Okładka: 'Cover', Scenariusz: 'Script',
          'Kalendarz ścienny': 'Wall calendar', 'Plecy (karton)': 'Backing board', 'Okładka kalendarza': 'Calendar cover', 'Miesiące 2027': 'Months 2027', Miesiące: 'Months', Miesiąc: 'Month',
          'Kalendarz miesiąca': 'Month calendar', 'Nazwa miesiąca': 'Month name', 'Miejsce na zdjęcie': 'Photo frame', Nagłówek: 'Heading', Tytuł: 'Title', Podtytuł: 'Subtitle', Tło: 'Background' };
        const AKAPIT = 'Every good story begins with a single sentence that invites the reader in. This placeholder text shows how a paragraph will look on the page – replace it with your own.';
        const tlumacz = (x) => {
          if (Array.isArray(x)) x.forEach(tlumacz);
          else if (x && typeof x === 'object') {
            for (const [k, v] of Object.entries(x)) {
              if (k === 'nazwa' && NAZWY[v]) x[k] = NAZWY[v];
              else if (k === 'text' && typeof v === 'string' && v.startsWith('Każda dobra historia')) x[k] = AKAPIT;
              else tlumacz(v);
            }
          }
        };
        if (s !== 'kalendarz-scienny-plecy') tlumacz(p);
        else for (const x of [...p.sekcje, ...(p.tabele || [])]) if (NAZWY[x.nazwa]) x.nazwa = NAZWY[x.nazwa];
        const blob = await zapiszPlikProjektu(p);
        const u8 = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
        return btoa(bin);
      }, [szablon, nazwa]);
      fs.writeFileSync(path.join(CEL, `${plik}.makietka`), Buffer.from(b64, 'base64'));
      console.log(`✓ ${plik}.makietka`);
    }
  } finally { for (const f of sprzatanie) await f(); }
})().catch((e) => { console.error(e); process.exit(1); });
