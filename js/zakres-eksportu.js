// Wybór zakresu w oknach eksportu PDF i druku (zgłoszenie 19.11: „zapis bardziej zaawansowany – wybrane sekcje,
// a nie sekcja, i strony nie tylko od–do, ale jak w Wordzie 1-5, 8”).
import { parsujZakresStron } from './eksport.js';

// Lista sekcji z polami do zaznaczenia: „Nazwa (N str.)” – liczba egzemplarzy sekcji w wydruku (z powieleniami).
export function wypelnijSekcje(kontener, projekt, ciag, zaznaczone = []) {
  const ile = new Map();
  for (const e of ciag.egzemplarze) ile.set(e.sekcja.id, (ile.get(e.sekcja.id) || 0) + 1);
  const wybrane = new Set(zaznaczone);
  kontener.replaceChildren(...projekt.sekcje.filter((s) => ile.get(s.id)).map((s) => {
    const l = document.createElement('label');
    l.className = 'przelacznik';
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.name = 'sekcje_eksportu';
    i.value = s.id;
    i.checked = wybrane.has(s.id);
    const t = document.createElement('span');
    t.textContent = `${s.nazwa} (${ile.get(s.id)} str.)`;
    l.append(i, t);
    return l;
  }));
}

export const wybraneSekcje = (kontener) => [...kontener.querySelectorAll('input[name="sekcje_eksportu"]:checked')].map((i) => i.value);

// Kłopot z wpisanym zakresem stron (null – w porządku): kawałki nie do odczytania i numery poza projektem.
export function uwagaZakresu(tekst, n) {
  if (!String(tekst || '').trim()) return 'Wpisz numery stron, np. 1-5, 8.';
  const { bledy, poza, numery } = parsujZakresStron(tekst, n);
  if (bledy.length) return `Nie rozumiem: ${bledy.map((b) => `„${b}”`).join(', ')} – wpisz numery i przedziały po przecinku, np. 1-5, 8, 11-.`;
  if (poza.length) return `Projekt ma ${n} ${n === 1 ? 'stronę' : 'stron'} – ${poza.length === 1 ? `numer ${poza[0]} pominięty` : 'numery ponad tę liczbę pominięte'}.${numery.length ? '' : ' W zakresie nie ma stron.'}`;
  return null;
}
