#!/usr/bin/env node
// Zapisuje katalog Biblioteki w rdzeniu łącznika AI (plan H7) – po zmianach w Bibliotece:
//   node scripts/katalog-biblioteki.cjs && node scripts/mcp-buduj.cjs
const fs = require('node:fs');
const path = require('node:path');
const { otworz, nowyProjekt } = require('../tests/pomoc.cjs');
const { katalogZAplikacji, doKodu, START, KONIEC } = require('../tests/katalog-biblioteki.cjs');

const RDZEN = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs');
(async () => {
  const sprzatanie = [];
  try {
    const { strona } = await otworz({ after: (f) => sprzatanie.push(f) });
    await nowyProjekt(strona, 'Katalog');
    const kod = doKodu(await katalogZAplikacji(strona));
    const s = fs.readFileSync(RDZEN, 'utf8');
    const a = s.indexOf(START);
    const b = s.indexOf(KONIEC);
    if (a < 0 || b < 0) throw new Error('W rdzeniu brak znaczników katalogu');
    fs.writeFileSync(RDZEN, s.slice(0, a) + kod + s.slice(b + KONIEC.length));
    console.log(`Katalog Biblioteki zapisany w ${path.relative(process.cwd(), RDZEN)}.`);
  } finally { for (const f of sprzatanie) await f(); }
})().catch((e) => { console.error(e); process.exit(1); });
