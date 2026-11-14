// Miejsce na koncie (#90): licznik w ustawieniach konta, ostrzeżenie przy 80%, sprzątanie osieroconych
// plików (ręczne i w tle) i mniej pobierania – łączenie zmian z konta ściąga tylko zmienione strony.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
const DAWNO = Date.now() - 5 * 24 * 3600 * 1000;
const KONTO = '11111111-1111-4111-8111-111111111111';

async function projektZObrazem(strona, baza) {
  await nowyProjekt(strona, 'Miejsce');
  await strona.setInputFiles('#pliki-zasoby', { name: 'las.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForFunction(() => Object.keys(window.seriodruk.stan.projekt.zasoby).length === 1);
  await zapisano(strona);
  await strona.waitForFunction(() => Object.values(window.seriodruk.stan.projekt.zasoby).every((z) => z.sciezka));
  await zapisano(strona);
  const p = baza.projekty[0];
  return { p, uzyty: Object.values(p.dane.zasoby)[0].sciezka };
}

test('ustawienia konta: licznik miejsca, ostrzeżenie przy 80%, „Posprzątaj…” usuwa tylko osierocone i stare pliki', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  const { p, uzyty } = await projektZObrazem(strona, baza);
  // Plik obrazu z projektu ma długi czas przechowywania (plik pod ścieżką się nie zmienia).
  assert.equal(baza.pliki.get(`zasoby/${uzyty}`).cacheControl, 'private, max-age=31536000, immutable');
  const plik = (tresc, czas = DAWNO) => ({ typ: 'image/png', tresc: Buffer.alloc(tresc), czas });
  // Osierocone: stara wersja zdjęcia, plik usuniętego projektu, podgląd wyłączonego linku.
  baza.pliki.set(`zasoby/${KONTO}/${p.id}/z_stara_wersja`, plik(300000));
  baza.pliki.set(`zasoby/${KONTO}/00000000-0000-4000-8000-000000000000/z_usuniety`, plik(200000));
  baza.pliki.set(`podglady/${KONTO}/${p.id}/aaaaaaaaaaaaaaaa/s1.jpg`, plik(50000));
  // Zostają: plik świeży (może czekać na zapis projektu), czcionka konta, plik używany przez projekt (stary).
  baza.pliki.set(`zasoby/${KONTO}/${p.id}/z_swiezy`, plik(1000, Date.now()));
  baza.pliki.set(`zasoby/${KONTO}/_czcionki/moja.woff2`, plik(40000));
  baza.pliki.get(`zasoby/${uzyty}`).czas = DAWNO;
  // Porzucone wgranie od AI (niedokończone od ponad doby).
  baza.obrazyAi = baza.obrazyAi || new Map();
  baza.obrazyAi.set('porzucone', { projekt_id: p.id, owner_id: KONTO, rozmiar: 10, dane: Buffer.alloc(10000), gotowy: false, utworzono: DAWNO });

  await strona.evaluate(() => { location.hash = '#/konto'; });
  await strona.waitForFunction(() => /z 10 GB/.test(document.querySelector('#miejsce-razem').textContent));
  // Konto wobec własnego limitu (R2, #92) i limity w jednym zdaniu.
  assert.match(await strona.textContent('#miejsce-konto'), /z 500 MB/);
  assert.match(await strona.textContent('#miejsce-limity'), /Projekty: \d+ z 30\. Jeden plik – najwyżej 25 MB/);
  assert.match(await strona.textContent('#miejsce-obrazy'), /kB|MB/);
  assert.match(await strona.textContent('#miejsce-czcionki'), /39 kB|40 kB/);
  assert.ok(await strona.isHidden('#miejsce-ostrzezenie'), 'mało zajęte – bez ostrzeżenia');

  // Posprzątaj: podsumowanie przed usunięciem, potem tylko osierocone i stare.
  await strona.click('#miejsce-posprzataj');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  const tresc = await strona.textContent('#dlg-potwierdz');
  assert.match(tresc, /Usunę 4 pliki/);
  assert.match(tresc, /zwolni się 547 kB/); // 300 000 + 200 000 + 50 000 + 10 000 B
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => /Posprzątane/.test(document.querySelector('#miejsce-komunikat').textContent));
  assert.ok(!baza.pliki.has(`zasoby/${KONTO}/${p.id}/z_stara_wersja`));
  assert.ok(!baza.pliki.has(`zasoby/${KONTO}/00000000-0000-4000-8000-000000000000/z_usuniety`));
  assert.ok(!baza.pliki.has(`podglady/${KONTO}/${p.id}/aaaaaaaaaaaaaaaa/s1.jpg`));
  assert.ok(!baza.obrazyAi.has('porzucone'));
  for (const zostaje of [`zasoby/${uzyty}`, `zasoby/${KONTO}/${p.id}/z_swiezy`, `zasoby/${KONTO}/_czcionki/moja.woff2`]) {
    assert.ok(baza.pliki.has(zostaje), `zostaje: ${zostaje}`);
  }

  // 80% limitu: ostrzeżenie w ustawieniach i przy wgrywaniu obrazu.
  baza.limitPlikow = 1024 * 1024;
  baza.inneKontaBajty = 900 * 1024;
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await strona.evaluate(() => { location.hash = '#/konto'; });
  await strona.waitForSelector('#miejsce-ostrzezenie:not([hidden])');
  assert.match(await strona.textContent('#miejsce-ostrzezenie'), /zajmują \d+% miejsca/);
  await strona.evaluate((id) => { location.hash = `#/p/${id}`; }, p.id);
  await strona.waitForSelector('#ekran-edytora', { state: 'visible' });
  await strona.setInputFiles('#pliki-zasoby', { name: 'drugi.png', mimeType: 'image/png', buffer: Buffer.concat([PNG_2X2, Buffer.from([0])]) });
  await strona.waitForFunction(() => /zajmują \d+% miejsca/.test(document.querySelector('#powiadomienie')?.textContent || ''), null, { timeout: 15000 });
  assert.deepEqual(bledy, []);
});

test('sprzątanie w tle przy liście projektów: raz na dobę, bez pliku używanego przez projekt w tej przeglądarce', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  const { p, uzyty } = await projektZObrazem(strona, baza);
  baza.pliki.set(`zasoby/${KONTO}/${p.id}/z_sierota`, { typ: 'image/png', tresc: Buffer.alloc(1000), czas: DAWNO });
  // Plik, na który wskazuje tylko projekt zapisany w tej przeglądarce (jeszcze niewysłany): nie wolno go usunąć.
  baza.pliki.set(`zasoby/${KONTO}/${p.id}/z_lokalny`, { typ: 'image/png', tresc: Buffer.alloc(1000), czas: DAWNO });
  // Inny projekt tylko w tej przeglądarce (np. utworzony bez sieci), wskazujący ten plik.
  await strona.evaluate(async ({ pid, sciezka }) => {
    const { wczytajLokalnie, zapiszLokalnie } = await import('./js/lokalny.js');
    const r = await wczytajLokalnie(pid);
    const kopia = { ...r.projekt, id: '22222222-2222-4222-8222-222222222222', nazwa: 'Tylko tutaj', zasoby: { z_lokalny: { nazwa: 'lokalny.png', typ: 'image/png', sciezka } } };
    await zapiszLokalnie(kopia, r.wlasciciel, true);
    localStorage.removeItem('sprzatanie-konta:11111111-1111-4111-8111-111111111111');
  }, { pid: p.id, sciezka: `${KONTO}/${p.id}/z_lokalny` });
  baza.pliki.get(`zasoby/${uzyty}`).czas = DAWNO;
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  const start = Date.now();
  while (baza.pliki.has(`zasoby/${KONTO}/${p.id}/z_sierota`) && Date.now() - start < 10000) await new Promise((ok) => { setTimeout(ok, 100); });
  assert.ok(!baza.pliki.has(`zasoby/${KONTO}/${p.id}/z_sierota`), 'osierocony plik usunięty w tle');
  assert.ok(baza.pliki.has(`zasoby/${KONTO}/${p.id}/z_lokalny`), 'plik projektu z tej przeglądarki zostaje');
  assert.ok(baza.pliki.has(`zasoby/${uzyty}`), 'używany plik zostaje');
  // Drugi raz tego samego dnia – bez sprzątania.
  baza.pliki.set(`zasoby/${KONTO}/${p.id}/z_druga_sierota`, { typ: 'image/png', tresc: Buffer.alloc(1000), czas: DAWNO });
  await strona.evaluate(() => { location.hash = `#/konto`; });
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await strona.waitForTimeout(1500);
  assert.ok(baza.pliki.has(`zasoby/${KONTO}/${p.id}/z_druga_sierota`), 'najwyżej raz na dobę');
  assert.deepEqual(bledy, []);
});

// Prawdziwy rdzeń łącznika AI na atrapie bazy – zmiany „z innego urządzenia”.
async function lacznik(t, baza, klucz) {
  const serwer = http.createServer((req, res) => {
    let tresc = '';
    req.on('data', (c) => { tresc += c; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      try { res.end(JSON.stringify(baza.ai(req.url.replace('/rest/v1/rpc/', ''), JSON.parse(tresc || '{}')) ?? null)); } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ message: e.message })); }
    });
  });
  await new Promise((r) => { serwer.listen(0, '127.0.0.1', r); });
  t.after(() => serwer.close());
  const { utworzSerwer } = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'seriodruk-mcp-rdzen.mjs')).href);
  const s = utworzSerwer({ adres: `http://127.0.0.1:${serwer.address().port}`, kluczPubliczny: 'sb_publishable_test', klucz });
  return async (name, args) => {
    const w = await s.obsluz({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
    if (w.result.isError) throw new Error(w.result.content[0].text);
  };
}

test('łączenie zmian z konta pobiera tylko zmienione strony (skróty stron w bazie)', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Duży projekt');
  for (let i = 0; i < 11; i += 1) await strona.click('#przycisk-dodaj-strone');
  // Każda strona z tekstem, żeby pełne pobranie było widać w liczbach.
  await strona.evaluate(() => {
    for (const s of window.seriodruk.stan.projekt.strony) s.obiekty.push({ type: 'textbox', id: `t-${s.id}`, text: 'Lorem ipsum dolor sit amet '.repeat(80), left: 10, top: 10, width: 100 });
  });
  await strona.evaluate(async () => { const z = await import('./js/app/zapis.js'); z.odlaczPlotno(); await z.zaladujCel(); z.zaplanujZapis(); });
  await zapisano(strona);
  await strona.waitForTimeout(1500);
  const { klucz } = await strona.evaluate(async (id) => (await import('./js/chmura.js')).utworzDostepAi(id, { opis: 'AI', dni: 1 }), baza.projekty[0].id);
  const ai = await lacznik(t, baza, klucz);
  const ostatnia = baza.projekty[0].dane.strony.at(-1);
  const pomiar = async (tekst) => {
    baza.pobraneStrony = 0;
    await ai('zmien_elementy', { gdzie: `strona:${ostatnia}`, zmiany: [{ id: `t-${ostatnia}`, pola: { text: tekst } }] });
    await strona.waitForFunction((x) => window.seriodruk.stan.projekt.strony.at(-1).obiekty.some((o) => o.text === x), tekst, { timeout: 15000 });
    await strona.waitForTimeout(500);
    return baza.pobraneStrony;
  };
  const pierwsze = await pomiar('Pierwsza zmiana od AI');
  const drugie = await pomiar('Druga zmiana od AI');
  const caly = [...baza.strony].filter(([k]) => k.startsWith(`${baza.projekty[0].id}/`)).reduce((n, [, d]) => n + JSON.stringify(d).length, 0);
  console.log(`# pobrane strony przy łączeniu: ${pierwsze} B, potem ${drugie} B; cały projekt: ${caly} B`);
  assert.ok(drugie < caly / 4, `druga zmiana pobrała ${drugie} B z ${caly} B`);
  assert.equal(baza.projekty[0].dane.strony.length, 12);
  assert.deepEqual(bledy, []);
});
