// Jedna historia cofania dla całego projektu.
//
// Każdy krok to migawka projektu: strony, wzorce i tabele jako osobne teksty
// JSON, reszta (sekcje, style, serie, widok, nazwa) jako jeden. Niezmienione
// części są w kolejnych migawkach tym samym tekstem w pamięci, więc 80 kroków
// dużego projektu nie kosztuje 80 jego kopii. Obrazy (zasoby) nie należą do
// historii – nigdy nie są usuwane, więc cofnięty element znajdzie swój plik.

const MAKS_KROKOW = 80;
const RESZTA = ['nazwa', 'sekcje', 'style', 'serie', 'widok'];
const LISTY = ['strony', 'wzorce', 'tabele'];

function migawka(projekt, poprzednia) {
  const m = { reszta: JSON.stringify(RESZTA.map((k) => projekt[k])) };
  if (poprzednia && poprzednia.reszta === m.reszta) m.reszta = poprzednia.reszta;
  for (const lista of LISTY) {
    m[lista] = new Map(projekt[lista].map((x) => {
      const tekst = JSON.stringify(x);
      const stary = poprzednia?.[lista].get(x.id);
      return [x.id, stary === tekst ? stary : tekst];
    }));
  }
  return m;
}

function takieSame(a, b) {
  if (a.reszta !== b.reszta) return false;
  return LISTY.every((lista) => {
    if (a[lista].size !== b[lista].size) return false;
    const [ka, kb] = [[...a[lista]], [...b[lista]]];
    return ka.every(([id, tekst], i) => kb[i][0] === id && kb[i][1] === tekst);
  });
}

// Przepisuje migawkę do projektu (w miejscu), w nowych obiektach.
function odtworz(projekt, m) {
  const reszta = JSON.parse(m.reszta);
  RESZTA.forEach((k, n) => { projekt[k] = reszta[n]; });
  for (const lista of LISTY) projekt[lista] = [...m[lista].values()].map((t) => JSON.parse(t));
}

// Identyfikatory części, które różnią się między migawkami i istnieją w docelowej.
function zmienione(z, na, lista) {
  return [...na[lista]].filter(([id, tekst]) => z[lista].get(id) !== tekst).map(([id]) => id);
}

export class Historia {
  constructor() {
    this.wyczysc();
  }

  wyczysc() {
    this.kroki = [];
    this.i = -1;
  }

  get moznaCofnac() { return this.i > 0; }
  get moznaPonowic() { return this.i < this.kroki.length - 1; }

  // Zapamiętuje bieżący stan projektu jako nowy krok (jeśli różni się od
  // ostatniego). Kroki „do przodu” po cofnięciu przepadają. Zwraca true, gdy
  // powstał nowy krok.
  zapisz(projekt) {
    const m = migawka(projekt, this.kroki[this.i]);
    if (this.i >= 0 && takieSame(m, this.kroki[this.i])) return false;
    this.kroki = this.kroki.slice(0, this.i + 1);
    this.kroki.push(m);
    if (this.kroki.length > MAKS_KROKOW) this.kroki.shift();
    this.i = this.kroki.length - 1;
    return true;
  }

  // Przelicza wszystkie kroki (także te „do przodu”): każdy krok jest odtwarzany jako projekt – części spoza
  // historii bierze z `wzor` – i zmieniany w miejscu przez fn(projekt). Tak zmiany z innego urządzenia trafiają
  // do każdego kroku: cofanie zdejmuje potem tylko to, co zrobiono tutaj.
  przelicz(wzor, fn) {
    let poprzednia = null;
    this.kroki = this.kroki.map((k) => {
      const p = { ...wzor };
      odtworz(p, k);
      fn(p);
      poprzednia = migawka(p, poprzednia);
      return poprzednia;
    });
  }

  // Przepisuje krok do projektu (w miejscu). Zwraca, co się zmieniło:
  // { strony: [id], wzorce: [id], tabele: [id], reszta: bool }.
  _przejdz(projekt, cel) {
    const z = this.kroki[this.i];
    const na = this.kroki[cel];
    this.i = cel;
    odtworz(projekt, na);
    return {
      strony: zmienione(z, na, 'strony'), wzorce: zmienione(z, na, 'wzorce'), tabele: zmienione(z, na, 'tabele'),
      reszta: z.reszta !== na.reszta,
    };
  }

  cofnij(projekt) {
    return this.moznaCofnac ? this._przejdz(projekt, this.i - 1) : null;
  }

  ponow(projekt) {
    return this.moznaPonowic ? this._przejdz(projekt, this.i + 1) : null;
  }
}
