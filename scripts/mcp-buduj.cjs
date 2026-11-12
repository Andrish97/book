#!/usr/bin/env node
// Składa serwer MCP do uruchomienia u siebie (ai/mcp/seriodruk-mcp.mjs – jeden plik do pobrania) ze wspólnego
// rdzenia (supabase/functions/_shared/seriodruk-mcp-rdzen.mjs), z którego korzysta też zdalny łącznik
// (Funkcja Edge supabase/functions/mcp). Dzięki temu oba serwery mają te same narzędzia.
//
// Użycie:  node scripts/mcp-buduj.cjs            – zapisuje ai/mcp/seriodruk-mcp.mjs
//          node scripts/mcp-buduj.cjs --sprawdz  – tylko sprawdza, czy plik jest aktualny (dla testów)

const fs = require('node:fs');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');
const RDZEN = path.join(KORZEN, 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs');
const WYNIK = path.join(KORZEN, 'ai', 'mcp', 'seriodruk-mcp.mjs');

const NAGLOWEK = `#!/usr/bin/env node
// Serwer MCP Seriodruku uruchamiany u siebie (stdio) – dla Claude Code, Claude Desktop i innych klientów MCP.
// Zwykle wystarcza zdalny łącznik (adres z okna „Dostęp dla AI” – bez instalowania czegokolwiek); ten plik
// jest dla zaawansowanych. Pozwala asystentowi AI czytać i zmieniać jeden projekt Seriodruku – ten,
// do którego prowadzi klucz dostępu z aplikacji (menu ⋯ edytora → Dostęp dla AI).
//
// Uruchomienie: node seriodruk-mcp.mjs   (Node.js 18 lub nowszy, bez instalowania czegokolwiek)
// Zmienne środowiskowe:
//   SERIODRUK_KLUCZ             klucz dostępu z aplikacji (sdk_…) – wymagany
//   SERIODRUK_ADRES             adres bazy (domyślnie baza Seriodruku)
//   SERIODRUK_KLUCZ_PUBLICZNY   publikowalny klucz bazy (domyślnie ten z aplikacji – to nie jest sekret)
//
// Transport: stdio, wiadomości JSON-RPC rozdzielone znakiem nowej linii. Protokół MCP w wersji
// 2026-07-28 (wersja w _meta każdego żądania, server/discover) oraz starsze wersje z wymianą
// initialize (2025-11-25, 2025-06-18, 2025-03-26). Opis: https://andrish97.github.io/book/ai/api.md
//
// PLIK SKŁADANY: nie edytuj go ręcznie – zmieniaj supabase/functions/_shared/seriodruk-mcp-rdzen.mjs
// i uruchom node scripts/mcp-buduj.cjs.

import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
`;

const STDIO = `
// ---------- Uruchomienie u siebie: konfiguracja ze zmiennych środowiskowych, transport stdio ----------

// Obrazy z dysku tego komputera (tylko serwer u siebie – zdalny łącznik nie widzi plików użytkownika):
// ścieżka pliku albo folderu (folder: obrazy w nim, bez podfolderów), ~ to folder domowy.
const OBRAZY = /\\.(png|jpe?g|webp|gif|svg|zip)$/i;
const POMIJANE = new Set(['Library', 'node_modules', 'Applications', 'AppData', 'snap']);
// Szuka w folderze domowym (do 7 poziomów, bez ukrytych i systemowych folderów) pliku albo folderu, którego ścieżka
// kończy się podanymi częściami – najpierw najdłuższą końcówką (do 4 części), potem krótszymi.
async function znajdzWDomu(sciezka) {
  const czesci = sciezka.split(/[\\\\/]+/).filter((c) => c && c !== '.' && c !== '~');
  if (!czesci.length) return null;
  const katalogi = [];
  const kolejka = [[homedir(), 0]];
  while (kolejka.length && katalogi.length < 40000) {
    const [k, g] = kolejka.shift();
    katalogi.push(k);
    if (g >= 7) continue;
    const wpisy = await readdir(k, { withFileTypes: true }).catch(() => []);
    for (const w of wpisy) if (w.isDirectory() && !w.name.startsWith('.') && !POMIJANE.has(w.name)) kolejka.push([join(k, w.name), g + 1]);
  }
  for (let n = Math.min(4, czesci.length); n >= 1; n -= 1) {
    const koncowka = czesci.slice(-n);
    for (const k of katalogi) {
      const kandydat = join(k, ...koncowka);
      if (await stat(kandydat).catch(() => null)) return kandydat;
    }
  }
  return null;
}
export async function czytajPliki(sciezki) {
  const lista = [];
  for (const s of sciezki) {
    let pelna = resolve(String(s).trim().replace(/^~(?=$|[\\\\/])/, homedir()));
    let info = await stat(pelna).catch(() => null);
    // Ścieżka z miejsca roboczego AI (np. „grafiki/zdjecia.zip” albo /sessions/…/mnt/Kalendarz/grafiki/zdjecia.zip):
    // szukam pliku o takiej końcówce ścieżki w folderze domowym.
    if (!info) {
      const znaleziona = await znajdzWDomu(String(s));
      if (znaleziona) { pelna = znaleziona; info = await stat(pelna); }
    }
    if (!info) throw new Error(\`Nie ma pliku ani folderu „\${s}” – podaj pełną ścieżkę na tym komputerze (np. ~/Dokumenty/Kalendarz/grafiki/zdjecia.zip).\`);
    if (info.isDirectory()) {
      const nazwy = (await readdir(pelna)).filter((n) => OBRAZY.test(n) && !n.startsWith('.')).sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }));
      if (!nazwy.length) throw new Error(\`W folderze „\${s}” nie ma obrazów (PNG, JPEG, WebP, GIF, SVG) ani archiwów ZIP.\`);
      lista.push(...nazwy.map((n) => join(pelna, n)));
    } else lista.push(pelna);
  }
  if (lista.length > 50) throw new Error(\`To \${lista.length} plików – naraz wgrywam najwyżej 50. Podziel je na mniejsze porcje.\`);
  const wynik = [];
  for (const p of lista) wynik.push({ bajty: new Uint8Array(await readFile(p)), nazwa: basename(p) });
  return wynik;
}

const serwer = utworzSerwer({
  czytajPliki,
  adres: process.env.SERIODRUK_ADRES || 'https://pganajmivwtstapnwsgv.supabase.co',
  kluczPubliczny: process.env.SERIODRUK_KLUCZ_PUBLICZNY || 'sb_publishable_gt_GEmBz6SfJZ0o9rAhLQA_HKH0V_cq',
  klucz: process.env.SERIODRUK_KLUCZ || '',
  brakKlucza: 'Brak klucza dostępu: ustaw zmienną SERIODRUK_KLUCZ (klucz z aplikacji: menu ⋯ → Dostęp dla AI).',
  czytajOpis: () => readFile(new URL('../format-seriodruk.md', import.meta.url), 'utf8'),
});
export const obsluz = serwer.obsluz;

// Uruchomienie jako proces (nie przy imporcie w testach).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stanSesji = {};
  const linie = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const wyslij = (o) => { if (o) process.stdout.write(\`\${JSON.stringify(o)}\\n\`); };
  if (!process.env.SERIODRUK_KLUCZ) process.stderr.write('Seriodruk MCP: brak SERIODRUK_KLUCZ – narzędzia zgłoszą błąd, dopóki nie podasz klucza.\\n');
  linie.on('line', async (linia) => {
    if (!linia.trim()) return;
    let w;
    try { w = JSON.parse(linia); } catch {
      wyslij({ jsonrpc: '2.0', id: null, error: { code: BLEDY.PARSE, message: 'Nieprawidłowy JSON.' } });
      return;
    }
    if (Array.isArray(w)) { for (const x of w) wyslij(await obsluz(x, stanSesji)); return; }
    wyslij(await obsluz(w, stanSesji));
  });
}
`;

function zbuduj() {
  // Rdzeń bez jego własnego komentarza nagłówkowego (pierwsze linie zaczynające się od //).
  const linie = fs.readFileSync(RDZEN, 'utf8').split('\n');
  let i = 0;
  while (i < linie.length && (linie[i].startsWith('//') || !linie[i].trim())) i += 1;
  const rdzen = linie.slice(i).join('\n').trimEnd();
  return `${NAGLOWEK}\n// ---------- Wspólny rdzeń (supabase/functions/_shared/seriodruk-mcp-rdzen.mjs) ----------\n\n${rdzen}\n${STDIO}`;
}

const tresc = zbuduj();
if (process.argv.includes('--sprawdz')) {
  const obecny = fs.existsSync(WYNIK) ? fs.readFileSync(WYNIK, 'utf8') : '';
  if (obecny !== tresc) {
    console.error('ai/mcp/seriodruk-mcp.mjs jest nieaktualny względem rdzenia – uruchom: node scripts/mcp-buduj.cjs');
    process.exit(1);
  }
  console.log('ai/mcp/seriodruk-mcp.mjs jest aktualny');
} else {
  fs.writeFileSync(WYNIK, tresc);
  console.log(`ai/mcp/seriodruk-mcp.mjs: ${tresc.split('\n').length} linii`);
}
