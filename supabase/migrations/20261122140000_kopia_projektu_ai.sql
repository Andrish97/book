-- Kopia projektu przez łącznik AI (zgłoszenie właściciela 22.11: „dlaczego łącznik Claude nie umie zrobić kopii
-- projektu?”). Łącznik nie sięga do plików obrazów (R2), więc kopia powstaje w bazie:
--   * wiersz projektu i wiersze stron – skopiowane pod nowym id, z nową nazwą;
--   * obrazy wgrane przez AI, które czekają w tabeli obrazy_ai („ai:<id>”) – skopiowane (z kawałkami) pod kopię;
--   * obrazy z folderu konta (R2) – kopia wskazuje na pliki oryginału; aplikacja przy pierwszym zapisie kopii
--     wysyła je do folderu kopii (js/chmura.js, zapiszWChmurze), a do tego czasu ich nie usuwa (odwolania_pliku).
-- Limit liczby projektów konta pilnuje ten sam wyzwalacz co przy „Nowy projekt” i „Duplikuj”.

create or replace function public.ai_kopiuj_projekt(p_klucz text, p_projekt uuid, p_nowy uuid, p_nazwa text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  v_owner uuid;
  src public.projekty%rowtype;
  v_nazwa text;
  v_zasoby jsonb;
  z record;
  o public.obrazy_ai%rowtype;
  v_nowy_obraz uuid;
  v_obrazy integer := 0;
  v_stron integer;
begin
  d := public.ai_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if d->>'zakres' <> 'pelny' or d->>'rola' <> 'edycja' then
    return jsonb_build_object('blad', 'Kopiować projekty może tylko klucz z pełnym dostępem, który czyta i zmienia (ustawienia konta → Dostęp dla AI).');
  end if;
  v_owner := (d->>'owner_id')::uuid;
  select * into src from public.projekty where id = p_projekt;
  if not found or src.owner_id <> v_owner then
    return jsonb_build_object('blad', 'Skopiować można tylko własny projekt konta.');
  end if;
  if p_nowy is null or exists (select 1 from public.projekty where id = p_nowy) then
    return jsonb_build_object('blad', 'Nieprawidłowy albo zajęty identyfikator kopii.');
  end if;
  v_nazwa := trim(coalesce(nullif(trim(p_nazwa), ''), src.nazwa || ' (kopia)'));
  if length(v_nazwa) > 120 then
    return jsonb_build_object('blad', 'Nazwa projektu: do 120 znaków.');
  end if;
  v_zasoby := case when jsonb_typeof(src.dane->'zasoby') = 'object' then src.dane->'zasoby' else '{}'::jsonb end;
  begin
    insert into public.projekty (id, owner_id, nazwa, dane, zmieniono, wersja)
    values (p_nowy, v_owner, v_nazwa,
            (src.dane - 'udostepnienie' - 'podstawa_chmury' - 'wersja_chmury' - 'wspolpraca_chmury')
              || jsonb_build_object('id', p_nowy, 'nazwa', v_nazwa, 'zmieniono', to_jsonb(now())),
            now(), 1);
    insert into public.projekty_strony (projekt_id, strona_id, owner_id, dane)
      select p_nowy, s.strona_id, v_owner, s.dane from public.projekty_strony s where s.projekt_id = src.id;
    get diagnostics v_stron = row_count;
    -- obrazy od AI z tabeli: własny wiersz (i kawałki) dla kopii
    for z in select key, value from jsonb_each(v_zasoby) where value->>'sciezka' like 'ai:%' loop
      select * into o from public.obrazy_ai where id::text = substr(z.value->>'sciezka', 4) and owner_id = v_owner;
      if not found then
        continue;
      end if;
      v_nowy_obraz := gen_random_uuid();
      insert into public.obrazy_ai (id, projekt_id, owner_id, nazwa, typ, rozmiar, skrot, dane, utworzono, czesci, gotowy, szer, wys, zastap, nazwa_prosba)
        values (v_nowy_obraz, p_nowy, v_owner, o.nazwa, o.typ, o.rozmiar, o.skrot, o.dane, now(), o.czesci, o.gotowy, o.szer, o.wys, null, o.nazwa_prosba);
      insert into public.obrazy_ai_czesci (wiersz, nr, dane)
        select v_nowy_obraz, c.nr, c.dane from public.obrazy_ai_czesci c where c.wiersz = o.id;
      v_zasoby := jsonb_set(v_zasoby, array[z.key, 'sciezka'], to_jsonb('ai:' || v_nowy_obraz::text));
      v_obrazy := v_obrazy + 1;
    end loop;
    update public.projekty set dane = jsonb_set(dane, '{zasoby}', v_zasoby) where id = p_nowy;
  exception when others then
    return jsonb_build_object('blad', case when sqlerrm like 'limit_projektow:%' then substr(sqlerrm, 18) else 'Nie udało się skopiować projektu: ' || sqlerrm end);
  end;
  return jsonb_build_object('id', p_nowy, 'nazwa', v_nazwa, 'stron', v_stron,
    'obrazy', (select count(*) from jsonb_object_keys(v_zasoby)), 'obrazy_ai', v_obrazy);
end;
$$;
revoke all on function public.ai_kopiuj_projekt(text, uuid, uuid, text) from public;
grant execute on function public.ai_kopiuj_projekt(text, uuid, uuid, text) to anon, authenticated;

-- Projekty konta, które wskazują na dany plik z folderu konta (kopia z łącznika wskazuje na pliki oryginału, dopóki
-- aplikacja nie wyśle jej własnych). Aplikacja pyta o to przed usunięciem pliku albo folderu projektu.
create or replace function public.odwolania_pliku(p_sciezki text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Brak sesji';
  end if;
  return coalesce((
    select jsonb_object_agg(x.sciezka, x.projekty) from (
      select z.value->>'sciezka' as sciezka, jsonb_agg(distinct p.id) as projekty
        from public.projekty p,
             jsonb_each(case when jsonb_typeof(p.dane->'zasoby') = 'object' then p.dane->'zasoby' else '{}'::jsonb end) z
       where p.owner_id = v_uid and z.value->>'sciezka' = any(p_sciezki)
       group by 1) x), '{}'::jsonb);
end;
$$;
revoke all on function public.odwolania_pliku(text[]) from public, anon;
grant execute on function public.odwolania_pliku(text[]) to authenticated;
