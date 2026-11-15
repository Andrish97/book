-- Komentarze na stronach (decyzja #131D – komentarze).
--
-- Komentarz jest przypięty do miejsca na stronie (strona_id + x, y w mm) albo do elementu (element_id) i zaczyna
-- wątek; odpowiedzi mają `watek` = id komentarza, który wątek zaczął. Komentarze leżą w osobnej tabeli, a nie
-- w JSON projektu: nie podbijają wersji projektu i nie kolidują z zapisem (#135, #138).
--
-- Kto: każda osoba z dostępem do projektu – właściciel i współpracownicy w obu rolach („może edytować”
-- i „może oglądać” – przegląd to typowe zadanie osoby, która tylko ogląda). Zmienić treść może autor, usunąć –
-- autor albo właściciel projektu, rozwiązać i otworzyć ponownie – każda osoba z dostępem.
-- @nazwa w treści (nazwa użytkownika, #100) to wzmianka osoby z projektu.
--
-- Czytanie: RLS (rola_w_projekcie) – także Realtime: nowy komentarz pojawia się u innych od razu.
-- Pisanie: wyłącznie funkcjami poniżej (security definer, sprawdzają dostęp).
-- Powiadomienia push (#113): nowy komentarz w moim projekcie (właściciel), odpowiedź w moim wątku (uczestnicy
-- wątku), wzmianka (osoba wspomniana) – rodzaj „komentarze” w Ustawieniach konta → Powiadomienia.
-- AI (łącznik): ai_komentarze, ai_skomentuj – autor to konto klucza, zrodlo = 'ai', podpis = opis klucza.

create table if not exists public.komentarze (
  id          uuid primary key default gen_random_uuid(),
  projekt_id  uuid not null references public.projekty (id) on delete cascade,
  watek       uuid references public.komentarze (id) on delete cascade,
  autor       uuid references auth.users (id) on delete set null,
  zrodlo      text not null default 'konto' check (zrodlo in ('konto', 'ai')),
  podpis      text check (char_length(podpis) <= 80),
  strona_id   text check (char_length(strona_id) <= 100),
  element_id  text check (char_length(element_id) <= 100),
  x           real check (x between -1000 and 5000),
  y           real check (y between -1000 and 5000),
  tresc       text not null check (char_length(btrim(tresc)) between 1 and 4000),
  wzmianki    uuid[] not null default '{}' check (cardinality(wzmianki) <= 20),
  rozwiazany  boolean not null default false,
  rozwiazal   uuid references auth.users (id) on delete set null,
  rozwiazano  timestamptz,
  utworzono   timestamptz not null default now(),
  zmieniono   timestamptz not null default now()
);
create index if not exists komentarze_projekt on public.komentarze (projekt_id, utworzono);
create index if not exists komentarze_watek on public.komentarze (watek) where watek is not null;
create index if not exists komentarze_autor on public.komentarze (autor, utworzono);
alter table public.komentarze enable row level security;
revoke all on table public.komentarze from public, anon, authenticated;
grant select on table public.komentarze to authenticated;

drop policy if exists komentarze_czytanie on public.komentarze;
create policy komentarze_czytanie on public.komentarze for select to authenticated
  using (public.rola_w_projekcie(projekt_id) is not null);

-- Realtime: zmiany komentarzy rozchodzą się do osób z dostępem (RLS powyżej).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'komentarze') then
    alter publication supabase_realtime add table public.komentarze;
  end if;
end $$;

-- ---------- Pomocnicze ----------

-- Wzmianki: @nazwa w treści → konta z dostępem do projektu o tej nazwie (bez wielkości liter).
create or replace function public._wzmianki_komentarza(p_projekt uuid, p_tresc text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with nazwy as (
    select distinct lower(m[1]) as n from regexp_matches(coalesce(p_tresc, ''), '@([A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż_.-]{2,40})', 'g') as m
  ), osoby as (
    select p.owner_id as id from public.projekty p where p.id = p_projekt
    union select w.uzytkownik from public.wspolpracownicy w where w.projekt_id = p_projekt
  )
  select coalesce(array_agg(distinct o.id), '{}') from osoby o
   where lower(rtrim(public.nazwa_konta(o.id), '.')) in (select rtrim(n, '.') from nazwy);
$$;
revoke all on function public._wzmianki_komentarza(uuid, text) from public, anon, authenticated;

-- Jeden komentarz w postaci dla aplikacji i łącznika.
create or replace function public._komentarz_json(k public.komentarze)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', k.id, 'projekt_id', k.projekt_id, 'watek', k.watek, 'autor', k.autor,
    'autor_nazwa', case when k.zrodlo = 'ai' then coalesce(nullif(k.podpis, ''), 'AI') else coalesce(public.nazwa_konta(k.autor), 'Konto usunięte') end,
    'zrodlo', k.zrodlo, 'strona_id', k.strona_id, 'element_id', k.element_id, 'x', k.x, 'y', k.y,
    'tresc', k.tresc, 'wzmianki', to_jsonb(k.wzmianki), 'rozwiazany', k.rozwiazany,
    'rozwiazal_nazwa', case when k.rozwiazal is not null then public.nazwa_konta(k.rozwiazal) end,
    'rozwiazano', k.rozwiazano, 'utworzono', k.utworzono, 'zmieniono', k.zmieniono,
    'moj', k.autor is not distinct from auth.uid() and k.zrodlo = 'konto');
$$;
revoke all on function public._komentarz_json(public.komentarze) from public, anon, authenticated;

-- Wspólne dodawanie (aplikacja i AI): sprawdzenie wątku, wzmianki, limit.
create or replace function public._dodaj_komentarz(p_projekt uuid, p_autor uuid, p_zrodlo text, p_podpis text,
  p_strona text, p_element text, p_x real, p_y real, p_tresc text, p_watek uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_watek uuid;
  v_k public.komentarze;
  v_strona text := nullif(left(btrim(coalesce(p_strona, '')), 100), '');
begin
  if char_length(btrim(coalesce(p_tresc, ''))) = 0 then
    raise exception 'Komentarz jest pusty';
  end if;
  if (select count(*) from public.komentarze k where k.autor = p_autor and k.utworzono > now() - interval '1 minute') >= 30 then
    raise exception 'Za dużo komentarzy naraz – poczekaj chwilę';
  end if;
  if p_watek is not null then
    select coalesce(k.watek, k.id), k.strona_id into v_watek, v_strona from public.komentarze k
     where k.id = p_watek and k.projekt_id = p_projekt;
    if v_watek is null then raise exception 'Nie ma takiego komentarza w tym projekcie'; end if;
    select k.strona_id into v_strona from public.komentarze k where k.id = v_watek;
  elsif v_strona is null then
    raise exception 'Komentarz musi wskazywać stronę';
  end if;
  insert into public.komentarze (projekt_id, watek, autor, zrodlo, podpis, strona_id, element_id, x, y, tresc, wzmianki)
    values (p_projekt, v_watek, p_autor, p_zrodlo, left(p_podpis, 80), v_strona,
            case when v_watek is null then nullif(left(btrim(coalesce(p_element, '')), 100), '') end,
            case when v_watek is null then p_x end, case when v_watek is null then p_y end,
            left(btrim(p_tresc), 4000), public._wzmianki_komentarza(p_projekt, p_tresc))
    returning * into v_k;
  -- Otwarty ponownie wątek: odpowiedź w rozwiązanym wątku go nie zamyka i nie otwiera – zostawiamy decyzję ludziom.
  return public._komentarz_json(v_k);
end;
$$;
revoke all on function public._dodaj_komentarz(uuid, uuid, text, text, text, text, real, real, text, uuid) from public, anon, authenticated;

-- ---------- Aplikacja ----------

create or replace function public.komentarze_projektu(p_projekt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.rola_w_projekcie(p_projekt) is null then
    raise exception 'Nie masz dostępu do tego projektu' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(public._komentarz_json(k) order by k.utworzono, k.id), '[]'::jsonb)
            from public.komentarze k where k.projekt_id = p_projekt);
end;
$$;

create or replace function public.dodaj_komentarz(p_projekt uuid, p_strona text, p_element text, p_x real, p_y real,
  p_tresc text, p_watek uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.rola_w_projekcie(p_projekt) is null then
    raise exception 'Nie masz dostępu do tego projektu' using errcode = '42501';
  end if;
  return public._dodaj_komentarz(p_projekt, auth.uid(), 'konto', null, p_strona, p_element, p_x, p_y, p_tresc, p_watek);
end;
$$;

create or replace function public.zmien_komentarz(p_id uuid, p_tresc text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k public.komentarze;
begin
  if char_length(btrim(coalesce(p_tresc, ''))) = 0 then raise exception 'Komentarz jest pusty'; end if;
  update public.komentarze k set tresc = left(btrim(p_tresc), 4000), zmieniono = now(),
         wzmianki = public._wzmianki_komentarza(k.projekt_id, p_tresc)
   where k.id = p_id and k.autor = auth.uid() and k.zrodlo = 'konto' and public.rola_w_projekcie(k.projekt_id) is not null
  returning * into v_k;
  if v_k.id is null then raise exception 'Zmienić możesz tylko własny komentarz' using errcode = '42501'; end if;
  return public._komentarz_json(v_k);
end;
$$;

create or replace function public.usun_komentarz(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k public.komentarze;
begin
  select * into v_k from public.komentarze where id = p_id;
  if v_k.id is null then return; end if;
  if not ((v_k.autor = auth.uid() and v_k.zrodlo = 'konto' and public.rola_w_projekcie(v_k.projekt_id) is not null)
          or public.rola_w_projekcie(v_k.projekt_id) = 'wlasciciel') then
    raise exception 'Usunąć możesz własny komentarz (albo każdy – jako właściciel projektu)' using errcode = '42501';
  end if;
  delete from public.komentarze where id = p_id;
end;
$$;

create or replace function public.rozwiaz_komentarz(p_id uuid, p_rozwiazany boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k public.komentarze;
begin
  update public.komentarze k
     set rozwiazany = coalesce(p_rozwiazany, true),
         rozwiazal = case when coalesce(p_rozwiazany, true) then auth.uid() end,
         rozwiazano = case when coalesce(p_rozwiazany, true) then now() end
   where k.id = p_id and k.watek is null and public.rola_w_projekcie(k.projekt_id) is not null
  returning * into v_k;
  if v_k.id is null then raise exception 'Nie ma takiego wątku albo nie masz do niego dostępu' using errcode = '42501'; end if;
  return public._komentarz_json(v_k);
end;
$$;

revoke all on function public.komentarze_projektu(uuid), public.dodaj_komentarz(uuid, text, text, real, real, text, uuid),
  public.zmien_komentarz(uuid, text), public.usun_komentarz(uuid), public.rozwiaz_komentarz(uuid, boolean) from public, anon;
grant execute on function public.komentarze_projektu(uuid), public.dodaj_komentarz(uuid, text, text, real, real, text, uuid),
  public.zmien_komentarz(uuid, text), public.usun_komentarz(uuid), public.rozwiaz_komentarz(uuid, boolean) to authenticated;

-- ---------- AI (łącznik) ----------

create or replace function public.ai_komentarze(p_klucz text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := public.ai_sprawdz_klucz(p_klucz, false);
begin
  if d ? 'blad' then return d; end if;
  return jsonb_build_object('projekt_id', d->>'projekt_id', 'komentarze',
    (select coalesce(jsonb_agg(public._komentarz_json(k) order by k.utworzono, k.id), '[]'::jsonb)
       from public.komentarze k where k.projekt_id = (d->>'projekt_id')::uuid));
end;
$$;

-- Komentarz od AI: także z kluczem „tylko czyta” – komentarz nie zmienia projektu (przegląd, uwagi).
create or replace function public.ai_skomentuj(p_klucz text, p_strona text, p_element text, p_x real, p_y real,
  p_tresc text, p_watek uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := public.ai_sprawdz_klucz(p_klucz, false);
begin
  if d ? 'blad' then return d; end if;
  return public._dodaj_komentarz((d->>'projekt_id')::uuid, (d->>'owner_id')::uuid, 'ai',
    coalesce(nullif(btrim(d->>'opis'), ''), 'AI'), p_strona, p_element, p_x, p_y, p_tresc, p_watek);
exception when others then
  return jsonb_build_object('blad', sqlerrm);
end;
$$;

create or replace function public.ai_rozwiaz_komentarz(p_klucz text, p_id uuid, p_rozwiazany boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := public.ai_sprawdz_klucz(p_klucz, false);
  v_k public.komentarze;
begin
  if d ? 'blad' then return d; end if;
  update public.komentarze k
     set rozwiazany = coalesce(p_rozwiazany, true),
         rozwiazal = case when coalesce(p_rozwiazany, true) then (d->>'owner_id')::uuid end,
         rozwiazano = case when coalesce(p_rozwiazany, true) then now() end
   where k.id = p_id and k.watek is null and k.projekt_id = (d->>'projekt_id')::uuid
  returning * into v_k;
  if v_k.id is null then return jsonb_build_object('blad', 'Nie ma takiego wątku w tym projekcie.'); end if;
  return public._komentarz_json(v_k);
end;
$$;

revoke all on function public.ai_komentarze(text), public.ai_skomentuj(text, text, text, real, real, text, uuid),
  public.ai_rozwiaz_komentarz(text, uuid, boolean) from public;
grant execute on function public.ai_komentarze(text), public.ai_skomentuj(text, text, text, real, real, text, uuid),
  public.ai_rozwiaz_komentarz(text, uuid, boolean) to anon, authenticated;

-- ---------- Powiadomienia push ----------

alter table public.powiadomienia_kolejka drop constraint if exists powiadomienia_kolejka_rodzaj_check;
alter table public.powiadomienia_kolejka add constraint powiadomienia_kolejka_rodzaj_check
  check (rodzaj in ('zaproszenia', 'odpowiedzi', 'dostep', 'komentarze'));
alter table public.powiadomienia_urzadzenia alter column rodzaje set default '{zaproszenia,odpowiedzi,dostep,komentarze}';
-- Urządzenia z włączonymi powiadomieniami dostają też komentarze (można je wyłączyć w ustawieniach).
update public.powiadomienia_urzadzenia set rodzaje = array_append(rodzaje, 'komentarze')
 where not ('komentarze' = any (rodzaje)) and cardinality(rodzaje) < 10;

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
    when p_zdarzenie in ('komentarz', 'odpowiedz_komentarz', 'wzmianka') then 'komentarze'
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

create or replace function public.push_zapisz_urzadzenie(p_endpoint text, p_p256dh text, p_auth text, p_rodzaje text[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rodzaje text[] := coalesce(p_rodzaje, '{zaproszenia,odpowiedzi,dostep,komentarze}');
begin
  if v_uid is null then raise exception 'Brak sesji'; end if;
  if not public.push_adres_dozwolony(p_endpoint) then
    raise exception 'Ta przeglądarka podała nieznaną usługę powiadomień';
  end if;
  if exists (select 1 from unnest(v_rodzaje) r where r not in ('zaproszenia', 'odpowiedzi', 'dostep', 'komentarze')) then
    raise exception 'Nieznany rodzaj powiadomień';
  end if;
  insert into public.powiadomienia_urzadzenia (uzytkownik, endpoint, p256dh, auth, rodzaje, zmieniono)
    values (v_uid, p_endpoint, p_p256dh, p_auth, v_rodzaje, clock_timestamp())
  on conflict (endpoint) do update set uzytkownik = v_uid, p256dh = excluded.p256dh, auth = excluded.auth,
    rodzaje = excluded.rodzaje, zmieniono = clock_timestamp(), bledy = 0;
  delete from public.powiadomienia_urzadzenia where id in (
    select id from public.powiadomienia_urzadzenia where uzytkownik = v_uid order by zmieniono desc offset 20);
  return jsonb_build_object('wlaczone', true, 'rodzaje', to_jsonb(v_rodzaje));
end;
$$;

-- Nowy komentarz: wzmianka → wspomniani; odpowiedź → uczestnicy wątku; nowy wątek → właściciel projektu.
-- Każda osoba dostaje najwyżej jedno powiadomienie; autor – żadnego.
create or replace function public._push_komentarze()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_projekt text;
  v_wlasciciel uuid;
  v_kto text;
  v_dane jsonb;
  v_wyslane uuid[] := array[new.autor];
  v_id uuid;
begin
  select p.nazwa, p.owner_id into v_projekt, v_wlasciciel from public.projekty p where p.id = new.projekt_id;
  v_kto := case when new.zrodlo = 'ai' then coalesce(nullif(new.podpis, ''), 'AI') else coalesce(public.nazwa_konta(new.autor), '') end;
  v_dane := jsonb_build_object('projekt_id', new.projekt_id, 'projekt', left(coalesce(v_projekt, ''), 80),
    'kto', left(v_kto, 60), 'komentarz', coalesce(new.watek, new.id), 'tresc', left(new.tresc, 120));
  foreach v_id in array new.wzmianki loop
    if not (v_id = any (v_wyslane)) then
      perform public.push_zdarzenie(v_id, 'wzmianka', v_dane);
      v_wyslane := v_wyslane || v_id;
    end if;
  end loop;
  if new.watek is not null then
    for v_id in
      select distinct k.autor from public.komentarze k
       where (k.id = new.watek or k.watek = new.watek) and k.autor is not null and k.zrodlo = 'konto'
    loop
      if not (v_id = any (v_wyslane)) then
        perform public.push_zdarzenie(v_id, 'odpowiedz_komentarz', v_dane);
        v_wyslane := v_wyslane || v_id;
      end if;
    end loop;
  elsif not (v_wlasciciel = any (v_wyslane)) then
    perform public.push_zdarzenie(v_wlasciciel, 'komentarz', v_dane);
  end if;
  return null;
exception when others then
  raise warning '_push_komentarze: %', sqlerrm;
  return null;
end;
$$;
revoke all on function public._push_komentarze() from public, anon, authenticated;
drop trigger if exists push_komentarze on public.komentarze;
create trigger push_komentarze after insert on public.komentarze
  for each row execute function public._push_komentarze();
