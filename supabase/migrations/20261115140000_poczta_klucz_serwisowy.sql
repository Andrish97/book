-- Migracja: bez „klucza skrzynki” – Worker wpisuje pocztę przychodzącą i formularz kontaktowy kluczem serwisowym (decyzja #106).
--
-- Użytkownik: „po co go generować, jeżeli ustawiamy go tylko raz? Zróbmy to raz, bez dodatkowych zbędnych rzeczy”.
-- Worker ma jeden sekret SUPABASE_SERVICE_ROLE_KEY (secret key z Supabase); poczta_przyjmij i kontakt_przyjmij
-- może wołać tylko rola service_role. Generowanie klucza w panelu, jego skrót w ustawieniach i sprawdzanie znikają.

drop function if exists public.admin_klucz_skrzynki();
drop function if exists public.poczta_przyjmij(text, jsonb);
drop function if exists public.kontakt_przyjmij(text, text, text, text, text);
drop function if exists public.poczta_klucz_ok(text);
alter table public.poczta_ustawienia drop column if exists klucz_skrzynki_skrot;
alter table public.poczta_ustawienia drop column if exists klucz_skrzynki_od;

-- Poczta przychodząca z Workera. p jsonb: { od_email, od_nazwa, do_email, temat, tekst, html, message_id, in_reply_to,
-- referencje: [], zalaczniki: [{ nazwa, typ, rozmiar, klucz? }], spam: bool }.
create or replace function public.poczta_przyjmij(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_od text := lower(btrim(coalesce(p->>'od_email', '')));
  v_watek uuid;
  v_wiad uuid;
  v_czekaj int;
  v_spam boolean := coalesce((p->>'spam')::boolean, false);
  v_ref text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'referencje', '[]')) x), '{}');
begin
  if v_od !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('blad', 'zly-nadawca');
  end if;
  if exists (select 1 from public.poczta_wiadomosci w where w.message_id = p->>'message_id' and p->>'message_id' is not null) then
    return jsonb_build_object('ok', true, 'powtorka', true);
  end if;
  v_czekaj := greatest(public.poczta_odstep('przychodzaca:wszystkie', '*'), public.poczta_odstep('przychodzaca:nadawca', v_od));
  if v_czekaj > 0 then
    return jsonb_build_object('blad', 'za-czesto', 'za_sekund', v_czekaj);
  end if;
  v_watek := public.poczta_watek_dla(v_od, p->>'temat', p->>'in_reply_to', v_ref);
  if v_watek is null then
    insert into public.poczta_watki (temat, od_email, od_nazwa, zrodlo, folder)
      values (coalesce(nullif(left(btrim(p->>'temat'), 300), ''), '(bez tematu)'), v_od, left(p->>'od_nazwa', 200), 'mail',
              case when v_spam then 'spam' else 'skrzynka' end)
      returning id into v_watek;
  end if;
  insert into public.poczta_wiadomosci (watek, kierunek, od_email, od_nazwa, do_email, temat, tekst, html, message_id, in_reply_to, referencje, zalaczniki, spam)
    values (v_watek, 'przychodzaca', v_od, left(p->>'od_nazwa', 200), left(p->>'do_email', 320), left(p->>'temat', 300),
            left(p->>'tekst', 200000), left(p->>'html', 400000), left(p->>'message_id', 500), left(p->>'in_reply_to', 500), v_ref,
            coalesce(p->'zalaczniki', '[]'), v_spam)
    returning id into v_wiad;
  update public.poczta_watki set liczba = liczba + 1, ostatnia = now(), przeczytany = false,
    folder = case when folder in ('archiwum', 'kosz') and not v_spam then 'skrzynka' else folder end
    where id = v_watek;
  return jsonb_build_object('ok', true, 'watek', v_watek, 'wiadomosc', v_wiad);
end;
$$;
revoke all on function public.poczta_przyjmij(jsonb) from public, anon, authenticated;
grant execute on function public.poczta_przyjmij(jsonb) to service_role;

-- Formularz kontaktowy (przez Worker – IP i Turnstile sprawdza on). p_ip – skrót adresu IP (nie sam adres).
-- p_uzytkownik – konto zalogowanego nadawcy (Worker sprawdza jego token w Supabase Auth), gość – null.
-- Wiadomość trafia do skrzynki jako wątek, bez maila do nadawcy (#95h).
create or replace function public.kontakt_przyjmij(p_ip text, p_email text, p_temat text, p_tresc text, p_uzytkownik uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_temat text := left(btrim(coalesce(p_temat, '')), 200);
  v_tresc text := left(btrim(coalesce(p_tresc, '')), 5000);
  v_czekaj int;
  v_watek uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('blad', 'zly-email');
  end if;
  if length(v_tresc) < 10 then
    return jsonb_build_object('blad', 'za-krotka');
  end if;
  -- Najpierw sprawdzenie bez liczenia, potem liczenie wszystkich trzech naraz (odmowa nie zjada limitu).
  v_czekaj := greatest(public.poczta_odstep('kontakt:wszystkie', '*', false), public.poczta_odstep('kontakt:ip', coalesce(p_ip, '?'), false),
                       public.poczta_odstep('kontakt:email', v_email, false));
  if v_czekaj > 0 then
    return jsonb_build_object('blad', 'za-czesto', 'za_sekund', v_czekaj, 'za', public.poczta_za_ile(v_czekaj));
  end if;
  perform public.poczta_odstep('kontakt:wszystkie', '*'), public.poczta_odstep('kontakt:ip', coalesce(p_ip, '?')), public.poczta_odstep('kontakt:email', v_email);
  insert into public.poczta_watki (temat, od_email, zrodlo, uzytkownik)
    values (coalesce(nullif(v_temat, ''), 'Wiadomość z formularza'), v_email, 'formularz',
            (select u.id from auth.users u where u.id = p_uzytkownik))
    returning id into v_watek;
  insert into public.poczta_wiadomosci (watek, kierunek, od_email, temat, tekst)
    values (v_watek, 'przychodzaca', v_email, coalesce(nullif(v_temat, ''), 'Wiadomość z formularza'), v_tresc);
  update public.poczta_watki set liczba = 1, ostatnia = now() where id = v_watek;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.kontakt_przyjmij(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.kontakt_przyjmij(text, text, text, text, uuid) to service_role;

-- Ustawienia poczty w panelu – bez pól klucza skrzynki.
create or replace function public.admin_poczta_ustawienia()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.wymagaj_administratora();
  return jsonb_build_object(
    'ustawienia', (select to_jsonb(u) from public.poczta_ustawienia u where u.id = 1),
    'dostawcy', (select coalesce(jsonb_agg(to_jsonb(d) order by d.priorytet, d.id), '[]') from public.poczta_dostawcy d),
    'odstepy', (select coalesce(jsonb_agg(to_jsonb(o) order by o.akcja), '[]') from public.poczta_odstepy o));
end;
$$;
