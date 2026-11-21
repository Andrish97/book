#!/usr/bin/env node
// Napisy interfejsu w kodzie JS na klucze (#346, etap 3 z #339 – jak w Familiadzie): 'Zapisz' → t('obszar.zapisz').
// Obszar – nazwa pliku (js/app/podglad-ekran.js → podgladEkran). Zamieniane są tylko napisy, które na pewno trafiają
// na ekran: powiadomienia i pytania, etykiety paneli, podpowiedzi (title, placeholder, aria-label), textContent,
// pola tytul/opis/etykieta w obiektach, opisy pozycji list wyboru. Porównania, dane projektu (nazwy stron, treść
// tekstów), klucze obiektów i pliki składane (ai-narzedzia-rdzen.js) zostają nietknięte. Tłumaczenia kluczy biorą
// się z istniejących kluczy o tym samym polskim napisie (nowe – do przetłumaczenia), polski tekst – z kodu.
//
// Użycie: node scripts/i18n-kod.cjs <pliki…>   (bez plików – wszystkie js/ poza zewnetrzne/ i jezyki/)
// Wymaga parsera acorn (jest w zależnościach eslint).

const fs = require('node:fs');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');
const wymagaj = (n) => { try { return require(n); } catch { return require(path.join('/opt/node-tools/node_modules', n)); } };
const acorn = wymagaj('acorn');

const JEZYKI = ['en', 'uk'];
const norm = (t) => t.replace(/\s+/g, ' ').trim();
const bezOgonkow = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');
const camel = (t, n = 4) => {
  const slowa = bezOgonkow(t).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, n);
  if (!slowa.length) return 'tekst';
  return slowa.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');
};
const czytaj = (p) => { const t = fs.readFileSync(p, 'utf8'); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); };
const plikKluczy = (j) => path.join(KORZEN, 'js', 'jezyki', 'klucze', `${j}.js`);

// Funkcje, których napisy (wszystkie argumenty albo wskazane) to zawsze tekst na ekranie.
const FUNKCJE = {
  powiadom: [0], potwierdz: null, zapytajONazwe: null, przyciskAi: [0], kafel: [0], postep: [0], stanTekst: [0],
  przyciskAkcji: [2], przycisk: [0], komunikat: [0], pokazBlad: [0], ustawKomunikat: [0], pokazKomunikat: [0],
};
// Metody budujące panele (this.liczba('Etykieta', …)) – pierwszy argument.
const METODY = new Set(['liczba', 'wybor', 'sekcja', 'przelacznik', 'wskazowka', 'tekst', 'kolor', 'segmenty', 'komunikat', 'opis', 'naglowek', 'etykieta']);
const PRZYPISANIA = new Set(['textContent', 'innerText', 'title', 'placeholder', 'ariaLabel']);
const WLASCIWOSCI = new Set(['tytul', 'opis', 'etykieta', 'podpowiedz', 'placeholder', 'komunikat', 'textContent', 'title', 'wskazowka', 'pytanie', 'przycisk']);
const ATRYBUTY = new Set(['title', 'aria-label', 'placeholder', 'alt']);

// Katalogi bibliotek (#355): nazwy kształtów, ikon, kategorii i grup to tylko napisy na ekranie (porównania idą po id
// i po polskiej „kategorii” kształtu, której się nie tłumaczy).
const KATALOGI = new Set(['biblioteka-elementy.js', 'biblioteka-kompozycje.js', 'biblioteka-wzorce.js', 'biblioteka-gotowe-sekcje.js',
  'ksztalty-biblioteka.js', 'ksztalty-wiecej.js', 'ikony-biblioteki.js']);
let biezacyPlik = '';
const nazwaWywolania = (c) => (c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : null);

// Szerzej (#356): zdania w kodzie, które trafiają na ekran pośrednio – zwracane z funkcji, dopisywane do list
// komunikatów, opcje list (new Option), zmienne o nazwach opisów. Tylko dla zdań (szablonów i napisów ze spacją).
const ZMIENNE_OPISOW = /opis|tekst|tytul|komunikat|czesci|^ile$|stron$|lista|pominiete|etykieta|naglowek|podpis|wiadomosc|uwag|powod|tresc/i;
function poSrednio(anc) {
  let i = anc.length - 1;
  let dziecko = anc[i];
  i -= 1;
  while (i >= 0 && ((anc[i].type === 'ConditionalExpression' && anc[i].test !== dziecko) || (anc[i].type === 'LogicalExpression'))) { dziecko = anc[i]; i -= 1; }
  const r = anc[i];
  if (!r) return false;
  if (r.type === 'ReturnStatement' || (r.type === 'ArrowFunctionExpression' && r.body === dziecko)) return true;
  if (r.type === 'NewExpression' && nazwaWywolania(r.callee) === 'Option' && r.arguments[0] === dziecko) return true;
  if (r.type === 'CallExpression' && ['push', 'unshift'].includes(nazwaWywolania(r.callee))) return true;
  if (r.type === 'VariableDeclarator' && r.init === dziecko && ZMIENNE_OPISOW.test(r.id?.name || '')) return true;
  if (r.type === 'ArrayExpression') { const w = anc[i - 1]; return w?.type === 'VariableDeclarator' && ZMIENNE_OPISOW.test(w.id?.name || ''); }
  if (r.type === 'AssignmentExpression' && r.right === dziecko && ZMIENNE_OPISOW.test(r.left.type === 'Identifier' ? r.left.name : r.left.property?.name || '')) return true;
  return false;
}

// Czy literał (z przodkami) to napis na ekranie.
function naEkranie(anc) {
  let i = anc.length - 1; // anc[i] – literał
  let dziecko = anc[i];
  i -= 1;
  // przez warunki: a ? 'X' : 'Y', a || 'X', ('X')
  while (i >= 0) {
    const r = anc[i];
    if (r.type === 'ConditionalExpression' && r.test !== dziecko) { dziecko = r; i -= 1; continue; }
    if (r.type === 'LogicalExpression' && (r.operator === '||' || r.operator === '??' ? true : r.right === dziecko)) { dziecko = r; i -= 1; continue; }
    break;
  }
  const r = anc[i];
  if (!r) return false;
  if (r.type === 'CallExpression' || r.type === 'NewExpression') {
    const nr = r.arguments.indexOf(dziecko);
    if (nr < 0) return false;
    const n = nazwaWywolania(r.callee);
    if (r.callee.type === 'MemberExpression' && n === 'setAttribute') return nr === 1 && r.arguments[0]?.type === 'Literal' && ATRYBUTY.has(r.arguments[0].value);
    if (r.callee.type === 'MemberExpression' && METODY.has(n)) return nr === 0;
    if (r.callee.type === 'Identifier' && Object.hasOwn(FUNKCJE, n)) return FUNKCJE[n] === null || FUNKCJE[n].includes(nr);
    return false;
  }
  if (r.type === 'AssignmentExpression') return r.right === dziecko && r.left.type === 'MemberExpression' && !r.left.computed && PRZYPISANIA.has(r.left.property.name);
  if (r.type === 'Property') {
    if (r.value !== dziecko || r.computed) return false;
    const k = r.key.type === 'Identifier' ? r.key.name : r.key.value;
    if (KATALOGI.has(biezacyPlik) && (['nazwa', 'grupa'].includes(k) || /^NAZWY/.test(anc[i - 2]?.id?.name || ''))) return true;
    return WLASCIWOSCI.has(k);
  }
  // Wiersz katalogu kształtów/ikon: ['id', 'Nazwa', 'Kategoria', …] – tylko nazwa (indeks 1).
  if (r.type === 'ArrayExpression' && KATALOGI.has(biezacyPlik) && r.elements[1] === dziecko
    && r.elements[0]?.type === 'Literal' && /^[a-z0-9-]+$/.test(String(r.elements[0].value))) return true;
  // Opis pozycji listy wyboru: this.wybor('…', [['wartosc', 'Opis'], …]) – drugi i dalsze elementy pary.
  if (r.type === 'ArrayExpression' && r.elements.indexOf(dziecko) >= 1) {
    const lista = anc[i - 1]; const wyw = anc[i - 2];
    return lista?.type === 'ArrayExpression' && (wyw?.type === 'CallExpression') && wyw.arguments[1] === lista
      && wyw.callee.type === 'MemberExpression' && ['wybor', 'segmenty'].includes(nazwaWywolania(wyw.callee));
  }
  return false;
}

// Zdania budowane w kodzie (#356): `Usunięto ${n} ${odmiana(n, 'obraz', 'obrazy', 'obrazów')}.` →
// t('obszar.klucz', { n }) z wartością „Usunięto {n} {n, plural, one {obraz} few {obrazy} many {obrazów} other {obrazów}}.”.
const POLSKIE_SLOWA = /(^|[^\p{L}])(nie|jest|są|się|na|do|lub|albo|tylko|oraz|przy|dla|już|jeszcze|wszystkie|projekt\w*|stron\w*|tekst\w*|obraz\w*|plik\w*|zapis\w*|usun\w*|dodan\w*|wczyt\w*|kolumn\w*|wiersz\w*|tabel\w*|sekcj\w*|wzorz?ec\w*|element\w*|czcion\w*|kolor\w*)(?=$|[^\p{L}])/iu;
const polskie = (t) => /[ąćęłńóśźż]/i.test(t) || POLSKIE_SLOWA.test(t);
// W miejscu na pewno na ekranie wystarczy, że to wygląda na zdanie albo nazwę (słowo, spacja albo wielka litera).
const tekstowy = (t) => /\p{L}{3,}/u.test(t) && (/\s/.test(t.trim()) || /^\p{Lu}/u.test(t.trim()) || polskie(t));
const nazwaZmiennej = (e, kod) => {
  if (e.type === 'Identifier') return e.name;
  if (e.type === 'MemberExpression' && !e.computed) {
    if (e.property.name === 'length') return `${nazwaZmiennej(e.object, kod)}Ile`;
    return e.property.name;
  }
  if (e.type === 'CallExpression') { const n = nazwaWywolania(e.callee); if (n) return n; }
  return 'x';
};

function zbierzPliki() {
  const wynik = [];
  const zbierz = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { if (!/zewnetrzne|jezyki/.test(p)) zbierz(p); } else if (f.endsWith('.js')) wynik.push(p);
    }
  };
  zbierz(path.join(KORZEN, 'js'));
  return wynik;
}

function main() {
  const pliki = process.argv.slice(2).length ? process.argv.slice(2).map((p) => path.resolve(p)) : zbierzPliki();
  // Znane tłumaczenia: „polski napis → tłumaczenie” ze słowników kluczy (dawne słowniki usunięte, #358).
  const stare = Object.fromEntries(JEZYKI.map((j) => {
    const pl = czytaj(plikKluczy('pl')); const sl = czytaj(plikKluczy(j)); const m = {};
    for (const [k, v] of Object.entries(pl)) if (sl[k] !== undefined && m[norm(v)] === undefined) m[norm(v)] = sl[k];
    return [j, m];
  }));
  const klucze = { pl: czytaj(plikKluczy('pl')), ...Object.fromEntries(JEZYKI.map((j) => [j, czytaj(plikKluczy(j))])) };
  const wObszarze = new Map();
  for (const [k, v] of Object.entries(klucze.pl)) wObszarze.set(`${k.split('.')[0]}|${v}`, k);
  const zajete = new Set(Object.keys(klucze.pl));
  const nadajKlucz = (obszar, tekst) => {
    const juz = wObszarze.get(`${obszar}|${tekst}`);
    if (juz) return juz;
    const naNazwe = tekst.replace(/\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, ' ');
    let k = `${obszar}.${camel(naNazwe)}`;
    for (let i = 2; zajete.has(k); i += 1) k = `${obszar}.${camel(naNazwe)}${i}`;
    zajete.add(k);
    wObszarze.set(`${obszar}|${tekst}`, k);
    klucze.pl[k] = tekst;
    for (const j of JEZYKI) klucze[j][k] = stare[j][tekst];
    return k;
  };

  let razem = 0;
  for (const plik of pliki) {
    const wzgl = path.relative(path.join(KORZEN, 'js'), plik).replace(/\\/g, '/');
    if (wzgl === 'jezyk.js' || wzgl.startsWith('..')) continue;
    const kod = fs.readFileSync(plik, 'utf8');
    if (/PLIK SKŁADANY|Plik wygenerowany/.test(kod.slice(0, 400))) continue; // pliki składane skryptami
    if (/WSPOLNE-POCZATEK/.test(kod)) continue; // kod wspólny z łącznikiem AI (Deno) – musi być dosłownie taki sam
    let ast;
    try { ast = acorn.parse(kod, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (e) { console.warn(`pominięty ${wzgl}: ${e.message}`); continue; }
    biezacyPlik = path.basename(plik);
    const obszar = camel(wzgl.replace(/\.js$/, '').replace(/^app\//, '').replace(/[/-]/g, ' '), 6);
    // Nazwa funkcji: t, a gdy plik ma już własne „t” (parametr, zmienna) – tt.
    const nazwy = new Set();
    const zamiany = [];
    // Szablon → t('klucz', { zmienne }); wyrażenia: odmiana(…) → plural, napisy w warunkach – własne klucze.
    const zrodlo = (e) => kod.slice(e.start, e.end);
    const przepiszWyrazenie = (e) => {
      // napisy w gałęziach warunku: a ? ' (ze wzorca)' : ''
      const wewn = [];
      const szukaj = (x, rodzic) => {
        if (!x || typeof x.type !== 'string') return;
        const wGalezi = rodzic && ((rodzic.type === 'ConditionalExpression' && rodzic.test !== x) || (rodzic.type === 'LogicalExpression' && rodzic.right === x));
        if (wGalezi && x.type === 'Literal' && typeof x.value === 'string' && tekstowy(x.value) && !/[{}<>`]/.test(x.value)) { wewn.push({ od: x.start, do: x.end, tekst: `@@('${nadajKlucz(obszar, x.value)}')` }); return; }
        if (wGalezi && x.type === 'TemplateLiteral' && (tekstowy(x.quasis.map((q) => q.value.cooked || '').join(' ')) || x.expressions.some((y) => y.type === 'CallExpression' && nazwaWywolania(y.callee) === 'odmiana')) && !x.quasis.some((q) => /<[a-z]|[{}]/i.test(q.value.cooked || ''))) {
          const g = przepiszSzablon(x); if (g) { wewn.push({ od: x.start, do: x.end, tekst: g }); return; }
        }
        if (x.type === 'CallExpression' && nazwaWywolania(x.callee) === 'odmiana') return;
        for (const [k, v] of Object.entries(x)) {
          if (k === 'loc') continue;
          if (Array.isArray(v)) v.forEach((y) => szukaj(y, x)); else if (v && typeof v === 'object' && typeof v.type === 'string') szukaj(v, x);
        }
      };
      szukaj(e, null);
      let t = zrodlo(e);
      for (const w of wewn.sort((a, b) => b.od - a.od)) t = t.slice(0, w.od - e.start) + w.tekst + t.slice(w.do - e.start);
      return t;
    };
    const przepiszSzablon = (tl) => {
      const zmienne = new Map(); // źródło → nazwa
      const uzyte = new Set();
      const zmienna = (e) => {
        const z = zrodlo(e);
        if (zmienne.has(z)) return zmienne.get(z).nazwa;
        let nz = nazwaZmiennej(e).replace(/^[^A-Za-z_]+/, '') || 'x';
        for (let i = 2; uzyte.has(nz); i += 1) nz = `${nazwaZmiennej(e)}${i}`;
        uzyte.add(nz);
        zmienne.set(z, { nazwa: nz, wyr: e });
        return nz;
      };
      let wartosc = '';
      const kawalki = tl.quasis.map((q) => q.value.cooked);
      const wKlamrach = new Set();
      tl.expressions.forEach((e, i) => { if (kawalki[i].endsWith('{') && kawalki[i + 1].startsWith('}')) { kawalki[i] = kawalki[i].slice(0, -1); kawalki[i + 1] = kawalki[i + 1].slice(1); wKlamrach.add(e); } });
      if (kawalki.some((x) => /[{}]/.test(x))) return null;
      tl.quasis.forEach((q, i) => {
        wartosc += kawalki[i];
        const e = tl.expressions[i];
        if (!e) return;
        if (e.type === 'CallExpression' && nazwaWywolania(e.callee) === 'odmiana' && e.arguments.length === 4
          && e.arguments.slice(1).every((a) => a.type === 'Literal' && typeof a.value === 'string')) {
          const [n, a, b, c] = e.arguments;
          wartosc += `{${zmienna(n)}, plural, one {${a.value}} few {${b.value}} many {${c.value}} other {${c.value}}}`;
        } else wartosc += `{${zmienna(e)}}`;
      });
      if (!/\p{L}{2}/u.test(wartosc.replace(/\{\w+\}/g, ''))) return null;
      const k = nadajKlucz(obszar, wartosc, true);
      const pary = [...zmienne.values()].map(({ nazwa, wyr }) => {
        const w = wKlamrach.has(wyr) ? `\`{\${${przepiszWyrazenie(wyr)}}}\`` : przepiszWyrazenie(wyr);
        return w === nazwa ? nazwa : `${nazwa}: ${w}`;
      });
      return pary.length ? `@@('${k}', { ${pary.join(', ')} })` : `@@('${k}')`;
    };
    const odwiedz = (n, anc) => {
      if (!n || typeof n.type !== 'string') return;
      anc.push(n);
      if (n.type === 'Identifier') nazwy.add(n.name);
      const zOdmiana = n.type === 'TemplateLiteral' && n.expressions.some((e) => e.type === 'CallExpression' && nazwaWywolania(e.callee) === 'odmiana');
      if (n.type === 'TemplateLiteral' && !n.quasis.some((q) => /<[a-z]/i.test(q.value.cooked || '') || /[{}]/.test((q.value.cooked || '').replace(/^\}|\{$/g, '')))
        && (zOdmiana || tekstowy(n.quasis.map((q) => q.value.cooked || '').join(' ')))
        && (zOdmiana || naEkranie(anc) || (/\s/.test(n.quasis.map((q) => q.value.cooked).join('').trim()) && poSrednio(anc)))) {
        const gotowe = przepiszSzablon(n);
        if (gotowe) { zamiany.push({ od: n.start, do: n.end, gotowe }); anc.pop(); return; }
      }
      // Polski napis spoza dawnego słownika w miejscu na ekranie (#356) – tłumaczenie dojdzie osobno.
      if (n.type === 'Literal' && typeof n.value === 'string' && n.value.trim().length > 1 && tekstowy(n.value)
        && stare.en[norm(n.value)] === undefined && !/[{}<>`]/.test(n.value) && naEkranie(anc)) {
        zamiany.push({ od: n.start, do: n.end, gotowe: `@@('${nadajKlucz(obszar, n.value)}')` });
        anc.pop();
        return;
      }
      // Napisy w kawałkach HTML (#355): >Tekst< i title/placeholder/aria-label/alt="Tekst" w szablonach i napisach.
      if ((n.type === 'TemplateElement' || (n.type === 'Literal' && typeof n.value === 'string')) && /<[a-z]/i.test(n.type === 'Literal' ? n.value : n.value.raw)) {
        const jestLiteral = n.type === 'Literal';
        let surowy = jestLiteral ? n.raw.slice(1, -1) : n.value.raw;
        if (jestLiteral) surowy = surowy.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
        let zmiana = false;
        const bezpieczny = (x) => x.length > 1 && /\p{L}/u.test(x) && /[a-ząćęłńóśźż]{2}/iu.test(x) && stare.en[x] !== undefined
          && ![stare.en[x], stare.uk[x], x].some((v) => v === undefined || /[<>&"`]/.test(v));
        const wynikHtml = surowy
          .replace(/>([^<>$`\\{}]*\p{L}[^<>$`\\{}]*)</gu, (cale, w) => {
            const x = norm(w);
            if (!bezpieczny(x)) return cale;
            zmiana = true;
            return `>${w.match(/^\s*/)[0]}\${@@('${nadajKlucz(obszar, x)}')}${w.match(/\s*$/)[0]}<`;
          })
          .replace(/\b(title|placeholder|aria-label|alt)="([^"$`\\{}]+)"/g, (cale, at, w) => {
            const x = norm(w);
            if (!bezpieczny(x)) return cale;
            zmiana = true;
            return `${at}="\${@@('${nadajKlucz(obszar, x)}')}"`;
          });
        if (zmiana) zamiany.push({ od: n.start, do: n.end, gotowe: jestLiteral ? `\`${wynikHtml}\`` : wynikHtml });
      }
      if (n.type === 'Literal' && typeof n.value === 'string') {
        const tekst = norm(n.value);
        if (tekst.length > 1 && /\p{L}/u.test(tekst) && (/\s/.test(tekst) || /^\p{Lu}/u.test(tekst)) && stare.en[tekst] !== undefined && tekst === n.value && naEkranie(anc)) {
          zamiany.push({ od: n.start, do: n.end, tekst });
        }
      }
      for (const [k, v] of Object.entries(n)) {
        if (k === 'loc' || k === 'range') continue;
        if (Array.isArray(v)) v.forEach((x) => odwiedz(x, anc));
        else if (v && typeof v === 'object' && typeof v.type === 'string') odwiedz(v, anc);
      }
      anc.pop();
    };
    odwiedz(ast, []);
    if (!zamiany.length) continue;
    const importJezyka = ast.body.find((x) => x.type === 'ImportDeclaration' && /(^|\/)jezyk\.js$/.test(x.source.value));
    const jest = importJezyka?.specifiers.find((s) => s.imported?.name === 't');
    const fn = jest ? jest.local.name : (nazwy.has('t') ? 'tt' : 't');
    if (!jest && nazwy.has(fn)) { console.warn(`pominięty ${wzgl}: zajęte nazwy t i tt`); continue; }
    let nowy = kod;
    for (const z of [...zamiany].sort((a, b) => b.od - a.od)) {
      const tekst = z.gotowe !== undefined ? z.gotowe.replace(/@@\(/g, `${fn}(`) : `${fn}('${nadajKlucz(obszar, z.tekst)}')`;
      nowy = `${nowy.slice(0, z.od)}${tekst}${nowy.slice(z.do)}`;
    }
    if (!jest) {
      const spec = fn === 't' ? 't' : 't as tt';
      if (importJezyka) {
        // dopisanie do istniejącego importu (pozycje sprzed zamian – import jest przed literałami)
        const ost = importJezyka.specifiers[importJezyka.specifiers.length - 1];
        nowy = `${nowy.slice(0, ost.end)}, ${spec}${nowy.slice(ost.end)}`;
      } else {
        const rel = path.relative(path.dirname(plik), path.join(KORZEN, 'js', 'jezyk.js')).replace(/\\/g, '/');
        const zrodlo = rel.startsWith('.') ? rel : `./${rel}`;
        const imp = ast.body.filter((x) => x.type === 'ImportDeclaration').pop();
        const linia = `import { ${spec} } from '${zrodlo}';\n`;
        if (imp) { const kon = nowy.indexOf('\n', imp.end) + 1; nowy = nowy.slice(0, kon) + linia + nowy.slice(kon); } else {
          // po komentarzach na początku pliku
          const m = /^(?:\s*\/\/[^\n]*\n|\s*\/\*[\s\S]*?\*\/\s*\n)*/.exec(nowy);
          nowy = nowy.slice(0, m[0].length) + linia + nowy.slice(m[0].length);
        }
      }
    }
    fs.writeFileSync(plik, nowy);
    razem += zamiany.length;
    console.log(`${String(zamiany.length).padStart(4)}  ${wzgl}`);
  }
  for (const j of ['pl', ...JEZYKI]) {
    const posortowane = Object.fromEntries(Object.keys(klucze[j]).sort().map((k) => [k, klucze[j][k]]));
    fs.writeFileSync(plikKluczy(j), `// Słownik kluczy (#339): „obszar.nazwa” → napis (${j}). Klucze z index.html – scripts/i18n-klucze.cjs, z kodu – scripts/i18n-kod.cjs; dalsze dopisywane ręcznie.\nexport default ${JSON.stringify(posortowane, null, 1).replace(/\n /g, '\n  ')};\n`);
  }
  console.log(`Napisów przeniesionych na klucze: ${razem}, kluczy razem: ${Object.keys(klucze.pl).length}`);
}

main();
