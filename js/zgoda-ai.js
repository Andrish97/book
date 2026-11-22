// Zatwierdzanie w czacie Makietki (#255, plan AI krok 3): zanim asystent usunie strony, kilka elementów, obrazy albo
// projekt, albo zmieni wiele stron naraz, Makietka pyta użytkownika. Tu tylko ocena wywołania – bez interfejsu.
// Zwraca opis do pytania („usunąć 3 strony”) albo null, gdy wywołanie nie wymaga zgody.
import { t } from './jezyk.js';

export const PROG_ELEMENTOW = 3; // tyle i więcej usuwanych elementów naraz wymaga zgody
export const PROG_STRON = 3; // tyle i więcej stron zmienianych jednym zapisem wymaga zgody

const liczba = (n, jeden, kilka, wiele) => {
  if (n === 1) return `1 ${jeden}`;
  const d = n % 10;
  const s = n % 100;
  return `${n} ${d >= 2 && d <= 4 && (s < 12 || s > 14) ? kilka : wiele}`;
};

export function wymagaZgody(nazwa, argumenty = {}) {
  const a = argumenty && typeof argumenty === 'object' ? argumenty : {};
  const ile = (x) => (Array.isArray(x) ? x.length : 0);
  if (nazwa === 'usun_projekt') return t('zgodaAi.usunacCalyProjektNieodwracalnie', { x: a.potwierdz || a.projekt || '' });
  if (nazwa === 'cofnij_zmiany_ai' && !a.sprawdz) return t('zgodaAi.cofnacZmianyAi'); // plan H3 – cofa też późniejsze zmiany
  if (nazwa === 'usun_strony') return `usunąć ${liczba(ile(a.id), 'stronę', 'strony', 'stron')}`;
  if (nazwa === 'usun_elementy' && ile(a.id) >= PROG_ELEMENTOW) return `usunąć ${liczba(ile(a.id), 'element', 'elementy', 'elementów')}`;
  if (nazwa === 'usun_obrazy') return a.nieuzywane ? 'usunąć wszystkie nieużywane obrazy projektu' : t('zgodaAi.usunacZProjektu', { liczba: liczba(ile(a.obrazy), 'obraz', 'obrazy', 'obrazów') });
  if (nazwa === 'zmien_projekt') {
    const z = a.zmiany && typeof a.zmiany === 'object' ? a.zmiany : {};
    if (ile(z.usun_strony)) return `usunąć ${liczba(ile(z.usun_strony), 'stronę', 'strony', 'stron')}`;
    if (ile(z.strony) >= PROG_STRON) return t('zgodaAi.zmienicNaraz', { liczba: liczba(ile(z.strony), 'stronę', 'strony', 'stron') });
    const calosc = ['sekcje', 'wzorce', 'style', 'tabele', 'serie'].filter((k) => k in z);
    if (calosc.length) return t('zgodaAi.zastapicWCalosci', { join: calosc.join(', ') });
  }
  return null;
}
