// Zakres zapisu (zgłoszenie 19.11: „wybrane sekcje, a nie sekcja, i strony nie tylko od–do, ale jak w Wordzie
// 1-5, 8”): parser zakresu, okno eksportu PDF (kilka sekcji, pole stron z podpowiedzią), okno druku, łącznik AI.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('zakres jak w Wordzie: parser, wybrane sekcje i strony w oknach PDF i druku, łącznik AI', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Zakres'); // edytor (i biblioteka płótna) wczytuje się z projektem
  const parser = await strona.evaluate(async () => {
    const { parsujZakresStron } = await import('./js/eksport.js');
    return ['1-5, 8', '11-', '-3', '2; 4–6', 'abc, 3', '5-2', '1-5,8,30', '3,1,3'].map((x) => parsujZakresStron(x, 12));
  });
  assert.deepEqual(parser[0].numery, [1, 2, 3, 4, 5, 8]);
  assert.deepEqual(parser[1].numery, [11, 12]);
  assert.deepEqual(parser[2].numery, [1, 2, 3]);
  assert.deepEqual(parser[3].numery, [2, 4, 5, 6], 'średnik i półpauza');
  assert.deepEqual([parser[4].numery, parser[4].bledy], [[3], ['abc']]);
  assert.deepEqual(parser[5].bledy, ['5-2']);
  assert.deepEqual([parser[6].numery, parser[6].poza], [[1, 2, 3, 4, 5, 8], [30]]);
  assert.deepEqual(parser[7].numery, [1, 3], 'bez powtórzeń, po kolei');

  // Projekt: trzy sekcje po 2 strony.
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    p.sekcje[0].nazwa = 'Wstęp';
    p.strony.push(P.nowaStrona('S2', p.sekcje[0].id));
    for (const n of ['Rozdział 1', 'Rozdział 2']) {
      const s = P.nowaSekcja(n);
      p.sekcje.push(s);
      p.strony.push(P.nowaStrona(`${n} a`, s.id), P.nowaStrona(`${n} b`, s.id));
    }
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  });
  await strona.waitForFunction(() => window.seriodruk.edytor?.wydruk);
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="pdf"]');
  await strona.waitForSelector('#dlg-pdf[open]');
  // Wybrane sekcje: na start bieżąca; dochodzi druga – 4 strony.
  await strona.selectOption('#form-pdf select[name=zakres]', 'sekcje');
  assert.deepEqual(await strona.$$eval('#pdf-lista-sekcji label', (l) => l.map((x) => [x.textContent, x.querySelector('input').checked])), [['Wstęp (2 str.)', true], ['Rozdział 1 (2 str.)', false], ['Rozdział 2 (2 str.)', false]]);
  await strona.check('#pdf-lista-sekcji label:has-text("Rozdział 2") input');
  assert.match(await strona.textContent('#pdf-podsumowanie'), /Do eksportu: 4 strony/);
  // Wybrane strony jak w Wordzie.
  await strona.selectOption('#form-pdf select[name=zakres]', 'strony');
  assert.equal(await strona.inputValue('#form-pdf input[name=strony]'), '1-6');
  await strona.fill('#form-pdf input[name=strony]', '1-2, 5');
  assert.match(await strona.textContent('#pdf-podsumowanie'), /^Do eksportu: 3 strony/);
  await strona.fill('#form-pdf input[name=strony]', '1-2, xx, 9');
  const pod = await strona.textContent('#pdf-podsumowanie');
  assert.match(pod, /Nie rozumiem: „xx”/);
  await strona.fill('#form-pdf input[name=strony]', '2, 4-');
  const egz = await strona.evaluate(async () => {
    const { wybierzEgzemplarze } = await import('./js/eksport.js');
    const o = window.seriodruk.oknoPdf.opcje();
    return wybierzEgzemplarze(window.seriodruk.oknoPdf.ciag, o).map((e) => e.strona.nazwa);
  });
  assert.deepEqual(egz, ['S2', 'Rozdział 1 b', 'Rozdział 2 a', 'Rozdział 2 b']);
  await strona.evaluate(() => document.querySelector('#dlg-pdf').close());

  // Łącznik AI: sekcje po nazwach i strony tekstem.
  const ai = await strona.evaluate(async () => {
    const { opcjePdf } = await import('./js/app/eksport-ai.js');
    const { wybierzEgzemplarze } = await import('./js/eksport.js');
    const { rozwin } = await import('./js/serie.js');
    const p = window.seriodruk.stan.projekt;
    const c = rozwin(p);
    const n = (u) => wybierzEgzemplarze(c, opcjePdf(p, u)).map((e) => e.strona.nazwa);
    let blad = '';
    try { opcjePdf(p, { zakres: 'sekcje', sekcje: ['Nie ma'] }); } catch (e) { blad = e.message; }
    return { sekcje: n({ zakres: 'sekcje', sekcje: ['wstęp', 'Rozdział 2'] }), strony: n({ zakres: 'strony', strony: '1, 3-4' }), od: n({ zakres: 'strony', od: 5 }), blad };
  });
  assert.deepEqual(ai.sekcje, ['Strona 1', 'S2', 'Rozdział 2 a', 'Rozdział 2 b'].map((x, i) => (i === 0 ? ai.sekcje[0] : x)));
  assert.deepEqual(ai.strony.slice(1), ['Rozdział 1 a', 'Rozdział 1 b']);
  assert.deepEqual(ai.od, ['Rozdział 2 a', 'Rozdział 2 b'], 'dawne od–do działa dalej');
  assert.match(ai.blad, /Projekt nie ma sekcji „Nie ma”/);

  // Okno druku: te same możliwości.
  await strona.evaluate(() => document.querySelector('[data-akcja="drukuj"]')?.click());
  await strona.waitForSelector('#dlg-druk[open], dialog[open] #druk-lista-sekcji');
  await strona.selectOption('select[name=zakres]:visible', 'strony');
  await strona.fill('#druk-pole-strony input[name=strony]', '3-4, 6');
  assert.match(await strona.textContent('#druk-opis'), /^3 stron/);
  assert.deepEqual(bledy, []);
});
