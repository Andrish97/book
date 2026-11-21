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
  assert.ok(w.wyslane > 0 && w.wyslane === w.wszystkie, `wszystkie strony wysłane przy pierwszej publikacji (${w.wyslane}/${w.wszystkie})`);
  const opis = JSON.parse(Buffer.from(mag.pliki.get('konto/proj/kod/manifest.json').b64, 'base64').toString());
  assert.equal(opis.format, 'seriodruk-podglad');
  assert.deepEqual(Object.keys(opis.tresci).sort(), Object.keys(opis.skroty).sort(), 'odcisk każdej strony');
  assert.ok(opis.uklad.makieta, 'opis makiety 3D w linku');
  // Obrazy identyczne jak w aplikacji (te same skróty plików).
  const rozne = Object.keys(opis.skroty).filter((k) => opis.skroty[k] !== wAplikacji.skroty[k]);
  assert.deepEqual(opis.skroty, wAplikacji.skroty, 'strony narysowane tak samo jak w aplikacji');
  assert.ok(postep.length >= w.wszystkie, 'postęp zgłaszany na bieżąco');
  // Druga publikacja bez zmian: nic nie jest rysowane ani wysyłane.
  const w2 = await rys.evaluate((p) => window.makietkaRysuj.publikujLink({ projekt: p, folder: 'konto/proj/kod' }), projekt);
  assert.equal(w2.wyslane, 0);
  assert.deepEqual(bledyRys, []);
  assert.deepEqual(bledy, []);
});
