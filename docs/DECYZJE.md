# Dziennik decyzji

Twoje uwagi z rozmów i to, co z nich wynikło. Najnowsze na dole. Przy każdej zmianie kierunku dopisujemy tu wpis, żeby decyzje nie ginęły razem z rozmową.

Źródło wyjściowe: [PLAN.md](PLAN.md) (Twój plan). Rozstrzygnięcia z samego planu (sekcja 11) obowiązują nadal: profil RGB/CMYK przy eksporcie, podział PDF na części, uniwersalny import CSV/XLSX, tylko czcionki z licencją komercyjną, wszystkie pola tekstowe.

| # | Data | Twoja uwaga | Decyzja / co zrobiono | Status |
|---|---|---|---|---|
| 1 | 2026-11-09 | Start według planu, Etap 1. | Szkielet: Fabric.js, strony, format wydruku, zapis lokalny, Supabase. | zrobione |
| 2 | 2026-11-09 | „Supabase jest podpięty pod repo.” | Schemat bazy jako migracja w `supabase/migrations/`. | zrobione |
| 3 | 2026-11-09 | „Push na main wszystko zrobi, jak w brick ai.” Osobny projekt Supabase. | Deploy przez integrację Supabase z GitHubem (bez sekretów), GitHub Pages przez Actions. | **migracja nie wykonała się** – tabeli `projekty` nie ma w bazie |
| 4 | 2026-11-09 | Dożywotnia zgoda na push na `main`. | Zapisane w `.claude/settings.json`. | obowiązuje |
| 5 | 2026-11-09 | Adres projektu `pganajmivwtstapnwsgv`, klucz publishable. | Wpisane w `js/konfiguracja.js`. | zrobione |
| 6 | 2026-11-09 | „Wygląda brzydko i nieprzemyślanie. Najpierw logowanie. Samouczek.” | Nowy wygląd, ekran logowania na start, lista projektów, kreator. | zrobione |
| 7 | 2026-11-09 | Samouczek nie przez podświetlanie, tylko jak manual ze zrzutami. | Instrukcja w rozdziałach ze zrzutami generowanymi skryptem. | zrobione |
| 8 | 2026-11-09 | Tylko logowanie na konta dodane w Supabase, bez rejestracji. | Usunięta rejestracja z aplikacji. | **zastąpione przez #20** |
| 9 | 2026-11-09 | Bez resetu hasła, jedno konto admina resetowane w panelu Supabase. | Usunięty reset hasła. Zostało samo logowanie. | **zastąpione przez #20** |
| 10 | 2026-11-09 | Na razie jedno konto wystarczy. | Bez zarządzania użytkownikami. | odłożone |
| 11 | 2026-11-09 | Projekt ma mieć części o różnych ustawieniach (okładka itd.). Każda sekcja dowolny format. | Sekcje z własnym formatem, spadem, marginesami. | zrobione |
| 12 | 2026-11-09 | Wzorce – „i tak, i tak”, dla różnych stron i sekcji. | Wzorce niezależne, podpinane do sekcji i do pojedynczych stron; zmienne `{nr}` itd. | zrobione |
| 13 | 2026-11-09 | Czy edytor jest pełnoprawny jak Publisher? | Nie – lista braków w [UZASADNIENIE.md](UZASADNIENIE.md). | uzupełniane od #19 |
| 14 | 2026-11-09 | Podział na podstrony, projekty z id. | Adresy `#/projekty`, `#/p/<id>/s/<id strony>`, `#/p/<id>/w/<id wzorca>`. | zrobione |
| 15 | 2026-11-09 | Eksport/import całego projektu nie w menu edytora, tylko na stronie projektów. PNG strony może zostać. | Przeniesione. | zrobione |
| 16 | 2026-11-09 | Własny format zamiast JSON. | ZIP z manifestem; rozszerzenie najpierw `.plite`, po #25 `.seriodruk`. | zrobione |
| 17 | 2026-11-09 | Manifest aplikacji. | PWA: manifest, ikony, service worker. | zrobione |
| 18 | 2026-11-09 | Chcę uzasadnienia każdej funkcji (nie instrukcji): dlaczego tak, co lepiej. Ja poprawię, potem dalej. Czy dokumentujesz moje uwagi? | Ten dziennik + [UZASADNIENIE.md](UZASADNIENIE.md). Dalsze prace wstrzymane do Twojego przeglądu. | przejrzane – patrz #19–#25 |
| 19 | 2026-11-09 | „Trzeba poprawić wszystkie braki, ale jak robić, to dobrze.” | Osiem etapów; testy w repo (`tests/`, uruchamiane w GitHub Actions). Zrobione także: wyrównywanie, blokada, schowek między stronami, duplikowanie projektu, wykrywanie konfliktu zapisu, numeracja sekcji. Co zostało – UZASADNIENIE.md, punkty ⚠️ i ❌. | zrobione w zakresie opisanym w UZASADNIENIE.md |
| 20 | 2026-11-09 | Rejestracja ma być, ładna jak w familijnej. Do tego ustawienia konta i własne e-maile. | **Zmienia decyzje #8–#10.** Rejestracja z potwierdzeniem e-maila, reset hasła, ekran ustawień konta, szablony wiadomości. Wzorowane na układzie familijnej, kod pisany od zera (jej licencja nie pozwala kopiować). | zrobione w aplikacji; **wymaga ustawień w Supabase** (SMTP, szablony, adresy powrotu – UZASADNIENIE.md, punkt 0) |
| 21 | 2026-11-09 | Podgląd bez edycji, żeby można było przeglądać projekt. | Ekran podglądu `#/p/<id>/podglad`, wejście z edytora i z listy projektów. | zrobione |
| 22 | 2026-11-09 | Rozkładówki, z marginesami lustrzanymi. | Układ sekcji „rozkładówki”, margines wewnętrzny/zewnętrzny, sąsiednia strona obok edytowanej, wzorce odbijane na lewych stronach. | zrobione |
| 23 | 2026-11-09 | Wzorce połączyć z motywami z planu. | Kilka wzorców na stronę, elementy pod i nad treścią. Pojęcie „motyw” z planu znika. | zrobione |
| 24 | 2026-11-09 | Tekst: odstępy itd., jak najwięcej, ale ładnie zrobione. | Style tekstu wspólne dla projektu, odstęp liter, podkreślenie, przekreślenie, wielkość liter, formatowanie fragmentu. Bez kolumn, tabel i przelewania tekstu. | zrobione częściowo – reszta w UZASADNIENIE.md D1 |
| 25 | 2026-11-09 | Nazwa nie może sugerować Publishera Microsoftu; ma nawiązywać do podstawiania danych i powielania stron; łatwo o domenę. | **Seriodruk.** W dniu wyboru wolne: seriodruk.com, seriodruk.app, seriodruk.pl. Plik projektu: `.seriodruk`. | zrobione (domeny do kupienia przez Ciebie) |
