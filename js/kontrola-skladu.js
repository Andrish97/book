// Kontrola przed drukiem, część wymagająca złożenia tekstu: czy tekst mieści się
// w ramce na każdej powielonej stronie. Ostrzeżenia w edytorze widzą tylko
// stronę-wzór; tutaj przechodzimy wszystkie egzemplarze z ich danymi.

import { rozwin } from './serie.js';
import { tekstyEgzemplarza } from './zlozenie.js';
import { nieMiesciSie } from './tekst-ramka.js';
import { sprawdzProjekt } from './kontrola.js';
import { odmiana } from './ui.js';

const lista = (numery, ile = 8) => {
  const n = [...new Set(numery)].sort((a, b) => a - b);
  return n.length > ile ? `${n.slice(0, ile).join(', ')} i ${n.length - ile} ${odmiana(n.length - ile, 'innej', 'innych', 'innych')}` : n.join(', ').replace(/, (\d+)$/, ' i $1');
};

// Uwagi o tekstach, które nie mieszczą się w ramce: [{ rodzaj: 'nie_miesci_sie', opis, strony, idStrony, idObiektu }].
// przerwij() → true kończy sprawdzanie wcześniej (np. zamknięto okno).
export async function sprawdzMieszczenie(projekt, ciag = rozwin(projekt), { przerwij } = {}) {
  const wystapienia = new Map(); // id obiektu → { nazwa, strony, idStrony }
  let licznik = 0;
  for (const egz of ciag.egzemplarze) {
    if (przerwij?.()) return [];
    for (const { obiekt, zrodlo, id } of await tekstyEgzemplarza(projekt, egz, ciag)) {
      if (!nieMiesciSie(obiekt)) continue;
      const tresc = (obiekt.nazwa || obiekt.text || '').replace(/\s+/g, ' ').trim();
      const wpis = wystapienia.get(id) || { nazwa: tresc.length > 30 ? `${tresc.slice(0, 30)}…` : tresc, strony: [], idStrony: zrodlo === 'strona' ? egz.strona.id : null, zWzorca: zrodlo === 'wzorzec' };
      wpis.strony.push(egz.indeks + 1);
      wystapienia.set(id, wpis);
    }
    licznik += 1;
    if (licznik % 25 === 0) await new Promise((ok) => setTimeout(ok)); // oddaj głos przeglądarce
  }
  return [...wystapienia].map(([idObiektu, w]) => ({
    rodzaj: 'nie_miesci_sie', strony: w.strony, idStrony: w.idStrony, idObiektu,
    opis: `Tekst „${w.nazwa}”${w.zWzorca ? ' (ze wzorca)' : ''} nie mieści się w ramce – ${odmiana(new Set(w.strony).size, 'strona', 'strony', 'strony')} ${lista(w.strony)}.`,
  }));
}

// Wszystkie uwagi do projektu: najpierw szybkie (dane), potem teksty w ramkach.
export async function sprawdzWszystko(projekt, ciag = rozwin(projekt), opcje = {}) {
  return [...sprawdzProjekt(projekt, ciag), ...await sprawdzMieszczenie(projekt, ciag, opcje)];
}
