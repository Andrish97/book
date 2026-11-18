-- Migracja: wyłączanie e-maili o zaproszeniach (decyzja #206).
--
-- „W ustawieniach powiadomień możliwość wyłączenia powiadomień na maila np. przy udostępnieniu.”
-- Jedyny e-mail, który Makietka wysyła sama z siebie do innej osoby, to zaproszenie / udostępnienie projektu
-- (pozostałe to maile konta – potwierdzenie, reset hasła, zmiana adresu – i odpowiedzi z formularza kontaktu,
-- tych nie da się wyłączyć). Osoba z kontem wyłącza je w Ustawienia konta → Powiadomienia → „E-mailem”.
-- Zaproszenie dalej powstaje i czeka w aplikacji (Projekty → Zaproszenia, powiadomienie na urządzeniu);
-- zapraszający dostaje odpowiedź „adresat-wylaczyl” i link do skopiowania.

create table if not exists public.ustawienia_maili (
  uzytkownik  uuid primary key references auth.users (id) on delete cascade,
  zaproszenia boolean not null default true,
  zmieniono   timestamptz not null default now()
);
alter table public.ustawienia_maili enable row level security;
revoke all on table public.ustawienia_maili from anon, authenticated;

-- { zaproszenia } – bez wiersza wszystko włączone.
create or replace function public.moje_ustawienia_maili()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('zaproszenia', coalesce((select m.zaproszenia from public.ustawienia_maili m where m.uzytkownik = auth.uid()), true));
$$;
revoke all on function public.moje_ustawienia_maili() from public, anon;
grant execute on function public.moje_ustawienia_maili() to authenticated;

create or replace function public.zapisz_ustawienia_maili(p_zaproszenia boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  insert into public.ustawienia_maili (uzytkownik, zaproszenia) values (auth.uid(), coalesce(p_zaproszenia, true))
  on conflict (uzytkownik) do update set zaproszenia = excluded.zaproszenia, zmieniono = now();
  return public.moje_ustawienia_maili();
end;
$$;
revoke all on function public.zapisz_ustawienia_maili(boolean) from public, anon;
grant execute on function public.zapisz_ustawienia_maili(boolean) to authenticated;

create or replace function public.poczta_zaplanuj_zaproszenie(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  z public.zaproszenia%rowtype;
  v_dane jsonb;
  v_czekaj int;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  select * into z from public.zaproszenia where id = p_id;
  if not found then
    raise exception 'Nie ma takiego zaproszenia';
  end if;
  if not exists (select 1 from public.projekty p where p.id = z.projekt_id and p.owner_id = auth.uid()) then
    raise exception 'Zaproszenie wysyła tylko właściciel projektu' using errcode = '42501';
  end if;
  -- Adresat z kontem, który wyłączył e-maile o zaproszeniach: bez maila (zaproszenie czeka w aplikacji).
  if exists (select 1 from auth.users u join public.ustawienia_maili m on m.uzytkownik = u.id
              where lower(u.email) = lower(z.email) and not m.zaproszenia) then
    return jsonb_build_object('blad', 'adresat-wylaczyl');
  end if;
  v_czekaj := greatest(public.poczta_odstep('zaproszenie:adresat', lower(z.email), false), public.poczta_odstep('zaproszenie:konto', auth.uid()::text, false));
  if v_czekaj > 0 then
    return jsonb_build_object('blad', 'za-czesto', 'za_sekund', v_czekaj, 'za', public.poczta_za_ile(v_czekaj));
  end if;
  -- Sprawdzenia właściciela, stanu i 10 minut między mailami tego samego zaproszenia – jak dotąd (#86).
  v_dane := public.dane_maila_zaproszenia(p_id);
  perform public.poczta_odstep('zaproszenie:adresat', lower(z.email)), public.poczta_odstep('zaproszenie:konto', auth.uid()::text);
  insert into public.poczta_kolejka (rodzaj, do_email, szablon, dane, priorytet, odpowiedz_do, utworzyl)
    values ('zaproszenie', z.email, 'zaproszenie', v_dane, 2,
            case when v_dane->>'od_email' is not null then jsonb_build_object('email', v_dane->>'od_email', 'name', v_dane->>'od') end, auth.uid())
    returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'email', z.email);
end;
$$;
revoke all on function public.poczta_zaplanuj_zaproszenie(uuid) from public, anon;
grant execute on function public.poczta_zaplanuj_zaproszenie(uuid) to authenticated;

