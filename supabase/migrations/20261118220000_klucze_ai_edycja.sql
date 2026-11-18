-- Klucze AI w ustawieniach konta (#248): trzy sekcje (czat w Makietce, łącznik w aplikacji AI, zwykły czat) z kluczami
-- do edycji – zakres (zmien_dostep_ai), czas ważności (zmien_waznosc_ai) i ponowne pokazanie klucza. Klucza nie da się
-- odczytać z bazy (leży tu tylko skrót); „Pokaż klucz” bierze go z sejfu użytkownika (sejf_kluczy_ai), zaszyfrowanego
-- w przeglądarce hasłem do kluczy – baza i twórca Makietki go nie widzą.

alter table public.dostepy_projektu add column if not exists sposob text
  check (sposob is null or sposob in ('lacznik', 'zwykly', 'czat'));

-- Sekcja, w której pokazujemy klucz. Ustawiana przez aplikację zaraz po utworzeniu.
create or replace function public.oznacz_dostep_ai(p_id uuid, p_sposob text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Brak sesji'; end if;
  if p_sposob not in ('lacznik', 'zwykly', 'czat') then raise exception 'Nieznany rodzaj klucza'; end if;
  update public.dostepy_projektu set sposob = p_sposob where id = p_id and owner_id = auth.uid() and rodzaj = 'klucz';
  if not found then raise exception 'Nie ma takiego klucza na tym koncie'; end if;
end; $$;
revoke all on function public.oznacz_dostep_ai(uuid, text) from public, anon;
grant execute on function public.oznacz_dostep_ai(uuid, text) to authenticated;

-- Nowy czas ważności liczony od teraz (p_dni null – bez terminu). Działa też dla klucza, który już wygasł;
-- odebranego klucza nie wskrzesza.
create or replace function public.zmien_waznosc_ai(p_id uuid, p_dni integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_do timestamptz;
begin
  if auth.uid() is null then raise exception 'Brak sesji'; end if;
  if p_dni is not null and (p_dni < 1 or p_dni > 365) then raise exception 'Ważność klucza: od 1 do 365 dni albo bez terminu'; end if;
  v_do := case when p_dni is null then 'infinity'::timestamptz else now() + make_interval(days => p_dni) end;
  update public.dostepy_projektu set wazny_do = v_do
   where id = p_id and owner_id = auth.uid() and rodzaj = 'klucz' and odwolany is null;
  if not found then raise exception 'Nie ma takiego klucza na tym koncie (albo został odebrany)'; end if;
  return jsonb_build_object('wazny_do', case when p_dni is null then null else to_jsonb(v_do) end);
end; $$;
revoke all on function public.zmien_waznosc_ai(uuid, integer) from public, anon;
grant execute on function public.zmien_waznosc_ai(uuid, integer) to authenticated;

-- Lista kluczy – jak dotąd, plus sposob (null dla starszych kluczy: aplikacja zgaduje z opisu).
create or replace function public.dostepy_ai()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'opis', d.opis, 'rola', d.rola, 'zakres', d.zakres, 'sposob', d.sposob,
    'wazny_do', case when d.wazny_do = 'infinity'::timestamptz then null else to_jsonb(d.wazny_do) end,
    'utworzono', d.utworzono, 'ostatnie_uzycie', d.ostatnie_uzycie, 'odwolany', d.odwolany,
    'aktywny', d.odwolany is null and d.wazny_do > now(),
    'projekty', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nazwa', p.nazwa) order by p.nazwa)
                          from public.projekty p where p.id = any(d.projekty)
                            and public.ai_rola_konta(d.owner_id, p.id) is not null), '[]'::jsonb)
  ) order by d.utworzono desc), '[]'::jsonb)
  from public.dostepy_projektu d
  where d.owner_id = auth.uid() and d.rodzaj = 'klucz';
$$;
revoke all on function public.dostepy_ai() from public, anon;
grant execute on function public.dostepy_ai() to authenticated;
