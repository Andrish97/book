// Przekaźnik api.makietka.app → baza Supabase projektu Makietki (Cloudflare Worker, decyzja #88).
//
// Wszystkie ścieżki idą bez zmian (/rest, /auth, /storage, /functions, /realtime – także WebSocket),
// z jednym skrótem: /mcp/… → /functions/v1/mcp/… – adres zdalnego łącznika dla AI to
// https://api.makietka.app/mcp/<klucz sdk_…> (i …/obraz do wysyłki plików).
// Bez sekretów: klucze idą w nagłówkach od aplikacji i AI, Worker niczego nie dopisuje.
// Wdrażany przez integrację Git Cloudflare (Workers Builds) z katalogu cloudflare/ – README.md obok.

import { obsluzEmail, obsluzKontakt, przebiegKolejki } from './poczta.js';

export const CEL = 'https://pganajmivwtstapnwsgv.supabase.co';

// Adres w bazie dla adresu zapytania do przekaźnika.
export function adresCelu(adres) {
  const u = new URL(adres);
  const sciezka = u.pathname === '/mcp' || u.pathname.startsWith('/mcp/') ? `/functions/v1${u.pathname}` : u.pathname;
  return `${CEL}${sciezka}${u.search}`;
}

export default {
  async fetch(zapytanie, env, ctx) {
    const u = new URL(zapytanie.url);
    // Formularz kontaktowy (decyzja #95, cloudflare/poczta.js).
    if (u.pathname === '/kontakt') return obsluzKontakt(zapytanie, env || {}, ctx);
    if (u.pathname === '/' && zapytanie.method === 'GET') {
      return new Response('Makietka – API (przekaźnik do bazy). Aplikacja: https://makietka.app/\n', {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    // new Request(adres, zapytanie) przenosi metodę, nagłówki, treść (strumieniem) i prośbę o WebSocket
    // (Upgrade) – odpowiedź 101 z bazy wraca do przeglądarki bez zmian. Przekierowania podaje dalej.
    return fetch(new Request(adresCelu(zapytanie.url), zapytanie), { redirect: 'manual' });
  },
  // Poczta przychodząca na kontakt@makietka.app (Email Routing → „Send to a Worker”).
  async email(wiadomosc, env, ctx) {
    await obsluzEmail(wiadomosc, env, ctx);
  },
  // Co minutę: przebieg kolejki maili (wrangler.jsonc → triggers.crons).
  async scheduled(_zdarzenie, env, ctx) {
    ctx.waitUntil(przebiegKolejki(env).catch(() => {}));
  },
};
