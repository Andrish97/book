-- Drobniejsze zakresy kluczy AI (#252, plan AI krok 2). Obok „czyta” / „czyta i zmienia” klucz może nie pozwalać na:
--   strony  – dodawanie, usuwanie i przestawianie stron (oraz zmianę sekcji),
--   wzorce  – zmianę wzorców i stylów,
--   tabele  – zmianę tabel danych i serii,
--   obrazy  – wgrywanie, wymianę i usuwanie obrazów,
--   eksport – zlecanie plików PDF / PNG.
-- uprawnienia = null – wszystko (jak dotąd; także klucze z logowania OAuth). Pilnuje baza: funkcje ai_* dostępne
-- dla kluczy są opakowane sprawdzeniem zakresu, więc AI nie obejdzie go, wołając bazę z pominięciem łącznika.
-- Uwaga dla przyszłych migracji: ai_zapisz, ai_wgraj_obraz, ai_wgraj_poczatek, ai_zmien_obrazy i ai_zlec_eksport są
-- teraz opakowaniami – zmiany logiki robi się w funkcjach *_bez_zakresu.

alter table public.dostepy_projektu add column if not exists uprawnienia text[]
  check (uprawnienia is null or uprawnienia <@ array['strony', 'wzorce', 'tabele', 'obrazy', 'eksport']);

create or replace function public.ai_klucz(p_klucz text, p_licz boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m text[];
  d public.dostepy_projektu%rowtype;
begin
  m := regexp_match(coalesce(p_klucz, ''), '^sdk_([0-9a-f]{32})_([A-Za-z0-9_-]{20,100})(?:/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}))?$');
  if m is null then
    return jsonb_build_object('blad', 'Nieprawidłowy klucz dostępu.');
  end if;
  if p_licz then
    select * into d from public.dostepy_projektu where id = m[1]::uuid and rodzaj = 'klucz' for update;
  else
    select * into d from public.dostepy_projektu where id = m[1]::uuid and rodzaj = 'klucz';
  end if;
  if not found then
    return jsonb_build_object('blad', 'Nieprawidłowy klucz dostępu.');
  end if;
  if d.blokada_do is not null and d.blokada_do > now() then
    return jsonb_build_object('blad', 'Klucz jest chwilowo zablokowany po wielu złych próbach. Spróbuj za kilkanaście minut.');
  end if;
  if encode(extensions.digest(m[2] || d.klucz_sol, 'sha256'), 'hex') <> d.klucz_skrot then
    update public.dostepy_projektu
       set nieudane = nieudane + 1,
           blokada_do = case when nieudane + 1 >= 10 then now() + interval '15 minutes' else blokada_do end
     where id = d.id;
    return jsonb_build_object('blad', 'Nieprawidłowy klucz dostępu.');
  end if;
  if d.odwolany is not null then
    return jsonb_build_object('blad', 'Klucz został odebrany w ustawieniach konta.');
  end if;
  if d.wazny_do <= now() then
    return jsonb_build_object('blad', 'Klucz dostępu wygasł. Utwórz nowy w ustawieniach konta (Dostęp dla AI).');
  end if;
  if p_licz then
    if d.okno_od is null or d.okno_od < now() - interval '1 minute' then
      d.okno_od := now();
      d.okno_ile := 1;
    else
      d.okno_ile := d.okno_ile + 1;
    end if;
    update public.dostepy_projektu
       set okno_od = d.okno_od, okno_ile = d.okno_ile, nieudane = 0, blokada_do = null, ostatnie_uzycie = now()
     where id = d.id;
    if d.okno_ile > 120 then
      return jsonb_build_object('blad', 'Za dużo zapytań – poczekaj minutę.');
    end if;
  end if;
  return jsonb_build_object('id', d.id, 'owner_id', d.owner_id, 'rola', d.rola, 'zakres', d.zakres,
                            'projekty', to_jsonb(d.projekty), 'opis', d.opis, 'wazny_do', d.wazny_do,
                            'projekt', m[3], 'uprawnienia', to_jsonb(d.uprawnienia));
end;
$$;

revoke all on function public.ai_klucz(text, boolean) from public, anon, authenticated;

-- null – wolno; inaczej { blad } z wyjaśnieniem. Zły klucz – null (błąd zwróci sama funkcja).
create or replace function public.ai_zakres_brak(p_klucz text, p_co text)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare m text[]; d public.dostepy_projektu%rowtype;
begin
  -- Bez liczenia prób i blokad (robi to właściwa funkcja): tylko odczyt zakresu ważnego klucza.
  m := regexp_match(coalesce(p_klucz, ''), '^sdk_([0-9a-f]{32})_([A-Za-z0-9_-]{20,100})(?:/[0-9a-fA-F-]{36})?$');
  if m is null then return null; end if;
  select * into d from public.dostepy_projektu where id = m[1]::uuid and rodzaj = 'klucz';
  if not found or encode(extensions.digest(m[2] || d.klucz_sol, 'sha256'), 'hex') <> d.klucz_skrot
     or d.uprawnienia is null or p_co = any (d.uprawnienia) then
    return null;
  end if;
  return jsonb_build_object('blad', case p_co
    when 'strony' then 'Ten klucz nie pozwala dodawać, usuwać ani przestawiać stron (ani zmieniać sekcji).'
    when 'wzorce' then 'Ten klucz nie pozwala zmieniać wzorców ani stylów.'
    when 'tabele' then 'Ten klucz nie pozwala zmieniać tabel danych ani serii.'
    when 'obrazy' then 'Ten klucz nie pozwala wgrywać, wymieniać ani usuwać obrazów.'
    when 'eksport' then 'Ten klucz nie pozwala robić plików PDF ani PNG.'
    else 'Ten klucz nie pozwala na tę zmianę.' end
    || ' Właściciel konta może to zmienić: Ustawienia konta → Sztuczna inteligencja → Edytuj.');
end; $$;
revoke all on function public.ai_zakres_brak(text, text) from public, anon, authenticated;

-- ---------- Opakowania funkcji dla kluczy ----------

alter function public.ai_zapisz(text, bigint, jsonb) rename to ai_zapisz_bez_zakresu;
revoke all on function public.ai_zapisz_bez_zakresu(text, bigint, jsonb) from public, anon, authenticated;
create or replace function public.ai_zapisz(p_klucz text, p_znana_wersja bigint, p_zmiany jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b jsonb; d jsonb; v_byly text[];
begin
  if jsonb_typeof(p_zmiany) = 'object' then
    if p_zmiany ?| array['wzorce', 'style'] then b := public.ai_zakres_brak(p_klucz, 'wzorce'); if b is not null then return b; end if; end if;
    if p_zmiany ?| array['tabele', 'serie'] then b := public.ai_zakres_brak(p_klucz, 'tabele'); if b is not null then return b; end if; end if;
    if p_zmiany ?| array['usun_strony', 'kolejnosc_stron', 'sekcje'] then b := public.ai_zakres_brak(p_klucz, 'strony'); if b is not null then return b; end if; end if;
    -- Nowa strona (id, którego projekt nie ma) też wymaga zakresu „strony”.
    if jsonb_typeof(p_zmiany->'strony') = 'array' and public.ai_zakres_brak(p_klucz, 'strony') is not null then
      d := public.ai_sprawdz_klucz(p_klucz, true, false);
      if not d ? 'blad' then
        select coalesce(array_agg(coalesce(x->>'id', x#>>'{}')), '{}') into v_byly
          from public.projekty p, jsonb_array_elements(coalesce(p.dane->'strony', '[]'::jsonb)) x
         where p.id = (d->>'projekt_id')::uuid;
        if exists (select 1 from jsonb_array_elements(p_zmiany->'strony') s where not (coalesce(s->>'id', '') = any (v_byly))) then
          return public.ai_zakres_brak(p_klucz, 'strony');
        end if;
      end if;
    end if;
  end if;
  return public.ai_zapisz_bez_zakresu(p_klucz, p_znana_wersja, p_zmiany);
end; $$;
revoke all on function public.ai_zapisz(text, bigint, jsonb) from public;
grant execute on function public.ai_zapisz(text, bigint, jsonb) to anon, authenticated;

alter function public.ai_wgraj_obraz(text, text, text, text, integer, integer, text) rename to ai_wgraj_obraz_bez_zakresu;
revoke all on function public.ai_wgraj_obraz_bez_zakresu(text, text, text, text, integer, integer, text) from public, anon, authenticated;
create or replace function public.ai_wgraj_obraz(
  p_klucz text, p_nazwa text, p_typ text, p_dane text,
  p_szer integer default null, p_wys integer default null, p_zastap text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b jsonb;
begin
  b := public.ai_zakres_brak(p_klucz, 'obrazy');
  if b is not null then return b; end if;
  return public.ai_wgraj_obraz_bez_zakresu(p_klucz, p_nazwa, p_typ, p_dane, p_szer, p_wys, p_zastap);
end; $$;
revoke all on function public.ai_wgraj_obraz(text, text, text, text, integer, integer, text) from public;
grant execute on function public.ai_wgraj_obraz(text, text, text, text, integer, integer, text) to anon, authenticated;

alter function public.ai_wgraj_poczatek(text, text, text, integer, text, integer, integer, text, integer) rename to ai_wgraj_poczatek_bez_zakresu;
revoke all on function public.ai_wgraj_poczatek_bez_zakresu(text, text, text, integer, text, integer, integer, text, integer) from public, anon, authenticated;
create or replace function public.ai_wgraj_poczatek(
  p_klucz text, p_nazwa text, p_typ text, p_rozmiar integer, p_skrot text,
  p_szer integer default null, p_wys integer default null, p_zastap text default null,
  p_kawalek integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b jsonb;
begin
  b := public.ai_zakres_brak(p_klucz, 'obrazy');
  if b is not null then return b; end if;
  return public.ai_wgraj_poczatek_bez_zakresu(p_klucz, p_nazwa, p_typ, p_rozmiar, p_skrot, p_szer, p_wys, p_zastap, p_kawalek);
end; $$;
revoke all on function public.ai_wgraj_poczatek(text, text, text, integer, text, integer, integer, text, integer) from public;
grant execute on function public.ai_wgraj_poczatek(text, text, text, integer, text, integer, integer, text, integer) to anon, authenticated;

alter function public.ai_zmien_obrazy(text, jsonb, jsonb) rename to ai_zmien_obrazy_bez_zakresu;
revoke all on function public.ai_zmien_obrazy_bez_zakresu(text, jsonb, jsonb) from public, anon, authenticated;
create or replace function public.ai_zmien_obrazy(p_klucz text, p_kopie jsonb default '{}'::jsonb, p_usun jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b jsonb;
begin
  b := public.ai_zakres_brak(p_klucz, 'obrazy');
  if b is not null then return b; end if;
  return public.ai_zmien_obrazy_bez_zakresu(p_klucz, p_kopie, p_usun);
end; $$;
revoke all on function public.ai_zmien_obrazy(text, jsonb, jsonb) from public;
grant execute on function public.ai_zmien_obrazy(text, jsonb, jsonb) to anon, authenticated;

alter function public.ai_zlec_eksport(text, text, jsonb) rename to ai_zlec_eksport_bez_zakresu;
revoke all on function public.ai_zlec_eksport_bez_zakresu(text, text, jsonb) from public, anon, authenticated;
create or replace function public.ai_zlec_eksport(p_klucz text, p_rodzaj text, p_ustawienia jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b jsonb;
begin
  b := public.ai_zakres_brak(p_klucz, 'eksport');
  if b is not null then return b; end if;
  return public.ai_zlec_eksport_bez_zakresu(p_klucz, p_rodzaj, p_ustawienia);
end; $$;
revoke all on function public.ai_zlec_eksport(text, text, jsonb) from public;
grant execute on function public.ai_zlec_eksport(text, text, jsonb) to anon, authenticated;

-- ---------- Właściciel: ustawienie zakresów i lista kluczy ----------

-- p_uprawnienia: lista dozwolonych (podzbiór strony, wzorce, tabele, obrazy, eksport); null – wszystko.
create or replace function public.ustaw_uprawnienia_ai(p_id uuid, p_uprawnienia text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Brak sesji'; end if;
  if p_uprawnienia is not null and not (p_uprawnienia <@ array['strony', 'wzorce', 'tabele', 'obrazy', 'eksport']) then
    raise exception 'Nieznany zakres klucza';
  end if;
  update public.dostepy_projektu
     set uprawnienia = case when p_uprawnienia is null or p_uprawnienia @> array['strony', 'wzorce', 'tabele', 'obrazy', 'eksport'] then null
                            else array(select distinct x from unnest(p_uprawnienia) x order by x) end
   where id = p_id and owner_id = auth.uid() and rodzaj = 'klucz';
  if not found then raise exception 'Nie ma takiego klucza na tym koncie'; end if;
end; $$;
revoke all on function public.ustaw_uprawnienia_ai(uuid, text[]) from public, anon;
grant execute on function public.ustaw_uprawnienia_ai(uuid, text[]) to authenticated;

create or replace function public.dostepy_ai()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'opis', d.opis, 'rola', d.rola, 'zakres', d.zakres, 'sposob', d.sposob, 'uprawnienia', to_jsonb(d.uprawnienia),
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
