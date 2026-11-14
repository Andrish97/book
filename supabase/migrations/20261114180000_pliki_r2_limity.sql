-- Migracja: pliki w Cloudflare R2 i limity kont (decyzja #92).
--
-- Pliki (obrazy i czcionki projektów, „Moje czcionki”, obrazy stron linków) przechodzą z Supabase Storage do
-- Cloudflare R2 za przekaźnikiem api.makietka.app (cloudflare/api-worker.js). Baza przestaje liczyć pliki
-- (storage.objects) – robi to Worker. Zostaje tu to, co dotyczy bazy:
--   * odwolania_plikow()  – ścieżki plików, na które wskazują projekty (dla sprzątania osieroconych plików w R2),
--   * miejsce_na_koncie() – już bez plików: linki z hasłem, obrazy od AI w drodze, rozmiar bazy, projekty i limity,
--   * limity_aplikacji()  – limity sprawdzane w bazie (projekty na konto, osoby w projekcie, obrazy w projekcie).
-- Reguły Supabase Storage zostają do czasu, aż aplikacje użytkowników przeniosą stare pliki (jednorazowe
-- przeniesienie przy zalogowaniu – js/przeniesienie-plikow.js); potem do usunięcia razem z tym kodem.

-- ---------- Limity ----------

-- Jedno miejsce w bazie: zmiana wartości – nowa migracja z tą funkcją.
create or replace function public.limity_aplikacji()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'projekty', 30,             -- własne projekty jednego konta
    'osoby_w_projekcie', 10,    -- współpracownicy i czekające zaproszenia razem
    'obrazy_w_projekcie', 300   -- obrazy (pliki) w jednym projekcie; sprawdza aplikacja i łącznik AI
  );
$$;

grant execute on function public.limity_aplikacji() to anon, authenticated;

-- Nowy projekt ponad limit – czytelny błąd (aplikacja pokazuje go przy „Nowy projekt”, „Duplikuj”, „Importuj”).
create or replace function public.pilnuj_limitu_projektow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := (public.limity_aplikacji()->>'projekty')::integer;
begin
  if (select count(*) from public.projekty p where p.owner_id = new.owner_id) >= v_limit then
    raise exception 'limit_projektow: Masz już % projektów – to limit jednego konta. Usuń albo wyeksportuj do pliku projekt, którego nie potrzebujesz, żeby założyć nowy.', v_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists pilnuj_limitu_projektow on public.projekty;
create trigger pilnuj_limitu_projektow before insert on public.projekty
  for each row execute function public.pilnuj_limitu_projektow();

-- Osoby w projekcie: współpracownicy + czekające zaproszenia, razem najwyżej limit.
create or replace function public.osob_w_projekcie(p_projekt uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.wspolpracownicy w where w.projekt_id = p_projekt)::integer
       + (select count(*) from public.zaproszenia z where z.projekt_id = p_projekt and z.stan = 'czeka' and z.wazne_do > now())::integer;
$$;

revoke all on function public.osob_w_projekcie(uuid) from public, anon;

create or replace function public.pilnuj_limitu_osob()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := (public.limity_aplikacji()->>'osoby_w_projekcie')::integer;
begin
  -- Przyjęcie zaproszenia: zaproszenie zaraz zmieni stan, więc nowa osoba już jest policzona.
  if tg_table_name = 'wspolpracownicy' then
    if (select count(*) from public.wspolpracownicy w where w.projekt_id = new.projekt_id) >= v_limit then
      raise exception 'limit_osob: W projekcie jest już % osób – to limit jednego projektu.', v_limit using errcode = 'P0001';
    end if;
  elsif public.osob_w_projekcie(new.projekt_id) >= v_limit then
    raise exception 'limit_osob: W projekcie jest już % osób razem z zaproszonymi – to limit jednego projektu. Cofnij niepotrzebne zaproszenie albo odbierz komuś dostęp.', v_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists pilnuj_limitu_osob on public.wspolpracownicy;
create trigger pilnuj_limitu_osob before insert on public.wspolpracownicy
  for each row execute function public.pilnuj_limitu_osob();
drop trigger if exists pilnuj_limitu_osob on public.zaproszenia;
create trigger pilnuj_limitu_osob before insert on public.zaproszenia
  for each row execute function public.pilnuj_limitu_osob();

-- ---------- Odwołania do plików (sprzątanie w R2) ----------

-- { sciezki: [ścieżki plików konta, na które wskazuje jakikolwiek projekt – także cudzy, współdzielony],
--   linki: [foldery obrazów stron linków, które projekty konta dziś mają: <konto>/<projekt>/<kod>/] }.
-- Woła ją Worker tokenem zalogowanego (GET /pliki/_osierocone).
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
      select jsonb_agg(p.owner_id::text || '/' || p.id::text || '/' || (p.dane->'udostepnienie'->>'kod') || '/')
        from public.projekty p
        where p.owner_id = v_uid and coalesce(p.dane->'udostepnienie'->>'kod', '') <> ''), '[]'::jsonb));
end;
$$;

revoke all on function public.odwolania_plikow() from public, anon;
grant execute on function public.odwolania_plikow() to authenticated;

-- Pliki liczy i sprząta teraz Worker – stara funkcja (storage.objects) znika.
drop function if exists public.pliki_osierocone();

-- ---------- Miejsce: to, co w bazie ----------

-- { chronione, od_ai, baza_razem, limit_bazy, projekty, limit_projektow, osoby_w_projekcie, obrazy_w_projekcie }.
-- Pliki (obrazy, czcionki, obrazy stron linków) – GET /pliki/_miejsce w Workerze.
create or replace function public.miejsce_na_koncie()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_chronione bigint;
  v_ai bigint;
  v_baza bigint;
  v_limity jsonb := public.limity_aplikacji();
begin
  if v_uid is null then
    raise exception 'Brak sesji';
  end if;
  select coalesce(sum(octet_length(f.dane)), 0) into v_chronione from public.udostepnienia_pliki f where f.owner_id = v_uid;
  select coalesce(sum(octet_length(a.dane)), 0) + coalesce(sum((select sum(octet_length(c.dane)) from public.obrazy_ai_czesci c where c.wiersz = a.id)), 0)
    into v_ai
    from public.obrazy_ai a where a.owner_id = v_uid;
  begin
    v_baza := pg_database_size(current_database());
  exception when others then
    v_baza := null;
  end;
  return jsonb_build_object(
    'chronione', v_chronione,
    'od_ai', v_ai,
    'baza_razem', v_baza,
    'limit_bazy', 524288000,
    'projekty', (select count(*) from public.projekty p where p.owner_id = v_uid),
    'limit_projektow', (v_limity->>'projekty')::integer,
    'osoby_w_projekcie', (v_limity->>'osoby_w_projekcie')::integer,
    'obrazy_w_projekcie', (v_limity->>'obrazy_w_projekcie')::integer);
end;
$$;

revoke all on function public.miejsce_na_koncie() from public;
grant execute on function public.miejsce_na_koncie() to authenticated;

-- ---------- Panel użycia konta (decyzja #93) ----------

-- Projekty zalogowanego z tym, co zajmują w bazie, i projekty innych osób, do których ma dostęp (te nie liczą się
-- do jego limitów). Bez danych innych kont poza nazwą właściciela projektu, który i tak widać na liście projektów.
-- { wlasne: [{ id, nazwa, zmieniono, obrazy, strony, dane_bajty, klucze_ai, link, link_chroniony }],
--   u_innych: [{ id, nazwa, zmieniono, obrazy, strony, rola, wlasciciel }] }
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
                          where d.projekt_id = p.id and d.odwolany is null and d.wazny_do > now()),
          'link', coalesce(p.dane->'udostepnienie'->>'kod', '') <> '',
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

-- Obrazy w danych projektu: wpisy „zasoby” bez plików czcionek projektu (dane->czcionki[].id).
create or replace function public.obrazy_w_danych(p_dane jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer
    from jsonb_object_keys(case when jsonb_typeof(p_dane->'zasoby') = 'object' then p_dane->'zasoby' else '{}'::jsonb end) k
    where k not in (select c->>'id' from jsonb_array_elements(case when jsonb_typeof(p_dane->'czcionki') = 'array' then p_dane->'czcionki' else '[]'::jsonb end) c
                    where c->>'id' is not null);
$$;

revoke all on function public.uzycie_projektow() from public, anon;
grant execute on function public.uzycie_projektow() to authenticated;
