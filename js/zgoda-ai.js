// Zatwierdzanie w czacie Makietki (#255, plan AI krok 3): zanim asystent usunie strony, kilka elementów, obrazy albo
// projekt, albo zmieni wiele stron naraz, Makietka pyta użytkownika. Tu tylko ocena wywołania – bez interfejsu.
// Zwraca opis do pytania („usunąć 3 strony”) albo null, gdy wywołanie nie wymaga zgody.
import { t } from './jezyk.js';

export const PROG_ELEMENTOW = 3; // tyle i więcej usuwanych elementów naraz wymaga zgody
export const PROG_STRON = 3; // tyle i więcej stron zmienianych jednym zapisem wymaga zgody


export function wymagaZgody(nazwa, argumenty = {}) {
  const a = argumenty && typeof argumenty === 'object' ? argumenty : {};
  const ile = (x) => (Array.isArray(x) ? x.length : 0);
  if (nazwa === 'usun_projekt') return t('zgodaAi.usunacCalyProjektNieodwracalnie', { x: a.potwierdz || a.projekt || '' });
  if (nazwa === 'cofnij_zmiany_ai' && !a.sprawdz) return t('zgodaAi.cofnacZmianyAi'); // plan H3 – cofa też późniejsze zmiany
  if (nazwa === 'udostepnij_link') return t('zgodaAi.udostepnicLink'); // plan H4 – publikacja treści
  if (nazwa === 'usun_czesc') return t('zgodaAi.usunacCzesc', { czesc: a.czesc || '', id: a.id || '' }); // podział zmien_czesc (23.11)
  if (nazwa === 'usun_z_tabeli') return t('zgodaAi.usunacZTabeli', { id: a.id || '' }); // podział zmien_tabele (23.11)
  if (nazwa === 'usun_strony') return t('kod.zgoda.usunacStrony', { n: ile(a.id) });
  if (nazwa === 'usun_elementy' && ile(a.id) >= PROG_ELEMENTOW) return t('kod.zgoda.usunacElementy', { n: ile(a.id) });
  if (nazwa === 'usun_obrazy') return a.nieuzywane ? t('usunąć wszystkie nieużywane obrazy projektu') : t('kod.zgoda.usunacObrazy', { n: ile(a.obrazy) });
  if (nazwa === 'zmien_projekt') {
    const z = a.zmiany && typeof a.zmiany === 'object' ? a.zmiany : {};
    if (ile(z.usun_strony)) return t('kod.zgoda.usunacStrony', { n: ile(z.usun_strony) });
    if (ile(z.strony) >= PROG_STRON) return t('kod.zgoda.zmienicStrony', { n: ile(z.strony) });
    const calosc = ['sekcje', 'wzorce', 'style', 'tabele', 'serie'].filter((k) => k in z);
    if (calosc.length) return t('zgodaAi.zastapicWCalosci', { join: calosc.join(', ') });
  }
  return null;
}
