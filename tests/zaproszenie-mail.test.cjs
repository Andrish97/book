// Funkcja Edge zaproszenie-mail (supabase/functions/_shared/zaproszenie-mail.mjs): e-mail z zaproszeniem
// przez API Brevo – dane z bazy tokenem zapraszającego, link z adresu aplikacji, bez klucza – bez wysyłki.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODUL = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'zaproszenie-mail.mjs');
const RDZEN = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs');

const DANE = { email: 'ola@przyklad.pl', kod: 'Kod_123-abc', rola: 'edycja', wazne_do: '2026-11-28T10:00:00Z', projekt: 'Kalendarz <2027>', od: 'Anna', od_email: 'anna@test.pl', konto: false };

function atrapaSieci({ baza = { status: 200, tresc: DANE }, brevo = { status: 201, tresc: { messageId: 'm1' } } } = {}) {
  const wywolania = [];
  const wyslij = async (url, opcje) => {
    wywolania.push({ url, opcje, tresc: opcje.body ? JSON.parse(opcje.body) : null });
    const o = url.includes('/rest/v1/rpc/') ? baza : brevo;
    return new Response(JSON.stringify(o.tresc), { status: o.status, headers: { 'content-type': 'application/json' } });
  };
  return { wyslij, wywolania };
}

const zadanie = (cialo = { id: 'z1' }, naglowki = { authorization: 'Bearer token-anny' }, metoda = 'POST') => new Request('https://x.supabase.co/functions/v1/zaproszenie-mail', {
  method: metoda, headers: { 'content-type': 'application/json', ...naglowki }, body: metoda === 'POST' ? JSON.stringify(cialo) : undefined,
});

test('wysyłka przez Brevo: dane z bazy tokenem zapraszającego, nadawca, link z adresu aplikacji, odpowiedź do zapraszającego', async () => {
  const { obsluzZaproszenieMail } = await import(pathToFileURL(MODUL).href);
  const { ADRES_APLIKACJI } = await import(pathToFileURL(RDZEN).href);
  const s = atrapaSieci();
  const odp = await obsluzZaproszenieMail(zadanie(), { BREVO_API_KEY: 'klucz-testowy', SUPABASE_URL: 'https://baza.test' }, s.wyslij);
  assert.equal(odp.status, 200);
  assert.deepEqual(await odp.json(), { wyslano: true, email: 'ola@przyklad.pl' });
  const [rpc, mail] = s.wywolania;
  assert.equal(rpc.url, 'https://baza.test/rest/v1/rpc/dane_maila_zaproszenia');
  assert.equal(rpc.opcje.headers.authorization, 'Bearer token-anny', 'baza sprawdza token zapraszającego');
  assert.deepEqual(rpc.tresc, { p_id: 'z1' });
  assert.equal(mail.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(mail.opcje.headers['api-key'], 'klucz-testowy');
  assert.deepEqual(mail.tresc.sender, { email: 'no-reply@makietka.app', name: 'Makietka' });
  assert.deepEqual(mail.tresc.to, [{ email: 'ola@przyklad.pl' }]);
  assert.deepEqual(mail.tresc.replyTo, { email: 'anna@test.pl', name: 'Anna' });
  const link = `${ADRES_APLIKACJI.replace(/\/?$/, '/')}#/zaproszenie/Kod_123-abc`;
  assert.ok(mail.tresc.textContent.includes(link), 'link z adresu aplikacji (stała), nie z zapytania');
  assert.ok(mail.tresc.htmlContent.includes(`href="${link}"`));
  assert.ok(mail.tresc.htmlContent.includes('Kalendarz &lt;2027&gt;'), 'nazwa projektu bez HTML');
  assert.match(mail.tresc.subject, /Anna zaprasza Cię do projektu „Kalendarz <2027>”/);
});

test('bez klucza Brevo – bez wysyłki; bez tokenu – 401; odmowa bazy – błąd z bazy; adres aplikacji ze zmiennej', async () => {
  const { obsluzZaproszenieMail } = await import(pathToFileURL(MODUL).href);
  let s = atrapaSieci();
  let odp = await obsluzZaproszenieMail(zadanie(), {}, s.wyslij);
  assert.deepEqual(await odp.json(), { wyslano: false, powod: 'brak-konfiguracji' });
  assert.equal(s.wywolania.length, 1, 'tylko sprawdzenie w bazie, bez Brevo');

  odp = await obsluzZaproszenieMail(zadanie({ id: 'z1' }, {}), { BREVO_API_KEY: 'k' }, s.wyslij);
  assert.equal(odp.status, 401);

  s = atrapaSieci({ baza: { status: 400, tresc: { message: 'E-mail z tym zaproszeniem poszedł przed chwilą' } } });
  odp = await obsluzZaproszenieMail(zadanie(), { BREVO_API_KEY: 'k' }, s.wyslij);
  assert.equal(odp.status, 400);
  assert.match((await odp.json()).blad, /przed chwilą/);
  assert.equal(s.wywolania.length, 1);

  s = atrapaSieci({ brevo: { status: 401, tresc: { message: 'Key not found' } } });
  odp = await obsluzZaproszenieMail(zadanie(), { BREVO_API_KEY: 'zly', ADRES_APLIKACJI: 'https://makietka.app' }, s.wyslij);
  assert.equal(odp.status, 502);
  assert.match((await odp.json()).blad, /401: Key not found/);
  assert.ok(s.wywolania[1].tresc.textContent.includes('https://makietka.app/#/zaproszenie/Kod_123-abc'));

  odp = await obsluzZaproszenieMail(zadanie(undefined, {}, 'OPTIONS'), {}, s.wyslij);
  assert.equal(odp.status, 204);
  assert.equal(odp.headers.get('access-control-allow-origin'), '*');
});
