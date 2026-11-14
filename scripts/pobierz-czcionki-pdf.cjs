// Pobiera czcionki zestawu w postaci zwykłych plików TTF (css/czcionki/pdf/) i zapisuje
// css/czcionki/LICENCJA.txt.
//
// Czcionki ekranowe (css/czcionki/*.woff2) bywają „zmienne”: jeden plik niesie wszystkie
// grubości i jest podzielony na zestawy znaków. PDF i drukarnia potrzebują zwykłego pliku TTF
// dla każdej odmiany, z kompletem znaków. Stąd osobny zestaw: zwykła i pogrubiona, prosta
// i kursywa (o ile czcionka je ma), ograniczone do znaków łacińskich z polskimi i typograficznymi.
//
// Lista rodzin: js/zestaw-czcionek.js. Uruchamia go scripts/pobierz-czcionki.cjs.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { ZESTAW, adresRodziny, slug } = require('./zestaw.cjs');

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

// Wpis z tabeli nazw pliku TTF (0 – prawa autorskie, 13 – opis licencji, 14 – adres licencji).
function nazwaZPliku(b, id) {
  const ile = b.readUInt16BE(4);
  for (let i = 0; i < ile; i += 1) {
    if (b.toString('latin1', 12 + i * 16, 16 + i * 16) !== 'name') continue;
    const t = b.readUInt32BE(12 + i * 16 + 8);
    const n = b.readUInt16BE(t + 2);
    const teksty = t + b.readUInt16BE(t + 4);
    for (let k = 0; k < n; k += 1) {
      const r = t + 6 + k * 12;
      if (b.readUInt16BE(r + 6) !== id) continue;
      const platforma = b.readUInt16BE(r);
      const bajty = b.subarray(teksty + b.readUInt16BE(r + 10), teksty + b.readUInt16BE(r + 10) + b.readUInt16BE(r + 8));
      if (platforma === 3 || platforma === 0) { const le = Buffer.from(bajty); le.swap16(); return le.toString('utf16le'); }
      if (platforma === 1) return bajty.toString('latin1');
    }
  }
  return '';
}

let razem = 0;
let ile = 0;
const prawa = [];
for (const c of ZESTAW) {
  const css = pobierz(`https://fonts.googleapis.com/css2?family=${adresRodziny(c)}&text=${encodeURIComponent(ZNAKI)}`).toString();
  let pierwszy = null;
  for (const [, blok] of css.matchAll(/@font-face \{([^}]+)\}/g)) {
    const pole = (nazwa) => blok.match(new RegExp(`${nazwa}: ([^;]+);`))[1].trim();
    const [, url, format] = blok.match(/url\((https:[^)]+)\) format\('([a-z0-9]+)'\)/);
    if (format !== 'truetype') throw new Error(`Nieoczekiwany format ${format} dla ${c.nazwa}`);
    const dane = pobierz(url);
    fs.writeFileSync(path.join(katalog, `${slug(c.nazwa)}-${pole('font-weight')}-${pole('font-style') === 'italic' ? 'kursywa' : 'prosta'}.ttf`), dane);
    pierwszy = pierwszy || dane;
    razem += dane.length;
    ile += 1;
  }
  const licencja = `${nazwaZPliku(pierwszy, 13)} ${nazwaZPliku(pierwszy, 14)}`;
  const rodzaj = /open font license|OFL|openfontlicense|scripts\.sil\.org/i.test(licencja) ? 'OFL' : (/apache/i.test(licencja) ? 'Apache' : 'INNA');
  if (rodzaj === 'INNA') throw new Error(`Czcionka ${c.nazwa} ma nieznaną licencję: ${licencja.slice(0, 200)}`);
  prawa.push({ nazwa: c.nazwa, rodzaj, prawa: nazwaZPliku(pierwszy, 0).replace(/\s+/g, ' ').trim() });
}

// Plik licencji: prawa autorskie każdej rodziny (odczytane z plików) i pełny tekst licencji OFL.
const plikLicencji = path.join(__dirname, '..', 'css', 'czcionki', 'LICENCJA.txt');
const stary = fs.existsSync(plikLicencji) ? fs.readFileSync(plikLicencji, 'utf8') : '';
const tekstOfl = stary.slice(stary.indexOf('-----------------------------------------------------------\nSIL OPEN FONT LICENSE') >= 0 ? stary.indexOf('-----------------------------------------------------------\nSIL OPEN FONT LICENSE') : stary.indexOf('SIL OPEN FONT LICENSE'));
if (!tekstOfl.includes('SIL OPEN FONT LICENSE')) throw new Error('W css/czcionki/LICENCJA.txt brakuje tekstu licencji OFL – przywróć plik z repozytorium.');
const lista = (rodzaj) => prawa.filter((p) => p.rodzaj === rodzaj).map((p) => `  ${p.nazwa}: ${p.prawa}`).join('\n');
const apache = lista('Apache');
fs.writeFileSync(plikLicencji, `Zestaw czcionek Makietki (pliki .woff2 i .ttf w tym katalogu) pochodzi z Google Fonts.
Wszystkie czcionki wolno używać także w druku komercyjnym. Prawa autorskie i licencje:

Na licencji SIL Open Font License 1.1 (pełny tekst niżej):

${lista('OFL')}
${apache ? `\nNa licencji Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0):\n\n${apache}\n` : ''}
${tekstOfl.trimEnd()}
`);
console.log(`${ile} plików TTF, ${(razem / 1024).toFixed(0)} kB; licencje: ${prawa.filter((p) => p.rodzaj === 'OFL').length} OFL, ${prawa.filter((p) => p.rodzaj === 'Apache').length} Apache`);
