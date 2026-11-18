// Materiały okładki (#214): okleina (płótno, skóra ekologiczna…) w kolorze albo druk z folią, zaokrąglone rogi –
// w ustawieniach sekcji okładki, w kontroli przed drukiem, w makiecie 3D (tekstura okleiny) i w specyfikacji dla drukarni.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('materiał okładki: płótno bordowe z rogami 5 mm – ustawienia, kontrola, tekstura 3D, specyfikacja', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Książka z płótna');
  await strona.evaluate(async () => {
    const { zbudujProjekt } = await import('./js/szablony-projektow.js');
    const p = await zbudujProjekt('ksiazka-twarda', { nazwa: 'Książka z płótna' });
    const { otworzProjekt } = await import('./js/app/zapis.js');
    await otworzProjekt(p);
  });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].okladka);
  await strona.evaluate(async () => (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(window.seriodruk.stan.projekt.sekcje[0].id));
  await strona.waitForSelector('#dlg-sekcja[open]');
  assert.ok(await strona.isVisible('#pole-ok-folia'), 'druk – wybór folii');
  await strona.selectOption('#dlg-sekcja select[name="ok_material"]', 'plotno');
  assert.ok(await strona.isHidden('#pole-ok-folia'));
  await strona.selectOption('#dlg-sekcja select[name="ok_kolor_materialu"]', '#6d1a24');
  await strona.selectOption('#dlg-sekcja select[name="ok_rogi"]', '5');
  assert.match(await strona.textContent('#opis-materialu'), /Grafika okładki się nie drukuje/);
  await strona.click('#dlg-sekcja button[value="ok"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje[0].okladka.wykonczenie?.material === 'plotno');
  const w = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { specyfikacja, specyfikacjaTekst } = await import('./js/specyfikacja.js');
    const { teksturaOkleiny } = await import('./js/materialy.js');
    const c = teksturaOkleiny(p.sekcje[0].okladka.wykonczenie, 40, 60);
    const px = c.getContext('2d').getImageData(20, 30, 1, 1).data;
    return {
      wyk: p.sekcje[0].okladka.wykonczenie,
      uwagi: sprawdzProjekt(p).filter((u) => u.rodzaj === 'material').map((u) => u.opis),
      tekst: specyfikacjaTekst(specyfikacja(p)),
      piksel: [px[0], px[1], px[2]],
      rogi: window.seriodruk.edytor.wydruk?.okladka?.rogi_mm,
    };
  });
  assert.deepEqual(w.wyk, { material: 'plotno', kolor: '#6d1a24', rogi_mm: 5 });
  assert.equal(w.uwagi.length, 2);
  assert.match(w.uwagi[0], /z okleiny \(Płótno introligatorskie – Bordowe, rogi zaokrąglone 5 mm\)/);
  assert.match(w.tekst, /Okładka: Płótno introligatorskie – Bordowe, rogi zaokrąglone 5 mm/);
  assert.match(w.tekst, /Oprawa: Twarda.*grzbiet/);
  assert.match(w.tekst, /Składki po 16 stron/);
  assert.ok(Math.abs(w.piksel[0] - 0x6d) < 30 && w.piksel[2] < 70, `kolor okleiny: ${w.piksel}`);
  assert.deepEqual(bledy, []);
});
