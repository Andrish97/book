// Instalacja aplikacji, pełny ekran i bezpieczne marginesy ekranu (#99).
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

const widoczne = (strona, sel) => strona.evaluate((s) => [...document.querySelectorAll(s)].some((el) => !el.hidden && el.getClientRects().length > 0), sel);

test('iPhone: bez przycisku pełnego ekranu; „Zainstaluj aplikację” pokazuje instrukcję; zachęta od drugiej wizyty, „Nie teraz” ją chowa', async (t) => {
  const { strona, kontekst } = await otworz(t, { urzadzenie: 'iPhone 13' });
  // Pierwsza wizyta za nami – teraz druga.
  await strona.evaluate(() => { localStorage.setItem('makietka:wizyty', '1'); localStorage.removeItem('makietka:instalacja-odlozona'); });
  await strona.reload();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  void kontekst;
  assert.equal(await widoczne(strona, '[data-akcja="pelny-ekran"]'), false, 'pełny ekran ukryty na iPhonie');
  assert.equal(await widoczne(strona, '#zacheta-instalacji'), true, 'zachęta widoczna');
  await strona.locator('#zacheta-instalacji [data-akcja="zainstaluj"]').tap();
  await strona.waitForSelector('#dlg-instalacja-ios[open]');
  assert.match(await strona.textContent('#dlg-instalacja-ios'), /Do ekranu początkowego/);
  await strona.locator('#dlg-instalacja-ios button[value="ok"]').tap();
  await strona.locator('#zacheta-instalacji [data-akcja="zainstaluj-pozniej"]').tap();
  assert.equal(await widoczne(strona, '#zacheta-instalacji'), false, 'po „Nie teraz” schowana');
  await strona.reload();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  assert.equal(await widoczne(strona, '#zacheta-instalacji'), false, 'i nie wraca po odświeżeniu');
  // W menu konta pozycja zostaje (żeby można było zainstalować później).
  await strona.locator('#awatar').tap();
  assert.equal(await widoczne(strona, '#menu-uzytkownika [data-akcja="zainstaluj"]'), true);
});

test('Android/Chrome: przycisk instalacji pojawia się po beforeinstallprompt i woła okno przeglądarki; zainstalowana – bez przycisków', async (t) => {
  const { strona, kontekst } = await otworz(t, { telefon: true });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  assert.equal(await widoczne(strona, '[data-akcja="zainstaluj"]'), false, 'bez zdarzenia przeglądarki nie ma czego instalować');
  await strona.evaluate(() => {
    window.__monit = 0;
    const e = new Event('beforeinstallprompt');
    e.prompt = () => { window.__monit += 1; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  assert.equal(await widoczne(strona, '.pasek-aplikacji > [data-akcja="zainstaluj"]'), true);
  await strona.locator('.pasek-aplikacji > [data-akcja="zainstaluj"]').tap();
  assert.equal(await strona.evaluate(() => window.__monit), 1, 'okno instalacji przeglądarki');

  // Aplikacja otwarta z ekranu początkowego (display-mode: standalone).
  await kontekst.addInitScript(() => {
    const zwykle = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : zwykle(q));
  });
  await strona.reload();
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await strona.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
  assert.equal(await widoczne(strona, '[data-akcja="zainstaluj"]'), false, 'zainstalowana – bez instalacji');
  assert.equal(await widoczne(strona, '#zacheta-instalacji'), false);
  assert.equal(await widoczne(strona, '[data-akcja="pelny-ekran"]'), false, 'zainstalowana – bez pełnego ekranu');
  assert.equal(await strona.evaluate(() => document.documentElement.hasAttribute('data-zainstalowana')), true);
});

test('logowanie: przycisk pełnego ekranu jest i wyłącza pełny ekran (Android)', async (t) => {
  const { strona } = await otworz(t, { tryb: 'gosc', telefon: true });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'logowanie');
  const przycisk = strona.locator('#ekran-logowania [data-akcja="pelny-ekran"]');
  assert.equal(await przycisk.isVisible(), true, 'przycisk na ekranie logowania');
  await przycisk.tap();
  await strona.waitForFunction(() => Boolean(document.fullscreenElement));
  assert.equal(await przycisk.getAttribute('aria-pressed'), 'true');
  await przycisk.tap();
  await strona.waitForFunction(() => !document.fullscreenElement);
});

test('bezpieczne marginesy: paski, ekran logowania, zasłonki i powiadomienie omijają wycięcia', async (t) => {
  const { strona } = await otworz(t, { telefon: 'poziom' });
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  // Chromium nie ma wycięć – podstawiamy wartości env() przez zmienne aplikacji.
  await strona.addStyleTag({ content: ':root { --bezp-gora: 30px !important; --bezp-dol: 21px !important; --bezp-lewo: 47px !important; --bezp-prawo: 47px !important; }' });
  const m = await strona.evaluate(() => {
    const pasek = document.querySelector('#ekran-projektow > .pasek-aplikacji');
    const s = getComputedStyle(pasek);
    const r = pasek.getBoundingClientRect();
    const przyciski = [...pasek.querySelectorAll('button, .marka')].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect());
    return {
      gora: s.paddingTop, lewo: s.paddingLeft, prawo: s.paddingRight, pasekOd: r.left, pasekDo: r.right, szer: innerWidth,
      przyciskiOd: Math.min(...przyciski.map((b) => b.left)), przyciskiDo: Math.max(...przyciski.map((b) => b.right)), przyciskiGora: Math.min(...przyciski.map((b) => b.top)),
    };
  });
  assert.equal(m.gora, '30px', 'pasek wyższy o wycięcie u góry');
  assert.ok(m.pasekOd <= 0.5 && m.pasekDo >= m.szer - 0.5, 'tło paska do krawędzi ekranu');
  assert.ok(m.przyciskiOd >= 47 && m.przyciskiDo <= m.szer - 47, `przyciski z dala od wycięć (${m.przyciskiOd}–${m.przyciskiDo} z ${m.szer})`);
  assert.ok(m.przyciskiGora >= 30, 'przyciski poniżej wycięcia');
  // Zasłonka: dół nad paskiem systemowym.
  const z = await strona.evaluate(async () => {
    const dlg = document.querySelector('#dlg-potwierdz');
    dlg.showModal();
    await new Promise((ok) => { setTimeout(ok, 400); });
    const s = getComputedStyle(dlg);
    const w = { dol: s.paddingBottom, zaslonka: document.documentElement.hasAttribute('data-zaslonka') };
    dlg.close();
    return w;
  });
  if (z.zaslonka) assert.equal(z.dol, '21px', 'zasłonka nad paskiem systemowym');
});
