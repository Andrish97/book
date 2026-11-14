-- Migracja: większe limity kont (decyzja #96) i rozmiary tabel do porządków w bazie.
--
-- Użytkownik: „R2 zostaje, ale zwiększ limity na konto”. Pliki konta, jeden plik i cały magazyn
-- pilnuje Worker (cloudflare/api-worker.js, LIMITY); tu – limity sprawdzane w bazie.

create or replace function public.limity_aplikacji()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'projekty', 100,             -- własne projekty jednego konta
    'osoby_w_projekcie', 20,     -- współpracownicy i czekające zaproszenia razem
    'obrazy_w_projekcie', 1000   -- obrazy (pliki) w jednym projekcie; sprawdza aplikacja i łącznik AI
  );
$$;

-- Rozmiary tabel (z indeksami i TOAST) i całej bazy – tylko liczby, bez treści; dla zalogowanych.
-- Do sprawdzania, co zajmuje miejsce w darmowym limicie 500 MB, i do statystyk.
create or replace function public.rozmiary_tabel()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'baza', pg_database_size(current_database()),
    'tabele', coalesce((
      select jsonb_agg(jsonb_build_object('tabela', n.nspname || '.' || c.relname, 'bajty', pg_total_relation_size(c.oid),
                                          'wiersze', c.reltuples::bigint) order by pg_total_relation_size(c.oid) desc)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'm') and pg_total_relation_size(c.oid) > 256 * 1024
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.rozmiary_tabel() from public, anon;
grant execute on function public.rozmiary_tabel() to authenticated;
