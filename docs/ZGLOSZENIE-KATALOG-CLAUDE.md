# Zgłoszenie łącznika Makietki do katalogu Claude – ściąga

Portal: **claude.ai/directory/manage → Submit new → MCP connector** (wymaga płatnego planu Claude).
Pola poniżej są po angielsku – do wklejenia.

## Dane łącznika

| Pole | Wartość |
|---|---|
| Name | Makietka |
| Server URL | `https://api.makietka.app/mcp` |
| Authentication | OAuth 2.1 (dynamic client registration, PKCE) – discovery: `https://api.makietka.app/.well-known/oauth-protected-resource` |
| Documentation | `https://makietka.app/#/instrukcja/25` (rozdział „Working with AI” – otwiera się w języku przeglądarki) oraz `https://makietka.app/ai/api.md` (opis narzędzi) |
| Privacy policy | `https://makietka.app/privacy.html` (po polsku: `https://makietka.app/prywatnosc.html`) |
| Support contact | kontakt@makietka.app |
| Icon | `img/ikony/ikona-512.png` (512 × 512) albo `img/ikony/ikona.svg` z repozytorium |
| Website | `https://makietka.app` |

**Short description:**
> Design print publications – calendars, books, planners, comics – with your AI assistant.

**Long description:**
> Makietka is a web app for designing print-ready publications: wall and desk calendars, books, brochures, planners and comics. The connector lets Claude read and edit your Makietka projects: add and change pages and elements, fill data tables that drive repeated pages, insert ready-made elements from the Library (frames, icons, calendars, charts, ornaments), upload images, reply to comments, and export print-ready PDF or PNG files. With an open Makietka tab Claude can also draw pictures with your own Gemini key, draw comic panels and place speech bubbles, and create a preview link (only after you confirm). You choose which projects Claude can access, whether it can edit them and for how long; every change can be undone with "Undo AI changes".

## Konto testowe dla recenzentów

- Adres: **`test+recenzja@makietka.app`**. Konta testowe to adresy `test+<cokolwiek>@makietka.app` (subaddressing
  w Cloudflare: reguła `test@` → worker) – poczta do nich trafia do skrzynki w panelu administratora Makietki,
  nie na prywatny e-mail. Kolejne konto testowe: np. `test+2@makietka.app`.
- Hasło tego konta wpisz **tylko w formularzu zgłoszenia** (pole dla recenzentów) – nie w repozytorium ani w czacie.
- Na koncie są gotowe projekty po angielsku (przygotowane przez łącznik „Makietka recenzja”):
  **„Spring Fair – Poster”** (plakat z obrazem, kodem QR, wstęgą z Biblioteki i komentarzem z odpowiedzią),
  **„Wall Calendar 2027”** (styczeń i luty z obrazem i kalendarzem miesiąca), **„Comic – The Parcel”** (kadry i dymki).
  Plakat ma też tabelę danych „Stalls”, komiks – tabelę „Script”.

**Test instructions (dla recenzentów, po angielsku):**
> Test account: the email and password given in this form. The account already has sample projects: "Spring Fair – Poster", "Wall Calendar 2027" and "Comic – The Parcel".
> 1. Add the connector in Claude (Settings → Connectors → Add custom connector → `https://api.makietka.app/mcp`) and sign in with the test account. On the Makietka consent screen choose "All (also creating and deleting)" and "read and change", then "Allow".
> 2. Try: "List my Makietka projects", "Show an overview of Spring Fair – Poster", "Change the poster title to 'Spring Fair 2028'", "Add a row to the Stalls table", "Reply to the comment on the poster and resolve it", "Add a March page to Wall Calendar 2027", "Add a speech bubble to the last panel of the comic", "Find a rounded frame in the Makietka Library and put it on the poster", "Export the poster as a PDF for screen".
> 3. Keep https://makietka.app open in a browser tab signed in to the test account – PDF/PNG export also works without it, but drawing pictures, comic panels, speech bubbles, Library elements and preview links are done by the open app (pictures need the user's own Google Gemini key, so in the test account they are expected to report a missing key).
> 4. "Undo AI changes" (Claude asks first) restores the project to its state before Claude's latest series of edits.

## Jak wysłać zgłoszenie – krok po kroku

1. Zaloguj się na claude.ai na koncie z płatnym planem (Pro, Max, Team albo Enterprise).
2. Wejdź na **claude.ai/directory/manage**.
3. Kliknij **Submit new**, a potem **MCP connector**.
4. Wypełnij pola, kopiując je z tabeli „Dane łącznika” i opisów wyżej:
   - Name, Server URL, krótki i długi opis,
   - linki: dokumentacja, polityka prywatności, strona,
   - kontakt do wsparcia: kontakt@makietka.app,
   - ikona: wgraj plik `img/ikony/ikona-512.png` z repozytorium (albo pobierz z `https://makietka.app/img/ikony/ikona-512.png`).
5. W części dla recenzentów wpisz adres konta testowego (`test+recenzja@makietka.app`), jego hasło i wklej „Test instructions”.
6. Potwierdź, że każde narzędzie przetestowano jako konektor niestandardowy (zrobione na łączniku „Makietka recenzja” – patrz plan I9).
7. Wyślij. Odpowiedź przyjdzie na e-mail konta Claude; recenzenci mogą zadać pytania albo poprosić o poprawki.

## Wymagania – stan

| Wymaganie | Stan |
|---|---|
| Serwer zdalny HTTPS | ✅ |
| OAuth 2.0 | ✅ OAuth 2.1 |
| `title` + `readOnlyHint`/`destructiveHint` dla każdego narzędzia | ✅ (test `katalog-lacznikow`) |
| Dokumentacja | ✅ instrukcja (pl/en/uk) + `ai/api.md` |
| Polityka prywatności | ✅ `privacy.html` / `prywatnosc.html` (administrator: operator serwisu Makietka, kontakt@makietka.app) |
| Kontakt | ✅ kontakt@makietka.app |
| Ikona | ✅ także `favicon.ico` pod api.makietka.app (Claude może trzymać starą ikonę – wtedy usunąć i dodać łącznik jeszcze raz) |
| Konto testowe | ✅ `test+recenzja@makietka.app` (założone przez właściciela) |
| Materiały testowe na koncie | ✅ plakat, kalendarz, komiks (po angielsku) |
| Test każdego narzędzia w Claude jako konektor niestandardowy | ✅ przez łącznik „Makietka recenzja” (plan I9), także narzędzia usuwające; nowe usun_z_tabeli i usun_czesc – testy automatyczne (widoczne w nowej rozmowie) |
| Płatny plan Claude i wysłanie formularza | ⏳ właściciel |
