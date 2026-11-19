// Makieta 3D w podglądzie z linku (#188): oglądający bez konta otwiera makietę – ta sama bryła co u właściciela
// (opis w manifeście), strony z obrazów linku, bez biblioteki płótna; jeden wariant, bez ustawień i zapisu.
// Stary link (manifest bez opisu makiety) – przycisku nie ma.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, krotkieLinkiGoscia } = require('./pomoc.cjs');

test('makieta 3D z linku: ta sama bryła co u właściciela, obrazy linku, kartkowanie, bez ustawień; stary link bez przycisku', async (t) => {
  const { strona, baza, przegladarka, Z_ATRAPA } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await nowyProjekt(strona, 'Książka z linku');
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
  // Bryła u właściciela.
  const wlasciciel = await strona.evaluate(async () => {
    const W = await import('./js/app/makieta-okno.js');
    W.otworzMakiete(window.seriodruk.stan.projekt);
    const s = W.stanMakiety();
    const wynik = { model: s.model, kartki: JSON.stringify(W.kartkiMakiety()), polozen: s.polozen };
    document.querySelector('#dlg-makieta').close();
    return wynik;
  });
  assert.equal(wlasciciel.model, 'ksiazka_twarda');

  await strona.click('[data-akcja="udostepnij"]');
  await strona.click('#udostepnij-utworz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 30000 });
  const link = await strona.inputValue('#udostepnij-link');
  const kluczManifestu = [...baza.pliki.keys()].find((k) => k.startsWith('podglady/') && k.endsWith('manifest.json'));
  const manifest = JSON.parse(baza.pliki.get(kluczManifestu).tresc.toString());
  assert.equal(manifest.uklad.makieta.model, 'ksiazka_twarda');
  assert.equal(JSON.stringify(manifest).includes('obiekty'), false, 'opis makiety bez treści stron');

  const gosc = await przegladarka.newContext({ locale: 'pl-PL', viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' });
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
  obca.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text()); });
  await obca.goto(link);
  await obca.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id]').length > 0);
  assert.ok(await obca.isVisible('[data-akcja="podglad-makieta"]'), 'przycisk Makieta 3D dla oglądającego');
  await obca.click('[data-akcja="podglad-makieta"]');
  await obca.waitForSelector('#dlg-makieta[open]');
  await obca.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 30000 });
  // Oglądający z grafiką 3D – pełna makieta 3D (uproszczona 2D tylko bez WebGL, #318).
  assert.deepEqual(await obca.evaluate(async () => { const s = (await import('./js/app/makieta-okno.js')).stanMakiety(); return { renderer: s.renderer, uproszczony: s.uproszczony }; }), { renderer: true, uproszczony: false });
  const W = () => obca.evaluate(async () => {
    const M = await import('./js/app/makieta-okno.js');
    const s = M.stanMakiety();
    return { model: s.model, kartki: JSON.stringify(M.kartkiMakiety()), polozen: s.polozen, cel: s.cel, modele: s.modele };
  });
  const g = await W();
  assert.equal(g.model, wlasciciel.model);
  assert.deepEqual(g.modele, [wlasciciel.model], 'jeden wariant');
  assert.equal(g.kartki, wlasciciel.kartki, 'ta sama bryła co u właściciela');
  // Okładka z obrazu linku: granat na środku.
  const piksel = await obca.evaluate(() => {
    const c = document.querySelector('#makieta-plotno');
    const gl = c.getContext('webgl');
    const px = new Uint8Array(4);
    gl.readPixels(Math.round(c.width / 2), Math.round(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [...px];
  });
  assert.ok(piksel[3] > 0 && piksel[2] > piksel[0], `granatowa okładka z obrazu linku: ${piksel}`);
  // Kartkowanie.
  await obca.click('#makieta-dalej');
  await obca.waitForFunction(() => document.querySelector('#makieta-polozenie').textContent !== 'Okładka');
  assert.equal((await W()).cel, 1);
  // Bez ustawień, wyboru rodzaju i zapisu ujęć; bez biblioteki płótna.
  for (const sel of ['#makieta-model', '#makieta-ustawienia', '#makieta-zapisane', '#makieta-ujecia']) assert.ok(await obca.isHidden(sel), `ukryte: ${sel}`);
  assert.ok(await obca.isVisible('[data-akcja="makieta-pobierz"]'));
  assert.equal(await obca.evaluate(() => typeof window.fabric), 'undefined', 'oglądający nie wczytuje Fabric');
  await obca.click('#dlg-makieta [data-akcja="makieta-zamknij"]');
  await obca.waitForFunction(() => !document.querySelector('#dlg-makieta').open);
  assert.deepEqual(bledy, []);

  // Stary link: manifest bez opisu makiety – przycisku nie ma.
  delete manifest.uklad.makieta;
  baza.pliki.set(kluczManifestu, { ...baza.pliki.get(kluczManifestu), tresc: Buffer.from(JSON.stringify(manifest)) });
  await obca.reload();
  await obca.waitForFunction(() => document.querySelectorAll('.podglad-strona[data-id]').length > 0);
  assert.ok(await obca.isHidden('[data-akcja="podglad-makieta"]'));
  await gosc.close();
});

// #189: link sprzed #188 (manifest bez opisu makiety, stary odcisk) uzupełnia się sam po otwarciu projektu –
// bez klikania „Aktualizuj teraz”.
test('stary link bez makiety: po otwarciu projektu manifest sam dostaje opis makiety', async (t) => {
  const { strona, baza } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await nowyProjekt(strona, 'Stary link');
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');
  await strona.click('#udostepnij-utworz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 30000 });
  const klucz = [...baza.pliki.keys()].find((k) => k.startsWith('podglady/') && k.endsWith('manifest.json'));
  const manifest = () => JSON.parse(baza.pliki.get(klucz).tresc.toString());
  // Udajemy link sprzed #188: manifest bez makiety i odcisk liczony po staremu.
  const stary = manifest();
  delete stary.uklad.makieta;
  baza.pliki.set(klucz, { ...baza.pliki.get(klucz), tresc: Buffer.from(JSON.stringify(stary)) });
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.udostepnienie.odcisk = 'sprzed-188';
    document.querySelector('#dlg-udostepnij')?.close();
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  });
  const start = Date.now();
  while (!manifest().uklad.makieta && Date.now() - start < 40000) await strona.waitForTimeout(500);
  assert.ok(manifest().uklad.makieta, 'manifest po otwarciu projektu ma opis makiety');
});
