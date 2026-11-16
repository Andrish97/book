<!-- Plik wygenerowany przez scripts/instrukcja-buduj.cjs ze źródła docs/instrukcja/*.md – nie zmieniaj go ręcznie. -->
# Makietka – instrukcja

Podręcznik aplikacji Makietka (https://makietka.app/) – edytora publikacji do druku: książek, kalendarzy, planerów, zaproszeń i innych dokumentów. Ta sama treść jest w aplikacji pod przyciskiem z ikoną książki.

## Spis treści

- **Część I. Podstawy** — Czym jest Makietka i jak pracować z projektami.
  - 1. Makietka w skrócie
  - 2. Projekty
- **Część II. Edytor** — Ekran edytora, elementy na stronie, tekst, obrazy, tabele, strony i wzorce.
  - 3. Ekran edytora
  - 4. Elementy na stronie
  - 5. Tekst
  - 6. Kształty, linie i kolory
  - 7. Obrazy
  - 8. Tabela
  - 9. Warstwy
  - 10. Strony, sekcje i rozkładówki
  - 11. Wzorce stron
  - 12. Linie pomocnicze, siatka i powiększenie
  - 13. Książka: spis treści, pagina, przypisy, odsyłacze, skorowidz
- **Część III. Dane i serie** — Tabele danych, pola w tekście i strony powielane z tabeli.
  - 14. Tabele danych
  - 15. Pola w tekście
  - 16. Serie
  - 17. Wygląd z danych
  - 18. Przykłady
- **Część IV. Gotowa publikacja** — Podgląd, sprawdzenie przed drukiem, plik PDF i link do podglądu.
  - 19. Podgląd
  - 20. Sprawdź przed drukiem
  - 21. Eksport do PDF i PNG
  - 22. Kolory projektu, farby i wykończenia
  - 23. Udostępnianie linkiem
- **Część V. Razem z innymi** — Wspólna praca nad projektem i asystent AI.
  - 24. Współpraca
  - 25. Praca z AI
  - 26. Przykład: komiks z AI
- **Część VI. Konto, urządzenia i pomoc** — Konto i jego ustawienia, telefon i tablet, skróty klawiszowe i słowniczek.
  - 27. Konto
  - 28. Telefon i tablet
  - 29. Skróty klawiszowe
  - 30. Słowniczek

## 1. Makietka w skrócie

### 1.1 Co zrobisz w Makietce

Makietka to edytor publikacji do druku: książek, kalendarzy, planerów, notesów, zaproszeń, etykiet — strona po stronie, jak na makiecie. Na koniec dostajesz plik PDF gotowy dla drukarni. Ma to, czego potrzebuje publikacja wielostronicowa:

- **sekcje** o różnych formatach — np. okładka z grzbietem liczonym samym z liczby stron i papieru (rozdział „10.6 Okładka z grzbietem”) i środek (rozdział „10.4 Ustawienia sekcji”),
- **rozkładówki** z lustrzanymi marginesami, jak w książce (rozdział „10.5 Rozkładówki”),
- **wzorce** — tła, stopki i numery stron rysowane raz dla wielu stron (rozdział „11 Wzorce stron”),
- **style tekstu** — jeden wygląd dla wszystkich tytułów czy podpisów (rozdział „5.4 Style”),
- **plik dla drukarni** ze spadem, znakami cięcia i osadzonymi czcionkami, także PDF/X-4 w CMYK (rozdział „21 Eksport do PDF i PNG”).

Mocną stroną Makietki są **dane**. Stronę możesz powielić dla każdego wiersza tabeli i wstawić do niej wartości z tego wiersza: tak powstaje kalendarz na 365 dni, planer na cały rok albo sto imiennych zaproszeń z jednego wzoru (rozdział „14 Tabele danych” – „17 Wygląd z danych”).

![Twoje projekty](https://makietka.app/img/instrukcja/projekty.png)

### 1.2 Jak zbudowany jest projekt

Jeden **projekt** to jedna publikacja. Projekt składa się z:

| Część | Co to jest |
|---|---|
| **Sekcje** | Części publikacji z własnym formatem, marginesami i numeracją, np. „Okładka” i „Środek”. |
| **Strony** | Strony każdej sekcji, w kolejności druku. Na stronach stoją elementy. |
| **Elementy** | Teksty, kształty, linie, obrazy, tabele i grupy. |
| **Wzorce** | Elementy wspólne dla wielu stron — leżą pod treścią strony albo nad nią. |
| **Style** | Zapisane wyglądy tekstu. |
| **Tabele danych** | Arkusze z danymi do pól w tekście i do powielania stron. |
| **Obrazy** | Wszystkie zdjęcia i grafiki projektu, w jednym oknie. |

Projekt zapisuje się sam, na Twoim koncie (rozdział „2.4 Zapis”).

## 2. Projekty

Projekt to jedna publikacja: tu zakładasz, otwierasz, kopiujesz i zapisujesz projekty.

### 2.1 Lista projektów

Kliknięcie karty otwiera projekt w edytorze — na stronie, którą ostatnio edytowałeś na tym urządzeniu. Gdy nie masz jeszcze projektów, lista proponuje **Utwórz projekt**, **Z gotowego szablonu** (rozdział „10.10 Gotowe sekcje (szablony dokumentów)”) i **Importuj z pliku**.

- **Chmurka** przy nazwie mówi, czy zmiany są na koncie: z ptaszkiem — zapisano, z zegarem — czekają na wysłanie, przekreślona — brak internetu (zmiany są na urządzeniu i wyślą się same).
- Plakietka **Udostępniony** — projekt ma link do podglądu (rozdział „23 Udostępnianie linkiem”). Kliknięcie plakietki otwiera okno linku.
- Projekty udostępnione Ci przez innych mają plakietkę z nazwą właściciela i dopisek „Możesz edytować” albo „Możesz oglądać”. Filtry **Wszystkie**, **Moje** i **Udostępnione mi** pojawiają się, gdy masz takie projekty.
- **Zaproszenia** z liczbą — zaproszenia do cudzych projektów czekające na odpowiedź (rozdział „24.3 Przyjmowanie zaproszenia”).

![Lista projektów](https://makietka.app/img/instrukcja/projekty.png)

### 2.2 Nowy projekt

**Nowy projekt** pyta o nazwę, format strony (A4, A5, A6, B5, kwadrat albo **Własny** w mm), orientację i:

| Pole | Co ustawia |
|---|---|
| **Spad** | Pas za krawędzią strony, który drukarnia odcina — zwykle 3 mm (rozdział „12.1 Linie na stronie”). |
| **Marginesy** | Bezpieczny obszar na teksty, w mm. |
| **Układ stron** | **Pojedyncze strony** albo **Rozkładówki (lewa + prawa)**, jak w książce. |

Wszystko zmienisz później w ustawieniach sekcji (rozdział „10.4 Ustawienia sekcji”).

**Zacznij od**: **Pustej strony** albo **Gotowego szablonu** — wtedy po utworzeniu projektu otworzy się galeria gotowych sekcji (kalendarz, planer, zaproszenie…), a wybrany szablon zastąpi pustą stronę (rozdział „10.10 Gotowe sekcje (szablony dokumentów)”).

![Nowy projekt](https://makietka.app/img/instrukcja/nowy-projekt.png)

### 2.3 Menu projektu

**⋯** na karcie projektu: **Podgląd** (od razu, bez edytora, rozdział „19 Podgląd”), **Zmień nazwę**, **Duplikuj** (np. kalendarz na kolejny rok), **Eksportuj do pliku (.makietka)** (rozdział „2.6 Plik projektu”), **Współpraca…** (rozdział „24 Współpraca”) i **Usuń projekt**. W projekcie innej osoby zamiast duplikowania i usuwania są **Zrób własną kopię** i **Opuść projekt** (rozdział „24.6 Opuszczanie projektu i kopia”).

![Menu projektu](https://makietka.app/img/instrukcja/menu.png)

### 2.4 Zapis

Nie ma przycisku „Zapisz” — każda zmiana zapisuje się sama, najpierw na urządzeniu, a po chwili na koncie. Bez internetu zmiany czekają na urządzeniu i wyślą się same po powrocie sieci. Stan zapisu pokazuje chmurka obok nazwy projektu (rozdział „2.1 Lista projektów”). Zmiana zrobiona tuż przed zamknięciem karty też zostaje: zapisuje się na urządzeniu i trafia na konto przy następnym otwarciu projektu.

### 2.5 Kilka urządzeń i cofanie

Ten sam projekt możesz mieć otwarty na kilku urządzeniach albo w kilku kartach. Zmiana zrobiona na jednym pojawia się na drugim po chwili, bez odświeżania.

Gdy projekt zmieniono w dwóch miejscach naraz, aplikacja **łączy zmiany element po elemencie**: gdy na jednym urządzeniu przesuniesz zdjęcie, a na drugim poprawisz tytuł, zostaną obie zmiany. Pyta tylko wtedy, gdy ten sam element zmieniono w obu miejscach: okno „To samo zmieniono na dwóch urządzeniach” pokazuje każdy taki element z wyborem **Z tego urządzenia** albo **Z konta** (zaznaczona jest wersja z konta). **Wszędzie wersja z konta** wybiera ją dla wszystkich, **Zastosuj** zatwierdza.

**Cofnij** (`Ctrl`+`Z`) i **Ponów** (`Ctrl`+`Shift`+`Z`) obejmują cały projekt: elementy, strony, sekcje, wzorce, style, dane i serie. Historia sięga 80 kroków i zostaje po zamknięciu projektu — na tym samym urządzeniu. Cofanie zdejmuje tylko zmiany zrobione na tym urządzeniu; zmiany innych osób i AI zostają.

### 2.6 Plik projektu

- **Eksportuj do pliku (.makietka)** (menu **⋯** na karcie) zapisuje cały projekt, z obrazami i czcionkami, do pliku `.makietka` — to kopia zapasowa albo sposób na przekazanie projektu.
- **Importuj z pliku** obok **Nowy projekt** wczytuje projekt z pliku `.makietka` (na wąskim ekranie to sama ikona strzałki).
- Zainstalowana aplikacja na komputerze otwiera pliki `.makietka` dwuklikiem (rozdział „28.4 Instalacja aplikacji”).

## 3. Ekran edytora

Gdzie co jest w edytorze — paski, panele i menu.

### 3.1 Układ ekranu

Projekt otwiera się w edytorze. Ekran ma pięć części:

- **górny pasek** — nawigacja, cofanie, okna projektu i menu **⋯** (rozdział „3.2 Górny pasek”, „3.3 Menu ⋯”),
- **panel stron** z lewej — miniatury stron pogrupowane w sekcje (rozdział „10.1 Panel stron”),
- **strona** pośrodku, a nad nią pasek wstawiania (rozdział „3.4 Pasek wstawiania”),
- **prawa kolumna** — zakładki Właściwości i Warstwy (rozdział „3.5 Właściwości i warstwy”, „9 Warstwy”),
- **prawy dolny róg** — linie pomocnicze, ostrzeżenia, menu widoku i powiększenie (rozdział „3.6 Prawy dolny róg i menu widoku”).

Najechanie myszą na przycisk pokazuje jego nazwę i skrót klawiszowy.

![Edytor](https://makietka.app/img/instrukcja/edytor.png)

### 3.2 Górny pasek

![Górny pasek](https://makietka.app/img/instrukcja/k-pasek-gorny.png)

Od lewej: **Projekty**, **nazwa projektu** (kliknij, żeby ją zmienić) ze stanem zapisu (rozdział „2.4 Zapis”), **Cofnij** i **Ponów** (rozdział „2.5 Kilka urządzeń i cofanie”), **Wzorce** (rozdział „11 Wzorce stron”), **Dane** (rozdział „14 Tabele danych”), **Podgląd** (rozdział „19 Podgląd”), **format** sekcji, np. „A5” — otwiera ustawienia sekcji (rozdział „10.4 Ustawienia sekcji”), **Komentarze** (rozdział „24.7 Komentarze”), lupa **Znajdź i zamień** (rozdział „5.15 Znajdź i zamień”) i **⋯** (rozdział „3.3 Menu ⋯”).

Napisy obok ikon pojawiają się, gdy jest na nie miejsce — zmienisz to w menu widoku: **Napisy na górnym pasku** (rozdział „3.6 Prawy dolny róg i menu widoku”). Na wąskim telefonie **Wzorce**, **Dane**, **Komentarze** i lupa są w menu **⋯**.

### 3.3 Menu ⋯

![Menu ⋯](https://makietka.app/img/instrukcja/k-menu-wiecej.png)

Pozycje są w grupach:

| Grupa | Pozycje |
|---|---|
| Szukanie i uwagi | **Znajdź i zamień…** (rozdział „5.15 Znajdź i zamień”), **Komentarze** (rozdział „24.7 Komentarze”). |
| Zasoby projektu | **Obrazy projektu…** (rozdział „7.5 Okno Obrazy projektu”), **Czcionki projektu…** (rozdział „5.8 Czcionki”), **Kolory projektu…** — kolory projektu i sekcji, kolory dodatkowe, wykończenia (rozdział „22.1 Kolory dodatkowe”, „22.5 Kolory projektu i druk kolorów — dla całości albo dla sekcji”); na telefonie też **Wzorce stron…** i **Dane…**. |
| Format i marka | **Zmień format projektu…** (rozdział „10.9 Zmiana formatu ze skalowaniem”), **Zastosuj markę do projektu…** (rozdział „27.9 Zestaw marki”). |
| Druk i eksport | **Sprawdź przed drukiem** (rozdział „20 Sprawdź przed drukiem”), **Eksportuj do PDF…** (rozdział „21 Eksport do PDF i PNG”), **Drukuj w domu…** (rozdział „21.8 Drukuj w domu”), **Pobierz bieżącą stronę jako PNG** (rozdział „21.5 Strona jako PNG”). |
| Pozostałe | **Współpraca…** (rozdział „24 Współpraca”) i przełącznik motywu (rozdział „27.4 Motyw”). |

### 3.4 Pasek wstawiania

Pasek nad stroną wstawia nowe elementy (rozdział „4.1 Wstawianie”).

![Pasek wstawiania](https://makietka.app/img/instrukcja/k-wstaw.png)

| Przycisk | Klawisz | Co wstawia |
|---|---|---|
| **Tekst** | `T` | Ramkę tekstu (rozdział „5 Tekst”). |
| **Prostokąt** | `R` | Prostokąt (rozdział „6.1 Prostokąt, elipsa i wielokąt”). |
| **Elipsa** | `E` | Elipsę albo koło (rozdział „6.1 Prostokąt, elipsa i wielokąt”). |
| **Wielokąt** | `P` | Wielokąt albo gwiazdę — najpierw wybór kształtu (rozdział „6.1 Prostokąt, elipsa i wielokąt”). |
| **Linia** | `L` | Odcinek (rozdział „6.2 Linia”). |
| **Obraz** | — | Zdjęcie albo grafikę (rozdział „7.1 Wstawianie obrazu”). |
| **Rysuj** | `B` | Linię rysowaną odręcznie (rozdział „6.3 Rysowanie odręczne”). |
| **Pióro** | `N` | Kształt z punktów i łuków (rozdział „6.4 Pióro i edycja punktów”). |
| **Tabela** | — | Tabelę z wierszami i kolumnami (rozdział „8 Tabela”). |
| **Biblioteka** | — | Gotowe elementy: kształty, ramki, ozdobniki, planery, kalendarze, wykresy i inne (rozdział „4.8 Biblioteka”). |
| **Komentarz** | — | Komentarz przypięty do miejsca na stronie albo do zaznaczonego elementu (rozdział „24.7 Komentarze”). |

Podpisy pod ikonami włączysz w menu widoku: **Podpisy narzędzi** (rozdział „3.6 Prawy dolny róg i menu widoku”).

**Na telefonie** pozostałe narzędzia — **Wielokąt albo gwiazda**, **Rysowanie odręczne**, **Pióro**, **Komentarz** i **Kopiuj wygląd** (rozdział „4.13 Kopiuj wygląd (malarz formatów)”) — są pod **⋯** na końcu paska. Gdy jedno z nich działa, **⋯** pokazuje jego ikonę; stuknięcie kończy narzędzie.

![Menu ⋯ paska wstawiania na telefonie](https://makietka.app/img/instrukcja/k-wstaw-telefon.png)

### 3.5 Właściwości i warstwy

Prawa kolumna ma u góry dwie zakładki: **Właściwości** i **Warstwy** (rozdział „9 Warstwy”), przełączane kliknięciem albo `F7`. Nagłówek właściwości mówi, czego dotyczą ustawienia:

| Nagłówek | Kiedy | Co ustawiasz |
|---|---|---|
| **Zaznaczony element** · rodzaj (np. „Tekst”) | Jest zaznaczony element. | Wygląd i położenie tego elementu. |
| **Ustawienia narzędzia** · nazwa (np. „Rysowanie”) | Włączone jest narzędzie, np. **Rysuj**. Nagłówek ma wtedy tło w kolorze akcentu. | Jak będą wyglądać następne elementy — „Tak będą wyglądać następne linie.” |
| **Nic nie jest zaznaczone** · „Strona” | Nic nie jest zaznaczone. | Ustawienia otwartej strony (rozdział „10.3 Właściwości strony”). |

Przy zaznaczonym elemencie w nagłówku są **Kopiuj do schowka**, **Duplikuj**, **Kopiuj wygląd** (rozdział „4.13 Kopiuj wygląd (malarz formatów)”), **Zapisz w bibliotece** (rozdział „4.8 Biblioteka”) i **Usuń**. **Ostrzeżenia** otwiera przycisk z trójkątem obok powiększenia (rozdział „12.2 Ostrzeżenia”).

![Ustawienia narzędzia: rysowanie](https://makietka.app/img/instrukcja/k-rysowanie.png)

Na telefonie te panele otwierają przyciski na dole ekranu (rozdział „28.2 Edytor na telefonie”).

![Właściwości zaznaczonego tekstu](https://makietka.app/img/instrukcja/wlasciwosci.png)

### 3.6 Prawy dolny róg i menu widoku

![Prawy dolny róg](https://makietka.app/img/instrukcja/k-widok.png)

- **dwie kartki** — tylko w sekcji z rozkładówkami: cała rozkładówka albo jedna strona (rozdział „10.5 Rozkładówki”),
- przycisk **linii pomocniczych** (`W`) — pokazuje albo chowa marginesy, spad, grzbiet i prowadnice (rozdział „12.1 Linie na stronie”),
- przycisk **Ostrzeżenia** (trójkąt, `F8`) — liczba uwag na stronie; otwiera okienko ostrzeżeń (rozdział „12.2 Ostrzeżenia”),
- **Widok** (ikona kratki) — menu widoku,
- **−**, procent, **+** — powiększenie (rozdział „12.6 Powiększenie”).

Menu widoku:

| Pozycja | Co robi |
|---|---|
| **Siatka**, **Przyciągaj do siatki**, **Krok siatki** | Siatka co zadany krok w mm (rozdział „12.3 Siatka”). |
| **Siatka linii bazowych** | Linie bazowe z ustawień sekcji (rozdział „5.13 Siatka linii bazowych”). |
| **Przyciągaj do elementów i pokazuj odległości** | Różowe linie i odległości w mm przy przesuwaniu (rozdział „12.5 Przyciąganie i odległości”). |
| **Linijki** | Linijki w mm nad stroną i z lewej (rozdział „12.4 Linijki i prowadnice”). |
| **Zablokuj prowadnice**, **Usuń prowadnice z tej strony** | Ochrona i sprzątanie prowadnic (rozdział „12.4 Linijki i prowadnice”). |
| **W rozkładówkach pokazuj jedną stronę** | To samo co przycisk z dwiema kartkami (rozdział „10.5 Rozkładówki”). |
| **Sprawdzaj pisownię** | Falista czerwona linia pod słowami spoza słownika i część **Pisownia** w panelu tekstu (rozdział „5.16 Sprawdzanie pisowni”). |
| **Pokaż uszlachetnienia** | Efekt lakieru, folii, tłoczenia i bieli na stronie; wyłączony — zwykły widok (rozdział „22.3 Widok uszlachetnień”). |
| **Podpisy narzędzi** | Podpisy pod ikonami paska wstawiania. |
| **Napisy na górnym pasku** | **Auto** — gdy się mieszczą, **Zawsze**, **Nigdy**. |

Ustawienia widoku dotyczą tylko tego urządzenia.

![Menu widoku](https://makietka.app/img/instrukcja/k-menu-widoku.png)

## 4. Elementy na stronie

Wszystko, co stoi na stronie, to element: tu jest to, co wspólne dla wszystkich — zaznaczanie, przesuwanie, grupy, gotowe elementy z Biblioteki.

### 4.1 Wstawianie

Kliknij narzędzie na pasku wstawiania (rozdział „3.4 Pasek wstawiania”) — element pojawi się na środku widoku i będzie zaznaczony. Obraz możesz też przeciągnąć z dysku na stronę albo wkleić ze schowka (`Ctrl`+`V`).

Elementy wzorców (rozdział „11 Wzorce stron”) widać na stronie, ale nie da się ich tu zaznaczyć — zmieniasz je we wzorcu.

![Wstawiony tekst](https://makietka.app/img/instrukcja/wstawianie.png)

### 4.2 Zaznaczanie

- **Kliknięcie** zaznacza element.
- `Shift` + kliknięcie dodaje element do zaznaczenia albo go z niego usuwa.
- **Przeciągnięcie ramki** od pustego miejsca strony zaznacza elementy, których dotknie.
- `Ctrl`+`A` zaznacza wszystkie elementy strony.
- Element leżący pod innym zaznaczysz na liście warstw (rozdział „9 Warstwy”).
- **Kliknięcie dwa razy**: w tekście — pisanie, w grupie — wejście do grupy, w komórce tabeli — pisanie w komórce, w kształcie z pióra — edycja punktów, w obrazie — kadrowanie.
- `Esc` zdejmuje zaznaczenie.

### 4.3 Przesuwanie, rozmiar i obrót

- **Przeciągnij** element, żeby go przesunąć. Strzałki przesuwają o 1 mm, z `Shift` — o 10 mm.
- **Kółka w rogach i na bokach** zmieniają rozmiar, **kółko nad elementem** obraca.
- `Shift` przy przeciąganiu — tylko w poziomie albo w pionie; przy obracaniu — co 15°.
- `Alt` przy przeciąganiu — przeciągasz kopię.

Dokładne wartości wpiszesz we właściwościach, w części **Położenie i rozmiar (mm)**:

| Pole | Znaczenie |
|---|---|
| **X**, **Y** | Lewy górny róg elementu, w mm od lewego górnego rogu strony (bez spadu). |
| **Szerokość**, **Wysokość** | Rozmiar w mm. Kłódka między nimi zachowuje proporcje. |
| **Obrót** | Kąt w stopniach. |

Przy kilku zaznaczonych elementach liczby dotyczą ich wspólnej ramki.

### 4.4 Wyrównywanie i równe odstępy

Część **Wyrównaj** we właściwościach:

- **jeden element** — wyrównanie do marginesów strony: do lewej, do środka, do prawej, do góry, do środka w pionie, do dołu,
- **kilka elementów** — wyrównanie do siebie,
- **trzy i więcej** — dodatkowo **Rozłóż równo** w poziomie i w pionie: równe odstępy między elementami.

Przy przesuwaniu element „przykleja się” do krawędzi i środków innych elementów, a strzałki podają odległości w mm (rozdział „12.5 Przyciąganie i odległości”).

![Wyrównywanie kilku elementów](https://makietka.app/img/instrukcja/wyrownanie.png)

### 4.5 Grupy

Zaznacz kilka elementów i wybierz **Zgrupuj** (`Ctrl`+`G`). Grupa przesuwa się, skaluje i obraca jak jeden element. **Rozgrupuj** (`Ctrl`+`Shift`+`G`) rozdziela ją z powrotem.

**Element grupy bez rozgrupowywania:** kliknij grupę dwa razy — grupa się otworzy (pomarańczowa przerywana ramka), a element pod kursorem będzie zaznaczony. Możesz go przesunąć, zmienić we właściwościach albo pisać w nim. Kliknięcie innego elementu grupy zaznacza tamten, `Shift` dodaje kolejne. `Esc`, kliknięcie poza grupą albo **Wróć do całej grupy** ją zamyka.

- W otwartej grupie **Duplikuj** zostawia kopię w grupie, a **Usuń** usuwa tylko zaznaczony element.
- Grupa w grupie otwiera się kolejnym podwójnym kliknięciem; `Esc` wraca o poziom wyżej.

### 4.6 Kolejność, blokada i schowek

- Część **Kolejność**: **Na wierzch**, **Wyżej**, **Niżej**, **Na spód**. To samo zrobisz przeciąganiem na liście warstw (rozdział „9 Warstwy”).
- Część **Inne**: - **Krycie** — przezroczystość elementu w %, - **Zablokuj położenie i rozmiar** — elementu nie przesuniesz przypadkiem; kolor i tekst zmienisz dalej, - **Wycisz ostrzeżenia dla tego obiektu** — np. dla tła, które celowo wychodzi na spad, - **Nazwa** — nazwa elementu na liście warstw.
- **Kopiuj do schowka** i `Ctrl`+`V` na innej stronie wklejają element w to samo miejsce. We właściwościach strony jest też **Wklej skopiowane elementy**.

### 4.7 Cień

Część **Cień** działa dla każdego elementu:

**Cień pod elementem** włącza cień. Ustawisz jego kolor, **Siłę**, przesunięcie **W prawo** i **W dół** w mm (ujemne — w lewo albo w górę) i **Rozmycie** krawędzi w mm.

### 4.8 Biblioteka

Biblioteka to gotowe elementy do wstawienia: kształty, ramki, ozdobniki, planery, kalendarze, wykresy i Twoje własne elementy. Otwiera ją **Biblioteka** na pasku wstawiania.

![Biblioteka obok strony](https://makietka.app/img/instrukcja/k-biblioteka.png)

1. Wybierz kategorię u góry albo wpisz słowo w pole **Szukaj** – szukanie przegląda wszystkie kategorie naraz.
2. Kliknij element – stanie na środku bieżącej strony. Na komputerze możesz też przeciągnąć kafelek na stronę: element stanie tam, gdzie go upuścisz.
3. Resztę ustawisz w panelu właściwości, jak przy każdym elemencie.

| Kategoria | Co w niej jest |
|---|---|
| **Moje elementy** | Elementy zapisane przez Ciebie – na koncie, w każdym projekcie (niżej). |
| **Gotowe sekcje** | Całe dokumenty: kalendarze, planery, notesy, zaproszenia, dyplomy, wizytówki, ulotki, menu, rozdziały książki… Kafelek otwiera okno gotowych sekcji na tym szablonie (rozdział „10.10 Gotowe sekcje (szablony dokumentów)”). |
| **Ikony** | 260 ikon liniowych w jednym stylu, w grupach: **Kontakt**, **Czas i kalendarz**, **Pogoda**, **Jedzenie**, **Podróże**, **Szkoła i nauka**, **Wiara** (krzyż, gołębica, ryba, świeca, dłonie złożone, Biblia, kielich, różaniec…), **Zdrowie**, **Finanse**, **Dom**, **Natura**, **Technologia**, **Strzałki**. Kolor i grubość linii zmienisz w części **Obrys**; przy powiększaniu linia rośnie razem z ikoną. |
| **Ilustracje** | Rysunki liniowe do przekolorowania: góry, las, żaglówka, latarnia, dom z drzewem, kościół na wzgórzu, kawa i książka, świeca z księgą, monstera, gałązka, kaktus, ptaki, motyl, kot, snop zboża, winorośl, gołębica z gałązką, dłonie z sercem, krzyż na wzgórzu, księżyc, miasto, rower, prezent. |
| **Kształty** | Ponad 200 kształtów w grupach: **Podstawowe** (koło, kwadrat, owale, trójkąty, łuki, pierścień, sześcian, walec…), **Wielokąty** (także zaokrąglone, plaster miodu), **Gwiazdy i odznaki** (gwiazdy, pieczęcie, medal, zębatka, odznaki promocyjne), **Serca i natura** (serca, kwiaty, liście, chmury, góry, fala, płomień, tęcza, zwierzęta…), **Symbole i ikony** (dom, telefon, korona, puchar, kłódka, osoba, laptop, klucz, puzzel, mapa…), **Okolicznościowe** (prezent, balon, choinka, bombka, tort, pisanka, bałwanek…), **Znaki** (plus, minus, procent, pytajnik, ptaszek, pola wyboru…). |
| **Strzałki i dymki** | Strzałki w każdą stronę, na skos, zakręcone, z kolanem, łukiem, faliste, wymiany, rozgałęzione; szewrony; dymki z każdej strony, okrągłe, owalne, myśli, chmurka, krzyku, dwa dymki. |
| **Ramki** | Ponad 60 ramek w grupach: **Proste**, **Zaokrąglone**, **Podwójne i przerywane** (przerywana, kropkowana, kreska – kropka – to sam obrys), **Ozdobne**, **Z miejscem na tytuł**, **W kształcie** (serce, owal, koło, chmurka, ośmiokąt, łuk, gwiazda…), **Na zdjęcie** (pola w kształcie koła, serca, łuku, chmurki… – wstaw do nich obraz, a także odbitka, slajd, klatka filmu), **Kartki i notatki**, **Obramowania stron** (wstawiają się od razu na całą stronę). |
| **Ozdobniki** | Wstęgi i banery, narożniki (pojedyncze i komplety czterech), rozety i ornamenty (mandala, róża wiatrów, lilia, medalion…). |
| **Linie i separatory** | Linia ciągła, cienka, gruba, przerywana, kropkowana, kreska – kropka, podwójna i pionowa; separatory ozdobne (fala, zygzak, z kropką, kółkiem, gwiazdką, kwiatkiem, rombami, zawijasy, pętelki, listki…). Rodzaj i grubość zmienisz potem w części **Linia** (rozdział „6.2 Linia”). |
| **Etykiety i plakietki** | Etykiety zaokrąglone, ze ściętymi rogami, owalne, z obwódką, faliste, ząbkowane, na słoik, herbowe, cenówka, metka, plakietka, pieczątka, znaczek pocztowy, tabliczka — w środek wstaw tekst. |
| **Okolicznościowe** | Zestawy w jednym stylu na **Boże Narodzenie**, **Wielkanoc**, **urodziny**, **ślub**, **chrzest**, **Pierwszą Komunię** i **szkołę**: nagłówek z życzeniami, ramka, szlaczek i gotowa kartka. |
| **Tła i wzory** | **Wzory na całą stronę** (paski, kropki, groszki, kratka, krata, jodełka, fale, zygzak, romby, gwiazdki, kwiatki, plaster miodu, łuski, trójkąty, krzyżyki, koła), **Tekstury papieru** (płótno lniane, karton, papier pakowy, czerpany, w linie z marginesem, milimetrowy), **Przejścia kolorów** i **Plamy i akwarela**. Wzory, tekstury i przejścia wstawiają się na całą stronę ze spadem, pod treść; wzór to jeden wektorowy element na tle – kolory zmienisz po otwarciu grupy (dwuklik). Przy zaznaczonym kształcie wzór może go wypełnić (rozdział „6.5 Wypełnienie”). |
| **Kalendarze** | Kalendarz miesiąca: zwykły, z miejscem na notatki, z numerami tygodni (rozdział „4.9 Kalendarz miesiąca”). |
| **Planer** | Gotowe tabele do planerów i notesów: lista zadań, tracker nawyków, plan tygodnia, plan dnia (godziny), notatki w linie, siatka dni tygodnia, lista zakupów, cele, budżet, kontakty, plan lekcji; **Plany**: kalendarz roczny (12 miesięcy na stronie), plan miesiąca, tydzień w kolumnach i z priorytetami, plan posiłków; **Trackery**: nastrój, woda, czytanie, dziennik modlitwy; **Listy i budżet**: lista życzeń, budżet miesięczny; do tego siatki do notatek: kratka, kropki, linie (co 5 mm), papier milimetrowy, siatka izometryczna. Pola wyboru są w **Kształtach → Znaki**. |
| **Formularze do druku** | Data i podpis, kratki na litery, pola na dane, odcinek do odcięcia z nożyczkami, pola wyboru, skala ocen 1–5, pole na uwagi, kupon, zgoda z podpisem; tabelka zamówienia i lista obecności (zwykłe tabele). |
| **Wykresy** | Słupkowy, poziomy, liniowy, kołowy i pierścieniowy z tabeli danych (rozdział „4.10 Wykres”). |
| **Infografiki** | Oś czasu pozioma i pionowa, kroki i strzałki procesu, liczby i statystyki, porównanie, drzewo, piramida, cykl, paski postępu, ocena gwiazdkami, lejek, mapa myśli, macierz 2 × 2. |
| **Kolaże zdjęć** | Gotowe układy 2–9 pól na zdjęcia (rozdział „4.11 Kolaż zdjęć”). |
| **Teksty** | Gotowe napisy po łuku, w okręgu (pieczęć), falisty baner, flaga, wypukły tytuł (rozdział „5.14 Tekst po łuku, okręgu i ścieżce; wyginanie”). |
| **Nagłówki i tytuły** | Tytuł z podtytułem, tytuł między liniami, numer rozdziału, inicjał z akapitem, cytat z autorem, pieczątki, wstęga z napisem, tytuł na pasku, odręczny, z dwóch krojów, z etykietą, w narożnikach, nagłówek strony, tytuł z datą. |
| **Bloki treści** | Ramki **Uwaga**, **Wskazówka**, **Ciekawostka**, **Ważne**, cytat wyróżniony, werset, lista z ikonami i numerowana, kolumna boczna, stopka redakcyjna, notka o autorze (z polem na zdjęcie), kontakt, pytanie i odpowiedź, „Do zapamiętania”. |
| **Układy stron** | Całe strony na obszar treści: strona tytułowa, początek rozdziału, galeria 2 × 2, strona z cytatem, strona na notatki, dyplom, ogłoszenie, strona dnia. |
| **Style tekstu** | Style akapitu projektu: kliknięcie nadaje styl zaznaczonemu tekstowi, a bez zaznaczenia wstawia nowy tekst w tym stylu (rozdział „5.4 Style”). |
| **Marka** | Logo z zestawu marki, **Zastosuj markę do projektu…** i **Edytuj zestaw marki…** (rozdział „27.9 Zestaw marki”). |
| **Kody** | Kod QR i kod kreskowy EAN / ISBN (rozdział „4.12 Kod QR i kod kreskowy”). |

Ikony, ilustracje, nagłówki, bloki, infografiki, formularze, układy i zestawy okolicznościowe to zwykłe teksty, kształty i linie złożone w jedną grupę – przesuwasz je razem, a po dwukliku (otwarta grupa, rozdział „4.5 Grupy”) zmieniasz każdy tekst, kolor czy kształt osobno. Kolory i czcionki biorą z zestawu marki (rozdział „27.9 Zestaw marki”), jeśli go masz; cała wstawka to jeden krok cofania. Na komputerze kategorie zajmują najwyżej trzy rzędy – pozostałe zobaczysz po przewinięciu tego miejsca.

![Nagłówek, blok „Wskazówka”, oś czasu i werset z Biblioteki](https://makietka.app/img/instrukcja/k-biblioteka-dzialy.png)

Kształt z biblioteki to zwykły kształt: zmienisz mu kolor, obrys i punkty (rozdział „6.4 Pióro i edycja punktów”), a zamknięty kształt może być ramką zdjęcia (rozdział „7.7 Obraz w kształcie”). Długie kategorie mają nagłówki grup (np. Podstawowe, Wielokąty); przy szukaniu nagłówków nie ma, a wyniki są ze wszystkich kategorii. Szablon z kategorii **Planer** to zwykła tabela (rozdział „8 Tabela”): wpisujesz w komórki, dodajesz wiersze i kolumny, zmieniasz linie i kolory. Żeby planer powtarzał się na wielu stronach, wstaw go we wzorcu (rozdział „11 Wzorce stron”) albo na stronie serii (rozdział „16 Serie”).

![Kategoria Planer w Bibliotece](https://makietka.app/img/instrukcja/k-biblioteka-planer.png)

**Moje elementy.** Logo, stopkę firmy czy ulubioną ramkę zapiszesz raz i wstawisz w każdym projekcie:

1. Zaznacz element albo kilka elementów (np. logo z podpisem).
2. Kliknij **Zapisz w bibliotece** w nagłówku panelu (przy kilku zaznaczonych — w części **Zaznaczenie**) albo w **⋯** przy elemencie na liście warstw.
3. Wpisz nazwę. Element trafi do kategorii **Moje elementy**.

![Moje elementy w Bibliotece](https://makietka.app/img/instrukcja/k-moje-elementy.png)

- Elementy są na Twoim koncie, więc widać je w każdym projekcie i na każdym urządzeniu.
- Wstawiony element jest kopią — usunięcie go z Biblioteki nie zmienia stron, na których już stoi.
- Ołówek w rogu kafelka zmienia nazwę, kosz usuwa element z Biblioteki.
- Elementów wzorca i tekstu w trakcie pisania nie zapiszesz — najpierw wyjdź z pisania.

### 4.9 Kalendarz miesiąca

Siatka dni jednego miesiąca z nazwą miesiąca i dniami tygodnia. Niedziele i polskie święta – także ruchome: Wielkanoc, Poniedziałek Wielkanocny, Zielone Świątki, Boże Ciało – są wyróżnione kolorem.

![Kalendarz miesiąca i jego ustawienia](https://makietka.app/img/instrukcja/k-kalendarz.png)

| Ustawienie | Co zmienia |
|---|---|
| **Miesiąc**, **Rok** | Pokazany miesiąc. |
| **Miesiąc z kolumny danych** | Na każdej stronie serii inny miesiąc – z kolumny z wartościami typu „2027-03”, „marzec 2027” albo „3” (rok wtedy z **Rok z kolumny**). Tak powstaje kalendarz na 12 miesięcy z jednej strony-wzoru (rozdział „16 Serie”). |
| **Tydzień zaczyna się od** | Poniedziałku albo niedzieli. |
| **Nazwy dni** | Pełne, skrócone albo same litery. |
| **Dni innych miesięcy** | Wyszarzone, jak zwykłe dni albo ukryte. |
| **Nazwa miesiąca nad dniami**, **Numery tygodni** | Dodatkowy wiersz i kolumna. |
| **Miejsce na notatki** | Data w rogu, wyższe kratki do pisania. |
| **Polskie święta**, **Nazwa święta pod datą** | Wyróżnienie świąt i ich nazwy w kratkach. |
| **Święta z tabeli danych** | Własne dni (urodziny, imieniny, terminy) z tabeli: kolumna z datą („2027-05-26”, „26.05.2027” albo „26.05” – co roku) i kolumna z nazwą. |
| **Kolory kalendarza** | Dni, nazwy, niedziele, soboty, święta, dni innych miesięcy. |

Linie, tła wierszy, czcionkę i wyrównanie zmieniasz jak w tabeli (rozdział „8.5 Linie i tła”). Daty układa aplikacja – w kratkach kalendarza się nie pisze.

### 4.10 Wykres

Wykres rysuje liczby z tabeli danych projektu (rozdział „14 Tabele danych”) i zmienia się sam, gdy zmienisz dane.

![Wykres słupkowy i jego ustawienia](https://makietka.app/img/instrukcja/k-wykres.png)

| Ustawienie | Co zmienia |
|---|---|
| **Rodzaj** | Słupkowy, poziomy, liniowy, kołowy, pierścieniowy. |
| **Tabela danych**, **Podpisy z kolumny**, **Liczby z kolumn** | Skąd wykres bierze dane; każda zaznaczona kolumna liczb to osobna seria (osobny kolor). |
| **Wiersze** | Wszystkie, wybrane (od–do) albo **wiersz strony serii** – na każdej powielonej stronie wykres z jej wiersza. |
| **Tytuł**, **Liczby przy słupkach**, **Oś**, **Linie siatki**, **Legenda** | Co widać na wykresie. |
| **Szerokość**, **Wysokość**, **Czcionka**, **Rozmiar pisma**, **Kolory** | Wygląd. Uchwyty zmieniają rozmiar wykresu, nie wielkość pisma. |

Liczby w komórkach mogą mieć przecinek, spacje i znak %.

### 4.11 Kolaż zdjęć

Kolaż to gotowy układ pól na zdjęcia. Upuść zdjęcie z komputera na pole – trafi do tego pola. Możesz też kliknąć kolaż dwa razy, wybrać pole i w części **Obraz w kształcie** wstawić obraz z projektu (rozdział „7.7 Obraz w kształcie”).

W panelu kolażu zmienisz **Układ** (pola przybywają albo ubywają, zdjęcia w pierwszych polach zostają), **Odstęp między zdjęciami**, **Zaokrąglenie rogów**, **Szerokość** i **Wysokość**.

### 4.12 Kod QR i kod kreskowy

Kod wstawisz z **Biblioteka**, kategoria **Kody**. W części **Kod** panelu ustawisz resztę:

| Ustawienie | Co znaczy |
|---|---|
| **Rodzaj** | **Kod QR** albo **Kod kreskowy EAN-13 / ISBN** (np. ISBN na okładce książki). |
| **Co zawiera** (QR) | **Adres strony**, **Tekst**, **E-mail**, **Telefon** albo **Sieć Wi-Fi**. |
| **Korekcja błędów** (QR) | Ile kodu może być zasłonięte: od **Niska (7%)** — najmniejszy kod — do **Najwyższa (30%)**, np. pod logo. |
| **Numer EAN albo ISBN** | Cyfra kontrolna dopisze się sama; ISBN możesz wpisać z myślnikami. |
| **Rozmiar** | **Rozmiar nominalny (100%)** ustawia kod EAN na 37,29 × 25,93 mm. |
| **Kolor kodu**, **Tło**, **Margines ciszy** | Kod musi być ciemny na jasnym tle, z pustym pasem wokół. |

Pole z danych w treści — np. `{adres}` albo `{isbn}` — daje inny kod na każdej stronie serii (rozdział „15 Pola w tekście”).

Gdy kod będzie za mały, za jasny albo z błędną treścią, przypomni o tym panel i **Sprawdź przed drukiem**.

![Kod QR i jego ustawienia](https://makietka.app/img/instrukcja/k-kod.png)

### 4.13 Kopiuj wygląd (malarz formatów)

Wygląd jednego elementu przeniesiesz na inny jednym kliknięciem — bez przepisywania kolorów i grubości.

**Kopiuj wygląd** (pędzel) jest w nagłówku panelu właściwości, w **⋯** przy elemencie na liście warstw, a na telefonie też pod **⋯** paska wstawiania (rozdział „3.4 Pasek wstawiania”).

![Kopiuj wygląd w nagłówku panelu](https://makietka.app/img/instrukcja/k-malarz.png)

1. Zaznacz element, który ma już dobry wygląd.
2. Kliknij **Kopiuj wygląd** (`Ctrl`+`Alt`+`C`).
3. Kliknij element, który ma dostać ten wygląd.

- **Dwa kliknięcia** w **Kopiuj wygląd** — tryb ciągły: klikasz kolejne elementy, aż naciśniesz `Esc`.
- **Fragment tekstu:** w pisanym tekście zaznacz słowa i kliknij **Kopiuj wygląd** — wygląd dostanie tylko zaznaczony fragment. Tak samo skopiujesz wygląd z fragmentu.

Przechodzi wszystko, co dotyczy wyglądu — kolory, przejścia, obrys, czcionka, odstępy, filtry zdjęcia, krycie, cień, uszlachetnienia — a treść zostaje. Tabele, kody, wykresy i kalendarze mają własne ustawienia i wyglądu nie przejmują.

## 5. Tekst

Ramki tekstu, ich wygląd, style i skład — od jednego napisu po tekst książki płynący przez wiele stron.

### 5.1 Pisanie

Wstaw tekst przyciskiem **Tekst** (`T`) i od razu pisz. Istniejący tekst kliknij dwa razy, żeby pisać w nim; `Esc` kończy pisanie. `Enter` zaczyna nowy akapit.

Szerokość ramki zmieniasz bocznymi uchwytami — tekst układa się od nowa, litery się nie rozciągają. Wysokość ramki rośnie razem z tekstem, chyba że ustawisz stałą wysokość (rozdział „5.6 Ramka tekstu”).

![Tekst na stronie](https://makietka.app/img/instrukcja/wstawianie.png)

### 5.2 Wygląd tekstu

Właściwości zaznaczonego tekstu:

| Ustawienie | Znaczenie |
|---|---|
| **Styl** | Zapisany wygląd tekstu (rozdział „5.4 Style”). |
| **Czcionka** | Krój pisma. Na liście zacznij pisać nazwę, żeby ją znaleźć (rozdział „5.8 Czcionki”). |
| **Rozmiar** | W punktach (pt). Kółko z prawej to **kolor tekstu**. |
| **B** **I** **U** **S** | Pogrubienie, kursywa, podkreślenie, przekreślenie. Wyszarzone, gdy czcionka nie ma takiej odmiany. |
| **Wyrównanie** | Do lewej, do środka, do prawej, wyjustowanie. |
| **Interlinia** | Odstęp między wierszami; 1 to pojedynczy. |
| **Odstęp liter** | Rozstrzelenie liter; wartość ujemna ściska tekst. |
| **Wielkość liter** | **AA** — wszystkie wielkie, **aa** — wszystkie małe, **Aᴀ** — kapitaliki: to tylko wygląd, treść zostaje taka, jak ją wpisano. **Aa** — „jak w zdaniu”: zmienia samą treść. |
| **Lista** | Punkty, kreski albo numery przed każdym akapitem (rozdział „5.5 Listy”). |
| **Obrys liter** | Kolor i **Grubość obrysu liter** — kontur wokół każdej litery. |

![Właściwości tekstu](https://makietka.app/img/instrukcja/wlasciwosci.png)

### 5.3 Fragment tekstu

Kliknij tekst dwa razy, zaznacz fragment i zmień go tymi samymi ustawieniami — panel pokaże „Zmieniasz tylko zaznaczony fragment”. Tak pogrubisz jedno słowo albo zmienisz kolor jednej linijki. Wygląd fragmentu z polem (rozdział „15 Pola w tekście”) przechodzi na wstawioną wartość.

### 5.4 Style

**Styl** to zapisany wygląd tekstu, np. „Tytuł”, „Podpis”, „Dymek”. Nadaj go wszystkim tekstom, które mają wyglądać tak samo.

- Lista **Styl** we właściwościach nadaje styl zaznaczonemu tekstowi.
- **Nowy styl** zapisuje wygląd zaznaczonego tekstu pod nową nazwą.
- Gdy zmienisz tekst ze stylem, pojawią się **Aktualizuj styl** — zmienia wszystkie teksty z tym stylem w całym projekcie — i **Przywróć** — wraca do wyglądu ze stylu.
- Styl zapisuje też ustawienia **Składu akapitu** (rozdział „5.9 Skład akapitu”) — np. dzielenie wyrazów dla całego tekstu książki.

**Styl znakowy** to zapisany wygląd fragmentu tekstu, np. „Wyróżnienie” albo „Nazwa własna”.

1. Zaznacz fragment tekstu (kliknij tekst dwa razy i zaznacz słowa).
2. Ustaw jego wygląd (rozdział „5.3 Fragment tekstu”), potem w części **Styl tekstu** wybierz **Nowy styl znakowy**.
3. Inne fragmenty zaznacz i wybierz styl z listy **Styl znakowy**. Bez zaznaczenia styl dostaje cały tekst.

**Aktualizuj styl** przenosi wygląd zaznaczenia do stylu — zmienią się wszystkie fragmenty z tym stylem w projekcie. Usunięty styl znakowy nie zmienia wyglądu fragmentów.

### 5.5 Listy

Lista **Lista** we właściwościach tekstu: **Punkty**, **Kreski** albo **Numery**. Znak listy stoi przed każdym akapitem, a dalsze wiersze akapitu równo pod pierwszym. W tekście płynącym przez kilka ramek numery liczą się dalej. Skróty: `Ctrl`+`Shift`+`8` (punkty) i `Ctrl`+`Shift`+`7` (numery).

### 5.6 Ramka tekstu

Część **Ramka tekstu** przydaje się, gdy tekst ma zająć stałe miejsce — np. teksty z danych o różnej długości (rozdział „17.6 Tekst o różnej długości”):

| Ustawienie | Znaczenie |
|---|---|
| **Stała wysokość ramki** | Ramka nie rośnie z tekstem. Wysokość wpisujesz w mm albo zmieniasz górnym lub dolnym uchwytem. |
| **Tekst w pionie** | Do góry, na środku albo do dołu ramki. |
| **Zmniejszaj tekst, gdy się nie mieści** | Czcionka maleje, aż tekst się zmieści — nie poniżej **najmniejszego rozmiaru**. |

Tekst, który mimo to się nie mieści, jest ucinany na dole ramki i trafia na listę ostrzeżeń.

![Ramka o stałej wysokości](https://makietka.app/img/instrukcja/ramka-tekstu.png)

### 5.7 Kolumny i tekst przez kilka ramek

Dłuższy tekst może płynąć przez kilka ramek: to, co nie mieści się w pierwszej, przechodzi do następnej. Część **Przelewanie tekstu**:

| Przycisk | Co robi |
|---|---|
| **Podziel na kolumny** | Zamienia ramkę na 2, 3 albo 4 kolumny obok siebie. |
| **Dodaj ramkę z ciągiem dalszym** | Nowa ramka obok (albo pod spodem), do której płynie reszta tekstu. |
| **Ciąg dalszy na następnej stronie** | Ramka na następnej stronie — w razie potrzeby razem z nową stroną. |
| **Połącz ramki tekstu** | Łączy dwie zaznaczone ramki. |
| **Rozłącz ramki** | Każda ramka zostaje ze swoją częścią tekstu. |
| **Poprzednia ramka**, **Następna ramka** | Przechodzą do sąsiedniej ramki, także na innej stronie. |

Piszesz w dowolnej ramce, a tekst przelewa się na bieżąco. Wygląd tekstu (czcionka, rozmiar, lista) jest wspólny dla połączonych ramek. Fioletowa linia pokazuje, dokąd płynie tekst z zaznaczonej ramki.

![Kolumny, listy i tabela](https://makietka.app/img/instrukcja/uklad.png)

### 5.8 Czcionki

Do wyboru są 52 rodziny czcionek z polskimi znakami, które wolno używać w druku komercyjnym: bezszeryfowe do tekstu (np. Inter, Lato, Roboto), wąskie do nagłówków (Oswald, Bebas Neue), szeryfowe (Lora, Merriweather, Playfair Display, EB Garamond), odręczne i ozdobne (Caveat, Pacifico, Dancing Script) oraz maszynowe.

**⋯** → **Czcionki projektu…** pokazuje próbki, daje pliki czcionek do pobrania (np. dla drukarni) i pozwala wgrać **własną czcionkę** (TTF, OTF, WOFF, WOFF2; każda odmiana osobno) — także z listy czcionek: **+ Wgraj własną czcionkę…**. Wgrana czcionka zostaje na koncie, w „Moich czcionkach”.

> **Wskazówka:** Do druku własną czcionkę najlepiej wgrać jako TTF albo OTF, osobny plik dla pogrubienia i kursywy. Inne pliki trafią do PDF jako krzywe — tekst będzie ostry, ale nie da się go zaznaczyć.

![Okno czcionek](https://makietka.app/img/instrukcja/czcionki.png)

Na górze listy **Czcionka** są **Użyte w projekcie** — czcionki z tekstów wszystkich stron, wzorców i stylów, najczęstsze najpierw, z liczbą użyć (np. „Inter · 5×”). Niżej jest pełna lista.

![Użyte w projekcie na liście czcionek](https://makietka.app/img/instrukcja/k-czcionki-uzyte.png)

Gdy masz zestaw marki (rozdział „27.9 Zestaw marki”), nad nimi jest grupa **Marka** — czcionka nagłówków i czcionka tekstu marki.

### 5.9 Skład akapitu

Zwijana część **Skład akapitu** we właściwościach tekstu decyduje o tym, jak tekst łamie się na wiersze. Te same ustawienia zapiszesz w stylu (rozdział „5.4 Style”).

| Ustawienie | Co robi |
|---|---|
| **Dziel wyrazy** | Długie wyrazy dzielą się na końcu wiersza według polskich zasad — wyjustowany tekst nie ma wtedy dziur. Obok ustawisz najkrótszy dzielony wyraz i ile liter zostaje przed łącznikiem i po nim. |
| **Spójniki na końcu wiersza** | Pojedyncze **a, i, o, u, w, z** (albo też dwuliterowe: do, na, że…) przechodzą do następnego wiersza razem ze słowem, jak w polskim składzie. |
| **Wdowy i sieroty** | Tekst płynący przez kilka ramek (rozdział „5.7 Kolumny i tekst przez kilka ramek”) nie zostawia samotnego wiersza akapitu na dole ani na górze ramki. |
| **Wyrównaj do siatki linii bazowych** | Wiersze stają na liniach siatki sekcji (rozdział „5.13 Siatka linii bazowych”). |
| **Nie opływaj innych elementów** | Tekst leży na elementach z oblewaniem, zamiast je opływać (rozdział „5.12 Oblewanie tekstem”) — np. podpis na zdjęciu. |

![Skład akapitu we właściwościach tekstu](https://makietka.app/img/instrukcja/k-sklad-akapitu.png)

### 5.10 Inicjał

Inicjał to powiększona pierwsza litera akapitu, na kilka wierszy. W części **Skład akapitu** wybierz **Inicjał**: **na 2 wiersze** … **na 5 wierszy**. Litera rośnie od górnej krawędzi pierwszego wiersza do linii bazowej ostatniego, a tekst ją opływa. **Czcionka inicjału** i **Kolor inicjału** mogą być inne niż w tekście.

Inicjał dostaje pierwszy akapit tekstu. W tekście płynącym przez kilka ramek — tylko w pierwszej ramce.

![Inicjał, dzielenie wyrazów, tabulatory z kropkami i tekst opływający koło](https://makietka.app/img/instrukcja/sklad.png)

### 5.11 Tabulatory

Klawisz `Tab` w pisanym tekście wstawia tabulator: tekst za nim przeskakuje do najbliższej pozycji. Bez ustawionych pozycji tabulatory stoją co 12,5 mm.

W części **Skład akapitu** **Dodaj tabulator** dodaje pozycję. Każda ma:

| Pole | Znaczenie |
|---|---|
| **Tabulator N** | Pozycja w mm od lewej krawędzi ramki. |
| **Wyrównanie** | **do lewej**, **do środka**, **do prawej** albo **do przecinka** (liczby z przecinkiem jedna pod drugą). |
| **Wypełnienie** | Pusto, kropki, kreski albo linia przed tekstem — np. spis treści „Rozdział 1 . . . . . 12”. |

![Tabulator do prawej z kropkami](https://makietka.app/img/instrukcja/k-tabulatory.png)

### 5.12 Oblewanie tekstem

Zdjęcie, kształt albo grupa może odpychać tekst. Zaznacz element i w części **Inne** wybierz **Oblewanie tekstem**:

| Wartość | Znaczenie |
|---|---|
| **tekst opływa ramkę elementu** | Wiersze kończą się przed prostokątem elementu (albo zaczynają za nim). |
| **tekst opływa kształt** | Dla elipsy, wielokąta i kształtu z pióra — wiersze idą wzdłuż jego brzegu. |
| **tekst przeskakuje pod element** | Obok elementu nie ma tekstu, ciąg dalszy jest pod nim. |

**Odstęp tekstu od elementu** to wolne miejsce wokół elementu (domyślnie 2 mm). Oblewanie działa na wszystkie teksty na stronie — także w trakcie przesuwania elementu. Tekst wybiera tę stronę elementu, po której ma więcej miejsca.

![Oblewanie tekstem w części Inne](https://makietka.app/img/instrukcja/k-oblewanie.png)

### 5.13 Siatka linii bazowych

Siatka linii bazowych ustawia wiersze wszystkich kolumn i stron na tej samej wysokości — jak w książkach, w których wiersze z obu stron kartki pokrywają się pod światło.

1. W ustawieniach sekcji (rozdział „10.4 Ustawienia sekcji”) włącz **Siatka linii bazowych w tej sekcji**: **Odstęp** (zwykle interlinia tekstu podstawowego) i **Pierwsza linia** (mm od górnej krawędzi strony, zwykle górny margines).
2. W menu widoku (rozdział „3.6 Prawy dolny róg i menu widoku”) **Siatka linii bazowych** pokazuje te linie na stronie.
3. Tekstom, które mają stać na siatce, włącz **Wyrównaj do siatki linii bazowych** (rozdział „5.9 Skład akapitu”) — najlepiej w stylu tekstu podstawowego.

### 5.14 Tekst po łuku, okręgu i ścieżce; wyginanie

Zaznacz tekst i w części **Kształt tekstu** panelu wybierz **Kształt**. Gotowe przykłady znajdziesz też w **Biblioteka**, w kategorii **Teksty**.

![Tekst po łuku, w okręgu i wygięty](https://makietka.app/img/instrukcja/k-ksztalt-tekstu.png)

| Kształt | Co robi i co ustawisz |
|---|---|
| **Łuk** | Napis po łuku. **Zgięcie** w %: dodatnie – łuk w górę, ujemne – w dół. |
| **Okrąg**, **Elipsa** | Napis dookoła, np. pieczęć: promień, początek, litery na zewnątrz albo do środka. |
| **Po ścieżce** | Napis po linii dowolnego kształtu ze strony (narysowanego piórem albo z Biblioteki) — wybierz go w **Linia z kształtu na stronie**. |
| **Wygięcie** | Litery wygięte jak łuk, wypukłość, fala, flaga albo zwężenie; **Siła wygięcia** w %. |

- Przy łuku i wygięciach uchwyt ◆ pod tekstem zgina tekst mocniej albo słabiej.
- Kliknij tekst dwa razy, żeby go poprawić — w trakcie pisania stoi prosto.
- Tekst po kształcie jest jednym wierszem; czcionka, kolor, style i pola `{…}` działają jak zwykle.
- **Prosto** przywraca zwykły tekst.

### 5.15 Znajdź i zamień

Lupa na górnym pasku albo **⋯** → **Znajdź i zamień…** (`Ctrl`+`F`; `Ctrl`+`H` — od razu z polem zamiany).

![Znajdź i zamień obok strony](https://makietka.app/img/instrukcja/k-znajdz.png)

1. Wpisz szukany tekst. Lista pokazuje każde trafienie: stronę albo wzorzec i kawałek tekstu wokół.
2. Kliknij trafienie (albo `Enter` w polu, `Shift`+`Enter` — wstecz) — edytor otworzy tę stronę i zaznaczy znaleziony fragment.
3. Żeby zamienić, wpisz nowy tekst w drugim polu i kliknij **Zamień** (wybrane trafienie) albo **Zamień wszystkie**.

| Opcja | Znaczenie |
|---|---|
| **Wielkość liter** | „Kalendarz” nie znajdzie „kalendarz”. |
| **Całe słowa** | „kot” nie znajdzie „kotka”. |
| **Także w danych** | Szuka też w komórkach tabel danych (rozdział „14 Tabele danych”). |
| **W nazwach stylów** | Szuka też w nazwach stylów akapitu i znakowych (rozdział „5.4 Style”). |

- Szukanie obejmuje wszystkie strony i wzorce, także teksty w grupach.
- Pola w klamrach, np. `{miesiac}`, zostają nietknięte — chyba że wpiszesz klamrę w szukanym tekście.
- Wygląd fragmentów (np. pogrubione słowo) zostaje na swoim miejscu po zamianie.
- **Zamień wszystkie** cofniesz jednym **Cofnij**.

### 5.16 Sprawdzanie pisowni

Słowa spoza słownika polskiego są podkreślone falistą czerwoną linią — tylko w edytorze, nigdy w PDF.

![Podpowiedzi przy podkreślonym słowie](https://makietka.app/img/instrukcja/k-pisownia-dymek.png)

1. Kliknij tekst dwa razy i kliknij (na telefonie stuknij) podkreślone słowo — albo kliknij je prawym przyciskiem myszy. Obok słowa pojawi się dymek z podpowiedziami i **Dodaj do słownika**.
2. Kliknij podpowiedź (np. „wcześniej”) — słowo zmieni się w tym miejscu.
3. Nazwę własną, której słownik nie zna (np. nazwę firmy), dodaj przyciskiem **Dodaj do słownika**. Twój słownik jest na koncie, więc działa w każdym projekcie.

Wszystkie podejrzane słowa zaznaczonego tekstu widać też w panelu, w części **Pisownia** — tam podpowiedź zmienia słowo we wszystkich miejscach tego tekstu.

![Część „Pisownia” w panelu tekstu](https://makietka.app/img/instrukcja/k-pisownia.png)

- Pomijane są pola `{…}`, liczby, słowa z cyframi, adresy stron i e-maile.
- Wyłączysz sprawdzanie w menu widoku: **Sprawdzaj pisownię**.

## 6. Kształty, linie i kolory

Kształty, linie, rysowanie i kolory: wypełnienia, przejścia i obrysy.

### 6.1 Prostokąt, elipsa i wielokąt

**Prostokąt**, **Elipsa** i **Wielokąt** wstawiają kształty z wypełnieniem i obrysem (rozdział „6.5 Wypełnienie”, „6.6 Obrys”). **Wielokąt** najpierw pokazuje wybór: trójkąt, romb, pięcio-, sześcio- i ośmiokąt albo gwiazda o 4, 5, 6, 8 lub 12 ramionach. Klawisz `P` wstawia od razu trójkąt. Część **Kształt**:

- prostokąt — **Zaokrąglenie** narożników w mm,
- wielokąt — te same gotowe kształty co przy wstawianiu (trójkąt … gwiazda 12), **Liczba boków** (3–24) i przełącznik **Gwiazda**; zmiana zachowuje miejsce i wielkość.

### 6.2 Linia

**Linia** wstawia odcinek. Część **Linia**: **Kolor**, **Grubość** w mm i **Rodzaj** — ciągła, przerywana, kropkowana albo kreska – kropka (kreski rosną razem z grubością). Z `Shift` linia jest pozioma, pionowa albo pod kątem 45°. Linia rysowana odręcznie i kształt z pióra mają tę samą część, a zamknięty kształt z pióra — także **Wypełnienie**. Gotowe linie (cienka, gruba, przerywana, podwójna, pionowa, ozdobne) są w Bibliotece, w kategorii **Linie i separatory** (rozdział „4.8 Biblioteka”).

### 6.3 Rysowanie odręczne

**Rysuj** (`B`): przeciągaj po stronie jak ołówkiem — drżenie ręki jest wygładzane. Każde pociągnięcie to osobny element. Tryb zostaje włączony, więc narysujesz kilka kresek.

Kolor i grubość następnych linii ustawisz we właściwościach, w części **Pędzel** (rozdział „3.5 Właściwości i warstwy”). **Zakończ rysowanie** albo `Esc` kończy rysowanie.

![Rysowanie: kolor i grubość pędzla](https://makietka.app/img/instrukcja/k-rysowanie.png)

### 6.4 Pióro i edycja punktów

**Pióro** (`N`) tworzy kształt z punktów:

- kliknięcie stawia punkt narożny, kliknięcie z przeciągnięciem — punkt z łukiem,
- kliknięcie w pierwszy punkt zamyka kształt,
- `Enter` albo podwójne kliknięcie kończy kształt otwarty,
- `Backspace` cofa ostatni punkt, `Esc` porzuca zaczęty kształt.

**Edycja punktów:** kliknij kształt dwa razy albo wybierz **Edytuj punkty**. Przeciągaj punkty, a uchwytami zaznaczonego punktu zmieniaj łuki. Podwójne kliknięcie w linię dodaje punkt, `Delete` usuwa zaznaczony. `Enter` zatwierdza, `Esc` przywraca kształt sprzed edycji. Tak samo zmienisz linię rysowaną odręcznie.

![Edycja punktów](https://makietka.app/img/instrukcja/pioro.png)

### 6.5 Wypełnienie

Część **Wypełnienie i obrys**, lista **Wypełnienie**:

**Brak**, **Jeden kolor**, **Przejście liniowe** (w jednym kierunku, pod zadanym **Kątem**), **Przejście kołowe** (od środka na zewnątrz, zasięg — **Promień**) albo **Wzór**.

Pasek przejścia pokazuje kolory. **Dodaj kolor** dokłada kolejny; kliknięcie koloru na pasku pozwala zmienić go i jego położenie w %, **Usuń ten kolor z przejścia** go usuwa.

Każdy kolor przejścia ma pole **Krycie** — np. kolor przechodzący w przezroczystość nad zdjęciem.

![Krycie koloru w przejściu](https://makietka.app/img/instrukcja/k-krycie-przejscia.png)

**Wzór** wypełnia kształt powtarzalnym wzorem z Biblioteki — paski, kropki, kratka, jodełka, fale i inne. Wybierasz go z kafelków, a pod nimi ustawiasz **Kolor wzoru**, **Kolor tła**, **Skalę wzoru** i **Obrót wzoru**. Wzór nie rozciąga się, gdy zmieniasz rozmiar kształtu, a w pliku PDF zostaje ostry (wektorowy). Zamknięty kształt z pióra i kształty z Biblioteki mają w części **Linia** przełącznik **Wypełnij wzorem**. Kafelek wzoru w Bibliotece przy zaznaczonym kształcie pyta, czy **Wypełnij zaznaczony kształt**, czy **Wstaw na stronę**.

![Kształty wypełnione wzorem](https://makietka.app/img/instrukcja/k-wzor-ksztaltu.png)

### 6.6 Obrys

Kolor obrysu i **Grubość obrysu** w mm. Grubość nie zmienia się, gdy powiększasz kształt. Przy włączonym obrysie są też **Krycie obrysu** (półprzezroczysta ramka) i **Rodzaj linii** — ciągła, przerywana, kropkowana albo kreska – kropka; kreski rosną razem z grubością.

Kształt (także z obrazem w środku) może mieć **Miękkie krawędzie** — tak jak zdjęcie (rozdział „7.10 Obramowanie i miękkie krawędzie”).

### 6.7 Wybór koloru

Kliknięcie kółka koloru otwiera okno koloru: próbnik, **Kod koloru** (np. `#2f5bd3`), gotowe i ostatnio używane kolory oraz **Użyte w projekcie** — kolory ze wszystkich stron, wzorców i stylów, najczęstsze najpierw (przy kolorze dodatkowym widać jego nazwę, np. „PANTONE 186 C”, rozdział „22.1 Kolory dodatkowe”).

![Użyte w projekcie w oknie koloru](https://makietka.app/img/instrukcja/k-kolory-uzyte.png)

Gdy masz zestaw marki (rozdział „27.9 Zestaw marki”), nad „Użytymi w projekcie” jest część **Marka** — kolory marki z nazwami (nazwę i kod widać po najechaniu).

![Kolory marki w oknie koloru](https://makietka.app/img/instrukcja/k-marka-kolor.png)

## 7. Obrazy

Zdjęcia i grafiki: wstawianie, kadrowanie, ramki, filtry i usuwanie tła.

### 7.1 Wstawianie obrazu

**Obraz** pyta, skąd wziąć obraz:

- **Wgraj z urządzenia** — wybór pliku PNG, JPEG, WebP, GIF albo SVG,
- **Wybierz z obrazów projektu** — obraz, który już jest w projekcie, bez drugiej kopii.

W projekcie bez obrazów od razu otwiera się wybór pliku. Obraz wstawisz też, przeciągając plik na stronę albo wklejając ze schowka (`Ctrl`+`V`) — np. zrzut ekranu albo obraz skopiowany ze strony internetowej.

### 7.2 Kadrowanie

Kliknij obraz dwa razy albo wybierz **Kadruj przeciąganiem**: przesuwasz zdjęcie w ramce i zmieniasz jej brzegi. `Enter` zatwierdza, `Esc` anuluje. To samo liczbami: **Przycięcie (% oryginału)** — **Z góry**, **Z dołu**, **Z lewej**, **Z prawej**.

### 7.3 Właściwości obrazu

| Ustawienie | Znaczenie |
|---|---|
| **Podmień zdjęcie** | Inne zdjęcie w tej samej ramce (rozdział „7.4 Podmiana zdjęcia”). |
| **Obrazy projektu…** | Okno wszystkich obrazów (rozdział „7.5 Okno Obrazy projektu”). |
| Opis pod nagłówkiem | Wymiary oryginału w pikselach i rozdzielczość w tym rozmiarze (dpi). Do druku — co najmniej 300 dpi; przy mniejszej opis zmienia kolor. |
| **Obramowanie** | Ramka wokół zdjęcia: kolor, **Grubość**, **Krycie obrysu**, **Rodzaj linii** (ciągła, przerywana, kropkowana, kreska – kropka) i **Zaokrąglenie narożników** w mm — zaokrąglenie przycina też samo zdjęcie (rozdział „7.10 Obramowanie i miękkie krawędzie”). |
| **Odbij lustrzanie w poziomie** | Odwraca obraz. |
| **Obraz z danych** | Inny obraz na każdej powielonej stronie (rozdział „17.5 Obraz z danych”). |

### 7.4 Podmiana zdjęcia

**Podmień zdjęcie** wstawia inny plik w tę samą ramkę: rozmiar, miejsce, obrót, obrys i cień zostają, a zdjęcie o innych proporcjach jest przycięte do ramki.

### 7.5 Okno Obrazy projektu

**⋯** → **Obrazy projektu…** pokazuje wszystkie obrazy projektu: miniaturę, pełną nazwę pliku, wymiary, rozmiar i miejsca użycia (numery stron, wzorce, tabele danych).

| Przycisk | Co robi |
|---|---|
| **Wgraj obrazy…** | Dodaje pliki z urządzenia, kilka naraz — także archiwum ZIP z obrazami. |
| **Kopiuj nazwę** | Na karcie obrazu: kopiuje nazwę pliku, np. do tabeli danych. |
| **⋯** na karcie | Rzadsze działania dla tego obrazu: **Zmień nazwę**, **Podmień plik…**, **Kopiuj nazwę**, **Usuń obraz…**. |
| **Zmień nazwę** | Nowa nazwa (także kliknięciem nazwy); komórki tabel z tą nazwą zmieniają się razem z nią. |
| **Podmień plik…** | Nowy plik w miejsce starego — wszędzie, gdzie obraz był użyty. |
| **Usuń** | Usuwa zaznaczone obrazy. Użytych obrazów aplikacja nie usunie — powie, gdzie są. |
| **Usuń nieużywane** | Usuwa obrazy, których nic nie używa. |

![Menu ⋯ na karcie obrazu](https://makietka.app/img/instrukcja/k-menu-obrazu.png)

Kliknięcie obrazu go zaznacza; `Ctrl` dodaje kolejne, `Shift` — cały zakres. Ten sam plik wgrany drugi raz nie tworzy kopii. Inny plik o tej samej nazwie — aplikacja pokaże oba obrazy i zapyta: **Zastąp**, **Zachowaj oba** albo **Pomiń**. Gdy projekt ma powtórzone obrazy sprzed tego okna, u góry pojawia się pasek z **Uporządkuj** — scala kopie w jeden plik. Przy kilku zaznaczonych obrazach **Kopiuj nazwy** kopiuje wszystkie nazwy naraz, np. do kolumny tabeli danych.

> **Uwaga:** Usuniętego obrazu nie przywróci **Cofnij**.

![Obrazy projektu](https://makietka.app/img/instrukcja/obrazy-projektu.png)

### 7.6 Rysunki SVG

Plik SVG wstawia się jako obraz: wygląda wiernie i zostaje ostry w każdym powiększeniu, ale nie zmienisz w nim kolorów ani napisów.

**Rozłóż rysunek na elementy** (we właściwościach obrazu) zamienia go na stronie w **grupę zwykłych kształtów i napisów** w tym samym miejscu. Kształtom zmienisz kolor i punkty, napisy poprawisz jak każdy tekst. Plik SVG nie zmienia się i zostaje w oknie obrazów projektu.

Nic przy tym nie znika:

- **przycięcie** i **przejścia kolorów** zostają kształtami,
- **prosta maska** (biały kształt) staje się przycięciem, a **wzór** (np. kropki, kratka) — powtórzonymi kształtami przyciętymi do swojej figury,
- fragmenty z **efektami, których edytor nie ma** (rozmycie, cień z filtra, maska z przejściem, mieszanie kolorów, groty linii, tekst po ścieżce) zostają **obrazem** w tym samym miejscu, w rozdzielczości do druku. Po rozłożeniu aplikacja powie, ile ich jest; reszta rysunku jest edytowalna.

`Ctrl`+`Z` przywraca cały rysunek.

![Rysunek SVG przed i po rozłożeniu](https://makietka.app/img/instrukcja/rysunek-svg.png)

### 7.7 Obraz w kształcie

Każdy kształt może być ramką obrazu: prostokąt, elipsa, wielokąt, gwiazda i zamknięty kształt z pióra.

1. Zaznacz kształt i w części **Obraz w kształcie** wybierz **Wstaw obraz do kształtu** — albo upuść plik obrazu prosto na kształt.
2. Obraz wypełnia kształt i jest przycięty do jego brzegów.
3. Kliknij kształt dwa razy, żeby przesunąć obraz i powiększyć go narożnikami; `Enter` zatwierdza, `Esc` anuluje. Na telefonie użyj pól **Powiększenie** i **Przesunięcie**.

![Kształt z obrazem i część „Obraz w kształcie”](https://makietka.app/img/instrukcja/k-obraz-w-ksztalcie.png)

![Kadrowanie obrazu w kształcie: cały obraz półprzezroczyście, kształt jako obrys](https://makietka.app/img/instrukcja/obraz-w-ksztalcie-kadr.png)

Kształt zmieniasz jak zwykle — rozmiar, punkty, obrys, cień — a obraz idzie za nim. **Wyjmij obraz** zostawia zwykły obraz w miejscu kształtu. Na stronach z danymi wybierz **Obraz z kolumny**: na każdej stronie pojawi się inny obraz.

Zdjęcie zamienisz w kształt jednym kliknięciem: w części **Kadrowanie** **Zaokrąglone rogi** albo **Koło**. Zaokrąglenie zmienisz potem w części **Wypełnienie i obrys**.

### 7.8 Usuwanie tła

Zaznacz zdjęcie (albo kształt z obrazem) i wybierz **Usuń tło…**.

| Narzędzie | Co robi |
|---|---|
| **Różdżka** | Kliknij tło — znika kolor podobny do klikniętego. **Tolerancja** mówi, jak podobny. |
| **Tylko połączone z klikniętym miejscem** | Nie rusza takich samych kolorów w środku zdjęcia. |
| **Usuń** / **Przywróć** | Pędzle do poprawek brzegów, myszą albo palcem. |
| **Wygładzenie krawędzi** | Zmiękcza brzeg. |

**Zapisz jako nowy obraz** dodaje nowy plik do obrazów projektu i wstawia go w miejsce starego; oryginał zostaje.

![Okno „Usuń tło”](https://makietka.app/img/instrukcja/usun-tlo.png)

### 7.9 Filtry

W części **Filtry** zdjęcia albo obrazu w kształcie ustawisz **jasność**, **kontrast**, **nasycenie** i **rozmycie** oraz włączysz **odcień szarości** albo **sepię**. Plik się nie zmienia; **Bez filtrów** wraca do oryginału.

![Filtry obrazu](https://makietka.app/img/instrukcja/k-filtry.png)

### 7.10 Obramowanie i miękkie krawędzie

Część **Obramowanie** zdjęcia: kolor (pole **brak** wyłącza ramkę), **Grubość** w mm, **Krycie obrysu**, **Rodzaj linii** i **Zaokrąglenie narożników** w mm. Zaokrąglenie przycina samo zdjęcie, a obramowanie idzie po zaokrągleniu. Grubość i zaokrąglenie zostają takie same, gdy zmieniasz rozmiar zdjęcia.

Część **Miękkie krawędzie** (zdjęcie i kształty): **Szerokość przejścia** w mm — tyle od brzegu zdjęcie płynnie znika w przezroczystość; 0 to ostry brzeg. **Rodzaj**:

| Rodzaj | Wygląd |
|---|---|
| **równo wzdłuż brzegu** | Przejście biegnie wzdłuż brzegu — prostokąta, kształtu albo przezroczystych miejsc obrazu PNG. |
| **owalna winieta** | Widać owal w środku, który miękko znika ku brzegom i narożnikom. |

![Obramowanie z zaokrągleniem i owalna winieta](https://makietka.app/img/instrukcja/k-obramowanie.png)

Obramowanie, zaokrąglenie i miękkie krawędzie przenosi też **Kopiuj wygląd** (rozdział „4.13 Kopiuj wygląd (malarz formatów)”).

## 8. Tabela

Tabela na stronie — do cenników, planów, list. To co innego niż tabela danych do powielania stron (rozdział „14 Tabele danych”).

### 8.1 Wstawianie tabeli

**Tabela** otwiera okno **Wstaw tabelę**:

| Pole | Znaczenie |
|---|---|
| **Wiersze** | Liczba wierszy (1–60). |
| **Kolumny** | Liczba kolumn (1–12). |
| **Najmniejsza wysokość wiersza (mm)** | Wiersz nie będzie niższy; rośnie, gdy tekst się nie mieści. |
| **Pierwszy wiersz to nagłówek** | Pierwszy wiersz pogrubiony, z grubszą linią pod spodem. |

Tabelę przesuwasz, powiększasz i obracasz w całości, jak każdy element. **Pojedyncze kliknięcie komórki** zaznaczonej tabeli wybiera tę komórkę (rozdział „8.3 Wiersze, kolumny i ich rozmiar”), **dwukrotne** — zaczyna w niej pisanie (rozdział „8.2 Pisanie w komórkach”).

![Tabela](https://makietka.app/img/instrukcja/tabela.png)

### 8.2 Pisanie w komórkach

Kliknij komórkę dwa razy, żeby w niej pisać. `Tab` przechodzi do następnej komórki, `Shift`+`Tab` do poprzedniej; `Tab` w ostatniej komórce dodaje wiersz. Komórka to zwykły tekst: pogrubisz w niej fragment, zmienisz czcionkę, wstawisz pole z danych (rozdział „15 Pola w tekście”). Wiersz rośnie razem z tekstem — także na stronach powielonych z danych.

### 8.3 Wiersze, kolumny i ich rozmiar

**Cała tabela**: **Wiersze** i **Kolumny** **−** **+** (ostatni wiersz i kolumna), **Pierwszy wiersz to nagłówek**, **Szerokość tabeli** w mm (kolumny zmieniają się proporcjonalnie), **Wysokość wierszy** (najmniejsza — wiersz rośnie sam z tekstem) i **Wyrównaj szerokości kolumn**.

![Cała tabela](https://makietka.app/img/instrukcja/k-tabela-cala.png)

**Kolumna i wiersz** — kliknij raz komórkę zaznaczonej tabeli (albo pisz w niej): szerokość tej kolumny i wysokość tego wiersza w mm, **Kolumna przed**, **Kolumna po**, **Wiersz nad**, **Wiersz pod** i usuwanie.

![Kolumna i wiersz wybranej komórki](https://makietka.app/img/instrukcja/k-tabela-komorka.png)

**Szerokości wszystkich kolumn** (część zwinięta) — szerokość każdej kolumny w mm, jedna pod drugą.

Granicę kolumn przesuniesz też myszą: przy zaznaczonej tabeli nad granicami kolumn są niebieskie znaczniki. Kolumna obok zwęża się o tyle samo, a ostatni znacznik zmienia szerokość całej tabeli.

### 8.4 Scalanie komórek

W trakcie pisania w komórce: **Scal z komórką po prawej** i **Scal z komórką poniżej**. Klikając kilka razy, zrobisz komórkę na kilka kolumn albo wierszy. **Rozdziel komórki** wraca do pojedynczych komórek.

### 8.5 Linie i tła

| Część | Co ustawisz |
|---|---|
| **Linie tabeli** | Kolor i grubość linii (0 — bez linii). |
| **Linie wiersza, kolumny, tabeli** | Które linie — zewnętrzne, poziome, pionowe — dla tego wiersza, tej kolumny albo całej tabeli. |
| **Linie tej komórki** | Każda krawędź komórki osobno: jak w tabeli, inna albo bez linii. |
| **Tło wierszy** | Kolor wiersza nagłówka i co drugiego wiersza (tabela w paski). |
| **Tekst w komórkach** | Czcionka, rozmiar, kolor, wyrównanie i odstęp od brzegu komórki. |

## 9. Warstwy

Lista wszystkich elementów strony — do zaznaczania, ukrywania i zmiany kolejności.

### 9.1 Panel Warstwy

Panel **Warstwy** pokazuje wszystkie elementy otwartej strony, od leżącego na wierzchu do leżącego na spodzie. Na komputerze to zakładka **Warstwy** u góry prawej kolumny (`F7`), z liczbą elementów strony; na telefonie otwiera go przycisk **Warstwy** na dole ekranu.

![Warstwy](https://makietka.app/img/instrukcja/warstwy.png)

### 9.2 Wiersz warstwy

| W wierszu | Co robi |
|---|---|
| **Nazwa** | Kliknięcie zaznacza element, podwójne kliknięcie zmienia nazwę. |
| **Uchwyt ⋮⋮** | Przeciągnij wiersz, żeby zmienić kolejność — myszą albo palcem. |
| **Oko** | Ukrywa element. Ukryty element nie jest drukowany. |
| **Kłódka** | Blokuje położenie i rozmiar. |
| **⋯** | **Na wierzch**, **Wyżej**, **Niżej**, **Na spód**, **Zmień nazwę**, **Kopiuj wygląd** (rozdział „4.13 Kopiuj wygląd (malarz formatów)”), **Zapisz w bibliotece** (rozdział „4.8 Biblioteka”). |

Zaznaczenie na liście przydaje się, gdy element leży pod innym i trudno w niego trafić na stronie.

### 9.3 Grupy, tabele i wzorce na liście

- Trójkąt przy grupie albo tabeli rozwija jej zawartość. Kliknięcie elementu grupy otwiera grupę z tym elementem zaznaczonym (rozdział „4.5 Grupy”); kliknięcie komórki tabeli zaczyna w niej pisanie.
- Na górze i na dole listy są elementy wzorców strony (nad treścią i pod treścią). Nie zmienisz ich tutaj — kliknięcie otwiera wzorzec do edycji (rozdział „11.5 Własny wzorzec i edycja”).

## 10. Strony, sekcje i rozkładówki

Kolejność stron, sekcje o różnych formatach, rozkładówki, okładka z grzbietem i numeracja.

### 10.1 Panel stron

Panel z lewej pokazuje miniatury wszystkich stron w kolejności druku, pogrupowane w sekcje (szare nagłówki). Kliknięcie miniatury otwiera stronę. Strona powielana z danych ma znaczek **×N** — tyle razy wyjdzie w wydruku (rozdział „16 Serie”). Miniatury zapamiętują się na urządzeniu: przy kolejnym otwarciu projektu pokazują się od razu, a od nowa rysują się tylko strony zmienione od tamtej pory.

Na telefonie strony stoją w poziomym pasku, który przewijasz palcem.

![Pasek stron na telefonie](https://makietka.app/img/instrukcja/k-strony-telefon.png)

![Panel stron z menu strony](https://makietka.app/img/instrukcja/strony.png)

### 10.2 Dodawanie i porządkowanie stron

- Kafelek **+** na końcu stron sekcji dodaje pustą stronę za bieżącą.
- **Sekcja** na dole panelu tworzy nową sekcję.
- **Przeciągnij miniaturę**, żeby zmienić kolejność; upuszczona w innej sekcji przechodzi do niej.
- **⋯** na miniaturze: **Zmień nazwę**, **Duplikuj**, **Przesuń wyżej**, **Przesuń niżej**, **Usuń stronę**.
- **⋯** przy nagłówku sekcji: **Ustawienia sekcji**, **Dodaj stronę do sekcji**, **Przesuń sekcję wyżej**, **Przesuń sekcję niżej**, **Usuń sekcję**.

### 10.3 Właściwości strony

Gdy nic nie jest zaznaczone, panel właściwości pokazuje ustawienia otwartej strony:

| Ustawienie | Znaczenie |
|---|---|
| **Nazwa strony** | Nazwa na liście stron. |
| **Sekcja** | Przeniesienie strony do innej sekcji. |
| **Tło** | Kolor tła tej strony. |
| **Wzorce** | Wzorce z sekcji albo własny wybór dla tej strony (rozdział „11.4 Na których stronach jest wzorzec”). |
| **Seria** | Powielanie strony z tabeli danych (rozdział „16 Serie”). |
| **Prowadnice** | Prowadnice wpisane liczbą (rozdział „12.4 Linijki i prowadnice”). |
| **Wklej skopiowane elementy** | Wkleja elementy ze schowka w to samo miejsce. |

![Ustawienia strony: seria](https://makietka.app/img/instrukcja/k-seria.png)

### 10.4 Ustawienia sekcji

Sekcja to część publikacji z własnymi ustawieniami, np. „Okładka” i „Środek”. Okno otworzysz przyciskiem formatu na górnym pasku albo **⋯** przy nagłówku sekcji → **Ustawienia sekcji**.

| Ustawienie | Znaczenie |
|---|---|
| **Nazwa sekcji** | Nazwa na liście stron. |
| **Układ stron** | **Pojedyncze** albo **Rozkładówki** (rozdział „10.5 Rozkładówki”). |
| **Typ sekcji** | Czym sekcja jest w publikacji – karta z ikoną i opisem: **Zwykła**, **Blok (środek książki)**, **Okładka** (rozdział „10.6 Okładka z grzbietem”), **Wyklejka przednia** i **tylna**, **Obwoluta**, **Wkładka**, **Podkładka / plecy**, **Ulotka składana**, **Kalendarz roczny**, **Kalendarz trójdzielny**, **Wykrojnik**, **Arkusz użytków** (rozdział „10.11 Sekcje specjalne: obwoluta, ulotka, kalendarze, wykrojniki, użytki”). Typ sam ustala format, strefy, numerację i grzbiet okładki — nazwa sekcji nie ma na to wpływu. Typ wybierasz przy **Sekcja** i zmieniasz tutaj. |
| **Format** | Rozmiar strony w mm. Zmiana tutaj nie rusza elementów — żeby przeskalować je razem z formatem, kliknij **Zmień format i dopasuj elementy…** (rozdział „10.9 Zmiana formatu ze skalowaniem”). |
| **Marginesy i spad** | Wpisujesz je na schemacie strony, w mm. |
| **Pierwsza strona sekcji** | W rozkładówkach: **Prawa (jak w książce)** albo **Lewa (od razu pełna rozkładówka)**. |
| **Numeracja stron** | **Dalszy ciąg poprzedniej sekcji**, **Zacznij od numeru…** albo **Bez numerów (np. okładka)** (rozdział „10.8 Numeracja stron”). |
| **Składki (pilnuj liczby stron)** | **Bez pilnowania** albo co 4, 8, 16, 32 strony (rozdział „10.7 Składki”). |
| **Wzorce na stronach tej sekcji** | Wzorce domyślne stron sekcji (rozdział „11.4 Na których stronach jest wzorzec”). |
| **Znaki cięcia w pliku PDF** | Znaki cięcia na stronach tej sekcji w pliku dla drukarni. |
| **Siatka linii bazowych** | **Odstęp** i **Pierwsza linia** (mm od góry) — wiersze tekstów z „Wyrównaj do siatki” stoją na tych liniach (rozdział „5.13 Siatka linii bazowych”). |

![Ustawienia sekcji](https://makietka.app/img/instrukcja/sekcje.png)

### 10.5 Rozkładówki

W sekcji z rozkładówkami strony tworzą pary: lewa i prawa, jak w otwartej książce.

- Lewą i prawą stronę edytujesz **razem**. Nowe elementy trafiają na stronę bieżącą — wybierasz ją kliknięciem w jej obszar.
- Marginesy są **lustrzane**: wewnętrzny przy grzbiecie, zewnętrzny przy krawędzi.
- Element może leżeć **przez grzbiet**, np. zdjęcie na całą rozkładówkę — każda strona wydrukuje swoją część. Element należy do strony, na której leży jego środek.
- Gruba ciemna linia to grzbiet. Tekstu nie kładź tuż przy nim — po zszyciu może go nie być widać; aplikacja ostrzega o elementach, które wystają w pas przy grzbiecie.
- Przycisk z dwiema kartkami obok powiększenia przełącza całą rozkładówkę i jedną stronę (na telefonie domyślnie jedna strona).

![Rozkładówka](https://makietka.app/img/instrukcja/rozkladowki.png)

### 10.6 Okładka z grzbietem

Okładka to osobna sekcja z jedną szeroką stroną: tył, grzbiet i przód. Zrobisz ją w oknie sekcji (**Typ sekcji** → **Okładka**), w menu sekcji (**Zamień na okładkę z grzbietem**) albo od razu w oknie nowego projektu (pole **Okładka**).

| Ustawienie | Co znaczy |
|---|---|
| **Oprawa** | **Miękka klejona (z grzbietem)**, **Zeszytowa – szyta zszywkami (bez grzbietu)** albo **Twarda (tektura z zawinięciem)** — przy twardej ustawisz **Zawinięcie**, **Big**, **Naddatek tektury** i **Grubość tektury** (mm). |
| **Papier środka** | **Gramatura** — **Gramatura (g/m²)** i **Rodzaj papieru** (offset, kredowy mat, kredowy błysk, objętościowy) — albo **Grubość kartki** w mm od drukarni. |
| **Strony środka** | **Policz same** — ze wszystkich stron środka, razem z powieleniami serii — albo **Wpisz** liczbę. **Środek to sekcje** wybiera, które sekcje się liczą, gdy jest ich kilka. |

Schemat w oknie pokazuje tył, grzbiet i przód, a pod nim wynik, np. „Grzbiet 6,6 mm · Okładka 352,6 × 246 mm”. Szerokość i wysokość okładki liczą się same.

**Wymiary** — gdy drukarnia poda grzbiet albo cały rozmiar okładki:

| Wybór | Co się dzieje |
|---|---|
| **Policz same** | Grzbiet z papieru i liczby stron, rozmiar z formatu środka. |
| **Wpisz grzbiet** | **Grzbiet (mm)** od drukarni zamiast liczonego. Reszta liczy się jak zwykle. |
| **Wpisz rozmiar** | **Szerokość okładki** i **Wysokość okładki** (mm, bez spadu) — tył i przód dzielą resztę szerokości po równo wokół grzbietu. Grzbiet możesz też wpisać; puste pole — grzbiet liczony. |

![Wymiary okładki wpisane ręcznie](https://makietka.app/img/instrukcja/k-okladka-wymiary.png)

![Okno sekcji: okładka z grzbietem, schemat i wynik](https://makietka.app/img/instrukcja/k-okladka-okno.png)

Na płótnie przerywane linie pokazują zgięcia (grzbiet, bigi, zawinięcia), a niebieskie ramki — bezpieczne pola tyłu, grzbietu i przodu.

![Okładka na płótnie: tył, grzbiet, przód](https://makietka.app/img/instrukcja/okladka.png)

Gdy w środku przybędzie stron albo zmienisz papier, okładka przelicza się sama: tył zostaje, przód przesuwa się razem z grzbietem, napisy na grzbiecie zostają na jego środku, a tło na całą okładkę się rozciąga. W panelu elementu, w części **Inne**, lista **Na okładce trzyma się** (automatycznie, tyłu, grzbietu albo przodu) mówi, czego element się trzyma; przełącznik **Dopasuj szerokość do grzbietu** rozciąga pasek na grzbiecie na całą jego szerokość. Ostrzeżenie „Szerszy niż grzbiet” mówi, że element zachodzi na tył albo przód.

![Element przypięty do części okładki](https://makietka.app/img/instrukcja/k-okladka-przypiecie.png)

> **Uwaga:** wzorce przypisane do sekcji okładki nie przesuwają się same.

### 10.7 Składki

Środek szyty albo klejony ze składek musi mieć liczbę stron podzielną przez wielkość składki. W ustawieniach sekcji wybierz **Składki**: co 4, 8, 16 albo 32 strony.

Na liście stron pod nazwą sekcji zobaczysz np. „46 z 48 – brakuje 2 do pełnej składki (×16)”. **Dopełnij pustymi** dodaje brakujące puste strony na końcu sekcji — cofniesz to jak każdą zmianę. **Sprawdź przed drukiem** też przypomni o niepełnej składce, a przy oprawie zeszytowej — o liczbie stron niepodzielnej przez 4.

![Licznik składki i „Dopełnij pustymi”](https://makietka.app/img/instrukcja/k-skladki.png)

### 10.8 Numeracja stron

Numer strony wstawisz polem `{nr}` — najlepiej we wzorcu, żeby był na każdej stronie (rozdział „11.7 Pola we wzorcu”). Numeracja zależy od ustawień sekcji (rozdział „10.4 Ustawienia sekcji”) i liczy strony po powieleniu serii. Numerowane są tylko sekcje bloku (typ **Zwykła**, **Blok**, **Kalendarz roczny**): okładka, wyklejki, obwoluta, wkładka, podkładka i druki osobne nie mają numerów i nie przesuwają numeracji — pierwsza strona bloku ma numer 1 także wtedy, gdy przed nią stoją okładka i wyklejka. Inne zapisy numeru (rzymskie, z zerami) są w tabeli pól (rozdział „15.2 Pola dokumentu”).

### 10.9 Zmiana formatu ze skalowaniem

Kalendarz z A4 na A3, książka z B5 na A5 — format zmienisz razem z elementami:

- jedna sekcja: okno sekcji (rozdział „10.4 Ustawienia sekcji”) → **Zmień format i dopasuj elementy…**,
- cały projekt: **⋯** → **Zmień format projektu…**.

1. Wybierz **Nowy format** z listy albo wpisz **Szerokość (mm)** i **Wysokość (mm)**; **Zamień orientację** obraca kartkę.
2. Wybierz, **Co z elementami**:

| Sposób | Co się dzieje |
|---|---|
| **Skaluj wszystko** | Elementy, pismo, linie, marginesy, prowadnice i wzorce zmieniają się proporcjonalnie. **Skala**: **Zmieść całą stronę (wyśrodkuj)**, **Dopasuj do szerokości** albo **Dopasuj do wysokości**. |
| **Zostaw rozmiary, przesuń względem krawędzi** | Rozmiary zostają; element trzyma się najbliższej krawędzi albo środka. Tło i paski na całą szerokość lub wysokość rozciągają się na nową stronę. |
| **Tylko zmień format** | Elementy zostają tam, gdzie są. |

1. Podgląd **Teraz → Po zmianie** pokazuje pierwszą stronę przed i po. Pod nim są uwagi, np. ile elementów wyjdzie poza stronę.
2. **Zmień format**. Całą zmianę cofniesz jednym **Cofnij** (`Ctrl`+`Z`).

![Zmiana formatu z podglądem przed i po](https://makietka.app/img/instrukcja/k-format.png)

Okładka z grzbietem (rozdział „10.6 Okładka z grzbietem”) przelicza się sama po zmianie formatu środka. Elementy, które po zmianie wystają poza stronę, pokaże **Sprawdź przed drukiem** (rozdział „20 Sprawdź przed drukiem”).

### 10.10 Gotowe sekcje (szablony dokumentów)

Cały gotowy dokument wstawisz jednym kliknięciem jako nową sekcję: kalendarz ścienny, planer na 365 dni, notes, zaproszenie, dyplomy dla listy osób, wizytówki, ulotkę, menu, rozdział książki i ponad 30 innych. Gdzie: na dole panelu stron przycisk **Gotowa** (obok **Sekcja**), w Bibliotece kategoria **Gotowe sekcje** (rozdział „4.8 Biblioteka”) albo od razu przy nowym projekcie: **Zacznij od → Gotowego szablonu** (rozdział „2.2 Nowy projekt”).

![Gotowe sekcje – galeria szablonów](https://makietka.app/img/instrukcja/k-gotowe-sekcje.png)

1. Wybierz rodzaj u góry (**Książka**, **Kalendarze**, **Planery i notesy**, **Zaproszenia i dyplomy**, **Firma i reklama**, **Inne**) albo wpisz słowo w **Szukaj**. Miniatura pokazuje pierwszą stronę w formacie Twojego projektu, a pod nią widać, ile stron powstanie. Plakietka **z danymi** – strony biorą treść z tabeli (np. 365 dni, osoby do dyplomów).
2. Kliknij szablon. Zobaczysz podgląd pierwszych stron i ustawienia: - pytania szablonu, np. **Rok** kalendarza albo **Liczba stron** notesu, - **Kolory**: kolory marki (gdy masz zestaw marki, rozdział „27.9 Zestaw marki”), kolory szablonu albo jedna z gotowych palet, - szablony z własnym formatem (wizytówka 85 × 55 mm, dyplom A4 poziomo, etykieta 70 × 40 mm) mają przełącznik formatu – odznacz go, żeby szablon dopasował się do formatu sekcji.
3. **Wstaw jako nową sekcję**. Sekcja staje za bieżącą, a edytor przechodzi na jej pierwszą stronę.

![Szczegóły szablonu – podgląd, rok i kolory](https://makietka.app/img/instrukcja/k-gotowe-szczegoly.png)

Szablon nie jest zamrożonym plikiem: buduje się dla Twojego formatu, marginesów i spadu, w kolorach i czcionkach marki. Po wstawieniu to zwykłe strony, wzorce (np. numer strony), style i tabela danych z serią (rozdział „14 Tabele danych”, „16 Serie”) – zmienisz w nich wszystko jak we własnych. Szare pola to miejsca na zdjęcia: wstaw do nich obraz (rozdział „7.7 Obraz w kształcie”). Całą wstawioną sekcję usuwa jedno **Cofnij** (`Ctrl`+`Z`).

### 10.11 Sekcje specjalne: obwoluta, ulotka, kalendarze, wykrojniki, użytki

Sekcja specjalna działa jak okładka z grzbietem (rozdział „10.6 Okładka z grzbietem”): wie, czym jest wydrukowana rzecz. Sama liczy swój format, podpisuje na stronie strefy (panele, skrzydełka, klapy), rysuje linie zgięć (bigi, przerywane), perforacji (kropkowane) i cięcia (ciągła różowa linia), ostrzega o tekście na zgięciu i o elementach poza linią cięcia, a w pliku PDF daje arkusz w pełnym wymiarze. Wybierasz ją jako **Typ sekcji** przy **Sekcja** albo w ustawieniach sekcji (rozdział „10.4 Ustawienia sekcji”). Schemat w oknie pokazuje strefy i zgięcia na bieżąco, pod nim wymiary arkusza.

![Ulotka składana w ustawieniach sekcji](https://makietka.app/img/instrukcja/k-sekcja-ulotka.png)

| Typ | Co liczy |
|---|---|
| **Wyklejka przednia / tylna** | Twarda oprawa: arkusz o szerokości dwóch stron bloku, ze zgięciem pośrodku. Połowa **Na okładce (przyklejona)** przykleja się do wnętrza okładki, druga to pierwsza (przednia) albo ostatnia (tylna) luźna kartka książki. **Zadruk**: czysta, zadrukowana strona widoczna albo obie strony; **Papier** (g/m²) — luźna kartka dochodzi do grubości grzbietu. Wyklejka nie ma numerów stron. |
| **Obwoluta ze skrzydełkami** | Tył, grzbiet i przód z twardej okładki projektu (płyty i grzbiet), dwa skrzydełka (**Skrzydełko**, 0 – około połowy przodu) i zapas na zgięcie przy płycie. Przybędzie stron – obwoluta przeliczy się sama, a elementy przodu przesuną się razem z nim. |
| **Ulotka składana** | Arkusz na 2, 3 albo 4 panele, **Złożenie**: **Zwijane** (łamana C – panel składany do środka jest węższy o **Skrót**, żeby się nie zaginał) albo **Harmonijka** (Z – panele równe). Sekcja ma dwie strony: zewnętrzną (z panelem **Okładka**) i wewnętrzną. |
| **Kalendarz z datami (rok)** | **Rok**, **Strona na** miesiąc, tydzień albo dzień, początek tygodnia i **Święta** (Polska: stałe i ruchome – Wielkanoc, Zielone Świątki, Boże Ciało). Tworzy tabelę danych i serię: pierwsza strona sekcji powiela się dla każdego miesiąca, tygodnia albo dnia. Zmiana roku przelicza wszystko. |
| **Kalendarz trójdzielny** | Główka, trzy kalendaria jedno pod drugim, okienko na środkowym i pasek reklamowy – z bigiem pod główką i perforacjami. |
| **Wykrojnik** | **Koperta** (C6, DL, C5, kwadrat), **Teczka ofertowa** z kieszenią i nacięciami na wizytówkę albo **Pudełko** (długość, szerokość, wysokość → siatka z wieczkiem, dnem, klapkami i zakładką klejową). |
| **Arkusz użytków** | Naklejki, wizytówki, etykiety: projektujesz jeden użytek (albo kolejne z danych – seria), a w PDF stoją obok siebie na arkuszu (SRA3, A3, A4, B2) ze znakami cięcia. **Naklejka** dostaje linię wykrojnika z zaokrąglonymi rogami. |

![Wykrojnik pudełka na stronie: strefy, zgięcia i linia cięcia](https://makietka.app/img/instrukcja/k-sekcja-wykrojnik.png)

**Pola kalendarza z datami** do wstawienia w tekst (rozdział „15 Pola w tekście”): `{data}`, `{dzien}`, `{miesiac}`, `{dzien_tygodnia}`, `{tydzien}`, `{swieto}`; kolumna `wolne` ma wartość „tak” w niedziele i święta – użyj jej w kolorze zależnym od danych (rozdział „17 Wygląd z danych”), żeby święta były czerwone. Własne kolumny dopisane do tej tabeli zostają po zmianie roku.

**W pliku PDF** (rozdział „21 Eksport do PDF i PNG”): linia cięcia wykrojnika jest osobnym kolorem dodatkowym **CutContour**, zgięcia – **Crease**, perforacje – **Perforation**: drukarnia ich nie drukuje, tylko wycina, biguje i perforuje. Przy obwolucie, ulotce i kalendarzu trójdzielnym (cięte prosto) zgięcia i perforacje są zaznaczone kreskami poza formatem, obok znaków cięcia. Arkusz użytków składa się sam, gdy w eksporcie jest **Układ arkuszy: Zwykły**. Uwagi o tekście na zgięciu i elementach poza linią cięcia pokazuje też **Sprawdź przed drukiem** (rozdział „20 Sprawdź przed drukiem”).

Gotowe sekcje (rozdział „10.10 Gotowe sekcje (szablony dokumentów)”) **Broszura składana**, **Wizytówki** i **Etykiety i naklejki** wstawiają się od razu jako ulotka składana i arkusz użytków, a **Okładka** w twardej oprawie — razem z dwiema czystymi wyklejkami.

**Książka w twardej oprawie** składa się z sekcji typów: **Okładka** (oprawa twarda), **Wyklejka przednia**, **Blok**, ewentualnie **Wkładka** (np. zdjęcia na kredzie — z własnym papierem, bez numerów stron) i **Wyklejka tylna**. Grzbiet okładki liczy się z bloku i dodaje luźne kartki wyklejek i kartki wkładek, każde swoim papierem. **Sprawdź przed drukiem** (rozdział „20 Sprawdź przed drukiem”) ostrzega, gdy twarda okładka nie ma wyklejek (przycisk **Dodaj wyklejki** dopisuje obie, czyste), i gdy wyklejka stoi przy miękkiej oprawie. Twarda okładka może mieć też **Zakładkę – tasiemkę w grzbiecie** w wybranym kolorze. W eksporcie PDF (rozdział „21 Eksport do PDF i PNG”) **Pliki dla drukarni: okładka, wyklejki, blok…** daje osobny plik dla każdej części: okładki, obwoluty, wyklejek, bloku, wkładek i każdego druku osobnego.

Sekcja ze starszego projektu, która w nazwie ma „wyklejka”, a typ zwykły, dostaje raz podpowiedź „Sekcja … wygląda na wyklejkę – ustawić typ…?” z przyciskiem **Ustaw typ**. To tylko propozycja — bez kliknięcia sekcja zostaje zwykła.

## 11. Wzorce stron

### 11.1 Czym jest wzorzec i kiedy go użyć

Niektóre rzeczy powtarzają się na wielu stronach: **numer strony, nagłówek, stopka, tło, ramka, linie do pisania**. Zamiast wstawiać je na każdą stronę osobno, wstawiasz je raz — jako **wzorzec**.

- Wzorzec leży **pod** treścią każdej strony, która go ma. Na samej stronie go nie zaznaczysz ani nie przesuniesz — dzięki temu nie rozjedzie się przypadkiem.
- Zmieniasz go raz, a zmieniają się **wszystkie** te strony.
- Pole `{nr}` we wzorcu pokazuje na każdej stronie jej własny numer: jeden wzorzec, a na stronach 1, 2, 3…
- Strona może mieć kilka wzorców naraz, np. „Kratka” pod treścią i „Numer strony” na dole.

Kiedy wzorzec, a kiedy zwykły element? Jeśli coś ma być **na wielu stronach w tym samym miejscu** — wzorzec. Jeśli tylko na jednej stronie — zwykły element.

![Okno Wzorce stron: co to jest i gotowe wzorce](https://makietka.app/img/instrukcja/k-wzorce-galeria.png)

### 11.2 Gdzie są wzorce

- **Wzorce** pod listą stron (obok **Sekcja**) i na górnym pasku edytora — otwiera okno **Wzorce stron**.
- Menu ⋯ strony → **Wzorce tej strony…** — przechodzi na tę stronę i otwiera okno.
- Menu ⋯ sekcji → **Wzorce sekcji…**.
- Właściwości strony (nic nie jest zaznaczone) → część **Wzorce**: które wzorce są na tej stronie; dopóki projekt nie ma wzorców, jest tam przycisk **Wybierz gotowy wzorzec…**.
- Biblioteka → kategoria **Wzorce stron** — te same gotowe wzorce co w oknie.

Strona, na której leży wzorzec, ma na miniaturze mały fioletowy znak; podpowiedź na nim mówi, jakie to wzorce.

### 11.3 Gotowe wzorce

W oknie **Wzorce stron** niżej jest galeria gotowych wzorców z podglądami — na schemacie elementy wzorca są wyraźne, a blade bloki to treść strony. Grupy:

| Grupa | Przykłady |
|---|---|
| Numeracja | numer na dole, przy zewnętrznej krawędzi, „Strona 5 z 120”, w kółku, na pasku bocznym, rzymski |
| Nagłówki i stopki | nazwa sekcji, projekt i sekcja, kolorowy pas, stopka z kontaktem |
| Tła i papier | linie, kratka, kropki, papier milimetrowy, zeszyt z marginesem, kolorowe tło, znak wodny |
| Ramki | w marginesach, podwójna, zaokrąglona, obwódka strony, narożniki |
| Kalendarz i planer | zakładka na brzegu, nagłówek dnia, kolumna „Notatki”, tydzień |
| Książka | żywa pagina z tytułem rozdziału, numer i rozdział u góry |
| Katalog i oferta, Gazetka, Zaproszenie | logo i kontakt, winieta, szpalty, ozdobna ramka, pasy |

Kliknięcie karty dodaje wzorzec do projektu i **od razu na wszystkie strony sekcji** otwartej strony — okno się zamyka, a wzorzec widać na stronie. **Cofnij** w komunikacie albo `Ctrl`+`Z` odwraca to jednym krokiem. Gotowe wzorce dopasowują się do formatu i marginesów sekcji, a kolory i czcionki biorą z zestawu marki (rozdział „27.9 Zestaw marki”), jeśli go masz. Po dodaniu to zwykły wzorzec — możesz go zmienić.

### 11.4 Na których stronach jest wzorzec

W oknie, w części **W tym projekcie**, przy każdym wzorcu:

| Przycisk | Co robi |
|---|---|
| **+ Dodaj do tej strony** | Włącza wzorzec tylko na otwartej stronie. Ponowne kliknięcie (✓) go zdejmuje. |
| **+ Do całej sekcji** | Włącza wzorzec na stronach sekcji, które nie mają własnego wyboru. |
| **Edytuj** | Otwiera wzorzec do edycji (rozdział „11.5 Własny wzorzec i edycja”). |
| **⋯** | **Zmień nazwę**, **Duplikuj**, **Przesuń wyżej**, **Przesuń niżej**, **Usuń wzorzec**. |

Pojedynczej stronie wybierzesz wzorce też we właściwościach strony: **Wzorce na tej stronie** → **Jak w sekcji** albo **Własny wybór** i przełączniki przy nazwach.

![Okno Wzorce](https://makietka.app/img/instrukcja/okno-wzorcow.png)

### 11.5 Własny wzorzec i edycja

**Narysuj własny wzorzec** tworzy pusty wzorzec i od razu go otwiera. **Edytuj** otwiera istniejący. Fioletowy pasek nad stroną przypomina, że zmieniasz wzorzec — wszystko, co tu narysujesz, pojawi się na stronach z tym wzorcem; **Gotowe** wraca do stron. Na zwykłych stronach elementy wzorca widać na liście warstw, a kliknięcie tam otwiera wzorzec.

![Edycja wzorca](https://makietka.app/img/instrukcja/wzorce.png)

### 11.6 Nad treścią i odbicie lustrzane

Elementy wzorca leżą **pod** treścią strony. Zaznacz element we wzorcu i włącz:

- **Nad treścią strony** — element przykryje treść, np. ramka albo znak wodny,
- **Odbijaj lustrzanie na lewych stronach** — element przy prawej krawędzi (np. numer strony) na lewych stronach rozkładówek przejdzie na lewą krawędź. Gotowe wzorce „przy zewnętrznej krawędzi” mają to włączone.

### 11.7 Pola we wzorcu

Wpisz we wzorcu tekst z polem, np. `Strona {nr} z {liczba_stron}`, `{sekcja}` albo `{rozdzial}` (tytuł bieżącego rozdziału). Na każdej stronie pojawi się jej wartość. Najprościej zacząć od gotowego wzorca z numerem strony (rozdział „11.3 Gotowe wzorce”).

## 12. Linie pomocnicze, siatka i powiększenie

Rzeczy, które pomagają ustawiać elementy, a nie drukują się: marginesy, spad, siatka, prowadnice, powiększenie.

### 12.1 Linie na stronie

Linie pomocnicze nie są drukowane:

| Linia | Znaczenie |
|---|---|
| **Czerwona** | Krawędź strony po przycięciu. |
| **Różowy pas** | Spad. Tła i zdjęcia, które mają sięgać krawędzi, rozciągnij aż do jego końca. |
| **Niebieska przerywana** | Margines. Teksty trzymaj w środku. |
| **Gruba ciemna** | Grzbiet rozkładówki. |
| **Przerywane z podpisami** | Na okładce: zgięcia — grzbiet, bigi, zawinięcia (rozdział „10.6 Okładka z grzbietem”). |
| **Turkusowa** | Prowadnica (rozdział „12.4 Linijki i prowadnice”). |

Przycisk linii pomocniczych (`W`) przy powiększeniu chowa je wszystkie.

### 12.2 Ostrzeżenia

Element w marginesie albo poza spadem, tekst, który się nie mieści, czy pole z literówką dostają pomarańczową ramkę i trafiają na listę **Ostrzeżenia**. Na komputerze otwiera ją przycisk z trójkątem obok powiększenia (`F8`) — liczba na nim mówi, ile jest uwag; okienko nie blokuje pracy, zamyka je krzyżyk albo `Esc`. Na telefonie — przycisk **Ostrzeżenia** na dole ekranu. Kliknięcie pozycji zaznacza element. Gdy to celowe (np. tło na spad), kliknij **Wycisz**.

![Ostrzeżenia](https://makietka.app/img/instrukcja/ostrzezenia.png)

### 12.3 Siatka

W menu widoku (rozdział „3.6 Prawy dolny róg i menu widoku”): **Siatka** pokazuje linie co **Krok siatki** (w mm, od rogu strony), a **Przyciągaj do siatki** ustawia lewy górny róg przesuwanego elementu na linii siatki.

![Siatka i prowadnice](https://makietka.app/img/instrukcja/siatka.png)

### 12.4 Linijki i prowadnice

- **Linijki** pokazują milimetry; zero leży w rogu otwartej strony.
- **Prowadnicę** wyciągniesz z linijki: z górnej w dół — poziomą, z lewej w prawo — pionową. Prowadnicę można przesunąć; wyciągnięta poza stronę znika.
- We właściwościach strony część **Prowadnice** pozwala wpisać położenie liczbą i dodać prowadnicę pionową albo poziomą.
- **Zablokuj prowadnice** w menu widoku chroni je przed przypadkowym przesunięciem.

### 12.5 Przyciąganie i odległości

Przy przesuwaniu i zmianie rozmiaru element przyciąga się do krawędzi, marginesów i środka strony, do prowadnic i do innych elementów:

- **różowa linia** — krawędź albo środek zrównały się z innym elementem,
- **strzałki z liczbą** — odległość w mm do najbliższych elementów,
- **fioletowe liczby** — odstęp jest równy innemu odstępowi w rzędzie.

Przytrzymany `Ctrl` na chwilę wyłącza przyciąganie. Przytrzymany `Alt` przy zaznaczonym elemencie pokazuje też odległości do krawędzi strony.

![Równe odstępy](https://makietka.app/img/instrukcja/odleglosci.png)

### 12.6 Powiększenie

- **−** i **+** w prawym dolnym rogu; kliknięcie procentu dopasowuje stronę do okna (`Ctrl`+`0`).
- `Ctrl` + kółko myszy powiększa w miejscu kursora.
- Spacja + przeciąganie przesuwa widok.
- Na ekranie dotykowym — dwa palce (rozdział „28.1 Gesty”).

## 13. Książka: spis treści, pagina, przypisy, odsyłacze, skorowidz

Spis treści, tytuł rozdziału w stopce, przypisy, odsyłacze i skorowidz — liczą się same.

### 13.1 W skrócie

Numery stron biorą się z numeracji sekcji (rozdział „10.8 Numeracja stron”), także ze stronami powielonymi serią (rozdział „16 Serie”).

![Spis treści, przypis i żywa pagina na stronach książki](https://makietka.app/img/instrukcja/ksiazka.png)

### 13.2 Nagłówki

Nagłówki to teksty w stylach akapitu (rozdział „5.4 Style”), które projekt uznaje za tytuły rozdziałów. Z nich powstają spis treści, żywa pagina i lista odsyłaczy.

- Bez ustawień styl **Tytuł** to nagłówek 1 (rozdział), a **Nagłówek** – nagłówek 2.
- Inne style ustawisz w panelu spisu treści: przy każdym stylu wybierz **nagłówek 1**, **nagłówek 2**, **nagłówek 3** albo **nie jest nagłówkiem**.

> **Wskazówka:** nadaj ten sam styl wszystkim tytułom rozdziałów – wtedy spis treści i pagina ułożą się same.

### 13.3 Spis treści

1. Otwórz **Biblioteka** → **Książka** → **Spis treści** (albo `Ctrl`+`K` i „spis treści”).
2. Spis staje na stronie jako tekst i od razu wypełnia się nagłówkami z numerami stron.
3. Wygląd (czcionkę, rozmiar, interlinię) zmieniasz jak w każdym tekście.

![Spis treści i jego panel](https://makietka.app/img/instrukcja/k-spis-tresci.png)

| Ustawienie | Co robi |
|---|---|
| **Poziomy** | **tylko rozdziały**, **rozdziały i podrozdziały** albo **trzy poziomy**; niższe poziomy są wcięte. |
| **Kropki do numeru strony** | Wypełnia odstęp między tytułem a numerem kropkami. |
| **Styl „…”** | Który styl jest nagłówkiem i jakiego poziomu (rozdział „13.2 Nagłówki”). |
| **Odśwież teraz** | Układa spis od razu. Zwykle nie trzeba – spis odświeża się sam po każdej zmianie. |

Długi spis przelej do kolejnej ramki, także na następnej stronie (rozdział „5.7 Kolumny i tekst przez kilka ramek”). Treści spisu nie wpisuje się ręcznie – przy następnym odświeżeniu ułożyłaby się od nowa.

### 13.4 Żywa pagina

Żywa pagina to tytuł bieżącego rozdziału w stopce albo nagłówku strony.

1. Otwórz wzorzec stopki (rozdział „11 Wzorce stron”).
2. W tekście stopki wybierz **Wstaw pole** → **{rozdzial}**. Obok możesz dać numer strony: `{rozdzial} – {nr}`.

Na każdej stronie pole pokazuje ostatni nagłówek 1 do tej strony. `{rozdzial:2}` pokazuje nagłówek 2 – nowy rozdział go zeruje.

### 13.5 Przypisy dolne

1. Zaznacz tekst (albo pisz w nim – przypis stanie w miejscu kursora).
2. W panelu, w części **Przypisy, odsyłacze, skorowidz**, wybierz **Wstaw przypis** (albo `Ctrl`+`K` i „przypis”).
3. W polu **Przypis 1** wpisz treść.

![Przypis w panelu i na dole strony](https://makietka.app/img/instrukcja/k-przypisy.png)

- W tekście staje numer w indeksie górnym, a treść – na dole tej samej strony, nad dolnym marginesem, pod krótką kreską. W edytorze widać ją od razu, ale nie da się jej zaznaczyć: zmieniasz ją w panelu.
- Numery liczą się same. **Numeracja przypisów**: **Od nowa w każdej sekcji**, **Od nowa na każdej stronie** albo **W całym projekcie**.
- Tekst płynący przez kilka ramek zabiera przypis ze sobą: przypis jest na tej stronie, na której stoi jego numer.
- Wygląd przypisów: styl akapitu o nazwie **Przypis** (jeśli go nie ma – pismo 8 pt).
- **Usuń przypis** zdejmuje i numer z tekstu, i treść.

### 13.6 Odsyłacze

Odsyłacz to numer strony innego miejsca w książce, np. „zob. s. 12”.

1. Zaznacz tekst, w którym ma stać odsyłacz.
2. W części **Przypisy, odsyłacze, skorowidz** wybierz z listy **Wstaw odsyłacz do** nagłówek.
3. W tekście pojawi się „s. 12” – numer zmienia się sam, gdy strony się przesuną.

W edytorze odsyłacz widać jako pole `{s:…}`; liczbę zobaczysz w podglądzie i w PDF. Gdy nagłówek usuniesz, zamiast numeru stanie „?”, a **Sprawdź przed drukiem** o tym przypomni (rozdział „20 Sprawdź przed drukiem”).

### 13.7 Skorowidz

1. Zaznacz słowo w pisanym tekście.
2. Wybierz **Dodaj do skorowidza** (albo `Ctrl`+`K` i „skorowidz”). Bez zaznaczenia aplikacja zapyta o hasło.
3. Wstaw skorowidz: **Biblioteka** → **Książka** → **Skorowidz**.

Skorowidz ma hasła alfabetycznie (po polsku: ą po a, ł po l) z numerami wszystkich stron, na których słowo występuje w jakimkolwiek tekście – wielkość liter nie ma znaczenia, a kolejne strony łączą się w zakres (3–5). Hasła tekstu widać w panelu jako żetony; kliknięcie żetonu usuwa hasło.

## 14. Tabele danych

Dane trzymasz w tabelach projektu; z nich biorą się wartości pól i powielane strony.

### 14.1 Okno Dane

Tabela to arkusz: kolumny mają nazwy (np. `dzien`, `imie`), a wiersze — wartości. Z tabel biorą się wartości pól w tekście (rozdział „15 Pola w tekście”) i powielone strony (rozdział „16 Serie”).

Okno otwiera **Dane** na górnym pasku edytora. Z lewej jest lista tabel projektu, z prawej wybrana tabela. **+** dodaje pustą tabelę, **Importuj CSV albo Excel** — tabelę z pliku (rozdział „14.2 Import z Excela i CSV”), **Wiersz pomijany** — wiersz `**pomiń**` (rozdział „16.4 Wiersze pomijane”), a **Pobierz tabelę jako plik CSV** daje tabelę do dokończenia w arkuszu. Zmiany z jednego otwarcia okna cofniesz jednym **Cofnij**.

![Okno Dane](https://makietka.app/img/instrukcja/dane.png)

### 14.2 Import z Excela i CSV

**Importuj CSV albo Excel** wczytuje plik `.xlsx`, `.xls`, `.ods` albo `.csv`:

- pierwszy wiersz pliku to nazwy kolumn,
- z pliku Excela powstaje po jednej tabeli na każdy arkusz,
- separator (średnik, przecinek, tabulator) i polskie znaki aplikacja rozpoznaje sama,
- liczby i daty trafiają do tabeli tak, jak je widać w arkuszu. Datę najlepiej rozbić na osobne kolumny, np. `dzien`, `miesiac`, `rok`.

Poprawiłeś dane w arkuszu? Zaimportuj plik jeszcze raz. Gdy w projekcie jest tabela o tej samej nazwie, aplikacja zapyta, czy podmienić jej dane.

### 14.3 Poprawianie danych w aplikacji

- Kliknij komórkę i pisz. `Enter` przechodzi wiersz niżej, `Shift`+`Enter` robi nową linię w komórce.
- Dane skopiowane z Excela albo Arkuszy Google wklejasz od zaznaczonej komórki (`Ctrl`+`V`); tabela sama rośnie w dół i w prawo.
- **×** przy wierszu albo kolumnie usuwa go.
- Nazwę kolumny zmieniasz, klikając nagłówek. Aplikacja poprawi tę nazwę we wszystkich polach projektu.

### 14.4 Wygląd komórek

Pogrubienie, kursywa i kolor liter z pliku Excela przechodzą na strony: wartość wstawiona w pole dostaje wygląd swojej komórki — np. święta pogrubione na czerwono. Przechodzi też wygląd części tekstu w komórce.

W oknie Dane zaznacz komórkę (`Shift`+kliknięcie zaznacza prostokąt kilku komórek) i użyj: **B** — pogrubienie, **I** — kursywa, kolor liter, **Wyczyść wygląd** (gumka).

Przełącznik **Przenoś wygląd komórek na strony** wyłącza przenoszenie — wygląd zostaje zapisany w tabeli.

### 14.5 Pilnowanie wartości

Przy nazwie każdej kolumny są dwa znaki:

| Znak | Co robi |
|---|---|
| **≠** | Wartości w kolumnie nie powinny się powtarzać (np. hasła dnia). Powtórzone komórki są czerwone, a przed drukiem aplikacja poda strony, na których ta sama wartość wypada dwa razy. Wielkość liter i spacje nie mają znaczenia. |
| **☰** | Lista dozwolonych wartości, np. `praca; dom; wolne`. Inne wartości są podświetlone i trafiają na listę przed drukiem; w szablonie danych komórki dostają listę rozwijaną. **Usuń listę** ją usuwa. |

## 15. Pola w tekście

Pole to miejsce w tekście, w które wchodzi wartość z tabeli albo z projektu, np. numer strony.

### 15.1 Wstawianie pola

Pole to nazwa kolumny w klamrach, wpisana w zwykły tekst, np. `Imieniny: {imieniny}`. Na gotowej stronie w miejsce pola wchodzi wartość z tabeli.

Zaznacz tekst i wybierz kolumnę z listy **Wstaw pole** we właściwościach. Lista zaczyna się od kolumn tabeli tej strony, dalej są pola dokumentu (rozdział „15.2 Pola dokumentu”). Pole możesz też wpisać ręcznie.

![Wstaw pole](https://makietka.app/img/instrukcja/k-wstaw-pole.png)

W edytorze pola mają fioletowe tło, a pole, którego aplikacja nie zna (np. literówka) — czerwone. Prawdziwe wartości widać na miniaturach, w podglądzie i w PDF.

- Pola z tabeli działają na stronach serii z tą tabelą (rozdział „16 Serie”).
- Pole z tabeli dodatkowej wpisujesz z nazwą tabeli: `{Tygodnie.haslo}` (rozdział „16.5 Tabele dodatkowe”).
- Pogrubione pole da pogrubioną wartość.

![Pola w tekście](https://makietka.app/img/instrukcja/pola.png)

### 15.2 Pola dokumentu

Pola dokumentu wynikają z samego projektu i działają na każdej stronie, także we wzorcach:

| Pole | Znaczenie |
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
| `{poczatek}` | Numer pierwszej strony sekcji o podanej nazwie, np. {poczatek:Notatki} |
| `{koniec}` | Numer ostatniej strony sekcji o podanej nazwie, np. {koniec:Notatki} |
| `{nr_strony}` | Numer strony o podanej nazwie, np. {nr_strony:Styczeń} |
| `{rozdzial}` | Żywa pagina: tytuł bieżącego rozdziału – ostatni nagłówek poziomu 1 do tej strony; {rozdzial:2} – poziomu 2 |
| `{s}` | Odsyłacz: numer strony, na której stoi wskazany nagłówek albo element – wstawia „Wstaw odsyłacz” |
| `{przypis}` | Numer przypisu dolnego – wstawia „Wstaw przypis” |

| Zapis liczby | Znaczenie |
|---|---|
| `{nr}` | 1, 2, 3 |
| `{nr:00}` | 01, 02, 03 (tyle cyfr, ile zer) |
| `{nr:I}` | I, II, III |
| `{nr:i}` | i, ii, iii |
| `{nr:A}` | A, B, C |
| `{nr:a}` | a, b, c |

Gdy kolumna tabeli nazywa się tak samo jak pole dokumentu, na stronach tej tabeli wygrywa kolumna.

### 15.3 Zwykłe klamry

- Cały tekst bez pól: zaznacz tekst i włącz **Klamry { } to zwykły tekst, nie pola** (przełącznik pojawia się, gdy w tekście są klamry).
- Pole i klamry w jednym tekście: wpisz klamry podwójnie — `{{` i `}}` staną się pojedynczymi klamrami, np. `Dzień {dzien}, wzór {{x}}` da „Dzień 5, wzór {x}”.

## 16. Serie

Seria powiela stronę dla każdego wiersza tabeli — tak powstaje kalendarz na 365 dni z jednej strony.

### 16.1 Czym jest seria

Projektujesz jedną stronę dnia — dostajesz 365 stron, każdą z danymi swojego wiersza. Seria może obejmować kilka sąsiednich stron (**blok**), np. tydzień na rozkładówce: wtedy cały blok powiela się razem.

Powielone strony nie są zapisywane osobno — powstają na bieżąco, więc zmiana tabeli od razu zmienia publikację.

### 16.2 Nowa seria

1. Kliknij puste miejsce strony — właściwości pokażą ustawienia strony.
2. W polu **Seria** wybierz **+ Nowa seria…**.
3. Ustaw serię w oknie (rozdział „16.3 Ustawienia serii”) i kliknij **Zapisz**.
4. Kolejnym stronom bloku wybierz tę samą serię.

![Seria we właściwościach strony](https://makietka.app/img/instrukcja/k-seria.png)

Strony serii mają na liście stron fioletowy znaczek z liczbą powieleń, np. **×31**. **×0** znaczy, że wszystkie wiersze tej strony są pomijane.

![Strony powielone w podglądzie](https://makietka.app/img/instrukcja/serie.png)

### 16.3 Ustawienia serii

Okno serii otwiera się po wybraniu **+ Nowa seria…**, a dla istniejącej serii — przyciskiem **Ustawienia serii** we właściwościach strony. Pod polem **Seria** widać, ile stron wyjdzie w wydruku.

| Ustawienie | Znaczenie |
|---|---|
| **Nazwa serii** | Nazwa na liście serii. |
| **Dane z tabeli** | Tabela, z której biorą się wiersze. |
| **Ile razy powielić** | Przełącznik: **Tyle, ile wierszy tabeli** albo **Stałą liczbę razy** (wtedy pojawia się pole **Liczba powieleń**) — np. 12 miesięcy; dane idą wtedy w kółko. |
| **Jak czytać tabelę** | Przełącznik: **Wiersz na cały blok** (kolumny np. `s1_tytul`, `s2_tytul` dla kolejnych stron) albo **Wiersz na każdą stronę**. |
| **Dokończ ostatni blok stronami bez danych** | Seria kończy się na ostatnim wierszu; z tym ustawieniem ostatni blok jest pełny. |
| **Pilnuj lewej i prawej strony** | W rozkładówkach (rozdział „16.6 Serie w rozkładówkach”). |
| **Dodatkowe tabele** | Dane zmieniające się rzadziej niż strony (rozdział „16.5 Tabele dodatkowe”). |
| **Dane, których potrzebują strony** | Pola użyte na stronach bloku. **Dodaj brakujące kolumny do tabeli** dopisuje brakujące. |
| **Pobierz szablon danych (Excel)** | Plik z kolumnami, których potrzebują strony (rozdział „16.7 Szablon danych”). |

![Segmenty w oknie Serii](https://makietka.app/img/instrukcja/k-seria-segmenty.png)

### 16.4 Wiersze pomijane

Przykład: kalendarz z blokiem na tydzień (poniedziałek–niedziela), a rok zaczyna się w czwartek. Bez niczego 1 stycznia trafiłby na stronę poniedziałku. Dopisz więc na początku tabeli trzy **wiersze pomijane** — za poniedziałek, wtorek i środę.

Wiersz pomijany ma w pierwszej komórce znacznik `**pomiń**`. Zajmuje swoje miejsce w bloku, ale jego strona nie powstaje: nie ma jej w podglądzie, w PDF ani w numeracji. Wstawisz go przyciskiem **Wiersz pomijany** w oknie Dane — nad wierszem, w którym stoi kursor — albo wpiszesz `**pomiń**` w Excelu.

Koniec roku nie wymaga niczego: seria kończy się na ostatnim wierszu danych.

### 16.5 Tabele dodatkowe

Tabela dodatkowa daje dane, które zmieniają się rzadziej niż strony — np. hasło tygodnia na stronach dni albo obrazek miesiąca. W oknie serii: **Dodaj tabelę**, a potem **Nowy wiersz**:

- **co stałą liczbę stron** — np. co 7 stron dla tygodni,
- **gdy zmieni się kolumna „…”** — np. `miesiac`: nowy wiersz tam, gdzie w tabeli głównej zmienia się miesiąc. Kilka kolumn (np. miesiąc i rok) wybierzesz w kolejnych listach **albo kolumna**.

Pole z tabeli dodatkowej: `{Tygodnie.haslo}`. Gdy tabeli dodatkowej zabraknie wierszy, okno serii pokaże to na czerwono, a przed drukiem — na liście uwag.

### 16.6 Serie w rozkładówkach

**Pilnuj lewej i prawej strony – wstaw pustą stronę, gdy trzeba** sprawia, że strona zaprojektowana jako lewa zawsze wychodzi po lewej, a prawa po prawej. Gdy trzeba, aplikacja wstawia pustą białą stronę — np. za serią, gdy dane kończą się na lewej stronie. Pusta strona liczy się w numeracji, jak w drukowanych książkach. **Sprawdź przed drukiem** wypisuje, gdzie stoją puste strony.

### 16.7 Szablon danych

**Pobierz szablon danych (Excel)** daje plik z kolumnami dokładnie takimi, jakich wymagają strony, razem z danymi, które już są w tabeli. Arkusz „Instrukcja” opisuje każdą kolumnę. Kolumny z listą wartości, nazwami obrazów albo kadrem mają listy rozwijane. Wypełniony plik zaimportuj w oknie Dane.

## 17. Wygląd z danych

Kolor, położenie, obraz albo widoczność elementu mogą zmieniać się na każdej powielonej stronie.

### 17.1 Część Z danych

Element może zmieniać się razem z danymi na kolejnych powielonych stronach: kolor, miejsce, rozmiar, obrót, obraz albo widoczność. Zaznacz element i rozwiń część **Z danych** we właściwościach.

W edytorze element wygląda jak wzór (pozycja 1, kolor wzoru, zawsze widoczny). Właściwy wygląd każdej strony widać w podglądzie, na miniaturach i w PDF.

![Zakładka na brzegu: inne miejsce i kolor na każdej stronie](https://makietka.app/img/instrukcja/zakladki.png)

### 17.2 Kolor z pola

**Kolor z pola** — kolumna z kolorami, np. `#d1495b`, `2e86ab` albo nazwa po angielsku (`navy`). Pusta albo błędna wartość zostawia kolor wzoru. Linia i kształt bez wypełnienia dostają kolor obrysu. Przy wypełnieniu przejściem kolorów wybierasz, co zmienia kolor z pola: pierwszy kolor, ostatni kolor albo całe przejście w odcieniach.

### 17.3 Położenie, rozmiar i obrót z pola

| Ustawienie | Znaczenie |
|---|---|
| **Przesunięcie w poziomie z pola**, **Przesunięcie w pionie z pola** | Pole z liczbą — kolumna tabeli albo np. `{egzemplarz}` (numer powielenia). |
| **Wartość pola to** | **numer pozycji** — element przesuwa się o **Krok** (mm) za każdą pozycję; **Od nowa co** N wraca na początek. Albo **przesunięcie w mm** — liczba z tabeli wprost. |
| **Szerokość z pola**, **Wysokość z pola** | Wartość to **procent rozmiaru wzoru (100 = bez zmian)** albo **rozmiar w mm**. **Przy zmianie rozmiaru na miejscu zostaje** — który bok albo róg stoi w miejscu. |
| **Obrót z pola (stopnie)** | Kąt dodawany do obrotu wzoru, np. wskazówka na każdej stronie inaczej. |

Tak robi się zakładki na brzegu strony — na każdej stronie niżej — albo słupki o wysokości z tabeli.

### 17.4 Pokaż element

**Pokaż element**: **zawsze** albo tylko wtedy, gdy wybrane pole **nie jest puste**, **jest puste** albo **równa się** wpisanej wartości. Przykład: gwiazdka przy święcie — kolumna `swieto` i „nie jest puste”.

### 17.5 Obraz z danych

Wstaw dowolny obraz jako wzór — wyznacza miejsce i rozmiar. We właściwościach obrazu, w części **Obraz z danych**:

| Ustawienie | Znaczenie |
|---|---|
| **Kolumna z nazwą pliku** | W każdym wierszu nazwa pliku, np. `styczen.jpg`. Pliki wgrasz naraz w oknie Obrazy projektu (rozdział „7.5 Okno Obrazy projektu”). |
| **Podmieniony obraz** | **mieści się w ramce (cały widoczny)** — z wolnym miejscem po bokach albo u góry; **wypełnia ramkę (brzegi przycięte)** — bez pustych pasów. |
| **Zostaje część zdjęcia** | Przy wypełnianiu: środek, góra, dół, lewa albo prawa strona — np. „góra”, żeby nie ucinać głów na portretach. |
| **Kadr z kolumny** | **ten sam na każdej stronie** albo kolumna, w której dla każdego zdjęcia wpiszesz `góra`, `dół`, `lewa`, `prawa` albo `środek`. |

### 17.6 Tekst o różnej długości

Teksty z tabeli mają różną długość, a układ strony ma zostać ten sam. Ustaw ramce **Stałą wysokość** i włącz **Zmniejszaj tekst, gdy się nie mieści** (rozdział „5.6 Ramka tekstu”). **Sprawdź przed drukiem** poda strony, na których tekst mimo to się nie mieści.

![Ramka o stałej wysokości](https://makietka.app/img/instrukcja/ramka-tekstu.png)

## 18. Przykłady

Gotowe przepisy krok po kroku.

### 18.1 Kalendarz książkowy

Jedna strona na dzień, z dniem tygodnia, imieninami i świętami w kolorze.

1. Nowy projekt A5, układ **Rozkładówki** (rozdział „2.2 Nowy projekt”).
2. W oknie Dane zaimportuj tabelę **Dni** z kolumnami `dzien`, `miesiac`, `dzien_tygodnia`, `imieniny`, `swieto` — albo poproś o nią AI (polecenie niżej).
3. Na stronie wstaw teksty `{dzien}`, `{dzien_tygodnia}` i `Imieniny: {imieniny}` (rozdział „15.1 Wstawianie pola”).
4. Kliknij puste miejsce strony i w **Seria** utwórz serię z tabelą Dni (rozdział „16.2 Nowa seria”) — powstanie 365 stron.
5. Wstaw mały tekst `{swieto}` w kolorze czerwonym i ustaw **Pokaż element → nie jest puste** (rozdział „17.4 Pokaż element”).
6. Numer strony i stopkę dodaj jako wzorzec (rozdział „11.3 Gotowe wzorce”).
7. Sprawdź podgląd i wyeksportuj PDF (rozdział „19 Podgląd”, „21 Eksport do PDF i PNG”).

**Polecenie dla AI: tabela dni do kalendarza** — Skopiuj, podmień nazwę projektu i wklej do rozmowy z AI, które ma podłączoną Makietkę (rozdział „25 Praca z AI”).

```text
Korzystając z łącznika Makietka, w projekcie „<nazwa projektu>”:
1. Przeczytaj opis formatu (narzędzie opis_formatu) i przegląd projektu.
2. Zrób tabelę danych „Dni 2027” z kolumnami: data, dzien, miesiac, dzien_tygodnia, swieto, kolor (kolor liczby: czarny w dni zwykłe, czerwony #c0392b w niedziele i święta).
3. Wypełnij ją dla całego roku 2027 (polskie święta państwowe i kościelne w kolumnie swieto).
4. Zrób stronę-wzór dnia: duża liczba {dzien} z kolorem z pola „kolor”, pod nią {dzien_tygodnia} i {miesiac}, a niżej {swieto}. Ustaw serię „Dni” z tą tabelą.
5. Pokaż mi, ile stron powstanie, i uruchom kontrolę przed drukiem.
```

### 18.2 Planer z obrazkiem miesiąca

1. Strony dni zrób jak w kalendarzu (rozdział „18.1 Kalendarz książkowy”).
2. Dodaj tabelę **Miesiące** z kolumnami `miesiac` i `obraz` (nazwy plików), a zdjęcia wgraj w oknie Obrazy projektu (rozdział „7.5 Okno Obrazy projektu”).
3. W oknie serii dodaj ją jako tabelę dodatkową: **Nowy wiersz → gdy zmieni się kolumna „miesiac”** (rozdział „16.5 Tabele dodatkowe”).
4. Wstaw obraz na stronie i w **Kolumna z nazwą pliku** wybierz kolumnę `obraz` tabeli Miesiące (rozdział „17.5 Obraz z danych”).

### 18.3 Zaproszenia imienne

1. Projekt w formacie zaproszenia, np. 148 × 105 mm.
2. Tabela **Goście** z kolumną `imie` — np. wklejona z arkusza (rozdział „14.3 Poprawianie danych w aplikacji”).
3. Zaprojektuj zaproszenie i wpisz w tekście `Kochana {imie}!` albo `Drogi {imie}!`.
4. Seria z tabelą Goście — jedno zaproszenie na każdego gościa.
5. PDF **Do drukarni** z podziałem na pliki albo jednym plikiem (rozdział „21.1 Okno eksportu”).

## 19. Podgląd

Podgląd pokazuje całą publikację tak, jak wyjdzie z druku.

### 19.1 Otwieranie podglądu

Podgląd jest z danymi i powielonymi stronami, bez linii pomocniczych i bez możliwości przypadkowej zmiany. Otworzysz go przyciskiem **Podgląd** na górnym pasku edytora (`Shift`+`W`) albo z menu **⋯** na karcie projektu — wtedy podgląd otwiera się od razu, bez edytora.

![Podgląd na górnym pasku](https://makietka.app/img/instrukcja/k-podglad.png)

Strony idą po kolei, rozkładówki stoją obok siebie. Strony serii mają podpis, np. „3 z 31”. Kliknięcie strony otwiera ją w edytorze; **Edytor** albo `Esc` wraca do edycji.

![Podgląd](https://makietka.app/img/instrukcja/podglad.png)

### 19.2 Powiększanie

- **−** i **+** na pasku; kliknięcie procentu wraca do 100%, czyli całej rozkładówki w oknie.
- `Ctrl` + kółko myszy powiększa w miejscu kursora.
- Na telefonie i tablecie: szczypanie dwoma palcami, podwójne stuknięcie powiększa albo wraca.

### 19.3 Prezentacja

**Prezentacja** pokazuje jedną stronę albo rozkładówkę naraz, na całym ekranie. Strzałki i spacja przewracają strony, `Esc` albo **×** zamyka. Na telefonie przesunięcie palcem w bok przewraca stronę, w dół — zamyka prezentację.

### 19.4 Makieta 3D

**Makieta 3D** obok **Separacje** na pasku podglądu pokazuje projekt jako wydrukowaną rzecz — jak zdjęcie produktu w studiu: prawdziwe wymiary stron, grubość z papieru i liczby stron, światło z cieniem na stole albo ścianie. Można ją obracać i kartkować, zanim pójdzie do drukarni.

![Makieta 3D: otwarta książka w twardej oprawie](https://makietka.app/img/instrukcja/k-makieta.png)

| Rodzaj | Jak wygląda |
|---|---|
| **Książka – miękka oprawa** | Leży na stole. Okładka z sekcji okładki (rozdział „10.6 Okładka z grzbietem”): przód, grzbiet i tył, w rozmiarze środka; sztywna jak karton — zgina się tylko przy grzbiecie. Środek kartka po kartce, otwarte strony wygięte przy grzbiecie, krawędzie kartek widać z boku. Bez sekcji okładki okładką jest pierwsza strona. |
| **Książka – twarda oprawa** | Okładki z tektury wystają ok. 3 mm poza środek i mają lekki połysk. Grzbiet to cienka, zaokrąglona płyta odsunięta od bloku — od góry i dołu widać szczelinę, zaokrąglony grzbiet środka ze składkami i kapitałkę. Na wnętrzu tektury widać okleinę zawiniętą z zewnątrz, a na niej wyklejkę — 3 mm od krawędzi. Otwarta okładka leży obok bloku; wyklejka przechodzi z niej cienkim zgięciem na blok. |
| **Notes na spirali** | Oprawa Wire-O: przy każdym otworze dwa równoległe druty. Średnica pierścienia dobiera się z grubości bloku jak u producentów (od 1/4″ do 1¼″, skok 3:1 albo 2:1); blok grubszy niż ok. 28 mm dostaje największy pierścień i uwagę pod makietą. Notes leży na drucie. |
| **Kalendarz ścienny** | Wisi na ścianie; spirala Wire-O u góry ma pośrodku przerwę z półokrągłym wycięciem na wieszak. Przewrócona karta przechodzi na tył. |
| **Kalendarz biurkowy** | Stoi na biurku na stojaku z grubej tektury; karty przewracają się przez górę na drugą stronę. |
| **Pojedyncza kartka** | Ulotka, plakat, zaproszenie — leży na stole, przód i tył. |
| **Ulotka składana** | Z sekcji typu ulotka (rozdział „10.11 Sekcje specjalne: obwoluta, ulotka, kalendarze, wykrojniki, użytki”): złożona okładką do góry, rozkłada się panel po panelu (zwijana albo harmonijka), potem odwraca na stronę zewnętrzną. |
| **Koperta** | Z wykrojnika koperty: przód z adresem, tył z klapkami i spodem, na końcu otwarta klapa. |
| **Pudełko z wykrojnika** | Z wykrojnika pudełka: najpierw płaski arkusz z nadrukiem, potem ścianki, klapki i wieczko składają się w bryłę. |
| **Kalendarz trójdzielny** | Wisi na ścianie: plecy z główką, trzy bloczki kalendariów i czerwone okienko na środkowym. |

Gdy któraś sekcja środka ma inny format niż reszta (np. wyklejka A4 przy środku A5, bez ustawionego typu), makieta nie złoży jej poprawnie w książkę i powie to pod obrazem – **Ustaw typ sekcji…** otwiera ustawienia tej sekcji (rozdział „10.4 Ustawienia sekcji”).

Lista **Rodzaj** pokazuje tylko to, co pasuje do sekcji projektu: ulotka, koperta, pudełko i kalendarz trójdzielny — gdy projekt ma taką sekcję; książki, notes, kalendarze i kartka — gdy ma zwykłe strony. Gdy projekt ma sekcję **obwoluty**, książka w twardej oprawie pokazuje ją na okładce (przód, grzbiet i tył z obwoluty, skrzydełka zawinięte do środka); przełącznik **Pokaż obwolutę** chowa ją i odsłania okładkę.

Rodzaj dobiera się sam (z okładką — książka, kalendarz z nazwy albo z 12–14 kart, jedna strona — kartka); zmienisz go listą **Rodzaj**. Książkę i notes ustawisz listą **Ułożenie**: **Leży** albo **Stoi** — zamknięta stoi na dolnej krawędzi, otwarta rozkłada się w „V” jak na półce wystawowej. Wybór zostaje zapamiętany dla projektu.

Format środka to format większości stron projektu. Sekcje typu wyklejka (przednia albo tylna) nie są częścią środka: w książce przednia wyklejka leży na wewnętrznej stronie przedniej okładki i jako luźna kartka przed stroną 1, tylna — odwrotnie, tak jak po oprawie (arkusz A4 poziomo przy książce A5 dzieli się na dwie połowy). Twarda oprawa bez wyklejek w projekcie dostaje czystą wyklejkę. Inna strona dwa razy szersza od środka — np. rozkładówka na jednym arkuszu — też dzieli się na dwie strony.

- **Obracanie** — przeciągnij myszą albo palcem. Światło idzie razem z widokiem, a makieta nie daje się obrócić pod stół ani za ścianę.
- **Przybliżanie** — kółko myszy, dwa palce albo **−** i **+**; **Widok** wraca do widoku z przodu. Po przybliżeniu strony wczytują się jeszcze raz w wyższej rozdzielczości — z bliska są ostre.
- **Kartkowanie** — strzałki pod makietą, klawisze `←` `→` albo stuknięcie w prawą lub lewą połowę obrazu. Pod spodem widać, co jest otwarte, np. „Strony 2–3” albo „Karta 3 z 13”.
- **Pobierz obraz makiety** zapisuje obraz PNG w tym samym kadrze co na ekranie — np. do oferty albo wpisu w sieci. Rozmiar wybierasz w części **Eksport** (niżej). W ciemnym motywie tło studia jest ciemne.

Osoba z linkiem do podglądu (rozdział „23.1 Tworzenie linku”) też widzi makietę — w jednym wariancie, bez ustawień. Link idzie za zmianami sam: po zapisaniu ujęcia pokaże nowy wariant, a link utworzony wcześniej dostanie makietę przy najbliższym otwarciu projektu.

#### Gotowe ujęcia

Nad makietą jest rząd kafelków — jedno stuknięcie ustawia kamerę, ułożenie i kartki: **Przód**, **¾ (klasyczne)**, **Z góry (płasko)**, **Grzbiet**, **Stojąca**, **Rozkładówka z góry**, **Wachlarz kartek**, **Stos egzemplarzy**, **Przód i tył** (dwa egzemplarze obok siebie, drugi odwrócony) oraz **Na ścianie** dla kalendarzy ściennych (ściana z tynku, światło z okna). Widać tylko ujęcia, które pasują do rodzaju. Po wybraniu ujęcia możesz dalej obracać i przybliżać.

![Gotowe ujęcia: wachlarz kartek na drewnianym blacie](https://makietka.app/img/instrukcja/k-makieta-ujecia.png)

![Stos egzemplarzy na drewnie](https://makietka.app/img/instrukcja/k-makieta-stos.png)

#### Ujęcie i światło

Zwinięta część **Ujęcie i światło** pod makietą zbiera wszystkie ustawienia sceny (na telefonie tak samo):

| Grupa | Co ustawisz |
|---|---|
| **Kamera** | obrót, pochylenie, odległość i **obiektyw** — mały kąt to teleobiektyw (płasko, bez zniekształceń), duży — szeroki kąt z mocną perspektywą |
| **Książka** | kąt otwarcia (180° — płasko), uchylona okładka, wachlarz kartek i wybór rozkładówki z listy |
| **Światło** | kierunek (z lewej, z prawej, z góry, okno — nisko z boku), barwa (neutralna, ciepła, zimna), miękkość i siła cienia |
| **Podłoże i tło** | studyjny gradient, jednolity kolor, drewno, papier, beton, marmur, tkanina, tynk albo przezroczyste; kolor tła (przy fakturach zmienia ich odcień) |
| **Egzemplarze** | jeden, dwa albo trzy obok siebie, stos 3 albo 5, przód i tył |
| **Materiały** | wykończenie okładki (jak w projekcie, mat, błysk, soft-touch), papier biały albo kremowy, kolor spirali i stojaka; **złocenia i lakier z projektu w świetle** — elementy z wykończeniem druku (rozdział „22.2 Wykończenie druku: lakier, złocenie, tłoczenie, biel”) błyszczą jak folia i lakier, gdy obracasz makietę |

**Przywróć domyślne** wraca do ustawień startowych. Światło i tło zostają zapamiętane dla projektu na tym urządzeniu.

![Ujęcie i światło: kamera, książka, światło, tło, egzemplarze, materiały](https://makietka.app/img/instrukcja/k-makieta-swiatlo.png)

#### Eksport i animacja

W części **Eksport** wybierasz rozmiar obrazu: **Internet** (dłuższy bok 1600 px), **Druk** (4000 px), **Instagram** (kwadrat 1080 × 1080) albo **Własny**, oraz **Przezroczyste tło** — zostaje sam przedmiot z cieniem, gotowy do wklejenia na stronę albo do prezentacji.

**Nagraj animację** robi krótki film: **Obrót dookoła** albo **Kartkowanie** (od bieżącej strony), jako **wideo** (MP4, gdy przeglądarka to umie, inaczej WebM) albo **GIF**. Pasek postępu pokazuje klatki; **Anuluj** przerywa nagrywanie.

#### Zapisane ujęcia

W części **Zapisane ujęcia** wpisz nazwę i stuknij **Zapisz ujęcie** — rodzaj, kamera, światło, tło, egzemplarze i położenie kartek zapisują się w projekcie (także na innych urządzeniach i u osób, z którymi pracujesz; zapis ma krok cofania). Stuknięcie nazwy na liście przywraca ujęcie, kosz je usuwa.

![Makiety sekcji specjalnych: ulotka w trakcie rozkładania i złożone pudełko](https://makietka.app/img/instrukcja/k-makieta-specjalne.png)

![Makieta 3D: kalendarz ścienny](https://makietka.app/img/instrukcja/k-makieta-kalendarz.png)

> **Wskazówka:** makieta pokazuje kształt i grubość publikacji z papieru i liczby stron (rozdział „10.6 Okładka z grzbietem”) — to podgląd, nie próbny wydruk. Kolory sprawdzisz w **Separacje** (rozdział „22.6 Podgląd separacji”).

### 19.5 Podgląd na żywo

Otwarty podgląd odświeża się sam, gdy projekt zmieni się gdzie indziej — na innym urządzeniu, u współpracownika albo przez AI. Zostaje w tym samym miejscu i powiększeniu; przerysowują się tylko zmienione strony.

## 20. Sprawdź przed drukiem

Lista miejsc do sprawdzenia, zanim wyślesz plik do drukarni.

### 20.1 Lista uwag

**⋯** → **Sprawdź przed drukiem** przegląda cały projekt — także każdą powieloną stronę.

![Sprawdź przed drukiem w menu ⋯](https://makietka.app/img/instrukcja/k-menu-kontrola.png)

| Uwaga | Co znaczy |
|---|---|
| **Tekst nie mieści się w ramce** | Na podanych stronach tekst wystaje z ramki o stałej wysokości — np. przy dłuższej wartości z tabeli. |
| **Pole bez wartości** | Pole z literówką albo z usuniętej kolumny. |
| **Brak pliku obrazu** | W tabeli jest nazwa obrazu, którego nie wgrano. |
| **Powtórzenia** | Ta sama wartość w kolumnie z **≠**, z numerami stron. |
| **Wartości spoza listy** | Wartości spoza listy kolumny z **☰**, z numerami wierszy. |
| **Brak danych** | Tabeli dodatkowej zabrakło wierszy przed końcem serii. |
| **Strony serii w rozkładówkach** | Gdzie stoją puste strony albo od której strony blok wychodzi po przeciwnej stronie. |
| **Tabela wychodzi poza stronę** | Wiersze urosły razem z treścią i tabela wyszła poza kartkę. |
| **Niepełna składka** | Sekcji brakuje stron do pełnej składki (rozdział „10.7 Składki”); przy oprawie zeszytowej — liczba stron niepodzielna przez 4. |
| **Pokrycie farbą** | Kolor elementu po przeliczeniu profilem drukarni daje ponad 300% farby — po otwarciu podglądu separacji z profilem albo eksporcie PDF/X-4 (rozdział „22.6 Podgląd separacji”). |
| **Element w marginesie albo poza spadem** | Jak na liście ostrzeżeń w edytorze (rozdział „12.2 Ostrzeżenia”). |

**Pokaż** przy uwadze otwiera podgląd na pierwszej stronie, której uwaga dotyczy, z wyróżnioną kartką. **Otwórz wzór** otwiera w edytorze stronę-wzór. Uwagi nie blokują eksportu — ta sama lista jest na dole okna eksportu PDF.

![Lista uwag](https://makietka.app/img/instrukcja/kontrola.png)

## 21. Eksport do PDF i PNG

Plik dla drukarni, do oglądania na ekranie albo do wydruku w domu. Plik może też zlecić asystent AI (rozdział „25.5 Plik PDF przez AI”).

### 21.1 Okno eksportu

Wybierz **⋯** → **Eksportuj do PDF…**.

![Eksportuj do PDF w menu ⋯](https://makietka.app/img/instrukcja/k-menu-pdf.png)

| Ustawienie | Znaczenie |
|---|---|
| **Rodzaj pliku** | **Wektorowy – ostry tekst i kształty**: tekst z osadzonymi czcionkami, ostry w każdym powiększeniu, da się go zaznaczyć. **Obrazy stron – strona jako zdjęcie**: każda strona to jeden obraz; wygląda wszędzie tak samo, ale plik jest większy. |
| **Zakres** | **Cały projekt**, **Tylko bieżąca sekcja** albo **Strony od–do** (numery w całym wydruku). |
| **Przeznaczenie** | **Do drukarni – ze spadem i znakami cięcia** albo **Do oglądania – równo do formatu**. Znaki cięcia dostają sekcje, które mają je włączone (rozdział „10.4 Ustawienia sekcji”). |
| **Układ arkuszy** | **Zwykłe strony** albo strony ułożone na arkuszach do samodzielnego druku (rozdział „21.6 Broszura i kilka stron na arkuszu”). |
| **Jakość** | Rozdzielczość zdjęć: 300 dpi — standard do druku, 150 dpi — mały plik na próbę, 600 dpi — bardzo ostro. |

Na dole okna jest lista **Do sprawdzenia przed drukiem** (rozdział „20 Sprawdź przed drukiem”). **Eksportuj** zapisuje plik; długi eksport przerwiesz przyciskiem **Anuluj** na karcie postępu.

![Okno eksportu](https://makietka.app/img/instrukcja/pdf.png)

### 21.2 Zaawansowane

Część **Zaawansowane**:

| Ustawienie | Znaczenie |
|---|---|
| **Zamień tekst na krzywe (bez czcionek w pliku)** | Litery stają się kształtami. Tego wymagają niektóre drukarnie; tekstu nie da się potem zaznaczyć. |
| **Kolory tekstu i kształtów w CMYK (czarny jako sama czerń)** | Kolory zapisane czterema farbami drukarskimi; czarny tekst idzie samą czarną farbą, więc jest ostry. |
| **Standard dla drukarni** | **Bez standardu – zwykły PDF**, **PDF/X-4 – papier powlekany (FOGRA39)**, **PDF/X-4 – papier niepowlekany (FOGRA47)** albo **PDF/X-4 – profil od drukarni (plik .icc)** — **Wybierz plik profilu…**. |
| **Zdjęcia też w CMYK (większy plik)** | Przy PDF/X-4: zdjęcia przeliczone na farby drukarskie przez ten sam profil. |
| **Podział na pliki** | **Jeden plik**, **Osobny plik dla każdej sekcji** albo **Części po tyle stron** (**Stron w części**). Kilka plików dostajesz w archiwum ZIP. |
| **Dołącz pliki czcionek użytych w projekcie** | Do pobrania trafia ZIP z plikiem PDF i folderem `czcionki`. |
| **PDF do czytania na ekranie: zakładki i klikalne linki** | Zakładki i linki dla czytających na ekranie (rozdział „21.7 PDF do czytania na ekranie”). Domyślnie włączone; przy PDF/X-4 i układzie arkuszy niedostępne. |
| **Uszlachetnienia** | Gdy projekt je ma: **Osobne płyty w tym samym pliku PDF**, **Osobny plik PDF na każde uszlachetnienie** albo **Pomiń uszlachetnienia** (rozdział „22.4 Uszlachetnienia w pliku PDF”). |

### 21.3 Jak wybrać ustawienia dla drukarni

Zapytaj drukarnię, czego wymaga:

- mówi „PDF/X-4” — wybierz ten standard i papier, na którym będzie drukować,
- mówi „wszystko w CMYK” — zaznacz też oba pola CMYK,
- mówi „bez czcionek” albo „krzywe” — zaznacz **Zamień tekst na krzywe**,
- nic nie wymaga — **Wektorowy**, **Do drukarni**, 300 dpi.

> **Wskazówka:** Plik z projektu w kolorach ekranu wygląda w druku nieco inaczej. Najpewniej zamówić wydruk próbny.

### 21.4 Czego nie da się zapisać wektorowo

Element z cieniem, element przycięty maską i rysunek SVG z filtrem trafiają do pliku jako obraz tego jednego elementu — reszta strony zostaje wektorowa. Tekst w czcionce, której nie da się osadzić, trafia do pliku jako krzywe. Po eksporcie aplikacja mówi, jeśli coś takiego się zdarzyło.

### 21.5 Strona jako PNG

**⋯** → **Pobierz bieżącą stronę jako PNG** zapisuje obraz otwartej strony w 300 dpi, ze spadem — np. do pokazania komuś w wiadomości.

### 21.6 Broszura i kilka stron na arkuszu

**Układ arkuszy** w oknie eksportu kładzie strony na arkuszach — do druku na zwykłej drukarce albo w małej drukarni:

| Układ | Co robi |
|---|---|
| **Broszura do składania (zeszyt)** | Strony parami, tak żeby po wydrukowaniu dwustronnym i złożeniu arkuszy na pół wyszedł zeszyt. Liczba stron dopełnia się pustymi do wielokrotności 4. |
| **Broszura ze składek** | To samo, ale osobno dla każdej składki po **Składka (stron)** — 4, 8, 16 albo 32 (domyślnie jak w ustawieniach sekcji, rozdział „10.7 Składki”). Składki zszywa się albo klei razem. |
| **2 strony na arkuszu**, **4 strony na arkuszu** | Kolejne strony obok siebie — np. ulotki A6 po cztery na A4. |

**Arkusz**: **Dopasowany do stron** (dwie strony A5 → arkusz 296 × 210 mm) albo **A4** / **A3** — strony stoją pośrodku i zmniejszają się, jeśli się nie mieszczą. **Pełzanie (mm)**: w grubszej broszurze środkowe kartki po złożeniu wystają; strony na nich przesuwają się o część tej wartości w stronę grzbietu (np. 0,5–1 mm przy 40 stronach).

![Broszura: plan arkuszy w oknie eksportu](https://makietka.app/img/instrukcja/k-pdf-arkusze.png)

Przy **Do drukarni** arkusze mają znaki cięcia, a broszura — przerywane znaki złamu. Strony na arkuszach stoją równo do formatu, bez spadu.

> **Wskazówka:** Broszurę na domowej drukarce łatwiej wydrukować przez **Drukuj w domu…** (rozdział „21.8 Drukuj w domu”).

### 21.7 PDF do czytania na ekranie

Zwykły plik PDF ma od razu nawigację dla czytających na ekranie:

- **zakładki** w bocznym panelu czytnika — sekcje projektu, a pod nimi nagłówki (style nagłówków książki, rozdział „13 Książka: spis treści, pagina, przypisy, odsyłacze, skorowidz”),
- **klikalny spis treści** — wiersz spisu prowadzi do strony,
- **odsyłacze** „s. 12” prowadzą do tej strony,
- **link elementu** — w panelu elementu, w części **Inne**, pole **Link w PDF (adres strony, e-mail)**: kliknięcie elementu w PDF otwiera adres; kod QR z adresem strony jest klikalny sam.

Linki są w pliku wektorowym; zakładki — w obu rodzajach pliku. W PDF/X-4 dla drukarni nawigacji nie ma.

### 21.8 Drukuj w domu

Wydruk na zwykłej drukarce: **⋯** → **Drukuj w domu…** albo `Ctrl`+`P` w edytorze i podglądzie. Okno samo układa strony na kartkach — nie drukuj projektu z menu przeglądarki.

![Okno Drukuj w domu](https://makietka.app/img/instrukcja/k-druk.png)

| Ustawienie | Co znaczy |
|---|---|
| **Co wydrukować** | **Zwykły wydruk** (strona na kartce), **Broszura do złożenia** (kartki składane na pół i zszywane w środku – kolejność stron układa się sama), **2** albo **4 strony na kartce**. |
| **Papier** | A4, A3 albo Letter – kartka obraca się sama. |
| **Rozmiar stron** | **Rzeczywisty** (strony zmniejszone tylko, gdy się nie mieszczą) albo **Dopasuj do kartki**. |
| **Strony** | Wszystkie, od–do albo tylko bieżąca. |
| **W odcieniach szarości** | Wydruk czarno-biały. |
| **Znaki cięcia i złamu** | Przy broszurze, którą przytniesz po zszyciu. |

Pod ustawieniami widać, jak strony ułożą się na kartkach. **Drukuj** otwiera okno drukowania z gotowym plikiem (na telefonie plik otwiera się w nowej karcie — wybierz tam **Udostępnij → Drukuj**), a **Pobierz PDF do druku** zapisuje ten sam plik.

Okno drukowania przeglądarki potrafi po swojemu zmienić skalę, dodać marginesy albo nagłówek z datą i adresem. Makietka drukuje gotowy plik PDF, a nie samą stronę, więc nagłówków i stopek w nim nie ma; skala 100% i druk dwustronny są zapisane w pliku. Nie każda przeglądarka słucha tych ustawień, dlatego okno pokazuje, co sprawdzić w oknie drukarki:

| W oknie drukarki | Ustaw |
|---|---|
| **Skala** | **100% / Rzeczywisty rozmiar** — nie „Dopasuj” ani „Zmniejsz do strony”. |
| **Marginesy** | Domyślne. Plik ma już marginesy, a strony są ułożone na kartce. |
| **Nagłówki i stopki** | Wyłączone. Jeśli w podglądzie widać datę i adres, odznacz tę opcję. |

Drukarka nie zadrukuje kilku milimetrów przy brzegu kartki. Strona o rozmiarze kartki jest więc lekko zmniejszona, tak żeby zostało 5 mm marginesu; okno pisze, o ile.

> **Wskazówka:** Najpewniejszy wydruk: **Pobierz PDF do druku** i drukuj z programu do plików PDF. Za pierwszym razem wydrukuj **stronę próbną**: linijka 100 mm ma mieć dokładnie 100 mm, a ramki 3, 5 i 10 mm pokazują, ile przy brzegu zostawia Twoja drukarka.

1. Najpierw wydrukuj jedną kartkę na próbę.
2. Sprawdź w oknie drukarki skalę **Rzeczywisty rozmiar / 100%**.
3. Broszurę drukuj dwustronnie, **obracanie po krótszej krawędzi**; bez druku dwustronnego — najpierw strony nieparzyste, potem włóż stos z powrotem i wydrukuj parzyste.
4. Złóż kartki na pół (pierwsza na wierzchu) i zszyj w zgięciu.

## 22. Kolory projektu, farby i wykończenia

### 22.1 Kolory dodatkowe

Druk to nie tylko cztery farby CMYK. Makietka zna kolory dodatkowe (np. Pantone), wykończenia — lakier, złocenie, tłoczenie, biel — i druk tylko czarną farbą albo czarną z jednym kolorem. Wszystko trafia do pliku PDF tak, jak oczekuje drukarnia: każda farba na osobnej płycie.

Kolor dodatkowy to osobna, gotowa farba — dokładnie w tym odcieniu, którego potrzebujesz (np. kolor logo). Najprościej dodać go przy elemencie:

1. Zaznacz element i otwórz jego kolor (np. **Kolor wypełnienia**).
2. Na dole wyboru koloru: **Zrób z tego koloru kolor dodatkowy…**.
3. Wpisz nazwę farby dokładnie jak w drukarni albo we wzorniku, np. „PANTONE 186 C”, i **Dodaj**.

To samo zrobisz we Właściwościach → **Wykończenie druku** → **Farba specjalna** → **Nowa z obecnego koloru…**. Dodany kolor wybierasz potem w każdym polu koloru — wypełnienie, obrys, tekst, fragment tekstu — w części **Kolory dodatkowe**, razem z **Odcieniem** (np. 40%).

![Kolor dodatkowy w wyborze koloru](https://makietka.app/img/instrukcja/k-kolor-dodatkowy.png)

Listę kolorów dodatkowych masz w **⋯** → **Kolory projektu…**: tam zmienisz nazwę, wpiszesz **C**, **M**, **Y**, **K** (to tylko podgląd na ekranie — drukarnia użyje swojej farby) albo usuniesz kolor. Zmiana CMYK koloru dodatkowego zmienia wszystkie elementy w tym kolorze. Usunięcie koloru zostawia elementy w zwykłym kolorze CMYK.

### 22.2 Wykończenie druku: lakier, złocenie, tłoczenie, biel

Wykończenie ustawiasz przy elemencie — nic nie trzeba wcześniej dodawać. Zaznacz element → Właściwości → **Wykończenie druku** i stuknij efekt:

| Efekt | Co to jest | Płyta w PDF |
|---|---|---|
| **Lakier** | Błyszczący lakier tylko w tym miejscu, np. tytuł na matowej okładce. | Spot_UV |
| **Złocenie** | Metaliczna folia; **Kolor folii**: złoto, srebro albo miedź. | Foil_Gold, Foil_Silver, Foil_Copper |
| **Tłoczenie** | Wypukły wzór wyciśnięty w papierze. | Emboss |
| **Wytłoczenie** | Wklęsły wzór wciśnięty w papier. | Debossing |
| **Biel** | Biała farba pod spodem — na kolorowym, kraftowym albo przezroczystym podłożu. | White |

![Wykończenie druku w panelu elementu](https://makietka.app/img/instrukcja/k-uszlachetnienie.png)

Nad kafelkami wybierasz, **jak** dodać efekt:

- **Kolor + efekt** — element drukuje się w swoich kolorach, a efekt idzie na jego kopię dokładnie nad nim. Tak zrobisz lakier na zdjęciu albo kolorowy napis ze złoceniem. Dla zdjęć to ustawienie domyślne.
- **Sam efekt** — element nie drukuje się żadną farbą, jest tylko efektem, np. napis samym złotem. Dla kształtów i tekstu to ustawienie domyślne.

W tej samej części jest **Farba specjalna** — wypełnienie elementu kolorem dodatkowym (rozdział „22.1 Kolory dodatkowe”).

> **Wskazówka:** Wykończenie na bardzo drobnym tekście (poniżej 6 pt) i cienkich liniach (poniżej 0,3 mm) może się nie odwzorować. **Sprawdź przed drukiem** o tym przypomni (rozdział „20 Sprawdź przed drukiem”).

### 22.3 Widok uszlachetnień

W edytorze i podglądzie uszlachetnienie widać jako efekt: połysk lakieru, metaliczną folię, cień tłoczenia, biel na szachownicy. Menu widoku → **Pokaż uszlachetnienia** wyłącza efekt (rozdział „3.6 Prawy dolny róg i menu widoku”).

### 22.4 Uszlachetnienia w pliku PDF

W pliku wektorowym każde uszlachetnienie to osobna płyta z **nadrukiem** — nie wybija farby pod spodem. W oknie eksportu, w części **Zaawansowane**, wybierz **Uszlachetnienia**:

- **Osobne płyty w tym samym pliku PDF** — najczęstsze,
- **Osobny plik PDF na każde uszlachetnienie** — główny plik bez uszlachetnień i osobny plik każdej płyty, w jednym ZIP,
- **Pomiń uszlachetnienia**.

Plik z obrazów stron nie ma osobnych płyt — wybierz plik wektorowy.

### 22.5 Kolory projektu i druk kolorów — dla całości albo dla sekcji

**⋯** → **Kolory projektu…** zbiera w jednym oknie wszystko o kolorach. Na górze, w polu **Dotyczy**, wybierasz **Cały projekt** albo jedną sekcję — np. okładka w pełnym kolorze, a środek czarno-biały.

![Okno „Kolory projektu” dla sekcji „Środek”](https://makietka.app/img/instrukcja/k-kolory-druku.png)

**Kolory w projekcie** (albo **w sekcji**) to kolory, których używasz, z liczbą użyć. Stuknij kolor i wybierz nowy — zmieni się wszędzie w tym zakresie: dla całego projektu na stronach, we wzorcach i w stylach, dla sekcji tylko na jej stronach. Zmianę cofniesz zwykłym **Cofnij**.

**Druk kolorów** mówi, jakimi farbami pójdzie druk:

| Tryb | Kiedy |
|---|---|
| **Pełny kolor** | Zwykły druk CMYK (domyślnie). |
| **Skala szarości** | Druk jedną czarną farbą — kolory i zdjęcia idą odcieniami czerni. |
| **Cz/b + 1 kolor** | Czerń i jeden kolor dodatkowy, np. kalendarz z czerwonymi niedzielami. **Kolor dodatkowy trybu** wybierasz pod spodem. |
| **Jak w projekcie** | Tylko dla sekcji: sekcja drukuje się tak jak cały projekt (domyślnie). |

W PDF każda strona idzie w trybie swojej sekcji. W wyborze koloru na stronie takiej sekcji zostają odcienie czerni i kolor trybu, a kolory sekcji widać osobno — **W tej sekcji**. Kolory spoza trybu okno pokaże — **Zamień na najbliższe dozwolone** zamieni je na czerń albo kolor trybu. To samo zrobi przycisk w **Sprawdź przed drukiem**.

Na dole okna, w części **Wykończenia druku**, widać, jakie efekty są w projekcie i na ilu elementach.

> **Wskazówka:** Rozszerzony CMYK (CMYK z dodatkowymi farbami, np. pomarańczową, zieloną i fioletową) robi drukarnia sama z Twojego pliku — nie trzeba osobnej palety.

### 22.6 Podgląd separacji

W podglądzie projektu **Separacje** pokazuje stronę rozbitą na płyty, którymi wydrukuje ją drukarnia: **Cyjan**, **Magenta**, **Żółty**, **Czarny**, kolory dodatkowe i uszlachetnienia.

![Podgląd separacji: kolor dodatkowy i lakier UV z nadrukiem](https://makietka.app/img/instrukcja/separacje.png)

1. Strzałkami nad obrazem przechodzisz między stronami.
2. Odznacz płytę, żeby zobaczyć stronę bez niej; zostaw jedną i zaznacz **Jedna płyta w szarości** — zobaczysz samą farbę tej płyty (czarne = 100%).
3. **Pokaż nadruk uszlachetnień** — uszlachetnienia jako kreskowana nakładka nad farbą (drukują się z nadrukiem, nie wybijają farby pod spodem).
4. **Zaznacz pokrycie farbą ponad** **Limit pokrycia (%)** — miejsca, gdzie suma farb przekracza limit (zwykle 300% dla papieru powlekanego), robią się czerwone. Pod spodem jest największe pokrycie na stronie.

**Przeliczanie na CMYK**: **Proste** — tak jak plik wektorowy w CMYK bez profilu (czerń i szarości samą czernią; nie przekracza 300%); **Papier powlekany (FOGRA39)** albo **Papier niepowlekany (FOGRA47)** — tak, jak przeliczy profil drukarni. Po przeliczeniu profilem **Sprawdź przed drukiem** wskaże też kolory elementów z pokryciem farbą powyżej 300% (rozdział „20 Sprawdź przed drukiem”).

## 23. Udostępnianie linkiem

Link do podglądu dla osób bez konta — klienta, rodziny, drukarni.

### 23.1 Tworzenie linku

Osoba z linkiem widzi strony tak jak w podglądzie; nie może niczego zmienić i nie widzi innych Twoich projektów. Może też otworzyć **Makieta 3D** (rozdział „19.4 Makieta 3D”): obracać ją, kartkować i pobrać obraz — w jednym wariancie, takim jak Twój (pierwsze zapisane ujęcie, a bez ujęć — rodzaj, ułożenie i światło z Twojej makiety), bez ustawień i bez zmiany rodzaju. Makieta aktualizuje się w linku sama, także w linkach utworzonych przed jej dodaniem.

1. W podglądzie kliknij **Udostępnij**.
2. **Utwórz link** — aplikacja przygotuje obrazy wszystkich stron; przy dużym projekcie chwilę to potrwa.
3. Skopiuj link i wyślij go.

![Udostępnij w podglądzie](https://makietka.app/img/instrukcja/k-udostepnij.png)
![Okno Udostępnij podgląd](https://makietka.app/img/instrukcja/udostepnianie.png)

Projekt z linkiem ma na liście projektów plakietkę **Udostępniony** — kliknięcie otwiera to samo okno.

### 23.2 Aktualizacja

Link aktualizuje się sam: kilka sekund po Twoich zmianach aplikacja wysyła obrazy stron, które się zmieniły. Adres zostaje ten sam. **Aktualizuj teraz** robi to od razu. Osoba, która ma link otwarty, nie musi odświeżać strony — nowe strony pojawią się same.

Obrazy stron przygotowuje aplikacja, więc link nadąża za zmianami, gdy projekt jest otwarty — w edytorze albo w podglądzie, na dowolnym urządzeniu.

### 23.3 Ochrona linku

Część **Ochrona linku**:

| Ustawienie | Znaczenie |
|---|---|
| **Hasło – bez niego podglądu nie zobaczy nikt** | Osoba z linkiem najpierw wpisuje **Hasło do linku**. Po 10 błędnych próbach link na kwadrans przestaje przyjmować hasła. |
| **Ważny do wybranego dnia** | Po **Ostatnim dniu ważności** link przestaje działać. |

Ochronę możesz ustawić przy tworzeniu linku albo w każdej chwili później: zmienić hasło, przesunąć datę ważności, dodać ochronę do zwykłego linku albo ją zdjąć. Adres linku się nie zmienia. To samo okno otworzysz też z listy projektów, klikając plakietkę linku na karcie projektu.

**Zapisz ochronę** zapisuje ustawienia. Puste pole hasła przy zaznaczonym haśle zostawia dotychczasowe; odznaczenie obu pól zdejmuje ochronę. Sama zmiana daty działa od razu. Nowe hasło, włączenie albo zdjęcie ochrony przygotowuje strony linku od nowa — chwilę to potrwa, także z listy projektów (projekt się nie otwiera).

### 23.4 Znak wodny

Część **Znak wodny** w oknie Udostępnij: zaznacz **Napis ukośnie na każdej stronie linku**, wpisz **Tekst znaku wodnego** (puste pole — „PODGLĄD”) i kliknij **Zapisz znak wodny**. Napis jest wtopiony w obrazy stron linku, także w makiecie 3D oglądającego, więc nie da się go wyłączyć po stronie oglądającego. Zapis przygotowuje strony linku od nowa; odznaczenie i zapis usuwa znak. Znak wodny działa też z listy projektów i nie zmienia wydruku ani pliku PDF.

### 23.5 Unieważnienie linku

**Unieważnij link** usuwa udostępnione strony — stary adres od razu przestaje działać. Ponowne udostępnienie daje nowy adres.

> **Uwaga:** Link jest długi i losowy, więc nie da się go zgadnąć, ale każdy, kto go dostanie, może go przekazać dalej. Do poufnych projektów ustaw hasło.

## 24. Współpraca

Wspólna praca nad projektem: zaproszenia, role i komentarze.

### 24.1 Zapraszanie

Każda osoba pracuje na swoim koncie, a zmiany widać u wszystkich na żywo. Wybierz **⋯** → **Współpraca…** w edytorze albo na karcie projektu.

![Współpraca w menu ⋯](https://makietka.app/img/instrukcja/k-menu-wspolpraca.png)

W części **Zaproś osobę**:

1. W polu **E-mail albo nazwa użytkownika** wpisz adres albo nazwę — po dwóch literach pojawią się pasujące nazwy użytkowników.
2. Wybierz **Rolę** (rozdział „24.2 Role”).
3. Kliknij **Zaproś**.

Aplikacja wysyła e-mail z linkiem do zaproszenia. Link możesz też skopiować i wysłać sam. Przy zaproszeniu po nazwie nie widzisz adresu e-mail tej osoby.

![Okno Współpraca](https://makietka.app/img/instrukcja/wspolpraca.png)

### 24.2 Role

| Rola | Co może |
|---|---|
| **może edytować** | Zmienia strony, dane, wzorce i style; eksportuje PDF. |
| **może oglądać** | Otwiera projekt tylko w podglądzie. |
| **Właściciel** | Wszystko powyższe, a do tego zaprasza, zmienia role, odbiera dostęp, udostępnia link do podglądu i usuwa projekt. |

### 24.3 Przyjmowanie zaproszenia

Kliknij link z wiadomości. Jeśli masz konto, zaproszenie zobaczysz też w aplikacji: na liście projektów pojawi się przycisk **Zaproszenia** z liczbą. Przyjęty projekt jest na Twojej liście z plakietką właściciela.

Zaproszenie przyjmuje osoba, która ma link — także z innego adresu niż ten, na który poszło. W oknie Współpraca zawsze widać, kto naprawdę jest w projekcie.

Z włączonymi powiadomieniami (rozdział „27.6 Powiadomienia”) dowiesz się o zaproszeniu od razu.

### 24.4 Praca na żywo

- Zmiany łączą się element po elemencie: gdy Ty poprawiasz tytuł, a ktoś przesuwa zdjęcie, zostają obie zmiany. O ten sam element aplikacja zapyta (rozdział „2.5 Kilka urządzeń i cofanie”).
- Kółka z inicjałami na pasku edytora i podglądu pokazują, kto jeszcze ma projekt otwarty; wskaż kółko, żeby zobaczyć, na której jest stronie.
- **Cofnij** cofa tylko Twoje zmiany.

### 24.5 Zarządzanie osobami

Właściciel w oknie Współpraca przy każdej osobie:

- zmienia **rolę** na liście rozwijanej,
- **Odbierz** — odbiera dostęp od razu; zmiany, które ta osoba już zapisała, zostają,
- przy zaproszeniu, które czeka: **Kopiuj link zaproszenia**, **Wyślij e-mail z zaproszeniem ponownie** i **Cofnij zaproszenie**.

### 24.6 Opuszczanie projektu i kopia

Współpracownik może **Opuść projekt** — w menu **⋯** na karcie albo w oknie Współpraca. **Zrób własną kopię** tworzy Twój własny projekt z tą samą treścią.

### 24.7 Komentarze

Komentarz to uwaga przypięta do miejsca na stronie albo do elementu — jak karteczka na wydruku — widoczna jako pomarańczowa pinezka z numerem. Komentować mogą wszyscy w projekcie, także z rolą **może oglądać** (w podglądzie). Komentarzy nie ma w PDF.

![Narzędzie Komentarz i przycisk Komentarze z licznikiem](https://makietka.app/img/instrukcja/k-komentarz-narzedzie.png)

**Dodanie komentarza**

1. Kliknij **Komentarz** na pasku narzędzi (w podglądzie: **Komentarze** → **Nowy komentarz**).
2. Kliknij miejsce na stronie. Jeśli najpierw zaznaczysz element, komentarz od razu przypnie się do niego.
3. Wpisz treść i kliknij **Dodaj komentarz** (albo Ctrl+Enter). Esc rezygnuje.

Wpisz **@** i początek nazwy, żeby wspomnieć osobę z projektu — aplikacja podpowie nazwy.

**Lista komentarzy**

**Komentarze** na górnym pasku edytora i w podglądzie pokazuje liczbę nierozwiązanych wątków. Kliknięcie pinezki otwiera jej wątek.

![Panel Komentarze z wątkiem i odpowiedzią](https://makietka.app/img/instrukcja/komentarze.png)

- Filtry: **Nierozwiązane**, **Wszystkie**, **Moje** (moje wątki, moje odpowiedzi i wzmianki o mnie).
- W wątku są odpowiedzi, **Odpowiedz** i **Pokaż na stronie**.
- **Rozwiąż** zamyka załatwiony wątek i chowa pinezkę; **Otwórz ponownie** (filtr **Wszystkie**) go przywraca.
- Własny komentarz poprawisz ołówkiem **Popraw** (dopisek „(poprawiony)”); `Ctrl`+`Enter` zapisuje i wysyła.
- Usunąć komentarz może autor albo właściciel projektu — znika u wszystkich od razu, z odpowiedziami.
- Komentarz przy elemencie idzie za elementem; gdy element usuniesz, pinezka zostaje w tym miejscu. Wątek z usuniętej strony zostaje na liście z opisem „strona usunięta”.
- Komentarze dodaje się na stronach, nie na wzorcach.

Komentarze pojawiają się u wszystkich od razu; odpowiedź, którą piszesz, nie znika, gdy ktoś coś doda. O nowych dowiesz się też z powiadomień (rozdział „27.6 Powiadomienia”).

AI połączone kluczem też czyta komentarze, odpowiada na nie i może je rozwiązać po poprawce (rozdział „25.1 Co potrafi AI”).

## 25. Praca z AI

Asystent AI może budować i zmieniać Twoje projekty razem z Tobą.

### 25.1 Co potrafi AI

Asystent AI (Claude, ChatGPT i inne) łączy się z Makietką przez **łącznik**: adres z Twoim kluczem, który dodajesz w aplikacji AI.

| AI może | AI nie może |
|---|---|
| tworzyć i usuwać projekty (z pełnym dostępem) | zobaczyć projektów spoza klucza |
| dodawać i zmieniać strony, elementy, style i wzorce | zmienić Twojego konta ani hasła |
| wypełniać tabele danych i ustawiać serie | zrobić pliku PDF bez Makietki — rysuje go Twoja przeglądarka (rozdział „25.5 Plik PDF przez AI”) |
| wgrywać, wstawiać i wymieniać zdjęcia |  |
| czytać komentarze, odpowiadać na nie i dodawać własne (rozdział „24.7 Komentarze”) |  |
| zlecić plik PDF albo PNG strony i podać Ci link do pobrania (rozdział „25.5 Plik PDF przez AI”) |  |

Pisz do AI zwyczajnie, jak do grafika: co chcesz zrobić, w jakim formacie, ile stron, jaki nastrój. Jeśli masz projekt otwarty, zmiany pojawiają się w edytorze po chwili. Zmiany AI łączą się z Twoimi jak zmiany współpracownika (rozdział „24.4 Praca na żywo”).

### 25.2 Klucz dla AI

Klucz należy do konta: **Ustawienia konta** → **Dostęp dla AI** → **Zarządzaj…**.

![Dostęp dla AI w ustawieniach konta](https://makietka.app/img/instrukcja/k-konto-ai.png)

Część **Nowy klucz**:

| Ustawienie | Znaczenie |
|---|---|
| **Opis (dla Ciebie)** | Np. „Claude – kalendarz”. |
| **AI może** | **czytać i zmieniać** albo **tylko czytać**. |
| **Ważny przez** | 1 dzień, 7 dni, 30 dni, 90 dni, rok albo bez terminu. |
| **Wybrane projekty** | Projekty, do których klucz daje dostęp — Twoje i udostępnione Ci. |
| **Pełny dostęp – wszystkie projekty, także tworzenie i usuwanie** | Także projekty, które dojdą później. Usunięcie projektu AI zawsze potwierdza nazwą. |

**Utwórz klucz** pokazuje **Adres łącznika** — widać go tylko raz, skopiuj go od razu.

Lista **Klucze konta** pokazuje zakres, ważność i ostatnie użycie każdego klucza. **Zmień zakres** dodaje albo usuwa projekty albo przełącza na pełny dostęp — adres łącznika się nie zmienia. **Odbierz** wyłącza klucz od razu.

![Okno Dostęp dla AI](https://makietka.app/img/instrukcja/dostep-ai.png)

### 25.3 Podłączenie w aplikacji AI

| Aplikacja | Jak podłączyć |
|---|---|
| **Claude** (claude.ai, aplikacja na komputer i telefon) | **Ustawienia → Łączniki → Dodaj własny łącznik**, nazwa „Makietka”, wklej adres. W rozmowie włącz łącznik w menu narzędzi. |
| **Claude Desktop** | W oknie Dostęp dla AI: **Pobierz rozszerzenie dla Claude Desktop**, kliknij pobrany plik dwa razy i wklej klucz. Rozszerzenie czyta też pliki z Twojego dysku. |
| **ChatGPT** | **Ustawienia → Aplikacje → Dodaj własny serwer MCP**, wklej adres, uwierzytelnianie: brak. |
| **Claude Code** i inne programy z MCP | Polecenie z części **Dla zaawansowanych** w oknie Dostęp dla AI. |

Sprawdzenie: napisz do AI „Pokaż moje projekty w Makietce”.

Najprościej skopiować polecenie „Podłącz Makietkę” i wkleić je do rozmowy — AI rozpozna, w jakiej aplikacji jesteś, i powie, co kliknąć:

**Polecenie „Podłącz Makietkę”** — Wklej do rozmowy z AI – poprowadzi Cię przez podłączenie w Twojej aplikacji.

```text
Pomóż mi podłączyć Makietkę do Ciebie jako łącznik (serwer MCP), krok po kroku.

Co to jest Makietka: aplikacja w przeglądarce (https://makietka.app) do składania publikacji do druku – kalendarzy, planerów, notesów, zeszytów, komiksów. Ma strony, wzorce, style tekstu, tabele danych, serie powielanych stron, obrazy i eksport PDF.

Co wiem o łączniku Makietki:
- To zdalny serwer MCP (transport Streamable HTTP), bez logowania OAuth. Adres: https://api.makietka.app/mcp/<klucz>. Klucz można też podać nagłówkiem „Authorization: Bearer sdk_…” (wtedy adres bez klucza: https://api.makietka.app/mcp).
- Klucz tworzę sam w Makietce: Ustawienia konta → Dostęp dla AI → Zarządzaj… Wybieram: które projekty (albo pełny dostęp – wtedy AI może też tworzyć i usuwać projekty), czy AI tylko czyta, czy też zmienia, i ważność. Adres z kluczem widać tylko raz.
- Narzędzia łącznika: lista projektów, nowy projekt i usunięcie projektu (przy pełnym dostępie), przegląd projektu, czytanie i zmiana stron, elementów, wzorców, stylów, tabel danych i serii, wgrywanie obrazów (adres https, link z Dysku Google albo Dropboxa, kod SVG, małe pliki kawałkami), wstawianie obrazów na strony, link do wgrania zdjęć przez przeglądarkę, kontrola przed drukiem.
- Opis dla AI: https://makietka.app/ai/api.md, model danych projektu: https://makietka.app/ai/format-makietka.md.
- Dla Claude Desktop jest też rozszerzenie https://makietka.app/ai/mcp/makietka.mcpb – działa na komputerze i czyta pliki oraz foldery z dysku.
- Claude Code: claude mcp add --transport http makietka https://api.makietka.app/mcp/<klucz>

Twoje zadanie:
1. Ustal, w jakiej aplikacji teraz rozmawiamy (claude.ai w przeglądarce, aplikacja Claude na telefonie, Claude Desktop, Claude Code, ChatGPT, Cursor albo inna) i czy na moim planie da się w niej dodać własny łącznik MCP. Jeśli nie wiesz – zapytaj mnie.
2. Poprowadź mnie po kolei, co kliknąć, żeby dodać łącznik o nazwie „Makietka” z moim adresem. Nie proś mnie o wklejenie klucza do tej rozmowy – wkleję go sam w ustawieniach.
3. Jeśli ta aplikacja albo mój plan nie obsługuje łączników, powiedz to wprost i zaproponuj najprostszą drogę (inna aplikacja, Claude Desktop z rozszerzeniem, Claude Code).
4. Po podłączeniu sprawdź, czy widzisz narzędzie „projekty”, i pokaż mi listę moich projektów.
Pisz prosto, po polsku, jeden krok na raz i czekaj, aż powiem, że zrobione.
```

> **Wskazówka:** Łączniki są zwykle w płatnych planach aplikacji AI. Na telefonie można zwykle tylko używać łączników dodanych wcześniej na komputerze.

### 25.4 Zdjęcia przez AI

- **ChatGPT** bierze zdjęcia wrzucone do rozmowy wprost.
- **Claude** wgrywa sam małe grafiki z rozmowy; **Claude Desktop z rozszerzeniem** — pliki i foldery z dysku.
- **Zawsze działa link do wgrania:** poproś AI o link — otworzy ten projekt z oknem Obrazy projektu, wrzucasz tam zdjęcia albo ZIP, a AI widzi je i działa dalej.
- AI pobierze też obraz z adresu w internecie albo z linku do Dysku Google czy Dropboxa udostępnionego „każdemu, kto ma link”, i narysuje własną grafikę SVG.

Zdjęcia, które stoi na stronie, AI nie usuwa — wymienia je na nowy plik w tym samym miejscu.

### 25.5 Plik PDF przez AI

Poproś AI np. „Zrób PDF do drukarni” albo „Pokaż okładkę jako obraz”. Plik rysuje Makietka w Twojej przeglądarce, tak samo jak **Eksportuj do PDF…** (rozdział „21 Eksport do PDF i PNG”):

- **Makietka jest otwarta** (dowolna karta, na komputerze albo telefonie) — przyjmuje zlecenie sama. Na górze pojawia się pasek „AI zleciło eksport PDF…”, a po chwili powiadomienie z przyciskiem **Pobierz**. AI dostaje link do pobrania pliku i uwagi ze sprawdzenia przed drukiem.
- **Makietka jest zamknięta** — AI poda link do aplikacji. Otwórz go: projekt się otworzy, plik zrobi się sam, a AI poda link do pobrania, gdy znów go zapytasz.

Link do pobrania działa bez logowania przez 7 dni, potem plik znika z konta. AI może zlecić cały projekt, jedną sekcję albo wybrane strony, plik do drukarni (ze spadem i znakami cięcia, także PDF/X) albo do czytania na ekranie, broszurę do złożenia albo PNG jednej strony.

### 25.6 Bezpieczeństwo

AI dostaje co najwyżej Twoje uprawnienia: w projekcie, który możesz tylko oglądać, klucz tylko czyta, a gdy właściciel odbierze Ci dostęp, klucz traci go od razu.

> **Uwaga:** Adres łącznika zawiera klucz — kto go ma, ma dostęp do wybranych projektów. Nie publikuj go, dawaj najkrótszą ważność, jaka wystarczy, i odbieraj klucz po skończonej pracy.

## 26. Przykład: komiks z AI

### 26.1 Od pomysłu do pliku

Zeszyt A5 z okładką: AI układa kadry i dymki, Ty dajesz rysunki i decydujesz.

1. Utwórz klucz z **pełnym dostępem** i **czytać i zmieniać** — AI utworzy nowy projekt (rozdział „25.2 Klucz dla AI”).
2. Skopiuj polecenie „Komiks do druku” (niżej), dopisz pomysł i wyślij. AI najpierw pokaże plan stron — popraw go, zanim zacznie.
3. Otwórz nowy projekt — zobaczysz, jak przybywa stron, kadrów i dymków.
4. Poproś AI o link do wgrania i wrzuć rysunki (rozdział „25.4 Zdjęcia przez AI”). AI wstawi je w kadry.
5. Popraw, co chcesz: tekst w dymkach (styl „Dymek” zmienia wszystkie naraz), kadrowanie, kolejność stron.
6. Okładkę zrób jako osobną sekcję z grzbietem (rozdział „10.6 Okładka z grzbietem”).
7. **Sprawdź przed drukiem**, potem PDF **Do drukarni** (rozdział „20 Sprawdź przed drukiem”, „21 Eksport do PDF i PNG”).

**Polecenie „Komiks do druku”** — Skopiuj, dopisz pomysł na końcu i wyślij AI z podłączoną Makietką.

```text
Korzystając z łącznika Makietka, przygotuj ze mną komiks do druku.

1. Najpierw zaproponuj plan: tytuł, liczbę stron (domyślnie 8 stron środka + okładka), na każdej stronie liczbę kadrów i co się w nich dzieje. Poczekaj, aż zatwierdzę.
2. Potem utwórz nowy projekt „Komiks – <tytuł>”: format A5 (148×210 mm), spad 3 mm, marginesy 8 mm. Środek w rozkładówkach, okładka jako osobna sekcja.
3. Na stronach ułóż kadry: prostokąty z czarnym obrysem 0,6 mm i odstępem 4 mm między kadrami, w obrębie marginesów. W kadrach dymki (elipsy albo prostokąty z zaokrągleniem, białe wypełnienie, czarny obrys) z tekstem 9 pt, wyśrodkowanym. Narrację umieść w prostokątnych ramkach u góry kadru.
4. Zrób styl tekstu „Dymek” i „Narracja”, żebym mógł je potem zmienić naraz.
5. Rysunków nie wymyślaj na siłę: jeśli nie możesz ich narysować, w każdym kadrze zostaw szary prostokąt z krótkim opisem sceny. Ja wgram rysunki – daj mi link do wgrania obrazów, a potem wstaw je w kadry z dopasowaniem „wypełnij”.
6. Dodaj numery stron we wzorcu (pole {nr}) na dole, po zewnętrznej stronie.
7. Na koniec uruchom kontrolę przed drukiem i powiedz, co poprawić.

Mój pomysł na komiks: <opisz tutaj bohaterów, historię i nastrój>
```

> **Wskazówka:** Zeszyt zszywany ma liczbę stron podzielną przez 4 (8, 12, 16…). Rysunki do druku przygotuj w co najmniej 300 dpi w rozmiarze kadru.

## 27. Konto

Konto przechowuje Twoje projekty, czcionki i elementy, więc masz je na każdym urządzeniu.

### 27.1 Zakładanie konta

Na ekranie logowania wybierz **Nowe konto** i wpisz:

- **Nazwę użytkownika** — 3–30 znaków: litery, cyfry, `_`, `.` i `-`. Po tej nazwie inni zaproszą Cię do projektu (rozdział „24.1 Zapraszanie”).
- **E-mail**.
- **Hasło** — co najmniej 8 znaków, mała i wielka litera, cyfra i znak specjalny.

Jeśli przyjdzie e-mail „Potwierdź swoje konto”, kliknij w nim przycisk — dopiero wtedy się zalogujesz.

![Nowe konto](https://makietka.app/img/instrukcja/rejestracja.png)
![Sprawdź skrzynkę](https://makietka.app/img/instrukcja/rejestracja-wyslano.png)

### 27.2 Logowanie i hasło

W polu **E-mail albo nazwa użytkownika** wpisz adres konta albo swoją nazwę użytkownika (wielkość liter nie ma znaczenia), potem hasło. Po 10 nieudanych próbach logowania tą samą nazwą trzeba odczekać kwadrans — adresem e-mail zalogujesz się od razu.

**Nie pamiętasz hasła?** wysyła link do ustawienia nowego hasła. Link działa jeden raz; gdy wygaśnie, poproś o nowy.

![Logowanie](https://makietka.app/img/instrukcja/logowanie.png)

### 27.3 Ustawienia konta

Kliknij kółko z inicjałem w prawym górnym rogu listy projektów i wybierz **Ustawienia konta**.

![Menu konta](https://makietka.app/img/instrukcja/k-menu-konta.png)

| Wiersz | Co zmienisz |
|---|---|
| **Nazwa użytkownika** | Nazwę, po której inni zapraszają Cię do projektów. |
| **E-mail** | Adres konta. **Zmień adres** wysyła link potwierdzający na nowy adres; do jego kliknięcia logujesz się dotychczasowym. **Wpisz inny adres** zastępuje oczekujący adres nowym. |
| **Hasło** | **Zmień hasło**. |
| **Motyw** | Wygląd aplikacji (rozdział „27.4 Motyw”). |
| **Powiadomienia** | Powiadomienia na tym urządzeniu (rozdział „27.6 Powiadomienia”). |
| **Dostęp dla AI** | Klucze dla asystentów AI (rozdział „25.2 Klucz dla AI”). |
| **Zestaw marki** | Kolory, czcionki, style tekstu i logo marki — dostępne w każdym projekcie (rozdział „27.9 Zestaw marki”). |
| **Miejsce** | Ile zajmują Twoje pliki i projekty (rozdział „27.5 Miejsce i limity”). |
| **Usuń konto** | Usunięcie konta (rozdział „27.7 Usuwanie konta”). |

**Wyloguj wszędzie** (w widoku **Logowanie**) wylogowuje wszystkie urządzenia naraz — np. po pracy na cudzym komputerze.

![Ustawienia konta](https://makietka.app/img/instrukcja/konto.png)

### 27.4 Motyw

**Ustawienia konta** → **Motyw**: **Jak w systemie**, **Jasny** albo **Ciemny**. Szybki przełącznik (ikona półkola) jest też na liście projektów i w menu **⋯** edytora. Motyw zmienia tylko wygląd aplikacji — strony publikacji zawsze są na białym papierze.

![Ciemny motyw](https://makietka.app/img/instrukcja/motyw.png)

### 27.5 Miejsce i limity

**Ustawienia konta** → **Miejsce** pokazuje paski limitów konta:

| Limit | Ile |
|---|---|
| Pliki konta (obrazy, czcionki, podglądy linków) | 2 GB |
| Jeden plik | 50 MB |
| Projekty | 100 |
| Obrazy w jednym projekcie | 1000 |

Niżej jest lista Twoich projektów: ile zajmuje każdy, ile ma obrazów i stron, kiedy go zmieniano. **Otwórz** otwiera projekt, **Pokaż obrazy** — jego okno obrazów (rozdział „7.5 Okno Obrazy projektu”). Projekty innych osób, do których masz dostęp, są osobno i nie liczą się do Twoich limitów.

Od 80% limitu aplikacja ostrzega — tutaj i przy wgrywaniu obrazów. **Posprzątaj…** pokazuje, ile miejsca zwolni, i usuwa tylko pliki, których żaden projekt już nie używa: stare wersje podmienionych zdjęć, pliki usuniętych projektów i wyłączonych linków. Pliki z ostatnich dwóch dni zostają.

### 27.6 Powiadomienia

Powiadomienia mówią od razu o zaproszeniach i komentarzach — także przy zamkniętej aplikacji. W **Ustawienia konta** → **Powiadomienia** włącz **Na tym urządzeniu** (przeglądarka zapyta o zgodę) i wybierz, o czym chcesz wiedzieć: zaproszenia, odpowiedzi na Twoje zaproszenia, zmiany roli i dostępu, komentarze i wzmianki (rozdział „24.7 Komentarze”). Kliknięcie powiadomienia otwiera właściwy projekt albo wątek.

Powiadomienia włącza się osobno na każdym urządzeniu. Na iPhonie i iPadzie działają tylko w zainstalowanej aplikacji (rozdział „28.4 Instalacja aplikacji”).

![Powiadomienia w ustawieniach konta](https://makietka.app/img/instrukcja/k-powiadomienia.png)

### 27.7 Usuwanie konta

**Ustawienia konta** → **Usuń konto** usuwa konto i wszystkie Twoje projekty. Zanim to zrobisz, wyeksportuj projekty, które chcesz zachować (rozdział „2.6 Plik projektu”).

> **Uwaga:** Usunięcia konta nie da się cofnąć.

### 27.8 Kontakt

Pytanie, pomysł albo błąd? **Kontakt** jest w menu konta i pod formularzem logowania. **Załącz pliki** dodaje zrzut ekranu, plik projektu albo PDF (do 5 plików, razem 10 MB). Możesz też pisać na kontakt@makietka.app.

![Formularz kontaktowy z załącznikiem](https://makietka.app/img/instrukcja/k-kontakt.png)

### 27.9 Zestaw marki

Kolory, czcionki i logo firmy (albo szkoły, parafii, klubu) zapisujesz raz — na koncie — i masz je w każdym projekcie: **Ustawienia konta** → **Zestaw marki** → **Edytuj zestaw marki…** (albo Biblioteka → **Marka**).

- **Kolory marki** — z nazwą, np. „Granat marki”. Przełącznik **Pantone / CMYK** robi z koloru kolor dodatkowy, drukowany osobną farbą (rozdział „22.1 Kolory dodatkowe”).
- **Czcionki marki** — jedna do nagłówków, jedna do tekstu.
- **Style tekstu** — **Dodaj gotowe style** dodaje Tytuł, Podtytuł, Nagłówek 1–4, Akapit, Akapit wyróżniony, Podpis, Cytat, Listę, Przypis, Stopkę / żywą paginę i Etykietę w czcionkach i kolorze marki; **Własny styl** — kolejne, bez limitu. Każdy styl ma czcionkę, rozmiar, wagę, kursywę, interlinię, odstęp liter, kolor i wielkość liter.
- **Logo** — PNG, JPG, WebP albo SVG; wstawisz je z Biblioteki.

![Style tekstu marki](https://makietka.app/img/instrukcja/k-marka-style.png)

![Zestaw marki](https://makietka.app/img/instrukcja/k-marka.png)

Marka jest pod ręką w oknie koloru (rozdział „6.7 Wybór koloru”), na górze listy czcionek (rozdział „5.8 Czcionki”) i w Bibliotece (rozdział „4.8 Biblioteka”).

- **wybór koloru** — część **Marka** nad „Użytymi w projekcie” (rozdział „6.7 Wybór koloru”),
- **lista czcionek** — grupa **Marka** na samej górze (rozdział „5.8 Czcionki”),
- **Biblioteka** — kategoria **Marka**: logo, **Zastosuj markę do projektu…** i **Edytuj zestaw marki…** (rozdział „4.8 Biblioteka”),
- **⋯** → **Zastosuj markę do projektu…** — zamiana kolorów i czcionek całego projektu na markowe (rozdział „3.3 Menu ⋯”).

**Zastosuj markę do projektu.** Okno pokazuje każdy kolor i każdą czcionkę projektu z propozycją: kolor dostaje najbliższy kolor marki (czerń, biel i szarości zostają), najczęstsza czcionka — czcionkę tekstu, pozostałe — czcionkę nagłówków. Na listach zmienisz propozycję albo wybierzesz „bez zmian”. Część **Style tekstu** przenosi style marki do stylów projektu (rozdział „5.4 Style”): styl projektu o tej samej nazwie (np. „Tytuł”) dostaje wygląd marki i zostaje powiązany ze swoimi tekstami — zmienią się od razu — a brakujące style dochodzą. **Zastosuj** zmienia strony, wzorce i style naraz; całość cofniesz jednym **Cofnij** (`Ctrl`+`Z`).

![Zastosuj markę do projektu](https://makietka.app/img/instrukcja/k-marka-zastosuj.png)

## 28. Telefon i tablet

Jak pracować na ekranie dotykowym i jak zainstalować aplikację.

### 28.1 Gesty

Na ekranie dotykowym:

| Gest | Co robi |
|---|---|
| **Jeden palec** | Zaznacza i przesuwa elementy. |
| **Dwa palce** | Przesuwają widok i powiększają. |
| **Szybkie przesunięcie w bok** | Po pustym miejscu strony, gdy cała strona mieści się na ekranie: w lewo – następna strona, w prawo – poprzednia (przy rozkładówce cały arkusz). Wolne przeciągnięcie zaznacza ramką jak zwykle. |
| **Dwa szybkie stuknięcia** | Jak podwójne kliknięcie: pisanie w tekście i komórce tabeli, wejście do grupy, edycja punktów. |
| **Przytrzymanie** | Pokazuje podpowiedź, np. opis chmurki zapisu. |

W podglądzie szczypanie powiększa, a w prezentacji przesunięcie w bok przewraca stronę (rozdział „19 Podgląd”).

### 28.2 Edytor na telefonie

Na telefonie edytor działa w pionie. Panele **Strony**, **Właściwości**, **Warstwy** i **Ostrzeżenia** otwierasz przyciskami na dole ekranu. Panel wysuwa się z dołu, a widok sam przesuwa się tak, żeby zaznaczony element był widoczny nad panelem.

**Uchwyt** (kreska u góry panelu): pociągnij w górę, żeby powiększyć panel, w dół — żeby go zmniejszyć albo zamknąć. Stuknięcie w uchwyt zwija powiększony panel do zwykłej wysokości, a zwykły zamyka. Panel zamyka też ponowne stuknięcie jego przycisku.

Rzadsze narzędzia — wielokąt, rysowanie, pióro, komentarz, kopiowanie wyglądu — są pod **⋯** na końcu paska wstawiania (rozdział „3.4 Pasek wstawiania”). Linijek i kadrowania ramką na telefonie nie ma: prowadnice wpiszesz liczbą (rozdział „12.4 Linijki i prowadnice”), a obraz przytniesz liczbami we właściwościach (rozdział „7.2 Kadrowanie”).

Telefon trzymany poziomo pokazuje planszę „Za mało miejsca na wysokość” — obróć go do pionu.

![Edytor na telefonie](https://makietka.app/img/instrukcja/telefon.png)

### 28.3 Okna od dołu

Na telefonie i tablecie okna (Dane, Wzorce, Eksport do PDF, Obrazy projektu i inne) wysuwają się od dołu ekranu. Zamiast krzyżyka mają **uchwyt** — pociągnij go w dół albo stuknij, żeby zamknąć; zamyka też stuknięcie w przyciemnione tło. Główny przycisk okna jest na dole, zawsze widoczny. Ten sam uchwyt mają listy wyboru, wybór koloru i daty, które na telefonie też wysuwają się od dołu — stuknięcie poza nimi albo w uchwyt je chowa. Małe menu (⋯, widok) rozwijają się pod przyciskiem i chowają się po stuknięciu obok.

![Okno na telefonie](https://makietka.app/img/instrukcja/telefon-zaslonka.png)

### 28.4 Instalacja aplikacji

Zainstalowana Makietka otwiera się z ekranu głównego jak zwykła aplikacja — na całym ekranie, bez paska przeglądarki.

| Urządzenie | Jak zainstalować |
|---|---|
| **Android** (Chrome) | **Zainstaluj aplikację** w menu konta albo w menu przeglądarki ⋮. |
| **iPhone i iPad** (Safari) | **Zainstaluj aplikację** pokaże kroki: **Udostępnij → Do ekranu początkowego**. |
| **Komputer** (Chrome, Edge) | Ikona instalacji w pasku adresu albo **Zainstaluj aplikację**. W Safari na Macu: **Plik → Dodaj do Docka**. |

Zainstalowana aplikacja na komputerze otwiera pliki `.makietka` dwuklikiem.

### 28.5 Pełny ekran

**Pełny ekran** (cztery narożniki) na liście projektów, w edytorze i w podglądzie chowa paski przeglądarki; `Esc` albo ten sam przycisk wraca. Na iPhonie przeglądarka nie pozwala na pełny ekran — tam daje go zainstalowanie aplikacji (rozdział „28.4 Instalacja aplikacji”).

### 28.6 Dłuższe czynności

Gdy coś trwa dłużej niż chwilę — np. otwieranie dużego projektu, eksport PDF, druk w domu, wgrywanie obrazów — u góry pojawia się karta z paskiem, a gdy wiadomo, ile zostało, z licznikiem, np. „17 z 48”. Eksport PDF przerwiesz przyciskiem **Anuluj**. Miniatury stron dużego projektu rysują się w tle (cienki pasek w panelu Strony) — możesz w tym czasie normalnie pracować.

![Karta postępu przy eksporcie PDF](https://makietka.app/img/instrukcja/k-postep.png)

## 29. Skróty klawiszowe

### 29.1 Lista skrótów

Na Macu zamiast `Ctrl` naciśnij `⌘`. W edytorze tę listę pokaże klawisz `?`. W trakcie pisania tekstu działają tylko skróty z grupy „Tekst”.

`Ctrl`+`K` otwiera paletę poleceń: wpisz kilka liter nazwy polecenia i naciśnij `Enter`.

#### Edycja

| Klawisze | Działanie |
|---|---|
| `Ctrl` + `Z` | Cofnij (zmiany na stronach, w układzie stron, sekcjach, wzorcach, stylach i danych) |
| `Ctrl` + `Shift` + `Z` | Ponów |
| `Ctrl` + `C` | Kopiuj |
| `Ctrl` + `X` | Wytnij |
| `Ctrl` + `V` | Wklej: element skopiowany w aplikacji (na innej stronie – w to samo miejsce) albo obraz ze schowka systemu – zrzut ekranu, skopiowany plik, kod SVG |
| `Ctrl` + `D` | Duplikuj |
| `Delete` | Usuń |
| `Ctrl` + `F` | Znajdź w tekstach projektu |
| `Ctrl` + `H` | Znajdź i zamień |
| `Ctrl` + `Alt` + `C` | Kopiuj wygląd zaznaczonego elementu (poza pisaniem tekstu) |
| `Ctrl` + `Alt` + `V` | Nałóż skopiowany wygląd na zaznaczenie |
| `Ctrl` + `S` | Zapisz od razu (zapis i tak jest automatyczny) |

#### Zaznaczanie

| Klawisze | Działanie |
|---|---|
| `Ctrl` + `A` | Zaznacz wszystko na stronie (w otwartej grupie: jej elementy) |
| `Esc` | Odznacz (w otwartej grupie: wróć do całej grupy) |
| `Tab` | Następny element |
| `Shift` + `Tab` | Poprzedni element |
| `Enter` | Edytuj zaznaczony tekst |

#### Przesuwanie

| Klawisze | Działanie |
|---|---|
| `Strzałki` | Przesuń o 1 mm |
| `Shift` + `Strzałki` | Przesuń o 10 mm |
| `Alt` + `Strzałki` | Przesuń o 0,1 mm |
| `Shift przy przeciąganiu` | Tylko w poziomie albo w pionie; przy obracaniu – co 15° |
| `Alt przy przeciąganiu` | Przeciągnij kopię, oryginał zostaje |
| `Ctrl przy przeciąganiu` | Bez przyciągania do linii, elementów i siatki |
| `Alt (przytrzymany)` | Pokaż odległości zaznaczonego elementu do sąsiadów i krawędzi strony |

#### Układ

| Klawisze | Działanie |
|---|---|
| `Ctrl` + `G` | Grupuj |
| `Ctrl` + `Shift` + `G` | Rozgrupuj |
| `Ctrl` + `]` | Warstwa wyżej |
| `Ctrl` + `[` | Warstwa niżej |
| `Ctrl` + `Shift` + `]` | Na wierzch |
| `Ctrl` + `Shift` + `[` | Na spód |
| `Ctrl` + `L` | Zablokuj albo odblokuj |

#### Tekst

| Klawisze | Działanie |
|---|---|
| `Ctrl` + `B` | Pogrubienie |
| `Ctrl` + `I` | Kursywa |
| `Ctrl` + `U` | Podkreślenie |
| `Ctrl` + `Shift` + `L` | Wyrównaj do lewej |
| `Ctrl` + `Shift` + `E` | Wyśrodkuj |
| `Ctrl` + `Shift` + `R` | Wyrównaj do prawej |
| `Ctrl` + `Shift` + `J` | Wyjustuj |
| `Ctrl` + `Shift` + `.` | Większa czcionka (o 1 pt) |
| `Ctrl` + `Shift` + `,` | Mniejsza czcionka (o 1 pt) |
| `Ctrl` + `Shift` + `8` | Lista z punktami (włącz / wyłącz) |
| `Ctrl` + `Shift` + `7` | Lista numerowana (włącz / wyłącz) |

#### Wstawianie

| Klawisze | Działanie |
|---|---|
| `T` | Tekst |
| `R` | Prostokąt |
| `E` | Elipsa |
| `L` | Linia |
| `B` | Rysowanie odręczne (włącz / wyłącz; Esc kończy) |
| `N` | Pióro: kształt z punktów i krzywych (włącz / wyłącz; Enter kończy kształt, Esc porzuca) |
| `P` | Wielokąt |
| `I` | Obraz z dysku |

#### Widok

| Klawisze | Działanie |
|---|---|
| `Ctrl` + `+` | Powiększ |
| `Ctrl` + `−` | Pomniejsz |
| `Ctrl` + `0` | Dopasuj do okna |
| `Ctrl` + `1` | Powiększenie 100% |
| `Ctrl` + `kółko myszy` | Powiększanie w miejscu kursora |
| `Spacja` + `przeciąganie` | Przesuwanie widoku („rączka”) |
| `W` | Pokaż albo ukryj linie pomocnicze |
| `Ctrl` + `'` | Pokaż albo ukryj siatkę |
| `Ctrl` + `Shift` + `'` | Przyciąganie do siatki |
| `Shift` + `R` | Pokaż albo ukryj linijki |
| `Shift` + `W` | Podgląd bez edycji |
| `F7` | Właściwości albo Warstwy w prawej kolumnie (komputer) |
| `F8` | Okienko ostrzeżeń |

#### Strony

| Klawisze | Działanie |
|---|---|
| `PageUp` | Poprzednia strona |
| `PageDown` | Następna strona |
| `Ctrl` + `Shift` + `P` | Nowa strona za bieżącą |
| `?` | Ta lista skrótów |

## 30. Słowniczek

### 30.1 Druk i plik dla drukarni

| Pojęcie | Znaczenie |
|---|---|
| **CMYK** | Cztery farby drukarskie: cyjan, magenta, żółty, czarny. Kolory na ekranie (RGB) drukarnia przelicza na CMYK. |
| **Dpi** | Liczba punktów obrazu na cal w rozmiarze druku. Zdjęcie do druku powinno mieć co najmniej 300 dpi. |
| **Impozycja** | Ułożenie stron na arkuszu do druku tak, aby po złożeniu i przycięciu były w dobrej kolejności (np. broszura). |
| **Kolor dodatkowy (Pantone)** | Gotowo zmieszana farba o dokładnym odcieniu, drukowana osobno obok CMYK. |
| **Nadruk (overprint)** | Farba drukowana na farbie pod spodem, bez wycinania jej — ważne przy czarnym tekście i uszlachetnieniach. |
| **PDF/X-4** | Odmiana PDF dla drukarni: osadzone czcionki, zapisany profil kolorów, przezroczystości bez spłaszczania. |
| **Pokrycie farbą** | Suma farb CMYK w jednym miejscu (w %). Zbyt duże (zwykle ponad 300%) sprawia, że farba nie schnie. |
| **Profil kolorów (ICC)** | Opis maszyny i papieru drukarni; przy przeliczaniu na CMYK daje kolory jak najbliższe zamierzonym. |
| **Rozdzielczość** | Zob. Dpi. |
| **Separacje** | Osobne płyty drukarskie dla każdej farby (C, M, Y, K, kolory dodatkowe, uszlachetnienia). |
| **Spad** | Kilka milimetrów za brzegiem strony; tła i zdjęcia wychodzą aż tam, a drukarnia je odcina. |
| **Użytek** | Jeden egzemplarz małej rzeczy (wizytówki, naklejki) na arkuszu drukarskim – na jednym arkuszu mieści się ich wiele. |
| **Wektor** | Rysunek opisany kształtami, a nie pikselami — ostry w każdym powiększeniu (teksty, kształty, PDF wektorowy). |
| **Znaki cięcia** | Kreski w pliku PDF, które pokazują drukarni, gdzie ciąć. |

### 30.2 Wykończenie druku

| Pojęcie | Znaczenie |
|---|---|
| **Biały poddruk** | Warstwa białej farby pod kolorami — potrzebna przy druku na przezroczystym, kolorowym albo metalizowanym podłożu. |
| **Big, bigowanie** | Wgniecenie w kartonie (np. okładki), po którym karton zgina się równo i nie pęka. |
| **Falc (złam)** | Linia, wzdłuż której składa się arkusz (np. ulotkę na trzy); na kartonie poprzedza go big. |
| **Lakier wybiórczy** | Błyszczący lakier tylko na wybranych miejscach strony, np. na tytule. |
| **Perforacja** | Linia drobnych nacięć, po której łatwo oderwać część arkusza, np. kartkę kalendarza. |
| **Tłoczenie** | Wypukły albo wklęsły wzór wyciśnięty w papierze. |
| **Typ sekcji** | Czym sekcja jest w publikacji (blok, okładka, wyklejka, wkładka, ulotka…) – ustala jej format, numerację i miejsce w grzbiecie. |
| **Uszlachetnienie** | Dodatkowe wykończenie druku: lakier, złocenie (folia), tłoczenie, biały poddruk. |
| **Wykrojnik** | Kształt, po którym drukarnia wycina i biguje arkusz (koperta, pudełko, naklejka); w PDF osobny kolor CutContour. |
| **Złocenie (folia)** | Błyszcząca folia (złota, srebrna, kolorowa) przenoszona na papier w wybranych miejscach. |

### 30.3 Papier i oprawa

| Pojęcie | Znaczenie |
|---|---|
| **Blok (książki)** | Wszystkie kartki środka książki razem, bez okładki. |
| **Broszura** | Kilka arkuszy złożonych na pół i zszytych w grzbiecie; strony trzeba na arkuszach odpowiednio ułożyć (impozycja). |
| **Format** | Wymiary strony po przycięciu, np. A5 = 148 × 210 mm. |
| **Gramatura** | Grubość papieru podawana jako masa metra kwadratowego (g/m²) — od niej zależy m.in. szerokość grzbietu. |
| **Grzbiet** | Część okładki między przodem a tyłem; jego szerokość zależy od liczby stron i papieru. W rozkładówce — miejsce zszycia. |
| **Kapitałka** | Pasek tkaniny na górze i dole grzbietu bloku w twardej oprawie. |
| **Obwoluta** | Papierowa okładka zakładana na twardą oprawę, z dwoma skrzydełkami zawiniętymi do środka (rozdział „10.11 Sekcje specjalne: obwoluta, ulotka, kalendarze, wykrojniki, użytki”). |
| **Oprawa** | Sposób połączenia kartek: zeszytowa (zszywki), klejona (miękka okładka), twarda, na spirali. |
| **Rozkładówka** | Lewa i prawa strona obok siebie, jak w otwartej książce. |
| **Składka** | Arkusz złożony w kilka kartek — książkę szyje się ze składek po 4, 8, 16 albo 32 strony. |
| **Skrzydełko** | Część obwoluty albo okładki zawinięta do środka za płytę okładki. |
| **Tasiemka (zakładka)** | Wąska wstążka wklejona w grzbiet twardej oprawy, do zaznaczania miejsca w książce. |
| **Wkładka** | Kartki na innym papierze wszyte w środek książki, np. zdjęcia na kredzie – bez numerów stron. |
| **Wyklejka** | Arkusz łączący blok książki z twardą okładką: połowa przyklejona do wnętrza okładki, połowa to pierwsza (albo ostatnia) luźna kartka. |

### 30.4 Tekst i typografia

| Pojęcie | Znaczenie |
|---|---|
| **Interlinia** | Odległość między kolejnymi wierszami tekstu. |
| **Justowanie** | Wyrównanie tekstu do obu krawędzi ramki — wiersze mają równą długość. |
| **Linia bazowa** | Niewidoczna linia, na której „stoją” litery. Siatka linii bazowych wyrównuje wiersze w sąsiednich kolumnach i na stronach. |
| **Margines** | Pas przy brzegu strony, w którym nie stawia się tekstu. |
| **Styl** | Zapisany wygląd tekstu, zmieniany naraz we wszystkich tekstach. |
| **Wdowa i sierota** | Pojedynczy wiersz akapitu, który został sam na końcu albo na początku kolumny lub strony. |
| **Żywa pagina** | Tekst u góry albo dołu strony powtarzany na wielu stronach, np. tytuł rozdziału. |

### 30.5 Edycja i narzędzia

| Pojęcie | Znaczenie |
|---|---|
| **Element** | Wszystko, co stoi na stronie: tekst, kształt, linia, obraz, tabela, grupa. |
| **Gradient (przejście)** | Płynne przejście między kolorami w wypełnieniu, także do przezroczystości. |
| **Kadrowanie** | Wybór części zdjęcia, która jest widoczna w ramce. |
| **Krycie** | Przezroczystość elementu albo koloru: 100% — w pełni widoczny, 0% — niewidoczny. |
| **Makieta** | Projekt publikacji strona po stronie; makieta 3D — podgląd wydrukowanej rzeczy (książki, kalendarza). |
| **Miękkie krawędzie** | Brzeg zdjęcia albo kształtu płynnie przechodzący w przezroczystość. |
| **Prowadnica** | Linia pomocnicza na stronie do wyrównywania elementów; nie drukuje się. |

### 30.6 Projekt i dane

| Pojęcie | Znaczenie |
|---|---|
| **Blok (serii)** | Strona albo kilka sąsiednich stron serii, powielane razem. |
| **Pole** | Nazwa w klamrach, np. `{dzien}`; na gotowej stronie zamienia się w wartość. |
| **Pole dokumentu** | Pole wynikające z projektu: numer strony, sekcja, data. |
| **Sekcja** | Część publikacji z własnym formatem, marginesami i numeracją, np. okładka i środek. |
| **Seria** | Powielanie strony albo bloku dla kolejnych wierszy tabeli. |
| **Tabela danych** | Arkusz w projekcie, z którego biorą się pola i serie — nie mylić z tabelą na stronie. |
| **Wiersz pomijany** | Wiersz `**pomiń**`: zajmuje miejsce w bloku, ale jego strona nie powstaje. |
| **Wzorzec** | Wspólne elementy wielu stron: tło, stopka, numer strony. |

### 30.7 AI

| Pojęcie | Znaczenie |
|---|---|
| **Asystent AI** | Program do rozmowy (np. Claude, ChatGPT), który po podłączeniu łącznika czyta i zmienia Twoje projekty (rozdział „25.1 Co potrafi AI”). |
| **Klucz dla AI** | Uprawnienie dla asystenta: do których projektów ma dostęp, czy może tylko czytać i jak długo jest ważne (rozdział „25.2 Klucz dla AI”). |
| **Łącznik** | Adres z Twoim kluczem, przez który asystent AI pracuje w Twoich projektach. Widać go tylko raz, przy tworzeniu klucza. |
| **Zakres klucza** | Wybrane projekty albo pełny dostęp do wszystkich, także tworzenie i usuwanie projektów. |
