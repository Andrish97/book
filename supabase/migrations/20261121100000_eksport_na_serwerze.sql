-- Eksport zlecony przez AI na serwerze (#337): gdy żadna otwarta karta konta nie przyjęła zlecenia w ciągu
-- 20 sekund, przejmuje je worker (cloudflare/rysowanie.js, co minutę) i robi plik w przeglądarce Cloudflare
-- tym samym kodem co aplikacja. Funkcje tylko dla klucza serwisowego (service_role) – niedostępne dla kont.

-- Przejęcie zaległych zleceń (najwyżej p_ile naraz): czekające dłużej niż p_po_sekundach i dawne przejęcia
-- serwera, które utknęły (ponad 15 minut). Zwraca [{ id, projekt_id, wlasciciel, rodzaj, ustawienia }].
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
     where z.wygasa > now()
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

-- Projekt do eksportu: dane z tabeli projekty, a strony zapisane osobno (projekty_strony) – wstawione w kolejności.
create or replace function public.serwer_projekt(p_projekt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dane jsonb;
begin
  select p.dane into v_dane from public.projekty p where p.id = p_projekt;
  if v_dane is null then return null; end if;
  if coalesce((v_dane ->> 'strony_osobno')::boolean, false) then
    v_dane := jsonb_set(v_dane - 'strony_osobno', '{strony}', coalesce((
      select jsonb_agg(s.dane order by o.nr)
        from jsonb_array_elements_text(v_dane -> 'strony') with ordinality as o(id, nr)
        join public.projekty_strony s on s.projekt_id = p_projekt and s.strona_id = o.id), '[]'::jsonb));
  end if;
  return v_dane;
end;
$$;

-- Wynik eksportu na serwerze: plik w folderze _eksporty właściciela zlecenia albo błąd.
create or replace function public.serwer_zakoncz_eksport(p_id uuid, p_plik text, p_nazwa text, p_typ text,
  p_rozmiar bigint, p_strony integer, p_uwagi jsonb, p_blad text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_z public.zlecenia_eksportu;
begin
  select * into v_z from public.zlecenia_eksportu z where z.id = p_id and z.stan = 'w_toku' and z.karta = 'serwer' for update;
  if v_z.id is null then raise exception 'Zlecenia nie przejął serwer albo już je zakończono'; end if;
  if p_blad is null and (p_plik is null or p_plik not like v_z.wlasciciel::text || '/_eksporty/%') then
    raise exception 'Plik eksportu musi leżeć w folderze _eksporty właściciela';
  end if;
  update public.zlecenia_eksportu z
     set stan = case when p_blad is null then 'gotowe' else 'blad' end,
         plik = case when p_blad is null then p_plik end,
         nazwa = left(p_nazwa, 200), typ = left(p_typ, 100), rozmiar = p_rozmiar, strony = p_strony,
         uwagi = case when jsonb_typeof(p_uwagi) = 'array' then (select coalesce(jsonb_agg(u), '[]'::jsonb) from (select u from jsonb_array_elements(p_uwagi) u limit 40) x) else '[]'::jsonb end,
         blad = left(p_blad, 1000), zmieniono = now()
   where z.id = p_id
  returning * into v_z;
  return public._eksport_json(v_z);
end;
$$;

revoke all on function public.serwer_przyjmij_eksporty(integer, integer), public.serwer_projekt(uuid),
  public.serwer_zakoncz_eksport(uuid, text, text, text, bigint, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.serwer_przyjmij_eksporty(integer, integer), public.serwer_projekt(uuid),
  public.serwer_zakoncz_eksport(uuid, text, text, text, bigint, integer, jsonb, text) to service_role;
