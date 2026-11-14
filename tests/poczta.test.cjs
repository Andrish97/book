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

// Atrapa sieci dla kolejki: odpowiedzi bazy według nazwy funkcji (rpc), Brevo – jedna odpowiedź albo funkcja.
function siecKolejki(rpc, brevo = () => ({ status: 201, tresc: { messageId: '<id-brevo@smtp-relay.mailin.fr>' } })) {
  const wywolania = [];
  const wyslij = async (url, o) => {
    const tresc = o.body ? JSON.parse(o.body) : null;
    wywolania.push({ url, o, tresc });
    const nazwa = url.includes('/rest/v1/rpc/') ? url.split('/rest/v1/rpc/')[1] : null;
    const w = nazwa ? (typeof rpc[nazwa] === 'function' ? rpc[nazwa](tresc) : rpc[nazwa]) || { status: 404, tresc: { message: `brak ${nazwa}` } } : brevo(tresc);
    return new Response(JSON.stringify(w.tresc ?? null), { status: w.status || 200, headers: { 'content-type': 'application/json' } });
  };
  return {
    wyslij, wywolania,
    maile: () => wywolania.filter((w) => w.url === 'https://api.brevo.com/v3/smtp/email').map((w) => w.tresc),
    rpc: (n) => wywolania.filter((w) => w.url.endsWith(`/rest/v1/rpc/${n}`)),
  };
}

test('zaproszenie do projektu idzie przez kolejkę: plan tokenem zapraszającego, przebieg kluczem serwisowym, link ze stałej, odpowiedź do zapraszającego; limity i błędy', async () => {
  const { obsluzPoczte } = await poczta();
  const dane = { email: 'ola@przyklad.pl', kod: 'Kod_1', rola: 'edycja', wazne_do: '2026-11-28T10:00:00Z', projekt: 'Kalendarz <2027>', od: 'Anna', od_email: 'anna@test.pl' };
  const partia = (id = 'k1') => ({ status: 200, tresc: {
    wiadomosci: [{ id, rodzaj: 'zaproszenie', do_email: 'ola@przyklad.pl', szablon: 'zaproszenie', dane, odpowiedz_do: { email: 'anna@test.pl', name: 'Anna' }, naglowki: {}, od_skrzynki: false }],
    odstep_ms: 0, nadawca: { email: 'no-reply@makietka.app', name: 'Makietka' }, skrzynka: { email: 'kontakt@makietka.app', name: 'Makietka' },
  } });
  const zadanie = (naglowki = { authorization: 'Bearer token-anny' }) => new Request('https://x/functions/v1/poczta', { method: 'POST', headers: { 'content-type': 'application/json', ...naglowki }, body: JSON.stringify({ zaproszenie: 'z1' }) });
  const ENVK = { ...ENV, SUPABASE_URL: 'https://baza.test', SUPABASE_SERVICE_ROLE_KEY: 'klucz-serwisowy' };

  let s = siecKolejki({ poczta_zaplanuj_zaproszenie: { tresc: { ok: true, id: 'k1', email: 'ola@przyklad.pl' } }, poczta_kolejka_pobierz: partia(), poczta_kolejka_wynik: { tresc: null } });
  let odp = await obsluzPoczte(zadanie(), ENVK, s.wyslij);
  assert.deepEqual(await odp.json(), { wyslano: true, email: 'ola@przyklad.pl' });
  assert.equal(s.rpc('poczta_zaplanuj_zaproszenie')[0].o.headers.authorization, 'Bearer token-anny', 'plan – tokenem zapraszającego');
  assert.equal(s.rpc('poczta_kolejka_pobierz')[0].o.headers.authorization, 'Bearer klucz-serwisowy', 'kolejka – kluczem serwisowym');
  assert.deepEqual(s.rpc('poczta_kolejka_wynik')[0].tresc, { p_id: 'k1', p_ok: true, p_blad: null, p_message_id: '<id-brevo@smtp-relay.mailin.fr>' });
  const m = s.maile()[0];
  assert.deepEqual(m.to, [{ email: 'ola@przyklad.pl' }]);
  assert.deepEqual(m.sender, { email: 'no-reply@makietka.app', name: 'Makietka' });
  assert.deepEqual(m.replyTo, { email: 'anna@test.pl', name: 'Anna' });
  assert.ok(m.textContent.includes('https://makietka.app/#/zaproszenie/Kod_1'));
  assert.ok(m.htmlContent.includes('Kalendarz &lt;2027&gt;'));
  assert.match(m.subject, /Anna zaprasza Cię do projektu „Kalendarz <2027>”/);
  assert.deepEqual(m.tags, ['zaproszenie']);

  // Za często (odstęp na adresata / konto liczy baza) – bez wysyłki, z czasem „spróbuj za…”.
  s = siecKolejki({ poczta_zaplanuj_zaproszenie: { tresc: { blad: 'za-czesto', za: '8 min', za_sekund: 470 } } });
  odp = await obsluzPoczte(zadanie(), ENVK, s.wyslij);
  assert.deepEqual(await odp.json(), { wyslano: false, powod: 'za-czesto', za: '8 min', za_sekund: 470 });
  assert.equal(s.maile().length, 0);
  // Mail czeka w kolejce (np. dzienny limit dostawcy) – przebieg go nie wysłał.
  s = siecKolejki({ poczta_zaplanuj_zaproszenie: { tresc: { ok: true, id: 'k2', email: 'ola@przyklad.pl' } }, poczta_kolejka_pobierz: { tresc: { wiadomosci: [], powod: 'limit-dzienny' } } });
  odp = await obsluzPoczte(zadanie(), ENVK, s.wyslij);
  assert.deepEqual(await odp.json(), { wyslano: false, powod: 'w-kolejce', email: 'ola@przyklad.pl' });
  // Brevo odrzuca – wynik do bazy (ponowienie później), aplikacja dostaje błąd do pokazania.
  s = siecKolejki({ poczta_zaplanuj_zaproszenie: { tresc: { ok: true, id: 'k1', email: 'ola@przyklad.pl' } }, poczta_kolejka_pobierz: partia(), poczta_kolejka_wynik: { tresc: null } },
    () => ({ status: 401, tresc: { message: 'Key not found' } }));
  odp = await obsluzPoczte(zadanie(), ENVK, s.wyslij);
  const zly = await odp.json();
  assert.equal(zly.powod, 'blad-wysylki');
  assert.match(zly.blad, /401: Key not found/);
  assert.equal(s.rpc('poczta_kolejka_wynik')[0].tresc.p_ok, false);
  // Bez klucza Brevo – zaproszenie zostaje w kolejce, aplikacja podsuwa link do wysłania samemu.
  s = siecKolejki({ poczta_zaplanuj_zaproszenie: { tresc: { ok: true, id: 'k1', email: 'ola@przyklad.pl' } } });
  odp = await obsluzPoczte(zadanie(), { SITE_URL: 'https://makietka.app', SUPABASE_SERVICE_ROLE_KEY: 'x' }, s.wyslij);
  assert.deepEqual(await odp.json(), { wyslano: false, powod: 'brak-konfiguracji' });
  odp = await obsluzPoczte(zadanie({}), ENV, s.wyslij);
  assert.equal(odp.status, 401);
  s = siecKolejki({ poczta_zaplanuj_zaproszenie: { status: 400, tresc: { message: 'E-mail z tym zaproszeniem poszedł przed chwilą' } } });
  odp = await obsluzPoczte(zadanie(), ENVK, s.wyslij);
  assert.match((await odp.json()).blad, /przed chwilą/);
  assert.equal(s.maile().length, 0);
  odp = await obsluzPoczte(new Request('https://x', { method: 'OPTIONS' }), ENV, s.wyslij);
  assert.equal(odp.status, 204);
});

test('kolejka: odpowiedź z panelu z adresu skrzynki z In-Reply-To/References, potwierdzenie z formularza, test; odstęp między mailami; bez klucza serwisowego – nic', async () => {
  const { obsluzPoczte, przetworzKolejke } = await poczta();
  const ENVK = { ...ENV, SUPABASE_URL: 'https://baza.test', SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_xyz' }) };
  const wiadomosci = [
    { id: 'o1', rodzaj: 'odpowiedz', do_email: 'jan@przyklad.pl', do_nazwa: 'Jan', szablon: 'odpowiedz', temat: 'Re: Faktura',
      dane: { tresc: 'Dzień dobry,\n\nfaktura w załączniku.', cytat: 'Proszę o fakturę.', kiedy: '2026-11-15T09:00:00Z' },
      naglowki: { 'In-Reply-To': '<m1@przyklad.pl>', References: '<m1@przyklad.pl>', 'X-Obcy': 'nie' }, od_skrzynki: true },
    { id: 'k1', rodzaj: 'kontakt', do_email: 'gosc@przyklad.pl', szablon: 'kontakt', dane: { temat: 'Druk', tresc: 'Czy da się <b>A4</b>?' },
      odpowiedz_do: { email: 'kontakt@makietka.app' }, naglowki: {}, od_skrzynki: false },
    { id: 't1', rodzaj: 'test', do_email: 'admin@przyklad.pl', szablon: 'test', dane: {}, naglowki: {}, od_skrzynki: false },
  ];
  const s = siecKolejki({
    poczta_kolejka_pobierz: { tresc: { wiadomosci, odstep_ms: 250, nadawca: { email: 'no-reply@makietka.app', name: 'Makietka' }, skrzynka: { email: 'kontakt@makietka.app', name: 'Makietka' } } },
    poczta_kolejka_wynik: { tresc: null },
  });
  const przerwy = [];
  const w = await przetworzKolejke(ENVK, s.wyslij, { czekaj: async (ms) => { przerwy.push(ms); } });
  assert.deepEqual(w.wyslane, ['o1', 'k1', 't1']);
  assert.deepEqual(przerwy, [250, 250], 'odstęp z ustawień między mailami');
  assert.deepEqual(s.rpc('poczta_kolejka_pobierz')[0].o.headers, { apikey: 'sb_secret_xyz', 'content-type': 'application/json' }, 'nowy klucz sb_secret – tylko nagłówek apikey');
  const [odp, kontakt, test1] = s.maile();
  assert.deepEqual(odp.sender, { email: 'kontakt@makietka.app', name: 'Makietka' });
  assert.deepEqual(odp.to, [{ email: 'jan@przyklad.pl', name: 'Jan' }]);
  assert.deepEqual(odp.headers, { 'In-Reply-To': '<m1@przyklad.pl>', References: '<m1@przyklad.pl>' }, 'tylko nagłówki wątku');
  assert.equal(odp.subject, 'Re: Faktura');
  assert.match(odp.textContent, /faktura w załączniku\.[\s\S]*— Makietka[\s\S]*> Proszę o fakturę\./);
  assert.match(kontakt.subject, /dostaliśmy Twoją wiadomość: Druk/);
  assert.ok(kontakt.htmlContent.includes('Czy da się &lt;b&gt;A4&lt;/b&gt;?'));
  assert.deepEqual(kontakt.replyTo, { email: 'kontakt@makietka.app' });
  assert.match(test1.subject, /test poczty/);
  // Wynik zapisany z Message-ID dostawcy (wątki w skrzynce).
  assert.equal(s.rpc('poczta_kolejka_wynik').length, 3);
  // Przebieg zlecony z zewnątrz (Cron Workera) – bez tokenu.
  const s2 = siecKolejki({ poczta_kolejka_pobierz: { tresc: { wiadomosci: [], powod: null } } });
  const r = await obsluzPoczte(new Request('https://x', { method: 'POST', body: JSON.stringify({ kolejka: true }) }), ENVK, s2.wyslij);
  assert.deepEqual(await r.json(), { wyslane: 0, bledy: 0, powod: null });
  const bez = await przetworzKolejke({ BREVO_API_KEY: 'x' }, s2.wyslij);
  assert.equal(bez.powod, 'brak-klucza-serwisowego');
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
