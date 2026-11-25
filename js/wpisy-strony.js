// Treść z tabeli (#432): które wiersze tabeli stoją na danej stronie – do pól {pierwszy:kolumna}, {ostatni:kolumna},
// {pierwsza_litera:kolumna} i {ostatnia_litera:kolumna} (np. nagłówek słowniczka „Abba – Belzebub”, „A–B”).
// Liczone z zapisu projektu (bez żywych obiektów i bez importów, żeby serie.js mogło z tego korzystać wszędzie):
// ramka źródłowa trzyma w z_tabeli.poczatki miejsca, w których w całym tekście zaczynają się kolejne wiersze,
// a każda ramka wątku trzyma swoją część tekstu.

const ramkiWatku = (projekt, watek) => {
  const wynik = [];
  for (const s of projekt.strony || []) for (const o of s.obiekty || []) if (o?.type === 'textbox' && o.watek === watek) wynik.push({ s, o });
  return wynik.sort((a, b) => (a.o.watek_nr || 0) - (b.o.watek_nr || 0));
};

// Zakres wierszy w częściach ramek: [{ s, o, od, do }] – od/do to położenie części w całym tekście.
export function czesciWTekscie(ramki) {
  let poz = 0;
  let bylo = false;
  return ramki.map(({ s, o }) => {
    const t = o.text || '';
    if (!t) return { s, o, od: poz, do: poz };
    if (bylo) poz += (o.lacznik ?? '\n').length;
    const od = poz;
    poz += t.length;
    bylo = true;
    return { s, o, od, do: poz };
  });
}

// Wiersze (numery w tabeli) z początkiem w [od, do); gdy żaden się tu nie zaczyna – wiersz, który trwa.
export function wierszeWZakresie(poczatki, od, doZnaku) {
  if (!Array.isArray(poczatki) || !poczatki.length || doZnaku <= od) return null;
  const tu = poczatki.filter(([p]) => p >= od && p < doZnaku).map(([, nr]) => nr);
  if (tu.length) return { od: Math.min(...tu), do: Math.max(...tu) };
  const trwa = poczatki.filter(([p]) => p <= od).at(-1);
  return trwa ? { od: trwa[1], do: trwa[1] } : null;
}

// { tabela: id, od, do } – wiersze tabeli, których wpisy stoją na stronie; null, gdy strona nie ma treści z tabeli.
export function wpisyNaStronie(projekt, strona) {
  if (!projekt || !strona) return null;
  let wynik = null;
  const dolicz = (tabela, z) => {
    if (!z) return;
    if (!wynik) wynik = { tabela, od: z.od, do: z.do };
    else if (wynik.tabela === tabela) { wynik.od = Math.min(wynik.od, z.od); wynik.do = Math.max(wynik.do, z.do); }
  };
  const watki = new Set();
  for (const o of strona.obiekty || []) {
    if (o?.type !== 'textbox') continue;
    if (o.watek) { watki.add(o.watek); continue; }
    if (o.z_tabeli?.tabela && !o.z_tabeli.edycja) dolicz(o.z_tabeli.tabela, wierszeWZakresie(o.z_tabeli.poczatki, 0, (o.text || '').length));
  }
  for (const w of watki) {
    const ramki = ramkiWatku(projekt, w);
    const zrodlo = ramki.find((r) => r.o.z_tabeli?.tabela && !r.o.z_tabeli.edycja)?.o;
    if (!zrodlo) continue;
    for (const c of czesciWTekscie(ramki)) if (c.s === strona) dolicz(zrodlo.z_tabeli.tabela, wierszeWZakresie(zrodlo.z_tabeli.poczatki, c.od, c.do));
  }
  return wynik;
}

// Wartość pola zakresu wpisów na stronie: rodzaj 'pierwszy' | 'ostatni' | 'pierwsza_litera' | 'ostatnia_litera',
// kolumna – nazwa kolumny (brak: pierwsza kolumna tabeli). '' – strona bez treści z tabeli.
export function poleWpisow(projekt, strona, rodzaj, kolumna) {
  const w = wpisyNaStronie(projekt, strona);
  if (!w) return '';
  const tabela = (projekt.tabele || []).find((t) => t.id === w.tabela);
  if (!tabela) return '';
  const k = kolumna ? tabela.kolumny.indexOf(String(kolumna).trim()) : 0;
  if (k < 0) return '';
  const v = String(tabela.wiersze[rodzaj.startsWith('pierw') ? w.od : w.do]?.[k] ?? '').trim();
  if (!rodzaj.endsWith('litera')) return v;
  const litera = v.match(/\p{L}|\d/u)?.[0] || '';
  return litera.toLocaleUpperCase('pl');
}
