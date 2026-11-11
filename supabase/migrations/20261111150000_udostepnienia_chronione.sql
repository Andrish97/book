-- Migracja: link do podglądu z hasłem i datą ważności.
--
-- Link bez hasła i bez daty ważności działa jak dotąd: obrazy stron leżą w publicznym
-- folderze Storage „podglady”. Link z hasłem albo z datą ważności trzyma obrazy w tabeli
-- poniżej, do której oglądający nie ma dostępu. Obrazy wydaje tylko funkcja
-- public.podglad_chroniony – po sprawdzeniu daty ważności i hasła. Hasło jest zapisane
-- wyłącznie jako skrót bcrypt (pgcrypto), sprawdzany w bazie.
--
-- Wszystko jest w tej migracji (bez funkcji Edge), więc wdraża się tak samo jak reszta:
-- przy pushu na main przez integrację Supabase z GitHubem.

create extension if not exists pgcrypto with schema extensions;

-- Ustawienia chronionego linku. Wiersz istnieje tylko dla linku z hasłem albo z datą ważności.
create table if not exists public.udostepnienia (
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  projekt_id   uuid not null,
  kod          text not null check (kod ~ '^[0-9a-f]{16,64}$'),
  haslo_skrot  text,
  wazny_do     timestamptz,
  -- Ochrona przed zgadywaniem hasła: po 10 złych próbach link jest zablokowany na 15 minut.
  nieudane     integer not null default 0,
  blokada_do   timestamptz,
  zmieniono    timestamptz not null default now(),
  primary key (owner_id, projekt_id, kod)
);

alter table public.udostepnienia enable row level security;

-- Tylko właściciel widzi i zmienia swoje ustawienia (także skrót hasła). Oglądający nie ma
-- do tabeli żadnego dostępu – wszystko idzie przez public.podglad_chroniony.
drop policy if exists "udostepnienia: własne" on public.udostepnienia;
create policy "udostepnienia: własne" on public.udostepnienia
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Pliki chronionego linku: opis podglądu (manifest.json) i obrazy stron (<strona>.jpg).
create table if not exists public.udostepnienia_pliki (
  owner_id    uuid not null default auth.uid(),
  projekt_id  uuid not null,
  kod         text not null,
  nazwa       text not null check (nazwa ~ '^[A-Za-z0-9_.-]{1,200}$'),
  typ         text not null,
  dane        bytea not null,
  zmieniono   timestamptz not null default now(),
  primary key (owner_id, projekt_id, kod, nazwa),
  foreign key (owner_id, projekt_id, kod) references public.udostepnienia (owner_id, projekt_id, kod) on delete cascade
);

alter table public.udostepnienia_pliki enable row level security;

drop policy if exists "udostepnienia_pliki: własne" on public.udostepnienia_pliki;
create policy "udostepnienia_pliki: własne" on public.udostepnienia_pliki
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Usunięty projekt zabiera ze sobą chronione linki (pliki znikają kaskadowo).
create or replace function public.usun_udostepnienia_projektu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.udostepnienia where owner_id = old.owner_id and projekt_id = old.id;
  return old;
end;
$$;

drop trigger if exists projekty_usun_udostepnienia on public.projekty;
create trigger projekty_usun_udostepnienia
  after delete on public.projekty
  for each row execute function public.usun_udostepnienia_projektu();

-- Właściciel: ustawia hasło i datę ważności linku. p_zmien_haslo = false zostawia hasło bez zmian;
-- puste p_haslo przy p_zmien_haslo = true zdejmuje hasło. Zwraca { haslo, wazny_do }.
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
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  if p_zmien_haslo and p_haslo is not null and p_haslo <> '' and length(p_haslo) < 4 then
    raise exception 'Hasło do linku musi mieć co najmniej 4 znaki';
  end if;
  insert into public.udostepnienia (owner_id, projekt_id, kod)
  values (auth.uid(), p_projekt, p_kod)
  on conflict (owner_id, projekt_id, kod) do nothing;
  update public.udostepnienia
     set haslo_skrot = case
           when not p_zmien_haslo then haslo_skrot
           when p_haslo is null or p_haslo = '' then null
           else extensions.crypt(p_haslo, extensions.gen_salt('bf', 10))
         end,
         wazny_do = p_wazny_do,
         nieudane = 0,
         blokada_do = null,
         zmieniono = now()
   where owner_id = auth.uid() and projekt_id = p_projekt and kod = p_kod
  returning * into u;
  return jsonb_build_object('haslo', u.haslo_skrot is not null, 'wazny_do', u.wazny_do);
end;
$$;

revoke all on function public.ustaw_ochrone_udostepnienia(uuid, text, boolean, text, timestamptz) from public, anon;
grant execute on function public.ustaw_ochrone_udostepnienia(uuid, text, boolean, text, timestamptz) to authenticated;

-- Właściciel: zapis jednego pliku linku (dane w base64 – tak przechodzą przez API bez strat).
create or replace function public.zapisz_plik_udostepnienia(
  p_projekt uuid, p_kod text, p_nazwa text, p_typ text, p_dane text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.udostepnienia_pliki (owner_id, projekt_id, kod, nazwa, typ, dane, zmieniono)
  values (auth.uid(), p_projekt, p_kod, p_nazwa, p_typ, decode(p_dane, 'base64'), now())
  on conflict (owner_id, projekt_id, kod, nazwa)
  do update set typ = excluded.typ, dane = excluded.dane, zmieniono = now();
$$;

revoke all on function public.zapisz_plik_udostepnienia(uuid, text, text, text, text) from public, anon;
grant execute on function public.zapisz_plik_udostepnienia(uuid, text, text, text, text) to authenticated;

-- Właściciel: usuwa pliki linku spoza listy (strony usunięte od poprzedniej aktualizacji).
create or replace function public.porzadkuj_pliki_udostepnienia(p_projekt uuid, p_kod text, p_zostaja text[])
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.udostepnienia_pliki
   where owner_id = auth.uid() and projekt_id = p_projekt and kod = p_kod
     and not (nazwa = any (p_zostaja));
$$;

revoke all on function public.porzadkuj_pliki_udostepnienia(uuid, text, text[]) from public, anon;
grant execute on function public.porzadkuj_pliki_udostepnienia(uuid, text, text[]) to authenticated;

-- Właściciel: koniec ochrony albo unieważnienie linku – ustawienia i pliki znikają.
create or replace function public.usun_udostepnienie_chronione(p_projekt uuid, p_kod text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.udostepnienia where owner_id = auth.uid() and projekt_id = p_projekt and kod = p_kod;
$$;

revoke all on function public.usun_udostepnienie_chronione(uuid, text) from public, anon;
grant execute on function public.usun_udostepnienie_chronione(uuid, text) to authenticated;

-- Oglądający (także bez konta): stan linku i – po sprawdzeniu – jego pliki.
-- Zwraca { stan }:
--   'brak'      – nie ma takiego chronionego linku,
--   'wygasl'    – minęła data ważności,
--   'haslo'     – link wymaga hasła, a hasła nie podano,
--   'zle_haslo' – hasło się nie zgadza,
--   'blokada'   – za dużo złych prób (pole „do”: do kiedy),
--   'ok'        – dostęp; z p_nazwy pole „pliki”: { nazwa: { typ, dane (base64) } }, najwyżej 12 naraz.
-- Właściciel linku (zalogowany) dostaje pliki bez hasła i także po dacie ważności.
create or replace function public.podglad_chroniony(
  p_konto uuid, p_projekt uuid, p_kod text, p_haslo text default null, p_nazwy text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.udostepnienia%rowtype;
  wlasciciel boolean := auth.uid() is not null and auth.uid() = p_konto;
  pliki jsonb;
begin
  select * into u from public.udostepnienia
   where owner_id = p_konto and projekt_id = p_projekt and kod = p_kod;
  if not found then
    return jsonb_build_object('stan', 'brak');
  end if;
  if not wlasciciel then
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
  end if;
  if p_nazwy is null then
    return jsonb_build_object('stan', 'ok', 'haslo', u.haslo_skrot is not null, 'wazny_do', u.wazny_do);
  end if;
  select coalesce(jsonb_object_agg(f.nazwa, jsonb_build_object('typ', f.typ, 'dane', translate(encode(f.dane, 'base64'), E'\n', ''))), '{}'::jsonb)
    into pliki
    from public.udostepnienia_pliki f
   where f.owner_id = p_konto and f.projekt_id = p_projekt and f.kod = p_kod
     and f.nazwa = any (p_nazwy[1:12]);
  return jsonb_build_object('stan', 'ok', 'pliki', pliki);
end;
$$;

revoke all on function public.podglad_chroniony(uuid, uuid, text, text, text[]) from public;
grant execute on function public.podglad_chroniony(uuid, uuid, text, text, text[]) to anon, authenticated;
