// Obrazy: zasady wspólne dla aplikacji i łącznika AI.
//
// Kod między znacznikami WSPOLNE-POCZATEK i WSPOLNE-KONIEC jest dosłownie taki sam jak w rdzeniu łącznika
// (supabase/functions/_shared/seriodruk-mcp-rdzen.mjs) – test tests/obrazy-ai.test.cjs pilnuje, żeby się
// nie rozjechał. Bez zależności: działa w przeglądarce, w Node i w Deno.

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
