// Poczta aplikacji (decyzja #86): wszystkie e-maile idą przez API Brevo z Funkcji Edge `poczta`
// (supabase/functions/poczta/index.ts). Wspólne dla Deno i testów w Node (tests/poczta.test.cjs).
//
// Dwie drogi do funkcji:
//  1. Hak Auth „Send Email” (Authentication → Hooks): Supabase Auth woła funkcję zamiast wysyłać pocztę sam –
//     rejestracja, reset hasła, zmiana adresu, link logowania, zaproszenie z panelu. Żądanie ma podpis
//     standardwebhooks (nagłówki webhook-id, webhook-timestamp, webhook-signature), sprawdzany sekretem
//     SEND_EMAIL_HOOK_SECRET („v1,whsec_…”). Link w wiadomości prowadzi do aplikacji:
//     <adres aplikacji>?token_hash=…&type=… – aplikacja potwierdza go sama (verifyOtp, js/aplikacja.js).
//  2. Zaproszenie do projektu (współpraca): aplikacja woła funkcję tokenem zalogowanego właściciela,
//     POST { zaproszenie: <id> }. Dane wiadomości funkcja bierze z bazy tym tokenem
//     (public.dane_maila_zaproszenia – tylko właściciel, najwyżej raz na 10 minut na zaproszenie), a link
//     buduje sama – przez naszą pocztę nie da się wysłać obcego linku.
//
// Sekrety funkcji (Deno.env, nigdy w repozytorium): BREVO_API_KEY, SEND_EMAIL_HOOK_SECRET; opcjonalnie
// MAIL_FROM_EMAIL (domyślnie no-reply@makietka.app), MAIL_FROM_NAME (domyślnie Makietka), SITE_URL
// (domyślnie adres aplikacji ze stałej ADRES_APLIKACJI).

import { ADRES_APLIKACJI } from './seriodruk-mcp-rdzen.mjs';
import { DOMYSLNY_ADRES, DOMYSLNY_KLUCZ_PUBLICZNY } from './mcp-http.mjs';

const BREVO = 'https://api.brevo.com/v3/smtp/email';
const NADAWCA = 'no-reply@makietka.app';
const MARKA = 'Makietka';
const TOLERANCJA_S = 5 * 60; // podpis haka – dopuszczalna różnica zegarów

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400',
};
const json = (status, tresc, cors = false) => new Response(JSON.stringify(tresc), { status, headers: { ...(cors ? CORS : {}), 'content-type': 'application/json; charset=utf-8' } });
const html = (s) => String(s ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
const zSlashem = (u) => String(u).replace(/[?#].*$/, '').replace(/\/?$/, '/');

export const ustawienia = (env = {}) => ({
  marka: env.MAIL_FROM_NAME || MARKA,
  nadawca: env.MAIL_FROM_EMAIL || NADAWCA,
  strona: zSlashem(env.SITE_URL || ADRES_APLIKACJI),
});

// ---------- Wysyłka ----------

// { do, temat, html, tekst, odpowiedzDo? } → wysyła przez Brevo; rzuca błąd, gdy się nie da.
export async function wyslijMail({ do: adresat, temat, html: trescHtml, tekst, odpowiedzDo = null, tagi = [] }, env = {}, wyslij = fetch) {
  if (!env.BREVO_API_KEY) throw new Error('brak-klucza-brevo');
  const u = ustawienia(env);
  const odp = await wyslij(BREVO, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: u.nadawca, name: u.marka },
      to: [{ email: adresat }],
      ...(odpowiedzDo?.email ? { replyTo: odpowiedzDo } : {}),
      subject: temat,
      htmlContent: trescHtml,
      textContent: tekst,
      ...(tagi.length ? { tags: tagi } : {}),
    }),
  });
  if (!odp.ok) {
    const b = await odp.json().catch(() => ({}));
    throw new Error(`Poczta odrzuciła wiadomość (${odp.status}${b?.message ? `: ${b.message}` : ''}).`);
  }
}

// ---------- Szablon ----------

// Jeden prosty wygląd wszystkich wiadomości: nagłówek, akapit, przycisk, uwaga drobnym drukiem.
// { tytul, tresc, przycisk?, link?, kod?, uwaga } → { html, tekst }.
export function szablon({ tytul, tresc, przycisk = null, link = null, kod = null, uwaga = '' }, marka = MARKA) {
  const akapity = (Array.isArray(tresc) ? tresc : [tresc]).filter(Boolean);
  const htmlTresc = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${html(tytul)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f3ef;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1a1a1a">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px 26px">
<p style="margin:0 0 14px;font-size:13px;font-weight:600;letter-spacing:.02em;color:#2b5bd7">${html(marka)}</p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3">${html(tytul)}</h1>
${akapity.map((a) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${html(a)}</p>`).join('\n')}
${kod ? `<p style="margin:6px 0 20px;font-size:28px;font-weight:700;letter-spacing:.18em">${html(kod)}</p>` : ''}
${link && przycisk ? `<p style="margin:8px 0 24px"><a href="${html(link)}" style="display:inline-block;padding:12px 22px;border-radius:9px;background:#2b5bd7;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">${html(przycisk)}</a></p>
<p style="margin:0 0 14px;font-size:12.5px;line-height:1.5;color:#807d75">Jeśli przycisk nie działa, skopiuj adres do przeglądarki:<br><span style="word-break:break-all">${html(link)}</span></p>` : ''}
${uwaga ? `<p style="margin:0;font-size:12.5px;line-height:1.5;color:#807d75">${html(uwaga)}</p>` : ''}
</div>
<p style="max-width:520px;margin:14px auto 0;font-size:11.5px;color:#9a978f;text-align:center">Wiadomość wysłana automatycznie – nie odpowiadaj na nią.</p>
</body></html>`;
  const tekst = [
    tytul, '', ...akapity.flatMap((a) => [a, '']),
    ...(kod ? [kod, ''] : []),
    ...(link ? [`${przycisk || 'Link'}: ${link}`, ''] : []),
    ...(uwaga ? [uwaga] : []),
  ].join('\n').trim();
  return { html: htmlTresc, tekst };
}

// ---------- Hak Auth „Send Email” ----------

function zBase64(b64) {
  const s = atob(b64);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) b[i] = s.charCodeAt(i);
  return b;
}
const doBase64 = (bajty) => btoa(String.fromCharCode(...new Uint8Array(bajty)));

// Podpis standardwebhooks: HMAC-SHA256(sekret, `${id}.${czas}.${treść}`) w base64, nagłówek „v1,<podpis>”
// (może być kilka, oddzielonych spacją). Sekret z panelu Supabase: „v1,whsec_<base64>”.
export async function sprawdzPodpis(tresc, naglowki, sekret, teraz = Date.now()) {
  const id = naglowki.get('webhook-id');
  const czas = naglowki.get('webhook-timestamp');
  const podpisy = naglowki.get('webhook-signature');
  if (!sekret) throw new Error('brak-sekretu-haka');
  if (!id || !czas || !podpisy) throw new Error('brak-podpisu');
  const t = Number(czas);
  if (!Number.isFinite(t) || Math.abs(teraz / 1000 - t) > TOLERANCJA_S) throw new Error('podpis-przeterminowany');
  const klucz = await crypto.subtle.importKey('raw', zBase64(String(sekret).replace(/^v1,/, '').replace(/^whsec_/, '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const oczekiwany = doBase64(await crypto.subtle.sign('HMAC', klucz, new TextEncoder().encode(`${id}.${czas}.${tresc}`)));
  const pasuje = podpisy.split(' ').some((p) => {
    const [wersja, wartosc] = p.split(',');
    if (wersja !== 'v1' || !wartosc || wartosc.length !== oczekiwany.length) return false;
    let r = 0;
    for (let i = 0; i < wartosc.length; i += 1) r |= wartosc.charCodeAt(i) ^ oczekiwany.charCodeAt(i);
    return r === 0;
  });
  if (!pasuje) throw new Error('zly-podpis');
  return JSON.parse(tresc);
}

// Adres aplikacji dla linku: redirect_to z żądania (aplikacja podaje swój adres), ale tylko na naszą stronę –
// inaczej adres ze stałej (SITE_URL). Supabase Auth i tak sprawdza redirect_to z listą; to druga zapora.
function adresPowrotu(payload, u) {
  const dozwolone = new Set([new URL(u.strona).origin, new URL(ADRES_APLIKACJI).origin]);
  try {
    const r = new URL(String(payload.email_data?.redirect_to || ''));
    if (dozwolone.has(r.origin)) return zSlashem(`${r.origin}${r.pathname}`);
  } catch { /* zły albo pusty adres – zostaje strona ze stałej */ }
  return u.strona;
}

const linkAuth = (baza, tokenHash, typ) => {
  if (!tokenHash) throw new Error(`brak token_hash dla ${typ}`);
  return `${baza}?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(typ)}`;
};

// Wiadomości dla jednego wywołania haka: [{ do, temat, html, tekst }].
export function maileAuth(payload, env = {}) {
  const u = ustawienia(env);
  const baza = adresPowrotu(payload, u);
  const typ = payload.email_data?.email_action_type || '';
  const d = payload.email_data || {};
  const adres = String(payload.user?.email || '').trim();
  const nowy = String(payload.user?.new_email || payload.user?.email_new || d.new_email || '').trim();
  const zignoruj = 'Jeśli to nie Ty, po prostu zignoruj tę wiadomość – nic się nie zmieni.';
  const mail = (doKogo, temat, tresc) => ({ do: doKogo, temat, ...szablon({ ...tresc, uwaga: tresc.uwaga ?? zignoruj }, u.marka) });

  if (typ === 'signup') {
    return [mail(adres, `${u.marka} – potwierdź konto`, {
      tytul: 'Potwierdź swoje konto', tresc: `Dziękujemy za założenie konta w aplikacji ${u.marka}. Kliknij przycisk, żeby potwierdzić adres e-mail i zacząć pracę.`,
      przycisk: 'Potwierdź konto', link: linkAuth(baza, d.token_hash, 'signup'),
    })];
  }
  if (typ === 'recovery') {
    return [mail(adres, `${u.marka} – ustaw nowe hasło`, {
      tytul: 'Ustaw nowe hasło', tresc: 'Ktoś (mamy nadzieję, że Ty) poprosił o zmianę hasła do konta. Kliknij przycisk i wpisz nowe hasło. Link działa przez godzinę i tylko raz.',
      przycisk: 'Ustaw nowe hasło', link: linkAuth(baza, d.token_hash, 'recovery'),
    })];
  }
  if (typ === 'magiclink') {
    return [mail(adres, `${u.marka} – link do logowania`, {
      tytul: 'Zaloguj się jednym kliknięciem', tresc: 'Kliknij przycisk, żeby się zalogować. Link działa przez godzinę i tylko raz.',
      przycisk: 'Zaloguj się', link: linkAuth(baza, d.token_hash, 'magiclink'),
    })];
  }
  if (typ === 'invite') {
    return [mail(adres, `${u.marka} – zaproszenie do aplikacji`, {
      tytul: `Zaproszenie do aplikacji ${u.marka}`, tresc: 'Masz zaproszenie do aplikacji. Kliknij przycisk, żeby przyjąć je i ustawić hasło.',
      przycisk: 'Przyjmij zaproszenie', link: linkAuth(baza, d.token_hash, 'invite'),
    })];
  }
  if (typ === 'email_change' || typ === 'email_change_current' || typ === 'email_change_new') {
    // Dwa tokeny – „bezpieczna zmiana”: potwierdza stary i nowy adres. Jeden – tylko nowy adres; link nie może
    // trafić na stary, bo kliknięcie tam zatwierdziłoby zmianę bez sprawdzenia nowej skrzynki.
    const oba = Boolean(d.token_hash && d.token_hash_new);
    const wynik = [];
    const tresc = (doKogo) => ({
      tytul: 'Potwierdź zmianę adresu e-mail',
      tresc: `Ktoś poprosił o zmianę adresu konta${nowy ? ` na ${nowy}` : ''}. Kliknij przycisk, żeby potwierdzić${doKogo === 'stary' ? ' z dotychczasowego adresu' : ' nowy adres'}.`,
      przycisk: 'Potwierdź zmianę',
    });
    if (oba && adres) wynik.push(mail(adres, `${u.marka} – potwierdź zmianę adresu`, { ...tresc('stary'), link: linkAuth(baza, d.token_hash, 'email_change') }));
    const naNowy = d.token_hash_new || d.token_hash;
    if (nowy && naNowy && nowy.toLowerCase() !== adres.toLowerCase()) {
      wynik.push(mail(nowy, `${u.marka} – potwierdź nowy adres e-mail`, { ...tresc('nowy'), link: linkAuth(baza, naNowy, 'email_change') }));
    }
    // Bez bezpiecznej zmiany stary adres dostaje samo powiadomienie (na wypadek przejętej sesji).
    if (!oba && adres && nowy && nowy.toLowerCase() !== adres.toLowerCase()) {
      wynik.push(mail(adres, `${u.marka} – zmiana adresu e-mail`, {
        tytul: 'Zmiana adresu e-mail', tresc: `Ktoś poprosił o zmianę adresu Twojego konta na ${nowy}. Jeśli to nie Ty, zaloguj się i zmień hasło.`,
        przycisk: 'Otwórz aplikację', link: baza, uwaga: '',
      }));
    }
    return wynik;
  }
  if (typ === 'reauthentication') {
    return [mail(adres, `${u.marka} – kod potwierdzenia`, {
      tytul: 'Kod potwierdzenia', tresc: 'Wpisz ten kod w aplikacji, żeby potwierdzić zmianę.', kod: d.token,
    })];
  }
  if (typ === 'password_changed_notification') {
    return [mail(adres, `${u.marka} – hasło zostało zmienione`, {
      tytul: 'Hasło zostało zmienione', tresc: 'Hasło do Twojego konta właśnie się zmieniło. Jeśli to nie Ty, od razu ustaw nowe hasło („Nie pamiętam hasła” na ekranie logowania).',
      przycisk: 'Otwórz aplikację', link: baza, uwaga: '',
    })];
  }
  if (typ === 'email_changed_notification') {
    return [mail(adres, `${u.marka} – adres e-mail został zmieniony`, {
      tytul: 'Adres e-mail został zmieniony', tresc: `Adres Twojego konta został zmieniony${nowy ? ` na ${nowy}` : ''}. Jeśli to nie Ty, skontaktuj się z nami.`, uwaga: '',
    })];
  }
  // Inne rodzaje (nowe w Supabase Auth): link potwierdzający tego samego rodzaju.
  return [mail(adres, `${u.marka} – potwierdź`, {
    tytul: 'Potwierdź w aplikacji', tresc: 'Kliknij przycisk, żeby potwierdzić.', przycisk: 'Potwierdź', link: linkAuth(baza, d.token_hash, typ || 'email'),
  })];
}

// Odpowiedź haka: 200 {} – wysłane; błąd – kod i komunikat, który Auth pokaże zamiast wysyłki.
const bladHaka = (status, wiadomosc) => json(status, { error: { http_code: status, message: wiadomosc } });

async function obsluzHak(request, env, wyslij) {
  const tresc = await request.text();
  let payload;
  try {
    payload = await sprawdzPodpis(tresc, request.headers, env.SEND_EMAIL_HOOK_SECRET);
  } catch (e) {
    return bladHaka(401, `Nieprawidłowy podpis haka (${e.message}).`);
  }
  if (!env.BREVO_API_KEY) return bladHaka(500, 'Poczta nie jest skonfigurowana (brak BREVO_API_KEY).');
  try {
    for (const m of maileAuth(payload, env)) await wyslijMail({ ...m, tagi: ['konto'] }, env, wyslij);
  } catch (e) {
    return bladHaka(500, e.message);
  }
  return json(200, {});
}

// ---------- Zaproszenie do projektu ----------

const ROLE = { edycja: 'możesz edytować projekt razem z innymi, na żywo', odczyt: 'możesz oglądać projekt' };

export function mailZaproszenia({ projekt, od, rola, link, wazneDo }, env = {}) {
  const u = ustawienia(env);
  const data = wazneDo ? new Date(wazneDo).toLocaleDateString('pl-PL') : null;
  return {
    temat: `${od} zaprasza Cię do projektu „${projekt}”`,
    ...szablon({
      tytul: `${od} zaprasza Cię do projektu „${projekt}”`,
      tresc: [`Wspólna praca nad projektem w aplikacji ${u.marka} – ${ROLE[rola] || rola}.`, 'Otwórz zaproszenie, zaloguj się albo załóż konto – projekt pojawi się na Twojej liście.'],
      przycisk: 'Otwórz zaproszenie',
      link,
      uwaga: `Link działa jeden raz${data ? ` i jest ważny do ${data}` : ''}. Jeśli nie spodziewasz się tego zaproszenia, po prostu je zignoruj.`,
    }, u.marka),
  };
}

async function obsluzZaproszenie(request, env, wyslij) {
  const autoryzacja = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(autoryzacja)) return json(401, { blad: 'Zaloguj się.' }, true);
  let id;
  try { ({ zaproszenie: id } = await request.json()); } catch { /* niżej */ }
  if (!id || typeof id !== 'string') return json(400, { blad: 'Brak identyfikatora zaproszenia.' }, true);

  const adresBazy = (env.SUPABASE_URL || DOMYSLNY_ADRES).replace(/\/+$/, '');
  const odp = await wyslij(`${adresBazy}/rest/v1/rpc/dane_maila_zaproszenia`, {
    method: 'POST',
    headers: { apikey: env.KLUCZ_PUBLICZNY || DOMYSLNY_KLUCZ_PUBLICZNY, authorization: autoryzacja, 'content-type': 'application/json' },
    body: JSON.stringify({ p_id: id }),
  });
  const dane = await odp.json().catch(() => ({}));
  if (!odp.ok) return json(odp.status === 401 ? 401 : 400, { blad: dane?.message || 'Nie można wysłać tego zaproszenia.' }, true);
  if (!env.BREVO_API_KEY) return json(200, { wyslano: false, powod: 'brak-konfiguracji' }, true);

  const link = `${ustawienia(env).strona}#/zaproszenie/${encodeURIComponent(dane.kod)}`;
  const m = mailZaproszenia({ projekt: dane.projekt, od: dane.od, rola: dane.rola, link, wazneDo: dane.wazne_do }, env);
  try {
    await wyslijMail({ do: dane.email, ...m, odpowiedzDo: dane.od_email ? { email: dane.od_email, name: dane.od } : null, tagi: ['zaproszenie'] }, env, wyslij);
  } catch (e) {
    return json(502, { wyslano: false, powod: 'blad-wysylki', blad: e.message }, true);
  }
  // Bez adresu w odpowiedzi: przy zaproszeniu po nazwie użytkownika zapraszający go nie zna (#100).
  return json(200, { wyslano: true }, true);
}

// ---------- Wejście funkcji ----------

export async function obsluzPoczte(request, env = {}, wyslij = fetch) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json(405, { blad: 'Tylko POST.' }, true);
  // Hak Auth ma podpis standardwebhooks; aplikacja – token zalogowanej osoby.
  if (request.headers.get('webhook-signature')) return obsluzHak(request, env, wyslij);
  return obsluzZaproszenie(request, env, wyslij);
}
