-- Sejf kluczy AI (#241): klucze API dostawców AI (Anthropic, OpenAI, OpenRouter…) wklejone przez użytkownika,
-- zaszyfrowane W PRZEGLĄDARCE hasłem do kluczy, które zna tylko użytkownik (PBKDF2-SHA256 → AES-GCM 256).
-- Baza trzyma wyłącznie szyfrogram, sól i zaszyfrowany zapis kontrolny – bez hasła nikt (także twórca Makietki
-- z pełnym dostępem do bazy) nie odczyta kluczy. Jeden wiersz na konto, widoczny tylko dla właściciela.
-- Klucze dostępu dla AI (sdk_…) były i są tylko skrótami z solą (migracja dostep_ai) – ich też nie da się odczytać.

create table if not exists public.sejf_kluczy_ai (
  wlasciciel uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sol text not null check (length(sol) between 16 and 64),
  kontrolny jsonb not null,                -- { iv, szyfr } zaszyfrowanego znanego tekstu – sprawdzenie hasła
  klucze jsonb not null default '{}'::jsonb, -- { dostawca: { iv, szyfr } }
  zmieniono timestamptz not null default now(),
  check (octet_length(klucze::text) < 65536)
);
alter table public.sejf_kluczy_ai enable row level security;

drop policy if exists sejf_wlasny on public.sejf_kluczy_ai;
create policy sejf_wlasny on public.sejf_kluczy_ai
  for all to authenticated
  using (wlasciciel = auth.uid())
  with check (wlasciciel = auth.uid());

-- Odczyt i zapis przez funkcje – jeden kształt dla aplikacji (i atrapy w testach).
create or replace function public.sejf_ai_pobierz()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object('sol', sol, 'kontrolny', kontrolny, 'klucze', klucze, 'zmieniono', zmieniono)
  from public.sejf_kluczy_ai where wlasciciel = auth.uid();
$$;

create or replace function public.sejf_ai_zapisz(p_sol text, p_kontrolny jsonb, p_klucze jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Zaloguj się.'; end if;
  insert into public.sejf_kluczy_ai (wlasciciel, sol, kontrolny, klucze, zmieniono)
  values (auth.uid(), p_sol, p_kontrolny, coalesce(p_klucze, '{}'::jsonb), now())
  on conflict (wlasciciel) do update set sol = excluded.sol, kontrolny = excluded.kontrolny, klucze = excluded.klucze, zmieniono = now();
end;
$$;

create or replace function public.sejf_ai_usun()
returns void language sql security invoker set search_path = public as $$
  delete from public.sejf_kluczy_ai where wlasciciel = auth.uid();
$$;

revoke all on function public.sejf_ai_pobierz() from public, anon;
revoke all on function public.sejf_ai_zapisz(text, jsonb, jsonb) from public, anon;
revoke all on function public.sejf_ai_usun() from public, anon;
grant execute on function public.sejf_ai_pobierz() to authenticated;
grant execute on function public.sejf_ai_zapisz(text, jsonb, jsonb) to authenticated;
grant execute on function public.sejf_ai_usun() to authenticated;
