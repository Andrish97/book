-- Migracja: miejsce na koncie, sprzątanie osieroconych plików i mniej pobierania (decyzja #89).
--
-- Darmowy plan Supabase: pliki (Storage) 1 GB, baza 500 MB, transfer ok. 5 GB miesięcznie – na całą aplikację.
-- Pierwszy kończy się zwykle limit plików (zdjęcia po kilka–kilkanaście MB), więc:
--  1. miejsce_na_koncie() – ile zajmują pliki zalogowanego (obrazy, czcionki, podglądy linków, pliki linków
--     chronionych i obrazy od AI czekające w bazie) i ile zajmuje cała aplikacja (sam agregat – bez nazw ani
--     rozmiarów cudzych plików) wobec limitów planu;
--  2. pliki_osierocone() – pliki zalogowanego w Storage, na które nie wskazuje żaden projekt (stare wersje
--     zdjęć po podmianie i zmianie nazwy, pliki usuniętych projektów, podglądy wyłączonych linków). Usuwa je
--     aplikacja właściciela przez Storage API (bezpośredni DELETE na storage.objects jest zablokowany);
--  3. posprzataj_konto() – to, co baza może usunąć sama: porzucone wgrania obrazów od AI (z kawałkami),
--     obrazy od AI, których żaden projekt już nie używa, i pliki linków chronionych, których projekt nie ma;
--  4. projekty_strony.skrot – skrót treści strony liczony przez bazę; łączenie zmian z konta pobiera
--     najpierw same skróty i ściąga tylko strony, które się zmieniły (zamiast całego projektu przy każdej
--     zmianie z innego urządzenia albo od AI).
--
-- Bezpieczeństwo przy sprzątaniu: plik jest osierocony dopiero, gdy nie wskazuje na niego ŻADEN projekt
-- (także projekt innego konta – współdzielony) i od ostatniej zmiany pliku minęły 2 dni (świeżo wysłany plik
-- może jeszcze czekać na zapis projektu, który go wskaże). Czcionki konta (<konto>/_czcionki/) nie są
-- sprzątane – ich spis jest w pliku, którego baza nie czyta. Historia cofania jest tylko na urządzeniu.

-- ---------- 1. Miejsce ----------

create or replace function public.miejsce_na_koncie()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prefiks text;
  v_moje jsonb;
  v_chronione bigint;
  v_ai bigint;
  v_pliki_razem bigint;
  v_baza bigint;
begin
  if v_uid is null then
    raise exception 'Brak sesji';
  end if;
  v_prefiks := v_uid::text || '/';
  select jsonb_build_object(
      'obrazy', coalesce(sum((o.metadata->>'size')::bigint) filter (where o.bucket_id = 'zasoby' and o.name not like v_prefiks || '\_czcionki/%'), 0),
      'czcionki', coalesce(sum((o.metadata->>'size')::bigint) filter (where o.bucket_id = 'zasoby' and o.name like v_prefiks || '\_czcionki/%'), 0),
      'podglady', coalesce(sum((o.metadata->>'size')::bigint) filter (where o.bucket_id = 'podglady'), 0),
      'plikow', count(*))
    into v_moje
    from storage.objects o
    where o.bucket_id in ('zasoby', 'podglady') and o.name like v_prefiks || '%';
  select coalesce(sum(octet_length(f.dane)), 0) into v_chronione from public.udostepnienia_pliki f where f.owner_id = v_uid;
  select coalesce(sum(octet_length(a.dane)), 0) + coalesce(sum((select sum(octet_length(c.dane)) from public.obrazy_ai_czesci c where c.wiersz = a.id)), 0)
    into v_ai
    from public.obrazy_ai a where a.owner_id = v_uid;
  select coalesce(sum((o.metadata->>'size')::bigint), 0) into v_pliki_razem
    from storage.objects o where o.bucket_id in ('zasoby', 'podglady');
  begin
    v_baza := pg_database_size(current_database());
  exception when others then
    v_baza := null;
  end;
  return v_moje || jsonb_build_object(
    'chronione', v_chronione,
    'od_ai', v_ai,
    'pliki_razem', v_pliki_razem,
    'baza_razem', v_baza,
    'limit_plikow', 1073741824,
    'limit_bazy', 524288000);
end;
$$;

revoke all on function public.miejsce_na_koncie() from public;
grant execute on function public.miejsce_na_koncie() to authenticated;

-- ---------- 2. Osierocone pliki w Storage ----------

-- Zwraca [{ bucket, nazwa, rozmiar }] – pliki zalogowanego, które można usunąć.
create or replace function public.pliki_osierocone()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prefiks text;
  v_wynik jsonb;
begin
  if v_uid is null then
    raise exception 'Brak sesji';
  end if;
  v_prefiks := v_uid::text || '/';
  with odwolania as (
    -- Ścieżki plików, na które wskazuje jakikolwiek projekt (także cudzy, współdzielony).
    select distinct z.value->>'sciezka' as sciezka
      from public.projekty p,
           jsonb_each(case when jsonb_typeof(p.dane->'zasoby') = 'object' then p.dane->'zasoby' else '{}'::jsonb end) z
      where z.value->>'sciezka' like v_prefiks || '%'
  ), linki as (
    -- Foldery podglądów linków, które projekty dziś mają (<konto>/<projekt>/<kod>/).
    select p.owner_id::text || '/' || p.id::text || '/' || (p.dane->'udostepnienie'->>'kod') || '/' as folder
      from public.projekty p
      where p.owner_id = v_uid and coalesce(p.dane->'udostepnienie'->>'kod', '') <> ''
  )
  select coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'nazwa', o.name, 'rozmiar', coalesce((o.metadata->>'size')::bigint, 0)) order by o.bucket_id, o.name), '[]'::jsonb)
    into v_wynik
    from storage.objects o
    where o.bucket_id in ('zasoby', 'podglady')
      and o.name like v_prefiks || '%'
      and coalesce(o.updated_at, o.created_at) < now() - interval '2 days'
      and (
        (o.bucket_id = 'zasoby'
          and o.name not like v_prefiks || '\_czcionki/%'
          and not exists (select 1 from odwolania x where x.sciezka = o.name))
        or (o.bucket_id = 'podglady'
          and not exists (select 1 from linki l where o.name like l.folder || '%'))
      );
  return v_wynik;
end;
$$;

revoke all on function public.pliki_osierocone() from public;
grant execute on function public.pliki_osierocone() to authenticated;

-- ---------- 3. Sprzątanie w bazie ----------

-- p_policz: true – tylko policz, nic nie usuwaj. Zwraca { ai, ai_bajty, linki, linki_bajty }.
create or replace function public.posprzataj_konto(p_policz boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ai uuid[];
  v_ai_bajty bigint;
  v_linki integer;
  v_linki_bajty bigint;
begin
  if v_uid is null then
    raise exception 'Brak sesji';
  end if;
  -- Obrazy od AI: porzucone wgrania (niedokończone od doby) i gotowe, których żaden projekt nie używa od 2 dni.
  select coalesce(array_agg(a.id), '{}'),
         coalesce(sum(coalesce(octet_length(a.dane), 0) + coalesce((select sum(octet_length(c.dane)) from public.obrazy_ai_czesci c where c.wiersz = a.id), 0)), 0)
    into v_ai, v_ai_bajty
    from public.obrazy_ai a
    where a.owner_id = v_uid
      and (
        (not a.gotowy and a.utworzono < now() - interval '1 day')
        or (a.gotowy and a.utworzono < now() - interval '2 days'
            and not exists (
              select 1 from public.projekty p,
                jsonb_each(case when jsonb_typeof(p.dane->'zasoby') = 'object' then p.dane->'zasoby' else '{}'::jsonb end) z
              where p.id = a.projekt_id and z.value->>'sciezka' = 'ai:' || a.id::text))
      );
  -- Linki chronione, których projekt już nie ma albo ma inny kod (link wyłączony albo zmieniony) – od 2 dni.
  select count(*), coalesce(sum((select coalesce(sum(octet_length(f.dane)), 0) from public.udostepnienia_pliki f
                                  where f.owner_id = u.owner_id and f.projekt_id = u.projekt_id and f.kod = u.kod)), 0)
    into v_linki, v_linki_bajty
    from public.udostepnienia u
    where u.owner_id = v_uid
      and u.zmieniono < now() - interval '2 days'
      and not exists (select 1 from public.projekty p where p.id = u.projekt_id and p.dane->'udostepnienie'->>'kod' = u.kod);
  if not coalesce(p_policz, false) then
    delete from public.obrazy_ai where id = any(v_ai);
    delete from public.udostepnienia u
      where u.owner_id = v_uid
        and u.zmieniono < now() - interval '2 days'
        and not exists (select 1 from public.projekty p where p.id = u.projekt_id and p.dane->'udostepnienie'->>'kod' = u.kod);
  end if;
  return jsonb_build_object('ai', coalesce(array_length(v_ai, 1), 0), 'ai_bajty', v_ai_bajty, 'linki', v_linki, 'linki_bajty', v_linki_bajty);
end;
$$;

revoke all on function public.posprzataj_konto(boolean) from public;
grant execute on function public.posprzataj_konto(boolean) to authenticated;

-- ---------- 4. Skrót treści strony ----------

-- Liczony przez bazę przy każdym zapisie strony, niezależnie od tego, która funkcja ją zapisuje.
alter table public.projekty_strony
  add column if not exists skrot text generated always as (md5(dane::text)) stored;
