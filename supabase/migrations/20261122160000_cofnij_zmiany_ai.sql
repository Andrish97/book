-- Cofnięcie zmian AI (plan H3): przywrócenie projektu do stanu sprzed ostatniej serii zmian zrobionych przez AI
-- (łącznik albo czat w Makietce). Korzysta z kopii awaryjnych (migracja 20261116190000_kopie_awaryjne.sql) – każdy
-- zapis AI zostawia tam stan sprzed zapisu (kto = 'AI').
--
-- Seria: ostatni zapis AI i wcześniejsze zapisy AI, między którymi minęło najwyżej 15 minut. Przywrócenie bierze
-- dane projektu sprzed najstarszego zapisu serii i każdą stronę zmienioną albo usuniętą od tego momentu (w jej
-- najstarszej kopii); strony dodane później znikają. Zmiany zrobione po serii (także przez ludzi) też się cofają –
-- dlatego funkcja podgladu podaje ich liczbę, aplikacja ostrzega, a AI musi zapytać użytkownika. Kopie serii
-- dostają kto = 'AI (cofnięte)', więc kolejne cofnięcie sięga do wcześniejszej serii.

-- Seria zmian AI projektu: { od, do, zapisow, pozniej, kopia (id najstarszej kopii serii) } albo null.
create or replace function public._seria_zmian_ai(p_projekt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k record;
  v_najnowsza public.projekty_kopie;
  v_najstarsza public.projekty_kopie;
  v_ile integer := 0;
  v_poprzednia timestamptz;
begin
  for k in select * from public.projekty_kopie where projekt_id = p_projekt and kto = 'AI' order by id desc loop
    if v_poprzednia is not null and v_poprzednia - k.utworzono > interval '15 minutes' then
      exit;
    end if;
    if v_najnowsza.id is null then v_najnowsza := k; end if;
    v_najstarsza := k;
    v_poprzednia := k.utworzono;
    v_ile := v_ile + 1;
  end loop;
  if v_najnowsza.id is null then
    return null;
  end if;
  return jsonb_build_object('od', v_najstarsza.utworzono, 'do', v_najnowsza.utworzono, 'zapisow', v_ile, 'kopia', v_najstarsza.id,
    'pozniej', (select count(*) from public.projekty_kopie where projekt_id = p_projekt and id > v_najnowsza.id and kto = 'urządzenie'));
end;
$$;

create or replace function public._cofnij_zmiany_ai(p_projekt uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seria jsonb;
  k public.projekty_kopie;
  p public.projekty;
  s record;
  v_strony integer := 0;
  v_kolejnosc text[];
begin
  v_seria := public._seria_zmian_ai(p_projekt);
  if v_seria is null then
    return jsonb_build_object('blad', 'W ostatnich 14 dniach AI nie zmieniało tego projektu – nie ma czego cofnąć.');
  end if;
  select * into k from public.projekty_kopie where id = (v_seria->>'kopia')::bigint;
  select * into p from public.projekty where id = p_projekt for update;
  perform set_config('makietka.kto', 'przywrócenie', true);
  -- strony zmienione albo usunięte od początku serii: najstarsza kopia każdej
  for s in select distinct on (strona_id) strona_id, dane from public.projekty_strony_kopie
            where projekt_id = p_projekt and txid >= k.txid
            order by strona_id, id loop
    insert into public.projekty_strony (projekt_id, strona_id, owner_id, dane)
      values (p.id, s.strona_id, p.owner_id, s.dane)
      on conflict (projekt_id, strona_id) do update set dane = excluded.dane;
    v_strony := v_strony + 1;
  end loop;
  update public.projekty set dane = coalesce(k.dane, dane), nazwa = coalesce(k.nazwa, nazwa), zmieniono = now(), wersja = wersja + 1
   where id = p.id;
  -- strony dodane po początku serii (nie ma ich w przywróconej kolejności) – znikają
  select coalesce(array_agg(coalesce(x->>'id', x#>>'{}')), '{}') into v_kolejnosc
    from jsonb_array_elements(case when jsonb_typeof(k.dane->'strony') = 'array' then k.dane->'strony' else '[]'::jsonb end) x;
  if coalesce((k.dane->>'strony_osobno')::boolean, false) then
    delete from public.projekty_strony where projekt_id = p.id and not (strona_id = any (v_kolejnosc));
  end if;
  -- obrazy przywróconego stanu nie mogą zniknąć przy sprzątaniu plików po AI
  delete from public.zasoby_do_usuniecia z
   where z.projekt_id = p.id
     and exists (select 1 from jsonb_each(case when jsonb_typeof(k.dane->'zasoby') = 'object' then k.dane->'zasoby' else '{}'::jsonb end) e
                  where e.value->>'sciezka' = z.sciezka);
  update public.projekty_kopie set kto = 'AI (cofnięte)'
   where projekt_id = p.id and kto = 'AI' and id >= k.id;
  return jsonb_build_object('ok', true, 'od', v_seria->'od', 'do', v_seria->'do', 'zapisow', v_seria->'zapisow', 'pozniej', v_seria->'pozniej',
    'strony', v_strony, 'wersja', (select wersja from public.projekty where id = p.id));
end;
$$;
revoke all on function public._seria_zmian_ai(uuid), public._cofnij_zmiany_ai(uuid) from public, anon, authenticated;

-- Aplikacja: właściciel albo współpracownik z prawem zmian.
create or replace function public._moze_zmieniac(p_projekt uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.projekty where id = p_projekt and owner_id = auth.uid())
      or exists (select 1 from public.wspolpracownicy where projekt_id = p_projekt and uzytkownik = auth.uid() and rola = 'edycja');
$$;
revoke all on function public._moze_zmieniac(uuid) from public, anon, authenticated;

create or replace function public.zmiany_ai_projektu(p_projekt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  if auth.uid() is null or not public._moze_zmieniac(p_projekt) then
    raise exception 'Brak dostępu do projektu.';
  end if;
  v := public._seria_zmian_ai(p_projekt);
  return case when v is null then null else v - 'kopia' end;
end;
$$;
revoke all on function public.zmiany_ai_projektu(uuid) from public, anon;
grant execute on function public.zmiany_ai_projektu(uuid) to authenticated;

create or replace function public.cofnij_zmiany_ai(p_projekt uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public._moze_zmieniac(p_projekt) then
    raise exception 'Brak dostępu do projektu.';
  end if;
  return public._cofnij_zmiany_ai(p_projekt);
end;
$$;
revoke all on function public.cofnij_zmiany_ai(uuid) from public, anon;
grant execute on function public.cofnij_zmiany_ai(uuid) to authenticated;

-- Łącznik AI: projekt z klucza, klucz, który czyta i zmienia. p_tylko_sprawdz – sama informacja o serii.
create or replace function public.ai_cofnij_zmiany(p_klucz text, p_tylko_sprawdz boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  v jsonb;
begin
  d := public.ai_sprawdz_klucz(p_klucz, true, true);
  if d ? 'blad' then
    return d;
  end if;
  if p_tylko_sprawdz then
    v := public._seria_zmian_ai((d->>'projekt_id')::uuid);
    return coalesce(v - 'kopia', jsonb_build_object('brak', true));
  end if;
  return public._cofnij_zmiany_ai((d->>'projekt_id')::uuid);
end;
$$;
revoke all on function public.ai_cofnij_zmiany(text, boolean) from public;
grant execute on function public.ai_cofnij_zmiany(text, boolean) to anon, authenticated;
