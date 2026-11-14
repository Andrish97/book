// Powiadomienia push (decyzja #113): szyfrowanie Web Push (RFC 8291) i podpis VAPID (RFC 8292) w module
// Funkcji Edge powiadomienia (przeniesione z Familiady), treści powiadomień, przebieg kolejki z odszyfrowaniem
// tak, jak robi to przeglądarka, oraz skrypt scripts/vapid.cjs.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const zB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// Odszyfrowanie po stronie urządzenia (node:crypto, niezależnie od modułu).
function odszyfruj(body, uaPrivate, uaPublic, auth) {
  const salt = body.subarray(0, 16);
  assert.equal(body.readUInt32BE(16), 4096);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const szyfr = body.subarray(21 + idlen);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(uaPrivate);
  const sekret = ecdh.computeSecret(asPublic);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', sekret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(szyfr.subarray(szyfr.length - 16));
  const jawny = Buffer.concat([d.update(szyfr.subarray(0, szyfr.length - 16)), d.final()]);
  assert.equal(jawny[jawny.length - 1], 2);
  return jawny.subarray(0, jawny.length - 1).toString('utf8');
}

function urzadzenie() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { priv: ecdh.getPrivateKey(), pub: ecdh.getPublicKey(), auth: crypto.randomBytes(16) };
}

function sprawdzPodpis(naglowek, publiczny) {
  const m = naglowek.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
  assert.ok(m, naglowek);
  const pub = zB64url(publiczny);
  const klucz = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33)) }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key: klucz, dsaEncoding: 'ieee-p1363' }, zB64url(m[3])), 'podpis VAPID');
  return JSON.parse(zB64url(m[2]).toString());
}

test('Web Push: wektor z RFC 8291, losowe klucze z polskimi znakami, złe klucze odrzucane', async () => {
  const { encryptPayload, b64urlEncode, b64urlDecode } = await modul('supabase/functions/_shared/web-push.js');
  const out = await encryptPayload(RFC.plaintext, RFC.uaPublic, RFC.auth, { serverKeys: { publicKey: RFC.asPublic, privateKey: RFC.asPrivate }, salt: RFC.salt });
  assert.equal(b64urlEncode(out), RFC.body);
  assert.equal(odszyfruj(Buffer.from(out), Buffer.from(b64urlDecode(RFC.uaPrivate)), Buffer.from(b64urlDecode(RFC.uaPublic)), Buffer.from(b64urlDecode(RFC.auth))), RFC.plaintext);
  const u = urzadzenie();
  const tresc = JSON.stringify({ title: 'Zaproszenie do projektu', body: 'Ola zaprasza Cię do projektu „Kalendarz 2027” – żółć' });
  const a = await encryptPayload(tresc, b64url(u.pub), b64url(u.auth));
  const b = await encryptPayload(tresc, b64url(u.pub), b64url(u.auth));
  assert.notEqual(b64url(a), b64url(b), 'każde szyfrowanie inne');
  assert.equal(odszyfruj(Buffer.from(a), u.priv, u.pub, u.auth), tresc);
  await assert.rejects(encryptPayload('x', 'AAAA', b64url(u.auth)), /invalid_p256dh/);
  await assert.rejects(encryptPayload('x', b64url(u.pub), 'AAAA'), /invalid_auth/);
});

test('VAPID: para z scripts/vapid.cjs podpisuje JWT ES256 z aud = adres usługi', async () => {
  const { vapidAuthorization } = await modul('supabase/functions/_shared/web-push.js');
  const { generuj } = require('../scripts/vapid.cjs');
  for (let i = 0; i < 5; i += 1) {
    const { publiczny, prywatny } = generuj();
    assert.equal(zB64url(publiczny).length, 65);
    assert.equal(zB64url(prywatny).length, 32);
    const vapid = { publicKey: publiczny, privateKey: prywatny, subject: 'mailto:kontakt@makietka.app' };
    const naglowek = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', vapid, 1_800_000_000);
    assert.deepEqual(sprawdzPodpis(naglowek, publiczny), { aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 43200, sub: 'mailto:kontakt@makietka.app' });
  }
});

test('treści powiadomień: zaproszenie (link z kodem), udostępnienie, odpowiedź, rola, koniec dostępu', async () => {
  const { trescPowiadomienia } = await modul('supabase/functions/_shared/powiadomienia.mjs');
  const P = '11111111-1111-4111-8111-111111111111';
  const t = (zdarzenie, dane) => trescPowiadomienia({ zdarzenie, dane: { projekt_id: P, projekt: 'Kalendarz 2027', kto: 'Ola', ...dane } });
  assert.deepEqual(t('zaproszenie', { rola: 'edycja', kod: 'abc' }), { title: 'Zaproszenie do projektu', body: 'Ola zaprasza Cię do projektu „Kalendarz 2027” (może edytować).', url: './#/zaproszenie/abc', tag: `zaproszenie-${P}`.slice(0, 32) });
  assert.equal(t('udostepniono', { rola: 'odczyt' }).body, 'Ola udostępnia Ci projekt „Kalendarz 2027” (może oglądać).');
  assert.equal(t('udostepniono', {}).url, `./#/p/${P}`);
  assert.equal(t('przyjete', {}).body, 'Ola dołącza do projektu „Kalendarz 2027”.');
  assert.equal(t('odrzucone', {}).title, 'Zaproszenie odrzucone');
  assert.equal(t('rola', { rola: 'odczyt' }).body, 'Ola zmienia Twoją rolę w projekcie „Kalendarz 2027”: może oglądać.');
  assert.deepEqual([t('odebrano', {}).body, t('odebrano', {}).url], ['Nie masz już dostępu do projektu „Kalendarz 2027”.', './#/projekty']);
  assert.equal(trescPowiadomienia({ zdarzenie: 'cos', dane: {} }), null);
});

test('funkcja powiadomienia: klucz publiczny dla przeglądarki, przebieg kolejki – wysyłka, wynik urządzeń, brak kluczy', async () => {
  const { obsluzPowiadomienia, przetworzKolejke } = await modul('supabase/functions/_shared/powiadomienia.mjs');
  const { generuj } = require('../scripts/vapid.cjs');
  const { publiczny, prywatny } = generuj();
  const env = { VAPID_PUBLIC_KEY: publiczny, VAPID_PRIVATE_KEY: prywatny, VAPID_SUBJECT: 'mailto:kontakt@makietka.app', SUPABASE_URL: 'https://baza.test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' };
  const zadanie = (tresc) => new Request('https://baza.test/functions/v1/powiadomienia', { method: 'POST', body: JSON.stringify(tresc) });

  let odp = await obsluzPowiadomienia(zadanie({ klucz: true }), env);
  assert.deepEqual(await odp.json(), { klucz: publiczny });
  assert.equal(odp.headers.get('access-control-allow-origin'), '*');
  odp = await obsluzPowiadomienia(zadanie({ klucz: true }), {});
  assert.deepEqual(await odp.json(), { klucz: null });
  assert.deepEqual(await przetworzKolejke({ ...env, VAPID_PRIVATE_KEY: '' }, async () => { throw new Error('bez sieci'); }), { zdarzenia: 0, dostarczone: 0, nieudane: 0, powod: 'brak-kluczy-vapid' });

  const u1 = urzadzenie();
  const u2 = urzadzenie();
  const partia = [{
    id: 7, zdarzenie: 'zaproszenie', rodzaj: 'zaproszenia', utworzono: '2026-11-16T10:00:00Z',
    dane: { projekt_id: 'p1', projekt: 'Planer', kto: 'Ola', rola: 'edycja', kod: 'k1' },
    urzadzenia: [
      { id: 'u1', endpoint: 'https://fcm.googleapis.com/fcm/send/u1', p256dh: b64url(u1.pub), auth: b64url(u1.auth) },
      { id: 'u2', endpoint: 'https://web.push.apple.com/u2', p256dh: b64url(u2.pub), auth: b64url(u2.auth) },
    ],
  }];
  const wywolania = [];
  let pobrania = 0;
  const siec = async (adres, init) => {
    wywolania.push({ adres, init });
    if (adres === 'https://baza.test/rest/v1/rpc/push_kolejka_pobierz') {
      assert.equal(init.headers.apikey, 'sb_secret_test');
      pobrania += 1;
      return new Response(JSON.stringify(pobrania === 1 ? partia : []), { status: 200 });
    }
    if (adres === 'https://baza.test/rest/v1/rpc/push_kolejka_wynik') return new Response('null', { status: 200 });
    if (adres.endsWith('/u1')) return new Response('', { status: 201 });
    if (adres.endsWith('/u2')) return new Response('', { status: 410 });
    throw new Error(`nieoczekiwany adres ${adres}`);
  };
  odp = await obsluzPowiadomienia(zadanie({ kolejka: true }), env, siec);
  assert.deepEqual(await odp.json(), { zdarzenia: 1, dostarczone: 1, nieudane: 1, powod: null });
  const doU1 = wywolania.find((w) => w.adres.endsWith('/u1'));
  assert.equal(doU1.init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(sprawdzPodpis(doU1.init.headers.Authorization, publiczny).aud, 'https://fcm.googleapis.com');
  const tresc = JSON.parse(odszyfruj(Buffer.from(doU1.init.body), u1.priv, u1.pub, u1.auth));
  assert.equal(tresc.title, 'Zaproszenie do projektu');
  assert.equal(tresc.url, './#/zaproszenie/k1');
  assert.equal(tresc.timestamp, Date.parse('2026-11-16T10:00:00Z'));
  const wynik = JSON.parse(wywolania.find((w) => w.adres.endsWith('push_kolejka_wynik')).init.body);
  assert.deepEqual(wynik, { p_id: 7, p_urzadzenia: [{ id: 'u1', ok: true, zniklo: false }, { id: 'u2', ok: false, zniklo: true }], p_blad: 'HTTP 410' });
});
