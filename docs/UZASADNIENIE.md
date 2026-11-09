# Uzasadnienie – funkcja po funkcji

Do przeglądu przez Ciebie. Przy każdej funkcji jest:
- **Co jest** – jak działa teraz.
- **Dlaczego tak** – mój powód.
- **Ocena** – czy uważam, że jest dobrze, czy słabo.
- **Co można lepiej** – alternatywy i ich koszt.
- **Pytanie** – tam, gdzie decyzja należy do Ciebie.

Ocena: ✅ dobrze tak zostawić · ⚠️ działa, ale ma słabe strony · ❌ do poprawy przed dalszą pracą.

Dopisz swoje uwagi bezpośrednio pod punktami (np. „→ TAK”, „→ zmień na…”), a ja przeniosę decyzje do [DECYZJE.md](DECYZJE.md).

---

## A. Fundamenty techniczne

### A1. Aplikacja statyczna, bez kroku budowania (czysty JavaScript w modułach) ⚠️
**Co jest.** Pliki `index.html`, `css/`, `js/` wrzucane wprost na GitHub Pages. Biblioteki (Fabric.js, JSZip, Supabase) z CDN.
**Dlaczego tak.** Plan mówił „Vanilla JS lub lekki framework” i hosting na GitHub Pages. Bez builda nie ma narzędzi do instalowania, każdy plik można otworzyć i przeczytać, a wdrożenie to kopiowanie plików.
**Ocena.** Na tym etapie dobre, ale `js/aplikacja.js` ma już ~1500 linii i miesza wszystko: logowanie, listę projektów, edytor, sekcje, wzorce, pliki. To się zacznie mścić przy etapie danych.
**Co można lepiej.**
1. Podzielić `aplikacja.js` na moduły ekranów (`ekran-logowania.js`, `ekran-projektow.js`, `ekran-edytora.js`, `sekcje.js`, `wzorce.js`). Koszt: 1 sesja, zero zmian dla Ciebie. **Polecam przed etapem 2.**
2. Przejść na Vite + TypeScript: typy wyłapują błędy (np. ten z IndexedDB), ale dochodzi build i `node_modules`. Na razie bym nie robił.

### A2. Fabric.js 5.3 jako silnik płótna ⚠️
**Co jest.** Wersja 5.3.1 (stabilna, starsza gałąź).
**Dlaczego tak.** Plan wskazywał Fabric. Wersja 5 działa jako zwykły skrypt bez builda, ma dojrzałą obsługę tekstu i dotyku.
**Ocena.** Działa, ale Fabric 5 nie jest już rozwijany (jest 6.x). W konsoli Chrome widać ostrzeżenia `alphabetical` – nieszkodliwe, ale to sygnał wieku biblioteki.
**Co można lepiej.** Przejście na Fabric 6 (zmienione API, Promise zamiast callbacków). Najlepiej razem z punktem A1.1. Koszt: średni.
**Pytanie.** Czy zostajemy przy Fabric, czy rozważamy alternatywę (np. Konva)? Moja rekomendacja: zostać przy Fabric, podnieść do 6 przy refaktorze.

### A3. Wszystko w milimetrach ✅
**Co jest.** Każdy obiekt ma współrzędne w mm, punkt (0,0) to lewy górny róg strony po przycięciu. Zoom zmienia tylko widok. Czcionki w punktach.
**Dlaczego tak.** Druk liczy się w mm/pt. Gdyby obiekty były w pikselach, każda zmiana zoomu lub ekranu zmieniałaby „rozmiar” elementu, a eksport do PDF wymagałby przeliczeń i zaokrągleń.
**Ocena.** Dobrze – to fundament, który się nie zmieni.

### A4. Kod i nazwy po polsku ⚠️
**Co jest.** Zmienne, funkcje, pliki po polsku (`zapiszBiezacyCel`, `wzorzecStrony`).
**Dlaczego tak.** Plan i model danych były po polsku (`wydruk`, `strony`, `zakresy`), więc kod jest spójny z planem.
**Ocena.** Spójne, ale nietypowe – biblioteki i przykłady są po angielsku, więc kod jest mieszany.
**Pytanie.** Zostawić po polsku? Moja rekomendacja: zostawić, zmiana teraz to dużo pracy bez korzyści dla Ciebie.

### A5. Brak automatycznych testów w repozytorium ❌
**Co jest.** Testuję każdą zmianę skryptami Playwright, ale leżą one tylko w moim katalogu roboczym – nie ma ich w repo.
**Dlaczego tak.** Szybciej było sprawdzać doraźnie.
**Ocena.** Źle. Przy ostatniej zmianie wyszedł błąd z IndexedDB, który był w kodzie od początku – test w repo złapałby go wcześniej. Przy kolejnej sesji (albo innej osobie) testy przepadną.
**Co można lepiej.** Przenieść testy do `tests/` i uruchamiać je w GitHub Actions przy każdym pushu. Koszt: mały. **Polecam od razu.**

---

## B. Konto, baza, zapis

### B1. Logowanie e-mailem i hasłem, bez rejestracji i resetu ✅ / ❌
**Co jest.** Sam formularz logowania. Konto zakładasz i resetujesz w panelu Supabase.
**Dlaczego tak.** Twoja decyzja (jedno konto admina).
**Ocena.** W aplikacji dobrze. **Ale rejestracja jest nadal włączona po stronie Supabase** – każdy, kto zna adres projektu (jest publiczny w kodzie), może założyć konto przez API. Dane innych nie są zagrożone (RLS), ale ktoś może zapchać bazę.
**Do zrobienia przez Ciebie.** Supabase → Authentication → Sign In / Providers → wyłączyć „Allow new users to sign up”.

### B2. Tryb „bez konta” ⚠️
**Co jest.** Gdy w `konfiguracja.js` brakuje adresu Supabase, ekran logowania pokazuje „Pracuj bez konta”.
**Dlaczego tak.** Żeby aplikacja dała się uruchomić lokalnie bez bazy i żebym mógł robić zrzuty instrukcji bez dotykania Twoich danych.
**Ocena.** Przy podpiętej bazie przycisk się nie pokazuje, więc dla Ciebie niewidoczny. Ale to dodatkowa ścieżka w kodzie.
**Pytanie.** Zostawić (do testów i zrzutów) czy usunąć? Rekomendacja: zostawić.

### B3. Zapis: najpierw przeglądarka (IndexedDB), potem Supabase ⚠️
**Co jest.** 0,7 s po zmianie zapis w przeglądarce, 2,5 s później wysyłka całego projektu do tabeli `projekty` (jedna kolumna `dane` jsonb). Obrazy osobno do Storage, raz.
**Dlaczego tak.** Plan: praca przy słabym zasięgu. Zapis lokalny jest natychmiastowy, wysyłka może się nie udać i ponowić.
**Ocena – słabe strony:**
1. **Cały projekt przy każdej zmianie.** Kalendarz z 365 stronami to kilka MB JSON-a wysyłane co kilka sekund edycji. Na darmowym planie i słabym łączu to będzie odczuwalne.
2. **Konflikty między urządzeniami.** Jeśli edytujesz na tablecie offline, a potem na komputerze, wygrywa nowsza data – starsze zmiany giną bez ostrzeżenia. Data pochodzi z zegara urządzenia.
3. **Tabeli `projekty` wciąż nie ma w bazie** – zapis do chmury dziś nie działa w ogóle.
**Co można lepiej.**
- Strony jako osobne wiersze (tabela `strony`), wysyłane tylko zmienione. Koszt: średni, zmiana schematu.
- Licznik wersji po stronie serwera: zapis odrzucany, jeśli ktoś zapisał w międzyczasie → pytanie „masz nowszą wersję z innego urządzenia”. Koszt: mały. **Polecam jako minimum.**
**Pytanie.** Czy edytujesz jeden projekt na kilku urządzeniach naprzemiennie? Jeśli tak, konflikty są ważne.

### B4. Supabase: tabela `projekty` + bucket `zasoby` z RLS ✅
**Co jest.** Każdy wiersz ma `owner_id`, reguły RLS pozwalają czytać i zmieniać tylko własne. Obrazy w folderze `<owner_id>/<projekt>/`.
**Dlaczego tak.** Plan wymagał `owner_id` i RLS od początku. Jeden bucket z folderem na użytkownika zamiast bucketu per użytkownik – tak zaleca Supabase, efekt bezpieczeństwa ten sam.
**Ocena.** Dobrze. Problem tylko z wdrożeniem migracji (patrz DECYZJE #3).

### B5. Klucz publishable w kodzie ✅
**Dlaczego tak.** Ten klucz jest publiczny z założenia (tak robi też `brick_ai`). Bezpieczeństwo zapewnia RLS, nie ukrycie klucza.

---

## C. Ekrany

### C1. Ekran logowania z panelem „marketingowym” ⚠️
**Co jest.** Po lewej ciemny panel z hasłem „Projektuj strony raz. Dane wstawią się same.” i ilustracją kartek, po prawej formularz.
**Dlaczego tak.** Żeby pierwszy ekran nie był pustym formularzem.
**Ocena.** Przy jednym użytkowniku (Tobie) to ozdobnik – i obiecuje funkcję (dane), której jeszcze nie ma.
**Pytanie.** Uprościć do samego formularza z logo? Rekomendacja: uprościć.

### C2. Lista projektów jako karty z miniaturą ✅
**Dlaczego tak.** Projekty rozpoznaje się po wyglądzie; karty dobrze działają palcem.
**Co można lepiej.** Brak wyszukiwania i sortowania – przy kilku projektach niepotrzebne. Brak „Duplikuj projekt” (np. kalendarz na kolejny rok) – **warto dodać**.

### C3. Kreator nowego projektu ✅
**Dlaczego tak.** Format jest potrzebny, zanim postawi się pierwszy element (wszystko w mm).
**Co można lepiej.** Gotowe szablony startowe (np. „Kalendarz książkowy A5: okładka + 12 miesięcy”). To ma sens dopiero po etapie danych.

### C4. Adresy podstron (`#/p/<id>/s/<id>`) ✅
**Dlaczego tak.** Odświeżenie nie wyrzuca z projektu, działa „Wstecz”, link prowadzi do konkretnej strony.
**Dlaczego `#` w adresie.** GitHub Pages nie obsługuje „ładnych” adresów bez `#` (każdy adres musiałby być prawdziwym plikiem). `#` działa wszędzie.
**Co można lepiej.** Nic pilnego.

---

## D. Edytor

### D1. Układ: strony z lewej, płótno, właściwości z prawej ✅
**Dlaczego tak.** Standard programów do składu – nie trzeba się uczyć.

### D2. Pływający pasek „Wstaw” nad stroną ⚠️
**Dlaczego tak.** Na tablecie blisko miejsca pracy, nie zabiera wysokości.
**Ocena.** Zasłania górę strony przy dużym powiększeniu.
**Co można lepiej.** Przenieść do stałego paska pod nagłówkiem albo chować przy przewijaniu.

### D3. Nowe elementy pojawiają się na środku strony ⚠️
**Dlaczego tak.** Zawsze widać, gdzie się pojawiły.
**Co można lepiej.** Tryb „narysuj”: wybierasz Prostokąt i przeciągasz na stronie, gdzie ma być (jak w Publisherze). Wygodniejsze, ale na tablecie koliduje z przesuwaniem. **Do Twojej decyzji.**

### D4. Panel właściwości z polami w mm ✅ / ⚠️
**Dlaczego tak.** Palcem nie ustawisz elementu z dokładnością do milimetra.
**Ocena.** Pola są, ale panel jest długi – na telefonie dużo przewijania.
**Co można lepiej.** Zwijane sekcje panelu.

### D5. Tekst ⚠️
**Co jest.** Ramka tekstu (Textbox): czcionka, rozmiar, interlinia, kolor, B/I, wyrównanie – dla całej ramki. Skalowanie narożnikiem zamieniam na rozmiar czcionki.
**Dlaczego tak.** Proste i przewidywalne.
**Braki względem Publishera:** formatowanie fragmentu (jedno słowo pogrubione), style akapitów (raz zdefiniowany „Nagłówek”), kolumny, przelewanie tekstu między ramkami, tabele, odstęp między literami, wcięcia.
**Pytanie.** Które z tych są Ci potrzebne do kalendarzy? Moim zdaniem najważniejsze: **style tekstu** (spójność na 365 stronach) i **odstęp między literami**. Tabele – może do siatek miesięcy, ale da się je zastąpić wzorcem.

### D6. Czcionki: 8 czcionek OFL z Google Fonts ⚠️
**Dlaczego tak.** Plan: tylko licencje komercyjne. OFL pozwala sprzedawać i osadzać w PDF.
**Ocena.** Czcionki ładowane z serwerów Google – do eksportu PDF trzeba będzie mieć same pliki czcionek (osadzanie), a Google CDN ich tak nie udostępnia wygodnie.
**Co można lepiej.** Trzymać pliki czcionek w repo (`fonts/`) – działa offline i daje pliki do PDF. Koszt: mały. **Polecam przed etapem PDF.**
**Pytanie.** Czy ta lista 8 czcionek Ci odpowiada? Jakie dodać?

### D7. Obrazy ⚠️
**Co jest.** Obraz trzymany w pełnej rozdzielczości jako tekst (dataURL) w pamięci i w IndexedDB. Przycinanie liczbami w %. Informacja o dpi.
**Dlaczego tak.** Najprostsze i działa w eksporcie.
**Słabe strony:** kilka dużych zdjęć z aparatu (po 8 MB) spowolni tablet. Przycinanie liczbami jest niewygodne.
**Co można lepiej.** Podgląd zmniejszony do edycji, oryginał tylko do eksportu (plan to przewidywał). Przycinanie przeciąganiem krawędzi. **Polecam pomniejszony podgląd przed pracą z dużymi zdjęciami.**

### D8. Linie pomocnicze, przyciąganie, ostrzeżenia ⚠️
**Co jest.** Linia cięcia, spad, margines; przyciąganie do krawędzi/marginesów/środka; ostrzeżenia o wejściu w margines i wyjściu poza spad, wyciszane per element.
**Dlaczego tak.** Plan 4.5: ostrzegać, nie blokować.
**Słabe strony:**
- Stopka i numer strony we wzorcu zwykle leżą w marginesie → stałe ostrzeżenia (trzeba wyciszać).
- Brak ostrzeżenia o tekście, który nie mieści się w ramce.
- Brak przyciągania do innych elementów i własnych prowadnic, brak linijek.
- Brak marginesów lustrzanych (wewnętrzny/zewnętrzny dla książki) – plan 4.5.
**Co można lepiej.** Osobny „obszar stopki” w sekcji, w którym margines nie ostrzega. Marginesy lustrzane razem z widokiem rozkładówek (D10).

### D9. Cofanie: 60 kroków, tylko na bieżącej stronie ⚠️
**Dlaczego tak.** Prosta implementacja: zapamiętywanie stanu strony.
**Słabe strony:** po przejściu na inną stronę historia znika; nie cofa operacji na stronach (usunięcie strony, zmiana sekcji).
**Co można lepiej.** Historia na poziomie projektu. Koszt: średni. Przynajmniej: potwierdzenia przy usuwaniu (są).

### D10. Brak widoku rozkładówek ❌ (dla kalendarza książkowego)
**Co jest.** Zawsze jedna strona naraz.
**Dlaczego tak.** Nie było w Etapie 1.
**Ocena.** W kalendarzu książkowym lewa i prawa strona tworzą całość (tydzień na rozkładówce). Bez widoku dwóch stron obok siebie trudno je zgrać.
**Pytanie.** Czy Twój kalendarz to rozkładówki? Jeśli tak – **polecam jako następną funkcję** (tryb sekcji „rozkładówki” + marginesy lustrzane).

### D11. Brakujące narzędzia z Publishera
Wyrównywanie i rozmieszczanie kilku elementów, blokowanie elementu, panel warstw, linijki, kopiuj/wklej między stronami, wklejanie obrazu ze schowka, kształty dowolne, gradienty, cienie.
**Pytanie.** Zaznacz, które są potrzebne. Moja propozycja kolejności: wyrównywanie, blokowanie, kopiuj/wklej między stronami, panel warstw.

---

## E. Sekcje i wzorce

### E1. Sekcje z własnym formatem ✅
**Co jest.** Projekt = lista sekcji; strona należy do jednej sekcji; strony zawsze ułożone według kolejności sekcji.
**Dlaczego tak.** Twoja decyzja (okładka ≠ środek). Ustawienia na sekcję, bo zmiana marginesu ma objąć wszystkie strony części.
**Co można lepiej.**
- Grzbiet okładki liczony automatycznie z liczby kartek i grubości papieru (teraz wpisujesz szerokość ręcznie).
- Numeracja stron od zadanej liczby w sekcji (np. środek od 1, okładka bez numeru) – teraz `{nr}` liczy od początku projektu, a `{nr_w_sekcji}` od początku sekcji.

### E2. Wzorce jako warstwa pod stroną ✅ / ⚠️
**Co jest.** Wzorzec to strona; jego elementy rysowane pod treścią strony, niezaznaczalne. Wzorzec domyślny dla sekcji, nadpisywany per strona. Zmienne `{nr}`, `{nr_w_sekcji}`, `{liczba_stron}`, `{sekcja}`, `{strona}`.
**Dlaczego tak.** Twoja decyzja (wzorce dla różnych stron i sekcji). Warstwa pod spodem i brak zaznaczania – żeby nie przesunąć ramki przypadkiem.
**Słabe strony:**
1. **Jeden wzorzec na stronę.** Nie da się złożyć np. „tło miesiąca” + „stopka” z dwóch wzorców.
2. **Wzorzec ma własny rozmiar** – jeśli różni się od sekcji, elementy mogą wypaść poza stronę, a aplikacja o tym nie ostrzega.
3. **Elementy wzorca zawsze pod treścią** – nie da się położyć np. ramki nad zdjęciem strony.
4. **Pokrywa się z „nakładkami motywu” z planu (sekcja 6).** Plan ma: tło motywu → strona → nakładka motywu. Wzorce realizują pierwszą część.
**Pytanie.** Połączyć „motywy” z planu z wzorcami (wzorzec z warstwą „pod” i „nad” + kilka wzorców na stronę)? Moja rekomendacja: **tak** – jedno pojęcie zamiast dwóch.

### E3. Tło strony „z wzorca” ⚠️
**Co jest.** Strona bez własnego tła bierze tło wzorca; po zmianie koloru strona ma własne.
**Ocena.** Działa, ale nie ma przycisku „wróć do tła z wzorca”. Drobne.

---

## F. Pliki, instalacja, pomoc

### F1. Format `.plite` (ZIP z manifestem) ✅
**Dlaczego ZIP.** Obrazy jako zwykłe pliki (bez base64 – ~30% mniej), da się rozpakować dowolnym programem, sprawdzony wzorzec (.docx, .odt). Manifest mówi, co jest w środku i w jakiej wersji formatu – starsza aplikacja nie wczyta po cichu pliku z nowszej.
**Co można lepiej.** Nazwa rozszerzenia – `.plite` od roboczej nazwy. Jeśli zmienisz nazwę aplikacji, warto zmienić i rozszerzenie teraz, póki nie ma plików.
**Pytanie.** Nazwa aplikacji i rozszerzenia – zostaje „Publisher-lite” / `.plite`?

### F2. Eksport/import tylko na liście projektów ✅
**Dlaczego tak.** Twoja uwaga – operacje na całości oddzielone od pracy na stronie.

### F3. PWA (instalacja, praca offline) ✅ / ⚠️
**Co jest.** Manifest, ikony, service worker: pliki aplikacji „najpierw sieć, potem pamięć”, biblioteki z CDN z pamięci.
**Dlaczego „najpierw sieć”.** Po każdym wdrożeniu od razu działa nowa wersja – nie ma problemu „starej aplikacji z pamięci”.
**Słabe strony.** Nie testowane na prawdziwym urządzeniu. Otwieranie `.plite` dwuklikiem działa tylko na komputerze (Chrome/Edge), nie na Androidzie.
**Ikona** – zrobiona przeze mnie na szybko (kartka z „P”). **Do Twojej oceny.**

### F4. Instrukcja ze zrzutami generowanymi skryptem ✅ / ⚠️
**Dlaczego skrypt.** Zrzuty zawsze aktualne – po zmianie wyglądu uruchamiam skrypt i są nowe.
**Słabe strony.** Instrukcja i ramki „Dlaczego tak?” trzeba aktualizować przy każdej funkcji. Ramki „Dlaczego tak?” w instrukcji to było moje błędne zrozumienie Twojej prośby.
**Pytanie.** Zostawić ramki „Dlaczego tak?” w instrukcji, czy usunąć (uzasadnienia są w tym dokumencie)? Rekomendacja: **usunąć** – instrukcja ma mówić „jak”, a nie „dlaczego”.

---

## G. Odstępstwa od planu

| Plan | Jest | Dlaczego |
|---|---|---|
| Projekt jako JSON + folder z zasobami | Plik `.plite` (ZIP: JSON + folder zasobów w jednym pliku) | Jeden plik łatwiej przenosić; w środku to dokładnie JSON + folder. |
| Bucket per użytkownik | Jeden bucket, folder per użytkownik | Zalecenie Supabase, to samo bezpieczeństwo. |
| Jeden format wydruku na projekt | Format na sekcję | Twoja decyzja (#11). |
| Nakładki motywu (sekcja 6) | Wzorce (tylko „pod” treścią) | Częściowo – patrz E2. |
| Tryby układu: pojedyncza / broszura | Tylko pojedyncza | Nie zrobione – patrz D10. |
| Etap 1: tekst, obrazy, kształty, format, zapis | Zrobione + sekcje, wzorce, PWA, `.plite` | Twoje kolejne uwagi. |
| Etap 5: cofanie, skróty | Zrobione częściowo już teraz | Bez cofania praca na tablecie była zbyt ryzykowna. |

---

## H. Moja propozycja kolejności (do Twojej korekty)

1. **Naprawić wdrożenie bazy** (tabela `projekty`) i wyłączyć rejestrację w Supabase – bez tego zapis na konto nie działa.
2. **Testy w repo + podział `aplikacja.js`** (A1, A5) – zanim dojdą dane.
3. **Decyzje projektowe od Ciebie:** rozkładówki (D10), wzorce/motywy (E2), style tekstu (D5).
4. **Etap 2 z planu: dane** (import CSV/XLSX, zmienne w tekście, autodopasowanie).
5. Czcionki lokalnie (D6) i pomniejszone obrazy (D7) – przed etapem PDF.
