const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Dwanaście „zdjęć” 1800 × 1200 px z szumem (słabo się kompresują – jak prawdziwe zdjęcia), wstawionych na stronę.
const dodajZdjecia = (strona, ile) => strona.evaluate(async (n) => {
  const { edytor, stan } = window.seriodruk;
  const c = Object.assign(document.createElement('canvas'), { width: 1800, height: 1200 });
  const x = c.getContext('2d');
  const dane = x.createImageData(c.width, c.height);
  const rozmiary = [];
  for (let k = 0; k < n; k += 1) {
    for (let i = 0; i < dane.data.length; i += 4) { dane.data[i] = Math.random() * 255; dane.data[i + 1] = Math.random() * 255; dane.data[i + 2] = (k * 20) % 255; dane.data[i + 3] = 255; }
    x.putImageData(dane, 0, 0);
    const url = c.toDataURL('image/jpeg', 0.85);
    rozmiary.push(url.length);
    const img = await edytor.dodajObraz(url, `zdjecie-${k + 1}.jpg`, stan.projekt.zasoby);
    img.set({ left: 5 + (k % 4) * 35, top: 10 + Math.floor(k / 4) * 30, scaleX: 30 / 1800, scaleY: 30 / 1800 });
    img.setCoords();
  }
  edytor.canvas.discardActiveObject();
  edytor.zatwierdz();
  return rozmiary;
}, ile);

const pomiar = (strona) => strona.evaluate(async () => {
  const { stan } = window.seriodruk;
  const { wczytajLokalnie } = await import('./js/lokalny.js');
  const rekord = await wczytajLokalnie(stan.projekt.id);
  const pliki = await (await import('./js/zasoby.js')).spisPlikow();
  return {
    wPamieci: JSON.stringify(stan.projekt).length,
    wRekordzie: rekord ? JSON.stringify(rekord.projekt).length : 0,
    zTrescia: Object.values(stan.projekt.zasoby).filter((z) => z.dataUrl).length,
    opisy: Object.values(stan.projekt.zasoby).map((z) => Object.keys(z).sort().join(',')),
    oryginaly: pliki.filter(([k]) => !k.startsWith('kopia:')).map(([, r]) => r),
    kopie: pliki.filter(([k]) => k.startsWith('kopia:')).length,
  };
});

const obrazyNaPlotnie = (strona) => strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'image').map((o) => [o.getElement().naturalWidth > 0, o.width, o.height]));

test('obrazy poza pamięcią: po zapisie w projekcie zostaje opis, oryginały leżą w magazynie plików; pomiar', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Zdjecia');
  const rozmiary = await dodajZdjecia(strona, 12);
  const przed = await pomiar(strona);
  assert.equal(przed.zTrescia, 12, 'świeżo dodane obrazy mają jeszcze treść w projekcie');

  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  const po = await pomiar(strona);
  t.diagnostic(`12 zdjęć, razem ${(rozmiary.reduce((a, b) => a + b, 0) / 1e6).toFixed(1)} MB tekstu „data:”. Dane projektu w pamięci: przed zapisem ${(przed.wPamieci / 1e6).toFixed(2)} MB, po ${(po.wPamieci / 1e3).toFixed(1)} kB. Rekord zapisu lokalnego: ${(po.wRekordzie / 1e3).toFixed(1)} kB. Oryginały na dysku: ${(po.oryginaly.reduce((a, b) => a + b, 0) / 1e6).toFixed(1)} MB w ${po.oryginaly.length} plikach.`);
  assert.equal(po.zTrescia, 0, 'po zapisie treść obrazów znika z projektu');
  // Opis obrazu: nazwa, rozmiar, typ – a gdy plik zdążył już trafić na konto, także ścieżka do niego.
  assert.ok(po.opisy.every((o) => ['nazwa,rozmiar,typ', 'nazwa,rozmiar,sciezka,typ'].includes(o)), `opisy obrazów: ${[...new Set(po.opisy)]}`);
  assert.equal(po.oryginaly.length, 12);
  assert.ok(po.wPamieci < przed.wPamieci / 100, `dane projektu w pamięci zmalały ponad stukrotnie (${przed.wPamieci} → ${po.wPamieci})`);
  assert.ok(po.wRekordzie < 200000, `rekord zapisu lokalnego jest mały (${po.wRekordzie})`);
  // Oryginał jest nietknięty: te same bajty co plik wstawiony na stronę.
  const zgodne = await strona.evaluate(async (dl) => {
    const { dataUrlZasobu } = await import('./js/zasoby.js');
    const p = window.seriodruk.stan.projekt;
    const id = p.strony[0].obiekty[0].zasob;
    const d = await dataUrlZasobu(p, id);
    return [d.length === dl, d.slice(0, 23)];
  }, rozmiary[0]);
  assert.deepEqual(zgodne, [true, 'data:image/jpeg;base64,']);

  // Ponowne otwarcie aplikacji: obrazy wczytują się z magazynu, a kopie robocze nie powstają od nowa z oryginałów.
  await strona.reload(); // adres strony pamięta otwarty projekt – po wejściu aplikacja otwiera go od razu
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.canvas.getObjects().filter((o) => o.type === 'image').length === 12);
  const naPlotnie = await obrazyNaPlotnie(strona);
  assert.deepEqual(naPlotnie, Array(12).fill([true, 1800, 1200]), 'obrazy są na płótnie i mają wymiary oryginału');
  const poOtwarciu = await pomiar(strona);
  assert.equal(poOtwarciu.zTrescia, 0);
  assert.ok(poOtwarciu.wPamieci < 200000, `po otwarciu projekt w pamięci jest mały (${poOtwarciu.wPamieci})`);

  // Eksport w pełnej jakości sięga po oryginał tylko dla rysowanej strony; plik projektu zawiera wszystkie obrazy.
  const eksport = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const { pngCelu } = await import('./js/eksport.js');
    const { zapiszPlikProjektu, wczytajPlikProjektu } = await import('./js/plik-projektu.js');
    const png = await pngCelu(p, p.strony[0], 72);
    const plik = await zapiszPlikProjektu(p);
    const wczytany = await wczytajPlikProjektu(new File([plik], 'x.seriodruk'));
    return { png: png.slice(0, 22), plik: plik.size, wPliku: Object.values(wczytany.zasoby).filter((z) => z.dataUrl?.startsWith('data:image/jpeg')).length, tresc: Object.values(p.zasoby).filter((z) => z.dataUrl).length };
  });
  assert.equal(eksport.png, 'data:image/png;base64,');
  assert.equal(eksport.wPliku, 12, 'plik projektu niesie wszystkie obrazy');
  assert.ok(eksport.plik > rozmiary.reduce((a, b) => a + b, 0) * 0.6, 'plik projektu zawiera oryginały');
  assert.equal(eksport.tresc, 0, 'eksport nie zostawia treści obrazów w projekcie');

  // Kopia projektu ma własne pliki (podmiana zdjęcia w kopii nie rusza oryginału); po usunięciu oryginału
  // jej obrazy zostają, po usunięciu obu – magazyn jest pusty.
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await strona.click('#ekran-edytora [data-akcja="do-projektow"]');
  await strona.waitForSelector('.karta-projektu:not(.szkielet)');
  await strona.click('.karta-projektu:has-text("Zdjecia") .menu-karty');
  await strona.click('.karta-projektu:has-text("Zdjecia") [data-op="duplikuj"]');
  await strona.waitForSelector('.karta-projektu:has-text("Zdjecia (kopia)")');
  const poKopii = await strona.evaluate(async () => (await (await import('./js/zasoby.js')).spisPlikow()).filter(([k]) => !k.startsWith('kopia:')).map(([k]) => k.split('/')[0]));
  assert.deepEqual([poKopii.length, new Set(poKopii).size], [24, 2], 'dwa projekty, każdy ze swoimi dwunastoma plikami');
  const usun = async (nazwa) => {
    await strona.click(`.karta-projektu:has(strong:text-is("${nazwa}")) .menu-karty`);
    await strona.click(`.karta-projektu:has(strong:text-is("${nazwa}")) [data-op="usun"]`);
    await strona.click('#potwierdz-tak');
    await strona.waitForFunction((n) => ![...document.querySelectorAll('.karta-projektu strong')].some((s) => s.textContent === n), nazwa);
  };
  await usun('Zdjecia');
  await strona.click('.karta-projektu:has-text("Zdjecia (kopia)")');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa === 'Zdjecia (kopia)' && window.seriodruk.edytor?.canvas.getObjects().filter((o) => o.type === 'image').length === 12);
  assert.deepEqual(await obrazyNaPlotnie(strona), Array(12).fill([true, 1800, 1200]), 'kopia projektu ma swoje obrazy po usunięciu oryginału');
  assert.equal((await pomiar(strona)).oryginaly.length, 12);
  await strona.click('#ekran-edytora [data-akcja="do-projektow"]');
  await strona.waitForSelector('.karta-projektu:not(.szkielet)');
  await usun('Zdjecia (kopia)');
  const pusty = await strona.evaluate(async () => (await (await import('./js/zasoby.js')).spisPlikow()).length);
  assert.equal(pusty, 0, 'po usunięciu projektów magazyn plików jest pusty');
  assert.deepEqual(bledy, []);
});

test('starszy zapis z obrazami w środku projektu przechodzi do magazynu plików przy pierwszym otwarciu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Stary zapis');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  // Rekord w dawnym układzie: obraz jako tekst „data:” w samym projekcie.
  await strona.evaluate(async () => {
    const p = JSON.parse(JSON.stringify(window.seriodruk.stan.projekt));
    const c = Object.assign(document.createElement('canvas'), { width: 60, height: 40 });
    const x = c.getContext('2d'); x.fillStyle = '#d00000'; x.fillRect(0, 0, 60, 40);
    p.zasoby.z_stary = { nazwa: 'stary.png', dataUrl: c.toDataURL('image/png') };
    p.strony[0].obiekty = [{ type: 'image', version: '5.3.0', left: 20, top: 20, width: 60, height: 40, src: 'zasob:z_stary', zasob: 'z_stary', id: 'o_stary' }];
    await new Promise((ok, blad) => {
      const req = indexedDB.open('seriodruk');
      req.onsuccess = () => { const tx = req.result.transaction('projekty', 'readwrite'); tx.objectStore('projekty').put({ id: p.id, wlasciciel: window.seriodruk.stan.uzytkownik.id, nazwa: p.nazwa, zmieniono: p.zmieniono, miniatura: null, projekt: p, doSynchronizacji: false }); tx.oncomplete = () => { req.result.close(); ok(); }; tx.onerror = () => blad(tx.error); };
    });
  });
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((o) => o.type === 'image' && o.getElement().naturalWidth === 60));
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.zasoby.z_stary.szer === 60); // wymiary uzupełniane po otwarciu
  const w = await strona.evaluate(async () => {
    const { wczytajLokalnie } = await import('./js/lokalny.js');
    const { dataUrlZasobu } = await import('./js/zasoby.js');
    const p = window.seriodruk.stan.projekt;
    const rekord = await wczytajLokalnie(p.id);
    return { wProjekcie: Object.keys(p.zasoby.z_stary).sort(), wRekordzie: Object.keys(rekord.projekt.zasoby.z_stary).sort(), oryginal: (await dataUrlZasobu(p, 'z_stary')).slice(0, 22) };
  });
  // Bez treści pliku w projekcie; po otwarciu opis dostaje też wymiary z nagłówka pliku (dla łącznika AI).
  assert.deepEqual(w.wProjekcie, ['nazwa', 'rozmiar', 'szer', 'typ', 'wys']);
  assert.deepEqual(w.wRekordzie.filter((k) => !['szer', 'wys'].includes(k)), ['nazwa', 'rozmiar', 'typ']);
  assert.equal(w.oryginal, 'data:image/png;base64,');
  assert.deepEqual(bledy, []);
});

test('obrazy na koncie: drugie urządzenie pobiera je prosto do magazynu plików, tylko raz', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  const zaloguj = async () => {
    await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
    await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
    await strona.click('#przycisk-logowania');
  };
  await zaloguj();
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.click('[data-akcja="zamknij-instrukcje"]');
  await nowyProjekt(strona, 'Na koncie');
  await dodajZdjecia(strona, 2);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await strona.waitForFunction(() => Object.values(window.seriodruk.stan.projekt.zasoby).every((z) => z.sciezka) && document.querySelector('#stan-zapisu .tekst')?.textContent === 'Zapisano', null, { timeout: 20000 });
  const naKoncie = [...baza.pliki.keys()].filter((k) => k.startsWith('zasoby/') && !k.includes('_czcionki'));
  assert.equal(naKoncie.length, 2, 'oba obrazy są na koncie');
  assert.ok(baza.pliki.get(naKoncie[0]).tresc.length > 100000, 'na konto poszedł cały plik');

  // „Drugie urządzenie”: przeglądarka bez zapisanych projektów i bez magazynu plików.
  await strona.evaluate(() => Promise.all(['seriodruk', 'seriodruk-zasoby'].map((n) => new Promise((ok) => { const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = () => ok(); }))));
  const pobrania = () => baza.zadania.filter((z) => z.startsWith('GET /pliki/') && !z.includes('_czcionki')).length;
  const przedtem = pobrania();
  await strona.reload(); // sesja i adres projektu zostają – aplikacja otwiera go od razu
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.canvas.getObjects().filter((o) => o.type === 'image' && o.getElement().naturalWidth > 0).length === 2);
  assert.equal(pobrania() - przedtem, 2, 'każdy obraz pobrany raz');
  const w = await strona.evaluate(() => Object.values(window.seriodruk.stan.projekt.zasoby).map((z) => [Boolean(z.sciezka), Boolean(z.dataUrl), z.typ]));
  assert.deepEqual(w, [[true, false, 'image/jpeg'], [true, false, 'image/jpeg']]);
  // Ponowne otwarcie: obrazy są już na urządzeniu, konto nie jest pytane o pliki.
  await strona.click('#ekran-edytora [data-akcja="do-projektow"]');
  await strona.waitForSelector('.karta-projektu:not(.szkielet)');
  const przedDrugim = pobrania();
  await strona.click('.karta-projektu:has-text("Na koncie")');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.canvas.getObjects().filter((o) => o.type === 'image' && o.getElement().naturalWidth > 0).length === 2);
  assert.equal(pobrania() - przedDrugim, 0);
  assert.deepEqual(bledy, []);
});
