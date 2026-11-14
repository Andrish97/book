-- Klucze VAPID powiadomień push bez sekretów (decyzja #113a): para tworzy się sama przy pierwszym użyciu
-- Funkcji Edge powiadomienia i zostaje tu na stałe. Tabela tylko dla klucza serwisowego – bez polityk RLS,
-- więc konta (anon, authenticated) jej nie widzą. Klucz publiczny przeglądarka dostaje z Funkcji Edge.

create table if not exists public.push_klucze (
  id smallint primary key default 1 check (id = 1),
  publiczny text not null,
  prywatny text not null,
  utworzono timestamptz not null default now()
);
alter table public.push_klucze enable row level security;
revoke all on public.push_klucze from anon, authenticated;

-- Zwraca zapisaną parę; gdy jej nie ma, zapisuje podaną (pierwsza wygrywa – dwa równoczesne wywołania
-- dostaną tę samą parę).
create or replace function public.push_klucze_zapewnij(p_publiczny text default null, p_prywatny text default null)
returns table (publiczny text, prywatny text)
language plpgsql security definer set search_path = public as $$
begin
  if p_publiczny is not null and p_prywatny is not null then
    insert into public.push_klucze (id, publiczny, prywatny) values (1, p_publiczny, p_prywatny)
    on conflict (id) do nothing;
  end if;
  return query select k.publiczny, k.prywatny from public.push_klucze k where k.id = 1;
end $$;
revoke all on function public.push_klucze_zapewnij(text, text) from public, anon, authenticated;
grant execute on function public.push_klucze_zapewnij(text, text) to service_role;
