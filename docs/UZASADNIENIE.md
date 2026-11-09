# Uzasadnienie – funkcja po funkcji

Stan po rundzie poprawek z 9 listopada 2026 (decyzje #19–#25 w [DECYZJE.md](DECYZJE.md)). Przy każdej funkcji: co jest, dlaczego tak, co zostało słabe i co można zrobić lepiej.

Ocena: ✅ dobrze tak zostawić · ⚠️ działa, ale ma słabe strony · ❌ nie zrobione / do poprawy.

Dopisz uwagi pod punktami (np. „→ zmień na…”), a ja przeniosę decyzje do dziennika.

---

## 0. Co musisz zrobić w Supabase, żeby konta i zapis działały

Tego nie mogę zrobić ani sprawdzić z repozytorium.

1. **Baza.** Tabeli `projekty` nadal nie ma – integracja z GitHubem nie wykonała migracji. Wklej `supabase/migrations/20261109120000_projekty_i_zasoby.sql` w SQL Editor i uruchom (tworzy tabelę z licznikiem wersji, bucket `zasoby`, reguły dostępu i funkcję `usun_konto`). Albo popraw integrację (Deploy to production, gałąź `main`).
2. **Poczta (SMTP).** Wbudowana poczta Supabase wysyła tylko na adresy członków Twojego zespołu w Supabase i ma limit kilku wiadomości na godzinę. Żeby rejestracja działała dla innych osób, podepnij własny SMTP: Authentication → Emails → SMTP Settings (np. Resend, Brevo). Bez tego potwierdzenie konta dojdzie tylko do Ciebie.
3. **Szablony wiadomości.** Są w `supabase/templates/` i w `supabase/config.toml`. Jeśli integracja ich nie przeniesie, wklej treść plików w Authentication → Emails → Templates (Confirm signup, Reset password, Change email address) i ustaw tematy z `config.toml`.
4. **Adresy powrotu.** Authentication → URL Configuration: Site URL `https://andrish97.github.io/book/`, Redirect URLs `https://andrish97.github.io/book/**`. Bez tego linki z wiadomości nie wrócą do aplikacji.
5. **Hasła.** Authentication → Sign In / Providers → Email: minimalna długość 8 i wymagane małe, wielkie litery, cyfry i znaki specjalne (aplikacja sprawdza to samo po swojej stronie).
6. **Domena.** W dniu wyboru nazwy wolne były `seriodruk.com`, `seriodruk.app` i `seriodruk.pl`. Po podpięciu domeny trzeba zmienić Site URL, Redirect URLs i `site_url` w `config.toml`.

---

## A. Fundamenty techniczne

### A1. Aplikacja statyczna, moduły bez builda ⚠️
**Co jest.** Czysty JavaScript w modułach, hosting na GitHub Pages. Po tej rundzie logika jest rozdzielona: `konto.js` (logowanie, rejestracja, ustawienia), `podglad.js`, `zlozenie.js` (składanie warstw strony), `style-tekstu.js`, `ui.js`, `marka.js`.
**Słabe.** `aplikacja.js` nadal ma ok. 1800 linii (lista projektów, edytor, sekcje, wzorce, zapis). Nowe rzeczy trafiały do osobnych plików, ale stary rdzeń nie został jeszcze pocięty.
**Lepiej.** Wydzielić `projekty-lista.js`, `sekcje.js`, `wzorce.js`, `zapis.js` – teraz jest to bezpieczne, bo są testy.

### A2. Fabric.js 5.3 ⚠️
**Co jest.** Bez zmian; ostrzeżenia `alphabetical` w konsoli naprawione łatką.
**Lepiej.** Przejście na Fabric 6 przy okazji cięcia `aplikacja.js`.

### A3. Wszystko w milimetrach ✅

### A4. Testy w repozytorium ✅
**Co jest.** `tests/` – 24 testy przeglądarkowe (Playwright + `node --test`): edytor, dotyk, konto, pliki, sekcje, wzorce, rozkładówki, tekst, narzędzia, podgląd, konflikt zapisu. Supabase zastępuje atrapa w `tests/pomoc.cjs`, więc testy nie dotykają Twojej bazy. Uruchamiają się w GitHub Actions przy każdym pushu (workflow „Testy”).
**Słabe.** Atrapa udaje Supabase – prawdziwej bazy, reguł RLS i poczty testy nie sprawdzają. Na prawdziwym tablecie nikt tego jeszcze nie przeklikał.

---

## B. Konto, baza, zapis

### B1. Rejestracja, logowanie, reset hasła ✅ / ⚠️
**Co jest.** Jedna karta: Logowanie / Nowe konto. Wymagania hasła zaznaczają się na żywo. Po rejestracji ekran „Sprawdź skrzynkę” z ponowną wysyłką po 60 s. Reset hasła linkiem. Powrót z linku w e-mailu jest rozpoznawany (potwierdzenie, reset, zmiana adresu, wygasły link).
**Dlaczego tak.** Układ i przebieg wzorowane na familijnej (karta na środku, zasady hasła pod polami, stany „wysłano”); kod napisany od zera, bo jej licencja nie pozwala kopiować.
**Czego nie ma z familijnej (świadomie):** konta gościa, logowania nazwą użytkownika, limitów „raz na godzinę”, zabezpieczenia przed botami (Turnstile). Dopisz, jeśli któreś jest potrzebne.
**Słabe.** Działa dopiero po kroku 0.2 (SMTP). Rejestracja jest otwarta dla każdego – jeśli ma być tylko dla zaproszonych, trzeba to dodać.

### B2. Ustawienia konta ✅
**Co jest.** `#/konto`: nazwa, zmiana e-maila z potwierdzeniem i ponowną wysyłką, zmiana hasła (ze sprawdzeniem obecnego), wylogowanie wszędzie, usunięcie konta z projektami i obrazami.
**Słabe.** Po zmianie hasła nie przychodzi wiadomość „hasło zmienione” (Supabase ma taką opcję – do włączenia w panelu). Anulowanie rozpoczętej zmiany e-maila nie jest możliwe z aplikacji.

### B3. Własne e-maile ✅ / ⚠️
**Co jest.** Trzy szablony HTML w stylu aplikacji: potwierdzenie konta, nowe hasło, nowy adres.
**Słabe.** Patrz 0.2 i 0.3 – wysyłka i wgranie szablonów zależą od ustawień w Supabase.

### B4. Zapis: urządzenie → konto, z wykrywaniem konfliktu ✅ / ⚠️
**Co jest.** Zapis w przeglądarce po 0,7 s, na konto po 2,5 s. Każdy zapis podnosi licznik wersji; jeśli na koncie jest wersja z innego urządzenia, aplikacja pyta, którą zachować, zamiast nadpisać.
**Słabe.** Nadal wysyłany jest cały projekt przy każdej zmianie – przy setkach stron będzie wolno. Konflikt rozstrzyga się na poziomie całego projektu, nie pojedynczych stron.
**Lepiej.** Strony jako osobne wiersze w bazie – do zrobienia przed etapem powielania (wtedy projekty urosną).

### B5. Tryb bez konta ⚠️
Został tylko jako tryb techniczny (testy, zrzuty do instrukcji); przy podpiętej bazie przycisk się nie pokazuje.

---

## C. Ekrany

### C1. Lista projektów ✅
Karty z miniaturą, menu: podgląd, zmiana nazwy, **duplikuj** (nowe), eksport, usunięcie. Import obok „Nowy projekt”.

### C2. Kreator projektu ✅
Doszedł wybór układu: pojedyncze strony albo rozkładówki. Nowy projekt dostaje cztery style tekstu na start.

### C3. Adresy podstron ✅
`#/projekty`, `#/konto`, `#/p/<id>/s/<strona>`, `#/p/<id>/w/<wzorzec>`, `#/p/<id>/podglad`.

### C4. Podgląd bez edycji ✅ / ⚠️
**Co jest.** Wszystkie strony po kolei jak po przycięciu, rozkładówki obok siebie, powiększanie, kliknięcie strony otwiera ją w edytorze. Strony rysują się dopiero, gdy są widoczne.
**Słabe.** To podgląd dla zalogowanego właściciela. Nie ma linku „tylko do odczytu” dla innej osoby ani trybu pełnoekranowego z przewracaniem stron.
**Pytanie.** Czy podgląd ma być też do pokazania komuś bez konta (link publiczny)?

---

## D. Edytor

### D1. Tekst ✅ / ⚠️
**Co jest.** Style tekstu wspólne dla projektu (zmiana stylu zmienia wszystkie teksty), odstęp liter, podkreślenie, przekreślenie, zmiana wielkości liter, formatowanie zaznaczonego fragmentu.
**Nie ma.** Kolumn, przelewania tekstu między ramkami, tabel, wcięć i wypunktowań, stałej wysokości ramki z wyrównaniem w pionie, kapitalików „na żywo” (zmiana wielkości liter zmienia sam tekst).
**Słabe.** Formatowanie fragmentu w tekście wzorca ze zmienną `{nr}` może się przesunąć, gdy numer ma inną liczbę cyfr.

### D2. Wyrównywanie, blokada, schowek ✅
Wyrównanie do marginesów (jeden element) lub do siebie (kilka), równe odstępy, blokada położenia, kopiuj/wytnij/wklej między stronami – skrótami i przyciskami.

### D3. Rozkładówki z marginesami lustrzanymi ✅ / ⚠️
**Co jest.** Układ sekcji „rozkładówki”, marginesy wewnętrzny/zewnętrzny, grzbiet, sąsiednia strona widoczna obok edytowanej, lista stron w parach.
**Słabe.** Edytujesz jedną stronę naraz – element nie może leżeć na obu stronach rozkładówki (np. zdjęcie przez grzbiet). Sąsiednia strona jest obrazem, nie da się do niej przyciągać.
**Lepiej.** Jedno płótno na całą rozkładówkę – większa przebudowa silnika; do decyzji, czy potrzebne.

### D4. Linie pomocnicze i ostrzeżenia ⚠️
Bez zmian w zasadzie działania. Nadal brak linijek, własnych prowadnic i przyciągania do innych elementów.

### D5. Obrazy ⚠️
Bez zmian: pełna rozdzielczość w pamięci, przycinanie liczbami. Do zrobienia przed pracą z dużymi zdjęciami: pomniejszony podgląd i przycinanie przeciąganiem.

### D6. Cofanie ⚠️
Bez zmian: 60 kroków w obrębie bieżącej strony; nie cofa operacji na stronach, sekcjach i stylach.

### D7. Czcionki ⚠️
Bez zmian: 8 czcionek OFL z Google Fonts. Przed eksportem PDF trzeba przenieść pliki czcionek do repozytorium.

### D8. Czego nadal nie ma z programów do składu ❌
Panel warstw, linijki, kształty dowolne, gradienty, cienie, zwijane sekcje panelu właściwości (na telefonie panel jest długi).

---

## E. Sekcje i wzorce

### E1. Sekcje ✅
Własny format, spad, cztery marginesy, układ, wzorce domyślne i **numeracja** (dalszy ciąg, od numeru, bez numerów).
**Nie ma.** Automatycznego liczenia szerokości grzbietu okładki z liczby kartek.

### E2. Wzorce połączone z motywami ✅
**Co jest.** Strona może mieć kilka wzorców naraz; każdy element wzorca leży pod albo nad treścią; wzorzec może odbijać się lustrzanie na lewych stronach (numer strony zawsze przy zewnętrznej krawędzi). Pojęcie „motyw” z planu zniknęło – to są wzorce.
**Słabe.** Kolejność wzorców wynika z kolejności na liście wzorców (nie da się jej zmienić przeciąganiem). Odbicie lustrzane grupy przenosi całą grupę, ale nie odbija układu w jej środku.

### E3. Jedno składanie strony ✅
`zlozenie.js` składa tło, wzorce i treść dla edytora, miniatur i podglądu – ten sam kod posłuży eksportowi PDF, więc wszędzie wygląda to identycznie.

---

## F. Pliki, instalacja, pomoc

### F1. Nazwa i format pliku ✅
Seriodruk, plik `.seriodruk` (ZIP z manifestem). Nazwa jest w jednym miejscu w kodzie (`js/marka.js`) plus pliki statyczne wymienione w komentarzu.

### F2. PWA ⚠️
Bez zmian; nadal nie sprawdzone na prawdziwym urządzeniu. Ikona to moja robocza kartka z literą „S” – do Twojej oceny.

### F3. Instrukcja ✅
18 rozdziałów ze zrzutami generowanymi skryptem (`npm run zrzuty`), bez ramek „Dlaczego tak?” – uzasadnienia są w tym dokumencie.

---

## G. Co proponuję dalej

1. **Supabase – punkt 0** (bez tego konta i zapis na koncie nie działają).
2. **Próba na tablecie** – gesty, klawiatura ekranowa, instalacja.
3. **Etap danych z planu**: import CSV/XLSX, pola `{kolumna}` w tekście, autodopasowanie tekstu, zakresy powielane według wierszy.
4. Przed etapem PDF: pliki czcionek w repozytorium, pomniejszone obrazy, strony jako osobne wiersze w bazie.
5. Do Twojej decyzji: publiczny link do podglądu (C4), jedno płótno na rozkładówkę (D3), rejestracja tylko dla zaproszonych (B1).
