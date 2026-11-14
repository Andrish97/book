-- Migracja: nazwy użytkownika (decyzja #100).
--
-- „Nazwy użytkownika można również używać do udostępnień innym użytkownikom na równi z mailem. Pozwólmy też
-- ustawić ją przy rejestracji, przy pierwszym logowaniu.”
--
-- * public.profile – nazwa użytkownika konta: unikalna bez względu na wielkość liter, 3–30 znaków (litery, także
--   polskie, cyfry, _ . -), zaczyna się literą albo cyfrą, bez dwóch znaków _ . - pod rząd. Tabela nie jest
--   do przeglądania: każdy czyta tylko swój wiersz, a nazwy innych osób dają wyłącznie funkcje niżej
--   (sprawdzenie jednej nazwy, podpowiedź po początku nazwy – najwyżej 5, nigdy lista wszystkich).
-- * Nazwę ustawia aplikacja zaraz po rejestracji (pole „Nazwa użytkownika”), przy pierwszym logowaniu konta bez
--   nazwy (okno „Wybierz nazwę użytkownika”) albo w ustawieniach konta. Bez wyzwalacza na auth.users.
-- * Zaproszenie do projektu przyjmuje e-mail ALBO nazwę użytkownika. Zaproszenie po nazwie trafia do skrzynki
--   tej osoby (i mailem na jej adres), a zapraszający nie widzi jej adresu e-mail – ani w wyniku, ani na liście
--   osób projektu, ani w tabeli zaproszeń (reguła RLS bez wierszy „moich zaproszeń”).
-- * nazwa_konta() – nazwa użytkownika (dawniej imię z rejestracji albo początek adresu e-mail).

create table if not exists public.profile (
  id         uuid primary key references auth.users (id) on delete cascade,
  nazwa      text not null,
  zmieniono  timestamptz not null default now()
);
create unique index if not exists profile_nazwa on public.profile (lower(nazwa));
alter table public.profile enable row level security;
revoke all on table public.profile from anon, authenticated;
grant select on table public.profile to authenticated;
drop policy if exists "profile: własny" on public.profile;
create policy "profile: własny" on public.profile for select to authenticated using (id = (select auth.uid()));

create or replace function public.poprawna_nazwa_uzytkownika(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p, '') ~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.-]{2,29}$'
     and coalesce(p, '') !~ '[_.-]{2}';
$$;
grant execute on function public.poprawna_nazwa_uzytkownika(text) to anon, authenticated;

-- Istniejące konta: imię z rejestracji, jeśli pasuje do zasad i jest wolne (pierwsze konto wygrywa).
insert into public.profile (id, nazwa)
select distinct on (lower(btrim(u.raw_user_meta_data ->> 'nazwa'))) u.id, btrim(u.raw_user_meta_data ->> 'nazwa')
  from auth.users u
 where public.poprawna_nazwa_uzytkownika(btrim(u.raw_user_meta_data ->> 'nazwa'))
 order by lower(btrim(u.raw_user_meta_data ->> 'nazwa')), u.created_at
on conflict do nothing;

-- Czy nazwa jest poprawna i wolna (także przed rejestracją – bez sesji). Własna nazwa liczy się jako wolna.
-- Zajęta – z propozycją wolnej (nazwa z numerem). { poprawna, wolna, propozycja }
create or replace function public.nazwa_wolna(p_nazwa text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_nazwa, ''));
  v_prop text;
  i integer := 2;
begin
  if not public.poprawna_nazwa_uzytkownika(v) then
    return jsonb_build_object('poprawna', false, 'wolna', false);
  end if;
  if not exists (select 1 from public.profile where lower(nazwa) = lower(v) and id is distinct from auth.uid()) then
    return jsonb_build_object('poprawna', true, 'wolna', true);
  end if;
  loop
    v_prop := left(v, 27) || i;
    exit when not exists (select 1 from public.profile where lower(nazwa) = lower(v_prop)) or i > 999;
    i := i + 1;
  end loop;
  return jsonb_build_object('poprawna', true, 'wolna', false, 'propozycja', v_prop);
end;
$$;
revoke all on function public.nazwa_wolna(text) from public;
grant execute on function public.nazwa_wolna(text) to anon, authenticated;

-- Moja nazwa użytkownika albo null (konto bez nazwy – aplikacja prosi o nią przy logowaniu).
create or replace function public.moja_nazwa_uzytkownika()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nazwa from public.profile where id = auth.uid();
$$;
revoke all on function public.moja_nazwa_uzytkownika() from public, anon;
grant execute on function public.moja_nazwa_uzytkownika() to authenticated;

-- Ustawia (albo zmienia) nazwę użytkownika zalogowanego konta. Zwraca nazwę.
create or replace function public.ustaw_nazwe_uzytkownika(p_nazwa text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_nazwa, ''));
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  if not public.poprawna_nazwa_uzytkownika(v) then
    raise exception 'Nazwa użytkownika: 3–30 znaków – litery, cyfry, _ . -; na początku litera albo cyfra';
  end if;
  if exists (select 1 from public.profile where lower(nazwa) = lower(v) and id <> auth.uid()) then
    raise exception 'Ta nazwa użytkownika jest już zajęta – wybierz inną';
  end if;
  begin
    insert into public.profile (id, nazwa) values (auth.uid(), v)
    on conflict (id) do update set nazwa = excluded.nazwa, zmieniono = now();
  exception when unique_violation then
    raise exception 'Ta nazwa użytkownika jest już zajęta – wybierz inną';
  end;
  return v;
end;
$$;
revoke all on function public.ustaw_nazwe_uzytkownika(text) from public, anon;
grant execute on function public.ustaw_nazwe_uzytkownika(text) to authenticated;

-- Podpowiedzi nazw przy zapraszaniu: nazwy zaczynające się od wpisanego tekstu (co najmniej 2 znaki, bez „@”
-- w środku), najwyżej 5, bez własnej. Same nazwy – bez adresów e-mail.
create or replace function public.szukaj_nazw_uzytkownikow(p_tekst text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(n.nazwa order by length(n.nazwa), lower(n.nazwa)), '[]'::jsonb)
    from (
      select pr.nazwa from public.profile pr
       where auth.uid() is not null
         and length(ltrim(btrim(coalesce(p_tekst, '')), '@')) >= 2
         and position('@' in ltrim(btrim(coalesce(p_tekst, '')), '@')) = 0
         and lower(pr.nazwa) like replace(replace(replace(lower(ltrim(btrim(p_tekst), '@')), '\', '\\'), '%', '\%'), '_', '\_') || '%'
         and pr.id <> auth.uid()
       order by length(pr.nazwa), lower(pr.nazwa)
       limit 5
    ) n;
$$;
revoke all on function public.szukaj_nazw_uzytkownikow(text) from public, anon;
grant execute on function public.szukaj_nazw_uzytkownikow(text) to authenticated;

-- Nazwa konta widoczna dla innych: nazwa użytkownika (wcześniej imię z rejestracji albo początek e-maila).
create or replace function public.nazwa_konta(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select pr.nazwa from public.profile pr where pr.id = u.id),
                  nullif(btrim(u.raw_user_meta_data ->> 'nazwa'), ''), split_part(u.email, '@', 1))
    from auth.users u where u.id = p_id;
$$;
revoke all on function public.nazwa_konta(uuid) from public, anon, authenticated;

-- ---------- Zaproszenia: e-mail albo nazwa użytkownika ----------

alter table public.zaproszenia add column if not exists konto uuid references auth.users (id) on delete cascade;
alter table public.zaproszenia add column if not exists przez_nazwe boolean not null default false;
create index if not exists zaproszenia_konto on public.zaproszenia (konto) where stan = 'czeka';

-- Zaproszona osoba widzi swoje zaproszenia (po adresie konta albo po koncie przy zaproszeniu po nazwie).
-- Zapraszający nie czyta tabeli wprost – listę osób daje osoby_projektu (bez adresów zaproszonych po nazwie).
drop policy if exists "zaproszenia: odczyt" on public.zaproszenia;
create policy "zaproszenia: odczyt" on public.zaproszenia
  for select to authenticated using (
    konto = (select auth.uid())
    or lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

-- Zaproszenie osoby do projektu (tylko właściciel). p_email: adres e-mail ALBO nazwa użytkownika (bez „@”,
-- można z „@” na początku). Ta sama osoba zaproszona drugi raz dostaje odnowione zaproszenie z nową rolą.
-- Ochrona: najwyżej 30 nowych zaproszeń na dobę od jednego konta i 50 czekających w jednym projekcie.
-- Zwraca { id, kod, email (null przy zaproszeniu po nazwie), nazwa (nazwa użytkownika, jeśli jest), rola,
-- wazne_do, konto (czy osoba ma już konto), przez_nazwe }.
create or replace function public.zapros_do_projektu(p_projekt uuid, p_email text, p_rola text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kto text := btrim(coalesce(p_email, ''));
  v_przez_nazwe boolean := position('@' in ltrim(btrim(coalesce(p_email, '')), '@')) = 0;
  v_email text;
  v_konto uuid;
  v_nazwa text;
  z public.zaproszenia%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  if not exists (select 1 from public.projekty p where p.id = p_projekt and p.owner_id = auth.uid()) then
    raise exception 'Zapraszać może tylko właściciel projektu (a projekt musi być zapisany na koncie)' using errcode = '42501';
  end if;
  if p_rola is null or p_rola not in ('edycja', 'odczyt') then
    raise exception 'Nieznana rola: wybierz „może edytować” albo „może oglądać”';
  end if;
  if v_przez_nazwe then
    v_kto := ltrim(v_kto, '@');
    select pr.id, pr.nazwa into v_konto, v_nazwa from public.profile pr where lower(pr.nazwa) = lower(v_kto);
    if v_konto is null then
      raise exception 'Nie ma konta o nazwie użytkownika „%” – sprawdź nazwę albo wpisz adres e-mail', v_kto;
    end if;
    if v_konto = auth.uid() then
      raise exception 'To Twoja nazwa – jesteś właścicielem tego projektu';
    end if;
    select lower(u.email) into v_email from auth.users u where u.id = v_konto;
  else
    v_email := lower(v_kto);
    if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
      raise exception 'To nie wygląda na adres e-mail ani nazwę użytkownika';
    end if;
    if v_email = public.email_konta() then
      raise exception 'To Twój adres – jesteś właścicielem tego projektu';
    end if;
    select u.id into v_konto from auth.users u where lower(u.email) = v_email;
    select pr.nazwa into v_nazwa from public.profile pr where pr.id = v_konto;
  end if;
  if v_konto is not null and exists (select 1 from public.wspolpracownicy w where w.projekt_id = p_projekt and w.uzytkownik = v_konto) then
    raise exception 'Ta osoba już ma dostęp do projektu – rolę zmienisz na liście poniżej';
  end if;

  select * into z from public.zaproszenia
   where projekt_id = p_projekt and stan = 'czeka' and wazne_do > now()
     and (lower(email) = v_email or (v_konto is not null and konto = v_konto));
  if found then
    update public.zaproszenia
       set rola = p_rola, wazne_do = now() + interval '14 days', konto = coalesce(konto, v_konto),
           przez_nazwe = przez_nazwe and v_przez_nazwe
     where id = z.id returning * into z;
  else
    if (select count(*) from public.zaproszenia where zaprosil = auth.uid() and utworzono > now() - interval '1 day') >= 30 then
      raise exception 'Za dużo zaproszeń w ciągu doby – spróbuj jutro';
    end if;
    if (select count(*) from public.zaproszenia where projekt_id = p_projekt and stan = 'czeka' and wazne_do > now()) >= 50 then
      raise exception 'Ten projekt ma już 50 czekających zaproszeń – cofnij niepotrzebne';
    end if;
    insert into public.zaproszenia (projekt_id, email, rola, kod, zaprosil, konto, przez_nazwe)
      values (p_projekt, v_email, p_rola,
              translate(rtrim(encode(extensions.gen_random_bytes(18), 'base64'), '='), '+/', '-_'),
              auth.uid(), v_konto, v_przez_nazwe)
      returning * into z;
  end if;
  return jsonb_build_object('id', z.id, 'kod', z.kod, 'email', case when z.przez_nazwe then null else z.email end,
                            'nazwa', v_nazwa, 'rola', z.rola, 'wazne_do', z.wazne_do,
                            'konto', v_konto is not null, 'przez_nazwe', z.przez_nazwe);
end;
$$;

-- Osoby z dostępem do projektu i czekające zaproszenia. Nazwa użytkownika zamiast adresów: adres e-mail
-- widać tylko przy sobie i przy zaproszeniach wysłanych na adres (zapraszający sam go wpisał).
-- Kod zaproszenia (do skopiowania linku) widzi tylko właściciel.
-- [{ typ: 'wlasciciel'|'wspolpracownik'|'zaproszenie', id, nazwa, email?, rola, od, wazne_do, kod?, ja }]
create or replace function public.osoby_projektu(p_projekt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rola text := public.rola_w_projekcie(p_projekt);
  v_wlasciciel uuid;
  v_wynik jsonb;
begin
  if v_rola is null then
    raise exception 'Nie masz dostępu do tego projektu' using errcode = '42501';
  end if;
  select owner_id into v_wlasciciel from public.projekty where id = p_projekt;
  select coalesce(jsonb_agg(t.x order by t.k, t.od), '[]'::jsonb) into v_wynik from (
    select 0 as k, null::timestamptz as od, jsonb_build_object('typ', 'wlasciciel', 'id', u.id, 'nazwa', public.nazwa_konta(u.id),
             'email', case when u.id = auth.uid() then u.email end, 'rola', 'wlasciciel', 'ja', u.id = auth.uid()) as x
      from auth.users u where u.id = v_wlasciciel
    union all
    select 1, w.dodano, jsonb_build_object('typ', 'wspolpracownik', 'id', u.id, 'nazwa', public.nazwa_konta(u.id),
             'email', case when u.id = auth.uid() then u.email end, 'rola', w.rola, 'od', w.dodano, 'ja', u.id = auth.uid())
      from public.wspolpracownicy w join auth.users u on u.id = w.uzytkownik
     where w.projekt_id = p_projekt
    union all
    select 2, z.utworzono, jsonb_build_object('typ', 'zaproszenie', 'id', z.id,
             'email', case when z.przez_nazwe then null else z.email end,
             'nazwa', case when z.konto is not null then (select pr.nazwa from public.profile pr where pr.id = z.konto) end,
             'rola', z.rola, 'od', z.utworzono, 'wazne_do', z.wazne_do,
             'kod', case when v_rola = 'wlasciciel' then z.kod end, 'ja', false)
      from public.zaproszenia z
     where z.projekt_id = p_projekt and z.stan = 'czeka' and z.wazne_do > now()
  ) as t(k, od, x);
  return v_wynik;
end;
$$;

-- Zaproszenia czekające na zalogowaną osobę: po adresie e-mail konta albo po koncie (zaproszenie po nazwie).
-- [{ id, kod, projekt_id, projekt, rola, od, od_email, utworzono, wazne_do }]
create or replace function public.moje_zaproszenia()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', z.id, 'kod', z.kod, 'projekt_id', z.projekt_id, 'projekt', p.nazwa, 'rola', z.rola,
           'od', public.nazwa_konta(z.zaprosil), 'od_email', (select u.email from auth.users u where u.id = z.zaprosil),
           'utworzono', z.utworzono, 'wazne_do', z.wazne_do) order by z.utworzono desc), '[]'::jsonb)
    from public.zaproszenia z join public.projekty p on p.id = z.projekt_id
   where (z.konto = auth.uid() or lower(z.email) = public.email_konta()) and z.stan = 'czeka' and z.wazne_do > now()
     and auth.uid() is not null
     and p.owner_id <> auth.uid()
     and not exists (select 1 from public.wspolpracownicy w where w.projekt_id = z.projekt_id and w.uzytkownik = auth.uid());
$$;
