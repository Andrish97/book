// Serie i rozwinięcie projektu (sekcja 5 planu).
//
// Seria to ciąg sąsiednich stron (blok), który powiela się według tabeli
// danych albo zadaną liczbę razy. Powielone strony nie są nigdzie zapisywane:
// powstają tu, przy składaniu – dlatego podgląd, udostępniony link i wydruk
// zawsze pokazują aktualne dane.
//
// Seria ma tabelę główną (wyznacza, ile razy blok się powiela) i może mieć
// tabele dodatkowe: `dodatkowe: [{ tabela, co, pierwszy? }]`. Tabela dodatkowa
// przechodzi do następnego wiersza co `co` stron serii (np. tabela tygodni co
// 7 stron-dni); `pierwszy` to liczba stron, przez które obowiązuje jej pierwszy
// wiersz (np. rok zaczyna się w środę – pierwszy tydzień ma 5 dni).
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
// Tabele dodatkowe serii, tylko te, które istnieją: [{ tabela, co, pierwszy }].
export function tabeleDodatkowe(projekt, seria) {
  return (seria?.dodatkowe || []).map((d) => {
    const tabela = projekt.tabele.find((t) => t.id === d.tabela);
    const co = Math.max(1, Math.round(d.co) || 1);
    const pierwszy = Math.min(co, Math.max(1, Math.round(d.pierwszy) || co));
    return tabela ? { tabela, co, pierwszy } : null;
  }).filter(Boolean);
}

// Wszystkie tabele, z których strona serii może brać pola: główna i dodatkowe.
export function tabeleSerii(projekt, seria) {
  const glowna = tabelaSerii(projekt, seria);
  return [...(glowna ? [glowna] : []), ...tabeleDodatkowe(projekt, seria).map((d) => d.tabela)];
}

// Rozbiera nazwę pola „Tabela.kolumna” na tabelę i kolumnę; dla zwykłej nazwy
// szuka pierwszej tabeli, która ma taką kolumnę. Zwraca { tabela, kolumna } albo null.
export function polePoTabelach(nazwa, tabele) {
  const mala = nazwa.toLowerCase();
  for (const tabela of tabele) {
    const przedrostek = `${tabela.nazwa.trim().toLowerCase()}.`;
    if (mala.startsWith(przedrostek)) {
      const kolumna = nazwa.slice(przedrostek.length).trim();
      if (tabela.kolumny.includes(kolumna)) return { tabela, kolumna };
    }
  }
  const tabela = tabele.find((t) => t.kolumny.includes(nazwa));
  return tabela ? { tabela, kolumna: nazwa } : null;
}

export function liczbaPowielen(projekt, seria, dlugoscBloku) {
  if (seria.tryb === 'stala') return Math.max(1, Math.round(seria.ile) || 1);
  const wiersze = tabelaSerii(projekt, seria)?.wiersze.length || 0;
  if (!wiersze) return 1; // pusta tabela: blok pokazuje się raz, jako wzór
  return seria.uklad === 'dlugi' ? Math.ceil(wiersze / dlugoscBloku) : wiersze;
}

// Numer wiersza tabeli (od 0), z którego egzemplarz bierze dane; null – bez danych.
function nrWierszaEgzemplarza(seria, ileWierszy, powielenie, miejsceWBloku, dlugoscBloku) {
  if (!ileWierszy) return null;
  if (seria.tryb === 'stala') return powielenie % ileWierszy;
  return seria.uklad === 'dlugi' ? powielenie * dlugoscBloku + miejsceWBloku : powielenie;
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
      seria: null, blok: null, nrEgz: null, ileEgz: null, wiersz: null, nrWiersza: null, dodatkowe: [], bok: null, sasiad: null, nr: null, nrWSekcji: 0, ...dane,
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
    const dodatkowe = tabeleDodatkowe(projekt, seria).map((d) => ({ ...d, wiersze: wierszeTabeli(d.tabela) }));
    // Przy „jeden wiersz na stronę” seria kończy się na ostatnim wierszu danych: ostatnie powielenie
    // bloku może być niepełne. Z opcją `dopelnij` blok jest dokańczany stronami bez danych.
    const ucina = seria.tryb === 'tabela' && seria.uklad === 'dlugi' && wiersze.length > 0 && !seria.dopelnij;
    let n = 0; // kolejna strona tej serii w tym bloku, od 0
    for (let p = 0; p < ile; p += 1) {
      for (const [k, s] of strony.entries()) {
        const nrWiersza = nrWierszaEgzemplarza(seria, wiersze.length, p, k, strony.length);
        if (ucina && nrWiersza >= wiersze.length) break;
        const nrStrony = n;
        dodaj(s, {
          seria, blok, nrEgz: p + 1, ileEgz: ile, nrWiersza, wiersz: nrWiersza === null ? null : (wiersze[nrWiersza] || {}),
          dodatkowe: dodatkowe.map((d) => {
            const nr = nrStrony < d.pierwszy ? 0 : 1 + Math.floor((nrStrony - d.pierwszy) / d.co);
            return { tabela: d.tabela, nrWiersza: nr, wiersz: d.wiersze[nr] || null };
          }),
        });
        n += 1;
      }
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

// Bilans serii po rozwinięciu, osobno dla każdego jej bloku:
// [{ dlugosc, powielen, stron, ostatniePelne, dodatkowe: [{ tabela, co, potrzeba, jest, brakOd }] }]
//  - stron: ile stron seria daje w wydruku; ostatniePelne: czy ostatnie powielenie bloku jest całe,
//  - potrzeba / jest: ile wierszy tabeli dodatkowej potrzeba, a ile jest; brakOd: numer strony
//    wydruku, od której tabeli dodatkowej brakuje wierszy (null – starcza).
export function bilansSerii(projekt, seria, ciag = rozwin(projekt)) {
  const wynik = [];
  let blok = null;
  let zrodlo = null;
  for (const e of ciag.egzemplarze) {
    if (e.seria?.id !== seria.id) continue;
    if (e.blok !== zrodlo) {
      zrodlo = e.blok;
      blok = { dlugosc: 0, powielen: 0, stron: 0, ostatniePelne: true, wOstatnim: 0, dodatkowe: e.dodatkowe.map((d, i) => ({ tabela: d.tabela, co: tabeleDodatkowe(projekt, seria)[i]?.co, potrzeba: 0, jest: d.tabela.wiersze.length, brakOd: null })) };
      wynik.push(blok);
    }
    blok.stron += 1;
    if (e.nrEgz !== blok.powielen) { blok.powielen = e.nrEgz; blok.wOstatnim = 0; }
    blok.wOstatnim += 1;
    if (e.nrEgz === 1) blok.dlugosc += 1;
    e.dodatkowe.forEach((d, i) => {
      const b = blok.dodatkowe[i];
      b.potrzeba = Math.max(b.potrzeba, d.nrWiersza + 1);
      if (!d.wiersz && b.brakOd === null) b.brakOd = e.indeks + 1;
    });
  }
  for (const b of wynik) { b.ostatniePelne = b.wOstatnim === b.dlugosc; delete b.wOstatnim; }
  return wynik;
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
  const glowna = egz.seria ? tabelaSerii(projekt, egz.seria) : null;
  const zrodla = [...(glowna && egz.wiersz ? [{ tabela: glowna, wiersz: egz.wiersz }] : []), ...egz.dodatkowe];
  const tabele = zrodla.map((z) => z.tabela);
  return (nazwa, zapis) => {
    // Kolumna tabeli głównej albo dodatkowej; „Tabela.kolumna” wskazuje tabelę wprost.
    // Gdy tabeli dodatkowej zabrakło wierszy, pole jest znane, ale puste.
    const pole = tabele.length ? polePoTabelach(nazwa, tabele) : null;
    if (pole) {
      const v = zrodla.find((z) => z.tabela === pole.tabela).wiersz?.[pole.kolumna] ?? '';
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
