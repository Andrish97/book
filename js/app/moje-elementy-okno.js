// „Moje elementy” w aplikacji (#131C): „Zapisz w bibliotece” dla zaznaczenia, zmiana nazwy i usuwanie
// z Biblioteki. Dane i zapis na koncie – js/moje-elementy.js, kategoria Biblioteki – js/biblioteka-elementy.js.

import { powiadom, zapytajONazwe, potwierdz } from '../ui.js';
import { MOJE } from '../biblioteka-elementy.js';
import { naZmianeMoichElementow, zapiszMojElement, zmienNazweMojegoElementu, usunMojElement } from '../moje-elementy.js';
import { opisObiektu } from '../edytor.js';
import * as chmura from '../chmura.js';
import { edytor, stan } from './kontekst.js';
import { odswiezBiblioteke, otworzBiblioteke } from './biblioteka-okno.js';
import { t } from '../jezyk.js';

naZmianeMoichElementow((lista) => { MOJE.lista = lista; odswiezBiblioteke(); });

MOJE.zmienNazwe = async (m) => {
  const nazwa = await zapytajONazwe(t('mojeElementyOkno.zmienNazweElementu'), t('mojeElementyOkno.nazwa'), m.nazwa);
  if (!nazwa || nazwa === m.nazwa) return;
  try { await zmienNazweMojegoElementu(m.id, nazwa); } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
};

MOJE.usun = async (m) => {
  if (!await potwierdz(t('mojeElementyOkno.usunacZBiblioteki'), `„${m.nazwa}” zniknie z „Moich elementów” we wszystkich projektach. Elementy już wstawione na strony zostają.`, t('mojeElementyOkno.usun'), true)) return;
  try { await usunMojElement(m.id); } catch (e) { powiadom(chmura.komunikatBledu(e), true); }
};

// Zaznaczenie → nowy element w „Moich elementach” (z obrazami), na koncie.
export async function zapiszWBibliotece() {
  const akt = edytor.aktywny;
  if (!akt) { powiadom(t('mojeElementyOkno.zaznaczElementAlboKilka'), true); return; }
  if (!stan.uzytkownik) { powiadom(t('mojeElementyOkno.mojeElementySaNa'), true); return; }
  const dane = await edytor.elementDoBiblioteki();
  if (!dane) { powiadom(t('mojeElementyOkno.tegoElementuNieDa'), true); return; }
  const domyslna = akt.type === 'activeselection' || akt.type === 'activeSelection' ? `${akt.getObjects().length} elementy` : opisObiektu(akt);
  const nazwa = await zapytajONazwe(t('mojeElementyOkno.zapiszWBibliotece'), t('mojeElementyOkno.nazwaWMoichElementach'), domyslna);
  if (!nazwa) return;
  try {
    await zapiszMojElement({ nazwa, obiekty: dane.obiekty, szer: dane.szer, wys: dane.wys, podglad: dane.podglad }, stan.projekt);
    powiadom(`„${nazwa}” jest w Bibliotece → Moje elementy – w każdym projekcie.`);
    otworzBiblioteke('moje');
  } catch (e) {
    powiadom(`Nie udało się zapisać: ${chmura.komunikatBledu(e)}`, true);
  }
}
