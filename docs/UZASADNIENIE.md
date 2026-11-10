# Uzasadnienie – funkcja po funkcji

Stan na 10 listopada 2026 (decyzje do #42 w [DECYZJE.md](DECYZJE.md)). Ładniejsza wersja do czytania: artefakt „Uzasadnienie Seriodruku”. Przy każdej funkcji: co jest, dlaczego tak, co zostało słabe i co można zrobić lepiej.

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
**Co jest.** `tests/` – 47 testów przeglądarkowych (Playwright + `node --test`): edytor, dotyk, konto, pliki, sekcje, wzorce, rozkładówki, tekst, narzędzia, podgląd, udostępnianie, konflikt zapisu, siatka i odległości, skróty, prowadnice, warstwy, tabele, pola, serie. Supabase zastępuje atrapa w `tests/pomoc.cjs`, więc testy nie dotykają Twojej bazy. Uruchamiają się w GitHub Actions przy każdym pushu (workflow „Testy”).
**Nowe.** `scripts/proba-na-zywo.cjs` (`npm run proba`) przechodzi opublikowaną aplikację na prawdziwej bazie kontem testowym, które na końcu usuwa: rejestracja, zapis z obrazem, drugie urządzenie, udostępnianie, usunięcie konta.
**Słabe.** Zwykłe testy używają atrapy Supabase; próbę na prawdziwej bazie trzeba uruchomić ręcznie. Na prawdziwym tablecie nikt tego jeszcze nie przeklikał.

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

### C4. Podgląd bez edycji ✅
**Co jest.** Wszystkie strony po kolei jak po przycięciu (z powieleniami serii), rozkładówki obok siebie, pojedyncze strony w rzędach, powiększanie, kliknięcie strony otwiera ją w edytorze. Strony rysują się dopiero, gdy są widoczne. **Nowe:** tryb prezentacji – jedna strona albo rozkładówka naraz na całym ekranie, przewracana strzałkami; działa też w podglądzie z linku.

### C5. Udostępnianie podglądu linkiem ✅ / ⚠️
**Co jest.** „Udostępnij” w podglądzie tworzy link `#/u/<konto>/<projekt>/<losowy kod>`. Aplikacja rysuje wszystkie strony do obrazów JPEG i wysyła je z małym plikiem opisu do publicznego folderu w Supabase. Osoba z linkiem widzi ten sam widok co podgląd, bez logowania. Link można zaktualizować (adres zostaje) albo wyłączyć (pliki znikają).
**Dlaczego migawka z obrazów, a nie „żywy” projekt.** Osoba z linkiem dostaje tylko obrazy stron – nie dane projektu, nie zdjęcia w oryginale, nie dostęp do bazy. Nie trzeba otwierać bazy dla niezalogowanych ani ładować edytora i czcionek u oglądającego. Projekt w trakcie pracy nie „przecieka” do klienta, dopóki nie klikniesz Aktualizuj.
**Poprawione.** Aktualizacja wysyła tylko strony, których obraz się zmienił (skróty obrazów są zapisane w opisie podglądu).
**Słabe.** Trzeba pamiętać o aktualizacji (okno podpowiada, gdy link jest nieaktualny). Przy aktualizacji aplikacja i tak rysuje wszystkie strony, żeby sprawdzić, które się zmieniły. Nie ma hasła do linku ani daty ważności – pliki leżą w publicznym folderze, więc wymagałoby to osobnej funkcji po stronie serwera.

---

## D. Edytor

### D1. Tekst ✅ / ⚠️
**Co jest.** Style tekstu wspólne dla projektu (zmiana stylu zmienia wszystkie teksty), odstęp liter, podkreślenie, przekreślenie, zmiana wielkości liter, formatowanie zaznaczonego fragmentu. **Nowe:** ramka o stałej wysokości z wyrównaniem w pionie i zmniejszaniem tekstu, który się nie mieści (`js/tekst-ramka.js`).
**Poprawione.** Formatowanie fragmentu z polem (np. pogrubione `{nr}`) przesuwa się razem z podstawioną wartością – wcześniej mogło się rozjechać, gdy wartość miała inną długość. Zmiana wielkości liter nie rusza nazw pól w klamrach.
**Nie ma.** Kolumn, przelewania tekstu między ramkami, tabel, wcięć i wypunktowań, kapitalików „na żywo” (zmiana wielkości liter zmienia sam tekst).
**Słabe.** Przy autodopasowaniu fragmenty z własnym rozmiarem czcionki nie zmniejszają się razem z resztą.

### D2. Wyrównywanie, blokada, schowek ✅
Wyrównanie do marginesów (jeden element) lub do siebie (kilka), równe odstępy, blokada położenia, kopiuj/wytnij/wklej między stronami – skrótami i przyciskami.

### D3. Rozkładówki na jednym płótnie ✅ / ⚠️
**Co jest.** W sekcji z układem „rozkładówki” lewa i prawa strona są jednym płótnem. Marginesy lustrzane, grzbiet, przyciąganie do prowadnic obu stron, lista stron w parach. Element może leżeć przez grzbiet: w podglądzie, na miniaturach i w udostępnionym linku każda strona pokazuje swoją część. W sekcji z pojedynczymi stronami nic się nie zmieniło – rozkładówki są opcją sekcji.
**Dlaczego tak.** W pliku projektu strony zostały osobne. Element jest zapisany na tej stronie, na której leży jego środek, z położeniem liczonym od jej rogu; może wystawać poza nią. Przy składaniu strony aplikacja dokłada elementy sąsiedniej strony, które sięgają przez grzbiet. Dzięki temu dodawanie, usuwanie i przestawianie stron działa jak dotąd, a starsze projekty otwierają się bez przeróbek. Kolejność warstw między stronami pamięta pole `z` elementu.
**Słabe.** Po przestawieniu stron element przez grzbiet idzie ze swoją stroną i zachodzi na nowego sąsiada – trzeba to sprawdzić samemu. Elementy wzorców nie przechodzą przez grzbiet (są przycinane do swojej strony). W wewnętrznym pasku spadu miniatura z edytora pokazuje sąsiednią stronę, a miniatura rysowana w tle – własne tło; przy eksporcie do PDF trzeba będzie to ujednolicić. Na telefonie rozkładówka jest mała i trzeba ją powiększać.
**Lepiej.** Przełącznik „pokaż tylko jedną stronę” dla małych ekranów.

### D4. Linie pomocnicze i ostrzeżenia ✅
**Co jest.** Linia cięcia, spad, marginesy, grzbiet; ostrzeżenia o elementach w marginesie, poza spadem i poza stroną. **Nowe:** linijki, własne prowadnice, siatka i przyciąganie do innych elementów (D11, D12); ostrzeżenia o nieznanym polu i o tekście, który nie mieści się w ramce.

### D11. Siatka, linijki, własne prowadnice ✅ / ⚠️
**Co jest.** Siatka o zadanym kroku w mm z przyciąganiem; linijki w mm z zerem w rogu strony bieżącej; prowadnice wyciągane z linijek, przesuwane i usuwane przez wyciągnięcie poza stronę. Ustawienia siatki należą do projektu, prowadnice – do strony albo wzorca.
**Dlaczego tak.** Siatka liczy się od rogu każdej strony, więc na rozkładówce obie strony mają ten sam układ linii. Do siatki trafia lewy górny róg elementu – położenie jest wtedy zawsze wielokrotnością kroku. Prowadnice i krawędzie innych elementów mają pierwszeństwo przed siatką, bo są dokładniejszą wskazówką.
**Słabe.** Przyciąganie działa przy przesuwaniu, nie przy zmianie rozmiaru uchwytem. Prowadnic nie da się wpisać liczbą ani zablokować. Na telefonie linijki są schowane. Cofanie nie obejmuje prowadnic.

### D12. Odległości i równe odstępy ✅ / ⚠️
**Co jest.** Przy przesuwaniu: różowe linie wyrównania do krawędzi i środków innych elementów, strzałki z odległością w mm do najbliższych sąsiadów, fioletowe oznaczenie równych odstępów (środek między sąsiadami albo odstęp powtórzony z tego samego rzędu). Alt przy zaznaczonym elemencie pokazuje odległości także do krawędzi strony.
**Dlaczego tak.** Obliczenia są w osobnym pliku (`js/przyciaganie.js`) na samych prostokątach w mm – dzięki temu mają własne testy, niezależne od płótna.
**Słabe.** Sąsiad to element leżący „naprzeciwko” (z częścią wspólną w poprzek kierunku); elementy po skosie nie są mierzone. Obrócone elementy liczą się swoim prostokątem otaczającym.

### D13. Skróty klawiszowe ✅
**Co jest.** Ponad 50 skrótów jak w programach do składu: edycja, zaznaczanie, przesuwanie, układ, tekst (także w trakcie pisania), wstawianie, widok, strony. Alt przy przeciąganiu zostawia kopię, Shift trzyma jedną oś i obraca co 15°, spacja z przeciąganiem przesuwa widok.
**Dlaczego tak.** Skróty są jedną tabelą (`js/skroty.js`): z niej działa klawiatura i z niej powstaje lista w instrukcji, więc nie mogą się rozjechać. Linijki mają Shift+R, a nie Ctrl+R jak w Adobe, bo Ctrl+R w przeglądarce odświeża stronę.
**Słabe.** Kilku skrótów przeglądarka może nie oddać aplikacji (zależy od przeglądarki i systemu).

### D14. Warstwy ✅ / ⚠️
**Co jest.** Zakładka z listą elementów strony od wierzchu: zaznaczanie, kolejność przeciąganiem, ukrywanie, blokada, własne nazwy.
**Słabe.** Na ekranie dotykowym kolejności nie zmienia się przeciąganiem (zostają przyciski kolejności we właściwościach). Elementy wzorców nie są na liście.

### D5. Obrazy ✅ / ⚠️
**Co jest.** Obraz jest zasobem projektu; strona na niego wskazuje. **Nowe:** kadrowanie przeciąganiem (podwójne kliknięcie obrazu: cały obraz z ramką, reszta przyciemniona), obok przycięcia liczbami.
**Słabe.** Obrazy nadal są trzymane w pamięci w pełnej rozdzielczości – pomniejszone kopie robocze zrobię razem z eksportem PDF, bo dopiero tam potrzebny jest podział na „do ekranu” i „do druku”. Obróconego albo odbitego obrazu nie kadruje się ramką, tylko liczbami.

### D6. Cofanie ✅ / ⚠️
**Co jest.** 60 kroków w obrębie otwartej strony albo rozkładówki. **Nowe:** usunięcie strony, sekcji albo wzorca oraz przesunięcie strony da się cofnąć przyciskiem w komunikacie albo Ctrl+Z.
**Dlaczego tak.** Przed taką operacją aplikacja zapamiętuje cały projekt (bez obrazów). Cofnięcie jest możliwe do pierwszej następnej zmiany na stronie – wtedy zapamiętany stan przestałby pasować i cofnięcie zabrałoby tę zmianę ze sobą. Wolę jasną regułę „od razu po operacji” niż ciche gubienie pracy.
**Słabe.** To nie jest jedna wspólna historia całego projektu: zmiany stylów, serii i tabel nie cofają się, a historia strony zaczyna się od nowa po przejściu na inną.

### D7. Czcionki ⚠️
Bez zmian: 8 czcionek OFL z Google Fonts. Przed eksportem PDF trzeba przenieść pliki czcionek do repozytorium.

### D8. Kształty, gradienty, cienie ✅ / ⚠️
**Co jest.** Wielokąt foremny i gwiazda (liczba boków we właściwościach), wypełnienie przejściem dwóch kolorów w trzech kierunkach, cień z przesunięciem i rozmyciem w mm. Panel warstw i linijki są w D11 i D14, zwijane sekcje panelu w D9.
**Słabe.** Nie ma kształtów rysowanych odręcznie (krzywe, pióro) ani gradientów kołowych i wielokolorowych.

### D9. Układ ekranu i panel właściwości ✅ / ⚠️
**Co jest.** Z lewej lista stron i wzorców, w środku płótno z pływającym paskiem narzędzi, z prawej jeden panel: właściwości zaznaczonego elementu albo strony.
**Dlaczego tak.** Układ znany z programów do składu; jeden panel zmieniający treść zajmuje mniej miejsca niż kilka okienek.
**Poprawione.** Części panelu zwijają się kliknięciem w tytuł i zostają zwinięte (wybór pamięta urządzenie).
**Słabe.** Przy tekście panel nadal ma dużo części; na telefonie trzeba je przewijać.

### D10. Dotyk i telefon ⚠️
**Co jest.** Jeden palec zaznacza i przesuwa elementy, dwa – widok. Na telefonie panele wysuwają się z dołu jako arkusze.
**Poprawione 2026-11-10 po Twoim zrzucie z telefonu.** Górny pasek uciekał poza ekran, a spod dolnego menu wystawał schowany arkusz. Ekran aplikacji jest teraz przypięty do okna (nie liczy wysokości w jednostkach okna, które na telefonie zmieniają się z paskiem adresu), dokument nie daje się przewinąć, zamknięte arkusze zjeżdżają całe poniżej ekranu, a arkusz właściwości ma stałą wysokość, żeby nie skakał przy zmianie zaznaczenia. Strona nie rysuje się już pod paskiem systemowym.
**Nowe.** „W rozkładówkach pokazuj jedną stronę” (menu z kratką): na wąskim ekranie włączone domyślnie, więc na telefonie edytujesz jedną stronę rozkładówki naraz.
**Słabe.** Błędu nie umiałem odtworzyć w przeglądarce testowej – poprawka usuwa jego możliwe przyczyny, ale potwierdzić ją może tylko próba na Twoim telefonie. W widoku jednej strony nie widać elementów sąsiedniej strony, które przechodzą przez grzbiet (są na miniaturze i w podglądzie).

---

## E. Sekcje i wzorce

### E1. Sekcje ✅
Własny format, spad, cztery marginesy, układ, wzorce domyślne i **numeracja** (dalszy ciąg, od numeru, bez numerów).
**Nowe.** Kalkulator okładki w ustawieniach sekcji: z szerokości strony środka, liczby stron i grubości kartki liczy grzbiet i szerokość okładki (tył + grzbiet + przód) i wpisuje ją jednym kliknięciem. Grubość kartki trzeba wziąć od drukarni.

### E2. Wzorce połączone z motywami ✅
**Co jest.** Strona może mieć kilka wzorców naraz; każdy element wzorca leży pod albo nad treścią; wzorzec może odbijać się lustrzanie na lewych stronach (numer strony zawsze przy zewnętrznej krawędzi). Pojęcie „motyw” z planu zniknęło – to są wzorce.
**Poprawione.** Kolejność wzorców zmienia się z menu wzorca (wyżej / niżej). Odbicie lustrzane odbija także układ wewnątrz grupy.

### E4. Lista stron ✅
Miniatury pogrupowane w sekcje, z numerem strony i znaczkiem serii; w rozkładówkach strony stoją parami. Kolejność zmienia się z menu albo przeciąganiem miniatury myszą (także do innej sekcji). Na ekranie dotykowym zostaje menu.

### E3. Jedno składanie strony ✅
`zlozenie.js` składa tło, wzorce i treść dla edytora, miniatur i podglądu – ten sam kod posłuży eksportowi PDF, więc wszędzie wygląda to identycznie.

---

## G. Dane, pola i serie

### G1. Tabele z lekkim edytorem ✅ / ⚠️
**Co jest.** Okno „Dane”: import CSV i Excela (każdy arkusz to tabela), edycja komórek, dodawanie i usuwanie wierszy i kolumn, wklejanie skopiowanych komórek z arkusza, pobranie tabeli jako CSV. Zmiana nazwy kolumny poprawia pola we wszystkich tekstach projektu. Ponowny import pliku o tej samej nazwie podmienia dane tabeli, a serie zostają z nią powiązane.
**Dlaczego tak.** Plan zakładał sam import, a pełną edycję tabeli odkładał. Poprosiłeś o lekki edytor, więc jest tyle, ile trzeba, żeby poprawić literówkę albo dopisać wiersz bez wracania do arkusza – bez formuł, sortowania i formatów. Dane leżą w pliku projektu jako tekst, więc jadą z nim na konto i do pliku `.seriodruk`.
**Słabe.** Przy tabeli dłuższej niż 1500 wierszy okno pokazuje tylko początek. Nie ma cofania w tabeli. Formatowanie z arkusza (pogrubienia, kolory) nie jest przenoszone – tylko tekst i podziały linii.

### G2. Pola w tekście i pola dokumentu ✅
**Co jest.** `{nazwa}` w zwykłym tekście: kolumna tabeli albo pole dokumentu (numer strony w kilku zapisach, numer ogólny i w sekcji, liczba stron, nazwa sekcji i strony, numer i liczba egzemplarzy serii, data, numer pierwszej strony innej sekcji, numer strony o podanej nazwie). Lista „Wstaw pole”, podświetlenie pól w edytorze, ostrzeżenie o nieznanym polu.
**Dlaczego tak.** Pole jest częścią tekstu, a nie osobnym obiektem – tak ustalił plan i tak da się pisać `{dzien}. {miesiac} {rok}` w jednej linijce. Pola dokumentu działają jak pola w Wordzie: wynikają z projektu, nie z tabeli, więc np. spis treści z numerami stron innych sekcji aktualizuje się sam, także po powieleniu serii.
**Słabe.** Pole z tabeli działa tylko na stronach serii z tą tabelą; na zwykłej stronie zostaje jako tekst w klamrach (z ostrzeżeniem).

### G3. Serie: powielanie stron ✅ / ⚠️
**Co jest.** Strona wskazuje serię; sąsiednie strony z tą samą serią tworzą blok. Blok powiela się według wierszy tabeli (jeden wiersz na blok albo jeden na stronę) albo stałą liczbę razy. Powielenia widać w podglądzie, na miniaturach (pierwszy egzemplarz), w udostępnionym linku i w numeracji.
**Dlaczego tak.** Powielone strony nie są zapisywane: `js/serie.js` rozwija projekt przy każdym składaniu. Projekt z 365 stronami dni zostaje więc jedną stroną i tabelą – plik jest mały, a zmiana danych od razu zmienia wszystkie egzemplarze. To też rozwiązuje dawną obawę z B4, że projekty urosną przy powielaniu.
**Słabe.** W rozkładówkach blok o nieparzystej liczbie stron wypada na przemian po lewej i prawej; projektujesz go na jednej stronie, więc marginesy lustrzane widać tylko w podglądzie. Nie ma „pul wartości” z planu (rozdawanie tagów bez powtórzeń) ani eksportu szablonu danych. Aplikacja nie sprawdza z góry, czy teksty wszystkich wierszy mieszczą się w ramkach – widać to dopiero w podglądzie.

### G4. Obraz z kolumny tabeli ✅ / ⚠️
**Co jest.** Obraz-wzór wyznacza ramkę; kolumna podaje nazwę pliku wgranego do projektu. Podmieniony obraz wpisuje się w ramkę bez zmiany proporcji.
**Słabe.** Obraz nie wypełnia ramki z przycięciem („cover”), tylko się w niej mieści. Brak pliku o podanej nazwie pokazuje znak zastępczy, ale nie trafia na listę ostrzeżeń.

---

## F. Pliki, instalacja, pomoc

### F1. Nazwa i format pliku ✅
Seriodruk, plik `.seriodruk` (ZIP z manifestem). Nazwa jest w jednym miejscu w kodzie (`js/marka.js`) plus pliki statyczne wymienione w komentarzu.

### F2. PWA ⚠️
Bez zmian; nadal nie sprawdzone na prawdziwym urządzeniu. Ikona to moja robocza kartka z literą „S” – do Twojej oceny.

### F3. Ciemny motyw ✅ / ⚠️
**Co jest.** Trzy możliwości: jak w systemie (domyślnie), jasny, ciemny. Wybór zapamiętany na urządzeniu, ustawiany przed pierwszym rysowaniem strony (bez mignięcia). Szybki przełącznik na logowaniu, liście projektów i w menu edytora; pełny wybór w ustawieniach konta.
**Dlaczego tak.** Wszystkie kolory interfejsu są zmiennymi, więc ciemny motyw to drugi zestaw wartości, a nie osobne style. Strony publikacji zostają białe – projektujesz na papierze, który będzie biały.
**Poprawione.** Wybór motywu zapisuje się na koncie i obowiązuje na każdym urządzeniu.
**Słabe.** Zrzuty w instrukcji są w jasnym motywie. Wiadomości e-mail są zawsze jasne.

### F4. Instrukcja ✅
27 rozdziałów ze zrzutami generowanymi skryptem (`npm run zrzuty`), bez ramek „Dlaczego tak?” – uzasadnienia są w tym dokumencie.

---

## H. Co proponuję dalej

1. **Próba na tablecie i telefonie** – gesty, klawiatura ekranowa, instalacja, wysuwane panele.
2. **Zastrzeżenia, które zostały** (decyzja #35): podział `aplikacja.js` (A1), przejście na Fabric 6 (A2), zapis tylko zmienionych stron (B4), jedna historia cofania dla całego projektu (D6), kolumny, tabele i przelewanie tekstu (D1), przyciąganie przy zmianie rozmiaru (D11).
3. **Eksport PDF**; przed nim pliki czcionek w repozytorium i pomniejszone obrazy do pracy na ekranie.
4. **Pule wartości i szablon danych** z planu (5.1, 5.2).
5. **Poczta**, gdy będzie domena (decyzja #34).
