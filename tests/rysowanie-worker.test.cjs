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
  assert.deepEqual(await ok.json(), { stan: 'w_kolejce' });
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
  assert.ok(w.wszystkie > 2 && w.wyslane === w.wszystkie, `strony narysowane (${w.wyslane}/${w.wszystkie})`);
  const opis = await (await env.PLIKI.get(`podglady/${folder}/manifest.json`)).json();
  assert.equal(opis.format, 'seriodruk-podglad');
  assert.equal(Object.keys(opis.skroty).length, w.wszystkie);
  assert.equal(env.PLIKI.m.get(`podglady/${folder}/manifest.json`).meta.cacheControl, 'no-cache');
  assert.ok(!env.PLIKI.m.has(`podglady/${folder}/s_stara.webp`), 'stare obrazy linku usunięte');
  assert.ok(env.PLIKI.m.has(`podglady/${UID}/p1/innylink00000000/manifest.json`), 'inne foldery nietknięte');
  assert.ok(!env.PLIKI.m.has(`zadania/${UID}/p1.json`), 'zlecenie usunięte po rysowaniu');
  assert.ok(postep.length > 0);
});
