/* global IDBKeyRange */
// Oryginały obrazów projektu poza pamięcią karty.
//
// Zdjęcie z aparatu to kilka megabajtów. Dawniej każdy obraz projektu siedział w pamięci
// jako tekst „data:” (o jedną trzecią dłuższy od pliku) i był przepisywany do zapisu
// lokalnego przy każdej zmianie. Teraz oryginał leży w osobnym magazynie przeglądarki
// (IndexedDB, plik na dysku), a w projekcie zostaje tylko krótki opis: nazwa, typ, rozmiar.
//
//  – świeżo dodany obraz ma jeszcze `dataUrl`; przy najbliższym zapisie trafia do magazynu
//    (odlozZasoby) i `dataUrl` znika z projektu;
//  – po otwarciu projektu każdy obraz dostaje adres „blob:” wskazujący plik w magazynie
//    (podlaczZasoby) – przeglądarka czyta go z dysku dopiero wtedy, gdy go rysuje;
//  – treść oryginału jako dane (eksport, wysyłka na konto, plik projektu) daje blobZasobu
//    i dataUrlZasobu – na żądanie, bez trzymania wszystkiego naraz.
//
// Klucz w magazynie to „<id projektu>/<id zasobu>”: każdy projekt ma własne pliki, więc podmiana
// obrazu w kopii projektu nie zmienia oryginału, a usunięcie projektu usuwa dokładnie jego pliki.
// Czcionki własne (małe pliki, potrzebne od razu) zostają w projekcie jak dotąd.

const BAZA = 'seriodruk-zasoby';
const MAGAZYN = 'pliki';
const KOPIA = 'kopia:'; // przedrostek klucza kopii roboczej dużego zdjęcia

const adresy = new Map(); // klucz pliku → adres „blob:” oryginału w magazynie
const podlaczone = new WeakMap(); // opis zasobu (obiekt z projektu) → klucz pliku

const klucz = (projekt, id) => `${projekt.id}/${id}`;

function otworz() {
  return new Promise((ok, blad) => {
    const req = indexedDB.open(BAZA, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(MAGAZYN); };
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

const czcionki = (projekt) => new Set((projekt?.czcionki || []).map((c) => c.id));
const naBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

export const naDataUrl = (blob) => new Promise((ok, blad) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = () => blad(r.error);
  r.readAsDataURL(blob);
});

function zarejestruj(k, blob, zasob) {
  if (blob) {
    const stary = adresy.get(k);
    if (stary) URL.revokeObjectURL(stary);
    adresy.set(k, URL.createObjectURL(blob));
  }
  if (zasob) podlaczone.set(zasob, k);
}

// Nowy adres pliku zasobu odczytanego ponownie z magazynu – gdy dotychczasowy przestał działać (przeglądarka
// potrafi pod obciążeniem nie odczytać pliku spod adresu wydanego wcześniej; #137). null, gdy pliku nie ma.
export async function odswiezAdresZasobu(zasob) {
  const k = zasob && !zasob.dataUrl && podlaczone.get(zasob);
  if (!k) return null;
  const blob = await transakcja('readonly', (m) => m.get(k)).catch(() => null);
  if (!blob) return null;
  zarejestruj(k, blob, zasob);
  return adresy.get(k);
}

// Adres, z którego przeglądarka wczyta oryginał obrazu: świeżo dodany ma `dataUrl`, zapisany – plik w magazynie.
export function adresZasobu(zasob) {
  if (!zasob) return null;
  return zasob.dataUrl || adresy.get(podlaczone.get(zasob)) || null;
}

// Klucz pliku zasobu w magazynie (null, gdy obraz nie jest jeszcze zapisany) – pod nim js/obrazy.js
// zapamiętuje kopię roboczą.
export const kluczZasobu = (zasob) => (zasob && !zasob.dataUrl && podlaczone.get(zasob)) || null;

// Wkłada plik do magazynu i podłącza jego adres do opisu zasobu. Zwraca dane do opisu w projekcie.
async function wlozPlik(projekt, id, blob, zasob) {
  const k = klucz(projekt, id);
  // Plik odczytany z powrotem musi być tym, który zapisaliśmy: pod dużym obciążeniem przeglądarka potrafiła
  // zapisać zamiast zdjęcia kilkubajtowy plik bez typu (#184) – a po odłożeniu treść znika z projektu, więc
  // zdjęcie przepadało. Zapis powtarzamy; gdy się nie uda, błąd zostawia treść obrazu w projekcie.
  for (let proba = 0; proba < 3; proba += 1) {
    await transakcja('readwrite', (m) => { m.put(blob, k); m.delete(KOPIA + k); });
    const zapisany = await transakcja('readonly', (m) => m.get(k));
    if (zapisany && zapisany.size === blob.size && zapisany.type === blob.type) {
      // Adres wskazuje plik odczytany z magazynu (z dysku), nie kopię trzymaną w pamięci.
      zarejestruj(k, zapisany, zasob);
      return { typ: blob.type || 'application/octet-stream', rozmiar: blob.size };
    }
  }
  throw new Error(`Nie udało się zapisać obrazu „${zasob?.nazwa || id}” w pamięci przeglądarki.`);
}

// Plik z konta musi się zgadzać z opisem obrazu w projekcie (#184): niepełny albo inny plik (np. przerwana wysyłka
// albo odpowiedź, która nie jest obrazem) nie trafia do magazynu jako oryginał – obraz liczy się jako brakujący
// i pobierze się przy następnym otwarciu. Bez typu w odpowiedzi plik dostaje typ z opisu.
function sprawdzPobrany(blob, z) {
  if (!blob || (z.rozmiar && blob.size !== z.rozmiar)) throw new Error(`Obraz „${z.nazwa || ''}” przyszedł niepełny.`);
  return z.typ && !blob.type ? new Blob([blob], { type: z.typ }) : blob;
}

// Plik pobrany z konta trafia do magazynu tylko wtedy, gdy w czasie pobierania nie pojawił się tam plik z tego
// urządzenia (#184): zapis obrazu dodanego albo podmienionego tutaj (ten sam identyfikator) biegnie obok
// łączenia zmian z konta, a spóźnione pobranie nadpisywało go starszą kopią z konta. Sprawdzenie i zapis w jednej
// transakcji. Zwraca dane do opisu zasobu – tego pliku, który został w magazynie.
async function wlozPobrany(projekt, id, blob, zasob) {
  const k = klucz(projekt, id);
  const wMagazynie = await transakcja('readwrite', (m) => {
    const odczyt = m.get(k);
    const wynik = { blob: null };
    odczyt.onsuccess = () => {
      if (odczyt.result) wynik.blob = odczyt.result;
      else { m.put(blob, k); m.delete(KOPIA + k); wynik.blob = blob; }
    };
    return wynik;
  });
  const plik = adresy.has(k) && wMagazynie.blob !== blob ? null : ((await transakcja('readonly', (m) => m.get(k))) || wMagazynie.blob);
  if (plik) zarejestruj(k, plik, zasob); else podlaczone.set(zasob, k); // plik z tego urządzenia ma już swój adres
  return { typ: wMagazynie.blob.type || 'application/octet-stream', rozmiar: wMagazynie.blob.size };
}

// Przed zapisem: obrazy, które mają jeszcze `dataUrl`, trafiają do magazynu, a z projektu znika ich treść.
// Zwraca true, gdy coś przeniesiono.
export async function odlozZasoby(projekt, postep = null) {
  const pomin = czcionki(projekt);
  let cos = false;
  const doOdlozenia = Object.entries(projekt?.zasoby || {}).filter(([id, z]) => z?.dataUrl && !pomin.has(id));
  let gotowe = 0;
  for (const [id, z] of doOdlozenia) {
    postep?.(gotowe, doOdlozenia.length);
    gotowe += 1;
    const dataUrl = z.dataUrl;
    const opis = await wlozPlik(projekt, id, await naBlob(dataUrl), z);
    // W trakcie zapisu obraz mógł zostać podmieniony – wtedy zostaje do następnego zapisu.
    if (projekt.zasoby[id] === z && z.dataUrl === dataUrl) { Object.assign(z, opis); delete z.dataUrl; }
    cos = true;
  }
  return cos;
}

// Po otwarciu projektu: każdy obraz dostaje adres pliku z magazynu. Obraz, którego nie ma na tym
// urządzeniu, a jest na koncie (`sciezka`), jest pobierany funkcją `pobierz(sciezka)` → Blob.
// Zwraca listę nazw obrazów, których nie udało się znaleźć. postep(gotowe, razem) – przy pobieraniu z konta.
export async function podlaczZasoby(projekt, pobierz = null, postep = null) {
  const pomin = czcionki(projekt);
  // Obrazy usunięte na innym urządzeniu: ich pliki znikają też stąd.
  const usuniete = (projekt?.zasoby_usuniete || []).map((id) => klucz(projekt, id));
  if (usuniete.length) {
    try { await transakcja('readwrite', (m) => { for (const k of usuniete) { m.delete(k); m.delete(KOPIA + k); } }); } catch { /* sprzątanie przy następnym otwarciu */ }
  }
  const wpisy = [];
  for (const [id, z] of Object.entries(projekt?.zasoby || {})) {
    if (!z || z.dataUrl || pomin.has(id)) continue;
    const k = klucz(projekt, id);
    if (adresy.has(k)) podlaczone.set(z, k); else wpisy.push([id, z, k]);
  }
  if (!wpisy.length) return [];
  const db = await otworz();
  const pliki = await new Promise((ok, blad) => {
    const tx = db.transaction(MAGAZYN, 'readonly');
    const m = tx.objectStore(MAGAZYN);
    const wynik = new Map();
    for (const [, , k] of wpisy) { const r = m.get(k); r.onsuccess = () => { if (r.result) wynik.set(k, r.result); }; }
    tx.oncomplete = () => { db.close(); ok(wynik); };
    tx.onerror = tx.onabort = () => { db.close(); blad(tx.error); };
  });
  const brak = [];
  const doPobrania = [];
  for (const [id, z, k] of wpisy) {
    // Dwa podłączenia naraz (otwarcie projektu i zaraz potem dołączenie zmian z konta) czytają ten sam plik; drugie
    // nie może podmienić adresu, bo unieważniłoby adres, z którego płótno właśnie wczytuje obraz – obraz znikał (#137).
    if (pliki.has(k)) { if (adresy.has(k)) podlaczone.set(z, k); else zarejestruj(k, pliki.get(k), z); }
    else if (z.sciezka && pobierz) doPobrania.push([id, z]);
    else brak.push(z.nazwa || id);
  }
  // Pobieranie z konta: po kilka naraz, żeby projekt z setką zdjęć nie czekał na każde osobno.
  const razem = doPobrania.length;
  let gotowe = 0;
  if (razem) postep?.(0, razem);
  await Promise.all(Array.from({ length: Math.min(4, doPobrania.length) }, async () => {
    for (let w = doPobrania.shift(); w; w = doPobrania.shift()) {
      const [id, z] = w;
      try { Object.assign(z, await wlozPobrany(projekt, id, sprawdzPobrany(await pobierz(z.sciezka), z), z)); } catch { brak.push(z.nazwa || id); }
      gotowe += 1;
      postep?.(gotowe, razem);
    }
  }));
  return brak;
}

// Oryginał zasobu jako Blob – z projektu (świeżo dodany, czcionka) albo z magazynu. null, gdy go nie ma.
export async function blobZasobu(projekt, id) {
  const z = projekt?.zasoby?.[id];
  if (z?.dataUrl) return naBlob(z.dataUrl);
  return (await transakcja('readonly', (m) => m.get(klucz(projekt, id)))) || null;
}

// Oryginał jako tekst „data:” – tylko tam, gdzie naprawdę jest potrzebny (eksport w pełnej jakości).
export async function dataUrlZasobu(projekt, id) {
  const z = projekt?.zasoby?.[id];
  if (z?.dataUrl) return z.dataUrl;
  const blob = await blobZasobu(projekt, id);
  return blob ? naDataUrl(blob) : null;
}

// Kopia projektu dostaje własne pliki (ma te same identyfikatory zasobów, ale inny identyfikator projektu).
export async function kopiujPliki(zProjektu, doProjektu) {
  const pomin = czcionki(zProjektu);
  for (const [id, z] of Object.entries(zProjektu?.zasoby || {})) {
    if (!z || z.dataUrl || pomin.has(id)) continue;
    const blob = await transakcja('readonly', (m) => m.get(klucz(zProjektu, id)));
    if (blob) await transakcja('readwrite', (m) => m.put(blob, klucz(doProjektu, id)));
  }
}

// Kopia robocza dużego zdjęcia (js/obrazy.js) zapamiętana między otwarciami projektu:
// { blob, szer, wys } albo { mala: true } – żeby nie dekodować oryginału przy każdym otwarciu.
export const kopiaZMagazynu = (k) => transakcja('readonly', (m) => m.get(KOPIA + k)).catch(() => null);
export const zapamietajKopie = (k, kopia) => transakcja('readwrite', (m) => m.put(kopia, KOPIA + k)).catch(() => {});

// Spis magazynu: [[klucz, rozmiar w bajtach]] – do diagnostyki i testów.
export async function spisPlikow() {
  const db = await otworz();
  return new Promise((ok, blad) => {
    const wynik = [];
    const tx = db.transaction(MAGAZYN, 'readonly');
    const kursor = tx.objectStore(MAGAZYN).openCursor();
    kursor.onsuccess = () => { const k = kursor.result; if (!k) return; wynik.push([String(k.key), k.value instanceof Blob ? k.value.size : 0]); k.continue(); };
    tx.oncomplete = () => { db.close(); ok(wynik); };
    tx.onerror = tx.onabort = () => { db.close(); blad(tx.error); };
  });
}

// Usuwa z magazynu plik jednego zasobu i jego kopię roboczą (obraz usunięty z projektu, js/obrazy-projektu.js).
export async function usunPlikZasobu(projekt, id) {
  const k = klucz(projekt, id);
  await transakcja('readwrite', (m) => { m.delete(k); m.delete(KOPIA + k); });
  const adres = adresy.get(k);
  if (adres) { URL.revokeObjectURL(adres); adresy.delete(k); }
}

// Usuwa z magazynu wszystkie pliki projektu (po usunięciu projektu z tego urządzenia).
export async function usunPlikiProjektu(idProjektu) {
  const zakres = (p) => IDBKeyRange.bound(`${p}${idProjektu}/`, `${p}${idProjektu}/￿`);
  await transakcja('readwrite', (m) => { m.delete(zakres('')); m.delete(zakres(KOPIA)); });
  for (const [k, adres] of adresy) if (k.startsWith(`${idProjektu}/`)) { URL.revokeObjectURL(adres); adresy.delete(k); }
}
