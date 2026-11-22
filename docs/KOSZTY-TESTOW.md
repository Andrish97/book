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

| 22.11.2026 | Miniatury stylów rysunków (E5/C1): 5 obrazów, ta sama scena w każdym stylu (img/style/) | gemini-3.1-flash-lite-image 1K | ok. 7600 wyj. | ok. 0,70 zł |

| 22.11.2026 | Cała strona komiksu jednym obrazem (E5/C3) – próba jakości: 3 kadry, ramki rysowane przez AI | gemini-3.1-flash-lite-image 1K | 346 / 1598 | ok. 0,14 zł |

| 22.11.2026 | Cała strona – druga próba po poprawce polecenia (bez pustych ramek na dymki) | gemini-3.1-flash-lite-image 1K | 366 / 1497 | ok. 0,14 zł |

| 22.11.2026 | Miniatury 5 nowych stylów (F5) | gemini-3.1-flash-lite-image 1K | ok. 7500 wyj. | ok. 0,70 zł |

**Suma: ok. 4,25 zł** (budżet po uwagach właściciela: do ok. 20 zł)
