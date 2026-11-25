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
  ostatni użyty: **#436**), commit i push.
- **Testy punktowo** (właściciel 23.11: „test ma być bardziej punktowy, a nie całości”): test sprawdza tylko zmienioną
  rzecz – kilka linijek w istniejącym pliku albo mały nowy plik; uruchamiać tylko pliki testów dotyczące zmiany,
  potem wysyłka na main. Pełnego przebiegu nie puszczać po każdej zmianie (całość sprawdza się automatycznie na main).
  Pełny przebieg: `node --test --test-concurrency=3 tests/*.test.cjs` (~45 min; tylko na wyraźną prośbę).
  Lint: `npx eslint js` (albo `/opt/node-tools/node_modules/.bin/eslint --no-config-lookup -c eslint.config.mjs <pliki>`).
  Po zmianie listy modułów: `node scripts/moduly-buduj.cjs`; po zmianie rdzenia łącznika AI
  (supabase/functions/_shared/seriodruk-mcp-rdzen.mjs): `node scripts/mcp-buduj.cjs`; po zmianie opisu narzędzia – tłumaczenie w
  supabase/functions/_shared/mcp-teksty-en.json i `node scripts/mcp-angielski.cjs` (łącznik jest po angielsku, #410).
- Chwiejne pod obciążeniem (osobno przechodzą): eksport-uklad (DOCX), idml, makiety-wszystkie, zasoby (obrazy poza pamięcią); miniatury-stron-pamiec zawodzi ok. 2 na 3 razy także na starszych wersjach (czas zapisu miniatur w tle).
- **Napisy interfejsu tylko przez klucze**: `t('obszar.klucz', { zmienne })`, słowniki js/jezyki/klucze/{pl,en,uk}.js
  (wszystkie trzy języki, test tests/i18n-klucze-kodu.test.cjs). Odmiana: `{n|jak 1|jak 2–4|jak 5}` (en: `{n|1|reszta}`).
  Nowe napisy w kodzie można przenieść skryptem `node scripts/i18n-kod.cjs <pliki>`, ale tłumaczenia en/uk dopisać.
- Hosting: Cloudflare, worker „book” (katalog cloudflare/, wdrożenie z main samo; podaje też makietka.app).

## Klucz Gemini i budżet testów

- Zmienna środowiska **`GEMINI_API_KEY`** w środowisku „Book” (nowa sesja ją widzi). Nie wypisuj klucza.
- Sprawdzenie bez kosztów: `curl -s -o /tmp/m.json -w "%{http_code}\n" -H "x-goog-api-key: $GEMINI_API_KEY" "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200"`.
- **Budżet testów: do ok. 20 zł** (zgoda właściciela 22.11, „gdy to naprawdę pomaga przetestować”); wydane ok. 4,25 zł.
  Głównie teksty; obrazy oszczędnie (szkic). Zapisuj każde płatne wywołanie z szacowanym kosztem (np. w scratchpadzie) i zatrzymaj testy przed limitem.
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

Dalej tej samej nocy (wszystko z testami, instrukcją pl/en/uk, na main):
- **A4 #367** style „Dialog” i „Efekt dźwiękowy” + [Efekt]; **A11 #371** mostek (też w PDF), [Webtoon], raster i linie ruchu.
- **B2–B4 #372–#373** [Obraz AI] (koszt przed generowaniem, limit miesięczny, licznik), [Tekst AI], ✦ „Wypełnij kolumnę”
  w oknie Dane; klucz Gemini z sejfu (#241) – zapytania z przeglądarki. Ceny: js/ai-koszty.js (cennik 22.11.2026).
- **C1–C4, C6, C7 #374–#375** styl rysunków, obraz wzorcowy z karty, [Rysuj kadry], [Scenariusz z AI] (pomysł albo
  dokument); pomiar: 3 strony × 3 kadry + 2 postacie = 1,51 zł (szkic), 49 s – w instrukcji 10.13 z przykładem.
- **B5/C5 #376** narzędzia czatu: generuj_obraz, rysuj_kadry, ustaw_dymki, szacuj_koszt (zgoda z kwotą za każdym razem).

- **Uwagi właściciela D1–D12 (#377–#382, plan: docs/PLAN-KOMIKS.md, część D)** – wszystkie zrobione:
  pasek komiksu z trzema przyciskami ([Kadry], [Dymek ▾], [Komiks]) i menu [AI ▾] w każdym projekcie; okno „Komiks krok
  po kroku” (js/app/komiks-okno.js); okno „Scenariusz” z ujęciami, miejscami i „też w kadrze”
  (js/app/komiks-scenariusz-okno.js, js/komiks-scenariusz.js); forma komiksu w szablonie (zeszyt, książka, kartki,
  ekran) i „To komiks” w pustym projekcie; obraz miejsca jako tło kadru; ponowne rysowanie z zapisanego opisu;
  „Popraw obecny obraz” (B3); oznaczenia dostawców AI „rozmowa i zmiany w projekcie” / „i obrazy”; czat z Gemini
  sprawdzony na żywo (3 błędy poprawione, #380); instrukcja 10.13, 5.17, 7.11, 25.6 (pl/en/uk) ze zrzutami.

- **Uwagi E1–E5 i F1–F6 (#383–#389)**: #383 – strona nie otwierała się przy powrocie (ERR_FAILED; service worker
  i przekierowanie /index.html – poprawione, wdrożone); pasek: [Kształty ▾], [AI ▾], [Dymek ▾], [Asystent AI] na górnym
  pasku; bez klucza Gemini pozycje generowania wyszarzone (js/sejf-kluczy.js ma()); koszty orientacyjne na górze
  ustawień AI, czat bez pytania o zgodę na koszt (limit miesięczny); kategoria „Komiks” w Bibliotece
  (js/biblioteka-komiks.js); emocje i działania postaci oraz rekwizyty w scenariuszu i opisach AI; 10 stylów
  z miniaturami (img/style/); cała strona komiksu jednym obrazem; poprawka obrazu w oknie i w czacie.

Zostało (nieobowiązkowe): **B6** – generowanie w łączniku MCP (przez kolejkę otwartej aplikacji jak eksport PDF albo
klucz na serwerze). Płatne testy: docs/KOSZTY-TESTOW.md.

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

- Po zmianach w Bibliotece (nowe elementy, kategorie, nazwy): `node scripts/katalog-biblioteki.cjs && node scripts/mcp-buduj.cjs` – katalog dla łącznika AI (H7); test biblioteka-ai przypomni, gdy jest nieaktualny.
