// Ustawienia makiety 3D (#181): światło, tło, materiały i zapisane ujęcia w projekcie (pole `projekt.makieta`).
// Moduł bez zależności – używają go js/makieta-3d.js (rysowanie), js/app/makieta-okno.js (okno) i js/projekt.js
// (normalizacja wczytanego projektu). Opis pola dla AI: ai/format-makietka.md.

export const DRUT = '#2f3237';
export const TEKTURA = '#a29a8d';

export const TLA = { studio: 'Studyjne (gradient)', kolor: 'Jednolity kolor', drewno: 'Drewno', papier: 'Papier', beton: 'Beton', marmur: 'Marmur', tkanina: 'Tkanina', tynk: 'Tynk (ściana)', przezroczyste: 'Przezroczyste' };
export const SWIATLA = { lewo: 'Z lewej', prawo: 'Z prawej', gora: 'Z góry', okno: 'Okno (nisko, z boku)' };
export const BARWY = { neutralna: 'Neutralna', ciepla: 'Ciepła', zimna: 'Zimna' };
export const WYKONCZENIA_OKLADKI = { projekt: 'Jak w projekcie', mat: 'Mat', blysk: 'Błysk', soft: 'Soft-touch' };
export const PAPIERY = { bialy: 'Biały', kremowy: 'Kremowy' };
export const ILOSCI = { 1: 'Jeden egzemplarz', obok2: 'Dwa obok siebie', obok3: 'Trzy obok siebie', stos3: 'Stos – 3', stos5: 'Stos – 5', przodTyl: 'Przód i tył' };
export const MODELE_MAKIETY = ['ksiazka_miekka', 'ksiazka_twarda', 'notes', 'kalendarz_scienny', 'kalendarz_biurkowy', 'kartka', 'ulotka', 'koperta', 'pudelko', 'trojdzielny'];

export const DOMYSLNE_OPCJE = {
  tlo: 'studio', kolorTla: '#e9e6e0', swiatlo: 'lewo', barwa: 'neutralna', silaCienia: 1, miekkosc: 0.5,
  wykonczenie: 'projekt', papier: 'bialy', kolorSpirali: DRUT, kolorStojaka: TEKTURA, uszlachetnienia: true,
};

const HEX = /^#[0-9a-f]{6}$/i;
const zListy = (v, lista, d) => (typeof v === 'string' && Object.hasOwn(lista, v) ? v : d);
const liczba = (v, a, b, d) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Number(v))) : d);

// Opcje światła, tła i materiałów – tylko znane wartości, reszta domyślna.
export function normalizujOpcje(o = {}) {
  const D = DOMYSLNE_OPCJE;
  return {
    tlo: zListy(o?.tlo, TLA, D.tlo), kolorTla: HEX.test(o?.kolorTla) ? o.kolorTla : D.kolorTla,
    swiatlo: zListy(o?.swiatlo, SWIATLA, D.swiatlo), barwa: zListy(o?.barwa, BARWY, D.barwa),
    silaCienia: liczba(o?.silaCienia, 0, 1.6, D.silaCienia), miekkosc: liczba(o?.miekkosc, 0, 1, D.miekkosc),
    wykonczenie: zListy(o?.wykonczenie, WYKONCZENIA_OKLADKI, D.wykonczenie), papier: zListy(o?.papier, PAPIERY, D.papier),
    kolorSpirali: HEX.test(o?.kolorSpirali) ? o.kolorSpirali : D.kolorSpirali,
    kolorStojaka: HEX.test(o?.kolorStojaka) ? o.kolorStojaka : D.kolorStojaka,
    uszlachetnienia: o?.uszlachetnienia !== false,
  };
}

// Ilość egzemplarzy: wartość listy ILOSCI ↔ { n, uklad } sceny.
export const iloscSceny = (id) => ({ 1: null, obok2: { n: 2, uklad: 'obok' }, obok3: { n: 3, uklad: 'obok' }, stos3: { n: 3, uklad: 'stos' }, stos5: { n: 5, uklad: 'stos' }, przodTyl: { n: 2, uklad: 'przodTyl' } }[id] ?? null);
export function idIlosci(ilosc) {
  if (!ilosc || !(ilosc.n > 1 || ilosc.uklad === 'przodTyl')) return '1';
  if (ilosc.uklad === 'przodTyl') return 'przodTyl';
  if (ilosc.uklad === 'stos') return ilosc.n >= 4 ? 'stos5' : 'stos3';
  return ilosc.n >= 3 ? 'obok3' : 'obok2';
}

// Ustawienia sceny: kąt otwarcia (stopnie, null – domyślny), wachlarz (kartek), ilość, uchylenie okładki (0–1).
export function normalizujScene(s = {}) {
  const ot = liczba(s?.otwarcie, 60, 180, null);
  return {
    otwarcie: ot === null ? null : Math.round(ot),
    wachlarz: Math.round(liczba(s?.wachlarz, 0, 12, 0)),
    ilosc: iloscSceny(idIlosci(s?.ilosc)),
    uchylenie: liczba(s?.uchylenie, 0, 0.95, 0),
  };
}

// Zapisane ujęcie: { id, nazwa, model, u, ulozenie, kamera: { obrotY, obrotX, zoom, fov }, scena, opcje, obwoluta }.
export function normalizujUjecie(x, i = 0) {
  if (!x || typeof x !== 'object') return null;
  const k = x.kamera || {};
  return {
    id: typeof x.id === 'string' && x.id ? x.id.slice(0, 40) : `uj${i + 1}`,
    nazwa: String(x.nazwa || `Ujęcie ${i + 1}`).slice(0, 80),
    model: MODELE_MAKIETY.includes(x.model) ? x.model : null,
    u: liczba(x.u, 0, 10000, 0),
    ulozenie: x.ulozenie === 'stoi' ? 'stoi' : 'lezy',
    kamera: { obrotY: liczba(k.obrotY, -20, 20, -0.32), obrotX: liczba(k.obrotX, -1.6, 1.6, 0.68), zoom: liczba(k.zoom, 0.2, 6, 1), fov: liczba(k.fov, 10, 70, 28) },
    scena: normalizujScene(x.scena),
    opcje: normalizujOpcje(x.opcje),
    obwoluta: Boolean(x.obwoluta),
  };
}

// Pole projektu `makieta` – { ujecia: [...] } (najwyżej 40). Bez ujęć – null (pole znika z projektu).
export function normalizujMakiete(m) {
  if (!m || typeof m !== 'object' || !Array.isArray(m.ujecia)) return null;
  const ujecia = m.ujecia.slice(0, 40).map(normalizujUjecie).filter(Boolean);
  const ids = new Set();
  for (const u of ujecia) { while (ids.has(u.id)) u.id = `${u.id}x`; ids.add(u.id); }
  return ujecia.length ? { ujecia } : null;
}
