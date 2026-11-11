// Serie i rozwinięcie projektu (sekcja 5 planu).
//
// Seria to ciąg sąsiednich stron (blok), który powiela się według tabeli
// danych albo zadaną liczbę razy. Powielone strony nie są nigdzie zapisywane:
// powstają tu, przy składaniu – dlatego podgląd, udostępniony link i wydruk
// zawsze pokazują aktualne dane.
//
// Seria ma tabelę główną (wyznacza, ile razy blok się powiela) i może mieć
// tabele dodatkowe: `dodatkowe: [{ tabela, co, pierwszy?, zmiana? }]`. Tabela dodatkowa
// przechodzi do następnego wiersza co `co` stron serii (np. tabela tygodni co
// 7 stron-dni); `pierwszy` to liczba stron, przez które obowiązuje jej pierwszy
// wiersz (np. rok zaczyna się w środę – pierwszy tydzień ma 5 dni).
// Zamiast stałego kroku może mieć `zmiana`: nazwę kolumny tabeli głównej – wtedy
// przechodzi do następnego wiersza, gdy wartość w tej kolumnie się zmieni
// (np. tabela miesięcy przy kolumnie `miesiac` tabeli dni: 31, 28, 30… stron).
// `zmiana` może też być listą kolumn (np. ['miesiac', 'rok']): nowy wiersz, gdy zmieni
// się wartość w którejkolwiek z nich – grudzień 2027 i grudzień 2028 to dwa różne okresy.
//
// Wiersz pomijany: wiersz tabeli głównej, który w pierwszej komórce ma znacznik [pomiń]. Zajmuje
// swoje miejsce w bloku (i w liczeniu tabel dodatkowych), ale strona dla niego nie powstaje. Służy do
// wyrównania danych z blokiem: rok zaczynający się w czwartek dostaje na początku trzy takie wiersze
// i pierwsza strona wydruku to czwarta strona bloku-tygodnia.
//
// Lewa i prawa strona (`pilnuj_stron`, tylko w sekcjach z rozkładówkami): strona bloku ma w wydruku
// stać po tej stronie rozkładówki, po której stoi w układzie stron – a strona za serią po tej, po
// której stałaby, gdyby blok wystąpił raz. Gdy po rozwinięciu wypadłaby po przeciwnej (seria zaczyna
// się od wierszy pomijanych, kończy na nieparzystej liczbie stron, ma pominięty wiersz w środku),
// w tym miejscu staje pusta strona: egzemplarz `pusta: true`, bez treści i wzorców, liczony w numeracji.
//
// rozwin(projekt) zwraca „ciąg”: wszystkie egzemplarze stron w kolejności
// wydruku, z numerami, stroną rozkładówki i wierszem danych.

import { sekcjaStrony } from './projekt.js';
import { zapiszLiczbe } from './pola.js';

// Znacznik wiersza pomijanego – wpisywany w pierwszej komórce wiersza (w Excelu, CSV albo w oknie Dane).
export const ZNACZNIK_POMIJANIA = '[pomiń]';
// Rozpoznawany bez względu na wielkość liter i polski znak: [pomiń], [POMIŃ], [pomin], [ pomiń ].
export const wierszPomijany = (wiersz) => /^\[\s*pomi[nń]\s*\]$/i.test(String(wiersz?.[0] ?? '').trim());
// Ile wierszy tabeli niesie dane (bez pomijanych).
export const wierszyZDanymi = (tabela) => (tabela ? tabela.wiersze.filter((w) => !wierszPomijany(w)).length : 0);

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
// Kolumny z ustawienia `zmiana` (napis albo lista) jako lista bez powtórzeń.
export const kolumnyZmiany = (zmiana) => [...new Set((Array.isArray(zmiana) ? zmiana : [zmiana]).filter((k) => typeof k === 'string' && k))];

// Lista kolumn z powrotem do zapisu: jedna kolumna to napis (jak w starszych projektach), kilka – lista, żadna – brak.
export const zapisZmiany = (kolumny) => (kolumny.length > 1 ? kolumny : (kolumny[0] || undefined));

// Tabele dodatkowe serii, tylko te, które istnieją: [{ tabela, co, pierwszy, zmiana }].
// `zmiana` (napis albo lista kolumn) zawiera tylko kolumny, które tabela główna naprawdę ma; gdy nie ma żadnej,
// jest pusta i działa stały krok.
export function tabeleDodatkowe(projekt, seria) {
  const glowna = tabelaSerii(projekt, seria);
  return (seria?.dodatkowe || []).map((d) => {
    const tabela = projekt.tabele.find((t) => t.id === d.tabela);
    const co = Math.max(1, Math.round(d.co) || 1);
    const pierwszy = Math.min(co, Math.max(1, Math.round(d.pierwszy) || co));
    const zmiana = zapisZmiany(kolumnyZmiany(d.zmiana).filter((k) => glowna?.kolumny.includes(k))) || null;
    return tabela ? { tabela, co, pierwszy, zmiana } : null;
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
// zDanymi: numery wierszy niepomijanych – przy stałej liczbie powieleń dane idą w kółko tylko po nich.
function nrWierszaEgzemplarza(seria, ileWierszy, zDanymi, powielenie, miejsceWBloku, dlugoscBloku) {
  if (!ileWierszy) return null;
  if (seria.tryb === 'stala') return zDanymi.length ? zDanymi[powielenie % zDanymi.length] : null;
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
  const pierwszy = new Map(); // id strony → jej pierwszy egzemplarz (albo wzór, gdy żaden nie powstaje)
  const bloki = []; // opis każdego bloku serii po rozwinięciu (do bilansu i uwag)
  const blokStrony = new Map();
  for (const blok of blokiSerii(projekt)) for (const s of blok.strony) blokStrony.set(s, blok);
  const wSekcji = new Map(); // id sekcji → ile jej stron jest już w ciągu (od tego zależy strona rozkładówki)

  const dodaj = (strona, dane) => {
    const egz = {
      klucz: dane.nrEgz ? `${strona.id}-${dane.nrEgz}` : strona.id,
      strona, sekcja: sekcjaStrony(projekt, strona), indeks: egzemplarze.length,
      seria: null, blok: null, nrEgz: null, ileEgz: null, wiersz: null, nrWiersza: null, dodatkowe: [], bok: null, sasiad: null, nr: null, nrWSekcji: 0, ...dane,
    };
    egzemplarze.push(egz);
    wSekcji.set(egz.sekcja.id, (wSekcji.get(egz.sekcja.id) || 0) + 1);
    if (!egz.pusta && !pierwszy.has(strona.id)) pierwszy.set(strona.id, egz);
    return egz;
  };
  // Pusta strona wstawiona, żeby następna stanęła po właściwej stronie rozkładówki: biała, bez wzorców.
  // `przy` to strona projektu, do której prowadzi kliknięcie w podglądzie.
  const pusta = (sekcja, seria, przy) => {
    const klucz = `pusta-${seria.id}-${egzemplarze.length}`;
    return dodaj({ id: klucz, nazwa: 'Pusta strona', sekcja: sekcja.id, wzorce: [], obiekty: [], tlo: '#ffffff', pusta: true }, { klucz, pusta: true, pustaZa: seria, przy });
  };

  let i = 0;
  while (i < projekt.strony.length) {
    const strona = projekt.strony[i];
    const blok = blokStrony.get(strona);
    if (!blok) { dodaj(strona, {}); i += 1; continue; }
    const { seria, strony } = blok;
    const ile = liczbaPowielen(projekt, seria, strony.length);
    const tabela = tabelaSerii(projekt, seria);
    const wiersze = wierszeTabeli(tabela);
    const pomijane = tabela ? tabela.wiersze.map(wierszPomijany) : [];
    const zDanymi = pomijane.map((x, nr) => (x ? -1 : nr)).filter((nr) => nr >= 0);
    const dodatkowe = tabeleDodatkowe(projekt, seria).map((d) => ({ ...d, wiersze: wierszeTabeli(d.tabela), nr: 0, poprzednia: undefined }));
    // Przy „jeden wiersz na stronę” seria kończy się na ostatnim wierszu danych: ostatnie powielenie
    // bloku może być niepełne. Z opcją `dopelnij` blok jest dokańczany stronami bez danych.
    const ucina = seria.tryb === 'tabela' && seria.uklad === 'dlugi' && wiersze.length > 0 && !seria.dopelnij;
    const sekcja = sekcjaStrony(projekt, strona);
    const rozkladowki = sekcja.uklad === 'rozkladowki';
    const start = wSekcji.get(sekcja.id) || 0; // miejsce w sekcji, na którym staje pierwsza strona bloku
    const info = {
      blok, seria, sekcja, start, dlugosc: strony.length, powielen: ile, pominiete: new Set(), ostatniePelne: true,
      pilnuj: rozkladowki && Boolean(seria.pilnuj_stron), puste: [], zamiana: null,
      dodatkowe: dodatkowe.map((d) => ({ tabela: d.tabela, co: d.co, zmiana: d.zmiana || null })),
      // Dane wzoru dla strony, która nie ma żadnego egzemplarza: pierwszy wiersz z danymi.
      wzor: { nrWiersza: zDanymi.length ? zDanymi[0] : null, wiersz: zDanymi.length ? wiersze[zDanymi[0]] : (wiersze.length ? {} : null), dodatkowe: dodatkowe.map((d) => ({ tabela: d.tabela, nrWiersza: 0, wiersz: d.wiersze[0] || null })) },
    };
    bloki.push(info);
    // Czy strona na miejscu `miejsce` serii stanęłaby teraz po przeciwnej stronie rozkładówki niż w układzie stron.
    const poZlejStronie = (miejsce) => rozkladowki && ((wSekcji.get(sekcja.id) || 0) - (start + miejsce)) % 2 !== 0;
    // W bloku o nieparzystej liczbie stron strony z natury stoją na przemian po lewej i prawej – tam pilnuje się
    // tylko strony za serią.
    const parzysty = strony.length % 2 === 0;
    let n = 0; // kolejne miejsce w serii (strona bloku w kolejnym powieleniu), od 0 – liczone razem z pomijanymi
    let koniec = false;
    for (let p = 0; p < ile && !koniec; p += 1) {
      for (const [k, s] of strony.entries()) {
        const nrWiersza = nrWierszaEgzemplarza(seria, wiersze.length, zDanymi, p, k, strony.length);
        if (ucina && nrWiersza >= wiersze.length) { koniec = true; break; }
        const nrStrony = n;
        n += 1;
        // Wiersz pomijany zajmuje miejsce (tabele dodatkowe liczą je jak każde inne), ale strona nie powstaje.
        if (seria.tryb === 'tabela' && nrWiersza !== null && pomijane[nrWiersza]) { info.pominiete.add(nrWiersza); continue; }
        const wiersz = nrWiersza === null ? null : (wiersze[nrWiersza] || {});
        if (parzysty && poZlejStronie(nrStrony)) {
          if (info.pilnuj) info.puste.push(pusta(sekcja, seria, s));
          else if (info.zamiana === null) info.zamiana = egzemplarze.length;
        }
        dodaj(s, {
          seria, blok, nrEgz: p + 1, ileEgz: ile, nrWiersza, wiersz,
          dodatkowe: dodatkowe.map((d) => {
            let nr;
            if (d.zmiana) {
              // Nowy wiersz, gdy zmieni się wartość w kolumnie tabeli głównej (przy kilku kolumnach – w którejkolwiek);
              // strona bez danych niczego nie zmienia.
              const v = wiersz && nrWiersza < wiersze.length ? kolumnyZmiany(d.zmiana).map((x) => String(wiersz[x] ?? '').trim()).join('\n') : d.poprzednia;
              if (d.poprzednia !== undefined && v !== d.poprzednia) d.nr += 1;
              d.poprzednia = v;
              nr = d.nr;
            } else nr = nrStrony < d.pierwszy ? 0 : 1 + Math.floor((nrStrony - d.pierwszy) / d.co);
            return { tabela: d.tabela, nrWiersza: nr, wiersz: d.wiersze[nr] || null };
          }),
        });
      }
    }
    info.ostatniePelne = n % strony.length === 0;
    // Za serią: następna strona tej sekcji ma stanąć tam, gdzie stałaby, gdyby blok wystąpił raz.
    const nastepna = projekt.strony[i + strony.length];
    if (info.pilnuj && nastepna && sekcjaStrony(projekt, nastepna) === sekcja && poZlejStronie(strony.length)) info.puste.push(pusta(sekcja, seria, strony.at(-1)));
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
        e.bok = bokMiejsca(sekcja, k);
        e.sasiad = lista[e.bok === 'lewa' ? k + 1 : k - 1] || null;
      }
    });
    sekcje.set(sekcja.id, { nr: nrSekcji + 1, lista });
  });
  // Wzory stron do edycji. Strona bloku bez żadnego egzemplarza (wszystkie jej wiersze są pomijane) dostaje wzór,
  // żeby edytor i miniatura miały co pokazać. Przy pilnowaniu stron wzór dostaje też strona, której nie ma
  // w pierwszym powieleniu: w edytorze blok wygląda wtedy zawsze tak samo – strony stoją parami jak w układzie
  // stron, niezależnie od tego, od którego miejsca zaczynają się dane.
  const paryWzoru = new Map(); // id strony → strona, z którą tworzy rozkładówkę we wzorze
  for (const info of bloki) {
    const { strony } = info.blok;
    const rozkladowki = info.sekcja.uklad === 'rozkladowki';
    const widma = new Map();
    strony.forEach((s, j) => {
      const realny = pierwszy.get(s.id);
      if (realny && (realny.nrEgz === 1 || !info.pilnuj)) return;
      const wzor = {
        ...(realny || { strona: s, sekcja: info.sekcja, indeks: null, seria: info.seria, blok: info.blok, nrEgz: 1, ileEgz: info.powielen, ...info.wzor, nr: null, nrWSekcji: 0 }),
        klucz: `${s.id}-wzor`, widmo: true, bok: null, sasiad: null,
      };
      pierwszy.set(s.id, wzor);
      widma.set(j, wzor);
    });
    if (!rozkladowki || !widma.size) continue;
    if (info.pilnuj) {
      for (const [j, wzor] of widma) wzor.bok = bokMiejsca(info.sekcja, info.start + j);
      strony.forEach((s, j) => {
        if (j + 1 >= strony.length || bokMiejsca(info.sekcja, info.start + j) !== 'lewa' || !(widma.has(j) || widma.has(j + 1))) return;
        const prawa = strony[j + 1];
        paryWzoru.set(s.id, prawa);
        paryWzoru.set(prawa.id, s);
        if (widma.has(j)) widma.get(j).sasiad = pierwszy.get(prawa.id);
        if (widma.has(j + 1)) widma.get(j + 1).sasiad = pierwszy.get(s.id);
      });
    } else {
      // Bez pilnowania: wzór stoi po tej stronie, po której stałby względem najbliższej prawdziwej strony bloku.
      const realny = strony.map((s) => pierwszy.get(s.id)).find((e) => !e.widmo);
      for (const [j, wzor] of widma) {
        if (!realny) { wzor.bok = bokMiejsca(info.sekcja, info.start + j); continue; }
        wzor.bok = (j - strony.indexOf(realny.strona)) % 2 === 0 ? realny.bok : (realny.bok === 'lewa' ? 'prawa' : 'lewa');
      }
    }
  }
  const numery = egzemplarze.map((e) => e.nr).filter((n) => n !== null);
  return { egzemplarze, pierwszy, sekcje, bloki, paryWzoru, liczbaStron: numery.length ? Math.max(...numery) : 0 };
}

// Strona rozkładówki dla miejsca k (od 0) w sekcji.
function bokMiejsca(sekcja, k) {
  return (sekcja.pierwsza === 'prawa') === (k % 2 === 0) ? 'prawa' : 'lewa';
}

// Bilans serii po rozwinięciu, osobno dla każdego jej bloku:
// [{ dlugosc, powielen, stron, pominietych, ostatniePelne, puste, zamianaOd, wRozkladowkach, dodatkowe: [{ tabela, co, zmiana, potrzeba, jest, brakOd }] }]
//  - stron: ile stron seria daje w wydruku; pominietych: ile wierszy tabeli jest pomijanych;
//    ostatniePelne: czy ostatnie powielenie bloku doszło do jego ostatniej strony,
//  - potrzeba / jest: ile wierszy tabeli dodatkowej potrzeba, a ile jest; brakOd: numer strony
//    wydruku, od której tabeli dodatkowej brakuje wierszy (null – starcza).
export function bilansSerii(projekt, seria, ciag = rozwin(projekt)) {
  const wynik = new Map();
  for (const info of ciag.bloki) {
    if (info.seria.id !== seria.id) continue;
    wynik.set(info.blok, {
      dlugosc: info.dlugosc, powielen: 0, stron: 0, pominietych: info.pominiete.size, ostatniePelne: info.ostatniePelne,
      // Puste strony wstawione przy pilnowaniu lewej i prawej strony (numery w wydruku) albo – bez pilnowania –
      // numer strony, od której strony bloku wypadają po przeciwnej stronie rozkładówki (null – nigdzie).
      puste: info.puste.map((e) => e.indeks + 1), zamianaOd: info.zamiana === null ? null : info.zamiana + 1, wRozkladowkach: info.sekcja.uklad === 'rozkladowki',
      dodatkowe: info.dodatkowe.map((d) => ({ ...d, potrzeba: 0, jest: d.tabela.wiersze.length, brakOd: null })),
    });
  }
  for (const e of ciag.egzemplarze) {
    const blok = e.blok && wynik.get(e.blok);
    if (!blok) continue;
    blok.stron += 1;
    blok.powielen = Math.max(blok.powielen, e.nrEgz);
    e.dodatkowe.forEach((d, i) => {
      const b = blok.dodatkowe[i];
      b.potrzeba = Math.max(b.potrzeba, d.nrWiersza + 1);
      if (!d.wiersz && b.brakOd === null) b.brakOd = e.indeks + 1;
    });
  }
  return [...wynik.values()];
}

// Strony edytowane razem na jednym płótnie: [lewa, prawa] albo [strona].
// Parę tworzą dwie różne strony, których pierwsze egzemplarze leżą obok siebie
// w rozwiniętym ciągu. Jednostronicowa seria w rozkładówkach (egzemplarze na
// przemian lewe i prawe) jest edytowana sama.
export function arkuszStrony(strona, ciag) {
  const egz = ciag.pierwszy.get(strona.id);
  // Blok z pilnowaniem stron, którego początek jest pomijany: para taka jak w układzie stron.
  const para = ciag.paryWzoru?.get(strona.id);
  if (para) return egz.bok === 'lewa' ? [strona, para] : [para, strona];
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
  const zrodla = [...(glowna && egz.wiersz ? [{ tabela: glowna, wiersz: egz.wiersz, nrWiersza: egz.nrWiersza }] : []), ...egz.dodatkowe];
  const tabele = zrodla.map((z) => z.tabela);
  const wartosc = (nazwa, zapis) => {
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
  // Wygląd komórki przeniesiony z arkusza (pogrubienie, kursywa, kolor liter) jako formatowanie fragmentu tekstu
  // – tylko dla pól z tabel, które go mają i nie mają go wyłączonego.
  if (tabele.some((t) => t.wyglad && !t.wyglad_wyl)) {
    wartosc.wyglad = (nazwa) => {
      const pole = polePoTabelach(nazwa, tabele);
      if (!pole || !pole.tabela.wyglad || pole.tabela.wyglad_wyl) return null;
      const nr = zrodla.find((z) => z.tabela === pole.tabela).nrWiersza;
      const w = pole.tabela.wyglad[nr]?.[pole.tabela.kolumny.indexOf(pole.kolumna)];
      if (!w) return null;
      const naStyl = (x) => ({ ...(x.pogrubienie ? { fontWeight: 'bold' } : {}), ...(x.kursywa ? { fontStyle: 'italic' } : {}), ...(x.kolor ? { fill: x.kolor } : {}) });
      const wynik = { ...naStyl(w), ...(w.czesci?.length ? { czesci: w.czesci.map((c) => ({ od: c.od, do: c.do, styl: naStyl(c) })) } : {}) };
      return Object.keys(wynik).length ? wynik : null;
    };
  }
  return wartosc;
}
