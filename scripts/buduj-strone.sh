#!/usr/bin/env bash
# Pliki strony aplikacji do wdrożenia (#345, #349) – Cloudflare Workers Builds (worker API, cloudflare/wrangler.jsonc → build.command).
# Użycie: bash scripts/buduj-strone.sh [katalog wynikowy, domyślnie _site] [wersja – skrót commita]
set -euo pipefail
cd "$(dirname "$0")/.."
CEL="${1:-_site}"
WERSJA="${2:-${WORKERS_CI_COMMIT_SHA:-${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo lokalna)}}}"
rm -rf "$CEL"
mkdir -p "$CEL"
cp -r index.html rysuj.html prywatnosc.html privacy.html manifest.webmanifest sw.js css js img ai llms.txt "$CEL/"
touch "$CEL/.nojekyll"
# Numer wersji i lista plików kodu dla service workera (pamięć jednej wersji naraz).
python3 scripts/wersja-sw.py "$CEL" "${WERSJA:0:12}"
# Krótkie linki podglądu (#195): makietka.app/<kod> nie ma pliku – serwer podaje 404.html, czyli tę samą aplikację.
cp "$CEL/index.html" "$CEL/404.html"
# Rozszerzenie Claude Desktop (.mcpb) z łącznikiem – pobierane z okna „Dostęp dla AI”.
python3 scripts/rozszerzenie-mcpb.py "$CEL/ai/mcp/makietka.mcpb"
# Nagłówki Cloudflare: pamięć podręczna i podstawowe zabezpieczenia. Biblioteki z wersją
# w nazwie pliku (fabric-7.4.0.min.js…) – na rok; czcionki, profile, obrazy – tydzień; kod aplikacji – sprawdzany
# przy każdym starcie (ETag – niezmieniony plik się nie pobiera); i tak trzyma go service worker swojej wersji.
cat > "$CEL/_headers" <<'NAGLOWKI'
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cache-Control: public, max-age=0, must-revalidate

/sw.js
  Cache-Control: no-cache

/js/zewnetrzne/*.js
  Cache-Control: public, max-age=31536000, immutable

/css/czcionki/*
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400

/css/profile/*
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400

/img/*
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400
NAGLOWKI
echo "Strona gotowa w $CEL (wersja ${WERSJA:0:12})"
