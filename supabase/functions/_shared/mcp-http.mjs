// Zdalny łącznik MCP Makietki po HTTP (transport Streamable HTTP) – logika niezależna od Deno, żeby dało się
// ją sprawdzać w Node. Funkcja Edge (supabase/functions/mcp/index.ts) tylko przekazuje tu żądania.
//
// Adres łącznika: https://api.makietka.app/mcp/<klucz sdk_…> (przekaźnik Cloudflare) = https://<projekt>.supabase.co/functions/v1/mcp/<klucz>
// Klucz w adresie, bo łączniki Claude („No sign-in”) i ChatGPT („No authentication”) nie wysyłają
// własnych nagłówków. Przyjmujemy też nagłówek Authorization: Bearer sdk_… i parametr ?klucz=.
// Klucz sprawdza baza (funkcje ai_projekt / ai_zapisz) – łącznik nie ma żadnego klucza serwisowego.
//
// Serwer jest bezstanowy: każde żądanie POST to jedna wiadomość JSON-RPC (albo lista w starszych wersjach),
// odpowiedź zawsze jako application/json. Obsługuje protokół 2026-07-28 (wersja w _meta, nagłówki
// MCP-Protocol-Version / Mcp-Method / Mcp-Name) oraz starsze wersje z initialize (2025-03-26 … 2025-11-25).

import { utworzSerwer, BLEDY, WERSJE_NOWE, WERSJE_STARE } from './seriodruk-mcp-rdzen.mjs';

// Strony, z których przeglądarka może wysyłać żądania do łącznika (np. MCP Inspector na localhost).
// Wywołania od Claude i ChatGPT idą z ich serwerów, zwykle bez nagłówka Origin.
const ZRODLA = [/^https:\/\/(www\.)?claude\.(ai|com)$/, /^https:\/\/(chatgpt\.com|chat\.openai\.com)$/, /^https:\/\/(www\.)?makietka\.app$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
export const DOMYSLNY_ADRES = 'https://pganajmivwtstapnwsgv.supabase.co';
export const DOMYSLNY_KLUCZ_PUBLICZNY = 'sb_publishable_gt_GEmBz6SfJZ0o9rAhLQA_HKH0V_cq';
const WZOR_KLUCZA = /^sdk_[0-9a-f]{32}_[A-Za-z0-9_-]{20,100}$/;

function naglowkiCors(origin) {
  return {
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, accept, authorization, mcp-protocol-version, mcp-method, mcp-name, mcp-session-id, last-event-id',
    'access-control-max-age': '86400',
  };
}

const json = (status, tresc, dodatkowe = {}) => new Response(tresc === null ? null : JSON.stringify(tresc), {
  status,
  headers: { ...(tresc === null ? {} : { 'content-type': 'application/json; charset=utf-8' }), 'cache-control': 'no-store', ...dodatkowe },
});

// Klucz z adresu (/mcp/sdk_…), z ?klucz= albo z nagłówka Authorization: Bearer sdk_….
export function kluczZZadania(request) {
  const url = new URL(request.url);
  const zSciezki = url.pathname.split('/').map((s) => decodeURIComponent(s)).find((s) => s.startsWith('sdk_'));
  const zParametru = url.searchParams.get('klucz');
  const zNaglowka = /^Bearer\s+(sdk_\S+)$/i.exec(request.headers.get('authorization') || '')?.[1];
  return (zSciezki || zParametru || zNaglowka || '').trim();
}

// Wartość nagłówka MCP może być zakodowana: =?base64?…?= (UTF-8).
function odkoduj(wartosc) {
  const m = /^=\?base64\?(.*)\?=$/.exec(wartosc || '');
  if (!m) return wartosc;
  const bajty = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bajty);
}

// Wersja 2026-07-28 wymaga, żeby nagłówki zgadzały się z treścią żądania.
function bladNaglowkow(request, w) {
  const wersja = w?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  if (!wersja || !WERSJE_NOWE.includes(wersja)) return null;
  const h = (n) => request.headers.get(n);
  if (h('mcp-protocol-version') !== wersja) return 'Nagłówek MCP-Protocol-Version jest wymagany i musi być równy wersji z _meta.';
  if (h('mcp-method') !== w.method) return 'Nagłówek Mcp-Method jest wymagany i musi być równy metodzie żądania.';
  if (['tools/call', 'resources/read', 'prompts/get'].includes(w.method)) {
    const nazwa = w.params?.name ?? w.params?.uri;
    if (odkoduj(h('mcp-name')) !== nazwa) return 'Nagłówek Mcp-Name jest wymagany i musi być równy nazwie z żądania.';
  }
  return null;
}

// Status HTTP dla odpowiedzi JSON-RPC (wersja 2026-07-28: błędy protokołu jako 400/404; starsze – 200).
function status(odpowiedz, nowa) {
  const kod = odpowiedz?.error?.code;
  if (kod === BLEDY.WERSJA || kod === BLEDY.NAGLOWKI || kod === BLEDY.ZADANIE || kod === BLEDY.PARSE) return 400;
  if (kod === BLEDY.METODA && nowa) return 404;
  return 200;
}

const MAKS_POST = 50 * 1024 * 1024;

async function obsluzObraz(request, url, env, cors) {
  const klucz = kluczZZadania(request);
  if (!WZOR_KLUCZA.test(klucz)) return json(401, { blad: 'Adres nie zawiera prawidłowego klucza dostępu (…/mcp/<klucz sdk_…>/obraz).' }, cors);
  if (Number(request.headers.get('content-length') || 0) > MAKS_POST) return json(413, { blad: 'Plik jest za duży (najwyżej 50 MB; jeden obraz – 25 MB).' }, cors);
  const bajty = new Uint8Array(await request.arrayBuffer());
  if (!bajty.length) return json(400, { blad: 'Pusta treść – wyślij plik obrazu albo ZIP jako treść żądania POST.' }, cors);
  const ogolny = utworzSerwer({ adres: env.adres || DOMYSLNY_ADRES, kluczPubliczny: env.kluczPubliczny || DOMYSLNY_KLUCZ_PUBLICZNY, klucz });
  try {
    // ?projekt=<id albo nazwa> – klucz konta może prowadzić do kilku projektów (decyzja #94).
    const serwer = (await ogolny.dlaProjektu(url.searchParams.get('projekt'))) || ogolny;
    const w = await serwer.wgrajBajty(bajty, url.searchParams.get('nazwa') || '', { zastap: url.searchParams.get('zastap') || null });
    return json(200, { wgrane: w.wyniki, opis: w.opisy.join('\n') }, cors);
  } catch (e) {
    return json(400, { blad: e.message }, cors);
  }
}

// env: { adres?, kluczPubliczny? } – adres bazy i publikowalny klucz (domyślnie baza Makietki).
export async function obsluzHttp(request, env = {}) {
  const origin = request.headers.get('origin');
  if (origin && !ZRODLA.some((r) => r.test(origin))) {
    return json(403, { jsonrpc: '2.0', error: { code: BLEDY.ZADANIE, message: 'Niedozwolone źródło żądania (Origin).' } });
  }
  const cors = naglowkiCors(origin);
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  // Łącznik nie używa logowania OAuth: brak opisu serwera autoryzacji oznacza „bez logowania”.
  if (url.pathname.includes('/.well-known/')) return json(404, { error: 'not_found' }, cors);
  if (request.method !== 'POST') {
    return json(405, { jsonrpc: '2.0', error: { code: BLEDY.ZADANIE, message: 'Łącznik MCP Makietki przyjmuje tylko POST (Streamable HTTP).' } }, { ...cors, allow: 'POST, OPTIONS' });
  }

  // Plik wysłany wprost: POST …/mcp/<klucz>/obraz?nazwa=… z treścią pliku (obraz albo ZIP z obrazami).
  // Dla piaskownic AI z dostępem do sieci i dla skryptów – bez przepisywania pliku na base64.
  if (/\/obraz\/?$/.test(url.pathname)) return obsluzObraz(request, url, env, cors);

  let tresc;
  try { tresc = JSON.parse(await request.text()); } catch {
    return json(400, { jsonrpc: '2.0', id: null, error: { code: BLEDY.PARSE, message: 'Nieprawidłowy JSON.' } }, cors);
  }

  const klucz = kluczZZadania(request);
  const serwer = utworzSerwer({
    adres: env.adres || DOMYSLNY_ADRES,
    kluczPubliczny: env.kluczPubliczny || DOMYSLNY_KLUCZ_PUBLICZNY,
    klucz: WZOR_KLUCZA.test(klucz) ? klucz : '',
    // Pliki z rozmowy (pole pliki_z_czatu z _meta „openai/fileParams”) tylko dla ChatGPT – Claude odrzucał listę
    // narzędzi z tym dopiskiem („Couldn't reload tools from the server”).
    plikiZCzatu: /openai|chatgpt/i.test(request.headers.get('user-agent') || ''),
    brakKlucza: klucz
      ? 'Adres łącznika zawiera nieprawidłowy klucz dostępu. Skopiuj adres jeszcze raz z okna „Dostęp dla AI” w aplikacji.'
      : 'Adres łącznika nie zawiera klucza dostępu. Skopiuj pełny adres z okna „Dostęp dla AI” w aplikacji (menu ⋯ edytora).',
  });

  const jedna = async (w) => {
    const blad = bladNaglowkow(request, w);
    if (blad) return { odp: { jsonrpc: '2.0', id: w.id ?? null, error: { code: BLEDY.NAGLOWKI, message: blad } }, nowa: true };
    const wersja = w?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
    const odp = await serwer.obsluz(w, {});
    return { odp, nowa: Boolean(wersja) && !WERSJE_STARE.includes(wersja) };
  };

  if (Array.isArray(tresc)) { // lista wiadomości (wersja 2025-03-26)
    const odpowiedzi = (await Promise.all(tresc.map(jedna))).map((x) => x.odp).filter(Boolean);
    return odpowiedzi.length ? json(200, odpowiedzi, cors) : new Response(null, { status: 202, headers: cors });
  }
  const { odp, nowa } = await jedna(tresc);
  if (!odp) return new Response(null, { status: 202, headers: cors }); // powiadomienie
  return json(status(odp, nowa), odp, cors);
}
