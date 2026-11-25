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
import { t as tt } from './jezyk.js';

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
const etap = (e) => window.__mkEtap?.(e);
async function przygotuj(projekt) {
  etap('czcionki aplikacji');
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
  etap('obrazy projektu');
  brak.push(...await podlaczZasoby(p, pobierz).catch(() => []));
  etap('czcionki projektu');
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
    if (!e) throw new Error(tt('kod.brakStrony', { strona: u.strona ?? '' }));
    etap('obraz PNG');
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
  etap('plik PDF');
  const wynik = await eksportujPdf(p, { ...opcje, postep: (i, n) => window.__mkPostep?.(i, n) });
  etap('wysyłanie pliku');
  for (const [powod, n] of wynik.uwagi || []) uwagi.push(tt('rysuj.zapisaneJakoObraz', { n, powod }));
  for (const [czcionka, n] of wynik.krzywe || []) uwagi.push(tt('rysuj.tekstJakoKrzywe', { n, czcionka }));
  uwagi = uwagi.slice(0, 40);
  return { b64: await doBase64(wynik.blob), typ: wynik.blob.type || 'application/pdf', nazwa: wynik.nazwa, strony: wybierzEgzemplarze(ciag, opcje).length, uwagi };
};
// Usługa składu dla MCP (#436): wszystko, co dotąd działało tylko w otwartym edytorze – tym samym kodem.
// dzialania: [{ rodzaj: 'przelej', watki?: [id] (brak – wszystkie wątki), suchy? }, { rodzaj: 'wysokosci', strony?: [id] },
//   { rodzaj: 'sprawdz' }, { rodzaj: 'podglad', strona, egzemplarz?, szerokosc? (px) }, { rodzaj: 'opis', strona, element? }]
// Zwraca { przelej: [{ watek, zmiany, raport, opis }], wysokosci: [{ strona, id, height }], sprawdz: [uwagi],
//   podglad: { b64, typ, szerokosc, wysokosc }, opis: [...] }. Kolejne działania widzą wynik poprzednich (np. przelanie).
window.makietkaRysuj.skladaj = async ({ projekt, dzialania = [] }) => {
  const { p } = await przygotuj(projekt);
  const { rozwin } = await import('./serie.js');
  const wynik = {};
  for (const d of dzialania) {
    etap(`skład: ${d.rodzaj}`);
    if (d.rodzaj === 'przelej') {
      const { przelejWatek, opisRaportu } = await import('./przelewanie.js');
      const { watkiProjektu } = await import('./watki.js');
      const ids = Array.isArray(d.watki) && d.watki.length ? d.watki : [...watkiProjektu(p).keys()];
      wynik.przelej = [];
      for (const w of ids) {
        const { zmiany, raport } = await przelejWatek(p, w, { suchy: Boolean(d.suchy) });
        wynik.przelej.push({ watek: w, zmiany, raport, opis: opisRaportu(w, raport) });
      }
    } else if (d.rodzaj === 'wysokosci') {
      // Ramki rosnące z tekstem: wysokość po złożeniu (zapis bywa nieaktualny – #431).
      const strony = p.strony.filter((s) => !d.strony?.length || d.strony.includes(s.id));
      const json = strony.flatMap((s) => (s.obiekty || []).filter((o) => o?.type === 'textbox' && !(o.ramka_h > 0)).map((o) => ({ s, o })));
      const { zapewnijCzcionki } = await import('./czcionki.js');
      await zapewnijCzcionki(json.map((x) => x.o));
      const zywe = json.length ? await fabric.util.enlivenObjects(json.map((x) => JSON.parse(JSON.stringify(x.o)))) : [];
      wynik.wysokosci = [];
      zywe.forEach((z, i) => {
        z.initDimensions();
        if (Math.abs((json[i].o.height || 0) - z.height) > 0.01) {
          json[i].o.height = z.height;
          wynik.wysokosci.push({ strona: json[i].s.id, id: z.id, height: z.height });
        }
      });
    } else if (d.rodzaj === 'sprawdz') {
      const { sprawdzWszystko } = await import('./kontrola-skladu.js');
      wynik.sprawdz = (await sprawdzWszystko(p)).map((u) => ({ rodzaj: u.rodzaj, opis: u.opis, strony: u.strony, idObiektu: u.idObiektu, idStrony: u.idStrony }));
    } else if (d.rodzaj === 'podglad') {
      const ciag = rozwin(p);
      const egz = ciag.egzemplarze.filter((e) => e.strona?.id === d.strona);
      const e = egz[Math.max(0, Math.min(egz.length - 1, (Number(d.egzemplarz) || 1) - 1))];
      if (!e) throw new Error(tt('kod.brakStrony', { strona: d.strona ?? '' }));
      const { renderujCel } = await import('./zlozenie.js');
      const szer = Math.min(1600, Math.max(200, Number(d.szerokosc) || 700));
      const url = await renderujCel(p, e, { szerokoscPx: szer, spad: false, ciag, oryginaly: false });
      const blob = await (await fetch(url)).blob();
      const w = e.sekcja.wydruk;
      wynik.podglad = { b64: await doBase64(blob), typ: blob.type || 'image/png', szerokosc: szer, wysokosc: Math.round((szer * w.wysokosc_mm) / w.szerokosc_mm) };
    } else if (d.rodzaj === 'opis') {
      // Lekki odczyt: teksty strony (albo jeden element) po złożeniu – tekst, liczba wierszy, czy się mieści.
      const ciag = rozwin(p);
      const egz = ciag.egzemplarze.find((e) => e.strona?.id === d.strona);
      if (!egz) throw new Error(tt('kod.brakStrony', { strona: d.strona ?? '' }));
      const { tekstyEgzemplarza } = await import('./zlozenie.js');
      const { nieMiesciSie } = await import('./tekst-ramka.js');
      wynik.opis = (await tekstyEgzemplarza(p, egz, ciag, { wszystkie: true, ...(d.element ? { tylko: new Set([d.element]) } : {}) }))
        .filter((x) => !d.element || x.id === d.element)
        .map(({ obiekt: o, id, zrodlo }) => ({ id, zrodlo, nazwa: o.nazwa || '', tekst: String(o.text || '').slice(0, 2000), wierszy: o._textLines?.length || 0, miesciSie: !nieMiesciSie(o), wysokosc: Math.round((o._wysokoscTresci ?? o.height) * 100) / 100, ramka_h: o.ramka_h || null, watek: o.watek || null }));
    }
  }
  return wynik;
};
window.makietkaRysujGotowe = true;
