// Plik startowy aplikacji – lekka część: logowanie, lista projektów, ustawienia konta i podgląd z linku.
// Edytor (biblioteka płótna, panele, eksport…) to osobna część, js/app/edytor-start.js: wczytuje się w tle
// po pokazaniu listy projektów, a najpóźniej przy otwarciu projektu (js/app/doczytaj.js). Dzięki temu ekran
// logowania i lista projektów nie czekają na kod, którego jeszcze nie potrzebują.
//
// Ten plik podpina przyciski wspólne dla wszystkich ekranów (data-akcja); przyciski edytora obsługuje
// tablica `akcje` z części edytora.

import './urzadzenie.js'; // najpierw: atrybuty urządzenia na <html> (zasłonki, cele dotyku)
import * as chmura from './chmura.js';
import { wstawIkony } from './ikony.js';
import { $, powiadom, zamknijMenu, przelaczMenu } from './ui.js';
import { przelaczMotyw } from './motyw.js';
import { wlaczWlasneKontrolki } from './kontrolki.js';
import { wlaczDymki } from './dymki.js';
import { wlaczZaslonki } from './zaslonki.js';
import { wlaczPodpowiedzi } from './podpowiedzi.js';
import { wlaczInstalacje, zainstaluj, odlozInstalacje, iOS, zainstalowana } from './instalacja.js';
import { zaladujCzcionki } from './czcionki.js';
import { stan, trasa, ustawPanel, pokazEkran, edytor } from './app/kontekst.js';
import {
  otworzNowyProjekt, doProjektow, wczytajPlikProjektu, plikiDoOtwarcia, otworzOczekujacePliki, pokazProjekty,
} from './app/projekty.js';
import { przejdzDoTrasy } from './app/trasy.js';
import { wyloguj, konto, odswiezNaglowek, poZalogowaniu } from './app/logowanie.js';
import { wylaczNaZywo } from './app/na-zywo.js';
import { instrukcja } from './app/instrukcja-leniwa.js';
import { pokazUdostepniony, podgladZLinku } from './app/udostepnione.js';
import { doczytajEdytor, czekajNaEdytor, edytorGotowy } from './app/doczytaj.js';
import {
  otworzWspolprace, zamknijWspolprace, kopiujLinkZaproszenia, opuscProjekt, otworzZaproszenia,
} from './app/wspolpraca.js';

window.addEventListener('popstate', () => przejdzDoTrasy());

// Motyw wybrany na koncie obowiązuje na każdym urządzeniu; zmiana motywu
// zapisuje się na koncie.
document.addEventListener('motyw', async (e) => {
  const u = stan.uzytkownik;
  if (!u || u.user_metadata?.motyw === e.detail.wybor) return;
  u.user_metadata = { ...u.user_metadata, motyw: e.detail.wybor };
  try { await chmura.zapiszMotyw(e.detail.wybor); } catch { /* zostaje na urządzeniu */ }
});

// ---------- Pełny ekran ----------
// Cała aplikacja bez pasków przeglądarki. Przycisk pokazuje się tylko tam, gdzie przeglądarka
// na to pozwala: nie na iPhonie i iPadzie (tam pełny ekran daje zainstalowanie aplikacji – #99) i nie
// w aplikacji zainstalowanej (ona już nie ma pasków). Także na ekranie logowania – inaczej po wylogowaniu
// w trybie pełnoekranowym na Androidzie nie było jak z niego wyjść.
function przelaczPelnyEkran() {
  zamknijMenu();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => powiadom('Przeglądarka nie pozwoliła włączyć pełnego ekranu.', true));
}
function odswiezPelnyEkran() {
  const wlaczony = Boolean(document.fullscreenElement);
  document.querySelectorAll('[data-akcja="pelny-ekran"]').forEach((b) => {
    b.hidden = !document.fullscreenEnabled || iOS() || (zainstalowana() && !document.fullscreenElement);
    b.setAttribute('aria-pressed', String(wlaczony));
    b.title = wlaczony ? 'Zamknij pełny ekran (Esc)' : 'Pełny ekran';
    if (b.getAttribute('role') === 'menuitem') b.lastChild.textContent = wlaczony ? 'Zamknij pełny ekran' : 'Pełny ekran';
    else b.setAttribute('aria-label', b.title);
    b.querySelector(':scope > svg.ikona')?.remove();
    b.dataset.ikona = wlaczony ? 'zwin-ekran' : 'pelny-ekran';
  });
  wstawIkony();
}
document.addEventListener('fullscreenchange', odswiezPelnyEkran);

// ---------- Przyciski (data-akcja) ----------

// Okno kluczy AI (js/app/dostep-ai.js) – działa w edytorze i w ustawieniach konta, bez wczytywania edytora.
const dostepAi = () => import('./app/dostep-ai.js');
const akcje = {
  'konto-dostep-ai': async () => (await dostepAi()).otworzDostepAi(),
  'dostep-ai-utworz': async () => (await dostepAi()).utworzKluczAi(),
  'dostep-ai-kopiuj': async () => (await dostepAi()).kopiujKluczAi(),
  'dostep-ai-kopiuj-adres': async () => (await dostepAi()).kopiujAdresAi(),
  'dostep-ai-zamknij': async () => (await dostepAi()).zamknijDostepAi(),
  'nowy-projekt': otworzNowyProjekt,
  instrukcja: () => instrukcja.otworz(0),
  'zamknij-instrukcje': () => instrukcja.zamknij(),
  wyloguj: () => wyloguj(false),
  'ustawienia-konta': () => { zamknijMenu(); trasa.ustaw('konto'); przejdzDoTrasy(); },
  // Panel administratora i formularz kontaktowy (decyzja #95).
  'panel-admina': () => { zamknijMenu(); trasa.ustaw('admin'); przejdzDoTrasy(); },
  kontakt: () => { zamknijMenu(); import('./app/kontakt.js').then((m) => m.otworzKontakt()); },
  'kontakt-zamknij': () => $('#dlg-kontakt').close(),
  'admin-odswiez': () => import('./app/admin.js').then((m) => m.odswiez()),
  'importuj-projekt': () => { zamknijMenu(); $('#plik-projekt').click(); },
  'do-projektow': doProjektow,
  motyw: () => { zamknijMenu(); przelaczMotyw(); },
  'pelny-ekran': () => przelaczPelnyEkran(),
  zainstaluj: () => { zamknijMenu(); zainstaluj(); },
  'zainstaluj-pozniej': () => odlozInstalacje(),
  // Współpraca między kontami (js/app/wspolpraca.js).
  wspolpraca: () => { zamknijMenu(); otworzWspolprace(stan.projekt); },
  'wspolpraca-zamknij': () => zamknijWspolprace(),
  'wspolpraca-kopiuj': () => kopiujLinkZaproszenia(),
  'wspolpraca-opusc': () => opuscProjekt(),
  zaproszenia: () => otworzZaproszenia(),
  'zaproszenia-zamknij': () => $('#dlg-zaproszenia').close(),
  'zaproszenie-pozniej': () => $('#dlg-zaproszenie').close(),
};

// Podgląd otwarty z linku ma własny, lekki podgląd (bez edytora).
const akcjePodgladuZLinku = {
  'podglad-plus': (p) => p.powieksz(1.25),
  'podglad-minus': (p) => p.powieksz(0.8),
  'podglad-dopasuj': (p) => p.dopasuj(),
  'podglad-prezentacja': (p) => p.prezentuj(),
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-akcja]');
  if (b) {
    const nazwa = b.dataset.akcja;
    // Przyciski paska przeniesione na wąskim ekranie do menu ⋯ (wzorce, dane, instrukcja) zamykają menu.
    if (b.classList.contains('tylko-waski-telefon')) zamknijMenu();
    const zLinku = podgladZLinku();
    if (zLinku && akcjePodgladuZLinku[nazwa]) { e.preventDefault(); akcjePodgladuZLinku[nazwa](zLinku); return; }
    if (akcje[nazwa]) { e.preventDefault(); akcje[nazwa](); return; }
    const modul = edytorGotowy();
    if (modul?.akcje[nazwa]) { e.preventDefault(); modul.akcje[nazwa](); return; }
    // Przycisk edytora kliknięty, zanim edytor zdążył się wczytać – akcja zaczeka na niego.
    if (!modul && !zLinku) czekajNaEdytor().then((m) => m.akcje[nazwa]?.()).catch(() => {});
    return;
  }
  const z = e.target.closest('.zakladki-mobilne [data-panel]');
  if (z) ustawPanel(z.dataset.panel);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') zamknijMenu(); });

$('#awatar').addEventListener('click', (e) => przelaczMenu(e.currentTarget, $('#menu-uzytkownika')));
$('#plik-projekt').addEventListener('change', async (e) => {
  const plik = e.target.files[0];
  if (plik) await wczytajPlikProjektu(plik);
  e.target.value = '';
});

// Dokument nie ma się przewijać (ekrany przewijają się w środku). Przeglądarka
// na telefonie potrafi go jednak przesunąć sama, np. gdy fokus dostaje pole
// tekstowe – a użytkownik nie ma jak go cofnąć. Wracamy wtedy na miejsce.
function dokumentNaMiejsce() {
  const pole = document.activeElement;
  if (pole && /^(INPUT|TEXTAREA|SELECT)$/.test(pole.tagName)) return; // klawiatura ekranowa w użyciu
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  if (document.body.scrollTop || document.body.scrollLeft) { document.body.scrollTop = 0; document.body.scrollLeft = 0; }
}
window.addEventListener('scroll', dokumentNaMiejsce, { passive: true });
document.body.addEventListener('scroll', dokumentNaMiejsce, { passive: true });
document.addEventListener('focusout', () => setTimeout(dokumentNaMiejsce, 150));

// ======================================================================
// Start
// ======================================================================

async function start() {
  wstawIkony();
  odswiezPelnyEkran();
  konto.inicjuj();

  // Link do udostępnionego podglądu działa bez logowania i bez edytora.
  if (trasa.odczytaj().ekran === 'udostepnione') {
    await pokazUdostepniony(trasa.odczytaj());
    return;
  }
  stan.czcionki = zaladujCzcionki();

  if (!chmura.chmuraSkonfigurowana()) {
    pokazEkran('logowanie');
    return;
  }
  // Adres prowadzi prosto do projektu (odświeżona strona edytora): edytor zaczyna się wczytywać od razu,
  // równolegle z logowaniem.
  if (trasa.odczytaj().ekran === 'projekt') doczytajEdytor().catch(() => {});
  // Powrót z linku w e-mailu (potwierdzenie konta, reset hasła, zmiana adresu)
  // odczytujemy, zanim biblioteka Supabase wyczyści adres.
  const powrot = konto.odczytajPowrot();
  try {
    if (powrot.tokenHash) {
      try { await chmura.potwierdzLink(powrot.tokenHash, powrot.typ); } catch (e) {
        powrot.blad = /expired|invalid|otp/i.test(`${e.kod || ''} ${e.message || ''}`)
          ? 'Ten link już wygasł albo został użyty. Poproś o nowy.'
          : chmura.komunikatBledu(e);
      }
    }
    await chmura.naZmianeSesji((uzytkownik, zdarzenie) => {
      if (zdarzenie === 'SIGNED_OUT') {
        wylaczNaZywo();
        if (!['logowanie', 'start'].includes(document.body.dataset.ekran)) {
          stan.uzytkownik = null;
          stan.projekt = null;
          konto.ustawTryb('logowanie');
          pokazEkran('logowanie');
        }
      } else if (uzytkownik && stan.uzytkownik && uzytkownik.id === stan.uzytkownik.id) {
        // Odświeżony token albo zmienione dane konta (np. potwierdzony nowy e-mail).
        stan.uzytkownik = uzytkownik;
        odswiezNaglowek();
        if (document.body.dataset.ekran === 'konto') konto.wypelnijUstawienia();
      }
    });
    const uzytkownik = await chmura.biezacyUzytkownik();
    if (powrot.blad) {
      pokazEkran('logowanie');
      konto.komunikat(powrot.blad);
    } else if ((powrot.typ === 'recovery' || powrot.typ === 'invite') && uzytkownik) {
      stan.uzytkownik = uzytkownik;
      konto.ustawTryb('nowe-haslo');
      pokazEkran('logowanie');
    } else if (uzytkownik) {
      await poZalogowaniu(uzytkownik); // otwiera adres z paska (np. odświeżony projekt)
      if (powrot.typ === 'signup') powiadom('Konto potwierdzone. Witaj w Makietce!');
      if (powrot.typ === 'email_change') powiadom('Adres e-mail został zmieniony.');
    } else {
      pokazEkran('logowanie');
      // Link z zaproszeniem do projektu: po zalogowaniu albo założeniu konta adres zostaje i pytanie wraca.
      if (trasa.odczytaj().ekran === 'zaproszenie') konto.komunikat('Masz zaproszenie do projektu. Zaloguj się albo załóż konto – zaraz potem je przyjmiesz.', true);
    }
  } catch (e) {
    pokazEkran('logowanie');
    konto.komunikat(`Nie można połączyć się z serwerem: ${chmura.komunikatBledu(e)}`);
  }
}

// ---------- Aplikacja instalowana (PWA) ----------

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').then(pilnujNowejWersji).catch((e) => console.warn('Service worker:', e));
}

// Pliki aplikacji przychodzą z pamięci urządzenia (sw.js), więc nowa wersja po wdrożeniu czeka, aż ją
// włączymy. Bez otwartego projektu włączamy ją od razu (strona przeładowuje się w ułamku sekundy, bo pliki
// są już pobrane); w trakcie pracy w projekcie pokazujemy przycisk „Odśwież”.
function pilnujNowejWersji(rejestracja) {
  if (!navigator.serviceWorker.controller) return; // pierwsze uruchomienie – nie ma czego podmieniać
  let przeladowano = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (przeladowano) return;
    przeladowano = true;
    location.reload();
  });
  const wlacz = (sw) => sw.postMessage('wlacz-nowa-wersje');
  const zaproponuj = (sw) => {
    if (!stan.projekt) { wlacz(sw); return; }
    powiadom('Jest nowa wersja aplikacji.', false, { etykieta: 'Odśwież', fn: async () => { await edytorGotowy()?.zapiszTeraz(); wlacz(sw); } });
  };
  if (rejestracja.waiting) zaproponuj(rejestracja.waiting);
  rejestracja.addEventListener('updatefound', () => {
    const nowy = rejestracja.installing;
    nowy?.addEventListener('statechange', () => { if (nowy.state === 'installed') zaproponuj(nowy); });
  });
  // Długo otwarta karta też dowie się o nowej wersji.
  setInterval(() => rejestracja.update().catch(() => {}), 60 * 60 * 1000);
}

if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async (params) => {
    for (const uchwyt of params.files || []) plikiDoOtwarcia.push(await uchwyt.getFile());
    if (stan.uzytkownik) otworzOczekujacePliki();
  });
}

// Dostęp z konsoli, dla testów i skryptu zrzutów ekranu. Część edytora dopisuje tu swoje funkcje,
// gdy się wczyta; do tego czasu funkcje edytora same go doczytują.
window.seriodruk = {
  stan, instrukcja, poZalogowaniu, pokazProjekty, doczytajEdytor,
  otworzProjekt: async (...a) => (await czekajNaEdytor()).otworzProjekt(...a),
  przejdzDoStrony: async (i) => (await czekajNaEdytor()).przejdzDoStrony(i),
  zapiszTeraz: async () => edytorGotowy()?.zapiszTeraz(),
};
Object.defineProperty(window.seriodruk, 'edytor', { get: () => edytor, configurable: true });

// Listy rozwijane, wybór koloru i daty, sprawdzanie formularzy (js/kontrolki.js) oraz dymki z podpowiedziami
// (js/dymki.js) rysuje aplikacja, nie system.
wlaczWlasneKontrolki();
wlaczDymki();
// Okna dialogowe na telefonie i tablecie wyjeżdżają od dołu jako zasłonki z uchwytem (js/zaslonki.js).
wlaczZaslonki();
wlaczPodpowiedzi();
wlaczInstalacje();

start().catch((e) => {
  console.error(e);
  pokazEkran('logowanie');
  konto.komunikat(`Błąd startu: ${e.message}`);
});
