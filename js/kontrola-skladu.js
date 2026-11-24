// Kontrola przed drukiem, część wymagająca złożenia tekstu: czy tekst mieści się
// w ramce na każdej powielonej stronie. Ostrzeżenia w edytorze widzą tylko
// stronę-wzór; tutaj przechodzimy wszystkie egzemplarze z ich danymi.

import { rozwin } from './serie.js';
import { tekstyEgzemplarza, tabeleEgzemplarza } from './zlozenie.js';
import { nieMiesciSie } from './tekst-ramka.js';
import { uwagiSkladuTekstu } from './zasady-skladu.js';
import { sprawdzProjekt } from './kontrola.js';
import { t as tt } from './jezyk.js';
import { polozenieTekstu, KLUCZ_POLOZENIA, BEZPIECZNA_MM, zwyklaSekcja, listaStron } from './kontrola-elementow.js';
import { marginesyStrony } from './projekt.js';

// Ramka rosnąca z tekstem (#431): położenie liczone z wysokości złożonego tekstu, a nie zapisanej w projekcie –
// tekst, który urósł w margines albo poza stronę, był widoczny w edytorze (pomarańczowa ramka), a w „Sprawdź przed
// drukiem” nie. Uwaga tylko wtedy, gdy zapisana wysokość jej nie daje (tamtą zgłasza już kontrola elementów).
function polozenieZlozonego(obiekt, zapisany, wymiary) {
  if (!zapisany || obiekt.visible === false || obiekt.bez_ostrzezen || obiekt.ramka_h > 0 || obiekt.watek || (obiekt.angle || 0) % 360 || obiekt.kadr || obiekt.kadr_nr != null) return null;
  if (!String(obiekt.text || '').trim()) return null;
  const w = (obiekt.width || 0) * (obiekt.scaleX || 1);
  const pudlo = (h) => {
    const x1 = obiekt.originX === 'center' ? obiekt.left - w / 2 : obiekt.left;
    const y1 = obiekt.originY === 'center' ? obiekt.top - h / 2 : obiekt.top;
    return { x1, y1, x2: x1 + w, y2: y1 + h };
  };
  const hZ = (obiekt.height || 0) * (obiekt.scaleY || 1);
  const hZap = (zapisany.height || 0) * (zapisany.scaleY || 1);
  if (!(w > 0) || !(hZ > hZap + 0.05)) return null;
  const teraz = polozenieTekstu(pudlo(hZ), wymiary);
  return teraz && teraz !== polozenieTekstu(pudlo(hZap), wymiary) ? teraz : null;
}

const lista = (numery, ile = 8) => {
  const n = [...new Set(numery)].sort((a, b) => a - b);
  return n.length > ile ? tt('kontrolaSkladu.i', { join: n.slice(0, ile).join(', '), x: n.length - ile }) : n.join(', ').replace(/, (\d+)$/, ' i $1');
};

// Uwagi o tekstach, które nie mieszczą się w ramce: [{ rodzaj: 'nie_miesci_sie', opis, strony, idStrony, idObiektu }],
// oraz o tabelach, które po wypełnieniu danymi wychodzą poza stronę (rodzaj 'tabela_poza_strona').
// przerwij() → true kończy sprawdzanie wcześniej (np. zamknięto okno).
export async function sprawdzMieszczenie(projekt, ciag = rozwin(projekt), { przerwij } = {}) {
  const wystapienia = new Map(); // id obiektu → { nazwa, strony, idStrony }
  const sklad = new Map(); // id obiektu → { nazwa, strony, idStrony, powody: Map(opis → przykład) } (#323)
  const tabele = new Map(); // id tabeli → { nazwa, strony, idStrony, ile (największe wyjście poza stronę, mm) }
  const polozenie = new Map(); // rodzaj|id → { rodzaj, nazwa, strony, idStrony, idObiektu, wzorzec } (#431)
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
    // Wszystkie ramki tekstu (#413): polskie zasady składu dotyczą też ramek rosnących z tekstem – wcześniej
    // sprawdzane były tylko ramki o stałej wysokości, więc uwagi z edytora nie trafiały do „Sprawdź przed drukiem”.
    const wymiary = { W: w, H: h, spad: egz.sekcja.wydruk.spad_mm || 0, marginesy: zwyklaSekcja(egz.sekcja) ? [marginesyStrony(projekt, egz.strona, egz.bok)] : [] };
    for (const { obiekt, zrodlo, id, zapisany } of await tekstyEgzemplarza(projekt, egz, ciag, { wszystkie: true })) {
      const gdzie = polozenieZlozonego(obiekt, zapisany, wymiary);
      if (gdzie) {
        const k = `${gdzie}|${id}`;
        const tresc1 = (obiekt.nazwa || obiekt.text || '').replace(/\s+/g, ' ').trim();
        const p = polozenie.get(k) || { rodzaj: gdzie, nazwa: tresc1.length > 30 ? `${tresc1.slice(0, 30)}…` : tresc1, strony: [], idStrony: zrodlo === 'strona' ? egz.strona.id : null, idObiektu: id, zWzorca: zrodlo === 'wzorzec' };
        if (!p.strony.includes(egz.indeks + 1)) p.strony.push(egz.indeks + 1);
        polozenie.set(k, p);
      }
      const uw = uwagiSkladuTekstu(obiekt);
      if (uw.length) {
        const tresc0 = (obiekt.nazwa || obiekt.text || '').replace(/\s+/g, ' ').trim();
        const s = sklad.get(id) || { nazwa: tresc0.length > 30 ? `${tresc0.slice(0, 30)}…` : tresc0, strony: [], idStrony: zrodlo === 'strona' ? egz.strona.id : null, zWzorca: zrodlo === 'wzorzec', powody: new Map() };
        s.strony.push(egz.indeks + 1);
        for (const u of uw) if (!s.powody.has(u.opis)) s.powody.set(u.opis, u.przyklad || '');
        if (uw.some((u) => u.kod !== 'lamanie')) s.znaki = true; // znaki w samym tekście (wartości z tabel poprawiają się same, #424)
        sklad.set(id, s);
      }
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
    opis: tt('kontrolaSkladu.tekstNieMiesciSie', { nazwa: w.nazwa, x: w.zWzorca ? tt('kontrolaSkladu.zeWzorca') : '', size: new Set(w.strony).size, lista: lista(w.strony) }),
  })), ...[...tabele].map(([idObiektu, t]) => ({
    rodzaj: 'tabela_poza_strona', strony: t.strony, idStrony: t.idStrony, idObiektu,
    opis: tt('kontrolaSkladu.tabelaPoWypelnieniuDanymi', { x: t.nazwa ? ` „${t.nazwa}”` : '', x2: t.zWzorca ? tt('kontrolaSkladu.zeWzorca') : '', replace: String(Math.round(t.ile * 10) / 10).replace('.', ','), size: new Set(t.strony).size, lista: lista(t.strony) }),
  })), ...[...polozenie.values()].map(({ rodzaj, nazwa, strony, idStrony, idObiektu, zWzorca }) => ({
    rodzaj, strony, idStrony, idObiektu,
    opis: tt(KLUCZ_POLOZENIA[rodzaj], { nazwa, mm: BEZPIECZNA_MM, gdzie: `${zWzorca ? `${tt('kontrolaSkladu.zeWzorca').trim()}, ` : ''}${tt('kontrolaElementow.naStronach', { lista: listaStron(strony) })}` }),
  })), ...[...sklad].map(([idObiektu, s]) => ({
    rodzaj: 'sklad_pl', strony: s.strony, idStrony: s.idStrony, idObiektu, ...(s.znaki ? { naprawa: 'znaki' } : {}),
    opis: tt('kontrolaSkladu.tekstSkladNiezgodnyZ', { nazwa: s.nazwa, x: s.zWzorca ? tt('kontrolaSkladu.zeWzorca') : '', join: [...s.powody].map(([o, p]) => (p ? `${o} („${p}”)` : o)).join('; '), size: new Set(s.strony).size, lista: lista(s.strony) }),
  }))];
}

// Wszystkie uwagi do projektu: najpierw szybkie (dane), potem teksty w ramkach.
export async function sprawdzWszystko(projekt, ciag = rozwin(projekt), opcje = {}) {
  return [...sprawdzProjekt(projekt, ciag), ...await sprawdzMieszczenie(projekt, ciag, opcje)];
}
