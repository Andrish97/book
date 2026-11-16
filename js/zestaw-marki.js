// Zestaw marki (#131D): kolory marki (z nazwami, także kolory dodatkowe – Pantone), czcionki marki (nagłówki
// i tekst) i logo – na koncie, dostępne w każdym projekcie: w wyborze koloru („Marka”), na liście czcionek,
// w Bibliotece (kategoria „Marka”) i przy „Zastosuj markę do projektu” (zamiana kolorów i czcionek).
// Zapis: js/chmura.js – kontoMarki() (<konto>/_marka/marka.json i pliki logo obok).

let pamiec = null; // { kolory: [{ id, nazwa, kolor, cmyk? }], czcionki: { naglowek, tekst }, loga: [{ id, nazwa, plik, typ, podglad }] }
const sluchacze = new Set();
export const naZmianeMarki = (fn) => { sluchacze.add(fn); return () => sluchacze.delete(fn); };
const powiadom = () => {
  globalThis.makietkaMarka = pamiec; // dla Biblioteki (kategoria „Marka”) bez importu tego modułu
  for (const fn of sluchacze) { try { fn(pamiec); } catch { /* jeden słuchacz nie psuje reszty */ } }
};

export const PUSTA_MARKA = () => ({ kolory: [], czcionki: { naglowek: '', tekst: '' }, loga: [], style: [] });

const hex = (k) => (typeof k === 'string' && /^#[0-9a-f]{6}$/i.test(k.trim()) ? k.trim().toLowerCase() : null);

// ---------- Style tekstu marki (#167) ----------
// Gotowe miejsca (rola) i własne style bez limitu. Rozmiar w punktach (pt), interlinia jako mnożnik wysokości pisma,
// odstęp liter w tysięcznych (‰, jak w panelu tekstu), kolor – kod (zwykle kolor marki), wielkość liter jako wygląd.
export const ROLE_STYLOW = [
  ['tytul', 'Tytuł'], ['podtytul', 'Podtytuł'], ['n1', 'Nagłówek 1'], ['n2', 'Nagłówek 2'], ['n3', 'Nagłówek 3'], ['n4', 'Nagłówek 4'],
  ['akapit', 'Akapit'], ['wyrozniony', 'Akapit wyróżniony'], ['podpis', 'Podpis'], ['cytat', 'Cytat'], ['lista', 'Lista'],
  ['przypis', 'Przypis'], ['stopka', 'Stopka / żywa pagina'], ['etykieta', 'Etykieta'],
];
export const WIELKOSCI_LITER = [['', 'Jak wpisane'], ['wielkie', 'WIELKIE'], ['male', 'małe'], ['kapitaliki', 'Kapitaliki']];
// [rozmiar pt, waga, kursywa, interlinia, odstęp liter, czcionka nagłówków?, wielkość liter, jaśniejszy kolor?]
const GOTOWE = {
  tytul: [32, 'bold', false, 1.1, 0, true, ''], podtytul: [18, 'normal', false, 1.2, 0, true, ''],
  n1: [24, 'bold', false, 1.15, 0, true, ''], n2: [18, 'bold', false, 1.2, 0, true, ''], n3: [14, 'bold', false, 1.25, 0, true, ''], n4: [12, 'bold', false, 1.3, 40, true, 'wielkie'],
  akapit: [10.5, 'normal', false, 1.4, 0, false, ''], wyrozniony: [12, 'normal', false, 1.4, 0, false, ''], podpis: [8, 'normal', true, 1.3, 10, false, '', true],
  cytat: [13, 'normal', true, 1.4, 0, true, ''], lista: [10.5, 'normal', false, 1.4, 0, false, ''], przypis: [7.5, 'normal', false, 1.3, 0, false, '', true],
  stopka: [8, 'normal', false, 1.2, 60, false, 'wielkie', true], etykieta: [9, 'bold', false, 1.2, 80, false, 'wielkie'],
};
const liczba = (v, d, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

export function gotowyStylMarki(rola, marka = biezacaMarka()) {
  const [rozmiar, waga, kursywa, interlinia, odstep, naglowkowa, litery, jasny] = GOTOWE[rola] || GOTOWE.akapit;
  const glowny = marka.kolory.find((k) => !neutralny(k.kolor))?.kolor;
  return normalizujStylMarki({
    id: `sm${rola}${Date.now().toString(36)}`, rola, nazwa: ROLE_STYLOW.find(([r]) => r === rola)?.[1] || 'Styl',
    czcionka: (naglowkowa ? marka.czcionki.naglowek : marka.czcionki.tekst) || marka.czcionki.tekst || marka.czcionki.naglowek || 'Inter',
    rozmiar, waga, kursywa, interlinia, odstep_liter: odstep, wielkosc_liter: litery,
    kolor: jasny ? '#6b6861' : (naglowkowa && glowny) || '#1a1a1a',
  });
}

export function normalizujStylMarki(s, i = 0) {
  return {
    id: String(s?.id || `sm${i}`),
    ...(ROLE_STYLOW.some(([r]) => r === s?.rola) ? { rola: s.rola } : {}),
    nazwa: String(s?.nazwa || 'Styl').trim().slice(0, 60) || 'Styl',
    czcionka: String(s?.czcionka || 'Inter').slice(0, 80),
    rozmiar: liczba(s?.rozmiar, 10.5, 4, 400),
    waga: ['normal', 'bold', '600', '300'].includes(String(s?.waga)) ? String(s.waga) : 'normal',
    kursywa: Boolean(s?.kursywa),
    interlinia: liczba(s?.interlinia, 1.3, 0.6, 4),
    odstep_liter: liczba(s?.odstep_liter, 0, -200, 2000),
    kolor: hex(s?.kolor) || '#1a1a1a',
    wielkosc_liter: WIELKOSCI_LITER.some(([w]) => w === s?.wielkosc_liter) ? s.wielkosc_liter : '',
  };
}

export function normalizujMarke(m) {
  const w = PUSTA_MARKA();
  if (!m || typeof m !== 'object') return w;
  w.kolory = (Array.isArray(m.kolory) ? m.kolory : []).map((k, i) => ({
    id: String(k?.id || `km${i}`),
    nazwa: String(k?.nazwa || '').slice(0, 60),
    kolor: hex(k?.kolor) || '#000000',
    ...(Array.isArray(k?.cmyk) && k.cmyk.length === 4 ? { cmyk: k.cmyk.map((v) => Math.max(0, Math.min(100, Number(v) || 0))) } : {}),
  })).slice(0, 40);
  w.czcionki = { naglowek: String(m.czcionki?.naglowek || ''), tekst: String(m.czcionki?.tekst || '') };
  w.loga = (Array.isArray(m.loga) ? m.loga : []).filter((l) => l?.plik).map((l) => ({
    id: String(l.id), nazwa: String(l.nazwa || 'logo'), plik: String(l.plik), typ: String(l.typ || 'image/png'), podglad: typeof l.podglad === 'string' ? l.podglad : '',
  })).slice(0, 20);
  w.style = (Array.isArray(m.style) ? m.style : []).filter((s) => s && typeof s === 'object').map(normalizujStylMarki);
  return w;
}

export const biezacaMarka = () => pamiec || PUSTA_MARKA();
export const markaPusta = (m = biezacaMarka()) => !m.kolory.length && !m.czcionki.naglowek && !m.czcionki.tekst && !m.loga.length && !m.style?.length;

// Styl marki → pola stylu projektu (js/style-tekstu.js; wymiary w mm).
export function stylMarkiDoProjektu(s) {
  return {
    fontFamily: s.czcionka, fontSize: Math.round(((s.rozmiar * 25.4) / 72) * 1000) / 1000, fontWeight: s.waga, fontStyle: s.kursywa ? 'italic' : 'normal',
    lineHeight: s.interlinia, charSpacing: s.odstep_liter, fill: s.kolor, wielkosc_liter: s.wielkosc_liter || null,
  };
}
// Style marki → style projektu: styl o tej samej nazwie (bez względu na wielkość liter) dostaje wygląd marki
// i zachowuje swoje id (teksty z tym stylem zostają z nim powiązane), brakujące dochodzą. Zwraca
// { dodane: [styl], zmienione: [styl] } – zmienione trzeba jeszcze rozpisać na teksty (zastosujStylWProjekcie).
export function zastosujStyleMarki(projekt, marka = biezacaMarka(), noweId = () => `st${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`) {
  projekt.style = Array.isArray(projekt.style) ? projekt.style : [];
  const klucz = (n) => String(n || '').trim().toLocaleLowerCase('pl');
  const dodane = [];
  const zmienione = [];
  for (const s of marka.style || []) {
    const pola = stylMarkiDoProjektu(s);
    const byl = projekt.style.find((x) => klucz(x.nazwa) === klucz(s.nazwa));
    if (byl) { Object.assign(byl, pola); zmienione.push(byl); } else {
      const nowy = { id: noweId(), nazwa: s.nazwa, underline: false, linethrough: false, textAlign: 'left', ...pola };
      projekt.style.push(nowy);
      dodane.push(nowy);
    }
  }
  return { dodane, zmienione };
}

const konto = async () => (await import('./chmura.js')).kontoMarki();

export async function wczytajMarke() {
  try { pamiec = normalizujMarke(await (await konto()).wczytaj()); } catch { pamiec = pamiec || PUSTA_MARKA(); }
  powiadom();
  return pamiec;
}

export async function zapiszMarke(m) {
  const n = normalizujMarke(m);
  await (await konto()).zapisz(n);
  pamiec = n;
  powiadom();
  return n;
}

// Logo: plik idzie na konto, do spisu trafia mały podgląd (data URL, do 160 px) – pokazuje się od razu.
export async function dodajLogo(blob, nazwa, podglad = '') {
  const m = biezacaMarka();
  const id = `lg${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const rozsz = (blob.type.split('/')[1] || 'png').replace('svg+xml', 'svg').replace('jpeg', 'jpg');
  const plik = `${id}.${rozsz}`;
  await (await konto()).wyslijLogo(plik, blob);
  return zapiszMarke({ ...m, loga: [...m.loga, { id, nazwa, plik, typ: blob.type, podglad }] });
}

export async function usunLogo(id) {
  const m = biezacaMarka();
  const l = m.loga.find((x) => x.id === id);
  if (l) { try { await (await konto()).usunLogo(l.plik); } catch { /* plik zostanie – spis i tak go nie pokazuje */ } }
  return zapiszMarke({ ...m, loga: m.loga.filter((x) => x.id !== id) });
}

export async function plikLogo(id) {
  const l = biezacaMarka().loga.find((x) => x.id === id);
  if (!l) throw new Error('Nie ma takiego logo.');
  return { blob: await (await konto()).pobierzLogo(l.plik), nazwa: l.nazwa };
}

// ---------- Zastosowanie marki do projektu ----------

// Odległość kolorów (RGB, ważona jak w redmean) – do podpowiedzi „najbliższy kolor marki”.
function odleglosc(a, b) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const r = (r1 + r2) / 2;
  return Math.sqrt((2 + r / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - r) / 256) * (b1 - b2) ** 2);
}
export function najblizszyKolorMarki(kolor, marka = biezacaMarka()) {
  const h = hex(kolor);
  if (!h || !marka.kolory.length) return null;
  return marka.kolory.reduce((naj, k) => (odleglosc(h, k.kolor) < odleglosc(h, naj.kolor) ? k : naj)).kolor;
}

const neutralny = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) < 12;
};

// Propozycja mapowania: kolory projektu → najbliższe kolory marki (czerń, biel i szarości zostają, gdy marka nie ma kolorów neutralnych),
// czcionki: najczęstsza → czcionka tekstu marki, pozostałe (zwykle nagłówkowe) → czcionka nagłówków.
export function propozycjaMapowania(kolory, czcionki, marka = biezacaMarka()) {
  const mapaKolorow = {};
  for (const { kolor } of kolory) {
    const h = hex(kolor);
    if (!h) continue;
    // Czerń, biel i szarości (np. kolor tekstu) zostają, chyba że marka ma własne kolory neutralne.
    if (neutralny(h) && !marka.kolory.some((k) => neutralny(k.kolor))) { mapaKolorow[h] = h; continue; }
    mapaKolorow[h] = najblizszyKolorMarki(h, marka) || h;
  }
  const mapaCzcionek = {};
  czcionki.forEach(({ nazwa }, i) => {
    const docelowa = i === 0 ? (marka.czcionki.tekst || marka.czcionki.naglowek) : (marka.czcionki.naglowek || marka.czcionki.tekst);
    mapaCzcionek[nazwa] = docelowa || nazwa;
  });
  return { kolory: mapaKolorow, czcionki: mapaCzcionek };
}

// Zamienia kolory i czcionki w całym projekcie (strony, wzorce, style, tła) – w miejscu. Zwraca liczbę zmian.
export function zastosujMapowanie(projekt, { kolory = {}, czcionki = {} }) {
  let n = 0;
  const k = (v) => {
    const h = hex(v);
    if (h && kolory[h] && kolory[h] !== h) { n += 1; return kolory[h]; }
    return v;
  };
  const kol = (o, pole) => {
    if (!o) return;
    const v = o[pole];
    if (v && typeof v === 'object' && Array.isArray(v.colorStops)) { for (const st of v.colorStops) st.color = k(st.color); return; }
    if (typeof v === 'string') o[pole] = k(v);
  };
  const cz = (o, pole) => {
    if (o && typeof o[pole] === 'string' && czcionki[o[pole]] && czcionki[o[pole]] !== o[pole]) { o[pole] = czcionki[o[pole]]; n += 1; }
  };
  const przejdz = (obiekty) => {
    for (const o of obiekty || []) {
      kol(o, 'fill'); kol(o, 'stroke'); kol(o, 'backgroundColor');
      if (o.shadow) kol(o.shadow, 'color');
      if (typeof o.text === 'string') { cz(o, 'fontFamily'); cz(o, 'inicjal_czcionka'); }
      for (const st of Array.isArray(o.styles) ? o.styles : []) { kol(st.style, 'fill'); kol(st.style, 'stroke'); cz(st.style, 'fontFamily'); }
      if (Array.isArray(o.objects)) przejdz(o.objects);
    }
  };
  for (const s of projekt.strony || []) { kol(s, 'tlo'); przejdz(s.obiekty); }
  for (const w of projekt.wzorce || []) { kol(w, 'tlo'); przejdz(w.obiekty); }
  for (const st of [...(projekt.style || []), ...(projekt.style_znakowe || [])]) { kol(st, 'fill'); cz(st, 'fontFamily'); }
  return n;
}

// Kolory marki jako kolory dodatkowe projektu (#127) – te, które mają CMYK (np. Pantone z zapasem CMYK).
export function koloryDodatkoweZMarki(marka = biezacaMarka()) {
  return marka.kolory.filter((k) => k.cmyk && k.nazwa).map((k) => ({ id: `marka_${k.id}`, nazwa: k.nazwa, cmyk: k.cmyk }));
}
