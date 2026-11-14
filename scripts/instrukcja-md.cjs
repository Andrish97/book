// Instrukcja aplikacji jako Markdown dla AI i wyszukiwarek: ai/instrukcja.md.
//
// Treść instrukcji żyje w js/instrukcja.js (tablica ROZDZIALY) i pokazuje się dopiero w uruchomionej
// aplikacji, więc AI czytające stronę jej nie widzi. Ten skrypt wczytuje moduł w przeglądarce (moduł
// korzysta z DOM), zamienia HTML rozdziałów na Markdown i zapisuje plik, który GitHub Pages publikuje
// pod https://makietka.app/ai/instrukcja.md.
//
// Uruchomienie po każdej zmianie instrukcji:   node scripts/instrukcja-md.cjs
// Sprawdzenie, czy plik jest aktualny:          node scripts/instrukcja-md.cjs --sprawdz   (robi to też test)

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const KORZEN = path.join(__dirname, '..');
const PLIK = path.join(KORZEN, 'ai', 'instrukcja.md');
const ADRES_STRONY = 'https://makietka.app/';
const TYPY = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };

// Mały serwer plików repozytorium – moduły ES wczytują się tylko przez http.
function serwer() {
  return new Promise((ok) => {
    const s = http.createServer((zad, odp) => {
      const sciezka = decodeURIComponent(new URL(zad.url, 'http://x').pathname);
      if (sciezka === '/__pusta.html') { odp.writeHead(200, { 'content-type': 'text/html' }); odp.end('<!doctype html><meta charset="utf-8"><body></body>'); return; }
      const plik = path.join(KORZEN, path.normalize(sciezka).replace(/^([/\\])+/, ''));
      if (!plik.startsWith(KORZEN) || !fs.existsSync(plik) || fs.statSync(plik).isDirectory()) { odp.writeHead(404); odp.end(); return; }
      odp.writeHead(200, { 'content-type': TYPY[path.extname(plik)] || 'application/octet-stream' });
      fs.createReadStream(plik).pipe(odp);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

// W przeglądarce: rozdziały → Markdown.
async function wPrzegladarce(adresStrony) {
  const { ROZDZIALY } = await import('/js/instrukcja.js');
  const tekst = (wezel) => {
    if (wezel.nodeType === Node.TEXT_NODE) return wezel.nodeValue.replace(/\s+/g, ' ');
    if (wezel.nodeType !== Node.ELEMENT_NODE) return '';
    const srodek = () => [...wezel.childNodes].map(tekst).join('');
    switch (wezel.tagName) {
      case 'B': case 'STRONG': return `**${srodek().trim()}**`;
      case 'I': case 'EM': return `*${srodek().trim()}*`;
      case 'KBD': case 'CODE': return `\`${wezel.textContent}\``;
      case 'BR': return '  \n';
      case 'A': return `[${srodek()}](${new URL(wezel.getAttribute('href'), adresStrony).href})`;
      case 'SVG': return '';
      default: return srodek();
    }
  };
  const wiersz = (html) => { const d = document.createElement('div'); d.innerHTML = html; return tekst(d).replace(/[ \t]+/g, ' ').trim(); };
  // Dodatkowa treść rozdziału (tabele pól i skrótów): nagłówki h4 i tabele dwukolumnowe.
  const blok = (html) => {
    const d = document.createElement('div'); d.innerHTML = html;
    const wynik = [];
    for (const el of d.children) {
      if (/^H[1-6]$/.test(el.tagName)) wynik.push(`### ${tekst(el).trim()}`);
      else if (el.tagName === 'TABLE') {
        wynik.push(['| | |', '|---|---|', ...[...el.querySelectorAll('tr')].map((tr) => `| ${[...tr.children].map((td) => tekst(td).trim().replace(/\|/g, '\\|')).join(' | ')} |`)].join('\n'));
      } else wynik.push(tekst(el).trim());
    }
    return wynik.join('\n\n');
  };
  const obraz = (plik, podpis) => `![${wiersz(podpis || '')}](${adresStrony}img/instrukcja/${plik})${podpis ? `\n*${wiersz(podpis)}*` : ''}`;
  const czesci = ROZDZIALY.map((r, i) => {
    const kawalki = [`## ${i + 1}. ${r.tytul}`, wiersz(r.wstep)];
    if (r.obraz) kawalki.push(obraz(r.obraz, r.podpis));
    if (r.punkty?.length) kawalki.push(r.punkty.map((p) => `- ${wiersz(p)}`).join('\n'));
    if (r.obraz2) kawalki.push(obraz(r.obraz2, r.podpis2));
    if (r.html) kawalki.push(blok(r.html()));
    if (r.rada) kawalki.push(`> ${wiersz(r.rada)}`);
    return kawalki.filter(Boolean).join('\n\n');
  });
  const spis = ROZDZIALY.map((r, i) => `${i + 1}. ${r.tytul}`).join('\n');
  return { czesci, spis };
}

async function zbuduj() {
  const s = await serwer();
  const przegladarka = await chromium.launch();
  try {
    const strona = await przegladarka.newPage();
    await strona.goto(`http://127.0.0.1:${s.address().port}/__pusta.html`);
    const { czesci, spis } = await strona.evaluate(wPrzegladarce, ADRES_STRONY);
    return [
      '# Instrukcja Makietki',
      `Makietka (${ADRES_STRONY}) to edytor publikacji z powtarzanymi stronami – kalendarzy, planerów, notesów – działający w przeglądarce. To jest instrukcja obsługi z aplikacji (przycisk ze znakiem zapytania), w postaci do czytania przez ludzi i AI. Opis formatu pliku projektu: ${ADRES_STRONY}ai/format-makietka.md.`,
      '<!-- Plik generowany z js/instrukcja.js przez scripts/instrukcja-md.cjs – nie edytuj go ręcznie. -->',
      `## Spis rozdziałów\n\n${spis}`,
      ...czesci,
    ].join('\n\n').replace(/\n{3,}/g, '\n\n').concat('\n');
  } finally {
    await przegladarka.close();
    s.close();
  }
}

module.exports = { zbuduj, PLIK };

if (require.main === module) {
  zbuduj().then((md) => {
    if (process.argv.includes('--sprawdz')) {
      const obecny = fs.existsSync(PLIK) ? fs.readFileSync(PLIK, 'utf8') : '';
      if (obecny !== md) { console.error('ai/instrukcja.md jest nieaktualny – uruchom: node scripts/instrukcja-md.cjs'); process.exit(1); }
      console.log('ai/instrukcja.md jest aktualny');
      return;
    }
    fs.writeFileSync(PLIK, md);
    console.log(`ai/instrukcja.md: ${md.length} znaków`);
  }).catch((e) => { console.error(e); process.exit(1); });
}
