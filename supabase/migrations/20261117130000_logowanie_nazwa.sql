-- Migracja: logowanie nazwą użytkownika (decyzja #192).
--
-- „Zrób logowanie nazwą użytkownika też.”
--
-- Supabase loguje adresem e-mail. Pole „E-mail albo nazwa użytkownika”: gdy wpisano nazwę, aplikacja pyta
-- funkcję email_do_logowania(nazwa, hasło). Funkcja sama sprawdza hasło (ten sam skrót bcrypt co w auth.users)
-- i oddaje adres e-mail TYLKO przy zgodnym haśle – po samej nazwie nie da się poznać cudzego adresu. Potem
-- aplikacja loguje się zwykle (adres + hasło), więc sesja, potwierdzenie adresu i blokady Supabase działają
-- jak dotąd. Nieudane próby liczy tabela proby_logowania_nazwa: 10 nieudanych prób tej samej nazwy w 15 minut
-- blokuje ją na kwadrans (funkcja nie jest więc furtką do zgadywania haseł bez limitu).

create table if not exists public.proby_logowania_nazwa (
  nazwa text not null,
  kiedy timestamptz not null default now()
);
create index if not exists proby_logowania_nazwa_idx on public.proby_logowania_nazwa (nazwa, kiedy);
alter table public.proby_logowania_nazwa enable row level security;
revoke all on table public.proby_logowania_nazwa from anon, authenticated;

create or replace function public.email_do_logowania(p_nazwa text, p_haslo text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v text := lower(btrim(coalesce(p_nazwa, '')));
  v_email text;
  v_skrot text;
begin
  if v = '' or coalesce(p_haslo, '') = '' then return null; end if;
  delete from public.proby_logowania_nazwa where nazwa = v and kiedy < now() - interval '1 day';
  if (select count(*) from public.proby_logowania_nazwa where nazwa = v and kiedy > now() - interval '15 minutes') >= 10 then
    raise exception 'za_duzo_prob_logowania: Za dużo nieudanych prób logowania tą nazwą. Spróbuj ponownie za kwadrans albo zaloguj się adresem e-mail.';
  end if;
  select u.email, u.encrypted_password into v_email, v_skrot
    from public.profile p
    join auth.users u on u.id = p.id
   where lower(p.nazwa) = v and u.deleted_at is null;
  if v_skrot is not null and v_skrot <> '' and v_skrot = extensions.crypt(p_haslo, v_skrot) then
    delete from public.proby_logowania_nazwa where nazwa = v;
    return v_email;
  end if;
  -- Brak konta albo złe hasło: ta sama odpowiedź (null) i podobny czas.
  if v_skrot is null then perform extensions.crypt(p_haslo, extensions.gen_salt('bf', 10)); end if;
  insert into public.proby_logowania_nazwa (nazwa) values (v);
  return null;
end;
$$;
revoke all on function public.email_do_logowania(text, text) from public;
grant execute on function public.email_do_logowania(text, text) to anon, authenticated;
