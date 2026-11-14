// Powiadomienia push – Funkcja Edge Supabase (decyzja #113, wzorem Familiady push-send).
//  • { klucz: true } – klucz publiczny VAPID dla przeglądarki,
//  • { kolejka: true } – wysyłka zdarzeń z powiadomienia_kolejka (aplikacja po zmianie we współpracy, Cron Workera).
// Logika: ../_shared/powiadomienia.mjs. Bez sekretów do ustawiania – klucze VAPID tworzą się same i leżą
// w tabeli push_klucze (decyzja #113a). Wdrażana przez integrację z GitHubem ([functions.powiadomienia]).

import { obsluzPowiadomienia } from '../_shared/powiadomienia.mjs';

Deno.serve((request: Request) => obsluzPowiadomienia(request, {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? undefined,
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? undefined,
  SUPABASE_SECRET_KEYS: Deno.env.get('SUPABASE_SECRET_KEYS') ?? undefined,
}));
