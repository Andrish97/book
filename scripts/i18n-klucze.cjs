#!/usr/bin/env node
// Przeniesienie napisów index.html na klucze (#339, jak w Familiadzie): <element data-i18n="obszar.nazwa">Tekst</element>,
// title / placeholder / aria-label → data-i18n-title / data-i18n-placeholder / data-i18n-aria-label.
// Obszar – najbliższy przodek z id (okno, ekran, sekcja), nazwa – z polskiego tekstu. Polski tekst zostaje w HTML
// (działa bez słownika), a słowniki kluczy (js/jezyki/klucze/<język>.js) powstają z dotychczasowych słowników
// „polski napis → tłumaczenie” (js/jezyki/<język>.js). Skrypt można uruchamiać wiele razy – istniejące klucze zostają.
//
// Użycie: node scripts/i18n-klucze.cjs [--sprawdz]   (--sprawdz: tylko sprawdza, czy nic nie zostało do przeniesienia)

const fs = require('node:fs');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');
const HTML = path.join(KORZEN, 'index.html');
const JEZYKI = ['en', 'uk'];
const PUSTE = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const ATRYBUTY = ['title', 'placeholder', 'aria-label'];

const norm = (t) => t.replace(/\s+/g, ' ').trim();
const odEncji = (t) => t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const bezOgonkow = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');

function wczytajSlownik(j) {
  const tekst = fs.readFileSync(path.join(KORZEN, 'js', 'jezyki', `${j}.js`), 'utf8');
  return JSON.parse(tekst.slice(tekst.indexOf('{'), tekst.lastIndexOf('}') + 1));
}

const camel = (t) => {
  const slowa = bezOgonkow(t).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 4);
  if (!slowa.length) return 'tekst';
  return slowa.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');
};
const obszarZId = (id) => camel(id.replace(/-/g, ' ')) || 'ogolne';

function main() {
  const sprawdz = process.argv.includes('--sprawdz');
  const slowniki = Object.fromEntries(JEZYKI.map((j) => [j, wczytajSlownik(j)]));
  const znane = (t) => slowniki.en[t] !== undefined;
  const plikKluczy = (j) => path.join(KORZEN, 'js', 'jezyki', 'klucze', `${j}.js`);
  const czytajKlucze = (j) => {
    try { const t = fs.readFileSync(plikKluczy(j), 'utf8'); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { return {}; }
  };
  const klucze = { pl: czytajKlucze('pl'), ...Object.fromEntries(JEZYKI.map((j) => [j, czytajKlucze(j)])) };
  // tekst → klucz w obszarze (ten sam tekst w tym samym obszarze – ten sam klucz)
  const wObszarze = new Map();
  for (const [k, v] of Object.entries(klucze.pl)) wObszarze.set(`${k.split('.')[0]}|${v}`, k);
  const zajete = new Set(Object.keys(klucze.pl));
  const nadajKlucz = (obszar, tekst) => {
    const juz = wObszarze.get(`${obszar}|${tekst}`);
    if (juz) return juz;
    let k = `${obszar}.${camel(tekst)}`;
    for (let i = 2; zajete.has(k); i += 1) k = `${obszar}.${camel(tekst)}${i}`;
    zajete.add(k);
    wObszarze.set(`${obszar}|${tekst}`, k);
    klucze.pl[k] = tekst;
    for (const j of JEZYKI) klucze[j][k] = slowniki[j][tekst];
    return k;
  };

  const html = fs.readFileSync(HTML, 'utf8');
  const stos = []; // { tag, id }
  let wynik = '';
  let poz = 0;
  let doPrzeniesienia = 0;
  const reTag = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  let m;
  let pomin = 0; // wewnątrz <script>/<style>/<template data-bez-tlumaczenia>
  while ((m = reTag.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    const [cale, zamyk, tagRaw, atrybuty, samo] = m;
    const tag = tagRaw.toLowerCase();
    const obszar = () => { for (let i = stos.length - 1; i >= 0; i -= 1) if (stos[i].id) return obszarZId(stos[i].id); return 'ogolne'; };
    if (zamyk) {
      // zamknięcie: tekst między ostatnim otwarciem a tym zamknięciem, gdy element nie ma dzieci-elementów
      const ost = stos[stos.length - 1];
      if (ost && ost.tag === tag) {
        if (!pomin && ost.bezDzieci && !ost.maKlucz) {
          const tekst = norm(odEncji(html.slice(ost.koniecOtwarcia, m.index)));
          if (tekst.length > 1 && /\p{L}/u.test(tekst) && znane(tekst)) {
            doPrzeniesienia += 1;
            if (!sprawdz) {
              const k = nadajKlucz(ost.obszar, tekst);
              ost.wstaw = ` data-i18n="${k}"`;
            }
          }
        }
        if (ost.wstaw) {
          wynik = wynik.slice(0, ost.miejsceWstawienia) + ost.wstaw + wynik.slice(ost.miejsceWstawienia);
        }
        stos.pop();
        if (['script', 'style'].includes(tag) || ost.pomija) pomin = Math.max(0, pomin - 1);
        if (stos.length) stos[stos.length - 1].bezDzieci = false;
      }
      continue;
    }
    // otwarcie
    if (stos.length) stos[stos.length - 1].bezDzieci = false;
    const id = /\sid="([^"]+)"/.exec(atrybuty)?.[1] || null;
    const pomija = /\sdata-bez-tlumaczenia\b/.test(atrybuty);
    // atrybuty
    let dopisek = '';
    if (!pomin && !pomija) {
      for (const a of ATRYBUTY) {
        const am = new RegExp(`\\s${a}="([^"]*)"`).exec(atrybuty);
        if (!am || new RegExp(`\\sdata-i18n-${a}=`).test(atrybuty)) continue;
        const tekst = norm(odEncji(am[1]));
        if (!tekst || !/\p{L}/u.test(tekst) || !znane(tekst)) continue;
        doPrzeniesienia += 1;
        if (!sprawdz) dopisek += ` data-i18n-${a}="${nadajKlucz(id ? obszarZId(id) : obszar(), tekst)}"`;
      }
    }
    // tu wynik: wszystko do końca nazwy tagu + atrybuty, potem dopisek, potem reszta znacznika
    wynik += html.slice(poz, m.index);
    const koncowka = samo ? '/>' : '>';
    const glowa = cale.slice(0, cale.length - koncowka.length).replace(/\s+$/, '');
    wynik += glowa + dopisek;
    const miejsceWstawienia = wynik.length;
    wynik += cale.slice(glowa.length);
    poz = m.index + cale.length;
    if (samo || PUSTE.has(tag)) continue;
    const el = { tag, id, obszar: id ? obszarZId(id) : obszar(), bezDzieci: true, koniecOtwarcia: poz, miejsceWstawienia, maKlucz: /\sdata-i18n=/.test(atrybuty), pomija };
    stos.push(el);
    if (['script', 'style'].includes(tag) || pomija) pomin += 1;
  }
  wynik += html.slice(poz);
  if (sprawdz) {
    console.log(`Do przeniesienia na klucze: ${doPrzeniesienia}`);
    process.exit(doPrzeniesienia ? 1 : 0);
  }
  fs.writeFileSync(HTML, wynik);
  fs.mkdirSync(path.dirname(plikKluczy('pl')), { recursive: true });
  for (const j of ['pl', ...JEZYKI]) {
    const posortowane = Object.fromEntries(Object.keys(klucze[j]).sort().map((k) => [k, klucze[j][k]]));
    fs.writeFileSync(plikKluczy(j), `// Słownik kluczy (#339): „obszar.nazwa” → napis (${j}). Klucze z index.html – scripts/i18n-klucze.cjs; dalsze dopisywane ręcznie.\nexport default ${JSON.stringify(posortowane, null, 1).replace(/\n /g, '\n  ')};\n`);
  }
  console.log(`Przeniesione napisy: ${doPrzeniesienia}, kluczy razem: ${Object.keys(klucze.pl).length}`);
}

main();
