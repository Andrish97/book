# Część III. Dane i serie {ikona=dane}

Tabele danych, pola w tekście i strony powielane z tabeli.

# 14. Tabele danych

Dane trzymasz w tabelach projektu; z nich biorą się wartości pól i powielane strony.

## 14.1 Okno Dane

Tabela to arkusz: kolumny mają nazwy (np. `dzien`, `imie`), a wiersze — wartości. Z tabel biorą się
wartości pól w tekście (→ 15) i powielone strony (→ 16).

Okno otwiera [Dane] na górnym pasku edytora. Z lewej jest lista tabel projektu, z prawej wybrana tabela.
[+] dodaje pustą tabelę, [Importuj CSV albo Excel] — tabelę z pliku (→ 14.2), [Wiersz pomijany] — wiersz
`[pomiń]` (→ 16.4), a [Pobierz tabelę jako plik CSV] daje tabelę do dokończenia w arkuszu.
Zmiany z jednego otwarcia okna cofniesz jednym [Cofnij].

![Okno Dane](dane.png)

## 14.2 Import z Excela i CSV

[Importuj CSV albo Excel] wczytuje plik `.xlsx`, `.xls`, `.ods` albo `.csv`:

- pierwszy wiersz pliku to nazwy kolumn,
- z pliku Excela powstaje po jednej tabeli na każdy arkusz,
- separator (średnik, przecinek, tabulator) i polskie znaki aplikacja rozpoznaje sama,
- liczby i daty trafiają do tabeli tak, jak je widać w arkuszu. Datę najlepiej rozbić na osobne
  kolumny, np. `dzien`, `miesiac`, `rok`.

Poprawiłeś dane w arkuszu? Zaimportuj plik jeszcze raz. Gdy w projekcie jest tabela o tej samej
nazwie, aplikacja zapyta, czy podmienić jej dane.

### Źródło danych przypięte do tabeli

Tabela pamięta, skąd przyszła. Pod jej nazwą widać pasek, np. „Dane z: goscie.xlsx, arkusz »Lista« · wczytano
18.11.2026, 14:20”. Oryginalny plik (do 5 MB) zostaje zapisany w projekcie – nie ma go wśród obrazów i nie znika
przy porządkach.

- [Wczytaj nową wersję…] – wybierasz poprawiony plik; pola i serie zostają. Zanim dane się podmienią, zobaczysz,
  co się zmieni: liczbę wierszy, zmienione komórki, nowe i usunięte kolumny, a osobno ostrzeżenie, gdy znika kolumna
  używana w polach stron (te pola byłyby puste).
- [Odśwież z pliku] – w Chrome i Edge na komputerze przeglądarka pamięta dostęp do pliku wybranego przez
  „Wczytaj nową wersję…”. Po poprawce w Excelu wystarczy jedno kliknięcie (przeglądarka może raz zapytać o zgodę).
- **zmienione w Makietce** – znacznik przy tabeli, którą poprawiano w oknie Dane po wczytaniu pliku. Nowa wersja
  pliku zastąpi te poprawki – pytanie o podmianę też o tym przypomni.
- Ikona strzałki w dół pobiera zapisany plik źródłowy, ikona tabeli – obecne dane jako plik Excela (`.xlsx`),
  kosz odpina źródło (dane zostają).

**Dane z linku** (ikona łańcucha obok [Importuj]) – wklej adres arkusza Google albo pliku CSV/XLSX w sieci.
Arkusz Google musi być publiczny: Plik → Udostępnij → Opublikuj w internecie → CSV (wystarczy też zwykły link do
arkusza dostępnego dla każdego, kto ma link). Tabela pamięta link, a [Odśwież z linku] pobiera dane od nowa,
z tym samym porównaniem zmian. Niektóre serwisy nie pozwalają na pobieranie z przeglądarki – wtedy aplikacja to
powie; pobierz plik i wczytaj go zwykłym importem.

## 14.3 Poprawianie danych w aplikacji

- Kliknij komórkę i pisz. <kbd>Enter</kbd> przechodzi wiersz niżej, <kbd>Shift</kbd>+<kbd>Enter</kbd>
  robi nową linię w komórce.
- Dane skopiowane z Excela albo Arkuszy Google wklejasz od zaznaczonej komórki (<kbd>Ctrl</kbd>+<kbd>V</kbd>);
  tabela sama rośnie w dół i w prawo.
- **×** przy wierszu albo kolumnie usuwa go.
- Nazwę kolumny zmieniasz, klikając nagłówek. Aplikacja poprawi tę nazwę we wszystkich polach projektu.

## 14.4 Wygląd komórek

Pogrubienie, kursywa i kolor liter z pliku Excela przechodzą na strony: wartość wstawiona w pole
dostaje wygląd swojej komórki — np. święta pogrubione na czerwono. Przechodzi też wygląd części
tekstu w komórce.

W oknie Dane zaznacz komórkę (<kbd>Shift</kbd>+kliknięcie zaznacza prostokąt kilku komórek) i użyj:
[B] — pogrubienie, [I] — kursywa, kolor liter, [Wyczyść wygląd] (gumka).

Przełącznik **Przenoś wygląd komórek na strony** wyłącza przenoszenie — wygląd zostaje zapisany
w tabeli.

## 14.5 Pilnowanie wartości

Przy nazwie każdej kolumny są dwa znaki:

| Znak | Co robi |
|---|---|
| **≠** | Wartości w kolumnie nie powinny się powtarzać (np. hasła dnia). Powtórzone komórki są czerwone, a przed drukiem aplikacja poda strony, na których ta sama wartość wypada dwa razy. Wielkość liter i spacje nie mają znaczenia. |
| **☰** | Lista dozwolonych wartości, np. `praca; dom; wolne`. Inne wartości są podświetlone i trafiają na listę przed drukiem; w szablonie danych komórki dostają listę rozwijaną. [Usuń listę] ją usuwa. |

# 15. Pola w tekście

Pole to miejsce w tekście, w które wchodzi wartość z tabeli albo z projektu, np. numer strony.

## 15.1 Wstawianie pola

Pole to nazwa kolumny w klamrach, wpisana w zwykły tekst, np. `Imieniny: {imieniny}`. Na gotowej
stronie w miejsce pola wchodzi wartość z tabeli.

Zaznacz tekst i wybierz kolumnę z listy [Wstaw pole] we właściwościach. Lista zaczyna się od kolumn
tabeli tej strony, dalej są pola dokumentu (→ 15.2). Pole możesz też wpisać ręcznie.

![Wstaw pole](k-wstaw-pole.png)

W edytorze pola mają fioletowe tło, a pole, którego aplikacja nie zna (np. literówka) — czerwone.
Prawdziwe wartości widać na miniaturach, w podglądzie i w PDF.

- Pola z tabeli działają na stronach serii z tą tabelą (→ 16).
- Pole z tabeli dodatkowej wpisujesz z nazwą tabeli: `{Tygodnie.haslo}` (→ 16.5).
- Pogrubione pole da pogrubioną wartość.

![Pola w tekście](pola.png)

## 15.2 Pola dokumentu

Pola dokumentu wynikają z samego projektu i działają na każdej stronie, także we wzorcach:

{{tabela-pol}}

Pola **z ustawień projektu** — `{format}`, `{oprawa}`, `{grzbiet}`, `{stron_bloku}`, `{papier}`,
`{rok_kalendarza}` (i `{projekt}`) — nie wymagają wpisywania: biorą wartość z ustawień sekcji, okładki i kalendarza
i zmieniają się razem z nimi, np. stopka redakcyjna „Format {format}, oprawa {oprawa}, {stron_bloku} stron”. Na liście
**Wstaw pole** są w osobnej grupie **Z ustawień projektu**. Gdy projekt nie ma okładki albo kalendarza, pole jest puste.

Gdy kolumna tabeli nazywa się tak samo jak pole dokumentu, na stronach tej tabeli wygrywa kolumna.

## 15.3 Zwykłe klamry

- Cały tekst bez pól: zaznacz tekst i włącz **Klamry { } to zwykły tekst, nie pola** (przełącznik
  pojawia się, gdy w tekście są klamry).
- Pole i klamry w jednym tekście: wpisz klamry podwójnie — `{{` i `}}` staną się pojedynczymi
  klamrami, np. `Dzień {dzien}, wzór {{x}}` da „Dzień 5, wzór {x}”.

# 16. Serie

Seria powiela stronę dla każdego wiersza tabeli — tak powstaje kalendarz na 365 dni z jednej strony.

## 16.1 Czym jest seria

Projektujesz jedną stronę dnia — dostajesz 365 stron, każdą z danymi swojego wiersza. Seria może
obejmować kilka sąsiednich stron (**blok**), np. tydzień na rozkładówce: wtedy cały blok powiela się razem.

Powielone strony nie są zapisywane osobno — powstają na bieżąco, więc zmiana tabeli od razu
zmienia publikację.

## 16.2 Nowa seria

1. Kliknij puste miejsce strony — właściwości pokażą ustawienia strony.
2. W polu **Seria** wybierz [+ Nowa seria…].
3. Ustaw serię w oknie (→ 16.3) i kliknij [Zapisz].
4. Kolejnym stronom bloku wybierz tę samą serię.

![Seria we właściwościach strony](k-seria.png)

Strony serii mają na liście stron fioletowy znaczek z liczbą powieleń, np. **×31**. **×0** znaczy,
że wszystkie wiersze tej strony są pomijane.

![Strony powielone w podglądzie](serie.png)

## 16.3 Ustawienia serii

Okno serii otwiera się po wybraniu [+ Nowa seria…], a dla istniejącej serii — przyciskiem
[Ustawienia serii] we właściwościach strony. Pod polem **Seria** widać, ile stron wyjdzie w wydruku.

| Ustawienie | Znaczenie |
|---|---|
| **Nazwa serii** | Nazwa na liście serii. |
| **Dane z tabeli** | Tabela, z której biorą się wiersze. |
| **Ile razy powielić** | Przełącznik: **Tyle, ile wierszy tabeli** albo **Stałą liczbę razy** (wtedy pojawia się pole **Liczba powieleń**) — np. 12 miesięcy; dane idą wtedy w kółko. |
| **Jak czytać tabelę** | Przełącznik: **Wiersz na cały blok** (kolumny np. `s1_tytul`, `s2_tytul` dla kolejnych stron) albo **Wiersz na każdą stronę**. |
| **Dokończ ostatni blok stronami bez danych** | Seria kończy się na ostatnim wierszu; z tym ustawieniem ostatni blok jest pełny. |
| **Pilnuj lewej i prawej strony** | W rozkładówkach (→ 16.6). |
| **Dodatkowe tabele** | Dane zmieniające się rzadziej niż strony (→ 16.5). |
| **Dane, których potrzebują strony** | Pola użyte na stronach bloku. [Dodaj brakujące kolumny do tabeli] dopisuje brakujące. |
| [Pobierz szablon danych (Excel)] | Plik z kolumnami, których potrzebują strony (→ 16.7). |

![Segmenty w oknie Serii](k-seria-segmenty.png)

## 16.4 Wiersze pomijane

Przykład: kalendarz z blokiem na tydzień (poniedziałek–niedziela), a rok zaczyna się w czwartek.
Bez niczego 1 stycznia trafiłby na stronę poniedziałku. Dopisz więc na początku tabeli trzy
**wiersze pomijane** — za poniedziałek, wtorek i środę.

Wiersz pomijany ma w pierwszej komórce znacznik `[pomiń]`. Zajmuje swoje miejsce w bloku, ale jego
strona nie powstaje: nie ma jej w podglądzie, w PDF ani w numeracji. Wstawisz go przyciskiem
[Wiersz pomijany] w oknie Dane — nad wierszem, w którym stoi kursor — albo wpiszesz `[pomiń]` w Excelu.

Koniec roku nie wymaga niczego: seria kończy się na ostatnim wierszu danych.

## 16.5 Tabele dodatkowe

Tabela dodatkowa daje dane, które zmieniają się rzadziej niż strony — np. hasło tygodnia na stronach
dni albo obrazek miesiąca. W oknie serii: [Dodaj tabelę], a potem **Nowy wiersz**:

- **co stałą liczbę stron** — np. co 7 stron dla tygodni,
- **gdy zmieni się kolumna „…”** — np. `miesiac`: nowy wiersz tam, gdzie w tabeli głównej zmienia się
  miesiąc. Kilka kolumn (np. miesiąc i rok) wybierzesz w kolejnych listach **albo kolumna**.

Pole z tabeli dodatkowej: `{Tygodnie.haslo}`. Gdy tabeli dodatkowej zabraknie wierszy, okno serii
pokaże to na czerwono, a przed drukiem — na liście uwag.

## 16.6 Serie w rozkładówkach

**Pilnuj lewej i prawej strony – wstaw pustą stronę, gdy trzeba** sprawia, że strona zaprojektowana
jako lewa zawsze wychodzi po lewej, a prawa po prawej. Gdy trzeba, aplikacja wstawia pustą białą
stronę — np. za serią, gdy dane kończą się na lewej stronie. Pusta strona liczy się w numeracji,
jak w drukowanych książkach. [Sprawdź przed drukiem] wypisuje, gdzie stoją puste strony.

## 16.7 Szablon danych

[Pobierz szablon danych (Excel)] daje plik z kolumnami dokładnie takimi, jakich wymagają strony,
razem z danymi, które już są w tabeli. Arkusz „Instrukcja” opisuje każdą kolumnę. Kolumny z listą
wartości, nazwami obrazów albo kadrem mają listy rozwijane. Wypełniony plik zaimportuj w oknie Dane.

# 17. Wygląd z danych

Kolor, położenie, obraz albo widoczność elementu mogą zmieniać się na każdej powielonej stronie.

## 17.1 Część Z danych

Element może zmieniać się razem z danymi na kolejnych powielonych stronach: kolor, miejsce, rozmiar,
obrót, obraz albo widoczność. Zaznacz element i rozwiń część **Z danych** we właściwościach.

W edytorze element wygląda jak wzór (pozycja 1, kolor wzoru, zawsze widoczny). Właściwy wygląd
każdej strony widać w podglądzie, na miniaturach i w PDF.

![Zakładka na brzegu: inne miejsce i kolor na każdej stronie](zakladki.png)

## 17.2 Kolor z pola

**Kolor z pola** — kolumna z kolorami, np. `#d1495b`, `2e86ab` albo nazwa po angielsku (`navy`).
Pusta albo błędna wartość zostawia kolor wzoru. Linia i kształt bez wypełnienia dostają kolor obrysu.
Przy wypełnieniu przejściem kolorów wybierasz, co zmienia kolor z pola: pierwszy kolor, ostatni
kolor albo całe przejście w odcieniach.

## 17.3 Położenie, rozmiar i obrót z pola

| Ustawienie | Znaczenie |
|---|---|
| **Przesunięcie w poziomie z pola**, **Przesunięcie w pionie z pola** | Pole z liczbą — kolumna tabeli albo np. `{egzemplarz}` (numer powielenia). |
| **Wartość pola to** | **numer pozycji** — element przesuwa się o **Krok** (mm) za każdą pozycję; **Od nowa co** N wraca na początek. Albo **przesunięcie w mm** — liczba z tabeli wprost. |
| **Szerokość z pola**, **Wysokość z pola** | Wartość to **procent rozmiaru wzoru (100 = bez zmian)** albo **rozmiar w mm**. **Przy zmianie rozmiaru na miejscu zostaje** — który bok albo róg stoi w miejscu. |
| **Obrót z pola (stopnie)** | Kąt dodawany do obrotu wzoru, np. wskazówka na każdej stronie inaczej. |

Tak robi się zakładki na brzegu strony — na każdej stronie niżej — albo słupki o wysokości z tabeli.

## 17.4 Pokaż element

**Pokaż element**: **zawsze** albo tylko wtedy, gdy wybrane pole **nie jest puste**, **jest puste**
albo **równa się** wpisanej wartości. Przykład: gwiazdka przy święcie — kolumna `swieto` i
„nie jest puste”.

## 17.5 Obraz z danych

Wstaw dowolny obraz jako wzór — wyznacza miejsce i rozmiar. We właściwościach obrazu, w części
**Obraz z danych**:

| Ustawienie | Znaczenie |
|---|---|
| **Kolumna z nazwą pliku** | W każdym wierszu nazwa pliku, np. `styczen.jpg`. Pliki wgrasz naraz w oknie Obrazy projektu (→ 7.5). |
| **Podmieniony obraz** | **mieści się w ramce (cały widoczny)** — z wolnym miejscem po bokach albo u góry; **wypełnia ramkę (brzegi przycięte)** — bez pustych pasów. |
| **Zostaje część zdjęcia** | Przy wypełnianiu: środek, góra, dół, lewa albo prawa strona — np. „góra”, żeby nie ucinać głów na portretach. |
| **Kadr z kolumny** | **ten sam na każdej stronie** albo kolumna, w której dla każdego zdjęcia wpiszesz `góra`, `dół`, `lewa`, `prawa` albo `środek`. |

## 17.6 Tekst o różnej długości

Teksty z tabeli mają różną długość, a układ strony ma zostać ten sam. Ustaw ramce **Stałą wysokość**
i włącz **Zmniejszaj tekst, gdy się nie mieści** (→ 5.6). [Sprawdź przed drukiem] poda strony,
na których tekst mimo to się nie mieści.

![Ramka o stałej wysokości](ramka-tekstu.png)

# 18. Przykłady

Gotowe przepisy krok po kroku.

## 18.1 Kalendarz książkowy

Jedna strona na dzień, z dniem tygodnia, imieninami i świętami w kolorze.

1. Nowy projekt A5, układ **Rozkładówki** (→ 2.2).
2. W oknie Dane zaimportuj tabelę **Dni** z kolumnami `dzien`, `miesiac`, `dzien_tygodnia`,
   `imieniny`, `swieto` — albo poproś o nią AI (polecenie niżej).
3. Na stronie wstaw teksty `{dzien}`, `{dzien_tygodnia}` i `Imieniny: {imieniny}` (→ 15.1).
4. Kliknij puste miejsce strony i w **Seria** utwórz serię z tabelą Dni (→ 16.2) — powstanie 365 stron.
5. Wstaw mały tekst `{swieto}` w kolorze czerwonym i ustaw **Pokaż element → nie jest puste** (→ 17.4).
6. Numer strony i stopkę dodaj jako wzorzec (→ 11.3).
7. Sprawdź podgląd i wyeksportuj PDF (→ 19, 21).

{{polecenie: PROMPT_DANE | Polecenie dla AI: tabela dni do kalendarza | Skopiuj, podmień nazwę projektu i wklej do rozmowy z AI, które ma podłączoną Makietkę (→ 25).}}

## 18.2 Planer z obrazkiem miesiąca

1. Strony dni zrób jak w kalendarzu (→ 18.1).
2. Dodaj tabelę **Miesiące** z kolumnami `miesiac` i `obraz` (nazwy plików), a zdjęcia wgraj w oknie
   Obrazy projektu (→ 7.5).
3. W oknie serii dodaj ją jako tabelę dodatkową: **Nowy wiersz → gdy zmieni się kolumna „miesiac”** (→ 16.5).
4. Wstaw obraz na stronie i w **Kolumna z nazwą pliku** wybierz kolumnę `obraz` tabeli Miesiące (→ 17.5).

## 18.3 Zaproszenia imienne

1. Projekt w formacie zaproszenia, np. 148 × 105 mm.
2. Tabela **Goście** z kolumną `imie` — np. wklejona z arkusza (→ 14.3).
3. Zaprojektuj zaproszenie i wpisz w tekście `Kochana {imie}!` albo `Drogi {imie}!`.
4. Seria z tabelą Goście — jedno zaproszenie na każdego gościa.
5. PDF **Do drukarni** z podziałem na pliki albo jednym plikiem (→ 21.1).
