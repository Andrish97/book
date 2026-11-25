-- Jedna kolejka prac w tle konta z dzierżawą wykonawcy (#438, etap B; zgoda właściciela „Tak, zaczynaj”).
--
-- Praca = „link <kod> projektu X ma pokazywać wersję W projektu”. Wiersz na każdy link projektu; każdy zapis projektu
-- (aplikacja na dowolnym urządzeniu, współpracownik, łącznik AI, przywrócenie kopii) podbija projekty.wersja,
-- a wyzwalacz niżej zgłasza nową wersję do wszystkich linków projektu – bez względu na to, kto zmienił.
--
-- Kto wykonuje (dzierżawa, 30 s, odnawiana co kilka sekund):
--   1. karta z otwartym projektem, a z kilku – najmocniejsze urządzenie (aplikacja wybiera przez obecność kart,
--      js/prace-w-tle.js); inne karty konta czekają ~3 s i biorą pracę tylko wtedy, gdy nikt jej nie wziął;
--   2. serwer – gdy praca czeka dłużej (żadna karta jej nie wzięła) albo dzierżawa karty wygasła (karta zamknięta);
--   3. karta, która wraca, odbiera pracę serwerowi (serwer widzi to przy odnowieniu i kończy po bieżącej stronie).
-- Zakończenie zapisuje wykonaną wersję; jeśli w trakcie przyszła nowsza – praca wraca do „czeka”.
-- Strona linku jest jednostką atomową (plik → wpis w opisie), więc przerwana praca niczego nie psuje,
-- a następna rysuje tylko strony, których odcisku jeszcze nie ma (js/publikacja-magazyn.js).

create table if not exists public.prace_w_tle (
  id           uuid primary key default gen_random_uuid(),
  wlasciciel   uuid not null references auth.users (id) on delete cascade,
  projekt_id   uuid not null references public.projekty (id) on delete cascade,
  rodzaj       text not null default 'link' check (rodzaj in ('link')),
  cel          text not null check (char_length(cel) between 1 and 80),
  wersja       bigint not null default 0,
  wykonana     bigint not null default 0,
  stan         text not null default 'czeka' check (stan in ('czeka', 'w_toku', 'gotowe', 'blad')),
  wykonawca    text check (char_length(wykonawca) <= 80),
  dzierzawa_do timestamptz,
  gotowe       integer,
  wszystkie    integer,
  blad         text check (char_length(blad) <= 300),
  proby        integer not null default 0,
  zgloszono    timestamptz not null default now(),
  zmieniono    timestamptz not null default now(),
  unique (projekt_id, rodzaj, cel)
);
create index if not exists prace_w_tle_konto on public.prace_w_tle (wlasciciel, stan);
create index if not exists prace_w_tle_serwer on public.prace_w_tle (stan, zgloszono);
alter table public.prace_w_tle enable row level security;
revoke all on table public.prace_w_tle from public, anon, authenticated;
grant select on table public.prace_w_tle to authenticated;
drop policy if exists prace_w_tle_czytanie on public.prace_w_tle;
create policy prace_w_tle_czytanie on public.prace_w_tle for select to authenticated
  using (wlasciciel = (select auth.uid()));

-- Realtime: karty konta od razu widzą nową pracę i zmianę wykonawcy.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prace_w_tle') then
    alter publication supabase_realtime add table public.prace_w_tle;
  end if;
end $$;

create or replace function public._praca_json(z public.prace_w_tle)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', z.id, 'projekt_id', z.projekt_id, 'rodzaj', z.rodzaj, 'cel', z.cel, 'wersja', z.wersja,
    'wykonana', z.wykonana, 'stan', z.stan, 'wykonawca', z.wykonawca, 'dzierzawa_do', z.dzierzawa_do, 'gotowe', z.gotowe,
    'wszystkie', z.wszystkie, 'blad', z.blad, 'zgloszono', z.zgloszono, 'zmieniono', z.zmieniono);
$$;
revoke all on function public._praca_json(public.prace_w_tle) from public, anon, authenticated;

-- Zgłoszenie wersji do wszystkich linków projektu (wywoływane przez wyzwalacz i przy nowym linku).
create or replace function public._praca_zglos(p_projekt uuid, p_wersja bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.prace_w_tle as z (wlasciciel, projekt_id, rodzaj, cel, wersja)
  select k.konto, k.projekt, 'link', k.kod_linku, p_wersja
    from public.krotkie_linki k
   where k.projekt = p_projekt
  on conflict (projekt_id, rodzaj, cel) do update
     set wersja = greatest(z.wersja, excluded.wersja), zgloszono = now(), zmieniono = now(), blad = null, proby = 0,
         stan = case when z.stan = 'w_toku' then 'w_toku' when greatest(z.wersja, excluded.wersja) > z.wykonana then 'czeka' else z.stan end;
$$;
revoke all on function public._praca_zglos(uuid, bigint) from public, anon, authenticated;

create or replace function public._praca_po_zapisie()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.wersja is distinct from old.wersja then perform public._praca_zglos(new.id, new.wersja); end if;
  return null;
end;
$$;
revoke all on function public._praca_po_zapisie() from public, anon, authenticated;
drop trigger if exists prace_po_zapisie on public.projekty;
create trigger prace_po_zapisie after update of wersja on public.projekty
  for each row execute function public._praca_po_zapisie();

-- Unieważniony link – jego praca znika.
create or replace function public._praca_po_usunieciu_linku()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.prace_w_tle z where z.projekt_id = old.projekt and z.rodzaj = 'link' and z.cel = old.kod_linku
    and not exists (select 1 from public.krotkie_linki k where k.projekt = old.projekt and k.kod_linku = old.kod_linku and k.kod <> old.kod);
  return null;
end;
$$;
revoke all on function public._praca_po_usunieciu_linku() from public, anon, authenticated;
drop trigger if exists prace_po_usunieciu_linku on public.krotkie_linki;
create trigger prace_po_usunieciu_linku after delete on public.krotkie_linki
  for each row execute function public._praca_po_usunieciu_linku();

-- ---------- Karta (sesja właściciela linku) ----------

-- Prace konta do zrobienia (karta po starcie i po powrocie sieci).
create or replace function public.prace_konta()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public._praca_json(z) order by z.zgloszono), '[]'::jsonb)
    from public.prace_w_tle z
   where z.wlasciciel = auth.uid() and z.stan in ('czeka', 'w_toku', 'blad');
$$;
revoke all on function public.prace_konta() from public, anon;
grant execute on function public.prace_konta() to authenticated;

-- Nowy link (albo link sprzed kolejki): praca dla bieżącej wersji projektu.
create or replace function public.praca_zglos_link(p_projekt uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wersja bigint;
begin
  if auth.uid() is null then raise exception 'Brak sesji' using errcode = '42501'; end if;
  if not exists (select 1 from public.krotkie_linki k where k.projekt = p_projekt and k.konto = auth.uid()) then return; end if;
  select p.wersja into v_wersja from public.projekty p where p.id = p_projekt;
  if v_wersja is not null then perform public._praca_zglos(p_projekt, v_wersja); end if;
end;
$$;
revoke all on function public.praca_zglos_link(uuid) from public, anon;
grant execute on function public.praca_zglos_link(uuid) to authenticated;

-- Przejęcie pracy przez kartę: czekająca, z wygasłą dzierżawą, już tej karty albo (p_od_serwera) prowadzona przez
-- serwer – karta, która wraca, odbiera ją. Zwraca pracę albo null (wzięła inna karta).
create or replace function public.praca_przejmij(p_id uuid, p_karta text, p_od_serwera boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_z public.prace_w_tle;
begin
  if auth.uid() is null then raise exception 'Brak sesji' using errcode = '42501'; end if;
  if coalesce(p_karta, '') = '' or p_karta = 'serwer' then raise exception 'Nieprawidłowa karta'; end if;
  update public.prace_w_tle z
     set stan = 'w_toku', wykonawca = left(p_karta, 80), dzierzawa_do = now() + interval '30 seconds', zmieniono = now(),
         gotowe = null, wszystkie = null
   where z.id = p_id and z.wlasciciel = auth.uid() and z.wersja > z.wykonana
     and (z.stan in ('czeka', 'blad') or z.dzierzawa_do is null or z.dzierzawa_do < now() or z.wykonawca = left(p_karta, 80)
          or (coalesce(p_od_serwera, false) and z.wykonawca = 'serwer'))
  returning * into v_z;
  return case when v_z.id is null then null else public._praca_json(v_z) end;
end;
$$;
revoke all on function public.praca_przejmij(uuid, text, boolean) from public, anon;
grant execute on function public.praca_przejmij(uuid, text, boolean) to authenticated;

-- Odnowienie dzierżawy i postęp. Zwraca pracę (z bieżącą wersją – wykonawca widzi, że przyszła nowsza) albo
-- null, gdy pracę ma już ktoś inny (np. serwer po wygaśnięciu) – wtedy karta przerywa.
create or replace function public.praca_odnow(p_id uuid, p_karta text, p_gotowe integer default null, p_wszystkie integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_z public.prace_w_tle;
begin
  if auth.uid() is null then raise exception 'Brak sesji' using errcode = '42501'; end if;
  update public.prace_w_tle z
     set dzierzawa_do = now() + interval '30 seconds', gotowe = coalesce(p_gotowe, z.gotowe), wszystkie = coalesce(p_wszystkie, z.wszystkie)
   where z.id = p_id and z.wlasciciel = auth.uid() and z.stan = 'w_toku' and z.wykonawca = left(p_karta, 80)
  returning * into v_z;
  return case when v_z.id is null then null else public._praca_json(v_z) end;
end;
$$;
revoke all on function public.praca_odnow(uuid, text, integer, integer) from public, anon;
grant execute on function public.praca_odnow(uuid, text, integer, integer) to authenticated;

-- Koniec pracy karty: p_wersja – wersja, którą narysowano. Nowsza w trakcie – praca znów czeka.
-- p_zwolnij – karta oddaje pracę bez wyniku (zamyka się albo przerwała dla nowszej wersji).
create or replace function public.praca_zakoncz(p_id uuid, p_karta text, p_wersja bigint, p_blad text default null, p_zwolnij boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_z public.prace_w_tle;
begin
  if auth.uid() is null then raise exception 'Brak sesji' using errcode = '42501'; end if;
  update public.prace_w_tle z
     set wykonana = case when p_blad is null and not coalesce(p_zwolnij, false) then greatest(z.wykonana, least(coalesce(p_wersja, 0), z.wersja)) else z.wykonana end,
         stan = case
                  when p_blad is not null then 'blad'
                  when greatest(z.wykonana, case when coalesce(p_zwolnij, false) then 0 else least(coalesce(p_wersja, 0), z.wersja) end) >= z.wersja then 'gotowe'
                  else 'czeka' end,
         blad = left(p_blad, 300), proby = case when p_blad is null then 0 else z.proby + 1 end,
         wykonawca = null, dzierzawa_do = null, zmieniono = now()
   where z.id = p_id and z.wlasciciel = auth.uid() and z.stan = 'w_toku' and z.wykonawca = left(p_karta, 80)
  returning * into v_z;
  return case when v_z.id is null then null else public._praca_json(v_z) end;
end;
$$;
revoke all on function public.praca_zakoncz(uuid, text, bigint, text, boolean) from public, anon;
grant execute on function public.praca_zakoncz(uuid, text, bigint, text, boolean) to authenticated;

-- ---------- Serwer (klucz serwisowy) ----------

-- Przejęcie prac, których żadna karta nie wzięła (czekają dłużej niż p_po_sekundach) albo których dzierżawa wygasła.
-- Błąd: najwyżej 3 próby, kolejna po 5 minutach. Zwraca [{ id, projekt_id, wlasciciel, cel, wersja, folder, chroniony }]
-- – folder linku z ochroną ma sekret (tylko dla serwera).
create or replace function public.serwer_przejmij_prace(p_po_sekundach integer default 30, p_ile integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wynik jsonb;
begin
  with do_przyjecia as (
    select z.id from public.prace_w_tle z
     where z.wersja > z.wykonana
       and ((z.stan = 'czeka' and z.zgloszono < now() - make_interval(secs => greatest(0, p_po_sekundach)))
         or (z.stan = 'w_toku' and z.dzierzawa_do < now())
         or (z.stan = 'blad' and z.proby < 3 and z.zmieniono < now() - interval '5 minutes'))
     order by z.zgloszono
     limit greatest(1, least(coalesce(p_ile, 3), 10))
     for update skip locked
  ), przyjete as (
    update public.prace_w_tle z
       set stan = 'w_toku', wykonawca = 'serwer', dzierzawa_do = now() + interval '2 minutes', zmieniono = now(), gotowe = null, wszystkie = null
      from do_przyjecia d
     where z.id = d.id
    returning z.*
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'projekt_id', p.projekt_id, 'wlasciciel', p.wlasciciel, 'cel', p.cel,
           'wersja', p.wersja, 'chroniony', u.sekret is not null,
           'folder', p.wlasciciel::text || '/' || p.projekt_id::text || '/' || p.cel || coalesce('.' || u.sekret, ''))), '[]'::jsonb)
    into v_wynik
    from przyjete p
    left join public.udostepnienia u on u.owner_id = p.wlasciciel and u.projekt_id = p.projekt_id and u.kod = p.cel and u.sekret is not null;
  return v_wynik;
end;
$$;

-- Odnowienie dzierżawy serwera i postęp; null – pracę odebrała karta (serwer kończy po bieżącej stronie).
create or replace function public.serwer_odnow_prace(p_id uuid, p_gotowe integer default null, p_wszystkie integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_z public.prace_w_tle;
begin
  update public.prace_w_tle z
     set dzierzawa_do = now() + interval '2 minutes', gotowe = coalesce(p_gotowe, z.gotowe), wszystkie = coalesce(p_wszystkie, z.wszystkie)
   where z.id = p_id and z.stan = 'w_toku' and z.wykonawca = 'serwer'
  returning * into v_z;
  return case when v_z.id is null then null else public._praca_json(v_z) end;
end;
$$;

create or replace function public.serwer_zakoncz_prace(p_id uuid, p_wersja bigint, p_blad text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_z public.prace_w_tle;
begin
  update public.prace_w_tle z
     set wykonana = case when p_blad is null then greatest(z.wykonana, least(coalesce(p_wersja, 0), z.wersja)) else z.wykonana end,
         stan = case when p_blad is not null then 'blad'
                     when greatest(z.wykonana, least(coalesce(p_wersja, 0), z.wersja)) >= z.wersja then 'gotowe' else 'czeka' end,
         blad = left(p_blad, 300), proby = case when p_blad is null then 0 else z.proby + 1 end,
         wykonawca = null, dzierzawa_do = null, zmieniono = now()
   where z.id = p_id and z.stan = 'w_toku' and z.wykonawca = 'serwer'
  returning * into v_z;
  return case when v_z.id is null then null else public._praca_json(v_z) end;
end;
$$;

revoke all on function public.serwer_przejmij_prace(integer, integer), public.serwer_odnow_prace(uuid, integer, integer),
  public.serwer_zakoncz_prace(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.serwer_przejmij_prace(integer, integer), public.serwer_odnow_prace(uuid, integer, integer),
  public.serwer_zakoncz_prace(uuid, bigint, text) to service_role;
