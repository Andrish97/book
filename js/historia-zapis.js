// Historia cofania zapisana na urządzeniu – żeby „Cofnij” działało także po zamknięciu i ponownym
// otwarciu projektu. Osobna baza IndexedDB (nie rusza bazy projektów z js/lokalny.js). Rekord:
// { klucz: 'konto|projekt', wlasciciel, projekt, wersja_chmury, zapisano, historia: Historia.doZapisu() }.

const BAZA = 'seriodruk-historia';
const MAGAZYN = 'historie';

function otworz() {
  return new Promise((ok, blad) => {
    const req = indexedDB.open(BAZA, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MAGAZYN)) db.createObjectStore(MAGAZYN, { keyPath: 'klucz' });
    };
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
    tx.onerror = () => { db.close(); blad(tx.error); };
    tx.onabort = () => { db.close(); blad(tx.error); };
  });
}

const klucz = (wlasciciel, id) => `${wlasciciel}|${id}`;

export function zapiszHistorie(wlasciciel, projekt, historia) {
  return transakcja('readwrite', (m) => m.put({
    klucz: klucz(wlasciciel, projekt.id),
    wlasciciel,
    projekt: projekt.id,
    wersja_chmury: projekt.wersja_chmury ?? null,
    zapisano: new Date().toISOString(),
    historia,
  }));
}

export function wczytajHistorie(wlasciciel, id) {
  return transakcja('readonly', (m) => m.get(klucz(wlasciciel, id)));
}

// Usuwa rekordy spełniające warunek.
async function usunGdzie(warunek) {
  await transakcja('readwrite', (m) => {
    const req = m.openCursor();
    req.onsuccess = () => {
      const k = req.result;
      if (!k) return;
      if (warunek(k.value)) k.delete();
      k.continue();
    };
  });
}

// Historia projektu (każdego konta na tym urządzeniu) i wszystkie historie konta.
export const usunHistorie = (id) => usunGdzie((r) => r.projekt === id).catch(() => {});
export const usunHistorieWlasciciela = (wlasciciel) => usunGdzie((r) => r.wlasciciel === wlasciciel).catch(() => {});
