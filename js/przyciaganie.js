// Przyciąganie przesuwanego elementu i pomiary odległości (jak „inteligentne
// linie pomocnicze” w programach do składu). Czyste funkcje na prostokątach
// w milimetrach: { x, y, w, h }. Rysowaniem zajmuje się edytor.

const EPS = 0.05;

// Oś główna i poprzeczna: [położenie, rozmiar, położenie w poprzek, rozmiar w poprzek].
const OSIE = { x: ['x', 'w', 'y', 'h'], y: ['y', 'h', 'x', 'w'] };

const nachodza = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1) > EPS;

// Najbliżsi sąsiedzi prostokąta wzdłuż osi: poprzedni i następny spośród tych,
// które leżą „naprzeciwko” (mają wspólny zakres w poprzek osi).
function sasiedziNaOsi(r, inne, os) {
  const [p, s, q, t] = OSIE[os];
  const srodek = r[p] + r[s] / 2;
  let przed = null;
  let za = null;
  for (const o of inne) {
    if (!nachodza(r[q], r[q] + r[t], o[q], o[q] + o[t])) continue;
    if (o[p] + o[s] <= srodek && (!przed || o[p] + o[s] > przed[p] + przed[s])) przed = o;
    if (o[p] >= srodek && (!za || o[p] < za[p])) za = o;
  }
  return { przed, za };
}

// Możliwe przesunięcia wzdłuż jednej osi.
function kandydaci(r, os, { linie = [], inne = [], siatka = null }) {
  const [p, s] = OSIE[os];
  const poczatek = r[p];
  const srodek = r[p] + r[s] / 2;
  const koniec = r[p] + r[s];
  const lista = [];
  for (const l of linie) {
    for (const krawedz of [poczatek, srodek, koniec]) lista.push({ d: l - krawedz, typ: 'linia', poz: l });
  }
  for (const o of inne) {
    const oPocz = o[p];
    const oKon = o[p] + o[s];
    for (const cel of [oPocz, oKon]) {
      lista.push({ d: cel - poczatek, typ: 'element', poz: cel, o });
      lista.push({ d: cel - koniec, typ: 'element', poz: cel, o });
    }
    lista.push({ d: o[p] + o[s] / 2 - srodek, typ: 'element', poz: o[p] + o[s] / 2, o });
  }
  // Równe odstępy: na środku między sąsiadami albo w takim samym odstępie, jaki
  // sąsiad ma od swojego sąsiada.
  const { przed, za } = sasiedziNaOsi(r, inne, os);
  if (przed && za) {
    const wolne = za[p] - (przed[p] + przed[s]) - r[s];
    if (wolne > EPS) lista.push({ d: przed[p] + przed[s] + wolne / 2 - poczatek, typ: 'rowne', odstep: wolne / 2 });
  }
  if (przed) {
    const dalszy = sasiedziNaOsi(przed, inne.filter((o) => o !== przed), os).przed;
    const odstep = dalszy ? przed[p] - (dalszy[p] + dalszy[s]) : 0;
    if (odstep > EPS) lista.push({ d: przed[p] + przed[s] + odstep - poczatek, typ: 'rowne', odstep, wzor: [dalszy, przed] });
  }
  if (za) {
    const dalszy = sasiedziNaOsi(za, inne.filter((o) => o !== za), os).za;
    const odstep = dalszy ? dalszy[p] - (za[p] + za[s]) : 0;
    if (odstep > EPS) lista.push({ d: za[p] - odstep - koniec, typ: 'rowne', odstep, wzor: [za, dalszy] });
  }
  if (siatka && siatka.krok > 0) {
    const doSiatki = (v) => siatka.poczatek + Math.round((v - siatka.poczatek) / siatka.krok) * siatka.krok - v;
    // Do siatki trafia początek elementu (lewa albo górna krawędź), żeby
    // położenie było zawsze wielokrotnością kroku.
    lista.push({ d: doSiatki(poczatek), typ: 'siatka' });
  }
  return lista;
}

// Najlepsze przesunięcie na osi: najbliższa linia, krawędź innego elementu albo
// równy odstęp w zasięgu progu; gdy nic nie pasuje – najbliższa linia siatki.
function naOsi(r, os, opcje, prog) {
  const lista = kandydaci(r, os, opcje);
  let najlepszy = null;
  for (const k of lista) {
    if (k.typ === 'siatka' || Math.abs(k.d) > prog) continue;
    if (!najlepszy || Math.abs(k.d) < Math.abs(najlepszy.d)) najlepszy = k;
  }
  if (!najlepszy) {
    for (const k of lista) {
      if (k.typ === 'siatka' && (!najlepszy || Math.abs(k.d) < Math.abs(najlepszy.d))) najlepszy = k;
    }
    return { d: najlepszy ? najlepszy.d : 0, trafienia: [] };
  }
  return { d: najlepszy.d, trafienia: lista.filter((k) => k.typ !== 'siatka' && Math.abs(k.d - najlepszy.d) < EPS) };
}

// Odcinek pomiaru między dwoma prostokątami wzdłuż osi (od końca a do początku b).
function pomiarMiedzy(a, b, os, rowne = false) {
  const [p, s, q, t] = OSIE[os];
  const od = a[p] + a[s];
  const dokad = b[p];
  if (dokad - od <= EPS) return null;
  const wspolne1 = Math.max(a[q], b[q]);
  const wspolne2 = Math.min(a[q] + a[t], b[q] + b[t]);
  return { os, od, do: dokad, poprzek: (wspolne1 + wspolne2) / 2, wartosc: dokad - od, rowne };
}

// Odległości prostokąta do najbliższych sąsiadów w czterech kierunkach.
// obszar: opcjonalnie { x, y, w, h } strony – gdy w danym kierunku nie ma
// sąsiada, mierzona jest odległość do krawędzi strony.
export function pomiary(r, inne, obszar = null) {
  const wynik = [];
  for (const os of ['x', 'y']) {
    const [p, s, q, t] = OSIE[os];
    const { przed, za } = sasiedziNaOsi(r, inne, os);
    const a = przed ? pomiarMiedzy(przed, r, os) : null;
    const b = za ? pomiarMiedzy(r, za, os) : null;
    if (a && b && Math.abs(a.wartosc - b.wartosc) < EPS) { a.rowne = true; b.rowne = true; }
    if (a) wynik.push(a);
    if (b) wynik.push(b);
    if (obszar) {
      const poprzek = r[q] + r[t] / 2;
      if (!przed && r[p] - obszar[p] > EPS) wynik.push({ os, od: obszar[p], do: r[p], poprzek, wartosc: r[p] - obszar[p], rowne: false, doKrawedzi: true });
      const koniec = obszar[p] + obszar[s];
      if (!za && koniec - (r[p] + r[s]) > EPS) wynik.push({ os, od: r[p] + r[s], do: koniec, poprzek, wartosc: koniec - (r[p] + r[s]), rowne: false, doKrawedzi: true });
    }
  }
  return wynik;
}

// Przyciąga prostokąt r. opcje:
//   linieX, linieY – prowadnice (krawędzie i marginesy stron, własne prowadnice),
//   inne – prostokąty pozostałych elementów,
//   siatkaX, siatkaY – { krok, poczatek } albo null,
//   prog – zasięg przyciągania w mm.
// Zwraca { dx, dy, linie, pomiary } – o ile przesunąć i co narysować.
export function przyciagnij(r, { linieX = [], linieY = [], inne = [], siatkaX = null, siatkaY = null, prog = 1 }) {
  const x = naOsi(r, 'x', { linie: linieX, inne, siatka: siatkaX }, prog);
  const y = naOsi(r, 'y', { linie: linieY, inne, siatka: siatkaY }, prog);
  const po = { x: r.x + x.d, y: r.y + y.d, w: r.w, h: r.h };

  const linie = [];
  const dodajLinie = (trafienia, os) => {
    const [, , q, t] = OSIE[os];
    for (const k of trafienia) {
      if (k.typ === 'linia') linie.push({ os, poz: k.poz });
      else if (k.typ === 'element') {
        linie.push({ os, poz: k.poz, od: Math.min(po[q], k.o[q]), do: Math.max(po[q] + po[t], k.o[q] + k.o[t]) });
      }
    }
  };
  dodajLinie(x.trafienia, 'x');
  dodajLinie(y.trafienia, 'y');

  const miary = pomiary(po, inne);
  for (const [os, wynik] of [['x', x], ['y', y]]) {
    for (const k of wynik.trafienia) {
      if (k.typ !== 'rowne') continue;
      for (const m of miary) if (m.os === os && Math.abs(m.wartosc - k.odstep) < EPS) m.rowne = true;
      if (k.wzor) {
        const m = pomiarMiedzy(k.wzor[0], k.wzor[1], os, true);
        if (m) miary.push(m);
      }
    }
  }
  return { dx: x.d, dy: y.d, linie, pomiary: miary };
}
