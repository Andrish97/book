// Biblioteka (#166, #140 – jedno miejsce gotowych rzeczy): kategoria „Gotowe sekcje” – kafelek na każdy szablon
// dokumentu. Kliknięcie otwiera okno gotowych sekcji na tym szablonie (podgląd w formacie projektu, kolory,
// pytania) – samo wstawienie robi okno, nie Biblioteka.

import { zarejestrujKategorie } from './biblioteka.js';
import { SZABLONY_SEKCJI, KATEGORIE_SEKCJI, svgSchematu } from './gotowe-sekcje.js';

zarejestrujKategorie({
  id: 'gotowe-sekcje', nazwa: 'Gotowe sekcje', ikona: 'strony', kolejnosc: 8,
  elementy: () => SZABLONY_SEKCJI.map((s) => ({
    id: s.id, nazwa: s.nazwa, slowa: `${s.slowa} szablon dokument sekcja gotowy`, duzy: true, opis: s.opis,
    grupa: KATEGORIE_SEKCJI.find((k) => k.id === s.kategoria)?.nazwa,
    podglad: svgSchematu(s),
    wstaw: async () => {
      document.querySelector('#dlg-biblioteka')?.close();
      (await import('./app/gotowe-sekcje-okno.js')).otworzGotoweSekcje({ szablon: s.id });
      return null;
    },
  })),
});
