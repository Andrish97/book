# Przekazanie pracy (22.11.2026, noc) – dla nowej sesji

Nowa sesja: przeczytaj ten plik, potem `docs/PLAN-KOMIKS.md`, i działaj dalej bez pytania o zgodę na kolejne kroki.
Właściciel śpi i chce rano zobaczyć działające, przetestowane rzeczy. Odbiorca komiksów to laik – wszystko ma być
oczywiste, proste i dobrze opisane w instrukcji.

## Zasady pracy (stałe)

- Odpowiadaj po polsku, prosto; pokazuj wyniki (tabele, liczby, zrzuty).
- Gałąź robocza `claude/new-session-mea7o5`; po zielonych testach także `main`:
  ```
  git push -q origin HEAD:claude/new-session-mea7o5
  git fetch -q origin main && git merge -q --no-edit -X ours origin/main && git push -q origin HEAD:main
  ```
  Stopka commita:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RaMJ2SqHxhurYXGgYy6giS
  ```
- Każdy punkt: **test**, **instrukcja** (docs/instrukcja/*.md po polsku + docs/instrukcja/en/ i uk/ – ta sama budowa;
  potem `node scripts/instrukcja-buduj.cjs`), wpis w **docs/DECYZJE.md i docs/ZGLOSZENIA.md** (kolejny numer #NNN,
  ostatni użyty: **#366**; #364 zarezerwowany dla trybu Komiks), commit i push.
- Testy: `node --test --test-concurrency=3 tests/*.test.cjs` (pełny przebieg ~45 min; pojedyncze pliki szybko).
  Lint: `npx eslint js` (albo `/opt/node-tools/node_modules/.bin/eslint --no-config-lookup -c eslint.config.mjs <pliki>`).
  Po zmianie listy modułów: `node scripts/moduly-buduj.cjs`; po zmianie rdzenia łącznika AI
  (supabase/functions/_shared/seriodruk-mcp-rdzen.mjs): `node scripts/mcp-buduj.cjs`.
- Chwiejne pod obciążeniem (osobno przechodzą): eksport-uklad (DOCX), idml, makiety-wszystkie, zasoby (obrazy poza pamięcią).
- **Napisy interfejsu tylko przez klucze**: `t('obszar.klucz', { zmienne })`, słowniki js/jezyki/klucze/{pl,en,uk}.js
  (wszystkie trzy języki, test tests/i18n-klucze-kodu.test.cjs). Odmiana: `{n|jak 1|jak 2–4|jak 5}` (en: `{n|1|reszta}`).
  Nowe napisy w kodzie można przenieść skryptem `node scripts/i18n-kod.cjs <pliki>`, ale tłumaczenia en/uk dopisać.
- Hosting: Cloudflare, worker „book” (katalog cloudflare/, wdrożenie z main samo; podaje też makietka.app).

## Klucz Gemini i budżet testów

- Zmienna środowiska **`GEMINI_API_KEY`** w środowisku „Book” (nowa sesja ją widzi). Nie wypisuj klucza.
- Sprawdzenie bez kosztów: `curl -s -o /tmp/m.json -w "%{http_code}\n" -H "x-goog-api-key: $GEMINI_API_KEY" "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200"`.
- **Budżet testów: najwyżej ok. 5 zł** z ok. 40 zł na koncie właściciela. Głównie teksty; obrazy oszczędnie (tańszy model,
  1K). Zapisuj każde płatne wywołanie z szacowanym kosztem (np. w scratchpadzie) i zatrzymaj testy przed limitem.
- Do zrobienia przy kluczu: pomiar zużycia na prostym komiksie (np. 3 strony, 2 postacie) – koszt w zł do instrukcji.
- W aplikacji testy przechodzą „jak użytkownik”: konto testowe w przeglądarce testowej (tests/pomoc.cjs `otworz`),
  klucz wklejony w ustawieniach AI tak jak zrobiłby to użytkownik.

## Stan komiksu (plan: docs/PLAN-KOMIKS.md)

Gotowe i na main (22.11, sesja 01RaMJ2SqHxhurYXGgYy6giS): dymek (#360), dialogi (#361), kadry (#362), czcionki (#363),
**tryb Komiks (#364)** – typ sekcji „Komiks” z paskiem: [Dymek], [Efekt], [Kadry], [Podziel kadr], [Scenariusz],
[Ustaw dymki], [Postacie], [Wgraj strony]; szablon projektu „Komiks” (okładka zeszytowa, 24 strony z kadrami, scenariusz,
przykładowe karty). **Style „Dialog” i „Efekt dźwiękowy” (#367)**, **karty postaci i miejsc (#368)** – tabele „Postacie”
i „Miejsca” (js/postacie.js), kolor dymka postaci; **wgrywanie stron z plików/ZIP (#369)** – js/import-stron.js;
**kontrola komiksu (#370)** – js/komiks-kontrola.js. Instrukcja 10.13 (pl/en/uk) ze zrzutami (scripts/zrzuty-komiksu.cjs).
Testy: tests/komiks.test.cjs (7 testów), tests/komiks-dane.test.cjs.
Ważne: kadr komiksu to polygon z polem `kadr_nr` (NIE `kadr` – to pole zajmuje kadrowanie obrazu); `kadr_nr`, `z_dialogu`
zapisują się z projektem (js/fabric-ustawienia.js). Strona 1 scenariusza = pierwsza strona sekcji komiksu.

Zostało z części A: A11 (mostek między dymkami jednej postaci, webtoon – długi pasek PNG 800 px, rastry i linie ruchu
w bibliotece wzorów). Potem część B (AI w każdym projekcie) i C (komiks z AI) – w tym pomiar zużycia (C7) w budżecie
ok. 5 zł; rejestr płatnych wywołań prowadź w docs/KOSZTY-TESTOW.md.

## Inne otwarte wątki

- **Pełny przebieg testów** 22.11: 628/635 – czerwone poprawione (liczba czcionek po #363, pola stylu w łączniku,
  usunięty tests/_eksp.test.cjs); dostep-ai i makiety-wszystkie – chwiejne pod obciążeniem, osobno zielone. Scalone z main.
- Rysowanie na serwerze (Cloudflare Browser Rendering) niesprawdzone na żywo – worker „book” potrzebuje powiązań
  PRZEGLADARKA i RYSOWANIE oraz sekretu SUPABASE_SERVICE_ROLE_KEY; bez nich aplikacja rysuje na urządzeniu (bez szkody).
- Łącznik AI (js/ai-narzedzia-rdzen.js, seriodruk-mcp-rdzen.mjs) zna tylko polskie nazwy pól dokumentu – tekst z {page}
  oznaczy jako nieznane pole (tylko ostrzeżenie). Do dopisania przy części B.
- Kolumny kalendarza ({dzien}, {miesiac}, {dzien_tygodnia}…) są po polsku – to nazwy kolumn tabeli. Ewentualnie
  w przyszłości: nazwy kolumn w języku projektu przy tworzeniu kalendarza.
- Chwiejne testy (wyżej) – ustabilizować, żeby fałszywe alarmy nie zasłaniały prawdziwych.
- Przypomnienie co godzinę: w sesji 01RaMJ2SqHxhurYXGgYy6giS działa „Makietka – komiks, wznowienie (co godzinę)”
  (trig_01BrW3sGsQbT4Wvbo5U3ZAH1). Nowa sesja: wyłącz je i ustaw własne.

Zamknięte 22.11 rano: migracje bazy wdrażają się same przy wypchnięciu na main; zrzuty instrukcji en/uk są (126 + 126);
pola dokumentu po angielsku/ukraińsku (#365); znacznik [pomiń] = [skip] = [пропустити] (#366); ukraiński „Tytuł” = „Назва”.
