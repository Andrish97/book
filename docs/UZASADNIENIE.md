# Uzasadnienie – funkcja po funkcji

Stan po rundzie poprawek z 9 listopada 2026 (decyzje #19–#25 w [DECYZJE.md](DECYZJE.md)). Przy każdej funkcji: co jest, dlaczego tak, co zostało słabe i co można zrobić lepiej.

Ocena: ✅ dobrze tak zostawić · ⚠️ działa, ale ma słabe strony · ❌ nie zrobione / do poprawy.

Dopisz uwagi pod punktami (np. „→ zmień na…”), a ja przeniosę decyzje do dziennika.

---

## 0. Supabase: jak to jest podpięte

**Działa od 2026-11-10.** Nic więcej nie musisz robić. Każdy push na `main`, z dowolnej rozmowy, wdraża to, co jest w folderze `supabase/`:
- migracje z `supabase/migrations/` (tabela `projekty` z licznikiem wersji, foldery `zasoby` i `podglady`, reguły dostępu, funkcja `usun_konto`),
- ustawienia logowania z `supabase/config.toml`: adres aplikacji i adresy powrotu, wymagania hasła, rejestracja bez potwierdzania e-mailem. Integracja przenosi je dlatego, że w `config.toml` jest blok `[remotes.production]` z identyfikatorem projektu.

Robi to integracja Supabase z GitHubem (Project Settings → Integrations → GitHub) z włączoną opcją **Deploy to production**. Samo podpięcie repozytorium nie wystarczało – bez tej opcji integracja nic nie robiła.

**Gdzie widać wynik wdrożenia.** Na GitHubie przy commicie na `main` jest znaczek „Supabase Preview”: zielony albo czerwony z treścią błędu. To samo w Supabase → Branches → `main` → View logs. Jeśli ustawienia się nie przyjmą, migracje też się nie wykonają – wdrożenie staje na pierwszym błędzie.

**Sprawdzone na prawdziwej bazie** (opublikowana aplikacja, konto testowe, potem usunięte): rejestracja, zapis projektu z obrazem, odczyt na drugim urządzeniu, udostępnienie linkiem i otwarcie go bez konta, wyłączenie linku, usunięcie konta.

**Poczta – czego nie ma.** Wbudowana poczta Supabase dostarcza wiadomości tylko właścicielom projektu i ma limit kilku na godzinę. Dlatego rejestracja działa bez linku potwierdzającego (decyzja #33). Reset hasła i zmiana adresu e-mail u innych osób zaczną działać dopiero po podpięciu własnego serwera poczty: Authentication → Emails → SMTP Settings (np. Resend, Brevo). Dopiero wtedy da się też włączyć własne szablony wiadomości z `supabase/templates/` – na darmowym planie bez własnej poczty Supabase odrzuca ich zmianę, więc w `config.toml` są zakomentowane.

**Domena.** W dniu wyboru nazwy wolne były `seriodruk.com`, `seriodruk.app` i `seriodruk.pl`. Po podpięciu domeny trzeba zmienić Site URL, Redirect URLs i `site_url` w `config.toml`.

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
**Co jest.** `tests/` – 27 testów przeglądarkowych (Playwright + `node --test`): edytor, dotyk, konto, pliki, sekcje, wzorce, rozkładówki, tekst, narzędzia, podgląd, konflikt zapisu. Supabase zastępuje atrapa w `tests/pomoc.cjs`, więc testy nie dotykają Twojej bazy. Uruchamiają się w GitHub Actions przy każdym pushu (workflow „Testy”).
**Słabe.** Atrapa udaje Supabase – prawdziwej bazy, reguł RLS i poczty testy nie sprawdzają. Na prawdziwym tablecie nikt tego jeszcze nie przeklikał.

---

## B. Konto, baza, zapis

### B1. Rejestracja, logowanie, reset hasła ✅ / ⚠️
**Co jest.** Ekran dzielony na pół: z lewej stała ciemna „okładka” z nazwą, z prawej formularz z przełącznikiem Logowanie / Nowe konto. Wymagania hasła zaznaczają się na żywo. Po rejestracji widok „Sprawdź skrzynkę” z ponowną wysyłką po 60 s. Reset hasła linkiem. Powrót z linku w e-mailu jest rozpoznawany (potwierdzenie, reset, zmiana adresu, wygasły link).
**Dlaczego tak.** Z familijnej wzięty jest tylko zakres funkcji (rejestracja z potwierdzeniem, zasady hasła, ponowna wysyłka). Wygląd jest własny – po Twojej uwadze (decyzja #27) pierwsza wersja, która układem przypominała familijną, została przeprojektowana.
**Czego nie ma z familijnej (świadomie):** konta gościa, logowania nazwą użytkownika, limitów „raz na godzinę”, zabezpieczenia przed botami (Turnstile). Dopisz, jeśli któreś jest potrzebne.
**Słabe.** Konto działa od razu, bez potwierdzania adresu (decyzja #33) – ktoś może się zarejestrować na cudzy e-mail. Rejestracja jest otwarta dla każdego – świadomie (decyzja #29).

### B2. Ustawienia konta ✅
**Co jest.** `#/konto`: jedna kolumna grup (Profil, Logowanie, Wygląd, Urządzenia, Usuwanie konta) z nawigacją po lewej. Każde ustawienie to wiersz „opis – wartość – akcja”; formularze zmiany adresu, hasła i usunięcia konta rozwijają się w swoim wierszu dopiero po kliknięciu.
**Dlaczego tak.** Ten sam język co panel właściwości w edytorze: cienkie linie, wiersze, bez kart. Zwinięte formularze, bo zmiana hasła czy usunięcie konta to rzadkie czynności – nie powinny stale zajmować ekranu ani kusić przypadkowym kliknięciem.
**Słabe.** Po zmianie hasła nie przychodzi wiadomość „hasło zmienione” (Supabase ma taką opcję – do włączenia w panelu). Anulowanie rozpoczętej zmiany e-maila nie jest możliwe z aplikacji.

### B3. Własne e-maile ✅ / ⚠️
**Co jest.** Trzy szablony HTML w stylu aplikacji: potwierdzenie konta, nowe hasło, nowy adres.
**Słabe.** Szablony leżą w repozytorium, ale nie są używane: Supabase pozwala je zmienić dopiero z własnym serwerem poczty (punkt 0).

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
**Słabe.** Nie ma trybu pełnoekranowego z przewracaniem stron.

### C5. Udostępnianie podglądu linkiem ✅ / ⚠️
**Co jest.** „Udostępnij” w podglądzie tworzy link `#/u/<konto>/<projekt>/<losowy kod>`. Aplikacja rysuje wszystkie strony do obrazów JPEG i wysyła je z małym plikiem opisu do publicznego folderu w Supabase. Osoba z linkiem widzi ten sam widok co podgląd, bez logowania. Link można zaktualizować (adres zostaje) albo wyłączyć (pliki znikają).
**Dlaczego migawka z obrazów, a nie „żywy” projekt.** Osoba z linkiem dostaje tylko obrazy stron – nie dane projektu, nie zdjęcia w oryginale, nie dostęp do bazy. Nie trzeba otwierać bazy dla niezalogowanych ani ładować edytora i czcionek u oglądającego. Projekt w trakcie pracy nie „przecieka” do klienta, dopóki nie klikniesz Aktualizuj.
**Słabe.** Trzeba pamiętać o aktualizacji (okno podpowiada, gdy link jest nieaktualny). Publikacja wysyła wszystkie strony od nowa – przy kilkuset stronach potrwa i zajmie kilkadziesiąt MB. Nie ma hasła do linku ani daty ważności. Wymaga bucketu `podglady` z migracji (punkt 0.1).

---

## D. Edytor

### D1. Tekst ✅ / ⚠️
**Co jest.** Style tekstu wspólne dla projektu (zmiana stylu zmienia wszystkie teksty), odstęp liter, podkreślenie, przekreślenie, zmiana wielkości liter, formatowanie zaznaczonego fragmentu.
**Nie ma.** Kolumn, przelewania tekstu między ramkami, tabel, wcięć i wypunktowań, stałej wysokości ramki z wyrównaniem w pionie, kapitalików „na żywo” (zmiana wielkości liter zmienia sam tekst).
**Słabe.** Formatowanie fragmentu w tekście wzorca ze zmienną `{nr}` może się przesunąć, gdy numer ma inną liczbę cyfr.

### D2. Wyrównywanie, blokada, schowek ✅
Wyrównanie do marginesów (jeden element) lub do siebie (kilka), równe odstępy, blokada położenia, kopiuj/wytnij/wklej między stronami – skrótami i przyciskami.

### D3. Rozkładówki na jednym płótnie ✅ / ⚠️
**Co jest.** W sekcji z układem „rozkładówki” lewa i prawa strona są jednym płótnem. Marginesy lustrzane, grzbiet, przyciąganie do prowadnic obu stron, lista stron w parach. Element może leżeć przez grzbiet: w podglądzie, na miniaturach i w udostępnionym linku każda strona pokazuje swoją część. W sekcji z pojedynczymi stronami nic się nie zmieniło – rozkładówki są opcją sekcji.
**Dlaczego tak.** W pliku projektu strony zostały osobne. Element jest zapisany na tej stronie, na której leży jego środek, z położeniem liczonym od jej rogu; może wystawać poza nią. Przy składaniu strony aplikacja dokłada elementy sąsiedniej strony, które sięgają przez grzbiet. Dzięki temu dodawanie, usuwanie i przestawianie stron działa jak dotąd, a starsze projekty otwierają się bez przeróbek. Kolejność warstw między stronami pamięta pole `z` elementu.
**Słabe.** Po przestawieniu stron element przez grzbiet idzie ze swoją stroną i zachodzi na nowego sąsiada – trzeba to sprawdzić samemu. Elementy wzorców nie przechodzą przez grzbiet (są przycinane do swojej strony). W wewnętrznym pasku spadu miniatura z edytora pokazuje sąsiednią stronę, a miniatura rysowana w tle – własne tło; przy eksporcie do PDF trzeba będzie to ujednolicić. Na telefonie rozkładówka jest mała i trzeba ją powiększać.
**Lepiej.** Przełącznik „pokaż tylko jedną stronę” dla małych ekranów.

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

### D9. Układ ekranu i panel właściwości ✅ / ⚠️
**Co jest.** Z lewej lista stron i wzorców, w środku płótno z pływającym paskiem narzędzi, z prawej jeden panel: właściwości zaznaczonego elementu albo strony.
**Dlaczego tak.** Układ znany z programów do składu; jeden panel zmieniający treść zajmuje mniej miejsca niż kilka okienek.
**Słabe.** Panel jest długi i nie ma zwijanych części.

### D10. Dotyk i telefon ⚠️
**Co jest.** Jeden palec zaznacza i przesuwa elementy, dwa – widok. Na telefonie panele wysuwają się z dołu jako arkusze.
**Poprawione 2026-11-10 po Twoim zrzucie z telefonu.** Górny pasek uciekał poza ekran, a spod dolnego menu wystawał schowany arkusz. Ekran aplikacji jest teraz przypięty do okna (nie liczy wysokości w jednostkach okna, które na telefonie zmieniają się z paskiem adresu), dokument nie daje się przewinąć, zamknięte arkusze zjeżdżają całe poniżej ekranu, a arkusz właściwości ma stałą wysokość, żeby nie skakał przy zmianie zaznaczenia. Strona nie rysuje się już pod paskiem systemowym.
**Słabe.** Błędu nie umiałem odtworzyć w przeglądarce testowej – poprawka usuwa jego możliwe przyczyny, ale potwierdzić ją może tylko próba na Twoim telefonie. Rozkładówka na telefonie jest mała.

---

## E. Sekcje i wzorce

### E1. Sekcje ✅
Własny format, spad, cztery marginesy, układ, wzorce domyślne i **numeracja** (dalszy ciąg, od numeru, bez numerów).
**Nie ma.** Automatycznego liczenia szerokości grzbietu okładki z liczby kartek.

### E2. Wzorce połączone z motywami ✅
**Co jest.** Strona może mieć kilka wzorców naraz; każdy element wzorca leży pod albo nad treścią; wzorzec może odbijać się lustrzanie na lewych stronach (numer strony zawsze przy zewnętrznej krawędzi). Pojęcie „motyw” z planu zniknęło – to są wzorce.
**Słabe.** Kolejność wzorców wynika z kolejności na liście wzorców (nie da się jej zmienić przeciąganiem). Odbicie lustrzane grupy przenosi całą grupę, ale nie odbija układu w jej środku.

### E4. Lista stron ✅
Miniatury pogrupowane w sekcje, z numerem strony; w rozkładówkach strony stoją parami. Kolejność zmienia się z menu strony, nie przeciąganiem.

### E3. Jedno składanie strony ✅
`zlozenie.js` składa tło, wzorce i treść dla edytora, miniatur i podglądu – ten sam kod posłuży eksportowi PDF, więc wszędzie wygląda to identycznie.

---

## F. Pliki, instalacja, pomoc

### F1. Nazwa i format pliku ✅
Seriodruk, plik `.seriodruk` (ZIP z manifestem). Nazwa jest w jednym miejscu w kodzie (`js/marka.js`) plus pliki statyczne wymienione w komentarzu.

### F2. PWA ⚠️
Bez zmian; nadal nie sprawdzone na prawdziwym urządzeniu. Ikona to moja robocza kartka z literą „S” – do Twojej oceny.

### F3. Ciemny motyw ✅ / ⚠️
**Co jest.** Trzy możliwości: jak w systemie (domyślnie), jasny, ciemny. Wybór zapamiętany na urządzeniu, ustawiany przed pierwszym rysowaniem strony (bez mignięcia). Szybki przełącznik na logowaniu, liście projektów i w menu edytora; pełny wybór w ustawieniach konta.
**Dlaczego tak.** Wszystkie kolory interfejsu są zmiennymi, więc ciemny motyw to drugi zestaw wartości, a nie osobne style. Strony publikacji zostają białe – projektujesz na papierze, który będzie biały.
**Słabe.** Wybór jest per urządzenie, nie per konto. Zrzuty w instrukcji są w jasnym motywie. Wiadomości e-mail są zawsze jasne.

### F4. Instrukcja ✅
20 rozdziałów ze zrzutami generowanymi skryptem (`npm run zrzuty`), bez ramek „Dlaczego tak?” – uzasadnienia są w tym dokumencie.

---

## G. Co proponuję dalej

1. **Własny serwer poczty** (punkt 0) – dopiero z nim reset hasła i własne szablony wiadomości działają dla innych osób.
2. **Próba na tablecie** – gesty, klawiatura ekranowa, instalacja.
3. **Etap danych z planu**: import CSV/XLSX, pola `{kolumna}` w tekście, autodopasowanie tekstu, zakresy powielane według wierszy.
4. Przed etapem PDF: pliki czcionek w repozytorium, pomniejszone obrazy, strony jako osobne wiersze w bazie.
5. Po rozkładówkach na jednym płótnie (D3): widok jednej strony na telefonie.
