-- Powiadomienia push (decyzja #113) – wzorem Familiady (migracja 526_push_notifications).
--
-- powiadomienia_urzadzenia – urządzenia (przeglądarki), na których konto włączyło powiadomienia,
--   z rodzajami, które chce dostawać.
-- powiadomienia_kolejka – zdarzenia do wysłania. Dopisują je tylko wyzwalacze na tabelach współpracy
--   (zaproszenia, wspolpracownicy); wysyła wyłącznie Funkcja Edge powiadomienia (klucz prywatny VAPID jest
--   tylko tam). Przebieg kolejki zleca aplikacja od razu po zmianie (zaproszenie, rola, odebranie dostępu,
--   przyjęcie) i Cron Workera co minutę (zmiany zrobione inną drogą).
--
-- Rodzaje (przełączniki w Ustawieniach konta → Powiadomienia):
--   zaproszenia – ktoś mnie zaprosił albo udostępnił mi projekt,
--   odpowiedzi  – ktoś przyjął albo odrzucił moje zaproszenie,
--   dostep      – zmieniono moją rolę w projekcie albo odebrano mi dostęp.

create table if not exists public.powiadomienia_urzadzenia (
  id          uuid primary key default gen_random_uuid(),
  uzytkownik  uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique check (char_length(endpoint) between 20 and 1000),
  p256dh      text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth        text not null check (auth ~ '^[A-Za-z0-9_-]{16,32}$'),
  rodzaje     text[] not null default '{zaproszenia,odpowiedzi,dostep}' check (cardinality(rodzaje) <= 10),
  utworzono   timestamptz not null default now(),
  zmieniono   timestamptz not null default now(),
  ostatnio_ok timestamptz,
  bledy       integer not null default 0
);
create index if not exists powiadomienia_urzadzenia_uzytkownik on public.powiadomienia_urzadzenia (uzytkownik);
alter table public.powiadomienia_urzadzenia enable row level security;

create table if not exists public.powiadomienia_kolejka (
  id          bigint generated always as identity primary key,
  uzytkownik  uuid not null references auth.users (id) on delete cascade,
  zdarzenie   text not null check (zdarzenie ~ '^[a-z_]{2,30}$'),
  rodzaj      text not null check (rodzaj in ('zaproszenia', 'odpowiedzi', 'dostep')),
  dane        jsonb not null default '{}' check (pg_column_size(dane) <= 2000),
  utworzono   timestamptz not null default now(),
  pobrano     timestamptz,
  proby       integer not null default 0,
  wyslano     timestamptz,
  dostarczono integer not null default 0,
  nieudane    integer not null default 0,
  blad        text check (char_length(blad) <= 200)
);
create index if not exists powiadomienia_kolejka_czeka on public.powiadomienia_kolejka (id) where wyslano is null;
alter table public.powiadomienia_kolejka enable row level security;

revoke all on table public.powiadomienia_urzadzenia, public.powiadomienia_kolejka from public, anon, authenticated;

-- Dozwolone usługi push (adres z przeglądarki) – serwer nie wyśle niczego pod dowolny adres.
create or replace function public.push_adres_dozwolony(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_endpoint ~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]*push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/[^\s]+$', false)
$$;

-- Zdarzenie dla konta – tylko gdy konto ma jakieś urządzenie z tym rodzajem.
create or replace function public.push_zdarzenie(p_uzytkownik uuid, p_zdarzenie text, p_dane jsonb default '{}')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rodzaj text := case
    when p_zdarzenie in ('zaproszenie', 'udostepniono') then 'zaproszenia'
    when p_zdarzenie in ('przyjete', 'odrzucone') then 'odpowiedzi'
    else 'dostep' end;
  v_id bigint;
begin
  if p_uzytkownik is null or not exists (
    select 1 from public.powiadomienia_urzadzenia d where d.uzytkownik = p_uzytkownik and v_rodzaj = any (d.rodzaje)
  ) then
    return null;
  end if;
  insert into public.powiadomienia_kolejka (uzytkownik, zdarzenie, rodzaj, dane)
    values (p_uzytkownik, p_zdarzenie, v_rodzaj, coalesce(p_dane, '{}'))
    returning id into v_id;
  return v_id;
end;
$$;

-- ---------- Źródła zdarzeń ----------

-- Zaproszenie: nowe albo wysłane ponownie (dłuższa ważność) → zaproszona osoba, jeśli ma konto
-- (po nazwie użytkownika – konto, po adresie – konto z tym adresem).
-- Odpowiedź na zaproszenie (przyjęte / odrzucone) → osoba, która zaprosiła.
create or replace function public._push_zaproszenia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_komu uuid;
  v_projekt text;
begin
  select p.nazwa into v_projekt from public.projekty p where p.id = new.projekt_id;
  if new.stan = 'czeka' and (tg_op = 'INSERT' or (old.stan = 'czeka' and new.wazne_do > old.wazne_do)) then
    v_komu := coalesce(new.konto, (select u.id from auth.users u where lower(u.email) = lower(new.email) limit 1));
    if v_komu is not null and v_komu <> new.zaprosil then
      perform public.push_zdarzenie(v_komu, 'zaproszenie', jsonb_build_object(
        'projekt_id', new.projekt_id, 'projekt', left(coalesce(v_projekt, ''), 80),
        'kto', left(coalesce(public.nazwa_konta(new.zaprosil), ''), 60), 'rola', new.rola, 'kod', new.kod));
    end if;
  elsif tg_op = 'UPDATE' and old.stan = 'czeka' and new.stan in ('przyjete', 'odrzucone') then
    perform public.push_zdarzenie(new.zaprosil, case when new.stan = 'przyjete' then 'przyjete' else 'odrzucone' end,
      jsonb_build_object('projekt_id', new.projekt_id, 'projekt', left(coalesce(v_projekt, ''), 80),
        'kto', left(coalesce(public.nazwa_konta(coalesce(new.przyjal, auth.uid(), new.konto)), ''), 60)));
  end if;
  return null;
exception when others then
  -- powiadomienie nigdy nie blokuje samej zmiany
  raise warning '_push_zaproszenia: %', sqlerrm;
  return null;
end;
$$;
drop trigger if exists push_zaproszenia on public.zaproszenia;
create trigger push_zaproszenia after insert or update on public.zaproszenia
  for each row execute function public._push_zaproszenia();

-- Współpracownicy: dodany przez kogoś innego (udostępnienie bez zaproszenia), zmiana roli, odebranie dostępu.
-- Przyjęcie własnego zaproszenia i opuszczenie projektu (osoba robi to sama) – bez powiadomienia dla niej.
-- Usunięcie całego projektu (kaskada) – bez powiadomienia: projektu już nie ma.
create or replace function public._push_wspolpracownicy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_projekt text;
  v_wlasciciel uuid;
begin
  if tg_op = 'DELETE' then
    select p.nazwa, p.owner_id into v_projekt, v_wlasciciel from public.projekty p where p.id = old.projekt_id;
    if v_projekt is null or auth.uid() is not distinct from old.uzytkownik then return null; end if;
    perform public.push_zdarzenie(old.uzytkownik, 'odebrano', jsonb_build_object(
      'projekt_id', old.projekt_id, 'projekt', left(v_projekt, 80),
      'kto', left(coalesce(public.nazwa_konta(v_wlasciciel), ''), 60)));
    return null;
  end if;
  select p.nazwa, p.owner_id into v_projekt, v_wlasciciel from public.projekty p where p.id = new.projekt_id;
  if auth.uid() is not distinct from new.uzytkownik then return null; end if;
  if tg_op = 'INSERT' then
    perform public.push_zdarzenie(new.uzytkownik, 'udostepniono', jsonb_build_object(
      'projekt_id', new.projekt_id, 'projekt', left(coalesce(v_projekt, ''), 80),
      'kto', left(coalesce(public.nazwa_konta(coalesce(auth.uid(), v_wlasciciel)), ''), 60), 'rola', new.rola));
  elsif new.rola is distinct from old.rola then
    perform public.push_zdarzenie(new.uzytkownik, 'rola', jsonb_build_object(
      'projekt_id', new.projekt_id, 'projekt', left(coalesce(v_projekt, ''), 80),
      'kto', left(coalesce(public.nazwa_konta(v_wlasciciel), ''), 60), 'rola', new.rola));
  end if;
  return null;
exception when others then
  raise warning '_push_wspolpracownicy: %', sqlerrm;
  return null;
end;
$$;
drop trigger if exists push_wspolpracownicy on public.wspolpracownicy;
create trigger push_wspolpracownicy after insert or update or delete on public.wspolpracownicy
  for each row execute function public._push_wspolpracownicy();

-- ---------- Aplikacja: urządzenia zalogowanej osoby ----------

create or replace function public.push_zapisz_urzadzenie(p_endpoint text, p_p256dh text, p_auth text, p_rodzaje text[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rodzaje text[] := coalesce(p_rodzaje, '{zaproszenia,odpowiedzi,dostep}');
begin
  if v_uid is null then raise exception 'Brak sesji'; end if;
  if not public.push_adres_dozwolony(p_endpoint) then
    raise exception 'Ta przeglądarka podała nieznaną usługę powiadomień';
  end if;
  if exists (select 1 from unnest(v_rodzaje) r where r not in ('zaproszenia', 'odpowiedzi', 'dostep')) then
    raise exception 'Nieznany rodzaj powiadomień';
  end if;
  insert into public.powiadomienia_urzadzenia (uzytkownik, endpoint, p256dh, auth, rodzaje, zmieniono)
    values (v_uid, p_endpoint, p_p256dh, p_auth, v_rodzaje, clock_timestamp())
  on conflict (endpoint) do update set uzytkownik = v_uid, p256dh = excluded.p256dh, auth = excluded.auth,
    rodzaje = excluded.rodzaje, zmieniono = clock_timestamp(), bledy = 0;
  -- najwyżej 20 urządzeń na konto: najstarsze odpadają
  delete from public.powiadomienia_urzadzenia where id in (
    select id from public.powiadomienia_urzadzenia where uzytkownik = v_uid order by zmieniono desc offset 20);
  return jsonb_build_object('wlaczone', true, 'rodzaje', to_jsonb(v_rodzaje));
end;
$$;

create or replace function public.push_usun_urzadzenie(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Brak sesji'; end if;
  delete from public.powiadomienia_urzadzenia where endpoint = p_endpoint and uzytkownik = auth.uid();
end;
$$;

-- { wlaczone, rodzaje } dla tego urządzenia.
create or replace function public.push_urzadzenie(p_endpoint text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('wlaczone', true, 'rodzaje', to_jsonb(d.rodzaje))
       from public.powiadomienia_urzadzenia d where d.endpoint = p_endpoint and d.uzytkownik = auth.uid()),
    jsonb_build_object('wlaczone', false, 'rodzaje', '[]'::jsonb))
$$;

-- ---------- Wysyłka (Funkcja Edge powiadomienia, klucz serwisowy) ----------

-- Partia zdarzeń do wysłania razem z urządzeniami adresatów (tylko te, które chcą danego rodzaju).
create or replace function public.push_kolejka_pobierz(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wynik jsonb;
begin
  -- sprzątanie: wysłane i porzucone starsze niż 14 dni
  delete from public.powiadomienia_kolejka where utworzono < now() - interval '14 days';
  with wziete as (
    update public.powiadomienia_kolejka k set pobrano = now(), proby = k.proby + 1
     where k.id in (
       select id from public.powiadomienia_kolejka
        where wyslano is null and proby < 5 and utworzono > now() - interval '1 day'
          and (pobrano is null or pobrano < now() - interval '2 minutes')
        order by id limit greatest(1, least(coalesce(p_limit, 50), 200))
        for update skip locked)
    returning k.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', w.id, 'zdarzenie', w.zdarzenie, 'rodzaj', w.rodzaj, 'dane', w.dane, 'utworzono', w.utworzono,
           'urzadzenia', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'endpoint', d.endpoint, 'p256dh', d.p256dh, 'auth', d.auth))
                                     from public.powiadomienia_urzadzenia d
                                    where d.uzytkownik = w.uzytkownik and w.rodzaj = any (d.rodzaje)), '[]'::jsonb)
         ) order by w.id), '[]'::jsonb)
    into v_wynik from wziete w;
  return v_wynik;
end;
$$;

-- Wynik jednego zdarzenia i urządzeń: 404/410 (usługa push zapomniała urządzenie) – usunięte; inny błąd –
-- licznik, po 5 kolejnych usunięte; sukces – zerowanie licznika.
-- p_urzadzenia: [{ id, ok, zniklo }]
create or replace function public.push_kolejka_wynik(p_id bigint, p_urzadzenia jsonb, p_blad text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u jsonb;
begin
  for u in select * from jsonb_array_elements(coalesce(p_urzadzenia, '[]'::jsonb)) loop
    if (u->>'zniklo')::boolean then
      delete from public.powiadomienia_urzadzenia where id = (u->>'id')::uuid;
    elsif (u->>'ok')::boolean then
      update public.powiadomienia_urzadzenia set ostatnio_ok = now(), bledy = 0 where id = (u->>'id')::uuid;
    else
      update public.powiadomienia_urzadzenia set bledy = bledy + 1 where id = (u->>'id')::uuid;
      delete from public.powiadomienia_urzadzenia where id = (u->>'id')::uuid and bledy >= 5;
    end if;
  end loop;
  update public.powiadomienia_kolejka set wyslano = now(),
    dostarczono = (select count(*) from jsonb_array_elements(coalesce(p_urzadzenia, '[]'::jsonb)) x where (x->>'ok')::boolean),
    nieudane = (select count(*) from jsonb_array_elements(coalesce(p_urzadzenia, '[]'::jsonb)) x where not coalesce((x->>'ok')::boolean, false)),
    blad = left(p_blad, 200)
   where id = p_id;
end;
$$;

-- ---------- Uprawnienia ----------
do $$
declare f text;
begin
  foreach f in array array[
    'push_adres_dozwolony(text)', 'push_zdarzenie(uuid,text,jsonb)', '_push_zaproszenia()', '_push_wspolpracownicy()',
    'push_zapisz_urzadzenie(text,text,text,text[])', 'push_usun_urzadzenie(text)', 'push_urzadzenie(text)',
    'push_kolejka_pobierz(integer)', 'push_kolejka_wynik(bigint,jsonb,text)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
  grant execute on function public.push_zapisz_urzadzenie(text,text,text,text[]),
    public.push_usun_urzadzenie(text), public.push_urzadzenie(text) to authenticated;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.powiadomienia_urzadzenia, public.powiadomienia_kolejka to service_role;
  end if;
end $$;
