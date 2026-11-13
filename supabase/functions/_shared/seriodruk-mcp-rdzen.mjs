// Rdzeń serwera MCP Seriodruku – wspólny dla serwera stdio (ai/mcp/seriodruk-mcp.mjs, składany z tego pliku
// przez scripts/mcp-buduj.cjs) i zdalnego łącznika (supabase/functions/mcp/index.ts, Funkcja Edge Supabase).
// Bez modułów Node ani Deno: tylko fetch, crypto.randomUUID i zwykły JavaScript – działa w obu środowiskach.
//
// utworzSerwer({ adres, kluczPubliczny, klucz, czytajOpis, brakKlucza, czytajPliki, pobierzAdres }) → { obsluz(wiadomosc, stanSesji) }
// obsluz przyjmuje jedną wiadomość JSON-RPC i zwraca odpowiedź (albo null dla powiadomienia).
// czytajPliki(sciezki) – tylko serwer u siebie (stdio): obrazy z dysku (pliki albo folder) → [{ bajty, nazwa }];
// pobierzAdres(adres) – pobieranie obrazu z internetu (domyślnie: tylko https, bez sieci prywatnych).

export const NAZWA = 'seriodruk';
export const WERSJA = '1.3.1';
export const WERSJE_NOWE = ['2026-07-28'];
export const WERSJE_STARE = ['2025-11-25', '2025-06-18', '2025-03-26'];
export const BLEDY = { PARSE: -32700, ZADANIE: -32600, METODA: -32601, PARAMETRY: -32602, WEWNETRZNY: -32603, WERSJA: -32022, NAGLOWKI: -32020 };
const ADRES_OPISU = 'https://andrish97.github.io/book/ai/format-seriodruk.md';
const ADRES_APLIKACJI = 'https://andrish97.github.io/book/';

// Te same listy co w aplikacji (js/pola.js, js/style-tekstu.js) – test pilnuje, żeby się zgadzały.
export const POLA_DOKUMENTU = ['nr', 'nr_ogolny', 'nr_w_sekcji', 'liczba_stron', 'liczba_stron_sekcji', 'sekcja', 'nr_sekcji', 'strona', 'projekt', 'seria', 'egzemplarz', 'liczba_egzemplarzy', 'data', 'rok', 'poczatek', 'koniec', 'nr_strony'];
export const POLA_STYLU = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'lineHeight', 'charSpacing', 'fill', 'textAlign'];
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
  return Object.entries(p.zasoby || {}).filter(([id, z]) => z && !czcionki.has(id));
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
function przygotujElement(e) {
  const o = kopia(e);
  if (!o.id) o.id = noweId('o');
  if (typeof o.type === 'string') o.type = o.type.toLowerCase();
  if (o.type === 'textbox' && o.strokeWidth === undefined) o.strokeWidth = 0;
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

function przeglad(w) {
  const p = w.projekt;
  const wiersz = (o) => `${o.id} (${o.type}${o.text != null ? `: „${krotko(o.text, 40)}”` : ''}${o.zasob ? `: obraz ${p.zasoby?.[o.zasob]?.nazwa || o.zasob}` : ''}${o.tabela ? ': tabela' : ''})`;
  return [
    `Projekt „${p.nazwa}” – wersja ${w.wersja}. Dostęp: ${w.dostep.rola === 'edycja' ? 'czytanie i zmiany' : 'tylko czytanie'}, ważny do ${w.dostep.wazny_do}.`,
    `Sekcje: ${(p.sekcje || []).map((s) => `${s.id} „${s.nazwa}” ${s.wydruk?.szerokosc_mm}×${s.wydruk?.wysokosc_mm} mm, ${s.uklad || 'pojedyncze'}`).join('; ')}`,
    `Strony (${p.strony.length}, w tej kolejności):`,
    ...p.strony.map((s, i) => `  ${i + 1}. ${s.id} „${s.nazwa || ''}” sekcja=${s.sekcja}${s.seria ? ` seria=${s.seria}` : ''} – ${(s.obiekty || []).map(wiersz).join(', ') || 'pusta'}`),
    `Wzorce: ${(p.wzorce || []).map((x) => `${x.id} „${x.nazwa}” (${(x.obiekty || []).length} el.)`).join('; ') || 'brak'}`,
    `Style: ${(p.style || []).map((x) => `${x.id} „${x.nazwa}”`).join('; ') || 'brak'}`,
    `Tabele: ${(p.tabele || []).map((t) => `${t.id} „${t.nazwa}” kolumny: ${(t.kolumny || []).join(', ')}; ${(t.wiersze || []).length} wierszy`).join(' | ') || 'brak'}`,
    `Serie: ${(p.serie || []).map((s) => `${s.id} „${s.nazwa}” tabela=${s.tabela || '–'} tryb=${s.tryb || 'tabela'}`).join('; ') || 'brak'}`,
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
          const nazwy = [...new Set(t.wiersze.map((w) => String(w[i] ?? '').trim()).filter((n) => n && !/^\[\s*pomi[nń]\s*\]$/i.test(n)))];
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
const tekst = (opis) => ({ type: 'string', description: opis });
const obiekt = (opis) => ({ type: 'object', description: opis, additionalProperties: true });
const GDZIE = tekst('„strona:<id strony>” albo „wzorzec:<id wzorca>”.');

const INSTRUKCJE = 'Narzędzia czytają i zmieniają jeden projekt Seriodruku (edytor kalendarzy i publikacji z danymi), równolegle z właścicielem, który może mieć go otwartego w edytorze. Zacznij od przeglad_projektu. Wymiary są w milimetrach (rozmiar pisma też: pt × 25,4 / 72). Zmieniaj możliwie małymi krokami (zmien_elementy, zmien_tabele, zmien_czesc); zmien_projekt tylko dla zmian, których inne narzędzia nie obejmują. Przed większymi zmianami przeczytaj opis_formatu. Strony powtarzane robi się serią z tabeli, nie kopiami stron. Obrazy: wgraj_obraz (adres https, kod SVG, base64) dodaje plik do projektu, wstaw_obraz stawia go na stronie jako pojedynczy element, obrazy_projektu je wymienia. Pliki, które masz w swoim środowisku (miejsce robocze, załącznik w piaskownicy), wgrywasz sam przez wgraj_czesciami – kawałkami base64 przez łącznik, bez żadnego dostępu sieci (ZIP rozpakuj u siebie). To dobra droga dla grafik do kilkuset KB. Duże zdjęcia albo pliki, do których nie sięgasz: wywołaj link_do_wgrywania i daj użytkownikowi link – wrzuci je sam, potem sprawdź obrazy_projektu i działaj dalej. Nigdy nie odpowiadaj, że się nie da albo że nie masz dostępu do jego plików. Nie łącz się z bazą z własnej piaskownicy – używaj narzędzi łącznika Seriodruk i nie proś użytkownika o odblokowanie domen ani zmianę ustawień sieci.';

export function utworzSerwer({ adres, kluczPubliczny, klucz, czytajOpis = null, brakKlucza = 'Brak klucza dostępu (klucz z aplikacji: menu ⋯ → Dostęp dla AI).', czytajPliki = null, pobierzAdres = pobierzZAdresu, plikiZCzatu = false }) {
  const ADRES = String(adres || '').replace(/\/+$/, '');
  const KLUCZ_PUBLICZNY = kluczPubliczny;
  const KLUCZ = String(klucz || '').trim();
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

  async function pobierz() {
    if (!KLUCZ) throw new BladBazy(BRAK_KLUCZA);
    const w = await rpc('ai_projekt', { p_klucz: KLUCZ });
    if (w?.blad) throw new BladBazy(w.blad);
    return w; // { dostep, wersja, projekt }
  }


  // Pobierz → zmień → zapisz z numerem wersji. Przy odmowie (projekt zmienił się w międzyczasie, np. ktoś
  // pisze w edytorze) pobiera projekt na nowo i nanosi zmianę jeszcze raz – raz.
  async function zmien(zmiana) {
    for (let proba = 0; proba < 2; proba += 1) {
      const { projekt, wersja } = await pobierz();
      const { zmiany, opis } = zmiana(projekt);
      if (!zmiany || !Object.keys(zmiany).length) return opis || 'Nic do zmiany.';
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

  const NARZEDZIA = [
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
      description: 'Zmienia pola elementów (po id) na stronie albo we wzorcu – np. tekst, kolor (fill), położenie (left, top w mm), rozmiar pisma (fontSize w mm), z_danych, pole. Podawaj tylko zmieniane pola; null usuwa pole.',
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
      description: 'Dodaje elementy (JSON elementów jak w opisie formatu: textbox, rect, ellipse, line, path, polygon, image z istniejącym zasobem – prościej narzędziem wstaw_obraz, group/tabela) na stronę albo do wzorca. Bez id – nadam. Nowe elementy trafiają na wierzch, chyba że podasz „przed” (id elementu).',
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
      description: 'Lista obrazów projektu (to samo co okno „Obrazy projektu” w aplikacji): id, nazwa z rozszerzeniem, wymiary w pikselach i gdzie obraz jest użyty (strony, wzorce, dane w tabelach, albo „nieużywany”), do tego powtórzenia (kopie tego samego pliku, powtórzone nazwy). Nazwy wpisuje się w kolumny tabel danych; id albo nazwę podaje się narzędziom wstaw_obraz, zmien_nazwe_obrazu, podmien_obraz i usun_obrazy.',
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
- adres – plik w internecie (https). Działa też link udostępniania z Dysku Google („każdy, kto ma link”, pojedynczy plik albo ZIP) i z Dropboxa (plik albo folder – Dropbox odda folder jako ZIP). Obraz znaleziony w sieci: podaj użytkownikowi źródło i pilnuj praw autorskich.
- svg – rysunek, który sam piszesz (ozdobniki, ikony, ramki); potrzebny viewBox albo width/height; bez skryptów.
- dane_base64 – tylko małe pliki (do ok. 200 kB); większe są za drogie do przepisania.${plikiZCzatu ? '\n- pliki_z_czatu – załączniki rozmowy (ChatGPT podaje je sam); dowolna wielkość.' : ''}${czytajPliki ? '\n- plik – ścieżka na dysku tego komputera albo lista ścieżek; folder = wszystkie obrazy i ZIP-y w nim (najwyżej 50 plików).' : ''}
Pliki w Twoim środowisku (miejsce robocze, załącznik w piaskownicy): wgraj_czesciami – kawałkami przez łącznik, bez dostępu sieci. Zdjęcia, do których nie sięgasz, albo bardzo duże: NIE odmawiaj – wywołaj link_do_wgrywania i daj użytkownikowi link; wrzuci je sam (dowolna wielkość), a Ty zobaczysz je w obrazy_projektu. Ewentualnie poproś o link z Dysku Google albo Dropboxa. 
Obsługiwane: PNG, JPEG, WebP, GIF, SVG; obraz do 25 MB, pobierany plik do 50 MB, ZIP do 100 obrazów. Ten sam plik drugi raz nie wchodzi (wynik wskaże obraz, który już jest); zajęta nazwa dostaje dopisek „(2)”. zastap (id albo nazwa) – jak podmien_obraz. wstaw – od razu wstawia obraz jako pojedynczy element (pola jak w wstaw_obraz; tylko dla jednego obrazu).`,
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
        wstaw: obiekt('Opcjonalnie: { gdzie, x?, y?, szerokosc?, wysokosc?, dopasowanie? } – jak w wstaw_obraz.'),
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
      description: 'Link do aplikacji, który otwiera ten projekt od razu z oknem „Obrazy projektu”. Główna droga dla zdjęć, które użytkownik ma u siebie (z komputera, z telefonu, z załącznika rozmowy, archiwum ZIP, dowolnej wielkości) – wywołaj od razu, zamiast mówić, że nie masz dostępu do plików: wgra je tam przyciskiem „Wgraj obrazy…”, a Ty zobaczysz je potem w obrazy_projektu. Link wymaga zalogowania na konto właściciela.',
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
      description: 'Wstawia obraz z projektu (id albo nazwa z obrazy_projektu) jako pojedynczy element na stronę albo do wzorca – jak „Obraz → Wybierz z obrazów projektu” w aplikacji. Wymiary w mm. Bez rozmiaru: 60% strony, na środku. Sama szerokosc albo sama wysokosc: proporcje obrazu zachowane. szerokosc i wysokosc razem to ramka: dopasowanie „zmiesc” (cały obraz w ramce, domyślnie) albo „wypelnij” (wypełnia ramkę, brzegi przycięte wokół środka). x, y – lewy górny róg (ramki); bez nich – na środku strony.',
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
      description: 'Podmienia plik obrazu projektu na nowy – jak „Podmień plik” w oknie „Obrazy projektu”: elementy na stronach i dane w tabelach pokazują od teraz nowy plik, nazwa zostaje, stary plik znika. Źródło jak w wgraj_obraz (adres, svg, dane_base64' + (czytajPliki ? ', plik' : '') + '), jeden obraz.',
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
      description: `Wgrywa obraz, który masz u siebie (plik w miejscu roboczym, załącznik w piaskownicy), gdy nie możesz go podać inaczej: nie ma adresu w internecie, a Twoje środowisko nie łączy się z bazą. Plik idzie w kawałkach base64 w kolejnych wywołaniach tego narzędzia, a łącznik składa je po swojej stronie. Każdy bajt przechodzi przez rozmowę, więc to droga dla grafik do kilkuset KB; przy dużych zdjęciach daj użytkownikowi link z link_do_wgrywania. Jakości plików nie obniżaj bez zgody użytkownika.
Kroki:
1. krok="start": nazwa (z rozszerzeniem), rozmiar (bajty), sha256 (skrót SHA-256 treści, 64 znaki hex), kawalek (bajty, od 16384 do 524288; zalecane 49152), opcjonalnie szer, wys (px), zastap (id albo nazwa obrazu do podmiany – strony pokazują od razu nowy plik). Wynik: id wgrania i liczba kawałków. Ten sam plik już w projekcie – wynik od razu to powie.
2. krok="czesc": wgranie, nr (od 0), dane_base64 – bajty od nr×kawalek, długości kawalek (ostatni krótszy). Kolejność dowolna, powtórzenie zastępuje.
3. krok="koniec": wgranie – sprawdzam komplet i rozmiar; obraz trafia do projektu (jak wgraj_obraz). Brakujące kawałki wymienię.
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
      description: 'Adres, pod który wysyłasz plik obrazu albo ZIP wprost z własnego środowiska (wykonywanie kodu, miejsce robocze z plikami): POST z treścią pliku na <adres>?nazwa=plik.jpg (opcjonalnie &zastap=<id albo nazwa> – podmiana użytego obrazu). Dowolna wielkość do limitów (obraz 25 MB, plik 50 MB), plik nie przechodzi przez rozmowę. Działa tylko, gdy Twoje środowisko już łączy się z hostem adresu (np. własny skrypt użytkownika). Gdy dostajesz błąd sieci (403, zablokowana domena) – nie proś o dopisywanie domen, tylko użyj wgraj_czesciami. Adres zawiera klucz – nie pokazuj go w odpowiedzi.',
      inputSchema: S('', {}),
      readOnly: true,
      dzialaj: async () => `POST ${ADRES}/functions/v1/mcp/${KLUCZ}/obraz?nazwa=<nazwa z rozszerzeniem>[&zastap=<id albo nazwa obrazu do podmiany>]
Treść żądania: bajty pliku (obraz albo ZIP). Odpowiedź JSON: {"wgrane":[{"nazwa","id","szer","wys","byl"}],"opis"} albo {"blad"}.
Przykład: curl -X POST --data-binary @styczen.jpg "${ADRES}/functions/v1/mcp/${KLUCZ}/obraz?nazwa=styczen.jpg"
Host do ewentualnego dopisania w dozwolonych domenach: ${new URL(ADRES).hostname}`,
    },
    {
      name: 'usun_obrazy',
      title: 'Usuń obrazy z projektu',
      description: 'Usuwa obrazy z projektu (id albo nazwy) – jak „Usuń” w oknie „Obrazy projektu”. Usuwa tylko obrazy nieużywane: obraz, który jest na stronie, we wzorcu albo w danych tabeli, zostaje, a wynik mówi, gdzie jest użyty. Użyty obraz wymieniasz na nowy plik jednym krokiem przez podmien_obraz (albo wgraj_obraz / POST z zastap): wszystkie strony, wzorce i dane pokazują od razu nowy plik, a stary znika – bez przepinania stron i bez osobnego usuwania. nieuzywane: true – usuwa wszystkie nieużywane obrazy. Plik znika też z konta właściciela.',
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
      description: 'Zmienia tabelę danych (po id; nowa, jeśli nie ma – wtedy podaj nazwa i kolumny): nazwa, kolumny (pełna lista), ustaw komórki [{ wiersz (od 0), kolumna (nazwa), wartosc }], dodaj_wiersze (listy wartości w kolejności kolumn; wiersz „[pomiń]” w pierwszej komórce zajmuje miejsce w bloku serii, ale strona nie powstaje), usun_wiersze (numery od 0), wiersze (zastępuje wszystkie), listy ({ kolumna: [dozwolone wartości] }).',
      inputSchema: S('', {
        id: tekst('id tabeli'), nazwa: tekst('nazwa tabeli'), kolumny: { type: 'array', items: { type: 'string' } },
        ustaw: { type: 'array', items: S('', { wiersz: { type: 'integer' }, kolumna: { type: 'string' }, wartosc: { type: 'string' } }, ['wiersz', 'kolumna', 'wartosc']) },
        dodaj_wiersze: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
        usun_wiersze: { type: 'array', items: { type: 'integer' } },
        wiersze: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
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
          const stare = t.kolumny;
          t.wiersze = t.wiersze.map((w) => a.kolumny.map((k) => { const i = stare.indexOf(k); return i >= 0 ? (w[i] ?? '') : ''; }));
          t.kolumny = a.kolumny;
        }
        if (a.wiersze) t.wiersze = a.wiersze;
        for (const u of a.ustaw || []) {
          const k = t.kolumny.indexOf(u.kolumna);
          if (k < 0) throw new BladBazy(`Tabela „${t.nazwa}” nie ma kolumny „${u.kolumna}”.`);
          while (t.wiersze.length <= u.wiersz) t.wiersze.push(t.kolumny.map(() => ''));
          t.wiersze[u.wiersz][k] = u.wartosc;
        }
        if (a.usun_wiersze) t.wiersze = t.wiersze.filter((_, i) => !a.usun_wiersze.includes(i));
        for (const w of a.dodaj_wiersze || []) t.wiersze.push(t.kolumny.map((_, i) => String(w[i] ?? '')));
        if (a.listy) t.listy = { ...(t.listy || {}), ...a.listy };
        return { zmiany: { tabele: p.tabele }, opis: `Tabela „${t.nazwa}”: ${t.kolumny.length} kolumn, ${t.wiersze.length} wierszy.` };
      }),
    },
    {
      name: 'zmien_czesc',
      title: 'Zmień sekcję, wzorzec, styl, tabelę albo serię',
      description: 'Ogólna zmiana jednej części projektu po id: czesc = sekcje | wzorce | style | tabele | serie. pola – zmieniane pola (null usuwa); nowa część, jeśli id nie istnieje (podaj komplet pól, np. sekcja: nazwa, wydruk, uklad; seria: nazwa, tabela, tryb). usun: true – usuwa część. Zmiana stylu przepisuje jego wartości do wszystkich tekstów z tym stylem (jak w aplikacji); usunięcie stylu odpina go od tekstów.',
      inputSchema: S('', { czesc: { type: 'string', enum: Object.keys(CZESCI) }, id: tekst('id'), pola: obiekt('Pola'), usun: { type: 'boolean' } }, ['czesc', 'id']),
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
      name: 'zmien_projekt',
      title: 'Zmień projekt (ogólnie)',
      description: 'Ogólny zapis części projektu w jednym kroku, dla zmian, których nie obejmują inne narzędzia. zmiany: { nazwa?, sekcje?, wzorce?, style?, tabele?, serie? (pełne listy – zastępują dotychczasowe), widok?, strony? (pełne obiekty stron nowych albo zmienionych), usun_strony?, kolejnosc_stron? }. Baza sprawdza spójność (sekcje, wzorce, serie, tabele, obrazy) i odrzuca niespójne zmiany z opisem. Obrazy wgrywa wgraj_obraz, a wstawia wstaw_obraz; czcionek nie da się tu dodać.',
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
      name: 'opis_formatu',
      title: 'Opis formatu projektu',
      description: 'Pełny opis modelu projektu Seriodruku: sekcje, strony, elementy i ich pola, tabele, serie, pola w tekście, jednostki (mm). Przeczytaj przed większymi zmianami.',
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
    return NARZEDZIA.map(({ name, title, description, inputSchema, readOnly, meta }) => ({
      name, title, description, ...(meta ? { _meta: meta } : {}),
      inputSchema: { type: 'object', properties: inputSchema.properties, required: inputSchema.required, additionalProperties: false },
      annotations: { readOnlyHint: Boolean(readOnly), destructiveHint: name.startsWith('usun'), openWorldHint: name === 'wgraj_obraz' },
    }));
  }

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
      name: NAZWA, title: 'Seriodruk', version: WERSJA, websiteUrl: ADRES_APLIKACJI,
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
        return wynik({ protocolVersion: stanSesji.wersja, capabilities: { tools: { listChanged: false } }, serverInfo: info, instructions: INSTRUKCJE });
      }
      case 'server/discover':
        stanSesji.odkryty = true;
        return wynik({
          resultType: 'complete', ...PAMIEC, supportedVersions: obslugiwane, capabilities: { tools: {} },
          _meta: { 'io.modelcontextprotocol/serverInfo': info }, instructions: INSTRUKCJE,
        });
      case 'ping':
        return wynik(zakonczony({}));
      case 'tools/list':
        return wynik(doPamieci({ tools: listaNarzedzi() }));
      case 'tools/call': {
        const n = NARZEDZIA.find((x) => x.name === params.name);
        if (!n) return blad(BLEDY.PARAMETRY, `Nieznane narzędzie: ${params.name}`);
        try {
          const tekstWyniku = await n.dzialaj(params.arguments || {});
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

  return { obsluz, narzedzia: NARZEDZIA, wgrajBajty };
}
