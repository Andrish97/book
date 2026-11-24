// Zgłoszenie 19.11: „zdejmuję znak wodny, a on zostaje” + „ustawienia mają się zapisać od razu” + „jeśli zamykamy
// okno, pliki dalej się tworzą, a pokazujemy pasek postępu” (#316). Ustawienie znaku wodnego trafia do projektu
// (i na konto) od razu, zanim narysują się strony linku; strony rysują się w tle z paskiem „nie zamykaj Makietki”
// także po zamknięciu okna Udostępnij, a zamknięcie karty w trakcie pyta o potwierdzenie.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('znak wodny: zapis od razu, strony linku w tle z paskiem postępu po zamknięciu okna', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await nowyProjekt(strona, 'W tle');
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'podglad');
  await strona.click('[data-akcja="udostepnij"]');
  await strona.click('#udostepnij-utworz');
  await strona.waitForFunction(() => document.querySelector('#udostepnij-komunikat.sukces') && !document.querySelector('#udostepnij-utworz').disabled, null, { timeout: 30000 });

  // Wysyłka stron linku wstrzymana – jak wolne łącze albo długi projekt.
  let pusc;
  const wstrzymane = new Promise((ok) => { pusc = ok; });
  await strona.route((u) => u.href.includes('podglady/'), async (r) => {
    if (r.request().method() === 'PUT') await wstrzymane;
    await r.fallback();
  });
  await strona.check('#udostepnij-znak-wl');
  await strona.fill('#udostepnij-znak-tekst', 'WZÓR');
  await strona.click('#udostepnij-znak-zapisz');
  // Zapisane od razu – w projekcie i na koncie, choć strony linku jeszcze się nie wysłały.
  await strona.waitForFunction(() => /Zapisano\. Strony linku/.test(document.querySelector('#udostepnij-komunikat').textContent), null, { timeout: 15000 });
  const naKoncie = () => baza.projekty.find((p) => p.nazwa === 'W tle' || p.dane?.nazwa === 'W tle')?.dane?.udostepnienia?.[0]?.znak_wodny; // #426: znak wodny należy do linku
  for (let i = 0; i < 50 && !naKoncie(); i += 1) await strona.waitForTimeout(200);
  assert.deepEqual(naKoncie(), { tekst: 'WZÓR', krycie: 12 }, 'znak wodny na koncie przed końcem aktualizacji linku');
  // Okno można zamknąć – pasek na dole ekranu zostaje, karta pyta przy zamknięciu.
  await strona.evaluate(() => document.querySelector('#udostepnij-znak').closest('dialog').close());
  await strona.waitForFunction(() => [...document.querySelectorAll('.postep')].some((e) => /nie zamykaj Makietki/.test(e.textContent) && e.offsetParent));
  assert.equal(await strona.evaluate(async () => (await import('./js/app/podglad-ekran.js')).trwaAktualizacjaLinku()), true);
  const pyta = await strona.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  assert.equal(pyta, true, 'zamknięcie karty w trakcie pyta o potwierdzenie');

  pusc();
  const trwa = () => strona.evaluate(async () => (await import('./js/app/podglad-ekran.js')).trwaAktualizacjaLinku());
  for (let i = 0; i < 150 && await trwa(); i += 1) await strona.waitForTimeout(200);
  assert.equal(await trwa(), false, 'aktualizacja linku skończona');
  assert.deepEqual(await strona.evaluate(() => [...document.querySelectorAll('.postep')].filter((e) => e.offsetParent).map((e) => e.textContent.trim())), [], 'pasek znika po końcu');
  // Link ma już strony ze znakiem: odcisk linku zgodny z treścią (bez ponownej aktualizacji przy otwarciu).
  const zgodny = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    return { znak: p.udostepnienia?.[0]?.znak_wodny, odcisk: Boolean(p.udostepnienia?.[0]?.odcisk) };
  });
  assert.deepEqual(zgodny, { znak: { tekst: 'WZÓR', krycie: 12 }, odcisk: true });
  const ostatni = await strona.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  assert.equal(ostatni, false, 'po końcu karta zamyka się bez pytania');
  assert.deepEqual(bledy, []);
});
