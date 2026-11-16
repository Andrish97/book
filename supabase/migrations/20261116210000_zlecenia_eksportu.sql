-- Eksport PDF i PNG zlecany przez AI (decyzja #175).
--
-- Plik PDF rysuje przeglądarka (Fabric, czcionki, profile barwne) – łącznik AI sam go nie zrobi. Dlatego AI składa
-- tu ZLECENIE, a otwarta aplikacja konta klucza (dowolna karta; najchętniej ta z otwartym projektem) przyjmuje je
-- na żywo (Realtime), robi plik zwykłym kodem eksportu, wgrywa go do magazynu plików (R2, folder konta
-- „<konto>/_eksporty/<zlecenie>.pdf”) i oznacza zlecenie jako gotowe. Łącznik czeka chwilę na wynik i podaje
-- link do pobrania: https://api.makietka.app/eksport/<zlecenie>/<sekret>/<nazwa> – przekaźnik (cloudflare/api-worker.js)
-- wydaje plik, gdy eksport_do_pobrania() potwierdzi sekret i ważność. Gdy żadna karta nie jest otwarta,
-- AI dostaje link do aplikacji (#/p/<projekt>/eksport/<zlecenie>) – po jego otwarciu aplikacja zrobi plik sama.
--
-- Kto: zlecenie należy do konta klucza (wlasciciel) – to ono ma dostęp do projektu i to jego aplikacja robi plik.
-- Pliki i wiersze żyją 7 dni (wygasa); starsze sprząta aplikacja właściciela (wygasle_eksporty → usun_eksporty).

create table if not exists public.zlecenia_eksportu (
  id          uuid primary key default gen_random_uuid(),
  wlasciciel  uuid not null references auth.users (id) on delete cascade,
  projekt_id  uuid not null references public.projekty (id) on delete cascade,
  rodzaj      text not null default 'pdf' check (rodzaj in ('pdf', 'png')),
  ustawienia  jsonb not null default '{}' check (jsonb_typeof(ustawienia) = 'object' and pg_column_size(ustawienia) <= 4000),
  stan        text not null default 'czeka' check (stan in ('czeka', 'w_toku', 'gotowe', 'blad')),
  zrodlo      text not null default 'ai' check (zrodlo in ('ai')),
  podpis      text check (char_length(podpis) <= 120),
  karta       text check (char_length(karta) <= 80),
  przyjeto    timestamptz,
  plik        text check (char_length(plik) <= 300),
  nazwa       text check (char_length(nazwa) <= 200),
  typ         text check (char_length(typ) <= 100),
  rozmiar     bigint,
  strony      integer,
  uwagi       jsonb not null default '[]' check (jsonb_typeof(uwagi) = 'array' and pg_column_size(uwagi) <= 20000),
  blad        text check (char_length(blad) <= 1000),
  sekret      text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  utworzono   timestamptz not null default now(),
  zmieniono   timestamptz not null default now(),
  wygasa      timestamptz not null default now() + interval '7 days'
);
create index if not exists zlecenia_eksportu_wlasciciel on public.zlecenia_eksportu (wlasciciel, stan, utworzono);
alter table public.zlecenia_eksportu enable row level security;
revoke all on table public.zlecenia_eksportu from public, anon, authenticated;
grant select on table public.zlecenia_eksportu to authenticated;

drop policy if exists zlecenia_eksportu_czytanie on public.zlecenia_eksportu;
create policy zlecenia_eksportu_czytanie on public.zlecenia_eksportu for select to authenticated
  using (wlasciciel = (select auth.uid()));

-- Realtime: nowe zlecenie dociera od razu do otwartych kart konta (RLS powyżej).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'zlecenia_eksportu') then
    alter publication supabase_realtime add table public.zlecenia_eksportu;
  end if;
end $$;

-- Zlecenie w postaci dla aplikacji i łącznika (bez sekretu – ten tylko w ai_stan_eksportu dla gotowego pliku).
create or replace function public._eksport_json(z public.zlecenia_eksportu)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', z.id, 'projekt_id', z.projekt_id, 'rodzaj', z.rodzaj, 'ustawienia', z.ustawienia, 'stan', z.stan,
    'podpis', z.podpis, 'przyjeto', z.przyjeto, 'nazwa', z.nazwa, 'typ', z.typ, 'rozmiar', z.rozmiar,
    'strony', z.strony, 'uwagi', z.uwagi, 'blad', z.blad, 'utworzono', z.utworzono, 'zmieniono', z.zmieniono,
    'wygasa', z.wygasa);
$$;
revoke all on function public._eksport_json(public.zlecenia_eksportu) from public, anon, authenticated;

-- ---------- AI (łącznik, klucz konta) ----------

-- Nowe zlecenie: działa także z kluczem „tylko czyta” – plik nie zmienia projektu. Najwyżej 5 zleceń w kolejce
-- i 30 na godzinę na konto.
create or replace function public.ai_zlec_eksport(p_klucz text, p_rodzaj text, p_ustawienia jsonb default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := public.ai_sprawdz_klucz(p_klucz, false);
  v_konto uuid;
  v_z public.zlecenia_eksportu;
begin
  if d ? 'blad' then return d; end if;
  v_konto := (d->>'owner_id')::uuid;
  if coalesce(p_rodzaj, '') not in ('pdf', 'png') then
    return jsonb_build_object('blad', 'Rodzaj pliku: pdf albo png.');
  end if;
  if p_ustawienia is not null and jsonb_typeof(p_ustawienia) <> 'object' then
    return jsonb_build_object('blad', 'Ustawienia eksportu to obiekt JSON.');
  end if;
  if pg_column_size(coalesce(p_ustawienia, '{}'::jsonb)) > 4000 then
    return jsonb_build_object('blad', 'Za długie ustawienia eksportu.');
  end if;
  if (select count(*) from public.zlecenia_eksportu z where z.wlasciciel = v_konto and z.stan in ('czeka', 'w_toku') and z.wygasa > now()) >= 5 then
    return jsonb_build_object('blad', 'W kolejce czeka już 5 eksportów – poczekaj, aż aplikacja je zrobi (narzędzie stan_eksportu).');
  end if;
  if (select count(*) from public.zlecenia_eksportu z where z.wlasciciel = v_konto and z.utworzono > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('blad', 'Za dużo eksportów w ciągu godziny – spróbuj później.');
  end if;
  insert into public.zlecenia_eksportu (wlasciciel, projekt_id, rodzaj, ustawienia, podpis)
    values (v_konto, (d->>'projekt_id')::uuid, p_rodzaj, coalesce(p_ustawienia, '{}'::jsonb), left(coalesce(nullif(btrim(d->>'opis'), ''), 'AI'), 120))
    returning * into v_z;
  return public._eksport_json(v_z);
end;
$$;

-- Stan zlecenia (łącznik czeka na plik albo AI sprawdza później). Gotowy plik: sekret do linku pobierania.
-- Klucz bez liczenia zapytań – łącznik pyta co 1–2 s, a to nie jest praca na projekcie.
create or replace function public.ai_stan_eksportu(p_klucz text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := public.ai_klucz(p_klucz, false);
  v_z public.zlecenia_eksportu;
begin
  if d ? 'blad' then return d; end if;
  select * into v_z from public.zlecenia_eksportu z where z.id = p_id and z.wlasciciel = (d->>'owner_id')::uuid;
  if v_z.id is null then return jsonb_build_object('blad', 'Nie ma takiego zlecenia eksportu (albo wygasło po 7 dniach).'); end if;
  return public._eksport_json(v_z) || case when v_z.stan = 'gotowe' and v_z.wygasa > now()
    then jsonb_build_object('sekret', v_z.sekret) else '{}'::jsonb end;
end;
$$;

revoke all on function public.ai_zlec_eksport(text, text, jsonb), public.ai_stan_eksportu(text, uuid) from public;
grant execute on function public.ai_zlec_eksport(text, text, jsonb), public.ai_stan_eksportu(text, uuid) to anon, authenticated;

-- ---------- Aplikacja (zalogowane konto) ----------

-- Zlecenia czekające na to konto (karta, która właśnie się otworzyła albo wróciła do sieci).
create or replace function public.eksporty_czekajace()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public._eksport_json(z) order by z.utworzono), '[]'::jsonb)
    from public.zlecenia_eksportu z
   where z.wlasciciel = auth.uid() and z.wygasa > now()
     and (z.stan = 'czeka' or (z.stan = 'w_toku' and z.przyjeto < now() - interval '5 minutes'));
$$;

-- Jedno zlecenie konta (link #/p/<projekt>/eksport/<zlecenie>).
create or replace function public.zlecenie_eksportu(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public._eksport_json(z) from public.zlecenia_eksportu z where z.id = p_id and z.wlasciciel = auth.uid();
$$;

-- Przyjęcie zlecenia przez kartę: tylko jedna wygrywa (UPDATE … WHERE stan = 'czeka'). Zlecenie porzucone
-- (karta zamknięta w trakcie, ponad 5 minut) może przejąć inna. Zwraca zlecenie albo null.
create or replace function public.przyjmij_eksport(p_id uuid, p_karta text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_z public.zlecenia_eksportu;
begin
  if auth.uid() is null then raise exception 'Brak sesji' using errcode = '42501'; end if;
  update public.zlecenia_eksportu z
     set stan = 'w_toku', karta = left(p_karta, 80), przyjeto = now(), zmieniono = now(), blad = null
   where z.id = p_id and z.wlasciciel = auth.uid() and z.wygasa > now()
     and (z.stan = 'czeka' or (z.stan = 'w_toku' and z.przyjeto < now() - interval '5 minutes')
          or (z.stan = 'blad' and z.karta is not distinct from left(p_karta, 80)))
  returning * into v_z;
  if v_z.id is null then return null; end if;
  return public._eksport_json(v_z);
end;
$$;

-- Wynik: plik w folderze konta („<konto>/_eksporty/…”) albo błąd. Tylko karta, która przyjęła zlecenie.
create or replace function public.zakoncz_eksport(p_id uuid, p_karta text, p_plik text, p_nazwa text, p_typ text,
  p_rozmiar bigint, p_strony integer, p_uwagi jsonb, p_blad text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_z public.zlecenia_eksportu;
begin
  if auth.uid() is null then raise exception 'Brak sesji' using errcode = '42501'; end if;
  if p_blad is null and (p_plik is null or p_plik not like auth.uid()::text || '/_eksporty/%') then
    raise exception 'Plik eksportu musi leżeć w folderze _eksporty konta';
  end if;
  update public.zlecenia_eksportu z
     set stan = case when p_blad is null then 'gotowe' else 'blad' end,
         plik = case when p_blad is null then p_plik end,
         nazwa = left(p_nazwa, 200), typ = left(p_typ, 100), rozmiar = p_rozmiar, strony = p_strony,
         uwagi = case when jsonb_typeof(p_uwagi) = 'array' then (select coalesce(jsonb_agg(u), '[]'::jsonb) from (select u from jsonb_array_elements(p_uwagi) u limit 40) x) else '[]'::jsonb end,
         blad = left(p_blad, 1000), zmieniono = now()
   where z.id = p_id and z.wlasciciel = auth.uid() and z.stan = 'w_toku' and z.karta = left(p_karta, 80)
  returning * into v_z;
  if v_z.id is null then raise exception 'To zlecenie przyjęła inna karta albo już je zakończono'; end if;
  return public._eksport_json(v_z);
end;
$$;

-- Sprzątanie: zlecenia konta po terminie (pliki do usunięcia z magazynu) i usunięcie ich wierszy.
create or replace function public.wygasle_eksporty()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'plik', z.plik)), '[]'::jsonb)
    from public.zlecenia_eksportu z where z.wlasciciel = auth.uid() and z.wygasa <= now();
$$;

create or replace function public.usun_eksporty(p_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.zlecenia_eksportu z where z.wlasciciel = auth.uid() and z.id = any (coalesce(p_ids, '{}'));
$$;

revoke all on function public.eksporty_czekajace(), public.zlecenie_eksportu(uuid), public.przyjmij_eksport(uuid, text),
  public.zakoncz_eksport(uuid, text, text, text, text, bigint, integer, jsonb, text), public.wygasle_eksporty(),
  public.usun_eksporty(uuid[]) from public, anon;
grant execute on function public.eksporty_czekajace(), public.zlecenie_eksportu(uuid), public.przyjmij_eksport(uuid, text),
  public.zakoncz_eksport(uuid, text, text, text, text, bigint, integer, jsonb, text), public.wygasle_eksporty(),
  public.usun_eksporty(uuid[]) to authenticated;

-- ---------- Przekaźnik plików (link pobierania) ----------

-- Link https://api.makietka.app/eksport/<id>/<sekret>/<nazwa>: przekaźnik pyta tę funkcję kluczem publicznym.
-- Zwraca { plik, nazwa, typ } dla gotowego, ważnego zlecenia ze zgodnym sekretem, inaczej null.
create or replace function public.eksport_do_pobrania(p_id uuid, p_sekret text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('plik', z.plik, 'nazwa', z.nazwa, 'typ', z.typ)
    from public.zlecenia_eksportu z
   where z.id = p_id and z.stan = 'gotowe' and z.wygasa > now() and z.plik is not null
     and length(coalesce(p_sekret, '')) >= 32 and z.sekret = p_sekret;
$$;
revoke all on function public.eksport_do_pobrania(uuid, text) from public;
grant execute on function public.eksport_do_pobrania(uuid, text) to anon, authenticated;
