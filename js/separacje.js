// Podgląd separacji i nadruku (#131C): rozbicie obrazu strony na płyty druku.
//
// Płyty C, M, Y, K liczy ta sama prosta zamiana co plik wektorowy w CMYK bez profilu (pdf-wektorowy.js: naCmyk
// – czerń i szarości samą czernią). Kolory dodatkowe (#127): piksele dokładnie w kolorze spotu (albo jego
// odcieniu) idą na płytę spotu, nie na CMYK. Uszlachetnienia: maska elementów danej płyty (rysowanych osobno).
// Łączne pokrycie farbą (TAC) = C+M+Y+K (+ spoty) w procentach; drukarnie zwykle przyjmują do 300% (offset
// powlekany), gazetowy ok. 240%.

// Ta sama prosta zamiana co w pdf-wektorowy.js (naCmyk) – tu bez wczytywania modułu PDF.
export function naCmyk([r, g, b]) {
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
}
import { rgbNaHex } from './kolory-druku.js';

export const PLYTY_CMYK = [
  { id: 'C', nazwa: 'Cyjan', kolor: [0, 174, 239] },
  { id: 'M', nazwa: 'Magenta', kolor: [236, 0, 140] },
  { id: 'Y', nazwa: 'Żółty', kolor: [255, 242, 0] },
  { id: 'K', nazwa: 'Czarny', kolor: [35, 31, 32] },
];
export const LIMIT_TAC = 300;

// Rozbija piksele RGBA na płyty: { w, h, plyty: Map(id → Float32Array 0..1), tacMax, ponadLimit (liczba pikseli) }.
// spoty: Map(hex → { nazwa, odcien 0..1 }) – piksele w kolorze spotu idą na płytę spotu.
// maski: Map(nazwa płyty → Uint8Array 0/1) – uszlachetnienia (nadruk – nie zmieniają CMYK).
// przelicz([r, g, b] 0..1) → [c, m, y, k] – domyślnie prosta zamiana; z profilem drukarni: silnik.wektor (js/profil-icc.js).
export function rozbij(dane, w, h, { spoty = new Map(), maski = new Map(), limit = LIMIT_TAC, przelicz = naCmyk } = {}) {
  const pamiec = new Map(); // ten sam kolor liczy się raz (profil jest wolniejszy)
  const n = w * h;
  const plyty = new Map(PLYTY_CMYK.map((p) => [p.id, new Float32Array(n)]));
  for (const s of new Set([...spoty.values()].map((x) => x.nazwa))) plyty.set(s, new Float32Array(n));
  const tac = new Float32Array(n);
  let tacMax = 0; let ponadLimit = 0;
  for (let i = 0; i < n; i += 1) {
    const r = dane[i * 4]; const g = dane[i * 4 + 1]; const b = dane[i * 4 + 2]; const a = dane[i * 4 + 3] / 255;
    if (a === 0) continue;
    // Piksel półprzezroczysty – na białym papierze.
    const R = (r * a + 255 * (1 - a)) / 255; const G = (g * a + 255 * (1 - a)) / 255; const B = (b * a + 255 * (1 - a)) / 255;
    const spot = spoty.size ? spoty.get(rgbNaHex(R * 255, G * 255, B * 255)) : null;
    let suma = 0;
    if (spot) {
      plyty.get(spot.nazwa)[i] = spot.odcien;
      suma = spot.odcien;
    } else {
      const klucz = (r << 16) | (g << 8) | b | (Math.round(a * 15) << 24);
      let cmyk = pamiec.get(klucz);
      if (!cmyk) { cmyk = przelicz([R, G, B]); pamiec.set(klucz, cmyk); }
      const [c, m, y, k] = cmyk;
      plyty.get('C')[i] = c; plyty.get('M')[i] = m; plyty.get('Y')[i] = y; plyty.get('K')[i] = k;
      suma = c + m + y + k;
    }
    tac[i] = suma * 100;
    if (tac[i] > tacMax) tacMax = tac[i];
    if (tac[i] > limit + 0.5) ponadLimit += 1;
  }
  for (const [nazwa, m] of maski) plyty.set(nazwa, Float32Array.from(m));
  return { w, h, plyty, tac, tacMax: Math.round(tacMax), ponadLimit };
}

// Obraz do pokazania: wybrane płyty nałożone (kolor farby na papierze, mnożenie) albo jedna płyta w odcieniach
// szarości (czerń = 100% farby). zaznacz: { tac: liczba } – piksele powyżej limitu na czerwono; nadruk – płyty
// uszlachetnień jako półprzezroczysta nakładka. kolory: Map(id płyty → [r, g, b]).
export function obrazPlyt(rozbite, { wlaczone, kolory, jedna = false, tac = null, nadruk = new Set() } = {}) {
  const { w, h, plyty } = rozbite;
  const wynik = new Uint8ClampedArray(w * h * 4);
  const lista = [...wlaczone].filter((id) => plyty.has(id));
  for (let i = 0; i < w * h; i += 1) {
    let r = 255; let g = 255; let b = 255;
    if (jedna && lista.length === 1) {
      const v = 255 * (1 - plyty.get(lista[0])[i]);
      r = v; g = v; b = v;
    } else {
      for (const id of lista) {
        const t = plyty.get(id)[i];
        if (!t || nadruk.has(id)) continue;
        const [kr, kg, kb] = kolory.get(id) || [0, 0, 0];
        // Farba na papierze: mnożenie przez kolor farby w odcieniu t.
        r *= 1 - t * (1 - kr / 255); g *= 1 - t * (1 - kg / 255); b *= 1 - t * (1 - kb / 255);
      }
      // Uszlachetnienia z nadrukiem: kreskowana nakładka w kolorze płyty.
      for (const id of lista) {
        if (!nadruk.has(id) || !plyty.get(id)[i]) continue;
        const [kr, kg, kb] = kolory.get(id) || [0, 160, 255];
        const kres = ((i % w) + Math.floor(i / w)) % 6 < 3 ? 0.55 : 0.3;
        r = r * (1 - kres) + kr * kres; g = g * (1 - kres) + kg * kres; b = b * (1 - kres) + kb * kres;
      }
    }
    if (tac !== null && rozbite.tac[i] > tac + 0.5) { r = 230; g = 30; b = 60; }
    wynik[i * 4] = r; wynik[i * 4 + 1] = g; wynik[i * 4 + 2] = b; wynik[i * 4 + 3] = 255;
  }
  return wynik;
}

// Maska elementów uszlachetnienia: piksele obrazu z samą płytą, które różnią się od tła (tlo: [r, g, b]).
export function maskaZRoznicy(dane, w, h, tlo = [255, 255, 255]) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    const d = Math.abs(dane[i * 4] - tlo[0]) + Math.abs(dane[i * 4 + 1] - tlo[1]) + Math.abs(dane[i * 4 + 2] - tlo[2]);
    if (dane[i * 4 + 3] > 20 && d > 24) m[i] = 1;
  }
  return m;
}

// Silnik profilu drukarni wczytany przy podglądzie separacji albo eksporcie PDF/X – „Sprawdź przed drukiem” liczy nim
// pokrycie farbą kolorów elementów (bez profilu prosta zamiana nie przekracza 300%: czerń idzie samą czernią).
let silnik = null;
export const ustawSilnikTac = (s) => { silnik = s || null; };
export const silnikTac = () => silnik;

// Łączne pokrycie farbą koloru elementu w % (do „Sprawdź przed drukiem”): wektorowo, bez rysowania.
export function tacKoloru(kolor, profil = silnik) {
  const m = String(kolor || '').trim().match(/^#([0-9a-f]{6})$/i) || String(kolor || '').match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return 0;
  const [r, g, b] = m.length === 2 ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [m[1], m[2], m[3]].map(Number);
  const [c, mm, y, k] = profil ? profil.wektor(r / 255, g / 255, b / 255) : naCmyk([r / 255, g / 255, b / 255]);
  return Math.round((c + mm + y + k) * 100);
}
