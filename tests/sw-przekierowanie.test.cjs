// Service worker przy hostingu, który przekierowuje /index.html na / (Cloudflare, 22.11.2026): kolejne wejście na
// stronę musi się otworzyć z pamięci – odpowiedź po przekierowaniu dawała ERR_FAILED przy każdym powrocie.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const KORZEN = path.join(__dirname, '..');
const TYPY = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

test('service worker: /index.html przekierowane na / – powrót na stronę działa', async (t) => {
  const kodSw = process.env.SW_PLIK ? fs.readFileSync(process.env.SW_PLIK, 'utf8') : fs.readFileSync(path.join(KORZEN, 'sw.js'), 'utf8');
  const sw = kodSw.replace("const WERSJA = 'rozwoj';", "const WERSJA = 'v1';");
  const serwer = http.createServer((req, res) => {
    const sc = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (sc === '/sw.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); res.end(sw); return; }
    if (sc === '/index.html') { res.writeHead(307, { Location: '/' }); res.end(); return; } // jak Cloudflare
    const plik = path.join(KORZEN, sc === '/' ? 'index.html' : sc);
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
  const strona = await (await przegladarka.newContext()).newPage();
  await strona.goto(`${adres}#/projekty`);
  await strona.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 });
  for (const n of [1, 2]) {
    const odp = await strona.goto(`${adres}?n=${n}#/projekty`);
    assert.ok(odp === null || odp.ok(), `wejście ${n}`);
    assert.equal(await strona.title(), 'Makietka');
    assert.ok(await strona.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'strona z service workera');
  }
});

// Urządzenie z zepsutą wersją (ERR_FAILED): po wdrożeniu poprawki strona sama wraca – nowy service worker wchodzi
// od razu, bo żadne okno nie pracuje na starym.
test('service worker: zepsuta wersja naprawia się po wdrożeniu poprawki', async (t) => {
  const { execSync } = require('node:child_process');
  const stary = execSync('git show 5b91559:sw.js', { cwd: KORZEN, encoding: 'utf8' }).replace("const WERSJA = 'rozwoj';", "const WERSJA = 'v1';");
  const nowy = fs.readFileSync(path.join(KORZEN, 'sw.js'), 'utf8').replace("const WERSJA = 'rozwoj';", "const WERSJA = 'v2';");
  let sw = stary;
  const serwer = http.createServer((req, res) => {
    const sc = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (sc === '/sw.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); res.end(sw); return; }
    if (sc === '/index.html') { res.writeHead(307, { Location: '/' }); res.end(); return; }
    const plik = path.join(KORZEN, sc === '/' ? 'index.html' : sc);
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
  const kontekst = await przegladarka.newContext();
  let strona = await kontekst.newPage();
  await strona.goto(`${adres}#/projekty`);
  await strona.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 });
  await assert.rejects(strona.goto(`${adres}?n=1#/projekty`), /ERR_FAILED/, 'stara wersja – błąd jak na telefonie');
  await strona.close();
  sw = nowy; // wdrożenie poprawki
  const proby = [];
  for (let n = 2; n < 6; n += 1) {
    strona = await kontekst.newPage();
    const ok = await strona.goto(`${adres}?n=${n}#/projekty`).then(() => true, () => false);
    proby.push(ok);
    await strona.close();
    if (ok) break;
    await new Promise((r) => { setTimeout(r, 1500); });
  }
  assert.equal(proby.at(-1), true, `strona wraca po ${proby.length} próbach`);
  assert.ok(proby.length <= 2, `najpóźniej przy drugim wejściu (próby: ${proby.join(', ')})`);
});
