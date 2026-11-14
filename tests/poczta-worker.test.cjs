// Poczta w Workerze api.makietka.app (cloudflare/poczta.js, decyzja #95): rozbiór MIME poczty przychodzącej,
// zapis do skrzynki, spam i limity, formularz kontaktowy (pułapka, Turnstile, limity, CORS), cron kolejki.
// Bez sieci: fetch to atrapa, wiadomość Email Routing – obiekt jak w Cloudflare.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = () => import(pathToFileURL(path.join(__dirname, '..', 'cloudflare', 'poczta.js')).href);
const worker = () => import(pathToFileURL(path.join(__dirname, '..', 'cloudflare', 'api-worker.js')).href);

// Atrapa fetch: odpowiedzi według adresu; zapisuje wywołania.
function siec(odpowiedzi) {
  const wywolania = [];
  const stary = globalThis.fetch;
  globalThis.fetch = async (url, o = {}) => {
    const adres = typeof url === 'string' ? url : url.url;
    let tresc = null;
    if (o.body instanceof FormData) tresc = Object.fromEntries(o.body.entries());
    else if (o.body) tresc = JSON.parse(o.body);
    wywolania.push({ url: adres, o, tresc });
    const klucz = Object.keys(odpowiedzi).find((k) => adres.includes(k));
    const w = klucz ? (typeof odpowiedzi[klucz] === 'function' ? odpowiedzi[klucz](tresc) : odpowiedzi[klucz]) : { status: 404, tresc: {} };
    return new Response(JSON.stringify(w.tresc ?? null), { status: w.status || 200, headers: { 'content-type': 'application/json' } });
  };
  return { wywolania, przywroc: () => { globalThis.fetch = stary; } };
}

const CRLF = (s) => s.replace(/\r?\n/g, '\r\n');
// Wiadomość jak z prawdziwej skrzynki: temat w ISO-8859-2 (Q), nadawca z nazwą, tekst quoted-printable w UTF-8,
// HTML w base64, załącznik PDF, odpowiedź na naszą wiadomość (In-Reply-To, References).
const SUROWA = CRLF(`From: =?utf-8?B?SmFuIEtvd2Fsc2tp?= <Jan.Kowalski@Przyklad.pl>
To: kontakt@makietka.app
Subject: =?iso-8859-2?Q?Pytanie_o_wydruk_=B1=EA=B6=E6?=
Message-ID: <m-123@przyklad.pl>
In-Reply-To: <odp-1@smtp-relay.mailin.fr>
References: <m-100@przyklad.pl> <odp-1@smtp-relay.mailin.fr>
Authentication-Results: mx.cloudflare.net; dkim=pass; spf=pass; dmarc=pass
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="ZEW"

--ZEW
Content-Type: multipart/alternative; boundary="WEW"

--WEW
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: quoted-printable

Dzie=C5=84 dobry, czy da si=C4=99 wydrukowa=C4=87 A5?
--WEW
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: base64

${Buffer.from('<p>Dzień dobry, czy da się wydrukować <b>A5</b>?</p>').toString('base64')}
--WEW--
--ZEW
Content-Type: application/pdf; name="cennik.pdf"
Content-Disposition: attachment; filename="cennik.pdf"
Content-Transfer-Encoding: base64

${Buffer.from('%PDF-1.4 test').toString('base64')}
--ZEW--
`);

function wiadomosc(surowa, { rawSize = surowa.length, to = 'kontakt@makietka.app' } = {}) {
  const odrzucone = [];
  const przekazane = [];
  return {
    from: 'bounce@przyklad.pl', to, rawSize,
    raw: new Blob([Buffer.from(surowa, 'latin1')]).stream(),
    headers: new Headers(),
    setReject: (p) => odrzucone.push(p),
    forward: async (a) => { przekazane.push(a); },
    odrzucone, przekazane,
  };
}

test('rozbiór MIME: zestawy znaków, quoted-printable, base64, zagnieżdżone części, załącznik, nadawca z nazwą', async () => {
  const { rozbierz, naBinarny, naglowek, dekodujSlowa, adresZNaglowka, wygladaNaSpam } = await modul();
  const w = rozbierz(naBinarny(Buffer.from(SUROWA, 'latin1')));
  assert.equal(w.tekst, 'Dzień dobry, czy da się wydrukować A5?');
  assert.equal(w.html, '<p>Dzień dobry, czy da się wydrukować <b>A5</b>?</p>');
  assert.equal(w.zalaczniki.length, 1);
  assert.equal(w.zalaczniki[0].nazwa, 'cennik.pdf');
  assert.equal(Buffer.from(w.zalaczniki[0].bajty).toString(), '%PDF-1.4 test');
  assert.equal(dekodujSlowa(naglowek(w.naglowki, 'Subject')), 'Pytanie o wydruk ąęść');
  assert.deepEqual(adresZNaglowka(naglowek(w.naglowki, 'From')), { email: 'jan.kowalski@przyklad.pl', nazwa: 'Jan Kowalski' });
  assert.equal(wygladaNaSpam(w.naglowki), false);
  assert.equal(wygladaNaSpam('Authentication-Results: mx; dkim=none; spf=fail; dmarc=fail'), true);
  // Sam tekst bez części, 8-bitowe UTF-8 w treści.
  const prosta = rozbierz(naBinarny(Buffer.from(CRLF('Subject: Hej\nContent-Type: text/plain; charset=utf-8\n\nZażółć gęślą jaźń\n'), 'utf8')));
  assert.equal(prosta.tekst, 'Zażółć gęślą jaźń');
});

test('poczta przychodząca → skrzynka: dane do poczta_przyjmij (wątek, odpowiedź, załącznik w R2), spam, brak klucza, za duża, limit', async () => {
  const { obsluzEmail } = await modul();
  const r2 = new Map();
  const PLIKI = { put: async (k, b, o) => { r2.set(k, { b, o }); } };
  const s = siec({ '/rest/v1/rpc/poczta_przyjmij': { tresc: { ok: true, watek: 'w1' } } });
  try {
    const m = wiadomosc(SUROWA);
    const czekaj = [];
    const w = await obsluzEmail(m, { KLUCZ_SKRZYNKI: 'msk_klucz', PLIKI, PRZEKAZ_DO: 'ja@przyklad.pl' }, { waitUntil: (p) => czekaj.push(p) });
    await Promise.all(czekaj);
    assert.deepEqual(w, { ok: true, watek: 'w1' });
    assert.deepEqual(m.przekazane, ['ja@przyklad.pl'], 'kopia na adres z PRZEKAZ_DO');
    const { tresc, o } = s.wywolania[0];
    assert.equal(o.headers.apikey, 'sb_publishable_gt_GEmBz6SfJZ0o9rAhLQA_HKH0V_cq');
    assert.equal(tresc.p_klucz, 'msk_klucz');
    const p = tresc.p;
    assert.equal(p.od_email, 'jan.kowalski@przyklad.pl');
    assert.equal(p.od_nazwa, 'Jan Kowalski');
    assert.equal(p.temat, 'Pytanie o wydruk ąęść');
    assert.equal(p.tekst, 'Dzień dobry, czy da się wydrukować A5?');
    assert.equal(p.message_id, '<m-123@przyklad.pl>');
    assert.equal(p.in_reply_to, '<odp-1@smtp-relay.mailin.fr>');
    assert.deepEqual(p.referencje, ['<m-100@przyklad.pl>', '<odp-1@smtp-relay.mailin.fr>']);
    assert.equal(p.spam, false);
    assert.equal(p.zalaczniki.length, 1);
    assert.match(p.zalaczniki[0].klucz, /^poczta\/[0-9a-f-]+\/cennik\.pdf$/);
    assert.equal(r2.get(p.zalaczniki[0].klucz).o.httpMetadata.contentType, 'application/pdf');

    // DMARC nieudany – spam; poczta na noreply@ – ten sam zapis, adres w do_email (plakietka w panelu).
    const spam = SUROWA.replace('dmarc=pass', 'dmarc=fail');
    await obsluzEmail(wiadomosc(spam, { to: 'noreply@makietka.app' }), { KLUCZ_SKRZYNKI: 'msk_klucz', PLIKI });
    const p2 = s.wywolania[1].tresc.p;
    assert.equal(p2.spam, true);
    assert.equal(p2.do_email, 'noreply@makietka.app');
    assert.equal(r2.size, 2);

    const bezKlucza = wiadomosc(SUROWA);
    await obsluzEmail(bezKlucza, {});
    assert.equal(bezKlucza.odrzucone.length, 1);
    const duza = wiadomosc(SUROWA, { rawSize: 16 * 1024 * 1024 });
    await obsluzEmail(duza, { KLUCZ_SKRZYNKI: 'msk_klucz' });
    assert.match(duza.odrzucone[0], /za duża/);
    assert.equal(s.wywolania.length, 2, 'bez klucza i za duża – nic nie trafia do bazy');
  } finally { s.przywroc(); }
  // Limit nadawcy (liczy baza) – wiadomość wraca do nadawcy.
  const s2 = siec({ '/rest/v1/rpc/poczta_przyjmij': { tresc: { blad: 'za-czesto', za_sekund: 3600 } } });
  try {
    const m = wiadomosc(SUROWA);
    await obsluzEmail(m, { KLUCZ_SKRZYNKI: 'msk_klucz', PLIKI });
    assert.match(m.odrzucone[0], /Za dużo/);
  } finally { s2.przywroc(); }
});

test('formularz kontaktowy: CORS tylko makietka.app, pułapka na boty, Turnstile, limity z bazy („spróbuj za…”), potwierdzenie przez kolejkę, token zalogowanego', async () => {
  const { default: w } = await worker();
  const zadanie = (tresc, { origin = 'https://makietka.app', autoryzacja = null, ip = '203.0.113.7' } = {}) => new Request('https://api.makietka.app/kontakt', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, 'cf-connecting-ip': ip, ...(autoryzacja ? { authorization: autoryzacja } : {}) },
    body: JSON.stringify(tresc),
  });
  const ENV = { KLUCZ_SKRZYNKI: 'msk_klucz' };
  const dane = { email: 'gosc@przyklad.pl', temat: 'Druk', tresc: 'Czy obsługujecie format A5?' };
  let wynik = { tresc: { ok: true } };
  const s = siec({
    '/rest/v1/rpc/kontakt_przyjmij': () => wynik,
    '/functions/v1/poczta': { tresc: { wyslane: 1 } },
    'challenges.cloudflare.com': (t) => ({ tresc: { success: t.response === 'dobry-token' } }),
  });
  try {
    const czekaj = [];
    const ctx = { waitUntil: (p) => czekaj.push(p) };
    let odp = await w.fetch(zadanie(dane, { autoryzacja: 'Bearer token-anny' }), ENV, ctx);
    await Promise.all(czekaj);
    assert.equal(odp.status, 200);
    assert.equal(odp.headers.get('access-control-allow-origin'), 'https://makietka.app');
    const rpc = s.wywolania.find((x) => x.url.endsWith('/kontakt_przyjmij'));
    assert.equal(rpc.o.headers.authorization, 'Bearer token-anny', 'zalogowany – token idzie do bazy');
    assert.match(rpc.tresc.p_ip, /^[0-9a-f]{32}$/, 'do bazy idzie skrót IP, nie sam adres');
    assert.notEqual(rpc.tresc.p_ip, '203.0.113.7');
    assert.equal(rpc.tresc.p_tresc, 'Czy obsługujecie format A5?');
    assert.ok(s.wywolania.some((x) => x.url.endsWith('/functions/v1/poczta') && x.tresc.kolejka), 'potwierdzenie – przebieg kolejki');

    // Pułapka: ukryte pole wypełnione – „ok”, ale nic nie idzie do bazy.
    const przed = s.wywolania.length;
    odp = await w.fetch(zadanie({ ...dane, www: 'http://spam' }), ENV, ctx);
    assert.equal(odp.status, 200);
    assert.equal(s.wywolania.length, przed);
    // Obce źródło.
    odp = await w.fetch(zadanie(dane, { origin: 'https://zlosliwy.example' }), ENV, ctx);
    assert.equal(odp.status, 403);
    // Turnstile, gdy jest sekret.
    odp = await w.fetch(zadanie(dane), { ...ENV, TURNSTILE_SECRET: 's' }, ctx);
    assert.equal(odp.status, 400);
    assert.equal((await odp.json()).powod, 'captcha');
    odp = await w.fetch(zadanie({ ...dane, turnstile: 'dobry-token' }), { ...ENV, TURNSTILE_SECRET: 's' }, ctx);
    assert.equal(odp.status, 200);
    // Limit z bazy.
    wynik = { tresc: { blad: 'za-czesto', za: '2 min', za_sekund: 110 } };
    odp = await w.fetch(zadanie(dane), ENV, ctx);
    assert.equal(odp.status, 429);
    assert.match((await odp.json()).blad, /spróbuj ponownie za 2 min/);
    wynik = { tresc: { blad: 'za-krotka' } };
    odp = await w.fetch(zadanie({ ...dane, tresc: 'hej' }), ENV, ctx);
    assert.equal(odp.status, 422);
    // Bez klucza skrzynki – formularz nie działa (z adresem do napisania wprost).
    odp = await w.fetch(zadanie(dane), {}, ctx);
    assert.equal(odp.status, 503);
    assert.match((await odp.json()).blad, /kontakt@makietka\.app/);
    // Preflight.
    odp = await w.fetch(new Request('https://api.makietka.app/kontakt', { method: 'OPTIONS', headers: { origin: 'https://makietka.app' } }), ENV, ctx);
    assert.equal(odp.status, 204);
  } finally { s.przywroc(); }
});

test('cron Workera co minutę prosi funkcję poczta o przebieg kolejki', async () => {
  const { default: w } = await worker();
  const s = siec({ '/functions/v1/poczta': { tresc: { wyslane: 0 } } });
  try {
    const czekaj = [];
    await w.scheduled({}, {}, { waitUntil: (p) => czekaj.push(p) });
    await Promise.all(czekaj);
    assert.equal(s.wywolania.length, 1);
    assert.equal(s.wywolania[0].url, 'https://pganajmivwtstapnwsgv.supabase.co/functions/v1/poczta');
    assert.deepEqual(s.wywolania[0].tresc, { kolejka: true });
  } finally { s.przywroc(); }
});

test('załącznik poczty z R2: GET /pliki/_poczta/… tylko dla administratora (czy_administrator w bazie)', async () => {
  const { default: w, wyczyscPamiec } = await worker();
  wyczyscPamiec();
  const KLUCZ = 'poczta/0f0e0d0c-0000-4000-8000-000000000001/cennik.pdf';
  const tresc = new TextEncoder().encode('%PDF-1.4 test');
  const PLIKI = {
    get: async (k) => (k === KLUCZ ? { size: tresc.length, httpEtag: '"e1"', body: tresc, writeHttpMetadata: (h) => h.set('content-type', 'application/pdf') } : null),
  };
  let admin = true;
  const s = siec({ '/auth/v1/user': () => ({ tresc: { id: 'u1' } }), '/rest/v1/rpc/czy_administrator': () => ({ tresc: admin }) });
  const pobierz = (sciezka, token = 'tok-admina') => w.fetch(new Request(`https://api.makietka.app/pliki/_poczta/${sciezka}`, {
    headers: { authorization: `Bearer ${token}`, origin: 'https://makietka.app' },
  }), { PLIKI });
  try {
    let odp = await pobierz(KLUCZ.slice('poczta/'.length));
    assert.equal(odp.status, 200);
    assert.equal(odp.headers.get('content-type'), 'application/pdf');
    assert.equal(odp.headers.get('cache-control'), 'private, no-store');
    assert.equal(await odp.text(), '%PDF-1.4 test');
    const rpc = s.wywolania.find((x) => x.url.endsWith('/rpc/czy_administrator'));
    assert.equal(rpc.o.headers.authorization, 'Bearer tok-admina', 'baza sprawdza token zalogowanego');
    assert.equal((await pobierz('0f0e0d0c-0000-4000-8000-000000000001/inny.pdf')).status, 404);
    assert.equal((await pobierz('..%2F/x')).status, 400);
    admin = false;
    odp = await pobierz(KLUCZ.slice('poczta/'.length), 'tok-zwyklego');
    assert.equal(odp.status, 403);
  } finally { s.przywroc(); }
});
