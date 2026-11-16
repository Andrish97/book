-- Komentarze: usunięcie widać u innych od razu (decyzja #172).
--
-- Supabase Realtime nie przesyła usunięć (DELETE) kanałem z filtrem (projekt_id=eq.…), więc usunięty wątek znikał
-- u innych osób dopiero przy następnej zmianie. Teraz usunięcie to zmiana wiersza (UPDATE): komentarz dostaje
-- `usunieto`, traci treść i wzmianki (zostaje tylko ślad „usunięty”), a ta zmiana rozchodzi się kanałem jak każda
-- inna. Wszystkie odczyty pomijają usunięte. Usunięcie wątku usuwa też jego odpowiedzi.

alter table public.komentarze add column if not exists usunieto timestamptz;
create index if not exists komentarze_aktywne on public.komentarze (projekt_id, utworzono) where usunieto is null;

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
            from public.komentarze k where k.projekt_id = p_projekt and k.usunieto is null);
end;
$$;

-- Odpowiedź do usuniętego wątku – błąd (ktoś usunął wątek, zanim druga osoba wysłała odpowiedź).
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
    select coalesce(k.watek, k.id) into v_watek from public.komentarze k
     where k.id = p_watek and k.projekt_id = p_projekt and k.usunieto is null;
    if v_watek is null then raise exception 'Ten wątek został usunięty albo nie ma go w tym projekcie'; end if;
    select k.strona_id into v_strona from public.komentarze k where k.id = v_watek and k.usunieto is null;
    if not found then raise exception 'Ten wątek został usunięty'; end if;
  elsif v_strona is null then
    raise exception 'Komentarz musi wskazywać stronę';
  end if;
  insert into public.komentarze (projekt_id, watek, autor, zrodlo, podpis, strona_id, element_id, x, y, tresc, wzmianki)
    values (p_projekt, v_watek, p_autor, p_zrodlo, left(p_podpis, 80), v_strona,
            case when v_watek is null then nullif(left(btrim(coalesce(p_element, '')), 100), '') end,
            case when v_watek is null then p_x end, case when v_watek is null then p_y end,
            left(btrim(p_tresc), 4000), public._wzmianki_komentarza(p_projekt, p_tresc))
    returning * into v_k;
  return public._komentarz_json(v_k);
end;
$$;
revoke all on function public._dodaj_komentarz(uuid, uuid, text, text, text, text, real, real, text, uuid) from public, anon, authenticated;

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
   where k.id = p_id and k.usunieto is null and k.autor = auth.uid() and k.zrodlo = 'konto'
     and public.rola_w_projekcie(k.projekt_id) is not null
  returning * into v_k;
  if v_k.id is null then raise exception 'Zmienić możesz tylko własny komentarz' using errcode = '42501'; end if;
  return public._komentarz_json(v_k);
end;
$$;

-- Usunięcie: ślad zamiast skasowania wiersza (zmiana idzie kanałem na żywo). Wątek – razem z odpowiedziami.
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
  if v_k.id is null or v_k.usunieto is not null then return; end if;
  if not ((v_k.autor = auth.uid() and v_k.zrodlo = 'konto' and public.rola_w_projekcie(v_k.projekt_id) is not null)
          or public.rola_w_projekcie(v_k.projekt_id) = 'wlasciciel') then
    raise exception 'Usunąć możesz własny komentarz (albo każdy – jako właściciel projektu)' using errcode = '42501';
  end if;
  update public.komentarze k
     set usunieto = now(), tresc = '–', wzmianki = '{}', podpis = null, zmieniono = now()
   where k.usunieto is null and (k.id = p_id or (v_k.watek is null and k.watek = p_id));
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
   where k.id = p_id and k.watek is null and k.usunieto is null and public.rola_w_projekcie(k.projekt_id) is not null
  returning * into v_k;
  if v_k.id is null then raise exception 'Nie ma takiego wątku albo nie masz do niego dostępu' using errcode = '42501'; end if;
  return public._komentarz_json(v_k);
end;
$$;

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
       from public.komentarze k where k.projekt_id = (d->>'projekt_id')::uuid and k.usunieto is null));
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
   where k.id = p_id and k.watek is null and k.usunieto is null and k.projekt_id = (d->>'projekt_id')::uuid
  returning * into v_k;
  if v_k.id is null then return jsonb_build_object('blad', 'Nie ma takiego wątku w tym projekcie.'); end if;
  return public._komentarz_json(v_k);
end;
$$;

-- Ślad usuniętego komentarza w kanale na żywo: aplikacja po zmianie i tak czyta listę od nowa
-- (komentarze_projektu) – usunięty po prostu w niej nie występuje.
