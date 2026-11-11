// Zmiany na żywo między urządzeniami zalogowanymi na to samo konto.
//
// Każdy zapis projektu na koncie rozchodzi się kanałem powiadomień (Supabase Realtime, js/chmura.js).
// Urządzenie z otwartym tym samym projektem od razu pobiera zmianę i ją dołącza (js/app/zapis.js:
// sprawdzKonto); lista projektów odświeża się sama. Gdy kanał nie działa (sieć firmowa, uśpiona karta),
// zostaje zapas: sprawdzenie numeru wersji przy powrocie do karty, po odzyskaniu sieci i co pół minuty.

import * as chmura from '../chmura.js';
import { $ } from '../ui.js';
import { stan } from './kontekst.js';
import { sprawdzKonto } from './zapis.js';
import { pokazProjekty } from './projekty.js';

const CO_BEZ_KANALU = 30000; // ms między sprawdzeniami, gdy kanał nie działa
const CO_Z_KANALEM = 120000; // z działającym kanałem – tylko na wszelki wypadek

let dla = null; // identyfikator konta, dla którego słuchamy
let polaczony = false;
let timer = null;
let timerListy = null;
let ostatniaLista = 0;

// Lista projektów: odświeżenie bez migania, nie częściej niż co dwie sekundy i nie pod otwartym menu.
function odswiezListe() {
  clearTimeout(timerListy);
  timerListy = setTimeout(() => {
    if (stan.projekt || !stan.uzytkownik || document.body.dataset.ekran !== 'projekty') return;
    if ($('dialog[open]') || $('#siatka-projektow .menu:not([hidden])')) { odswiezListe(); return; }
    ostatniaLista = Date.now();
    pokazProjekty({ cicho: true });
  }, Math.max(300, 2000 - (Date.now() - ostatniaLista)));
}

function naZmiane(z) {
  if (stan.projekt) {
    if (z.id === stan.projekt.id) sprawdzKonto({ wersja: z.wersja });
  } else odswiezListe();
}

// Zapas bez kanału: pytanie konta o numer wersji otwartego projektu albo odświeżenie listy.
function sprawdzTeraz() {
  if (!stan.uzytkownik || document.visibilityState !== 'visible' || !navigator.onLine) return;
  if (stan.projekt) sprawdzKonto(); else odswiezListe();
}

function zaplanujSprawdzanie() {
  clearTimeout(timer);
  if (!dla) return;
  timer = setTimeout(() => { sprawdzTeraz(); zaplanujSprawdzanie(); }, polaczony ? CO_Z_KANALEM : CO_BEZ_KANALU);
}

// Włącza słuchanie dla zalogowanego konta; bez konta – wyłącza.
export async function wlaczNaZywo(uzytkownik) {
  if (!uzytkownik) { await wylaczNaZywo(); return; }
  if (dla === uzytkownik.id) return;
  dla = uzytkownik.id;
  polaczony = false;
  zaplanujSprawdzanie();
  try {
    await chmura.sluchajZmian(uzytkownik, naZmiane, (dziala) => {
      const wrocil = dziala && !polaczony;
      polaczony = dziala;
      zaplanujSprawdzanie();
      if (wrocil) sprawdzTeraz(); // po przerwie w kanale mogło nas coś ominąć
    });
  } catch { /* bez kanału zostaje sprawdzanie co pół minuty */ }
}

export async function wylaczNaZywo() {
  dla = null;
  polaczony = false;
  clearTimeout(timer);
  clearTimeout(timerListy);
  await chmura.przestanSluchac();
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sprawdzTeraz(); });
// Po odzyskaniu sieci najpierw idą na konto zmiany z tego urządzenia (js/aplikacja.js), potem sprawdzenie.
window.addEventListener('online', () => setTimeout(sprawdzTeraz, 1500));
