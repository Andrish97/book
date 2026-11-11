// Zdalny łącznik MCP Seriodruku – Funkcja Edge Supabase.
// Adres: https://pganajmivwtstapnwsgv.supabase.co/functions/v1/mcp/<klucz sdk_… z okna „Dostęp dla AI”>
// Claude (Dostosuj → Łączniki → Dodaj własny łącznik) i ChatGPT (własny serwer MCP) łączą się tu ze swoich
// serwerów, więc AI nie potrzebuje dostępu do bazy z własnej piaskownicy ani odblokowywania domen.
// Cała logika jest w ../_shared/mcp-http.mjs (wspólny rdzeń narzędzi z serwerem stdio).
// Wdrażana przez integrację Supabase z GitHubem (blok [functions.mcp] w supabase/config.toml).
//
// Funkcja woła bazę tak jak aplikacja: publicznym adresem i kluczem publikowalnym (to nie są sekrety);
// klucza serwisowego nie używa. SERIODRUK_ADRES / SERIODRUK_KLUCZ_PUBLICZNY pozwalają to zmienić.

import { obsluzHttp } from '../_shared/mcp-http.mjs';

Deno.serve((request: Request) => obsluzHttp(request, {
  adres: Deno.env.get('SERIODRUK_ADRES') ?? undefined,
  kluczPubliczny: Deno.env.get('SERIODRUK_KLUCZ_PUBLICZNY') ?? undefined,
}));
