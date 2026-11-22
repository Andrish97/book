// Komentarze na stronach (decyzja #131D, migracja 20261116200000_komentarze.sql): narzędzie „Komentarz”
// na pasku narzędzi, pinezka z numerem na płótnie i w podglądzie, panel z licznikiem nierozwiązanych na górnym pasku,
// wątek odpowiedzi, @wzmianka, „Rozwiąż”/„Otwórz ponownie”, filtry, zmiany na żywo między dwoma kontami,
// osoba „może oglądać” komentuje z podglądu.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, drugieUrzadzenie, nowyProjekt } = require('./pomoc.cjs');

const ANNA = { id: '11111111-1111-4111-8111-111111111111', email: 'anna@test.pl', haslo: 'Dobre#Haslo1', potwierdzone: true, nazwa: 'Anna' };
const BARTEK = { id: '22222222-2222-4222-8222-222222222222', email: 'bartek@test.pl', haslo: 'Dobre#Haslo2', potwierdzone: true, nazwa: 'Bartek' };

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu')?.textContent === 'Zapisano', null, { timeout: 15000 });
const licznik = (strona, sel) => strona.evaluate((s) => { const l = document.querySelector(s); return l && !l.hidden ? l.textContent : ''; }, sel);

async function zaloguj(strona, konto) {
  await strona.waitForSelector('#form-logowania input[name=email]', { state: 'visible' });
  await strona.fill('#form-logowania input[name=email]', konto.email);
  await strona.fill('#form-logowania input[name=haslo]', konto.haslo);
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
}

// Rozwija wątek na liście (kliknięcie nagłówka przełącza – rozwinięty zostaje rozwinięty).
async function rozwin(strona, id) {
  if (!await strona.evaluate((x) => document.querySelector(`.watek-komentarza[data-id="${x}"]`)?.classList.contains('otwarty'), id)) {
    await strona.click(`.watek-komentarza[data-id="${id}"] [data-op="otworz"]`);
  }
  await strona.waitForSelector(`.watek-komentarza.otwarty[data-id="${id}"]`);
}

// Punkt strony (mm) → współrzędne okna przeglądarki.
const naEkranie = (strona, x, y) => strona.evaluate(([mx, my]) => {
  const c = window.seriodruk.edytor.canvas;
  const r = c.upperCanvasEl.getBoundingClientRect();
  const v = c.viewportTransform;
  return { x: r.left + (window.seriodruk.edytor.strony[0].x + mx) * v[0] + v[4], y: r.top + my * v[3] + v[5] };
}, [x, y]);

test('komentarze: pinezka na płótnie i w podglądzie, wzmianka, odpowiedź i rozwiązanie na żywo, oglądający komentuje z podglądu, filtry', async (t) => {
  const anna = await otworz(t, { konta: [ANNA, BARTEK].map((k) => ({ ...k })) });
  const { strona: a, baza } = anna;
  await nowyProjekt(a, 'Kalendarz z uwagami');
  await a.click('[data-akcja="dodaj-tekst"]');
  await a.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ text: 'Tytuł', left: 20, top: 40 }); e.aktywny.setCoords(); e.zatwierdz(); e.odznacz(); });
  await zapisano(a);
  const id = baza.projekty[0].id;
  baza.wspolpracownicy.push({ projekt_id: id, uzytkownik: BARTEK.id, rola: 'odczyt', dodano: new Date().toISOString() });

  // Przycisk „Komentarze” na górnym pasku i narzędzie „Komentarz” na pasku narzędzi – widoczne bez szukania (#140, #142).
  assert.equal(await a.locator('.przycisk-komentarzy[data-akcja="komentarze"]').isVisible(), true);
  assert.equal(await a.locator('.pasek-narzedzi [data-akcja="komentarz"], [data-akcja="komentarz"]').first().isVisible(), true);

  // Bartek („może oglądać”) ma projekt otwarty w podglądzie.
  const bartek = await drugieUrzadzenie(anna);
  const b = bartek.strona;
  await zaloguj(b, BARTEK);
  await b.evaluate((pid) => { location.hash = `#/p/${pid}`; }, id);
  await b.waitForFunction(() => document.body.dataset.ekran === 'podglad' && document.querySelector('#podglad-tresc .podglad-kartka'), null, { timeout: 15000 });
  assert.equal(await b.locator('#ekran-podgladu .komentarze-podgladu').isVisible(), true, 'oglądający widzi „Komentarze” w podglądzie');

  // Anna: narzędzie „Komentarz” → kliknięcie miejsca na stronie → treść z @wzmianką.
  await a.click('[data-akcja="komentarz"]');
  assert.equal(await a.getAttribute('[data-akcja="komentarz"]', 'aria-pressed'), 'true');
  const p = await naEkranie(a, 100, 150);
  await a.mouse.click(p.x, p.y);
  await a.waitForSelector('#dlg-komentarze[open] #nowy-komentarz:not([hidden])');
  assert.match(await a.textContent('#nowy-komentarz-gdzie'), /Strona 1/);
  await a.fill('#nowy-komentarz-tresc', 'Proszę sprawdzić datę @Bar');
  await a.waitForSelector('#nowy-komentarz .podpowiedzi-wzmianek:not([hidden]) button');
  await a.click('#nowy-komentarz .podpowiedzi-wzmianek button');
  assert.equal(await a.inputValue('#nowy-komentarz-tresc'), 'Proszę sprawdzić datę @Bartek ');
  await a.click('#nowy-komentarz-dodaj');
  await a.waitForFunction(() => document.querySelectorAll('#lista-komentarzy .watek-komentarza').length === 1);
  assert.equal(baza.komentarze.length, 1);
  const k1 = baza.komentarze[0];
  assert.deepEqual([Math.round(k1.x), Math.round(k1.y), k1.autor], [100, 150, ANNA.id]);
  assert.equal(k1.strona_id, await a.evaluate(() => window.seriodruk.stan.projekt.strony[0].id));
  assert.deepEqual(k1.wzmianki, [BARTEK.id], 'wzmianka Bartka');
  assert.match(await a.textContent('#lista-komentarzy'), /@Bartek/);
  await a.waitForSelector('.pinezki-komentarzy .pinezka-komentarza[data-watek]');
  assert.equal(await a.textContent('.pinezki-komentarzy .pinezka-komentarza[data-watek]'), '1');
  assert.equal(await licznik(a, '.przycisk-komentarzy .licznik-komentarzy'), '1');
  assert.equal(await a.getAttribute('[data-akcja="komentarz"]', 'aria-pressed'), 'false', 'narzędzie kończy się po jednym komentarzu');

  // Bartek widzi komentarz na żywo: licznik i pinezka w podglądzie.
  await b.waitForFunction(() => document.querySelector('.komentarze-podgladu .licznik-komentarzy')?.textContent === '1', null, { timeout: 15000 });
  await b.waitForSelector('#podglad-tresc .podglad-kartka .pinezka-komentarza[data-watek]');
  await b.click('#podglad-tresc .pinezka-komentarza[data-watek]');
  await b.waitForSelector('#dlg-komentarze[open] .watek-komentarza.otwarty');
  await b.fill('.watek-komentarza.otwarty .odpowiedz-komentarz textarea', 'Data jest dobra');
  await b.click('.watek-komentarza.otwarty [data-op="odpowiedz"]');
  await b.waitForFunction(() => /Data jest dobra/.test(document.querySelector('.watek-komentarza.otwarty .odpowiedzi').textContent));

  // Bartek dodaje własny wątek z podglądu: „Nowy komentarz” → kliknięcie strony.
  await b.click('#komentarze-nowy');
  const kartka = await b.locator('#podglad-tresc .podglad-kartka').first().boundingBox();
  await b.mouse.click(kartka.x + kartka.width * 0.5, kartka.y + kartka.height * 0.25);
  await b.waitForSelector('#nowy-komentarz:not([hidden])');
  assert.equal(await b.evaluate(() => document.body.dataset.ekran), 'podglad', 'kliknięcie w trybie komentarza nie otwiera edytora');
  await b.fill('#nowy-komentarz-tresc', 'Za mały margines');
  await b.click('#nowy-komentarz-dodaj');
  await b.waitForFunction(() => document.querySelector('.komentarze-podgladu .licznik-komentarzy')?.textContent === '2');
  assert.equal(baza.komentarze.filter((k) => !k.watek).length, 2);
  const k2 = baza.komentarze.find((k) => k.tresc === 'Za mały margines');
  assert.ok(Math.abs(k2.y - 210 * 0.25) < 3 || Math.abs(k2.y - 297 * 0.25) < 3, `y ${k2.y}`);

  // Anna: na żywo licznik 2 i odpowiedź Bartka w wątku; „Rozwiąż”.
  await a.waitForFunction(() => document.querySelector('.przycisk-komentarzy .licznik-komentarzy')?.textContent === '2', null, { timeout: 15000 });
  await a.waitForFunction(() => /Data jest dobra/.test(document.querySelector('#lista-komentarzy').textContent), null, { timeout: 15000 });
  await rozwin(a, k1.id);
  await a.click(`.watek-komentarza[data-id="${k1.id}"] [data-op="rozwiaz"]`);
  await a.waitForFunction(() => document.querySelector('.przycisk-komentarzy .licznik-komentarzy')?.textContent === '1');
  assert.equal(baza.komentarze.find((k) => k.id === k1.id).rozwiazany, true);
  await b.waitForFunction(() => document.querySelector('.komentarze-podgladu .licznik-komentarzy')?.textContent === '1', null, { timeout: 15000 });

  // Filtry: nierozwiązane (domyślnie) / wszystkie / moje.
  const ileWatkow = () => a.evaluate(() => document.querySelectorAll('#lista-komentarzy .watek-komentarza').length);
  await a.click('.filtry-komentarzy [data-filtr="wszystkie"]');
  assert.equal(await ileWatkow(), 2);
  await a.click('.filtry-komentarzy [data-filtr="moje"]');
  assert.equal(await ileWatkow(), 1);
  await a.click('.filtry-komentarzy [data-filtr="otwarte"]');
  assert.equal(await ileWatkow(), 1);
  assert.match(await a.textContent('#lista-komentarzy'), /Za mały margines/);

  // „Otwórz ponownie” z listy wszystkich.
  await a.click('.filtry-komentarzy [data-filtr="wszystkie"]');
  await rozwin(a, k1.id);
  assert.equal((await a.textContent(`.watek-komentarza[data-id="${k1.id}"] [data-op="rozwiaz"]`)).trim(), 'Otwórz ponownie');
  await a.click(`.watek-komentarza[data-id="${k1.id}"] [data-op="rozwiaz"]`);
  await a.waitForFunction(() => document.querySelector('.przycisk-komentarzy .licznik-komentarzy')?.textContent === '2');

  // Oglądający nie usunie cudzego wątku; właścicielka może.
  assert.equal(await b.locator(`.watek-komentarza[data-id="${k1.id}"] [data-op="usun"]`).count(), 0);
  await rozwin(a, k2.id);
  await a.click(`.watek-komentarza[data-id="${k2.id}"] [data-op="usun"]`);
  await a.click('#dlg-potwierdz[open] #potwierdz-tak');
  await a.waitForFunction(() => document.querySelector('.przycisk-komentarzy .licznik-komentarzy')?.textContent === '1');
  assert.ok(baza.komentarze.find((k) => k.id === k2.id).usunieto, 'usunięty (ślad bez treści)');
  assert.equal(baza.komentarze.find((k) => k.id === k2.id).tresc, '–');
  // Usunięcie widać u Bartka od razu – kanał z filtrem nie dostaje DELETE, więc usunięcie idzie jako zmiana (#172).
  await b.waitForFunction(() => document.querySelector('.komentarze-podgladu .licznik-komentarzy')?.textContent === '1', null, { timeout: 15000 });

  // Przejście z listy do miejsca: „Pokaż na stronie” zaznacza wątek (pinezka wybrana).
  await rozwin(a, k1.id);
  await a.click(`.watek-komentarza[data-id="${k1.id}"] [data-op="pokaz"]`);
  await a.waitForSelector(`.pinezki-komentarzy .pinezka-komentarza.wybrana[data-watek="${k1.id}"]`);
});

test('komentarz przy zaznaczonym elemencie i trasa #/p/<id>/k/<wątek> otwiera wątek', async (t) => {
  const anna = await otworz(t, { konta: [{ ...ANNA }] });
  const { strona: a, baza } = anna;
  await nowyProjekt(a, 'Element z uwagą');
  await a.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  await zapisano(a);
  const el = await a.evaluate(() => window.seriodruk.edytor.aktywny.id);
  await a.click('[data-akcja="komentarz"]');
  await a.waitForSelector('#dlg-komentarze[open] #nowy-komentarz:not([hidden])');
  assert.match(await a.textContent('#nowy-komentarz-gdzie'), /prostokąt/);
  await a.fill('#nowy-komentarz-tresc', 'Inny kolor?');
  await a.keyboard.press('Control+Enter');
  await a.waitForFunction(() => document.querySelectorAll('#lista-komentarzy .watek-komentarza').length === 1);
  const k = baza.komentarze[0];
  assert.equal(k.element_id, el);
  await a.click('#komentarze-zamknij');
  await a.waitForFunction(() => !document.querySelector('#dlg-komentarze').open);

  // Link z powiadomienia: #/p/<projekt>/k/<wątek>.
  await a.evaluate(([pid, kid]) => { location.hash = `#/p/${pid}/k/${kid}`; }, [baza.projekty[0].id, k.id]);
  await a.waitForSelector(`#dlg-komentarze[open] .watek-komentarza.otwarty[data-id="${k.id}"]`, { timeout: 15000 });
  assert.match(await a.evaluate(() => location.hash), /^#\/p\/[\w-]+$/, 'po otwarciu wątku adres wraca do projektu');
  // Esc kończy narzędzie bez komentarza.
  await a.click('#komentarze-zamknij');
  await a.evaluate(() => window.seriodruk.edytor.odznacz());
  await a.click('[data-akcja="komentarz"]');
  assert.equal(await a.getAttribute('[data-akcja="komentarz"]', 'aria-pressed'), 'true');
  await a.keyboard.press('Escape');
  assert.equal(await a.getAttribute('[data-akcja="komentarz"]', 'aria-pressed'), 'false');
  assert.equal(await a.evaluate(() => document.body.dataset.ekran), 'edytor');
});

// #172: poprawianie własnego komentarza, pisana odpowiedź nie znika przy zmianie na żywo od innej osoby,
// odpowiedź do wątku usuniętego w międzyczasie – czytelny błąd, pinezka komentarza do usuniętego elementu zostaje
// w miejscu, komentarz do usuniętej strony – bez „Pokaż na stronie”.
test('komentarze: poprawka, szkic odpowiedzi przy zmianie na żywo, usunięty wątek, usunięty element i strona', async (t) => {
  const anna = await otworz(t, { konta: [ANNA, BARTEK].map((k) => ({ ...k })) });
  const { strona: a, baza } = anna;
  await nowyProjekt(a, 'Brzegowe');
  await a.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  await a.evaluate(() => { const e = window.seriodruk.edytor; e.aktywny.set({ left: 30, top: 40 }); e.aktywny.setCoords(); e.zatwierdz(); });
  await zapisano(a);
  const pid = baza.projekty[0].id;
  baza.wspolpracownicy.push({ projekt_id: pid, uzytkownik: BARTEK.id, rola: 'edycja', dodano: new Date().toISOString() });

  // Komentarz Anny przy prostokącie.
  await a.click('[data-akcja="komentarz"]');
  await a.waitForSelector('#dlg-komentarze[open] #nowy-komentarz:not([hidden])');
  await a.fill('#nowy-komentarz-tresc', 'Kolor do zmiany');
  await a.keyboard.press('Control+Enter');
  await a.waitForFunction(() => document.querySelectorAll('#lista-komentarzy .watek-komentarza').length === 1);
  const k1 = baza.komentarze[0];
  assert.ok(k1.element_id);

  // Poprawka własnego komentarza.
  await rozwin(a, k1.id);
  await a.click(`.watek-komentarza[data-id="${k1.id}"] .akcje-watku [data-op="zmien"]`);
  await a.waitForSelector(`.poprawa-komentarza[data-id="${k1.id}"] textarea`);
  await a.fill(`.poprawa-komentarza[data-id="${k1.id}"] textarea`, 'Kolor do zmiany na granat');
  await a.keyboard.press('Control+Enter');
  await a.waitForFunction(() => /na granat/.test(document.querySelector('#lista-komentarzy .tresc-komentarza')?.textContent || ''));
  assert.equal(baza.komentarze[0].tresc, 'Kolor do zmiany na granat');

  // Bartek (może edytować) otwiera projekt; przy cudzym komentarzu nie ma „Popraw”.
  const bartek = await drugieUrzadzenie(anna);
  const b = bartek.strona;
  await zaloguj(b, BARTEK);
  await b.evaluate((x) => { location.hash = `#/p/${x}`; }, pid);
  await b.waitForFunction(() => document.querySelector('.przycisk-komentarzy .licznik-komentarzy')?.textContent === '1', null, { timeout: 20000 });
  await b.evaluate(() => document.querySelector('[data-akcja="komentarze"]').click());
  await b.waitForSelector('#dlg-komentarze[open] .watek-komentarza');
  await rozwin(b, k1.id);
  assert.equal(await b.locator(`.watek-komentarza[data-id="${k1.id}"] [data-op="zmien"]`).count(), 0, 'cudzego nie poprawi');

  // Anna pisze odpowiedź; w tym czasie Bartek dodaje własny wątek – lista Anny buduje się od nowa, szkic zostaje.
  const pierwsza = await a.evaluate(() => window.seriodruk.stan.projekt.strony[0].id);
  await a.fill(`.watek-komentarza[data-id="${k1.id}"] .odpowiedz-komentarz textarea`, 'Piszę właśnie');
  await b.evaluate(async ([projekt, strona]) => {
    const km = await import('./js/komentarze-chmura.js');
    await km.dodajKomentarz({ projekt, strona, x: 50, y: 50, tresc: 'Nowy od Bartka' });
  }, [pid, pierwsza]);
  await a.waitForFunction(() => document.querySelectorAll('#lista-komentarzy .watek-komentarza').length === 2, null, { timeout: 15000 });
  assert.equal(await a.inputValue(`.watek-komentarza[data-id="${k1.id}"] .odpowiedz-komentarz textarea`), 'Piszę właśnie', 'szkic odpowiedzi nie zginął');

  // Anna usuwa wątek Bartka – znika u Bartka od razu; spóźniona odpowiedź do niego daje czytelny błąd.
  const k2 = baza.komentarze.find((k) => k.tresc === 'Nowy od Bartka');
  await rozwin(a, k2.id);
  await a.click(`.watek-komentarza[data-id="${k2.id}"] [data-op="usun"]`);
  await a.click('#dlg-potwierdz[open] #potwierdz-tak');
  await b.waitForFunction((id) => !document.querySelector(`#lista-komentarzy .watek-komentarza[data-id="${id}"]`), k2.id, { timeout: 15000 });
  const blad = await b.evaluate(async ([projekt, watek]) => {
    const km = await import('./js/komentarze-chmura.js');
    try { await km.dodajKomentarz({ projekt, tresc: 'Za późno', watek }); return ''; } catch (e) { return e.message; }
  }, [pid, k2.id]);
  assert.match(blad, /usunięty/);

  // Usunięty prostokąt: pinezka zostaje w zapisanym miejscu na stronie.
  await a.click('#komentarze-zamknij');
  await a.evaluate((id) => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.id === id); e.canvas.remove(o); e.canvas.requestRenderAll(); }, k1.element_id);
  await a.waitForSelector(`.pinezki-komentarzy .pinezka-komentarza[data-watek="${k1.id}"]`);
  const poz = await a.evaluate((id) => { const p = document.querySelector(`.pinezka-komentarza[data-watek="${id}"]`).getBoundingClientRect(); const c = window.seriodruk.edytor.canvas.upperCanvasEl.getBoundingClientRect(); return p.left > c.left && p.left < c.right && p.top > c.top && p.top < c.bottom; }, k1.id);
  assert.ok(poz, 'pinezka na stronie');

  // Komentarz do strony, którą potem usunięto: „strona usunięta”, „Pokaż na stronie” nieaktywne.
  const druga = await a.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    const s = P.nowaStrona('Druga', p.sekcje[0].id);
    p.strony.push(s);
    return s.id;
  });
  await a.evaluate(async ([projekt, strona]) => (await import('./js/komentarze-chmura.js')).dodajKomentarz({ projekt, strona, x: 5, y: 5, tresc: 'Na drugiej' }), [pid, druga]);
  await a.evaluate(() => { window.seriodruk.stan.projekt.strony.splice(1, 1); });
  await a.evaluate(() => document.querySelector('[data-akcja="komentarze"]').click());
  await a.click('.filtry-komentarzy [data-filtr="wszystkie"]');
  const k3 = baza.komentarze.find((k) => k.tresc === 'Na drugiej');
  await a.waitForSelector(`.watek-komentarza[data-id="${k3.id}"]`);
  await rozwin(a, k3.id);
  assert.match(await a.textContent(`.watek-komentarza[data-id="${k3.id}"] .opis-watku`), /strona usunięta/);
  assert.equal(await a.isDisabled(`.watek-komentarza[data-id="${k3.id}"] [data-op="pokaz"]`), true);
});
