-- Migracja: ZeptoMail (Zoho) jako drugi dostawca poczty za Brevo (decyzja #105).
--
-- Kolejność: Brevo (priorytet 1) → ZeptoMail (priorytet 2, wyłączony; włącza się przełącznikiem w panelu).
-- Przełączanie na ZeptoMail przy błędzie Brevo działa tylko, gdy jest włączony.
--
-- Użytkownik: Brevo ciągle blokuje wysyłkę z nieznanych adresów IP (funkcje Supabase wysyłają z różnych adresów),
-- a przełącznika nie ma; „Mam Zoho dla Familiady, mogę tam dodać też Makietkę…”. Funkcja poczta próbuje
-- dostawców po kolei (priorytet z tej tabeli); kto odmówi – następny. Dzienny limit liczy się dopiero po udanej
-- wysyłce, u dostawcy, który ją wysłał.

alter table public.poczta_dostawcy drop constraint if exists poczta_dostawcy_typ_check;
alter table public.poczta_dostawcy add constraint poczta_dostawcy_typ_check check (typ in ('brevo', 'zeptomail'));
insert into public.poczta_dostawcy (id, nazwa, typ, priorytet, dzienny_limit, aktywny)
  values ('zeptomail', 'ZeptoMail (Zoho)', 'zeptomail', 2, 1000, false) on conflict (id) do nothing;

-- Włączeni dostawcy w kolejności priorytetu: [{ id, typ, zostalo }] (zostalo – z dziennego limitu na dziś).
create or replace function public.poczta_dostawcy_kolejnosc()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.poczta_dostawcy set dzien = current_date, wyslane_dzis = 0 where dzien <> current_date;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'typ', d.typ, 'zostalo', greatest(d.dzienny_limit - d.wyslane_dzis, 0))
                     order by d.priorytet, d.id)
                     from public.poczta_dostawcy d where d.aktywny), '[]'::jsonb);
end;
$$;
revoke all on function public.poczta_dostawcy_kolejnosc() from public, anon, authenticated;
grant execute on function public.poczta_dostawcy_kolejnosc() to service_role;

-- Udana wysyłka poza kolejką (maile logowania przez hak Auth) – liczy się do dziennego limitu dostawcy.
create or replace function public.poczta_dostawca_wyslano(p_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.poczta_dostawcy
     set wyslane_dzis = case when dzien = current_date then wyslane_dzis + 1 else 1 end, dzien = current_date
   where id = p_id;
$$;
revoke all on function public.poczta_dostawca_wyslano(text) from public, anon, authenticated;
grant execute on function public.poczta_dostawca_wyslano(text) to service_role;

create or replace function public.poczta_kolejka_pobierz(p_limit int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.poczta_ustawienia%rowtype;
  v_dostawcy jsonb;
  v_zostalo int;
  v_limit int;
  v_wynik jsonb := '[]';
  r record;
  v_ostatni timestamptz;
  v_odstep int;
  v_adresy text[] := '{}';
begin
  select * into u from public.poczta_ustawienia where id = 1;
  -- Porządki: zawieszone wysyłki wracają, stare zdarzenia i wysłane maile znikają.
  update public.poczta_kolejka set stan = 'czeka' where stan = 'wysylanie' and nastepna_proba < now() - interval '10 minutes';
  delete from public.poczta_zdarzenia where czas < now() - interval '2 days';
  delete from public.poczta_kolejka where stan in ('wyslany', 'anulowany') and utworzono < now() - interval '60 days';

  -- Wszyscy włączeni dostawcy w kolejności priorytetu, z tym, co zostało z dziennego limitu (#105):
  -- funkcja poczta próbuje ich po kolei i zapisuje, kto naprawdę wysłał (poczta_kolejka_wynik).
  v_dostawcy := public.poczta_dostawcy_kolejnosc();
  if jsonb_array_length(v_dostawcy) = 0 then
    return jsonb_build_object('wiadomosci', '[]'::jsonb, 'powod', 'brak-dostawcy', 'dostawcy', v_dostawcy);
  end if;
  select coalesce(sum((x->>'zostalo')::int), 0) into v_zostalo from jsonb_array_elements(v_dostawcy) x;
  v_limit := least(coalesce(p_limit, u.limit_przebiegu), u.limit_przebiegu, v_zostalo);
  if v_limit <= 0 then
    return jsonb_build_object('wiadomosci', '[]'::jsonb, 'powod', 'limit-dzienny', 'dostawcy', v_dostawcy);
  end if;
  select coalesce(o.sekundy, 0) into v_odstep from public.poczta_odstepy o where o.akcja = 'baza:adresat' and o.wlaczone;
  for r in
    select * from public.poczta_kolejka where stan = 'czeka' and nastepna_proba <= now()
      order by priorytet, nastepna_proba, utworzono for update skip locked limit v_limit * 3
  loop
    exit when jsonb_array_length(v_wynik) >= v_limit;
    -- Bazowy odstęp na adresata: kolejny mail do tego samego adresu najwcześniej po N sekundach.
    if coalesce(v_odstep, 0) > 0 then
      if lower(r.do_email) = any (v_adresy) then
        update public.poczta_kolejka set nastepna_proba = now() + make_interval(secs => v_odstep) where id = r.id;
        continue;
      end if;
      select max(case when k.stan = 'wysylanie' then k.nastepna_proba else k.wyslano end) into v_ostatni from public.poczta_kolejka k
        where lower(k.do_email) = lower(r.do_email) and (k.wyslano is not null or k.stan = 'wysylanie');
      if v_ostatni is not null and v_ostatni > now() - make_interval(secs => v_odstep) then
        update public.poczta_kolejka set nastepna_proba = v_ostatni + make_interval(secs => v_odstep) where id = r.id;
        continue;
      end if;
      v_adresy := v_adresy || lower(r.do_email);
    end if;
    update public.poczta_kolejka set stan = 'wysylanie', proby = proby + 1, dostawca = null, nastepna_proba = now() where id = r.id;
    v_wynik := v_wynik || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'rodzaj', r.rodzaj, 'do_email', r.do_email, 'do_nazwa', r.do_nazwa, 'szablon', r.szablon, 'dane', r.dane,
      'temat', r.temat, 'odpowiedz_do', r.odpowiedz_do, 'naglowki', r.naglowki, 'od_skrzynki', r.od_skrzynki));
  end loop;
  return jsonb_build_object(
    'wiadomosci', v_wynik, 'dostawcy', v_dostawcy, 'odstep_ms', u.odstep_ms,
    'nadawca', jsonb_build_object('email', u.nadawca_email, 'name', u.nadawca_nazwa),
    'skrzynka', jsonb_build_object('email', u.skrzynka_email, 'name', u.nadawca_nazwa));
end;
$$;
revoke all on function public.poczta_kolejka_pobierz(int) from public, anon, authenticated;
grant execute on function public.poczta_kolejka_pobierz(int) to service_role;


-- Wynik wysyłki z dostawcą, który ją wysłał. Błąd: ponowienie po 1, 5, 15, 60 min…, po maks_prob – stan „blad”.
drop function if exists public.poczta_kolejka_wynik(uuid, boolean, text, text);
create or replace function public.poczta_kolejka_wynik(p_id uuid, p_ok boolean, p_blad text default null, p_message_id text default null, p_dostawca text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.poczta_kolejka%rowtype;
  v_maks int := (select maks_prob from public.poczta_ustawienia where id = 1);
begin
  select * into k from public.poczta_kolejka where id = p_id for update;
  if not found then
    return;
  end if;
  if p_ok then
    update public.poczta_kolejka set stan = 'wyslany', wyslano = now(), blad = null, message_id = left(p_message_id, 500), dostawca = p_dostawca where id = p_id;
    if p_dostawca is not null then
      perform public.poczta_dostawca_wyslano(p_dostawca);
    end if;
    if k.rodzaj = 'odpowiedz' and k.dane ? 'wiadomosc' then
      update public.poczta_wiadomosci set message_id = left(p_message_id, 500) where id = (k.dane->>'wiadomosc')::uuid and message_id is null;
    end if;
  else
    update public.poczta_kolejka set
      stan = case when k.proby >= v_maks then 'blad' else 'czeka' end,
      blad = left(p_blad, 1000),
      nastepna_proba = now() + (array[interval '1 minute', interval '5 minutes', interval '15 minutes', interval '60 minutes'])[least(k.proby, 4)]
      where id = p_id;
  end if;
end;
$$;
revoke all on function public.poczta_kolejka_wynik(uuid, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.poczta_kolejka_wynik(uuid, boolean, text, text, text) to service_role;

-- Test wysyłki z panelu – opcjonalnie przez jednego dostawcę (dane.dostawca).
drop function if exists public.admin_poczta_test(text);
create or replace function public.admin_poczta_test(p_do text, p_dostawca text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  perform public.wymagaj_administratora();
  if coalesce(p_do, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Nieprawidłowy adres';
  end if;
  if p_dostawca is not null and not exists (select 1 from public.poczta_dostawcy d where d.id = p_dostawca) then
    raise exception 'Nieznany dostawca';
  end if;
  insert into public.poczta_kolejka (rodzaj, do_email, szablon, dane, priorytet, utworzyl)
    values ('test', lower(btrim(p_do)), 'test',
            jsonb_build_object('kiedy', now()) || case when p_dostawca is null then '{}'::jsonb else jsonb_build_object('dostawca', p_dostawca) end,
            1, auth.uid()) returning id into v;
  return jsonb_build_object('ok', true, 'id', v);
end;
$$;
revoke all on function public.admin_poczta_test(text, text) from public, anon;
grant execute on function public.admin_poczta_test(text, text) to authenticated;

-- Kolejka w panelu: przy dostawcach także liczba wysłanych w 30 dni (statystyka „kto wysyła”).
create or replace function public.admin_kolejka(p_stan text default null, p_limit int default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.wymagaj_administratora();
  return jsonb_build_object(
    'maile', coalesce((select jsonb_agg(x order by x.utworzono desc) from (
      select k.id, k.rodzaj, k.do_email, coalesce(k.temat, k.dane->>'temat', k.dane->>'projekt') as temat, k.stan, k.proby, k.nastepna_proba,
             k.blad, k.utworzono, k.wyslano, k.dostawca
        from public.poczta_kolejka k where p_stan is null or k.stan = p_stan
        order by k.utworzono desc limit least(greatest(p_limit, 1), 500)) x), '[]'),
    'liczniki', (select jsonb_object_agg(s, n) from (
      select s, (select count(*) from public.poczta_kolejka k where k.stan = s) n
        from unnest(array['czeka', 'wysylanie', 'wyslany', 'blad', 'anulowany']) s) c),
    'dostawcy', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'nazwa', d.nazwa, 'dzienny_limit', d.dzienny_limit,
      'wyslane_dzis', case when d.dzien = current_date then d.wyslane_dzis else 0 end, 'aktywny', d.aktywny,
      'wyslane_30', (select count(*) from public.poczta_kolejka k where k.dostawca = d.id and k.wyslano > now() - interval '30 days'))
      order by d.priorytet), '[]')
      from public.poczta_dostawcy d));
end;
$$;
