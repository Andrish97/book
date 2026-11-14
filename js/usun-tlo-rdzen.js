// Usuwanie tła bez AI (decyzja #123) – rachunki na pikselach, bez DOM (działają też w osobnym wątku).
//
// Maska: Uint8Array o długości szer × wys, 255 – piksel zostaje, 0 – piksel usunięty.
// Różdżka: piksele o kolorze podobnym do klikniętego (odległość w RGB w procentach największej możliwej)
// – tylko połączone z klikniętym miejscem albo wszystkie na obrazie. Wygładzenie krawędzi: rozmycie maski,
// żeby brzeg nie był poszarpany (przezroczystość przechodzi łagodnie na kilku pikselach).

// dane: RGBA (Uint8ClampedArray); zwraca nową maskę (stara zostaje do cofania).
export function rozdzka(dane, szer, wys, maska, x, y, tolerancja, ciagle) {
  const wynik = new Uint8Array(maska);
  const sx = Math.max(0, Math.min(szer - 1, Math.floor(x)));
  const sy = Math.max(0, Math.min(wys - 1, Math.floor(y)));
  const start = sy * szer + sx;
  const r0 = dane[start * 4]; const g0 = dane[start * 4 + 1]; const b0 = dane[start * 4 + 2];
  const prog = ((Math.max(0, Math.min(100, tolerancja)) / 100) * 441.68) ** 2;
  const podobny = (i) => {
    const dr = dane[i * 4] - r0; const dg = dane[i * 4 + 1] - g0; const db = dane[i * 4 + 2] - b0;
    return dr * dr + dg * dg + db * db <= prog || dane[i * 4 + 3] === 0;
  };
  if (!ciagle) {
    for (let i = 0; i < szer * wys; i += 1) if (podobny(i)) wynik[i] = 0;
    return wynik;
  }
  // Wypełnianie od klikniętego miejsca, wiersz po wierszu (bez rekurencji – duże zdjęcia).
  const odwiedzony = new Uint8Array(szer * wys);
  const stos = [start];
  odwiedzony[start] = 1;
  while (stos.length) {
    const i = stos.pop();
    if (!podobny(i)) continue;
    wynik[i] = 0;
    const px = i % szer; const py = (i - px) / szer;
    if (px > 0 && !odwiedzony[i - 1]) { odwiedzony[i - 1] = 1; stos.push(i - 1); }
    if (px < szer - 1 && !odwiedzony[i + 1]) { odwiedzony[i + 1] = 1; stos.push(i + 1); }
    if (py > 0 && !odwiedzony[i - szer]) { odwiedzony[i - szer] = 1; stos.push(i - szer); }
    if (py < wys - 1 && !odwiedzony[i + szer]) { odwiedzony[i + szer] = 1; stos.push(i + szer); }
  }
  return wynik;
}

// Pędzel: koło o promieniu r (piksele obrazu) – usuwa (wartosc 0) albo przywraca (255). Zmienia maskę w miejscu.
export function pedzel(maska, szer, wys, x, y, r, wartosc) {
  const x0 = Math.max(0, Math.floor(x - r)); const x1 = Math.min(szer - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r)); const y1 = Math.min(wys - 1, Math.ceil(y + r));
  const r2 = r * r;
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) if ((px - x) ** 2 + (py - y) ** 2 <= r2) maska[py * szer + px] = wartosc;
  }
}

// Pociągnięcie pędzla między dwoma punktami – kółka co pół promienia, żeby szybki ruch nie zostawiał przerw.
export function pociagniecie(maska, szer, wys, a, b, r, wartosc) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const kroki = Math.max(1, Math.ceil(d / Math.max(1, r / 2)));
  for (let k = 0; k <= kroki; k += 1) pedzel(maska, szer, wys, a.x + ((b.x - a.x) * k) / kroki, a.y + ((b.y - a.y) * k) / kroki, r, wartosc);
}

// Wygładzenie krawędzi: dwa przebiegi rozmycia pudełkowego o promieniu r (poziomo i pionowo).
// Zwraca kanał krycia 0–255 (Uint8ClampedArray); r = 0 – maska bez zmian.
export function wygladz(maska, szer, wys, r) {
  const wynik = new Uint8ClampedArray(maska);
  if (!(r > 0)) return wynik;
  const tmp = new Float32Array(szer * wys);
  const przebieg = (z, na, dl, krok, linie, krokLinii) => {
    for (let l = 0; l < linie; l += 1) {
      const pocz = l * krokLinii;
      let suma = 0; let ile = 0;
      for (let k = 0; k <= r && k < dl; k += 1) { suma += z[pocz + k * krok]; ile += 1; }
      for (let k = 0; k < dl; k += 1) {
        na[pocz + k * krok] = suma / ile;
        const wych = k - r; const wch = k + r + 1;
        if (wych >= 0) { suma -= z[pocz + wych * krok]; ile -= 1; }
        if (wch < dl) { suma += z[pocz + wch * krok]; ile += 1; }
      }
    }
  };
  for (let p = 0; p < 2; p += 1) {
    przebieg(p ? wynik : maska, tmp, szer, 1, wys, szer);
    przebieg(tmp, wynik, wys, szer, szer, 1);
  }
  return wynik;
}

// Obraz wynikowy: kolory oryginału, krycie = krycie oryginału × wygładzona maska.
export function skladaj(dane, krycie) {
  const out = new Uint8ClampedArray(dane);
  for (let i = 0; i < krycie.length; i += 1) out[i * 4 + 3] = Math.round((dane[i * 4 + 3] * krycie[i]) / 255);
  return out;
}

// Kod dla osobnego wątku przeglądarki (Web Worker): różdżka na dużych zdjęciach nie zamraża okna.
export const KOD_WATKU = `const rozdzka = ${rozdzka.toString()};
onmessage = (e) => { const { dane, szer, wys, maska, x, y, tolerancja, ciagle } = e.data; const w = rozdzka(dane, szer, wys, maska, x, y, tolerancja, ciagle); postMessage(w, [w.buffer]); };`;
