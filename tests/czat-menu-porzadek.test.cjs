// Część N (23.11): czat tylko do rozmowy (wybór dostawcy i uprawnień w ustawieniach), inne formaty zapisu i import
// w jednym podmenu ⋯, czat na telefonie przypięty do ekranu.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('menu ⋯: inne formaty i import w jednym podmenu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Porządek menu');
  await strona.click('#przycisk-wiecej');
  const pozycje = await strona.$$eval('#menu-wiecej > button', (b) => b.map((x) => x.dataset.akcja));
  for (const a of ['png', 'idml', 'scribus', 'tekst-epub', 'wstaw-tekst-z-pliku', 'czat-ai', 'cofnij-ai']) assert.ok(!pozycje.includes(a), a);
  await strona.click('#menu-wiecej [data-akcja="pliki-menu"]');
  await strona.waitForSelector('.menu-przycisku [data-wartosc="idml"]');
  assert.deepEqual(await strona.$$eval('.menu-przycisku [data-wartosc]', (b) => b.map((x) => x.dataset.wartosc)),
    ['png', 'tekst-docx', 'tekst-epub', 'docx-uklad', 'idml', 'scribus', 'svg-strony', 'ploter-svg', 'seria-programy', 'specyfikacja', 'wstaw-tekst-z-pliku']);
  assert.deepEqual(bledy, []);
});

test('ustawienia AI: czym rozmawia asystent i jego uprawnienia; czat to pokazuje', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => { location.hash = '#/konto/ai'; });
  await strona.waitForSelector('#asystent-dostawca option[value="schowek"]', { state: 'attached' });
  await strona.selectOption('#asystent-rola', 'odczyt');
  await strona.selectOption('#asystent-dostawca', 'schowek');
  assert.deepEqual(await strona.evaluate(() => { const u = JSON.parse(localStorage.getItem('makietka-czat-ai')); return [u.dostawca, u.rola]; }), ['schowek', 'odczyt']);
  await strona.evaluate(() => { location.hash = '#/projekty'; });
  await nowyProjekt(strona, 'Z asystentem');
  await strona.evaluate(async () => (await import('./js/app/czat-ai.js')).otworzCzatAi());
  await strona.waitForSelector('#dlg-czat-ai[open]');
  assert.match(await strona.textContent('#czat-ai-kto'), /Kopiuj i wklej.*tylko czyta/);
  await strona.click('#czat-ai-ustawienia');
  await strona.waitForSelector('#dlg-dostep-ai[open] #asystent-dostawca'); // ustawienia AI w oknie, wybór asystenta na wierzchu
  assert.deepEqual(bledy, []);
});

test('telefon: czat zajmuje widoczny ekran i nie ucieka przy przewijaniu', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Czat na telefonie');
  await strona.evaluate(async () => (await import('./js/app/czat-ai.js')).otworzCzatAi());
  await strona.waitForSelector('#dlg-czat-ai[open]');
  await strona.waitForTimeout(400); // wjazd zasłonki
  const zmierz = () => strona.evaluate(() => {
    const d = document.querySelector('#dlg-czat-ai').getBoundingClientRect();
    const p = document.querySelector('#czat-ai-tekst').getBoundingClientRect();
    return { gora: Math.round(d.top), dol: Math.round(d.bottom), vh: window.innerHeight, pole: Math.round(p.bottom), font: getComputedStyle(document.querySelector('#czat-ai-tekst')).fontSize };
  });
  const a = await zmierz();
  assert.ok(a.gora < 60 && Math.abs(a.dol - a.vh) <= 2, `prawie cały ekran: ${JSON.stringify(a)}`);
  assert.ok(a.pole <= a.vh, 'pole pisania widoczne');
  assert.equal(a.font, '16px', 'bez powiększania strony przy pisaniu');
  // Dużo wiadomości: przewija się lista, pole pisania zostaje na miejscu.
  await strona.evaluate(async () => { const l = document.querySelector('#czat-ai-wiadomosci'); for (let i = 0; i < 40; i += 1) l.append(Object.assign(document.createElement('li'), { className: 'ai', textContent: `Wiadomość ${i}` })); l.scrollTop = l.scrollHeight; });
  await strona.evaluate(() => window.scrollBy(0, 400));
  const b = await zmierz();
  assert.deepEqual([b.gora, b.pole], [a.gora, a.pole], 'okno i pole na miejscu');
  assert.deepEqual(bledy, []);
});
