// Rysowanie na serwerze (#335): strona rysuj.html (bez logowania i reszty aplikacji) rysuje strony linku tym samym
// kodem co aplikacja – obrazy identyczne, opis linku z odciskami, pliki przez magazyn podany z zewnątrz (worker).
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Magazyn w pamięci po stronie testu – jak R2 w workerze.
function magazynTestowy() {
  const pliki = new Map();
  return {
    pliki,
    async podlacz(strona, { postep = [] } = {}) {
      await strona.exposeFunction('__mkCzytajOpis', (folder) => { const p = pliki.get(`${folder}/manifest.json`); return p ? JSON.parse(Buffer.from(p.b64, 'base64').toString()) : null; });
      await strona.exposeFunction('__mkWyslij', (klucz, b64, typ, cache) => { pliki.set(klucz, { b64, typ, cache }); return true; });
      await strona.exposeFunction('__mkLista', (folder) => [...pliki.keys()].filter((k) => k.startsWith(`${folder}/`)));
      await strona.exposeFunction('__mkUsun', (klucze) => { for (const k of klucze) pliki.delete(k); return true; });
      await strona.exposeFunction('__mkPobierz', () => null);
      await strona.exposeFunction('__mkPostep', (i, n) => { postep.push([i, n]); });
    },
  };
}

test('rysowanie na serwerze: rysuj.html rysuje strony linku tak samo jak aplikacja', async (t) => {
  const { strona, kontekst, bledy, adres } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  // Projekt z szablonu książki (okładka, wyklejki, blok) – zwykły JSON, jak w bazie.
  const projekt = await strona.evaluate(async () => {
    const { zbudujProjekt } = await import('./js/szablony-projektow.js');
    const p = await zbudujProjekt('ksiazka-twarda', { nazwa: 'Książka na serwerze' });
    p.znak_wodny = { tekst: 'PODGLĄD', krycie: 12 };
    // identyfikatory stron nadaje normalizacja – raz, jak w zapisanym projekcie
    return JSON.parse(JSON.stringify((await import('./js/projekt.js')).normalizuj(p)));
  });
  // 1. Aplikacja: ten sam projekt, ta sama publikacja (wspólne moduły) do magazynu w pamięci.
  const wAplikacji = await strona.evaluate(async (p) => {
    const { przygotujDoRysowania } = await import('./js/app/zapis.js');
    const { normalizuj } = await import('./js/projekt.js');
    const { przygotujPublikacje } = await import('./js/publikacja-linku.js');
    const { publikujDoMagazynu } = await import('./js/publikacja-magazyn.js');
    const pr = normalizuj(p);
    await przygotujDoRysowania(pr);
    const pliki = new Map();
    const mag = { czytajOpis: async () => null, wyslij: async (k, b) => { pliki.set(k, b); }, lista: async () => [], usun: async () => {} };
    const { uklad, strony, odciski, rozszerzenie, obraz } = przygotujPublikacje(pr);
    await publikujDoMagazynu(mag, 'f', uklad, strony, obraz, () => {}, odciski, { rozszerzenie });
    return JSON.parse(await pliki.get('f/manifest.json').text());
  }, projekt);

  // 2. Strona rysowania: osobna karta, bez logowania; dane i pliki tylko przez magazyn.
  const rys = await kontekst.newPage();
  const mag = magazynTestowy();
  const postep = [];
  await mag.podlacz(rys, { postep });
  const bledyRys = [];
  rys.on('pageerror', (e) => bledyRys.push(e.message));
  await rys.goto(new URL('rysuj.html', adres || strona.url()).href);
  await rys.waitForFunction(() => window.makietkaRysujGotowe === true);
  const w = await rys.evaluate((p) => window.makietkaRysuj.publikujLink({ projekt: p, folder: 'konto/proj/kod' }), projekt);
  assert.equal(w.wszystkie, Object.keys(wAplikacji.skroty).length);
  const opis = JSON.parse(Buffer.from(mag.pliki.get('konto/proj/kod/manifest.json').b64, 'base64').toString());
  // Pliki według treści (#438, A2): strony wyglądające tak samo (np. puste) dzielą jeden plik.
  assert.ok(w.wyslane > 0 && w.wyslane === new Set(Object.values(opis.pliki)).size, `każdy plik wysłany raz przy pierwszej publikacji (${w.wyslane}/${w.wszystkie})`);
  assert.equal(opis.format, 'seriodruk-podglad');
  assert.deepEqual(Object.keys(opis.tresci).sort(), Object.keys(opis.skroty).sort(), 'odcisk każdej strony');
  assert.ok(opis.uklad.makieta, 'opis makiety 3D w linku');
  // Obrazy identyczne jak w aplikacji (te same skróty plików).
  const rozne = Object.keys(opis.skroty).filter((k) => opis.skroty[k] !== wAplikacji.skroty[k]);
  assert.deepEqual(opis.skroty, wAplikacji.skroty, 'strony narysowane tak samo jak w aplikacji');
  assert.deepEqual(opis.pliki, wAplikacji.pliki, 'te same nazwy plików (odciski) co w aplikacji');
  assert.ok(postep.length >= w.wszystkie, 'postęp zgłaszany na bieżąco');
  // Druga publikacja bez zmian: nic nie jest rysowane ani wysyłane.
  const w2 = await rys.evaluate((p) => window.makietkaRysuj.publikujLink({ projekt: p, folder: 'konto/proj/kod' }), projekt);
  assert.equal(w2.wyslane, 0);
  assert.deepEqual(bledyRys, []);
  assert.deepEqual(bledy, []);
});

// #335: aplikacja zleca rysowanie serwerowi, gdy stron do narysowania jest dużo – pokazuje postęp i niczego nie
// rysuje sama; serwer wyłączony (503) – rysuje urządzenie, jak dotąd.
test('link: dużo stron – rysuje serwer, postęp w aplikacji; serwer wyłączony – rysuje urządzenie', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await nowyProjekt(strona, 'Duży link');
  for (let i = 0; i < 3; i += 1) await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 4);
  // Próg obniżony do 2 stron – żeby nie budować w teście setek stron.
  await strona.evaluate(() => { globalThis.__progSerwera = 2; });
  // Serwer (worker) – atrapa: przyjmuje zlecenie, potem „rysuje” i kończy.
  let zlecenie = null;
  let stanow = 0;
  let wylaczony = false;
  await strona.route((u) => u.pathname.startsWith('/rysuj/'), async (r) => {
    const u = new URL(r.request().url());
    if (wylaczony) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ blad: 'wyłączone', kod: 'brak_rysowania' }) });
    if (u.pathname === '/rysuj/link') { zlecenie = JSON.parse(r.request().postData()); return r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ stan: 'w_kolejce', id: 'z1' }) }); }
    stanow += 1;
    const st = stanow < 4 ? { stan: 'rysuje', id: 'z1', gotowe: 1, wszystkie: 4 } : { stan: 'gotowe', id: 'z1', wyslane: 4, wszystkie: 4, koniec: Date.now(), zaktualizowano: new Date().toISOString() };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) });
  });
  const obrazyStron = () => baza.wyslania.filter((k) => k.startsWith('podglady/') && /\.(webp|jpg)$/.test(k)).length;
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');
  await strona.click('#udostepnij-utworz');
  // #427: tworzenie linku, strony rysuje serwer – pasek i okno mówią, że Makietkę można zamknąć, karta nie pyta.
  await strona.waitForFunction(() => [...document.querySelectorAll('.postep')].some((e) => e.offsetParent && /możesz zamknąć Makietkę/.test(e.textContent)), null, { timeout: 15000 });
  assert.doesNotMatch(await strona.evaluate(() => [...document.querySelectorAll('.postep')].filter((e) => e.offsetParent).map((e) => e.textContent).join(' ')), /nie zamykaj/);
  assert.equal(await strona.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), false, 'zamknięcie karty bez pytania');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces'), null, { timeout: 30000 });
  assert.ok(zlecenie, 'zlecenie poszło do serwera');
  assert.equal(zlecenie.projekt.id, await strona.evaluate(() => window.seriodruk.stan.projekt.id));
  assert.match(zlecenie.folder, /^[0-9a-f-]+\/[^/]+\/[0-9a-f]+$/, 'własny folder linku');
  assert.equal(obrazyStron(), 0, 'urządzenie nie rysowało stron');
  assert.ok(await strona.evaluate(() => window.seriodruk.stan.projekt.udostepnienia?.[0]?.zaktualizowano), 'link oznaczony jako aktualny');
  // Serwer wyłączony – ta sama zmiana rysuje się na urządzeniu.
  wylaczony = true;
  const przed = obrazyStron();
  await strona.evaluate(async () => { await (await import('./js/app/podglad-ekran.js')).opublikujUdostepnienie(); });
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces'), null, { timeout: 30000 });
  assert.ok(obrazyStron() > przed, 'strony narysowało urządzenie');
  assert.deepEqual(bledy, []);
});

// #338: okno „Eksportuj do PDF” – duży projekt: plik robi serwer, aplikacja go pobiera; urządzenie nie eksportuje.
test('PDF dużego projektu: okno eksportu zleca plik serwerowi i pobiera gotowy', async (t) => {
  const { strona, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await nowyProjekt(strona, 'Gruby PDF');
  await strona.evaluate(() => { globalThis.__progPdfSerwera = 1; });
  let zlecenie = null;
  let pobrano = false;
  await strona.route((u) => u.pathname.startsWith('/rysuj/') || u.pathname.includes('/_eksporty/serwer-'), async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/rysuj/pdf') { zlecenie = JSON.parse(r.request().postData()); return r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ stan: 'w_kolejce', id: 'p1' }) }); }
    if (u.pathname === '/rysuj/stan') {
      const id = zlecenie.projekt.id;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ stan: 'gotowe', id: 'p1', plik: `uid/_eksporty/serwer-${id}.pdf`, nazwa: 'Gruby PDF.pdf', wszystkie: 1, gotowe: 1 }) });
    }
    if (r.request().method() === 'GET') { pobrano = true; return r.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.7 serwer' }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const pobranie = strona.waitForEvent('download');
  await strona.evaluate(async () => { (await import('./js/app/edytor-start.js')).akcje.pdf(); });
  await strona.waitForSelector('#dlg-pdf[open]', { timeout: 15000 });
  await strona.click('#pdf-eksportuj');
  const plik = await pobranie;
  assert.equal(plik.suggestedFilename(), 'Gruby PDF.pdf');
  assert.ok(zlecenie && zlecenie.opcje && zlecenie.projekt, 'zlecenie z projektem i opcjami okna');
  assert.ok(pobrano, 'plik pobrany z konta');
  assert.deepEqual(bledy, []);
});
