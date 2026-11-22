# Koszty płatnych testów AI (budżet: najwyżej ok. 5 zł)

Każde wywołanie z prawdziwym kluczem właściciela (Gemini). Koszt z rzeczywistego zużycia (usageMetadata) według
cennika w js/ai-koszty.js (kurs 4,00 zł/$ – zaokrąglony w górę).

| Data | Co | Model | Tokeny (we / wy) | Koszt |
|---|---|---|---|---|
| 22.11.2026 | Próba formatu: obraz 3:4 (dziewczynka na ulicy), z Node | gemini-3.1-flash-lite-image 1K | 45 / 1497 (obraz 1120) | 0,14 zł |
| 22.11.2026 | Obraz AI w aplikacji jak użytkownik (kot na dachu, ramka 1:1) | gemini-3.1-flash-lite-image 1K | ok. 60 / 1500 | 0,14 zł |
| 22.11.2026 | Tekst: tłumaczenie na ukraiński + kolumna 3 wierszy, z Node | gemini-3.1-flash-lite | ok. 230 / 70 | 0,001 zł |
| 22.11.2026 | Pomiar C7 w aplikacji: komiks 3 strony × 3 kadry + obrazy wzorcowe Ali i Oli (11 obrazów, 49 s) | gemini-3.1-flash-lite-image 1K | ok. 600 / 1500 na obraz | 1,51 zł |
| 22.11.2026 | Scenariusz z pomysłu (Kuba i karmnik, 2 strony), z Node | gemini-3.1-flash-lite | 319 / 916 | 0,006 zł |
| 22.11.2026 | Czat Makietki z Gemini na żywo (D4): 5 rozmów – dwie odrzucone przez Gemini (błąd schematu narzędzi, poprawiony), trzy z rysowaniem tulipanów (2 × szkic, 1 × dokładny) | gemini-3.5-flash-lite + obrazy | ok. 5000 / 1500 na rozmowę | ok. 0,75 zł |

**Suma: ok. 2,55 zł** (budżet po uwagach właściciela: do ok. 20 zł)
