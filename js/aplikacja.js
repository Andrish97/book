// Plik startowy aplikacji – lekka część: logowanie, lista projektów, ustawienia konta i podgląd z linku.
// Edytor (biblioteka płótna, panele, eksport…) to osobna część, js/app/edytor-start.js: wczytuje się w tle
// po pokazaniu listy projektów, a najpóźniej przy otwarciu projektu (js/app/doczytaj.js). Dzięki temu ekran
// logowania i lista projektów nie czekają na kod, którego jeszcze nie potrzebują.
//
// Ten plik podpina przyciski wspólne dla wszystkich ekranów (data-akcja); przyciski edytora obsługuje
// tablica `akcje` z części edytora.

import './urzadzenie.js'; // najpierw: atrybuty urządzenia na <html> (zasłonki, cele dotyku)
import { wlaczLadowanieObrazow } from './obrazy-ladowanie.js';
import * as chmura from './chmura.js';
import { wstawIkony, ikona } from './ikony.js';
import { $, powiadom, zamknijMenu, przelaczMenu } from './ui.js';
import { otworzMenuMotywu, odswiezPrzyciskiMotywu } from './motyw.js';
import { wlaczWlasneKontrolki } from './kontrolki.js';
import { wlaczDymki } from './dymki.js';
import { wlaczZaslonki } from './zaslonki.js';
import { wlaczPodpowiedzi } from './podpowiedzi.js';
import { wlaczPalete } from './paleta-polecen.js';
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
import { pokazUdostepniony, podgladZLinku, otworzMakieteLinku } from './app/udostepnione.js';
import { doczytajEdytor, czekajNaEdytor, edytorGotowy } from './app/doczytaj.js';
import {
  otworzWspolprace, zamknijWspolprace, kopiujLinkZaproszenia, opuscProjekt, otworzZaproszenia,
} from './app/wspolpraca.js';
import { t } from './jezyk.js';

window.addEventListener('popstate', () => przejdzDoTrasy());

// Motyw wybrany na koncie obowiązuje na każdym urządzeniu; zmiana motywu
// zapisuje się na koncie.
document.addEventListener('motyw', () => odswiezPrzyciskiMotywu((n) => ikona(n)));
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
  else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => powiadom(t('aplikacja.przegladarkaNiePozwolilaWlaczyc'), true));
}
function odswiezPelnyEkran() {
  const wlaczony = Boolean(document.fullscreenElement);
  document.querySelectorAll('[data-akcja="pelny-ekran"]').forEach((b) => {
    b.hidden = !document.fullscreenEnabled || iOS() || (zainstalowana() && !document.fullscreenElement);
    b.setAttribute('aria-pressed', String(wlaczony));
    b.title = wlaczony ? t('aplikacja.zamknijPelnyEkranEsc') : t('aplikacja.pelnyEkran');
    if (b.getAttribute('role') === 'menuitem') b.lastChild.textContent = wlaczony ? t('aplikacja.zamknijPelnyEkran') : t('aplikacja.pelnyEkran');
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
  'dostep-ai-utworz': async () => (await dostepAi()).utworzKluczAi(),
  'ai-zapisz-klucz-dostawcy': async () => (await dostepAi()).zapiszKluczDostawcy(),
  'dostep-ai-kopiuj': async () => (await dostepAi()).kopiujKluczAi(),
  'dostep-ai-kopiuj-adres': async () => (await dostepAi()).kopiujAdresAi(),
  'dostep-ai-kopiuj-polecenie': async () => (await dostepAi()).kopiujPolecenieAi(),
  'dostep-ai-kopiuj-zwykly': async () => (await dostepAi()).kopiujPolecenieZwykle(),
  'dostep-ai-zamknij': async () => (await dostepAi()).zamknijDostepAi(),
  'dodaj-klucz-ai-zamknij': async () => (await dostepAi()).zamknijDodawanie(),
  'ai-kopiuj-otworz': async () => (await dostepAi()).otworzZAsystentemKopiuj(),
  'nowy-projekt': () => otworzNowyProjekt(),
  'nowy-z-szablonu': () => otworzNowyProjekt({ szablon: true }),
  instrukcja: () => { zamknijMenu(); instrukcja.otworz(); },
  // Zestaw marki (#131D) – z ustawień konta i z edytora (Biblioteka); okno bez edytora.
  'marka-edytuj': async () => { zamknijMenu(); (await import('./marka-okno.js')).otworzMarke(); },
  'marka-zamknij': () => document.getElementById('dlg-marka')?.close(),
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
  motyw: () => { zamknijMenu(); otworzMenuMotywu(document.querySelector('[data-akcja="motyw"]'), (n) => ikona(n)); },
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
  // Makieta 3D z linku (#188) – jeden wariant, bez ustawień.
  'podglad-makieta': () => otworzMakieteLinku(),
  'makieta-zamknij': () => $('#dlg-makieta').close(),
  'makieta-pelny-ekran': async () => (await import('./app/makieta-okno.js')).przelaczPelnyEkranMakiety(),
  'makieta-plus': async () => (await import('./app/makieta-okno.js')).powiekszMakiete(1.25),
  'makieta-minus': async () => (await import('./app/makieta-okno.js')).powiekszMakiete(0.8),
  'makieta-przod': async () => (await import('./app/makieta-okno.js')).widokZPrzodu(),
  'makieta-pobierz': async () => (await import('./app/makieta-okno.js')).pobierzObrazMakiety(),
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-akcja]');
  if (b) {
    const nazwa = b.dataset.akcja;
    // Przyciski paska przeniesione na wąskim ekranie do menu ⋯ (wzorce, dane, instrukcja) zamykają menu.
    if (b.classList.contains('tylko-waski-telefon')) zamknijMenu();
    const zLinku = podgladZLinku();
    if (zLinku && akcjePodgladuZLinku[nazwa]) { e.preventDefault(); akcjePodgladuZLinku[nazwa](zLinku); return; }
    if (nazwa === 'motyw') { // menu motywu przy klikniętym przycisku; z menu ⋯ – przy jego przycisku (#205)
      e.preventDefault();
      const kotwica = b.closest('.menu') ? (b.closest('.menu-wiecej, .menu-uzytkownika')?.querySelector(':scope > button') || b) : b;
      zamknijMenu();
      otworzMenuMotywu(kotwica, (n) => ikona(n));
      return;
    }
    if (nazwa === 'jezyk') { // menu języka (#219) – jak motyw
      e.preventDefault();
      const kotwica = b.closest('.menu') ? (b.closest('.menu-wiecej, .menu-uzytkownika')?.querySelector(':scope > button') || b) : b;
      zamknijMenu();
      import('./jezyk.js').then((m) => m.otworzMenuJezyka(kotwica));
      return;
    }
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
  odswiezPrzyciskiMotywu((n) => ikona(n)); // ikona wybranego trybu motywu (#205)
  // Język interfejsu (#219): polski bez słownika, inny – słownik i tłumaczenie tego, co widać.
  import('./jezyk.js').then((m) => m.ustawJezyk(m.wybranyJezyk(), { zapamietaj: false })).catch(() => {});
  odswiezPelnyEkran();
  konto.inicjuj();

  // Link do udostępnionego podglądu działa bez logowania i bez edytora.
  if (trasa.odczytaj().ekran === 'udostepnione') {
    await pokazUdostepniony(trasa.odczytaj());
    return;
  }
  // Powrót z logowania OpenRouter (#217) – klucz dla czatu AI, adres bez kodu.
  if (/[?&]code=/.test(location.search)) import('./app/czat-ai-logowanie.js').then((m) => m.dokonczLogowanieOpenRouter()).catch(() => {});
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
      if (powrot.typ === 'signup') powiadom(t('aplikacja.kontoPotwierdzoneWitajW'));
      if (powrot.typ === 'email_change') powiadom(t('aplikacja.adresEMailZostal'));
    } else {
      pokazEkran('logowanie');
      // Link z zaproszeniem do projektu: po zalogowaniu albo założeniu konta adres zostaje i pytanie wraca.
      if (trasa.odczytaj().ekran === 'zaproszenie') konto.komunikat(t('aplikacja.maszZaproszenieDoProjektu'), true);
      // #/instrukcja bez konta: podręcznik nad ekranem logowania (#114).
      if (trasa.odczytaj().ekran === 'instrukcja') instrukcja.otworzZAdresu('#/');
    }
  } catch (e) {
    pokazEkran('logowanie');
    konto.komunikat(`Nie można połączyć się z serwerem: ${chmura.komunikatBledu(e)}`);
  }
}

// ---------- Aplikacja instalowana (PWA) ----------

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // updateViaCache: 'none' – sprawdzanie nowej wersji zawsze pyta serwer (bez pamięci podręcznej HTTP).
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(pilnujNowejWersji).catch((e) => console.warn('Service worker:', e));
}

// Pliki aplikacji przychodzą z pamięci urządzenia (sw.js) – szybki start bez czekania na sieć. Nowa wersja
// po wdrożeniu włącza się sama, bez ręcznego odświeżania (#197, jak w Familiadzie: zawsze aktualna):
// * sprawdzamy ją przy uruchomieniu, przy każdym powrocie do karty/okna, po odzyskaniu sieci i co 10 minut;
// * zawsze od razu, gdy jest internet (zgłoszenie 21.11: „muszę zawsze dostawać świeżą wersję, niezależnie od
//   tego, co mam wczytane”) – także w otwartym projekcie: zmiany zapisują się najpierw, a po przeładowaniu projekt
//   i strona otwierają się z adresu, historia cofania wraca z pamięci. Tylko w trakcie pisania tekstu czeka, aż
//   pisanie się skończy (najwyżej 20 s). Bez internetu zostaje wersja z pamięci urządzenia.
function pilnujNowejWersji(rejestracja) {
  // Pierwsze uruchomienie: service worker dopiero przejmuje stronę (to jeszcze nie nowa wersja) – bez
  // przeładowania; kolejne wersje w tej samej sesji już tak.
  let przejmuje = !navigator.serviceWorker.controller;
  let przeladowano = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (przejmuje) { przejmuje = false; return; }
    if (przeladowano) return;
    przeladowano = true;
    location.reload();
  });
  let czeka = null;
  let wlaczana = false;
  const wlacz = async () => {
    if (!czeka || wlaczana) return;
    wlaczana = true;
    try { await edytorGotowy()?.zapiszTeraz(); } catch { /* zapis i tak trafił do pamięci urządzenia */ }
    czeka.postMessage('wlacz-nowa-wersje');
  };
  const zaproponuj = (sw) => {
    if (!navigator.serviceWorker.controller) return; // pierwsza instalacja – włączy się sama
    czeka = sw;
    if (!stan.projekt) { wlacz(); return; }
    powiadom('Wczytuję nową wersję aplikacji – zmiany są zapisane.', false);
    const start = Date.now();
    const kiedyMozna = () => {
      const pisze = window.seriodruk?.edytor?.canvas?.getActiveObject?.()?.isEditing;
      if (!pisze || Date.now() - start > 20000) wlacz(); else setTimeout(kiedyMozna, 1000);
    };
    kiedyMozna();
  };
  if (rejestracja.waiting) zaproponuj(rejestracja.waiting);
  pokazWersje();
  rejestracja.addEventListener('updatefound', () => {
    const nowy = rejestracja.installing;
    nowy?.addEventListener('statechange', () => { if (nowy.state === 'installed') zaproponuj(nowy); });
  });
  let ostatnio = 0;
  const sprawdz = () => {
    if (Date.now() - ostatnio < 30000) return;
    ostatnio = Date.now();
    rejestracja.update().catch(() => {});
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sprawdz();
    else if (czeka) wlacz(); // karta w tle – dobra chwila na nową wersję
  });
  window.addEventListener('focus', sprawdz);
  window.addEventListener('online', sprawdz);
  setInterval(() => { ostatnio = 0; sprawdz(); }, 10 * 60 * 1000);
  // Powrót do listy projektów (projekt zamknięty) – czekająca wersja włącza się od razu.
  setInterval(() => { if (czeka && !stan.projekt) wlacz(); }, 2000);
}

// Numer wersji (wdrożenia) w ustawieniach: z nazwy pamięci kodu service workera (seriodruk-kod-<wersja>).
async function pokazWersje() {
  const el = document.getElementById('wersja-aplikacji');
  if (!el || !('caches' in window)) return;
  try {
    const kod = (await caches.keys()).filter((k) => k.startsWith('seriodruk-kod-')).map((k) => k.slice(14));
    const w = kod.find((x) => x !== 'rozwoj') || kod[0];
    if (w) el.textContent = `Wersja aplikacji: ${w === 'rozwoj' ? 'robocza' : w.slice(0, 7)}`;
  } catch { /* bez pamięci – bez numeru */ }
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
wlaczLadowanieObrazow(); // obrazy: migoczące tło w czasie ładowania, bez ikonki „zepsutego obrazu” (#193)
wlaczDymki();
// Okna dialogowe na telefonie i tablecie wyjeżdżają od dołu jako zasłonki z uchwytem (js/zaslonki.js).
wlaczZaslonki();
wlaczPodpowiedzi();
wlaczPalete();
wlaczInstalacje();

// Koniec uruchamiania (#170): ekran startowy znika dopiero, gdy pierwszy ekran jest gotowy (lista projektów
// albo otwarta i narysowana strona) – dwie klatki później, żeby przeglądarka zdążyła go pokazać.
function zakonczStart() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.remove('startuje');
    const p = document.querySelector('#ekran-start .ciche');
    if (p) p.textContent = t('aplikacja.wczytywanie');
  }));
}
setTimeout(zakonczStart, 20000); // na wszelki wypadek – nigdy nie zostaje zasłonięta na zawsze

start().catch((e) => {
  console.error(e);
  pokazEkran('logowanie');
  konto.komunikat(`Błąd startu: ${e.message}`);
}).finally(zakonczStart);
