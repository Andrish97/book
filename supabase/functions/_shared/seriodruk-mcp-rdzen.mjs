// Rdzeń serwera MCP Makietki – wspólny dla serwera stdio (ai/mcp/makietka-mcp.mjs, składany z tego pliku
// przez scripts/mcp-buduj.cjs) i zdalnego łącznika (supabase/functions/mcp/index.ts, Funkcja Edge Supabase).
// Bez modułów Node ani Deno: tylko fetch, crypto.randomUUID i zwykły JavaScript – działa w obu środowiskach.
//
// utworzSerwer({ adres, kluczPubliczny, klucz, czytajOpis, brakKlucza, czytajPliki, pobierzAdres }) → { obsluz(wiadomosc, stanSesji) }
// obsluz przyjmuje jedną wiadomość JSON-RPC i zwraca odpowiedź (albo null dla powiadomienia).
// czytajPliki(sciezki) – tylko serwer u siebie (stdio): obrazy z dysku (pliki albo folder) → [{ bajty, nazwa }];
// pobierzAdres(adres) – pobieranie obrazu z internetu (domyślnie: tylko https, bez sieci prywatnych).

export const NAZWA = 'makietka';
export const WERSJA = '1.4.0';
export const WERSJE_NOWE = ['2026-07-28'];
export const WERSJE_STARE = ['2025-11-25', '2025-06-18', '2025-03-26'];
export const BLEDY = { PARSE: -32700, ZADANIE: -32600, METODA: -32601, PARAMETRY: -32602, WEWNETRZNY: -32603, WERSJA: -32022, NAGLOWKI: -32020 };
const ADRES_OPISU = 'https://makietka.app/ai/format-makietka.md';
// Czcionki dostępne w każdym projekcie (kopia js/zestaw-czcionek.js – test tests/czcionki-ai.test.cjs pilnuje zgodności):
// [nazwa, rodzaj, pogrubiona 0/1, kursywa 0/1]. Narzędzie czcionki (plan H6).
export const CZCIONKI_MAKIETKI = [["Inter", "bezszeryfowa", 1, 1], ["Open Sans", "bezszeryfowa", 1, 1], ["Montserrat", "bezszeryfowa", 1, 1], ["Lato", "bezszeryfowa", 1, 1], ["Roboto", "bezszeryfowa", 1, 1], ["Source Sans 3", "bezszeryfowa", 1, 1], ["Nunito", "bezszeryfowa", 1, 1], ["Poppins", "bezszeryfowa", 1, 1], ["Raleway", "bezszeryfowa", 1, 1], ["Work Sans", "bezszeryfowa", 1, 1], ["IBM Plex Sans", "bezszeryfowa", 1, 1], ["Fira Sans", "bezszeryfowa", 1, 1], ["Rubik", "bezszeryfowa", 1, 1], ["DM Sans", "bezszeryfowa", 1, 1], ["Barlow", "bezszeryfowa", 1, 1], ["Josefin Sans", "bezszeryfowa", 1, 1], ["Quicksand", "bezszeryfowa", 1, 0], ["Oswald", "wąska", 1, 0], ["Barlow Condensed", "wąska", 1, 1], ["Roboto Condensed", "wąska", 1, 1], ["Bebas Neue", "wąska", 0, 0], ["Anton", "wąska", 0, 0], ["Lora", "szeryfowa", 1, 1], ["Merriweather", "szeryfowa", 1, 1], ["Playfair Display", "szeryfowa", 1, 1], ["Source Serif 4", "szeryfowa", 1, 1], ["EB Garamond", "szeryfowa", 1, 1], ["Cormorant Garamond", "szeryfowa", 1, 1], ["Libre Baskerville", "szeryfowa", 1, 1], ["Crimson Pro", "szeryfowa", 1, 1], ["PT Serif", "szeryfowa", 1, 1], ["Spectral", "szeryfowa", 1, 1], ["Literata", "szeryfowa", 1, 1], ["Alegreya", "szeryfowa", 1, 1], ["Bitter", "szeryfowa", 1, 1], ["Roboto Slab", "szeryfowa", 1, 0], ["Zilla Slab", "szeryfowa", 1, 1], ["DM Serif Display", "szeryfowa", 0, 1], ["Abril Fatface", "szeryfowa", 0, 0], ["Caveat", "odręczna", 1, 0], ["Dancing Script", "odręczna", 1, 0], ["Pacifico", "odręczna", 0, 0], ["Kalam", "odręczna", 1, 0], ["Patrick Hand", "odręczna", 0, 0], ["Amatic SC", "odręczna", 1, 0], ["Comic Neue", "odręczna", 1, 1], ["Pangolin", "odręczna", 0, 0], ["Bangers", "ozdobna", 0, 0], ["Great Vibes", "odręczna", 0, 0], ["Sacramento", "odręczna", 0, 0], ["Courgette", "odręczna", 0, 0], ["Lobster", "odręczna", 0, 0], ["JetBrains Mono", "maszynowa", 1, 1], ["Courier Prime", "maszynowa", 1, 1], ["IBM Plex Mono", "maszynowa", 1, 1]];
export const ADRES_APLIKACJI = 'https://makietka.app/';
// Publiczny adres łącznika (przekaźnik Cloudflare api.makietka.app → Funkcja Edge mcp, cloudflare/api-worker.js).
const ADRES_LACZNIKA = 'https://api.makietka.app/mcp';
// Pliki eksportu zleconego przez AI (#175): przekaźnik wydaje je pod /eksport/<zlecenie>/<sekret>/<nazwa>.
export const ADRES_POBIERANIA = 'https://api.makietka.app/eksport/';

// Te same listy co w aplikacji (js/pola.js, js/style-tekstu.js) – test pilnuje, żeby się zgadzały.
export const POLA_DOKUMENTU = ['nr', 'nr_ogolny', 'nr_w_sekcji', 'liczba_stron', 'liczba_stron_sekcji', 'sekcja', 'nr_sekcji', 'strona', 'projekt', 'format', 'oprawa', 'grzbiet', 'stron_bloku', 'papier', 'rok_kalendarza', 'seria', 'egzemplarz', 'liczba_egzemplarzy', 'data', 'rok', 'poczatek', 'koniec', 'nr_strony', 'rozdzial', 's', 'przypis'];
export const POLA_STYLU = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'lineHeight', 'charSpacing', 'fill', 'textAlign',
  // Skład akapitu (#131) – jak w js/style-tekstu.js.
  'dziel_wyrazy', 'dziel_min', 'dziel_przed', 'dziel_po', 'spojniki', 'zasady_pl', 'lamanie_akapitu', 'wdowy', 'do_siatki', 'inicjal', 'inicjal_czcionka', 'inicjal_kolor', 'tabulatory', 'wielkosc_liter',
  'stroke', 'strokeWidth', 'paintFirst']; // obrys tekstu w stylu (efekt dźwiękowy w komiksie, #367)
export const POLA_FRAGMENTU = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'fill'];
const CZESCI = { sekcje: 'sekcja', wzorce: 'wzorzec', style: 'styl', tabele: 'tabela', serie: 'seria' };

class BladBazy extends Error {}
// Komunikat bazy sprzed wgrywania obrazów przez AI („z klucza nie da się wgrać…”) – dziś obrazy wgrywa wgraj_obraz.
const opisBledu = (w) => [w.blad, ...(w.szczegoly || []).map((s) => `- ${s}`)].join('\n')
  .replaceAll('(z klucza nie da się wgrać nowych obrazów)', '(nowy obraz wgraj najpierw narzędziem wgraj_obraz; listę obrazów daje obrazy_projektu)');

// ---------- Obrazy: wymiary z nagłówka pliku, base64, adresy, SVG ----------

// Kod do znacznika WSPOLNE-KONIEC jest dosłownie taki sam jak w aplikacji (js/obrazy-wspolne.js) – pilnuje tego test.
// WSPOLNE-POCZATEK
// Rodzaj i wymiary obrazu w pikselach (tak, jak pokaże go przeglądarka) z pierwszych bajtów pliku, bez dekodowania.
// Zwraca { typ, szer, wys } (szer/wys = null, gdy nagłówek ich nie podaje) albo null (to nie jest obraz).
export function wymiaryObrazu(bajty) {
  const b = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty);
  const u16 = (i) => (b[i] << 8) | b[i + 1];
  const u16le = (i) => b[i] | (b[i + 1] << 8);
  const u24le = (i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const u32 = (i) => (b[i] * 0x1000000) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
  const ascii = (i, n) => String.fromCharCode(...b.subarray(i, i + n));
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG') return { typ: 'image/png', szer: u32(16), wys: u32(20) };
  if (b.length >= 10 && ascii(0, 4) === 'GIF8') return { typ: 'image/gif', szer: u16le(6), wys: u16le(8) };
  if (b.length >= 16 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const rodzaj = ascii(12, 4);
    if (rodzaj === 'VP8 ' && b.length >= 30) return { typ: 'image/webp', szer: u16le(26) & 0x3fff, wys: u16le(28) & 0x3fff };
    if (rodzaj === 'VP8L' && b.length >= 25) {
      const x = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
      return { typ: 'image/webp', szer: (x & 0x3fff) + 1, wys: ((x >>> 14) & 0x3fff) + 1 };
    }
    if (rodzaj === 'VP8X' && b.length >= 30) return { typ: 'image/webp', szer: u24le(24) + 1, wys: u24le(27) + 1 };
    return { typ: 'image/webp', szer: null, wys: null };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    // Orientacja z EXIF 5–8: przeglądarka obraca zdjęcie, więc szerokość i wysokość się zamieniają.
    let obrot = false;
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i += 1; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m === 0xe1 && ascii(i + 4, 4) === 'Exif') {
        const t0 = i + 10;
        const le = ascii(t0, 2) === 'II';
        const r16 = (j) => (le ? u16le(j) : u16(j));
        const r32 = (j) => (le ? (b[j] | (b[j + 1] << 8) | (b[j + 2] << 16)) + b[j + 3] * 0x1000000 : u32(j));
        const ifd = t0 + r32(t0 + 4);
        const ile = ifd + 2 <= b.length ? r16(ifd) : 0;
        for (let k = 0; k < ile && ifd + 14 + k * 12 <= b.length; k += 1) {
          const e = ifd + 2 + k * 12;
          if (r16(e) === 0x0112) obrot = r16(e + 8) >= 5 && r16(e + 8) <= 8;
        }
      }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        const szer = u16(i + 7);
        const wys = u16(i + 5);
        return { typ: 'image/jpeg', szer: obrot ? wys : szer, wys: obrot ? szer : wys };
      }
      i += 2 + u16(i + 2);
    }
    return { typ: 'image/jpeg', szer: null, wys: null };
  }
  const poczatek = new TextDecoder().decode(b.subarray(0, Math.min(b.length, 16384)));
  if (!/^﻿?\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg\b/i.test(poczatek)) return null;
  const svg = /<svg\b[^>]*>/i.exec(poczatek)[0];
  const atr = (n) => new RegExp(`\\s${n}\\s*=\\s*["']([^"']*)["']`).exec(svg)?.[1];
  const JEDNOSTKI = { '': 1, px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };
  const dlugosc = (v) => {
    const m = /^\s*([0-9]*\.?[0-9]+(?:e[-+]?\d+)?)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(v || '');
    return m ? Number(m[1]) * JEDNOSTKI[(m[2] || '').toLowerCase()] : null;
  };
  const vb = (atr('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const [vw, vh] = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0 ? [vb[2], vb[3]] : [null, null];
  let szer = dlugosc(atr('width'));
  let wys = dlugosc(atr('height'));
  if (szer && !wys && vw) wys = (szer * vh) / vw;
  if (wys && !szer && vw) szer = (wys * vw) / vh;
  if (!szer && !wys && vw) { szer = vw; wys = vh; }
  return { typ: 'image/svg+xml', szer: szer ? Math.max(1, Math.round(szer)) : null, wys: wys ? Math.max(1, Math.round(wys)) : null };
}

export const czyZip = (b) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
export const NAZWA_OBRAZU = /\.(png|jpe?g|webp|gif|svg)$/i;

// Obrazy z archiwum ZIP: [{ nazwa, bajty }] i lista pominiętych nazw. Bez katalogów systemowych (__MACOSX,
// pliki „._…”, .DS_Store), tylko PNG, JPEG, WebP, GIF i SVG. Ochrona przed „bombą ZIP”: limit liczby
// obrazów, rozmiaru jednego obrazu i łącznego rozmiaru po wypakowaniu – liczony naprawdę, nie z nagłówka.
export async function rozpakujZip(bajty, { maksPlikow = 100, maksPlik = 15 * 1024 * 1024, maksRazem = 200 * 1024 * 1024 } = {}) {
  const b = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty);
  const u16 = (i) => b[i] | (b[i + 1] << 8);
  const u32 = (i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 0x1000000;
  let kon = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i -= 1) {
    if (u32(i) === 0x06054b50) { kon = i; break; }
  }
  if (kon < 0) throw new Error('To nie jest poprawne archiwum ZIP.');
  const ile = u16(kon + 10);
  let p = u32(kon + 16);
  if (ile === 0xffff || p === 0xffffffff) throw new Error('Archiwum ZIP64 (bardzo duże) nie jest obsługiwane – spakuj obrazy w mniejsze archiwa.');
  const pliki = [];
  const pominiete = [];
  let razem = 0;
  const dekoder = new TextDecoder();
  for (let n = 0; n < ile; n += 1) {
    if (p + 46 > b.length || u32(p) !== 0x02014b50) throw new Error('Archiwum ZIP jest uszkodzone.');
    const flagi = u16(p + 8);
    const metoda = u16(p + 10);
    const rozmiarSpakowany = u32(p + 20);
    const dlNazwy = u16(p + 28);
    const sciezka = dekoder.decode(b.subarray(p + 46, p + 46 + dlNazwy));
    const lokalny = u32(p + 42);
    p += 46 + dlNazwy + u16(p + 30) + u16(p + 32);
    const nazwa = sciezka.split('/').pop();
    if (sciezka.endsWith('/') || !nazwa) continue;
    if (/(^|\/)__MACOSX\//.test(sciezka) || nazwa.startsWith('._') || nazwa.startsWith('.') || /^(thumbs\.db|desktop\.ini)$/i.test(nazwa)) continue;
    if (!NAZWA_OBRAZU.test(nazwa)) { pominiete.push(nazwa); continue; }
    if (flagi & 1) { pominiete.push(`${nazwa} (zaszyfrowany)`); continue; }
    if (pliki.length >= maksPlikow) throw new Error(`W archiwum jest więcej niż ${maksPlikow} obrazów – podziel je na mniejsze archiwa.`);
    if (u32(lokalny) !== 0x04034b50) throw new Error('Archiwum ZIP jest uszkodzone.');
    const start = lokalny + 30 + u16(lokalny + 26) + u16(lokalny + 28);
    const dane = b.subarray(start, start + rozmiarSpakowany);
    let wynik;
    if (metoda === 0) wynik = dane.slice();
    else if (metoda === 8) {
      const strumien = new Blob([dane]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const czytnik = strumien.getReader();
      const czesci = [];
      let dlugosc = 0;
      for (;;) {
        const { done, value } = await czytnik.read();
        if (done) break;
        dlugosc += value.length;
        if (dlugosc > maksPlik || razem + dlugosc > maksRazem) {
          await czytnik.cancel().catch(() => {});
          throw new Error(dlugosc > maksPlik ? `„${nazwa}” po wypakowaniu ma ponad ${Math.round(maksPlik / 1048576)} MB.` : `Obrazy w archiwum po wypakowaniu mają razem ponad ${Math.round(maksRazem / 1048576)} MB.`);
        }
        czesci.push(value);
      }
      wynik = new Uint8Array(dlugosc);
      let o = 0;
      for (const c of czesci) { wynik.set(c, o); o += c.length; }
    } else { pominiete.push(`${nazwa} (nieznany sposób pakowania)`); continue; }
    if (wynik.length > maksPlik) throw new Error(`„${nazwa}” ma ponad ${Math.round(maksPlik / 1048576)} MB.`);
    razem += wynik.length;
    if (razem > maksRazem) throw new Error(`Obrazy w archiwum po wypakowaniu mają razem ponad ${Math.round(maksRazem / 1048576)} MB.`);
    pliki.push({ nazwa, bajty: wynik });
  }
  return { pliki, pominiete };
}

// „zdjęcie.jpg” → „zdjęcie (2).jpg”, „zdjęcie (3).jpg”… – pierwsza nazwa, dla której zajeta(nazwa) jest fałszem.
export function wolnaNazwaWsrod(nazwa, zajeta) {
  if (!zajeta(nazwa)) return nazwa;
  const m = String(nazwa).match(/^(.*?)(?: \((\d+)\))?(\.[a-z0-9]{2,5})?$/i);
  for (let n = Math.max(2, Number(m[2] || 1) + 1); ; n += 1) {
    const kandydat = `${m[1]} (${n})${m[3] || ''}`;
    if (!zajeta(kandydat)) return kandydat;
  }
}

// Powtórzone obrazy (okno „Obrazy projektu” → „Uporządkuj”, narzędzie AI uporzadkuj_obrazy).
// obrazy: [[id, opis]] (bez czcionek); kolejnosc: identyfikatory w kolejności zasobów projektu;
// wskazuje(id): czy dane, szukając obrazu jego nazwą, trafiają właśnie w ten obraz.
// Zwraca { kopie: [[zostaje, [kopie]]], nazwy: [[zostaje, [do zmiany nazwy]]] } – kopie to ten sam plik (skrót),
// nazwy – inne pliki o tej samej nazwie (wielkość liter bez znaczenia).
export function grupujPowtorzenia(obrazy, kolejnosc, wskazuje) {
  const wybierz = (ids) => {
    const k = kolejnosc.filter((id) => ids.includes(id));
    return k.find((id) => wskazuje(id)) || k[0];
  };
  const grupy = (klucz, bez = new Set()) => {
    const m = new Map();
    for (const [id, z] of obrazy) {
      if (bez.has(id)) continue;
      const k = klucz(z);
      if (k) m.set(k, [...(m.get(k) || []), id]);
    }
    return [...m.values()].filter((ids) => ids.length > 1).map((ids) => { const z = wybierz(ids); return [z, ids.filter((id) => id !== z)]; });
  };
  const kopie = grupy((z) => z.skrot || null);
  const usuwane = new Set(kopie.flatMap(([, k]) => k));
  const nazwy = grupy((z) => String(z.nazwa ?? '').trim().toLowerCase(), usuwane);
  return { kopie, nazwy };
}
// Skrót SHA-256 treści (szesnastkowo) – ten sam plik ma ten sam skrót (duplikaty, sprawdzenie sklejonych kawałków).
export async function skrotSha256(bajty) {
  const b = await crypto.subtle.digest('SHA-256', bajty);
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
// Najwięcej obrazów w jednym projekcie (limit konta, decyzja #92; ta sama wartość w bazie: limity_aplikacji()).
export const LIMIT_OBRAZOW_W_PROJEKCIE = 1000;
// WSPOLNE-KONIEC

const ROZSZERZENIA = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
const MAKS_OBRAZ = 25 * 1024 * 1024; // jeden obraz
const KAWALEK = 512 * 1024; // większy plik idzie do bazy w kawałkach (ai_wgraj_poczatek / _czesc / _koniec)
const MAKS_POBRANIE = 50 * 1024 * 1024; // jeden plik pobierany z adresu albo wysyłany wprost (może być ZIP-em)
const MAKS_BASE64 = 5 * 1024 * 1024;
const LIMITY_ZIP = { maksPlikow: 100, maksPlik: MAKS_OBRAZ, maksRazem: 200 * 1024 * 1024 };

// Linki udostępniania z Dysku Google i Dropboxa („każdy z linkiem”) → adres samego pliku.
// Zwraca { adres } albo { blad } (np. folder z Dysku).
export function bezposredniAdres(adres) {
  let u;
  try { u = new URL(String(adres).trim()); } catch { return { adres }; }
  const h = u.hostname.toLowerCase();
  if (h === 'drive.google.com' || h === 'docs.google.com') {
    if (/\/folders\//.test(u.pathname)) return { blad: 'To link do folderu na Dysku Google – nie pobiorę całego folderu. Podaj linki do pojedynczych plików albo spakuj obrazy do ZIP-a i podaj link do niego.' };
    const id = /\/file\/d\/([A-Za-z0-9_-]+)/.exec(u.pathname)?.[1] || u.searchParams.get('id');
    if (id) return { adres: `https://drive.google.com/uc?export=download&id=${id}` };
  }
  if (h === 'dropbox.com' || h === 'www.dropbox.com') {
    // dl=1 – plik zamiast strony podglądu; folder (/scl/fo/) Dropbox oddaje wtedy jako ZIP.
    u.searchParams.set('dl', '1');
    return { adres: u.href };
  }
  return { adres: u.href };
}

export function naBase64(bajty) {
  let s = '';
  for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
  return btoa(s);
}
function zBase64(tekst) {
  const czysty = String(tekst || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  let s;
  try { s = atob(czysty); } catch { throw new BladBazy('„dane_base64” nie jest poprawnym base64.'); }
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) b[i] = s.charCodeAt(i);
  return b;
}

// Adres obrazu z internetu: tylko https i tylko adresy publiczne (nie localhost ani sieci prywatne).
// Zwraca komunikat błędu albo null.
export function sprawdzAdres(adres) {
  let u;
  try { u = new URL(adres); } catch { return 'To nie jest poprawny adres internetowy.'; }
  if (u.protocol !== 'https:') return 'Obrazy pobieram tylko z adresów https://.';
  if (u.username || u.password) return 'Adres nie może zawierać loginu ani hasła.';
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const lokalny = 'Ten adres prowadzi do sieci lokalnej albo prywatnej – podaj adres publiczny.';
  if (!h || h === 'localhost' || /\.(localhost|local|internal|lan|home|intranet)$/.test(h) || (!h.includes('.') && !h.includes(':'))) return lokalny;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19))) return lokalny;
  }
  if (h.includes(':') && (h === '::' || h === '::1' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:') || h.startsWith('64:ff9b:'))) return lokalny;
  return null;
}

// Pobranie obrazu z adresu: każde przekierowanie sprawdzane osobno, limit czasu i rozmiaru.
// Zwraca { bajty, nazwa } – nazwa z ostatniego członu adresu.
export async function pobierzZAdresu(adres) {
  let biezacy = adres;
  for (let skok = 0; skok < 4; skok += 1) {
    const blad = sprawdzAdres(biezacy);
    if (blad) throw new BladBazy(blad);
    const przerwij = new AbortController();
    const czas = setTimeout(() => przerwij.abort(), 20000);
    try {
      const odp = await fetch(biezacy, { redirect: 'manual', signal: przerwij.signal, headers: { accept: 'image/*' } });
      if (odp.status >= 300 && odp.status < 400 && odp.headers.get('location')) {
        biezacy = new URL(odp.headers.get('location'), biezacy).href;
        continue;
      }
      if (!odp.ok) throw new BladBazy(`Serwer pod tym adresem odpowiedział błędem ${odp.status}${odp.status === 403 || odp.status === 401 ? ' – plik nie jest udostępniony publicznie (ustaw „każdy, kto ma link”)' : ''}.`);
      const zaDuzy = 'Plik pod tym adresem jest za duży (najwyżej 50 MB; jeden obraz – 25 MB).';
      if (Number(odp.headers.get('content-length') || 0) > MAKS_POBRANIE) throw new BladBazy(zaDuzy);
      const czesci = [];
      let razem = 0;
      const czytnik = odp.body.getReader();
      for (;;) {
        const { done, value } = await czytnik.read();
        if (done) break;
        razem += value.length;
        if (razem > MAKS_POBRANIE) { przerwij.abort(); throw new BladBazy(zaDuzy); }
        czesci.push(value);
      }
      const bajty = new Uint8Array(razem);
      let o = 0;
      for (const c of czesci) { bajty.set(c, o); o += c.length; }
      // Nazwa: z nagłówka Content-Disposition (Dysk Google, Dropbox), inaczej z ostatniego członu adresu.
      const naglowek = odp.headers.get('content-disposition') || '';
      let czlon = /filename\*=UTF-8''([^;]+)/i.exec(naglowek)?.[1] || /filename="?([^";]+)"?/i.exec(naglowek)?.[1]
        || new URL(biezacy).pathname.split('/').filter(Boolean).pop() || '';
      try { czlon = decodeURIComponent(czlon); } catch { /* zostaje zakodowany */ }
      return { bajty, nazwa: czlon, typ: odp.headers.get('content-type') || '' };
    } catch (e) {
      if (e instanceof BladBazy) throw e;
      throw new BladBazy(e.name === 'AbortError' ? 'Pobieranie obrazu trwało za długo (ponad 20 s).' : `Nie udało się pobrać obrazu: ${e.message}`);
    } finally {
      clearTimeout(czas);
    }
  }
  throw new BladBazy('Za dużo przekierowań pod tym adresem.');
}

// SVG od AI: musi mieć wymiary (inaczej przeglądarka pokaże go jako obraz zerowej wielkości) i nie może
// mieć skryptów. Brakujące width/height dopisujemy z viewBox.
function przygotujSvg(kod) {
  let tekst = String(kod || '').trim();
  if (!/<svg\b/i.test(tekst)) throw new BladBazy('„svg” musi zawierać kod rysunku <svg …>…</svg>.');
  if (/<script\b|\son[a-z]+\s*=|javascript:/i.test(tekst)) throw new BladBazy('Rysunek SVG nie może zawierać skryptów ani zdarzeń (onclick itp.).');
  const otw = /<svg\b[^>]*>/i.exec(tekst)[0];
  let nowy = otw;
  if (!/\sxmlns\s*=/.test(otw)) nowy = nowy.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  tekst = tekst.replace(otw, () => nowy);
  const w = wymiaryObrazu(new TextEncoder().encode(tekst));
  if (!w?.szer || !w?.wys) throw new BladBazy('Rysunek SVG potrzebuje viewBox albo width i height.');
  let zWymiarami = nowy;
  if (!/\swidth\s*=/.test(nowy)) zWymiarami = zWymiarami.replace(/<svg\b/i, `<svg width="${w.szer}"`);
  if (!/\sheight\s*=/.test(nowy)) zWymiarami = zWymiarami.replace(/<svg\b/i, `<svg height="${w.wys}"`);
  return new TextEncoder().encode(tekst.replace(nowy, () => zWymiarami));
}

// Nazwa pliku: bez ścieżki, z rozszerzeniem pasującym do rodzaju (dopisanym albo poprawionym).
function nazwaPliku(nazwa, typ) {
  let n = String(nazwa || '').split(/[\\/]/).pop().replace(/[\u0000-\u001f]/g, '').trim() || 'obraz';
  const roz = /\.([a-z0-9]{2,5})$/i.exec(n)?.[1]?.toLowerCase();
  const typRoz = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }[roz];
  if (typRoz !== typ) n = `${typRoz ? n.replace(/\.[a-z0-9]{2,5}$/i, '') : n}.${ROZSZERZENIA[typ]}`;
  return n.slice(0, 150);
}

// Obrazy projektu (bez czcionek): [[id, opis]] w kolejności zasobów (tak szukają dane).
const obrazyWKolejnosci = (p) => {
  const czcionki = new Set((p.czcionki || []).map((c) => c.id));
  return Object.entries(p.zasoby || {}).filter(([id, z]) => z && !czcionki.has(id) && z.rodzaj !== 'dane'); // bez plików źródłowych danych (#227)
};
// To samo, po nazwie – do list dla AI.
const obrazyWProjekcie = (p) => obrazyWKolejnosci(p).sort(([, a], [, b]) => String(a.nazwa).localeCompare(String(b.nazwa), 'pl', { numeric: true }));
const pelna = (n) => String(n ?? '').trim().toLowerCase();

// Ta sama reguła co w aplikacji (js/nazwy-obrazow.js): pełna nazwa, a bez rozszerzenia – tylko jeden pasujący plik.
function obrazZNazwy(p, wartosc) {
  const szukana = pelna(wartosc);
  if (!szukana) return null;
  const wpisy = obrazyWKolejnosci(p);
  const dokladny = wpisy.find(([, z]) => pelna(z.nazwa) === szukana);
  if (dokladny) return dokladny[0];
  const rdzen = wpisy.filter(([, z]) => pelna(z.nazwa).replace(/\.[a-z0-9]{2,5}$/, '') === szukana);
  return rdzen.length === 1 ? rdzen[0][0] : null;
}

// Gdzie obraz jest użyty: { strony: [nr], wzorce: [nazwa], dane: [nazwa tabeli], uzyty, opis }.
function uzycia(p, id) {
  const ma = (obiekty) => { let jest = false; wszystkie(obiekty, (o) => { if (o.zasob === id) jest = true; }); return jest; };
  const strony = p.strony.map((s, i) => (ma(s.obiekty) ? i + 1 : null)).filter(Boolean);
  const wzorce = (p.wzorce || []).filter((w) => ma(w.obiekty)).map((w) => w.nazwa);
  const dane = (p.tabele || []).filter((t) => (t.wiersze || []).some((w) => (w || []).some((k) => obrazZNazwy(p, k) === id))).map((t) => t.nazwa);
  const czesci = [];
  if (strony.length) czesci.push(`${strony.length === 1 ? 'strona' : 'strony'} ${strony.slice(0, 8).join(', ')}${strony.length > 8 ? '…' : ''}`);
  if (wzorce.length) czesci.push(`${wzorce.length === 1 ? 'wzorzec' : 'wzorce'} ${wzorce.map((n) => `„${n}”`).join(', ')}`);
  if (dane.length) czesci.push(`w danych (${dane.map((n) => `„${n}”`).join(', ')})`);
  return { strony, wzorce, dane, uzyty: czesci.length > 0, opis: czesci.join(' · ') || 'nieużywany' };
}
const uzyciaObrazu = (p, id) => uzycia(p, id).opis;

// Komórki tabel wskazujące obraz (według reguły obrazZNazwy) → [[tabela, wiersz, kolumna]].
function komorkiObrazu(p, id) {
  const wynik = [];
  for (const t of p.tabele || []) {
    (t.wiersze || []).forEach((w, r) => (w || []).forEach((k, c) => { if (String(k ?? '').trim() && obrazZNazwy(p, k) === id) wynik.push([t, r, c]); }));
  }
  return wynik;
}

// Przepina elementy stron i wzorców (w miejscu). Zwraca { strony: [zmienione strony], wzorce: bool }.
function przepnijElementy(p, mapa, nazwy = new Map()) {
  const strony = [];
  let wzorce = false;
  const zmien = (obiekty) => {
    let z = false;
    wszystkie(obiekty, (o) => {
      const nowe = mapa.get(o.zasob);
      if (!nowe) return;
      o.zasob = nowe;
      if (typeof o.src === 'string' && o.src.startsWith('zasob:')) o.src = `zasob:${nowe}`;
      if (nazwy.has(nowe) && o.type === 'image' && !o.pole) o.nazwa = nazwy.get(nowe);
      z = true;
    });
    return z;
  };
  for (const s of p.strony) if (zmien(s.obiekty)) strony.push(s);
  for (const w of p.wzorce || []) if (zmien(w.obiekty)) wzorce = true;
  return { strony, wzorce };
}

// Wymiary obrazu w pikselach: z opisu zasobu, a dla starszych obrazów – z elementu, który już go pokazuje
// (element obrazu bez przycięcia ma width/height oryginału).
function pikseleObrazu(p, id) {
  const z = p.zasoby?.[id];
  if (z?.szer > 0 && z?.wys > 0) return { szer: z.szer, wys: z.wys };
  let wynik = null;
  for (const c of [...p.strony, ...(p.wzorce || [])]) {
    wszystkie(c.obiekty, (o) => {
      if (!wynik && o.zasob === id && !o.pole && o.width > 0 && o.height > 0 && !o.cropX && !o.cropY) wynik = { szer: o.width, wys: o.height };
    });
  }
  return wynik;
}

// Element obrazu – tak jak wstawia go aplikacja (js/edytor.js: dodajObraz; „Podmień zdjęcie” z wypełnieniem
// ramki). Wymiary w mm; px – piksele obrazu; strona – { szer, wys } w mm.
function elementObrazu(id, nazwa, px, strona, { x, y, szerokosc, wysokosc, dopasowanie }) {
  const nw = px.szer;
  const nh = px.wys;
  const o = { id: noweId('o'), type: 'image', zasob: id, src: `zasob:${id}`, nazwa, cropX: 0, cropY: 0 };
  const W = Number(szerokosc) || 0;
  const H = Number(wysokosc) || 0;
  const lewo = Number.isFinite(Number(x)) && x !== null && x !== undefined ? Number(x) : null;
  const gora = Number.isFinite(Number(y)) && y !== null && y !== undefined ? Number(y) : null;
  if (W > 0 && H > 0) {
    if (dopasowanie === 'wypelnij') {
      const s = Math.max(W / nw, H / nh);
      Object.assign(o, { width: W / s, height: H / s, cropX: (nw - W / s) / 2, cropY: (nh - H / s) / 2, scaleX: s, scaleY: s });
      o.left = lewo ?? (strona.szer - W) / 2;
      o.top = gora ?? (strona.wys - H) / 2;
    } else {
      const s = Math.min(W / nw, H / nh);
      Object.assign(o, { width: nw, height: nh, scaleX: s, scaleY: s });
      o.left = (lewo ?? (strona.szer - W) / 2) + (W - nw * s) / 2;
      o.top = (gora ?? (strona.wys - H) / 2) + (H - nh * s) / 2;
    }
  } else {
    const s = W > 0 ? W / nw : H > 0 ? H / nh : Math.min((strona.szer * 0.6) / nw, (strona.wys * 0.6) / nh);
    Object.assign(o, { width: nw, height: nh, scaleX: s, scaleY: s });
    o.left = lewo ?? (strona.szer - nw * s) / 2;
    o.top = gora ?? (strona.wys - nh * s) / 2;
  }
  for (const k of ['left', 'top', 'width', 'height', 'cropX', 'cropY']) o[k] = Math.round(o[k] * 1000) / 1000;
  for (const k of ['scaleX', 'scaleY']) o[k] = Math.round(o[k] * 1e6) / 1e6;
  return o;
}

// Wymiary strony (mm) dla miejsca „strona:<id>” albo „wzorzec:<id>”.
function wymiaryMiejsca(p, gdzie) {
  const [rodzaj, id] = String(gdzie).split(':');
  let sekcja;
  if (rodzaj === 'strona') sekcja = (p.sekcje || []).find((s) => s.id === p.strony.find((x) => x.id === id)?.sekcja);
  else sekcja = (p.sekcje || []).find((s) => (s.wzorce || []).includes(id)) || p.sekcje?.[0];
  return { szer: sekcja?.wydruk?.szerokosc_mm || 210, wys: sekcja?.wydruk?.wysokosc_mm || 297 };
}

// ---------- Pomocnicze operacje na projekcie ----------

const noweId = (prefiks) => `${prefiks}_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;

// Pusty projekt – ten sam, który tworzy w aplikacji okno „Nowy projekt” (js/projekt.js: nowyProjekt, normalizujWydruk;
// js/style-tekstu.js: domyslneStyle). Test pilnuje zgodności pól.
export const FORMATY_PROJEKTU = { A4: [210, 297], A5: [148, 210], A6: [105, 148], B5: [176, 250], Kwadrat: [210, 210] };
const ptMm = (pt) => (pt * 25.4) / 72;
export function pustyProjekt({ nazwa = 'Nowy projekt', format = 'A5', szerokosc = null, wysokosc = null, orientacja = 'pion', uklad = 'pojedyncze', spad = 3, marginesy = 10 } = {}) {
  let [w, h] = FORMATY_PROJEKTU[format] || [Number(szerokosc) || 148, Number(wysokosc) || 210];
  if (orientacja === 'poziom' && h > w) [w, h] = [h, w];
  if (orientacja === 'pion' && w > h) [w, h] = [h, w];
  const m = Math.max(0, Number.isFinite(Number(marginesy)) ? Number(marginesy) : 10);
  const sekcja = {
    id: noweId('sek'),
    nazwa: 'Główna',
    wydruk: {
      format: FORMATY_PROJEKTU[format] ? format : 'wlasny', szerokosc_mm: Math.max(20, w), wysokosc_mm: Math.max(20, h),
      spad_mm: Math.max(0, Number.isFinite(Number(spad)) ? Number(spad) : 3), marginesy: { gora: m, dol: m, wewnetrzny: m, zewnetrzny: m }, znaki_ciecia: true,
    },
    uklad: uklad === 'rozkladowki' ? 'rozkladowki' : 'pojedyncze',
    pierwsza: 'prawa',
    wzorce: [],
    numeracja: { tryb: 'ciagla', od: 1 },
  };
  const podstawa = { fontFamily: 'Inter', fontWeight: 'normal', fontStyle: 'normal', underline: false, linethrough: false, lineHeight: 1.25, charSpacing: 0, fill: '#1a1a1a', textAlign: 'left' };
  return {
    wersja: 3,
    id: globalThis.crypto.randomUUID(),
    nazwa,
    sekcje: [sekcja],
    wzorce: [],
    style: [
      { id: noweId('st'), nazwa: 'Tytuł', ...podstawa, fontFamily: 'Playfair Display', fontSize: ptMm(28), fontWeight: 'bold', lineHeight: 1.1 },
      { id: noweId('st'), nazwa: 'Nagłówek', ...podstawa, fontSize: ptMm(16), fontWeight: 'bold', lineHeight: 1.2 },
      { id: noweId('st'), nazwa: 'Tekst', ...podstawa, fontSize: ptMm(10.5), lineHeight: 1.35 },
      { id: noweId('st'), nazwa: 'Podpis', ...podstawa, fontSize: ptMm(8), fill: '#6b6861', charSpacing: 20 },
    ],
    style_znakowe: [], // style znakowe – wygląd fragmentu tekstu (#131)
    tabele: [],
    serie: [],
    strony: [{ id: noweId('s'), nazwa: 'Strona 1', sekcja: sekcja.id, wzorce: 'z_sekcji', obiekty: [], tlo: null }],
    widok: null,
    zasoby: {},
    zmieniono: new Date().toISOString(),
  };
}
const kopia = (x) => JSON.parse(JSON.stringify(x));

function znajdz(lista, id, co) {
  const x = (lista || []).find((y) => y.id === id);
  if (!x) throw new BladBazy(`Nie ma ${co} o id „${id}”. Sprawdź identyfikatory narzędziem przeglad_projektu.`);
  return x;
}

// Scalenie pól: wartość null usuwa pole; identyfikatora nie da się zmienić.
function scal(obiekt, pola) {
  for (const [k, v] of Object.entries(pola || {})) {
    if (k === 'id') continue;
    if (v === null) delete obiekt[k]; else obiekt[k] = v;
  }
  return obiekt;
}

// Element dodawany przez AI: id, typ małymi literami, tekst bez obrysu (inaczej ramka jest szersza).
// Elementy z biblioteki (#131A) podawane skrótem: { type: 'kalendarz' | 'wykres' | 'kolaz', left, top, … }.
// Zamieniamy je na grupę z opisem; treść (dni, słupki, pola) układa aplikacja przy wczytaniu strony.
const GRUPA_STALA = { type: 'group', layoutManager: { type: 'layoutManager', strategy: 'fixed' }, subTargetCheck: false, interactive: false };
const KOMORKA = { type: 'textbox', text: '', strokeWidth: 0, fontFamily: 'Inter', fontSize: Math.round((9 * 25.4 / 72) * 1000) / 1000, fill: '#1a1a1a', lineHeight: 1.15, textAlign: 'center', wyrownanie_pion: 'srodek', width: 10 };
function elementZBiblioteki(o) {
  if (o.type === 'kalendarz') {
    const k = o.kalendarz || {};
    const szer = Number(o.width) > 20 ? Number(o.width) : 120;
    const kolumny = 7 + (k.tygodnie ? 1 : 0);
    const wiersze = 8;
    const wiersz = Number(k.wiersz_dnia) || 9;
    return {
      ...GRUPA_STALA, id: o.id, left: o.left ?? 10, top: o.top ?? 10, width: szer, height: wiersz * wiersze,
      kalendarz: k,
      tabela: { kolumny: Array.from({ length: kolumny }, () => Math.round((szer / kolumny) * 100) / 100), wiersze: Array.from({ length: wiersze }, () => wiersz), naglowek: true, linia: { kolor: '#c9c6bf', grubosc: 0.2 } },
      objects: Array.from({ length: kolumny * wiersze }, () => ({ ...KOMORKA, id: noweId('o') })),
    };
  }
  // Spis treści albo skorowidz (#131B): tekst, który aplikacja składa sama z nagłówków albo haseł.
  if (o.type === 'spis' || o.type === 'skorowidz') {
    const ksiazka = o.type === 'spis' ? { rodzaj: 'spis', poziomy: Math.min(3, Math.max(1, Number(o.poziomy) || 2)), kropki: o.kropki !== false } : { rodzaj: 'skorowidz', kropki: o.kropki !== false };
    return {
      type: 'textbox', id: o.id, left: o.left ?? 15, top: o.top ?? 20, width: Number(o.width) > 20 ? Number(o.width) : 110,
      text: o.type === 'spis' ? 'Spis treści' : 'Skorowidz', fontFamily: o.fontFamily || 'Inter', fontSize: o.fontSize || Math.round((10.5 * 25.4 / 72) * 1000) / 1000,
      fill: o.fill || '#1a1a1a', lineHeight: 1.5, styles: [], ksiazka,
    };
  }
  if (o.type === 'wykres') {
    const w = o.wykres || {};
    return { ...GRUPA_STALA, id: o.id, left: o.left ?? 10, top: o.top ?? 10, width: w.szerokosc || 100, height: w.wysokosc || 60, wykres: { szerokosc: 100, wysokosc: 60, ...w }, objects: [] };
  }
  // Dymek (#360): { type: 'dymek', tekst, left, top, ogonek: { x, y } (punkt na stronie, mm), rodzaj, width } –
  // jedna ramka tekstu, dymek wokół rysuje aplikacja (rośnie razem z tekstem). Szerokość bez podania – z długości tekstu.
  if (o.type === 'dymek') {
    const rodzaj = ['mowa', 'mysl', 'krzyk', 'szept', 'narracja'].includes(o.rodzaj) ? o.rodzaj : 'mowa';
    const tekst = String(o.tekst ?? o.text ?? '');
    const pismo = Number(o.fontSize) > 0 ? Number(o.fontSize) : Math.round((11 * 25.4 / 72) * 1000) / 1000;
    const najdluzszy = Math.max(...tekst.split('\n').map((l) => l.length), 4);
    const szer = Number(o.width) > 5 ? Number(o.width) : Math.round(Math.min(60, Math.max(18, najdluzszy * pismo * 0.52 + 2)) * 10) / 10;
    const left = Number(o.left) || 0; const top = Number(o.top) || 0;
    const og = o.ogonek && Number.isFinite(Number(o.ogonek.x)) && Number.isFinite(Number(o.ogonek.y)) && rodzaj !== 'narracja'
      ? { x: Math.round((Number(o.ogonek.x) - left) * 100) / 100, y: Math.round((Number(o.ogonek.y) - top) * 100) / 100 } : null;
    return {
      type: 'textbox', id: o.id, left, top, width: szer, text: tekst, angle: o.angle || 0,
      fontFamily: o.fontFamily || 'Inter', fontSize: pismo, fontWeight: o.fontWeight || (rodzaj === 'krzyk' ? 'bold' : 'normal'),
      fill: o.fill || '#1a1a1a', lineHeight: 1.15, textAlign: rodzaj === 'narracja' ? 'left' : 'center', strokeWidth: 0, styles: [],
      spojniki: true, zasady_pl: true, nazwa: o.nazwa || 'Dymek',
      dymek: { rodzaj, ogonek: og, wypelnienie: o.wypelnienie || '#ffffff', obrys: o.obrys || '#1a1a1a', grubosc: Number(o.grubosc) >= 0 ? Number(o.grubosc) : 0.35 },
    };
  }
  if (o.type === 'kolaz') {
    const k = { uklad: '2-pion', odstep: 2, zaokraglenie: 0, szerokosc: 120, wysokosc: 90, ...(o.kolaz || {}) };
    const ile = Math.max(1, Math.min(9, Number(o.pola) || ({ '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '9': 9 }[String(k.uklad).split('-')[0]] || 2)));
    return {
      ...GRUPA_STALA, id: o.id, left: o.left ?? 10, top: o.top ?? 10, width: k.szerokosc, height: k.wysokosc, kolaz: k, nazwa: o.nazwa || 'Kolaż',
      objects: Array.from({ length: ile }, (_, i) => ({ type: 'rect', id: noweId('o'), left: 0, top: 0, width: 10, height: 10, fill: '#e8e6e1', strokeWidth: 0, strokeUniform: true, nazwa: `Pole ${i + 1}` })),
    };
  }
  return o;
}

function przygotujElement(e) {
  let o = kopia(e);
  if (!o.id) o.id = noweId('o');
  if (typeof o.type === 'string') o.type = o.type.toLowerCase();
  o = elementZBiblioteki(o);
  if (o.type === 'textbox' && o.strokeWidth === undefined) o.strokeWidth = 0;
  // Kod QR / EAN-13 / ISBN (#128): { type: 'kod', rodzaj, tresc, … } – grupa z opisem; rysunek doda aplikacja.
  if (o.type === 'kod' || (o.type === 'group' && o.kod)) {
    const k = { ...(o.kod || {}), ...Object.fromEntries(['rodzaj', 'tresc', 'korekcja', 'kolor', 'tlo', 'cisza', 'napis', 'szerokosc', 'wysokosc'].filter((x) => o[x] !== undefined).map((x) => [x, o[x]])) };
    k.rodzaj = k.rodzaj === 'ean' ? 'ean' : 'qr';
    if (!k.typ) { k.typ = 'tekst'; k.dane = { tekst: String(k.tresc ?? '') }; }
    const szer = Number(k.szerokosc) > 0 ? Number(k.szerokosc) : (k.rodzaj === 'ean' ? 37.29 : 25);
    k.szerokosc = szer;
    k.wysokosc = k.rodzaj === 'qr' ? szer : (Number(k.wysokosc) > 0 ? Number(k.wysokosc) : 25.93);
    delete k.narysowano;
    return { type: 'group', id: o.id, left: Number(o.left) || 0, top: Number(o.top) || 0, width: k.szerokosc, height: k.wysokosc, angle: o.angle || 0, nazwa: o.nazwa, kod: k, objects: [] };
  }
  // Tekst bez kroju, rozmiaru albo koloru dostawał na płótnie domyślne Fabric (Times New Roman, 40 mm) –
  // uzupełniamy tym, co daje przycisk „Tekst” w aplikacji (Inter 14 pt, ciemnoszary, interlinia 1,2).
  if (['textbox', 'i-text', 'text'].includes(o.type)) {
    const domyslne = { fontFamily: 'Inter', fontSize: Math.round((14 * 25.4 / 72) * 1000) / 1000, fill: '#1a1a1a', lineHeight: 1.2, textAlign: 'left' };
    for (const [k, v] of Object.entries(domyslne)) if (o[k] === undefined) o[k] = v;
    if (o.type === 'textbox' && !(o.width > 0)) o.width = 80;
  }
  return o;
}

// Miejsce z elementami: „strona:<id>” albo „wzorzec:<id>”. Zwraca { lista elementów, zmiany do zapisu }.
function miejsce(projekt, gdzie) {
  const m = /^(strona|wzorzec):(.+)$/.exec(String(gdzie || ''));
  if (!m) throw new BladBazy('„gdzie” to „strona:<id strony>” albo „wzorzec:<id wzorca>”.');
  if (m[1] === 'strona') {
    const s = znajdz(projekt.strony, m[2], 'strony');
    s.obiekty = Array.isArray(s.obiekty) ? s.obiekty : [];
    return { obiekty: s.obiekty, zmiany: () => ({ strony: [s] }), nazwa: `strona „${s.nazwa || s.id}”` };
  }
  const w = znajdz(projekt.wzorce, m[2], 'wzorca');
  w.obiekty = Array.isArray(w.obiekty) ? w.obiekty : [];
  return { obiekty: w.obiekty, zmiany: () => ({ wzorce: projekt.wzorce }), nazwa: `wzorzec „${w.nazwa || w.id}”` };
}

// Prostokąt elementu w mm (lewy górny róg, bez obrotu) i przesunięcie – do wyrównywania i rozmieszczania.
function ramkaElementu(o) {
  const sx = Math.abs(o.scaleX ?? 1);
  const sy = Math.abs(o.scaleY ?? 1);
  const w = (o.type === 'ellipse' && o.rx != null ? 2 * o.rx : (o.width || 0)) * sx;
  const h = (o.type === 'ellipse' && o.ry != null ? 2 * o.ry : (o.height || 0)) * sy;
  return { x: o.left || 0, y: o.top || 0, w, h };
}
function przesun(o, dx, dy) {
  o.left = Math.round(((o.left || 0) + dx) * 1000) / 1000;
  o.top = Math.round(((o.top || 0) + dy) * 1000) / 1000;
}

// Wszystkie elementy w drzewie (także w grupach i komórkach tabeli).
function wszystkie(obiekty, fn) {
  for (const o of obiekty || []) {
    fn(o);
    if (Array.isArray(o.objects)) wszystkie(o.objects, fn);
  }
}
const teksty = (obiekty, fn) => wszystkie(obiekty, (o) => { if (typeof o.text === 'string') fn(o); });

// Jak zastosujStylWProjekcie w aplikacji: wartości stylu trafiają do tekstów, które go używają;
// formatowanie fragmentów w polach stylu ustępuje stylowi. Zwraca zmiany stron i wzorców.
function przepiszStyl(projekt, styl, { odepnij = false } = {}) {
  const strony = [];
  let wzorce = false;
  let ile = 0;
  const wartosci = Object.fromEntries(POLA_STYLU.filter((k) => styl[k] !== undefined).map((k) => [k, styl[k]]));
  const zmien = (o) => {
    if (o.styl !== styl.id) return false;
    ile += 1;
    if (odepnij) { delete o.styl; return true; }
    Object.assign(o, wartosci, { scaleX: 1, scaleY: 1 });
    const style = Array.isArray(o.styles) ? o.styles.map((s) => s.style) : Object.values(o.styles || {}).flatMap((w) => Object.values(w || {}));
    for (const s of style) for (const k of POLA_FRAGMENTU) if (s) delete s[k];
    return true;
  };
  for (const s of projekt.strony) { let z = false; wszystkie(s.obiekty, (o) => { z = zmien(o) || z; }); if (z) strony.push(s); }
  for (const w of projekt.wzorce || []) wszystkie(w.obiekty, (o) => { wzorce = zmien(o) || wzorce; });
  return { zmiany: { ...(strony.length ? { strony } : {}), ...(wzorce ? { wzorce: projekt.wzorce } : {}) }, ile };
}

const krotko = (t, n = 60) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n)}…` : s; };

const opisWaznosci = (d) => (!d || /infinity/i.test(String(d)) ? 'klucz bez terminu' : `klucz ważny do ${d}`);

function przeglad(w) {
  const p = w.projekt;
  const wiersz = (o) => `${o.id} (${o.type}${o.text != null ? `: „${krotko(o.text, 40)}”` : ''}${o.zasob ? `: obraz ${p.zasoby?.[o.zasob]?.nazwa || o.zasob}` : ''}${o.tabela ? ': tabela' : ''})`;
  return [
    `Projekt „${p.nazwa}” (id ${p.id}) – wersja ${w.wersja}. Dostęp: ${w.dostep.rola === 'edycja' ? 'czytanie i zmiany' : 'tylko czytanie'}, ${opisWaznosci(w.dostep.wazny_do)}.`,
    `Sekcje: ${(p.sekcje || []).map((s) => `${s.id} „${s.nazwa}” ${s.wydruk?.szerokosc_mm}×${s.wydruk?.wysokosc_mm} mm, ${s.uklad || 'pojedyncze'}${s.okladka ? `, okładka ${s.okladka.oprawa}${s.okladka.wynik ? ` (grzbiet ${s.okladka.wynik.grzbiet} mm, ${s.okladka.wymiary?.tryb === 'rozmiar' ? 'rozmiar wpisany' : s.okladka.wymiary?.tryb === 'grzbiet' ? 'grzbiet wpisany' : 'liczona sama'})` : ''}` : ''}${s.skladka ? `, składki ×${s.skladka}` : ''}`).join('; ')}`,
    `Strony (${p.strony.length}, w tej kolejności):`,
    ...p.strony.map((s, i) => `  ${i + 1}. ${s.id} „${s.nazwa || ''}” sekcja=${s.sekcja}${s.seria ? ` seria=${s.seria}` : ''} – ${(s.obiekty || []).map(wiersz).join(', ') || 'pusta'}`),
    `Wzorce: ${(p.wzorce || []).map((x) => `${x.id} „${x.nazwa}” (${(x.obiekty || []).length} el.)`).join('; ') || 'brak'}`,
    `Style: ${(p.style || []).map((x) => `${x.id} „${x.nazwa}”`).join('; ') || 'brak'}`,
    `Tabele: ${(p.tabele || []).map((t) => `${t.id} „${t.nazwa}” kolumny: ${(t.kolumny || []).join(', ')}; ${(t.wiersze || []).length} wierszy`).join(' | ') || 'brak'}`,
    `Serie: ${(p.serie || []).map((s) => `${s.id} „${s.nazwa}” tabela=${s.tabela || '–'} tryb=${s.tryb || 'tabela'}`).join('; ') || 'brak'}`,
    `Kolory do druku: tryb ${p.tryb_kolorow || 'pelny'}${p.tryb_kolorow === 'czb1' ? ` (kolor trybu: ${p.kolor_trybu || 'brak'})` : ''}${(p.sekcje || []).some((s) => s.tryb_kolorow) ? `; sekcje z własnym trybem: ${p.sekcje.filter((s) => s.tryb_kolorow).map((s) => `${s.id} „${s.nazwa}” ${s.tryb_kolorow}${s.tryb_kolorow === 'czb1' ? ` (${s.kolor_trybu || 'brak'})` : ''}`).join(', ')}` : ''}; kolory dodatkowe: ${(p.kolory_dodatkowe || []).map((k) => `${k.id} „${k.nazwa}” CMYK ${(k.cmyk || []).join('/')}`).join('; ') || 'brak'}`,
    `Obrazy i czcionki w projekcie (szczegóły obrazów: obrazy_projektu): ${Object.entries(p.zasoby || {}).map(([id, z]) => `${id} ${z.nazwa}`).join(', ') || 'brak'}`,
  ].join('\n');
}

// Podstawowa kontrola bez rysowania: nieznane pola w tekstach, brakujące pliki obrazów z danych,
// elementy poza stroną. (Pełne „Sprawdź przed drukiem” – w aplikacji.)
export function kontrola(p) {
  const uwagi = [];
  const tabela = (id) => (p.tabele || []).find((t) => t.id === id);
  // Nazwa z tabeli wskazuje obraz pełną nazwą z rozszerzeniem (wielkość liter bez znaczenia); nazwa bez
  // rozszerzenia – tylko gdy pasuje dokładnie jeden plik (ta sama reguła co w aplikacji, js/nazwy-obrazow.js).
  const nazwyZasobow = Object.values(p.zasoby || {}).map((z) => String(z.nazwa || '').trim().toLowerCase());
  const obraz = (n) => {
    const x = n.toLowerCase();
    if (nazwyZasobow.includes(x)) return 'jest';
    const ile = nazwyZasobow.filter((z) => z.replace(/\.[a-z0-9]{2,5}$/, '') === x).length;
    return ile === 1 ? 'jest' : (ile > 1 ? 'niejednoznaczna' : 'brak');
  };
  for (const s of p.strony) {
    const seria = (p.serie || []).find((x) => x.id === s.seria);
    const tabele = seria ? [tabela(seria.tabela), ...(seria.dodatkowe || []).map((d) => tabela(d.tabela))].filter(Boolean) : [];
    const kolumny = new Set(tabele.flatMap((t) => t.kolumny || []));
    const sekcja = (p.sekcje || []).find((x) => x.id === s.sekcja) || {};
    const { szerokosc_mm: W = 0, wysokosc_mm: H = 0, spad_mm: spad = 3 } = sekcja.wydruk || {};
    teksty(s.obiekty, (o) => {
      for (const m of String(o.text).matchAll(/(?<!\{)\{([^{}\n:]+)(?::[^{}\n]*)?\}(?!\})/g)) {
        const pole = m[1].trim();
        const [t, k] = pole.includes('.') ? pole.split('.') : [null, pole];
        const znane = POLA_DOKUMENTU.includes(pole) || (t ? tabele.some((x) => x.nazwa === t && (x.kolumny || []).includes(k)) : kolumny.has(pole));
        if (!znane) uwagi.push(`Strona „${s.nazwa || s.id}”: nieznane pole {${pole}} w tekście „${krotko(o.text, 30)}”${seria ? '' : ' (strona nie należy do serii – pola z tabeli działają tylko na stronach serii)'}.`);
      }
    });
    for (const o of s.obiekty || []) {
      if (o.pole?.kolumna) {
        const t = tabele.find((x) => (x.kolumny || []).includes(o.pole.kolumna));
        const i = t ? t.kolumny.indexOf(o.pole.kolumna) : -1;
        if (!t) uwagi.push(`Strona „${s.nazwa || s.id}”: obraz z kolumny „${o.pole.kolumna}”, której nie ma w tabelach serii.`);
        else {
          const nazwy = [...new Set(t.wiersze.map((w) => String(w[i] ?? '').trim()).filter((n) => n && !/^\[\s*(pomi[nń]|skip|пропустити|пропуск)\s*\]$/i.test(n)))];
          const braki = nazwy.filter((n) => obraz(n) === 'brak');
          const dwuznaczne = nazwy.filter((n) => obraz(n) === 'niejednoznaczna');
          if (braki.length) uwagi.push(`Strona „${s.nazwa || s.id}”: w kolumnie „${o.pole.kolumna}” są nazwy plików, których nie wgrano do projektu: ${braki.slice(0, 8).join(', ')}${braki.length > 8 ? '…' : ''} (właściciel wgrywa je w aplikacji; rozszerzenie się liczy – „a.jpg” to nie „a.png”).`);
          if (dwuznaczne.length) uwagi.push(`Strona „${s.nazwa || s.id}”: w kolumnie „${o.pole.kolumna}” nazwy bez rozszerzenia pasują do kilku plików: ${dwuznaczne.slice(0, 8).join(', ')} – dopisz rozszerzenie (np. „.jpg”).`);
        }
      }
      const szer = (o.width || 0) * (o.scaleX ?? 1);
      const wys = (o.height || 0) * (o.scaleY ?? 1);
      if (W && H && !o.bez_ostrzezen && (o.left + szer < -spad || o.top + wys < -spad || o.left > W + spad || o.top > H + spad)) {
        uwagi.push(`Strona „${s.nazwa || s.id}”: element ${o.id} leży poza stroną (left ${o.left}, top ${o.top} mm; strona ${W}×${H} mm).`);
      }
    }
  }
  return uwagi;
}

// ---------- Narzędzia ----------

const S = (opis, wlasciwosci, wymagane = []) => ({ type: 'object', properties: wlasciwosci, required: wymagane, additionalProperties: false, description: opis });
// KATALOG-BIBLIOTEKI:START (node scripts/katalog-biblioteki.cjs)
export const KATALOG_BIBLIOTEKI = [
  ["ksztalty", "Kształty", [
    ["trojkat","Trójkąt","trojkat Podstawowe"],
    ["trojkat-prosty","Trójkąt prostokątny","trojkat Podstawowe"],
    ["romb","Romb","romb diament Podstawowe"],
    ["trapez","Trapez","trapez Podstawowe"],
    ["rownoleglobok","Równoległobok","rownoleglobok Podstawowe"],
    ["polkole","Półkole","polkole luk Podstawowe"],
    ["kropla","Kropla","kropla lza woda Podstawowe"],
    ["prostokat-zaokr","Prostokąt zaokrąglony","prostokat zaokraglony karta Podstawowe"],
    ["pigulka","Pigułka","pigulka kapsulka przycisk Podstawowe"],
    ["klepsydra","Klepsydra","klepsydra czas Podstawowe"],
    ["etap","Etap procesu","etap proces krok strzalka pieciokat Podstawowe"],
    ["lezka","Łezka narożna","lezka naroznik lisc Podstawowe"],
    ["luk-brama","Brama","luk brama okno Podstawowe"],
    ["kwadrat","Kwadrat","kwadrat Podstawowe"],
    ["kolo","Koło","kolo okrag Podstawowe"],
    ["owal-poziomy","Owal poziomy","owal elipsa Podstawowe"],
    ["owal-pionowy","Owal pionowy","owal elipsa jajko Podstawowe"],
    ["cwiartka","Ćwiartka koła","cwiartka kola wycinek Podstawowe"],
    ["wycinek","Wycinek koła","wycinek kola pacman wykres Podstawowe"],
    ["pierscien","Pierścień","pierscien obwarzanek kolo otwor Podstawowe"],
    ["luk-gruby","Łuk gruby","luk tecza polpierscien Podstawowe"],
    ["trojkat-dol","Trójkąt odwrócony","trojkat odwrocony w dol Podstawowe"],
    ["trojkat-bok","Trójkąt bokiem","trojkat bok Podstawowe"],
    ["latawiec","Latawiec","latawiec deltoid Podstawowe"],
    ["soczewka","Soczewka","soczewka oko liść Podstawowe"],
    ["scieta-naroze","Prostokąt ze ściętym rogiem","prostokat sciety rog Podstawowe"],
    ["sciete-dwa","Prostokąt ze ściętymi rogami","prostokat sciete rogi Podstawowe"],
    ["zaokr-jeden","Prostokąt z jednym zaokrąglonym rogiem","prostokat zaokraglony rog Podstawowe"],
    ["zaokr-przekatna","Liść prostokątny","prostokat zaokraglone przeciwne rogi lisc Podstawowe"],
    ["squircle","Kwadrat miękki","kwadrat zaokraglony ikona aplikacji Podstawowe"],
    ["kostka","Sześcian","szescian kostka 3d pudelko Podstawowe"],
    ["walec","Walec","walec beczka baza danych Podstawowe"],
    ["polowa-kola-pion","Półkole bokiem","polkole bok Podstawowe"],
    ["blok-falisty","Prostokąt falisty","prostokat falisty dokument flaga Podstawowe"],
    ["kapsula-pion","Kapsuła pionowa","kapsula pigulka pion Podstawowe"],
    ["reuleaux","Trójkąt łukowy","trojkat lukowy reuleaux Podstawowe"],
    ["kwadrat-otwor","Kwadrat z okrągłym otworem","kwadrat otwor kolo Podstawowe"],
    ["kolo-otwor-kw","Koło z kwadratowym otworem","kolo otwor kwadrat moneta Podstawowe"],
    ["polelipsa","Półelipsa","polelipsa kopula Podstawowe"],
    ["domek-ksztalt","Pięciokąt domek","domek pieciokat dach Podstawowe"],
    ["trapez-odwr","Trapez odwrócony","trapez odwrocony kubek Podstawowe"],
    ["szesciokat","Sześciokąt","szesciokat plaster Wielokąty"],
    ["osmiokat","Ośmiokąt","osmiokat stop Wielokąty"],
    ["pieciokat","Pięciokąt","pieciokat Wielokąty"],
    ["siedmiokat","Siedmiokąt","siedmiokat Wielokąty"],
    ["trojkat-foremny","Trójkąt równoboczny","trojkat rownoboczny foremny Wielokąty"],
    ["szesnastokat","Szesnastokąt","szesnastokat prawie kolo Wielokąty"],
    ["dziewieciokat","Dziewięciokąt","dziewieciokat Wielokąty"],
    ["dziesieciokat","Dziesięciokąt","dziesieciokat Wielokąty"],
    ["dwunastokat","Dwunastokąt","dwunastokat Wielokąty"],
    ["szesciokat-pion","Sześciokąt pionowy","szesciokat plaster pion Wielokąty"],
    ["trojkat-zaokr","Trójkąt zaokrąglony","trojkat zaokraglony Wielokąty"],
    ["kwadrat-zaokr-romb","Romb zaokrąglony","romb zaokraglony Wielokąty"],
    ["pieciokat-zaokr","Pięciokąt zaokrąglony","pieciokat zaokraglony Wielokąty"],
    ["szesciokat-zaokr","Sześciokąt zaokrąglony","szesciokat zaokraglony plaster Wielokąty"],
    ["osmiokat-zaokr","Ośmiokąt zaokrąglony","osmiokat zaokraglony Wielokąty"],
    ["plaster-miodu","Plaster miodu","plaster miodu szesciokaty siatka Wielokąty"],
    ["gwiazda4","Gwiazdka błysk","gwiazdka blysk iskra Gwiazdy i odznaki"],
    ["gwiazda7","Gwiazda siedmioramienna","gwiazda Gwiazdy i odznaki"],
    ["naklejka","Naklejka ząbkowana","naklejka odznaka promocja cena Gwiazdy i odznaki"],
    ["gwiazda5","Gwiazda","gwiazda Gwiazdy i odznaki"],
    ["gwiazda6","Gwiazda sześcioramienna","gwiazda Gwiazdy i odznaki"],
    ["gwiazda8","Gwiazda ośmioramienna","gwiazda Gwiazdy i odznaki"],
    ["rozeta","Rozeta","rozeta odznaka pieczec Gwiazdy i odznaki"],
    ["wybuch","Wybuch","wybuch promocja krzyk Gwiazdy i odznaki"],
    ["gwiazda5-gruba","Gwiazda pulchna","gwiazda gruba pulchna Gwiazdy i odznaki"],
    ["gwiazda5-smukla","Gwiazda smukła","gwiazda smukla ostra Gwiazdy i odznaki"],
    ["gwiazda5-zaokr","Gwiazda zaokrąglona","gwiazda zaokraglona miekka Gwiazdy i odznaki"],
    ["gwiazda10","Gwiazda dziesięcioramienna","gwiazda Gwiazdy i odznaki"],
    ["gwiazda12","Gwiazda dwunastoramienna","gwiazda Gwiazdy i odznaki"],
    ["gwiazda-polarna","Gwiazda polarna","gwiazda polarna kompas betlejemska Gwiazdy i odznaki"],
    ["gwiazda-w-kole","Gwiazda w kole","gwiazda kolo odznaka Gwiazdy i odznaki"],
    ["iskry","Iskierki","iskry blysk gwiazdki magia nowosc Gwiazdy i odznaki"],
    ["pieczec-falista","Pieczęć falista","pieczec rozeta odznaka falista Gwiazdy i odznaki"],
    ["pieczec-falista-ring","Pieczęć falista z obwódką","pieczec rozeta odznaka certyfikat Gwiazdy i odznaki"],
    ["odznaka-szesciokat","Odznaka sześciokątna","odznaka szesciokat plakietka Gwiazdy i odznaki"],
    ["odznaka-tarcza","Odznaka tarcza z gwiazdą","odznaka tarcza gwiazda szeryf Gwiazdy i odznaki"],
    ["medal","Medal","medal nagroda zwyciezca Gwiazdy i odznaki"],
    ["zebatka","Zębatka","zebatka kolo zebate ustawienia mechanizm Gwiazdy i odznaki"],
    ["wybuch-maly","Wybuch – mały","wybuch promocja cena okazja Gwiazdy i odznaki"],
    ["odznaka-promocja","Odznaka promocyjna","promocja rabat okazja naklejka Gwiazdy i odznaki"],
    ["ksiezyc","Księżyc","ksiezyc noc Serca i natura"],
    ["chmura","Chmura","chmura pogoda Serca i natura"],
    ["lisc","Liść","lisc natura Serca i"],
    ["platek","Płatek śniegu","platek snieg zima Serca i natura"],
    ["serce","Serce","serce milosc walentynki Serca i natura"],
    ["piorun","Błyskawica","piorun blyskawica Serca i natura"],
    ["kwiat","Kwiatek","kwiat kwiatek Serca i natura"],
    ["slonce","Słońce","slonce lato Serca i natura"],
    ["drzewo","Świerk","drzewo choinka las natura Serca i"],
    ["serce-smukle","Serce smukłe","serce smukle milosc Serca i natura"],
    ["serce-pulchne","Serce pulchne","serce pulchne milosc Serca i natura"],
    ["dwa-serca","Dwa serca","dwa serca serce para slub walentynki milosc Serca i natura"],
    ["serce-strzala","Serce ze strzałą","serce strzala amor walentynki Serca i natura"],
    ["kwiat5","Kwiat pięciopłatkowy","kwiat platki Serca i natura"],
    ["kwiat8","Kwiat ośmiopłatkowy","kwiat stokrotka platki Serca i natura"],
    ["tulipan","Tulipan","tulipan kwiat wiosna Serca i natura"],
    ["lisc-owalny","Liść z żyłką","lisc natura ekologia Serca i"],
    ["galazka","Gałązka","galazka liscie natura ozdobnik Serca i"],
    ["drzewo-lisciaste","Drzewo liściaste","drzewo las park natura Serca i"],
    ["gory","Góry","gory szczyt wycieczka natura Serca i"],
    ["fala-morska","Fala","fala morze woda wakacje Serca i natura"],
    ["plomien","Płomień","plomien ogien ognisko Serca i natura"],
    ["chmura-deszcz","Chmura z deszczem","chmura deszcz pogoda jesien Serca i natura"],
    ["tecza","Tęcza","tecza kolory pogoda dzieci Serca i natura"],
    ["kropla-deszczu","Kropla smukła","kropla deszcz woda Serca i natura"],
    ["grzyb","Grzyb","grzyb las jesien Serca i natura"],
    ["jablko","Jabłko","jablko owoc szkola Serca i natura"],
    ["ksiezyc-gwiazda","Księżyc z gwiazdą","ksiezyc gwiazda noc sen Serca i natura"],
    ["sloneczko","Słoneczko","slonce lato pogoda dzieci Serca i natura"],
    ["motyl","Motyl","motyl wiosna natura Serca i"],
    ["kaktus","Kaktus","kaktus roslina doniczka Serca i natura"],
    ["ryba","Ryba","ryba morze woda Serca i natura"],
    ["lapka","Ślad łapki","lapka slad pies kot zwierze Serca i natura"],
    ["ptak","Ptak","ptak lot jaskolka Serca i natura"],
    ["rozgwiazda","Rozgwiazda","rozgwiazda morze plaza Serca i natura"],
    ["wisnie","Wiśnie","wisnie owoce lato Serca i natura"],
    ["muszelka","Muszelka","muszla muszelka morze Serca i natura"],
    ["tarcza","Tarcza","tarcza herb Symbole i ikony"],
    ["dom","Dom","dom domek Symbole i ikony"],
    ["lokalizacja","Pinezka","pinezka lokalizacja mapa miejsce Symbole i ikony"],
    ["zegar","Zegar","zegar czas godzina Symbole i ikony"],
    ["koperta","Koperta","koperta list mail poczta Symbole i ikony"],
    ["ksiazka","Książka","ksiazka czytanie Symbole i ikony"],
    ["nuta","Nuta","nuta muzyka Symbole i ikony"],
    ["kalendarz-ikona","Kalendarz","kalendarz data Symbole i ikony"],
    ["telefon","Telefon","telefon kontakt Symbole i ikony"],
    ["koszyk","Koszyk","koszyk zakupy sklep Symbole i ikony"],
    ["zarowka","Żarówka","zarowka pomysl Symbole i ikony"],
    ["lupa","Lupa","lupa szukaj Symbole i ikony"],
    ["samolot","Samolot","samolot podroz wakacje lot Symbole i ikony"],
    ["aparat","Aparat","aparat zdjecie fotografia Symbole i ikony"],
    ["kubek","Kubek","kubek kawa herbata przerwa Symbole i ikony"],
    ["krzyz","Krzyż","krzyz kosciol wiara religia Symbole i ikony"],
    ["uwaga","Uwaga","uwaga wykrzyknik ostrzezenie trojkat Symbole i ikony"],
    ["informacja","Informacja","informacja info Symbole i ikony"],
    ["wifi","Wi-Fi","wifi internet siec Symbole i ikony"],
    ["korona","Korona","korona krol zwyciezca Symbole i ikony"],
    ["diament","Diament","diament klejnot premium Symbole i ikony"],
    ["puchar","Puchar","puchar nagroda zwyciestwo trofeum Symbole i ikony"],
    ["klodka","Kłódka","klodka zamek bezpieczenstwo Symbole i ikony"],
    ["dzwonek","Dzwonek","dzwonek powiadomienie alarm Symbole i ikony"],
    ["flaga","Flaga","flaga cel meta Symbole i ikony"],
    ["usmiech","Uśmiech","usmiech buzka emotka radosc Symbole i ikony"],
    ["osoba","Osoba","osoba czlowiek uzytkownik Symbole i ikony"],
    ["grupa-osob","Grupa osób","grupa osoby zespol rodzina Symbole i ikony"],
    ["smartfon","Smartfon","smartfon komorka telefon aplikacja Symbole i ikony"],
    ["laptop","Laptop","laptop komputer praca Symbole i ikony"],
    ["ekran","Monitor","monitor ekran komputer prezentacja Symbole i ikony"],
    ["bateria","Bateria","bateria energia ladowanie Symbole i ikony"],
    ["parasol","Parasol","parasol deszcz ochrona Symbole i ikony"],
    ["kotwica","Kotwica","kotwica morze statek Symbole i ikony"],
    ["samochod","Samochód","samochod auto podroz Symbole i ikony"],
    ["rower","Rower","rower sport wycieczka Symbole i ikony"],
    ["dom-serce","Dom z sercem","dom serce rodzina Symbole i ikony"],
    ["glosnik","Głośnik","glosnik dzwiek ogloszenie Symbole i ikony"],
    ["olowek","Ołówek","olowek pisanie szkola edycja Symbole i ikony"],
    ["ksiazka-otwarta","Książka otwarta","ksiazka otwarta czytanie nauka Symbole i ikony"],
    ["kawa","Filiżanka","filizanka kawa herbata kawiarnia Symbole i ikony"],
    ["krzyz-maltanski","Krzyż maltański","krzyz maltanski order odznaczenie Symbole i ikony"],
    ["serce-kolo","Serce w kole","serce kolo polubienie Symbole i ikony"],
    ["klucz","Klucz","klucz zamek dostep Symbole i ikony"],
    ["pinezka-tablica","Pinezka do tablicy","pinezka tablica korkowa przypiete Symbole i ikony"],
    ["ekierka","Ekierka","ekierka szkola geometria Symbole i ikony"],
    ["kostka-gry","Kostka do gry","kostka gra losowanie planszowka Symbole i ikony"],
    ["puzzel","Puzzel","puzzel ukladanka element Symbole i ikony"],
    ["mapa","Mapa","mapa podroz trasa Symbole i ikony"],
    ["mikrofon","Mikrofon","mikrofon podcast nagranie Symbole i ikony"],
    ["nozyczki","Nożyczki","nozyczki ciecie wytnij Symbole i ikony"],
    ["prezent","Prezent","prezent upominek urodziny swieta Okolicznościowe"],
    ["balwan","Bałwanek","balwan zima snieg Okolicznościowe"],
    ["laska-cukrowa","Laska cukrowa","laska cukrowa swieta cukierek Okolicznościowe"],
    ["dzwonki","Dzwonki świąteczne","dzwonki swieta boze narodzenie Okolicznościowe"],
    ["gwiazdka-choinka","Gwiazda na choinkę","gwiazda czubek choinka swieta Okolicznościowe"],
    ["kartka-okolicznosciowa","Serce z wstążką","serce wstazka prezent walentynki Okolicznościowe"],
    ["balon","Balon","balon urodziny impreza Okolicznościowe"],
    ["choinka-pietra","Choinka","choinka swieta boze narodzenie Okolicznościowe"],
    ["bombka","Bombka","bombka choinka swieta Okolicznościowe"],
    ["gwiazda-betlejemska","Gwiazda betlejemska","gwiazda betlejemska swieta boze narodzenie Okolicznościowe"],
    ["swieca","Świeca","swieca swieto adwent wspomnienie Okolicznościowe"],
    ["jajko","Pisanka","jajko pisanka wielkanoc Okolicznościowe"],
    ["tort","Tort","tort urodziny rocznica swieczki Okolicznościowe"],
    ["pierscionek","Pierścionek","pierscionek slub zareczyny Okolicznościowe"],
    ["kokarda","Kokarda","kokarda prezent wstazka Okolicznościowe"],
    ["choragiewki","Girlanda z chorągiewek","choragiewki girlanda impreza urodziny Okolicznościowe"],
    ["dynia","Dynia","dynia halloween jesien Okolicznościowe"],
    ["czapeczka","Czapeczka urodzinowa","czapeczka urodziny impreza Okolicznościowe"],
    ["konfetti","Konfetti","konfetti impreza swietowanie Okolicznościowe"],
    ["zajac","Zając","zajac krolik wielkanoc Okolicznościowe"],
    ["serduszka","Serduszka","serduszka serce walentynki milosc Okolicznościowe"],
    ["plus","Plus","plus krzyz Znaki"],
    ["ptaszek","Ptaszek","ptaszek check ok gotowe Znaki"],
    ["krzyzyk","Krzyżyk","krzyzyk x zamknij Znaki"],
    ["pole-wyboru","Pole wyboru","pole wyboru checkbox kwadrat zadanie lista Znaki"],
    ["pole-wyboru-okragle","Pole wyboru okrągłe","pole wyboru kolko checkbox nawyk Znaki"],
    ["pole-zaznaczone","Pole zaznaczone","pole wyboru zaznaczone zrobione checkbox Znaki"],
    ["minus","Minus","minus odejmowanie Znaki"],
    ["rowna-sie","Równa się","rowna sie wynik Znaki"],
    ["dzielenie","Dzielenie","dzielenie matematyka Znaki"],
    ["procent","Procent","procent rabat Znaki"],
    ["nieskonczonosc","Nieskończoność","nieskonczonosc zawsze Znaki"],
    ["wykrzyknik","Wykrzyknik","wykrzyknik uwaga Znaki"],
    ["pytajnik","Znak zapytania","znak zapytania pytanie pomoc Znaki"],
    ["hasztag","Kratka #","hasztag kratka numer Znaki"],
    ["wieksze","Większe niż","wieksze niz porownanie Znaki"],
    ["mniejsze","Mniejsze niż","mniejsze niz porownanie Znaki"],
    ["zakaz","Zakaz","zakaz nie wolno stop Znaki"],
    ["cudzyslow","Cudzysłów","cudzyslow cytat Znaki"],
    ["kolo-ptaszek","Ptaszek w kole","ptaszek kolo ok zatwierdzone gotowe Znaki"],
    ["kolo-krzyzyk","Krzyżyk w kole","krzyzyk kolo blad nie anuluj Znaki"],
    ["plus-kolo","Plus w kole","plus kolo dodaj Znaki"],
    ["numer","Kółko na numer","numer kolo punkt wypunktowanie lista Znaki"],
  ]],
  ["ikony", "Ikony", [
    ["ikona-telefon","Telefon","ikona sluchawka dzwon numer Kontakt"],
    ["ikona-komorka","Komórka","ikona smartfon telefon sms Kontakt"],
    ["ikona-koperta","Koperta","ikona email list poczta wiadomosc Kontakt"],
    ["ikona-koperta-otwarta","Koperta otwarta","ikona email list przeczytany Kontakt"],
    ["ikona-dymek","Dymek","ikona rozmowa czat wiadomosc komentarz Kontakt"],
    ["ikona-dymki","Rozmowa","ikona dymki dialog czat Kontakt"],
    ["ikona-osoba","Osoba","ikona czlowiek uzytkownik profil Kontakt"],
    ["ikona-osoby","Osoby","ikona grupa ludzie zespol Kontakt"],
    ["ikona-pinezka","Pinezka na mapie","ikona adres miejsce lokalizacja Kontakt"],
    ["ikona-www","Strona internetowa","ikona www internet globus swiat Kontakt"],
    ["ikona-malpa","Małpa @","ikona email adres at Kontakt"],
    ["ikona-link","Link","ikona odnosnik lancuch adres Kontakt"],
    ["ikona-wizytowka","Wizytówka","ikona kontakt dane karta Kontakt"],
    ["ikona-skrzynka","Skrzynka pocztowa","ikona poczta list skrzynka Kontakt"],
    ["ikona-megafon","Megafon","ikona ogloszenie komunikat glosno Kontakt"],
    ["ikona-dzwonek","Dzwonek","ikona powiadomienie przypomnienie Kontakt"],
    ["ikona-samolocik","Wyślij","ikona samolot papierowy wyslij Kontakt"],
    ["ikona-udostepnij","Udostępnij","ikona dzielenie siec polacz Kontakt"],
    ["ikona-sluchawki","Słuchawki","ikona pomoc wsparcie infolinia muzyka Kontakt"],
    ["ikona-ksiazka-adresowa","Książka adresowa","ikona kontakty notes adresy Kontakt"],
    ["ikona-zegar","Zegar","ikona czas godzina Czas i kalendarz"],
    ["ikona-budzik","Budzik","ikona pobudka rano czas Czas i kalendarz"],
    ["ikona-klepsydra","Klepsydra","ikona czas uplyw oczekiwanie Czas i kalendarz"],
    ["ikona-stoper","Stoper","ikona czas pomiar sport Czas i kalendarz"],
    ["ikona-kalendarz","Kalendarz","ikona data dzien miesiac Czas i kalendarz"],
    ["ikona-kalendarz-dzien","Dzień w kalendarzu","ikona data termin dzien Czas i kalendarz"],
    ["ikona-kalendarz-ok","Termin zaliczony","ikona kalendarz zrobione ptaszek Czas i"],
    ["ikona-kalendarz-tydzien","Tydzień","ikona kalendarz dni tygodnia Czas i"],
    ["ikona-zegarek","Zegarek","ikona czas reka godzina Czas i kalendarz"],
    ["ikona-historia","Wstecz w czasie","ikona historia przeszlosc powrot Czas i kalendarz"],
    ["ikona-flaga-termin","Flaga","ikona termin cel meta Czas i kalendarz"],
    ["ikona-pinezka-tablica","Pinezka","ikona przypiete wazne notatka Czas i kalendarz"],
    ["ikona-kalendarz-zrywany","Kartka z kalendarza","ikona kalendarz zdzierak data Czas i"],
    ["ikona-harmonogram","Harmonogram","ikona plan lista czas Czas i kalendarz"],
    ["ikona-poranek","Poranek","ikona rano wschod dzien Czas i kalendarz"],
    ["ikona-noc","Noc","ikona ksiezyc wieczor sen Czas i kalendarz"],
    ["ikona-urodziny-data","Urodziny w kalendarzu","ikona kalendarz swieczka rocznica Czas i"],
    ["ikona-odliczanie","Odliczanie","ikona timer minutnik czas Czas i kalendarz"],
    ["ikona-miesiac","Miesiąc","ikona kalendarz siatka Czas i"],
    ["ikona-nieskonczonosc","Nieskończoność","ikona zawsze wiecznosc Czas i kalendarz"],
    ["ikona-slonce","Słońce","ikona pogoda lato ciepło Pogoda"],
    ["ikona-chmura","Chmura","ikona pogoda pochmurno Pogoda"],
    ["ikona-slonce-chmura","Słońce za chmurą","ikona pogoda zmienna Pogoda"],
    ["ikona-deszcz","Deszcz","ikona pogoda opady Pogoda"],
    ["ikona-burza","Burza","ikona pogoda piorun blyskawica Pogoda"],
    ["ikona-snieg","Śnieg","ikona pogoda zima opady Pogoda"],
    ["ikona-platek","Płatek śniegu","ikona zima mroz snieg Pogoda"],
    ["ikona-wiatr","Wiatr","ikona pogoda wichura Pogoda"],
    ["ikona-tecza","Tęcza","ikona pogoda luk kolory Pogoda"],
    ["ikona-ksiezyc-gwiazda","Księżyc i gwiazda","ikona noc niebo Pogoda"],
    ["ikona-termometr","Termometr","ikona temperatura pogoda Pogoda"],
    ["ikona-parasol","Parasol","ikona deszcz pogoda Pogoda"],
    ["ikona-kropla","Kropla","ikona woda deszcz Pogoda"],
    ["ikona-mgla","Mgła","ikona pogoda zamglenie Pogoda"],
    ["ikona-noc-chmura","Noc z chmurą","ikona pogoda noc pochmurno Pogoda"],
    ["ikona-ulewa","Ulewa","ikona pogoda mocny deszcz Pogoda"],
    ["ikona-zachod","Zachód słońca","ikona wieczor slonce Pogoda"],
    ["ikona-wschod","Wschód słońca","ikona rano slonce Pogoda"],
    ["ikona-latawiec","Latawiec","ikona wiatr zabawa lato Pogoda"],
    ["ikona-okulary-sloneczne","Okulary przeciwsłoneczne","ikona lato slonce wakacje Pogoda"],
    ["ikona-kubek","Kubek","ikona kawa herbata napoj goracy Jedzenie"],
    ["ikona-filizanka","Filiżanka","ikona kawa herbata spodek Jedzenie"],
    ["ikona-sztucce","Sztućce","ikona jedzenie obiad restauracja widelec noz Jedzenie"],
    ["ikona-talerz","Talerz","ikona obiad danie jedzenie Jedzenie"],
    ["ikona-jablko","Jabłko","ikona owoc zdrowie szkola Jedzenie"],
    ["ikona-gruszka","Gruszka","ikona owoc Jedzenie"],
    ["ikona-marchewka","Marchewka","ikona warzywo Jedzenie"],
    ["ikona-chleb","Chleb","ikona pieczywo sniadanie Jedzenie"],
    ["ikona-tort","Tort","ikona urodziny ciasto swieczka Jedzenie"],
    ["ikona-babeczka","Babeczka","ikona muffin deser ciastko Jedzenie"],
    ["ikona-lody","Lody","ikona deser lato Jedzenie"],
    ["ikona-pizza","Pizza","ikona jedzenie kawalek Jedzenie"],
    ["ikona-udko","Udko","ikona mieso obiad kurczak Jedzenie"],
    ["ikona-jajko-sadzone","Jajko sadzone","ikona sniadanie jajecznica Jedzenie"],
    ["ikona-winogrona","Winogrona","ikona owoc kisc wino Jedzenie"],
    ["ikona-cytrus","Plaster cytryny","ikona cytryna pomarancza owoc Jedzenie"],
    ["ikona-butelka","Butelka","ikona napoj woda sok Jedzenie"],
    ["ikona-garnek","Garnek","ikona gotowanie kuchnia zupa Jedzenie"],
    ["ikona-czajnik","Czajnik","ikona herbata kuchnia Jedzenie"],
    ["ikona-ziarno-kawy","Ziarno kawy","ikona kawa kawiarnia Jedzenie"],
    ["ikona-samolot","Samolot","ikona podroz lot wakacje Podróże"],
    ["ikona-samochod","Samochód","ikona auto jazda podroz Podróże"],
    ["ikona-autobus","Autobus","ikona komunikacja przejazd Podróże"],
    ["ikona-pociag","Pociąg","ikona kolej podroz Podróże"],
    ["ikona-rower","Rower","ikona sport wycieczka jazda Podróże"],
    ["ikona-statek","Żaglówka","ikona statek morze rejs Podróże"],
    ["ikona-walizka","Walizka","ikona bagaz podroz wyjazd Podróże"],
    ["ikona-plecak","Plecak","ikona wedrowka szkola wycieczka Podróże"],
    ["ikona-mapa","Mapa","ikona trasa podroz Podróże"],
    ["ikona-kompas","Kompas","ikona kierunek nawigacja Podróże"],
    ["ikona-namiot","Namiot","ikona biwak oboz Podróże"],
    ["ikona-gory","Góry","ikona szczyt wycieczka Podróże"],
    ["ikona-bilet","Bilet","ikona wstep kino podroz Podróże"],
    ["ikona-paszport","Paszport","ikona dokument podroz Podróże"],
    ["ikona-kotwica","Kotwica","ikona morze statek nadzieja Podróże"],
    ["ikona-latarnia","Latarnia morska","ikona morze swiatlo wybrzeze Podróże"],
    ["ikona-trasa","Trasa","ikona droga od do punkt Podróże"],
    ["ikona-hotel","Nocleg","ikona hotel lozko spanie Podróże"],
    ["ikona-parasol-plaza","Parasol plażowy","ikona plaza wakacje lato Podróże"],
    ["ikona-swiat","Świat","ikona kula ziemska podroz kontynenty Podróże"],
    ["ikona-ksiazka-otwarta","Książka otwarta","ikona czytanie nauka lektura Szkoła i"],
    ["ikona-ksiazka","Książka","ikona czytanie lektura podrecznik Szkoła i nauka"],
    ["ikona-olowek","Ołówek","ikona pisanie rysunek szkola Szkoła i nauka"],
    ["ikona-dlugopis","Długopis","ikona pisanie podpis Szkoła i nauka"],
    ["ikona-linijka","Linijka","ikona pomiar szkola geometria Szkoła i nauka"],
    ["ikona-kalkulator","Kalkulator","ikona liczenie matematyka Szkoła i nauka"],
    ["ikona-biret","Biret","ikona absolwent studia matura dyplom Szkoła i nauka"],
    ["ikona-globus","Globus","ikona geografia swiat szkola Szkoła i nauka"],
    ["ikona-kolba","Kolba","ikona chemia doswiadczenie nauka Szkoła i"],
    ["ikona-atom","Atom","ikona fizyka nauka Szkoła i"],
    ["ikona-zarowka","Żarówka","ikona pomysl idea swiatlo Szkoła i nauka"],
    ["ikona-tablica","Tablica","ikona lekcja klasa szkola Szkoła i nauka"],
    ["ikona-mikroskop","Mikroskop","ikona biologia nauka badanie Szkoła i"],
    ["ikona-zeszyt","Zeszyt","ikona notatki szkola Szkoła i nauka"],
    ["ikona-nozyczki","Nożyczki","ikona ciecie wycinanie plastyka Szkoła i nauka"],
    ["ikona-pedzel","Pędzel","ikona malowanie sztuka plastyka Szkoła i nauka"],
    ["ikona-paleta","Paleta malarska","ikona farby sztuka kolory Szkoła i nauka"],
    ["ikona-nuty","Nuty","ikona muzyka piosenka spiew Szkoła i nauka"],
    ["ikona-puchar","Puchar","ikona nagroda zwyciestwo konkurs Szkoła i nauka"],
    ["ikona-sowa","Sowa","ikona madrosc nauka Szkoła i"],
    ["ikona-krzyz","Krzyż","ikona wiara chrzescijanstwo kosciol Wiara"],
    ["ikona-krzyz-prosty","Krzyż – linia","ikona wiara krzyz prosty Wiara"],
    ["ikona-golebica","Gołębica","ikona duch swiety pokoj bierzmowanie Wiara"],
    ["ikona-ichthys","Ryba – Ichthys","ikona ryba wiara symbol chrzescijanski Wiara"],
    ["ikona-swieca","Świeca","ikona swiatlo modlitwa pamiec Wiara"],
    ["ikona-modlitwa","Dłonie złożone","ikona modlitwa prosba wiara Wiara"],
    ["ikona-biblia","Biblia","ikona pismo swiete slowo boze Wiara"],
    ["ikona-kosciol","Kościół","ikona swiatynia parafia msza Wiara"],
    ["ikona-kielich","Kielich","ikona komunia eucharystia Wiara"],
    ["ikona-hostia","Hostia","ikona komunia eucharystia chleb Wiara"],
    ["ikona-serce-krzyz","Serce z krzyżem","ikona milosc wiara Wiara"],
    ["ikona-korona","Korona","ikona krol krolestwo Wiara"],
    ["ikona-aniol","Anioł","ikona skrzydla aureola straz Wiara"],
    ["ikona-rozaniec","Różaniec","ikona modlitwa paciorki Wiara"],
    ["ikona-gwiazda-betlejemska","Gwiazda betlejemska","ikona boze narodzenie gwiazda trzech kroli Wiara"],
    ["ikona-chi-rho","Chi-Rho","ikona monogram chrystus symbol Wiara"],
    ["ikona-muszla","Muszla","ikona chrzest pielgrzym Wiara"],
    ["ikona-krzyz-w-kole","Krzyż w okręgu","ikona celtycki krzyz symbol Wiara"],
    ["ikona-plomien","Płomień","ikona duch swiety ogien zeslanie Wiara"],
    ["ikona-modlitewnik","Modlitewnik","ikona ksiazeczka modlitwa Wiara"],
    ["ikona-serce","Serce","ikona milosc zdrowie Zdrowie"],
    ["ikona-puls","Puls","ikona serce ekg zdrowie Zdrowie"],
    ["ikona-serce-puls","Serce z pulsem","ikona kardiologia zdrowie Zdrowie"],
    ["ikona-krzyz-medyczny","Krzyż medyczny","ikona pierwsza pomoc apteka lekarz Zdrowie"],
    ["ikona-tabletka","Tabletka","ikona lek kapsulka apteka Zdrowie"],
    ["ikona-strzykawka","Strzykawka","ikona szczepienie zastrzyk Zdrowie"],
    ["ikona-termometr-medyczny","Termometr lekarski","ikona goraczka temperatura Zdrowie"],
    ["ikona-stetoskop","Stetoskop","ikona lekarz badanie Zdrowie"],
    ["ikona-sen","Sen","ikona spanie odpoczynek zzz Zdrowie"],
    ["ikona-but-sportowy","But sportowy","ikona bieganie sport ruch Zdrowie"],
    ["ikona-hantle","Hantle","ikona silownia trening sport Zdrowie"],
    ["ikona-szklanka-wody","Szklanka wody","ikona woda nawodnienie picie Zdrowie"],
    ["ikona-medytacja","Medytacja","ikona joga spokoj relaks Zdrowie"],
    ["ikona-zab","Ząb","ikona dentysta zeby Zdrowie"],
    ["ikona-oko","Oko","ikona wzrok okulista patrzec Zdrowie"],
    ["ikona-plaster","Plaster","ikona opatrunek rana Zdrowie"],
    ["ikona-apteczka","Apteczka","ikona pierwsza pomoc Zdrowie"],
    ["ikona-waga-lazienkowa","Waga","ikona waga cialo dieta Zdrowie"],
    ["ikona-stopy","Ślady stóp","ikona kroki spacer chodzenie Zdrowie"],
    ["ikona-dna","DNA","ikona genetyka biologia Zdrowie"],
    ["ikona-moneta","Moneta","ikona pieniadze grosz zloty Finanse"],
    ["ikona-monety","Stos monet","ikona oszczednosci pieniadze Finanse"],
    ["ikona-banknot","Banknot","ikona gotowka pieniadze Finanse"],
    ["ikona-portfel","Portfel","ikona pieniadze platnosc Finanse"],
    ["ikona-karta","Karta płatnicza","ikona karta bank platnosc Finanse"],
    ["ikona-skarbonka","Skarbonka","ikona oszczedzanie swinka Finanse"],
    ["ikona-wykres-rosnacy","Wzrost","ikona wykres trend zysk Finanse"],
    ["ikona-wykres-slupkowy","Wykres słupkowy","ikona statystyka dane Finanse"],
    ["ikona-procent","Procent","ikona rabat znizka odsetki Finanse"],
    ["ikona-paragon","Paragon","ikona rachunek zakupy Finanse"],
    ["ikona-koszyk","Koszyk","ikona zakupy sklep Finanse"],
    ["ikona-torba","Torba zakupowa","ikona zakupy sklep prezent Finanse"],
    ["ikona-metka","Metka z ceną","ikona cena wyprzedaz Finanse"],
    ["ikona-sejf","Sejf","ikona bezpieczenstwo oszczednosci Finanse"],
    ["ikona-bank","Bank","ikona instytucja finanse Finanse"],
    ["ikona-waga-szalkowa","Waga szalkowa","ikona sprawiedliwosc rownowaga Finanse"],
    ["ikona-faktura","Dokument","ikona faktura umowa plik Finanse"],
    ["ikona-diament","Diament","ikona wartosc premium Finanse"],
    ["ikona-cel","Cel","ikona tarcza plan dazenie Finanse"],
    ["ikona-sztabka","Sztabka złota","ikona zloto inwestycja Finanse"],
    ["ikona-dom","Dom","ikona mieszkanie budynek Dom"],
    ["ikona-drzwi","Drzwi","ikona wejscie wyjscie Dom"],
    ["ikona-okno","Okno","ikona mieszkanie szyba Dom"],
    ["ikona-klucz","Klucz","ikona zamek otwieranie Dom"],
    ["ikona-kanapa","Kanapa","ikona salon wypoczynek meble Dom"],
    ["ikona-lampa","Lampa","ikona swiatlo oswietlenie Dom"],
    ["ikona-krzeslo","Krzesło","ikona meble siedzenie Dom"],
    ["ikona-stol","Stół","ikona meble jadalnia Dom"],
    ["ikona-roslina-doniczka","Roślina w doniczce","ikona kwiat dom zielen Dom"],
    ["ikona-pralka","Pralka","ikona pranie lazienka Dom"],
    ["ikona-lodowka","Lodówka","ikona kuchnia chlodzenie Dom"],
    ["ikona-wanna","Wanna","ikona kapiel lazienka Dom"],
    ["ikona-kosz","Kosz","ikona smieci usun sprzatanie Dom"],
    ["ikona-mlotek","Młotek","ikona narzedzia remont naprawa Dom"],
    ["ikona-klucz-plaski","Klucz płaski","ikona narzedzia naprawa serwis Dom"],
    ["ikona-walek","Wałek malarski","ikona malowanie remont Dom"],
    ["ikona-wieszak","Wieszak","ikona ubrania szafa Dom"],
    ["ikona-gniazdko","Gniazdko","ikona prad elektryka Dom"],
    ["ikona-konewka","Konewka","ikona ogrod podlewanie Dom"],
    ["ikona-dom-serce","Dom z sercem","ikona rodzina ognisko domowe Dom"],
    ["ikona-lisc","Liść","ikona roslina ekologia Natura"],
    ["ikona-drzewo","Drzewo","ikona las park Natura"],
    ["ikona-swierk","Świerk","ikona choinka las drzewo iglaste Natura"],
    ["ikona-kwiat","Kwiat","ikona kwiatek wiosna Natura"],
    ["ikona-tulipan","Tulipan","ikona kwiat wiosna Natura"],
    ["ikona-grzyb","Grzyb","ikona las jesien Natura"],
    ["ikona-kaktus","Kaktus","ikona roslina pustynia Natura"],
    ["ikona-palma","Palma","ikona wakacje tropiki plaza Natura"],
    ["ikona-fale","Fale","ikona morze woda jezioro Natura"],
    ["ikona-ptak","Ptak","ikona ptaszek wiosna Natura"],
    ["ikona-motyl","Motyl","ikona owad wiosna lato Natura"],
    ["ikona-biedronka","Biedronka","ikona owad szczescie Natura"],
    ["ikona-kot","Kot","ikona zwierze domowe Natura"],
    ["ikona-pies","Pies","ikona zwierze domowe pupil Natura"],
    ["ikona-lapa","Łapa","ikona slad zwierze pies kot Natura"],
    ["ikona-rybka","Rybka","ikona ryba woda akwarium Natura"],
    ["ikona-galazka-oliwna","Gałązka oliwna","ikona pokoj oliwka Natura"],
    ["ikona-klos","Kłos","ikona zboze zniwa chleb dozynki Natura"],
    ["ikona-szyszka","Szyszka","ikona las jesien Natura"],
    ["ikona-planeta","Planeta","ikona kosmos astronomia Natura"],
    ["ikona-laptop","Laptop","ikona komputer praca Technologia"],
    ["ikona-monitor","Monitor","ikona komputer ekran Technologia"],
    ["ikona-tablet","Tablet","ikona urzadzenie ekran Technologia"],
    ["ikona-aparat","Aparat","ikona zdjecie fotografia Technologia"],
    ["ikona-wifi","Wi-Fi","ikona internet siec bezprzewodowa Technologia"],
    ["ikona-bateria","Bateria","ikona zasilanie energia Technologia"],
    ["ikona-wtyczka","Wtyczka","ikona prad zasilanie kabel Technologia"],
    ["ikona-klodka","Kłódka","ikona bezpieczenstwo haslo zamkniete Technologia"],
    ["ikona-chmura-dane","Chmura danych","ikona zapis kopia internet Technologia"],
    ["ikona-ustawienia","Ustawienia","ikona kolo zebate konfiguracja Technologia"],
    ["ikona-lupa","Lupa","ikona szukaj wyszukiwanie Technologia"],
    ["ikona-mikrofon","Mikrofon","ikona nagranie glos podcast Technologia"],
    ["ikona-glosnik","Głośnik","ikona dzwiek muzyka glosnosc Technologia"],
    ["ikona-drukarka","Drukarka","ikona druk wydruk Technologia"],
    ["ikona-kod","Kod","ikona programowanie html Technologia"],
    ["ikona-serwer","Serwer","ikona dane baza dysk Technologia"],
    ["ikona-robot","Robot","ikona automat sztuczna inteligencja Technologia"],
    ["ikona-rakieta","Rakieta","ikona start kosmos szybko Technologia"],
    ["ikona-kursor","Kursor","ikona klik mysz wskaznik Technologia"],
    ["ikona-pobierz","Pobierz","ikona sciagnij plik download Technologia"],
    ["ikona-s-prawo","Strzałka w prawo","ikona dalej kierunek Strzałki"],
    ["ikona-s-lewo","Strzałka w lewo","ikona wstecz kierunek Strzałki"],
    ["ikona-s-gora","Strzałka w górę","ikona kierunek wyzej Strzałki"],
    ["ikona-s-dol","Strzałka w dół","ikona kierunek nizej Strzałki"],
    ["ikona-s-ukos","Strzałka ukośna","ikona kierunek na zewnatrz Strzałki"],
    ["ikona-s-zawroc","Zawróć","ikona powrot cofnij Strzałki"],
    ["ikona-s-cykl","Cykl","ikona odswiez powtorz obieg Strzałki"],
    ["ikona-s-obie","W obie strony","ikona dwukierunkowa wymiana Strzałki"],
    ["ikona-s-rozszerz","Rozszerz","ikona powieksz pelny ekran Strzałki"],
    ["ikona-s-kolo","Strzałka w kółku","ikona dalej przycisk Strzałki"],
    ["ikona-s-podwojna","Podwójna strzałka","ikona szybko dalej Strzałki"],
    ["ikona-s-skret","Skręt w prawo","ikona kierunek zakret droga Strzałki"],
    ["ikona-s-krzyz","Przesuń","ikona cztery kierunki ruch Strzałki"],
    ["ikona-s-falista","Strzałka falista","ikona droga ruch trend Strzałki"],
    ["ikona-s-wymiana","Wymiana","ikona zamiana tam i z powrotem Strzałki"],
    ["ikona-s-wyslij","Wyślij w górę","ikona upload przeslij Strzałki"],
    ["ikona-s-luk","Strzałka po łuku","ikona kierunek luk Strzałki"],
    ["ikona-s-blok-prawo","Gruba strzałka w prawo","ikona kierunek wskazanie Strzałki"],
    ["ikona-s-blok-dol","Gruba strzałka w dół","ikona kierunek wskazanie Strzałki"],
    ["ikona-s-okrezna","Strzałka okrężna","ikona obrot dookola Strzałki"],
  ]],
  ["ilustracje", "Ilustracje", [
    ["il-gory-slonce","Góry i słońce","ilustracja rysunek gory krajobraz slonce wycieczka"],
    ["il-las","Las","ilustracja rysunek las drzewa iglaste natura"],
    ["il-zaglowka","Żaglówka na morzu","ilustracja rysunek zaglowka morze rejs lato"],
    ["il-latarnia-fale","Latarnia nad morzem","ilustracja rysunek latarnia morze wybrzeze fale"],
    ["il-dom-drzewo","Dom z drzewem","ilustracja rysunek dom drzewo ogrod rodzina"],
    ["il-kosciol-wzgorze","Kościół na wzgórzu","ilustracja rysunek kosciol wzgorze wies krajobraz"],
    ["il-filizanka-ksiazka","Kawa i książka","ilustracja rysunek kawa ksiazka czytanie relaks"],
    ["il-swieca-ksiazka","Świeca i otwarta księga","ilustracja rysunek swieca biblia ksiazka modlitwa wieczor"],
    ["il-monstera","Liść monstery","ilustracja rysunek monstera lisc roslina dom"],
    ["il-galazka","Gałązka z liśćmi","ilustracja rysunek galazka liscie ozdoba natura"],
    ["il-kwiat-wazon","Kwiat w wazonie","ilustracja rysunek kwiat wazon bukiet dom"],
    ["il-kaktus-doniczka","Kaktus w doniczce","ilustracja rysunek kaktus doniczka roslina"],
    ["il-ptaki-fale","Ptaki nad wodą","ilustracja rysunek ptaki mewy morze"],
    ["il-motyl-kwiat","Motyl i kwiat","ilustracja rysunek motyl kwiat lato laka"],
    ["il-kot-spiacy","Śpiący kot","ilustracja rysunek kot sen zwierze dom"],
    ["il-snop","Snop zboża","ilustracja rysunek snop zboze zniwa dozynki klosy"],
    ["il-winorosl","Winorośl","ilustracja rysunek winogrona winorosl komunia"],
    ["il-golebica-galazka","Gołębica z gałązką","ilustracja rysunek golebica pokoj duch swiety galazka oliwna"],
    ["il-dlonie-serce","Dłonie z sercem","ilustracja rysunek dlonie serce milosc dar troska"],
    ["il-krzyz-wzgorze","Krzyż na wzgórzu","ilustracja rysunek krzyz wzgorze golgota wielkanoc wiara"],
    ["il-ksiezyc-gwiazdy","Księżyc i gwiazdy","ilustracja rysunek noc niebo ksiezyc gwiazdy dobranoc"],
    ["il-miasto","Panorama miasta","ilustracja rysunek miasto budynki panorama"],
    ["il-rower-ilustracja","Rower z koszykiem","ilustracja rysunek rower koszyk wycieczka lato"],
    ["il-prezent","Prezent","ilustracja rysunek prezent paczka urodziny swieta niespodzia"],
  ]],
  ["strzalki", "Strzałki i dymki", [
    ["strzalka-prawo","Strzałka w prawo","strzalka prawo Strzałki"],
    ["strzalka-lewo","Strzałka w lewo","strzalka lewo Strzałki"],
    ["strzalka-gora","Strzałka w górę","strzalka gora Strzałki"],
    ["strzalka-dol","Strzałka w dół","strzalka dol Strzałki"],
    ["strzalka-obie","Strzałka w obie strony","strzalka obustronna Strzałki"],
    ["strzalka-luk","Strzałka zakręcona","strzalka luk zakret Strzałki"],
    ["szewron","Szewron","szewron chevron Strzałki"],
    ["strzalka-metka","Metka","metka etykieta strzalka Strzałki"],
    ["strzalka-cienka","Strzałka cienka","strzalka linia Strzałki"],
    ["strzalka-skos","Strzałka na skos","strzalka skos ukos Strzałki"],
    ["strzalka-zawrot","Strzałka – zawróć","strzalka zawroc powrot Strzałki"],
    ["strzalka-obieg","Strzałka w kółko","strzalka obieg cykl kolko Strzałki"],
    ["szewron-podwojny","Szewron podwójny","szewron podwojny dalej Strzałki"],
    ["wskaznik","Wskaźnik","wskaznik trojkat Strzałki"],
    ["strzalka-krzyz","Strzałki na cztery strony","strzalka krzyz kierunki Strzałki"],
    ["strzalka-skos-lg","Strzałka na skos w lewo w górę","strzalka skos ukos Strzałki"],
    ["strzalka-skos-pd","Strzałka na skos w prawo w dół","strzalka skos ukos Strzałki"],
    ["strzalka-skos-ld","Strzałka na skos w lewo w dół","strzalka skos ukos Strzałki"],
    ["szewron-lewo","Szewron w lewo","szewron chevron wstecz Strzałki"],
    ["szewron-gora","Szewron w górę","szewron chevron gora Strzałki"],
    ["szewron-dol","Szewron w dół","szewron chevron dol Strzałki"],
    ["strzalka-wcieta","Strzałka z wcięciem","strzalka wcieta dalej Strzałki"],
    ["strzalka-wąska","Strzałka smukła","strzalka smukla waska Strzałki"],
    ["strzalka-gruba","Strzałka gruba","strzalka gruba duza Strzałki"],
    ["strzalka-cienka-lewo","Strzałka cienka w lewo","strzalka linia lewo Strzałki"],
    ["strzalka-cienka-obie","Strzałka cienka w obie strony","strzalka linia obustronna wymiar Strzałki"],
    ["strzalka-luk-cienka","Strzałka łukiem","strzalka luk linia odnosnik Strzałki"],
    ["strzalka-falista","Strzałka falista","strzalka falista linia odreczna Strzałki"],
    ["strzalka-zakret-lewo","Strzałka zakręcona w lewo","strzalka luk zakret lewo Strzałki"],
    ["strzalka-kolano","Strzałka z kolanem","strzalka zakret kolano schemat Strzałki"],
    ["strzalka-dwie-luk","Strzałki wymiany","strzalki wymiana odswiez cykl Strzałki"],
    ["strzalka-trzy","Trzy szewrony","szewrony dalej przewin Strzałki"],
    ["strzalka-rozgalezienie","Strzałka rozgałęziona","strzalka rozgalezienie wybor decyzja Strzałki"],
    ["dymek-lewo","Dymek z lewej","dymek rozmowa komentarz Dymki"],
    ["dymek-kolo","Dymek okrągły","dymek kolo rozmowa Dymki"],
    ["dymek-notatka","Dymek – podpis","dymek notatka podpis prostokat Dymki"],
    ["dymek","Dymek","dymek rozmowa komiks Dymki"],
    ["dymek-zaokr","Dymek zaokrąglony","dymek rozmowa komiks Dymki"],
    ["dymek-owal","Dymek owalny","dymek rozmowa komiks Dymki"],
    ["dymek-mysl","Dymek myśli","dymek mysl chmurka komiks Dymki"],
    ["dymek-krzyk","Dymek krzyku","dymek krzyk komiks wybuch Dymki"],
    ["dymek-prawo","Dymek z prawej","dymek rozmowa komentarz Dymki"],
    ["dymek-zaokr-prawo","Dymek zaokrąglony z prawej","dymek rozmowa komiks Dymki"],
    ["dymek-owal-prawo","Dymek owalny z prawej","dymek rozmowa komiks Dymki"],
    ["dymek-mysl-prawo","Dymek myśli z prawej","dymek mysl chmurka komiks Dymki"],
    ["dymek-gora","Dymek z ogonkiem u góry","dymek rozmowa podpis gora Dymki"],
    ["dymek-chmurka","Dymek chmurka","dymek chmurka mysl marzenie Dymki"],
    ["dymek-podwojny","Dwa dymki","dymki rozmowa dialog czat Dymki"],
    ["dymek-kwadrat","Dymek kwadratowy","dymek kwadrat rozmowa Dymki"],
    ["dymek-kolo-prawo","Dymek okrągły z prawej","dymek kolo rozmowa Dymki"],
    ["dymek-prostokat-dlugi","Dymek podłużny","dymek podluzny podpis rozmowa Dymki"],
  ]],
  ["komiks", "Komiks", [
    ["dymek-mowa","Mowa","komiks dymek mowa"],
    ["dymek-mysl","Myśl","komiks dymek mysl"],
    ["dymek-krzyk","Krzyk","komiks dymek krzyk"],
    ["dymek-szept","Szept","komiks dymek szept"],
    ["dymek-narracja","Narracja","komiks dymek narracja"],
    ["efekt","Efekt dźwiękowy","komiks efekt bum dzwiek"],
    ["kadry-1","1 kadr na całą stronę","komiks kadry uklad strona"],
    ["kadry-2-pion","2 kadry jeden pod drugim","komiks kadry uklad strona"],
    ["kadry-2-poziom","2 kadry obok siebie","komiks kadry uklad strona"],
    ["kadry-3-rzedy","3 kadry w rzędach","komiks kadry uklad strona"],
    ["kadry-3-duzy-gora","3 kadry – duży u góry","komiks kadry uklad strona"],
    ["kadry-4-siatka","4 kadry w siatce","komiks kadry uklad strona"],
    ["kadry-5","5 kadrów","komiks kadry uklad strona"],
    ["kadry-6-siatka","6 kadrów w siatce","komiks kadry uklad strona"],
    ["kadry-9-siatka","9 kadrów w siatce","komiks kadry uklad strona"],
    ["wzor-raster","Wzór: raster komiksowy","wzor tlo raster kropki komiks polton benday"],
    ["wzor-linie-ruchu","Wzór: linie ruchu (promieniste)","wzor tlo linie ruchu promieniste komiks akcja szybkosc wybuc"],
    ["wzor-linie-ruchu-poziome","Wzór: linie ruchu (poziome)","wzor tlo linie ruchu poziome komiks ped szybkosc"],
  ]],
  ["ramki", "Ramki", [
    ["ramka","Ramka","ramka obramowanie Ramki proste"],
    ["ramka-cienka","Ramka cienka","ramka cienka obramowanie Ramki proste"],
    ["ramka-gruba","Ramka gruba","ramka gruba obramowanie Ramki proste"],
    ["ramka-pozioma","Ramka pozioma","ramka pozioma panorama Ramki proste"],
    ["ramka-pionowa","Ramka pionowa","ramka pionowa portret Ramki proste"],
    ["ramka-panorama","Ramka panoramiczna","ramka panorama szeroka Ramki proste"],
    ["ramka-kontur","Ramka – sam kontur","ramka kontur obrys linia Ramki proste"],
    ["ramka-zaokr","Ramka zaokrąglona","ramka zaokraglona Ramki zaokrąglone"],
    ["ramka-zaokr-mala","Ramka lekko zaokrąglona","ramka zaokraglona Ramki zaokrąglone"],
    ["ramka-zaokr-duza","Ramka mocno zaokrąglona","ramka zaokraglona Ramki zaokrąglone"],
    ["ramka-pigulka","Ramka pigułka","ramka pigulka kapsula Ramki zaokrąglone"],
    ["ramka-zaokr-pozioma","Ramka zaokrąglona pozioma","ramka zaokraglona pozioma Ramki zaokrąglone"],
    ["ramka-zaokr-cienka","Ramka zaokrąglona cienka","ramka zaokraglona cienka Ramki zaokrąglone"],
    ["ramka-zaokr-kontur","Ramka zaokrąglona – kontur","ramka zaokraglona kontur obrys Ramki zaokrąglone"],
    ["ramka-podwojna","Ramka podwójna","ramka podwojna Ramki podwójne i przerywane"],
    ["ramka-potrojna","Ramka potrójna","ramka potrojna linie Ramki podwójne i przerywane"],
    ["ramka-podwojna-zaokr","Ramka podwójna zaokrąglona","ramka podwojna zaokraglona Ramki podwójne i przerywane"],
    ["ramka-gruba-cienka","Ramka gruba z cienką","ramka podwojna gruba cienka Ramki podwójne i przerywane"],
    ["ramka-przerywana","Ramka przerywana","ramka przerywana kupon ciecie Ramki podwójne i przerywane"],
    ["ramka-kropkowana","Ramka kropkowana","ramka kropkowana kropki Ramki podwójne i przerywane"],
    ["ramka-kreska-kropka","Ramka kreska – kropka","ramka kreska kropka Ramki podwójne i przerywane"],
    ["ramka-przerywana-zaokr","Ramka przerywana zaokrąglona","ramka przerywana zaokraglona Ramki podwójne i przerywane"],
    ["ramka-kropkowana-kolo","Ramka kropkowana okrągła","ramka kropkowana kolo Ramki podwójne i przerywane"],
    ["ramka-wciecia","Ramka z wcięciami","ramka ozdobna Ramki ozdobne"],
    ["ramka-falista","Ramka falista","ramka ozdobna falista Ramki ozdobne"],
    ["ramka-zabkowana","Ramka ząbkowana","ramka zabkowana stara fotografia Ramki ozdobne"],
    ["ramka-kola-rogi","Ramka z kółkami w rogach","ramka kola rogi ozdobna Ramki ozdobne"],
    ["ramka-kwadraty-rogi","Ramka z kwadratami w rogach","ramka kwadraty rogi ozdobna Ramki ozdobne"],
    ["ramka-sciete","Ramka ze ściętymi rogami","ramka sciete rogi Ramki ozdobne"],
    ["ramka-art-deco","Ramka art deco","ramka art deco schodki Ramki ozdobne"],
    ["ramka-romby","Ramka z rombami","ramka romby ozdobna Ramki ozdobne"],
    ["ramka-luki-rogi","Ramka z wklęsłymi rogami","ramka wklesle rogi ozdobna vintage Ramki ozdobne"],
    ["ramka-narozniki-ozdobne","Ramka z ozdobnymi narożnikami","ramka narozniki ozdobna vintage Ramki ozdobne"],
    ["ramka-sznurek","Ramka z kropek","ramka kropki koraliki sznurek Ramki ozdobne"],
    ["ramka-listki","Ramka z listkami","ramka listki wianek natura Ramki ozdobne"],
    ["ramka-przerwa-gora","Ramka z przerwą na tytuł","ramka tytul przerwa naglowek Ramki z tytułem"],
    ["ramka-tabliczka","Ramka z tabliczką u góry","ramka tytul tabliczka naglowek Ramki z tytułem"],
    ["ramka-pasek-tytulu","Ramka z paskiem tytułu","ramka tytul pasek naglowek Ramki z tytułem"],
    ["ramka-zaokr-przerwa","Ramka zaokrąglona z przerwą","ramka zaokraglona tytul przerwa Ramki z tytułem"],
    ["ramka-wstega-tytul","Ramka ze wstęgą","ramka wstega tytul Ramki z tytułem"],
    ["ramka-zakladka","Ramka z zakładką","ramka zakladka teczka folder Ramki z tytułem"],
    ["serce-ramka","Serce – ramka","serce ramka milosc Ramki w kształcie"],
    ["ramka-owal","Ramka owalna","ramka owal medalion portret Ramki w kształcie"],
    ["ramka-okragla","Ramka okrągła","ramka kolo okrag pierscien Ramki w kształcie"],
    ["ramka-chmurka","Ramka chmurka","ramka chmurka falista dzieci Ramki w kształcie"],
    ["ramka-osmiokat","Ramka ośmiokątna","ramka osmiokat Ramki w kształcie"],
    ["ramka-szesciokat","Ramka sześciokątna","ramka szesciokat plaster Ramki w kształcie"],
    ["ramka-luk","Ramka łukowa","ramka luk okno brama Ramki w kształcie"],
    ["ramka-romb","Ramka rombowa","ramka romb diament Ramki w kształcie"],
    ["ramka-gwiazda","Ramka gwiazda","ramka gwiazda Ramki w kształcie"],
    ["ramka-tarcza","Ramka tarcza","ramka tarcza herb Ramki w kształcie"],
    ["ramka-kropla","Ramka kropla","ramka kropla lisc Ramki w kształcie"],
    ["ramka-zdjecie","Odbitka jak z polaroidu","ramka zdjecie odbitka fotografia Na zdjęcie"],
    ["zdj-kolo","Zdjęcie w kole","zdjecie kolo portret pole obraz Na zdjęcie"],
    ["zdj-owal","Zdjęcie w owalu","zdjecie owal portret medalion pole obraz Na zdjęcie"],
    ["zdj-serce","Zdjęcie w sercu","zdjecie serce milosc pole obraz Na zdjęcie"],
    ["zdj-luk","Zdjęcie w łuku","zdjecie luk okno pole obraz Na zdjęcie"],
    ["zdj-szesciokat","Zdjęcie w sześciokącie","zdjecie szesciokat pole obraz Na zdjęcie"],
    ["zdj-osmiokat","Zdjęcie w ośmiokącie","zdjecie osmiokat pole obraz Na zdjęcie"],
    ["zdj-chmurka","Zdjęcie w chmurce","zdjecie chmurka falista pole obraz Na zdjęcie"],
    ["zdj-romb","Zdjęcie w rombie","zdjecie romb pole obraz Na zdjęcie"],
    ["zdj-zaokr","Zdjęcie zaokrąglone","zdjecie zaokraglone pole obraz Na zdjęcie"],
    ["zdj-kropla","Zdjęcie w kropli","zdjecie kropla lisc pole obraz Na zdjęcie"],
    ["zdj-gwiazda","Zdjęcie w gwieździe","zdjecie gwiazda pole obraz Na zdjęcie"],
    ["ramka-polaroid-kw","Odbitka kwadratowa","odbitka polaroid kwadrat ramka zdjecie Na zdjęcie"],
    ["ramka-slajd","Ramka slajdu","slajd diapozytyw ramka zdjecie retro Na zdjęcie"],
    ["ramka-film","Klatka filmu","film klisza klatka kino zdjecie Na zdjęcie"],
    ["kartka-rog","Kartka z zagiętym rogiem","kartka notatka zagiety rog dokument Kartki i notatki"],
    ["karteczka","Karteczka samoprzylepna","karteczka notatka przypomnienie Kartki i notatki"],
    ["kartka-tasma","Kartka z taśmą","kartka tasma notatka scrapbook Kartki i notatki"],
    ["kartka-dziurki","Kartka z dziurkami","kartka segregator dziurki zeszyt Kartki i notatki"],
    ["kartka-podarta","Kartka podarta","kartka podarta wyrwana notes Kartki i notatki"],
    ["kartka-spirala","Kartka z kołonotatnika","kartka spirala notes kolonotatnik Kartki i notatki"],
    ["bordiura-linia","Obramowanie strony – linia","obramowanie strony bordiura linia Obramowania stron"],
    ["bordiura-podwojna","Obramowanie strony – podwójne","obramowanie strony bordiura podwojne Obramowania stron"],
    ["bordiura-narozniki","Obramowanie strony z narożnikami","obramowanie strony bordiura narozniki vintage Obramowania st"],
    ["bordiura-kropki","Obramowanie strony z kropek","obramowanie strony bordiura kropki Obramowania stron"],
    ["bordiura-romby","Obramowanie strony z rombów","obramowanie strony bordiura romby Obramowania stron"],
    ["bordiura-zabki","Obramowanie strony ząbkowane","obramowanie strony bordiura zabki znaczek Obramowania stron"],
    ["bordiura-falista","Obramowanie strony faliste","obramowanie strony bordiura falista Obramowania stron"],
    ["bordiura-gwiazdki","Obramowanie strony z gwiazdek","obramowanie strony bordiura gwiazdki Obramowania stron"],
  ]],
  ["ozdobniki", "Ozdobniki", [
    ["wstega","Wstęga","wstega baner Wstęgi i banery"],
    ["proporczyk","Proporczyk","flaga proporczyk baner Wstęgi i banery"],
    ["bilet","Bilet","bilet kupon etykieta Wstęgi i banery"],
    ["zakladka","Zakładka","zakladka ksiazka Wstęgi i banery"],
    ["fala","Wstęga falista","fala wstega baner Wstęgi i banery"],
    ["wstega-naroznik","Wstęga narożna","wstega naroznik rog nowosc Wstęgi i banery"],
    ["baner-zawiniety","Baner zawinięty","baner wstega tytul Wstęgi i banery"],
    ["odznaka-wstazki","Odznaka ze wstążkami","odznaka medal nagroda wstazka Wstęgi i banery"],
    ["wstega-luk","Wstęga łukowa","wstega luk baner tytul Wstęgi i banery"],
    ["flaga-powiewajaca","Flaga powiewająca","flaga powiewajaca baner Wstęgi i banery"],
    ["proporzec","Proporzec trójkątny","proporzec flaga trojkat Wstęgi i banery"],
    ["proporczyk-pion","Proporczyk pionowy","proporczyk flaga pionowy zakladka Wstęgi i banery"],
    ["wstega-ukosna","Wstęga ukośna","wstega ukosna szarfa Wstęgi i banery"],
    ["baner-prosty","Baner z zakładkami","baner tytul wstega Wstęgi i banery"],
    ["wstega-medal","Wstążka do medalu","wstazka medal nagroda Wstęgi i banery"],
    ["tabliczka-tytul","Tabliczka tytułowa","tabliczka tytul baner zaokraglona Wstęgi i banery"],
    ["ramka-narozniki","Cztery narożniki","ramka narozniki rogi zdjecie Narożniki"],
    ["naroznik-l-kropka","Narożnik z kropką","naroznik rog kropka Narożniki"],
    ["naroznik-luk","Narożnik łukowy","naroznik rog luk Narożniki"],
    ["naroznik-zawijas","Narożnik z zawijasem","naroznik zawijas ornament vintage Narożniki"],
    ["naroznik-trojkat","Narożnik trójkątny","naroznik rog trojkat zdjecie Narożniki"],
    ["naroznik-kwiat","Narożnik z kwiatkiem","naroznik kwiat ornament Narożniki"],
    ["naroznik-podwojny","Narożnik podwójny","naroznik rog podwojny linia Narożniki"],
    ["naroznik-schodki","Narożnik schodkowy","naroznik art deco schodki Narożniki"],
    ["naroznik-lisc","Narożnik z liśćmi","naroznik lisc galazka natura Narożniki"],
    ["narozniki-ozdobne","Cztery narożniki ozdobne","narozniki ozdobne ramka rogi Narożniki"],
    ["narozniki-luk","Cztery narożniki łukowe","narozniki luk ramka rogi Narożniki"],
    ["rozeta-platki","Rozeta z płatków","rozeta kwiat ornament mandala Rozety i ornamenty"],
    ["rozeta-podwojna","Rozeta podwójna","rozeta ornament mandala Rozety i ornamenty"],
    ["mandala","Mandala","mandala ornament kolo Rozety i ornamenty"],
    ["roza-wiatrow","Róża wiatrów","roza wiatrow kompas podroz mapa Rozety i ornamenty"],
    ["ornament-romb","Ornament rombowy","ornament romb ozdobnik Rozety i ornamenty"],
    ["medalion","Medalion","medalion ornament owal Rozety i ornamenty"],
    ["koniczyna","Czterolistna koniczyna","koniczyna szczescie ornament Rozety i ornamenty"],
    ["ornament-kolo-kropki","Koło z kropkami","ornament kolo kropki Rozety i ornamenty"],
    ["lilia","Lilia","lilia ornament herb fleur Rozety i ornamenty"],
    ["gwiazda-ornament","Gwiazda ornamentowa","gwiazda ornament islamska Rozety i ornamenty"],
  ]],
  ["linie", "Linie i separatory", [
    ["ciagla","Linia ciągła","linia prosta kreska separator"],
    ["cienka","Linia cienka","linia cienka wloskowa separator"],
    ["gruba","Linia gruba","linia gruba pogrubiona separator"],
    ["przerywana","Linia przerywana","linia przerywana kreski ciecie separator"],
    ["kropkowana","Linia kropkowana","linia kropkowana kropki wypelnienie separator"],
    ["kreska-kropka","Linia kreska – kropka","linia kreska kropka os separator"],
    ["podwojna","Linia podwójna","linia podwojna separator"],
    ["pionowa","Linia pionowa","linia pionowa kolumna separator"],
    ["linia-fala","Fala","linia fala ozdobnik Separatory ozdobne"],
    ["linia-zygzak","Zygzak","linia zygzak Separatory ozdobne"],
    ["linia-romb","Linia z rombem","linia separator ozdobnik Separatory ozdobne"],
    ["linia-petla","Ozdobnik z pętlą","ozdobnik petla linia Separatory ozdobne"],
    ["linia-kropki","Trzy kropki","kropki separator Separatory ozdobne"],
    ["linia-serce","Linia z sercem","linia serce separator ozdobnik Separatory ozdobne"],
    ["linia-gwiazdki","Trzy gwiazdki","gwiazdki separator ozdobnik Separatory ozdobne"],
    ["linia-fala-podw","Fala podwójna","fala podwojna linia Separatory ozdobne"],
    ["linia-zawijas","Zawijas","zawijas ornament vintage Separatory ozdobne"],
    ["sep-kropka","Linia z kropką","linia kropka separator Separatory ozdobne"],
    ["sep-kolo","Linia z kółkiem","linia kolo separator Separatory ozdobne"],
    ["sep-gwiazdka","Linia z gwiazdką","linia gwiazda separator Separatory ozdobne"],
    ["sep-kwiat","Linia z kwiatkiem","linia kwiat separator Separatory ozdobne"],
    ["sep-trzy-romby","Linia z trzema rombami","linia romby separator Separatory ozdobne"],
    ["sep-zawijasy","Zawijasy","zawijasy ornament vintage separator Separatory ozdobne"],
    ["sep-szewrony","Szewrony","szewrony zygzak separator Separatory ozdobne"],
    ["sep-petelki","Pętelki","petelki linia ozdobnik Separatory ozdobne"],
    ["sep-liscie","Linia z listkami","linia listki galazka separator Separatory ozdobne"],
    ["sep-kropki-rosnace","Kropki rosnące","kropki separator rosnace Separatory ozdobne"],
    ["sep-fala-gesta","Fala gęsta","fala linia separator Separatory ozdobne"],
    ["sep-art-deco","Separator art deco","art deco separator linia Separatory ozdobne"],
  ]],
  ["etykiety", "Etykiety i plakietki", [
    ["etykieta-zaokr","Etykieta zaokrąglona","etykieta naklejka napis Etykiety"],
    ["etykieta-scieta","Etykieta ze ściętymi rogami","etykieta scieta rogi tabliczka Etykiety"],
    ["etykieta-ozdobna","Etykieta ozdobna","etykieta sloik przetwory vintage Etykiety"],
    ["metka-dziurka","Metka z dziurką","metka zawieszka cena prezent Etykiety"],
    ["plakietka","Plakietka okrągła","plakietka znaczek przypinka okragla Etykiety"],
    ["pieczatka","Pieczątka","pieczatka stempel Etykiety"],
    ["znaczek-pocztowy","Znaczek pocztowy","znaczek pocztowy poczta kartka Etykiety"],
    ["tabliczka","Tabliczka z zawieszką","tabliczka zawieszka drzwi napis Etykiety"],
    ["etykieta-owalna","Etykieta owalna","etykieta owal naklejka Etykiety"],
    ["etykieta-obwodka","Etykieta z obwódką","etykieta obwodka ramka napis Etykiety"],
    ["etykieta-wstega","Etykieta wstęgowa","etykieta wstega cena Etykiety"],
    ["etykieta-falista","Etykieta falista","etykieta falista naklejka Etykiety"],
    ["etykieta-ząbkowana","Etykieta ząbkowana","etykieta zabkowana kupon bilet Etykiety"],
    ["etykieta-sloik","Etykieta na słoik","etykieta sloik przetwory dzem Etykiety"],
    ["etykieta-cenowka","Cenówka","cenowka cena metka sklep Etykiety"],
    ["etykieta-kolo-zabki","Etykieta okrągła ząbkowana","etykieta okragla naklejka Etykiety"],
    ["etykieta-tarcza","Etykieta herbowa","etykieta tarcza herb vintage Etykiety"],
    ["etykieta-szesciokat","Etykieta sześciokątna","etykieta szesciokat napis Etykiety"],
    ["naklejka-kolo","Naklejka okrągła","naklejka kolo kropka Etykiety"],
    ["etykieta-chmurka","Etykieta chmurka","etykieta chmurka dzieci Etykiety"],
  ]],
  ["okolicznosciowe", "Okolicznościowe", [
    ["boze-narodzenie-naglowek","Boże Narodzenie – nagłówek","swieta boze narodzenie wigilia choinka naglowek zyczenia"],
    ["boze-narodzenie-ramka","Boże Narodzenie – ramka","swieta boze narodzenie wigilia choinka ramka obramowanie"],
    ["boze-narodzenie-szlaczek","Boże Narodzenie – szlaczek","swieta boze narodzenie wigilia choinka szlaczek ozdobnik pas"],
    ["boze-narodzenie-kartka","Boże Narodzenie – kartka","swieta boze narodzenie wigilia choinka kartka zaproszenie zy"],
    ["wielkanoc-naglowek","Wielkanoc – nagłówek","wielkanoc swieta pisanki zmartwychwstanie naglowek zyczenia"],
    ["wielkanoc-ramka","Wielkanoc – ramka","wielkanoc swieta pisanki zmartwychwstanie ramka obramowanie"],
    ["wielkanoc-szlaczek","Wielkanoc – szlaczek","wielkanoc swieta pisanki zmartwychwstanie szlaczek ozdobnik"],
    ["wielkanoc-kartka","Wielkanoc – kartka","wielkanoc swieta pisanki zmartwychwstanie kartka zaproszenie"],
    ["urodziny-naglowek","Urodziny – nagłówek","urodziny impreza tort balony naglowek zyczenia"],
    ["urodziny-ramka","Urodziny – ramka","urodziny impreza tort balony ramka obramowanie"],
    ["urodziny-szlaczek","Urodziny – szlaczek","urodziny impreza tort balony szlaczek ozdobnik pasek"],
    ["urodziny-kartka","Urodziny – kartka","urodziny impreza tort balony kartka zaproszenie zyczenia"],
    ["slub-naglowek","Ślub – nagłówek","slub wesele zaproszenie obraczki para mloda naglowek zyczeni"],
    ["slub-ramka","Ślub – ramka","slub wesele zaproszenie obraczki para mloda ramka obramowani"],
    ["slub-szlaczek","Ślub – szlaczek","slub wesele zaproszenie obraczki para mloda szlaczek ozdobni"],
    ["slub-kartka","Ślub – kartka","slub wesele zaproszenie obraczki para mloda kartka zyczenia"],
    ["chrzest-naglowek","Chrzest – nagłówek","chrzest swiety pamiatka golebica naglowek zyczenia"],
    ["chrzest-ramka","Chrzest – ramka","chrzest swiety pamiatka golebica ramka obramowanie"],
    ["chrzest-szlaczek","Chrzest – szlaczek","chrzest swiety pamiatka golebica szlaczek ozdobnik pasek"],
    ["chrzest-kartka","Chrzest – kartka","chrzest swiety pamiatka golebica kartka zaproszenie zyczenia"],
    ["komunia-naglowek","Pierwsza Komunia – nagłówek","komunia pierwsza swieta pamiatka kielich hostia naglowek zyc"],
    ["komunia-ramka","Pierwsza Komunia – ramka","komunia pierwsza swieta pamiatka kielich hostia ramka obramo"],
    ["komunia-szlaczek","Pierwsza Komunia – szlaczek","komunia pierwsza swieta pamiatka kielich hostia szlaczek ozd"],
    ["komunia-kartka","Pierwsza Komunia – kartka","komunia pierwsza swieta pamiatka kielich hostia kartka zapro"],
    ["szkola-naglowek","Szkoła – nagłówek","szkola dyplom swiadectwo zakonczenie roku naglowek zyczenia"],
    ["szkola-ramka","Szkoła – ramka","szkola dyplom swiadectwo zakonczenie roku ramka obramowanie"],
    ["szkola-szlaczek","Szkoła – szlaczek","szkola dyplom swiadectwo zakonczenie roku szlaczek ozdobnik"],
    ["szkola-kartka","Szkoła – kartka","szkola dyplom swiadectwo zakonczenie roku kartka zaproszenie"],
  ]],
  ["dymki", "Dymki", [
    ["dymek-mowa","Dymek – mowa","dymek mowa rozmowa komiks dialog"],
    ["dymek-mysl","Dymek – myśl","dymek mysl chmurka komiks"],
    ["dymek-krzyk","Dymek – krzyk","dymek krzyk wybuch komiks"],
    ["dymek-szept","Dymek – szept","dymek szept cicho przerywany komiks"],
    ["dymek-narracja","Ramka narracji","dymek narracja ramka komiks opis"],
  ]],
  ["tla", "Tła i wzory", [
    ["wzor-paski-poziome","Wzór: paski poziome","wzor tlo paski linie poziome"],
    ["wzor-paski-pionowe","Wzór: paski pionowe","wzor tlo paski linie pionowe"],
    ["wzor-paski-skosne","Wzór: paski ukośne","wzor tlo paski skos ukosne"],
    ["wzor-kropki","Wzór: kropki","wzor tlo kropki groszki punkty"],
    ["wzor-groszki","Wzór: groszki","wzor tlo groszki kropki przesuniete"],
    ["wzor-kratka","Wzór: kratka","wzor tlo kratka siatka kwadraty"],
    ["wzor-krata","Wzór: krata","wzor tlo krata szkocka obrus vichy"],
    ["wzor-jodelka","Wzór: jodełka","wzor tlo jodelka parkiet zygzak"],
    ["wzor-fale","Wzór: fale","wzor tlo fale falki woda"],
    ["wzor-zygzak","Wzór: zygzak","wzor tlo zygzak chevron"],
    ["wzor-romby","Wzór: romby","wzor tlo romby karo arlekin"],
    ["wzor-gwiazdki","Wzór: gwiazdki","wzor tlo gwiazdki niebo noc"],
    ["wzor-kwiatki","Wzór: kwiatki","wzor tlo kwiatki laczka wiosna"],
    ["wzor-plaster-miodu","Wzór: plaster miodu","wzor tlo heksagony szesciokaty plaster"],
    ["wzor-luski","Wzór: łuski","wzor tlo luski fale polkola japonskie"],
    ["wzor-trojkaty","Wzór: trójkąty","wzor tlo trojkaty geometryczny"],
    ["wzor-krzyzyki","Wzór: krzyżyki","wzor tlo plusy krzyzyki punkty"],
    ["wzor-kola","Wzór: koła","wzor tlo okregi kolka bable"],
    ["wzor-raster","Wzór: raster komiksowy","wzor tlo raster kropki komiks polton benday"],
    ["wzor-linie-ruchu","Wzór: linie ruchu (promieniste)","wzor tlo linie ruchu promieniste komiks akcja szybkosc wybuc"],
    ["wzor-linie-ruchu-poziome","Wzór: linie ruchu (poziome)","wzor tlo linie ruchu poziome komiks ped szybkosc"],
    ["tekstura-len","Płótno lniane","tekstura papier tlo len tkanina plotno"],
    ["tekstura-karton","Karton","tekstura papier tlo karton tektura"],
    ["tekstura-kraft","Papier pakowy","tekstura papier tlo kraft szary pakowy"],
    ["tekstura-czerpany","Papier czerpany","tekstura papier tlo czerpany wlokna recznie robiony"],
    ["tekstura-zeszytowy","Papier w linie z marginesem","tekstura papier tlo zeszyt linie margines szkola"],
    ["tekstura-milimetrowy","Papier milimetrowy","tekstura papier tlo milimetrowy siatka techniczny"],
    ["przejscie-pion","Tło: przejście z góry na dół","tlo gradient przejscie pionowe"],
    ["przejscie-poziom","Tło: przejście z boku","tlo gradient przejscie poziome"],
    ["przejscie-ukos","Tło: przejście ukośne","tlo gradient przejscie ukos"],
    ["przejscie-kolo","Tło: poświata ze środka","tlo gradient kolowy poswiata srodek"],
    ["przejscie-zachod","Tło: zachód słońca","tlo gradient pomaranczowy rozowy cieply"],
    ["przejscie-morze","Tło: morze","tlo gradient niebieski turkus chlodny"],
    ["przejscie-noc","Tło: nocne niebo","tlo gradient ciemny granat noc"],
    ["plama-1","Plama okrągła","plama blob ksztalt organiczny"],
    ["plama-2","Plama podłużna","plama blob organiczny"],
    ["plama-3","Plama falista","plama blob nieregularna"],
    ["akwarela-1","Akwarela – trzy warstwy","akwarela plama farba"],
    ["akwarela-2","Akwarela – dwa kolory","akwarela plama dwa kolory"],
    ["akwarela-pas","Akwarela – pas pod tytuł","akwarela pasek tytul podklad"],
    ["plamki","Rozprysk kropli","kropki plamki rozprysk akwarela"],
    ["ksiezyc-plama","Plama półksiężyc","polksiezyc plama ozdoba"],
  ]],
  ["wzorce-stron", "Wzorce stron", [
    ["numer-dol","Numer strony na dole","wzorzec wzorce strony powtarzane numeracja numer stopka"],
    ["numer-zewnatrz","Numer strony przy zewnętrznej krawędzi","wzorzec wzorce strony powtarzane numeracja numer ksiazka roz"],
    ["numer-z-liczba","Strona 5 z 120","wzorzec wzorce strony powtarzane numeracja liczba stron"],
    ["numer-kreski","Numer z kreskami","wzorzec wzorce strony powtarzane numeracja ozdobny klasyczny"],
    ["numer-kolo","Numer w kółku","wzorzec wzorce strony powtarzane numeracja kolo kolorowy now"],
    ["numer-boczny","Numer na pasku bocznym","wzorzec wzorce strony powtarzane numeracja pasek bok kolor"],
    ["numer-rzymski","Numer rzymski (wstęp)","wzorzec wzorce strony powtarzane numeracja rzymskie wstep pr"],
    ["stopka","Stopka: nazwa projektu i numer","wzorzec wzorce strony powtarzane stopka linia numer nazwa"],
    ["naglowek","Nagłówek: nazwa sekcji","wzorzec wzorce strony powtarzane naglowek sekcja linia"],
    ["naglowek-projekt-sekcja","Nagłówek: projekt i sekcja","wzorzec wzorce strony powtarzane naglowek projekt sekcja"],
    ["naglowek-pasek","Kolorowy pas nagłówka","wzorzec wzorce strony powtarzane naglowek pas kolor banner"],
    ["stopka-pasek","Kolorowy pas stopki z numerem","wzorzec wzorce strony powtarzane stopka pas kolor numer"],
    ["stopka-kontakt","Stopka z kontaktem","wzorzec wzorce strony powtarzane stopka kontakt adres telefo"],
    ["linie","Linie do pisania","wzorzec wzorce strony powtarzane linie zeszyt notatki pisani"],
    ["kratka","Kratka 5 mm","wzorzec wzorce strony powtarzane kratka siatka zeszyt matema"],
    ["kropki","Kropki 5 mm","wzorzec wzorce strony powtarzane kropki dot grid bullet jour"],
    ["milimetrowy","Papier milimetrowy","wzorzec wzorce strony powtarzane milimetrowy siatka wykres t"],
    ["linie-margines","Zeszyt z marginesem","wzorzec wzorce strony powtarzane zeszyt linie margines szkol"],
    ["tlo-kolor","Kolorowe tło","wzorzec wzorce strony powtarzane tlo kolor strona"],
    ["tlo-rog","Ozdobny róg","wzorzec wzorce strony powtarzane tlo ozdoba rog kolo"],
    ["znak-wodny","Znak wodny „WZÓR”","wzorzec wzorce strony powtarzane znak wodny wzor probny szki"],
    ["ramka","Ramka w marginesach","wzorzec wzorce strony powtarzane ramka obramowanie"],
    ["ramka-podwojna","Ramka podwójna","wzorzec wzorce strony powtarzane ramka podwojna elegancka dy"],
    ["ramka-zaokraglona","Ramka zaokrąglona","wzorzec wzorce strony powtarzane ramka zaokraglona miekka"],
    ["ramka-krawedz","Kolorowa obwódka strony","wzorzec wzorce strony powtarzane ramka obwodka krawedz spad"],
    ["ramka-narozniki","Narożniki","wzorzec wzorce strony powtarzane ramka narozniki rogi"],
    ["zakladka","Zakładka na brzegu","wzorzec wzorce strony powtarzane zakladka indeks brzeg seria"],
    ["naglowek-dnia","Nagłówek dnia","wzorzec wzorce strony powtarzane kalendarz dzien data planer"],
    ["planer-notatki-bok","Kolumna „Notatki” z boku","wzorzec wzorce strony powtarzane planer notatki kolumna lini"],
    ["planer-tydzien","Tydzień: 7 dni","wzorzec wzorce strony powtarzane planer tydzien dni kalendar"],
    ["ksiazka-klasyczna","Książka klasyczna","wzorzec wzorce strony powtarzane ksiazka zywa pagina rozdzia"],
    ["ksiazka-numer-gora","Numer i rozdział u góry","wzorzec wzorce strony powtarzane ksiazka zywa pagina numer g"],
    ["ksiazka-tytul-sekcji","Tytuł książki i rozdziału","wzorzec wzorce strony powtarzane ksiazka naglowek tytul rozd"],
    ["katalog","Katalog: logo i kontakt","wzorzec wzorce strony powtarzane katalog oferta firma logo k"],
    ["oferta-pas-boczny","Oferta z pasem bocznym","wzorzec wzorce strony powtarzane oferta katalog pas bok pion"],
    ["gazetka","Gazetka: winieta","wzorzec wzorce strony powtarzane gazetka gazeta parafialna s"],
    ["gazetka-kolumny","Gazetka: linie między kolumnami","wzorzec wzorce strony powtarzane gazetka kolumny szpalty lin"],
    ["zaproszenie","Zaproszenie: ozdobna ramka","wzorzec wzorce strony powtarzane zaproszenie slub komunia ch"],
    ["zaproszenie-pasy","Zaproszenie: pasy u góry i u dołu","wzorzec wzorce strony powtarzane zaproszenie pasy kolor eleg"],
  ]],
  ["kalendarze", "Kalendarze", [
    ["zwykly","Kalendarz miesiąca","kalendarz miesiac siatka dni swieta"],
    ["notatki","Kalendarz z miejscem na notatki","kalendarz miesiac planer notatki duzy"],
    ["tygodnie","Kalendarz z numerami tygodni","kalendarz miesiac tydzien numery tygodni"],
  ]],
  ["planer", "Planer", [
    ["lista-zadan","Lista zadań","planer tabela lista zadan todo do zrobienia checkbox"],
    ["tracker-nawykow","Tracker nawyków","planer tabela tracker nawyki nawykow tydzien habit"],
    ["plan-tygodnia","Plan tygodnia","planer tabela plan tygodnia tydzien dni"],
    ["plan-dnia","Plan dnia","planer tabela plan dnia godziny harmonogram"],
    ["notatki-linie","Notatki w linie","planer tabela notatki linie liniatura zeszyt pisanie"],
    ["siatka-dni","Siatka dni tygodnia","planer tabela siatka dni tygodnia miesiac kalendarz pusty"],
    ["lista-zakupow","Lista zakupów","planer tabela lista zakupow sklep produkty"],
    ["cele","Cele","planer tabela cele miesiaca plan termin"],
    ["budzet","Budżet","planer tabela budzet wydatki pieniadze plan finanse"],
    ["kontakty","Kontakty","planer tabela kontakty telefony adresy email"],
    ["plan-lekcji","Plan lekcji","planer tabela plan lekcji szkola zajecia tydzien"],
    ["kalendarz-roczny","Kalendarz roczny","kalendarz roczny rok miesiace planer"],
    ["plan-miesiaca-lista","Plan miesiąca – lista dni","planer tabela plan miesiaca dni lista 31"],
    ["plan-tygodnia-kolumny","Plan tygodnia – kolumny","planer tabela plan tygodnia kolumny dni poziomo"],
    ["plan-tygodnia-priorytety","Tydzień z priorytetami","planer tabela plan tygodnia priorytety cele zadania"],
    ["plan-posilkow","Plan posiłków","planer tabela plan posilkow jadlospis menu dieta tydzien"],
    ["tracker-nastroju","Tracker nastroju","planer tabela tracker nastroj samopoczucie emocje miesiac"],
    ["tracker-wody","Tracker wody","planer tabela tracker woda picie szklanki nawodnienie"],
    ["tracker-czytania","Tracker czytania","planer tabela tracker czytanie ksiazki lektura strony"],
    ["dziennik-modlitwy","Dziennik modlitwy","planer tabela modlitwa intencje dziennik wiara wysluchane"],
    ["lista-zyczen","Lista życzeń","planer tabela lista zyczen marzenia prezenty"],
    ["budzet-miesieczny","Budżet miesięczny","planer tabela budzet miesieczny wydatki kategorie finanse do"],
    ["kratka","Notatki w kratkę","kratka notatki siatka zeszyt Notatki"],
    ["kropki","Notatki w kropki","kropki notatki bullet journal Notatki"],
    ["linie-notatki","Linie do notatek","linie notatki zeszyt linijki Notatki"],
    ["kratka-gesta","Papier milimetrowy","papier milimetrowy kratka gesta siatka Notatki"],
    ["izometryczna","Siatka izometryczna","siatka izometryczna trojkatna kropki Notatki"],
  ]],
  ["formularze", "Formularze do druku", [
    ["podpis","Data i podpis","podpis data linia formularz"],
    ["kratki-litery","Kratki na litery","kratki litery drukowane imie nazwisko pesel"],
    ["dane-osobowe","Pola: imię, nazwisko, data","formularz pola dane osobowe imie nazwisko data adres"],
    ["odcinek","Odcinek do odcięcia","odetnij nozyczki kupon linia ciecia"],
    ["pola-wyboru","Pola wyboru z opisem","pola wyboru checkbox tak nie ankieta"],
    ["skala-ocen","Skala ocen 1–5","ankieta ocena skala zadowolenie"],
    ["uwagi","Pole na uwagi","uwagi notatki linie miejsce na odpowiedz"],
    ["kupon","Kupon","kupon voucher bon rabat zaproszenie"],
    ["zgoda","Zgoda z podpisem","zgoda oswiadczenie rodo podpis"],
    ["zamowienie","Tabelka zamówienia","planer tabela zamowienie produkty ilosc cena formularz"],
    ["lista-obecnosci","Lista obecności","planer tabela lista obecnosci podpisy spotkanie"],
  ]],
  ["wykresy", "Wykresy", [
    ["slupki","Wykres słupkowy","wykres dane liczby diagram"],
    ["poziome","Wykres poziomy","wykres dane liczby diagram"],
    ["linia","Wykres liniowy","wykres dane liczby diagram"],
    ["kolo","Wykres kołowy","wykres dane liczby diagram"],
    ["pierscien","Wykres pierścieniowy","wykres dane liczby diagram"],
  ]],
  ["infografiki", "Infografiki", [
    ["os-czasu-pozioma","Oś czasu pozioma","os czasu historia daty kalendarium"],
    ["os-czasu-pionowa","Oś czasu pionowa","os czasu historia lista dat"],
    ["kroki-procesu","Kroki procesu","kroki proces etapy kolejnosc"],
    ["strzalki-procesu","Strzałki procesu","strzalki chevron etapy proces"],
    ["statystyki","Liczby i statystyki","statystyka liczby licznik procent wyniki"],
    ["porownanie","Porównanie","porownanie przed po za przeciw versus"],
    ["drzewo","Drzewo","drzewo hierarchia schemat struktura genealogia"],
    ["piramida","Piramida","piramida poziomy hierarchia potrzeb"],
    ["cykl","Cykl","cykl obieg kolo powtarzanie"],
    ["paski-postepu","Paski postępu","pasek postep procent umiejetnosci"],
    ["ocena-gwiazdki","Ocena gwiazdkami","ocena gwiazdki opinia recenzja"],
    ["lejek","Lejek","lejek etapy sprzedaz zawezanie"],
    ["mapa-mysli","Mapa myśli","mapa mysli burza mozgow pomysly"],
    ["macierz","Macierz 2 × 2","macierz cwiartki priorytety pilne wazne eisenhower"],
  ]],
  ["kolaze", "Kolaże zdjęć", [
    ["2-pion","Kolaż: 2 obok siebie","kolaz zdjecia siatka zdjec fotografie"],
    ["2-poziom","Kolaż: 2 jeden pod drugim","kolaz zdjecia siatka zdjec fotografie"],
    ["3-kolumny","Kolaż: 3 kolumny","kolaz zdjecia siatka zdjec fotografie"],
    ["3-duzy-lewo","Kolaż: 3 – duże z lewej","kolaz zdjecia siatka zdjec fotografie"],
    ["3-duzy-gora","Kolaż: 3 – duże u góry","kolaz zdjecia siatka zdjec fotografie"],
    ["4-siatka","Kolaż: 4 – siatka","kolaz zdjecia siatka zdjec fotografie"],
    ["4-duzy-lewo","Kolaż: 4 – duże z lewej","kolaz zdjecia siatka zdjec fotografie"],
    ["5-mozaika","Kolaż: 5 – mozaika","kolaz zdjecia siatka zdjec fotografie"],
    ["5-duzy-gora","Kolaż: 5 – duże u góry","kolaz zdjecia siatka zdjec fotografie"],
    ["6-siatka","Kolaż: 6 – siatka 3 × 2","kolaz zdjecia siatka zdjec fotografie"],
    ["6-pion","Kolaż: 6 – siatka 2 × 3","kolaz zdjecia siatka zdjec fotografie"],
    ["9-siatka","Kolaż: 9 – siatka 3 × 3","kolaz zdjecia siatka zdjec fotografie"],
  ]],
  ["naglowki", "Nagłówki i tytuły", [
    ["tytul-podtytul","Tytuł i podtytuł","tytul podtytul naglowek"],
    ["tytul-linie","Tytuł między liniami","tytul srodek linie ozdobny"],
    ["numer-rozdzialu","Numer rozdziału","rozdzial numer ksiazka"],
    ["rozdzial-kreska","Rozdział z kreską","rozdzial kreska minimalistyczny"],
    ["inicjal","Inicjał z akapitem","inicjal duza litera akapit ksiazka"],
    ["cytat-autor","Cytat z autorem","cytat motto autor"],
    ["pieczatka-okragla","Pieczątka okrągła","pieczatka stempel okragly"],
    ["pieczatka-prostokatna","Pieczątka prostokątna","pieczatka stempel zatwierdzono"],
    ["wstega-tekst","Wstęga z napisem","wstega banner szarfa napis"],
    ["tytul-pasek","Tytuł na pasku koloru","tytul pasek tlo kolor"],
    ["tytul-falka","Tytuł z falką","tytul podkreslenie fala"],
    ["naglowek-numer","Nagłówek z numerem","naglowek numer kolko sekcja"],
    ["tytul-odreczny","Tytuł odręczny","tytul pismo odreczne kaligrafia elegancki"],
    ["tytul-dwa-kroje","Tytuł z dwóch krojów","tytul kontrast dwa kroje"],
    ["etykieta-nad-tytulem","Etykieta nad tytułem","etykieta nowosc znaczek tytul"],
    ["tytul-narozniki","Tytuł w narożnikach","tytul ramka narozniki"],
    ["zywa-pagina","Nagłówek strony","zywa pagina naglowek strony gora"],
    ["tytul-data","Tytuł z datą","data dzien dziennik kalendarz tytul"],
  ]],
  ["teksty", "Teksty", [
    ["luk","Napis po łuku","tekst napis Napis po łuku luk okrag fala wygiecie"],
    ["pieczec","Pieczęć – napis w okręgu","tekst napis Pieczęć – w okręgu luk okrag fala wygiecie"],
    ["usmiech","Łuk w dół","tekst napis Łuk w dół luk okrag fala wygiecie"],
    ["fala","Falisty baner","tekst napis Falisty baner luk okrag fala wygiecie"],
    ["flaga","Flaga","tekst napis Flaga luk okrag fala wygiecie"],
    ["wypukly","Wypukły tytuł","tekst napis Wypukły tytuł luk okrag fala wygiecie"],
    ["zwezenie","Zwężający się napis","tekst napis Zwężający się luk okrag fala wygiecie"],
  ]],
  ["bloki", "Bloki treści", [
    ["blok-uwaga","Uwaga","uwaga ostrzezenie ramka"],
    ["blok-wskazowka","Wskazówka","wskazowka porada pomysl"],
    ["blok-ciekawostka","Ciekawostka","ciekawostka czy wiesz"],
    ["blok-wazne","Ważne","wazne istotne zapamietaj"],
    ["blok-cytat","Cytat wyróżniony","cytat wyrozniony pull quote"],
    ["blok-werset","Werset","werset cytat biblia slowo boze pismo"],
    ["blok-lista-ikony","Lista z ikonami","lista punkty ikony ptaszki"],
    ["blok-lista-numery","Lista numerowana","lista numery kroki kolejnosc"],
    ["blok-kolumna-boczna","Kolumna boczna","kolumna boczna ramka marginesowa sidebar"],
    ["blok-stopka-redakcyjna","Stopka redakcyjna","stopka redakcyjna wydawca isbn prawa autorskie"],
    ["blok-o-autorze","Notka o autorze","autor notka biografia zdjecie"],
    ["blok-kontakt","Kontakt","kontakt telefon email adres strona"],
    ["blok-pytanie","Pytanie i odpowiedź","pytanie odpowiedz faq wywiad"],
    ["blok-zapamietaj","Do zapamiętania","zapamietaj notatka ramka przerywana"],
  ]],
  ["uklady", "Układy stron", [
    ["uklad-tytulowa","Strona tytułowa","strona tytulowa okladka ksiazka autor"],
    ["uklad-rozdzial","Początek rozdziału","rozdzial poczatek strona ksiazka"],
    ["uklad-galeria","Galeria 2 × 2","galeria zdjecia album kolaz strona"],
    ["uklad-cytat","Strona z cytatem","cytat strona motto werset"],
    ["uklad-notatki","Strona na notatki","notatki linie strona dziennik"],
    ["uklad-dyplom","Dyplom","dyplom podziekowanie certyfikat nagroda"],
    ["uklad-plakat","Ogłoszenie","plakat ogloszenie wydarzenie zaproszenie"],
    ["uklad-dzien","Strona dnia","dziennik strona dnia data werset notatki"],
  ]],
  ["ksiazka", "Książka", [
    ["spis","Spis treści","spis tresci rozdzialy naglowki strony ksiazka"],
    ["skorowidz","Skorowidz","skorowidz indeks hasla slowa ksiazka"],
  ]],
  ["kody", "Kody", [
    ["qr","Kod QR","kod qr adres strona link wifi telefon e-mail"],
    ["ean","Kod kreskowy EAN / ISBN","kod kreskowy ean isbn ksiazka okladka"],
  ]],
];
// KATALOG-BIBLIOTEKI:KONIEC

const tekst = (opis) => ({ type: 'string', description: opis });
const obiekt = (opis) => ({ type: 'object', description: opis, additionalProperties: true });
const GDZIE = tekst('„strona:<id strony>” albo „wzorzec:<id wzorca>”.');

const INSTRUKCJE_PELNE = 'Narzędzia czytają i zmieniają projekty Makietki (edytor kalendarzy i publikacji z danymi) na koncie właściciela klucza – równolegle z nim, gdy ma projekt otwarty w edytorze. Zacznij od narzędzia projekty: lista projektów, do których prowadzi klucz (i czy możesz tworzyć oraz usuwać projekty). W każdym narzędziu projektu podaj projekt (id albo nazwa z listy); gdy klucz obejmuje jeden projekt, można go pominąć. Potem przeglad_projektu. Wymiary są w milimetrach (rozmiar pisma też: pt × 25,4 / 72). Zmieniaj możliwie małymi krokami (zmien_elementy, zmien_tabele, zmien_czesc; usuwanie: usun_z_tabeli, usun_czesc); element z Biblioteki zmieniasz potem przez zmien_elementy; zmien_projekt tylko dla zmian, których inne narzędzia nie obejmują. Przed większymi zmianami przeczytaj opis_formatu. Strony powtarzane robi się serią z tabeli, nie kopiami stron. Uwagi osób do stron czytasz narzędziem komentarze; odpowiadasz przez odpowiedz (rozwiaz=true, gdy poprawka jest już w projekcie), nowe uwagi dodaje skomentuj. Obraz z opisu rysuje generuj_obraz, kadry komiksu rysuj_kadry, dymki ustaw_dymki (robi to otwarta aplikacja kluczem Gemini użytkownika; kosztuje – mów użytkownikowi, co rysujesz). Gotowe elementy (ramki, ikony, kalendarze, wykresy, ozdobniki…): biblioteka i wstaw_z_biblioteki. Link do podglądu: udostepnij_link – tylko po wyraźnej zgodzie użytkownika (zaproponuj hasło albo datę ważności). Projekt usuwaj (usun_projekt) tylko po pytaniu wprost. Zmiany AI cofa cofnij_zmiany_ai: najpierw sprawdz=true, powiedz użytkownikowi, co się cofnie, i cofaj tylko na jego wyraźną prośbę. Gotowy plik: eksport_pdf (cały projekt, sekcja albo strony, do drukarni albo na ekran) i eksport_png (jedna strona) zwracają link do pobrania – plik robi otwarta aplikacja Makietki; gdy nie jest otwarta, daj użytkownikowi link do aplikacji z odpowiedzi i sprawdź stan_eksportu. Obrazy: wgraj_obraz (adres https, kod SVG, base64) dodaje plik do projektu (obraz z sieci – podaj źródło i pilnuj praw autorskich); użyty obraz wymienia na nowy plik podmien_obraz (strony od razu pokazują nowy), wstaw_obraz stawia go na stronie jako pojedynczy element, obrazy_projektu je wymienia. Pliki, które masz w swoim środowisku (miejsce robocze, załącznik w piaskownicy), wgrywasz sam przez wgraj_czesciami – kawałkami base64 przez łącznik, bez żadnego dostępu sieci (ZIP rozpakuj u siebie). To dobra droga dla grafik do kilkuset KB; jakości plików nie obniżaj bez zgody użytkownika. adres_do_wysylki podaje adres z kluczem – nie pokazuj go. Duże zdjęcia albo pliki, do których nie sięgasz: wywołaj link_do_wgrywania i daj użytkownikowi link – wrzuci je sam, potem sprawdź obrazy_projektu i działaj dalej. Nigdy nie odpowiadaj, że się nie da albo że nie masz dostępu do jego plików. Nie łącz się z bazą z własnej piaskownicy – używaj narzędzi łącznika Makietka i nie proś użytkownika o odblokowanie domen ani zmianę ustawień sieci.';
// Łącznik z katalogu Claude (adres /mcp z logowaniem) – bez rysowania obrazów modelem AI (zasady katalogu, #408);
// pełny łącznik: /mcp/full albo adres z kluczem.
export const RYSUJACE = new Set(['generuj_obraz', 'rysuj_kadry']);
const INSTRUKCJE_BEZ_RYSOWANIA = INSTRUKCJE_PELNE.replace('Obraz z opisu rysuje generuj_obraz, kadry komiksu rysuj_kadry, dymki ustaw_dymki (robi to otwarta aplikacja kluczem Gemini użytkownika; kosztuje – mów użytkownikowi, co rysujesz). ', 'Dymki komiksu ustawia ustaw_dymki. ');

// ---------- Łącznik po angielsku (#410) ----------
// Łącznik MCP (Claude, ChatGPT, katalog łączników) pokazuje narzędzia, parametry, opisy i wartości po angielsku; w środku
// narzędzia działają na polskich nazwach (asystent AI w aplikacji dalej je widzi). Wywołanie przyjmuje obie wersje nazw.
export const NAZWY_EN = {
  projekty: 'list_projects', nowy_projekt: 'create_project', kopiuj_projekt: 'copy_project', usun_projekt: 'delete_project',
  przeglad_projektu: 'get_project_overview', czytaj: 'read_part', zmien_elementy: 'update_elements', dodaj_elementy: 'add_elements',
  obrazy_projektu: 'list_images', wgraj_obraz: 'upload_image', link_do_wgrywania: 'get_upload_link', wstaw_obraz: 'place_image',
  zmien_nazwe_obrazu: 'rename_image', podmien_obraz: 'replace_image', wgraj_czesciami: 'upload_image_chunks', adres_do_wysylki: 'get_upload_url',
  usun_obrazy: 'delete_images', uporzadkuj_obrazy: 'tidy_images', usun_elementy: 'delete_elements', wyrownaj_elementy: 'align_elements',
  rozmiesc_elementy: 'distribute_elements', kolejnosc_elementow: 'reorder_elements', dodaj_strone: 'add_page', kopiuj_strone: 'duplicate_page',
  zmien_strone: 'update_page', usun_strony: 'delete_pages', kolejnosc_stron: 'reorder_pages', zmien_tabele: 'update_table',
  usun_z_tabeli: 'delete_table_data', zmien_czesc: 'update_part', usun_czesc: 'delete_part', zmien_projekt: 'update_project',
  nazwa_projektu: 'rename_project', kontrola: 'check_project', komentarze: 'list_comments', skomentuj: 'add_comment',
  odpowiedz: 'reply_to_comment', rozwiaz_komentarz: 'resolve_comment', eksport_pdf: 'export_pdf', eksport_png: 'export_png',
  stan_eksportu: 'get_job_status', udostepnij_link: 'share_preview_link', generuj_obraz: 'generate_image', rysuj_kadry: 'draw_comic_panels',
  ustaw_dymki: 'place_speech_bubbles', biblioteka: 'search_library', wstaw_z_biblioteki: 'insert_library_element',
  cofnij_zmiany_ai: 'undo_ai_changes', czcionki: 'list_fonts', opis_formatu: 'get_format_spec',
};
const PARAMETRY_EN = {
  nazwa: 'name', szerokosc: 'width', wysokosc: 'height', orientacja: 'orientation', uklad: 'layout', spad: 'bleed', marginesy: 'margins',
  projekt: 'project', potwierdz: 'confirm', co: 'part', gdzie: 'target', zmiany: 'changes', pola: 'fields', elementy: 'elements',
  przed: 'before', adres: 'url', dane_base64: 'data_base64', zastap: 'replace', wstaw: 'place', obraz: 'image', dopasowanie: 'fit',
  krok: 'step', rozmiar: 'size', kawalek: 'chunk_size', szer: 'width_px', wys: 'height_px', wgranie: 'upload_id', nr: 'index',
  obrazy: 'images', nieuzywane: 'unused', do: 'align', wzgledem: 'relative_to', kierunek: 'direction', odstep_mm: 'gap_mm',
  strona: 'page', po: 'after', ile: 'count', kolumny: 'columns', ustaw: 'set', wiersz: 'row', kolumna: 'column', wartosc: 'value',
  dodaj_wiersze: 'add_rows', listy: 'value_lists', usun_wiersze: 'delete_rows', usun_kolumny: 'delete_columns', wiersze: 'rows',
  czesc: 'part', wszystkie: 'include_resolved', tresc: 'text', komentarz: 'comment', rozwiaz: 'resolve', rozwiazany: 'resolved',
  zakres: 'scope', sekcja: 'section', sekcje: 'sections', strony: 'pages', od: 'from', przeznaczenie: 'purpose', rodzaj: 'kind',
  format_arkusza: 'sheet_format', skladka: 'signature_pages', czekaj: 'wait', egzemplarz: 'copy', zlecenie: 'job',
  zgoda_uzytkownika: 'user_consent', haslo: 'password', wazny_do: 'expires_on', opis: 'prompt', jakosc: 'quality',
  proporcja: 'aspect_ratio', popraw: 'edit', kadry: 'panels', szukaj: 'search', kategoria: 'category', sprawdz: 'check_only',
};
const PARAMETRY_NARZEDZI_EN = { 'eksport_pdf.do': 'to' };
const WARTOSCI_EN = {
  Kwadrat: 'Square', wlasny: 'custom', pion: 'portrait', poziom: 'landscape', pojedyncze: 'single', rozkladowki: 'spreads',
  strona: 'page', wzorzec: 'master', sekcja: 'section', styl: 'style', tabela: 'table', seria: 'series', widok: 'view', projekt: 'project',
  zmiesc: 'contain', wypelnij: 'cover', czesc: 'part', koniec: 'finish', lewo: 'left', srodek: 'center', prawo: 'right', gora: 'top',
  srodek_pionowo: 'middle', dol: 'bottom', elementy: 'elements', poziomo: 'horizontal', pionowo: 'vertical', sekcje: 'sections',
  wzorce: 'masters', style: 'styles', tabele: 'tables', serie: 'series', wszystko: 'all', strony: 'pages', drukarnia: 'print',
  ekran: 'screen', wektor: 'vector', obraz: 'image', zwykly: 'normal', broszura: 'booklet', skladki: 'signatures', dwie: 'two_up',
  cztery: 'four_up', szkic: 'draft', dokladny: 'fine',
};
// <TEKSTY_EN>
const TEKSTY_EN = {
 "Projekty": "Projects",
 "Lista projektów, do których prowadzi klucz: id, nazwa, właściciel (Twoje albo udostępnione przez kogoś), czy możesz je zmieniać, ostatnia zmiana. Zacznij od tego – id albo nazwę podajesz potem jako „projekt” w innych narzędziach.": "Lists the projects the key gives access to: id, name, owner (yours or shared by someone), whether you can change them, last change. The id or name is then passed as “project” to the other tools.",
 "Nowy projekt": "New project",
 "Tworzy nowy, pusty projekt na koncie – jak „Nowy projekt” w aplikacji: jedna sekcja z formatem, marginesami i spadem, jedna pusta strona, standardowe style tekstu. Tylko klucz z pełnym dostępem, który czyta i zmienia. Projekt pojawia się od razu na liście projektów właściciela. Dalej pracuj na nim, podając projekt (id z wyniku).": "Creates a new, empty project in the account – like “New project” in the app: one section with a format, margins and bleed, one blank page, standard text styles. Only with a full-access key that reads and changes. The project appears in the owner’s project list right away. The result contains its id.",
 "Nazwa projektu": "Project name",
 "Format strony (domyślnie A5); „wlasny” – podaj szerokosc i wysokosc w mm.": "Page format (default A5); “custom” – give width and height in mm.",
 "mm – tylko dla formatu „wlasny”": "mm – only for the “custom” format",
 "Pojedyncze strony albo rozkładówki (marginesy lustrzane).": "Single pages or spreads (mirrored margins).",
 "Spad w mm (domyślnie 3)": "Bleed in mm (default 3)",
 "Marginesy w mm (domyślnie 10)": "Margins in mm (default 10)",
 "Kopiuj projekt": "Copy project",
 "Tworzy kopię całego projektu na koncie – jak „Duplikuj” w aplikacji: wszystkie strony, sekcje, wzorce, style, tabele i obrazy. Tylko klucz z pełnym dostępem, który czyta i zmienia, i tylko własny projekt konta. nazwa – opcjonalnie (domyślnie „<nazwa> (kopia)”). Kopia pojawia się od razu na liście projektów; obrazy z folderu konta kopia dostaje na własność przy pierwszym otwarciu w aplikacji. Dalej pracuj na kopii, podając projekt (id z wyniku).": "Copies the whole project in the account – like “Duplicate” in the app: all pages, sections, masters, styles, tables and images. Only with a full-access key that reads and changes, and only the account’s own project. name – optional (default “<name> (copy)”). The copy appears in the project list right away; it takes ownership of the account’s image files when first opened in the app. The result contains its id.",
 "id albo nazwa projektu do skopiowania": "id or name of the project to copy",
 "Nazwa kopii (opcjonalnie)": "Name of the copy (optional)",
 "Usuń projekt": "Delete project",
 "Usuwa cały projekt z konta – nieodwracalnie. Tylko klucz z pełnym dostępem i tylko projekt właściciela klucza (nie udostępniony przez kogoś). Wymaga potwierdzenia: „potwierdz” to dokładna nazwa projektu.": "Deletes the whole project from the account – permanently. Only with a full-access key and only a project owned by the key’s owner (not one shared by someone). Requires confirmation: “confirm” is the exact project name.",
 "id albo nazwa projektu": "project id or name",
 "Dokładna nazwa projektu – potwierdzenie": "Exact project name – confirmation",
 "Przegląd projektu": "Project overview",
 "Krótki opis projektu: sekcje, strony z elementami (id, rodzaj, początek tekstu), wzorce, style, tabele, serie, obrazy. Zacznij od tego – stąd są identyfikatory do pozostałych narzędzi.": "Short description of the project: sections, pages with elements (id, kind, start of text), masters, styles, tables, series, images. Contains the identifiers used by the other tools.",
 "id albo nazwa projektu; można pominąć, gdy klucz obejmuje jeden projekt.": "project id or name; can be omitted when the key covers one project.",
 "Czytaj część projektu": "Read project part",
 "Pełny JSON jednej części projektu: strony, wzorca, sekcji, stylu, tabeli albo serii (po id), albo całego projektu (co=\"projekt\"; może być duży).": "Full JSON of one project part: a page, master, section, style, table or series (by id), or the whole project (part=\"project\"; can be large).",
 "Identyfikator (nie dotyczy „widok” i „projekt”).": "Identifier (not for “view” and “project”).",
 "Zmień elementy": "Update elements",
 "Zmienia pola elementów (po id) na stronie albo we wzorcu – np. tekst, kolor (fill), położenie (left, top w mm), rozmiar pisma (fontSize w mm), z_danych, pole, ksztalt_tekstu (tekst po łuku, okręgu, ścieżce albo wygięty), link (adres klikalny w PDF do czytania na ekranie). Podawaj tylko zmieniane pola; null usuwa pole.": "Changes element fields (by id) on a page or master – e.g. text, colour (fill), position (left, top in mm), font size (fontSize in mm), z_danych, pole, ksztalt_tekstu (text along an arc, circle, path or warped), link (clickable address in a PDF for screen reading). Give only the changed fields; null removes a field.",
 "„strona:<id strony>” albo „wzorzec:<id wzorca>”.": "“page:<page id>” or “master:<master id>”.",
 "id elementu": "element id",
 "Pola do zmiany": "Fields to change",
 "Dodaj elementy": "Add elements",
 "Dodaje elementy (JSON elementów jak w opisie formatu: textbox, rect, ellipse, line, path, polygon, image z istniejącym zasobem, group/tabela, kod – kod QR albo EAN-13/ISBN: { type: \"kod\", rodzaj: \"qr\"|\"ean\", tresc, szerokosc, left, top }; skrótem także kalendarz miesiąca { type: \"kalendarz\", left, top, width, kalendarz: { rok, miesiac, pole_daty } }, wykres { type: \"wykres\", left, top, wykres: { rodzaj, tabela, etykiety, wartosci } } kolaż { type: \"kolaz\", left, top, kolaz: { uklad, odstep, szerokosc, wysokosc } }, dymek { type: \"dymek\", tekst, left, top, ogonek: { x, y } (punkt na stronie, w który celuje), rodzaj: \"mowa\"|\"mysl\"|\"krzyk\"|\"szept\"|\"narracja\" } – dymek rośnie z tekstem, spis treści { type: \"spis\", left, top, width, poziomy } i skorowidz { type: \"skorowidz\", left, top, width }) na stronę albo do wzorca. Bez id – nadam. Nowe elementy trafiają na wierzch, chyba że podasz „przed” (id elementu).": "Adds elements (element JSON as in the format description: textbox, rect, ellipse, line, path, polygon, image with an existing asset, group/table, kod – QR code or EAN-13/ISBN: { type: \"kod\", rodzaj: \"qr\"|\"ean\", tresc, szerokosc, left, top }; shortcuts also for a month calendar { type: \"kalendarz\", left, top, width, kalendarz: { rok, miesiac, pole_daty } }, chart { type: \"wykres\", left, top, wykres: { rodzaj, tabela, etykiety, wartosci } }, collage { type: \"kolaz\", left, top, kolaz: { uklad, odstep, szerokosc, wysokosc } }, speech bubble { type: \"dymek\", tekst, left, top, ogonek: { x, y } (the point on the page it aims at), rodzaj: \"mowa\"|\"mysl\"|\"krzyk\"|\"szept\"|\"narracja\" } – the bubble grows with the text, table of contents { type: \"spis\", left, top, width, poziomy } and index { type: \"skorowidz\", left, top, width }) to a page or master. Without an id – one is assigned. New elements go on top unless “before” (element id) is given.",
 "id elementu, przed którym wstawić (niżej w warstwach)": "id of the element to insert before (lower in the layers)",
 "Obrazy projektu": "Project images",
 "Lista obrazów projektu (to samo co okno „Obrazy projektu” w aplikacji): id, nazwa z rozszerzeniem, wymiary w pikselach i gdzie obraz jest użyty (strony, wzorce, dane w tabelach, albo „nieużywany”), do tego powtórzenia (kopie tego samego pliku, powtórzone nazwy). Nazwy wpisuje się w kolumny tabel danych.": "Lists the project’s images (the same as the “Project images” window in the app): id, name with extension, size in pixels and where the image is used (pages, masters, data in tables, or “unused”), plus duplicates (copies of the same file, repeated names). Names are what goes into data table columns.",
 "Wgraj obrazy do projektu": "Upload images to project",
 "Wgrywa obraz albo archiwum ZIP z obrazami do projektu (trafiają do okna „Obrazy projektu” u właściciela, na żywo). Podaj dokładnie jedno źródło:\n- adres – plik w internecie (https). Działa też link udostępniania z Dysku Google („każdy, kto ma link”, pojedynczy plik albo ZIP) i z Dropboxa (plik albo folder – Dropbox odda folder jako ZIP).\n- svg – rysunek, który sam piszesz (ozdobniki, ikony, ramki); potrzebny viewBox albo width/height; bez skryptów.\n- dane_base64 – tylko małe pliki (do ok. 200 kB); większe są za drogie do przepisania.\nObsługiwane: PNG, JPEG, WebP, GIF, SVG; obraz do 25 MB, pobierany plik do 50 MB, ZIP do 100 obrazów. Ten sam plik drugi raz nie wchodzi (wynik wskaże obraz, który już jest); zajęta nazwa dostaje dopisek „(2)”. zastap (id albo nazwa) – podmienia ten obraz projektu na nowy plik. wstaw – od razu wstawia obraz jako pojedynczy element (tylko dla jednego obrazu).": "Uploads an image or a ZIP archive of images to the project (they appear in the owner’s “Project images” window, live). Give exactly one source:\n- url – a file on the internet (https). A Google Drive share link (“anyone with the link”, a single file or ZIP) and Dropbox (file or folder – Dropbox returns a folder as ZIP) also work.\n- svg – a drawing you write yourself (ornaments, icons, frames); needs viewBox or width/height; no scripts.\n- data_base64 – only small files (up to about 200 kB); larger ones are too expensive to transcribe.\nSupported: PNG, JPEG, WebP, GIF, SVG; image up to 25 MB, downloaded file up to 50 MB, ZIP up to 100 images. The same file isn’t added twice (the result points to the existing image); a taken name gets the suffix “(2)”. replace (id or name) – replaces that project image with the new file. place – places the image right away as a single element (only for one image).",
 "Nazwa pliku z rozszerzeniem, np. „choinka.svg” (domyślnie z adresu albo pliku).": "File name with extension, e.g. “tree.svg” (default from the url or file).",
 "Adres https pliku (obraz albo ZIP), także link z Dysku Google albo Dropboxa.": "https address of the file (image or ZIP), also a Google Drive or Dropbox link.",
 "Kod rysunku SVG.": "SVG drawing code.",
 "Treść małego pliku w base64 (z nagłówkiem data: albo bez).": "Content of a small file in base64 (with or without a data: header).",
 "id albo nazwa obrazu, który ten plik zastępuje.": "id or name of the image this file replaces.",
 "Opcjonalnie: { gdzie (id strony albo wzorca), x?, y?, szerokosc?, wysokosc? (mm), dopasowanie? (zmiesc | wypelnij) }.": "Optional: { target (page or master id), x?, y?, width?, height? (mm), fit? (contain | cover) }.",
 "Link do wgrania obrazów": "Image upload link",
 "Link do aplikacji, który otwiera ten projekt od razu z oknem „Obrazy projektu”. Użytkownik wgrywa tam przyciskiem „Wgraj obrazy…” zdjęcia, które ma u siebie (z komputera, z telefonu, z załącznika rozmowy, archiwum ZIP, dowolnej wielkości); trafiają do obrazów projektu. Link wymaga zalogowania na konto właściciela.": "A link to the app that opens this project with the “Project images” window. There the user uploads photos they have (from a computer, phone, chat attachment, ZIP archive, any size) with the “Upload images…” button; they go to the project images. The link requires signing in to the owner’s account.",
 "Wstaw obraz na stronę": "Place image on page",
 "Wstawia obraz z projektu (id albo nazwa obrazu) jako pojedynczy element na stronę albo do wzorca – jak „Obraz → Wybierz z obrazów projektu” w aplikacji. Wymiary w mm. Bez rozmiaru: 60% strony, na środku. Sama szerokosc albo sama wysokosc: proporcje obrazu zachowane. szerokosc i wysokosc razem to ramka: dopasowanie „zmiesc” (cały obraz w ramce, domyślnie) albo „wypelnij” (wypełnia ramkę, brzegi przycięte wokół środka). x, y – lewy górny róg (ramki); bez nich – na środku strony.": "Places a project image (id or image name) as a single element on a page or master – like “Image → Choose from project images” in the app. Sizes in mm. Without a size: 60% of the page, centred. Only width or only height: the image proportions are kept. width and height together make a frame: fit “contain” (whole image in the frame, default) or “cover” (fills the frame, edges cropped around the centre). x, y – top-left corner (of the frame); without them – centred on the page.",
 "id albo nazwa obrazu projektu": "id or name of a project image",
 "mm od lewej krawędzi strony": "mm from the left edge of the page",
 "mm od górnej krawędzi strony": "mm from the top edge of the page",
 "mm": "mm",
 "Zmień nazwę obrazu": "Rename image",
 "Zmienia nazwę obrazu projektu – jak w oknie „Obrazy projektu”. Nazwa musi być wolna (wielkość liter bez znaczenia); bez rozszerzenia dostaje dotychczasowe. Elementy na stronach dalej pokazują ten obraz, a komórki tabel danych, które wskazywały go starą nazwą, dostają nową.": "Renames a project image – as in the “Project images” window. The name must be free (case-insensitive); without an extension it keeps the current one. Elements on pages keep showing this image, and data table cells that pointed to it by the old name get the new one.",
 "id albo nazwa obrazu": "image id or name",
 "Nowa nazwa, np. „styczen.jpg”": "New name, e.g. “january.jpg”",
 "Podmień plik obrazu": "Replace image file",
 "Podmienia plik obrazu projektu na nowy – jak „Podmień plik” w oknie „Obrazy projektu”: elementy na stronach i dane w tabelach pokazują od teraz nowy plik, nazwa zostaje, stary plik znika. Źródło: adres (https), svg albo dane_base64; jeden obraz.": "Replaces a project image file with a new one – like “Replace file” in the “Project images” window: elements on pages and data in tables show the new file from now on, the name stays, the old file is removed. Source: url (https), svg or data_base64; one image.",
 "id albo nazwa obrazu, który podmieniasz": "id or name of the image you are replacing",
 "Adres https nowego pliku (także Dysk Google, Dropbox).": "https address of the new file (also Google Drive, Dropbox).",
 "Treść małego pliku w base64.": "Content of a small file in base64.",
 "Wgraj plik kawałkami (base64)": "Upload file in chunks (base64)",
 "Wgrywa obraz, który masz u siebie (plik w miejscu roboczym, załącznik w piaskownicy), gdy nie możesz go podać inaczej: nie ma adresu w internecie, a Twoje środowisko nie łączy się z bazą. Plik idzie w kawałkach base64 w kolejnych wywołaniach tego narzędzia, a łącznik składa je po swojej stronie. Każdy bajt przechodzi przez rozmowę, więc to droga dla grafik do kilkuset KB.\nKroki:\n1. krok=\"start\": nazwa (z rozszerzeniem), rozmiar (bajty), sha256 (skrót SHA-256 treści, 64 znaki hex), kawalek (bajty, od 16384 do 524288; zalecane 49152), opcjonalnie szer, wys (px), zastap (id albo nazwa obrazu do podmiany – strony pokazują od razu nowy plik). Wynik: id wgrania i liczba kawałków. Ten sam plik już w projekcie – wynik od razu to powie.\n2. krok=\"czesc\": wgranie, nr (od 0), dane_base64 – bajty od nr×kawalek, długości kawalek (ostatni krótszy). Kolejność dowolna, powtórzenie zastępuje.\n3. krok=\"koniec\": wgranie – sprawdzam komplet i rozmiar; obraz trafia do obrazów projektu. Brakujące kawałki wymienię.\nZIP rozpakuj u siebie i wgraj obrazy po kolei. Wgranie niedokończone przez dobę znika.": "Uploads an image you have locally (a file in your workspace, a sandbox attachment) when it can’t be provided otherwise: it has no internet address and your environment can’t connect to the database. The file goes in base64 chunks in consecutive calls of this tool, and the connector assembles it on its side. Every byte passes through the conversation, so this is a way for graphics up to a few hundred KB.\nSteps:\n1. step=\"start\": name (with extension), size (bytes), sha256 (SHA-256 of the content, 64 hex characters), chunk_size (bytes, 16384 to 524288; recommended 49152), optionally width_px, height_px, replace (id or name of the image to replace – pages show the new file right away). Result: upload id and number of chunks. If the same file is already in the project, the result says so right away.\n2. step=\"part\": upload_id, index (from 0), data_base64 – the bytes from index×chunk_size, of length chunk_size (the last one shorter). Any order; a repeat replaces.\n3. step=\"finish\": upload_id – checks completeness and size; the image goes to the project images. Missing chunks are listed.\nUnpack a ZIP locally and upload the images one by one. An upload not finished within a day is removed.",
 "start: nazwa pliku z rozszerzeniem (png, jpg, webp, gif, svg).": "start: file name with extension (png, jpg, webp, gif, svg).",
 "start: rozmiar pliku w bajtach": "start: file size in bytes",
 "start: SHA-256 treści pliku, 64 znaki szesnastkowe.": "start: SHA-256 of the file content, 64 hexadecimal characters.",
 "start: wielkość kawałka w bajtach (16384–524288, domyślnie 49152)": "start: chunk size in bytes (16384–524288, default 49152)",
 "start: szerokość w px (opcjonalnie)": "start: width in px (optional)",
 "start: wysokość w px (opcjonalnie)": "start: height in px (optional)",
 "start: id albo nazwa obrazu, który ten plik zastępuje (opcjonalnie).": "start: id or name of the image this file replaces (optional).",
 "czesc, koniec: id wgrania z kroku start.": "part, finish: upload id from the start step.",
 "czesc: numer kawałka od 0": "part: chunk number from 0",
 "czesc: kawałek pliku w base64.": "part: file chunk in base64.",
 "Adres do wysyłki plików": "File upload address",
 "Adres, pod który wysyłasz plik obrazu albo ZIP wprost z własnego środowiska (wykonywanie kodu, miejsce robocze z plikami): POST z treścią pliku na <adres>?nazwa=plik.jpg (opcjonalnie &zastap=<id albo nazwa> – podmiana użytego obrazu). Dowolna wielkość do limitów (obraz 25 MB, plik 50 MB), plik nie przechodzi przez rozmowę. Działa tylko, gdy środowisko łączy się z hostem adresu (np. własny skrypt użytkownika). Adres zawiera klucz dostępu.": "An address to send an image file or ZIP to directly from your own environment (code execution, a workspace with files): POST with the file content to <address>?nazwa=file.jpg (optionally &zastap=<id or name> – replaces a used image). Any size up to the limits (image 25 MB, file 50 MB), the file doesn’t pass through the conversation. Works only when the environment can connect to the address host (e.g. the user’s own script). The address contains an access key.",
 "Usuń obrazy z projektu": "Delete images from project",
 "Usuwa obrazy z projektu (id albo nazwy) – jak „Usuń” w oknie „Obrazy projektu”. Usuwa tylko obrazy nieużywane: obraz, który jest na stronie, we wzorcu albo w danych tabeli, zostaje, a wynik mówi, gdzie jest użyty. nieuzywane: true – usuwa wszystkie nieużywane obrazy. Plik znika też z konta właściciela.": "Deletes images from the project (ids or names) – like “Delete” in the “Project images” window. Only unused images are deleted: an image that is on a page, in a master or in table data stays, and the result says where it is used. unused: true – deletes all unused images. The file is also removed from the owner’s account.",
 "id albo nazwy obrazów": "image ids or names",
 "Uporządkuj obrazy": "Tidy up images",
 "Porządkuje obrazy projektu jak „Uporządkuj” w oknie „Obrazy projektu”: kopie tego samego pliku stają się jednym obrazem (elementy zostają na miejscu, komórki tabel dostają nazwę obrazu, który zostaje), a obrazy o tej samej nazwie i innej treści dostają dopisek „(2)” (dane pokazują ten sam obraz co dotąd).": "Tidies up the project images like “Tidy up” in the “Project images” window: copies of the same file become one image (elements stay in place, table cells get the name of the image that stays), and images with the same name and different content get the suffix “(2)” (data shows the same image as before).",
 "Usuń elementy": "Delete elements",
 "Usuwa elementy (po id) ze strony albo ze wzorca.": "Deletes elements (by id) from a page or master.",
 "Wyrównaj elementy": "Align elements",
 "Wyrównuje elementy (po id) na stronie albo we wzorcu – jak przyciski wyrównania w edytorze. do: lewo | srodek | prawo | gora | srodek_pionowo | dol. wzgledem: elementy (do skrajnego z zaznaczonych, domyślnie; przy jednym elemencie – do strony) albo strona. Liczy prostokąt elementu bez obrotu.": "Aligns elements (by id) on a page or master – like the align buttons in the editor. align: left | center | right | top | middle | bottom. relative_to: elements (to the outermost of the selected ones, default; with one element – to the page) or page. Uses the element’s rectangle without rotation.",
 "Rozmieść elementy równo": "Distribute elements evenly",
 "Rozmieszcza co najmniej 3 elementy (po id) z równymi odstępami – poziomo albo pionowo; skrajne zostają na miejscu (jak „Rozmieść” w edytorze). odstep_mm – zamiast tego stały odstęp od pierwszego elementu.": "Distributes at least 3 elements (by id) with equal gaps – horizontally or vertically; the outermost ones stay in place (like “Distribute” in the editor). gap_mm – a fixed gap from the first element instead.",
 "Kolejność elementów": "Element order",
 "Ustawia kolejność warstw elementów na stronie albo we wzorcu: lista id od spodu do wierzchu (wszystkie elementy).": "Sets the layer order of elements on a page or master: a list of ids from bottom to top (all elements).",
 "Dodaj stronę": "Add page",
 "Dodaje stronę: { nazwa, sekcja (id), wzorce (\"z_sekcji\" albo lista id), seria?, tlo?, obiekty? }. Domyślnie na końcu swojej sekcji; „po” – id strony, za którą wstawić.": "Adds a page: { nazwa, sekcja (id), wzorce (\"z_sekcji\" or a list of ids), seria?, tlo?, obiekty? }. By default at the end of its section; “after” – id of the page to insert after.",
 "Strona": "Page",
 "id strony, za którą wstawić": "id of the page to insert after",
 "Kopiuj stronę": "Duplicate page",
 "Kopiuje stronę razem z elementami (nowe id strony i elementów) – ile kopii (1–50), domyślnie za kopiowaną stroną; „po” – id strony, za którą wstawić. Strony powtarzane z danymi lepiej robić serią z tabeli.": "Copies a page with its elements (new page and element ids) – count copies (1–50), by default after the copied page; “after” – id of the page to insert after. Pages repeated with data are better done as a series from a table.",
 "id strony do skopiowania": "id of the page to copy",
 "Zmień stronę": "Update page",
 "Zmienia ustawienia strony (nie elementy): nazwa, sekcja, wzorce (\"z_sekcji\" albo lista id), seria (id albo null), tlo, prowadnice. null usuwa pole.": "Changes page settings (not elements): nazwa, sekcja, wzorce (\"z_sekcji\" or a list of ids), seria (id or null), tlo, prowadnice. null removes a field.",
 "id strony": "page id",
 "Usuń strony": "Delete pages",
 "Usuwa strony (po id).": "Deletes pages (by id).",
 "Kolejność stron": "Page order",
 "Nowa kolejność stron: wszystkie id stron. (Aplikacja i tak trzyma strony pogrupowane według kolejności sekcji.)": "New page order: all page ids. (The app keeps pages grouped by section order anyway.)",
 "Zmień tabelę danych": "Update data table",
 "Zmienia albo tworzy tabelę danych (po id; nowa, jeśli nie ma – wtedy podaj nazwa i kolumny) – bez usuwania danych: nazwa, kolumny (pełna lista; mogą dojść nowe i zmienić się kolejność, ale każda dotychczasowa musi zostać), ustaw komórki [{ wiersz (od 0), kolumna (nazwa), wartosc }], dodaj_wiersze (listy wartości w kolejności kolumn; wiersz „[pomiń]” w pierwszej komórce zajmuje miejsce w bloku serii, ale strona nie powstaje), listy ({ kolumna: [dozwolone wartości] }).": "Changes or creates a data table (by id; a new one if it doesn’t exist – then give name and columns) – without deleting data: name, columns (full list; new ones can be added and the order can change, but every existing one must stay), set cells [{ row (from 0), column (name), value }], add_rows (lists of values in column order; a row with “[pomiń]” in the first cell takes a place in the series block, but no page is created), value_lists ({ column: [allowed values] }).",
 "id tabeli": "table id",
 "nazwa tabeli": "table name",
 "Listy dozwolonych wartości kolumn": "Lists of allowed column values",
 "Usuń wiersze albo kolumny tabeli": "Delete table rows or columns",
 "Usuwa dane z tabeli (po id): usun_wiersze (numery od 0), usun_kolumny (nazwy – razem z wartościami), albo wiersze – zastępuje WSZYSTKIE wiersze podanymi.": "Deletes data from a table (by id): delete_rows (numbers from 0), delete_columns (names – together with their values), or rows – replaces ALL rows with the given ones.",
 "Zmień sekcję, wzorzec, styl, tabelę albo serię": "Update section, master, style, table or series",
 "Ogólna zmiana jednej części projektu po id: czesc = sekcje | wzorce | style | tabele | serie. pola – zmieniane pola (null usuwa pole); nowa część, jeśli id nie istnieje (podaj komplet pól, np. sekcja: nazwa, wydruk, uklad; okładka z grzbietem: pole okladka; seria: nazwa, tabela, tryb). Zmiana stylu przepisuje jego wartości do wszystkich tekstów z tym stylem (jak w aplikacji).": "General change of one project part by id: part = sections | masters | styles | tables | series. fields – the changed fields (null removes a field); a new part if the id doesn’t exist (give all fields, e.g. section: nazwa, wydruk, uklad; cover with spine: the okladka field; series: nazwa, tabela, tryb). Changing a style rewrites its values to all texts with that style (as in the app).",
 "id": "id",
 "Pola": "Fields",
 "Usuń sekcję, wzorzec, styl, tabelę albo serię": "Delete section, master, style, table or series",
 "Usuwa jedną część projektu po id: czesc = sekcje | wzorce | style | tabele | serie. Usunięcie stylu odpina go od tekstów (teksty zostają, jak w aplikacji). Baza odrzuci usunięcie, które zostawiłoby projekt niespójny (np. sekcję ze stronami albo tabelę używaną przez serię).": "Deletes one project part by id: part = sections | masters | styles | tables | series. Deleting a style detaches it from texts (the texts stay, as in the app). The database rejects a deletion that would leave the project inconsistent (e.g. a section with pages or a table used by a series).",
 "Zmień projekt (ogólnie)": "Update project (general)",
 "Ogólny zapis części projektu w jednym kroku, dla zmian, których nie obejmują inne narzędzia. zmiany: { nazwa?, sekcje?, wzorce?, style?, tabele?, serie? (pełne listy – zastępują dotychczasowe), widok?, strony? (pełne obiekty stron nowych albo zmienionych), usun_strony? (id stron), kolejnosc_stron? (id stron), kolory_dodatkowe? (kolory spot, np. Pantone: [{ id, nazwa, cmyk: [c, m, y, k] }]), tryb_kolorow? (pelny | szarosc | czb1), kolor_trybu?, ksiazka? (nagłówki spisu treści i liczenie przypisów: { naglowki: [{ styl, poziom }], przypisy: sekcja | strona | ciagle }) }. Kolor dodatkowy w elemencie i uszlachetnienia – pole elementu uszlachetnienie. Baza sprawdza spójność (sekcje, wzorce, serie, tabele, obrazy) i odrzuca niespójne zmiany z opisem. Nie wgrywa obrazów ani czcionek.": "General save of project parts in one step, for changes the other tools don’t cover. changes: { nazwa?, sekcje?, wzorce?, style?, tabele?, serie? (full lists – replace the current ones), widok?, strony? (full objects of new or changed pages), usun_strony? (page ids), kolejnosc_stron? (page ids), kolory_dodatkowe? (spot colours, e.g. Pantone: [{ id, nazwa, cmyk: [c, m, y, k] }]), tryb_kolorow? (pelny | szarosc | czb1), kolor_trybu?, ksiazka? (table of contents headings and footnote numbering: { naglowki: [{ styl, poziom }], przypisy: sekcja | strona | ciagle }) }. A spot colour in an element and finishes – the element field uszlachetnienie. The database checks consistency (sections, masters, series, tables, images) and rejects inconsistent changes with a description. Doesn’t upload images or fonts.",
 "Części projektu do zapisu": "Project parts to save",
 "Zmień nazwę projektu": "Rename project",
 "Zmienia nazwę projektu.": "Changes the project name (as shown in the project list).",
 "Nowa nazwa": "New name",
 "Kontrola projektu": "Check project",
 "Szybka kontrola bez rysowania: nieznane pola {…} w tekstach, brakujące pliki obrazów z danych, elementy poza stroną. Pełne „Sprawdź przed drukiem” jest w aplikacji.": "Quick check without rendering: unknown {…} fields in texts, missing image files from data, elements outside the page. The full “Check before printing” is in the app.",
 "Komentarze projektu": "Project comments",
 "Komentarze na stronach (osobno od projektu, nie zmieniają jego wersji): wątki z numerem pinezki, stroną, elementem albo miejscem (mm od lewego górnego rogu strony), autorem, treścią, stanem (otwarty/rozwiązany) i odpowiedziami. Domyślnie tylko nierozwiązane.": "Comments on pages (separate from the project, they don’t change its version): threads with a pin number, page, element or position (mm from the top-left corner of the page), author, text, state (open/resolved) and replies. By default only unresolved ones.",
 "true – także rozwiązane wątki": "true – also resolved threads",
 "Dodaj komentarz na stronie": "Add comment on page",
 "Nowy wątek komentarza przypięty do strony: do elementu (element = id) albo do miejsca (x, y w mm od lewego górnego rogu strony). Osoby w projekcie zobaczą pinezkę z numerem; @nazwa wspomina osobę z projektu (dostanie powiadomienie). Komentarz nie zmienia projektu – działa też z kluczem tylko do czytania. Podpisany opisem klucza.": "A new comment thread pinned to a page: to an element (element = id) or to a position (x, y in mm from the top-left corner of the page). People in the project see a numbered pin; @name mentions a person in the project (they get a notification). A comment doesn’t change the project – it also works with a read-only key. Signed with the key description.",
 "id elementu na tej stronie (opcjonalnie)": "id of an element on this page (optional)",
 "Treść komentarza": "Comment text",
 "Odpowiedz na komentarz": "Reply to comment",
 "Odpowiedź w wątku komentarza (komentarz = id wątku albo odpowiedzi). Opcjonalnie rozwiaz=true zamyka wątek po odpowiedzi (np. gdy poprawka już jest w projekcie).": "Reply in a comment thread (comment = id of the thread or of a reply). Optionally resolve=true closes the thread after replying (e.g. when the fix is already in the project).",
 "id komentarza (wątku)": "comment (thread) id",
 "Treść odpowiedzi": "Reply text",
 "true – oznacz wątek jako rozwiązany": "true – mark the thread as resolved",
 "Rozwiąż albo otwórz wątek komentarza": "Resolve or reopen comment thread",
 "Oznacza wątek komentarza jako rozwiązany (rozwiazany=true, domyślnie) albo otwiera go ponownie (false).": "Marks a comment thread as resolved (resolved=true, default) or reopens it (false).",
 "id wątku": "thread id",
 "Eksportuj projekt do PDF": "Export project to PDF",
 "Plik PDF projektu (do drukarni albo do czytania na ekranie). PDF rysuje aplikacja Makietki w przeglądarce użytkownika: narzędzie składa zlecenie, otwarta aplikacja konta klucza robi plik i wgrywa go na konto, a narzędzie czeka do ok. 45 s i zwraca link do pobrania (bez logowania, ważny 7 dni) z uwagami z kontroli przed drukiem. Gdy aplikacja nie jest otwarta – zwraca link do aplikacji dla użytkownika (po jego otwarciu plik zrobi się sam) i numer zlecenia. Działa też z kluczem tylko do czytania.": "A PDF file of the project (for print or for reading on screen). The PDF is rendered by the Makietka app in the user’s browser: the tool places a job, the open app of the key’s account makes the file and uploads it to the account, and the tool waits up to about 45 s and returns a download link (no sign-in, valid 7 days) with notes from the pre-print check. When the app isn’t open – returns a link to the app for the user (once opened, the file is made automatically) and the job number. Also works with a read-only key.",
 "wszystko (domyślnie), jedna sekcja, kilka sekcji (sekcje) albo wybrane strony (strony – tekst jak w Wordzie albo od–do; numery w całym wydruku, z powieleniami serii)": "all (default), one section, several sections (sections) or selected pages (pages – text as in Word or from–to; numbers in the whole output, including series repetitions)",
 "id albo nazwa sekcji (zakres: sekcja)": "section id or name (scope: section)",
 "id albo nazwy sekcji (zakres: sekcje)": "section ids or names (scope: sections)",
 "numery stron jak w Wordzie, np. „1-5, 8, 11-” (11- = od 11 do końca); zakres: strony – zamiast od/do": "page numbers as in Word, e.g. “1-5, 8, 11-” (11- = from 11 to the end); scope: pages – instead of from/to",
 "pierwsza strona (zakres: strony)": "first page (scope: pages)",
 "ostatnia strona (zakres: strony)": "last page (scope: pages)",
 "drukarnia (domyślnie) – ze spadem i znakami cięcia; ekran – sam format strony, z zakładkami i linkami": "print (default) – with bleed and crop marks; screen – just the page format, with bookmarks and links",
 "wektor (domyślnie) – tekst i kształty wektorowo, czcionki osadzone; obraz – każda strona jako obraz": "vector (default) – text and shapes as vectors, fonts embedded; image – each page as an image",
 "rozdzielczość obrazów (domyślnie 300)": "image resolution (default 300)",
 "tekst i kształty w CMYK (plik wektorowy)": "text and shapes in CMYK (vector file)",
 "PDF/X-4 z profilem: fogra39 – papier powlekany, fogra47 – niepowlekany; pusty – zwykły PDF": "PDF/X-4 with a profile: fogra39 – coated paper, fogra47 – uncoated; empty – regular PDF",
 "zwykly (domyślnie) – strona po stronie; broszura – arkusze do złożenia i zszycia; skladki – broszura w składkach; dwie / cztery – strony na arkuszu": "normal (default) – page by page; booklet – sheets to fold and staple; signatures – booklet in signatures; two_up / four_up – pages per sheet",
 "arkusz przy układzie innym niż zwykly": "sheet for a layout other than normal",
 "stron w składce (uklad: skladki)": "pages per signature (layout: signatures)",
 "false – tylko złóż zlecenie i od razu wróć z numerem zlecenia": "false – just place the job and return the job number right away",
 "Pobierz stronę jako PNG": "Export page as PNG",
 "Obraz PNG jednej strony (ze spadem), np. do pokazania w czacie albo w internecie. Obraz rysuje otwarta aplikacja Makietki, narzędzie czeka do ok. 45 s i zwraca link do pobrania (ważny 7 dni) albo link do aplikacji, gdy żadna nie jest otwarta.": "A PNG image of one page (with bleed), e.g. to show in a chat or online. The image is rendered by the open Makietka app; the tool waits up to about 45 s and returns a download link (valid 7 days), or a link to the app when none is open.",
 "który egzemplarz strony z serii (domyślnie 1)": "which copy of the page in the series (default 1)",
 "rozdzielczość (domyślnie 150)": "resolution (default 150)",
 "false – tylko złóż zlecenie": "false – just place the job",
 "Stan zleconego eksportu": "Export job status",
 "Stan zlecenia eksportu (PDF albo PNG) i innych zleceń dla aplikacji: czeka na aplikację, w toku, gotowe (z linkiem do pobrania) albo błąd.": "Status of an export job (PDF or PNG) and other jobs for the app: waiting for the app, in progress, done (with a download link) or error.",
 "numer zlecenia": "job number",
 "Udostępnij link do podglądu": "Share preview link",
 "Tworzy link do podglądu projektu (jak Podgląd → Udostępnij w aplikacji): każdy, kto ma link, obejrzy strony bez logowania i bez możliwości zmian. To publikacja treści: wymaga zgoda_uzytkownika: true; opcjonalnie hasło albo data ważności. Gdy projekt ma już link – zwraca ten sam adres (i ustawia podaną ochronę). Link robi otwarta aplikacja Makietki; gdy nie jest otwarta, wynik podaje link do aplikacji.": "Creates a preview link for the project (like Preview → Share in the app): anyone with the link can view the pages without signing in and without being able to change them. This publishes content: requires user_consent: true; optionally a password or expiry date. If the project already has a link – returns the same address (and applies the given protection). The link is made by the open Makietka app; when it isn’t open, the result gives a link to the app.",
 "true – użytkownik wyraźnie zgodził się na link w tej rozmowie": "true – the user explicitly agreed to the link in this conversation",
 "hasło do linku (co najmniej 4 znaki; opcjonalnie)": "link password (at least 4 characters; optional)",
 "ostatni dzień ważności RRRR-MM-DD (opcjonalnie)": "last day of validity YYYY-MM-DD (optional)",
 "Narysuj obraz (Gemini)": "Draw image (Gemini)",
 "Rysuje obraz z opisu kluczem Google Gemini użytkownika i wstawia go do ramki (element – id kształtu, kadru albo prostokąta na stronie gdzie; obraz ją wypełnia) albo na środek strony. Rysuje otwarta aplikacja Makietki (klucz Gemini jest tylko w przeglądarce użytkownika); narzędzie czeka do ok. 1,5 minuty. Kosztuje (szkic ok. 0,14 zł; pilnuje tego miesięczny limit z ustawień konta) – powiedz użytkownikowi, co rysujesz. Nie umieszczaj tekstu w obrazie; napisy dodaje się w Makietce.": "Draws an image from a description with the user’s Google Gemini key and puts it into a frame (element – id of a shape, panel or rectangle on the target page; the image fills it) or in the centre of the page. Drawn by the open Makietka app (the Gemini key is only in the user’s browser); the tool waits up to about 1.5 minutes. Costs money (a draft about 0.14 PLN; limited by the monthly limit in the account settings). Text isn’t drawn into the image; captions are added in Makietka.",
 "Co ma być na obrazie – w języku użytkownika": "What the image should show – in the user’s language",
 "„strona:<id strony>” – strona z ramką albo strona, na którą wstawić obraz": "“page:<page id>” – the page with the frame, or the page to put the image on",
 "id ramki na tej stronie (opcjonalnie)": "frame id on this page (optional)",
 "szkic – najtaniej (domyślnie), dokladny – do druku, pro – najlepszy; lepszą jakość tylko, gdy użytkownik o nią prosi": "draft – cheapest (default), fine – for print, pro – best; higher quality only when the user asks for it",
 "kształt obrazu, np. 3:4 (pion), 4:3 (poziom), 1:1 – zgodny z ramką": "image shape, e.g. 3:4 (portrait), 4:3 (landscape), 1:1 – matching the frame",
 "true – popraw obraz, który już jest w elemencie (element wymagany): opis to TYLKO zmiana, np. „dodaj kapelusz”": "true – edit the image already in the element (element required): the prompt is ONLY the change, e.g. “add a hat”",
 "false – tylko zleć i od razu wróć z numerem zlecenia": "false – just place the job and return the job number right away",
 "Narysuj kadry komiksu": "Draw comic panels",
 "Komiks: rysuje obrazy do kadrów strony komiksu ze scenariusza (opis sceny, kto mówi) i kart postaci/miejsc, w stylu projektu – kluczem Gemini użytkownika, w otwartej aplikacji Makietki (otworzy w niej projekt). strona – numer strony komiksu (1 = pierwsza strona sekcji Komiks). Domyślnie tylko kadry bez obrazu. Kosztuje (ok. 0,14 zł za kadr w szkicu) – powiedz użytkownikowi, ile kadrów rysujesz. Cała strona trwa kilka minut.": "Comic: draws images for the panels of a comic page from the script (scene description, who speaks) and the character/location cards, in the project’s style – with the user’s Gemini key, in the open Makietka app (it opens the project there). page – comic page number (1 = first page of the Comic section). By default only panels without an image. Costs money (about 0.14 PLN per panel as a draft). A whole page takes a few minutes.",
 "numer strony komiksu": "comic page number",
 "numery kadrów (opcjonalnie; domyślnie puste kadry)": "panel numbers (optional; default: empty panels)",
 "false – tylko zleć i od razu wróć": "false – just place the job and return",
 "Ustaw dymki komiksu": "Place comic speech bubbles",
 "Komiks: stawia dymki z tabeli scenariusza na stronach komiksu (ponownie – zmienia tylko tekst, przesunięte dymki zostają), w otwartej aplikacji Makietki. kolumna – kolumna tekstu dla innej wersji językowej (np. tekst_en). Nic nie kosztuje.": "Comic: places speech bubbles from the script table on the comic pages (again – changes only the text, moved bubbles stay), in the open Makietka app. column – text column for another language version (e.g. tekst_en). Free of charge.",
 "kolumna tekstu (opcjonalnie)": "text column (optional)",
 "false – tylko zleć": "false – just place the job",
 "Biblioteka elementów": "Element library",
 "Katalog Biblioteki Makietki: gotowe kształty, ramki, ikony, ilustracje, ozdobniki, linie, kalendarze, wykresy, tabele, tła i wzory, nagłówki, infografiki, elementy komiksu i in. Bez parametrów – lista kategorii; szukaj – elementy pasujące do słów (np. „ramka zaokrąglona”, „serce”, „kalendarz”); kategoria – elementy jednej kategorii.": "Catalogue of the Makietka Library: ready-made shapes, frames, icons, illustrations, ornaments, lines, calendars, charts, tables, backgrounds and patterns, headings, infographics, comic elements and more. Without parameters – list of categories; search – elements matching the words (e.g. “rounded frame”, “heart”, “calendar”); category – elements of one category.",
 "słowa do wyszukania (bez polskich znaków też działa)": "words to search for (Polish words also work without diacritics)",
 "id kategorii z listy": "category id from the list",
 "Wstaw element z Biblioteki": "Insert Library element",
 "Wstawia gotowy element z Biblioteki Makietki (kategoria i element z katalogu Biblioteki) na stronę – tak jak kliknięcie w oknie Biblioteki. x, y – środek elementu w mm od lewego górnego rogu strony (bez nich – domyślne miejsce elementu). Wstawia otwarta aplikacja Makietki (otworzy w niej projekt); wynik podaje id nowego elementu i jego położenie. Nic nie kosztuje.": "Inserts a ready-made element from the Makietka Library (category and element from the Library catalogue) on a page – just like clicking in the Library window. x, y – the element centre in mm from the top-left corner of the page (without them – the element’s default place). Inserted by the open Makietka app (it opens the project there); the result gives the new element’s id and position. Free of charge.",
 "id kategorii z katalogu Biblioteki": "category id from the Library catalogue",
 "id elementu z katalogu Biblioteki": "element id from the Library catalogue",
 "„strona:<id strony>”": "“page:<page id>”",
 "środek elementu w poziomie, mm od lewej krawędzi strony": "element centre horizontally, mm from the left edge of the page",
 "środek elementu w pionie, mm od górnej krawędzi strony": "element centre vertically, mm from the top edge of the page",
 "Cofnij zmiany AI": "Undo AI changes",
 "Przywraca projekt do stanu sprzed ostatniej serii zmian zrobionych przez AI (zapisy AI w odstępach do 15 minut; strony usunięte przez AI wracają, dodane – znikają). Zmiany zrobione później, także przez ludzi, też się cofną. sprawdz=true tylko opisuje, co zostanie cofnięte (od–do, ile zapisów, ile późniejszych zmian), bez zmian w projekcie. Kolejne wywołanie sięga do wcześniejszej serii.": "Restores the project to the state before the latest series of changes made by AI (AI saves less than 15 minutes apart; pages deleted by AI come back, added ones disappear). Changes made later, also by people, are undone too. check_only=true only describes what would be undone (from–to, how many saves, how many later changes), without changing the project. Each next call reaches an earlier series.",
 "true – tylko informacja, co zostałoby cofnięte (nic nie zmienia)": "true – only information on what would be undone (changes nothing)",
 "Czcionki": "Fonts",
 "Lista czcionek, których można użyć w projekcie (pole fontFamily): wbudowane w Makietkę, pogrupowane według rodzaju, z informacją o pogrubieniu i kursywie, oraz czcionki wgrane do tego projektu. Używaj tylko tych nazw – inna czcionka nie wyświetli się i nie trafi do PDF. Własną czcionkę (plik TTF/OTF) użytkownik wgrywa sam w aplikacji: Czcionki projektu → Wgraj.": "Lists fonts that can be used in the project (the fontFamily field): built into Makietka, grouped by kind, with information on bold and italic, plus fonts uploaded to this project. Only these names work – another font won’t display or get into the PDF. The user uploads their own font (TTF/OTF file) in the app: Project fonts → Upload.",
 "Opis formatu projektu": "Project format description",
 "Pełny opis modelu projektu Makietki: sekcje, strony, elementy i ich pola, tabele, serie, pola w tekście, jednostki (mm).": "Full description of the Makietka project model: sections, pages, elements and their fields, tables, series, fields in text, units (mm)."
};
// </TEKSTY_EN>
const INSTRUKCJE_EN_PELNE = 'The tools read and change Makietka projects (an editor for calendars and data-driven print publications) in the key owner’s account – alongside them when they have the project open in the editor. Start with list_projects: the projects the key gives access to (and whether you can create and delete projects). Pass the project (id or name from the list) to every project tool; it can be omitted when the key covers one project. Then get_project_overview. Sizes are in millimetres (font size too: pt × 25.4 / 72). Project data (element fields, page and table JSON) uses Polish field names – get_format_spec describes them; read it before larger changes. Change things in small steps (update_elements, update_table, update_part; deleting: delete_table_data, delete_part); a Library element is changed afterwards with update_elements; use update_project only for changes the other tools don’t cover. Repeated pages are made as a series from a table, not as page copies. Comments on pages: list_comments; reply with reply_to_comment (resolve=true when the fix is already in the project), add new ones with add_comment. Comic panels are drawn by draw_comic_panels and pictures from a description by generate_image (done by the open app with the user’s Gemini key; it costs money – tell the user what you are drawing); speech bubbles are placed by place_speech_bubbles. Ready-made elements (frames, icons, calendars, charts, ornaments…): search_library and insert_library_element. Preview link: share_preview_link – only with the user’s explicit consent (suggest a password or expiry date). Delete a project (delete_project) only after asking directly. AI changes are undone by undo_ai_changes: first check_only=true, tell the user what will be undone, and undo only at their explicit request. Final file: export_pdf (whole project, a section or pages, for print or screen) and export_png (one page) return a download link – the file is made by the open Makietka app; when it isn’t open, give the user the app link from the result and check get_job_status. Images: upload_image (https url, SVG code, base64) adds a file to the project (an image from the web – give the source and respect copyright); replace_image swaps a used image for a new file (pages show the new one right away), place_image puts it on a page as a single element, list_images lists them. Files in your own environment (workspace, sandbox attachment) you upload yourself with upload_image_chunks – base64 chunks through the connector, no network access needed (unpack a ZIP locally). That’s a good way for graphics up to a few hundred KB; don’t lower file quality without the user’s consent. get_upload_url gives an address with a key – don’t show it. Large photos or files you can’t reach: call get_upload_link and give the user the link – they upload them themselves; then check list_images and carry on. Never answer that it’s impossible or that you have no access to their files. Don’t connect to the database from your own sandbox – use the Makietka connector tools and don’t ask the user to unblock domains or change network settings.';
const INSTRUKCJE_EN_BEZ_RYSOWANIA = INSTRUKCJE_EN_PELNE.replace('Comic panels are drawn by draw_comic_panels and pictures from a description by generate_image (done by the open app with the user’s Gemini key; it costs money – tell the user what you are drawing); speech bubbles are placed by place_speech_bubbles.', 'Comic speech bubbles are placed by place_speech_bubbles.');
const ZE_STARYCH_EN = Object.fromEntries(Object.entries(NAZWY_EN).map(([pl, en]) => [en, pl]));
export const nazwaWewnetrzna = (n) => ZE_STARYCH_EN[n] || n;
const parametrEn = (narzedzie, k) => PARAMETRY_NARZEDZI_EN[`${narzedzie}.${k}`] || PARAMETRY_EN[k] || k;
const tekstEn = (t) => (typeof t === 'string' ? TEKSTY_EN[t] ?? t : t);
// Schemat parametrów po angielsku: nazwy pól, opisy i wartości wyliczeń (rekurencyjnie: pola obiektów i elementy list).
function schematEn(s, narzedzie) {
  if (!s || typeof s !== 'object') return s;
  const w = { ...s };
  if (w.description) w.description = tekstEn(w.description);
  if (w.title) w.title = tekstEn(w.title);
  if (Array.isArray(w.enum)) w.enum = w.enum.map((v) => (typeof v === 'string' ? WARTOSCI_EN[v] ?? v : v));
  if (w.items) w.items = schematEn(w.items, narzedzie);
  if (w.properties) w.properties = Object.fromEntries(Object.entries(w.properties).map(([k, v]) => [parametrEn(narzedzie, k), schematEn(v, narzedzie)]));
  if (Array.isArray(w.required)) w.required = w.required.map((k) => parametrEn(narzedzie, k));
  for (const k of ['anyOf', 'oneOf']) if (Array.isArray(w[k])) w[k] = w[k].map((x) => schematEn(x, narzedzie));
  return w;
}
// Argumenty z angielskich nazw z powrotem na polskie (według polskiego schematu narzędzia); polskie zostają bez zmian.
function argumentyZEn(a, s, narzedzie) {
  if (a === null || typeof a !== 'object' || !s) return a;
  if (Array.isArray(a)) return s.items ? a.map((x) => argumentyZEn(x, s.items, narzedzie)) : a;
  if (!s.properties) return a;
  const w = {};
  const zEn = Object.fromEntries(Object.keys(s.properties).map((k) => [parametrEn(narzedzie, k), k]));
  for (const [k, v] of Object.entries(a)) {
    const pl = s.properties[k] ? k : (zEn[k] ?? k);
    const ps = s.properties[pl];
    let x = v;
    if (ps && Array.isArray(ps.enum) && typeof v === 'string') x = ps.enum.find((e) => e === v || WARTOSCI_EN[e] === v) ?? v;
    else if (ps && Array.isArray(ps.items?.enum) && Array.isArray(v)) x = v.map((y) => ps.items.enum.find((e) => e === y || WARTOSCI_EN[e] === y) ?? y);
    else if (ps) x = argumentyZEn(v, ps, narzedzie);
    // „page:<id>” / „master:<id>” – po polsku „strona:” / „wzorzec:”.
    if (pl === 'gdzie' && typeof x === 'string') x = x.replace(/^page:/, 'strona:').replace(/^master:/, 'wzorzec:');
    w[pl] = x;
  }
  return w;
}

// czekanieEksportu, krokEksportu (ms): jak długo i jak często łącznik czeka na plik zlecony aplikacji (#175).
export function utworzSerwer({ adres, kluczPubliczny, klucz, czytajOpis = null, brakKlucza = 'Brak klucza dostępu (klucz z aplikacji: menu ⋯ → Sztuczna inteligencja).', czytajPliki = null, pobierzAdres = pobierzZAdresu, plikiZCzatu = false, rysowanie = true, angielski = false, projekt: wybranyProjekt = null, czekanieEksportu = 45000, krokEksportu = 1500, adresPobierania = ADRES_POBIERANIA }) {
  const OPCJE = { adres, kluczPubliczny, klucz, czytajOpis, brakKlucza, czytajPliki, pobierzAdres, plikiZCzatu, rysowanie, angielski, czekanieEksportu, krokEksportu, adresPobierania };
  const ADRES = String(adres || '').replace(/\/+$/, '');
  const KLUCZ_PUBLICZNY = kluczPubliczny;
  // Klucz konta (ustawienia konta → Sztuczna inteligencja) i – dla narzędzi projektu – wybrany projekt: funkcje bazy ai_*
  // dostają „klucz/<id projektu>” (migracja 20261114200000_klucze_ai_konta.sql). Bez projektu baza bierze jedyny
  // projekt klucza albo prosi o wskazanie.
  const KLUCZ_KONTA = String(klucz || '').trim();
  const KLUCZ = KLUCZ_KONTA && wybranyProjekt ? `${KLUCZ_KONTA}/${wybranyProjekt}` : KLUCZ_KONTA;
  const BRAK_KLUCZA = brakKlucza;

  async function rpc(funkcja, parametry) {
    const odp = await fetch(`${ADRES}/rest/v1/rpc/${funkcja}`, {
      method: 'POST',
      headers: { apikey: KLUCZ_PUBLICZNY, authorization: `Bearer ${KLUCZ_PUBLICZNY}`, 'content-type': 'application/json' },
      body: JSON.stringify(parametry),
    });
    const tekst = await odp.text();
    let dane = null;
    try { dane = tekst ? JSON.parse(tekst) : null; } catch { /* odpowiedź nie-JSON */ }
    if (!odp.ok) throw new BladBazy(`Baza odpowiedziała błędem ${odp.status}: ${dane?.message || tekst.slice(0, 200)}`);
    return dane;
  }

  async function projektyKlucza() {
    if (!KLUCZ_KONTA) throw new BladBazy(BRAK_KLUCZA);
    const w = await rpc('ai_projekty', { p_klucz: KLUCZ_KONTA });
    if (w?.blad) throw new BladBazy(w.blad);
    return w; // { dostep, projekty }
  }

  // Projekt wskazany przez AI: id albo nazwa (bez względu na wielkość liter) z listy projektów klucza.
  async function jakiProjekt(ktory) {
    const szukany = String(ktory ?? '').trim();
    const { projekty } = await projektyKlucza();
    const poId = projekty.find((x) => x.id === szukany);
    if (poId) return poId.id;
    const poNazwie = projekty.filter((x) => String(x.nazwa || '').trim().toLowerCase() === szukany.toLowerCase());
    if (poNazwie.length === 1) return poNazwie[0].id;
    const lista = projekty.map((x) => `${x.id} „${x.nazwa}”`).join(', ') || 'brak';
    if (poNazwie.length > 1) throw new BladBazy(`Kilka projektów nazywa się „${szukany}” – podaj id: ${poNazwie.map((x) => x.id).join(', ')}.`);
    throw new BladBazy(`Klucz nie prowadzi do projektu „${szukany}”. Projekty: ${lista}.`);
  }

  // Ten sam serwer dla wskazanego projektu (id albo nazwa) – osobny obiekt, więc równoległe wywołania się nie mieszają.
  async function dlaProjektu(ktory) {
    if (ktory === undefined || ktory === null || String(ktory).trim() === '') return null;
    return utworzSerwer({ ...OPCJE, projekt: await jakiProjekt(ktory) });
  }

  async function pobierz() {
    if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
    const w = await rpc('ai_projekt', { p_klucz: KLUCZ });
    if (w?.blad) throw new BladBazy(w.blad);
    return w; // { dostep, wersja, projekt }
  }

  // ---------- Eksport zlecony aplikacji (#175) ----------
  // PDF i PNG rysuje przeglądarka (czcionki, profile barwne) – łącznik składa zlecenie (ai_zlec_eksport), otwarta
  // aplikacja konta klucza robi plik i wgrywa go na konto, a łącznik czeka chwilę i podaje link do pobrania.
  // Bez otwartej aplikacji – link, po którego otwarciu aplikacja zrobi plik sama.
  // Rozmiar pliku: małe w kB (było „0,0 MB” dla PDF-a 40 kB), większe w MB.
  const MB = (b) => (Number(b || 0) < 1048576 ? `${Math.max(1, Math.round(Number(b || 0) / 1024))} kB` : `${(Number(b || 0) / 1048576).toFixed(Number(b || 0) < 10485760 ? 1 : 0).replace('.', ',')} MB`);
  // Zadania dla otwartej aplikacji (plan H1, H2, H4): link do podglądu, obraz z opisu, kadry komiksu, dymki.
  const NAZWY_ZADAN = { link: 'link do podglądu', obraz: 'obraz', kadry: 'kadry komiksu', dymki: 'dymki', biblioteka: 'element z Biblioteki' };
  function opisZadania(z) {
    const co = NAZWY_ZADAN[z.rodzaj] || z.rodzaj;
    const w = z.wynik || {};
    if (z.stan === 'gotowe') {
      if (z.rodzaj === 'link') return `Link do podglądu gotowy: ${w.adres}${w.haslo ? ' (z hasłem, które podał użytkownik)' : ''}${w.wazny_do ? `, ważny do ${String(w.wazny_do).slice(0, 10)}` : ''}. Strony podglądu mogą dorysowywać się jeszcze chwilę. Link unieważnia użytkownik w aplikacji: Podgląd → Udostępnij → Unieważnij link.`;
      return w.opis || `Zadanie „${co}” gotowe.`;
    }
    if (z.stan === 'blad') return `Aplikacja nie wykonała zadania „${co}”: ${String(z.blad || 'nieznany błąd').replace(/\.+$/, '')}. Zlecenie: ${z.id}.`;
    if (z.stan === 'w_toku') return `Aplikacja właśnie wykonuje zadanie „${co}” (zlecenie ${z.id}). Może to potrwać kilka minut – sprawdź narzędziem stan_eksportu (zlecenie: ${z.id}).`;
    return `Zadanie „${co}” czeka (${z.id}): wykonuje je aplikacja Makietki w przeglądarce, a teraz żadna nie jest otwarta na tym koncie. Daj użytkownikowi ten link – po jego otwarciu (zalogowany na koncie klucza) aplikacja wykona zadanie sama: ${ADRES_APLIKACJI}#/p/${z.projekt_id}/eksport/${z.id}\nPotem sprawdź stan_eksportu (zlecenie: ${z.id}).`;
  }
  async function zlecZadanie(rodzaj, ustawienia, czekaj = true, ileCzekac = czekanieEksportu) {
    if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
    const z = await rpc('ai_zlec_zadanie', { p_klucz: KLUCZ, p_rodzaj: rodzaj, p_ustawienia: ustawienia });
    if (z?.blad) throw new BladBazy(z.blad);
    if (!czekaj) return `Zlecono zadanie „${NAZWY_ZADAN[rodzaj]}” (zlecenie ${z.id}) – wykona je otwarta aplikacja Makietki; sprawdź stan_eksportu.`;
    let s = z;
    const koniec = Date.now() + ileCzekac;
    while (Date.now() < koniec) {
      await new Promise((r) => setTimeout(r, krokEksportu));
      s = await rpc('ai_stan_eksportu', { p_klucz: KLUCZ_KONTA, p_id: z.id });
      if (s?.blad && !s.id) throw new BladBazy(s.blad); // błąd klucza; zlecenie z błędem ma id
      if (s.stan === 'gotowe' || s.stan === 'blad') break;
    }
    if (s.stan === 'blad') throw new BladBazy(opisZadania(s));
    return opisZadania(s);
  }
  const JAKOSC_OBRAZU = { type: 'string', enum: ['szkic', 'dokladny', 'pro'], description: 'szkic – najtaniej (domyślnie), dokladny – do druku, pro – najlepszy; lepszą jakość tylko, gdy użytkownik o nią prosi' };

  function opisEksportu(z) {
    const linkAplikacji = `${ADRES_APLIKACJI}#/p/${z.projekt_id}/eksport/${z.id}`;
    const rodzaj = z.rodzaj === 'png' ? 'PNG' : 'PDF';
    if (z.stan === 'gotowe' && z.sekret) {
      const link = `${adresPobierania}${z.id}/${z.sekret}/${encodeURIComponent(z.nazwa || `eksport.${z.rodzaj}`)}`;
      const uwagi = Array.isArray(z.uwagi) && z.uwagi.length ? `\nUwagi z kontroli przed drukiem (${z.uwagi.length}):\n${z.uwagi.map((u) => `- ${u}`).join('\n')}` : '';
      return `Plik ${rodzaj} gotowy: ${z.nazwa} (${MB(z.rozmiar)}${z.strony ? `, ${z.strony} ${z.strony === 1 ? 'strona' : 'stron(y)'}` : ''}).\nLink do pobrania (bez logowania, ważny 7 dni – do ${z.wygasa}): ${link}${uwagi}`;
    }
    if (z.stan === 'blad') return `Aplikacja nie zrobiła pliku ${rodzaj}: ${String(z.blad || 'nieznany błąd').replace(/\.+$/, '')}. Zlecenie: ${z.id}. Popraw ustawienia albo projekt i zleć jeszcze raz.`;
    if (z.stan === 'w_toku') return `Aplikacja właśnie robi plik ${rodzaj} (zlecenie ${z.id}). Duży projekt może potrwać kilka minut – sprawdź narzędziem stan_eksportu (zlecenie: ${z.id}).`;
    return `Zlecenie eksportu ${rodzaj} czeka (${z.id}): plik rysuje aplikacja Makietki w przeglądarce, a teraz żadna nie jest otwarta na tym koncie. Daj użytkownikowi ten link – po jego otwarciu (zalogowany na koncie klucza) aplikacja sama zrobi plik: ${linkAplikacji}\nPotem sprawdź stan_eksportu (zlecenie: ${z.id}) i podaj link do pobrania. Gdy aplikacja jest już otwarta, przyjmie zlecenie sama w ciągu kilku sekund.`;
  }
  async function zlecEksport(rodzaj, ustawienia, czekaj = true) {
    if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
    const z = await rpc('ai_zlec_eksport', { p_klucz: KLUCZ, p_rodzaj: rodzaj, p_ustawienia: ustawienia });
    if (z?.blad) throw new BladBazy(z.blad);
    if (!czekaj) return opisEksportu(z);
    let s = z;
    const koniec = Date.now() + czekanieEksportu;
    while (Date.now() < koniec) {
      await new Promise((r) => setTimeout(r, krokEksportu));
      s = await rpc('ai_stan_eksportu', { p_klucz: KLUCZ_KONTA, p_id: z.id });
      if (s?.blad && !s.id) throw new BladBazy(s.blad); // błąd klucza; zlecenie z błędem ma id
      if (s.stan === 'gotowe' || s.stan === 'blad') break;
    }
    return opisEksportu(s);
  }


  // Pola liczone przez aplikację są chronione (#141, #138): AI ich nie ustawia ani nie nadpisuje – łącznik zostawia
  // wartości z projektu (albo je usuwa, gdy w projekcie ich nie ma), niezależnie od tego, co przyszło w zmianie.
  // Inaczej zapisany po swojemu układ okładki wywracał otwieranie projektu (#141), a przeliczenia w edytorze
  // poprawiały je z powrotem i każda strona wyglądała na zmienioną w dwóch miejscach.
  //  • sekcja: okladka.wynik (układ okładki),
  //  • element (także w grupach i we wzorcach): ramka_pola (ramka obrazu z danych), z (kolejność na rozkładówce),
  //    kod.narysowano (dla jakiej treści narysowano kod QR/EAN),
  //  • projekt: wersja.
  const POLA_ELEMENTU_LICZONE = ['ramka_pola', 'z'];
  function przywrocPola(nowy, dawny) {
    if (!nowy || typeof nowy !== 'object') return;
    for (const k of POLA_ELEMENTU_LICZONE) {
      if (dawny && dawny[k] !== undefined) nowy[k] = dawny[k]; else delete nowy[k];
    }
    if (nowy.kod && typeof nowy.kod === 'object') {
      if (dawny?.kod?.narysowano !== undefined) nowy.kod.narysowano = dawny.kod.narysowano; else delete nowy.kod.narysowano;
    }
    if (Array.isArray(nowy.objects)) {
      const dawne = new Map((dawny?.objects || []).filter((o) => o?.id).map((o) => [o.id, o]));
      for (const o of nowy.objects) przywrocPola(o, o?.id ? dawne.get(o.id) : null);
    }
  }
  function zachowajObiekty(lista, dawneListy) {
    if (!Array.isArray(lista)) return;
    const dawne = new Map((dawneListy || []).flatMap((x) => x?.obiekty || []).filter((o) => o?.id).map((o) => [o.id, o]));
    for (const cel of lista) for (const o of cel?.obiekty || []) przywrocPola(o, o?.id ? dawne.get(o.id) : null);
  }
  function zachowajWyliczone(zmiany, projekt) {
    if (Array.isArray(zmiany.sekcje)) {
      for (const s of zmiany.sekcje) {
        // Typ sekcji (#177): AI, które dopisało okładkę albo sekcję specjalną innego rodzaju, a typu nie zmieniło,
        // dostaje typ wynikający z tych parametrów – inaczej aplikacja (czytająca tylko typ) by je pominęła.
        if (s && typeof s === 'object') {
          const dawnaS = (projekt.sekcje || []).find((x) => x.id === s.id);
          const typZmieniony = s.typ !== undefined && s.typ !== dawnaS?.typ;
          if (!typZmieniony) {
            if (s.okladka && typeof s.okladka === 'object' && !dawnaS?.okladka) s.typ = 'okladka';
            const r = s.specjalna && typeof s.specjalna === 'object' ? s.specjalna.rodzaj : null;
            if (r && r !== dawnaS?.specjalna?.rodzaj) s.typ = r === 'wyklejka' ? (s.specjalna.strona === 'tylna' ? 'wyklejka_tylna' : 'wyklejka_przednia') : r;
          }
        }
        // Sekcja specjalna (#177): wynik (strefy, zgięcia, wykrojnik) liczy aplikacja – jak układ okładki.
        if (s?.specjalna && typeof s.specjalna === 'object') {
          const dawnaSp = (projekt.sekcje || []).find((x) => x.id === s.id)?.specjalna;
          if (dawnaSp?.wynik && dawnaSp.rodzaj === s.specjalna.rodzaj) s.specjalna.wynik = dawnaSp.wynik; else delete s.specjalna.wynik;
        }
        if (!s?.okladka || typeof s.okladka !== 'object') continue;
        const dawna = (projekt.sekcje || []).find((x) => x.id === s.id)?.okladka?.wynik;
        if (dawna) s.okladka.wynik = dawna; else delete s.okladka.wynik;
      }
    }
    zachowajObiekty(zmiany.strony, projekt.strony);
    zachowajObiekty(zmiany.wzorce, projekt.wzorce);
    delete zmiany.wersja;
  }

  // Pobierz → zmień → zapisz z numerem wersji. Przy odmowie (projekt zmienił się w międzyczasie, np. ktoś
  // pisze w edytorze) pobiera projekt na nowo i nanosi zmianę jeszcze raz – raz.
  async function zmien(zmiana) {
    for (let proba = 0; proba < 2; proba += 1) {
      const { projekt, wersja } = await pobierz();
      // Stan sprzed zmiany: narzędzia zmieniają projekt w miejscu, a pola liczone trzeba wziąć sprzed tej zmiany.
      const przed = JSON.parse(JSON.stringify(projekt));
      const { zmiany, opis } = zmiana(projekt);
      if (!zmiany || !Object.keys(zmiany).length) return opis || 'Nic do zmiany.';
      zachowajWyliczone(zmiany, przed);
      const w = await rpc('ai_zapisz', { p_klucz: KLUCZ, p_znana_wersja: wersja, p_zmiany: zmiany });
      if (w?.konflikt && proba === 0) continue;
      if (w?.blad) throw new BladBazy(opisBledu(w));
      return `${opis} Zapisano (wersja ${w.wersja}); zmiana jest już w edytorze właściciela.`;
    }
    throw new BladBazy('Projekt zmienia się teraz bardzo często – spróbuj za chwilę.');
  }

  // Obraz projektu wskazany identyfikatorem albo nazwą (pełną; bez rozszerzenia – gdy pasuje jeden plik).
  function jakiObraz(p, ktory) {
    const obrazy = obrazyWProjekcie(p);
    if (obrazy.some(([id]) => id === ktory)) return ktory;
    const id = obrazZNazwy(p, ktory);
    if (id) return id;
    throw new BladBazy(`W projekcie nie ma obrazu „${ktory}”. Obrazy projektu: ${obrazy.map(([i, z]) => `${i} „${z.nazwa}”`).join(', ') || 'brak'} (nowy wgrasz narzędziem wgraj_obraz).`);
  }

  const opisMm = (o) => `${Math.round(o.width * o.scaleX * 10) / 10}×${Math.round(o.height * o.scaleY * 10) / 10} mm w miejscu ${Math.round(o.left * 10) / 10}, ${Math.round(o.top * 10) / 10} mm`;

  // Wstawia pojedynczy element obrazu – jak „Obraz → Wybierz z obrazów projektu” w aplikacji.
  const wstawObraz = (a) => zmien((p) => {
    const id = jakiObraz(p, a.obraz);
    const px = pikseleObrazu(p, id);
    if (!px) throw new BladBazy(`Nie znam wymiarów obrazu „${p.zasoby[id].nazwa}” (starszy obraz). Otwórz projekt raz w aplikacji – uzupełni je – albo wgraj plik jeszcze raz narzędziem wgraj_obraz.`);
    const m = miejsce(p, a.gdzie);
    const o = elementObrazu(id, p.zasoby[id].nazwa, px, wymiaryMiejsca(p, a.gdzie), a);
    const i = a.przed ? m.obiekty.findIndex((x) => x.id === a.przed) : -1;
    m.obiekty.splice(i >= 0 ? i : m.obiekty.length, 0, o);
    return { zmiany: m.zmiany(), opis: `Wstawiono obraz „${p.zasoby[id].nazwa}” jako element ${o.id} (${m.nazwa}): ${opisMm(o)}${o.cropX || o.cropY ? ', wypełnia ramkę z przycięciem' : ''}.` };
  });

  // Jeden obraz do projektu (przez funkcję bazy ai_wgraj_obraz). Zwraca wynik bazy.
  async function wgrajPlik(bajty, nazwa, { zastap = null } = {}) {
    if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
    let dane = bajty;
    let w = wymiaryObrazu(dane);
    if (!w) {
      const poczatek = new TextDecoder().decode(dane.subarray(0, 512)).trim().toLowerCase();
      if (poczatek.startsWith('<!doctype html') || poczatek.startsWith('<html') || poczatek.includes('<head')) {
        throw new BladBazy(`Pod tym adresem jest strona internetowa, a nie plik obrazu${nazwa ? ` („${nazwa}”)` : ''}. Podaj bezpośredni adres obrazu – na Dysku Google i w Dropboxie plik musi być udostępniony „każdemu, kto ma link”.`);
      }
      throw new BladBazy(`„${nazwa || 'plik'}” nie jest obrazem PNG, JPEG, WebP, GIF ani SVG (ani archiwum ZIP z takimi obrazami).`);
    }
    if (w.typ === 'image/svg+xml' && (!w.szer || !w.wys || !/<svg\b[^>]*\swidth\s*=[^>]*>/i.test(new TextDecoder().decode(dane.subarray(0, 16384))))) {
      dane = przygotujSvg(new TextDecoder().decode(dane));
      w = wymiaryObrazu(dane);
    }
    if (dane.length > MAKS_OBRAZ) throw new BladBazy(`„${nazwa || 'plik'}” jest za duży (najwyżej 25 MB).`);
    let idZastapionego = null;
    if (zastap) idZastapionego = jakiObraz((await pobierz()).projekt, zastap);
    const parametry = {
      p_klucz: KLUCZ, p_nazwa: nazwaPliku(nazwa, w.typ), p_typ: w.typ, p_szer: w.szer || null, p_wys: w.wys || null, p_zastap: idZastapionego,
    };
    const r = dane.length <= KAWALEK
      ? await rpc('ai_wgraj_obraz', { ...parametry, p_dane: naBase64(dane) })
      : await wgrajWKawalkach(dane, parametry);
    if (r?.blad) throw new BladBazy(r.blad);
    return r;
  }

  // Większy plik: jedno zapytanie z całym plikiem nie zdąży się zapisać w limicie czasu bazy (rola anon),
  // więc idzie w kawałkach po 512 KB – początek, kawałki (najwyżej 3 naraz, każdy z jednym ponowieniem), koniec.
  // Migracja 20261112150000_obrazy_ai_kawalki.sql.
  async function wgrajWKawalkach(dane, parametry) {
    const skrot = await skrotSha256(dane);
    const start = await rpc('ai_wgraj_poczatek', { ...parametry, p_rozmiar: dane.length, p_skrot: skrot });
    if (start?.blad || start?.byl) return start;
    const { wiersz, kawalek, czesci } = start;
    const wyslij = async (nr) => {
      const p = { p_klucz: KLUCZ, p_wiersz: wiersz, p_nr: nr, p_dane: naBase64(dane.subarray(nr * kawalek, (nr + 1) * kawalek)) };
      for (let proba = 0; ; proba += 1) {
        try {
          const w = await rpc('ai_wgraj_czesc', p);
          if (!w?.blad) return;
          if (proba >= 1) throw new BladBazy(w.blad);
        } catch (e) {
          if (proba >= 1) throw e;
        }
      }
    };
    const kolejka = Array.from({ length: czesci }, (_, i) => i);
    const robotnik = async () => { for (let nr = kolejka.shift(); nr !== undefined; nr = kolejka.shift()) await wyslij(nr); };
    await Promise.all(Array.from({ length: Math.min(3, czesci) }, robotnik));
    let koniec = await rpc('ai_wgraj_koniec', { p_klucz: KLUCZ, p_wiersz: wiersz });
    if (Array.isArray(koniec?.brakujace) && koniec.brakujace.length) {
      for (const nr of koniec.brakujace) await wyslij(nr);
      koniec = await rpc('ai_wgraj_koniec', { p_klucz: KLUCZ, p_wiersz: wiersz });
    }
    return koniec;
  }
  const opisWgranego = (r) => (r.byl
    ? `Ten sam obraz już był w projekcie jako „${r.nazwa}” (id ${r.id}) – nie dodałem drugiej kopii.`
    : `Wgrano „${r.nazwa}” (id ${r.id}${r.szer ? `, ${r.szer}×${r.wys} px` : ''})${r.nazwa_zmieniona ? ' – nazwa była zajęta albo bez rozszerzenia, więc dostała inną' : ''}${r.zastapiony ? `; zastąpił obraz ${r.zastapiony} – elementy pokazują teraz nowy plik` : ''}.`);

  // Pliki z dowolnego źródła → obrazy projektu. ZIP-y są rozpakowywane (tylko obrazy, z limitami).
  // Zwraca { wyniki: [{ nazwa, id?, byl?, blad? }], opisy: [tekst], ostatni }.
  async function wgrajPliki(pliki, { zastap = null } = {}) {
    const doWgrania = [];
    const opisy = [];
    for (const plik of pliki) {
      if (!czyZip(plik.bajty)) { doWgrania.push(plik); continue; }
      let r;
      try { r = await rozpakujZip(plik.bajty, LIMITY_ZIP); } catch (e) { throw new BladBazy(`Archiwum „${plik.nazwa || 'ZIP'}”: ${e.message}`); }
      if (!r.pliki.length) opisy.push(`Archiwum „${plik.nazwa || 'ZIP'}” nie ma obrazów PNG, JPEG, WebP, GIF ani SVG.`);
      if (r.pominiete.length) opisy.push(`Z archiwum „${plik.nazwa || 'ZIP'}” pominięto pliki, które nie są obrazami: ${r.pominiete.slice(0, 10).join(', ')}${r.pominiete.length > 10 ? '…' : ''}.`);
      doWgrania.push(...r.pliki);
    }
    if (doWgrania.length > LIMITY_ZIP.maksPlikow) throw new BladBazy(`To ${doWgrania.length} obrazów – naraz wgrywam najwyżej ${LIMITY_ZIP.maksPlikow}.`);
    if (doWgrania.length > 1 && zastap) throw new BladBazy('„zastap” działa tylko dla jednego obrazu.');
    if (!zastap) {
      const ile = obrazyWProjekcie((await pobierz()).projekt).length;
      if (ile + doWgrania.length > LIMIT_OBRAZOW_W_PROJEKCIE) {
        throw new BladBazy(`Projekt ma ${ile} obrazów, a limit jednego projektu to ${LIMIT_OBRAZOW_W_PROJEKCIE}. Usuń nieużywane obrazy (usun_obrazy z nieuzywane: true) albo wgraj mniej.`);
      }
    }
    const wyniki = [];
    let ostatni = null;
    for (const plik of doWgrania) {
      try {
        ostatni = await wgrajPlik(plik.bajty, plik.nazwa, { zastap });
        wyniki.push({ nazwa: ostatni.nazwa, id: ostatni.id, byl: Boolean(ostatni.byl), szer: ostatni.szer, wys: ostatni.wys });
        opisy.push(opisWgranego(ostatni));
      } catch (e) {
        if (doWgrania.length === 1) throw e;
        wyniki.push({ nazwa: plik.nazwa, blad: e.message });
        opisy.push(`„${plik.nazwa}”: ${e.message}`);
      }
    }
    return { wyniki, opisy, ostatni, ile: doWgrania.length };
  }

  // Bajty wysłane wprost (POST na adres łącznika …/obraz) – obraz albo ZIP.
  async function wgrajBajty(bajty, nazwa, { zastap = null } = {}) {
    if (bajty.length > MAKS_POBRANIE) throw new BladBazy('Plik jest za duży (najwyżej 50 MB; jeden obraz – 25 MB).');
    return wgrajPliki([{ bajty, nazwa }], { zastap });
  }

  // Zmiany obrazów w trzech krokach (patrz ai_zmien_obrazy w migracji 20261112090000_obrazy_ai.sql):
  // 1) nowe wpisy (kopie opisu pod nowym id i nazwą), 2) przepięcie elementów i komórek tabel (ai_zapisz),
  // 3) usunięcie starych wpisów. komorki(p) → [[tabela, wiersz, kolumna, nowa wartość]].
  async function zmienObrazy({ kopie = {}, przepiecia = new Map(), nazwy = new Map(), komorki = null, usun = [] }) {
    const wywolaj = async (parametry) => {
      const w = await rpc('ai_zmien_obrazy', { p_klucz: KLUCZ, ...parametry });
      if (w?.blad) throw new BladBazy(opisBledu(w));
    };
    if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
    if (Object.keys(kopie).length) await wywolaj({ p_kopie: kopie, p_usun: [] });
    if (przepiecia.size || komorki) {
      await zmien((p) => {
        const { strony, wzorce } = przepnijElementy(p, przepiecia, nazwy);
        const zmiany = {};
        if (strony.length) zmiany.strony = strony;
        if (wzorce) zmiany.wzorce = p.wzorce;
        const k = komorki ? komorki(p) : [];
        for (const [t, r, c, v] of k) t.wiersze[r][c] = v;
        if (k.length) zmiany.tabele = p.tabele;
        return { zmiany, opis: '' };
      });
    }
    if (usun.length) await wywolaj({ p_kopie: {}, p_usun: usun });
  }

  // Nazwa z rozszerzeniem: bez rozszerzenia – dostaje rozszerzenie dotychczasowej nazwy.
  const zRozszerzeniem = (nowa, stara) => {
    const n = String(nowa || '').split(/[\\/]/).pop().replace(/[\u0000-\u001f]/g, '').trim();
    if (!n) throw new BladBazy('Podaj nową nazwę.');
    return /\.[a-z0-9]{2,5}$/i.test(n) ? n : `${n}${/\.[a-z0-9]{2,5}$/i.exec(stara || '')?.[0] || ''}`;
  };
  const zajetaNazwa = (p, nazwa, bez = []) => obrazyWKolejnosci(p).some(([id, z]) => !bez.includes(id) && pelna(z.nazwa) === pelna(nazwa));

  // Powtórzenia jak w oknie „Obrazy projektu” (ta sama funkcja grupujPowtorzenia).
  const powtorzeniaWProjekcie = (p) => grupujPowtorzenia(
    obrazyWKolejnosci(p), Object.keys(p.zasoby || {}), (id) => obrazZNazwy(p, p.zasoby[id].nazwa) === id,
  );

  // Pliki ze źródła podanego w wywołaniu narzędzia: adres | svg | dane_base64 | plik (tylko u siebie).
  async function plikiZeZrodla(a) {
    const dozwolone = ['adres', 'svg', 'dane_base64', ...(plikiZCzatu ? ['pliki_z_czatu'] : []), ...(czytajPliki ? ['plik'] : [])];
    const podane = dozwolone.filter((k) => a[k] !== undefined && a[k] !== null && a[k] !== '');
    if (podane.length !== 1) throw new BladBazy(`Podaj dokładnie jedno źródło: ${dozwolone.join(', ')}.`);
    if (a.adres) {
      const b = bezposredniAdres(a.adres);
      if (b.blad) throw new BladBazy(b.blad);
      const { bajty, nazwa } = await pobierzAdres(b.adres);
      return [{ bajty, nazwa: a.nazwa || nazwa }];
    }
    if (a.pliki_z_czatu) {
      // Załączniki rozmowy przekazane przez aplikację AI (ChatGPT: _meta „openai/fileParams”) – obiekt pliku
      // z tymczasowym adresem do pobrania; łącznik pobiera plik sam, więc wielkość nie gra roli (limity jak dla adresu).
      const lista = (Array.isArray(a.pliki_z_czatu) ? a.pliki_z_czatu : [a.pliki_z_czatu]).filter(Boolean);
      if (!lista.length) throw new BladBazy('pliki_z_czatu jest puste.');
      if (lista.length > 50) throw new BladBazy('Najwyżej 50 plików z rozmowy naraz.');
      const pliki = [];
      for (const f of lista) {
        const adres = typeof f === 'string' ? f : f.download_url;
        if (!adres) throw new BladBazy('Plik z rozmowy bez adresu do pobrania (download_url) – aplikacja AI nie przekazała pliku; daj użytkownikowi link z link_do_wgrywania.');
        const { bajty, nazwa } = await pobierzAdres(adres);
        pliki.push({ bajty, nazwa: (typeof f === 'object' && f.file_name) || nazwa });
      }
      if (pliki.length === 1 && a.nazwa) pliki[0].nazwa = a.nazwa;
      return pliki;
    }
    if (a.svg) return [{ bajty: przygotujSvg(a.svg), nazwa: a.nazwa || 'rysunek.svg' }];
    if (a.dane_base64) {
      const bajty = zBase64(a.dane_base64);
      if (bajty.length > MAKS_BASE64) throw new BladBazy('Przez dane_base64 przyjmuję pliki do 5 MB – większy podaj jako adres albo przez link_do_wgrywania.');
      return [{ bajty, nazwa: a.nazwa || 'obraz' }];
    }
    let pliki;
    try { pliki = await czytajPliki(Array.isArray(a.plik) ? a.plik : [a.plik]); } catch (e) { throw new BladBazy(e.message); }
    if (pliki.length === 1 && a.nazwa) pliki[0].nazwa = a.nazwa;
    return pliki;
  }

  const opisZakresu = (d) => `${d.zakres === 'pelny' ? 'pełny dostęp – wszystkie projekty konta' : 'wybrane projekty'}, ${d.rola === 'edycja' ? 'czyta i zmienia' : 'tylko czyta'}${d.tworzenie ? '; możesz tworzyć i usuwać projekty (nowy_projekt, kopiuj_projekt, usun_projekt)' : ''}`;
  const NARZEDZIA = [
    {
      name: 'projekty',
      title: 'Projekty',
      description: 'Lista projektów, do których prowadzi klucz: id, nazwa, właściciel (Twoje albo udostępnione przez kogoś), czy możesz je zmieniać, ostatnia zmiana. Zacznij od tego – id albo nazwę podajesz potem jako „projekt” w innych narzędziach.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => {
        const { dostep, projekty } = await projektyKlucza();
        const linie = projekty.map((x) => `- ${x.id} „${x.nazwa}” – ${x.wlasciciel === 'ja' ? 'Twój' : `udostępnił(a): ${x.wlasciciel}`}, ${x.rola === 'edycja' ? 'możesz zmieniać' : 'tylko czytasz'}, zmieniono ${String(x.zmieniono || '').slice(0, 16).replace('T', ' ')}`);
        return [`Klucz: ${opisZakresu(dostep)}${dostep.opis ? ` („${dostep.opis}”)` : ''}.`, projekty.length ? `Projekty (${projekty.length}):` : 'Klucz nie prowadzi jeszcze do żadnego projektu.', ...linie].join('\n');
      },
    },
    {
      name: 'nowy_projekt',
      title: 'Nowy projekt',
      description: 'Tworzy nowy, pusty projekt na koncie – jak „Nowy projekt” w aplikacji: jedna sekcja z formatem, marginesami i spadem, jedna pusta strona, standardowe style tekstu. Tylko klucz z pełnym dostępem, który czyta i zmienia. Projekt pojawia się od razu na liście projektów właściciela. Dalej pracuj na nim, podając projekt (id z wyniku).',
      inputSchema: S('', {
        nazwa: tekst('Nazwa projektu'),
        format: { type: 'string', enum: ['A4', 'A5', 'A6', 'B5', 'Kwadrat', 'wlasny'], description: 'Format strony (domyślnie A5); „wlasny” – podaj szerokosc i wysokosc w mm.' },
        szerokosc: { type: 'number', description: 'mm – tylko dla formatu „wlasny”' },
        wysokosc: { type: 'number', description: 'mm – tylko dla formatu „wlasny”' },
        orientacja: { type: 'string', enum: ['pion', 'poziom'] },
        uklad: { type: 'string', enum: ['pojedyncze', 'rozkladowki'], description: 'Pojedyncze strony albo rozkładówki (marginesy lustrzane).' },
        spad: { type: 'number', description: 'Spad w mm (domyślnie 3)' },
        marginesy: { type: 'number', description: 'Marginesy w mm (domyślnie 10)' },
      }, ['nazwa']),
      dzialaj: async (a) => {
        const p = pustyProjekt(a);
        const { strony, ...dane } = p;
        const w = await rpc('ai_nowy_projekt', { p_klucz: KLUCZ_KONTA, p_id: p.id, p_nazwa: String(a.nazwa || '').trim(), p_dane: dane, p_strony: strony });
        if (w?.blad) throw new BladBazy(w.blad);
        const s = p.sekcje[0];
        return `Utworzono projekt „${w.nazwa}” (id ${w.id}): ${s.wydruk.szerokosc_mm}×${s.wydruk.wysokosc_mm} mm, ${s.uklad}, spad ${s.wydruk.spad_mm} mm, marginesy ${s.wydruk.marginesy.gora} mm; jedna pusta strona ${strony[0].id}, sekcja ${s.id}. Pracuj na nim z projekt="${w.id}" (zacznij od przeglad_projektu).`;
      },
    },
    {
      name: 'kopiuj_projekt',
      title: 'Kopiuj projekt',
      description: 'Tworzy kopię całego projektu na koncie – jak „Duplikuj” w aplikacji: wszystkie strony, sekcje, wzorce, style, tabele i obrazy. Tylko klucz z pełnym dostępem, który czyta i zmienia, i tylko własny projekt konta. nazwa – opcjonalnie (domyślnie „<nazwa> (kopia)”). Kopia pojawia się od razu na liście projektów; obrazy z folderu konta kopia dostaje na własność przy pierwszym otwarciu w aplikacji. Dalej pracuj na kopii, podając projekt (id z wyniku).',
      inputSchema: S('', { projekt: tekst('id albo nazwa projektu do skopiowania'), nazwa: tekst('Nazwa kopii (opcjonalnie)') }, ['projekt']),
      dzialaj: async ({ projekt, nazwa }) => {
        const id = await jakiProjekt(projekt);
        const w = await rpc('ai_kopiuj_projekt', { p_klucz: KLUCZ_KONTA, p_projekt: id, p_nowy: globalThis.crypto.randomUUID(), p_nazwa: String(nazwa || '').trim() });
        if (w?.blad) throw new BladBazy(w.blad);
        return `Utworzono kopię „${w.nazwa}” (id ${w.id}): ${w.stron} stron, ${w.obrazy} obrazów. Pracuj na niej z projekt="${w.id}".`;
      },
    },
    {
      name: 'usun_projekt',
      title: 'Usuń projekt',
      description: 'Usuwa cały projekt z konta – nieodwracalnie. Tylko klucz z pełnym dostępem i tylko projekt właściciela klucza (nie udostępniony przez kogoś). Wymaga potwierdzenia: „potwierdz” to dokładna nazwa projektu.',
      inputSchema: S('', { projekt: tekst('id albo nazwa projektu'), potwierdz: tekst('Dokładna nazwa projektu – potwierdzenie') }, ['projekt', 'potwierdz']),
      dzialaj: async ({ projekt, potwierdz }) => {
        const id = await jakiProjekt(projekt);
        const w = await rpc('ai_usun_projekt', { p_klucz: KLUCZ_KONTA, p_projekt: id, p_potwierdz: potwierdz });
        if (w?.blad) throw new BladBazy(w.blad);
        return `Usunięto projekt „${w.nazwa}” (id ${w.usunieto}). Zniknął z listy projektów właściciela; pliki projektu aplikacja posprząta sama.`;
      },
    },
    {
      name: 'przeglad_projektu',
      title: 'Przegląd projektu',
      description: 'Krótki opis projektu: sekcje, strony z elementami (id, rodzaj, początek tekstu), wzorce, style, tabele, serie, obrazy. Zacznij od tego – stąd są identyfikatory do pozostałych narzędzi.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => przeglad(await pobierz()),
    },
    {
      name: 'czytaj',
      title: 'Czytaj część projektu',
      description: 'Pełny JSON jednej części projektu: strony, wzorca, sekcji, stylu, tabeli albo serii (po id), albo całego projektu (co="projekt"; może być duży).',
      inputSchema: S('', { co: { type: 'string', enum: ['strona', 'wzorzec', 'sekcja', 'styl', 'tabela', 'seria', 'widok', 'projekt'] }, id: tekst('Identyfikator (nie dotyczy „widok” i „projekt”).') }, ['co']),
      readOnly: true,
      dzialaj: async ({ co, id }) => {
        const { projekt, wersja } = await pobierz();
        const listy = { strona: 'strony', wzorzec: 'wzorce', sekcja: 'sekcje', styl: 'style', tabela: 'tabele', seria: 'serie' };
        const wynik = co === 'projekt' ? projekt : co === 'widok' ? projekt.widok || {} : znajdz(projekt[listy[co]], id, co === 'strona' ? 'strony' : co);
        return `Wersja projektu ${wersja}.\n${JSON.stringify(wynik, null, 1)}`;
      },
    },
    {
      name: 'zmien_elementy',
      title: 'Zmień elementy',
      description: 'Zmienia pola elementów (po id) na stronie albo we wzorcu – np. tekst, kolor (fill), położenie (left, top w mm), rozmiar pisma (fontSize w mm), z_danych, pole, ksztalt_tekstu (tekst po łuku, okręgu, ścieżce albo wygięty), link (adres klikalny w PDF do czytania na ekranie). Podawaj tylko zmieniane pola; null usuwa pole.',
      inputSchema: S('', { gdzie: GDZIE, zmiany: { type: 'array', items: S('', { id: tekst('id elementu'), pola: obiekt('Pola do zmiany') }, ['id', 'pola']) } }, ['gdzie', 'zmiany']),
      dzialaj: ({ gdzie, zmiany }) => zmien((p) => {
        const m = miejsce(p, gdzie);
        for (const z of zmiany) scal(znajdz(m.obiekty, z.id, 'elementu'), z.pola);
        return { zmiany: m.zmiany(), opis: `Zmieniono ${zmiany.length} el. (${m.nazwa}).` };
      }),
    },
    {
      name: 'dodaj_elementy',
      title: 'Dodaj elementy',
      description: 'Dodaje elementy (JSON elementów jak w opisie formatu: textbox, rect, ellipse, line, path, polygon, image z istniejącym zasobem, group/tabela, kod – kod QR albo EAN-13/ISBN: { type: "kod", rodzaj: "qr"|"ean", tresc, szerokosc, left, top }; skrótem także kalendarz miesiąca { type: "kalendarz", left, top, width, kalendarz: { rok, miesiac, pole_daty } }, wykres { type: "wykres", left, top, wykres: { rodzaj, tabela, etykiety, wartosci } } kolaż { type: "kolaz", left, top, kolaz: { uklad, odstep, szerokosc, wysokosc } }, dymek { type: "dymek", tekst, left, top, ogonek: { x, y } (punkt na stronie, w który celuje), rodzaj: "mowa"|"mysl"|"krzyk"|"szept"|"narracja" } – dymek rośnie z tekstem, spis treści { type: "spis", left, top, width, poziomy } i skorowidz { type: "skorowidz", left, top, width }) na stronę albo do wzorca. Bez id – nadam. Nowe elementy trafiają na wierzch, chyba że podasz „przed” (id elementu).',
      inputSchema: S('', { gdzie: GDZIE, elementy: { type: 'array', items: obiekt('Element') }, przed: tekst('id elementu, przed którym wstawić (niżej w warstwach)') }, ['gdzie', 'elementy']),
      dzialaj: ({ gdzie, elementy, przed }) => zmien((p) => {
        const m = miejsce(p, gdzie);
        const nowe = elementy.map(przygotujElement);
        const i = przed ? m.obiekty.findIndex((o) => o.id === przed) : -1;
        m.obiekty.splice(i >= 0 ? i : m.obiekty.length, 0, ...nowe);
        return { zmiany: m.zmiany(), opis: `Dodano ${nowe.length} el. (${m.nazwa}): ${nowe.map((o) => o.id).join(', ')}.` };
      }),
    },
    {
      name: 'obrazy_projektu',
      title: 'Obrazy projektu',
      description: 'Lista obrazów projektu (to samo co okno „Obrazy projektu” w aplikacji): id, nazwa z rozszerzeniem, wymiary w pikselach i gdzie obraz jest użyty (strony, wzorce, dane w tabelach, albo „nieużywany”), do tego powtórzenia (kopie tego samego pliku, powtórzone nazwy). Nazwy wpisuje się w kolumny tabel danych.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => {
        const { projekt } = await pobierz();
        const obrazy = obrazyWProjekcie(projekt);
        if (!obrazy.length) return 'Projekt nie ma jeszcze obrazów. Wgrasz je narzędziem wgraj_obraz (adres https, link z Dysku Google albo Dropboxa, kod SVG, małe dane w base64) albo daj użytkownikowi link z narzędzia link_do_wgrywania.';
        const linie = [`Obrazy projektu (${obrazy.length}):`, ...obrazy.map(([id, z]) => {
          const px = pikseleObrazu(projekt, id);
          return `- ${id} „${z.nazwa}”${px ? ` ${px.szer}×${px.wys} px` : ''}${z.rozmiar ? `, ${Math.max(1, Math.round(z.rozmiar / 1024))} kB` : ''} – ${uzyciaObrazu(projekt, id)}`;
        })];
        const { kopie, nazwy } = powtorzeniaWProjekcie(projekt);
        const nazwa = (id) => `„${projekt.zasoby[id].nazwa}”`;
        if (kopie.length) linie.push(`Kopie tego samego pliku: ${kopie.map(([z, k]) => `${nazwa(z)} = ${k.map(nazwa).join(', ')}`).join('; ')}.`);
        if (nazwy.length) linie.push(`Ta sama nazwa, inna treść: ${nazwy.map(([z, k]) => `${nazwa(z)} (${k.length + 1}×)`).join('; ')}.`);
        if (kopie.length || nazwy.length) linie.push('Narzędzie uporzadkuj_obrazy scali kopie i nada powtórzonym nazwom dopisek „(2)” – tak jak „Uporządkuj” w aplikacji.');
        const bezSkrotu = obrazy.filter(([, z]) => !z.skrot).length;
        if (bezSkrotu) linie.push(`(${bezSkrotu} starszych obrazów nie ma jeszcze skrótu treści – kopie wśród nich wykryje dopiero okno „Obrazy projektu” w aplikacji.)`);
        return linie.join('\n');
      },
    },
    {
      name: 'wgraj_obraz',
      title: 'Wgraj obrazy do projektu',
      meta: plikiZCzatu ? { 'openai/fileParams': ['pliki_z_czatu'] } : null, // tylko ChatGPT: załączniki rozmowy (adres do pobrania)
      description: `Wgrywa obraz albo archiwum ZIP z obrazami do projektu (trafiają do okna „Obrazy projektu” u właściciela, na żywo). Podaj dokładnie jedno źródło:
- adres – plik w internecie (https). Działa też link udostępniania z Dysku Google („każdy, kto ma link”, pojedynczy plik albo ZIP) i z Dropboxa (plik albo folder – Dropbox odda folder jako ZIP).
- svg – rysunek, który sam piszesz (ozdobniki, ikony, ramki); potrzebny viewBox albo width/height; bez skryptów.
- dane_base64 – tylko małe pliki (do ok. 200 kB); większe są za drogie do przepisania.${plikiZCzatu ? '\n- pliki_z_czatu – załączniki rozmowy (ChatGPT podaje je sam); dowolna wielkość.' : ''}${czytajPliki ? '\n- plik – ścieżka na dysku tego komputera albo lista ścieżek; folder = wszystkie obrazy i ZIP-y w nim (najwyżej 50 plików).' : ''}
Obsługiwane: PNG, JPEG, WebP, GIF, SVG; obraz do 25 MB, pobierany plik do 50 MB, ZIP do 100 obrazów. Ten sam plik drugi raz nie wchodzi (wynik wskaże obraz, który już jest); zajęta nazwa dostaje dopisek „(2)”. zastap (id albo nazwa) – podmienia ten obraz projektu na nowy plik. wstaw – od razu wstawia obraz jako pojedynczy element (tylko dla jednego obrazu).`,
      inputSchema: S('', {
        nazwa: tekst('Nazwa pliku z rozszerzeniem, np. „choinka.svg” (domyślnie z adresu albo pliku).'),
        adres: tekst('Adres https pliku (obraz albo ZIP), także link z Dysku Google albo Dropboxa.'),
        svg: tekst('Kod rysunku SVG.'),
        dane_base64: tekst('Treść małego pliku w base64 (z nagłówkiem data: albo bez).'),
        ...(plikiZCzatu ? { pliki_z_czatu: {
          type: 'array',
          description: 'Zdjęcia albo ZIP-y, które użytkownik wrzucił do rozmowy – gdy aplikacja AI przekazuje załączniki narzędziom (ChatGPT). Każdy: { download_url, file_id, mime_type?, file_name? }.',
          items: { type: 'object', properties: { download_url: { type: 'string' }, file_id: { type: 'string' }, mime_type: { type: 'string' }, file_name: { type: 'string' } } },
        } } : {}),
        ...(czytajPliki ? { plik: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'Ścieżka pliku albo folderu na tym komputerze (może zaczynać się od ~/), albo lista ścieżek.' } } : {}),
        zastap: tekst('id albo nazwa obrazu, który ten plik zastępuje.'),
        wstaw: obiekt('Opcjonalnie: { gdzie (id strony albo wzorca), x?, y?, szerokosc?, wysokosc? (mm), dopasowanie? (zmiesc | wypelnij) }.'),
      }),
      dzialaj: async (a) => {
        const { wyniki, opisy, ostatni } = await wgrajPliki(await plikiZeZrodla(a), { zastap: a.zastap || null });
        if (a.wstaw) {
          if (wyniki.length !== 1 || !ostatni) throw new BladBazy(`${opisy.join('\n')}\n„wstaw” działa tylko dla jednego obrazu – wstaw je narzędziem wstaw_obraz.`);
          opisy.push(await wstawObraz({ ...a.wstaw, obraz: ostatni.id }));
        }
        return opisy.join('\n');
      },
    },
    {
      name: 'link_do_wgrywania',
      title: 'Link do wgrania obrazów',
      description: 'Link do aplikacji, który otwiera ten projekt od razu z oknem „Obrazy projektu”. Użytkownik wgrywa tam przyciskiem „Wgraj obrazy…” zdjęcia, które ma u siebie (z komputera, z telefonu, z załącznika rozmowy, archiwum ZIP, dowolnej wielkości); trafiają do obrazów projektu. Link wymaga zalogowania na konto właściciela.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => {
        const { projekt } = await pobierz();
        return `Link do wgrania obrazów (otwiera projekt „${projekt.nazwa}” z oknem „Obrazy projektu”):\n${ADRES_APLIKACJI}#/p/${projekt.id}/obrazy\nUżytkownik wybiera tam „Wgraj obrazy…” (zdjęcia albo ZIP). Gdy nazwa pliku już jest w projekcie, okno pyta: „Zastąp” z zaznaczonym „Tak samo dla pozostałych plików o powtórzonych nazwach” podmienia wszystkie w miejscu – strony, wzorce i dane pokazują od razu nowe pliki, bez „(2)” i bez przepinania. Powiedz mu to, jeśli wymieniacie obrazy. Potem sprawdź obrazy_projektu.`;
      },
    },
    {
      name: 'wstaw_obraz',
      title: 'Wstaw obraz na stronę',
      description: 'Wstawia obraz z projektu (id albo nazwa obrazu) jako pojedynczy element na stronę albo do wzorca – jak „Obraz → Wybierz z obrazów projektu” w aplikacji. Wymiary w mm. Bez rozmiaru: 60% strony, na środku. Sama szerokosc albo sama wysokosc: proporcje obrazu zachowane. szerokosc i wysokosc razem to ramka: dopasowanie „zmiesc” (cały obraz w ramce, domyślnie) albo „wypelnij” (wypełnia ramkę, brzegi przycięte wokół środka). x, y – lewy górny róg (ramki); bez nich – na środku strony.',
      inputSchema: S('', {
        obraz: tekst('id albo nazwa obrazu projektu'), gdzie: GDZIE,
        x: { type: 'number', description: 'mm od lewej krawędzi strony' }, y: { type: 'number', description: 'mm od górnej krawędzi strony' },
        szerokosc: { type: 'number', description: 'mm' }, wysokosc: { type: 'number', description: 'mm' },
        dopasowanie: { type: 'string', enum: ['zmiesc', 'wypelnij'] }, przed: tekst('id elementu, przed którym wstawić (niżej w warstwach)'),
      }, ['obraz', 'gdzie']),
      dzialaj: (a) => wstawObraz(a),
    },
    {
      name: 'zmien_nazwe_obrazu',
      title: 'Zmień nazwę obrazu',
      description: 'Zmienia nazwę obrazu projektu – jak w oknie „Obrazy projektu”. Nazwa musi być wolna (wielkość liter bez znaczenia); bez rozszerzenia dostaje dotychczasowe. Elementy na stronach dalej pokazują ten obraz, a komórki tabel danych, które wskazywały go starą nazwą, dostają nową.',
      inputSchema: S('', { obraz: tekst('id albo nazwa obrazu'), nazwa: tekst('Nowa nazwa, np. „styczen.jpg”') }, ['obraz', 'nazwa']),
      dzialaj: async ({ obraz, nazwa }) => {
        const { projekt } = await pobierz();
        const id = jakiObraz(projekt, obraz);
        const stara = projekt.zasoby[id].nazwa;
        const nowa = zRozszerzeniem(nazwa, stara);
        if (nowa === stara) return `Obraz już nazywa się „${stara}”.`;
        if (zajetaNazwa(projekt, nowa, [id])) throw new BladBazy(`Nazwa „${nowa}” jest już zajęta przez inny obraz – wybierz inną.`);
        const nid = noweId('z');
        const ileKomorek = komorkiObrazu(projekt, id).length;
        await zmienObrazy({
          kopie: { [nid]: { z: id, nazwa: nowa } },
          przepiecia: new Map([[id, nid]]),
          nazwy: new Map([[nid, nowa]]),
          komorki: (p) => komorkiObrazu(p, id).map(([t, r, c]) => [t, r, c, nowa]),
          usun: [id],
        });
        return `Nowa nazwa: „${stara}” → „${nowa}” (id ${nid}).${ileKomorek ? ` Komórki tabel z tą nazwą: ${ileKomorek} – zmienione.` : ''}`;
      },
    },
    {
      name: 'podmien_obraz',
      title: 'Podmień plik obrazu',
      description: 'Podmienia plik obrazu projektu na nowy – jak „Podmień plik” w oknie „Obrazy projektu”: elementy na stronach i dane w tabelach pokazują od teraz nowy plik, nazwa zostaje, stary plik znika. Źródło: adres (https), svg albo dane_base64' + (czytajPliki ? ', albo plik' : '') + '; jeden obraz.',
      inputSchema: S('', {
        obraz: tekst('id albo nazwa obrazu, który podmieniasz'),
        adres: tekst('Adres https nowego pliku (także Dysk Google, Dropbox).'),
        svg: tekst('Kod rysunku SVG.'),
        dane_base64: tekst('Treść małego pliku w base64.'),
        ...(czytajPliki ? { plik: tekst('Ścieżka pliku na tym komputerze.') } : {}),
      }, ['obraz']),
      dzialaj: async (a) => {
        const { opisy } = await wgrajPliki(await plikiZeZrodla({ ...a, nazwa: null }), { zastap: a.obraz });
        return opisy.join('\n');
      },
    },
    {
      name: 'wgraj_czesciami',
      title: 'Wgraj plik kawałkami (base64)',
      description: `Wgrywa obraz, który masz u siebie (plik w miejscu roboczym, załącznik w piaskownicy), gdy nie możesz go podać inaczej: nie ma adresu w internecie, a Twoje środowisko nie łączy się z bazą. Plik idzie w kawałkach base64 w kolejnych wywołaniach tego narzędzia, a łącznik składa je po swojej stronie. Każdy bajt przechodzi przez rozmowę, więc to droga dla grafik do kilkuset KB.
Kroki:
1. krok="start": nazwa (z rozszerzeniem), rozmiar (bajty), sha256 (skrót SHA-256 treści, 64 znaki hex), kawalek (bajty, od 16384 do 524288; zalecane 49152), opcjonalnie szer, wys (px), zastap (id albo nazwa obrazu do podmiany – strony pokazują od razu nowy plik). Wynik: id wgrania i liczba kawałków. Ten sam plik już w projekcie – wynik od razu to powie.
2. krok="czesc": wgranie, nr (od 0), dane_base64 – bajty od nr×kawalek, długości kawalek (ostatni krótszy). Kolejność dowolna, powtórzenie zastępuje.
3. krok="koniec": wgranie – sprawdzam komplet i rozmiar; obraz trafia do obrazów projektu. Brakujące kawałki wymienię.
ZIP rozpakuj u siebie i wgraj obrazy po kolei. Wgranie niedokończone przez dobę znika.`,
      inputSchema: S('', {
        krok: { type: 'string', enum: ['start', 'czesc', 'koniec'] },
        nazwa: tekst('start: nazwa pliku z rozszerzeniem (png, jpg, webp, gif, svg).'),
        rozmiar: { type: 'integer', description: 'start: rozmiar pliku w bajtach' },
        sha256: tekst('start: SHA-256 treści pliku, 64 znaki szesnastkowe.'),
        kawalek: { type: 'integer', description: 'start: wielkość kawałka w bajtach (16384–524288, domyślnie 49152)' },
        szer: { type: 'integer', description: 'start: szerokość w px (opcjonalnie)' },
        wys: { type: 'integer', description: 'start: wysokość w px (opcjonalnie)' },
        zastap: tekst('start: id albo nazwa obrazu, który ten plik zastępuje (opcjonalnie).'),
        wgranie: tekst('czesc, koniec: id wgrania z kroku start.'),
        nr: { type: 'integer', description: 'czesc: numer kawałka od 0' },
        dane_base64: tekst('czesc: kawałek pliku w base64.'),
      }, ['krok']),
      dzialaj: async (a) => {
        if (a.krok === 'start') {
          const roz = /\.([a-z0-9]+)$/i.exec(String(a.nazwa || ''))?.[1]?.toLowerCase();
          const typ = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }[roz];
          if (!typ) throw new BladBazy('Podaj nazwę z rozszerzeniem obrazu: png, jpg, webp, gif albo svg.');
          const zastap = a.zastap ? jakiObraz((await pobierz()).projekt, a.zastap) : null;
          const r = await rpc('ai_wgraj_poczatek', {
            p_klucz: KLUCZ, p_nazwa: String(a.nazwa).trim(), p_typ: typ, p_rozmiar: a.rozmiar, p_skrot: String(a.sha256 || '').toLowerCase(),
            p_szer: a.szer || null, p_wys: a.wys || null, p_zastap: zastap, p_kawalek: a.kawalek || 49152,
          });
          if (r?.blad) throw new BladBazy(r.blad);
          if (r?.byl) return opisWgranego(r);
          return `Wgranie ${r.wiersz}: ${r.czesci} kawałków po ${r.kawalek} bajtów (ostatni krótszy). Wyślij je krokiem "czesc" (wgranie="${r.wiersz}", nr 0–${r.czesci - 1}), potem krok "koniec".`;
        }
        if (!a.wgranie) throw new BladBazy('Podaj wgranie (id z kroku start).');
        if (a.krok === 'czesc') {
          if (!Number.isInteger(a.nr)) throw new BladBazy('Podaj nr kawałka (od 0).');
          const r = await rpc('ai_wgraj_czesc', { p_klucz: KLUCZ, p_wiersz: a.wgranie, p_nr: a.nr, p_dane: String(a.dane_base64 || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '') });
          if (r?.blad) throw new BladBazy(r.blad);
          return `Kawałek ${a.nr} przyjęty.`;
        }
        if (a.krok !== 'koniec') throw new BladBazy('krok: start, czesc albo koniec.');
        const r = await rpc('ai_wgraj_koniec', { p_klucz: KLUCZ, p_wiersz: a.wgranie });
        if (Array.isArray(r?.brakujace) && r.brakujace.length) throw new BladBazy(`Brakuje kawałków: ${r.brakujace.join(', ')} – wyślij je i zakończ jeszcze raz.`);
        if (r?.blad) throw new BladBazy(r.blad);
        return opisWgranego(r);
      },
    },
    {
      name: 'adres_do_wysylki',
      title: 'Adres do wysyłki plików',
      description: 'Adres, pod który wysyłasz plik obrazu albo ZIP wprost z własnego środowiska (wykonywanie kodu, miejsce robocze z plikami): POST z treścią pliku na <adres>?nazwa=plik.jpg (opcjonalnie &zastap=<id albo nazwa> – podmiana użytego obrazu). Dowolna wielkość do limitów (obraz 25 MB, plik 50 MB), plik nie przechodzi przez rozmowę. Działa tylko, gdy środowisko łączy się z hostem adresu (np. własny skrypt użytkownika). Adres zawiera klucz dostępu.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => `POST ${ADRES_LACZNIKA}/${KLUCZ_KONTA}/obraz?projekt=${(await pobierz()).projekt.id}&nazwa=<nazwa z rozszerzeniem>[&zastap=<id albo nazwa obrazu do podmiany>]
Treść żądania: bajty pliku (obraz albo ZIP). Odpowiedź JSON: {"wgrane":[{"nazwa","id","szer","wys","byl"}],"opis"} albo {"blad"}.
Przykład: curl -X POST --data-binary @styczen.jpg "${ADRES_LACZNIKA}/${KLUCZ_KONTA}/obraz?projekt=${(await pobierz()).projekt.id}&nazwa=styczen.jpg"
Host: ${new URL(ADRES_LACZNIKA).hostname}`,
    },
    {
      name: 'usun_obrazy',
      title: 'Usuń obrazy z projektu',
      description: 'Usuwa obrazy z projektu (id albo nazwy) – jak „Usuń” w oknie „Obrazy projektu”. Usuwa tylko obrazy nieużywane: obraz, który jest na stronie, we wzorcu albo w danych tabeli, zostaje, a wynik mówi, gdzie jest użyty. nieuzywane: true – usuwa wszystkie nieużywane obrazy. Plik znika też z konta właściciela.',
      inputSchema: S('', { obrazy: { type: 'array', items: { type: 'string' }, description: 'id albo nazwy obrazów' }, nieuzywane: { type: 'boolean' } }),
      dzialaj: async ({ obrazy = [], nieuzywane = false }) => {
        const { projekt } = await pobierz();
        const ids = nieuzywane ? obrazyWProjekcie(projekt).map(([id]) => id) : [...new Set(obrazy.map((o) => jakiObraz(projekt, o)))];
        if (!ids.length) return nieuzywane ? 'Projekt nie ma obrazów.' : 'Podaj obrazy do usunięcia albo nieuzywane: true.';
        const zostaja = [];
        const usuwane = [];
        for (const id of ids) {
          const u = uzycia(projekt, id);
          if (u.uzyty) zostaja.push(`„${projekt.zasoby[id].nazwa}” – ${u.opis}`); else usuwane.push(id);
        }
        if (usuwane.length) await zmienObrazy({ usun: usuwane });
        const linie = [];
        if (usuwane.length) linie.push(`Usunięto ${usuwane.length}: ${usuwane.map((id) => `„${projekt.zasoby[id].nazwa}”`).join(', ')}.`);
        else linie.push(nieuzywane ? 'Nie ma nieużywanych obrazów.' : 'Nic nie usunięto.');
        if (zostaja.length && !nieuzywane) linie.push(`Zostały, bo są użyte (najpierw usuń je ze stron i z danych): ${zostaja.join('; ')}.`);
        return linie.join('\n');
      },
    },
    {
      name: 'uporzadkuj_obrazy',
      title: 'Uporządkuj obrazy',
      description: 'Porządkuje obrazy projektu jak „Uporządkuj” w oknie „Obrazy projektu”: kopie tego samego pliku stają się jednym obrazem (elementy zostają na miejscu, komórki tabel dostają nazwę obrazu, który zostaje), a obrazy o tej samej nazwie i innej treści dostają dopisek „(2)” (dane pokazują ten sam obraz co dotąd).',
      inputSchema: S('', {}),
      dzialaj: async () => {
        const { projekt } = await pobierz();
        const { kopie, nazwy } = powtorzeniaWProjekcie(projekt);
        if (!kopie.length && !nazwy.length) return 'Obrazy są uporządkowane – nie ma kopii ani powtórzonych nazw.';
        const zajete = new Set(obrazyWKolejnosci(projekt).map(([, z]) => pelna(z.nazwa)));
        const nowe = {};
        const przepiecia = new Map();
        const nazwyNowe = new Map();
        for (const [, inne] of nazwy) {
          for (const id of inne) {
            const wolna = wolnaNazwaWsrod(projekt.zasoby[id].nazwa, (n) => zajete.has(pelna(n)));
            zajete.add(pelna(wolna));
            const nid = noweId('z');
            nowe[nid] = { z: id, nazwa: wolna };
            przepiecia.set(id, nid);
            nazwyNowe.set(nid, wolna);
          }
        }
        for (const [zostaje, k] of kopie) for (const kopia of k) przepiecia.set(kopia, zostaje);
        await zmienObrazy({
          kopie: nowe,
          przepiecia,
          nazwy: nazwyNowe,
          // Komórki wskazujące kopię jej nazwą dostają nazwę obrazu, który zostaje.
          komorki: (p) => kopie.flatMap(([zostaje, k]) => k.flatMap((kopia) => komorkiObrazu(p, kopia).map(([t, r, c]) => [t, r, c, p.zasoby[zostaje].nazwa]))),
          usun: [...kopie.flatMap(([, k]) => k), ...Object.values(nowe).map((x) => x.z)],
        });
        const ileKopii = kopie.reduce((n, [, k]) => n + k.length, 0);
        return `Uporządkowano obrazy: ${[ileKopii ? `scalone kopie: ${ileKopii}` : '', Object.keys(nowe).length ? `nowe nazwy: ${Object.values(nowe).map((x) => `„${x.nazwa}”`).join(', ')}` : ''].filter(Boolean).join('; ')}.`;
      },
    },
    {
      name: 'usun_elementy',
      title: 'Usuń elementy',
      description: 'Usuwa elementy (po id) ze strony albo ze wzorca.',
      inputSchema: S('', { gdzie: GDZIE, id: { type: 'array', items: { type: 'string' } } }, ['gdzie', 'id']),
      dzialaj: ({ gdzie, id }) => zmien((p) => {
        const m = miejsce(p, gdzie);
        for (const x of id) znajdz(m.obiekty, x, 'elementu');
        const zostaja = m.obiekty.filter((o) => !id.includes(o.id));
        m.obiekty.splice(0, m.obiekty.length, ...zostaja);
        return { zmiany: m.zmiany(), opis: `Usunięto ${id.length} el. (${m.nazwa}).` };
      }),
    },
    {
      name: 'wyrownaj_elementy',
      title: 'Wyrównaj elementy',
      description: 'Wyrównuje elementy (po id) na stronie albo we wzorcu – jak przyciski wyrównania w edytorze. do: lewo | srodek | prawo | gora | srodek_pionowo | dol. wzgledem: elementy (do skrajnego z zaznaczonych, domyślnie; przy jednym elemencie – do strony) albo strona. Liczy prostokąt elementu bez obrotu.',
      inputSchema: S('', {
        gdzie: GDZIE, id: { type: 'array', items: { type: 'string' } },
        do: { type: 'string', enum: ['lewo', 'srodek', 'prawo', 'gora', 'srodek_pionowo', 'dol'] },
        wzgledem: { type: 'string', enum: ['elementy', 'strona'] },
      }, ['gdzie', 'id', 'do']),
      dzialaj: ({ gdzie, id, do: kierunek, wzgledem = 'elementy' }) => zmien((p) => {
        const m = miejsce(p, gdzie);
        const el = id.map((x) => znajdz(m.obiekty, x, 'elementu'));
        const ramki = el.map(ramkaElementu);
        const { szer, wys } = wymiaryMiejsca(p, gdzie);
        const doStrony = wzgledem === 'strona' || el.length === 1;
        const lewo = doStrony ? 0 : Math.min(...ramki.map((r) => r.x));
        const prawo = doStrony ? szer : Math.max(...ramki.map((r) => r.x + r.w));
        const gora = doStrony ? 0 : Math.min(...ramki.map((r) => r.y));
        const dol = doStrony ? wys : Math.max(...ramki.map((r) => r.y + r.h));
        el.forEach((o, i) => {
          const r = ramki[i];
          if (kierunek === 'lewo') przesun(o, lewo - r.x, 0);
          if (kierunek === 'prawo') przesun(o, prawo - (r.x + r.w), 0);
          if (kierunek === 'srodek') przesun(o, (lewo + prawo) / 2 - (r.x + r.w / 2), 0);
          if (kierunek === 'gora') przesun(o, 0, gora - r.y);
          if (kierunek === 'dol') przesun(o, 0, dol - (r.y + r.h));
          if (kierunek === 'srodek_pionowo') przesun(o, 0, (gora + dol) / 2 - (r.y + r.h / 2));
        });
        return { zmiany: m.zmiany(), opis: `Wyrównano ${el.length} el. (${kierunek}, względem ${doStrony ? 'strony' : 'elementów'}; ${m.nazwa}).` };
      }),
    },
    {
      name: 'rozmiesc_elementy',
      title: 'Rozmieść elementy równo',
      description: 'Rozmieszcza co najmniej 3 elementy (po id) z równymi odstępami – poziomo albo pionowo; skrajne zostają na miejscu (jak „Rozmieść” w edytorze). odstep_mm – zamiast tego stały odstęp od pierwszego elementu.',
      inputSchema: S('', {
        gdzie: GDZIE, id: { type: 'array', items: { type: 'string' } },
        kierunek: { type: 'string', enum: ['poziomo', 'pionowo'] }, odstep_mm: { type: 'number' },
      }, ['gdzie', 'id', 'kierunek']),
      dzialaj: ({ gdzie, id, kierunek, odstep_mm: staly }) => zmien((p) => {
        const m = miejsce(p, gdzie);
        const el = id.map((x) => znajdz(m.obiekty, x, 'elementu'));
        if (el.length < (staly == null ? 3 : 2)) throw new BladBazy('Podaj co najmniej 3 elementy (albo 2 z odstep_mm).');
        const poz = kierunek === 'poziomo';
        const lista = el.map((o) => ({ o, r: ramkaElementu(o) })).sort((a, b) => (poz ? a.r.x - b.r.x : a.r.y - b.r.y));
        const start = poz ? lista[0].r.x : lista[0].r.y;
        const rozmiary = lista.map(({ r }) => (poz ? r.w : r.h));
        const koniec = poz ? lista.at(-1).r.x + lista.at(-1).r.w : lista.at(-1).r.y + lista.at(-1).r.h;
        const odstep = staly != null ? staly : (koniec - start - rozmiary.reduce((a, b) => a + b, 0)) / (lista.length - 1);
        // Elementy szersze niż miejsce między skrajnymi: równe odstępy wyszłyby ujemne i elementy nachodziłyby na siebie.
        if (staly == null && odstep < 0) {
          throw new BladBazy(`Elementy nie mieszczą się między skrajnymi (brakuje ${Math.round(-odstep * (lista.length - 1) * 10) / 10} mm) – równe odstępy nałożyłyby je na siebie. Podaj odstep_mm (np. 5) albo najpierw odsuń skrajne elementy.`);
        }
        let pozycja = start;
        for (const { o, r } of lista) {
          if (poz) przesun(o, pozycja - r.x, 0); else przesun(o, 0, pozycja - r.y);
          pozycja += (poz ? r.w : r.h) + odstep;
        }
        return { zmiany: m.zmiany(), opis: `Rozmieszczono ${lista.length} el. ${kierunek}, odstęp ${Math.round(odstep * 100) / 100} mm (${m.nazwa}).` };
      }),
    },
    {
      name: 'kolejnosc_elementow',
      title: 'Kolejność elementów',
      description: 'Ustawia kolejność warstw elementów na stronie albo we wzorcu: lista id od spodu do wierzchu (wszystkie elementy).',
      inputSchema: S('', { gdzie: GDZIE, id: { type: 'array', items: { type: 'string' } } }, ['gdzie', 'id']),
      dzialaj: ({ gdzie, id }) => zmien((p) => {
        const m = miejsce(p, gdzie);
        if (id.length !== m.obiekty.length || !m.obiekty.every((o) => id.includes(o.id))) throw new BladBazy('Podaj każdy element tego miejsca dokładnie raz.');
        const nowa = id.map((x) => m.obiekty.find((o) => o.id === x));
        m.obiekty.splice(0, m.obiekty.length, ...nowa);
        return { zmiany: m.zmiany(), opis: `Nowa kolejność warstw (${m.nazwa}).` };
      }),
    },
    {
      name: 'dodaj_strone',
      title: 'Dodaj stronę',
      description: 'Dodaje stronę: { nazwa, sekcja (id), wzorce ("z_sekcji" albo lista id), seria?, tlo?, obiekty? }. Domyślnie na końcu swojej sekcji; „po” – id strony, za którą wstawić.',
      inputSchema: S('', { strona: obiekt('Strona'), po: tekst('id strony, za którą wstawić') }, ['strona']),
      dzialaj: ({ strona, po }) => zmien((p) => {
        const s = { wzorce: 'z_sekcji', obiekty: [], ...kopia(strona) };
        if (!s.id) s.id = noweId('s');
        if (!s.sekcja) s.sekcja = p.sekcje?.[0]?.id;
        s.obiekty = (s.obiekty || []).map(przygotujElement);
        const ids = p.strony.map((x) => x.id);
        let i = po ? ids.indexOf(po) + 1 : -1;
        if (po && i === 0) throw new BladBazy(`Nie ma strony „${po}”.`);
        if (i < 0) { const ostatnia = p.strony.map((x) => x.sekcja).lastIndexOf(s.sekcja); i = ostatnia >= 0 ? ostatnia + 1 : ids.length; }
        ids.splice(i, 0, s.id);
        return { zmiany: { strony: [s], kolejnosc_stron: ids }, opis: `Dodano stronę ${s.id} „${s.nazwa || ''}” na pozycji ${i + 1}.` };
      }),
    },
    {
      name: 'kopiuj_strone',
      title: 'Kopiuj stronę',
      description: 'Kopiuje stronę razem z elementami (nowe id strony i elementów) – ile kopii (1–50), domyślnie za kopiowaną stroną; „po” – id strony, za którą wstawić. Strony powtarzane z danymi lepiej robić serią z tabeli.',
      inputSchema: S('', { id: tekst('id strony do skopiowania'), ile: { type: 'integer', minimum: 1, maximum: 50 }, po: tekst('id strony, za którą wstawić') }, ['id']),
      dzialaj: ({ id, ile = 1, po }) => zmien((p) => {
        const wzor = znajdz(p.strony, id, 'strony');
        const ids = p.strony.map((x) => x.id);
        let i = ids.indexOf(po || id) + 1;
        if (i === 0) throw new BladBazy(`Nie ma strony „${po}”.`);
        const nowe = [];
        for (let k = 0; k < Math.min(50, Math.max(1, ile)); k += 1) {
          const s = kopia(wzor);
          s.id = noweId('s');
          s.nazwa = `${wzor.nazwa || 'Strona'} (kopia${ile > 1 ? ` ${k + 1}` : ''})`;
          wszystkie(s.obiekty || [], (o) => { if (o.id) o.id = noweId('o'); });
          nowe.push(s);
          ids.splice(i, 0, s.id);
          i += 1;
        }
        return { zmiany: { strony: nowe, kolejnosc_stron: ids }, opis: `Skopiowano stronę ${id}: ${nowe.map((s) => s.id).join(', ')}.` };
      }),
    },
    {
      name: 'zmien_strone',
      title: 'Zmień stronę',
      description: 'Zmienia ustawienia strony (nie elementy): nazwa, sekcja, wzorce ("z_sekcji" albo lista id), seria (id albo null), tlo, prowadnice. null usuwa pole.',
      inputSchema: S('', { id: tekst('id strony'), pola: obiekt('Pola do zmiany') }, ['id', 'pola']),
      dzialaj: ({ id, pola }) => zmien((p) => {
        const s = znajdz(p.strony, id, 'strony');
        const { obiekty, ...reszta } = pola;
        if (obiekty) throw new BladBazy('Elementy zmieniasz narzędziami zmien_elementy, dodaj_elementy i usun_elementy.');
        scal(s, reszta);
        return { zmiany: { strony: [s] }, opis: `Zmieniono stronę ${id}.` };
      }),
    },
    {
      name: 'usun_strony',
      title: 'Usuń strony',
      description: 'Usuwa strony (po id).',
      inputSchema: S('', { id: { type: 'array', items: { type: 'string' } } }, ['id']),
      dzialaj: ({ id }) => zmien(() => ({ zmiany: { usun_strony: id }, opis: `Usunięto strony: ${id.join(', ')}.` })),
    },
    {
      name: 'kolejnosc_stron',
      title: 'Kolejność stron',
      description: 'Nowa kolejność stron: wszystkie id stron. (Aplikacja i tak trzyma strony pogrupowane według kolejności sekcji.)',
      inputSchema: S('', { id: { type: 'array', items: { type: 'string' } } }, ['id']),
      dzialaj: ({ id }) => zmien(() => ({ zmiany: { kolejnosc_stron: id }, opis: 'Ustawiono kolejność stron.' })),
    },
    {
      name: 'zmien_tabele',
      title: 'Zmień tabelę danych',
      description: 'Zmienia albo tworzy tabelę danych (po id; nowa, jeśli nie ma – wtedy podaj nazwa i kolumny) – bez usuwania danych: nazwa, kolumny (pełna lista; mogą dojść nowe i zmienić się kolejność, ale każda dotychczasowa musi zostać), ustaw komórki [{ wiersz (od 0), kolumna (nazwa), wartosc }], dodaj_wiersze (listy wartości w kolejności kolumn; wiersz „[pomiń]” w pierwszej komórce zajmuje miejsce w bloku serii, ale strona nie powstaje), listy ({ kolumna: [dozwolone wartości] }).',
      inputSchema: S('', {
        id: tekst('id tabeli'), nazwa: tekst('nazwa tabeli'), kolumny: { type: 'array', items: { type: 'string' } },
        ustaw: { type: 'array', items: S('', { wiersz: { type: 'integer' }, kolumna: { type: 'string' }, wartosc: { type: 'string' } }, ['wiersz', 'kolumna', 'wartosc']) },
        dodaj_wiersze: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
        listy: obiekt('Listy dozwolonych wartości kolumn'),
      }, ['id']),
      dzialaj: (a) => zmien((p) => {
        p.tabele = p.tabele || [];
        let t = p.tabele.find((x) => x.id === a.id);
        if (!t) {
          if (!a.nazwa || !a.kolumny) throw new BladBazy(`Nie ma tabeli „${a.id}” – żeby ją utworzyć, podaj nazwa i kolumny.`);
          t = { id: a.id, nazwa: a.nazwa, kolumny: a.kolumny, wiersze: [] };
          p.tabele.push(t);
        }
        if (a.nazwa) t.nazwa = a.nazwa;
        if (a.kolumny) {
          const brak = t.kolumny.filter((k) => !a.kolumny.includes(k));
          if (brak.length) throw new BladBazy(`Kolumny ${brak.map((k) => `„${k}”`).join(', ')} zniknęłyby razem z danymi – usuwa je narzędzie usun_z_tabeli (usun_kolumny).`);
          const stare = t.kolumny;
          t.wiersze = t.wiersze.map((w) => a.kolumny.map((k) => { const i = stare.indexOf(k); return i >= 0 ? (w[i] ?? '') : ''; }));
          t.kolumny = a.kolumny;
        }
        for (const u of a.ustaw || []) {
          const k = t.kolumny.indexOf(u.kolumna);
          if (k < 0) throw new BladBazy(`Tabela „${t.nazwa}” nie ma kolumny „${u.kolumna}”.`);
          while (t.wiersze.length <= u.wiersz) t.wiersze.push(t.kolumny.map(() => ''));
          t.wiersze[u.wiersz][k] = u.wartosc;
        }
        for (const w of a.dodaj_wiersze || []) t.wiersze.push(t.kolumny.map((_, i) => String(w[i] ?? '')));
        if (a.listy) t.listy = { ...(t.listy || {}), ...a.listy };
        return { zmiany: { tabele: p.tabele }, opis: `Tabela „${t.nazwa}”: ${t.kolumny.length} kolumn, ${t.wiersze.length} wierszy.` };
      }),
    },
    {
      name: 'usun_z_tabeli',
      title: 'Usuń wiersze albo kolumny tabeli',
      description: 'Usuwa dane z tabeli (po id): usun_wiersze (numery od 0), usun_kolumny (nazwy – razem z wartościami), albo wiersze – zastępuje WSZYSTKIE wiersze podanymi.',
      inputSchema: S('', {
        id: tekst('id tabeli'),
        usun_wiersze: { type: 'array', items: { type: 'integer' } },
        usun_kolumny: { type: 'array', items: { type: 'string' } },
        wiersze: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
      }, ['id']),
      dzialaj: (a) => zmien((p) => {
        const t = (p.tabele || []).find((x) => x.id === a.id);
        if (!t) throw new BladBazy(`Nie ma tabeli „${a.id}”.`);
        if (a.usun_kolumny) {
          const nie = a.usun_kolumny.filter((k) => !t.kolumny.includes(k));
          if (nie.length) throw new BladBazy(`Tabela „${t.nazwa}” nie ma kolumn: ${nie.join(', ')}.`);
          const zostaja = t.kolumny.map((k, i) => [k, i]).filter(([k]) => !a.usun_kolumny.includes(k));
          t.wiersze = t.wiersze.map((w) => zostaja.map(([, i]) => w[i] ?? ''));
          t.kolumny = zostaja.map(([k]) => k);
          if (t.listy) for (const k of a.usun_kolumny) delete t.listy[k];
        }
        if (a.wiersze) t.wiersze = a.wiersze.map((w) => t.kolumny.map((_, i) => String(w[i] ?? '')));
        if (a.usun_wiersze) t.wiersze = t.wiersze.filter((_, i) => !a.usun_wiersze.includes(i));
        return { zmiany: { tabele: p.tabele }, opis: `Tabela „${t.nazwa}”: ${t.kolumny.length} kolumn, ${t.wiersze.length} wierszy.` };
      }),
    },
    {
      name: 'zmien_czesc',
      title: 'Zmień sekcję, wzorzec, styl, tabelę albo serię',
      description: 'Ogólna zmiana jednej części projektu po id: czesc = sekcje | wzorce | style | tabele | serie. pola – zmieniane pola (null usuwa pole); nowa część, jeśli id nie istnieje (podaj komplet pól, np. sekcja: nazwa, wydruk, uklad; okładka z grzbietem: pole okladka; seria: nazwa, tabela, tryb). Zmiana stylu przepisuje jego wartości do wszystkich tekstów z tym stylem (jak w aplikacji).',
      inputSchema: S('', { czesc: { type: 'string', enum: Object.keys(CZESCI) }, id: tekst('id'), pola: obiekt('Pola') }, ['czesc', 'id']),
      dzialaj: ({ czesc, id, pola = {}, usun = false }) => zmien((p) => {
        p[czesc] = p[czesc] || [];
        const lista = p[czesc];
        const i = lista.findIndex((x) => x.id === id);
        let zmiany = {};
        let opis;
        if (usun) {
          if (i < 0) throw new BladBazy(`Nie ma ${CZESCI[czesc]} „${id}”.`);
          const [stary] = lista.splice(i, 1);
          if (czesc === 'style') zmiany = przepiszStyl(p, stary, { odepnij: true }).zmiany;
          opis = `Usunięto: ${CZESCI[czesc]} „${stary.nazwa || id}”.`;
        } else if (i < 0) {
          lista.push(scal({ id }, pola));
          opis = `Dodano: ${CZESCI[czesc]} „${pola.nazwa || id}”.`;
        } else {
          scal(lista[i], pola);
          opis = `Zmieniono: ${CZESCI[czesc]} „${lista[i].nazwa || id}”.`;
          if (czesc === 'style') {
            const w = przepiszStyl(p, lista[i]);
            zmiany = w.zmiany;
            if (w.ile) opis += ` Styl przepisany do ${w.ile} tekstów.`;
          }
        }
        // Lista wzorców mogła już trafić do zmian (przepisanie stylu) – to ten sam obiekt.
        return { zmiany: { ...zmiany, [czesc]: lista }, opis };
      }),
    },
    {
      name: 'usun_czesc',
      title: 'Usuń sekcję, wzorzec, styl, tabelę albo serię',
      description: 'Usuwa jedną część projektu po id: czesc = sekcje | wzorce | style | tabele | serie. Usunięcie stylu odpina go od tekstów (teksty zostają, jak w aplikacji). Baza odrzuci usunięcie, które zostawiłoby projekt niespójny (np. sekcję ze stronami albo tabelę używaną przez serię).',
      inputSchema: S('', { czesc: { type: 'string', enum: Object.keys(CZESCI) }, id: tekst('id') }, ['czesc', 'id']),
      dzialaj: ({ czesc, id }) => NARZEDZIA.find((n) => n.name === 'zmien_czesc').dzialaj({ czesc, id, usun: true }),
    },
    {
      name: 'zmien_projekt',
      title: 'Zmień projekt (ogólnie)',
      description: 'Ogólny zapis części projektu w jednym kroku, dla zmian, których nie obejmują inne narzędzia. zmiany: { nazwa?, sekcje?, wzorce?, style?, tabele?, serie? (pełne listy – zastępują dotychczasowe), widok?, strony? (pełne obiekty stron nowych albo zmienionych), usun_strony? (id stron), kolejnosc_stron? (id stron), kolory_dodatkowe? (kolory spot, np. Pantone: [{ id, nazwa, cmyk: [c, m, y, k] }]), tryb_kolorow? (pelny | szarosc | czb1), kolor_trybu?, ksiazka? (nagłówki spisu treści i liczenie przypisów: { naglowki: [{ styl, poziom }], przypisy: sekcja | strona | ciagle }) }. Kolor dodatkowy w elemencie i uszlachetnienia – pole elementu uszlachetnienie. Baza sprawdza spójność (sekcje, wzorce, serie, tabele, obrazy) i odrzuca niespójne zmiany z opisem. Nie wgrywa obrazów ani czcionek.',
      inputSchema: S('', { zmiany: obiekt('Części projektu do zapisu') }, ['zmiany']),
      dzialaj: ({ zmiany }) => zmien(() => ({ zmiany, opis: `Zapisano części: ${Object.keys(zmiany).join(', ')}.` })),
    },
    {
      name: 'nazwa_projektu',
      title: 'Zmień nazwę projektu',
      description: 'Zmienia nazwę projektu.',
      inputSchema: S('', { nazwa: tekst('Nowa nazwa') }, ['nazwa']),
      dzialaj: ({ nazwa }) => zmien(() => ({ zmiany: { nazwa }, opis: `Nowa nazwa: „${nazwa}”.` })),
    },
    {
      name: 'kontrola',
      title: 'Kontrola projektu',
      description: 'Szybka kontrola bez rysowania: nieznane pola {…} w tekstach, brakujące pliki obrazów z danych, elementy poza stroną. Pełne „Sprawdź przed drukiem” jest w aplikacji.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => { const u = kontrola((await pobierz()).projekt); return u.length ? `Uwagi (${u.length}):\n${u.map((x) => `- ${x}`).join('\n')}` : 'Brak uwag.'; },
    },
    {
      name: 'komentarze',
      title: 'Komentarze projektu',
      description: 'Komentarze na stronach (osobno od projektu, nie zmieniają jego wersji): wątki z numerem pinezki, stroną, elementem albo miejscem (mm od lewego górnego rogu strony), autorem, treścią, stanem (otwarty/rozwiązany) i odpowiedziami. Domyślnie tylko nierozwiązane.',
      inputSchema: S('', { wszystkie: { type: 'boolean', description: 'true – także rozwiązane wątki' } }),
      readOnly: true,
      dzialaj: async ({ wszystkie = false } = {}) => {
        if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
        const w = await rpc('ai_komentarze', { p_klucz: KLUCZ });
        if (w?.blad) throw new BladBazy(w.blad);
        const lista = Array.isArray(w.komentarze) ? w.komentarze : [];
        const watki = lista.filter((k) => !k.watek);
        const nr = new Map(watki.map((k, i) => [k.id, i + 1]));
        const widoczne = watki.filter((k) => wszystkie || !k.rozwiazany);
        if (!widoczne.length) return wszystkie ? 'Projekt nie ma komentarzy.' : 'Brak nierozwiązanych komentarzy (wszystkie=true pokaże rozwiązane).';
        return widoczne.map((k) => {
          const gdzie = `strona ${k.strona_id}${k.element_id ? `, element ${k.element_id}` : ''}${k.x !== null && k.x !== undefined ? `, miejsce ${k.x}×${k.y} mm` : ''}`;
          const odp = lista.filter((o) => o.watek === k.id).map((o) => `   ↳ ${o.autor_nazwa}${o.zrodlo === 'ai' ? ' (AI)' : ''}: ${o.tresc}`);
          return [`#${nr.get(k.id)} [${k.rozwiazany ? 'rozwiązany' : 'otwarty'}] id ${k.id} · ${gdzie} · ${k.autor_nazwa}${k.zrodlo === 'ai' ? ' (AI)' : ''}, ${k.utworzono}`, `   ${k.tresc}`, ...odp].join('\n');
        }).join('\n');
      },
    },
    {
      name: 'skomentuj',
      title: 'Dodaj komentarz na stronie',
      description: 'Nowy wątek komentarza przypięty do strony: do elementu (element = id) albo do miejsca (x, y w mm od lewego górnego rogu strony). Osoby w projekcie zobaczą pinezkę z numerem; @nazwa wspomina osobę z projektu (dostanie powiadomienie). Komentarz nie zmienia projektu – działa też z kluczem tylko do czytania. Podpisany opisem klucza.',
      inputSchema: S('', { strona: tekst('id strony'), element: tekst('id elementu na tej stronie (opcjonalnie)'), x: { type: 'number', description: 'mm od lewej krawędzi strony' }, y: { type: 'number', description: 'mm od górnej krawędzi strony' }, tresc: tekst('Treść komentarza') }, ['strona', 'tresc']),
      dzialaj: async ({ strona, element = null, x = null, y = null, tresc }) => {
        if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
        const w = await rpc('ai_skomentuj', { p_klucz: KLUCZ, p_strona: strona, p_element: element, p_x: x, p_y: y, p_tresc: tresc, p_watek: null });
        if (w?.blad) throw new BladBazy(w.blad);
        return `Dodano komentarz (id ${w.id}) na stronie ${w.strona_id}${w.element_id ? ` przy elemencie ${w.element_id}` : ''}.`;
      },
    },
    {
      name: 'odpowiedz',
      title: 'Odpowiedz na komentarz',
      description: 'Odpowiedź w wątku komentarza (komentarz = id wątku albo odpowiedzi). Opcjonalnie rozwiaz=true zamyka wątek po odpowiedzi (np. gdy poprawka już jest w projekcie).',
      inputSchema: S('', { komentarz: tekst('id komentarza (wątku)'), tresc: tekst('Treść odpowiedzi'), rozwiaz: { type: 'boolean', description: 'true – oznacz wątek jako rozwiązany' } }, ['komentarz', 'tresc']),
      dzialaj: async ({ komentarz, tresc, rozwiaz = false }) => {
        if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
        const w = await rpc('ai_skomentuj', { p_klucz: KLUCZ, p_strona: null, p_element: null, p_x: null, p_y: null, p_tresc: tresc, p_watek: komentarz });
        if (w?.blad) throw new BladBazy(w.blad);
        if (rozwiaz) {
          const r = await rpc('ai_rozwiaz_komentarz', { p_klucz: KLUCZ, p_id: w.watek || komentarz, p_rozwiazany: true });
          if (r?.blad) throw new BladBazy(r.blad);
        }
        return `Dodano odpowiedź (id ${w.id})${rozwiaz ? ' i oznaczono wątek jako rozwiązany' : ''}.`;
      },
    },
    {
      name: 'rozwiaz_komentarz',
      title: 'Rozwiąż albo otwórz wątek komentarza',
      description: 'Oznacza wątek komentarza jako rozwiązany (rozwiazany=true, domyślnie) albo otwiera go ponownie (false).',
      inputSchema: S('', { komentarz: tekst('id wątku'), rozwiazany: { type: 'boolean' } }, ['komentarz']),
      dzialaj: async ({ komentarz, rozwiazany = true }) => {
        if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
        const w = await rpc('ai_rozwiaz_komentarz', { p_klucz: KLUCZ, p_id: komentarz, p_rozwiazany: rozwiazany });
        if (w?.blad) throw new BladBazy(w.blad);
        return rozwiazany ? 'Wątek oznaczony jako rozwiązany.' : 'Wątek otwarty ponownie.';
      },
    },
    {
      name: 'eksport_pdf',
      title: 'Eksportuj projekt do PDF',
      description: 'Plik PDF projektu (do drukarni albo do czytania na ekranie). PDF rysuje aplikacja Makietki w przeglądarce użytkownika: narzędzie składa zlecenie, otwarta aplikacja konta klucza robi plik i wgrywa go na konto, a narzędzie czeka do ok. 45 s i zwraca link do pobrania (bez logowania, ważny 7 dni) z uwagami z kontroli przed drukiem. Gdy aplikacja nie jest otwarta – zwraca link do aplikacji dla użytkownika (po jego otwarciu plik zrobi się sam) i numer zlecenia. Działa też z kluczem tylko do czytania.',
      inputSchema: S('', {
        zakres: { type: 'string', enum: ['wszystko', 'sekcja', 'sekcje', 'strony'], description: 'wszystko (domyślnie), jedna sekcja, kilka sekcji (sekcje) albo wybrane strony (strony – tekst jak w Wordzie albo od–do; numery w całym wydruku, z powieleniami serii)' },
        sekcja: tekst('id albo nazwa sekcji (zakres: sekcja)'),
        sekcje: { type: 'array', items: { type: 'string' }, description: 'id albo nazwy sekcji (zakres: sekcje)' },
        strony: tekst('numery stron jak w Wordzie, np. „1-5, 8, 11-” (11- = od 11 do końca); zakres: strony – zamiast od/do'),
        od: { type: 'integer', minimum: 1, description: 'pierwsza strona (zakres: strony)' },
        do: { type: 'integer', minimum: 1, description: 'ostatnia strona (zakres: strony)' },
        przeznaczenie: { type: 'string', enum: ['drukarnia', 'ekran'], description: 'drukarnia (domyślnie) – ze spadem i znakami cięcia; ekran – sam format strony, z zakładkami i linkami' },
        rodzaj: { type: 'string', enum: ['wektor', 'obraz'], description: 'wektor (domyślnie) – tekst i kształty wektorowo, czcionki osadzone; obraz – każda strona jako obraz' },
        dpi: { type: 'integer', enum: [150, 300, 600], description: 'rozdzielczość obrazów (domyślnie 300)' },
        cmyk: { type: 'boolean', description: 'tekst i kształty w CMYK (plik wektorowy)' },
        pdfx: { type: 'string', enum: ['', 'fogra39', 'fogra47'], description: 'PDF/X-4 z profilem: fogra39 – papier powlekany, fogra47 – niepowlekany; pusty – zwykły PDF' },
        uklad: { type: 'string', enum: ['zwykly', 'broszura', 'skladki', 'dwie', 'cztery'], description: 'zwykly (domyślnie) – strona po stronie; broszura – arkusze do złożenia i zszycia; skladki – broszura w składkach; dwie / cztery – strony na arkuszu' },
        format_arkusza: { type: 'string', enum: ['auto', 'A4', 'A3'], description: 'arkusz przy układzie innym niż zwykly' },
        skladka: { type: 'integer', enum: [4, 8, 16, 32], description: 'stron w składce (uklad: skladki)' },
        czekaj: { type: 'boolean', description: 'false – tylko złóż zlecenie i od razu wróć z numerem zlecenia' },
      }),
      readOnly: true,
      dzialaj: async ({ czekaj = true, format_arkusza: formatArkusza, ...reszta } = {}) => {
        const u = Object.fromEntries(Object.entries({ ...reszta, formatArkusza }).filter(([, v]) => v !== undefined && v !== null));
        return zlecEksport('pdf', u, czekaj !== false);
      },
    },
    {
      name: 'eksport_png',
      title: 'Pobierz stronę jako PNG',
      description: 'Obraz PNG jednej strony (ze spadem), np. do pokazania w czacie albo w internecie. Obraz rysuje otwarta aplikacja Makietki, narzędzie czeka do ok. 45 s i zwraca link do pobrania (ważny 7 dni) albo link do aplikacji, gdy żadna nie jest otwarta.',
      inputSchema: S('', {
        strona: tekst('id strony'),
        egzemplarz: { type: 'integer', minimum: 1, description: 'który egzemplarz strony z serii (domyślnie 1)' },
        dpi: { type: 'integer', minimum: 72, maximum: 600, description: 'rozdzielczość (domyślnie 150)' },
        czekaj: { type: 'boolean', description: 'false – tylko złóż zlecenie' },
      }, ['strona']),
      readOnly: true,
      dzialaj: async ({ strona, egzemplarz = 1, dpi = 150, czekaj = true }) => zlecEksport('png', { strona, egzemplarz, dpi }, czekaj !== false),
    },
    {
      name: 'stan_eksportu',
      title: 'Stan zleconego eksportu',
      description: 'Stan zlecenia eksportu (PDF albo PNG) i innych zleceń dla aplikacji: czeka na aplikację, w toku, gotowe (z linkiem do pobrania) albo błąd.',
      inputSchema: S('', { zlecenie: tekst('numer zlecenia') }, ['zlecenie']),
      readOnly: true,
      dzialaj: async ({ zlecenie }) => {
        if (!KLUCZ_KONTA) throw new BladBazy(BRAK_KLUCZA);
        const s = await rpc('ai_stan_eksportu', { p_klucz: KLUCZ_KONTA, p_id: zlecenie });
        if (s?.blad && !s.id) throw new BladBazy(s.blad); // błąd klucza; zlecenie z błędem ma id
        return ['pdf', 'png'].includes(s.rodzaj) ? opisEksportu(s) : opisZadania(s);
      },
    },
    {
      name: 'udostepnij_link',
      title: 'Udostępnij link do podglądu',
      description: 'Tworzy link do podglądu projektu (jak Podgląd → Udostępnij w aplikacji): każdy, kto ma link, obejrzy strony bez logowania i bez możliwości zmian. To publikacja treści: wymaga zgoda_uzytkownika: true; opcjonalnie hasło albo data ważności. Gdy projekt ma już link – zwraca ten sam adres (i ustawia podaną ochronę). Link robi otwarta aplikacja Makietki; gdy nie jest otwarta, wynik podaje link do aplikacji.',
      inputSchema: S('', {
        zgoda_uzytkownika: { type: 'boolean', description: 'true – użytkownik wyraźnie zgodził się na link w tej rozmowie' },
        haslo: tekst('hasło do linku (co najmniej 4 znaki; opcjonalnie)'),
        wazny_do: tekst('ostatni dzień ważności RRRR-MM-DD (opcjonalnie)'),
      }, ['zgoda_uzytkownika']),
      dzialaj: async ({ zgoda_uzytkownika: zgoda, haslo, wazny_do: waznyDo }) => {
        if (zgoda !== true) throw new BladBazy('Najpierw zapytaj użytkownika, czy chce udostępnić projekt linkiem (każdy z linkiem zobaczy strony), i wywołaj narzędzie z zgoda_uzytkownika: true dopiero po jego zgodzie.');
        if (haslo != null && String(haslo).length < 4) throw new BladBazy('Hasło do linku musi mieć co najmniej 4 znaki.');
        if (waznyDo != null && (!/^\d{4}-\d{2}-\d{2}$/.test(String(waznyDo)) || String(waznyDo) < new Date().toISOString().slice(0, 10))) throw new BladBazy('wazny_do: dzisiejsza albo późniejsza data w postaci RRRR-MM-DD.');
        return zlecZadanie('link', Object.fromEntries(Object.entries({ haslo, wazny_do: waznyDo }).filter(([, v]) => v != null && v !== '')));
      },
    },
    {
      name: 'generuj_obraz',
      title: 'Narysuj obraz (Gemini)',
      description: 'Rysuje obraz z opisu kluczem Google Gemini użytkownika i wstawia go do ramki (element – id kształtu, kadru albo prostokąta na stronie gdzie; obraz ją wypełnia) albo na środek strony. Rysuje otwarta aplikacja Makietki (klucz Gemini jest tylko w przeglądarce użytkownika); narzędzie czeka do ok. 1,5 minuty. Kosztuje (szkic ok. 0,14 zł; pilnuje tego miesięczny limit z ustawień konta) – powiedz użytkownikowi, co rysujesz. Nie umieszczaj tekstu w obrazie; napisy dodaje się w Makietce.',
      inputSchema: S('', {
        opis: tekst('Co ma być na obrazie – w języku użytkownika'),
        gdzie: tekst('„strona:<id strony>” – strona z ramką albo strona, na którą wstawić obraz'),
        element: tekst('id ramki na tej stronie (opcjonalnie)'),
        jakosc: JAKOSC_OBRAZU,
        proporcja: tekst('kształt obrazu, np. 3:4 (pion), 4:3 (poziom), 1:1 – zgodny z ramką'),
        popraw: { type: 'boolean', description: 'true – popraw obraz, który już jest w elemencie (element wymagany): opis to TYLKO zmiana, np. „dodaj kapelusz”' },
        czekaj: { type: 'boolean', description: 'false – tylko zleć i od razu wróć z numerem zlecenia' },
      }, ['opis', 'gdzie']),
      dzialaj: async ({ czekaj = true, ...a }) => zlecZadanie('obraz', Object.fromEntries(Object.entries(a).filter(([, v]) => v != null)), czekaj !== false, 2 * czekanieEksportu),
    },
    {
      name: 'rysuj_kadry',
      title: 'Narysuj kadry komiksu',
      description: 'Komiks: rysuje obrazy do kadrów strony komiksu ze scenariusza (opis sceny, kto mówi) i kart postaci/miejsc, w stylu projektu – kluczem Gemini użytkownika, w otwartej aplikacji Makietki (otworzy w niej projekt). strona – numer strony komiksu (1 = pierwsza strona sekcji Komiks). Domyślnie tylko kadry bez obrazu. Kosztuje (ok. 0,14 zł za kadr w szkicu) – powiedz użytkownikowi, ile kadrów rysujesz. Cała strona trwa kilka minut.',
      inputSchema: S('', {
        strona: { type: 'integer', minimum: 1, description: 'numer strony komiksu' },
        kadry: { type: 'array', items: { type: 'integer' }, description: 'numery kadrów (opcjonalnie; domyślnie puste kadry)' },
        jakosc: JAKOSC_OBRAZU,
        czekaj: { type: 'boolean', description: 'false – tylko zleć i od razu wróć' },
      }, ['strona']),
      dzialaj: async ({ czekaj = true, ...a }) => zlecZadanie('kadry', Object.fromEntries(Object.entries(a).filter(([, v]) => v != null)), czekaj !== false, 2 * czekanieEksportu),
    },
    {
      name: 'ustaw_dymki',
      title: 'Ustaw dymki komiksu',
      description: 'Komiks: stawia dymki z tabeli scenariusza na stronach komiksu (ponownie – zmienia tylko tekst, przesunięte dymki zostają), w otwartej aplikacji Makietki. kolumna – kolumna tekstu dla innej wersji językowej (np. tekst_en). Nic nie kosztuje.',
      inputSchema: S('', { kolumna: tekst('kolumna tekstu (opcjonalnie)'), czekaj: { type: 'boolean', description: 'false – tylko zleć' } }),
      dzialaj: async ({ czekaj = true, kolumna }) => zlecZadanie('dymki', kolumna ? { kolumna } : {}, czekaj !== false),
    },
    {
      name: 'biblioteka',
      title: 'Biblioteka elementów',
      description: 'Katalog Biblioteki Makietki: gotowe kształty, ramki, ikony, ilustracje, ozdobniki, linie, kalendarze, wykresy, tabele, tła i wzory, nagłówki, infografiki, elementy komiksu i in. Bez parametrów – lista kategorii; szukaj – elementy pasujące do słów (np. „ramka zaokrąglona”, „serce”, „kalendarz”); kategoria – elementy jednej kategorii.',
      inputSchema: S('', { szukaj: tekst('słowa do wyszukania (bez polskich znaków też działa)'), kategoria: tekst('id kategorii z listy') }),
      readOnly: true,
      dzialaj: async ({ szukaj, kategoria } = {}) => {
        const bez = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
        if (!szukaj && !kategoria) return `Kategorie Biblioteki (id – nazwa, liczba elementów):\n${KATALOG_BIBLIOTEKI.map(([id, n, el]) => `- ${id} – ${n} (${el.length})`).join('\n')}\nSzukaj elementów parametrem szukaj albo kategoria.`;
        const kat = kategoria ? KATALOG_BIBLIOTEKI.filter(([id]) => id === kategoria) : KATALOG_BIBLIOTEKI;
        if (!kat.length) throw new BladBazy(`Nie ma kategorii „${kategoria}”. Lista: ${KATALOG_BIBLIOTEKI.map(([id]) => id).join(', ')}.`);
        const slowa = bez(szukaj).split(/\s+/).filter(Boolean);
        const wynik = kat.flatMap(([id, n, el]) => el.filter(([e, ne, sl]) => slowa.every((w) => bez(`${ne} ${sl} ${n} ${e}`).includes(w))).map(([e, ne]) => `- ${id} / ${e} – ${ne}`));
        if (!wynik.length) return 'Nic nie pasuje – spróbuj innych słów albo przejrzyj kategorię (parametr kategoria).';
        return `Elementy (${wynik.length}${wynik.length > 60 ? ', pierwsze 60' : ''}; kategoria / element – nazwa):\n${wynik.slice(0, 60).join('\n')}`;
      },
    },
    {
      name: 'wstaw_z_biblioteki',
      title: 'Wstaw element z Biblioteki',
      description: 'Wstawia gotowy element z Biblioteki Makietki (kategoria i element z katalogu Biblioteki) na stronę – tak jak kliknięcie w oknie Biblioteki. x, y – środek elementu w mm od lewego górnego rogu strony (bez nich – domyślne miejsce elementu). Wstawia otwarta aplikacja Makietki (otworzy w niej projekt); wynik podaje id nowego elementu i jego położenie. Nic nie kosztuje.',
      inputSchema: S('', {
        kategoria: tekst('id kategorii z katalogu Biblioteki'),
        element: tekst('id elementu z katalogu Biblioteki'),
        gdzie: tekst('„strona:<id strony>”'),
        x: { type: 'number', description: 'środek elementu w poziomie, mm od lewej krawędzi strony' },
        y: { type: 'number', description: 'środek elementu w pionie, mm od górnej krawędzi strony' },
        czekaj: { type: 'boolean', description: 'false – tylko zleć' },
      }, ['kategoria', 'element', 'gdzie']),
      dzialaj: async ({ kategoria, element, gdzie, x, y, czekaj = true }) => {
        const kat = KATALOG_BIBLIOTEKI.find(([id]) => id === kategoria);
        if (!kat) throw new BladBazy(`Nie ma kategorii „${kategoria}” – sprawdź narzędziem biblioteka.`);
        const el = kat[2].find(([e]) => e === element);
        if (!el) throw new BladBazy(`W kategorii „${kategoria}” nie ma elementu „${element}” – sprawdź narzędziem biblioteka (kategoria: ${kategoria}).`);
        if (!/^strona:./.test(String(gdzie || ''))) throw new BladBazy('gdzie: „strona:<id strony>” (id z przeglad_projektu).');
        return zlecZadanie('biblioteka', { kategoria, element, nazwa: el[1], gdzie, ...(Number.isFinite(x) && Number.isFinite(y) ? { x, y } : {}) }, czekaj !== false);
      },
    },
    {
      name: 'cofnij_zmiany_ai',
      title: 'Cofnij zmiany AI',
      description: 'Przywraca projekt do stanu sprzed ostatniej serii zmian zrobionych przez AI (zapisy AI w odstępach do 15 minut; strony usunięte przez AI wracają, dodane – znikają). Zmiany zrobione później, także przez ludzi, też się cofną. sprawdz=true tylko opisuje, co zostanie cofnięte (od–do, ile zapisów, ile późniejszych zmian), bez zmian w projekcie. Kolejne wywołanie sięga do wcześniejszej serii.',
      inputSchema: S('', { sprawdz: { type: 'boolean', description: 'true – tylko informacja, co zostałoby cofnięte (nic nie zmienia)' } }),
      dzialaj: async ({ sprawdz }) => {
        const w = await rpc('ai_cofnij_zmiany', { p_klucz: KLUCZ, p_tylko_sprawdz: Boolean(sprawdz) });
        if (w?.blad) throw new BladBazy(w.blad);
        if (sprawdz) {
          if (w?.brak) return 'W ostatnich 14 dniach AI nie zmieniało tego projektu – nie ma czego cofnąć.';
          return `Do cofnięcia: zmiany AI od ${w.od} do ${w.do} (zapisów: ${w.zapisow}).${w.pozniej ? ` Po nich projekt zmieniano jeszcze ${w.pozniej} raz(y) – te zmiany też zostałyby cofnięte.` : ''} Zapytaj użytkownika, zanim cofniesz.`;
        }
        return `Cofnięto zmiany AI od ${w.od} do ${w.do} (zapisów: ${w.zapisow}, przywróconych stron: ${w.strony}). Projekt ma wersję ${w.wersja}; otwarta Makietka wczyta ją sama.`;
      },
    },
    {
      name: 'czcionki',
      title: 'Czcionki',
      description: 'Lista czcionek, których można użyć w projekcie (pole fontFamily): wbudowane w Makietkę, pogrupowane według rodzaju, z informacją o pogrubieniu i kursywie, oraz czcionki wgrane do tego projektu. Używaj tylko tych nazw – inna czcionka nie wyświetli się i nie trafi do PDF. Własną czcionkę (plik TTF/OTF) użytkownik wgrywa sam w aplikacji: Czcionki projektu → Wgraj.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => {
        const grupy = new Map();
        for (const [nazwa, rodzaj, pogr, kurs] of CZCIONKI_MAKIETKI) {
          if (!grupy.has(rodzaj)) grupy.set(rodzaj, []);
          grupy.get(rodzaj).push(`${nazwa}${pogr ? '' : ' (bez pogrubienia)'}${kurs ? '' : ' (bez kursywy)'}`);
        }
        let wlasne = [];
        try { const { projekt: p } = await pobierz(); wlasne = (p.czcionki || []).map((c) => c.rodzina || c.nazwa).filter(Boolean); } catch { /* bez projektu – tylko wbudowane */ }
        return [`Czcionki wbudowane (${CZCIONKI_MAKIETKI.length}):`, ...[...grupy].map(([r, l]) => `- ${r}: ${l.join(', ')}`),
          wlasne.length ? `Czcionki wgrane do tego projektu: ${[...new Set(wlasne)].join(', ')}.` : 'Projekt nie ma własnych czcionek (użytkownik może je wgrać w aplikacji: Czcionki projektu → Wgraj).'].join('\n');
      },
    },
    {
      name: 'opis_formatu',
      title: 'Opis formatu projektu',
      description: 'Pełny opis modelu projektu Makietki: sekcje, strony, elementy i ich pola, tabele, serie, pola w tekście, jednostki (mm).',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => {
        const wlasny = czytajOpis ? await czytajOpis().catch(() => null) : null;
        if (wlasny) return wlasny;
        const odp = await fetch(ADRES_OPISU);
        if (!odp.ok) throw new BladBazy(`Nie udało się pobrać opisu formatu (${ADRES_OPISU}).`);
        return odp.text();
      },
    },
  ];




  function listaNarzedzi() {
    return NARZEDZIA.filter((n) => rysowanie || !RYSUJACE.has(n.name)).map(({ name, title, description, inputSchema, readOnly, meta }) => ({
      name: angielski ? NAZWY_EN[name] || name : name,
      title: angielski ? tekstEn(title) : title,
      description: angielski ? tekstEn(description) : description,
      ...(meta ? { _meta: meta } : {}),
      inputSchema: angielski ? schematEn(pelnySchemat(name), name) : pelnySchemat(name),
      // Adnotacje dla katalogu łączników Claude: każde narzędzie ma readOnlyHint i (przy zmianach) destructiveHint.
      // Niszczące – usuwają albo zastępują dane bez kroku cofania w narzędziu; openWorld – sięgają poza Makietkę.
      annotations: readOnly
        ? { readOnlyHint: true, openWorldHint: false }
        : { readOnlyHint: false, destructiveHint: name.startsWith('usun') || NISZCZACE.has(name), idempotentHint: IDEMPOTENTNE.has(name), openWorldHint: SWIAT.has(name) },
    }));
  }

  // Schemat parametrów z parametrem „projekt” (narzędzia projektu).
  function pelnySchemat(name) {
    const { inputSchema } = NARZEDZIA.find((n) => n.name === name);
    return {
      type: 'object',
      properties: BEZ_PROJEKTU.has(name) ? inputSchema.properties : { projekt: PARAMETR_PROJEKTU, ...inputSchema.properties },
      required: inputSchema.required,
      additionalProperties: false,
    };
  }

  // Narzędzia konta (bez parametru „projekt” albo z własnym, jak usun_projekt) – reszta działa na wskazanym projekcie.
  const NISZCZACE = new Set(['zmien_projekt', 'podmien_obraz', 'uporzadkuj_obrazy', 'cofnij_zmiany_ai']);
  const IDEMPOTENTNE = new Set(['nazwa_projektu', 'zmien_strone', 'kolejnosc_stron', 'zmien_nazwe_obrazu', 'rozwiaz_komentarz', 'ustaw_dymki', 'udostepnij_link']);
  // wgraj_obraz pobiera adres z internetu, generuj_obraz i rysuj_kadry wołają Google Gemini, link publikuje podgląd.
  const SWIAT = new Set(['wgraj_obraz', 'podmien_obraz', 'generuj_obraz', 'rysuj_kadry', 'udostepnij_link']);
  const BEZ_PROJEKTU = new Set(['projekty', 'nowy_projekt', 'kopiuj_projekt', 'usun_projekt', 'opis_formatu', 'stan_eksportu', 'biblioteka']);
  const PARAMETR_PROJEKTU = tekst('id albo nazwa projektu; można pominąć, gdy klucz obejmuje jeden projekt.');

  async function obsluz(w, stanSesji = {}) {
    if (!w || w.jsonrpc !== '2.0' || typeof w.method !== 'string') {
      return w && w.id !== undefined ? { jsonrpc: '2.0', id: w.id, error: { code: BLEDY.ZADANIE, message: 'Nieprawidłowe żądanie JSON-RPC.' } } : null;
    }
    const { id, method, params = {} } = w;
    const powiadomienie = id === undefined || id === null;
    const wynik = (result) => (powiadomienie ? null : { jsonrpc: '2.0', id, result });
    const blad = (code, message, data) => (powiadomienie ? null : { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });
    const nowy = !stanSesji.zainicjowany; // bez initialize: tryb wersji 2026-07-28 (wersja w _meta każdego żądania)
    const wersja = params?._meta?.['io.modelcontextprotocol/protocolVersion'];
    const obslugiwane = [...WERSJE_NOWE, ...WERSJE_STARE];
    if (wersja && !obslugiwane.includes(wersja) && method !== 'initialize') {
      return blad(BLEDY.WERSJA, 'Unsupported protocol version', { supported: obslugiwane, requested: wersja });
    }
    // Tryb 2026-07-28: wersja w _meta żądania albo wcześniejsze server/discover w tej samej sesji (stdio).
    const nowoczesny = nowy && (wersja || stanSesji.odkryty);
    const zakonczony = (x) => (nowoczesny ? { resultType: 'complete', ...x } : x);
    // Wersja 2026-07-28: listy i server/discover muszą mieć wskazówki pamięci podręcznej (CacheableResult) –
    // bez nich Claude Desktop odrzuca listę narzędzi („Invalid result for tools/list: ttlMs…”). Krótki czas,
    // żeby nowe narzędzia docierały szybko; „private”, bo lista zależy od klienta (pliki_z_czatu tylko dla ChatGPT).
    const PAMIEC = { ttlMs: 60000, cacheScope: 'private' };
    // Wskazówki pamięci zawsze (starsi klienci pomijają nieznane pola), resultType – tylko w trybie 2026-07-28.
    const doPamieci = (x) => ({ ...zakonczony(x), ...PAMIEC });
    const info = {
      name: NAZWA, title: 'Makietka', version: WERSJA, websiteUrl: ADRES_APLIKACJI,
      icons: [
        { src: `${ADRES_APLIKACJI}img/ikony/ikona-192.png`, mimeType: 'image/png', sizes: ['192x192'] },
        { src: `${ADRES_APLIKACJI}img/ikony/ikona.svg`, mimeType: 'image/svg+xml', sizes: ['any'] },
      ],
    };

    switch (method) {
      case 'initialize': { // starsze wersje: wymiana initialize
        const chce = params.protocolVersion;
        stanSesji.zainicjowany = true;
        stanSesji.wersja = WERSJE_STARE.includes(chce) ? chce : WERSJE_STARE[0];
        return wynik({ protocolVersion: stanSesji.wersja, capabilities: { tools: { listChanged: false } }, serverInfo: info, instructions: angielski ? (rysowanie ? INSTRUKCJE_EN_PELNE : INSTRUKCJE_EN_BEZ_RYSOWANIA) : (rysowanie ? INSTRUKCJE_PELNE : INSTRUKCJE_BEZ_RYSOWANIA) });
      }
      case 'server/discover':
        stanSesji.odkryty = true;
        return wynik({
          resultType: 'complete', ...PAMIEC, supportedVersions: obslugiwane, capabilities: { tools: {} },
          _meta: { 'io.modelcontextprotocol/serverInfo': info }, instructions: angielski ? (rysowanie ? INSTRUKCJE_EN_PELNE : INSTRUKCJE_EN_BEZ_RYSOWANIA) : (rysowanie ? INSTRUKCJE_PELNE : INSTRUKCJE_BEZ_RYSOWANIA),
        });
      case 'ping':
        return wynik(zakonczony({}));
      case 'tools/list':
        return wynik(doPamieci({ tools: listaNarzedzi() }));
      case 'tools/call': {
        // Angielska albo polska nazwa (#410) – w środku polska.
        const nazwa = nazwaWewnetrzna(params.name);
        const n = NARZEDZIA.find((x) => x.name === nazwa && (rysowanie || !RYSUJACE.has(x.name)));
        if (!n) return blad(BLEDY.PARAMETRY, angielski ? `Unknown tool: ${params.name}` : `Nieznane narzędzie: ${params.name}`);
        try {
          const argumenty = { ...argumentyZEn(params.arguments || {}, pelnySchemat(n.name), n.name) };
          let wykonawca = n;
          if (!BEZ_PROJEKTU.has(n.name)) {
            const pod = await dlaProjektu(argumenty.projekt);
            delete argumenty.projekt;
            if (pod) wykonawca = pod.narzedzia.find((x) => x.name === n.name);
          }
          const tekstWyniku = await wykonawca.dzialaj(argumenty);
          return wynik(zakonczony({ content: [{ type: 'text', text: tekstWyniku }], isError: false }));
        } catch (e) {
          // Błędy wykonania wracają do AI jako wynik z isError – może poprawić wywołanie.
          return wynik(zakonczony({ content: [{ type: 'text', text: e instanceof BladBazy ? e.message : `Błąd: ${e.message}` }], isError: true }));
        }
      }
      default:
        if (method.startsWith('notifications/')) return null;
        return blad(BLEDY.METODA, `Nieznana metoda: ${method}`);
    }
  }

  return { obsluz, narzedzia: NARZEDZIA, wgrajBajty, dlaProjektu };
}
