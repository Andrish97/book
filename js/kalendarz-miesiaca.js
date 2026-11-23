// Kalendarz miesiąca (decyzja #131A): tabela z siatką dni jednego miesiąca. To zwykła tabela
// (js/tabela-obiekt.js) z opisem w polu `kalendarz` – linie, tła, czcionka i wyrównanie zmienia się jak
// w tabeli, a treść komórek (daty, nazwy dni, numery tygodni) układa ulozKalendarz() przy każdej zmianie.
//
// Opis `kalendarz`:
//   rok, miesiac (1–12)          – miesiąc pokazany na stronie (gdy nie ma danych – także podgląd w edytorze),
//   pole_daty, pole_roku          – miesiąc z kolumny danych (np. „2027-03”, „marzec 2027”, „3”) – na każdej
//                                   stronie serii inny; pole_roku podaje rok, gdy kolumna daty ma sam miesiąc,
//   pierwszy: 1 | 0               – tydzień od poniedziałku albo od niedzieli,
//   nazwy: 'pelne' | 'skrot' | 'litery',
//   tytul: bool                   – wiersz z nazwą miesiąca i rokiem nad nazwami dni,
//   tygodnie: bool                – kolumna z numerami tygodni (ISO 8601),
//   inne: 'pokaz' | 'wyszarz' | 'ukryj' – dni poprzedniego i następnego miesiąca w pierwszym i ostatnim tygodniu,
//   notatki: bool                 – data w rogu komórki, reszta komórki na notatki (wyższe wiersze),
//   swieta: bool                  – polskie święta (stałe i ruchome),
//   nazwy_swiat: bool             – nazwa święta pod datą,
//   swieta_z: { tabela, data, nazwa } – dodatkowe święta z tabeli danych (kolumna daty i kolumna nazwy),
//   wiersz_dnia: mm               – wysokość wiersza tygodnia,
//   kolory: { dni, naglowek, niedziele, soboty, swieta, inne } – soboty: null = jak zwykłe dni.

import './fabric-ustawienia.js';
import { nowaTabela, ulozTabele, komorkiTabeli, dodajWiersz, usunWiersz, dodajKolumne, usunKolumne, opisTabeli } from './tabela-obiekt.js';
import { swietaPolskie, dataZTekstu, dataIso } from './swieta.js';
import { miesiaceWielka, dniOdPon, dniKrotkieOdPon, dniLiteryOdPon, miesiace as miesiaceJ, miesiaceDopelniacz, jezykTresci } from './nazwy-dat.js';

export const MIESIACE = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const MIESIACE_DOPELNIACZ = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
// Od poniedziałku, w języku kalendarza (k.jezyk – zapisany przy tworzeniu; istniejące kalendarze: pl, #409).
const DNI = {
  pelne: (j) => dniOdPon(j).map((d) => d[0].toLocaleUpperCase() + d.slice(1)),
  skrot: (j) => dniKrotkieOdPon(j),
  litery: (j) => dniLiteryOdPon(j),
};

export const KOLORY_DOMYSLNE = { dni: '#1a1a1a', naglowek: '#1a1a1a', niedziele: '#c62828', soboty: null, swieta: '#c62828', inne: '#b5b2aa' };

export const toKalendarz = (o) => Boolean(o && o.kalendarz && o.tabela && typeof o.getObjects === 'function');

export function normalizujKalendarz(k = {}) {
  const dzis = new Date();
  const liczba = (v, d, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  return {
    rok: liczba(k.rok, dzis.getFullYear(), 1600, 3000),
    miesiac: liczba(k.miesiac, dzis.getMonth() + 1, 1, 12),
    pole_daty: k.pole_daty || undefined,
    pole_roku: k.pole_roku || undefined,
    pierwszy: k.pierwszy === 0 ? 0 : 1,
    nazwy: ['pelne', 'skrot', 'litery'].includes(k.nazwy) ? k.nazwy : 'skrot',
    jezyk: ['pl', 'en', 'uk'].includes(k.jezyk) ? k.jezyk : 'pl',
    tytul: k.tytul !== false,
    tygodnie: Boolean(k.tygodnie),
    inne: ['pokaz', 'wyszarz', 'ukryj'].includes(k.inne) ? k.inne : 'wyszarz',
    notatki: Boolean(k.notatki),
    swieta: k.swieta !== false,
    nazwy_swiat: Boolean(k.nazwy_swiat),
    swieta_z: k.swieta_z?.tabela ? { tabela: k.swieta_z.tabela, data: k.swieta_z.data || '', nazwa: k.swieta_z.nazwa || '' } : undefined,
    wiersz_dnia: Math.max(4, Number(k.wiersz_dnia) || 9),
    kolory: { ...KOLORY_DOMYSLNE, ...(k.kolory || {}) },
  };
}

// Miesiąc z wartości kolumny: „2027-03”, „2027-03-15”, „03.2027”, „15.03.2027”, „marzec 2027”, „marca”, „3”.
// Zwraca { rok | null, miesiac } albo null.
export function miesiacZWartosci(v) {
  const t = String(v ?? '').trim().toLowerCase();
  if (!t) return null;
  let m = t.match(/^(\d{4})[-./](\d{1,2})(?:[-./]\d{1,2})?$/);
  if (m) return { rok: Number(m[1]), miesiac: Number(m[2]) };
  m = t.match(/^(?:\d{1,2}[./-])?(\d{1,2})[./-](\d{4})$/);
  if (m) return { rok: Number(m[2]), miesiac: Number(m[1]) };
  m = t.match(/^(\d{1,2})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return { rok: null, miesiac: Number(m[1]) };
  const rok = t.match(/(\d{4})/);
  const nazwa = t.replace(/\d+/g, '').trim();
  if (nazwa) {
    const n = nazwa.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
    const zgodne = (lista) => lista.findIndex((x) => { const s = x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l'); return s.startsWith(n.slice(0, 3)) && (n.length <= 3 || s.startsWith(n.slice(0, Math.min(n.length, 5)))); });
    let i = zgodne(MIESIACE);
    if (i < 0) i = zgodne(MIESIACE_DOPELNIACZ);
    for (const j of ['en', 'uk']) { if (i < 0) i = zgodne(miesiaceJ(j)); if (i < 0) i = zgodne(miesiaceDopelniacz(j)); } // dane po angielsku i ukraińsku (#409)
    if (i >= 0) return { rok: rok ? Number(rok[1]) : null, miesiac: i + 1 };
  }
  return null;
}

// Numer tygodnia ISO 8601 dla daty UTC.
function tydzienIso(data) {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  const dzien = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dzien);
  const poczatek = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - poczatek) / 86400000 + 1) / 7);
}

// Siatka miesiąca: tygodnie po 7 dni { data (Date UTC), dzien, wMiesiacu, dzienTygodnia (0 = nd) }.
export function siatkaMiesiaca(rok, miesiac, pierwszy = 1) {
  const start = new Date(Date.UTC(rok, miesiac - 1, 1));
  const przesuniecie = (start.getUTCDay() - pierwszy + 7) % 7;
  const dni = new Date(Date.UTC(rok, miesiac, 0)).getUTCDate();
  const tygodni = Math.ceil((przesuniecie + dni) / 7);
  const wynik = [];
  for (let t = 0; t < tygodni; t += 1) {
    const tydzien = [];
    for (let d = 0; d < 7; d += 1) {
      const data = new Date(Date.UTC(rok, miesiac - 1, 1 - przesuniecie + t * 7 + d));
      tydzien.push({ data, dzien: data.getUTCDate(), wMiesiacu: data.getUTCMonth() === miesiac - 1, dzienTygodnia: data.getUTCDay() });
    }
    wynik.push(tydzien);
  }
  return wynik;
}

// Święta z tabeli danych projektu: Map 'RRRR-MM-DD' (albo '*-MM-DD' – co roku) → nazwa.
export function swietaZTabeli(projekt, opis) {
  const mapa = new Map();
  const t = opis && projekt?.tabele?.find((x) => x.id === opis.tabela);
  if (!t) return mapa;
  const kd = t.kolumny.indexOf(opis.data);
  const kn = t.kolumny.indexOf(opis.nazwa);
  if (kd < 0) return mapa;
  for (const w of t.wiersze) {
    const d = dataZTekstu(w[kd]);
    if (!d || !(d.miesiac >= 1 && d.miesiac <= 12)) continue;
    const klucz = d.rok ? dataIso(d.rok, d.miesiac, d.dzien) : `*-${String(d.miesiac).padStart(2, '0')}-${String(d.dzien).padStart(2, '0')}`;
    mapa.set(klucz, kn >= 0 ? String(w[kn] ?? '').trim() : '');
  }
  return mapa;
}

// Miesiąc do pokazania: z kolumny danych (wartosc = funkcja pól strony) albo stały z opisu.
export function miesiacKalendarza(k, wartosc) {
  let rok = k.rok;
  let miesiac = k.miesiac;
  if (k.pole_daty && wartosc) {
    const z = miesiacZWartosci(wartosc(k.pole_daty));
    if (z) { miesiac = z.miesiac; if (z.rok) rok = z.rok; }
    if (k.pole_roku) { const r = Number(String(wartosc(k.pole_roku) ?? '').trim()); if (r >= 1600 && r <= 3000) rok = r; }
  }
  return { rok, miesiac };
}

const tytulMiesiaca = (rok, miesiac, j = 'pl') => `${miesiaceWielka(j)[miesiac - 1]} ${rok}`;

// Układa treść kalendarza w tabeli g. dane: { rok, miesiac, swieta: Map z tabeli danych } (z opisu, gdy brak).
export function ulozKalendarz(g, uid, dane = {}) {
  const k = normalizujKalendarz(g.kalendarz);
  g.kalendarz = k;
  const rok = dane.rok || k.rok;
  const miesiac = dane.miesiac || k.miesiac;
  const siatka = siatkaMiesiaca(rok, miesiac, k.pierwszy);
  const K = 7 + (k.tygodnie ? 1 : 0);
  const naglowkow = (k.tytul ? 1 : 0) + 1;
  const W = naglowkow + siatka.length;
  const t = opisTabeli(g); // własny opis przed pętlami – ulozTabele go już nie podmieni
  // Struktura: kolumny i wiersze dopasowane do miesiąca (4–6 tygodni). Każdy krok musi coś zmienić – inaczej koniec.
  const dalej = (r) => r !== false && r !== -1; // false / -1 – tabela nie dała się zmienić (np. limit wierszy)
  while (t.kolumny.length < K && dalej(dodajKolumne(g, uid, t.kolumny.length - 1)));
  while (t.kolumny.length > K && dalej(usunKolumne(g, t.kolumny.length - 1)));
  while (t.wiersze.length < W && dalej(dodajWiersz(g, uid, t.wiersze.length - 1)));
  while (t.wiersze.length > W && dalej(usunWiersz(g, t.wiersze.length - 1)));
  t.naglowek = true;
  // Wiersz tytułu – jedna komórka na całą szerokość.
  t.scalenia = k.tytul ? [{ w: 0, k: 0, ileW: 1, ileK: K }] : [];
  const komorki = komorkiTabeli(g);
  const wzor = komorki[naglowkow * K + (k.tygodnie ? 1 : 0)] || komorki[0];
  const bazowy = wzor?.fontSize || (9 * 25.4) / 72;
  const wys = t.wiersze;
  if (k.tytul) wys[0] = Math.max(wys[0] || 0, bazowy * 2.4);
  for (let w = naglowkow; w < W; w += 1) wys[w] = k.wiersz_dnia;
  const polskie = k.swieta ? swietaPolskie(rok) : new Map();
  const zDanych = dane.swieta || new Map();
  const swieto = (d) => {
    const klucz = dataIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    const coRoku = `*-${klucz.slice(5)}`;
    if (zDanych.has(klucz)) return { nazwa: zDanych.get(klucz) };
    if (zDanych.has(coRoku)) return { nazwa: zDanych.get(coRoku) };
    if (polskie.has(klucz)) return { nazwa: polskie.get(klucz) };
    return null;
  };
  const kol = k.kolory;
  const ustaw = (c, tekst, wyglad) => {
    if (!c) return;
    c.set({ text: tekst, styles: {}, ...wyglad });
    c.dirty = true;
  };
  const kolejnosc = k.pierwszy === 1 ? [0, 1, 2, 3, 4, 5, 6] : [6, 0, 1, 2, 3, 4, 5];
  let w = 0;
  if (k.tytul) {
    ustaw(komorki[0], tytulMiesiaca(rok, miesiac, k.jezyk), { fontWeight: 'bold', fontSize: bazowy * 1.6, fill: kol.naglowek, textAlign: wzor?.textAlign === 'right' ? 'right' : (k.notatki ? 'left' : 'center') });
    for (let i = 1; i < K; i += 1) ustaw(komorki[i], '', {});
    w = 1;
  }
  // Nazwy dni.
  if (k.tygodnie) ustaw(komorki[w * K], 'tydz.', { fontWeight: 'normal', fontSize: bazowy * 0.8, fill: kol.inne });
  kolejnosc.forEach((d, i) => {
    const niedziela = d === 6;
    const sobota = d === 5;
    ustaw(komorki[w * K + i + (k.tygodnie ? 1 : 0)], DNI[k.nazwy](k.jezyk)[d], {
      fontWeight: 'bold', fontSize: bazowy,
      fill: (niedziela && kol.niedziele) || (sobota && kol.soboty) || kol.naglowek,
    });
  });
  w += 1;
  // Dni.
  for (const tydzien of siatka) {
    if (k.tygodnie) {
      const czwartekLubPon = tydzien.find((x) => x.data.getUTCDay() === 4) || tydzien[0];
      ustaw(komorki[w * K], String(tydzienIso(czwartekLubPon.data)), { fontWeight: 'normal', fontSize: bazowy * 0.8, fill: kol.inne });
    }
    tydzien.forEach((x, i) => {
      const c = komorki[w * K + i + (k.tygodnie ? 1 : 0)];
      if (!x.wMiesiacu && k.inne === 'ukryj') { ustaw(c, '', { fontWeight: 'normal', fontSize: bazowy }); return; }
      const s = x.wMiesiacu ? swieto(x.data) : null;
      let fill = kol.dni;
      if (x.dzienTygodnia === 6 && kol.soboty) fill = kol.soboty;
      if (x.dzienTygodnia === 0 && kol.niedziele) fill = kol.niedziele;
      if (s && kol.swieta) fill = kol.swieta;
      if (!x.wMiesiacu && k.inne === 'wyszarz') fill = kol.inne;
      let tekst = String(x.dzien);
      let styles = {};
      if (s && k.nazwy_swiat && s.nazwa) {
        tekst += `\n${s.nazwa}`;
        // Nazwa święta mniejszym pismem.
        const linia = {};
        for (let z = 0; z < s.nazwa.length; z += 1) linia[z] = { fontSize: bazowy * 0.6, fontWeight: 'normal' };
        styles = { 1: linia };
      }
      ustaw(c, tekst, { fontWeight: 'normal', fontSize: bazowy, fill });
      if (c && Object.keys(styles).length) c.set({ styles });
    });
    w += 1;
  }
  // Notatki: data w lewym górnym rogu; bez notatek – na środku komórki.
  komorki.forEach((c, i) => {
    const wiersz = Math.floor(i / K);
    if (wiersz < naglowkow) { c.set({ textAlign: k.tytul && wiersz === 0 ? c.textAlign : 'center', wyrownanie_pion: 'srodek' }); return; }
    if (k.notatki) c.set({ textAlign: c.textAlign === 'right' ? 'right' : 'left', wyrownanie_pion: undefined });
    else c.set({ textAlign: 'center', wyrownanie_pion: 'srodek' });
  });
  // Komórki kalendarza wypełnia aplikacja – nie piszemy w nich.
  for (const c of komorki) c.set({ editable: false });
  ulozTabele(g);
  return g;
}

// Nowy kalendarz miesiąca (jeszcze poza płótnem).
export function nowyKalendarz({ rok, miesiac, szerokosc = 120, lewo = 0, gora = 0, wyglad = {}, opis = {} } = {}, uid) {
  const k = normalizujKalendarz({ rok, miesiac, jezyk: jezykTresci(), ...opis }); // nowy kalendarz w języku interfejsu (#409)
  const g = nowaTabela({ wiersze: 8, kolumny: 7, szerokosc, wysokoscWiersza: k.wiersz_dnia, naglowek: true, lewo, gora, wyglad }, uid);
  g.kalendarz = k;
  g.tabela.linia = { kolor: '#c9c6bf', grubosc: 0.2 };
  return ulozKalendarz(g, uid, {});
}

export function opisMiesiaca(rok, miesiac, j) { return tytulMiesiaca(rok, miesiac, j); }
