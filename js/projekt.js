// Model projektu (sekcja 3 planu). Wszystkie wymiary w milimetrach.
//
// Wersja 3:
// - projekt dzieli się na sekcje (np. okładka, środek) z własnym formatem,
//   spadem, czterema marginesami, układem (pojedyncze strony / rozkładówki)
//   i numeracją;
// - w rozkładówkach marginesy są lustrzane: wewnętrzny przy grzbiecie,
//   zewnętrzny przy krawędzi – po przeciwnych stronach dla stron lewych i prawych;
// - wzorce (strony wzorcowe) zastępują „motywy” z planu: strona może mieć
//   kilka wzorców naraz, a każdy element wzorca leży pod albo nad treścią strony.

export const WERSJA_MODELU = 3;

export const FORMATY = {
  A4: [210, 297],
  A5: [148, 210],
  A6: [105, 148],
  B5: [176, 250],
  Kwadrat: [210, 210],
};

export const MM_NA_PT = 25.4 / 72;
export const ptNaMm = (pt) => pt * MM_NA_PT;
export const mmNaPt = (mm) => mm / MM_NA_PT;

// Wzorce strony: wartość 'z_sekcji' albo lista identyfikatorów (pusta = bez wzorców).
export const WZORCE_Z_SEKCJI = 'z_sekcji';

export function uid(prefiks = 'id') {
  const losowe = crypto.getRandomValues(new Uint32Array(2));
  return `${prefiks}_${losowe[0].toString(36)}${losowe[1].toString(36)}`;
}

export function domyslnyWydruk() {
  return {
    format: 'A5',
    szerokosc_mm: 148,
    wysokosc_mm: 210,
    spad_mm: 3,
    marginesy: { gora: 10, dol: 10, wewnetrzny: 10, zewnetrzny: 10 },
    znaki_ciecia: true,
  };
}

// Uzupełnia wydruk i przenosi stare „marginesy_mm” (jedna liczba) na cztery marginesy.
export function normalizujWydruk(w = {}) {
  const d = domyslnyWydruk();
  const wynik = { ...d, ...w };
  const jeden = Number.isFinite(w.marginesy_mm) ? w.marginesy_mm : null;
  const m = w.marginesy || {};
  wynik.marginesy = {};
  for (const k of ['gora', 'dol', 'wewnetrzny', 'zewnetrzny']) {
    const v = Number.isFinite(m[k]) ? m[k] : (jeden ?? d.marginesy[k]);
    wynik.marginesy[k] = Math.max(0, v);
  }
  delete wynik.marginesy_mm;
  return wynik;
}

export function nowaSekcja(nazwa = 'Sekcja', wydruk = domyslnyWydruk()) {
  return {
    id: uid('sek'),
    nazwa,
    wydruk: normalizujWydruk(wydruk),
    uklad: 'pojedyncze', // 'pojedyncze' | 'rozkladowki'
    pierwsza: 'prawa', // która strona zaczyna sekcję w rozkładówkach
    wzorce: [],
    numeracja: { tryb: 'ciagla', od: 1 }, // 'ciagla' | 'od' | 'brak'
  };
}

export function nowyWzorzec(nazwa = 'Wzorzec', wydruk = domyslnyWydruk()) {
  return {
    id: uid('wz'), nazwa, wydruk: normalizujWydruk(wydruk), obiekty: [], tlo: null, lustro: false,
  };
}

export function nowaStrona(nazwa = 'Strona', sekcja = null) {
  return {
    id: uid('s'), nazwa, sekcja, wzorce: WZORCE_Z_SEKCJI, obiekty: [], tlo: null,
  };
}

export function nowyProjekt(nazwa = 'Nowy projekt', wydruk = domyslnyWydruk(), uklad = 'pojedyncze') {
  const sekcja = nowaSekcja('Główna', wydruk);
  sekcja.uklad = uklad;
  return {
    wersja: WERSJA_MODELU,
    id: crypto.randomUUID(), // uuid – klucz w tabeli `projekty`
    nazwa,
    sekcje: [sekcja],
    wzorce: [],
    style: [], // style tekstu wspólne dla projektu
    tabele: [], // dane: { id, nazwa, kolumny: [nazwa], wiersze: [[tekst]] }
    serie: [], // powielanie: { id, nazwa, tabela, tryb, ile, uklad } – strona wskazuje serię polem `seria`
    strony: [nowaStrona('Strona 1', sekcja.id)],
    widok: null, // siatka i przyciąganie – uzupełniane w normalizuj()
    // Zasoby (obrazy, później czcionki). Obiekty obrazów odwołują się do nich
    // przez src = "zasob:<id>", dzięki czemu JSON projektu pozostaje lekki,
    // a zasoby mogą trafić do Supabase Storage.
    zasoby: {},
    zmieniono: new Date().toISOString(),
  };
}

// ---------- Widok: siatka i przyciąganie (ustawienia projektu) ----------

export const DOMYSLNY_WIDOK = {
  siatka_mm: 5, // krok siatki
  siatka: false, // czy siatkę widać
  do_siatki: false, // przyciąganie do siatki
  do_elementow: true, // przyciąganie do innych elementów i strzałki z odległościami
  linijki: true,
};

export function normalizujWidok(w) {
  const wynik = { ...DOMYSLNY_WIDOK, ...(w && typeof w === 'object' ? w : {}) };
  const krok = Number(wynik.siatka_mm);
  wynik.siatka_mm = Number.isFinite(krok) && krok >= 0.5 ? Math.min(100, krok) : DOMYSLNY_WIDOK.siatka_mm;
  for (const k of ['siatka', 'do_siatki', 'do_elementow', 'linijki']) wynik[k] = Boolean(wynik[k]);
  return wynik;
}

// ---------- Dane: tabele i serie ----------

export function nowaTabela(nazwa = 'Tabela', kolumny = ['kolumna_1'], wiersze = [['']]) {
  return { id: uid('t'), nazwa, kolumny, wiersze };
}

// Tabela zawsze jest prostokątna: każdy wiersz ma tyle komórek, ile jest kolumn,
// a wszystkie wartości są tekstem (plan 4.3). Nazwy kolumn są niepuste i różne.
export function normalizujTabele(t, i = 0) {
  const kolumny = [];
  for (const [k, surowa] of (Array.isArray(t?.kolumny) ? t.kolumny : []).entries()) {
    let nazwa = String(surowa ?? '').trim().replace(/[{}:\n]/g, ' ').trim() || `kolumna_${k + 1}`;
    for (let n = 2; kolumny.includes(nazwa); n += 1) nazwa = `${nazwa.replace(/_\d+$/, '')}_${n}`;
    kolumny.push(nazwa);
  }
  if (!kolumny.length) kolumny.push('kolumna_1');
  const wiersze = (Array.isArray(t?.wiersze) ? t.wiersze : []).map((w) => kolumny.map((_, k) => String((Array.isArray(w) ? w[k] : '') ?? '')));
  // Kolumny, w których wartości nie mogą się powtarzać (pilnowane w oknie danych i przed drukiem).
  const unikalne = (Array.isArray(t?.unikalne) ? t.unikalne : []).filter((k) => kolumny.includes(k));
  return { id: t?.id || uid('t'), nazwa: String(t?.nazwa || `Tabela ${i + 1}`), kolumny, wiersze, ...(unikalne.length ? { unikalne } : {}) };
}

export function nowaSeria(nazwa = 'Seria') {
  return { id: uid('se'), nazwa, tabela: null, tryb: 'tabela', ile: 12, uklad: 'szeroki' };
}

// Uzupełnia brakujące pola w projektach wczytanych z pliku lub z bazy
// i przenosi projekty ze starszych wersji modelu.
export function normalizuj(p) {
  if (!p || typeof p !== 'object') throw new Error('Plik nie zawiera projektu.');
  if (!Array.isArray(p.strony)) throw new Error('Brak listy stron w projekcie.');
  const wynik = { ...nowyProjekt(p.nazwa || 'Projekt'), ...p };
  wynik.zasoby = p.zasoby || {};
  for (const klucz of ['tabele', 'serie', 'style']) {
    if (!Array.isArray(wynik[klucz])) wynik[klucz] = [];
  }
  delete wynik.zrodla; // szkic z planu, nigdy nieużywane
  delete wynik.zakresy;
  wynik.tabele = wynik.tabele.map((t, i) => normalizujTabele(t, i));
  const idTabel = new Set(wynik.tabele.map((t) => t.id));
  wynik.serie = wynik.serie.map((s, i) => ({
    ...nowaSeria(`Seria ${i + 1}`),
    ...s,
    tabela: idTabel.has(s.tabela) ? s.tabela : null,
    tryb: s.tryb === 'stala' ? 'stala' : 'tabela',
    uklad: s.uklad === 'dlugi' ? 'dlugi' : 'szeroki',
    ile: Number.isFinite(s.ile) ? Math.min(2000, Math.max(1, Math.round(s.ile))) : 12,
  }));
  wynik.widok = normalizujWidok(p.widok);
  delete wynik.motywy; // zastąpione wzorcami
  delete wynik.uklad;

  wynik.wzorce = (Array.isArray(p.wzorce) ? p.wzorce : []).map((w, i) => ({
    ...nowyWzorzec(`Wzorzec ${i + 1}`),
    ...w,
    wydruk: normalizujWydruk(w.wydruk),
    obiekty: Array.isArray(w.obiekty) ? w.obiekty : [],
    lustro: Boolean(w.lustro),
  }));
  const idWzorcow = new Set(wynik.wzorce.map((w) => w.id));
  const tylkoIstniejace = (lista) => [...new Set(lista)].filter((id) => idWzorcow.has(id));

  const zrodloSekcji = Array.isArray(p.sekcje) && p.sekcje.length
    ? p.sekcje
    : [{ nazwa: 'Główna', wydruk: p.wydruk }]; // wersja 1: jeden format na projekt
  wynik.sekcje = zrodloSekcji.map((s, i) => {
    const sekcja = { ...nowaSekcja(`Sekcja ${i + 1}`), ...s, wydruk: normalizujWydruk(s.wydruk) };
    // wersja 2: jeden wzorzec na sekcję
    const lista = Array.isArray(s.wzorce) ? s.wzorce : (s.wzorzec ? [s.wzorzec] : []);
    sekcja.wzorce = tylkoIstniejace(lista);
    delete sekcja.wzorzec;
    if (!['pojedyncze', 'rozkladowki'].includes(sekcja.uklad)) sekcja.uklad = 'pojedyncze';
    if (!['prawa', 'lewa'].includes(sekcja.pierwsza)) sekcja.pierwsza = 'prawa';
    const n = s.numeracja || {};
    sekcja.numeracja = {
      tryb: ['ciagla', 'od', 'brak'].includes(n.tryb) ? n.tryb : 'ciagla',
      od: Number.isFinite(n.od) ? Math.max(0, Math.round(n.od)) : 1,
    };
    return sekcja;
  });
  delete wynik.wydruk;

  const idSekcji = new Set(wynik.sekcje.map((s) => s.id));
  wynik.strony = p.strony.map((s, i) => {
    const strona = {
      ...nowaStrona(`Strona ${i + 1}`),
      ...s,
      obiekty: Array.isArray(s.obiekty) ? s.obiekty : [],
    };
    if (!idSekcji.has(strona.sekcja)) strona.sekcja = wynik.sekcje[0].id;
    // wersja 2: strona.wzorzec = 'z_sekcji' | 'brak' | id
    if (Array.isArray(s.wzorce)) strona.wzorce = tylkoIstniejace(s.wzorce);
    else if (s.wzorce === WZORCE_Z_SEKCJI || s.wzorzec === undefined || s.wzorzec === WZORCE_Z_SEKCJI) strona.wzorce = WZORCE_Z_SEKCJI;
    else if (s.wzorzec === 'brak') strona.wzorce = [];
    else strona.wzorce = tylkoIstniejace([s.wzorzec]);
    delete strona.wzorzec;
    if (!wynik.serie.some((x) => x.id === strona.seria)) delete strona.seria;
    return strona;
  });
  if (wynik.strony.length === 0) wynik.strony.push(nowaStrona('Strona 1', wynik.sekcje[0].id));
  uporzadkujStrony(wynik);

  if (!/^[0-9a-f-]{36}$/i.test(String(wynik.id))) wynik.id = crypto.randomUUID();
  wynik.wersja = WERSJA_MODELU;
  return wynik;
}

// Strony są zawsze pogrupowane według kolejności sekcji (kolejność stron
// wewnątrz sekcji zostaje zachowana).
export function uporzadkujStrony(projekt) {
  const kolejnosc = new Map(projekt.sekcje.map((s, i) => [s.id, i]));
  projekt.strony = projekt.strony
    .map((s, i) => [s, i])
    .sort((a, b) => (kolejnosc.get(a[0].sekcja) - kolejnosc.get(b[0].sekcja)) || (a[1] - b[1]))
    .map(([s]) => s);
}

export const sekcjaStrony = (projekt, strona) => projekt.sekcje.find((s) => s.id === strona.sekcja) || projekt.sekcje[0];
export const stronySekcji = (projekt, sekcja) => projekt.strony.filter((s) => s.sekcja === sekcja.id);

// ---------- Rozkładówki ----------

// Łączy elementy lewej i prawej strony w jedną kolejność warstw rozkładówki.
// Kolejność wewnątrz każdej strony zostaje; o przeplocie decyduje pole `z`
// zapisane przy ostatniej edycji rozkładówki. Bez `z`: lewa strona pod prawą.
export function scalRozkladowke(lewe = [], prawe = []) {
  const wynik = [];
  let i = 0;
  let j = 0;
  const z = (o, zapas) => (Number.isFinite(o.z) ? o.z : zapas);
  while (i < lewe.length || j < prawe.length) {
    const zLewej = j >= prawe.length || (i < lewe.length && z(lewe[i], -Infinity) <= z(prawe[j], Infinity));
    if (zLewej) { wynik.push({ o: lewe[i], bok: 'lewa' }); i += 1; } else { wynik.push({ o: prawe[j], bok: 'prawa' }); j += 1; }
  }
  return wynik;
}

// Marginesy strony: w rozkładówce wewnętrzny jest przy grzbiecie.
// bok: 'lewa' | 'prawa' | null – z rozwiniętego ciągu (serie.js), bo powielone
// strony wcześniejszych serii przesuwają strony na przemian w lewo i w prawo.
export function marginesyStrony(projekt, strona, bok) {
  const { marginesy: m } = sekcjaStrony(projekt, strona).wydruk;
  if (bok === 'lewa') return { lewy: m.zewnetrzny, prawy: m.wewnetrzny, gora: m.gora, dol: m.dol, grzbiet: 'prawy' };
  return { lewy: m.wewnetrzny, prawy: m.zewnetrzny, gora: m.gora, dol: m.dol, grzbiet: bok ? 'lewy' : null };
}

export const marginesyWzorca = (wzorzec) => {
  const m = wzorzec.wydruk.marginesy;
  return { lewy: m.wewnetrzny, prawy: m.zewnetrzny, gora: m.gora, dol: m.dol, grzbiet: null };
};

// ---------- Wzorce ----------

// Wzorce obowiązujące na stronie, w kolejności listy wzorców projektu
// (pierwszy na liście leży najniżej).
export function wzorceStrony(projekt, strona) {
  const ids = strona.wzorce === WZORCE_Z_SEKCJI ? sekcjaStrony(projekt, strona).wzorce : strona.wzorce;
  const zbior = new Set(ids || []);
  return projekt.wzorce.filter((w) => zbior.has(w.id));
}

export const stronyZWzorcem = (projekt, idWzorca) => projekt.strony.filter((s) => wzorceStrony(projekt, s).some((w) => w.id === idWzorca));

// Tło strony: własne albo z ostatniego wzorca, który je ma.
export function tloStrony(projekt, strona) {
  if (strona.tlo) return strona.tlo;
  const zTlem = wzorceStrony(projekt, strona).filter((w) => w.tlo);
  return zTlem.length ? zTlem.at(-1).tlo : '#ffffff';
}

// ---------- Kopie ----------

function odnowIdentyfikatory(obiekty) {
  obiekty.forEach((o) => {
    o.id = uid('o');
    if (Array.isArray(o.objects)) odnowIdentyfikatory(o.objects);
  });
}

// Głęboka kopia strony z nowymi identyfikatorami obiektów.
export function kopiujStrone(strona, nazwa) {
  const kopia = JSON.parse(JSON.stringify(strona));
  kopia.id = uid('s');
  kopia.nazwa = nazwa;
  odnowIdentyfikatory(kopia.obiekty);
  return kopia;
}

export function kopiujWzorzec(wzorzec, nazwa) {
  const kopia = JSON.parse(JSON.stringify(wzorzec));
  kopia.id = uid('wz');
  kopia.nazwa = nazwa;
  odnowIdentyfikatory(kopia.obiekty);
  return kopia;
}

// Kopia całego projektu pod nowym identyfikatorem (np. kalendarz na kolejny rok).
export function kopiujProjekt(projekt, nazwa) {
  const kopia = JSON.parse(JSON.stringify(projekt));
  kopia.id = crypto.randomUUID();
  kopia.nazwa = nazwa;
  kopia.zmieniono = new Date().toISOString();
  delete kopia.wersja_chmury;
  // Obrazy trzeba wysłać na konto jeszcze raz, pod nowym projektem.
  for (const z of Object.values(kopia.zasoby || {})) delete z.sciezka;
  return kopia;
}
