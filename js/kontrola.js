// Kontrola danych przed drukiem i szablon danych serii (plan 5.1 i 5.2).
// Czyste funkcje: dostają projekt, niczego w nim nie zmieniają.

import { polaWObiektach, POLA_DOKUMENTU } from './pola.js';
import { wzorceStrony } from './projekt.js';
import { blokiSerii, tabelaSerii, tabeleSerii, tabeleDodatkowe, polePoTabelach, bilansSerii, rozwin, wartosciPol, kolumnyZmiany } from './serie.js';
import { odmiana } from './ui.js';

const DOKUMENTU = new Set(POLA_DOKUMENTU.map(([nazwa]) => nazwa));
const bezRozszerzenia = (n) => String(n || '').trim().toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '');

function obrazyZPol(obiekty, zbior = new Set()) {
  for (const o of obiekty || []) {
    if (o.type === 'image' && o.pole?.kolumna) zbior.add(o.pole.kolumna);
    if (Array.isArray(o.objects)) obrazyZPol(o.objects, zbior);
  }
  return zbior;
}

// Pola użyte na stronie i na jej wzorcach: { pola: Set, obrazy: Set }.
function polaStrony(projekt, strona, pamiec) {
  if (pamiec?.has(strona)) return pamiec.get(strona);
  const zrodla = [strona.obiekty, ...wzorceStrony(projekt, strona).map((w) => w.obiekty)];
  const wynik = { pola: new Set(), obrazy: new Set() };
  for (const obiekty of zrodla) { polaWObiektach(obiekty, wynik.pola); obrazyZPol(obiekty, wynik.obrazy); }
  pamiec?.set(strona, wynik);
  return wynik;
}

// Kolumny, których potrzebują strony serii: [{ nazwa, obraz, strony: [nazwy stron] }].
// Pola dokumentu ({nr}, {sekcja}…) nie są kolumnami, chyba że tabela już ma taką kolumnę.
// Pola brane z tabel dodatkowych serii należą do tamtych tabel – tu ich nie ma.
export function kolumnySerii(projekt, seria) {
  const tabela = tabelaSerii(projekt, seria);
  const dodatkowe = tabeleDodatkowe(projekt, seria).map((d) => d.tabela);
  const wynik = new Map();
  for (const blok of blokiSerii(projekt).filter((b) => b.seria.id === seria.id)) {
    for (const strona of blok.strony) {
      const { pola, obrazy } = polaStrony(projekt, strona);
      for (const nazwa of pola) {
        if (DOKUMENTU.has(nazwa) && !tabela?.kolumny.includes(nazwa)) continue;
        if (!tabela?.kolumny.includes(nazwa) && polePoTabelach(nazwa, [...(tabela ? [tabela] : []), ...dodatkowe])) continue;
        const wpis = wynik.get(nazwa) || { nazwa, obraz: false, strony: [] };
        wpis.obraz = wpis.obraz || obrazy.has(nazwa);
        if (!wpis.strony.includes(strona.nazwa)) wpis.strony.push(strona.nazwa);
        wynik.set(nazwa, wpis);
      }
    }
  }
  return [...wynik.values()];
}

export function brakujaceKolumny(projekt, seria) {
  const tabela = tabelaSerii(projekt, seria);
  return kolumnySerii(projekt, seria).map((k) => k.nazwa).filter((n) => !tabela?.kolumny.includes(n));
}

// Szablon danych serii: arkusz z kolumnami dokładnie takimi, jakich wymagają
// strony (istniejące dane zostają), i arkusz z objaśnieniem kolumn.
export function szablonSerii(projekt, seria) {
  const tabela = tabelaSerii(projekt, seria);
  const potrzebne = kolumnySerii(projekt, seria);
  const kolumny = [...(tabela?.kolumny.filter((k) => !/^kolumna_\d+$/.test(k) || tabela.wiersze.some((w) => w[tabela.kolumny.indexOf(k)] !== '')) || [])];
  for (const k of potrzebne) if (!kolumny.includes(k.nazwa)) kolumny.push(k.nazwa);
  if (!kolumny.length) kolumny.push('kolumna_1');
  const wiersze = (tabela?.wiersze || []).map((w) => kolumny.map((k) => { const i = tabela.kolumny.indexOf(k); return i < 0 ? '' : w[i]; }));
  const blok = blokiSerii(projekt).find((b) => b.seria.id === seria.id);
  const n = blok?.strony.length || 1;
  const coWiersz = seria.uklad === 'dlugi' && seria.tryb === 'tabela'
    ? `Jeden wiersz to jedna strona; blok serii ma ${n} ${odmiana(n, 'stronę', 'strony', 'stron')}.`
    : `Jeden wiersz to jedno powielenie bloku (${n} ${odmiana(n, 'strona', 'strony', 'stron')}).`;
  const instrukcja = [
    ['Seria', seria.nazwa],
    ['Jak wypełniać', `${coWiersz} Pierwszy wiersz arkusza to nazwy kolumn – nie zmieniaj ich. Gotowy plik zaimportuj w oknie „Dane”.`],
    [],
    ['Kolumna', 'Gdzie jest użyta', 'Co wpisać'],
    ...kolumny.map((k) => {
      const p = potrzebne.find((x) => x.nazwa === k);
      const uwagi = [
        !p ? 'Kolumna nie jest użyta na stronach serii.' : (p.obraz ? 'Nazwę pliku obrazu wgranego do projektu, np. zdjecie.jpg.' : `Tekst, który pojawi się w miejscu {${k}}.`),
        tabela?.unikalne?.includes(k) ? 'Wartości nie mogą się powtarzać.' : '',
      ].filter(Boolean).join(' ');
      return [k, p ? p.strony.join(', ') : '', uwagi];
    }),
  ];
  return { nazwa: tabela?.nazwa || seria.nazwa, kolumny, wiersze, instrukcja };
}

// Ta sama wartość mimo innej wielkości liter i zbędnych spacji: „Praca”, „praca ” i „PRACA”.
export const tasama = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl');

// Powtórzone wartości w kolumnie tabeli: [{ wartosc, wiersze: [numery od 0] }].
// Wielkość liter i zbędne spacje nie mają znaczenia; `wartosc` to pierwszy napotkany zapis.
export function powtorzenia(tabela, kolumna) {
  const k = tabela.kolumny.indexOf(kolumna);
  if (k < 0) return [];
  const gdzie = new Map();
  tabela.wiersze.forEach((w, i) => {
    const v = (w[k] ?? '').trim();
    if (!v) return;
    const wpis = gdzie.get(tasama(v)) || { wartosc: v, wiersze: [] };
    wpis.wiersze.push(i);
    gdzie.set(tasama(v), wpis);
  });
  return [...gdzie.values()].filter((p) => p.wiersze.length > 1);
}

// Kiedy tabela dodatkowa przechodzi do następnego wiersza – słowami, do komunikatów.
export const opisKroku = (d) => {
  const kolumny = kolumnyZmiany(d.zmiana);
  if (kolumny.length > 1) return `nowy wiersz, gdy zmieni się kolumna ${kolumny.map((x) => `„${x}”`).join(' albo ')}`;
  return kolumny.length
    ? `nowy wiersz, gdy zmieni się kolumna „${kolumny[0]}”`
    : `nowy wiersz co ${d.co} ${odmiana(d.co, 'stronę', 'strony', 'stron')}`;
};

const lista = (numery, ile = 6) => {
  const n = [...new Set(numery)].sort((a, b) => a - b);
  return n.length > ile ? `${n.slice(0, ile).join(', ')} i ${n.length - ile} ${odmiana(n.length - ile, 'innej', 'innych', 'innych')}` : n.join(', ').replace(/, (\d+)$/, ' i $1');
};

// Uwagi do całego projektu przed drukiem: [{ rodzaj, opis, strony: [numery w wydruku] }].
// Nie blokują eksportu – to lista rzeczy do sprawdzenia.
export function sprawdzProjekt(projekt, ciag = rozwin(projekt)) {
  const uwagi = [];
  const pamiec = new Map();
  const nieznane = new Map(); // pole → strony
  const brakObrazu = new Map(); // "kolumna\nplik" → strony
  const uzycia = new Map(); // tabela → kolumna → wartość → strony
  const nazwyZasobow = new Set(Object.values(projekt.zasoby || {}).map((z) => bezRozszerzenia(z.nazwa)));

  for (const egz of ciag.egzemplarze) {
    const { pola, obrazy } = polaStrony(projekt, egz.strona, pamiec);
    if (!pola.size) continue;
    const wartosc = wartosciPol(projekt, egz, ciag);
    const nr = egz.indeks + 1;
    const tabela = egz.seria ? tabelaSerii(projekt, egz.seria) : null;
    const tabele = egz.seria ? tabeleSerii(projekt, egz.seria) : [];
    for (const nazwa of pola) {
      const v = wartosc(nazwa, null);
      if (v === undefined) {
        // {poczatek:…}, {koniec:…}, {nr_strony:…} z nieznaną nazwą też dają „brak wartości”, ale to inna uwaga.
        if (!DOKUMENTU.has(nazwa)) nieznane.set(nazwa, [...(nieznane.get(nazwa) || []), nr]);
        continue;
      }
      if (obrazy.has(nazwa) && String(v).trim() && !nazwyZasobow.has(bezRozszerzenia(v))) {
        const klucz = `${nazwa}\n${v}`;
        brakObrazu.set(klucz, [...(brakObrazu.get(klucz) || []), nr]);
      }
      // Pilnowane kolumny: z której tabeli (głównej albo dodatkowej) i z którego wiersza przyszła wartość.
      const zrodlo = tabele.length ? polePoTabelach(nazwa, tabele) : null;
      if (zrodlo?.tabela.unikalne?.includes(zrodlo.kolumna) && String(v).trim()) {
        const nrWiersza = zrodlo.tabela === tabela ? egz.nrWiersza : egz.dodatkowe.find((d) => d.tabela === zrodlo.tabela)?.nrWiersza;
        const kolumny = uzycia.get(zrodlo.tabela) || new Map();
        const wartosci = kolumny.get(zrodlo.kolumna) || new Map();
        const stan = wartosci.get(tasama(v)) || { wartosc: String(v).trim(), strony: [], wiersze: new Set() };
        stan.strony.push(nr); stan.wiersze.add(nrWiersza);
        wartosci.set(tasama(v), stan); kolumny.set(zrodlo.kolumna, wartosci); uzycia.set(zrodlo.tabela, kolumny);
      }
    }
  }

  for (const [nazwa, strony] of nieznane) {
    uwagi.push({ rodzaj: 'nieznane_pole', strony, opis: `Pole {${nazwa}} nie ma skąd wziąć wartości (nie ma takiej kolumny ani pola dokumentu) – ${odmiana(new Set(strony).size, 'strona', 'strony', 'strony')} ${lista(strony)}.` });
  }
  for (const [klucz, strony] of brakObrazu) {
    const [kolumna, plik] = klucz.split('\n');
    uwagi.push({ rodzaj: 'brak_obrazu', strony, opis: `Nie ma w projekcie obrazu „${plik}” (kolumna „${kolumna}”) – ${odmiana(new Set(strony).size, 'strona', 'strony', 'strony')} ${lista(strony)}.` });
  }
  // Powtórzenia: na stronach, a gdy kolumna nie jest nigdzie użyta – w samej tabeli.
  for (const tabela of projekt.tabele) {
    for (const kolumna of tabela.unikalne || []) {
      const wartosci = uzycia.get(tabela)?.get(kolumna);
      if (wartosci) {
        for (const stan of wartosci.values()) {
          const { wartosc } = stan;
          // Powtórzenie to ta sama wartość w dwóch różnych wierszach. Jeden wiersz pokazany na
          // kilku stronach (np. tydzień na siedmiu stronach dni) powtórzeniem nie jest.
          const strony = [...new Set(stan.strony)];
          if (stan.wiersze.size > 1) uwagi.push({ rodzaj: 'powtorzenie', strony, opis: `Wartość „${wartosc}” z kolumny „${kolumna}” (tabela „${tabela.nazwa}”) powtarza się na stronach ${lista(strony)}.` });
        }
      } else {
        for (const p of powtorzenia(tabela, kolumna)) {
          uwagi.push({ rodzaj: 'powtorzenie', strony: [], opis: `Wartość „${p.wartosc}” w kolumnie „${kolumna}” (tabela „${tabela.nazwa}”) powtarza się w wierszach ${lista(p.wiersze.map((i) => i + 1))}.` });
        }
      }
    }
  }
  // Serie: brak danych w tabelach dodatkowych, ostatni blok dokańczany pustymi stronami, za mało wartości.
  for (const seria of projekt.serie) {
    const wierszy = tabelaSerii(projekt, seria)?.wiersze.length || 0;
    for (const blok of bilansSerii(projekt, seria, ciag)) {
      for (const d of blok.dodatkowe) {
        if (d.potrzeba > d.jest) {
          const ostatnia = ciag.egzemplarze.filter((e) => e.seria?.id === seria.id).at(-1).indeks + 1;
          uwagi.push({ rodzaj: 'brak_danych', strony: [d.brakOd], opis: `Seria „${seria.nazwa}”: tabela „${d.tabela.nazwa}” ma ${d.jest} ${odmiana(d.jest, 'wiersz', 'wiersze', 'wierszy')}, a potrzeba ${d.potrzeba} (${opisKroku(d)}). Od strony ${d.brakOd}${ostatnia > d.brakOd ? ` do ${ostatnia}` : ''} jej pola zostaną puste.` });
        }
      }
      if (seria.tryb === 'tabela' && seria.uklad === 'dlugi' && seria.dopelnij && wierszy % blok.dlugosc) {
        uwagi.push({ rodzaj: 'niepelny_blok', strony: [], opis: `Seria „${seria.nazwa}”: tabela ma ${wierszy} ${odmiana(wierszy, 'wiersz', 'wiersze', 'wierszy')}, a blok ${blok.dlugosc} ${odmiana(blok.dlugosc, 'stronę', 'strony', 'stron')} – ostatnie powielenie jest dokończone stronami bez danych.` });
      }
    }
    if (seria.tryb === 'stala' && wierszy && seria.ile > wierszy && (tabelaSerii(projekt, seria).unikalne || []).length) {
      uwagi.push({ rodzaj: 'za_malo_wartosci', strony: [], opis: `Seria „${seria.nazwa}” powiela się ${seria.ile} razy, a tabela ma ${wierszy} ${odmiana(wierszy, 'wiersz', 'wiersze', 'wierszy')} – wartości zaczną się powtarzać.` });
    }
  }
  return uwagi;
}
