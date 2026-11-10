const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const PLIK_CZCIONKI = fs.readFileSync(path.join(__dirname, '..', 'css', 'czcionki', 'caveat-prosta-400-700-latin.woff2'));

test('czcionki (obliczenia): nazwa rodziny, waga i kursywa z pliku TTF oraz z nazwy pliku', async (t) => {
  const { strona } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const { opisCzcionki, czcionkaZNazwyPliku } = await import('./js/czcionki.js');
    // Najmniejszy plik w układzie TTF: tabela nazw (rodzina, odmiana, rodzina typograficzna) i OS/2 (waga, kursywa).
    const zbuduj = ({ nazwy, waga, kursywa }) => {
      const teksty = nazwy.map(([, t]) => { const b = new Uint8Array(t.length * 2); [...t].forEach((z, i) => { b[i * 2 + 1] = z.charCodeAt(0); }); return b; });
      const dlTekstow = teksty.reduce((s, b) => s + b.length, 0);
      const name = new DataView(new ArrayBuffer(6 + nazwy.length * 12 + dlTekstow));
      name.setUint16(2, nazwy.length); name.setUint16(4, 6 + nazwy.length * 12);
      let o = 0;
      nazwy.forEach(([id], i) => { const r = 6 + i * 12; name.setUint16(r, 3); name.setUint16(r + 2, 1); name.setUint16(r + 4, 0x409); name.setUint16(r + 6, id); name.setUint16(r + 8, teksty[i].length); name.setUint16(r + 10, o); new Uint8Array(name.buffer).set(teksty[i], 6 + nazwy.length * 12 + o); o += teksty[i].length; });
      const os2 = new DataView(new ArrayBuffer(96)); os2.setUint16(4, waga); os2.setUint16(62, kursywa ? 1 : 0);
      const tabele = [['OS/2', os2], ['name', name]];
      const plik = new DataView(new ArrayBuffer(12 + tabele.length * 16 + os2.byteLength + name.byteLength));
      plik.setUint32(0, 0x00010000); plik.setUint16(4, tabele.length);
      let gdzie = 12 + tabele.length * 16;
      tabele.forEach(([znacznik, dane], i) => { const r = 12 + i * 16; [...znacznik].forEach((z, k) => plik.setUint8(r + k, z.charCodeAt(0))); plik.setUint32(r + 8, gdzie); plik.setUint32(r + 12, dane.byteLength); new Uint8Array(plik.buffer).set(new Uint8Array(dane.buffer), gdzie); gdzie += dane.byteLength; });
      return plik.buffer;
    };
    return {
      zPliku: await opisCzcionki(zbuduj({ nazwy: [[1, 'Moja Rodzina Black'], [2, 'Italic'], [16, 'Moja Rodzina']], waga: 900, kursywa: true }), 'cokolwiek.ttf'),
      bezTypograficznej: await opisCzcionki(zbuduj({ nazwy: [[1, 'Prosta'], [2, 'Regular']], waga: 400, kursywa: false }), 'x.otf'),
      zepsuty: await opisCzcionki(new ArrayBuffer(40), 'Lato-LightItalic.ttf'),
      zNazw: ['Lato-BoldItalic.woff2', 'OpenSans_SemiBold.ttf', 'Merriweather Sans ExtraBold.otf', 'JosefinSans-VariableFont_wght.ttf', 'kaligrafia.woff'].map((n) => { const c = czcionkaZNazwyPliku(n); return [c.rodzina, c.waga, c.kursywa]; }),
    };
  });
  assert.deepEqual(w.zPliku, { rodzina: 'Moja Rodzina', waga: 900, kursywa: true });
  assert.deepEqual(w.bezTypograficznej, { rodzina: 'Prosta', waga: 400, kursywa: false });
  assert.deepEqual(w.zepsuty, { rodzina: 'Lato', waga: 300, kursywa: true });
  assert.deepEqual(w.zNazw, [['Lato', 700, true], ['Open Sans', 600, false], ['Merriweather Sans', 800, false], ['Josefin Sans wght', 400, false], ['kaligrafia', 400, false]]);
});

test('własna czcionka: wgranie z panelu tekstu, okno czcionek, zapis w projekcie, pliki czcionek w eksporcie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wlasne czcionki');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.dodajTekst('Zażółć gęślą jaźń'); o.set({ top: 30 }); e.zatwierdz(); });

  // „+ Wgraj własną czcionkę…” na liście czcionek otwiera wybór pliku; zaznaczony tekst dostaje nową czcionkę.
  const [wybor] = await Promise.all([strona.waitForEvent('filechooser'), strona.selectOption('.wlasciwosci label:has-text("Czcionka") select', '+')]);
  await wybor.setFiles([{ name: 'Odreczna-Bold.woff2', mimeType: 'font/woff2', buffer: PLIK_CZCIONKI }, { name: 'notatki.txt', mimeType: 'text/plain', buffer: Buffer.from('to nie czcionka') }]);
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.czcionki?.length === 1);
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.fontFamily === 'Odreczna');
  const stan = await strona.evaluate(async () => {
    await window.seriodruk.zapiszTeraz();
    const p = window.seriodruk.stan.projekt;
    const c = p.czcionki[0];
    return {
      wpis: [c.rodzina, c.waga, c.kursywa], zasob: [p.zasoby[c.id].nazwa, p.zasoby[c.id].dataUrl.slice(0, 20)],
      wPrzegladarce: [...document.fonts].some((f) => f.family === 'Odreczna' && f.weight === '700' && f.status === 'loaded'),
      tekst: p.strony[0].obiekty[0].fontFamily,
      lista: [...document.querySelectorAll('.wlasciwosci label')].find((l) => l.textContent.startsWith('Czcionka')).querySelectorAll('option')[0].value,
    };
  });
  assert.deepEqual(stan.wpis, ['Odreczna', 700, false]);
  assert.deepEqual(stan.zasob, ['Odreczna-Bold.woff2', 'data:font/woff2;base']);
  assert.ok(stan.wPrzegladarce, 'przeglądarka zna nową czcionkę');
  assert.equal(stan.tekst, 'Odreczna');
  assert.equal(stan.lista, 'Odreczna', 'własne czcionki są na początku listy');

  // Eksport PDF z plikami czcionek: archiwum z PDF i folderem „czcionki” (wgrany plik; wbudowane tylko, gdy są użyte).
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.odznacz(); const o = e.dodajTekst('Drugi tekst'); o.set({ top: 80, fontFamily: 'Lora' }); e.canvas.discardActiveObject(); e.zatwierdz(); });
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  await strona.selectOption('#form-pdf select[name=dpi]', '150');
  await strona.check('#form-pdf input[name=czcionki]');
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  assert.equal(plik.suggestedFilename(), 'Wlasne czcionki - PDF.zip');
  const pliki = await strona.evaluate(async () => Object.keys((await window.JSZip.loadAsync(window.seriodruk.oknoPdf.ostatni.blob)).files).filter((n) => !n.endsWith('/')).sort());
  assert.deepEqual(pliki, ['Wlasne czcionki.pdf', 'czcionki/LICENCJA czcionek Seriodruku.txt', 'czcionki/Lora-Bold.ttf', 'czcionki/Lora-BoldItalic.ttf', 'czcionki/Lora-Italic.ttf', 'czcionki/Lora-Regular.ttf', 'czcionki/Odreczna-Bold.woff2']);

  // Okno „Czcionki”: lista, poprawka nazwy rodziny (teksty idą za nią), usunięcie.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="czcionki"]');
  await strona.waitForSelector('#dlg-czcionki[open]');
  assert.equal(await strona.textContent('#czcionki-wlasne .opis'), 'Bold · Odreczna-Bold.woff2 · używana');
  // Oficjalny zestaw czcionek aplikacji: lista rodzin z próbkami, pliki do pobrania (jedna rodzina albo cały zestaw).
  assert.deepEqual(await strona.evaluate(() => [...document.querySelectorAll('#czcionki-zestaw li')].map((li) => li.dataset.rodzina)), ['Inter', 'Open Sans', 'Montserrat', 'Lora', 'Merriweather', 'Playfair Display', 'Source Serif 4', 'Caveat']);
  assert.match(await strona.textContent('#czcionki-zestaw li[data-rodzina="Lora"] .opis'), /szeryfowa · zwykła i pogrubiona, prosta i kursywa · używana w tym projekcie/);
  const [zestaw] = await Promise.all([strona.waitForEvent('download'), strona.click('#czcionki-pobierz-zestaw')]);
  assert.equal(zestaw.suggestedFilename(), 'Czcionki Seriodruku.zip');
  const wZestawie = await strona.evaluate(async () => Object.keys((await window.JSZip.loadAsync(window.seriodruk.oknoCzcionek.ostatniZestaw.blob)).files).filter((n) => !n.endsWith('/')));
  assert.equal(wZestawie.filter((n) => n.endsWith('.ttf')).length, 30, 'osiem rodzin: siedem po cztery odmiany i jedna z dwiema');
  assert.ok(wZestawie.includes('Open Sans/OpenSans-BoldItalic.ttf') && wZestawie.includes('Caveat/Caveat-Bold.ttf') && wZestawie.includes('LICENCJA czcionek Seriodruku.txt'));
  const [jedna] = await Promise.all([strona.waitForEvent('download'), strona.click('#czcionki-zestaw li[data-rodzina="Inter"] button')]);
  assert.equal(jedna.suggestedFilename(), 'Czcionka Inter.zip');
  await strona.fill('#czcionki-wlasne input[data-rodzina]', 'Pismo odręczne');
  await strona.press('#czcionki-wlasne input[data-rodzina]', 'Tab');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].obiekty[0].fontFamily === 'Pismo odręczne');
  await strona.waitForFunction(() => [...document.fonts].some((f) => /Pismo/.test(f.family)));
  assert.deepEqual(await strona.evaluate(() => [...document.fonts].map((f) => f.family.replace(/"/g, '')).filter((n) => /odr/i.test(n))), ['Pismo odręczne']);
  await strona.click('#czcionki-wlasne [data-usun]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.czcionki.length === 0);
  const poUsunieciu = await strona.evaluate(() => { const p = window.seriodruk.stan.projekt; return [Object.keys(p.zasoby).length, p.strony[0].obiekty[0].fontFamily]; });
  assert.deepEqual(poUsunieciu, [0, 'Pismo odręczne'], 'plik znika z projektu; tekst zostaje z nazwą czcionki i pokazuje się zastępczą');
  await strona.waitForSelector('#czcionki-pusto', { state: 'visible' });
  assert.deepEqual(bledy, []);
});

test('własna czcionka w pliku projektu: po eksporcie i imporcie czcionka wraca razem z projektem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Z czcionką');
  const wynik = await strona.evaluate(async (b64) => {
    const { stan, zapiszTeraz } = window.seriodruk;
    const { dodajCzcionkiDoProjektu, zarejestrujCzcionkiProjektu } = await import('./js/czcionki.js');
    const { zapiszPlikProjektu, wczytajPlikProjektu } = await import('./js/plik-projektu.js');
    const { uid, normalizuj } = await import('./js/projekt.js');
    const plik = new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'Moja Ozdobna-Italic.woff2', { type: 'font/woff2' });
    await dodajCzcionkiDoProjektu(stan.projekt, [plik], uid);
    await zapiszTeraz();
    const zapisany = await zapiszPlikProjektu(stan.projekt, null);
    const blob = zapisany instanceof Blob ? zapisany : zapisany.blob || zapisany;
    const wczytany = normalizuj(await wczytajPlikProjektu(new File([blob], 'x.seriodruk')));
    // „Nowa sesja”: przeglądarka nie zna czcionki, dopóki projekt jej nie zarejestruje.
    stan.projekt.czcionki = [];
    await zarejestrujCzcionkiProjektu(stan.projekt);
    const jest = () => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Moja Ozdobna' && f.style === 'italic');
    const przed = jest();
    const bledy = await zarejestrujCzcionkiProjektu(wczytany);
    const c = wczytany.czcionki[0];
    return { przed, po: jest(), bledy, wpis: [c.rodzina, c.waga, c.kursywa], typ: wczytany.zasoby[c.id].dataUrl.slice(0, 15), nazwa: wczytany.zasoby[c.id].nazwa };
  }, PLIK_CZCIONKI.toString('base64'));
  assert.equal(wynik.przed, false);
  assert.equal(wynik.po, true);
  assert.deepEqual(wynik.bledy, []);
  assert.deepEqual(wynik.wpis, ['Moja Ozdobna', 400, true]);
  assert.equal(wynik.typ, 'data:font/woff2');
  assert.equal(wynik.nazwa, 'Moja Ozdobna-Italic.woff2');
  assert.deepEqual(bledy, []);
});

const wgraj = (strona, nazwa) => strona.evaluate(async ([b64, n]) => {
  const plik = new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], n, { type: 'font/woff2' });
  await window.seriodruk.oknoCzcionek.dodaj([plik]);
}, [PLIK_CZCIONKI.toString('base64'), nazwa]);
const opcjeCzcionek = (strona) => strona.evaluate(() => [...[...document.querySelectorAll('.wlasciwosci label')].find((l) => l.textContent.startsWith('Czcionka')).querySelectorAll('option')].map((o) => o.value));
const doProjektow = async (strona) => {
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await strona.click('#ekran-edytora [data-akcja="do-projektow"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
};

test('moje czcionki: czcionka wgrana w jednym projekcie jest pod ręką w następnym; usunięta nie wraca', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Pierwszy');
  await wgraj(strona, 'Odreczna-Bold.woff2');
  await wgraj(strona, 'Odreczna-Regular.woff2');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.czcionki?.length === 2);
  await doProjektow(strona);

  // W nowym projekcie czcionki nie ma, ale lista w panelu tekstu ją proponuje.
  await nowyProjekt(strona, 'Drugi');
  assert.equal(await strona.evaluate(() => (window.seriodruk.stan.projekt.czcionki || []).length), 0);
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.waitForFunction(() => window.seriodruk.stan.mojeRodziny?.length === 1);
  await strona.waitForFunction(() => [...document.querySelectorAll('.wlasciwosci option')].some((o) => o.value === 'moja:Odreczna'));
  // Wybranie jej dodaje do projektu wszystkie odmiany i ustawia czcionkę zaznaczonego tekstu.
  await strona.selectOption('.wlasciwosci label:has-text("Czcionka") select', 'moja:Odreczna');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.czcionki?.length === 2);
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.fontFamily === 'Odreczna');
  await strona.waitForFunction(() => window.seriodruk.stan.mojeRodziny.length === 0);
  const opcje = await opcjeCzcionek(strona);
  assert.equal(opcje[0], 'Odreczna');
  assert.ok(!opcje.includes('moja:Odreczna'), 'czcionka jest już w projekcie, nie na liście „moich”');
  assert.ok(await strona.evaluate(() => [...document.fonts].some((f) => f.family === 'Odreczna' && f.weight === '700' && f.status === 'loaded')));

  // Usunięta z projektu wraca do „Moich czcionek” w oknie; stamtąd da się ją dodać przyciskiem albo usunąć na dobre.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="czcionki"]');
  await strona.waitForSelector('#dlg-czcionki[open]');
  assert.ok(await strona.isVisible('#czcionki-moje-pusto'));
  for (let i = 0; i < 2; i += 1) {
    await strona.click('#czcionki-wlasne [data-usun] >> nth=0');
    if (await strona.isVisible('#dlg-potwierdz[open]')) await strona.click('#potwierdz-tak');
    await strona.waitForFunction((n) => window.seriodruk.stan.projekt.czcionki.length === n, 1 - i);
  }
  await strona.waitForSelector('#czcionki-moje li');
  assert.equal(await strona.textContent('#czcionki-moje .probka'), 'Odreczna');
  assert.equal(await strona.textContent('#czcionki-moje .opis'), 'Regular, Bold · 2 pliki');
  await strona.click('#czcionki-moje [data-dodaj]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.czcionki.length === 2);
  await strona.waitForFunction(() => !document.querySelector('#czcionki-moje li'));

  // „Usuń z moich czcionek”: projekt zachowuje kopię, ale w następnych projektach czcionki już nie ma –
  // także po ponownym otwarciu projektu, który jej używa.
  await strona.evaluate(async () => { const { zapomnij } = await import('./js/moje-czcionki.js'); await zapomnij('lokalny', 'Odreczna'); });
  await strona.click('#czcionki-zamknij');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.czcionki.length), 2);
  await doProjektow(strona);
  await strona.click('.karta-projektu:has-text("Pierwszy")');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa === 'Pierwszy' && window.seriodruk.edytor.wydruk);
  await doProjektow(strona);
  await nowyProjekt(strona, 'Trzeci');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.waitForTimeout(300);
  assert.ok(!(await opcjeCzcionek(strona)).some((o) => o.startsWith('moja:')));
  assert.deepEqual(bledy, []);
});

test('moje czcionki na koncie: plik i spis w prywatnym folderze, drugie urządzenie dostaje czcionkę, usunięcie znika wszędzie', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.click('[data-akcja="zamknij-instrukcje"]');
  const folder = 'zasoby/11111111-1111-4111-8111-111111111111/_czcionki/';
  const naKoncie = () => [...baza.pliki.keys()].filter((k) => k.startsWith(folder)).map((k) => k.slice(folder.length));
  const spis = () => JSON.parse(baza.pliki.get(`${folder}spis.json`).tresc.toString());
  const czekaj = async (warunek) => { for (let i = 0; i < 100 && !warunek(); i += 1) await strona.waitForTimeout(100); assert.ok(warunek(), 'konto nie dostało zmiany na czas'); };

  await nowyProjekt(strona, 'Z kontem');
  await wgraj(strona, 'Odreczna-Bold.woff2');
  await czekaj(() => naKoncie().includes('spis.json'));
  assert.equal(naKoncie().length, 2, 'spis i jeden plik czcionki');
  assert.deepEqual(spis().czcionki.map((c) => [c.klucz, c.nazwa]), [['Odreczna|700|0', 'Odreczna-Bold.woff2']]);
  assert.ok(baza.pliki.get(folder + spis().czcionki[0].plik).tresc.equals(PLIK_CZCIONKI), 'na koncie leży ten sam plik');
  await doProjektow(strona);

  // „Drugie urządzenie”: ta sama osoba, przeglądarka bez zbioru czcionek.
  await strona.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('seriodruk-czcionki'); r.onsuccess = r.onerror = r.onblocked = () => ok(); }));
  await nowyProjekt(strona, 'Na drugim urządzeniu');
  await strona.waitForFunction(() => window.seriodruk.stan.mojeRodziny?.includes('Odreczna'));
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.waitForFunction(() => [...document.querySelectorAll('.wlasciwosci option')].some((o) => o.value === 'moja:Odreczna'));

  // Usunięcie z moich czcionek: plik znika z konta, w spisie zostaje znacznik.
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="czcionki"]');
  await strona.waitForSelector('#czcionki-moje li');
  await strona.click('#czcionki-moje [data-zapomnij]');
  await czekaj(() => naKoncie().length === 1);
  assert.deepEqual(spis(), { czcionki: [], usuniete: ['Odreczna|700|0'] });
  await strona.waitForFunction(() => !document.querySelector('#czcionki-moje li'));
  assert.deepEqual(bledy, []);
});
