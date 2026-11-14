// Poczta aplikacji (supabase/functions/_shared/poczta.mjs, Funkcja Edge poczta): hak Auth „Send Email”
// z podpisem standardwebhooks, wiadomości każdego rodzaju przez API Brevo, zaproszenia do projektów;
// bez sieci – fetch to atrapa. Do tego powrót z linku w aplikacji (?token_hash=…, verifyOtp).

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz } = require('./pomoc.cjs');

const MODUL = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'poczta.mjs');
const RDZEN = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs');
const poczta = () => import(pathToFileURL(MODUL).href);

const KLUCZ = crypto.randomBytes(32);
const SEKRET = `v1,whsec_${KLUCZ.toString('base64')}`;
const ENV = { BREVO_API_KEY: 'klucz-brevo', SEND_EMAIL_HOOK_SECRET: SEKRET, SITE_URL: 'https://makietka.app' };

function podpisane(payload, { sekret = KLUCZ, czas = Math.floor(Date.now() / 1000), zepsuj = false } = {}) {
  const tresc = JSON.stringify(payload);
  const id = `msg_${crypto.randomBytes(6).toString('hex')}`;
  const podpis = crypto.createHmac('sha256', sekret).update(`${id}.${czas}.${tresc}`).digest('base64');
  return new Request('https://x.supabase.co/functions/v1/poczta', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(czas), 'webhook-signature': `v1,${zepsuj ? `x${podpis.slice(1)}` : podpis}` },
    body: tresc,
  });
}

function siec(baza = { status: 200, tresc: {} }, brevo = { status: 201, tresc: { messageId: 'm' } }) {
  const wywolania = [];
  const wyslij = async (url, o) => {
    wywolania.push({ url, o, tresc: o.body ? JSON.parse(o.body) : null });
    const w = url.includes('/rest/v1/') ? baza : brevo;
    return new Response(JSON.stringify(w.tresc), { status: w.status, headers: { 'content-type': 'application/json' } });
  };
  return { wyslij, wywolania, maile: () => wywolania.filter((w) => w.url === 'https://api.brevo.com/v3/smtp/email').map((w) => w.tresc) };
}

const hak = (typ, dane = {}, user = {}) => ({
  user: { id: 'u1', email: 'anna@test.pl', ...user },
  email_data: { email_action_type: typ, token: '123456', token_hash: 'th-1', redirect_to: 'https://makietka.app/', site_url: 'https://x.supabase.co', ...dane },
});

test('hak Auth: podpis sprawdzony (zły, przeterminowany, brak – odmowa), każdy rodzaj wiadomości z linkiem do aplikacji', async () => {
  const { obsluzPoczte } = await poczta();
  let s = siec();
  let odp = await obsluzPoczte(podpisane(hak('recovery'), { zepsuj: true }), ENV, s.wyslij);
  assert.equal(odp.status, 401);
  odp = await obsluzPoczte(podpisane(hak('recovery'), { czas: Math.floor(Date.now() / 1000) - 3600 }), ENV, s.wyslij);
  assert.equal(odp.status, 401, 'stary podpis');
  odp = await obsluzPoczte(podpisane(hak('recovery'), { sekret: crypto.randomBytes(32) }), ENV, s.wyslij);
  assert.equal(odp.status, 401, 'cudzy sekret');
  assert.equal(s.wywolania.length, 0);

  const przypadki = [
    ['signup', {}, {}, [['anna@test.pl', /potwierdź konto/, 'https://makietka.app/?token_hash=th-1&type=signup']]],
    ['recovery', {}, {}, [['anna@test.pl', /ustaw nowe hasło/, 'https://makietka.app/?token_hash=th-1&type=recovery']]],
    ['magiclink', {}, {}, [['anna@test.pl', /link do logowania/, 'https://makietka.app/?token_hash=th-1&type=magiclink']]],
    ['invite', {}, {}, [['anna@test.pl', /zaproszenie do aplikacji/, 'https://makietka.app/?token_hash=th-1&type=invite']]],
    // Zmiana adresu bez „bezpiecznej zmiany”: link tylko na nowy adres, stary – samo powiadomienie.
    ['email_change', { token_hash: 'th-nowy' }, { new_email: 'nowy@test.pl' }, [
      ['nowy@test.pl', /potwierdź nowy adres/, 'https://makietka.app/?token_hash=th-nowy&type=email_change'],
      ['anna@test.pl', /zmiana adresu e-mail/, null]]],
    // Bezpieczna zmiana: dwa tokeny – link na stary i na nowy adres.
    ['email_change', { token_hash: 'th-stary', token_hash_new: 'th-nowy' }, { new_email: 'nowy@test.pl' }, [
      ['anna@test.pl', /potwierdź zmianę adresu/, 'https://makietka.app/?token_hash=th-stary&type=email_change'],
      ['nowy@test.pl', /potwierdź nowy adres/, 'https://makietka.app/?token_hash=th-nowy&type=email_change']]],
    ['reauthentication', {}, {}, [['anna@test.pl', /kod potwierdzenia/, null]]],
    ['password_changed_notification', {}, {}, [['anna@test.pl', /hasło zostało zmienione/, null]]],
  ];
  for (const [typ, dane, user, oczekiwane] of przypadki) {
    s = siec();
    odp = await obsluzPoczte(podpisane(hak(typ, dane, user)), ENV, s.wyslij);
    assert.equal(odp.status, 200, typ);
    assert.deepEqual(await odp.json(), {}, 'odpowiedź dla Auth');
    const maile = s.maile();
    assert.equal(maile.length, oczekiwane.length, `${typ}: liczba wiadomości`);
    oczekiwane.forEach(([adres, temat, link], i) => {
      const m = maile[i];
      assert.deepEqual(m.to, [{ email: adres }], typ);
      assert.match(m.subject, temat, typ);
      assert.deepEqual(m.sender, { email: 'no-reply@makietka.app', name: 'Makietka' });
      assert.ok(m.htmlContent.includes('Makietka') && m.textContent.length > 20, typ);
      if (link) {
        assert.ok(m.textContent.includes(link), `${typ}: link w tekście – ${m.textContent}`);
        assert.ok(m.htmlContent.includes(`href="${link.replace(/&/g, '&amp;')}"`), `${typ}: link w przycisku`);
      }
    });
    assert.equal(s.wywolania[0].o.headers['api-key'], 'klucz-brevo');
  }
  // Kod jednorazowy w wiadomości „reauthentication”.
  s = siec();
  await obsluzPoczte(podpisane(hak('reauthentication')), ENV, s.wyslij);
  assert.ok(s.maile()[0].textContent.includes('123456'));
});

test('hak Auth: link tylko do naszej strony (obcy redirect_to – adres ze stałej), ścieżka aplikacji z redirect_to zostaje; brak klucza Brevo – błąd dla Auth', async () => {
  const { obsluzPoczte } = await poczta();
  const { ADRES_APLIKACJI } = await import(pathToFileURL(RDZEN).href);
  let s = siec();
  await obsluzPoczte(podpisane(hak('recovery', { redirect_to: 'https://zly.example/przejmij' })), ENV, s.wyslij);
  assert.ok(s.maile()[0].textContent.includes('https://makietka.app/?token_hash='), 'obcy adres zignorowany');
  // Aplikacja pod adresem ze stałej (np. przed przenosinami na domenę) – ścieżka z redirect_to.
  s = siec();
  const zeStalej = `${new URL(ADRES_APLIKACJI).origin}/sciezka/aplikacji/?x=1#/projekty`;
  await obsluzPoczte(podpisane(hak('signup', { redirect_to: zeStalej })), { ...ENV, SITE_URL: undefined }, s.wyslij);
  assert.ok(s.maile()[0].textContent.includes(`${new URL(ADRES_APLIKACJI).origin}/sciezka/aplikacji/?token_hash=th-1&type=signup`));

  s = siec();
  const odp = await obsluzPoczte(podpisane(hak('recovery')), { ...ENV, BREVO_API_KEY: undefined }, s.wyslij);
  assert.equal(odp.status, 500);
  assert.match((await odp.json()).error.message, /BREVO_API_KEY/);
  assert.equal(s.wywolania.length, 0);

  // Odmowa Brevo przechodzi do Auth jako błąd (Auth pokaże, że e-mail nie wyszedł).
  s = siec(undefined, { status: 401, tresc: { message: 'Key not found' } });
  const zle = await obsluzPoczte(podpisane(hak('recovery')), ENV, s.wyslij);
  assert.equal(zle.status, 500);
  assert.match((await zle.json()).error.message, /401: Key not found/);
});

test('zaproszenie do projektu: dane z bazy tokenem zapraszającego, link ze stałej, odpowiedź do zapraszającego; bez klucza – bez wysyłki', async () => {
  const { obsluzPoczte } = await poczta();
  const dane = { email: 'ola@przyklad.pl', kod: 'Kod_1', rola: 'edycja', wazne_do: '2026-11-28T10:00:00Z', projekt: 'Kalendarz <2027>', od: 'Anna', od_email: 'anna@test.pl' };
  const zadanie = (naglowki = { authorization: 'Bearer token-anny' }) => new Request('https://x/functions/v1/poczta', { method: 'POST', headers: { 'content-type': 'application/json', ...naglowki }, body: JSON.stringify({ zaproszenie: 'z1' }) });
  let s = siec({ status: 200, tresc: dane });
  let odp = await obsluzPoczte(zadanie(), { ...ENV, SUPABASE_URL: 'https://baza.test' }, s.wyslij);
  assert.deepEqual(await odp.json(), { wyslano: true }, 'bez adresu w odpowiedzi (#100)');
  assert.equal(s.wywolania[0].url, 'https://baza.test/rest/v1/rpc/dane_maila_zaproszenia');
  assert.equal(s.wywolania[0].o.headers.authorization, 'Bearer token-anny');
  const m = s.maile()[0];
  assert.deepEqual(m.to, [{ email: 'ola@przyklad.pl' }]);
  assert.deepEqual(m.replyTo, { email: 'anna@test.pl', name: 'Anna' });
  assert.ok(m.textContent.includes('https://makietka.app/#/zaproszenie/Kod_1'));
  assert.ok(m.htmlContent.includes('Kalendarz &lt;2027&gt;'));
  assert.match(m.subject, /Anna zaprasza Cię do projektu „Kalendarz <2027>”/);

  s = siec({ status: 200, tresc: dane });
  odp = await obsluzPoczte(zadanie(), { SITE_URL: 'https://makietka.app' }, s.wyslij);
  assert.deepEqual(await odp.json(), { wyslano: false, powod: 'brak-konfiguracji' });
  odp = await obsluzPoczte(zadanie({}), ENV, s.wyslij);
  assert.equal(odp.status, 401);
  s = siec({ status: 400, tresc: { message: 'E-mail z tym zaproszeniem poszedł przed chwilą' } });
  odp = await obsluzPoczte(zadanie(), ENV, s.wyslij);
  assert.match((await odp.json()).blad, /przed chwilą/);
  assert.equal(s.maile().length, 0);
  odp = await obsluzPoczte(new Request('https://x', { method: 'OPTIONS' }), ENV, s.wyslij);
  assert.equal(odp.status, 204);
});

test('aplikacja: link z poczty ?token_hash=… – reset hasła prowadzi do ustawienia nowego, wygasły link – komunikat, adres wraca do zwykłej postaci', async (t) => {
  const { strona, baza, adres } = await otworz(t, { tryb: 'atrapa' });
  baza.linki = new Map([['th-reset', { email: 'anna@test.pl', typ: 'recovery' }]]);
  await strona.goto(`${adres}?token_hash=th-reset&type=recovery`);
  await strona.waitForFunction(() => document.querySelector('#form-logowania') && !/token_hash/.test(location.href));
  await strona.waitForFunction(() => { const t = document.querySelector('#tytul-logowania'); return t && !t.hidden && t.textContent === 'Ustaw nowe hasło'; });
  assert.equal(baza.linki.size, 0, 'link zużyty');
  await strona.goto(`${adres}?token_hash=th-reset&type=recovery`);
  await strona.waitForFunction(() => /wygasł albo został użyty/.test(document.querySelector('#komunikat-logowania')?.textContent || ''));
});
