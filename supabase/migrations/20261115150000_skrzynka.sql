-- Migracja: skrzynka kontakt@ jako pełny klient poczty, jak w Familiadzie (bez marketingu), w stylu Makietki (decyzja #110).
--
-- Użytkownik: „Skrzynka jest zbyt okrojona. Ona ma być niemalże w 100% identyczna jak w Familiadzie, tylko bez
-- marketingu. Ale wyglądać w stylu Makietki”, „nie zrobiłeś możliwości wysyłki, możliwości tworzenia wiadomości”.
--
--  • foldery: Odebrane, Zgłoszenia, Oznaczone gwiazdką, Wysłane, Robocze, Archiwum, Spam, Kosz,
--  • wiadomości z adresatami Do/DW/UDW, treścią HTML (TinyMCE) i załącznikami (R2, przez Workera),
--  • nowa wiadomość, odpowiedź, odpowiedź wszystkim, przekazanie – przez kolejkę (Brevo → ZeptoMail) z adresu
--    skrzynki, z In-Reply-To i References; kopie robocze zapisywane w trakcie pisania; podpis,
--  • operacje zbiorcze (przeczytane, gwiazdka, archiwum, spam, kosz, przywrócenie, trwałe usunięcie),
--  • zgłoszenia z formularza kontaktowego z numerem ZGL-RRRR-NNNN, otwarte/zamknięte,
--  • zmiany w skrzynce na żywo (Realtime) – tylko dla administratora,
--  • statystyki bez kont testowych (cała domena example.com).

-- ---------- Rozmowy ----------

alter table public.poczta_watki add column if not exists gwiazdka boolean not null default false;
alter table public.poczta_watki add column if not exists zgloszenie text;
alter table public.poczta_watki add column if not exists zgloszenie_stan text;
alter table public.poczta_watki drop constraint if exists poczta_watki_zgloszenie_stan_check;
alter table public.poczta_watki add constraint poczta_watki_zgloszenie_stan_check check (zgloszenie_stan in ('otwarte', 'zamkniete'));
create unique index if not exists poczta_watki_zgloszenie on public.poczta_watki (zgloszenie) where zgloszenie is not null;
-- „nowa” – rozmowa zaczęta z panelu; folder „wyslane” – nasza wiadomość bez odpowiedzi (nie leży w Odebranych).
alter table public.poczta_watki drop constraint if exists poczta_watki_zrodlo_check;
alter table public.poczta_watki add constraint poczta_watki_zrodlo_check check (zrodlo in ('mail', 'formularz', 'nowa'));
alter table public.poczta_watki drop constraint if exists poczta_watki_folder_check;
alter table public.poczta_watki add constraint poczta_watki_folder_check check (folder in ('skrzynka', 'wyslane', 'archiwum', 'spam', 'kosz'));
create index if not exists poczta_watki_gwiazdka on public.poczta_watki (ostatnia desc) where gwiazdka;

-- ---------- Wiadomości: adresaci ----------

alter table public.poczta_wiadomosci add column if not exists do_lista text[] not null default '{}';
alter table public.poczta_wiadomosci add column if not exists dw text[] not null default '{}';
alter table public.poczta_wiadomosci add column if not exists udw text[] not null default '{}';
update public.poczta_wiadomosci set do_lista = array[do_email] where do_email is not null and do_lista = '{}';

-- ---------- Kolejka: wielu adresatów i załączniki ----------

alter table public.poczta_kolejka add column if not exists do_lista text[] not null default '{}';
alter table public.poczta_kolejka add column if not exists dw text[] not null default '{}';
alter table public.poczta_kolejka add column if not exists udw text[] not null default '{}';
alter table public.poczta_kolejka add column if not exists zalaczniki jsonb not null default '[]';
alter table public.poczta_kolejka drop constraint if exists poczta_kolejka_rodzaj_check;
alter table public.poczta_kolejka add constraint poczta_kolejka_rodzaj_check check (rodzaj in ('zaproszenie', 'kontakt', 'odpowiedz', 'wiadomosc', 'test'));

-- ---------- Podpis ----------

alter table public.poczta_ustawienia add column if not exists podpis text not null default E'Pozdrawiamy\nZespół Makietki\nhttps://makietka.app';

-- ---------- Kopie robocze ----------

create table if not exists public.poczta_robocze (
  id           uuid primary key default gen_random_uuid(),
  watek        uuid references public.poczta_watki (id) on delete cascade,
  odpowiedz_na uuid references public.poczta_wiadomosci (id) on delete set null,
  tryb         text not null default 'nowa' check (tryb in ('nowa', 'odpowiedz', 'wszystkim', 'przekaz')),
  do_lista     text[] not null default '{}',
  dw           text[] not null default '{}',
  udw          text[] not null default '{}',
  temat        text not null default '',
  html         text not null default '',
  zalaczniki   jsonb not null default '[]',
  utworzono    timestamptz not null default now(),
  zmieniono    timestamptz not null default now()
);
create index if not exists poczta_robocze_zmieniono on public.poczta_robocze (zmieniono desc);
create index if not exists poczta_robocze_watek on public.poczta_robocze (watek) where watek is not null;
alter table public.poczta_robocze enable row level security;
revoke all on table public.poczta_robocze from anon, authenticated;

-- ---------- Zgłoszenia: numer ZGL-RRRR-NNNN dla wiadomości z formularza ----------

create or replace function public.poczta_numer_zgloszenia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rok text := to_char(coalesce(new.utworzono, now()), 'YYYY');
  v_nr int;
begin
  if new.zrodlo = 'formularz' and new.zgloszenie is null then
    perform pg_advisory_xact_lock(hashtext('poczta_zgloszenia'));
    select coalesce(max(substring(t.zgloszenie from '\d+$')::int), 0) + 1 into v_nr
      from public.poczta_watki t where t.zgloszenie like 'ZGL-' || v_rok || '-%';
    new.zgloszenie := 'ZGL-' || v_rok || '-' || lpad(v_nr::text, 4, '0');
    new.zgloszenie_stan := coalesce(new.zgloszenie_stan, 'otwarte');
  end if;
  return new;
end;
$$;
revoke all on function public.poczta_numer_zgloszenia() from public, anon, authenticated;
drop trigger if exists poczta_watki_zgloszenie on public.poczta_watki;
create trigger poczta_watki_zgloszenie before insert on public.poczta_watki
  for each row execute function public.poczta_numer_zgloszenia();

-- Dotychczasowe wiadomości z formularza dostają numery po kolei.
do $$
declare
  r record;
  v_nr int;
begin
  for r in select id, utworzono from public.poczta_watki where zrodlo = 'formularz' and zgloszenie is null order by utworzono loop
    select coalesce(max(substring(t.zgloszenie from '\d+$')::int), 0) + 1 into v_nr
      from public.poczta_watki t where t.zgloszenie like 'ZGL-' || to_char(r.utworzono, 'YYYY') || '-%';
    update public.poczta_watki set zgloszenie = 'ZGL-' || to_char(r.utworzono, 'YYYY') || '-' || lpad(v_nr::text, 4, '0'),
      zgloszenie_stan = 'otwarte' where id = r.id;
  end loop;
end;
$$;

-- ---------- Wątek dla poczty przychodzącej: także po numerze zgłoszenia w temacie ----------

create or replace function public.poczta_watek_dla(p_od text, p_temat text, p_in_reply_to text, p_referencje text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_watek uuid;
  v_temat text := regexp_replace(coalesce(p_temat, ''), '^\s*((re|odp|fwd|fw|pd)\s*:\s*)+', '', 'i');
  v_zgl text := substring(coalesce(p_temat, '') from 'ZGL-\d{4}-\d{4,}');
begin
  if p_in_reply_to is not null or coalesce(array_length(p_referencje, 1), 0) > 0 then
    select w.watek into v_watek from public.poczta_wiadomosci w
      where w.message_id is not null and (w.message_id = p_in_reply_to or w.message_id = any (coalesce(p_referencje, '{}')))
      order by w.utworzono desc limit 1;
  end if;
  if v_watek is null and v_zgl is not null then
    select t.id into v_watek from public.poczta_watki t where t.zgloszenie = v_zgl;
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

-- Poczta przychodząca z Workera. p jsonb: { od_email, od_nazwa, do_email, do_lista: [], dw: [], temat, tekst, html,
-- message_id, in_reply_to, referencje: [], zalaczniki: [{ nazwa, typ, rozmiar, klucz? }], spam: bool }.
-- Odpowiedź na naszą wiadomość (folder „wyslane”) albo na rozmowę z archiwum/kosza wraca do Odebranych;
-- odpowiedź w zamkniętym zgłoszeniu otwiera je ponownie.
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
  v_do text[] := coalesce((select array_agg(lower(x)) from jsonb_array_elements_text(coalesce(p->'do_lista', '[]')) x), '{}');
  v_dw text[] := coalesce((select array_agg(lower(x)) from jsonb_array_elements_text(coalesce(p->'dw', '[]')) x), '{}');
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
  if v_do = '{}' and nullif(p->>'do_email', '') is not null then
    v_do := array[lower(left(p->>'do_email', 320))];
  end if;
  insert into public.poczta_wiadomosci (watek, kierunek, od_email, od_nazwa, do_email, do_lista, dw, temat, tekst, html, message_id, in_reply_to, referencje, zalaczniki, spam)
    values (v_watek, 'przychodzaca', v_od, left(p->>'od_nazwa', 200), left(p->>'do_email', 320), v_do[1:50], v_dw[1:50], left(p->>'temat', 300),
            left(p->>'tekst', 200000), left(p->>'html', 400000), left(p->>'message_id', 500), left(p->>'in_reply_to', 500), v_ref,
            coalesce(p->'zalaczniki', '[]'), v_spam)
    returning id into v_wiad;
  update public.poczta_watki set liczba = liczba + 1, ostatnia = now(), przeczytany = false,
    folder = case when folder in ('archiwum', 'kosz', 'wyslane') and not v_spam then 'skrzynka' else folder end,
    zgloszenie_stan = case when zgloszenie is not null then 'otwarte' else zgloszenie_stan end
    where id = v_watek;
  return jsonb_build_object('ok', true, 'watek', v_watek, 'wiadomosc', v_wiad);
end;
$$;
revoke all on function public.poczta_przyjmij(jsonb) from public, anon, authenticated;
grant execute on function public.poczta_przyjmij(jsonb) to service_role;

-- ---------- Kolejka: pobieranie z adresatami i załącznikami, Message-ID wysłanej wiadomości ----------

create or replace function public.poczta_kolejka_pobierz(p_limit int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.poczta_ustawienia%rowtype;
  v_limit int;
  v_zostalo int;
  v_odstep int;
  v_dostawcy jsonb;
  v_wynik jsonb := '[]';
  v_adresy text[] := '{}';
  v_ostatni timestamptz;
  r public.poczta_kolejka%rowtype;
begin
  select * into u from public.poczta_ustawienia where id = 1;
  -- Utknięte w „wysylanie” dłużej niż 10 minut (przerwany przebieg) wracają do kolejki.
  update public.poczta_kolejka set stan = 'czeka' where stan = 'wysylanie' and nastepna_proba < now() - interval '10 minutes';
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
      order by priorytet, nastepna_proba for update skip locked
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
      'temat', r.temat, 'odpowiedz_do', r.odpowiedz_do, 'naglowki', r.naglowki, 'od_skrzynki', r.od_skrzynki,
      'do_lista', to_jsonb(r.do_lista), 'dw', to_jsonb(r.dw), 'udw', to_jsonb(r.udw), 'zalaczniki', r.zalaczniki));
  end loop;
  return jsonb_build_object(
    'wiadomosci', v_wynik, 'dostawcy', v_dostawcy, 'odstep_ms', u.odstep_ms,
    'nadawca', jsonb_build_object('email', u.nadawca_email, 'name', u.nadawca_nazwa),
    'skrzynka', jsonb_build_object('email', u.skrzynka_email, 'name', u.nadawca_nazwa));
end;
$$;
revoke all on function public.poczta_kolejka_pobierz(int) from public, anon, authenticated;
grant execute on function public.poczta_kolejka_pobierz(int) to service_role;

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
    -- Message-ID wysłanej wiadomości – odpowiedź adresata trafi do tej samej rozmowy.
    if k.rodzaj in ('odpowiedz', 'wiadomosc') and k.dane ? 'wiadomosc' then
      update public.poczta_wiadomosci set message_id = left(p_message_id, 500) where id = (k.dane->>'wiadomosc')::uuid and message_id is null;
    end if;
  else
    update public.poczta_kolejka set
      stan = case when k.proby >= v_maks then 'blad' else 'czeka' end,
      blad = left(p_blad, 1000),
      nastepna_proba = now() + (array[interval '1 minute', interval '5 minutes', interval '15 minutes', interval '60 minutes'])[least(k.proby, 4)]
      where id = p_id;
  end if;
  -- Zmiana stanu wysyłki widoczna w otwartej rozmowie (Realtime na poczta_watki).
  if k.dane ? 'wiadomosc' then
    update public.poczta_watki t set ostatnia = t.ostatnia
      where t.id = (select w.watek from public.poczta_wiadomosci w where w.id = (k.dane->>'wiadomosc')::uuid);
  end if;
end;
$$;
revoke all on function public.poczta_kolejka_wynik(uuid, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.poczta_kolejka_wynik(uuid, boolean, text, text, text) to service_role;

-- ---------- Pomocnicze ----------

-- Tablica tekstów z jsonb (lista adresów): małe litery, bez pustych i powtórzeń, w kolejności podania.
create or replace function public.poczta_adresy(p jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(a order by n), '{}') from (
    select distinct on (a) a, n from (
      select lower(btrim(x)) a, n from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality e(x, n)) b
    where a <> '' order by a, n) c;
$$;
revoke all on function public.poczta_adresy(jsonb) from public, anon, authenticated;

-- Klucze R2 załączników, do których nic już się nie odwołuje (po usunięciu rozmów albo kopii roboczej).
create or replace function public.poczta_klucze_wolne(p_klucze text[])
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(distinct k), '{}') from unnest(coalesce(p_klucze, '{}')) k
    where k like 'poczta/%'
      and not exists (select 1 from public.poczta_wiadomosci w, jsonb_array_elements(w.zalaczniki) z where z->>'klucz' = k)
      and not exists (select 1 from public.poczta_robocze r, jsonb_array_elements(r.zalaczniki) z where z->>'klucz' = k)
      and not exists (select 1 from public.poczta_kolejka q, jsonb_array_elements(q.zalaczniki) z where z->>'klucz' = k and q.stan in ('czeka', 'wysylanie'));
$$;
revoke all on function public.poczta_klucze_wolne(text[]) from public, anon, authenticated;

-- Załączniki z panelu: [{ nazwa, typ, rozmiar, klucz }] – tylko klucze z prefiksem poczta/, razem najwyżej 10 MB.
create or replace function public.poczta_zalaczniki(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb := '[]';
  z jsonb;
  v_suma bigint := 0;
begin
  for z in select * from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) loop
    if coalesce(z->>'klucz', '') !~ '^poczta/[0-9a-f-]{36}/[^/]+$' then
      raise exception 'Nieprawidłowy załącznik';
    end if;
    v_suma := v_suma + greatest(coalesce((z->>'rozmiar')::bigint, 0), 0);
    v := v || jsonb_build_array(jsonb_build_object('nazwa', left(coalesce(z->>'nazwa', 'zalacznik'), 200), 'typ', left(coalesce(z->>'typ', 'application/octet-stream'), 120),
      'rozmiar', greatest(coalesce((z->>'rozmiar')::bigint, 0), 0), 'klucz', z->>'klucz'));
  end loop;
  if jsonb_array_length(v) > 20 then
    raise exception 'Najwyżej 20 załączników w jednej wiadomości';
  end if;
  if v_suma > 10 * 1024 * 1024 then
    raise exception 'Załączniki razem mają ponad 10 MB – to limit jednej wiadomości';
  end if;
  return v;
end;
$$;
revoke all on function public.poczta_zalaczniki(jsonb) from public, anon, authenticated;

-- ---------- Panel: lista rozmów w folderze ----------

drop function if exists public.admin_poczta_watki(text, text, int, int);
create or replace function public.admin_poczta_watki(p_folder text default 'skrzynka', p_szukaj text default null, p_limit int default 50, p_od int default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_szukaj text := nullif(btrim(coalesce(p_szukaj, '')), '');
  v_wzor text;
  v_folder text := coalesce(p_folder, 'skrzynka');
  v_skrzynka text := (select lower(u.skrzynka_email) from public.poczta_ustawienia u where u.id = 1);
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_od int := greatest(coalesce(p_od, 0), 0);
  v_lista jsonb;
  v_razem int;
begin
  perform public.wymagaj_administratora();
  if v_folder not in ('skrzynka', 'zgloszenia', 'gwiazdka', 'wyslane', 'robocze', 'archiwum', 'spam', 'kosz') then
    raise exception 'Nieznany folder';
  end if;
  v_wzor := '%' || replace(replace(replace(coalesce(v_szukaj, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  if v_folder = 'robocze' then
    select count(*) into v_razem from public.poczta_robocze r
      where v_szukaj is null or r.temat ilike v_wzor or array_to_string(r.do_lista, ' ') ilike v_wzor or r.html ilike v_wzor;
    select coalesce(jsonb_agg(x order by x.ostatnia desc), '[]') into v_lista from (
      select r.id, true as robocza, r.watek, r.tryb, r.temat, r.do_lista, r.zmieniono as ostatnia,
             left(btrim(regexp_replace(regexp_replace(r.html, '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), 160) as zajawka,
             jsonb_array_length(r.zalaczniki) > 0 as zalaczniki
        from public.poczta_robocze r
        where v_szukaj is null or r.temat ilike v_wzor or array_to_string(r.do_lista, ' ') ilike v_wzor or r.html ilike v_wzor
        order by r.zmieniono desc limit v_limit offset v_od) x;
  else
    with wybrane as (
      select t.* from public.poczta_watki t
        where case v_folder
                when 'zgloszenia' then t.zgloszenie is not null and t.folder not in ('spam', 'kosz')
                when 'gwiazdka' then t.gwiazdka and t.folder <> 'kosz'
                when 'wyslane' then t.folder not in ('spam', 'kosz') and exists (select 1 from public.poczta_wiadomosci w where w.watek = t.id and w.kierunek = 'wychodzaca')
                else t.folder = v_folder end
          and (v_szukaj is null or t.temat ilike v_wzor or t.od_email ilike v_wzor or coalesce(t.od_nazwa, '') ilike v_wzor
               or coalesce(t.zgloszenie, '') ilike v_wzor
               or exists (select 1 from public.poczta_wiadomosci w where w.watek = t.id
                            and (w.tekst ilike v_wzor or array_to_string(w.do_lista || w.dw, ' ') ilike v_wzor))))
    select (select count(*) from wybrane),
           coalesce((select jsonb_agg(x order by x.ostatnia desc) from (
             select t.id, t.temat, t.od_email, t.od_nazwa, t.zrodlo, t.folder, t.przeczytany, t.gwiazdka, t.zgloszenie, t.zgloszenie_stan,
                    t.liczba, t.ostatnia,
                    (select left(btrim(regexp_replace(coalesce(w.tekst, regexp_replace(coalesce(w.html, ''), '<[^>]*>', ' ', 'g')), '\s+', ' ', 'g')), 160)
                       from public.poczta_wiadomosci w where w.watek = t.id order by w.utworzono desc limit 1) as zajawka,
                    -- Poczta na inny adres niż skrzynka (np. noreply@, no-reply@) – plakietka „na …” w panelu.
                    (select w.do_email from public.poczta_wiadomosci w
                       where w.watek = t.id and w.kierunek = 'przychodzaca' and lower(w.do_email) <> v_skrzynka
                       order by w.utworzono desc limit 1) as na_adres,
                    -- W „Wysłanych” zamiast nadawcy – adresaci ostatniej naszej wiadomości.
                    (select to_jsonb(w.do_lista) from public.poczta_wiadomosci w
                       where w.watek = t.id and w.kierunek = 'wychodzaca' order by w.utworzono desc limit 1) as do_lista,
                    exists (select 1 from public.poczta_wiadomosci w where w.watek = t.id and jsonb_array_length(w.zalaczniki) > 0) as zalaczniki,
                    (select count(*) from public.poczta_robocze r where r.watek = t.id) as robocze
               from wybrane t order by t.ostatnia desc limit v_limit offset v_od) x), '[]')
      into v_razem, v_lista;
  end if;
  return jsonb_build_object('watki', v_lista, 'razem', v_razem, 'od', v_od, 'limit', v_limit,
    'liczniki', jsonb_build_object(
      'skrzynka', (select count(*) from public.poczta_watki t where t.folder = 'skrzynka' and not t.przeczytany),
      'zgloszenia', (select count(*) from public.poczta_watki t where t.zgloszenie_stan = 'otwarte' and t.folder not in ('spam', 'kosz')),
      'spam', (select count(*) from public.poczta_watki t where t.folder = 'spam' and not t.przeczytany),
      'robocze', (select count(*) from public.poczta_robocze)));
end;
$$;

-- ---------- Panel: rozmowa ----------

create or replace function public.admin_poczta_watek(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.poczta_watki%rowtype;
  u public.poczta_ustawienia%rowtype;
begin
  perform public.wymagaj_administratora();
  select * into u from public.poczta_ustawienia where id = 1;
  update public.poczta_watki set przeczytany = true where id = p_id and not przeczytany;
  select * into t from public.poczta_watki where id = p_id;
  if not found then
    raise exception 'Nie ma takiej rozmowy';
  end if;
  return jsonb_build_object('watek', to_jsonb(t), 'skrzynka', u.skrzynka_email, 'podpis', u.podpis,
    'uzytkownik', (select jsonb_build_object('id', a.id, 'email', a.email) from auth.users a where a.id = t.uzytkownik),
    'wiadomosci', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'kierunek', w.kierunek, 'od_email', w.od_email, 'od_nazwa', w.od_nazwa,
        'do_email', w.do_email, 'do_lista', w.do_lista, 'dw', w.dw, 'udw', w.udw,
        'temat', w.temat, 'tekst', w.tekst, 'html', w.html, 'zalaczniki', w.zalaczniki, 'spam', w.spam, 'utworzono', w.utworzono,
        'stan', (select k.stan from public.poczta_kolejka k where k.id = w.kolejka), 'blad', (select k.blad from public.poczta_kolejka k where k.id = w.kolejka))
        order by w.utworzono)
      from public.poczta_wiadomosci w where w.watek = p_id), '[]'),
    'robocze', coalesce((select jsonb_agg(to_jsonb(r) order by r.zmieniono desc) from public.poczta_robocze r where r.watek = p_id), '[]'));
end;
$$;

-- ---------- Panel: operacje na wielu rozmowach ----------

drop function if exists public.admin_poczta_zmien(uuid, text, boolean);
drop function if exists public.admin_poczta_oproznij_kosz();

-- p_akcja: przeczytane, nieprzeczytane, gwiazdka, bez_gwiazdki, archiwum, spam, kosz, przywroc (do Odebranych albo
-- Wysłanych), usun (na zawsze – tylko z kosza i spamu), zamknij / otworz (zgłoszenie).
-- → { zmienione, klucze: [klucze R2 załączników bez odwołań – aplikacja usuwa je przez Workera] }.
create or replace function public.admin_poczta_zbiorczo(p_ids uuid[], p_akcja text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v int := 0;
  v_klucze text[];
begin
  perform public.wymagaj_administratora();
  if p_akcja = 'przeczytane' then
    update public.poczta_watki set przeczytany = true where id = any (p_ids);
  elsif p_akcja = 'nieprzeczytane' then
    update public.poczta_watki set przeczytany = false where id = any (p_ids);
  elsif p_akcja = 'gwiazdka' then
    update public.poczta_watki set gwiazdka = true where id = any (p_ids);
  elsif p_akcja = 'bez_gwiazdki' then
    update public.poczta_watki set gwiazdka = false where id = any (p_ids);
  elsif p_akcja in ('archiwum', 'spam', 'kosz') then
    update public.poczta_watki set folder = p_akcja, przeczytany = przeczytany or p_akcja = 'kosz' where id = any (p_ids);
  elsif p_akcja = 'przywroc' then
    update public.poczta_watki t set folder = case
        when exists (select 1 from public.poczta_wiadomosci w where w.watek = t.id and w.kierunek = 'przychodzaca') then 'skrzynka'
        else 'wyslane' end
      where id = any (p_ids);
  elsif p_akcja = 'usun' then
    select coalesce(array_agg(z->>'klucz'), '{}') into v_klucze
      from public.poczta_wiadomosci w, jsonb_array_elements(w.zalaczniki) z
      where w.watek in (select t.id from public.poczta_watki t where t.id = any (p_ids) and t.folder in ('kosz', 'spam')) and z ? 'klucz';
    select v_klucze || coalesce(array_agg(z->>'klucz'), '{}') into v_klucze
      from public.poczta_robocze r, jsonb_array_elements(r.zalaczniki) z
      where r.watek in (select t.id from public.poczta_watki t where t.id = any (p_ids) and t.folder in ('kosz', 'spam')) and z ? 'klucz';
    delete from public.poczta_watki where id = any (p_ids) and folder in ('kosz', 'spam');
    get diagnostics v = row_count;
    return jsonb_build_object('zmienione', v, 'klucze', to_jsonb(public.poczta_klucze_wolne(v_klucze)));
  elsif p_akcja in ('zamknij', 'otworz') then
    update public.poczta_watki set zgloszenie_stan = case when p_akcja = 'zamknij' then 'zamkniete' else 'otwarte' end
      where id = any (p_ids) and zgloszenie is not null;
  else
    raise exception 'Nieznana operacja';
  end if;
  get diagnostics v = row_count;
  return jsonb_build_object('zmienione', v, 'klucze', '[]'::jsonb);
end;
$$;

-- Opróżnienie kosza albo spamu – wszystko naraz.
create or replace function public.admin_poczta_oproznij(p_folder text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.wymagaj_administratora();
  if p_folder not in ('kosz', 'spam') then
    raise exception 'Opróżnić można tylko kosz albo spam';
  end if;
  return public.admin_poczta_zbiorczo(array(select t.id from public.poczta_watki t where t.folder = p_folder), 'usun');
end;
$$;

-- ---------- Panel: kopie robocze ----------

-- p jsonb: { id?, watek?, odpowiedz_na?, tryb, do: [], dw: [], udw: [], temat, html, zalaczniki: [] } → { id, zmieniono }.
create or replace function public.admin_poczta_robocza_zapisz(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_tryb text := coalesce(nullif(p->>'tryb', ''), 'nowa');
  r public.poczta_robocze%rowtype;
begin
  perform public.wymagaj_administratora();
  if v_tryb not in ('nowa', 'odpowiedz', 'wszystkim', 'przekaz') then
    raise exception 'Nieznany rodzaj wiadomości';
  end if;
  if length(coalesce(p->>'html', '')) > 400000 then
    raise exception 'Wiadomość jest za długa';
  end if;
  insert into public.poczta_robocze as d (id, watek, odpowiedz_na, tryb, do_lista, dw, udw, temat, html, zalaczniki)
    values (coalesce(v_id, gen_random_uuid()),
            (select t.id from public.poczta_watki t where t.id = nullif(p->>'watek', '')::uuid),
            (select w.id from public.poczta_wiadomosci w where w.id = nullif(p->>'odpowiedz_na', '')::uuid),
            v_tryb, public.poczta_adresy(p->'do'), public.poczta_adresy(p->'dw'), public.poczta_adresy(p->'udw'),
            left(coalesce(p->>'temat', ''), 300), coalesce(p->>'html', ''), public.poczta_zalaczniki(p->'zalaczniki'))
    on conflict (id) do update set do_lista = excluded.do_lista, dw = excluded.dw, udw = excluded.udw, temat = excluded.temat,
      html = excluded.html, zalaczniki = excluded.zalaczniki, zmieniono = now()
    returning * into r;
  return jsonb_build_object('id', r.id, 'zmieniono', r.zmieniono);
end;
$$;

-- → { usunieta, klucze: [klucze R2 załączników bez odwołań] }.
create or replace function public.admin_poczta_robocza_usun(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_klucze text[];
begin
  perform public.wymagaj_administratora();
  delete from public.poczta_robocze where id = p_id
    returning coalesce((select array_agg(z->>'klucz') from jsonb_array_elements(zalaczniki) z), '{}') into v_klucze;
  return jsonb_build_object('usunieta', v_klucze is not null, 'klucze', to_jsonb(public.poczta_klucze_wolne(v_klucze)));
end;
$$;

create or replace function public.admin_poczta_robocza(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.poczta_robocze%rowtype;
begin
  perform public.wymagaj_administratora();
  select * into r from public.poczta_robocze where id = p_id;
  if not found then
    raise exception 'Nie ma takiej kopii roboczej';
  end if;
  return to_jsonb(r);
end;
$$;

-- ---------- Panel: wysyłka (nowa, odpowiedź, odpowiedź wszystkim, przekazanie) ----------

drop function if exists public.admin_poczta_odpowiedz(uuid, text);

-- p jsonb: { robocza?, watek?, odpowiedz_na?, tryb, do: [], dw: [], udw: [], temat, html, tekst, zalaczniki: [] }.
-- Wiadomość trafia do rozmowy (nowa – nowa rozmowa w „Wysłanych”) i do kolejki: z adresu skrzynki, przy odpowiedzi
-- z In-Reply-To i References. Kopia robocza znika. → { ok, watek, wiadomosc, kolejka }.
create or replace function public.admin_poczta_wyslij(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.poczta_ustawienia%rowtype;
  t public.poczta_watki%rowtype;
  v_tryb text := coalesce(nullif(p->>'tryb', ''), 'nowa');
  v_do text[] := public.poczta_adresy(p->'do');
  v_dw text[] := public.poczta_adresy(p->'dw');
  v_udw text[] := public.poczta_adresy(p->'udw');
  v_temat text := left(btrim(coalesce(p->>'temat', '')), 300);
  v_html text := coalesce(p->>'html', '');
  v_tekst text := left(coalesce(p->>'tekst', ''), 200000);
  v_zal jsonb := public.poczta_zalaczniki(p->'zalaczniki');
  v_na public.poczta_wiadomosci%rowtype;
  v_ref text[];
  v_naglowki jsonb := '{}';
  v_wiad uuid;
  v_kol uuid;
  a text;
begin
  perform public.wymagaj_administratora();
  select * into u from public.poczta_ustawienia where id = 1;
  if v_tryb not in ('nowa', 'odpowiedz', 'wszystkim', 'przekaz') then
    raise exception 'Nieznany rodzaj wiadomości';
  end if;
  if coalesce(array_length(v_do, 1), 0) = 0 then
    raise exception 'Podaj co najmniej jednego adresata w polu „Do”';
  end if;
  foreach a in array v_do || v_dw || v_udw loop
    if a !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$' then
      raise exception 'Nieprawidłowy adres: %', a;
    end if;
  end loop;
  if coalesce(array_length(v_do || v_dw || v_udw, 1), 0) > 50 then
    raise exception 'Najwyżej 50 adresatów w jednej wiadomości';
  end if;
  if btrim(v_tekst) = '' and btrim(regexp_replace(v_html, '<[^>]*>', '', 'g')) = '' and jsonb_array_length(v_zal) = 0 then
    raise exception 'Wiadomość jest pusta';
  end if;
  if length(v_html) > 400000 then
    raise exception 'Wiadomość jest za długa';
  end if;
  if v_temat = '' then
    v_temat := '(bez tematu)';
  end if;

  if nullif(p->>'watek', '') is not null then
    select * into t from public.poczta_watki where id = (p->>'watek')::uuid for update;
    if not found then
      raise exception 'Nie ma takiej rozmowy';
    end if;
  end if;
  if nullif(p->>'odpowiedz_na', '') is not null then
    select * into v_na from public.poczta_wiadomosci where id = (p->>'odpowiedz_na')::uuid;
  end if;
  -- Odpowiedź: In-Reply-To – wiadomość, na którą odpowiadamy; References – ostatnie identyfikatory rozmowy.
  if t.id is not null and v_tryb in ('odpowiedz', 'wszystkim') then
    select coalesce(array_agg(m order by n), '{}') into v_ref from (
      select distinct on (m) m, n from (
        select w.message_id m, w.utworzono n from public.poczta_wiadomosci w where w.watek = t.id and w.message_id is not null) a1 order by m, n) b;
    v_naglowki := jsonb_strip_nulls(jsonb_build_object('In-Reply-To', coalesce(v_na.message_id, (
        select w.message_id from public.poczta_wiadomosci w where w.watek = t.id and w.message_id is not null order by w.utworzono desc limit 1)),
      'References', nullif(array_to_string(v_ref[greatest(coalesce(array_length(v_ref, 1), 0) - 9, 1):], ' '), '')));
  end if;
  -- Zgłoszenie: numer w temacie – odpowiedź klienta wróci do tej rozmowy także bez nagłówków.
  if t.zgloszenie is not null and position(t.zgloszenie in v_temat) = 0 then
    v_temat := left(v_temat || ' [' || t.zgloszenie || ']', 300);
  end if;

  if t.id is null then
    insert into public.poczta_watki (temat, od_email, zrodlo, folder, przeczytany, liczba)
      values (v_temat, v_do[1], 'nowa', 'wyslane', true, 0)
      returning * into t;
  end if;

  insert into public.poczta_kolejka (rodzaj, do_email, do_lista, dw, udw, szablon, dane, temat, naglowki, od_skrzynki, priorytet, zalaczniki, utworzyl)
    values (case when v_tryb in ('odpowiedz', 'wszystkim') then 'odpowiedz' else 'wiadomosc' end, v_do[1], v_do, v_dw, v_udw, 'wiadomosc',
            jsonb_build_object('html', v_html, 'tekst', v_tekst), v_temat, v_naglowki, true, 1, v_zal, auth.uid())
    returning id into v_kol;
  insert into public.poczta_wiadomosci (watek, kierunek, od_email, od_nazwa, do_email, do_lista, dw, udw, temat, tekst, html,
                                        in_reply_to, referencje, zalaczniki, kolejka)
    values (t.id, 'wychodzaca', u.skrzynka_email, u.nadawca_nazwa, v_do[1], v_do, v_dw, v_udw, v_temat, v_tekst, v_html,
            v_naglowki->>'In-Reply-To', coalesce(v_ref, '{}'), v_zal, v_kol)
    returning id into v_wiad;
  update public.poczta_kolejka set dane = dane || jsonb_build_object('wiadomosc', v_wiad) where id = v_kol;
  update public.poczta_watki set liczba = liczba + 1, ostatnia = now(), przeczytany = true,
    folder = case when folder in ('spam', 'kosz') then 'skrzynka' else folder end
    where id = t.id;
  if nullif(p->>'robocza', '') is not null then
    delete from public.poczta_robocze where id = (p->>'robocza')::uuid;
  end if;
  return jsonb_build_object('ok', true, 'watek', t.id, 'wiadomosc', v_wiad, 'kolejka', v_kol);
end;
$$;

-- ---------- Panel: podpowiedzi adresów ----------

-- Adresy z poczty (nadawcy i adresaci) i konta aplikacji – do pól Do/DW/UDW. → [{ email, nazwa }].
create or replace function public.admin_poczta_adresy(p_szukaj text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := lower(btrim(coalesce(p_szukaj, '')));
  v_wzor text;
begin
  perform public.wymagaj_administratora();
  if length(v) < 1 then
    return '[]'::jsonb;
  end if;
  v_wzor := replace(replace(replace(v, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((select jsonb_agg(jsonb_build_object('email', x.email, 'nazwa', x.nazwa) order by x.waga, x.ostatnio desc nulls last, x.email) from (
    select distinct on (a.email) a.email, a.nazwa, a.waga, a.ostatnio from (
      select lower(w.od_email) email, w.od_nazwa nazwa, 0 waga, w.utworzono ostatnio from public.poczta_wiadomosci w where w.kierunek = 'przychodzaca'
      union all
      select lower(x1), null, 0, w.utworzono from public.poczta_wiadomosci w, unnest(w.do_lista || w.dw || w.udw) x1 where w.kierunek = 'wychodzaca'
      union all
      select lower(au.email), p.nazwa, 1, au.last_sign_in_at from auth.users au left join public.profile p on p.id = au.id
        where au.email is not null and au.email not ilike '%@example.com'
    ) a
    where a.email is not null and a.email <> (select lower(u.skrzynka_email) from public.poczta_ustawienia u where u.id = 1)
      and (a.email like v_wzor or a.email like '%.' || v_wzor or lower(coalesce(a.nazwa, '')) like v_wzor or lower(coalesce(a.nazwa, '')) like '% ' || v_wzor)
    order by a.email, a.waga, a.ostatnio desc nulls last) x
    limit 8), '[]'::jsonb);
end;
$$;

-- ---------- Ustawienia poczty: podpis ----------

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
    podpis = coalesce(left(u->>'podpis', 2000), podpis),
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

-- ---------- Statystyki bez kont testowych ----------

-- Konta testowe (seriodruk-test-…@example.com, makietka-test-…@example.com – cała domena example.com) nie liczą się
-- do kont, projektów, współdzielenia ani zaproszeń.
create or replace function public.konto_testowe(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(lower(p_email) like '%@example.com', false);
$$;
revoke all on function public.konto_testowe(text) from public, anon, authenticated;

create or replace function public.admin_statystyki(p_dni int default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dni int := least(greatest(coalesce(p_dni, 30), 7), 180);
  v_od date := current_date - (v_dni - 1);
begin
  perform public.wymagaj_administratora();
  return jsonb_build_object(
    'dni', v_dni,
    'konta', jsonb_build_object(
      'razem', (select count(*) from auth.users u where not public.konto_testowe(u.email)),
      'aktywne_7', (select count(*) from auth.users u where not public.konto_testowe(u.email) and u.last_sign_in_at > now() - interval '7 days'),
      'aktywne_30', (select count(*) from auth.users u where not public.konto_testowe(u.email) and u.last_sign_in_at > now() - interval '30 days'),
      'nowe_7', (select count(*) from auth.users u where not public.konto_testowe(u.email) and u.created_at > now() - interval '7 days')),
    'projekty', jsonb_build_object(
      'razem', (select count(*) from public.projekty p where p.owner_id in (select k.id from auth.users k where not public.konto_testowe(k.email))),
      'zmienione_7', (select count(*) from public.projekty p where p.zmieniono > now() - interval '7 days' and p.owner_id in (select k.id from auth.users k where not public.konto_testowe(k.email))),
      'wspoldzielone', (select count(distinct w.projekt_id) from public.wspolpracownicy w join public.projekty p on p.id = w.projekt_id
                          where p.owner_id in (select k.id from auth.users k where not public.konto_testowe(k.email)))),
    'zaproszenia', jsonb_build_object(
      'razem', (select count(*) from public.zaproszenia z where not public.konto_testowe(z.email)),
      'przyjete', (select count(*) from public.zaproszenia z where z.stan = 'przyjete' and not public.konto_testowe(z.email)),
      'czekajace', (select count(*) from public.zaproszenia z where z.stan = 'czeka' and z.wazne_do > now() and not public.konto_testowe(z.email))),
    'maile', jsonb_build_object(
      'wyslane_dzis', (select count(*) from public.poczta_kolejka k where k.wyslano >= current_date and not public.konto_testowe(k.do_email)),
      'wyslane_30', (select count(*) from public.poczta_kolejka k where k.wyslano > now() - interval '30 days' and not public.konto_testowe(k.do_email)),
      'bledy', (select count(*) from public.poczta_kolejka k where k.stan = 'blad'),
      'w_kolejce', (select count(*) from public.poczta_kolejka k where k.stan in ('czeka', 'wysylanie'))),
    'skrzynka', jsonb_build_object(
      'nieprzeczytane', (select count(*) from public.poczta_watki t where t.folder = 'skrzynka' and not t.przeczytany),
      'rozmowy_30', (select count(*) from public.poczta_watki t where t.utworzono > now() - interval '30 days')),
    'serie', jsonb_build_object(
      'konta', (select jsonb_agg(jsonb_build_object('dzien', d, 'ile', (select count(*) from auth.users u where not public.konto_testowe(u.email) and u.created_at::date = d)) order by d)
                  from generate_series(v_od, current_date, interval '1 day') g(d0), lateral (select g.d0::date d) x),
      'projekty', (select jsonb_agg(jsonb_build_object('dzien', d, 'ile', (select count(*) from public.projekty p
                     where p.utworzono::date = d and p.owner_id in (select k.id from auth.users k where not public.konto_testowe(k.email)))) order by d)
                  from generate_series(v_od, current_date, interval '1 day') g(d0), lateral (select g.d0::date d) x),
      'maile', (select jsonb_agg(jsonb_build_object('dzien', d, 'ile', (select count(*) from public.poczta_kolejka k
                  where k.wyslano::date = d and not public.konto_testowe(k.do_email))) order by d)
                  from generate_series(v_od, current_date, interval '1 day') g(d0), lateral (select g.d0::date d) x)));
end;
$$;

-- ---------- Uprawnienia funkcji panelu ----------

do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_poczta_watki(text, text, int, int)', 'admin_poczta_watek(uuid)', 'admin_poczta_zbiorczo(uuid[], text)',
    'admin_poczta_oproznij(text)', 'admin_poczta_robocza_zapisz(jsonb)', 'admin_poczta_robocza_usun(uuid)',
    'admin_poczta_robocza(uuid)', 'admin_poczta_wyslij(jsonb)', 'admin_poczta_adresy(text)', 'admin_poczta_zapisz(jsonb)',
    'admin_statystyki(int)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- ---------- Realtime: zmiany w skrzynce na żywo – tylko administrator ----------

-- Odczyt tabeli rozmów (bez treści – same znaczniki) wyłącznie dla administratora; z niej Realtime rozsyła zmiany.
grant select on table public.poczta_watki to authenticated;
drop policy if exists poczta_watki_administrator on public.poczta_watki;
create policy poczta_watki_administrator on public.poczta_watki for select to authenticated using (public.czy_administrator());

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poczta_watki') then
    alter publication supabase_realtime add table public.poczta_watki;
  end if;
end;
$$;

-- Odpowiedzi z dawnego panelu, które jeszcze czekają w kolejce – szablon „wiadomosc” (sam tekst).
update public.poczta_kolejka set szablon = 'wiadomosc', dane = dane || jsonb_build_object('tekst', dane->>'tresc')
  where szablon = 'odpowiedz' and stan in ('czeka', 'wysylanie', 'blad');
