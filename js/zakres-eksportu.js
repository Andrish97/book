// Wybór zakresu w oknach eksportu PDF i druku (zgłoszenie 19.11: „zapis bardziej zaawansowany – wybrane sekcje,
// a nie sekcja, i strony nie tylko od–do, ale jak w Wordzie 1-5, 8”).
import { parsujZakresStron } from './eksport.js';
import { t as tt } from './jezyk.js';

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
    t.textContent = tt('zakresEksportu.str', { nazwa: s.nazwa, get: ile.get(s.id) });
    l.append(i, t);
    return l;
  }));
}

export const wybraneSekcje = (kontener) => [...kontener.querySelectorAll('input[name="sekcje_eksportu"]:checked')].map((i) => i.value);

// Kłopot z wpisanym zakresem stron (null – w porządku): kawałki nie do odczytania i numery poza projektem.
export function uwagaZakresu(tekst, n) {
  if (!String(tekst || '').trim()) return 'Wpisz numery stron, np. 1-5, 8.';
  const { bledy, poza, numery } = parsujZakresStron(tekst, n);
  if (bledy.length) return tt('zakresEksportu.nieRozumiemWpiszNumery', { join: bledy.map((b) => `„${b}”`).join(', ') });
  if (poza.length) return tt('zakresEksportu.projektMa', { n, x: n === 1 ? tt('zakresEksportu.strone') : tt('zakresEksportu.stron'), x2: poza.length === 1 ? tt('zakresEksportu.numerPominiety', { x: poza[0] }) : tt('zakresEksportu.numeryPonadTeLiczbe'), x3: numery.length ? '' : tt('zakresEksportu.wZakresieNieMa') });
  return null;
}
