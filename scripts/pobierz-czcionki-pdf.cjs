// Pobiera wbudowane czcionki w postaci do osadzania w PDF (css/czcionki/pdf/).
//
// Czcionki ekranowe (css/czcionki/*.woff2) są „zmienne”: jeden plik niesie wszystkie
// grubości i jest podzielony na zestawy znaków. PDF potrzebuje zwykłego pliku TTF dla
// każdej odmiany, z kompletem znaków. Stąd osobny zestaw: zwykła i pogrubiona, prosta
// i kursywa, ograniczone do znaków łacińskich z polskimi i typograficznymi.
//
// Uruchomienie (tylko przy zmianie listy czcionek):  node scripts/pobierz-czcionki-pdf.cjs

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// [rodzina, czy ma kursywę]
const RODZINY = [['Caveat', false], ['Inter', true], ['Lora', true], ['Merriweather', true], ['Montserrat', true], ['Open Sans', true], ['Playfair Display', true], ['Source Serif 4', true]];
const WAGI = [400, 700];
const STARA_PRZEGLADARKA = 'Mozilla/4.0'; // takiej Google podaje pliki TTF, osobny dla każdej odmiany

// Znaki: ASCII, Latin-1, Latin Extended-A oraz typograficzne (cudzysłowy, pauzy, wielokropek, euro, strzałki, punkty list).
let ZNAKI = '';
for (let c = 0x20; c <= 0x7e; c += 1) ZNAKI += String.fromCodePoint(c);
for (let c = 0xa0; c <= 0x17f; c += 1) ZNAKI += String.fromCodePoint(c);
ZNAKI += '‐‑‒–—‘’‚“”„†‡•…‰′″‹›€№™←↑→↓−●○■□✓★';

const katalog = path.join(__dirname, '..', 'css', 'czcionki', 'pdf');
fs.rmSync(katalog, { recursive: true, force: true });
fs.mkdirSync(katalog, { recursive: true });

const pobierz = (url) => execFileSync('curl', ['-sS', '--fail', '-A', STARA_PRZEGLADARKA, url], { maxBuffer: 64 * 1024 * 1024 });
const slug = (rodzina) => rodzina.toLowerCase().replace(/\s+/g, '-');

let razem = 0;
let ile = 0;
for (const [rodzina, kursywa] of RODZINY) {
  const osie = kursywa ? `ital,wght@${[0, 1].flatMap((i) => WAGI.map((w) => `${i},${w}`)).join(';')}` : `wght@${WAGI.join(';')}`;
  const css = pobierz(`https://fonts.googleapis.com/css2?family=${rodzina.replace(/ /g, '+')}:${osie}&text=${encodeURIComponent(ZNAKI)}`).toString();
  for (const [, blok] of css.matchAll(/@font-face \{([^}]+)\}/g)) {
    const pole = (nazwa) => blok.match(new RegExp(`${nazwa}: ([^;]+);`))[1].trim();
    const [, url, format] = blok.match(/url\((https:[^)]+)\) format\('([a-z0-9]+)'\)/);
    if (format !== 'truetype') throw new Error(`Nieoczekiwany format ${format} dla ${rodzina}`);
    const plik = path.join(katalog, `${slug(rodzina)}-${pole('font-weight')}-${pole('font-style') === 'italic' ? 'kursywa' : 'prosta'}.ttf`);
    fs.writeFileSync(plik, pobierz(url));
    razem += fs.statSync(plik).size;
    ile += 1;
  }
}
console.log(`${ile} plików, ${(razem / 1024).toFixed(0)} kB`);
