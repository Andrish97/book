# Zgłoszenia – lista uwag i ich stan

Bieżąca lista Twoich uwag z rozmów: co zrobione, co w toku, co czeka. Szczegóły i cytaty każdej decyzji są w
[DECYZJE.md](DECYZJE.md) (numery w nawiasach). Aktualizuję ją przy każdej nowej uwadze i po każdym scaleniu.

Oznaczenia: ✅ zrobione i wdrożone · 🔄 w toku · ⏳ czeka (kolejny etap) · 👤 krok po Twojej stronie

## W toku

| # | Uwaga | Stan |
|---|---|
| 114 | Instrukcja od nowa: sekcje i podsekcje, strona główna z kafelkami, spis na telefonie w zasłonce, mniej tekstu i więcej obrazów, bez technikaliów, nowy opis Makietki, dostęp bez konta | 🔄 |
| 125 | Okładka: wpisanie grzbietu albo całego rozmiaru okładki | 🔄 |
| 127 | Uszlachetnienia (lakier UV, złocenie, tłoczenie, biały poddruk), kolory dodatkowe (Pantone), tryb cz/b + 1 kolor | 🔄 |
| 128 | Kod QR i kod kreskowy EAN/ISBN | 🔄 |
| 125 | Okładka: wpisanie grzbietu albo całego rozmiaru okładki | 🔄 |
| 128 | Kod QR i kod kreskowy EAN/ISBN | 🔄 |
| 137 | Niestabilne testy – przyczyny i naprawa | 🔄 |

## Czeka (kolejne etapy)

| Uwaga | Stan |
|---|---|
| 137 (reszta): „obrazy poza pamięcią” pada jeszcze ok. raz na 2–3 pełne przebiegi pod obciążeniem – pliki obrazów z magazynu przeglądarki bywają wtedy nieczytelne (adres pliku daje 404, eksport bierze mniej plików); przyczyna w magazynie nieustalona do końca, obraz na stronie już nie znika (świeży adres albo obraz zastępczy) | ⏳ do zbadania |
| Skrzynka jak w Familiadzie (bez marketingu, styl Makietki): foldery, lista, wątki, pisanie nowych wiadomości z TinyMCE, odpowiedz/przekaż, robocze, załączniki, operacje zbiorcze | ⏳ zaraz |
| Instrukcja: dopisać funkcje z #103 (Ctrl+K, kolory projektu, tabela −/+, PDF „Zaawansowane”) i zrzuty nowych rozdziałów | ⏳ |
| Reszta propozycji wyglądu i edytora z #103 na później: pasek szybkich akcji przy zaznaczeniu, podgląd wybranego wiersza danych w edytorze, szablony startowe, segmenty w Serii, Szer./Wys./Spad w rzędzie, ⋯ na karcie obrazu | ⏳ |
| Pełny przegląd zrzutów wszystkich ekranów po zmianach #103/#104 (kolejny etap poprawek interfejsu) | ⏳ |
| Sprawdzenie na prawdziwym telefonie: gesty iPhone (#101), klawiatura w zasłonkach, instalacja aplikacji | ⏳ |

## Kroki po Twojej stronie

| Krok | Stan |
|---|---|
| Cloudflare → makietka-api → Settings → Variables and Secrets → sekret `SUPABASE_SERVICE_ROLE_KEY` (secret key z Supabase → Project Settings → API Keys) – po wdrożeniu #106 | 👤 |
| Email Routing: kontakt@, noreply@, no-reply@ → Send to a Worker → makietka-api (catch-all zostaje) | 👤 |
| Zoho: weryfikacja domeny makietka.app (support), potem włączenie ZeptoMail w panelu | 👤 |
| Supabase → Storage: w bucketach `zasoby` i `podglady` zaznacz wszystko → Delete, potem ⋯ → Delete bucket | ✅ zrobione |
| Link z hasłem: otwórz okno Udostępnij i opublikuj link ponownie (stary link bez sekretu jest nieaktywny) | 👤 |
| Wyczyścić dane strony andrish97.github.io na swoich urządzeniach (stary moduł offline nie przekierowuje) | 👤 |

## Zrobione

| # | Uwaga |
|---|---|
| 158 | Wydajność: bufory Fabric tylko dla elementów, którym się opłacają (odrysowanie strony ~6× szybciej, 72 MB → 0 MB pamięci buforów na gęstej stronie), zmiana strony bez przebudowy listy stron, szybsze porównania przy zapisie, miniatury nie przeszkadzają w pisaniu i przeciąganiu, moduły pobierane naraz (`modulepreload`). |
| 156 | Obramowanie zdjęcia (kolor z kryciem, grubość, rodzaj linii, zaokrąglone narożniki przycinające zdjęcie) i miękkie krawędzie zdjęć i kształtów (równo wzdłuż brzegu albo owalna winieta) – w edytorze, podglądzie, PNG i PDF. |
| 155 | Biblioteka: porządek (Planer tylko tabele i siatki do notatek, osobna kategoria Ramki, każdy kształt w jednym miejscu) i rozbudowa – ponad 400 kształtów (Kształty 200+, Ramki 80+ w grupach, ozdobniki, separatory, etykiety), nagłówki grup w oknie, ramki przerywane, pola na zdjęcie, obramowania stron |
| 153 | Makieta 3D jak zdjęcie produktu: rzeczywiste proporcje bez rozciągania, światło z cieniem rzucanym i kontaktowym (stół, ściana), cień w zgięciu, wygięte kartki, krawędzie kartek, zaokrąglony grzbiet twardej oprawy bez artefaktów, spirala z drutu, stojak biurkowy z tektury, tło studia (też w PNG 3200 px). |
| 139 | Przegląd spójności ze zrzutami (telefon 360 px i komputer, jasny i ciemny motyw, 36 okien): menu ⋯ paska wstawiania na telefonie (wielokąt, rysowanie, pióro, komentarz, „Kopiuj wygląd”; działające narzędzie widać na ⋯), menu ⋯ projektu w grupach, podwójny znaczek przy „Zaawansowane” naprawiony, przyciski podglądu bez pustych ramek, przełączniki segmentowe po równo, „Zmień format” – pola w rzędzie jak w sekcji. |
| 143 | Uzupełnienie Biblioteki: 120 kształtów (nowe figury, gwiazdy, strzałki, dymki, wstęgi, ramki, linie ozdobne, ikony), nowe kategorie „Linie i separatory” (ciągła, cienka, gruba, przerywana, kropkowana, kreska – kropka, podwójna, pionowa; rodzaj linii w panelu), „Etykiety i plakietki” i „Planer” (11 gotowych tabel: lista zadań, tracker nawyków, plan tygodnia i dnia, notatki w linie, siatka dni, lista zakupów, cele, budżet, kontakty, plan lekcji; pola wyboru, kratka i kropki co 5 mm) |
| 149 | Zmiana strony (gest, lista stron) na telefonie bez stanów pośrednich: zamrożony obraz poprzedniej strony do pełnego narysowania nowej, płótno nie jest już czyszczone przy tym samym rozmiarze. |
| 145 | Drukuj w domu: zwykły wydruk, broszura do złożenia, 2/4 strony na kartce, papier A4/A3/Letter, druk z przeglądarki i pomoc krok po kroku (menu ⋯, Ctrl+P) |
| 131D komentarze | Komentarze na stronach: narzędzie „Komentarz” na pasku narzędzi (miejsce na stronie albo zaznaczony element), pinezki z numerem na płótnie i w podglądzie (nie w PDF), przycisk „Komentarze” z licznikiem nierozwiązanych na górnym pasku edytora i w podglądzie (na wąskim telefonie w ⋯), wątki odpowiedzi, @wzmianki z podpowiedziami, „Rozwiąż” / „Otwórz ponownie”, filtry nierozwiązane / wszystkie / moje, „Pokaż na stronie”; na żywo między kontami; komentują też osoby „może oglądać”; powiadomienia push (przełącznik „Komentarze”), link z powiadomienia otwiera wątek; AI: narzędzia `komentarze`, `skomentuj`, `odpowiedz`, `rozwiaz_komentarz`; instrukcja 25.7 ze zrzutami. |
| 131D | Zmiana formatu ze skalowaniem (menu ⋯ projektu i okno sekcji; skaluj / przesuń / tylko format, podgląd przed i po, jeden krok cofania), zestaw marki na koncie (kolory z nazwami i Pantone, czcionki, logo; „Marka” w oknie koloru, na liście czcionek i w Bibliotece; „Zastosuj markę do projektu” z podglądem), makieta 3D w podglądzie (książka miękka i twarda z okładką, notes, kalendarz ścienny i biurkowy, kartka; kartkowanie, obracanie, PNG); instrukcja 2.9, 11.9, 20.4 |
| 131C „praca”, 136, 140 | Znajdź i zamień (lupa na górnym pasku, pierwsza pozycja ⋯, Ctrl+F / Ctrl+H, strony, wzorce, opcjonalnie dane i nazwy stylów; „Zamień wszystkie” jednym krokiem cofania; pola {…} nietknięte), Kopiuj wygląd – malarz formatów (nagłówek panelu, ⋯ na liście warstw, Ctrl+Alt+C / Ctrl+Alt+V, tryb ciągły, fragment tekstu), Moje elementy w Bibliotece (na koncie, z obrazami), sprawdzanie pisowni po polsku (falista linia, dymek z podpowiedziami przy słowie, własny słownik na koncie); „Użyte w projekcie” w oknie koloru i na liście czcionek z liczbą użyć; instrukcja 4.3, 4.6, 5.8, 5.13, 6.8, 6.15, 6.16, 7.7 |
| 138 | Psucie i nadpisywanie pracy: elementy nieruszone ręcznie biorą wersję z konta bez pytania, po powrocie sieci najpierw konto; kopie awaryjne i dziennik zapisów na serwerze (panel administratora → „Zapisy i kopie”); 8 scenariuszy w testach |
| 131C | Druk: broszura do składania i ze składek, 2 i 4 strony na arkuszu (plan arkuszy, pełzanie, znaki złamu); PDF do czytania na ekranie (zakładki, klikalny spis treści, odsyłacze, linki elementów i kodów QR); podgląd separacji (płyty CMYK, kolory dodatkowe, uszlachetnienia z nadrukiem, pokrycie farbą) i ostrzeżenie o pokryciu w „Sprawdź przed drukiem” |
| 137 | Niestabilne testy naprawione u źródła: historia nie zapisuje stanu w trakcie kadrowania, płótno wczytuje się po kolei, lista projektów nie wyrzuca z edytora, menu karty nie znika, przerwany pierwszy zapis bez fałszywego konfliktu |
| 131B | Książka: spis treści (z Biblioteki, sam się układa, z powieleniami serii), żywa pagina {rozdzial}, przypisy dolne z panelu (numeracja w sekcji / na stronie / w całości), odsyłacze „s. 12”, skorowidz z polskim sortowaniem; podgląd, PDF, łącznik AI, rozdział 14 instrukcji |
| 131B | Tekst po łuku, okręgu, elipsie i ścieżce oraz wyginanie (fala, flaga, wypukłość…) – panel „Kształt tekstu”, uchwyt zgięcia, Biblioteka „Teksty”, PDF wektorowy, instrukcja 6.14 |
| 131A | Typografia: dzielenie wyrazów po polsku, spójniki na końcu wiersza, wdowy i sieroty, inicjały, tabulatory z wypełniaczem, style znakowe, siatka linii bazowych, oblewanie tekstem (prostokąt, kształt, skok) – w edytorze, podglądzie i PDF |
| 148 | Widoczny przycisk rozkładówka / jedna strona; zmiana strony bez pośrednich stanów |
| 147 | Projekt otwiera się na ostatnio edytowanej stronie |
| 146 | Gest: szybkie przesunięcie w bok na telefonie zmienia stronę |
| 144 | Okładka przeliczana od razu przy przejściu na jej stronę |
| 143 | Ikonki kodu QR i EAN w Bibliotece – prawdziwe kody zamiast szkicu |
| 142 | Opis formatu dla AI pilnowany testem (każde nowe pole opisane); pola liczone przez aplikację chronione |
| 141 | Projekt się nie otwierał (błąd „reading 'find'”) – okładka zapisana przez AI po swojemu; naprawione w aplikacji i łączniku |
| 135 | Zmiany od AI znikały po otwarciu projektu na innym urządzeniu – bezpieczne domyślne wybory, bez nadpisywania konta, wersje liczone numerem |
| 133 | Marginesy i inne wymiary w mm – dowolna wartość, nie tylko co 0,5 |
| 132 | Instrukcja na telefonie dawała się przewinąć cała (pusto pod stopką) |
| 125 | Okładka: „Wymiary – Policz same / Wpisz grzbiet / Wpisz rozmiar okładki”, liczone wartości jako podpowiedź |
| 126 | Składki liczą strony po powieleniach serii – sprawdzone testem (licznik, „Dopełnij pustymi”, kontrola) |
| 128 | Kod QR (adres, tekst, e-mail, telefon, Wi-Fi; z pola danych) i kod kreskowy EAN-13 / ISBN – wektorowo, z ostrzeżeniami |
| 127 | Kolory do druku: kolory dodatkowe (Pantone) na osobnych płytach, uszlachetnienia (lakier UV, złocenie, tłoczenie, wytłoczenie, biały poddruk) z nadrukiem, tryb skali szarości i cz/b + 1 kolor; okno „Kolory do druku”, część „Uszlachetnienie” w panelu, rozdział 22 instrukcji |
| 131A, 134 | Biblioteka – jedno okno z wyszukiwarką i kategoriami (kształty, strzałki i dymki, ozdobniki i ramki, kalendarze, wykresy, kolaże), przeciąganie na stronę; kalendarz miesiąca ze świętami i miesiącem z danych, wykresy z tabel danych, ~60 kształtów, 12 kolaży; łącznik AI i instrukcja (5.8–5.11) |
| 114b | Instrukcja po #115–#123: okładka z grzbietem i składki (tekst zgodny z oknem sekcji), pasek stron i uchwyt na telefonie, załączniki w formularzu kontaktowym, kontrola przed drukiem (niepełna składka), linie zgięć; 13 nowych zrzutów (jasne i ciemne): okładka, okno okładki, przypięcie, składki, obraz w kształcie, kadrowanie w kształcie, Usuń tło, filtry, krycie w przejściu, pasek stron na telefonie, formularz kontaktowy |
| 117 | Pasek stron na telefonie: miniatury na całą wysokość paska, wąska etykieta sekcji, mniejszy ⋯, kafelek „+” tej samej wysokości |
| 118 | Uchwyt arkuszy na telefonie: stuknięcie zwija powiększony, zwykły zamyka (już nie rozwija) |
| 121 | Własna ikona „Zamień orientację” (kartka ze strzałką), inna niż Cofnij/Ponów |
| 122 | Ostrzeżenia na telefonie na całą wysokość arkusza, z przewijaniem |
| 120 | Składki (×4/8/16/32) w ustawieniach sekcji: licznik „46 z 48 – brakuje 2” na liście stron, uwaga przed drukiem, „Dopełnij pustymi” z cofaniem |
| 119 | Okładka liczona sama: rodzaj sekcji „Okładka z grzbietem” (oprawa miękka/zeszytowa/twarda, papier – gramatura albo grubość kartki, strony środka liczone albo wpisane), schemat i wynik w oknie, strefy na płótnie i w podglądzie, elementy przypięte do tyłu/grzbietu/przodu przesuwają się same, „Zamień na okładkę”, okładka w kreatorze; poprawione ostrzeżenia linii przy spadzie |
| 123 | Z Canvy: kształt jako ramka obrazu (kadr, wyjęcie, dane, PDF wektorowy), zdjęcie z zaokrąglonymi rogami / w kole, usuwanie tła bez AI (nowy plik), przezroczystość w przejściach (PDF z maską), filtry obrazu, obrys liter. Na później: kod QR, tekst po łuku |
| 116 | Załączniki w formularzu kontaktowym (do 5 plików, 10 MB) – trafiają do zgłoszenia w skrzynce |
| 113a | Powiadomienia bez sekretów: klucze tworzą się same, nic nie trzeba ustawiać |
| 113 | Powiadomienia push jak w Familiadzie: zaproszenie, udostępnienie, odpowiedź na zaproszenie, zmiana roli, odebranie dostępu; włączanie w Ustawieniach konta |
| 73 | Okna jako zasłonki na telefonie i tablecie, przegląd zrzutów |
| 74 | Familiada – korzystać do woli |
| 71 | Duże zdjęcia od AI w kawałkach (do 25 MB) |
| 75–77 | Zdjęcia z komputera i z czatu: link do wgrania, ChatGPT pliki z czatu, `wgraj_czesciami` bez domen |
| 78–79 | Claude odrzucał listę narzędzi łącznika (`_meta`, `ttlMs`/`cacheScope`) |
| 80 | Otwarta karta nadpisywała zmiany AI |
| 81 | Tekst od AI Times 40 mm → Inter 14 pt |
| 82 | Okno obrazów otwierało się długo i lagowało |
| 83 | Optymalizacja (pisanie, przeciąganie, zapis) i karta postępu |
| 84, 101 | Powiększanie i gesty w podglądzie; procent zmienia tylko strony (iPhone) |
| 86 | Współpraca między kontami, wspólna edycja, obecność |
| 87 | Działać bez pytania |
| 88–89 | Marka Makietka, domena makietka.app, przekaźnik api.makietka.app |
| 90, 92, 93, 96 | Miejsce na koncie, pliki w R2, limity (2 GB, 50 MB, 100 projektów, 1000 obrazów, 20 osób), panel użycia konta |
| 91 | Tryby urządzeń i przegląd 70 widoków × 15 urządzeń |
| 94, 100 | Klucz AI dla całego konta, tylko w ustawieniach konta |
| 95, 95h | Panel administratora: skrzynka kontakt@, kolejka, ustawienia poczty, limity, statystyki; formularz kontaktowy bez maili |
| 96 | Podpowiedzi o klawiaturze schowane na telefonie |
| 97 | Sprzątanie bazy (129 MB linków z hasłem → R2) |
| 92b | Stary magazyn i kod przenoszenia usunięte |
| 99 | Własne kontrolki (listy na telefonie), instalacja aplikacji, bezpieczne marginesy, plakietka na kafelku, pełny ekran na logowaniu, przycisk motywu |
| 100 | Nazwy użytkownika (rejestracja, pierwsze logowanie, zapraszanie po nazwie); konto bez danych całej aplikacji |
| 104 | Instrukcja w stylu Familiady: 42 rozdziały, spis z wyszukiwarką, edytor i panel właściwości szczegółowo, dane w praktyce (kalendarz ze świętami, dziennik, planer, obrót i kolor z danych), AI krok po kroku + komiks + polecenia „Kopiuj”, automatyczne zrzuty w CI |
| 105–106 | ZeptoMail (Zoho, EU) jako drugi dostawca po Brevo, włączany przełącznikiem; sekrety po angielsku, bez klucza skrzynki – jeden sekret `SUPABASE_SERVICE_ROLE_KEY` |
| 108 | Konta testowe usunięte |
| 107 | Bez starego magazynu i trybu przejściowego linków; okno Dostęp dla AI: polecenie „Podłącz Makietkę” do skopiowania na wierzchu (adres wpisany po utworzeniu klucza), przycisk pobrania rozszerzenia dla Claude Desktop, krótkie zwinięte opisy aplikacji |
| 103 | Kompaktowość i ikony (13 propozycji: tabela −/+, PDF „Zaawansowane”, ikony w Danych, Czcionkach, Obrazach, zaproszeniach, imporcie) + paleta poleceń Ctrl+K i kolory projektu w wyborze koloru |
| 114 | Instrukcja jako pełny podręcznik w układzie Familiady: części, rozdziały, numerowane podrozdziały, tabele opcji, kadry z zaznaczeniem; strona główna, spis dwupoziomowy, spis-zasłonka na telefonie; dostęp bez konta; nowe pozycjonowanie Makietki; bez samoczynnego otwierania |
| 115 | Warstwy w osobnym panelu (zawsze widoczne; na telefonie zakładka „Warstwy”), nagłówek panelu: zaznaczony element / ustawienia narzędzia / strona, pędzel rysowania, tabela: „Cała tabela” i „Kolumna i wiersz” klikniętej komórki |
| 112 | Szary procent po stuknięciu, opis tabeli prostymi słowami, ikona książki dla instrukcji wszędzie, pole szukania z lupą, kroki instrukcji rozbite na kolumny |
| 111 | „Podgląd” na kafelku otwiera od razu podgląd, bez mignięcia edytora |
| 102 | Pasek prezentacji, wspólna kontrolka powiększenia, X zamiast „Zamknij” |
| 109 | 15 decyzji wyglądu: chmurka na karcie, ikony na górnym pasku z napisami „gdy się mieszczą”, „Wygląd edytora” w menu widoku, akcje przy zakładkach, kółko koloru przy rozmiarze, kafelek „+” na liście stron, warstwy z uchwytem ⋮⋮, „+” przy wzorcach, gumka i kosz w oknach, schemat marginesów, ustawienia konta jako lista, Wyloguj w menu awatara, jaśniejsze logowanie, zasłonki bez „Anuluj” |
| – | Brevo: wysyłka działa po wyłączeniu blokady IP (reset hasła sprawdzony) |
