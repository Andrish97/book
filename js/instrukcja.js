// Instrukcja obsługi: rozdziały ze zrzutami ekranu (img/instrukcja/*.png).
// Zrzuty generuje skrypt scripts/zrzuty-instrukcji.mjs – po zmianach w wyglądzie
// wystarczy go uruchomić ponownie.

import { wstawIkony } from './ikony.js';
import { SKROTY, opisKlawiszy } from './skroty.js';
import { POLA_DOKUMENTU, ZAPISY_LICZB } from './pola.js';

// Lista pól dokumentu i zapisów liczb – z tych samych tabel, z których korzysta aplikacja.
function tabelaPol() {
  const pola = POLA_DOKUMENTU.map(([nazwa, opis]) => `<tr><td><code>{${nazwa}}</code></td><td>${opis.replace(/\{[^}]+\}/g, (m) => `<code>${m}</code>`)}</td></tr>`).join('');
  const zapisy = ZAPISY_LICZB.map(([zapis, opis]) => `<tr><td><code>{nr${zapis ? `:${zapis}` : ''}}</code></td><td>${opis}</td></tr>`).join('');
  return `<h4>Pola dokumentu</h4><table class="skroty"><tbody>${pola}</tbody></table>`
    + `<h4>Zapis liczby (po dwukropku, przy każdym polu z liczbą)</h4><table class="skroty"><tbody>${zapisy}</tbody></table>`;
}

// Tabela skrótów powstaje z tej samej listy, z której działa klawiatura.
function tabelaSkrotow() {
  const grupy = [];
  for (const s of SKROTY) {
    let g = grupy.find((x) => x.nazwa === s.grupa);
    if (!g) { g = { nazwa: s.grupa, wiersze: [] }; grupy.push(g); }
    g.wiersze.push(`<tr><td>${opisKlawiszy(s).split('+').map((k) => `<kbd>${k}</kbd>`).join(' ')}</td><td>${s.opis}</td></tr>`);
  }
  return grupy.map((g) => `<h4>${g.nazwa}</h4><table class="skroty"><tbody>${g.wiersze.join('')}</tbody></table>`).join('');
}

const KLUCZ_PRZECZYTANA = 'seriodruk:instrukcja-przeczytana';

export const ROZDZIALY = [
  {
    tytul: 'Na początek',
    wstep: 'Seriodruk służy do składania publikacji z powtarzalnymi stronami: kalendarzy, planerów, notesów. Projektujesz wzory stron, a aplikacja wstawia do nich dane z arkusza i powiela strony – po jednej na każdy wiersz. Eksport gotowego PDF do druku będzie w kolejnej wersji.',
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
      '<b>Prostokąt, Elipsa, Wielokąt, Linia</b> – kształty do ramek, tła i podziałów. Wielokąt zaczyna jako trójkąt; liczbę boków zmienisz we właściwościach, tam też zrobisz z niego gwiazdę.',
      'Kształt może mieć <b>przejście kolorów</b> (gradient) zamiast jednego koloru, a każdy element – <b>cień</b> z przesunięciem i rozmyciem w mm.',
      '<b>Obraz</b> – zdjęcie lub grafika z dysku. Możesz też przeciągnąć plik na stronę. Duże zdjęcia aplikacja pokazuje w edytorze lżejszą kopią, żeby praca była płynna; do pliku PDF i PNG zawsze idzie oryginał.',
      '<b>Tabela</b> – podajesz liczbę wierszy i kolumn. Powstaje siatka linii i osobna ramka tekstu w każdej komórce: klikasz komórkę i piszesz, możesz też wstawić w niej pole z danych. Siatkę i komórki przesuwasz razem (są zaznaczone po wstawieniu; <kbd>Ctrl</kbd>+<kbd>G</kbd> łączy je na stałe w grupę).',
      'Przeciągnij element, aby go przesunąć. Kółka w rogach zmieniają rozmiar, kółko nad elementem go obraca.',
      'Przy krawędziach, marginesach, środku strony i przy innych elementach element „przykleja się” – pokazuje to różowa linia (więcej w rozdziale <b>Odległości i równe odstępy</b>).',
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
      '<b>Lista</b>: punkty, kreski albo numery przed każdym akapitem. Dalsze wiersze akapitu stoją równo pod pierwszym. Znak listy nie jest częścią treści, więc pola z danych działają bez zmian. Skróty: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>8</kbd> (punkty) i <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>7</kbd> (numery).',
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
      '<b>Obraz</b>: kliknij go dwa razy (albo <b>Kadruj przeciąganiem</b>), żeby wybrać widoczny fragment ramką – <kbd>Enter</kbd> zatwierdza, <kbd>Esc</kbd> anuluje. Do tego przycięcie liczbami, obrys, odbicie i informacja o rozdzielczości (do druku 300 dpi).',
      'Tytuły części panelu (np. <b>Cień</b>, <b>Ramka tekstu</b>) zwijają je i rozwijają. Zwinięte zostają zwinięte przy kolejnych elementach.',
    ],
  },
  {
    tytul: 'Strony',
    wstep: 'Każdą stronę projektujesz osobno. Kolejność miniatur to kolejność stron w publikacji.',
    obraz: 'strony.png',
    podpis: 'Menu strony.',
    punkty: [
      '<b>+ Strona</b> na dole panelu wstawia pustą stronę za bieżącą, w tej samej sekcji.',
      'Przycisk <b>⋯</b> na miniaturze: zmiana nazwy, duplikowanie, przesuwanie, usuwanie.',
      'Kolejność zmienisz też <b>przeciągając miniaturę</b> myszą; upuszczona w innej sekcji strona przechodzi do niej.',
      'Usunięcie albo przesunięcie strony cofniesz przyciskiem <b>Cofnij</b> w komunikacie na dole ekranu albo <kbd>Ctrl</kbd>+<kbd>Z</kbd> – dopóki nie zmienisz czegoś na stronie.',
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
    podpis: 'Obie strony rozkładówki na jednym płótnie; niebieski pas leży przez grzbiet.',
    punkty: [
      'Marginesy są <b>lustrzane</b>: wewnętrzny przy grzbiecie, zewnętrzny przy krawędzi. Na lewej stronie wewnętrzny jest z prawej, na prawej – z lewej.',
      'Lewą i prawą stronę edytujesz <b>razem</b>, jak otwartą książkę. Nowe elementy trafiają na stronę bieżącą – wybierasz ją kliknięciem w jej obszar albo na liście stron.',
      'Element może leżeć <b>przez grzbiet</b>, np. zdjęcie albo pas na całą szerokość rozkładówki. Przeciągnij go tak, żeby zachodził na drugą stronę – na każdej stronie wydrukuje się jego część.',
      'Element należy do tej strony, na której leży jego środek. To ważne przy usuwaniu, duplikowaniu i przenoszeniu stron: element przez grzbiet idzie razem ze swoją stroną.',
      'Gruba ciemna linia to <b>grzbiet</b>. Tekstu i drobnych elementów nie kładź tuż przy nim – po zszyciu może ich nie być widać. Aplikacja ostrzega o elemencie, który tylko wystaje w pas przy grzbiecie; o takim, który świadomie leży na obu stronach, już nie.',
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
      'Numer strony: wpisz w tekście wzorca <code>{nr}</code>. Pełna lista pól, także liczby rzymskie i odwołania do innych sekcji, jest w rozdziale <b>Pola w tekście</b>.',
      'Na zwykłych stronach elementów wzorca nie da się zaznaczyć ani przesunąć. <b>Gotowe</b> na fioletowym pasku wraca do stron.',
    ],
  },
  {
    tytul: 'Dane: tabele',
    wstep: 'Dane do powielanych stron trzymasz w tabelach projektu. Tabela to arkusz: kolumny mają nazwy, a każdy wiersz to jedna powielona strona (albo jeden blok stron).',
    obraz: 'dane.png',
    podpis: 'Okno „Dane”: lista tabel z lewej, edytor tabeli z prawej.',
    punkty: [
      'Okno otwiera przycisk <b>Dane</b> na górnym pasku edytora.',
      '<b>Importuj plik</b> wczytuje CSV albo Excel. Pierwszy wiersz pliku to nazwy kolumn. Z pliku Excela powstaje po jednej tabeli na każdy arkusz. Separator (średnik, przecinek, tabulator) i kodowanie polskich znaków aplikacja rozpoznaje sama.',
      'Wszystko jest tekstem: liczby i daty trafiają do tabeli tak, jak je widać w arkuszu. Datę najlepiej rozbić na osobne kolumny, np. <code>dzien</code>, <code>miesiac</code>, <code>rok</code>.',
      'Tabelę możesz <b>poprawiać w aplikacji</b>: kliknij komórkę i pisz. <kbd>Enter</kbd> przechodzi wiersz niżej, <kbd>Shift</kbd>+<kbd>Enter</kbd> robi nową linię w komórce. <b>+ Wiersz</b> i <b>+ Kolumna</b> dodają miejsce, znak × przy wierszu albo kolumnie je usuwa.',
      'Dane skopiowane z Excela albo Arkuszy Google wklejasz od zaznaczonej komórki (<kbd>Ctrl</kbd>+<kbd>V</kbd>). Tabela sama rośnie w dół i w prawo.',
      'Nazwę kolumny zmieniasz, klikając jej nagłówek. Aplikacja poprawi tę nazwę we wszystkich tekstach projektu.',
      'Poprawiłeś dane w arkuszu? Zaimportuj plik jeszcze raz. Gdy w projekcie jest tabela o tej samej nazwie, aplikacja zapyta, czy podmienić jej dane.',
      '<b>CSV</b> pobiera tabelę jako plik – np. żeby dokończyć ją w arkuszu.',
      '<b>Pilnowanie powtórzeń</b>: znak <b>≠</b> przy nazwie kolumny oznacza, że wartości w niej nie powinny się powtarzać (np. tagi, hasła dnia). Powtórzone komórki są podświetlone na czerwono, a przed drukiem aplikacja pokaże, na których stronach ta sama wartość wypada dwa razy.',
    ],
  },
  {
    tytul: 'Pola w tekście',
    wstep: 'Pole to nazwa w nawiasach klamrowych wpisana w zwykły tekst, np. <code>{dzien}. {miesiac}</code>. Na powielonej stronie w jego miejsce wchodzi wartość z tabeli. Są też pola dokumentu – numer strony, nazwa sekcji, data – które wynikają z samego projektu, tak jak pola w Wordzie.',
    obraz: 'pola.png',
    podpis: 'Pola w edytorze mają fioletowe tło; pole, którego aplikacja nie zna – czerwone.',
    punkty: [
      'Pole wpisujesz ręcznie albo wybierasz z listy <b>Wstaw pole</b> we właściwościach tekstu. Lista zaczyna się od kolumn tabeli tej strony.',
      'Pola z tabeli działają na stronach, które należą do <b>serii</b> z tą tabelą (następny rozdział). Pola dokumentu działają wszędzie, także we wzorcach.',
      'W edytorze widzisz nazwy pól, a na miniaturze i w <b>Podglądzie</b> – prawdziwe dane.',
      'Pole o nieznanej nazwie (np. literówka) dostaje czerwone tło i trafia na listę <b>Ostrzeżenia</b>.',
      'Formatowanie fragmentu z polem zostaje przy wstawionej wartości: pogrubione <code>{dzien}</code> da pogrubioną liczbę.',
      'Gdy kolumna tabeli nazywa się tak samo jak pole dokumentu, na stronach tej tabeli wygrywa kolumna.',
    ],
    html: tabelaPol,
  },
  {
    tytul: 'Serie: powielanie stron',
    wstep: 'Seria to strona albo kilka sąsiednich stron (blok), które w wydruku powtarzają się wiele razy – np. strona dnia po jednej na każdy wiersz tabeli. W edytorze projektujesz blok raz, jako wzór.',
    obraz: 'serie.png',
    podpis: 'Podgląd: strona-wzór powielona dla kolejnych wierszy tabeli, z kolejnymi numerami stron.',
    punkty: [
      'We właściwościach strony (nic nie zaznaczone) wybierz <b>Seria → + Nowa seria…</b>. W oknie serii wskaż tabelę z danymi.',
      'Kilka stron w bloku: nadaj tę samą serię sąsiednim stronom. Powielają się razem, w swojej kolejności.',
      '<b>Ile razy powielić</b>: tyle razy, ile wierszy ma tabela, albo stałą liczbę razy (np. 12 miesięcy; dane z tabeli idą wtedy w kółko).',
      '<b>Jak czytać tabelę</b>: jeden wiersz na cały blok (kolumny np. <code>s1_tytul</code>, <code>s2_tytul</code> dla kolejnych stron bloku) albo jeden wiersz na każdą stronę bloku.',
      'Strony serii mają na liście stron fioletowy znaczek z liczbą powieleń, np. <b>×31</b>.',
      'Okno serii pokazuje, <b>jakich danych potrzebują strony</b>: wszystkie pola użyte na stronach bloku. Jeśli w tabeli brakuje kolumny, <b>Dodaj brakujące kolumny</b> dopisze je jednym kliknięciem (bez tabeli – utworzy ją z tych pól).',
      '<b>Pobierz szablon danych (Excel)</b> daje plik z kolumnami dokładnie takimi, jakich wymagają strony, razem z tym, co już jest w tabeli. Drugi arkusz, „Instrukcja”, opisuje każdą kolumnę. Wypełniony plik importujesz w oknie <b>Dane</b> – aplikacja zaproponuje podmianę danych tabeli.',
      'Powielone strony nie są zapisywane osobno – powstają na bieżąco. Po zmianie tabeli podgląd od razu pokazuje nowe dane.',
      'Numery stron liczą się po powieleniu: strona za serią 31 dni dostaje numer o 31 większy. Pole <code>{nr}</code> trzyma się ustawień numeracji sekcji, a <code>{nr_ogolny}</code> liczy wszystkie strony projektu od 1.',
      'W rozkładówkach blok o nieparzystej liczbie stron wypada na przemian po lewej i prawej. Wzorce z odbiciem lustrzanym ustawiają się wtedy same.',
    ],
  },
  {
    tytul: 'Ramka tekstu i obrazy z danych',
    wstep: 'Teksty z tabeli mają różną długość, a układ strony ma zostać taki sam. Do tego służy ramka o stałej wysokości. Obraz też może przychodzić z tabeli.',
    punkty: [
      'Zaznacz tekst i włącz <b>Stała wysokość ramki</b>. Wysokość wpisujesz w mm albo zmieniasz górnym lub dolnym uchwytem.',
      '<b>Tekst w pionie</b>: do góry, na środku albo do dołu ramki.',
      '<b>Zmniejszaj tekst, gdy się nie mieści</b>: czcionka maleje, aż tekst zmieści się w ramce, ale nie poniżej <b>najmniejszego rozmiaru</b>. Krótszy tekst wraca do rozmiaru zadanego.',
      'Tekst, który mimo to się nie mieści, jest ucinany na dolnej krawędzi ramki i trafia na listę <b>Ostrzeżenia</b>.',
      '<b>Obraz z danych</b>: wstaw dowolny obraz jako wzór (wyznacza miejsce i rozmiar), zaznacz go i wybierz <b>kolumnę z nazwą pliku</b>. Na każdej powielonej stronie pojawi się obraz o nazwie z tej kolumny, wpisany w ramkę wzoru bez zmiany proporcji.',
      'Pliki obrazów wgrywasz naraz przyciskiem <b>Wgraj obrazy do projektu</b>. W tabeli wystarczy nazwa pliku, z rozszerzeniem albo bez.',
    ],
  },
  {
    tytul: 'Kolumny i przelewanie tekstu',
    wstep: 'Dłuższy tekst może płynąć przez kilka ramek: to, co nie mieści się w pierwszej, pojawia się w następnej. Tak powstają kolumny i teksty, które zaczynają się w jednym miejscu strony, a kończą w innym.',
    obraz: 'uklad.png',
    podpis: 'Trzy połączone ramki (kolumny), listy z numerami i punktami oraz tabela. Fioletowa linia pokazuje, dokąd płynie tekst z zaznaczonej ramki.',
    punkty: [
      '<b>Podziel na kolumny</b> (2, 3 albo 4) we właściwościach tekstu zamienia ramkę na kolumny obok siebie i rozkłada tekst po równo.',
      '<b>Dodaj ramkę z ciągiem dalszym</b> tworzy drugą ramkę – obok, a gdy się nie mieści, pod spodem. Przesuń ją, gdzie chcesz.',
      'Dwie istniejące ramki połączysz, zaznaczając je razem i wybierając <b>Połącz ramki tekstu</b>. Tekst płynie z góry na dół, a w ramkach leżących obok siebie – od lewej.',
      'O tym, ile tekstu zostaje w ramce, decyduje jej <b>wysokość</b>. Zmień ją uchwytem albo liczbą, a tekst ułoży się od nowa. Ostatnia ramka bierze całą resztę; jeśli i tam się nie mieści, zobaczysz ostrzeżenie.',
      'Piszesz w dowolnej z ramek. W trakcie pisania tekst zostaje na miejscu, a po wyjściu z ramki przelewa się dalej.',
      'Wygląd tekstu (czcionka, rozmiar, kolor, wyrównanie, lista) jest wspólny dla połączonych ramek. Pogrubienia i kolory fragmentów wędrują razem z tekstem.',
      'Pola z danych działają jak zwykle: na każdej powielonej stronie tekst przelewa się osobno, zależnie od długości wartości z tabeli.',
      'Usunięcie jednej z ramek nie usuwa tekstu – wraca on do pozostałych. <b>Rozłącz ramki</b> zostawia każdą ramkę z jej częścią tekstu.',
      'Ramki łączysz w obrębie jednej strony albo rozkładówki. Kopia połączonej ramki jest zwykłą, niepołączoną ramką.',
    ],
  },
  {
    tytul: 'Eksport do PDF',
    wstep: 'Plik PDF do drukarni albo do obejrzenia: wszystkie strony w kolejności wydruku, razem z powieleniami serii. Znajdziesz go w menu <b>⋯</b> w edytorze.',
    obraz: 'pdf.png',
    podpis: 'Okno eksportu: zakres, przeznaczenie, jakość, podział na pliki i lista rzeczy do sprawdzenia.',
    punkty: [
      '<b>Zakres</b>: cały projekt, bieżąca sekcja albo strony od–do (kolejne numery stron w całym wydruku).',
      '<b>Do drukarni</b>: każda strona ma spad dookoła, a sekcje z włączonymi znakami cięcia dostają znaki cięcia. Plik zawiera informację o formacie po obcięciu i o spadzie, którą odczytują programy drukarni. <b>Do oglądania</b>: strony równo do formatu, bez spadu i znaków.',
      '<b>Jakość</b>: 300 dpi to standard do druku; 150 dpi daje mały plik na próbę; 600 dpi – bardzo ostry tekst kosztem rozmiaru pliku.',
      '<b>Podział na pliki</b>: jeden plik, osobny plik dla każdej sekcji albo części po zadanej liczbie stron. Kilka plików dostajesz w jednym archiwum ZIP.',
      'Zdjęcia idą w pełnej jakości, niezależnie od lżejszych kopii używanych w edytorze.',
      '<b>Do sprawdzenia przed drukiem</b>: lista uwag do całego projektu – pola bez wartości, brakujące pliki obrazów, powtórzone wartości w pilnowanych kolumnach, niepełny ostatni blok serii. Uwagi nie blokują eksportu.',
      'Strony w pliku są obrazami w kolorach RGB. Zamianę na CMYK robi drukarnia; jeśli wymaga tekstu „w krzywych” albo CMYK w pliku, zapytaj ją o przyjmowane formaty.',
      'Długi eksport możesz przerwać przyciskiem <b>Przerwij</b>.',
    ],
  },
  {
    tytul: 'Podgląd',
    wstep: 'Podgląd pokazuje cały projekt tak, jak będzie wyglądał po przycięciu – bez linii pomocniczych i bez możliwości przypadkowej zmiany.',
    obraz: 'podglad.png',
    podpis: 'Podgląd: rozkładówki obok siebie, z numerami stron z wzorca.',
    punkty: [
      'Otwórz go przyciskiem <b>Podgląd</b> na górnym pasku edytora albo z menu <b>⋯</b> projektu na liście.',
      '<b>Prezentacja</b> pokazuje jedną stronę albo rozkładówkę naraz na całym ekranie. Strzałki i spacja przewracają strony, <kbd>Esc</kbd> zamyka. Działa także w podglądzie otwartym z linku.',
      'Podgląd pokazuje projekt po powieleniu: każdą stronę serii tyle razy, ile wynika z danych, z jej numerem i podpisem „3 z 31”.',
      'Strony idą po kolei, rozkładówki stoją obok siebie. Przyciski <b>−</b> i <b>+</b> zmieniają powiększenie, kliknięcie liczby dopasowuje do okna.',
      'Kliknięcie strony otwiera ją w edytorze. <b>Edytor</b> albo <kbd>Esc</kbd> wraca do edycji.',
    ],
  },
  {
    tytul: 'Udostępnianie linkiem',
    wstep: 'Podgląd możesz pokazać komuś, kto nie ma konta – np. klientowi albo drukarni – wysyłając link.',
    obraz: 'udostepnianie.png',
    podpis: 'Okno „Udostępnij podgląd” z gotowym linkiem.',
    punkty: [
      'W podglądzie kliknij <b>Udostępnij</b>, potem <b>Utwórz link</b>. Aplikacja przygotuje obrazy wszystkich stron – przy dużym projekcie chwilę to potrwa.',
      'Skopiuj link i wyślij go. Osoba z linkiem widzi strony tak jak w podglądzie; nie może nic zmienić i nie ma dostępu do reszty Twoich projektów.',
      'Link pokazuje projekt <b>w stanie z chwili udostępnienia</b>. Po zmianach okno powie, że link jest nieaktualny – kliknij <b>Aktualizuj</b>. Adres zostaje ten sam, a wysyłane są tylko strony, które się zmieniły.',
      '<b>Wyłącz link</b> usuwa udostępnione strony; stary adres przestaje działać.',
      'Link jest długi i losowy, więc nie da się go zgadnąć – ale każdy, kto go dostanie, może go przekazać dalej.',
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
    tytul: 'Siatka, linijki i prowadnice',
    wstep: 'Narzędzia do równego układania elementów. Włączasz je przyciskiem z kratką w prawym dolnym rogu płótna.',
    obraz: 'siatka.png',
    podpis: 'Siatka co 5 mm, linijki i dwie własne prowadnice (turkusowe).',
    punkty: [
      '<b>Siatka</b>: linie co zadany krok w mm, liczone od rogu strony. <b>Przyciągaj do siatki</b> sprawia, że lewy górny róg przesuwanego elementu staje na linii siatki.',
      '<b>Linijki</b> pokazują milimetry; zero leży w rogu strony, na której pracujesz.',
      '<b>Prowadnica</b>: przeciągnij z górnej linijki w dół (pozioma) albo z lewej w prawo (pionowa). Prowadnicę można przesunąć; wyciągnięta poza stronę znika. Prowadnice zapisują się razem ze stroną.',
      'Elementy przyciągają się do prowadnic, marginesów, krawędzi i środka strony.',
      'Przytrzymaj <kbd>Ctrl</kbd> przy przeciąganiu, żeby na chwilę wyłączyć przyciąganie.',
      'Siatka i prowadnice nie są drukowane. Klawisz <kbd>W</kbd> chowa wszystkie linie pomocnicze.',
    ],
  },
  {
    tytul: 'Odległości i równe odstępy',
    wstep: 'Podczas przesuwania elementu aplikacja pokazuje, jak leży względem innych – tak jak inteligentne linie pomocnicze w programach Adobe.',
    obraz: 'odleglosci.png',
    podpis: 'Trzeci kwadrat w równym odstępie od drugiego: oba odstępy mają tę samą liczbę na fioletowym tle.',
    punkty: [
      '<b>Różowa linia</b> pojawia się, gdy krawędź albo środek elementu zrównuje się z innym elementem. Element sam „wskakuje” na tę linię.',
      '<b>Strzałki z liczbą</b> pokazują odległość w mm do najbliższego elementu z lewej, prawej, z góry i z dołu.',
      '<b>Równe odstępy</b>: gdy odstęp od sąsiada jest taki sam jak inny odstęp w tym rzędzie (albo element stoi dokładnie na środku między sąsiadami), obie strzałki dostają fioletową etykietę.',
      'Przytrzymaj <kbd>Alt</kbd> przy zaznaczonym elemencie, żeby zobaczyć jego odległości także do krawędzi strony.',
      'Przyciąganie do elementów wyłączysz w menu z kratką.',
    ],
  },
  {
    tytul: 'Warstwy',
    wstep: 'Zakładka „Warstwy” obok listy stron pokazuje wszystkie elementy otwartej strony, od leżącego na wierzchu do leżącego na spodzie.',
    obraz: 'warstwy.png',
    podpis: 'Lista warstw: oko ukrywa element, kłódka go blokuje.',
    punkty: [
      'Kliknięcie nazwy zaznacza element – przydatne, gdy leży pod innym i trudno w niego trafić.',
      'Przeciągnij wiersz wyżej albo niżej, żeby zmienić kolejność warstw.',
      '<b>Oko</b> ukrywa element. Ukryty element zostaje w projekcie, ale nie jest drukowany.',
      '<b>Kłódka</b> blokuje położenie i rozmiar.',
      'Podwójne kliknięcie nazwy pozwala ją zmienić.',
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
      '<b>Cofnij</b> i <b>Ponów</b> (<kbd>Ctrl</kbd>+<kbd>Z</kbd>) obejmują cały projekt: zmiany na stronach i wzorcach, dodawanie i usuwanie stron, sekcje, style, dane i serie. Po cofnięciu edytor otwiera stronę, której dotyczyła zmiana. Historia sięga 80 kroków wstecz i kończy się z zamknięciem projektu.',
      'Na konto wysyłane są tylko te strony, które się zmieniły – duży projekt zapisuje się tak samo szybko jak mały.',
      '<b>Eksport</b> zapisuje cały projekt do pliku <code>.seriodruk</code> (kopia zapasowa), <b>Importuj</b> wczytuje go z powrotem, <b>Duplikuj</b> tworzy kopię projektu, np. na kolejny rok.',
      'W edytorze menu <b>⋯</b> eksportuje projekt do <b>PDF</b> (osobny rozdział) i pobiera bieżącą stronę jako obraz PNG w 300 dpi, ze spadem.',
      'Czcionki i silnik edytora są częścią aplikacji – nie są pobierane z zewnętrznych serwerów, więc edytor działa także bez internetu.',
      'Każdy ekran ma własny adres – odświeżenie zostawia Cię w tym samym miejscu, a „Wstecz” w przeglądarce wraca do poprzedniego ekranu.',
    ],
  },
  {
    tytul: 'Skróty klawiszowe',
    wstep: 'Skróty są takie jak w programach do składu i grafiki. <kbd>Ctrl</kbd> na Macu to <kbd>⌘</kbd>. Tę listę otwiera klawisz <kbd>?</kbd>.',
    html: tabelaSkrotow,
    rada: 'Skróty z literami działają, gdy kursor nie stoi w polu formularza. W trakcie pisania tekstu na stronie działają skróty z grupy „Tekst”.',
  },
  {
    tytul: 'Co będzie dalej',
    wstep: 'Edytor, dane, powielanie stron i eksport do PDF działają. Co jeszcze przed nami:',
    punkty: [
      '<b>Własna poczta</b>: wiadomości z potwierdzeniem konta i resetem hasła z własnej domeny.',
      '<b>PDF z tekstem wektorowym i CMYK</b>: dziś strony w pliku są obrazami RGB w wybranej rozdzielczości.',
      '<b>Tekst płynący między stronami</b>: dziś ramki łączysz w obrębie strony albo rozkładówki.',
      '<b>Biblioteka gotowych układów stron</b>.',
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

  otworzRozdzial(tytul) {
    this.otworz(Math.max(0, ROZDZIALY.findIndex((r) => r.tytul === tytul)));
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
    if (r.html) html.push(r.html());
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
