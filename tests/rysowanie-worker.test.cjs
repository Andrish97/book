// Rysowanie stron linku na serwerze – worker (#335, cloudflare/rysowanie.js): zabezpieczenia zlecenia, kolejka
// na projekt, dzienny limit i pełne rysowanie przez przeglądarkę (tu Playwright w roli przeglądarki Cloudflare).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const MODUL = pathToFileURL(path.join(__dirname, '..', 'cloudflare', 'rysowanie.js')).href;
const UID = '11111111-1111-4111-8111-111111111111';
const KOD = 'a1b2c3d4e5f60718293a4b5c';

// R2 w pamięci (get/put/delete/list/head jak binding).
function r2() {
  const m = new Map();
  const obiekt = (key, v) => ({ key, size: v.dane.length, httpMetadata: v.meta, json: async () => JSON.parse(Buffer.from(v.dane).toString()), text: async () => Buffer.from(v.dane).toString(), arrayBuffer: async () => Uint8Array.from(v.dane).buffer });
  return {
    m,
    async put(k, d, o = {}) { const dane = typeof d === 'string' ? Buffer.from(d) : Buffer.from(d); m.set(k, { dane, meta: o.httpMetadata || {} }); },
    async get(k) { const v = m.get(k); return v ? obiekt(k, v) : null; },
    async head(k) { const v = m.get(k); return v ? obiekt(k, v) : null; },
    async delete(k) { for (const x of [].concat(k)) m.delete(x); },
    async list({ prefix }) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; },
  };
}

// Durable Object w pamięci – jedna instancja na nazwę, alarm uruchamiany ręcznie w teście.
function kolejki(env, Klasa) {
  const instancje = new Map();
  return {
    idFromName: (n) => n,
    get: (n) => {
      if (!instancje.has(n)) {
        const dane = new Map();
        const state = { storage: { get: async (k) => dane.get(k), put: async (k, v) => { dane.set(k, JSON.parse(JSON.stringify(v))); }, delete: async (k) => dane.delete(k), setAlarm: async () => { state.alarm = true; } } };
        instancje.set(n, { obj: new Klasa(state, env), state });
      }
      const { obj } = instancje.get(n);
      return { fetch: (adres, init) => obj.fetch(new Request(adres, init)) };
    },
    instancje,
  };
}

const pomoc = (dostepTak = true) => ({
  json: (status, dane) => new Response(JSON.stringify(dane), { status, headers: { 'content-type': 'application/json' } }),
  naglowkiCors: () => ({}),
  tokenZZapytania: (z) => (z.headers.get('authorization') || '').replace(/^Bearer /, '') || null,
  uzytkownik: async (env, token) => (token === 'dobry' ? UID : null),
  dostep: async () => dostepTak,
  linkChronionyWazny: async (env, konto, projekt, folder) => folder.endsWith('.ab12cd34ef56ab12'),
});

test('rysowanie na serwerze: zabezpieczenia zlecenia i kolejka', async () => {
  const R = await import(MODUL);
  // Pomocnicze zasady.
  assert.ok(R.dozwolonyAdres('https://makietka.app/rysuj'), 'hosting przekierowuje /rysuj.html na /rysuj (307) – bez tego pliki na serwerze się nie robiły');
  assert.ok(!R.dozwolonyAdres('https://makietka.app/rysujx'));
  assert.ok(R.dozwolonyAdres('https://makietka.app/js/rysuj.js'));
  assert.ok(R.dozwolonyAdres('https://makietka.app/css/czcionki/inter.woff2'));
  assert.ok(R.dozwolonyAdres('data:image/png;base64,AAA'));
  assert.ok(!R.dozwolonyAdres('https://zly.example/x.png'), 'obce adresy zablokowane');
  assert.ok(!R.dozwolonyAdres('https://makietka.app/index.html'), 'tylko pliki potrzebne do rysowania');
  assert.ok(R.sprawdzFolder(`${UID}/p1/${KOD}`, UID, 'p1'));
  assert.equal(R.sprawdzFolder(`innyuid/p1/${KOD}`, UID, 'p1'), null, 'cudzy folder');
  assert.equal(R.sprawdzFolder(`${UID}/p2/${KOD}`, UID, 'p1'), null, 'inny projekt');
  assert.equal(R.sprawdzFolder(`${UID}/p1/../x`, UID, 'p1'), null);
  assert.deepEqual(R.sciezkiZasobow({ zasoby: { a: { sciezka: `${UID}/p1/a.png` }, b: { sciezka: `${UID}/p1/a.png` }, c: { sciezka: 'ai:123' }, d: {} } }), [`${UID}/p1/a.png`]);

  const env = { PLIKI: r2(), PRZEGLADARKA: {} };
  env.RYSOWANIE = kolejki(env, R.Rysowanie);
  const zlec = (cialo, token = 'dobry', pom = pomoc()) => R.obsluzRysowanie(new Request('https://api.makietka.app/rysuj/link', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(cialo) }), env, new URL('https://api.makietka.app/rysuj/link'), pom);
  const projekt = { id: 'p1', strony: [{ id: 's1' }], zasoby: { a: { sciezka: `${UID}/p1/a.png` } } };
  assert.equal((await zlec({ projekt, folder: `${UID}/p1/${KOD}` }, null)).status, 401, 'bez logowania');
  assert.equal((await zlec({ projekt, folder: `obcy/p1/${KOD}` })).status, 403, 'cudzy folder linku');
  assert.equal((await zlec({ projekt, folder: `${UID}/p1/${KOD}.zlysekret00000000` })).status, 403, 'nieaktualny link z hasłem');
  assert.equal((await zlec({ projekt, folder: `${UID}/p1/${KOD}` }, 'dobry', pomoc(false))).status, 403, 'brak dostępu do plików projektu');
  const ok = await zlec({ projekt, folder: `${UID}/p1/${KOD}` });
  assert.equal(ok.status, 202);
  const przyjete = await ok.json();
  assert.equal(przyjete.stan, 'w_kolejce');
  assert.match(przyjete.id, /^[0-9a-f-]{36}$/, 'numer zlecenia');
  assert.ok(env.PLIKI.m.has(`zadania/${UID}/p1.json`), 'zlecenie czeka w R2');
  const stan = await R.obsluzRysowanie(new Request('https://api.makietka.app/rysuj/stan?projekt=p1', { headers: { authorization: 'Bearer dobry' } }), env, new URL('https://api.makietka.app/rysuj/stan?projekt=p1'), pomoc());
  assert.equal((await stan.json()).stan, 'w_kolejce');
  // Brak przeglądarki w workerze – czytelna odpowiedź, nie błąd.
  const bez = await R.obsluzRysowanie(new Request('https://api.makietka.app/rysuj/link', { method: 'POST', headers: { authorization: 'Bearer dobry' }, body: '{}' }), { PLIKI: env.PLIKI }, new URL('https://api.makietka.app/rysuj/link'), pomoc());
  assert.equal(bez.status, 503);

  // Dzienny limit stron konta.
  const konto = env.RYSOWANIE.get(`konto:${UID}`);
  const licz = async (stron) => (await konto.fetch('https://kolejka/licznik', { method: 'POST', body: JSON.stringify({ stron }) })).json();
  assert.equal((await licz(R.LIMIT_STRON_DZIENNIE - 10)).ok, true);
  assert.equal((await licz(20)).ok, false, 'ponad dzienny limit');
  assert.equal((await licz(10)).ok, true);
});

// Przeglądarka Cloudflare (puppeteer) zastąpiona Playwrightem – ten sam zestaw wywołań, którego używa rysujLink.
function puppeteerZPlaywright(przegladarka) {
  return {
    launch: async () => {
      const kontekst = await przegladarka.newContext();
      return {
        newPage: async () => {
          const page = await kontekst.newPage();
          let sluchacz = null;
          const zablokowane = [];
          await page.route('**/*', (r) => {
            const zapytanie = { url: () => r.request().url(), continue: () => r.continue(), abort: () => { zablokowane.push(r.request().url()); return r.abort(); } };
            return sluchacz ? sluchacz(zapytanie) : r.continue();
          });
          return {
            zablokowane,
            setRequestInterception: async () => {},
            on: (zd, fn) => { if (zd === 'request') sluchacz = fn; },
            exposeFunction: (n, fn) => page.exposeFunction(n, fn),
            goto: (u, o) => page.goto(u, { waitUntil: 'load', timeout: o?.timeout }),
            waitForFunction: (f, o) => page.waitForFunction(f, null, o),
            evaluate: (fn, a) => page.evaluate(fn, a),
          };
        },
        close: () => kontekst.close(),
      };
    },
  };
}

test('rysowanie na serwerze: pełne rysowanie linku do R2, tylko folder linku, ruch zamknięty', async (t) => {
  const R = await import(MODUL);
  const { strona, przegladarka, adres } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  const projekt = await strona.evaluate(async () => {
    const { zbudujProjekt } = await import('./js/szablony-projektow.js');
    const P = await import('./js/projekt.js');
    const p = P.normalizuj(await zbudujProjekt('ksiazka-miekka', { nazwa: 'Na serwerze' }));
    p.id = 'p1';
    // obraz spoza aplikacji – przeglądarka rysująca nie może go pobrać
    p.strony[0].obiekty.push({ type: 'image', id: 'o_zly', src: 'https://zly.example/sledzenie.png', left: 0, top: 0, width: 10, height: 10 });
    return JSON.parse(JSON.stringify(p));
  });
  const env = { PLIKI: r2(), PRZEGLADARKA: {}, APLIKACJA: adres.replace(/\/$/, ''), __puppeteer: puppeteerZPlaywright(przegladarka) };
  const folder = `${UID}/p1/${KOD}`;
  // śmieć z poprzedniej wersji linku w folderze i plik innego linku obok – pierwszy znika, drugi zostaje
  await env.PLIKI.put(`podglady/${folder}/s_stara.webp`, 'x');
  await env.PLIKI.put(`podglady/${UID}/p1/innylink00000000/manifest.json`, '{}');
  await env.PLIKI.put(`zadania/${UID}/p1.json`, JSON.stringify({ projekt, folder, chroniony: false, pelna: false, sciezki: [], uid: UID }));
  const postep = [];
  const w = await R.rysujLink(env, `zadania/${UID}/p1.json`, (i, n) => postep.push([i, n]));
  const opis = await (await env.PLIKI.get(`podglady/${folder}/manifest.json`)).json();
  // Pliki według treści (#438, A2): takie same strony – jeden plik.
  assert.ok(w.wszystkie > 2 && w.wyslane === new Set(Object.values(opis.pliki)).size, `strony narysowane (${w.wyslane}/${w.wszystkie})`);
  for (const n of new Set(Object.values(opis.pliki))) assert.ok(env.PLIKI.m.has(`podglady/${folder}/${n}.${opis.rozszerzenie}`), n);
  assert.equal(opis.format, 'seriodruk-podglad');
  assert.equal(Object.keys(opis.skroty).length, w.wszystkie);
  assert.equal(env.PLIKI.m.get(`podglady/${folder}/manifest.json`).meta.cacheControl, 'no-cache');
  assert.ok(!env.PLIKI.m.has(`podglady/${folder}/s_stara.webp`), 'stare obrazy linku usunięte');
  assert.ok(env.PLIKI.m.has(`podglady/${UID}/p1/innylink00000000/manifest.json`), 'inne foldery nietknięte');
  assert.ok(!env.PLIKI.m.has(`zadania/${UID}/p1.json`), 'zlecenie usunięte po rysowaniu');
  assert.ok(postep.length > 0);
});

// #337: eksport zlecony przez AI na serwerze – cron przejmuje zaległe zlecenie, przeglądarka robi PDF tym samym
// kodem co aplikacja, plik trafia do folderu _eksporty właściciela, zlecenie się zamyka.
test('eksport dla AI na serwerze: PDF z projektu z bazy, plik w _eksporty, zlecenie zamknięte', async (t) => {
  const R = await import(MODUL);
  const { strona, przegladarka, adres } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  const PROJ = '22222222-2222-4222-8222-222222222222';
  const projekt = await strona.evaluate(async (id) => {
    const { zbudujProjekt } = await import('./js/szablony-projektow.js');
    const P = await import('./js/projekt.js');
    const p = P.normalizuj(await zbudujProjekt('ksiazka-miekka', { nazwa: 'Eksport z serwera' }));
    p.id = id;
    return JSON.parse(JSON.stringify(p));
  }, PROJ);
  const wywolania = [];
  const prawdziwy = globalThis.fetch;
  globalThis.fetch = async (adresZ, opcje) => {
    const u = String(adresZ);
    if (u.startsWith('https://baza.test/rest/v1/rpc/')) {
      const nazwa = u.split('/').pop();
      const cialo = JSON.parse(opcje.body);
      wywolania.push([nazwa, cialo, opcje.headers]);
      const dane = nazwa === 'serwer_przyjmij_eksporty' ? [{ id: 'e1', projekt_id: PROJ, wlasciciel: UID, rodzaj: 'pdf', ustawienia: { przeznaczenie: 'ekran' } }]
        : nazwa === 'serwer_projekt' ? projekt : { stan: cialo.p_blad ? 'blad' : 'gotowe' };
      return new Response(JSON.stringify(dane), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return prawdziwy(adresZ, opcje);
  };
  t.after(() => { globalThis.fetch = prawdziwy; });
  const env = { PLIKI: r2(), PRZEGLADARKA: {}, APLIKACJA: adres.replace(/\/$/, ''), SUPABASE_URL: 'https://baza.test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', __puppeteer: puppeteerZPlaywright(przegladarka) };
  env.RYSOWANIE = kolejki(env, R.Rysowanie);
  assert.equal(await R.przebiegEksportow(env), 1, 'jedno zlecenie przejęte');
  const obiekt = env.RYSOWANIE.instancje.get('eksport:e1');
  assert.ok(obiekt?.state.alarm, 'zlecenie w osobnym obiekcie z alarmem');
  await obiekt.obj.alarm();
  const plik = env.PLIKI.m.get(`zasoby/${UID}/_eksporty/e1.pdf`);
  assert.ok(plik, 'plik w folderze _eksporty właściciela');
  assert.equal(Buffer.from(plik.dane).subarray(0, 5).toString(), '%PDF-');
  const koniec = wywolania.find(([n]) => n === 'serwer_zakoncz_eksport');
  assert.equal(koniec[1].p_blad, null, `bez błędu: ${koniec[1].p_blad}`);
  assert.equal(koniec[1].p_plik, `${UID}/_eksporty/e1.pdf`);
  assert.ok(koniec[1].p_strony > 0 && /\.pdf$/.test(koniec[1].p_nazwa));
  assert.deepEqual(koniec[2], { apikey: 'sb_secret_test', 'content-type': 'application/json' }, 'klucz serwisowy tylko w nagłówku apikey');
});

// #338: PDF z okna „Eksportuj do PDF” na serwerze – zlecenie z projektem i opcjami, kolejka, plik na koncie.
test('PDF dużego projektu na serwerze: zlecenie, kolejka, plik na koncie zlecającego', async (t) => {
  const R = await import(MODUL);
  const { strona, przegladarka, adres } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  const projekt = await strona.evaluate(async () => {
    const { zbudujProjekt } = await import('./js/szablony-projektow.js');
    const P = await import('./js/projekt.js');
    const p = P.normalizuj(await zbudujProjekt('ksiazka-miekka', { nazwa: 'PDF z serwera' }));
    p.id = 'p1';
    return JSON.parse(JSON.stringify(p));
  });
  const env = { PLIKI: r2(), PRZEGLADARKA: {}, APLIKACJA: adres.replace(/\/$/, ''), __puppeteer: puppeteerZPlaywright(przegladarka) };
  env.RYSOWANIE = kolejki(env, R.Rysowanie);
  const opcje = { zakres: 'wszystko', tryb: 'wektor', spad: false, znaki: false, podzial: 'jeden', uklad: 'zwykly', dpi: 150, profilWlasny: { dane: 'nie wolno' } };
  const odp = await R.obsluzRysowanie(new Request('https://api.makietka.app/rysuj/pdf', { method: 'POST', headers: { authorization: 'Bearer dobry' }, body: JSON.stringify({ projekt, opcje }) }), env, new URL('https://api.makietka.app/rysuj/pdf'), pomoc());
  assert.equal(odp.status, 202);
  const zlecenie = await (await env.PLIKI.get(`zadania/${UID}/p1.pdf.json`)).json();
  assert.equal(zlecenie.opcje.profilWlasny, null, 'bez własnego profilu ICC z urządzenia');
  const kolejka = env.RYSOWANIE.instancje.get(`pdf:${UID}:p1`);
  assert.ok(kolejka?.state.alarm, 'osobna kolejka PDF projektu');
  await kolejka.obj.alarm();
  const stan = await (await R.obsluzRysowanie(new Request('https://api.makietka.app/rysuj/stan?projekt=p1&rodzaj=pdf', { headers: { authorization: 'Bearer dobry' } }), env, new URL('https://api.makietka.app/rysuj/stan?projekt=p1&rodzaj=pdf'), pomoc())).json();
  assert.equal(stan.stan, 'gotowe', `stan: ${JSON.stringify(stan)}`);
  assert.equal(stan.plik, R.plikPdfSerwera(UID, 'p1'));
  const plik = env.PLIKI.m.get(`zasoby/${stan.plik}`);
  assert.equal(Buffer.from(plik.dane).subarray(0, 5).toString(), '%PDF-');
  assert.ok(!env.PLIKI.m.has(`zadania/${UID}/p1.pdf.json`), 'zlecenie usunięte');
});

// #340: zużycie przeglądarki serwera – zapis po każdym zleceniu, odczyt tylko dla administratora.
test('zużycie serwera: zapis czasu i stron, podgląd tylko dla administratora', async () => {
  const R = await import(MODUL);
  const env = { PLIKI: r2(), PRZEGLADARKA: {} };
  env.RYSOWANIE = kolejki(env, R.Rysowanie);
  const stat = env.RYSOWANIE.get('statystyki');
  await stat.fetch('https://kolejka/zapisz', { method: 'POST', body: JSON.stringify({ ms: 90000, stron: 120, rodzaj: 'link' }) });
  await stat.fetch('https://kolejka/zapisz', { method: 'POST', body: JSON.stringify({ ms: 30000, stron: 10, rodzaj: 'pdf' }) });
  const zapytaj = (admin) => R.obsluzRysowanie(new Request('https://api.makietka.app/rysuj/zuzycie', { headers: { authorization: 'Bearer dobry' } }), env, new URL('https://api.makietka.app/rysuj/zuzycie'), { ...pomoc(), rpc: async (e, tok, f) => (f === 'czy_administrator' ? admin : null) });
  assert.equal((await zapytaj(false)).status, 403, 'zwykłe konto nie widzi zużycia');
  const w = await (await zapytaj(true)).json();
  assert.equal(w.dni.length, 31);
  assert.deepEqual([w.miesiac.ms, w.miesiac.stron, w.miesiac.zlecen], [120000, 130, 2]);
  assert.equal(w.planGodzin, 10);
  assert.deepEqual(w.dni.at(-1).rodzaje, { link: 1, pdf: 1 });
});

// #436: usługa składu dla łącznika MCP – klucz AI sprawdza baza (serwer_klucz_ai), przeglądarka przelewa wątek tym samym
// kodem co edytor (wynik = moduł przelewania w aplikacji), podaje wysokości, opis strony, podgląd PNG i pełne sprawdzenie.
test('usługa składu dla MCP: klucz AI, przelanie wątku jak w aplikacji, opis, podgląd, sprawdzenie', async (t) => {
  const R = await import(MODUL);
  const { strona, przegladarka, adres } = await otworz(t);
  await nowyProjekt(strona, 'Skład');
  const PROJ = '33333333-3333-4333-8333-333333333333';
  const { projekt, oczekiwane } = await strona.evaluate(async (id) => {
    const { stan, edytor: e } = window.seriodruk;
    const { nowaStrona } = await import('./js/projekt.js');
    const { zapiszBiezacyCel } = await import('./js/app/zapis.js');
    const { przelejWatek } = await import('./js/przelewanie.js');
    const o = e.dodajTekst(Array.from({ length: 12 }, (_, i) => `Hasło${i} Dz 1:${i}\nDobra nowina o zbawieniu przez Jezusa Chrystusa; także nazwa czterech ksiąg.`).join('\n'));
    o.set({ id: 'r0', left: 15, top: 20, width: 60, fontSize: 3, ramka_h: 45, wdowy: 3, lamanie_akapitu: true });
    const naglowek = e.dodajTekst('Słowniczek');
    naglowek.set({ id: 'nag', left: 15, top: 8, width: 80 });
    e.zatwierdz?.();
    zapiszBiezacyCel();
    const p = JSON.parse(JSON.stringify(stan.projekt));
    p.id = id;
    const r0 = p.strony[0].obiekty.find((x) => x.id === 'r0');
    Object.assign(r0, { watek: 'w1', watek_nr: 0 });
    const s2 = nowaStrona('Strona 2', p.strony[0].sekcja);
    s2.obiekty = [{ ...JSON.parse(JSON.stringify(r0)), id: 'r1', text: '', styles: [], watek_nr: 1, lacznik: '\n' }];
    p.strony.push(s2);
    const kopia = JSON.parse(JSON.stringify(p));
    await przelejWatek(kopia, 'w1');
    return { projekt: p, oczekiwane: kopia.strony.flatMap((s) => s.obiekty.filter((x) => x.watek === 'w1')).map((x) => [x.id, x.text, x.lacznik ?? null]) };
  }, PROJ);
  const wywolania = [];
  const prawdziwy = globalThis.fetch;
  globalThis.fetch = async (adresZ, opcje) => {
    const u = String(adresZ);
    if (u.startsWith('https://baza.test/rest/v1/rpc/')) {
      const nazwa = u.split('/').pop();
      const cialo = JSON.parse(opcje.body);
      wywolania.push([nazwa, cialo]);
      const dane = nazwa === 'serwer_klucz_ai' ? (cialo.p_klucz === 'sdk_dobry' ? { owner_id: UID, projekt_id: PROJ, rola: 'edycja' } : { blad: 'Zły klucz.' })
        : nazwa === 'serwer_projekt' ? projekt : null;
      return new Response(JSON.stringify(dane), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return prawdziwy(adresZ, opcje);
  };
  t.after(() => { globalThis.fetch = prawdziwy; });
  const env = { PLIKI: r2(), PRZEGLADARKA: {}, APLIKACJA: adres.replace(/\/$/, ''), SUPABASE_URL: 'https://baza.test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', __puppeteer: puppeteerZPlaywright(przegladarka) };
  env.RYSOWANIE = kolejki(env, R.Rysowanie);
  // Zły klucz – bez przeglądarki.
  const zly = await R.skladajDlaAi(env, { klucz: 'sdk_zly', projektId: PROJ, dzialania: [{ rodzaj: 'przelej' }] });
  assert.equal(zly.status, 403);
  const w = await R.skladajDlaAi(env, {
    klucz: 'sdk_dobry', projektId: PROJ, projekt,
    dzialania: [{ rodzaj: 'przelej' }, { rodzaj: 'wysokosci' }, { rodzaj: 'opis', strona: projekt.strony[1].id }, { rodzaj: 'podglad', strona: projekt.strony[0].id, szerokosc: 400 }, { rodzaj: 'sprawdz' }],
  });
  assert.equal(w.status, 200, JSON.stringify(w.dane).slice(0, 300));
  const { przelej, opis, podglad, sprawdz, wysokosci } = w.dane;
  // Przelanie identyczne jak moduł w aplikacji.
  const czesci = Object.fromEntries(przelej[0].zmiany.map((z) => [z.id, [z.id, z.pola.text, z.pola.lacznik ?? null]]));
  assert.deepEqual(w.dane.przelej[0].watek, 'w1');
  for (const [id, text, lacznik] of oczekiwane) assert.deepEqual(czesci[id] || [id, projekt.strony.flatMap((s) => s.obiekty).find((x) => x.id === id).text, lacznik], [id, text, lacznik], `ramka ${id} jak w aplikacji`);
  assert.match(przelej[0].opis, /Wątek w1: 2 ramek\./);
  assert.ok(opis.length === 1 && opis[0].id === 'r1' && opis[0].wierszy > 0 && opis[0].watek === 'w1', JSON.stringify(opis));
  assert.ok(Buffer.from(podglad.b64, 'base64').subarray(1, 4).toString() === 'PNG' && podglad.szerokosc === 400);
  assert.ok(Array.isArray(sprawdz) && Array.isArray(wysokosci));
  assert.ok(wywolania.some(([n, c]) => n === 'serwer_klucz_ai' && c.p_klucz === 'sdk_dobry' && c.p_projekt === PROJ));
});

// #438, etap D: praca linku z kolejki konta, której żadna karta nie wzięła – serwer (cron) bierze ją z bazy,
// rysuje z ustawieniami tego linku (znak wodny) i kończy wersją; nowsza wersja w trakcie – przerywa po bieżącej
// stronie, opis linku ma gotowe strony, praca wraca do kolejki (wersja niewykonana).
test('praca z kolejki na serwerze: projekt z bazy, ustawienia linku, koniec wersją; nowsza wersja – przerwanie', async (t) => {
  const R = await import(MODUL);
  const { strona, przegladarka, adres } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  const PROJ = '33333333-3333-4333-8333-333333333333';
  const projekt = await strona.evaluate(async ({ id, kod }) => {
    const P = await import('./js/projekt.js');
    const p = P.normalizuj(window.seriodruk.stan.projekt);
    for (let i = 2; i <= 5; i += 1) p.strony.push(P.nowaStrona(`S${i}`, p.sekcje[0].id));
    p.strony.forEach((s, i) => { s.obiekty = [{ type: 'textbox', id: `t${i}`, left: 10, top: 10, width: 80, text: `Strona ${i + 1}`, fontFamily: 'Inter', fontSize: 8 }]; });
    p.id = id;
    p.udostepnienia = [{ kod, konto: 'k', znak_wodny: { tekst: 'SERWER', krycie: 30 } }];
    return JSON.parse(JSON.stringify(p));
  }, { id: PROJ, kod: KOD });
  const wywolania = [];
  let odnowienie = () => ({ wersja: 7 });
  const prawdziwy = globalThis.fetch;
  globalThis.fetch = async (adresZ, opcje) => {
    const u = String(adresZ);
    if (u.startsWith('https://baza.test/rest/v1/rpc/')) {
      const nazwa = u.split('/').pop();
      const cialo = JSON.parse(opcje.body);
      wywolania.push([nazwa, cialo]);
      const dane = nazwa === 'serwer_przejmij_prace' ? [{ id: 'w1', projekt_id: PROJ, wlasciciel: UID, cel: KOD, wersja: 7, folder: `${UID}/${PROJ}/${KOD}`, chroniony: false }]
        : nazwa === 'serwer_projekt' ? projekt : nazwa === 'serwer_odnow_prace' ? odnowienie() : { stan: 'gotowe' };
      return new Response(JSON.stringify(dane), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return prawdziwy(adresZ, opcje);
  };
  t.after(() => { globalThis.fetch = prawdziwy; });
  const env = { PLIKI: r2(), PRZEGLADARKA: {}, APLIKACJA: adres.replace(/\/$/, ''), SUPABASE_URL: 'https://baza.test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', __puppeteer: puppeteerZPlaywright(przegladarka), __odnowienieMs: 0 };
  env.RYSOWANIE = kolejki(env, R.Rysowanie);
  assert.equal(await R.przebiegPrac(env), 1);
  const obiekt = env.RYSOWANIE.instancje.get('praca:w1');
  assert.ok(obiekt?.state.alarm, 'praca w osobnym obiekcie z alarmem');
  await obiekt.obj.alarm();
  const folder = `podglady/${UID}/${PROJ}/${KOD}`;
  const opis = await (await env.PLIKI.get(`${folder}/manifest.json`)).json();
  assert.equal(Object.keys(opis.pliki).length, 5);
  assert.equal(opis.przygotowanie, undefined);
  const koniec = wywolania.filter(([n]) => n === 'serwer_zakoncz_prace');
  assert.deepEqual(koniec.map(([, c]) => [c.p_wersja, c.p_blad]), [[7, null]], 'koniec wersją pracy');
  assert.ok(wywolania.some(([n]) => n === 'serwer_odnow_prace'), 'dzierżawa odnawiana');
  assert.ok(![...env.PLIKI.m.keys()].some((k) => k.startsWith('zadania/')), 'zlecenie sprzątnięte');
  // Pliki stron leżą w folderze linku.
  const plik = env.PLIKI.m.get(`${folder}/${opis.pliki[Object.keys(opis.pliki)[0]]}.${opis.rozszerzenie}`);
  assert.ok(plik && plik.dane.length > 0);
  // 2) Nowsza wersja w trakcie: przerwanie, opis z gotowymi stronami, wersja niewykonana.
  projekt.strony.forEach((s, i) => { s.obiekty[0].text = `Nowa ${i + 1}`; });
  odnowienie = () => ({ wersja: 8 });
  wywolania.length = 0;
  const w = await R.wykonajPrace(env, { id: 'w1', projekt_id: PROJ, wlasciciel: UID, cel: KOD, wersja: 7, folder: `${UID}/${PROJ}/${KOD}`, chroniony: false });
  assert.equal(w.nowsza, true);
  assert.equal(w.wynik.przerwane, true, JSON.stringify(w));
  const opis2 = await (await env.PLIKI.get(`${folder}/manifest.json`)).json();
  assert.equal(Object.keys(opis2.pliki).length, 5, 'link dalej pokazuje wszystkie strony (poprzednią wersję tych nienarysowanych)');
  assert.equal(w.wynik.narysowane, 0, 'przerwane przed pierwszą stroną – nic nie narysowane');
  assert.deepEqual(wywolania.filter(([n]) => n === 'serwer_zakoncz_prace').map(([, c]) => c.p_wersja), [0], 'wersja niewykonana – praca wraca do kolejki');
  // 3) Pracę odebrała karta: serwer nie zamyka pracy.
  odnowienie = () => null;
  wywolania.length = 0;
  const w3 = await R.wykonajPrace(env, { id: 'w1', projekt_id: PROJ, wlasciciel: UID, cel: KOD, wersja: 7, folder: `${UID}/${PROJ}/${KOD}`, chroniony: false });
  assert.equal(w3.utracona, true);
  assert.equal(wywolania.filter(([n]) => n === 'serwer_zakoncz_prace').length, 0);
});
