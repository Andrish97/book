// Pobiera czcionki aplikacji do repozytorium (css/czcionki/) i zapisuje
// css/czcionki.css. Dzięki temu aplikacja nie zależy od serwerów Google:
// działa bez internetu, a wydruk nie zmieni się, gdy Google podmieni plik.
//
// Uruchomienie (tylko przy zmianie listy czcionek w js/zestaw-czcionek.js):  node scripts/pobierz-czcionki.cjs
//
// Brane są tylko zestawy znaków „latin” i „latin-ext” (polskie litery).
// Wszystkie czcionki są na licencji SIL Open Font License 1.1.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { ZESTAW, adresRodziny } = require('./zestaw.cjs');

// Lista rodzin: js/zestaw-czcionek.js. Inter ma też grubości 500 i 600 – używa go interfejs aplikacji.
const RODZINY = ZESTAW.map((c) => (c.nazwa === 'Inter' ? 'Inter:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700' : adresRodziny(c)));
const ZESTAWY = ['latin', 'latin-ext'];
const PRZEGLADARKA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const katalog = path.join(__dirname, '..', 'css', 'czcionki');
fs.mkdirSync(katalog, { recursive: true });
for (const plik of fs.readdirSync(katalog)) if (plik.endsWith('.woff2')) fs.rmSync(path.join(katalog, plik));

const pobierz = (url, doPliku) => execFileSync('curl', ['-sS', '--fail', '-A', PRZEGLADARKA, ...(doPliku ? ['-o', doPliku] : []), url], { maxBuffer: 64 * 1024 * 1024 });

let css = '';
for (let i = 0; i < RODZINY.length; i += 10) {
  css += pobierz(`https://fonts.googleapis.com/css2?${RODZINY.slice(i, i + 10).map((r) => `family=${r}`).join('&')}&display=swap`).toString();
}

// Google podaje ten sam plik dla kilku grubości (czcionki zmienne) – każdy
// adres pobieramy raz, a reguły łączymy w jedną z zakresem grubości.
const reguly = new Map();
for (const [, zestaw, blok] of css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]+)\}/g)) {
  if (!ZESTAWY.includes(zestaw)) continue;
  const pole = (nazwa) => blok.match(new RegExp(`${nazwa}: ([^;]+);`))[1].trim();
  const url = blok.match(/url\((https:[^)]+)\)/)[1];
  const klucz = `${url}|${pole('font-style')}`;
  const r = reguly.get(klucz) || { rodzina: pole('font-family').replace(/'/g, ''), styl: pole('font-style'), wagi: [], zakres: pole('unicode-range'), url, zestaw };
  r.wagi.push(Number(pole('font-weight')));
  reguly.set(klucz, r);
}

const wynik = ['/* Czcionki aplikacji – pliki w repozytorium (SIL Open Font License 1.1).', '   Plik tworzy scripts/pobierz-czcionki.cjs – nie edytuj ręcznie. */', ''];
let razem = 0;
for (const r of reguly.values()) {
  const wagi = [...new Set(r.wagi)].sort((a, b) => a - b);
  const nazwa = `${r.rodzina.toLowerCase().replace(/\s+/g, '-')}-${r.styl === 'italic' ? 'kursywa' : 'prosta'}-${wagi.length > 1 ? `${wagi[0]}-${wagi.at(-1)}` : wagi[0]}-${r.zestaw}.woff2`;
  const plik = path.join(katalog, nazwa);
  pobierz(r.url, plik);
  razem += fs.statSync(plik).size;
  wynik.push(
    '@font-face {',
    `  font-family: "${r.rodzina}"; font-style: ${r.styl}; font-weight: ${wagi.length > 1 ? `${wagi[0]} ${wagi.at(-1)}` : wagi[0]}; font-display: swap;`,
    `  src: url("czcionki/${nazwa}") format("woff2");`,
    `  unicode-range: ${r.zakres};`,
    '}',
  );
}
fs.writeFileSync(path.join(__dirname, '..', 'css', 'czcionki.css'), `${wynik.join('\n')}\n`);
console.log(`${reguly.size} plików, ${(razem / 1024).toFixed(0)} kB`);

// Pliki TTF do osadzania w PDF i do pobierania oraz plik licencji – z tej samej listy.
require('./pobierz-czcionki-pdf.cjs');
