// „Moje czcionki”: pliki czcionek wgrane w którymkolwiek projekcie, dostępne we wszystkich.
//
// Projekt nadal nosi własne kopie plików (jest samodzielny: działa na innym
// urządzeniu, w pliku .seriodruk i u drukarni). Tutaj leży tylko podręczny
// zbiór, z którego czcionkę dodaje się do następnego projektu jednym kliknięciem.
//
// Zbiór jest w tej przeglądarce (IndexedDB), a przy pracy z kontem także na
// koncie – w prywatnym folderze plików użytkownika, obok zasobów projektów.
// Usunięcie zostawia znacznik (bez pliku), żeby czcionka nie wróciła sama
// z innego urządzenia ani przy otwarciu starego projektu.

import { zarejestrujCzcionkiProjektu } from './czcionki.js';

const BAZA = 'seriodruk-czcionki';
const MAGAZYN = 'czcionki';

export const kluczOdmiany = (c) => `${c.rodzina}|${c.waga}|${c.kursywa ? 1 : 0}`;

function otworz() {
  return new Promise((ok, blad) => {
    const req = indexedDB.open(BAZA, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(MAGAZYN, { keyPath: 'id' }); };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => blad(req.error);
  });
}

async function transakcja(tryb, fn) {
  const db = await otworz();
  return new Promise((ok, blad) => {
    const tx = db.transaction(MAGAZYN, tryb);
    const wynik = fn(tx.objectStore(MAGAZYN));
    tx.oncomplete = () => { db.close(); ok(wynik instanceof IDBRequest ? wynik.result : wynik); };
    tx.onerror = tx.onabort = () => { db.close(); blad(tx.error); };
  });
}

// Rekord: { id: właściciel|klucz, wlasciciel, klucz, rodzina, waga, kursywa, nazwa, dataUrl, plik?, usunieta? }
async function rekordy(wlasciciel) {
  const wszystkie = await transakcja('readonly', (m) => m.getAll());
  return (wszystkie || []).filter((r) => r.wlasciciel === wlasciciel);
}
const zapisz = (lista) => (lista.length ? transakcja('readwrite', (m) => { for (const r of lista) m.put(r); }) : null);

const rekord = (wlasciciel, c, zasob) => ({
  id: `${wlasciciel}|${kluczOdmiany(c)}`, wlasciciel, klucz: kluczOdmiany(c),
  rodzina: c.rodzina, waga: c.waga, kursywa: Boolean(c.kursywa), nazwa: zasob.nazwa || 'czcionka', dataUrl: zasob.dataUrl,
});

// Czcionki ze zbioru (bez usuniętych), ułożone rodzinami.
export async function mojeCzcionki(wlasciciel) {
  return (await rekordy(wlasciciel)).filter((r) => !r.usunieta)
    .sort((a, b) => a.rodzina.localeCompare(b.rodzina, 'pl') || a.waga - b.waga || a.kursywa - b.kursywa);
}

// Po wgraniu plików do projektu: trafiają też do zbioru (ponowne wgranie przywraca usuniętą).
export async function zapamietaj(wlasciciel, projekt, wpisy) {
  await zapisz(wpisy.filter((c) => projekt.zasoby?.[c.id]?.dataUrl).map((c) => rekord(wlasciciel, c, projekt.zasoby[c.id])));
}

// Przy otwarciu projektu: jego czcionki, których zbiór jeszcze nie zna (i których z niego nie usunięto).
// Zwraca liczbę dopisanych.
export async function poznaj(wlasciciel, projekt) {
  const czcionki = (projekt?.czcionki || []).filter((c) => projekt.zasoby?.[c.id]?.dataUrl);
  if (!czcionki.length) return 0;
  const znane = new Set((await rekordy(wlasciciel)).map((r) => r.klucz));
  const nowe = czcionki.filter((c) => !znane.has(kluczOdmiany(c)));
  await zapisz(nowe.map((c) => rekord(wlasciciel, c, projekt.zasoby[c.id])));
  return nowe.length;
}

// Usuwa ze zbioru rodzinę albo jedną jej odmianę (projekty, które jej używają, zachowują swoje kopie).
export async function zapomnij(wlasciciel, rodzina, klucz = null) {
  const moje = (await rekordy(wlasciciel)).filter((r) => r.rodzina === rodzina && !r.usunieta && (!klucz || r.klucz === klucz));
  await zapisz(moje.map(({ dataUrl, ...r }) => ({ ...r, usunieta: true })));
}

// Kopiuje rodzinę ze zbioru do projektu. Zwraca liczbę dodanych odmian.
export async function dodajRodzineDoProjektu(wlasciciel, projekt, rodzina, uid) {
  const odmiany = (await mojeCzcionki(wlasciciel)).filter((r) => r.rodzina === rodzina);
  projekt.czcionki = projekt.czcionki || [];
  let dodane = 0;
  for (const r of odmiany) {
    if (projekt.czcionki.some((c) => kluczOdmiany(c) === r.klucz)) continue;
    const id = uid('cz');
    projekt.zasoby[id] = { nazwa: r.nazwa, dataUrl: r.dataUrl };
    projekt.czcionki.push({ id, rodzina: r.rodzina, waga: r.waga, kursywa: r.kursywa });
    dodane += 1;
  }
  if (dodane) await zarejestrujCzcionkiProjektu(projekt);
  return dodane;
}

// Rodziny ze zbioru, których w projekcie jeszcze nie ma.
export async function rodzinySpozaProjektu(wlasciciel, projekt) {
  const wProjekcie = new Set((projekt?.czcionki || []).map((c) => c.rodzina));
  return [...new Set((await mojeCzcionki(wlasciciel)).map((r) => r.rodzina))].filter((n) => !wProjekcie.has(n));
}

const naDataUrl = (blob) => new Promise((ok, blad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => blad(r.error); r.readAsDataURL(blob); });

// Uzgadnia zbiór z kontem w obie strony. `konto` – { spis(), zapiszSpis(spis), wyslij(plik, blob),
// pobierz(plik), usun([pliki]) } z js/chmura.js. Zwraca true, gdy na urządzeniu coś przybyło albo ubyło.
// Spis na koncie: { czcionki: [{ klucz, rodzina, waga, kursywa, nazwa, plik }], usuniete: [klucz] }.
export async function uzgodnijZKontem(wlasciciel, konto, uid) {
  const spis = await konto.spis(); // rzuca, gdy nie ma połączenia – wtedy niczego nie ruszamy
  const lokalne = new Map((await rekordy(wlasciciel)).map((r) => [r.klucz, r]));
  const naKoncie = new Map((spis.czcionki || []).map((c) => [c.klucz, c]));
  const usuniete = new Set(spis.usuniete || []);
  let zmianaTu = false;
  let zmianaTam = false;

  // Usunięte tutaj → znikają z konta; usunięte na koncie → znikają tutaj.
  for (const r of lokalne.values()) {
    if (r.usunieta && !usuniete.has(r.klucz)) { usuniete.add(r.klucz); zmianaTam = true; }
  }
  for (const klucz of usuniete) {
    const r = lokalne.get(klucz);
    if (r && !r.usunieta) {
      const { dataUrl, ...reszta } = r;
      await zapisz([{ ...reszta, usunieta: true }]);
      lokalne.set(klucz, { ...reszta, usunieta: true });
      zmianaTu = true;
    }
    const c = naKoncie.get(klucz);
    if (c) { await konto.usun([c.plik]); naKoncie.delete(klucz); zmianaTam = true; }
  }
  // Są tutaj, nie ma ich na koncie → wysyłka.
  for (const r of lokalne.values()) {
    if (r.usunieta || naKoncie.has(r.klucz)) continue;
    const plik = uid('cz');
    await konto.wyslij(plik, await (await fetch(r.dataUrl)).blob());
    naKoncie.set(r.klucz, { klucz: r.klucz, rodzina: r.rodzina, waga: r.waga, kursywa: r.kursywa, nazwa: r.nazwa, plik });
    zmianaTam = true;
  }
  // Są na koncie, nie ma ich tutaj → pobranie.
  for (const c of naKoncie.values()) {
    if (lokalne.has(c.klucz)) continue;
    const dataUrl = await naDataUrl(await konto.pobierz(c.plik));
    await zapisz([{ ...rekord(wlasciciel, c, { nazwa: c.nazwa, dataUrl }) }]);
    zmianaTu = true;
  }
  if (zmianaTam) await konto.zapiszSpis({ czcionki: [...naKoncie.values()], usuniete: [...usuniete] });
  return zmianaTu;
}
