// #426: kilka niezależnych linków podglądu w jednym projekcie – jak klucze AI: każdy z własną nazwą, hasłem, znakiem
// wodnym i makietą 3D, własnym krótkim adresem; unieważnienie jednego nie rusza pozostałych. Pojedynczy link sprzed
// tej zmiany (udostepnienie + znak wodny projektu) staje się pierwszym linkiem listy.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('kilka linków podglądu: różne ustawienia, osobne adresy, unieważnienie jednego', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await nowyProjekt(strona, 'Dwa linki');
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');
  const gotowe = () => strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-utworz').disabled && !document.querySelector('#udostepnij-teraz').disabled, null, { timeout: 30000 });

  // Pierwszy link: „Klient”, bez ochrony.
  await strona.fill('#udostepnij-nazwa', 'Klient');
  await strona.click('#udostepnij-utworz');
  await gotowe();
  const linkKlienta = await strona.inputValue('#udostepnij-link');

  // Drugi: „Drukarnia” – z hasłem i znakiem wodnym, bez makiety 3D.
  await strona.click('#udostepnij-linki li.nowy button');
  assert.ok(await strona.isVisible('#udostepnij-utworz'), 'nowy link – przycisk „Utwórz link”');
  await strona.fill('#udostepnij-nazwa', 'Drukarnia');
  await strona.check('#udostepnij-haslo-wl');
  await strona.fill('#udostepnij-haslo', 'tajne1');
  await strona.check('#udostepnij-znak-wl');
  await strona.fill('#udostepnij-znak-tekst', 'DO DRUKU');
  await strona.uncheck('#udostepnij-makieta-wl');
  await strona.click('#udostepnij-utworz');
  await gotowe();
  const linkDrukarni = await strona.inputValue('#udostepnij-link');
  assert.notEqual(linkDrukarni, linkKlienta, 'osobne adresy');
  assert.match(linkDrukarni, /^http:\/\/[^/]+\/[a-hj-km-np-z2-9]{6}$/);

  const linki = await strona.evaluate(() => window.seriodruk.stan.projekt.udostepnienia.map((l) => ({ nazwa: l.nazwa, kod: Boolean(l.kod), haslo: Boolean(l.ochrona?.haslo), znak: l.znak_wodny?.tekst || null, makieta: l.makieta_linku || null })));
  assert.deepEqual(linki, [
    { nazwa: 'Klient', kod: true, haslo: false, znak: null, makieta: null },
    { nazwa: 'Drukarnia', kod: true, haslo: true, znak: 'DO DRUKU', makieta: { pokaz: false } },
  ]);
  assert.equal(baza.krotkie.size, 2, 'dwa krótkie adresy');
  // Lista w oknie: dwa linki i „+ Nowy link”; wybór pierwszego pokazuje jego ustawienia.
  assert.equal(await strona.locator('#udostepnij-linki li').count(), 3);
  await strona.click('#udostepnij-linki li:has-text("Klient") .link-wybor');
  assert.equal(await strona.inputValue('#udostepnij-link'), linkKlienta);
  assert.equal(await strona.isChecked('#udostepnij-haslo-wl'), false);
  assert.equal(await strona.isChecked('#udostepnij-znak-wl'), false);

  // Unieważnienie „Drukarni” – „Klient” działa dalej (jego krótki adres zostaje).
  await strona.click('#udostepnij-linki li:has-text("Drukarnia") .link-wybor');
  await strona.click('#udostepnij-wylacz');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.udostepnienia?.length === 1);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.udostepnienia[0].nazwa), 'Klient');
  assert.deepEqual([...baza.krotkie.keys()], [linkKlienta.split('/').pop()]);
  assert.deepEqual(bledy, []);
});

test('link sprzed #426 (udostepnienie, znak wodny i makieta projektu) staje się pierwszym linkiem listy', async (t) => {
  const { strona, bledy } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = P.normalizuj({ nazwa: 'Stary', strony: [], sekcje: [], udostepnienie: { kod: 'abc', konto: 'k1', krotki: 'xyz234', ochrona: { haslo: true, wazny_do: null } }, znak_wodny: { tekst: 'WZÓR', krycie: 12 }, makieta_linku: { pokaz: false } });
    return { linki: p.udostepnienia, stare: [p.udostepnienie, p.znak_wodny, p.makieta_linku] };
  });
  assert.equal(w.linki.length, 1);
  assert.deepEqual({ ...w.linki[0], id: undefined }, { kod: 'abc', konto: 'k1', krotki: 'xyz234', ochrona: { haslo: true, wazny_do: null }, znak_wodny: { tekst: 'WZÓR', krycie: 12 }, makieta_linku: { pokaz: false }, id: undefined, nazwa: '' });
  assert.deepEqual(w.stare, [undefined, undefined, undefined]);
  assert.deepEqual(bledy, []);
});
