-- Element z Biblioteki wstawiany przez łącznik AI (plan H7): nowy rodzaj zadania dla otwartej Makietki 'biblioteka'
-- (ustawienia: kategoria, element, gdzie, x, y). Katalog zna sam łącznik (KATALOG_BIBLIOTEKI w rdzeniu);
-- wstawia edytor, jak kliknięcie w oknie Biblioteki. Bez przełącznika klucza – to zwykłe elementy strony.

alter table public.zlecenia_eksportu drop constraint if exists zlecenia_eksportu_rodzaj_check;
alter table public.zlecenia_eksportu add constraint zlecenia_eksportu_rodzaj_check
  check (rodzaj in ('pdf', 'png', 'link', 'obraz', 'kadry', 'dymki', 'biblioteka'));

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
  if coalesce(p_rodzaj, '') not in ('link', 'obraz', 'kadry', 'dymki', 'biblioteka') then
    return jsonb_build_object('blad', 'Rodzaj zadania: link, obraz, kadry, dymki albo biblioteka.');
  end if;
  -- Przełączniki klucza (20261118230000_zakresy_kluczy_ai.sql): obrazy i kadry – „obrazy”, link – „eksport”; dymki to zwykłe elementy.
  if p_rodzaj not in ('dymki', 'biblioteka') then
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
     and z.rodzaj in ('link', 'obraz', 'kadry', 'dymki', 'biblioteka')
  returning * into v_z;
  if v_z.id is null then raise exception 'To zadanie przyjęła inna karta albo już je zakończono'; end if;
  return public._eksport_json(v_z);
end;
$$;
revoke all on function public.zakoncz_zadanie(uuid, text, jsonb, text) from public, anon;
grant execute on function public.zakoncz_zadanie(uuid, text, jsonb, text) to authenticated;
