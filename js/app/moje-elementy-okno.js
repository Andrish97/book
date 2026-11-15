// „Moje elementy” w aplikacji (#131C): „Zapisz w bibliotece” dla zaznaczenia, zmiana nazwy i usuwanie
// z Biblioteki. Dane i zapis na koncie – js/moje-elementy.js, kategoria Biblioteki – js/biblioteka-elementy.js.

import { powiadom, zapytajONazwe, potwierdz } from '../ui.js';
import { MOJE } from '../biblioteka-elementy.js';
import { naZmianeMoichElementow, zapiszMojElement, zmienNazweMojegoElementu, usunMojElement } from '../moje-elementy.js';
import { opisObiektu } from '../edytor.js';
import * as chmura from '../chmura.js';
import { edytor, stan } from './kontekst.js';
import { odswiezBiblioteke, otworzBiblioteke } from './biblioteka-okno.js';

naZmianeMoichElementow((lista) => { MOJE.lista = lista; odswiezBiblioteke(); });

MOJE.zmienNazwe = async (m) => {
  const nazwa = await zapytajONazwe('Zmień nazwę elementu', 'Nazwa', m.nazwa);
  if (!nazwa || nazwa === m.nazwa) return;
  try { await zmienNazweMojegoElementu(m.id, nazwa); } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
};

MOJE.usun = async (m) => {
  if (!await potwierdz('Usunąć z biblioteki?', `„${m.nazwa}” zniknie z „Moich elementów” we wszystkich projektach. Elementy już wstawione na strony zostają.`, 'Usuń', true)) return;
  try { await usunMojElement(m.id); } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
};

// Zaznaczenie → nowy element w „Moich elementach” (z obrazami), na koncie.
export async function zapiszWBibliotece() {
  const akt = edytor.aktywny;
  if (!akt) { powiadom('Zaznacz element albo kilka – trafią do Biblioteki razem.', true); return; }
  if (!stan.uzytkownik) { powiadom('Moje elementy są na koncie – zaloguj się.', true); return; }
  const dane = await edytor.elementDoBiblioteki();
  if (!dane) { powiadom('Tego elementu nie da się zapisać (element wzorca albo pisany tekst).', true); return; }
  const domyslna = akt.type === 'activeselection' || akt.type === 'activeSelection' ? `${akt.getObjects().length} elementy` : opisObiektu(akt);
  const nazwa = await zapytajONazwe('Zapisz w bibliotece', 'Nazwa w „Moich elementach”', domyslna);
  if (!nazwa) return;
  try {
    await zapiszMojElement({ nazwa, obiekty: dane.obiekty, szer: dane.szer, wys: dane.wys, podglad: dane.podglad }, stan.projekt);
    powiadom(`„${nazwa}” jest w Bibliotece → Moje elementy – w każdym projekcie.`);
    otworzBiblioteke('moje');
  } catch (e) {
    powiadom(`Nie udało się zapisać: ${chmura.komunikatBledu(e)}`, true);
  }
}
