// Telefon (#139, #142): narzędzia, które nie mieszczą się w pasku wstawiania, są pod jego przyciskiem ⋯
// (wielokąt, rysowanie, pióro, komentarz, „Kopiuj wygląd”). Działające narzędzie pokazuje się na ⋯ i jednym
// stuknięciem się kończy. Na komputerze pasek ma wszystko, bez ⋯.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('telefon: menu ⋯ paska wstawiania – narzędzia, stan na przycisku, kopiowanie wyglądu', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await strona.setViewportSize({ width: 360, height: 740 });
  await nowyProjekt(strona, 'Menu narzędzi');
  const widoczne = () => strona.evaluate(() => [...document.querySelectorAll('.pasek-narzedzi button')].filter((b) => b.offsetParent).map((b) => b.dataset.akcja || b.id));
  assert.deepEqual(await widoczne(), ['dodaj-tekst', 'dodaj-prostokat', 'dodaj-elipse', 'dodaj-linie', 'dodaj-obraz', 'ai-menu', 'dodaj-tabele', 'biblioteka', 'przycisk-narzedzia-wiecej']);
  const miesci = await strona.evaluate(() => { const n = document.querySelector('.pasek-narzedzi'); return n.scrollWidth <= n.clientWidth && n.getBoundingClientRect().right <= window.innerWidth; });
  assert.ok(miesci, 'pasek mieści się na 360 px');

  // Menu: wszystkie schowane narzędzia, w granicach ekranu; „Kopiuj wygląd” wymaga zaznaczenia.
  await strona.tap('#przycisk-narzedzia-wiecej');
  const menu = await strona.evaluate(() => {
    const m = document.querySelector('#menu-narzedzi');
    const r = m.getBoundingClientRect();
    return { widoczne: !m.hidden, w_ekranie: r.left >= 0 && r.right <= window.innerWidth, pozycje: [...m.querySelectorAll('button')].map((b) => [b.dataset.akcja, b.disabled]) };
  });
  assert.deepEqual(menu, { widoczne: true, w_ekranie: true, pozycje: [['dodaj-wielokat', false], ['rysuj', false], ['pioro', false], ['komentarz', false], ['malarz', true]] });

  // Rysowanie z menu: ⋯ pokazuje ikonę rysowania i je kończy.
  await strona.tap('#menu-narzedzi [data-akcja="rysuj"]');
  assert.equal(await strona.isVisible('#menu-narzedzi'), false, 'menu zamyka się po wyborze');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.rysuje), true);
  const przycisk = () => strona.evaluate(() => { const b = document.querySelector('#przycisk-narzedzia-wiecej'); return [b.dataset.ikona, b.getAttribute('aria-pressed'), b.getAttribute('aria-label')]; });
  assert.deepEqual(await przycisk(), ['rysuj', 'true', 'Zakończ: Rysowanie odręczne']);
  await strona.tap('#przycisk-narzedzia-wiecej');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.rysuje), false);
  assert.deepEqual(await przycisk(), ['wiecej', 'false', 'Więcej narzędzi']);
  assert.equal(await strona.isVisible('#menu-narzedzi'), false, 'zakończenie nie otwiera menu');

  // Wielokąt z menu: wybór kształtu (#151), gwiazda 5 dodaje gwiazdę.
  await strona.tap('#przycisk-narzedzia-wiecej');
  await strona.tap('#menu-narzedzi [data-akcja="dodaj-wielokat"]');
  await strona.waitForSelector('#menu-wielokata:not([hidden])');
  const wybor = await strona.evaluate(() => { const r = document.querySelector('#menu-wielokata').getBoundingClientRect(); return { n: document.querySelectorAll('#menu-wielokata [data-boki]').length, w_ekranie: r.left >= 0 && r.right <= innerWidth }; });
  assert.deepEqual(wybor, { n: 10, w_ekranie: true });
  await strona.tap('#menu-wielokata [aria-label="Gwiazda 5"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny);
  assert.deepEqual(await strona.evaluate(() => { const a = window.seriodruk.edytor.aktywny; return [a.type, a.boki, Boolean(a.gwiazda), a.points.length]; }), ['polygon', 5, true, 10]);
  assert.equal(await strona.isVisible('#menu-wielokata'), false);
  // Kopiuj wygląd zaznaczonego elementu – na ⋯ widać malarza, stuknięcie go kończy.
  await strona.tap('#przycisk-narzedzia-wiecej');
  assert.equal(await strona.isDisabled('#menu-narzedzi [data-akcja="malarz"]'), false);
  await strona.tap('#menu-narzedzi [data-akcja="malarz"]');
  assert.equal(await strona.evaluate(() => document.body.classList.contains('malarz-aktywny')), true);
  assert.deepEqual((await przycisk()).slice(0, 2), ['malarz', 'true']);
  await strona.tap('#przycisk-narzedzia-wiecej');
  assert.equal(await strona.evaluate(() => document.body.classList.contains('malarz-aktywny')), false);
  assert.deepEqual(bledy, []);
});

test('komputer: pasek wstawiania bez ⋯ – wszystkie narzędzia widoczne', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Menu narzędzi');
  const widoczne = await strona.evaluate(() => [...document.querySelectorAll('.pasek-narzedzi button')].filter((b) => b.offsetParent).map((b) => b.dataset.akcja || b.id));
  assert.deepEqual(widoczne, ['dodaj-tekst', 'dodaj-prostokat', 'dodaj-elipse', 'dodaj-wielokat', 'dodaj-linie', 'dodaj-obraz', 'ai-menu', 'rysuj', 'pioro', 'dodaj-tabele', 'biblioteka', 'komentarz']);
  assert.deepEqual(bledy, []);
});
