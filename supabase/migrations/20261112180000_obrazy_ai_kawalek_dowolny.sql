-- Migracja: wielkość kawałka przy wgrywaniu obrazu od AI (p_kawalek, 16–512 KB).
--
-- Do tej pory kawałki miały zawsze 512 KB – tak wysyła je łącznik, który ma cały plik (adres, POST, dysk).
-- AI, które nie może wysłać pliku inaczej niż przez wywołania narzędzi (Claude bez dostępu sieci do bazy),
-- przepisuje plik jako base64 w wywołaniach narzędzia wgraj_czesciami; jedno wywołanie unosi rozsądnie
-- najwyżej kilkadziesiąt KB, więc wgranie musi przyjąć mniejsze kawałki. Domyślnie dalej 512 KB.
-- Zmiana sygnatury: stara funkcja (8 parametrów) znika, żeby PostgREST nie miał dwóch pasujących wersji.

drop function if exists public.ai_wgraj_poczatek(text, text, text, integer, text, integer, integer, text);

create or replace function public.ai_wgraj_poczatek(
  p_klucz text, p_nazwa text, p_typ text, p_rozmiar integer, p_skrot text,
  p_szer integer default null, p_wys integer default null, p_zastap text default null,
  p_kawalek integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
  p public.projekty%rowtype;
  v_byl jsonb;
  v_suma bigint;
  v_wiersz uuid;
  v_kawalek integer := coalesce(p_kawalek, 512 * 1024);
  v_czesci integer;
begin
  d := public.ai_sprawdz_klucz(p_klucz, true);
  if d ? 'blad' then
    return d;
  end if;
  if p_typ is null or p_typ not in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml') then
    return jsonb_build_object('blad', 'Obsługiwane obrazy: PNG, JPEG, WebP, GIF i SVG.');
  end if;
  if v_kawalek < 16 * 1024 or v_kawalek > 512 * 1024 then
    return jsonb_build_object('blad', 'Wielkość kawałka (p_kawalek): od 16 KB do 512 KB.');
  end if;
  if p_rozmiar is null or p_rozmiar < 1 then
    return jsonb_build_object('blad', 'Podaj rozmiar pliku w bajtach (p_rozmiar).');
  end if;
  if p_rozmiar > 25 * 1024 * 1024 then
    return jsonb_build_object('blad', 'Plik jest za duży (najwyżej 25 MB).');
  end if;
  if coalesce(p_skrot, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('blad', 'p_skrot to SHA-256 treści pliku: 64 znaki szesnastkowe (małe litery).');
  end if;
  if p_szer is not null and (p_szer < 1 or p_szer > 100000) or p_wys is not null and (p_wys < 1 or p_wys > 100000) then
    return jsonb_build_object('blad', 'Nieprawidłowe wymiary obrazu.');
  end if;
  select * into p from public.projekty where id = (d->>'projekt_id')::uuid;
  if not found then
    return jsonb_build_object('blad', 'Projektu już nie ma.');
  end if;
  v_byl := public.ai_obraz_istniejacy(p.dane, p.wersja, p_skrot, p_typ, p_szer, p_wys, p_rozmiar);
  if v_byl is not null then
    return v_byl;
  end if;
  if p_zastap is not null and not coalesce(p.dane->'zasoby', '{}'::jsonb) ? p_zastap then
    return jsonb_build_object('blad', 'Nie ma obrazu „' || p_zastap || '” do zastąpienia (lista: obrazy_projektu).');
  end if;
  -- Niedokończone wgrania sprzed doby nie zajmują miejsca.
  delete from public.obrazy_ai where projekt_id = p.id and not gotowy and utworzono < now() - interval '1 day';
  select coalesce(sum(rozmiar), 0) into v_suma from public.obrazy_ai where projekt_id = p.id;
  if v_suma + p_rozmiar > 150 * 1024 * 1024 then
    return jsonb_build_object('blad', 'Na przeniesienie czeka już za dużo obrazów (150 MB). Właściciel musi otworzyć projekt w aplikacji – wtedy obrazy przejdą na jego konto i miejsce się zwolni.');
  end if;
  v_czesci := (p_rozmiar + v_kawalek - 1) / v_kawalek;
  insert into public.obrazy_ai (projekt_id, owner_id, nazwa, nazwa_prosba, typ, rozmiar, skrot, dane, czesci, szer, wys, zastap, gotowy)
    values (p.id, p.owner_id, public.ai_obraz_nazwa(p_nazwa, p_typ), btrim(coalesce(p_nazwa, '')), p_typ, p_rozmiar,
            p_skrot, null, v_czesci, p_szer, p_wys, p_zastap, false)
    returning id into v_wiersz;
  return jsonb_build_object('wiersz', v_wiersz, 'kawalek', v_kawalek, 'czesci', v_czesci);
end;
$$;

revoke all on function public.ai_wgraj_poczatek(text, text, text, integer, text, integer, integer, text, integer) from public;
grant execute on function public.ai_wgraj_poczatek(text, text, text, integer, text, integer, integer, text, integer) to anon, authenticated;
