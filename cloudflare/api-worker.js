// Przekaźnik api.makietka.app → baza Supabase projektu Makietki (Cloudflare Worker, decyzja #88)
// i magazyn plików w Cloudflare R2 (decyzja #92).
//
// Baza: wszystkie ścieżki idą bez zmian (/rest, /auth, /functions, /realtime – także WebSocket), z jednym
// skrótem: /mcp/… → /functions/v1/mcp/… – adres zdalnego łącznika dla AI to https://api.makietka.app/mcp/<klucz>.
//
// Pliki (R2, binding PLIKI – bucket „makietka-files”, cloudflare/wrangler.jsonc):
//   /pliki/<właściciel>/<projekt>/<id>       obrazy projektów                 → klucz R2 „zasoby/…”
//   /pliki/<konto>/_czcionki/<plik>           „Moje czcionki” konta            → „zasoby/…”
//   /podglady/<konto>/<projekt>/<kod>/<plik>  obrazy stron linków (publiczne)  → „podglady/…”
// Dostęp: token sesji Supabase (Authorization: Bearer …) sprawdzany w /auth/v1/user. Właściciel – wszystko
// w swoim folderze; współpracownik projektu – odczyt (rola „odczyt”) albo odczyt i zapis (rola „edycja”) plików
// projektu, sprawdzane funkcją bazy dostep_do_plikow wywołaną jego tokenem; obrazy stron linków czyta każdy.
// Linki z hasłem nie trzymają plików tutaj (tabela udostepnienia_pliki w bazie – bez zmian).
// Meta: GET /pliki/_miejsce, GET /pliki/_lista, POST /pliki/_usun, GET /pliki/_osierocone.
// Limity plików – LIMITY niżej (jedno miejsce). Bez sekretów – klucz publikowalny bazy jest jawny.

export const CEL = 'https://pganajmivwtstapnwsgv.supabase.co';
export const KLUCZ_PUBLICZNY = 'sb_publishable_gt_GEmBz6SfJZ0o9rAhLQA_HKH0V_cq';
const MB = 1024 * 1024;
// Pliki jednego konta (obrazy, czcionki, obrazy stron linków), jeden plik, cały darmowy próg R2.
export const LIMITY = { konto: 500 * MB, plik: 25 * MB, razem: 10 * 1024 * MB };
const ZRODLA = [/^https:\/\/(www\.)?makietka\.app$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const ROK = 'private, max-age=31536000, immutable';
const DWA_DNI_MS = 2 * 24 * 3600 * 1000;

// Adres w bazie dla adresu zapytania do przekaźnika.
export function adresCelu(adres, cel = CEL) {
  const u = new URL(adres);
  const sciezka = u.pathname === '/mcp' || u.pathname.startsWith('/mcp/') ? `/functions/v1${u.pathname}` : u.pathname;
  return `${cel}${sciezka}${u.search}`;
}

// ---------- Pomocnicze ----------

function naglowkiCors(zapytanie, publiczne = false) {
  const origin = zapytanie.headers.get('origin');
  const h = {
    'access-control-allow-methods': 'GET, HEAD, PUT, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-cache-control, range, if-none-match, apikey',
    'access-control-expose-headers': 'content-range, content-length, etag, accept-ranges',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
  if (origin && ZRODLA.some((r) => r.test(origin))) h['access-control-allow-origin'] = origin;
  else if (publiczne) h['access-control-allow-origin'] = '*';
  return h;
}

const json = (status, dane, cors) => new Response(JSON.stringify(dane), {
  status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// Ścieżka po prefiksie (/pliki/ albo /podglady/) jako lista części; null, gdy nieprawidłowa.
function czesciSciezki(reszta) {
  let czesci;
  try { czesci = reszta.split('/').map(decodeURIComponent); } catch { return null; }
  if (!czesci.length || czesci.some((c) => !c || c === '.' || c === '..' || c.length > 200 || c.includes('/'))) return null;
  return czesci;
}

// Pamięć w obrębie jednej instancji Workera (krótko – odebrany dostęp przestaje działać najpóźniej po minucie).
const PAMIEC_MS = 60 * 1000;
const pamiecTokenow = new Map(); // token → { id }
const pamiecDostepu = new Map(); // token|właściciel|projekt|zapis → { tak }
const pamiecZajetosci = new Map(); // właściciel → { bajty }
let pamiecRazem = null; // { bajty, do }
const zPamieci = (mapa, klucz) => {
  const w = mapa.get(klucz);
  if (w && w.do > Date.now()) return w;
  mapa.delete(klucz);
  return null;
};
const doPamieci = (mapa, klucz, w) => {
  if (mapa.size > 2000) mapa.clear();
  mapa.set(klucz, { ...w, do: Date.now() + PAMIEC_MS });
};

const tokenZZapytania = (zapytanie) => /^Bearer\s+(\S+)$/i.exec(zapytanie.headers.get('authorization') || '')?.[1] || null;
const baza = (env) => env.SUPABASE_URL || CEL;
const kluczBazy = (env) => env.SUPABASE_KLUCZ || KLUCZ_PUBLICZNY;

async function uzytkownik(env, token) {
  if (!token) return null;
  const w = zPamieci(pamiecTokenow, token);
  if (w) return w.id;
  const odp = await fetch(`${baza(env)}/auth/v1/user`, { headers: { apikey: kluczBazy(env), authorization: `Bearer ${token}` } });
  if (!odp.ok) return null;
  const id = (await odp.json())?.id || null;
  if (id) doPamieci(pamiecTokenow, token, { id });
  return id;
}

async function rpc(env, token, funkcja, parametry) {
  const odp = await fetch(`${baza(env)}/rest/v1/rpc/${funkcja}`, {
    method: 'POST',
    headers: { apikey: kluczBazy(env), authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(parametry),
  });
  if (!odp.ok) throw new Error(`${funkcja}: ${odp.status}`);
  return odp.json();
}

// Czy zalogowany (uid) może czytać albo zapisywać plik projektu właściciela.
async function dostep(env, token, uid, wlasciciel, projekt, zapis) {
  if (uid === wlasciciel) return true;
  if (!projekt || projekt.startsWith('_')) return false; // „Moje czcionki” i pliki konta – tylko właściciel
  const klucz = `${token}|${wlasciciel}|${projekt}|${zapis ? 1 : 0}`;
  const w = zPamieci(pamiecDostepu, klucz);
  if (w) return w.tak;
  let tak = false;
  try { tak = (await rpc(env, token, 'dostep_do_plikow', { p_wlasciciel: wlasciciel, p_projekt: projekt, p_zapis: Boolean(zapis) })) === true; } catch { tak = false; }
  doPamieci(pamiecDostepu, klucz, { tak });
  return tak;
}

async function wszystkie(bucket, prefiks) {
  const wynik = [];
  let cursor;
  do {
    const lista = await bucket.list({ prefix: prefiks, cursor, limit: 1000 });
    wynik.push(...lista.objects);
    cursor = lista.truncated ? lista.cursor : undefined;
  } while (cursor);
  return wynik;
}

const suma = (lista) => lista.reduce((s, o) => s + (o.size || 0), 0);

async function zajetoscKonta(env, wlasciciel) {
  const w = zPamieci(pamiecZajetosci, wlasciciel);
  if (w) return w.bajty;
  const bajty = suma(await wszystkie(env.PLIKI, `zasoby/${wlasciciel}/`)) + suma(await wszystkie(env.PLIKI, `podglady/${wlasciciel}/`));
  doPamieci(pamiecZajetosci, wlasciciel, { bajty });
  return bajty;
}

async function zajetoscRazem(env) {
  if (pamiecRazem && pamiecRazem.do > Date.now()) return pamiecRazem.bajty;
  const bajty = suma(await wszystkie(env.PLIKI, ''));
  pamiecRazem = { bajty, do: Date.now() + 10 * PAMIEC_MS };
  return bajty;
}

// Odpowiedź z treścią obiektu R2: ETag, If-None-Match → 304, Range → 206, Cache-Control z opisu pliku.
async function wyslijObiekt(env, zapytanie, klucz, cors, domyslnyCache) {
  const zakres = /^bytes=(\d*)-(\d*)$/.exec(zapytanie.headers.get('range') || '');
  let opcjeZakresu;
  if (zakres && (zakres[1] || zakres[2])) {
    opcjeZakresu = zakres[1]
      ? { offset: Number(zakres[1]), ...(zakres[2] ? { length: Number(zakres[2]) - Number(zakres[1]) + 1 } : {}) }
      : { suffix: Number(zakres[2]) };
  }
  const obiekt = zapytanie.method === 'HEAD' ? await env.PLIKI.head(klucz) : await env.PLIKI.get(klucz, opcjeZakresu ? { range: opcjeZakresu } : {});
  if (!obiekt) return json(404, { blad: 'Nie ma takiego pliku.' }, cors);
  const h = new Headers(cors);
  obiekt.writeHttpMetadata?.(h);
  if (!h.get('cache-control')) h.set('cache-control', domyslnyCache);
  h.set('etag', obiekt.httpEtag);
  h.set('accept-ranges', 'bytes');
  if (zapytanie.headers.get('if-none-match') === obiekt.httpEtag) return new Response(null, { status: 304, headers: h });
  if (zapytanie.method === 'HEAD') {
    h.set('content-length', String(obiekt.size));
    return new Response(null, { status: 200, headers: h });
  }
  if (opcjeZakresu && obiekt.range) {
    const od = obiekt.range.offset ?? (obiekt.size - obiekt.range.suffix);
    const dlugosc = obiekt.range.length ?? (obiekt.size - od);
    h.set('content-range', `bytes ${od}-${od + dlugosc - 1}/${obiekt.size}`);
    h.set('content-length', String(dlugosc));
    return new Response(obiekt.body, { status: 206, headers: h });
  }
  h.set('content-length', String(obiekt.size));
  return new Response(obiekt.body, { status: 200, headers: h });
}

const zaDuzy = (cors) => json(413, { blad: `Plik jest za duży (najwyżej ${LIMITY.plik / MB} MB).`, kod: 'limit_pliku' }, cors);

async function zapiszObiekt(env, zapytanie, klucz, wlasciciel, cors, domyslnyCache) {
  if (Number(zapytanie.headers.get('content-length') || 0) > LIMITY.plik) return zaDuzy(cors);
  const tresc = await zapytanie.arrayBuffer();
  if (tresc.byteLength > LIMITY.plik) return zaDuzy(cors);
  const poprzedni = await env.PLIKI.head(klucz);
  const zajete = await zajetoscKonta(env, wlasciciel);
  const po = zajete - (poprzedni?.size || 0) + tresc.byteLength;
  if (po > LIMITY.konto) {
    return json(413, {
      blad: `Na koncie nie ma już miejsca na pliki (zajęte ${Math.round(zajete / MB)} MB z ${LIMITY.konto / MB} MB). Usuń nieużywane obrazy albo posprzątaj w ustawieniach konta (Miejsce).`,
      kod: 'limit_konta',
    }, cors);
  }
  if (await zajetoscRazem(env) + tresc.byteLength > LIMITY.razem) {
    return json(507, { blad: 'Magazyn plików aplikacji jest pełny – napisz do autora aplikacji.', kod: 'limit_razem' }, cors);
  }
  const obiekt = await env.PLIKI.put(klucz, tresc, {
    httpMetadata: {
      contentType: zapytanie.headers.get('content-type') || 'application/octet-stream',
      cacheControl: zapytanie.headers.get('x-cache-control') || domyslnyCache,
    },
  });
  doPamieci(pamiecZajetosci, wlasciciel, { bajty: po });
  if (pamiecRazem) pamiecRazem.bajty += tresc.byteLength - (poprzedni?.size || 0);
  return json(200, { klucz: klucz.slice(klucz.indexOf('/') + 1), rozmiar: obiekt?.size ?? tresc.byteLength }, cors);
}

// ---------- Meta: miejsce, lista, usuwanie, osierocone ----------

async function miejsceKonta(env, uid, cors) {
  const obiekty = await wszystkie(env.PLIKI, `zasoby/${uid}/`);
  const podglady = await wszystkie(env.PLIKI, `podglady/${uid}/`);
  const czcionki = obiekty.filter((o) => o.key.startsWith(`zasoby/${uid}/_czcionki/`));
  const konto = suma(obiekty) + suma(podglady);
  doPamieci(pamiecZajetosci, uid, { bajty: konto });
  return json(200, {
    obrazy: suma(obiekty) - suma(czcionki),
    czcionki: suma(czcionki),
    podglady: suma(podglady),
    plikow: obiekty.length + podglady.length,
    konto,
    limit_konta: LIMITY.konto,
    limit_pliku: LIMITY.plik,
    pliki_razem: await zajetoscRazem(env),
    limit_plikow: LIMITY.razem,
  }, cors);
}

async function usunWiele(zapytanie, env, token, uid, cors) {
  let dane;
  try { dane = await zapytanie.json(); } catch { return json(400, { blad: 'Nieprawidłowe dane.' }, cors); }
  const bucket = dane?.bucket === 'podglady' ? 'podglady' : 'zasoby';
  const klucze = Array.isArray(dane?.klucze) ? dane.klucze.slice(0, 1000) : [];
  const wolno = [];
  for (const k of klucze) {
    const czesci = czesciSciezki(String(k));
    if (!czesci || czesci.length < 2) continue;
    const tak = czesci[0] === uid || (bucket === 'zasoby' && await dostep(env, token, uid, czesci[0], czesci[1], true));
    if (tak) {
      wolno.push(`${bucket}/${czesci.join('/')}`);
      pamiecZajetosci.delete(czesci[0]);
    }
  }
  if (wolno.length) await env.PLIKI.delete(wolno);
  pamiecRazem = null;
  return json(200, { usuniete: wolno.length, pominiete: klucze.length - wolno.length }, cors);
}

// Pliki konta, na które nie wskazuje żaden projekt (także cudzy, współdzielony), starsze niż 2 dni, i obrazy
// stron linków, których projekt nie ma już tego linku. Pliki konta na „_” (np. „Moje czcionki”) zostają.
async function osierocone(env, token, uid, cors) {
  const odw = await rpc(env, token, 'odwolania_plikow', {});
  const sciezki = new Set(odw?.sciezki || []);
  const linki = odw?.linki || [];
  const stare = (o) => Date.now() - new Date(o.uploaded).getTime() > DWA_DNI_MS;
  const wynik = [];
  for (const o of await wszystkie(env.PLIKI, `zasoby/${uid}/`)) {
    const nazwa = o.key.slice('zasoby/'.length);
    if (stare(o) && !nazwa.slice(uid.length + 1).startsWith('_') && !sciezki.has(nazwa)) wynik.push({ bucket: 'zasoby', nazwa, rozmiar: o.size });
  }
  for (const o of await wszystkie(env.PLIKI, `podglady/${uid}/`)) {
    const nazwa = o.key.slice('podglady/'.length);
    if (stare(o) && !linki.some((l) => nazwa.startsWith(l))) wynik.push({ bucket: 'podglady', nazwa, rozmiar: o.size });
  }
  return json(200, wynik, cors);
}

// ---------- Ścieżki plików ----------

async function obsluzPodglady(zapytanie, env, u, cors) {
  const czesci = czesciSciezki(u.pathname.slice('/podglady/'.length));
  if (!czesci || czesci.length < 2) return json(400, { blad: 'Nieprawidłowa ścieżka.' }, cors);
  const klucz = `podglady/${czesci.join('/')}`;
  if (zapytanie.method === 'GET' || zapytanie.method === 'HEAD') return wyslijObiekt(env, zapytanie, klucz, cors, 'public, max-age=3600');
  const uid = await uzytkownik(env, tokenZZapytania(zapytanie));
  if (!uid) return json(401, { blad: 'Zaloguj się ponownie.' }, cors);
  if (czesci[0] !== uid) return json(403, { blad: 'Brak dostępu do tego pliku.' }, cors);
  if (zapytanie.method === 'PUT') return zapiszObiekt(env, zapytanie, klucz, uid, cors, 'public, max-age=3600');
  if (zapytanie.method === 'DELETE') {
    await env.PLIKI.delete(klucz);
    pamiecZajetosci.delete(uid);
    return json(200, { usuniete: 1 }, cors);
  }
  return json(405, { blad: 'Niedozwolona metoda.' }, cors);
}

async function obsluzPliki(zapytanie, env, u) {
  const publiczne = u.pathname.startsWith('/podglady/');
  const cors = naglowkiCors(zapytanie, publiczne);
  if (zapytanie.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.PLIKI) return json(503, { blad: 'Magazyn plików nie jest podłączony (binding PLIKI).' }, cors);
  if (publiczne) return obsluzPodglady(zapytanie, env, u, cors);

  const token = tokenZZapytania(zapytanie);
  const uid = await uzytkownik(env, token);
  if (!uid) return json(401, { blad: 'Zaloguj się ponownie.' }, cors);
  const reszta = u.pathname.slice('/pliki/'.length);
  if (reszta === '_miejsce' && zapytanie.method === 'GET') return miejsceKonta(env, uid, cors);
  if (reszta === '_usun' && zapytanie.method === 'POST') return usunWiele(zapytanie, env, token, uid, cors);
  if (reszta === '_osierocone' && zapytanie.method === 'GET') return osierocone(env, token, uid, cors);
  if (reszta === '_lista' && zapytanie.method === 'GET') {
    const bucket = u.searchParams.get('bucket') === 'podglady' ? 'podglady' : 'zasoby';
    const prefiks = u.searchParams.get('prefiks') || '';
    if (!prefiks.startsWith(`${uid}/`)) return json(403, { blad: 'Lista tylko z własnego folderu.' }, cors);
    const lista = await wszystkie(env.PLIKI, `${bucket}/${prefiks}`);
    return json(200, lista.map((o) => ({ klucz: o.key.slice(bucket.length + 1), rozmiar: o.size, czas: new Date(o.uploaded).getTime() })), cors);
  }

  const czesci = czesciSciezki(reszta);
  if (!czesci || czesci.length < 2 || czesci[0].startsWith('_')) return json(400, { blad: 'Nieprawidłowa ścieżka.' }, cors);
  const [wlasciciel, projekt] = czesci;
  const klucz = `zasoby/${czesci.join('/')}`;
  const zapis = !['GET', 'HEAD'].includes(zapytanie.method);
  if (!await dostep(env, token, uid, wlasciciel, projekt, zapis)) return json(403, { blad: 'Brak dostępu do tego pliku.' }, cors);
  if (!zapis) return wyslijObiekt(env, zapytanie, klucz, cors, ROK);
  if (zapytanie.method === 'PUT') return zapiszObiekt(env, zapytanie, klucz, wlasciciel, cors, ROK);
  if (zapytanie.method === 'DELETE') {
    await env.PLIKI.delete(klucz);
    pamiecZajetosci.delete(wlasciciel);
    pamiecRazem = null;
    return json(200, { usuniete: 1 }, cors);
  }
  return json(405, { blad: 'Niedozwolona metoda.' }, cors);
}

export default {
  async fetch(zapytanie, env = {}) {
    const u = new URL(zapytanie.url);
    if (u.pathname === '/' && zapytanie.method === 'GET') {
      return new Response('Makietka – API (przekaźnik do bazy i pliki). Aplikacja: https://makietka.app/\n', {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (u.pathname.startsWith('/pliki/') || u.pathname.startsWith('/podglady/')) {
      try {
        return await obsluzPliki(zapytanie, env, u);
      } catch (e) {
        return json(500, { blad: `Błąd magazynu plików: ${e.message}` }, naglowkiCors(zapytanie, true));
      }
    }
    // new Request(adres, zapytanie) przenosi metodę, nagłówki, treść (strumieniem) i prośbę o WebSocket
    // (Upgrade) – odpowiedź 101 z bazy wraca do przeglądarki bez zmian. Przekierowania podaje dalej.
    return fetch(new Request(adresCelu(zapytanie.url, baza(env)), zapytanie), { redirect: 'manual' });
  },
};

// Dla testów: wyczyszczenie pamięci instancji.
export function wyczyscPamiec() {
  pamiecTokenow.clear();
  pamiecDostepu.clear();
  pamiecZajetosci.clear();
  pamiecRazem = null;
}
