// Profile barwne ICC: odczyt profilu drukarskiego CMYK i przeliczanie kolorów sRGB → CMYK przez ten profil.
//
// Po co: drukarnia drukuje czterema farbami, a każdy papier i maszyna oddają je inaczej. Profil ICC
// opisuje konkretne warunki druku (np. FOGRA39 – offset na papierze powlekanym). Przeliczenie „przez
// profil” daje takie wartości CMYK, które na tym papierze wyglądają możliwie jak kolor z ekranu –
// w odróżnieniu od prostego wzoru, który papieru nie zna.
//
// Obsługiwane są profile CMYK z tablicami w starszym, powszechnym zapisie (typy mft1 / mft2, przestrzeń
// pośrednia Lab) – tak zbudowane są profile ECI, FOGRA, GRACoL i większość profili od drukarń.
// Sposób przeliczania: kolorymetryczny względny z kompensacją punktu czerni (domyślny w programach DTP).

const BIEL_D50 = [0.9642, 1.0, 0.8249];
// sRGB (liniowe) → XYZ przy bieli D50 (macierz po adaptacji Bradforda – ta sama, którą mają profile sRGB).
const SRGB_XYZ = [0.4360747, 0.3850649, 0.1430804, 0.2225045, 0.7168786, 0.0606169, 0.0139322, 0.0971045, 0.7141733];

const liniowo = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fLab = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (t * (24389 / 27) + 16) / 116);
const fLabOdwr = (t) => (t > 6 / 29 ? t * t * t : (116 * t - 16) / (24389 / 27));

export function srgbNaXyz(r, g, b) {
  const R = liniowo(r); const G = liniowo(g); const B = liniowo(b);
  return [SRGB_XYZ[0] * R + SRGB_XYZ[1] * G + SRGB_XYZ[2] * B, SRGB_XYZ[3] * R + SRGB_XYZ[4] * G + SRGB_XYZ[5] * B, SRGB_XYZ[6] * R + SRGB_XYZ[7] * G + SRGB_XYZ[8] * B];
}
export function xyzNaLab([x, y, z]) {
  const fx = fLab(x / BIEL_D50[0]); const fy = fLab(y / BIEL_D50[1]); const fz = fLab(z / BIEL_D50[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function labNaXyz([l, a, b]) {
  const fy = (l + 16) / 116;
  return [BIEL_D50[0] * fLabOdwr(fy + a / 500), BIEL_D50[1] * fLabOdwr(fy), BIEL_D50[2] * fLabOdwr(fy - b / 200)];
}
export const srgbNaLab = (r, g, b) => xyzNaLab(srgbNaXyz(r, g, b));

const tekst4 = (d, od) => String.fromCharCode(d.getUint8(od), d.getUint8(od + 1), d.getUint8(od + 2), d.getUint8(od + 3));

// Tablica przeliczeniowa profilu (mft1: 8 bitów, mft2: 16 bitów): krzywe wejściowe, siatka, krzywe wyjściowe.
function czytajTablice(d, od) {
  const typ = tekst4(d, od);
  if (typ !== 'mft1' && typ !== 'mft2') throw new Error(`nieobsługiwany zapis tablicy (${typ.trim() || '?'})`);
  const wej = d.getUint8(od + 8); const wyj = d.getUint8(od + 9); const siatka = d.getUint8(od + 10);
  const szesnascie = typ === 'mft2';
  const ileWej = szesnascie ? d.getUint16(od + 48) : 256;
  const ileWyj = szesnascie ? d.getUint16(od + 50) : 256;
  let p = od + (szesnascie ? 52 : 48);
  const max = szesnascie ? 65535 : 255;
  const liczba = () => { const v = szesnascie ? d.getUint16(p) : d.getUint8(p); p += szesnascie ? 2 : 1; return v / max; };
  const krzywe = (ile, n) => Array.from({ length: ile }, () => { const t = new Float32Array(n); for (let i = 0; i < n; i += 1) t[i] = liczba(); return t; });
  const tabWej = krzywe(wej, ileWej);
  const wezlow = siatka ** wej * wyj;
  const clut = new Float32Array(wezlow);
  for (let i = 0; i < wezlow; i += 1) clut[i] = liczba();
  const tabWyj = krzywe(wyj, ileWyj);
  return { wej, wyj, siatka, tabWej, clut, tabWyj, szesnascie };
}

// Odczyt profilu: { bajty, wersja, klasa, przestrzen, pcs, opis, tablica(nazwa) }.
export function czytajProfil(bufor) {
  const bajty = bufor instanceof Uint8Array ? bufor : new Uint8Array(bufor);
  if (bajty.length < 132) throw new Error('to nie jest profil ICC');
  const d = new DataView(bajty.buffer, bajty.byteOffset, bajty.byteLength);
  if (tekst4(d, 36) !== 'acsp') throw new Error('to nie jest profil ICC');
  const tagi = new Map();
  const ile = d.getUint32(128);
  for (let i = 0; i < ile; i += 1) { const p = 132 + i * 12; tagi.set(tekst4(d, p), { od: d.getUint32(p + 4), dl: d.getUint32(p + 8) }); }
  let opis = '';
  const desc = tagi.get('desc');
  if (desc && tekst4(d, desc.od) === 'desc') { const n = d.getUint32(desc.od + 8); for (let i = 0; i < n - 1; i += 1) opis += String.fromCharCode(d.getUint8(desc.od + 12 + i)); }
  const gotowe = new Map();
  return {
    bajty, opis: opis.trim(), wersja: d.getUint8(8), klasa: tekst4(d, 12), przestrzen: tekst4(d, 16).trim(), pcs: tekst4(d, 20).trim(), tagi,
    tablica(nazwa) {
      if (!gotowe.has(nazwa)) { const t = tagi.get(nazwa); gotowe.set(nazwa, t ? czytajTablice(d, t.od) : null); }
      return gotowe.get(nazwa);
    },
  };
}

// Wartość krzywej w punkcie v (0–1), z interpolacją między wpisami.
function zKrzywej(t, v) {
  const x = Math.min(1, Math.max(0, v)) * (t.length - 1);
  const i = Math.min(t.length - 2, Math.floor(x));
  return t.length === 1 ? t[0] : t[i] + (t[i + 1] - t[i]) * (x - i);
}

// Wynik tablicy dla wejścia (wartości 0–1). Interpolacja liniowa we wszystkich wymiarach siatki.
function przezTablice(t, wejscie, wynik) {
  const { wej, wyj, siatka, clut } = t;
  const indeks = new Array(wej); const ulamek = new Array(wej);
  for (let k = 0; k < wej; k += 1) {
    const x = zKrzywej(t.tabWej[k], wejscie[k]) * (siatka - 1);
    const i = Math.min(siatka - 2, Math.max(0, Math.floor(x)));
    indeks[k] = i; ulamek[k] = Math.min(1, Math.max(0, x - i));
  }
  for (let o = 0; o < wyj; o += 1) wynik[o] = 0;
  const rogow = 1 << wej;
  for (let r = 0; r < rogow; r += 1) {
    let waga = 1; let poz = 0;
    for (let k = 0; k < wej; k += 1) {
      const gora = (r >> (wej - 1 - k)) & 1;
      waga *= gora ? ulamek[k] : 1 - ulamek[k];
      poz = poz * siatka + indeks[k] + gora; // pierwszy kanał wejściowy zmienia się najwolniej
    }
    if (waga === 0) continue;
    for (let o = 0; o < wyj; o += 1) wynik[o] += waga * clut[poz * wyj + o];
  }
  for (let o = 0; o < wyj; o += 1) wynik[o] = zKrzywej(t.tabWyj[o], wynik[o]);
  return wynik;
}

// Lab ↔ zapis Lab w tablicach profilu (starszy zapis 16-bitowy ma 100 przy 65280, nie przy 65535).
const skalaL = (t, profil) => (t.szesnascie && profil.wersja < 4 ? 65280 / 65535 : 1);
const skalaAB = (t, profil) => (t.szesnascie && profil.wersja < 4 ? 65535 / 256 : 255);

// Przeliczanie kolorów przez profil wyjściowy CMYK.
export class SilnikCmyk {
  constructor(profil) {
    if (profil.przestrzen !== 'CMYK') throw new Error('profil nie opisuje druku w CMYK');
    if (profil.pcs !== 'Lab') throw new Error('profil w nieobsługiwanym układzie (potrzebny Lab)');
    this.profil = profil;
    this.doDruku = profil.tablica('B2A1') || profil.tablica('B2A0');
    this.zDruku = profil.tablica('A2B1') || profil.tablica('A2B0');
    if (!this.doDruku || !this.zDruku || this.doDruku.wej !== 3 || this.doDruku.wyj !== 4 || this.zDruku.wej !== 4) throw new Error('profil nie ma tablic przeliczeniowych CMYK');
    this.szarosci = new Map();
    this.kolory = new Map();
    // Punkt czerni druku: najciemniejsza czerń, jaką profil daje dla „czarnego” z tablicy percepcyjnej.
    const percepcyjna = profil.tablica('B2A0') || this.doDruku;
    const czern = this.lab(...this._zLab([0, 0, 0], percepcyjna));
    this.yCzerni = labNaXyz([Math.min(50, Math.max(0, czern[0])), 0, 0])[1];
  }

  // Lab → CMYK (0–1) wybraną tablicą profilu.
  _zLab(lab, t = this.doDruku) {
    const sAB = skalaAB(t, this.profil);
    return przezTablice(t, [(lab[0] / 100) * skalaL(t, this.profil), (lab[1] + 128) / sAB, (lab[2] + 128) / sAB], [0, 0, 0, 0]);
  }

  // CMYK (0–1) → Lab: jak ten zestaw farb wygląda na papierze z profilu.
  lab(c, m, y, k) {
    const t = this.zDruku;
    const w = przezTablice(t, [c, m, y, k], [0, 0, 0]);
    const sAB = skalaAB(t, this.profil);
    return [(w[0] / skalaL(t, this.profil)) * 100, w[1] * sAB - 128, w[2] * sAB - 128];
  }

  // Lab koloru sRGB po dopasowaniu czerni ekranu do czerni druku (kompensacja punktu czerni).
  _cel(r, g, b) {
    const xyz = srgbNaXyz(r, g, b);
    const s = 1 - this.yCzerni;
    return xyzNaLab([xyz[0] * s + BIEL_D50[0] * this.yCzerni, xyz[1] * s + this.yCzerni, xyz[2] * s + BIEL_D50[2] * this.yCzerni]);
  }

  // sRGB (0–1) → CMYK (0–1) przez profil. Tak przeliczane są zdjęcia.
  cmyk(r, g, b) { return this._zLab(this._cel(r, g, b)); }

  // To samo dla tekstu i kształtów: czerń i szarości idą samą czarną farbą (ostre krawędzie, bez
  // ryzyka przesunięcia czterech farb względem siebie), jasność szarości dobrana według profilu.
  wektor(r, g, b) {
    const klucz = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    if (this.kolory.has(klucz)) return this.kolory.get(klucz);
    let w;
    if (Math.abs(r - g) < 0.002 && Math.abs(g - b) < 0.002) {
      if (r >= 0.999) w = [0, 0, 0, 0];
      else if (r <= 0.001) w = [0, 0, 0, 1];
      else {
        const cel = this._cel(r, g, b)[0];
        let a = 0; let z = 1; // szukanie takiej ilości czarnej farby, która daje tę samą jasność
        for (let i = 0; i < 24; i += 1) { const s = (a + z) / 2; if (this.lab(0, 0, 0, s)[0] > cel) a = s; else z = s; }
        w = [0, 0, 0, (a + z) / 2];
      }
    } else w = this.cmyk(r, g, b).map((v) => Math.min(1, Math.max(0, v)));
    this.kolory.set(klucz, w);
    return w;
  }

  // Ilość samej czarnej farby (0–255) dla każdej szarości 0–255, o jasności dobranej według profilu –
  // do obrazów całych stron, w których czarny i szary tekst ma zostać czystą czernią.
  czernSzarosci() {
    if (!this._czern) {
      this._czern = new Uint8Array(256);
      for (let v = 0; v < 256; v += 1) this._czern[v] = Math.round(this.wektor(v / 255, v / 255, v / 255)[3] * 255);
    }
    return this._czern;
  }

  // Gotowa siatka sRGB → CMYK (33 węzły na oś) do szybkiego przeliczania milionów pikseli.
  _siatkaObrazu() {
    if (this._siatka) return this._siatka;
    const N = 33;
    const s = new Float32Array(N * N * N * 4);
    let p = 0;
    for (let r = 0; r < N; r += 1) for (let g = 0; g < N; g += 1) for (let b = 0; b < N; b += 1) {
      const w = this.cmyk(r / (N - 1), g / (N - 1), b / (N - 1));
      for (let k = 0; k < 4; k += 1) { s[p] = Math.min(1, Math.max(0, w[k])) * 255; p += 1; }
    }
    this._siatka = { N, s };
    return this._siatka;
  }

  // Piksele RGBA (jak z płótna) → bajty CMYK (4 na piksel). Przezroczystość idzie osobno, jako maska.
  obraz(rgba) {
    const { N, s } = this._siatkaObrazu();
    const n = rgba.length / 4;
    const wynik = new Uint8Array(n * 4);
    const skala = (N - 1) / 255;
    let ostatni = -1; let c0 = 0; let c1 = 0; let c2 = 0; let c3 = 0;
    for (let i = 0; i < n; i += 1) {
      const R = rgba[i * 4]; const G = rgba[i * 4 + 1]; const B = rgba[i * 4 + 2];
      const klucz = (R << 16) | (G << 8) | B;
      if (klucz !== ostatni) {
        ostatni = klucz;
        const x = R * skala; const y = G * skala; const z = B * skala;
        const xi = Math.min(N - 2, x | 0); const yi = Math.min(N - 2, y | 0); const zi = Math.min(N - 2, z | 0);
        const fx = x - xi; const fy = y - yi; const fz = z - zi;
        const baza = ((xi * N + yi) * N + zi) * 4;
        const dx = N * N * 4; const dy = N * 4; const dz = 4;
        c0 = 0; c1 = 0; c2 = 0; c3 = 0;
        for (let r = 0; r < 8; r += 1) {
          const waga = (r & 4 ? fx : 1 - fx) * (r & 2 ? fy : 1 - fy) * (r & 1 ? fz : 1 - fz);
          if (!waga) continue;
          const q = baza + (r & 4 ? dx : 0) + (r & 2 ? dy : 0) + (r & 1 ? dz : 0);
          c0 += waga * s[q]; c1 += waga * s[q + 1]; c2 += waga * s[q + 2]; c3 += waga * s[q + 3];
        }
      }
      wynik[i * 4] = c0 + 0.5; wynik[i * 4 + 1] = c1 + 0.5; wynik[i * 4 + 2] = c2 + 0.5; wynik[i * 4 + 3] = c3 + 0.5;
    }
    return wynik;
  }
}

// Najmniejszy poprawny profil sRGB (macierz + krzywa) – do opisania kolorów RGB w pliku PDF/X.
// Zbudowany tutaj z liczb definiujących sRGB, więc nie trzeba dołączać cudzego pliku.
export function profilSrgb() {
  const s15 = (v) => Math.round(v * 65536);
  const opis = 'sRGB IEC61966-2.1';
  const prawa = 'Public Domain';
  const tagDesc = (() => {
    const dl = 12 + opis.length + 1 + 8 + 3 + 67;
    const b = new Uint8Array(Math.ceil(dl / 4) * 4); const d = new DataView(b.buffer);
    b.set([0x64, 0x65, 0x73, 0x63]); d.setUint32(8, opis.length + 1);
    for (let i = 0; i < opis.length; i += 1) b[12 + i] = opis.charCodeAt(i);
    return b;
  })();
  const tagText = (() => {
    const b = new Uint8Array(Math.ceil((8 + prawa.length + 1) / 4) * 4);
    b.set([0x74, 0x65, 0x78, 0x74]);
    for (let i = 0; i < prawa.length; i += 1) b[8 + i] = prawa.charCodeAt(i);
    return b;
  })();
  const tagXyz = (x, y, z) => { const b = new Uint8Array(20); const d = new DataView(b.buffer); b.set([0x58, 0x59, 0x5a, 0x20]); d.setInt32(8, s15(x)); d.setInt32(12, s15(y)); d.setInt32(16, s15(z)); return b; };
  const tagKrzywa = (() => {
    const n = 1024; const b = new Uint8Array(12 + n * 2); const d = new DataView(b.buffer);
    b.set([0x63, 0x75, 0x72, 0x76]); d.setUint32(8, n);
    for (let i = 0; i < n; i += 1) d.setUint16(12 + i * 2, Math.round(liniowo(i / (n - 1)) * 65535));
    return b;
  })();
  const czesci = [
    ['desc', tagDesc], ['cprt', tagText], ['wtpt', tagXyz(...BIEL_D50)],
    ['rXYZ', tagXyz(SRGB_XYZ[0], SRGB_XYZ[3], SRGB_XYZ[6])], ['gXYZ', tagXyz(SRGB_XYZ[1], SRGB_XYZ[4], SRGB_XYZ[7])], ['bXYZ', tagXyz(SRGB_XYZ[2], SRGB_XYZ[5], SRGB_XYZ[8])],
    ['rTRC', tagKrzywa], ['gTRC', tagKrzywa], ['bTRC', tagKrzywa],
  ];
  const dane = [...new Set(czesci.map((c) => c[1]))];
  let gdzie = 128 + 4 + czesci.length * 12;
  const polozenie = new Map();
  for (const b of dane) { polozenie.set(b, gdzie); gdzie += b.length; }
  const plik = new Uint8Array(gdzie); const d = new DataView(plik.buffer);
  const napis = (od, t) => { for (let i = 0; i < t.length; i += 1) plik[od + i] = t.charCodeAt(i); };
  d.setUint32(0, gdzie); d.setUint32(8, 0x02100000);
  napis(12, 'mntr'); napis(16, 'RGB '); napis(20, 'XYZ ');
  d.setUint16(24, 2026); d.setUint16(26, 1); d.setUint16(28, 1);
  napis(36, 'acsp');
  d.setInt32(68, s15(BIEL_D50[0])); d.setInt32(72, s15(BIEL_D50[1])); d.setInt32(76, s15(BIEL_D50[2]));
  d.setUint32(128, czesci.length);
  czesci.forEach(([nazwa, b], i) => { const p = 132 + i * 12; napis(p, nazwa); d.setUint32(p + 4, polozenie.get(b)); d.setUint32(p + 8, b.length); });
  for (const b of dane) plik.set(b, polozenie.get(b));
  return plik;
}

// Warunki druku, dla których aplikacja ma profil. `identyfikator` to nazwa z rejestru ICC (www.color.org).
export const WARUNKI_DRUKU = {
  fogra39: { plik: 'css/profile/Coated_Fogra39L_VIGC_300.icc', identyfikator: 'FOGRA39', nazwa: 'papier powlekany (FOGRA39)', opis: 'Offset arkuszowy, papier powlekany (kredowy), ISO 12647-2:2004 – Coated FOGRA39L, VIGC, 300%' },
  fogra47: { plik: 'css/profile/PSO_Uncoated_ISO12647_eci.icc', identyfikator: 'FOGRA47', nazwa: 'papier niepowlekany (FOGRA47)', opis: 'Offset arkuszowy, papier niepowlekany (offsetowy), ISO 12647-2:2004 – PSO Uncoated ISO12647 (ECI)' },
};
