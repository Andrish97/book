# Seriodruk

Webowy edytor publikacji z powtarzalnymi stronami (kalendarze, planery, notesy): projektujesz wzory stron, aplikacja podstawia do nich dane z arkusza i składa PDF do druku.

- Aplikacja: https://andrish97.github.io/book/
- Plan: [docs/PLAN.md](docs/PLAN.md) · Decyzje: [docs/DECYZJE.md](docs/DECYZJE.md) · Uzasadnienie i lista braków: [docs/UZASADNIENIE.md](docs/UZASADNIENIE.md)

## Co działa

- **Konto** (Supabase Auth): rejestracja (potwierdzanie e-mailem do włączenia w `supabase/config.toml`), logowanie, reset hasła, ustawienia konta (nazwa, e-mail, hasło, wylogowanie wszędzie, usunięcie konta). Szablony wiadomości w `supabase/templates/` czekają na własny serwer poczty.
- **Projekty**: lista z miniaturami, kreator (format, spad, marginesy, układ), duplikowanie, eksport i import pliku `.seriodruk`.
- **Sekcje**: części projektu z własnym formatem, spadem, czterema marginesami, układem (pojedyncze strony / rozkładówki) i numeracją.
- **Rozkładówki**: obie strony na jednym płótnie, marginesy lustrzane (wewnętrzny przy grzbiecie), elementy mogą leżeć przez grzbiet.
- **Wzorce**: wspólne elementy stron; kilka wzorców na stronę, elementy pod albo nad treścią, odbicie lustrzane na lewych stronach, zmienne `{nr}`, `{nr_w_sekcji}`, `{liczba_stron}`, `{sekcja}`, `{strona}`.
- **Edytor** (Fabric.js 5.3.1 trzymany w repozytorium, wszystko w mm): tekst, kształty, obrazy, grupy, panel warstw, wyrównywanie i równe odstępy, blokada, schowek między stronami, ostrzeżenia o marginesach i spadzie. **Cofanie** to jedna historia całego projektu (strony, wzorce, sekcje, style, dane).
- **Kształty i obrazy**: wielokąty i gwiazdy, gradient, cień, kadrowanie obrazu przeciąganiem. Obrazy (PNG, JPEG, WebP, GIF, SVG) z dysku, przez przeciągnięcie albo wklejone ze schowka (Ctrl+V – także zrzut ekranu i kod SVG). Duże zdjęcia pracują w edytorze na lżejszej kopii; do eksportu idzie oryginał.
- **Precyzja**: siatka z przyciąganiem, linijki i własne prowadnice, linie wyrównania do innych elementów, strzałki z odległościami i równe odstępy, ponad 50 skrótów klawiszowych.
- **Dane**: tabele z importem CSV/Excel i lekkim edytorem, pola `{kolumna}` i pola dokumentu w tekście, serie powielające strony według wierszy, obrazy z kolumny, ramka tekstu z autodopasowaniem. Szablon danych serii (Excel z arkuszem „Instrukcja”), dodawanie brakujących kolumn, pilnowanie powtórzeń w kolumnie.
- **Tekst**: style wspólne dla projektu, odstęp liter, podkreślenie, przekreślenie, formatowanie zaznaczonego fragmentu, listy (punkty, kreski, numery), przelewanie tekstu między połączonymi ramkami, kolumny, tabela.
- **Eksport**: PDF do drukarni (spad, znaki cięcia, TrimBox/BleedBox, 150/300/600 dpi, zakres stron, podział na sekcje albo części) z listą rzeczy do sprawdzenia przed drukiem; PNG strony w 300 dpi.
- **Podgląd** bez edycji: cały projekt jak po przycięciu (z powieleniami serii), rozkładówki obok siebie, tryb prezentacji na całym ekranie. Można go **udostępnić linkiem** osobie bez konta (obrazy stron z chwili udostępnienia).
- **Zapis**: automatyczny, najpierw w przeglądarce (IndexedDB), potem na koncie – wysyłane są tylko zmienione strony; konflikt z innym urządzeniem kończy się pytaniem, którą wersję zachować.
- **Dotyk i telefon**: jeden palec przesuwa elementy, dwa – widok; panele wysuwane z dołu.
- **Motyw**: jasny, ciemny albo jak w systemie.
- **PWA**: manifest, ikony, service worker; instalacja na Androidzie i komputerze. Czcionki i silnik płótna są w repozytorium, więc edytor działa bez internetu.
- **Instrukcja** w aplikacji ze zrzutami ekranu.

Nie ma jeszcze: własnej poczty (czeka na domenę), PDF z tekstem wektorowym i CMYK, tekstu płynącego przez kilka stron. Pełna lista słabych stron – [docs/UZASADNIENIE.md](docs/UZASADNIENIE.md).

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
| `js/lokalny.js` | IndexedDB |
| `js/projekt.js` | Model projektu: sekcje, wzorce, rozkładówki, numeracja, migracje starszych wersji |
| `js/edytor.js` | Silnik arkusza (strona albo rozkładówka) na Fabric.js: mm ↔ px, prowadnice, przyciąganie, ostrzeżenia, gesty, historia, schowek, wyrównywanie |
| `js/zlozenie.js` | Składanie strony z warstw (tło, wzorce, treść, elementy sąsiedniej strony przez grzbiet) dla edytora, miniatur i podglądu |
| `js/wlasciwosci.js`, `js/style-tekstu.js`, `js/tekst-ramka.js`, `js/watki.js` | Panel właściwości, style tekstu, ramka tekstu o stałej wysokości i listy, przelewanie tekstu między ramkami |
| `js/obrazy.js`, `js/wklejanie.js` | Kopie robocze dużych zdjęć; obrazy i SVG ze schowka systemu |
| `js/eksport.js`, `js/okno-pdf.js`, `js/kontrola.js` | Eksport PDF i PNG, okno eksportu, kontrola projektu przed drukiem i szablon danych |
| `js/biblioteki.js`, `js/zewnetrzne/` | Wczytywanie dużych bibliotek na żądanie; Fabric.js w repozytorium |
| `js/przyciaganie.js`, `js/linijki.js`, `js/widok.js`, `js/warstwy.js`, `js/skroty.js` | Przyciąganie i pomiary, linijki, menu siatki, panel warstw, skróty |
| `js/pola.js`, `js/serie.js`, `js/tabele.js`, `js/dane.js` | Pola w tekście, rozwijanie serii, odczyt CSV/Excel, okno danych |
| `js/podglad.js` | Podgląd bez edycji – własnego projektu i udostępnionego linkiem |
| `js/plik-projektu.js` | Format `.seriodruk` (ZIP z manifestem) |
| `js/instrukcja.js`, `scripts/zrzuty-instrukcji.cjs` | Instrukcja i generator zrzutów |
| `js/ui.js`, `js/ikony.js`, `js/czcionki.js`, `js/marka.js`, `js/motyw.js` | Elementy wspólne, ikony, czcionki, nazwa aplikacji, motyw |
| `css/czcionki.css`, `css/czcionki/`, `scripts/pobierz-czcionki.cjs` | Czcionki w repozytorium (OFL) i skrypt, który je pobiera |
| `supabase/` | Migracje, konfiguracja, szablony e-maili |
| `tests/`, `eslint.config.mjs` | Testy przeglądarkowe (`npm test`) i sprawdzenie kodu (`npm run lint`) |

## Model projektu (wersja 3)

- `tabele[]`: `{ id, nazwa, kolumny: [nazwa], wiersze: [[tekst]], unikalne?: [nazwa kolumny] }` – `unikalne` to kolumny z pilnowaniem powtórzeń.
- `serie[]`: `{ id, nazwa, tabela, tryb: 'tabela' | 'stala', ile, uklad: 'szeroki' | 'dlugi' }`; strona wskazuje serię polem `seria`. Powielone strony nie są zapisywane – powstają w `js/serie.js` przy składaniu.
- `widok`: `{ siatka_mm, siatka, do_siatki, do_elementow, linijki }`; strony i wzorce mogą mieć `prowadnice: { x: [mm], y: [mm] }`.

- `sekcje[]`: `{ id, nazwa, wydruk: { format, szerokosc_mm, wysokosc_mm, spad_mm, marginesy: { gora, dol, wewnetrzny, zewnetrzny }, znaki_ciecia }, uklad: 'pojedyncze' | 'rozkladowki', pierwsza: 'prawa' | 'lewa', wzorce: [id], numeracja: { tryb: 'ciagla' | 'od' | 'brak', od } }`
- `wzorce[]`: `{ id, nazwa, wydruk, tlo, lustro, obiekty[] }` – element z `warstwa: 'nad'` leży nad treścią strony.
- `strony[]`: `{ id, nazwa, sekcja, wzorce: 'z_sekcji' | [id], tlo, obiekty[] }` – w rozkładówce element należy do strony, na której leży jego środek, i może wystawać przez grzbiet na sąsiednią; pole `z` elementu to kolejność warstw na wspólnym płótnie.
- `style[]`: style tekstu; obiekt tekstowy wskazuje styl polem `styl`.
- `zasoby`: `{ id: { nazwa, dataUrl, sciezka? } }`; obrazy na stronach mają `src: "zasob:<id>"`.
- Tekst: `lista` (`'punkty' | 'kreski' | 'numery'`), `ramka_h` (stała wysokość ramki, mm); połączone ramki mają wspólny `watek`, kolejność `watek_nr` i `lacznik` (co stało między częścią poprzedniej ramki a tą).

Projekty zapisane w starszych wersjach modelu są przenoszone automatycznie przy otwarciu (`normalizuj` w `js/projekt.js`).
