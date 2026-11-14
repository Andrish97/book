-- Formularz kontaktowy z załącznikami (decyzja #116): Worker zapisuje pliki w R2 (poczta/<uuid>/<nazwa>)
-- i podaje ich opisy; trafiają do wiadomości zgłoszenia tak jak załączniki poczty przychodzącej
-- (poczta_zalaczniki sprawdza klucze, liczbę i łączny rozmiar).

drop function if exists public.kontakt_przyjmij(text, text, text, text, uuid);

create or replace function public.kontakt_przyjmij(p_ip text, p_email text, p_temat text, p_tresc text, p_uzytkownik uuid default null, p_zalaczniki jsonb default '[]')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_temat text := left(btrim(coalesce(p_temat, '')), 200);
  v_tresc text := left(btrim(coalesce(p_tresc, '')), 5000);
  v_zal jsonb := public.poczta_zalaczniki(coalesce(p_zalaczniki, '[]'));
  v_czekaj int;
  v_watek uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('blad', 'zly-email');
  end if;
  if length(v_tresc) < 10 then
    return jsonb_build_object('blad', 'za-krotka');
  end if;
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
  insert into public.poczta_wiadomosci (watek, kierunek, od_email, temat, tekst, zalaczniki)
    values (v_watek, 'przychodzaca', v_email, coalesce(nullif(v_temat, ''), 'Wiadomość z formularza'), v_tresc, v_zal);
  update public.poczta_watki set liczba = 1, ostatnia = now() where id = v_watek;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.kontakt_przyjmij(text, text, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.kontakt_przyjmij(text, text, text, text, uuid, jsonb) to service_role;
