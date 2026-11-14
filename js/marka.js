// Marka, domena i adresy – jedno miejsce do zmiany (decyzja #88: Seriodruk → Makietka, makietka.app).
// Teksty w plikach statycznych (index.html, instrukcja, dokumenty, łącznik AI) zmienia skrypt
// scripts/marka.cjs – jego listę reguł trzeba poprawić razem z tym plikiem.
//
// Celowo NIE zmieniamy nazw w bazie (tabele, funkcje, magazyn plików, prefiks kluczy sdk_), nazw
// narzędzi łącznika MCP ani wewnętrznych identyfikatorów, których użytkownik nie widzi
// (window.seriodruk, klucze pamięci przeglądarki seriodruk…, format „seriodruk” w pliku projektu).

export const NAZWA = 'Makietka';
export const DOMENA = 'makietka.app';
export const ADRES_APLIKACJI = 'https://makietka.app/';
export const NADAWCA = 'no-reply@makietka.app';

// Baza: aplikacja i łącznik AI idą przez przekaźnik Cloudflare Worker (cloudflare/api-worker.js) pod
// api.makietka.app. Dopóki Workera nie ma, wystarczy przestawić PRZEZ_WORKER na false – wtedy wszystko
// idzie wprost do Supabase (adres łącznika z /functions/v1/mcp/).
export const PRZEZ_WORKER = true;
export const ADRES_SUPABASE = 'https://pganajmivwtstapnwsgv.supabase.co';
export const ADRES_API = PRZEZ_WORKER ? 'https://api.makietka.app' : ADRES_SUPABASE;
// Adres zdalnego łącznika MCP (bez klucza): Worker skraca /functions/v1/mcp do /mcp.
export const ADRES_LACZNIKA = PRZEZ_WORKER ? `${ADRES_API}/mcp` : `${ADRES_API}/functions/v1/mcp`;

// Plik projektu: rozszerzenie .makietka; wczytywanie rozpoznaje plik po treści, nie po rozszerzeniu.
export const ROZSZERZENIE = '.makietka';
export const TYP_MIME = 'application/vnd.seriodruk+zip';
export const FORMAT_PLIKU = 'seriodruk';
