// Powiadomienia push – Funkcja Edge Supabase (decyzja #113, wzorem Familiady push-send).
//  • { klucz: true } – klucz publiczny VAPID dla przeglądarki,
//  • { kolejka: true } – wysyłka zdarzeń z powiadomienia_kolejka (aplikacja po zmianie we współpracy, Cron Workera).
// Logika: ../_shared/powiadomienia.mjs. Sekrety (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT. Nic z tego nie leży w repozytorium. Wdrażana przez integrację z GitHubem ([functions.powiadomienia]).

import { obsluzPowiadomienia } from '../_shared/powiadomienia.mjs';

Deno.serve((request: Request) => obsluzPowiadomienia(request, {
  VAPID_PUBLIC_KEY: Deno.env.get('VAPID_PUBLIC_KEY') ?? undefined,
  VAPID_PRIVATE_KEY: Deno.env.get('VAPID_PRIVATE_KEY') ?? undefined,
  VAPID_SUBJECT: Deno.env.get('VAPID_SUBJECT') ?? undefined,
  SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? undefined,
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? undefined,
  SUPABASE_SECRET_KEYS: Deno.env.get('SUPABASE_SECRET_KEYS') ?? undefined,
}));
