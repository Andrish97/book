-- Zmiany na żywo między urządzeniami.
--
-- Każdy zapis projektu podnosi numer wersji w wierszu tabeli `projekty` (funkcja zapisz_projekt).
-- Włączenie tej tabeli do publikacji `supabase_realtime` sprawia, że urządzenia zalogowane na to
-- samo konto dostają o tym wiadomość od razu i mogą pobrać zmianę, zamiast dowiadywać się o niej
-- dopiero przy własnym zapisie.
--
-- Reguły RLS obowiązują także tutaj: Realtime wysyła wiersz tylko temu, kto może go odczytać,
-- czyli właścicielowi projektu. Strony (projekty_strony) nie są publikowane – aplikacji wystarcza
-- numer wersji projektu, a treść pobiera zwykłym zapytaniem.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projekty'
  ) then
    alter publication supabase_realtime add table public.projekty;
  end if;
end
$$;
