-- Migracja: panel administratora – skrzynka kontakt@makietka.app, kolejka maili, dostawcy z dziennymi limitami,
-- odstępy (cooldowny) wzorem Familiady, formularz kontaktowy i statystyki (decyzja #95).
--
-- Kto co robi:
--  • Funkcja Edge `poczta` (supabase/functions/poczta, _shared/poczta.mjs) wysyła maile z kolejki przez API Brevo
--    (sekret BREVO_API_KEY). Kolejkę czyta i rozlicza kluczem serwisowym środowiska funkcji (SUPABASE_SERVICE_ROLE_KEY –
--    Supabase daje go funkcjom sam, nie leży w repozytorium) – funkcje poczta_kolejka_* są tylko dla service_role.
--  • Worker Cloudflare (cloudflare/poczta.js): poczta przychodząca (Email Routing → Email Worker) i formularz
--    kontaktowy zapisują się funkcjami poczta_przyjmij i kontakt_przyjmij. Wołać je może każdy (anon), ale tylko
--    z kluczem skrzynki: losowym sekretem, który administrator generuje w panelu (w bazie zostaje sam skrót SHA-256),
--    a użytkownik wpisuje go raz jako sekret Workera KLUCZ_SKRZYNKI.
--  • Co minutę Cron Trigger Workera prosi funkcję `poczta` o przetworzenie kolejki (to nic nie zdradza – kolejka i tak
--    pilnuje limitów); aplikacja prosi o to też zaraz po dodaniu maila do kolejki, więc zwykle mail wychodzi od razu.
--  • Panel (#/admin) – tylko konta z tabeli administratorzy; wszystko przez funkcje admin_* (security definer).
--
-- Tabele nie mają polityk RLS – nikt nie czyta ich wprost, tylko przez funkcje poniżej.

-- ---------- Administrator ----------

create table if not exists public.administratorzy (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dodano  timestamptz not null default now()
);
alter table public.administratorzy enable row level security;
revoke all on table public.administratorzy from anon, authenticated;

-- Pierwszy administrator: właściciel projektu użytkownika („Dziennik biblijny 2027 – blok”) – bez e-maila w repozytorium.
insert into public.administratorzy (user_id)
  select owner_id from public.projekty where id = '63951b73-a944-4473-bbe2-9b011a87c5ad'
  on conflict do nothing;

create or replace function public.czy_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (select 1 from public.administratorzy a where a.user_id = auth.uid());
$$;
revoke all on function public.czy_administrator() from public;
grant execute on function public.czy_administrator() to anon, authenticated;

create or replace function public.wymagaj_administratora()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.czy_administrator() then
    raise exception 'Tylko dla administratora' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.wymagaj_administratora() from public, anon, authenticated;

-- ---------- Ustawienia poczty i dostawcy ----------

create table if not exists public.poczta_ustawienia (
  id                  int primary key default 1 check (id = 1),
  nadawca_email       text not null default 'no-reply@makietka.app',
  nadawca_nazwa       text not null default 'Makietka',
  skrzynka_email      text not null default 'kontakt@makietka.app',   -- odpowiedzi z panelu i adres „odpowiedz do”
  limit_przebiegu     int  not null default 25 check (limit_przebiegu between 1 and 200),
  odstep_ms           int  not null default 1000 check (odstep_ms between 0 and 60000),
  maks_prob           int  not null default 5 check (maks_prob between 1 and 20),
  klucz_skrzynki_skrot text,
  klucz_skrzynki_od   timestamptz,
  zmieniono           timestamptz not null default now()
);
insert into public.poczta_ustawienia (id) values (1) on conflict do nothing;
alter table public.poczta_ustawienia enable row level security;
revoke all on table public.poczta_ustawienia from anon, authenticated;

-- Dostawcy jak w Familiadzie (lista z priorytetem i dziennym limitem); na razie jeden – Brevo (darmowo 300 maili dziennie).
create table if not exists public.poczta_dostawcy (
  id             text primary key,
  nazwa          text not null,
  typ            text not null default 'brevo' check (typ in ('brevo')),
  priorytet      int  not null default 1,
  dzienny_limit  int  not null default 300 check (dzienny_limit >= 0),
  aktywny        boolean not null default true,
  dzien          date not null default current_date,
  wyslane_dzis   int  not null default 0
);
insert into public.poczta_dostawcy (id, nazwa) values ('brevo', 'Brevo') on conflict do nothing;
alter table public.poczta_dostawcy enable row level security;
revoke all on table public.poczta_dostawcy from anon, authenticated;

-- Odstępy i limity (cooldowny) – jak mail_cooldown_policies w Familiadzie: dla akcji i celu (adres, konto, IP)
-- najmniejszy odstęp w sekundach i najwięcej zdarzeń na dobę.
create table if not exists public.poczta_odstepy (
  akcja    text primary key,
  opis     text not null,
  sekundy  int  not null default 0 check (sekundy >= 0),
  na_dobe  int  check (na_dobe is null or na_dobe >= 0),
  wlaczone boolean not null default true
);
insert into public.poczta_odstepy (akcja, opis, sekundy, na_dobe) values
  ('baza:adresat',           'Każdy mail do tego samego adresu (wysyłka z kolejki)', 60, 20),
  ('zaproszenie:adresat',    'Zaproszenie do projektu na ten sam adres',             600, 5),
  ('zaproszenie:konto',      'Zaproszenia wysyłane z jednego konta',                 10, 60),
  ('kontakt:ip',             'Formularz kontaktowy z jednego adresu IP',             120, 10),
  ('kontakt:email',          'Formularz kontaktowy z jednego adresu e-mail',         300, 5),
  ('kontakt:wszystkie',      'Formularz kontaktowy – razem',                         0, 200),
  ('przychodzaca:nadawca',   'Poczta przychodząca od jednego nadawcy',               0, 50),
  ('przychodzaca:wszystkie', 'Poczta przychodząca – razem',                          0, 500)
on conflict do nothing;
alter table public.poczta_odstepy enable row level security;
revoke all on table public.poczta_odstepy from anon, authenticated;

create table if not exists public.poczta_zdarzenia (
  akcja text not null,
  cel   text not null,
  czas  timestamptz not null default now()
);
create index if not exists poczta_zdarzenia_akcja_cel on public.poczta_zdarzenia (akcja, cel, czas desc);
alter table public.poczta_zdarzenia enable row level security;
revoke all on table public.poczta_zdarzenia from anon, authenticated;

-- Ile sekund trzeba jeszcze poczekać (0 – wolno); przy 0 i p_zapisz zdarzenie się liczy.
create or replace function public.poczta_odstep(p_akcja text, p_cel text, p_zapisz boolean default true)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.poczta_odstepy%rowtype;
  v_ostatnie timestamptz;
  v_ile int;
  v_najstarsze timestamptz;
  v_czekaj int := 0;
begin
  select * into o from public.poczta_odstepy where akcja = p_akcja;
  if found and o.wlaczone then
    select max(czas), count(*), min(czas) into v_ostatnie, v_ile, v_najstarsze
      from public.poczta_zdarzenia where akcja = p_akcja and cel = p_cel and czas > now() - interval '1 day';
    if o.sekundy > 0 and v_ostatnie is not null and v_ostatnie > now() - make_interval(secs => o.sekundy) then
      v_czekaj := ceil(extract(epoch from (v_ostatnie + make_interval(secs => o.sekundy) - now())))::int;
    end if;
    if o.na_dobe is not null and v_ile >= o.na_dobe then
      v_czekaj := greatest(v_czekaj, ceil(extract(epoch from (v_najstarsze + interval '1 day' - now())))::int);
    end if;
  end if;
  if v_czekaj <= 0 and p_zapisz then
    insert into public.poczta_zdarzenia (akcja, cel) values (p_akcja, p_cel);
  end if;
  return greatest(v_czekaj, 0);
end;
$$;
revoke all on function public.poczta_odstep(text, text, boolean) from public, anon, authenticated;

create or replace function public.poczta_za_ile(p_sekundy int)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_sekundy < 90 then p_sekundy || ' s'
              when p_sekundy < 5400 then ceil(p_sekundy / 60.0)::int || ' min'
              else ceil(p_sekundy / 3600.0)::int || ' godz.' end;
$$;

-- ---------- Kolejka ----------

create table if not exists public.poczta_kolejka (
  id            uuid primary key default gen_random_uuid(),
  rodzaj        text not null check (rodzaj in ('zaproszenie', 'kontakt', 'odpowiedz', 'test')),
  do_email      text not null,
  do_nazwa      text,
  szablon       text not null,                  -- treść składa funkcja poczta przy wysyłce (szablon + dane)
  dane          jsonb not null default '{}',
  temat         text,
  odpowiedz_do  jsonb,                          -- { email, name }
  naglowki      jsonb not null default '{}',    -- np. In-Reply-To, References przy odpowiedzi z panelu
  od_skrzynki   boolean not null default false, -- nadawca: adres skrzynki (kontakt@) zamiast no-reply@
  priorytet     int not null default 5,
  stan          text not null default 'czeka' check (stan in ('czeka', 'wysylanie', 'wyslany', 'blad', 'anulowany')),
  proby         int not null default 0,
  nastepna_proba timestamptz not null default now(),
  blad          text,
  dostawca      text,
  message_id    text,
  utworzyl      uuid references auth.users (id) on delete set null,
  utworzono     timestamptz not null default now(),
  wyslano       timestamptz
);
create index if not exists poczta_kolejka_czeka on public.poczta_kolejka (priorytet, nastepna_proba) where stan = 'czeka';
create index if not exists poczta_kolejka_adresat on public.poczta_kolejka (lower(do_email), wyslano desc);
create index if not exists poczta_kolejka_utworzono on public.poczta_kolejka (utworzono desc);
alter table public.poczta_kolejka enable row level security;
revoke all on table public.poczta_kolejka from anon, authenticated;

-- ---------- Skrzynka ----------

create table if not exists public.poczta_watki (
  id           uuid primary key default gen_random_uuid(),
  temat        text not null default '(bez tematu)',
  od_email     text not null,
  od_nazwa     text,
  zrodlo       text not null default 'mail' check (zrodlo in ('mail', 'formularz')),
  folder       text not null default 'skrzynka' check (folder in ('skrzynka', 'archiwum', 'spam', 'kosz')),
  przeczytany  boolean not null default false,
  uzytkownik   uuid references auth.users (id) on delete set null,
  liczba       int not null default 0,
  ostatnia     timestamptz not null default now(),
  utworzono    timestamptz not null default now()
);
create index if not exists poczta_watki_folder on public.poczta_watki (folder, ostatnia desc);
alter table public.poczta_watki enable row level security;
revoke all on table public.poczta_watki from anon, authenticated;

create table if not exists public.poczta_wiadomosci (
  id           uuid primary key default gen_random_uuid(),
  watek        uuid not null references public.poczta_watki (id) on delete cascade,
  kierunek     text not null check (kierunek in ('przychodzaca', 'wychodzaca')),
  od_email     text,
  od_nazwa     text,
  do_email     text,
  temat        text,
  tekst        text,
  html         text,
  message_id   text,
  in_reply_to  text,
  referencje   text[] not null default '{}',
  zalaczniki   jsonb not null default '[]',
  spam         boolean not null default false,
  kolejka      uuid references public.poczta_kolejka (id) on delete set null,
  utworzono    timestamptz not null default now()
);
create index if not exists poczta_wiadomosci_watek on public.poczta_wiadomosci (watek, utworzono);
create index if not exists poczta_wiadomosci_message_id on public.poczta_wiadomosci (message_id) where message_id is not null;
alter table public.poczta_wiadomosci enable row level security;
revoke all on table public.poczta_wiadomosci from anon, authenticated;

-- Klucz skrzynki (Worker → baza): porównanie ze skrótem z ustawień.
create or replace function public.poczta_klucz_ok(p_klucz text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(length(p_klucz) >= 24 and (select u.klucz_skrzynki_skrot from public.poczta_ustawienia u where u.id = 1)
                  = encode(extensions.digest(p_klucz, 'sha256'), 'hex'), false);
$$;
revoke all on function public.poczta_klucz_ok(text) from public, anon, authenticated;

-- Nowy wątek albo dopisanie do istniejącego (In-Reply-To / References / ten sam temat od tego samego nadawcy w 30 dni).
create or replace function public.poczta_watek_dla(p_od text, p_temat text, p_in_reply_to text, p_referencje text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_watek uuid;
  v_temat text := regexp_replace(coalesce(p_temat, ''), '^\s*((re|odp|fwd|fw|pd)\s*:\s*)+', '', 'i');
begin
  if p_in_reply_to is not null or coalesce(array_length(p_referencje, 1), 0) > 0 then
    select w.watek into v_watek from public.poczta_wiadomosci w
      where w.message_id is not null and (w.message_id = p_in_reply_to or w.message_id = any (coalesce(p_referencje, '{}')))
      order by w.utworzono desc limit 1;
  end if;
  if v_watek is null and v_temat <> '' then
    select t.id into v_watek from public.poczta_watki t
      where lower(t.od_email) = lower(p_od) and lower(regexp_replace(t.temat, '^\s*((re|odp|fwd|fw|pd)\s*:\s*)+', '', 'i')) = lower(v_temat)
        and t.ostatnia > now() - interval '30 days' and t.folder <> 'kosz'
      order by t.ostatnia desc limit 1;
  end if;
  return v_watek;
end;
$$;
revoke all on function public.poczta_watek_dla(text, text, text, text[]) from public, anon, authenticated;

-- Poczta przychodząca z Workera. p jsonb: { od_email, od_nazwa, do_email, temat, tekst, html, message_id, in_reply_to,
-- referencje: [], zalaczniki: [{ nazwa, typ, rozmiar, klucz? }], spam: bool }.
create or replace function public.poczta_przyjmij(p_klucz text, p jsonb)
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
  if not public.poczta_klucz_ok(p_klucz) then
    return jsonb_build_object('blad', 'zly-klucz');
  end if;
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
revoke all on function public.poczta_przyjmij(text, jsonb) from public;
grant execute on function public.poczta_przyjmij(text, jsonb) to anon, authenticated;

-- Formularz kontaktowy (przez Worker – IP i Turnstile sprawdza on). p_ip – skrót adresu IP (nie sam adres).
-- Zalogowany: auth.uid() z tokenu, który Worker przekazuje dalej.
create or replace function public.kontakt_przyjmij(p_klucz text, p_ip text, p_email text, p_temat text, p_tresc text)
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
  if not public.poczta_klucz_ok(p_klucz) then
    return jsonb_build_object('blad', 'niegotowy');
  end if;
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
    values (coalesce(nullif(v_temat, ''), 'Wiadomość z formularza'), v_email, 'formularz', auth.uid())
    returning id into v_watek;
  insert into public.poczta_wiadomosci (watek, kierunek, od_email, temat, tekst)
    values (v_watek, 'przychodzaca', v_email, coalesce(nullif(v_temat, ''), 'Wiadomość z formularza'), v_tresc);
  update public.poczta_watki set liczba = 1, ostatnia = now() where id = v_watek;
  -- Potwierdzenie do nadawcy – przez kolejkę (bez osobnego limitu: ten wyżej wystarcza, jak w Familiadzie).
  insert into public.poczta_kolejka (rodzaj, do_email, szablon, dane, priorytet, odpowiedz_do, od_skrzynki)
    values ('kontakt', v_email, 'kontakt', jsonb_build_object('temat', v_temat, 'tresc', v_tresc), 3,
            jsonb_build_object('email', (select u.skrzynka_email from public.poczta_ustawienia u where u.id = 1)), false);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.kontakt_przyjmij(text, text, text, text, text) from public;
grant execute on function public.kontakt_przyjmij(text, text, text, text, text) to anon, authenticated;

-- ---------- Zaproszenie do projektu → kolejka (zamiast wysyłki od razu) ----------

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

-- ---------- Przetwarzanie kolejki (tylko funkcja poczta, kluczem serwisowym) ----------

create or replace function public.poczta_kolejka_pobierz(p_limit int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.poczta_ustawienia%rowtype;
  d public.poczta_dostawcy%rowtype;
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

  select * into d from public.poczta_dostawcy where aktywny order by priorytet, id limit 1 for update;
  if not found then
    return jsonb_build_object('wiadomosci', '[]'::jsonb, 'powod', 'brak-dostawcy');
  end if;
  if d.dzien <> current_date then
    update public.poczta_dostawcy set dzien = current_date, wyslane_dzis = 0 where id = d.id returning * into d;
  end if;
  v_limit := least(coalesce(p_limit, u.limit_przebiegu), u.limit_przebiegu, greatest(d.dzienny_limit - d.wyslane_dzis, 0));
  if v_limit <= 0 then
    return jsonb_build_object('wiadomosci', '[]'::jsonb, 'powod', 'limit-dzienny', 'dostawca', d.id);
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
    update public.poczta_kolejka set stan = 'wysylanie', proby = proby + 1, dostawca = d.id, nastepna_proba = now() where id = r.id;
    v_wynik := v_wynik || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'rodzaj', r.rodzaj, 'do_email', r.do_email, 'do_nazwa', r.do_nazwa, 'szablon', r.szablon, 'dane', r.dane,
      'temat', r.temat, 'odpowiedz_do', r.odpowiedz_do, 'naglowki', r.naglowki, 'od_skrzynki', r.od_skrzynki));
  end loop;
  update public.poczta_dostawcy set wyslane_dzis = wyslane_dzis + jsonb_array_length(v_wynik) where id = d.id;
  return jsonb_build_object(
    'wiadomosci', v_wynik, 'dostawca', d.id, 'odstep_ms', u.odstep_ms,
    'nadawca', jsonb_build_object('email', u.nadawca_email, 'name', u.nadawca_nazwa),
    'skrzynka', jsonb_build_object('email', u.skrzynka_email, 'name', u.nadawca_nazwa));
end;
$$;
revoke all on function public.poczta_kolejka_pobierz(int) from public, anon, authenticated;
grant execute on function public.poczta_kolejka_pobierz(int) to service_role;

-- Wynik wysyłki. Błąd: ponowienie po 1, 5, 15, 60 min…, po maks_prob – stan „blad”.
create or replace function public.poczta_kolejka_wynik(p_id uuid, p_ok boolean, p_blad text default null, p_message_id text default null)
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
    update public.poczta_kolejka set stan = 'wyslany', wyslano = now(), blad = null, message_id = left(p_message_id, 500) where id = p_id;
    if k.rodzaj = 'odpowiedz' and k.dane ? 'wiadomosc' then
      update public.poczta_wiadomosci set message_id = left(p_message_id, 500) where id = (k.dane->>'wiadomosc')::uuid and message_id is null;
    end if;
  else
    update public.poczta_kolejka set
      stan = case when k.proby >= v_maks then 'blad' else 'czeka' end,
      blad = left(p_blad, 1000),
      nastepna_proba = now() + (array[interval '1 minute', interval '5 minutes', interval '15 minutes', interval '60 minutes'])[least(k.proby, 4)]
      where id = p_id;
    -- Nieudana próba nie zjada dziennego limitu dostawcy.
    update public.poczta_dostawcy set wyslane_dzis = greatest(wyslane_dzis - 1, 0) where id = k.dostawca and dzien = current_date;
  end if;
end;
$$;
revoke all on function public.poczta_kolejka_wynik(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.poczta_kolejka_wynik(uuid, boolean, text, text) to service_role;

-- ---------- Panel administratora ----------

create or replace function public.admin_poczta_watki(p_folder text default 'skrzynka', p_szukaj text default null, p_limit int default 50, p_od int default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_szukaj text := nullif(btrim(coalesce(p_szukaj, '')), '');
begin
  perform public.wymagaj_administratora();
  return jsonb_build_object(
    'watki', coalesce((select jsonb_agg(x order by x.ostatnia desc) from (
      select t.id, t.temat, t.od_email, t.od_nazwa, t.zrodlo, t.folder, t.przeczytany, t.liczba, t.ostatnia,
             (select left(coalesce(w.tekst, regexp_replace(coalesce(w.html, ''), '<[^>]*>', ' ', 'g')), 160) from public.poczta_wiadomosci w
                where w.watek = t.id order by w.utworzono desc limit 1) as zajawka
        from public.poczta_watki t
        where t.folder = coalesce(p_folder, 'skrzynka')
          and (v_szukaj is null or t.temat ilike '%' || v_szukaj || '%' or t.od_email ilike '%' || v_szukaj || '%'
               or exists (select 1 from public.poczta_wiadomosci w where w.watek = t.id and w.tekst ilike '%' || v_szukaj || '%'))
        order by t.ostatnia desc limit least(greatest(p_limit, 1), 200) offset greatest(p_od, 0)) x), '[]'),
    'liczniki', (select jsonb_object_agg(f, n) from (
      select f, (select count(*) from public.poczta_watki t where t.folder = f and (f <> 'skrzynka' or not t.przeczytany)) n
        from unnest(array['skrzynka', 'archiwum', 'spam', 'kosz']) f) c));
end;
$$;

create or replace function public.admin_poczta_watek(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.poczta_watki%rowtype;
begin
  perform public.wymagaj_administratora();
  update public.poczta_watki set przeczytany = true where id = p_id returning * into t;
  if not found then
    raise exception 'Nie ma takiej rozmowy';
  end if;
  return jsonb_build_object('watek', to_jsonb(t), 'wiadomosci', coalesce((
    select jsonb_agg(jsonb_build_object('id', w.id, 'kierunek', w.kierunek, 'od_email', w.od_email, 'od_nazwa', w.od_nazwa, 'do_email', w.do_email,
      'temat', w.temat, 'tekst', w.tekst, 'html', w.html, 'zalaczniki', w.zalaczniki, 'spam', w.spam, 'utworzono', w.utworzono,
      'stan', (select k.stan from public.poczta_kolejka k where k.id = w.kolejka), 'blad', (select k.blad from public.poczta_kolejka k where k.id = w.kolejka))
      order by w.utworzono)
    from public.poczta_wiadomosci w where w.watek = p_id), '[]'));
end;
$$;

create or replace function public.admin_poczta_zmien(p_id uuid, p_folder text default null, p_przeczytany boolean default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.wymagaj_administratora();
  if p_folder is not null and p_folder not in ('skrzynka', 'archiwum', 'spam', 'kosz') then
    raise exception 'Nieznany folder';
  end if;
  update public.poczta_watki set folder = coalesce(p_folder, folder), przeczytany = coalesce(p_przeczytany, przeczytany) where id = p_id;
end;
$$;

-- Trwałe usunięcie rozmów z kosza.
create or replace function public.admin_poczta_oproznij_kosz()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v int;
begin
  perform public.wymagaj_administratora();
  delete from public.poczta_watki where folder = 'kosz';
  get diagnostics v = row_count;
  return v;
end;
$$;

-- Odpowiedź z panelu: wiadomość w rozmowie + mail w kolejce (z adresu skrzynki, z In-Reply-To/References).
create or replace function public.admin_poczta_odpowiedz(p_watek uuid, p_tresc text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.poczta_watki%rowtype;
  v_ost public.poczta_wiadomosci%rowtype;
  v_ref text[];
  v_temat text;
  v_wiad uuid;
  v_kol uuid;
  v_tresc text := btrim(coalesce(p_tresc, ''));
begin
  perform public.wymagaj_administratora();
  if v_tresc = '' then
    raise exception 'Odpowiedź jest pusta';
  end if;
  select * into t from public.poczta_watki where id = p_watek;
  if not found then
    raise exception 'Nie ma takiej rozmowy';
  end if;
  select * into v_ost from public.poczta_wiadomosci where watek = p_watek and kierunek = 'przychodzaca' order by utworzono desc limit 1;
  select coalesce(array_agg(m order by n), '{}') into v_ref from (
    select distinct on (m) m, n from (
      select w.message_id m, w.utworzono n from public.poczta_wiadomosci w where w.watek = p_watek and w.message_id is not null) a) b;
  v_temat := case when t.temat ~* '^\s*(re|odp)\s*:' then t.temat else 'Re: ' || t.temat end;
  insert into public.poczta_kolejka (rodzaj, do_email, do_nazwa, szablon, dane, temat, naglowki, od_skrzynki, priorytet, utworzyl)
    values ('odpowiedz', coalesce(v_ost.od_email, t.od_email), coalesce(v_ost.od_nazwa, t.od_nazwa), 'odpowiedz',
            jsonb_build_object('tresc', v_tresc, 'cytat', left(coalesce(v_ost.tekst, ''), 2000), 'kiedy', v_ost.utworzono), v_temat,
            jsonb_strip_nulls(jsonb_build_object('In-Reply-To', v_ost.message_id,
              'References', nullif(array_to_string(v_ref[greatest(array_length(v_ref, 1) - 9, 1):], ' '), ''))), true, 1, auth.uid())
    returning id into v_kol;
  insert into public.poczta_wiadomosci (watek, kierunek, od_email, do_email, temat, tekst, in_reply_to, referencje, kolejka)
    values (p_watek, 'wychodzaca', (select u.skrzynka_email from public.poczta_ustawienia u where u.id = 1), coalesce(v_ost.od_email, t.od_email),
            v_temat, v_tresc, v_ost.message_id, v_ref, v_kol)
    returning id into v_wiad;
  update public.poczta_kolejka set dane = dane || jsonb_build_object('wiadomosc', v_wiad) where id = v_kol;
  update public.poczta_watki set liczba = liczba + 1, ostatnia = now(), przeczytany = true,
    folder = 'skrzynka' where id = p_watek;
  return jsonb_build_object('ok', true, 'kolejka', v_kol, 'wiadomosc', v_wiad);
end;
$$;

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
      'wyslane_dzis', case when d.dzien = current_date then d.wyslane_dzis else 0 end, 'aktywny', d.aktywny) order by d.priorytet), '[]')
      from public.poczta_dostawcy d));
end;
$$;

create or replace function public.admin_kolejka_akcja(p_id uuid, p_akcja text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.wymagaj_administratora();
  if p_akcja = 'teraz' then
    update public.poczta_kolejka set nastepna_proba = now() where id = p_id and stan = 'czeka';
  elsif p_akcja = 'ponow' then
    update public.poczta_kolejka set stan = 'czeka', proby = 0, nastepna_proba = now(), blad = null where id = p_id and stan in ('blad', 'anulowany');
  elsif p_akcja = 'anuluj' then
    update public.poczta_kolejka set stan = 'anulowany' where id = p_id and stan in ('czeka', 'blad');
  else
    raise exception 'Nieznana akcja';
  end if;
end;
$$;

create or replace function public.admin_poczta_ustawienia()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.wymagaj_administratora();
  return jsonb_build_object(
    'ustawienia', (select to_jsonb(u) - 'klucz_skrzynki_skrot' || jsonb_build_object('klucz_ustawiony', u.klucz_skrzynki_skrot is not null)
                     from public.poczta_ustawienia u where u.id = 1),
    'dostawcy', (select coalesce(jsonb_agg(to_jsonb(d) order by d.priorytet, d.id), '[]') from public.poczta_dostawcy d),
    'odstepy', (select coalesce(jsonb_agg(to_jsonb(o) order by o.akcja), '[]') from public.poczta_odstepy o));
end;
$$;

-- p: { ustawienia: {nadawca_email, nadawca_nazwa, skrzynka_email, limit_przebiegu, odstep_ms, maks_prob},
--      dostawcy: [{id, priorytet, dzienny_limit, aktywny}], odstepy: [{akcja, sekundy, na_dobe, wlaczone}] }.
create or replace function public.admin_poczta_zapisz(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u jsonb := coalesce(p->'ustawienia', '{}');
  x jsonb;
begin
  perform public.wymagaj_administratora();
  if (u ? 'nadawca_email' and u->>'nadawca_email' !~* '^[^@\s]+@makietka\.app$')
     or (u ? 'skrzynka_email' and u->>'skrzynka_email' !~* '^[^@\s]+@makietka\.app$') then
    raise exception 'Adres nadawcy i skrzynki musi być w domenie makietka.app';
  end if;
  update public.poczta_ustawienia set
    nadawca_email = coalesce(u->>'nadawca_email', nadawca_email),
    nadawca_nazwa = coalesce(nullif(left(btrim(u->>'nadawca_nazwa'), 80), ''), nadawca_nazwa),
    skrzynka_email = coalesce(u->>'skrzynka_email', skrzynka_email),
    limit_przebiegu = coalesce((u->>'limit_przebiegu')::int, limit_przebiegu),
    odstep_ms = coalesce((u->>'odstep_ms')::int, odstep_ms),
    maks_prob = coalesce((u->>'maks_prob')::int, maks_prob),
    zmieniono = now()
    where id = 1;
  for x in select * from jsonb_array_elements(coalesce(p->'dostawcy', '[]')) loop
    update public.poczta_dostawcy set
      priorytet = coalesce((x->>'priorytet')::int, priorytet),
      dzienny_limit = coalesce((x->>'dzienny_limit')::int, dzienny_limit),
      aktywny = coalesce((x->>'aktywny')::boolean, aktywny)
      where id = x->>'id';
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'odstepy', '[]')) loop
    update public.poczta_odstepy set
      sekundy = coalesce((x->>'sekundy')::int, sekundy),
      na_dobe = case when x ? 'na_dobe' then (x->>'na_dobe')::int else na_dobe end,
      wlaczone = coalesce((x->>'wlaczone')::boolean, wlaczone)
      where akcja = x->>'akcja';
  end loop;
end;
$$;

-- Nowy klucz skrzynki (pokazany raz – do wpisania jako sekret Workera KLUCZ_SKRZYNKI); stary przestaje działać.
create or replace function public.admin_klucz_skrzynki()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := 'msk_' || translate(rtrim(encode(extensions.gen_random_bytes(24), 'base64'), '='), '+/', '-_');
begin
  perform public.wymagaj_administratora();
  update public.poczta_ustawienia set klucz_skrzynki_skrot = encode(extensions.digest(v, 'sha256'), 'hex'), klucz_skrzynki_od = now() where id = 1;
  return v;
end;
$$;

create or replace function public.admin_poczta_test(p_do text)
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
  insert into public.poczta_kolejka (rodzaj, do_email, szablon, dane, priorytet, utworzyl)
    values ('test', lower(btrim(p_do)), 'test', jsonb_build_object('kiedy', now()), 1, auth.uid()) returning id into v;
  return jsonb_build_object('ok', true, 'id', v);
end;
$$;

-- Statystyki: liczby i dzienne serie z ostatnich p_dni dni.
create or replace function public.admin_statystyki(p_dni int default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dni int := least(greatest(coalesce(p_dni, 30), 7), 180);
  v_od date := current_date - (v_dni - 1);
  v_pliki bigint;
begin
  perform public.wymagaj_administratora();
  select coalesce(sum((o.metadata->>'size')::bigint), 0) into v_pliki from storage.objects o;
  return jsonb_build_object(
    'dni', v_dni,
    'konta', jsonb_build_object(
      'razem', (select count(*) from auth.users),
      'aktywne_7', (select count(*) from auth.users u where u.last_sign_in_at > now() - interval '7 days'),
      'aktywne_30', (select count(*) from auth.users u where u.last_sign_in_at > now() - interval '30 days'),
      'nowe_7', (select count(*) from auth.users u where u.created_at > now() - interval '7 days')),
    'projekty', jsonb_build_object(
      'razem', (select count(*) from public.projekty),
      'zmienione_7', (select count(*) from public.projekty p where p.zmieniono > now() - interval '7 days'),
      'wspoldzielone', (select count(distinct w.projekt_id) from public.wspolpracownicy w)),
    'zaproszenia', jsonb_build_object(
      'razem', (select count(*) from public.zaproszenia),
      'przyjete', (select count(*) from public.zaproszenia z where z.stan = 'przyjete'),
      'czekajace', (select count(*) from public.zaproszenia z where z.stan = 'czeka' and z.wazne_do > now())),
    'maile', jsonb_build_object(
      'wyslane_dzis', (select count(*) from public.poczta_kolejka k where k.wyslano >= current_date),
      'wyslane_30', (select count(*) from public.poczta_kolejka k where k.wyslano > now() - interval '30 days'),
      'bledy', (select count(*) from public.poczta_kolejka k where k.stan = 'blad'),
      'w_kolejce', (select count(*) from public.poczta_kolejka k where k.stan in ('czeka', 'wysylanie'))),
    'skrzynka', jsonb_build_object(
      'nieprzeczytane', (select count(*) from public.poczta_watki t where t.folder = 'skrzynka' and not t.przeczytany),
      'rozmowy_30', (select count(*) from public.poczta_watki t where t.utworzono > now() - interval '30 days')),
    'miejsce', jsonb_build_object('pliki', v_pliki, 'baza', pg_database_size(current_database())),
    'serie', jsonb_build_object(
      'konta', (select jsonb_agg(jsonb_build_object('dzien', d, 'ile', (select count(*) from auth.users u where u.created_at::date = d)) order by d)
                  from generate_series(v_od, current_date, interval '1 day') g(d0), lateral (select g.d0::date d) x),
      'projekty', (select jsonb_agg(jsonb_build_object('dzien', d, 'ile', (select count(*) from public.projekty p where p.utworzono::date = d)) order by d)
                  from generate_series(v_od, current_date, interval '1 day') g(d0), lateral (select g.d0::date d) x),
      'maile', (select jsonb_agg(jsonb_build_object('dzien', d, 'ile', (select count(*) from public.poczta_kolejka k where k.wyslano::date = d)) order by d)
                  from generate_series(v_od, current_date, interval '1 day') g(d0), lateral (select g.d0::date d) x)));
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_poczta_watki(text, text, int, int)', 'admin_poczta_watek(uuid)', 'admin_poczta_zmien(uuid, text, boolean)',
    'admin_poczta_oproznij_kosz()', 'admin_poczta_odpowiedz(uuid, text)', 'admin_kolejka(text, int)', 'admin_kolejka_akcja(uuid, text)',
    'admin_poczta_ustawienia()', 'admin_poczta_zapisz(jsonb)', 'admin_klucz_skrzynki()', 'admin_poczta_test(text)', 'admin_statystyki(int)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
