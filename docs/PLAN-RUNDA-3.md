# Plan – runda 3 (uwagi z 18.11.2026)

Uwagi użytkownika uporządkowane w etapy: najpierw błędy, potem ustawienia i wygoda, potem duże funkcje.
Numery w nawiasach – numery z listy użytkownika. Stan: ✅ zrobione · 🔄 w toku · ⏳ czeka · ℹ️ już było (opis).
Szczegóły każdej zmiany – docs/DECYZJE.md, bieżący stan – docs/ZGLOSZENIA.md.

## Etap A – błędy (najpierw)

| # | Uwaga | Stan |
|---|---|---|
| A1 | Kopia projektu: link sam się kasuje, nawet nowo dodany – pytanie o konflikt po pierwszej zmianie w kopii i zbyt agresywna naprawa #198 | ✅ #201 |
| A2 | (3) Okno Udostępnij na telefonie – nie da się przewinąć ani w górę, ani w dół (ucięty opis i komunikat) | ✅ #202 (dotyczyło wszystkich okien) |
| A3 | (1) Makieta 3D na telefonie – czasem „Kurza twarz” (przeglądarka zamyka kartę – za dużo pamięci grafiki) | ✅ #203 |
| A4 | (2) Udostępnianie: obrazy stron rysowane w tle, bez czekania; oglądający widzi wprost „podgląd w przygotowaniu” | ✅ #204 |
| A5 | (14) Gotowe szablony projektów nie działają | ❓ nie odtworzone: wszystkie 33 szablony wstawiają się i rysują (komputer, telefon; nowy test gotowe-wszystkie) – potrzebny opis albo zrzut, co dokładnie nie działa |
| A6 | Ekran ładowania – wyrównanie tekstu (zrobione w #200; telefon miał starą wersję) | ✅ |

## Etap B – ustawienia i wygoda

| # | Uwaga | Stan |
|---|---|---|
| B1 | (8) Motyw jako przycisk na górze, 3 tryby (jasny, ciemny, systemowy) jak w Familiadzie | ✅ #205 |
| B2 | (13) Wyłączenie przyklejania elementów do innych | ℹ️ jest: Widok → „Przyciągaj do elementów”; do sprawdzenia, czy łatwo znaleźć |
| B3 | (10) Ustawienia powiadomień – wyłączenie e-maili (np. przy udostępnieniu) | ⏳ |
| B4 | (11) Panel administratora: przyciski na górze w widoku mobilnym, ładniejsza skrzynka, kolejka i ustawienia maili w jednej sekcji, czyszczenie starych kopii zapasowych | ⏳ |
| B5 | (4) Ikona i logo bardziej charakterystyczne | ⏳ |
| B6 | (18) Przełącznik języka – 3 języki jak w Familiadzie | ⏳ (duże: tłumaczenie całej aplikacji) |

## Etap C – edytor i treść

| # | Uwaga | Stan |
|---|---|---|
| C1 | (17) Pola zależne od projektu bez wpisywania (we wzorcach i na stronie) | ℹ️ jest „Wstaw pole” (lista pól projektu i danych); do sprawdzenia i dopracowania |
| C2 | (12) Kopiowanie stron, sekcji i elementów między projektami | ⏳ |
| C3 | (9) Kilka zestawów marki | ⏳ |
| C4 | (6) Zwykła książka: ciągły tekst z akapitami na wiele stron z autopodziałem (jak seria), rozdziały od nowej strony, obrazy w tekście, odstępy i wcięcia, przypisy dolne z odnośnikami, interaktywny spis treści, więcej wzorców | ℹ️ część jest (przelewanie tekstu między ramkami, style akapitu, przypisy, spis treści, skorowidz, linki w PDF); do dołożenia: automatyczne dokładanie stron, rozdział od nowej strony, opływanie obrazów |
| C5 | (19) Druk na folii albo kolorowym papierze (przezroczyste albo kolorowe tło) | ⏳ |
| C6 | (20) Okładki i elementy z materiałów (w przybliżeniu) z tłoczeniem, z eksportem ustawień | ⏳ |

## Etap D – makiety 3D

| # | Uwaga | Stan |
|---|---|---|
| D1 | (7) Przetestować wszystkie makiety 3D | ⏳ |
| D2 | (15) Makieta dostępna tylko, gdy projekt spełnia jej warunki; jeśli czegoś brakuje – powiedzieć i zaproponować (np. białe strony w miejsce brakującej sekcji) | ⏳ (częściowo #185) |
| D3 | (16) Składanki i wycinanki: typy linii (cięcie, złożenie, klejenie), miejsca klejenia, grupa do wycięcia, odwrotna strona arkusza, zawijanie elementów, ustawienia plotera, gotowe wzory, sprawdzenie, czy się złoży, makieta 3D z tego | ⏳ (częściowo #177) |
| D4 | (14) Więcej gotowych szablonów projektów, także pod makiety 3D | ⏳ |

## Etap E – zgodność i AI

| # | Uwaga | Stan |
|---|---|---|
| E1 | (5) Zgodność z innymi programami do składu: zapis i odczyt ich formatów | ⏳ (do wyboru formaty: IDML, Scribus, DOCX, EPUB, PDF) |
| E2 | AI: łącznik do zewnętrznych czatów (Claude, ChatGPT i inne z MCP) | ℹ️ jest (łącznik Makietka, klucze dostępu, wybór projektów i uprawnień); do dopracowania: logowanie przez zatwierdzenie zamiast klucza |
| E3 | AI: własne klucze API (OpenAI, Anthropic, Google, DeepSeek, Mistral, xAI, OpenRouter i zgodne), kilku dostawców, wybór modelu | ⏳ |
| E4 | AI: własny czat w Makietce (wybrany dostawca i model, te same narzędzia co łącznik) | ⏳ |
| E5 | AI: uprawnienia – które projekty i czy z edycją | ℹ️ jest w kluczach łącznika; do przeniesienia na czat i własne klucze |

Kolejność pracy: A1 → A2 → A3 → A4 → A5 → B → C → D → E. Każdy punkt: test, instrukcja, DECYZJE, ZGŁOSZENIA.
