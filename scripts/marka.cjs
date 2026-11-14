#!/usr/bin/env node
// Zmiana marki: Seriodruk → Makietka, andrish97.github.io/book → makietka.app (decyzja #88).
// Skrypt jest powtarzalny (idempotentny): po scaleniu innych zmian wystarczy uruchomić go jeszcze raz.
//
//   node scripts/marka.cjs            – zmienia pliki i wypisuje, które zmienił
//   node scripts/marka.cjs --sprawdz  – nic nie zmienia; kończy się błędem, jeśli coś zostało do zmiany
//
// Zmienia tylko to, co widzi użytkownik: nazwę w tekstach (z odmianą), adres aplikacji, rozszerzenie
// pliku w opisach, nazwę pliku z opisem formatu. Celowo NIE zmienia identyfikatorów, od których zależą
// dane i działające połączenia (szczegóły w js/marka.js i w dzienniku decyzji #88):
//   nazwy w bazie (tabele, funkcje, magazyn, prefiks sdk_), nazwy narzędzi łącznika, window.seriodruk,
//   klucze seriodruk:… i bazy/pamięci seriodruk-… w przeglądarce, typ application/vnd.seriodruk+zip i format
//   „seriodruk” w pliku projektu, ścieżka rdzenia łącznika supabase/functions/_shared/seriodruk-mcp-rdzen.mjs.
// Linię z napisem „marka-zostaw” skrypt pomija (np. lista przyjmowanych rozszerzeń).

const fs = require('node:fs');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');

// Pliki i katalogi, których skrypt nie rusza.
const POMIN = [
  /^\.git\//, /^\.claude\//, /^node_modules\//, /^js\/zewnetrzne\//, /^zrzuty-robocze\//, /^_site\//,
  /^supabase\/migrations\//, // wdrożone migracje się nie zmieniają
  /^docs\/DECYZJE\.md$/, // dziennik – historia, cytaty zostają
  /^js\/marka\.js$/, /^scripts\/marka\.cjs$/, /^tests\/marka\.test\.cjs$/,
  /^supabase\/config\.toml$/, // adresy logowania poprawione ręcznie
  /^cloudflare\//, /^docs\/KONFIGURACJA-DOMENY\.md$/,
];
const ROZSZERZENIA = /\.(js|mjs|cjs|ts|html|css|md|txt|json|webmanifest|py|yml|yaml|toml|svg)$/i;

// Reguły w kolejności. Nazwa męska (Seriodruk) → żeńska (Makietka), z odmianą.
const REGULY = [
  // Adresy
  [/https:\/\/andrish97\.github\.io\/book\//g, 'https://makietka.app/'],
  [/andrish97\.github\.io\/book\//g, 'makietka.app/'],
  [/andrish97\\\.github\\\.io\\\/book\\\//g, 'makietka\\.app\\/'], // w wyrażeniach regularnych testów
  [/format-seriodruk\.md/g, 'format-makietka.md'],
  [/seriodruk\.mcpb/g, 'makietka.mcpb'],
  [/seriodruk-mcp\.mjs/g, 'makietka-mcp.mjs'], // serwer u siebie (nie: seriodruk-mcp-rdzen.mjs)
  [/SERIODRUK_(KLUCZ_PUBLICZNY|KLUCZ|ADRES|PROBKI)\b/g, 'MAKIETKA_$1'],
  // Rozszerzenie pliku w tekstach (nie: window.seriodruk, vnd.seriodruk+zip, nazwa.seriodruk w kodzie testów)
  [/(?<![\w$])\.seriodruk\b(?![+\w-])/g, '.makietka'],
  // Znak w logo
  [/<span class="znak-logo">S<\/span>/g, '<span class="znak-logo">M</span>'],
  [/(background:#1c1b19;color:#f4f3ef;font-size:18px;vertical-align:middle;">)S(<\/span>)/g, '$1M$2'], // znak w mailach
  // Odmiana nazwy
  [/\b(w|we|o|przy|na) Seriodruku\b/g, '$1 Makietce'],
  [/Seriodrukiem\b/g, 'Makietką'],
  [/Seriodrukowi\b/g, 'Makietce'],
  [/(?<![\w])Seriodruku\b/g, 'Makietki'],
  [/\bz Seriodruk\b/g, 'z Makietką'],
  [/\b(wybierz|otwórz|zainstaluj|uruchom) Seriodruk\b/g, '$1 Makietkę'],
  [/(?<![\w])Seriodruk\b/g, 'Makietka'],
  [/\bSERIODRUK\b(?!_)/g, 'MAKIETKA'],
];

// Co --sprawdz uznaje za pozostałość starej marki.
const POZOSTALOSCI = [/(?<![\w])Seriodruk/, /andrish97\.github\.io\/book/, /(?<![\w$])\.seriodruk\b(?![+\w-])/];

function* pliki(katalog, wzgledna = '') {
  for (const wpis of fs.readdirSync(katalog, { withFileTypes: true })) {
    const rel = wzgledna ? `${wzgledna}/${wpis.name}` : wpis.name;
    if (POMIN.some((r) => r.test(wpis.isDirectory() ? `${rel}/` : rel))) continue;
    if (wpis.isDirectory()) yield* pliki(path.join(katalog, wpis.name), rel);
    else if (ROZSZERZENIA.test(wpis.name)) yield rel;
  }
}

function zamien(tresc) {
  return tresc.split('\n').map((linia) => {
    if (linia.includes('marka-zostaw')) return linia;
    return REGULY.reduce((l, [wzor, na]) => l.replace(wzor, na), linia);
  }).join('\n');
}

const sprawdz = process.argv.includes('--sprawdz');
const zmienione = [];
const zostalo = [];
for (const rel of pliki(KORZEN)) {
  const pelna = path.join(KORZEN, rel);
  const stara = fs.readFileSync(pelna, 'utf8');
  const nowa = zamien(stara);
  if (nowa !== stara) {
    zmienione.push(rel);
    if (!sprawdz) fs.writeFileSync(pelna, nowa);
  }
  nowa.split('\n').forEach((linia, i) => {
    if (!linia.includes('marka-zostaw') && POZOSTALOSCI.some((r) => r.test(linia))) zostalo.push(`${rel}:${i + 1}: ${linia.trim().slice(0, 120)}`);
  });
}

// Serwer MCP do uruchomienia u siebie ma nową nazwę pliku (treść składa node scripts/mcp-buduj.cjs).
const STARY_SERWER = path.join(KORZEN, 'ai', 'mcp', 'seriodruk-mcp.mjs');
if (fs.existsSync(STARY_SERWER)) {
  zmienione.push('ai/mcp/seriodruk-mcp.mjs → ai/mcp/makietka-mcp.mjs');
  if (!sprawdz) fs.renameSync(STARY_SERWER, path.join(KORZEN, 'ai', 'mcp', 'makietka-mcp.mjs'));
}

// Opis formatu ma nową nazwę pliku (ai/format-makietka.md); stary plik znika.
const STARY_OPIS = path.join(KORZEN, 'ai', 'format-seriodruk.md');
const NOWY_OPIS = path.join(KORZEN, 'ai', 'format-makietka.md');
if (fs.existsSync(STARY_OPIS)) {
  zmienione.push('ai/format-seriodruk.md → ai/format-makietka.md');
  if (!sprawdz) {
    fs.writeFileSync(NOWY_OPIS, zamien(fs.readFileSync(STARY_OPIS, 'utf8')));
    fs.unlinkSync(STARY_OPIS);
  }
}

if (sprawdz) {
  if (zmienione.length || zostalo.length) {
    if (zmienione.length) console.error(`Do zmiany (uruchom node scripts/marka.cjs):\n  ${zmienione.join('\n  ')}`);
    if (zostalo.length) console.error(`Została stara marka:\n  ${zostalo.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Marka: wszystko aktualne.');
} else {
  console.log(zmienione.length ? `Zmienione pliki (${zmienione.length}):\n  ${zmienione.join('\n  ')}` : 'Nic do zmiany.');
  if (zostalo.length) console.log(`Uwaga – zostały miejsca do ręcznego przejrzenia:\n  ${zostalo.join('\n  ')}`);
}
