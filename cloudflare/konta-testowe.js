// Pula kont testowych (plan I8 – konto dla recenzentów katalogu łączników Claude i do testów łącznika AI):
// każde konto z adresem test-<etykieta>@makietka.app jest kontem testowym. Administrator tworzy je w panelu
// (zakładka „Konta testowe”) jednym przyciskiem – od razu potwierdzone, bez e-maila (adresy w domenie nie muszą
// mieć skrzynki) – zmienia im hasło i je usuwa. Konta zakłada API administracyjne Supabase Auth (klucz serwisowy
// zna tylko worker); lista i przykładowe projekty – funkcje bazy admin_konta_testowe* (tylko administrator).
//
// POST /admin/konta-testowe  { akcja: 'utworz', etykieta? } → { id, email, haslo }
//                            { akcja: 'haslo', id }          → { id, email, haslo }
//                            { akcja: 'usun', id }           → { usunieto: true }

export const DOMENA_TESTOWA = 'makietka.app';
export const jestTestowy = (email) => /^test-[a-z0-9-]{1,40}@makietka\.app$/i.test(String(email || ''));

const naglowkiSerwisowe = (k) => (String(k).startsWith('sb_') ? { apikey: k } : { apikey: k, authorization: `Bearer ${k}` });

// Hasło łatwe do przepisania z ekranu: 4 grupy po 4 znaki bez mylących liter (0/O, 1/l/I).
export function noweHaslo(losuj = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const znaki = 'abcdefghijkmnpqrstuvwxyz23456789';
  const b = losuj(16);
  return [0, 4, 8, 12].map((i) => [...b.slice(i, i + 4)].map((x) => znaki[x % znaki.length]).join('')).join('-');
}

export function etykieta(z) {
  const e = String(z || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return e || `${Date.now().toString(36)}`;
}

export async function obsluzKontaTestowe(zapytanie, env, { json, naglowkiCors, tokenZZapytania, uzytkownik, rpc, baza }) {
  const cors = naglowkiCors(zapytanie, false);
  if (zapytanie.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (zapytanie.method !== 'POST') return json(405, { blad: 'Tylko POST.' }, cors);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json(503, { blad: 'Konta testowe nie są jeszcze gotowe (brak klucza serwisowego w workerze).' }, cors);
  const token = tokenZZapytania(zapytanie);
  if (!token || !await uzytkownik(env, token)) return json(401, { blad: 'Zaloguj się.' }, cors);
  if (await rpc(env, token, 'czy_administrator', {}).catch(() => false) !== true) return json(403, { blad: 'Tylko dla administratora.' }, cors);
  const dane = await zapytanie.json().catch(() => ({}));
  const auth = (sciezka, metoda, tresc) => fetch(`${baza(env)}/auth/v1/admin/${sciezka}`, {
    method: metoda,
    headers: { ...naglowkiSerwisowe(env.SUPABASE_SERVICE_ROLE_KEY), 'content-type': 'application/json' },
    body: tresc ? JSON.stringify(tresc) : undefined,
  });
  // Konto do zmiany albo usunięcia – tylko z puli testowej.
  const testowe = async (id) => {
    const odp = await auth(`users/${encodeURIComponent(String(id || ''))}`, 'GET');
    const u = odp.ok ? await odp.json() : null;
    return u && jestTestowy(u.email) ? u : null;
  };

  if (dane.akcja === 'utworz') {
    const email = `test-${etykieta(dane.etykieta)}@${DOMENA_TESTOWA}`;
    const haslo = noweHaslo();
    const odp = await auth('users', 'POST', { email, password: haslo, email_confirm: true, user_metadata: { konto_testowe: true } });
    const w = await odp.json().catch(() => ({}));
    if (!odp.ok) return json(odp.status === 422 ? 409 : 502, { blad: odp.status === 422 ? `Konto ${email} już jest – wybierz inną nazwę.` : (w.msg || w.message || 'Nie udało się założyć konta.') }, cors);
    return json(200, { id: w.id, email, haslo }, cors);
  }
  if (dane.akcja === 'haslo' || dane.akcja === 'usun') {
    const u = await testowe(dane.id);
    if (!u) return json(404, { blad: 'To nie jest konto testowe.' }, cors);
    if (dane.akcja === 'usun') {
      const odp = await auth(`users/${u.id}`, 'DELETE');
      return odp.ok ? json(200, { usunieto: true }, cors) : json(502, { blad: 'Nie udało się usunąć konta.' }, cors);
    }
    const haslo = noweHaslo();
    const odp = await auth(`users/${u.id}`, 'PUT', { password: haslo });
    return odp.ok ? json(200, { id: u.id, email: u.email, haslo }, cors) : json(502, { blad: 'Nie udało się zmienić hasła.' }, cors);
  }
  return json(400, { blad: 'Nieznana akcja.' }, cors);
}
