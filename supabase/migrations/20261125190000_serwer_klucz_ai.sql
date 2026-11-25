-- Usługa składu dla łącznika MCP (#436): worker (klucz serwisowy) sprawdza klucz AI z zapytania łącznika –
-- czy obejmuje projekt i do kogo należy (pliki czcionek i obrazów bierze tylko z folderu właściciela).
-- Bez liczenia użycia klucza (to robią same narzędzia łącznika).
create or replace function public.serwer_klucz_ai(p_klucz text, p_projekt uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb;
begin
  if p_klucz is null or p_projekt is null then
    return jsonb_build_object('blad', 'Brak klucza albo projektu.');
  end if;
  d := public.ai_sprawdz_klucz(split_part(p_klucz, '/', 1) || '/' || p_projekt::text, false, false);
  if d ? 'blad' then
    return d;
  end if;
  return jsonb_build_object('owner_id', d->'owner_id', 'projekt_id', d->'projekt_id', 'rola', d->'rola');
end;
$$;

revoke all on function public.serwer_klucz_ai(text, uuid) from public, anon, authenticated;
grant execute on function public.serwer_klucz_ai(text, uuid) to service_role;
