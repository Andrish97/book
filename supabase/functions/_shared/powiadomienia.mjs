// Powiadomienia push (decyzja #113) – logika Funkcji Edge powiadomienia, wspólna z testami (Node).
//
//  • { klucz: true } – klucz publiczny VAPID dla przeglądarki (aplikacja nie trzyma go w kodzie, więc po
//    ustawieniu sekretów nic nie trzeba zmieniać w repozytorium),
//  • { kolejka: true } – przebieg kolejki powiadomienia_kolejka: aplikacja od razu po zmianie we współpracy,
//    Cron Workera co minutę. Zlecić może każdy – kolejka sama pilnuje prób, a tędy nie da się do niej nic dopisać.
//
// Sekrety (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (jak w Familiadzie).
// Klucz serwisowy daje funkcjom sam Supabase (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEYS).

import { buildPushRequest } from './web-push.js';
import { DOMYSLNY_ADRES } from './mcp-http.mjs';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400',
};
const json = (status, tresc) => new Response(JSON.stringify(tresc), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } });

const ROLA = { edycja: 'może edytować', odczyt: 'może oglądać' };
const cudzyslow = (t) => `„${String(t || 'projekt').trim() || 'projekt'}”`;

// Treść powiadomienia dla zdarzenia z kolejki: { title, body, url, tag }. Adres względny – service worker
// otwiera go w aplikacji (sw.js). tag: kolejne powiadomienie o tym samym projekcie zastępuje poprzednie.
export function trescPowiadomienia(zdarzenie) {
  const d = zdarzenie?.dane || {};
  const projekt = cudzyslow(d.projekt);
  const kto = String(d.kto || '').trim() || 'Ktoś';
  const rola = ROLA[d.rola] || '';
  const doProjektu = d.projekt_id ? `./#/p/${d.projekt_id}` : './#/projekty';
  const tag = `${zdarzenie?.zdarzenie || 'makietka'}-${d.projekt_id || ''}`.slice(0, 32);
  switch (zdarzenie?.zdarzenie) {
    case 'zaproszenie':
      return { title: 'Zaproszenie do projektu', body: `${kto} zaprasza Cię do projektu ${projekt}${rola ? ` (${rola})` : ''}.`, url: d.kod ? `./#/zaproszenie/${d.kod}` : './#/projekty', tag };
    case 'udostepniono':
      return { title: 'Nowy projekt dla Ciebie', body: `${kto} udostępnia Ci projekt ${projekt}${rola ? ` (${rola})` : ''}.`, url: doProjektu, tag };
    case 'przyjete':
      return { title: 'Zaproszenie przyjęte', body: `${kto} dołącza do projektu ${projekt}.`, url: doProjektu, tag };
    case 'odrzucone':
      return { title: 'Zaproszenie odrzucone', body: `${kto} nie dołączy do projektu ${projekt}.`, url: doProjektu, tag };
    case 'rola':
      return { title: 'Zmiana dostępu', body: `${kto} zmienia Twoją rolę w projekcie ${projekt}${rola ? `: ${rola}` : ''}.`, url: doProjektu, tag };
    case 'odebrano':
      return { title: 'Koniec dostępu', body: `Nie masz już dostępu do projektu ${projekt}.`, url: './#/projekty', tag };
    default:
      return null;
  }
}

function kluczSerwisowy(env) {
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const k = JSON.parse(env.SUPABASE_SECRET_KEYS || '{}');
    return k.default || Object.values(k)[0] || null;
  } catch { return null; }
}
const naglowkiKlucza = (klucz) => (String(klucz).startsWith('sb_') ? { apikey: klucz } : { apikey: klucz, authorization: `Bearer ${klucz}` });

async function rpcBazy(env, wyslij, nazwa, parametry, naglowki) {
  const adresBazy = (env.SUPABASE_URL || DOMYSLNY_ADRES).replace(/\/+$/, '');
  const odp = await wyslij(`${adresBazy}/rest/v1/rpc/${nazwa}`, {
    method: 'POST', headers: { ...naglowki, 'content-type': 'application/json' }, body: JSON.stringify(parametry),
  });
  const tresc = await odp.json().catch(() => null);
  if (!odp.ok) throw new Error(tresc?.message || `Baza odpowiedziała błędem ${odp.status}.`);
  return tresc;
}

const vapidZ = (env) => ({
  publicKey: String(env.VAPID_PUBLIC_KEY || '').trim(),
  privateKey: String(env.VAPID_PRIVATE_KEY || '').trim(),
  subject: String(env.VAPID_SUBJECT || '').trim(),
});

// Jeden przebieg kolejki → { zdarzenia, dostarczone, nieudane, powod }.
export async function przetworzKolejke(env = {}, wyslij = fetch) {
  const klucz = kluczSerwisowy(env);
  if (!klucz) return { zdarzenia: 0, dostarczone: 0, nieudane: 0, powod: 'brak-klucza-serwisowego' };
  const vapid = vapidZ(env);
  if (!vapid.publicKey || !vapid.privateKey || !vapid.subject) return { zdarzenia: 0, dostarczone: 0, nieudane: 0, powod: 'brak-kluczy-vapid' };
  const naglowki = naglowkiKlucza(klucz);
  const wynik = { zdarzenia: 0, dostarczone: 0, nieudane: 0, powod: null };
  for (let runda = 0; runda < 4; runda += 1) {
    const partia = await rpcBazy(env, wyslij, 'push_kolejka_pobierz', { p_limit: 50 }, naglowki);
    if (!Array.isArray(partia) || !partia.length) break;
    for (const z of partia) {
      wynik.zdarzenia += 1;
      const tresc = trescPowiadomienia(z);
      const urzadzenia = [];
      const bledy = new Set();
      for (const u of tresc ? z.urzadzenia || [] : []) {
        let ok = false;
        let zniklo = false;
        try {
          const zad = await buildPushRequest(u, { ...tresc, timestamp: Date.parse(z.utworzono) || Date.now() }, vapid, { ttl: 86400, topic: tresc.tag });
          const odp = await wyslij(zad.url, { ...zad.init, signal: AbortSignal.timeout(10000) });
          await odp.body?.cancel?.().catch?.(() => {});
          ok = odp.status >= 200 && odp.status < 300;
          zniklo = odp.status === 404 || odp.status === 410;
          if (!ok) bledy.add(`HTTP ${odp.status}`);
        } catch (e) {
          bledy.add(String(e?.message || 'sieć').slice(0, 40));
        }
        if (ok) wynik.dostarczone += 1; else wynik.nieudane += 1;
        urzadzenia.push({ id: u.id, ok, zniklo });
      }
      await rpcBazy(env, wyslij, 'push_kolejka_wynik', {
        p_id: z.id, p_urzadzenia: urzadzenia, p_blad: tresc ? (bledy.size ? [...bledy].join(', ').slice(0, 200) : null) : 'nieznane zdarzenie',
      }, naglowki);
    }
  }
  return wynik;
}

export async function obsluzPowiadomienia(request, env = {}, wyslij = fetch) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json(405, { blad: 'Tylko POST.' });
  let tresc = {};
  try { tresc = await request.json(); } catch { /* pusta treść */ }
  if (tresc?.klucz) {
    const { publicKey } = vapidZ(env);
    return json(200, { klucz: publicKey || null });
  }
  if (tresc?.kolejka) {
    try {
      return json(200, await przetworzKolejke(env, wyslij));
    } catch (e) {
      return json(500, { blad: e.message });
    }
  }
  return json(400, { blad: 'Nieznane polecenie.' });
}
