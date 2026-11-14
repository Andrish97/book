// Poczta aplikacji (decyzja #86, dostawcy #105): wszystkie e-maile idą przez API ZeptoMail (Zoho) albo Brevo z Funkcji Edge `poczta`
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
// Dostawcy (#105): Brevo pierwszy, ZeptoMail (Zoho) zapasowy – tylko gdy włączony; kolejność, włączenie i dzienne limity w tabeli
// poczta_dostawcy (panel administratora). Gdy dostawca odmówi (np. Brevo blokuje nieznane IP), wiadomość idzie
// przez następnego. Dostawca bez sekretu jest pomijany.
// Sekrety funkcji (Deno.env, nigdy w repozytorium): ZEPTOMAIL_API_KEY (+ ZEPTOMAIL_REGION eu|com|in, domyślnie eu;
// opcjonalnie ZEPTOMAIL_BOUNCE_ADDRESS), BREVO_API_KEY, SEND_EMAIL_HOOK_SECRET; opcjonalnie
// MAIL_FROM_EMAIL (domyślnie no-reply@makietka.app), MAIL_FROM_NAME (domyślnie Makietka), SITE_URL
// (domyślnie adres aplikacji ze stałej ADRES_APLIKACJI).

import { ADRES_APLIKACJI } from './seriodruk-mcp-rdzen.mjs';
import { DOMYSLNY_ADRES, DOMYSLNY_KLUCZ_PUBLICZNY } from './mcp-http.mjs';

const BREVO = 'https://api.brevo.com/v3/smtp/email';
const ZEPTO_HOST = { eu: 'api.zeptomail.eu', com: 'api.zeptomail.com', in: 'api.zeptomail.in' };
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

// ---------- Dostawcy ----------

const NAGLOWKI_WATKU = ['In-Reply-To', 'References'];
const zeptoKlucz = (env) => String(env.ZEPTOMAIL_API_KEY || '').trim().replace(/^Zoho-enczapikey\s+/i, '');

async function wyslijBrevo(m, env, wyslij) {
  const odp = await wyslij(BREVO, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: m.nadawca,
      to: [m.doNazwa ? { email: m.do, name: m.doNazwa } : { email: m.do }],
      ...(Object.keys(m.naglowki).length ? { headers: m.naglowki } : {}),
      ...(m.odpowiedzDo?.email ? { replyTo: m.odpowiedzDo } : {}),
      subject: m.temat,
      htmlContent: m.html,
      textContent: m.tekst,
      ...(m.tagi.length ? { tags: m.tagi } : {}),
    }),
  });
  const b = await odp.json().catch(() => ({}));
  if (!odp.ok) throw new Error(`Brevo odrzuciło wiadomość (${odp.status}${b?.message ? `: ${b.message}` : ''}).`);
  return b?.messageId || null;
}

// ZeptoMail (Zoho) – https://www.zoho.com/zeptomail/help/api/email-sending.html; region konta: eu (zoho.eu), com, in.
async function wyslijZepto(m, env, wyslij) {
  const region = String(env.ZEPTOMAIL_REGION || 'eu').trim().toLowerCase();
  const host = ZEPTO_HOST[region] || ZEPTO_HOST.eu;
  const odp = await wyslij(`https://${host}/v1.1/email`, {
    method: 'POST',
    headers: { authorization: `Zoho-enczapikey ${zeptoKlucz(env)}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      from: { address: m.nadawca.email, name: m.nadawca.name },
      to: [{ email_address: { address: m.do, name: m.doNazwa || '' } }],
      ...(m.odpowiedzDo?.email ? { reply_to: [{ address: m.odpowiedzDo.email, name: m.odpowiedzDo.name || '' }] } : {}),
      subject: m.temat,
      htmlbody: m.html,
      textbody: m.tekst,
      ...(Object.keys(m.naglowki).length ? { mime_headers: m.naglowki } : {}),
      ...(env.ZEPTOMAIL_BOUNCE_ADDRESS ? { bounce_address: env.ZEPTOMAIL_BOUNCE_ADDRESS } : {}),
      ...(m.tagi.length ? { client_reference: m.tagi.join(',').slice(0, 100) } : {}),
    }),
  });
  const b = await odp.json().catch(() => ({}));
  if (!odp.ok) {
    const opis = b?.error?.details?.[0]?.message || b?.error?.message || b?.message || '';
    throw new Error(`ZeptoMail odrzucił wiadomość (${odp.status}${opis ? `: ${opis}` : ''}).`);
  }
  return b?.request_id || b?.data?.[0]?.additional_info?.[0]?.message_id || null;
}

export const DOSTAWCY = {
  zeptomail: { nazwa: 'ZeptoMail', gotowy: (env) => Boolean(zeptoKlucz(env)), wyslij: wyslijZepto },
  brevo: { nazwa: 'Brevo', gotowy: (env) => Boolean(env.BREVO_API_KEY), wyslij: wyslijBrevo },
};
// Bez listy z bazy (np. baza niedostępna przy haku Auth) – tylko Brevo: ZeptoMail wchodzi do kolejki wyłącznie
// wtedy, gdy jest włączony w poczta_dostawcy.
export const DOMYSLNA_KOLEJNOSC = ['brevo'];
// Którzy dostawcy mają sekret (bez wartości) – dla panelu administratora.
export const stanDostawcow = (env = {}) => Object.fromEntries(Object.entries(DOSTAWCY).map(([id, d]) => [id, d.gotowy(env)]));
const gotowi = (lista, env) => (lista || DOMYSLNA_KOLEJNOSC).filter((id) => DOSTAWCY[id]?.gotowy(env));
// Czy jakikolwiek dostawca ma sekret (kolejność i włączenie rozstrzyga potem baza).
const ktokolwiek = (env) => gotowi(Object.keys(DOSTAWCY), env).length > 0;

// { do, doNazwa?, temat, html, tekst, odpowiedzDo?, nadawca?, naglowki?, tagi? } → próbuje dostawców po kolei
// (lista identyfikatorów z bazy; bez niej – DOMYSLNA_KOLEJNOSC) i zwraca { messageId, dostawca }; gdy wszyscy
// odmówią – błąd z powodami każdego.
export async function wyslijPrzez({ do: adresat, doNazwa = null, temat, html: trescHtml, tekst, odpowiedzDo = null, tagi = [], nadawca = null, naglowki = null }, env = {}, wyslij = fetch, dostawcy = null) {
  const kolejka = gotowi(dostawcy, env);
  if (!kolejka.length) throw new Error('brak-dostawcy');
  const u = ustawienia(env);
  const m = {
    do: adresat, doNazwa, temat, html: trescHtml, tekst, odpowiedzDo, tagi,
    nadawca: nadawca?.email ? { email: nadawca.email, name: nadawca.name || u.marka } : { email: u.nadawca, name: u.marka },
    naglowki: Object.fromEntries(Object.entries(naglowki || {}).filter(([k, v]) => NAGLOWKI_WATKU.includes(k) && v)),
  };
  const bledy = [];
  for (const id of kolejka) {
    try {
      return { messageId: await DOSTAWCY[id].wyslij(m, env, wyslij), dostawca: id };
    } catch (e) {
      bledy.push(e.message);
    }
  }
  throw new Error(bledy.join(' '));
}

// Zgodność z wcześniejszym wywołaniem: zwraca sam Message-ID.
export async function wyslijMail(mail, env = {}, wyslij = fetch, dostawcy = null) {
  return (await wyslijPrzez(mail, env, wyslij, dostawcy)).messageId;
}

// ---------- Szablon ----------

// Jeden prosty wygląd wszystkich wiadomości: nagłówek, akapit, przycisk, uwaga drobnym drukiem.
// { tytul, tresc, przycisk?, link?, kod?, uwaga } → { html, tekst }.
const STOPKA_AUTOMATYCZNA = 'Wiadomość wysłana automatycznie – nie odpowiadaj na nią.';
export function szablon({ tytul, tresc, przycisk = null, link = null, kod = null, uwaga = '', cytat = '', stopka = STOPKA_AUTOMATYCZNA }, marka = MARKA) {
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
${cytat ? `<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid #d9d6cd;background:#f7f6f2;border-radius:6px;font-size:14px;line-height:1.5;color:#55524b;white-space:pre-wrap">${html(cytat)}</blockquote>` : ''}
${uwaga ? `<p style="margin:0;font-size:12.5px;line-height:1.5;color:#807d75">${html(uwaga)}</p>` : ''}
</div>
${stopka ? `<p style="max-width:520px;margin:14px auto 0;font-size:11.5px;color:#9a978f;text-align:center">${html(stopka)}</p>` : ''}
</body></html>`;
  const tekst = [
    tytul, '', ...akapity.flatMap((a) => [a, '']),
    ...(kod ? [kod, ''] : []),
    ...(link ? [`${przycisk || 'Link'}: ${link}`, ''] : []),
    ...(cytat ? [cytat.split('\n').map((l) => `> ${l}`).join('\n'), ''] : []),
    ...(uwaga ? [uwaga, ''] : []),
    ...(stopka ? [stopka] : []),
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
  if (!ktokolwiek(env)) return bladHaka(500, 'Poczta nie jest skonfigurowana (brak ZEPTOMAIL_API_KEY i BREVO_API_KEY).');
  // Kolejność i dzienne limity dostawców z bazy (kluczem serwisowym); bez bazy – tylko Brevo.
  const klucz = kluczSerwisowy(env);
  let kolejnosc = null;
  if (klucz) kolejnosc = await rpcBazy(env, wyslij, 'poczta_dostawcy_kolejnosc', {}, naglowkiKlucza(klucz)).catch(() => null);
  const lista = Array.isArray(kolejnosc) ? kolejnosc.filter((d) => d.zostalo > 0).map((d) => d.id) : null;
  try {
    for (const m of maileAuth(payload, env)) {
      const w = await wyslijPrzez({ ...m, tagi: ['konto'] }, env, wyslij, lista);
      if (klucz) await rpcBazy(env, wyslij, 'poczta_dostawca_wyslano', { p_id: w.dostawca }, naglowkiKlucza(klucz)).catch(() => {});
    }
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

// Odpowiedź z panelu (skrzynka kontakt@): zwykły list – akapity, podpis, cytat poprzedniej wiadomości.
export function listOdpowiedzi({ tresc, cytat = '', kiedy = null }, env = {}) {
  const u = ustawienia(env);
  const akapity = String(tresc || '').split(/\n{2,}/).map((a) => a.trim()).filter(Boolean);
  const data = kiedy ? new Date(kiedy).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Warsaw' }) : null;
  const adresStrony = u.strona.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const htmlTresc = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:18px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55">
${akapity.map((a) => `<p style="margin:0 0 12px;white-space:pre-wrap">${html(a)}</p>`).join('\n')}
<p style="margin:18px 0 0;color:#55524b">— ${html(u.marka)}<br><a href="${html(u.strona)}" style="color:#2b5bd7">${html(adresStrony)}</a></p>
${cytat ? `<p style="margin:22px 0 6px;font-size:12.5px;color:#807d75">${data ? `${html(data)} napisałeś(-aś):` : 'Twoja wiadomość:'}</p>
<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #d9d6cd;color:#55524b;font-size:14px;white-space:pre-wrap">${html(cytat)}</blockquote>` : ''}
</body></html>`;
  const tekst = [
    ...akapity.flatMap((a) => [a, '']), `— ${u.marka}`, u.strona,
    ...(cytat ? ['', data ? `${data} napisałeś(-aś):` : 'Twoja wiadomość:', cytat.split('\n').map((l) => `> ${l}`).join('\n')] : []),
  ].join('\n');
  return { html: htmlTresc, tekst };
}

// Treść maila z kolejki: szablon + dane (wiersz z poczta_kolejka_pobierz). → { temat, html, tekst }.
export function trescZKolejki(w, env = {}) {
  const u = ustawienia(env);
  const d = w.dane || {};
  if (w.szablon === 'zaproszenie') {
    const link = `${u.strona}#/zaproszenie/${encodeURIComponent(d.kod)}`;
    return mailZaproszenia({ projekt: d.projekt, od: d.od, rola: d.rola, link, wazneDo: d.wazne_do }, env);
  }
  if (w.szablon === 'kontakt') {
    return {
      temat: `${u.marka} – dostaliśmy Twoją wiadomość${d.temat ? `: ${d.temat}` : ''}`,
      ...szablon({
        tytul: 'Dostaliśmy Twoją wiadomość',
        tresc: ['Dziękujemy za wiadomość. Odpowiemy najszybciej, jak się da – zwykle w ciągu kilku dni.', ...(d.temat ? [`Temat: ${d.temat}`] : [])],
        cytat: d.tresc || '',
        uwaga: 'Jeśli chcesz coś dopisać, po prostu odpowiedz na tę wiadomość – trafi do nas.',
        stopka: '',
      }, u.marka),
    };
  }
  if (w.szablon === 'odpowiedz') return { temat: w.temat || `${u.marka} – odpowiedź`, ...listOdpowiedzi(d, env) };
  if (w.szablon === 'test') {
    const kiedy = new Date(d.kiedy || Date.now()).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    return {
      temat: `${u.marka} – test poczty`,
      ...szablon({ tytul: 'Poczta działa', tresc: `To wiadomość testowa z panelu administratora (${kiedy}). Skoro ją czytasz, wysyłka przez kolejkę działa.` }, u.marka),
    };
  }
  throw new Error(`nieznany szablon: ${w.szablon}`);
}

// ---------- Kolejka (decyzja #95) ----------

// Klucz serwisowy środowiska funkcji (Supabase daje go funkcjom sam – nie ma go w repozytorium).
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
  if (!odp.ok) {
    const e = new Error(tresc?.message || `Baza odpowiedziała błędem ${odp.status}.`);
    e.status = odp.status;
    throw e;
  }
  return tresc;
}

// Jeden przebieg kolejki: pobiera maile, którym wolno już wyjść (limity dostawcy, odstępy na adresata – liczy baza),
// wysyła je po kolei z odstępem z ustawień i zapisuje wynik. → { wyslane: [id], bledy: [{ id, blad }], powod }.
export async function przetworzKolejke(env = {}, wyslij = fetch, { czekaj = (ms) => new Promise((ok) => { setTimeout(ok, ms); }) } = {}) {
  const klucz = kluczSerwisowy(env);
  if (!klucz) return { wyslane: [], bledy: [], powod: 'brak-klucza-serwisowego' };
  if (!ktokolwiek(env)) return { wyslane: [], bledy: [], powod: 'brak-konfiguracji' };
  const naglowki = naglowkiKlucza(klucz);
  const partia = await rpcBazy(env, wyslij, 'poczta_kolejka_pobierz', {}, naglowki);
  const wynik = { wyslane: [], bledy: [], powod: partia?.powod || null };
  const lista = partia?.wiadomosci || [];
  // Dostawcy z bazy w kolejności priorytetu, z tym, co zostało z dziennego limitu – ubywa przy każdej wysyłce.
  const zostalo = new Map((partia?.dostawcy || []).map((d) => [d.id, d.zostalo]));
  for (let i = 0; i < lista.length; i += 1) {
    const w = lista[i];
    if (i > 0 && partia.odstep_ms) await czekaj(partia.odstep_ms);
    try {
      const m = trescZKolejki(w, env);
      // Test z panelu dla jednego dostawcy – tylko on; inaczej wszyscy z limitem, po kolei.
      const kolejnosc = w.dane?.dostawca ? [w.dane.dostawca] : [...zostalo].filter(([, n]) => n > 0).map(([id]) => id);
      const wynikWysylki = await wyslijPrzez({
        do: w.do_email, doNazwa: w.do_nazwa, temat: m.temat, html: m.html, tekst: m.tekst, odpowiedzDo: w.odpowiedz_do,
        naglowki: w.naglowki, nadawca: w.od_skrzynki ? partia.skrzynka : partia.nadawca, tagi: [w.rodzaj],
      }, env, wyslij, partia?.dostawcy ? kolejnosc : null);
      if (zostalo.has(wynikWysylki.dostawca)) zostalo.set(wynikWysylki.dostawca, zostalo.get(wynikWysylki.dostawca) - 1);
      await rpcBazy(env, wyslij, 'poczta_kolejka_wynik', {
        p_id: w.id, p_ok: true, p_blad: null, p_message_id: wynikWysylki.messageId, p_dostawca: wynikWysylki.dostawca,
      }, naglowki);
      wynik.wyslane.push(w.id);
    } catch (e) {
      await rpcBazy(env, wyslij, 'poczta_kolejka_wynik', { p_id: w.id, p_ok: false, p_blad: e.message, p_message_id: null, p_dostawca: null }, naglowki).catch(() => {});
      wynik.bledy.push({ id: w.id, blad: e.message });
    }
  }
  return wynik;
}

// Zaproszenie do projektu: do kolejki (limity i odstępy liczy baza – poczta_zaplanuj_zaproszenie, tokenem
// zapraszającego), potem od razu przebieg kolejki – zwykle mail wychodzi w tej samej chwili.
async function obsluzZaproszenie(request, id, env, wyslij) {
  const autoryzacja = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(autoryzacja)) return json(401, { blad: 'Zaloguj się.' }, true);
  if (!id || typeof id !== 'string') return json(400, { blad: 'Brak identyfikatora zaproszenia.' }, true);
  let plan;
  try {
    plan = await rpcBazy(env, wyslij, 'poczta_zaplanuj_zaproszenie', { p_id: id }, { apikey: DOMYSLNY_KLUCZ_PUBLICZNY, authorization: autoryzacja });
  } catch (e) {
    return json(e.status === 401 ? 401 : 400, { blad: e.message || 'Nie można wysłać tego zaproszenia.' }, true);
  }
  // Bez adresu w odpowiedzi: przy zaproszeniu po nazwie użytkownika zapraszający go nie zna (#100).
  if (plan?.blad === 'za-czesto') return json(200, { wyslano: false, powod: 'za-czesto', za: plan.za, za_sekund: plan.za_sekund }, true);
  if (!ktokolwiek(env)) return json(200, { wyslano: false, powod: 'brak-konfiguracji' }, true);
  const przebieg = await przetworzKolejke(env, wyslij).catch((e) => ({ wyslane: [], bledy: [{ id: plan.id, blad: e.message }] }));
  if (przebieg.wyslane.includes(plan.id)) return json(200, { wyslano: true }, true);
  const blad = przebieg.bledy.find((b) => b.id === plan.id)?.blad;
  return json(200, { wyslano: false, powod: blad ? 'blad-wysylki' : 'w-kolejce', ...(blad ? { blad } : {}) }, true);
}

// ---------- Wejście funkcji ----------

export async function obsluzPoczte(request, env = {}, wyslij = fetch) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json(405, { blad: 'Tylko POST.' }, true);
  // Hak Auth ma podpis standardwebhooks; aplikacja – token zalogowanej osoby; Cron Workera – { kolejka: true }.
  if (request.headers.get('webhook-signature')) return obsluzHak(request, env, wyslij);
  let tresc = {};
  try { tresc = await request.json(); } catch { /* pusta treść – niżej */ }
  // Przebieg kolejki może zlecić każdy (Cron Workera co minutę, aplikacja po dodaniu maila): kolejka sama pilnuje
  // limitów i odstępów, a tędy nie da się do niej niczego dopisać.
  // Panel administratora: którzy dostawcy mają sekret (tak/nie, bez wartości) – tylko dla administratora.
  if (tresc?.stan_dostawcow) {
    const autoryzacja = request.headers.get('authorization') || '';
    const admin = await rpcBazy(env, wyslij, 'czy_administrator', {}, { apikey: DOMYSLNY_KLUCZ_PUBLICZNY, authorization: autoryzacja }).catch(() => false);
    if (admin !== true) return json(403, { blad: 'Tylko dla administratora.' }, true);
    return json(200, { dostawcy: stanDostawcow(env), region_zeptomail: String(env.ZEPTOMAIL_REGION || 'eu').toLowerCase() }, true);
  }
  if (tresc?.kolejka) {
    try {
      const w = await przetworzKolejke(env, wyslij);
      return json(200, { wyslane: w.wyslane.length, bledy: w.bledy.length, powod: w.powod }, true);
    } catch (e) {
      return json(500, { blad: e.message }, true);
    }
  }
  return obsluzZaproszenie(request, tresc?.zaproszenie, env, wyslij);
}
