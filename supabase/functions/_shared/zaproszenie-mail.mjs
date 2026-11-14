// E-mail z zaproszeniem do projektu (współpraca, decyzja #86) – logika Funkcji Edge zaproszenie-mail.
// Wspólna dla Deno (supabase/functions/zaproszenie-mail/index.ts) i testów w Node (tests/zaproszenie-mail.test.cjs).
//
// Aplikacja woła funkcję tokenem zalogowanego właściciela: POST { id } (id zaproszenia). Funkcja pyta bazę
// tym tokenem o dane wiadomości (public.dane_maila_zaproszenia – tylko właściciel, najwyżej raz na 10 minut
// na zaproszenie) i wysyła wiadomość przez API Brevo. Klucz Brevo jest sekretem funkcji (BREVO_API_KEY),
// nigdy w repozytorium. Bez klucza funkcja odpowiada { wyslano: false, powod: 'brak-konfiguracji' } –
// zaproszenie i tak czeka w aplikacji, a link można skopiować albo wysłać ze swojej poczty.
//
// Link w wiadomości buduje funkcja (adres aplikacji ze stałej albo ze zmiennej ADRES_APLIKACJI), nie aplikacja –
// przez naszą skrzynkę nie da się więc wysłać obcego linku.

import { ADRES_APLIKACJI } from './seriodruk-mcp-rdzen.mjs';
import { DOMYSLNY_ADRES, DOMYSLNY_KLUCZ_PUBLICZNY } from './mcp-http.mjs';
const BREVO = 'https://api.brevo.com/v3/smtp/email';
const ROLE = { edycja: 'możesz edytować projekt razem z innymi, na żywo', odczyt: 'możesz oglądać projekt' };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400',
};

const json = (status, tresc) => new Response(JSON.stringify(tresc), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } });

const html = (s) => String(s ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));

// Treść wiadomości: { temat, tekst, html }.
export function trescZaproszenia({ projekt, od, rola, link, wazneDo, marka }) {
  const temat = `${od} zaprasza Cię do projektu „${projekt}”`;
  const data = wazneDo ? new Date(wazneDo).toLocaleDateString('pl-PL') : null;
  const tekst = [
    'Cześć!',
    '',
    `${od} zaprasza Cię do wspólnej pracy nad projektem „${projekt}” w aplikacji ${marka} – ${ROLE[rola] || rola}.`,
    '',
    'Otwórz link, zaloguj się albo załóż konto – projekt pojawi się na Twojej liście:',
    link,
    '',
    `Link działa jeden raz${data ? ` i jest ważny do ${data}` : ''}. Jeśli nie spodziewasz się tego zaproszenia, po prostu je zignoruj.`,
  ].join('\n');
  const tresc = `<!doctype html><html lang="pl"><body style="margin:0;padding:24px;background:#f4f3ef;font-family:Inter,Arial,sans-serif;color:#1a1a1a">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<p style="margin:0 0 6px;font-size:13px;color:#807d75">${html(marka)}</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${html(od)} zaprasza Cię do projektu „${html(projekt)}”</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">Wspólna praca nad projektem – ${html(ROLE[rola] || rola)}. Otwórz zaproszenie, zaloguj się albo załóż konto, a projekt pojawi się na Twojej liście.</p>
<p style="margin:0 0 24px"><a href="${html(link)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#2b5bd7;color:#fff;text-decoration:none;font-weight:600">Otwórz zaproszenie</a></p>
<p style="margin:0;font-size:12.5px;line-height:1.5;color:#807d75">Link działa jeden raz${data ? ` i jest ważny do ${html(data)}` : ''}. Jeśli przycisk nie działa, skopiuj adres: <br><span style="word-break:break-all">${html(link)}</span><br>Jeśli nie spodziewasz się tego zaproszenia, po prostu je zignoruj.</p>
</div></body></html>`;
  return { temat, tekst, html: tresc };
}

// env: { BREVO_API_KEY?, ADRES_APLIKACJI?, SUPABASE_URL?, KLUCZ_PUBLICZNY?, NADAWCA?, NAZWA_NADAWCY? }
export async function obsluzZaproszenieMail(request, env = {}, wyslij = fetch) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json(405, { blad: 'Tylko POST.' });
  const autoryzacja = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(autoryzacja)) return json(401, { blad: 'Zaloguj się.' });
  let id;
  try { ({ id } = await request.json()); } catch { /* niżej */ }
  if (!id || typeof id !== 'string') return json(400, { blad: 'Brak identyfikatora zaproszenia.' });

  const adresBazy = (env.SUPABASE_URL || DOMYSLNY_ADRES).replace(/\/+$/, '');
  const klucz = env.KLUCZ_PUBLICZNY || DOMYSLNY_KLUCZ_PUBLICZNY;
  const odp = await wyslij(`${adresBazy}/rest/v1/rpc/dane_maila_zaproszenia`, {
    method: 'POST',
    headers: { apikey: klucz, authorization: autoryzacja, 'content-type': 'application/json' },
    body: JSON.stringify({ p_id: id }),
  });
  const dane = await odp.json().catch(() => ({}));
  if (!odp.ok) return json(odp.status === 401 ? 401 : 400, { blad: dane?.message || 'Nie można wysłać tego zaproszenia.' });

  if (!env.BREVO_API_KEY) return json(200, { wyslano: false, powod: 'brak-konfiguracji' });
  const marka = env.NAZWA_NADAWCY || 'Makietka';
  const adresAplikacji = (env.ADRES_APLIKACJI || ADRES_APLIKACJI).replace(/\/?$/, '/');
  const link = `${adresAplikacji}#/zaproszenie/${encodeURIComponent(dane.kod)}`;
  const t = trescZaproszenia({ projekt: dane.projekt, od: dane.od, rola: dane.rola, link, wazneDo: dane.wazne_do, marka });
  const brevo = await wyslij(BREVO, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: env.NADAWCA || 'no-reply@makietka.app', name: marka },
      to: [{ email: dane.email }],
      ...(dane.od_email ? { replyTo: { email: dane.od_email, name: dane.od } } : {}),
      subject: t.temat,
      htmlContent: t.html,
      textContent: t.tekst,
      tags: ['zaproszenie'],
    }),
  });
  if (!brevo.ok) {
    const b = await brevo.json().catch(() => ({}));
    return json(502, { wyslano: false, powod: 'blad-wysylki', blad: `Poczta odrzuciła wiadomość (${brevo.status}${b?.message ? `: ${b.message}` : ''}).` });
  }
  return json(200, { wyslano: true, email: dane.email });
}
