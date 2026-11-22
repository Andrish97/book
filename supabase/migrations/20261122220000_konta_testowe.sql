-- Pula kont testowych (plan I8): konto z adresem test-<etykieta>@makietka.app jest kontem testowym (konto dla
-- recenzentów katalogu łączników Claude, testy łącznika AI). Zakłada je, zmienia hasło i usuwa worker
-- (cloudflare/konta-testowe.js, API administracyjne Supabase Auth); tu – lista dla panelu i przykładowe projekty.

create or replace function public._konto_testowe(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_email, '') ~* '^test-[a-z0-9-]{1,40}@makietka\.app$';
$$;

-- Lista kont testowych: id, adres, kiedy założone, ostatnie logowanie, liczba projektów.
create or replace function public.admin_konta_testowe()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.wymagaj_administratora();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'utworzono', u.created_at, 'ostatnio', u.last_sign_in_at,
             'projektow', (select count(*) from public.projekty p where p.owner_id = u.id)) order by u.created_at desc)
      from auth.users u where public._konto_testowe(u.email)), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_konta_testowe() from public, anon;
grant execute on function public.admin_konta_testowe() to authenticated;

-- Przykładowy projekt na konto testowe (dane z pliku .makietka, obrazy w środku jako dataUrl). Tylko na konta z puli.
create or replace function public.admin_projekt_testowy(p_konto uuid, p_id uuid, p_nazwa text, p_dane jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.wymagaj_administratora();
  if not exists (select 1 from auth.users u where u.id = p_konto and public._konto_testowe(u.email)) then
    raise exception 'To nie jest konto testowe';
  end if;
  if jsonb_typeof(p_dane) <> 'object' or pg_column_size(p_dane) > 5000000 then
    raise exception 'Nieprawidłowe dane projektu';
  end if;
  insert into public.projekty (id, owner_id, nazwa, dane, zmieniono, wersja)
    values (p_id, p_konto, left(coalesce(nullif(btrim(p_nazwa), ''), 'Projekt'), 120),
            (p_dane - 'udostepnienie' - 'podstawa_chmury' - 'wersja_chmury' - 'wspolpraca_chmury') || jsonb_build_object('id', p_id),
            now(), 1);
  return jsonb_build_object('id', p_id);
end;
$$;
revoke all on function public.admin_projekt_testowy(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.admin_projekt_testowy(uuid, uuid, text, jsonb) to authenticated;
