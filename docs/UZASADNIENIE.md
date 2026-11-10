# Uzasadnienie – funkcja po funkcji

Stan na 10 listopada 2026 (decyzje do #45 w [DECYZJE.md](DECYZJE.md)). Ładniejsza wersja do czytania: artefakt „Uzasadnienie Seriodruku”. Przy każdej funkcji: co jest, dlaczego tak, co zostało słabe i co można zrobić lepiej.

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

### A2. Fabric.js 5.3.1 – zostaje, przypięty w repozytorium ✅ / ⚠️
**Co jest.** Silnik płótna to Fabric.js 5.3.1, teraz jako plik w repozytorium (`js/zewnetrzne/`), nie z zewnętrznego serwera.
**Dlaczego nie Fabric 6.** Zrobiłem próbę: po podmianie biblioteki na 6.7 aplikacja w ogóle nie startuje, a z 15 sprawdzonych testów nie przechodzi żaden. Wersja 6 to inna biblioteka pod tą samą nazwą: inne wczytywanie obrazów i kopiowanie obiektów (obietnice zamiast funkcji zwrotnych), przepisane grupy i zaznaczenia, zmienione wnętrze tekstu. A właśnie na wnętrzu tekstu stoją nasze dodatki: ramka o stałej wysokości, listy, przelewanie, pola. Migracja to kilka dni pracy bez żadnej zmiany widocznej dla Ciebie i z dużym ryzykiem cichych błędów w składzie.
**Co w zamian.** Wersja jest przypięta i leży u nas, więc nic jej nie podmieni ani nie wyłączy. Wszystkie nasze łatki na Fabric są w trzech plikach (`tekst-ramka.js`, `obrazy.js`, `watki.js`) i mają testy – gdy migracja będzie potrzebna (np. błąd bezpieczeństwa albo funkcja tylko z wersji 6), wiadomo, co ruszyć.
**Słabe.** Wersja 5 nie dostaje już nowych funkcji.

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
**Słabe.** Konflikt (zmiana z innego urządzenia) rozstrzyga się nadal dla całego projektu, nie dla pojedynczych stron. Wzorce i tabele idą w całości przy każdym zapisie – są małe, więc to nie boli.

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
**Co jest.** Style tekstu wspólne dla projektu, odstęp liter, podkreślenie, przekreślenie, zmiana wielkości liter, formatowanie zaznaczonego fragmentu, ramka o stałej wysokości z wyrównaniem w pionie i zmniejszaniem tekstu (`js/tekst-ramka.js`). **Nowe w tej rundzie:**
- **Listy** – punkty, kreski, numery. Znak jest rysowany przed akapitem, nie wpisany w treść, więc pola `{…}` i dane z tabeli nic o nim nie wiedzą; dalsze wiersze akapitu stoją równo pod pierwszym.
- **Przelewanie tekstu** (`js/watki.js`) – połączone ramki: co nie mieści się w jednej, płynie do następnej. „Podziel na kolumny” robi z ramki 2–4 połączone ramki obok siebie.
- **Tabela** – siatka linii i osobna ramka tekstu w każdej komórce.
**Dlaczego tak.** Każda połączona ramka trzyma *swoją* część tekstu, a nie odsyłacz do wspólnej całości. Dzięki temu zapisany projekt wygląda dobrze nawet bez przeliczania, a kopiowanie, cofanie i zapis działają jak dla zwykłych ramek. Przelewanie to osobny krok: skleja części, mierzy, ile wierszy mieści każda ramka, i rozdaje od nowa – w edytorze po każdej zmianie, przy składaniu strony po podstawieniu danych (dla każdego egzemplarza osobno). Kolumny są po prostu połączonymi ramkami, więc jest jeden mechanizm, nie dwa. Tabela z osobnych ramek pozwala pisać w komórkach i wstawiać w nich pola bez budowania drugiego edytora.
**Słabe.** W trakcie pisania tekst nie przelewa się na bieżąco – dopiero po wyjściu z ramki (kursor nie umie przeskoczyć do następnej ramki). Ramki łączy się w obrębie strony albo rozkładówki, nie przez kilka stron. Tabela nie jest jednym obiektem: zmiana szerokości kolumny to przesunięcie linii i ramek ręcznie. Kapitaliki „na żywo” nadal nie istnieją. Przy autodopasowaniu fragmenty z własnym rozmiarem czcionki nie zmniejszają się razem z resztą.

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
**Co jest.** Obraz jest zasobem projektu; strona na niego wskazuje. Kadrowanie przeciąganiem i liczbami. **Nowe:** duże zdjęcia (dłuższy bok ponad 2000 px) pokazują się w edytorze, miniaturach i podglądzie jako lżejsza kopia robocza (1600 px); do PDF i PNG idzie oryginał (`js/obrazy.js`).
**Dlaczego tak.** Kopia istnieje tylko w pamięci przeglądarki – nie jest zapisywana ani wysyłana, więc nie ma dwóch plików do pilnowania. Wymiary i przycięcie obrazu na stronie są zawsze liczone w pikselach oryginału, dlatego projekt wygląda identycznie z kopią i bez niej, a eksport po prostu podmienia źródło.
**Słabe.** Oryginały nadal siedzą w pamięci karty (jako dane projektu) – kopie przyspieszają rysowanie, ale nie zmniejszają zużycia pamięci przy setkach zdjęć. Obróconego albo odbitego obrazu nie kadruje się ramką, tylko liczbami.

### D6. Cofanie ✅
**Co jest.** Jedna historia dla całego projektu (`js/historia.js`), 80 kroków: zmiany na stronach i wzorcach, dodawanie, usuwanie i przesuwanie stron, sekcje, style, tabele, serie, ustawienia widoku. Po cofnięciu edytor otwiera stronę albo wzorzec, którego dotyczyła zmiana.
**Dlaczego tak.** Krok historii to stan całego projektu, ale strony, które się nie zmieniły, nie są kopiowane – kolejne kroki dzielą ten sam zapis. 80 kroków w projekcie na 300 stron zajmuje więc niewiele więcej niż sam projekt. Osobne historie stron i osobne „cofnij usunięcie” z poprzedniej rundy zniknęły: jedna reguła zamiast trzech.
**Słabe.** Historia kończy się z zamknięciem projektu. Zmiany w oknie danych łączą się w jeden krok na jedno otwarcie okna.

### D7. Czcionki ✅
**Co jest.** 8 rodzin na licencji OFL, teraz jako pliki w repozytorium (`css/czcionki/`, 1,5 MB, znaki łacińskie z polskimi). Aplikacja nie łączy się z serwerami Google.
**Dlaczego tak.** Wydruk nie może zależeć od tego, czy cudzy serwer działa i czy nie podmienił pliku czcionki na nowszą wersję o innych szerokościach liter – wtedy tekst w gotowym projekcie zawinąłby się inaczej. Pliki pobiera skrypt `scripts/pobierz-czcionki.cjs`; dodanie czcionki to dopisanie jej w dwóch miejscach i uruchomienie skryptu.
**Słabe.** Lista czcionek jest zamknięta – nie da się wgrać własnej.

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
**Co jest.** Okno „Dane”: import CSV i Excela (każdy arkusz to tabela), edycja komórek, dodawanie i usuwanie wierszy i kolumn, wklejanie skopiowanych komórek z arkusza, pobranie tabeli jako CSV. Zmiana nazwy kolumny poprawia pola we wszystkich tekstach projektu. Ponowny import pliku o tej samej nazwie podmienia dane tabeli. **Nowe:** kolumnę można oznaczyć znakiem ≠ jako pilnowaną – powtórzone wartości są podświetlone w tabeli i wypisane przed drukiem.
**Dlaczego tak.** Plan zakładał sam import; poprosiłeś o lekki edytor, więc jest tyle, ile trzeba, żeby poprawić literówkę albo dopisać wiersz bez wracania do arkusza. „Pule wartości” z planu (5.1) zrobiłem jako pilnowanie powtórzeń w kolumnie, bo po wprowadzeniu serii z tabelą tryb „po kolei, w kółko” już istnieje (seria ze stałą liczbą powieleń bierze wiersze w kółko), a tryb „ręcznie” to po prostu wpisanie wartości w komórkę. Brakowało tylko trzeciego: ostrzeżenia, gdy coś, co ma być niepowtarzalne, wypada dwa razy.
**Słabe.** Przy tabeli dłuższej niż 1500 wierszy okno pokazuje tylko początek. Formatowanie z arkusza nie jest przenoszone. Pilnowanie porównuje wartości dosłownie – „Praca” i „praca” to dla niego dwie różne.

### G2. Pola w tekście i pola dokumentu ✅
**Co jest.** `{nazwa}` w zwykłym tekście: kolumna tabeli albo pole dokumentu (numer strony w kilku zapisach, numer ogólny i w sekcji, liczba stron, nazwa sekcji i strony, numer i liczba egzemplarzy serii, data, numer pierwszej strony innej sekcji, numer strony o podanej nazwie). Lista „Wstaw pole”, podświetlenie pól w edytorze, ostrzeżenie o nieznanym polu.
**Dlaczego tak.** Pole jest częścią tekstu, a nie osobnym obiektem – tak ustalił plan i tak da się pisać `{dzien}. {miesiac} {rok}` w jednej linijce. Pola dokumentu działają jak pola w Wordzie: wynikają z projektu, nie z tabeli, więc np. spis treści z numerami stron innych sekcji aktualizuje się sam, także po powieleniu serii.
**Słabe.** Pole z tabeli działa tylko na stronach serii z tą tabelą; na zwykłej stronie zostaje jako tekst w klamrach (z ostrzeżeniem).

### G3. Serie: powielanie stron ✅ / ⚠️
**Co jest.** Strona wskazuje serię; sąsiednie strony z tą samą serią tworzą blok. Blok powiela się według wierszy tabeli albo stałą liczbę razy. Powielenia widać w podglądzie, na miniaturach, w udostępnionym linku, w numeracji i w PDF. **Nowe:** okno serii pokazuje, jakich pól używają strony bloku, dodaje brakujące kolumny do tabeli (albo tworzy tabelę z pól) i pobiera **szablon danych** – plik Excela z dokładnie tymi kolumnami, istniejącymi danymi i arkuszem „Instrukcja” z opisem każdej kolumny.
**Dlaczego tak.** Powielone strony nie są zapisywane: `js/serie.js` rozwija projekt przy każdym składaniu, więc 365 stron dni to jedna strona i tabela. Szablon idzie „w drugą stronę”: projekt mówi, jakich danych potrzebuje, zamiast żebyś zgadywał nazwy kolumn. Arkusz „Instrukcja” jest pomijany przy imporcie, więc wypełniony plik wraca bez przeróbek.
**Słabe.** W rozkładówkach blok o nieparzystej liczbie stron wypada na przemian po lewej i prawej; marginesy lustrzane widać wtedy tylko w podglądzie. Szablon nie ma list rozwijanych w komórkach (plan 5.2) – same nagłówki i opis. Aplikacja nie sprawdza z góry, czy teksty wszystkich wierszy mieszczą się w ramkach – widać to w podglądzie.

### G4. Obraz z kolumny tabeli ✅ / ⚠️
**Co jest.** Obraz-wzór wyznacza ramkę; kolumna podaje nazwę pliku wgranego do projektu. Podmieniony obraz wpisuje się w ramkę bez zmiany proporcji. **Nowe:** brak pliku o podanej nazwie trafia na listę „Do sprawdzenia przed drukiem” z numerami stron.
**Słabe.** Obraz nie wypełnia ramki z przycięciem („cover”), tylko się w niej mieści.

### G5. Kontrola przed drukiem ✅ / ⚠️
**Co jest.** Okno eksportu PDF pokazuje uwagi do całego projektu, już po powieleniu serii: pola bez wartości, brakujące pliki obrazów, powtórzone wartości w pilnowanych kolumnach (z numerami stron, na których wypadają), niepełny ostatni blok serii (`js/kontrola.js`).
**Dlaczego tak.** Ostrzeżenia w edytorze dotyczą otwartej strony-wzoru. Tego, że w 212. wierszu tabeli brakuje zdjęcia, na wzorze nie widać – trzeba przejść wszystkie egzemplarze. Uwagi nie blokują eksportu, bo czasem pusty obraz jest zamierzony.
**Słabe.** Lista jest tylko w oknie PDF. Nie obejmuje tekstu, który nie mieści się w ramce na którymś egzemplarzu – to wymagałoby złożenia każdej strony.

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
29 rozdziałów ze zrzutami generowanymi skryptem (`npm run zrzuty`), bez ramek „Dlaczego tak?” – uzasadnienia są w tym dokumencie.

---

## I. Eksport

### I1. Eksport do PDF ✅ / ⚠️
**Co jest.** Menu ⋯ → „Eksportuj do PDF”: zakres (cały projekt, sekcja, strony od–do), przeznaczenie (do drukarni ze spadem i znakami cięcia albo do oglądania równo do formatu), jakość (150, 300, 600 dpi), podział (jeden plik, plik na sekcję, części po N stron – kilka plików w archiwum ZIP). Strony idą w kolejności wydruku, z powieleniami serii, każda w formacie swojej sekcji. Plik ma opis formatu po obcięciu (TrimBox) i spadu (BleedBox), który czytają programy drukarni. Znaki cięcia biorą się z ustawienia sekcji.
**Dlaczego tak.** Każda strona PDF jest obrazem złożonym tą samą funkcją, która rysuje podgląd – więc w pliku jest dokładnie to, co widzisz, łącznie z listami, przelewaniem i polami. Alternatywa, czyli zapisanie tekstu jako tekstu, a kształtów jako kształtów, wymagałaby drugiego, niezależnego „rysownika” dla PDF, który trzeba by pilnować, żeby nigdy nie rozjechał się z ekranem. Przy kalendarzach i planerach 300 dpi daje tekst nieodróżnialny w druku od wektorowego; dla bardzo drobnego tekstu jest 600 dpi.
**Słabe.** Tekst w pliku nie jest tekstem (nie da się go zaznaczyć ani wyszukać), kolory są w RGB, a pliki są większe niż wektorowe – 100 stron A5 w 300 dpi to kilkadziesiąt megabajtów. Drukarnie zwykle to przyjmują, ale część wymaga CMYK albo PDF/X; wtedy trzeba plik przepuścić przez ich konwerter albo Acrobat. Bardzo długi eksport trzyma cały plik w pamięci przeglądarki – dlatego jest podział na części.

### I2. PNG strony ✅
**Co jest.** Bieżąca strona albo wzorzec jako PNG w 300 dpi, ze spadem, z oryginalnych zdjęć (wcześniej 150 dpi z tego, co było na płótnie).

---

## H. Co proponuję dalej

1. **Próba na tablecie i telefonie** – gesty, klawiatura ekranowa, instalacja, wysuwane panele. Tego nie zrobię za Ciebie.
2. **Poczta**, gdy będzie domena (decyzja #34).
3. **PDF z tekstem wektorowym i CMYK** – jeśli drukarnia, z którą pracujesz, nie przyjmie stron-obrazów (I1). Warto najpierw wysłać jej próbny plik.
4. **Tekst płynący przez kilka stron** i przelewanie w trakcie pisania (D1).
5. **Tabela jako jeden obiekt** ze zmianą szerokości kolumn (D1).
6. **Listy rozwijane w szablonie danych** i sprawdzanie przed drukiem, czy teksty mieszczą się w ramkach na każdym egzemplarzu (G3, G5).
