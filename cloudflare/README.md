# Przekaźnik api.makietka.app (Cloudflare Worker)

`api-worker.js` przekazuje każde zapytanie z `https://api.makietka.app/…` do bazy Supabase
(`https://pganajmivwtstapnwsgv.supabase.co/…`) bez zmian – REST, logowanie, pliki, funkcje i Realtime
(WebSocket). Jeden skrót: `/mcp/…` → `/functions/v1/mcp/…`, więc adres łącznika dla AI to
`https://api.makietka.app/mcp/<klucz sdk_…>`. Worker nie ma sekretów i niczego nie zapisuje.

Wdrażanie: integracja Git Cloudflare (Workers Builds) – po każdym pushu na `main`, który zmienia
`cloudflare/**`. Konfiguracja: `wrangler.jsonc` (nazwa `makietka-api`, własna domena `api.makietka.app`).
Kroki w panelu: `docs/KONFIGURACJA-DOMENY.md`, krok 3. Test: `tests/worker.test.cjs`.

Po pierwszym wdrożeniu, gdy `https://api.makietka.app/` odpowiada „Makietka – API”, przełącz
`PRZEZ_WORKER` na `true` w `js/marka.js`.

## Pliki w R2 (decyzja #92)

Ten sam Worker obsługuje pliki aplikacji w Cloudflare R2 (binding `PLIKI` → bucket `makietka-files`):
`/pliki/<właściciel>/<projekt>/<id>` (z tokenem sesji; właściciel albo współpracownik przez `dostep_do_plikow`),
`/podglady/…` (obrazy stron linków – odczyt publiczny), `GET /pliki/_miejsce`, `GET /pliki/_lista`,
`POST /pliki/_usun`, `GET /pliki/_osierocone`. Limity plików: `LIMITY` w `api-worker.js`.
Test: `tests/worker-pliki.test.cjs`. Bucket tworzy się raz w panelu (docs/KONFIGURACJA-DOMENY.md, 3a).

## Rysowanie stron linku na serwerze (decyzja #335)

Ciężkie zlecenia (od 40 stron linku do narysowania naraz) rysuje przeglądarka Cloudflare zamiast urządzenia
użytkownika: `POST /rysuj/link` (sesja właściciela, projekt w treści, folder linku), `GET /rysuj/stan?projekt=…`.
Kod: `rysowanie.js` – kolejka na projekt (Durable Object `RYSOWANIE`, klasa `Rysowanie`), przeglądarka
(binding `PRZEGLADARKA`, biblioteka `@cloudflare/puppeteer` z `package.json`), strona `https://makietka.app/rysuj.html`.
Zabezpieczenia: tylko własny folder linku, tylko pliki projektu z dostępem zlecającego, ruch przeglądarki ograniczony
do plików aplikacji, dzienny limit 5000 stron na konto. Wymaga planu Workers Paid (Browser Rendering: 10 godzin
miesięcznie w cenie). Bez przeglądarki albo przy błędzie aplikacja rysuje link jak dawniej, na urządzeniu.
Testy: `tests/rysowanie-worker.test.cjs`, `tests/rysowanie-serwer.test.cjs`.

## Aplikacja na Cloudflare (decyzje #345, #347, #352)

Aplikację `makietka.app` podaje ten sam worker co przekaźnik API (w panelu nazywa się „book”, katalog `cloudflare/`).
Przy każdym wdrożeniu `cloudflare/wrangler.jsonc` sam buduje pliki strony (`build.command` → `scripts/buduj-strone.sh`
do `_site/`) i wysyła je jako static assets. Na początku `fetch` w `api-worker.js`: `makietka.app` → pliki,
`www.makietka.app` → przekierowanie 301 na `makietka.app`, reszta (`api.makietka.app`) → przekaźnik jak dotąd.
Trasy `makietka.app/*` i `www.makietka.app/*` wpisuje samo wdrożenie; w DNS są dwa rekordy AAAA `100::` przez Cloudflare
(import: `cloudflare/aplikacja/dns-makietka-app.txt`). GitHub Pages wyłączone 21.11.2026 (#349).

W panelu workera „book” (Settings → Build) potrzebne jest tylko: Root directory `/cloudflare`, Build command puste,
Deploy command `npx wrangler deploy`.
