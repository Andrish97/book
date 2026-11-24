-- Migracja: lista linków podglądu projektu z bazy (decyzja #428).
--
-- „Link, który dodałem potem, jest znowu niewidoczny, chociaż działa, a jego przygotowanie się zacięło.”
-- Link powstaje w bazie (krótki kod, ochrona, pliki), zanim projekt zapisze się z nim na koncie – zamknięcie
-- aplikacji w tym czasie zostawiało działający link, którego nie ma na liście w projekcie. Okno Udostępnij
-- dopełnia listę linkami z bazy: krótkie kody projektu (krotkie_linki) z ochroną (udostepnienia).

create or replace function public.linki_projektu(p_projekt uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'kod', k.kod_linku, 'krotki', k.kod, 'konto', k.konto, 'utworzono', k.utworzono,
           'chroniony', u.kod is not null, 'haslo', u.haslo_skrot is not null, 'wazny_do', u.wazny_do)
         order by k.utworzono), '[]'::jsonb)
    from public.krotkie_linki k
    left join public.udostepnienia u on u.owner_id = k.konto and u.projekt_id = k.projekt and u.kod = k.kod_linku
   where k.projekt = p_projekt and k.konto = auth.uid();
$$;
revoke all on function public.linki_projektu(uuid) from public;
grant execute on function public.linki_projektu(uuid) to authenticated;
