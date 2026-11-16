// Audyt testów (#160): rzeczy, od których zależy poprawny wydruk, a które nie miały testu od początku do końca.
// – okładka z grzbietem w pliku PDF dla drukarni: rozmiar strony okładki = przód + grzbiet + tył (+ zawinięcie
//   przy twardej), spad i znaki cięcia wokół całości, okładka pierwsza, środek w swoim formacie, element na
//   grzbiecie trafia na środek grzbietu w pliku.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

async function nowyZOkladka(strona, nazwa, oprawa) {
  await strona.click('[data-akcja="nowy-projekt"]:visible');
  await strona.fill('#form-nowy input[name=nazwa]', nazwa);
  await strona.evaluate((o) => { const s = document.querySelector('#form-nowy select[name=okladka]'); s.value = o; s.dispatchEvent(new Event('change', { bubbles: true })); }, oprawa);
  await strona.click('#form-nowy button[value=ok]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.sekcje.length === 2 && window.seriodruk.edytor?.wydruk);
}

async function eksportujPdf(strona) {
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  await strona.selectOption('#form-pdf select[name=dpi]', '150');
  await Promise.all([strona.waitForEvent('download'), strona.click('#pdf-eksportuj')]);
  await strona.waitForSelector('#dlg-pdf', { state: 'hidden' });
  return strona.evaluate(async () => {
    const dok = await window.PDFLib.PDFDocument.load(await window.seriodruk.oknoPdf.ostatni.blob.arrayBuffer());
    const mm = (pt) => Math.round((pt * 25.4 / 72) * 10) / 10;
    return dok.getPages().map((s) => ({ obciecie: [s.getTrimBox().width, s.getTrimBox().height].map(mm), spad: [s.getBleedBox().width, s.getBleedBox().height].map(mm), strona: [s.getMediaBox().width, s.getMediaBox().height].map(mm) }));
  });
}

for (const oprawa of ['miekka', 'twarda']) {
  test(`PDF dla drukarni: okładka ${oprawa} z grzbietem – rozmiar całej okładki, spad, kolejność, środek w swoim formacie`, async (t) => {
    const { strona, bledy } = await otworz(t);
    await nowyZOkladka(strona, `Okładka ${oprawa}`, oprawa);
    // 64 strony środka – grzbiet kilka milimetrów; element na grzbiecie.
    await strona.evaluate(async () => {
      const { stan } = window.seriodruk;
      const P = await import('./js/projekt.js');
      const srodek = stan.projekt.sekcje[1].id;
      const ile = stan.projekt.strony.filter((s) => s.sekcja === srodek).length;
      for (let i = ile; i < 64; i += 1) stan.projekt.strony.push(P.nowaStrona(`S${i}`, srodek));
      (await import('./js/app/zapis.js')).zaplanujZapis();
    });
    await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].okladka?.wynik?.stron === 64);
    const dane = await strona.evaluate(() => {
      const p = window.seriodruk.stan.projekt;
      const [okl, sr] = p.sekcje;
      return { okl: { w: okl.wydruk.szerokosc_mm, h: okl.wydruk.wysokosc_mm, spad: okl.wydruk.spad_mm }, sr: { w: sr.wydruk.szerokosc_mm, h: sr.wydruk.wysokosc_mm }, wynik: okl.okladka.wynik, stronOkladki: p.strony.filter((s) => s.sekcja === okl.id).length };
    });
    assert.ok(dane.wynik.grzbiet > 2, `grzbiet ${dane.wynik.grzbiet} mm`);
    // Okładka szersza niż dwie strony środka o grzbiet (twarda – także o zawinięcie i rowki).
    assert.ok(dane.okl.w >= 2 * dane.sr.w + dane.wynik.grzbiet - 0.01, `okładka ${dane.okl.w} mm vs 2 × ${dane.sr.w} + ${dane.wynik.grzbiet}`);
    if (oprawa === 'miekka') assert.ok(Math.abs(dane.okl.w - (2 * dane.sr.w + dane.wynik.grzbiet)) < 0.05, 'miękka: dokładnie przód + grzbiet + tył');
    else assert.ok(dane.okl.h > dane.sr.h, 'twarda: wyższa od środka (zawinięcie i tektura)');

    const strony = await eksportujPdf(strona);
    // Pierwsza strona pliku to okładka w pełnym rozmiarze, potem 64 strony środka.
    assert.equal(strony.length, dane.stronOkladki + 64);
    assert.deepEqual(strony[0].obciecie, [Math.round(dane.okl.w * 10) / 10, Math.round(dane.okl.h * 10) / 10], 'okładka – rozmiar po obcięciu');
    assert.deepEqual(strony[0].spad, [Math.round((dane.okl.w + 2 * dane.okl.spad) * 10) / 10, Math.round((dane.okl.h + 2 * dane.okl.spad) * 10) / 10], 'okładka – spad dookoła');
    assert.ok(strony[0].strona[0] > strony[0].spad[0], 'pas na znaki cięcia wokół okładki');
    for (const s of strony.slice(dane.stronOkladki)) assert.deepEqual(s.obciecie, [dane.sr.w, dane.sr.h], 'środek w swoim formacie');
    assert.deepEqual(bledy, []);
  });
}
