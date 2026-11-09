-- Migracja: tabela projektów i bucket na zasoby (sekcja 9 planu).
-- Stosowana automatycznie przy pushu na main (.github/workflows/deploy.yml)
-- (lub ręcznie: supabase db push / wklejenie w SQL Editor).
-- Od początku jest owner_id i RLS, więc późniejsze udostępnianie innym
-- osobom nie wymaga przebudowy.

create table if not exists public.projekty (
  id          uuid primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nazwa       text not null default 'Projekt',
  dane        jsonb not null,
  utworzono   timestamptz not null default now(),
  zmieniono   timestamptz not null default now()
);

create index if not exists projekty_owner_zmieniono on public.projekty (owner_id, zmieniono desc);

alter table public.projekty enable row level security;

drop policy if exists "projekty: odczyt własnych" on public.projekty;
create policy "projekty: odczyt własnych" on public.projekty
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "projekty: dodawanie własnych" on public.projekty;
create policy "projekty: dodawanie własnych" on public.projekty
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "projekty: zmiana własnych" on public.projekty;
create policy "projekty: zmiana własnych" on public.projekty
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "projekty: usuwanie własnych" on public.projekty;
create policy "projekty: usuwanie własnych" on public.projekty
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Zasoby (obrazy, później czcionki): prywatny bucket, każdy użytkownik ma
-- własny folder <owner_id>/<projekt_id>/<zasob_id>.
insert into storage.buckets (id, name, public)
values ('zasoby', 'zasoby', false)
on conflict (id) do nothing;

drop policy if exists "zasoby: własny folder - odczyt" on storage.objects;
create policy "zasoby: własny folder - odczyt" on storage.objects
  for select to authenticated
  using (bucket_id = 'zasoby' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "zasoby: własny folder - dodawanie" on storage.objects;
create policy "zasoby: własny folder - dodawanie" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'zasoby' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "zasoby: własny folder - zmiana" on storage.objects;
create policy "zasoby: własny folder - zmiana" on storage.objects
  for update to authenticated
  using (bucket_id = 'zasoby' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "zasoby: własny folder - usuwanie" on storage.objects;
create policy "zasoby: własny folder - usuwanie" on storage.objects
  for delete to authenticated
  using (bucket_id = 'zasoby' and (storage.foldername(name))[1] = (select auth.uid())::text);
