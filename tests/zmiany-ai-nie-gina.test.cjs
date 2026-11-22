// Zmiany zrobione przez AI, gdy projekt był zamknięty na tym urządzeniu, nie mogą zniknąć po jego otwarciu (#135):
// także wtedy, gdy zegar urządzenia się spieszy (stara kopia z urządzenia wyglądała na nowszą od konta).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, oknoAi, zamknijAi } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

test('zmiany od AI przy zamkniętym projekcie zostają po otwarciu – także przy spieszącym się zegarze urządzenia', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Praca AI');
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  await zapisano(strona);
  await oknoAi(strona);
  await strona.click('[data-akcja="dostep-ai-utworz"]');
  await strona.waitForSelector('#dostep-ai-gotowy:not([hidden])');
  const klucz = await strona.inputValue('#dostep-ai-klucz');
  await zamknijAi(strona);

  // Użytkownik zamyka projekt; kopia na urządzeniu ma datę „z przyszłości” (zegar telefonu się spieszy).
  await strona.click('.pasek-edytora [data-akcja="do-projektow"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty' && [...document.querySelectorAll('.karta-projektu:not(.szkielet), #pusto-projekty')].some((e) => e.offsetParent));
  await strona.evaluate(async () => {
    const { listaLokalnych, wczytajLokalnie, zapiszLokalnie } = await import('./js/lokalny.js');
    const { wlasciciel } = await import('./js/app/kontekst.js');
    const [l] = await listaLokalnych(wlasciciel());
    const { projekt } = await wczytajLokalnie(l.id);
    projekt.zmieniono = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
    await zapiszLokalnie(projekt, wlasciciel(), false);
  });

  // W tym czasie AI zmienia projekt na koncie.
  const odczyt = baza.ai('ai_projekt', { p_klucz: klucz });
  const s = odczyt.projekt.strony[0];
  const w = baza.ai('ai_zapisz', {
    p_klucz: klucz, p_znana_wersja: odczyt.wersja,
    p_zmiany: { strony: [{ ...s, obiekty: s.obiekty.map((o) => (o.type.toLowerCase() === 'rect' ? { ...o, fill: '#c1121f' } : o)) }] },
  });
  assert.equal(w.strony_zapisane, 1, JSON.stringify(w));

  // Użytkownik wraca i otwiera projekt: widzi zmianę od AI, a konto jej nie traci.
  await strona.reload();
  await strona.waitForSelector('.karta-projektu:not(.szkielet)');
  await strona.click('.karta-projektu .otworz-projekt');
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((x) => x.type === 'rect' && !x.zWzorca));
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'rect' && !x.zWzorca)?.fill === '#c1121f', null, { timeout: 15000 });
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-elipse"]').click());
  await zapisano(strona);
  const naKoncie = baza.ai('ai_projekt', { p_klucz: klucz }).projekt.strony[0].obiekty;
  assert.equal(naKoncie.find((o) => o.type.toLowerCase() === 'rect').fill, '#c1121f', 'zmiana od AI została na koncie');
  assert.ok(naKoncie.some((o) => o.type.toLowerCase() === 'ellipse'), 'zmiana użytkownika też');
  assert.deepEqual(bledy, []);
});
