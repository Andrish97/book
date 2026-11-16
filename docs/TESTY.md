# Testy – audyt pokrycia (#160)

Stan: 2026-11-16. Ostatni pełny przebieg (3 części, współbieżność 3): 405 z 406, jedyny padający poprawiony (niżej). Testy automatyczne: `tests/*.test.cjs` (Node test runner + Playwright/Chromium,
atrapa Supabase/R2 w `tests/pomoc.cjs`, atrapy AI i poczty). Uruchomienie: `node --test --test-concurrency=3 tests/*.test.cjs`
(pełny zestaw trwa ok. 25 min – w CI i lokalnie najlepiej w 2–3 częściach).

**Skala:** 116 plików testów, ok. 410 testów. Funkcje według spisu instrukcji (podrozdziały `##`, bez przykładów
i słowniczka), 33 narzędzi łącznika AI, 4 funkcji serwera (Edge Functions), Workera i migracji – razem ok. 200
funkcji, w tabeli zebranych w **103 pozycje** (podrozdziały sprawdzane tymi samymi testami są w jednym wierszu).

**Głębokość:** **D** – test sprawdza wynik (stan projektu, zapis i wczytanie, PDF/piksele, brzegowe przypadki);
**P** – płytko (otwiera się, jeden szczęśliwy przypadek albo tylko obliczenia bez aplikacji, albo część funkcji
bez testu); **B** – brak testu.

| Pozycje tabeli | Przed audytem | Po audycie |
|---|---|---|
| D – dobrze | 83 | 89 |
| P – płytko | 18 | 13 |
| B – brak | 2 | 1 (`zdrowie`, bez logiki) |

## Nowe testy z audytu

| Plik | Co sprawdza |
|---|---|
| `tests/audyt-druk.test.cjs` | PDF dla drukarni z okładką miękką i twardą: rozmiar strony okładki = przód + grzbiet + tył (twarda: z zawinięciem), spad i pas znaków cięcia dookoła, okładka pierwsza, 64 strony środka w swoim formacie. **Wcześniej żaden test nie eksportował okładki do PDF.** |
| `tests/audyt-strony.test.cjs` | Menu strony: zmiana nazwy, duplikat niezależny od oryginału, przesuwanie w sekcji (z wyłączonym „niżej” na końcu sekcji), przeniesienie do innej sekcji, usunięcie z „Anuluj”/„OK” i „Cofnij” – wszystko po zapisie i wczytaniu z konta. Do tego błąd nr 1 (niżej). |
| `tests/audyt-kontrola.test.cjs` | „Sprawdź przed drukiem” – uwagi, których nic nie wywoływało: pokrycie farbą > 300 % (z profilem), zerwany odsyłacz, niepełny ostatni blok serii, seria stała dłuższa niż tabela; plus brak fałszywych alarmów. |
| `tests/audyt-zapis.test.cjs` | Błędy nr 2 i 3 (niżej): zmiana tuż przed przeładowaniem karty zostaje i trafia na konto. |
| `tests/mcp.test.cjs` (nowy test) | `kolejnosc_elementow` – jedyne narzędzie łącznika bez testu: kolejność na stronie i we wzorcu, odrzucenie niepełnej listy bez zmian, klucz tylko do odczytu. |

## Błędy znalezione przy audycie (naprawione)

1. **„Cofnij” w trakcie wczytywania strony cofało niewłaściwą czynność.** Usunięcie (i inne czynności na stronach)
   zapisuje krok cofania dopiero po wczytaniu płótna; na wolnym telefonie „Cofnij” w tym czasie cofało *poprzednią*
   czynność, a usunięta strona nie wracała. Teraz cofanie czeka na koniec wczytywania (`js/app/zapis.js`).
2. **Zmiana zrobiona do ok. 0,7 s przed zamknięciem albo przeładowaniem karty ginęła.** Zapis w przeglądarce czekał
   na opóźnienie, a przy zamykaniu strony tylko przepisywano płótno do pamięci. Teraz zapis rusza przy
   `beforeunload`/`pagehide` (`js/app/edytor-start.js`).
3. **Niewysłana zmiana z urządzenia nie szła na konto po ponownym otwarciu**, gdy na koncie nie było nowszej wersji –
   zostawała tylko na urządzeniu, a pasek pokazywał „Zapisano”. Teraz otwarcie projektu z niewysłanymi zmianami
   uruchamia wysyłkę. Do tego zbiór „zmienione tu ręcznie” (#138) przeżywa przeładowanie: wcześniej niewysłana ręczna
   zmiana wyglądała po przeładowaniu na „nieruszoną” i przy łączeniu przegrywała z kontem **bez pytania**. Teraz
   w takim wyścigu pada pytanie o wersję (nic nie ginie po cichu).

## Niestabilne testy – poprawione u źródła (w testach)

| Test | Przyczyna | Poprawka |
|---|---|---|
| `nadpisywanie` – dwa urządzenia i AI naraz | przygotowanie dopisywało element wprost do modelu strony otwartej na płótnie; zaplanowany zapis przepisywał płótno (bez elementu) z powrotem | zmiana modelu razem z odłączeniem płótna w jednym kroku |
| `udostepnianie` – link z hasłem | komunikat „sukces” pojawia się przed wpisaniem linku do pola (w `finally`) | czekanie na koniec publikacji, nie na komunikat |
| `pioro-kapitaliki` – kapitaliki | pomiar „Ż” przed doczytaniem podzbioru czcionki z polskimi znakami | pomiar po `document.fonts.ready` |
| `druk-w-domu` | projekt otwierany wprost zmienia adres; obsługa adresu zamyka świeżo otwarte menu ⋯ | menu otwierane, aż pozycja jest widoczna |
| `porzadki` – kształty (gradient po przeładowaniu) | to był błąd nr 2 | naprawione w aplikacji |
| `admin` – skrzynka, gwiazdka | pętla czekała na odpowiedź tylko 2,5 s | czekanie do 10 s (ta sama asercja) |
| `karta-ai` – otwarcie po przeładowaniu bez nowej wersji | po poprawce nr 3 otwarcie wysyłało kopię bez zmian | wysyłka przy otwarciu tylko, gdy kopia różni się od stanu uzgodnionego z kontem |

Dalsze niestabilne testy poprawione w #184 (DECYZJE): `zasoby` – „obrazy poza pamięcią” (pod obciążeniem zapisywał się
kilkubajtowy plik zamiast oryginału – zapis jest teraz sprawdzany odczytem i powtarzany), `grupa`, `czcionki`,
`instrukcja` (bez konta), `audyt-strony`, `admin-zapisy`, `poczta` (losowy błąd raz na 64), `rozkladowka-przycisk`,
`dostep-ai`.

## Tabela funkcji

Testy podane bez `.test.cjs`. „→” – zmiana głębokości po audycie.

### Konto, projekty, zapis

| Funkcja | Testy | Gł. | Luki / uwagi |
|---|---|---|---|
| 2.1 Zakładanie konta | konto, nazwy-uzytkownikow | D | – |
| 2.2 Logowanie i hasło | konto, poczta | D | prawdziwy e-mail – ręcznie |
| 2.3 Ustawienia konta | konto, urzadzenia | D | – |
| 2.4 Motyw | konto, wiele testów z `motyw` | D | – |
| 2.5 Miejsce i limity | miejsce, pliki-r2, worker-pliki | D | – |
| 2.6 Powiadomienia | powiadomienia-push, powiadomienia-ustawienia | P | push na prawdziwym telefonie – ręcznie |
| 2.7 Usuwanie konta | konto | P | usuwanie danych w bazie – tylko atrapa |
| 2.8 Kontakt | admin, poczta-worker | D | – |
| 2.9 Zestaw marki | zestaw-marki | D | – |
| 3.1 Lista projektów | edytor, wyglad-109, podglad-z-kafelka | D | – |
| 3.2 Nowy projekt | edytor, okladka | D | – |
| 3.3 Menu projektu | narzedzia, pliki-r2 | D | – |
| 3.4 Zapis | konto, zywo, nadpisywanie, audyt-zapis | P → D | luka: zamknięcie karty zaraz po zmianie (błąd nr 2) |
| 3.5 Kilka urządzeń i cofanie | laczenie, zywo, historia-zapis, nadpisywanie, karta-ai | D | – |
| 3.6 Plik projektu | pliki, czcionki, format-ai | D | – |

### Edytor

| Funkcja | Testy | Gł. | Luki / uwagi |
|---|---|---|---|
| 4.1–4.6 Ekran edytora, paski, menu, panele | edytor, urzadzenia, kompaktowosc, menu-narzedzi-telefon, panel-115, wyglad-109 | D | – |
| 5.1 Wstawianie | edytor, wklejanie, biblioteka | D | – |
| 5.2 Zaznaczanie | precyzja, grupa | D | – |
| 5.3 Przesuwanie, rozmiar, obrót | precyzja, grupa, edytor | D | – |
| 5.4 Wyrównywanie i odstępy | narzedzia, precyzja | D | – |
| 5.5 Grupy | grupa | D | – |
| 5.6 Kolejność, blokada, schowek | narzedzia, precyzja | D | – |
| 5.7 Cień | porzadki, pdf-x | D | – |
| 5.8 Biblioteka | biblioteka, biblioteka-uzupelnienie, biblioteka-porzadek | D | – |
| 5.9 Kalendarz miesiąca | biblioteka | D | – |
| 5.10 Wykres | biblioteka | P | tylko wstawienie i dane; brak PDF wykresu |
| 5.11 Kolaż | biblioteka | P | brak wymiany zdjęcia w polu kolażu |
| 5.12 Kody QR i EAN | kody | D | – |
| 5.13 Kopiuj wygląd | praca, menu-narzedzi-telefon, miekkie-krawedzie | D | – |
| 6.1–6.4 Tekst, fragment, style | tekst, sklad, biblioteka | D | – |
| 6.5 Listy | tekst-uklad | D | – |
| 6.6 Ramka tekstu | dane, dopracowanie | D | – |
| 6.7 Kolumny, tekst przez ramki | tekst-uklad, dopracowanie | D | – |
| 6.8 Czcionki | czcionki, eksport, pdf-kontrola | D | – |
| 6.9–6.13 Skład, inicjał, tabulatory, oblewanie, siatka bazowa | sklad | D | – |
| 6.14 Tekst po łuku i ścieżce | tekst-ksztalt | D | – |
| 6.15 Znajdź i zamień | praca | D | – |
| 6.16 Pisownia | praca | D | – |
| 7.1 Prostokąt, elipsa, wielokąt | porzadki, telefon-kontrolki, menu-narzedzi-telefon | D | – |
| 7.2 Linia | biblioteka-uzupelnienie | P | – |
| 7.3 Rysowanie odręczne | porzadki | P | – |
| 7.4 Pióro i punkty | pioro-kapitaliki, edytor | D | – |
| 7.5 Wypełnienie (gradient, krycie) | porzadki, przejscia-krycie | D | – |
| 7.6 Obrys | miekkie-krawedzie, biblioteka-porzadek | D | – |
| 7.7 Wybór koloru | kontrolki, kompaktowosc, praca | D | – |
| 8.1–8.4 Obraz, kadr, właściwości, podmiana | porzadki, precyzja, obrazy-projektu, edytor | D | – |
| 8.5 Obrazy projektu | obrazy-projektu, obrazy-od-ai, wydajnosc | D | – |
| 8.6 SVG | svg-elementy, wklejanie | D | – |
| 8.7 Obraz w kształcie | obraz-w-ksztalcie | D | – |
| 8.8 Usuwanie tła | usun-tlo | D | – |
| 8.9 Filtry | filtry-obrazu | D | – |
| 8.10 Obramowanie, miękkie krawędzie | miekkie-krawedzie | D | – |
| 9.1–9.5 Tabela | tabela, panel-115 | D | – |
| 10.1–10.3 Warstwy | precyzja, dopracowanie, wyglad-109, panel-115 | D | – |
| 11.1 Panel stron | porzadki, wyglad-109, gest-strony | D | – |
| 11.2 Dodawanie i porządkowanie stron | porzadki, tekst-uklad, audyt-strony | P → D | luka: nazwa, przesuwanie w sekcji, do innej sekcji, usunięcie z cofnięciem (błąd nr 1) |
| 11.3 Właściwości strony | panel-115, audyt-strony | P → D | – |
| 11.4 Ustawienia sekcji | sekcje-wzorce, wyglad-109, kontrolki | D | – |
| 11.5 Rozkładówki | sekcje-wzorce, rozkladowka-przycisk | D | – |
| 11.6 Okładka z grzbietem | okladka, okladka-wymiary, audyt-druk | P → D | luka: okładka w PDF dla drukarni |
| 11.7 Składki | okladka, okladka-wymiary | D | – |
| 11.8 Numeracja | sekcje-wzorce, dane | D | – |
| 11.9 Zmiana formatu | format-projektu | D | – |
| 12.1–12.6 Wzorce | sekcje-wzorce, porzadki | D | – |
| 13.1–13.6 Linie, ostrzeżenia, siatka, linijki, przyciąganie, powiększenie | precyzja, okladka, edytor, podglad-zoom | D | – |
| 14.1–14.7 Książka | ksiazka, ksiazka-aplikacja | D | – |

### Dane i serie

| Funkcja | Testy | Gł. | Luki / uwagi |
|---|---|---|---|
| 15.1–15.5 Tabele danych | dane, dane-dopracowanie, dane-wyglad-komorek | D | – |
| 16.1–16.3 Pola | dane, dane-wyglad | D | – |
| 17.1–17.7 Serie | dane, serie-pomijane, dane-wyglad, okladka-wymiary | D | – |
| 18.1–18.6 Wygląd z danych | dane, dane-wyglad, dane-dopracowanie, obraz-w-ksztalcie | D | – |

### Publikacja

| Funkcja | Testy | Gł. | Luki / uwagi |
|---|---|---|---|
| 20.1–20.3 Podgląd, powiększanie, prezentacja | podglad, podglad-zoom, podglad-pasek | D | – |
| 20.4 Makieta 3D | makieta-3d | D | prawdziwe GPU Androida – ręcznie |
| 20.5 Podgląd na żywo | zywo, dostep-ai | D | – |
| 21.1 Sprawdź przed drukiem | dane, okladka, serie-pomijane, kolory-druku-ui, audyt-kontrola | P → D | luka: 4 rodzaje uwag bez testu |
| 22.1 Okno eksportu | eksport, pdf-x | D | – |
| 22.2–22.3 Zaawansowane, ustawienia dla drukarni | pdf-x, pdf-kontrola, kompaktowosc | D | – |
| 22.4 Niewektorowe | pdf-wektorowy, miekkie-krawedzie | D | – |
| 22.5 PNG | eksport | P | tylko rozdzielczość |
| 22.6 Broszura, kilka stron na arkuszu | druk-arkusze, druk-w-domu | D | – |
| 22.7 PDF do czytania | druk-arkusze | D | – |
| 22.8 Drukuj w domu | druk-w-domu | P | systemowe okno drukowania – ręcznie |
| 23.1–23.6 Kolory dodatkowe, uszlachetnienia, separacje | kolory-druku, kolory-druku-ui, druk-arkusze, podglad-pasek | D | – |
| 24.1–24.4 Udostępnianie linkiem | udostepnianie, worker-pliki | D | – |

### Razem z innymi, AI, urządzenia

| Funkcja | Testy | Gł. | Luki / uwagi |
|---|---|---|---|
| 25.1–25.6 Współpraca | wspolpraca, nazwy-uzytkownikow, kontrolki-dotyk | D | prawdziwy e-mail z zaproszeniem – ręcznie |
| 25.7 Komentarze | komentarze, mcp | D | – |
| 26.1–26.5 Praca z AI | klucze-ai, klucze-ai-aplikacja, dostep-ai, polecenia-ai, karta-ai, nadpisywanie, zmiany-ai-nie-gina | D | – |
| 28.1 Gesty | edytor, gest-strony, podglad-zoom | P | prawdziwy ekran dotykowy – ręcznie |
| 28.2–28.3 Edytor na telefonie, okna od dołu | urzadzenia, zaslonki, telefon-kontrolki, kontrolki-dotyk | D | – |
| 28.4 Instalacja | instalacja | P | prawdziwa instalacja PWA – ręcznie |
| 28.5 Pełny ekran | instalacja | P | – |
| 29 Skróty klawiszowe | precyzja, kompaktowosc | P | nie każdy skrót z listy ma test |

### Łącznik AI (33 narzędzia) i serwer

| Funkcja | Testy | Gł. | Luki / uwagi |
|---|---|---|---|
| projekty, przeglad_projektu, czytaj, opis_formatu, kontrola | mcp, lacznik-mcp, klucze-ai, mcpb | D | – |
| zmien_elementy, dodaj_elementy, usun_elementy, zmien_strone, dodaj_strone, usun_strony, kolejnosc_stron, zmien_tabele, zmien_czesc, zmien_projekt, nazwa_projektu | mcp, karta-ai, lacznik-mcp | D | – |
| **kolejnosc_elementow** | mcp | B → D | nie było testu |
| nowy_projekt, usun_projekt | klucze-ai, klucze-ai-aplikacja | D | – |
| obrazy: wgraj_obraz, wgraj_czesciami, wstaw_obraz, podmien_obraz, obrazy_projektu, zmien_nazwe_obrazu, usun_obrazy, uporzadkuj_obrazy, link_do_wgrywania, adres_do_wysylki | obrazy-ai, obrazy-od-ai | D | – |
| komentarze, skomentuj, odpowiedz, rozwiaz_komentarz | mcp, komentarze | D | – |
| Edge Function `mcp` (HTTP) | lacznik-mcp | D | – |
| Edge Function `poczta` | poczta, poczta-dostawcy | D | prawdziwi dostawcy (Brevo, ZeptoMail) – ręcznie |
| Edge Function `powiadomienia` | powiadomienia-push | D | – |
| Edge Function `zdrowie` | – | B | próbna funkcja „działa” (bez logiki) – nie wymaga testu |
| Worker api.makietka.app | worker, worker-pliki, poczta-worker | D | – |
| Migracje i RLS | wspolpraca (reguły), atrapy w tests/*.cjs | P | reguły sprawdzane na atrapie, nie na prawdziwym Postgresie; ręcznie: migracje na lokalnym Postgresie przy zmianach |

Jedyna pozostała funkcja bez testu (B): `zdrowie` (bez logiki) oraz – częściowo – prawdziwe RLS w Postgresie.

## Czego nie da się sprawdzić tutaj – lista kontrolna do zrobienia ręcznie

Środowisko testów ma tylko Chromium (bez WebKita/Safari, bez prawdziwego GPU telefonu, drukarki, poczty i push).

**iPhone / iPad (Safari)** – raz po większych zmianach:
1. Zaloguj się, otwórz projekt, przesuń element palcem, powiększ dwoma palcami – strona się nie przybliża cała.
2. Przesuń szybko palcem w bok po pustym miejscu – następna strona, bez mignięcia.
3. Otwórz listę wyboru (np. czcionka) i kolor – wyjeżdżają od dołu, pasek u góry je zamyka.
4. Podgląd → Makieta 3D: obraz się rysuje, obracanie palcem działa; zamknij i otwórz drugi raz.
5. Zainstaluj (Udostępnij → Do ekranu początkowego), otwórz z ikony, włącz powiadomienia.

**Android (Chrome)**:
1. To samo co wyżej (1–4) oraz „Zainstaluj aplikację” z menu.
2. Makieta 3D: otwórz, wyjdź do ekranu głównego na minutę, wróć – obraz wraca sam.
3. Zrób zmianę i od razu zamknij kartę / aplikację; otwórz ponownie – zmiana jest (błąd nr 2).

**Druk i pliki**:
1. Drukuj w domu: broszura A4 na prawdziwej drukarce (próbna kartka, obracanie po krótszej krawędzi).
2. PDF dla drukarni z okładką: otwórz w Acrobacie – „Wyjście → Podgląd wyjścia”: okładka w rozmiarze z ustawień, spad 3 mm, CMYK.

**Konto i poczta**:
1. Rejestracja na nowy adres – przychodzi e-mail z linkiem; reset hasła – też.
2. Zaproszenie innej osoby do projektu – e-mail i powiadomienie push na jej telefonie.
3. Formularz kontaktowy z załącznikiem – wiadomość w skrzynce administratora.

**Supabase (produkcja)** – po każdej nowej migracji: w panelu Supabase → Database → Migrations sprawdź, że weszła;
w aplikacji: zapis projektu, współpraca i link z hasłem działają.
