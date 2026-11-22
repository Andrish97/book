-- Zadania dla otwartej Makietki zlecane przez łącznik AI (plan H1, H2, H4): ta sama kolejka co eksport PDF/PNG
-- (20261117110000_zlecenia_eksportu.sql), nowe rodzaje:
--   * 'link'  – link do podglądu projektu (H4; ustawienia: haslo, wazny_do); wynik: { adres, haslo, wazny_do };
--   * 'obraz' – obraz z opisu kluczem Gemini użytkownika, wstawiony do ramki albo na stronę (H1);
--   * 'kadry' – obrazy do kadrów strony komiksu ze scenariusza i kart (H2);
--   * 'dymki' – dymki z tabeli scenariusza na stronach komiksu (H2).
-- Robi je tylko aplikacja (klucz Gemini zna tylko przeglądarka; link rysuje aplikacja), więc serwer ich nie przejmuje.
-- Zadania zmieniają projekt – klucz musi czytać i zmieniać. Wynik bez pliku: kolumna wynik (zakoncz_zadanie).

alter table public.zlecenia_eksportu drop constraint if exists zlecenia_eksportu_rodzaj_check;
alter table public.zlecenia_eksportu add constraint zlecenia_eksportu_rodzaj_check
  check (rodzaj in ('pdf', 'png', 'link', 'obraz', 'kadry', 'dymki'));
alter table public.zlecenia_eksportu add column if not exists wynik jsonb not null default '{}'
  check (jsonb_typeof(wynik) = 'object' and pg_column_size(wynik) <= 8000);

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
    'wygasa', z.wygasa, 'wynik', z.wynik);
$$;
revoke all on function public._eksport_json(public.zlecenia_eksportu) from public, anon, authenticated;

-- Łącznik: nowe zadanie. Te same limity co eksport (5 w kolejce, 30 na godzinę na konto).
create or replace function public.ai_zlec_zadanie(p_klucz text, p_rodzaj text, p_ustawienia jsonb default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := public.ai_sprawdz_klucz(p_klucz, true);
  b jsonb;
  v_konto uuid;
  v_z public.zlecenia_eksportu;
begin
  if d ? 'blad' then return d; end if;
  v_konto := (d->>'owner_id')::uuid;
  if coalesce(p_rodzaj, '') not in ('link', 'obraz', 'kadry', 'dymki') then
    return jsonb_build_object('blad', 'Rodzaj zadania: link, obraz, kadry albo dymki.');
  end if;
  -- Przełączniki klucza (20261118230000_zakresy_kluczy_ai.sql): obrazy i kadry – „obrazy”, link – „eksport”; dymki to zwykłe elementy.
  if p_rodzaj <> 'dymki' then
    b := public.ai_zakres_brak(p_klucz, case p_rodzaj when 'link' then 'eksport' else 'obrazy' end);
    if b is not null then return b; end if;
  end if;
  if p_ustawienia is not null and jsonb_typeof(p_ustawienia) <> 'object' then
    return jsonb_build_object('blad', 'Ustawienia zadania to obiekt JSON.');
  end if;
  if pg_column_size(coalesce(p_ustawienia, '{}'::jsonb)) > 4000 then
    return jsonb_build_object('blad', 'Za długie ustawienia zadania.');
  end if;
  if (select count(*) from public.zlecenia_eksportu z where z.wlasciciel = v_konto and z.stan in ('czeka', 'w_toku') and z.wygasa > now()) >= 5 then
    return jsonb_build_object('blad', 'W kolejce czeka już 5 zadań – poczekaj, aż aplikacja je zrobi (narzędzie stan_eksportu).');
  end if;
  if (select count(*) from public.zlecenia_eksportu z where z.wlasciciel = v_konto and z.utworzono > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('blad', 'Za dużo zadań w ciągu godziny – spróbuj później.');
  end if;
  insert into public.zlecenia_eksportu (wlasciciel, projekt_id, rodzaj, ustawienia, podpis)
    values (v_konto, (d->>'projekt_id')::uuid, p_rodzaj, coalesce(p_ustawienia, '{}'::jsonb), left(coalesce(nullif(btrim(d->>'opis'), ''), 'AI'), 120))
    returning * into v_z;
  return public._eksport_json(v_z);
end;
$$;
revoke all on function public.ai_zlec_zadanie(text, text, jsonb) from public;
grant execute on function public.ai_zlec_zadanie(text, text, jsonb) to anon, authenticated;

-- Aplikacja: wynik zadania bez pliku (albo błąd). Tylko karta, która przyjęła zadanie.
create or replace function public.zakoncz_zadanie(p_id uuid, p_karta text, p_wynik jsonb, p_blad text)
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
     set stan = case when p_blad is null then 'gotowe' else 'blad' end,
         wynik = case when jsonb_typeof(p_wynik) = 'object' and pg_column_size(p_wynik) <= 8000 then p_wynik else '{}'::jsonb end,
         blad = left(p_blad, 1000), zmieniono = now()
   where z.id = p_id and z.wlasciciel = auth.uid() and z.stan = 'w_toku' and z.karta = left(p_karta, 80)
     and z.rodzaj in ('link', 'obraz', 'kadry', 'dymki')
  returning * into v_z;
  if v_z.id is null then raise exception 'To zadanie przyjęła inna karta albo już je zakończono'; end if;
  return public._eksport_json(v_z);
end;
$$;
revoke all on function public.zakoncz_zadanie(uuid, text, jsonb, text) from public, anon;
grant execute on function public.zakoncz_zadanie(uuid, text, jsonb, text) to authenticated;

-- Serwer (#337) przejmuje tylko pliki PDF i PNG.
create or replace function public.serwer_przyjmij_eksporty(p_po_sekundach integer default 20, p_ile integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wynik jsonb;
begin
  with do_przyjecia as (
    select z.id from public.zlecenia_eksportu z
     where z.wygasa > now() and z.rodzaj in ('pdf', 'png')
       and ((z.stan = 'czeka' and z.utworzono < now() - make_interval(secs => greatest(0, p_po_sekundach)))
         or (z.stan = 'w_toku' and z.karta = 'serwer' and z.przyjeto < now() - interval '15 minutes'))
     order by z.utworzono
     limit greatest(1, least(coalesce(p_ile, 3), 10))
     for update skip locked
  ), przyjete as (
    update public.zlecenia_eksportu z
       set stan = 'w_toku', karta = 'serwer', przyjeto = now(), zmieniono = now(), blad = null
      from do_przyjecia d
     where z.id = d.id
    returning z.id, z.projekt_id, z.wlasciciel, z.rodzaj, z.ustawienia
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'projekt_id', p.projekt_id, 'wlasciciel', p.wlasciciel, 'rodzaj', p.rodzaj, 'ustawienia', p.ustawienia)), '[]'::jsonb)
    into v_wynik from przyjete p;
  return v_wynik;
end;
$$;
