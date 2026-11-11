# Instrukcja Seriodruku

Seriodruk (https://andrish97.github.io/book/) to edytor publikacji z powtarzanymi stronami – kalendarzy, planerów, notesów – działający w przeglądarce. To jest instrukcja obsługi z aplikacji (przycisk ze znakiem zapytania), w postaci do czytania przez ludzi i AI. Opis formatu pliku projektu: https://andrish97.github.io/book/ai/format-seriodruk.md.

<!-- Plik generowany z js/instrukcja.js przez scripts/instrukcja-md.cjs – nie edytuj go ręcznie. -->

## Spis rozdziałów

1. Na początek
2. Konto: logowanie i rejestracja
3. Ustawienia konta
4. Jasny i ciemny motyw
5. Nowy projekt
6. Edytor – przegląd
7. Wstawianie elementów
8. Tekst i style
9. Czcionki
10. Położenie, wyrównanie, schowek
11. Strony
12. Sekcje
13. Rozkładówki
14. Wzorce
15. Dane: tabele
16. Pola w tekście
17. Serie: powielanie stron
18. Kolor i położenie z danych
19. Ramka tekstu i obrazy z danych
20. Kolumny i przelewanie tekstu
21. Tabela
22. Eksport do PDF
23. Sprawdź przed drukiem
24. Podgląd
25. Udostępnianie linkiem
26. Praca z AI
27. Linie i ostrzeżenia
28. Siatka, linijki i prowadnice
29. Odległości i równe odstępy
30. Warstwy
31. Tablet, telefon i instalacja
32. Zapis, pliki i kilka urządzeń
33. Skróty klawiszowe
34. Co będzie dalej

## 1. Na początek

Seriodruk służy do składania publikacji z powtarzalnymi stronami: kalendarzy, planerów, notesów. Projektujesz wzory stron, a aplikacja wstawia do nich dane z arkusza, powiela strony – po jednej na każdy wiersz – i zapisuje gotowy plik PDF do druku.

![Lista projektów po zalogowaniu.](https://andrish97.github.io/book/img/instrukcja/projekty.png)
*Lista projektów po zalogowaniu.*

- Projekt to jedna publikacja – np. „Kalendarz 2027”. Karta pokazuje pierwszą stronę i datę ostatniej zmiany.
- Każda zmiana zapisuje się sama – nie ma przycisku „Zapisz”.
- Menu **⋯** na karcie projektu: podgląd, zmiana nazwy, duplikowanie, eksport do pliku, usunięcie. **Importuj** wczytuje projekt z pliku `.seriodruk`.
- Plakietka **Udostępniony** na karcie oznacza, że projekt ma czynny link do podglądu. Kliknięcie plakietki otwiera okienko z linkiem – tam go skopiujesz albo unieważnisz.
- Typowa kolejność pracy: nowy projekt → wzorce (wspólne tła, stopki, numery) → strony → dane i serie → podgląd → „Sprawdź przed drukiem” → PDF.
- Instrukcję otworzysz w każdej chwili przyciskiem **Instrukcja** albo **?** w edytorze.

## 2. Konto: logowanie i rejestracja

Projekty są zapisane na koncie i dostępne na każdym urządzeniu. Konto zakładasz adresem e-mail i hasłem.

![Zakładanie konta – wymagania hasła zaznaczają się podczas pisania.](https://andrish97.github.io/book/img/instrukcja/rejestracja.png)
*Zakładanie konta – wymagania hasła zaznaczają się podczas pisania.*

- **Nowe konto**: wpisz swoją nazwę (tak aplikacja będzie się do Ciebie zwracać), e-mail i dwa razy hasło. Hasło musi mieć co najmniej 8 znaków, małą i wielką literę, cyfrę i znak specjalny.
- Konto działa od razu po założeniu. Jeśli administrator włączy potwierdzanie adresu, na podany e-mail przyjdzie wiadomość „Potwierdź swoje konto” z przyciskiem i dopiero po kliknięciu można się zalogować (wiadomość można wysłać ponownie po minucie).
- **Nie pamiętasz hasła?** – podaj e-mail, a dostaniesz link do ustawienia nowego hasła.
- Link z wiadomości działa jeden raz. Jeśli wygasł, aplikacja o tym powie – poproś wtedy o nowy.

## 3. Ustawienia konta

Kliknij kółko z inicjałem w prawym górnym rogu listy projektów i wybierz „Ustawienia konta”. Ustawienia są pogrupowane; lista po lewej przenosi do wybranej grupy.

![Ustawienia konta z rozwiniętą zmianą adresu e-mail.](https://andrish97.github.io/book/img/instrukcja/konto.png)
*Ustawienia konta z rozwiniętą zmianą adresu e-mail.*

- **Profil** – nazwa widoczna w prawym górnym rogu.
- **Logowanie** – **Zmień adres** i **Zmień hasło** rozwijają formularz w swoim wierszu. Po zmianie adresu na nowy przychodzi link potwierdzający; do kliknięcia logujesz się dotychczasowym. Rozpoczętej zmiany nie da się cofnąć z aplikacji (Supabase na to nie pozwala), ale bez kliknięcia linku nic się nie zmieni – link wygaśnie. **Wpisz inny adres** zastępuje oczekujący adres nowym.
- **Wygląd** – jasny albo ciemny motyw (następny rozdział).
- **Urządzenia** – **Wyloguj** wylogowuje tylko to urządzenie, **Wyloguj wszędzie** – wszystkie naraz (przydatne po logowaniu na cudzym albo zgubionym urządzeniu).
- **Usuwanie konta** – usuwa konto i wszystkie projekty. Jeśli chcesz je zachować, najpierw wyeksportuj je do plików.

## 4. Jasny i ciemny motyw

Aplikacja ma dwa motywy. Wybór dotyczy urządzenia, na którym go ustawiasz.

![Ciemny motyw w ustawieniach konta.](https://andrish97.github.io/book/img/instrukcja/motyw.png)
*Ciemny motyw w ustawieniach konta.*

- W **Ustawieniach konta → Wygląd** wybierz: **Jak w systemie** (zmienia się razem z ustawieniem urządzenia), **Jasny** albo **Ciemny**.
- Szybki przełącznik – ikona półkola – jest na ekranie logowania, na liście projektów, w menu **⋯** edytora i w podglądzie otwartym z linku.
- Strony publikacji zawsze są pokazywane na białym papierze. Ciemny motyw zmienia tylko interfejs wokół nich.

## 5. Nowy projekt

Projekt to cała publikacja: sekcje, wzorce i wszystkie strony.

![Okno „Nowy projekt”.](https://andrish97.github.io/book/img/instrukcja/nowy-projekt.png)
*Okno „Nowy projekt”.*

- Wpisz nazwę i wybierz format – kafelki pokazują proporcje strony. **Własny** pozwala wpisać dowolny wymiar w milimetrach, a **Orientacja** obraca stronę (pionowo albo poziomo).
- **Spad** to pas za krawędzią strony, który drukarnia odcina. Zwykle 3 mm.
- **Marginesy** wyznaczają bezpieczny obszar na teksty. Wszystkie te ustawienia zmienisz później w ustawieniach sekcji.
- **Układ stron**: pojedyncze strony albo rozkładówki (lewa + prawa, jak w książce).
- Projekt zaczyna od jednej sekcji „Główna”. Kolejne sekcje, np. okładkę o innym rozmiarze, dodasz w edytorze.

## 6. Edytor – przegląd

Po otwarciu projektu widzisz edytor. Każda rzecz ma swoje miejsce:

![Edytor: strony z lewej, strona pośrodku, właściwości i warstwy z prawej.](https://andrish97.github.io/book/img/instrukcja/edytor.png)
*Edytor: strony z lewej, strona pośrodku, właściwości i warstwy z prawej.*

- **Strony** (z lewej) – miniatury wszystkich stron, pogrupowane w sekcje. Kolejność miniatur to kolejność w publikacji.
- **Strona** (pośrodku) – tu układasz elementy. Nad nią pasek **Wstaw**, w prawym dolnym rogu powiększenie oraz menu siatki i linii pomocniczych.
- **Właściwości** i **Warstwy** (z prawej, dwie zakładki) – ustawienia zaznaczonego elementu albo strony oraz lista elementów otwartej strony. Są obok siebie, bo dotyczą tego samego: tego, co leży na otwartej stronie.
- Górny pasek: powrót do projektów, nazwa projektu (kliknij, żeby ją zmienić), stan zapisu, cofanie, **Wzorce** (szablony wspólnych elementów stron), **Dane** (tabele do pól i serii), **Podgląd**, sekcja i jej format, **pełny ekran**, instrukcja i menu **⋯** (PDF, PNG, sprawdzenie przed drukiem, czcionki, motyw; na wąskim ekranie także pełny ekran).
- Listy rozwijane, wybór koloru i pola wyboru wyglądają i działają tak samo na każdym urządzeniu – rysuje je aplikacja, nie system. W długiej liście (np. czcionek) wystarczy zacząć pisać: zostają tylko pozycje zawierające wpisany fragment, bez rozróżniania wielkości liter i polskich znaków; `Backspace` cofa, `Esc` czyści szukanie. Wybór koloru ma pole barw, kod koloru, paletę i ostatnio używane kolory.

## 7. Wstawianie elementów

Pasek nad stroną wstawia nowe elementy na stronę.

![Zaznaczony tekst z uchwytami.](https://andrish97.github.io/book/img/instrukcja/wstawianie.png)
*Zaznaczony tekst z uchwytami.*

- **Tekst** – kliknij dwa razy, aby pisać bezpośrednio na stronie, albo wpisz treść w polu **Treść** po prawej.
- **Prostokąt, Elipsa, Wielokąt, Linia** – kształty do ramek, tła i podziałów. Wielokąt zaczyna jako trójkąt; liczbę boków zmienisz we właściwościach, tam też zrobisz z niego gwiazdę.
- **Rysuj** (klawisz `B`) – rysowanie odręczne: przeciągaj po stronie, a powstanie wygładzona linia. Tryb zostaje włączony, więc możesz narysować kilka kresek; `Esc` albo ponowne kliknięcie przycisku go kończy. Narysowana linia jest zwykłym elementem: ma kolor i grubość, da się ją przesuwać, skalować i obracać.
- **Pióro** (klawisz `N`) – kształt z punktów. Kliknięcie stawia punkt, a kolejne punkty łączą się prostymi odcinkami. Kliknięcie z przeciągnięciem stawia punkt z łukiem: im dalej przeciągniesz, tym łagodniejszy łuk. `Enter` albo podwójne kliknięcie kończy kształt otwarty, kliknięcie w pierwszy punkt go zamyka. `Backspace` cofa ostatni punkt, `Esc` porzuca zaczęty kształt, a drugi `Esc` wyłącza pióro. Gotowy kształt jest zwykłym elementem: ma kolor i grubość linii, a zamknięty – także wypełnienie.
- **Edycja punktów**: kliknij dwa razy kształt z pióra albo linię narysowaną odręcznie (albo wybierz **Edytuj punkty** we właściwościach). Pojawią się punkty – przeciągaj je myszą. Zaznaczony punkt łuku pokazuje uchwyty, którymi zmieniasz wygięcie. Podwójne kliknięcie w linię dodaje punkt, `Delete` usuwa zaznaczony. `Enter` zatwierdza zmiany, `Esc` przywraca kształt sprzed edycji.
- **Wypełnienie** kształtu: jeden kolor, **gradient liniowy** albo **kołowy**, albo brak. Gradient może mieć dowolną liczbę kolorów – każdy ma swoje położenie w procentach; do tego kierunek (gotowy albo kąt), a w kołowym promień. Każdy element może mieć też **cień** z przesunięciem i rozmyciem w mm.
- **Obraz** – zdjęcie lub grafika z dysku (PNG, JPEG, WebP, GIF, SVG). Możesz też przeciągnąć plik na stronę albo **wkleić obraz ze schowka** (`Ctrl`+`V`): zrzut ekranu, obraz skopiowany ze strony internetowej albo z programu graficznego, a także kod SVG skopiowany jako tekst. Rysunek SVG wstawia się jako jeden element – możesz go skalować, obracać i kadrować, a po powiększeniu zostaje ostry; żeby zmieniać jego części, rozłóż go na elementy (rozdział **Położenie, wyrównanie, schowek**). Duże zdjęcia aplikacja pokazuje w edytorze lżejszą kopią, żeby praca była płynna; do pliku PDF i PNG zawsze idzie oryginał.
- **Tabela** – podajesz liczbę wierszy i kolumn. Tabela jest jednym elementem: przesuwasz ją i obracasz w całości, a po dwukrotnym kliknięciu komórki piszesz w niej (więcej w rozdziale **Tabela**).
- Przeciągnij element, aby go przesunąć. Kółka w rogach zmieniają rozmiar, kółko nad elementem go obraca.
- Przy przesuwaniu i przy zmianie rozmiaru element „przykleja się” do krawędzi, marginesów, środka strony, prowadnic i innych elementów – pokazuje to różowa linia (więcej w rozdziale **Odległości i równe odstępy**).

![Kształt narysowany piórem w trakcie edycji punktów: punkty kształtu i uchwyty łuków.](https://andrish97.github.io/book/img/instrukcja/pioro.png)
*Kształt narysowany piórem w trakcie edycji punktów: punkty kształtu i uchwyty łuków.*

## 8. Tekst i style

Właściwości tekstu są w panelu z prawej. Rozmiar czcionki podajesz w punktach, pozostałe wymiary w milimetrach.

![Właściwości tekstu ze stylem „Tytuł”.](https://andrish97.github.io/book/img/instrukcja/wlasciwosci.png)
*Właściwości tekstu ze stylem „Tytuł”.*

- **Styl tekstu** to zapisany wygląd, np. „Tytuł” albo „Podpis”. Nadaj go tekstom, które mają wyglądać tak samo.
- Gdy zmienisz tekst ze stylem, pojawi się **Aktualizuj styl** – kliknięcie zmienia wszystkie teksty z tym stylem w całym projekcie. **Przywróć** wraca do wyglądu ze stylu.
- **Nowy styl** zapisuje wygląd bieżącego tekstu pod własną nazwą.
- Czcionka, rozmiar, kolor, interlinia, **odstęp liter** (w tysięcznych wysokości pisma), pogrubienie, kursywa, podkreślenie, przekreślenie, wyrównanie.
- **Wielkość liter**: **AA** (wielkie) i **aa** (małe) zmieniają tylko wygląd – treść zostaje taka, jak ją wpisano, więc wartości z tabeli też pokażą się wielkimi literami, a po wyłączeniu wszystko wraca. **Aa** („jak w zdaniu”) zmienia samą treść.
- **Kapitaliki** (przycisk **Aᴀ** obok): małe litery wyglądają jak wielkie, tylko niższe, a wielkie zostają pełnej wysokości – tak składa się np. nazwiska i nagłówki. To też tylko wygląd: treść zostaje taka, jak ją wpisano, a w PDF-ie tekst da się zaznaczyć i wyszukać.
- **Lista**: punkty, kreski albo numery przed każdym akapitem. Dalsze wiersze akapitu stoją równo pod pierwszym. Znak listy nie jest częścią treści, więc pola z danych działają bez zmian. Skróty: `Ctrl`+`Shift`+`8` (punkty) i `Ctrl`+`Shift`+`7` (numery).
- Aby zmienić tylko część tekstu, kliknij go dwa razy, zaznacz fragment i użyj tych samych ustawień – panel pokaże „Zmieniasz tylko zaznaczony fragment”.
- Tekst, który ma się zmieścić w stałym miejscu (np. dane o różnej długości), ustawisz w części **Ramka tekstu**: stała wysokość i zmniejszanie czcionki do zadanego minimum – patrz rozdział **Ramka tekstu i obrazy z danych**.

## 9. Czcionki

Aplikacja ma jeden oficjalny zestaw czcionek – ten sam dla wszystkich projektów i użytkowników. Okno czcionek otwiera menu **⋯ → Czcionki projektu**.

![Okno „Czcionki”: oficjalny zestaw aplikacji na dole, wyżej własne czcionki projektu.](https://andrish97.github.io/book/img/instrukcja/czcionki.png)
*Okno „Czcionki”: oficjalny zestaw aplikacji na dole, wyżej własne czcionki projektu.*

- **Zestaw czcionek Seriodruku** to 52 rodziny: bezszeryfowe do tekstu (m.in. Inter, Open Sans, Lato, Roboto, Poppins), wąskie do nagłówków (Oswald, Bebas Neue), szeryfowe (Lora, Merriweather, Playfair Display, EB Garamond…), odręczne i ozdobne (Caveat, Pacifico, Dancing Script…) oraz maszynowe. Wszystkie mają polskie znaki i licencję pozwalającą na druk komercyjny. Pełną listę z próbkami pokazuje okno czcionek.
- Nie każda czcionka ma wszystkie odmiany – odręczne i nagłówkowe często mają jedną grubość i nie mają kursywy. Wtedy przyciski **Pogrubienie** i **Kursywa** w panelu tekstu są wyszarzone, a po wybraniu takiej czcionki tekst wraca do odmiany zwykłej.
- Pliki czcionki pobierają się przy pierwszym użyciu (aplikacja nie ściąga całego zestawu na zapas), a na długiej liście czcionek wystarczy zacząć pisać nazwę, żeby ją znaleźć.
- Czcionki z zestawu są na liście w każdym projekcie, na każdym urządzeniu. W pliku PDF wektorowym są osadzone, więc drukarnia nie musi ich mieć. Do pliku trafiają tylko **użyte znaki** każdej czcionki, więc czcionki prawie nie powiększają pliku (wyjątek: własna czcionka OTF z obrysami CFF jest osadzana cała).
- **Pobieranie plików**: przy każdej rodzinie jest **Pobierz pliki**, a pod listą **Pobierz cały zestaw (ZIP)**. Dostajesz zwykłe pliki TTF z licencją – do zainstalowania u drukarni albo grafika.
- **Czcionki razem z projektem**: w oknie eksportu PDF opcja **Dołącz pliki czcionek użytych w projekcie** dodaje do pobieranej paczki folder `czcionki` z plikami TTF. Zaznacza się sama, gdy plik nie ma czcionek w środku (obrazy stron albo tekst zamieniony na krzywe).
- **Własne czcionki** (dodatek, nie musisz z nich korzystać): na końcu listy czcionek w panelu tekstu jest **+ Wgraj własną czcionkę…**. Pliki TTF, OTF, WOFF albo WOFF2, każda odmiana osobno. Wgrana czcionka jest częścią projektu i zostaje też w „Moich czcionkach” – pod ręką w następnych projektach.
- Do PDF własne czcionki najlepiej wgrywać jako TTF albo OTF, z osobnym plikiem dla każdej odmiany – wtedy tekst jest w pliku prawdziwym tekstem. Czcionki z pliku WOFF2, czcionki zmiennej i kursywy, której czcionka nie ma (przeglądarka pochyla wtedy pismo proste), nie da się osadzić: taki tekst trafia do PDF jako **krzywe** – jest ostry w każdym powiększeniu, ale nie da się go zaznaczyć. Tylko pogrubienie bez własnego pliku i czcionka zmienna w pliku WOFF2 użyta w innej grubości niż podstawowa idą jako obraz. Aplikacja mówi o tym po eksporcie.

## 10. Położenie, wyrównanie, schowek

Poniżej ustawień wyglądu każdy element ma dokładne położenie i narzędzia do układania.

![Kilka zaznaczonych elementów: wyrównanie do siebie i równe odstępy.](https://andrish97.github.io/book/img/instrukcja/wyrownanie.png)
*Kilka zaznaczonych elementów: wyrównanie do siebie i równe odstępy.*

- **Położenie i rozmiar**: dokładne X, Y, szerokość, wysokość i obrót.
- **Wyrównaj**: jeden element wyrównuje się do marginesów strony, kilka zaznaczonych – do siebie. Przy trzech i więcej dochodzą **równe odstępy**.
- Kilka elementów zaznaczysz, przeciągając prostokąt po pustym miejscu strony albo klikając z wciśniętym Shift. Zaznaczonym razem możesz też zmienić **kolejność** – przesuwają się wtedy wspólnie. Możesz je **zgrupować** (`Ctrl`+`G`) – grupa przesuwa się i skaluje jak jeden element; `Ctrl`+`Shift`+`G` ją rozdziela.
- **Element w grupie bez rozgrupowywania**: kliknij grupę dwa razy – otworzy się, a element pod kursorem będzie zaznaczony. Możesz go przesunąć, przeskalować, obrócić, zmienić we właściwościach albo napisać w nim tekst; kliknięcie innego elementu grupy zaznacza tamten. Otwartą grupę widać po pomarańczowej przerywanej ramce z podpisem. `Esc`, kliknięcie poza grupą albo przycisk **Wróć do całej grupy** zamykają ją: grupa znów jest jednym elementem, na tym samym miejscu wśród warstw, z ramką dopasowaną do nowego układu.
- W otwartej grupie **Duplikuj** zostawia kopię w grupie, **Usuń** usuwa tylko zaznaczone elementy, a przyciski kolejności zmieniają ją wśród elementów grupy. Skopiowany element grupy wkleja się jako osobny element strony. Blokadę i ustawienia „Z danych” ma cała grupa, nie jej element.
- **Kilka elementów grupy naraz**: w otwartej grupie kliknij kolejne elementy z klawiszem `Shift`, naciśnij `Ctrl`+`A` (wszystkie elementy tej grupy) albo **przeciągnij ramkę** od pustego miejsca wewnątrz grupy – zaznaczą się elementy, których ramka dotknie (z `Shift` dołączą do już zaznaczonych). Zaznaczone przesuwasz i skalujesz razem, wyrównujesz do siebie, rozkładasz równo, kopiujesz i usuwasz, a **Kolejność** (na wierzch, wyżej, niżej, na spód) zmienia je razem – między sobą zostają ułożone tak, jak były. Samo kliknięcie w puste miejsce grupy zamyka ją. Element spoza grupy do takiego zaznaczenia nie wchodzi. **Zgrupuj** robi z zaznaczonych **grupę w grupie**.
- **Obraz w otwartej grupie** kadrujesz jak każdy inny – podwójnym kliknięciem albo przyciskiem **Kadruj przeciąganiem**, a **kształt z pióra** zmieniasz punkt po punkcie (podwójne kliknięcie albo **Edytuj punkty**). Na czas kadrowania i edycji punktów element jest rysowany nad swoją grupą; po zatwierdzeniu albo anulowaniu wraca na swoje miejsce wśród jej elementów.
- **Grupa w grupie**: podwójne kliknięcie grupy leżącej w otwartej grupie otwiera ją jako kolejny poziom – podpis ramki mówi wtedy „Grupa w grupie”, a bledsze ramki pokazują grupy nad nią. `Esc` wraca o jeden poziom, kliknięcie poza grupą zamyka wszystkie. Na liście warstw rozwinięta grupa pokazuje też zawartość grup w niej, z wcięciem; kliknięcie elementu z głębi otwiera od razu potrzebne poziomy.
- **Kolejność** przenosi element nad lub pod inne.
- **Zablokuj położenie i rozmiar** chroni element przed przypadkowym przesunięciem.
- Ikony nad panelem: **kopiuj do schowka**, duplikuj, usuń. Skopiowany element wkleisz na innej stronie przyciskiem **Wklej skopiowane elementy** we właściwościach strony (albo `Ctrl`+`V`) – trafi w to samo miejsce.
- **Obraz**: kliknij go dwa razy (albo **Kadruj przeciąganiem**), żeby wybrać widoczny fragment ramką – `Enter` zatwierdza, `Esc` anuluje. Działa także na obrazie obróconym i odbitym (na czas kadrowania obraz jest prostowany). Do tego przycięcie liczbami, obrys, odbicie i informacja o rozdzielczości (do druku 300 dpi).
- **Rysunek SVG** wstawia się jako obraz: wygląda wiernie, ale nic się w nim nie zmieni, a napisy przeglądarka rysuje czcionką zastępczą. **Rozłóż rysunek na elementy** (we właściwościach obrazu) zamienia go w zwykłą **grupę kształtów i napisów** w tym samym miejscu: grupę można rozgrupować, kształtom zmienić kolor, obrys i punkty, a napisy poprawić jak każdy tekst. Napis zachowuje czcionkę, jeśli jest ona w zestawie aplikacji albo wśród czcionek projektu – inną zastępuje domyślna, o czym aplikacja mówi. Napis ułożony w rysunku w kilku wierszach zostaje jedną ramką z wierszami. Zdjęcie osadzone w rysunku staje się zwykłym obrazem projektu. Jeśli obraz był przycięty, grupa jest przycięta tak samo – przycięcie zdejmuje **Pokaż cały rysunek** we właściwościach grupy (po rozgrupowaniu elementy widać w całości). Rzeczy, których edytor nie ma (filtry, maski, wzory), znikają – wtedy lepiej zostawić obraz; `Ctrl`+`Z` go przywraca.
- Tytuły części panelu (np. **Cień**, **Ramka tekstu**) zwijają je i rozwijają. Zwinięte zostają zwinięte przy kolejnych elementach.

![U góry rysunek SVG wstawiony jako obraz, na dole ten sam po rozłożeniu na elementy: napis jest zwykłym tekstem w czcionce z zestawu, a kształt ma inny kolor.](https://andrish97.github.io/book/img/instrukcja/rysunek-svg.png)
*U góry rysunek SVG wstawiony jako obraz, na dole ten sam po rozłożeniu na elementy: napis jest zwykłym tekstem w czcionce z zestawu, a kształt ma inny kolor.*

## 11. Strony

Każdą stronę projektujesz osobno. Kolejność miniatur to kolejność stron w publikacji.

![Menu strony.](https://andrish97.github.io/book/img/instrukcja/strony.png)
*Menu strony.*

- **+ Strona** na dole panelu wstawia pustą stronę za bieżącą, w tej samej sekcji.
- Przycisk **⋯** na miniaturze: zmiana nazwy, duplikowanie, przesuwanie, usuwanie.
- Kolejność zmienisz też **przeciągając miniaturę** myszą; upuszczona w innej sekcji strona przechodzi do niej.
- Usunięcie albo przesunięcie strony cofniesz przyciskiem **Cofnij** w komunikacie na dole ekranu albo `Ctrl`+`Z` – dopóki nie zmienisz czegoś na stronie.
- Gdy nic nie jest zaznaczone, panel z prawej pokazuje ustawienia strony: nazwę, sekcję, tło, wzorce, serię i prowadnice.
- Po zmianie kolejności stron w rozkładówkach aplikacja ostrzega, jeśli element leżący przez grzbiet trafił obok innej strony niż przedtem.

## 12. Sekcje

Projekt dzieli się na sekcje – części o różnych ustawieniach, np. „Okładka” i „Środek”.

![Ustawienia sekcji.](https://andrish97.github.io/book/img/instrukcja/sekcje.png)
*Ustawienia sekcji.*

- Każda sekcja ma własny **format**, **spad** i cztery **marginesy**.
- **Układ stron**: pojedyncze albo rozkładówki. **Numeracja**: dalszy ciąg poprzedniej sekcji, od wybranego numeru albo bez numerów (np. okładka).
- Na liście stron sekcje są szarymi nagłówkami. Przycisk **⋯** przy nagłówku: ustawienia, dodanie strony, zmiana kolejności, usunięcie. **+ Sekcja** tworzy nową.
- Okładkę z grzbietem ustaw jako jedną szeroką stronę: tył + grzbiet + przód (np. 148 + 6 + 148 mm). W ustawieniach sekcji jest kalkulator **Okładka z grzbietem: policz szerokość**: wpisz szerokość strony środka, liczbę stron w środku i grubość kartki (podaje ją drukarnia), a **Ustaw tę szerokość** wpisze szerokość okładki razem z grzbietem.
- **Pierwsza strona sekcji** w rozkładówkach: prawa (jak w książce) albo lewa (od razu pełna rozkładówka). **Wzorce na stronach tej sekcji** wybierają wzorce domyślne sekcji (rozdział **Wzorce**). **Znaki cięcia w pliku PDF** dodaje znaki cięcia na stronach tej sekcji przy eksporcie do drukarni.
- Stronę przeniesiesz do innej sekcji w jej właściwościach (pole **Sekcja**).

## 13. Rozkładówki

W sekcji z układem „Rozkładówki” strony tworzą pary: lewa i prawa, jak w otwartej książce.

![Obie strony rozkładówki na jednym płótnie; niebieski pas leży przez grzbiet.](https://andrish97.github.io/book/img/instrukcja/rozkladowki.png)
*Obie strony rozkładówki na jednym płótnie; niebieski pas leży przez grzbiet.*

- Marginesy są **lustrzane**: wewnętrzny przy grzbiecie, zewnętrzny przy krawędzi. Na lewej stronie wewnętrzny jest z prawej, na prawej – z lewej.
- Lewą i prawą stronę edytujesz **razem**, jak otwartą książkę. Nowe elementy trafiają na stronę bieżącą – wybierasz ją kliknięciem w jej obszar albo na liście stron.
- Element może leżeć **przez grzbiet**, np. zdjęcie albo pas na całą szerokość rozkładówki. Przeciągnij go tak, żeby zachodził na drugą stronę – na każdej stronie wydrukuje się jego część.
- Element należy do tej strony, na której leży jego środek. To ważne przy usuwaniu, duplikowaniu i przenoszeniu stron: element przez grzbiet idzie razem ze swoją stroną.
- Gruba ciemna linia to **grzbiet**. Tekstu i drobnych elementów nie kładź tuż przy nim – po zszyciu może ich nie być widać. Aplikacja ostrzega o elemencie, który tylko wystaje w pas przy grzbiecie; o takim, który świadomie leży na obu stronach, już nie.
- Pierwsza strona sekcji jest zwykle prawa i stoi sama – tak jak pierwsza strona książki. Zmienisz to w ustawieniach sekcji.
- Na liście stron rozkładówki są pokazane parami.
- **Strony powielane z danych** (serie) też trzymają swoją stronę rozkładówki: przy serii z włączonym **Pilnuj lewej i prawej strony** aplikacja wstawia pustą, białą stronę tam, gdzie strona wypadłaby po przeciwnej stronie – np. gdy dane kończą się na lewej stronie, a prawej już nie ma. Szczegóły są w rozdziale „Serie: powielanie stron”.
- Na małym ekranie możesz w menu widoku włączyć **W rozkładówkach pokazuj jedną stronę**. Widać wtedy także to, co z **sąsiedniej strony** przechodzi przez grzbiet na tę (np. pas na całą rozkładówkę, także z wzorca) – przycięte do tej strony ze spadem. Takich elementów nie da się tu zaznaczyć ani zmienić; kliknięcie podpowiada przejście do widoku rozkładówki.

## 14. Wzorce

Wzorzec to szablon z elementami wspólnymi dla wielu stron – tło, ramka, logo, stopka, numer strony. Rysujesz go raz i dodajesz do stron albo do całej sekcji; zmiana we wzorcu zmienia wszystkie te strony naraz.

![Okno „Wzorce”: szablony tego projektu z przyciskami dodawania oraz wzorce standardowe.](https://andrish97.github.io/book/img/instrukcja/okno-wzorcow.png)
*Okno „Wzorce”: szablony tego projektu z przyciskami dodawania oraz wzorce standardowe.*

- Okno otwiera przycisk **Wzorce** na górnym pasku edytora (liczba obok to liczba wzorców w projekcie).
- **Wzorce w tym projekcie**: każdy ma miniaturę i dwa przyciski. **+ Dodaj do tej strony** włącza go na otwartej stronie, **+ Do całej sekcji** – na wszystkich stronach sekcji, które nie mają własnego wyboru. Ponowne kliknięcie (✓) go zdejmuje.
- **Edytuj** (albo kliknięcie miniatury) otwiera wzorzec do edycji. **Nowy pusty wzorzec** tworzy czysty szablon. Menu **⋯**: nazwa, duplikowanie, kolejność, usunięcie.
- **Wzorce standardowe** to gotowe szablony: numer strony na dole albo przy zewnętrznej krawędzi, stopka, nagłówek, linie do pisania, kratka, ramka, zakładka na brzegu. Dopasowują się do formatu i marginesów bieżącej sekcji. Po **Dodaj do projektu** zmieniasz je jak własne.
- Strona może mieć **kilka wzorców naraz**, np. „tło miesiąca” i „stopka”. Sekcja ma swoje wzorce domyślne, a pojedyncza strona może mieć własny wybór (właściwości strony → **Wzorce**).
- Elementy wzorca leżą **pod** treścią strony. Zaznacz element we wzorcu i włącz **Nad treścią strony**, jeśli ma ją przykrywać (ramka, znak wodny).
- **Odbijaj lustrzanie na lewych stronach**: element narysowany przy prawej krawędzi (np. numer strony) na lewych stronach rozkładówek przejdzie na lewą krawędź.
- Numer strony: wpisz w tekście wzorca `{nr}`. Pełna lista pól, także liczby rzymskie i odwołania do innych sekcji, jest w rozdziale **Pola w tekście**.
- Edycję wzorca poznasz po fioletowym pasku nad stroną; **Gotowe** wraca do stron. Na zwykłych stronach elementów wzorca nie da się zaznaczyć ani przesunąć – widać je na liście warstw, a kliknięcie tam otwiera wzorzec.

## 15. Dane: tabele

Dane do powielanych stron trzymasz w tabelach projektu. Tabela to arkusz: kolumny mają nazwy, a każdy wiersz to jedna powielona strona (albo jeden blok stron).

![Okno „Dane”: lista tabel z lewej, edytor tabeli z prawej.](https://andrish97.github.io/book/img/instrukcja/dane.png)
*Okno „Dane”: lista tabel z lewej, edytor tabeli z prawej.*

- Okno otwiera przycisk **Dane** na górnym pasku edytora.
- **Importuj plik** wczytuje CSV albo Excel. Pierwszy wiersz pliku to nazwy kolumn. Z pliku Excela powstaje po jednej tabeli na każdy arkusz. Separator (średnik, przecinek, tabulator) i kodowanie polskich znaków aplikacja rozpoznaje sama.
- Z pliku Excela (`.xlsx`) przechodzi też **wygląd komórek**: pogrubienie, kursywa i kolor liter. Komórka wygląda tak samo w oknie Dane, a na stronie jej wartość wstawiona w pole dostaje ten wygląd – np. święta pogrubione na czerwono wprost z arkusza. Przechodzi też wygląd **części tekstu** w komórce – np. jedno pogrubione słowo zostaje pogrubione na stronie. Przełącznik **Przenoś wygląd komórek na strony** nad tabelą to wyłącza (wygląd zostaje zapisany).
- **Wygląd komórki w oknie Dane**: kliknij komórkę (`Shift`+kliknięcie zaznacza prostokąt kilku komórek) i użyj przycisków **B** (pogrubienie), **I** (kursywa), koloru liter albo **Bez wyglądu**. Pogrubienie i kursywa przełączają się: gdy wszystkie zaznaczone komórki je mają – znikają. Zmiana tekstu komórki zdejmuje wygląd części tekstu (przestaje pasować do liter), wygląd całej komórki zostaje.
- Plik CSV, `.xls`, `.ods` i szablon danych nie niosą wyglądu. Gdy takim plikiem podmieniasz dane tabeli, wygląd **zostaje w komórkach, których wartość się nie zmieniła** (ten sam wiersz i ta sama kolumna); przy zmienionych wartościach znika. Po imporcie aplikacja mówi, w ilu komórkach wygląd został.
- Wszystko jest tekstem: liczby i daty trafiają do tabeli tak, jak je widać w arkuszu. Datę najlepiej rozbić na osobne kolumny, np. `dzien`, `miesiac`, `rok`.
- Tabelę możesz **poprawiać w aplikacji**: kliknij komórkę i pisz. `Enter` przechodzi wiersz niżej, `Shift`+`Enter` robi nową linię w komórce. **+ Wiersz** i **+ Kolumna** dodają miejsce, znak × przy wierszu albo kolumnie je usuwa.
- Dane skopiowane z Excela albo Arkuszy Google wklejasz od zaznaczonej komórki (`Ctrl`+`V`). Tabela sama rośnie w dół i w prawo.
- Nazwę kolumny zmieniasz, klikając jej nagłówek. Aplikacja poprawi tę nazwę we wszystkich tekstach projektu.
- Poprawiłeś dane w arkuszu? Zaimportuj plik jeszcze raz. Gdy w projekcie jest tabela o tej samej nazwie, aplikacja zapyta, czy podmienić jej dane.
- **CSV** pobiera tabelę jako plik – np. żeby dokończyć ją w arkuszu.
- **Wiersz pomijany** wstawia wiersz ze znacznikiem `[pomiń]` w pierwszej komórce – nad wierszem, w którym stoi kursor, a bez kursora na początku tabeli. W serii taki wiersz zajmuje miejsce w bloku stron, ale strona dla niego nie powstaje; służy do wyrównania danych z blokiem (rozdział „Serie: powielanie stron”). Wiersz jest szary i ma podpis „pomijany”.
- Długa tabela (tysiące wierszy) przewija się w całości – kolejne wiersze dorysowują się w miarę przewijania.
- **Pilnowanie powtórzeń**: znak **≠** przy nazwie kolumny oznacza, że wartości w niej nie powinny się powtarzać (np. tagi, hasła dnia). Powtórzone komórki są podświetlone na czerwono, a przed drukiem aplikacja pokaże, na których stronach ta sama wartość wypada dwa razy. Wielkość liter i zbędne spacje nie mają znaczenia: „Praca”, „praca ” i „PRACA” to ta sama wartość.
- **Lista dozwolonych wartości**: znak **☰** przy nazwie kolumny otwiera okno, w którym wpisujesz wartości – każdą w osobnym wierszu albo po średniku, np. `praca; dom; wolne`. Przycisk **Usuń listę** ją usuwa. Komórki z inną wartością są podświetlone, przed drukiem aplikacja je wymieni, a w szablonie danych komórki tej kolumny dostają listę rozwijaną.

## 16. Pola w tekście

Pole to nazwa w nawiasach klamrowych wpisana w zwykły tekst, np. `{dzien}. {miesiac}`. Na powielonej stronie w jego miejsce wchodzi wartość z tabeli. Są też pola dokumentu – numer strony, nazwa sekcji, data – które wynikają z samego projektu, tak jak pola w Wordzie.

![Pola w edytorze mają fioletowe tło; pole, którego aplikacja nie zna – czerwone.](https://andrish97.github.io/book/img/instrukcja/pola.png)
*Pola w edytorze mają fioletowe tło; pole, którego aplikacja nie zna – czerwone.*

- Pole najprościej wstawić z listy **Wstaw pole** we właściwościach tekstu – lista zaczyna się od kolumn tabeli tej strony, potem są pola dokumentu. Możesz je też wpisać ręcznie.
- Potrzebujesz **zwykłych klamer** w tekście, np. `{uwaga}` jako napisu? Zaznacz tekst i włącz **Klamry { } to zwykły tekst, nie pola** (przełącznik pojawia się, gdy w tekście są klamry). W tym tekście nic nie będzie podstawiane.
- Pole i zwykłe klamry **w jednym tekście**: wpisz klamry podwójnie. `{{` i `}}` w podglądzie i w PDF stają się pojedynczymi klamrami, a pola obok działają jak zwykle – np. `Dzień {dzien}, wzór {{x}}` da „Dzień 5, wzór {x}”.
- Pola z tabeli działają na stronach, które należą do **serii** z tą tabelą (następny rozdział). Pola dokumentu działają wszędzie, także we wzorcach.
- W edytorze widzisz nazwy pól, a na miniaturze i w **Podglądzie** – prawdziwe dane.
- Pole o nieznanej nazwie (np. literówka) dostaje czerwone tło i trafia na listę **Ostrzeżenia**.
- Formatowanie fragmentu z polem zostaje przy wstawionej wartości: pogrubione `{dzien}` da pogrubioną liczbę.
- Gdy kolumna tabeli nazywa się tak samo jak pole dokumentu, na stronach tej tabeli wygrywa kolumna.

### Pola dokumentu

| | |
|---|---|
| `{nr}` | Numer strony (według ustawień numeracji sekcji) |
| `{nr_ogolny}` | Kolejny numer strony w całym projekcie, licząc od 1 |
| `{nr_w_sekcji}` | Numer strony w jej sekcji, licząc od 1 |
| `{liczba_stron}` | Liczba stron w całym projekcie (ostatni numer) |
| `{liczba_stron_sekcji}` | Liczba stron w sekcji |
| `{sekcja}` | Nazwa sekcji |
| `{nr_sekcji}` | Numer sekcji |
| `{strona}` | Nazwa strony |
| `{projekt}` | Nazwa projektu |
| `{seria}` | Nazwa serii, do której należy strona |
| `{egzemplarz}` | Numer powielenia w serii (1, 2, 3…) |
| `{liczba_egzemplarzy}` | Liczba powieleń serii |
| `{data}` | Dzisiejsza data (dd.mm.rrrr) |
| `{rok}` | Bieżący rok |
| `{poczatek}` | Numer pierwszej strony sekcji o podanej nazwie, np. `{poczatek:Notatki}` |
| `{koniec}` | Numer ostatniej strony sekcji o podanej nazwie, np. `{koniec:Notatki}` |
| `{nr_strony}` | Numer strony o podanej nazwie, np. `{nr_strony:Styczeń}` |

### Zapis liczby (po dwukropku, przy każdym polu z liczbą)

| | |
|---|---|
| `{nr}` | 1, 2, 3 |
| `{nr:00}` | 01, 02, 03 (tyle cyfr, ile zer) |
| `{nr:I}` | I, II, III |
| `{nr:i}` | i, ii, iii |
| `{nr:A}` | A, B, C |
| `{nr:a}` | a, b, c |

## 17. Serie: powielanie stron

Seria to strona albo kilka sąsiednich stron (blok), które w wydruku powtarzają się wiele razy – np. strona dnia po jednej na każdy wiersz tabeli. W edytorze projektujesz blok raz, jako wzór.

![Podgląd: strona-wzór powielona dla kolejnych wierszy tabeli, z kolejnymi numerami stron.](https://andrish97.github.io/book/img/instrukcja/serie.png)
*Podgląd: strona-wzór powielona dla kolejnych wierszy tabeli, z kolejnymi numerami stron.*

- We właściwościach strony (nic nie zaznaczone) wybierz **Seria → + Nowa seria…**. W oknie serii wskaż tabelę z danymi.
- Kilka stron w bloku: nadaj tę samą serię sąsiednim stronom. Powielają się razem, w swojej kolejności.
- **Ile razy powielić**: tyle razy, ile wierszy ma tabela, albo stałą liczbę razy (np. 12 miesięcy; dane z tabeli idą wtedy w kółko).
- **Jak czytać tabelę**: jeden wiersz na cały blok (kolumny np. `s1_tytul`, `s2_tytul` dla kolejnych stron bloku) albo jeden wiersz na każdą stronę bloku.
- Strony serii mają na liście stron fioletowy znaczek z liczbą powieleń, np. **×31**.
- **Seria kończy się na ostatnim wierszu danych.** Przy „jednym wierszu na każdą stronę bloku” ostatnie powielenie może być niepełne: blok 8 stron i 30 wierszy dają 30 stron, nie 32. Jeśli wolisz dokończyć blok stronami bez danych, zaznacz **Dokończ ostatni blok**.
- **Dane zaczynają się w środku bloku – wiersze pomijane.** Przykład: kalendarz na 365 dni, blok 8 stron na tydzień (siedem dni i strona notatek), a rok zaczyna się w czwartek. Bez niczego pierwszy dzień roku trafiłby na stronę poniedziałku. Dlatego na początku tabeli dopisujesz **trzy wiersze pomijane** – za poniedziałek, wtorek i środę, których w tym roku nie ma. Wiersz pomijany ma w **pierwszej komórce** znacznik `[pomiń]` (można pisać `[pomin]`, wielkość liter nie ma znaczenia); reszta komórek może zostać pusta.
- Wiersz pomijany **zajmuje swoje miejsce w bloku, ale jego strona nie powstaje**: nie ma jej w podglądzie, w PDF ani w numeracji. W przykładzie pierwszą stroną wydruku jest strona czwartku (czwarta strona bloku), a zaraz po niej piątek, sobota, niedziela i notatki. Koniec roku nie wymaga niczego: seria kończy się na ostatnim wierszu danych, więc jeśli 31 grudnia wypada w środę, strony od czwartku po prostu nie powstają.
- Jak wstawić wiersz pomijany: w oknie **Dane** kliknij komórkę w wierszu, **nad którym** ma stanąć, i naciśnij **Wiersz pomijany** (bez kliknięcia w tabelę wiersz stanie na samym początku). Możesz też wpisać `[pomiń]` ręcznie – w aplikacji, w Excelu albo w pliku CSV. Taki wiersz jest w oknie Dane szary, z podpisem „pomijany” przy numerze.
- Wiersze pomijane mogą stać także **w środku tabeli** (np. tydzień przerwy) – zawsze znaczą to samo: miejsce jest zajęte, strony nie ma. Przy „jednym wierszu na cały blok” wiersz pomijany pomija **całe powielenie bloku**. Przy stałej liczbie powieleń dane idą w kółko tylko po wierszach z danymi.
- Liczenie się nie przesuwa: **tabele dodatkowe** („co 8 stron”, „gdy zmieni się kolumna”) i pole `{egzemplarz}` liczą miejsca razem z pomijanymi. Tabela tygodni ustawiona „co 8 stron” sama trafia więc w granice tygodni – pierwszy, niepełny tydzień jest tygodniem numer 1 i nie trzeba wpisywać, przez ile stron obowiązuje pierwszy wiersz. Pola `{nr}` i `{liczba_stron}` liczą tylko strony, które naprawdę powstają.
- Okno serii i właściwości strony pokazują, **ile stron wyjdzie w wydruku i ile wierszy jest pomijanych**. Fioletowy znaczek na liście stron (np. **×52**) liczy, ile razy ta strona naprawdę wychodzi; **×0** znaczy, że wszystkie jej wiersze są pomijane i w wydruku jej nie ma.
- **Dodatkowe tabele**: dane, które zmieniają się rzadziej niż strony serii. Przykład: strony dni biorą dane z tabeli dni, a hasło tygodnia – z tabeli tygodni, która przechodzi do następnego wiersza **co 7 stron**. Gdy pierwszy okres jest krótszy (rok zaczyna się w środę), wpisz, przez ile stron obowiązuje pierwszy wiersz – albo dodaj na początku tabeli dni wiersze pomijane (wyżej), wtedy nic nie trzeba wpisywać.
- Okresy nierównej długości – np. **miesiące** (28–31 dni): na liście **Nowy wiersz** zamiast stałej liczby stron wybierz **gdy zmieni się kolumna…** i wskaż kolumnę tabeli głównej, np. `miesiac`. Tabela miesięcy przejdzie do następnego wiersza dokładnie tam, gdzie w tabeli dni zmienia się miesiąc.
- Gdy okres wyznaczają **dwie kolumny** – np. miesiąc i rok w kalendarzu na kilka lat – po wybraniu pierwszej kolumny pojawia się lista **albo kolumna**: wskaż w niej drugą (i kolejne). Nowy wiersz zaczyna się, gdy zmieni się wartość w **którejkolwiek** z nich, więc grudzień 2027 i grudzień 2028 to dwa osobne okresy, nawet gdy stoją obok siebie.
- Pole z tabeli dodatkowej wpisujesz z nazwą tabeli: `{Tygodnie.haslo}`. Sama nazwa kolumny też działa, jeśli nie ma jej w tabeli głównej. Na liście **Wstaw pole** tabele dodatkowe mają własną grupę.
- **Brak danych**: gdy tabeli dodatkowej zabraknie wierszy przed końcem serii, okno serii i właściwości strony pokazują to na czerwono (ile wierszy jest, ile potrzeba, od której strony pola będą puste). To samo trafia na listę uwag przed eksportem PDF.
- Okno serii pokazuje, **jakich danych potrzebują strony**: wszystkie pola użyte na stronach bloku. Jeśli w tabeli brakuje kolumny, **Dodaj brakujące kolumny** dopisze je jednym kliknięciem (bez tabeli – utworzy ją z tych pól).
- **Pobierz szablon danych (Excel)** daje plik z kolumnami dokładnie takimi, jakich wymagają strony, razem z tym, co już jest w tabeli. Drugi arkusz, „Instrukcja”, opisuje każdą kolumnę. Wypełniony plik importujesz w oknie **Dane** – aplikacja zaproponuje podmianę danych tabeli.
- W szablonie komórki części kolumn mają **listę rozwijaną**: kolumna z dozwolonymi wartościami (☰ w oknie Dane) – tylko te wartości; kolumna z nazwą pliku obrazu – nazwy obrazów wgranych do projektu; kolumna z kadrem – góra, dół, lewa, prawa, środek; kolumna, od której zależy widoczność elementu – sprawdzana wartość. Trzy ostatnie listy to podpowiedzi: komórka przyjmie też inną wartość (np. punkt kadru w procentach).
- Powielone strony nie są zapisywane osobno – powstają na bieżąco. Po zmianie tabeli podgląd od razu pokazuje nowe dane.
- Numery stron liczą się po powieleniu: strona za serią 31 dni dostaje numer o 31 większy. Pole `{nr}` trzyma się ustawień numeracji sekcji, a `{nr_ogolny}` liczy wszystkie strony projektu od 1.
- **Serie w rozkładówkach – lewa i prawa strona.** W oknie serii jest ustawienie **Pilnuj lewej i prawej strony – wstaw pustą stronę, gdy trzeba** (widoczne, gdy projekt ma rozkładówki; w nowych seriach od razu włączone). Z nim strona zaprojektowana jako lewa wychodzi w wydruku po lewej, a prawa po prawej – cokolwiek dzieje się z danymi.
- Kiedy pojawia się **pusta strona**: gdy seria zaczyna się od nieparzystej liczby wierszy pomijanych (pierwsza prawdziwa strona jest prawa, więc przed nią staje pusta lewa); gdy wiersz pomijany stoi w środku danych; oraz **za serią**, gdy dane kończą się na lewej stronie – wtedy prawa jest pusta, a następna strona projektu stoi tam, gdzie stała w układzie stron. Pusta strona jest biała, bez wzorców i bez numeru na kartce, ale **liczy się w numeracji** – tak jak w drukowanych książkach.
- W edytorze blok wygląda zawsze tak samo: strony stoją parami jak na liście stron, niezależnie od tego, od którego miejsca zaczynają się dane. **Sprawdź przed drukiem** wypisuje, na których stronach stoją puste strony. Gdy ustawienie jest wyłączone, a strony bloku wypadają po przeciwnej stronie rozkładówki, ta sama lista ostrzega o tym i mówi, od której strony.
- Blok o **nieparzystej** liczbie stron (np. jedna strona na dzień) z natury wychodzi na przemian po lewej i po prawej – wzorce z odbiciem lustrzanym ustawiają się wtedy same. W takim bloku ustawienie pilnuje tylko strony **za serią**. Starsze serie mają ustawienie wyłączone, żeby ich wydruk się nie zmienił; włączysz je jednym kliknięciem w oknie serii.

## 18. Kolor i położenie z danych

Element może zmieniać kolor, miejsce albo rozmiar na kolejnych powielonych stronach. Tak robi się na przykład zakładki na brzegu strony: na każdej stronie niżej i w innym kolorze – albo słupki o wysokości z tabeli.

![Podgląd: ta sama zakładka na sześciu powielonych stronach – kolor z kolumny tabeli, położenie z numeru powielenia.](https://andrish97.github.io/book/img/instrukcja/zakladki.png)
*Podgląd: ta sama zakładka na sześciu powielonych stronach – kolor z kolumny tabeli, położenie z numeru powielenia.*

- Zaznacz element i rozwiń **Z danych** we właściwościach.
- **Kolor z pola**: wybierz kolumnę, w której wpisane są kolory, np. `#d1495b`, `2e86ab` albo nazwę koloru po angielsku (`navy`). Pusta albo błędna wartość zostawia kolor wzoru. Linia i kształt bez wypełnienia dostają kolor obrysu.
- Gdy element jest wypełniony **przejściem kolorów**, przejście zostaje, a pod listą pól wybierasz, co kolor z pola w nim zmienia: **pierwszy kolor** (tak jest od razu po wybraniu pola), **ostatni kolor** albo **całe przejście w odcieniach** koloru z pola – pierwszy kolor to kolor z pola, a pozostałe są od niego jaśniejsze albo ciemniejsze tak jak we wzorze. Ostatnia możliwość, **całe wypełnienie**, zastępuje przejście jednym kolorem.
- **Przesunięcie w pionie / w poziomie z pola**: wybierz pole z liczbą. Może to być kolumna tabeli albo pole dokumentu, np. `{egzemplarz}` – numer powielenia serii (1, 2, 3…).
- Lista **Wartość pola to** → **numer pozycji**: element przesuwa się o **krok** (w mm) za każdą kolejną pozycję. **Od nowa co 6** znaczy, że pozycja 7 wraca na miejsce pierwszej – dwanaście miesięcy ułoży się w dwóch seriach po sześć na wysokość strony.
- **Wartość pola to** → **przesunięcie w mm**: liczba z tabeli jest wprost przesunięciem względem wzoru (może być ujemna, z przecinkiem).
- **Szerokość z pola / Wysokość z pola**: wybierz pole z liczbą – każdy wymiar osobno. Wartość to **procent rozmiaru wzoru** (100 = bez zmian, 50 = połowa) albo **rozmiar w mm**. Lista **Przy zmianie rozmiaru na miejscu zostaje** wybiera punkt zaczepienia: lewy górny róg, środek albo dół – słupek wykresu z kotwicą „dół” rośnie w górę. Wartość 0 chowa element; pole puste albo bez liczby zostawia rozmiar wzoru.
- Co znaczy zmiana rozmiaru: **tekst** dostaje węższą albo szerszą ramkę i układa się od nowa (wysokość działa przy stałej wysokości ramki) – litery się nie rozciągają; **obraz** zmienia ramkę – obraz z kolumny wpisuje się w nią tak, jak ustawiono („zmieść” albo „wypełnij”), zwykły obraz ją wypełnia, a nadmiar jest przycinany; **tabela** zmienia szerokości kolumn i najmniejsze wysokości wierszy; **kształty i grupy** są skalowane.
- **Obrót z pola**: liczba z pola to kąt w stopniach, dodawany do obrotu wzoru. Element obraca się wokół swojego środka – np. wskazówka albo strzałka ustawiona inaczej na każdej stronie.
- **Pokaż element**: zawsze albo tylko wtedy, gdy wybrane pole **nie jest puste**, **jest puste** albo **równa się** wpisanej wartości (wielkość liter nie ma znaczenia). Tak robi się np. gwiazdkę przy świętach: kolumna `swieto` wypełniona tylko w niektórych wierszach i gwiazdka pokazywana „gdy pole nie jest puste”.
- W edytorze element stoi w miejscu pozycji 1, ma kolor, rozmiar i obrót wzoru i jest zawsze widoczny. Właściwy wygląd każdej strony widać w **Podglądzie**, na miniaturach i w PDF.
- Na lewych stronach rozkładówki element wzorca z odbiciem lustrzanym przesuwa się lustrzanie – zakładka trafia na zewnętrzny brzeg.
- Pole, którego aplikacja nie zna, trafia na listę **Ostrzeżenia**, tak jak nieznane pole w tekście.

## 19. Ramka tekstu i obrazy z danych

Teksty z tabeli mają różną długość, a układ strony ma zostać taki sam. Do tego służy ramka o stałej wysokości. Obraz też może przychodzić z tabeli.

![Ramka o stałej wysokości: tekst wyrównany do dołu, zmniejszany, gdy się nie mieści. Ustawienia są we właściwościach tekstu.](https://andrish97.github.io/book/img/instrukcja/ramka-tekstu.png)
*Ramka o stałej wysokości: tekst wyrównany do dołu, zmniejszany, gdy się nie mieści. Ustawienia są we właściwościach tekstu.*

- Zaznacz tekst i włącz **Stała wysokość ramki**. Wysokość wpisujesz w mm albo zmieniasz górnym lub dolnym uchwytem.
- **Tekst w pionie**: do góry, na środku albo do dołu ramki.
- **Zmniejszaj tekst, gdy się nie mieści**: czcionka maleje, aż tekst zmieści się w ramce, ale nie poniżej **najmniejszego rozmiaru**. Krótszy tekst wraca do rozmiaru zadanego. Fragmenty z własnym rozmiarem (np. większy tytuł w tej samej ramce) maleją razem z resztą, w tej samej proporcji, i razem z nią wracają do swojego rozmiaru.
- Tekst, który mimo to się nie mieści, jest ucinany na dolnej krawędzi ramki i trafia na listę **Ostrzeżenia**.
- **Obraz z danych**: wstaw dowolny obraz jako wzór (wyznacza miejsce i rozmiar), zaznacz go i wybierz **kolumnę z nazwą pliku**. Na każdej powielonej stronie pojawi się obraz o nazwie z tej kolumny, bez zmiany proporcji.
- **Podmieniony obraz** może **mieścić się w ramce** (cały widoczny, z wolnym miejscem po bokach albo u góry) albo **wypełniać ramkę** (bez pustych pasów, brzegi przycięte) – wybierz to, gdy zdjęcia mają różne proporcje, a układ ma być równy. Przy wypełnianiu wybierasz też, **która część zdjęcia zostaje**: środek, góra, dół, lewa albo prawa strona (np. „góra” przy portretach, żeby nie ucinać głów).
- Gdy każde zdjęcie wymaga innego przycięcia, wybierz **Kadr z kolumny**: w tej kolumnie tabeli wpisujesz dla każdego wiersza `góra`, `dół`, `lewa`, `prawa` albo `środek` (można po dwa: `góra lewa`; także bez polskich znaków i po angielsku), albo **punkt zdjęcia w procentach** od lewej i od góry, np. `30% 20%` – kadr ustawi się tak, żeby ten punkt był w środku ramki. Pusta komórka zostawia ustawienie obrazu-wzoru.
- Pliki obrazów wgrywasz naraz przyciskiem **Wgraj obrazy do projektu**. W tabeli wystarczy nazwa pliku, z rozszerzeniem albo bez.

## 20. Kolumny i przelewanie tekstu

Dłuższy tekst może płynąć przez kilka ramek: to, co nie mieści się w pierwszej, pojawia się w następnej. Tak powstają kolumny i teksty, które zaczynają się w jednym miejscu strony, a kończą w innym.

![Trzy połączone ramki (kolumny), listy z numerami i punktami oraz tabela. Fioletowa linia pokazuje, dokąd płynie tekst z zaznaczonej ramki.](https://andrish97.github.io/book/img/instrukcja/uklad.png)
*Trzy połączone ramki (kolumny), listy z numerami i punktami oraz tabela. Fioletowa linia pokazuje, dokąd płynie tekst z zaznaczonej ramki.*

- **Podziel na kolumny** (2, 3 albo 4) we właściwościach tekstu zamienia ramkę na kolumny obok siebie i rozkłada tekst po równo.
- **Dodaj ramkę z ciągiem dalszym** tworzy drugą ramkę – obok, a gdy się nie mieści, pod spodem. Przesuń ją, gdzie chcesz.
- **Ciąg dalszy na następnej stronie** tworzy ramkę na następnej stronie (gdy bieżąca jest ostatnia w sekcji – razem z nową stroną). Tekst płynie wtedy **przez strony**: dłuższe opowiadanie, regulamin albo wstęp układasz w ramkach na kolejnych stronach, a aplikacja sama pilnuje, co jest na której.
- Dwie istniejące ramki połączysz, zaznaczając je razem i wybierając **Połącz ramki tekstu**. Tekst płynie z góry na dół, a w ramkach leżących obok siebie – od lewej.
- O tym, ile tekstu zostaje w ramce, decyduje jej **wysokość**. Zmień ją uchwytem albo liczbą, a tekst ułoży się od nowa. Ostatnia ramka bierze całą resztę; jeśli i tam się nie mieści, zobaczysz ostrzeżenie.
- Piszesz w dowolnej z ramek, a tekst **przelewa się na bieżąco**: gdy ramka się zapełni, pisany tekst przechodzi do następnej i kursor idzie za nim; gdy coś usuniesz, tekst z następnych ramek wraca. Jeśli następna ramka jest **na innej stronie**, aplikacja sama otwiera tę stronę i piszesz dalej bez przerwy – znaki wciśnięte w chwili przejścia nie giną.
- Na granicy ramek klawisze działają jak w jednym tekście: `Backspace` na początku ramki usuwa znak z końca poprzedniej, `Delete` na końcu – znak z początku następnej, a strzałki w lewo i w prawo przechodzą do sąsiedniej ramki. Strzałka **w dół** w ostatnim wierszu ramki przenosi kursor do pierwszego wiersza następnej, a **w górę** w pierwszym wierszu – do ostatniego wiersza poprzedniej; kursor staje pod (nad) miejscem, w którym stał, liczonym od lewego brzegu ramki. Gdy sąsiednia ramka jest na innej stronie, działa to tak samo: aplikacja otwiera tę stronę, gdy kursor do niej trafia (strzałką albo kasując wstecz).
- **Cały połączony tekst naraz**: zaznaczenia w tekście nie da się rozciągnąć z jednej ramki do drugiej (Shift ze strzałkami zatrzymuje się na końcu ramki). Zamiast tego naciśnij w trakcie pisania `Ctrl`+`A` **dwa razy** – pierwszy raz zaznacza tekst tej ramki, drugi **cały połączony tekst**, razem z ramkami na innych stronach – albo kliknij **Zaznacz cały połączony tekst** we właściwościach ramki. Ramki tekstu na stronie są wtedy podświetlone. Zmiana wyglądu (czcionka, rozmiar, pogrubienie, kolor…) obejmuje całość, także fragmenty, które miały własny wygląd; `Ctrl`+`C` kopiuje cały tekst, a `Delete` go usuwa – ramki zostają połączone i puste. Kliknięcie gdzie indziej albo ponowne pisanie kończy ten tryb.
- Przy ramce połączonej z ramkami na innych stronach panel pokazuje przyciski **Poprzednia ramka** i **Następna ramka** z numerem strony – przenoszą prosto do niej.
- Po przestawieniu stron tekst płynący przez strony układa się w nowej kolejności stron: początek jest zawsze na wcześniejszej stronie, ciąg dalszy na późniejszej.
- Wygląd tekstu (czcionka, rozmiar, kolor, wyrównanie, lista) jest wspólny dla połączonych ramek. Pogrubienia i kolory fragmentów wędrują razem z tekstem.
- Pola z danych działają jak zwykle: na każdej powielonej stronie tekst przelewa się osobno, zależnie od długości wartości z tabeli.
- Usunięcie jednej z ramek nie usuwa tekstu – wraca on do pozostałych. **Rozłącz ramki** zostawia każdą ramkę z jej częścią tekstu.
- Zaznaczaniem łączysz ramki widoczne razem (jedna strona albo rozkładówka); między stronami łączy przycisk „Ciąg dalszy na następnej stronie”. Kopia połączonej ramki i kopia całej strony są zwykłymi, niepołączonymi ramkami. Usunięcie strony nie usuwa płynącego przez nią tekstu – wraca on do ramek na pozostałych stronach.
- W serii tekst płynie między stronami tego samego powielenia bloku: każde powielenie przelewa swoje dane osobno.

## 21. Tabela

Tabela to jeden element strony z wierszami i kolumnami. Wstawiasz ją przyciskiem **Tabela** na pasku nad stroną.

![Tabela z tłem nagłówka, co drugim wierszem w kolorze i scaloną komórką; po prawej jej ustawienia.](https://andrish97.github.io/book/img/instrukcja/tabela.png)
*Tabela z tłem nagłówka, co drugim wierszem w kolorze i scaloną komórką; po prawej jej ustawienia.*

- **Pojedyncze kliknięcie** zaznacza całą tabelę – przesuwasz ją, obracasz i układasz w warstwach jak każdy inny element. Na liście warstw to jeden wiersz „Tabela”; trójkąt przy nim pokazuje jej komórki, a kliknięcie komórki na liście zaczyna w niej pisanie.
- **Podwójne kliknięcie komórki** zaczyna w niej pisanie. `Tab` przechodzi do następnej komórki, `Shift`+`Tab` do poprzedniej; `Tab` w ostatniej komórce dodaje nowy wiersz. Kliknięcie innej komórki przenosi tam pisanie, `Esc` kończy je i wraca do zaznaczenia całej tabeli.
- Komórka to zwykły tekst: wstawisz w niej **pole z danych** (np. `{opis}`), pogrubisz fragment, zmienisz czcionkę. W trakcie pisania panel z prawej pokazuje ustawienia tekstu tej komórki.
- **Wiersz rośnie razem z tekstem.** Gdy treść komórki nie mieści się w wysokości wiersza, cały wiersz robi się wyższy – także na stronach powielanych z danych, osobno dla każdej strony. Tekst w tabeli nigdy nie jest ucinany.
- **Szerokość kolumn**: przy zaznaczonej tabeli nad granicami kolumn widać niebieskie znaczniki – przeciągnij znacznik, a granica się przesunie (kolumna obok zwęża się o tyle samo; ostatni znacznik zmienia szerokość całej tabeli). Dokładne szerokości wpiszesz liczbami w panelu; **Równe szerokości** wyrównuje kolumny.
- **Wiersze i kolumny**: przyciski w panelu dodają i usuwają ostatni wiersz albo kolumnę. W trakcie pisania w komórce przyciski dotyczą jej wiersza i kolumny: wstaw wiersz poniżej, usuń ten wiersz, wstaw kolumnę z prawej, usuń tę kolumnę.
- **Scalanie komórek**: w trakcie pisania w komórce panel ma przyciski **Scal z komórką po prawej** i **Scal z komórką poniżej**. Klikając kilka razy, zrobisz komórkę na kilka kolumn albo wierszy – np. tytuł przez całą szerokość tabeli. Tekst nie znika: to, co było w dołączanych komórkach, dopisuje się do scalonej komórki jako kolejne akapity (wierszami, od lewej). **Rozdziel komórki** przywraca osobne komórki – cały tekst zostaje w pierwszej (lewej górnej), a stan sprzed scalenia przywraca `Ctrl`+`Z`. Linie siatki nie przecinają scalonej komórki, a `Tab` ją przeskakuje jak jedną.
- W panelu tabeli ustawisz też: **wiersz nagłówka** (pogrubiony, z grubszą linią pod spodem), kolor i grubość linii (0 = bez linii) oraz czcionkę, rozmiar, kolor i wyrównanie tekstu we wszystkich komórkach naraz.
- **Linie jednej komórki**: w trakcie pisania w komórce panel ma część **Linie tej komórki**. Każdą krawędź – u góry, u dołu, z lewej, z prawej – ustawiasz osobno: **jak w tabeli**, **bez linii** albo **własna** (swoja grubość i kolor). Tak zrobisz grubszą kreskę pod wierszem sumy, ramkę wokół jednej komórki albo tabelę bez linii pionowych w wybranym miejscu. Krawędź jest wspólna z sąsiednią komórką, więc zmienia się u obu; w scalonej komórce dotyczy całego jej boku. Wstawiane i usuwane wiersze i kolumny przesuwają te ustawienia razem z komórkami.
- **Linie całego wiersza, kolumny albo tabeli**: pod liniami komórki jest część **Linie wiersza, kolumny, tabeli**. Wybierasz, **do czego zastosować** (ten wiersz, ta kolumna, cała tabela) i **które linie** (obramowanie, wewnętrzne poziome, wewnętrzne pionowe albo wszystkie), ustawiasz kolor i grubość i klikasz **Ustaw te linie**. **Bez linii** je chowa, a **Jak w tabeli** zdejmuje własne ustawienia – linie znów wyglądają jak siatka. Przy zaznaczonej całej tabeli ta sama część nazywa się **Obramowanie i linie wewnętrzne** – tak zrobisz grubą ramkę wokół tabeli albo tabelę z samymi liniami poziomymi. To te same ustawienia co przy pojedynczej komórce, tylko nadawane wielu krawędziom naraz, więc potem każdą krawędź możesz jeszcze poprawić osobno.
- **Tło wierszy**: osobny kolor tła dla wiersza nagłówka i dla co drugiego wiersza treści (tabela w paski czyta się łatwiej). Oba są opcjonalne.
- **Wysokość wierszy**: najmniejsza wysokość wspólna dla wszystkich wierszy albo osobna dla każdego – lista wierszy w panelu tabeli, a w trakcie pisania pole „Najmniejsza wysokość tego wiersza”. Wiersz i tak urośnie, gdy tekst będzie wyższy.
- Narożne uchwyty zmieniają rozmiar tabeli: kolumny i wiersze dostają nowe wymiary już w trakcie przeciągania, a pismo zostaje w swoim rozmiarze.
- Na telefonie tabelę wstawiasz tym samym przyciskiem, a pisanie w komórce zaczynasz, **stukając w nią dwa razy**. Szerokości kolumn, wiersze i wygląd zmienisz w panelu właściwości.
- Tabele wstawione w starszej wersji (siatka i osobne ramki tekstu) zostają takie, jak były.

## 22. Eksport do PDF

Plik PDF do drukarni albo do obejrzenia: wszystkie strony w kolejności wydruku, razem z powieleniami serii. Znajdziesz go w menu **⋯** w edytorze.

![Okno eksportu: rodzaj pliku, zakres, przeznaczenie, opcje i lista rzeczy do sprawdzenia.](https://andrish97.github.io/book/img/instrukcja/pdf.png)
*Okno eksportu: rodzaj pliku, zakres, przeznaczenie, opcje i lista rzeczy do sprawdzenia.*

- **Rodzaj pliku – Wektorowy** (domyślny): tekst jest prawdziwym tekstem z osadzonymi czcionkami (da się go zaznaczyć i wyszukać, jest ostry w każdym powiększeniu), kształty, linie, gradienty i rysunki odręczne są wektorami, a zdjęcia JPEG i PNG idą w oryginale – bez ponownej kompresji i tylko raz w pliku, choćby były na stu stronach.
- **Rodzaj pliku – Obrazy stron**: każda strona jest jednym obrazem w wybranej rozdzielczości. Wygląda identycznie wszędzie, ale tekstu nie da się zaznaczyć, a plik jest większy.
- Litery stoją w pliku w tych samych miejscach co na ekranie. Także **ligatury** – połączone znaki w rodzaju „fi” czy „fl”, które wiele czcionek rysuje jednym kształtem – wyglądają w PDF tak jak w edytorze, a przy zaznaczaniu i wyszukiwaniu zostają zwykłymi literami.
- **Zamień tekst na krzywe** (wektorowy): litery stają się kształtami. Plik nie zawiera czcionek – tego często wymagają drukarnie – ale tekstu nie da się już zaznaczyć ani poprawić.
- **Standard dla drukarni – PDF/X-4**: plik dostaje **profil barwny warunków druku** i oznaczenia, po których programy drukarni rozpoznają standard. Wybierasz papier: **powlekany** (kredowy – okładki, albumy; FOGRA39) albo **niepowlekany** (offsetowy – środki notesów i planerów; FOGRA47). Jeśli drukarnia podała własny profil (np. ISO Coated v2 albo PSO Coated v3), wybierz **profil od drukarni** i wskaż plik `.icc`. Profil papieru powlekanego dodaje do pliku ok. 8 MB.
- **Kolory tekstu i kształtów w CMYK** (wektorowy): kolory są zapisane czterema farbami drukarskimi, a czarny tekst i szarości idą samą czarną farbą – litery są wtedy ostre. Razem z PDF/X-4 kolory są przeliczane **przez profil** wybranego papieru (tak jak robią to programy do składu); bez standardu – prostym wzorem, który papieru nie zna.
- **Zdjęcia też w CMYK** (wektorowy z PDF/X-4): zdjęcia są przeliczane przez ten sam profil, w rozdzielczości z pola „Jakość”. Zdjęcie JPEG zostaje JPEG-iem, tylko w czterech farbach; pozostałe obrazy (PNG, obrazy z przezroczystością) są zapisywane bez strat. Plik jest większy niż z oryginalnymi zdjęciami. Bez tej opcji zdjęcia zostają w RGB z opisem sRGB i na farby przelicza je drukarnia według dołączonego profilu; to też jest zgodne z PDF/X-4 i zwykle wystarcza.
- **Obrazy stron w CMYK** (obrazy stron z PDF/X-4): cały obraz strony jest przeliczany przez profil. Czarny i szary tekst, kształty i cienie idą **samą czarną farbą** – także wtedy, gdy leżą na zdjęciu – i są zapisane bez strat, co do piksela. Same zdjęcia idą czterema farbami, jak wynika z profilu, i są zapisane jako JPEG (pod spodem; reszta strony leży na nich z maską), dzięki czemu strona ze zdjęciem zajmuje kilka razy mniej niż zapisana w całości bez strat. Biel to czysty papier. Tekst zostaje obrazem: nie da się go zaznaczyć, a jego ostrość zależy od pola **Jakość** (do druku 300 dpi lub więcej).
- Którą opcję wybrać? Zapytaj drukarnię, czego wymaga. Jeśli mówi „PDF/X-4” – wybierz standard i jej papier. Jeśli mówi „wszystko w CMYK” – zaznacz dodatkowo oba pola CMYK. **Przed pierwszym zleceniem wyślij próbny plik**: aplikacja buduje go według normy, ale nie sprawdza go programem kontrolnym drukarni.
- Czego nie da się zapisać wektorowo, trafia do pliku jako obraz **tego jednego elementu**: element z cieniem, element przycięty maską, tekst ze znakiem spoza czcionki, rysunek SVG z filtrem, maską albo wzorem. Rozdzielczość tych obrazów ustawiasz w polu **Jakość**.
- **Rysunki SVG** idą do pliku jako wektory: aplikacja rozkłada rysunek na kształty i sprawdza, czy wyglądają tak samo jak oryginał; jeśli nie – rysunek zostaje obrazem.
- Tekst pisany czcionką, której nie da się osadzić (własny plik WOFF2, czcionka zmienna, kursywa bez własnego pliku), jest zapisywany jako **krzywe**: ostry, ale nie do zaznaczenia. Po eksporcie aplikacja wypisuje osobno, co poszło jako obraz, a co jako krzywe.
- **Zakres**: cały projekt, bieżąca sekcja albo strony od–do (kolejne numery stron w całym wydruku).
- **Do drukarni**: każda strona ma spad dookoła, a sekcje z włączonymi znakami cięcia dostają znaki cięcia. Plik zawiera informację o formacie po obcięciu i o spadzie, którą odczytują programy drukarni. **Do oglądania**: strony równo do formatu, bez spadu i znaków.
- **Jakość**: 300 dpi to standard do druku; 150 dpi daje mały plik na próbę; 600 dpi – bardzo ostro, kosztem rozmiaru pliku.
- **Podział na pliki**: jeden plik, osobny plik dla każdej sekcji albo części po zadanej liczbie stron. Kilka plików dostajesz w jednym archiwum ZIP.
- **Dołącz pliki czcionek użytych w projekcie**: dostaniesz archiwum ZIP z plikiem PDF i folderem `czcionki` ze zwykłymi plikami TTF z oficjalnego zestawu (i z własnymi czcionkami projektu). Opcja zaznacza się sama, gdy plik nie ma czcionek w środku: przy obrazach stron i przy tekście zamienionym na krzywe.
- **Do sprawdzenia przed drukiem**: na dole okna jest lista uwag do całego projektu (następny rozdział). Uwagi nie blokują eksportu. Długi eksport możesz przerwać przyciskiem **Przerwij**.

## 23. Sprawdź przed drukiem

Zanim wyślesz plik do drukarni, aplikacja przegląda cały projekt – już po powieleniu serii – i wypisuje miejsca, na które warto spojrzeć. Okno otwierasz z menu **⋯ → Sprawdź przed drukiem**; ta sama lista jest w oknie eksportu PDF.

![Lista uwag z numerami stron; „Pokaż” otwiera stronę, której dotyczy uwaga.](https://andrish97.github.io/book/img/instrukcja/kontrola.png)
*Lista uwag z numerami stron; „Pokaż” otwiera stronę, której dotyczy uwaga.*

- **Tekst nie mieści się w ramce**: aplikacja wstawia dane z każdego wiersza tabeli i sprawdza każdą powieloną stronę. Uwaga podaje, na których stronach tekst wystaje – np. gdy jedno hasło w tabeli jest dużo dłuższe od pozostałych.
- **Pole bez wartości**: w tekście jest pole, którego aplikacja nie zna (literówka, usunięta kolumna).
- **Brak pliku obrazu**: w kolumnie z nazwami obrazów jest nazwa, do której nie wgrano pliku.
- **Powtórzenia** w kolumnach oznaczonych znakiem ≠ – z numerami stron, na których ta sama wartość wypada dwa razy.
- **Wartości spoza listy** w kolumnach z listą dozwolonych wartości (znak ☰) – z numerami wierszy tabeli.
- **Brak danych** w tabeli dodatkowej serii i **niepełny ostatni blok** serii.
- **Strony serii w rozkładówkach**: gdzie aplikacja wstawiła puste strony, a przy wyłączonym **Pilnuj lewej i prawej strony** – od której strony strony bloku wychodzą po przeciwnej stronie rozkładówki. Seria, której wszystkie wiersze są pomijane, też dostaje uwagę.
- **Tabela wychodzi poza stronę**: wiersze tabeli rosną razem z treścią, więc na stronie z dłuższymi danymi tabela może wyjść poza kartkę. Uwaga podaje, na których stronach i o ile milimetrów.
- Przycisk **Pokaż** przy uwadze otwiera podgląd na pierwszej stronie, której uwaga dotyczy – już z danymi tego powielenia, z wyróżnioną kartką. **Otwórz wzór** otwiera w edytorze stronę-wzór z zaznaczonym elementem, żeby od razu go poprawić. Sprawdzanie tekstów w dużym projekcie trwa chwilę – lista uzupełnia się na bieżąco.

## 24. Podgląd

Podgląd pokazuje cały projekt tak, jak będzie wyglądał po przycięciu – bez linii pomocniczych i bez możliwości przypadkowej zmiany.

![Podgląd: rozkładówki obok siebie, z numerami stron z wzorca.](https://andrish97.github.io/book/img/instrukcja/podglad.png)
*Podgląd: rozkładówki obok siebie, z numerami stron z wzorca.*

- Otwórz go przyciskiem **Podgląd** na górnym pasku edytora albo z menu **⋯** projektu na liście.
- **Prezentacja** pokazuje jedną stronę albo rozkładówkę naraz na całym ekranie. Strzałki i spacja przewracają strony, `Esc` zamyka. Działa także w podglądzie otwartym z linku.
- Podgląd pokazuje projekt po powieleniu: każdą stronę serii tyle razy, ile wynika z danych, z jej numerem i podpisem „3 z 31”.
- Strony idą po kolei, rozkładówki stoją obok siebie. Przyciski **−** i **+** zmieniają powiększenie, kliknięcie liczby dopasowuje do okna.
- Kliknięcie strony otwiera ją w edytorze. **Edytor** albo `Esc` wraca do edycji.

## 25. Udostępnianie linkiem

Podgląd możesz pokazać komuś, kto nie ma konta – np. klientowi albo drukarni – wysyłając link. Projekt ma jeden link.

![Okno „Udostępnij podgląd” z gotowym linkiem.](https://andrish97.github.io/book/img/instrukcja/udostepnianie.png)
*Okno „Udostępnij podgląd” z gotowym linkiem.*

- W podglądzie kliknij **Udostępnij**, potem **Utwórz link**. Aplikacja przygotuje obrazy wszystkich stron – przy dużym projekcie chwilę to potrwa.
- Skopiuj link i wyślij go. Osoba z linkiem widzi strony tak jak w podglądzie; nie może nic zmienić i nie ma dostępu do reszty Twoich projektów.
- **Link aktualizuje się sam**: kilka sekund po zapisaniu zmian na koncie aplikacja wysyła obrazy tych stron, które się zmieniły. Adres zostaje ten sam. **Aktualizuj teraz** robi to od ręki.
- **Unieważnij link** usuwa udostępnione strony; stary adres przestaje działać. Ponowne udostępnienie daje nowy adres.
- Projekt z czynnym linkiem ma na liście projektów plakietkę **Udostępniony** – kliknięcie otwiera to samo okienko, bez wchodzenia do projektu.
- Link jest długi i losowy, więc nie da się go zgadnąć – ale każdy, kto go dostanie, może go przekazać dalej.
- **Ochrona linku** (w tym samym okienku): **Hasło** – osoba z linkiem widzi najpierw pole hasła i dopiero po wpisaniu poprawnego zobaczy strony. **Ważny do wybranego dnia** – dzień wybierasz w kalendarzu (strzałki obok nazwy miesiąca zmieniają miesiąc, **Dziś** wybiera dzisiejszy dzień; dni, które już minęły, są wyszarzone); po tym dniu link pokazuje „Link wygasł”. Możesz ustawić jedno, drugie albo oba, także przed utworzeniem linku. **Zapisz ochronę** zmienia ustawienia istniejącego linku – adres zostaje ten sam.
- Hasło zmienisz, wpisując nowe; puste pole przy zaznaczonym haśle zostawia dotychczasowe. Odznaczenie obu pól zdejmuje ochronę. Po 10 błędnych próbach link na kwadrans przestaje przyjmować hasła.
- Strony linku z ochroną nie leżą w publicznym folderze: aplikacja wydaje je dopiero po sprawdzeniu daty i hasła, a hasło jest zapisane tylko w postaci, z której nie da się go odczytać. Nie wysyłaj hasła w tej samej wiadomości co link.

## 26. Praca z AI

Asystent AI (Claude, ChatGPT) może czytać i poprawiać jeden projekt razem z Tobą. Jego zmiany pojawiają się w otwartym edytorze po chwili – tak jak zmiany z drugiego urządzenia.

![Nowy klucz dla AI z gotowymi ustawieniami dla Claude.](https://andrish97.github.io/book/img/instrukcja/dostep-ai.png)
*Nowy klucz dla AI z gotowymi ustawieniami dla Claude.*

- **Podłączenie Claude krok po kroku** (aplikacja Claude na komputer): 1) zainstaluj [Node.js](https://nodejs.org/), jeśli go nie masz; 2) w edytorze utwórz klucz (niżej) i pobierz z okna plik **seriodruk-mcp.mjs** – zapisz go np. w Dokumentach; 3) w Claude: **Settings → Developer → Edit Config** (po polsku: Ustawienia → Programista → Edytuj konfigurację) i wklej tekst z okna „Dostęp dla AI”, wpisując w nim ścieżkę do pobranego pliku; 4) zamknij i otwórz Claude ponownie – w narzędziach rozmowy pojawi się **seriodruk**; 5) napisz np. „Przejrzyj mój projekt w Seriodruku i popraw literówki w tytułach”.
- W **Claude Code** wystarczą dwa polecenia, które okno pokazuje gotowe do skopiowania. **ChatGPT** podłącza się przez własnego GPT z akcjami – krok po kroku w dokumencie [Dostęp dla AI](https://andrish97.github.io/book/ai/api.md).
- W edytorze menu **⋯** → **Dostęp dla AI…**. Wpisz, dla kogo jest klucz, wybierz **Czyta i zmienia** albo **Tylko czyta** i ważność (1, 7 albo 30 dni), potem **Utwórz klucz**.
- Klucz widać **tylko raz** – skopiuj go od razu. Okno pokazuje gotowe ustawienia dla Claude Desktop i Claude Code; opis podłączenia ChatGPT jest w dokumencie [Dostęp dla AI](https://andrish97.github.io/book/ai/api.md).
- Klucz otwiera **tylko ten projekt**: AI może zmieniać strony, elementy, wzorce, style, tabele danych, serie i sekcje, ale nie utworzy ani nie usunie projektu, nie wgra obrazów ani czcionek i nie zobaczy innych projektów.
- Zmiany AI łączą się z Twoimi element po elemencie: gdy Ty przesuwasz zdjęcie, a AI poprawia tytuł, zostają obie zmiany. **Cofnij** zdejmuje tylko Twoje zmiany.
- Lista w tym samym oknie pokazuje aktywne klucze i to, kiedy ostatnio ich użyto. **Odbierz** wyłącza klucz od razu.

> Klucz trafia do firmy, która prowadzi AI. Dawaj najkrótszą ważność, jaka wystarczy, i odbieraj klucz po skończonej pracy. Przed dużymi zmianami zrób **Eksport** projektu.

## 27. Linie i ostrzeżenia

Na stronie widać linie pomocnicze. Nie są drukowane.

![Element wychodzący w margines i lista ostrzeżeń.](https://andrish97.github.io/book/img/instrukcja/ostrzezenia.png)
*Element wychodzący w margines i lista ostrzeżeń.*

- **Czerwona linia** – krawędź strony po przycięciu.
- **Różowy pas** – spad. Tła i zdjęcia, które mają sięgać krawędzi, rozciągnij aż do jego końca.
- **Niebieska przerywana** – margines. Teksty trzymaj wewnątrz.
- Element w marginesie lub poza spadem dostaje pomarańczową ramkę i trafia na listę **Ostrzeżenia**. Jeśli to celowe (np. tło na spad), kliknij **Wycisz**.
- Linie ukryjesz przyciskiem w prawym dolnym rogu, obok powiększenia.

## 28. Siatka, linijki i prowadnice

Narzędzia do równego układania elementów. Włączasz je w menu pod przyciskiem z kratką w prawym dolnym rogu płótna: **Siatka**, **Przyciągaj do siatki**, **Krok siatki**, **Przyciągaj do elementów i pokazuj odległości**, **Linijki**, **Zablokuj prowadnice**, **Usuń prowadnice z tej strony** i **W rozkładówkach pokazuj jedną stronę**.

![Siatka co 5 mm, linijki i dwie własne prowadnice (turkusowe).](https://andrish97.github.io/book/img/instrukcja/siatka.png)
*Siatka co 5 mm, linijki i dwie własne prowadnice (turkusowe).*

- **Siatka**: linie co zadany krok w mm, liczone od rogu strony. **Przyciągaj do siatki** sprawia, że lewy górny róg przesuwanego elementu staje na linii siatki.
- **Linijki** pokazują milimetry; zero leży w rogu strony, na której pracujesz.
- **Prowadnica**: przeciągnij z górnej linijki w dół (pozioma) albo z lewej w prawo (pionowa). Prowadnicę można przesunąć; wyciągnięta poza stronę znika. Prowadnice zapisują się razem ze stroną.
- **Prowadnica liczbą**: we właściwościach strony (nic nie zaznaczone) jest część **Prowadnice** – lista z położeniem każdej w mm, przyciski dodania pionowej i poziomej oraz usuwanie. Tak ustawisz prowadnicę dokładnie, także na telefonie, gdzie linijek nie ma.
- Elementy przyciągają się do prowadnic, marginesów, krawędzi i środka strony – przy przesuwaniu i przy zmianie rozmiaru uchwytem.
- Przytrzymaj `Ctrl` przy przeciąganiu, żeby na chwilę wyłączyć przyciąganie.
- **Zablokuj prowadnice** (w menu z kratką): zablokowanych prowadnic nie da się złapać ani przesunąć myszą – nie przesuniesz ich przypadkiem, celując w element. Liczbą we właściwościach strony nadal je ustawisz.
- Dodanie, przesunięcie i usunięcie prowadnicy cofniesz `Ctrl`+`Z`, jak każdą inną zmianę.
- Siatka i prowadnice nie są drukowane. Klawisz `W` chowa wszystkie linie pomocnicze.

## 29. Odległości i równe odstępy

Podczas przesuwania elementu aplikacja pokazuje, jak leży względem innych – tak jak inteligentne linie pomocnicze w programach Adobe.

![Trzeci kwadrat w równym odstępie od drugiego: oba odstępy mają tę samą liczbę na fioletowym tle.](https://andrish97.github.io/book/img/instrukcja/odleglosci.png)
*Trzeci kwadrat w równym odstępie od drugiego: oba odstępy mają tę samą liczbę na fioletowym tle.*

- **Różowa linia** pojawia się, gdy krawędź albo środek elementu zrównuje się z innym elementem. Element sam „wskakuje” na tę linię.
- **Strzałki z liczbą** pokazują odległość w mm do najbliższego elementu z lewej, prawej, z góry i z dołu. Gdy naprzeciwko nie ma sąsiada, mierzony jest najbliższy element po skosie – cienka linia przedłuża wtedy jego krawędź. Do takiego sąsiada widać też **odległość w linii prostej** (po przekątnej): przerywany odcinek z liczbą łączy najbliższe sobie punkty obu elementów – zwykle narożniki, a przy elemencie obróconym także punkt na jego boku. Obrócony element liczy się swoim prawdziwym kształtem, nie prostokątem dookoła.
- **Równe odstępy**: gdy odstęp od sąsiada jest taki sam jak inny odstęp w tym rzędzie (albo element stoi dokładnie na środku między sąsiadami), obie strzałki dostają fioletową etykietę.
- Przytrzymaj `Alt` przy zaznaczonym elemencie, żeby zobaczyć jego odległości także do krawędzi strony.
- Przyciąganie do elementów wyłączysz w menu z kratką.

## 30. Warstwy

Zakładka „Warstwy” w prawym panelu (obok „Właściwości”) pokazuje wszystkie elementy otwartej strony, od leżącego na wierzchu do leżącego na spodzie.

![Lista warstw: oko ukrywa element, kłódka go blokuje, strzałki zmieniają kolejność.](https://andrish97.github.io/book/img/instrukcja/warstwy.png)
*Lista warstw: oko ukrywa element, kłódka go blokuje, strzałki zmieniają kolejność.*

- Kliknięcie nazwy zaznacza element – przydatne, gdy leży pod innym i trudno w niego trafić.
- Kolejność zmienisz, przeciągając wiersz wyżej albo niżej, albo przyciskami **▲** i **▼** (wygodne na ekranie dotykowym).
- **Oko** ukrywa element. Ukryty element zostaje w projekcie, ale nie jest drukowany.
- **Kłódka** blokuje położenie i rozmiar.
- Podwójne kliknięcie nazwy pozwala ją zmienić.
- Na dole i na górze listy widać **elementy wzorców** tej strony (pod treścią i nad treścią), z nazwą wzorca. Nie zmienisz ich tutaj – kliknięcie otwiera wzorzec do edycji.
- Zgrupowane elementy są na liście jednym wierszem „Grupa”. Trójkąt przy grupie **rozwija jej zawartość**: pod spodem widać elementy grupy, każdy z własnym okiem (ukrywa tylko ten element) i nazwą, którą zmienisz podwójnym kliknięciem. **Kliknięcie elementu grupy otwiera grupę i zaznacza ten element** – zmienisz go bez rozgrupowywania (grupa jest wtedy oznaczona na liście pomarańczowym paskiem); kliknięcie innego wiersza listy ją zamyka.
- **Tabelę też rozwiniesz** trójkątem: pod nią stoją jej komórki wierszami – numer „wiersz.kolumna” i początek treści. Kliknięcie komórki na liście **zaczyna w niej pisanie**, tak jak podwójne kliknięcie na stronie; przydaje się w gęstej tabeli i przy małych komórkach. Komórki nie mają własnego oka ani kłódki – ukrywa się i blokuje całą tabelę.

## 31. Tablet, telefon i instalacja

Aplikacja działa w przeglądarce na tablecie, telefonie i komputerze. Można ją też zainstalować jak zwykły program.

![Telefon trzymany pionowo: strona u góry, panel wysuwa się z dołu.](https://andrish97.github.io/book/img/instrukcja/telefon.png)
*Telefon trzymany pionowo: strona u góry, panel wysuwa się z dołu.*

- **Jeden palec** – zaznaczanie i przesuwanie elementów. **Dwa palce** – przesuwanie widoku i powiększanie.
- **Na telefonie edytor działa w pionie.** Panele **Strony**, **Właściwości**, **Warstwy** i **Ostrzeżenia** otwierasz przyciskami na dole ekranu; panel wysuwa się z dołu i ma stałą wysokość, więc nie skacze, gdy przeglądarka chowa pasek adresu.
- Telefon trzymany poziomo pokazuje planszę „Za mało miejsca na wysokość” – pasek adresu i panele nie zostawiają wtedy miejsca na stronę. To samo zobaczysz na komputerze w bardzo niskim oknie (poniżej 480 px). Lista projektów, logowanie i udostępniony podgląd działają w obu ułożeniach.
- **Dwa szybkie stuknięcia** działają jak podwójne kliknięcie: zaczynają pisanie w komórce tabeli, otwierają grupę, zaczynają edycję punktów kształtu. **Tabela** i **pióro** są na pasku wstawiania także na telefonie: piórem stawiasz punkty stuknięciami, a kształt kończysz przyciskiem **Zakończ kształt** we właściwościach (albo stuknięciem w pierwszy punkt – wtedy kształt jest zamknięty). Punkty kształtu przeciągasz palcem po stuknięciu **Edytuj punkty** – przed przeciąganiem zamknij panel właściwości, żeby nie zasłaniał strony.
- Na małym ekranie schowane są narzędzia, którymi trudno sterować palcem: wielokąt, kadrowanie ramką i linijki. Prowadnice wpisujesz liczbą, a obraz przytniesz liczbami we właściwościach. Na bardzo wąskim ekranie pasek wstawiania przewija się w bok.
- **Pełny ekran**: przycisk z czterema narożnikami na liście projektów, w edytorze i w podglądzie (na telefonie – w menu ⋯) chowa paski przeglądarki; `Esc` albo ten sam przycisk wraca. Na iPhonie przeglądarka nie pozwala stronie na pełny ekran – tam daje go zainstalowanie aplikacji.
- **Instalacja na Androidzie** (Chrome): menu ⋮ → **Zainstaluj aplikację** / **Dodaj do ekranu głównego**. Zainstalowana aplikacja nie ma paska adresu, więc na stronę zostaje więcej miejsca.
- **Instalacja na Macu** (Chrome lub Edge): ikona instalacji w pasku adresu. W Safari: Plik → **Dodaj do Docka**.
- Zainstalowana aplikacja na komputerze otwiera pliki `.seriodruk` dwuklikiem.

## 32. Zapis, pliki i kilka urządzeń

Zmiany zapisują się same: najpierw na urządzeniu, a po około sekundzie na koncie.

![Menu projektu na liście projektów.](https://andrish97.github.io/book/img/instrukcja/menu.png)
*Menu projektu na liście projektów.*

- Stan zapisu widać obok nazwy projektu: **Zapisano**, **Zapisywanie…** albo **Offline** – wtedy zmiany czekają na urządzeniu.
- **Zmiany na żywo.** Gdy ten sam projekt masz otwarty na dwóch urządzeniach (albo w dwóch kartach), zmiana zapisana na jednym pojawia się na drugim po chwili – bez odświeżania strony. Jeśli akurat piszesz, przeciągasz element albo masz otwarte okno, aplikacja poczeka, aż skończysz, i wróci kursorem w to samo miejsce. Zmiana strony, której nie masz na ekranie, w ogóle nie rusza tego, nad czym pracujesz – odświeża się tylko jej miniatura. Lista projektów też aktualizuje się sama.
- Gdy połączenie na żywo nie działa (np. w sieci firmowej), aplikacja sprawdza konto sama: po powrocie do karty, po odzyskaniu internetu i co pół minuty.
- **Praca na dwóch urządzeniach.** Jeśli ten sam projekt zmieniono w międzyczasie gdzie indziej, aplikacja nic nie nadpisze, tylko **połączy zmiany**: strony, wzorce, tabele danych, sekcje, serie i style zmienione tylko w jednym miejscu zostają z obu urządzeń, bez pytania. Zobaczysz komunikat „Połączono zmiany z innego urządzenia”.
- Na tej samej stronie (i w tym samym wzorcu) zmiany łączą się **element po elemencie**: gdy na jednym urządzeniu przesuniesz zdjęcie, a na drugim poprawisz tytuł, zostaną obie zmiany. Pytanie pojawia się tylko wtedy, gdy **ten sam element** (albo to samo ustawienie strony, np. tło czy nazwę, albo tę samą tabelę danych, styl…) zmieniono w obu miejscach. Okno wymienia wyłącznie takie rzeczy i przy każdej pozwala wybrać: **z tego urządzenia** albo **z konta**. Tekst płynący przez kilka połączonych ramek jest jedną całością: pytanie dotyczy całego tekstu, a wybrana wersja obejmuje wszystkie jego ramki.
- Po połączeniu **Cofnij** działa dalej: cofa tylko to, co zrobiono na tym urządzeniu. Zmiany, które przyszły z innego urządzenia, zostają przy każdym kroku wstecz i do przodu.
- Wyjątek: gdy projekt wczytasz z pliku `.seriodruk` w miejsce istniejącego, a na koncie jest już inna wersja, aplikacja nie ma z czym porównać zmian i pyta o cały projekt: zachować wersję z tego urządzenia czy wczytać wersję z konta.
- **Cofnij** i **Ponów** (`Ctrl`+`Z`) obejmują cały projekt: zmiany na stronach i wzorcach, dodawanie i usuwanie stron, sekcje, style, dane i serie. Po cofnięciu edytor otwiera stronę, której dotyczyła zmiana. Historia sięga 80 kroków wstecz i jest zapisywana na urządzeniu: po zamknięciu projektu (albo przeglądarki) i ponownym otwarciu na tym samym urządzeniu **Cofnij** działa dalej. Zmiany z innego urządzenia, które dojdą w tym czasie, zostają – cofanie zdejmuje tylko to, co zrobiono tutaj. Gdy historii nie da się do nich dopasować, zaczyna się od nowa (aplikacja o tym mówi). Zmiany zrobione w jednym otwarciu okna **Dane** to jeden krok. Historia znika, gdy usuniesz projekt albo wczytasz w jego miejsce plik `.seriodruk`.
- Na konto wysyłane są tylko te strony, które się zmieniły – duży projekt zapisuje się tak samo szybko jak mały.
- **Zdjęcia nie obciążają pamięci.** Oryginał każdego obrazu leży w osobnym magazynie przeglądarki (na dysku), a w edytorze pracuje lżejsza kopia. Projekt z setkami zdjęć otwiera się i zapisuje tak jak mały; po oryginał aplikacja sięga dopiero przy eksporcie do PDF, PNG albo do pliku projektu. Na drugim urządzeniu obrazy pobierają się z konta raz, przy pierwszym otwarciu projektu.
- **Eksport** zapisuje cały projekt do pliku `.seriodruk` (kopia zapasowa), **Importuj** wczytuje go z powrotem, **Duplikuj** tworzy kopię projektu, np. na kolejny rok.
- W edytorze menu **⋯** eksportuje projekt do **PDF** (osobny rozdział) i pobiera bieżącą stronę jako obraz PNG w 300 dpi, ze spadem.
- Czcionki i silnik edytora są częścią aplikacji, a przeglądarka zapamiętuje je po pierwszym uruchomieniu – kolejne starty nie czekają na sieć, a edytor działa także bez internetu. Wszystkie biblioteki (także do PDF, Excela i plików ZIP) są częścią aplikacji – nic nie jest pobierane z obcych serwerów. Te do PDF, Excela i ZIP przeglądarka wczytuje przy pierwszym użyciu i potem też działają bez sieci.
- Lista projektów otwiera się szybko, bo nie wczytuje edytora – ten doczytuje się w tle. Jeśli otworzysz projekt, zanim skończy, przez chwilę zobaczysz „Wczytuję edytor…”.
- Po wdrożeniu nowej wersji aplikacji, gdy masz otwarty projekt, na dole ekranu pojawi się **Jest nowa wersja aplikacji** z przyciskiem **Odśwież** – zmiany zapiszą się przed odświeżeniem. Bez otwartego projektu nowa wersja włącza się sama.
- Każdy ekran ma własny adres – odświeżenie zostawia Cię w tym samym miejscu, a „Wstecz” w przeglądarce wraca do poprzedniego ekranu.

## 33. Skróty klawiszowe

Skróty są takie jak w programach do składu i grafiki. `Ctrl` na Macu to `⌘`. Tę listę otwiera klawisz `?`.

### Edycja

| | |
|---|---|
| `Ctrl` `Z` | Cofnij (zmiany na stronach, w układzie stron, sekcjach, wzorcach, stylach i danych) |
| `Ctrl` `Shift` `Z` | Ponów |
| `Ctrl` `C` | Kopiuj |
| `Ctrl` `X` | Wytnij |
| `Ctrl` `V` | Wklej: element skopiowany w aplikacji (na innej stronie – w to samo miejsce) albo obraz ze schowka systemu – zrzut ekranu, skopiowany plik, kod SVG |
| `Ctrl` `D` | Duplikuj |
| `Delete` | Usuń |
| `Ctrl` `S` | Zapisz od razu (zapis i tak jest automatyczny) |

### Zaznaczanie

| | |
|---|---|
| `Ctrl` `A` | Zaznacz wszystko na stronie (w otwartej grupie: jej elementy) |
| `Esc` | Odznacz (w otwartej grupie: wróć do całej grupy) |
| `Tab` | Następny element |
| `Shift` `Tab` | Poprzedni element |
| `Enter` | Edytuj zaznaczony tekst |

### Przesuwanie

| | |
|---|---|
| `Strzałki` | Przesuń o 1 mm |
| `Shift` `Strzałki` | Przesuń o 10 mm |
| `Alt` `Strzałki` | Przesuń o 0,1 mm |
| `Shift przy przeciąganiu` | Tylko w poziomie albo w pionie; przy obracaniu – co 15° |
| `Alt przy przeciąganiu` | Przeciągnij kopię, oryginał zostaje |
| `Ctrl przy przeciąganiu` | Bez przyciągania do linii, elementów i siatki |
| `Alt (przytrzymany)` | Pokaż odległości zaznaczonego elementu do sąsiadów i krawędzi strony |

### Układ

| | |
|---|---|
| `Ctrl` `G` | Grupuj |
| `Ctrl` `Shift` `G` | Rozgrupuj |
| `Ctrl` `]` | Warstwa wyżej |
| `Ctrl` `[` | Warstwa niżej |
| `Ctrl` `Shift` `]` | Na wierzch |
| `Ctrl` `Shift` `[` | Na spód |
| `Ctrl` `L` | Zablokuj albo odblokuj |

### Tekst

| | |
|---|---|
| `Ctrl` `B` | Pogrubienie |
| `Ctrl` `I` | Kursywa |
| `Ctrl` `U` | Podkreślenie |
| `Ctrl` `Shift` `L` | Wyrównaj do lewej |
| `Ctrl` `Shift` `E` | Wyśrodkuj |
| `Ctrl` `Shift` `R` | Wyrównaj do prawej |
| `Ctrl` `Shift` `J` | Wyjustuj |
| `Ctrl` `Shift` `.` | Większa czcionka (o 1 pt) |
| `Ctrl` `Shift` `,` | Mniejsza czcionka (o 1 pt) |
| `Ctrl` `Shift` `8` | Lista z punktami (włącz / wyłącz) |
| `Ctrl` `Shift` `7` | Lista numerowana (włącz / wyłącz) |

### Wstawianie

| | |
|---|---|
| `T` | Tekst |
| `R` | Prostokąt |
| `E` | Elipsa |
| `L` | Linia |
| `B` | Rysowanie odręczne (włącz / wyłącz; Esc kończy) |
| `N` | Pióro: kształt z punktów i krzywych (włącz / wyłącz; Enter kończy kształt, Esc porzuca) |
| `P` | Wielokąt |
| `I` | Obraz z dysku |

### Widok

| | |
|---|---|
| `Ctrl` `` `` | Powiększ |
| `Ctrl` `−` | Pomniejsz |
| `Ctrl` `0` | Dopasuj do okna |
| `Ctrl` `1` | Powiększenie 100% |
| `Ctrl` `kółko myszy` | Powiększanie w miejscu kursora |
| `Spacja` `przeciąganie` | Przesuwanie widoku („rączka”) |
| `W` | Pokaż albo ukryj linie pomocnicze |
| `Ctrl` `'` | Pokaż albo ukryj siatkę |
| `Ctrl` `Shift` `'` | Przyciąganie do siatki |
| `Shift` `R` | Pokaż albo ukryj linijki |
| `Shift` `W` | Podgląd bez edycji |

### Strony

| | |
|---|---|
| `PageUp` | Poprzednia strona |
| `PageDown` | Następna strona |
| `Ctrl` `Shift` `P` | Nowa strona za bieżącą |
| `?` | Ta lista skrótów |

> Skróty z literami działają, gdy kursor nie stoi w polu formularza. W trakcie pisania tekstu na stronie działają skróty z grupy „Tekst”.

## 34. Co będzie dalej

Edytor, dane, powielanie stron i eksport do PDF działają. Co jeszcze przed nami:

- **Własna poczta**: wiadomości z potwierdzeniem konta i resetem hasła z własnej domeny.
