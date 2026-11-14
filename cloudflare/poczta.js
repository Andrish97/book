// Poczta w Workerze api.makietka.app (decyzja #95), wzorem Familiady (cloudflare/maintenance-worker/src/lib/email):
//  • email()  – poczta przychodząca na kontakt@ (i noreply@, no-reply@ – z plakietką w panelu) (Cloudflare Email Routing → „Send to a Worker”):
//               rozbiór MIME, prosta ochrona przed spamem, zapis do skrzynki w bazie (poczta_przyjmij),
//  • /kontakt – formularz kontaktowy z aplikacji: pułapka na boty, Cloudflare Turnstile (gdy jest sekret),
//               limity na IP i adres (liczy baza – kontakt_przyjmij), potwierdzenie mailem przez kolejkę,
//  • scheduled() – co minutę prosi funkcję `poczta` o przebieg kolejki maili.
// Sekrety Workera (Workers & Pages → makietka-api → Settings → Variables and Secrets), nic w repozytorium (#106):
//   SUPABASE_SERVICE_ROLE_KEY – secret key z Supabase (Project Settings → API Keys); nim Worker woła poczta_przyjmij
//                               i kontakt_przyjmij (tylko rola service_role),
//   TURNSTILE_SECRET          – (opcjonalnie) sekret Turnstile; bez niego formularz chroni pułapka i limity,
//   FORWARD_TO                – (opcjonalnie) adres, na który Worker przekazuje też kopię poczty przychodzącej.

export const SUPABASE = 'https://pganajmivwtstapnwsgv.supabase.co';
export const KLUCZ_PUBLICZNY = 'sb_publishable_gt_GEmBz6SfJZ0o9rAhLQA_HKH0V_cq';
const MAKS_WIADOMOSC = 15 * 1024 * 1024; // większa poczta wraca do nadawcy
const MAKS_ZALACZNIK = 10 * 1024 * 1024;
const ZRODLA = /^(https:\/\/(www\.)?makietka\.app|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

const adresBazy = (env) => String(env?.SUPABASE_URL || SUPABASE).replace(/\/+$/, '');

// ---------- Rozbiór MIME (jak w Familiadzie: inbound-email.js, uproszczony) ----------

// Bajty jako „łańcuch binarny” (znak = bajt) – tak nie psujemy 8-bitowych treści przed odkodowaniem zestawu znaków.
export const naBinarny = (bajty) => {
  let s = '';
  for (let i = 0; i < bajty.length; i += 8192) s += String.fromCharCode(...bajty.subarray(i, i + 8192));
  return s;
};
const zBinarnego = (s) => Uint8Array.from(s, (z) => z.charCodeAt(0) & 255);
function dekoduj(bajty, zestaw = 'utf-8') {
  try { return new TextDecoder(zestaw.toLowerCase()).decode(bajty); } catch { return new TextDecoder('utf-8').decode(bajty); }
}

// =?utf-8?B?…?= i =?iso-8859-2?Q?…?= w nagłówkach.
export function dekodujSlowa(s) {
  if (!s) return '';
  const zlaczone = String(s).replace(/(\?=)[ \t]+(=\?)/g, '$1$2');
  const wynik = zlaczone.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (cale, zestaw, rodzaj, tekst) => {
    try {
      const bin = rodzaj.toLowerCase() === 'b'
        ? atob(tekst.replace(/\s+/g, ''))
        : tekst.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      return dekoduj(zBinarnego(bin), zestaw);
    } catch { return cale; }
  });
  // Surowe 8-bitowe UTF-8 w nagłówku (niezgodne ze standardem, ale częste).
  return /[\x80-\xff]/.test(wynik) && !/[^\x00-\xff]/.test(wynik) ? dekoduj(zBinarnego(wynik)) : wynik;
}

const rozwin = (s) => s.replace(/\r?\n[ \t]+/g, ' ');
function rozdziel(czesc) {
  const i = czesc.search(/\r?\n\r?\n/);
  if (i < 0) return { naglowki: czesc, cialo: '' };
  const m = czesc.slice(i).match(/^\r?\n\r?\n/);
  return { naglowki: czesc.slice(0, i), cialo: czesc.slice(i + m[0].length) };
}
export function naglowek(naglowki, nazwa) {
  const m = rozwin(naglowki).match(new RegExp(`^${nazwa}:[ \\t]*(.*)$`, 'im'));
  return m ? m[1].trim() : '';
}
const parametr = (wartosc, nazwa) => (wartosc.match(new RegExp(`${nazwa}\\*?=(?:[^']*'[^']*')?"?([^";]+)"?`, 'i'))?.[1] || '').trim();

function trescCzesci(naglowki, cialo) {
  const kodowanie = naglowek(naglowki, 'Content-Transfer-Encoding').toLowerCase();
  const zestaw = parametr(naglowek(naglowki, 'Content-Type'), 'charset') || 'utf-8';
  let bin = cialo;
  if (kodowanie === 'base64') {
    try { bin = atob(cialo.replace(/\s+/g, '')); } catch { /* zostaje jak jest */ }
  } else if (kodowanie === 'quoted-printable') {
    bin = cialo.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return { bin, zestaw };
}

// Surowa wiadomość (łańcuch binarny) → { naglowki, tekst, html, zalaczniki: [{ nazwa, typ, bajty }] }.
export function rozbierz(surowa) {
  const { naglowki, cialo } = rozdziel(surowa);
  const wynik = { naglowki, tekst: '', html: '', zalaczniki: [] };
  const teksty = [];
  const htmle = [];
  const czesc = (h, c, glebokosc = 0) => {
    const typPelny = naglowek(h, 'Content-Type') || 'text/plain';
    const typ = typPelny.split(';')[0].trim().toLowerCase();
    if (typ.startsWith('multipart/') && glebokosc < 6) {
      const granica = parametr(typPelny, 'boundary');
      if (!granica) return;
      const esc = granica.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const kawalek of c.split(new RegExp(`\\r?\\n?--${esc}(?:--)?[ \\t]*\\r?\\n?`))) {
        if (!kawalek.trim()) continue;
        const r = rozdziel(kawalek);
        czesc(r.naglowki, r.cialo, glebokosc + 1);
      }
      return;
    }
    const dyspozycja = naglowek(h, 'Content-Disposition');
    const nazwa = dekodujSlowa(parametr(dyspozycja, 'filename') || parametr(typPelny, 'name'));
    const { bin, zestaw } = trescCzesci(h, c);
    if (!/^attachment/i.test(dyspozycja) && !nazwa && (typ === 'text/plain' || typ === 'text/html')) {
      (typ === 'text/html' ? htmle : teksty).push(dekoduj(zBinarnego(bin), zestaw).trim());
      return;
    }
    wynik.zalaczniki.push({ nazwa: nazwa || `zalacznik-${wynik.zalaczniki.length + 1}`, typ, bajty: zBinarnego(bin) });
  };
  czesc(naglowki, cialo);
  wynik.tekst = teksty.join('\n\n');
  wynik.html = htmle.join('\n');
  return wynik;
}

// „Jan Kowalski” <jan@x.pl> → { email, nazwa }.
export function adresZNaglowka(s) {
  const t = dekodujSlowa(s || '');
  const m = t.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) return { email: m[2].trim().toLowerCase(), nazwa: m[1].trim() || null };
  return { email: t.trim().toLowerCase(), nazwa: null };
}

// Prosty tekst z HTML (zajawka w panelu, gdy nadawca przysłał sam HTML).
export const tekstZHtml = (h) => String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();

// Wynik sprawdzenia nadawcy, który Cloudflare dopisuje do wiadomości: DMARC/SPF+DKIM nieudane → do folderu „spam”.
export function wygladaNaSpam(naglowki) {
  const a = `${naglowek(naglowki, 'Authentication-Results')} ${naglowek(naglowki, 'ARC-Authentication-Results')}`.toLowerCase();
  return /dmarc=fail/.test(a) || (/spf=fail/.test(a) && /dkim=(fail|none)/.test(a));
}

// Klucz serwisowy: nowy (sb_secret_…) idzie tylko w apikey, dawny (JWT) także jako Bearer.
const naglowkiSerwisowe = (k) => (String(k).startsWith('sb_') ? { apikey: k } : { apikey: k, authorization: `Bearer ${k}` });

async function rpc(env, nazwa, parametry) {
  const odp = await fetch(`${adresBazy(env)}/rest/v1/rpc/${nazwa}`, {
    method: 'POST',
    headers: { ...naglowkiSerwisowe(env.SUPABASE_SERVICE_ROLE_KEY), 'content-type': 'application/json' },
    body: JSON.stringify(parametry),
  });
  const tresc = await odp.json().catch(() => null);
  if (!odp.ok) throw new Error(tresc?.message || `baza: ${odp.status}`);
  return tresc;
}

// Zalogowany nadawca formularza: id konta z tokenu sesji (sprawdza Supabase Auth); zły token – jak gość.
async function uzytkownikZTokenu(env, autoryzacja) {
  const odp = await fetch(`${adresBazy(env)}/auth/v1/user`, { headers: { apikey: KLUCZ_PUBLICZNY, authorization: autoryzacja } }).catch(() => null);
  if (!odp?.ok) return null;
  return (await odp.json().catch(() => null))?.id || null;
}

// Prośba o przebieg kolejki (Cron i po formularzu).
export async function przebiegKolejki(env) {
  const odp = await fetch(`${adresBazy(env)}/functions/v1/poczta`, {
    method: 'POST', headers: { apikey: KLUCZ_PUBLICZNY, 'content-type': 'application/json' }, body: JSON.stringify({ kolejka: true }),
  });
  return odp.json().catch(() => null);
}

// ---------- Poczta przychodząca ----------

export async function obsluzEmail(message, env, ctx) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[poczta] brak sekretu SUPABASE_SERVICE_ROLE_KEY – wiadomość odrzucona');
    message.setReject?.('Skrzynka nie jest jeszcze gotowa – spróbuj później.');
    return { blad: 'niegotowy' };
  }
  if (Number(message.rawSize || 0) > MAKS_WIADOMOSC) {
    message.setReject?.('Wiadomość jest za duża (najwyżej 15 MB).');
    return { blad: 'za-duza' };
  }
  if (env.FORWARD_TO) ctx?.waitUntil?.(message.forward(env.FORWARD_TO).catch(() => {}));
  const surowa = naBinarny(new Uint8Array(await new Response(message.raw).arrayBuffer()));
  const w = rozbierz(surowa);
  const od = adresZNaglowka(naglowek(w.naglowki, 'From') || message.from);
  const zalaczniki = [];
  for (const z of w.zalaczniki.slice(0, 20)) {
    const opis = { nazwa: z.nazwa.slice(0, 200), typ: z.typ, rozmiar: z.bajty.length };
    // Treść załącznika do R2 (binding PLIKI, prefiks poczta/; pobieranie: GET /pliki/_poczta/… tylko dla administratora).
    // Większe niż 10 MB – sam opis. Błąd zapisu przerywa przyjęcie – serwer nadawcy ponowi wysyłkę.
    if (z.bajty.length <= MAKS_ZALACZNIK) {
      const klucz = `poczta/${crypto.randomUUID()}/${opis.nazwa.replace(/[^\p{L}\p{N}._-]+/gu, '_')}`;
      await env.PLIKI.put(klucz, z.bajty, { httpMetadata: { contentType: z.typ } });
      opis.klucz = klucz;
    }
    zalaczniki.push(opis);
  }
  const ref = naglowek(w.naglowki, 'References').match(/<[^>]+>/g) || [];
  const dane = {
    od_email: od.email || String(message.from || '').toLowerCase(),
    od_nazwa: od.nazwa,
    do_email: String(message.to || ''),
    temat: dekodujSlowa(naglowek(w.naglowki, 'Subject')).slice(0, 300),
    tekst: (w.tekst || tekstZHtml(w.html)).slice(0, 200000),
    html: w.html.slice(0, 400000),
    message_id: naglowek(w.naglowki, 'Message-ID') || null,
    in_reply_to: (naglowek(w.naglowki, 'In-Reply-To').match(/<[^>]+>/) || [null])[0],
    referencje: ref.slice(-20),
    zalaczniki,
    spam: wygladaNaSpam(w.naglowki),
  };
  const wynik = await rpc(env, 'poczta_przyjmij', { p: dane });
  if (wynik?.blad === 'za-czesto') message.setReject?.('Za dużo wiadomości – spróbuj później.');
  else if (wynik?.blad) console.log(`[poczta] odrzucona: ${wynik.blad}`);
  return wynik;
}

// ---------- Formularz kontaktowy ----------

const json = (status, tresc, naglowki = {}) => new Response(JSON.stringify(tresc), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...naglowki } });
function cors(origin) {
  return origin && ZRODLA.test(origin)
    ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-max-age': '86400' }
    : {};
}
async function sha256(tekst) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tekst));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function sprawdzTurnstile(env, token, ip, siec = fetch) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const dane = new FormData();
  dane.append('secret', env.TURNSTILE_SECRET);
  dane.append('response', token);
  if (ip) dane.append('remoteip', ip);
  const odp = await siec('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: dane }).catch(() => null);
  return Boolean((await odp?.json().catch(() => null))?.success);
}

export async function obsluzKontakt(request, env, ctx) {
  const origin = request.headers.get('origin');
  const c = cors(origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });
  if (request.method !== 'POST') return json(405, { blad: 'Tylko POST.' }, c);
  if (origin && !ZRODLA.test(origin)) return json(403, { blad: 'Niedozwolone źródło.' });
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json(400, { blad: 'Pusta wiadomość.' }, c);
  // Pułapka: ukryte pole wypełniają tylko boty – udajemy, że poszło.
  if (b.www) return json(200, { ok: true }, c);
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!(await sprawdzTurnstile(env, b.turnstile, ip))) return json(400, { blad: 'Potwierdź, że nie jesteś botem.', powod: 'captcha' }, c);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json(503, { blad: 'Formularz jeszcze nie działa – napisz na kontakt@makietka.app.', powod: 'niegotowy' }, c);
  const autoryzacja = /^Bearer\s+\S+$/i.test(request.headers.get('authorization') || '') ? request.headers.get('authorization') : null;
  let w;
  try {
    w = await rpc(env, 'kontakt_przyjmij', {
      p_ip: (await sha256(`${ip}|${env.SUPABASE_SERVICE_ROLE_KEY}`)).slice(0, 32),
      p_email: String(b.email || '').slice(0, 320), p_temat: String(b.temat || '').slice(0, 200), p_tresc: String(b.tresc || '').slice(0, 5000),
      p_uzytkownik: autoryzacja ? await uzytkownikZTokenu(env, autoryzacja) : null,
    });
  } catch (e) {
    return json(502, { blad: `Nie udało się zapisać wiadomości (${e.message}).` }, c);
  }
  if (w?.ok) {
    ctx?.waitUntil?.(przebiegKolejki(env).catch(() => {}));
    return json(200, { ok: true }, c);
  }
  const komunikaty = {
    'za-czesto': `Za dużo wiadomości – spróbuj ponownie za ${w?.za || 'chwilę'}.`,
    'zly-email': 'Podaj poprawny adres e-mail, żebyśmy mogli odpowiedzieć.',
    'za-krotka': 'Napisz trochę więcej (co najmniej 10 znaków).',
    niegotowy: 'Formularz jeszcze nie działa – napisz na kontakt@makietka.app.',
  };
  const status = { 'za-czesto': 429, niegotowy: 503 }[w?.blad] || 422;
  return json(status, { blad: komunikaty[w?.blad] || 'Nie udało się wysłać wiadomości.', powod: w?.blad, za: w?.za, za_sekund: w?.za_sekund }, c);
}
