// Kolory projektu z podziałem na sekcje (#167): tryb kolorów sekcji (np. okładka w pełnym kolorze, środek w skali
// szarości) w modelu, PDF i oknie „Kolory projektu”; zamiana koloru w zakresie z cofaniem; farba specjalna
// (kolor dodatkowy) tworzona prosto z Właściwości; telefon.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Projekt z dwiema sekcjami: „Okładka” (jak projekt – pełny kolor) i „Środek”; na każdej stronie czerwony prostokąt.
async function dwieSekcje(strona, { trybSrodka = null } = {}) {
  await strona.evaluate(async (tryb) => {
    const P = await import('./js/projekt.js');
    const p = P.nowyProjekt('Sekcje');
    const okl = p.sekcje[0];
    okl.nazwa = 'Okładka';
    const srodek = P.nowaSekcja('Środek', okl.wydruk);
    if (tryb) srodek.tryb_kolorow = tryb;
    p.sekcje.push(srodek);
    const prost = (id, fill) => ({ type: 'rect', version: '5.3.0', left: 20, top: 20, width: 40, height: 30, fill, id });
    p.strony[0].obiekty = [prost('a', '#d02020')];
    const s2 = P.nowaStrona('Strona 2', srodek.id);
    s2.obiekty = [prost('b', '#d02020'), prost('c', '#2050d0')];
    p.strony.push(s2);
    const { otworzProjekt } = await import('./js/app/zapis.js');
    await otworzProjekt(P.normalizuj(p));
  }, trybSrodka);
}

test('model: tryb kolorów sekcji, kolory poza trybem, zamiana koloru tylko w sekcji', async (t) => {
  const { strona, bledy } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const k = await import('./js/kolory-druku.js');
    const P = await import('./js/projekt.js');
    const p = P.nowyProjekt('X');
    const srodek = P.nowaSekcja('Środek', p.sekcje[0].wydruk);
    srodek.tryb_kolorow = 'czb1';
    const zla = P.nowaSekcja('Zła', p.sekcje[0].wydruk);
    zla.tryb_kolorow = 'tecza';
    p.sekcje.push(srodek, zla);
    p.kolory_dodatkowe = [{ id: 'r', nazwa: 'PANTONE 032 C', cmyk: [0, 90, 86, 0] }];
    const s2 = P.nowaStrona('S2', srodek.id);
    s2.obiekty = [{ type: 'rect', fill: '#00aa00' }];
    p.strony[0].obiekty = [{ type: 'rect', fill: '#00aa00' }];
    p.strony.push(s2);
    const n = P.normalizuj(p);
    const [okl, sr, zl] = n.sekcje;
    const wynik = {
      okl: k.trybKolorow(n, okl), sr: k.trybKolorow(n, sr), zl: k.trybKolorow(n, zl), zlPole: zl.tryb_kolorow ?? null,
      kolorSr: sr.kolor_trybu, spotySr: k.spotyDruku(n, sr).map((x) => x.nazwa), spotyCalosc: k.spotyDruku(n).map((x) => x.nazwa),
      zle: k.koloryPozaTrybem(n), wSr: k.koloryWZakresie(n, sr.id).map((x) => x.kolor),
    };
    wynik.zamian = k.zamienKolorWZakresie(n, sr.id, '#00aa00', '#336699');
    wynik.poSr = n.strony[1].obiekty[0].fill;
    wynik.poOkl = n.strony[0].obiekty[0].fill;
    wynik.zleSzarosc = (() => { sr.tryb_kolorow = 'szarosc'; return k.koloryPozaTrybem(n); })();
    return wynik;
  });
  assert.deepEqual([w.okl, w.sr, w.zl, w.zlPole], ['pelny', 'czb1', 'pelny', null], 'nieznany tryb sekcji usunięty – sekcja jak projekt');
  assert.equal(w.kolorSr, 'r', 'cz/b + 1 bez koloru dostaje pierwszy kolor dodatkowy');
  assert.deepEqual(w.spotySr, ['PANTONE 032 C']);
  assert.deepEqual(w.spotyCalosc, ['PANTONE 032 C']);
  assert.deepEqual(w.zle, ['#00aa00'], 'zieleń na stronie środka nie pasuje; ta sama zieleń na okładce (pełny kolor) – pasuje');
  assert.deepEqual(w.wSr, ['#00aa00']);
  assert.equal(w.zamian, 1);
  assert.equal(w.poSr, '#336699');
  assert.equal(w.poOkl, '#00aa00', 'okładka bez zmian – zamiana tylko w sekcji');
  assert.deepEqual(w.zleSzarosc, ['#336699']);
  assert.deepEqual(bledy, []);
});

test('PDF: okładka w pełnym kolorze, środek w skali szarości – każda strona w trybie swojej sekcji', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  await dwieSekcje(strona, { trybSrodka: 'szarosc' });
  const strony = await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    const { eksportujPdf } = await import('./js/eksport.js');
    const w = await eksportujPdf(stan.projekt, { znaki: false, spad: false });
    const { PDFDocument, PDFArray, PDFName, PDFRawStream } = window.PDFLib;
    const dok = await PDFDocument.load(new Uint8Array(await w.blob.arrayBuffer()));
    const wynik = [];
    for (const s of dok.getPages()) {
      let tresc = '';
      const c = s.node.Contents();
      for (const r of c instanceof PDFArray ? c.asArray() : [c]) {
        const st = dok.context.lookup(r);
        const surowe = st instanceof PDFRawStream ? st.contents : st.getContents();
        tresc += String(st.dict.get(PDFName.of('Filter')) || '') === '/FlateDecode' ? await new Response(new Blob([surowe]).stream().pipeThrough(new DecompressionStream('deflate'))).text() : new TextDecoder().decode(surowe);
      }
      wynik.push({ rgb: / rg\b/.test(tresc), k: /0 0 0 0?\.\d+ k|0 0 0 1 k/.test(tresc) });
    }
    return wynik;
  });
  assert.equal(strony.length, 2);
  assert.equal(strony[0].rgb, true, 'okładka (jak projekt – pełny kolor): czerwony w RGB');
  assert.equal(strony[1].rgb, false, 'środek w skali szarości: bez kolorów RGB');
  assert.equal(strony[1].k, true, 'środek: kolory samą czernią (K)');
  assert.deepEqual(bledy, []);
});

test('okno „Kolory projektu”: tryb druku dla sekcji, „Jak w projekcie”, zamiana koloru w sekcji z cofaniem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  await dwieSekcje(strona);
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="kolory-druku"]');
  await strona.waitForSelector('#dlg-kolory-druku[open]');
  assert.equal(await strona.textContent('#kolory-druku-tytul'), 'Kolory projektu');
  // Zakres: sekcja „Środek” → skala szarości tylko dla niej.
  const idSrodka = await strona.evaluate(() => window.seriodruk.stan.projekt.sekcje[1].id);
  await strona.selectOption('#kolory-zakres', idSrodka);
  assert.equal(await strona.isVisible('#kolory-tryb-dziedzicz'), true, 'w sekcji jest „Jak w projekcie”');
  await strona.click('#kolory-tryb label:has-text("Skala szarości")');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[1].tryb_kolorow === 'szarosc');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.tryb_kolorow ?? 'pelny'), 'pelny', 'projekt bez zmian');
  assert.equal(await strona.isVisible('#kolory-tryb-zle'), true, 'kolory strony środka nie pasują do skali szarości');
  await strona.click('#kolory-tryb label:has-text("Jak w projekcie")');
  await strona.waitForFunction(() => !window.seriodruk.stan.projekt.sekcje[1].tryb_kolorow);
  // Zamiana koloru w sekcji: czerwony → zielony tylko na stronach środka.
  const uzyte = await strona.evaluate(() => [...document.querySelectorAll('#kolory-uzyte li b')].map((b) => b.textContent));
  assert.deepEqual(uzyte.sort(), ['#2050d0', '#d02020']);
  await strona.evaluate(() => {
    const inp = [...document.querySelectorAll('#kolory-uzyte input[type=color]')].find((i) => i.value === '#d02020');
    inp.value = '#11aa44';
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[1].obiekty.some((o) => o.fill === '#11aa44'));
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty[0].fill), '#d02020', 'okładka bez zmian');
  await strona.click('[data-akcja="kolory-druku-zamknij"] >> nth=-1');
  await strona.evaluate(async () => (await import('./js/app/zapis.js')).cofnijKrok(-1));
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[1].obiekty.every((o) => o.fill !== '#11aa44'));
  assert.deepEqual(bledy, []);
});

test('Właściwości: farba specjalna z obecnego koloru jednym krokiem – kolor dodatkowy w projekcie i płyta w PDF', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Farba');
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.type === 'rect');
  await strona.click('#wlasciwosci button.zwijak:has-text("Wykończenie druku")');
  await strona.selectOption('#wlasciwosci label:has-text("Farba specjalna") select', '+');
  await strona.waitForSelector('#dlg-nazwa[open]');
  await strona.fill('#dlg-nazwa input', 'PANTONE 7621 C');
  await strona.click('#dlg-nazwa button[value="tak"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.kolory_dodatkowe?.[0]?.nazwa === 'PANTONE 7621 C');
  const w = await strona.evaluate(async () => {
    const k = await import('./js/kolory-druku.js');
    const { stan, edytor } = window.seriodruk;
    return { fill: edytor.aktywny.fill, spot: k.hexSpotu(stan.projekt.kolory_dodatkowe[0], 1), tekst: document.querySelector('#wlasciwosci').textContent };
  });
  assert.equal(w.fill, w.spot, 'wypełnienie dokładnie w kolorze dodatkowym');
  assert.match(w.tekst, /farbą „PANTONE 7621 C”/);
  const plyty = await strona.evaluate(async () => {
    const { zapiszTeraz } = await import('./js/app/zapis.js');
    await zapiszTeraz();
    const { uzyteKoloryDruku } = await import('./js/kolory-druku.js');
    return uzyteKoloryDruku(window.seriodruk.stan.projekt).spoty.map((s) => s.nazwa);
  });
  assert.deepEqual(plyty, ['PANTONE 7621 C']);
  assert.deepEqual(bledy, []);
});

test('telefon: okno „Kolory projektu” i wykończenie druku mieszczą się na ekranie', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Telefon');
  await strona.evaluate(() => window.seriodruk.edytor.dodajProstokat());
  await strona.tap('button[data-panel="inspektor"]');
  await strona.waitForTimeout(400);
  await strona.evaluate(() => [...document.querySelectorAll('#wlasciwosci button.zwijak')].find((b) => /Wykończenie druku/.test(b.textContent)).click());
  const kafle = await strona.evaluate(() => {
    const r = [...document.querySelectorAll('#wlasciwosci .wybor-wykonczenia button')].map((b) => b.getBoundingClientRect());
    return { ile: r.length, wEkranie: r.every((x) => x.left >= 0 && x.right <= innerWidth), szer: Math.round(Math.min(...r.map((x) => x.width))) };
  });
  assert.equal(kafle.ile, 6);
  assert.ok(kafle.wEkranie, 'kafelki w ekranie');
  assert.ok(kafle.szer >= 80, `kafelki nie za wąskie (${kafle.szer})`);
  await strona.evaluate(async () => (await import('./js/app/edytor-start.js')).akcje['kolory-druku']());
  await strona.waitForSelector('#dlg-kolory-druku[open]');
  await strona.waitForTimeout(500);
  const okno = await strona.evaluate(() => { const d = document.querySelector('#dlg-kolory-druku'); return d.scrollWidth <= d.clientWidth + 1; });
  assert.ok(okno, 'okno bez przewijania w poziomie');
  assert.deepEqual(bledy, []);
});
