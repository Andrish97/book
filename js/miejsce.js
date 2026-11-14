// Miejsce na koncie (decyzje #90, #92): pliki konta w R2 wobec limitu konta, cały magazyn plików aplikacji,
// baza danych, projekty wobec limitu, sprzątanie osieroconych plików i ostrzeżenie przy 80%.
// Pliki: przekaźnik (GET /pliki/_miejsce, /pliki/_osierocone, POST /pliki/_usun – cloudflare/api-worker.js).
// Baza: miejsce_na_koncie, posprzataj_konto (migracje 20261114150000_miejsce_na_koncie.sql, 20261114180000_pliki_r2_limity.sql).

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

// { obrazy, czcionki, podglady, plikow, konto, limit_konta, limit_pliku (R2), chronione, od_ai, projekty,
//   limit_projektow, osoby_w_projekcie, obrazy_w_projekcie (baza) } – sumy całej aplikacji (pliki_razem, baza_razem)
//   przychodzą, ale konto ich nie pokazuje (#100).
export async function miejsce({ swieze = false } = {}) {
  if (!swieze && ostatnie && Date.now() - kiedy < WAZNOSC_MS) return ostatnie;
  const [baza, pliki] = await Promise.all([rpc('miejsce_na_koncie'), chmura.r2.miejsce()]);
  ostatnie = { ...baza, ...pliki };
  kiedy = Date.now();
  return ostatnie;
}

const liczba = (x) => Number(x) || 0;
export const mojeRazem = (m) => liczba(m.obrazy) + liczba(m.czcionki) + liczba(m.podglady) + liczba(m.chronione) + liczba(m.od_ai);
export const udzialKonta = (m) => (m.limit_konta ? liczba(m.konto) / m.limit_konta : 0);

// Tekst ostrzeżenia albo null, gdy miejsca jest dość. Tylko konto – użytkownik nie widzi danych całej aplikacji
// (#100); gdy kończy się miejsce całego magazynu, wgranie dostaje odmowę z neutralnym komunikatem.
export function ostrzezenie(m) {
  const konto = udzialKonta(m);
  if (konto < PROG_OSTRZEZENIA) return null;
  const skutek = konto >= 1 ? 'Nowe obrazy nie zapiszą się na koncie.' : 'Gdy miejsce się skończy, nowe obrazy nie zapiszą się na koncie.';
  return `Twoje pliki zajmują ${Math.round(konto * 100)}% miejsca konta (${rozmiar(m.konto)} z ${rozmiar(m.limit_konta)}). ${skutek} Posprzątaj stare pliki w ustawieniach konta (Miejsce) albo usuń nieużywane obrazy i projekty.`;
}

// Komunikat, gdy konto ma już tyle projektów, ile wolno (sprawdzane przed „Nowy projekt”, „Duplikuj”, „Importuj”);
// null – można zakładać. Bez sieci nie blokujemy: baza i tak odmówi zapisu ponad limit.
export async function limitProjektow() {
  try {
    const m = await rpc('miejsce_na_koncie');
    if (liczba(m?.limit_projektow) && liczba(m.projekty) >= liczba(m.limit_projektow)) {
      return `Masz już ${m.projekty} projektów – to limit jednego konta. Usuń albo wyeksportuj do pliku projekt, którego nie potrzebujesz, żeby założyć nowy.`;
    }
  } catch { /* bez sieci albo bez konta */ }
  return null;
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
  const [pliki, baza] = await Promise.all([chmura.r2.osierocone(), rpc('posprzataj_konto', { p_policz: true })]);
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
  const wgBucketu = new Map();
  for (const x of p.pliki) wgBucketu.set(x.bucket, [...(wgBucketu.get(x.bucket) || []), x.nazwa]);
  for (const [bucket, nazwy] of wgBucketu) {
    for (let i = 0; i < nazwy.length; i += 100) {
      await chmura.r2.usun(bucket, nazwy.slice(i, i + 100));
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
