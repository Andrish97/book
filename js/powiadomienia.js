// Powiadomienia push na tym urządzeniu (decyzja #113) – wzorem Familiady (web/shared/js/core/push.js):
// zgoda przeglądarki (dopiero po kliknięciu), subskrypcja u usługi push kluczem publicznym VAPID z Funkcji Edge
// powiadomienia i zapis urządzenia w bazie (push_zapisz_urzadzenie). Wysyła Funkcja Edge, pokazuje sw.js.
// Ustawienia konta → Powiadomienia: przełącznik urządzenia i rodzaje (zaproszenia, odpowiedzi, dostęp).

import * as chmura from './chmura.js';
import { iOS, zainstalowana } from './instalacja.js';
import { $, $$ } from './ui.js';

export const RODZAJE = ['zaproszenia', 'odpowiedzi', 'dostep'];
const KLUCZ_WLASCICIEL = 'makietka:powiadomienia-konto'; // konto, które włączyło powiadomienia na tym urządzeniu
const KLUCZ_SYNCHRONIZACJA = 'makietka:powiadomienia-synchronizacja';
const SYNCHRONIZACJA_CO = 24 * 3600 * 1000;

const czytaj = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const pisz = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* bez pamięci */ } };

const obslugiwane = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;

/** 'ok' | 'zablokowane' | 'ios-instalacja' | 'brak' */
export function wsparcie() {
  if (!obslugiwane()) return iOS() && !zainstalowana() ? 'ios-instalacja' : 'brak';
  if (window.Notification.permission === 'denied') return 'zablokowane';
  return 'ok';
}

const naBajty = (b64url) => {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

async function rejestracja() {
  const r = await navigator.serviceWorker.getRegistration();
  if (!r) await navigator.serviceWorker.register('./sw.js').catch(() => {});
  // ready nie kończy się, gdy rejestracja jest zablokowana – limit czasu.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, nie) => { setTimeout(() => nie(new Error('Przeglądarka nie uruchomiła obsługi powiadomień – odśwież stronę i spróbuj ponownie.')), 8000); }),
  ]);
}

async function rpc(nazwa, parametry) {
  const sb = await chmura.supabase();
  const { data, error } = await sb.rpc(nazwa, parametry);
  if (error) throw new Error(error.message || 'Błąd bazy');
  return data;
}

async function funkcja(tresc) {
  const sb = await chmura.supabase();
  const { data, error } = await sb.functions.invoke('powiadomienia', { body: tresc });
  if (error) throw new Error(error.message || 'Serwer powiadomień nie odpowiada');
  return data;
}

async function zapisz(sub, rodzaje) {
  const j = sub.toJSON();
  const w = await rpc('push_zapisz_urzadzenie', { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_rodzaje: rodzaje });
  pisz(KLUCZ_SYNCHRONIZACJA, String(Date.now()));
  return w;
}

const takieSame = (a, b) => a && b && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === b[i]);

/** { wlaczone, rodzaje } dla tego urządzenia. */
export async function stanUrzadzenia() {
  if (!obslugiwane()) return { wlaczone: false, rodzaje: [] };
  const sub = await (await rejestracja()).pushManager.getSubscription();
  if (!sub) return { wlaczone: false, rodzaje: [] };
  const d = await rpc('push_urzadzenie', { p_endpoint: sub.endpoint });
  return { wlaczone: Boolean(d?.wlaczone), rodzaje: Array.isArray(d?.rodzaje) ? d.rodzaje : [] };
}

/** Włączenie – wywołać z kliknięcia (przeglądarka pyta o zgodę tylko po geście). */
export async function wlacz(rodzaje = RODZAJE) {
  if (!obslugiwane()) throw new Error('Ta przeglądarka nie obsługuje powiadomień.');
  const zgoda = await window.Notification.requestPermission();
  if (zgoda !== 'granted') {
    throw new Error(zgoda === 'denied'
      ? 'Powiadomienia są zablokowane w ustawieniach przeglądarki dla makietka.app – odblokuj je tam.'
      : 'Nie udzielono zgody na powiadomienia.');
  }
  const { klucz } = await funkcja({ klucz: true });
  if (!klucz) throw new Error('Nie udało się przygotować powiadomień – spróbuj za chwilę.');
  const reg = await rejestracja();
  const kluczBajty = naBajty(klucz);
  let sub = await reg.pushManager.getSubscription();
  // Subskrypcja z innym kluczem serwera (klucze wymienione) – nowa.
  if (sub && sub.options?.applicationServerKey && !takieSame(sub.options.applicationServerKey, kluczBajty)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kluczBajty });
  await zapisz(sub, rodzaje);
  const u = await chmura.biezacyUzytkownik().catch(() => null);
  pisz(KLUCZ_WLASCICIEL, u?.id || null);
}

export async function wylacz() {
  pisz(KLUCZ_WLASCICIEL, null);
  if (!obslugiwane()) return;
  const sub = await (await rejestracja()).pushManager.getSubscription();
  if (!sub) return;
  await rpc('push_usun_urzadzenie', { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => {});
}

export async function zapiszRodzaje(rodzaje) {
  if (!obslugiwane()) return;
  const sub = await (await rejestracja()).pushManager.getSubscription();
  if (sub) await zapisz(sub, rodzaje);
}

/** Po zmianie we współpracy (zaproszenie, rola, odebranie dostępu, przyjęcie): wysyłka od razu, bez czekania na Cron. */
export function wyslijTeraz() {
  funkcja({ kolejka: true }).catch(() => { /* Cron Workera wyśle w ciągu minuty */ });
}

// Ciche odświeżenie po zalogowaniu (raz na dobę): usługa push mogła wymienić adres urządzenia. Bez pytania o zgodę
// i tylko wtedy, gdy to konto samo włączyło powiadomienia na tym urządzeniu.
export async function synchronizuj(uzytkownik) {
  try {
    if (!uzytkownik || !obslugiwane() || window.Notification.permission !== 'granted') return;
    if (Date.now() - Number(czytaj(KLUCZ_SYNCHRONIZACJA) || 0) < SYNCHRONIZACJA_CO) return;
    pisz(KLUCZ_SYNCHRONIZACJA, String(Date.now()));
    const sub = await (await rejestracja()).pushManager.getSubscription();
    if (!sub) return;
    const d = await rpc('push_urzadzenie', { p_endpoint: sub.endpoint });
    if (d?.wlaczone) await zapisz(sub, d.rodzaje);
    else if (czytaj(KLUCZ_WLASCICIEL) === uzytkownik.id) await zapisz(sub, RODZAJE);
  } catch { /* bez sieci albo sesji – następnym razem */ }
}

// ---------- Ustawienia konta → Powiadomienia ----------

function pokazUwage(tekst, { instalacja = false } = {}) {
  const el = $('#powiadomienia-uwaga');
  el.hidden = !tekst;
  $('#powiadomienia-uwaga-tekst').textContent = tekst || '';
  $('#powiadomienia-instaluj').hidden = !instalacja;
}

function ustawRodzaje(rodzaje, wlaczone) {
  const pole = $('#powiadomienia-rodzaje');
  pole.hidden = !wlaczone;
  for (const c of $$('input[name="rodzaj"]', pole)) c.checked = rodzaje.includes(c.value);
}

let trwa = false;
let podsumowanie = '';
export const podsumowaniePowiadomien = () => podsumowanie;

function ustawStan(wlaczone, opis) {
  $('#powiadomienia-wlacz').checked = wlaczone;
  $('#powiadomienia-stan').textContent = opis;
  podsumowanie = wlaczone ? 'Włączone' : 'Wyłączone';
  document.dispatchEvent(new CustomEvent('powiadomienia-stan'));
}

/** Wypełnia sekcję „Powiadomienia” stanem tego urządzenia. */
export async function pokazPowiadomienia() {
  const w = wsparcie();
  const przelacznik = $('#powiadomienia-wlacz');
  przelacznik.disabled = w !== 'ok';
  if (w === 'ios-instalacja') {
    ustawStan(false, 'Niedostępne w przeglądarce');
    pokazUwage('Na iPhonie i iPadzie powiadomienia działają w zainstalowanej aplikacji. Zainstaluj Makietkę, otwórz ją z ekranu początkowego i włącz je tutaj.', { instalacja: true });
    ustawRodzaje([], false);
    return;
  }
  if (w === 'brak') {
    ustawStan(false, 'Niedostępne');
    pokazUwage('Ta przeglądarka nie obsługuje powiadomień.');
    ustawRodzaje([], false);
    return;
  }
  if (w === 'zablokowane') {
    ustawStan(false, 'Zablokowane w przeglądarce');
    pokazUwage('Powiadomienia dla makietka.app są zablokowane w ustawieniach przeglądarki. Odblokuj je tam, a potem włącz tutaj.');
    ustawRodzaje([], false);
    return;
  }
  pokazUwage('');
  try {
    const s = await stanUrzadzenia();
    ustawStan(s.wlaczone, s.wlaczone ? 'Włączone na tym urządzeniu' : 'Wyłączone na tym urządzeniu');
    ustawRodzaje(s.wlaczone ? s.rodzaje : RODZAJE, s.wlaczone);
  } catch (e) {
    ustawStan(false, 'Wyłączone na tym urządzeniu');
    ustawRodzaje(RODZAJE, false);
    pokazUwage(e.message);
  }
}

export function inicjujPowiadomienia() {
  const przelacznik = $('#powiadomienia-wlacz');
  if (!przelacznik) return;
  przelacznik.addEventListener('change', async () => {
    if (trwa) return;
    trwa = true;
    przelacznik.disabled = true;
    pokazUwage('');
    try {
      if (przelacznik.checked) {
        $('#powiadomienia-stan').textContent = 'Włączam…';
        await wlacz(RODZAJE);
      } else {
        $('#powiadomienia-stan').textContent = 'Wyłączam…';
        await wylacz();
      }
    } catch (e) {
      pokazUwage(e.message);
    } finally {
      trwa = false;
      await pokazPowiadomienia();
    }
  });
  $('#powiadomienia-rodzaje').addEventListener('change', async () => {
    const rodzaje = $$('#powiadomienia-rodzaje input[name="rodzaj"]:checked').map((c) => c.value);
    try { await zapiszRodzaje(rodzaje); pokazUwage(''); } catch (e) { pokazUwage(e.message); }
  });
}
