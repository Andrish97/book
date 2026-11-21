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

## Aplikacja na Cloudflare (decyzja #345)

Pliki aplikacji podaje osobny worker `makietka-app` (sam worker z plikami – static assets, bez kodu serwera),
budowany z GitHuba po każdym pushu na `main`, tak jak `makietka-api`. Przepis na pliki: `scripts/buduj-strone.sh`
(ten sam dla GitHub Pages), konfiguracja: `cloudflare/aplikacja/wrangler.jsonc`, nagłówki: `_headers` w zbudowanej stronie.

Podłączenie (raz):
1. Workers & Pages → Create → Import a repository → `Andrish97/book`.
2. Nazwa: `makietka-app`. Root directory: puste (katalog główny repozytorium).
   Build command: `bash scripts/buduj-strone.sh`. Deploy command: `npx wrangler deploy -c cloudflare/aplikacja/wrangler.jsonc`.
   Production branch: `main`.
3. Po wdrożeniu aplikacja działa pod adresem testowym `https://makietka-app.<konto>.workers.dev` – sprawdzić
   logowanie, otwarcie projektu, podgląd z linku i makietę.
4. Przepięcie domeny (#347): trasy `makietka.app/*` i `www.makietka.app/*` są już w `cloudflare/aplikacja/wrangler.jsonc`
   (www przekierowuje na makietka.app – `cloudflare/aplikacja/worker.js`). W panelu:
   - DNS → Records: usunąć rekordy GitHub Pages – 4 × A i 4 × AAAA dla `makietka.app` (185.199.x.153, 2606:50c0:…)
     oraz CNAME `www` → `andrish97.github.io` (MX, TXT, rekordy poczty i `api` zostają);
   - DNS → Records → Import and Export → Import: plik `cloudflare/aplikacja/dns-makietka-app.txt`, zaznaczone
     „Proxy imported DNS records” (dwa rekordy AAAA 100:: – przez Cloudflare, ruch przejmuje worker);
   - GitHub → Settings → Pages → Custom domain → Remove. Workflow `pages.yml` wyłączymy po sprawdzeniu.
