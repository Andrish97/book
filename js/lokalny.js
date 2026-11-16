// Lokalna pamięć projektów w IndexedDB (sekcja 9: praca przy słabym połączeniu).
// Rekord projektu nie zawiera oryginałów obrazów – leżą w osobnym magazynie (js/zasoby.js),
// więc zapis po każdej zmianie przepisuje tylko układ stron, nie megabajty zdjęć.

import { odlozZasoby, usunPlikiProjektu } from './zasoby.js';

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
// Zapis przy zamykaniu karty (#160): zwykły zapis ma po drodze kilka kroków asynchronicznych (otwarcie bazy,
// odłożenie obrazów) i strona potrafi zniknąć wcześniej. Tu połączenie jest otwarte zawczasu, a rekord trafia do
// transakcji od razu – przeglądarka kończy transakcję rozpoczętą przy zamykaniu strony. Tylko gdy w projekcie nie
// ma obrazów do odłożenia (wtedy zwykły zapis i tak nic więcej nie robi); inaczej zwraca false.
let polaczenie = null;
export function przygotujSzybkiZapis() {
  if (polaczenie || typeof indexedDB === 'undefined') return;
  otworz().then((db) => {
    polaczenie = db;
    db.onversionchange = () => { db.close(); polaczenie = null; };
    db.onclose = () => { polaczenie = null; };
  }).catch(() => {});
}
export function zapiszLokalnieOdRazu(projekt, wlasciciel) {
  if (!polaczenie || Object.values(projekt?.zasoby || {}).some((z) => z?.dataUrl)) return false;
  try {
    const tx = polaczenie.transaction(MAGAZYN, 'readwrite');
    tx.objectStore(MAGAZYN).put({ id: projekt.id, wlasciciel, miniatura: projekt.miniatura || null, nazwa: projekt.nazwa, zmieniono: projekt.zmieniono, projekt, doSynchronizacji: true });
    // Zatwierdzenie od razu, bez czekania na koniec bieżącego zadania strony – przy zamykaniu karty liczy się
    // każda chwila: transakcja niezatwierdzona w chwili zniszczenia strony przepada (#184).
    tx.commit?.();
    return true;
  } catch { return false; }
}

export async function zapiszLokalnie(projekt, wlasciciel, doSynchronizacji = true) {
  // Nowe obrazy trafiają do magazynu plików, a z projektu znika ich treść. Gdyby magazyn zawiódł
  // (np. brak miejsca), obraz zostaje w projekcie jak dawniej – zapis nie może przepaść.
  try { await odlozZasoby(projekt); } catch { /* treść obrazu zostaje w rekordzie projektu */ }
  // Rekord powstaje dopiero w chwili zapisu (po krokach asynchronicznych): projekt mógł się w tym czasie zmienić
  // i zostać już zapisany (np. przy zamykaniu karty). Znacznik „do wysłania” liczony przed tymi krokami
  // nadpisywał wtedy nowszy zapis fałszem i zmiana zostawała tylko na urządzeniu (#184) – stąd funkcja.
  return transakcja('readwrite', (m) => m.put({
    id: projekt.id,
    wlasciciel,
    miniatura: projekt.miniatura || null,
    nazwa: projekt.nazwa,
    zmieniono: projekt.zmieniono,
    projekt,
    doSynchronizacji: Boolean(typeof doSynchronizacji === 'function' ? doSynchronizacji() : doSynchronizacji),
  }));
}

export function wczytajLokalnie(id) {
  return transakcja('readonly', (m) => m.get(id));
}

export async function listaLokalnych(wlasciciel) {
  const wszystkie = await transakcja('readonly', (m) => m.getAll());
  return (wszystkie || [])
    .filter((r) => r.wlasciciel === wlasciciel)
    .map(({ id, nazwa, zmieniono, miniatura, doSynchronizacji, projekt }) => ({ id, nazwa, zmieniono, miniatura, doSynchronizacji, udostepniony: Boolean(projekt?.udostepnienie), wspolpraca: projekt?.wspolpraca_chmury || null, bylNaKoncie: Boolean(projekt?.wersja_chmury) }))
    .sort((a, b) => (b.zmieniono || '').localeCompare(a.zmieniono || ''));
}

// Ścieżki plików na koncie, na które wskazują projekty zapisane w tej przeglądarce (także niewysłane) –
// sprzątanie konta ich nie rusza (js/miejsce.js).
export async function sciezkiLokalne() {
  const wszystkie = await transakcja('readonly', (m) => m.getAll());
  const wynik = new Set();
  for (const r of wszystkie || []) for (const z of Object.values(r.projekt?.zasoby || {})) if (z?.sciezka) wynik.add(z.sciezka);
  return wynik;
}

export async function usunLokalnie(id) {
  await transakcja('readwrite', (m) => m.delete(id));
  try { await usunPlikiProjektu(id); } catch { /* sprzątanie plików nie może zepsuć usuwania projektu */ }
}

export async function oznaczZsynchronizowany(id, zmieniono) {
  // Odczyt i zapis w JEDNEJ transakcji (#184): wcześniej rekord był czytany w jednej, a zapisywany w drugiej –
  // nowszy zapis, który wpadł pomiędzy (np. zapis przy zamykaniu karty), był nadpisywany starszą kopią projektu.
  // Nie zdejmujemy flagi, jeśli w międzyczasie pojawiła się nowsza zmiana.
  await transakcja('readwrite', (m) => {
    const odczyt = m.get(id);
    odczyt.onsuccess = () => {
      const rekord = odczyt.result;
      if (rekord && rekord.zmieniono === zmieniono && rekord.doSynchronizacji) {
        rekord.doSynchronizacji = false;
        m.put(rekord);
      }
    };
    return undefined;
  });
}

// Usuwa z tej przeglądarki wszystkie projekty danego właściciela (po usunięciu konta).
export async function usunLokalneWlasciciela(wlasciciel) {
  const wszystkie = await transakcja('readonly', (m) => m.getAll());
  const moje = (wszystkie || []).filter((r) => r.wlasciciel === wlasciciel);
  if (!moje.length) return;
  await transakcja('readwrite', (m) => { for (const r of moje) m.delete(r.id); });
  for (const r of moje) { try { await usunPlikiProjektu(r.id); } catch { /* jw. */ } }
}
