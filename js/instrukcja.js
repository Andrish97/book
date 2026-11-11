// Instrukcja obsługi: rozdziały ze zrzutami ekranu (img/instrukcja/*.png).
// Zrzuty generuje skrypt scripts/zrzuty-instrukcji.mjs – po zmianach w wyglądzie
// wystarczy go uruchomić ponownie.

import { wstawIkony } from './ikony.js';
import { SKROTY, opisKlawiszy } from './skroty.js';
import { POLA_DOKUMENTU, ZAPISY_LICZB } from './pola.js';
import { czyCiemny } from './motyw.js';

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
    wstep: 'Seriodruk służy do składania publikacji z powtarzalnymi stronami: kalendarzy, planerów, notesów. Projektujesz wzory stron, a aplikacja wstawia do nich dane z arkusza, powiela strony – po jednej na każdy wiersz – i zapisuje gotowy plik PDF do druku.',
    obraz: 'projekty.png',
    podpis: 'Lista projektów po zalogowaniu.',
    punkty: [
      'Projekt to jedna publikacja – np. „Kalendarz 2027”. Karta pokazuje pierwszą stronę i datę ostatniej zmiany.',
      'Każda zmiana zapisuje się sama – nie ma przycisku „Zapisz”.',
      'Menu <b>⋯</b> na karcie projektu: podgląd, zmiana nazwy, duplikowanie, eksport do pliku, usunięcie. <b>Importuj</b> wczytuje projekt z pliku <code>.seriodruk</code>.',
      'Plakietka <b>Udostępniony</b> na karcie oznacza, że projekt ma czynny link do podglądu. Kliknięcie plakietki otwiera okienko z linkiem – tam go skopiujesz albo unieważnisz.',
      'Typowa kolejność pracy: nowy projekt → wzorce (wspólne tła, stopki, numery) → strony → dane i serie → podgląd → „Sprawdź przed drukiem” → PDF.',
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
      'Konto działa od razu po założeniu. Jeśli administrator włączy potwierdzanie adresu, na podany e-mail przyjdzie wiadomość z przyciskiem <b>Potwierdź konto</b> i dopiero po kliknięciu można się zalogować (wiadomość można wysłać ponownie po minucie).',
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
    wstep: 'Po otwarciu projektu widzisz edytor. Każda rzecz ma swoje miejsce:',
    obraz: 'edytor.png',
    podpis: 'Edytor: strony z lewej, strona pośrodku, właściwości i warstwy z prawej.',
    punkty: [
      '<b>Strony</b> (z lewej) – miniatury wszystkich stron, pogrupowane w sekcje. Kolejność miniatur to kolejność w publikacji.',
      '<b>Strona</b> (pośrodku) – tu układasz elementy. Nad nią pasek <b>Wstaw</b>, w prawym dolnym rogu powiększenie oraz menu siatki i linii pomocniczych.',
      '<b>Właściwości</b> i <b>Warstwy</b> (z prawej, dwie zakładki) – ustawienia zaznaczonego elementu albo strony oraz lista elementów otwartej strony. Są obok siebie, bo dotyczą tego samego: tego, co leży na otwartej stronie.',
      'Górny pasek: powrót do projektów, nazwa projektu, stan zapisu, cofanie, <b>Wzorce</b> (szablony wspólnych elementów stron), <b>Dane</b> (tabele do pól i serii), <b>Podgląd</b>, sekcja i jej format, instrukcja, menu <b>⋯</b> (PDF, PNG, sprawdzenie przed drukiem, czcionki, motyw).',
      'Listy rozwijane, wybór koloru i pola wyboru wyglądają i działają tak samo na każdym urządzeniu – rysuje je aplikacja, nie system. W długiej liście (np. czcionek) wystarczy zacząć pisać: zostają tylko pozycje zawierające wpisany fragment, bez rozróżniania wielkości liter i polskich znaków; <kbd>Backspace</kbd> cofa, <kbd>Esc</kbd> czyści szukanie. Wybór koloru ma pole barw, kod koloru, paletę i ostatnio używane kolory.',
    ],
  },
  {
    tytul: 'Wstawianie elementów',
    wstep: 'Pasek nad stroną wstawia nowe elementy na stronę.',
    obraz: 'wstawianie.png',
    podpis: 'Zaznaczony tekst z uchwytami.',
    obraz2: 'pioro.png',
    podpis2: 'Kształt narysowany piórem w trakcie edycji punktów: punkty kształtu i uchwyty łuków.',
    punkty: [
      '<b>Tekst</b> – kliknij dwa razy, aby pisać bezpośrednio na stronie, albo wpisz treść w polu <b>Treść</b> po prawej.',
      '<b>Prostokąt, Elipsa, Wielokąt, Linia</b> – kształty do ramek, tła i podziałów. Wielokąt zaczyna jako trójkąt; liczbę boków zmienisz we właściwościach, tam też zrobisz z niego gwiazdę.',
      '<b>Rysuj</b> (klawisz <kbd>B</kbd>) – rysowanie odręczne: przeciągaj po stronie, a powstanie wygładzona linia. Tryb zostaje włączony, więc możesz narysować kilka kresek; <kbd>Esc</kbd> albo ponowne kliknięcie przycisku go kończy. Narysowana linia jest zwykłym elementem: ma kolor i grubość, da się ją przesuwać, skalować i obracać.',
      '<b>Pióro</b> (klawisz <kbd>N</kbd>) – kształt z punktów. Kliknięcie stawia punkt, a kolejne punkty łączą się prostymi odcinkami. Kliknięcie z przeciągnięciem stawia punkt z łukiem: im dalej przeciągniesz, tym łagodniejszy łuk. <kbd>Enter</kbd> albo podwójne kliknięcie kończy kształt otwarty, kliknięcie w pierwszy punkt go zamyka. <kbd>Backspace</kbd> cofa ostatni punkt, <kbd>Esc</kbd> porzuca zaczęty kształt, a drugi <kbd>Esc</kbd> wyłącza pióro. Gotowy kształt jest zwykłym elementem: ma kolor i grubość linii, a zamknięty – także wypełnienie.',
      '<b>Edycja punktów</b>: kliknij dwa razy kształt z pióra albo linię narysowaną odręcznie (albo wybierz <b>Edytuj punkty</b> we właściwościach). Pojawią się punkty – przeciągaj je myszą. Zaznaczony punkt łuku pokazuje uchwyty, którymi zmieniasz wygięcie. Podwójne kliknięcie w linię dodaje punkt, <kbd>Delete</kbd> usuwa zaznaczony. <kbd>Enter</kbd> zatwierdza zmiany, <kbd>Esc</kbd> przywraca kształt sprzed edycji.',
      '<b>Wypełnienie</b> kształtu: jeden kolor, <b>gradient liniowy</b> albo <b>kołowy</b>, albo brak. Gradient może mieć dowolną liczbę kolorów – każdy ma swoje położenie w procentach; do tego kierunek (gotowy albo kąt), a w kołowym promień. Każdy element może mieć też <b>cień</b> z przesunięciem i rozmyciem w mm.',
      '<b>Obraz</b> – zdjęcie lub grafika z dysku (PNG, JPEG, WebP, GIF, SVG). Możesz też przeciągnąć plik na stronę albo <b>wkleić obraz ze schowka</b> (<kbd>Ctrl</kbd>+<kbd>V</kbd>): zrzut ekranu, obraz skopiowany ze strony internetowej albo z programu graficznego, a także kod SVG skopiowany jako tekst. Rysunek SVG jest jednym elementem – nie edytujesz jego części, ale możesz go skalować, obracać i kadrować, a po powiększeniu zostaje ostry. Duże zdjęcia aplikacja pokazuje w edytorze lżejszą kopią, żeby praca była płynna; do pliku PDF i PNG zawsze idzie oryginał.',
      '<b>Tabela</b> – podajesz liczbę wierszy i kolumn. Tabela jest jednym elementem: przesuwasz ją i obracasz w całości, a po dwukrotnym kliknięciu komórki piszesz w niej (więcej w rozdziale <b>Tabela</b>).',
      'Przeciągnij element, aby go przesunąć. Kółka w rogach zmieniają rozmiar, kółko nad elementem go obraca.',
      'Przy przesuwaniu i przy zmianie rozmiaru element „przykleja się” do krawędzi, marginesów, środka strony, prowadnic i innych elementów – pokazuje to różowa linia (więcej w rozdziale <b>Odległości i równe odstępy</b>).',
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
      'Czcionka, rozmiar, kolor, interlinia, <b>odstęp liter</b> (w tysięcznych wysokości pisma), pogrubienie, kursywa, podkreślenie, przekreślenie, wyrównanie.',
      '<b>Wielkość liter</b>: <b>AA</b> (wielkie) i <b>aa</b> (małe) zmieniają tylko wygląd – treść zostaje taka, jak ją wpisano, więc wartości z tabeli też pokażą się wielkimi literami, a po wyłączeniu wszystko wraca. <b>Aa</b> („jak w zdaniu”) zmienia samą treść.',
      '<b>Kapitaliki</b> (przycisk <b>Aᴀ</b> obok): małe litery wyglądają jak wielkie, tylko niższe, a wielkie zostają pełnej wysokości – tak składa się np. nazwiska i nagłówki. To też tylko wygląd: treść zostaje taka, jak ją wpisano, a w PDF-ie tekst da się zaznaczyć i wyszukać.',
      '<b>Lista</b>: punkty, kreski albo numery przed każdym akapitem. Dalsze wiersze akapitu stoją równo pod pierwszym. Znak listy nie jest częścią treści, więc pola z danych działają bez zmian. Skróty: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>8</kbd> (punkty) i <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>7</kbd> (numery).',
      'Aby zmienić tylko część tekstu, kliknij go dwa razy, zaznacz fragment i użyj tych samych ustawień – panel pokaże „Zmieniasz tylko zaznaczony fragment”.',
      'Tekst, który ma się zmieścić w stałym miejscu (np. dane o różnej długości), ustawisz w części <b>Ramka tekstu</b>: stała wysokość i zmniejszanie czcionki do zadanego minimum – patrz rozdział <b>Ramka tekstu i obrazy z danych</b>.',
    ],
  },
  {
    tytul: 'Czcionki',
    wstep: 'Aplikacja ma jeden oficjalny zestaw czcionek – ten sam dla wszystkich projektów i użytkowników. Okno czcionek otwiera menu <b>⋯ → Czcionki projektu</b>.',
    obraz: 'czcionki.png',
    podpis: 'Okno „Czcionki”: oficjalny zestaw aplikacji na dole, wyżej własne czcionki projektu.',
    punkty: [
      '<b>Zestaw czcionek Seriodruku</b> to 52 rodziny: bezszeryfowe do tekstu (m.in. Inter, Open Sans, Lato, Roboto, Poppins), wąskie do nagłówków (Oswald, Bebas Neue), szeryfowe (Lora, Merriweather, Playfair Display, EB Garamond…), odręczne i ozdobne (Caveat, Pacifico, Dancing Script…) oraz maszynowe. Wszystkie mają polskie znaki i licencję pozwalającą na druk komercyjny. Pełną listę z próbkami pokazuje okno czcionek.',
      'Nie każda czcionka ma wszystkie odmiany – odręczne i nagłówkowe często mają jedną grubość i nie mają kursywy. Wtedy przyciski <b>Pogrubienie</b> i <b>Kursywa</b> w panelu tekstu są wyszarzone, a po wybraniu takiej czcionki tekst wraca do odmiany zwykłej.',
      'Pliki czcionki pobierają się przy pierwszym użyciu (aplikacja nie ściąga całego zestawu na zapas), a na długiej liście czcionek wystarczy zacząć pisać nazwę, żeby ją znaleźć.',
      'Czcionki z zestawu są na liście w każdym projekcie, na każdym urządzeniu. W pliku PDF wektorowym są osadzone, więc drukarnia nie musi ich mieć.',
      '<b>Pobieranie plików</b>: przy każdej rodzinie jest <b>Pobierz pliki</b>, a pod listą <b>Pobierz cały zestaw (ZIP)</b>. Dostajesz zwykłe pliki TTF z licencją – do zainstalowania u drukarni albo grafika.',
      '<b>Czcionki razem z projektem</b>: w oknie eksportu PDF opcja <b>Dołącz pliki czcionek użytych w projekcie</b> dodaje do pobieranej paczki folder <code>czcionki</code> z plikami TTF. Zaznacza się sama, gdy plik nie ma czcionek w środku (obrazy stron albo tekst zamieniony na krzywe).',
      '<b>Własne czcionki</b> (dodatek, nie musisz z nich korzystać): na końcu listy czcionek w panelu tekstu jest <b>+ Wgraj własną czcionkę…</b>. Pliki TTF, OTF, WOFF albo WOFF2, każda odmiana osobno. Wgrana czcionka jest częścią projektu i zostaje też w „Moich czcionkach” – pod ręką w następnych projektach.',
      'Do PDF własne czcionki najlepiej wgrywać jako TTF albo OTF, z osobnym plikiem dla każdej odmiany – wtedy tekst jest w pliku prawdziwym tekstem. Czcionki z pliku WOFF2, czcionki zmiennej i kursywy, której czcionka nie ma (przeglądarka pochyla wtedy pismo proste), nie da się osadzić: taki tekst trafia do PDF jako <b>krzywe</b> – jest ostry w każdym powiększeniu, ale nie da się go zaznaczyć. Tylko pogrubienie bez własnego pliku i czcionka zmienna w pliku WOFF2 użyta w innej grubości niż podstawowa idą jako obraz. Aplikacja mówi o tym po eksporcie.',
    ],
  },
  {
    tytul: 'Położenie, wyrównanie, schowek',
    wstep: 'Poniżej ustawień wyglądu każdy element ma dokładne położenie i narzędzia do układania.',
    obraz: 'wyrownanie.png',
    podpis: 'Kilka zaznaczonych elementów: wyrównanie do siebie i równe odstępy.',
    obraz2: 'rysunek-svg.png',
    podpis2: 'U góry rysunek SVG wstawiony jako obraz, na dole ten sam po rozłożeniu na elementy: napis jest zwykłym tekstem w czcionce z zestawu, a kształt ma inny kolor.',
    punkty: [
      '<b>Położenie i rozmiar</b>: dokładne X, Y, szerokość, wysokość i obrót.',
      '<b>Wyrównaj</b>: jeden element wyrównuje się do marginesów strony, kilka zaznaczonych – do siebie. Przy trzech i więcej dochodzą <b>równe odstępy</b>.',
      'Kilka elementów zaznaczysz, przeciągając prostokąt po pustym miejscu strony albo klikając z wciśniętym Shift. Możesz je <b>zgrupować</b> (<kbd>Ctrl</kbd>+<kbd>G</kbd>) – grupa przesuwa się i skaluje jak jeden element; <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> ją rozdziela.',
      '<b>Element w grupie bez rozgrupowywania</b>: kliknij grupę dwa razy – otworzy się, a element pod kursorem będzie zaznaczony. Możesz go przesunąć, przeskalować, obrócić, zmienić we właściwościach albo napisać w nim tekst; kliknięcie innego elementu grupy zaznacza tamten. Otwartą grupę widać po pomarańczowej przerywanej ramce z podpisem. <kbd>Esc</kbd>, kliknięcie poza grupą albo przycisk <b>Wróć do całej grupy</b> zamykają ją: grupa znów jest jednym elementem, na tym samym miejscu wśród warstw, z ramką dopasowaną do nowego układu.',
      'W otwartej grupie <b>Duplikuj</b> zostawia kopię w grupie, <b>Usuń</b> usuwa tylko zaznaczone elementy, a przyciski kolejności zmieniają ją wśród elementów grupy. Skopiowany element grupy wkleja się jako osobny element strony. Blokadę i ustawienia „Z danych” ma cała grupa, nie jej element.',
      '<b>Kilka elementów grupy naraz</b>: w otwartej grupie kliknij kolejne elementy z klawiszem <kbd>Shift</kbd> albo naciśnij <kbd>Ctrl</kbd>+<kbd>A</kbd> (wszystkie elementy tej grupy). Zaznaczone przesuwasz i skalujesz razem, wyrównujesz do siebie, rozkładasz równo, kopiujesz i usuwasz. Element spoza grupy do takiego zaznaczenia nie wchodzi. <b>Zgrupuj</b> robi z zaznaczonych <b>grupę w grupie</b>.',
      '<b>Obraz w otwartej grupie</b> kadrujesz jak każdy inny – podwójnym kliknięciem albo przyciskiem <b>Kadruj przeciąganiem</b>, a <b>kształt z pióra</b> zmieniasz punkt po punkcie (podwójne kliknięcie albo <b>Edytuj punkty</b>). Na czas kadrowania i edycji punktów element jest rysowany nad swoją grupą; po zatwierdzeniu albo anulowaniu wraca na swoje miejsce wśród jej elementów.',
      '<b>Grupa w grupie</b>: podwójne kliknięcie grupy leżącej w otwartej grupie otwiera ją jako kolejny poziom – podpis ramki mówi wtedy „Grupa w grupie”, a bledsze ramki pokazują grupy nad nią. <kbd>Esc</kbd> wraca o jeden poziom, kliknięcie poza grupą zamyka wszystkie. Na liście warstw rozwinięta grupa pokazuje też zawartość grup w niej, z wcięciem; kliknięcie elementu z głębi otwiera od razu potrzebne poziomy.',
      '<b>Kolejność</b> przenosi element nad lub pod inne.',
      '<b>Zablokuj położenie i rozmiar</b> chroni element przed przypadkowym przesunięciem.',
      'Ikony nad panelem: <b>kopiuj do schowka</b>, duplikuj, usuń. Skopiowany element wkleisz na innej stronie przyciskiem <b>Wklej</b> we właściwościach strony (albo <kbd>Ctrl</kbd>+<kbd>V</kbd>) – trafi w to samo miejsce.',
      '<b>Obraz</b>: kliknij go dwa razy (albo <b>Kadruj przeciąganiem</b>), żeby wybrać widoczny fragment ramką – <kbd>Enter</kbd> zatwierdza, <kbd>Esc</kbd> anuluje. Działa także na obrazie obróconym i odbitym (na czas kadrowania obraz jest prostowany). Do tego przycięcie liczbami, obrys, odbicie i informacja o rozdzielczości (do druku 300 dpi).',
      '<b>Rysunek SVG</b> wstawia się jako obraz: wygląda wiernie, ale nic się w nim nie zmieni, a napisy przeglądarka rysuje czcionką zastępczą. <b>Rozłóż rysunek na elementy</b> (we właściwościach obrazu) zamienia go w zwykłą <b>grupę kształtów i napisów</b> w tym samym miejscu: grupę można rozgrupować, kształtom zmienić kolor, obrys i punkty, a napisy poprawić jak każdy tekst. Napis zachowuje czcionkę, jeśli jest ona w zestawie aplikacji albo wśród czcionek projektu – inną zastępuje domyślna, o czym aplikacja mówi. Napis ułożony w rysunku w kilku wierszach zostaje jedną ramką z wierszami. Zdjęcie osadzone w rysunku staje się zwykłym obrazem projektu. Jeśli obraz był przycięty, grupa jest przycięta tak samo – przycięcie zdejmuje <b>Pokaż cały rysunek</b> we właściwościach grupy (po rozgrupowaniu elementy widać w całości). Rzeczy, których edytor nie ma (filtry, maski, wzory), znikają – wtedy lepiej zostawić obraz; <kbd>Ctrl</kbd>+<kbd>Z</kbd> go przywraca.',
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
      'Gdy nic nie jest zaznaczone, panel z prawej pokazuje ustawienia strony: nazwę, sekcję, tło, wzorce, serię i prowadnice.',
      'Po zmianie kolejności stron w rozkładówkach aplikacja ostrzega, jeśli element leżący przez grzbiet trafił obok innej strony niż przedtem.',
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
    wstep: 'Wzorzec to szablon z elementami wspólnymi dla wielu stron – tło, ramka, logo, stopka, numer strony. Rysujesz go raz i dodajesz do stron albo do całej sekcji; zmiana we wzorcu zmienia wszystkie te strony naraz.',
    obraz: 'okno-wzorcow.png',
    podpis: 'Okno „Wzorce”: szablony tego projektu z przyciskami dodawania oraz wzorce standardowe.',
    punkty: [
      'Okno otwiera przycisk <b>Wzorce</b> na górnym pasku edytora (liczba obok to liczba wzorców w projekcie).',
      '<b>Wzorce w tym projekcie</b>: każdy ma miniaturę i dwa przyciski. <b>+ Dodaj do tej strony</b> włącza go na otwartej stronie, <b>+ Do całej sekcji</b> – na wszystkich stronach sekcji, które nie mają własnego wyboru. Ponowne kliknięcie (✓) go zdejmuje.',
      '<b>Edytuj</b> (albo kliknięcie miniatury) otwiera wzorzec do edycji. <b>Nowy pusty wzorzec</b> tworzy czysty szablon. Menu <b>⋯</b>: nazwa, duplikowanie, kolejność, usunięcie.',
      '<b>Wzorce standardowe</b> to gotowe szablony: numer strony na dole albo przy zewnętrznej krawędzi, stopka, nagłówek, linie do pisania, kratka, ramka, zakładka na brzegu. Dopasowują się do formatu i marginesów bieżącej sekcji. Po <b>Dodaj do projektu</b> zmieniasz je jak własne.',
      'Strona może mieć <b>kilka wzorców naraz</b>, np. „tło miesiąca” i „stopka”. Sekcja ma swoje wzorce domyślne, a pojedyncza strona może mieć własny wybór (właściwości strony → <b>Wzorce</b>).',
      'Elementy wzorca leżą <b>pod</b> treścią strony. Zaznacz element we wzorcu i włącz <b>Nad treścią strony</b>, jeśli ma ją przykrywać (ramka, znak wodny).',
      '<b>Odbijaj lustrzanie na lewych stronach</b>: element narysowany przy prawej krawędzi (np. numer strony) na lewych stronach rozkładówek przejdzie na lewą krawędź.',
      'Numer strony: wpisz w tekście wzorca <code>{nr}</code>. Pełna lista pól, także liczby rzymskie i odwołania do innych sekcji, jest w rozdziale <b>Pola w tekście</b>.',
      'Edycję wzorca poznasz po fioletowym pasku nad stroną; <b>Gotowe</b> wraca do stron. Na zwykłych stronach elementów wzorca nie da się zaznaczyć ani przesunąć – widać je na liście warstw, a kliknięcie tam otwiera wzorzec.',
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
      'Z pliku Excela (<code>.xlsx</code>) przechodzi też <b>wygląd komórek</b>: pogrubienie, kursywa i kolor liter. Komórka wygląda tak samo w oknie Dane, a na stronie jej wartość wstawiona w pole dostaje ten wygląd – np. święta pogrubione na czerwono wprost z arkusza. Przełącznik <b>Przenoś wygląd z arkusza na strony</b> nad tabelą to wyłącza. Liczy się wygląd całej komórki (jedno pogrubione słowo w komórce nie jest przenoszone), a zmienia się go w arkuszu i importuje plik ponownie; plik CSV i szablon danych wyglądu nie niosą.',
      'Wszystko jest tekstem: liczby i daty trafiają do tabeli tak, jak je widać w arkuszu. Datę najlepiej rozbić na osobne kolumny, np. <code>dzien</code>, <code>miesiac</code>, <code>rok</code>.',
      'Tabelę możesz <b>poprawiać w aplikacji</b>: kliknij komórkę i pisz. <kbd>Enter</kbd> przechodzi wiersz niżej, <kbd>Shift</kbd>+<kbd>Enter</kbd> robi nową linię w komórce. <b>+ Wiersz</b> i <b>+ Kolumna</b> dodają miejsce, znak × przy wierszu albo kolumnie je usuwa.',
      'Dane skopiowane z Excela albo Arkuszy Google wklejasz od zaznaczonej komórki (<kbd>Ctrl</kbd>+<kbd>V</kbd>). Tabela sama rośnie w dół i w prawo.',
      'Nazwę kolumny zmieniasz, klikając jej nagłówek. Aplikacja poprawi tę nazwę we wszystkich tekstach projektu.',
      'Poprawiłeś dane w arkuszu? Zaimportuj plik jeszcze raz. Gdy w projekcie jest tabela o tej samej nazwie, aplikacja zapyta, czy podmienić jej dane.',
      '<b>CSV</b> pobiera tabelę jako plik – np. żeby dokończyć ją w arkuszu.',
      'Długa tabela (tysiące wierszy) przewija się w całości – kolejne wiersze dorysowują się w miarę przewijania.',
      '<b>Pilnowanie powtórzeń</b>: znak <b>≠</b> przy nazwie kolumny oznacza, że wartości w niej nie powinny się powtarzać (np. tagi, hasła dnia). Powtórzone komórki są podświetlone na czerwono, a przed drukiem aplikacja pokaże, na których stronach ta sama wartość wypada dwa razy. Wielkość liter i zbędne spacje nie mają znaczenia: „Praca”, „praca ” i „PRACA” to ta sama wartość.',
      '<b>Lista dozwolonych wartości</b>: znak <b>☰</b> przy nazwie kolumny otwiera pole, w którym wpisujesz wartości po średniku, np. <code>praca; dom; wolne</code> (samo <code>-</code> usuwa listę). Komórki z inną wartością są podświetlone, przed drukiem aplikacja je wymieni, a w szablonie danych komórki tej kolumny dostają listę rozwijaną.',
    ],
  },
  {
    tytul: 'Pola w tekście',
    wstep: 'Pole to nazwa w nawiasach klamrowych wpisana w zwykły tekst, np. <code>{dzien}. {miesiac}</code>. Na powielonej stronie w jego miejsce wchodzi wartość z tabeli. Są też pola dokumentu – numer strony, nazwa sekcji, data – które wynikają z samego projektu, tak jak pola w Wordzie.',
    obraz: 'pola.png',
    podpis: 'Pola w edytorze mają fioletowe tło; pole, którego aplikacja nie zna – czerwone.',
    punkty: [
      'Pole najprościej wstawić z listy <b>Wstaw pole</b> we właściwościach tekstu – lista zaczyna się od kolumn tabeli tej strony, potem są pola dokumentu. Możesz je też wpisać ręcznie.',
      'Potrzebujesz <b>zwykłych klamer</b> w tekście, np. <code>{uwaga}</code> jako napisu? Zaznacz tekst i włącz <b>Klamry { } to zwykły tekst, nie pola</b> (przełącznik pojawia się, gdy w tekście są klamry). W tym tekście nic nie będzie podstawiane.',
      'Pole i zwykłe klamry <b>w jednym tekście</b>: wpisz klamry podwójnie. <code>{{</code> i <code>}}</code> w podglądzie i w PDF stają się pojedynczymi klamrami, a pola obok działają jak zwykle – np. <code>Dzień {dzien}, wzór {{x}}</code> da „Dzień 5, wzór {x}”.',
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
      '<b>Seria kończy się na ostatnim wierszu danych.</b> Przy „jednym wierszu na każdą stronę bloku” ostatnie powielenie może być niepełne: blok 8 stron i 30 wierszy dają 30 stron, nie 32. Jeśli wolisz dokończyć blok stronami bez danych, zaznacz <b>Dokończ ostatni blok</b>.',
      '<b>Dodatkowe tabele</b>: dane, które zmieniają się rzadziej niż strony serii. Przykład: strony dni biorą dane z tabeli dni, a hasło tygodnia – z tabeli tygodni, która przechodzi do następnego wiersza <b>co 7 stron</b>. Gdy pierwszy okres jest krótszy (rok zaczyna się w środę), wpisz, przez ile stron obowiązuje pierwszy wiersz.',
      'Okresy nierównej długości – np. <b>miesiące</b> (28–31 dni): na liście <b>Nowy wiersz</b> zamiast stałej liczby stron wybierz <b>gdy zmieni się kolumna…</b> i wskaż kolumnę tabeli głównej, np. <code>miesiac</code>. Tabela miesięcy przejdzie do następnego wiersza dokładnie tam, gdzie w tabeli dni zmienia się miesiąc.',
      'Gdy okres wyznaczają <b>dwie kolumny</b> – np. miesiąc i rok w kalendarzu na kilka lat – po wybraniu pierwszej kolumny pojawia się lista <b>albo kolumna</b>: wskaż w niej drugą (i kolejne). Nowy wiersz zaczyna się, gdy zmieni się wartość w <b>którejkolwiek</b> z nich, więc grudzień 2027 i grudzień 2028 to dwa osobne okresy, nawet gdy stoją obok siebie.',
      'Pole z tabeli dodatkowej wpisujesz z nazwą tabeli: <code>{Tygodnie.haslo}</code>. Sama nazwa kolumny też działa, jeśli nie ma jej w tabeli głównej. Na liście <b>Wstaw pole</b> tabele dodatkowe mają własną grupę.',
      '<b>Brak danych</b>: gdy tabeli dodatkowej zabraknie wierszy przed końcem serii, okno serii i właściwości strony pokazują to na czerwono (ile wierszy jest, ile potrzeba, od której strony pola będą puste). To samo trafia na listę uwag przed eksportem PDF.',
      'Okno serii pokazuje, <b>jakich danych potrzebują strony</b>: wszystkie pola użyte na stronach bloku. Jeśli w tabeli brakuje kolumny, <b>Dodaj brakujące kolumny</b> dopisze je jednym kliknięciem (bez tabeli – utworzy ją z tych pól).',
      '<b>Pobierz szablon danych (Excel)</b> daje plik z kolumnami dokładnie takimi, jakich wymagają strony, razem z tym, co już jest w tabeli. Drugi arkusz, „Instrukcja”, opisuje każdą kolumnę. Wypełniony plik importujesz w oknie <b>Dane</b> – aplikacja zaproponuje podmianę danych tabeli.',
      'W szablonie komórki części kolumn mają <b>listę rozwijaną</b>: kolumna z dozwolonymi wartościami (☰ w oknie Dane) – tylko te wartości; kolumna z nazwą pliku obrazu – nazwy obrazów wgranych do projektu; kolumna z kadrem – góra, dół, lewa, prawa, środek; kolumna, od której zależy widoczność elementu – sprawdzana wartość. Trzy ostatnie listy to podpowiedzi: komórka przyjmie też inną wartość (np. punkt kadru w procentach).',
      'Powielone strony nie są zapisywane osobno – powstają na bieżąco. Po zmianie tabeli podgląd od razu pokazuje nowe dane.',
      'Numery stron liczą się po powieleniu: strona za serią 31 dni dostaje numer o 31 większy. Pole <code>{nr}</code> trzyma się ustawień numeracji sekcji, a <code>{nr_ogolny}</code> liczy wszystkie strony projektu od 1.',
      'W rozkładówkach blok o nieparzystej liczbie stron wypada na przemian po lewej i prawej. Wzorce z odbiciem lustrzanym ustawiają się wtedy same.',
    ],
  },
  {
    tytul: 'Kolor i położenie z danych',
    wstep: 'Element może zmieniać kolor, miejsce albo rozmiar na kolejnych powielonych stronach. Tak robi się na przykład zakładki na brzegu strony: na każdej stronie niżej i w innym kolorze – albo słupki o wysokości z tabeli.',
    obraz: 'zakladki.png',
    podpis: 'Podgląd: ta sama zakładka na sześciu powielonych stronach – kolor z kolumny tabeli, położenie z numeru powielenia.',
    punkty: [
      'Zaznacz element i rozwiń <b>Z danych</b> we właściwościach.',
      '<b>Kolor z pola</b>: wybierz kolumnę, w której wpisane są kolory, np. <code>#d1495b</code>, <code>2e86ab</code> albo nazwę koloru po angielsku (<code>navy</code>). Pusta albo błędna wartość zostawia kolor wzoru. Linia i kształt bez wypełnienia dostają kolor obrysu.',
      'Gdy element jest wypełniony <b>przejściem kolorów</b>, przejście zostaje, a pod listą pól wybierasz, co kolor z pola w nim zmienia: <b>pierwszy kolor</b> (tak jest od razu po wybraniu pola), <b>ostatni kolor</b> albo <b>całe przejście w odcieniach</b> koloru z pola – pierwszy kolor to kolor z pola, a pozostałe są od niego jaśniejsze albo ciemniejsze tak jak we wzorze. Ostatnia możliwość, <b>całe wypełnienie</b>, zastępuje przejście jednym kolorem.',
      '<b>Przesunięcie w pionie / w poziomie z pola</b>: wybierz pole z liczbą. Może to być kolumna tabeli albo pole dokumentu, np. <code>{egzemplarz}</code> – numer powielenia serii (1, 2, 3…).',
      '<b>Wartość pola to numer pozycji</b>: element przesuwa się o <b>krok</b> (w mm) za każdą kolejną pozycję. <b>Od nowa co 6</b> znaczy, że pozycja 7 wraca na miejsce pierwszej – dwanaście miesięcy ułoży się w dwóch seriach po sześć na wysokość strony.',
      '<b>Wartość pola to przesunięcie w mm</b>: liczba z tabeli jest wprost przesunięciem względem wzoru (może być ujemna, z przecinkiem).',
      '<b>Szerokość z pola / Wysokość z pola</b>: wybierz pole z liczbą – każdy wymiar osobno. Wartość to <b>procent rozmiaru wzoru</b> (100 = bez zmian, 50 = połowa) albo <b>rozmiar w mm</b>. Lista <b>Przy zmianie rozmiaru na miejscu zostaje</b> wybiera punkt zaczepienia: lewy górny róg, środek albo dół – słupek wykresu z kotwicą „dół” rośnie w górę. Wartość 0 chowa element; pole puste albo bez liczby zostawia rozmiar wzoru.',
      'Co znaczy zmiana rozmiaru: <b>tekst</b> dostaje węższą albo szerszą ramkę i układa się od nowa (wysokość działa przy stałej wysokości ramki) – litery się nie rozciągają; <b>obraz</b> zmienia ramkę – obraz z kolumny wpisuje się w nią tak, jak ustawiono („zmieść” albo „wypełnij”), zwykły obraz ją wypełnia, a nadmiar jest przycinany; <b>tabela</b> zmienia szerokości kolumn i najmniejsze wysokości wierszy; <b>kształty i grupy</b> są skalowane.',
      '<b>Obrót z pola</b>: liczba z pola to kąt w stopniach, dodawany do obrotu wzoru. Element obraca się wokół swojego środka – np. wskazówka albo strzałka ustawiona inaczej na każdej stronie.',
      '<b>Pokaż element</b>: zawsze albo tylko wtedy, gdy wybrane pole <b>nie jest puste</b>, <b>jest puste</b> albo <b>równa się</b> wpisanej wartości (wielkość liter nie ma znaczenia). Tak robi się np. gwiazdkę przy świętach: kolumna <code>swieto</code> wypełniona tylko w niektórych wierszach i gwiazdka pokazywana „gdy pole nie jest puste”.',
      'W edytorze element stoi w miejscu pozycji 1, ma kolor, rozmiar i obrót wzoru i jest zawsze widoczny. Właściwy wygląd każdej strony widać w <b>Podglądzie</b>, na miniaturach i w PDF.',
      'Na lewych stronach rozkładówki element wzorca z odbiciem lustrzanym przesuwa się lustrzanie – zakładka trafia na zewnętrzny brzeg.',
      'Pole, którego aplikacja nie zna, trafia na listę <b>Ostrzeżenia</b>, tak jak nieznane pole w tekście.',
    ],
  },
  {
    tytul: 'Ramka tekstu i obrazy z danych',
    wstep: 'Teksty z tabeli mają różną długość, a układ strony ma zostać taki sam. Do tego służy ramka o stałej wysokości. Obraz też może przychodzić z tabeli.',
    obraz: 'ramka-tekstu.png',
    podpis: 'Ramka o stałej wysokości: tekst wyrównany do dołu, zmniejszany, gdy się nie mieści. Ustawienia są we właściwościach tekstu.',
    punkty: [
      'Zaznacz tekst i włącz <b>Stała wysokość ramki</b>. Wysokość wpisujesz w mm albo zmieniasz górnym lub dolnym uchwytem.',
      '<b>Tekst w pionie</b>: do góry, na środku albo do dołu ramki.',
      '<b>Zmniejszaj tekst, gdy się nie mieści</b>: czcionka maleje, aż tekst zmieści się w ramce, ale nie poniżej <b>najmniejszego rozmiaru</b>. Krótszy tekst wraca do rozmiaru zadanego. Fragmenty z własnym rozmiarem (np. większy tytuł w tej samej ramce) maleją razem z resztą, w tej samej proporcji, i razem z nią wracają do swojego rozmiaru.',
      'Tekst, który mimo to się nie mieści, jest ucinany na dolnej krawędzi ramki i trafia na listę <b>Ostrzeżenia</b>.',
      '<b>Obraz z danych</b>: wstaw dowolny obraz jako wzór (wyznacza miejsce i rozmiar), zaznacz go i wybierz <b>kolumnę z nazwą pliku</b>. Na każdej powielonej stronie pojawi się obraz o nazwie z tej kolumny, bez zmiany proporcji.',
      '<b>Podmieniony obraz</b> może <b>mieścić się w ramce</b> (cały widoczny, z wolnym miejscem po bokach albo u góry) albo <b>wypełniać ramkę</b> (bez pustych pasów, brzegi przycięte) – wybierz to, gdy zdjęcia mają różne proporcje, a układ ma być równy. Przy wypełnianiu wybierasz też, <b>która część zdjęcia zostaje</b>: środek, góra, dół, lewa albo prawa strona (np. „góra” przy portretach, żeby nie ucinać głów).',
      'Gdy każde zdjęcie wymaga innego przycięcia, wybierz <b>Kadr z kolumny</b>: w tej kolumnie tabeli wpisujesz dla każdego wiersza <code>góra</code>, <code>dół</code>, <code>lewa</code>, <code>prawa</code> albo <code>środek</code> (można po dwa: <code>góra lewa</code>; także bez polskich znaków i po angielsku), albo <b>punkt zdjęcia w procentach</b> od lewej i od góry, np. <code>30% 20%</code> – kadr ustawi się tak, żeby ten punkt był w środku ramki. Pusta komórka zostawia ustawienie obrazu-wzoru.',
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
      '<b>Ciąg dalszy na następnej stronie</b> tworzy ramkę na następnej stronie (gdy bieżąca jest ostatnia w sekcji – razem z nową stroną). Tekst płynie wtedy <b>przez strony</b>: dłuższe opowiadanie, regulamin albo wstęp układasz w ramkach na kolejnych stronach, a aplikacja sama pilnuje, co jest na której.',
      'Dwie istniejące ramki połączysz, zaznaczając je razem i wybierając <b>Połącz ramki tekstu</b>. Tekst płynie z góry na dół, a w ramkach leżących obok siebie – od lewej.',
      'O tym, ile tekstu zostaje w ramce, decyduje jej <b>wysokość</b>. Zmień ją uchwytem albo liczbą, a tekst ułoży się od nowa. Ostatnia ramka bierze całą resztę; jeśli i tam się nie mieści, zobaczysz ostrzeżenie.',
      'Piszesz w dowolnej z ramek, a tekst <b>przelewa się na bieżąco</b>: gdy ramka się zapełni, pisany tekst przechodzi do następnej i kursor idzie za nim; gdy coś usuniesz, tekst z następnych ramek wraca. Jeśli następna ramka jest <b>na innej stronie</b>, aplikacja sama otwiera tę stronę i piszesz dalej bez przerwy – znaki wciśnięte w chwili przejścia nie giną.',
      'Na granicy ramek klawisze działają jak w jednym tekście: <kbd>Backspace</kbd> na początku ramki usuwa znak z końca poprzedniej, <kbd>Delete</kbd> na końcu – znak z początku następnej, a strzałki w lewo i w prawo przechodzą do sąsiedniej ramki. Gdy sąsiednia ramka jest na innej stronie, działa to tak samo: aplikacja otwiera tę stronę, gdy kursor do niej trafia (strzałką albo kasując wstecz).',
      'Przy ramce połączonej z ramkami na innych stronach panel pokazuje przyciski <b>Poprzednia ramka</b> i <b>Następna ramka</b> z numerem strony – przenoszą prosto do niej.',
      'Po przestawieniu stron tekst płynący przez strony układa się w nowej kolejności stron: początek jest zawsze na wcześniejszej stronie, ciąg dalszy na późniejszej.',
      'Wygląd tekstu (czcionka, rozmiar, kolor, wyrównanie, lista) jest wspólny dla połączonych ramek. Pogrubienia i kolory fragmentów wędrują razem z tekstem.',
      'Pola z danych działają jak zwykle: na każdej powielonej stronie tekst przelewa się osobno, zależnie od długości wartości z tabeli.',
      'Usunięcie jednej z ramek nie usuwa tekstu – wraca on do pozostałych. <b>Rozłącz ramki</b> zostawia każdą ramkę z jej częścią tekstu.',
      'Zaznaczaniem łączysz ramki widoczne razem (jedna strona albo rozkładówka); między stronami łączy przycisk „Ciąg dalszy na następnej stronie”. Kopia połączonej ramki i kopia całej strony są zwykłymi, niepołączonymi ramkami. Usunięcie strony nie usuwa płynącego przez nią tekstu – wraca on do ramek na pozostałych stronach.',
      'W serii tekst płynie między stronami tego samego powielenia bloku: każde powielenie przelewa swoje dane osobno.',
    ],
  },
  {
    tytul: 'Tabela',
    wstep: 'Tabela to jeden element strony z wierszami i kolumnami. Wstawiasz ją przyciskiem <b>Tabela</b> na pasku nad stroną.',
    obraz: 'tabela.png',
    podpis: 'Tabela z tłem nagłówka, co drugim wierszem w kolorze i scaloną komórką; po prawej jej ustawienia.',
    punkty: [
      '<b>Pojedyncze kliknięcie</b> zaznacza całą tabelę – przesuwasz ją, obracasz i układasz w warstwach jak każdy inny element. Na liście warstw to jeden wiersz „Tabela”; trójkąt przy nim pokazuje jej komórki, a kliknięcie komórki na liście zaczyna w niej pisanie.',
      '<b>Podwójne kliknięcie komórki</b> zaczyna w niej pisanie. <kbd>Tab</kbd> przechodzi do następnej komórki, <kbd>Shift</kbd>+<kbd>Tab</kbd> do poprzedniej; <kbd>Tab</kbd> w ostatniej komórce dodaje nowy wiersz. Kliknięcie innej komórki przenosi tam pisanie, <kbd>Esc</kbd> kończy je i wraca do zaznaczenia całej tabeli.',
      'Komórka to zwykły tekst: wstawisz w niej <b>pole z danych</b> (np. <code>{opis}</code>), pogrubisz fragment, zmienisz czcionkę. W trakcie pisania panel z prawej pokazuje ustawienia tekstu tej komórki.',
      '<b>Wiersz rośnie razem z tekstem.</b> Gdy treść komórki nie mieści się w wysokości wiersza, cały wiersz robi się wyższy – także na stronach powielanych z danych, osobno dla każdej strony. Tekst w tabeli nigdy nie jest ucinany.',
      '<b>Szerokość kolumn</b>: przy zaznaczonej tabeli nad granicami kolumn widać niebieskie znaczniki – przeciągnij znacznik, a granica się przesunie (kolumna obok zwęża się o tyle samo; ostatni znacznik zmienia szerokość całej tabeli). Dokładne szerokości wpiszesz liczbami w panelu; <b>Równe szerokości</b> wyrównuje kolumny.',
      '<b>Wiersze i kolumny</b>: przyciski w panelu dodają i usuwają ostatni wiersz albo kolumnę. W trakcie pisania w komórce przyciski dotyczą jej wiersza i kolumny: wstaw wiersz poniżej, usuń ten wiersz, wstaw kolumnę z prawej, usuń tę kolumnę.',
      '<b>Scalanie komórek</b>: w trakcie pisania w komórce panel ma przyciski <b>Scal z komórką po prawej</b> i <b>Scal z komórką poniżej</b>. Klikając kilka razy, zrobisz komórkę na kilka kolumn albo wierszy – np. tytuł przez całą szerokość tabeli. Tekst nie znika: to, co było w dołączanych komórkach, dopisuje się do scalonej komórki jako kolejne akapity (wierszami, od lewej). <b>Rozdziel komórki</b> przywraca osobne komórki – cały tekst zostaje w pierwszej (lewej górnej), a stan sprzed scalenia przywraca <kbd>Ctrl</kbd>+<kbd>Z</kbd>. Linie siatki nie przecinają scalonej komórki, a <kbd>Tab</kbd> ją przeskakuje jak jedną.',
      'W panelu tabeli ustawisz też: <b>wiersz nagłówka</b> (pogrubiony, z grubszą linią pod spodem), kolor i grubość linii (0 = bez linii) oraz czcionkę, rozmiar, kolor i wyrównanie tekstu we wszystkich komórkach naraz.',
      '<b>Linie jednej komórki</b>: w trakcie pisania w komórce panel ma część <b>Linie tej komórki</b>. Każdą krawędź – u góry, u dołu, z lewej, z prawej – ustawiasz osobno: <b>jak w tabeli</b>, <b>bez linii</b> albo <b>własna</b> (swoja grubość i kolor). Tak zrobisz grubszą kreskę pod wierszem sumy, ramkę wokół jednej komórki albo tabelę bez linii pionowych w wybranym miejscu. Krawędź jest wspólna z sąsiednią komórką, więc zmienia się u obu; w scalonej komórce dotyczy całego jej boku. Wstawiane i usuwane wiersze i kolumny przesuwają te ustawienia razem z komórkami.',
      '<b>Linie całego wiersza, kolumny albo tabeli</b>: pod liniami komórki jest część <b>Linie wiersza, kolumny, tabeli</b>. Wybierasz, <b>do czego zastosować</b> (ten wiersz, ta kolumna, cała tabela) i <b>które linie</b> (obramowanie, wewnętrzne poziome, wewnętrzne pionowe albo wszystkie), ustawiasz kolor i grubość i klikasz <b>Ustaw te linie</b>. <b>Bez linii</b> je chowa, a <b>Jak w tabeli</b> zdejmuje własne ustawienia – linie znów wyglądają jak siatka. Przy zaznaczonej całej tabeli ta sama część nazywa się <b>Obramowanie i linie wewnętrzne</b> – tak zrobisz grubą ramkę wokół tabeli albo tabelę z samymi liniami poziomymi. To te same ustawienia co przy pojedynczej komórce, tylko nadawane wielu krawędziom naraz, więc potem każdą krawędź możesz jeszcze poprawić osobno.',
      '<b>Tło wierszy</b>: osobny kolor tła dla wiersza nagłówka i dla co drugiego wiersza treści (tabela w paski czyta się łatwiej). Oba są opcjonalne.',
      '<b>Wysokość wierszy</b>: najmniejsza wysokość wspólna dla wszystkich wierszy albo osobna dla każdego – lista wierszy w panelu tabeli, a w trakcie pisania pole „Najmniejsza wysokość tego wiersza”. Wiersz i tak urośnie, gdy tekst będzie wyższy.',
      'Narożne uchwyty zmieniają rozmiar tabeli: kolumny i wiersze dostają nowe wymiary już w trakcie przeciągania, a pismo zostaje w swoim rozmiarze.',
      'Na telefonie przycisk wstawiania tabeli jest schowany; w istniejącej tabeli szerokości kolumn, wiersze i wygląd zmienisz w panelu właściwości.',
      'Tabele wstawione w starszej wersji (siatka i osobne ramki tekstu) zostają takie, jak były.',
    ],
  },
  {
    tytul: 'Eksport do PDF',
    wstep: 'Plik PDF do drukarni albo do obejrzenia: wszystkie strony w kolejności wydruku, razem z powieleniami serii. Znajdziesz go w menu <b>⋯</b> w edytorze.',
    obraz: 'pdf.png',
    podpis: 'Okno eksportu: rodzaj pliku, zakres, przeznaczenie, opcje i lista rzeczy do sprawdzenia.',
    punkty: [
      '<b>Rodzaj pliku – Wektorowy</b> (domyślny): tekst jest prawdziwym tekstem z osadzonymi czcionkami (da się go zaznaczyć i wyszukać, jest ostry w każdym powiększeniu), kształty, linie, gradienty i rysunki odręczne są wektorami, a zdjęcia JPEG i PNG idą w oryginale – bez ponownej kompresji i tylko raz w pliku, choćby były na stu stronach.',
      '<b>Rodzaj pliku – Obrazy stron</b>: każda strona jest jednym obrazem w wybranej rozdzielczości. Wygląda identycznie wszędzie, ale tekstu nie da się zaznaczyć, a plik jest większy.',
      'Litery stoją w pliku w tych samych miejscach co na ekranie. Także <b>ligatury</b> – połączone znaki w rodzaju „fi” czy „fl”, które wiele czcionek rysuje jednym kształtem – wyglądają w PDF tak jak w edytorze, a przy zaznaczaniu i wyszukiwaniu zostają zwykłymi literami.',
      '<b>Zamień tekst na krzywe</b> (wektorowy): litery stają się kształtami. Plik nie zawiera czcionek – tego często wymagają drukarnie – ale tekstu nie da się już zaznaczyć ani poprawić.',
      '<b>Standard dla drukarni – PDF/X-4</b>: plik dostaje <b>profil barwny warunków druku</b> i oznaczenia, po których programy drukarni rozpoznają standard. Wybierasz papier: <b>powlekany</b> (kredowy – okładki, albumy; FOGRA39) albo <b>niepowlekany</b> (offsetowy – środki notesów i planerów; FOGRA47). Jeśli drukarnia podała własny profil (np. ISO Coated v2 albo PSO Coated v3), wybierz <b>profil od drukarni</b> i wskaż plik <code>.icc</code>. Profil papieru powlekanego dodaje do pliku ok. 8 MB.',
      '<b>Kolory tekstu i kształtów w CMYK</b> (wektorowy): kolory są zapisane czterema farbami drukarskimi, a czarny tekst i szarości idą samą czarną farbą – litery są wtedy ostre. Razem z PDF/X-4 kolory są przeliczane <b>przez profil</b> wybranego papieru (tak jak robią to programy do składu); bez standardu – prostym wzorem, który papieru nie zna.',
      '<b>Zdjęcia też w CMYK</b> (wektorowy z PDF/X-4): zdjęcia są przeliczane przez ten sam profil i zapisywane bez strat, w rozdzielczości z pola „Jakość” – plik wyraźnie rośnie. Bez tej opcji zdjęcia zostają w RGB z opisem sRGB i na farby przelicza je drukarnia według dołączonego profilu; to też jest zgodne z PDF/X-4 i zwykle wystarcza.',
      '<b>Obrazy stron w CMYK</b> (obrazy stron z PDF/X-4): cały obraz strony jest przeliczany przez profil i zapisywany bez strat, więc plik jest wyraźnie większy niż zwykłe obrazy stron. Czarny i szary tekst, kształty i cienie idą <b>samą czarną farbą</b> – także wtedy, gdy leżą na zdjęciu – a same zdjęcia czterema farbami, jak wynika z profilu. Biel to czysty papier. Tekst zostaje obrazem: nie da się go zaznaczyć, a jego ostrość zależy od pola <b>Jakość</b> (do druku 300 dpi lub więcej).',
      'Którą opcję wybrać? Zapytaj drukarnię, czego wymaga. Jeśli mówi „PDF/X-4” – wybierz standard i jej papier. Jeśli mówi „wszystko w CMYK” – zaznacz dodatkowo oba pola CMYK. <b>Przed pierwszym zleceniem wyślij próbny plik</b>: aplikacja buduje go według normy, ale nie sprawdza go programem kontrolnym drukarni.',
      'Czego nie da się zapisać wektorowo, trafia do pliku jako obraz <b>tego jednego elementu</b>: element z cieniem, element przycięty maską, tekst ze znakiem spoza czcionki, rysunek SVG z filtrem, maską albo wzorem. Rozdzielczość tych obrazów ustawiasz w polu <b>Jakość</b>.',
      '<b>Rysunki SVG</b> idą do pliku jako wektory: aplikacja rozkłada rysunek na kształty i sprawdza, czy wyglądają tak samo jak oryginał; jeśli nie – rysunek zostaje obrazem.',
      'Tekst pisany czcionką, której nie da się osadzić (własny plik WOFF2, czcionka zmienna, kursywa bez własnego pliku), jest zapisywany jako <b>krzywe</b>: ostry, ale nie do zaznaczenia. Po eksporcie aplikacja wypisuje osobno, co poszło jako obraz, a co jako krzywe.',
      '<b>Zakres</b>: cały projekt, bieżąca sekcja albo strony od–do (kolejne numery stron w całym wydruku).',
      '<b>Do drukarni</b>: każda strona ma spad dookoła, a sekcje z włączonymi znakami cięcia dostają znaki cięcia. Plik zawiera informację o formacie po obcięciu i o spadzie, którą odczytują programy drukarni. <b>Do oglądania</b>: strony równo do formatu, bez spadu i znaków.',
      '<b>Jakość</b>: 300 dpi to standard do druku; 150 dpi daje mały plik na próbę; 600 dpi – bardzo ostro, kosztem rozmiaru pliku.',
      '<b>Podział na pliki</b>: jeden plik, osobny plik dla każdej sekcji albo części po zadanej liczbie stron. Kilka plików dostajesz w jednym archiwum ZIP.',
      '<b>Dołącz pliki czcionek użytych w projekcie</b>: dostaniesz archiwum ZIP z plikiem PDF i folderem <code>czcionki</code> ze zwykłymi plikami TTF z oficjalnego zestawu (i z własnymi czcionkami projektu). Opcja zaznacza się sama, gdy plik nie ma czcionek w środku: przy obrazach stron i przy tekście zamienionym na krzywe.',
      '<b>Do sprawdzenia przed drukiem</b>: na dole okna jest lista uwag do całego projektu (następny rozdział). Uwagi nie blokują eksportu. Długi eksport możesz przerwać przyciskiem <b>Przerwij</b>.',
    ],
  },
  {
    tytul: 'Sprawdź przed drukiem',
    wstep: 'Zanim wyślesz plik do drukarni, aplikacja przegląda cały projekt – już po powieleniu serii – i wypisuje miejsca, na które warto spojrzeć. Okno otwierasz z menu <b>⋯ → Sprawdź przed drukiem</b>; ta sama lista jest w oknie eksportu PDF.',
    obraz: 'kontrola.png',
    podpis: 'Lista uwag z numerami stron; „Pokaż” otwiera stronę, której dotyczy uwaga.',
    punkty: [
      '<b>Tekst nie mieści się w ramce</b>: aplikacja wstawia dane z każdego wiersza tabeli i sprawdza każdą powieloną stronę. Uwaga podaje, na których stronach tekst wystaje – np. gdy jedno hasło w tabeli jest dużo dłuższe od pozostałych.',
      '<b>Pole bez wartości</b>: w tekście jest pole, którego aplikacja nie zna (literówka, usunięta kolumna).',
      '<b>Brak pliku obrazu</b>: w kolumnie z nazwami obrazów jest nazwa, do której nie wgrano pliku.',
      '<b>Powtórzenia</b> w kolumnach oznaczonych znakiem ≠ – z numerami stron, na których ta sama wartość wypada dwa razy.',
      '<b>Wartości spoza listy</b> w kolumnach z listą dozwolonych wartości (znak ☰) – z numerami wierszy tabeli.',
      '<b>Brak danych</b> w tabeli dodatkowej serii i <b>niepełny ostatni blok</b> serii.',
      '<b>Tabela wychodzi poza stronę</b>: wiersze tabeli rosną razem z treścią, więc na stronie z dłuższymi danymi tabela może wyjść poza kartkę. Uwaga podaje, na których stronach i o ile milimetrów.',
      'Przycisk <b>Pokaż</b> przy uwadze otwiera podgląd na pierwszej stronie, której uwaga dotyczy – już z danymi tego powielenia, z wyróżnioną kartką. <b>Otwórz wzór</b> otwiera w edytorze stronę-wzór z zaznaczonym elementem, żeby od razu go poprawić. Sprawdzanie tekstów w dużym projekcie trwa chwilę – lista uzupełnia się na bieżąco.',
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
    wstep: 'Podgląd możesz pokazać komuś, kto nie ma konta – np. klientowi albo drukarni – wysyłając link. Projekt ma jeden link.',
    obraz: 'udostepnianie.png',
    podpis: 'Okno „Udostępnij podgląd” z gotowym linkiem.',
    punkty: [
      'W podglądzie kliknij <b>Udostępnij</b>, potem <b>Utwórz link</b>. Aplikacja przygotuje obrazy wszystkich stron – przy dużym projekcie chwilę to potrwa.',
      'Skopiuj link i wyślij go. Osoba z linkiem widzi strony tak jak w podglądzie; nie może nic zmienić i nie ma dostępu do reszty Twoich projektów.',
      '<b>Link aktualizuje się sam</b>: kilka sekund po zapisaniu zmian na koncie aplikacja wysyła obrazy tych stron, które się zmieniły. Adres zostaje ten sam. <b>Aktualizuj teraz</b> robi to od ręki.',
      '<b>Unieważnij link</b> usuwa udostępnione strony; stary adres przestaje działać. Ponowne udostępnienie daje nowy adres.',
      'Projekt z czynnym linkiem ma na liście projektów plakietkę <b>Udostępniony</b> – kliknięcie otwiera to samo okienko, bez wchodzenia do projektu.',
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
      '<b>Prowadnica liczbą</b>: we właściwościach strony (nic nie zaznaczone) jest część <b>Prowadnice</b> – lista z położeniem każdej w mm, przyciski dodania pionowej i poziomej oraz usuwanie. Tak ustawisz prowadnicę dokładnie, także na telefonie, gdzie linijek nie ma.',
      'Elementy przyciągają się do prowadnic, marginesów, krawędzi i środka strony – przy przesuwaniu i przy zmianie rozmiaru uchwytem.',
      'Przytrzymaj <kbd>Ctrl</kbd> przy przeciąganiu, żeby na chwilę wyłączyć przyciąganie.',
      '<b>Zablokuj prowadnice</b> (w menu z kratką): zablokowanych prowadnic nie da się złapać ani przesunąć myszą – nie przesuniesz ich przypadkiem, celując w element. Liczbą we właściwościach strony nadal je ustawisz.',
      'Dodanie, przesunięcie i usunięcie prowadnicy cofniesz <kbd>Ctrl</kbd>+<kbd>Z</kbd>, jak każdą inną zmianę.',
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
      '<b>Strzałki z liczbą</b> pokazują odległość w mm do najbliższego elementu z lewej, prawej, z góry i z dołu. Gdy naprzeciwko nie ma sąsiada, mierzony jest najbliższy element po skosie – cienka linia przedłuża wtedy jego krawędź. Do takiego sąsiada widać też <b>odległość w linii prostej</b> (po przekątnej): przerywany odcinek z liczbą łączy najbliższe sobie punkty obu elementów – zwykle narożniki, a przy elemencie obróconym także punkt na jego boku. Obrócony element liczy się swoim prawdziwym kształtem, nie prostokątem dookoła.',
      '<b>Równe odstępy</b>: gdy odstęp od sąsiada jest taki sam jak inny odstęp w tym rzędzie (albo element stoi dokładnie na środku między sąsiadami), obie strzałki dostają fioletową etykietę.',
      'Przytrzymaj <kbd>Alt</kbd> przy zaznaczonym elemencie, żeby zobaczyć jego odległości także do krawędzi strony.',
      'Przyciąganie do elementów wyłączysz w menu z kratką.',
    ],
  },
  {
    tytul: 'Warstwy',
    wstep: 'Zakładka „Warstwy” w prawym panelu (obok „Właściwości”) pokazuje wszystkie elementy otwartej strony, od leżącego na wierzchu do leżącego na spodzie.',
    obraz: 'warstwy.png',
    podpis: 'Lista warstw: oko ukrywa element, kłódka go blokuje, strzałki zmieniają kolejność.',
    punkty: [
      'Kliknięcie nazwy zaznacza element – przydatne, gdy leży pod innym i trudno w niego trafić.',
      'Kolejność zmienisz, przeciągając wiersz wyżej albo niżej, albo przyciskami <b>▲</b> i <b>▼</b> (wygodne na ekranie dotykowym).',
      '<b>Oko</b> ukrywa element. Ukryty element zostaje w projekcie, ale nie jest drukowany.',
      '<b>Kłódka</b> blokuje położenie i rozmiar.',
      'Podwójne kliknięcie nazwy pozwala ją zmienić.',
      'Na dole i na górze listy widać <b>elementy wzorców</b> tej strony (pod treścią i nad treścią), z nazwą wzorca. Nie zmienisz ich tutaj – kliknięcie otwiera wzorzec do edycji.',
      'Zgrupowane elementy są na liście jednym wierszem „Grupa”. Trójkąt przy grupie <b>rozwija jej zawartość</b>: pod spodem widać elementy grupy, każdy z własnym okiem (ukrywa tylko ten element) i nazwą, którą zmienisz podwójnym kliknięciem. <b>Kliknięcie elementu grupy otwiera grupę i zaznacza ten element</b> – zmienisz go bez rozgrupowywania (grupa jest wtedy oznaczona na liście pomarańczowym paskiem); kliknięcie innego wiersza listy ją zamyka.',
      '<b>Tabelę też rozwiniesz</b> trójkątem: pod nią stoją jej komórki wierszami – numer „wiersz.kolumna” i początek treści. Kliknięcie komórki na liście <b>zaczyna w niej pisanie</b>, tak jak podwójne kliknięcie na stronie; przydaje się w gęstej tabeli i przy małych komórkach. Komórki nie mają własnego oka ani kłódki – ukrywa się i blokuje całą tabelę.',
    ],
  },
  {
    tytul: 'Tablet, telefon i instalacja',
    wstep: 'Aplikacja działa w przeglądarce na tablecie, telefonie i komputerze. Można ją też zainstalować jak zwykły program.',
    obraz: 'telefon.png',
    podpis: 'Telefon trzymany pionowo: strona u góry, panel wysuwa się z dołu.',
    obrazWaski: true,
    punkty: [
      '<b>Jeden palec</b> – zaznaczanie i przesuwanie elementów. <b>Dwa palce</b> – przesuwanie widoku i powiększanie.',
      '<b>Na telefonie edytor działa w pionie.</b> Panele <b>Strony</b>, <b>Właściwości</b>, <b>Warstwy</b> i <b>Ostrzeżenia</b> otwierasz przyciskami na dole ekranu; panel wysuwa się z dołu i ma stałą wysokość, więc nie skacze, gdy przeglądarka chowa pasek adresu.',
      'Telefon trzymany poziomo pokazuje planszę „Za mało miejsca na wysokość” – pasek adresu i panele nie zostawiają wtedy miejsca na stronę. To samo zobaczysz na komputerze w bardzo niskim oknie (poniżej 480 px). Lista projektów, logowanie i udostępniony podgląd działają w obu ułożeniach.',
      'Na małym ekranie schowane są narzędzia, którymi trudno sterować palcem: wielokąt, pióro i edycja punktów, tabela, kadrowanie ramką i linijki. Prowadnice wpisujesz liczbą, a obraz przytniesz liczbami we właściwościach.',
      '<b>Instalacja na Androidzie</b> (Chrome): menu ⋮ → <b>Zainstaluj aplikację</b> / <b>Dodaj do ekranu głównego</b>. Zainstalowana aplikacja nie ma paska adresu, więc na stronę zostaje więcej miejsca.',
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
      '<b>Praca na dwóch urządzeniach.</b> Jeśli ten sam projekt zmieniono w międzyczasie gdzie indziej, aplikacja nic nie nadpisze, tylko <b>połączy zmiany</b>: strony, wzorce, tabele danych, sekcje, serie i style zmienione tylko w jednym miejscu zostają z obu urządzeń, bez pytania. Zobaczysz komunikat „Połączono zmiany z innego urządzenia”.',
      'Pytanie pojawia się tylko wtedy, gdy <b>tę samą stronę</b> (albo ten sam wzorzec, tę samą tabelę…) zmieniono w obu miejscach. Okno wymienia wyłącznie takie części i przy każdej pozwala wybrać: <b>z tego urządzenia</b> albo <b>z konta</b>. Reszta projektu łączy się sama. Po połączeniu „Cofnij” zaczyna liczyć kroki od nowa.',
      'Wyjątek: gdy projekt wczytasz z pliku <code>.seriodruk</code> w miejsce istniejącego, a na koncie jest już inna wersja, aplikacja nie ma z czym porównać zmian i pyta o cały projekt: zachować wersję z tego urządzenia czy wczytać wersję z konta.',
      '<b>Cofnij</b> i <b>Ponów</b> (<kbd>Ctrl</kbd>+<kbd>Z</kbd>) obejmują cały projekt: zmiany na stronach i wzorcach, dodawanie i usuwanie stron, sekcje, style, dane i serie. Po cofnięciu edytor otwiera stronę, której dotyczyła zmiana. Historia sięga 80 kroków wstecz i kończy się z zamknięciem projektu.',
      'Na konto wysyłane są tylko te strony, które się zmieniły – duży projekt zapisuje się tak samo szybko jak mały.',
      '<b>Zdjęcia nie obciążają pamięci.</b> Oryginał każdego obrazu leży w osobnym magazynie przeglądarki (na dysku), a w edytorze pracuje lżejsza kopia. Projekt z setkami zdjęć otwiera się i zapisuje tak jak mały; po oryginał aplikacja sięga dopiero przy eksporcie do PDF, PNG albo do pliku projektu. Na drugim urządzeniu obrazy pobierają się z konta raz, przy pierwszym otwarciu projektu.',
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
    ],
  },
];

export class Instrukcja {
  constructor() {
    this.dlg = document.getElementById('dlg-instrukcja');
    // Zmiana motywu przy otwartej instrukcji podmienia zrzuty na pasujące.
    document.addEventListener('motyw', () => { if (this.dlg?.open && this.indeks >= 0) this.pokaz(this.indeks); });
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
    // Zrzuty są w dwóch kompletach: jasnym i ciemnym – instrukcja pokazuje ten, który pasuje do motywu.
    const katalog = czyCiemny() ? 'img/instrukcja/ciemny/' : 'img/instrukcja/';
    if (r.obraz) {
      html.push(`<figure><img src="${katalog}${r.obraz}" alt="${r.podpis || ''}" loading="lazy"${r.obrazWaski ? ' style="max-width:320px"' : ''}>`
        + `${r.podpis ? `<figcaption>${r.podpis}</figcaption>` : ''}</figure>`);
    }
    if (r.punkty?.length) html.push(`<ul class="punkty">${r.punkty.map((p) => `<li>${p}</li>`).join('')}</ul>`);
    // Drugi obrazek rozdziału – pod punktami.
    if (r.obraz2) html.push(`<figure><img src="${katalog}${r.obraz2}" alt="${r.podpis2 || ''}" loading="lazy">${r.podpis2 ? `<figcaption>${r.podpis2}</figcaption>` : ''}</figure>`);
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
