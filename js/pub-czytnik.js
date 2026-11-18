// Czytnik plików Microsoft Publishera (.pub, wersje 2002–2019) – #228. Publisher został wycofany przez Microsoft
// (październik 2026), a jego pliki zostały w szufladach – zwłaszcza korespondencja seryjna. Format jest zamknięty;
// struktura według otwartego czytnika libmspub (LibreOffice, MPL 2.0): kontener OLE (Compound File) ze strumieniami
//   Quill/QuillSub/CONTENTS – teksty (UTF-16) z podziałem na historie (STRS – długości, SYID – identyfikatory),
//   Contents – drzewo bloków: dokument (rozmiar strony, lista stron), strony (lista kształtów), kształty (id tekstu),
//   Escher/EscherStm – rysunki Office Art: położenie kształtu (kotwica w EMU od środka strony), typ, wypełnienie,
//     obrys, obrót, numer obrazu; Escher/EscherDelayStm – same obrazy (PNG, JPEG…).
// Wynik: { szer, wys (cale), strony: [{ wzorzec, ksztalty: [{ x, y, w, h (cale od lewego górnego rogu strony),
// kat, tekst, akapity, obraz: { typ, bajty }, wypelnienie, obrys, grubosc, typKsztaltu }] }] }. Bez DOM.

const EMU = 914400;

// ---------- Kontener OLE (Compound File Binary) ----------

export function czytajCfb(bufor) {
  const b = new Uint8Array(bufor);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint32(0, true) !== 0xe011cfd0 || dv.getUint32(4, true) !== 0xe11ab1a1) throw new Error('To nie jest plik Publishera (.pub).');
  const sektor = 1 << dv.getUint16(30, true);
  const miniSektor = 1 << dv.getUint16(32, true);
  const ileFat = dv.getUint32(44, true);
  const pierwszyKatalog = dv.getUint32(48, true);
  const progMini = dv.getUint32(56, true);
  const pierwszyMiniFat = dv.getUint32(60, true);
  const pierwszyDifat = dv.getUint32(68, true);
  const off = (s) => (s + 1) * sektor;
  // DIFAT → sektory FAT.
  const sektoryFat = [];
  for (let i = 0; i < 109 && sektoryFat.length < ileFat; i += 1) sektoryFat.push(dv.getUint32(76 + i * 4, true));
  let d = pierwszyDifat;
  for (let n = 0; d !== 0xfffffffe && d !== 0xffffffff && sektoryFat.length < ileFat && n < 10000; n += 1) {
    const o = off(d);
    for (let i = 0; i < sektor / 4 - 1 && sektoryFat.length < ileFat; i += 1) sektoryFat.push(dv.getUint32(o + i * 4, true));
    d = dv.getUint32(o + sektor - 4, true);
  }
  const fat = [];
  for (const s of sektoryFat) for (let i = 0; i < sektor / 4; i += 1) fat.push(dv.getUint32(off(s) + i * 4, true));
  const lancuch = (start, tabela) => { const w = []; for (let s = start, n = 0; s < 0xfffffffa && n < 1e6; s = tabela[s], n += 1) w.push(s); return w; };
  const czytajLancuch = (start, rozmiar = null) => {
    const sek = lancuch(start, fat);
    const wynik = new Uint8Array(sek.length * sektor);
    sek.forEach((s, i) => wynik.set(b.subarray(off(s), off(s) + sektor), i * sektor));
    return rozmiar === null ? wynik : wynik.subarray(0, rozmiar);
  };
  // Katalog.
  const kat = czytajLancuch(pierwszyKatalog);
  const kdv = new DataView(kat.buffer);
  const wpisy = [];
  for (let o = 0; o + 128 <= kat.length; o += 128) {
    const dl = kdv.getUint16(o + 64, true);
    let nazwa = '';
    for (let i = 0; i < Math.max(0, dl / 2 - 1); i += 1) nazwa += String.fromCharCode(kdv.getUint16(o + i * 2, true));
    wpisy.push({ nazwa, typ: kat[o + 66], lewy: kdv.getUint32(o + 68, true), prawy: kdv.getUint32(o + 72, true), dziecko: kdv.getUint32(o + 76, true), start: kdv.getUint32(o + 116, true), rozmiar: kdv.getUint32(o + 120, true) });
  }
  const korzen = wpisy[0];
  const miniStrumien = korzen && korzen.start < 0xfffffffa ? czytajLancuch(korzen.start, korzen.rozmiar) : new Uint8Array(0);
  const miniFat = [];
  if (pierwszyMiniFat < 0xfffffffa) { const m = czytajLancuch(pierwszyMiniFat); const mdv = new DataView(m.buffer); for (let i = 0; i < m.length / 4; i += 1) miniFat.push(mdv.getUint32(i * 4, true)); }
  // Ścieżki: drzewo czerwono-czarne rodzeństwa pod każdym katalogiem.
  const sciezki = new Map();
  const odwiedz = (id, przedrostek, glebokosc = 0) => {
    if (id === 0xffffffff || id >= wpisy.length || glebokosc > 64) return;
    const w = wpisy[id];
    odwiedz(w.lewy, przedrostek, glebokosc + 1);
    const sc = przedrostek ? `${przedrostek}/${w.nazwa}` : w.nazwa;
    if (w.typ === 2) sciezki.set(sc, w);
    if (w.typ === 1) odwiedz(w.dziecko, sc, glebokosc + 1);
    odwiedz(w.prawy, przedrostek, glebokosc + 1);
  };
  if (korzen) odwiedz(korzen.dziecko, '');
  return {
    sciezki: [...sciezki.keys()],
    strumien(sc) {
      const w = sciezki.get(sc);
      if (!w) return null;
      if (w.rozmiar < progMini) {
        const sek = lancuch(w.start, miniFat);
        const wynik = new Uint8Array(sek.length * miniSektor);
        sek.forEach((s, i) => wynik.set(miniStrumien.subarray(s * miniSektor, (s + 1) * miniSektor), i * miniSektor));
        return wynik.subarray(0, w.rozmiar);
      }
      return czytajLancuch(w.start, w.rozmiar);
    },
  };
}

// ---------- Czytanie strumienia ----------

class Strumien {
  constructor(b) { this.b = b; this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength); this.p = 0; }
  u8() { const v = this.b[this.p]; this.p += 1; return v ?? 0; }
  u16() { if (this.p + 2 > this.b.length) { this.p += 2; return 0; } const v = this.dv.getUint16(this.p, true); this.p += 2; return v; }
  u32() { if (this.p + 4 > this.b.length) { this.p += 4; return 0; } const v = this.dv.getUint32(this.p, true); this.p += 4; return v; }
  i32() { if (this.p + 4 > this.b.length) { this.p += 4; return 0; } const v = this.dv.getInt32(this.p, true); this.p += 4; return v; }
  dalej(koniec) { return this.p < koniec && this.p < this.b.length; }
}

// ---------- Quill: teksty ----------

// Lista stylów FDPC/FDPP: [{ koniec (bajt w strumieniu), styl }] – styl obowiązuje do bajtu „koniec” włącznie.
function listaStylow(s, k, czytaj) {
  s.p = k.offset;
  const ile = s.u16();
  s.p += 6;
  const konce = [];
  for (let i = 0; i < ile; i += 1) konce.push(s.u32());
  const offsety = [];
  for (let i = 0; i < ile; i += 1) offsety.push(s.u16());
  return konce.map((koniec, i) => { s.p = k.offset + offsety[i]; return { koniec, styl: czytaj(s) }; });
}
function stylZnaku(s) {
  const st = {};
  const pocz = s.p;
  const dl = s.u32();
  while (s.dalej(pocz + dl)) {
    const bl = blok(s, true);
    if (bl.id === 0x02) st.b = true;
    else if (bl.id === 0x03) st.i = true;
    else if (bl.id === 0x1e) st.u = (bl.dane & 0xff) !== 0;
    else if (bl.id === 0x0c) st.pt = (bl.dane * 72) / EMU;
    else if (bl.id === 0x2e && DL_BLOKU(bl.typ) >= 0) st.kolor = bl.dane;
    else if (bl.id === 0x44 && DL_BLOKU(bl.typ) < 0) {
      s.p = bl.daneOd + 4;
      while (s.dalej(bl.daneOd + bl.dlugosc)) { const sb = blok(s, true); if (sb.id === 0x0) { st.kolor = sb.dane; break; } }
      s.p = bl.daneOd + bl.dlugosc;
    }
    else if (bl.id === 0x24 && DL_BLOKU(bl.typ) < 0) {
      s.p = bl.daneOd + 4;
      while (s.dalej(bl.daneOd + bl.dlugosc)) {
        const sb = blok(s, true);
        if (sb.typ === 0x88) { s.p = sb.daneOd + 4; if (s.dalej(sb.daneOd + sb.dlugosc)) st.font = blok(s, true).dane; break; }
      }
      s.p = bl.daneOd + bl.dlugosc;
    }
  }
  return st;
}
function stylAkapitu(s) {
  const st = {};
  const pocz = s.p;
  const dl = s.u32();
  while (s.dalej(pocz + dl)) {
    const bl = blok(s, true);
    if (bl.id === 0x04) st.wyr = { 2: 'center', 1: 'right', 6: 'justify' }[bl.dane & 0xff] || 'left';
  }
  return st;
}

function czytajTeksty(b) {
  const s = new Strumien(b);
  const kawalki = [];
  let lista = 0x18;
  const byly = new Set();
  while (lista !== 0xffffffff && !byly.has(lista) && lista < b.length) {
    byly.add(lista);
    s.p = lista + 2;
    const ile = s.u16();
    lista = s.u32();
    for (let i = 0; i < ile; i += 1) {
      s.u16();
      let nazwa = '';
      for (let k = 0; k < 4; k += 1) nazwa += String.fromCharCode(s.u8());
      const id = s.u16();
      s.p += 4;
      s.p += 4; // nazwa2
      kawalki.push({ nazwa, id, offset: s.u32(), dlugosc: s.u32() });
    }
  }
  const dlugosci = [];
  const idy = [];
  const znaki = [];
  const akapity = [];
  const czcionki = [];
  const kolory = []; // kolory tekstu (odwołania do koloru – RGB albo z palety)
  let tekst = null;
  for (const k of kawalki) {
    if (k.nazwa === 'STRS') { s.p = k.offset; const ile = s.u32(); s.p = 4 + k.offset + s.u32(); for (let j = 0; j < ile; j += 1) dlugosci.push(s.u32()); }
    else if (k.nazwa === 'SYID') { s.p = k.offset; s.u32(); const ile = s.u32(); for (let j = 0; j < ile; j += 1) idy.push(s.u32()); }
    else if (k.nazwa === 'TEXT') tekst = k;
    else if (k.nazwa === 'FDPC') znaki.push(...listaStylow(s, k, stylZnaku));
    else if (k.nazwa === 'PL  ') {
      s.p = k.offset;
      const ile = s.u32();
      s.p += 8;
      for (let i = 0; i < ile && s.p < b.length; i += 1) {
        const pocz = s.p;
        const dl = s.u32();
        let kol = 0;
        while (s.dalej(pocz + dl)) { const bl = blok(s, true); if (bl.id === 0x01) kol = bl.dane; }
        kolory.push(kol);
        s.p = pocz + dl;
      }
    }
    else if (k.nazwa === 'FDPP') akapity.push(...listaStylow(s, k, stylAkapitu));
    else if (k.nazwa === 'FONT') {
      s.p = k.offset;
      s.u32();
      const ile = s.u32();
      s.p += 12 + 4 * ile;
      for (let i = 0; i < ile && s.p < b.length; i += 1) {
        const dl = s.u16();
        let n = '';
        for (let j = 0; j < dl; j += 1) n += String.fromCharCode(s.u16());
        czcionki.push(n.replace(/\u0000+$/, ''));
        s.u32();
      }
    }
  }
  const wynik = new Map(); // id tekstu → { tekst, znaki: [styl na znak], akapity: [wyrównanie] }
  if (!tekst) return wynik;
  let p = tekst.offset;
  let iz = 0;
  let ia = 0;
  for (let j = 0; j < idy.length && j < dlugosci.length; j += 1) {
    let t = '';
    const style = [];
    const wyr = [];
    for (let k = 0; k < dlugosci[j] && p + 1 < b.length; k += 1, p += 2) {
      const z = String.fromCharCode(b[p] | (b[p + 1] << 8));
      while (iz < znaki.length - 1 && p + 2 > znaki[iz].koniec + 1) iz += 1;
      while (ia < akapity.length - 1 && p + 2 > akapity[ia].koniec + 1) ia += 1;
      const sz = znaki[iz]?.styl || {};
      t += z;
      style.push({ ...sz, ...(sz.font !== undefined && czcionki[sz.font] ? { rodzina: czcionki[sz.font] } : {}), ...(sz.kolor !== undefined && kolory[sz.kolor] !== undefined ? { kolorRef: kolory[sz.kolor] } : {}) });
      if (z === '\r' || k === dlugosci[j] - 1) wyr.push(akapity[ia]?.styl?.wyr || 'left');
    }
    wynik.set(idy[j], { tekst: t, style, wyr });
  }
  return wynik;
}

// Napis Publishera → akapity: \r – nowy akapit, \v – nowa linia, znaki sterujące i pól usunięte.
export function akapityTekstu(t) {
  const czysty = String(t).replace(/\r$/, '').replace(/\u000b/g, '\n').replace(/[\u0000-\u0008\u000c\u000e-\u001f]/g, '');
  return czysty.split('\r');
}

// ---------- Contents: dokument, strony, kształty ----------

const DL_BLOKU = (typ) => {
  if ([0x78, 0x5, 0x8, 0xa].includes(typ)) return 0;
  if ([0x10, 0x12, 0x18, 0x1a, 0x07].includes(typ)) return 2;
  if ([0x20, 0x22, 0x58, 0x68, 0x70, 0xb8].includes(typ)) return 4;
  if (typ === 0x28) return 8;
  if (typ === 0x38) return 16;
  if (typ === 0x48) return 24;
  if ([0xc0, 0x80, 0x82, 0x88, 0x8a, 0x90, 0x98, 0xa0].includes(typ)) return -1;
  return 0;
};

function blok(s, pomijajZawartosc = false) {
  const info = { start: s.p, id: s.u8(), typ: s.u8() };
  info.daneOd = s.p;
  const dl = DL_BLOKU(info.typ);
  if (dl < 0) {
    info.dlugosc = s.u32();
    info.dane = 0;
    if (info.typ === 0xc0) { info.napis = s.b.subarray(s.p, s.p + info.dlugosc - 4); s.p = info.daneOd + info.dlugosc; }
    else if (pomijajZawartosc) s.p = info.daneOd + info.dlugosc;
  } else {
    info.dlugosc = dl;
    info.dane = dl === 2 ? s.u16() : dl === 4 ? s.u32() : 0;
    if (dl > 4) s.p = info.daneOd + dl;
  }
  return info;
}

function czytajContents(b) {
  const s = new Strumien(b);
  s.p = 0x1a;
  const trailer = s.u32();
  s.p = trailer;
  s.u32();
  const kawalki = [];
  let numer = -1; // numer kolejny bloku katalogu (pierwszy – 0), jak w libmspub
  for (let i = 0; i < 3; i += 1) {
    const czesc = blok(s);
    if (czesc.typ !== 0x90) { if (czesc.dlugosc !== undefined && DL_BLOKU(czesc.typ) < 0) s.p = czesc.daneOd + czesc.dlugosc; continue; }
    while (s.dalej(czesc.daneOd + czesc.dlugosc)) {
      const bl = blok(s);
      numer += 1;
      if (bl.typ === 0x88) {
        let typ = null; let offset = null; let rodzic = 0;
        while (s.dalej(bl.daneOd + bl.dlugosc)) {
          const sb = blok(s, true);
          if (sb.id === 0x2) typ = sb.dane;
          else if (sb.id === 0x4) offset = sb.dane;
          else if (sb.id === 0x5) rodzic = sb.dane;
        }
        if (typ !== null && offset !== null) kawalki.push({ typ, offset, numer, rodzic });
      } else s.p = bl.daneOd + (bl.dlugosc || 0);
    }
  }
  const wynik = { szer: 8.5, wys: 11, stronyKolejnosc: [], strony: new Map(), ksztalty: new Map(), paleta: [] };
  for (const k of kawalki) {
    s.p = k.offset;
    const pocz = s.p;
    const dl = s.u32();
    if (k.typ === 0x44) { // dokument
      while (s.dalej(pocz + dl)) {
        const bl = blok(s);
        if (bl.id === 0x12) {
          while (s.dalej(bl.daneOd + bl.dlugosc)) { const sb = blok(s, true); if (sb.id === 0x1) wynik.szer = sb.dane / EMU; else if (sb.id === 0x2) wynik.wys = sb.dane / EMU; }
        } else if (bl.id === 0x2 && DL_BLOKU(bl.typ) < 0) {
          s.p = bl.daneOd + 4;
          while (s.dalej(bl.daneOd + bl.dlugosc)) { const sb = blok(s, true); if (sb.id === 0) wynik.stronyKolejnosc.push(sb.dane); }
        } else s.p = bl.daneOd + (DL_BLOKU(bl.typ) < 0 ? bl.dlugosc : bl.dlugosc);
      }
    } else if (k.typ === 0x43) { // strona
      const strona = { ksztalty: [], wzorzec: false, tlo: null };
      while (s.dalej(pocz + dl)) {
        const bl = blok(s);
        if (bl.id === 0xa) strona.tlo = bl.dane;
        else if (bl.id === 0x2 && DL_BLOKU(bl.typ) < 0) {
          while (s.dalej(bl.daneOd + bl.dlugosc)) { const sb = blok(s, true); if (sb.typ === 0x70) strona.ksztalty.push(sb.dane); }
        } else if (bl.id === 0xe && bl.napis) strona.wzorzec = [...bl.napis].some((x) => x !== 0);
        else if (bl.id === 0xd && DL_BLOKU(bl.typ) >= 0) strona.zWzorca = bl.dane; // numer strony wzorcowej
        else if (DL_BLOKU(bl.typ) < 0) s.p = bl.daneOd + bl.dlugosc;
      }
      wynik.strony.set(k.numer, strona);
    } else if (k.typ === 0x5c) { // paleta kolorów dokumentu
      while (s.dalej(pocz + dl)) {
        const bl = blok(s);
        if (bl.typ === 0xa0) {
          while (s.dalej(bl.daneOd + bl.dlugosc)) {
            const sb = blok(s);
            if (sb.typ === 0x88) {
              let kolor = 0;
              while (s.dalej(sb.daneOd + sb.dlugosc)) { const e = blok(s, true); if (e.id === 0x01) kolor = e.dane; }
              wynik.paleta.push(kolor & 0xffffff);
            } else if (sb.typ === 0x78) wynik.paleta.push(0);
            if (DL_BLOKU(sb.typ) < 0) s.p = sb.daneOd + sb.dlugosc;
          }
        }
        if (DL_BLOKU(bl.typ) < 0) s.p = bl.daneOd + bl.dlugosc;
      }
    } else if ([0x01, 0x20, 0x30, 0x10, 0x31].includes(k.typ)) { // kształt, kształt zastępczy, grupa, tabela, logo
      const ks = { typ: k.typ, tekst: null };
      while (s.dalej(pocz + dl)) {
        const bl = blok(s, true);
        if (bl.id === 0x27) ks.tekst = bl.dane;
      }
      wynik.ksztalty.set(k.numer, ks);
    }
  }
  return wynik;
}

// ---------- Escher: położenia, wygląd, obrazy ----------

function kontener(s) { const initial = s.u16(); const typ = s.u16(); const dl = s.u32(); return { initial, typ, dl, od: s.p }; }
const ogon = (typ) => (typ === 0xf000 || typ === 0xf002 ? 4 : 0);
function znajdz(s, rodzic, typy) {
  while (s.dalej(rodzic.od + rodzic.dl)) {
    const n = kontener(s);
    if (typy.includes(n.typ)) return n;
    s.p = n.od + n.dl + ogon(n.typ);
  }
  return null;
}
function wartosci(s, k) {
  const w = new Map();
  s.p = k.od + (k.typ === 0xf010 || k.typ === 0xf011 ? 4 : 0);
  while (s.dalej(k.od + k.dl)) { const id = s.u16(); w.set(id, s.u32()); }
  return w;
}
function wartosciFopt(s, k) {
  const w = new Map();
  s.p = k.od;
  for (let i = 0; i < k.initial >> 4 && s.dalej(k.od + k.dl); i += 1) { const id = s.u16(); w.set(id & 0x3fff, s.u32()); }
  return w;
}

function czytajEscher(b) {
  const s = new Strumien(b);
  const korzen = { od: 0, dl: b.length };
  const opoznione = []; // pxId - 1 → indeks obrazu w EscherDelayStm (albo -1)
  const dgg = znajdz(s, korzen, [0xf000]);
  if (dgg) {
    const bsc = znajdz(s, { od: dgg.od, dl: dgg.dl }, [0xf001]);
    if (bsc) {
      let nr = 1;
      while (s.dalej(bsc.od + bsc.dl)) {
        const pocz = s.p;
        s.p = pocz + 10;
        const pusty = s.u32() === 0 && s.u32() === 0 && s.u32() === 0 && s.u32() === 0;
        opoznione.push(pusty ? -1 : nr++);
        s.p = pocz + 44;
      }
    }
    s.p = dgg.od + dgg.dl + 4;
  }
  const ksztalty = new Map();
  const grupa = (spgr, uklad, absolutny, glebokosc = 0) => {
    if (glebokosc > 20) return;
    let n;
    while ((n = znajdz(s, spgr, [0xf003, 0xf004]))) {
      if (n.typ === 0xf003) grupa(n, uklad, absolutny, glebokosc + 1);
      else ksztalt(n, uklad, absolutny);
      s.p = n.od + n.dl;
    }
  };
  const ksztalt = (sp, uklad, absolutny) => {
    const ukladTego = { ...uklad };
    s.p = sp.od;
    const fspgr = znajdz(s, sp, [0xf009]);
    if (fspgr) { s.p = fspgr.od; Object.assign(uklad, { xs: s.i32(), ys: s.i32(), xe: s.i32(), ye: s.i32() }); }
    s.p = sp.od;
    const fsp = znajdz(s, sp, [0xf00a]);
    let st = 1;
    let flagi = 0;
    if (fsp) { st = fsp.initial >> 4; s.p = fsp.od + 4; flagi = s.u32(); }
    s.p = sp.od;
    const dane = znajdz(s, sp, [0xf011]);
    if (!dane) return;
    const nr = wartosci(s, dane).get(0x6801);
    if (nr === undefined) return;
    s.p = sp.od;
    const fopt = znajdz(s, sp, [0xf00b]);
    const op = fopt ? wartosciFopt(s, fopt) : new Map();
    s.p = sp.od;
    const kotwica = znajdz(s, sp, [0xf010, 0xf00f]);
    let abs = null;
    if (kotwica?.typ === 0xf010) {
      const w = wartosci(s, kotwica);
      abs = { xs: w.get(0x2001) | 0, ys: w.get(0x2002) | 0, xe: w.get(0x2003) | 0, ye: w.get(0x2004) | 0 };
    } else if (kotwica?.typ === 0xf00f) {
      s.p = kotwica.od;
      const sw = (ukladTego.xe - ukladTego.xs) || 1;
      const sh = (ukladTego.ye - ukladTego.ys) || 1;
      const gw = absolutny.xe - absolutny.xs;
      const gh = absolutny.ye - absolutny.ys;
      const [x1, y1, x2, y2] = [s.i32(), s.i32(), s.i32(), s.i32()];
      abs = { xs: (x1 - ukladTego.xs) * (gw / sw) + absolutny.xs, ys: (y1 - ukladTego.ys) * (gh / sh) + absolutny.ys, xe: (x2 - ukladTego.xs) * (gw / sw) + absolutny.xs, ye: (y2 - ukladTego.ys) * (gh / sh) + absolutny.ys };
    }
    if (!abs) return;
    const obrot = op.has(0x0004) ? (op.get(0x0004) | 0) / 65536 : 0;
    // Obrót o ±90° (i 270°) – kotwica opisuje ramkę przed obrotem z zamienionymi bokami.
    const k = ((Math.round(obrot) % 360) + 360) % 360;
    if (k === 90 || k === 270) {
      const w0 = abs.xe - abs.xs; const h0 = abs.ye - abs.ys;
      const cx = abs.xs + w0 / 2; const cy = abs.ys + h0 / 2;
      abs = { xs: cx - h0 / 2, ys: cy - w0 / 2, xe: cx + h0 / 2, ye: cy + w0 / 2 };
    }
    if (fspgr) Object.assign(absolutny, abs);
    const pxId = op.get(0x0104);
    const wypelnienieBool = op.get(0x01bf);
    const linieBool = op.get(0x01ff);
    ksztalty.set(nr, {
      typ: st, xs: abs.xs, ys: abs.ys, xe: abs.xe, ye: abs.ye, obrot, grupa: Boolean(flagi & 1), odwrocH: Boolean(flagi & 0x40), odwrocV: Boolean(flagi & 0x80),
      obraz: pxId && pxId <= opoznione.length && opoznione[pxId - 1] >= 0 ? opoznione[pxId - 1] : null,
      wypelnienie: op.has(0x0181) && !(wypelnienieBool !== undefined && (wypelnienieBool & 0x00100010) === 0x00100000) ? op.get(0x0181) : null,
      obrys: op.has(0x01c0) && !(linieBool !== undefined && (linieBool & 0x00080008) === 0x00080000) ? op.get(0x01c0) : null,
      grubosc: op.has(0x01cb) ? op.get(0x01cb) / EMU : null,
    });
  };
  let dg;
  while ((dg = znajdz(s, korzen, [0xf002]))) {
    let spgr;
    while ((spgr = znajdz(s, dg, [0xf003]))) {
      grupa(spgr, { xs: 0, ys: 0, xe: 0, ye: 0 }, { xs: 0, ys: 0, xe: 0, ye: 0 });
      s.p = spgr.od + spgr.dl;
    }
    s.p = dg.od + dg.dl + 4;
  }
  return ksztalty;
}

const TYPY_BLIP = { 0xf01e: 'png', 0xf01d: 'jpeg', 0xf02a: 'jpeg', 0xf01f: 'bmp', 0xf01a: 'emf', 0xf01b: 'wmf', 0xf01c: 'pict', 0xf029: 'tiff' };
function czytajObrazy(b) {
  const s = new Strumien(b);
  const obrazy = new Map();
  let nr = 0;
  while (s.p + 8 <= b.length) {
    const k = kontener(s);
    nr += 1;
    const typ = TYPY_BLIP[k.typ];
    if (typ && ['png', 'jpeg', 'bmp'].includes(typ)) {
      const inst = k.initial >> 4;
      const jedenUid = typ === 'png' ? inst === 0x6e0 : typ === 'jpeg' ? [0x46a, 0x6e2, 0x46b, 0x6e3].includes(inst) : inst === 0x7a8;
      const start = (k.typ === 0xf02a ? 33 : 0x11) + (jedenUid ? 0 : 0x10);
      let bajty = b.slice(k.od + start, k.od + k.dl);
      if (typ === 'bmp') {
        // DIB → BMP: nagłówek pliku (14 bajtów) przed danymi.
        const dvb = new DataView(bajty.buffer);
        const bity = bajty.length > 0x10 ? dvb.getUint16(0x0e, true) : 24;
        let palety = bajty.length > 0x24 ? dvb.getUint32(0x20, true) : 0;
        if (!palety && bity <= 8) palety = 2 ** bity;
        const nag = new Uint8Array(14);
        const ndv = new DataView(nag.buffer);
        nag[0] = 0x42; nag[1] = 0x4d;
        ndv.setUint32(2, bajty.length + 14, true);
        ndv.setUint32(10, 0x36 + 4 * palety, true);
        const r = new Uint8Array(bajty.length + 14); r.set(nag); r.set(bajty, 14); bajty = r;
      }
      // Typ z zawartości – Publisher zapisuje np. GIF jako blip PNG.
      const mag = bajty[0] === 0x47 && bajty[1] === 0x49 ? 'image/gif' : bajty[0] === 0xff && bajty[1] === 0xd8 ? 'image/jpeg' : bajty[0] === 0x89 && bajty[1] === 0x50 ? 'image/png' : null;
      obrazy.set(nr, { typ: mag || (typ === 'jpeg' ? 'image/jpeg' : typ === 'png' ? 'image/png' : 'image/bmp'), bajty });
    } else if (typ) obrazy.set(nr, { typ: `image/${typ}`, bajty: null }); // WMF/EMF/PICT/TIFF – bez podglądu w przeglądarce
    s.p = k.od + k.dl;
  }
  return obrazy;
}

// Kolor Publishera (jak w libmspub ColorReference): bajt 0x08 – numer koloru w palecie dokumentu, inaczej 0x00BBGGRR.
export function kolorPub(v, paleta = []) {
  if (v === null || v === undefined) return null;
  const typ = (v >>> 24) & 0xff;
  let c = v & 0xffffff;
  if (typ === 0x08) { if ((v & 0xffffff) >= paleta.length) return null; c = paleta[v & 0xffffff]; }
  else if (typ !== 0) return null;
  const r = c & 0xff; const g = (c >> 8) & 0xff; const bl = (c >> 16) & 0xff;
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

// ---------- Całość ----------

export function czytajPub(bufor) {
  const cfb = czytajCfb(bufor);
  const quill = cfb.strumien('Quill/QuillSub/CONTENTS');
  const contents = cfb.strumien('Contents');
  if (!quill || !contents) throw new Error('Ten plik Publishera jest w starszym formacie (Publisher 98/2000) albo uszkodzony – otwórz go w nowszym Publisherze, zapisz i spróbuj jeszcze raz.');
  const teksty = czytajTeksty(quill);
  const doc = czytajContents(contents);
  const esc = cfb.strumien('Escher/EscherStm');
  const escher = esc ? czytajEscher(esc) : new Map();
  const delay = cfb.strumien('Escher/EscherDelayStm');
  const obrazy = delay ? czytajObrazy(delay) : new Map();
  const kolejnosc = doc.stronyKolejnosc.length ? doc.stronyKolejnosc : [...doc.strony.keys()];
  // Paleta z czarnym na początku, gdy krótsza niż 8 kolorów (jak libmspub).
  const paleta = doc.paleta.length < 8 ? [0, ...doc.paleta] : doc.paleta;
  // Strony techniczne (stałe numery w każdym pliku – jak w libmspub) i strony wzorcowe (wskazywane przez inne strony).
  const TECHNICZNE = new Set([0x10d, 0x110, 0x113, 0x117]);
  const wzorcowe = new Set([...doc.strony.values()].map((x) => x.zWzorca).filter((x) => x && doc.strony.has(x)));
  const ksztaltyStrony = (nr) => {
    const st = doc.strony.get(nr);
    const wynik = [];
    for (const id of st?.ksztalty || []) {
      const e = escher.get(id);
      const c = doc.ksztalty.get(id);
      if (!e || e.grupa) continue;
      const idTekstu = c?.tekst ?? null;
      const t = idTekstu !== null ? teksty.get(idTekstu) ?? null : null;
      const tekst = t ? t.tekst : null;
      const obraz = e.obraz !== null ? obrazy.get(e.obraz) || null : null;
      wynik.push({
        x: doc.szer / 2 + e.xs / EMU, y: doc.wys / 2 + e.ys / EMU, w: (e.xe - e.xs) / EMU, h: (e.ye - e.ys) / EMU, kat: e.obrot,
        idTekstu, tekst, style: t?.style ? t.style.map((x) => (x.kolorRef !== undefined ? { ...x, kolor: kolorPub(x.kolorRef, paleta) } : x)) : null, wyrownanie: t?.wyr || null, obraz,
        wypelnienie: kolorPub(e.wypelnienie, paleta), obrys: kolorPub(e.obrys, paleta), grubosc: e.grubosc, typKsztaltu: e.typ,
        tabela: c?.typ === 0x10,
      });
    }
    return wynik;
  };
  const strony = [];
  for (const nr of kolejnosc) {
    const st = doc.strony.get(nr);
    if (!st || TECHNICZNE.has(nr) || wzorcowe.has(nr) || st.wzorzec) continue;
    const wlasne = ksztaltyStrony(nr);
    if (!wlasne.length) continue; // jak libmspub: strona bez własnych kształtów to strona pomocnicza
    const zWzorca = st.zWzorca && doc.strony.has(st.zWzorca) ? ksztaltyStrony(st.zWzorca).map((k) => ({ ...k, zWzorca: true })) : [];
    strony.push({ ksztalty: [...zWzorca, ...wlasne] });
  }
  return { szer: doc.szer, wys: doc.wys, strony, tekstow: teksty.size, obrazow: obrazy.size };
}
