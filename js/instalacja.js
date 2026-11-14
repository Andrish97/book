// Instalacja aplikacji webowej (PWA) i zachęta do niej (decyzja #99) – wzorem Familiady (web/shared/js/core/pwa.js).
//
// • Android, Chrome, Edge na komputerze: przeglądarka daje zdarzenie „beforeinstallprompt” – przycisk
//   „Zainstaluj aplikację” wywołuje jej własne okno instalacji.
// • iPhone i iPad (Safari): nie ma ani instalacji ze strony, ani pełnego ekranu – przycisk otwiera okno
//   z instrukcją: Udostępnij → Do ekranu początkowego.
// • Aplikacja już zainstalowana (otwarta z ekranu początkowego): przycisków nie ma.
// Zachęta: karta nad listą projektów od drugiej wizyty; „Nie teraz” chowa ją na 30 dni (pamięć urządzenia).

const KLUCZ_ODLOZONE = 'makietka:instalacja-odlozona';
const KLUCZ_WIZYTY = 'makietka:wizyty';
const ODLOZENIE_MS = 30 * 24 * 3600 * 1000;

let monit = null; // zdarzenie beforeinstallprompt

const czytaj = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const pisz = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* bez pamięci – trudno */ } };

/** Otwarta jako zainstalowana aplikacja (ekran początkowy). */
export function zainstalowana() {
  return Boolean(window.navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches || window.matchMedia?.('(display-mode: minimal-ui)').matches);
}

/** iPhone albo iPad (także iPad udający Maca) – tam strona nie zainstaluje się sama ani nie włączy pełnego ekranu. */
export function iOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const mozna = () => !zainstalowana() && (Boolean(monit) || iOS());

function odswiez() {
  const tak = mozna();
  document.documentElement.toggleAttribute('data-zainstalowana', zainstalowana());
  for (const b of document.querySelectorAll('[data-akcja="zainstaluj"]')) b.hidden = !tak;
  const karta = document.getElementById('zacheta-instalacji');
  if (karta) {
    const odlozone = Number(czytaj(KLUCZ_ODLOZONE) || 0);
    const wizyty = Number(czytaj(KLUCZ_WIZYTY) || 0);
    karta.hidden = !tak || wizyty < 2 || Date.now() - odlozone < ODLOZENIE_MS;
  }
}

/** „Zainstaluj aplikację”: okno instalacji przeglądarki albo instrukcja dla iPhone’a i iPada. */
export async function zainstaluj() {
  if (monit) {
    const m = monit;
    monit = null;
    m.prompt();
    try {
      const { outcome } = await m.userChoice;
      if (outcome !== 'accepted') pisz(KLUCZ_ODLOZONE, String(Date.now()));
    } catch { /* przeglądarka przerwała */ }
    odswiez();
    return;
  }
  const dlg = document.getElementById('dlg-instalacja-ios');
  if (dlg && !dlg.open) dlg.showModal();
}

export function odlozInstalacje() {
  pisz(KLUCZ_ODLOZONE, String(Date.now()));
  odswiez();
}

export function wlaczInstalacje() {
  pisz(KLUCZ_WIZYTY, String(Number(czytaj(KLUCZ_WIZYTY) || 0) + 1));
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // własny przycisk i zachęta zamiast paska przeglądarki
    monit = e;
    odswiez();
  });
  window.addEventListener('appinstalled', () => { monit = null; pisz(KLUCZ_ODLOZONE, null); odswiez(); });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', odswiez);
  odswiez();
}

// Dla testów: udawane zdarzenie instalacji.
export const _test = { odswiez, ustawMonit: (m) => { monit = m; odswiez(); } };
