// Miniatury stron i wzorców (panel stron) zapisane na urządzeniu (#193).
//
// Przy każdym otwarciu projektu panel rysował miniatury wszystkich stron od nowa – przy kilkuset stronach
// to długie sekundy z paskiem „Miniatury stron: x z N”. Teraz gotowa miniatura trafia do osobnej bazy
// IndexedDB razem z odciskiem wszystkiego, od czego zależy jej wygląd (strona, wzorce, style, tabele, serie,
// czcionki, sekcje, pliki obrazów, numer strony, tekst płynący z innych stron). Przy otwarciu miniatura
// z bazy jest użyta tylko wtedy, gdy odcisk się zgadza – zmieniona strona rysuje się od nowa.
// Baza nie należy do projektu (nie idzie na konto ani do pliku); najdawniej używane wpisy odpadają.

const BAZA = 'makietka-miniatury-stron';
const MAGAZYN = 'miniatury';
const MAKS_WPISOW = 4000; // ok. 40–80 MB przy miniaturach 200 px
const WERSJA = 'r1'; // zmiana sposobu rysowania stron → nowa wersja unieważnia stare miniatury

export function skrot(tekst) {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i += 1) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${tekst.length.toString(36)}-${(h >>> 0).toString(36)}`;
}

// Część odcisku wspólna dla całego projektu – liczona raz na przebieg.
export function odciskProjektu(p) {
  const zasoby = Object.entries(p.zasoby || {}).map(([id, z]) => [id, z?.skrot || z?.sciezka || z?.rozmiar || (z?.dataUrl ? z.dataUrl.length : 0)]);
  return skrot(JSON.stringify([WERSJA, p.wzorce, p.style, p.tabele, p.serie, p.czcionki, p.sekcje, p.kolory_dodatkowe, p.tryb_kolorow, p.kolor_trybu, p.tryb_wymuszony, p.dane, zasoby]));
}

// Odcisk jednej miniatury: strona (albo wzorzec), jej miejsce w projekcie i tekst płynący z innych stron.
export function odciskMiniatury(p, cel, wspolny, liczbaStron) {
  const watki = new Set((cel.obiekty || []).map((o) => o.watek).filter(Boolean));
  const watek = watki.size ? p.strony.flatMap((s) => (s.obiekty || []).filter((o) => watki.has(o.watek))) : [];
  return skrot(JSON.stringify([wspolny, cel, p.strony.indexOf(cel), liczbaStron, watek]));
}

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

const klucz = (projektId, celId) => `${projektId}:${celId}`;

// Wszystkie zapisane miniatury projektu naraz (jedno czytanie bazy): Map id celu → { odcisk, url }.
export async function wczytajMiniaturyProjektu(projektId) {
  const wynik = new Map();
  try {
    const od = `${projektId}:`;
    const wpisy = await transakcja('readonly', (m) => m.getAll(window.IDBKeyRange.bound(od, `${od}￿`)));
    for (const w of wpisy || []) wynik.set(w.klucz.slice(od.length), w);
  } catch { /* bez magazynu – miniatury rysują się jak dawniej */ }
  return wynik;
}

let doZapisu = [];
let timerZapisu = null;
// Zapis w paczkach (jedna transakcja na kilkadziesiąt miniatur), w tle.
export function zapiszMiniatureStrony(projektId, celId, odcisk, url) {
  if (!projektId || !celId || !url) return;
  doZapisu.push({ klucz: klucz(projektId, celId), odcisk, url, uzyto: Date.now() });
  clearTimeout(timerZapisu);
  timerZapisu = setTimeout(zapiszPaczke, doZapisu.length >= 40 ? 0 : 800);
}

async function zapiszPaczke() {
  const paczka = doZapisu;
  doZapisu = [];
  if (!paczka.length) return;
  try {
    await transakcja('readwrite', (m) => { for (const w of paczka) m.put(w); });
    const ile = await transakcja('readonly', (m) => m.count());
    if (ile > MAKS_WPISOW) {
      await transakcja('readwrite', (m) => {
        const req = m.index('uzyto').openCursor();
        let zostalo = ile - MAKS_WPISOW;
        req.onsuccess = () => {
          const k = req.result;
          if (!k || zostalo <= 0) return;
          k.delete();
          zostalo -= 1;
          k.continue();
        };
      });
    }
  } catch { /* bez magazynu miniatury żyją do końca sesji */ }
}

// Odświeżenie „uzyto” dla miniatur wziętych z bazy (żeby czyszczenie nie zabrało właśnie otwartego projektu).
export function oznaczUzyte(wpisy) {
  if (!wpisy.length) return;
  const teraz = Date.now();
  transakcja('readwrite', (m) => { for (const w of wpisy) m.put({ ...w, uzyto: teraz }); }).catch(() => {});
}
