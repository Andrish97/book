-- Migracja: współpraca między kontami (decyzja #86).
--
-- Właściciel projektu zaprasza osobę adresem e-mail z rolą „edycja” (zmienia projekt razem z nim, na żywo)
-- albo „odczyt” (tylko ogląda). Zaproszenie to wiersz z jednorazowym kodem ważnym 14 dni: osoba widzi je
-- w aplikacji (skrzynka „Zaproszenia” – po adresie e-mail swojego konta) albo przyjmuje linkiem
-- #/zaproszenie/<kod>. Przyjęte zaproszenie dodaje wiersz do `wspolpracownicy`.
--
-- Dostęp: współpracownik czyta projekt i jego strony (RLS), pliki obrazów w folderze właściciela (Storage)
-- i dostaje zmiany na żywo (Realtime – też przez RLS). Zapis idzie dalej jedną funkcją zapisz_projekt,
-- która teraz sama sprawdza, kto może zapisać (właściciel albo współpracownik z rolą „edycja”), i zawsze
-- zapisuje strony z identyfikatorem właściciela. Pliki obrazów projektu leżą w folderze właściciela, kto by
-- ich nie wgrał – właściciel widzi projekt w całości, a usunięcie projektu sprząta wszystko.
-- Usunąć projekt, zapraszać, zmieniać role i odbierać dostęp może tylko właściciel; współpracownik może
-- sam opuścić projekt.
--
-- Funkcje security definer mają pusty search_path i same sprawdzają, kto pyta.

-- ---------- Tabele ----------

create table if not exists public.wspolpracownicy (
  projekt_id  uuid not null references public.projekty (id) on delete cascade,
  uzytkownik  uuid not null references auth.users (id) on delete cascade,
  rola        text not null check (rola in ('edycja', 'odczyt')),
  zaprosil    uuid references auth.users (id) on delete set null,
  dodano      timestamptz not null default now(),
  primary key (projekt_id, uzytkownik)
);
create index if not exists wspolpracownicy_uzytkownik on public.wspolpracownicy (uzytkownik);
alter table public.wspolpracownicy enable row level security;
revoke all on table public.wspolpracownicy from anon;

create table if not exists public.zaproszenia (
  id          uuid primary key default gen_random_uuid(),
  projekt_id  uuid not null references public.projekty (id) on delete cascade,
  email       text not null,
  rola        text not null check (rola in ('edycja', 'odczyt')),
  kod         text not null unique,
  zaprosil    uuid not null references auth.users (id) on delete cascade,
  utworzono   timestamptz not null default now(),
  wazne_do    timestamptz not null default now() + interval '14 days',
  stan        text not null default 'czeka' check (stan in ('czeka', 'przyjete', 'odrzucone')),
  przyjal     uuid references auth.users (id) on delete set null
);
create index if not exists zaproszenia_email on public.zaproszenia (lower(email)) where stan = 'czeka';
create index if not exists zaproszenia_projekt on public.zaproszenia (projekt_id);
create index if not exists zaproszenia_zaprosil on public.zaproszenia (zaprosil, utworzono);
alter table public.zaproszenia enable row level security;
revoke all on table public.zaproszenia from anon;

-- ---------- Kto ma dostęp ----------

-- Czy zalogowana osoba jest współpracownikiem projektu (dowolna rola). Bez zapytania o `projekty` – reguła
-- RLS tej tabeli może więc z niej korzystać bez zapętlenia.
create or replace function public.czy_wspolpracownik(p_projekt uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.wspolpracownicy w where w.projekt_id = p_projekt and w.uzytkownik = auth.uid());
$$;

-- 'wlasciciel' | 'edycja' | 'odczyt' | null.
create or replace function public.rola_w_projekcie(p_projekt uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.projekty p where p.id = p_projekt and p.owner_id = auth.uid()) then 'wlasciciel'
    else (select w.rola from public.wspolpracownicy w where w.projekt_id = p_projekt and w.uzytkownik = auth.uid())
  end;
$$;

-- Pliki projektu w Storage: <właściciel>/<projekt>/<plik>. Czy współpracownik może je czytać (p_zapis=false)
-- albo zapisywać i usuwać (p_zapis=true – tylko rola „edycja”). Porównanie tekstowe: folder, który nie jest
-- identyfikatorem (np. „_czcionki”), po prostu nie pasuje.
create or replace function public.dostep_do_plikow(p_wlasciciel text, p_projekt text, p_zapis boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wspolpracownicy w
      join public.projekty p on p.id = w.projekt_id
     where w.uzytkownik = auth.uid()
       and p.id::text = p_projekt and p.owner_id::text = p_wlasciciel
       and (not p_zapis or w.rola = 'edycja'));
$$;

revoke all on function public.czy_wspolpracownik(uuid) from public, anon;
revoke all on function public.rola_w_projekcie(uuid) from public, anon;
revoke all on function public.dostep_do_plikow(text, text, boolean) from public, anon;
grant execute on function public.czy_wspolpracownik(uuid) to authenticated;
grant execute on function public.rola_w_projekcie(uuid) to authenticated;
grant execute on function public.dostep_do_plikow(text, text, boolean) to authenticated;

-- ---------- Reguły dostępu (RLS) ----------

drop policy if exists "projekty: odczyt udostępnionych" on public.projekty;
create policy "projekty: odczyt udostępnionych" on public.projekty
  for select to authenticated using (public.czy_wspolpracownik(id));

drop policy if exists "strony: odczyt udostępnionych" on public.projekty_strony;
create policy "strony: odczyt udostępnionych" on public.projekty_strony
  for select to authenticated using (public.czy_wspolpracownik(projekt_id));

-- Własne wiersze współpracy (lista „Udostępnione mi”, zmiany na żywo) i wiersze w projektach, których się
-- jest właścicielem.
drop policy if exists "wspolpracownicy: odczyt" on public.wspolpracownicy;
create policy "wspolpracownicy: odczyt" on public.wspolpracownicy
  for select to authenticated using (
    uzytkownik = (select auth.uid())
    or exists (select 1 from public.projekty p where p.id = projekt_id and p.owner_id = (select auth.uid())));

-- Zaproszenia: widzi je zaproszona osoba (adres konta) i właściciel projektu. Zmiany tylko przez funkcje.
drop policy if exists "zaproszenia: odczyt" on public.zaproszenia;
create policy "zaproszenia: odczyt" on public.zaproszenia
  for select to authenticated using (
    lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    or zaprosil = (select auth.uid()));

grant select on table public.wspolpracownicy to authenticated;
grant select on table public.zaproszenia to authenticated;

drop policy if exists "zasoby: projekt współdzielony - odczyt" on storage.objects;
create policy "zasoby: projekt współdzielony - odczyt" on storage.objects
  for select to authenticated
  using (bucket_id = 'zasoby' and public.dostep_do_plikow((storage.foldername(name))[1], (storage.foldername(name))[2], false));

drop policy if exists "zasoby: projekt współdzielony - dodawanie" on storage.objects;
create policy "zasoby: projekt współdzielony - dodawanie" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'zasoby' and public.dostep_do_plikow((storage.foldername(name))[1], (storage.foldername(name))[2], true));

drop policy if exists "zasoby: projekt współdzielony - zmiana" on storage.objects;
create policy "zasoby: projekt współdzielony - zmiana" on storage.objects
  for update to authenticated
  using (bucket_id = 'zasoby' and public.dostep_do_plikow((storage.foldername(name))[1], (storage.foldername(name))[2], true));

drop policy if exists "zasoby: projekt współdzielony - usuwanie" on storage.objects;
create policy "zasoby: projekt współdzielony - usuwanie" on storage.objects
  for delete to authenticated
  using (bucket_id = 'zasoby' and public.dostep_do_plikow((storage.foldername(name))[1], (storage.foldername(name))[2], true));

-- ---------- Zmiany na żywo ----------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'zaproszenia') then
    alter publication supabase_realtime add table public.zaproszenia;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wspolpracownicy') then
    alter publication supabase_realtime add table public.wspolpracownicy;
  end if;
end
$$;

-- ---------- Zapis projektu: właściciel albo współpracownik z rolą „edycja” ----------
-- Jak w 20261110090000_strony_osobno.sql, ale security definer: sama sprawdza, kto zapisuje, a strony
-- zapisuje zawsze z identyfikatorem właściciela projektu (nie zapisującego).
create or replace function public.zapisz_projekt(
  p_id uuid, p_znana_wersja bigint, p_wymus boolean, p_nazwa text,
  p_dane jsonb, p_zmieniono timestamptz, p_strony jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wersja bigint;
  v_zmieniono timestamptz;
  v_wlasciciel uuid;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  select wersja, zmieniono, owner_id into v_wersja, v_zmieniono, v_wlasciciel
    from public.projekty where id = p_id for update;
  if not found then
    insert into public.projekty (id, owner_id, nazwa, dane, zmieniono, wersja)
      values (p_id, auth.uid(), p_nazwa, p_dane, p_zmieniono, 1);
    v_wersja := 1;
    v_wlasciciel := auth.uid();
  else
    if v_wlasciciel <> auth.uid() and not exists (
      select 1 from public.wspolpracownicy w where w.projekt_id = p_id and w.uzytkownik = auth.uid() and w.rola = 'edycja'
    ) then
      raise exception 'Nie masz prawa zmieniać tego projektu' using errcode = '42501';
    end if;
    if not coalesce(p_wymus, false) and (p_znana_wersja is null or p_znana_wersja <> v_wersja) then
      return jsonb_build_object('konflikt', true, 'wersja', v_wersja, 'zmieniono', v_zmieniono);
    end if;
    v_wersja := v_wersja + 1;
    update public.projekty
      set nazwa = p_nazwa, dane = p_dane, zmieniono = p_zmieniono, wersja = v_wersja
      where id = p_id;
  end if;

  insert into public.projekty_strony (projekt_id, strona_id, owner_id, dane)
    select p_id, x->>'id', v_wlasciciel, x->'dane'
      from jsonb_array_elements(coalesce(p_strony, '[]'::jsonb)) as x
    on conflict (projekt_id, strona_id) do update set dane = excluded.dane;

  delete from public.projekty_strony s
    where s.projekt_id = p_id
      and not exists (
        select 1 from jsonb_array_elements_text(coalesce(p_dane->'strony', '[]'::jsonb)) as k(id)
        where k.id = s.strona_id
      );

  return jsonb_build_object('wersja', v_wersja);
end;
$$;

revoke all on function public.zapisz_projekt(uuid, bigint, boolean, text, jsonb, timestamptz, jsonb) from public, anon;
grant execute on function public.zapisz_projekt(uuid, bigint, boolean, text, jsonb, timestamptz, jsonb) to authenticated;

-- ---------- Pomocnicze ----------

create or replace function public.nazwa_konta(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nazwa'), ''), split_part(u.email, '@', 1))
    from auth.users u where u.id = p_id;
$$;
revoke all on function public.nazwa_konta(uuid) from public, anon, authenticated;

create or replace function public.email_konta()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u where u.id = auth.uid();
$$;
revoke all on function public.email_konta() from public, anon, authenticated;

-- ---------- Zaproszenia ----------

-- Zaproszenie osoby do projektu (tylko właściciel). Ten sam adres zaproszony drugi raz dostaje odnowione
-- zaproszenie z nową rolą i tym samym kodem. Ochrona przed nadużyciem: najwyżej 30 nowych zaproszeń na dobę
-- od jednego konta i 50 czekających w jednym projekcie.
-- Zwraca { id, kod, email, rola, wazne_do, konto (czy adres ma już konto w Seriodruku) }.
create or replace function public.zapros_do_projektu(p_projekt uuid, p_email text, p_rola text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_konto uuid;
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
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    raise exception 'To nie wygląda na adres e-mail';
  end if;
  if v_email = public.email_konta() then
    raise exception 'To Twój adres – jesteś właścicielem tego projektu';
  end if;
  select u.id into v_konto from auth.users u where lower(u.email) = v_email;
  if v_konto is not null and exists (select 1 from public.wspolpracownicy w where w.projekt_id = p_projekt and w.uzytkownik = v_konto) then
    raise exception 'Ta osoba już ma dostęp do projektu – rolę zmienisz na liście poniżej';
  end if;

  select * into z from public.zaproszenia
   where projekt_id = p_projekt and lower(email) = v_email and stan = 'czeka' and wazne_do > now();
  if found then
    update public.zaproszenia set rola = p_rola, wazne_do = now() + interval '14 days'
     where id = z.id returning * into z;
  else
    if (select count(*) from public.zaproszenia where zaprosil = auth.uid() and utworzono > now() - interval '1 day') >= 30 then
      raise exception 'Za dużo zaproszeń w ciągu doby – spróbuj jutro';
    end if;
    if (select count(*) from public.zaproszenia where projekt_id = p_projekt and stan = 'czeka' and wazne_do > now()) >= 50 then
      raise exception 'Ten projekt ma już 50 czekających zaproszeń – cofnij niepotrzebne';
    end if;
    insert into public.zaproszenia (projekt_id, email, rola, kod, zaprosil)
      values (p_projekt, v_email, p_rola,
              translate(rtrim(encode(extensions.gen_random_bytes(18), 'base64'), '='), '+/', '-_'),
              auth.uid())
      returning * into z;
  end if;
  return jsonb_build_object('id', z.id, 'kod', z.kod, 'email', z.email, 'rola', z.rola, 'wazne_do', z.wazne_do,
                            'konto', v_konto is not null);
end;
$$;

-- Osoby z dostępem do projektu i czekające zaproszenia – dla każdego, kto ma dostęp. Kod zaproszenia
-- (do skopiowania linku) widzi tylko właściciel.
-- [{ typ: 'wlasciciel'|'wspolpracownik'|'zaproszenie', id, nazwa, email, rola, od, wazne_do, kod?, ja }]
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
             'email', u.email, 'rola', 'wlasciciel', 'ja', u.id = auth.uid()) as x
      from auth.users u where u.id = v_wlasciciel
    union all
    select 1, w.dodano, jsonb_build_object('typ', 'wspolpracownik', 'id', u.id, 'nazwa', public.nazwa_konta(u.id),
             'email', u.email, 'rola', w.rola, 'od', w.dodano, 'ja', u.id = auth.uid())
      from public.wspolpracownicy w join auth.users u on u.id = w.uzytkownik
     where w.projekt_id = p_projekt
    union all
    select 2, z.utworzono, jsonb_build_object('typ', 'zaproszenie', 'id', z.id, 'email', z.email, 'rola', z.rola,
             'od', z.utworzono, 'wazne_do', z.wazne_do, 'kod', case when v_rola = 'wlasciciel' then z.kod end, 'ja', false)
      from public.zaproszenia z
     where z.projekt_id = p_projekt and z.stan = 'czeka' and z.wazne_do > now()
  ) as t(k, od, x);
  return v_wynik;
end;
$$;

-- Cofnięcie czekającego zaproszenia (właściciel).
create or replace function public.cofnij_zaproszenie(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  delete from public.zaproszenia z
   where z.id = p_id
     and exists (select 1 from public.projekty p where p.id = z.projekt_id and p.owner_id = auth.uid());
end;
$$;

-- Zmiana roli współpracownika (właściciel).
create or replace function public.zmien_role_wspolpracownika(p_projekt uuid, p_uzytkownik uuid, p_rola text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  if p_rola is null or p_rola not in ('edycja', 'odczyt') then
    raise exception 'Nieznana rola';
  end if;
  if not exists (select 1 from public.projekty p where p.id = p_projekt and p.owner_id = auth.uid()) then
    raise exception 'Role zmienia tylko właściciel projektu' using errcode = '42501';
  end if;
  update public.wspolpracownicy set rola = p_rola where projekt_id = p_projekt and uzytkownik = p_uzytkownik;
end;
$$;

-- Odebranie dostępu (właściciel – dowolnemu współpracownikowi) albo opuszczenie projektu (współpracownik –
-- sobie). Dostęp znika od razu: kolejne zapytania o projekt, jego strony i pliki już nie przejdą.
create or replace function public.usun_z_projektu(p_projekt uuid, p_uzytkownik uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  if p_uzytkownik <> auth.uid()
     and not exists (select 1 from public.projekty p where p.id = p_projekt and p.owner_id = auth.uid()) then
    raise exception 'Dostęp odbiera tylko właściciel projektu' using errcode = '42501';
  end if;
  delete from public.wspolpracownicy where projekt_id = p_projekt and uzytkownik = p_uzytkownik;
end;
$$;

-- Zaproszenia czekające na zalogowaną osobę (po adresie e-mail konta).
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
   where lower(z.email) = public.email_konta() and z.stan = 'czeka' and z.wazne_do > now()
     and auth.uid() is not null
     and p.owner_id <> auth.uid()
     and not exists (select 1 from public.wspolpracownicy w where w.projekt_id = z.projekt_id and w.uzytkownik = auth.uid());
$$;

-- Co jest pod kodem z linku (przed przyjęciem). { stan: 'ok'|'brak'|'wygaslo'|'przyjete'|'odrzucone'|
-- 'wlasciciel'|'juz_masz', projekt, projekt_id, rola, od, email }
create or replace function public.zaproszenie_z_kodu(p_kod text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  z public.zaproszenia%rowtype;
  p public.projekty%rowtype;
  v_info jsonb;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  select * into z from public.zaproszenia where kod = p_kod;
  if not found then
    return jsonb_build_object('stan', 'brak');
  end if;
  select * into p from public.projekty where id = z.projekt_id;
  v_info := jsonb_build_object('projekt', p.nazwa, 'projekt_id', p.id, 'rola', z.rola, 'od', public.nazwa_konta(z.zaprosil), 'email', z.email);
  if p.owner_id = auth.uid() then
    return v_info || jsonb_build_object('stan', 'wlasciciel');
  end if;
  if exists (select 1 from public.wspolpracownicy w where w.projekt_id = p.id and w.uzytkownik = auth.uid()) then
    return v_info || jsonb_build_object('stan', 'juz_masz');
  end if;
  if z.stan <> 'czeka' then
    return v_info || jsonb_build_object('stan', z.stan);
  end if;
  if z.wazne_do <= now() then
    return v_info || jsonb_build_object('stan', 'wygaslo');
  end if;
  return v_info || jsonb_build_object('stan', 'ok');
end;
$$;

-- Przyjęcie zaproszenia kodem (z linku albo ze skrzynki). Kod jest jednorazowy: przyjąć może zalogowana
-- osoba, która go ma – także z innym adresem niż ten, na który poszło zaproszenie (np. konto firmowe
-- zamiast prywatnego); właściciel widzi na liście osób, kto naprawdę dołączył, i może odebrać dostęp.
-- Zwraca { projekt_id, rola }.
create or replace function public.przyjmij_zaproszenie(p_kod text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  z public.zaproszenia%rowtype;
  v_wlasciciel uuid;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  select * into z from public.zaproszenia where kod = p_kod for update;
  if not found then
    raise exception 'Nie ma takiego zaproszenia – mogło zostać cofnięte';
  end if;
  select owner_id into v_wlasciciel from public.projekty where id = z.projekt_id;
  if v_wlasciciel = auth.uid() then
    raise exception 'To Twój projekt – nie musisz przyjmować zaproszenia';
  end if;
  if exists (select 1 from public.wspolpracownicy w where w.projekt_id = z.projekt_id and w.uzytkownik = auth.uid()) then
    return jsonb_build_object('projekt_id', z.projekt_id,
      'rola', (select w.rola from public.wspolpracownicy w where w.projekt_id = z.projekt_id and w.uzytkownik = auth.uid()));
  end if;
  if z.stan <> 'czeka' then
    raise exception 'To zaproszenie zostało już wykorzystane albo odrzucone';
  end if;
  if z.wazne_do <= now() then
    raise exception 'Zaproszenie wygasło – poproś o nowe';
  end if;
  insert into public.wspolpracownicy (projekt_id, uzytkownik, rola, zaprosil)
    values (z.projekt_id, auth.uid(), z.rola, z.zaprosil);
  update public.zaproszenia set stan = 'przyjete', przyjal = auth.uid() where id = z.id;
  return jsonb_build_object('projekt_id', z.projekt_id, 'rola', z.rola);
end;
$$;

-- Odrzucenie zaproszenia (zaproszona osoba – po adresie konta – albo ktoś z kodem z linku).
create or replace function public.odrzuc_zaproszenie(p_kod text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  update public.zaproszenia set stan = 'odrzucone' where kod = p_kod and stan = 'czeka';
end;
$$;

-- Projekty innych osób, do których mam dostęp: [{ projekt_id, rola, wlasciciel, wlasciciel_email, od }].
create or replace function public.udostepnione_mi()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'projekt_id', w.projekt_id, 'rola', w.rola, 'wlasciciel', public.nazwa_konta(p.owner_id),
           'wlasciciel_email', (select u.email from auth.users u where u.id = p.owner_id), 'od', w.dodano)), '[]'::jsonb)
    from public.wspolpracownicy w join public.projekty p on p.id = w.projekt_id
   where w.uzytkownik = auth.uid();
$$;

revoke all on function public.zapros_do_projektu(uuid, text, text) from public, anon;
revoke all on function public.osoby_projektu(uuid) from public, anon;
revoke all on function public.cofnij_zaproszenie(uuid) from public, anon;
revoke all on function public.zmien_role_wspolpracownika(uuid, uuid, text) from public, anon;
revoke all on function public.usun_z_projektu(uuid, uuid) from public, anon;
revoke all on function public.moje_zaproszenia() from public, anon;
revoke all on function public.zaproszenie_z_kodu(text) from public, anon;
revoke all on function public.przyjmij_zaproszenie(text) from public, anon;
revoke all on function public.odrzuc_zaproszenie(text) from public, anon;
revoke all on function public.udostepnione_mi() from public, anon;
grant execute on function public.zapros_do_projektu(uuid, text, text) to authenticated;
grant execute on function public.osoby_projektu(uuid) to authenticated;
grant execute on function public.cofnij_zaproszenie(uuid) to authenticated;
grant execute on function public.zmien_role_wspolpracownika(uuid, uuid, text) to authenticated;
grant execute on function public.usun_z_projektu(uuid, uuid) to authenticated;
grant execute on function public.moje_zaproszenia() to authenticated;
grant execute on function public.zaproszenie_z_kodu(text) to authenticated;
grant execute on function public.przyjmij_zaproszenie(text) to authenticated;
grant execute on function public.odrzuc_zaproszenie(text) to authenticated;
grant execute on function public.udostepnione_mi() to authenticated;

-- ---------- Obrazy od AI w projekcie współdzielonym ----------
-- Obraz wgrany przez AI czeka w tabeli obrazy_ai, aż aplikacja przeniesie go do folderu plików. Odtąd może
-- to zrobić także współpracownik z rolą „edycja” (pobranie i usunięcie wiersza), a obejrzeć – każdy
-- współpracownik. Poza sprawdzeniem dostępu bez zmian względem 20261112150000_obrazy_ai_kawalki.sql
-- i 20261112090000_obrazy_ai.sql.

create or replace function public.pobierz_obraz_ai(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.obrazy_ai%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  select * into o from public.obrazy_ai where id = p_id and gotowy;
  if not found or public.rola_w_projekcie(o.projekt_id) is null then
    raise exception 'Nie ma takiego obrazu (mógł już przejść na konto)';
  end if;
  if o.dane is null then
    return jsonb_build_object('typ', o.typ, 'nazwa', o.nazwa, 'rozmiar', o.rozmiar, 'skrot', o.skrot, 'czesci', o.czesci);
  end if;
  return jsonb_build_object('typ', o.typ, 'nazwa', o.nazwa, 'dane', encode(o.dane, 'base64'));
end;
$$;

create or replace function public.pobierz_czesc_obrazu_ai(p_id uuid, p_nr integer)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v bytea;
  v_projekt uuid;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  select c.dane, o.projekt_id into v, v_projekt from public.obrazy_ai_czesci c
    join public.obrazy_ai o on o.id = c.wiersz
   where c.wiersz = p_id and c.nr = p_nr and o.gotowy;
  if not found or public.rola_w_projekcie(v_projekt) is null then
    raise exception 'Nie ma takiego kawałka obrazu';
  end if;
  return encode(v, 'base64');
end;
$$;

create or replace function public.usun_obraz_ai(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  delete from public.obrazy_ai o
   where o.id = p_id and public.rola_w_projekcie(o.projekt_id) in ('wlasciciel', 'edycja');
end;
$$;

create or replace function public.pliki_do_usuniecia(p_projekt uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(sciezka), '{}') from public.zasoby_do_usuniecia
   where projekt_id = p_projekt and public.rola_w_projekcie(p_projekt) in ('wlasciciel', 'edycja');
$$;

create or replace function public.pliki_usuniete(p_projekt uuid, p_sciezki text[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.zasoby_do_usuniecia
   where projekt_id = p_projekt and public.rola_w_projekcie(p_projekt) in ('wlasciciel', 'edycja')
     and sciezka = any(p_sciezki);
$$;

-- ---------- Obecność: kanał prywatny „obecnosc-<projekt>” tylko dla osób z dostępem ----------
-- Kto jest w projekcie i co ma zaznaczone (js/app/obecnosc.js) idzie kanałem Realtime z obecnością.
-- Kanał jest prywatny: Realtime pyta o regułę na realtime.messages, a ta wpuszcza tylko właściciela
-- i współpracowników projektu. Reguły powstają tylko tam, gdzie jest schemat realtime (Supabase).
create or replace function public.obecnosc_dozwolona(p_temat text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_temat is null or p_temat !~ '^obecnosc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.rola_w_projekcie(substring(p_temat from 10)::uuid) is not null;
end;
$$;
revoke all on function public.obecnosc_dozwolona(text) from public, anon;
grant execute on function public.obecnosc_dozwolona(text) to authenticated;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "obecnosc: odczyt" on realtime.messages';
    execute 'create policy "obecnosc: odczyt" on realtime.messages for select to authenticated using (public.obecnosc_dozwolona(realtime.topic()))';
    execute 'drop policy if exists "obecnosc: zapis" on realtime.messages';
    execute 'create policy "obecnosc: zapis" on realtime.messages for insert to authenticated with check (public.obecnosc_dozwolona(realtime.topic()))';
  end if;
end
$$;

-- ---------- E-mail z zaproszeniem (Funkcja Edge zaproszenie-mail, Brevo) ----------
-- Funkcja Edge woła tę funkcję tokenem zapraszającego: dostaje dane do wiadomości tylko dla czekającego
-- zaproszenia w jego projekcie i najwyżej raz na 10 minut na to samo zaproszenie (ochrona przed zasypaniem
-- czyjejś skrzynki). Klucza serwisowego nie potrzeba.
alter table public.zaproszenia add column if not exists mail_wyslany timestamptz;

create or replace function public.dane_maila_zaproszenia(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  z public.zaproszenia%rowtype;
  p public.projekty%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  select * into z from public.zaproszenia where id = p_id for update;
  if not found then
    raise exception 'Nie ma takiego zaproszenia';
  end if;
  select * into p from public.projekty where id = z.projekt_id;
  if p.owner_id <> auth.uid() then
    raise exception 'Zaproszenie wysyła tylko właściciel projektu' using errcode = '42501';
  end if;
  if z.stan <> 'czeka' or z.wazne_do <= now() then
    raise exception 'To zaproszenie nie czeka już na przyjęcie';
  end if;
  if z.mail_wyslany is not null and z.mail_wyslany > now() - interval '10 minutes' then
    raise exception 'E-mail z tym zaproszeniem poszedł przed chwilą – następny można wysłać za kilka minut';
  end if;
  update public.zaproszenia set mail_wyslany = now() where id = z.id;
  return jsonb_build_object(
    'email', z.email, 'kod', z.kod, 'rola', z.rola, 'wazne_do', z.wazne_do, 'projekt', p.nazwa,
    'od', public.nazwa_konta(p.owner_id), 'od_email', (select u.email from auth.users u where u.id = p.owner_id),
    'konto', exists (select 1 from auth.users u where lower(u.email) = lower(z.email)));
end;
$$;
revoke all on function public.dane_maila_zaproszenia(uuid) from public, anon;
grant execute on function public.dane_maila_zaproszenia(uuid) to authenticated;
