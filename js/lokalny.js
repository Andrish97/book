// Lokalna pamięć projektów w IndexedDB (sekcja 9: praca przy słabym połączeniu).

const BAZA = 'seriodruk';
const MAGAZYN = 'projekty';

function otworz() {
  return new Promise((ok, blad) => {
    const req = indexedDB.open(BAZA, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MAGAZYN)) {
        const m = db.createObjectStore(MAGAZYN, { keyPath: 'id' });
        m.createIndex('zmieniono', 'zmieniono');
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => blad(req.error);
  });
}

// Jednorazowe przeniesienie projektów z bazy o dawnej nazwie aplikacji.
const STARA_BAZA = 'publisher-lite';
let przeniesienie = null;
function przeniesStaraBaze() {
  if (!przeniesienie) {
    przeniesienie = (async () => {
      if (!indexedDB.databases) return;
      const bazy = await indexedDB.databases();
      if (!bazy.some((b) => b.name === STARA_BAZA)) return;
      const rekordy = await new Promise((ok) => {
        const req = indexedDB.open(STARA_BAZA);
        req.onerror = () => ok([]);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(MAGAZYN)) { db.close(); ok([]); return; }
          const wszystkie = db.transaction(MAGAZYN, 'readonly').objectStore(MAGAZYN).getAll();
          wszystkie.onsuccess = () => { db.close(); ok(wszystkie.result || []); };
          wszystkie.onerror = () => { db.close(); ok([]); };
        };
      });
      const db = await otworz();
      await new Promise((ok) => {
        const tx = db.transaction(MAGAZYN, 'readwrite');
        for (const r of rekordy) tx.objectStore(MAGAZYN).put(r);
        tx.oncomplete = tx.onerror = tx.onabort = () => { db.close(); ok(); };
      });
      indexedDB.deleteDatabase(STARA_BAZA);
    })().catch(() => {});
  }
  return przeniesienie;
}

async function transakcja(tryb, fn) {
  await przeniesStaraBaze();
  const db = await otworz();
  return new Promise((ok, blad) => {
    const tx = db.transaction(MAGAZYN, tryb);
    const wynik = fn(tx.objectStore(MAGAZYN));
    tx.oncomplete = () => { db.close(); ok(wynik instanceof IDBRequest ? wynik.result : wynik); };
    tx.onerror = () => { db.close(); blad(tx.error); };
    tx.onabort = () => { db.close(); blad(tx.error); };
  });
}

// Rekord: { id, wlasciciel, nazwa, zmieniono, miniatura, projekt, doSynchronizacji }
// wlasciciel: id użytkownika Supabase albo 'lokalny' (praca bez konta).
export function zapiszLokalnie(projekt, wlasciciel, doSynchronizacji = true) {
  const rekord = {
    id: projekt.id,
    wlasciciel,
    miniatura: projekt.miniatura || null,
    nazwa: projekt.nazwa,
    zmieniono: projekt.zmieniono,
    projekt,
    doSynchronizacji,
  };
  return transakcja('readwrite', (m) => m.put(rekord));
}

export function wczytajLokalnie(id) {
  return transakcja('readonly', (m) => m.get(id));
}

export async function listaLokalnych(wlasciciel) {
  const wszystkie = await transakcja('readonly', (m) => m.getAll());
  return (wszystkie || [])
    .filter((r) => r.wlasciciel === wlasciciel)
    .map(({ id, nazwa, zmieniono, miniatura, doSynchronizacji }) => ({ id, nazwa, zmieniono, miniatura, doSynchronizacji }))
    .sort((a, b) => (b.zmieniono || '').localeCompare(a.zmieniono || ''));
}

export function usunLokalnie(id) {
  return transakcja('readwrite', (m) => m.delete(id));
}

export async function oznaczZsynchronizowany(id, zmieniono) {
  const rekord = await wczytajLokalnie(id);
  // Nie zdejmujemy flagi, jeśli w międzyczasie pojawiła się nowsza zmiana.
  if (rekord && rekord.zmieniono === zmieniono) {
    rekord.doSynchronizacji = false;
    await transakcja('readwrite', (m) => m.put(rekord));
  }
}

// Usuwa z tej przeglądarki wszystkie projekty danego właściciela (po usunięciu konta).
export async function usunLokalneWlasciciela(wlasciciel) {
  const wszystkie = await transakcja('readonly', (m) => m.getAll());
  const moje = (wszystkie || []).filter((r) => r.wlasciciel === wlasciciel);
  if (!moje.length) return;
  await transakcja('readwrite', (m) => { for (const r of moje) m.delete(r.id); });
}
