// Dzielenie wyrazów po polsku (#131): wzorce Lianga z hyph-utf8 (hyph-pl) przez pakiet hyphen
// (js/zewnetrzne/hyphen-*.js). Wzorce (ok. 110 kB) wczytują się dopiero wtedy, gdy któryś tekst ma
// włączone dzielenie; zanim przyjdą, tekst łamie się bez dzielenia, a po wczytaniu edytor układa
// teksty od nowa (zdarzenie „makietka:dzielenie”). Składanie stron do podglądu i PDF czeka na nie.

let dziel = null;
let wczytywanie = null;

export function zaladujDzielenie() {
  if (!wczytywanie) {
    wczytywanie = Promise.all([
      import('./zewnetrzne/hyphen-1.14.1.js'),
      import('./zewnetrzne/hyphen-pl-1.14.1.js'),
    ]).then(([silnik, wzorce]) => {
      dziel = silnik.default(wzorce.default, { hyphenChar: '­' });
      try { globalThis.dispatchEvent?.(new globalThis.Event('makietka:dzielenie')); } catch { /* poza przeglądarką */ }
      return true;
    }).catch(() => false);
  }
  return wczytywanie;
}

export const dzielenieDostepne = () => dziel !== null;

// Czy któryś element (także w grupach) ma włączone dzielenie wyrazów.
export function uzywaDzielenia(obiekty) {
  return (obiekty || []).some((o) => o && (o.dziel_wyrazy || (Array.isArray(o.objects) && uzywaDzielenia(o.objects))));
}

const LITERA = /^\p{L}+$/u;
const pamiec = new Map();

// Miejsca podziału słowa (indeksy znaków, przed którymi wolno przenieść resztę do następnego wiersza).
// Nie dzieli: wyrazów krótszych niż `min`, słów z cyframi, znakami @ / . : (adresy) i nie-literami
// w środku, pól z danymi ({…}). `przed` i `po` – najmniej liter zostających w wierszu i przenoszonych.
// Znaki interpunkcyjne na brzegach słowa („słowo,”) nie przeszkadzają. Bez wczytanych wzorców – pusto
// (i wzorce zaczynają się wczytywać).
export function miejscaPodzialu(slowo, { min = 5, przed = 2, po = 2 } = {}) {
  if (!dziel) { zaladujDzielenie(); return []; }
  if (!slowo || slowo.length < min) return [];
  const klucz = `${slowo}|${min}|${przed}|${po}`;
  const znane = pamiec.get(klucz);
  if (znane) return znane;
  let wynik = [];
  const m = /^([^\p{L}]*)(.*?)([^\p{L}]*)$/su.exec(slowo);
  const [, poczatek, rdzen] = m;
  if (rdzen.length >= min && LITERA.test(rdzen) && !/[{}]/.test(slowo)) {
    const czesci = dziel(rdzen, { minWordLength: min }).split('­');
    let i = poczatek.length;
    for (let k = 0; k < czesci.length - 1; k += 1) {
      i += czesci[k].length;
      const zostaje = i - poczatek.length;
      const idzie = rdzen.length - zostaje;
      if (zostaje >= przed && idzie >= po) wynik.push(i);
    }
  }
  if (pamiec.size > 20000) pamiec.clear();
  pamiec.set(klucz, wynik = Object.freeze(wynik));
  return wynik;
}
