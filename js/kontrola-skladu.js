// Kontrola przed drukiem, część wymagająca złożenia tekstu: czy tekst mieści się
// w ramce na każdej powielonej stronie. Ostrzeżenia w edytorze widzą tylko
// stronę-wzór; tutaj przechodzimy wszystkie egzemplarze z ich danymi.

import { rozwin } from './serie.js';
import { tekstyEgzemplarza, tabeleEgzemplarza } from './zlozenie.js';
import { nieMiesciSie } from './tekst-ramka.js';
import { sprawdzProjekt } from './kontrola.js';
import { odmiana } from './ui.js';

const lista = (numery, ile = 8) => {
  const n = [...new Set(numery)].sort((a, b) => a - b);
  return n.length > ile ? `${n.slice(0, ile).join(', ')} i ${n.length - ile} ${odmiana(n.length - ile, 'innej', 'innych', 'innych')}` : n.join(', ').replace(/, (\d+)$/, ' i $1');
};

// Uwagi o tekstach, które nie mieszczą się w ramce: [{ rodzaj: 'nie_miesci_sie', opis, strony, idStrony, idObiektu }],
// oraz o tabelach, które po wypełnieniu danymi wychodzą poza stronę (rodzaj 'tabela_poza_strona').
// przerwij() → true kończy sprawdzanie wcześniej (np. zamknięto okno).
export async function sprawdzMieszczenie(projekt, ciag = rozwin(projekt), { przerwij } = {}) {
  const wystapienia = new Map(); // id obiektu → { nazwa, strony, idStrony }
  const tabele = new Map(); // id tabeli → { nazwa, strony, idStrony, ile (największe wyjście poza stronę, mm) }
  let licznik = 0;
  for (const egz of ciag.egzemplarze) {
    if (przerwij?.()) return [];
    // Tabela rośnie razem z treścią komórek – na stronie z dłuższymi danymi może wyjść poza kartkę.
    const { szerokosc_mm: w, wysokosc_mm: h } = egz.sekcja.wydruk;
    for (const { obiekt, zrodlo, id } of await tabeleEgzemplarza(projekt, egz, ciag)) {
      obiekt.setCoords();
      const rogi = Object.values(obiekt.aCoords || {});
      if (!rogi.length) continue;
      const ile = Math.max(Math.max(...rogi.map((p) => p.y)) - h, Math.max(...rogi.map((p) => p.x)) - w, -Math.min(...rogi.map((p) => p.y)), -Math.min(...rogi.map((p) => p.x)));
      if (ile <= 0.1) continue;
      const wpis = tabele.get(id) || { nazwa: obiekt.nazwa || '', strony: [], idStrony: zrodlo === 'strona' ? egz.strona.id : null, zWzorca: zrodlo === 'wzorzec', ile: 0 };
      wpis.strony.push(egz.indeks + 1);
      wpis.ile = Math.max(wpis.ile, ile);
      tabele.set(id, wpis);
    }
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
  return [...[...wystapienia].map(([idObiektu, w]) => ({
    rodzaj: 'nie_miesci_sie', strony: w.strony, idStrony: w.idStrony, idObiektu,
    opis: `Tekst „${w.nazwa}”${w.zWzorca ? ' (ze wzorca)' : ''} nie mieści się w ramce – ${odmiana(new Set(w.strony).size, 'strona', 'strony', 'strony')} ${lista(w.strony)}.`,
  })), ...[...tabele].map(([idObiektu, t]) => ({
    rodzaj: 'tabela_poza_strona', strony: t.strony, idStrony: t.idStrony, idObiektu,
    opis: `Tabela${t.nazwa ? ` „${t.nazwa}”` : ''}${t.zWzorca ? ' (ze wzorca)' : ''} po wypełnieniu danymi wychodzi poza stronę (nawet o ${String(Math.round(t.ile * 10) / 10).replace('.', ',')} mm) – ${odmiana(new Set(t.strony).size, 'strona', 'strony', 'strony')} ${lista(t.strony)}.`,
  }))];
}

// Wszystkie uwagi do projektu: najpierw szybkie (dane), potem teksty w ramkach.
export async function sprawdzWszystko(projekt, ciag = rozwin(projekt), opcje = {}) {
  return [...sprawdzProjekt(projekt, ciag), ...await sprawdzMieszczenie(projekt, ciag, opcje)];
}
