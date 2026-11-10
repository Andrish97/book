// Pola w tekście: {nazwa} albo {nazwa:zapis}. Pole z tabeli bierze wartość
// z kolumny o tej nazwie; pole dokumentu (numer strony, nazwa sekcji, data…)
// wynika z samego projektu – jak pola w Wordzie. Czyste funkcje, bez Fabric.

const WZOR = /\{([^{}\n:]+)(?::([^{}\n]*))?\}/g;

// Pola dokumentu: nazwa → opis (lista do wstawiania i do instrukcji).
export const POLA_DOKUMENTU = [
  ['nr', 'Numer strony (według ustawień numeracji sekcji)'],
  ['nr_ogolny', 'Kolejny numer strony w całym projekcie, licząc od 1'],
  ['nr_w_sekcji', 'Numer strony w jej sekcji, licząc od 1'],
  ['liczba_stron', 'Liczba stron w całym projekcie (ostatni numer)'],
  ['liczba_stron_sekcji', 'Liczba stron w sekcji'],
  ['sekcja', 'Nazwa sekcji'],
  ['nr_sekcji', 'Numer sekcji'],
  ['strona', 'Nazwa strony'],
  ['projekt', 'Nazwa projektu'],
  ['seria', 'Nazwa serii, do której należy strona'],
  ['egzemplarz', 'Numer powielenia w serii (1, 2, 3…)'],
  ['liczba_egzemplarzy', 'Liczba powieleń serii'],
  ['data', 'Dzisiejsza data (dd.mm.rrrr)'],
  ['rok', 'Bieżący rok'],
  ['poczatek', 'Numer pierwszej strony sekcji o podanej nazwie, np. {poczatek:Notatki}'],
  ['koniec', 'Numer ostatniej strony sekcji o podanej nazwie, np. {koniec:Notatki}'],
  ['nr_strony', 'Numer strony o podanej nazwie, np. {nr_strony:Styczeń}'],
];

// Zapisy liczb po dwukropku: {nr:I}, {nr:000}, {egzemplarz:a}…
export const ZAPISY_LICZB = [
  ['', '1, 2, 3'],
  ['00', '01, 02, 03 (tyle cyfr, ile zer)'],
  ['I', 'I, II, III'],
  ['i', 'i, ii, iii'],
  ['A', 'A, B, C'],
  ['a', 'a, b, c'],
];

export function znajdzPola(tekst) {
  const wynik = [];
  if (typeof tekst !== 'string' || !tekst.includes('{')) return wynik;
  for (const m of tekst.matchAll(WZOR)) {
    wynik.push({ start: m.index, koniec: m.index + m[0].length, nazwa: m[1].trim(), zapis: m[2] === undefined ? null : m[2].trim(), cale: m[0] });
  }
  return wynik;
}

function rzymskie(n) {
  if (n <= 0 || n >= 4000) return String(n);
  const znaki = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let wynik = '';
  for (const [wartosc, znak] of znaki) while (n >= wartosc) { wynik += znak; n -= wartosc; }
  return wynik;
}

function litery(n) {
  if (n <= 0) return String(n);
  let wynik = '';
  while (n > 0) { n -= 1; wynik = String.fromCharCode(65 + (n % 26)) + wynik; n = Math.floor(n / 26); }
  return wynik;
}

// Liczba w wybranym zapisie; nieznany zapis zostawia zwykłe cyfry.
export function zapiszLiczbe(n, zapis) {
  if (!Number.isFinite(n)) return '';
  if (!zapis) return String(n);
  if (/^0+$/.test(zapis)) return String(n).padStart(zapis.length, '0');
  if (zapis === 'I') return rzymskie(n);
  if (zapis === 'i') return rzymskie(n).toLowerCase();
  if (zapis === 'A') return litery(n);
  if (zapis === 'a') return litery(n).toLowerCase();
  return String(n);
}

// Podstawia pola w tekście. wartosc(nazwa, zapis) zwraca tekst albo undefined
// (pole nieznane – zostaje bez zmian). Formatowanie fragmentów (styles w zapisie
// Fabric: [{ start, end, style }], numeracja znaków bez znaków nowej linii)
// przesuwa się razem z tekstem; wstawiona wartość dostaje wygląd pierwszego
// znaku pola.
export function podstawWTekscie(tekst, styles, wartosc) {
  const pola = znajdzPola(tekst);
  if (!pola.length) return { text: tekst, styles };
  const maStyle = Array.isArray(styles) && styles.length > 0;
  // Styl każdego znaku (bez znaków nowej linii).
  const stylZnaku = [];
  if (maStyle) for (const s of styles) for (let i = s.start; i < s.end; i += 1) stylZnaku[i] = s.style;

  let wynik = '';
  const noweStyle = [];
  let pozycja = 0; // w tekście źródłowym
  let bezNl = 0; // indeks znaku źródłowego bez nowych linii
  const przepisz = (do_) => {
    for (; pozycja < do_; pozycja += 1) {
      const z = tekst[pozycja];
      wynik += z;
      if (z !== '\n') { noweStyle.push(stylZnaku[bezNl] || null); bezNl += 1; }
    }
  };
  for (const p of pola) {
    const v = wartosc(p.nazwa, p.zapis);
    if (v === undefined || v === null) continue;
    przepisz(p.start);
    const styl = stylZnaku[bezNl] || null;
    const wstawka = String(v);
    wynik += wstawka;
    for (const z of wstawka) if (z !== '\n') noweStyle.push(styl);
    pozycja = p.koniec;
    bezNl += p.cale.length; // pole nie zawiera nowych linii
  }
  przepisz(tekst.length);
  if (!maStyle) return { text: wynik, styles };

  // Z powrotem do odcinków { start, end, style }.
  const odcinki = [];
  noweStyle.forEach((styl, i) => {
    if (!styl) return;
    const ostatni = odcinki.at(-1);
    if (ostatni && ostatni.end === i && ostatni.style === styl) ostatni.end += 1;
    else odcinki.push({ start: i, end: i + 1, style: styl });
  });
  return { text: wynik, styles: odcinki };
}

// Podstawia pola we wszystkich tekstach listy obiektów (także w grupach).
export function podstawWObiektach(obiekty, wartosc) {
  return (obiekty || []).map((o) => {
    let k = o;
    if (typeof o.text === 'string' && o.text.includes('{')) {
      const { text, styles } = podstawWTekscie(o.text, o.styles, wartosc);
      if (text !== o.text) k = { ...o, text, styles };
    }
    if (Array.isArray(o.objects)) k = { ...k, objects: podstawWObiektach(o.objects, wartosc) };
    return k;
  });
}

// Nazwy pól użytych w obiektach (do ostrzeżeń i podpowiedzi).
export function polaWObiektach(obiekty, zbior = new Set()) {
  for (const o of obiekty || []) {
    for (const p of znajdzPola(o.text)) zbior.add(p.nazwa);
    if (o.pole?.kolumna) zbior.add(o.pole.kolumna);
    if (Array.isArray(o.objects)) polaWObiektach(o.objects, zbior);
  }
  return zbior;
}
