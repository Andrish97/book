// Schowek między projektami w aplikacji (#210): Kopiuj zaznaczonych elementów zapisuje je też do schowka
// urządzenia; Ctrl+V w innym projekcie wkleja je razem z obrazami. Strony i sekcje – z menu strony i sekcji
// („Kopiuj do schowka”, „Wklej … ze schowka”). Sam schowek – js/schowek-projektow.js.

import { powiadom } from '../ui.js';
import { opisObiektu } from '../edytor.js';
import { przeliczOkladki } from '../okladka.js';
import {
  metaSchowka, zapiszDoSchowka, wezZeSchowka, przyjmijZasoby, przemapujZasoby, wklejStrony, wklejSekcje,
} from '../schowek-projektow.js';
import { stan, edytor } from './kontekst.js';
import { zapiszBiezacyCel, zaladujCel, zaplanujZapis } from './zapis.js';
import { generujMiniatury, renderujListe, ustawZakladke } from './lista-stron.js';
import { t } from '../jezyk.js';

const skad = (wpis) => (stan.projekt && wpis.projekt !== stan.projekt.id ? t('schowekOkno.zProjektu', { nazwaProjektu: wpis.nazwaProjektu }) : '');

// Kopiuj (Ctrl+C, Wytnij, przycisk) → także schowek urządzenia. Zaznaczenie czytane od razu (Wytnij zaraz je usuwa).
edytor.addEventListener('schowek', () => {
  const projekt = stan.projekt;
  const akt = edytor.aktywny;
  if (!projekt || !edytor.maSchowek || !akt) return;
  const opis = akt.type === 'activeselection' || akt.type === 'activeSelection' ? `${akt.getObjects().length} elementy` : opisObiektu(akt);
  edytor.elementDoBiblioteki()
    .then((dane) => dane && zapiszDoSchowka(projekt, { rodzaj: 'elementy', opis, dane: { obiekty: dane.obiekty, szer: dane.szer, wys: dane.wys } }))
    .catch(() => {});
});

// Czy Ctrl+V / „Wklej” ma co wkleić: elementy skopiowane w tym projekcie albo w innym (schowek urządzenia).
export const maElementyDoWklejenia = () => edytor.maSchowek || metaSchowka()?.rodzaj === 'elementy';

// Wklej elementy: z innego projektu (albo po przeładowaniu) – ze schowka urządzenia z obrazami; inaczej – jak dotąd.
export async function wklejElementy() {
  const meta = metaSchowka();
  const zInnego = meta?.rodzaj === 'elementy' && meta.projekt !== stan.projekt?.id;
  if (edytor.maSchowek && !zInnego) { edytor.wklej(); return true; }
  const wpis = await wezZeSchowka();
  if (!wpis || wpis.rodzaj !== 'elementy' || !stan.projekt) { if (edytor.maSchowek) edytor.wklej(); return Boolean(edytor.maSchowek); }
  const mapa = await przyjmijZasoby(stan.projekt, wpis);
  await edytor.wstawElementZBiblioteki({ ...wpis.dane, obiekty: przemapujZasoby(wpis.dane.obiekty, mapa) }, stan.projekt.zasoby);
  if (zInnego) powiadom(t('schowekOkno.wklejono', { opis: wpis.opis, skad: skad(wpis) }));
  return true;
}

// ---------- Strony i sekcje ----------

export async function kopiujStroneDoSchowka(i) {
  zapiszBiezacyCel();
  const s = stan.projekt.strony[i];
  await zapiszDoSchowka(stan.projekt, { rodzaj: 'strony', opis: t('schowekOkno.strona', { nazwa: s.nazwa }), dane: { strony: [s] } });
  powiadom(t('schowekOkno.stronaJestWSchowku', { nazwa: s.nazwa }));
}

export async function kopiujSekcjeDoSchowka(id) {
  zapiszBiezacyCel();
  const sekcja = stan.projekt.sekcje.find((s) => s.id === id);
  const strony = stan.projekt.strony.filter((s) => s.sekcja === id);
  await zapiszDoSchowka(stan.projekt, { rodzaj: 'sekcja', opis: t('schowekOkno.sekcjaStr', { nazwa: sekcja.nazwa, stronyIle: strony.length }), dane: { sekcja, strony } });
  powiadom(t('schowekOkno.sekcjaJestWSchowku', { nazwa: sekcja.nazwa }));
}

// Opis do menu: co leży w schowku (strony albo sekcja), skąd. null – nic do wklejenia tym poleceniem.
export function opisSchowka(rodzaje) {
  const m = metaSchowka();
  if (!m || !rodzaje.includes(m.rodzaj)) return null;
  return `${m.opis}${stan.projekt && m.projekt !== stan.projekt.id ? ` z „${m.nazwaProjektu}”` : ''}`;
}

async function poWklejeniu(pierwsza, komunikat) {
  przeliczOkladki(stan.projekt);
  stan.miniatury.clear();
  stan.tryb = 'strona';
  stan.indeks = Math.max(0, stan.projekt.strony.indexOf(pierwsza));
  ustawZakladke('strony');
  await zaladujCel({ dopasuj: true });
  renderujListe();
  generujMiniatury();
  zaplanujZapis();
  powiadom(komunikat);
}

// Strony ze schowka (strona albo strony skopiowanej sekcji) za stroną i – w jej sekcji.
export async function wklejStronyZeSchowka(i) {
  const wpis = await wezZeSchowka();
  if (!wpis || !['strony', 'sekcja'].includes(wpis.rodzaj)) { powiadom(t('schowekOkno.wSchowkuNieMa2'), true); return; }
  zapiszBiezacyCel();
  const nowe = await wklejStrony(stan.projekt, wpis, i);
  await poWklejeniu(nowe[0], `Wklejono ${nowe.length === 1 ? `stronę „${nowe[0].nazwa}”` : `${nowe.length} stron`}${skad(wpis)}.`);
}

// Sekcja ze schowka za sekcją id (okładka – na początek; drugiej okładki nie dokładamy).
export async function wklejSekcjeZeSchowka(id) {
  const wpis = await wezZeSchowka();
  if (!wpis || wpis.rodzaj !== 'sekcja') { powiadom(t('schowekOkno.wSchowkuNieMa'), true); return; }
  if (wpis.dane.sekcja.okladka && stan.projekt.sekcje.some((s) => s.okladka)) {
    powiadom(t('schowekOkno.tenProjektMaJuz'), true);
    return;
  }
  zapiszBiezacyCel();
  const { sekcja, strony } = await wklejSekcje(stan.projekt, wpis, id);
  await poWklejeniu(strony[0], t('kod.schowek.wklejonoSekcje', { nazwa: sekcja.nazwa, skad: skad(wpis) }));
}
