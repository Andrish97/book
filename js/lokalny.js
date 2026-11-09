// Lokalna pamięć projektów w IndexedDB (sekcja 9: praca przy słabym połączeniu).

const BAZA = 'publisher-lite';
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

async function transakcja(tryb, fn) {
  const db = await otworz();
  return new Promise((ok, blad) => {
    const tx = db.transaction(MAGAZYN, tryb);
    const wynik = fn(tx.objectStore(MAGAZYN));
    tx.oncomplete = () => { db.close(); ok(wynik?.result ?? wynik); };
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
