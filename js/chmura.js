// Zapis projektów w Supabase: tabela `projekty` (jsonb) + bucket `zasoby`.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './konfiguracja.js';
import { blobZasobu } from './zasoby.js';
import { podstawaProjektu, kanon } from './laczenie.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
const BUCKET = 'zasoby';
const BUCKET_PODGLADOW = 'podglady'; // publiczny: obrazy stron udostępnionych linkiem

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
  try { const k = await kontoCzcionek(); await k.usun((await k.pliki()).map((p) => p.name)); } catch { /* brak plików */ }
  sprawdz(await sb.rpc('usun_konto'));
  await sb.auth.signOut({ scope: 'local' }).catch(() => {});
}

export async function listaWChmurze() {
  const sb = await supabase();
  return sprawdz(await sb.from('projekty')
    .select('id, nazwa, zmieniono, miniatura:dane->>miniatura, udostepnienie:dane->udostepnienie')
    .order('zmieniono', { ascending: false }));
}

// Zapis odrzucony, bo na koncie jest wersja zapisana z innego urządzenia.
export class KonfliktZapisu extends Error {
  constructor(zmieniono) {
    super('Projekt został zmieniony na innym urządzeniu.');
    this.konflikt = true;
    this.zmieniono = zmieniono;
  }
}

// Wysyła brakujące zasoby do Storage i zapisuje projekt (bez dataUrl) w tabeli.
// Uzupełnia `sciezka` w projekt.zasoby i `wersja_chmury` w projekcie.
// Kolumna `wersja` rośnie przy każdym zapisie; zapis przechodzi tylko wtedy,
// gdy na koncie jest ta wersja, którą to urządzenie widziało ostatnio.
// wymus: nadpisz wersję z konta (po decyzji użytkownika).
export async function zapiszWChmurze(projekt, { wymus = false } = {}) {
  const sb = await supabase();
  const uzytkownik = await biezacyUzytkownik();
  if (!uzytkownik) throw new Error('Nie jesteś zalogowany.');

  for (const [id, zasob] of Object.entries(projekt.zasoby || {})) {
    if (zasob.sciezka) continue;
    const blob = await blobZasobu(projekt, id); // świeży obraz ma treść w projekcie, zapisany – w magazynie przeglądarki
    if (!blob) continue;
    const sciezka = `${uzytkownik.id}/${projekt.id}/${id}`;
    sprawdz(await sb.storage.from(BUCKET).upload(sciezka, blob, {
      upsert: true, contentType: blob.type || 'application/octet-stream',
    }));
    zasob.sciezka = sciezka;
  }

  const zasobyBezDanych = Object.fromEntries(Object.entries(projekt.zasoby || {})
    .map(([id, { dataUrl, ...reszta }]) => [id, reszta]));
  const { wersja_chmury: znana, strony, ...reszta } = projekt;
  delete reszta.podstawa_chmury; // odciski ostatnio uzgodnionego stanu – sprawa tego urządzenia, nie konta
  // Odciski tego, co właśnie wysyłamy: po udanym zapisie to jest stan uzgodniony z kontem (js/laczenie.js).
  const podstawa = podstawaProjektu(projekt);
  // Strony leżą na koncie w osobnych wierszach. Wysyłamy tylko te, których treść
  // różni się od ostatnio wysłanej z tego urządzenia; przy wymuszeniu – wszystkie,
  // bo na koncie może być wersja z innego urządzenia. Porównujemy zapis o ustalonej
  // kolejności pól: baza oddaje pola w innej kolejności, niż je dostała.
  const teksty = new Map(strony.map((st) => [st.id, kanon(st)]));
  const poprzednie = (!wymus && znana && wyslaneStrony.get(projekt.id)) || new Map();
  const zmienione = [...teksty].filter(([id, tekst]) => poprzednie.get(id) !== tekst).map(([id, tekst]) => ({ id, dane: JSON.parse(tekst) }));
  const wynik = sprawdz(await sb.rpc('zapisz_projekt', {
    p_id: projekt.id,
    p_znana_wersja: znana ?? null,
    p_wymus: wymus,
    p_nazwa: projekt.nazwa,
    p_dane: { ...reszta, zasoby: zasobyBezDanych, strony: strony.map((st) => st.id), strony_osobno: true },
    p_zmieniono: projekt.zmieniono,
    p_strony: zmienione,
  }));
  if (wynik.konflikt) throw new KonfliktZapisu(wynik.zmieniono);
  projekt.wersja_chmury = wynik.wersja;
  projekt.podstawa_chmury = podstawa;
  wyslaneStrony.set(projekt.id, teksty);
  return { wyslaneStrony: zmienione.length, wszystkieStrony: strony.length };
}

// Treść stron ostatnio wysłanych na konto albo z niego wczytanych:
// id projektu → (id strony → JSON). Tylko w pamięci tej karty.
const wyslaneStrony = new Map();

export async function wczytajZChmury(id) {
  const sb = await supabase();
  const wiersz = sprawdz(await sb.from('projekty').select('dane, wersja').eq('id', id).single());
  const projekt = wiersz.dane;
  projekt.wersja_chmury = wiersz.wersja;
  // Nowszy zapis: strony w osobnych wierszach, w projekcie ich kolejność.
  // Starszy zapis miał strony w środku – wtedy nie ma czego doczytywać.
  if (projekt.strony_osobno) {
    const strony = new Map();
    for (let od = 0; ; od += 1000) {
      const porcja = sprawdz(await sb.from('projekty_strony').select('strona_id, dane').eq('projekt_id', id).order('strona_id').range(od, od + 999));
      for (const w of porcja) strony.set(w.strona_id, w.dane);
      if (porcja.length < 1000) break;
    }
    projekt.strony = projekt.strony.map((idStrony) => strony.get(idStrony)).filter(Boolean);
    delete projekt.strony_osobno;
    wyslaneStrony.set(id, new Map(projekt.strony.map((st) => [st.id, kanon(st)])));
  } else wyslaneStrony.delete(id);
  // Czcionki własne są potrzebne od razu i są małe – wracają w projekcie. Obrazy pobiera dopiero
  // otwarcie projektu, prosto do magazynu plików przeglądarki (js/zasoby.js: podlaczZasoby),
  // i tylko te, których na tym urządzeniu jeszcze nie ma.
  const czcionki = new Set((projekt.czcionki || []).map((c) => c.id));
  for (const [idZasobu, zasob] of Object.entries(projekt.zasoby || {})) {
    if (!zasob.sciezka || !czcionki.has(idZasobu)) continue;
    zasob.dataUrl = await blobNaDataUrl(await pobierzZasob(zasob.sciezka));
  }
  return projekt;
}

// Plik zasobu z konta (obraz albo czcionka) jako Blob.
export async function pobierzZasob(sciezka) {
  const sb = await supabase();
  return sprawdz(await sb.storage.from(BUCKET).download(sciezka));
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
  await usunPodglady(sb, `${uzytkownik?.id}/${id}`);
  sprawdz(await sb.from('projekty').delete().eq('id', id));
}

// ---------- „Moje czcionki” na koncie ----------
//
// Pliki czcionek użytkownika i ich spis leżą w jego prywatnym folderze w buckecie
// zasobów (<konto>/_czcionki/), więc obowiązują je te same zasady dostępu co obrazy projektów.
const FOLDER_CZCIONEK = '_czcionki';
const SPIS_CZCIONEK = 'spis.json';

export async function kontoCzcionek() {
  const sb = await supabase();
  const uzytkownik = await biezacyUzytkownik();
  if (!uzytkownik) throw new Error('Nie jesteś zalogowany.');
  const folder = `${uzytkownik.id}/${FOLDER_CZCIONEK}`;
  const magazyn = sb.storage.from(BUCKET);
  const pliki = async () => sprawdz(await magazyn.list(folder, { limit: 1000 })) || [];
  return {
    pliki,
    // Najpierw lista plików: brak spisu to pusty zbiór, a brak połączenia to błąd (nie „pusto”).
    spis: async () => {
      if (!(await pliki()).some((p) => p.name === SPIS_CZCIONEK)) return { czcionki: [], usuniete: [] };
      return JSON.parse(await sprawdz(await magazyn.download(`${folder}/${SPIS_CZCIONEK}`)).text());
    },
    zapiszSpis: async (spis) => sprawdz(await magazyn.upload(`${folder}/${SPIS_CZCIONEK}`, new Blob([JSON.stringify(spis)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '0' })),
    wyslij: async (plik, blob) => sprawdz(await magazyn.upload(`${folder}/${plik}`, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })),
    pobierz: async (plik) => sprawdz(await magazyn.download(`${folder}/${plik}`)),
    usun: async (lista) => (lista.length ? sprawdz(await magazyn.remove(lista.map((n) => `${folder}/${n}`))) : null),
  };
}

export function blobNaDataUrl(blob) {
  return new Promise((ok, blad) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => blad(r.error);
    r.readAsDataURL(blob);
  });
}

// ---------- Podgląd udostępniany linkiem ----------
//
// Udostępnienie to migawka: obrazy stron i manifest w publicznym buckecie pod
// ścieżką <konto>/<projekt>/<losowy kod>/. Kto zna link, widzi obrazy; do
// projektu i jego danych nie ma dostępu. Wyłączenie linku usuwa pliki.

export const adresPodgladu = (sciezka) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_PODGLADOW}/${sciezka}`;

async function plikiFolderu(sb, folder) {
  const wszystkie = [];
  for (let od = 0; ; od += 1000) {
    const czesc = sprawdz(await sb.storage.from(BUCKET_PODGLADOW).list(folder, { limit: 1000, offset: od }));
    wszystkie.push(...czesc);
    if (czesc.length < 1000) return wszystkie;
  }
}

async function usunPliki(sb, sciezki) {
  for (let i = 0; i < sciezki.length; i += 200) {
    sprawdz(await sb.storage.from(BUCKET_PODGLADOW).remove(sciezki.slice(i, i + 200)));
  }
}

// Usuwa wszystkie udostępnienia projektu (folder <konto>/<projekt>).
async function usunPodglady(sb, folderProjektu) {
  try {
    for (const kod of await plikiFolderu(sb, folderProjektu)) {
      const folder = `${folderProjektu}/${kod.name}`;
      await usunPliki(sb, (await plikiFolderu(sb, folder)).map((p) => `${folder}/${p.name}`));
    }
  } catch { /* brak bucketu albo plików – nie blokuje usuwania projektu */ }
}

// uklad: sekcje → wiersze → strony (podglad.js); obraz(strona) → Blob JPEG.
// Zwraca { konto, zaktualizowano }.
// odciski: { idStrony: skrót treści } – strona o tym samym skrócie co poprzednio nie jest nawet rysowana.
export async function opublikujPodglad(projektId, kod, uklad, strony, obraz, postep = () => {}, odciski = null) {
  const sb = await supabase();
  const uzytkownik = await biezacyUzytkownik();
  if (!uzytkownik) throw new Error('Nie jesteś zalogowany.');
  const folder = `${uzytkownik.id}/${projektId}/${kod}`;
  const magazyn = sb.storage.from(BUCKET_PODGLADOW);
  // Skróty obrazów z poprzedniej publikacji: strona, której obraz się nie
  // zmienił, nie jest wysyłana drugi raz.
  let poprzednie = {};
  let poprzednieTresci = {};
  try {
    const odp = await fetch(`${adresPodgladu(`${folder}/manifest.json`)}?t=${Date.now()}`, { cache: 'no-store' });
    if (odp.ok) { const m = await odp.json(); poprzednie = m.skroty || {}; poprzednieTresci = m.tresci || {}; }
  } catch { /* pierwsza publikacja albo brak sieci – wyślemy wszystko */ }
  const skroty = {};
  let gotowe = 0;
  let wyslane = 0;
  for (const s of strony) {
    if (odciski && poprzednie[s.id] && poprzednieTresci[s.id] === odciski[s.id]) {
      skroty[s.id] = poprzednie[s.id];
      gotowe += 1;
      postep(gotowe, strony.length);
      continue;
    }
    const plik = await obraz(s);
    skroty[s.id] = await skrotPliku(plik);
    if (poprzednie[s.id] !== skroty[s.id]) {
      sprawdz(await magazyn.upload(`${folder}/${s.id}.jpg`, plik, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' }));
      wyslane += 1;
    }
    gotowe += 1;
    postep(gotowe, strony.length);
  }
  // Obrazy stron usuniętych od poprzedniej aktualizacji.
  const potrzebne = new Set([...strony.map((s) => `${s.id}.jpg`), 'manifest.json']);
  const zbedne = (await plikiFolderu(sb, folder)).filter((p) => !potrzebne.has(p.name)).map((p) => `${folder}/${p.name}`);
  if (zbedne.length) await usunPliki(sb, zbedne);

  const zaktualizowano = new Date().toISOString();
  const manifest = { format: 'seriodruk-podglad', wersja: 1, zaktualizowano, v: Date.now(), uklad, skroty, ...(odciski ? { tresci: odciski } : {}) };
  sprawdz(await magazyn.upload(`${folder}/manifest.json`, new Blob([JSON.stringify(manifest)], { type: 'application/json' }), {
    upsert: true, contentType: 'application/json', cacheControl: '0',
  }));
  return { konto: uzytkownik.id, zaktualizowano, wyslane, wszystkie: strony.length };
}

async function skrotPliku(plik) {
  const bajty = new Uint8Array(await crypto.subtle.digest('SHA-256', await plik.arrayBuffer()));
  return [...bajty].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Wybór motywu zapisany na koncie – ten sam na każdym urządzeniu.
export async function zapiszMotyw(motyw) {
  const sb = await supabase();
  return sprawdz(await sb.auth.updateUser({ data: { motyw } })).user;
}

export async function wylaczPodglad(projektId, kod) {
  const sb = await supabase();
  const uzytkownik = await biezacyUzytkownik();
  if (!uzytkownik) throw new Error('Nie jesteś zalogowany.');
  const folder = `${uzytkownik.id}/${projektId}/${kod}`;
  await usunPliki(sb, (await plikiFolderu(sb, folder)).map((p) => `${folder}/${p.name}`));
}

// Odczyt bez logowania (zwykłe pobranie pliku z publicznego adresu).
export async function wczytajPodgladPubliczny(konto, projektId, kod) {
  if (!chmuraSkonfigurowana()) throw new Error('Podgląd jest niedostępny.');
  const folder = `${konto}/${projektId}/${kod}`;
  const odp = await fetch(`${adresPodgladu(`${folder}/manifest.json`)}?t=${Date.now()}`, { cache: 'no-store' });
  if (!odp.ok) throw new Error('Ten link nie działa – podgląd został wyłączony albo adres jest niepełny.');
  const manifest = await odp.json();
  if (manifest.format !== 'seriodruk-podglad') throw new Error('To nie jest podgląd projektu.');
  return { manifest, adresObrazu: (id) => `${adresPodgladu(`${folder}/${id}.jpg`)}?v=${manifest.v}` };
}
