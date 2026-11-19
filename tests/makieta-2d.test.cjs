// Uproszczona makieta na urządzeniach bez grafiki 3D (zgłoszenie 19.11: „zrób prostszy render na kompach bez 3D”,
// js/makieta-2d.js): ta sama scena co w 3D rysowana na płótnie 2D z buforem głębokości – strony nałożone na kartki,
// obracanie myszą i kartkowanie jak w 3D – u właściciela i u oglądającego link. Zgłoszenie 19.11 („usuń zdjęcia
// jako opcję, zdjęcia tylko w pobraniu”): bez galerii gotowych ujęć i bez przełącznika 3D / Zdjęcia; link nie ma
// plików ujęć, obraz makiety – tylko pobraniem.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, krotkieLinkiGoscia } = require('./pomoc.cjs');

const BEZ_WEBGL = () => {
  const zwykly = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(typ, ...r) { return /webgl/i.test(typ) ? null : zwykly.call(this, typ, ...r); };
};

// Odcisk obrazu płótna makiety (do porównań „zmieniło się / nie”) i liczba różnych kolorów.
const obrazPlotna = (strona) => strona.evaluate(() => {
  const c = document.querySelector('#makieta-plotno');
  const k = document.createElement('canvas');
  k.width = 64; k.height = 48;
  const g = k.getContext('2d');
  g.drawImage(c, 0, 0, 64, 48);
  const d = g.getImageData(0, 0, 64, 48).data;
  const kolory = new Set();
  let suma = 0;
  for (let i = 0; i < d.length; i += 4) { kolory.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`); suma = (suma * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1e9; }
  return { kolory: kolory.size, suma };
});

test('makieta 2D: książka z okładką, obracanie i kartkowanie', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1200, height: 800 } });
  await strona.evaluate(BEZ_WEBGL);
  await nowyProjekt(strona, 'Start');
  await strona.evaluate(async () => {
    const { zbudujProjekt } = await import('./js/szablony-projektow.js');
    const p = await zbudujProjekt('ksiazka-miekka', { nazwa: 'Dwa D' });
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa === 'Dwa D' && window.seriodruk.edytor?.wydruk);
  await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).otworzMakiete(window.seriodruk.stan.projekt));
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 60000 });
  const st = await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).stanMakiety());
  assert.equal(st.renderer, true);
  assert.equal(st.uproszczony, true);
  assert.equal(await strona.isVisible('#makieta-brak-3d'), false, 'bez komunikatu o braku 3D');
  await strona.waitForTimeout(800);
  const zamknieta = await obrazPlotna(strona);
  assert.ok(zamknieta.kolory > 12, `okładka z treścią na płótnie (${zamknieta.kolory} kolorów)`);
  // Obrót myszą – inny obraz.
  const r = await strona.locator('#makieta-plotno').boundingBox();
  await strona.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await strona.mouse.down();
  await strona.mouse.move(r.x + r.width / 2 + 120, r.y + r.height / 2, { steps: 6 });
  await strona.mouse.up();
  await strona.waitForTimeout(800);
  const obrocona = await obrazPlotna(strona);
  assert.notEqual(obrocona.suma, zamknieta.suma, 'obrót zmienia widok');
  // Kartkowanie.
  await strona.click('#makieta-dalej');
  await strona.waitForFunction(async () => (await import('./js/app/makieta-okno.js')).stanMakiety().u === 1, null, { timeout: 10000 });
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true');
  await strona.waitForTimeout(800);
  assert.notEqual((await obrazPlotna(strona)).suma, obrocona.suma, 'otwarta książka');
  // Obraz makiety (PNG) działa także w 2D.
  const png = await strona.evaluate(async () => (await (await import('./js/app/makieta-okno.js')).obrazMakiety({ rozmiar: '800' }))?.size || 0);
  assert.ok(png > 5000, `PNG ${png} B`);
  assert.deepEqual(bledy, []);
});

test('link: oglądający bez WebGL widzi makietę 2D; bez zdjęć jako opcji', async (t) => {
  const { strona, baza, przegladarka, Z_ATRAPA } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await nowyProjekt(strona, 'Link 2D');
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');
  await strona.click('#udostepnij-utworz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 60000 });
  const link = await strona.inputValue('#udostepnij-link');
  const kluczManifestu = [...baza.pliki.keys()].find((k) => k.startsWith('podglady/') && k.endsWith('manifest.json'));
  const manifest = JSON.parse(baza.pliki.get(kluczManifestu).tresc.toString());
  assert.ok(manifest.uklad.makieta, 'link ma makietę');
  assert.equal(manifest.uklad.makieta.ujecia, undefined, 'bez gotowych zdjęć makiety');
  assert.equal([...baza.pliki.keys()].some((k) => k.includes('/makieta-')), false, 'bez plików zdjęć makiety');
  assert.equal(await strona.$('#udostepnij-ujecia'), null);

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
  await obca.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 30000 });
  const w = await obca.evaluate(async () => ({
    uproszczony: (await import('./js/app/makieta-okno.js')).stanMakiety().uproszczony,
    komunikat: !document.querySelector('#makieta-brak-3d').hidden,
    przelacznik: Boolean(document.querySelector('[data-tryb-makiety], #makieta-galeria')),
  }));
  assert.deepEqual(w, { uproszczony: true, komunikat: false, przelacznik: false });
  // Zdjęcie makiety – pobraniem.
  const png = await obca.evaluate(async () => (await (await import('./js/app/makieta-okno.js')).obrazMakiety({ rozmiar: '800' }))?.size || 0);
  assert.ok(png > 5000, `PNG ${png} B`);
  assert.deepEqual(bledy, []);
});
