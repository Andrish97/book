-- Migracja: bez starego magazynu plików i bez trybu przejściowego linków (decyzja #107).
--
-- Użytkownik: „Nie rób fallbacku, starego bucketa i w ogóle go usuń. Jest tylko jedno udostępnienie, jedno jedyne.”
-- Wszystkie pliki są w R2 (#92, #97). Znikają reguły dostępu do Supabase Storage (buckety zasoby i podglady);
-- same buckety kasuje się w panelu Supabase (Storage → bucket → Delete bucket) – SQL nie może ich usunąć.
-- Link z ochroną bez sekretu (sprzed #97) jest po prostu nieaktywny („brak”), dopóki właściciel go nie opublikuje.

drop policy if exists "zasoby: własny folder - odczyt" on storage.objects;
drop policy if exists "zasoby: własny folder - dodawanie" on storage.objects;
drop policy if exists "zasoby: własny folder - zmiana" on storage.objects;
drop policy if exists "zasoby: własny folder - usuwanie" on storage.objects;
drop policy if exists "podglady: własny folder - odczyt" on storage.objects;
drop policy if exists "podglady: własny folder - dodawanie" on storage.objects;
drop policy if exists "podglady: własny folder - zmiana" on storage.objects;
drop policy if exists "podglady: własny folder - usuwanie" on storage.objects;
drop policy if exists "zasoby: projekt współdzielony - odczyt" on storage.objects;
drop policy if exists "zasoby: projekt współdzielony - dodawanie" on storage.objects;
drop policy if exists "zasoby: projekt współdzielony - zmiana" on storage.objects;
drop policy if exists "zasoby: projekt współdzielony - usuwanie" on storage.objects;

create or replace function public.podglad_chroniony(
  p_konto uuid, p_projekt uuid, p_kod text, p_haslo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.udostepnienia%rowtype;
  wlasciciel boolean := auth.uid() is not null and auth.uid() = p_konto;
  v_nowy boolean := false;
begin
  select * into u from public.udostepnienia
   where owner_id = p_konto and projekt_id = p_projekt and kod = p_kod;
  if not found then
    return jsonb_build_object('stan', 'brak');
  end if;
  if wlasciciel then
    if u.sekret is null then
      update public.udostepnienia set sekret = public.nowy_sekret_udostepnienia()
       where owner_id = p_konto and projekt_id = p_projekt and kod = p_kod
      returning * into u;
      v_nowy := true;
    end if;
  else
    if u.wazny_do is not null and u.wazny_do < now() then
      return jsonb_build_object('stan', 'wygasl');
    end if;
    if u.haslo_skrot is not null then
      if u.blokada_do is not null and u.blokada_do > now() then
        return jsonb_build_object('stan', 'blokada', 'do', u.blokada_do);
      end if;
      if p_haslo is null or p_haslo = '' then
        return jsonb_build_object('stan', 'haslo', 'wazny_do', u.wazny_do);
      end if;
      if extensions.crypt(p_haslo, u.haslo_skrot) <> u.haslo_skrot then
        update public.udostepnienia
           set nieudane = case when nieudane + 1 >= 10 then 0 else nieudane + 1 end,
               blokada_do = case when nieudane + 1 >= 10 then now() + interval '15 minutes' else blokada_do end
         where owner_id = p_konto and projekt_id = p_projekt and kod = p_kod;
        return jsonb_build_object('stan', 'zle_haslo');
      end if;
      if u.nieudane > 0 then
        update public.udostepnienia set nieudane = 0
         where owner_id = p_konto and projekt_id = p_projekt and kod = p_kod;
      end if;
    end if;
    if u.sekret is null then
      return jsonb_build_object('stan', 'brak');
    end if;
  end if;
  return jsonb_build_object('stan', 'ok', 'folder', u.kod || '.' || u.sekret, 'haslo', u.haslo_skrot is not null,
                            'wazny_do', u.wazny_do, 'nowy', v_nowy);
end;
$$;

revoke all on function public.podglad_chroniony(uuid, uuid, text, text) from public;
grant execute on function public.podglad_chroniony(uuid, uuid, text, text) to anon, authenticated;
