-- Kolory do druku (decyzja #127) przez łącznik AI: ai_zapisz przyjmuje też kolory_dodatkowe (kolory spot:
-- id, nazwa, zapas CMYK), tryb_kolorow (pelny | szarosc | czb1) i kolor_trybu. Reszta funkcji bez zmian
-- (kopia z 20261111200000_dostep_ai.sql). Uszlachetnienia to pola elementów (uszlachetnienie, folia) – przechodzą
-- razem ze stronami, bez osobnej obsługi.

create or replace function public.ai_zapisz(p_klucz text, p_znana_wersja bigint, p_zmiany jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  p public.projekty%rowtype;
  v_dane jsonb;
  v_strony jsonb := '{}'::jsonb;   -- id → strona (wszystkie strony po zmianach)
  v_kolejnosc text[];              -- kolejność stron po zmianach
  v_zmienione text[] := '{}';      -- strony do zapisania
  v_bledy text[] := '{}';
  v_klucz text;
  x jsonb;
  s jsonb;
  v_id text;
  v_sekcje text[];
  v_wzorce text[];
  v_serie text[];
  v_tabele text[];
  v_zasoby text[];
  v_typy text[] := array['textbox', 'i-text', 'text', 'rect', 'ellipse', 'circle', 'line', 'polygon', 'polyline', 'path', 'image', 'group', 'triangle'];
  v_legacy boolean;
  v_wersja bigint;
begin
  d := public.ai_sprawdz_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if jsonb_typeof(p_zmiany) <> 'object' then
    return jsonb_build_object('blad', 'Zmiany muszą być obiektem JSON.');
  end if;
  for v_klucz in select jsonb_object_keys(p_zmiany) loop
    if v_klucz not in ('nazwa', 'sekcje', 'wzorce', 'style', 'tabele', 'serie', 'widok', 'strony', 'usun_strony', 'kolejnosc_stron', 'kolory_dodatkowe', 'tryb_kolorow', 'kolor_trybu') then
      v_bledy := v_bledy || format('Nieznana część projektu „%s” (dozwolone: nazwa, sekcje, wzorce, style, tabele, serie, widok, strony, usun_strony, kolejnosc_stron, kolory_dodatkowe, tryb_kolorow, kolor_trybu).', v_klucz);
    end if;
  end loop;
  if octet_length(p_zmiany::text) > 8000000 then
    v_bledy := v_bledy || 'Zmiany są za duże (ponad 8 MB naraz).'::text;
  end if;
  if cardinality(v_bledy) > 0 then
    return jsonb_build_object('blad', 'Zmiany odrzucone.', 'szczegoly', to_jsonb(v_bledy));
  end if;

  select * into p from public.projekty where id = (d->>'projekt_id')::uuid for update;
  if not found then
    return jsonb_build_object('blad', 'Projektu już nie ma.');
  end if;
  if p_znana_wersja is null or p_znana_wersja <> p.wersja then
    return jsonb_build_object('konflikt', true, 'wersja', p.wersja,
      'blad', 'Projekt zmienił się w międzyczasie (wersja ' || p.wersja || '). Pobierz go na nowo i nanieś zmiany jeszcze raz.');
  end if;

  v_dane := p.dane;
  v_legacy := not coalesce((v_dane->>'strony_osobno')::boolean, false);
  -- Strony przed zmianami.
  if v_legacy then
    for x in select * from jsonb_array_elements(coalesce(v_dane->'strony', '[]'::jsonb)) loop
      v_strony := v_strony || jsonb_build_object(x->>'id', x);
    end loop;
    select coalesce(array_agg(x->>'id'), '{}') into v_kolejnosc from jsonb_array_elements(coalesce(v_dane->'strony', '[]'::jsonb)) as t(x);
    v_zmienione := v_kolejnosc; -- starszy zapis: przy pierwszym zapisie strony przechodzą do osobnych wierszy
  else
    select coalesce(array_agg(k.id order by k.nr), '{}') into v_kolejnosc
      from jsonb_array_elements_text(coalesce(v_dane->'strony', '[]'::jsonb)) with ordinality as k(id, nr);
    select coalesce(jsonb_object_agg(strona_id, dane), '{}'::jsonb) into v_strony
      from public.projekty_strony where projekt_id = p.id;
  end if;

  -- Części projektu podane w całości.
  if p_zmiany ? 'nazwa' then
    if jsonb_typeof(p_zmiany->'nazwa') <> 'string' or length(trim(p_zmiany->>'nazwa')) = 0 or length(p_zmiany->>'nazwa') > 120 then
      v_bledy := v_bledy || 'nazwa: niepusty tekst do 120 znaków.'::text;
    end if;
  end if;
  foreach v_klucz in array array['sekcje', 'wzorce', 'style', 'tabele', 'serie'] loop
    if p_zmiany ? v_klucz then
      if public.ai_identyfikatory(p_zmiany->v_klucz) is null then
        v_bledy := v_bledy || format('%s: lista obiektów, każdy z niepowtarzalnym, niepustym „id”.', v_klucz);
      else
        v_dane := jsonb_set(v_dane, array[v_klucz], p_zmiany->v_klucz);
      end if;
    end if;
  end loop;
  if p_zmiany ? 'widok' and jsonb_typeof(p_zmiany->'widok') <> 'object' then
    v_bledy := v_bledy || 'widok: obiekt.'::text;
  elsif p_zmiany ? 'widok' then
    v_dane := jsonb_set(v_dane, '{widok}', p_zmiany->'widok');
  end if;
  -- Kolory do druku (#127): kolory dodatkowe (spot) i tryb kolorów projektu.
  if p_zmiany ? 'kolory_dodatkowe' then
    if jsonb_typeof(p_zmiany->'kolory_dodatkowe') <> 'array' or exists (
      select 1 from jsonb_array_elements(p_zmiany->'kolory_dodatkowe') k
      where jsonb_typeof(k) <> 'object' or coalesce(k->>'id', '') = '' or coalesce(k->>'nazwa', '') = ''
        or jsonb_typeof(k->'cmyk') <> 'array' or jsonb_array_length(k->'cmyk') <> 4) then
      v_bledy := v_bledy || 'kolory_dodatkowe: lista { id, nazwa, cmyk: [c, m, y, k] } (wartości 0–100).'::text;
    else
      v_dane := jsonb_set(v_dane, '{kolory_dodatkowe}', p_zmiany->'kolory_dodatkowe');
    end if;
  end if;
  if p_zmiany ? 'tryb_kolorow' then
    if coalesce(p_zmiany->>'tryb_kolorow', '') not in ('pelny', 'szarosc', 'czb1') then
      v_bledy := v_bledy || 'tryb_kolorow: „pelny”, „szarosc” albo „czb1”.'::text;
    else
      v_dane := jsonb_set(v_dane, '{tryb_kolorow}', p_zmiany->'tryb_kolorow');
    end if;
  end if;
  if p_zmiany ? 'kolor_trybu' then
    if jsonb_typeof(p_zmiany->'kolor_trybu') not in ('string', 'null') then
      v_bledy := v_bledy || 'kolor_trybu: id koloru dodatkowego albo null.'::text;
    else
      v_dane := jsonb_set(v_dane, '{kolor_trybu}', p_zmiany->'kolor_trybu');
    end if;
  end if;

  -- Strony: nowe i zmienione, usunięte, kolejność.
  if p_zmiany ? 'strony' then
    if public.ai_identyfikatory(p_zmiany->'strony') is null then
      v_bledy := v_bledy || 'strony: lista obiektów stron, każda z niepowtarzalnym, niepustym „id”.'::text;
    else
      for x in select * from jsonb_array_elements(p_zmiany->'strony') loop
        v_id := x->>'id';
        if not (v_id = any(v_kolejnosc)) then
          v_kolejnosc := v_kolejnosc || v_id;
        end if;
        v_strony := v_strony || jsonb_build_object(v_id, x);
        if not (v_id = any(v_zmienione)) then
          v_zmienione := v_zmienione || v_id;
        end if;
      end loop;
    end if;
  end if;
  if p_zmiany ? 'usun_strony' then
    if jsonb_typeof(p_zmiany->'usun_strony') <> 'array' then
      v_bledy := v_bledy || 'usun_strony: lista identyfikatorów stron.'::text;
    else
      for v_id in select * from jsonb_array_elements_text(p_zmiany->'usun_strony') loop
        if not (v_id = any(v_kolejnosc)) then
          v_bledy := v_bledy || format('usun_strony: nie ma strony „%s”.', v_id);
        end if;
        v_kolejnosc := array_remove(v_kolejnosc, v_id);
        v_zmienione := array_remove(v_zmienione, v_id);
        v_strony := v_strony - v_id;
      end loop;
    end if;
  end if;
  if p_zmiany ? 'kolejnosc_stron' then
    if jsonb_typeof(p_zmiany->'kolejnosc_stron') <> 'array' then
      v_bledy := v_bledy || 'kolejnosc_stron: lista identyfikatorów stron.'::text;
    else
      select coalesce(array_agg(t.id order by t.nr), '{}') into v_tabele
        from jsonb_array_elements_text(p_zmiany->'kolejnosc_stron') with ordinality as t(id, nr);
      if cardinality(v_tabele) <> cardinality(v_kolejnosc) or not (v_tabele @> v_kolejnosc and v_kolejnosc @> v_tabele)
         or (select count(distinct u) from unnest(v_tabele) u) <> cardinality(v_tabele) then
        v_bledy := v_bledy || 'kolejnosc_stron: musi zawierać każdą stronę projektu dokładnie raz.'::text;
      else
        v_kolejnosc := v_tabele;
      end if;
    end if;
  end if;

  if cardinality(v_bledy) > 0 then
    return jsonb_build_object('blad', 'Zmiany odrzucone.', 'szczegoly', to_jsonb(v_bledy));
  end if;

  -- Spójność całości po zmianach (te same powiązania, które aplikacja sprawdza przy wczytaniu).
  v_sekcje := coalesce(public.ai_identyfikatory(coalesce(v_dane->'sekcje', '[]'::jsonb)), '{}');
  v_wzorce := coalesce(public.ai_identyfikatory(coalesce(v_dane->'wzorce', '[]'::jsonb)), '{}');
  v_serie := coalesce(public.ai_identyfikatory(coalesce(v_dane->'serie', '[]'::jsonb)), '{}');
  v_tabele := coalesce(public.ai_identyfikatory(coalesce(v_dane->'tabele', '[]'::jsonb)), '{}');
  select coalesce(array_agg(k), '{}') into v_zasoby from jsonb_object_keys(coalesce(v_dane->'zasoby', '{}'::jsonb)) k;
  if cardinality(v_sekcje) = 0 then
    v_bledy := v_bledy || 'Projekt musi mieć co najmniej jedną sekcję.'::text;
  end if;
  if cardinality(v_kolejnosc) = 0 then
    v_bledy := v_bledy || 'Projekt musi mieć co najmniej jedną stronę.'::text;
  end if;
  for x in select * from jsonb_array_elements(coalesce(v_dane->'sekcje', '[]'::jsonb)) loop
    if jsonb_typeof(x->'wydruk') <> 'object' then
      v_bledy := v_bledy || format('Sekcja „%s”: brak „wydruk” (format, wymiary, spad, marginesy).', x->>'id');
    end if;
    if x ? 'wzorce' and (jsonb_typeof(x->'wzorce') <> 'array' or exists (
         select 1 from jsonb_array_elements_text(x->'wzorce') w where not (w = any(v_wzorce)))) then
      v_bledy := v_bledy || format('Sekcja „%s”: „wzorce” wskazują nieistniejący wzorzec.', x->>'id');
    end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(v_dane->'tabele', '[]'::jsonb)) loop
    if jsonb_typeof(x->'kolumny') <> 'array' or jsonb_typeof(x->'wiersze') <> 'array'
       or exists (select 1 from jsonb_array_elements(x->'wiersze') w where jsonb_typeof(w) <> 'array') then
      v_bledy := v_bledy || format('Tabela „%s”: „kolumny” to lista nazw, a „wiersze” to lista list.', x->>'id');
    end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(v_dane->'serie', '[]'::jsonb)) loop
    if x->>'tabela' is not null and not ((x->>'tabela') = any(v_tabele)) then
      v_bledy := v_bledy || format('Seria „%s”: nie ma tabeli „%s”.', x->>'id', x->>'tabela');
    end if;
    if exists (select 1 from jsonb_array_elements(coalesce(x->'dodatkowe', '[]'::jsonb)) t where not ((t->>'tabela') = any(v_tabele))) then
      v_bledy := v_bledy || format('Seria „%s”: tabela dodatkowa wskazuje nieistniejącą tabelę.', x->>'id');
    end if;
  end loop;
  -- Strony: sekcja, wzorce, seria, elementy (typ i id), obrazy tylko z zasobów projektu.
  foreach v_id in array v_kolejnosc loop
    s := v_strony->v_id;
    if s is null then
      v_bledy := v_bledy || format('Brak treści strony „%s”.', v_id);
      continue;
    end if;
    if not ((s->>'sekcja') = any(v_sekcje)) then
      v_bledy := v_bledy || format('Strona „%s”: „sekcja” musi wskazywać istniejącą sekcję.', v_id);
    end if;
    if s ? 'wzorce' and s->'wzorce' <> '"z_sekcji"'::jsonb and (jsonb_typeof(s->'wzorce') <> 'array' or exists (
         select 1 from jsonb_array_elements_text(s->'wzorce') w where not (w = any(v_wzorce)))) then
      v_bledy := v_bledy || format('Strona „%s”: „wzorce” to "z_sekcji" albo lista istniejących wzorców.', v_id);
    end if;
    if s->>'seria' is not null and not ((s->>'seria') = any(v_serie)) then
      v_bledy := v_bledy || format('Strona „%s”: nie ma serii „%s”.', v_id, s->>'seria');
    end if;
  end loop;
  for x in
    select jsonb_build_object('gdzie', 'Strona „' || k || '”', 'obiekty', v_strony->k->'obiekty') from unnest(v_zmienione) k
    union all
    select jsonb_build_object('gdzie', 'Wzorzec „' || (w->>'id') || '”', 'obiekty', w->'obiekty')
      from jsonb_array_elements(case when p_zmiany ? 'wzorce' then coalesce(v_dane->'wzorce', '[]'::jsonb) else '[]'::jsonb end) w
  loop
    if x->'obiekty' is null or jsonb_typeof(x->'obiekty') <> 'array' then
      v_bledy := v_bledy || format('%s: „obiekty” to lista elementów.', x->>'gdzie');
      continue;
    end if;
    if public.ai_identyfikatory(x->'obiekty') is null then
      v_bledy := v_bledy || format('%s: każdy element musi mieć niepowtarzalne, niepuste „id”.', x->>'gdzie');
    end if;
    if exists (select 1 from jsonb_array_elements(x->'obiekty') o where not (lower(o->>'type') = any(v_typy))) then
      v_bledy := v_bledy || format('%s: nieznany rodzaj elementu (type) – dozwolone: %s.', x->>'gdzie', array_to_string(v_typy, ', '));
    end if;
    if exists (select 1 from jsonb_path_query(x->'obiekty', 'lax $.**.zasob') z
               where jsonb_typeof(z) = 'string' and not ((z #>> '{}') = any(v_zasoby))) then
      v_bledy := v_bledy || format('%s: obraz wskazuje zasób, którego nie ma w projekcie (z klucza nie da się wgrać nowych obrazów).', x->>'gdzie');
    end if;
  end loop;
  if cardinality(v_bledy) > 0 then
    return jsonb_build_object('blad', 'Zmiany odrzucone – projekt byłby niespójny.', 'szczegoly', to_jsonb(v_bledy[1:20]));
  end if;

  -- Zapis: projekt (kolejność stron, części), zmienione strony, usunięte strony; wersja w górę.
  v_wersja := p.wersja + 1;
  v_dane := v_dane || jsonb_build_object(
    'strony', to_jsonb(v_kolejnosc),
    'strony_osobno', true,
    'zmieniono', to_jsonb(now()));
  update public.projekty
     set nazwa = coalesce(p_zmiany->>'nazwa', nazwa),
         dane = case when p_zmiany ? 'nazwa' then jsonb_set(v_dane, '{nazwa}', p_zmiany->'nazwa') else v_dane end,
         zmieniono = now(),
         wersja = v_wersja
   where id = p.id;
  insert into public.projekty_strony (projekt_id, strona_id, owner_id, dane)
    select p.id, k, p.owner_id, v_strony->k from unnest(v_zmienione) k
  on conflict (projekt_id, strona_id) do update set dane = excluded.dane;
  delete from public.projekty_strony st where st.projekt_id = p.id and not (st.strona_id = any(v_kolejnosc));
  return jsonb_build_object('wersja', v_wersja, 'strony_zapisane', cardinality(v_zmienione));
end;
$$;

revoke all on function public.ai_zapisz(text, bigint, jsonb) from public;
grant execute on function public.ai_zapisz(text, bigint, jsonb) to anon, authenticated;
