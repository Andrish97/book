// Kody QR (ISO/IEC 18004) i kody kreskowe EAN-13 / ISBN-13 (decyzja #128) – same obliczenia, bez DOM
// i bez zewnętrznych bibliotek. Wspólne dla edytora, podglądu, eksportu PDF, łącznika AI i testów.
//
// qrMacierz(tekst, korekcja) → { rozmiar, moduly: [[bool]], wersja, korekcja, maska }
// ean13(cyfry) → { cyfry, moduly: [bool × 95] } (bez marginesów ciszy)

// ---------- QR: tablice z normy ----------

const POZIOMY = { L: 1, M: 0, Q: 3, H: 2 }; // bity formatu poziomu korekcji
const KOLEJNOSC = ['L', 'M', 'Q', 'H'];

// Liczba słów korekcji na blok i liczba bloków – [poziom][wersja] (indeks 0 nieużywany).
const EC_NA_BLOK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const BLOKI = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

// Liczba modułów na dane (bez wzorców funkcyjnych) dla wersji.
function modulyDanych(w) {
  let n = (16 * w + 128) * w + 64;
  if (w >= 2) {
    const ile = Math.floor(w / 7) + 2;
    n -= (25 * ile - 10) * ile - 55;
    if (w >= 7) n -= 36;
  }
  return n;
}
const slowDanych = (w, poz) => Math.floor(modulyDanych(w) / 8) - EC_NA_BLOK[poz][w] * BLOKI[poz][w];

// ---------- Reed–Solomon w GF(256), wielomian 0x11D ----------

function mnozGF(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function dzielnikRS(stopien) {
  const wynik = new Array(stopien).fill(0);
  wynik[stopien - 1] = 1;
  let korzen = 1;
  for (let i = 0; i < stopien; i += 1) {
    for (let j = 0; j < wynik.length; j += 1) {
      wynik[j] = mnozGF(wynik[j], korzen);
      if (j + 1 < wynik.length) wynik[j] ^= wynik[j + 1];
    }
    korzen = mnozGF(korzen, 0x02);
  }
  return wynik;
}
function resztaRS(dane, dzielnik) {
  const wynik = dzielnik.map(() => 0);
  for (const b of dane) {
    const czynnik = b ^ wynik.shift();
    wynik.push(0);
    dzielnik.forEach((c, i) => { wynik[i] ^= mnozGF(c, czynnik); });
  }
  return wynik;
}

// ---------- Segmenty danych ----------

const ALFANUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const utf8 = (t) => Array.from(new TextEncoder().encode(t));

// Tryb: numeryczny, alfanumeryczny albo bajtowy (UTF-8) – najkrótszy dla całego tekstu.
export function trybQR(tekst) {
  if (/^[0-9]*$/.test(tekst)) return 'numeryczny';
  if ([...tekst].every((z) => ALFANUM.includes(z))) return 'alfanumeryczny';
  return 'bajtowy';
}
const BITY_DLUGOSCI = {
  numeryczny: [10, 12, 14], alfanumeryczny: [9, 11, 13], bajtowy: [8, 16, 16],
};
const WSKAZNIK = { numeryczny: 0x1, alfanumeryczny: 0x2, bajtowy: 0x4 };
const zakresWersji = (w) => (w <= 9 ? 0 : w <= 26 ? 1 : 2);

function bityDanych(tekst, tryb) {
  const bity = [];
  const dopisz = (v, n) => { for (let i = n - 1; i >= 0; i -= 1) bity.push((v >>> i) & 1); };
  let dlugosc;
  if (tryb === 'numeryczny') {
    dlugosc = tekst.length;
    for (let i = 0; i < tekst.length; i += 3) {
      const kawalek = tekst.slice(i, i + 3);
      dopisz(Number(kawalek), kawalek.length * 3 + 1);
    }
  } else if (tryb === 'alfanumeryczny') {
    dlugosc = tekst.length;
    for (let i = 0; i < tekst.length; i += 2) {
      if (i + 1 < tekst.length) dopisz(ALFANUM.indexOf(tekst[i]) * 45 + ALFANUM.indexOf(tekst[i + 1]), 11);
      else dopisz(ALFANUM.indexOf(tekst[i]), 6);
    }
  } else {
    const b = utf8(tekst);
    dlugosc = b.length;
    for (const x of b) dopisz(x, 8);
  }
  return { bity, dlugosc };
}

// ---------- Macierz ----------

function wspolrzedneWzorcow(w) {
  if (w === 1) return [];
  const ile = Math.floor(w / 7) + 2;
  const krok = w === 32 ? 26 : Math.ceil((w * 4 + 4) / (ile * 2 - 2)) * 2;
  const wynik = [6];
  for (let poz = w * 4 + 10; wynik.length < ile; poz -= krok) wynik.splice(1, 0, poz);
  return wynik;
}

class Macierz {
  constructor(wersja) {
    this.w = wersja;
    this.n = wersja * 4 + 17;
    this.m = Array.from({ length: this.n }, () => new Array(this.n).fill(false));
    this.f = Array.from({ length: this.n }, () => new Array(this.n).fill(false)); // moduł funkcyjny
  }

  ustaw(x, y, v) { this.m[y][x] = v; this.f[y][x] = true; }

  wzorceFunkcyjne() {
    const { n } = this;
    for (let i = 0; i < n; i += 1) { this.ustaw(6, i, i % 2 === 0); this.ustaw(i, 6, i % 2 === 0); }
    this.szukacz(3, 3); this.szukacz(n - 4, 3); this.szukacz(3, n - 4);
    const pozycje = wspolrzedneWzorcow(this.w);
    const ile = pozycje.length;
    for (let i = 0; i < ile; i += 1) {
      for (let j = 0; j < ile; j += 1) {
        if (!((i === 0 && j === 0) || (i === 0 && j === ile - 1) || (i === ile - 1 && j === 0))) this.wyrownanie(pozycje[i], pozycje[j]);
      }
    }
    this.format(0, 0); // zarezerwowanie miejsca (wartość wpisze format() z prawdziwą maską)
    this.wersjaInfo();
  }

  szukacz(x, y) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.n && yy >= 0 && yy < this.n) this.ustaw(xx, yy, d !== 2 && d !== 4);
      }
    }
  }

  wyrownanie(x, y) {
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) this.ustaw(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }

  format(poziomBity, maska) {
    const dane = (poziomBity << 3) | maska;
    let r = dane;
    for (let i = 0; i < 10; i += 1) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const bity = ((dane << 10) | r) ^ 0x5412;
    const bit = (i) => ((bity >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i += 1) this.ustaw(8, i, bit(i));
    this.ustaw(8, 7, bit(6));
    this.ustaw(8, 8, bit(7));
    this.ustaw(7, 8, bit(8));
    for (let i = 9; i < 15; i += 1) this.ustaw(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i += 1) this.ustaw(this.n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i += 1) this.ustaw(8, this.n - 15 + i, bit(i));
    this.ustaw(8, this.n - 8, true); // ciemny moduł
  }

  wersjaInfo() {
    if (this.w < 7) return;
    let r = this.w;
    for (let i = 0; i < 12; i += 1) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const bity = (this.w << 12) | r;
    for (let i = 0; i < 18; i += 1) {
      const v = ((bity >>> i) & 1) !== 0;
      const a = this.n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.ustaw(a, b, v);
      this.ustaw(b, a, v);
    }
  }

  wpiszDane(slowa) {
    let i = 0;
    const { n } = this;
    for (let prawa = n - 1; prawa >= 1; prawa -= 2) {
      if (prawa === 6) prawa = 5;
      for (let k = 0; k < n; k += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = prawa - j;
          const wGore = ((prawa + 1) & 2) === 0;
          const y = wGore ? n - 1 - k : k;
          if (!this.f[y][x] && i < slowa.length * 8) {
            this.m[y][x] = ((slowa[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i += 1;
          }
        }
      }
    }
  }

  maskuj(maska) {
    const warunek = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ][maska];
    for (let y = 0; y < this.n; y += 1) for (let x = 0; x < this.n; x += 1) if (!this.f[y][x] && warunek(x, y)) this.m[y][x] = !this.m[y][x];
  }

  // Punkty karne wg normy (reguły N1–N4) – wybór najlepszej maski.
  kara() {
    const { n, m } = this;
    let wynik = 0;
    const ciagi = (linia) => {
      let k = 0;
      let dl = 1;
      for (let i = 1; i <= n; i += 1) {
        if (i < n && linia(i) === linia(i - 1)) dl += 1;
        else { if (dl >= 5) k += 3 + (dl - 5); dl = 1; }
      }
      return k;
    };
    const wzorFinder = (linia) => {
      let k = 0;
      const wzor1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
      const wzor2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      for (let i = 0; i + 11 <= n; i += 1) {
        let a = true;
        let b = true;
        for (let j = 0; j < 11; j += 1) {
          const v = linia(i + j) ? 1 : 0;
          if (v !== wzor1[j]) a = false;
          if (v !== wzor2[j]) b = false;
        }
        if (a) k += 40;
        if (b) k += 40;
      }
      return k;
    };
    for (let y = 0; y < n; y += 1) { wynik += ciagi((i) => m[y][i]); wynik += wzorFinder((i) => m[y][i]); }
    for (let x = 0; x < n; x += 1) { wynik += ciagi((i) => m[i][x]); wynik += wzorFinder((i) => m[i][x]); }
    for (let y = 0; y < n - 1; y += 1) {
      for (let x = 0; x < n - 1; x += 1) {
        const v = m[y][x];
        if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) wynik += 3;
      }
    }
    let ciemne = 0;
    for (const w of m) for (const v of w) if (v) ciemne += 1;
    const razem = n * n;
    const k = Math.ceil(Math.abs(ciemne * 20 - razem * 10) / razem) - 1;
    wynik += Math.max(0, k) * 10;
    return wynik;
  }
}

// Kod QR dla tekstu. korekcja: 'L' | 'M' | 'Q' | 'H' (domyślnie M); poziom rośnie sam, gdy przy tej samej
// wersji zmieści się więcej korekcji. maska: wymuszona (0–7) albo wybierana wg kar.
export function qrMacierz(tekst, korekcja = 'M', { maska: wymuszona = null, podnosKorekcje = true } = {}) {
  const t = String(tekst ?? '');
  const tryb = trybQR(t);
  const { bity: dane, dlugosc } = bityDanych(t, tryb);
  let poz = KOLEJNOSC.includes(korekcja) ? korekcja : 'M';
  let wersja = 0;
  let razem = 0;
  for (let w = 1; w <= 40; w += 1) {
    const potrzeba = 4 + BITY_DLUGOSCI[tryb][zakresWersji(w)] + dane.length;
    if (dlugosc < 2 ** BITY_DLUGOSCI[tryb][zakresWersji(w)] && potrzeba <= slowDanych(w, poz) * 8) { wersja = w; razem = potrzeba; break; }
  }
  if (!wersja) throw new Error('Tekst jest za długi na kod QR.');
  if (podnosKorekcje) {
    for (const p of KOLEJNOSC.slice(KOLEJNOSC.indexOf(poz) + 1)) if (razem <= slowDanych(wersja, p) * 8) poz = p;
  }
  // Strumień bitów: wskaźnik trybu, długość, dane, terminator, wyrównanie do bajtu, bajty wypełnienia.
  const bity = [];
  const dopisz = (v, n) => { for (let i = n - 1; i >= 0; i -= 1) bity.push((v >>> i) & 1); };
  dopisz(WSKAZNIK[tryb], 4);
  dopisz(dlugosc, BITY_DLUGOSCI[tryb][zakresWersji(wersja)]);
  bity.push(...dane);
  const pojemnosc = slowDanych(wersja, poz) * 8;
  dopisz(0, Math.min(4, pojemnosc - bity.length));
  dopisz(0, (8 - (bity.length % 8)) % 8);
  for (let b = 0xec; bity.length < pojemnosc; b ^= 0xec ^ 0x11) dopisz(b, 8);
  const slowa = [];
  for (let i = 0; i < bity.length; i += 8) slowa.push(bity.slice(i, i + 8).reduce((a, x) => (a << 1) | x, 0));

  // Bloki z korekcją i przeplot.
  const ileBlokow = BLOKI[poz][wersja];
  const ec = EC_NA_BLOK[poz][wersja];
  const wszystkie = Math.floor(modulyDanych(wersja) / 8);
  const krotkich = ileBlokow - (wszystkie % ileBlokow);
  const dlKrotkiego = Math.floor(wszystkie / ileBlokow);
  const dzielnik = dzielnikRS(ec);
  const bloki = [];
  for (let i = 0, k = 0; i < ileBlokow; i += 1) {
    const ile = dlKrotkiego - ec + (i < krotkich ? 0 : 1);
    const d = slowa.slice(k, k + ile);
    k += ile;
    const r = resztaRS(d, dzielnik);
    if (i < krotkich) d.push(0); // miejsce wyrównujące – pomijane przy przeplocie
    bloki.push([...d, ...r]);
  }
  const wynikowe = [];
  for (let i = 0; i < bloki[0].length; i += 1) {
    bloki.forEach((b, j) => { if (i !== dlKrotkiego - ec || j >= krotkich) wynikowe.push(b[i]); });
  }

  const mac = new Macierz(wersja);
  mac.wzorceFunkcyjne();
  mac.wpiszDane(wynikowe);
  let maska = wymuszona;
  if (maska === null) {
    let najmniej = Infinity;
    for (let k = 0; k < 8; k += 1) {
      mac.maskuj(k);
      mac.format(POZIOMY[poz], k);
      const kara = mac.kara();
      if (kara < najmniej) { najmniej = kara; maska = k; }
      mac.maskuj(k);
    }
  }
  mac.maskuj(maska);
  mac.format(POZIOMY[poz], maska);
  return { rozmiar: mac.n, moduly: mac.m, wersja, korekcja: poz, maska, tryb };
}

// ---------- EAN-13 / ISBN-13 ----------

const L_KOD = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G_KOD = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R_KOD = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARZYSTOSC = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

// Cyfra kontrolna dla 12 cyfr.
export function cyfraKontrolnaEAN(dwanascie) {
  const s = String(dwanascie).split('').reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
  return (10 - (s % 10)) % 10;
}

// Cyfry kodu z wpisanego tekstu: myślniki i spacje (ISBN 978-83-…) znikają; 12 cyfr – dopisuje cyfrę
// kontrolną; 13 cyfr – sprawdza ją. ISBN-10 zamienia na ISBN-13 (978 + 9 cyfr + nowa kontrolna).
// → { cyfry, blad } (blad: null albo komunikat po polsku).
export function cyfryEAN(tekst) {
  const surowe = String(tekst ?? '').replace(/[\s-]/g, '');
  if (/^\d{9}[\dXx]$/.test(surowe)) {
    const d = `978${surowe.slice(0, 9)}`;
    return { cyfry: d + cyfraKontrolnaEAN(d), blad: null, isbn10: true };
  }
  if (!/^\d+$/.test(surowe)) return { cyfry: null, blad: 'Kod EAN ma tylko cyfry (ISBN może mieć myślniki).' };
  if (surowe.length === 12) return { cyfry: surowe + cyfraKontrolnaEAN(surowe), blad: null };
  if (surowe.length !== 13) return { cyfry: null, blad: `Kod EAN-13 ma 13 cyfr (12 + cyfra kontrolna) – wpisano ${surowe.length}.` };
  const k = cyfraKontrolnaEAN(surowe.slice(0, 12));
  if (k !== Number(surowe[12])) return { cyfry: null, blad: `Zła cyfra kontrolna – powinna być ${k}.` };
  return { cyfry: surowe, blad: null };
}

// Moduły kodu (95 kresek i przerw) dla 13 cyfr.
export function ean13(tekst) {
  const { cyfry, blad } = cyfryEAN(tekst);
  if (blad) throw new Error(blad);
  const p = PARZYSTOSC[Number(cyfry[0])];
  let s = '101';
  for (let i = 1; i <= 6; i += 1) s += (p[i - 1] === 'L' ? L_KOD : G_KOD)[Number(cyfry[i])];
  s += '01010';
  for (let i = 7; i <= 12; i += 1) s += R_KOD[Number(cyfry[i])];
  s += '101';
  return { cyfry, moduly: s.split('').map((c) => c === '1') };
}

// Kreski strażnicze (dłuższe): początek, środek, koniec.
export const STRAZNIKI_EAN = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);

// ---------- Treść kodu QR z pól panelu ----------

const ucieczkaWifi = (t) => String(t ?? '').replace(/([\\;,":])/g, '\\$1');

// Treść kodu z rodzaju i pól: adres, tekst, e-mail, telefon, Wi-Fi.
export function trescQR(typ, d = {}) {
  switch (typ) {
    case 'email': {
      const parametry = [];
      if (d.temat) parametry.push(`subject=${encodeURIComponent(d.temat)}`);
      if (d.tresc) parametry.push(`body=${encodeURIComponent(d.tresc)}`);
      return `mailto:${d.email || ''}${parametry.length ? `?${parametry.join('&')}` : ''}`;
    }
    case 'telefon': return `tel:${String(d.telefon || '').replace(/[^\d+]/g, '')}`;
    case 'wifi': return `WIFI:T:${d.szyfrowanie || 'WPA'};S:${ucieczkaWifi(d.siec)};${d.szyfrowanie === 'nopass' ? '' : `P:${ucieczkaWifi(d.haslo)};`}${d.ukryta ? 'H:true;' : ''};`;
    case 'adres': {
      const a = String(d.adres || '').trim();
      return a && !/^[a-z][a-z0-9+.-]*:/i.test(a) && !a.includes('{') ? `https://${a}` : a;
    }
    default: return String(d.tekst ?? '');
  }
}

// ---------- Opis kodu jako elementu strony (#128) – wspólny dla edytora, kontroli i łącznika AI ----------

export const CISZA_QR = 4; // moduły marginesu ciszy wokół kodu QR (norma)
export const CISZA_EAN = { lewa: 11, prawa: 7 }; // moduły ciszy EAN-13
// EAN-13 w 100% (norma GS1): moduł 0,33 mm; kreski 22,85 mm; wysokość z cyframi ok. 25,9 mm.
export const EAN_NOMINAL = { modul: 0.33, szerokosc: (95 + 18) * 0.33, wysokosc: 25.93 };

const zaokr = (x) => Math.round(x * 100) / 100;

export function domyslnyKod(rodzaj = 'qr') {
  if (rodzaj === 'ean') {
    return { rodzaj: 'ean', typ: 'tekst', dane: {}, tresc: '978830100000', korekcja: 'M', kolor: '#000000', tlo: '#ffffff', cisza: true, napis: true, szerokosc: zaokr(EAN_NOMINAL.szerokosc), wysokosc: EAN_NOMINAL.wysokosc };
  }
  return { rodzaj: 'qr', typ: 'adres', dane: { adres: 'https://makietka.app' }, tresc: 'https://makietka.app', korekcja: 'M', kolor: '#000000', tlo: '#ffffff', cisza: true, napis: false, szerokosc: 25, wysokosc: 25 };
}

export function normalizujKod(k) {
  const d = domyslnyKod(k?.rodzaj === 'ean' ? 'ean' : 'qr');
  const wynik = { ...d, ...(k && typeof k === 'object' ? k : {}) };
  wynik.rodzaj = d.rodzaj;
  wynik.typ = ['adres', 'tekst', 'email', 'telefon', 'wifi'].includes(wynik.typ) ? wynik.typ : 'tekst';
  wynik.dane = wynik.dane && typeof wynik.dane === 'object' ? { ...wynik.dane } : {};
  wynik.tresc = String(wynik.tresc ?? '');
  wynik.korekcja = ['L', 'M', 'Q', 'H'].includes(wynik.korekcja) ? wynik.korekcja : 'M';
  wynik.cisza = wynik.cisza !== false;
  wynik.napis = wynik.rodzaj === 'ean' && wynik.napis !== false;
  const liczba = (v, x) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(1000, Number(v)) : x);
  wynik.szerokosc = liczba(wynik.szerokosc, d.szerokosc);
  wynik.wysokosc = wynik.rodzaj === 'qr' ? wynik.szerokosc : liczba(wynik.wysokosc, d.wysokosc);
  return wynik;
}

// Treść QR policzona z typu i pól panelu (adres, e-mail, telefon, Wi-Fi). Pola danych {kolumna} zostają.
export function zTypu(k) {
  return k.rodzaj === 'qr' ? trescQR(k.typ, k.dane) : String(k.dane?.tekst ?? k.tresc ?? '');
}

// Rysunek kodu dla opisu: { moduly: [[x, y, w, h]] w mm od lewego górnego rogu, napis?: [{ tekst, x, y, rozmiar, wyrownanie }], blad }.
export function rysunekKodu(k) {
  if (k.rodzaj === 'ean') {
    const { cyfry, blad } = cyfryEAN(k.tresc);
    if (blad) return { blad, moduly: [], napis: [] };
    const { moduly } = ean13(cyfry);
    const cz = k.cisza ? CISZA_EAN : { lewa: 0, prawa: 0 };
    const m = k.szerokosc / (95 + cz.lewa + cz.prawa);
    const rozmiarCyfr = k.napis ? Math.min(m * 9, k.wysokosc * 0.18) : 0;
    const dolKresek = k.wysokosc - (k.napis ? rozmiarCyfr * 1.05 : 0);
    const dluzsze = k.napis ? Math.min(k.wysokosc, dolKresek + m * 5) : k.wysokosc;
    const prostokaty = [];
    for (let i = 0; i < 95;) {
      if (!moduly[i]) { i += 1; continue; }
      let j = i;
      while (j < 95 && moduly[j] && STRAZNIKI_EAN.has(j) === STRAZNIKI_EAN.has(i)) j += 1;
      prostokaty.push([(cz.lewa + i) * m, 0, (j - i) * m, STRAZNIKI_EAN.has(i) ? dluzsze : dolKresek]);
      i = j;
    }
    const napis = k.napis ? [
      { tekst: cyfry[0], x: (cz.lewa - 1) * m, y: dolKresek + rozmiarCyfr * 0.05, rozmiar: rozmiarCyfr, wyrownanie: 'right' },
      { tekst: cyfry.slice(1, 7), x: (cz.lewa + 3 + 21) * m, y: dolKresek + rozmiarCyfr * 0.05, rozmiar: rozmiarCyfr, wyrownanie: 'center' },
      { tekst: cyfry.slice(7), x: (cz.lewa + 50 + 21) * m, y: dolKresek + rozmiarCyfr * 0.05, rozmiar: rozmiarCyfr, wyrownanie: 'center' },
    ] : [];
    return { moduly: prostokaty, napis, modul: m, blad: null };
  }
  let q;
  try {
    q = qrMacierz(k.tresc, k.korekcja);
  } catch (e) {
    return { blad: e.message, moduly: [], napis: [] };
  }
  const cz = k.cisza ? CISZA_QR : 0;
  const m = k.szerokosc / (q.rozmiar + 2 * cz);
  const prostokaty = [];
  // Ciągi ciemnych modułów w wierszu – jeden prostokąt na ciąg (mniej ścieżek, bez szczelin między modułami).
  for (let y = 0; y < q.rozmiar; y += 1) {
    for (let x = 0; x < q.rozmiar;) {
      if (!q.moduly[y][x]) { x += 1; continue; }
      let j = x;
      while (j < q.rozmiar && q.moduly[y][j]) j += 1;
      prostokaty.push([(cz + x) * m, (cz + y) * m, (j - x) * m, m]);
      x = j;
    }
  }
  return { moduly: prostokaty, napis: [], modul: m, wersja: q.wersja, blad: null };
}

// Ostrzeżenia kodu (kontrola przed drukiem i panel): za mały moduł, za wąski EAN, za jasny na tle, zła treść.
export function uwagiKodu(k, modul = null) {
  const uwagi = [];
  const rys = modul == null ? rysunekKodu(k) : { modul, blad: null };
  if (rys.blad) { uwagi.push(rys.blad); return uwagi; }
  if (k.rodzaj === 'qr' && rys.modul < 0.33) uwagi.push(`Moduł kodu QR ma ${rys.modul.toFixed(2).replace('.', ',')} mm – telefon może go nie odczytać (najmniej 0,33 mm). Powiększ kod albo skróć treść.`);
  if (k.rodzaj === 'ean' && k.szerokosc < EAN_NOMINAL.szerokosc * 0.8) uwagi.push(`Kod EAN ma ${Math.round((k.szerokosc / EAN_NOMINAL.szerokosc) * 100)}% wielkości nominalnej – czytniki w sklepach potrzebują najmniej 80%.`);
  const jasnosc = (kolor) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(kolor || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };
  const jk = jasnosc(k.kolor);
  const jt = k.tlo ? jasnosc(k.tlo) : 1;
  if (jk != null && jt != null && (jk > 0.45 || jt - jk < 0.5)) uwagi.push('Kod jest za jasny albo za mało odcina się od tła – czytnik potrzebuje ciemnego kodu na jasnym tle.');
  return uwagi;
}
