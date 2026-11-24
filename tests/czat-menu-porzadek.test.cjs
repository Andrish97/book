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
  // Na komputerze „Znajdź i zamień” jest na górnym pasku – w menu ⋯ tylko na wąskim ekranie (bez powtórzeń).
  assert.equal(await strona.isVisible('#menu-wiecej [data-akcja="znajdz"]'), false);
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
  // Okno na wierzchu (modalne): pasek narzędzi, zoom i dolne zakładki edytora go nie zasłaniają.
  assert.equal(await strona.evaluate(() => document.querySelector('#dlg-czat-ai').matches(':modal')), true);
  const naWierzchu = await strona.evaluate(() => { const r = document.querySelector('#czat-ai-tekst').getBoundingClientRect(); return document.elementFromPoint(r.left + 20, r.top + r.height / 2)?.id; });
  assert.equal(naWierzchu, 'czat-ai-tekst', 'pole pisania nie jest niczym zasłonięte');
  // Dużo wiadomości: przewija się lista, pole pisania zostaje na miejscu.
  await strona.evaluate(async () => { const l = document.querySelector('#czat-ai-wiadomosci'); for (let i = 0; i < 40; i += 1) l.append(Object.assign(document.createElement('li'), { className: 'ai', textContent: `Wiadomość ${i}` })); l.scrollTop = l.scrollHeight; });
  await strona.evaluate(() => window.scrollBy(0, 400));
  const b = await zmierz();
  assert.deepEqual([b.gora, b.pole], [a.gora, a.pole], 'okno i pole na miejscu');
  assert.deepEqual(bledy, []);
});

test('ustawienia AI: OpenRouter – przycisk logowania w okienku klucza', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => { location.hash = '#/konto/ai'; });
  await strona.waitForSelector('[data-dodaj-klucz-ai="czat"]');
  // Moduł ustawień AI wczytuje się chwilę po pokazaniu ekranu – klikamy, aż okienko się otworzy.
  for (let i = 0; i < 20 && !(await strona.evaluate(() => document.querySelector('#dlg-klucz-ai').open)); i += 1) {
    await strona.click('[data-dodaj-klucz-ai="czat"]');
    await strona.waitForTimeout(300);
  }
  await strona.waitForSelector('#dlg-klucz-ai[open]');
  assert.equal(await strona.isVisible('#ai-nowy-openrouter'), false);
  await strona.selectOption('#ai-nowy-dostawca', 'openrouter');
  assert.equal(await strona.isVisible('#ai-nowy-openrouter'), true, 'Zaloguj przez OpenRouter');
  // Powrót z OpenRouter: kod z adresu przejęty, klucz do sejfu (podstawiona odpowiedź OpenRouter).
  await strona.route('https://openrouter.ai/api/v1/auth/keys', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ key: 'sk-or-test' }) }));
  await strona.evaluate(async () => {
    const { sejfKonta } = await import('./js/app/sejf-ai.js'); await sejfKonta().zaloz('haslo-do-kluczy-1');
    await (await import('./js/app/czat-ai-logowanie.js')).dokonczLogowanieOpenRouter({ kod: 'k1', weryfikator: 'w1' });
  });
  assert.deepEqual(await strona.evaluate(async () => [(await import('./js/app/sejf-ai.js')).sejfKonta().klucz('openrouter'), JSON.parse(localStorage.getItem('makietka-czat-ai')).dostawca]), ['sk-or-test', 'openrouter']);
  assert.deepEqual(bledy, []);
});
