-- Łącznik z logowaniem (#244): OAuth 2.1 dla aplikacji AI (Claude, ChatGPT i inne klienty MCP).
-- Przebieg: aplikacja AI rejestruje się (oauth_rejestruj – Dynamic Client Registration), wysyła użytkownika na
-- …/mcp/oauth/authorize (oauth_rozpocznij zapisuje żądanie z PKCE), Makietka pokazuje stronę zgody (oauth_zadanie)
-- i po „Zezwól” (oauth_zatwierdz – zalogowany użytkownik) tworzy zwykły klucz dostępu AI z wybranym zakresem
-- (utworz_dostep_ai) i jednorazowy kod. Aplikacja AI wymienia kod z code_verifier na token (oauth_wymien) – tokenem
-- jest ten klucz (Authorization: Bearer sdk_…), widoczny i do odebrania w ustawieniach konta jak każdy inny.
-- Kod żyje 5 minut i działa raz; klucz w wierszu kodu leży tylko do wymiany (potem wiersz znika).

create table if not exists public.oauth_klienci (
  id text primary key,
  nazwa text not null,
  adresy_powrotu text[] not null,
  utworzono timestamptz not null default now()
);
create table if not exists public.oauth_zadania (
  id text primary key,
  klient text not null references public.oauth_klienci (id) on delete cascade,
  adres_powrotu text not null,
  wyzwanie text not null,
  stan text,
  utworzono timestamptz not null default now()
);
create table if not exists public.oauth_kody (
  kod_skrot text primary key,
  zadanie text not null,
  klient text not null,
  adres_powrotu text not null,
  wyzwanie text not null,
  klucz text not null,
  wazny_do timestamptz,
  utworzono timestamptz not null default now()
);
alter table public.oauth_klienci enable row level security;
alter table public.oauth_zadania enable row level security;
alter table public.oauth_kody enable row level security;
-- Bez polityk: tabele tylko przez funkcje poniżej.

create or replace function public.oauth_rejestruj(p_nazwa text, p_adresy text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  if coalesce(cardinality(p_adresy), 0) = 0 or cardinality(p_adresy) > 10 then raise exception 'Podaj od 1 do 10 adresów powrotu (redirect_uris)'; end if;
  if exists (select 1 from unnest(p_adresy) a where a !~ '^(https://[^ ]+|http://(localhost|127\.0\.0\.1)(:[0-9]+)?/[^ ]*)$') then
    raise exception 'Adres powrotu musi być https (albo http://localhost)';
  end if;
  if (select count(*) from public.oauth_klienci where utworzono > now() - interval '1 hour') > 200 then raise exception 'Za dużo rejestracji – spróbuj później'; end if;
  v_id := 'mk_' || encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.oauth_klienci (id, nazwa, adresy_powrotu) values (v_id, left(coalesce(nullif(trim(p_nazwa), ''), 'Aplikacja AI'), 80), p_adresy);
  return jsonb_build_object('client_id', v_id, 'client_name', left(coalesce(nullif(trim(p_nazwa), ''), 'Aplikacja AI'), 80), 'redirect_uris', to_jsonb(p_adresy));
end; $$;

create or replace function public.oauth_rozpocznij(p_klient text, p_adres text, p_wyzwanie text, p_stan text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  if not exists (select 1 from public.oauth_klienci k where k.id = p_klient and p_adres = any (k.adresy_powrotu)) then
    raise exception 'Nieznana aplikacja albo adres powrotu';
  end if;
  if coalesce(length(p_wyzwanie), 0) < 43 or length(p_wyzwanie) > 128 then raise exception 'Brak PKCE (code_challenge S256)'; end if;
  delete from public.oauth_zadania where utworzono < now() - interval '30 minutes';
  v_id := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.oauth_zadania (id, klient, adres_powrotu, wyzwanie, stan) values (v_id, p_klient, p_adres, p_wyzwanie, left(p_stan, 500));
  return v_id;
end; $$;

-- Dla strony zgody: nazwa aplikacji i host powrotu (bez sekretów).
create or replace function public.oauth_zadanie(p_id text)
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object('klient', k.nazwa, 'host', substring(z.adres_powrotu from '^[a-z]+://([^/:]+)'))
  from public.oauth_zadania z join public.oauth_klienci k on k.id = z.klient
  where z.id = p_id and z.utworzono > now() - interval '30 minutes';
$$;

-- Zgoda zalogowanego użytkownika: klucz dostępu z wybranym zakresem + jednorazowy kod. Zwraca adres powrotu z kodem.
create or replace function public.oauth_zatwierdz(p_id text, p_rola text, p_dni integer, p_zakres text, p_projekty uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare z record; v_klucz jsonb; v_kod text; v_nazwa text;
begin
  if auth.uid() is null then raise exception 'Brak sesji'; end if;
  select * into z from public.oauth_zadania where id = p_id and utworzono > now() - interval '30 minutes';
  if not found then raise exception 'Prośba o połączenie wygasła – zacznij łączenie od nowa w aplikacji AI'; end if;
  select nazwa into v_nazwa from public.oauth_klienci where id = z.klient;
  v_klucz := public.utworz_dostep_ai(left('Łącznik: ' || v_nazwa, 120), p_rola, p_dni, p_zakres, p_projekty);
  v_kod := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  insert into public.oauth_kody (kod_skrot, zadanie, klient, adres_powrotu, wyzwanie, klucz, wazny_do)
  values (encode(extensions.digest(v_kod, 'sha256'), 'hex'), z.id, z.klient, z.adres_powrotu, z.wyzwanie, v_klucz->>'klucz', (v_klucz->>'wazny_do')::timestamptz);
  delete from public.oauth_zadania where id = z.id;
  return jsonb_build_object('adres', z.adres_powrotu || case when position('?' in z.adres_powrotu) > 0 then '&' else '?' end
    || 'code=' || v_kod || coalesce('&state=' || replace(replace(replace(z.stan, '%', '%25'), '&', '%26'), '#', '%23'), ''));
end; $$;

-- Wymiana kodu na token (aplikacja AI, bez sesji użytkownika): PKCE S256, ten sam klient i adres powrotu.
create or replace function public.oauth_wymien(p_kod text, p_weryfikator text, p_klient text, p_adres text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k record;
begin
  delete from public.oauth_kody where utworzono < now() - interval '5 minutes';
  delete from public.oauth_kody where kod_skrot = encode(extensions.digest(coalesce(p_kod, ''), 'sha256'), 'hex') returning * into k;
  if not found then raise exception 'invalid_grant'; end if;
  if k.klient <> p_klient or k.adres_powrotu <> p_adres then raise exception 'invalid_grant'; end if;
  if translate(rtrim(encode(extensions.digest(coalesce(p_weryfikator, ''), 'sha256'), 'base64'), '='), '+/', '-_') <> k.wyzwanie then raise exception 'invalid_grant'; end if;
  return jsonb_build_object('klucz', k.klucz, 'wazny_do', k.wazny_do);
end; $$;

revoke all on function public.oauth_rejestruj(text, text[]) from public;
revoke all on function public.oauth_rozpocznij(text, text, text, text) from public;
revoke all on function public.oauth_zadanie(text) from public;
revoke all on function public.oauth_zatwierdz(text, text, integer, text, uuid[]) from public, anon;
revoke all on function public.oauth_wymien(text, text, text, text) from public;
grant execute on function public.oauth_rejestruj(text, text[]) to anon, authenticated;
grant execute on function public.oauth_rozpocznij(text, text, text, text) to anon, authenticated;
grant execute on function public.oauth_zadanie(text) to anon, authenticated;
grant execute on function public.oauth_zatwierdz(text, text, integer, text, uuid[]) to authenticated;
grant execute on function public.oauth_wymien(text, text, text, text) to anon, authenticated;

-- Odmowa na stronie zgody: adres powrotu z error=access_denied (aplikacja AI pokaże, że użytkownik odmówił).
create or replace function public.oauth_odmow(p_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare z record;
begin
  delete from public.oauth_zadania where id = p_id returning * into z;
  if not found then return null; end if;
  return jsonb_build_object('adres', z.adres_powrotu || case when position('?' in z.adres_powrotu) > 0 then '&' else '?' end
    || 'error=access_denied' || coalesce('&state=' || replace(replace(replace(z.stan, '%', '%25'), '&', '%26'), '#', '%23'), ''));
end; $$;
revoke all on function public.oauth_odmow(text) from public;
grant execute on function public.oauth_odmow(text) to anon, authenticated;
