// Obrazy od AI w aplikacji: obraz wgrany kluczem pojawia się na żywo w oknie „Obrazy projektu” i na stronie,
// przy zapisie przechodzi z tabeli obrazy_ai do folderu plików konta, plik obrazu zastąpionego przez AI znika
// z konta (sprząta aplikacja), okno przyjmuje archiwa ZIP, a adres #/p/<id>/obrazy otwiera projekt z oknem.

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

async function png(strona, kolor, szer = 6, wys = 4) {
  const b64 = await strona.evaluate(([k, w, h]) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = k; ctx.fillRect(0, 0, w, h);
    return c.toDataURL('image/png').split(',')[1];
  }, [kolor, szer, wys]);
  return Buffer.from(b64, 'base64');
}

function zip(pliki) {
  const lokalne = [];
  const centralne = [];
  let offset = 0;
  for (const { nazwa, bajty } of pliki) {
    const dane = zlib.deflateRawSync(bajty);
    const n = Buffer.from(nazwa, 'utf8');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(dane.length, 18); lh.writeUInt32LE(bajty.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(dane.length, 20); ch.writeUInt32LE(bajty.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    lokalne.push(lh, n, dane);
    centralne.push(ch, n);
    offset += lh.length + n.length + dane.length;
  }
  const cd = Buffer.concat(centralne);
  const kon = Buffer.alloc(22);
  kon.writeUInt32LE(0x06054b50, 0); kon.writeUInt16LE(pliki.length, 8); kon.writeUInt16LE(pliki.length, 10);
  kon.writeUInt32LE(cd.length, 12); kon.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokalne, cd, kon]);
}

const nazwyObrazow = (strona) => strona.evaluate(() => [...document.querySelectorAll('#obrazy-lista .obraz-nazwa')].map((e) => e.textContent).sort());

test('obraz od AI: na żywo w oknie i na stronie, przy zapisie przechodzi na konto; plik zastąpiony przez AI sprzątnięty z konta', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Obrazy od AI');
  // Obraz wgrany w aplikacji – trafia do folderu plików konta.
  await strona.setInputFiles('#pliki-zasoby', { name: 'las.png', mimeType: 'image/png', buffer: await png(strona, '#2a7') });
  await strona.waitForFunction(() => Object.values(window.seriodruk.stan.projekt.zasoby).some((z) => z.nazwa === 'las.png' && z.sciezka), null, { timeout: 10000 });
  await zapisano(strona);
  const idProjektu = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  const las = await strona.evaluate(() => Object.entries(window.seriodruk.stan.projekt.zasoby).find(([, z]) => z.nazwa === 'las.png'));
  assert.ok(las[1].sciezka && !las[1].sciezka.startsWith('ai:'));
  assert.deepEqual([las[1].szer, las[1].wys], [6, 4], 'aplikacja zapisuje wymiary obrazu');
  assert.ok(baza.pliki.has(`zasoby/${las[1].sciezka}`));

  const { klucz } = await strona.evaluate(async (id) => (await import('./js/chmura.js')).utworzDostepAi(id, { opis: 'AI', dni: 1 }), idProjektu);
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="obrazy"]');
  await strona.waitForSelector('#dlg-obrazy[open]');

  // AI wgrywa obraz – otwarte okno pokazuje go po chwili.
  const w = baza.ai('ai_wgraj_obraz', { p_klucz: klucz, p_nazwa: 'morze.png', p_typ: 'image/png', p_dane: (await png(strona, '#14c', 8, 8)).toString('base64'), p_szer: 8, p_wys: 8 });
  assert.equal(w.byl, false, JSON.stringify(w));
  await strona.waitForFunction(() => [...document.querySelectorAll('#obrazy-lista .obraz-nazwa')].some((e) => e.textContent === 'morze.png'), null, { timeout: 10000 });
  await strona.click('#obrazy-zamknij');

  // …a po zapisie jest w folderze plików konta, a wiersz w tabeli obrazy_ai znika.
  await strona.waitForFunction((id) => !String(window.seriodruk.stan.projekt.zasoby[id]?.sciezka || 'ai:').startsWith('ai:'), w.id, { timeout: 10000 });
  await zapisano(strona);
  const sciezka = await strona.evaluate((id) => window.seriodruk.stan.projekt.zasoby[id].sciezka, w.id);
  assert.equal(sciezka, `${baza.konta[0].id}/${idProjektu}/${w.id}`);
  assert.ok(baza.pliki.has(`zasoby/${sciezka}`));
  for (let i = 0; i < 40 && baza.obrazyAi.size; i += 1) await strona.waitForTimeout(100);
  assert.equal(baza.obrazyAi.size, 0, 'wiersz obrazy_ai usunięty po przeniesieniu');
  assert.equal(baza.projekty[0].dane.zasoby[w.id].sciezka, sciezka, 'na koncie projekt wskazuje plik w folderze');

  // AI wstawia obraz na stronę (zwykły zapis kluczem) – element na płótnie z właściwym plikiem.
  const odczyt = baza.ai('ai_projekt', { p_klucz: klucz });
  const s = odczyt.projekt.strony[0];
  const el = { id: 'o_ai1', type: 'image', zasob: w.id, src: `zasob:${w.id}`, left: 10, top: 10, width: 8, height: 8, scaleX: 2, scaleY: 2 };
  assert.equal(baza.ai('ai_zapisz', { p_klucz: klucz, p_znana_wersja: odczyt.wersja, p_zmiany: { strony: [{ ...s, obiekty: [...s.obiekty, el] }] } }).strony_zapisane, 1);
  await strona.waitForFunction(() => {
    const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 'o_ai1');
    return o && o.getElement()?.naturalWidth === 8;
  }, null, { timeout: 10000 });

  // AI zastępuje obraz wgrany w aplikacji: stary plik z folderu konta sprząta aplikacja.
  const z = baza.ai('ai_wgraj_obraz', { p_klucz: klucz, p_nazwa: 'x.png', p_typ: 'image/png', p_dane: (await png(strona, '#a31')).toString('base64'), p_szer: 6, p_wys: 4, p_zastap: las[0] });
  assert.equal(z.nazwa, 'las.png');
  for (let i = 0; i < 80 && baza.pliki.has(`zasoby/${las[1].sciezka}`); i += 1) await strona.waitForTimeout(100);
  assert.equal(baza.pliki.has(`zasoby/${las[1].sciezka}`), false, 'plik zastąpionego obrazu usunięty z konta');
  assert.equal(baza.ai('pliki_do_usuniecia', { p_projekt: idProjektu }, baza.konta[0]).length, 0);
  await strona.waitForFunction((id) => window.seriodruk.stan.projekt.zasoby[id]?.nazwa === 'las.png', z.id, { timeout: 10000 });
  assert.deepEqual(bledy, []);
});

test('okno „Obrazy projektu” przyjmuje archiwum ZIP (bez plików systemowych); adres #/p/<id>/obrazy otwiera projekt z oknem', async (t) => {
  const { strona, adres, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Paczka');
  const archiwum = zip([
    { nazwa: 'kalendarz/styczen.png', bajty: await png(strona, '#111') },
    { nazwa: 'kalendarz/luty.png', bajty: await png(strona, '#222') },
    { nazwa: '__MACOSX/kalendarz/._styczen.png', bajty: Buffer.from('x') },
    { nazwa: 'kalendarz/opis.txt', bajty: Buffer.from('x') },
  ]);
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="obrazy"]');
  await strona.waitForSelector('#dlg-obrazy[open]');
  await strona.setInputFiles('#pliki-zasoby', { name: 'zdjecia.zip', mimeType: 'application/zip', buffer: archiwum });
  await strona.waitForFunction(() => document.querySelectorAll('#obrazy-lista .obraz-nazwa').length === 2, null, { timeout: 10000 });
  assert.deepEqual(await nazwyObrazow(strona), ['luty.png', 'styczen.png']);
  assert.match(await strona.textContent('#powiadomienie'), /Wgrano 2 obrazy/);
  // Ten sam ZIP drugi raz – nic nowego.
  await strona.setInputFiles('#pliki-zasoby', { name: 'zdjecia.zip', mimeType: 'application/zip', buffer: archiwum });
  await strona.waitForFunction(() => /już były w projekcie/.test(document.querySelector('#powiadomienie').textContent), null, { timeout: 10000 });
  // Bomba ZIP – odrzucona z komunikatem.
  await strona.setInputFiles('#pliki-zasoby', { name: 'bomba.zip', mimeType: 'application/zip', buffer: zip([{ nazwa: 'a.png', bajty: Buffer.alloc(40 * 1024 * 1024) }]) });
  await strona.waitForFunction(() => /bomba\.zip.*ponad 15 MB/.test(document.querySelector('#powiadomienie').textContent), null, { timeout: 15000 });
  await strona.click('#obrazy-zamknij');
  await zapisano(strona);

  // Link od AI: #/p/<id>/obrazy – projekt z oknem obrazów; adres wraca do zwykłego adresu projektu.
  const id = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  await strona.goto(`${adres}#/projekty`);
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await strona.goto(`${adres}#/p/${id}/obrazy`);
  await strona.waitForSelector('#dlg-obrazy[open]', { timeout: 15000 });
  assert.deepEqual(await nazwyObrazow(strona), ['luty.png', 'styczen.png']);
  assert.equal(await strona.evaluate(() => location.hash), `#/p/${id}`);
  assert.deepEqual(bledy, []);
});
