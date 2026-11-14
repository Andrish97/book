// Tryby urządzeń (js/urzadzenie.js, decyzja #91): atrybuty na <html> dla telefonu, tabletu i komputera,
// zmiana przy obróceniu, oraz kluczowe układy: logowanie bez uciętej góry i bez przewijania w poziomie,
// edytor na telefonie bez przycisków poza ekranem.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

const tryb = (strona) => strona.evaluate(() => {
  const r = document.documentElement;
  return {
    urzadzenie: r.dataset.urzadzenie, orientacja: r.dataset.orientacja, uklad: r.dataset.uklad,
    dotyk: r.hasAttribute('data-dotyk'), zaslonka: r.hasAttribute('data-zaslonka'), kompakt: r.hasAttribute('data-kompakt'),
  };
});

// Logowanie: nic nie wystaje w poziomie, logo i zakładki są w zasięgu (nie ucięte nad ekranem), formularz
// na środku szerokości.
const sprawdzLogowanie = (strona) => strona.evaluate(() => {
  const forma = document.querySelector('.logowanie-forma');
  forma.scrollTop = 0;
  const doc = document.scrollingElement;
  const marka = document.querySelector('.marka-mobilna:not([hidden])') || document.querySelector('#tryb-logowania');
  const karta = document.querySelector('#karta-logowania').getBoundingClientRect();
  const pola = [...document.querySelectorAll('#form-logowania input:not([type=hidden]), #przycisk-logowania')].filter((e) => e.offsetParent);
  return {
    poziomo: doc.scrollWidth > innerWidth + 1 || forma.scrollWidth > forma.clientWidth + 1,
    goraMarki: marka.getBoundingClientRect().top - forma.getBoundingClientRect().top,
    srodekKarty: (karta.left + karta.right) / 2,
    szerokosc: innerWidth,
    polaPozaEkranem: pola.filter((e) => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).length,
  };
});

const URZADZENIA = [
  { nazwa: 'iPhone SE', oczekiwane: { urzadzenie: 'telefon', orientacja: 'pion', uklad: 'telefon-pion', dotyk: true, zaslonka: true, kompakt: true } },
  { nazwa: 'Pixel 7 landscape', oczekiwane: { urzadzenie: 'telefon', orientacja: 'poziom', uklad: 'telefon-poziom', dotyk: true, zaslonka: true, kompakt: false } },
  { nazwa: 'iPad Mini', oczekiwane: { urzadzenie: 'tablet', orientacja: 'pion', uklad: 'tablet-pion', dotyk: true, zaslonka: true, kompakt: false } },
  { nazwa: 'iPad Mini landscape', oczekiwane: { urzadzenie: 'tablet', orientacja: 'poziom', uklad: 'tablet-poziom', dotyk: true, zaslonka: true, kompakt: false } },
  { nazwa: null, oczekiwane: { urzadzenie: 'komputer', orientacja: 'poziom', uklad: 'komputer', dotyk: false, zaslonka: false, kompakt: false } },
];

for (const { nazwa, oczekiwane } of URZADZENIA) {
  test(`tryb urządzenia i logowanie: ${nazwa || 'komputer 1280×800'}`, async (t) => {
    const { strona, bledy } = await otworz(t, { tryb: 'atrapa', urzadzenie: nazwa });
    await strona.waitForSelector('#form-logowania input[name=email]', { state: 'visible' });
    assert.deepEqual(await tryb(strona), oczekiwane);
    let l = await sprawdzLogowanie(strona);
    assert.equal(l.poziomo, false, 'logowanie nie przewija się w poziomie');
    assert.equal(l.polaPozaEkranem, 0);
    assert.ok(l.goraMarki >= 0, `logo i zakładki nie są ucięte nad ekranem (${l.goraMarki} px)`);
    assert.ok(Math.abs(l.srodekKarty - l.szerokosc / 2) < l.szerokosc * 0.3 || l.szerokosc > 980, 'formularz stoi pośrodku, a nie przy lewej krawędzi');
    // Rejestracja (najdłuższy formularz): w niskim oknie góra dalej w zasięgu.
    await strona.click('#tryb-logowania label:has(input[value=rejestracja])');
    l = await sprawdzLogowanie(strona);
    assert.ok(l.goraMarki >= 0, `rejestracja: góra formularza w zasięgu (${l.goraMarki} px)`);
    assert.equal(l.poziomo, false);
    // Obrót urządzenia: orientacja i układ zmieniają się razem z oknem.
    if (nazwa) {
      const v = strona.viewportSize();
      await strona.setViewportSize({ width: v.height, height: v.width });
      await strona.waitForFunction((o) => document.documentElement.dataset.orientacja !== o, oczekiwane.orientacja);
      const po = await tryb(strona);
      assert.equal(po.urzadzenie, oczekiwane.urzadzenie, 'rodzaj urządzenia się nie zmienia');
      assert.equal(po.uklad, `${oczekiwane.urzadzenie}-${po.orientacja}`);
      l = await sprawdzLogowanie(strona);
      assert.equal(l.poziomo, false, 'po obrocie też bez przewijania w poziomie');
      assert.ok(l.goraMarki >= 0, 'po obrocie góra formularza w zasięgu');
    }
    assert.deepEqual(bledy, []);
  });
}

test('edytor na telefonie (320×568 i 412×915): żaden przycisk paska, narzędzi ani dolnego menu nie wystaje poza ekran', async (t) => {
  for (const nazwa of ['iPhone SE', 'Pixel 7']) {
    const { strona, bledy } = await otworz(t, { urzadzenie: nazwa });
    await strona.click('[data-akcja="nowy-projekt"]:visible');
    await strona.fill('#form-nowy input[name=nazwa]', 'Telefon');
    await strona.click('#form-nowy button[value=ok]');
    await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk);
    await strona.waitForTimeout(400);
    const poza = await strona.evaluate(() => [...document.querySelectorAll('.pasek-edytora button, .pasek-edytora input, #pasek-narzedzi button, .zakladki-mobilne button, #kontrolki-widoku button')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).visibility !== 'hidden' && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1); })
      .map((e) => e.getAttribute('aria-label') || e.dataset.akcja || e.textContent.trim()));
    assert.deepEqual(poza, [], `${nazwa}: poza ekranem`);
    assert.equal(await strona.evaluate(() => document.documentElement.dataset.uklad), 'telefon-pion');
    assert.deepEqual(bledy, []);
  }
});
