-- Kopie awaryjne i dziennik zapisów projektów (decyzja #138).
--
-- To nie jest „historia wersji” dla użytkownika (odrzucona, #131) – to siatka bezpieczeństwa dla administratora:
-- gdyby jakiś zapis (z aplikacji, z innego urządzenia albo od AI przez łącznik) nadpisał czyjąś pracę, poprzedni
-- stan zostaje tu na 14 dni (najwyżej 200 ostatnich zapisów na projekt) i da się go przywrócić z panelu
-- administratora. Dziennik mówi, kto (urządzenie / AI / serwis), kiedy i co zmienił – żeby następnym razem dało się
-- ustalić, co nadpisało.
--
-- Wyzwalacze łapią każdą drogę zapisu (zapisz_projekt, ai_zapisz, przyszłe funkcje), więc nie trzeba ruszać
-- samych funkcji zapisu. Tabele bez polityk RLS: konta ich nie widzą, czyta je tylko administrator przez funkcje niżej.

create table if not exists public.projekty_kopie (
  id          bigserial primary key,
  projekt_id  uuid not null,
  wersja      bigint,                 -- wersja projektu PRZED zapisem
  nazwa       text,
  dane        jsonb,                  -- dane projektu przed zapisem (kolejność stron, sekcje, wzorce, style, tabele…)
  kto         text not null,          -- 'urządzenie' | 'AI' | 'serwis' | 'przywrócenie'
  uzytkownik  uuid,
  txid        bigint not null default txid_current(),
  utworzono   timestamptz not null default now()
);
create index if not exists projekty_kopie_projekt on public.projekty_kopie (projekt_id, id desc);

create table if not exists public.projekty_strony_kopie (
  id          bigserial primary key,
  projekt_id  uuid not null,
  strona_id   text not null,
  dane        jsonb,                  -- treść strony przed zapisem albo przed usunięciem
  usunieta    boolean not null default false,
  txid        bigint not null default txid_current(),
  utworzono   timestamptz not null default now()
);
create index if not exists projekty_strony_kopie_projekt on public.projekty_strony_kopie (projekt_id, id desc);
create index if not exists projekty_strony_kopie_txid on public.projekty_strony_kopie (txid);

create table if not exists public.projekty_dziennik (
  id            bigserial primary key,
  projekt_id    uuid not null,
  wersja_przed  bigint,
  wersja_po     bigint,
  kto           text not null,
  uzytkownik    uuid,
  txid          bigint not null default txid_current(),
  utworzono     timestamptz not null default now()
);
create index if not exists projekty_dziennik_projekt on public.projekty_dziennik (projekt_id, id desc);

alter table public.projekty_kopie enable row level security;
alter table public.projekty_strony_kopie enable row level security;
alter table public.projekty_dziennik enable row level security;
revoke all on public.projekty_kopie, public.projekty_strony_kopie, public.projekty_dziennik from anon, authenticated;

-- Kto zapisuje: przywrócenie z panelu ustawia makietka.kto; klucz serwisowy – serwis; bez zalogowanego konta
-- (funkcje ai_* wołane kluczem łącznika) – AI; inaczej urządzenie właściciela albo współpracownika.
create or replace function public._kto_zapisuje()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when coalesce(current_setting('makietka.kto', true), '') <> '' then current_setting('makietka.kto', true)
    when coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role' then 'serwis'
    when auth.uid() is null then 'AI'
    else 'urządzenie'
  end;
$$;

-- Sprzątanie kopii jednego projektu: starsze niż 14 dni i ponad 200 ostatnich zapisów.
create or replace function public._sprzatnij_kopie(p_projekt uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_granica bigint;
  v_txid bigint;
begin
  select id, txid into v_granica, v_txid from public.projekty_kopie
   where projekt_id = p_projekt order by id desc offset 200 limit 1;
  delete from public.projekty_kopie
   where projekt_id = p_projekt and (utworzono < now() - interval '14 days' or (v_granica is not null and id <= v_granica));
  delete from public.projekty_strony_kopie
   where projekt_id = p_projekt and (utworzono < now() - interval '14 days' or (v_txid is not null and txid <= v_txid));
  delete from public.projekty_dziennik
   where projekt_id = p_projekt and utworzono < now() - interval '14 days';
end;
$$;

create or replace function public._kopia_projektu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.dane is distinct from new.dane or old.nazwa is distinct from new.nazwa or old.wersja is distinct from new.wersja then
    insert into public.projekty_kopie (projekt_id, wersja, nazwa, dane, kto, uzytkownik)
      values (old.id, old.wersja, old.nazwa, old.dane, public._kto_zapisuje(), auth.uid());
    insert into public.projekty_dziennik (projekt_id, wersja_przed, wersja_po, kto, uzytkownik)
      values (old.id, old.wersja, new.wersja, public._kto_zapisuje(), auth.uid());
    -- Sprzątanie co jakiś czas, nie przy każdym zapisie.
    if random() < 0.05 then perform public._sprzatnij_kopie(old.id); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists projekty_kopia on public.projekty;
create trigger projekty_kopia before update on public.projekty
  for each row execute function public._kopia_projektu();

create or replace function public._kopia_strony()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.projekty_strony_kopie (projekt_id, strona_id, dane, usunieta) values (old.projekt_id, old.strona_id, old.dane, true);
    return old;
  end if;
  if old.dane is distinct from new.dane then
    insert into public.projekty_strony_kopie (projekt_id, strona_id, dane) values (old.projekt_id, old.strona_id, old.dane);
  end if;
  return new;
end;
$$;
drop trigger if exists projekty_strony_kopia on public.projekty_strony;
create trigger projekty_strony_kopia before update or delete on public.projekty_strony
  for each row execute function public._kopia_strony();

revoke all on function public._kto_zapisuje(), public._sprzatnij_kopie(uuid), public._kopia_projektu(), public._kopia_strony() from public, anon, authenticated;

-- ---------- Panel administratora ----------

-- Dziennik zapisów: ostatnie zapisy (wszystkich projektów albo jednego), z nazwą projektu, właścicielem i liczbą
-- zmienionych / usuniętych stron w tym samym zapisie.
create or replace function public.admin_dziennik_zapisow(p_projekt uuid default null, p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.wymagaj_administratora();
  return coalesce((
    select jsonb_agg(w order by (w->>'id')::bigint desc) from (
      select jsonb_build_object(
        'id', d.id, 'projekt_id', d.projekt_id, 'projekt', p.nazwa, 'wlasciciel', u.email,
        'wersja_przed', d.wersja_przed, 'wersja_po', d.wersja_po, 'kto', d.kto, 'uzytkownik', ku.email,
        'kiedy', d.utworzono,
        'strony_zmienione', (select count(*) from public.projekty_strony_kopie s where s.txid = d.txid and s.projekt_id = d.projekt_id and not s.usunieta),
        'strony_usuniete', (select count(*) from public.projekty_strony_kopie s where s.txid = d.txid and s.projekt_id = d.projekt_id and s.usunieta),
        'kopia', (select k.id from public.projekty_kopie k where k.txid = d.txid and k.projekt_id = d.projekt_id order by k.id limit 1)
      ) w
      from public.projekty_dziennik d
      left join public.projekty p on p.id = d.projekt_id
      left join auth.users u on u.id = p.owner_id
      left join auth.users ku on ku.id = d.uzytkownik
      where p_projekt is null or d.projekt_id = p_projekt
      order by d.id desc
      limit least(greatest(coalesce(p_limit, 100), 1), 500)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- Kopia jednego zapisu: dane projektu sprzed zapisu i strony, które ten zapis zmienił albo usunął (ich stan sprzed).
create or replace function public.admin_kopia_zapisu(p_kopia bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.projekty_kopie;
begin
  perform public.wymagaj_administratora();
  select * into k from public.projekty_kopie where id = p_kopia;
  if not found then raise exception 'Nie ma takiej kopii (mogła zostać już usunięta po 14 dniach).'; end if;
  return jsonb_build_object(
    'id', k.id, 'projekt_id', k.projekt_id, 'wersja', k.wersja, 'nazwa', k.nazwa, 'kto', k.kto, 'kiedy', k.utworzono,
    'dane', k.dane,
    'strony', coalesce((select jsonb_agg(jsonb_build_object('strona_id', s.strona_id, 'usunieta', s.usunieta, 'dane', s.dane) order by s.id)
      from public.projekty_strony_kopie s where s.txid = k.txid and s.projekt_id = k.projekt_id), '[]'::jsonb));
end;
$$;

-- Przywrócenie: stan sprzed wybranego zapisu – dane projektu (kolejność stron, sekcje, wzorce, style, tabele…)
-- i strony, które ten zapis zmienił albo usunął. Wersja idzie w górę, więc otwarte edytory dołączą to jak każdą
-- zmianę z konta. Samo przywrócenie też trafia do kopii i dziennika (kto: „przywrócenie”) – da się je cofnąć.
create or replace function public.admin_przywroc_kopie(p_kopia bigint, p_tylko_strona text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.projekty_kopie;
  p public.projekty;
  s record;
  v_ile integer := 0;
begin
  perform public.wymagaj_administratora();
  select * into k from public.projekty_kopie where id = p_kopia;
  if not found then raise exception 'Nie ma takiej kopii (mogła zostać już usunięta po 14 dniach).'; end if;
  select * into p from public.projekty where id = k.projekt_id for update;
  if not found then raise exception 'Projektu już nie ma.'; end if;
  perform set_config('makietka.kto', 'przywrócenie', true);
  for s in select distinct on (strona_id) strona_id, dane from public.projekty_strony_kopie
            where txid = k.txid and projekt_id = k.projekt_id and (p_tylko_strona is null or strona_id = p_tylko_strona)
            order by strona_id, id loop
    insert into public.projekty_strony (projekt_id, strona_id, owner_id, dane)
      values (p.id, s.strona_id, p.owner_id, s.dane)
      on conflict (projekt_id, strona_id) do update set dane = excluded.dane;
    v_ile := v_ile + 1;
  end loop;
  if p_tylko_strona is null then
    update public.projekty set dane = coalesce(k.dane, dane), nazwa = coalesce(k.nazwa, nazwa), zmieniono = now(), wersja = wersja + 1
     where id = p.id;
  else
    -- Sama strona: kolejność stron musi ją zawierać.
    update public.projekty
       set dane = case when coalesce(dane->'strony', '[]'::jsonb) ? p_tylko_strona then dane
                       else jsonb_set(dane, '{strony}', coalesce(dane->'strony', '[]'::jsonb) || to_jsonb(p_tylko_strona)) end,
           zmieniono = now(), wersja = wersja + 1
     where id = p.id;
  end if;
  return jsonb_build_object('ok', true, 'strony', v_ile, 'wersja', (select wersja from public.projekty where id = p.id));
end;
$$;

revoke all on function public.admin_dziennik_zapisow(uuid, integer), public.admin_kopia_zapisu(bigint), public.admin_przywroc_kopie(bigint, text) from public, anon;
grant execute on function public.admin_dziennik_zapisow(uuid, integer), public.admin_kopia_zapisu(bigint), public.admin_przywroc_kopie(bigint, text) to authenticated;
