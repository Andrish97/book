-- Migracja: sprzątanie starych kopii awaryjnych z panelu administratora (decyzja #207).
--
-- Kopie projektu (#138) sprzątają się przy kolejnym zapisie TEGO projektu – projekty porzucone albo usunięte
-- zostawiały kopie na zawsze. Panel (Zapisy i kopie) pokazuje, ile kopii jest i ile zajmują, a przycisk
-- „Wyczyść stare kopie…” usuwa kopie, strony i wpisy dziennika starsze niż wybrana liczba dni (1–365) we wszystkich
-- projektach naraz.

create or replace function public.admin_kopie_stan()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.wymagaj_administratora();
  return jsonb_build_object(
    'kopie', (select count(*) from public.projekty_kopie),
    'strony', (select count(*) from public.projekty_strony_kopie),
    'dziennik', (select count(*) from public.projekty_dziennik),
    'starsze_14', (select count(*) from public.projekty_kopie where utworzono < now() - interval '14 days')
                + (select count(*) from public.projekty_strony_kopie where utworzono < now() - interval '14 days'),
    'usuniete_projekty', (select count(distinct k.projekt_id) from public.projekty_kopie k
                           where not exists (select 1 from public.projekty p where p.id = k.projekt_id)),
    'najstarsza', (select min(utworzono) from public.projekty_kopie),
    'rozmiar', pg_total_relation_size('public.projekty_kopie') + pg_total_relation_size('public.projekty_strony_kopie')
             + pg_total_relation_size('public.projekty_dziennik'));
end;
$$;
revoke all on function public.admin_kopie_stan() from public, anon;
grant execute on function public.admin_kopie_stan() to authenticated;

create or replace function public.admin_kopie_wyczysc(p_dni int default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_od timestamptz := now() - make_interval(days => least(greatest(coalesce(p_dni, 14), 1), 365));
  v_kopie int;
  v_strony int;
  v_dziennik int;
begin
  perform public.wymagaj_administratora();
  delete from public.projekty_kopie where utworzono < v_od;
  get diagnostics v_kopie = row_count;
  delete from public.projekty_strony_kopie where utworzono < v_od;
  get diagnostics v_strony = row_count;
  delete from public.projekty_dziennik where utworzono < v_od;
  get diagnostics v_dziennik = row_count;
  return jsonb_build_object('kopie', v_kopie, 'strony', v_strony, 'dziennik', v_dziennik);
end;
$$;
revoke all on function public.admin_kopie_wyczysc(int) from public, anon;
grant execute on function public.admin_kopie_wyczysc(int) to authenticated;
