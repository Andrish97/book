# Zgłoszenia – lista uwag i ich stan

Bieżąca lista Twoich uwag z rozmów: co zrobione, co w toku, co czeka. Szczegóły i cytaty każdej decyzji są w
[DECYZJE.md](DECYZJE.md) (numery w nawiasach). Aktualizuję ją przy każdej nowej uwadze i po każdym scaleniu.

Oznaczenia: ✅ zrobione i wdrożone · 🔄 w toku · ⏳ czeka (kolejny etap) · 👤 krok po Twojej stronie

## W toku

| # | Uwaga | Stan |
|---|---|---|

## Czeka (kolejne etapy)

Runda 3 (uwagi z 18.11) – pełny plan z kolejnością: [PLAN-RUNDA-3.md](PLAN-RUNDA-3.md).

| Uwaga | Stan |
|---|---|
| 161 (reszta, #185 – makieta już o tym ostrzega z przyciskiem „Ustaw typ sekcji…”): projekt użytkownika do czasu ustawienia typów wyklejek (sekcje wyklejek → typ „Wyklejka przednia / tylna”) pokaże je jako zwykłe rozkładówki | 👤 |
| Makieta 3D: gotowe ujęcia (przód, ¾, z góry, grzbiet, stojąca, wachlarz, stos), ustawienia kamery/światła/tła/materiałów, eksport rozmiarów i przezroczystości, animacja MP4/GIF, zapamiętanie ujęcia – po #161 | ⏳ |
| 161 (reszta): makieta 3D – obwoluta (osobny obiekt nałożony na okładkę, skrzydełka zawinięte do środka) jeszcze nie pokazywana; rola sekcji tylko z jawnego typu (typSekcji w js/app/makieta-okno.js – do podpięcia pod wspólną funkcję z #177); obwoluta (typ 'obwoluta') pomijana – model obwoluty do zrobienia. Projekt użytkownika do czasu ustawienia typów wyklejek pokaże je jako zwykłe rozkładówki | ⏳ |
| 161 (uwaga): geometria okładki bez listy sekcji środka (tryb auto) bierze format pierwszej sekcji – gdy to wyklejka A4, okładka liczy się dla A4 (makieta już tego nie przenosi, ale sama okładka do druku – do sprawdzenia razem z rolami sekcji #177) | ⏳ do sprawdzenia |
| Makieta 3D dla sekcji specjalnych (ulotka składana, koperta, pudełko złożone z wykrojnika, kalendarz trójdzielny) – #177 | ⏳ |
| Reszta propozycji wyglądu i edytora z #103 na później: pasek szybkich akcji przy zaznaczeniu, podgląd wybranego wiersza danych w edytorze, szablony startowe, segmenty w Serii, Szer./Wys./Spad w rzędzie, ⋯ na karcie obrazu | ⏳ |
| Skrzynka jak w Familiadzie (bez marketingu, styl Makietki): foldery, lista, wątki, pisanie nowych wiadomości z TinyMCE, odpowiedz/przekaż, robocze, załączniki, operacje zbiorcze | ⏳ zaraz |
| 160: ręczna lista kontrolna z docs/TESTY.md – Android sprawdzony przez użytkownika 2026-11-16 (wszystko OK); punkty 1–4 iPhone'a i pliki do druku sprawdza teraz symulacja (#186); zostają prawdziwy Safari (instalacja, powiadomienia) i papier/preflight drukarni (iPhone/Safari, Android, prawdziwa drukarka, e-maile, push, migracje na produkcji) – tego nie sprawdzą testy w tym środowisku | ⏳ ręcznie / do zbadania |

## Kroki po Twojej stronie

| Krok | Stan |
|---|---|
| Cloudflare → makietka-api → Settings → Variables and Secrets → sekret `SUPABASE_SERVICE_ROLE_KEY` (secret key z Supabase → Project Settings → API Keys) – po wdrożeniu #106 | 👤 |
| Email Routing: kontakt@, noreply@, no-reply@ → Send to a Worker → makietka-api (catch-all zostaje) | 👤 |
| Zoho: weryfikacja domeny makietka.app (support), potem włączenie ZeptoMail w panelu | ✅ zrobione (ZeptoMail działa) |
| Supabase → Storage: w bucketach `zasoby` i `podglady` zaznacz wszystko → Delete, potem ⋯ → Delete bucket | ✅ zrobione |
| Link z hasłem: otwórz okno Udostępnij i opublikuj link ponownie (stary link bez sekretu jest nieaktywny) | 👤 |
| Wyczyścić dane strony andrish97.github.io na swoich urządzeniach (stary moduł offline nie przekierowuje) | 👤 |

## Zrobione

| # | Uwaga |
|---|---|
| 205 | Motyw: przycisk na górze z trzema trybami (jak w systemie, jasny, ciemny) – jak w Familiadzie |
| 246 | Zwykły ChatGPT: poprawione linki narzędzi na stronie dla AI (zawsze https://api.makietka.app) i dopisek przy „Zadanie:” |
| 245 | Bez GPT „Makietka” (OpenAI wycofuje własne GPT) |
| 244 | Łącznik z logowaniem: „Połącz z Makietką” w Claude/ChatGPT bez kopiowania klucza |
| 243 | Okno „Sztuczna inteligencja” w trzech zakładkach: czat w Makietce (Twoje klucze), łącznik (zwykle płatny plan), zwykły czat |
| 242 | Gotowe polecenie dla zwykłego czatu w oknie AI |
| 241 | Klucze API do AI zaszyfrowane Twoim hasłem i zapisane na koncie – nikt poza Tobą, także twórca, ich nie odczyta |
| 240 | Nowa ikona i znak Makietki: strona w znakach cięcia |
| 239 | AI bez płatnego klucza: czat „kopiuj i wklej” z dowolnym darmowym czatem i dostęp przez zwykłe adresy dla AI, które czyta strony |
| 238 | Składanki: makieta 3D składa części po zgięciach (z nadrukiem), instrukcja montażu do pobrania albo jako strona |
| 237 | Składanki: szablony z wymiarów – pudełko z wieczkiem (z grubością materiału), tacka, kostka, graniastosłup, ostrosłup, przegródki |
| 236 | Składanki: „Rozłóż” – części na arkuszach z obracaniem i dokładaniem arkuszy; ostrzeżenie o nachodzących częściach |
| 235 | Składanki: lista połączeń (co z czym, na którym arkuszu) i podświetlanie pary na arkuszu |
| 234 | Składanki: sprawdzanie modelu przed drukiem – numery bez pary, różne długości, za małe miejsca klejenia, za wąskie szczeliny, części poza arkuszem |
| 233 | Składanki i wycinanki – krok 1: sekcja z arkuszem i materiałem (grubość z gramatury), części modelu, zgięcia, łączenie krawędzi numerami, miejsca klejenia, szczeliny |
| 232 | Raport „co przejdzie, a co nie” przy zapisie dla innych programów i po wczytaniu z nich – z pokazaniem elementów; tabele z InDesigna i formatowanie przy polach scalania |
| 231 | Zapis dla Scribusa i InDesigna sprawdzony w prawdziwym Scribusie – poprawione czcionki, ucinany tekst, rozmiar zdjęć |
| 230 | Odczyt IDML/SLA/PUB sprawdzony na prawdziwych plikach: strony wzorcowe jako wzorce, starsze pliki Scribusa, kolory z palety Publishera |
| 229 | Zapis dla Worda z układem stron (także seria z polami scalania) i strony jako SVG |
| 228 | Otwieranie plików Microsoft Publishera (.pub): strony, teksty z wyglądem, obrazy, wzorce |
| 227 | Źródło danych przypięte do tabeli: plik Excel w projekcie, nowa wersja z porównaniem, odśwież z pliku i z linku (arkusz Google) |
| 226 | Seria dla InDesigna, Affinity, Scribusa, Worda i Publishera: szablon z polami + dane (CSV, XLSX, obrazy) |
| 225 | Otwieranie projektów z InDesigna (.idml) i Scribusa (.sla), także z pakietem obrazów; pola korespondencji seryjnej |
| 223 | Naklejki okrągłe i zawieszki z otworem na arkuszu użytków; szablon „Zawieszki na prezenty” |
| 222 | Wykrojnik z zadrukiem z obu stron – wnętrze pudełka, koperty i teczki |
| 221 | Zapis projektu dla InDesigna (.idml) – też Affinity Publisher i QuarkXPress |
| 220 | Zapis projektu dla Scribusa (.sla) – teksty edytowalne, kształty, obrazy w pliku |
| 219 | Język aplikacji: polski, angielski i ukraiński – przycisk z flagą na górze |
| 218 | Wycinanki: linie cięcia, bigu, perforacji i kleju (płyty w PDF, plik SVG dla plotera, kontrola, czy się wytnie i złoży) |
| 217 | Asystent AI w Makietce z własnym kluczem: Anthropic, OpenAI, Gemini, DeepSeek, Mistral, xAI, OpenRouter (logowanie) i zgodne; wybór modelu; dostęp tylko do otwartego projektu (czytanie albo zmiany) |
| 215 | Makieta 3D dobrana do projektu (książka nie jest kalendarzem), reszta w „Nie pasuje do projektu” z podpowiedzią; wszystkie makiety przetestowane na prawdziwych projektach |
| 216 | Tekst z Worda, ODT, Markdown i TXT do książki (strony same, rozdziały od nowej strony); zapis tekstu do Worda i EPUB |
| 214 | Materiał okładki (druk z folią albo płótno, skóra ekologiczna, papier strukturalny, aksamit – w kolorach), zaokrąglone rogi, okleina w 3D, „Specyfikacja dla drukarni” |
| 213 | Podłoże sekcji: kolorowy papier albo przezroczysta folia – widać w edytorze i podglądzie, w PDF się nie drukuje; ostrzeżenia o bieli i białym poddruku |
| 212 | Książka: strony dokładane same dla długiego tekstu (i puste usuwane), wybór „akapit od nowej strony” przy rozdziałach |
| 211 | Kilka zestawów marki: nowy, kopia, nazwa, usuwanie; projekt pamięta swój zestaw, konto ma zestaw w użyciu |
| 210 | Kopiowanie elementów (Ctrl+C / Ctrl+V), stron i całych sekcji między projektami – z obrazami, wzorcami, danymi i stylami |
| 209 | Pola z ustawień projektu bez wpisywania: {format}, {oprawa}, {grzbiet}, {stron_bloku}, {papier}, {rok_kalendarza} – grupa „Z ustawień projektu” w „Wstaw pole” |
| 208 | Szablony projektów (książka twarda z wyklejkami i blokiem z krotnością 16, z obwolutą, miękka, broszura, planery, album, kalendarz z plecami) od razu w oknie „Nowy projekt”, osobno od szablonów sekcji; czytelniejsza ikona motywu „jak w systemie” |
| 207 | Panel administratora: zakładki z podpisami na górze na telefonie, „Poczta” = kolejka + ustawienia, czyszczenie starych kopii awaryjnych |
| 206 | E-maile o zaproszeniach do wyłączenia w Ustawienia konta → Powiadomienia → „E-mailem” (dla całego konta); zapraszający widzi, że ta osoba zobaczy zaproszenie w aplikacji |
| 204 | Udostępnianie w tle: link od razu, strony wysyłają się w tle; oglądający widzi „Podgląd jest w przygotowaniu” i strony pojawiające się po kolei |
| 203 | Makieta 3D na telefonie nie zamyka karty („Kurza twarz”): limit stron w pamięci grafiki, mniejsze tekstury na telefonie |
| 202 | Okna na niskim ekranie telefonu (np. Udostępnij) przewijają się; tekst nie jest ucięty w pół linii |
| 201 | Kopia projektu: koniec pytania „Projekt zmieniono w innym miejscu” po pierwszej zmianie i kasowania dodanego linku |
| 199 | Makieta 3D twardej oprawy jak prawdziwa książka: blok i okładka osobno (połączone wyklejkami), grzbiet stałej szerokości – przy wyklejce pionowo z okładką pod 90°, ku środkowi się schyla, gruba książka w środku lekko się przymyka; bez „języka” |
| 200 | Ekran ładowania: nazwa projektu wyśrodkowana z marginesami (nie od krawędzi ekranu) |
| 198 | Kopia projektu pokazywała link oryginału – „Duplikuj” kopiował dane linku. Naprawione; wcześniejsze kopie same się czyszczą, oryginał zachowuje link |
| 197 | Nowa wersja aplikacji włącza się sama, bez ręcznego odświeżania: na liście od razu, w projekcie po powrocie do listy albo w tle; sprawdzana przy każdym powrocie do karty i co 10 minut |
| 196 | Udostępnianie w całości z listy projektów: menu ⋯ → „Udostępnij linkiem…”, utworzenie linku, hasło, ważność, znak wodny, aktualizacja i unieważnienie bez otwierania projektu |
| 195 | Krótkie linki podglądu: makietka.app/ i 6 znaków (małe litery i cyfry); stare linki dostają krótki adres, długie dalej działają |
| 194 | Makieta 3D bez WebGL (Chrome na starszym Macu): komunikat z powodem z przeglądarki i krokami – akceleracja grafiki, chrome://gpu, ignore-gpu-blocklist, Safari |
| 193 | Obrazy w czasie ładowania migoczą zamiast pustych miejsc i ikonek „zepsutego obrazu”; miniatury stron zapamiętane na urządzeniu – kolejne otwarcie projektu bez rysowania wszystkich od nowa |
| 192 | Logowanie nazwą użytkownika albo adresem e-mail (adres z nazwy tylko przy dobrym haśle, limit prób) |
| 191 | Znak wodny w podglądzie z linku: włączany w oknie Udostępnij (własny tekst, domyślnie „PODGLĄD”), wtopiony w obrazy stron – oglądający go nie wyłączy |
| 190 | Ochrona linku (hasło, data ważności, włączenie i zdjęcie) zmieniana w każdej chwili – także z listy projektów |
| 189 | Makieta w linku aktualizuje się sama, także w starych linkach (po otwarciu projektu i po zapisie ujęcia); w podglądzie nazwa projektu w jednej linii zamiast trzech, nagłówek sekcji okładki nie ucina się z lewej |
| 188 | Makieta 3D w podglądzie z linku: oglądający bez konta obraca, kartkuje i pobiera obraz makiety (jeden wariant – jak u właściciela w chwili publikacji, bez ustawień); stare linki bez przycisku do pierwszej aktualizacji |
| 186.1 | Suwaki makiety 3D z własnym wyglądem (tor i okrągły uchwyt 22 px pod palec, oba motywy) zamiast systemowych – test kontrolki-dotyk znów przechodzi |
| 187 | Druk w domu odporny na okno drukowania przeglądarki: drukujemy gotowy PDF (bez nagłówków i stopek przeglądarki), skala 100% i dupleks zapisane w pliku, widoczna ramka „W oknie drukarki” (skala, marginesy, nagłówki i stopki), strona próbna z linijką 100 mm i ramkami 3/5/10 mm, informacja o zmniejszeniu strony do marginesu drukarki |
| 186 | Symulacja ręcznej listy: emulacja iPhone'a 14 / SE / iPada Mini (dotyk wieloma palcami, gest zmiany strony bez mignięcia, zasłonki list i koloru, makieta 3D, wycięcie ekranu, klawiatura iOS i Android) i druk zmierzony programami (qpdf, poppler, Ghostscript: PDF/X-4, CMYK, spad, znaki, płyty PANTONE i złocenia, osobne pliki okładki/wyklejek/bloku, broszura A4 do domu) – też na Twoim projekcie. Naprawione: pole z fokusem w zasłonce chowało się pod klawiaturą |
| 184 | Testy padające tylko pod obciążeniem ustabilizowane u źródła. „137 (reszta)” („obrazy poza pamięcią”): przyczyną nie był magazyn plików, tylko trzy wyścigi w aplikacji: spóźnione odświeżenie listy i spóźniona wysyłka z chwili wyjścia z edytora przywracały usunięty projekt, a pobranie obrazu z konta przy łączeniu zmian nadpisywało świeżo zapisany oryginał (stąd „eksport bierze mniej plików”) – wszystkie poprawione. Do tego w aplikacji: podpowiedzi wzmianek po wczytaniu listy osób, dwie utracone zmiany przy zamykaniu karty (zapis na urządzeniu i znacznik „do wysłania”), zmiany z czasu wysyłki nie przegrywają już z kontem bez pytania, „Cofnij” po usunięciu strony nie cofa też poprzedniej czynności. Testy czekają na stan zamiast na stały czas |
| 183 | Skrzynka w panelu: własny edytor treści zamiast TinyMCE z CDN, filtry Nieprzeczytane / Z załącznikami / Z gwiazdką (reszta – foldery, rozmowy, odpowiedz/przekaż, robocze, załączniki, operacje zbiorcze – już była z #110) |
| 182 | Wzór z Biblioteki jako wypełnienie kształtu (prostokąt, elipsa, wielokąt, zamknięty kształt): Wypełnienie → „Wzór” z podglądami, kolor wzoru i tła, skala, obrót; kafelek wzoru przy zaznaczonym kształcie pyta „Wypełnij zaznaczony kształt / Wstaw na stronę”; wzór w edytorze, miniaturach, podglądzie, PNG i wektorowo w PDF (bez obrazu), w zapisie, Kopiuj wygląd, cofaniu i opisie formatu dla AI. Reszta propozycji #103: segmenty zamiast listy przycisków radiowych w oknie Serii, menu ⋯ na karcie obrazu (zmień nazwę, podmień plik, kopiuj nazwę, usuń). Pozostałe punkty #103 rozstrzygnięte w DECYZJE #182 (już zrobione inaczej albo bez sensu w obecnym układzie). |
| 181 | 180 | Przegląd systemu i instrukcji jak nowy użytkownik (komputer i telefon): poprawione niespójności nazw (instrukcja ↔ przyciski, automatyczne sprawdzenie), nieaktualne opisy (prawa kolumna z zakładkami, przycisk Ostrzeżenia, menu ⋯), brakujące opisy (okno konfliktu zmian, Uporządkuj / Kopiuj nazwy / Pomiń w obrazach, Importuj z pliku); pusta lista projektów z przyciskiem „Z gotowego szablonu”; menu „Wzorce stron…”; część „Konto” przeniesiona na koniec instrukcji (rozdział 27, odsyłacze przenumerowane); odświeżone wszystkie zrzuty w obu motywach, poprawione kadry ustawień konta, okładki i ulotki; CI odświeża zrzuty także po zmianie krótkich skryptów zrzutów (scripts/zrzuty-*.cjs) |
| 175 | AI zleca plik PDF albo PNG strony (eksport_pdf, eksport_png, stan_eksportu): otwarta aplikacja robi plik i wgrywa go na konto, AI podaje link do pobrania (7 dni); bez otwartej aplikacji – link do aplikacji, po którego otwarciu plik robi się sam |
| 177 | Sekcje specjalne, które „wiedzą”, jak działają (jak okładka z grzbietem): obwoluta ze skrzydełkami, ulotka składana (zwijana / harmonijka, 2–4 panele), kalendarz z datami i polskimi świętami, kalendarz trójdzielny, wykrojniki (koperta, teczka, pudełko) i arkusz użytków (wizytówki, naklejki) – strefy, bigi, perforacje i linia cięcia na stronie, ostrzeżenia, PDF z CutContour/Crease i arkuszami użytków; typ sekcji (`sekcja.typ`) wybierany kartą – wyklejki, wkładka, podkładka, obwoluta; grzbiet z wyklejkami i wkładkami, numeracja tylko bloku, pliki PDF według ról, kontrola twardej oprawy bez wyklejek |
| 169 | Instrukcja odchudzona i uporządkowana: bez treści meta, oczywistości i powtórzeń, aktualne opisy (menu ⋯, rozkładówka, wielokąt, narzędzia na telefonie), wstęp „do czego to służy” w rozdziałach, odsyłacze sprawdzane przy budowie, bez okruszków i zdublowanego spisu podrozdziałów na komputerze. |
| 166 | Gotowe sekcje: 33 szablony dokumentów (kalendarze, planery, notesy, zaproszenia, dyplomy, wizytówki, ulotki, menu, rozdział książki, okładka…) jako generatory dopasowane do formatu, marginesów i kolorów marki; okno z miniaturami i podglądem, wejścia: [Gotowa] przy liście stron, Biblioteka, nowy projekt. |
| 173 | 159 | Paski postępu przy dłuższych czynnościach: jeden wygląd (karta, licznik x z y, pasek nieokreślony, Anuluj przy PDF), dopiero po 0,3 s, dostępne dla czytników ekranu; dodane przy PNG, separacjach, makiecie 3D, duplikowaniu, imporcie danych, czcionkach, usuwaniu tła, udostępnianiu, zmianie formatu, „Zamień wszystkie”, ekranie startowym i miniaturach (w panelu Strony). |
| 158 | Wydajność: bufory Fabric tylko dla elementów, którym się opłacają (odrysowanie strony ~6× szybciej, 72 MB → 0 MB pamięci buforów na gęstej stronie), zmiana strony bez przebudowy listy stron, szybsze porównania przy zapisie, miniatury nie przeszkadzają w pisaniu i przeciąganiu, moduły pobierane naraz (`modulepreload`). |
| 172 | Komentarze – przegląd i poprawki: usunięty wątek znika u wszystkich od razu, poprawianie własnego komentarza, pisana odpowiedź nie ginie przy zmianach na żywo, Ctrl+Enter w odpowiedzi, komentarz do usuniętego wątku/strony – czytelnie |
| 167 | Style tekstu w zestawie marki (14 gotowych + własne bez limitu, przenoszone do stylów projektu po nazwie). Kolory projektu prościej i z podziałem na sekcje: okno „Kolory projektu” (Dotyczy: cały projekt albo sekcja) – zamiana koloru w zakresie, druk kolorów dla sekcji (np. okładka w kolorze, środek czarno-biały – także w PDF), kolory dodatkowe, przegląd wykończeń; w wyborze koloru „W tej sekcji” i nowy kolor dodatkowy prosto z koloru; Właściwości → „Wykończenie druku” kafelkami (lakier, złocenie, tłoczenie, wytłoczenie, biel) z wyborem „Kolor + efekt” / „Sam efekt” i farbą specjalną. |
| 171 | Komputer: zakładki Właściwości / Warstwy (F7) na całą wysokość prawej kolumny, ostrzeżenia w okienku z przycisku przy powiększeniu (F8); ucięte przyciski stylu znakowego i siatka kształtów wielokąta naprawione, test bez ucięć dla każdego rodzaju elementu. |
| 159 | Paski postępu przy dłuższych czynnościach: jeden wygląd (karta, licznik x z y, pasek nieokreślony, Anuluj przy PDF), dopiero po 0,3 s, dostępne dla czytników ekranu; dodane przy PNG, separacjach, makiecie 3D, duplikowaniu, imporcie danych, czcionkach, usuwaniu tła, udostępnianiu, zmianie formatu, „Zamień wszystkie”, ekranie startowym i miniaturach (w panelu Strony). |
| 164 | Wzorce stron: zrozumiałe wyjaśnienie z rysunkiem, wejścia przy stronach (przycisk pod listą, menu strony i sekcji, pusty stan we właściwościach), znak wzorca na miniaturze, 39 gotowych wzorców z podglądami w 9 grupach (też w Bibliotece), dodanie jednym kliknięciem od razu na strony sekcji. |
| 162 | Biblioteka: 9 nowych działów – Ikony (260), Ilustracje, Okolicznościowe, Tła i wzory, Formularze do druku, Infografiki, Nagłówki i tytuły, Bloki treści, Układy stron – i Planer +11 (kalendarz roczny, plany, trackery, budżet miesięczny); wszystko edytowalne (grupy tekstów, kształtów i ścieżek), wzory i tła wektorowe w PDF; instrukcja 5.8 z nowym kadrem |
| 161 | Makieta 3D z telefonu: format bloku z większości stron (wyklejka A4 nie rozciąga książki, dzieli się na połowy na wnętrzu okładek), twarda oprawa ze skorupą grzbietu, szczeliną, składkami i kapitałką, otwarta okładka połączona z blokiem, napis na grzbiecie nie w lustrze, spirala skalowana z grubością i obejmująca blok, bez mory i migotania, ostrzejszy obraz i tekstury, kadr dla bieżącego kąta. |
| 160 | Audyt testów (docs/TESTY.md): tabela funkcji → testy → głębokość, nowe testy (okładka w PDF, operacje na stronach, 4 uwagi „Sprawdź przed drukiem”, narzędzie AI kolejnosc_elementow, zapis przy zamknięciu karty); naprawione 3 błędy (cofanie w trakcie wczytywania strony, utrata zmiany sprzed zamknięcia karty, niewysłana zmiana po ponownym otwarciu) i 5 niestabilnych testów. |
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
- 18.11.2026: ikona języka EN nieczytelna w ciemnym trybie (tekst w currentColor w <img>) → tło jak przy flagach PL/UA, test tests/ikony-jezykow.test.cjs.
- 18.11.2026: „Zarządzaj…” w Ustawieniach → Sztuczna inteligencja otwierało osobne okno – zbędny krok → panel wprost w sekcji (#247).
- 18.11.2026: klucze AI – trzy sekcje z istniejącymi kluczami (pokaż jeszcze raz, ważność, zakres), nowy klucz w okienku (#248).
- 18.11.2026: edycja istniejącego klucza AI też w okienku (spójnie z dodawaniem) (#249).
- 18.11.2026: klucze AI – przełącznik trzech sekcji na górze, w każdej wyjaśnienie, klucze i „Dodaj klucz” (#250).
- 18.11.2026: „twórca Makietki” → „administratorzy Makietki” (#251).
- 18.11.2026: plan AI krok 2 – drobniejsze zakresy kluczy (strony, wzorce i style, tabele i serie, obrazy, eksport), pilnowane w bazie (#252).
- 18.11.2026: ChatGPT nie otwiera linków ze strony narzędzi (zasada ChatGPT) → adresy do odczytu wprost w poleceniu, opis sekcji „Zwykły czat” poprawiony (#253).
- 18.11.2026: „Kopiuj i wklej” jako trzecia droga w Ustawieniach → Sztuczna inteligencja, z otwarciem projektu od razu w tym trybie; zwykły czat z API zostaje jako „Czat otwierający strony” (#254).
- 18.11.2026: plan AI krok 3 – zgoda w czacie Makietki przed usuwaniem i dużymi zmianami (#255).
- 18.11.2026: plan AI kroki 4–5 – Sprawdź połączenie, model domyślny, czytelne błędy dostawców i ponawianie przy przeciążeniu (#256).
- 18.11.2026: plan AI krok 6 – narzędzia kopiuj_strone, wyrownaj_elementy, rozmiesc_elementy (#257).
- 18.11.2026: plan AI krok 7 – ai/api.md z przeglądem wszystkich dróg i nowych funkcji (#258).
- 18.11.2026: plan AI krok 5 – odpowiedzi czatu w Makietce na bieżąco (streaming) (#259).
- 19.11.2026: plan AI krok 5 – zdjęcia w rozmowie z AI (widzi je i trafiają do projektu); plan AI zakończony (#260).
- 19.11.2026: składanki – walec, stożek, stożek ścięty i kartka pop-up (wycinanka) jako szablony; szwy po łuku w kontroli (#261).
- 19.11.2026: składanki – kula z klinów (globus) (#262); naprawiony stary test makieta-niepasujace.
- 19.11.2026: składanki – „Bryła z kształtu”: graniastosłup albo ostrosłup z dowolnego wielokąta (#263).
- 19.11.2026: składanki – „Model 3D”: OBJ/STL rozłożony na części z parami i zgięciami (#264).
- 19.11.2026: składanki – gotowe modele domek z dachem i samochód (#265).
- 19.11.2026: składanki – łuki z pióra zostają łukami w części (#266).
- 19.11.2026: składanki – wazon (bryła obrotowa z profilu) (#267).
- 19.11.2026: składanki – pudełko z klapą wsuwaną (mechanizm) (#268); przerwy między krokami usunięte – praca bez zatrzymywania.
- 19.11.2026: składanki – kartka pop-up z platformą wklejaną (#269).
- 19.11.2026: składanki – druga warstwa pop-up na platformie (#270).
- 19.11.2026: składanki – pudełko z zatrzaskiem (#271).
- 19.11.2026: składanki – kartka pop-up ze zgięciem V, pola klejenia pod kątem (#272).
- 19.11.2026: składanki – kartka pop-up (wycinanka) składa się w makiecie 3D; naprawione dzielenie ścian z wierzchołkami na prostej (#273).
- 19.11.2026: składanki – narzędzie Rozetnij: podział części na dwie z parą na linii cięcia (#274).
- 19.11.2026: składanki – narzędzie Scal: dwie części po parze krawędzi w jedną (#275).
- 19.11.2026: składanki – żółw (zwierzę z siatki 3D) (#276).
- 19.11.2026: składanki – kolory części z materiałów modelu 3D (OBJ + MTL) (#277).
- 19.11.2026: składanki – koło obrotowe do książek (#278).
- 19.11.2026: składanki – suwak (pull-tab) do książek (#279).
- 19.11.2026: składanki – klapki (lift-the-flap) z zawiasem do książek (#280).
- 19.11.2026: składanki – zgięcia po łuku i pudełko-poduszka (#281).
- 19.11.2026: składanki – łączenie brył: ściany z dachem (#282).
- 19.11.2026: składanki – tekstura modelu 3D jako nadruk na częściach (#283).
- 19.11.2026: składanki – „ściany to osobne byty”: tekst, obraz, ozdobnik na ścianie części, jadą i składają się z nią (#284).
- 19.11.2026: składanki – linie klejenia w środku ściany, także otwarte i krzywe (#285).
- 19.11.2026: składanki – sklejony model w 3D: części po parach, prosta linia – część staje, krzywa – zawija się (#286).
- 19.11.2026: składanki – kąt po sklejeniu krawędzi; zawijanie po krzywej z zachowaniem zgięć (#288).
- 19.11.2026: silnik stylów – strażnik wyglądu przycisków i pól, zasady arkuszy (#289).
- 19.11.2026: silnik stylów – warstwy w css/style, katalog komponentów, porównanie wyglądu przed i po (#290–#292).
- 19.11.2026: silnik stylów – kolory tylko z tokenów, !important tylko w widoczności, bez stylów w HTML (#294–#295).
- 19.11.2026: podgląd z linku na telefonie – przyciski paska wysokie na palec; narzędzie zrzutów obsługuje krótkie linki (#296).
- 19.11.2026: składanki – nacięcia pod dowolnym kątem i krzywe w edytorze; klapka wycięta w środku kartki ma zawias (#297).
- 19.11.2026: składanki – wycięcia (okienka, otwory) i drzwiczki na zawiasie, w 3D z dziurą (#298).
- 19.11.2026: składanki – pop-up w 3D otwiera się suwakiem 0–180°, doklejone elementy ruszają się mechanizmem (#299).
- 19.11.2026: składanki – „Sprawdź przed drukiem” pilnuje pop-upu: wystające po zamknięciu części i kartka, która się nie domyka (#300).
- 19.11.2026: składanki – dowolna część na skośnych liniach klejenia staje pod kątem; podpowiedzi kąta i długości w panelu (#301).
- 19.11.2026: makieta 3D – stojąca książka bez skoku przy otwieraniu, kamera na wprost po otwarciu; Android: mniejsze limity pamięci, tryb oszczędny po zamknięciu karty; makieta nie zostaje z pustą stroną po ponownym otwarciu (#302).
- 19.11.2026: makieta 3D – przewracana kartka płynnie przechodzi przez grzbiet w V; daleki skok listą rozkładówek bez przewracania wszystkich kartek po drodze (#303).
- 19.11.2026: przegląd wszystkich makiet 3D – poprawione ujęcia kalendarza biurkowego i pudełka (#304).
- 19.11.2026: znak wodny – krycie suwakiem (domyślnie bladszy) z podglądem (#305); zgięcie V makiet liczone z położenia kartek zamiast wygładzania (#306).
- 19.11.2026: urządzenia bez grafiki 3D – galeria gotowych ujęć makiety narysowanych przy publikacji linku (#307).
