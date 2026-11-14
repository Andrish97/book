// Pliki w R2 i limity kont (decyzja #92): jednorazowe przeniesienie plików ze starego magazynu
// (Supabase Storage) do R2 przy zalogowaniu, limit projektów konta („Nowy projekt”, „Duplikuj”),
// limit miejsca konta przy wysyłce obrazu i limit obrazów w projekcie.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

const KONTO = '11111111-1111-4111-8111-111111111111';

test('przeniesienie plików do R2: pliki z folderu konta przechodzą raz, ze starego magazynu znikają; pobranie czeka na przeniesienie', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Przed R2');
  await strona.setInputFiles('#pliki-zasoby', { name: 'stary.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForFunction(() => Object.values(window.seriodruk.stan.projekt.zasoby).some((z) => z.sciezka), null, { timeout: 15000 });
  const sciezka = await strona.evaluate(() => Object.values(window.seriodruk.stan.projekt.zasoby).find((z) => z.sciezka).sciezka);
  const idProjektu = sciezka.split('/')[1];
  // Stan sprzed R2: plik obrazu, czcionka konta i obraz strony linku leżą w starym magazynie, w R2 nic.
  for (const klucz of [...baza.pliki.keys()]) baza.pliki.delete(klucz);
  baza.staryMagazyn.set(`zasoby/${sciezka}`, { typ: 'image/png', tresc: PNG_2X2 });
  baza.staryMagazyn.set(`zasoby/${KONTO}/_czcionki/spis.json`, { typ: 'application/json', tresc: Buffer.from('{"czcionki":[],"usuniete":[]}') });
  baza.staryMagazyn.set(`podglady/${KONTO}/${idProjektu}/kodlinku/manifest.json`, { typ: 'application/json', tresc: Buffer.from('{}') });
  baza.staryMagazyn.set('zasoby/99999999-9999-4999-8999-999999999999/inny/z', { typ: 'image/png', tresc: PNG_2X2 }); // cudzy folder
  // Druga przeglądarka (bez znacznika przeniesienia i bez plików na urządzeniu) – logowanie przenosi pliki.
  await strona.evaluate(async () => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('pliki-r2:')) localStorage.removeItem(k);
    await Promise.all(['seriodruk', 'seriodruk-zasoby'].map((n) => new Promise((ok) => { const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = () => ok(); })));
  });
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk.stan.projekt, null, { timeout: 20000 });
  // Pobranie pliku z konta czeka na koniec przeniesienia i bierze plik już z R2.
  const rozmiar = await strona.evaluate(async (s) => (await (await import('./js/chmura.js')).pobierzZasob(s)).size, sciezka);
  assert.equal(rozmiar, PNG_2X2.length);
  assert.ok(baza.pliki.has(`zasoby/${sciezka}`), 'obraz w R2');
  assert.ok(baza.pliki.has(`zasoby/${KONTO}/_czcionki/spis.json`), 'czcionki konta w R2');
  assert.ok(baza.pliki.has(`podglady/${KONTO}/${idProjektu}/kodlinku/manifest.json`), 'obraz strony linku w R2');
  assert.equal(baza.pliki.get(`zasoby/${sciezka}`).cacheControl, 'private, max-age=31536000, immutable');
  assert.deepEqual([...baza.staryMagazyn.keys()], ['zasoby/99999999-9999-4999-8999-999999999999/inny/z'], 'stary magazyn konta pusty, cudzy folder nietknięty');
  // Drugi raz na tym urządzeniu – bez pytania starego magazynu.
  const listy = () => baza.zadania.filter((z) => z.startsWith('POST /storage/v1/object/list/')).length;
  const przed = listy();
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk.stan.projekt);
  await strona.waitForTimeout(500);
  assert.equal(listy(), przed, 'przeniesienie raz na urządzeniu');
  assert.deepEqual(bledy, []);
});

test('limity: projekty konta (Nowy projekt, Duplikuj), miejsce konta przy wysyłce obrazu, obrazy w projekcie', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Pierwszy');
  for (let i = 0; i < 100 && !baza.projekty.length; i += 1) await strona.waitForTimeout(100);
  assert.equal(baza.projekty.length, 1, 'projekt na koncie');
  baza.limitProjektow = 1;
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await strona.click('[data-akcja="nowy-projekt"]');
  await strona.waitForFunction(() => /limit jednego konta/.test(document.querySelector('#powiadomienie')?.textContent || ''));
  assert.equal(await strona.locator('#dlg-nowy[open]').count(), 0, 'okno nowego projektu się nie otwiera');
  await strona.click('.karta-projektu .menu-karty');
  await strona.click('[data-op="duplikuj"]');
  await strona.waitForTimeout(500);
  assert.equal(baza.projekty.length, 1, 'kopia nie powstała');
  baza.limitProjektow = 30;

  // Miejsce konta: wysyłka obrazu ponad limit – czytelny komunikat, projekt zostaje na urządzeniu.
  baza.limitKonta = 50;
  await strona.click('.karta-projektu .otworz-projekt');
  await strona.waitForSelector('#ekran-edytora', { state: 'visible' });
  await strona.setInputFiles('#pliki-zasoby', { name: 'duzy.png', mimeType: 'image/png', buffer: Buffer.concat([PNG_2X2, Buffer.alloc(200)]) });
  await strona.waitForFunction(() => /nie ma już miejsca/.test(document.querySelector('#stan-zapisu')?.title + document.querySelector('#stan-zapisu')?.textContent + (document.querySelector('#powiadomienie')?.textContent || '')), null, { timeout: 15000 });
  baza.limitKonta = null;

  // Obrazy w projekcie: limit z obrazy-wspolne.js (300) – sprawdzane przy dodawaniu.
  const komunikat = await strona.evaluate(async () => {
    const { dodajPlik, obrazyProjektu } = await import('./js/obrazy-projektu.js');
    const p = window.seriodruk.stan.projekt;
    const zasoby = { ...p.zasoby };
    for (let i = obrazyProjektu(p).length; i < 300; i += 1) p.zasoby[`z_test${i}`] = { nazwa: `t${i}.png`, typ: 'image/png' };
    try { await dodajPlik(p, new Blob(['x'], { type: 'image/png' }), 'ponad.png'); return null; } catch (e) { return e.message; } finally { p.zasoby = zasoby; }
  });
  assert.match(komunikat, /300 obrazów – to limit jednego projektu/);
  assert.deepEqual(bledy.filter((b) => !/nie ma już miejsca|413/.test(b)), []);
});

test('panel użycia konta: paski limitów, projekty z plikami i obrazami, „Pokaż obrazy”, projekty innych osobno', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kalendarz z obrazami');
  await strona.setInputFiles('#pliki-zasoby', [
    { name: 'a.png', mimeType: 'image/png', buffer: PNG_2X2 },
    { name: 'b.png', mimeType: 'image/png', buffer: Buffer.concat([PNG_2X2, Buffer.alloc(5000)]) },
  ]);
  for (let i = 0; i < 100 && [...baza.pliki.keys()].filter((k) => k.startsWith('zasoby/')).length < 2; i += 1) await strona.waitForTimeout(100);
  // Projekt innej osoby, do którego mam dostęp – osobno, bez liczenia do limitów.
  const inny = { id: '33333333-3333-4333-8333-333333333333', email: 'inny@example.com', haslo: 'x', potwierdzone: true, nazwa: 'Ola' };
  baza.konta.push(inny);
  baza.projekty.push({ id: '44444444-4444-4444-8444-444444444444', owner_id: inny.id, nazwa: 'Cudzy planer', dane: { zasoby: {}, strony: ['s1'] }, zmieniono: new Date().toISOString(), wersja: 1 });
  baza.wspolpracownicy = baza.wspolpracownicy || [];
  baza.wspolpracownicy.push({ projekt_id: '44444444-4444-4444-8444-444444444444', uzytkownik: KONTO, rola: 'odczyt' });
  await strona.evaluate(() => { location.hash = '#/konto'; });
  await strona.waitForSelector('#uzycie-lista .uzycie-projekt');
  const tekst = await strona.textContent('#uzycie-lista');
  assert.match(tekst, /Kalendarz z obrazami/);
  assert.match(tekst, /2 obrazy/);
  assert.match(tekst, /kB/);
  assert.match(await strona.textContent('#uzycie-paski'), /Projekty1 z 30/);
  assert.match(await strona.textContent('#uzycie-paski'), /2 z 300/);
  assert.match(await strona.textContent('#uzycie-dodatki'), /klucze AI: 0/);
  assert.ok(await strona.locator('#uzycie-u-innych').isVisible(), 'projekty innych osobno');
  await strona.click('#uzycie-u-innych summary');
  assert.match(await strona.textContent('#uzycie-lista-innych'), /Cudzy planer.*właściciel: Ola · oglądasz/s);
  await strona.click('#uzycie-lista .uzycie-projekt [data-rola="obrazy"]');
  await strona.waitForSelector('#dlg-obrazy[open]');
  assert.equal(await strona.locator('#obrazy-lista li').count(), 2);
  assert.deepEqual(bledy, []);
});
