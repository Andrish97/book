// Grzbiet twardej oprawy zaokrąglony albo prosty (zgłoszenie 19.11: „czy da się zrobić książkę z zaokrąglonym
// grzbietem?”): ustawienie okładki `grzbiet` ('okragly' – domyślnie, 'prosty'); makieta – wypukły blok i łukowata
// skorupa grzbietu albo płaski grzbiet; pole „Grzbiet” w ustawieniach okładki.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('makieta: grzbiet zaokrąglony wychodzi łukiem, prosty jest płaski', async () => {
  const M = await modul('js/makieta-3d.js');
  const { normalizujOkladke } = await modul('js/okladka.js');
  assert.equal(normalizujOkladke({ oprawa: 'twarda' }).grzbiet, 'okragly');
  assert.equal(normalizujOkladke({ oprawa: 'twarda', grzbiet: 'prosty' }).grzbiet, 'prosty');
  const glebokosc = (g) => {
    const k = M.kartkiModelu('ksiazka_twarda', { strony: 200, format: { w: 148, h: 210 }, okladka: { w: 151, h: 216, tektura: 2.5, grzbiet: g }, kartka_mm: 0.1 });
    const q = M.scena('ksiazka_twarda', k, 0, {}).filter((x) => x.tex === 'okl:grzbiet');
    return -Math.min(...q.flatMap((x) => x.p.map((p) => p[0])));
  };
  const okragly = glebokosc('okragly');
  const prosty = glebokosc('prosty');
  assert.ok(okragly - prosty > 1.5, `łuk grzbietu: zaokrąglony ${okragly.toFixed(1)} mm, prosty ${prosty.toFixed(1)} mm`);
});

test('ustawienia okładki: pole Grzbiet zapisuje kształt', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Grzbiet');
  await strona.evaluate(async () => {
    const { zbudujProjekt } = await import('./js/szablony-projektow.js');
    const p = await zbudujProjekt('ksiazka-twarda', { nazwa: 'Twarda' });
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa === 'Twarda' && window.seriodruk.edytor?.wydruk);
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(p.sekcje.find((s) => s.okladka).id);
  });
  await strona.waitForSelector('#dlg-sekcja[open], dialog[open] select[name="ok_ksztalt_grzbietu"]');
  assert.equal(await strona.inputValue('select[name="ok_ksztalt_grzbietu"]'), 'okragly');
  await strona.selectOption('select[name="ok_ksztalt_grzbietu"]', 'prosty');
  await strona.click('#dlg-sekcja button[value="ok"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje.find((s) => s.okladka).okladka.grzbiet === 'prosty');
  assert.deepEqual(bledy, []);
});
