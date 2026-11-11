// Koder JPEG dla obrazów w czterech farbach (CMYK).
//
// Przeglądarka umie zapisać JPEG tylko w RGB, a zdjęcie przeliczone przez profil drukarni ma cztery farby.
// Bez tego kodera takie zdjęcie trzeba by trzymać w PDF bez strat – kilka razy większe. To zwykły JPEG
// „baseline”: bloki 8×8, przekształcenie kosinusowe, kwantyzacja, kody Huffmana ze standardowych tablic;
// cztery składowe bez zmniejszania rozdzielczości którejkolwiek i bez zamiany na inną przestrzeń barw.
// Plik nie ma znacznika Adobe: w PDF cztery składowe bez niego to wprost C, M, Y, K (0 = bez farby).

// Kolejność „zygzakiem”: miejsce w zapisie → miejsce w bloku 8×8.
const ZYGZAK = [0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63];
// Standardowa tablica kwantyzacji jasności (dla jakości 50) – używana dla wszystkich czterech farb.
const KWANTYZACJA = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99];
// Standardowe tablice Huffmana (jasność): ile kodów każdej długości 1–16 i symbole w kolejności kodów.
const DC_ILE = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_SYMBOLE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_ILE = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125];
const AC_SYMBOLE = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
  0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
  0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
];

// Kody Huffmana z opisu tablicy: symbol → [kod, długość].
function kody(ile, symbole) {
  const tablica = new Array(256);
  let kod = 0; let k = 0;
  for (let dl = 1; dl <= 16; dl += 1) {
    for (let i = 0; i < ile[dl - 1]; i += 1) { tablica[symbole[k]] = [kod, dl]; kod += 1; k += 1; }
    kod <<= 1;
  }
  if (k !== symbole.length) throw new Error('Niespójna tablica kodów JPEG.');
  return tablica;
}
const KODY_DC = kody(DC_ILE, DC_SYMBOLE);
const KODY_AC = kody(AC_ILE, AC_SYMBOLE);

// Współczynniki przekształcenia kosinusowego: C[u][x].
const KOSINUSY = new Float64Array(64);
for (let u = 0; u < 8; u += 1) for (let x = 0; x < 8; x += 1) KOSINUSY[u * 8 + x] = Math.cos(((2 * x + 1) * u * Math.PI) / 16) * (u === 0 ? Math.sqrt(1 / 8) : 0.5);

// Bufor wyjściowy, który sam rośnie, z zapisem bitów (po bajcie FF idzie zero, jak chce JPEG).
class Wyjscie {
  constructor(poczatkowo) { this.b = new Uint8Array(Math.max(1024, poczatkowo)); this.n = 0; this.bufor = 0; this.bitow = 0; }

  miejsce(ile) {
    if (this.n + ile <= this.b.length) return;
    const nowy = new Uint8Array(Math.max(this.b.length * 2, this.n + ile));
    nowy.set(this.b.subarray(0, this.n));
    this.b = nowy;
  }

  bajty(lista) { this.miejsce(lista.length); this.b.set(lista, this.n); this.n += lista.length; }

  slowo(v) { this.bajty([(v >> 8) & 255, v & 255]); }

  bity(kod, dl) {
    this.bufor = (this.bufor << dl) | kod;
    this.bitow += dl;
    while (this.bitow >= 8) {
      const bajt = (this.bufor >> (this.bitow - 8)) & 255;
      this.miejsce(2);
      this.b[this.n] = bajt; this.n += 1;
      if (bajt === 255) { this.b[this.n] = 0; this.n += 1; }
      this.bitow -= 8;
    }
    this.bufor &= (1 << this.bitow) - 1;
  }

  dopelnij() { if (this.bitow) this.bity((1 << (8 - this.bitow)) - 1, 8 - this.bitow); }

  wynik() { return this.b.slice(0, this.n); }
}

// Tablica kwantyzacji dla jakości 0–1 (skala jak w bibliotece IJG: 0,5 to tablica standardowa).
function tablicaKwantyzacji(jakosc) {
  const j = Math.min(100, Math.max(1, Math.round(jakosc * 100)));
  const skala = j < 50 ? 5000 / j : 200 - 2 * j;
  return KWANTYZACJA.map((v) => Math.min(255, Math.max(1, Math.floor((v * skala + 50) / 100))));
}

// dane: piksele CMYK wiersz po wierszu (4 bajty na piksel, 0 = bez farby), szer × wys. Zwraca bajty pliku JPEG.
// Duże zdjęcie koduje się kilka sekund, więc co kilkadziesiąt rzędów bloków funkcja oddaje głos przeglądarce
// (okno postępu może się odmalować).
export async function jpegCmyk(dane, szer, wys, jakosc = 0.92) {
  if (!(szer > 0 && wys > 0) || szer > 65535 || wys > 65535 || dane.length < szer * wys * 4) throw new Error('Złe wymiary obrazu JPEG.');
  const q = tablicaKwantyzacji(jakosc);
  const wy = new Wyjscie(Math.floor(szer * wys * 0.8));
  // Nagłówek: początek, tablica kwantyzacji, opis obrazu (4 składowe 1×1), tablice Huffmana, początek danych.
  wy.bajty([0xff, 0xd8]);
  wy.bajty([0xff, 0xdb]); wy.slowo(67); wy.bajty([0]); wy.bajty(ZYGZAK.map((i) => q[i]));
  wy.bajty([0xff, 0xc0]); wy.slowo(8 + 4 * 3); wy.bajty([8]); wy.slowo(wys); wy.slowo(szer); wy.bajty([4]);
  for (let s = 1; s <= 4; s += 1) wy.bajty([s, 0x11, 0]);
  wy.bajty([0xff, 0xc4]); wy.slowo(2 + 1 + 16 + DC_SYMBOLE.length); wy.bajty([0x00, ...DC_ILE, ...DC_SYMBOLE]);
  wy.bajty([0xff, 0xc4]); wy.slowo(2 + 1 + 16 + AC_SYMBOLE.length); wy.bajty([0x10, ...AC_ILE, ...AC_SYMBOLE]);
  wy.bajty([0xff, 0xda]); wy.slowo(6 + 2 * 4); wy.bajty([4, 1, 0x00, 2, 0x00, 3, 0x00, 4, 0x00, 0, 63, 0]);

  const blok = new Float64Array(64); const posredni = new Float64Array(64); const wsp = new Int32Array(64);
  const poprzednieDc = [0, 0, 0, 0];
  const rozmiar = (v) => { let a = v < 0 ? -v : v; let n = 0; while (a) { n += 1; a >>= 1; } return n; };
  for (let by = 0; by < wys; by += 8) {
    if (by && by % 512 === 0) await new Promise((ok) => { setTimeout(ok); });
    for (let bx = 0; bx < szer; bx += 8) {
      for (let s = 0; s < 4; s += 1) {
        // Blok 8×8 jednej farby; za krawędzią obrazu powtarza się ostatni piksel.
        for (let y = 0; y < 8; y += 1) {
          const wiersz = Math.min(wys - 1, by + y) * szer;
          for (let x = 0; x < 8; x += 1) blok[y * 8 + x] = dane[(wiersz + Math.min(szer - 1, bx + x)) * 4 + s] - 128;
        }
        // Przekształcenie kosinusowe: najpierw wiersze, potem kolumny.
        for (let y = 0; y < 8; y += 1) {
          for (let u = 0; u < 8; u += 1) {
            let suma = 0;
            for (let x = 0; x < 8; x += 1) suma += blok[y * 8 + x] * KOSINUSY[u * 8 + x];
            posredni[y * 8 + u] = suma;
          }
        }
        for (let u = 0; u < 8; u += 1) {
          for (let v = 0; v < 8; v += 1) {
            let suma = 0;
            for (let y = 0; y < 8; y += 1) suma += posredni[y * 8 + u] * KOSINUSY[v * 8 + y];
            // Współczynnik mieści się w 11 bitach; zapas na zaokrąglenia przy najwyższej jakości.
            wsp[v * 8 + u] = Math.max(-1023, Math.min(1023, Math.round(suma / q[v * 8 + u])));
          }
        }
        // Składowa stała: różnica względem poprzedniego bloku tej farby.
        const roznica = wsp[0] - poprzednieDc[s];
        poprzednieDc[s] = wsp[0];
        const rd = rozmiar(roznica);
        wy.bity(...KODY_DC[rd]);
        if (rd) wy.bity(roznica < 0 ? roznica + (1 << rd) - 1 : roznica, rd);
        // Pozostałe współczynniki zygzakiem: (ile zer przed, rozmiar) + wartość.
        let zer = 0;
        let ostatni = 63;
        while (ostatni > 0 && wsp[ZYGZAK[ostatni]] === 0) ostatni -= 1;
        for (let k = 1; k <= ostatni; k += 1) {
          const v = wsp[ZYGZAK[k]];
          if (v === 0) { zer += 1; continue; }
          while (zer > 15) { wy.bity(...KODY_AC[0xf0]); zer -= 16; }
          const r = rozmiar(v);
          wy.bity(...KODY_AC[(zer << 4) | r]);
          wy.bity(v < 0 ? v + (1 << r) - 1 : v, r);
          zer = 0;
        }
        if (ostatni < 63) wy.bity(...KODY_AC[0x00]);
      }
    }
  }
  wy.dopelnij();
  wy.bajty([0xff, 0xd9]);
  return wy.wynik();
}
