// Elementy liczone z danych projektu (decyzja #131A): kalendarz miesiąca i wykres. Ich treść powstaje
// z ustawień elementu i z tabel danych – w edytorze przy wczytaniu strony, zmianie ustawień i zmianie
// danych, a przy składaniu stron (podgląd, miniatury, PDF) osobno dla każdej strony serii (miesiąc
// z kolumny, wykres z wiersza).

import { toKalendarz, ulozKalendarz, miesiacKalendarza, swietaZTabeli, miesiacZWartosci } from './kalendarz-miesiaca.js';
import { toWykres, ulozWykres, daneWykresu, utrwalSkaleWykresu } from './wykres.js';
import { toTabela, wysokosciWierszy } from './tabela-obiekt.js';

let licznik = 0;
const uidLokalny = (p) => `${p}${Date.now().toString(36)}d${(licznik += 1).toString(36)}`;

// Projekt dla edytora (edytor nie zna projektu – dostaje go aplikacja).
let projektEdytora = () => null;
export function ustawProjektDanych(fn) { projektEdytora = fn; }

// Wartości pól w edytorze: pierwszy wiersz tabeli, w której jest dana kolumna (podgląd jak na pierwszej
// stronie serii).
function wartosciPodgladu(projekt) {
  return (nazwa) => {
    for (const t of projekt?.tabele || []) {
      const k = t.kolumny.indexOf(nazwa);
      if (k >= 0) return t.wiersze[0]?.[k];
    }
    return undefined;
  };
}

export const maElementyDanych = (obiekty) => (obiekty || []).some((o) => toKalendarz(o) || toWykres(o) || (o.type === 'group' && !toTabela(o) && maElementyDanych(o.getObjects?.() || o.objects)));

// Układa kalendarze i wykresy wśród żywych obiektów (także w grupach).
// kontekst: { projekt, wartosc (pola strony) }; bez kontekstu – projekt edytora i podgląd z pierwszego wiersza.
export function ulozElementyDanych(obiekty, kontekst = null) {
  const projekt = kontekst?.projekt || projektEdytora();
  const wartosc = kontekst?.wartosc || wartosciPodgladu(projekt);
  const uid = kontekst?.uid || uidLokalny;
  for (const o of obiekty || []) {
    if (toKalendarz(o)) {
      const { rok, miesiac } = miesiacKalendarza(o.kalendarz, wartosc);
      const swieta = o.kalendarz.swieta_z ? swietaZTabeli(projekt, o.kalendarz.swieta_z) : new Map();
      ulozKalendarz(o, uid, { rok, miesiac, swieta });
    } else if (toWykres(o)) {
      ulozWykres(o, daneWykresu(projekt, o.wykres, kontekst?.wartosc || null));
    } else if (o.type === 'group' && !toTabela(o)) {
      ulozElementyDanych(o.getObjects(), kontekst);
    }
  }
}

// Jeden element (po zmianie ustawień w panelu).
export function ulozElementDanych(o, kontekst = null) { ulozElementyDanych([o], kontekst); }

// Po skalowaniu uchwytem. Kalendarz: tabela zmieniła wysokości wierszy – nowa wysokość wiersza dnia.
export function poSkalowaniuElementuDanych(o) {
  if (toKalendarz(o)) {
    const wys = wysokosciWierszy(o);
    if (wys.length) o.kalendarz = { ...o.kalendarz, wiersz_dnia: Math.round(wys.at(-1) * 10) / 10 };
    ulozElementDanych(o);
    return true;
  }
  if (toWykres(o)) {
    const projekt = projektEdytora();
    return utrwalSkaleWykresu(o, daneWykresu(projekt, o.wykres, null));
  }
  return false;
}

export { toKalendarz, toWykres, miesiacZWartosci };
