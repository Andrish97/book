-- Strony projektu w osobnych wierszach, żeby przy zapisie wysyłać tylko te,
-- które się zmieniły. W wierszu projektu (projekty.dane) zostaje kolejność
-- stron (lista identyfikatorów) i wszystko poza stronami.
--
-- Zapis idzie jedną funkcją: sprawdzenie wersji, projekt, zmienione strony
-- i sprzątnięcie usuniętych dzieją się razem albo wcale – konflikt z innym
-- urządzeniem nie może zostawić projektu w połowie zapisanego.

create table if not exists public.projekty_strony (
  projekt_id uuid not null references public.projekty (id) on delete cascade,
  strona_id  text not null,
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dane       jsonb not null,
  primary key (projekt_id, strona_id)
);

alter table public.projekty_strony enable row level security;

drop policy if exists "strony: odczyt własnych" on public.projekty_strony;
create policy "strony: odczyt własnych" on public.projekty_strony
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "strony: dodawanie własnych" on public.projekty_strony;
create policy "strony: dodawanie własnych" on public.projekty_strony
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "strony: zmiana własnych" on public.projekty_strony;
create policy "strony: zmiana własnych" on public.projekty_strony
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "strony: usuwanie własnych" on public.projekty_strony;
create policy "strony: usuwanie własnych" on public.projekty_strony
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Zwraca { "wersja": n } albo – gdy na koncie jest inna wersja niż znana
-- urządzeniu – { "konflikt": true, "wersja": n, "zmieniono": … } i nic nie zapisuje.
-- p_strony: [{ "id": "...", "dane": { … } }] – tylko strony nowe i zmienione.
-- Wiersze stron, których nie ma na liście p_dane->'strony', są usuwane.
create or replace function public.zapisz_projekt(
  p_id uuid, p_znana_wersja bigint, p_wymus boolean, p_nazwa text,
  p_dane jsonb, p_zmieniono timestamptz, p_strony jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_wersja bigint;
  v_zmieniono timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Brak sesji';
  end if;
  select wersja, zmieniono into v_wersja, v_zmieniono
    from public.projekty where id = p_id for update;
  if not found then
    insert into public.projekty (id, owner_id, nazwa, dane, zmieniono, wersja)
      values (p_id, auth.uid(), p_nazwa, p_dane, p_zmieniono, 1);
    v_wersja := 1;
  else
    if not coalesce(p_wymus, false) and (p_znana_wersja is null or p_znana_wersja <> v_wersja) then
      return jsonb_build_object('konflikt', true, 'wersja', v_wersja, 'zmieniono', v_zmieniono);
    end if;
    v_wersja := v_wersja + 1;
    update public.projekty
      set nazwa = p_nazwa, dane = p_dane, zmieniono = p_zmieniono, wersja = v_wersja
      where id = p_id;
  end if;

  insert into public.projekty_strony (projekt_id, strona_id, owner_id, dane)
    select p_id, x->>'id', auth.uid(), x->'dane'
      from jsonb_array_elements(coalesce(p_strony, '[]'::jsonb)) as x
    on conflict (projekt_id, strona_id) do update set dane = excluded.dane;

  delete from public.projekty_strony s
    where s.projekt_id = p_id
      and not exists (
        select 1 from jsonb_array_elements_text(coalesce(p_dane->'strony', '[]'::jsonb)) as k(id)
        where k.id = s.strona_id
      );

  return jsonb_build_object('wersja', v_wersja);
end;
$$;

revoke all on function public.zapisz_projekt(uuid, bigint, boolean, text, jsonb, timestamptz, jsonb) from public, anon;
grant execute on function public.zapisz_projekt(uuid, bigint, boolean, text, jsonb, timestamptz, jsonb) to authenticated;
