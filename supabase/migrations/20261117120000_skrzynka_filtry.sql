-- Skrzynka w panelu administratora (#183): filtry listy rozmów – nieprzeczytane, z załącznikami, z gwiazdką –
-- działające razem z folderem, wyszukiwaniem i stronicowaniem (po stronie bazy, nie tylko na bieżącej stronie).
-- Funkcja jak w 20261115160000_skrzynka.sql, z nowym parametrem p_filtr (domyślnie bez filtra).

drop function if exists public.admin_poczta_watki(text, text, int, int);
drop function if exists public.admin_poczta_watki(text, text, int, int, text);
create or replace function public.admin_poczta_watki(p_folder text default 'skrzynka', p_szukaj text default null, p_limit int default 50, p_od int default 0, p_filtr text default null)
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
  v_filtr text := nullif(btrim(coalesce(p_filtr, '')), '');
begin
  perform public.wymagaj_administratora();
  if v_filtr is not null and v_filtr not in ('nieprzeczytane', 'zalaczniki', 'gwiazdka') then
    raise exception 'Nieznany filtr';
  end if;
  if v_folder not in ('skrzynka', 'zgloszenia', 'gwiazdka', 'wyslane', 'robocze', 'archiwum', 'spam', 'kosz') then
    raise exception 'Nieznany folder';
  end if;
  v_wzor := '%' || replace(replace(replace(coalesce(v_szukaj, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  if v_folder = 'robocze' then
    select count(*) into v_razem from public.poczta_robocze r
      where (v_szukaj is null or r.temat ilike v_wzor or array_to_string(r.do_lista, ' ') ilike v_wzor or r.html ilike v_wzor)
        and (v_filtr is null or (v_filtr = 'zalaczniki' and jsonb_array_length(r.zalaczniki) > 0));
    select coalesce(jsonb_agg(x order by x.ostatnia desc), '[]') into v_lista from (
      select r.id, true as robocza, r.watek, r.tryb, r.temat, r.do_lista, r.zmieniono as ostatnia,
             left(btrim(regexp_replace(regexp_replace(r.html, '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), 160) as zajawka,
             jsonb_array_length(r.zalaczniki) > 0 as zalaczniki
        from public.poczta_robocze r
        where (v_szukaj is null or r.temat ilike v_wzor or array_to_string(r.do_lista, ' ') ilike v_wzor or r.html ilike v_wzor)
          and (v_filtr is null or (v_filtr = 'zalaczniki' and jsonb_array_length(r.zalaczniki) > 0))
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
                            and (w.tekst ilike v_wzor or array_to_string(w.do_lista || w.dw, ' ') ilike v_wzor)))
          and (v_filtr is null
               or (v_filtr = 'nieprzeczytane' and not t.przeczytany)
               or (v_filtr = 'gwiazdka' and t.gwiazdka)
               or (v_filtr = 'zalaczniki' and exists (select 1 from public.poczta_wiadomosci w where w.watek = t.id and jsonb_array_length(w.zalaczniki) > 0))))
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
  return jsonb_build_object('watki', v_lista, 'razem', v_razem, 'skrzynka', (select u.skrzynka_email from public.poczta_ustawienia u where u.id = 1),
    'podpis', (select u.podpis from public.poczta_ustawienia u where u.id = 1), 'od', v_od, 'limit', v_limit, 'filtr', v_filtr,
    'liczniki', jsonb_build_object(
      'skrzynka', (select count(*) from public.poczta_watki t where t.folder = 'skrzynka' and not t.przeczytany),
      'zgloszenia', (select count(*) from public.poczta_watki t where t.zgloszenie_stan = 'otwarte' and t.folder not in ('spam', 'kosz')),
      'spam', (select count(*) from public.poczta_watki t where t.folder = 'spam' and not t.przeczytany),
      'robocze', (select count(*) from public.poczta_robocze)));
end;
$$;

revoke all on function public.admin_poczta_watki(text, text, int, int, text) from public, anon;
grant execute on function public.admin_poczta_watki(text, text, int, int, text) to authenticated;
