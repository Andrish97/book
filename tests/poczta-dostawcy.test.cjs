// Dostawcy poczty (#105): Brevo pierwszy, ZeptoMail (Zoho) drugi (gdy włączony) – przełączanie przy odmowie, kolejność
// i dzienne limity z bazy (poczta_dostawcy), maile logowania przez hak Auth, test z panelu przez jednego dostawcę,
// stan sekretów tylko dla administratora. Bez sieci – fetch to atrapa.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODUL = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'poczta.mjs');
const poczta = () => import(pathToFileURL(MODUL).href);
const BREVO = 'https://api.brevo.com/v3/smtp/email';
const ZEPTO_EU = 'https://api.zeptomail.eu/v1.1/email';
const KLUCZ = crypto.randomBytes(32);
const ENV = {
  ZEPTOMAIL_API_KEY: 'Zoho-enczapikey wk-zepto', BREVO_API_KEY: 'klucz-brevo', SITE_URL: 'https://makietka.app',
  SEND_EMAIL_HOOK_SECRET: `v1,whsec_${KLUCZ.toString('base64')}`, SUPABASE_URL: 'https://baza.test', SUPABASE_SERVICE_ROLE_KEY: 'serwis',
};

// Atrapa sieci: rpc – odpowiedzi funkcji bazy po nazwie; zepto/brevo – funkcje zwracające { status, tresc }.
function siec({ rpc = {}, zepto = () => ({ status: 201, tresc: { request_id: 'zr-1' } }), brevo = () => ({ status: 201, tresc: { messageId: 'b-1' } }) } = {}) {
  const wywolania = [];
  const wyslij = async (url, o) => {
    const tresc = o.body ? JSON.parse(o.body) : null;
    wywolania.push({ url, o, tresc });
    let w;
    if (url.includes('/rest/v1/rpc/')) {
      const r = rpc[url.split('/rest/v1/rpc/')[1]];
      w = typeof r === 'function' ? r(tresc, o) : (r || { tresc: null });
    } else if (url.includes('zeptomail')) w = zepto(tresc);
    else if (url === BREVO) w = brevo(tresc);
    else throw new Error(`nieoczekiwany adres ${url}`);
    return new Response(JSON.stringify(w.tresc ?? null), { status: w.status || 200, headers: { 'content-type': 'application/json' } });
  };
  return {
    wyslij,
    wywolania,
    zepto: () => wywolania.filter((w) => w.url.includes('zeptomail')),
    brevo: () => wywolania.filter((w) => w.url === BREVO),
    rpcy: (n) => wywolania.filter((w) => w.url.endsWith(`/rest/v1/rpc/${n}`)),
  };
}
const mail = { do: 'ola@przyklad.pl', temat: 'Temat', html: '<p>x</p>', tekst: 'x', odpowiedzDo: { email: 'anna@test.pl', name: 'Anna' }, naglowki: { 'In-Reply-To': '<a@b>' }, tagi: ['test'] };
const nicNieCzekaj = { czekaj: async () => {} };

test('wysyłka: kolejność z listy (region eu, klucz z przedrostkiem albo bez), przy odmowie następny; bez listy tylko Brevo', async () => {
  const { wyslijPrzez } = await poczta();
  const ZB = ['zeptomail', 'brevo'];
  let s = siec();
  let w = await wyslijPrzez(mail, ENV, s.wyslij, ZB);
  assert.deepEqual(w, { messageId: 'zr-1', dostawca: 'zeptomail' });
  assert.equal(s.zepto()[0].url, ZEPTO_EU);
  assert.equal(s.zepto()[0].o.headers.authorization, 'Zoho-enczapikey wk-zepto', 'przedrostek nie podwaja się');
  const z = s.zepto()[0].tresc;
  assert.deepEqual(z.from, { address: 'no-reply@makietka.app', name: 'Makietka' });
  assert.deepEqual(z.to, [{ email_address: { address: 'ola@przyklad.pl', name: '' } }]);
  assert.deepEqual(z.reply_to, [{ address: 'anna@test.pl', name: 'Anna' }]);
  assert.deepEqual(z.mime_headers, { 'In-Reply-To': '<a@b>' });
  assert.equal(s.brevo().length, 0);
  // Sam token (bez „Zoho-enczapikey”) i region com.
  s = siec();
  await wyslijPrzez(mail, { ...ENV, ZEPTOMAIL_API_KEY: 'wk-sam', ZEPTOMAIL_REGION: 'com' }, s.wyslij, ZB);
  assert.equal(s.zepto()[0].url, 'https://api.zeptomail.com/v1.1/email');
  assert.equal(s.zepto()[0].o.headers.authorization, 'Zoho-enczapikey wk-sam');
  // Zepto odmawia → Brevo.
  s = siec({ zepto: () => ({ status: 401, tresc: { error: { details: [{ message: 'Invalid API Token found' }] } } }) });
  w = await wyslijPrzez(mail, ENV, s.wyslij, ZB);
  assert.deepEqual(w, { messageId: 'b-1', dostawca: 'brevo' });
  // Obaj odmawiają (Brevo – nieznane IP).
  s = siec({ zepto: () => ({ status: 500, tresc: { message: 'awaria' } }), brevo: () => ({ status: 401, tresc: { message: 'We have detected you are using an unrecognised IP address' } }) });
  await assert.rejects(wyslijPrzez(mail, ENV, s.wyslij, ZB), /ZeptoMail odrzucił wiadomość \(500: awaria\).*Brevo odrzuciło wiadomość \(401: We have detected/);
  // Bez sekretu ZeptoMail – od razu Brevo; bez żadnego – brak dostawcy.
  s = siec();
  w = await wyslijPrzez(mail, { ...ENV, ZEPTOMAIL_API_KEY: '' }, s.wyslij, ZB);
  assert.equal(w.dostawca, 'brevo');
  assert.equal(s.zepto().length, 0);
  await assert.rejects(wyslijPrzez(mail, { SITE_URL: 'https://makietka.app' }, s.wyslij, ZB), /brak-dostawcy/);
  // Bez listy z bazy – tylko Brevo (ZeptoMail tylko, gdy włączony w poczta_dostawcy); Brevo odmawia – błąd, bez ZeptoMail.
  s = siec();
  w = await wyslijPrzez(mail, ENV, s.wyslij);
  assert.equal(w.dostawca, 'brevo');
  assert.equal(s.zepto().length, 0);
  s = siec({ brevo: () => ({ status: 401, tresc: { message: 'IP' } }) });
  await assert.rejects(wyslijPrzez(mail, ENV, s.wyslij), /Brevo odrzuciło/);
  assert.equal(s.zepto().length, 0);
});

test('kolejka: kolejność i dzienne limity z bazy, wynik z dostawcą, test z panelu tylko przez wskazanego dostawcę', async () => {
  const { przetworzKolejke } = await poczta();
  const wiad = (id, dane = {}) => ({ id, rodzaj: 'test', do_email: `${id}@x.pl`, szablon: 'test', dane: { kiedy: '2026-11-15T10:00:00Z', ...dane }, naglowki: {}, od_skrzynki: false });
  const partia = (wiadomosci, dostawcy) => ({ tresc: { wiadomosci, dostawcy, odstep_ms: 0, nadawca: { email: 'no-reply@makietka.app', name: 'Makietka' }, skrzynka: { email: 'kontakt@makietka.app', name: 'Makietka' } } });
  // Brevo ma wyższy priorytet w panelu – idzie pierwszy.
  let s = siec({ rpc: { poczta_kolejka_pobierz: partia([wiad('a')], [{ id: 'brevo', zostalo: 5 }, { id: 'zeptomail', zostalo: 5 }]) } });
  let w = await przetworzKolejke(ENV, s.wyslij, nicNieCzekaj);
  assert.deepEqual(w.wyslane, ['a']);
  assert.equal(s.brevo().length, 1);
  assert.equal(s.zepto().length, 0);
  assert.equal(s.rpcy('poczta_kolejka_wynik')[0].tresc.p_dostawca, 'brevo');
  // ZeptoMail ma jedną wiadomość z limitu – druga idzie przez Brevo.
  s = siec({ rpc: { poczta_kolejka_pobierz: partia([wiad('a'), wiad('b')], [{ id: 'zeptomail', zostalo: 1 }, { id: 'brevo', zostalo: 5 }]) } });
  w = await przetworzKolejke(ENV, s.wyslij, nicNieCzekaj);
  assert.deepEqual(w.wyslane, ['a', 'b']);
  assert.deepEqual(s.rpcy('poczta_kolejka_wynik').map((r) => r.tresc.p_dostawca), ['zeptomail', 'brevo']);
  // Wyłączony w panelu (nie ma go na liście) – nie jest próbowany, nawet z sekretem.
  s = siec({ rpc: { poczta_kolejka_pobierz: partia([wiad('a')], [{ id: 'brevo', zostalo: 5 }]) } });
  await przetworzKolejke(ENV, s.wyslij, nicNieCzekaj);
  assert.equal(s.zepto().length, 0);
  // Test z panelu przez Brevo – tylko Brevo, a gdy odmówi, nie ma przejścia do innego.
  s = siec({
    rpc: { poczta_kolejka_pobierz: partia([wiad('t', { dostawca: 'brevo' })], [{ id: 'zeptomail', zostalo: 5 }, { id: 'brevo', zostalo: 5 }]) },
    brevo: () => ({ status: 401, tresc: { message: 'unrecognised IP address' } }),
  });
  w = await przetworzKolejke(ENV, s.wyslij, nicNieCzekaj);
  assert.equal(w.bledy.length, 1);
  assert.equal(s.zepto().length, 0);
  assert.deepEqual(s.rpcy('poczta_kolejka_wynik')[0].tresc, { p_id: 't', p_ok: false, p_blad: w.bledy[0].blad, p_message_id: null, p_dostawca: null });
});

test('hak Auth: mail logowania przez ZeptoMail według kolejności z bazy, zapis do dziennego licznika; Zepto odmawia – Brevo', async () => {
  const { obsluzPoczte } = await poczta();
  const payload = { user: { id: 'u1', email: 'anna@test.pl' }, email_data: { email_action_type: 'recovery', token: '1', token_hash: 'th', redirect_to: 'https://makietka.app/' } };
  const podpisane = () => {
    const tresc = JSON.stringify(payload);
    const id = `msg_${crypto.randomBytes(4).toString('hex')}`;
    const czas = Math.floor(Date.now() / 1000);
    const podpis = crypto.createHmac('sha256', KLUCZ).update(`${id}.${czas}.${tresc}`).digest('base64');
    return new Request('https://x/functions/v1/poczta', {
      method: 'POST', headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(czas), 'webhook-signature': `v1,${podpis}` }, body: tresc,
    });
  };
  const kolejnosc = { tresc: [{ id: 'zeptomail', typ: 'zeptomail', zostalo: 10 }, { id: 'brevo', typ: 'brevo', zostalo: 10 }] };
  let s = siec({ rpc: { poczta_dostawcy_kolejnosc: kolejnosc } });
  let odp = await obsluzPoczte(podpisane(), ENV, s.wyslij);
  assert.equal(odp.status, 200);
  assert.equal(s.zepto().length, 1);
  assert.match(s.zepto()[0].tresc.textbody, /token_hash=th&type=recovery/);
  assert.deepEqual(s.rpcy('poczta_dostawca_wyslano')[0].tresc, { p_id: 'zeptomail' });
  // ZeptoMail wyczerpał limit – mail logowania idzie przez Brevo.
  s = siec({ rpc: { poczta_dostawcy_kolejnosc: { tresc: [{ id: 'zeptomail', zostalo: 0 }, { id: 'brevo', zostalo: 3 }] } } });
  odp = await obsluzPoczte(podpisane(), ENV, s.wyslij);
  assert.equal(odp.status, 200);
  assert.equal(s.zepto().length, 0);
  assert.equal(s.brevo().length, 1);
  // Baza niedostępna – tylko Brevo.
  s = siec({ rpc: { poczta_dostawcy_kolejnosc: { status: 500, tresc: { message: 'x' } } } });
  odp = await obsluzPoczte(podpisane(), ENV, s.wyslij);
  assert.equal(odp.status, 200);
  assert.equal(s.zepto().length, 0);
  assert.equal(s.brevo().length, 1);
  // ZeptoMail wyłączony (nie ma go w kolejności z bazy) – Brevo odmawia → błąd, bez przełączenia.
  s = siec({ rpc: { poczta_dostawcy_kolejnosc: { tresc: [{ id: 'brevo', typ: 'brevo', zostalo: 10 }] } }, brevo: () => ({ status: 401, tresc: { message: 'IP' } }) });
  odp = await obsluzPoczte(podpisane(), ENV, s.wyslij);
  assert.equal(odp.status, 500);
  assert.equal(s.zepto().length, 0);
  // Włączony za Brevo – Brevo odmawia → ZeptoMail.
  s = siec({ rpc: { poczta_dostawcy_kolejnosc: { tresc: [{ id: 'brevo', zostalo: 10 }, { id: 'zeptomail', zostalo: 10 }] } }, brevo: () => ({ status: 401, tresc: { message: 'IP' } }) });
  odp = await obsluzPoczte(podpisane(), ENV, s.wyslij);
  assert.equal(odp.status, 200);
  assert.deepEqual(s.rpcy('poczta_dostawca_wyslano')[0].tresc, { p_id: 'zeptomail' });
  // Żaden nie przyjmie – błąd dla Auth.
  s = siec({ rpc: { poczta_dostawcy_kolejnosc: kolejnosc }, zepto: () => ({ status: 401, tresc: {} }), brevo: () => ({ status: 401, tresc: { message: 'IP' } }) });
  odp = await obsluzPoczte(podpisane(), ENV, s.wyslij);
  assert.equal(odp.status, 500);
});

test('stan sekretów dostawców: tylko administrator, same tak/nie bez wartości', async () => {
  const { obsluzPoczte } = await poczta();
  const zadanie = () => new Request('https://x/functions/v1/poczta', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer token' }, body: JSON.stringify({ stan_dostawcow: true }) });
  let s = siec({ rpc: { czy_administrator: { tresc: true } } });
  let odp = await obsluzPoczte(zadanie(), { ...ENV, BREVO_API_KEY: '' }, s.wyslij);
  const tresc = await odp.json();
  assert.deepEqual(tresc, { dostawcy: { zeptomail: true, brevo: false }, region_zeptomail: 'eu' });
  assert.ok(!JSON.stringify(tresc).includes('wk-zepto'));
  s = siec({ rpc: { czy_administrator: { tresc: false } } });
  odp = await obsluzPoczte(zadanie(), ENV, s.wyslij);
  assert.equal(odp.status, 403);
});

test('funkcja poczta dostaje z Deno.env każdy sekret, którego używa wspólny kod', () => {
  const fs = require('node:fs');
  const kod = fs.readFileSync(MODUL, 'utf8');
  const wejscie = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'poczta', 'index.ts'), 'utf8');
  const nazwy = [...new Set([...kod.matchAll(/env\??\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]))];
  assert.ok(nazwy.includes('ZEPTOMAIL_API_KEY'));
  for (const n of nazwy) assert.ok(wejscie.includes(`Deno.env.get('${n}')`), `index.ts nie przekazuje ${n}`);
});
