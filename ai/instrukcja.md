<!-- Plik wygenerowany przez scripts/instrukcja-buduj.cjs ze źródła docs/instrukcja/*.md – nie zmieniaj go ręcznie. -->
# Makietka – instrukcja

Podręcznik aplikacji Makietka (https://makietka.app/) – edytora publikacji do druku: książek, kalendarzy, planerów, zaproszeń i innych dokumentów. Ta sama treść jest w aplikacji pod przyciskiem z ikoną książki.

## Spis treści

- **Część I. Podstawy** — Czym jest Makietka, konto i projekty.
  - 1. Makietka w skrócie
  - 2. Konto
  - 3. Projekty
- **Część II. Edytor** — Ekran edytora, elementy na stronie, tekst, obrazy, tabele, strony i wzorce.
  - 4. Ekran edytora
  - 5. Elementy na stronie
  - 6. Tekst
  - 7. Kształty, linie i kolory
  - 8. Obrazy
  - 9. Tabela
  - 10. Warstwy
  - 11. Strony, sekcje i rozkładówki
  - 12. Wzorce
  - 13. Linie pomocnicze, siatka i powiększenie
  - 14. Książka: spis treści, pagina, przypisy, odsyłacze, skorowidz
- **Część III. Dane i serie** — Tabele danych, pola w tekście i strony powielane z tabeli.
  - 15. Tabele danych
  - 16. Pola w tekście
  - 17. Serie
  - 18. Wygląd z danych
  - 19. Przykłady
- **Część IV. Gotowa publikacja** — Podgląd, sprawdzenie przed drukiem, plik PDF i link do podglądu.
  - 20. Podgląd
  - 21. Sprawdź przed drukiem
  - 22. Eksport do PDF i PNG
  - 23. Kolory dodatkowe i uszlachetnienia
  - 24. Udostępnianie linkiem
- **Część V. Razem z innymi** — Wspólna praca nad projektem i asystent AI.
  - 25. Współpraca
  - 26. Praca z AI
  - 27. Przykład: komiks z AI
- **Część VI. Urządzenia i pomoc** — Telefon i tablet, skróty klawiszowe i słowniczek.
  - 28. Telefon i tablet
  - 29. Skróty klawiszowe
  - 30. Słowniczek

## 1. Makietka w skrócie

### 1.1 Co zrobisz w Makietce

Makietka to edytor publikacji do druku. Składasz w niej książki, kalendarze, planery, notesy, zeszyty, zaproszenia, etykiety i inne dokumenty — strona po stronie, jak na makiecie. Na koniec zapisujesz plik PDF, który możesz od razu wysłać do drukarni.

Edytor ma to, czego potrzebuje publikacja wielostronicowa:

- **sekcje** o różnych formatach — np. okładka z grzbietem liczonym samym z liczby stron i papieru (rozdział „11.6 Okładka z grzbietem”) i środek (rozdział „11.4 Ustawienia sekcji”),
- **rozkładówki** z lustrzanymi marginesami, jak w książce (rozdział „11.5 Rozkładówki”),
- **wzorce** — tła, stopki i numery stron rysowane raz dla wielu stron (rozdział „12 Wzorce”),
- **style tekstu** — jeden wygląd dla wszystkich tytułów czy podpisów (rozdział „6.4 Style”),
- **plik dla drukarni** ze spadem, znakami cięcia i osadzonymi czcionkami, także PDF/X-4 w CMYK (rozdział „22 Eksport do PDF i PNG”).

Mocną stroną Makietki są **dane**. Stronę możesz powielić dla każdego wiersza tabeli i wstawić do niej wartości z tego wiersza: tak powstaje kalendarz na 365 dni, planer na cały rok albo sto imiennych zaproszeń z jednego wzoru (rozdział „15 Tabele danych” – „18 Wygląd z danych”).

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

Projekt zapisuje się sam, na Twoim koncie (rozdział „3.4 Zapis”).

### 1.3 Pierwszy projekt w skrócie

1. Na liście projektów wybierz **Nowy projekt**, wpisz nazwę i wybierz format (rozdział „3.2 Nowy projekt”).
2. Wstaw elementy z paska nad stroną: tekst, obraz, kształt, tabelę (rozdział „5.1 Wstawianie”).
3. To, co powtarza się na wielu stronach — tło, stopkę, numer strony — połóż we wzorcu (rozdział „12 Wzorce”).
4. Sprawdź całość w **Podgląd** (rozdział „20 Podgląd”).
5. Wybierz **⋯** → **Sprawdź przed drukiem**, a potem **⋯** → **Eksportuj do PDF…** (rozdział „21 Sprawdź przed drukiem”, „22 Eksport do PDF i PNG”).

![Nowy projekt](https://makietka.app/img/instrukcja/k-nowy-projekt.png)

### 1.4 Instrukcja

Instrukcję otworzysz przyciskiem z ikoną książki — na liście projektów, w edytorze i w menu **⋯** na telefonie. Bez konta otworzysz ją na ekranie logowania: **Zobacz, jak to działa**.

Strona główna instrukcji pokazuje wszystkie części i rozdziały. Pole **Szukaj w instrukcji** zostawia w spisie tylko rozdziały ze wszystkimi wpisanymi słowami. Na telefonie spis otwierasz przyciskiem z nazwą bieżącego rozdziału, nad treścią.

![Instrukcja dostępna bez konta](https://makietka.app/img/instrukcja/k-zobacz-jak.png)

## 2. Konto

### 2.1 Zakładanie konta

Projekty są zapisane na koncie, więc otworzysz je na każdym urządzeniu. Na ekranie logowania wybierz **Nowe konto** i wpisz:

- **Nazwę użytkownika** — 3–30 znaków: litery, cyfry, `_`, `.` i `-`. Po tej nazwie inni zaproszą Cię do projektu (rozdział „25.1 Zapraszanie”). Pod polem od razu widać, czy nazwa jest wolna; dla zajętej aplikacja proponuje wolną.
- **E-mail**.
- **Hasło** i **Powtórz hasło** — co najmniej 8 znaków, mała i wielka litera, cyfra i znak specjalny. Spełnione wymagania zaznaczają się w trakcie pisania.

Konto działa od razu. Jeśli wymagane jest potwierdzenie adresu, przyjdzie e-mail „Potwierdź swoje konto” z przyciskiem — dopiero po jego kliknięciu zalogujesz się. **Wyślij ponownie** wysyła wiadomość jeszcze raz.

![Nowe konto](https://makietka.app/img/instrukcja/rejestracja.png)
![Sprawdź skrzynkę](https://makietka.app/img/instrukcja/rejestracja-wyslano.png)

### 2.2 Logowanie i hasło

Zaloguj się adresem e-mail i hasłem. **Nie pamiętasz hasła?** wysyła link do ustawienia nowego hasła. Link z wiadomości działa jeden raz; jeśli wygasł, aplikacja to powie — poproś wtedy o nowy.

Konto założone, zanim w aplikacji pojawiły się nazwy użytkowników, przy logowaniu dostaje okno „Wybierz nazwę użytkownika” z gotową propozycją.

![Logowanie](https://makietka.app/img/instrukcja/logowanie.png)

### 2.3 Ustawienia konta

Kliknij kółko z inicjałem w prawym górnym rogu listy projektów i wybierz **Ustawienia konta**.

![Menu konta](https://makietka.app/img/instrukcja/k-menu-konta.png)

Ustawienia to lista: każdy wiersz pokazuje bieżącą wartość, a kliknięcie otwiera szczegóły. Na komputerze lista stoi z lewej, a wybrane ustawienie z prawej. Na telefonie wiersz otwiera osobny widok, a **‹ Ustawienia** wraca do listy.

| Wiersz | Co zmienisz |
|---|---|
| **Nazwa użytkownika** | Nazwę, po której inni zapraszają Cię do projektów. |
| **E-mail** | Adres konta. **Zmień adres** wysyła link potwierdzający na nowy adres; do jego kliknięcia logujesz się dotychczasowym. **Wpisz inny adres** zastępuje oczekujący adres nowym. |
| **Hasło** | **Zmień hasło** — nowe hasło z tymi samymi wymaganiami co przy zakładaniu konta. |
| **Motyw** | Wygląd aplikacji (rozdział „2.4 Motyw”). |
| **Powiadomienia** | Powiadomienia na tym urządzeniu (rozdział „2.6 Powiadomienia”). |
| **Dostęp dla AI** | Klucze dla asystentów AI (rozdział „26.2 Klucz dla AI”). |
| **Zestaw marki** | Kolory, czcionki i logo marki — dostępne w każdym projekcie (rozdział „2.9 Zestaw marki”). |
| **Miejsce** | Ile zajmują Twoje pliki i projekty (rozdział „2.5 Miejsce i limity”). |
| **Usuń konto** | Usunięcie konta (rozdział „2.7 Usuwanie konta”). |

W widoku **Logowanie** jest też **Wyloguj wszędzie** — wylogowuje wszystkie urządzenia naraz, np. po zalogowaniu na cudzym komputerze. Zwykłe **Wyloguj** (tylko to urządzenie) jest w menu konta.

![Ustawienia konta](https://makietka.app/img/instrukcja/konto.png)

### 2.4 Motyw

W **Ustawienia konta** → **Motyw** wybierz:

- **Jak w systemie** — jasny albo ciemny, tak jak ustawienie urządzenia,
- **Jasny**,
- **Ciemny**.

Szybki przełącznik — ikona półkola — jest na ekranie logowania, na liście projektów i w menu **⋯** edytora. Strony publikacji zawsze są na białym papierze; motyw zmienia tylko wygląd aplikacji.

![Ciemny motyw](https://makietka.app/img/instrukcja/motyw.png)

### 2.5 Miejsce i limity

**Ustawienia konta** → **Miejsce** pokazuje paski limitów konta:

| Limit | Ile |
|---|---|
| Pliki konta (obrazy, czcionki, podglądy linków) | 2 GB |
| Jeden plik | 50 MB |
| Projekty | 100 |
| Obrazy w jednym projekcie | 1000 |

Niżej jest lista Twoich projektów: ile zajmuje każdy, ile ma obrazów i stron, kiedy go zmieniano. **Otwórz** otwiera projekt, **Pokaż obrazy** — jego okno obrazów (rozdział „8.5 Okno Obrazy projektu”). Projekty innych osób, do których masz dostęp, są osobno i nie liczą się do Twoich limitów.

Od 80% limitu aplikacja ostrzega — tutaj i przy wgrywaniu obrazów. **Posprzątaj…** pokazuje, ile miejsca zwolni, i usuwa tylko pliki, których żaden projekt już nie używa: stare wersje podmienionych zdjęć, pliki usuniętych projektów i wyłączonych linków. Pliki z ostatnich dwóch dni zostają.

### 2.6 Powiadomienia

Makietka może od razu dać znać o sprawach projektów innych osób — także wtedy, gdy aplikacja jest zamknięta. Włączysz to w **Ustawienia konta** → **Powiadomienia**:

| Ustawienie | Znaczenie |
|---|---|
| **Na tym urządzeniu** | Przełącznik — powiadomienia na tym urządzeniu. Przeglądarka zapyta o zgodę. |
| **Powiadamiaj, gdy** | **ktoś mnie zaprosi albo udostępni mi projekt**, **ktoś przyjmie albo odrzuci moje zaproszenie**, **zmieni się moja rola albo stracę dostęp do projektu**, **ktoś skomentuje mój projekt, odpowie w moim wątku albo wspomni mnie w komentarzu** (rozdział „25.7 Komentarze”). |

Kliknięcie powiadomienia otwiera właściwy projekt, zaproszenie albo wątek komentarza. Powiadomienia włącza się osobno na każdym urządzeniu. Na iPhonie i iPadzie działają w zainstalowanej aplikacji (rozdział „28.4 Instalacja aplikacji”) — w ustawieniach jest wtedy przycisk **Zainstaluj aplikację**.

![Powiadomienia w ustawieniach konta](https://makietka.app/img/instrukcja/k-powiadomienia.png)

### 2.7 Usuwanie konta

**Ustawienia konta** → **Usuń konto** usuwa konto i wszystkie Twoje projekty. Zanim to zrobisz, wyeksportuj projekty, które chcesz zachować (rozdział „3.6 Plik projektu”).

> **Uwaga:** Usunięcia konta nie da się cofnąć.

### 2.8 Kontakt

Pytanie, pomysł albo błąd? **Kontakt** jest w menu konta i pod formularzem logowania. Wpisz swój adres, temat i wiadomość — trafi do nas, a na Twój adres przyjdzie potwierdzenie. **Załącz pliki** dodaje zrzut ekranu, plik projektu albo PDF: do 5 plików, razem do 10 MB. Możesz też pisać na kontakt@makietka.app.

![Formularz kontaktowy z załącznikiem](https://makietka.app/img/instrukcja/k-kontakt.png)

### 2.9 Zestaw marki

Kolory, czcionki i logo firmy (albo szkoły, parafii, klubu) zapisujesz raz — na koncie — i masz je w każdym projekcie. **Ustawienia konta** → **Zestaw marki** → **Edytuj zestaw marki…**; to samo okno otworzysz w Bibliotece, w kategorii **Marka** → **Edytuj zestaw marki…**.

| Część | Co w niej ustawisz |
|---|---|
| **Kolory marki** | **Dodaj kolor** — kolor z próbnika albo kodem (np. `#1c2541`) i **nazwa**, np. „Granat marki”. Przełącznik **Pantone / CMYK** dodaje wartości C, M, Y, K — taki kolor przy zastosowaniu marki trafi do kolorów dodatkowych projektu (rozdział „23.1 Kolory dodatkowe”) i wydrukuje się osobną płytą. |
| **Czcionki marki** | **Nagłówki** i **Tekst** — po jednej czcionce z listy. |
| **Logo** | **Dodaj logo…** — pliki PNG, JPG, WebP albo SVG. Logo wstawisz potem z Biblioteki. |

**Zapisz** zapisuje zestaw na koncie. Na liście ustawień wiersz **Zestaw marki** pokazuje np. „3 kol. · 1 logo”.

![Zestaw marki](https://makietka.app/img/instrukcja/k-marka.png)

Gdzie zobaczysz markę w projekcie:

- **wybór koloru** — część **Marka** nad „Użytymi w projekcie” (rozdział „7.7 Wybór koloru”),
- **lista czcionek** — grupa **Marka** na samej górze (rozdział „6.8 Czcionki”),
- **Biblioteka** — kategoria **Marka**: logo, **Zastosuj markę do projektu…** i **Edytuj zestaw marki…** (rozdział „5.8 Biblioteka”),
- **⋯** → **Zastosuj markę do projektu…** — zamiana kolorów i czcionek całego projektu na markowe (rozdział „4.3 Menu ⋯”).

**Zastosuj markę do projektu.** Okno pokazuje każdy kolor i każdą czcionkę projektu z propozycją: kolor dostaje najbliższy kolor marki (czerń, biel i szarości zostają), najczęstsza czcionka — czcionkę tekstu, pozostałe — czcionkę nagłówków. Na listach zmienisz propozycję albo wybierzesz „bez zmian”. **Zastosuj** zmienia strony, wzorce i style naraz; całość cofniesz jednym **Cofnij** (`Ctrl`+`Z`).

![Zastosuj markę do projektu](https://makietka.app/img/instrukcja/k-marka-zastosuj.png)

## 3. Projekty

### 3.1 Lista projektów

Po zalogowaniu widzisz swoje projekty. Karta projektu pokazuje pierwszą stronę, nazwę i datę ostatniej zmiany. Kliknięcie karty otwiera projekt w edytorze – na stronie, którą ostatnio edytowałeś na tym urządzeniu.

- **Chmurka** przy nazwie mówi, czy zmiany są na koncie: z ptaszkiem — zapisano, z zegarem — czekają na wysłanie, przekreślona — brak internetu (zmiany są na urządzeniu i wyślą się same). Najedź na nią albo przytrzymaj palec, żeby zobaczyć opis.
- Plakietka **Udostępniony** — projekt ma link do podglądu (rozdział „24 Udostępnianie linkiem”). Kliknięcie plakietki otwiera okno linku.
- Projekty udostępnione Ci przez innych mają plakietkę z nazwą właściciela i dopisek „Możesz edytować” albo „Możesz oglądać”. Filtry **Wszystkie**, **Moje** i **Udostępnione mi** pojawiają się, gdy masz takie projekty.
- **Zaproszenia** z liczbą — zaproszenia do cudzych projektów czekające na odpowiedź (rozdział „25.3 Przyjmowanie zaproszenia”).

![Lista projektów](https://makietka.app/img/instrukcja/projekty.png)

### 3.2 Nowy projekt

Wybierz **Nowy projekt**. Okno ma pola:

| Pole | Co ustawia |
|---|---|
| **Nazwa** | Nazwa projektu na liście. Zmienisz ją później w edytorze. |
| **Format strony** | Rozmiar strony. Kafelki A4, A5, A6, B5 i Kwadrat pokazują proporcje strony. **Własny** — dowolna **Szerokość** i **Wysokość** w mm. |
| **Orientacja** | Pionowo albo poziomo. |
| **Spad** | Pas za krawędzią strony, który drukarnia odcina — zwykle 3 mm (rozdział „13.1 Linie na stronie”). |
| **Marginesy** | Bezpieczny obszar na teksty, w mm. |
| **Układ stron** | **Pojedyncze strony** albo **Rozkładówki (lewa + prawa)**, jak w książce. |

Wszystkie te ustawienia zmienisz później w ustawieniach sekcji (rozdział „11.4 Ustawienia sekcji”). Nowy projekt ma jedną sekcję „Główna” i jedną stronę.

![Nowy projekt](https://makietka.app/img/instrukcja/nowy-projekt.png)

### 3.3 Menu projektu

Przycisk **⋯** na karcie projektu otwiera menu:

| Pozycja | Co robi |
|---|---|
| **Podgląd** | Otwiera od razu podgląd projektu (rozdział „20 Podgląd”). |
| **Zmień nazwę** | Nowa nazwa projektu. |
| **Duplikuj** | Kopia całego projektu, np. kalendarz na kolejny rok. |
| **Eksportuj do pliku (.makietka)** | Plik z całym projektem (rozdział „3.6 Plik projektu”). |
| **Współpraca…** | Zaproszenia do wspólnej pracy (rozdział „25 Współpraca”). |
| **Usuń projekt** | Usuwa projekt (z potwierdzeniem). |

W projekcie innej osoby zamiast **Duplikuj** jest **Zrób własną kopię**, a zamiast **Usuń projekt** — **Opuść projekt** (rozdział „25.6 Opuszczanie projektu i kopia”).

![Menu projektu](https://makietka.app/img/instrukcja/menu.png)

### 3.4 Zapis

Nie ma przycisku „Zapisz” — każda zmiana zapisuje się sama, najpierw na urządzeniu, a po chwili na koncie. Stan zapisu widać w edytorze obok nazwy projektu:

- **Zapisano** — zmiany są na koncie,
- **Zapisywanie…** — zmiany właśnie się wysyłają,
- **Offline** — brak internetu; zmiany czekają na urządzeniu i wyślą się same po powrocie sieci.

Dłuższe czynności (otwieranie dużego projektu, wgrywanie zdjęć, eksport PDF) pokazują u góry ekranu kartę z paskiem postępu. Karta nie blokuje pracy.

### 3.5 Kilka urządzeń i cofanie

Ten sam projekt możesz mieć otwarty na kilku urządzeniach albo w kilku kartach. Zmiana zrobiona na jednym pojawia się na drugim po chwili, bez odświeżania.

Gdy projekt zmieniono w dwóch miejscach naraz, aplikacja **łączy zmiany element po elemencie**: gdy na jednym urządzeniu przesuniesz zdjęcie, a na drugim poprawisz tytuł, zostaną obie zmiany. Pyta tylko wtedy, gdy ten sam element zmieniono w obu miejscach — przy każdym wybierasz **z tego urządzenia** albo **z konta**.

**Cofnij** (`Ctrl`+`Z`) i **Ponów** (`Ctrl`+`Shift`+`Z`) obejmują cały projekt: elementy, strony, sekcje, wzorce, style, dane i serie. Historia sięga 80 kroków i zostaje po zamknięciu projektu — na tym samym urządzeniu. Cofanie zdejmuje tylko zmiany zrobione na tym urządzeniu; zmiany innych osób i AI zostają.

### 3.6 Plik projektu

- **Eksportuj do pliku (.makietka)** (menu **⋯** na karcie) zapisuje cały projekt, z obrazami i czcionkami, do pliku `.makietka` — to kopia zapasowa albo sposób na przekazanie projektu.
- Przycisk ze strzałką obok **Nowy projekt** wczytuje projekt z pliku `.makietka`.
- Zainstalowana aplikacja na komputerze otwiera pliki `.makietka` dwuklikiem (rozdział „28.4 Instalacja aplikacji”).

## 4. Ekran edytora

### 4.1 Układ ekranu

Projekt otwiera się w edytorze. Ekran ma pięć części:

- **górny pasek** — nawigacja, cofanie, okna projektu i menu **⋯** (rozdział „4.2 Górny pasek”, „4.3 Menu ⋯”),
- **panel stron** z lewej — miniatury stron pogrupowane w sekcje (rozdział „11.1 Panel stron”),
- **strona** pośrodku, a nad nią pasek wstawiania (rozdział „4.4 Pasek wstawiania”),
- **prawa kolumna** — właściwości, a pod nimi warstwy (rozdział „4.5 Właściwości i warstwy”, „10 Warstwy”),
- **prawy dolny róg** — linie pomocnicze, siatka i powiększenie (rozdział „4.6 Prawy dolny róg i menu widoku”).

Najechanie myszą na przycisk pokazuje jego nazwę i skrót klawiszowy.

![Edytor](https://makietka.app/img/instrukcja/edytor.png)

### 4.2 Górny pasek

![Górny pasek](https://makietka.app/img/instrukcja/k-pasek-gorny.png)

| Przycisk | Co robi |
|---|---|
| **← Projekty** | Wraca do listy projektów. Niczego nie trzeba zapisywać. |
| **Nazwa projektu** | Kliknij, żeby ją zmienić. Obok jest stan zapisu (rozdział „3.4 Zapis”). |
| **Cofnij**, **Ponów** | Cofanie i ponawianie zmian w całym projekcie (rozdział „3.5 Kilka urządzeń i cofanie”). |
| **Wzorce** | Okno wzorców — wspólnych elementów stron (rozdział „12 Wzorce”). Liczba obok to liczba wzorców. |
| **Dane** | Okno tabel danych (rozdział „15 Tabele danych”). |
| **Podgląd** | Cały projekt bez edycji, z danymi (rozdział „20 Podgląd”). |
| **Format** (np. „A5”) | Ustawienia bieżącej sekcji: format, spad, marginesy (rozdział „11.4 Ustawienia sekcji”). |
| **Pełny ekran** | Chowa paski przeglądarki; `Esc` wraca. |
| **Znajdź i zamień** | Lupa: szukanie i zamiana tekstu w całym projekcie (rozdział „6.15 Znajdź i zamień”). |
| **Instrukcja** | Ta instrukcja. |
| **⋯** | Menu z eksportem i oknami projektu (rozdział „4.3 Menu ⋯”). |

**Wzorce**, **Dane** i **Podgląd** to ikony; napisy obok nich pojawiają się same, gdy jest na nie miejsce. Zmienisz to w menu widoku: **Napisy na górnym pasku** — **Auto**, **Zawsze**, **Nigdy** (rozdział „4.6 Prawy dolny róg i menu widoku”). Na wąskim telefonie **Wzorce**, **Dane**, **Instrukcja** i lupa przechodzą do menu **⋯** (**Znajdź i zamień…** jest tam na górze).

### 4.3 Menu ⋯

![Menu ⋯](https://makietka.app/img/instrukcja/k-menu-wiecej.png)

| Pozycja | Co robi |
|---|---|
| **Znajdź i zamień…** | Szukanie i zamiana tekstu na wszystkich stronach i we wzorcach (`Ctrl`+`F`, → 6.15). |
| **Eksportuj do PDF…** | Okno eksportu do pliku PDF (rozdział „22 Eksport do PDF i PNG”). |
| **Pobierz bieżącą stronę jako PNG** | Obraz otwartej strony w 300 dpi, ze spadem (rozdział „22.5 Strona jako PNG”). |
| **Sprawdź przed drukiem** | Lista miejsc do sprawdzenia w całym projekcie (rozdział „21 Sprawdź przed drukiem”). |
| **Obrazy projektu…** | Wszystkie obrazy projektu (rozdział „8.5 Okno Obrazy projektu”). |
| **Czcionki projektu…** | Zestaw czcionek i własne czcionki (rozdział „6.8 Czcionki”). |
| **Zmień format projektu…** | Nowy format wszystkich sekcji — ze skalowaniem albo przesunięciem elementów (rozdział „11.9 Zmiana formatu ze skalowaniem”). |
| **Zastosuj markę do projektu…** | Kolory i czcionki projektu zamienione na kolory i czcionki marki (rozdział „2.9 Zestaw marki”). |
| **Kolory do druku…** | Kolory dodatkowe (np. Pantone) i tryb kolorów projektu (rozdział „23.1 Kolory dodatkowe”, „23.5 Tryb kolorów projektu”). |
| **Współpraca…** | Zaproszenia do wspólnej pracy (rozdział „25 Współpraca”). |
| **Jasny / ciemny motyw** | Przełącza motyw aplikacji (rozdział „2.4 Motyw”). |

### 4.4 Pasek wstawiania

Pasek nad stroną wstawia nowe elementy (rozdział „5.1 Wstawianie”).

![Pasek wstawiania](https://makietka.app/img/instrukcja/k-wstaw.png)

| Przycisk | Klawisz | Co wstawia |
|---|---|---|
| **Tekst** | `T` | Ramkę tekstu (rozdział „6 Tekst”). |
| **Prostokąt** | `R` | Prostokąt (rozdział „7.1 Prostokąt, elipsa i wielokąt”). |
| **Elipsa** | `E` | Elipsę albo koło (rozdział „7.1 Prostokąt, elipsa i wielokąt”). |
| **Wielokąt** | `P` | Wielokąt albo gwiazdę (rozdział „7.1 Prostokąt, elipsa i wielokąt”). |
| **Linia** | `L` | Odcinek (rozdział „7.2 Linia”). |
| **Obraz** | — | Zdjęcie albo grafikę (rozdział „8.1 Wstawianie obrazu”). |
| **Rysuj** | `B` | Linię rysowaną odręcznie (rozdział „7.3 Rysowanie odręczne”). |
| **Pióro** | `N` | Kształt z punktów i łuków (rozdział „7.4 Pióro i edycja punktów”). |
| **Tabela** | — | Tabelę z wierszami i kolumnami (rozdział „9 Tabela”). |
| **Biblioteka** | — | Gotowe elementy: kształty, strzałki, dymki, ramki, kalendarz miesiąca, wykresy, kolaże zdjęć (rozdział „5.8 Biblioteka”). |

Podpisy pod ikonami włączysz w menu widoku: **Podpisy narzędzi** (rozdział „4.6 Prawy dolny róg i menu widoku”).

### 4.5 Właściwości i warstwy

Prawa kolumna ma dwie części: u góry **właściwości**, pod nimi panel **Warstwy** (rozdział „10 Warstwy”).

Nagłówek właściwości mówi, czego dotyczą ustawienia:

| Nagłówek | Kiedy | Co ustawiasz |
|---|---|---|
| **Zaznaczony element** · rodzaj (np. „Tekst”) | Jest zaznaczony element. | Wygląd i położenie tego elementu. |
| **Ustawienia narzędzia** · nazwa (np. „Rysowanie”) | Włączone jest narzędzie, np. **Rysuj**. Nagłówek ma wtedy tło w kolorze akcentu. | Jak będą wyglądać następne elementy — „Tak będą wyglądać następne linie.” |
| **Nic nie jest zaznaczone** · „Strona” | Nic nie jest zaznaczone. | Ustawienia otwartej strony (rozdział „11.3 Właściwości strony”). |

Przy zaznaczonym elemencie w nagłówku są przyciski **Kopiuj do schowka** (`Ctrl`+`C`), **Duplikuj** (`Ctrl`+`D`), **Kopiuj wygląd** (rozdział „5.13 Kopiuj wygląd (malarz formatów)”), **Zapisz w bibliotece** (rozdział „5.8 Biblioteka”) i **Usuń** (`Delete`). Tytuł części (np. „Cień”) zwija ją i rozwija. Na dole kolumny jest lista **Ostrzeżenia** (rozdział „13.2 Ostrzeżenia”).

![Ustawienia narzędzia: rysowanie](https://makietka.app/img/instrukcja/k-rysowanie.png)

Na telefonie i tablecie w pionie właściwości i warstwy otwierasz osobnymi przyciskami na dole ekranu: **Strony**, **Właściwości**, **Warstwy** i **Ostrzeżenia** (rozdział „28.2 Edytor na telefonie”).

![Właściwości zaznaczonego tekstu](https://makietka.app/img/instrukcja/wlasciwosci.png)

### 4.6 Prawy dolny róg i menu widoku

![Prawy dolny róg](https://makietka.app/img/instrukcja/k-widok.png)

- **Linie pomocnicze** (`W`) — pokazuje albo chowa marginesy, spad, grzbiet i prowadnice (rozdział „13.1 Linie na stronie”).
- **Widok** (ikona kratki) — menu widoku.
- **−**, procent, **+** — powiększenie (rozdział „13.6 Powiększenie”).

Menu widoku:

| Pozycja | Co robi |
|---|---|
| **Siatka** | Linie co zadany krok (rozdział „13.3 Siatka”). |
| **Przyciągaj do siatki** | Przesuwany element staje rogiem na linii siatki. |
| **Krok siatki** | Odstęp linii siatki w mm. |
| **Siatka linii bazowych** | Linie bazowe z ustawień sekcji (rozdział „6.13 Siatka linii bazowych”). |
| **Przyciągaj do elementów i pokazuj odległości** | Różowe linie i odległości w mm przy przesuwaniu (rozdział „13.5 Przyciąganie i odległości”). |
| **Linijki** | Linijki w mm nad stroną i z lewej (rozdział „13.4 Linijki i prowadnice”). |
| **Zablokuj prowadnice** | Prowadnic nie da się złapać myszą. |
| **Usuń prowadnice z tej strony** | Usuwa wszystkie prowadnice otwartej strony. |
| **W rozkładówkach pokazuj jedną stronę** | W sekcji z rozkładówkami pokazuje tylko jedną stronę (rozdział „11.5 Rozkładówki”). |
| **Sprawdzaj pisownię** | Falista czerwona linia pod słowami spoza słownika i część **Pisownia** w panelu tekstu (rozdział „6.16 Sprawdzanie pisowni”). |
| **Pokaż uszlachetnienia** | Efekt lakieru, folii, tłoczenia i bieli na stronie; wyłączony — zwykły widok (rozdział „23.3 Widok uszlachetnień”). |
| **Podpisy narzędzi** | Podpisy pod ikonami paska wstawiania. |
| **Napisy na górnym pasku** | **Auto** — gdy się mieszczą, **Zawsze**, **Nigdy**. |

Ustawienia „Wyglądu edytora” dotyczą tego urządzenia.

![Menu widoku](https://makietka.app/img/instrukcja/k-menu-widoku.png)

## 5. Elementy na stronie

### 5.1 Wstawianie

Kliknij narzędzie na pasku wstawiania (rozdział „4.4 Pasek wstawiania”) — element pojawi się na środku widoku i będzie zaznaczony. Obraz możesz też przeciągnąć z dysku na stronę albo wkleić ze schowka (`Ctrl`+`V`).

Elementy wzorców (rozdział „12 Wzorce”) widać na stronie, ale nie da się ich tu zaznaczyć — zmieniasz je we wzorcu.

![Wstawiony tekst](https://makietka.app/img/instrukcja/wstawianie.png)

### 5.2 Zaznaczanie

- **Kliknięcie** zaznacza element.
- `Shift` + kliknięcie dodaje element do zaznaczenia albo go z niego usuwa.
- **Przeciągnięcie ramki** od pustego miejsca strony zaznacza elementy, których dotknie.
- `Ctrl`+`A` zaznacza wszystkie elementy strony.
- Element leżący pod innym zaznaczysz na liście warstw (rozdział „10 Warstwy”).
- **Kliknięcie dwa razy**: w tekście — pisanie, w grupie — wejście do grupy, w komórce tabeli — pisanie w komórce, w kształcie z pióra — edycja punktów, w obrazie — kadrowanie.
- `Esc` zdejmuje zaznaczenie.

### 5.3 Przesuwanie, rozmiar i obrót

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

### 5.4 Wyrównywanie i równe odstępy

Część **Wyrównaj** we właściwościach:

- **jeden element** — wyrównanie do marginesów strony: do lewej, do środka, do prawej, do góry, do środka w pionie, do dołu,
- **kilka elementów** — wyrównanie do siebie,
- **trzy i więcej** — dodatkowo **Rozłóż równo** w poziomie i w pionie: równe odstępy między elementami.

Przy przesuwaniu element „przykleja się” do krawędzi i środków innych elementów, a strzałki podają odległości w mm (rozdział „13.5 Przyciąganie i odległości”).

![Wyrównywanie kilku elementów](https://makietka.app/img/instrukcja/wyrownanie.png)

### 5.5 Grupy

Zaznacz kilka elementów i wybierz **Zgrupuj** (`Ctrl`+`G`). Grupa przesuwa się, skaluje i obraca jak jeden element. **Rozgrupuj** (`Ctrl`+`Shift`+`G`) rozdziela ją z powrotem.

**Element grupy bez rozgrupowywania:** kliknij grupę dwa razy — grupa się otworzy (pomarańczowa przerywana ramka), a element pod kursorem będzie zaznaczony. Możesz go przesunąć, zmienić we właściwościach albo pisać w nim. Kliknięcie innego elementu grupy zaznacza tamten, `Shift` dodaje kolejne. `Esc`, kliknięcie poza grupą albo **Wróć do całej grupy** ją zamyka.

- W otwartej grupie **Duplikuj** zostawia kopię w grupie, a **Usuń** usuwa tylko zaznaczony element.
- Grupa w grupie otwiera się kolejnym podwójnym kliknięciem; `Esc` wraca o poziom wyżej.

### 5.6 Kolejność, blokada i schowek

- Część **Kolejność**: **Na wierzch**, **Wyżej**, **Niżej**, **Na spód**. To samo zrobisz przeciąganiem na liście warstw (rozdział „10 Warstwy”).
- Część **Inne**: - **Krycie** — przezroczystość elementu w %, - **Zablokuj położenie i rozmiar** — elementu nie przesuniesz przypadkiem; kolor i tekst zmienisz dalej, - **Wycisz ostrzeżenia dla tego obiektu** — np. dla tła, które celowo wychodzi na spad, - **Nazwa** — nazwa elementu na liście warstw.
- **Kopiuj do schowka** i `Ctrl`+`V` na innej stronie wklejają element w to samo miejsce. We właściwościach strony jest też **Wklej skopiowane elementy**.

> **Uwaga:** Usunięcie albo przesunięcie elementu cofniesz **Cofnij** (`Ctrl`+`Z`).

### 5.7 Cień

Część **Cień** działa dla każdego elementu:

| Ustawienie | Znaczenie |
|---|---|
| **Cień pod elementem** | Włącza cień. |
| **Kolor cienia** | Kolor cienia. |
| **Siła** | Jak mocny jest cień (krycie). |
| **W prawo**, **W dół** | Przesunięcie cienia w mm; wartość ujemna przesuwa w lewo albo w górę. |
| **Rozmycie** | Jak miękka jest krawędź cienia, w mm. |

### 5.8 Biblioteka

Wszystkie gotowe elementy są w jednym miejscu: przycisk **Biblioteka** na pasku wstawiania (ostatni z prawej) albo `Ctrl`+`K` i „biblioteka”.

![Biblioteka obok strony](https://makietka.app/img/instrukcja/k-biblioteka.png)

1. Wybierz kategorię u góry albo wpisz słowo w pole **Szukaj** – szukanie przegląda wszystkie kategorie naraz.
2. Kliknij element – stanie na środku bieżącej strony. Na komputerze możesz też przeciągnąć kafelek na stronę: element stanie tam, gdzie go upuścisz.
3. Resztę ustawisz w panelu właściwości, jak przy każdym elemencie.

Na komputerze biblioteka jest panelem obok strony i zostaje otwarta do kolejnych wstawień; na telefonie i tablecie wyjeżdża od dołu i zamyka się po wstawieniu.

| Kategoria | Co w niej jest |
|---|---|
| **Moje elementy** | Elementy zapisane przez Ciebie – na koncie, w każdym projekcie (niżej). |
| **Kształty** | Figury (wielokąty, prostokąt zaokrąglony, pigułka, klepsydra, łuk, etap procesu…), gwiazdy, serca, naklejka ząbkowana, płatek śniegu, chmura, tarcza, liść i proste ikony (dom, pinezka, zegar, ptaszek, koperta, telefon, lupa, prezent, samolot, aparat, kubek, drzewo, krzyż, uwaga, informacja, Wi-Fi…). |
| **Strzałki i dymki** | Strzałki w każdą stronę, na skos, zakręcone, zawracające, w kółko, na cztery strony, obustronne; szewrony, wskaźnik, metki; dymki komiksowe, okrągłe, z lewej, podpis, myśli i krzyku. |
| **Ozdobniki i ramki** | Wstęgi, proporczyki, bilety, zakładki, wstęga narożna, baner zawinięty, odznaka ze wstążkami; ramki (zwykła, falista, okrągła, owalna, zaokrąglona, podwójna, jak odbitka zdjęcia, narożniki). |
| **Linie i separatory** | Linia ciągła, cienka, gruba, przerywana, kropkowana, kreska – kropka, podwójna i pionowa; linie ozdobne (fala, zygzak, z rombem, z sercem, trzy gwiazdki, zawijas…). Rodzaj i grubość zmienisz potem w części **Linia** (rozdział „7.2 Linia”). |
| **Etykiety i plakietki** | Etykiety (zaokrąglona, ze ściętymi rogami, ozdobna), metka z dziurką, plakietka okrągła, pieczątka, znaczek pocztowy, tabliczka z zawieszką — w środek wstaw tekst. |
| **Kalendarze** | Kalendarz miesiąca: zwykły, z miejscem na notatki, z numerami tygodni (rozdział „5.9 Kalendarz miesiąca”). |
| **Planer** | Gotowe tabele do planerów i notesów: lista zadań, tracker nawyków, plan tygodnia, plan dnia (godziny), notatki w linie, siatka dni tygodnia, lista zakupów, cele, budżet, kontakty, plan lekcji; do tego pola wyboru (puste, okrągłe, zaznaczone), notatki w kratkę i w kropki (co 5 mm). |
| **Wykresy** | Słupkowy, poziomy, liniowy, kołowy i pierścieniowy z tabeli danych (rozdział „5.10 Wykres”). |
| **Kolaże zdjęć** | Gotowe układy 2–9 pól na zdjęcia (rozdział „5.11 Kolaż zdjęć”). |
| **Teksty** | Gotowe napisy po łuku, w okręgu (pieczęć), falisty baner, flaga, wypukły tytuł (rozdział „6.14 Tekst po łuku, okręgu i ścieżce; wyginanie”). |
| **Style tekstu** | Style akapitu projektu: kliknięcie nadaje styl zaznaczonemu tekstowi, a bez zaznaczenia wstawia nowy tekst w tym stylu (rozdział „6.4 Style”). |
| **Marka** | Logo z zestawu marki, **Zastosuj markę do projektu…** i **Edytuj zestaw marki…** (rozdział „2.9 Zestaw marki”). |
| **Kody** | Kod QR i kod kreskowy EAN / ISBN (rozdział „5.12 Kod QR i kod kreskowy”). |

Kształt z biblioteki to zwykły kształt: zmienisz mu kolor, obrys i punkty (rozdział „7.4 Pióro i edycja punktów”), a zamknięty kształt może być ramką zdjęcia (rozdział „8.7 Obraz w kształcie”). Szablon z kategorii **Planer** to zwykła tabela (rozdział „9 Tabela”): wpisujesz w komórki, dodajesz wiersze i kolumny, zmieniasz linie i kolory. Żeby planer powtarzał się na wielu stronach, wstaw go we wzorcu (rozdział „12 Wzorce”) albo na stronie serii (rozdział „17 Serie”).

![Kategoria Planer w Bibliotece](https://makietka.app/img/instrukcja/k-biblioteka-planer.png)

**Moje elementy.** Logo, stopkę firmy czy ulubioną ramkę zapiszesz raz i wstawisz w każdym projekcie:

1. Zaznacz element albo kilka elementów (np. logo z podpisem).
2. Kliknij **Zapisz w bibliotece** w nagłówku panelu (przy kilku zaznaczonych — w części **Zaznaczenie**) albo w **⋯** przy elemencie na liście warstw. Paleta poleceń (`Ctrl`+`K`) to dodatek.
3. Wpisz nazwę. Element trafi do kategorii **Moje elementy**.

![Moje elementy w Bibliotece](https://makietka.app/img/instrukcja/k-moje-elementy.png)

- Elementy są na Twoim koncie — jak „Moje czcionki” — więc widać je w każdym projekcie i na każdym urządzeniu.
- Zapisują się razem z obrazami. Wstawienie kopiuje obraz do obrazów projektu (rozdział „8.5 Okno Obrazy projektu”), więc projekt nie zależy od Biblioteki — usunięcie elementu z Biblioteki nie zmienia stron, na których już stoi.
- Ołówek w rogu kafelka zmienia nazwę, kosz usuwa element z Biblioteki.
- Elementów wzorca i tekstu w trakcie pisania nie zapiszesz — najpierw wyjdź z pisania.

### 5.9 Kalendarz miesiąca

Siatka dni jednego miesiąca z nazwą miesiąca i dniami tygodnia. Niedziele i polskie święta – także ruchome: Wielkanoc, Poniedziałek Wielkanocny, Zielone Świątki, Boże Ciało – są wyróżnione kolorem.

![Kalendarz miesiąca i jego ustawienia](https://makietka.app/img/instrukcja/k-kalendarz.png)

| Ustawienie | Co zmienia |
|---|---|
| **Miesiąc**, **Rok** | Pokazany miesiąc. |
| **Miesiąc z kolumny danych** | Na każdej stronie serii inny miesiąc – z kolumny z wartościami typu „2027-03”, „marzec 2027” albo „3” (rok wtedy z **Rok z kolumny**). Tak powstaje kalendarz na 12 miesięcy z jednej strony-wzoru (rozdział „17 Serie”). |
| **Tydzień zaczyna się od** | Poniedziałku albo niedzieli. |
| **Nazwy dni** | Pełne, skrócone albo same litery. |
| **Dni innych miesięcy** | Wyszarzone, jak zwykłe dni albo ukryte. |
| **Nazwa miesiąca nad dniami**, **Numery tygodni** | Dodatkowy wiersz i kolumna. |
| **Miejsce na notatki** | Data w rogu, wyższe kratki do pisania. |
| **Polskie święta**, **Nazwa święta pod datą** | Wyróżnienie świąt i ich nazwy w kratkach. |
| **Święta z tabeli danych** | Własne dni (urodziny, imieniny, terminy) z tabeli: kolumna z datą („2027-05-26”, „26.05.2027” albo „26.05” – co roku) i kolumna z nazwą. |
| **Kolory kalendarza** | Dni, nazwy, niedziele, soboty, święta, dni innych miesięcy. |

Linie, tła wierszy, czcionkę i wyrównanie zmieniasz jak w tabeli (rozdział „9.5 Linie i tła”). Daty układa aplikacja – w kratkach kalendarza się nie pisze.

### 5.10 Wykres

Wykres rysuje liczby z tabeli danych projektu (rozdział „15 Tabele danych”) i zmienia się sam, gdy zmienisz dane.

![Wykres słupkowy i jego ustawienia](https://makietka.app/img/instrukcja/k-wykres.png)

| Ustawienie | Co zmienia |
|---|---|
| **Rodzaj** | Słupkowy, poziomy, liniowy, kołowy, pierścieniowy. |
| **Tabela danych**, **Podpisy z kolumny**, **Liczby z kolumn** | Skąd wykres bierze dane; każda zaznaczona kolumna liczb to osobna seria (osobny kolor). |
| **Wiersze** | Wszystkie, wybrane (od–do) albo **wiersz strony serii** – na każdej powielonej stronie wykres z jej wiersza. |
| **Tytuł**, **Liczby przy słupkach**, **Oś**, **Linie siatki**, **Legenda** | Co widać na wykresie. |
| **Szerokość**, **Wysokość**, **Czcionka**, **Rozmiar pisma**, **Kolory** | Wygląd. Uchwyty zmieniają rozmiar wykresu, nie wielkość pisma. |

Liczby w komórkach mogą mieć przecinek, spacje i znak %.

### 5.11 Kolaż zdjęć

Kolaż to gotowy układ pól na zdjęcia. Upuść zdjęcie z komputera na pole – trafi do tego pola. Możesz też kliknąć kolaż dwa razy, wybrać pole i w części **Obraz w kształcie** wstawić obraz z projektu (rozdział „8.7 Obraz w kształcie”).

W panelu kolażu zmienisz **Układ** (pola przybywają albo ubywają, zdjęcia w pierwszych polach zostają), **Odstęp między zdjęciami**, **Zaokrąglenie rogów**, **Szerokość** i **Wysokość**.

### 5.12 Kod QR i kod kreskowy

Kod wstawisz z **Biblioteka** (kategoria **Kody**) albo z palety poleceń: `Ctrl`+`K` (na Macu `⌘`+`K`) i **Wstaw kod QR** albo **Wstaw kod kreskowy EAN / ISBN**. W części **Kod** panelu ustawisz wszystko inne:

| Ustawienie | Co znaczy |
|---|---|
| **Rodzaj** | **Kod QR** albo **Kod kreskowy EAN-13 / ISBN** (np. ISBN na okładce książki). |
| **Co zawiera** (QR) | **Adres strony**, **Tekst**, **E-mail** (adres, temat, treść), **Telefon** albo **Sieć Wi-Fi** (nazwa, zabezpieczenie, hasło) — pola zmieniają się z wyborem. |
| **Korekcja błędów** (QR) | Ile kodu może być zniszczone albo zasłonięte: od **Niska (7%)** — najmniejszy kod — do **Najwyższa (30%)**, np. pod logo. |
| **Numer EAN albo ISBN** | 12 cyfr — cyfra kontrolna dopisze się sama; 13 cyfr — sprawdzi się. ISBN możesz wpisać z myślnikami; stary ISBN-10 zamieni się na ISBN-13. **Cyfry pod kodem** włącza napis. |
| **Rozmiar** / **Szerokość** i **Wysokość** | Kod QR jest zawsze kwadratem. **Rozmiar nominalny (100%)** ustawia kod EAN na 37,29 × 25,93 mm. Rozmiar zmienisz też uchwytem. |
| **Kolor kodu**, **Tło** | Kod musi być ciemny na jasnym tle; tło może być przezroczyste. |
| **Margines ciszy** | Pusty pas wokół kodu, którego potrzebuje czytnik. |

Pole z danych w treści — np. `{adres}` albo `{isbn}` — daje inny kod na każdej stronie serii (rozdział „16 Pola w tekście”).

Kod jest wektorowy: ostry w każdym powiększeniu i w PDF. Pod panelem i w **Sprawdź przed drukiem** pojawi się uwaga, gdy kod będzie za mały (moduł QR mniejszy niż 0,33 mm, EAN mniejszy niż 80% nominału), za jasny albo z błędną treścią.

![Kod QR i jego ustawienia](https://makietka.app/img/instrukcja/k-kod.png)

### 5.13 Kopiuj wygląd (malarz formatów)

Wygląd jednego elementu przeniesiesz na inny jednym kliknięciem — bez przepisywania kolorów i grubości.

**Gdzie:** przycisk **Kopiuj wygląd** (pędzel) w nagłówku panelu właściwości, obok **Kopiuj do schowka** i **Duplikuj**, oraz **⋯** przy elemencie na liście warstw → **Kopiuj wygląd**. Skróty `Ctrl`+`Alt`+`C` / `Ctrl`+`Alt`+`V` to dodatek.

![Kopiuj wygląd w nagłówku panelu](https://makietka.app/img/instrukcja/k-malarz.png)

1. Zaznacz element, który ma już dobry wygląd.
2. Kliknij **Kopiuj wygląd** w nagłówku panelu (pędzel) albo naciśnij `Ctrl`+`Alt`+`C`. Przycisk zostaje wciśnięty, a kursor nad stroną zmienia się w kopiowanie.
3. Kliknij element, który ma dostać ten wygląd. Gotowe — przycisk się wyłącza.

- **Dwa kliknięcia** w **Kopiuj wygląd** — tryb ciągły: klikasz kolejne elementy, aż naciśniesz `Esc` albo klikniesz przycisk jeszcze raz.
- Bez myszy: zaznacz element docelowy i naciśnij `Ctrl`+`Alt`+`V`.
- **Fragment tekstu:** po skopiowaniu wyglądu kliknij tekst dwa razy, zaznacz słowa i kliknij **Kopiuj wygląd** jeszcze raz — wygląd (czcionka, rozmiar, kolor, pogrubienie…) dostanie tylko zaznaczony fragment. Wygląd skopiujesz też z fragmentu: zaznacz w pisanym tekście słowo o dobrym wyglądzie i kliknij **Kopiuj wygląd**.
- W trakcie pisania tekstu skróty `Ctrl`+`Alt` nie działają — na polskiej klawiaturze to polskie litery (`Alt Gr`+`C` = „ć”).

| Skąd → dokąd | Co przechodzi |
|---|---|
| Kształt → kształt | Wypełnienie (także przejście), obrys, grubość i przerywanie obrysu, zaokrąglenie rogów, krycie, cień. |
| Tekst → tekst | Czcionka, rozmiar, pogrubienie, kursywa, kolor, odstępy, wyrównanie, styl, wielkość liter, obrys liter, krycie, cień. Treść zostaje. |
| Obraz → obraz | Filtry, obrys ramki, zaokrąglenie rogów, krycie, cień. |
| Każdy → każdy | Krycie, cień i uszlachetnienia (lakier, folia). |

Wygląd nie przechodzi na tabele, kody, wykresy ani kalendarze — mają własne ustawienia. Każde przeniesienie cofniesz **Cofnij** (`Ctrl`+`Z`).

> **Wskazówka:** Kolory i czcionki, których już użyłeś na innych stronach, są też pod ręką w oknie koloru i na liście czcionek, w części **Użyte w projekcie** (rozdział „6.8 Czcionki”, „7.7 Wybór koloru”).

## 6. Tekst

### 6.1 Pisanie

Wstaw tekst przyciskiem **Tekst** (`T`) i od razu pisz. Istniejący tekst kliknij dwa razy, żeby pisać w nim; `Esc` kończy pisanie. `Enter` zaczyna nowy akapit.

Szerokość ramki zmieniasz bocznymi uchwytami — tekst układa się od nowa, litery się nie rozciągają. Wysokość ramki rośnie razem z tekstem, chyba że ustawisz stałą wysokość (rozdział „6.6 Ramka tekstu”).

![Tekst na stronie](https://makietka.app/img/instrukcja/wstawianie.png)

### 6.2 Wygląd tekstu

Właściwości zaznaczonego tekstu:

| Ustawienie | Znaczenie |
|---|---|
| **Styl** | Zapisany wygląd tekstu (rozdział „6.4 Style”). |
| **Czcionka** | Krój pisma. Na liście zacznij pisać nazwę, żeby ją znaleźć (rozdział „6.8 Czcionki”). |
| **Rozmiar** | W punktach (pt). Kółko z prawej to **kolor tekstu**. |
| **B** **I** **U** **S** | Pogrubienie, kursywa, podkreślenie, przekreślenie. Wyszarzone, gdy czcionka nie ma takiej odmiany. |
| **Wyrównanie** | Do lewej, do środka, do prawej, wyjustowanie. |
| **Interlinia** | Odstęp między wierszami; 1 to pojedynczy. |
| **Odstęp liter** | Rozstrzelenie liter; wartość ujemna ściska tekst. |
| **Wielkość liter** | **AA** — wszystkie wielkie, **aa** — wszystkie małe, **Aᴀ** — kapitaliki: to tylko wygląd, treść zostaje taka, jak ją wpisano. **Aa** — „jak w zdaniu”: zmienia samą treść. |
| **Lista** | Punkty, kreski albo numery przed każdym akapitem (rozdział „6.5 Listy”). |
| **Obrys liter** | Kolor i **Grubość obrysu liter** — kontur wokół każdej litery. |

![Właściwości tekstu](https://makietka.app/img/instrukcja/wlasciwosci.png)

### 6.3 Fragment tekstu

Kliknij tekst dwa razy, zaznacz fragment i zmień go tymi samymi ustawieniami — panel pokaże „Zmieniasz tylko zaznaczony fragment”. Tak pogrubisz jedno słowo albo zmienisz kolor jednej linijki. Wygląd fragmentu z polem (rozdział „16 Pola w tekście”) przechodzi na wstawioną wartość.

### 6.4 Style

**Styl** to zapisany wygląd tekstu, np. „Tytuł”, „Podpis”, „Dymek”. Nadaj go wszystkim tekstom, które mają wyglądać tak samo.

- Lista **Styl** we właściwościach nadaje styl zaznaczonemu tekstowi.
- **Nowy styl** zapisuje wygląd zaznaczonego tekstu pod nową nazwą.
- Gdy zmienisz tekst ze stylem, pojawią się **Aktualizuj styl** — zmienia wszystkie teksty z tym stylem w całym projekcie — i **Przywróć** — wraca do wyglądu ze stylu.
- Styl zapisuje też ustawienia **Składu akapitu** (rozdział „6.9 Skład akapitu”) — np. dzielenie wyrazów dla całego tekstu książki.

**Styl znakowy** to zapisany wygląd fragmentu tekstu, np. „Wyróżnienie” albo „Nazwa własna”.

1. Zaznacz fragment tekstu (kliknij tekst dwa razy i zaznacz słowa).
2. Ustaw jego wygląd (rozdział „6.3 Fragment tekstu”), potem w części **Styl tekstu** wybierz **Nowy styl znakowy z wyglądu zaznaczenia**.
3. Inne fragmenty zaznacz i wybierz styl z listy **Styl znakowy**. Bez zaznaczenia styl dostaje cały tekst.

**Aktualizuj styl znakowy** przenosi wygląd zaznaczenia do stylu — zmienią się wszystkie fragmenty z tym stylem w projekcie. Usunięty styl znakowy nie zmienia wyglądu fragmentów.

### 6.5 Listy

Lista **Lista** we właściwościach tekstu: **Punkty**, **Kreski** albo **Numery**. Znak listy stoi przed każdym akapitem, a dalsze wiersze akapitu równo pod pierwszym. W tekście płynącym przez kilka ramek numery liczą się dalej. Skróty: `Ctrl`+`Shift`+`8` (punkty) i `Ctrl`+`Shift`+`7` (numery).

### 6.6 Ramka tekstu

Część **Ramka tekstu** przydaje się, gdy tekst ma zająć stałe miejsce — np. teksty z danych o różnej długości (rozdział „18.6 Tekst o różnej długości”):

| Ustawienie | Znaczenie |
|---|---|
| **Stała wysokość ramki** | Ramka nie rośnie z tekstem. Wysokość wpisujesz w mm albo zmieniasz górnym lub dolnym uchwytem. |
| **Tekst w pionie** | Do góry, na środku albo do dołu ramki. |
| **Zmniejszaj tekst, gdy się nie mieści** | Czcionka maleje, aż tekst się zmieści — nie poniżej **najmniejszego rozmiaru**. |

Tekst, który mimo to się nie mieści, jest ucinany na dole ramki i trafia na listę ostrzeżeń.

![Ramka o stałej wysokości](https://makietka.app/img/instrukcja/ramka-tekstu.png)

### 6.7 Kolumny i tekst przez kilka ramek

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

### 6.8 Czcionki

Do wyboru są 52 rodziny czcionek z polskimi znakami, które wolno używać w druku komercyjnym: bezszeryfowe do tekstu (np. Inter, Lato, Roboto), wąskie do nagłówków (Oswald, Bebas Neue), szeryfowe (Lora, Merriweather, Playfair Display, EB Garamond), odręczne i ozdobne (Caveat, Pacifico, Dancing Script) oraz maszynowe.

Okno **⋯** → **Czcionki projektu…**:

- pokazuje próbki wszystkich czcionek,
- **Pobierz pliki** przy rodzinie i **Pobierz cały zestaw (ZIP)** — pliki TTF, np. dla drukarni albo grafika,
- **własne czcionki projektu** — pliki TTF, OTF, WOFF albo WOFF2, każda odmiana osobno. Wgrasz je też z listy czcionek: **+ Wgraj własną czcionkę…**. Wgrana czcionka zostaje w „Moich czcionkach” i przyda się w kolejnych projektach.

> **Wskazówka:** Do druku własną czcionkę najlepiej wgrać jako TTF albo OTF, osobny plik dla pogrubienia i kursywy. Inne pliki trafią do PDF jako krzywe — tekst będzie ostry, ale nie da się go zaznaczyć.

![Okno czcionek](https://makietka.app/img/instrukcja/czcionki.png)

Na górze listy **Czcionka** są **Użyte w projekcie** — czcionki z tekstów wszystkich stron, wzorców i stylów, najczęstsze najpierw, z liczbą użyć (np. „Inter · 5×”). Niżej jest pełna lista.

![Użyte w projekcie na liście czcionek](https://makietka.app/img/instrukcja/k-czcionki-uzyte.png)

Gdy masz zestaw marki (rozdział „2.9 Zestaw marki”), nad nimi jest grupa **Marka** — czcionka nagłówków i czcionka tekstu marki.

### 6.9 Skład akapitu

Zwijana część **Skład akapitu** we właściwościach tekstu decyduje o tym, jak tekst łamie się na wiersze. Te same ustawienia zapiszesz w stylu (rozdział „6.4 Style”).

| Ustawienie | Co robi |
|---|---|
| **Dziel wyrazy** | Długie wyrazy dzielą się na końcu wiersza według polskich zasad, z łącznikiem `-`. Wyjustowany tekst nie ma wtedy dziur między słowami. Treść się nie zmienia — łącznik jest tylko na stronie. |
| **Najkrótszy dzielony wyraz** | Krótsze wyrazy nigdy się nie dzielą (domyślnie 5 liter). |
| **Najmniej liter przed łącznikiem / po łączniku** | Ile liter zostaje w wierszu i ile przechodzi dalej (domyślnie po 2). |
| **Spójniki na końcu wiersza** | **a, i, w, z… przechodzą dalej** — pojedyncze **a, i, o, u, w, z** idą do następnego wiersza razem ze słowem, jak w polskim składzie; **także do, na, że…** dotyczy też dwuliterowych. Nowe teksty mają to włączone. |
| **Wdowy i sieroty** | Tekst płynący przez kilka ramek albo kolumn (rozdział „6.7 Kolumny i tekst przez kilka ramek”) nie zostawia samotnego wiersza akapitu na dole ani na górze ramki. Nowe teksty pilnują 2 wierszy. |
| **Wyrównaj do siatki linii bazowych** | Wiersze stają na liniach siatki sekcji (rozdział „6.13 Siatka linii bazowych”). |
| **Nie opływaj innych elementów** | Tekst leży na elementach z oblewaniem, zamiast je opływać (rozdział „6.12 Oblewanie tekstem”) — np. podpis na zdjęciu. |

![Skład akapitu we właściwościach tekstu](https://makietka.app/img/instrukcja/k-sklad-akapitu.png)

### 6.10 Inicjał

Inicjał to powiększona pierwsza litera akapitu, na kilka wierszy. W części **Skład akapitu** wybierz **Inicjał**: **na 2 wiersze** … **na 5 wierszy**. Litera rośnie od górnej krawędzi pierwszego wiersza do linii bazowej ostatniego, a tekst ją opływa. **Czcionka inicjału** i **Kolor inicjału** mogą być inne niż w tekście.

Inicjał dostaje pierwszy akapit tekstu. W tekście płynącym przez kilka ramek — tylko w pierwszej ramce.

![Inicjał, dzielenie wyrazów, tabulatory z kropkami i tekst opływający koło](https://makietka.app/img/instrukcja/sklad.png)

### 6.11 Tabulatory

Klawisz `Tab` w pisanym tekście wstawia tabulator: tekst za nim przeskakuje do najbliższej pozycji. Bez ustawionych pozycji tabulatory stoją co 12,5 mm.

W części **Skład akapitu** **Dodaj tabulator** dodaje pozycję. Każda ma:

| Pole | Znaczenie |
|---|---|
| **Tabulator N** | Pozycja w mm od lewej krawędzi ramki. |
| **Wyrównanie** | **do lewej**, **do środka**, **do prawej** albo **do przecinka** (liczby z przecinkiem jedna pod drugą). |
| **Wypełnienie** | Pusto, kropki, kreski albo linia przed tekstem — np. spis treści „Rozdział 1 . . . . . 12”. |

![Tabulator do prawej z kropkami](https://makietka.app/img/instrukcja/k-tabulatory.png)

### 6.12 Oblewanie tekstem

Zdjęcie, kształt albo grupa może odpychać tekst. Zaznacz element i w części **Inne** wybierz **Oblewanie tekstem**:

| Wartość | Znaczenie |
|---|---|
| **tekst opływa ramkę elementu** | Wiersze kończą się przed prostokątem elementu (albo zaczynają za nim). |
| **tekst opływa kształt** | Dla elipsy, wielokąta i kształtu z pióra — wiersze idą wzdłuż jego brzegu. |
| **tekst przeskakuje pod element** | Obok elementu nie ma tekstu, ciąg dalszy jest pod nim. |

**Odstęp tekstu od elementu** to wolne miejsce wokół elementu (domyślnie 2 mm). Oblewanie działa na wszystkie teksty na stronie — także w trakcie przesuwania elementu. Tekst wybiera tę stronę elementu, po której ma więcej miejsca.

![Oblewanie tekstem w części Inne](https://makietka.app/img/instrukcja/k-oblewanie.png)

### 6.13 Siatka linii bazowych

Siatka linii bazowych ustawia wiersze wszystkich kolumn i stron na tej samej wysokości — jak w książkach, w których wiersze z obu stron kartki pokrywają się pod światło.

1. W ustawieniach sekcji (rozdział „11.4 Ustawienia sekcji”) włącz **Siatka linii bazowych w tej sekcji**: **Odstęp** (zwykle interlinia tekstu podstawowego) i **Pierwsza linia** (mm od górnej krawędzi strony, zwykle górny margines).
2. W menu widoku (rozdział „4.6 Prawy dolny róg i menu widoku”) **Siatka linii bazowych** pokazuje te linie na stronie.
3. Tekstom, które mają stać na siatce, włącz **Wyrównaj do siatki linii bazowych** (rozdział „6.9 Skład akapitu”) — najlepiej w stylu tekstu podstawowego.

### 6.14 Tekst po łuku, okręgu i ścieżce; wyginanie

Zaznacz tekst i w części **Kształt tekstu** panelu wybierz **Kształt**. Gotowe przykłady znajdziesz też w **Biblioteka**, w kategorii **Teksty**.

![Tekst po łuku, w okręgu i wygięty](https://makietka.app/img/instrukcja/k-ksztalt-tekstu.png)

| Kształt | Co robi i co ustawisz |
|---|---|
| **Łuk** | Napis po łuku. **Zgięcie** w %: dodatnie – łuk w górę, ujemne – w dół. **Promień** w mm (0 – dobrany sam). |
| **Okrąg** | Napis dookoła koła, np. pieczęć. **Promień**, **Obrót początku** w stopniach, **Litery**: na zewnątrz (czytane u góry) albo do środka (czytane u dołu). |
| **Elipsa** | Napis dookoła elipsy: **Promień**, **Spłaszczenie**, **Przesunięcie początku**. |
| **Po ścieżce** | Napis po linii dowolnego kształtu ze strony: narysuj linię piórem, kształt albo wstaw go z Biblioteki i wybierz go w **Linia z kształtu na stronie**. Tekst dostaje kopię linii – kształt możesz potem przesunąć, ukryć albo usunąć. Dalej: **Przesunięcie początku**, **Wyrównanie**, **Litery** nad albo pod linią, **Odwróć kierunek**. |
| **Wygięcie** | Litery na prostej linii, wygięte jak: łuk górny, łuk dolny, wypukłość, wklęsłość, fala, flaga albo zwężenie. **Siła wygięcia** w %. |

- Przy łuku i wygięciach pod tekstem jest uchwyt ◆ – przeciągnij go w górę albo w dół, żeby zgiąć tekst mocniej albo słabiej.
- Kliknij tekst dwa razy, żeby go poprawić: w trakcie pisania tekst stoi prosto, a po wyjściu z pisania wraca do kształtu.
- Tekst po kształcie jest jednym wierszem. Czcionka, kolor, obrys liter, odstęp liter, style i pola z danych `{…}` działają jak w zwykłym tekście.
- W PDF litery zostają tekstem z osadzoną czcionką – ostre w każdym powiększeniu.
- **Prosto** przywraca zwykły tekst w ramce o dawnej szerokości.

### 6.15 Znajdź i zamień

**Gdzie:** przycisk **Znajdź i zamień** (lupa) na górnym pasku albo **⋯** → **Znajdź i zamień…** — pierwsza pozycja menu (na telefonie tylko tam). Skróty jako dodatek: `Ctrl`+`F` (na Macu `⌘`+`F`), `Ctrl`+`H` — od razu z polem zamiany, i paleta poleceń (`Ctrl`+`K`).

![Znajdź i zamień obok strony](https://makietka.app/img/instrukcja/k-znajdz.png)

1. Wpisz szukany tekst. Lista pokazuje każde trafienie: stronę albo wzorzec i kawałek tekstu wokół.
2. Kliknij trafienie (albo `Enter` w polu, `Shift`+`Enter` — wstecz) — edytor otworzy tę stronę i zaznaczy znaleziony fragment.
3. Żeby zamienić, wpisz nowy tekst w drugim polu i kliknij **Zamień** (wybrane trafienie) albo **Zamień wszystkie**.

| Opcja | Znaczenie |
|---|---|
| **Wielkość liter** | „Kalendarz” nie znajdzie „kalendarz”. |
| **Całe słowa** | „kot” nie znajdzie „kotka”. |
| **Także w danych** | Szuka też w komórkach tabel danych (rozdział „14 Książka: spis treści, pagina, przypisy, odsyłacze, skorowidz”). |
| **W nazwach stylów** | Szuka też w nazwach stylów akapitu i znakowych (rozdział „6.4 Style”). |

- Szukanie obejmuje wszystkie strony i wzorce, także teksty w grupach.
- Pola w klamrach, np. `{miesiac}`, zostają nietknięte — chyba że wpiszesz klamrę w szukanym tekście.
- Wygląd fragmentów (np. pogrubione słowo) zostaje na swoim miejscu po zamianie.
- **Zamień wszystkie** to jeden krok cofania — **Cofnij** przywraca wszystkie teksty naraz, także przy otwartym panelu.

Na komputerze okno stoi obok strony i zostaje otwarte, możesz więc klikać kolejne trafienia i poprawiać tekst. Na telefonie wyjeżdża od dołu.

### 6.16 Sprawdzanie pisowni

Słowa spoza słownika polskiego są podkreślone falistą czerwoną linią — tylko w edytorze, nigdy w PDF.

![Podpowiedzi przy podkreślonym słowie](https://makietka.app/img/instrukcja/k-pisownia-dymek.png)

**Gdzie:** podpowiedzi są przy samym słowie, a włącznik w menu widoku (**Sprawdzaj pisownię**).

1. Kliknij tekst dwa razy i kliknij (na telefonie stuknij) podkreślone słowo — albo kliknij je prawym przyciskiem myszy. Obok słowa pojawi się dymek z podpowiedziami i **Dodaj do słownika**.
2. Kliknij podpowiedź (np. „wcześniej”) — słowo zmieni się w tym miejscu.
3. Nazwę własną, której słownik nie zna (np. nazwę firmy), dodaj przyciskiem **Dodaj do słownika**. Twój słownik jest na koncie, więc działa w każdym projekcie.

Wszystkie podejrzane słowa zaznaczonego tekstu widać też w panelu, w części **Pisownia** — tam podpowiedź zmienia słowo we wszystkich miejscach tego tekstu.

![Część „Pisownia” w panelu tekstu](https://makietka.app/img/instrukcja/k-pisownia.png)

- Pomijane są pola `{…}`, liczby, słowa z cyframi, adresy stron i e-maile.
- Słownik (z odmianą wyrazów) wczytuje się przy pierwszym tekście, w tle — edytor nie zwalnia.
- Wyłączysz sprawdzanie w menu widoku: **Sprawdzaj pisownię**. Ustawienie dotyczy tego urządzenia.

## 7. Kształty, linie i kolory

### 7.1 Prostokąt, elipsa i wielokąt

**Prostokąt**, **Elipsa** i **Wielokąt** wstawiają kształty z wypełnieniem i obrysem (rozdział „7.5 Wypełnienie”, „7.6 Obrys”). Część **Kształt**:

- prostokąt — **Zaokrąglenie** narożników w mm,
- wielokąt — **Liczba boków** i przełącznik **Gwiazda**.

### 7.2 Linia

**Linia** wstawia odcinek. Część **Linia**: **Kolor**, **Grubość** w mm i **Rodzaj** — ciągła, przerywana, kropkowana albo kreska – kropka (kreski rosną razem z grubością). Z `Shift` linia jest pozioma, pionowa albo pod kątem 45°. Linia rysowana odręcznie i kształt z pióra mają tę samą część, a zamknięty kształt z pióra — także **Wypełnienie**. Gotowe linie (cienka, gruba, przerywana, podwójna, pionowa, ozdobne) są w Bibliotece, w kategorii **Linie i separatory** (rozdział „5.8 Biblioteka”).

### 7.3 Rysowanie odręczne

**Rysuj** (`B`): przeciągaj po stronie jak ołówkiem — drżenie ręki jest wygładzane. Każde pociągnięcie to osobny element. Tryb zostaje włączony, więc narysujesz kilka kresek.

Gdy rysowanie jest włączone, właściwości pokazują **Ustawienia narzędzia · Rysowanie** (rozdział „4.5 Właściwości i warstwy”), część **Pędzel**: **Kolor linii** i **Grubość linii** w mm — tak będą wyglądać następne linie. **Zakończ rysowanie**, `Esc` albo ponowne kliknięcie **Rysuj** kończy rysowanie. Gotową linię zaznaczysz jak każdy element i zmienisz jej kolor i grubość.

![Rysowanie: kolor i grubość pędzla](https://makietka.app/img/instrukcja/k-rysowanie.png)

### 7.4 Pióro i edycja punktów

**Pióro** (`N`) tworzy kształt z punktów:

- kliknięcie stawia punkt narożny, kliknięcie z przeciągnięciem — punkt z łukiem,
- kliknięcie w pierwszy punkt zamyka kształt,
- `Enter` albo podwójne kliknięcie kończy kształt otwarty,
- `Backspace` cofa ostatni punkt, `Esc` porzuca zaczęty kształt.

**Edycja punktów:** kliknij kształt dwa razy albo wybierz **Edytuj punkty**. Przeciągaj punkty, a uchwytami zaznaczonego punktu zmieniaj łuki. Podwójne kliknięcie w linię dodaje punkt, `Delete` usuwa zaznaczony. `Enter` zatwierdza, `Esc` przywraca kształt sprzed edycji. Tak samo zmienisz linię rysowaną odręcznie.

![Edycja punktów](https://makietka.app/img/instrukcja/pioro.png)

### 7.5 Wypełnienie

Część **Wypełnienie i obrys**, lista **Wypełnienie**:

| Wartość | Znaczenie |
|---|---|
| **Brak** | Kształt bez wypełnienia. |
| **Jeden kolor** | Wypełnienie jednym kolorem. |
| **Przejście liniowe** | Kolory przechodzą w jednym kierunku: poziomo, pionowo, po skosie albo pod zadanym **Kątem**. |
| **Przejście kołowe** | Kolory przechodzą od środka na zewnątrz; **Promień** ustala zasięg. |

Pasek przejścia pokazuje kolory. **Dodaj kolor** dokłada kolejny; kliknięcie koloru na pasku pozwala zmienić go i jego położenie w %, **Usuń ten kolor z przejścia** go usuwa.

Każdy kolor przejścia ma pole **Krycie** — np. kolor przechodzący w przezroczystość nad zdjęciem.

![Krycie koloru w przejściu](https://makietka.app/img/instrukcja/k-krycie-przejscia.png)

### 7.6 Obrys

Kolor obrysu i **Grubość obrysu** w mm. Grubość nie zmienia się, gdy powiększasz kształt.

### 7.7 Wybór koloru

Kliknięcie kółka koloru otwiera okno koloru:

- pole nasycenia i jasności oraz suwak barwy,
- **Kod koloru** (np. `#2f5bd3`) do wpisania albo wklejenia,
- **gotowe kolory**,
- **ostatnio używane** kolory,
- **Użyte w projekcie** — kolory wypełnień, obrysów, tekstów (także fragmentów), przejść i teł ze wszystkich stron, wzorców i stylów, najczęstsze najpierw. Po najechaniu widać kod i liczbę użyć, a przy kolorze dodatkowym (rozdział „23.1 Kolory dodatkowe”) — jego nazwę, np. „PANTONE 186 C”.

![Użyte w projekcie w oknie koloru](https://makietka.app/img/instrukcja/k-kolory-uzyte.png)

Gdy masz zestaw marki (rozdział „2.9 Zestaw marki”), nad „Użytymi w projekcie” jest część **Marka** — kolory marki z nazwami (nazwę i kod widać po najechaniu).

![Kolory marki w oknie koloru](https://makietka.app/img/instrukcja/k-marka-kolor.png)

## 8. Obrazy

### 8.1 Wstawianie obrazu

**Obraz** pyta, skąd wziąć obraz:

- **Wgraj z urządzenia** — wybór pliku PNG, JPEG, WebP, GIF albo SVG,
- **Wybierz z obrazów projektu** — obraz, który już jest w projekcie, bez drugiej kopii.

W projekcie bez obrazów od razu otwiera się wybór pliku. Obraz wstawisz też, przeciągając plik na stronę albo wklejając ze schowka (`Ctrl`+`V`) — np. zrzut ekranu albo obraz skopiowany ze strony internetowej.

### 8.2 Kadrowanie

Kliknij obraz dwa razy albo wybierz **Kadruj przeciąganiem**: przesuwasz zdjęcie w ramce i zmieniasz jej brzegi. `Enter` zatwierdza, `Esc` anuluje. To samo liczbami: **Przycięcie (% oryginału)** — **Z góry**, **Z dołu**, **Z lewej**, **Z prawej**.

### 8.3 Właściwości obrazu

| Ustawienie | Znaczenie |
|---|---|
| **Podmień zdjęcie** | Inne zdjęcie w tej samej ramce (rozdział „8.4 Podmiana zdjęcia”). |
| **Obrazy projektu…** | Okno wszystkich obrazów (rozdział „8.5 Okno Obrazy projektu”). |
| Opis pod nagłówkiem | Wymiary oryginału w pikselach i rozdzielczość w tym rozmiarze (dpi). Do druku — co najmniej 300 dpi; przy mniejszej opis zmienia kolor. |
| **Obrys** | Ramka wokół zdjęcia: kolor i grubość. |
| **Odbij lustrzanie w poziomie** | Odwraca obraz. |
| **Obraz z danych** | Inny obraz na każdej powielonej stronie (rozdział „18.5 Obraz z danych”). |

### 8.4 Podmiana zdjęcia

**Podmień zdjęcie** (na górze właściwości obrazu) wstawia inny plik w tę samą ramkę: rozmiar, miejsce, obrót, obrys i cień zostają. Zdjęcie o innych proporcjach wypełnia ramkę, a nadmiar jest przycięty.

### 8.5 Okno Obrazy projektu

**⋯** → **Obrazy projektu…** pokazuje wszystkie obrazy projektu: miniaturę, pełną nazwę pliku, wymiary, rozmiar i miejsca użycia (numery stron, wzorce, tabele danych).

| Przycisk | Co robi |
|---|---|
| **Wgraj obrazy…** | Dodaje pliki z urządzenia, kilka naraz — także archiwum ZIP z obrazami. |
| **Kopiuj nazwę** | Kopiuje nazwę pliku, np. do tabeli danych. |
| **Zmień nazwę** | Nowa nazwa; komórki tabel z tą nazwą zmieniają się razem z nią. |
| **Podmień plik** | Nowy plik w miejsce starego — wszędzie, gdzie obraz był użyty. |
| **Usuń** | Usuwa zaznaczone obrazy. Użytych obrazów aplikacja nie usunie — powie, gdzie są. |
| **Usuń nieużywane** | Usuwa obrazy, których nic nie używa. |

Kliknięcie obrazu go zaznacza; `Ctrl` dodaje kolejne, `Shift` — cały zakres. Ten sam plik wgrany drugi raz nie tworzy kopii. Inny plik o tej samej nazwie — aplikacja pokaże oba obrazy i zapyta: **Zastąp** albo **Zachowaj oba**.

> **Uwaga:** Usuniętego obrazu nie przywróci **Cofnij**.

![Obrazy projektu](https://makietka.app/img/instrukcja/obrazy-projektu.png)

### 8.6 Rysunki SVG

Plik SVG wstawia się jako obraz: wygląda wiernie i zostaje ostry w każdym powiększeniu, ale nie zmienisz w nim kolorów ani napisów.

**Rozłóż rysunek na elementy** (we właściwościach obrazu) zamienia go na stronie w **grupę zwykłych kształtów i napisów** w tym samym miejscu. Kształtom zmienisz kolor i punkty, napisy poprawisz jak każdy tekst. Plik SVG nie zmienia się i zostaje w oknie obrazów projektu.

Elementy, których edytor nie ma (filtry, maski, wzory), przy rozkładaniu znikają — wtedy zostaw rysunek jako obraz. `Ctrl`+`Z` przywraca obraz.

![Rysunek SVG przed i po rozłożeniu](https://makietka.app/img/instrukcja/rysunek-svg.png)

### 8.7 Obraz w kształcie

Każdy kształt może być ramką obrazu: prostokąt, elipsa, wielokąt, gwiazda i zamknięty kształt z pióra.

1. Zaznacz kształt i w części **Obraz w kształcie** wybierz **Wstaw obraz do kształtu** — albo upuść plik obrazu prosto na kształt.
2. Obraz wypełnia kształt i jest przycięty do jego brzegów.
3. Kliknij kształt dwa razy, żeby przesunąć obraz i powiększyć go narożnikami; `Enter` zatwierdza, `Esc` anuluje. Na telefonie użyj pól **Powiększenie** i **Przesunięcie**.

![Kształt z obrazem i część „Obraz w kształcie”](https://makietka.app/img/instrukcja/k-obraz-w-ksztalcie.png)

![Kadrowanie obrazu w kształcie: cały obraz półprzezroczyście, kształt jako obrys](https://makietka.app/img/instrukcja/obraz-w-ksztalcie-kadr.png)

Kształt zmieniasz jak zwykle — rozmiar, punkty, obrys, cień — a obraz idzie za nim. **Wyjmij obraz** zostawia zwykły obraz w miejscu kształtu. Na stronach z danymi wybierz **Obraz z kolumny**: na każdej stronie pojawi się inny obraz.

Zdjęcie zamienisz w kształt jednym kliknięciem: w części **Kadrowanie** **Zaokrąglone rogi** albo **Koło**. Zaokrąglenie zmienisz potem w części **Wypełnienie i obrys**.

### 8.8 Usuwanie tła

Zaznacz zdjęcie (albo kształt z obrazem) i wybierz **Usuń tło…**.

| Narzędzie | Co robi |
|---|---|
| **Różdżka** | Kliknij tło — znika kolor podobny do klikniętego. **Tolerancja** mówi, jak podobny. |
| **Tylko połączone z klikniętym miejscem** | Nie rusza takich samych kolorów w środku zdjęcia. |
| **Usuń** / **Przywróć** | Pędzle do poprawek brzegów, myszą albo palcem. |
| **Wygładzenie krawędzi** | Zmiękcza brzeg. |

**Zapisz jako nowy obraz** dodaje nowy plik do obrazów projektu i wstawia go w miejsce starego; oryginał zostaje.

![Okno „Usuń tło”](https://makietka.app/img/instrukcja/usun-tlo.png)

### 8.9 Filtry

W części **Filtry** zdjęcia albo obrazu w kształcie ustawisz **jasność**, **kontrast**, **nasycenie** i **rozmycie** oraz włączysz **odcień szarości** albo **sepię**. Plik się nie zmienia; **Bez filtrów** wraca do oryginału.

![Filtry obrazu](https://makietka.app/img/instrukcja/k-filtry.png)

## 9. Tabela

### 9.1 Wstawianie tabeli

**Tabela** otwiera okno **Wstaw tabelę**:

| Pole | Znaczenie |
|---|---|
| **Wiersze** | Liczba wierszy (1–60). |
| **Kolumny** | Liczba kolumn (1–12). |
| **Najmniejsza wysokość wiersza (mm)** | Wiersz nie będzie niższy; rośnie, gdy tekst się nie mieści. |
| **Pierwszy wiersz to nagłówek** | Pierwszy wiersz pogrubiony, z grubszą linią pod spodem. |

Tabelę przesuwasz, powiększasz i obracasz w całości, jak każdy element. **Pojedyncze kliknięcie komórki** zaznaczonej tabeli wybiera tę komórkę (rozdział „9.3 Wiersze, kolumny i ich rozmiar”), **dwukrotne** — zaczyna w niej pisanie (rozdział „9.2 Pisanie w komórkach”).

![Tabela](https://makietka.app/img/instrukcja/tabela.png)

### 9.2 Pisanie w komórkach

Kliknij komórkę dwa razy, żeby w niej pisać. `Tab` przechodzi do następnej komórki, `Shift`+`Tab` do poprzedniej; `Tab` w ostatniej komórce dodaje wiersz. Komórka to zwykły tekst: pogrubisz w niej fragment, zmienisz czcionkę, wstawisz pole z danych (rozdział „16 Pola w tekście”). Wiersz rośnie razem z tekstem — także na stronach powielonych z danych.

### 9.3 Wiersze, kolumny i ich rozmiar

Ustawienia tabeli są w trzech częściach właściwości.

**Cała tabela** — dotyczy wszystkich wierszy i kolumn:

| Ustawienie | Znaczenie |
|---|---|
| **Wiersze** **−** **+** | **Usuń ostatni wiersz**, **Dodaj wiersz na końcu**. |
| **Kolumny** **−** **+** | **Usuń ostatnią kolumnę**, **Dodaj kolumnę na końcu**. |
| **Pierwszy wiersz to nagłówek** | Pierwszy wiersz pogrubiony, z grubszą linią pod spodem. |
| **Szerokość tabeli** | W mm; kolumny zmieniają się proporcjonalnie. |
| **Wysokość wierszy** | Najmniejsza wysokość każdego wiersza; wiersz rośnie sam, gdy tekst się nie mieści. |
| **Wyrównaj szerokości kolumn** | Wszystkie kolumny równej szerokości. |

![Cała tabela](https://makietka.app/img/instrukcja/k-tabela-cala.png)

**Kolumna i wiersz** — kliknij raz komórkę zaznaczonej tabeli. Część pokazuje „Komórka: kolumna 2, wiersz 3” i ustawienia tej kolumny i tego wiersza:

| Ustawienie | Znaczenie |
|---|---|
| **Szerokość kolumny N** | Szerokość tej kolumny w mm. |
| **Kolumna przed**, **Kolumna po**, **Usuń kolumnę** | Wstawia kolumnę przed tą albo po niej, usuwa tę kolumnę. |
| **Wysokość wiersza N** | Najmniejsza wysokość tego wiersza w mm. |
| **Wiersz nad**, **Wiersz pod**, **Usuń wiersz** | Wstawia wiersz nad tym albo pod nim, usuwa ten wiersz. |

To samo masz w trakcie pisania w komórce.

![Kolumna i wiersz wybranej komórki](https://makietka.app/img/instrukcja/k-tabela-komorka.png)

**Szerokości wszystkich kolumn** (część zwinięta) — szerokość każdej kolumny w mm, jedna pod drugą.

Granicę kolumn przesuniesz też myszą: przy zaznaczonej tabeli nad granicami kolumn są niebieskie znaczniki. Kolumna obok zwęża się o tyle samo, a ostatni znacznik zmienia szerokość całej tabeli.

### 9.4 Scalanie komórek

W trakcie pisania w komórce: **Scal z komórką po prawej** i **Scal z komórką poniżej**. Klikając kilka razy, zrobisz komórkę na kilka kolumn albo wierszy. **Rozdziel komórkę** wraca do pojedynczych komórek.

### 9.5 Linie i tła

| Część | Co ustawisz |
|---|---|
| **Linie tabeli** | Kolor i grubość linii (0 — bez linii). |
| **Linie wiersza, kolumny, tabeli** | Które linie — zewnętrzne, poziome, pionowe — dla tego wiersza, tej kolumny albo całej tabeli. |
| **Linie tej komórki** | Każda krawędź komórki osobno: jak w tabeli, inna albo bez linii. |
| **Tło wierszy** | Kolor wiersza nagłówka i co drugiego wiersza (tabela w paski). |
| **Tekst w komórkach** | Czcionka, rozmiar, kolor, wyrównanie i odstęp od brzegu komórki. |

## 10. Warstwy

### 10.1 Panel Warstwy

Panel **Warstwy** pokazuje wszystkie elementy otwartej strony, od leżącego na wierzchu do leżącego na spodzie. Widać go zawsze — niezależnie od tego, czy coś jest zaznaczone i czy włączone jest narzędzie.

- **Na komputerze** panel stoi w prawej kolumnie, pod właściwościami. Nagłówek „Warstwy” z liczbą elementów zwija go i rozwija; zwinięcie zostaje zapamiętane.
- **Na telefonie i tablecie w pionie** panel otwiera przycisk **Warstwy** na dole ekranu.

![Warstwy](https://makietka.app/img/instrukcja/warstwy.png)

### 10.2 Wiersz warstwy

| W wierszu | Co robi |
|---|---|
| **Nazwa** | Kliknięcie zaznacza element, podwójne kliknięcie zmienia nazwę. |
| **Uchwyt ⋮⋮** | Przeciągnij wiersz, żeby zmienić kolejność — myszą albo palcem. |
| **Oko** | Ukrywa element. Ukryty element nie jest drukowany. |
| **Kłódka** | Blokuje położenie i rozmiar. |
| **⋯** | **Na wierzch**, **Wyżej**, **Niżej**, **Na spód**, **Zmień nazwę**, **Kopiuj wygląd** (rozdział „5.13 Kopiuj wygląd (malarz formatów)”), **Zapisz w bibliotece** (rozdział „5.8 Biblioteka”). |

Zaznaczenie na liście przydaje się, gdy element leży pod innym i trudno w niego trafić na stronie.

### 10.3 Grupy, tabele i wzorce na liście

- Trójkąt przy grupie albo tabeli rozwija jej zawartość. Kliknięcie elementu grupy otwiera grupę z tym elementem zaznaczonym (rozdział „5.5 Grupy”); kliknięcie komórki tabeli zaczyna w niej pisanie.
- Na górze i na dole listy są elementy wzorców strony (nad treścią i pod treścią). Nie zmienisz ich tutaj — kliknięcie otwiera wzorzec do edycji (rozdział „12.3 Edycja wzorca”).

## 11. Strony, sekcje i rozkładówki

### 11.1 Panel stron

Panel z lewej pokazuje miniatury wszystkich stron w kolejności druku, pogrupowane w sekcje (szare nagłówki). Kliknięcie miniatury otwiera stronę. Strona powielana z danych ma znaczek **×N** — tyle razy wyjdzie w wydruku (rozdział „17 Serie”).

Na telefonie strony stoją w poziomym pasku, który przewijasz palcem: nazwa sekcji to wąska etykieta z **⋯**, a miniatury mają całą wysokość paska — okładka w poziomie jest szeroka, strony w pionie wąskie.

![Pasek stron na telefonie](https://makietka.app/img/instrukcja/k-strony-telefon.png)

![Panel stron z menu strony](https://makietka.app/img/instrukcja/strony.png)

### 11.2 Dodawanie i porządkowanie stron

- Kafelek **+** na końcu stron sekcji dodaje pustą stronę za bieżącą.
- **+ Sekcja** na dole panelu tworzy nową sekcję.
- **Przeciągnij miniaturę**, żeby zmienić kolejność; upuszczona w innej sekcji przechodzi do niej.
- **⋯** na miniaturze: **Zmień nazwę**, **Duplikuj**, **Przesuń wyżej**, **Przesuń niżej**, **Usuń stronę**.
- **⋯** przy nagłówku sekcji: **Ustawienia sekcji**, **Dodaj stronę do sekcji**, **Przesuń sekcję wyżej**, **Przesuń sekcję niżej**, **Usuń sekcję**.

Usunięcie albo przesunięcie strony cofniesz przyciskiem **Cofnij** w komunikacie na dole ekranu albo `Ctrl`+`Z`.

### 11.3 Właściwości strony

Gdy nic nie jest zaznaczone, panel właściwości pokazuje ustawienia otwartej strony:

| Ustawienie | Znaczenie |
|---|---|
| **Nazwa strony** | Nazwa na liście stron. |
| **Sekcja** | Przeniesienie strony do innej sekcji. |
| **Tło** | Kolor tła tej strony. |
| **Wzorce** | Wzorce z sekcji albo własny wybór dla tej strony (rozdział „12.2 Okno Wzorce”). |
| **Seria** | Powielanie strony z tabeli danych (rozdział „17 Serie”). |
| **Prowadnice** | Prowadnice wpisane liczbą (rozdział „13.4 Linijki i prowadnice”). |
| **Wklej skopiowane elementy** | Wkleja elementy ze schowka w to samo miejsce. |

![Ustawienia strony: seria](https://makietka.app/img/instrukcja/k-seria.png)

### 11.4 Ustawienia sekcji

Sekcja to część publikacji z własnymi ustawieniami, np. „Okładka” i „Środek”. Okno otworzysz przyciskiem formatu na górnym pasku albo **⋯** przy nagłówku sekcji → **Ustawienia sekcji**.

| Ustawienie | Znaczenie |
|---|---|
| **Nazwa sekcji** | Nazwa na liście stron. |
| **Układ stron** | **Pojedyncze** albo **Rozkładówki** (rozdział „11.5 Rozkładówki”). |
| **Rodzaj sekcji** | **Strony** albo **Okładka z grzbietem** — wtedy wymiary liczą się same (rozdział „11.6 Okładka z grzbietem”). |
| **Format** | Rozmiar strony; **Szerokość (mm)** i **Wysokość (mm)**. Przycisk **Zamień orientację** (kartka ze strzałką) zamienia szerokość z wysokością. Zmiana tutaj nie rusza elementów — żeby przeskalować je razem z formatem, kliknij **Zmień format i dopasuj elementy…** (rozdział „11.9 Zmiana formatu ze skalowaniem”). |
| **Marginesy i spad** | Na schemacie strony: górny nad kartką, dolny pod nią, wewnętrzny i zewnętrzny po bokach, spad przy przerywanej ramce. Schemat od razu pokazuje proporcje. |
| **Pierwsza strona sekcji** | W rozkładówkach: **Prawa (jak w książce)** albo **Lewa (od razu pełna rozkładówka)**. |
| **Numeracja stron** | **Dalszy ciąg poprzedniej sekcji**, **Zacznij od numeru…** albo **Bez numerów (np. okładka)** (rozdział „11.8 Numeracja stron”). |
| **Składki (pilnuj liczby stron)** | **Bez pilnowania** albo co 4, 8, 16, 32 strony (rozdział „11.7 Składki”). |
| **Wzorce na stronach tej sekcji** | Wzorce domyślne stron sekcji (rozdział „12.2 Okno Wzorce”). |
| **Znaki cięcia w pliku PDF** | Znaki cięcia na stronach tej sekcji w pliku dla drukarni. |
| **Siatka linii bazowych** | **Odstęp** i **Pierwsza linia** (mm od góry) — wiersze tekstów z „Wyrównaj do siatki” stoją na tych liniach (rozdział „6.13 Siatka linii bazowych”). |

![Ustawienia sekcji](https://makietka.app/img/instrukcja/sekcje.png)

### 11.5 Rozkładówki

W sekcji z rozkładówkami strony tworzą pary: lewa i prawa, jak w otwartej książce.

- Lewą i prawą stronę edytujesz **razem**. Nowe elementy trafiają na stronę bieżącą — wybierasz ją kliknięciem w jej obszar.
- Marginesy są **lustrzane**: wewnętrzny przy grzbiecie, zewnętrzny przy krawędzi.
- Element może leżeć **przez grzbiet**, np. zdjęcie na całą rozkładówkę — każda strona wydrukuje swoją część. Element należy do strony, na której leży jego środek.
- Gruba ciemna linia to grzbiet. Tekstu nie kładź tuż przy nim — po zszyciu może go nie być widać; aplikacja ostrzega o elementach, które wystają w pas przy grzbiecie.
- Na małym ekranie w menu widoku włączysz **W rozkładówkach pokazuj jedną stronę**.

![Rozkładówka](https://makietka.app/img/instrukcja/rozkladowki.png)

Na telefonie rozkładówka pokazuje się domyślnie jako jedna strona. Przycisk z dwiema kartkami obok powiększenia (prawy dolny róg, tylko w sekcji z rozkładówkami) przełącza całą rozkładówkę i jedną stronę – to samo co „W rozkładówkach pokazuj jedną stronę” w menu widoku.

### 11.6 Okładka z grzbietem

Okładkę robisz jako osobną sekcję z jedną szeroką stroną: tył, grzbiet i przód. Włączysz ją na trzy sposoby:

- w oknie sekcji: **Rodzaj sekcji** → **Okładka z grzbietem**,
- w menu sekcji (⋯ przy nazwie sekcji): **Zamień na okładkę z grzbietem** — elementy zostają,
- w oknie nowego projektu: pole **Okładka** — przed środkiem powstaje sekcja „Okładka”.

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

Przy wpisanych wymiarach pod schematem widać, co wychodzi z papieru, np. „Z papieru i formatu środka wychodzi: grzbiet 6,6 mm, okładka 352,6 × 246 mm”.

![Wymiary okładki wpisane ręcznie](https://makietka.app/img/instrukcja/k-okladka-wymiary.png)

![Okno sekcji: okładka z grzbietem, schemat i wynik](https://makietka.app/img/instrukcja/k-okladka-okno.png)

Na płótnie przerywane linie pokazują zgięcia (grzbiet, bigi, zawinięcia), a niebieskie ramki — bezpieczne pola tyłu, grzbietu i przodu.

![Okładka na płótnie: tył, grzbiet, przód](https://makietka.app/img/instrukcja/okladka.png)

Gdy w środku przybędzie stron albo zmienisz papier, okładka przelicza się sama: tył zostaje, przód przesuwa się razem z grzbietem, napisy na grzbiecie zostają na jego środku, a tło na całą okładkę się rozciąga. W panelu elementu, w części **Inne**, lista **Na okładce trzyma się** (automatycznie, tyłu, grzbietu albo przodu) mówi, czego element się trzyma; przełącznik **Dopasuj szerokość do grzbietu** rozciąga pasek na grzbiecie na całą jego szerokość. Ostrzeżenie „Szerszy niż grzbiet” mówi, że element zachodzi na tył albo przód.

![Element przypięty do części okładki](https://makietka.app/img/instrukcja/k-okladka-przypiecie.png)

> **Uwaga:** wzorce przypisane do sekcji okładki nie przesuwają się same.

### 11.7 Składki

Środek szyty albo klejony ze składek musi mieć liczbę stron podzielną przez wielkość składki. W ustawieniach sekcji wybierz **Składki**: co 4, 8, 16 albo 32 strony.

Na liście stron pod nazwą sekcji zobaczysz np. „46 z 48 – brakuje 2 do pełnej składki (×16)”. **Dopełnij pustymi** dodaje brakujące puste strony na końcu sekcji — cofniesz to jak każdą zmianę. **Sprawdź przed drukiem** też przypomni o niepełnej składce, a przy oprawie zeszytowej — o liczbie stron niepodzielnej przez 4.

![Licznik składki i „Dopełnij pustymi”](https://makietka.app/img/instrukcja/k-skladki.png)

### 11.8 Numeracja stron

Numer strony wstawisz polem `{nr}` — najlepiej we wzorcu, żeby był na każdej stronie (rozdział „12.6 Numer strony we wzorcu”). Numeracja zależy od ustawień sekcji (rozdział „11.4 Ustawienia sekcji”) i liczy strony po powieleniu serii. Inne zapisy numeru (rzymskie, z zerami) są w tabeli pól (rozdział „16.2 Pola dokumentu”).

### 11.9 Zmiana formatu ze skalowaniem

Kalendarz z A4 na A3, książka z B5 na A5 — format zmienisz razem z elementami:

- jedna sekcja: okno sekcji (rozdział „11.4 Ustawienia sekcji”) → **Zmień format i dopasuj elementy…**,
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

Rozkładówki zmieniają się razem (obie strony), serie — na wszystkich powieleniach, bo zmienia się wzór. Okładka z grzbietem (rozdział „11.6 Okładka z grzbietem”) ma format liczony ze środka: po zmianie formatu środka przelicza się sama, a jej elementy trzymają się tyłu, grzbietu i przodu. Elementy, które po zmianie wystają poza stronę, pokaże **Sprawdź przed drukiem** (rozdział „21 Sprawdź przed drukiem”).

## 12. Wzorce

### 12.1 Czym jest wzorzec

Wzorzec to elementy wspólne dla wielu stron: tło, ramka, logo, stopka, numer strony. Rysujesz go raz i dodajesz do stron albo do całej sekcji. Zmiana we wzorcu zmienia wszystkie te strony naraz. Strona może mieć kilka wzorców, np. „Tło miesiąca” i „Stopka”.

### 12.2 Okno Wzorce

Kliknij **Wzorce** na górnym pasku.

![Wzorce na górnym pasku](https://makietka.app/img/instrukcja/k-wzorce.png)

Lista **Wzorce w tym projekcie** — przy każdym wzorcu:

| Przycisk | Co robi |
|---|---|
| **+ Dodaj do tej strony** | Włącza wzorzec na otwartej stronie. Ponowne kliknięcie (✓) go zdejmuje. |
| **+ Do całej sekcji** | Włącza wzorzec na stronach sekcji, które nie mają własnego wyboru. |
| **Edytuj** | Otwiera wzorzec do edycji (rozdział „12.3 Edycja wzorca”). |
| **⋯** | **Zmień nazwę**, **Duplikuj**, **Przesuń wyżej**, **Przesuń niżej**, **Usuń wzorzec**. |

**Nowy pusty wzorzec** tworzy czysty wzorzec.

![Okno Wzorce](https://makietka.app/img/instrukcja/okno-wzorcow.png)

### 12.3 Edycja wzorca

**Edytuj** otwiera wzorzec w edytorze. Fioletowy pasek nad stroną przypomina, że zmieniasz wzorzec; **Gotowe** wraca do stron. Na zwykłych stronach elementów wzorca nie da się zaznaczyć — widać je na liście warstw, a kliknięcie tam otwiera wzorzec.

![Edycja wzorca](https://makietka.app/img/instrukcja/wzorce.png)

### 12.4 Wzorce standardowe

Niżej w oknie są gotowe **wzorce standardowe**: numer strony na dole albo przy zewnętrznej krawędzi, stopka, nagłówek, linie do pisania, kratka, ramka, zakładka na brzegu. Dopasowują się do formatu i marginesów sekcji. Przycisk **+** (na telefonie **Dodaj**) dodaje wzorzec do projektu — potem zmieniasz go jak własny.

### 12.5 Nad treścią i odbicie lustrzane

Elementy wzorca leżą **pod** treścią strony. Zaznacz element we wzorcu i włącz:

- **Nad treścią strony** — element przykryje treść, np. ramka albo znak wodny,
- **Odbijaj lustrzanie na lewych stronach** — element przy prawej krawędzi (np. numer strony) na lewych stronach rozkładówek przejdzie na lewą krawędź.

### 12.6 Numer strony we wzorcu

Wpisz we wzorcu tekst z polem `{nr}`, np. `Strona {nr} z {liczba_stron}`. Na każdej stronie pojawi się jej numer. Najprościej dodać wzorzec standardowy z numerem strony (rozdział „12.4 Wzorce standardowe”).

## 13. Linie pomocnicze, siatka i powiększenie

### 13.1 Linie na stronie

Linie pomocnicze nie są drukowane:

| Linia | Znaczenie |
|---|---|
| **Czerwona** | Krawędź strony po przycięciu. |
| **Różowy pas** | Spad. Tła i zdjęcia, które mają sięgać krawędzi, rozciągnij aż do jego końca. |
| **Niebieska przerywana** | Margines. Teksty trzymaj w środku. |
| **Gruba ciemna** | Grzbiet rozkładówki. |
| **Przerywane z podpisami** | Na okładce: zgięcia — grzbiet, bigi, zawinięcia (rozdział „11.6 Okładka z grzbietem”). |
| **Turkusowa** | Prowadnica (rozdział „13.4 Linijki i prowadnice”). |

**Linie pomocnicze** (`W`) w prawym dolnym rogu chowa je wszystkie.

### 13.2 Ostrzeżenia

Element w marginesie albo poza spadem, tekst, który się nie mieści, czy pole z literówką dostają pomarańczową ramkę i trafiają na listę **Ostrzeżenia** na dole panelu z prawej (na telefonie — przycisk na dole ekranu). Kliknięcie pozycji zaznacza element. Gdy to celowe (np. tło na spad), kliknij **Wycisz**.

![Ostrzeżenia](https://makietka.app/img/instrukcja/ostrzezenia.png)

### 13.3 Siatka

W menu widoku (rozdział „4.6 Prawy dolny róg i menu widoku”): **Siatka** pokazuje linie co **Krok siatki** (w mm, od rogu strony), a **Przyciągaj do siatki** ustawia lewy górny róg przesuwanego elementu na linii siatki.

![Siatka i prowadnice](https://makietka.app/img/instrukcja/siatka.png)

### 13.4 Linijki i prowadnice

- **Linijki** pokazują milimetry; zero leży w rogu otwartej strony.
- **Prowadnicę** wyciągniesz z linijki: z górnej w dół — poziomą, z lewej w prawo — pionową. Prowadnicę można przesunąć; wyciągnięta poza stronę znika.
- We właściwościach strony część **Prowadnice** pozwala wpisać położenie liczbą i dodać prowadnicę pionową albo poziomą.
- **Zablokuj prowadnice** w menu widoku chroni je przed przypadkowym przesunięciem.

### 13.5 Przyciąganie i odległości

Przy przesuwaniu i zmianie rozmiaru element przyciąga się do krawędzi, marginesów i środka strony, do prowadnic i do innych elementów:

- **różowa linia** — krawędź albo środek zrównały się z innym elementem,
- **strzałki z liczbą** — odległość w mm do najbliższych elementów,
- **fioletowe liczby** — odstęp jest równy innemu odstępowi w rzędzie.

Przytrzymany `Ctrl` na chwilę wyłącza przyciąganie. Przytrzymany `Alt` przy zaznaczonym elemencie pokazuje też odległości do krawędzi strony.

![Równe odstępy](https://makietka.app/img/instrukcja/odleglosci.png)

### 13.6 Powiększenie

- **−** i **+** w prawym dolnym rogu; kliknięcie procentu dopasowuje stronę do okna (`Ctrl`+`0`).
- `Ctrl` + kółko myszy powiększa w miejscu kursora.
- Spacja + przeciąganie przesuwa widok.
- Na telefonie i tablecie — dwa palce (rozdział „28.1 Gesty”).

## 14. Książka: spis treści, pagina, przypisy, odsyłacze, skorowidz

### 14.1 W skrócie

Rzeczy potrzebne w książce, które aplikacja liczy sama: spis treści z numerami stron, tytuł rozdziału w stopce, przypisy dolne, odsyłacze „zob. s. 12” i skorowidz. Numery stron biorą się z numeracji sekcji (rozdział „11.8 Numeracja stron”), także ze stronami powielonymi serią (rozdział „17 Serie”).

![Spis treści, przypis i żywa pagina na stronach książki](https://makietka.app/img/instrukcja/ksiazka.png)

### 14.2 Nagłówki

Nagłówki to teksty w stylach akapitu (rozdział „6.4 Style”), które projekt uznaje za tytuły rozdziałów. Z nich powstają spis treści, żywa pagina i lista odsyłaczy.

- Bez ustawień styl **Tytuł** to nagłówek 1 (rozdział), a **Nagłówek** – nagłówek 2.
- Inne style ustawisz w panelu spisu treści: przy każdym stylu wybierz **nagłówek 1**, **nagłówek 2**, **nagłówek 3** albo **nie jest nagłówkiem**.

> **Wskazówka:** nadaj ten sam styl wszystkim tytułom rozdziałów – wtedy spis treści i pagina ułożą się same.

### 14.3 Spis treści

1. Otwórz **Biblioteka** → **Książka** → **Spis treści** (albo `Ctrl`+`K` i „spis treści”).
2. Spis staje na stronie jako tekst i od razu wypełnia się nagłówkami z numerami stron.
3. Wygląd (czcionkę, rozmiar, interlinię) zmieniasz jak w każdym tekście.

![Spis treści i jego panel](https://makietka.app/img/instrukcja/k-spis-tresci.png)

| Ustawienie | Co robi |
|---|---|
| **Poziomy** | **tylko rozdziały**, **rozdziały i podrozdziały** albo **trzy poziomy**; niższe poziomy są wcięte. |
| **Kropki do numeru strony** | Wypełnia odstęp między tytułem a numerem kropkami. |
| **Styl „…”** | Który styl jest nagłówkiem i jakiego poziomu (rozdział „14.2 Nagłówki”). |
| **Odśwież teraz** | Układa spis od razu. Zwykle nie trzeba – spis odświeża się sam po każdej zmianie. |

Długi spis przelej do kolejnej ramki, także na następnej stronie (rozdział „6.7 Kolumny i tekst przez kilka ramek”). Treści spisu nie wpisuje się ręcznie – przy następnym odświeżeniu ułożyłaby się od nowa.

### 14.4 Żywa pagina

Żywa pagina to tytuł bieżącego rozdziału w stopce albo nagłówku strony.

1. Otwórz wzorzec stopki (rozdział „12 Wzorce”).
2. W tekście stopki wybierz **Wstaw pole** → **{rozdzial}**. Obok możesz dać numer strony: `{rozdzial} – {nr}`.

Na każdej stronie pole pokazuje ostatni nagłówek 1 do tej strony. `{rozdzial:2}` pokazuje nagłówek 2 – nowy rozdział go zeruje.

### 14.5 Przypisy dolne

1. Zaznacz tekst (albo pisz w nim – przypis stanie w miejscu kursora).
2. W panelu, w części **Przypisy, odsyłacze, skorowidz**, wybierz **Wstaw przypis** (albo `Ctrl`+`K` i „przypis”).
3. W polu **Przypis 1** wpisz treść.

![Przypis w panelu i na dole strony](https://makietka.app/img/instrukcja/k-przypisy.png)

- W tekście staje numer w indeksie górnym, a treść – na dole tej samej strony, nad dolnym marginesem, pod krótką kreską. W edytorze widać ją od razu, ale nie da się jej zaznaczyć: zmieniasz ją w panelu.
- Numery liczą się same. **Numeracja przypisów**: **Od nowa w każdej sekcji**, **Od nowa na każdej stronie** albo **W całym projekcie**.
- Tekst płynący przez kilka ramek zabiera przypis ze sobą: przypis jest na tej stronie, na której stoi jego numer.
- Wygląd przypisów: styl akapitu o nazwie **Przypis** (jeśli go nie ma – pismo 8 pt).
- **Usuń przypis** zdejmuje i numer z tekstu, i treść.

### 14.6 Odsyłacze

Odsyłacz to numer strony innego miejsca w książce, np. „zob. s. 12”.

1. Zaznacz tekst, w którym ma stać odsyłacz.
2. W części **Przypisy, odsyłacze, skorowidz** wybierz z listy **Wstaw odsyłacz do** nagłówek.
3. W tekście pojawi się „s. 12” – numer zmienia się sam, gdy strony się przesuną.

W edytorze odsyłacz widać jako pole `{s:…}`; liczbę zobaczysz w podglądzie i w PDF. Gdy nagłówek usuniesz, zamiast numeru stanie „?”, a **Sprawdź przed drukiem** o tym przypomni (rozdział „21 Sprawdź przed drukiem”).

### 14.7 Skorowidz

1. Zaznacz słowo w pisanym tekście.
2. Wybierz **Dodaj do skorowidza** (albo `Ctrl`+`K` i „skorowidz”). Bez zaznaczenia aplikacja zapyta o hasło.
3. Wstaw skorowidz: **Biblioteka** → **Książka** → **Skorowidz**.

Skorowidz ma hasła alfabetycznie (po polsku: ą po a, ł po l) z numerami wszystkich stron, na których słowo występuje w jakimkolwiek tekście – wielkość liter nie ma znaczenia, a kolejne strony łączą się w zakres (3–5). Hasła tekstu widać w panelu jako żetony; kliknięcie żetonu usuwa hasło.

## 15. Tabele danych

### 15.1 Okno Dane

Dane trzymasz w tabelach projektu. Tabela to arkusz: kolumny mają nazwy (np. `dzien`, `imie`), a wiersze — wartości. Z tabel biorą się wartości pól w tekście (rozdział „16 Pola w tekście”) i powielone strony (rozdział „17 Serie”).

Kliknij **Dane** na górnym pasku edytora.

![Dane na górnym pasku](https://makietka.app/img/instrukcja/k-dane.png)

Z lewej jest lista tabel projektu, z prawej wybrana tabela:

| Przycisk | Co robi |
|---|---|
| **+** (Nowa tabela) | Pusta tabela. |
| **Importuj CSV albo Excel** | Tabela z pliku (rozdział „15.2 Import z Excela i CSV”). |
| **Nazwa tabeli** | Kliknij, żeby zmienić. |
| **+ Wiersz**, **+ Kolumna** | Dodają wiersz i kolumnę. |
| **Wiersz pomijany** | Wstawia wiersz `**pomiń**` (rozdział „17.4 Wiersze pomijane”). |
| **Pobierz tabelę jako plik CSV** | Tabela do dokończenia w arkuszu. |
| **Usuń tabelę** | Usuwa tabelę z projektu. |

Zmiany zrobione w jednym otwarciu okna to jeden krok **Cofnij**.

![Okno Dane](https://makietka.app/img/instrukcja/dane.png)

### 15.2 Import z Excela i CSV

**Importuj CSV albo Excel** wczytuje plik `.xlsx`, `.xls`, `.ods` albo `.csv`:

- pierwszy wiersz pliku to nazwy kolumn,
- z pliku Excela powstaje po jednej tabeli na każdy arkusz,
- separator (średnik, przecinek, tabulator) i polskie znaki aplikacja rozpoznaje sama,
- liczby i daty trafiają do tabeli tak, jak je widać w arkuszu. Datę najlepiej rozbić na osobne kolumny, np. `dzien`, `miesiac`, `rok`.

Poprawiłeś dane w arkuszu? Zaimportuj plik jeszcze raz. Gdy w projekcie jest tabela o tej samej nazwie, aplikacja zapyta, czy podmienić jej dane.

### 15.3 Poprawianie danych w aplikacji

- Kliknij komórkę i pisz. `Enter` przechodzi wiersz niżej, `Shift`+`Enter` robi nową linię w komórce.
- Dane skopiowane z Excela albo Arkuszy Google wklejasz od zaznaczonej komórki (`Ctrl`+`V`); tabela sama rośnie w dół i w prawo.
- **×** przy wierszu albo kolumnie usuwa go.
- Nazwę kolumny zmieniasz, klikając nagłówek. Aplikacja poprawi tę nazwę we wszystkich polach projektu.

### 15.4 Wygląd komórek

Pogrubienie, kursywa i kolor liter z pliku Excela przechodzą na strony: wartość wstawiona w pole dostaje wygląd swojej komórki — np. święta pogrubione na czerwono. Przechodzi też wygląd części tekstu w komórce.

W oknie Dane zaznacz komórkę (`Shift`+kliknięcie zaznacza prostokąt kilku komórek) i użyj: **B** — pogrubienie, **I** — kursywa, kolor liter, **Wyczyść wygląd** (gumka).

Przełącznik **Przenoś wygląd komórek na strony** wyłącza przenoszenie — wygląd zostaje zapisany w tabeli.

### 15.5 Pilnowanie wartości

Przy nazwie każdej kolumny są dwa znaki:

| Znak | Co robi |
|---|---|
| **≠** | Wartości w kolumnie nie powinny się powtarzać (np. hasła dnia). Powtórzone komórki są czerwone, a przed drukiem aplikacja poda strony, na których ta sama wartość wypada dwa razy. Wielkość liter i spacje nie mają znaczenia. |
| **☰** | Lista dozwolonych wartości, np. `praca; dom; wolne`. Inne wartości są podświetlone i trafiają na listę przed drukiem; w szablonie danych komórki dostają listę rozwijaną. **Usuń listę** ją usuwa. |

## 16. Pola w tekście

### 16.1 Wstawianie pola

Pole to nazwa kolumny w klamrach, wpisana w zwykły tekst, np. `Imieniny: {imieniny}`. Na gotowej stronie w miejsce pola wchodzi wartość z tabeli.

Zaznacz tekst i wybierz kolumnę z listy **Wstaw pole** we właściwościach. Lista zaczyna się od kolumn tabeli tej strony, dalej są pola dokumentu (rozdział „16.2 Pola dokumentu”). Pole możesz też wpisać ręcznie.

![Wstaw pole](https://makietka.app/img/instrukcja/k-wstaw-pole.png)

W edytorze pola mają fioletowe tło, a pole, którego aplikacja nie zna (np. literówka) — czerwone. Prawdziwe wartości widać na miniaturach, w podglądzie i w PDF.

- Pola z tabeli działają na stronach serii z tą tabelą (rozdział „17 Serie”).
- Pole z tabeli dodatkowej wpisujesz z nazwą tabeli: `{Tygodnie.haslo}` (rozdział „17.5 Tabele dodatkowe”).
- Pogrubione pole da pogrubioną wartość.

![Pola w tekście](https://makietka.app/img/instrukcja/pola.png)

### 16.2 Pola dokumentu

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

### 16.3 Zwykłe klamry

- Cały tekst bez pól: zaznacz tekst i włącz **Klamry { } to zwykły tekst, nie pola** (przełącznik pojawia się, gdy w tekście są klamry).
- Pole i klamry w jednym tekście: wpisz klamry podwójnie — `{{` i `}}` staną się pojedynczymi klamrami, np. `Dzień {dzien}, wzór {{x}}` da „Dzień 5, wzór {x}”.

## 17. Serie

### 17.1 Czym jest seria

Seria powiela stronę dla kolejnych wierszy tabeli. Projektujesz jedną stronę dnia — dostajesz 365 stron, każdą z danymi swojego wiersza. Seria może obejmować kilka sąsiednich stron (**blok**), np. tydzień na rozkładówce: wtedy cały blok powiela się razem.

Powielone strony nie są zapisywane osobno — powstają na bieżąco, więc zmiana tabeli od razu zmienia publikację.

### 17.2 Nowa seria

1. Kliknij puste miejsce strony — właściwości pokażą ustawienia strony.
2. W polu **Seria** wybierz **+ Nowa seria…**.
3. Ustaw serię w oknie (rozdział „17.3 Ustawienia serii”) i kliknij **Zapisz**.
4. Kolejnym stronom bloku wybierz tę samą serię.

![Seria we właściwościach strony](https://makietka.app/img/instrukcja/k-seria.png)

Strony serii mają na liście stron fioletowy znaczek z liczbą powieleń, np. **×31**. **×0** znaczy, że wszystkie wiersze tej strony są pomijane.

![Strony powielone w podglądzie](https://makietka.app/img/instrukcja/serie.png)

### 17.3 Ustawienia serii

Okno serii otwiera się po wybraniu **+ Nowa seria…**, a dla istniejącej serii — przyciskiem **Ustawienia serii** we właściwościach strony. Pod polem **Seria** widać, ile stron wyjdzie w wydruku.

| Ustawienie | Znaczenie |
|---|---|
| **Nazwa serii** | Nazwa na liście serii. |
| **Dane z tabeli** | Tabela, z której biorą się wiersze. |
| **Ile razy powielić** | **Tyle razy, ile wierszy ma tabela** albo **Stałą liczbę razy** — np. 12 miesięcy; dane idą wtedy w kółko. |
| **Jak czytać tabelę** | **Jeden wiersz na cały blok stron** (kolumny np. `s1_tytul`, `s2_tytul` dla kolejnych stron) albo **Jeden wiersz na każdą stronę bloku**. |
| **Dokończ ostatni blok stronami bez danych** | Seria kończy się na ostatnim wierszu; z tym ustawieniem ostatni blok jest pełny. |
| **Pilnuj lewej i prawej strony** | W rozkładówkach (rozdział „17.6 Serie w rozkładówkach”). |
| **Dodatkowe tabele** | Dane zmieniające się rzadziej niż strony (rozdział „17.5 Tabele dodatkowe”). |
| **Dane, których potrzebują strony** | Pola użyte na stronach bloku. **Dodaj brakujące kolumny do tabeli** dopisuje brakujące. |
| **Pobierz szablon danych (Excel)** | Plik z kolumnami, których potrzebują strony (rozdział „17.7 Szablon danych”). |

### 17.4 Wiersze pomijane

Przykład: kalendarz z blokiem na tydzień (poniedziałek–niedziela), a rok zaczyna się w czwartek. Bez niczego 1 stycznia trafiłby na stronę poniedziałku. Dopisz więc na początku tabeli trzy **wiersze pomijane** — za poniedziałek, wtorek i środę.

Wiersz pomijany ma w pierwszej komórce znacznik `**pomiń**`. Zajmuje swoje miejsce w bloku, ale jego strona nie powstaje: nie ma jej w podglądzie, w PDF ani w numeracji. Wstawisz go przyciskiem **Wiersz pomijany** w oknie Dane — nad wierszem, w którym stoi kursor — albo wpiszesz `**pomiń**` w Excelu.

Koniec roku nie wymaga niczego: seria kończy się na ostatnim wierszu danych.

### 17.5 Tabele dodatkowe

Tabela dodatkowa daje dane, które zmieniają się rzadziej niż strony — np. hasło tygodnia na stronach dni albo obrazek miesiąca. W oknie serii: **Dodaj tabelę**, a potem **Nowy wiersz**:

- **co stałą liczbę stron** — np. co 7 stron dla tygodni,
- **gdy zmieni się kolumna „…”** — np. `miesiac`: nowy wiersz tam, gdzie w tabeli głównej zmienia się miesiąc. Kilka kolumn (np. miesiąc i rok) wybierzesz w kolejnych listach **albo kolumna**.

Pole z tabeli dodatkowej: `{Tygodnie.haslo}`. Gdy tabeli dodatkowej zabraknie wierszy, okno serii pokaże to na czerwono, a przed drukiem — na liście uwag.

### 17.6 Serie w rozkładówkach

**Pilnuj lewej i prawej strony – wstaw pustą stronę, gdy trzeba** sprawia, że strona zaprojektowana jako lewa zawsze wychodzi po lewej, a prawa po prawej. Gdy trzeba, aplikacja wstawia pustą białą stronę — np. za serią, gdy dane kończą się na lewej stronie. Pusta strona liczy się w numeracji, jak w drukowanych książkach. **Sprawdź przed drukiem** wypisuje, gdzie stoją puste strony.

### 17.7 Szablon danych

**Pobierz szablon danych (Excel)** daje plik z kolumnami dokładnie takimi, jakich wymagają strony, razem z danymi, które już są w tabeli. Arkusz „Instrukcja” opisuje każdą kolumnę. Kolumny z listą wartości, nazwami obrazów albo kadrem mają listy rozwijane. Wypełniony plik zaimportuj w oknie Dane.

## 18. Wygląd z danych

### 18.1 Część Z danych

Element może zmieniać się razem z danymi na kolejnych powielonych stronach: kolor, miejsce, rozmiar, obrót, obraz albo widoczność. Zaznacz element i rozwiń część **Z danych** we właściwościach.

W edytorze element wygląda jak wzór (pozycja 1, kolor wzoru, zawsze widoczny). Właściwy wygląd każdej strony widać w podglądzie, na miniaturach i w PDF.

![Zakładka na brzegu: inne miejsce i kolor na każdej stronie](https://makietka.app/img/instrukcja/zakladki.png)

### 18.2 Kolor z pola

**Kolor z pola** — kolumna z kolorami, np. `#d1495b`, `2e86ab` albo nazwa po angielsku (`navy`). Pusta albo błędna wartość zostawia kolor wzoru. Linia i kształt bez wypełnienia dostają kolor obrysu. Przy wypełnieniu przejściem kolorów wybierasz, co zmienia kolor z pola: pierwszy kolor, ostatni kolor albo całe przejście w odcieniach.

### 18.3 Położenie, rozmiar i obrót z pola

| Ustawienie | Znaczenie |
|---|---|
| **Przesunięcie w poziomie z pola**, **Przesunięcie w pionie z pola** | Pole z liczbą — kolumna tabeli albo np. `{egzemplarz}` (numer powielenia). |
| **Wartość pola to** | **numer pozycji** — element przesuwa się o **Krok** (mm) za każdą pozycję; **Od nowa co** N wraca na początek. Albo **przesunięcie w mm** — liczba z tabeli wprost. |
| **Szerokość z pola**, **Wysokość z pola** | Wartość to **procent rozmiaru wzoru (100 = bez zmian)** albo **rozmiar w mm**. **Przy zmianie rozmiaru na miejscu zostaje** — który bok albo róg stoi w miejscu. |
| **Obrót z pola (stopnie)** | Kąt dodawany do obrotu wzoru, np. wskazówka na każdej stronie inaczej. |

Tak robi się zakładki na brzegu strony — na każdej stronie niżej — albo słupki o wysokości z tabeli.

### 18.4 Pokaż element

**Pokaż element**: **zawsze** albo tylko wtedy, gdy wybrane pole **nie jest puste**, **jest puste** albo **równa się** wpisanej wartości. Przykład: gwiazdka przy święcie — kolumna `swieto` i „nie jest puste”.

### 18.5 Obraz z danych

Wstaw dowolny obraz jako wzór — wyznacza miejsce i rozmiar. We właściwościach obrazu, w części **Obraz z danych**:

| Ustawienie | Znaczenie |
|---|---|
| **Kolumna z nazwą pliku** | W każdym wierszu nazwa pliku, np. `styczen.jpg`. Pliki wgrasz naraz w oknie Obrazy projektu (rozdział „8.5 Okno Obrazy projektu”). |
| **Podmieniony obraz** | **mieści się w ramce (cały widoczny)** — z wolnym miejscem po bokach albo u góry; **wypełnia ramkę (brzegi przycięte)** — bez pustych pasów. |
| **Zostaje część zdjęcia** | Przy wypełnianiu: środek, góra, dół, lewa albo prawa strona — np. „góra”, żeby nie ucinać głów na portretach. |
| **Kadr z kolumny** | **ten sam na każdej stronie** albo kolumna, w której dla każdego zdjęcia wpiszesz `góra`, `dół`, `lewa`, `prawa` albo `środek`. |

### 18.6 Tekst o różnej długości

Teksty z tabeli mają różną długość, a układ strony ma zostać ten sam. Ustaw ramce **Stałą wysokość** i włącz **Zmniejszaj tekst, gdy się nie mieści** (rozdział „6.6 Ramka tekstu”). **Sprawdź przed drukiem** poda strony, na których tekst mimo to się nie mieści.

![Ramka o stałej wysokości](https://makietka.app/img/instrukcja/ramka-tekstu.png)

## 19. Przykłady

### 19.1 Kalendarz książkowy

Jedna strona na dzień, z dniem tygodnia, imieninami i świętami w kolorze.

1. Nowy projekt A5, układ **Rozkładówki** (rozdział „3.2 Nowy projekt”).
2. W oknie Dane zaimportuj tabelę **Dni** z kolumnami `dzien`, `miesiac`, `dzien_tygodnia`, `imieniny`, `swieto` — albo poproś o nią AI (polecenie niżej).
3. Na stronie wstaw teksty `{dzien}`, `{dzien_tygodnia}` i `Imieniny: {imieniny}` (rozdział „16.1 Wstawianie pola”).
4. Kliknij puste miejsce strony i w **Seria** utwórz serię z tabelą Dni (rozdział „17.2 Nowa seria”) — powstanie 365 stron.
5. Wstaw mały tekst `{swieto}` w kolorze czerwonym i ustaw **Pokaż element → nie jest puste** (rozdział „18.4 Pokaż element”).
6. Numer strony i stopkę dodaj jako wzorzec (rozdział „12.4 Wzorce standardowe”).
7. Sprawdź podgląd i wyeksportuj PDF (rozdział „20 Podgląd”, „22 Eksport do PDF i PNG”).

**Polecenie dla AI: tabela dni do kalendarza** — Skopiuj, podmień nazwę projektu i wklej do rozmowy z AI, które ma podłączoną Makietkę (rozdział „26 Praca z AI”).

```text
Korzystając z łącznika Makietka, w projekcie „<nazwa projektu>”:
1. Przeczytaj opis formatu (narzędzie opis_formatu) i przegląd projektu.
2. Zrób tabelę danych „Dni 2027” z kolumnami: data, dzien, miesiac, dzien_tygodnia, swieto, kolor (kolor liczby: czarny w dni zwykłe, czerwony #c0392b w niedziele i święta).
3. Wypełnij ją dla całego roku 2027 (polskie święta państwowe i kościelne w kolumnie swieto).
4. Zrób stronę-wzór dnia: duża liczba {dzien} z kolorem z pola „kolor”, pod nią {dzien_tygodnia} i {miesiac}, a niżej {swieto}. Ustaw serię „Dni” z tą tabelą.
5. Pokaż mi, ile stron powstanie, i uruchom kontrolę przed drukiem.
```

### 19.2 Planer z obrazkiem miesiąca

1. Strony dni zrób jak w kalendarzu (rozdział „19.1 Kalendarz książkowy”).
2. Dodaj tabelę **Miesiące** z kolumnami `miesiac` i `obraz` (nazwy plików), a zdjęcia wgraj w oknie Obrazy projektu (rozdział „8.5 Okno Obrazy projektu”).
3. W oknie serii dodaj ją jako tabelę dodatkową: **Nowy wiersz → gdy zmieni się kolumna „miesiac”** (rozdział „17.5 Tabele dodatkowe”).
4. Wstaw obraz na stronie i w **Kolumna z nazwą pliku** wybierz kolumnę `obraz` tabeli Miesiące (rozdział „18.5 Obraz z danych”).

### 19.3 Zaproszenia imienne

1. Projekt w formacie zaproszenia, np. 148 × 105 mm.
2. Tabela **Goście** z kolumną `imie` — np. wklejona z arkusza (rozdział „15.3 Poprawianie danych w aplikacji”).
3. Zaprojektuj zaproszenie i wpisz w tekście `Kochana {imie}!` albo `Drogi {imie}!`.
4. Seria z tabelą Goście — jedno zaproszenie na każdego gościa.
5. PDF **Do drukarni** z podziałem na pliki albo jednym plikiem (rozdział „22.1 Okno eksportu”).

## 20. Podgląd

### 20.1 Otwieranie podglądu

Podgląd pokazuje całą publikację tak, jak będzie wyglądać po przycięciu: z danymi, z powielonymi stronami, bez linii pomocniczych i bez możliwości przypadkowej zmiany.

Otworzysz go przyciskiem **Podgląd** na górnym pasku edytora (`Shift`+`W`) albo z menu **⋯** na karcie projektu — wtedy podgląd otwiera się od razu, bez edytora.

![Podgląd na górnym pasku](https://makietka.app/img/instrukcja/k-podglad.png)

Strony idą po kolei, rozkładówki stoją obok siebie. Strony serii mają podpis, np. „3 z 31”. Kliknięcie strony otwiera ją w edytorze; **Edytor** albo `Esc` wraca do edycji.

![Podgląd](https://makietka.app/img/instrukcja/podglad.png)

### 20.2 Powiększanie

- **−** i **+** na pasku; kliknięcie procentu wraca do 100%, czyli całej rozkładówki w oknie.
- `Ctrl` + kółko myszy powiększa w miejscu kursora.
- Na telefonie i tablecie: szczypanie dwoma palcami, podwójne stuknięcie powiększa albo wraca.

Powiększenie zmienia tylko strony — podpisy i pasek zostają w swoim rozmiarze.

### 20.3 Prezentacja

**Prezentacja** pokazuje jedną stronę albo rozkładówkę naraz, na całym ekranie. Strzałki i spacja przewracają strony, `Esc` albo **×** zamyka. Na telefonie przesunięcie palcem w bok przewraca stronę, w dół — zamyka prezentację.

### 20.4 Makieta 3D

**Makieta 3D** obok **Separacje** na pasku podglądu pokazuje projekt jako wydrukowaną rzecz — można ją obracać i kartkować, zanim pójdzie do drukarni.

![Makieta 3D: książka w twardej oprawie](https://makietka.app/img/instrukcja/k-makieta.png)

| Rodzaj | Jak wygląda |
|---|---|
| **Książka – miękka oprawa** | Okładka z sekcji okładki (rozdział „11.6 Okładka z grzbietem”): przód, grzbiet i tył; środek kartka po kartce. Bez sekcji okładki okładką jest pierwsza strona. |
| **Książka – twarda oprawa** | Grubsza okładka z tektury, większa od środka. |
| **Notes na spirali** | Kartki na spirali wzdłuż grzbietu. |
| **Kalendarz ścienny** | Karta po karcie na spirali u góry; przewrócona karta przechodzi na tył. |
| **Kalendarz biurkowy** | Stojak z tektury; karty przewracają się przez górę na drugą stronę. |
| **Pojedyncza kartka** | Ulotka, plakat, zaproszenie — przód i tył. |

Rodzaj dobiera się sam (z okładką — książka, kalendarz z nazwy albo z 12–14 kart, jedna strona — kartka); zmienisz go listą **Rodzaj**.

- **Obracanie** — przeciągnij myszą albo palcem.
- **Przybliżanie** — kółko myszy, dwa palce albo **−** i **+**; **Widok** wraca do widoku z przodu.
- **Kartkowanie** — strzałki pod makietą, klawisze `←` `→` albo stuknięcie w prawą lub lewą połowę obrazu. Pod spodem widać, co jest otwarte, np. „Strony 2–3” albo „Karta 3 z 13”.
- **Pobierz obraz makiety** zapisuje obraz PNG z przezroczystym tłem — np. do oferty albo wpisu w sieci.

![Makieta 3D: kalendarz ścienny](https://makietka.app/img/instrukcja/k-makieta-kalendarz.png)

> **Wskazówka:** makieta pokazuje kształt i grubość publikacji z papieru i liczby stron (rozdział „11.6 Okładka z grzbietem”) — to podgląd, nie próbny wydruk. Kolory sprawdzisz w **Separacje** (rozdział „23.6 Podgląd separacji”).

### 20.5 Podgląd na żywo

Otwarty podgląd odświeża się sam, gdy projekt zmieni się gdzie indziej — na innym urządzeniu, u współpracownika albo przez AI. Zostaje w tym samym miejscu i powiększeniu; przerysowują się tylko zmienione strony.

## 21. Sprawdź przed drukiem

### 21.1 Lista uwag

Zanim wyślesz plik do drukarni, wybierz **⋯** → **Sprawdź przed drukiem**. Aplikacja przegląda cały projekt — także każdą powieloną stronę — i wypisuje miejsca, na które warto spojrzeć.

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
| **Niepełna składka** | Sekcji brakuje stron do pełnej składki (rozdział „11.7 Składki”); przy oprawie zeszytowej — liczba stron niepodzielna przez 4. |
| **Pokrycie farbą** | Kolor elementu po przeliczeniu profilem drukarni daje ponad 300% farby — po otwarciu podglądu separacji z profilem albo eksporcie PDF/X-4 (rozdział „23.6 Podgląd separacji”). |
| **Element w marginesie albo poza spadem** | Jak na liście ostrzeżeń w edytorze (rozdział „13.2 Ostrzeżenia”). |

**Pokaż** przy uwadze otwiera podgląd na pierwszej stronie, której uwaga dotyczy, z wyróżnioną kartką. **Otwórz wzór** otwiera w edytorze stronę-wzór. Uwagi nie blokują eksportu — ta sama lista jest na dole okna eksportu PDF.

![Lista uwag](https://makietka.app/img/instrukcja/kontrola.png)

## 22. Eksport do PDF i PNG

### 22.1 Okno eksportu

Wybierz **⋯** → **Eksportuj do PDF…**.

![Eksportuj do PDF w menu ⋯](https://makietka.app/img/instrukcja/k-menu-pdf.png)

| Ustawienie | Znaczenie |
|---|---|
| **Rodzaj pliku** | **Wektorowy – ostry tekst i kształty**: tekst z osadzonymi czcionkami, ostry w każdym powiększeniu, da się go zaznaczyć. **Obrazy stron – strona jako zdjęcie**: każda strona to jeden obraz; wygląda wszędzie tak samo, ale plik jest większy. |
| **Zakres** | **Cały projekt**, **Tylko bieżąca sekcja** albo **Strony od–do** (numery w całym wydruku). |
| **Przeznaczenie** | **Do drukarni – ze spadem i znakami cięcia** albo **Do oglądania – równo do formatu**. Znaki cięcia dostają sekcje, które mają je włączone (rozdział „11.4 Ustawienia sekcji”). |
| **Układ arkuszy** | **Zwykłe strony** albo strony ułożone na arkuszach do samodzielnego druku (rozdział „22.6 Broszura i kilka stron na arkuszu”). |
| **Jakość** | Rozdzielczość zdjęć: 300 dpi — standard do druku, 150 dpi — mały plik na próbę, 600 dpi — bardzo ostro. |

Na dole okna jest lista **Do sprawdzenia przed drukiem** (rozdział „21 Sprawdź przed drukiem”). **Eksportuj** zapisuje plik; długi eksport przerwiesz przyciskiem **Anuluj** na karcie postępu.

![Okno eksportu](https://makietka.app/img/instrukcja/pdf.png)

### 22.2 Zaawansowane

Część **Zaawansowane**:

| Ustawienie | Znaczenie |
|---|---|
| **Zamień tekst na krzywe (bez czcionek w pliku)** | Litery stają się kształtami. Tego wymagają niektóre drukarnie; tekstu nie da się potem zaznaczyć. |
| **Kolory tekstu i kształtów w CMYK (czarny jako sama czerń)** | Kolory zapisane czterema farbami drukarskimi; czarny tekst idzie samą czarną farbą, więc jest ostry. |
| **Standard dla drukarni** | **Bez standardu – zwykły PDF**, **PDF/X-4 – papier powlekany (FOGRA39)**, **PDF/X-4 – papier niepowlekany (FOGRA47)** albo **PDF/X-4 – profil od drukarni (plik .icc)** — **Wybierz plik profilu…**. |
| **Zdjęcia też w CMYK (większy plik)** | Przy PDF/X-4: zdjęcia przeliczone na farby drukarskie przez ten sam profil. |
| **Podział na pliki** | **Jeden plik**, **Osobny plik dla każdej sekcji** albo **Części po tyle stron** (**Stron w części**). Kilka plików dostajesz w archiwum ZIP. |
| **Dołącz pliki czcionek użytych w projekcie** | Do pobrania trafia ZIP z plikiem PDF i folderem `czcionki`. |
| **PDF do czytania na ekranie: zakładki i klikalne linki** | Zakładki i linki dla czytających na ekranie (rozdział „22.7 PDF do czytania na ekranie”). Domyślnie włączone; przy PDF/X-4 i układzie arkuszy niedostępne. |
| **Uszlachetnienia** | Gdy projekt je ma: **Osobne płyty w tym samym pliku PDF**, **Osobny plik PDF na każde uszlachetnienie** albo **Pomiń uszlachetnienia** (rozdział „23.4 Uszlachetnienia w pliku PDF”). |

### 22.3 Jak wybrać ustawienia dla drukarni

Zapytaj drukarnię, czego wymaga:

- mówi „PDF/X-4” — wybierz ten standard i papier, na którym będzie drukować,
- mówi „wszystko w CMYK” — zaznacz też oba pola CMYK,
- mówi „bez czcionek” albo „krzywe” — zaznacz **Zamień tekst na krzywe**,
- nic nie wymaga — **Wektorowy**, **Do drukarni**, 300 dpi.

> **Wskazówka:** Plik z projektu w kolorach ekranu wygląda w druku nieco inaczej. Najpewniej zamówić wydruk próbny.

### 22.4 Czego nie da się zapisać wektorowo

Element z cieniem, element przycięty maską i rysunek SVG z filtrem trafiają do pliku jako obraz tego jednego elementu — reszta strony zostaje wektorowa. Tekst w czcionce, której nie da się osadzić, trafia do pliku jako krzywe. Po eksporcie aplikacja mówi, jeśli coś takiego się zdarzyło.

### 22.5 Strona jako PNG

**⋯** → **Pobierz bieżącą stronę jako PNG** zapisuje obraz otwartej strony w 300 dpi, ze spadem — np. do pokazania komuś w wiadomości.

### 22.6 Broszura i kilka stron na arkuszu

**Układ arkuszy** w oknie eksportu kładzie strony na arkuszach — do druku na zwykłej drukarce albo w małej drukarni:

| Układ | Co robi |
|---|---|
| **Broszura do składania (zeszyt)** | Strony parami, tak żeby po wydrukowaniu dwustronnym i złożeniu arkuszy na pół wyszedł zeszyt: przy 16 stronach pierwszy arkusz to 16 i 1 z przodu, 2 i 15 z tyłu. Liczba stron dopełnia się pustymi do wielokrotności 4. |
| **Broszura ze składek** | To samo, ale osobno dla każdej składki po **Składka (stron)** — 4, 8, 16 albo 32 (domyślnie jak w ustawieniach sekcji, → 11.7). Składki zszywa się albo klei razem. |
| **2 strony na arkuszu**, **4 strony na arkuszu** | Kolejne strony obok siebie — np. ulotki A6 po cztery na A4. |

**Arkusz**: **Dopasowany do stron** (dwie strony A5 → arkusz 296 × 210 mm) albo **A4** / **A3** — strony stoją pośrodku i zmniejszają się, jeśli się nie mieszczą. **Pełzanie (mm)**: w grubszej broszurze środkowe kartki po złożeniu wystają; strony na nich przesuwają się o część tej wartości w stronę grzbietu (np. 0,5–1 mm przy 40 stronach).

Pod ustawieniami widać plan: każdy arkusz z numerami stron (z przodu i z tyłu), puste strony zakreskowane.

![Broszura: plan arkuszy w oknie eksportu](https://makietka.app/img/instrukcja/k-pdf-arkusze.png)

Przy **Do drukarni** arkusze mają znaki cięcia, a broszura — przerywane znaki złamu. Strony na arkuszach stoją równo do formatu, bez spadu.

> **Wskazówka:** Broszurę drukuj dwustronnie z obracaniem po krótszej krawędzi. Najpierw wydrukuj jeden arkusz próbnie.

### 22.7 PDF do czytania na ekranie

Zwykły plik PDF ma od razu nawigację dla czytających na ekranie:

- **zakładki** w bocznym panelu czytnika — sekcje projektu, a pod nimi nagłówki (style nagłówków książki, → 14),
- **klikalny spis treści** — wiersz spisu prowadzi do strony,
- **odsyłacze** „s. 12” prowadzą do tej strony,
- **link elementu** — w panelu elementu, w części **Inne**, pole **Link w PDF (adres strony, e-mail)**: kliknięcie elementu w PDF otwiera adres; kod QR z adresem strony jest klikalny sam.

Linki są w pliku wektorowym; zakładki — w obu rodzajach pliku. W PDF/X-4 dla drukarni nawigacji nie ma.

### 22.8 Drukuj w domu

Wydruk na zwykłej drukarce, bez wysyłania pliku do drukarni. Gdzie: menu **⋯** projektu → **Drukuj w domu…** (skrót `Ctrl`+`P` w edytorze).

![Okno Drukuj w domu](https://makietka.app/img/instrukcja/k-druk.png)

| Ustawienie | Co znaczy |
|---|---|
| **Co wydrukować** | **Zwykły wydruk** (strona na kartce), **Broszura do złożenia** (kartki składane na pół i zszywane w środku – kolejność stron układa się sama), **2** albo **4 strony na kartce**. |
| **Papier** | A4, A3 albo Letter – kartka obraca się sama. |
| **Rozmiar stron** | **Rzeczywisty** (strony zmniejszone tylko, gdy się nie mieszczą) albo **Dopasuj do kartki**. |
| **Strony** | Wszystkie, od–do albo tylko bieżąca. |
| **W odcieniach szarości** | Wydruk czarno-biały. |
| **Znaki cięcia i złamu** | Przy broszurze, którą przytniesz po zszyciu. |

Pod ustawieniami widać, jak strony ułożą się na kartkach. **Drukuj** otwiera okno drukowania przeglądarki z gotowym plikiem; na telefonie plik otwiera się w nowej karcie – wybierz tam **Udostępnij → Drukuj**. **Pobierz PDF do druku** zapisuje ten sam plik.

Część **Jak wydrukować** w oknie podpowiada krok po kroku:

1. Najpierw wydrukuj jedną kartkę na próbę.
2. W oknie drukarki ustaw skalę **Rzeczywisty rozmiar / 100%**.
3. Broszurę drukuj dwustronnie, **obracanie po krótszej krawędzi** (kartka leży poziomo).
4. Drukarka bez druku dwustronnego: najpierw tylko strony nieparzyste, potem włóż stos z powrotem i wydrukuj parzyste.
5. Złóż kartki na pół (pierwsza na wierzchu) i zszyj w zgięciu; grubą broszurę podziel na składki.

## 23. Kolory dodatkowe i uszlachetnienia

### 23.1 Kolory dodatkowe

Druk to nie tylko cztery farby CMYK. Makietka zna kolory dodatkowe (np. Pantone), uszlachetnienia — lakier, złocenie, tłoczenie, biały poddruk — i druk tylko czarną farbą albo czarną z jednym kolorem. Wszystko trafia do pliku PDF tak, jak oczekuje drukarnia: każda farba na osobnej płycie.

Kolor dodatkowy drukuje się osobną, gotową farbą — dokładnie w tym odcieniu, którego potrzebujesz (np. kolor logo).

1. **⋯** → **Kolory do druku…** → **Dodaj kolor dodatkowy**.
2. Wpisz **Nazwę** dokładnie jak w drukarni albo we wzorniku, np. „PANTONE 186 C”.
3. Wpisz **C**, **M**, **Y**, **K** — to tylko podgląd na ekranie; drukarnia użyje swojej farby.

![Okno „Kolory do druku”](https://makietka.app/img/instrukcja/k-kolory-druku.png)

Kolor dodatkowy wybierasz w każdym polu koloru — wypełnienie, obrys, tekst, fragment tekstu — w części **Kolory dodatkowe**, razem z **Odcieniem** (np. 40%).

![Kolor dodatkowy w wyborze koloru](https://makietka.app/img/instrukcja/k-kolor-dodatkowy.png)

Zmiana CMYK koloru dodatkowego zmienia wszystkie elementy w tym kolorze. Usunięcie koloru zostawia elementy w zwykłym kolorze CMYK.

### 23.2 Uszlachetnienia

Uszlachetnienie ustawiasz przy elemencie, w części **Uszlachetnienie**:

| Uszlachetnienie | Co to jest | Płyta w PDF |
|---|---|---|
| **Lakier UV wybiórczy** | Błyszczący lakier tylko w tym miejscu, np. na tytule. | Spot_UV |
| **Złocenie (folia)** | Metaliczna folia; **Kolor folii**: złoto, srebro albo miedź. | Foil_Gold, Foil_Silver, Foil_Copper |
| **Tłoczenie (wypukłe)** | Wzór wypchnięty w papierze. | Emboss |
| **Wytłoczenie (wklęsłe)** | Wzór wciśnięty w papier. | Debossing |
| **Biały poddruk** | Biała farba — na kolorowym albo przezroczystym podłożu. | White |

![Uszlachetnienie w panelu elementu](https://makietka.app/img/instrukcja/k-uszlachetnienie.png)

Element z uszlachetnieniem drukuje się **tylko** na płycie uszlachetnienia — jego kolory nie idą do druku. Żeby mieć napis w kolorze i ze złoceniem, zaznacz napis i w **Dodaj kopię z uszlachetnieniem** wybierz złocenie: kopia stanie dokładnie nad napisem.

> **Wskazówka:** Uszlachetnienie na bardzo drobnym tekście (poniżej 6 pt) i cienkich liniach (poniżej 0,3 mm) może się nie odwzorować. **Sprawdź przed drukiem** o tym przypomni (rozdział „21 Sprawdź przed drukiem”).

### 23.3 Widok uszlachetnień

W edytorze i podglądzie uszlachetnienie widać jako efekt: połysk lakieru, metaliczną folię, cień tłoczenia, biel na szachownicy. Menu widoku → **Pokaż uszlachetnienia** wyłącza efekt (rozdział „4.6 Prawy dolny róg i menu widoku”).

### 23.4 Uszlachetnienia w pliku PDF

W pliku wektorowym każde uszlachetnienie to osobna płyta z **nadrukiem** — nie wybija farby pod spodem. W oknie eksportu, w części **Zaawansowane**, wybierz **Uszlachetnienia**:

- **Osobne płyty w tym samym pliku PDF** — najczęstsze,
- **Osobny plik PDF na każde uszlachetnienie** — główny plik bez uszlachetnień i osobny plik każdej płyty, w jednym ZIP,
- **Pomiń uszlachetnienia**.

Plik z obrazów stron nie ma osobnych płyt — wybierz plik wektorowy.

### 23.5 Tryb kolorów projektu

**⋯** → **Kolory do druku…** → **Tryb kolorów projektu**:

| Tryb | Kiedy |
|---|---|
| **Pełny kolor** | Zwykły druk CMYK (domyślnie). |
| **Skala szarości** | Druk jedną czarną farbą — kolory i zdjęcia idą odcieniami czerni. |
| **Cz/b + 1 kolor** | Czerń i jeden kolor dodatkowy, np. kalendarz z czerwonymi niedzielami. **Kolor dodatkowy trybu** wybierasz pod spodem. |

W wyborze koloru zostają wtedy odcienie czerni i kolor trybu. Kolory spoza trybu okno pokaże — **Zamień na najbliższe dozwolone** zamieni je na czerń albo kolor trybu. To samo zrobi przycisk w **Sprawdź przed drukiem**.

> **Wskazówka:** Rozszerzony CMYK (CMYK z dodatkowymi farbami, np. pomarańczową, zieloną i fioletową) robi drukarnia sama z Twojego pliku — nie trzeba osobnej palety.

### 23.6 Podgląd separacji

W podglądzie projektu **Separacje** pokazuje stronę rozbitą na płyty, którymi wydrukuje ją drukarnia: **Cyjan**, **Magenta**, **Żółty**, **Czarny**, kolory dodatkowe i uszlachetnienia.

![Podgląd separacji: kolor dodatkowy i lakier UV z nadrukiem](https://makietka.app/img/instrukcja/separacje.png)

1. Strzałkami nad obrazem przechodzisz między stronami.
2. Odznacz płytę, żeby zobaczyć stronę bez niej; zostaw jedną i zaznacz **Jedna płyta w szarości** — zobaczysz samą farbę tej płyty (czarne = 100%).
3. **Pokaż nadruk uszlachetnień** — uszlachetnienia jako kreskowana nakładka nad farbą (drukują się z nadrukiem, nie wybijają farby pod spodem).
4. **Zaznacz pokrycie farbą ponad** **Limit pokrycia (%)** — miejsca, gdzie suma farb przekracza limit (zwykle 300% dla papieru powlekanego), robią się czerwone. Pod spodem jest największe pokrycie na stronie.

**Przeliczanie na CMYK**: **Proste** — tak jak plik wektorowy w CMYK bez profilu (czerń i szarości samą czernią; nie przekracza 300%); **Papier powlekany (FOGRA39)** albo **Papier niepowlekany (FOGRA47)** — tak, jak przeliczy profil drukarni. Po przeliczeniu profilem **Sprawdź przed drukiem** wskaże też kolory elementów z pokryciem farbą powyżej 300% (rozdział „21 Sprawdź przed drukiem”).

## 24. Udostępnianie linkiem

### 24.1 Tworzenie linku

Link do podglądu pokażesz komuś, kto nie ma konta: klientowi, rodzinie, drukarni. Osoba z linkiem widzi strony tak jak w podglądzie; nie może niczego zmienić i nie widzi innych Twoich projektów.

1. W podglądzie kliknij **Udostępnij**.
2. **Utwórz link** — aplikacja przygotuje obrazy wszystkich stron; przy dużym projekcie chwilę to potrwa.
3. Skopiuj link i wyślij go.

![Udostępnij w podglądzie](https://makietka.app/img/instrukcja/k-udostepnij.png)
![Okno Udostępnij podgląd](https://makietka.app/img/instrukcja/udostepnianie.png)

Projekt z linkiem ma na liście projektów plakietkę **Udostępniony** — kliknięcie otwiera to samo okno.

### 24.2 Aktualizacja

Link aktualizuje się sam: kilka sekund po Twoich zmianach aplikacja wysyła obrazy stron, które się zmieniły. Adres zostaje ten sam. **Aktualizuj teraz** robi to od razu. Osoba, która ma link otwarty, nie musi odświeżać strony — nowe strony pojawią się same.

Obrazy stron przygotowuje aplikacja, więc link nadąża za zmianami, gdy projekt jest otwarty — w edytorze albo w podglądzie, na dowolnym urządzeniu.

### 24.3 Ochrona linku

Część **Ochrona linku**:

| Ustawienie | Znaczenie |
|---|---|
| **Hasło – bez niego podglądu nie zobaczy nikt** | Osoba z linkiem najpierw wpisuje **Hasło do linku**. Po 10 błędnych próbach link na kwadrans przestaje przyjmować hasła. |
| **Ważny do wybranego dnia** | Po **Ostatnim dniu ważności** link przestaje działać. |

**Zapisz ochronę** zapisuje ustawienia. Puste pole hasła przy zaznaczonym haśle zostawia dotychczasowe; odznaczenie obu pól zdejmuje ochronę.

### 24.4 Unieważnienie linku

**Unieważnij link** usuwa udostępnione strony — stary adres od razu przestaje działać. Ponowne udostępnienie daje nowy adres.

> **Uwaga:** Link jest długi i losowy, więc nie da się go zgadnąć, ale każdy, kto go dostanie, może go przekazać dalej. Do poufnych projektów ustaw hasło.

## 25. Współpraca

### 25.1 Zapraszanie

Projekt możesz robić razem z innymi osobami — każda pracuje na swoim koncie, a zmiany widać u wszystkich na żywo. Wybierz **⋯** → **Współpraca…** w edytorze albo na karcie projektu.

![Współpraca w menu ⋯](https://makietka.app/img/instrukcja/k-menu-wspolpraca.png)

W części **Zaproś osobę**:

1. W polu **E-mail albo nazwa użytkownika** wpisz adres albo nazwę — po dwóch literach pojawią się pasujące nazwy użytkowników.
2. Wybierz **Rolę** (rozdział „25.2 Role”).
3. Kliknij **Zaproś**.

Aplikacja wysyła e-mail z linkiem do zaproszenia. Link możesz też skopiować i wysłać sam. Przy zaproszeniu po nazwie nie widzisz adresu e-mail tej osoby.

![Okno Współpraca](https://makietka.app/img/instrukcja/wspolpraca.png)

### 25.2 Role

| Rola | Co może |
|---|---|
| **może edytować** | Zmienia strony, dane, wzorce i style; eksportuje PDF. |
| **może oglądać** | Otwiera projekt tylko w podglądzie. |
| **Właściciel** | Wszystko powyższe, a do tego zaprasza, zmienia role, odbiera dostęp, udostępnia link do podglądu i usuwa projekt. |

### 25.3 Przyjmowanie zaproszenia

Kliknij link z wiadomości. Jeśli masz konto, zaproszenie zobaczysz też w aplikacji: na liście projektów pojawi się przycisk **Zaproszenia** z liczbą. Przyjęty projekt jest na Twojej liście z plakietką właściciela.

Zaproszenie przyjmuje osoba, która ma link — także z innego adresu niż ten, na który poszło. W oknie Współpraca zawsze widać, kto naprawdę jest w projekcie.

Gdy masz włączone powiadomienia, o zaproszeniu dowiesz się od razu — także przy zamkniętej aplikacji. Włączysz je w **Ustawienia konta** → **Powiadomienia** (rozdział „2.6 Powiadomienia”).

### 25.4 Praca na żywo

- Zmiany łączą się element po elemencie: gdy Ty poprawiasz tytuł, a ktoś przesuwa zdjęcie, zostają obie zmiany. O ten sam element aplikacja zapyta (rozdział „3.5 Kilka urządzeń i cofanie”).
- Kółka z inicjałami na pasku edytora i podglądu pokazują, kto jeszcze ma projekt otwarty; wskaż kółko, żeby zobaczyć, na której jest stronie.
- **Cofnij** cofa tylko Twoje zmiany.

### 25.5 Zarządzanie osobami

Właściciel w oknie Współpraca przy każdej osobie:

- zmienia **rolę** na liście rozwijanej,
- **Odbierz** — odbiera dostęp od razu; zmiany, które ta osoba już zapisała, zostają,
- przy zaproszeniu, które czeka: **Kopiuj link zaproszenia**, **Wyślij e-mail z zaproszeniem ponownie** i **Cofnij zaproszenie**.

### 25.6 Opuszczanie projektu i kopia

Współpracownik może **Opuść projekt** — w menu **⋯** na karcie albo w oknie Współpraca. **Zrób własną kopię** tworzy Twój własny projekt z tą samą treścią.

### 25.7 Komentarze

Komentarz to uwaga przypięta do miejsca na stronie albo do elementu — jak karteczka na wydruku. Na stronie widać ją jako pomarańczową pinezkę z numerem. Komentują wszyscy w projekcie: właściciel, **może edytować** i **może oglądać** (w podglądzie). Komentarze nie zmieniają projektu i nie trafiają do PDF.

![Narzędzie Komentarz i przycisk Komentarze z licznikiem](https://makietka.app/img/instrukcja/k-komentarz-narzedzie.png)

**Dodanie komentarza**

1. Kliknij **Komentarz** na pasku narzędzi (w podglądzie: **Komentarze** → **Nowy komentarz**).
2. Kliknij miejsce na stronie. Jeśli najpierw zaznaczysz element, komentarz od razu przypnie się do niego.
3. Wpisz treść i kliknij **Dodaj komentarz** (albo Ctrl+Enter). Esc rezygnuje.

Wpisz **@** i początek nazwy, żeby wspomnieć osobę z projektu — aplikacja podpowie nazwy.

**Lista komentarzy**

Przycisk **Komentarze** na górnym pasku edytora i w podglądzie pokazuje liczbę nierozwiązanych wątków. Na wąskim telefonie jest w menu **⋯**. Kliknięcie pinezki na stronie otwiera jej wątek.

![Panel Komentarze z wątkiem i odpowiedzią](https://makietka.app/img/instrukcja/komentarze.png)

- Filtry: **Nierozwiązane**, **Wszystkie**, **Moje** (moje wątki, moje odpowiedzi i wzmianki o mnie).
- Kliknij wątek, żeby go rozwinąć: odpowiedzi, pole **Odpowiedz**, **Pokaż na stronie** — przejście do strony i zaznaczenie elementu.
- **Rozwiąż** zamyka wątek, gdy uwaga jest załatwiona; pinezka znika ze strony. **Otwórz ponownie** przywraca go (filtr **Wszystkie**).
- Usuwa autor komentarza albo właściciel projektu.

Komentarze i odpowiedzi pojawiają się u wszystkich od razu. Gdy masz włączone powiadomienia z przełącznikiem **Komentarze**, dowiesz się o nowym komentarzu w Twoim projekcie, o odpowiedzi w Twoim wątku i o wzmiance o Tobie — kliknięcie powiadomienia otwiera wątek (**Ustawienia konta** → **Powiadomienia**, → 2.6).

AI połączone kluczem też czyta komentarze, odpowiada na nie i może je rozwiązać po poprawce (rozdział „26.1 Co potrafi AI”).

## 26. Praca z AI

### 26.1 Co potrafi AI

Asystent AI — Claude, ChatGPT i inne — może pracować w Twoich projektach razem z Tobą. Łączy się z Makietką przez **łącznik**: adres z Twoim kluczem, który dodajesz w aplikacji AI.

| AI może | AI nie może |
|---|---|
| tworzyć i usuwać projekty (z pełnym dostępem) | zobaczyć projektów spoza klucza |
| dodawać i zmieniać strony, elementy, style i wzorce | zmienić Twojego konta ani hasła |
| wypełniać tabele danych i ustawiać serie | wyeksportować PDF — plik robisz sam |
| wgrywać, wstawiać i wymieniać zdjęcia |  |
| czytać komentarze, odpowiadać na nie i dodawać własne (rozdział „25.7 Komentarze”) |  |

Pisz do AI zwyczajnie, jak do grafika: co chcesz zrobić, w jakim formacie, ile stron, jaki nastrój. Jeśli masz projekt otwarty, zmiany pojawiają się w edytorze po chwili. Zmiany AI łączą się z Twoimi jak zmiany współpracownika (rozdział „25.4 Praca na żywo”).

### 26.2 Klucz dla AI

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

### 26.3 Podłączenie w aplikacji AI

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

### 26.4 Zdjęcia przez AI

- **ChatGPT** bierze zdjęcia wrzucone do rozmowy wprost.
- **Claude** wgrywa sam małe grafiki z rozmowy; **Claude Desktop z rozszerzeniem** — pliki i foldery z dysku.
- **Zawsze działa link do wgrania:** poproś AI o link — otworzy ten projekt z oknem Obrazy projektu, wrzucasz tam zdjęcia albo ZIP, a AI widzi je i działa dalej.
- AI pobierze też obraz z adresu w internecie albo z linku do Dysku Google czy Dropboxa udostępnionego „każdemu, kto ma link”, i narysuje własną grafikę SVG.

Zdjęcia, które stoi na stronie, AI nie usuwa — wymienia je na nowy plik w tym samym miejscu.

### 26.5 Bezpieczeństwo

AI dostaje co najwyżej Twoje uprawnienia: w projekcie, który możesz tylko oglądać, klucz tylko czyta, a gdy właściciel odbierze Ci dostęp, klucz traci go od razu.

> **Uwaga:** Adres łącznika zawiera klucz — kto go ma, ma dostęp do wybranych projektów. Nie publikuj go, dawaj najkrótszą ważność, jaka wystarczy, i odbieraj klucz po skończonej pracy.

## 27. Przykład: komiks z AI

### 27.1 Od pomysłu do pliku

Zeszyt A5 z okładką: AI układa kadry i dymki, Ty dajesz rysunki i decydujesz.

1. Utwórz klucz z **pełnym dostępem** i **czytać i zmieniać** — AI utworzy nowy projekt (rozdział „26.2 Klucz dla AI”).
2. Skopiuj polecenie „Komiks do druku” (niżej), dopisz pomysł i wyślij. AI najpierw pokaże plan stron — popraw go, zanim zacznie.
3. Otwórz nowy projekt — zobaczysz, jak przybywa stron, kadrów i dymków.
4. Poproś AI o link do wgrania i wrzuć rysunki (rozdział „26.4 Zdjęcia przez AI”). AI wstawi je w kadry.
5. Popraw, co chcesz: tekst w dymkach (styl „Dymek” zmienia wszystkie naraz), kadrowanie, kolejność stron.
6. Okładkę zrób jako osobną sekcję z grzbietem (rozdział „11.6 Okładka z grzbietem”).
7. **Sprawdź przed drukiem**, potem PDF **Do drukarni** (rozdział „21 Sprawdź przed drukiem”, „22 Eksport do PDF i PNG”).

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

## 28. Telefon i tablet

### 28.1 Gesty

Makietka działa w przeglądarce na telefonie, tablecie i komputerze. Na ekranie dotykowym:

| Gest | Co robi |
|---|---|
| **Jeden palec** | Zaznacza i przesuwa elementy. |
| **Dwa palce** | Przesuwają widok i powiększają. |
| **Szybkie przesunięcie w bok** | Po pustym miejscu strony, gdy cała strona mieści się na ekranie: w lewo – następna strona, w prawo – poprzednia (przy rozkładówce cały arkusz). Wolne przeciągnięcie zaznacza ramką jak zwykle. |
| **Dwa szybkie stuknięcia** | Jak podwójne kliknięcie: pisanie w tekście i komórce tabeli, wejście do grupy, edycja punktów. |
| **Przytrzymanie** | Pokazuje podpowiedź, np. opis chmurki zapisu. |

W podglądzie szczypanie powiększa, a w prezentacji przesunięcie w bok przewraca stronę (rozdział „20 Podgląd”).

### 28.2 Edytor na telefonie

Na telefonie edytor działa w pionie. Panele **Strony**, **Właściwości**, **Warstwy** i **Ostrzeżenia** otwierasz przyciskami na dole ekranu. Panel wysuwa się z dołu, a widok sam przesuwa się tak, żeby zaznaczony element był widoczny nad panelem.

**Uchwyt** (kreska u góry panelu): pociągnij w górę, żeby powiększyć panel, w dół — żeby go zmniejszyć albo zamknąć. Stuknięcie w uchwyt zwija powiększony panel do zwykłej wysokości, a zwykły zamyka. Panel zamyka też ponowne stuknięcie jego przycisku.

Na małym ekranie schowane są narzędzia, którymi trudno sterować palcem: wielokąt, kadrowanie ramką i linijki. Prowadnice wpiszesz liczbą, a obraz przytniesz liczbami we właściwościach.

Telefon trzymany poziomo pokazuje planszę „Za mało miejsca na wysokość” — obróć go do pionu.

![Edytor na telefonie](https://makietka.app/img/instrukcja/telefon.png)

### 28.3 Okna od dołu

Na telefonie i tablecie okna (Dane, Wzorce, Eksport do PDF, Obrazy projektu i inne) wysuwają się od dołu ekranu. Zamiast krzyżyka mają **uchwyt** — pociągnij go w dół albo stuknij, żeby zamknąć; zamyka też stuknięcie w przyciemnione tło. Główny przycisk okna jest na dole, zawsze widoczny.

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

## 29. Skróty klawiszowe

### 29.1 Lista skrótów

Skróty są takie jak w programach do składu i grafiki. Na Macu zamiast `Ctrl` naciśnij `⌘`. Tę listę otworzy w edytorze klawisz `?`. Skróty z literami działają, gdy kursor nie stoi w polu formularza; w trakcie pisania tekstu działają skróty z grupy „Tekst”.

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
| `Ctrl` + `` + `` | Powiększ |
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

#### Strony

| Klawisze | Działanie |
|---|---|
| `PageUp` | Poprzednia strona |
| `PageDown` | Następna strona |
| `Ctrl` + `Shift` + `P` | Nowa strona za bieżącą |
| `?` | Ta lista skrótów |

## 30. Słowniczek

### 30.1 Pojęcia

| Pojęcie | Znaczenie |
|---|---|
| **Blok** | Strona albo kilka sąsiednich stron serii, powielane razem. |
| **Element** | Wszystko, co stoi na stronie: tekst, kształt, linia, obraz, tabela, grupa. |
| **Grzbiet** | Część okładki między przodem a tyłem; w rozkładówce — miejsce zszycia. |
| **Łącznik** | Adres, przez który asystent AI pracuje w Twoich projektach. |
| **Margines** | Pas przy brzegu strony, w którym nie stawia się tekstu. |
| **Pole** | Nazwa w klamrach, np. `{dzien}`; na gotowej stronie zamienia się w wartość. |
| **Pole dokumentu** | Pole wynikające z projektu: numer strony, sekcja, data. |
| **Rozkładówka** | Lewa i prawa strona obok siebie, jak w otwartej książce. |
| **Sekcja** | Część publikacji z własnym formatem, marginesami i numeracją. |
| **Seria** | Powielanie strony albo bloku dla kolejnych wierszy tabeli. |
| **Spad** | Kilka milimetrów za brzegiem strony; tła i zdjęcia wychodzą aż tam, a drukarnia je odcina. |
| **Styl** | Zapisany wygląd tekstu, zmieniany naraz we wszystkich tekstach. |
| **Tabela danych** | Arkusz w projekcie, z którego biorą się pola i serie — nie mylić z tabelą na stronie. |
| **Wiersz pomijany** | Wiersz `**pomiń**`: zajmuje miejsce w bloku, ale jego strona nie powstaje. |
| **Wzorzec** | Wspólne elementy wielu stron: tło, stopka, numer strony. |
| **Znaki cięcia** | Kreski w pliku PDF, które pokazują drukarni, gdzie ciąć. |
