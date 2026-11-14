// Miejsce na koncie (decyzja #89): ile zajmują pliki zalogowanego i cała aplikacja wobec limitów darmowego
// planu bazy (pliki 1 GB, baza 500 MB), sprzątanie osieroconych plików i ostrzeżenie przy 80%.
// Funkcje bazy: miejsce_na_koncie, pliki_osierocone, posprzataj_konto (migracja 20261114150000_miejsce_na_koncie.sql).

import * as chmura from './chmura.js';
import { sciezkiLokalne } from './lokalny.js';

export const PROG_OSTRZEZENIA = 0.8;
const WAZNOSC_MS = 10 * 60 * 1000; // stan miejsca z pamięci przez 10 minut
const SPRZATANIE_CO_MS = 24 * 3600 * 1000;

export const rozmiar = (b) => {
  const n = Number(b) || 0;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`;
  if (n > 0) return `${Math.max(1, Math.round(n / 1024))} kB`;
  return '0 kB';
};

async function rpc(nazwa, parametry) {
  const sb = await chmura.supabase();
  const { data, error } = await sb.rpc(nazwa, parametry);
  if (error) throw new Error(error.message || String(error));
  return data;
}

let ostatnie = null;
let kiedy = 0;

// { obrazy, czcionki, podglady, chronione, od_ai, plikow, pliki_razem, baza_razem, limit_plikow, limit_bazy }
export async function miejsce({ swieze = false } = {}) {
  if (!swieze && ostatnie && Date.now() - kiedy < WAZNOSC_MS) return ostatnie;
  ostatnie = await rpc('miejsce_na_koncie');
  kiedy = Date.now();
  return ostatnie;
}

const liczba = (x) => Number(x) || 0;
export const mojeRazem = (m) => liczba(m.obrazy) + liczba(m.czcionki) + liczba(m.podglady) + liczba(m.chronione) + liczba(m.od_ai);
export const udzialPlikow = (m) => (m.limit_plikow ? liczba(m.pliki_razem) / m.limit_plikow : 0);
export const udzialBazy = (m) => (m.limit_bazy && m.baza_razem != null ? liczba(m.baza_razem) / m.limit_bazy : 0);

// Tekst ostrzeżenia albo null, gdy miejsca jest dość.
export function ostrzezenie(m) {
  const pliki = udzialPlikow(m);
  const baza = udzialBazy(m);
  const najwiecej = Math.max(pliki, baza);
  if (najwiecej < PROG_OSTRZEZENIA) return null;
  const co = pliki >= baza
    ? `Pliki całej aplikacji zajmują ${Math.round(pliki * 100)}% miejsca (${rozmiar(m.pliki_razem)} z ${rozmiar(m.limit_plikow)}).`
    : `Baza danych aplikacji zajmuje ${Math.round(baza * 100)}% miejsca (${rozmiar(m.baza_razem)} z ${rozmiar(m.limit_bazy)}).`;
  const skutek = najwiecej >= 1 ? 'Nowe obrazy mogą się nie zapisać na koncie.' : 'Gdy miejsce się skończy, nowe obrazy nie zapiszą się na koncie.';
  return `${co} ${skutek} Posprzątaj stare pliki w ustawieniach konta (Miejsce) albo usuń nieużywane obrazy i projekty.`;
}

// Ostrzeżenie przy wgrywaniu obrazów – najwyżej raz na 10 minut.
let ostatnieOstrzezenie = 0;
export async function ostrzezPrzyWgrywaniu(powiadom) {
  if (Date.now() - ostatnieOstrzezenie < WAZNOSC_MS) return;
  try {
    const tekst = ostrzezenie(await miejsce());
    if (!tekst) return;
    ostatnieOstrzezenie = Date.now();
    powiadom(tekst, true);
  } catch { /* bez sieci albo bez konta – nic */ }
}

// Co sprzątanie usunie: { pliki: [{ bucket, nazwa, rozmiar }], baza: { ai, ai_bajty, linki, linki_bajty }, ile, bajty }.
// Pliki obrazów, na które wskazuje projekt zapisany w tej przeglądarce (np. jeszcze niewysłany), zostają.
export async function planSprzatania() {
  const [pliki, baza] = await Promise.all([rpc('pliki_osierocone'), rpc('posprzataj_konto', { p_policz: true })]);
  let lokalne = null;
  try { lokalne = await sciezkiLokalne(); } catch { /* bez magazynu przeglądarki: plików obrazów nie ruszamy */ }
  const doUsuniecia = (pliki || []).filter((p) => p.bucket !== 'zasoby' || (lokalne && !lokalne.has(p.nazwa)));
  const b = baza || { ai: 0, ai_bajty: 0, linki: 0, linki_bajty: 0 };
  return {
    pliki: doUsuniecia,
    baza: b,
    ile: doUsuniecia.length + liczba(b.ai) + liczba(b.linki),
    bajty: doUsuniecia.reduce((s, p) => s + liczba(p.rozmiar), 0) + liczba(b.ai_bajty) + liczba(b.linki_bajty),
  };
}

// Usuwa to, co pokazał plan (albo świeży plan). naKrok(gotowe, razem) – postęp. Zwraca wykonany plan.
export async function posprzataj(plan = null, naKrok = () => {}) {
  const p = plan || await planSprzatania();
  let gotowe = 0;
  const sb = await chmura.supabase();
  const wgBucketu = new Map();
  for (const x of p.pliki) wgBucketu.set(x.bucket, [...(wgBucketu.get(x.bucket) || []), x.nazwa]);
  for (const [bucket, nazwy] of wgBucketu) {
    for (let i = 0; i < nazwy.length; i += 100) {
      const { error } = await sb.storage.from(bucket).remove(nazwy.slice(i, i + 100));
      if (error) throw new Error(error.message || String(error));
      gotowe += Math.min(100, nazwy.length - i);
      naKrok(gotowe, p.ile);
    }
  }
  if (liczba(p.baza.ai) || liczba(p.baza.linki)) await rpc('posprzataj_konto', { p_policz: false });
  naKrok(p.ile, p.ile);
  ostatnie = null;
  return p;
}

// Ciche sprzątanie w tle przy otwarciu listy projektów – najwyżej raz na dobę na tym urządzeniu.
export async function sprzatnijWTle(idKonta) {
  if (!idKonta) return null;
  const klucz = `sprzatanie-konta:${idKonta}`;
  try {
    if (Date.now() - Number(localStorage.getItem(klucz) || 0) < SPRZATANIE_CO_MS) return null;
    localStorage.setItem(klucz, String(Date.now()));
  } catch { return null; }
  try { return await posprzataj(); } catch { return null; }
}
