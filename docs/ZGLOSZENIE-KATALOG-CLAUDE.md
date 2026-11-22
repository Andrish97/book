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

1. Załóż w Makietce konto na osobny adres e-mail (nie Twój prywatny).
2. Zaloguj się i przeciągnij na listę projektów trzy pliki z `ai/przyklady/recenzja/`:
   `wall-calendar-2027.makietka`, `comic-the-parcel.makietka`, `brochure-spring-fair.makietka`.
3. W formularzu podaj e-mail i hasło tego konta (pole dla recenzentów). Hasła nie wpisuj do repozytorium.

**Test instructions (dla recenzentów, po angielsku):**
> 1. Add the connector in Claude and sign in with the test account. On the Makietka consent screen choose "All (also creating and deleting)" and "read and change".
> 2. Try: "List my Makietka projects", "In the comic, add a speech bubble on page 2 saying 'Hello!'", "Insert a rounded frame from the Library on the first page of the brochure", "Export the wall calendar as a PDF for screen".
> 3. Keep https://makietka.app open in a browser tab signed in to the test account – PDF/PNG export works without it, but drawing pictures, comic panels, bubbles, Library elements and preview links are done by the open app.
> 4. "Undo AI changes" (Claude asks first) restores the project to its state before Claude's latest series of edits.

## Wymagania – stan

| Wymaganie | Stan |
|---|---|
| Serwer zdalny HTTPS | ✅ |
| OAuth 2.0 | ✅ OAuth 2.1 |
| `title` + `readOnlyHint`/`destructiveHint` dla każdego narzędzia | ✅ (test `katalog-lacznikow`) |
| Dokumentacja | ✅ instrukcja (pl/en/uk) + `ai/api.md` |
| Polityka prywatności | ✅ `privacy.html` / `prywatnosc.html` – **uzupełnij dane administratora** (imię i nazwisko albo firma, adres) w punkcie 1 |
| Kontakt | ✅ kontakt@makietka.app |
| Ikona | ✅ |
| Konto testowe | ⏳ do założenia przez właściciela (punkt wyżej) |
| Test każdego narzędzia w Claude jako konektor niestandardowy | ⏳ właściciel albo sesja z podłączonym łącznikiem |
| Płatny plan Claude i wysłanie formularza | ⏳ właściciel |
