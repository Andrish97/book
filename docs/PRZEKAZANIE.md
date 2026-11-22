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
  Claude-Session: https://claude.ai/code/session_01RaMJ2Ntz7GzbyxDWHScWWA
  ```
- Każdy punkt: **test**, **instrukcja** (docs/instrukcja/*.md po polsku + docs/instrukcja/en/ i uk/ – ta sama budowa;
  potem `node scripts/instrukcja-buduj.cjs`), wpis w **docs/DECYZJE.md i docs/ZGLOSZENIA.md** (kolejny numer #NNN,
  ostatni użyty: **#363**; numery w planie: #364 = tryb Komiks), commit i push.
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

Gotowe i na main: dymek (#360: mowa/myśl/krzyk/szept/narracja, ogonek uchwytem, rośnie z tekstem, skrót w łączniku),
czcionki komiksowe + cyrylica (#363), moduły z testami: js/kadry.js (#362: siatka z rynną, podział linią, spad,
kolejność czytania), js/dialogi.js (#361: dymki ze scenariusza, wersje językowe, rozpoznawanie dymków po
strona|kadr|postać|kolejność – przesunięte zostają).

**W toku (gałąź robocza, jeszcze niepodłączone):** `js/app/komiks-narzedzia.js` (#364) – układy kadrów (okno z 9
układami, rynna, na spad), podział kadru dwoma kliknięciami, „Scenariusz” (tworzy tabelę i otwiera okno Dane),
„Ustaw dymki” (z wyborem kolumny języka). Klucze `komiks.*` użyte w tym pliku **trzeba dopisać** do słowników (pl/en/uk).
Brakuje podłączenia (wzór: składanka):
1. js/typ-sekcji.js – typ `komiks` (nazwa, opis przez t(), ikona 'komentarz', rola 'blok');
2. js/app/panel-strony.js – `document.body.classList.toggle('w-komiksie', … typSekcji(…) === 'komiks')`;
3. css/style/ekrany/edytor.css – `.pasek-narzedzi .tylko-komiks { display: none; }` i `body.w-komiksie … { display: inline-flex; }`;
4. index.html – przyciski w `#pasek-narzedzi` z klasą `tylko-komiks` i `data-akcja`: komiks-dymek, komiks-kadry,
   komiks-podziel (aria-pressed), komiks-scenariusz, komiks-dymki (data-i18n + klucze, potem `node scripts/i18n-klucze.cjs`);
5. js/app/edytor-start.js – akcje `'komiks-…': () => obsluzAkcjeKomiksu('komiks-…')` i `podlaczKomiks()` tam, gdzie
   `podlaczSkladanke()`;
6. szablon projektu „Komiks” w js/szablony-projektow.js (sekcja typu komiks, kilka stron, tabela scenariusza);
7. CSS okna kadrów (`.uklady-kadrow`, `.uklad-kadrow` – siatka podglądów do kliknięcia);
8. testy w przeglądarce (tests/komiks.test.cjs): pasek tylko w sekcji komiks, układ kadrów (liczba, rynna, spad),
   podział kadru, scenariusz → Ustaw dymki → dymki na stronach, ponowne ustawienie po zmianie tekstu;
9. instrukcja: nowy rozdział o komiksie (pl, en, uk) z przykładem krok po kroku; zrzut.

Dalej według planu: style „Dialog” i „Efekt dźwiękowy” (A4), karty postaci i miejsc (A9), import stron (A10), potem AI
(część B – w każdym projekcie, niezależnie od komiksu; część C – komiks z AI, w tym import scenariusza z dokumentu).

## Inne otwarte wątki

- Rysowanie na serwerze (Cloudflare Browser Rendering) niesprawdzone na żywo – worker „book” potrzebuje powiązań
  PRZEGLADARKA i RYSOWANIE oraz sekretu SUPABASE_SERVICE_ROLE_KEY; bez nich aplikacja rysuje na urządzeniu (bez szkody).
- Migracja `supabase/migrations/20261121100000_eksport_na_serwerze.sql` – sprawdzić, czy integracja Supabase ją wdrożyła.
- Urwana wiadomość właściciela: „Rzeczy związane z danymi były wcześniej tylko po polsku, a teraz…” – zapytać rano;
  do tego czasu sprawdzić okno Dane i pola danych po angielsku i ukraińsku.
- Tłumaczenie: po ukraińsku style „Tytuł” i „Nagłówek” mają tę samą nazwę („Заголовок”).
- Zrzuty instrukcji en/uk – workflow „Zrzuty instrukcji” ma je robić; sprawdzić, czy powstały (img/instrukcja/en, uk).
- Chwiejne testy (wyżej) – ustabilizować, żeby fałszywe alarmy nie zasłaniały prawdziwych.
- Przypomnienie co godzinę: ustaw w nowej sesji własne (create_trigger, cron co godzinę, ten sam cel: „wznów pracę
  według docs/PRZEKAZANIE.md i docs/PLAN-KOMIKS.md”). Stare (w poprzedniej sesji) zostało usunięte.
