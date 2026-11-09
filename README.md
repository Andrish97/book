# Seriodruk

Webowy edytor publikacji z powtarzalnymi stronami (kalendarze, planery, notesy): projektujesz wzory stron, a w kolejnych etapach aplikacja podstawi do nich dane z arkusza i złoży PDF do druku.

- Aplikacja: https://andrish97.github.io/book/
- Plan: [docs/PLAN.md](docs/PLAN.md) · Decyzje: [docs/DECYZJE.md](docs/DECYZJE.md) · Uzasadnienie i lista braków: [docs/UZASADNIENIE.md](docs/UZASADNIENIE.md)

## Co działa

- **Konto** (Supabase Auth): rejestracja z potwierdzeniem e-maila, logowanie, reset hasła, ustawienia konta (nazwa, e-mail, hasło, wylogowanie wszędzie, usunięcie konta). Własne szablony wiadomości w `supabase/templates/`.
- **Projekty**: lista z miniaturami, kreator (format, spad, marginesy, układ), duplikowanie, eksport i import pliku `.seriodruk`.
- **Sekcje**: części projektu z własnym formatem, spadem, czterema marginesami, układem (pojedyncze strony / rozkładówki) i numeracją.
- **Rozkładówki**: marginesy lustrzane (wewnętrzny przy grzbiecie), sąsiednia strona obok edytowanej.
- **Wzorce**: wspólne elementy stron; kilka wzorców na stronę, elementy pod albo nad treścią, odbicie lustrzane na lewych stronach, zmienne `{nr}`, `{nr_w_sekcji}`, `{liczba_stron}`, `{sekcja}`, `{strona}`.
- **Edytor** (Fabric.js 5.3.1, wszystko w mm): tekst, kształty, obrazy, grupy, warstwy, wyrównywanie i równe odstępy, blokada, schowek między stronami, cofanie, przyciąganie, ostrzeżenia o marginesach i spadzie.
- **Tekst**: style wspólne dla projektu, odstęp liter, podkreślenie, przekreślenie, formatowanie zaznaczonego fragmentu.
- **Podgląd** bez edycji: cały projekt jak po przycięciu, rozkładówki obok siebie. Można go **udostępnić linkiem** osobie bez konta (obrazy stron z chwili udostępnienia).
- **Zapis**: automatyczny, najpierw w przeglądarce (IndexedDB), potem na koncie; konflikt z innym urządzeniem kończy się pytaniem, którą wersję zachować.
- **Dotyk i telefon**: jeden palec przesuwa elementy, dwa – widok; panele wysuwane z dołu.
- **Motyw**: jasny, ciemny albo jak w systemie.
- **PWA**: manifest, ikony, service worker; instalacja na Androidzie i komputerze.
- **Instrukcja** w aplikacji ze zrzutami ekranu.

Nie ma jeszcze: importu danych i powielania stron (etap 2–3 planu), eksportu PDF (etap 4). Pełna lista braków – [docs/UZASADNIENIE.md](docs/UZASADNIENIE.md).

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
```

Testy używają atrapy Supabase (`tests/pomoc.cjs`) – nie łączą się z prawdziwą bazą. W GitHub Actions uruchamia je workflow „Testy”.

## Wdrożenie (push na `main`)

- **Aplikacja:** workflow [`pages.yml`](.github/workflows/pages.yml) publikuje ją na GitHub Pages.
- **Baza:** integracja Supabase z GitHubem stosuje migracje z [`supabase/migrations/`](supabase/migrations/) i ustawienia z [`supabase/config.toml`](supabase/config.toml). Jeśli integracja nie działa, migrację można wkleić w SQL Editor.
- **Połączenie z bazą:** adres projektu i publiczny klucz są w [`js/konfiguracja.js`](js/konfiguracja.js). Dostęp do danych chronią reguły RLS. Klucza `service_role` nigdy nie wpisuj do frontendu.
- **Do ustawienia ręcznie w Supabase** (SMTP, szablony, adresy powrotu, wymagania hasła): [docs/UZASADNIENIE.md](docs/UZASADNIENIE.md), punkt 0.

## Struktura

| Plik | Rola |
|---|---|
| `index.html`, `css/aplikacja.css` | Ekrany: logowanie, projekty, konto, edytor, podgląd; dialogi |
| `js/aplikacja.js` | Rdzeń: adresy podstron, lista projektów, edytor, sekcje, wzorce, zapis |
| `js/konto.js` | Logowanie, rejestracja, reset hasła, ustawienia konta |
| `js/chmura.js`, `js/konfiguracja.js` | Supabase: konto, projekty z licznikiem wersji, obrazy |
| `js/lokalny.js` | IndexedDB |
| `js/projekt.js` | Model projektu: sekcje, wzorce, rozkładówki, numeracja, migracje starszych wersji |
| `js/edytor.js` | Silnik strony na Fabric.js: mm ↔ px, prowadnice, przyciąganie, ostrzeżenia, gesty, historia, schowek, wyrównywanie |
| `js/zlozenie.js` | Składanie strony z warstw (tło, wzorce, treść) dla edytora, miniatur i podglądu |
| `js/wlasciwosci.js`, `js/style-tekstu.js` | Panel właściwości, style tekstu |
| `js/podglad.js` | Podgląd bez edycji – własnego projektu i udostępnionego linkiem |
| `js/plik-projektu.js` | Format `.seriodruk` (ZIP z manifestem) |
| `js/instrukcja.js`, `scripts/zrzuty-instrukcji.cjs` | Instrukcja i generator zrzutów |
| `js/ui.js`, `js/ikony.js`, `js/czcionki.js`, `js/marka.js`, `js/motyw.js` | Elementy wspólne, ikony, czcionki, nazwa aplikacji, motyw |
| `supabase/` | Migracje, konfiguracja, szablony e-maili |
| `tests/` | Testy przeglądarkowe |

## Model projektu (wersja 3)

- `sekcje[]`: `{ id, nazwa, wydruk: { format, szerokosc_mm, wysokosc_mm, spad_mm, marginesy: { gora, dol, wewnetrzny, zewnetrzny }, znaki_ciecia }, uklad: 'pojedyncze' | 'rozkladowki', pierwsza: 'prawa' | 'lewa', wzorce: [id], numeracja: { tryb: 'ciagla' | 'od' | 'brak', od } }`
- `wzorce[]`: `{ id, nazwa, wydruk, tlo, lustro, obiekty[] }` – element z `warstwa: 'nad'` leży nad treścią strony.
- `strony[]`: `{ id, nazwa, sekcja, wzorce: 'z_sekcji' | [id], tlo, obiekty[] }`
- `style[]`: style tekstu; obiekt tekstowy wskazuje styl polem `styl`.
- `zasoby`: `{ id: { nazwa, dataUrl, sciezka? } }`; obrazy na stronach mają `src: "zasob:<id>"`.
- `zrodla`, `tabele`, `zakresy`: puste do etapu danych.

Projekty zapisane w starszych wersjach modelu są przenoszone automatycznie przy otwarciu (`normalizuj` w `js/projekt.js`).
