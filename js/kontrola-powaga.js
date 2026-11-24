// Poważne uwagi przed drukiem (#420): to, co prawie na pewno zepsuje wydruk – zaznaczane na czerwono
// (lista „Sprawdź przed drukiem”, okno PDF, ostrzeżenia w edytorze i ramka na płótnie), a eksport PDF
// pyta przy nich o potwierdzenie. Pozostałe uwagi (pomarańczowe) bywają zamierzone – tylko do sprawdzenia.

export const PROG_DPI_POWAZNY = 150; // zdjęcie poniżej 150 dpi w druku – wyraźnie nieostre

const POWAZNE = new Set([
  'nie_miesci_sie', // tekst ucięty w ramce
  'tabela_poza_strona', // tabela po wypełnieniu wychodzi poza kartkę
  'brak_obrazu', // nazwa pliku z tabeli bez wgranego obrazu – na stronie znak „brak obrazu”
  'brak_czcionki', // czcionki nie ma – w PDF zastąpi ją inna
  'nieznane_pole', // pole bez wartości – na stronie zostaje puste miejsce albo nazwa pola
  'brak_danych', // tabeli zabrakło wierszy – dalsze strony bez danych
]);

// Uwaga z kontroli przed drukiem ({ rodzaj, dpi? }) albo ostrzeżenie edytora ({ typ }).
export const powazna = (u) => Boolean(u && (POWAZNE.has(u.rodzaj ?? u.typ) || ((u.rodzaj ?? u.typ) === 'obraz_dpi' && u.dpi < PROG_DPI_POWAZNY)));

// Najpierw poważne, potem reszta – w tej samej kolejności co wcześniej.
export const najpierwPowazne = (uwagi) => [...uwagi.filter(powazna), ...uwagi.filter((u) => !powazna(u))];
