// Eksport PDF i PNG zlecany przez AI (decyzja #175, migracja 20261117110000_zlecenia_eksportu.sql).
//
// Łącznik AI nie narysuje pliku – robi to przeglądarka (czcionki, Fabric, profile barwne). AI składa zlecenie,
// a każda otwarta karta zalogowanego konta słucha nowych zleceń (Realtime) i sprawdza zaległe przy starcie,
// po powrocie do karty i co minutę. Zlecenie przyjmuje tylko jedna karta (przyjmij_eksport – UPDATE … WHERE
// stan = 'czeka'); pierwszeństwo ma karta z otwartym tym projektem, inne czekają chwilę. Karta robi plik zwykłym
// kodem eksportu (bez okna), wgrywa go do folderu konta „<konto>/_eksporty/<zlecenie>.pdf” i zamyka zlecenie –
// łącznik podaje wtedy AI link do pobrania (cloudflare/api-worker.js, /eksport/…).
// Link #/p/<projekt>/eksport/<zlecenie> (od AI, gdy żadna karta nie była otwarta) robi to samo po otwarciu.

import * as chmura from '../chmura.js';
import { postep } from '../postep.js';
import { powiadom, pobierz, bezpiecznaNazwa } from '../ui.js';
import { stan, trasa } from './kontekst.js';
import { czekajNaEdytor } from './doczytaj.js';
import { wpisyProjektow, wczytajProjektZWpisu } from './projekty.js';

// Ta karta – do blokady „jedna karta robi zlecenie”.
const KARTA = `k-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
const PIERWSZENSTWO_MS = 2500; // tyle czekają karty bez otwartego projektu zlecenia
let konto = null;
let kanal = null;
let timer = null;
let sprzatniete = false;
const wToku = new Set();
let kolejka = Promise.resolve();

const rpc = async (nazwa, parametry = {}) => {
  const { data, error } = await (await chmura.supabase()).rpc(nazwa, parametry);
  if (error) throw error;
  return data;
};

// ---------- Słuchanie zleceń ----------

export async function wlaczZleceniaEksportu(uzytkownik) {
  if (!uzytkownik) { await wylaczZleceniaEksportu(); return; }
  if (konto === uzytkownik.id) return;
  await wylaczZleceniaEksportu();
  konto = uzytkownik.id;
  try {
    const sb = await chmura.supabase();
    const { data } = await sb.auth.getSession();
    if (data.session?.access_token) await sb.realtime.setAuth(data.session.access_token);
    const filtr = { schema: 'public', table: 'zlecenia_eksportu', filter: `wlasciciel=eq.${konto}` };
    kanal = sb.channel(`eksporty-${konto}`)
      .on('postgres_changes', { event: 'INSERT', ...filtr }, (z) => { if (z?.new?.id) rozwaz(z.new); })
      .subscribe((s) => { if (s === 'SUBSCRIBED') sprawdzZalegle(); });
  } catch { /* bez kanału zostaje sprawdzanie co minutę */ }
  sprawdzZalegle();
  clearInterval(timer);
  timer = setInterval(() => { if (document.visibilityState === 'visible') sprawdzZalegle(); }, 60000);
  if (!sprzatniete) { sprzatniete = true; setTimeout(() => sprzatnijWygasle().catch(() => {}), 5000); }
}

export async function wylaczZleceniaEksportu() {
  konto = null;
  clearInterval(timer);
  timer = null;
  if (!kanal) return;
  const stary = kanal;
  kanal = null;
  try { await (await chmura.supabase()).removeChannel(stary); } catch { /* już zamknięty */ }
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && konto) sprawdzZalegle(); });

async function sprawdzZalegle() {
  if (!konto || !navigator.onLine) return;
  try {
    for (const z of await rpc('eksporty_czekajace') || []) rozwaz(z);
  } catch { /* spróbujemy przy następnej okazji */ }
}

// Nowe albo zaległe zlecenie: karta z otwartym projektem zlecenia bierze je od razu, pozostałe po chwili
// (gdy tamta go nie przyjęła – np. nie ma jej wcale).
function rozwaz(z) {
  if (!z?.id || wToku.has(z.id) || (z.stan && z.stan !== 'czeka' && z.stan !== 'w_toku')) return;
  const moj = stan.projekt?.id === z.projekt_id;
  setTimeout(() => przyjmijIWykonaj(z.id), moj ? 0 : PIERWSZENSTWO_MS);
}

function przyjmijIWykonaj(id) {
  if (wToku.has(id)) return kolejka;
  wToku.add(id);
  kolejka = kolejka.then(async () => {
    try {
      const z = await rpc('przyjmij_eksport', { p_id: id, p_karta: KARTA });
      if (z) await wykonaj(z);
    } catch (e) {
      console.warn('Eksport zlecony przez AI:', e);
    } finally {
      wToku.delete(id);
    }
  });
  return kolejka;
}

// ---------- Link z odpowiedzi AI: #/p/<projekt>/eksport/<zlecenie> ----------

export async function wykonajZTrasy(id) {
  if (stan.projekt) trasa.ustaw(`p/${stan.projekt.id}`, { zastap: true });
  let z = null;
  try { z = await rpc('zlecenie_eksportu', { p_id: id }); } catch { z = null; }
  if (!z) { powiadom('Nie ma takiego zlecenia eksportu na tym koncie (może wygasło po 7 dniach).', true); return; }
  if (z.stan === 'gotowe') {
    powiadom(`Plik „${z.nazwa}” jest już gotowy – AI poda link do pobrania.`, false, { etykieta: 'Pobierz', fn: () => pobierzGotowy(z) });
    return;
  }
  if (z.stan === 'w_toku' && !(await rpc('eksporty_czekajace')).some((x) => x.id === id)) {
    powiadom('Ten eksport robi już inna karta albo urządzenie.');
    return;
  }
  // Czekające, porzucone albo nieudane w tej karcie – robimy teraz.
  await przyjmijIWykonaj(id);
}

async function pobierzGotowy(z) {
  try {
    const blob = await chmura.r2.pobierz('zasoby', `${konto || stan.uzytkownik?.id}/_eksporty/${z.id}.${z.rodzaj === 'png' ? 'png' : 'pdf'}`);
    pobierz(z.nazwa || `eksport.${z.rodzaj}`, URL.createObjectURL(blob));
  } catch (e) { powiadom(`Nie udało się pobrać pliku: ${e.message}`, true); }
}

// ---------- Robienie pliku ----------

// Projekt zlecenia: otwarty w edytorze (z tym, co jest na płótnie) albo wczytany w tle, bez pokazywania.
async function projektZlecenia(id, pasek) {
  const ed = await czekajNaEdytor(); // biblioteka płótna i kod rysowania stron
  if (stan.projekt?.id === id) {
    try { await ed.zapiszTeraz(); } catch { /* zapis na koncie nie blokuje pliku – liczy się to, co na urządzeniu */ }
    return stan.projekt;
  }
  const wpis = (await wpisyProjektow()).find((w) => w.id === id);
  if (!wpis) throw new Error('Nie ma tego projektu na liście konta.');
  pasek.opis(`AI zleciło eksport – wczytywanie „${wpis.nazwa}”…`);
  const p = await wczytajProjektZWpisu(wpis);
  if (!p) throw new Error('Nie udało się wczytać projektu.');
  const { normalizuj } = await import('../projekt.js');
  const { podlaczZasoby } = await import('../zasoby.js');
  const { zarejestrujCzcionkiProjektu } = await import('../czcionki.js');
  const projekt = normalizuj(p);
  await stan.czcionki;
  await podlaczZasoby(projekt, chmura.pobierzZasob);
  await zarejestrujCzcionkiProjektu(projekt);
  return projekt;
}

// Ustawienia ze zlecenia (narzędzie eksport_pdf w łączniku) → opcje eksportu jak z okna „Eksport do PDF”.
export function opcjePdf(projekt, u = {}) {
  const tryb = u.rodzaj === 'obraz' ? 'obraz' : 'wektor';
  const ekran = u.przeznaczenie === 'ekran';
  const uklad = ['broszura', 'skladki', 'dwie', 'cztery'].includes(u.uklad) ? u.uklad : 'zwykly';
  const pdfx = ['fogra39', 'fogra47'].includes(u.pdfx) ? u.pdfx : '';
  const znajdz = (x) => { const sz = String(x ?? '').trim().toLowerCase(); return sz ? projekt.sekcje.find((s) => s.id === x || String(s.nazwa || '').trim().toLowerCase() === sz) : null; };
  const sekcja = znajdz(u.sekcja);
  if (u.zakres === 'sekcja' && !sekcja) throw new Error(`Projekt nie ma sekcji „${u.sekcja ?? ''}”.`);
  // #312: kilka sekcji naraz (lista id albo nazw) i strony jak w Wordzie („1-5, 8, 11-”).
  const sekcje = (Array.isArray(u.sekcje) ? u.sekcje : []).map((x) => { const s = znajdz(x); if (!s) throw new Error(`Projekt nie ma sekcji „${x}”.`); return s.id; });
  if (u.zakres === 'sekcje' && !sekcje.length) throw new Error('Podaj sekcje (lista id albo nazw).');
  return {
    zakres: ['sekcja', 'sekcje', 'strony'].includes(u.zakres) ? u.zakres : 'wszystko',
    sekcja: sekcja?.id,
    sekcje,
    strony: typeof u.strony === 'string' ? u.strony : undefined,
    od: Number(u.od) || 1,
    do: Number(u.do) || Infinity,
    tryb,
    krzywe: false,
    cmyk: tryb === 'wektor' && Boolean(u.cmyk),
    pdfx,
    profilWlasny: null,
    zdjeciaCmyk: false,
    dpi: [150, 300, 600].includes(Number(u.dpi)) ? Number(u.dpi) : 300,
    spad: !ekran,
    znaki: ekran ? false : 'sekcje',
    podzial: 'jeden',
    ileStron: 50,
    dolaczCzcionki: false,
    uszlachetnienia: 'plyty',
    uklad,
    formatArkusza: ['A4', 'A3'].includes(u.formatArkusza) ? u.formatArkusza : 'auto',
    skladka: [4, 8, 16, 32].includes(Number(u.skladka)) ? Number(u.skladka) : 16,
    pelzanie: 0,
    nawigacja: ekran && !pdfx && uklad === 'zwykly',
  };
}

async function wykonaj(z) {
  const rodzaj = z.rodzaj === 'png' ? 'PNG' : 'PDF';
  const pasek = postep(`AI zleciło eksport ${rodzaj}…`, { opoznienie: 0 });
  const uid = konto || stan.uzytkownik?.id;
  try {
    const projekt = await projektZlecenia(z.projekt_id, pasek);
    pasek.opis(`AI zleciło eksport ${rodzaj} – „${projekt.nazwa}”`);
    const { rozwin } = await import('../serie.js');
    const { sprawdzProjekt } = await import('../kontrola.js');
    const ciag = rozwin(projekt);
    const u = z.ustawienia || {};
    let blob;
    let nazwa;
    let strony = 0;
    let uwagi = sprawdzProjekt(projekt, ciag).map((x) => x.opis).filter(Boolean);
    if (z.rodzaj === 'png') {
      const egz = ciag.egzemplarze.filter((e) => e.strona?.id === u.strona);
      const e = egz[Math.max(0, Math.min(egz.length - 1, (Number(u.egzemplarz) || 1) - 1))];
      if (!e) throw new Error(`Projekt nie ma strony „${u.strona ?? ''}”.`);
      const { renderujCel } = await import('../zlozenie.js');
      const dpi = Math.min(600, Math.max(72, Number(u.dpi) || 150));
      const w = e.sekcja.wydruk;
      const url = await renderujCel(projekt, e, { szerokoscPx: Math.round(((w.szerokosc_mm + 2 * w.spad_mm) / 25.4) * dpi), spad: true, ciag, oryginaly: true });
      blob = await (await fetch(url)).blob();
      nazwa = `${bezpiecznaNazwa(projekt.nazwa)}-${bezpiecznaNazwa(e.strona.nazwa || 'strona')}${egz.length > 1 ? `-${(Number(u.egzemplarz) || 1)}` : ''}.png`;
      strony = 1;
      uwagi = uwagi.slice(0, 10);
    } else {
      const { eksportujPdf } = await import('../eksport.js');
      const opcje = opcjePdf(projekt, u);
      const wynik = await eksportujPdf(projekt, { ...opcje, postep: (i, n) => pasek.krok(i, n) });
      blob = wynik.blob;
      nazwa = wynik.nazwa;
      const { wybierzEgzemplarze } = await import('../eksport.js');
      strony = wybierzEgzemplarze(ciag, opcje).length;
      for (const [powod, n] of wynik.uwagi || []) uwagi.push(`Zapisane jako obraz (${n}): ${powod}`);
      for (const [czcionka, n] of wynik.krzywe || []) uwagi.push(`Tekst jako krzywe (${n}): ${czcionka}`);
    }
    pasek.opis('AI zleciło eksport – wysyłanie pliku na konto…');
    pasek.razem(null);
    const plik = `${uid}/_eksporty/${z.id}.${z.rodzaj === 'png' ? 'png' : 'pdf'}`;
    await chmura.r2.wyslij('zasoby', plik, blob, { cache: 'private, max-age=3600' });
    await rpc('zakoncz_eksport', {
      p_id: z.id, p_karta: KARTA, p_plik: plik, p_nazwa: nazwa, p_typ: blob.type || (z.rodzaj === 'png' ? 'image/png' : 'application/pdf'),
      p_rozmiar: blob.size, p_strony: strony, p_uwagi: uwagi.slice(0, 40), p_blad: null,
    });
    powiadom(`Gotowy plik „${nazwa}” zlecony przez AI – AI dostało link do pobrania.`, false, { etykieta: 'Pobierz', fn: () => pobierz(nazwa, URL.createObjectURL(blob)) });
  } catch (e) {
    const opis = e?.message || String(e);
    try { await rpc('zakoncz_eksport', { p_id: z.id, p_karta: KARTA, p_plik: null, p_nazwa: null, p_typ: null, p_rozmiar: null, p_strony: null, p_uwagi: [], p_blad: opis }); } catch { /* zostaje w toku – inna karta przejmie po 5 min */ }
    powiadom(`Nie udało się zrobić pliku zleconego przez AI: ${opis}`, true);
  } finally {
    pasek.koniec();
  }
}

// ---------- Sprzątanie: pliki i zlecenia starsze niż 7 dni ----------

async function sprzatnijWygasle() {
  const stare = await rpc('wygasle_eksporty') || [];
  if (!stare.length) return;
  const pliki = stare.map((x) => x.plik).filter(Boolean);
  if (pliki.length) { try { await chmura.r2.usun('zasoby', pliki); } catch { /* plik mógł już zniknąć */ } }
  await rpc('usun_eksporty', { p_ids: stare.map((x) => x.id) });
}

// Do testów.
export const kartaEksportu = KARTA;
