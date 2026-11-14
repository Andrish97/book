// Filtry obrazu bez zmiany pliku (decyzja #123): jasność, kontrast, nasycenie, odcień szarości, sepia, rozmycie.
// Element obrazu (albo kształt z obrazem) ma pole `filtry`; plik w projekcie zostaje taki, jaki był.
// Przefiltrowany obraz liczy się raz na parę (obraz, ustawienia) i jest rysowany zamiast oryginału – tak samo
// na ekranie, w miniaturach, podglądzie i PDF (tam jako obraz w wybranej rozdzielczości).

export const BEZ_FILTROW = { jasnosc: 0, kontrast: 0, nasycenie: 0, szarosc: false, sepia: false, rozmycie: 0 };

export function maFiltry(f) {
  return Boolean(f && (f.jasnosc || f.kontrast || f.nasycenie || f.szarosc || f.sepia || f.rozmycie));
}

const klucz = (f) => [f.jasnosc || 0, f.kontrast || 0, f.nasycenie || 0, f.szarosc ? 1 : 0, f.sepia ? 1 : 0, f.rozmycie || 0].join(',');

// Rozmycie pudełkowe w miejscu (trzy przebiegi ≈ rozmycie Gaussa), kanały RGBA.
function rozmyj(d, w, h, r) {
  if (r < 1) return;
  const tmp = new Float32Array(d.length);
  const linia = (z, na, dl, krok, linie, krokLinii) => {
    for (let l = 0; l < linie; l += 1) {
      for (let c = 0; c < 4; c += 1) {
        const pocz = l * krokLinii * 4 + c;
        let suma = 0; let ile = 0;
        for (let k = 0; k <= r && k < dl; k += 1) { suma += z[pocz + k * krok * 4]; ile += 1; }
        for (let k = 0; k < dl; k += 1) {
          na[pocz + k * krok * 4] = suma / ile;
          if (k - r >= 0) { suma -= z[pocz + (k - r) * krok * 4]; ile -= 1; }
          if (k + r + 1 < dl) { suma += z[pocz + (k + r + 1) * krok * 4]; ile += 1; }
        }
      }
    }
  };
  for (let p = 0; p < 3; p += 1) { linia(d, tmp, w, 1, h, w); linia(tmp, d, h, w, w, 1); }
}

// Piksele RGBA → przefiltrowane w miejscu.
export function filtrujPiksele(d, w, h, f) {
  const b = (f.jasnosc || 0) * 2.55;
  const c = Math.max(-99, Math.min(99, f.kontrast || 0)) * 2.55;
  const kf = (259 * (c + 255)) / (255 * (259 - c));
  const s = 1 + (f.nasycenie || 0) / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]; let g = d[i + 1]; let bl = d[i + 2];
    if (b) { r += b; g += b; bl += b; }
    if (c) { r = kf * (r - 128) + 128; g = kf * (g - 128) + 128; bl = kf * (bl - 128) + 128; }
    const szary = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    if (f.szarosc) { r = szary; g = szary; bl = szary; } else if (s !== 1) { r = szary + (r - szary) * s; g = szary + (g - szary) * s; bl = szary + (bl - szary) * s; }
    if (f.sepia) {
      const [r0, g0, b0] = [r, g, bl];
      r = 0.393 * r0 + 0.769 * g0 + 0.189 * b0; g = 0.349 * r0 + 0.686 * g0 + 0.168 * b0; bl = 0.272 * r0 + 0.534 * g0 + 0.131 * b0;
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = bl;
  }
  if (f.rozmycie) rozmyj(d, w, h, Math.round((Math.min(100, f.rozmycie) / 100) * Math.max(w, h) * 0.02));
}

const pamiec = new WeakMap();
// Przefiltrowany obraz (canvas tej samej wielkości co element) albo sam element, gdy filtrów nie ma.
export function przefiltrowany(el, f) {
  if (!el || !maFiltry(f)) return el;
  const k = klucz(f);
  const byl = pamiec.get(el);
  if (byl?.klucz === k) return byl.plotno;
  const w = el.naturalWidth || el.width; const h = el.naturalHeight || el.height;
  if (!w || !h) return el;
  const plotno = document.createElement('canvas');
  plotno.width = w; plotno.height = h;
  const ctx = plotno.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(el, 0, 0);
  try {
    const dane = ctx.getImageData(0, 0, w, h);
    filtrujPiksele(dane.data, w, h, f);
    ctx.putImageData(dane, 0, 0);
  } catch { return el; } // obraz z obcego źródła – bez filtrów
  plotno.dataset.powod = 'filtry obrazu'; // PDF: element z filtrami idzie jako obraz (js/pdf-wektorowy.js)
  pamiec.set(el, { klucz: k, plotno });
  return plotno;
}
