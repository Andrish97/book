# Uzasadnienie – funkcja po funkcji

Stan na 10 listopada 2026 (decyzje do #63 w [DECYZJE.md](DECYZJE.md)). Część „Słabe” przy każdej funkcji została przepisana po Twoich uwagach z decyzji #50: co poprawiłem, jest opisane jako „Poprawione”, a „Słabe” mówi tylko o tym, co naprawdę zostało. Ładniejsza wersja do czytania: artefakt „Uzasadnienie Seriodruku”. Przy każdej funkcji: co jest, dlaczego tak, co zostało słabe i co można zrobić lepiej.

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

### A1. Aplikacja statyczna, moduły bez builda ✅
**Co jest.** Czysty JavaScript w modułach, hosting na GitHub Pages. **Nowe:** dawny `aplikacja.js` (2300 linii) jest pocięty. Został plik startowy (ok. 500 linii: przyciski, zdarzenia, skróty, start), a reszta siedzi w `js/app/`: `kontekst` (wspólny stan), `skladniki` (stałe części ekranu), `zapis`, `trasy`, `logowanie`, `projekty`, `lista-stron`, `sekcje`, `wzorce`, `panel-strony`, `podglad-ekran`.
**Dlaczego tak.** Podział zrobił skrypt na podstawie analizy zależności (która funkcja czego używa), a nie ręczne przeklejanie – dzięki temu żadna linia nie zmieniła treści, tylko miejsce. Moduły importują od siebie funkcje, ale żaden nie zależy od pliku startowego, a `kontekst` nie zależy od nikogo.
**Zabezpieczenie.** W testach doszedł ESLint: nazwa użyta bez importu albo nieużywany import zatrzymuje testy. Po podziale to najłatwiejszy błąd do popełnienia.
**Słabe.** Moduły w `js/app/` nadal dużo o sobie wiedzą (importują się nawzajem). To podział na czytelne pliki, nie na niezależne części.

### A2. Fabric.js 7.4.0, przypięty w repozytorium ✅
**Co jest.** Silnik płótna to Fabric.js 7.4.0 – najnowsza linia – jako plik w repozytorium (`js/zewnetrzne/`), nie z zewnętrznego serwera.
**Skąd zmiana.** Wcześniej napisałem, że zostajemy przy 5.3.1, bo po podmianie pliku na wersję 6 aplikacja nie startowała. Zwróciłeś uwagę, że w Twoim innym projekcie działa wersja 7 – miałeś rację, a moja próba była za płytka: „podmień plik i zobacz” to nie migracja. Przepisane zostały miejsca styku z biblioteką: wczytywanie i kopiowanie obiektów (obietnice), grupy i zaznaczenie kilku elementów, zdarzenia myszy, łatki tekstu (ramka o stałej wysokości, listy, wielkość liter, przelewanie) i obrazów.
**Dlaczego bezpiecznie.** Format zapisu projektów został ten sam: położenie od lewego górnego rogu, typy małymi literami. Ustawienia, które o tym decydują, są w jednym pliku (`js/fabric-ustawienia.js`). Ten sam projekt wczytany w starej i nowej wersji ma identyczne ramki elementów; obraz strony różni się tylko wygładzaniem krawędzi (65 pikseli na 1,4 mln).
**Słabe.** Na prawdziwym ekranie dotykowym nikt tego jeszcze nie sprawdził – tylko w emulacji. Skalowanie uchwytem narożnym różni się od starej wersji o setne części milimetra.

### A3. Wszystko w milimetrach ✅

### A4. Testy w repozytorium ✅
**Co jest.** `tests/` – 56 testów przeglądarkowych (Playwright + `node --test`): edytor, dotyk, konto, pliki, sekcje, wzorce, rozkładówki, tekst, narzędzia, podgląd, udostępnianie, konflikt zapisu, siatka i odległości, skróty, prowadnice, warstwy, tabele, pola, serie, a od tej rundy także: jedna historia cofania, zapis tylko zmienionych stron, czcionki, kopie robocze zdjęć, eksport PDF, szablon danych i kontrola przed drukiem, listy, przelewanie tekstu, kolumny, tabela. Supabase zastępuje atrapa w `tests/pomoc.cjs`, więc testy nie dotykają Twojej bazy. Uruchamiają się w GitHub Actions przy każdym pushu (workflow „Testy”), razem ze sprawdzeniem kodu (ESLint).
**Próba na żywo.** `scripts/proba-na-zywo.cjs` (`npm run proba`) przechodzi opublikowaną aplikację na prawdziwej bazie kontem testowym, które na końcu usuwa. Uruchomiona po wdrożeniu zapisu stron osobno – przeszła.
**Słabe.** Próbę na prawdziwej bazie trzeba uruchomić ręcznie. Na prawdziwym tablecie nikt tego jeszcze nie przeklikał.

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

### B4. Zapis: urządzenie → konto, z wykrywaniem konfliktu ✅
**Co jest.** Zapis w przeglądarce po 0,7 s, na konto po 2,5 s. **Nowe:** na konto idą tylko strony, które się zmieniły. Każda strona jest osobnym wierszem w bazie (`projekty_strony`), a projekt (sekcje, wzorce, style, tabele, serie, kolejność stron) – jednym.
**Dlaczego tak.** Zapis robi jedna funkcja w bazie (`zapisz_projekt`): sprawdza wersję, zapisuje projekt i zmienione strony, usuwa strony, których już nie ma – wszystko naraz albo wcale. Bez tego przerwane połączenie mogłoby zostawić na koncie projekt w połowie zapisany. Stare projekty (strony w środku projektu) wczytują się jak dawniej i przechodzą na nowy układ przy pierwszym zapisie.
**Dodane w rundzie „większych prac” (decyzja #63).** Zmiany z dwóch urządzeń łączą się same, gdy dotyczą różnych części projektu (różnych stron, albo stron na jednym i tabeli danych na drugim). Pytanie pada tylko o części zmienione w obu miejscach – z wyborem dla każdej: „z tego urządzenia” albo „z konta”. Łączenie robi przeglądarka (porównanie trzech stanów: ostatnio uzgodnionego, lokalnego i z konta), a baza nadal przyjmuje zapis tylko z aktualnym numerem wersji – bez zmian w bazie.
**Słabe.** Najmniejsza łączona jednostka to cała strona (wzorzec, tabela, sekcja, seria, styl) – dwóch zmian na tej samej stronie aplikacja nie łączy element po elemencie. Po połączeniu „Cofnij” zaczyna od nowa. Plik `.seriodruk` wczytany w miejsce istniejącego projektu pyta o całość – celowo, żeby przywrócona kopia nie została po cichu połączona z tym, co miała zastąpić.

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
**Poprawione.** Projekt ma jeden link. Aktualizuje się sam kilka sekund po zapisie na koncie – rysowane i wysyłane są tylko zmienione strony. „Unieważnij link” go usuwa. Plakietka „Udostępniony” na karcie projektu otwiera okienko z linkiem.
**Słabe.** Nie ma hasła do linku ani daty ważności – pliki leżą w publicznym folderze, więc wymagałoby to osobnej funkcji po stronie serwera. Aktualizacja działa, gdy projekt jest otwarty na koncie (nie w trybie bez konta).

---

## D. Edytor

### D1. Tekst ✅ / ⚠️
**Co jest.** Style tekstu wspólne dla projektu, odstęp liter, podkreślenie, przekreślenie, zmiana wielkości liter, formatowanie zaznaczonego fragmentu, ramka o stałej wysokości z wyrównaniem w pionie i zmniejszaniem tekstu (`js/tekst-ramka.js`). **Nowe w tej rundzie:**
- **Listy** – punkty, kreski, numery. Znak jest rysowany przed akapitem, nie wpisany w treść, więc pola `{…}` i dane z tabeli nic o nim nie wiedzą; dalsze wiersze akapitu stoją równo pod pierwszym.
- **Przelewanie tekstu** (`js/watki.js`) – połączone ramki: co nie mieści się w jednej, płynie do następnej. „Podziel na kolumny” robi z ramki 2–4 połączone ramki obok siebie.
- **Tabela** – siatka linii i osobna ramka tekstu w każdej komórce.
**Dlaczego tak.** Każda połączona ramka trzyma *swoją* część tekstu, a nie odsyłacz do wspólnej całości. Dzięki temu zapisany projekt wygląda dobrze nawet bez przeliczania, a kopiowanie, cofanie i zapis działają jak dla zwykłych ramek. Przelewanie to osobny krok: skleja części, mierzy, ile wierszy mieści każda ramka, i rozdaje od nowa – w edytorze po każdej zmianie, przy składaniu strony po podstawieniu danych (dla każdego egzemplarza osobno). Kolumny są po prostu połączonymi ramkami, więc jest jeden mechanizm, nie dwa. Tabela z osobnych ramek pozwala pisać w komórkach i wstawiać w nich pola bez budowania drugiego edytora.
**Poprawione.** Tekst przelewa się w trakcie pisania, a kursor przechodzi za nim do następnej ramki. Ramki jednego tekstu mogą leżeć na różnych stronach („Ciąg dalszy na następnej stronie”); podgląd, PDF i kontrola przed drukiem przelewają go przez strony także po podstawieniu danych. Wielkość liter (WIELKIE / małe) jest wyglądem, nie zmianą treści. Tabela jest jednym obiektem (D15).
**Poprawione w rundzie „słabych stron” (decyzja #61).** Backspace na początku połączonej ramki usuwa znak z końca poprzedniej, Delete na końcu – z początku następnej, a strzałki przechodzą między ramkami. Po przestawieniu stron tekst płynie przez ramki w nowej kolejności stron. Autodopasowanie zmniejsza także fragmenty z własnym rozmiarem czcionki.
**Dodane w rundzie „większych prac” (decyzja #63).** Kapitaliki jako wygląd tekstu (przycisk obok AA/aa): małe litery wyglądają jak wielkie w mniejszym stopniu, treść zostaje taka, jak wpisana; w PDF to prawdziwy tekst.
**Słabe.** Gdy sąsiednia ramka połączonego tekstu jest na innej stronie, kursor tam nie przechodzi – zostaje, a aplikacja mówi, dokąd płynie tekst.

### D15. Tabela jako jeden obiekt ✅ / ⚠️
**Co jest (decyzja #58).** Tabela jest jednym elementem strony: jedno kliknięcie zaznacza ją całą, przesuwa się, obraca i układa w warstwach jak każdy inny element. Podwójne kliknięcie komórki zaczyna w niej pisanie; Tab przechodzi do następnej komórki (w ostatniej dodaje wiersz), Shift+Tab do poprzedniej, Esc wraca do zaznaczenia tabeli. Komórka to zwykły tekst – pola z danych i formatowanie fragmentów działają. Wiersz sam rośnie, gdy tekst się nie mieści, także na stronach powielanych z danych, osobno dla każdej. Szerokość kolumn zmieniają niebieskie znaczniki nad zaznaczoną tabelą albo liczby w panelu; w panelu są też wiersze i kolumny (dodaj / usuń), wiersz nagłówka, najmniejsza wysokość wierszy, kolor i grubość linii, pismo wszystkich komórek naraz.
**Dlaczego tak.** Tabela to grupa z opisem (szerokości kolumn, wysokości wierszy), a jej układ liczy jedna funkcja – ta sama w edytorze i przy składaniu strony. Dzięki temu tabela z danymi układa się poprawnie w podglądzie, PDF i na miniaturach bez osobnego kodu.
**Poprawione w rundzie „słabych stron” (decyzja #61).** Tło komórek: osobny kolor dla nagłówka i dla co drugiego wiersza. Każdy wiersz może mieć własną najmniejszą wysokość. Przy skalowaniu uchwytem kolumny i wiersze przeliczają się na bieżąco. „Sprawdź przed drukiem” ostrzega, gdy tabela po wypełnieniu danymi wychodzi poza stronę.
**Dodane w rundzie „większych prac” (decyzja #63).** Scalanie komórek: w trakcie pisania w komórce przyciski „Scal z komórką po prawej / poniżej” i „Rozdziel komórki”.
**Poprawione (decyzja #65).** Przy scalaniu tekst dołączanych komórek nie znika: dopisuje się do scalonej jako kolejne akapity, wierszami od lewej, razem z pogrubieniami. „Rozdziel” zostawia cały tekst w pierwszej komórce; Ctrl+Z przywraca stan sprzed scalenia.
**Słabe.** Nie ma osobnych linii dla pojedynczej komórki. Na telefonie przycisk wstawiania tabeli jest schowany.

### D2. Wyrównywanie, blokada, schowek ✅
Wyrównanie do marginesów (jeden element) lub do siebie (kilka), równe odstępy, blokada położenia, kopiuj/wytnij/wklej między stronami – skrótami i przyciskami.

### D3. Rozkładówki na jednym płótnie ✅ / ⚠️
**Co jest.** W sekcji z układem „rozkładówki” lewa i prawa strona są jednym płótnem. Marginesy lustrzane, grzbiet, przyciąganie do prowadnic obu stron, lista stron w parach. Element może leżeć przez grzbiet: w podglądzie, na miniaturach i w udostępnionym linku każda strona pokazuje swoją część. W sekcji z pojedynczymi stronami nic się nie zmieniło – rozkładówki są opcją sekcji.
**Dlaczego tak.** W pliku projektu strony zostały osobne. Element jest zapisany na tej stronie, na której leży jego środek, z położeniem liczonym od jej rogu; może wystawać poza nią. Przy składaniu strony aplikacja dokłada elementy sąsiedniej strony, które sięgają przez grzbiet. Dzięki temu dodawanie, usuwanie i przestawianie stron działa jak dotąd, a starsze projekty otwierają się bez przeróbek. Kolejność warstw między stronami pamięta pole `z` elementu.
**Poprawione.** Po zmianie kolejności stron aplikacja ostrzega, gdy element leżący przez grzbiet trafił obok innej strony. Element wzorca, który wychodzi przez grzbiet dalej niż na spad, leży na obu stronach – ta sama zasada co dla zwykłych elementów (moja decyzja; alternatywą byłyby osobne „wzorce rozkładówkowe” o szerokości dwóch stron – powiedz, jeśli wolisz). Miniatury są rysowane tym samym kodem co podgląd i PDF, więc wewnętrzny pasek spadu wygląda wszędzie tak samo.
**Słabe.** Tło wzorca narysowane „z zapasem” większym niż spad pokaże się paskiem na sąsiedniej stronie (aplikacja ostrzega o elemencie poza spadem). Na telefonie rozkładówka jest mała i trzeba ją powiększać.
**Lepiej.** Przełącznik „pokaż tylko jedną stronę” dla małych ekranów.

### D4. Linie pomocnicze i ostrzeżenia ✅
**Co jest.** Linia cięcia, spad, marginesy, grzbiet; ostrzeżenia o elementach w marginesie, poza spadem i poza stroną. **Nowe:** linijki, własne prowadnice, siatka i przyciąganie do innych elementów (D11, D12); ostrzeżenia o nieznanym polu i o tekście, który nie mieści się w ramce.

### D11. Siatka, linijki, własne prowadnice ✅ / ⚠️
**Co jest.** Siatka o zadanym kroku w mm z przyciąganiem; linijki w mm z zerem w rogu strony bieżącej; prowadnice wyciągane z linijek, przesuwane i usuwane przez wyciągnięcie poza stronę. Ustawienia siatki należą do projektu, prowadnice – do strony albo wzorca.
**Dlaczego tak.** Siatka liczy się od rogu każdej strony, więc na rozkładówce obie strony mają ten sam układ linii. Do siatki trafia lewy górny róg elementu – położenie jest wtedy zawsze wielokrotnością kroku. Prowadnice i krawędzie innych elementów mają pierwszeństwo przed siatką, bo są dokładniejszą wskazówką.
**Poprawione.** Przyciąganie działa także przy zmianie rozmiaru uchwytem. Prowadnicę wpisuje się liczbą we właściwościach strony (lista prowadnic w mm, dodawanie, usuwanie) – także na telefonie, gdzie linijek nie ma.
**Poprawione w rundzie „słabych stron” (decyzja #61).** Prowadnice można zablokować (menu z kratką): zablokowanych nie da się złapać myszą. Cofanie obejmuje prowadnice – wcześniejsza uwaga, że nie obejmuje, była nieaktualna; teraz pilnuje tego test.
**Słabe.** Zablokowaną prowadnicę nadal da się zmienić liczbą we właściwościach strony – to celowe.

### D12. Odległości i równe odstępy ✅ / ⚠️
**Co jest.** Przy przesuwaniu: różowe linie wyrównania do krawędzi i środków innych elementów, strzałki z odległością w mm do najbliższych sąsiadów, fioletowe oznaczenie równych odstępów (środek między sąsiadami albo odstęp powtórzony z tego samego rzędu). Alt przy zaznaczonym elemencie pokazuje odległości także do krawędzi strony.
**Dlaczego tak.** Obliczenia są w osobnym pliku (`js/przyciaganie.js`) na samych prostokątach w mm – dzięki temu mają własne testy, niezależne od płótna.
**Poprawione.** Gdy naprzeciwko nie ma sąsiada, mierzony jest najbliższy element po skosie (z przedłużeniem jego krawędzi). Obrócony element liczy się swoim kształtem, nie prostokątem dookoła.
**Słabe.** Pomiar po skosie pokazuje odległość w poziomie i w pionie, nie po przekątnej.

### D13. Skróty klawiszowe ✅
**Co jest.** Ponad 50 skrótów jak w programach do składu: edycja, zaznaczanie, przesuwanie, układ, tekst (także w trakcie pisania), wstawianie, widok, strony. Alt przy przeciąganiu zostawia kopię, Shift trzyma jedną oś i obraca co 15°, spacja z przeciąganiem przesuwa widok.
**Dlaczego tak.** Skróty są jedną tabelą (`js/skroty.js`): z niej działa klawiatura i z niej powstaje lista w instrukcji, więc nie mogą się rozjechać. Linijki mają Shift+R, a nie Ctrl+R jak w Adobe, bo Ctrl+R w przeglądarce odświeża stronę.
**Słabe.** Kilku skrótów przeglądarka może nie oddać aplikacji (zależy od przeglądarki i systemu).

### D14. Warstwy ✅ / ⚠️
**Co jest.** Zakładka z listą elementów strony od wierzchu: zaznaczanie, kolejność przeciąganiem, ukrywanie, blokada, własne nazwy.
**Poprawione.** Warstwy są zakładką prawego panelu, obok właściwości (dotyczą tego samego: elementów otwartej strony). Kolejność zmienia się też przyciskami ▲▼ – działa na dotyku. Elementy wzorców są na liście, z nazwą wzorca; kliknięcie otwiera wzorzec.
**Poprawione w rundzie „słabych stron” (decyzja #61).** Grupę da się rozwinąć na liście warstw: każdy jej element ma własne oko i nazwę.
**Poprawione (decyzja #65).** Grupę otwiera podwójne kliknięcie (albo kliknięcie jej elementu na liście warstw): element można przesunąć, przeskalować, obrócić, zmienić we właściwościach i napisać w nim tekst – bez rozgrupowywania. Otwartą grupę widać po pomarańczowej ramce z podpisem; Esc, kliknięcie obok albo „Wróć do całej grupy” ją zamyka, a grupa zachowuje identyfikator i miejsce wśród warstw. Grupowanie i rozgrupowanie nie zmieniają już kolejności: grupa staje tam, gdzie był jej najwyższy element, a elementy po rozgrupowaniu tam, gdzie była grupa.
**Słabe.** W otwartej grupie zaznacza się po jednym elemencie; obrazu nie kadruje się w niej przeciąganiem, a kształtu nie zmienia punkt po punkcie; grupa w grupie się nie otwiera. Tabela jest jednym wierszem bez rozwijania.

### D5. Obrazy ✅ / ⚠️
**Co jest.** Obraz jest zasobem projektu; strona na niego wskazuje. Kadrowanie przeciąganiem i liczbami. **Nowe:** duże zdjęcia (dłuższy bok ponad 2000 px) pokazują się w edytorze, miniaturach i podglądzie jako lżejsza kopia robocza (1600 px); do PDF i PNG idzie oryginał (`js/obrazy.js`).
**Dlaczego tak.** Kopia istnieje tylko w pamięci przeglądarki – nie jest zapisywana ani wysyłana, więc nie ma dwóch plików do pilnowania. Wymiary i przycięcie obrazu na stronie są zawsze liczone w pikselach oryginału, dlatego projekt wygląda identycznie z kopią i bez niej, a eksport po prostu podmienia źródło.
**Wklejanie (decyzja #46).** Ctrl+V wstawia obraz ze schowka systemu: zrzut ekranu, obraz skopiowany ze strony albo z programu graficznego, plik z menedżera plików, kod SVG skopiowany jako tekst (`js/wklejanie.js`). SVG jest porządkowany przed wstawieniem: dostaje rozmiar z `viewBox`, gdy go nie ma (inaczej przeglądarka wczytałaby obraz o zerowych wymiarach), traci skrypty, a mała ikona dostaje większy rozmiar bazowy, żeby nie wyszła rozmyta. Zostaje wektorem – jest ostry w każdym powiększeniu i w PDF. Skopiowanie elementu w aplikacji wpisuje do schowka systemu jego tekst albo nazwę, więc Ctrl+V zawsze wkleja to, co skopiowano ostatnio.
**Poprawione.** Obrócony i odbity obraz kadruje się ramką (na czas kadrowania jest prostowany). Obraz można wkleić ze schowka.
**Poprawione w rundzie „słabych stron” (decyzja #61).** W PDF wektorowym rysunek SVG jest wektorem (kształty rozłożone raz na cały plik); obrazem zostaje tylko rysunek z filtrem, maską, wzorem albo osadzonym zdjęciem.
**Dodane w rundzie „większych prac” (decyzja #63).** Oryginały zdjęć nie siedzą już w pamięci karty: leżą w magazynie plików przeglądarki, a w projekcie jest sam opis. Dane projektu z dwunastoma dużymi zdjęciami zmalały w pamięci z 23,9 MB do 50 kB; oryginał jest doczytywany do eksportu.
**Rysunek SVG jako edytowalna grupa (decyzja #64).** SVG wstawia się nadal jako wierny obraz, a przycisk **Rozłóż rysunek na elementy** we właściwościach obrazu zamienia go w zwykłą grupę kształtów i napisów w tym samym miejscu, z obrotem, odbiciem i skalą obrazu (`js/svg-elementy.js`). Grupę można rozgrupować; kształty mają wymiary i grubość obrysu w milimetrach, koło staje się elipsą, a wielokąt i łamana kształtami z punktami (takimi jak z pióra). Napis staje się ramką tekstu z prawdziwym rozmiarem pisma, w miejscu wyznaczonym przez punkt zaczepienia wiersza; czcionka z zestawu albo z projektu zostaje, inną zastępuje domyślna i aplikacja mówi, którą. Przy wstawianiu rysunku z napisami aplikacja podpowiada tę możliwość, bo napisy w obrazie przeglądarka rysuje czcionką systemu. Dlaczego osobny krok, a nie od razu przy wstawianiu: obraz jest zawsze wierny, a rozkład nie odtwarza filtrów, masek ani wzorów – decyzję zostawiam Tobie, a Ctrl+Z ją cofa.
**Słabe.** Po rozłożeniu znikają filtry, maski i wzory (aplikacja o tym mówi); rysunek z osadzonym zdjęciem się nie rozkłada; napis z kilku części (`tspan`) staje się jednym wierszem; przycięcie obrazu nie przechodzi na grupę. Magazyn plików dotyczy tej przeglądarki; projekt otwarty na nowym urządzeniu pobiera zdjęcia z konta jak dotąd.

### D6. Cofanie ✅
**Co jest.** Jedna historia dla całego projektu (`js/historia.js`), 80 kroków: zmiany na stronach i wzorcach, dodawanie, usuwanie i przesuwanie stron, sekcje, style, tabele, serie, ustawienia widoku. Po cofnięciu edytor otwiera stronę albo wzorzec, którego dotyczyła zmiana.
**Dlaczego tak.** Krok historii to stan całego projektu, ale strony, które się nie zmieniły, nie są kopiowane – kolejne kroki dzielą ten sam zapis. 80 kroków w projekcie na 300 stron zajmuje więc niewiele więcej niż sam projekt. Osobne historie stron i osobne „cofnij usunięcie” z poprzedniej rundy zniknęły: jedna reguła zamiast trzech.
**Słabe.** Historia kończy się z zamknięciem projektu. Zmiany w oknie danych łączą się w jeden krok na jedno otwarcie okna.

### D7. Czcionki: oficjalny zestaw 52 rodzin i własne pliki ✅ / ⚠️
**Co jest (decyzja #49).** Czcionki to lista plików. Do projektu wgrywasz własne pliki TTF, OTF, WOFF albo WOFF2 (z listy czcionek w panelu tekstu albo z menu ⋯ → „Czcionki projektu”); aplikacja czyta z pliku nazwę rodziny, wagę i kursywę, a przy WOFF2 zgaduje je z nazwy pliku – nazwę rodziny można poprawić. Plik czcionki jest zasobem projektu, tak jak obraz: jedzie z nim na konto i do pliku `.seriodruk`. Obok jest osiem czcionek wbudowanych (Inter, Open Sans, Montserrat, Lora, Merriweather, Playfair Display, Source Serif 4, Caveat) – pliki w repozytorium, licencja OFL.
**Dlaczego tak.** Zapytałeś, skąd wzięły się te czcionki i czy nie lepiej mieć po prostu listę plików. Osiem wbudowanych to mój wybór na start: popularne, darmowe także w druku komercyjnym, z polskimi znakami. Do prawdziwej pracy potrzebne są Twoje – stąd wgrywanie plików. Czcionka w projekcie, a nie na koncie, bo projekt musi dać się otworzyć z pliku na innym komputerze i wyglądać tak samo.
**Eksport.** Tekst w PDF jest spłaszczony (część obrazu strony), więc czcionki nie są drukarni potrzebne. Opcja „Dołącz pliki czcionek” dodaje je do archiwum obok PDF.
**Oficjalny zestaw (decyzja #60).** Aplikacja ma jeden zestaw czcionek dla wszystkich projektów i użytkowników. Okno „Czcionki” pokazuje go z próbkami i pozwala pobrać pliki TTF (jedną rodzinę albo cały zestaw, z licencją). Do pobieranej paczki PDF pliki użytych czcionek z zestawu dołączają się same, gdy plik nie ma czcionek w środku, a na życzenie zawsze. Skład zestawu to nadal osiem rodzin, które wybrałem sam – czeka na Twoją decyzję. Własne czcionki są dodatkiem.
**Poprawione.** „Moje czcionki”: czcionka wgrana raz jest na liście czcionek w każdym następnym projekcie i – przy pracy z kontem – na każdym urządzeniu (prywatny folder plików na koncie, bez zmian w bazie). PDF wektorowy osadza czcionki i zapisuje tekst jako tekst; opcja „Dołącz pliki czcionek” została.
**Poprawione w rundzie „słabych stron” (decyzja #61).** Tekst pisany własną czcionką WOFF2 i kursywą bez własnego pliku trafia do PDF jako krzywe (ostre w każdym powiększeniu), a nie jako obraz. Aplikacja po eksporcie mówi osobno, co poszło jako krzywe, a co jako obraz.
**Dodane w rundzie „większych prac” (decyzja #63).** Zestaw ma 52 rodziny (decyzja #62) i pobiera się dopiero przy użyciu. Pogrubienie i kursywa są wyszarzone, gdy czcionka nie ma takiej odmiany.
**Słabe.** Tekst zapisany w PDF jako krzywe nie da się zaznaczyć. Czcionka zmienna w WOFF2 w grubości innej niż podstawowa i udawane pogrubienie nadal idą do PDF jako obraz. Repozytorium urosło o pliki czcionek (ok. 16 MB).

### D8. Kształty, gradienty, cienie ✅ / ⚠️
**Co jest.** Wielokąt foremny i gwiazda (liczba boków we właściwościach), wypełnienie przejściem dwóch kolorów w trzech kierunkach, cień z przesunięciem i rozmyciem w mm. Panel warstw i linijki są w D11 i D14, zwijane sekcje panelu w D9.
**Poprawione.** Rysowanie odręczne (narzędzie „Rysuj”, klawisz B). Gradient liniowy albo kołowy z dowolną liczbą kolorów, położeniem każdego koloru, kątem i promieniem.
**Dodane w rundzie „większych prac” (decyzja #63).** Pióro (klawisz N): kliknięcia stawiają punkty, przeciągnięcie robi łuk; gotowy kształt i rysunek odręczny mają edycję punktów i uchwytów (dwuklik albo „Edytuj punkty”).
**Słabe.** Na telefonie pióro i edycja punktów są schowane.

### D9. Układ ekranu i panel właściwości ✅ / ⚠️
**Co jest.** Z lewej lista stron i wzorców, w środku płótno z pływającym paskiem narzędzi, z prawej jeden panel: właściwości zaznaczonego elementu albo strony.
**Dlaczego tak.** Układ znany z programów do składu; jeden panel zmieniający treść zajmuje mniej miejsca niż kilka okienek.
**Poprawione.** Części panelu zwijają się kliknięciem w tytuł i zostają zwinięte (wybór pamięta urządzenie).
**Poprawione.** Strony, wzorce i warstwy są w różnych miejscach: strony z lewej, właściwości i warstwy w zakładkach z prawej, wzorce w osobnym oknie z górnego paska. Listy rozwijane, wybór koloru i pola wyboru rysuje aplikacja – wyglądają tak samo na każdym urządzeniu.
**Poprawione w rundzie „słabych stron” (decyzja #61).** Na dłuższych listach rozwijanych (ponad 8 pozycji) pisanie zawęża listę do pozycji zawierających wpisany fragment, bez rozróżniania wielkości liter i polskich znaków.
**Słabe.** Panel tekstu nadal ma wiele części (zwijanych).

### D10. Dotyk i telefon ⚠️
**Co jest.** Jeden palec zaznacza i przesuwa elementy, dwa – widok. Na telefonie panele wysuwają się z dołu jako arkusze.
**Poprawione 2026-11-10 po Twoim zrzucie z telefonu.** Górny pasek uciekał poza ekran, a spod dolnego menu wystawał schowany arkusz. Ekran aplikacji jest teraz przypięty do okna (nie liczy wysokości w jednostkach okna, które na telefonie zmieniają się z paskiem adresu), dokument nie daje się przewinąć, zamknięte arkusze zjeżdżają całe poniżej ekranu, a arkusz właściwości ma stałą wysokość, żeby nie skakał przy zmianie zaznaczenia. Strona nie rysuje się już pod paskiem systemowym.
**Nowe.** „W rozkładówkach pokazuj jedną stronę” (menu z kratką): na wąskim ekranie włączone domyślnie, więc na telefonie edytujesz jedną stronę rozkładówki naraz.
**Poprawione (decyzja #59).** Na telefonie edytor działa w pionie: strona u góry, panele wysuwane z dołu, o stałej wysokości (nie skaczą, gdy przeglądarka chowa pasek adresu). Telefon trzymany poziomo i okno niższe niż 480 px pokazują planszę „Za mało miejsca na wysokość”. Wcześniej zrobiłem odwrotnie (edytor w poziomie) – to było błędne odczytanie Twojej uwagi. Schowane na małym ekranie: wielokąt, tabela, kadrowanie ramką, linijki.
**Słabe.** Sprawdzone tylko w emulacji telefonu – potwierdzić może próba na Twoim urządzeniu, zwłaszcza „skaczące okienka”, których nie umiałem odtworzyć. Trybu pełnoekranowego nie ma: iPhone nie pozwala na niego stronie w przeglądarce; pełny ekran daje zainstalowanie aplikacji. W widoku jednej strony nie widać elementów sąsiedniej strony, które przechodzą przez grzbiet.

---

## E. Sekcje i wzorce

### E1. Sekcje ✅
Własny format, spad, cztery marginesy, układ, wzorce domyślne i **numeracja** (dalszy ciąg, od numeru, bez numerów).
**Nowe.** Kalkulator okładki w ustawieniach sekcji: z szerokości strony środka, liczby stron i grubości kartki liczy grzbiet i szerokość okładki (tył + grzbiet + przód) i wpisuje ją jednym kliknięciem. Grubość kartki trzeba wziąć od drukarni.

### E2. Wzorce połączone z motywami ✅
**Co jest.** Strona może mieć kilka wzorców naraz; każdy element wzorca leży pod albo nad treścią; wzorzec może odbijać się lustrzanie na lewych stronach (numer strony zawsze przy zewnętrznej krawędzi). Pojęcie „motyw” z planu zniknęło – to są wzorce.
**Poprawione.** Kolejność wzorców zmienia się z menu wzorca (wyżej / niżej). Odbicie lustrzane odbija także układ wewnątrz grupy.
**Jak działają wzorce i dlaczego były w jednym panelu ze stronami.** Wzorzec to osobna „strona-szablon” z elementami wspólnymi (tło, stopka, numer). Strona nie kopiuje jego elementów – tylko się do niego odwołuje, więc zmiana we wzorcu zmienia naraz wszystkie strony, które go używają. Strona może mieć kilka wzorców (np. tło + stopka); sekcja ma wzorce domyślne, a pojedyncza strona może mieć własny wybór. Wcześniej wzorce i warstwy były zakładkami nad listą stron – wzorowałem to na panelu „Strony” w programach do składu, gdzie strony wzorcowe leżą nad zwykłymi. Miałeś rację, że to mieszało trzy różne rzeczy w jednym miejscu.
**Zmienione (decyzja #53).** Strony są z lewej. Warstwy są zakładką prawego panelu, obok właściwości. Wzorce mają własne okno otwierane z górnego paska: lista szablonów projektu z przyciskami „Dodaj do tej strony” i „Do całej sekcji” oraz **wzorce standardowe** – numer strony na dole albo przy zewnętrznej krawędzi, stopka, nagłówek, linie do pisania, kratka, ramka, zakładka – które dopasowują się do formatu i marginesów sekcji i po dodaniu do projektu są zwykłymi wzorcami do zmiany.

### E4. Lista stron ✅
Miniatury pogrupowane w sekcje, z numerem strony i znaczkiem serii; w rozkładówkach strony stoją parami. Kolejność zmienia się z menu albo przeciąganiem miniatury myszą (także do innej sekcji). Na ekranie dotykowym zostaje menu.

### E3. Jedno składanie strony ✅
`zlozenie.js` składa tło, wzorce i treść dla edytora, miniatur i podglądu – ten sam kod posłuży eksportowi PDF, więc wszędzie wygląda to identycznie.

---

## G. Dane, pola i serie

### G1. Tabele z lekkim edytorem ✅ / ⚠️
**Co jest.** Okno „Dane”: import CSV i Excela (każdy arkusz to tabela), edycja komórek, dodawanie i usuwanie wierszy i kolumn, wklejanie skopiowanych komórek z arkusza, pobranie tabeli jako CSV. Zmiana nazwy kolumny poprawia pola we wszystkich tekstach projektu. Ponowny import pliku o tej samej nazwie podmienia dane tabeli. **Nowe:** kolumnę można oznaczyć znakiem ≠ jako pilnowaną – powtórzone wartości są podświetlone w tabeli i wypisane przed drukiem.
**Dlaczego tak.** Plan zakładał sam import; poprosiłeś o lekki edytor, więc jest tyle, ile trzeba, żeby poprawić literówkę albo dopisać wiersz bez wracania do arkusza. „Pule wartości” z planu (5.1) zrobiłem jako pilnowanie powtórzeń w kolumnie, bo po wprowadzeniu serii z tabelą tryb „po kolei, w kółko” już istnieje (seria ze stałą liczbą powieleń bierze wiersze w kółko), a tryb „ręcznie” to po prostu wpisanie wartości w komórkę. Brakowało tylko trzeciego: ostrzeżenia, gdy coś, co ma być niepowtarzalne, wypada dwa razy.
**Poprawione.** Długa tabela przewija się w całości (wiersze dorysowują się porcjami).
**Poprawione w rundzie „słabych stron” (decyzja #61).** Pilnowanie powtórzeń nie rozróżnia wielkości liter ani zbędnych spacji: „Praca”, „praca ” i „PRACA” to jedna wartość.
**Słabe.** Formatowanie z arkusza (kolory, pogrubienia) nie jest przenoszone – tabela to sam tekst.

### G2. Pola w tekście i pola dokumentu ✅
**Co jest.** `{nazwa}` w zwykłym tekście: kolumna tabeli albo pole dokumentu (numer strony w kilku zapisach, numer ogólny i w sekcji, liczba stron, nazwa sekcji i strony, numer i liczba egzemplarzy serii, data, numer pierwszej strony innej sekcji, numer strony o podanej nazwie). Lista „Wstaw pole”, podświetlenie pól w edytorze, ostrzeżenie o nieznanym polu.
**Dlaczego tak.** Pole jest częścią tekstu, a nie osobnym obiektem – tak ustalił plan i tak da się pisać `{dzien}. {miesiac} {rok}` w jednej linijce. Pola dokumentu działają jak pola w Wordzie: wynikają z projektu, nie z tabeli, więc np. spis treści z numerami stron innych sekcji aktualizuje się sam, także po powieleniu serii.
**Poprawione.** Zwykłe klamry: przełącznik „Klamry { } to zwykły tekst, nie pola” przy tekście. Pola najwygodniej wstawia lista „Wstaw pole”.
**Poprawione w rundzie „słabych stron” (decyzja #61).** Zwykłe klamry obok pól w jednym tekście: podwójne `{{` i `}}` dają w podglądzie i PDF pojedyncze klamry, a pola obok działają.
**Słabe.** Pole z tabeli działa tylko na stronach serii z tą tabelą. Zmiana nazwy kolumny poprawi też napis w podwójnych klamrach o tej samej nazwie.

### G3. Serie: powielanie stron ✅ / ⚠️
**Co jest.** Strona wskazuje serię; sąsiednie strony z tą samą serią tworzą blok. Blok powiela się według wierszy tabeli albo stałą liczbę razy. Powielenia widać w podglądzie, na miniaturach, w udostępnionym linku, w numeracji i w PDF. **Nowe:** okno serii pokazuje, jakich pól używają strony bloku, dodaje brakujące kolumny do tabeli (albo tworzy tabelę z pól) i pobiera **szablon danych** – plik Excela z dokładnie tymi kolumnami, istniejącymi danymi i arkuszem „Instrukcja” z opisem każdej kolumny.
**Dlaczego tak.** Powielone strony nie są zapisywane: `js/serie.js` rozwija projekt przy każdym składaniu, więc 365 stron dni to jedna strona i tabela. Szablon idzie „w drugą stronę”: projekt mówi, jakich danych potrzebuje, zamiast żebyś zgadywał nazwy kolumn. Arkusz „Instrukcja” jest pomijany przy imporcie, więc wypełniony plik wraca bez przeróbek.
**Poprawione.** „Sprawdź przed drukiem” wstawia dane każdego wiersza i mówi, na których stronach tekst nie mieści się w ramce (G5).
**Słabe.** W rozkładówkach blok o nieparzystej liczbie stron wypada na przemian po lewej i prawej; marginesy lustrzane widać wtedy tylko w podglądzie. Szablon danych nie ma list rozwijanych w komórkach – same nagłówki i opis.

### G6. Dodatkowe tabele serii i koniec serii na ostatnim wierszu ✅ / ⚠️
**Co jest (decyzja #47).** Seria ma tabelę główną (ona wyznacza liczbę stron) i dowolnie wiele tabel dodatkowych. Tabela dodatkowa przechodzi do następnego wiersza co zadaną liczbę stron serii – np. tabela tygodni co 7 stron dni, tytuł rozdziału co 8 stron. Pierwszy wiersz może obowiązywać krócej (rok zaczynający się w środku tygodnia). Pole z tabeli dodatkowej to `{Tabela.kolumna}`; sama nazwa kolumny działa, gdy nie ma jej w tabeli głównej. Przy „jednym wierszu na stronę bloku” seria kończy się na ostatnim wierszu – ostatnie powielenie bloku może być niepełne (opcja „Dokończ ostatni blok” przywraca dawne zachowanie).
**Dlaczego tak.** Zamiast powielać w tabeli dni tę samą informację o tygodniu w siedmiu wierszach, wpisujesz ją raz. Krok liczony w stronach serii jest jedną regułą na wszystkie przypadki: „co 7 dni” przy jednej stronie na dzień i „raz na blok” przy bloku ośmiu stron to ta sama liczba w tym samym polu. Tabela dodatkowa nie idzie w kółko – gdy zabraknie wierszy, pola są puste, a aplikacja mówi o tym w trzech miejscach (okno serii, właściwości strony, lista przed drukiem) z numerem strony, od której brakuje danych. Ciche powtarzanie starych danych byłoby gorsze niż widoczna dziura.
**Zmiana zachowania.** Wcześniej niepełny ostatni blok był dokańczany stronami bez danych. Projekty z taką serią będą teraz krótsze o te puste strony, chyba że zaznaczysz „Dokończ ostatni blok”.
**Poprawione w rundzie „słabych stron” (decyzja #61).** Tabela dodatkowa ma drugi tryb: „nowy wiersz, gdy zmieni się kolumna” tabeli głównej. Tabela miesięcy przechodzi do następnego wiersza dokładnie tam, gdzie w tabeli dni zmienia się miesiąc – niezależnie od tego, czy ma 28, czy 31 dni.
**Słabe.** Tryb patrzy na jedną kolumnę; zmiany „gdy zmieni się miesiąc albo rok” trzeba ująć w jednej kolumnie (np. „2027-01”).

### G7. Kolor i położenie elementu z danych ✅ / ⚠️
**Co jest (decyzja #48).** Każdy element może brać kolor z pola (kolumna z kolorami) oraz przesunięcie w pionie i w poziomie z pola liczbowego: kolumny tabeli albo pola dokumentu, np. numeru powielenia. Dwa tryby: wartość to numer pozycji (krok w mm, z powrotem do początku co N pozycji) albo wprost milimetry.
**Dlaczego tak.** Twój przykład – miesiące na brzegu strony, każdy niżej, sześć na wysokość – to „pozycja = numer powielenia, krok = wysokość zakładki, od nowa co 6”. Nie wymaga żadnej kolumny w tabeli: wystarcza pole `{egzemplarz}`. Kolor z tabeli pozwala mieć jeden wzór strony na cały rok w dwunastu barwach. Reguła jest zapisana przy elemencie, a wzór zostaje w projekcie nietknięty – tak samo jak tekst z polami.
**Jak to działa, krok po kroku.** Zaznaczasz element (prostokąt, tekst, obraz, grupę) i we właściwościach rozwijasz **Z danych**. Są tam trzy niezależne ustawienia:
- **Kolor z pola.** Wybierasz kolumnę. Na każdej powielonej stronie aplikacja bierze wartość z tej kolumny w wierszu tej strony i używa jej jako koloru elementu. Rozumie zapisy `#d1495b`, `d1495b`, `rgb(209,73,91)` i angielskie nazwy (`navy`, `tomato`). Kształt z wypełnieniem dostaje nowe wypełnienie; linia i kształt bez wypełnienia – nowy kolor obrysu; tekst – kolor liter. Pusta albo niezrozumiała wartość zostawia kolor wzoru.
- **Przesunięcie w pionie z pola** i **przesunięcie w poziomie z pola.** Wybierasz pole z liczbą – kolumnę tabeli albo pole dokumentu, np. `egzemplarz` (numer powielenia: 1, 2, 3…), `nr` (numer strony). Potem tryb:
  - **„Wartość to numer pozycji”**: podajesz **krok** w mm. Pozycja 1 to miejsce, w którym element stoi we wzorze; pozycja 2 jest o jeden krok dalej, pozycja 3 o dwa kroki itd. **„Od nowa co N”** zawija liczenie: przy N = 6 pozycja 7 wraca na miejsce pierwszej, 8 na miejsce drugiej. Przykład zakładek miesięcy: zakładka ma 30 mm wysokości, krok = 30 mm, od nowa co 6, pole = `egzemplarz` – styczeń stoi najwyżej, czerwiec najniżej, lipiec znów najwyżej.
  - **„Wartość to przesunięcie w mm”**: liczba z tabeli jest wprost przesunięciem względem wzoru (może być ujemna i z przecinkiem). Przydatne, gdy położenia nie da się policzyć krokiem – wpisujesz je w arkuszu.
- Gdzie widać efekt: w edytorze element stoi w miejscu wzoru (pozycja 1, kolor wzoru) – edytujesz wzór, nie konkretną stronę. Prawdziwy kolor i położenie każdej strony są w **Podglądzie**, na miniaturach, w udostępnionym linku i w PDF.
- Wzorce: element wzorca też może mieć „Z danych”. Na lewych stronach rozkładówki przy wzorcu z odbiciem lustrzanym przesunięcie w poziomie odwraca się – zakładka trafia na zewnętrzny brzeg.
- Pole, którego aplikacja nie zna (literówka, usunięta kolumna), trafia na listę ostrzeżeń.
**Poprawione w rundzie „słabych stron” (decyzja #61).** Z danych można też sterować obrotem (kąt z pola liczbowego) i widocznością elementu: zawsze, gdy pole jest niepuste, puste albo równe podanej wartości – np. gwiazdka tylko w święta.
**Poprawione (decyzja #65).** Z danych można sterować rozmiarem: „Szerokość z pola” i „Wysokość z pola”, każda osobno w procentach rozmiaru wzoru albo w mm, z punktem zaczepienia (lewy górny róg, środek, dół) – np. słupek wykresu rosnący od dołu. Tekst i obraz zmieniają ramkę (litery i proporcje zdjęcia zostają), tabela – kolumny i wiersze, kształty i grupy są skalowane. Wartość 0 albo ujemna chowa element.
**Słabe.** W edytorze widać tylko wzór; efekt jest w podglądzie. Wysokość tekstu bez stałej wysokości ramki nie zmienia się z danych, bo wynika z treści. Kolor zastępuje całe wypełnienie, także gradient.

### G4. Obraz z kolumny tabeli ✅ / ⚠️
**Co jest.** Obraz-wzór wyznacza ramkę; kolumna podaje nazwę pliku wgranego do projektu. Podmieniony obraz wpisuje się w ramkę bez zmiany proporcji. **Nowe:** brak pliku o podanej nazwie trafia na listę „Do sprawdzenia przed drukiem” z numerami stron.
**Poprawione.** Podmieniony obraz może wypełniać ramkę z przycięciem albo mieścić się w niej cały – wybór przy obrazie-wzorze.
**Poprawione w rundzie „słabych stron” (decyzja #61).** Przy wypełnianiu ramki wybierasz, która część zdjęcia zostaje: środek, góra, dół, lewa albo prawa.
**Słabe.** Kadru nie ustawia się osobno dla każdego wiersza danych – jedno ustawienie na obraz-wzór.

### G5. Kontrola przed drukiem ✅ / ⚠️
**Co jest.** Okno eksportu PDF pokazuje uwagi do całego projektu, już po powieleniu serii: pola bez wartości, brakujące pliki obrazów, powtórzone wartości w pilnowanych kolumnach (z numerami stron, na których wypadają), niepełny ostatni blok serii (`js/kontrola.js`).
**Dlaczego tak.** Ostrzeżenia w edytorze dotyczą otwartej strony-wzoru. Tego, że w 212. wierszu tabeli brakuje zdjęcia, na wzorze nie widać – trzeba przejść wszystkie egzemplarze. Uwagi nie blokują eksportu, bo czasem pusty obraz jest zamierzony.
**Poprawione.** Osobne okno w menu ⋯ („Sprawdź przed drukiem”), nie tylko w oknie PDF. Lista obejmuje teksty, które nie mieszczą się w ramce na którejkolwiek powielonej stronie – z numerami stron i przyciskiem „Pokaż”.
**Poprawione w rundzie „słabych stron” (decyzja #61).** „Pokaż” przy uwadze otwiera podgląd przewinięty do pierwszej strony, której uwaga dotyczy, z wyróżnioną kartką; „Otwórz wzór” otwiera stronę w edytorze. Nowa uwaga: tabela, która po wypełnieniu danymi wychodzi poza stronę.
**Słabe.** Sprawdzanie tekstów w bardzo dużym projekcie trwa; lista uzupełnia się na bieżąco.

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
30 rozdziałów ze zrzutami generowanymi skryptem (`npm run zrzuty`), bez ramek „Dlaczego tak?” – uzasadnienia są w tym dokumencie.

---

## I. Eksport

### I1. Eksport do PDF ✅ / ⚠️
**Co jest.** Dwa rodzaje pliku. **Wektorowy** (domyślny): tekst jest prawdziwym tekstem z osadzonymi czcionkami, kształty, linie, gradienty i rysunki odręczne są wektorami, zdjęcia JPEG i PNG idą w oryginale – bez ponownej kompresji i raz w pliku. **Obrazy stron**: każda strona jest jednym obrazem w wybranej rozdzielczości (dotychczasowy sposób). W obu: zakres stron, spad i znaki cięcia, informacja o formacie po obcięciu i o spadzie (TrimBox, BleedBox), podział na pliki, powielenia serii, lista uwag przed drukiem. Opcje pliku wektorowego: „Zamień tekst na krzywe” i „Kolory tekstu i kształtów w CMYK”.
**Dlaczego tak.** Plik wektorowy powstaje z tego samego kodu, który rysuje stronę na ekranie: edytor rysuje element, a zamiast pikseli zapisywane są polecenia PDF. Dzięki temu układ wierszy, listy, pola z danych, wielkość liter i przelewanie są w PDF takie same jak w podglądzie – nie ma drugiego, osobnego „silnika składu”, który mógłby się rozjechać. Czego nie da się zapisać wektorowo (cień, maska, czcionka bez pliku do osadzenia, znak spoza czcionki), idzie jako obraz tego jednego elementu, a aplikacja po eksporcie mówi, ile takich elementów było i dlaczego. Test porównuje stronę z PDF, narysowaną niezależnym czytnikiem, z obrazem z aplikacji i odczytuje z pliku tekst z polskimi znakami.
**Poprawione w rundzie „słabych stron” (decyzja #61).** Rysunki SVG są w pliku wektorami. Tekst pisany czcionką, której nie da się osadzić, idzie jako krzywe zamiast obrazu.
**Dodane w rundzie „większych prac” (decyzja #63).** PDF/X-4 z profilem barwnym: lista „Standard dla drukarni” (papier powlekany FOGRA39, niepowlekany FOGRA47 albo profil od drukarni). Kolory tekstu i kształtów są przeliczane przez profil (czarny tekst samą czarną farbą), a opcja „Zdjęcia też w CMYK” przelicza przez ten sam profil także zdjęcia.
**Słabe.** Pliku nie sprawdził żaden program kontrolny (Acrobat Preflight, veraPDF) – ostatecznie potwierdzi go próbny plik w drukarni. Plik na papier powlekany rośnie o ok. 8 MB (osadzony profil). W trybie „Obrazy stron” zdjęcia zostają w RGB z opisem.
**Poprawione (decyzja #65).** Ligatury („fi”, „fl”, „ffl”) są w pliku tym samym kształtem co na ekranie, a przy zaznaczaniu i wyszukiwaniu zostają zwykłymi literami; tam, gdzie przeglądarka rysuje litery osobno (tekst rozstrzelony), plik też ich nie łączy. Położenie każdej litery uwzględnia kerning. Działa także przy tekście zamienionym na krzywe.

### I2. PNG strony ✅
**Co jest.** Bieżąca strona albo wzorzec jako PNG w 300 dpi, ze spadem, z oryginalnych zdjęć (wcześniej 150 dpi z tego, co było na płótnie).

---

## H. Co proponuję dalej

1. **Próba na Twoim tablecie i telefonie** – gesty, klawiatura ekranowa, instalacja, panele z boków, plansza w pionie. Tego nie zrobię za Ciebie; to jedyna rzecz, której nie umiem sprawdzić.
2. **Próbny plik do drukarni** – wyślij PDF wektorowy (z CMYK i bez) i zapytaj, czy go przyjmą. Jeśli wymagają PDF/X z profilem, to jest następna praca przy eksporcie.
3. **Poczta**, gdy będzie domena (decyzja #34).
4. **Pióro z krzywymi**, rysunki SVG jako wektory w PDF, listy rozwijane w szablonie danych – mniejsze rzeczy, które zostały z listy.
5. **Pamięć przy setkach zdjęć** – przechowywanie oryginałów poza pamięcią karty (D5).
