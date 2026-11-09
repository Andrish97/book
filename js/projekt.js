// Model projektu (sekcja 3 planu). Wszystkie wymiary w milimetrach.

export const WERSJA_MODELU = 1;

export const FORMATY = {
  A4: [210, 297],
  A5: [148, 210],
  A6: [105, 148],
  B5: [176, 250],
  'Kwadrat 210': [210, 210],
};

export const MM_NA_PT = 25.4 / 72;
export const ptNaMm = (pt) => pt * MM_NA_PT;
export const mmNaPt = (mm) => mm / MM_NA_PT;

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

export function nowaStrona(nazwa = 'Strona') {
  return { id: uid('s'), nazwa, obiekty: [], tlo: '#ffffff' };
}

export function nowyProjekt(nazwa = 'Nowy projekt') {
  return {
    wersja: WERSJA_MODELU,
    id: crypto.randomUUID(), // uuid – klucz w tabeli `projekty`
    nazwa,
    uklad: 'pojedyncza',
    wydruk: domyslnyWydruk(),
    zrodla: [],
    tabele: [],
    strony: [nowaStrona('Strona 1')],
    zakresy: [],
    motywy: [],
    // Zasoby (obrazy, później czcionki). Obiekty obrazów odwołują się do nich
    // przez src = "zasob:<id>", dzięki czemu JSON projektu pozostaje lekki,
    // a zasoby mogą trafić do Supabase Storage.
    zasoby: {},
    zmieniono: new Date().toISOString(),
  };
}

// Uzupełnia brakujące pola w projektach wczytanych z pliku lub z bazy.
export function normalizuj(p) {
  if (!p || typeof p !== 'object') throw new Error('Plik nie zawiera projektu.');
  if (!Array.isArray(p.strony)) throw new Error('Brak listy stron w projekcie.');
  const wynik = { ...nowyProjekt(p.nazwa || 'Projekt'), ...p };
  wynik.wydruk = { ...domyslnyWydruk(), ...(p.wydruk || {}) };
  wynik.zasoby = p.zasoby || {};
  for (const klucz of ['zrodla', 'tabele', 'zakresy', 'motywy']) {
    if (!Array.isArray(wynik[klucz])) wynik[klucz] = [];
  }
  wynik.strony = p.strony.map((s, i) => ({
    ...nowaStrona(`Strona ${i + 1}`),
    ...s,
    obiekty: Array.isArray(s.obiekty) ? s.obiekty : [],
  }));
  if (wynik.strony.length === 0) wynik.strony.push(nowaStrona('Strona 1'));
  if (!/^[0-9a-f-]{36}$/i.test(String(wynik.id))) wynik.id = crypto.randomUUID();
  wynik.wersja = WERSJA_MODELU;
  return wynik;
}

// Głęboka kopia strony z nowymi identyfikatorami obiektów.
export function kopiujStrone(strona, nazwa) {
  const kopia = JSON.parse(JSON.stringify(strona));
  kopia.id = uid('s');
  kopia.nazwa = nazwa;
  const odnow = (obiekty) => obiekty.forEach((o) => {
    o.id = uid('o');
    if (Array.isArray(o.objects)) odnow(o.objects);
  });
  odnow(kopia.obiekty);
  return kopia;
}
