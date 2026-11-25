// Ostrzeżenia przy stronie po przeliczeniu danych (#418). Tekst z polami ({miesiac}, {opis}…) i element
// z położeniem, rozmiarem albo widocznością z danych wyglądają na płótnie jak wzór – z nazwami pól zamiast
// wartości. Nazwa pola bywa dłuższa od każdej wartości („{miesiac_dopelniacz}” nie mieści się w ramce, a
// „marca” zawsze się zmieści), więc ostrzeżenia o takich elementach liczymy tak jak „Sprawdź przed drukiem”:
// na każdej stronie wydruku, która powstaje z tej strony (albo z tego wzorca), z jej danymi. Uwaga zostaje
// tylko wtedy, gdy coś jest nie tak na prawdziwej stronie – z numerami tych stron.

import { stan, edytor } from './kontekst.js';
import { naPlotnie } from './zapis.js';
import { rozwin } from '../serie.js';
import { stronyZWzorcem } from '../projekt.js';
import { sprawdzMieszczenie } from '../kontrola-skladu.js';
import { uwagiElementow } from '../kontrola-elementow.js';

const POLE = /\{[^{}]+\}/;
// Czy element zależy od danych: tekst z polami (bez przełącznika „klamry to zwykły tekst”) albo reguła „Z danych”.
export const zaleznyOdDanych = (o) => Boolean(o && (o.z_danych || (!o.bez_pol && typeof o.text === 'string' && POLE.test(o.text))
  || (Array.isArray(o._objects) && o._objects.some(zaleznyOdDanych))));

let wynik = new Map(); // id elementu → Map(typ → opis)
let klucz = ''; // stan płótna i danych, dla którego jest wynik
let liczony = ''; // klucz, który właśnie się liczy
let czas = null;

// Projekt z bieżącym stanem płótna (płótno zapisuje się do projektu z opóźnieniem) – bez kopiowania reszty.
function projektZPlotnem() {
  const p = stan.projekt;
  if (!p || !naPlotnie) return null;
  if (naPlotnie.wzorzec) {
    const obiekty = edytor.obiektyStrony();
    return { projekt: { ...p, wzorce: p.wzorce.map((w) => (w.id === naPlotnie.wzorzec ? { ...w, obiekty } : w)) }, strony: new Set(stronyZWzorcem(p, naPlotnie.wzorzec).map((s) => s.id)), obiekty };
  }
  const naStronach = edytor.obiektyStron();
  const ids = naPlotnie.strony;
  return {
    projekt: { ...p, strony: p.strony.map((s) => { const i = ids.indexOf(s.id); return i < 0 ? s : { ...s, obiekty: naStronach[i] || [] }; }) },
    strony: new Set(ids),
    obiekty: naStronach.flat(),
  };
}

// Odcisk danych: tabele (wiersze i kolumny) i serie – zmiana danych liczy ostrzeżenia od nowa.
const odciskDanych = (p) => JSON.stringify([p.tabele, p.serie, p.sekcje.map((s) => [s.id, s.wydruk])]);

async function policz(kl, stanPlotna) {
  liczony = kl;
  const { projekt, strony } = stanPlotna;
  const caly = rozwin(projekt);
  const ciag = { ...caly, egzemplarze: caly.egzemplarze.filter((e) => strony.has(e.strona.id)) };
  // Tylko elementy zależne od danych (#435) – ich ostrzeżenia tu się liczą; reszta ma zwykłe ostrzeżenia edytora.
  const tylko = new Set(stanPlotna.obiekty.filter(zaleznyOdDanych).map((o) => o.id));
  const uwagi = [...uwagiElementow(projekt, ciag), ...await sprawdzMieszczenie(projekt, ciag, { przerwij: () => liczony !== kl, tylko })];
  if (liczony !== kl) return; // w międzyczasie coś się zmieniło – liczy się nowsza wersja
  const nowy = new Map();
  for (const u of uwagi) {
    if (!u.idObiektu) continue;
    const m = nowy.get(u.idObiektu) || new Map();
    if (!m.has(u.rodzaj)) m.set(u.rodzaj, u.opis);
    nowy.set(u.idObiektu, m);
  }
  wynik = nowy;
  klucz = kl;
  liczony = '';
}

const coNaPlotnie = () => JSON.stringify(naPlotnie && (naPlotnie.wzorzec || naPlotnie.strony));
let wynikDla = ''; // strona (albo wzorzec), dla której jest wynik

// Wywoływane przez edytor dla każdego elementu przy liczeniu ostrzeżeń. Wynik sprzed chwili (w trakcie pisania)
// zostaje, dopóki nie policzy się nowy; po przejściu na inną stronę – do czasu wyniku bez tych ostrzeżeń.
edytor.poPrzeliczeniu = (o) => {
  if (!zaleznyOdDanych(o) || !stan.projekt || !naPlotnie) return null;
  if (!klucz || wynikDla !== coNaPlotnie()) return 'liczy';
  return wynik.get(o.id) || new Map();
};

// Po zmianie ostrzeżeń (każda zmiana na płótnie): gdy są elementy zależne od danych – po chwili spokoju
// sprawdzamy, czy płótno albo dane się zmieniły, i wtedy liczymy w tle.
// Liczenie w tle nie przeszkadza w pracy (#435): rusza po 0,8 s spokoju, a dotknięcie ekranu, klik albo klawisz
// przerywa je i odkłada na później (zaczyna się od nowa po kolejnej chwili spokoju).
const SPOKOJ_MS = 800;
let zaplanuj = () => {};
const przerwijLiczenie = () => {
  if (!liczony) return;
  liczony = '';
  zaplanuj();
};
for (const z of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(z, przerwijLiczenie, { capture: true, passive: true });
zaplanuj = () => {
  clearTimeout(czas);
  czas = setTimeout(() => {
    if (!stan.projekt || !naPlotnie || !edytor.canvas.getObjects().some(zaleznyOdDanych)) return;
    if (edytor.aktywny?.isEditing) { zaplanuj(); return; } // w trakcie pisania – po skończeniu
    const sp = projektZPlotnem();
    if (!sp) return;
    // Klucz z elementów zależnych od danych (przesunięcie zwykłego elementu nie liczy wszystkiego od nowa).
    const kl = JSON.stringify([naPlotnie, sp.obiekty.filter(zaleznyOdDanych)]) + odciskDanych(stan.projekt);
    if (kl === klucz || kl === liczony) return;
    const dla = coNaPlotnie();
    policz(kl, sp).then(() => { if (klucz === kl) { wynikDla = dla; edytor.przeliczOstrzezenia(); } }).catch(() => { liczony = ''; });
  }, SPOKOJ_MS);
};
edytor.addEventListener('ostrzezenia', () => zaplanuj());
