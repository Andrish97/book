// „Moje elementy” (#131C): elementy zapisane w Bibliotece („Zapisz w bibliotece”), dostępne w każdym projekcie.
// Leżą na koncie, w prywatnym folderze plików (<konto>/_elementy/) – jak „Moje czcionki”: spis.json i po jednym
// pliku JSON na element (obiekty + obrazy jako „data:”). Folder na „_” nie jest sprzątany jako osierocony.
// Wstawienie kopiuje obrazy elementu do obrazów projektu (ten sam plik drugi raz – ten sam obraz).

import { podmienZasoby } from './zlozenie.js';
import { zbierzZasoby } from './obrazy.js';
import { blobZasobu, naDataUrl } from './zasoby.js';

let pamiec = null; // [{ id, nazwa, podglad (svg albo data:image), szer, wys, zmieniono }]
const sluchacze = new Set();
export const naZmianeMoichElementow = (fn) => { sluchacze.add(fn); return () => sluchacze.delete(fn); };
const powiadom = () => { for (const fn of sluchacze) { try { fn(pamiec || []); } catch { /* jeden słuchacz nie psuje reszty */ } } };

export const listaMoichElementow = () => pamiec || [];

const folderKonta = async () => (await import('./chmura.js')).kontoElementow();
const naBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

// Odświeża listę z konta (przy otwarciu Biblioteki i po zmianach).
export async function wczytajMojeElementy() {
  try {
    const k = await folderKonta();
    pamiec = (await k.spis()).elementy || [];
  } catch { pamiec = pamiec || []; }
  powiadom();
  return pamiec;
}

// Zapis zaznaczenia: obiekty (JSON z polami aplikacji, położenie od lewego górnego rogu) i ich obrazy.
// `obiekty` – JSON elementów w postaci do zapisu („zasob:<id>”), `projekt` – skąd wziąć pliki obrazów.
export async function zapiszMojElement({ nazwa, obiekty, szer, wys, podglad }, projekt) {
  const k = await folderKonta();
  const id = `el${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const zasoby = {};
  for (const zid of zbierzZasoby(obiekty)) {
    const z = projekt?.zasoby?.[zid];
    const blob = await blobZasobu(projekt, zid);
    if (!z || !blob) continue;
    zasoby[zid] = { nazwa: z.nazwa || `${zid}.png`, typ: blob.type, dataUrl: await naDataUrl(blob) };
  }
  await k.wyslij(id, { wersja: 1, nazwa, obiekty, zasoby, szer, wys });
  const spis = await k.spis();
  spis.elementy = [...(spis.elementy || []), { id, nazwa, podglad, szer, wys, zmieniono: new Date().toISOString() }];
  await k.zapiszSpis(spis);
  pamiec = spis.elementy;
  powiadom();
  return id;
}

export async function zmienNazweMojegoElementu(id, nazwa) {
  const k = await folderKonta();
  const spis = await k.spis();
  const e = (spis.elementy || []).find((x) => x.id === id);
  if (!e) return;
  e.nazwa = nazwa;
  await k.zapiszSpis(spis);
  pamiec = spis.elementy;
  powiadom();
}

export async function usunMojElement(id) {
  const k = await folderKonta();
  const spis = await k.spis();
  spis.elementy = (spis.elementy || []).filter((x) => x.id !== id);
  await k.zapiszSpis(spis);
  await k.usun(id).catch(() => {});
  pamiec = spis.elementy;
  powiadom();
}

// Element gotowy do wstawienia do projektu: obrazy dodane do projektu (przyjmijPlik), obiekty z nowymi id obrazów.
export async function mojElementDoWstawienia(id, projekt) {
  const k = await folderKonta();
  const dane = await k.pobierz(id);
  const { przyjmijPlik } = await import('./obrazy-projektu.js');
  const mapa = new Map();
  for (const [zid, z] of Object.entries(dane.zasoby || {})) {
    const { id: nowy } = await przyjmijPlik(projekt, await naBlob(z.dataUrl), z.nazwa);
    mapa.set(zid, nowy);
  }
  const przemapuj = (lista) => (lista || []).map((o) => {
    const k2 = { ...o };
    if (k2.zasob && mapa.has(k2.zasob)) k2.zasob = mapa.get(k2.zasob);
    if (Array.isArray(k2.objects)) k2.objects = przemapuj(k2.objects);
    return k2;
  });
  return { ...dane, obiekty: przemapuj(dane.obiekty) };
}

export { podmienZasoby };
