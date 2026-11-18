// Nowa wersja aplikacji bez ręcznego odświeżania (#197): service worker z wersją (jak po wdrożeniu) –
// na liście projektów nowa wersja włącza się sama, w otwartym projekcie – gdy karta schowa się w tle
// (projekt otwiera się potem z adresu), a do tego czasu jest „Odśwież teraz”.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { podlaczAtrape, zaloguj, nowyProjekt } = require('./pomoc.cjs');

const KORZEN = path.join(__dirname, '..');
const TYPY = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

test('nowa wersja: sama na liście projektów, w projekcie po schowaniu karty', async (t) => {
  let wersja = 'v1';
  const sw = () => fs.readFileSync(path.join(KORZEN, 'sw.js'), 'utf8').replace("const WERSJA = 'rozwoj';", `const WERSJA = '${wersja}';`);
  const serwer = http.createServer((req, res) => {
    const sc = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (sc === '/sw.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); res.end(sw()); return; }
    let plik = path.join(KORZEN, sc === '/' ? 'index.html' : sc);
    fs.readFile(plik, (b, d) => {
      if (b) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPY[path.extname(plik)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(d);
    });
  });
  await new Promise((ok) => { serwer.listen(0, 'localhost', ok); });
  const adres = `http://localhost:${serwer.address().port}/`;
  const przegladarka = await chromium.launch();
  t.after(async () => { await przegladarka.close(); serwer.close(); });
  const kontekst = await przegladarka.newContext({ locale: 'pl-PL', viewport: { width: 1280, height: 800 }, serviceWorkers: 'allow' });
  const baza = await podlaczAtrape(kontekst);
  const strona = await kontekst.newPage();
  const bledy = [];
  strona.on('pageerror', (e) => bledy.push(e.message));
  await strona.goto(adres);
  await strona.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(async () => { await strona.reload(); });
  await strona.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 });
  await zaloguj(strona, baza);
  const aktywna = () => strona.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r.active?.scriptURL && (await caches.keys()).filter((k) => k.startsWith('seriodruk-kod-')).join(','); });
  assert.match(await aktywna(), /seriodruk-kod-v1/);

  // 1. Lista projektów: nowa wersja po powrocie do karty – strona przeładowuje się sama.
  wersja = 'v2';
  await strona.evaluate(() => { window.__przed = true; });
  // (sprawdzanie przy powrocie do karty ma 30 s przerwy – tu prosimy o sprawdzenie wprost)
  await strona.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await strona.waitForFunction(() => !window.__przed, null, { timeout: 30000 }).catch(() => {});
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty', null, { timeout: 30000 });
  await strona.waitForFunction(async () => (await caches.keys()).includes('seriodruk-kod-v2') && !(await caches.keys()).includes('seriodruk-kod-v1'), null, { timeout: 30000, polling: 500 }).catch(() => {});
  const klucze = await strona.evaluate(() => caches.keys());
  assert.ok(klucze.includes('seriodruk-kod-v2') && !klucze.includes('seriodruk-kod-v1'), `pamięć nowej wersji: ${klucze}`);
  assert.equal(await strona.evaluate(() => window.__przed), undefined, 'strona przeładowała się sama');

  // 2. Otwarty projekt: nowa wersja czeka (powiadomienie), włącza się po schowaniu karty.
  await nowyProjekt(strona, 'W trakcie pracy');
  const idProjektu = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  wersja = 'v3';
  await strona.evaluate(async () => { window.__przed = true; await (await navigator.serviceWorker.getRegistration()).update(); });
  await strona.waitForFunction(() => /Jest nowa wersja aplikacji/.test(document.body.textContent), null, { timeout: 30000 });
  assert.equal(await strona.evaluate(() => window.__przed), true, 'w projekcie nie przeładowuje się bez pytania');
  await strona.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await strona.waitForFunction(() => !window.__przed && window.seriodruk?.stan?.projekt, null, { timeout: 30000 });
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.id), idProjektu, 'po przeładowaniu ten sam projekt');
  assert.ok((await strona.evaluate(() => caches.keys())).includes('seriodruk-kod-v3'));
  assert.deepEqual(bledy, []);
});
