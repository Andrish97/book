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
