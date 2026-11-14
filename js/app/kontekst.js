// Wspólny stan aplikacji: otwarty projekt, edytor, historia cofania i krótkie funkcje „co jest teraz otwarte”.
// Ten moduł nie zależy od pozostałych części aplikacji – wszystkie mogą z niego korzystać.

import { sekcjaStrony } from '../projekt.js';
import { Historia } from '../historia.js';
import { zamknijMenu, $$ } from '../ui.js';

export const stan = {
  uzytkownik: null,
  projekt: null,
  indeks: 0, // bieżąca strona
  tryb: 'strona', // 'strona' | 'wzorzec'
  idWzorca: null,
  zakladka: 'strony',
  miniatury: new Map(), // id strony -> dataUrl
  timerZapisu: null,
  timerChmury: null,
  konflikt: null, // id projektu czekającego na decyzję po konflikcie zapisu
  zapisywanie: Promise.resolve(),
  czcionki: null,
};

// Klucz właściciela projektów w IndexedDB.
export const wlasciciel = () => stan.uzytkownik?.id || 'lokalny';

// ======================================================================
// Pomocnicze: ekrany, powiadomienia, dialogi, menu
// ======================================================================

export function pokazEkran(nazwa) {
  document.body.dataset.ekran = nazwa;
  document.body.dataset.panel = '';
  zamknijMenu();
}

// ======================================================================
// Adresy podstron (routing w części # adresu – działa na GitHub Pages)
// ======================================================================
//
//   #/projekty                       lista projektów
//   #/konto                          ustawienia konta
//   #/admin[/<zakładka>]             panel administratora (skrzynka, kolejka, ustawienia, statystyki)
//   #/p/<id projektu>                projekt (pierwsza strona)
//   #/p/<id projektu>/s/<id strony>  konkretna strona
//   #/p/<id projektu>/w/<id wzorca>  edycja wzorca
//   #/p/<id projektu>/podglad        podgląd bez edycji
//   #/p/<id projektu>/obrazy         projekt z otwartym oknem „Obrazy projektu” (link od AI: „wrzuć zdjęcia tutaj”)
//   #/u/<konto>/<projekt>/<kod>      podgląd udostępniony linkiem (bez logowania)

export const trasa = {
  odczytaj() {
    const [rodzaj, id, typ, cel] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (rodzaj === 'p' && id) {
      return {
        ekran: 'projekt', id, strona: typ === 's' ? cel : null, wzorzec: typ === 'w' ? cel : null, podglad: typ === 'podglad', obrazy: typ === 'obrazy',
      };
    }
    if (rodzaj === 'konto') return { ekran: 'konto' };
    if (rodzaj === 'admin') return { ekran: 'admin', zakladka: id || 'skrzynka' };
    if (rodzaj === 'zaproszenie' && id) return { ekran: 'zaproszenie', kod: id };
    if (rodzaj === 'u' && id && typ && cel) return { ekran: 'udostepnione', konto: id, projekt: typ, kod: cel };
    return { ekran: 'projekty' };
  },
  // Zmiana ekranu dodaje wpis do historii (działa „Wstecz”), zmiana strony
  // w projekcie tylko podmienia adres.
  ustaw(sciezka, { zastap = false } = {}) {
    const nowy = `#/${sciezka}`;
    if (location.hash === nowy) return;
    history[zastap ? 'replaceState' : 'pushState'](null, '', nowy);
  },
};

// ======================================================================
// Edytor
// ======================================================================
//
// Edytowany „cel” to strona albo wzorzec (stan.tryb). Strona ma format swojej
// sekcji i pod spodem elementy wzorca; wzorzec ma własny rozmiar.

// Edytor powstaje dopiero wtedy, gdy aplikacja doczyta kod edytora (js/app/doczytaj.js) – ekran logowania
// i lista projektów go nie potrzebują. Do tego czasu `edytor` jest pusty; moduły edytora korzystają z niego
// dopiero po doczytaniu (js/app/edytor-instancja.js ustawia go, zanim wykonają się pozostałe).
export let edytor = null;
export function ustawEdytor(e) { edytor = e; }

export const biezacaStrona = () => stan.projekt.strony[stan.indeks];
export const biezacyWzorzec = () => stan.projekt.wzorce.find((w) => w.id === stan.idWzorca);
export const biezacyCel = () => (stan.tryb === 'wzorzec' ? biezacyWzorzec() : biezacaStrona());
export const biezacaSekcja = () => sekcjaStrony(stan.projekt, biezacaStrona());

export function wydrukCelu() {
  return stan.tryb === 'wzorzec' ? biezacyWzorzec().wydruk : biezacaSekcja().wydruk;
}

export const liczba = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

export const tenSamRozmiar = (a, b) => a.szerokosc_mm === b.szerokosc_mm && a.wysokosc_mm === b.wysokosc_mm;
export const kolor = (k) => String(k || '').toLowerCase();

// „W rozkładówkach pokazuj jedną stronę” – ustawienie urządzenia, domyślnie
// włączone na wąskim ekranie, gdzie cała rozkładówka byłaby za mała do pracy.
export const KLUCZ_JEDNA = 'seriodruk:jedna-strona';
export function jednaStrona() {
  try {
    const v = localStorage.getItem(KLUCZ_JEDNA);
    if (v !== null) return v === '1';
  } catch { /* tryb prywatny */ }
  return window.matchMedia('(max-width: 860px)').matches;
}

// ---------- Cofanie: jedna historia całego projektu (historia.js) ----------
// Krok historii powstaje chwilę po każdej zmianie – na stronie, w układzie
// stron, w sekcjach, wzorcach, stylach, seriach i tabelach.

export const historia = new Historia();

// ---------- Panele (telefon) ----------

// Stuknięcie w zakładkę otwartego panelu zamyka go. Każde otwarcie zaczyna od zwykłej wysokości arkusza
// (powiększenie uchwytem – js/app/arkusze.js – dotyczy tylko bieżącego otwarcia).
export function ustawPanel(nazwa) {
  document.body.dataset.panel = document.body.dataset.panel === nazwa ? '' : nazwa;
  document.body.dataset.arkusz = '';
  $$('.zakladki-mobilne button').forEach((b) => {
    b.classList.toggle('aktywny', b.dataset.panel === document.body.dataset.panel);
  });
}
