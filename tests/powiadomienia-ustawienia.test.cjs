// Ustawienia konta → Powiadomienia (decyzja #113): zgoda przeglądarki dopiero po kliknięciu, zapis urządzenia
// z rodzajami, zmiana rodzajów, wysyłka zaraz po zmianie we współpracy, wyłączenie; iPhone bez instalacji
// i powiadomienia zablokowane w przeglądarce. Service worker, PushManager i Notification są tu atrapami.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

const KLUCZ = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';

// Atrapa przeglądarki z powiadomieniami: { zgoda: 'default' | 'denied', push: true/false }.
function atrapaPush({ zgoda = 'default', push = true } = {}) {
  return `(() => {
    window.__zgoda = 0;
    window.Notification = class { static permission = ${JSON.stringify(zgoda)};
      static async requestPermission() { window.__zgoda += 1; window.Notification.permission = 'granted'; return 'granted'; } };
    if (${push}) window.PushManager = class {}; else delete window.PushManager;
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/test-urzadzenie', options: { applicationServerKey: null },
      toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'A'.repeat(22) } }; },
      async unsubscribe() { window.__sub = null; return true; } };
    const reg = { pushManager: {
      getSubscription: async () => window.__sub || null,
      subscribe: async (o) => { window.__klucz = Array.from(o.applicationServerKey); sub.options.applicationServerKey = o.applicationServerKey.buffer; window.__sub = sub; return sub; },
    } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg), addEventListener() {}, controller: null } });
  })();`;
}

async function przygotuj(t, opcje = {}, atrapa = {}) {
  const o = await otworz(t, opcje);
  const { strona, kontekst } = o;
  const baza = { urzadzenie: null, rpc: [], funkcja: [] };
  await kontekst.addInitScript(atrapaPush(atrapa));
  await kontekst.route('**/functions/v1/powiadomienia', async (r) => {
    const tresc = JSON.parse(r.request().postData() || '{}');
    baza.funkcja.push(tresc);
    await r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(tresc.klucz ? { klucz: KLUCZ } : { zdarzenia: 0 }) });
  });
  await kontekst.route('**/rest/v1/rpc/push_*', async (r) => {
    const nazwa = r.request().url().split('/rpc/')[1];
    const p = JSON.parse(r.request().postData() || '{}');
    baza.rpc.push({ nazwa, p });
    let wynik = null;
    if (nazwa === 'push_zapisz_urzadzenie') { baza.urzadzenie = { endpoint: p.p_endpoint, rodzaje: p.p_rodzaje }; wynik = { wlaczone: true, rodzaje: p.p_rodzaje }; }
    if (nazwa === 'push_usun_urzadzenie') baza.urzadzenie = null;
    if (nazwa === 'push_urzadzenie') wynik = baza.urzadzenie?.endpoint === p.p_endpoint ? { wlaczone: true, rodzaje: baza.urzadzenie.rodzaje } : { wlaczone: false, rodzaje: [] };
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify(wynik) });
  });
  baza.maile = { zaproszenia: true, zapisy: [] };
  await kontekst.route('**/rest/v1/rpc/*ustawienia_maili', async (r) => {
    if (r.request().url().endsWith('/zapisz_ustawienia_maili')) {
      const p = JSON.parse(r.request().postData() || '{}');
      baza.maile.zapisy.push(p);
      baza.maile.zaproszenia = p.p_zaproszenia;
    }
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ zaproszenia: baza.maile.zaproszenia }) });
  });
  await strona.reload();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await strona.evaluate(() => { location.hash = '#/konto/powiadomienia'; });
  await strona.waitForSelector('#ust-powiadomienia.wybrana');
  return { ...o, push: baza };
}

test('powiadomienia: zgoda po kliknięciu, urządzenie z rodzajami, wysyłka po zmianie we współpracy, wyłączenie', async (t) => {
  const { strona, bledy, push } = await przygotuj(t);
  await strona.waitForFunction(() => document.querySelector('#powiadomienia-stan').textContent === 'Wyłączone na tym urządzeniu');
  assert.equal(await strona.evaluate(() => window.__zgoda), 0, 'bez pytania o zgodę przy samym wejściu');
  assert.ok(await strona.locator('#powiadomienia-rodzaje').isHidden());
  assert.match(await strona.textContent('.konto-lista [data-sekcja="powiadomienia"]'), /Powiadomienia.*Wyłączone/);

  await strona.click('#ust-powiadomienia .przelacznik:has(#powiadomienia-wlacz)');
  await strona.waitForFunction(() => document.querySelector('#powiadomienia-stan').textContent === 'Włączone na tym urządzeniu');
  assert.equal(await strona.evaluate(() => window.__zgoda), 1);
  assert.deepEqual(push.urzadzenie, { endpoint: 'https://fcm.googleapis.com/fcm/send/test-urzadzenie', rodzaje: ['zaproszenia', 'odpowiedzi', 'dostep', 'komentarze'] });
  assert.deepEqual(push.funkcja[0], { klucz: true }, 'klucz publiczny z Funkcji Edge');
  const klucz = await strona.evaluate(() => window.__klucz);
  assert.equal(Buffer.from(klucz).toString('base64url'), KLUCZ);
  assert.ok(await strona.isChecked('#powiadomienia-wlacz'));
  assert.ok(await strona.locator('#powiadomienia-rodzaje').isVisible());
  assert.match(await strona.textContent('.konto-lista [data-sekcja="powiadomienia"]'), /Włączone/);

  // Rodzaj „dostęp” wyłączony – zapis bez niego.
  await strona.click('#powiadomienia-rodzaje label:has(input[value="dostep"])');
  for (let i = 0; i < 50 && push.urzadzenie.rodzaje.length !== 3; i += 1) await strona.waitForTimeout(50);
  assert.deepEqual(push.urzadzenie.rodzaje, ['zaproszenia', 'odpowiedzi', 'komentarze']);

  // Zmiana we współpracy → od razu przebieg kolejki (bez czekania na Cron).
  const przed = push.funkcja.length;
  await strona.evaluate(async () => { const m = await import('./js/wspolpraca-chmura.js'); await m.odrzucZaproszenie('brak-takiego-kodu').catch(() => {}); });
  for (let i = 0; i < 50 && push.funkcja.length === przed; i += 1) await strona.waitForTimeout(50);
  assert.deepEqual(push.funkcja.slice(przed), [{ kolejka: true }]);

  // Ponowne wejście: stan z bazy dla tego urządzenia.
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await strona.evaluate(() => { location.hash = '#/konto/powiadomienia'; });
  await strona.waitForFunction(() => document.querySelector('#powiadomienia-stan').textContent === 'Włączone na tym urządzeniu');
  assert.ok(!(await strona.isChecked('#powiadomienia-rodzaje input[value="dostep"]')));

  await strona.click('#ust-powiadomienia .przelacznik:has(#powiadomienia-wlacz)');
  await strona.waitForFunction(() => document.querySelector('#powiadomienia-stan').textContent === 'Wyłączone na tym urządzeniu');
  assert.equal(push.urzadzenie, null);
  assert.equal(await strona.evaluate(() => window.__sub), null);
  assert.deepEqual(bledy, []);
});

test('powiadomienia: iPhone bez instalacji – wskazówka i przycisk instalacji; zablokowane w przeglądarce', async (t) => {
  const { strona, bledy } = await przygotuj(t, { urzadzenie: 'iPhone 13' }, { push: false });
  await strona.waitForFunction(() => document.querySelector('#powiadomienia-stan').textContent === 'Niedostępne w przeglądarce');
  assert.ok(await strona.isDisabled('#powiadomienia-wlacz'));
  assert.match(await strona.textContent('#powiadomienia-uwaga'), /zainstalowanej aplikacji/);
  assert.ok(await strona.locator('#powiadomienia-instaluj').isVisible(), 'przycisk instalacji');
  await strona.click('#powiadomienia-instaluj');
  await strona.waitForSelector('#dlg-instalacja-ios[open]');
  assert.deepEqual(bledy, []);

  const drugi = await przygotuj(t, {}, { zgoda: 'denied' });
  await drugi.strona.waitForFunction(() => document.querySelector('#powiadomienia-stan').textContent === 'Zablokowane w przeglądarce');
  assert.ok(await drugi.strona.isDisabled('#powiadomienia-wlacz'));
  assert.match(await drugi.strona.textContent('#powiadomienia-uwaga'), /zablokowane w ustawieniach przeglądarki/);
  assert.deepEqual(drugi.bledy, []);
});

test('powiadomienia: e-maile o zaproszeniach wyłączane dla całego konta (#206)', async (t) => {
  const { strona, bledy, push } = await przygotuj(t);
  await strona.waitForFunction(() => !document.querySelector('#maile-zaproszenia').disabled);
  assert.ok(await strona.isChecked('#maile-zaproszenia'), 'domyślnie włączone');
  assert.ok(await strona.locator('#maile-wiersz').isVisible(), 'widać bez włączania powiadomień na urządzeniu');
  await strona.click('#maile-wiersz .przelacznik');
  await strona.waitForFunction(() => /Wyłączone/.test(document.querySelector('#maile-stan').textContent));
  assert.deepEqual(push.maile.zapisy, [{ p_zaproszenia: false }]);
  assert.ok(!(await strona.isChecked('#maile-zaproszenia')));
  await strona.click('#maile-wiersz .przelacznik');
  await strona.waitForFunction(() => /E-mail, gdy/.test(document.querySelector('#maile-stan').textContent));
  assert.deepEqual(push.maile.zapisy.at(-1), { p_zaproszenia: true });

  // Zapraszający: adresat wyłączył e-maile – jasny komunikat zamiast błędu.
  const tekst = await strona.evaluate(async () => {
    const { BEZ_MAILA } = await import('./js/app/wspolpraca.js');
    return BEZ_MAILA;
  });
  assert.match(tekst, /wyłączyła e-maile o zaproszeniach/);
  assert.deepEqual(bledy, []);
});
