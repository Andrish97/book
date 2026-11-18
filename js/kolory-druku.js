/* global fabric */
// Kolory do druku (decyzja #127): kolory dodatkowe (spot, np. Pantone), uszlachetnienia (lakier UV,
// folia, tłoczenie, biały poddruk) i tryb kolorów projektu (pełny kolor, skala szarości, czerń + 1 kolor).
//
// Kolor dodatkowy w elemencie to zwykły kolor (zapas: jego CMYK przeliczony na ekran, w danym odcieniu).
// Rejestr projektu (mapaSpotow) zna dokładnie te kolory – PDF wektorowy zamienia je na osobną płytę
// (Separation), więc wypełnienie, obrys, tekst i fragment tekstu działają bez osobnych pól w elemencie.
//
// Uszlachetnienie to cecha elementu (pole `uszlachetnienie`, przy folii także `folia`): element drukuje
// się tylko na płycie uszlachetnienia, z nadrukiem (nie wybija farby pod spodem). W edytorze i podglądzie
// widać efekt (połysk, metal, tłoczenie, biel na szachownicy) – przełącznik „Pokaż uszlachetnienia”.

// ---------- Uszlachetnienia ----------

export const USZLACHETNIENIA = [
  { id: 'uv', nazwa: 'Lakier UV wybiórczy', plyta: 'Spot_UV', alt: [0.5, 0, 0, 0] },
  { id: 'folia', nazwa: 'Złocenie (folia)' },
  { id: 'tloczenie', nazwa: 'Tłoczenie (wypukłe)', plyta: 'Emboss', alt: [0, 0.5, 0, 0] },
  { id: 'wytloczenie', nazwa: 'Wytłoczenie (wklęsłe)', plyta: 'Debossing', alt: [0, 0.5, 0.5, 0] },
  { id: 'bialy', nazwa: 'Biały poddruk', plyta: 'White', alt: [0.15, 0, 0, 0] },
  // Linie wykrojnika (#218) – płyty techniczne dla introligatorni i plotera (nazwy płyt jak w programach do cięcia:
  // CutContour rozpoznaje większość ploterów print & cut). Element rysuje kształt cięcia / zgięcia / perforacji /
  // miejsca klejenia; w edytorze zawsze widać go w kolorze linii, w druku nie zostawia farby.
  { id: 'ciecie', nazwa: 'Linia cięcia (wykrojnik)', plyta: 'CutContour', alt: [0, 1, 0, 0], techniczna: true, kolor: '#e0004d', kreska: [] },
  { id: 'big', nazwa: 'Big – linia zgięcia', plyta: 'Crease', alt: [1, 0, 0, 0], techniczna: true, kolor: '#0077d6', kreska: [3, 2] },
  { id: 'perforacja', nazwa: 'Perforacja', plyta: 'Perforation', alt: [0, 0, 1, 0], techniczna: true, kolor: '#c77700', kreska: [0.6, 1] },
  { id: 'klej', nazwa: 'Miejsce klejenia', plyta: 'Glue', alt: [0.5, 0, 1, 0], techniczna: true, kolor: '#14a35a', kreska: [] },
];
export const LINIE_WYKROJNIKA = USZLACHETNIENIA.filter((u) => u.techniczna);
export const FOLIE = {
  zloto: { nazwa: 'Złoto', plyta: 'Foil_Gold', alt: [0, 0.2, 0.7, 0.15], kolory: ['#8a6a1f', '#f6e27a', '#b8892b', '#fff3b0', '#8a6a1f'] },
  srebro: { nazwa: 'Srebro', plyta: 'Foil_Silver', alt: [0, 0, 0, 0.35], kolory: ['#7d8287', '#f4f6f8', '#a3a8ad', '#ffffff', '#7d8287'] },
  miedz: { nazwa: 'Miedź', plyta: 'Foil_Copper', alt: [0, 0.55, 0.75, 0.2], kolory: ['#7a3b1c', '#f0a878', '#b0623a', '#ffd2b0', '#7a3b1c'] },
};

// Płyta uszlachetnienia elementu: { id, plyta, alt, etykieta } albo null.
export function plytaUszlachetnienia(o) {
  const id = o?.uszlachetnienie;
  if (!id) return null;
  if (id === 'folia') {
    const f = FOLIE[o.folia] || FOLIE.zloto;
    return { id, folia: FOLIE[o.folia] ? o.folia : 'zloto', plyta: f.plyta, alt: f.alt, etykieta: `Złocenie – ${f.nazwa.toLowerCase()}` };
  }
  const u = USZLACHETNIENIA.find((x) => x.id === id);
  return u ? { id, plyta: u.plyta, alt: u.alt, etykieta: u.nazwa, ...(u.techniczna ? { techniczna: true, kolor: u.kolor, kreska: u.kreska } : {}) } : null;
}

// ---------- Kolory dodatkowe i tryb kolorów ----------

export const TRYBY_KOLOROW = [
  { id: 'pelny', nazwa: 'Pełny kolor (CMYK)' },
  { id: 'szarosc', nazwa: 'Skala szarości' },
  { id: 'czb1', nazwa: 'Czarno-biały + 1 kolor dodatkowy' },
];

const ogranicz = (v, a, b) => Math.min(b, Math.max(a, v));
const liczba = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
export const rgbNaHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(ogranicz(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
const hexNaRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// CMYK w procentach (0–100) → kolor ekranu. Prosty wzór – tylko podgląd; drukarnia dostaje płytę z nazwą.
export function cmykNaRgb([c, m, y, k]) {
  const f = (v) => 1 - ogranicz(v, 0, 100) / 100;
  return [255 * f(c) * f(k), 255 * f(m) * f(k), 255 * f(y) * f(k)];
}
// Kolor dodatkowy w odcieniu t (0–1) na ekranie: zapas CMYK pomnożony przez odcień.
export function hexSpotu(spot, t = 1) {
  return rgbNaHex(...cmykNaRgb(spot.cmyk.map((v) => v * ogranicz(t, 0, 1))));
}

export function normalizujKoloryDruku(p) {
  const widziane = new Set();
  p.kolory_dodatkowe = (Array.isArray(p.kolory_dodatkowe) ? p.kolory_dodatkowe : [])
    .filter((s) => s && typeof s === 'object')
    .map((s, i) => ({
      id: typeof s.id === 'string' && s.id ? s.id : `kd${Date.now().toString(36)}${i}`,
      nazwa: String(s.nazwa || `Kolor dodatkowy ${i + 1}`).trim().slice(0, 60) || `Kolor dodatkowy ${i + 1}`,
      cmyk: [0, 1, 2, 3].map((j) => Math.round(ogranicz(liczba(s.cmyk?.[j]), 0, 100) * 10) / 10),
    }))
    .filter((s) => !widziane.has(s.id) && widziane.add(s.id));
  p.tryb_kolorow = TRYBY_KOLOROW.some((t) => t.id === p.tryb_kolorow) ? p.tryb_kolorow : 'pelny';
  if (!p.kolory_dodatkowe.some((s) => s.id === p.kolor_trybu)) p.kolor_trybu = p.kolory_dodatkowe[0]?.id || null;
  if (!p.kolory_dodatkowe.length) delete p.kolory_dodatkowe;
  if (p.tryb_kolorow === 'pelny') { delete p.tryb_kolorow; delete p.kolor_trybu; }
  return p;
}

// Tryb kolorów sekcji (#167): np. okładka w pełnym kolorze, środek w skali szarości. Brak pola = jak w projekcie.
// Wywoływane po znormalizowaniu sekcji (js/projekt.js).
export function normalizujTrybySekcji(p) {
  const spoty = koloryDodatkowe(p);
  for (const sek of Array.isArray(p.sekcje) ? p.sekcje : []) {
    if (!TRYBY_KOLOROW.some((t) => t.id === sek.tryb_kolorow)) { delete sek.tryb_kolorow; delete sek.kolor_trybu; continue; }
    if (sek.tryb_kolorow !== 'czb1') delete sek.kolor_trybu;
    else if (!spoty.some((x) => x.id === sek.kolor_trybu)) sek.kolor_trybu = spoty[0]?.id || null;
  }
  return p;
}

export const koloryDodatkowe = (projekt) => projekt?.kolory_dodatkowe || [];
// Sekcja: obiekt sekcji albo jej id. Tryb sekcji ma pierwszeństwo przed trybem projektu (#167).
const sekcjaZ = (projekt, sekcja) => (typeof sekcja === 'string' ? (projekt?.sekcje || []).find((s) => s.id === sekcja) : sekcja) || null;
export const trybSekcjiWlasny = (projekt, sekcja) => sekcjaZ(projekt, sekcja)?.tryb_kolorow || null;
// tryb_wymuszony (tylko w pamięci, np. „Drukuj w domu” w odcieniach szarości) – dla wszystkich sekcji.
export function trybKolorow(projekt, sekcja = null) {
  return projekt?.tryb_wymuszony || trybSekcjiWlasny(projekt, sekcja) || projekt?.tryb_kolorow || 'pelny';
}
export function spotTrybu(projekt, sekcja = null) {
  if (trybKolorow(projekt, sekcja) !== 'czb1') return null;
  const s = sekcjaZ(projekt, sekcja);
  const id = s?.tryb_kolorow && !projekt.tryb_wymuszony ? s.kolor_trybu : projekt.kolor_trybu;
  return koloryDodatkowe(projekt).find((x) => x.id === id) || null;
}
// Czy któraś sekcja ma własny tryb kolorów.
export const trybyWSekcjach = (projekt) => !projekt?.tryb_wymuszony && (projekt?.sekcje || []).some((s) => s.tryb_kolorow);

// Spoty, które w danym trybie idą na osobne płyty: pełny kolor – wszystkie, cz/b + 1 – tylko kolor trybu.
// Bez sekcji – dla całego projektu: suma po sekcjach (każda w swoim trybie).
export function spotyDruku(projekt, sekcja) {
  if (sekcja === undefined && trybyWSekcjach(projekt)) {
    const ids = new Set();
    for (const s of projekt.sekcje) for (const x of spotyDruku(projekt, s)) ids.add(x.id);
    return koloryDodatkowe(projekt).filter((x) => ids.has(x.id));
  }
  const tryb = trybKolorow(projekt, sekcja || null);
  if (tryb === 'szarosc') return [];
  if (tryb === 'czb1') { const sp = spotTrybu(projekt, sekcja || null); return sp ? [sp] : []; }
  return koloryDodatkowe(projekt);
}
// Sekcja bieżącej strony w edytorze (wybór koloru, Właściwości) – albo null (wzorzec, brak edytora).
export function sekcjaBiezaca(projekt = globalThis.seriodruk?.stan?.projekt) {
  const st = globalThis.seriodruk?.stan;
  if (!projekt || !st || st.tryb !== 'strona') return null;
  const id = projekt.strony?.[st.indeks]?.sekcja;
  return (projekt.sekcje || []).find((s) => s.id === id) || null;
}

// Rejestr: kolor ekranu (#rrggbb) → { id, nazwa, cmyk (0–1), t (0–1) } dla odcieni 1–100%.
// Pełny odcień ma pierwszeństwo, gdy dwa odcienie dają ten sam kolor ekranu.
export function mapaSpotow(spoty) {
  const mapa = new Map();
  for (const s of spoty) {
    for (let t = 100; t >= 1; t -= 1) {
      const hex = hexSpotu(s, t / 100);
      if (!mapa.has(hex)) mapa.set(hex, { id: s.id, nazwa: s.nazwa, cmyk: s.cmyk.map((v) => v / 100), t: t / 100 });
    }
  }
  return mapa;
}

// Dowolny zapis koloru (#rgb, #rrggbb, rgb(), rgba()) → [r, g, b, a] albo null.
export function rozbierzKolor(k) {
  if (typeof k !== 'string') return null;
  const s = k.trim().toLowerCase();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((z) => z + z).join('') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4])];
  if (s === 'white') return [255, 255, 255, 1];
  if (s === 'black') return [0, 0, 0, 1];
  return null;
}

const jasnosc = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const szary = (k) => { const l = Math.round(jasnosc(k)); return rgbNaHex(l, l, l); };
const odleglosc = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const zKryciem = (hex, a) => (a < 1 ? `rgba(${hexNaRgb(hex).join(',')},${Math.round(a * 1000) / 1000})` : hex);

// Czy kolor pasuje do trybu kolorów projektu (albo sekcji, #167). Przezroczysty zawsze pasuje.
export function kolorDozwolony(kolor, projekt, mapa = null, sekcja = null) {
  const tryb = trybKolorow(projekt, sekcja);
  if (tryb === 'pelny') return true;
  const k = rozbierzKolor(kolor);
  if (!k || k[3] === 0) return true;
  if (Math.max(k[0], k[1], k[2]) - Math.min(k[0], k[1], k[2]) <= 1) return true; // szarości = sama czerń
  if (tryb === 'szarosc') return false;
  const m = mapa || mapaSpotow(spotyDruku(projekt, sekcja));
  return m.has(rgbNaHex(k[0], k[1], k[2]));
}

// Najbliższy kolor dozwolony w trybie (projektu albo sekcji): szarość o tej samej jasności albo odcień koloru trybu.
export function najblizszyDozwolony(kolor, projekt, sekcja = null) {
  const k = rozbierzKolor(kolor);
  if (!k) return kolor;
  const sz = szary(k);
  const spot = spotTrybu(projekt, sekcja);
  if (trybKolorow(projekt, sekcja) !== 'czb1' || !spot) return zKryciem(sz, k[3]);
  let najlepszy = sz; let d = odleglosc(k, hexNaRgb(sz));
  for (let t = 1; t <= 100; t += 1) {
    const h = hexSpotu(spot, t / 100);
    const dd = odleglosc(k, hexNaRgb(h));
    if (dd < d) { d = dd; najlepszy = h; }
  }
  return zKryciem(najlepszy, k[3]);
}

// Wszystkie miejsca z kolorem w projekcie: strony, wzorce (elementy, tła, przejścia, fragmenty tekstu), style.
const POLA_KOLORU = /^(fill|stroke|tlo|color|backgroundColor|textBackgroundColor|kolor|obrys_liter)$/;
function przejdzKolory(wartosc, fn, klucz = '') {
  if (Array.isArray(wartosc)) { for (let i = 0; i < wartosc.length; i += 1) { const w = przejdzKolory(wartosc[i], fn); if (w !== undefined) wartosc[i] = w; } return undefined; }
  if (wartosc && typeof wartosc === 'object') {
    for (const k of Object.keys(wartosc)) {
      const w = przejdzKolory(wartosc[k], fn, k);
      if (w !== undefined) wartosc[k] = w;
    }
    return undefined;
  }
  if (typeof wartosc === 'string' && POLA_KOLORU.test(klucz) && rozbierzKolor(wartosc)) {
    const nowy = fn(wartosc);
    return nowy !== wartosc ? nowy : undefined;
  }
  return undefined;
}
const zrodlaKolorow = (projekt) => [...(projekt.strony || []), ...(projekt.wzorce || []), ...(projekt.style || [])];
// Źródła kolorów razem z sekcją, której tryb obowiązuje: strony – swoja sekcja; wzorce i style – tryb projektu.
const zrodlaZSekcja = (projekt) => [
  ...(projekt.strony || []).map((z) => [z, (projekt.sekcje || []).find((s) => s.id === z.sekcja) || null]),
  ...[...(projekt.wzorce || []), ...(projekt.style || [])].map((z) => [z, null]),
];

// Zmienia kolory w całym projekcie (fn: kolor, sekcja → nowy kolor). Zwraca liczbę zmian.
export function przekolorujProjekt(projekt, fn) {
  let ile = 0;
  for (const [z, sek] of zrodlaZSekcja(projekt)) przejdzKolory(z, (k) => { const n = fn(k, sek); if (n !== k) ile += 1; return n; });
  return ile;
}

// Zakres kolorów (#167): 'projekt' – strony, wzorce i style; id sekcji – tylko strony tej sekcji.
function zrodlaZakresu(projekt, zakres) {
  if (!zakres || zakres === 'projekt') return zrodlaKolorow(projekt);
  return (projekt.strony || []).filter((s) => s.sekcja === zakres);
}
// Kolory użyte w zakresie: [{ kolor (#rrggbb), ile }], najczęstsze najpierw (bez przezroczystych).
export function koloryWZakresie(projekt, zakres = 'projekt') {
  const licz = new Map();
  for (const z of zrodlaZakresu(projekt, zakres)) {
    przejdzKolory(z, (k) => {
      const r = rozbierzKolor(k);
      if (r && r[3] > 0) { const h = rgbNaHex(r[0], r[1], r[2]); licz.set(h, (licz.get(h) || 0) + 1); }
      return k;
    });
  }
  return [...licz].sort((a, b) => b[1] - a[1]).map(([kolor, ile]) => ({ kolor, ile }));
}
// Zamienia kolor na inny w zakresie – krycie każdego miejsca zostaje. Zwraca liczbę zmian.
export function zamienKolorWZakresie(projekt, zakres, stary, nowy) {
  const s = rozbierzKolor(stary);
  const n = rozbierzKolor(nowy);
  if (!s || !n) return 0;
  const cel = rgbNaHex(s[0], s[1], s[2]);
  const nowyHex = rgbNaHex(n[0], n[1], n[2]);
  if (cel === nowyHex) return 0;
  let ile = 0;
  for (const z of zrodlaZakresu(projekt, zakres)) {
    przejdzKolory(z, (k) => {
      const r = rozbierzKolor(k);
      if (!r || rgbNaHex(r[0], r[1], r[2]) !== cel) return k;
      ile += 1;
      return zKryciem(nowyHex, r[3]);
    });
  }
  return ile;
}

// Kolory projektu niepasujące do trybu: [kolor] (bez powtórzeń). Strona – w trybie swojej sekcji.
export function koloryPozaTrybem(projekt) {
  const zle = new Set();
  const mapy = new Map();
  for (const [z, sek] of zrodlaZSekcja(projekt)) {
    if (trybKolorow(projekt, sek) === 'pelny') continue;
    const klucz = sek?.tryb_kolorow ? sek.id : '';
    if (!mapy.has(klucz)) mapy.set(klucz, mapaSpotow(spotyDruku(projekt, sek)));
    przejdzKolory(z, (k) => { if (!kolorDozwolony(k, projekt, mapy.get(klucz), sek)) zle.add(k); return k; });
  }
  return [...zle];
}

// Prosty CMYK (0–100) z koloru ekranu – zapas nowego koloru dodatkowego tworzonego z wybranego koloru.
export function rgbNaCmyk(kolor) {
  const r = rozbierzKolor(kolor) || [0, 0, 0, 1];
  const [rr, gg, bb] = r.slice(0, 3).map((v) => v / 255);
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1) return [0, 0, 0, 100];
  return [(1 - rr - k) / (1 - k), (1 - gg - k) / (1 - k), (1 - bb - k) / (1 - k), k].map((v) => Math.round(v * 1000) / 10);
}
// Dodaje kolor dodatkowy do projektu – pierwsze użycie tworzy go od razu, bez osobnego okna (#167).
export function dodajKolorDodatkowy(projekt, { nazwa, cmyk } = {}) {
  const n = koloryDodatkowe(projekt).length + 1;
  const spot = {
    id: `kd${Date.now().toString(36)}${n}`,
    nazwa: String(nazwa || '').trim().slice(0, 60) || `PANTONE kolor ${n}`,
    cmyk: (cmyk || [0, 100, 81, 4]).map((v) => Math.round(ogranicz(liczba(v), 0, 100) * 10) / 10),
  };
  projekt.kolory_dodatkowe = [...koloryDodatkowe(projekt), spot];
  if (projekt.tryb_kolorow === 'czb1' && !projekt.kolor_trybu) projekt.kolor_trybu = spot.id;
  return spot;
}

// Zmiana zapasu CMYK koloru dodatkowego: elementy w tym kolorze (w każdym odcieniu) dostają nowy zapas.
export function zmienZapasSpotu(projekt, spot, nowyCmyk) {
  const stara = mapaSpotow([spot]);
  const nowy = { ...spot, cmyk: nowyCmyk };
  spot.cmyk = nowyCmyk;
  return przekolorujProjekt(projekt, (k) => {
    const r = rozbierzKolor(k);
    const w = r && stara.get(rgbNaHex(r[0], r[1], r[2]));
    return w ? zKryciem(hexSpotu(nowy, w.t), r[3]) : k;
  });
}

// Co z kolorów do druku jest w projekcie: { spoty: [{ nazwa, ile }], uszlachetnienia: [{ etykieta, plyta, ile }] }.
export function uzyteKoloryDruku(projekt) {
  const mapa = mapaSpotow(spotyDruku(projekt));
  const spoty = new Map();
  const uszl = new Map();
  for (const z of zrodlaKolorow(projekt)) {
    przejdzKolory(z, (k) => { const r = rozbierzKolor(k); const s = r && mapa.get(rgbNaHex(r[0], r[1], r[2])); if (s) spoty.set(s.nazwa, (spoty.get(s.nazwa) || 0) + 1); return k; });
  }
  const przejdz = (obiekty) => {
    for (const o of obiekty || []) {
      const u = plytaUszlachetnienia(o);
      if (u) { const w = uszl.get(u.plyta) || { etykieta: u.etykieta, plyta: u.plyta, ile: 0 }; w.ile += 1; uszl.set(u.plyta, w); }
      przejdz(o.objects);
    }
  };
  for (const s of [...(projekt.strony || []), ...(projekt.wzorce || [])]) przejdz(s.obiekty);
  return { spoty: [...spoty].map(([nazwa, ile]) => ({ nazwa, ile })), uszlachetnienia: [...uszl.values()] };
}

// Uwagi przed drukiem o kolorach do druku: [{ rodzaj, opis, strony, idStrony?, idObiektu?, naprawa? }].
// numerStrony(id) → numer pierwszej strony wydruku z tą stroną (albo null).
export function uwagiKolorowDruku(projekt, { numerStrony = () => null } = {}) {
  const uwagi = [];
  const { spoty, uszlachetnienia } = uzyteKoloryDruku(projekt);
  if (spoty.length) uwagi.push({ rodzaj: 'kolory_dodatkowe', strony: [], opis: `Kolory dodatkowe w projekcie (osobne płyty w PDF wektorowym): ${spoty.map((s) => `„${s.nazwa}”`).join(', ')}. Potwierdź je z drukarnią.` });
  if (uszlachetnienia.length) uwagi.push({ rodzaj: 'uszlachetnienia', strony: [], opis: `Uszlachetnienia w projekcie: ${uszlachetnienia.map((u) => `${u.etykieta} (płyta ${u.plyta}, ${u.ile} ${u.ile === 1 ? 'element' : 'elem.'})`).join(', ')}. Każde idzie na osobną płytę z nadrukiem.` });
  const zle = koloryPozaTrybem(projekt);
  if (zle.length) {
    const tryb = trybyWSekcjach(projekt) ? 'Tryb kolorów sekcji' : `Tryb „${TRYBY_KOLOROW.find((t) => t.id === trybKolorow(projekt)).nazwa}”`;
    uwagi.push({ rodzaj: 'kolor_spoza_trybu', strony: [], naprawa: 'kolory_trybu', opis: `${tryb}: ${zle.length} ${zle.length === 1 ? 'kolor nie pasuje' : 'kolorów nie pasuje'} do trybu (np. ${zle.slice(0, 3).join(', ')}). W PDF pójdą jako odcienie czerni – albo zamień je na najbliższe dozwolone.` });
  }
  for (const sek of [null, ...(projekt.sekcje || []).filter((s) => s.tryb_kolorow)]) {
    if (trybKolorow(projekt, sek) === 'czb1' && !spotTrybu(projekt, sek)) uwagi.push({ rodzaj: 'kolor_spoza_trybu', strony: [], opis: `Tryb „Czarno-biały + 1 kolor dodatkowy”${sek ? ` w sekcji „${sek.nazwa}”` : ''} nie ma wybranego koloru – dodaj kolor dodatkowy w oknie „Kolory projektu”.` });
  }
  // Uszlachetnienie za drobne albo przy krawędzi bez spadu.
  const MIN_LINIA = 0.3; const MIN_TEKST = (6 * 25.4) / 72;
  for (const strona of projekt.strony || []) {
    const sekcja = (projekt.sekcje || []).find((s) => s.id === strona.sekcja);
    const w = sekcja?.wydruk;
    const sprawdz = (obiekty) => {
      for (const o of obiekty || []) {
        const u = plytaUszlachetnienia(o);
        if (u) {
          const sx = Math.abs(o.scaleX || 1);
          const nr = numerStrony(strona.id);
          const gdzie = { strony: nr ? [nr] : [], idStrony: strona.id, idObiektu: o.id };
          const rozmiar = (o.fontSize || 0) * sx;
          if (/text|textbox/.test(o.type) && rozmiar && rozmiar < MIN_TEKST) uwagi.push({ rodzaj: 'uszl_drobne', ...gdzie, opis: `${u.etykieta} na tekście mniejszym niż 6 pt (strona „${strona.nazwa}”) – drukarnia może go nie odwzorować.` });
          else if (o.stroke && !o.fill && (o.strokeWidth || 0) * sx < MIN_LINIA) uwagi.push({ rodzaj: 'uszl_drobne', ...gdzie, opis: `${u.etykieta} na linii cieńszej niż 0,3 mm (strona „${strona.nazwa}”) – drukarnia może jej nie odwzorować.` });
          if (w) {
            const x0 = o.left ?? 0; const y0 = o.top ?? 0;
            const x1 = x0 + (o.width || 0) * sx; const y1 = y0 + (o.height || 0) * Math.abs(o.scaleY || 1);
            const dotyka = x0 <= 0.01 || y0 <= 0.01 || x1 >= w.szerokosc_mm - 0.01 || y1 >= w.wysokosc_mm - 0.01;
            const wSpad = x0 < -0.5 || y0 < -0.5 || x1 > w.szerokosc_mm + 0.5 || y1 > w.wysokosc_mm + 0.5;
            if (dotyka && !wSpad && !o.angle) uwagi.push({ rodzaj: 'uszl_krawedz', ...gdzie, opis: `${u.etykieta} kończy się na krawędzi strony bez spadu (strona „${strona.nazwa}”) – po obcięciu może zostać biały pasek. Przeciągnij element w spad albo odsuń od krawędzi.` });
          }
        }
        sprawdz(o.objects);
      }
    };
    sprawdz(strona.obiekty);
  }
  return uwagi;
}

// ---------- Rysowanie: efekt w edytorze i podglądzie, płyty w PDF ----------

const KLUCZ_POKAZ = 'makietka:pokaz-uszlachetnienia';
// pokaz – efekt widać w edytorze i podglądzie; eksport – pliku z obrazów stron nie dostają uszlachetnień
// (to nie farba); surowo – element rysowany bez efektu (maska uszlachetnienia w PDF).
// maska – nazwa płyty: rysują się tylko elementy tej płyty, bez efektu (podgląd separacji, #131C).
export const stanUszlachetnien = { pokaz: true, eksport: false, surowo: false, maska: null };
try { stanUszlachetnien.pokaz = localStorage.getItem(KLUCZ_POKAZ) !== '0'; } catch { /* bez pamięci – domyślnie widać */ }
export function ustawPokazUszlachetnien(tak) {
  stanUszlachetnien.pokaz = Boolean(tak);
  try { localStorage.setItem(KLUCZ_POKAZ, tak ? '1' : '0'); } catch { /* trudno */ }
}

let szachownica = null;
function wzorBieli() {
  if (!szachownica) {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 8, 8);
    x.fillStyle = '#d9dde3'; x.fillRect(0, 0, 4, 4); x.fillRect(4, 4, 4, 4);
    szachownica = c;
  }
  // Kwadraty ok. 1 mm (płótno edytora liczy w milimetrach).
  return new fabric.Pattern({ source: szachownica, repeat: 'repeat', patternTransform: [0.25, 0, 0, 0.25, 0, 0] });
}

function farbaEfektu(u, o) {
  if (u.id === 'folia') {
    const kolory = FOLIE[u.folia].kolory;
    return new fabric.Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 1, y2: 1 }, colorStops: kolory.map((color, i) => ({ offset: i / (kolory.length - 1), color })) });
  }
  if (u.id === 'uv') {
    return new fabric.Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 1, y2: 1 }, colorStops: [
      { offset: 0, color: 'rgba(170,215,255,0.55)' }, { offset: 0.45, color: 'rgba(255,255,255,0.85)' }, { offset: 1, color: 'rgba(150,200,245,0.55)' }] });
  }
  if (u.id === 'bialy') return wzorBieli();
  return o.fill && typeof o.fill === 'string' ? 'rgba(255,255,255,0.28)' : o.fill; // tłoczenie: bez farby, sam relief
}

function rysujZEfektem(o, ctx, render, u) {
  const obraz = o.type === 'image' || (o.zasob && !o.fill);
  const stare = { fill: o.fill, stroke: o.stroke, shadow: o.shadow };
  const farba = farbaEfektu(u, o);
  const relief = u.id === 'tloczenie' || u.id === 'wytloczenie';
  const znak = u.id === 'wytloczenie' ? -1 : 1;
  try {
    if (!obraz) {
      if (o.fill) o.fill = farba;
      if (o.stroke) o.stroke = typeof farba === 'string' ? 'rgba(90,90,90,0.55)' : farba;
    }
    if (relief) o.shadow = new fabric.Shadow({ color: znak > 0 ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.9)', blur: 0.6, offsetX: 0.35, offsetY: 0.35 });
    o.dirty = true;
    render.call(o, ctx);
    if (obraz || (relief && znak < 0)) {
      // Obraz (albo drugi brzeg wytłoczenia): nakładka na całym elemencie.
      ctx.save();
      o.transform(ctx);
      const w = o.width || 0; const h = o.height || 0;
      if (relief) { ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.3; ctx.strokeRect(-w / 2 + 0.15, -h / 2 + 0.15, w, h); }
      else {
        ctx.globalAlpha *= u.id === 'bialy' ? 0.85 : 0.6;
        const f = farba instanceof fabric.Gradient ? (() => { const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); farba.colorStops.forEach((s) => g.addColorStop(s.offset, s.color)); return g; })() : (farba?.toLive ? farba.toLive(ctx) : farba);
        ctx.fillStyle = f || 'rgba(255,255,255,0.5)';
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      ctx.restore();
    }
  } finally {
    Object.assign(o, stare);
    o.dirty = true;
  }
}

// Linia wykrojnika (#218) w edytorze i podglądzie: kontur w kolorze rodzaju linii (cięcie – czerwona ciągła, big –
// niebieska kreskowana, perforacja – kropkowana), miejsce klejenia – zielone, półprzezroczyste pole. Bez farby elementu.
function rysujLinieWykrojnika(o, ctx, render, u) {
  const stare = { fill: o.fill, stroke: o.stroke, strokeWidth: o.strokeWidth, strokeDashArray: o.strokeDashArray, strokeUniform: o.strokeUniform, shadow: o.shadow, opacity: o.opacity };
  try {
    if (!o._objects) {
      Object.assign(o, {
        fill: u.id === 'klej' ? 'rgba(20,163,90,0.22)' : null, stroke: u.kolor, strokeWidth: 0.35, strokeUniform: true,
        strokeDashArray: u.kreska?.length ? u.kreska : null, shadow: null, opacity: 1,
      });
      o.dirty = true;
    }
    return render.call(o, ctx);
  } finally {
    if (!o._objects) { Object.assign(o, stare); o.dirty = true; }
  }
}

// Wywołuje js/fabric-ustawienia.js, gdy Fabric jest już wczytany (ten moduł bywa wczytany wcześniej, z projekt.js).
export function zainstalujUszlachetnienia() {
  if (typeof fabric === 'undefined' || fabric.FabricObject.prototype._uszlachetnienia) return;
  const render = fabric.FabricObject.prototype.render;
  fabric.FabricObject.prototype._uszlachetnienia = true;
  fabric.FabricObject.prototype.render = function renderZUszlachetnieniem(ctx) {
    const u = this.uszlachetnienie ? plytaUszlachetnienia(this) : null;
    if (ctx?.jestPdf) {
      // PDF: tryb „pomiń” – bez uszlachetnień; „tylko” – same uszlachetnienia (jednej płyty); grupy przepuszczają.
      if (u && ctx.trybUszl === 'pomin') return undefined;
      if (ctx.trybUszl === 'tylko' && !this._objects && (!u || (ctx.tylkoPlyta && u.plyta !== ctx.tylkoPlyta))) return undefined;
      if (!u) return render.call(this, ctx);
      ctx.uszlStos.push(u);
      try { return render.call(this, ctx); } finally { ctx.uszlStos.pop(); }
    }
    if (stanUszlachetnien.maska) {
      if (u && u.plyta === stanUszlachetnien.maska) {
        // Element płyty (także cała grupa) – rysowany bez efektu, razem z zawartością.
        // Maska: kształt elementu na czarno (biały lakier na białym tle też ma być widać); obraz – jak jest.
        const m = stanUszlachetnien.maska;
        const obraz = this.type === 'image' || (this.zasob && !this.fill);
        const stare = { fill: this.fill, stroke: this.stroke, shadow: this.shadow };
        stanUszlachetnien.maska = null;
        try {
          if (!obraz && !this._objects) { if (this.fill) this.fill = '#000000'; if (this.stroke) this.stroke = '#000000'; this.shadow = null; this.dirty = true; }
          return render.call(this, ctx);
        } finally {
          stanUszlachetnien.maska = m;
          if (!obraz && !this._objects) { Object.assign(this, stare); this.dirty = true; }
        }
      }
      return this._objects ? render.call(this, ctx) : undefined;
    }
    if (u && stanUszlachetnien.eksport && !stanUszlachetnien.surowo) return undefined;
    if (u?.techniczna && !stanUszlachetnien.surowo) return rysujLinieWykrojnika(this, ctx, render, u);
    if (u && stanUszlachetnien.pokaz && !stanUszlachetnien.surowo) return rysujZEfektem(this, ctx, render, u);
    return render.call(this, ctx);
  };
}
