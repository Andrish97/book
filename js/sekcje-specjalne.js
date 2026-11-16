// Sekcje specjalne (#177): rodzaje sekcji, które – jak okładka z liczonym grzbietem (js/okladka.js) – „wiedzą”,
// jak działa wydrukowana rzecz: znają swoje strefy (panele, skrzydełka, klapy), liczą wymiary, rysują linie zgięć
// (bigi), perforacji i wykrojnika, ostrzegają o elementach na zgięciach i poza wykrojnikiem, a eksport PDF zna
// arkusz w pełnym wymiarze, warstwę wykrojnika i układ użytków na arkuszu. Same obliczenia – bez DOM i bez Fabric.
//
// Sekcja ma pole `specjalna`: { rodzaj, …parametry rodzaju, wynik }. `wynik` liczy aplikacja (jak okladka.wynik):
//   { rodzaj, szerokosc, wysokosc, stron, strefy, bigi, perforacje, ciecie, uzytki?, kalendarz? }
//   strefy:     [{ rodzaj, nazwa, x1, y1, x2, y2, strona? }]   – strona: 0/1 (tylko ta strona sekcji, np. ulotka)
//   bigi:       [{ x1, y1, x2, y2, strona? }]                  – linie zgięć (bigowania)
//   perforacje: [{ x1, y1, x2, y2 }]                           – linie perforacji
//   ciecie:     [[{ x, y }, …]]                                – zamknięte kontury wykrojnika (cięcie po kształcie)
//   nacięcia:   [{ x1, y1, x2, y2 }]                           – krótkie nacięcia (np. na wizytówkę w teczce)
// Wymiary w mm od lewego górnego rogu formatu netto (bez spadu).
//
// Kolejny rodzaj dodaje się wpisem w RODZAJE_SEKCJI (nazwa, opis, domyślne parametry, normalizacja, geometria).

import { geometriaOkladki, normalizujOkladke, przesunElementy, poPrzeliczeniu } from './okladka.js';
import { swietaPolskie, dataIso } from './swieta.js';
import { rozwin } from './serie.js';
import { uid, WZORCE_Z_SEKCJI, uporzadkujStrony } from './projekt.js';
import { TYPY_SEKCJI, typSekcji, rolaTypu } from './typ-sekcji.js';

export { TYPY_SEKCJI, typSekcji };

const zaokr = (mm) => Math.round(mm * 10) / 10;
const liczbaLub = (v, d, min = 0, max = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const zListy = (v, lista, d) => (lista.includes(v) ? v : d);
const prost = (rodzaj, nazwa, x1, y1, x2, y2, dodatki = {}) => ({ rodzaj, nazwa, x1: zaokr(x1), y1: zaokr(y1), x2: zaokr(x2), y2: zaokr(y2), ...dodatki });
const linia = (x1, y1, x2, y2, dodatki = {}) => ({ x1: zaokr(x1), y1: zaokr(y1), x2: zaokr(x2), y2: zaokr(y2), ...dodatki });
const punkty = (lista) => lista.map(([x, y]) => ({ x: zaokr(x), y: zaokr(y) }));

// ---------- Obwoluta ----------

// Książka, na którą idzie obwoluta: twarda okładka projektu (jej płyty i grzbiet) albo – gdy jej nie ma – liczona
// tak samo, jak liczyłaby się okładka twarda dla środka projektu.
function ksiazkaPodObwolute(projekt, sekcja, ciag) {
  const okladka = (projekt.sekcje || []).find((s) => s.okladka && s.okladka.oprawa === 'twarda');
  const wzorOkladki = okladka || { id: '__obwoluta__', okladka: normalizujOkladke({ oprawa: 'twarda' }) };
  const zbior = okladka ? projekt : { ...projekt, sekcje: [...projekt.sekcje.filter((s) => s !== sekcja && (!s.specjalna || s.specjalna.rodzaj === 'wyklejka')), wzorOkladki] };
  const g = geometriaOkladki(zbior, wzorOkladki, ciag);
  const plyta = g.strefy.find((z) => z.rodzaj === 'przod');
  const grzbiet = g.strefy.find((z) => z.rodzaj === 'grzbiet');
  return {
    panel: zaokr(plyta.x2 - plyta.x1), // szerokość płyty (strona + naddatek)
    grzbiet: zaokr(grzbiet ? grzbiet.x2 - grzbiet.x1 : g.grzbiet),
    wysokosc: zaokr(g.dol - g.gora), // wysokość płyty
    zOkladki: Boolean(okladka),
    stron: g.stron,
  };
}

function geometriaObwoluty(projekt, sekcja, p, ciag) {
  const k = ksiazkaPodObwolute(projekt, sekcja, ciag);
  const s = p.skrzydelko_mm || zaokr(k.panel * 0.55);
  const z = p.zapas_mm; // na grubość płyty przy zgięciu przód / skrzydełko
  const wys = zaokr(k.wysokosc + p.naddatek_wys_mm);
  const strefy = [];
  const bigi = [];
  let x = 0;
  const dodaj = (rodzaj, nazwa, w) => { strefy.push(prost(rodzaj, nazwa, x, 0, x + w, wys)); x += w; };
  dodaj('skrzydelko_l', 'Skrzydełko', s);
  dodaj('zapas_l', 'Zgięcie', z);
  dodaj('tyl', 'Tył', k.panel);
  dodaj('grzbiet', 'Grzbiet', k.grzbiet);
  dodaj('przod', 'Przód', k.panel);
  dodaj('zapas_p', 'Zgięcie', z);
  dodaj('skrzydelko_p', 'Skrzydełko', s);
  for (const st of strefy.slice(1)) bigi.push(linia(st.x1, 0, st.x1, wys));
  return {
    szerokosc: zaokr(x), wysokosc: wys, stron: 1, strefy, bigi, perforacje: [], ciecie: [],
    ksiazka: { grzbiet: k.grzbiet, panel: k.panel, wysokosc: k.wysokosc, zOkladki: k.zOkladki, stron: k.stron },
  };
}

// ---------- Ulotka składana ----------

// Szerokości paneli strony wewnętrznej, od lewej. Zwijana (łamana C / „rolowana”): panele, które składają się do
// środka, są węższe o skrót (każdy kolejny o następny skrót) – inaczej zginałyby się na zgięciu. Harmonijka (Z):
// wszystkie równe.
export function paneleUlotki(p) {
  const n = p.panele;
  const W = p.szerokosc_mm;
  if (p.zlozenie === 'z' || n === 2) return Array(n).fill(W);
  return Array.from({ length: n }, (_, i) => (i < 2 ? W : W - (i - 1) * p.skrot_mm));
}

function nazwyPaneli(p) {
  const n = p.panele;
  const zew = Array.from({ length: n }, (_, i) => `Zewnątrz ${i + 1}`);
  const wew = Array.from({ length: n }, (_, i) => `Środek ${i + 1}`);
  zew[n - 1] = 'Okładka';
  if (n === 2) zew[0] = 'Tył';
  else if (p.zlozenie === 'z') zew[0] = 'Tył';
  else { zew[n - 2] = 'Tył'; zew[0] = 'Skrzydło do środka'; }
  return { zew, wew };
}

function geometriaUlotki(p) {
  const wew = paneleUlotki(p);
  const zew = [...wew].reverse(); // druga strona arkusza: panele w odbiciu (obrót po dłuższej krawędzi)
  const H = p.wysokosc_mm;
  const nazwy = nazwyPaneli(p);
  const strefy = [];
  const bigi = [];
  const rozloz = (szer, strona, podpisy, przedrostek) => {
    let x = 0;
    szer.forEach((w, i) => {
      strefy.push(prost(`${przedrostek}${i + 1}`, podpisy[i], x, 0, x + w, H, { strona }));
      if (i) bigi.push(linia(x, 0, x, H, { strona }));
      x += w;
    });
    return x;
  };
  const szerokosc = rozloz(zew, 0, nazwy.zew, 'zew_');
  rozloz(wew, 1, nazwy.wew, 'wew_');
  return { szerokosc: zaokr(szerokosc), wysokosc: zaokr(H), stron: 2, strefy, bigi, perforacje: [], ciecie: [], panele: wew };
}

// ---------- Kalendarz trójdzielny ----------

function geometriaTrojdzielnego(p) {
  const W = p.szerokosc_mm;
  const strefy = [];
  const bigi = [];
  const perforacje = [];
  let y = 0;
  strefy.push(prost('glowka', 'Główka', 0, 0, W, p.glowka_mm));
  y = p.glowka_mm;
  bigi.push(linia(0, y, W, y)); // główka zgina się do tyłu – staje jak podstawka
  const mk = p.margines_kal_mm;
  for (let i = 1; i <= 3; i += 1) {
    strefy.push(prost(`kalendarium_${i}`, `Kalendarium ${i}`, mk, y + 2, W - mk, y + p.kalendarium_mm - 2));
    y += p.kalendarium_mm;
    if (i < 3) perforacje.push(linia(0, y, W, y));
  }
  if (p.okienko) {
    // Okienko (suwak) na środkowym kalendarium: przezroczysty pasek wskazujący bieżący dzień.
    const s = strefy.find((z) => z.rodzaj === 'kalendarium_2');
    const oh = 14;
    strefy.push(prost('okienko', 'Okienko', s.x1, (s.y1 + s.y2) / 2 - oh / 2, s.x2, (s.y1 + s.y2) / 2 + oh / 2));
  }
  if (p.reklama_mm > 0) {
    strefy.push(prost('reklama', 'Pasek reklamowy', 0, y, W, y + p.reklama_mm));
    perforacje.push(linia(0, y, W, y));
    y += p.reklama_mm;
  }
  return { szerokosc: zaokr(W), wysokosc: zaokr(y), stron: 1, strefy, bigi, perforacje, ciecie: [] };
}

// ---------- Wykrojniki ----------

export const KOPERTY = { C6: [162, 114], DL: [220, 110], C5: [229, 162], kwadrat: [155, 155] };

function geometriaKoperty(p) {
  const [W, H] = KOPERTY[p.koperta] || KOPERTY.C6;
  const sb = zaokr(Math.min(28, W * 0.16)); // klapki boczne
  const t = zaokr(H * 0.42); // klapa zamykająca
  const b = zaokr(H * 0.58); // spód (zakleja się na klapkach)
  const x0 = sb;
  const y0 = t;
  const kontur = punkty([
    [x0, y0], [x0 + W * 0.12, 0], [x0 + W * 0.88, 0], [x0 + W, y0], // klapa zamykająca
    [x0 + W + sb, y0 + H * 0.14], [x0 + W + sb, y0 + H * 0.86], [x0 + W, y0 + H], // prawa klapka
    [x0 + W * 0.93, y0 + H + b], [x0 + W * 0.07, y0 + H + b], [x0, y0 + H], // spód
    [0, y0 + H * 0.86], [0, y0 + H * 0.14], // lewa klapka
  ]);
  const strefy = [
    prost('front', 'Przód koperty (adres)', x0, y0, x0 + W, y0 + H),
    prost('klapa', 'Klapa zamykająca', x0 + W * 0.12, 2, x0 + W * 0.88, y0),
    prost('spod', 'Tył koperty', x0 + W * 0.07, y0 + H, x0 + W * 0.93, y0 + H + b - 2),
    prost('klapka_l', 'Klapka', 2, y0 + H * 0.14, x0, y0 + H * 0.86),
    prost('klapka_p', 'Klapka', x0 + W, y0 + H * 0.14, x0 + W + sb - 2, y0 + H * 0.86),
    prost('klej', 'Klej', x0 + W * 0.07, y0 + H + b - 8, x0 + W * 0.93, y0 + H + b - 2),
  ];
  const bigi = [linia(x0, y0, x0 + W, y0), linia(x0, y0 + H, x0 + W, y0 + H), linia(x0, y0, x0, y0 + H), linia(x0 + W, y0, x0 + W, y0 + H)];
  return { szerokosc: zaokr(W + 2 * sb), wysokosc: zaokr(t + H + b), strefy, bigi, ciecie: [kontur], naciecia: [], zlozona: { w: W, h: H } };
}

function geometriaTeczki(p) {
  const P = p.panel_szer_mm; // panel 220
  const Hh = p.panel_wys_mm; // 310
  const g = p.grzbiet_mm;
  const K = p.kieszen_mm;
  const t = 12; // zakładki klejowe kieszeni
  const ox = t;
  const kontur = punkty([
    [ox, 0], [ox + 2 * P + g, 0], [ox + 2 * P + g, Hh], [ox + P, Hh],
    [ox + P + t, Hh + 8], [ox + P + t, Hh + K - 8], [ox + P, Hh + K], [ox, Hh + K],
    [ox - t, Hh + K - 8], [ox - t, Hh + 8], [ox, Hh],
  ]);
  const strefy = [
    prost('wnetrze_l', 'Tył (wewnątrz: lewa)', ox, 0, ox + P, Hh),
    prost('grzbiet', 'Grzbiet', ox + P, 0, ox + P + g, Hh),
    prost('front', 'Przód teczki', ox + P + g, 0, ox + 2 * P + g, Hh),
    prost('kieszen', 'Kieszeń', ox, Hh, ox + P, Hh + K),
    prost('klej_l', 'Klej', ox - t, Hh + 8, ox, Hh + K - 8),
    prost('klej_p', 'Klej', ox + P, Hh + 8, ox + P + t, Hh + K - 8),
  ];
  const bigi = [
    linia(ox + P, 0, ox + P, Hh), linia(ox + P + g, 0, ox + P + g, Hh), linia(ox, Hh, ox + P, Hh),
    linia(ox, Hh, ox, Hh + K), linia(ox + P, Hh, ox + P, Hh + K),
  ];
  // Nacięcia na wizytówkę 90 × 50 mm na kieszeni (dwa rogi po przekątnej).
  const naciecia = [];
  if (p.wizytowka) {
    const cx = ox + P * 0.68;
    const cy = Hh + K * 0.55;
    const [vw, vh] = [90, 50];
    const r = 10;
    naciecia.push(linia(cx - vw / 2, cy - vh / 2 + r, cx - vw / 2 + r, cy - vh / 2));
    naciecia.push(linia(cx + vw / 2 - r, cy + vh / 2, cx + vw / 2, cy + vh / 2 - r));
    strefy.push(prost('wizytowka', 'Wizytówka', cx - vw / 2, cy - vh / 2, cx + vw / 2, cy + vh / 2));
  }
  return { szerokosc: zaokr(ox + 2 * P + g), wysokosc: zaokr(Hh + K), strefy, bigi, ciecie: [kontur], naciecia, zlozona: { w: P, h: Hh } };
}

function geometriaPudelka(p) {
  const L = p.dlugosc_mm;
  const Wd = p.szerokosc_mm;
  const H = p.wysokosc_mm;
  const kl = 15; // zakładka klejowa
  const jez = Math.min(15, Wd * 0.6); // język wieczka
  const df = zaokr(Math.min(Wd * 0.8, L * 0.45)); // klapki przeciwkurzowe
  const top = Wd + jez;
  const xA1 = kl; const xA2 = xA1 + L; const xB2 = xA2 + Wd; const xC2 = xB2 + L; const xD2 = xC2 + Wd;
  const d = top + H;
  const kontur = punkty([
    [0, top + 3], [kl, top],
    [xA2, top], // przód: góra bez klapy
    [xA2 + 2, top - df], [xB2 - 6, top - df], [xB2, top - 4], [xB2, top], // klapka B
    [xB2, top - Wd], [xB2 + 4, top - Wd - jez], [xC2 - 4, top - Wd - jez], [xC2, top - Wd], [xC2, top], // wieczko górne (na tyle)
    [xC2, top - 4], [xC2 + 6, top - df], [xD2 - 2, top - df], [xD2, top], // klapka D
    [xD2, d],
    [xD2 - 2, d + df], [xC2 + 6, d + df], [xC2, d + 4], [xC2, d], // klapka D dół
    [xB2, d],
    [xB2, d + 4], [xB2 - 6, d + df], [xA2 + 2, d + df], [xA2, d], // klapka B dół
    [xA2, d + Wd], [xA2 - 4, d + Wd + jez], [xA1 + 4, d + Wd + jez], [xA1, d + Wd], [xA1, d], // wieczko dolne (na przodzie)
    [kl, d], [0, d - 3],
  ]);
  const strefy = [
    prost('przod', 'Przód', xA1, top, xA2, d),
    prost('bok_l', 'Bok', xA2, top, xB2, d),
    prost('tyl', 'Tył', xB2, top, xC2, d),
    prost('bok_p', 'Bok', xC2, top, xD2, d),
    prost('wieczko_g', 'Wieczko', xB2, top - Wd, xC2, top),
    prost('wieczko_d', 'Dno', xA1, d, xA2, d + Wd),
    prost('klej', 'Klej', 0, top + 3, kl, d - 3),
  ];
  const bigi = [
    linia(xA1, top, xA1, d), linia(xA2, top, xA2, d), linia(xB2, top, xB2, d), linia(xC2, top, xC2, d),
    linia(xA2, top, xB2, top), linia(xB2, top, xC2, top), linia(xC2, top, xD2, top), linia(xB2, top - Wd, xC2, top - Wd),
    linia(xA1, d, xA2, d), linia(xA2, d, xB2, d), linia(xC2, d, xD2, d), linia(xA1, d + Wd, xA2, d + Wd),
  ];
  return { szerokosc: zaokr(xD2), wysokosc: zaokr(d + Wd + jez), strefy, bigi, ciecie: [kontur], naciecia: [], zlozona: { w: L, h: H, g: Wd } };
}

function geometriaWykrojnika(p) {
  const g = p.ksztalt === 'teczka' ? geometriaTeczki(p) : p.ksztalt === 'pudelko' ? geometriaPudelka(p) : geometriaKoperty(p);
  return { stron: 1, perforacje: [], ...g };
}

// ---------- Arkusz użytków ----------

export const ARKUSZE_UZYTKOW = { SRA3: [320, 450], A3: [297, 420], A4: [210, 297], B2: [500, 700] };

// Ile użytków (w × h, ze spadem) zmieści się na arkuszu: obie orientacje arkusza, wybór tej z większą liczbą.
export function ukladUzytkow({ w, h }, p, spad = 0) {
  const [a1, a2] = p.arkusz === 'wlasny' ? [p.arkusz_szer_mm, p.arkusz_wys_mm] : (ARKUSZE_UZYTKOW[p.arkusz] || ARKUSZE_UZYTKOW.SRA3);
  const m = p.margines_mm;
  const krok = (rozmiar) => rozmiar + Math.max(p.odstep_mm, 2 * spad);
  const ile = (dl, rozmiar) => Math.max(0, Math.floor((dl - 2 * m + Math.max(p.odstep_mm, 2 * spad)) / krok(rozmiar)));
  const warianty = [[a1, a2], [a2, a1]].map(([aw, ah]) => ({ arkusz: { w: aw, h: ah }, kolumny: ile(aw, w), wiersze: ile(ah, h) }));
  const najlepszy = warianty.sort((x, y) => y.kolumny * y.wiersze - x.kolumny * x.wiersze)[0];
  const kolumny = p.kolumny > 0 ? Math.min(p.kolumny, najlepszy.kolumny || p.kolumny) : najlepszy.kolumny;
  const wiersze = p.wiersze > 0 ? Math.min(p.wiersze, najlepszy.wiersze || p.wiersze) : najlepszy.wiersze;
  const odstep = Math.max(p.odstep_mm, 2 * spad);
  const zajete = { w: kolumny * w + (kolumny - 1) * odstep, h: wiersze * h + (wiersze - 1) * odstep };
  return {
    arkusz: najlepszy.arkusz, kolumny, wiersze, na_arkuszu: kolumny * wiersze, odstep,
    // Użytki na środku arkusza.
    x0: zaokr((najlepszy.arkusz.w - zajete.w) / 2), y0: zaokr((najlepszy.arkusz.h - zajete.h) / 2),
  };
}

// Kontur zaokrąglonego prostokąta (wykrojnik naklejki) jako wielokąt.
function zaokraglonyProstokat(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  if (rr <= 0) return punkty([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  const pkt = [];
  const luk = (cx, cy, od) => { for (let i = 0; i <= 6; i += 1) { const k = ((od + i * 15) * Math.PI) / 180; pkt.push([cx + rr * Math.cos(k), cy + rr * Math.sin(k)]); } };
  luk(x + w - rr, y + rr, 270); luk(x + w - rr, y + h - rr, 0); luk(x + rr, y + h - rr, 90); luk(x + rr, y + rr, 180);
  return punkty(pkt);
}

function geometriaArkusza(p) {
  const w = p.uzytek_szer_mm;
  const h = p.uzytek_wys_mm;
  const ciecie = p.ksztalt === 'naklejka' ? [zaokraglonyProstokat(0, 0, w, h, p.zaokraglenie_mm)] : [];
  return {
    szerokosc: zaokr(w), wysokosc: zaokr(h), stron: 1, strefy: [prost('uzytek', 'Użytek', 0, 0, w, h)], bigi: [], perforacje: [], ciecie, naciecia: [],
  };
}

// ---------- Wyklejka ----------

// Sekcje bloku (środka książki): zwykłe strony z rolą „blok” i kalendarz z datami – bez okładki, wyklejek,
// wkładek i sekcji z osobnym arkuszem.
export function sekcjeBloku(projekt) {
  return (projekt.sekcje || []).filter((s) => rolaSekcji(projekt, s) === 'blok');
}

// Wyklejka: arkusz w rozłożeniu – dwie kartki formatu bloku obok siebie, złożone w grzbiecie. Jedna połowa
// przykleja się do wewnętrznej strony twardej okładki, druga jest pierwszą (przednia) albo ostatnią (tylna)
// luźną kartką książki. Strona 1 – zadrukowana strona widoczna po otwarciu okładki; strona 2 (zadruk dwustronny) –
// odwrotna strona arkusza.
function geometriaWyklejki(projekt, sekcja, p) {
  const blok = sekcjeBloku(projekt)[0]?.wydruk || { szerokosc_mm: 148, wysokosc_mm: 210 };
  const sz = blok.szerokosc_mm;
  const wy = blok.wysokosc_mm;
  const przednia = p.strona === 'przednia';
  const naOkladce = 'Na okładce (przyklejona)';
  const luzna = przednia ? 'Pierwsza luźna kartka' : 'Ostatnia luźna kartka';
  const strefy = [
    prost(przednia ? 'na_okladke' : 'luzna', przednia ? naOkladce : luzna, 0, 0, sz, wy, { strona: 0 }),
    prost(przednia ? 'luzna' : 'na_okladke', przednia ? luzna : naOkladce, sz, 0, 2 * sz, wy, { strona: 0 }),
    prost(przednia ? 'luzna_tyl' : 'klej', przednia ? 'Luźna kartka – odwrotna strona' : 'Klejona do okładki (niewidoczna)', 0, 0, sz, wy, { strona: 1 }),
    prost(przednia ? 'klej' : 'luzna_tyl', przednia ? 'Klejona do okładki (niewidoczna)' : 'Luźna kartka – odwrotna strona', sz, 0, 2 * sz, wy, { strona: 1 }),
  ];
  return {
    szerokosc: zaokr(2 * sz), wysokosc: zaokr(wy), stron: p.zadruk === 'dwustronny' ? 2 : 1, strefy,
    bigi: [linia(sz, 0, sz, wy)], perforacje: [], ciecie: [], naciecia: [], kartka_mm: zaokr((p.gramatura * 1.25) / 100) / 10,
  };
}

// ---------- Rola sekcji w publikacji ----------

// Rola, którą rozumie cała aplikacja: grzbiet okładki liczy się z bloku (i osobno z wyklejek i wkładek),
// numeracja stron pomija okładkę, wyklejki, obwolutę i wkładki, PDF dla drukarni dzieli się na pliki według roli,
// a kontrola przed drukiem pilnuje kompletu (twarda oprawa bez wyklejek, wyklejka przy miękkiej).
export const ROLE_SEKCJI = {
  blok: { nazwa: 'Blok (środek książki)', opis: 'Strony środka: liczą się do numeracji i do grubości grzbietu (papier środka z okładki).' },
  okladka: { nazwa: 'Okładka', opis: 'Okładka z grzbietem liczonym z bloku – osobny plik dla drukarni, bez numerów stron.' },
  wyklejka: { nazwa: 'Wyklejka', opis: 'Arkusz łączący blok z twardą okładką: połowa na okładce, połowa to pierwsza albo ostatnia kartka. Własny papier, bez numerów stron.' },
  obwoluta: { nazwa: 'Obwoluta', opis: 'Papierowa okładka na twardą oprawę, ze skrzydełkami – osobny plik.' },
  wkladka: { nazwa: 'Wkładka', opis: 'Kartki na innym papierze w środku (np. zdjęcia na kredzie): poza numeracją, grubość z własnego papieru.' },
  podkladka: { nazwa: 'Podkładka / plecy', opis: 'Karton pod kalendarzem albo notesem (np. plecy z główką): poza numeracją i grzbietem.' },
  osobny: { nazwa: 'Osobny druk', opis: 'Rzecz drukowana osobno (ulotka, wykrojnik, arkusz użytków, kalendarz trójdzielny).' },
};
// Role do wyboru przy zwykłej sekcji stron (pozostałe wynikają z rodzaju sekcji).
export const ROLE_STRON = ['blok', 'wkladka', 'podkladka'];

// Rola wynika wyłącznie z typu sekcji (sekcja.typ, js/typ-sekcji.js) – nigdy z nazwy.
export function rolaSekcji(projekt, sekcja) {
  return rolaTypu(typSekcji(sekcja));
}

// Wyklejki projektu: { przednia, tylna } – sekcje (albo null) z wymiarami arkusza. Dla makiety 3D (#161):
// przednia.wynik.strefy z rodzajem 'na_okladke' – połowa do przyklejenia do okładki, 'luzna' – pierwsza kartka.
export function wyklejkiProjektu(projekt) {
  const wynik = { przednia: null, tylna: null };
  for (const s of projekt.sekcje || []) {
    const typ = typSekcji(s);
    if (typ !== 'wyklejka_przednia' && typ !== 'wyklejka_tylna') continue;
    const strona = typ === 'wyklejka_tylna' ? 'tylna' : 'przednia';
    if (!wynik[strona]) wynik[strona] = s;
  }
  return wynik;
}

// ---------- Kalendarz z datami ----------

const DNI = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MIESIACE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MIESIACE_D = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const wielka = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export const KOLUMNY_KALENDARZA = {
  dzien: ['data', 'dzien', 'miesiac', 'miesiac_dopelniacz', 'miesiac_nr', 'rok', 'dzien_tygodnia', 'dzien_roku', 'tydzien', 'swieto', 'wolne', 'niedziela'],
  tydzien: ['data', 'tydzien', 'od', 'do', 'miesiac', 'rok', 'swieta'],
  miesiac: ['data', 'miesiac', 'miesiac_nr', 'rok', 'dni', 'swieta'],
};

// Numer tygodnia ISO 8601 (tydzień zaczyna się w poniedziałek; pierwszy tydzień ma 4 stycznia).
export function tydzienIso(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dzien = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dzien + 3);
  const pierwszy = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - pierwszy) / 86400000 - 3 + ((pierwszy.getUTCDay() + 6) % 7)) / 7);
}

// Wiersze danych kalendarza na rok: dzień po dniu, tydzień po tygodniu albo miesiąc po miesiącu.
export function wierszeKalendarza(p) {
  const rok = p.rok;
  const swieta = p.swieta === 'pl' ? swietaPolskie(rok) : new Map();
  const dzien = (r, m, d) => new Date(Date.UTC(r, m, d));
  const wolny = (d) => d.getUTCDay() === 0 || swieta.has(dataIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  if (p.jednostka === 'miesiac') {
    return MIESIACE.map((nazwa, m) => {
      const dni = new Date(Date.UTC(rok, m + 1, 0)).getUTCDate();
      const lista = [...swieta].filter(([k]) => Number(k.slice(5, 7)) === m + 1).map(([k, n]) => `${Number(k.slice(8))} – ${n}`);
      return [dataIso(rok, m + 1, 1), wielka(nazwa), String(m + 1), String(rok), String(dni), lista.join('; ')];
    });
  }
  if (p.jednostka === 'tydzien') {
    const start = dzien(rok, 0, 1);
    const przesun = p.pierwszy === 'nd' ? start.getUTCDay() : (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - przesun);
    const wiersze = [];
    for (let d = start; ; d = dzien(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 7)) {
      if (d.getUTCFullYear() > rok) break;
      const koniec = dzien(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 6);
      if (koniec.getUTCFullYear() < rok) continue;
      const lista = [];
      for (let i = 0; i < 7; i += 1) {
        const x = dzien(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + i);
        const n = swieta.get(dataIso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()));
        if (n) lista.push(`${x.getUTCDate()} ${MIESIACE_D[x.getUTCMonth()]} – ${n}`);
      }
      const odTekst = `${d.getUTCDate()} ${MIESIACE_D[d.getUTCMonth()]}`;
      const doTekst = `${koniec.getUTCDate()} ${MIESIACE_D[koniec.getUTCMonth()]}`;
      const czwartek = dzien(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (p.pierwszy === 'nd' ? 4 : 3));
      wiersze.push([dataIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), String(tydzienIso(czwartek)), odTekst, doTekst, wielka(MIESIACE[czwartek.getUTCMonth()]), String(rok), lista.join('; ')]);
    }
    return wiersze;
  }
  const wiersze = [];
  for (let d = dzien(rok, 0, 1), i = 1; d.getUTCFullYear() === rok; d = dzien(rok, d.getUTCMonth(), d.getUTCDate() + 1), i += 1) {
    const iso = dataIso(rok, d.getUTCMonth() + 1, d.getUTCDate());
    wiersze.push([
      iso, String(d.getUTCDate()), wielka(MIESIACE[d.getUTCMonth()]), MIESIACE_D[d.getUTCMonth()], String(d.getUTCMonth() + 1), String(rok),
      wielka(DNI[d.getUTCDay()]), String(i), String(tydzienIso(d)), swieta.get(iso) || '', wolny(d) ? 'tak' : '', d.getUTCDay() === 0 ? 'tak' : '',
    ]);
  }
  return wiersze;
}

// ---------- Rodzaje ----------

export const RODZAJE_SEKCJI = {
  obwoluta: {
    nazwa: 'Obwoluta',
    opis: 'Papierowa okładka na twardą oprawę: tył, grzbiet i przód z wymiarów książki, dwa skrzydełka zawinięte do środka.',
    domyslne: { skrzydelko_mm: 0, zapas_mm: 3, naddatek_wys_mm: 0 },
    normalizuj: (o, d) => ({ skrzydelko_mm: liczbaLub(o.skrzydelko_mm, d.skrzydelko_mm, 0, 300), zapas_mm: liczbaLub(o.zapas_mm, d.zapas_mm, 0, 20), naddatek_wys_mm: liczbaLub(o.naddatek_wys_mm, d.naddatek_wys_mm, 0, 20) }),
    geometria: (projekt, sekcja, p, ciag) => geometriaObwoluty(projekt, sekcja, p, ciag),
  },
  ulotka: {
    nazwa: 'Ulotka składana',
    opis: 'Arkusz składany na 2, 3 albo 4 panele – strona zewnętrzna i wewnętrzna, zgięcia (bigi) i panele podpisane.',
    domyslne: { panele: 3, zlozenie: 'c', szerokosc_mm: 99, wysokosc_mm: 210, skrot_mm: 2 },
    normalizuj: (o, d) => ({
      panele: Math.round(liczbaLub(o.panele, d.panele, 2, 4)), zlozenie: zListy(o.zlozenie, ['c', 'z'], d.zlozenie),
      szerokosc_mm: liczbaLub(o.szerokosc_mm, d.szerokosc_mm, 30, 500), wysokosc_mm: liczbaLub(o.wysokosc_mm, d.wysokosc_mm, 30, 700),
      skrot_mm: liczbaLub(o.skrot_mm, d.skrot_mm, 0, 10),
    }),
    geometria: (projekt, sekcja, p) => geometriaUlotki(p),
  },
  kalendarz: {
    nazwa: 'Kalendarz z datami',
    opis: 'Sekcja „rok”: daty, dni tygodnia, numery tygodni i polskie święta (także ruchome) w danych – zmiana roku przelicza wszystko.',
    domyslne: { rok: new Date().getFullYear() + 1, jednostka: 'miesiac', pierwszy: 'pn', swieta: 'pl', tabela: null, seria: null },
    normalizuj: (o, d) => ({
      rok: Math.round(liczbaLub(o.rok, d.rok, 1900, 2200)), jednostka: zListy(o.jednostka, ['dzien', 'tydzien', 'miesiac'], d.jednostka),
      pierwszy: zListy(o.pierwszy, ['pn', 'nd'], d.pierwszy), swieta: zListy(o.swieta, ['pl', 'brak'], d.swieta),
      tabela: typeof o.tabela === 'string' ? o.tabela : null, seria: typeof o.seria === 'string' ? o.seria : null,
    }),
    geometria: null, // format sekcji bez zmian – sekcja liczy dane
  },
  trojdzielny: {
    nazwa: 'Kalendarz trójdzielny',
    opis: 'Główka (plecy) i trzy kalendaria jeden pod drugim, okienko na środkowym, pasek reklamowy – z bigiem i perforacjami.',
    domyslne: { szerokosc_mm: 310, glowka_mm: 200, kalendarium_mm: 145, reklama_mm: 60, margines_kal_mm: 7, okienko: true },
    normalizuj: (o, d) => ({
      szerokosc_mm: liczbaLub(o.szerokosc_mm, d.szerokosc_mm, 150, 500), glowka_mm: liczbaLub(o.glowka_mm, d.glowka_mm, 50, 400),
      kalendarium_mm: liczbaLub(o.kalendarium_mm, d.kalendarium_mm, 60, 300), reklama_mm: liczbaLub(o.reklama_mm, d.reklama_mm, 0, 200),
      margines_kal_mm: liczbaLub(o.margines_kal_mm, d.margines_kal_mm, 0, 50), okienko: o.okienko !== false && d.okienko !== false && o.okienko !== 0,
    }),
    geometria: (projekt, sekcja, p) => geometriaTrojdzielnego(p),
  },
  wykrojnik: {
    nazwa: 'Wykrojnik',
    opis: 'Koperta, teczka ofertowa z kieszenią albo składane pudełko – rozkładówka z linią cięcia i zgięć w osobnej warstwie.',
    domyslne: { ksztalt: 'koperta', koperta: 'C6', panel_szer_mm: 220, panel_wys_mm: 310, grzbiet_mm: 5, kieszen_mm: 100, wizytowka: true, dlugosc_mm: 100, szerokosc_mm: 60, wysokosc_mm: 150 },
    normalizuj: (o, d) => ({
      ksztalt: zListy(o.ksztalt, ['koperta', 'teczka', 'pudelko'], d.ksztalt), koperta: KOPERTY[o.koperta] ? o.koperta : d.koperta,
      panel_szer_mm: liczbaLub(o.panel_szer_mm, d.panel_szer_mm, 80, 400), panel_wys_mm: liczbaLub(o.panel_wys_mm, d.panel_wys_mm, 80, 500),
      grzbiet_mm: liczbaLub(o.grzbiet_mm, d.grzbiet_mm, 0, 50), kieszen_mm: liczbaLub(o.kieszen_mm, d.kieszen_mm, 30, 200),
      wizytowka: o.wizytowka !== false && o.wizytowka !== 0,
      dlugosc_mm: liczbaLub(o.dlugosc_mm, d.dlugosc_mm, 20, 400), szerokosc_mm: liczbaLub(o.szerokosc_mm, d.szerokosc_mm, 10, 400), wysokosc_mm: liczbaLub(o.wysokosc_mm, d.wysokosc_mm, 10, 500),
    }),
    geometria: (projekt, sekcja, p) => geometriaWykrojnika(p),
  },
  wyklejka: {
    nazwa: 'Wyklejka',
    opis: 'Przednia albo tylna wyklejka twardej oprawy: arkusz z dwóch kartek formatu bloku – połowa na okładce, połowa to luźna kartka. Własny papier, bez numerów stron.',
    domyslne: { strona: 'przednia', zadruk: 'jednostronny', gramatura: 140 },
    normalizuj: (o, d) => ({
      strona: zListy(o.strona, ['przednia', 'tylna'], d.strona), zadruk: zListy(o.zadruk, ['czysta', 'jednostronny', 'dwustronny'], d.zadruk),
      gramatura: liczbaLub(o.gramatura, d.gramatura, 60, 400),
    }),
    geometria: (projekt, sekcja, p) => geometriaWyklejki(projekt, sekcja, p),
  },
  arkusz: {
    nazwa: 'Arkusz użytków',
    opis: 'Naklejki, wizytówki, etykiety: jeden użytek (albo kolejne z danych) powielony na arkuszu drukarskim ze znakami cięcia.',
    domyslne: { uzytek_szer_mm: 85, uzytek_wys_mm: 55, arkusz: 'SRA3', arkusz_szer_mm: 320, arkusz_wys_mm: 450, odstep_mm: 4, margines_mm: 10, kolumny: 0, wiersze: 0, ksztalt: 'prostokat', zaokraglenie_mm: 3 },
    normalizuj: (o, d) => ({
      uzytek_szer_mm: liczbaLub(o.uzytek_szer_mm, d.uzytek_szer_mm, 10, 500), uzytek_wys_mm: liczbaLub(o.uzytek_wys_mm, d.uzytek_wys_mm, 10, 500),
      arkusz: ARKUSZE_UZYTKOW[o.arkusz] || o.arkusz === 'wlasny' ? o.arkusz : d.arkusz,
      arkusz_szer_mm: liczbaLub(o.arkusz_szer_mm, d.arkusz_szer_mm, 50, 1200), arkusz_wys_mm: liczbaLub(o.arkusz_wys_mm, d.arkusz_wys_mm, 50, 1200),
      odstep_mm: liczbaLub(o.odstep_mm, d.odstep_mm, 0, 50), margines_mm: liczbaLub(o.margines_mm, d.margines_mm, 0, 50),
      kolumny: Math.round(liczbaLub(o.kolumny, 0, 0, 50)), wiersze: Math.round(liczbaLub(o.wiersze, 0, 0, 50)),
      ksztalt: zListy(o.ksztalt, ['prostokat', 'naklejka'], d.ksztalt), zaokraglenie_mm: liczbaLub(o.zaokraglenie_mm, d.zaokraglenie_mm, 0, 50),
    }),
    geometria: (projekt, sekcja, p) => geometriaArkusza(p),
  },
};

export const jestSpecjalna = (sekcja) => Boolean(sekcja?.specjalna && RODZAJE_SEKCJI[sekcja.specjalna.rodzaj]);

export function domyslnaSpecjalna(rodzaj) {
  const r = RODZAJE_SEKCJI[rodzaj];
  return r ? { rodzaj, ...structuredClone(r.domyslne), wynik: null } : null;
}

// Zapisany wynik (liczy go aplikacja): tylko z liczbowymi wymiarami i listami – inaczej przeliczy się od nowa.
function poprawnyWynik(w) {
  if (!w || typeof w !== 'object') return null;
  if (!Number.isFinite(w.szerokosc) || !Number.isFinite(w.wysokosc) || !Array.isArray(w.strefy)) return null;
  return w;
}

export function normalizujSpecjalna(s) {
  if (!s || typeof s !== 'object' || !RODZAJE_SEKCJI[s.rodzaj]) return null;
  const r = RODZAJE_SEKCJI[s.rodzaj];
  return { rodzaj: s.rodzaj, ...r.normalizuj(s, r.domyslne), wynik: poprawnyWynik(s.wynik) };
}

// Geometria sekcji specjalnej (null – rodzaj bez geometrii, np. kalendarz z datami).
export function geometriaSpecjalna(projekt, sekcja, ciag = null) {
  const p = normalizujSpecjalna(sekcja.specjalna);
  const r = p && RODZAJE_SEKCJI[p.rodzaj];
  if (!r?.geometria) return null;
  const g = r.geometria(projekt, sekcja, p, ciag || rozwin(projekt));
  const wynik = { rodzaj: p.rodzaj, bigi: [], perforacje: [], ciecie: [], naciecia: [], ...g };
  if (p.rodzaj === 'arkusz') wynik.uzytki = ukladUzytkow({ w: g.szerokosc + 2 * (sekcja.wydruk?.spad_mm || 0), h: g.wysokosc + 2 * (sekcja.wydruk?.spad_mm || 0) }, p, 0);
  return wynik;
}

// Geometria dla konkretnej strony sekcji (strefy i bigi z `strona` – tylko dla tej strony; ulotka: 0 zewnątrz, 1 środek).
export function wynikDlaStrony(wynik, indeks = 0) {
  if (!wynik) return null;
  const tu = (x) => x.strona === undefined || x.strona === indeks % 2;
  return { ...wynik, strefy: wynik.strefy.filter(tu), bigi: (wynik.bigi || []).filter(tu), indeks };
}

// Strefa, w której leży punkt (najmniejsza zawierająca), albo null.
export function strefaWPunkcie(wynik, x, y) {
  const trafione = (wynik?.strefy || []).filter((z) => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2);
  return trafione.sort((a, b) => (a.x2 - a.x1) * (a.y2 - a.y1) - (b.x2 - b.x1) * (b.y2 - b.y1))[0] || null;
}

// Czy punkt leży wewnątrz wielokąta (wykrojnik).
export function wKonturze(kontur, x, y) {
  let w = false;
  for (let i = 0, j = kontur.length - 1; i < kontur.length; j = i, i += 1) {
    const a = kontur[i]; const b = kontur[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) w = !w;
  }
  return w;
}

// Uwagi o elemencie na stronie sekcji specjalnej (prostokąt x1..x2, y1..y2 w mm):
// 'na_zgieciu' – tekst przecina linię zgięcia (big) albo perforację; 'poza_wykrojnikiem' – środek poza konturem.
export function uwagiElementu(wynik, r, { tekst = false } = {}) {
  const uwagi = [];
  if (!wynik) return uwagi;
  const tol = 0.5;
  if (tekst) {
    const linie = [...(wynik.bigi || []), ...(wynik.perforacje || [])];
    const przecina = linie.some((l) => (l.x1 === l.x2
      ? l.x1 > r.x1 + tol && l.x1 < r.x2 - tol && Math.max(r.y1, Math.min(l.y1, l.y2)) < Math.min(r.y2, Math.max(l.y1, l.y2))
      : l.y1 > r.y1 + tol && l.y1 < r.y2 - tol && Math.max(r.x1, Math.min(l.x1, l.x2)) < Math.min(r.x2, Math.max(l.x1, l.x2))));
    if (przecina) uwagi.push('na_zgieciu');
  }
  if (wynik.rodzaj === 'wykrojnik' && wynik.ciecie?.length) {
    const cx = (r.x1 + r.x2) / 2;
    const cy = (r.y1 + r.y2) / 2;
    if (!wynik.ciecie.some((k) => wKonturze(k, cx, cy))) uwagi.push('poza_wykrojnikiem');
  }
  return uwagi;
}

// ---------- Przeliczanie ----------

const takiSam = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b);

// Kalendarz z datami: tabela danych (utworzona przy pierwszym przeliczeniu, potem przepisywana dla nowego roku)
// i seria powielająca pierwszą stronę sekcji. Kolumny dopisane przez użytkownika zostają, a ich wartości
// przechodzą na wiersze o tej samej dacie.
function przeliczKalendarz(projekt, sekcja) {
  const p = sekcja.specjalna;
  const kolumny = KOLUMNY_KALENDARZA[p.jednostka];
  const wiersze = wierszeKalendarza(p);
  if (!Array.isArray(projekt.tabele)) projekt.tabele = [];
  if (!Array.isArray(projekt.serie)) projekt.serie = [];
  let tabela = projekt.tabele.find((t) => t.id === p.tabela);
  const nazwa = `Kalendarz ${p.rok}${p.jednostka === 'dzien' ? ' – dni' : p.jednostka === 'tydzien' ? ' – tygodnie' : ' – miesiące'}`;
  if (!tabela) {
    tabela = { id: uid('t'), nazwa, kolumny: [...kolumny], wiersze };
    projekt.tabele.push(tabela);
    p.tabela = tabela.id;
  } else {
    const dodatkowe = tabela.kolumny.filter((k) => !kolumny.includes(k));
    const stare = new Map(tabela.wiersze.map((w) => [w[tabela.kolumny.indexOf('data')], w]));
    const nowe = wiersze.map((w) => {
      const st = stare.get(w[0]);
      return [...w, ...dodatkowe.map((k) => (st ? st[tabela.kolumny.indexOf(k)] ?? '' : ''))];
    });
    const kol = [...kolumny, ...dodatkowe];
    if (JSON.stringify(kol) === JSON.stringify(tabela.kolumny) && JSON.stringify(nowe) === JSON.stringify(tabela.wiersze) && tabela.nazwa === nazwa) return false;
    Object.assign(tabela, { kolumny: kol, wiersze: nowe, nazwa });
  }
  let seria = projekt.serie.find((s) => s.id === p.seria);
  if (!seria) {
    seria = { id: uid('se'), nazwa: `Kalendarz ${p.rok}`, tabela: tabela.id, tryb: 'tabela', ile: wiersze.length, uklad: 'dlugi', dodatkowe: [], dopelnij: false, pilnuj_stron: false };
    projekt.serie.push(seria);
    p.seria = seria.id;
    const pierwsza = projekt.strony.find((s) => s.sekcja === sekcja.id);
    if (pierwsza && !pierwsza.seria) pierwsza.seria = seria.id;
  } else {
    seria.tabela = tabela.id;
    seria.nazwa = `Kalendarz ${p.rok}`;
  }
  return true;
}

// Ile stron potrzebuje rodzaj (ulotka: zewnątrz + środek); brakujące strony dochodzą, nadmiarowe zostają.
function dopelnijStrony(projekt, sekcja, stron) {
  const obecne = projekt.strony.filter((s) => s.sekcja === sekcja.id);
  if (obecne.length >= stron) return false;
  const nazwy = sekcja.specjalna.rodzaj === 'ulotka' ? ['Strona zewnętrzna', 'Strona wewnętrzna'] : sekcja.specjalna.rodzaj === 'wyklejka' ? ['Wyklejka – strona widoczna', 'Wyklejka – odwrotna strona'] : [];
  let po = obecne.length ? projekt.strony.indexOf(obecne[obecne.length - 1]) : projekt.strony.length - 1;
  for (let i = obecne.length; i < stron; i += 1) {
    const st = { id: uid('s'), nazwa: nazwy[i] || `Strona ${i + 1}`, sekcja: sekcja.id, wzorce: WZORCE_Z_SEKCJI, obiekty: [], tlo: null };
    projekt.strony.splice(po + 1, 0, st);
    po += 1;
  }
  return true;
}

// Strefy wyniku w postaci, którą rozumie przesuwanie elementów okładki (js/okladka.js) – po osi x, z górą i dołem.
// Dla stref ułożonych w poziomie (obwoluta, ulotka) elementy idą za swoją strefą jak na okładce.
function jakoOkladka(w) {
  if (!w?.strefy?.length) return null;
  const strefy = w.strefy.filter((z) => z.strona === undefined || z.strona === 0);
  const poziomo = strefy.every((z) => z.y1 <= 0.5 && z.y2 >= w.wysokosc - 0.5);
  if (!poziomo) return null;
  return { szerokosc: w.szerokosc, wysokosc: w.wysokosc, gora: 0, dol: w.wysokosc, strefy: strefy.map((z) => ({ rodzaj: z.rodzaj, x1: z.x1, x2: z.x2 })) };
}

// Przelicza sekcje specjalne projektu: format sekcji (szerokość, wysokość), wynik, liczba stron, dane kalendarza
// i położenie elementów (jak okładka – idą za swoją strefą). Zwraca id sekcji, które się zmieniły.
export function przeliczSpecjalne(projekt, ciag = null) {
  const zmienione = [];
  const sekcje = (projekt.sekcje || []).filter((s) => s.specjalna);
  if (!sekcje.length) return zmienione;
  let c = ciag;
  for (const sekcja of sekcje) {
    sekcja.specjalna = normalizujSpecjalna(sekcja.specjalna);
    if (!sekcja.specjalna) { delete sekcja.specjalna; continue; }
    delete sekcja.okladka;
    if (sekcja.specjalna.rodzaj === 'kalendarz') {
      if (przeliczKalendarz(projekt, sekcja)) { zmienione.push(sekcja.id); c = null; }
      continue;
    }
    c = c || rozwin(projekt);
    const nowy = geometriaSpecjalna(projekt, sekcja, c);
    if (!nowy) continue;
    const stary = sekcja.specjalna.wynik;
    const w = sekcja.wydruk;
    const dodane = dopelnijStrony(projekt, sekcja, nowy.stron);
    if (!dodane && takiSam(stary, nowy) && w.szerokosc_mm === nowy.szerokosc && w.wysokosc_mm === nowy.wysokosc) continue;
    // Elementy idą za strefą (obwoluta, ulotka); inne rodzaje – rozciągnięte tło i elementy bez przesunięć.
    const s = jakoOkladka(stary);
    const n = jakoOkladka(nowy);
    if (s && n && s.strefy.length === n.strefy.length) {
      for (const st of projekt.strony.filter((x) => x.sekcja === sekcja.id)) przesunElementy(st.obiekty, s, n, w.spad_mm || 0);
    }
    Object.assign(w, { szerokosc_mm: nowy.szerokosc, wysokosc_mm: nowy.wysokosc, format: 'wlasny' });
    sekcja.uklad = 'pojedyncze';
    sekcja.specjalna.wynik = nowy;
    zmienione.push(sekcja.id);
    c = null;
  }
  return zmienione;
}

// Okładka przelicza się przy każdej zmianie projektu (js/okladka.js przeliczOkladki) – sekcje specjalne razem z nią.
poPrzeliczeniu.add(przeliczSpecjalne);

// ---------- Opisy ----------

const mm = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// Jedno zdanie o wyniku – do okna sekcji i kontroli przed drukiem.
export function opisSpecjalnej(sekcja) {
  const p = sekcja?.specjalna;
  if (!p) return '';
  if (p.rodzaj === 'kalendarz') {
    const ile = wierszeKalendarza(p).length;
    return `Rok ${p.rok}: ${ile} ${p.jednostka === 'dzien' ? 'dni' : p.jednostka === 'tydzien' ? 'tygodni' : 'miesięcy'} w danych${p.swieta === 'pl' ? ', ze świętami' : ''}.`;
  }
  const w = p.wynik;
  if (!w) return '';
  const rozmiar = `${mm(w.szerokosc)} × ${mm(w.wysokosc)} mm`;
  if (p.rodzaj === 'obwoluta') return `Obwoluta ${rozmiar}: grzbiet ${mm(w.ksiazka.grzbiet)} mm, płyta ${mm(w.ksiazka.panel)} × ${mm(w.ksiazka.wysokosc)} mm${w.ksiazka.zOkladki ? ' (z okładki projektu)' : ` (liczona dla ${w.ksiazka.stron} stron środka)`}.`;
  if (p.rodzaj === 'ulotka') return `Arkusz ${rozmiar}, ${p.panele} panele${p.zlozenie === 'c' && p.panele > 2 ? ` (zwijana: panele ${w.panele.map(mm).join(' / ')} mm)` : ''}, strona zewnętrzna i wewnętrzna.`;
  if (p.rodzaj === 'trojdzielny') return `Kalendarz ${rozmiar}: główka ${mm(p.glowka_mm)} mm, 3 kalendaria po ${mm(p.kalendarium_mm)} mm${p.reklama_mm ? `, pasek reklamowy ${mm(p.reklama_mm)} mm` : ''}.`;
  if (p.rodzaj === 'wykrojnik') return `Rozkładówka ${rozmiar}; po złożeniu ${mm(w.zlozona.w)} × ${mm(w.zlozona.h)}${w.zlozona.g ? ` × ${mm(w.zlozona.g)}` : ''} mm. Wykrojnik w PDF jako osobny kolor „CutContour”.`;
  if (p.rodzaj === 'wyklejka') return `Wyklejka ${p.strona} ${rozmiar} (dwie kartki formatu bloku), papier ${p.gramatura} g/m²${p.zadruk === 'czysta' ? ', bez zadruku' : p.zadruk === 'dwustronny' ? ', zadruk dwustronny' : ''}. Bez numerów stron; luźna kartka liczy się do grzbietu.`;
  if (p.rodzaj === 'arkusz') {
    const u = w.uzytki;
    return `Użytek ${rozmiar}; na arkuszu ${mm(u.arkusz.w)} × ${mm(u.arkusz.h)} mm mieści się ${u.kolumny} × ${u.wiersze} = ${u.na_arkuszu}.`;
  }
  return rozmiar;
}

// Dodaje brakujące wyklejki (przednią za okładką, tylną na końcu) – po jednej stronie, czyste (do zadrukowania).
// Zwraca nowe sekcje. Format i wynik policzy przeliczenie (okladka.przeliczOkladki).
export function dodajWyklejki(projekt, { zadruk = 'czysta' } = {}) {
  const wyk = wyklejkiProjektu(projekt);
  const nowe = [];
  for (const strona of ['przednia', 'tylna']) {
    if (wyk[strona]) continue;
    const wzor = sekcjeBloku(projekt)[0]?.wydruk || projekt.sekcje[0]?.wydruk;
    const sekcja = {
      id: uid('sek'), nazwa: strona === 'przednia' ? 'Wyklejka przednia' : 'Wyklejka tylna',
      typ: `wyklejka_${strona}`,
      wydruk: JSON.parse(JSON.stringify(wzor)), uklad: 'pojedyncze', pierwsza: 'prawa', wzorce: [], numeracja: { tryb: 'brak', od: 1 },
      specjalna: { ...domyslnaSpecjalna('wyklejka'), strona, zadruk },
    };
    // Przednia: zaraz za okładką (albo na początku), tylna: na końcu.
    const okl = projekt.sekcje.findIndex((s) => typSekcji(s) === 'okladka');
    if (strona === 'przednia') projekt.sekcje.splice(okl + 1, 0, sekcja); else projekt.sekcje.push(sekcja);
    projekt.strony.push({ id: uid('s'), nazwa: sekcja.nazwa, sekcja: sekcja.id, wzorce: [], obiekty: [], tlo: null });
    nowe.push(sekcja);
  }
  if (nowe.length) uporzadkujStrony(projekt); // strony w kolejności sekcji
  return nowe;
}

// ---------- Kontrola przed drukiem ----------

// Prostokąt elementu zapisanego w projekcie (bez obrotu o kąty inne niż 90°) – do uwag przed drukiem.
function prostokatElementu(o) {
  const w = (o.width || 0) * Math.abs(o.scaleX ?? 1);
  const h = (o.height || 0) * Math.abs(o.scaleY ?? 1);
  const pion = Math.abs(Math.round((o.angle || 0) / 90)) % 2 === 1;
  const [sw, sh] = pion ? [h, w] : [w, h];
  const x = o.left || 0;
  const y = o.top || 0;
  return { x1: x, y1: y, x2: x + sw, y2: y + sh };
}

// Uwagi do sekcji specjalnych: [{ rodzaj: 'specjalna', idSekcji, opis, strony }].
export function uwagiSekcjiSpecjalnych(projekt, ciag) {
  const uwagi = [];
  // Role w książce (#177): twarda oprawa potrzebuje wyklejek; wyklejka bez twardej oprawy nie ma do czego się kleić.
  const twarda = (projekt.sekcje || []).find((s) => s.okladka?.oprawa === 'twarda');
  const wyk = wyklejkiProjektu(projekt);
  const ileWyklejek = (projekt.sekcje || []).filter((s) => rolaSekcji(projekt, s) === 'wyklejka');
  if (twarda && (!wyk.przednia || !wyk.tylna)) {
    const brak = [!wyk.przednia && 'przedniej', !wyk.tylna && 'tylnej'].filter(Boolean).join(' i ');
    uwagi.push({ rodzaj: 'specjalna', idSekcji: twarda.id, naprawa: 'wyklejki', opis: `Twarda oprawa bez wyklejki ${brak}. Wyklejka łączy blok z okładką – dodaj ją (może zostać czysta) albo potwierdź z drukarnią, że użyje własnej.` });
  }
  if (!twarda && ileWyklejek.length) uwagi.push({ rodzaj: 'specjalna', idSekcji: ileWyklejek[0].id, opis: 'Projekt ma wyklejkę, a nie ma okładki twardej – wyklejki są tylko w twardej oprawie. Zmień oprawę okładki albo usuń wyklejkę.' });
  for (const strona of ['przednia', 'tylna']) {
    const lista = ileWyklejek.filter((s) => typSekcji(s) === `wyklejka_${strona}`);
    if (lista.length > 1) uwagi.push({ rodzaj: 'specjalna', idSekcji: lista[1].id, opis: `Projekt ma ${lista.length} wyklejki ${strona === 'przednia' ? 'przednie' : 'tylne'} – książka ma jedną przednią i jedną tylną.` });
  }
  for (const sekcja of projekt.sekcje || []) {
    const p = sekcja.specjalna;
    if (!p?.wynik) continue;
    const w = p.wynik;
    const egz = (ciag?.egzemplarze || []).filter((e) => e.sekcja?.id === sekcja.id && !e.pusta);
    if (p.rodzaj === 'ulotka' && egz.length > 2) uwagi.push({ rodzaj: 'specjalna', idSekcji: sekcja.id, opis: `Ulotka „${sekcja.nazwa}” ma ${egz.length} stron – drukuje się arkusz z dwiema stronami (zewnątrz i środek). Nadmiarowe strony usuń albo przenieś do innej sekcji.` });
    if (p.rodzaj === 'obwoluta' && !w.ksiazka?.zOkladki) uwagi.push({ rodzaj: 'specjalna', idSekcji: sekcja.id, opis: `Obwoluta „${sekcja.nazwa}” jest liczona dla twardej oprawy ${w.ksiazka?.stron ?? 0} stron środka – projekt nie ma okładki twardej. Sprawdź grzbiet z drukarnią.` });
    if (p.rodzaj === 'arkusz' && !w.uzytki?.na_arkuszu) uwagi.push({ rodzaj: 'specjalna', idSekcji: sekcja.id, opis: `Użytek „${sekcja.nazwa}” nie mieści się na wybranym arkuszu – wybierz większy arkusz albo mniejszy użytek.` });
    const naZgieciu = [];
    const poza = [];
    egz.forEach((e, i) => {
      const nr = (e.indeks ?? i) + 1;
      const wynikStrony = wynikDlaStrony(w, i);
      for (const o of e.strona.obiekty || []) {
        if (!o || o.visible === false) continue;
        const u = uwagiElementu(wynikStrony, prostokatElementu(o), { tekst: o.type === 'textbox' });
        if (u.includes('na_zgieciu')) naZgieciu.push(nr);
        if (u.includes('poza_wykrojnikiem')) poza.push(nr);
      }
    });
    const numery = (l) => [...new Set(l)].sort((a, b) => a - b);
    if (naZgieciu.length) uwagi.push({ rodzaj: 'specjalna', idSekcji: sekcja.id, strony: numery(naZgieciu), opis: `„${sekcja.nazwa}”: tekst leży na zgięciu albo perforacji – po złożeniu zostanie przełamany.` });
    if (poza.length) uwagi.push({ rodzaj: 'specjalna', idSekcji: sekcja.id, strony: numery(poza), opis: `„${sekcja.nazwa}”: element leży poza linią wykrojnika – zostanie wycięty.` });
  }
  return uwagi;
}
