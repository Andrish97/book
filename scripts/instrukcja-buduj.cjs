// Instrukcja (decyzja #114): źródło w Markdownie (docs/instrukcja/*.md) → treść dla aplikacji
// (js/instrukcja-tresc.js) i wersja dla AI i wyszukiwarek (ai/instrukcja.md).
//
// Uruchomienie po każdej zmianie instrukcji:   node scripts/instrukcja-buduj.cjs
// Sprawdzenie, czy pliki są aktualne:           node scripts/instrukcja-buduj.cjs --sprawdz   (robi to też test)
//
// Zapis w docs/instrukcja (jak w podręczniku Familiady):
//   # Część I. Tytuł {ikona=nazwa}   – część; następny akapit to jej opis,
//   # 7. Tytuł                       – rozdział (osobna strona instrukcji),
//   ## 7.3 Tytuł                     – podrozdział, ### Tytuł – nagłówek w podrozdziale,
//   [Przycisk]                       – nazwa przycisku dokładnie jak w aplikacji,
//   (→ 7.3), (→ 12), (→ 20, 21), (→ 14–17) – odnośnik; czytelnik widzi tytuł celu,
//   ![Podpis](plik.png) albo ![Podpis](plik.png@telefon) – zrzut z img/instrukcja (kilka pod rząd = galeria),
//   1. … – kroki (karty z numerem), - … – lista, | … | – tabela,
//   > Uwaga: …  /  > Wskazówka: … – ramki,
//   {{tabela-pol}}, {{tabela-skrotow}} – tabele z kodu aplikacji,
//   {{polecenie: PROMPT_X | Tytuł | Opis}} – polecenie dla AI z przyciskiem „Kopiuj” (js/polecenia-ai.js),
//   <!-- … --> – komentarz (pomijany), <kbd>…</kbd> – klawisz.

const fs = require('node:fs');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');
const ZRODLO = path.join(KORZEN, 'docs', 'instrukcja');
const PLIK_JS = path.join(KORZEN, 'js', 'instrukcja-tresc.js');
const PLIK_MD = path.join(KORZEN, 'ai', 'instrukcja.md');
const ADRES = 'https://makietka.app/';

const modul = (plik) => import(`data:text/javascript;charset=utf-8,${encodeURIComponent(fs.readFileSync(path.join(KORZEN, plik), 'utf8'))}`);
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- Czytanie źródła ----------

function wczytaj() {
  const czesci = [];
  const rozdzialy = [];
  let czesc = null;
  let rozdzial = null;
  let sekcja = null;
  let opisCzesci = false;
  const pliki = fs.readdirSync(ZRODLO).filter((f) => /^\d+-.*\.md$/.test(f)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  for (const plik of pliki) {
    for (const linia of fs.readFileSync(path.join(ZRODLO, plik), 'utf8').split('\n')) {
      let m;
      if ((m = linia.match(/^# Część ([IVX]+)\. (.+?)\s*\{ikona=([\w-]+)\}\s*$/))) {
        czesc = { nr: m[1], tytul: m[2], ikona: m[3], opis: '', rozdzialy: [] };
        czesci.push(czesc);
        opisCzesci = true;
        continue;
      }
      if ((m = linia.match(/^# (\d+)\. (.+)$/))) {
        if (!czesc) throw new Error(`${plik}: rozdział ${m[1]} przed pierwszą częścią`);
        rozdzial = { nr: m[1], tytul: m[2].trim(), czesc: czesc.tytul, ikona: czesc.ikona, sekcje: [] };
        rozdzialy.push(rozdzial);
        czesc.rozdzialy.push(m[1]);
        sekcja = null;
        opisCzesci = false;
        continue;
      }
      if ((m = linia.match(/^## (\d+)\.(\d+) (.+)$/))) {
        if (!rozdzial || m[1] !== rozdzial.nr) throw new Error(`${plik}: podrozdział ${m[1]}.${m[2]} poza rozdziałem ${rozdzial?.nr}`);
        sekcja = { id: `${m[1]}.${m[2]}`, tytul: m[3].trim(), linie: [] };
        rozdzial.sekcje.push(sekcja);
        continue;
      }
      if (opisCzesci) {
        if (linia.trim()) czesc.opis += (czesc.opis ? ' ' : '') + linia.trim();
        continue;
      }
      if (sekcja) sekcja.linie.push(linia);
      else if (linia.trim()) throw new Error(`${plik}: tekst poza podrozdziałem: ${linia}`);
    }
  }
  // Kolejne numery rozdziałów i podrozdziałów – bez dziur i powtórzeń.
  rozdzialy.forEach((r, i) => {
    if (Number(r.nr) !== i + 1) throw new Error(`rozdział ${r.nr} powinien mieć numer ${i + 1}`);
    r.sekcje.forEach((s, j) => { if (s.id !== `${r.nr}.${j + 1}`) throw new Error(`podrozdział ${s.id} powinien mieć numer ${r.nr}.${j + 1}`); });
    if (!r.sekcje.length) throw new Error(`rozdział ${r.nr} bez podrozdziałów`);
  });
  return { czesci, rozdzialy };
}

// Bloki podrozdziału: akapit, lista, kroki, tabela, ramka, obrazy, wstawki.
function bloki(linie) {
  const wynik = [];
  let i = 0;
  const wciecie = (l, n) => l.startsWith(' '.repeat(n)) && l.trim();
  while (i < linie.length) {
    const l = linie[i];
    if (!l.trim() || /^<!--.*-->\s*$/.test(l.trim())) { i += 1; continue; }
    let m;
    if ((m = l.match(/^\{\{(tabela-pol|tabela-skrotow)\}\}$/))) { wynik.push({ typ: m[1] }); i += 1; continue; }
    if ((m = l.match(/^\{\{polecenie: (\w+) \| (.+?) \| (.+?)\}\}$/))) { wynik.push({ typ: 'polecenie', nazwa: m[1], tytul: m[2], opis: m[3] }); i += 1; continue; }
    if (/^### /.test(l)) { wynik.push({ typ: 'naglowek', tekst: l.slice(4).trim() }); i += 1; continue; }
    if (/^!\[/.test(l)) {
      const obrazy = [];
      while (i < linie.length && (m = linie[i].match(/^!\[(.*)\]\(([^)@\s]+)(@telefon)?\)\s*$/))) { obrazy.push({ podpis: m[1], plik: m[2], telefon: Boolean(m[3]) }); i += 1; }
      if (!obrazy.length) throw new Error(`zły zapis obrazu: ${l}`);
      wynik.push({ typ: 'obrazy', obrazy });
      continue;
    }
    if (/^\|/.test(l)) {
      const wiersze = [];
      while (i < linie.length && /^\|/.test(linie[i])) { wiersze.push(linie[i]); i += 1; }
      const komorki = (w) => w.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((k) => k.trim());
      wynik.push({ typ: 'tabela', naglowek: komorki(wiersze[0]), wiersze: wiersze.slice(2).map(komorki) });
      continue;
    }
    if (/^> /.test(l)) {
      const tekst = [];
      while (i < linie.length && /^>/.test(linie[i])) { tekst.push(linie[i].replace(/^>\s?/, '')); i += 1; }
      const t = tekst.join(' ');
      const r = t.match(/^(Uwaga|Wskazówka):\s*(.*)$/);
      if (!r) throw new Error(`ramka bez „Uwaga:” albo „Wskazówka:”: ${t}`);
      wynik.push({ typ: 'ramka', rodzaj: r[1] === 'Uwaga' ? 'uwaga' : 'wskazowka', tekst: r[2] });
      continue;
    }
    if (/^(- |\d+\. )/.test(l)) {
      const numerowana = /^\d+\. /.test(l);
      const elementy = [];
      while (i < linie.length) {
        const x = linie[i];
        if (numerowana ? /^\d+\. /.test(x) : /^- /.test(x)) { elementy.push(x.replace(/^(- |\d+\. )/, '')); i += 1; continue; }
        if (elementy.length && (wciecie(x, 2) || wciecie(x, 3))) { elementy[elementy.length - 1] += ` ${x.trim()}`; i += 1; continue; }
        break;
      }
      wynik.push({ typ: numerowana ? 'kroki' : 'lista', elementy });
      continue;
    }
    const akapit = [];
    while (i < linie.length && linie[i].trim() && !/^(- |\d+\. |\||> |!\[|###|\{\{)/.test(linie[i])) { akapit.push(linie[i].trim()); i += 1; }
    wynik.push({ typ: 'akapit', tekst: akapit.join(' ') });
  }
  return wynik;
}

// ---------- Odnośniki ----------

function tytuly(rozdzialy) {
  const t = new Map();
  for (const r of rozdzialy) {
    t.set(r.nr, r.tytul);
    for (const s of r.sekcje) t.set(s.id, s.tytul);
  }
  return t;
}

// (→ 7.3), (→ 20, 21), (→ 14–17) → lista celów.
function cele(zapis, t) {
  const lista = [];
  for (const kawalek of zapis.split(/,\s*/)) {
    const [od, doCelu] = kawalek.split('–').map((x) => x.trim());
    for (const id of doCelu ? [od, doCelu] : [od]) {
      if (!t.has(id)) throw new Error(`odnośnik do nieistniejącego miejsca: → ${id}`);
      lista.push({ id, tytul: t.get(id), zakres: Boolean(doCelu) });
    }
  }
  return lista;
}

// ---------- HTML dla aplikacji ----------

function htmlWiersza(tekst, t) {
  const kody = [];
  let s = tekst.replace(/`([^`]+)`/g, (_, k) => { kody.push(`<code>${esc(k)}</code>`); return `\u0000${kody.length - 1}\u0000`; });
  s = s.replace(/\(→ ([^)]+)\)/g, (_, z) => {
    const c = cele(z, t);
    const linki = c.map((x) => `<a href="#" data-cel="${x.id}">${esc(x.tytul)}</a>`);
    return `(<span class="zobacz">→</span> ${c[0]?.zakres ? linki.join(' – ') : linki.join(', ')})`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\[([^\]]+)\]/g, '<span class="ui">$1</span>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => kody[Number(n)]);
}

function htmlBlokow(lista, t, polecenia) {
  return lista.map((b) => {
    switch (b.typ) {
      case 'akapit': return `<p>${htmlWiersza(b.tekst, t)}</p>`;
      case 'naglowek': return `<h4>${htmlWiersza(b.tekst, t)}</h4>`;
      case 'lista': return `<ul class="punkty">${b.elementy.map((e) => `<li>${htmlWiersza(e, t)}</li>`).join('')}</ul>`;
      case 'kroki': return `<ol class="kroki">${b.elementy.map((e) => `<li>${htmlWiersza(e, t)}</li>`).join('')}</ol>`;
      case 'ramka': return `<p class="ramka-instrukcji ${b.rodzaj}"><b>${b.rodzaj === 'uwaga' ? 'Uwaga' : 'Wskazówka'}.</b> ${htmlWiersza(b.tekst, t)}</p>`;
      case 'tabela': return `<div class="tabela-instrukcji"><table><thead><tr>${b.naglowek.map((k) => `<th>${htmlWiersza(k, t)}</th>`).join('')}</tr></thead>`
        + `<tbody>${b.wiersze.map((w) => `<tr>${w.map((k) => `<td>${htmlWiersza(k, t)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      case 'obrazy': {
        const figura = (o) => {
          if (!process.env.BEZ_ZRZUTOW && !fs.existsSync(path.join(KORZEN, 'img', 'instrukcja', o.plik))) throw new Error(`brak zrzutu img/instrukcja/${o.plik}`);
          const klasa = [o.plik.startsWith('k-') ? 'kadr' : '', o.telefon ? 'telefon' : ''].filter(Boolean).join(' ');
          return `<figure${klasa ? ` class="${klasa}"` : ''}><img src="img/instrukcja/${o.plik}" alt="${esc(o.podpis)}" loading="lazy">${o.podpis ? `<figcaption>${esc(o.podpis)}</figcaption>` : ''}</figure>`;
        };
        return b.obrazy.length > 1 ? `<div class="galeria">${b.obrazy.map(figura).join('')}</div>` : figura(b.obrazy[0]);
      }
      case 'tabela-pol': return '<div data-wstaw="pola"></div>';
      case 'tabela-skrotow': return '<div data-wstaw="skroty"></div>';
      case 'polecenie': {
        const tekst = polecenia[b.nazwa];
        if (typeof tekst !== 'string') throw new Error(`nie ma polecenia ${b.nazwa} w js/polecenia-ai.js`);
        return `<div class="prompt-instrukcji"><div class="prompt-naglowek"><b>${esc(b.tytul)}</b><button type="button" class="przycisk" data-kopiuj-prompt data-ikona="kopiuj">Kopiuj</button></div>`
          + `<p class="ciche">${htmlWiersza(b.opis, t)}</p><pre>${esc(tekst)}</pre></div>`;
      }
      default: throw new Error(`nieznany blok ${b.typ}`);
    }
  }).join('');
}

// ---------- Markdown dla AI ----------

function mdWiersza(tekst, t) {
  return tekst
    .replace(/\(→ ([^)]+)\)/g, (_, z) => {
      const c = cele(z, t);
      return `(rozdział ${c.map((x) => `„${x.id} ${x.tytul}”`).join(c[0]?.zakres ? ' – ' : ', ')})`;
    })
    .replace(/<kbd>([^<]+)<\/kbd>/g, '`$1`')
    .replace(/\[([^\]]+)\](?!\()/g, '**$1**')
    .replace(/\*\*\*\*/g, '');
}

function mdBlokow(lista, t, polecenia, pola, skroty) {
  return lista.map((b) => {
    switch (b.typ) {
      case 'akapit': return mdWiersza(b.tekst, t);
      case 'naglowek': return `#### ${mdWiersza(b.tekst, t)}`;
      case 'lista': return b.elementy.map((e) => `- ${mdWiersza(e, t)}`).join('\n');
      case 'kroki': return b.elementy.map((e, i) => `${i + 1}. ${mdWiersza(e, t)}`).join('\n');
      case 'ramka': return `> **${b.rodzaj === 'uwaga' ? 'Uwaga' : 'Wskazówka'}:** ${mdWiersza(b.tekst, t)}`;
      case 'tabela': return [`| ${b.naglowek.map((k) => mdWiersza(k, t)).join(' | ')} |`, `|${b.naglowek.map(() => '---').join('|')}|`,
        ...b.wiersze.map((w) => `| ${w.map((k) => mdWiersza(k, t)).join(' | ')} |`)].join('\n');
      case 'obrazy': return b.obrazy.map((o) => `![${o.podpis}](${ADRES}img/instrukcja/${o.plik})`).join('\n');
      case 'tabela-pol': return pola;
      case 'tabela-skrotow': return skroty;
      case 'polecenie': return `**${b.tytul}** — ${mdWiersza(b.opis, t)}\n\n\`\`\`text\n${polecenia[b.nazwa]}\n\`\`\``;
      default: return '';
    }
  }).join('\n\n');
}

// ---------- Budowa ----------

async function zbuduj() {
  const { czesci, rozdzialy } = wczytaj();
  const t = tytuly(rozdzialy);
  const polecenia = await modul('js/polecenia-ai.js');
  const { POLA_DOKUMENTU, ZAPISY_LICZB } = await modul('js/pola.js');
  const { SKROTY, opisKlawiszy } = await modul('js/skroty.js');

  const wynik = rozdzialy.map((r) => {
    const sekcje = r.sekcje.map((s) => {
      const b = bloki(s.linie);
      const html = htmlBlokow(b, t, polecenia);
      return { id: s.id, tytul: s.tytul, html, bloki: b };
    });
    return { ...r, sekcje };
  });

  // js/instrukcja-tresc.js
  const daneJs = {
    czesci: czesci.map(({ nr, tytul, ikona, opis, rozdzialy: rr }) => ({ nr, tytul, ikona, opis, rozdzialy: rr })),
    rozdzialy: wynik.map((r) => ({
      nr: r.nr, tytul: r.tytul, czesc: r.czesc, ikona: r.ikona,
      sekcje: r.sekcje.map((s) => ({ id: s.id, tytul: s.tytul, html: s.html })),
    })),
  };
  const js = '// Plik wygenerowany przez scripts/instrukcja-buduj.cjs ze źródła docs/instrukcja/*.md – nie zmieniaj go ręcznie.\n'
    + '// Po zmianie źródła: node scripts/instrukcja-buduj.cjs\n\n'
    + `export const CZESCI = [\n${daneJs.czesci.map((c) => `  ${JSON.stringify(c)},`).join('\n')}\n];\n\n`
    + `export const ROZDZIALY = [\n${daneJs.rozdzialy.map((r) => `  ${JSON.stringify(r)},`).join('\n')}\n];\n`;

  // ai/instrukcja.md
  const pola = ['| Pole | Znaczenie |', '|---|---|', ...POLA_DOKUMENTU.map(([n, o]) => `| \`{${n}}\` | ${o} |`), '',
    '| Zapis liczby | Znaczenie |', '|---|---|', ...ZAPISY_LICZB.map(([z, o]) => `| \`{nr${z ? `:${z}` : ''}}\` | ${o} |`)].join('\n');
  const grupy = [];
  for (const s of SKROTY) {
    let g = grupy.find((x) => x.nazwa === s.grupa);
    if (!g) { g = { nazwa: s.grupa, w: [] }; grupy.push(g); }
    g.w.push(`| ${opisKlawiszy(s).split('+').map((k) => `\`${k}\``).join(' + ')} | ${s.opis} |`);
  }
  const skroty = grupy.map((g) => `#### ${g.nazwa}\n\n| Klawisze | Działanie |\n|---|---|\n${g.w.join('\n')}`).join('\n\n');
  const md = [
    '<!-- Plik wygenerowany przez scripts/instrukcja-buduj.cjs ze źródła docs/instrukcja/*.md – nie zmieniaj go ręcznie. -->',
    '# Makietka – instrukcja',
    '',
    `Podręcznik aplikacji Makietka (${ADRES}) – edytora publikacji do druku: książek, kalendarzy, planerów, zaproszeń i innych dokumentów. `
      + 'Ta sama treść jest w aplikacji pod przyciskiem z ikoną książki.',
    '',
    '## Spis treści',
    '',
    ...czesci.flatMap((c) => [`- **Część ${c.nr}. ${c.tytul}** — ${c.opis}`,
      ...c.rozdzialy.map((nr) => `  - ${nr}. ${t.get(nr)}`)]),
    '',
    ...wynik.flatMap((r) => [
      `## ${r.nr}. ${r.tytul}`,
      '',
      ...r.sekcje.flatMap((s) => [`### ${s.id} ${s.tytul}`, '', mdBlokow(s.bloki, t, polecenia, pola, skroty), '']),
    ]),
  ].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

  return { js, md };
}

module.exports = { zbuduj, PLIK_JS, PLIK_MD };

if (require.main === module) {
  zbuduj().then(({ js, md }) => {
    if (process.argv.includes('--sprawdz')) {
      const stare = [fs.existsSync(PLIK_JS) && fs.readFileSync(PLIK_JS, 'utf8'), fs.existsSync(PLIK_MD) && fs.readFileSync(PLIK_MD, 'utf8')];
      if (stare[0] !== js || stare[1] !== md) { console.error('Instrukcja jest nieaktualna – uruchom: node scripts/instrukcja-buduj.cjs'); process.exit(1); }
      console.log('Instrukcja aktualna.');
      return;
    }
    fs.writeFileSync(PLIK_JS, js);
    fs.writeFileSync(PLIK_MD, md);
    console.log(`Zapisano ${path.relative(KORZEN, PLIK_JS)} (${Math.round(js.length / 1024)} kB) i ${path.relative(KORZEN, PLIK_MD)}.`);
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
