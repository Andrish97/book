// Miniatury obrazów projektu (okno „Obrazy projektu”) zapisane na urządzeniu.
//
// Zrobienie miniatury dużego zdjęcia to rozpakowanie całego pliku – przy kilkudziesięciu zdjęciach kilka
// sekund przy pierwszym otwarciu okna. Gotowa miniatura (najwyżej 320 px, WebP) trafia do osobnej bazy
// IndexedDB pod skrótem treści pliku (albo ścieżką pliku na koncie – plik pod danym identyfikatorem się
// nie zmienia), więc kolejne otwarcia, także po odświeżeniu strony, są natychmiastowe. Baza nie należy do
// projektu: nie jest wysyłana na konto ani zapisywana w pliku, można ją w każdej chwili wyczyścić.

const BAZA = 'seriodruk-miniatury';
const MAGAZYN = 'miniatury';
const MAKS_WPISOW = 600; // ok. 10–15 MB; najdawniej używane odpadają

let polaczenie = null;
function otworz() {
  if (!polaczenie) {
    polaczenie = new Promise((ok, blad) => {
      const req = indexedDB.open(BAZA, 1);
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore(MAGAZYN, { keyPath: 'klucz' });
        s.createIndex('uzyto', 'uzyto');
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => blad(req.error);
    }).catch((e) => { polaczenie = null; throw e; });
  }
  return polaczenie;
}

async function transakcja(tryb, fn) {
  const db = await otworz();
  return new Promise((ok, blad) => {
    const tx = db.transaction(MAGAZYN, tryb);
    const wynik = fn(tx.objectStore(MAGAZYN));
    tx.oncomplete = () => ok(wynik instanceof IDBRequest ? wynik.result : wynik);
    tx.onerror = () => blad(tx.error);
    tx.onabort = () => blad(tx.error);
  });
}

// { blob, szer, wys } albo null.
export async function wczytajMiniature(klucz) {
  if (!klucz) return null;
  try {
    const w = await transakcja('readonly', (m) => m.get(klucz));
    if (!w) return null;
    transakcja('readwrite', (m) => m.put({ ...w, uzyto: Date.now() })).catch(() => {});
    return w;
  } catch { return null; }
}

export async function zapiszMiniature(klucz, { blob, szer, wys }) {
  if (!klucz || !blob) return;
  try {
    await transakcja('readwrite', (m) => m.put({ klucz, blob, szer, wys, uzyto: Date.now() }));
    const ile = await transakcja('readonly', (m) => m.count());
    if (ile > MAKS_WPISOW) {
      await transakcja('readwrite', (m) => {
        const req = m.index('uzyto').openCursor();
        let doUsuniecia = ile - MAKS_WPISOW;
        req.onsuccess = () => {
          const k = req.result;
          if (!k || doUsuniecia <= 0) return;
          k.delete();
          doUsuniecia -= 1;
          k.continue();
        };
      });
    }
  } catch { /* bez magazynu miniatura żyje do końca sesji */ }
}
