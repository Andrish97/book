// Własny koder animowanego GIF (#181) – bez bibliotek z CDN. Używa go makieta 3D (animacja obrotu
// i kartkowania). Paleta stała: 6 × 7 × 6 odcieni (252 kolory) z ditheringiem uporządkowanym (macierz Bayera
// 4 × 4) – gładkie przejścia tła i cieni bez pasów; kompresja LZW według specyfikacji GIF89a.
import { t as tt } from './jezyk.js';

const POZIOMY_R = 6;
const POZIOMY_G = 7;
const POZIOMY_B = 6;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Paleta: 256 wpisów RGB (ostatnie 4 – czarne, nieużywane).
export function paletaGif() {
  const p = new Uint8Array(256 * 3);
  let i = 0;
  for (let r = 0; r < POZIOMY_R; r += 1) for (let g = 0; g < POZIOMY_G; g += 1) for (let b = 0; b < POZIOMY_B; b += 1) {
    p[i * 3] = Math.round((r * 255) / (POZIOMY_R - 1));
    p[i * 3 + 1] = Math.round((g * 255) / (POZIOMY_G - 1));
    p[i * 3 + 2] = Math.round((b * 255) / (POZIOMY_B - 1));
    i += 1;
  }
  return p;
}

// Piksele RGBA (ImageData.data) → indeksy palety.
export function indeksyGif(dane, w, h) {
  const wynik = new Uint8Array(w * h);
  const kr = (v, poziomy, prog) => {
    const x = (v / 255) * (poziomy - 1);
    const d = Math.floor(x);
    return Math.min(poziomy - 1, x - d > prog ? d + 1 : d);
  };
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const i = y * w + x;
    const prog = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    const r = kr(dane[i * 4], POZIOMY_R, prog);
    const g = kr(dane[i * 4 + 1], POZIOMY_G, prog);
    const b = kr(dane[i * 4 + 2], POZIOMY_B, prog);
    wynik[i] = (r * POZIOMY_G + g) * POZIOMY_B + b;
  }
  return wynik;
}

// Bajty do pliku – rosnąca tablica.
class Bufor {
  constructor() { this.b = new Uint8Array(1 << 16); this.n = 0; }
  bajt(v) {
    if (this.n >= this.b.length) { const nowy = new Uint8Array(this.b.length * 2); nowy.set(this.b); this.b = nowy; }
    this.b[this.n] = v & 255;
    this.n += 1;
  }
  bajty(lista) { for (const v of lista) this.bajt(v); }
  slowo(v) { this.bajt(v & 255); this.bajt((v >> 8) & 255); }
  tekst(t) { for (const c of t) this.bajt(c.charCodeAt(0)); }
  wynik() { return this.b.slice(0, this.n); }
}

// LZW obrazu (indeksy 8-bitowe) w podblokach po najwyżej 255 bajtów.
function lzw(bufor, indeksy, minKod = 8) {
  bufor.bajt(minKod);
  const czysc = 1 << minKod;
  const koniec = czysc + 1;
  let rozmiar = minKod + 1;
  let nastepny = koniec + 1;
  let tablica = new Map();
  let akumulator = 0;
  let bity = 0;
  const blok = [];
  const wypchnij = () => { bufor.bajt(blok.length); bufor.bajty(blok); blok.length = 0; };
  const kod = (k) => {
    akumulator |= k << bity;
    bity += rozmiar;
    while (bity >= 8) {
      blok.push(akumulator & 255);
      if (blok.length === 255) wypchnij();
      akumulator >>>= 8;
      bity -= 8;
    }
  };
  kod(czysc);
  let prefiks = indeksy[0];
  for (let i = 1; i < indeksy.length; i += 1) {
    const k = indeksy[i];
    const klucz = (prefiks << 8) | k;
    const znany = tablica.get(klucz);
    if (znany !== undefined) { prefiks = znany; continue; }
    kod(prefiks);
    if (nastepny === 4096) {
      kod(czysc);
      nastepny = koniec + 1;
      rozmiar = minKod + 1;
      tablica = new Map();
    } else {
      if (nastepny >= 1 << rozmiar) rozmiar += 1;
      tablica.set(klucz, nastepny);
      nastepny += 1;
    }
    prefiks = k;
  }
  kod(prefiks);
  kod(koniec);
  if (bity > 0) blok.push(akumulator & 255);
  if (blok.length) wypchnij();
  bufor.bajt(0); // koniec danych obrazu
}

// Koder: new KoderGif(w, h, { opoznienie (setne sekundy), petla }), dodaj(daneRGBA) dla każdej klatki, zakoncz() → Uint8Array.
export class KoderGif {
  constructor(w, h, { opoznienie = 6, petla = true } = {}) {
    this.w = w;
    this.h = h;
    this.opoznienie = opoznienie;
    const b = new Bufor();
    b.tekst(tt('gif.gif89a'));
    b.slowo(w);
    b.slowo(h);
    b.bajt(0xf7); // globalna paleta, 8 bitów na kolor, 256 wpisów
    b.bajt(0);
    b.bajt(0);
    b.bajty(paletaGif());
    if (petla) {
      b.bajty([0x21, 0xff, 11]);
      b.tekst(tt('gif.netscape20'));
      b.bajty([3, 1, 0, 0, 0]);
    }
    this.bufor = b;
    this.klatek = 0;
  }

  dodaj(dane) {
    const b = this.bufor;
    b.bajty([0x21, 0xf9, 4, 0x04, this.opoznienie & 255, (this.opoznienie >> 8) & 255, 0, 0]); // bez przezroczystości
    b.bajt(0x2c);
    b.slowo(0);
    b.slowo(0);
    b.slowo(this.w);
    b.slowo(this.h);
    b.bajt(0);
    lzw(b, indeksyGif(dane, this.w, this.h));
    this.klatek += 1;
  }

  zakoncz() {
    this.bufor.bajt(0x3b);
    return this.bufor.wynik();
  }
}

// Cały GIF z listy klatek RGBA tej samej wielkości.
export function zakodujGif(klatki, w, h, opcje = {}) {
  const k = new KoderGif(w, h, opcje);
  for (const d of klatki) k.dodaj(d);
  return k.zakoncz();
}
