# AI w Makietce – audyt wobec koncepcji „Makietka AI 1.0” i plan (18.11.2026)

Użytkownik przekazał dokument koncepcyjny (napisany przez inny model, bez znajomości Makietki). Poniżej: co z niego
już jest, czego brakuje i w jakiej kolejności to robię. Założenie główne dokumentu – „Makietka jest właścicielem
danych i operacji, AI to wymienny interfejs” – jest już spełnione: jest jeden rdzeń narzędzi.

## Jak jest dziś

| Punkt dokumentu | Stan w Makietce |
|---|---|
| 3.1 Wspólny silnik operacji | ✅ Jeden rdzeń narzędzi (`supabase/functions/_shared/seriodruk-mcp-rdzen.mjs`, 38 narzędzi) używany przez: zdalny łącznik MCP, serwer stdio, czat w Makietce (ten sam plik w przeglądarce), strony dla AI (GET) i tryb „kopiuj i wklej”. Każdy zapis przechodzi kontrolę spójności, wersja projektu chroni przed nadpisaniem. |
| Projekty, strony, elementy, obrazy, tabele, kontrola | ✅ Lista, tworzenie, usuwanie (pełny dostęp, dokładna nazwa), przegląd, czytanie, strony (dodaj, zmień, usuń, kolejność), elementy (dodaj, zmień, usuń, kolejność), obrazy (adres, SVG, base64, kawałkami, link do wgrania, wymiana, porządki, kadr przy wstawianiu), tabele, części składanek, kontrola przed drukiem, komentarze, eksport PDF/PNG. |
| Kopiowanie stron, wyrównywanie i rozmieszczanie elementów, kadrowanie istniejącego obrazu, wzorce, style, serie | ⚠️ Da się, ale ogólnym `zmien_projekt` / `zmien_elementy` (AI liczy samo) – brak wygodnych narzędzi. |
| Kontrola: propozycje i wykonanie poprawek | ⚠️ `kontrola` zwraca uwagi; poprawki AI robi sama zwykłymi narzędziami – brak „napraw” po stronie Makietki. |
| 3.2 OAuth 2.1 | ✅ #244 (łącznik z logowaniem, strona zgody; GPT usunięty – #245). Wcześniej: ❌ Klucz w adresie łącznika (świadoma decyzja #32: „bez tokenów, prościej”). Claude i ChatGPT obsługują łączniki z logowaniem – to wygodniejsze i bezpieczniejsze niż kopiowanie adresu z kluczem. |
| Zakresy uprawnień | ⚠️ Tylko „czyta” / „czyta i zmienia” + wybrane projekty / wszystkie. Brak drobniejszych (obrazy, wzorce, tabele, usuwanie). |
| 5 BYOK – dostawcy | ✅ Anthropic, OpenAI, Gemini, DeepSeek, Mistral, xAI, OpenRouter (logowanie), dowolne API zgodne z OpenAI (LiteLLM, Ollama – gdy pozwala na zapytania z przeglądarki), plus bez klucza: „kopiuj i wklej”. |
| 5.2 Panel „Ustawienia → Sztuczna inteligencja” | ⚠️ Ustawienia są w samym czacie (jeden dostawca naraz). Brak listy kilku dostawców, modelu domyślnego, „Sprawdź połączenie”. |
| 9 Klucze dostawców po stronie serwera, zaszyfrowane | ✅ #241: na koncie, zaszyfrowane w przeglądarce hasłem do kluczy (twórca nie odczyta) – decyzja użytkownika. |
| 6 Adaptery: streaming, obrazy w rozmowie, ponawianie, czytelne błędy | ⚠️ Są 3 adaptery (Anthropic, Gemini, zgodne z OpenAI) z narzędziami; brak streamingu, obrazów w rozmowie, ponawiania; błędy częściowo surowe. |
| 8 Czat: zatwierdzanie ważnych zmian, ponawianie | ❌ Narzędzia wykonują się od razu; brak pytania przed usuwaniem. |
| 9 Historia operacji i cofanie | ⚠️ Zmiany AI to zwykłe zmiany z konta; edytorowe Cofnij ich nie zdejmuje. Użytkownik nie chce historii wersji w interfejsie – zostaje kopia (Eksport) przed dużymi zmianami. |
| 8 Wariant B (AI płatne przez Makietkę) | — Nie robię (dokument: opcjonalne). |

## Plan (po kolei, każdy krok z testem, instrukcją, DECYZJE, ZGŁOSZENIA)

1. ✅ (#244) **Łącznik z logowaniem (OAuth 2.1)** – „Połącz z Makietką” w Claude / ChatGPT bez kopiowania klucza: opis serwera
   autoryzacji, rejestracja klienta (DCR), PKCE, strona zgody w Makietce (logowanie, wybór projektów, zakres,
   ważność), tokeny dostępu i odświeżania na bazie kluczy AI (te same uprawnienia i odbieranie w Dostępie dla AI).
   Adres z kluczem zostaje jako druga droga.
2. **Zakresy uprawnień** – obok czyta / zmienia: obrazy, wzorce i style, tabele i serie, struktura (dodawanie
   i usuwanie stron), usuwanie projektów – sprawdzane w rdzeniu po stronie serwera i pokazywane na stronie zgody.
3. **Zatwierdzanie w czacie Makietki** – przed usunięciem stron, wielu elementów, obrazów w użyciu, projektu
   i przed zmianą wielu stron naraz: pytanie z opisem; „Zawsze pozwalaj w tej rozmowie”.
4. ⏳ (#241–#251: sekcja w ustawieniach, trzy drogi, sejf kluczy, edycja i ważność kluczy; zostaje „Sprawdź połączenie” i model domyślny) **Ustawienia → Sztuczna inteligencja** – kilku dostawców naraz, model domyślny, „Sprawdź połączenie”, zmiana
   modelu w trakcie rozmowy; klucze **opcjonalnie na koncie** (szyfrowane w przekaźniku, rozmowa przez przekaźnik –
   klucz nie wraca do przeglądarki) albo jak dziś tylko na urządzeniu.
5. **Adaptery** – streaming odpowiedzi, czytelne komunikaty (zły klucz, brak środków, limit, model niedostępny,
   brak narzędzi w modelu), ponowienie przy przeciążeniu, zdjęcia w rozmowie (do projektu albo do obejrzenia).
6. **Brakujące narzędzia** – kopiowanie stron, wyrównanie i rozmieszczenie, kadrowanie obrazu, przypisanie wzorców,
   style, serie, „napraw” z kontroli przed drukiem.
7. **Dokumentacja dla integratorów** – `ai/api.md` z opisem wszystkich dróg (OAuth, klucz, GET, kopiuj i wklej).
