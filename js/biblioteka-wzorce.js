// Biblioteka – kategoria „Wzorce stron” (#164): te same gotowe wzorce co w oknie „Wzorce stron”
// (js/wzorce-standardowe.js), z podglądem schematycznym. Kliknięcie dodaje wzorzec do projektu i od razu
// na strony bieżącej sekcji – tą samą funkcją co okno (js/app/wzorce.js), bez osobnej logiki.

import { zarejestrujKategorie } from './biblioteka.js';
import { WZORCE_STANDARDOWE, podgladSvgWzorca, markaDoWzorcow } from './wzorce-standardowe.js';

const pamiec = new Map();
const podglad = (def) => {
  const marka = markaDoWzorcow(globalThis.makietkaMarka || null);
  const klucz = `${def.klucz}|${marka.akcent}|${marka.akcent2}`;
  if (!pamiec.has(klucz)) pamiec.set(klucz, podgladSvgWzorca(def, undefined, marka));
  return pamiec.get(klucz);
};

zarejestrujKategorie({
  id: 'wzorce-stron', nazwa: 'Wzorce stron', ikona: 'wzorzec', kolejnosc: 38,
  opis: 'To, co powtarza się na wielu stronach: numer, nagłówek, stopka, tło, ramka',
  elementy: () => WZORCE_STANDARDOWE.map((def) => ({
    id: def.klucz,
    nazwa: def.nazwa,
    grupa: def.grupa,
    slowa: `wzorzec wzorce strony powtarzane ${def.slowa || ''}`,
    opis: def.opis,
    duzy: true,
    podglad: podglad(def),
    wstaw: async () => { (await import('./app/wzorce.js')).dodajWzorzecStandardowy(def.klucz); return null; },
  })),
});
