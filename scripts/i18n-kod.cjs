#!/usr/bin/env node
// Napisy interfejsu w kodzie JS na klucze (#346, etap 3 z #339 – jak w Familiadzie): 'Zapisz' → t('obszar.zapisz').
// Obszar – nazwa pliku (js/app/podglad-ekran.js → podgladEkran). Zamieniane są tylko napisy, które na pewno trafiają
// na ekran: powiadomienia i pytania, etykiety paneli, podpowiedzi (title, placeholder, aria-label), textContent,
// pola tytul/opis/etykieta w obiektach, opisy pozycji list wyboru. Porównania, dane projektu (nazwy stron, treść
// tekstów), klucze obiektów i pliki składane (ai-narzedzia-rdzen.js) zostają nietknięte. Tłumaczenia kluczy biorą
// się z dawnych słowników „polski napis → tłumaczenie” (js/jezyki/<język>.js), polski tekst – z kodu.
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

const nazwaWywolania = (c) => (c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : null);

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
    return WLASCIWOSCI.has(k);
  }
  // Opis pozycji listy wyboru: this.wybor('…', [['wartosc', 'Opis'], …]) – drugi i dalsze elementy pary.
  if (r.type === 'ArrayExpression' && r.elements.indexOf(dziecko) >= 1) {
    const lista = anc[i - 1]; const wyw = anc[i - 2];
    return lista?.type === 'ArrayExpression' && (wyw?.type === 'CallExpression') && wyw.arguments[1] === lista
      && wyw.callee.type === 'MemberExpression' && ['wybor', 'segmenty'].includes(nazwaWywolania(wyw.callee));
  }
  return false;
}

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
  const stare = Object.fromEntries(JEZYKI.map((j) => [j, czytaj(path.join(KORZEN, 'js', 'jezyki', `${j}.js`))]));
  const klucze = { pl: czytaj(plikKluczy('pl')), ...Object.fromEntries(JEZYKI.map((j) => [j, czytaj(plikKluczy(j))])) };
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
    for (const j of JEZYKI) klucze[j][k] = stare[j][tekst];
    return k;
  };

  let razem = 0;
  for (const plik of pliki) {
    const wzgl = path.relative(path.join(KORZEN, 'js'), plik).replace(/\\/g, '/');
    if (wzgl === 'jezyk.js' || wzgl.startsWith('..')) continue;
    const kod = fs.readFileSync(plik, 'utf8');
    if (/PLIK SKŁADANY|Plik wygenerowany/.test(kod.slice(0, 400))) continue; // pliki składane skryptami
    let ast;
    try { ast = acorn.parse(kod, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (e) { console.warn(`pominięty ${wzgl}: ${e.message}`); continue; }
    const obszar = camel(wzgl.replace(/\.js$/, '').replace(/^app\//, '').replace(/[/-]/g, ' '), 6);
    // Nazwa funkcji: t, a gdy plik ma już własne „t” (parametr, zmienna) – tt.
    const nazwy = new Set();
    const zamiany = [];
    const odwiedz = (n, anc) => {
      if (!n || typeof n.type !== 'string') return;
      anc.push(n);
      if (n.type === 'Identifier') nazwy.add(n.name);
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
    for (const z of [...zamiany].sort((a, b) => b.od - a.od)) nowy = `${nowy.slice(0, z.od)}${fn}('${nadajKlucz(obszar, z.tekst)}')${nowy.slice(z.do)}`;
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
