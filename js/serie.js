// Serie i rozwinięcie projektu (sekcja 5 planu).
//
// Seria to ciąg sąsiednich stron (blok), który powiela się według tabeli
// danych albo zadaną liczbę razy. Powielone strony nie są nigdzie zapisywane:
// powstają tu, przy składaniu – dlatego podgląd, udostępniony link i wydruk
// zawsze pokazują aktualne dane.
//
// rozwin(projekt) zwraca „ciąg”: wszystkie egzemplarze stron w kolejności
// wydruku, z numerami, stroną rozkładówki i wierszem danych.

import { sekcjaStrony } from './projekt.js';
import { zapiszLiczbe } from './pola.js';

// Wiersze tabeli jako obiekty { kolumna: wartość }.
export function wierszeTabeli(tabela) {
  if (!tabela) return [];
  return tabela.wiersze.map((w) => Object.fromEntries(tabela.kolumny.map((k, i) => [k, w[i] ?? ''])));
}

export const tabelaSerii = (projekt, seria) => projekt.tabele.find((t) => t.id === seria?.tabela) || null;

// Ile razy powiela się blok o danej liczbie stron.
//  - tryb 'tabela', układ 'szeroki': jeden wiersz = jeden cały blok,
//  - tryb 'tabela', układ 'dlugi': jeden wiersz = jedna strona bloku,
//  - tryb 'stala': zadana liczba razy (dane z tabeli, jeśli jest, idą w kółko).
export function liczbaPowielen(projekt, seria, dlugoscBloku) {
  if (seria.tryb === 'stala') return Math.max(1, Math.round(seria.ile) || 1);
  const wiersze = tabelaSerii(projekt, seria)?.wiersze.length || 0;
  if (!wiersze) return 1; // pusta tabela: blok pokazuje się raz, jako wzór
  return seria.uklad === 'dlugi' ? Math.ceil(wiersze / dlugoscBloku) : wiersze;
}

function wierszEgzemplarza(seria, wiersze, powielenie, miejsceWBloku, dlugoscBloku) {
  if (!wiersze.length) return null;
  if (seria.tryb === 'stala') return wiersze[powielenie % wiersze.length];
  if (seria.uklad === 'dlugi') return wiersze[powielenie * dlugoscBloku + miejsceWBloku] || {};
  return wiersze[powielenie] || {};
}

// Bloki serii w projekcie: [{ seria, strony: [...] }] – każdy ciąg sąsiednich
// stron tej samej sekcji z tą samą serią.
export function blokiSerii(projekt) {
  const bloki = [];
  let biezacy = null;
  for (const strona of projekt.strony) {
    const seria = strona.seria ? projekt.serie.find((s) => s.id === strona.seria) : null;
    if (seria && biezacy && biezacy.seria === seria && biezacy.strony.at(-1).sekcja === strona.sekcja) biezacy.strony.push(strona);
    else if (seria) { biezacy = { seria, strony: [strona] }; bloki.push(biezacy); } else biezacy = null;
  }
  return bloki;
}

export function rozwin(projekt) {
  const egzemplarze = [];
  const pierwszy = new Map(); // id strony → jej pierwszy egzemplarz
  const blokStrony = new Map();
  for (const blok of blokiSerii(projekt)) for (const s of blok.strony) blokStrony.set(s, blok);

  const dodaj = (strona, dane) => {
    const egz = {
      klucz: dane.nrEgz ? `${strona.id}-${dane.nrEgz}` : strona.id,
      strona, sekcja: sekcjaStrony(projekt, strona), indeks: egzemplarze.length,
      seria: null, nrEgz: null, ileEgz: null, wiersz: null, bok: null, sasiad: null, nr: null, nrWSekcji: 0, ...dane,
    };
    egzemplarze.push(egz);
    if (!pierwszy.has(strona.id)) pierwszy.set(strona.id, egz);
  };

  let i = 0;
  while (i < projekt.strony.length) {
    const strona = projekt.strony[i];
    const blok = blokStrony.get(strona);
    if (!blok) { dodaj(strona, {}); i += 1; continue; }
    const { seria, strony } = blok;
    const ile = liczbaPowielen(projekt, seria, strony.length);
    const wiersze = wierszeTabeli(tabelaSerii(projekt, seria));
    for (let p = 0; p < ile; p += 1) {
      strony.forEach((s, k) => dodaj(s, { seria, nrEgz: p + 1, ileEgz: ile, wiersz: wierszEgzemplarza(seria, wiersze, p, k, strony.length) }));
    }
    i += strony.length;
  }

  // Numeracja, strony rozkładówek i sąsiedzi – już na rozwiniętym ciągu.
  const sekcje = new Map();
  let nastepny = 1;
  projekt.sekcje.forEach((sekcja, nrSekcji) => {
    const lista = egzemplarze.filter((e) => e.sekcja === sekcja);
    const { tryb, od } = sekcja.numeracja || { tryb: 'ciagla' };
    if (tryb === 'od') nastepny = od;
    const rozkladowki = sekcja.uklad === 'rozkladowki';
    lista.forEach((e, k) => {
      e.nrWSekcji = k + 1;
      if (tryb !== 'brak') { e.nr = nastepny; nastepny += 1; }
      if (rozkladowki) {
        const parzysta = k % 2 === 0;
        e.bok = (sekcja.pierwsza === 'prawa') === parzysta ? 'prawa' : 'lewa';
        e.sasiad = lista[e.bok === 'lewa' ? k + 1 : k - 1] || null;
      }
    });
    sekcje.set(sekcja.id, { nr: nrSekcji + 1, lista });
  });
  const numery = egzemplarze.map((e) => e.nr).filter((n) => n !== null);
  return { egzemplarze, pierwszy, sekcje, liczbaStron: numery.length ? Math.max(...numery) : 0 };
}

// Strony edytowane razem na jednym płótnie: [lewa, prawa] albo [strona].
// Parę tworzą dwie różne strony, których pierwsze egzemplarze leżą obok siebie
// w rozwiniętym ciągu. Jednostronicowa seria w rozkładówkach (egzemplarze na
// przemian lewe i prawe) jest edytowana sama.
export function arkuszStrony(strona, ciag) {
  const egz = ciag.pierwszy.get(strona.id);
  const sasiad = egz?.sasiad;
  if (!sasiad || sasiad.strona === strona || ciag.pierwszy.get(sasiad.strona.id) !== sasiad) return [strona];
  return egz.bok === 'lewa' ? [strona, sasiad.strona] : [sasiad.strona, strona];
}

export const bokStrony = (strona, ciag) => ciag.pierwszy.get(strona.id)?.bok || null;

const dzis = () => new Date();
const dwie = (n) => String(n).padStart(2, '0');

// Funkcja wartości pól dla egzemplarza strony: (nazwa, zapis) → tekst albo
// undefined, gdy takiego pola nie ma. Kolumna tabeli ma pierwszeństwo przed
// polem dokumentu o tej samej nazwie.
export function wartosciPol(projekt, egz, ciag) {
  if (!egz) return () => undefined;
  const liczba = (n, zapis) => (n === null || n === undefined ? '' : zapiszLiczbe(n, zapis));
  const sekcjaPoNazwie = (nazwa) => {
    const s = projekt.sekcje.find((x) => x.nazwa.trim().toLowerCase() === String(nazwa || '').trim().toLowerCase());
    return s ? ciag.sekcje.get(s.id).lista : null;
  };
  return (nazwa, zapis) => {
    if (egz.wiersz && Object.prototype.hasOwnProperty.call(egz.wiersz, nazwa)) {
      const v = egz.wiersz[nazwa];
      return zapis && /^\d+$/.test(v) ? zapiszLiczbe(Number(v), zapis) : v;
    }
    switch (nazwa) {
      case 'nr': return liczba(egz.nr, zapis);
      case 'nr_ogolny': return liczba(egz.indeks + 1, zapis);
      case 'nr_w_sekcji': return liczba(egz.nrWSekcji, zapis);
      case 'liczba_stron': return liczba(ciag.liczbaStron, zapis);
      case 'liczba_stron_sekcji': return liczba(ciag.sekcje.get(egz.sekcja.id).lista.length, zapis);
      case 'sekcja': return egz.sekcja.nazwa;
      case 'nr_sekcji': return liczba(ciag.sekcje.get(egz.sekcja.id).nr, zapis);
      case 'strona': return egz.strona.nazwa;
      case 'projekt': return projekt.nazwa;
      case 'seria': return egz.seria ? egz.seria.nazwa : '';
      case 'egzemplarz': return liczba(egz.nrEgz ?? 1, zapis);
      case 'liczba_egzemplarzy': return liczba(egz.ileEgz ?? 1, zapis);
      case 'data': { const d = dzis(); return `${dwie(d.getDate())}.${dwie(d.getMonth() + 1)}.${d.getFullYear()}`; }
      case 'rok': return String(dzis().getFullYear());
      case 'poczatek': { const l = sekcjaPoNazwie(zapis); return l ? liczba(l[0]?.nr ?? null) : undefined; }
      case 'koniec': { const l = sekcjaPoNazwie(zapis); return l ? liczba(l.at(-1)?.nr ?? null) : undefined; }
      case 'nr_strony': {
        const cel = projekt.strony.find((s) => s.nazwa.trim().toLowerCase() === String(zapis || '').trim().toLowerCase());
        return cel ? liczba(ciag.pierwszy.get(cel.id)?.nr ?? null) : undefined;
      }
      default: return undefined;
    }
  };
}
