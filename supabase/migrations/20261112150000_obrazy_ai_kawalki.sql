-- Migracja: obrazy od AI wgrywane w kawałkach.
--
-- Pomiar na prawdziwej bazie (wysyłka POST …/mcp/<klucz>/obraz → jedno RPC ai_wgraj_obraz z całym plikiem
-- w base64): 1,15 MB – 2,7 s, 2,3 MB – przerwane, 3,7 MB – 6,2 s, 5 MB – 9,8 s, 6 MB i więcej – przerwane
-- („canceling statement due to statement timeout”). Łącznik woła bazę kluczem publicznym, czyli jako rola
-- anon, a ta ma krótki limit czasu na jedno zapytanie. Podnoszenie limitu dla roli zmieniłoby go dla
-- wszystkich zapytań, a SET w funkcji nie przedłuża zapytania, które już trwa.
--
-- Dlatego większy plik idzie w kawałkach po 512 KB, każdy w osobnym, krótkim zapytaniu:
--   ai_wgraj_poczatek → ai_wgraj_czesc (0..n-1, dowolna kolejność, można powtórzyć) → ai_wgraj_koniec.
-- Kawałki zostają w osobnych wierszach (obrazy_ai_czesci) – baza nie skleja pliku (to właśnie trwało za
-- długo). Aplikacja właściciela pobiera je po kolei (pobierz_czesc_obrazu_ai) i skleja u siebie.
-- Do limitu zapytań klucza (120 na minutę) liczy się tylko początek wgrania – kawałki i koniec dotyczą
-- wgrania, które klucz już zaczął, więc folder z 50 zdjęciami nie wyczerpie limitu.
-- ai_wgraj_obraz zostaje dla małych plików (do 1 MB) – jedno zapytanie, zgodność z opisem OpenAPI.
-- Zasady (duplikaty po skrócie, zajęte nazwy, zastąpienie z przepięciem) są wspólne: ai_obraz_dopisz.

alter table public.obrazy_ai alter column dane drop not null;
alter table public.obrazy_ai add column if not exists czesci integer;
alter table public.obrazy_ai add column if not exists gotowy boolean not null default true;
alter table public.obrazy_ai add column if not exists szer integer;
alter table public.obrazy_ai add column if not exists wys integer;
alter table public.obrazy_ai add column if not exists zastap text;
alter table public.obrazy_ai add column if not exists nazwa_prosba text;

create table if not exists public.obrazy_ai_czesci (
  wiersz  uuid not null references public.obrazy_ai (id) on delete cascade,
  nr      integer not null check (nr >= 0),
  dane    bytea not null,
  primary key (wiersz, nr)
);

alter table public.obrazy_ai_czesci enable row level security;
revoke all on table public.obrazy_ai_czesci from anon, authenticated;

-- ---------- Klucz bez liczenia do limitu zapytań ----------

-- Wspólne sprawdzenie klucza; p_licz = false – zapytanie nie liczy się do limitu 120 na minutę (kawałki
-- i koniec wgrania, które klucz już zaczął). Zła treść klucza zawsze liczy się do blokady po 10 próbach.
create or replace function public.ai_sprawdz_klucz(p_klucz text, p_edycja boolean, p_licz boolean)
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
    return jsonb_build_object('blad', 'Dostęp został odebrany przez właściciela projektu.');
  end if;
  if d.wazny_do <= now() then
    return jsonb_build_object('blad', 'Klucz dostępu wygasł. Poproś właściciela projektu o nowy.');
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
  if p_edycja and d.rola <> 'edycja' then
    return jsonb_build_object('blad', 'Ten klucz pozwala tylko czytać projekt.');
  end if;
  return jsonb_build_object('id', d.id, 'projekt_id', d.projekt_id, 'owner_id', d.owner_id,
                            'rola', d.rola, 'opis', d.opis, 'wazny_do', d.wazny_do);
end;
$$;

revoke all on function public.ai_sprawdz_klucz(text, boolean, boolean) from public, anon, authenticated;

-- Dotychczasowa postać (wszystkie inne funkcje): każde zapytanie liczy się do limitu.
create or replace function public.ai_sprawdz_klucz(p_klucz text, p_edycja boolean)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.ai_sprawdz_klucz(p_klucz, p_edycja, true);
$$;

revoke all on function public.ai_sprawdz_klucz(text, boolean) from public, anon, authenticated;

-- ---------- Wspólne kawałki logiki ----------

-- Czy pierwsze bajty pliku pasują do jego rodzaju.
create or replace function public.ai_obraz_naglowek_ok(p_typ text, p_poczatek bytea)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_typ
    when 'image/png' then substring(p_poczatek from 1 for 8) = '\x89504e470d0a1a0a'::bytea
    when 'image/jpeg' then substring(p_poczatek from 1 for 3) = '\xffd8ff'::bytea
    when 'image/gif' then substring(p_poczatek from 1 for 4) = '\x47494638'::bytea
    when 'image/webp' then substring(p_poczatek from 1 for 4) = '\x52494646'::bytea and substring(p_poczatek from 9 for 4) = '\x57454250'::bytea
    when 'image/svg+xml' then position('\x3c737667'::bytea in substring(p_poczatek from 1 for 8192)) > 0
    else false end;
$$;

revoke all on function public.ai_obraz_naglowek_ok(text, bytea) from public, anon, authenticated;

-- Nazwa pliku: bez ścieżki i znaków sterujących, do 150 znaków, z rozszerzeniem zgodnym z rodzajem pliku, gdy go brak.
create or replace function public.ai_obraz_nazwa(p_nazwa text, p_typ text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  v := btrim(regexp_replace(regexp_replace(coalesce(p_nazwa, ''), '^.*[\\/]', ''), '[[:cntrl:]]', '', 'g'));
  if v = '' then
    v := 'obraz';
  end if;
  v := left(v, 150);
  if v !~* '\.[a-z0-9]{2,5}$' then
    v := v || case p_typ when 'image/png' then '.png' when 'image/jpeg' then '.jpg' when 'image/webp' then '.webp'
                         when 'image/gif' then '.gif' else '.svg' end;
  end if;
  return v;
end;
$$;

revoke all on function public.ai_obraz_nazwa(text, text) from public, anon, authenticated;

-- Obraz projektu o tym samym skrócie (ten sam plik) jako gotowa odpowiedź „już był” albo null.
create or replace function public.ai_obraz_istniejacy(p_dane jsonb, p_wersja bigint, p_skrot text, p_typ text, p_szer integer, p_wys integer, p_rozmiar integer)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_czcionki text[];
  z record;
begin
  select coalesce(array_agg(c->>'id'), '{}') into v_czcionki
    from jsonb_array_elements(case when jsonb_typeof(p_dane->'czcionki') = 'array' then p_dane->'czcionki' else '[]'::jsonb end) c;
  for z in select key, value from jsonb_each(coalesce(p_dane->'zasoby', '{}'::jsonb)) loop
    if not (z.key = any(v_czcionki)) and z.value->>'skrot' = p_skrot then
      return jsonb_build_object('id', z.key, 'nazwa', z.value->>'nazwa', 'typ', coalesce(z.value->>'typ', p_typ),
        'szer', coalesce(z.value->'szer', to_jsonb(p_szer)), 'wys', coalesce(z.value->'wys', to_jsonb(p_wys)),
        'rozmiar', p_rozmiar, 'byl', true, 'wersja', p_wersja);
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.ai_obraz_istniejacy(jsonb, bigint, text, text, integer, integer, integer) from public, anon, authenticated;

-- Dopisuje do projektu gotowy plik z wiersza obrazy_ai (cały albo w kawałkach): ten sam plik już jest →
-- wiersz znika, wynik „już był”; zajęta nazwa → „(2)”, „(3)”…; zastąpienie → przepięcie elementów stron
-- i wzorców, stary obraz do nagrobków. Podbija wersję projektu (powiadomienie na żywo).
-- Zwraca { id, nazwa, typ, szer, wys, rozmiar, byl, nazwa_zmieniona, zastapiony?, wersja } albo { blad }.
create or replace function public.ai_obraz_dopisz(p_wiersz uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.obrazy_ai%rowtype;
  p public.projekty%rowtype;
  v_zasoby jsonb;
  v_czcionki text[];
  v_nazwa text;
  v_rdzen text;
  v_roz text;
  v_n integer;
  v_id text;
  v_wpis jsonb;
  v_dane jsonb;
  v_stary jsonb;
  v_tekst text;
  v_wersja bigint;
  v_byl jsonb;
begin
  select * into o from public.obrazy_ai where id = p_wiersz;
  if not found then
    return jsonb_build_object('blad', 'Nie ma takiego wgrania (mogło wygasnąć po dobie).');
  end if;
  select * into p from public.projekty where id = o.projekt_id for update;
  if not found then
    return jsonb_build_object('blad', 'Projektu już nie ma.');
  end if;

  -- Ten sam plik już jest (np. wgrany równolegle): nic nie dodajemy.
  v_byl := public.ai_obraz_istniejacy(p.dane, p.wersja, o.skrot, o.typ, o.szer, o.wys, o.rozmiar);
  if v_byl is not null then
    delete from public.obrazy_ai where id = o.id;
    return v_byl;
  end if;

  v_zasoby := coalesce(p.dane->'zasoby', '{}'::jsonb);
  select coalesce(array_agg(c->>'id'), '{}') into v_czcionki
    from jsonb_array_elements(case when jsonb_typeof(p.dane->'czcionki') = 'array' then p.dane->'czcionki' else '[]'::jsonb end) c;

  v_nazwa := o.nazwa;
  if o.zastap is not null then
    v_stary := v_zasoby->o.zastap;
    if v_stary is null or o.zastap = any(v_czcionki) then
      delete from public.obrazy_ai where id = o.id;
      return jsonb_build_object('blad', 'Nie ma obrazu „' || o.zastap || '” do zastąpienia (lista: obrazy_projektu).');
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

  update public.obrazy_ai set nazwa = v_nazwa, gotowy = true where id = o.id;
  v_id := 'z_ai' || left(replace(o.id::text, '-', ''), 12);
  v_wpis := jsonb_strip_nulls(jsonb_build_object('nazwa', v_nazwa, 'typ', o.typ, 'rozmiar', o.rozmiar, 'skrot', o.skrot,
    'szer', o.szer, 'wys', o.wys, 'sciezka', 'ai:' || o.id::text));
  v_dane := p.dane || jsonb_build_object('zasoby', v_zasoby || jsonb_build_object(v_id, v_wpis));

  if o.zastap is not null then
    -- Stary obraz: wpis znika, identyfikator do nagrobków, elementy przepięte na nowy (strony i wzorce).
    v_dane := jsonb_set(v_dane, '{zasoby}', (v_dane->'zasoby') - o.zastap);
    v_dane := v_dane || jsonb_build_object('zasoby_usuniete',
      (select to_jsonb(array_agg(distinct x)) from (
         select jsonb_array_elements_text(case when jsonb_typeof(v_dane->'zasoby_usuniete') = 'array' then v_dane->'zasoby_usuniete' else '[]'::jsonb end) x
         union select o.zastap) t));
    v_tekst := v_dane::text;
    v_tekst := replace(v_tekst, '"zasob": ' || to_jsonb(o.zastap)::text, '"zasob": ' || to_jsonb(v_id)::text);
    v_tekst := replace(v_tekst, to_jsonb('zasob:' || o.zastap)::text, to_jsonb('zasob:' || v_id)::text);
    v_dane := v_tekst::jsonb;
    update public.projekty_strony
       set dane = replace(replace(dane::text,
                    '"zasob": ' || to_jsonb(o.zastap)::text, '"zasob": ' || to_jsonb(v_id)::text),
                    to_jsonb('zasob:' || o.zastap)::text, to_jsonb('zasob:' || v_id)::text)::jsonb
     where projekt_id = p.id and position(o.zastap in dane::text) > 0;
    -- Stary plik nie jest już potrzebny: z tej tabeli znika od razu, z folderu plików – przez aplikację.
    perform public.ai_odloz_plik(p.id, p.owner_id, v_stary->>'sciezka', v_dane->'zasoby');
  end if;

  v_wersja := p.wersja + 1;
  update public.projekty
     set dane = v_dane || jsonb_build_object('zmieniono', to_jsonb(now())),
         zmieniono = now(),
         wersja = v_wersja
   where id = p.id;
  return jsonb_strip_nulls(jsonb_build_object('id', v_id, 'nazwa', v_nazwa, 'typ', o.typ, 'szer', o.szer, 'wys', o.wys,
    'rozmiar', o.rozmiar, 'byl', false, 'nazwa_zmieniona', o.zastap is null and v_nazwa <> coalesce(o.nazwa_prosba, ''),
    'zastapiony', o.zastap, 'wersja', v_wersja));
end;
$$;

revoke all on function public.ai_obraz_dopisz(uuid) from public, anon, authenticated;

-- ---------- Mały plik jednym zapytaniem (do 1 MB) ----------

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
  v_byl jsonb;
  v_suma bigint;
  v_wiersz uuid;
begin
  d := public.ai_sprawdz_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if p_typ is null or p_typ not in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml') then
    return jsonb_build_object('blad', 'Obsługiwane obrazy: PNG, JPEG, WebP, GIF i SVG.');
  end if;
  -- Długość base64 przed dekodowaniem: większy plik w jednym zapytaniu nie zdążyłby się zapisać.
  if length(coalesce(p_dane, '')) > 1400000 then
    return jsonb_build_object('blad', 'Plik jest za duży na jedno zapytanie (najwyżej 1 MB). Większy wgraj w kawałkach: ai_wgraj_poczatek, ai_wgraj_czesc, ai_wgraj_koniec – albo wyślij go wprost: POST …/functions/v1/mcp/<klucz>/obraz (do 25 MB).');
  end if;
  begin
    v_bajty := decode(coalesce(p_dane, ''), 'base64');
  exception when others then
    return jsonb_build_object('blad', 'Treść pliku nie jest poprawnym base64.');
  end;
  if octet_length(v_bajty) = 0 then
    return jsonb_build_object('blad', 'Plik jest pusty.');
  end if;
  if octet_length(v_bajty) > 1024 * 1024 then
    return jsonb_build_object('blad', 'Plik jest za duży na jedno zapytanie (najwyżej 1 MB). Większy wgraj w kawałkach: ai_wgraj_poczatek, ai_wgraj_czesc, ai_wgraj_koniec – albo wyślij go wprost: POST …/functions/v1/mcp/<klucz>/obraz (do 25 MB).');
  end if;
  if not public.ai_obraz_naglowek_ok(p_typ, v_bajty) then
    return jsonb_build_object('blad', 'Treść pliku nie pasuje do jego rodzaju (' || p_typ || ').');
  end if;
  if p_szer is not null and (p_szer < 1 or p_szer > 100000) or p_wys is not null and (p_wys < 1 or p_wys > 100000) then
    return jsonb_build_object('blad', 'Nieprawidłowe wymiary obrazu.');
  end if;
  v_skrot := encode(extensions.digest(v_bajty, 'sha256'), 'hex');

  select * into p from public.projekty where id = (d->>'projekt_id')::uuid;
  if not found then
    return jsonb_build_object('blad', 'Projektu już nie ma.');
  end if;
  v_byl := public.ai_obraz_istniejacy(p.dane, p.wersja, v_skrot, p_typ, p_szer, p_wys, octet_length(v_bajty));
  if v_byl is not null then
    return v_byl;
  end if;
  if p_zastap is not null and not coalesce(p.dane->'zasoby', '{}'::jsonb) ? p_zastap then
    return jsonb_build_object('blad', 'Nie ma obrazu „' || p_zastap || '” do zastąpienia (lista: obrazy_projektu).');
  end if;
  select coalesce(sum(rozmiar), 0) into v_suma from public.obrazy_ai where projekt_id = p.id;
  if v_suma + octet_length(v_bajty) > 150 * 1024 * 1024 then
    return jsonb_build_object('blad', 'Na przeniesienie czeka już za dużo obrazów (150 MB). Właściciel musi otworzyć projekt w aplikacji – wtedy obrazy przejdą na jego konto i miejsce się zwolni.');
  end if;

  insert into public.obrazy_ai (projekt_id, owner_id, nazwa, nazwa_prosba, typ, rozmiar, skrot, dane, szer, wys, zastap, gotowy)
    values (p.id, p.owner_id, public.ai_obraz_nazwa(p_nazwa, p_typ), btrim(coalesce(p_nazwa, '')), p_typ, octet_length(v_bajty),
            v_skrot, v_bajty, p_szer, p_wys, p_zastap, false)
    returning id into v_wiersz;
  return public.ai_obraz_dopisz(v_wiersz);
end;
$$;

revoke all on function public.ai_wgraj_obraz(text, text, text, text, integer, integer, text) from public;
grant execute on function public.ai_wgraj_obraz(text, text, text, text, integer, integer, text) to anon, authenticated;

-- ---------- Większy plik w kawałkach (do 25 MB) ----------

-- Początek: p_rozmiar – długość pliku w bajtach, p_skrot – SHA-256 treści (szesnastkowo; liczy wywołujący,
-- baza sprawdza go tylko jako duplikat – dotyczy wyłącznie projektu tego klucza).
-- Zwraca { wiersz, kawalek, czesci } albo – gdy ten sam plik już jest – odpowiedź „już był” ({ id, byl: true, … }),
-- albo { blad }.
create or replace function public.ai_wgraj_poczatek(
  p_klucz text, p_nazwa text, p_typ text, p_rozmiar integer, p_skrot text,
  p_szer integer default null, p_wys integer default null, p_zastap text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  p public.projekty%rowtype;
  v_byl jsonb;
  v_suma bigint;
  v_wiersz uuid;
  v_kawalek constant integer := 512 * 1024;
  v_czesci integer;
begin
  d := public.ai_sprawdz_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if p_typ is null or p_typ not in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml') then
    return jsonb_build_object('blad', 'Obsługiwane obrazy: PNG, JPEG, WebP, GIF i SVG.');
  end if;
  if p_rozmiar is null or p_rozmiar < 1 then
    return jsonb_build_object('blad', 'Podaj rozmiar pliku w bajtach (p_rozmiar).');
  end if;
  if p_rozmiar > 25 * 1024 * 1024 then
    return jsonb_build_object('blad', 'Plik jest za duży (najwyżej 25 MB).');
  end if;
  if coalesce(p_skrot, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('blad', 'p_skrot to SHA-256 treści pliku: 64 znaki szesnastkowe (małe litery).');
  end if;
  if p_szer is not null and (p_szer < 1 or p_szer > 100000) or p_wys is not null and (p_wys < 1 or p_wys > 100000) then
    return jsonb_build_object('blad', 'Nieprawidłowe wymiary obrazu.');
  end if;
  select * into p from public.projekty where id = (d->>'projekt_id')::uuid;
  if not found then
    return jsonb_build_object('blad', 'Projektu już nie ma.');
  end if;
  v_byl := public.ai_obraz_istniejacy(p.dane, p.wersja, p_skrot, p_typ, p_szer, p_wys, p_rozmiar);
  if v_byl is not null then
    return v_byl;
  end if;
  if p_zastap is not null and not coalesce(p.dane->'zasoby', '{}'::jsonb) ? p_zastap then
    return jsonb_build_object('blad', 'Nie ma obrazu „' || p_zastap || '” do zastąpienia (lista: obrazy_projektu).');
  end if;
  -- Niedokończone wgrania sprzed doby nie zajmują miejsca.
  delete from public.obrazy_ai where projekt_id = p.id and not gotowy and utworzono < now() - interval '1 day';
  select coalesce(sum(rozmiar), 0) into v_suma from public.obrazy_ai where projekt_id = p.id;
  if v_suma + p_rozmiar > 150 * 1024 * 1024 then
    return jsonb_build_object('blad', 'Na przeniesienie czeka już za dużo obrazów (150 MB). Właściciel musi otworzyć projekt w aplikacji – wtedy obrazy przejdą na jego konto i miejsce się zwolni.');
  end if;
  v_czesci := (p_rozmiar + v_kawalek - 1) / v_kawalek;
  insert into public.obrazy_ai (projekt_id, owner_id, nazwa, nazwa_prosba, typ, rozmiar, skrot, dane, czesci, szer, wys, zastap, gotowy)
    values (p.id, p.owner_id, public.ai_obraz_nazwa(p_nazwa, p_typ), btrim(coalesce(p_nazwa, '')), p_typ, p_rozmiar,
            p_skrot, null, v_czesci, p_szer, p_wys, p_zastap, false)
    returning id into v_wiersz;
  return jsonb_build_object('wiersz', v_wiersz, 'kawalek', v_kawalek, 'czesci', v_czesci);
end;
$$;

revoke all on function public.ai_wgraj_poczatek(text, text, text, integer, text, integer, integer, text) from public;
grant execute on function public.ai_wgraj_poczatek(text, text, text, integer, text, integer, integer, text) to anon, authenticated;

-- Kawałek nr p_nr (od 0) w base64, najwyżej 512 KB po zdekodowaniu. Powtórzony kawałek zastępuje poprzedni.
-- Zwraca { ok: true } albo { blad }.
create or replace function public.ai_wgraj_czesc(p_klucz text, p_wiersz uuid, p_nr integer, p_dane text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  o public.obrazy_ai%rowtype;
  v_bajty bytea;
begin
  d := public.ai_sprawdz_klucz(p_klucz, true, false);
  if d ? 'blad' then
    return d;
  end if;
  select * into o from public.obrazy_ai where id = p_wiersz and projekt_id = (d->>'projekt_id')::uuid and not gotowy;
  if not found then
    return jsonb_build_object('blad', 'Nie ma takiego wgrania albo jest już zakończone.');
  end if;
  if o.czesci is null or p_nr is null or p_nr < 0 or p_nr >= o.czesci then
    return jsonb_build_object('blad', format('Numer kawałka: od 0 do %s.', coalesce(o.czesci, 1) - 1));
  end if;
  if length(coalesce(p_dane, '')) > 720000 then
    return jsonb_build_object('blad', 'Kawałek jest za duży (najwyżej 512 KB).');
  end if;
  begin
    v_bajty := decode(coalesce(p_dane, ''), 'base64');
  exception when others then
    return jsonb_build_object('blad', 'Kawałek nie jest poprawnym base64.');
  end;
  if octet_length(v_bajty) = 0 or octet_length(v_bajty) > 512 * 1024 then
    return jsonb_build_object('blad', 'Kawałek jest pusty albo za duży (najwyżej 512 KB).');
  end if;
  insert into public.obrazy_ai_czesci (wiersz, nr, dane) values (o.id, p_nr, v_bajty)
    on conflict (wiersz, nr) do update set dane = excluded.dane;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.ai_wgraj_czesc(text, uuid, integer, text) from public;
grant execute on function public.ai_wgraj_czesc(text, uuid, integer, text) to anon, authenticated;

-- Koniec: komplet kawałków 0..n-1 o łącznej długości równej rozmiarowi, pierwsze bajty pasują do rodzaju
-- pliku – obraz trafia do projektu (ai_obraz_dopisz). Pliku nie sklejamy w bazie.
create or replace function public.ai_wgraj_koniec(p_klucz text, p_wiersz uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  o public.obrazy_ai%rowtype;
  v_ile integer;
  v_suma bigint;
  v_poczatek bytea;
begin
  d := public.ai_sprawdz_klucz(p_klucz, true, false);
  if d ? 'blad' then
    return d;
  end if;
  select * into o from public.obrazy_ai where id = p_wiersz and projekt_id = (d->>'projekt_id')::uuid and not gotowy;
  if not found then
    return jsonb_build_object('blad', 'Nie ma takiego wgrania albo jest już zakończone.');
  end if;
  select count(*), coalesce(sum(octet_length(dane)), 0) into v_ile, v_suma
    from public.obrazy_ai_czesci where wiersz = o.id and nr < o.czesci;
  if v_ile <> o.czesci then
    return jsonb_build_object('blad', format('Brakuje kawałków: jest %s z %s.', v_ile, o.czesci),
      'brakujace', (select to_jsonb(array_agg(n)) from generate_series(0, o.czesci - 1) n
                     where not exists (select 1 from public.obrazy_ai_czesci c where c.wiersz = o.id and c.nr = n)));
  end if;
  if v_suma <> o.rozmiar then
    return jsonb_build_object('blad', format('Kawałki mają razem %s bajtów, a plik – %s.', v_suma, o.rozmiar));
  end if;
  select substring(dane from 1 for 8192) into v_poczatek from public.obrazy_ai_czesci where wiersz = o.id and nr = 0;
  if not public.ai_obraz_naglowek_ok(o.typ, v_poczatek) then
    delete from public.obrazy_ai where id = o.id;
    return jsonb_build_object('blad', 'Treść pliku nie pasuje do jego rodzaju (' || o.typ || ').');
  end if;
  return public.ai_obraz_dopisz(o.id);
end;
$$;

revoke all on function public.ai_wgraj_koniec(text, uuid) from public;
grant execute on function public.ai_wgraj_koniec(text, uuid) to anon, authenticated;

-- ---------- Właściciel: pobieranie ----------

-- Treść obrazu, który czeka w tabeli (ścieżka zasobu „ai:<id>”). Mały plik: { typ, nazwa, dane (base64) }.
-- Plik w kawałkach: { typ, nazwa, rozmiar, skrot, czesci } bez treści – kawałki daje pobierz_czesc_obrazu_ai.
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
  select * into o from public.obrazy_ai where id = p_id and owner_id = auth.uid() and gotowy;
  if not found then
    raise exception 'Nie ma takiego obrazu (mógł już przejść na konto)';
  end if;
  if o.dane is null then
    return jsonb_build_object('typ', o.typ, 'nazwa', o.nazwa, 'rozmiar', o.rozmiar, 'skrot', o.skrot, 'czesci', o.czesci);
  end if;
  return jsonb_build_object('typ', o.typ, 'nazwa', o.nazwa, 'dane', encode(o.dane, 'base64'));
end;
$$;

revoke all on function public.pobierz_obraz_ai(uuid) from public, anon;
grant execute on function public.pobierz_obraz_ai(uuid) to authenticated;

-- Jeden kawałek pliku (base64). Tylko właściciel.
create or replace function public.pobierz_czesc_obrazu_ai(p_id uuid, p_nr integer)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v bytea;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  select c.dane into v from public.obrazy_ai_czesci c
    join public.obrazy_ai o on o.id = c.wiersz
   where c.wiersz = p_id and c.nr = p_nr and o.owner_id = auth.uid() and o.gotowy;
  if not found then
    raise exception 'Nie ma takiego kawałka obrazu';
  end if;
  return encode(v, 'base64');
end;
$$;

revoke all on function public.pobierz_czesc_obrazu_ai(uuid, integer) from public, anon;
grant execute on function public.pobierz_czesc_obrazu_ai(uuid, integer) to authenticated;
