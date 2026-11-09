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

function sprawdz({ data, error }) {
  if (error) throw new Error(error.message || String(error));
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

// Komunikaty Supabase Auth po polsku (najczęstsze przypadki).
export function komunikatBledu(e) {
  const m = String(e?.message || e || '');
  const mapa = [
    [/invalid login credentials/i, 'Nieprawidłowy e-mail lub hasło.'],
    [/email not confirmed/i, 'Adres e-mail nie został jeszcze potwierdzony. Sprawdź skrzynkę.'],
    [/user already registered/i, 'Konto z tym adresem już istnieje. Zaloguj się.'],
    [/password should be at least (\d+)/i, (r) => `Hasło musi mieć co najmniej ${r[1]} znaków.`],
    [/unable to validate email|invalid email/i, 'Nieprawidłowy adres e-mail.'],
    [/rate limit|too many requests|security purposes/i, 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.'],
    [/failed to fetch|network/i, 'Brak połączenia z serwerem. Sprawdź internet.'],
    [/signups not allowed/i, 'Rejestracja nowych kont jest wyłączona.'],
  ];
  for (const [wzor, tekst] of mapa) {
    const r = m.match(wzor);
    if (r) return typeof tekst === 'function' ? tekst(r) : tekst;
  }
  return m || 'Wystąpił nieznany błąd.';
}

export async function zalogujHaslem(email, haslo) {
  const sb = await supabase();
  return sprawdz(await sb.auth.signInWithPassword({ email, password: haslo })).user;
}

// Zwraca true, jeśli trzeba potwierdzić e-mail przed pierwszym logowaniem.
export async function zarejestruj(email, haslo) {
  const sb = await supabase();
  const dane = sprawdz(await sb.auth.signUp({
    email, password: haslo, options: { emailRedirectTo: adresPowrotu() },
  }));
  return !dane.session;
}

export async function wyslijResetHasla(email) {
  const sb = await supabase();
  sprawdz(await sb.auth.resetPasswordForEmail(email, { redirectTo: adresPowrotu() }));
}

export async function ustawNoweHaslo(haslo) {
  const sb = await supabase();
  sprawdz(await sb.auth.updateUser({ password: haslo }));
}

export async function wyloguj() {
  const sb = await supabase();
  sprawdz(await sb.auth.signOut());
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
