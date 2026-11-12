-- Migracja: obrazy wgrywane przez AI (klucz dostępu do projektu).
--
-- AI (łącznik MCP albo serwer u siebie) wgrywa obraz funkcją ai_wgraj_obraz z kluczem projektu. Klucz nie
-- otwiera folderu plików konta (storage), a łącznik nie ma żadnego klucza serwisowego – dlatego plik czeka
-- w tabeli obrazy_ai, a w projekcie pojawia się zwykły wpis zasobu ze ścieżką „ai:<id wiersza>”.
-- Aplikacja właściciela pobiera taki plik funkcją pobierz_obraz_ai (tylko właściciel), przy najbliższym
-- zapisie wysyła go do swojego folderu plików jak każdy inny obraz, a wiersz usuwa funkcją usun_obraz_ai.
--
-- Zasady takie jak w aplikacji (js/obrazy-projektu.js):
--  – ten sam plik (skrót SHA-256) drugi raz nie wchodzi – wynik wskazuje obraz, który już jest;
--  – nazwa (pełna, z rozszerzeniem; wielkość liter bez znaczenia) jest niepowtarzalna: inny plik o zajętej
--    nazwie dostaje dopisek „(2)”, „(3)”…;
--  – „zastąp” daje nowy identyfikator z tą samą nazwą, elementy stron i wzorców są do niego przepinane,
--    a stary obraz trafia do nagrobków (zasoby_usuniete), żeby łączenie go nie przywróciło.
-- Wgranie podbija wersję projektu, więc otwarty edytor dostaje zmianę na żywo (Realtime).

create table if not exists public.obrazy_ai (
  id          uuid primary key default gen_random_uuid(),
  projekt_id  uuid not null references public.projekty (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  nazwa       text not null,
  typ         text not null check (typ in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml')),
  rozmiar     integer not null,
  skrot       text not null,
  dane        bytea not null,
  utworzono   timestamptz not null default now()
);

create index if not exists obrazy_ai_projekt on public.obrazy_ai (projekt_id);

-- Bez polityk: do tabeli nikt nie sięga wprost, tylko przez funkcje poniżej.
alter table public.obrazy_ai enable row level security;
revoke all on table public.obrazy_ai from anon, authenticated;

-- Pliki do usunięcia z folderu plików właściciela (bucket „zasoby”). Funkcja SQL nie może usunąć obiektu
-- z magazynu plików Supabase – robi to aplikacja właściciela (js/chmura.js: sprzatnijPliki) przy otwarciu
-- projektu i po połączeniu zmian, a potem usuwa wiersz. Tu trafiają pliki obrazów usuniętych albo
-- zastąpionych przez AI.
create table if not exists public.zasoby_do_usuniecia (
  id          uuid primary key default gen_random_uuid(),
  projekt_id  uuid not null references public.projekty (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  sciezka     text not null,
  utworzono   timestamptz not null default now(),
  unique (projekt_id, sciezka)
);

alter table public.zasoby_do_usuniecia enable row level security;
revoke all on table public.zasoby_do_usuniecia from anon, authenticated;

-- Plik zasobu, który przestał być potrzebny (wewnętrzna): jeśli żaden inny wpis w p_zasoby nie wskazuje tej
-- samej ścieżki – obraz czekający w obrazy_ai znika od razu, a plik z folderu trafia do zasoby_do_usuniecia.
create or replace function public.ai_odloz_plik(p_projekt uuid, p_owner uuid, p_sciezka text, p_zasoby jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_sciezka is null or p_sciezka = '' then
    return;
  end if;
  if exists (select 1 from jsonb_each(coalesce(p_zasoby, '{}'::jsonb)) z where z.value->>'sciezka' = p_sciezka) then
    return;
  end if;
  if p_sciezka like 'ai:%' then
    delete from public.obrazy_ai where projekt_id = p_projekt and id::text = substring(p_sciezka from 4);
  elsif p_sciezka like p_owner::text || '/' || p_projekt::text || '/%' then
    insert into public.zasoby_do_usuniecia (projekt_id, owner_id, sciezka) values (p_projekt, p_owner, p_sciezka)
      on conflict (projekt_id, sciezka) do nothing;
  end if;
end;
$$;

revoke all on function public.ai_odloz_plik(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- Właściciel: lista plików do usunięcia z folderu i potwierdzenie, że usunięte.
create or replace function public.pliki_do_usuniecia(p_projekt uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(sciezka), '{}') from public.zasoby_do_usuniecia
   where projekt_id = p_projekt and owner_id = auth.uid();
$$;

revoke all on function public.pliki_do_usuniecia(uuid) from public, anon;
grant execute on function public.pliki_do_usuniecia(uuid) to authenticated;

create or replace function public.pliki_usuniete(p_projekt uuid, p_sciezki text[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.zasoby_do_usuniecia
   where projekt_id = p_projekt and owner_id = auth.uid() and sciezka = any(p_sciezki);
$$;

revoke all on function public.pliki_usuniete(uuid, text[]) from public, anon;
grant execute on function public.pliki_usuniete(uuid, text[]) to authenticated;

-- Wgranie obrazu kluczem. p_dane – treść pliku w base64. p_szer, p_wys – wymiary w pikselach (liczy je
-- łącznik z nagłówka pliku). p_zastap – id obrazu, który ten plik zastępuje (opcjonalnie).
-- Zwraca { id, nazwa, typ, szer, wys, rozmiar, byl, nazwa_zmieniona, zastapiony?, wersja } albo { blad }.
create or replace function public.ai_wgraj_obraz(
  p_klucz text, p_nazwa text, p_typ text, p_dane text,
  p_szer integer default null, p_wys integer default null, p_zastap text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  p public.projekty%rowtype;
  v_bajty bytea;
  v_skrot text;
  v_zasoby jsonb;
  v_czcionki text[];
  v_nazwa text;
  v_rdzen text;
  v_roz text;
  v_n integer;
  v_wiersz uuid;
  v_id text;
  v_wpis jsonb;
  v_dane jsonb;
  v_stary jsonb;
  v_suma bigint;
  v_tekst text;
  v_wersja bigint;
  z record;
begin
  d := public.ai_sprawdz_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if p_typ is null or p_typ not in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml') then
    return jsonb_build_object('blad', 'Obsługiwane obrazy: PNG, JPEG, WebP, GIF i SVG.');
  end if;
  begin
    v_bajty := decode(coalesce(p_dane, ''), 'base64');
  exception when others then
    return jsonb_build_object('blad', 'Treść pliku nie jest poprawnym base64.');
  end;
  if octet_length(v_bajty) = 0 then
    return jsonb_build_object('blad', 'Plik jest pusty.');
  end if;
  if octet_length(v_bajty) > 15 * 1024 * 1024 then
    return jsonb_build_object('blad', 'Plik jest za duży (najwyżej 15 MB).');
  end if;
  -- Treść musi zgadzać się z rodzajem pliku (pierwsze bajty).
  if (p_typ = 'image/png' and substring(v_bajty from 1 for 8) <> '\x89504e470d0a1a0a'::bytea)
     or (p_typ = 'image/jpeg' and substring(v_bajty from 1 for 3) <> '\xffd8ff'::bytea)
     or (p_typ = 'image/gif' and substring(v_bajty from 1 for 4) <> '\x47494638'::bytea)
     or (p_typ = 'image/webp' and (substring(v_bajty from 1 for 4) <> '\x52494646'::bytea or substring(v_bajty from 9 for 4) <> '\x57454250'::bytea))
     or (p_typ = 'image/svg+xml' and position('\x3c737667'::bytea in substring(v_bajty from 1 for 8192)) = 0) then
    return jsonb_build_object('blad', 'Treść pliku nie pasuje do jego rodzaju (' || p_typ || ').');
  end if;
  if p_szer is not null and (p_szer < 1 or p_szer > 100000) or p_wys is not null and (p_wys < 1 or p_wys > 100000) then
    return jsonb_build_object('blad', 'Nieprawidłowe wymiary obrazu.');
  end if;
  v_skrot := encode(extensions.digest(v_bajty, 'sha256'), 'hex');

  -- Nazwa: bez ścieżki i znaków sterujących, z rozszerzeniem zgodnym z rodzajem pliku, gdy go brak.
  v_nazwa := btrim(regexp_replace(regexp_replace(coalesce(p_nazwa, ''), '^.*[\\/]', ''), '[[:cntrl:]]', '', 'g'));
  if v_nazwa = '' then
    v_nazwa := 'obraz';
  end if;
  v_nazwa := left(v_nazwa, 150);
  if v_nazwa !~* '\.[a-z0-9]{2,5}$' then
    v_nazwa := v_nazwa || case p_typ when 'image/png' then '.png' when 'image/jpeg' then '.jpg' when 'image/webp' then '.webp'
                                     when 'image/gif' then '.gif' else '.svg' end;
  end if;

  select * into p from public.projekty where id = (d->>'projekt_id')::uuid for update;
  if not found then
    return jsonb_build_object('blad', 'Projektu już nie ma.');
  end if;
  v_zasoby := coalesce(p.dane->'zasoby', '{}'::jsonb);
  select coalesce(array_agg(c->>'id'), '{}') into v_czcionki
    from jsonb_array_elements(case when jsonb_typeof(p.dane->'czcionki') = 'array' then p.dane->'czcionki' else '[]'::jsonb end) c;

  -- Ten sam plik już jest: nic nie dodajemy.
  for z in select key, value from jsonb_each(v_zasoby) loop
    if not (z.key = any(v_czcionki)) and z.value->>'skrot' = v_skrot then
      return jsonb_build_object('id', z.key, 'nazwa', z.value->>'nazwa', 'typ', coalesce(z.value->>'typ', p_typ),
        'szer', coalesce(z.value->'szer', to_jsonb(p_szer)), 'wys', coalesce(z.value->'wys', to_jsonb(p_wys)),
        'rozmiar', octet_length(v_bajty), 'byl', true, 'wersja', p.wersja);
    end if;
  end loop;

  if p_zastap is not null then
    v_stary := v_zasoby->p_zastap;
    if v_stary is null or p_zastap = any(v_czcionki) then
      return jsonb_build_object('blad', 'Nie ma obrazu „' || p_zastap || '” do zastąpienia (lista: obrazy_projektu).');
    end if;
    v_nazwa := v_stary->>'nazwa'; -- zastąpiony obraz zostawia nazwę – tabele danych dalej go wskazują
  else
    -- Zajęta nazwa: „zdjęcie (2).jpg”, „zdjęcie (3).jpg”…
    v_rdzen := regexp_replace(v_nazwa, '(\.[A-Za-z0-9]{2,5})$', '');
    v_roz := coalesce(substring(v_nazwa from '(\.[A-Za-z0-9]{2,5})$'), '');
    v_n := 1;
    while exists (select 1 from jsonb_each(v_zasoby) x
                   where not (x.key = any(v_czcionki)) and lower(btrim(x.value->>'nazwa')) = lower(v_nazwa)) loop
      v_n := v_n + 1;
      v_nazwa := v_rdzen || ' (' || v_n || ')' || v_roz;
    end loop;
  end if;

  select coalesce(sum(rozmiar), 0) into v_suma from public.obrazy_ai where projekt_id = p.id;
  if v_suma + octet_length(v_bajty) > 150 * 1024 * 1024 then
    return jsonb_build_object('blad', 'Na przeniesienie czeka już za dużo obrazów (150 MB). Właściciel musi otworzyć projekt w aplikacji – wtedy obrazy przejdą na jego konto i miejsce się zwolni.');
  end if;

  insert into public.obrazy_ai (projekt_id, owner_id, nazwa, typ, rozmiar, skrot, dane)
    values (p.id, p.owner_id, v_nazwa, p_typ, octet_length(v_bajty), v_skrot, v_bajty)
    returning id into v_wiersz;
  v_id := 'z_ai' || left(replace(v_wiersz::text, '-', ''), 12);
  v_wpis := jsonb_strip_nulls(jsonb_build_object('nazwa', v_nazwa, 'typ', p_typ, 'rozmiar', octet_length(v_bajty), 'skrot', v_skrot,
    'szer', p_szer, 'wys', p_wys, 'sciezka', 'ai:' || v_wiersz::text));
  v_dane := p.dane || jsonb_build_object('zasoby', v_zasoby || jsonb_build_object(v_id, v_wpis));

  if p_zastap is not null then
    -- Stary obraz: wpis znika, identyfikator do nagrobków, elementy przepięte na nowy (strony i wzorce).
    v_dane := jsonb_set(v_dane, '{zasoby}', (v_dane->'zasoby') - p_zastap);
    v_dane := v_dane || jsonb_build_object('zasoby_usuniete',
      (select to_jsonb(array_agg(distinct x)) from (
         select jsonb_array_elements_text(case when jsonb_typeof(v_dane->'zasoby_usuniete') = 'array' then v_dane->'zasoby_usuniete' else '[]'::jsonb end) x
         union select p_zastap) t));
    v_tekst := v_dane::text;
    v_tekst := replace(v_tekst, '"zasob": ' || to_jsonb(p_zastap)::text, '"zasob": ' || to_jsonb(v_id)::text);
    v_tekst := replace(v_tekst, to_jsonb('zasob:' || p_zastap)::text, to_jsonb('zasob:' || v_id)::text);
    v_dane := v_tekst::jsonb;
    update public.projekty_strony
       set dane = replace(replace(dane::text,
                    '"zasob": ' || to_jsonb(p_zastap)::text, '"zasob": ' || to_jsonb(v_id)::text),
                    to_jsonb('zasob:' || p_zastap)::text, to_jsonb('zasob:' || v_id)::text)::jsonb
     where projekt_id = p.id and position(p_zastap in dane::text) > 0;
    -- Stary plik nie jest już potrzebny: z tej tabeli znika od razu, z folderu plików – przez aplikację.
    perform public.ai_odloz_plik(p.id, p.owner_id, v_stary->>'sciezka', v_dane->'zasoby');
  end if;

  v_wersja := p.wersja + 1;
  update public.projekty
     set dane = v_dane || jsonb_build_object('zmieniono', to_jsonb(now())),
         zmieniono = now(),
         wersja = v_wersja
   where id = p.id;
  return jsonb_strip_nulls(jsonb_build_object('id', v_id, 'nazwa', v_nazwa, 'typ', p_typ, 'szer', p_szer, 'wys', p_wys,
    'rozmiar', octet_length(v_bajty), 'byl', false, 'nazwa_zmieniona', p_zastap is null and v_nazwa <> btrim(coalesce(p_nazwa, '')),
    'zastapiony', p_zastap, 'wersja', v_wersja));
end;
$$;

revoke all on function public.ai_wgraj_obraz(text, text, text, text, integer, integer, text) from public;
grant execute on function public.ai_wgraj_obraz(text, text, text, text, integer, integer, text) to anon, authenticated;

-- Właściciel: treść obrazu, który czeka w tabeli (ścieżka zasobu „ai:<id>”). Zwraca { typ, dane (base64) }.
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
  select * into o from public.obrazy_ai where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'Nie ma takiego obrazu (mógł już przejść na konto)';
  end if;
  return jsonb_build_object('typ', o.typ, 'nazwa', o.nazwa, 'dane', encode(o.dane, 'base64'));
end;
$$;

revoke all on function public.pobierz_obraz_ai(uuid) from public, anon;
grant execute on function public.pobierz_obraz_ai(uuid) to authenticated;

-- Właściciel: usuwa obraz z tabeli – po przeniesieniu go do własnego folderu plików albo po usunięciu
-- obrazu z projektu.
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
  delete from public.obrazy_ai where id = p_id and owner_id = auth.uid();
end;
$$;

revoke all on function public.usun_obraz_ai(uuid) from public, anon;
grant execute on function public.usun_obraz_ai(uuid) to authenticated;

-- Odczyt projektu kluczem: opis obrazu ma teraz także wymiary i rozmiar pliku (do wstawiania obrazów przez AI).
-- Poza tym bez zmian względem 20261111200000_dostep_ai.sql.
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
      'zasoby', coalesce((select jsonb_object_agg(z.key, jsonb_strip_nulls(jsonb_build_object(
                            'nazwa', z.value->>'nazwa', 'typ', z.value->>'typ',
                            'szer', z.value->'szer', 'wys', z.value->'wys', 'rozmiar', z.value->'rozmiar', 'skrot', z.value->'skrot')))
                          from jsonb_each(coalesce(v_dane->'zasoby', '{}'::jsonb)) z), '{}'::jsonb));
  return jsonb_build_object(
    'dostep', jsonb_build_object('rola', d->>'rola', 'opis', d->>'opis', 'wazny_do', d->'wazny_do'),
    'wersja', p.wersja,
    'projekt', v_dane);
end;
$$;

revoke all on function public.ai_projekt(text) from public;
grant execute on function public.ai_projekt(text) to anon, authenticated;

-- Zmiany obrazów kluczem (zmiana nazwy, usuwanie, porządkowanie – to, co właściciel robi w oknie „Obrazy projektu”).
-- Łącznik robi to w trzech krokach: nowe wpisy (kopie opisu istniejącego obrazu pod nowym id i nazwą – ten sam
-- plik), przepięcie elementów i komórek tabel zwykłym ai_zapisz, na końcu usunięcie starych wpisów.
--   p_kopie: { "<nowe id>": { "z": "<id obrazu>", "nazwa": "<nazwa z rozszerzeniem>" } }
--   p_usun:  [ "<id obrazu>" ] – tylko obrazy, których nie pokazuje żaden element strony ani wzorca.
-- Usunięte id trafiają do nagrobków (zasoby_usuniete); niepotrzebne pliki – do sprzątnięcia (ai_odloz_plik).
-- Zwraca { wersja } albo { blad, szczegoly? }.
create or replace function public.ai_zmien_obrazy(p_klucz text, p_kopie jsonb default '{}'::jsonb, p_usun jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  p public.projekty%rowtype;
  v_zasoby jsonb;
  v_czcionki text[];
  v_usuniete text[];
  v_bledy text[] := '{}';
  v_strony jsonb;
  v_uzyte text[];
  v_id text;
  v_nazwa text;
  v_sciezka text;
  v_wersja bigint;
  x record;
begin
  d := public.ai_sprawdz_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if jsonb_typeof(coalesce(p_kopie, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_usun, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('blad', 'p_kopie to obiekt, a p_usun – lista identyfikatorów.');
  end if;
  select * into p from public.projekty where id = (d->>'projekt_id')::uuid for update;
  if not found then
    return jsonb_build_object('blad', 'Projektu już nie ma.');
  end if;
  v_zasoby := coalesce(p.dane->'zasoby', '{}'::jsonb);
  select coalesce(array_agg(c->>'id'), '{}') into v_czcionki
    from jsonb_array_elements(case when jsonb_typeof(p.dane->'czcionki') = 'array' then p.dane->'czcionki' else '[]'::jsonb end) c;
  select coalesce(array_agg(u), '{}') into v_usuniete
    from jsonb_array_elements_text(case when jsonb_typeof(p.dane->'zasoby_usuniete') = 'array' then p.dane->'zasoby_usuniete' else '[]'::jsonb end) u;

  -- Nowe wpisy: kopia opisu (ten sam plik) pod nowym id i nazwą.
  for x in select key, value from jsonb_each(coalesce(p_kopie, '{}'::jsonb)) loop
    v_nazwa := btrim(coalesce(x.value->>'nazwa', ''));
    if x.key !~ '^z_[A-Za-z0-9_]{4,40}$' or v_zasoby ? x.key or x.key = any(v_usuniete) then
      v_bledy := v_bledy || format('Nowe id „%s” jest nieprawidłowe albo zajęte.', x.key);
    elsif not (v_zasoby ? (x.value->>'z')) or (x.value->>'z') = any(v_czcionki) then
      v_bledy := v_bledy || format('Nie ma obrazu „%s”.', x.value->>'z');
    elsif v_nazwa = '' or length(v_nazwa) > 150 or v_nazwa ~ '[/\\[:cntrl:]]' or v_nazwa !~* '\.[a-z0-9]{2,5}$' then
      v_bledy := v_bledy || format('Nazwa „%s”: niepusta, do 150 znaków, z rozszerzeniem, bez ukośników.', v_nazwa);
    else
      v_zasoby := v_zasoby || jsonb_build_object(x.key, (v_zasoby->(x.value->>'z')) || jsonb_build_object('nazwa', v_nazwa));
    end if;
  end loop;

  -- Usuwane: tylko obrazy, których nie pokazuje żaden element (najpierw trzeba przepiąć elementy).
  if coalesce((p.dane->>'strony_osobno')::boolean, false) then
    select coalesce(jsonb_agg(s.dane), '[]'::jsonb) into v_strony from public.projekty_strony s where s.projekt_id = p.id;
  else
    v_strony := coalesce(p.dane->'strony', '[]'::jsonb);
  end if;
  select coalesce(array_agg(distinct z #>> '{}'), '{}') into v_uzyte
    from jsonb_path_query(jsonb_build_array(v_strony, coalesce(p.dane->'wzorce', '[]'::jsonb)), 'lax $.**.zasob') z
   where jsonb_typeof(z) = 'string';
  for v_id in select * from jsonb_array_elements_text(coalesce(p_usun, '[]'::jsonb)) loop
    if not (v_zasoby ? v_id) or v_id = any(v_czcionki) then
      v_bledy := v_bledy || format('Nie ma obrazu „%s”.', v_id);
    elsif v_id = any(v_uzyte) then
      v_bledy := v_bledy || format('Obraz „%s” jest jeszcze na stronie albo we wzorcu – nie usuwam go.', v_zasoby->v_id->>'nazwa');
    end if;
  end loop;
  if cardinality(v_bledy) > 0 then
    return jsonb_build_object('blad', 'Zmiany obrazów odrzucone.', 'szczegoly', to_jsonb(v_bledy));
  end if;
  for v_id in select * from jsonb_array_elements_text(coalesce(p_usun, '[]'::jsonb)) loop
    v_sciezka := v_zasoby->v_id->>'sciezka';
    v_zasoby := v_zasoby - v_id;
    v_usuniete := array(select distinct u from unnest(v_usuniete || v_id) u);
    perform public.ai_odloz_plik(p.id, p.owner_id, v_sciezka, v_zasoby);
  end loop;

  -- Nowa nazwa nie może być zajęta (wielkość liter bez znaczenia) – tak dane wskazują obrazy. Wyjątek:
  -- obraz, z którego powstaje kopia (zmiana samej wielkości liter). Starsze powtórzenia porządkuje uporzadkuj_obrazy.
  for x in select key, value from jsonb_each(coalesce(p_kopie, '{}'::jsonb)) loop
    if exists (select 1 from jsonb_each(v_zasoby) z
                where z.key <> x.key and z.key <> (x.value->>'z') and not (z.key = any(v_czcionki))
                  and lower(btrim(z.value->>'nazwa')) = lower(btrim(x.value->>'nazwa'))) then
      return jsonb_build_object('blad', format('Nazwa „%s” jest już zajęta przez inny obraz – wybierz inną.', btrim(x.value->>'nazwa')));
    end if;
  end loop;

  v_wersja := p.wersja + 1;
  update public.projekty
     set dane = p.dane || jsonb_build_object('zasoby', v_zasoby, 'zasoby_usuniete', to_jsonb(v_usuniete), 'zmieniono', to_jsonb(now())),
         zmieniono = now(),
         wersja = v_wersja
   where id = p.id;
  return jsonb_build_object('wersja', v_wersja);
end;
$$;

revoke all on function public.ai_zmien_obrazy(text, jsonb, jsonb) from public;
grant execute on function public.ai_zmien_obrazy(text, jsonb, jsonb) to anon, authenticated;
