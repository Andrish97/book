// Pliki w Cloudflare R2 przez przekaźnik api.makietka.app (cloudflare/api-worker.js, decyzja #92):
// uprawnienia właściciela, współpracownika (edycja / odczyt) i obcego, limity, pamięć podręczna (ETag, 304),
// zakresy (Range), CORS, lista, usuwanie, miejsce i osierocone pliki. Bez Cloudflare – atrapa R2 i fetch.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WORKER = path.join(__dirname, '..', 'cloudflare', 'api-worker.js');

// Atrapa bindingu R2 (put/get/head/delete/list z zakresami i opisem HTTP).
class AtrapaR2 {
  constructor() { this.m = new Map(); }

  obiekt(o, zakres) {
    return {
      key: o.key,
      size: o.dane.length,
      uploaded: o.uploaded,
      httpEtag: o.etag,
      range: zakres,
      writeHttpMetadata(h) {
        if (o.httpMetadata.contentType) h.set('content-type', o.httpMetadata.contentType);
        if (o.httpMetadata.cacheControl) h.set('cache-control', o.httpMetadata.cacheControl);
      },
    };
  }

  async put(key, wartosc, opcje = {}) {
    const dane = Buffer.from(wartosc instanceof ArrayBuffer ? new Uint8Array(wartosc) : wartosc);
    const o = { key, dane, uploaded: new Date(), etag: `"${crypto.createHash('md5').update(dane).digest('hex')}"`, httpMetadata: opcje.httpMetadata || {} };
    this.m.set(key, o);
    return this.obiekt(o);
  }

  async head(key) { const o = this.m.get(key); return o ? this.obiekt(o) : null; }

  async get(key, { range } = {}) {
    const o = this.m.get(key);
    if (!o) return null;
    let dane = o.dane;
    if (range) {
      const od = range.offset ?? (o.dane.length - range.suffix);
      const dl = range.length ?? (o.dane.length - od);
      dane = o.dane.subarray(od, od + dl);
    }
    return { ...this.obiekt(o, range), body: new Uint8Array(dane) };
  }

  async delete(klucze) { for (const k of [].concat(klucze)) this.m.delete(k); }

  async list({ prefix = '', cursor, limit = 1000 } = {}) {
    const klucze = [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort();
    const od = cursor ? Number(cursor) : 0;
    const czesc = klucze.slice(od, od + Math.min(limit, 2)); // małe strony – sprawdzamy stronicowanie
    const truncated = od + czesc.length < klucze.length;
    return { objects: czesc.map((k) => this.obiekt(this.m.get(k))), truncated, cursor: truncated ? String(od + czesc.length) : undefined };
  }
}

const A = 'aaaaaaaa-0000-4000-8000-000000000001'; // właściciel
const B = 'bbbbbbbb-0000-4000-8000-000000000002'; // współpracownik z edycją
const C = 'cccccccc-0000-4000-8000-000000000003'; // współpracownik do odczytu
const D = 'dddddddd-0000-4000-8000-000000000004'; // obcy
const TOKENY = { tA: A, tB: B, tC: C, tD: D };
const P1 = '11111111-1111-4111-8111-111111111111';

test('pliki w R2: uprawnienia, limity, ETag, Range, CORS, lista, usuwanie, miejsce, osierocone', async (t) => {
  const { default: worker, LIMITY, wyczyscPamiec } = await import(pathToFileURL(WORKER).href);
  wyczyscPamiec();
  const env = { PLIKI: new AtrapaR2() };
  const rpc = [];
  const prawdziwyFetch = globalThis.fetch;
  globalThis.fetch = async (adres, opcje = {}) => {
    const u = new URL(typeof adres === 'string' ? adres : adres.url);
    const token = /Bearer (\S+)/.exec(opcje.headers?.authorization || '')?.[1];
    if (u.pathname === '/auth/v1/user') return TOKENY[token] ? Response.json({ id: TOKENY[token] }) : new Response('{}', { status: 401 });
    if (u.pathname === '/rest/v1/rpc/dostep_do_plikow') {
      const p = JSON.parse(opcje.body);
      rpc.push({ token, ...p });
      const rola = p.p_wlasciciel === A && p.p_projekt === P1 ? { [B]: 'edycja', [C]: 'odczyt' }[TOKENY[token]] : null;
      return Response.json(Boolean(rola) && (!p.p_zapis || rola === 'edycja'));
    }
    if (u.pathname === '/rest/v1/rpc/odwolania_plikow') return Response.json({ sciezki: [`${A}/${P1}/z1`], linki: [`${A}/${P1}/kodaktualny/`] });
    throw new Error(`nieoczekiwane zapytanie ${u}`);
  };
  t.after(() => { globalThis.fetch = prawdziwyFetch; });

  const zapytaj = (sciezka, { metoda = 'GET', token, tresc, naglowki = {} } = {}) => worker.fetch(new Request(`https://api.makietka.app${sciezka}`, {
    method: metoda, body: tresc, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...naglowki },
  }), env);
  const dane = (n, z = 1) => Buffer.alloc(n, z);

  // Właściciel: zapis, odczyt, opis HTTP, ETag i 304, zakres, HEAD.
  let r = await zapytaj(`/pliki/${A}/${P1}/z1`, { metoda: 'PUT', token: 'tA', tresc: dane(100, 7), naglowki: { 'content-type': 'image/png' } });
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal((await r.json()).rozmiar, 100);
  r = await zapytaj(`/pliki/${A}/${P1}/z1`, { token: 'tA' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.equal(r.headers.get('cache-control'), 'private, max-age=31536000, immutable', 'pliki projektu niezmienne – rok w pamięci');
  assert.equal((await r.arrayBuffer()).byteLength, 100);
  const etag = r.headers.get('etag');
  assert.ok(etag);
  assert.equal((await zapytaj(`/pliki/${A}/${P1}/z1`, { token: 'tA', naglowki: { 'if-none-match': etag } })).status, 304);
  r = await zapytaj(`/pliki/${A}/${P1}/z1`, { token: 'tA', naglowki: { range: 'bytes=10-19' } });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), 'bytes 10-19/100');
  assert.equal((await r.arrayBuffer()).byteLength, 10);
  r = await zapytaj(`/pliki/${A}/${P1}/z1`, { metoda: 'HEAD', token: 'tA' });
  assert.equal(r.headers.get('content-length'), '100');

  // Współpracownicy i obcy.
  assert.equal((await zapytaj(`/pliki/${A}/${P1}/z2`, { metoda: 'PUT', token: 'tB', tresc: dane(50) })).status, 200, 'edycja zapisuje w folderze właściciela');
  assert.equal((await zapytaj(`/pliki/${A}/${P1}/z3`, { metoda: 'PUT', token: 'tC', tresc: dane(50) })).status, 403, 'odczyt nie zapisuje');
  assert.equal((await zapytaj(`/pliki/${A}/${P1}/z1`, { token: 'tC' })).status, 200, 'odczyt czyta');
  assert.equal((await zapytaj(`/pliki/${A}/${P1}/z1`, { token: 'tD' })).status, 403, 'obcy nie czyta');
  assert.equal((await zapytaj(`/pliki/${A}/${P1}/z1`)).status, 401, 'bez logowania');
  assert.equal((await zapytaj(`/pliki/${A}/${P1}/z1`, { token: 'zly' })).status, 401, 'zły token');
  assert.equal((await zapytaj(`/pliki/${A}/_czcionki/moja.woff2`, { metoda: 'PUT', token: 'tA', tresc: dane(30) })).status, 200);
  assert.equal((await zapytaj(`/pliki/${A}/_czcionki/moja.woff2`, { token: 'tB' })).status, 403, '„Moje czcionki” tylko właściciel');
  assert.equal((await zapytaj(`/pliki/${A}/..%2F/x`, { token: 'tA' })).status, 400, 'ścieżka z „..”');
  assert.ok(rpc.every((x) => x.token !== 'tA'), 'właściciel bez pytania bazy');

  // Limity: jeden plik i całe konto (413 z kodem i komunikatem).
  const { plik, konto } = LIMITY;
  t.after(() => { LIMITY.plik = plik; LIMITY.konto = konto; });
  LIMITY.plik = 200;
  r = await zapytaj(`/pliki/${A}/${P1}/duzy`, { metoda: 'PUT', token: 'tA', tresc: dane(250) });
  assert.equal(r.status, 413);
  assert.equal((await r.json()).kod, 'limit_pliku');
  LIMITY.plik = plik;
  LIMITY.konto = 300; // zajęte: 100 + 50 + 30 = 180
  r = await zapytaj(`/pliki/${A}/${P1}/z4`, { metoda: 'PUT', token: 'tA', tresc: dane(150) });
  assert.equal(r.status, 413);
  const blad = await r.json();
  assert.equal(blad.kod, 'limit_konta');
  assert.match(blad.blad, /nie ma już miejsca/);
  assert.equal((await zapytaj(`/pliki/${A}/${P1}/z1`, { metoda: 'PUT', token: 'tA', tresc: dane(110) })).status, 200, 'podmiana liczy różnicę rozmiaru');
  LIMITY.konto = konto;

  // Obrazy stron linków: publiczny odczyt, zapis tylko właściciel.
  assert.equal((await zapytaj(`/podglady/${A}/${P1}/kodaktualny/s1.webp`, { metoda: 'PUT', token: 'tA', tresc: dane(40), naglowki: { 'content-type': 'image/webp', 'x-cache-control': 'public, max-age=31536000, immutable' } })).status, 200);
  assert.equal((await zapytaj(`/podglady/${A}/${P1}/starykod/s1.webp`, { metoda: 'PUT', token: 'tA', tresc: dane(40) })).status, 200);
  r = await zapytaj(`/podglady/${A}/${P1}/kodaktualny/s1.webp`);
  assert.equal(r.status, 200, 'link czyta każdy');
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal(r.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'pamięć z nagłówka wysyłającego');
  assert.equal((await zapytaj(`/podglady/${A}/${P1}/kodaktualny/s2.webp`, { metoda: 'PUT', token: 'tB', tresc: dane(10) })).status, 403);

  // CORS: aplikacja tak, obce strony nie (dla plików konta).
  r = await zapytaj(`/pliki/${A}/${P1}/z1`, { metoda: 'OPTIONS', naglowki: { origin: 'https://makietka.app', 'access-control-request-method': 'PUT' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://makietka.app');
  r = await zapytaj(`/pliki/${A}/${P1}/z1`, { token: 'tA', naglowki: { origin: 'https://obca.example' } });
  assert.equal(r.headers.get('access-control-allow-origin'), null);

  // Lista tylko z własnego folderu (ze stronicowaniem R2).
  r = await zapytaj(`/pliki/_lista?bucket=zasoby&prefiks=${A}/${P1}/`, { token: 'tA' });
  assert.deepEqual((await r.json()).map((x) => x.klucz).sort(), [`${A}/${P1}/z1`, `${A}/${P1}/z2`]);
  assert.equal((await zapytaj(`/pliki/_lista?bucket=zasoby&prefiks=${A}/`, { token: 'tB' })).status, 403);

  // Miejsce: konto (obrazy, czcionki, podglądy) wobec limitów.
  r = await zapytaj('/pliki/_miejsce', { token: 'tA' });
  const m = await r.json();
  assert.equal(m.obrazy, 160);
  assert.equal(m.czcionki, 30);
  assert.equal(m.podglady, 80);
  assert.equal(m.konto, 270);
  assert.equal(m.limit_konta, LIMITY.konto);
  assert.equal(m.limit_plikow, LIMITY.razem);
  assert.deepEqual(m.projekty[P1], { bajty: 160, plikow: 2, podglady: 80 }, 'rozbicie na projekty (czcionki konta poza projektami)');

  // Osierocone: stare pliki bez odwołań i obrazy dawnych linków; czcionki i świeże zostają.
  for (const o of env.PLIKI.m.values()) o.uploaded = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  await env.PLIKI.put(`zasoby/${A}/${P1}/swiezy`, dane(5));
  r = await zapytaj('/pliki/_osierocone', { token: 'tA' });
  assert.deepEqual((await r.json()).map((x) => `${x.bucket}:${x.nazwa}`).sort(), [`podglady:${A}/${P1}/starykod/s1.webp`, `zasoby:${A}/${P1}/z2`].sort());

  // Usuwanie: edycja może w projekcie, odczyt nie, cudzy folder – nie.
  r = await zapytaj('/pliki/_usun', { metoda: 'POST', token: 'tC', tresc: JSON.stringify({ bucket: 'zasoby', klucze: [`${A}/${P1}/z2`] }) });
  assert.deepEqual(await r.json(), { usuniete: 0, pominiete: 1 });
  r = await zapytaj('/pliki/_usun', { metoda: 'POST', token: 'tB', tresc: JSON.stringify({ bucket: 'zasoby', klucze: [`${A}/${P1}/z2`, `${A}/_czcionki/moja.woff2`] }) });
  assert.deepEqual(await r.json(), { usuniete: 1, pominiete: 1 });
  assert.equal(env.PLIKI.m.has(`zasoby/${A}/${P1}/z2`), false);
  assert.equal(env.PLIKI.m.has(`zasoby/${A}/_czcionki/moja.woff2`), true);
  r = await zapytaj('/pliki/_usun', { metoda: 'POST', token: 'tA', tresc: JSON.stringify({ bucket: 'podglady', klucze: [`${A}/${P1}/starykod/s1.webp`] }) });
  assert.equal((await r.json()).usuniete, 1);
  assert.equal((await zapytaj(`/pliki/${A}/${P1}/z1`, { metoda: 'DELETE', token: 'tA' })).status, 200);
  assert.equal((await zapytaj(`/pliki/${A}/${P1}/z1`, { token: 'tA' })).status, 404);

  // Bez podłączonego bucketu – czytelny błąd, nie wyjątek.
  r = await worker.fetch(new Request(`https://api.makietka.app/pliki/${A}/${P1}/z1`, { headers: { authorization: 'Bearer tA' } }), {});
  assert.equal(r.status, 503);
});

test('link z ochroną w R2 (#97): folder <kod>.<sekret> – plik tylko przy żywym linku, prywatna pamięć', async (t) => {
  const { default: worker, wyczyscPamiec } = await import(pathToFileURL(WORKER).href);
  wyczyscPamiec();
  const env = { PLIKI: new AtrapaR2() };
  let wazny = true;
  const zapytania = [];
  const prawdziwyFetch = globalThis.fetch;
  globalThis.fetch = async (adres, opcje = {}) => {
    const u = new URL(typeof adres === 'string' ? adres : adres.url);
    const token = /Bearer (\S+)/.exec(opcje.headers?.authorization || '')?.[1];
    if (u.pathname === '/auth/v1/user') return TOKENY[token] ? Response.json({ id: TOKENY[token] }) : new Response('{}', { status: 401 });
    if (u.pathname === '/rest/v1/rpc/link_chroniony_wazny') {
      const p = JSON.parse(opcje.body);
      zapytania.push(p);
      return Response.json(wazny && p.p_kod === 'kod0123456789abc' && p.p_sekret === 'Sekret_1');
    }
    throw new Error(`nieoczekiwane zapytanie ${u}`);
  };
  t.after(() => { globalThis.fetch = prawdziwyFetch; });
  const zapytaj = (sciezka, { metoda = 'GET', token, tresc } = {}) => worker.fetch(new Request(`https://api.makietka.app${sciezka}`, {
    method: metoda, body: tresc, headers: token ? { authorization: `Bearer ${token}` } : {},
  }), env);
  const folder = `/podglady/${A}/${P1}/kod0123456789abc.Sekret_1`;
  assert.equal((await zapytaj(`${folder}/s1.webp`, { metoda: 'PUT', token: 'tA', tresc: Buffer.alloc(30, 3) })).status, 200, 'właściciel wysyła');
  assert.equal((await zapytaj(`${folder}/s1.webp`, { metoda: 'PUT', token: 'tD', tresc: Buffer.alloc(30, 3) })).status, 403, 'obcy nie wysyła');
  let r = await zapytaj(`${folder}/s1.webp`);
  assert.equal(r.status, 200, 'gość z sekretem czyta');
  assert.match(r.headers.get('cache-control'), /^private/, 'bez pamięci współdzielonej');
  assert.equal((await zapytaj(`/podglady/${A}/${P1}/kod0123456789abc.Zgadywany/s1.webp`)).status, 404, 'zły sekret');
  // Wygasły albo unieważniony link – po upływie pamięci Workera (tu: wyczyszczona) plik przestaje być wydawany.
  wazny = false;
  wyczyscPamiec();
  assert.equal((await zapytaj(`${folder}/s1.webp`)).status, 404, 'link nieważny');
  assert.ok(zapytania.every((p) => p.p_konto === A && p.p_projekt === P1));
  // Zwykły link (folder bez kropki) nie pyta bazy.
  const ile = zapytania.length;
  await zapytaj(`/podglady/${A}/${P1}/kodpubliczny/s1.webp`, { metoda: 'PUT', token: 'tA', tresc: Buffer.alloc(10) });
  r = await zapytaj(`/podglady/${A}/${P1}/kodpubliczny/s1.webp`);
  assert.equal(r.status, 200);
  assert.equal(zapytania.length, ile);
});
