-- Migracja: linki z hasłem w R2 zamiast w bazie i porządki w bazie (decyzja #97).
--
-- Pomiar na żywej bazie (rozmiary_tabel): baza 143 MB, z czego public.udostepnienia_pliki 129 MB (919 wierszy –
-- obrazy stron linków z hasłem albo z datą ważności w bytea). Wszystko inne – poniżej 2 MB.
--
-- Teraz obrazy stron linku z ochroną leżą w R2 (Worker api.makietka.app, ścieżka publiczna
-- /podglady/<konto>/<projekt>/<kod>.<sekret>/…), tak jak zwykłe linki. Chroni je niezgadywalny sekret
-- (24 losowe bajty, base64url) – zna go tylko właściciel i ten, kto podał dobre hasło
-- (funkcja podglad_chroniony zwraca nazwę folderu zamiast treści plików). Zmiana hasła daje nowy sekret
-- (stare adresy przestają działać – aplikacja właściciela usuwa stary folder). Data ważności: Worker
-- przed wydaniem pliku z folderu z sekretem pyta link_chroniony_wazny (pamięć 60 s).
--
-- Dotychczasowe pliki znikają razem z tabelą (DROP zwalnia miejsce od razu, bez czekania na autovacuum).
-- Istniejące linki z ochroną dostają sekret = null („do ponownej publikacji”): gość widzi „Link jest
-- właśnie aktualizowany”, a aplikacja właściciela przy najbliższym otwarciu projektu publikuje strony od nowa.

create extension if not exists pgcrypto with schema extensions;

alter table public.udostepnienia add column if not exists sekret text;
update public.udostepnienia set sekret = null;

drop function if exists public.zapisz_plik_udostepnienia(uuid, text, text, text, text);
drop function if exists public.porzadkuj_pliki_udostepnienia(uuid, text, text[]);
drop function if exists public.podglad_chroniony(uuid, uuid, text, text, text[]);
drop table if exists public.udostepnienia_pliki;

create or replace function public.nowy_sekret_udostepnienia()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
$$;

revoke all on function public.nowy_sekret_udostepnienia() from public, anon, authenticated;

-- Właściciel: hasło i data ważności. Nowy link albo zmiana hasła → nowy sekret (nowy folder w R2).
-- Zwraca { haslo, wazny_do, folder, stary_folder } – stary_folder (gdy sekret się zmienił) aplikacja usuwa z R2.
create or replace function public.ustaw_ochrone_udostepnienia(
  p_projekt uuid, p_kod text, p_zmien_haslo boolean, p_haslo text, p_wazny_do timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.udostepnienia%rowtype;
  v_stary text;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  if p_zmien_haslo and p_haslo is not null and p_haslo <> '' and length(p_haslo) < 4 then
    raise exception 'Hasło do linku musi mieć co najmniej 4 znaki';
  end if;
  select sekret into v_stary from public.udostepnienia
   where owner_id = auth.uid() and projekt_id = p_projekt and kod = p_kod;
  insert into public.udostepnienia (owner_id, projekt_id, kod, sekret)
  values (auth.uid(), p_projekt, p_kod, public.nowy_sekret_udostepnienia())
  on conflict (owner_id, projekt_id, kod) do nothing;
  update public.udostepnienia
     set haslo_skrot = case
           when not p_zmien_haslo then haslo_skrot
           when p_haslo is null or p_haslo = '' then null
           else extensions.crypt(p_haslo, extensions.gen_salt('bf', 10))
         end,
         sekret = case when (p_zmien_haslo and v_stary is not null) or sekret is null then public.nowy_sekret_udostepnienia() else sekret end,
         wazny_do = p_wazny_do,
         nieudane = 0,
         blokada_do = null,
         zmieniono = now()
   where owner_id = auth.uid() and projekt_id = p_projekt and kod = p_kod
  returning * into u;
  return jsonb_build_object(
    'haslo', u.haslo_skrot is not null,
    'wazny_do', u.wazny_do,
    'folder', u.kod || '.' || u.sekret,
    'stary_folder', case when v_stary is not null and v_stary <> u.sekret then u.kod || '.' || v_stary end);
end;
$$;

revoke all on function public.ustaw_ochrone_udostepnienia(uuid, text, boolean, text, timestamptz) from public, anon;
grant execute on function public.ustaw_ochrone_udostepnienia(uuid, text, boolean, text, timestamptz) to authenticated;

-- Oglądający (także bez konta) i właściciel: stan linku i – po sprawdzeniu – nazwa folderu z plikami w R2.
-- Zwraca { stan }:
--   'brak' | 'wygasl' | 'haslo' | 'zle_haslo' | 'blokada' (pole „do”) – jak dotąd,
--   'aktualizacja' – link czeka na ponowną publikację przez właściciela (po przeniesieniu do R2),
--   'ok' – { folder: '<kod>.<sekret>', haslo, wazny_do, nowy }.
-- Właściciel (zalogowany) dostaje folder bez hasła i także po dacie ważności; gdy sekretu nie ma – dostaje nowy
-- (pole „nowy”: true – trzeba opublikować wszystkie strony).
create or replace function public.podglad_chroniony(
  p_konto uuid, p_projekt uuid, p_kod text, p_haslo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.udostepnienia%rowtype;
  wlasciciel boolean := auth.uid() is not null and auth.uid() = p_konto;
  v_nowy boolean := false;
begin
  select * into u from public.udostepnienia
   where owner_id = p_konto and projekt_id = p_projekt and kod = p_kod;
  if not found then
    return jsonb_build_object('stan', 'brak');
  end if;
  if wlasciciel then
    if u.sekret is null then
      update public.udostepnienia set sekret = public.nowy_sekret_udostepnienia()
       where owner_id = p_konto and projekt_id = p_projekt and kod = p_kod
      returning * into u;
      v_nowy := true;
    end if;
  else
    if u.wazny_do is not null and u.wazny_do < now() then
      return jsonb_build_object('stan', 'wygasl');
    end if;
    if u.haslo_skrot is not null then
      if u.blokada_do is not null and u.blokada_do > now() then
        return jsonb_build_object('stan', 'blokada', 'do', u.blokada_do);
      end if;
      if p_haslo is null or p_haslo = '' then
        return jsonb_build_object('stan', 'haslo', 'wazny_do', u.wazny_do);
      end if;
      if extensions.crypt(p_haslo, u.haslo_skrot) <> u.haslo_skrot then
        update public.udostepnienia
           set nieudane = case when nieudane + 1 >= 10 then 0 else nieudane + 1 end,
               blokada_do = case when nieudane + 1 >= 10 then now() + interval '15 minutes' else blokada_do end
         where owner_id = p_konto and projekt_id = p_projekt and kod = p_kod;
        return jsonb_build_object('stan', 'zle_haslo');
      end if;
      if u.nieudane > 0 then
        update public.udostepnienia set nieudane = 0
         where owner_id = p_konto and projekt_id = p_projekt and kod = p_kod;
      end if;
    end if;
    if u.sekret is null then
      return jsonb_build_object('stan', 'aktualizacja');
    end if;
  end if;
  return jsonb_build_object('stan', 'ok', 'folder', u.kod || '.' || u.sekret, 'haslo', u.haslo_skrot is not null,
                            'wazny_do', u.wazny_do, 'nowy', v_nowy);
end;
$$;

revoke all on function public.podglad_chroniony(uuid, uuid, text, text) from public;
grant execute on function public.podglad_chroniony(uuid, uuid, text, text) to anon, authenticated;

-- Worker: czy folder z sekretem należy do żywego linku (jest, sekret się zgadza, data ważności nie minęła).
-- Sekret jest dowodem znajomości hasła – funkcja nie zdradza niczego poza tak/nie.
create or replace function public.link_chroniony_wazny(p_konto uuid, p_projekt uuid, p_kod text, p_sekret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.udostepnienia u
     where u.owner_id = p_konto and u.projekt_id = p_projekt and u.kod = p_kod
       and u.sekret is not null and u.sekret = p_sekret
       and (u.wazny_do is null or u.wazny_do >= now()));
$$;

revoke all on function public.link_chroniony_wazny(uuid, uuid, text, text) from public;
grant execute on function public.link_chroniony_wazny(uuid, uuid, text, text) to anon, authenticated;

-- Odwołania do plików (sprzątanie osieroconych plików w Workerze): także foldery linków z ochroną.
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
        select p.owner_id::text || '/' || p.id::text || '/' || (p.dane->'udostepnienie'->>'kod') || '/' as l
          from public.projekty p
         where p.owner_id = v_uid and coalesce(p.dane->'udostepnienie'->>'kod', '') <> ''
        union all
        select u.owner_id::text || '/' || u.projekt_id::text || '/' || u.kod || '.' || u.sekret || '/'
          from public.udostepnienia u
         where u.owner_id = v_uid and u.sekret is not null) x), '[]'::jsonb));
end;
$$;

revoke all on function public.odwolania_plikow() from public, anon;
grant execute on function public.odwolania_plikow() to authenticated;

-- Miejsce: obrazy linków z ochroną liczy teraz Worker (R2, „podglady”) – w bazie zostają tylko obrazy od AI.
create or replace function public.miejsce_na_koncie()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ai bigint;
  v_baza bigint;
  v_limity jsonb := public.limity_aplikacji();
begin
  if v_uid is null then
    raise exception 'Brak sesji';
  end if;
  select coalesce(sum(octet_length(a.dane)), 0) + coalesce(sum((select sum(octet_length(c.dane)) from public.obrazy_ai_czesci c where c.wiersz = a.id)), 0)
    into v_ai
    from public.obrazy_ai a where a.owner_id = v_uid;
  begin
    v_baza := pg_database_size(current_database());
  exception when others then
    v_baza := null;
  end;
  return jsonb_build_object(
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

-- Sprzątanie konta (#90): pliki linków z ochroną leżą teraz w R2 – liczy je i usuwa przekaźnik (osierocone
-- foldery), tu zostają tylko ustawienia porzuconych linków (linki_bajty – zawsze 0).
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
      and not exists (select 1 from public.projekty p where p.id = u.projekt_id and p.dane->'udostepnienie'->>'kod' = u.kod);
  if not coalesce(p_policz, false) then
    delete from public.obrazy_ai where id = any(v_ai);
    delete from public.udostepnienia u
      where u.owner_id = v_uid
        and u.zmieniono < now() - interval '2 days'
        and not exists (select 1 from public.projekty p where p.id = u.projekt_id and p.dane->'udostepnienie'->>'kod' = u.kod);
  end if;
  return jsonb_build_object('ai', coalesce(array_length(v_ai, 1), 0), 'ai_bajty', v_ai_bajty, 'linki', v_linki, 'linki_bajty', 0);
end;
$$;

revoke all on function public.posprzataj_konto(boolean) from public;
grant execute on function public.posprzataj_konto(boolean) to authenticated;

-- ---------- Porządki (jednorazowo; miejsce odzyska autovacuum – VACUUM nie działa w transakcji migracji) ----------

-- Zaproszenia: przyjęte albo odrzucone ponad 30 dni temu i przeterminowane ponad 30 dni temu.
delete from public.zaproszenia
 where (stan <> 'czeka' and utworzono < now() - interval '30 days')
    or wazne_do < now() - interval '30 days';

-- Obrazy od AI: porzucone wgrania (niedokończone) i obrazy, których żaden projekt już nie wskazuje
-- (przeniesione na konto albo usunięte) – starsze niż doba. Kawałki znikają kaskadowo.
delete from public.obrazy_ai a
 where a.utworzono < now() - interval '1 day'
   and (a.gotowy = false
        or not exists (
          select 1 from public.projekty p,
                 jsonb_each(case when jsonb_typeof(p.dane->'zasoby') = 'object' then p.dane->'zasoby' else '{}'::jsonb end) z
           where p.id = a.projekt_id and z.value->>'sciezka' = 'ai:' || a.id::text));

-- Pliki do usunięcia, które aplikacja miała usunąć ponad 30 dni temu (pliki osierocone sprząta i tak Worker).
delete from public.zasoby_do_usuniecia where utworzono < now() - interval '30 days';
