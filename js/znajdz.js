// Znajdź i zamień (#131C): szukanie w tekstach wszystkich stron i wzorców projektu (także w grupach,
// tabelach i ramkach połączonego tekstu), opcjonalnie w tabelach danych i nazwach stylów.
// Moduł nie zna edytora: pracuje na zapisie projektu (JSON). Okno: js/app/znajdz-okno.js.
//
// Trafienie: { id, gdzie: 'strona' | 'wzorzec' | 'dane' | 'styl', cel (id strony/wzorca/tabeli/stylu),
//   nazwaCelu, element (id elementu), sciezka (indeksy w grupach), wiersz/kolumna (dane),
//   start, koniec, tekst (cały tekst), przed, trafienie, po (kawałki do podglądu) }.
// Pola {…} zostają nietknięte, chyba że szukana fraza sama zawiera klamrę.

const POLE = /\{[^{}\n]*\}/g;

function wyrazenie(fraza, { wielkosc = false, slowa = false } = {}) {
  const tekst = String(fraza || '');
  if (!tekst) return null;
  const esc = tekst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Całe słowa: litery (także polskie) i cyfry po obu stronach nie mogą przylegać.
  const wzor = slowa ? `(?<![\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])` : esc;
  return new RegExp(wzor, `gu${wielkosc ? '' : 'i'}`);
}

// Zakresy pól {…} w tekście – trafienia w nich pomijamy (chyba że szukamy klamry).
function zakresyPol(tekst) {
  const z = [];
  for (const m of String(tekst).matchAll(POLE)) z.push([m.index, m.index + m[0].length]);
  return z;
}

export function trafieniaWTekscie(tekst, fraza, opcje = {}) {
  const re = wyrazenie(fraza, opcje);
  if (!re || typeof tekst !== 'string' || !tekst) return [];
  const zKlamra = /[{}]/.test(fraza);
  const pola = zKlamra ? [] : zakresyPol(tekst);
  const wynik = [];
  for (const m of tekst.matchAll(re)) {
    const start = m.index;
    const koniec = start + m[0].length;
    if (!m[0].length) continue;
    if (pola.some(([a, b]) => start < b && koniec > a)) continue;
    wynik.push({ start, koniec });
  }
  return wynik;
}

const KONTEKST = 28;
function podglad(tekst, start, koniec) {
  const a = Math.max(0, start - KONTEKST);
  const b = Math.min(tekst.length, koniec + KONTEKST);
  return {
    przed: (a > 0 ? '…' : '') + tekst.slice(a, start).replace(/\s+/g, ' '),
    trafienie: tekst.slice(start, koniec),
    po: tekst.slice(koniec, b).replace(/\s+/g, ' ') + (b < tekst.length ? '…' : ''),
  };
}

const jestTekstem = (o) => o && /^(textbox|i-text|text)$/i.test(o.type) && typeof o.text === 'string';

// Wszystkie elementy tekstowe (z grupami i tabelami) z drogą do nich: [{ o, sciezka }].
function tekstyWObiektach(obiekty, sciezka = []) {
  const wynik = [];
  (obiekty || []).forEach((o, i) => {
    if (!o) return;
    const droga = [...sciezka, i];
    if (jestTekstem(o)) wynik.push({ o, sciezka: droga });
    if (Array.isArray(o.objects)) wynik.push(...tekstyWObiektach(o.objects, droga));
  });
  return wynik;
}

// opcje: { wielkosc, slowa, dane (tabele danych), style (nazwy stylów) }
export function szukaj(projekt, fraza, opcje = {}) {
  const wynik = [];
  if (!projekt || !fraza) return wynik;
  let n = 0;
  const dodaj = (t, baza) => {
    for (const { start, koniec } of trafieniaWTekscie(t, fraza, opcje)) {
      wynik.push({ id: `t${n += 1}`, ...baza, start, koniec, tekst: t, ...podglad(t, start, koniec) });
    }
  };
  (projekt.strony || []).forEach((s, i) => {
    for (const { o, sciezka } of tekstyWObiektach(s.obiekty)) {
      dodaj(o.text, { gdzie: 'strona', cel: s.id, indeksStrony: i, nazwaCelu: s.nazwa || `Strona ${i + 1}`, element: o.id, sciezka });
    }
  });
  (projekt.wzorce || []).forEach((w) => {
    for (const { o, sciezka } of tekstyWObiektach(w.obiekty)) {
      dodaj(o.text, { gdzie: 'wzorzec', cel: w.id, nazwaCelu: `Wzorzec „${w.nazwa || ''}”`, element: o.id, sciezka });
    }
  });
  if (opcje.dane) {
    for (const t of projekt.tabele || []) {
      (t.wiersze || []).forEach((w, r) => (w || []).forEach((k, c) => {
        if (typeof k === 'string' && k) dodaj(k, { gdzie: 'dane', cel: t.id, nazwaCelu: `Dane „${t.nazwa || ''}” · ${t.kolumny?.[c] || `kolumna ${c + 1}`}, wiersz ${r + 1}`, wiersz: r, kolumna: c });
      }));
    }
  }
  if (opcje.style) {
    for (const st of projekt.style || []) dodaj(st.nazwa || '', { gdzie: 'styl', cel: st.id, nazwaCelu: 'Nazwa stylu' });
    for (const st of projekt.style_znakowe || []) dodaj(st.nazwa || '', { gdzie: 'styl', cel: st.id, nazwaCelu: 'Nazwa stylu znakowego', znakowy: true });
  }
  return wynik;
}

// Styl fragmentów po podmianie [a, b) na tekst długości L: zakresy przesuwają się o różnicę, a zamieniony
// kawałek dostaje wygląd pierwszego zamienianego znaku.
export function przesunStyle(styles, a, b, L) {
  if (!Array.isArray(styles)) return styles;
  const d = L - (b - a);
  const mapuj = (i, koniec) => {
    if (i < a || (i === a && !koniec)) return i;
    if (i >= b) return i + d;
    return koniec ? a + L : a;
  };
  return styles.map((s) => ({ ...s, start: mapuj(s.start, false), end: mapuj(s.end, true) }))
    .filter((s) => s.end > s.start);
}

function zamienWTekscie(o, zamiany, nowy) {
  // Od końca – wcześniejsze indeksy się nie przesuwają.
  for (const { start, koniec } of [...zamiany].sort((x, y) => y.start - x.start)) {
    o.text = o.text.slice(0, start) + nowy + o.text.slice(koniec);
    if (Array.isArray(o.styles)) o.styles = przesunStyle(o.styles, start, koniec, nowy.length);
  }
}

const poSciezce = (obiekty, sciezka) => {
  let o = { objects: obiekty };
  for (const i of sciezka) o = o?.objects?.[i];
  return o;
};

// Zamienia podane trafienia (z szukaj na tym samym projekcie) tekstem `nowy`. Zmienia projekt w miejscu.
// Zwraca liczbę zamian i listę zmienionych celów: { strony: Set, wzorce: Set, dane: bool, style: bool }.
export function zamien(projekt, trafienia, nowy) {
  const zmiany = { liczba: 0, strony: new Set(), wzorce: new Set(), dane: false, style: false };
  const grupy = new Map();
  for (const t of trafienia) {
    const klucz = `${t.gdzie}|${t.cel}|${t.element || ''}|${(t.sciezka || []).join('.')}|${t.wiersz ?? ''}|${t.kolumna ?? ''}`;
    if (!grupy.has(klucz)) grupy.set(klucz, { t, lista: [] });
    grupy.get(klucz).lista.push(t);
  }
  for (const { t, lista } of grupy.values()) {
    if (t.gdzie === 'strona' || t.gdzie === 'wzorzec') {
      const zrodlo = t.gdzie === 'strona' ? projekt.strony?.find((s) => s.id === t.cel) : projekt.wzorce?.find((w) => w.id === t.cel);
      const o = zrodlo && poSciezce(zrodlo.obiekty, t.sciezka);
      if (!o || o.id !== t.element || o.text !== t.tekst) continue; // projekt zmienił się od szukania
      zamienWTekscie(o, lista, nowy);
      (t.gdzie === 'strona' ? zmiany.strony : zmiany.wzorce).add(t.cel);
    } else if (t.gdzie === 'dane') {
      const tab = projekt.tabele?.find((x) => x.id === t.cel);
      const w = tab?.wiersze?.[t.wiersz];
      if (!w || w[t.kolumna] !== t.tekst) continue;
      const o = { text: w[t.kolumna] };
      zamienWTekscie(o, lista, nowy);
      w[t.kolumna] = o.text;
      zmiany.dane = true;
    } else if (t.gdzie === 'styl') {
      const st = (t.znakowy ? projekt.style_znakowe : projekt.style)?.find((x) => x.id === t.cel);
      if (!st || st.nazwa !== t.tekst) continue;
      const o = { text: st.nazwa };
      zamienWTekscie(o, lista, nowy);
      st.nazwa = o.text;
      zmiany.style = true;
    }
    zmiany.liczba += lista.length;
  }
  return zmiany;
}
