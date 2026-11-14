// Zapis projektów w Supabase: tabela `projekty` (jsonb) + bucket `zasoby`.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './konfiguracja.js';
import { blobZasobu } from './zasoby.js';
import { podstawaProjektu, kanon } from './laczenie.js';
import { biblioteka } from './biblioteki.js';

// Biblioteka Supabase leży w repozytorium (js/zewnetrzne/) – aplikacja nie pobiera kodu z obcych serwerów.
const SUPABASE_JS = 'js/zewnetrzne/supabase-js-2.57.4.umd.js';
const BUCKET = 'zasoby';
const BUCKET_PODGLADOW = 'podglady'; // publiczny: obrazy stron udostępnionych linkiem
const ROK_S = 365 * 24 * 3600;

let klient = null;

export const chmuraSkonfigurowana = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export async function supabase() {
  if (!chmuraSkonfigurowana()) throw new Error('Supabase nie jest skonfigurowany (js/konfiguracja.js).');
  if (!klient) {
    const { createClient } = await biblioteka(SUPABASE_JS, 'supabase', 'biblioteki logowania');
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

// Link z wiadomości e-mail (rejestracja, reset hasła, zmiana adresu, link logowania): token z linku
// zamienia się na sesję. typ: signup | recovery | email_change | magiclink | invite | email.
export async function potwierdzLink(tokenHash, typ) {
  const sb = await supabase();
  return sprawdz(await sb.auth.verifyOtp({ token_hash: tokenHash, type: typ }));
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
    .select('id, owner_id, nazwa, zmieniono, miniatura:dane->>miniatura, udostepnienie:dane->udostepnienie')
    .order('zmieniono', { ascending: false }));
}

// Numer wersji projektu na koncie (tanie zapytanie o jedną liczbę) albo null, gdy projektu tam nie ma.
export async function wersjaNaKoncie(id) {
  const sb = await supabase();
  const wiersz = sprawdz(await sb.from('projekty').select('wersja, zmieniono').eq('id', id).maybeSingle());
  return wiersz ? { wersja: Number(wiersz.wersja), zmieniono: wiersz.zmieniono } : null;
}

// ---------- Zmiany na żywo (Supabase Realtime) ----------
//
// Każdy zapis projektu zmienia jego wiersz w tabeli `projekty` (rośnie numer wersji). Kanał Realtime
// przekazuje to od razu pozostałym urządzeniom zalogowanym na to samo konto; RLS pilnuje, żeby nikt
// nie dostał cudzych wierszy. Z wiadomości bierzemy tylko identyfikator i numer wersji – treść
// projektu aplikacja pobiera sama, zwykłym zapytaniem.
let kanal = null;

// naZmiane({ id, wersja, zmieniono }) – projekt zapisano albo dodano na koncie (także z tego urządzenia);
// naStan(polaczony) – kanał działa albo przestał. Zwraca dopiero po zgłoszeniu kanału (nie po połączeniu).
export async function sluchajZmian(uzytkownik, naZmiane, naStan = () => {}) {
  const sb = await supabase();
  await przestanSluchac();
  // Kanał musi dołączyć już z tokenem zalogowanego konta – inaczej serwer traktuje go jak gościa
  // i (przez RLS) nie wysyła żadnych wierszy. Odświeżone tokeny biblioteka dosyła sama.
  const { data } = await sb.auth.getSession();
  if (data.session?.access_token) await sb.realtime.setAuth(data.session.access_token);
  // Bez filtra po właścicielu: RLS przepuszcza wiersze własnych projektów i projektów, do których to konto
  // zaproszono (współpraca, migracja 20261114120000_wspolpraca.sql).
  const filtr = { schema: 'public', table: 'projekty' };
  const przekaz = (z) => {
    const w = z?.new;
    if (w?.id) naZmiane({ id: w.id, wersja: Number(w.wersja), zmieniono: w.zmieniono });
  };
  kanal = sb.channel(`projekty-${uzytkownik.id}`)
    .on('postgres_changes', { event: 'INSERT', ...filtr }, przekaz)
    .on('postgres_changes', { event: 'UPDATE', ...filtr }, przekaz)
    .subscribe((status) => naStan(status === 'SUBSCRIBED'));
}

export async function przestanSluchac() {
  if (!kanal) return;
  const stary = kanal;
  kanal = null;
  try { await (await supabase()).removeChannel(stary); } catch { /* kanał już zamknięty */ }
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
export async function zapiszWChmurze(projekt, { wymus = false, postep = null } = {}) {
  const sb = await supabase();
  const uzytkownik = await biezacyUzytkownik();
  if (!uzytkownik) throw new Error('Nie jesteś zalogowany.');

  // Obrazy wgrane przez AI (ścieżka „ai:<id>”) czekają w tabeli bazy – przy zapisie przechodzą do folderu
  // plików konta jak każdy nowy obraz, a po udanym zapisie projektu wiersz w tabeli jest usuwany.
  const odAi = [];
  // postep(gotowe, razem) – wysyłka nowych plików (duże zdjęcia trwają).
  const nowe = Object.entries(projekt.zasoby || {}).filter(([, z]) => z && (!z.sciezka || czyOdAi(z.sciezka)));
  let wyslane = 0;
  for (const [id, zasob] of nowe) {
    postep?.(wyslane, nowe.length);
    wyslane += 1;
    const blob = await blobZasobu(projekt, id); // świeży obraz ma treść w projekcie, zapisany – w magazynie przeglądarki
    if (!blob) continue;
    // Pliki projektu leżą w folderze jego właściciela – także te wgrane przez współpracownika.
    const sciezka = `${projekt.wspolpraca_chmury?.wlasciciel || uzytkownik.id}/${projekt.id}/${id}`;
    // Plik pod tą ścieżką nigdy się nie zmienia (podmiana i zmiana nazwy dają nowy identyfikator, #68), więc
    // przeglądarka i sieć dostarczania mogą go trzymać długo – kolejne pobranie nie liczy się do transferu.
    sprawdz(await sb.storage.from(BUCKET).upload(sciezka, blob, {
      upsert: true, contentType: blob.type || zasob.typ || 'application/octet-stream', cacheControl: String(ROK_S),
    }));
    if (czyOdAi(zasob.sciezka)) odAi.push(zasob.sciezka);
    zasob.sciezka = sciezka;
  }

  const zasobyBezDanych = Object.fromEntries(Object.entries(projekt.zasoby || {})
    .map(([id, { dataUrl, ...reszta }]) => [id, reszta]));
  const { wersja_chmury: znana, strony, ...reszta } = projekt;
  delete reszta.podstawa_chmury; // odciski ostatnio uzgodnionego stanu – sprawa tego urządzenia, nie konta
  delete reszta.wspolpraca_chmury; // czyj to projekt i jaka moja rola – wie to baza, nie treść projektu
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
  // Skróty stron, które właśnie wysłaliśmy, policzy baza – przy następnym łączeniu te strony przyjdą z konta
  // (pozostałe na koncie się nie zmieniły i ich treść jest tu znana).
  const skroty = skrotyKonta.get(projekt.id);
  if (skroty) { for (const st of zmienione) skroty.delete(st.id); for (const k of [...skroty.keys()]) if (!teksty.has(k)) skroty.delete(k); }
  // Obraz od AI jest już w folderze konta i projekt na koncie na niego wskazuje – wiersz w tabeli niepotrzebny.
  for (const s of new Set(odAi)) {
    if (Object.values(projekt.zasoby || {}).some((z) => z.sciezka === s)) continue; // inny wpis wciąż go używa
    try { await usunZasobZKonta(s); } catch { /* zostanie; usunie go następny zapis albo usunięcie projektu */ }
  }
  return { wyslaneStrony: zmienione.length, wszystkieStrony: strony.length };
}

// Treść stron ostatnio wysłanych na konto albo z niego wczytanych:
// id projektu → (id strony → JSON). Tylko w pamięci tej karty.
const wyslaneStrony = new Map();
// Skróty treści stron na koncie (kolumna projekty_strony.skrot liczona przez bazę, migracja
// 20261114150000_miejsce_na_koncie.sql) dla stron, których treść jest w wyslaneStrony: id projektu → (id strony → skrót).
const skrotyKonta = new Map();
// Pliki czcionek z konta już pobrane w tej karcie: ścieżka → data URL (plik pod ścieżką się nie zmienia).
const czcionkiZKonta = new Map();

// Usuwa z konta plik obrazu usuniętego z projektu (js/obrazy-projektu.js). Bez sieci plik zostaje –
// nic nie wskazuje na niego w projekcie, więc jest tylko zajętym miejscem.
export async function usunZasobZKonta(sciezka) {
  if (!sciezka) return;
  const sb = await supabase();
  if (czyOdAi(sciezka)) { sprawdz(await sb.rpc('usun_obraz_ai', { p_id: sciezka.slice(3) })); return; }
  sprawdz(await sb.storage.from(BUCKET).remove([sciezka]));
}

// Obraz wgrany przez AI: czeka w tabeli obrazy_ai (migracja 20261112090000_obrazy_ai.sql), w projekcie ma
// ścieżkę „ai:<id wiersza>”.
export const czyOdAi = (sciezka) => typeof sciezka === 'string' && sciezka.startsWith('ai:');

// Pliki obrazów, które AI usunęło albo zastąpiło: funkcja bazy nie może usunąć pliku z folderu konta, więc
// zostawia listę – aplikacja właściciela usuwa te pliki przy otwarciu projektu i po połączeniu zmian.
export async function sprzatnijPliki(projektId) {
  const sb = await supabase();
  const sciezki = sprawdz(await sb.rpc('pliki_do_usuniecia', { p_projekt: projektId })) || [];
  if (!sciezki.length) return 0;
  sprawdz(await sb.storage.from(BUCKET).remove(sciezki));
  sprawdz(await sb.rpc('pliki_usuniete', { p_projekt: projektId, p_sciezki: sciezki }));
  return sciezki.length;
}

export async function wczytajZChmury(id) {
  const sb = await supabase();
  const wiersz = sprawdz(await sb.from('projekty').select('dane, wersja').eq('id', id).single());
  const projekt = wiersz.dane;
  projekt.wersja_chmury = wiersz.wersja;
  // Nowszy zapis: strony w osobnych wierszach, w projekcie ich kolejność.
  // Starszy zapis miał strony w środku – wtedy nie ma czego doczytywać.
  if (projekt.strony_osobno) {
    const strony = await stronyZKonta(sb, id);
    projekt.strony = projekt.strony.map((idStrony) => strony.get(idStrony)).filter(Boolean);
    delete projekt.strony_osobno;
    wyslaneStrony.set(id, new Map(projekt.strony.map((st) => [st.id, kanon(st)])));
  } else { wyslaneStrony.delete(id); skrotyKonta.delete(id); }
  // Czcionki własne są potrzebne od razu i są małe – wracają w projekcie. Obrazy pobiera dopiero
  // otwarcie projektu, prosto do magazynu plików przeglądarki (js/zasoby.js: podlaczZasoby),
  // i tylko te, których na tym urządzeniu jeszcze nie ma.
  const czcionki = new Set((projekt.czcionki || []).map((c) => c.id));
  for (const [idZasobu, zasob] of Object.entries(projekt.zasoby || {})) {
    if (!zasob.sciezka || !czcionki.has(idZasobu)) continue;
    if (!czcionkiZKonta.has(zasob.sciezka)) czcionkiZKonta.set(zasob.sciezka, await blobNaDataUrl(await pobierzZasob(zasob.sciezka)));
    zasob.dataUrl = czcionkiZKonta.get(zasob.sciezka);
  }
  return projekt;
}

// Wiersze stron projektu porcjami po 1000 (limit odpowiedzi bazy).
async function wszystkieWiersze(zapytanie) {
  const wynik = [];
  for (let od = 0; ; od += 1000) {
    const porcja = sprawdz(await zapytanie().order('strona_id').range(od, od + 999));
    wynik.push(...porcja);
    if (porcja.length < 1000) return wynik;
  }
}

// Strony projektu z konta: id strony → dane. Gdy ta karta zna już treść stron (wczytała je albo wysłała),
// pobiera najpierw same skróty (kilkadziesiąt bajtów na stronę) i ściąga tylko strony o innym skrócie –
// przy zmianie z innego urządzenia albo od AI nie cały projekt, tylko to, co się zmieniło.
async function stronyZKonta(sb, id) {
  const znane = skrotyKonta.get(id);
  const teksty = wyslaneStrony.get(id);
  const strony = new Map();
  const skroty = new Map();
  if (znane?.size && teksty) {
    let lista = null;
    try { lista = await wszystkieWiersze(() => sb.from('projekty_strony').select('strona_id, skrot').eq('projekt_id', id)); } catch { /* baza bez kolumny skrot */ }
    if (lista && lista.every((w) => w.skrot)) {
      const brak = [];
      for (const w of lista) {
        skroty.set(w.strona_id, w.skrot);
        if (znane.get(w.strona_id) === w.skrot && teksty.has(w.strona_id)) strony.set(w.strona_id, JSON.parse(teksty.get(w.strona_id)));
        else brak.push(w.strona_id);
      }
      for (let i = 0; i < brak.length; i += 100) {
        for (const w of sprawdz(await sb.from('projekty_strony').select('strona_id, skrot, dane').eq('projekt_id', id).in('strona_id', brak.slice(i, i + 100)))) {
          strony.set(w.strona_id, w.dane);
          skroty.set(w.strona_id, w.skrot);
        }
      }
      skrotyKonta.set(id, skroty);
      return strony;
    }
  }
  // Pierwsze wczytanie w tej karcie (albo baza bez kolumny skrot): wszystkie strony.
  let wiersze;
  try { wiersze = await wszystkieWiersze(() => sb.from('projekty_strony').select('strona_id, skrot, dane').eq('projekt_id', id)); } catch {
    wiersze = await wszystkieWiersze(() => sb.from('projekty_strony').select('strona_id, dane').eq('projekt_id', id));
  }
  for (const w of wiersze) { strony.set(w.strona_id, w.dane); if (w.skrot) skroty.set(w.strona_id, w.skrot); }
  if (skroty.size) skrotyKonta.set(id, skroty); else skrotyKonta.delete(id);
  return strony;
}

function zBase64Bajty(b64) {
  const tekst = atob(String(b64 || '').replace(/\s+/g, ''));
  const bajty = new Uint8Array(tekst.length);
  for (let i = 0; i < tekst.length; i += 1) bajty[i] = tekst.charCodeAt(i);
  return bajty;
}

// Plik zasobu z konta (obraz albo czcionka) jako Blob.
export async function pobierzZasob(sciezka) {
  const sb = await supabase();
  if (czyOdAi(sciezka)) {
    const id = sciezka.slice(3);
    const w = sprawdz(await sb.rpc('pobierz_obraz_ai', { p_id: id }));
    if (!w.czesci) return new Blob([zBase64Bajty(w.dane)], { type: w.typ });
    // Większy plik czeka w kawałkach po 512 KB (migracja 20261112150000_obrazy_ai_kawalki.sql): pobieramy je
    // po trzy naraz i sklejamy tutaj; rozmiar i skrót muszą się zgadzać z opisem obrazu.
    const kawalki = new Array(w.czesci);
    const kolejka = Array.from({ length: w.czesci }, (_, i) => i);
    const robotnik = async () => {
      for (let nr = kolejka.shift(); nr !== undefined; nr = kolejka.shift()) {
        kawalki[nr] = zBase64Bajty(sprawdz(await sb.rpc('pobierz_czesc_obrazu_ai', { p_id: id, p_nr: nr })));
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, w.czesci) }, robotnik));
    const blob = new Blob(kawalki, { type: w.typ });
    if (w.rozmiar && blob.size !== w.rozmiar) throw new Error(`Obraz „${w.nazwa}” przyszedł niepełny (${blob.size} z ${w.rozmiar} bajtów).`);
    if (w.skrot) {
      const { skrotSha256 } = await import('./obrazy-wspolne.js');
      if (await skrotSha256(await blob.arrayBuffer()) !== w.skrot) throw new Error(`Obraz „${w.nazwa}” przyszedł uszkodzony (inny skrót treści).`);
    }
    return blob;
  }
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

// Obrazy stron linku: WebP (o ok. 30–40% lżejszy od JPEG przy tej samej jakości), a w przeglądarce, która
// nie umie zapisać WebP – JPEG. Rozszerzenie pliku jest w opisie linku (manifest.rozszerzenie; dawne linki: jpg).
const typZRozszerzenia = (r) => (r === 'webp' ? 'image/webp' : 'image/jpeg');
// Adres obrazu strony zmienia się tylko wtedy, gdy zmienia się obraz (skrót z opisu linku) – niezmienione strony
// po aktualizacji linku przeglądarka bierze ze swojej pamięci zamiast pobierać jeszcze raz.
const wersjaObrazu = (manifest, id) => (manifest.skroty?.[id] || '').slice(0, 16) || manifest.v;

// uklad: sekcje → wiersze → strony (podglad.js); obraz(strona) → Blob WebP albo JPEG (rozszerzenie: 'webp' | 'jpg').
// Zwraca { konto, zaktualizowano }.
// odciski: { idStrony: skrót treści } – strona o tym samym skrócie co poprzednio nie jest nawet rysowana.
export async function opublikujPodglad(projektId, kod, uklad, strony, obraz, postep = () => {}, odciski = null, { rozszerzenie = 'jpg' } = {}) {
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
    // Inny format obrazów niż poprzednio (np. dawny link w JPEG) – wszystkie strony od nowa.
    if (odp.ok) { const m = await odp.json(); if ((m.rozszerzenie || 'jpg') === rozszerzenie) { poprzednie = m.skroty || {}; poprzednieTresci = m.tresci || {}; } }
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
      sprawdz(await magazyn.upload(`${folder}/${s.id}.${rozszerzenie}`, plik, { upsert: true, contentType: typZRozszerzenia(rozszerzenie), cacheControl: '3600' }));
      wyslane += 1;
    }
    gotowe += 1;
    postep(gotowe, strony.length);
  }
  // Obrazy stron usuniętych od poprzedniej aktualizacji.
  const potrzebne = new Set([...strony.map((s) => `${s.id}.${rozszerzenie}`), 'manifest.json']);
  const zbedne = (await plikiFolderu(sb, folder)).filter((p) => !potrzebne.has(p.name)).map((p) => `${folder}/${p.name}`);
  if (zbedne.length) await usunPliki(sb, zbedne);

  const zaktualizowano = new Date().toISOString();
  const manifest = { format: 'seriodruk-podglad', wersja: 1, zaktualizowano, v: Date.now(), uklad, skroty, rozszerzenie, ...(odciski ? { tresci: odciski } : {}) };
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
  return { manifest, adresObrazu: (id) => `${adresPodgladu(`${folder}/${id}.${manifest.rozszerzenie || 'jpg'}`)}?v=${wersjaObrazu(manifest, id)}` };
}

// ---------- Link chroniony: hasło albo data ważności ----------
//
// Link z hasłem albo z datą ważności nie trzyma plików w publicznym folderze, tylko w tabeli
// public.udostepnienia_pliki (migracja udostepnienia_chronione). Oglądający dostaje je wyłącznie
// przez funkcję bazy podglad_chroniony – po sprawdzeniu daty ważności i hasła. Hasło jest
// w bazie tylko jako skrót bcrypt.

const naBase64 = async (blob) => {
  const bajty = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
  return btoa(s);
};
const zBase64 = (b64, typ) => {
  const s = atob(b64);
  const bajty = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) bajty[i] = s.charCodeAt(i);
  return new Blob([bajty], { type: typ });
};

// Błąd z czytelnym stanem linku (pole stanLinku): 'brak', 'wygasl', 'haslo', 'zle_haslo', 'blokada'.
function bladLinku(stan, doKiedy = null) {
  const teksty = {
    brak: 'Ten link nie działa – podgląd został wyłączony albo adres jest niepełny.',
    wygasl: 'Link wygasł – minęła data ważności ustawiona przez osobę, która go udostępniła.',
    haslo: 'Ten podgląd jest chroniony hasłem.',
    zle_haslo: 'Hasło się nie zgadza.',
    blokada: `Za dużo prób z błędnym hasłem. Spróbuj ponownie${doKiedy ? ` po ${new Date(doKiedy).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : ' za kwadrans'}.`,
  };
  const e = new Error(teksty[stan] || teksty.brak);
  e.stanLinku = teksty[stan] ? stan : 'brak';
  return e;
}

async function wywolajPodgladChroniony(sb, konto, projektId, kod, haslo, nazwy) {
  const w = sprawdz(await sb.rpc('podglad_chroniony', { p_konto: konto, p_projekt: projektId, p_kod: kod, p_haslo: haslo || null, p_nazwy: nazwy || null }));
  if (w?.stan !== 'ok') throw bladLinku(w?.stan, w?.do);
  return w;
}

// Właściciel: hasło (zmienHaslo: false – bez zmian; puste hasło – bez hasła) i data ważności (ISO albo null).
// Zwraca { haslo: bool, wazny_do }.
export async function ustawOchroneLinku(projektId, kod, { zmienHaslo = false, haslo = '', waznyDo = null } = {}) {
  const sb = await supabase();
  return sprawdz(await sb.rpc('ustaw_ochrone_udostepnienia', {
    p_projekt: projektId, p_kod: kod, p_zmien_haslo: Boolean(zmienHaslo), p_haslo: haslo || null, p_wazny_do: waznyDo || null,
  }));
}

// Właściciel: koniec ochrony albo unieważnienie chronionego linku (ustawienia i pliki znikają).
export async function usunPodgladChroniony(projektId, kod) {
  const sb = await supabase();
  sprawdz(await sb.rpc('usun_udostepnienie_chronione', { p_projekt: projektId, p_kod: kod }));
}

// Właściciel: ta sama publikacja co opublikujPodglad, ale do tabeli chronionego linku.
// pelna: true – wysyła wszystkie strony (np. przy przejściu z linku publicznego).
export async function opublikujPodgladChroniony(projektId, kod, uklad, strony, obraz, postep = () => {}, odciski = null, { pelna = false, rozszerzenie = 'jpg' } = {}) {
  const sb = await supabase();
  const uzytkownik = await biezacyUzytkownik();
  if (!uzytkownik) throw new Error('Nie jesteś zalogowany.');
  let poprzednie = {};
  let poprzednieTresci = {};
  if (!pelna) {
    try {
      const w = await wywolajPodgladChroniony(sb, uzytkownik.id, projektId, kod, null, ['manifest.json']);
      const plik = w.pliki?.['manifest.json'];
      if (plik) { const m = JSON.parse(await zBase64(plik.dane, plik.typ).text()); if ((m.rozszerzenie || 'jpg') === rozszerzenie) { poprzednie = m.skroty || {}; poprzednieTresci = m.tresci || {}; } }
    } catch { /* pierwsza publikacja – wyślemy wszystko */ }
  }
  const zapisz = async (nazwa, typ, blob) => sprawdz(await sb.rpc('zapisz_plik_udostepnienia', {
    p_projekt: projektId, p_kod: kod, p_nazwa: nazwa, p_typ: typ, p_dane: await naBase64(blob),
  }));
  const skroty = {};
  let gotowe = 0;
  let wyslane = 0;
  for (const s of strony) {
    if (odciski && poprzednie[s.id] && poprzednieTresci[s.id] === odciski[s.id]) {
      skroty[s.id] = poprzednie[s.id];
    } else {
      const plik = await obraz(s);
      skroty[s.id] = await skrotPliku(plik);
      if (poprzednie[s.id] !== skroty[s.id]) { await zapisz(`${s.id}.${rozszerzenie}`, typZRozszerzenia(rozszerzenie), plik); wyslane += 1; }
    }
    gotowe += 1;
    postep(gotowe, strony.length);
  }
  sprawdz(await sb.rpc('porzadkuj_pliki_udostepnienia', { p_projekt: projektId, p_kod: kod, p_zostaja: [...strony.map((s) => `${s.id}.${rozszerzenie}`), 'manifest.json'] }));
  const zaktualizowano = new Date().toISOString();
  const manifest = { format: 'seriodruk-podglad', wersja: 1, zaktualizowano, v: Date.now(), uklad, skroty, rozszerzenie, ...(odciski ? { tresci: odciski } : {}) };
  await zapisz('manifest.json', 'application/json', new Blob([JSON.stringify(manifest)], { type: 'application/json' }));
  return { konto: uzytkownik.id, zaktualizowano, wyslane, wszystkie: strony.length };
}

// Oglądający: stan chronionego linku bez hasła. Rzuca błąd z polem stanLinku ('brak', 'wygasl',
// 'haslo', 'blokada'); dla linku z samą datą ważności zwraca { stan: 'ok' }.
export async function sprawdzLinkChroniony(konto, projektId, kod) {
  if (!chmuraSkonfigurowana()) throw new Error('Podgląd jest niedostępny.');
  const sb = await supabase();
  return wywolajPodgladChroniony(sb, konto, projektId, kod, null, null);
}

// Oglądający: opis podglądu i obrazy stron chronionego linku. Obrazy pobierane są paczkami
// (do 6 stron w jednym zapytaniu); adresObrazu(id) zwraca obietnicę adresu obrazu w pamięci.
export async function wczytajPodgladChroniony(konto, projektId, kod, haslo = '') {
  const sb = await supabase();
  const w = await wywolajPodgladChroniony(sb, konto, projektId, kod, haslo, ['manifest.json']);
  const plik = w.pliki?.['manifest.json'];
  if (!plik) throw bladLinku('brak');
  const manifest = JSON.parse(await zBase64(plik.dane, plik.typ).text());
  if (manifest.format !== 'seriodruk-podglad') throw new Error('To nie jest podgląd projektu.');
  const obietnice = new Map(); // id strony → obietnica adresu obrazu
  const kolejka = [];
  let timer = null;
  const wyslij = async () => {
    const paczka = kolejka.splice(0, 6);
    timer = kolejka.length ? setTimeout(wyslij, 0) : null;
    try {
      const roz = manifest.rozszerzenie || 'jpg';
      const odp = await wywolajPodgladChroniony(sb, konto, projektId, kod, haslo, paczka.map((x) => `${x.id}.${roz}`));
      for (const x of paczka) {
        const p = odp.pliki?.[`${x.id}.${roz}`];
        if (p) x.ok(URL.createObjectURL(zBase64(p.dane, p.typ))); else { obietnice.delete(x.id); x.zle(new Error('Brak obrazu strony.')); }
      }
    } catch (e) {
      for (const x of paczka) { obietnice.delete(x.id); x.zle(e); }
    }
  };
  const adresObrazu = (id) => {
    if (!obietnice.has(id)) {
      obietnice.set(id, new Promise((ok, zle) => { kolejka.push({ id, ok, zle }); }));
      if (!timer) timer = setTimeout(wyslij, 20);
    }
    return obietnice.get(id);
  };
  return { manifest, adresObrazu };
}

// ---------- Dostęp dla AI (klucz do jednego projektu) ----------
//
// Klucz tworzy i odbiera właściciel projektu; w bazie zostaje tylko jego skrót. Asystent AI używa
// klucza w funkcjach ai_projekt i ai_zapisz (supabase/migrations/20261111200000_dostep_ai.sql).

// Zwraca { id, klucz, wazny_do } – klucz jest w odpowiedzi jedyny raz.
export async function utworzDostepAi(projektId, { opis = '', rola = 'edycja', dni = 7 } = {}) {
  const sb = await supabase();
  return sprawdz(await sb.rpc('utworz_dostep_ai', { p_projekt: projektId, p_opis: opis, p_rola: rola, p_dni: dni }));
}

export async function dostepyAi(projektId) {
  const sb = await supabase();
  return sprawdz(await sb.rpc('dostepy_ai', { p_projekt: projektId })) || [];
}

export async function odwolajDostepAi(id) {
  const sb = await supabase();
  sprawdz(await sb.rpc('odwolaj_dostep_ai', { p_id: id }));
}
