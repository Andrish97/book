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

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
`;

const STDIO = `
// ---------- Uruchomienie u siebie: konfiguracja ze zmiennych środowiskowych, transport stdio ----------

const serwer = utworzSerwer({
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
