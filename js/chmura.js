// Zapis projektów w Supabase: tabela `projekty` (jsonb) + bucket `zasoby`.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './konfiguracja.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
const BUCKET = 'zasoby';

let klient = null;

export const chmuraSkonfigurowana = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export async function supabase() {
  if (!chmuraSkonfigurowana()) throw new Error('Supabase nie jest skonfigurowany (js/konfiguracja.js).');
  if (!klient) {
    const { createClient } = await import(SUPABASE_JS);
    klient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
    });
  }
  return klient;
}

// Błąd z kodem Supabase (np. invalid_credentials), żeby komunikaty nie
// zależały od angielskiej treści.
function sprawdz({ data, error }) {
  if (error) {
    const e = new Error(error.message || String(error));
    e.kod = error.code || error.error_code || '';
    e.status = error.status;
    throw e;
  }
  return data;
}

export async function biezacyUzytkownik() {
  const sb = await supabase();
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function naZmianeSesji(callback) {
  const sb = await supabase();
  sb.auth.onAuthStateChange((zdarzenie, sesja) => callback(sesja?.user ?? null, zdarzenie));
}

const adresPowrotu = () => location.origin + location.pathname;

const KOMUNIKATY = {
  invalid_credentials: 'Nieprawidłowy e-mail lub hasło.',
  email_not_confirmed: 'Konto czeka na potwierdzenie – kliknij link z wiadomości e-mail.',
  user_already_exists: 'Konto z tym adresem już istnieje. Zaloguj się albo przypomnij hasło.',
  email_exists: 'Ten adres e-mail jest już zajęty.',
  weak_password: 'Hasło jest za słabe.',
  same_password: 'Nowe hasło musi różnić się od obecnego.',
  email_address_invalid: 'Nieprawidłowy adres e-mail.',
  validation_failed: 'Sprawdź wpisane dane.',
  signup_disabled: 'Zakładanie kont jest teraz wyłączone.',
  over_email_send_rate_limit: 'Za dużo wiadomości w krótkim czasie. Spróbuj ponownie za kilka minut.',
  over_request_rate_limit: 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.',
  otp_expired: 'Link wygasł albo został już użyty. Poproś o nowy.',
  session_not_found: 'Sesja wygasła. Zaloguj się ponownie.',
  user_not_found: 'Nie ma takiego konta.',
};

// Komunikaty Supabase po polsku.
export function komunikatBledu(e) {
  if (e?.kod && KOMUNIKATY[e.kod]) return KOMUNIKATY[e.kod];
  const m = String(e?.message || e || '');
  const mapa = [
    [/invalid login credentials/i, KOMUNIKATY.invalid_credentials],
    [/email not confirmed/i, KOMUNIKATY.email_not_confirmed],
    [/already registered/i, KOMUNIKATY.user_already_exists],
    [/password should be at least (\d+)/i, (r) => `Hasło musi mieć co najmniej ${r[1]} znaków.`],
    [/should be different from the old/i, KOMUNIKATY.same_password],
    [/unable to validate email|invalid email/i, KOMUNIKATY.email_address_invalid],
    [/rate limit|too many requests|security purposes/i, KOMUNIKATY.over_request_rate_limit],
    [/expired|invalid.*link/i, KOMUNIKATY.otp_expired],
    [/failed to fetch|network|load failed/i, 'Brak połączenia z serwerem. Sprawdź internet.'],
    [/signups not allowed/i, KOMUNIKATY.signup_disabled],
  ];
  for (const [wzor, tekst] of mapa) {
    const r = m.match(wzor);
    if (r) return typeof tekst === 'function' ? tekst(r) : tekst;
  }
  return m || 'Wystąpił nieznany błąd.';
}

// ---------- Konto ----------

export const nazwaUzytkownika = (u) => (u?.user_metadata?.nazwa || '').trim() || (u?.email || '').split('@')[0];

export async function zalogujHaslem(email, haslo) {
  const sb = await supabase();
  return sprawdz(await sb.auth.signInWithPassword({ email, password: haslo })).user;
}

// Zakłada konto. Zwraca 'potwierdz' (wysłano link) albo 'zalogowano'
// (gdy projekt Supabase nie wymaga potwierdzenia adresu).
export async function zarejestruj(email, haslo, nazwa) {
  const sb = await supabase();
  const dane = sprawdz(await sb.auth.signUp({
    email,
    password: haslo,
    options: { emailRedirectTo: adresPowrotu(), data: { nazwa: nazwa || '' } },
  }));
  // Dla istniejącego, potwierdzonego adresu Supabase nie zwraca błędu,
  // tylko konto bez tożsamości – nie zdradzamy tego inaczej niż komunikatem.
  if (dane.user && Array.isArray(dane.user.identities) && dane.user.identities.length === 0) {
    const e = new Error('User already registered');
    e.kod = 'user_already_exists';
    throw e;
  }
  return dane.session ? 'zalogowano' : 'potwierdz';
}

export async function wyslijPotwierdzeniePonownie(email) {
  const sb = await supabase();
  sprawdz(await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: adresPowrotu() } }));
}

export async function wyslijResetHasla(email) {
  const sb = await supabase();
  sprawdz(await sb.auth.resetPasswordForEmail(email, { redirectTo: adresPowrotu() }));
}

export async function ustawNoweHaslo(haslo) {
  const sb = await supabase();
  return sprawdz(await sb.auth.updateUser({ password: haslo })).user;
}

export async function zmienNazwe(nazwa) {
  const sb = await supabase();
  return sprawdz(await sb.auth.updateUser({ data: { nazwa } })).user;
}

// Wysyła link potwierdzający na nowy adres; do kliknięcia obowiązuje stary.
export async function zmienEmail(email) {
  const sb = await supabase();
  return sprawdz(await sb.auth.updateUser({ email }, { emailRedirectTo: adresPowrotu() })).user;
}

export async function wyloguj(wszedzie = false) {
  const sb = await supabase();
  sprawdz(await sb.auth.signOut({ scope: wszedzie ? 'global' : 'local' }));
}

// Usuwa pliki, projekty i samo konto (funkcja usun_konto w bazie).
export async function usunKonto() {
  const sb = await supabase();
  for (const p of await listaWChmurze()) await usunZChmury(p.id);
  sprawdz(await sb.rpc('usun_konto'));
  await sb.auth.signOut({ scope: 'local' }).catch(() => {});
}

export async function listaWChmurze() {
  const sb = await supabase();
  return sprawdz(await sb.from('projekty')
    .select('id, nazwa, zmieniono, miniatura:dane->>miniatura')
    .order('zmieniono', { ascending: false }));
}

// Wysyła brakujące zasoby do Storage i zapisuje projekt (bez dataUrl) w tabeli.
// Uzupełnia `sciezka` w projekt.zasoby, żeby kolejne zapisy nie wysyłały ich znowu.
export async function zapiszWChmurze(projekt) {
  const sb = await supabase();
  const uzytkownik = await biezacyUzytkownik();
  if (!uzytkownik) throw new Error('Nie jesteś zalogowany.');

  for (const [id, zasob] of Object.entries(projekt.zasoby || {})) {
    if (zasob.sciezka || !zasob.dataUrl) continue;
    const blob = await (await fetch(zasob.dataUrl)).blob();
    const sciezka = `${uzytkownik.id}/${projekt.id}/${id}`;
    sprawdz(await sb.storage.from(BUCKET).upload(sciezka, blob, {
      upsert: true, contentType: blob.type || 'application/octet-stream',
    }));
    zasob.sciezka = sciezka;
  }

  const zasobyBezDanych = Object.fromEntries(Object.entries(projekt.zasoby || {})
    .map(([id, { dataUrl, ...reszta }]) => [id, reszta]));
  const dane = { ...projekt, zasoby: zasobyBezDanych };

  sprawdz(await sb.from('projekty').upsert({
    id: projekt.id,
    owner_id: uzytkownik.id,
    nazwa: projekt.nazwa,
    dane,
    zmieniono: projekt.zmieniono,
  }));
}

export async function wczytajZChmury(id) {
  const sb = await supabase();
  const wiersz = sprawdz(await sb.from('projekty').select('dane').eq('id', id).single());
  const projekt = wiersz.dane;
  for (const zasob of Object.values(projekt.zasoby || {})) {
    if (!zasob.sciezka) continue;
    const blob = sprawdz(await sb.storage.from(BUCKET).download(zasob.sciezka));
    zasob.dataUrl = await blobNaDataUrl(blob);
  }
  return projekt;
}

export async function usunZChmury(id) {
  const sb = await supabase();
  const uzytkownik = await biezacyUzytkownik();
  if (uzytkownik) {
    const folder = `${uzytkownik.id}/${id}`;
    const pliki = sprawdz(await sb.storage.from(BUCKET).list(folder));
    if (pliki?.length) {
      sprawdz(await sb.storage.from(BUCKET).remove(pliki.map((p) => `${folder}/${p.name}`)));
    }
  }
  sprawdz(await sb.from('projekty').delete().eq('id', id));
}

export function blobNaDataUrl(blob) {
  return new Promise((ok, blad) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => blad(r.error);
    r.readAsDataURL(blob);
  });
}
