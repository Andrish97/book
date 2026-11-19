// Urządzenia bez grafiki 3D (zgłoszenie 19.11: „dla niewspieranych urządzeń kilka ujęć już zapisanych jako obrazy
// z możliwością przewijania, wyrenderowane gdzieś indziej”): przy publikacji linku urządzenie z 3D rysuje w tle
// gotowe ujęcia makiety (przód, ¾, rozkładówka, stojąca, przód i tył) i wysyła je razem ze stronami; oglądający
// bez WebGL dostaje zamiast komunikatu galerię tych ujęć – strzałki, klawiatura, przesunięcie palcem.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, krotkieLinkiGoscia } = require('./pomoc.cjs');

// Przeglądarka bez WebGL: getContext('webgl'…) zwraca null.
const BEZ_WEBGL = () => {
  const zwykly = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(typ, ...r) { return /webgl/i.test(typ) ? null : zwykly.call(this, typ, ...r); };
};

test('makieta bez 3D: ujęcia narysowane przy publikacji linku, galeria u oglądającego bez WebGL', async (t) => {
  const { strona, baza, przegladarka, Z_ATRAPA } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await nowyProjekt(strona, 'Książka bez 3D');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const O = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    const srodek = p.sekcje[0];
    for (let i = 1; i < 6; i += 1) p.strony.push(P.nowaStrona(`S${i + 1}`, srodek.id));
    const ok = P.nowaSekcja('Okładka');
    ok.okladka = { oprawa: 'twarda' };
    p.sekcje.unshift(ok);
    const so = P.nowaStrona('Okładka', ok.id);
    so.tlo = '#1c2541';
    p.strony.unshift(so);
    O.przeliczOkladki(p);
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  });
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');
  await strona.click('#udostepnij-utworz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 60000 });
  const link = await strona.inputValue('#udostepnij-link');
  const kluczManifestu = [...baza.pliki.keys()].find((k) => k.startsWith('podglady/') && k.endsWith('manifest.json'));
  const manifest = JSON.parse(baza.pliki.get(kluczManifestu).tresc.toString());
  const ujecia = manifest.uklad.makieta.ujecia;
  assert.deepEqual(ujecia.map((u) => u.nazwa), ['Przód', '¾ (klasyczne)', 'Rozkładówka z góry', 'Stojąca', 'Przód i tył']);
  const folder = kluczManifestu.slice(0, -'manifest.json'.length);
  for (const u of ujecia) {
    const plik = [...baza.pliki.keys()].find((k) => k.startsWith(`${folder}${u.id}.`));
    assert.ok(plik && baza.pliki.get(plik).tresc.length > 5000, `obraz ujęcia ${u.nazwa}`);
  }
  // Ujęcia nie są stronami podglądu.
  assert.ok(!JSON.stringify(manifest.uklad.sekcje).includes('makieta-'));
  // Okno makiety po publikacji działa jak dawniej (rysowanie w tle posprzątało po sobie).
  assert.equal(await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).makietaWolna()), true);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.udostepnienie.ujecia), true, 'link ma ujęcia');
  await strona.waitForFunction(() => /gotowe ujęcia są w linku/.test(document.querySelector('#udostepnij-ujecia').textContent));
  // #314: na urządzeniu z 3D makieta zostaje 3D, a gotowe ujęcia są opcją „Zdjęcia” w nagłówku.
  await strona.evaluate(() => document.querySelector('#dlg-udostepnij')?.close());
  await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).otworzMakiete(window.seriodruk.stan.projekt));
  await strona.waitForSelector('#makieta-tryb:not([hidden])', { timeout: 15000 });
  const widok = () => strona.evaluate(() => ({ galeria: !document.querySelector('#makieta-galeria').hidden, plotno: document.querySelector('#makieta-plotno').offsetParent !== null, zdjecia: document.querySelector('[data-tryb-makiety="obrazy"]').getAttribute('aria-pressed') }));
  assert.deepEqual(await widok(), { galeria: false, plotno: true, zdjecia: 'false' }, 'domyślnie 3D');
  await strona.click('[data-tryb-makiety="obrazy"]');
  assert.deepEqual(await widok(), { galeria: true, plotno: false, zdjecia: 'true' }, 'Zdjęcia – galeria ujęć');
  assert.match(await strona.textContent('#makieta-galeria-podpis'), /Gotowe ujęcia makiety \(zdjęcia z linku\)/);
  await strona.click('[data-tryb-makiety="3d"]');
  assert.deepEqual(await widok(), { galeria: false, plotno: true, zdjecia: 'false' }, 'z powrotem 3D');
  await strona.evaluate(() => document.querySelector('#dlg-makieta').close());
  await strona.waitForFunction(async () => (await import('./js/app/makieta-okno.js')).makietaWolna());

  // Oglądający bez WebGL.
  const gosc = await przegladarka.newContext({ locale: 'pl-PL', viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
  await gosc.addInitScript(BEZ_WEBGL);
  await krotkieLinkiGoscia(gosc, baza);
  await gosc.route('**/js/konfiguracja.js', (r) => r.fulfill({ contentType: 'text/javascript', body: Z_ATRAPA }));
  await gosc.route('https://atrapa.supabase.co/podglady/**', async (r) => {
    const klucz = `podglady/${decodeURIComponent(new URL(r.request().url()).pathname.slice('/podglady/'.length))}`;
    const plik = baza.pliki.get(klucz);
    if (!plik) return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    return r.fulfill({ status: 200, contentType: plik.typ, body: plik.tresc, headers: { 'access-control-allow-origin': '*' } });
  });
  const obca = await gosc.newPage();
  const bledy = [];
  obca.on('pageerror', (e) => bledy.push(e.message));
  await obca.goto(link);
  await obca.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id]').length > 0);
  await obca.click('[data-akcja="podglad-makieta"]');
  await obca.waitForSelector('#dlg-makieta[open]');
  await obca.waitForFunction(() => { const i = document.querySelector('#makieta-galeria-obraz'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
  const G = () => obca.evaluate(async () => ({ ...(await import('./js/app/makieta-okno.js')).stanGalerii(), podpis: document.querySelector('#makieta-galeria-podpis').textContent, blad: !document.querySelector('#makieta-brak-3d').hidden, plotno: document.querySelector('#makieta-plotno').offsetParent !== null }));
  let g = await G();
  assert.equal(g.widoczna, true);
  assert.equal(g.ile, 5);
  assert.equal(g.blad, false, 'zamiast komunikatu o braku 3D – galeria');
  assert.equal(g.plotno, false);
  assert.match(g.podpis, /Przód · 1 z 5\. To urządzenie nie pokazuje grafiki 3D/);
  await obca.click('#makieta-galeria-dalej');
  await obca.keyboard.press('ArrowRight');
  g = await G();
  assert.equal(g.ktore, 2);
  assert.match(g.podpis, /Rozkładówka z góry · 3 z 5/);
  // Przesunięcie palcem w prawo – poprzednie ujęcie.
  const r = await obca.locator('#makieta-galeria').boundingBox();
  await obca.mouse.move(r.x + r.width / 2 - 100, r.y + r.height / 2);
  await obca.mouse.down();
  await obca.mouse.move(r.x + r.width / 2 + 100, r.y + r.height / 2, { steps: 5 });
  await obca.mouse.up();
  assert.equal((await G()).ktore, 1);
  assert.deepEqual(bledy, []);

  // Właściciel na urządzeniu bez 3D: ujęcia z linku własnego projektu.
  await strona.evaluate(() => { document.querySelector('#dlg-udostepnij')?.close(); });
  await strona.evaluate(BEZ_WEBGL);
  await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).otworzMakiete(window.seriodruk.stan.projekt));
  const wl = await strona.evaluate(async () => {
    const W = await import('./js/app/makieta-okno.js');
    for (let i = 0; i < 150 && !W.stanGalerii().widoczna; i += 1) await new Promise((ok) => { setTimeout(ok, 100); });
    return { ...W.stanGalerii(), blad: !document.querySelector('#makieta-brak-3d').hidden };
  });
  assert.deepEqual(wl, { widoczna: true, ktore: 0, ile: 5, blad: false });

  // #311: aktualizacja linku z tego urządzenia (bez 3D) zachowuje ujęcia z poprzedniej publikacji.
  await strona.evaluate(() => document.querySelector('#dlg-makieta').close());
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.strony[1].tlo = '#ffe8cc';
    await (await import('./js/app/podglad-ekran.js')).opublikujUdostepnienie();
  });
  const czytaj = () => JSON.parse(baza.pliki.get(kluczManifestu).tresc.toString());
  for (let i = 0; i < 300 && (czytaj().zaktualizowano === manifest.zaktualizowano || czytaj().przygotowanie); i += 1) await strona.waitForTimeout(100);
  const m2 = czytaj();
  assert.equal(m2.uklad.makieta.ujecia?.length, 5, 'ujęcia zostały w linku');
  for (const u of m2.uklad.makieta.ujecia) assert.ok([...baza.pliki.keys()].some((k) => k.startsWith(`${folder}${u.id}.`)), `plik ${u.id} został`);
});

test('makieta bez 3D, link bez ujęć: okno mówi, skąd się biorą ujęcia', async (t) => {
  const { strona } = await otworz(t, { widok: { width: 1100, height: 800 } });
  await strona.evaluate(BEZ_WEBGL);
  await nowyProjekt(strona, 'Bez ujęć');
  await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).otworzMakiete(window.seriodruk.stan.projekt));
  const tekst = await strona.textContent('#makieta-brak-3d');
  await strona.evaluate(() => document.querySelector('#dlg-makieta').close());
  assert.match(tekst, /Nie udało się pokazać makiety 3D/);
  assert.match(tekst, /udostępnij projekt linkiem na komputerze z grafiką 3D – ujęcia zapiszą się same/);
});
