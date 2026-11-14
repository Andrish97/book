-- Migracja: klucze AI dla całego konta (decyzja #94).
--
-- Dotąd klucz dostępu prowadził do jednego projektu. Teraz klucz należy do konta (Ustawienia konta →
-- „Dostęp dla AI”) i ma zakres:
--   'wybrane' – lista projektów (własnych albo udostępnionych mi), którą można zmieniać bez zmiany klucza;
--   'pelny'   – wszystkie projekty konta (własne i udostępnione) oraz tworzenie i usuwanie projektów.
-- AI dostaje co najwyżej uprawnienia właściciela klucza: w projekcie, w którym konto ma tylko rolę
-- „odczyt” (współpraca, #86), klucz „czyta i zmienia” też tylko czyta.
--
-- Projekt, na którym działa funkcja ai_*, wskazuje się w samym parametrze p_klucz: klucz, ukośnik
-- i identyfikator projektu („sdk_…/<uuid projektu>”). Dzięki temu wszystkie dotychczasowe funkcje ai_*
-- (odczyt, zapis, obrazy, kawałki) zostają bez zmian – zmienia się tylko ai_sprawdz_klucz. Bez projektu
-- działa klucz, który obejmuje dokładnie jeden projekt (jak dawne klucze projektu).
--
-- Dotychczasowe klucze projektu zostają ważne: stają się kluczami konta z zakresem 'wybrane' i tym jednym
-- projektem (adresy łącznika się nie zmieniają).

-- ---------- Tabela ----------

drop function if exists public.utworz_dostep_ai(uuid, text, text, integer);
drop function if exists public.dostepy_ai(uuid);

alter table public.dostepy_projektu add column if not exists zakres text not null default 'wybrane';
alter table public.dostepy_projektu add column if not exists projekty uuid[] not null default '{}';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dostepy_projektu_zakres') then
    alter table public.dostepy_projektu add constraint dostepy_projektu_zakres check (zakres in ('wybrane', 'pelny'));
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'dostepy_projektu' and column_name = 'projekt_id') then
    execute 'update public.dostepy_projektu set projekty = array[projekt_id] where projekt_id is not null and cardinality(projekty) = 0';
    execute 'drop index if exists public.dostepy_projektu_projekt';
    execute 'alter table public.dostepy_projektu drop column projekt_id';
  end if;
end;
$$;
create index if not exists dostepy_projektu_owner on public.dostepy_projektu (owner_id);

-- ---------- Pomocnicze ----------

-- Rola konta w projekcie: 'wlasciciel' | 'edycja' | 'odczyt' | null (jak rola_w_projekcie, ale dla podanego konta).
create or replace function public.ai_rola_konta(p_uzytkownik uuid, p_projekt uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.projekty p where p.id = p_projekt and p.owner_id = p_uzytkownik) then 'wlasciciel'
    else (select w.rola from public.wspolpracownicy w where w.projekt_id = p_projekt and w.uzytkownik = p_uzytkownik)
  end;
$$;
revoke all on function public.ai_rola_konta(uuid, uuid) from public, anon, authenticated;

-- Projekty w zasięgu klucza (z rolą konta w każdym): własne i udostępnione albo tylko wybrane.
create or replace function public.ai_projekty_klucza(p_uzytkownik uuid, p_zakres text, p_projekty uuid[])
returns table (id uuid, rola text)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.rola from (
    select p.id, 'wlasciciel'::text as rola from public.projekty p where p.owner_id = p_uzytkownik
    union all
    select w.projekt_id, w.rola from public.wspolpracownicy w where w.uzytkownik = p_uzytkownik
  ) x
  where p_zakres = 'pelny' or x.id = any(p_projekty);
$$;
revoke all on function public.ai_projekty_klucza(uuid, text, uuid[]) from public, anon, authenticated;

-- Sprawdza sam klucz (bez projektu): format, skrót, blokada po złych próbach, odebranie, ważność, limit
-- zapytań (p_licz). Zwraca { id, owner_id, rola, zakres, projekty, opis, wazny_do, projekt } albo { blad };
-- „projekt” – identyfikator projektu podany po ukośniku albo null. Nie rzuca wyjątków (liczniki zostają).
create or replace function public.ai_klucz(p_klucz text, p_licz boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m text[];
  d public.dostepy_projektu%rowtype;
begin
  m := regexp_match(coalesce(p_klucz, ''), '^sdk_([0-9a-f]{32})_([A-Za-z0-9_-]{20,100})(?:/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}))?$');
  if m is null then
    return jsonb_build_object('blad', 'Nieprawidłowy klucz dostępu.');
  end if;
  if p_licz then
    select * into d from public.dostepy_projektu where id = m[1]::uuid and rodzaj = 'klucz' for update;
  else
    select * into d from public.dostepy_projektu where id = m[1]::uuid and rodzaj = 'klucz';
  end if;
  if not found then
    return jsonb_build_object('blad', 'Nieprawidłowy klucz dostępu.');
  end if;
  if d.blokada_do is not null and d.blokada_do > now() then
    return jsonb_build_object('blad', 'Klucz jest chwilowo zablokowany po wielu złych próbach. Spróbuj za kilkanaście minut.');
  end if;
  if encode(extensions.digest(m[2] || d.klucz_sol, 'sha256'), 'hex') <> d.klucz_skrot then
    update public.dostepy_projektu
       set nieudane = nieudane + 1,
           blokada_do = case when nieudane + 1 >= 10 then now() + interval '15 minutes' else blokada_do end
     where id = d.id;
    return jsonb_build_object('blad', 'Nieprawidłowy klucz dostępu.');
  end if;
  if d.odwolany is not null then
    return jsonb_build_object('blad', 'Klucz został odebrany w ustawieniach konta.');
  end if;
  if d.wazny_do <= now() then
    return jsonb_build_object('blad', 'Klucz dostępu wygasł. Utwórz nowy w ustawieniach konta (Dostęp dla AI).');
  end if;
  if p_licz then
    if d.okno_od is null or d.okno_od < now() - interval '1 minute' then
      d.okno_od := now();
      d.okno_ile := 1;
    else
      d.okno_ile := d.okno_ile + 1;
    end if;
    update public.dostepy_projektu
       set okno_od = d.okno_od, okno_ile = d.okno_ile, nieudane = 0, blokada_do = null, ostatnie_uzycie = now()
     where id = d.id;
    if d.okno_ile > 120 then
      return jsonb_build_object('blad', 'Za dużo zapytań – poczekaj minutę.');
    end if;
  end if;
  return jsonb_build_object('id', d.id, 'owner_id', d.owner_id, 'rola', d.rola, 'zakres', d.zakres,
                            'projekty', to_jsonb(d.projekty), 'opis', d.opis, 'wazny_do', d.wazny_do,
                            'projekt', m[3]);
end;
$$;
revoke all on function public.ai_klucz(text, boolean) from public, anon, authenticated;

-- Sprawdza klucz i projekt, na którym ma działać funkcja ai_*. Zwraca { id, projekt_id, owner_id, rola, opis,
-- wazny_do, zakres } (rola – skuteczna: klucz „edycja” w projekcie, gdzie konto tylko ogląda, daje „odczyt”)
-- albo { blad }. Tej postaci używają wszystkie dotychczasowe funkcje ai_* (d->>'projekt_id').
-- Wersja dwuargumentowa (migracja 20261112150000) woła tę z p_licz = true i zostaje bez zmian.
create or replace function public.ai_sprawdz_klucz(p_klucz text, p_edycja boolean, p_licz boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  v_owner uuid;
  v_projekt uuid;
  v_rola text;
  v_ids uuid[];
begin
  d := public.ai_klucz(p_klucz, p_licz);
  if d ? 'blad' then
    return d;
  end if;
  v_owner := (d->>'owner_id')::uuid;
  v_projekt := nullif(d->>'projekt', '')::uuid;
  if v_projekt is null then
    select coalesce(array_agg(k.id), '{}') into v_ids
      from public.ai_projekty_klucza(v_owner, d->>'zakres',
             array(select jsonb_array_elements_text(d->'projekty'))::uuid[]) k;
    if cardinality(v_ids) = 1 then
      v_projekt := v_ids[1];
    elsif cardinality(v_ids) = 0 then
      return jsonb_build_object('blad', 'Ten klucz nie obejmuje żadnego projektu (dodaj projekty w ustawieniach konta albo utwórz projekt narzędziem nowy_projekt).');
    else
      return jsonb_build_object('blad', 'Ten klucz obejmuje kilka projektów – podaj projekt (lista: narzędzie projekty).');
    end if;
  elsif d->>'zakres' = 'wybrane' and not (d->'projekty' ? v_projekt::text) then
    return jsonb_build_object('blad', 'Ten klucz nie obejmuje tego projektu – dodasz go w ustawieniach konta (Dostęp dla AI).');
  end if;
  v_rola := public.ai_rola_konta(v_owner, v_projekt);
  if v_rola is null then
    return jsonb_build_object('blad', 'Nie ma takiego projektu albo konto klucza nie ma już do niego dostępu.');
  end if;
  if p_edycja and d->>'rola' <> 'edycja' then
    return jsonb_build_object('blad', 'Ten klucz pozwala tylko czytać projekty.');
  end if;
  if p_edycja and v_rola = 'odczyt' then
    return jsonb_build_object('blad', 'W tym projekcie konto klucza może tylko oglądać (rola nadana przez właściciela projektu).');
  end if;
  return jsonb_build_object('id', d->'id', 'projekt_id', v_projekt, 'owner_id', v_owner,
                            'rola', case when d->>'rola' = 'edycja' and v_rola <> 'odczyt' then 'edycja' else 'odczyt' end,
                            'opis', d->'opis', 'wazny_do', d->'wazny_do', 'zakres', d->'zakres');
end;
$$;
revoke all on function public.ai_sprawdz_klucz(text, boolean, boolean) from public, anon, authenticated;

-- ---------- Właściciel konta ----------

-- Tworzy klucz konta. p_dni: 1–365 albo null (bez terminu – do odebrania). p_zakres 'wybrane' (z listą
-- p_projekty – własne albo udostępnione mi) albo 'pelny'. Zwraca { id, klucz, wazny_do } – klucz jedyny raz.
create or replace function public.utworz_dostep_ai(p_opis text, p_rola text, p_dni integer, p_zakres text default 'wybrane', p_projekty uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sekret text;
  v_sol text;
  v_id uuid;
  v_do timestamptz;
  v_projekty uuid[];
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  if p_rola not in ('odczyt', 'edycja') then
    raise exception 'Nieznana rola dostępu';
  end if;
  if p_zakres not in ('wybrane', 'pelny') then
    raise exception 'Zakres klucza: wybrane projekty albo pełny dostęp';
  end if;
  if p_dni is not null and (p_dni < 1 or p_dni > 365) then
    raise exception 'Ważność klucza: od 1 do 365 dni albo bez terminu';
  end if;
  v_projekty := array(select distinct x from unnest(coalesce(p_projekty, '{}')) x);
  if p_zakres = 'wybrane' then
    if cardinality(v_projekty) = 0 then
      raise exception 'Wybierz co najmniej jeden projekt';
    end if;
    if exists (select 1 from unnest(v_projekty) x where public.ai_rola_konta(auth.uid(), x) is null) then
      raise exception 'Nie masz dostępu do któregoś z wybranych projektów';
    end if;
  else
    v_projekty := '{}';
  end if;
  if (select count(*) from public.dostepy_projektu where owner_id = auth.uid() and odwolany is null and wazny_do > now()) >= 20 then
    raise exception 'Masz już 20 aktywnych kluczy – odbierz któryś';
  end if;
  v_sekret := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  v_sol := encode(extensions.gen_random_bytes(16), 'hex');
  v_do := case when p_dni is null then 'infinity'::timestamptz else now() + make_interval(days => p_dni) end;
  insert into public.dostepy_projektu (owner_id, rodzaj, klucz_skrot, klucz_sol, rola, opis, wazny_do, zakres, projekty)
  values (auth.uid(), 'klucz', encode(extensions.digest(v_sekret || v_sol, 'sha256'), 'hex'), v_sol,
          p_rola, left(coalesce(trim(p_opis), ''), 120), v_do, p_zakres, v_projekty)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'klucz', 'sdk_' || replace(v_id::text, '-', '') || '_' || v_sekret,
                            'wazny_do', case when p_dni is null then null else to_jsonb(v_do) end);
end;
$$;
revoke all on function public.utworz_dostep_ai(text, text, integer, text, uuid[]) from public, anon;
grant execute on function public.utworz_dostep_ai(text, text, integer, text, uuid[]) to authenticated;

-- Klucze konta (bez skrótów), najnowsze pierwsze; przy każdym projekty w zasięgu z nazwą.
create or replace function public.dostepy_ai()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'opis', d.opis, 'rola', d.rola, 'zakres', d.zakres,
    'wazny_do', case when d.wazny_do = 'infinity'::timestamptz then null else to_jsonb(d.wazny_do) end,
    'utworzono', d.utworzono, 'ostatnie_uzycie', d.ostatnie_uzycie, 'odwolany', d.odwolany,
    'aktywny', d.odwolany is null and d.wazny_do > now(),
    'projekty', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nazwa', p.nazwa) order by p.nazwa)
                          from public.projekty p where p.id = any(d.projekty)
                            and public.ai_rola_konta(d.owner_id, p.id) is not null), '[]'::jsonb)
  ) order by d.utworzono desc), '[]'::jsonb)
  from public.dostepy_projektu d
  where d.owner_id = auth.uid() and d.rodzaj = 'klucz';
$$;
revoke all on function public.dostepy_ai() from public, anon;
grant execute on function public.dostepy_ai() to authenticated;

-- Zmienia zakres klucza (adres łącznika zostaje): 'wybrane' z nową listą albo 'pelny'.
create or replace function public.zmien_dostep_ai(p_id uuid, p_zakres text, p_projekty uuid[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_projekty uuid[];
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  if p_zakres not in ('wybrane', 'pelny') then
    raise exception 'Zakres klucza: wybrane projekty albo pełny dostęp';
  end if;
  v_projekty := array(select distinct x from unnest(coalesce(p_projekty, '{}')) x);
  if p_zakres = 'wybrane' then
    if cardinality(v_projekty) = 0 then
      raise exception 'Wybierz co najmniej jeden projekt';
    end if;
    if exists (select 1 from unnest(v_projekty) x where public.ai_rola_konta(auth.uid(), x) is null) then
      raise exception 'Nie masz dostępu do któregoś z wybranych projektów';
    end if;
  else
    v_projekty := '{}';
  end if;
  update public.dostepy_projektu set zakres = p_zakres, projekty = v_projekty
   where id = p_id and owner_id = auth.uid() and rodzaj = 'klucz';
  if not found then
    raise exception 'Nie ma takiego klucza na tym koncie';
  end if;
end;
$$;
revoke all on function public.zmien_dostep_ai(uuid, text, uuid[]) from public, anon;
grant execute on function public.zmien_dostep_ai(uuid, text, uuid[]) to authenticated;

-- ---------- Posiadacz klucza (AI): projekty ----------

-- Lista projektów w zasięgu klucza: { dostep: { rola, zakres, opis, wazny_do, tworzenie }, projekty: [...] }.
create or replace function public.ai_projekty(p_klucz text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  v_owner uuid;
begin
  d := public.ai_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  v_owner := (d->>'owner_id')::uuid;
  return jsonb_build_object(
    'dostep', jsonb_build_object('rola', d->'rola', 'zakres', d->'zakres', 'opis', d->'opis',
                                 'wazny_do', case when (d->>'wazny_do')::timestamptz = 'infinity'::timestamptz then null else d->'wazny_do' end,
                                 'tworzenie', d->>'zakres' = 'pelny' and d->>'rola' = 'edycja'),
    'projekty', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nazwa', p.nazwa, 'zmieniono', p.zmieniono, 'wersja', p.wersja,
        'wlasciciel', case when k.rola = 'wlasciciel' then 'ja' else public.nazwa_konta(p.owner_id) end,
        'moja_rola', k.rola,
        'rola', case when d->>'rola' = 'edycja' and k.rola <> 'odczyt' then 'edycja' else 'odczyt' end
      ) order by p.zmieniono desc)
      from public.ai_projekty_klucza(v_owner, d->>'zakres', array(select jsonb_array_elements_text(d->'projekty'))::uuid[]) k
      join public.projekty p on p.id = k.id), '[]'::jsonb));
end;
$$;
revoke all on function public.ai_projekty(text) from public;
grant execute on function public.ai_projekty(text) to anon, authenticated;

-- Nowy projekt na koncie właściciela klucza (tylko klucz „pełny dostęp” z rolą „edycja”).
-- p_dane – projekt bez stron (sekcje, wzorce, style, tabele, serie, widok), p_strony – pełne strony.
create or replace function public.ai_nowy_projekt(p_klucz text, p_id uuid, p_nazwa text, p_dane jsonb, p_strony jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  v_owner uuid;
  v_ids text[];
  v_sekcje text[];
  x jsonb;
begin
  d := public.ai_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if d->>'zakres' <> 'pelny' or d->>'rola' <> 'edycja' then
    return jsonb_build_object('blad', 'Tworzyć projekty może tylko klucz z pełnym dostępem, który czyta i zmienia (ustawienia konta → Dostęp dla AI).');
  end if;
  v_owner := (d->>'owner_id')::uuid;
  if p_id is null or exists (select 1 from public.projekty where id = p_id) then
    return jsonb_build_object('blad', 'Nieprawidłowy albo zajęty identyfikator projektu.');
  end if;
  if p_nazwa is null or length(trim(p_nazwa)) = 0 or length(p_nazwa) > 120 then
    return jsonb_build_object('blad', 'Nazwa projektu: niepusty tekst do 120 znaków.');
  end if;
  if jsonb_typeof(p_dane) <> 'object' then
    return jsonb_build_object('blad', 'Dane projektu muszą być obiektem JSON.');
  end if;
  v_ids := public.ai_identyfikatory(p_strony);
  v_sekcje := public.ai_identyfikatory(coalesce(p_dane->'sekcje', '[]'::jsonb));
  if v_ids is null or cardinality(v_ids) = 0 then
    return jsonb_build_object('blad', 'Projekt musi mieć co najmniej jedną stronę (lista obiektów z niepowtarzalnym „id”).');
  end if;
  if v_sekcje is null or cardinality(v_sekcje) = 0 then
    return jsonb_build_object('blad', 'Projekt musi mieć co najmniej jedną sekcję.');
  end if;
  for x in select * from jsonb_array_elements(p_strony) loop
    if not ((x->>'sekcja') = any(v_sekcje)) then
      return jsonb_build_object('blad', format('Strona „%s”: „sekcja” musi wskazywać istniejącą sekcję.', x->>'id'));
    end if;
  end loop;
  if octet_length(p_dane::text) + octet_length(p_strony::text) > 8000000 then
    return jsonb_build_object('blad', 'Projekt jest za duży (ponad 8 MB naraz).');
  end if;
  begin
    insert into public.projekty (id, owner_id, nazwa, dane, zmieniono, wersja)
    values (p_id, v_owner, trim(p_nazwa),
            (p_dane - 'strony' - 'strony_osobno' - 'udostepnienie' - 'podstawa_chmury' - 'wersja_chmury')
              || jsonb_build_object('id', p_id, 'nazwa', trim(p_nazwa), 'strony', to_jsonb(v_ids), 'strony_osobno', true,
                                    'zasoby', '{}'::jsonb, 'zmieniono', to_jsonb(now())),
            now(), 1);
    insert into public.projekty_strony (projekt_id, strona_id, owner_id, dane)
      select p_id, s->>'id', v_owner, s from jsonb_array_elements(p_strony) s;
  exception when others then
    return jsonb_build_object('blad', 'Nie udało się utworzyć projektu: ' || sqlerrm);
  end;
  return jsonb_build_object('id', p_id, 'nazwa', trim(p_nazwa), 'wersja', 1);
end;
$$;
revoke all on function public.ai_nowy_projekt(text, uuid, text, jsonb, jsonb) from public;
grant execute on function public.ai_nowy_projekt(text, uuid, text, jsonb, jsonb) to anon, authenticated;

-- Usuwa projekt właściciela klucza (tylko pełny dostęp z rolą „edycja” i tylko własny projekt – nie
-- udostępniony). p_potwierdz – dokładna nazwa projektu. Pliki projektu sprząta potem aplikacja (#90).
create or replace function public.ai_usun_projekt(p_klucz text, p_projekt uuid, p_potwierdz text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  p public.projekty%rowtype;
begin
  d := public.ai_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if d->>'zakres' <> 'pelny' or d->>'rola' <> 'edycja' then
    return jsonb_build_object('blad', 'Usuwać projekty może tylko klucz z pełnym dostępem, który czyta i zmienia.');
  end if;
  select * into p from public.projekty where id = p_projekt;
  if not found or p.owner_id <> (d->>'owner_id')::uuid then
    return jsonb_build_object('blad', 'Usunąć można tylko własny projekt konta (udostępnionego przez kogoś innego – nie).');
  end if;
  if trim(coalesce(p_potwierdz, '')) <> trim(p.nazwa) then
    return jsonb_build_object('blad', format('Na potwierdzenie podaj dokładną nazwę projektu: „%s”.', p.nazwa));
  end if;
  delete from public.projekty where id = p.id;
  return jsonb_build_object('usunieto', p.id, 'nazwa', p.nazwa);
end;
$$;
revoke all on function public.ai_usun_projekt(text, uuid, text) from public;
grant execute on function public.ai_usun_projekt(text, uuid, text) to anon, authenticated;
