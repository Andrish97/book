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

export const PUSTA_MARKA = () => ({ kolory: [], czcionki: { naglowek: '', tekst: '' }, loga: [] });

const hex = (k) => (typeof k === 'string' && /^#[0-9a-f]{6}$/i.test(k.trim()) ? k.trim().toLowerCase() : null);

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
  return w;
}

export const biezacaMarka = () => pamiec || PUSTA_MARKA();
export const markaPusta = (m = biezacaMarka()) => !m.kolory.length && !m.czcionki.naglowek && !m.czcionki.tekst && !m.loga.length;

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

// Propozycja mapowania: kolory projektu → najbliższe kolory marki (czerń i biel zostają, gdy marka ich nie ma),
// czcionki: najczęstsza → czcionka tekstu marki, pozostałe (zwykle nagłówkowe) → czcionka nagłówków.
export function propozycjaMapowania(kolory, czcionki, marka = biezacaMarka()) {
  const mapaKolorow = {};
  for (const { kolor } of kolory) {
    const h = hex(kolor);
    if (!h) continue;
    if ((h === '#000000' || h === '#ffffff') && !marka.kolory.some((k) => k.kolor === h)) { mapaKolorow[h] = h; continue; }
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
