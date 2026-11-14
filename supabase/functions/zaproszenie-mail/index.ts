// E-mail z zaproszeniem do projektu (współpraca, decyzja #86) – Funkcja Edge Supabase.
// Aplikacja woła ją tokenem zalogowanego właściciela projektu: POST { id zaproszenia }.
// Wysyłka przez API Brevo; klucz to sekret funkcji BREVO_API_KEY (Supabase → Edge Functions → Secrets),
// nigdy w repozytorium. Bez klucza funkcja tylko odpowiada, że poczta nie jest skonfigurowana – zaproszenie
// czeka wtedy w aplikacji, a link można skopiować. Logika: ../_shared/zaproszenie-mail.mjs.
// Wdrażana przez integrację Supabase z GitHubem (blok [functions.zaproszenie-mail] w supabase/config.toml).

import { obsluzZaproszenieMail } from '../_shared/zaproszenie-mail.mjs';

Deno.serve((request: Request) => obsluzZaproszenieMail(request, {
  BREVO_API_KEY: Deno.env.get('BREVO_API_KEY') ?? undefined,
  ADRES_APLIKACJI: Deno.env.get('ADRES_APLIKACJI') ?? undefined,
  NADAWCA: Deno.env.get('MAIL_NADAWCA') ?? undefined,
  NAZWA_NADAWCY: Deno.env.get('MAIL_NAZWA_NADAWCY') ?? undefined,
  SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? undefined,
}));
