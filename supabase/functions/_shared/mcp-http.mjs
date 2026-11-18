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

/* global URLSearchParams */
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
    'access-control-allow-methods': 'GET, POST, OPTIONS',
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

// ---------- Dostęp przez zwykłe adresy (GET) – dla AI bez łącznika MCP (#239) ----------
// Darmowe czaty (ChatGPT, Claude, Gemini…) często nie mają własnych łączników, ale umieją otworzyć adres strony.
// Ten sam adres łącznika otwarty zwykłym GET (bez Accept: text/event-stream) zwraca opis i listę narzędzi
// w czystym tekście, a …/n/<narzędzie>?parametr=wartość (albo ?json={…}) wywołuje narzędzie i zwraca wynik.
// Tekst, nie HTML: Supabase podmienia text/html na text/plain, a AI czyta tekst najlepiej.

const tekst = (status, tresc) => new Response(tresc, {
  status,
  headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' },
});

// Wartość parametru z adresu: liczba, true/false, null, JSON (obiekt/lista) albo zwykły tekst.
function wartoscZAdresu(v) {
  const t = String(v).trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === 'true' || t === 'false') return t === 'true';
  if (t === 'null') return null;
  if (/^[[{]/.test(t)) { try { return JSON.parse(t); } catch { /* zwykły tekst */ } }
  return v;
}

export function argumentyZAdresu(url) {
  let args = {};
  const j = url.searchParams.get('json');
  if (j) {
    try { args = JSON.parse(j); } catch { throw new Error('Parametr json nie jest poprawnym JSON-em (zakoduj go w adresie, np. encodeURIComponent).'); }
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Parametr json musi być obiektem {…}.');
  }
  for (const [k, v] of url.searchParams) if (!['json', 'klucz'].includes(k)) args[k] = wartoscZAdresu(v);
  return args;
}

function opisSchematu(schemat) {
  const pola = Object.entries(schemat?.properties || {});
  if (!pola.length) return '  (bez parametrów)';
  const wymagane = new Set(schemat.required || []);
  return pola.map(([n, d]) => `  - ${n}${wymagane.has(n) ? ' (wymagany)' : ''}: ${d.type || (d.oneOf || d.anyOf ? 'różne' : 'dowolny')}${d.enum ? ` – jedno z: ${d.enum.join(', ')}` : ''}${d.description ? ` – ${String(d.description).replace(/\s+/g, ' ').slice(0, 300)}` : ''}`).join('\n');
}

async function obsluzStrone(request, url, env) {
  const klucz = kluczZZadania(request);
  if (!WZOR_KLUCZA.test(klucz)) return tekst(401, 'Ten adres nie zawiera prawidłowego klucza dostępu Makietki. Skopiuj pełny adres z aplikacji: Ustawienia konta → Sztuczna inteligencja.');
  const serwer = utworzSerwer({ adres: env.adres || DOMYSLNY_ADRES, kluczPubliczny: env.kluczPubliczny || DOMYSLNY_KLUCZ_PUBLICZNY, klucz });
  let nr = 0;
  const wolaj = async (method, params = {}) => {
    const w = await serwer.obsluz({ jsonrpc: '2.0', id: (nr += 1), method, params }, {});
    if (w?.error) throw new Error(w.error.message);
    return w?.result;
  };
  // Adres bazowy linków – zawsze publiczny https (https://api.makietka.app/mcp/<klucz>), nie adres, pod którym
  // funkcja widzi żądanie (w Supabase wewnętrznie http:// i host bazy – AI dostawało błąd przekierowania, #246).
  // Klucz z nagłówka (token z logowania) nie trafia do linków – klient i tak go dokłada.
  const zNaglowka = /^Bearer\s+sdk_/i.test(request.headers.get('authorization') || '');
  const baza = `${env.publiczny || ADRES_PUBLICZNY}/mcp${zNaglowka ? '' : `/${klucz}`}`;
  const link = (nazwa, args = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(args)) q.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    const qs = q.toString();
    return `${baza}/n/${nazwa}${qs ? `?${qs}` : ''}`;
  };
  try {
    const init = await wolaj('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'makietka-strona', version: '1' } });
    const m = /\/n\/([a-z_]+)\/?$/.exec(url.pathname);
    if (m) {
      const args = argumentyZAdresu(url);
      const r = await wolaj('tools/call', { name: m[1], arguments: args });
      const tresc = (r?.content || []).map((c) => c.text || (c.type === 'image' ? '[obraz]' : '')).join('\n') || '(brak treści)';
      return tekst(200, `${r?.isError ? 'BŁĄD' : 'WYNIK'} narzędzia ${m[1]}\n\n${tresc}\n\n---\nWszystkie narzędzia i zasady: ${baza}\n`);
    }
    const { tools } = await wolaj('tools/list');
    const nazwy = new Set(tools.map((t) => t.name));
    const szybkie = [
      nazwy.has('projekty') && `- Projekty w zasięgu klucza: ${link('projekty')}`,
      nazwy.has('przeglad_projektu') && `- Przegląd projektu (gdy klucz ma kilka projektów, dopisz &projekt=<id albo nazwa>): ${link('przeglad_projektu')}`,
      nazwy.has('opis_formatu') && `- Opis formatu projektu: ${link('opis_formatu')}`,
    ].filter(Boolean).join('\n');
    const tekstStrony = `MAKIETKA – DOSTĘP DLA AI PRZEZ ADRESY (bez łącznika MCP)

Ta strona jest dla asystenta AI, który nie ma łącznika MCP Makietki, ale umie otwierać adresy (np. darmowy ChatGPT, Claude, Gemini z przeglądaniem stron). Użytkownik sam dał Ci ten adres w rozmowie, żebyś z niego korzystał. Linki z tej strony otwieraj dokładnie tak, jak są podane (pełny adres) – bez skracania i bez zastępowania części adresu; nie przepisuj adresu poza rozmowę.

JAK UŻYWAĆ
Każde narzędzie wywołujesz, otwierając adres:
  ${baza}/n/<narzędzie>?<parametr>=<wartość>&<parametr>=<wartość>
Wartości: tekst wprost (zakodowany w adresie), liczby i true/false wprost, obiekty i listy jako JSON. Parametry złożone możesz podać razem: ?json=<cały obiekt parametrów JSON, zakodowany w adresie>.
Odpowiedź to zwykły tekst: wynik narzędzia albo opis błędu z tym, co poprawić. Zmieniaj małymi krokami i po zmianie sprawdź wynik (przeglad_projektu, czytaj).
Jeśli nie możesz otworzyć adresu, który sam zbudowałeś, poproś użytkownika, żeby wkleił Ci go w rozmowie – albo użyj w Makietce czatu AI w trybie „kopiuj i wklej”.

NA POCZĄTEK
${szybkie}

ZASADY OD MAKIETKI
${init?.instructions || ''}

NARZĘDZIA (${tools.length})
${tools.map((t) => `${t.name}\n  ${String(t.description || '').replace(/\s+/g, ' ')}\n  Adres: ${link(t.name)}\n${opisSchematu(t.inputSchema)}`).join('\n\n')}
`;
    return tekst(200, tekstStrony);
  } catch (e) {
    return tekst(400, `BŁĄD: ${e.message}\n\nOpis i lista narzędzi: ${baza}\n`);
  }
}

// ---------- Logowanie OAuth 2.1 (#244) ----------
// „Połącz z Makietką” w Claude / ChatGPT bez kopiowania adresu z kluczem: opis zasobu i serwera autoryzacji,
// rejestracja klienta (DCR), /authorize (PKCE S256) → strona zgody w Makietce, /token → token = klucz dostępu AI
// (Authorization: Bearer sdk_…) z zakresem wybranym przez użytkownika. Logika i kontrole – w bazie (oauth_*).

export const ADRES_PUBLICZNY = 'https://api.makietka.app';
export const ADRES_APLIKACJI = 'https://makietka.app/';

async function rpcBazy(env, funkcja, parametry) {
  const klucz = env.kluczPubliczny || DOMYSLNY_KLUCZ_PUBLICZNY;
  const odp = await fetch(`${env.adres || DOMYSLNY_ADRES}/rest/v1/rpc/${funkcja}`, {
    method: 'POST', headers: { apikey: klucz, authorization: `Bearer ${klucz}`, 'content-type': 'application/json' }, body: JSON.stringify(parametry),
  });
  const t = await odp.text();
  let d = null;
  try { d = t ? JSON.parse(t) : null; } catch { /* nie-JSON */ }
  if (!odp.ok) throw new Error(d?.message || t.slice(0, 200) || `błąd ${odp.status}`);
  return d;
}

export function metadaneOAuth(env = {}) {
  const pub = env.publiczny || ADRES_PUBLICZNY;
  return {
    zasob: { resource: `${pub}/mcp`, authorization_servers: [pub], bearer_methods_supported: ['header'], resource_name: 'Makietka', resource_documentation: 'https://makietka.app/ai/api.md' },
    serwer: {
      issuer: pub,
      authorization_endpoint: `${pub}/mcp/oauth/authorize`,
      token_endpoint: `${pub}/mcp/oauth/token`,
      registration_endpoint: `${pub}/mcp/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['makietka'],
      service_documentation: 'https://makietka.app/ai/api.md',
    },
  };
}

async function obsluzOAuth(request, url, env, cors) {
  const m = metadaneOAuth(env);
  const sc = url.pathname;
  if (/\/\.well-known\/oauth-protected-resource/.test(sc)) return json(200, m.zasob, { ...cors, 'access-control-allow-origin': '*' });
  if (/\/\.well-known\/(oauth-authorization-server|openid-configuration)/.test(sc)) return json(200, m.serwer, { ...cors, 'access-control-allow-origin': '*' });
  if (/\/oauth\/register\/?$/.test(sc) && request.method === 'POST') {
    let b = {};
    try { b = JSON.parse(await request.text() || '{}'); } catch { return json(400, { error: 'invalid_client_metadata', error_description: 'Nieprawidłowy JSON.' }, cors); }
    try {
      const w = await rpcBazy(env, 'oauth_rejestruj', { p_nazwa: String(b.client_name || ''), p_adresy: Array.isArray(b.redirect_uris) ? b.redirect_uris.map(String) : [] });
      return json(201, { ...w, token_endpoint_auth_method: 'none', grant_types: ['authorization_code'], response_types: ['code'], client_id_issued_at: Math.floor(Date.now() / 1000) }, cors);
    } catch (e) { return json(400, { error: 'invalid_redirect_uri', error_description: e.message }, cors); }
  }
  if (/\/oauth\/authorize\/?$/.test(sc) && request.method === 'GET') {
    const q = url.searchParams;
    if (q.get('response_type') !== 'code' || (q.get('code_challenge_method') || 'S256') !== 'S256') return tekst(400, 'Makietka przyjmuje tylko response_type=code z PKCE (code_challenge_method=S256).');
    try {
      const id = await rpcBazy(env, 'oauth_rozpocznij', { p_klient: q.get('client_id') || '', p_adres: q.get('redirect_uri') || '', p_wyzwanie: q.get('code_challenge') || '', p_stan: q.get('state') || null });
      return new Response(null, { status: 302, headers: { location: `${env.aplikacja || ADRES_APLIKACJI}#/polacz-ai/${id}`, 'cache-control': 'no-store' } });
    } catch (e) { return tekst(400, `Nie da się rozpocząć łączenia z Makietką: ${e.message}`); }
  }
  if (/\/oauth\/token\/?$/.test(sc) && request.method === 'POST') {
    const surowe = await request.text();
    let p;
    try { p = /json/.test(request.headers.get('content-type') || '') ? JSON.parse(surowe || '{}') : Object.fromEntries(new URLSearchParams(surowe)); } catch { p = {}; }
    if (p.grant_type !== 'authorization_code') return json(400, { error: 'unsupported_grant_type' }, cors);
    try {
      const w = await rpcBazy(env, 'oauth_wymien', { p_kod: p.code || '', p_weryfikator: p.code_verifier || '', p_klient: p.client_id || '', p_adres: p.redirect_uri || '' });
      const sek = w.wazny_do ? Math.max(60, Math.floor((new Date(w.wazny_do).getTime() - Date.now()) / 1000)) : undefined;
      return json(200, { access_token: w.klucz, token_type: 'Bearer', ...(sek ? { expires_in: sek } : {}), scope: 'makietka' }, cors);
    } catch { return json(400, { error: 'invalid_grant', error_description: 'Kod jest nieważny, wygasł albo nie pasuje (PKCE, klient, adres powrotu).' }, cors); }
  }
  return null;
}

// env: { adres?, kluczPubliczny?, publiczny?, aplikacja? } – adres bazy i publikowalny klucz (domyślnie baza Makietki),
// publiczny adres łącznika i adres aplikacji (dla OAuth).
export async function obsluzHttp(request, env = {}) {
  const origin = request.headers.get('origin');
  if (origin && !ZRODLA.some((r) => r.test(origin))) {
    return json(403, { jsonrpc: '2.0', error: { code: BLEDY.ZADANIE, message: 'Niedozwolone źródło żądania (Origin).' } });
  }
  const cors = naglowkiCors(origin);
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  // Logowanie OAuth (#244): opisy, rejestracja, autoryzacja, token.
  if (url.pathname.includes('/.well-known/') || /\/oauth\/(register|authorize|token)\/?$/.test(url.pathname)) {
    const w = await obsluzOAuth(request, url, env, cors);
    return w || json(404, { error: 'not_found' }, cors);
  }
  // Zwykłe otwarcie adresu (przeglądarka, narzędzie AI do czytania stron) – opis i narzędzia w tekście (#239).
  // GET z Accept: text/event-stream to klient MCP pytający o strumień – ten dalej dostaje 405.
  if ((request.method === 'GET' || request.method === 'HEAD') && !/text\/event-stream/.test(request.headers.get('accept') || '')) return obsluzStrone(request, url, env);
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
  // Bez żadnego klucza – 401 z opisem zasobu: klient MCP rozpoczyna wtedy logowanie OAuth (#244).
  if (!klucz) {
    const pub = env.publiczny || ADRES_PUBLICZNY;
    return json(401, { jsonrpc: '2.0', id: tresc?.id ?? null, error: { code: BLEDY.ZADANIE, message: 'Zaloguj się do Makietki (OAuth) albo użyj adresu łącznika z kluczem z ustawień konta → Sztuczna inteligencja.' } }, {
      ...cors, 'www-authenticate': `Bearer resource_metadata="${pub}/.well-known/oauth-protected-resource/mcp"`, 'access-control-expose-headers': 'www-authenticate',
    });
  }
  const serwer = utworzSerwer({
    adres: env.adres || DOMYSLNY_ADRES,
    kluczPubliczny: env.kluczPubliczny || DOMYSLNY_KLUCZ_PUBLICZNY,
    klucz: WZOR_KLUCZA.test(klucz) ? klucz : '',
    // Pliki z rozmowy (pole pliki_z_czatu z _meta „openai/fileParams”) tylko dla ChatGPT – Claude odrzucał listę
    // narzędzi z tym dopiskiem („Couldn't reload tools from the server”).
    plikiZCzatu: /openai|chatgpt/i.test(request.headers.get('user-agent') || ''),
    brakKlucza: klucz
      ? 'Adres łącznika zawiera nieprawidłowy klucz dostępu. Skopiuj adres jeszcze raz z okna „Sztuczna inteligencja” w aplikacji.'
      : 'Adres łącznika nie zawiera klucza dostępu. Skopiuj pełny adres z okna „Sztuczna inteligencja” w aplikacji (menu ⋯ edytora).',
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
