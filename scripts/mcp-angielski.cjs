#!/usr/bin/env node
// Łącznik AI po angielsku (#410): wpisuje tłumaczenia opisów narzędzi (supabase/functions/_shared/mcp-teksty-en.json,
// „polski tekst” → „angielski tekst”) do rdzenia łącznika między znacznikami TEKSTY_EN. Uruchom po zmianie opisu narzędzia
// albo tłumaczenia, potem node scripts/mcp-buduj.cjs. Test katalog-lacznikow pilnuje, żeby każdy opis miał tłumaczenie.
const fs = require('node:fs');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');
const RDZEN = path.join(KORZEN, 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs');
const teksty = JSON.parse(fs.readFileSync(path.join(KORZEN, 'supabase', 'functions', '_shared', 'mcp-teksty-en.json'), 'utf8'));
const kod = fs.readFileSync(RDZEN, 'utf8');
const POCZ = '// <TEKSTY_EN>';
const KON = '// </TEKSTY_EN>';
const a = kod.indexOf(POCZ); const b = kod.indexOf(KON);
if (a < 0 || b < 0) throw new Error('Brak znaczników TEKSTY_EN w rdzeniu.');
const blok = `${POCZ}\nconst TEKSTY_EN = ${JSON.stringify(teksty, null, 1)};\n`;
fs.writeFileSync(RDZEN, kod.slice(0, a) + blok + kod.slice(b));
console.log(`Tłumaczeń: ${Object.keys(teksty).length}`);
