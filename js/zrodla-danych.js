// Źródło danych przypięte do tabeli (#227). Tabela pamięta, skąd przyszła: plik (Excel, CSV, ODS – z arkuszem)
// albo link (arkusz Google opublikowany jako CSV, dowolny adres CSV/XLSX). Oryginalny plik zostaje w projekcie jako
// załącznik (zasób z rodzaj: 'dane' – nie jest obrazem, nie pokazuje się w Obrazach i nie znika przy porządkach),
// do pobrania i do paczki „szablon + dane” (#226). Odcisk danych z chwili wczytania mówi, czy tabelę zmieniono
// potem w Makietce. „Odśwież z tego samego pliku” korzysta z zapamiętanego dostępu do pliku na dysku (Chrome
// i Edge na komputerze: File System Access) – bez wybierania pliku od nowa.

import { naDataUrl } from './zasoby.js';
import { skrotPliku } from './obrazy-projektu.js';
import { uid } from './projekt.js';
import { t as tt } from './jezyk.js';

export const MAKS_ZALACZNIKA = 5 * 1024 * 1024; // większych plików nie trzymamy w projekcie – tylko opis źródła

// Odcisk danych tabeli (FNV-1a z kolumn i wierszy) – do wykrycia zmian zrobionych w Makietce.
export function podpisDanych(t) {
  const s = JSON.stringify([t.kolumny, t.wiersze]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
export const zmienionaWMakietce = (t) => Boolean(t?.zrodlo?.podpis) && t.zrodlo.podpis !== podpisDanych(t);

// Przypina źródło do tabeli po wczytaniu. plik – File (oryginał trafia do zasobów, gdy nie jest za duży); link – adres.
export async function przypnijZrodlo(projekt, tabela, { plik = null, arkusz = null, url = null } = {}) {
  const stare = tabela.zrodlo?.zasob;
  let zasob;
  if (plik && plik.size <= MAKS_ZALACZNIKA) {
    // Ten sam plik w kilku tabelach (arkusze jednego skoroszytu) – jeden załącznik.
    const skrot = await skrotPliku(plik);
    const juz = Object.entries(projekt.zasoby || {}).find(([, z]) => z?.rodzaj === 'dane' && z.skrot === skrot);
    if (juz) zasob = juz[0];
    else {
      zasob = uid('z');
      projekt.zasoby[zasob] = { nazwa: plik.name, dataUrl: await naDataUrl(plik), skrot, rodzaj: 'dane', rozmiar: plik.size };
    }
  }
  tabela.zrodlo = Object.fromEntries(Object.entries({
    rodzaj: url ? 'link' : 'plik', plik: plik?.name || (url ? nazwaZLinku(url) : undefined), arkusz: arkusz || undefined, url: url || undefined,
    wczytano: new Date().toISOString(), zasob, podpis: podpisDanych(tabela),
  }).filter(([, v]) => v !== undefined));
  if (stare && stare !== zasob) usunNieuzywanyZalacznik(projekt, stare);
  return tabela.zrodlo;
}

// Załącznik, którego żadna tabela już nie wskazuje, znika z projektu (jak usunięty obraz).
export function usunNieuzywanyZalacznik(projekt, id) {
  if (!projekt.zasoby?.[id] || projekt.zasoby[id].rodzaj !== 'dane') return;
  if ((projekt.tabele || []).some((t) => t.zrodlo?.zasob === id)) return;
  delete projekt.zasoby[id];
  projekt.zasoby_usuniete = [...new Set([...(projekt.zasoby_usuniete || []), id])];
}

export function odepnijZrodlo(projekt, tabela) {
  const z = tabela.zrodlo?.zasob;
  delete tabela.zrodlo;
  if (z) usunNieuzywanyZalacznik(projekt, z);
}

// Porównanie danych przed i po: wiersze, kolumny (te używane w polach – osobno), zmienione komórki.
export function porownajTabele(stara, nowa, uzyteKolumny = new Set()) {
  const usunieteKolumny = stara.kolumny.filter((k) => !nowa.kolumny.includes(k));
  const noweKolumny = nowa.kolumny.filter((k) => !stara.kolumny.includes(k));
  let zmienione = 0;
  const wspolne = stara.kolumny.filter((k) => nowa.kolumny.includes(k));
  for (let w = 0; w < Math.min(stara.wiersze.length, nowa.wiersze.length); w += 1) {
    for (const k of wspolne) if ((stara.wiersze[w][stara.kolumny.indexOf(k)] ?? '') !== (nowa.wiersze[w][nowa.kolumny.indexOf(k)] ?? '')) zmienione += 1;
  }
  return {
    wierszyBylo: stara.wiersze.length, wierszyJest: nowa.wiersze.length,
    usunieteKolumny, noweKolumny, brakujaceUzywane: usunieteKolumny.filter((k) => uzyteKolumny.has(k)), zmienione,
  };
}

export function opisPorownania(r) {
  const cz = [];
  if (r.wierszyJest !== r.wierszyBylo) cz.push(tt('zrodlaDanych.wierszy', { wierszyBylo: r.wierszyBylo, wierszyJest: r.wierszyJest }));
  if (r.zmienione) cz.push(tt('zrodlaDanych.zmienioneKomorki', { zmienione: r.zmienione }));
  if (r.noweKolumny.length) cz.push(tt('zrodlaDanych.noweKolumny', { join: r.noweKolumny.join(', ') }));
  if (r.usunieteKolumny.length) cz.push(tt('zrodlaDanych.zniknaKolumny', { join: r.usunieteKolumny.join(', ') }));
  return cz.length ? cz.join('; ') : 'dane bez zmian';
}

// ---------- Linki ----------

// Arkusz Google: zwykły link do edycji → eksport CSV tej samej karty (gid). Inne adresy bez zmian.
export function linkDoPobrania(url) {
  const u = String(url || '').trim();
  const g = u.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)\/(?:edit|view|htmlview)?[^#]*(?:#gid=(\d+))?/);
  if (g && !/\/export\?|\/pub\?/.test(u)) return `https://docs.google.com/spreadsheets/d/${g[1]}/export?format=csv${g[2] ? `&gid=${g[2]}` : ''}`;
  return u;
}
export function nazwaZLinku(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'docs.google.com') return 'Arkusz Google';
    return decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || u.hostname);
  } catch { return 'link'; }
}

// Pobranie danych z linku jako File (nazwa z rozszerzeniem z typu odpowiedzi) – do wczytania jak plik.
export async function plikZLinku(url) {
  let odp;
  try { odp = await fetch(linkDoPobrania(url), { cache: 'no-store', credentials: 'omit' }); } catch {
    throw new Error('Nie udało się pobrać danych z linku – serwis nie pozwala na pobieranie z przeglądarki albo nie ma sieci. Arkusz Google: Plik → Udostępnij → Opublikuj w internecie → CSV.');
  }
  if (!odp.ok) throw new Error(tt('kod.zrodla.blad', { status: odp.status }));
  const typ = odp.headers.get('content-type') || '';
  const blob = await odp.blob();
  let nazwa = nazwaZLinku(url);
  if (!/\.(csv|tsv|txt|xlsx|xls|ods)$/i.test(nazwa)) nazwa += /spreadsheetml|excel/.test(typ) ? '.xlsx' : /opendocument/.test(typ) ? '.ods' : '.csv';
  if (/text\/html/.test(typ)) throw new Error('Pod linkiem jest strona, a nie dane. Arkusz Google opublikuj jako CSV (Plik → Udostępnij → Opublikuj w internecie).');
  return new File([blob], nazwa, { type: blob.type });
}

// ---------- Zapamiętany dostęp do pliku na dysku ----------

const uchwyty = new Map(); // `${projekt}:${tabela}` → FileSystemFileHandle (albo zastępnik w testach)
const BAZA = 'makietka-zrodla';
const otworzBaze = () => new Promise((ok, zle) => {
  const r = indexedDB.open(BAZA, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('uchwyty');
  r.onsuccess = () => ok(r.result);
  r.onerror = () => zle(r.error);
});
export const moznaZapamietacPlik = () => typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';

export async function zapamietajUchwyt(idProjektu, idTabeli, uchwyt) {
  const klucz = `${idProjektu}:${idTabeli}`;
  uchwyty.set(klucz, uchwyt);
  try {
    const db = await otworzBaze();
    await new Promise((ok, zle) => { const tx = db.transaction('uchwyty', 'readwrite'); tx.objectStore('uchwyty').put(uchwyt, klucz); tx.oncomplete = ok; tx.onerror = () => zle(tx.error); });
  } catch { /* uchwyt nie do zapisania (np. zastępnik) – zostaje w pamięci na tę sesję */ }
}

export async function uchwytTabeli(idProjektu, idTabeli) {
  const klucz = `${idProjektu}:${idTabeli}`;
  if (uchwyty.has(klucz)) return uchwyty.get(klucz);
  try {
    const db = await otworzBaze();
    const u = await new Promise((ok) => { const r = db.transaction('uchwyty').objectStore('uchwyty').get(klucz); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); });
    if (u) uchwyty.set(klucz, u);
    return u;
  } catch { return null; }
}

// Plik spod zapamiętanego uchwytu (z prośbą o pozwolenie, gdy przeglądarka go wymaga) albo null.
export async function plikZUchwytu(uchwyt) {
  if (!uchwyt) return null;
  if (uchwyt.queryPermission && await uchwyt.queryPermission({ mode: 'read' }) !== 'granted') {
    if (!uchwyt.requestPermission || await uchwyt.requestPermission({ mode: 'read' }) !== 'granted') return null;
  }
  return uchwyt.getFile();
}

// Wybór pliku z zapamiętaniem dostępu (Chrome/Edge) – { plik, uchwyt } albo null przy anulowaniu.
export async function wybierzPlikZDostepem() {
  try {
    const [uchwyt] = await window.showOpenFilePicker({
      types: [{ description: 'Dane (Excel, CSV, ODS)', accept: { 'text/csv': ['.csv', '.tsv', '.txt'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xlsm'], 'application/vnd.ms-excel': ['.xls'], 'application/vnd.oasis.opendocument.spreadsheet': ['.ods'] } }],
      excludeAcceptAllOption: false, multiple: false,
    });
    return { plik: await uchwyt.getFile(), uchwyt };
  } catch (e) {
    if (e?.name === 'AbortError') return null;
    throw e;
  }
}
