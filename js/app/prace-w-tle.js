// Prace w tle w karcie (#438, etap C): link do podglądu rysuje karta, która trzyma dzierżawę pracy
// (migracja 20261126100000_prace_w_tle.sql). Karty konta widzą się przez obecność (Realtime presence) i wybierają
// najmocniejsze urządzenie (js/prace-w-tle.js). Wykonawca odnawia dzierżawę co kilka sekund; przed każdą stroną
// sprawdza, czy nie przyszła nowsza wersja projektu albo czy pracy nie odebrano – wtedy kończy po bieżącej stronie
// (strona jest jednostką atomową), oddaje pracę i po chwili spokoju zaczyna od nowa, rysując tylko to, czego brakuje.
// Rysowanie nie przeszkadza w pracy: przy pisaniu i przeciąganiu czeka, aż ręce się zatrzymają.
// Baza bez kolejki (starsza wersja, test z atrapą) – link rysuje się jak dawniej, bez dzierżawy.

import * as chmura from '../chmura.js';
import { stan } from './kontekst.js';
import { klasaUrzadzenia, ocena, wybierzWykonawce, DUZA_PRACA_STRON } from '../prace-w-tle.js';

export const KARTA = `k-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
const ODNOWIENIE_MS = 5000;
const SPOKOJ_MS = 700; // tyle bez dotknięcia klawiatury i myszy, zanim narysuje się następna strona
const SPOKOJ_NAJDLUZEJ_MS = 8000; // przy ciągłym pisaniu i tak rysuje (link nie może stać w nieskończoność)
export const SPOKOJ_PO_ZMIANIE_MS = 5000; // przerwana praca: tyle ciszy po ostatniej zmianie przed nowym planem

const rpc = async (nazwa, parametry = {}) => {
  const { data, error } = await (await chmura.supabase()).rpc(nazwa, parametry);
  if (error) throw error;
  return data;
};

// ---------- To urządzenie ----------

let bateria = null;
try { navigator.getBattery?.().then((b) => { const ustaw = () => { bateria = { laduje: b.charging, poziom: b.level }; }; ustaw(); b.addEventListener?.('chargingchange', ustaw); b.addEventListener?.('levelchange', ustaw); }).catch(() => {}); } catch { /* bez baterii */ }

export function ocenaKarty() {
  if (globalThis.__ocenaUrzadzenia) return globalThis.__ocenaUrzadzenia; // testy: udawany telefon
  const c = navigator.connection;
  const siec = c?.type === 'wifi' || c?.type === 'ethernet' ? 'wifi' : c?.type === 'cellular' ? 'komorkowa' : 'nieznana';
  const klasa = klasaUrzadzenia({ ua: navigator.userAgent, dotyk: navigator.maxTouchPoints || 0, szerokosc: window.screen.width, wysokosc: window.screen.height });
  return { klasa, ...ocena({ klasa, rdzenie: navigator.hardwareConcurrency, pamiec: navigator.deviceMemory, widoczna: document.visibilityState === 'visible', bateria, siec, oszczedzanie: Boolean(c?.saveData) }) };
}

// Czy to urządzenie samo narysuje tyle stron (inaczej – serwer od razu).
export function mozeSam(stron) {
  const o = ocenaKarty();
  return Boolean(o.male && (stron < DUZA_PRACA_STRON || o.duze));
}

// ---------- Obecność kart konta ----------

let konto = null;
let kanal = null;
let obecne = [];
const mojaObecnosc = () => ({ karta: KARTA, projekty: stan.projekt?.id ? [stan.projekt.id] : [], ...ocenaKarty() });
const karty = () => {
  const ja = mojaObecnosc();
  return [ja, ...obecne.filter((k) => k.karta !== KARTA)];
};

export async function wlaczPraceWTle(uzytkownik) {
  if (!uzytkownik) { await wylaczPraceWTle(); return; }
  if (konto === uzytkownik.id) return;
  await wylaczPraceWTle();
  konto = uzytkownik.id;
  try {
    const sb = await chmura.supabase();
    if (typeof sb.channel !== 'function') return;
    kanal = sb.channel(`prace-${konto}`, { config: { presence: { key: KARTA } } })
      .on('presence', { event: 'sync' }, () => {
        try { obecne = Object.values(kanal.presenceState() || {}).flat().map((x) => x?.karta ? x : null).filter(Boolean); } catch { obecne = []; }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prace_w_tle', filter: `wlasciciel=eq.${konto}` }, (z) => { if (z?.new?.id) rozwaz(z.new); })
      .subscribe((s) => { if (s === 'SUBSCRIBED') { ogloszObecnosc(); sprawdzZalegle(); } });
  } catch { kanal = null; }
}

// ---------- Praca innego projektu (ta karta nie ma go otwartego) ----------
// Pierwszeństwo ma karta z otwartym projektem (rysuje po ~4 s od zmiany); ta karta czeka dłużej i bierze pracę
// tylko wtedy, gdy nadal nikt jej nie wziął, a ta karta jest wybranym urządzeniem (np. komputer, gdy projekt
// edytuje się na telefonie na danych komórkowych). Inaczej po 30 s weźmie ją serwer.
export const CZEKANIE_OBCEJ_MS = 9000;
const rozwazane = new Map(); // id pracy → timer
let kolejka = Promise.resolve();
function rozwaz(w) {
  if (!w?.id || !konto || stan.projekt?.id === w.projekt_id) return;
  if (!['czeka', 'blad'].includes(w.stan) || !(w.wersja > w.wykonana)) return;
  clearTimeout(rozwazane.get(w.id));
  rozwazane.set(w.id, setTimeout(() => { rozwazane.delete(w.id); kolejka = kolejka.then(() => wezObca(w.id)).catch(() => {}); }, CZEKANIE_OBCEJ_MS));
}
async function sprawdzZalegle() {
  try { for (const w of await rpc('prace_konta') || []) rozwaz(w); } catch { /* baza bez kolejki */ }
}
async function wezObca(id) {
  if (!konto || !navigator.onLine) return;
  const w = (await rpc('prace_konta') || []).find((x) => x.id === id);
  if (!w || !['czeka', 'blad'].includes(w.stan) || stan.projekt?.id === w.projekt_id) return;
  if (Date.now() - new Date(w.zgloszono).getTime() < CZEKANIE_OBCEJ_MS - 500) { rozwaz(w); return; } // projekt dalej się zmienia
  if (wybierzWykonawce(karty(), { projekt: w.projekt_id }) !== KARTA) return;
  const { linkInnegoProjektu } = await import('./podglad-ekran.js');
  await linkInnegoProjektu(w.projekt_id, w.cel);
}

export async function wylaczPraceWTle() {
  konto = null;
  obecne = [];
  if (!kanal) return;
  const stary = kanal;
  kanal = null;
  try { await (await chmura.supabase()).removeChannel(stary); } catch { /* już zamknięty */ }
}

export function ogloszObecnosc() {
  try { kanal?.track?.(mojaObecnosc()); } catch { /* bez obecności – karta i tak działa */ }
}
document.addEventListener('visibilitychange', ogloszObecnosc);

// ---------- Spokój: nie rysujemy pod rękami ----------

let ostatniRuch = 0;
for (const z of ['pointerdown', 'pointermove', 'keydown', 'input', 'wheel', 'touchstart']) {
  window.addEventListener(z, (e) => { if (z !== 'pointermove' || e.buttons) ostatniRuch = performance.now(); }, { capture: true, passive: true });
}
const czekaj = (ms) => new Promise((ok) => { setTimeout(ok, ms); });
async function poczekajNaSpokoj() {
  const od = performance.now();
  while (performance.now() - ostatniRuch < SPOKOJ_MS && performance.now() - od < SPOKOJ_NAJDLUZEJ_MS) await czekaj(150);
  await new Promise((ok) => { (window.requestIdleCallback || ((f) => setTimeout(f, 0)))(() => ok(), { timeout: 300 }); });
}

// ---------- Praca nad linkiem z dzierżawą ----------

// Wykonuje praca({ przedStrona }) pod dzierżawą pracy linku L projektu p. Zwraca:
//   { wynik } – narysowane (albo przerwane – wynik.przerwane),
//   { inny: true } – pracę robi inna karta albo serwer (ta karta nic nie robi),
//   { bezKolejki: true, wynik } – baza bez kolejki: narysowane jak dawniej.
export async function zDzierzawa(p, L, praca) {
  const przedStrona = async () => { await poczekajNaSpokoj(); return false; };
  let wiersz;
  try {
    await rpc('praca_zglos_link', { p_projekt: p.id });
    wiersz = (await rpc('prace_konta') || []).find((x) => x.projekt_id === p.id && x.cel === L.kod);
  } catch {
    return { bezKolejki: true, wynik: await praca({ przedStrona }) };
  }
  // Nic do zrobienia w kolejce (wersja już narysowana), a link i tak nieaktualny (np. zmienione ustawienia linku
  // w tej karcie) – rysuje ta karta, bez dzierżawy (nikt inny nie ma po co).
  if (!wiersz || wiersz.wersja <= wiersz.wykonana) return { wynik: await praca({ przedStrona }) };
  const wybrana = wybierzWykonawce(karty(), { projekt: p.id });
  if (wybrana && wybrana !== KARTA) return { inny: true };
  if (wiersz.stan === 'w_toku' && wiersz.wykonawca && wiersz.wykonawca !== KARTA && wiersz.wykonawca !== 'serwer' && new Date(wiersz.dzierzawa_do) > new Date()) return { inny: true };
  let moja;
  try { moja = await rpc('praca_przejmij', { p_id: wiersz.id, p_karta: KARTA, p_od_serwera: document.visibilityState === 'visible' }); } catch { moja = null; }
  if (!moja) return { inny: true };
  let utracona = false;
  let nowsza = false;
  const odnow = async (gotowe = null, wszystkie = null) => {
    try {
      const w = await rpc('praca_odnow', { p_id: moja.id, p_karta: KARTA, p_gotowe: gotowe, p_wszystkie: wszystkie });
      if (!w) utracona = true;
      else if (w.wersja > moja.wersja) nowsza = true;
    } catch { /* chwilowy brak sieci – dzierżawa trwa 30 s */ }
  };
  const timer = setInterval(() => odnow(), ODNOWIENIE_MS);
  let blad = null;
  let wynik = null;
  try {
    wynik = await praca({ przedStrona: async () => { await poczekajNaSpokoj(); return utracona || nowsza; } });
    return { wynik };
  } catch (e) {
    blad = String(e?.message || e).slice(0, 300);
    throw e;
  } finally {
    clearInterval(timer);
    if (!utracona) {
      const przerwane = Boolean(wynik?.przerwane) || (nowsza && !wynik);
      rpc('praca_zakoncz', { p_id: moja.id, p_karta: KARTA, p_wersja: moja.wersja, p_blad: blad, p_zwolnij: przerwane }).catch(() => {});
    }
  }
}

// Link już aktualny dla wersji, którą ta karta zna (np. po zapisie samych danych linku w projekcie): praca zamyka
// się bez rysowania – inaczej czekałaby i po 30 s serwer rysowałby na próżno. Tylko wersje nie nowsze niż znana
// karcie (p.wersja_chmury) – zmiana z innego urządzenia, której ta karta jeszcze nie ma, zostaje do narysowania.
export async function potwierdzAktualne(p, kody) {
  if (!p?.id || !p.wersja_chmury || !kody.length) return;
  try {
    const lista = (await rpc('prace_konta') || []).filter((w) => w.projekt_id === p.id && kody.includes(w.cel) && w.stan !== 'w_toku' && w.wersja > w.wykonana && w.wersja <= p.wersja_chmury);
    for (const w of lista) {
      const m = await rpc('praca_przejmij', { p_id: w.id, p_karta: KARTA, p_od_serwera: false });
      if (m) await rpc('praca_zakoncz', { p_id: m.id, p_karta: KARTA, p_wersja: Math.min(m.wersja, p.wersja_chmury), p_blad: null, p_zwolnij: false });
    }
  } catch { /* baza bez kolejki */ }
}

// Karta zamyka się w trakcie pracy: dzierżawa po prostu wygaśnie (30 s), a serwer dokończy od miejsca przerwania.
