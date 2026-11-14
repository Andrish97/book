// Poczta aplikacji – Funkcja Edge Supabase (decyzja #86). Wszystkie e-maile przez API Brevo:
//  • hak Auth „Send Email” (Authentication → Hooks): rejestracja, reset hasła, zmiana adresu, link logowania;
//    żądanie podpisane sekretem haka (standardwebhooks),
//  • zaproszenie do projektu (współpraca): aplikacja woła funkcję tokenem zalogowanego właściciela.
// Logika: ../_shared/poczta.mjs. Sekrety (Edge Functions → Secrets): BREVO_API_KEY, SEND_EMAIL_HOOK_SECRET;
// opcjonalnie MAIL_FROM_EMAIL, MAIL_FROM_NAME, SITE_URL. Nic z tego nie leży w repozytorium.
// Wdrażana przez integrację Supabase z GitHubem (blok [functions.poczta] w supabase/config.toml).

import { obsluzPoczte } from '../_shared/poczta.mjs';

Deno.serve((request: Request) => obsluzPoczte(request, {
  BREVO_API_KEY: Deno.env.get('BREVO_API_KEY') ?? undefined,
  SEND_EMAIL_HOOK_SECRET: Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? undefined,
  MAIL_FROM_EMAIL: Deno.env.get('MAIL_FROM_EMAIL') ?? undefined,
  MAIL_FROM_NAME: Deno.env.get('MAIL_FROM_NAME') ?? undefined,
  SITE_URL: Deno.env.get('SITE_URL') ?? undefined,
  SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? undefined,
}));
