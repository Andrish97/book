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

const naDataUrl = (blob) => new Promise((ok, blad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => blad(r.error); r.readAsDataURL(blob); });

// Przygotowanie projektu do rysowania – jak przygotujDoRysowania w aplikacji (js/app/zapis.js).
async function przygotuj(projekt) {
  await zaladujCzcionki();
  const p = normalizuj(projekt);
  const pobierz = async (sciezka) => { const w = await window.__mkPobierz(sciezka); if (!w) throw new Error('brak pliku'); return zBase64(w.b64, w.typ); };
  // Własne czcionki projektu muszą być w projekcie (dataUrl) – jak przy wczytaniu z konta (chmura.wczytajZChmury).
  const brak = [];
  for (const c of p.czcionki || []) {
    const z = p.zasoby?.[c.id];
    if (!z || z.dataUrl || !z.sciezka) continue;
    try { z.dataUrl = await naDataUrl(await pobierz(z.sciezka)); } catch { brak.push(z.nazwa || c.id); }
  }
  brak.push(...await podlaczZasoby(p, pobierz).catch(() => []));
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

// Plik eksportu (#337): PDF całego projektu albo PNG jednej strony – ten sam kod co eksport zlecony przez AI
// w aplikacji (js/app/eksport-ai.js). Zwraca { b64, typ, nazwa, strony, uwagi }.
window.makietkaRysuj.eksportuj = async ({ projekt, rodzaj = 'pdf', ustawienia = {}, opcje: opcjeOkna = null }) => {
  const { p } = await przygotuj(projekt);
  const { rozwin } = await import('./serie.js');
  const { sprawdzProjekt } = await import('./kontrola.js');
  const ciag = rozwin(p);
  const u = ustawienia || {};
  let uwagi = sprawdzProjekt(p, ciag).map((x) => x.opis).filter(Boolean);
  const nazwaPliku = (t) => String(t || 'projekt').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'projekt';
  if (rodzaj === 'png') {
    const egz = ciag.egzemplarze.filter((e) => e.strona?.id === u.strona);
    const e = egz[Math.max(0, Math.min(egz.length - 1, (Number(u.egzemplarz) || 1) - 1))];
    if (!e) throw new Error(`Projekt nie ma strony „${u.strona ?? ''}”.`);
    const { renderujCel } = await import('./zlozenie.js');
    const dpi = Math.min(600, Math.max(72, Number(u.dpi) || 150));
    const w = e.sekcja.wydruk;
    const url = await renderujCel(p, e, { szerokoscPx: Math.round(((w.szerokosc_mm + 2 * w.spad_mm) / 25.4) * dpi), spad: true, ciag, oryginaly: true });
    const blob = await (await fetch(url)).blob();
    return { b64: await doBase64(blob), typ: blob.type || 'image/png', nazwa: `${nazwaPliku(p.nazwa)}-${nazwaPliku(e.strona.nazwa || 'strona')}.png`, strony: 1, uwagi: uwagi.slice(0, 10) };
  }
  const { eksportujPdf, wybierzEgzemplarze } = await import('./eksport.js');
  const { opcjePdf } = await import('./eksport-opcje.js');
  // Opcje z okna „Eksportuj do PDF” (#338) – jak w aplikacji, bez własnego profilu ICC; zlecenie AI – z ustawień.
  const opcje = opcjeOkna ? { ...opcjeOkna, profilWlasny: null } : opcjePdf(p, u);
  const wynik = await eksportujPdf(p, { ...opcje, postep: (i, n) => window.__mkPostep?.(i, n) });
  for (const [powod, n] of wynik.uwagi || []) uwagi.push(`Zapisane jako obraz (${n}): ${powod}`);
  for (const [czcionka, n] of wynik.krzywe || []) uwagi.push(`Tekst jako krzywe (${n}): ${czcionka}`);
  uwagi = uwagi.slice(0, 40);
  return { b64: await doBase64(wynik.blob), typ: wynik.blob.type || 'application/pdf', nazwa: wynik.nazwa, strony: wybierzEgzemplarze(ciag, opcje).length, uwagi };
};
window.makietkaRysujGotowe = true;
