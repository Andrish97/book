// Instrukcja obsługi: rozdziały ze zrzutami ekranu (img/instrukcja/*.png).
// Zrzuty generuje skrypt scripts/zrzuty-instrukcji.mjs – po zmianach w wyglądzie
// wystarczy go uruchomić ponownie.

import { wstawIkony } from './ikony.js';

const KLUCZ_PRZECZYTANA = 'seriodruk:instrukcja-przeczytana';

export const ROZDZIALY = [
  {
    tytul: 'Na początek',
    wstep: 'Seriodruk służy do składania publikacji z powtarzalnymi stronami: kalendarzy, planerów, notesów. Projektujesz wzory stron, a w kolejnych wersjach aplikacja wstawi do nich dane z arkusza i złoży gotowy PDF do druku.',
    obraz: 'projekty.png',
    podpis: 'Lista projektów po zalogowaniu.',
    punkty: [
      'Projekt to jedna publikacja – np. „Kalendarz 2027”. Karta pokazuje pierwszą stronę i datę ostatniej zmiany.',
      'Każda zmiana zapisuje się sama – nie ma przycisku „Zapisz”.',
      'Menu <b>⋯</b> na karcie projektu: podgląd, zmiana nazwy, duplikowanie, eksport do pliku, usunięcie. <b>Importuj</b> wczytuje projekt z pliku <code>.seriodruk</code>.',
      'Instrukcję otworzysz w każdej chwili przyciskiem <b>Instrukcja</b> albo <b>?</b> w edytorze.',
    ],
  },
  {
    tytul: 'Konto: logowanie i rejestracja',
    wstep: 'Projekty są zapisane na koncie i dostępne na każdym urządzeniu. Konto zakładasz adresem e-mail i hasłem.',
    obraz: 'rejestracja.png',
    podpis: 'Zakładanie konta – wymagania hasła zaznaczają się podczas pisania.',
    punkty: [
      '<b>Nowe konto</b>: wpisz e-mail i dwa razy hasło. Hasło musi mieć co najmniej 8 znaków, małą i wielką literę, cyfrę i znak specjalny.',
      'Na podany adres przyjdzie wiadomość z przyciskiem <b>Potwierdź konto</b>. Dopiero po kliknięciu można się zalogować. Wiadomość można wysłać ponownie po minucie.',
      '<b>Nie pamiętasz hasła?</b> – podaj e-mail, a dostaniesz link do ustawienia nowego hasła.',
      'Link z wiadomości działa jeden raz. Jeśli wygasł, aplikacja o tym powie – poproś wtedy o nowy.',
    ],
  },
  {
    tytul: 'Ustawienia konta',
    wstep: 'Kliknij kółko z inicjałem w prawym górnym rogu listy projektów i wybierz „Ustawienia konta”. Ustawienia są pogrupowane; lista po lewej przenosi do wybranej grupy.',
    obraz: 'konto.png',
    podpis: 'Ustawienia konta z rozwiniętą zmianą adresu e-mail.',
    punkty: [
      '<b>Profil</b> – nazwa widoczna w prawym górnym rogu.',
      '<b>Logowanie</b> – <b>Zmień adres</b> i <b>Zmień hasło</b> rozwijają formularz w swoim wierszu. Po zmianie adresu na nowy przychodzi link potwierdzający; do kliknięcia logujesz się dotychczasowym.',
      '<b>Urządzenia</b> – wylogowanie tutaj albo na wszystkich urządzeniach naraz.',
      '<b>Usuwanie konta</b> – usuwa konto i wszystkie projekty. Jeśli chcesz je zachować, najpierw wyeksportuj je do plików.',
    ],
  },
  {
    tytul: 'Jasny i ciemny motyw',
    wstep: 'Aplikacja ma dwa motywy. Wybór dotyczy urządzenia, na którym go ustawiasz.',
    obraz: 'motyw.png',
    podpis: 'Ciemny motyw w ustawieniach konta.',
    punkty: [
      'W <b>Ustawieniach konta → Wygląd</b> wybierz: <b>Jak w systemie</b> (zmienia się razem z ustawieniem urządzenia), <b>Jasny</b> albo <b>Ciemny</b>.',
      'Szybki przełącznik – ikona półkola – jest na ekranie logowania, na liście projektów i w menu <b>⋯</b> edytora.',
      'Strony publikacji zawsze są pokazywane na białym papierze. Ciemny motyw zmienia tylko interfejs wokół nich.',
    ],
  },
  {
    tytul: 'Nowy projekt',
    wstep: 'Projekt to cała publikacja: sekcje, wzorce i wszystkie strony.',
    obraz: 'nowy-projekt.png',
    podpis: 'Okno „Nowy projekt”.',
    punkty: [
      'Wpisz nazwę i wybierz format – kafelki pokazują proporcje strony. <b>Własny</b> pozwala wpisać dowolny wymiar w milimetrach.',
      '<b>Spad</b> to pas za krawędzią strony, który drukarnia odcina. Zwykle 3 mm.',
      '<b>Marginesy</b> wyznaczają bezpieczny obszar na teksty.',
      '<b>Układ stron</b>: pojedyncze strony albo rozkładówki (lewa + prawa, jak w książce).',
      'Projekt zaczyna od jednej sekcji „Główna”. Kolejne sekcje, np. okładkę o innym rozmiarze, dodasz w edytorze.',
    ],
  },
  {
    tytul: 'Edytor – przegląd',
    wstep: 'Po otwarciu projektu widzisz edytor. Ma trzy części:',
    obraz: 'edytor.png',
    podpis: 'Edytor na tablecie w poziomie.',
    punkty: [
      '<b>1. Strony i wzorce</b> (z lewej) – lista stron pogrupowana w sekcje oraz zakładka wzorców.',
      '<b>2. Strona</b> (pośrodku) – tu układasz elementy. Na górze pasek <b>Wstaw</b>, w prawym dolnym rogu powiększenie i linie pomocnicze.',
      '<b>3. Właściwości</b> (z prawej) – ustawienia zaznaczonego elementu albo strony, gdy nic nie jest zaznaczone.',
      'Górny pasek: powrót do projektów, nazwa projektu, stan zapisu, cofanie, <b>Podgląd</b>, sekcja i jej format, instrukcja, menu <b>⋯</b>.',
    ],
  },
  {
    tytul: 'Wstawianie elementów',
    wstep: 'Pasek nad stroną wstawia nowe elementy na stronę.',
    obraz: 'wstawianie.png',
    podpis: 'Zaznaczony tekst z uchwytami.',
    punkty: [
      '<b>Tekst</b> – kliknij dwa razy, aby pisać bezpośrednio na stronie, albo wpisz treść w polu <b>Treść</b> po prawej.',
      '<b>Prostokąt, Elipsa, Linia</b> – kształty do ramek, tła i podziałów.',
      '<b>Obraz</b> – zdjęcie lub grafika z dysku. Możesz też przeciągnąć plik na stronę.',
      'Przeciągnij element, aby go przesunąć. Kółka w rogach zmieniają rozmiar, kółko nad elementem go obraca.',
      'Przy krawędziach, marginesach i środku strony element „przykleja się” – pokazuje to różowa linia.',
    ],
  },
  {
    tytul: 'Tekst i style',
    wstep: 'Właściwości tekstu są w panelu z prawej. Rozmiar czcionki podajesz w punktach, pozostałe wymiary w milimetrach.',
    obraz: 'wlasciwosci.png',
    podpis: 'Właściwości tekstu ze stylem „Tytuł”.',
    punkty: [
      '<b>Styl tekstu</b> to zapisany wygląd, np. „Tytuł” albo „Podpis”. Nadaj go tekstom, które mają wyglądać tak samo.',
      'Gdy zmienisz tekst ze stylem, pojawi się <b>Aktualizuj styl</b> – kliknięcie zmienia wszystkie teksty z tym stylem w całym projekcie. <b>Przywróć</b> wraca do wyglądu ze stylu.',
      '<b>Nowy styl</b> zapisuje wygląd bieżącego tekstu pod własną nazwą.',
      'Czcionka, rozmiar, kolor, interlinia, <b>odstęp liter</b> (w tysięcznych wysokości pisma), pogrubienie, kursywa, podkreślenie, przekreślenie, wyrównanie, wielkość liter.',
      'Aby zmienić tylko część tekstu, kliknij go dwa razy, zaznacz fragment i użyj tych samych ustawień – panel pokaże „Zmieniasz tylko zaznaczony fragment”.',
    ],
  },
  {
    tytul: 'Położenie, wyrównanie, schowek',
    wstep: 'Poniżej ustawień wyglądu każdy element ma dokładne położenie i narzędzia do układania.',
    obraz: 'wyrownanie.png',
    podpis: 'Kilka zaznaczonych elementów: wyrównanie do siebie i równe odstępy.',
    punkty: [
      '<b>Położenie i rozmiar</b>: dokładne X, Y, szerokość, wysokość i obrót.',
      '<b>Wyrównaj</b>: jeden element wyrównuje się do marginesów strony, kilka zaznaczonych – do siebie. Przy trzech i więcej dochodzą <b>równe odstępy</b>.',
      'Kilka elementów zaznaczysz, przeciągając prostokąt po pustym miejscu strony albo klikając z wciśniętym Shift. Możesz je też <b>zgrupować</b>.',
      '<b>Kolejność</b> przenosi element nad lub pod inne.',
      '<b>Zablokuj położenie i rozmiar</b> chroni element przed przypadkowym przesunięciem.',
      'Ikony nad panelem: <b>kopiuj do schowka</b>, duplikuj, usuń. Skopiowany element wkleisz na innej stronie przyciskiem <b>Wklej</b> we właściwościach strony (albo <kbd>Ctrl</kbd>+<kbd>V</kbd>) – trafi w to samo miejsce.',
      '<b>Obraz</b>: przycięcie z każdej strony, obrys, odbicie i informacja o rozdzielczości (do druku 300 dpi).',
    ],
  },
  {
    tytul: 'Strony',
    wstep: 'Każdą stronę projektujesz osobno. Kolejność miniatur to kolejność stron w publikacji.',
    obraz: 'strony.png',
    podpis: 'Menu strony.',
    punkty: [
      '<b>+ Strona</b> na dole panelu wstawia pustą stronę za bieżącą, w tej samej sekcji.',
      'Przycisk <b>⋯</b> na miniaturze: zmiana nazwy, duplikowanie, przesuwanie (w obrębie sekcji), usuwanie.',
      'Gdy nic nie jest zaznaczone, panel z prawej pokazuje ustawienia strony: nazwę, sekcję, tło i wzorce.',
    ],
  },
  {
    tytul: 'Sekcje',
    wstep: 'Projekt dzieli się na sekcje – części o różnych ustawieniach, np. „Okładka” i „Środek”.',
    obraz: 'sekcje.png',
    podpis: 'Ustawienia sekcji.',
    punkty: [
      'Każda sekcja ma własny <b>format</b>, <b>spad</b> i cztery <b>marginesy</b>.',
      '<b>Układ stron</b>: pojedyncze albo rozkładówki. <b>Numeracja</b>: dalszy ciąg poprzedniej sekcji, od wybranego numeru albo bez numerów (np. okładka).',
      'Na liście stron sekcje są szarymi nagłówkami. Przycisk <b>⋯</b> przy nagłówku: ustawienia, dodanie strony, zmiana kolejności, usunięcie. <b>+ Sekcja</b> tworzy nową.',
      'Okładkę z grzbietem ustaw jako jedną szeroką stronę: tył + grzbiet + przód (np. 148 + 6 + 148 mm).',
      'Stronę przeniesiesz do innej sekcji w jej właściwościach (pole <b>Sekcja</b>).',
    ],
  },
  {
    tytul: 'Rozkładówki',
    wstep: 'W sekcji z układem „Rozkładówki” strony tworzą pary: lewa i prawa, jak w otwartej książce.',
    obraz: 'rozkladowki.png',
    podpis: 'Edytowana lewa strona, obok prawa strona tej samej rozkładówki.',
    punkty: [
      'Marginesy są <b>lustrzane</b>: wewnętrzny przy grzbiecie, zewnętrzny przy krawędzi. Na lewej stronie wewnętrzny jest z prawej, na prawej – z lewej.',
      'Obok edytowanej strony widać drugą stronę rozkładówki. Kliknij ją, aby przejść do jej edycji.',
      'Gruba ciemna linia to <b>grzbiet</b>. Elementów blisko grzbietu może nie być widać po zszyciu.',
      'Pierwsza strona sekcji jest zwykle prawa i stoi sama – tak jak pierwsza strona książki. Zmienisz to w ustawieniach sekcji.',
      'Na liście stron rozkładówki są pokazane parami.',
    ],
  },
  {
    tytul: 'Wzorce',
    wstep: 'Wzorzec to zestaw wspólnych elementów – tło, ramka, logo, stopka, numer strony. Rysujesz go raz, a pojawia się na wszystkich stronach, które go używają.',
    obraz: 'wzorce.png',
    podpis: 'Edycja wzorca – fioletowe tło przypomina, że to nie zwykła strona.',
    punkty: [
      'Wzorce są w zakładce <b>Wzorce</b> nad listą stron. <b>Nowy wzorzec</b> tworzy wzorzec i od razu włącza go w bieżącej sekcji.',
      'Strona może mieć <b>kilka wzorców naraz</b>, np. „tło miesiąca” i „stopka”. Sekcja ma swoje wzorce domyślne, a pojedyncza strona może mieć własny wybór.',
      'Elementy wzorca leżą <b>pod</b> treścią strony. Zaznacz element we wzorcu i włącz <b>Nad treścią strony</b>, jeśli ma ją przykrywać (ramka, znak wodny).',
      '<b>Odbijaj lustrzanie na lewych stronach</b>: element narysowany przy prawej krawędzi (np. numer strony) na lewych stronach rozkładówek przejdzie na lewą krawędź.',
      'Numer strony: wpisz w tekście wzorca <code>{nr}</code>. Działają też <code>{nr_w_sekcji}</code>, <code>{liczba_stron}</code>, <code>{sekcja}</code> i <code>{strona}</code>.',
      'Na zwykłych stronach elementów wzorca nie da się zaznaczyć ani przesunąć. <b>Gotowe</b> na fioletowym pasku wraca do stron.',
    ],
  },
  {
    tytul: 'Podgląd',
    wstep: 'Podgląd pokazuje cały projekt tak, jak będzie wyglądał po przycięciu – bez linii pomocniczych i bez możliwości przypadkowej zmiany.',
    obraz: 'podglad.png',
    podpis: 'Podgląd: rozkładówki obok siebie, z numerami stron z wzorca.',
    punkty: [
      'Otwórz go przyciskiem <b>Podgląd</b> na górnym pasku edytora albo z menu <b>⋯</b> projektu na liście.',
      'Strony idą po kolei, rozkładówki stoją obok siebie. Przyciski <b>−</b> i <b>+</b> zmieniają powiększenie, kliknięcie liczby dopasowuje do okna.',
      'Kliknięcie strony otwiera ją w edytorze. <b>Edytor</b> albo <kbd>Esc</kbd> wraca do edycji.',
    ],
  },
  {
    tytul: 'Linie i ostrzeżenia',
    wstep: 'Na stronie widać linie pomocnicze. Nie są drukowane.',
    obraz: 'ostrzezenia.png',
    podpis: 'Element wychodzący w margines i lista ostrzeżeń.',
    punkty: [
      '<b>Czerwona linia</b> – krawędź strony po przycięciu.',
      '<b>Różowy pas</b> – spad. Tła i zdjęcia, które mają sięgać krawędzi, rozciągnij aż do jego końca.',
      '<b>Niebieska przerywana</b> – margines. Teksty trzymaj wewnątrz.',
      'Element w marginesie lub poza spadem dostaje pomarańczową ramkę i trafia na listę <b>Ostrzeżenia</b>. Jeśli to celowe (np. tło na spad), kliknij <b>Wycisz</b>.',
      'Linie ukryjesz przyciskiem w prawym dolnym rogu, obok powiększenia.',
    ],
  },
  {
    tytul: 'Tablet, telefon i instalacja',
    wstep: 'Aplikacja działa w przeglądarce na tablecie, telefonie i komputerze. Można ją też zainstalować jak zwykły program.',
    obraz: 'telefon.png',
    podpis: 'Telefon: panele wysuwają się z dołu.',
    obrazWaski: true,
    punkty: [
      '<b>Jeden palec</b> – zaznaczanie i przesuwanie elementów. <b>Dwa palce</b> – przesuwanie widoku i powiększanie.',
      'Na telefonie panele <b>Strony</b>, <b>Właściwości</b> i <b>Ostrzeżenia</b> otwierasz przyciskami na dole ekranu.',
      '<b>Instalacja na Androidzie</b> (Chrome): menu ⋮ → <b>Zainstaluj aplikację</b> / <b>Dodaj do ekranu głównego</b>.',
      '<b>Instalacja na Macu</b> (Chrome lub Edge): ikona instalacji w pasku adresu. W Safari: Plik → <b>Dodaj do Docka</b>.',
      'Zainstalowana aplikacja na komputerze otwiera pliki <code>.seriodruk</code> dwuklikiem.',
    ],
  },
  {
    tytul: 'Zapis, pliki i kilka urządzeń',
    wstep: 'Zmiany zapisują się same: najpierw na urządzeniu, kilka sekund później na koncie.',
    obraz: 'menu.png',
    podpis: 'Menu projektu na liście projektów.',
    punkty: [
      'Stan zapisu widać obok nazwy projektu: <b>Zapisano</b>, <b>Zapisywanie…</b> albo <b>Offline</b> – wtedy zmiany czekają na urządzeniu.',
      'Jeśli ten sam projekt zmieniono w międzyczasie na innym urządzeniu, aplikacja nic nie nadpisze, tylko zapyta: <b>zachować wersję z tego urządzenia</b> czy <b>wczytać wersję z konta</b>.',
      '<b>Cofnij</b> i <b>Ponów</b> (<kbd>Ctrl</kbd>+<kbd>Z</kbd>) działają w obrębie bieżącej strony.',
      '<b>Eksport</b> zapisuje cały projekt do pliku <code>.seriodruk</code> (kopia zapasowa), <b>Importuj</b> wczytuje go z powrotem, <b>Duplikuj</b> tworzy kopię projektu, np. na kolejny rok.',
      'W edytorze menu <b>⋯</b> pobiera bieżącą stronę jako obraz PNG.',
      'Każdy ekran ma własny adres – odświeżenie zostawia Cię w tym samym miejscu, a „Wstecz” w przeglądarce wraca do poprzedniego ekranu.',
    ],
  },
  {
    tytul: 'Skróty klawiszowe',
    wstep: 'Przy pracy na komputerze lub z klawiaturą:',
    punkty: [
      '<kbd>T</kbd> tekst, <kbd>R</kbd> prostokąt, <kbd>E</kbd> elipsa, <kbd>L</kbd> linia',
      '<kbd>Ctrl</kbd>+<kbd>C</kbd> kopiuj, <kbd>Ctrl</kbd>+<kbd>X</kbd> wytnij, <kbd>Ctrl</kbd>+<kbd>V</kbd> wklej, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplikuj, <kbd>Delete</kbd> usuń',
      '<kbd>Ctrl</kbd>+<kbd>Z</kbd> cofnij, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> ponów',
      '<kbd>Ctrl</kbd>+<kbd>G</kbd> grupuj, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> rozgrupuj',
      'Strzałki przesuwają o 1 mm, z <kbd>Shift</kbd> o 10 mm, z <kbd>Alt</kbd> o 0,1 mm',
      '<kbd>Page Up</kbd> / <kbd>Page Down</kbd> poprzednia / następna strona',
      '<kbd>Ctrl</kbd> + kółko myszy – powiększenie, <kbd>Esc</kbd> – wyjście z podglądu',
    ],
  },
  {
    tytul: 'Co będzie dalej',
    wstep: 'Edytor stron jest gotowy. Kolejne etapy:',
    punkty: [
      '<b>Dane</b>: import CSV i Excel, pola typu <code>{dzien}. {miesiac}</code> w tekście, automatyczne zmniejszanie tekstu, który się nie mieści.',
      '<b>Powielanie</b>: zakresy stron powtarzane według wierszy arkusza, z numeracją.',
      '<b>PDF do druku</b>: spad, znaki cięcia, obrazy 300 dpi, osobne pliki dla sekcji, podział na części.',
    ],
  },
];

export class Instrukcja {
  constructor() {
    this.dlg = document.getElementById('dlg-instrukcja');
    this.spis = document.getElementById('instrukcja-rozdzialy');
    this.tresc = document.getElementById('instrukcja-tresc');
    this.numer = document.getElementById('instrukcja-numer');
    this.wstecz = document.getElementById('instrukcja-wstecz');
    this.dalej = document.getElementById('instrukcja-dalej');
    this.indeks = 0;

    ROZDZIALY.forEach((r, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<small>${i + 1}</small><span></span>`;
      b.querySelector('span').textContent = r.tytul;
      b.addEventListener('click', () => this.pokaz(i));
      li.append(b);
      this.spis.append(li);
    });
    this.wstecz.addEventListener('click', () => this.pokaz(this.indeks - 1));
    this.dalej.addEventListener('click', () => {
      if (this.indeks < ROZDZIALY.length - 1) this.pokaz(this.indeks + 1);
      else this.zamknij();
    });
    this.dlg.addEventListener('close', () => this.oznaczPrzeczytana());
    this.dlg.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') this.pokaz(this.indeks + 1);
      if (e.key === 'ArrowLeft') this.pokaz(this.indeks - 1);
    });
  }

  otworz(indeks = 0) {
    this.pokaz(indeks);
    if (!this.dlg.open) this.dlg.showModal();
    this.tresc.focus();
  }

  zamknij() {
    this.oznaczPrzeczytana(); // od razu – zdarzenie „close” przychodzi z opóźnieniem
    this.dlg.close();
  }

  pokaz(i) {
    if (i < 0 || i >= ROZDZIALY.length) return;
    this.indeks = i;
    const r = ROZDZIALY[i];
    this.spis.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
    this.spis.children[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const html = [`<h3>${r.tytul}</h3>`, `<p class="wstep">${r.wstep}</p>`];
    if (r.obraz) {
      html.push(`<figure><img src="img/instrukcja/${r.obraz}" alt="${r.podpis || ''}" loading="lazy"${r.obrazWaski ? ' style="max-width:320px"' : ''}>`
        + `${r.podpis ? `<figcaption>${r.podpis}</figcaption>` : ''}</figure>`);
    }
    if (r.punkty?.length) html.push(`<ul class="punkty">${r.punkty.map((p) => `<li>${p}</li>`).join('')}</ul>`);
    if (r.rada) html.push(`<p class="rada">${r.rada}</p>`);
    this.tresc.innerHTML = html.join('');
    this.tresc.scrollTop = 0;

    this.numer.textContent = `${i + 1} / ${ROZDZIALY.length}`;
    this.wstecz.disabled = i === 0;
    this.dalej.textContent = i === ROZDZIALY.length - 1 ? 'Zaczynamy' : 'Następny';
    wstawIkony(this.dlg);
  }

  // Pokazywana automatycznie tylko raz na konto (w tej przeglądarce).
  czyPrzeczytana(kto) {
    try { return localStorage.getItem(`${KLUCZ_PRZECZYTANA}:${kto}`) === '1'; } catch { return true; }
  }

  oznaczPrzeczytana() {
    try { localStorage.setItem(`${KLUCZ_PRZECZYTANA}:${this.kto}`, '1'); } catch { /* tryb prywatny */ }
  }

  otworzJesliNowa(kto) {
    this.kto = kto;
    if (!this.czyPrzeczytana(kto)) this.otworz(0);
  }
}
