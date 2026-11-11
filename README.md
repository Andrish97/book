# Seriodruk

Webowy edytor publikacji z powtarzalnymi stronami (kalendarze, planery, notesy): projektujesz wzory stron, aplikacja podstawia do nich dane z arkusza i składa PDF do druku.

- Aplikacja: https://andrish97.github.io/book/
- Plan: [docs/PLAN.md](docs/PLAN.md) · Decyzje: [docs/DECYZJE.md](docs/DECYZJE.md) · Uzasadnienie i lista braków: [docs/UZASADNIENIE.md](docs/UZASADNIENIE.md)

## Co działa

- **Konto** (Supabase Auth): rejestracja (potwierdzanie e-mailem do włączenia w `supabase/config.toml`), logowanie, reset hasła, ustawienia konta (nazwa, e-mail, hasło, wylogowanie wszędzie, usunięcie konta). Szablony wiadomości w `supabase/templates/` czekają na własny serwer poczty.
- **Projekty**: lista z miniaturami, kreator (format, spad, marginesy, układ), duplikowanie, eksport i import pliku `.seriodruk`.
- **Sekcje**: części projektu z własnym formatem, spadem, czterema marginesami, układem (pojedyncze strony / rozkładówki) i numeracją.
- **Rozkładówki**: obie strony na jednym płótnie, marginesy lustrzane (wewnętrzny przy grzbiecie), elementy mogą leżeć przez grzbiet.
- **Wzorce**: szablony wspólnych elementów stron w osobnym oknie, z gotowymi wzorcami standardowymi (numer strony, stopka, nagłówek, linie, kratka, ramka, zakładka); kilka wzorców na stronę, elementy pod albo nad treścią, odbicie lustrzane na lewych stronach, zmienne `{nr}`, `{nr_w_sekcji}`, `{liczba_stron}`, `{sekcja}`, `{strona}`.
- **Edytor** (Fabric.js 7.4.0 trzymany w repozytorium, wszystko w mm): tekst, kształty, obrazy, grupy (podwójne kliknięcie otwiera grupę – jej element zmienia się bez rozgrupowywania), panel warstw, wyrównywanie i równe odstępy, blokada, schowek między stronami, ostrzeżenia o marginesach i spadzie. **Cofanie** to jedna historia całego projektu (strony, wzorce, sekcje, style, dane).
- **Kształty i obrazy**: wielokąty i gwiazdy, rysowanie odręczne, gradient liniowy i kołowy z wieloma kolorami, cień, kadrowanie obrazu przeciąganiem (także obróconego). Obrazy (PNG, JPEG, WebP, GIF, SVG) z dysku, przez przeciągnięcie albo wklejone ze schowka (Ctrl+V – także zrzut ekranu i kod SVG). Duże zdjęcia pracują w edytorze na lżejszej kopii; do eksportu idzie oryginał.
- **Precyzja**: siatka z przyciąganiem, linijki i własne prowadnice, linie wyrównania do innych elementów, strzałki z odległościami i równe odstępy, ponad 50 skrótów klawiszowych.
- **Dane**: tabele z importem CSV/Excel (z Excela także pogrubienia, kursywa i kolory liter komórek) i lekkim edytorem, pola `{kolumna}` i pola dokumentu w tekście, serie powielające strony według wierszy, obrazy z kolumny, ramka tekstu z autodopasowaniem. Szablon danych serii (Excel z arkuszem „Instrukcja” i listami rozwijanymi w komórkach), dodawanie brakujących kolumn, pilnowanie powtórzeń i lista dozwolonych wartości kolumny. Seria może mieć tabele dodatkowe (nowy wiersz co N stron, pola `{Tabela.kolumna}`) i kończy się na ostatnim wierszu danych. Kolor i położenie elementu mogą zależeć od pola z danych.
- **Tekst**: style wspólne dla projektu, odstęp liter, podkreślenie, przekreślenie, formatowanie zaznaczonego fragmentu, listy (punkty, kreski, numery), przelewanie tekstu między połączonymi ramkami, kolumny, tabela.
- **Eksport**: PDF do drukarni – **wektorowy** (prawdziwy tekst z osadzonymi czcionkami, kształty i gradienty jako wektory, zdjęcia w oryginale; opcje: tekst na krzywe, kolory tekstu i kształtów w CMYK) albo jako obrazy stron (150/300/600 dpi; z PDF/X-4 także w CMYK przez profil, z czernią i szarościami poza zdjęciami samą czarną farbą). Spad, znaki cięcia, TrimBox/BleedBox, zakres stron, podział na sekcje albo części. „Sprawdź przed drukiem”: lista uwag do całego projektu, łącznie z tekstami, które nie mieszczą się w ramkach na powielonych stronach. PNG strony w 300 dpi.
- **Podgląd** bez edycji: cały projekt jak po przycięciu (z powieleniami serii), rozkładówki obok siebie, tryb prezentacji na całym ekranie. Można go **udostępnić linkiem** osobie bez konta (obrazy stron z chwili udostępnienia).
- **Zapis**: automatyczny, najpierw w przeglądarce (IndexedDB), potem na koncie – wysyłane są tylko zmienione strony. Zmiany z dwóch urządzeń łączą się część po części (strony, wzorce, tabele, sekcje, serie, style); pytanie dotyczy tylko części zmienionych w obu miejscach, z wyborem wersji przy każdej.
- **Dotyk i telefon**: jeden palec przesuwa elementy, dwa – widok. Na telefonie edytor działa w poziomie (panele wysuwane z boków); w pionie pokazuje prośbę o obrót.
- **Motyw**: jasny, ciemny albo jak w systemie.
- **Czcionki**: własne pliki TTF/OTF/WOFF/WOFF2 wgrywane do projektu (jadą z nim na konto i do pliku) oraz oficjalny zestaw 52 rodzin (lista: `js/zestaw-czcionek.js`; licencje OFL i Apache 2.0, polskie znaki), pobieranych przez przeglądarkę dopiero przy użyciu. Wgrana czcionka trafia też do „Moich czcionek” i jest pod ręką w każdym projekcie (na koncie – na każdym urządzeniu). Do eksportu można dołączyć pliki użytych czcionek.
- **PWA**: manifest, ikony, service worker; instalacja na Androidzie i komputerze. Czcionki i silnik płótna są w repozytorium, więc edytor działa bez internetu.
- **Instrukcja** w aplikacji ze zrzutami ekranu.

Nie ma jeszcze: własnej poczty (czeka na domenę). Pełna lista słabych stron – [docs/UZASADNIENIE.md](docs/UZASADNIENIE.md).

## Uruchomienie lokalne

Aplikacja jest statyczna, bez kroku budowania. Moduły ES wymagają serwera HTTP:

```sh
python3 -m http.server 8000     # http://localhost:8000
```

Z pustym `js/konfiguracja.js` aplikacja działa bez konta, tylko w tej przeglądarce.

## Testy i zrzuty do instrukcji

```sh
npm install && npx playwright install chromium
npm test                                   # testy przeglądarkowe (tests/)
python3 -m http.server 8000 &
npm run zrzuty -- http://localhost:8000/   # odświeża img/instrukcja/*.png
npm run proba                              # próba na prawdziwej bazie (konto testowe, na końcu usuwane)
```

Testy używają atrapy Supabase (`tests/pomoc.cjs`) – nie łączą się z prawdziwą bazą. W GitHub Actions uruchamia je workflow „Testy”.

## Wdrożenie (push na `main`)

- **Aplikacja:** workflow [`pages.yml`](.github/workflows/pages.yml) publikuje ją na GitHub Pages.
- **Baza i logowanie:** integracja Supabase z GitHubem stosuje migracje z [`supabase/migrations/`](supabase/migrations/) i ustawienia logowania z [`supabase/config.toml`](supabase/config.toml).
- **Połączenie z bazą:** adres projektu i publiczny klucz są w [`js/konfiguracja.js`](js/konfiguracja.js). Dostęp do danych chronią reguły RLS. Klucza `service_role` nigdy nie wpisuj do frontendu.
- **Wynik wdrożenia bazy** widać przy commicie na `main` (znaczek „Supabase Preview”). Szczegóły i ograniczenia poczty: [docs/UZASADNIENIE.md](docs/UZASADNIENIE.md), punkt 0.

## Struktura

| Plik | Rola |
|---|---|
| `index.html`, `css/aplikacja.css` | Ekrany: logowanie, projekty, konto, edytor, podgląd; dialogi |
| `js/aplikacja.js` | Plik startowy: przyciski, zdarzenia edytora, skróty, start |
| `js/app/` | Części aplikacji: `kontekst` (wspólny stan), `skladniki` (panel, linijki, okno danych…), `zapis` (płótno ↔ projekt, zapis, cofanie), `trasy`, `logowanie`, `projekty`, `lista-stron`, `sekcje`, `wzorce`, `panel-strony`, `podglad-ekran` |
| `js/historia.js` | Jedna historia cofania całego projektu |
| `js/konto.js` | Logowanie, rejestracja, reset hasła, ustawienia konta |
| `js/chmura.js`, `js/konfiguracja.js` | Supabase: konto, projekty z licznikiem wersji (strony w osobnych wierszach, zapis funkcją `zapisz_projekt`), obrazy |
| `js/laczenie.js` | Łączenie zmian z dwóch urządzeń: odciski części projektu, porównanie trzech stanów (ostatnio uzgodniony, ten z urządzenia, ten z konta), lista części zmienionych po obu stronach |
| `js/lokalny.js` | Zapis projektów w przeglądarce (IndexedDB) – bez treści obrazów |
| `js/zasoby.js` | Oryginały obrazów poza pamięcią karty: osobny magazyn plików w IndexedDB (klucz „projekt/zasób”), adresy `blob:` do rysowania, treść na żądanie (eksport, konto, plik projektu), zapamiętane kopie robocze |
| `js/projekt.js` | Model projektu: sekcje, wzorce, rozkładówki, numeracja, migracje starszych wersji |
| `js/edytor.js` | Silnik arkusza (strona albo rozkładówka) na Fabric.js: mm ↔ px, prowadnice, przyciąganie, ostrzeżenia, gesty, historia, schowek, wyrównywanie |
| `js/fabric-ustawienia.js` | Ustawienia Fabric.js 7 wspólne dla edytora i składania: położenie liczone od lewego górnego rogu, wygląd uchwytów, lista własnych pól zapisywanych z obiektem, typ obiektu w zapisie małymi literami |
| `js/zlozenie.js` | Składanie strony z warstw (tło, wzorce, treść, elementy sąsiedniej strony przez grzbiet) dla edytora, miniatur i podglądu |
| `js/wlasciwosci.js`, `js/style-tekstu.js`, `js/tekst-ramka.js`, `js/watki.js` | Panel właściwości, style tekstu, ramka tekstu o stałej wysokości i listy, przelewanie tekstu między ramkami (także przez strony i w trakcie pisania) |
| `js/obrazy.js`, `js/wklejanie.js` | Kopie robocze dużych zdjęć; obrazy i SVG ze schowka systemu |
| `js/eksport.js`, `js/pdf-wektorowy.js`, `js/okno-pdf.js` | Eksport PDF i PNG; PDF wektorowy (kontekst rysowania zapisujący polecenia PDF, osadzanie czcionek – tylko użytych znaków – i obrazów); okno eksportu |
| `js/pdf-x.js`, `js/profil-icc.js`, `js/strona-cmyk.js`, `css/profile/` | PDF/X-4: metadane i profil warunków druku; przeliczanie kolorów i zdjęć na CMYK przez profil ICC; obraz całej strony w CMYK (tryb „Obrazy stron”); profile barwne z opisem licencji |
| `js/kontrola.js`, `js/kontrola-skladu.js`, `js/okno-kontroli.js` | Kontrola projektu przed drukiem (dane, powtórzenia, teksty w ramkach) i szablon danych |
| `js/biblioteki.js`, `js/zewnetrzne/` | Wczytywanie dużych bibliotek na żądanie; Fabric.js w repozytorium |
| `js/przyciaganie.js`, `js/linijki.js`, `js/widok.js`, `js/warstwy.js`, `js/skroty.js` | Przyciąganie i pomiary, linijki, menu siatki, panel warstw, skróty |
| `js/pola.js`, `js/serie.js`, `js/tabele.js`, `js/arkusz-wyglad.js`, `js/dane.js` | Pola w tekście, rozwijanie serii, odczyt CSV/Excel (z wyglądem komórek), okno danych |
| `js/podglad.js` | Podgląd bez edycji – własnego projektu i udostępnionego linkiem |
| `js/plik-projektu.js` | Format `.seriodruk` (ZIP z manifestem) |
| `js/instrukcja.js`, `scripts/zrzuty-instrukcji.cjs` | Instrukcja i generator zrzutów |
| `js/ui.js`, `js/ikony.js`, `js/marka.js`, `js/motyw.js` | Elementy wspólne, ikony, nazwa aplikacji, motyw |
| `js/czcionki.js`, `js/moje-czcionki.js`, `js/okno-czcionek.js` | Czcionki wbudowane i własne (odczyt plików czcionek, rejestracja w przeglądarce), zbiór „Moje czcionki” (przeglądarka + konto), okno „Czcionki” |
| `css/czcionki.css`, `css/czcionki/`, `scripts/pobierz-czcionki.cjs` | Czcionki w repozytorium (OFL) i skrypt, który je pobiera |
| `css/czcionki/pdf/`, `scripts/pobierz-czcionki-pdf.cjs` | Zwykłe pliki TTF wbudowanych czcionek – do osadzania w PDF (wczytywane dopiero przy eksporcie) |
| `supabase/` | Migracje, konfiguracja, szablony e-maili |
| `tests/`, `eslint.config.mjs` | Testy przeglądarkowe (`npm test`) i sprawdzenie kodu (`npm run lint`) |

## Model projektu (wersja 3)

- `tabele[]`: `{ id, nazwa, kolumny: [nazwa], wiersze: [[tekst]], unikalne?: [nazwa kolumny], listy?: { kolumna: [wartość] }, wyglad?: [null | [null | { pogrubienie?, kursywa?, kolor? }]], wyglad_wyl? }` – `unikalne` to kolumny z pilnowaniem powtórzeń, `listy` to dozwolone wartości kolumn (podświetlanie w oknie danych, uwaga przed drukiem, lista rozwijana w szablonie danych). `wyglad` to wygląd komórek przeniesiony z pliku Excela, wiersz po wierszu tak jak `wiersze`; wartość pola na stronie dostaje go jako formatowanie fragmentu tekstu, chyba że `wyglad_wyl`.
- `serie[]`: `{ id, nazwa, tabela, tryb: 'tabela' | 'stala', ile, uklad: 'szeroki' | 'dlugi', dodatkowe: [{ tabela, co, pierwszy?, zmiana? }], dopelnij }`; strona wskazuje serię polem `seria`. Tabela dodatkowa zmienia wiersz co `co` stron (pierwszy wiersz przez `pierwszy` stron) albo – gdy ma `zmiana` (nazwa kolumny tabeli głównej albo lista kilku nazw, np. `['miesiac', 'rok']`) – wtedy, gdy zmieni się wartość w tej kolumnie (przy liście: w którejkolwiek z nich). Powielone strony nie są zapisywane – powstają w `js/serie.js` przy składaniu.
- `widok`: `{ siatka_mm, siatka, do_siatki, do_elementow, linijki }`; strony i wzorce mogą mieć `prowadnice: { x: [mm], y: [mm] }`.

- `sekcje[]`: `{ id, nazwa, wydruk: { format, szerokosc_mm, wysokosc_mm, spad_mm, marginesy: { gora, dol, wewnetrzny, zewnetrzny }, znaki_ciecia }, uklad: 'pojedyncze' | 'rozkladowki', pierwsza: 'prawa' | 'lewa', wzorce: [id], numeracja: { tryb: 'ciagla' | 'od' | 'brak', od } }`
- `wzorce[]`: `{ id, nazwa, wydruk, tlo, lustro, obiekty[] }` – element z `warstwa: 'nad'` leży nad treścią strony.
- `strony[]`: `{ id, nazwa, sekcja, wzorce: 'z_sekcji' | [id], tlo, obiekty[] }` – w rozkładówce element należy do strony, na której leży jego środek, i może wystawać przez grzbiet na sąsiednią; pole `z` elementu to kolejność warstw na wspólnym płótnie.
- `style[]`: style tekstu; obiekt tekstowy wskazuje styl polem `styl`.
- `zasoby`: `{ id: { nazwa, typ, rozmiar, sciezka? } }` – opis pliku; obrazy na stronach mają `src: "zasob:<id>"`. Treść obrazu leży w magazynie plików przeglądarki (`js/zasoby.js`) i na koncie (`sciezka`). Pole `dataUrl` mają tylko: obraz świeżo dodany (do najbliższego zapisu), czcionki własne oraz starsze zapisy – te przechodzą do magazynu przy pierwszym otwarciu.
- `czcionki[]`: `{ id, rodzina, waga, kursywa }` – własne czcionki; `id` wskazuje plik czcionki w `zasoby`.
- `wersja_chmury`, `podstawa_chmury`: tylko w kopii na urządzeniu. Pierwsze to numer wersji projektu na koncie, którą to urządzenie widziało ostatnio (baza przyjmuje zapis tylko z aktualnym numerem). Drugie to odciski części projektu z tej chwili: `{ listy: { strony: { kolejnosc: [id], elementy: { id: odcisk } }, … }, reszta: { pole: odcisk } }`. Gdy baza odmówi zapisu, `js/laczenie.js` porównuje z nimi stan z urządzenia i stan z konta: część zmieniona po jednej stronie przechodzi sama, o zmienioną po obu aplikacja pyta. Na konto i do pliku `.seriodruk` `podstawa_chmury` nie trafia.
- Element: `z_danych: { kolor?: pole, kolor_w?: 'pierwszy' | 'ostatni' | 'odcienie', x?: { pole, tryb: 'pozycja' | 'mm', krok, co }, y?: …, obrot?: pole, widok?: { pole, gdy: 'niepuste' | 'puste' | 'rowne', wartosc? }, szer?: { pole, tryb: 'procent' | 'mm' }, wys?: …, kotwica?: 'srodek' | 'dol' }` – kolor, przesunięcie, obrót (stopnie, wokół środka), widoczność i rozmiar zależne od pola. `kolor_w` dotyczy wypełnienia przejściem kolorów: kolor z pola zastępuje pierwszy albo ostatni kolor przejścia albo całe przejście przechodzi w jego odcienie; bez `kolor_w` (także w starszych projektach) kolor zastępuje całe wypełnienie. Rozmiar: `szer` i `wys` osobno, wartość pola to procent rozmiaru wzoru (100 = bez zmian) albo milimetry; `kotwica` mówi, który punkt zostaje na miejscu (brak = lewy górny róg, `srodek`, `dol` = środek dolnej krawędzi). Tekst zmienia szerokość ramki (i wysokość ramki o stałej wysokości), obraz – ramkę (obraz z kolumny wpisuje się w nią według `pole.tryb`, zwykły ją wypełnia), tabela – kolumny i wiersze, reszta i grupy – skalę; wymiar 0 chowa element. Obraz z kolumny: `pole: { kolumna, tryb?: 'wypelnij', kadr?: 'gora' | 'dol' | 'lewa' | 'prawa' }`. W tekście `{{` i `}}` to zwykłe klamry (w wydruku pojedyncze).
- Obraz z danych: `pole: { kolumna, tryb?: 'wypelnij', kadr?: 'gora' | 'dol' | 'lewa' | 'prawa', kadr_z?: kolumna }` – `kolumna` podaje nazwę pliku; przy `wypelnij` obraz wypełnia ramkę wzoru z przycięciem. `kadr` mówi, która część zdjęcia zostaje (brak = środek), a `kadr_z` wskazuje kolumnę z kadrem osobnym dla każdego wiersza: słowo (góra, dół, lewa, prawa, środek) albo punkt zdjęcia „x% y%”; pusta albo niezrozumiała wartość zostawia `kadr`.
- Tekst: `lista` (`'punkty' | 'kreski' | 'numery'`), `ramka_h` (stała wysokość ramki, mm); połączone ramki mają wspólny `watek`, kolejność `watek_nr` i `lacznik` (co stało między częścią poprzedniej ramki a tą).
- Tabela (element strony, `js/tabela-obiekt.js`): grupa z polem `tabela: { kolumny: [mm], wiersze: [mm], naglowek, linia: { kolor, grubosc }, tlo?: { naglowek, zebra }, scalenia?: [{ w, k, ileW, ileK }], linie_komorek?: [{ os: 'h' | 'v', w, k, grubosc, kolor? }] }`. `linie_komorek` to własne linie pojedynczych odcinków siatki: `h` – odcinek poziomy nad wierszem `w` w kolumnie `k` (`w` równe liczbie wierszy to dolny brzeg), `v` – pionowy z lewej strony kolumny `k` w wierszu `w` (`k` równe liczbie kolumn to prawy brzeg); `grubosc: 0` znaczy „bez linii”, brak wpisu – linia jak w całej tabeli. Krawędź wspólna dwóch komórek jest zapisana raz.

Projekty zapisane w starszych wersjach modelu są przenoszone automatycznie przy otwarciu (`normalizuj` w `js/projekt.js`).
