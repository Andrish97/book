-- Migracja: krótkie linki podglądu (decyzja #195).
--
-- „Żeby linki udostępniania były krótsze, ładniejsze, np. makietka.app/ i krótki kod z cyfr i liter, 5 albo
-- najwyżej 6.”
--
-- Link podglądu to dotąd …/#/u/<konto>/<projekt>/<kod>. Teraz projekt z linkiem ma też krótki kod: 6 znaków
-- z małych liter i cyfr bez łatwych do pomylenia (0/o, 1/l/i) – 31^6 ≈ 887 mln kombinacji. Adres
-- makietka.app/<kod> otwiera aplikację (na GitHub Pages przez 404.html), a ta zamienia kod na konto, projekt
-- i kod linku funkcją krotki_link. Kod nie zastępuje ochrony: link z hasłem dalej pyta o hasło.
-- * Jeden krótki kod na projekt: nowy link (inny kod linku) dostaje nowy krótki kod, stary przestaje działać.
-- * Unieważnienie linku usuwa krótki kod (krotki_link_usun); usunięcie projektu – kaskadą.

create table if not exists public.krotkie_linki (
  kod        text primary key check (kod ~ '^[a-hj-km-np-z2-9]{6}$'),
  projekt    uuid not null unique references public.projekty (id) on delete cascade,
  konto      uuid not null references auth.users (id) on delete cascade,
  kod_linku  text not null,
  utworzono  timestamptz not null default now()
);
alter table public.krotkie_linki enable row level security;
revoke all on table public.krotkie_linki from anon, authenticated;

-- Właściciel: krótki kod dla linku projektu (ten sam przy ponownym wywołaniu; nowy, gdy zmienił się kod linku).
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
  delete from public.krotkie_linki where projekt = p_projekt;
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

-- Każdy (także bez konta): krótki kod → { konto, projekt, kod } albo null.
create or replace function public.krotki_link(p_kod text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('konto', k.konto, 'projekt', k.projekt, 'kod', k.kod_linku)
    from public.krotkie_linki k
   where k.kod = lower(btrim(coalesce(p_kod, '')));
$$;
revoke all on function public.krotki_link(text) from public;
grant execute on function public.krotki_link(text) to anon, authenticated;

-- Właściciel: koniec krótkiego kodu (unieważnienie linku).
create or replace function public.krotki_link_usun(p_projekt uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.krotkie_linki where projekt = p_projekt and konto = auth.uid();
$$;
revoke all on function public.krotki_link_usun(uuid) from public;
grant execute on function public.krotki_link_usun(uuid) to authenticated;
