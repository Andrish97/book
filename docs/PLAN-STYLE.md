# Silnik stylów jak w Familiadzie – plan na później (18.11.2026)

Powód: przyciski w oknie „Sztuczna inteligencja” pokazały się bez stylów (wygląd przeglądarki). Żeby to się nie
powtarzało, Makietka dostanie warstwowy silnik stylów na wzór Familiady (`web/shared/style/`).

1. Warstwy plików: `tokens.css` (kolory, odstępy, promienie, cienie – jasny i ciemny), `base.css` (każdy przycisk,
   pole, wybór, przełącznik, dialog ma styl bazowy), `components.css` (katalog komponentów), `layout.css`,
   `utilities.css`. Pliki ekranów – tylko układ.
2. Zasady: bez `!important`, bez kolorów i stylów wpisanych w HTML/JS; nowe elementy tylko z katalogu komponentów.
3. Katalog komponentów (strona podglądu) – wszystkie przyciski, pola, zakładki, listy, okna w jednym miejscu.
4. Test-strażnik: przechodzi po oknach i panelach aplikacji i zgłasza każdy przycisk albo pole z wyglądem
   domyślnym przeglądarki (brak klasy/stylu bazowego) oraz `!important` i kolory spoza tokenów.
5. Zrzuty ekranów okien (jak `scripts/screens/` w Familiadzie) do porównania przed i po.
6. Przeniesienie obecnego `css/aplikacja.css` na warstwy krok po kroku, bez zmiany wyglądu.

Źródło wzoru: publiczne repo Familiady. Opis użycia silnika (`silnik-stylow-uzycie.md`, `wzorce-ui.md`) jest
w prywatnym repo `familijna-server` – do podpięcia, gdy użytkownik pozwoli (patrz rozmowa).
