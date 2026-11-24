-- Migracja: kilka niezależnych linków podglądu w jednym projekcie (decyzja #426).
--
-- „Zróbmy, żeby jeden projekt mógł mieć kilka niezależnych linków do podglądu. Dodajemy je jak np. teraz klucze AI.
-- Możemy mieć tam różne ustawienia, np. znak wodny czy ustawienia 3D oraz hasło.”
--
-- Linki (pliki, ochrona) są już rozróżniane kodem linku (udostepnienia: owner_id, projekt_id, kod). Jeden na
-- projekt był tylko krótki kod (krotkie_linki.projekt unique, a krotki_link_utworz kasował krótkie kody innych
-- linków projektu). Teraz: krótki kod na każdy link projektu; usunięcie jednego linku – krotki_link_usun_kod.

alter table public.krotkie_linki drop constraint if exists krotkie_linki_projekt_key;
create unique index if not exists krotkie_linki_projekt_kod_linku on public.krotkie_linki (projekt, kod_linku);

-- Właściciel: krótki kod dla linku projektu (ten sam przy ponownym wywołaniu); inne linki projektu zostają.
create or replace function public.krotki_link_utworz(p_projekt uuid, p_kod_linku text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_kod text;
  v_znaki constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_bajty bytea;
  i integer;
  proba integer := 0;
begin
  if v_uid is null then raise exception 'Brak sesji' using errcode = '28000'; end if;
  if coalesce(p_kod_linku, '') = '' then raise exception 'Brak kodu linku'; end if;
  if not exists (select 1 from public.projekty where id = p_projekt and owner_id = v_uid) then
    raise exception 'Nie masz dostępu do tego projektu' using errcode = '42501';
  end if;
  select kod into v_kod from public.krotkie_linki where projekt = p_projekt and kod_linku = p_kod_linku;
  if v_kod is not null then return v_kod; end if;
  loop
    proba := proba + 1;
    v_bajty := extensions.gen_random_bytes(6);
    v_kod := '';
    for i in 0..5 loop
      v_kod := v_kod || substr(v_znaki, (get_byte(v_bajty, i) % 31) + 1, 1);
    end loop;
    begin
      insert into public.krotkie_linki (kod, projekt, konto, kod_linku) values (v_kod, p_projekt, v_uid, p_kod_linku);
      return v_kod;
    exception when unique_violation then
      if proba > 20 then raise; end if;
    end;
  end loop;
end;
$$;
revoke all on function public.krotki_link_utworz(uuid, text) from public;
grant execute on function public.krotki_link_utworz(uuid, text) to authenticated;

-- Właściciel: usuwa krótki kod jednego linku projektu (unieważnienie tego linku).
create or replace function public.krotki_link_usun_kod(p_projekt uuid, p_kod_linku text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.krotkie_linki where projekt = p_projekt and kod_linku = p_kod_linku and konto = auth.uid();
$$;
revoke all on function public.krotki_link_usun_kod(uuid, text) from public;
grant execute on function public.krotki_link_usun_kod(uuid, text) to authenticated;

-- Kody wszystkich linków projektu: dawne pole udostepnienie i lista udostepnienia (#426).
create or replace function public.kody_linkow(p_dane jsonb)
returns setof text
language sql
immutable
set search_path = ''
as $$
  select x from (
    select p_dane->'udostepnienie'->>'kod' as x
    union
    select l->>'kod'
      from jsonb_array_elements(case when jsonb_typeof(p_dane->'udostepnienia') = 'array' then p_dane->'udostepnienia' else '[]'::jsonb end) l
  ) k
  where coalesce(x, '') <> '';
$$;

-- ai_projekt: z 20261112090000_obrazy_ai.sql, kody linków z public.kody_linkow (#426).
create or replace function public.ai_projekt(p_klucz text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  p public.projekty%rowtype;
  v_dane jsonb;
  v_strony jsonb;
begin
  d := public.ai_sprawdz_klucz(p_klucz, false);
  if d ? 'blad' then
    return d;
  end if;
  select * into p from public.projekty where id = (d->>'projekt_id')::uuid;
  if not found then
    return jsonb_build_object('blad', 'Projektu już nie ma.');
  end if;
  v_dane := p.dane;
  if coalesce((v_dane->>'strony_osobno')::boolean, false) then
    select coalesce(jsonb_agg(s.dane order by k.nr), '[]'::jsonb) into v_strony
      from jsonb_array_elements_text(coalesce(v_dane->'strony', '[]'::jsonb)) with ordinality as k(id, nr)
      join public.projekty_strony s on s.projekt_id = p.id and s.strona_id = k.id;
  else
    v_strony := coalesce(v_dane->'strony', '[]'::jsonb);
  end if;
  v_dane := (v_dane - 'strony_osobno' - 'podstawa_chmury' - 'wersja_chmury' - 'miniatura' - 'udostepnienie' - 'udostepnienia')
    || jsonb_build_object(
      'strony', v_strony,
      'zasoby', coalesce((select jsonb_object_agg(z.key, jsonb_strip_nulls(jsonb_build_object(
                            'nazwa', z.value->>'nazwa', 'typ', z.value->>'typ',
                            'szer', z.value->'szer', 'wys', z.value->'wys', 'rozmiar', z.value->'rozmiar', 'skrot', z.value->'skrot')))
                          from jsonb_each(coalesce(v_dane->'zasoby', '{}'::jsonb)) z), '{}'::jsonb));
  return jsonb_build_object(
    'dostep', jsonb_build_object('rola', d->>'rola', 'opis', d->>'opis', 'wazny_do', d->'wazny_do'),
    'wersja', p.wersja,
    'projekt', v_dane);
end;
$$;

-- ai_nowy_projekt: z 20261114200000_klucze_ai_konta.sql, kody linków z public.kody_linkow (#426).
create or replace function public.ai_nowy_projekt(p_klucz text, p_id uuid, p_nazwa text, p_dane jsonb, p_strony jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  v_owner uuid;
  v_ids text[];
  v_sekcje text[];
  x jsonb;
begin
  d := public.ai_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if d->>'zakres' <> 'pelny' or d->>'rola' <> 'edycja' then
    return jsonb_build_object('blad', 'Tworzyć projekty może tylko klucz z pełnym dostępem, który czyta i zmienia (ustawienia konta → Dostęp dla AI).');
  end if;
  v_owner := (d->>'owner_id')::uuid;
  if p_id is null or exists (select 1 from public.projekty where id = p_id) then
    return jsonb_build_object('blad', 'Nieprawidłowy albo zajęty identyfikator projektu.');
  end if;
  if p_nazwa is null or length(trim(p_nazwa)) = 0 or length(p_nazwa) > 120 then
    return jsonb_build_object('blad', 'Nazwa projektu: niepusty tekst do 120 znaków.');
  end if;
  if jsonb_typeof(p_dane) <> 'object' then
    return jsonb_build_object('blad', 'Dane projektu muszą być obiektem JSON.');
  end if;
  v_ids := public.ai_identyfikatory(p_strony);
  v_sekcje := public.ai_identyfikatory(coalesce(p_dane->'sekcje', '[]'::jsonb));
  if v_ids is null or cardinality(v_ids) = 0 then
    return jsonb_build_object('blad', 'Projekt musi mieć co najmniej jedną stronę (lista obiektów z niepowtarzalnym „id”).');
  end if;
  if v_sekcje is null or cardinality(v_sekcje) = 0 then
    return jsonb_build_object('blad', 'Projekt musi mieć co najmniej jedną sekcję.');
  end if;
  for x in select * from jsonb_array_elements(p_strony) loop
    if not ((x->>'sekcja') = any(v_sekcje)) then
      return jsonb_build_object('blad', format('Strona „%s”: „sekcja” musi wskazywać istniejącą sekcję.', x->>'id'));
    end if;
  end loop;
  if octet_length(p_dane::text) + octet_length(p_strony::text) > 8000000 then
    return jsonb_build_object('blad', 'Projekt jest za duży (ponad 8 MB naraz).');
  end if;
  begin
    insert into public.projekty (id, owner_id, nazwa, dane, zmieniono, wersja)
    values (p_id, v_owner, trim(p_nazwa),
            (p_dane - 'strony' - 'strony_osobno' - 'udostepnienie' - 'udostepnienia' - 'podstawa_chmury' - 'wersja_chmury')
              || jsonb_build_object('id', p_id, 'nazwa', trim(p_nazwa), 'strony', to_jsonb(v_ids), 'strony_osobno', true,
                                    'zasoby', '{}'::jsonb, 'zmieniono', to_jsonb(now())),
            now(), 1);
    insert into public.projekty_strony (projekt_id, strona_id, owner_id, dane)
      select p_id, s->>'id', v_owner, s from jsonb_array_elements(p_strony) s;
  exception when others then
    return jsonb_build_object('blad', 'Nie udało się utworzyć projektu: ' || sqlerrm);
  end;
  return jsonb_build_object('id', p_id, 'nazwa', trim(p_nazwa), 'wersja', 1);
end;
$$;

-- ai_kopiuj_projekt: z 20261122140000_kopia_projektu_ai.sql, kody linków z public.kody_linkow (#426).
create or replace function public.ai_kopiuj_projekt(p_klucz text, p_projekt uuid, p_nowy uuid, p_nazwa text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  v_owner uuid;
  src public.projekty%rowtype;
  v_nazwa text;
  v_zasoby jsonb;
  z record;
  o public.obrazy_ai%rowtype;
  v_nowy_obraz uuid;
  v_obrazy integer := 0;
  v_stron integer;
begin
  d := public.ai_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if d->>'zakres' <> 'pelny' or d->>'rola' <> 'edycja' then
    return jsonb_build_object('blad', 'Kopiować projekty może tylko klucz z pełnym dostępem, który czyta i zmienia (ustawienia konta → Dostęp dla AI).');
  end if;
  v_owner := (d->>'owner_id')::uuid;
  select * into src from public.projekty where id = p_projekt;
  if not found or src.owner_id <> v_owner then
    return jsonb_build_object('blad', 'Skopiować można tylko własny projekt konta.');
  end if;
  if p_nowy is null or exists (select 1 from public.projekty where id = p_nowy) then
    return jsonb_build_object('blad', 'Nieprawidłowy albo zajęty identyfikator kopii.');
  end if;
  v_nazwa := trim(coalesce(nullif(trim(p_nazwa), ''), src.nazwa || ' (kopia)'));
  if length(v_nazwa) > 120 then
    return jsonb_build_object('blad', 'Nazwa projektu: do 120 znaków.');
  end if;
  v_zasoby := case when jsonb_typeof(src.dane->'zasoby') = 'object' then src.dane->'zasoby' else '{}'::jsonb end;
  begin
    insert into public.projekty (id, owner_id, nazwa, dane, zmieniono, wersja)
    values (p_nowy, v_owner, v_nazwa,
            (src.dane - 'udostepnienie' - 'udostepnienia' - 'podstawa_chmury' - 'wersja_chmury' - 'wspolpraca_chmury')
              || jsonb_build_object('id', p_nowy, 'nazwa', v_nazwa, 'zmieniono', to_jsonb(now())),
            now(), 1);
    insert into public.projekty_strony (projekt_id, strona_id, owner_id, dane)
      select p_nowy, s.strona_id, v_owner, s.dane from public.projekty_strony s where s.projekt_id = src.id;
    get diagnostics v_stron = row_count;
    -- obrazy od AI z tabeli: własny wiersz (i kawałki) dla kopii
    for z in select key, value from jsonb_each(v_zasoby) where value->>'sciezka' like 'ai:%' loop
      select * into o from public.obrazy_ai where id::text = substr(z.value->>'sciezka', 4) and owner_id = v_owner;
      if not found then
        continue;
      end if;
      v_nowy_obraz := gen_random_uuid();
      insert into public.obrazy_ai (id, projekt_id, owner_id, nazwa, typ, rozmiar, skrot, dane, utworzono, czesci, gotowy, szer, wys, zastap, nazwa_prosba)
        values (v_nowy_obraz, p_nowy, v_owner, o.nazwa, o.typ, o.rozmiar, o.skrot, o.dane, now(), o.czesci, o.gotowy, o.szer, o.wys, null, o.nazwa_prosba);
      insert into public.obrazy_ai_czesci (wiersz, nr, dane)
        select v_nowy_obraz, c.nr, c.dane from public.obrazy_ai_czesci c where c.wiersz = o.id;
      v_zasoby := jsonb_set(v_zasoby, array[z.key, 'sciezka'], to_jsonb('ai:' || v_nowy_obraz::text));
      v_obrazy := v_obrazy + 1;
    end loop;
    update public.projekty set dane = jsonb_set(dane, '{zasoby}', v_zasoby) where id = p_nowy;
  exception when others then
    return jsonb_build_object('blad', case when sqlerrm like 'limit_projektow:%' then substr(sqlerrm, 18) else 'Nie udało się skopiować projektu: ' || sqlerrm end);
  end;
  return jsonb_build_object('id', p_nowy, 'nazwa', v_nazwa, 'stron', v_stron,
    'obrazy', (select count(*) from jsonb_object_keys(v_zasoby)), 'obrazy_ai', v_obrazy);
end;
$$;

-- odwolania_plikow: z 20261114220000_linki_chronione_r2_porzadki.sql, kody linków z public.kody_linkow (#426).
create or replace function public.odwolania_plikow()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prefiks text;
begin
  if v_uid is null then
    raise exception 'Brak sesji';
  end if;
  v_prefiks := v_uid::text || '/';
  return jsonb_build_object(
    'sciezki', coalesce((
      select jsonb_agg(distinct z.value->>'sciezka')
        from public.projekty p,
             jsonb_each(case when jsonb_typeof(p.dane->'zasoby') = 'object' then p.dane->'zasoby' else '{}'::jsonb end) z
        where z.value->>'sciezka' like v_prefiks || '%'), '[]'::jsonb),
    'linki', coalesce((
      select jsonb_agg(x.l) from (
        select p.owner_id::text || '/' || p.id::text || '/' || k.kod || '/' as l
          from public.projekty p cross join lateral public.kody_linkow(p.dane) k(kod)
         where p.owner_id = v_uid
        union all
        select u.owner_id::text || '/' || u.projekt_id::text || '/' || u.kod || '.' || u.sekret || '/'
          from public.udostepnienia u
         where u.owner_id = v_uid and u.sekret is not null) x), '[]'::jsonb));
end;
$$;

-- posprzataj_konto: z 20261114220000_linki_chronione_r2_porzadki.sql, kody linków z public.kody_linkow (#426).
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
  select count(*) into v_linki
    from public.udostepnienia u
    where u.owner_id = v_uid
      and u.zmieniono < now() - interval '2 days'
      and not exists (select 1 from public.projekty p where p.id = u.projekt_id and u.kod in (select public.kody_linkow(p.dane)));
  if not coalesce(p_policz, false) then
    delete from public.obrazy_ai where id = any(v_ai);
    delete from public.udostepnienia u
      where u.owner_id = v_uid
        and u.zmieniono < now() - interval '2 days'
        and not exists (select 1 from public.projekty p where p.id = u.projekt_id and u.kod in (select public.kody_linkow(p.dane)));
  end if;
  return jsonb_build_object('ai', coalesce(array_length(v_ai, 1), 0), 'ai_bajty', v_ai_bajty, 'linki', v_linki, 'linki_bajty', 0);
end;
$$;

-- pliki_osierocone: z 20261114150000_miejsce_na_koncie.sql, kody linków z public.kody_linkow (#426).
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
    select p.owner_id::text || '/' || p.id::text || '/' || k.kod || '/' as folder
      from public.projekty p cross join lateral public.kody_linkow(p.dane) k(kod)
      where p.owner_id = v_uid
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

-- uzycie_projektow: z 20261114200000_klucze_ai_konta.sql, kody linków z public.kody_linkow (#426).
create or replace function public.uzycie_projektow()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Brak sesji';
  end if;
  return jsonb_build_object(
    'wlasne', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id, 'nazwa', p.nazwa, 'zmieniono', p.zmieniono,
          'obrazy', public.obrazy_w_danych(p.dane),
          'strony', case when jsonb_typeof(p.dane->'strony') = 'array' then jsonb_array_length(p.dane->'strony') else 0 end,
          'dane_bajty', pg_column_size(p.dane) + coalesce((select sum(pg_column_size(s.dane)) from public.projekty_strony s where s.projekt_id = p.id), 0),
          'klucze_ai', (select count(*) from public.dostepy_projektu d
                          where d.owner_id = v_uid and (d.zakres = 'pelny' or p.id = any(d.projekty))
                            and d.odwolany is null and d.wazny_do > now()),
          'link', exists (select 1 from public.kody_linkow(p.dane)),
          'link_chroniony', exists (select 1 from public.udostepnienia u where u.projekt_id = p.id and u.owner_id = v_uid))
        order by p.zmieniono desc)
        from public.projekty p where p.owner_id = v_uid), '[]'::jsonb),
    'u_innych', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id, 'nazwa', p.nazwa, 'zmieniono', p.zmieniono, 'rola', w.rola,
          'obrazy', public.obrazy_w_danych(p.dane),
          'strony', case when jsonb_typeof(p.dane->'strony') = 'array' then jsonb_array_length(p.dane->'strony') else 0 end,
          'wlasciciel', coalesce(nullif(btrim(u.raw_user_meta_data->>'nazwa'), ''), split_part(u.email, '@', 1)))
        order by p.zmieniono desc)
        from public.wspolpracownicy w
        join public.projekty p on p.id = w.projekt_id
        left join auth.users u on u.id = p.owner_id
        where w.uzytkownik = v_uid), '[]'::jsonb));
end;
$$;
