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

// Zakres elementu wzdłuż osi na wysokości `poprzek`. Obrócony element ma `wielokat`
// (cztery rogi) – wtedy liczy się jego prawdziwy kształt, a nie prostokąt otaczający.
function zakresNa(o, os, poprzek) {
  const [p, s] = OSIE[os];
  if (!o.wielokat) return [o[p], o[p] + o[s]];
  const q = os === 'x' ? 'y' : 'x';
  const przeciecia = [];
  o.wielokat.forEach((a, i) => {
    const b = o.wielokat[(i + 1) % o.wielokat.length];
    if ((a[q] - poprzek) * (b[q] - poprzek) > 0 || a[q] === b[q]) return;
    przeciecia.push(a[os] + ((poprzek - a[q]) / (b[q] - a[q])) * (b[os] - a[os]));
  });
  return przeciecia.length ? [Math.min(...przeciecia), Math.max(...przeciecia)] : [o[p], o[p] + o[s]];
}

// Odcinek pomiaru między dwoma prostokątami wzdłuż osi (od końca a do początku b).
function pomiarMiedzy(a, b, os, rowne = false) {
  const [p, s, q, t] = OSIE[os];
  const wspolne1 = Math.max(a[q], b[q]);
  const wspolne2 = Math.min(a[q] + a[t], b[q] + b[t]);
  const poprzek = (wspolne1 + wspolne2) / 2;
  const od = a.wielokat ? zakresNa(a, os, poprzek)[1] : a[p] + a[s];
  const dokad = b.wielokat ? zakresNa(b, os, poprzek)[0] : b[p];
  if (dokad - od <= EPS) return null;
  return { os, od, do: dokad, poprzek, wartosc: dokad - od, rowne };
}

// Najbliższy element leżący po skosie: w całości przed albo za prostokątem wzdłuż osi,
// ale bez wspólnego zakresu w poprzek. Pomiar idzie na wysokości środka r, a `dociagniecie`
// to przedłużenie krawędzi sąsiada do tej wysokości (rysowane cienką linią).
function pomiarPoSkosie(r, inne, os, strona) {
  const [p, s, q, t] = OSIE[os];
  let najlepszy = null;
  for (const o of inne) {
    if (nachodza(r[q], r[q] + r[t], o[q], o[q] + o[t])) continue;
    const odstep = strona === 'przed' ? r[p] - (o[p] + o[s]) : o[p] - (r[p] + r[s]);
    if (odstep <= EPS) continue;
    if (!najlepszy || odstep < najlepszy.odstep) najlepszy = { o, odstep };
  }
  if (!najlepszy) return null;
  const { o, odstep } = najlepszy;
  const poprzek = r[q] + r[t] / 2;
  const krawedz = strona === 'przed' ? o[p] + o[s] : o[p];
  const blizszy = poprzek < o[q] ? o[q] : o[q] + o[t];
  return {
    os, od: strona === 'przed' ? krawedz : r[p] + r[s], do: strona === 'przed' ? r[p] : krawedz, poprzek, wartosc: odstep, rowne: false,
    dociagniecie: { poz: krawedz, od: Math.min(poprzek, blizszy), do: Math.max(poprzek, blizszy) },
    sasiad: o,
  };
}

// Rogi elementu: obrócony ma `wielokat`, zwykły – rogi swojego prostokąta.
const rogi = (o) => o.wielokat || [{ x: o.x, y: o.y }, { x: o.x + o.w, y: o.y }, { x: o.x + o.w, y: o.y + o.h }, { x: o.x, y: o.y + o.h }];

// Najbliższe sobie punkty obrysów dwóch elementów: { a, b, d } – punkt na pierwszym, na drugim i odległość
// między nimi w linii prostej. Dla dwóch prostokątów po skosie to ich najbliższe narożniki; dla elementu
// obróconego punkt może wypaść na jego boku.
function najblizszePunkty(pierwszy, drugi) {
  let najlepszy = null;
  const sprawdz = (punkt, wielokat, odwrotnie) => {
    wielokat.forEach((q1, i) => {
      const q2 = wielokat[(i + 1) % wielokat.length];
      const dx = q2.x - q1.x;
      const dy = q2.y - q1.y;
      const dl2 = dx * dx + dy * dy;
      const t = dl2 ? Math.max(0, Math.min(1, ((punkt.x - q1.x) * dx + (punkt.y - q1.y) * dy) / dl2)) : 0;
      const q = { x: q1.x + t * dx, y: q1.y + t * dy };
      const d = Math.hypot(punkt.x - q.x, punkt.y - q.y);
      if (!najlepszy || d < najlepszy.d - EPS) najlepszy = odwrotnie ? { d, a: q, b: { x: punkt.x, y: punkt.y } } : { d, a: { x: punkt.x, y: punkt.y }, b: q };
    });
  };
  for (const punkt of rogi(pierwszy)) sprawdz(punkt, rogi(drugi), false);
  for (const punkt of rogi(drugi)) sprawdz(punkt, rogi(pierwszy), true);
  return najlepszy;
}

// Przyciąganie jednej krawędzi przy zmianie rozmiaru uchwytem. poz – położenie krawędzi
// na osi (mm); cele: prowadnice, krawędzie i środki innych elementów, linie siatki.
// Zwraca { d, linia } (o ile przesunąć krawędź i co narysować) albo null.
export function przyciagnijKrawedz(poz, os, r, { linie = [], inne = [], siatka = null, prog = 1 }) {
  const [p, s, q, t] = OSIE[os];
  let najlepszy = null;
  const sprawdz = (cel, linia) => {
    const d = cel - poz;
    if (Math.abs(d) <= prog && (!najlepszy || Math.abs(d) < Math.abs(najlepszy.d))) najlepszy = { d, linia };
  };
  for (const l of linie) sprawdz(l, { os, poz: l });
  for (const o of inne) {
    for (const cel of [o[p], o[p] + o[s] / 2, o[p] + o[s]]) {
      sprawdz(cel, { os, poz: cel, od: Math.min(r[q], o[q]), do: Math.max(r[q] + r[t], o[q] + o[t]) });
    }
  }
  if (!najlepszy && siatka && siatka.krok > 0) {
    const cel = siatka.poczatek + Math.round((poz - siatka.poczatek) / siatka.krok) * siatka.krok;
    return { d: cel - poz, linia: null };
  }
  return najlepszy;
}

// Odległości prostokąta do najbliższych sąsiadów w czterech kierunkach.
// obszar: opcjonalnie { x, y, w, h } strony – gdy w danym kierunku nie ma
// sąsiada, mierzona jest odległość do krawędzi strony.
// Sąsiad leżący po skosie dostaje, oprócz odległości w poziomie i w pionie, także pomiar w linii prostej
// (po przekątnej): { os: 'skos', a, b, wartosc } – odcinek między najbliższymi punktami obu elementów.
export function pomiary(r, inne, obszar = null) {
  const wynik = [];
  const poSkosie = new Set();
  for (const os of ['x', 'y']) {
    const [p, s, q, t] = OSIE[os];
    const { przed, za } = sasiedziNaOsi(r, inne, os);
    // Naprzeciwko nikogo nie ma? Mierzymy do najbliższego elementu po skosie.
    const a = przed ? pomiarMiedzy(przed, r, os) : pomiarPoSkosie(r, inne, os, 'przed');
    const b = za ? pomiarMiedzy(r, za, os) : pomiarPoSkosie(r, inne, os, 'za');
    if (a && b && Math.abs(a.wartosc - b.wartosc) < EPS) { a.rowne = true; b.rowne = true; }
    for (const m of [a, b]) {
      if (!m) continue;
      if (m.sasiad) { poSkosie.add(m.sasiad); delete m.sasiad; }
      wynik.push(m);
    }
    if (obszar) {
      const poprzek = r[q] + r[t] / 2;
      if (!przed && !a && r[p] - obszar[p] > EPS) wynik.push({ os, od: obszar[p], do: r[p], poprzek, wartosc: r[p] - obszar[p], rowne: false, doKrawedzi: true });
      const koniec = obszar[p] + obszar[s];
      if (!za && !b && koniec - (r[p] + r[s]) > EPS) wynik.push({ os, od: r[p] + r[s], do: koniec, poprzek, wartosc: koniec - (r[p] + r[s]), rowne: false, doKrawedzi: true });
    }
  }
  for (const o of poSkosie) {
    const n = najblizszePunkty(r, o);
    if (n && n.d > EPS) wynik.push({ os: 'skos', a: n.a, b: n.b, wartosc: n.d, rowne: false });
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
