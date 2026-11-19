# Silnik stylów jak w Familiadzie (plan 18.11.2026, praca od 19.11.2026)

Powód: przyciski w oknie „Sztuczna inteligencja” pokazały się bez stylów (wygląd przeglądarki). Żeby to się nie
powtarzało, Makietka dostanie warstwowy silnik stylów na wzór Familiady (`web/shared/style/`).

1. ✅ (#291: css/style/ – tokens, base, components, layout, ekrany/*, urzadzenia; css/aplikacja.css usunięty) Warstwy plików: `tokens.css` (kolory, odstępy, promienie, cienie – jasny i ciemny), `base.css` (każdy przycisk,
   pole, wybór, przełącznik, dialog ma styl bazowy), `components.css` (katalog komponentów), `layout.css`,
   `utilities.css`. Pliki ekranów – tylko układ.
2. ✅ (#294: kolory – wszystkie z tokenów; #295: !important tylko w widoczności i kursorze, bez stylów w HTML) Zasady: bez `!important`, bez kolorów i stylów wpisanych w HTML/JS; nowe elementy tylko z katalogu komponentów.
3. ✅ (#292: katalog-komponentow.html – przyciski, pola, przełączniki, zakładki, komunikaty, okno, próbki tokenów,
   oba motywy; test: strażnik na katalogu) Katalog komponentów (strona podglądu) – wszystkie przyciski, pola, zakładki, listy, okna w jednym miejscu.
4. ✅ (#289: tests/straznik-stylow.test.cjs – ekrany, konto, okno AI z dodawaniem kluczy, edytor z zaznaczonym
   tekstem i kształtem, wszystkie okna z index.html, komputer i telefon; zapadka na !important i kolory) Test-strażnik: przechodzi po oknach i panelach aplikacji i zgłasza każdy przycisk albo pole z wyglądem
   domyślnym przeglądarki (brak klasy/stylu bazowego) oraz `!important` i kolory spoza tokenów.
5. ✅ (#290: scripts/zrzuty-porownaj.py – zrzuty przed/po z obrazami różnic; scripts/porownaj-style.cjs – wyliczone
   style każdego elementu względem wersji z gita, bez szumu zrzutów; scripts/zrzuty-przeglad.cjs naprawiony: język
   polski, „Rysuj” w menu ⋯ na telefonie) Zrzuty ekranów okien (jak `scripts/screens/` w Familiadzie) do porównania przed i po.
6. ✅ (#291: podział po sekcjach, komponenty z plików ekranów do components.css – .przycisk.maly/.duzy/.niebezpieczny,
   zakładki przełącznika segmentowego, wybór daty, dymek, język, menu motywu; porównanie stylów: bez widocznych różnic)
   Przeniesienie obecnego `css/aplikacja.css` na warstwy krok po kroku, bez zmiany wyglądu.

Źródło wzoru: publiczne repo Familiady. Opis użycia silnika (`silnik-stylow-uzycie.md`, `wzorce-ui.md`) jest
w prywatnym repo `familijna-server` – do podpięcia, gdy użytkownik pozwoli (patrz rozmowa).

## Stan (19.11.2026) – wszystkie kroki ✅

Zasady pilnuje tests/straznik-stylow.test.cjs (elementy w wyglądzie przeglądarki, !important tylko przy display
i cursor, kolory tylko z tokenów, bez stylów w HTML i kolorów-literałów w JS). Każdą zmianę wyglądu bez zamiaru
zmiany sprawdza `node scripts/porownaj-style.cjs HEAD` – wynik ma być pusty. Nowe elementy interfejsu – z katalogu
komponentów (katalog-komponentow.html).
