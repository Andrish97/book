// Schowek między projektami (#210): Kopiuj w jednym projekcie, Wklej w drugim – elementy, strony i całe sekcje,
// razem z tym, czego potrzebują: obrazami (pliki), wzorcami, seriami z tabelami danych i stylami tekstu.
// Schowek leży na tym urządzeniu (IndexedDB – także obrazy jako pliki), więc działa po przejściu do innego
// projektu, po przeładowaniu i w drugiej karcie. Krótki opis (co, skąd, kiedy) jest w localStorage – do
// sprawdzenia bez czekania (Ctrl+V musi od razu wiedzieć, czy jest co wkleić).

import { kopiujStrone, uid } from './projekt.js';
import { zbierzZasoby } from './obrazy.js';
import { blobZasobu } from './zasoby.js';

const BAZA = 'makietka-schowek';
const MAGAZYN = 'schowek';
const KLUCZ = 'biezacy';
const META = 'makietka-schowek';

function baza() {
  return new Promise((ok, blad) => {
    const r = indexedDB.open(BAZA, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MAGAZYN);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => blad(r.error);
  });
}
async function transakcja(tryb, fn) {
  const db = await baza();
  return new Promise((ok, blad) => {
    const tx = db.transaction(MAGAZYN, tryb);
    const r = fn(tx.objectStore(MAGAZYN));
    tx.oncomplete = () => { db.close(); ok(r?.result); };
    tx.onerror = tx.onabort = () => { db.close(); blad(tx.error); };
  });
}

// { rodzaj: 'elementy' | 'strony' | 'sekcja', opis, projekt, nazwaProjektu, kiedy } albo null.
export function metaSchowka() {
  try { return JSON.parse(localStorage.getItem(META) || 'null'); } catch { return null; }
}

export const wezZeSchowka = () => transakcja('readonly', (m) => m.get(KLUCZ)).catch(() => null);

// Wszystkie listy obiektów we wpisie – do zebrania i podmiany obrazów.
function listyObiektow(dane) {
  return [dane.obiekty, ...(dane.strony || []).map((s) => s.obiekty), ...(dane.wzorce || []).map((w) => w.obiekty)].filter(Boolean);
}

// Co strony i sekcja potrzebują z projektu: wzorce, serie z tabelami, style tekstu (tylko użyte).
function zaleznosci(projekt, strony, sekcja = null) {
  const idWzorcow = new Set(sekcja?.wzorce || []);
  for (const s of strony) if (Array.isArray(s.wzorce)) for (const id of s.wzorce) idWzorcow.add(id);
  const wzorce = (projekt.wzorce || []).filter((w) => idWzorcow.has(w.id));
  const idSerii = new Set(strony.map((s) => s.seria).filter(Boolean));
  if (sekcja?.specjalna?.seria) idSerii.add(sekcja.specjalna.seria);
  const serie = (projekt.serie || []).filter((s) => idSerii.has(s.id));
  const idTabel = new Set(serie.flatMap((s) => [s.tabela, ...(s.dodatkowe || []).map((d) => d.tabela)]).filter(Boolean));
  if (sekcja?.specjalna?.tabela) idTabel.add(sekcja.specjalna.tabela);
  const tabele = (projekt.tabele || []).filter((t) => idTabel.has(t.id));
  const tekst = JSON.stringify([strony, wzorce]);
  const style = (projekt.style || []).filter((s) => tekst.includes(`"${s.id}"`));
  const styleZnakowe = (projekt.style_znakowe || []).filter((s) => tekst.includes(`"${s.id}"`));
  return { wzorce, serie, tabele, style, style_znakowe: styleZnakowe };
}

// Zapis do schowka. wpis: { rodzaj, opis, dane } – dane: { obiekty, szer, wys } | { strony } | { sekcja, strony }.
export async function zapiszDoSchowka(projekt, { rodzaj, opis, dane }) {
  const pelne = JSON.parse(JSON.stringify(dane));
  if (rodzaj === 'strony' || rodzaj === 'sekcja') Object.assign(pelne, JSON.parse(JSON.stringify(zaleznosci(projekt, pelne.strony, pelne.sekcja))));
  const zasoby = {};
  const ids = new Set();
  for (const l of listyObiektow(pelne)) zbierzZasoby(l, ids);
  for (const id of ids) {
    const z = projekt.zasoby?.[id];
    const blob = z ? await blobZasobu(projekt, id).catch(() => null) : null;
    if (blob) zasoby[id] = { nazwa: z.nazwa || `${id}.png`, blob };
  }
  const meta = { rodzaj, opis, projekt: projekt.id, nazwaProjektu: projekt.nazwa, kiedy: Date.now() };
  await transakcja('readwrite', (m) => m.put({ ...meta, dane: pelne, zasoby }, KLUCZ));
  try { localStorage.setItem(META, JSON.stringify(meta)); } catch { /* bez opisu – Wklej sprawdzi magazyn */ }
  return meta;
}

// Podmiana identyfikatorów obrazów w obiektach (także w grupach i w adresach „zasob:<id>”).
export function przemapujZasoby(obiekty, mapa) {
  if (!mapa.size) return obiekty;
  const zmien = (v) => {
    if (Array.isArray(v)) return v.map(zmien);
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = k === 'zasob' && mapa.has(x) ? mapa.get(x) : zmien(x);
      return o;
    }
    if (typeof v === 'string' && v.startsWith('zasob:') && mapa.has(v.slice(6))) return `zasob:${mapa.get(v.slice(6))}`;
    return v;
  };
  return zmien(obiekty);
}

// Obrazy wpisu dodane do projektu: id ze schowka → id w projekcie. Ten sam projekt – obraz już jest.
export async function przyjmijZasoby(projekt, wpis) {
  const mapa = new Map();
  const { przyjmijPlik } = await import('./obrazy-projektu.js');
  for (const [id, z] of Object.entries(wpis.zasoby || {})) {
    if (wpis.projekt === projekt.id && projekt.zasoby?.[id]) continue;
    const { id: nowy } = await przyjmijPlik(projekt, z.blob, z.nazwa);
    if (nowy !== id) mapa.set(id, nowy);
  }
  return mapa;
}

// Dokłada do projektu wzorce, serie, tabele i style, których jeszcze nie ma (po identyfikatorze).
function dolaczZaleznosci(projekt, dane, mapa) {
  for (const klucz of ['wzorce', 'serie', 'tabele', 'style', 'style_znakowe']) {
    if (!Array.isArray(projekt[klucz])) projekt[klucz] = [];
    for (const x of dane[klucz] || []) {
      if (projekt[klucz].some((y) => y.id === x.id)) continue;
      projekt[klucz].push(klucz === 'wzorce' ? { ...x, obiekty: przemapujZasoby(x.obiekty, mapa) } : x);
    }
  }
}

// Strona ze schowka jako nowa strona projektu (nowe identyfikatory, obrazy z projektu, wybrana sekcja).
function nowaZeSchowka(s, idSekcji, mapa) {
  const k = kopiujStrone({ ...s, obiekty: przemapujZasoby(s.obiekty, mapa) }, s.nazwa);
  k.sekcja = idSekcji;
  return k;
}

// Wkleja strony za stroną `po` (indeks w projekt.strony) – do jej sekcji. Zwraca nowe strony.
export async function wklejStrony(projekt, wpis, po) {
  const mapa = await przyjmijZasoby(projekt, wpis);
  dolaczZaleznosci(projekt, wpis.dane, mapa);
  const idSekcji = projekt.strony[po]?.sekcja || projekt.sekcje[0].id;
  const nowe = wpis.dane.strony.map((s) => nowaZeSchowka(s, idSekcji, mapa));
  projekt.strony.splice(po + 1, 0, ...nowe);
  return nowe;
}

// Wkleja całą sekcję za sekcją `poSekcji` (id). Zwraca { sekcja, strony }.
export async function wklejSekcje(projekt, wpis, poSekcji) {
  const mapa = await przyjmijZasoby(projekt, wpis);
  dolaczZaleznosci(projekt, wpis.dane, mapa);
  const sekcja = { ...JSON.parse(JSON.stringify(wpis.dane.sekcja)), id: uid('sek') };
  if (sekcja.okladka) delete sekcja.okladka.wynik; // przeliczy się z bloku tego projektu
  const i = projekt.sekcje.findIndex((s) => s.id === poSekcji);
  if (sekcja.okladka) projekt.sekcje.unshift(sekcja); else projekt.sekcje.splice(i < 0 ? projekt.sekcje.length : i + 1, 0, sekcja);
  const strony = wpis.dane.strony.map((s) => nowaZeSchowka(s, sekcja.id, mapa));
  // Strony sekcji w miejscu odpowiadającym kolejności sekcji.
  const ostatniaPrzed = [...projekt.strony].reverse().find((s) => {
    const j = projekt.sekcje.findIndex((x) => x.id === s.sekcja);
    return j >= 0 && j < projekt.sekcje.indexOf(sekcja);
  });
  projekt.strony.splice(ostatniaPrzed ? projekt.strony.indexOf(ostatniaPrzed) + 1 : 0, 0, ...strony);
  return { sekcja, strony };
}
