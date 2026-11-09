// Model projektu (sekcja 3 planu). Wszystkie wymiary w milimetrach.
//
// Wersja 2: projekt dzieli się na sekcje (np. okładka, środek), każda z
// własnym formatem, spadem i marginesami. Wzorce (strony wzorcowe) to osobne
// strony ze wspólnymi elementami – można je podpiąć do sekcji (domyślnie dla
// wszystkich jej stron) albo do pojedynczych stron.

export const WERSJA_MODELU = 2;

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

// Ustawienie wzorca na stronie: brać z sekcji, konkretny wzorzec albo żaden.
export const WZORZEC_Z_SEKCJI = 'z_sekcji';
export const BEZ_WZORCA = 'brak';

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
    marginesy_mm: 10,
    znaki_ciecia: true,
  };
}

export function nowaSekcja(nazwa = 'Sekcja', wydruk = domyslnyWydruk()) {
  return { id: uid('sek'), nazwa, wydruk: { ...wydruk }, wzorzec: null };
}

export function nowyWzorzec(nazwa = 'Wzorzec', wydruk = domyslnyWydruk()) {
  return { id: uid('wz'), nazwa, wydruk: { ...wydruk }, obiekty: [], tlo: '#ffffff' };
}

export function nowaStrona(nazwa = 'Strona', sekcja = null) {
  return { id: uid('s'), nazwa, sekcja, wzorzec: WZORZEC_Z_SEKCJI, obiekty: [], tlo: '#ffffff' };
}

export function nowyProjekt(nazwa = 'Nowy projekt', wydruk = domyslnyWydruk()) {
  const sekcja = nowaSekcja('Główna', wydruk);
  return {
    wersja: WERSJA_MODELU,
    id: crypto.randomUUID(), // uuid – klucz w tabeli `projekty`
    nazwa,
    uklad: 'pojedyncza',
    sekcje: [sekcja],
    wzorce: [],
    zrodla: [],
    tabele: [],
    strony: [nowaStrona('Strona 1', sekcja.id)],
    zakresy: [],
    motywy: [],
    // Zasoby (obrazy, później czcionki). Obiekty obrazów odwołują się do nich
    // przez src = "zasob:<id>", dzięki czemu JSON projektu pozostaje lekki,
    // a zasoby mogą trafić do Supabase Storage.
    zasoby: {},
    zmieniono: new Date().toISOString(),
  };
}

// Uzupełnia brakujące pola w projektach wczytanych z pliku lub z bazy
// i przenosi projekty z wersji 1 (jeden wspólny format) na sekcje.
export function normalizuj(p) {
  if (!p || typeof p !== 'object') throw new Error('Plik nie zawiera projektu.');
  if (!Array.isArray(p.strony)) throw new Error('Brak listy stron w projekcie.');
  const wynik = { ...nowyProjekt(p.nazwa || 'Projekt'), ...p };
  wynik.zasoby = p.zasoby || {};
  for (const klucz of ['zrodla', 'tabele', 'zakresy', 'motywy']) {
    if (!Array.isArray(wynik[klucz])) wynik[klucz] = [];
  }

  if (!Array.isArray(p.sekcje) || p.sekcje.length === 0) {
    wynik.sekcje = [nowaSekcja('Główna', { ...domyslnyWydruk(), ...(p.wydruk || {}) })];
  } else {
    wynik.sekcje = p.sekcje.map((s, i) => ({
      ...nowaSekcja(`Sekcja ${i + 1}`),
      ...s,
      wydruk: { ...domyslnyWydruk(), ...(s.wydruk || {}) },
    }));
  }
  delete wynik.wydruk;

  wynik.wzorce = (Array.isArray(p.wzorce) ? p.wzorce : []).map((w, i) => ({
    ...nowyWzorzec(`Wzorzec ${i + 1}`),
    ...w,
    wydruk: { ...domyslnyWydruk(), ...(w.wydruk || {}) },
    obiekty: Array.isArray(w.obiekty) ? w.obiekty : [],
  }));
  const idWzorcow = new Set(wynik.wzorce.map((w) => w.id));
  for (const s of wynik.sekcje) if (s.wzorzec && !idWzorcow.has(s.wzorzec)) s.wzorzec = null;

  const idSekcji = new Set(wynik.sekcje.map((s) => s.id));
  wynik.strony = p.strony.map((s, i) => {
    const strona = {
      ...nowaStrona(`Strona ${i + 1}`),
      ...s,
      obiekty: Array.isArray(s.obiekty) ? s.obiekty : [],
    };
    if (!idSekcji.has(strona.sekcja)) strona.sekcja = wynik.sekcje[0].id;
    if (strona.wzorzec !== WZORZEC_Z_SEKCJI && strona.wzorzec !== BEZ_WZORCA && !idWzorcow.has(strona.wzorzec)) {
      strona.wzorzec = WZORZEC_Z_SEKCJI;
    }
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

// Wzorzec, który faktycznie obowiązuje na stronie (albo null).
export function wzorzecStrony(projekt, strona) {
  if (strona.wzorzec === BEZ_WZORCA) return null;
  const id = strona.wzorzec === WZORZEC_Z_SEKCJI ? sekcjaStrony(projekt, strona).wzorzec : strona.wzorzec;
  return projekt.wzorce.find((w) => w.id === id) || null;
}

// Zmienne dostępne w tekstach wzorca: {nr}, {nr_w_sekcji}, {sekcja}, {strona}, {liczba_stron}.
export function zmienneStrony(projekt, strona) {
  const i = projekt.strony.indexOf(strona);
  const wSekcji = projekt.strony.filter((s) => s.sekcja === strona.sekcja);
  return {
    nr: String(i + 1),
    nr_w_sekcji: String(wSekcji.indexOf(strona) + 1),
    sekcja: sekcjaStrony(projekt, strona).nazwa,
    strona: strona.nazwa,
    liczba_stron: String(projekt.strony.length),
  };
}

// Strony, na których pojawia się dany wzorzec.
export const stronyZWzorcem = (projekt, idWzorca) => projekt.strony.filter((s) => wzorzecStrony(projekt, s)?.id === idWzorca);

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
