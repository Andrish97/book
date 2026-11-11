-- Migracja: dostęp do jednego projektu dla AI (klucz dostępu).
--
-- Właściciel projektu tworzy w aplikacji klucz dostępu: tylko do tego projektu, do odczytu albo
-- do odczytu i zmian, z datą ważności, z możliwością odebrania. Klucz pokazuje się raz; w bazie
-- zostaje tylko jego skrót (sha256 z solą – klucz to 32 losowe bajty, więc szybki skrót wystarcza).
--
-- AI (przez serwer MCP albo akcje GPT) woła funkcje public.ai_* z kluczem. Funkcje są
-- SECURITY DEFINER: sprawdzają klucz, rolę, ważność, odebranie i limit zapytań, i działają tylko
-- na projekcie, do którego klucz prowadzi. Zapis podbija numer wersji projektu tak samo jak zapis
-- z aplikacji, więc otwarty edytor właściciela dostaje zmianę na żywo (Realtime) i łączy ją
-- element po elemencie (js/laczenie.js).
--
-- Tabela jest przygotowana na późniejsze współdzielenie z innymi kontami: wiersz może zamiast
-- klucza wskazywać zaproszonego użytkownika (rodzaj = 'uzytkownik'); funkcji do tego jeszcze nie ma.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.dostepy_projektu (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  projekt_id      uuid not null references public.projekty (id) on delete cascade,
  rodzaj          text not null default 'klucz' check (rodzaj in ('klucz', 'uzytkownik')),
  uzytkownik      uuid references auth.users (id) on delete cascade,
  klucz_skrot     text,
  klucz_sol       text,
  rola            text not null check (rola in ('odczyt', 'edycja')),
  opis            text not null default '' check (length(opis) <= 120),
  wazny_do        timestamptz not null,
  utworzono       timestamptz not null default now(),
  ostatnie_uzycie timestamptz,
  odwolany        timestamptz,
  -- Ochrona przed zgadywaniem i zalewaniem: złe klucze blokują wiersz, a zapytań jest najwyżej 120 na minutę.
  nieudane        integer not null default 0,
  blokada_do      timestamptz,
  okno_od         timestamptz,
  okno_ile        integer not null default 0,
  check ((rodzaj = 'klucz' and klucz_skrot is not null and klucz_sol is not null) or (rodzaj = 'uzytkownik' and uzytkownik is not null))
);

create index if not exists dostepy_projektu_projekt on public.dostepy_projektu (projekt_id);

alter table public.dostepy_projektu enable row level security;

-- Właściciel widzi swoje dostępy (ze skrótem klucza – z niego klucza nie da się odtworzyć).
-- Tworzenie i odbieranie idzie przez funkcje poniżej; nikt inny nie ma do tabeli dostępu.
drop policy if exists "dostepy: odczyt własnych" on public.dostepy_projektu;
create policy "dostepy: odczyt własnych" on public.dostepy_projektu
  for select to authenticated using (owner_id = (select auth.uid()));

-- ---------- Właściciel ----------

-- Tworzy klucz. Zwraca { id, klucz, wazny_do } – klucz jest w odpowiedzi jedyny raz.
create or replace function public.utworz_dostep_ai(p_projekt uuid, p_opis text, p_rola text, p_dni integer)
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
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  if not exists (select 1 from public.projekty where id = p_projekt and owner_id = auth.uid()) then
    raise exception 'Nie ma takiego projektu na tym koncie';
  end if;
  if p_rola not in ('odczyt', 'edycja') then
    raise exception 'Nieznana rola dostępu';
  end if;
  if p_dni is null or p_dni < 1 or p_dni > 90 then
    raise exception 'Ważność dostępu: od 1 do 90 dni';
  end if;
  if (select count(*) from public.dostepy_projektu where projekt_id = p_projekt and odwolany is null and wazny_do > now()) >= 20 then
    raise exception 'Ten projekt ma już 20 aktywnych dostępów – odbierz któryś';
  end if;
  v_sekret := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  v_sol := encode(extensions.gen_random_bytes(16), 'hex');
  v_do := now() + make_interval(days => p_dni);
  insert into public.dostepy_projektu (owner_id, projekt_id, rodzaj, klucz_skrot, klucz_sol, rola, opis, wazny_do)
  values (auth.uid(), p_projekt, 'klucz', encode(extensions.digest(v_sekret || v_sol, 'sha256'), 'hex'), v_sol,
          p_rola, left(coalesce(trim(p_opis), ''), 120), v_do)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'klucz', 'sdk_' || replace(v_id::text, '-', '') || '_' || v_sekret, 'wazny_do', v_do);
end;
$$;

revoke all on function public.utworz_dostep_ai(uuid, text, text, integer) from public, anon;
grant execute on function public.utworz_dostep_ai(uuid, text, text, integer) to authenticated;

-- Lista dostępów projektu (bez skrótów kluczy), najnowsze pierwsze.
create or replace function public.dostepy_ai(p_projekt uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'opis', opis, 'rola', rola, 'wazny_do', wazny_do, 'utworzono', utworzono,
    'ostatnie_uzycie', ostatnie_uzycie, 'odwolany', odwolany,
    'aktywny', odwolany is null and wazny_do > now()
  ) order by utworzono desc), '[]'::jsonb)
  from public.dostepy_projektu
  where projekt_id = p_projekt and owner_id = (select auth.uid()) and rodzaj = 'klucz';
$$;

revoke all on function public.dostepy_ai(uuid) from public, anon;
grant execute on function public.dostepy_ai(uuid) to authenticated;

-- Odbiera dostęp (klucz przestaje działać od razu).
create or replace function public.odwolaj_dostep_ai(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  update public.dostepy_projektu set odwolany = coalesce(odwolany, now())
   where id = p_id and owner_id = auth.uid();
end;
$$;

revoke all on function public.odwolaj_dostep_ai(uuid) from public, anon;
grant execute on function public.odwolaj_dostep_ai(uuid) to authenticated;

-- ---------- Posiadacz klucza (AI) ----------

-- Sprawdza klucz. Zwraca { id, projekt_id, owner_id, rola, opis, wazny_do } albo { blad }.
-- Nie rzuca wyjątku, żeby licznik złych prób i limit zapytań zostały zapisane.
create or replace function public.ai_sprawdz_klucz(p_klucz text, p_edycja boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m text[];
  d public.dostepy_projektu%rowtype;
begin
  m := regexp_match(coalesce(p_klucz, ''), '^sdk_([0-9a-f]{32})_([A-Za-z0-9_-]{20,100})$');
  if m is null then
    return jsonb_build_object('blad', 'Nieprawidłowy klucz dostępu.');
  end if;
  select * into d from public.dostepy_projektu
   where id = m[1]::uuid and rodzaj = 'klucz' for update;
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
    return jsonb_build_object('blad', 'Dostęp został odebrany przez właściciela projektu.');
  end if;
  if d.wazny_do <= now() then
    return jsonb_build_object('blad', 'Klucz dostępu wygasł. Poproś właściciela projektu o nowy.');
  end if;
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
  if p_edycja and d.rola <> 'edycja' then
    return jsonb_build_object('blad', 'Ten klucz pozwala tylko czytać projekt.');
  end if;
  return jsonb_build_object('id', d.id, 'projekt_id', d.projekt_id, 'owner_id', d.owner_id,
                            'rola', d.rola, 'opis', d.opis, 'wazny_do', d.wazny_do);
end;
$$;

revoke all on function public.ai_sprawdz_klucz(text, boolean) from public, anon, authenticated;

-- Odczyt projektu: { dostep: { rola, opis, wazny_do }, wersja, projekt } albo { blad }.
-- projekt ma strony w środku (pełne obiekty), a zasoby tylko opisane: { id: { nazwa, typ } }.
create or replace function public.ai_projekt(p_klucz text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  p public.projekty%rowtype;
  v_dane jsonb;
  v_strony jsonb;
begin
  d := public.ai_sprawdz_klucz(p_klucz, false);
  if d ? 'blad' then
    return d;
  end if;
  select * into p from public.projekty where id = (d->>'projekt_id')::uuid;
  if not found then
    return jsonb_build_object('blad', 'Projektu już nie ma.');
  end if;
  v_dane := p.dane;
  if coalesce((v_dane->>'strony_osobno')::boolean, false) then
    select coalesce(jsonb_agg(s.dane order by k.nr), '[]'::jsonb) into v_strony
      from jsonb_array_elements_text(coalesce(v_dane->'strony', '[]'::jsonb)) with ordinality as k(id, nr)
      join public.projekty_strony s on s.projekt_id = p.id and s.strona_id = k.id;
  else
    v_strony := coalesce(v_dane->'strony', '[]'::jsonb);
  end if;
  v_dane := (v_dane - 'strony_osobno' - 'podstawa_chmury' - 'wersja_chmury' - 'miniatura' - 'udostepnienie')
    || jsonb_build_object(
      'strony', v_strony,
      'zasoby', coalesce((select jsonb_object_agg(z.key, jsonb_build_object('nazwa', z.value->>'nazwa', 'typ', z.value->>'typ'))
                          from jsonb_each(coalesce(v_dane->'zasoby', '{}'::jsonb)) z), '{}'::jsonb));
  return jsonb_build_object(
    'dostep', jsonb_build_object('rola', d->>'rola', 'opis', d->>'opis', 'wazny_do', d->'wazny_do'),
    'wersja', p.wersja,
    'projekt', v_dane);
end;
$$;

revoke all on function public.ai_projekt(text) from public;
grant execute on function public.ai_projekt(text) to anon, authenticated;

-- Pomocnicze: lista identyfikatorów z listy obiektów; null, gdy coś nie jest obiektem z tekstowym id
-- albo identyfikatory się powtarzają.
create or replace function public.ai_identyfikatory(p_lista jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text[] := '{}';
  x jsonb;
begin
  if jsonb_typeof(p_lista) <> 'array' then
    return null;
  end if;
  for x in select * from jsonb_array_elements(p_lista) loop
    if jsonb_typeof(x) <> 'object' or jsonb_typeof(x->'id') <> 'string' or (x->>'id') = '' or (x->>'id') = any(v) then
      return null;
    end if;
    v := v || (x->>'id');
  end loop;
  return v;
end;
$$;

-- Zapis zmian w projekcie. p_zmiany może mieć dowolne z części:
--   nazwa (tekst), sekcje, wzorce, style, tabele, serie (pełne listy – zastępują dotychczasowe),
--   widok (obiekt), strony (strony nowe albo zmienione – pełne obiekty stron),
--   usun_strony (identyfikatory), kolejnosc_stron (wszystkie identyfikatory w nowej kolejności).
-- Zasoby (obrazy, czcionki), udostępnienie i id projektu nie zmieniają się z klucza.
-- Zwraca { wersja, strony_zapisane } albo { konflikt: true, wersja } (projekt zmienił się w międzyczasie –
-- trzeba pobrać go na nowo) albo { blad, szczegoly? }.
create or replace function public.ai_zapisz(p_klucz text, p_znana_wersja bigint, p_zmiany jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  p public.projekty%rowtype;
  v_dane jsonb;
  v_strony jsonb := '{}'::jsonb;   -- id → strona (wszystkie strony po zmianach)
  v_kolejnosc text[];              -- kolejność stron po zmianach
  v_zmienione text[] := '{}';      -- strony do zapisania
  v_bledy text[] := '{}';
  v_klucz text;
  x jsonb;
  s jsonb;
  v_id text;
  v_sekcje text[];
  v_wzorce text[];
  v_serie text[];
  v_tabele text[];
  v_zasoby text[];
  v_typy text[] := array['textbox', 'i-text', 'text', 'rect', 'ellipse', 'circle', 'line', 'polygon', 'polyline', 'path', 'image', 'group', 'triangle'];
  v_legacy boolean;
  v_wersja bigint;
begin
  d := public.ai_sprawdz_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if jsonb_typeof(p_zmiany) <> 'object' then
    return jsonb_build_object('blad', 'Zmiany muszą być obiektem JSON.');
  end if;
  for v_klucz in select jsonb_object_keys(p_zmiany) loop
    if v_klucz not in ('nazwa', 'sekcje', 'wzorce', 'style', 'tabele', 'serie', 'widok', 'strony', 'usun_strony', 'kolejnosc_stron') then
      v_bledy := v_bledy || format('Nieznana część projektu „%s” (dozwolone: nazwa, sekcje, wzorce, style, tabele, serie, widok, strony, usun_strony, kolejnosc_stron).', v_klucz);
    end if;
  end loop;
  if octet_length(p_zmiany::text) > 8000000 then
    v_bledy := v_bledy || 'Zmiany są za duże (ponad 8 MB naraz).'::text;
  end if;
  if cardinality(v_bledy) > 0 then
    return jsonb_build_object('blad', 'Zmiany odrzucone.', 'szczegoly', to_jsonb(v_bledy));
  end if;

  select * into p from public.projekty where id = (d->>'projekt_id')::uuid for update;
  if not found then
    return jsonb_build_object('blad', 'Projektu już nie ma.');
  end if;
  if p_znana_wersja is null or p_znana_wersja <> p.wersja then
    return jsonb_build_object('konflikt', true, 'wersja', p.wersja,
      'blad', 'Projekt zmienił się w międzyczasie (wersja ' || p.wersja || '). Pobierz go na nowo i nanieś zmiany jeszcze raz.');
  end if;

  v_dane := p.dane;
  v_legacy := not coalesce((v_dane->>'strony_osobno')::boolean, false);
  -- Strony przed zmianami.
  if v_legacy then
    for x in select * from jsonb_array_elements(coalesce(v_dane->'strony', '[]'::jsonb)) loop
      v_strony := v_strony || jsonb_build_object(x->>'id', x);
    end loop;
    select coalesce(array_agg(x->>'id'), '{}') into v_kolejnosc from jsonb_array_elements(coalesce(v_dane->'strony', '[]'::jsonb)) as t(x);
    v_zmienione := v_kolejnosc; -- starszy zapis: przy pierwszym zapisie strony przechodzą do osobnych wierszy
  else
    select coalesce(array_agg(k.id order by k.nr), '{}') into v_kolejnosc
      from jsonb_array_elements_text(coalesce(v_dane->'strony', '[]'::jsonb)) with ordinality as k(id, nr);
    select coalesce(jsonb_object_agg(strona_id, dane), '{}'::jsonb) into v_strony
      from public.projekty_strony where projekt_id = p.id;
  end if;

  -- Części projektu podane w całości.
  if p_zmiany ? 'nazwa' then
    if jsonb_typeof(p_zmiany->'nazwa') <> 'string' or length(trim(p_zmiany->>'nazwa')) = 0 or length(p_zmiany->>'nazwa') > 120 then
      v_bledy := v_bledy || 'nazwa: niepusty tekst do 120 znaków.'::text;
    end if;
  end if;
  foreach v_klucz in array array['sekcje', 'wzorce', 'style', 'tabele', 'serie'] loop
    if p_zmiany ? v_klucz then
      if public.ai_identyfikatory(p_zmiany->v_klucz) is null then
        v_bledy := v_bledy || format('%s: lista obiektów, każdy z niepowtarzalnym, niepustym „id”.', v_klucz);
      else
        v_dane := jsonb_set(v_dane, array[v_klucz], p_zmiany->v_klucz);
      end if;
    end if;
  end loop;
  if p_zmiany ? 'widok' and jsonb_typeof(p_zmiany->'widok') <> 'object' then
    v_bledy := v_bledy || 'widok: obiekt.'::text;
  elsif p_zmiany ? 'widok' then
    v_dane := jsonb_set(v_dane, '{widok}', p_zmiany->'widok');
  end if;

  -- Strony: nowe i zmienione, usunięte, kolejność.
  if p_zmiany ? 'strony' then
    if public.ai_identyfikatory(p_zmiany->'strony') is null then
      v_bledy := v_bledy || 'strony: lista obiektów stron, każda z niepowtarzalnym, niepustym „id”.'::text;
    else
      for x in select * from jsonb_array_elements(p_zmiany->'strony') loop
        v_id := x->>'id';
        if not (v_id = any(v_kolejnosc)) then
          v_kolejnosc := v_kolejnosc || v_id;
        end if;
        v_strony := v_strony || jsonb_build_object(v_id, x);
        if not (v_id = any(v_zmienione)) then
          v_zmienione := v_zmienione || v_id;
        end if;
      end loop;
    end if;
  end if;
  if p_zmiany ? 'usun_strony' then
    if jsonb_typeof(p_zmiany->'usun_strony') <> 'array' then
      v_bledy := v_bledy || 'usun_strony: lista identyfikatorów stron.'::text;
    else
      for v_id in select * from jsonb_array_elements_text(p_zmiany->'usun_strony') loop
        if not (v_id = any(v_kolejnosc)) then
          v_bledy := v_bledy || format('usun_strony: nie ma strony „%s”.', v_id);
        end if;
        v_kolejnosc := array_remove(v_kolejnosc, v_id);
        v_zmienione := array_remove(v_zmienione, v_id);
        v_strony := v_strony - v_id;
      end loop;
    end if;
  end if;
  if p_zmiany ? 'kolejnosc_stron' then
    if jsonb_typeof(p_zmiany->'kolejnosc_stron') <> 'array' then
      v_bledy := v_bledy || 'kolejnosc_stron: lista identyfikatorów stron.'::text;
    else
      select coalesce(array_agg(t.id order by t.nr), '{}') into v_tabele
        from jsonb_array_elements_text(p_zmiany->'kolejnosc_stron') with ordinality as t(id, nr);
      if cardinality(v_tabele) <> cardinality(v_kolejnosc) or not (v_tabele @> v_kolejnosc and v_kolejnosc @> v_tabele)
         or (select count(distinct u) from unnest(v_tabele) u) <> cardinality(v_tabele) then
        v_bledy := v_bledy || 'kolejnosc_stron: musi zawierać każdą stronę projektu dokładnie raz.'::text;
      else
        v_kolejnosc := v_tabele;
      end if;
    end if;
  end if;

  if cardinality(v_bledy) > 0 then
    return jsonb_build_object('blad', 'Zmiany odrzucone.', 'szczegoly', to_jsonb(v_bledy));
  end if;

  -- Spójność całości po zmianach (te same powiązania, które aplikacja sprawdza przy wczytaniu).
  v_sekcje := coalesce(public.ai_identyfikatory(coalesce(v_dane->'sekcje', '[]'::jsonb)), '{}');
  v_wzorce := coalesce(public.ai_identyfikatory(coalesce(v_dane->'wzorce', '[]'::jsonb)), '{}');
  v_serie := coalesce(public.ai_identyfikatory(coalesce(v_dane->'serie', '[]'::jsonb)), '{}');
  v_tabele := coalesce(public.ai_identyfikatory(coalesce(v_dane->'tabele', '[]'::jsonb)), '{}');
  select coalesce(array_agg(k), '{}') into v_zasoby from jsonb_object_keys(coalesce(v_dane->'zasoby', '{}'::jsonb)) k;
  if cardinality(v_sekcje) = 0 then
    v_bledy := v_bledy || 'Projekt musi mieć co najmniej jedną sekcję.'::text;
  end if;
  if cardinality(v_kolejnosc) = 0 then
    v_bledy := v_bledy || 'Projekt musi mieć co najmniej jedną stronę.'::text;
  end if;
  for x in select * from jsonb_array_elements(coalesce(v_dane->'sekcje', '[]'::jsonb)) loop
    if jsonb_typeof(x->'wydruk') <> 'object' then
      v_bledy := v_bledy || format('Sekcja „%s”: brak „wydruk” (format, wymiary, spad, marginesy).', x->>'id');
    end if;
    if x ? 'wzorce' and (jsonb_typeof(x->'wzorce') <> 'array' or exists (
         select 1 from jsonb_array_elements_text(x->'wzorce') w where not (w = any(v_wzorce)))) then
      v_bledy := v_bledy || format('Sekcja „%s”: „wzorce” wskazują nieistniejący wzorzec.', x->>'id');
    end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(v_dane->'tabele', '[]'::jsonb)) loop
    if jsonb_typeof(x->'kolumny') <> 'array' or jsonb_typeof(x->'wiersze') <> 'array'
       or exists (select 1 from jsonb_array_elements(x->'wiersze') w where jsonb_typeof(w) <> 'array') then
      v_bledy := v_bledy || format('Tabela „%s”: „kolumny” to lista nazw, a „wiersze” to lista list.', x->>'id');
    end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(v_dane->'serie', '[]'::jsonb)) loop
    if x->>'tabela' is not null and not ((x->>'tabela') = any(v_tabele)) then
      v_bledy := v_bledy || format('Seria „%s”: nie ma tabeli „%s”.', x->>'id', x->>'tabela');
    end if;
    if exists (select 1 from jsonb_array_elements(coalesce(x->'dodatkowe', '[]'::jsonb)) t where not ((t->>'tabela') = any(v_tabele))) then
      v_bledy := v_bledy || format('Seria „%s”: tabela dodatkowa wskazuje nieistniejącą tabelę.', x->>'id');
    end if;
  end loop;
  -- Strony: sekcja, wzorce, seria, elementy (typ i id), obrazy tylko z zasobów projektu.
  foreach v_id in array v_kolejnosc loop
    s := v_strony->v_id;
    if s is null then
      v_bledy := v_bledy || format('Brak treści strony „%s”.', v_id);
      continue;
    end if;
    if not ((s->>'sekcja') = any(v_sekcje)) then
      v_bledy := v_bledy || format('Strona „%s”: „sekcja” musi wskazywać istniejącą sekcję.', v_id);
    end if;
    if s ? 'wzorce' and s->'wzorce' <> '"z_sekcji"'::jsonb and (jsonb_typeof(s->'wzorce') <> 'array' or exists (
         select 1 from jsonb_array_elements_text(s->'wzorce') w where not (w = any(v_wzorce)))) then
      v_bledy := v_bledy || format('Strona „%s”: „wzorce” to "z_sekcji" albo lista istniejących wzorców.', v_id);
    end if;
    if s->>'seria' is not null and not ((s->>'seria') = any(v_serie)) then
      v_bledy := v_bledy || format('Strona „%s”: nie ma serii „%s”.', v_id, s->>'seria');
    end if;
  end loop;
  for x in
    select jsonb_build_object('gdzie', 'Strona „' || k || '”', 'obiekty', v_strony->k->'obiekty') from unnest(v_zmienione) k
    union all
    select jsonb_build_object('gdzie', 'Wzorzec „' || (w->>'id') || '”', 'obiekty', w->'obiekty')
      from jsonb_array_elements(case when p_zmiany ? 'wzorce' then coalesce(v_dane->'wzorce', '[]'::jsonb) else '[]'::jsonb end) w
  loop
    if x->'obiekty' is null or jsonb_typeof(x->'obiekty') <> 'array' then
      v_bledy := v_bledy || format('%s: „obiekty” to lista elementów.', x->>'gdzie');
      continue;
    end if;
    if public.ai_identyfikatory(x->'obiekty') is null then
      v_bledy := v_bledy || format('%s: każdy element musi mieć niepowtarzalne, niepuste „id”.', x->>'gdzie');
    end if;
    if exists (select 1 from jsonb_array_elements(x->'obiekty') o where not (lower(o->>'type') = any(v_typy))) then
      v_bledy := v_bledy || format('%s: nieznany rodzaj elementu (type) – dozwolone: %s.', x->>'gdzie', array_to_string(v_typy, ', '));
    end if;
    if exists (select 1 from jsonb_path_query(x->'obiekty', 'lax $.**.zasob') z
               where jsonb_typeof(z) = 'string' and not ((z #>> '{}') = any(v_zasoby))) then
      v_bledy := v_bledy || format('%s: obraz wskazuje zasób, którego nie ma w projekcie (z klucza nie da się wgrać nowych obrazów).', x->>'gdzie');
    end if;
  end loop;
  if cardinality(v_bledy) > 0 then
    return jsonb_build_object('blad', 'Zmiany odrzucone – projekt byłby niespójny.', 'szczegoly', to_jsonb(v_bledy[1:20]));
  end if;

  -- Zapis: projekt (kolejność stron, części), zmienione strony, usunięte strony; wersja w górę.
  v_wersja := p.wersja + 1;
  v_dane := v_dane || jsonb_build_object(
    'strony', to_jsonb(v_kolejnosc),
    'strony_osobno', true,
    'zmieniono', to_jsonb(now()));
  update public.projekty
     set nazwa = coalesce(p_zmiany->>'nazwa', nazwa),
         dane = case when p_zmiany ? 'nazwa' then jsonb_set(v_dane, '{nazwa}', p_zmiany->'nazwa') else v_dane end,
         zmieniono = now(),
         wersja = v_wersja
   where id = p.id;
  insert into public.projekty_strony (projekt_id, strona_id, owner_id, dane)
    select p.id, k, p.owner_id, v_strony->k from unnest(v_zmienione) k
  on conflict (projekt_id, strona_id) do update set dane = excluded.dane;
  delete from public.projekty_strony st where st.projekt_id = p.id and not (st.strona_id = any(v_kolejnosc));
  return jsonb_build_object('wersja', v_wersja, 'strony_zapisane', cardinality(v_zmienione));
end;
$$;

revoke all on function public.ai_zapisz(text, bigint, jsonb) from public;
grant execute on function public.ai_zapisz(text, bigint, jsonb) to anon, authenticated;
