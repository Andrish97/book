// Rysowanie stron na serwerze (#335) – strona rysuj.html w przeglądarce workera (Cloudflare Browser Rendering).
// Te same moduły co w aplikacji (wygląd stron identyczny jak w edytorze), ale bez logowania i bez reszty aplikacji.
// Worker podaje projekt i dostęp do plików przez funkcje wystawione stronie (page.exposeFunction):
//   __mkPobierz(sciezka) → { b64, typ } – obraz albo czcionka projektu z magazynu konta,
//   __mkCzytajOpis(folder) → manifest | null, __mkWyslij(klucz, b64, typ, cache), __mkLista(folder) → [klucze],
//   __mkUsun(klucze), __mkPostep(gotowe, wszystkie).
// Strona nie ma kluczy ani sesji – nie może sięgnąć po nic poza tym, co poda jej worker.
import './fabric-ustawienia.js';
import { normalizuj } from './projekt.js';
import { zaladujCzcionki, zarejestrujCzcionkiProjektu } from './czcionki.js';
import { podlaczZasoby } from './zasoby.js';
import { przeliczOkladki } from './okladka.js';
import { przygotujPublikacje } from './publikacja-linku.js';
import { publikujDoMagazynu } from './publikacja-magazyn.js';

const zBase64 = (b64, typ) => {
  const bin = atob(b64);
  const bajty = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bajty[i] = bin.charCodeAt(i);
  return new Blob([bajty], { type: typ || 'application/octet-stream' });
};
const doBase64 = async (blob) => {
  const bajty = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
  return btoa(s);
};

const magazyn = {
  czytajOpis: (folder) => window.__mkCzytajOpis(folder),
  wyslij: async (klucz, blob, { cache } = {}) => window.__mkWyslij(klucz, await doBase64(blob), blob.type || 'application/octet-stream', cache || null),
  lista: (folder) => window.__mkLista(folder),
  usun: (klucze) => window.__mkUsun(klucze),
};

// Przygotowanie projektu do rysowania – jak przygotujDoRysowania w aplikacji (js/app/zapis.js).
async function przygotuj(projekt) {
  await zaladujCzcionki();
  const p = normalizuj(projekt);
  const pobierz = async (sciezka) => { const w = await window.__mkPobierz(sciezka); if (!w) throw new Error('brak pliku'); return zBase64(w.b64, w.typ); };
  const brak = await podlaczZasoby(p, pobierz).catch(() => []);
  await zarejestrujCzcionkiProjektu(p);
  try { przeliczOkladki(p); } catch { /* okładka zostaje jak była */ }
  return { p, brak };
}

window.makietkaRysuj = {
  // Link do podglądu: rysuje zmienione strony i zapisuje je razem z opisem w folderze linku.
  // Zwraca { zaktualizowano, wyslane, wszystkie, odcisk, brakujace }.
  async publikujLink({ projekt, folder, pelna = false, chroniony = false }) {
    const { p, brak } = await przygotuj(projekt);
    const { uklad, strony, odciski, rozszerzenie, obraz, odcisk } = przygotujPublikacje(p);
    const w = await publikujDoMagazynu(magazyn, folder, uklad, strony, obraz, (i, n) => window.__mkPostep?.(i, n), odciski, { rozszerzenie, pelna, chroniony });
    return { ...w, odcisk, brakujace: brak };
  },
};
window.makietkaRysujGotowe = true;
