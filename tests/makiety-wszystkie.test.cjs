// Wszystkie makiety 3D (#215) na prawdziwych projektach (szablony projektów i sekcje specjalne): projekt dostaje
// tylko pasujące rodzaje (jeden, najwyżej dwa – książka nigdy nie jest kalendarzem), każdy się rysuje (na płótnie
// jest obraz, nie jednolita plama), kartkowanie w przód i w tył działa, bez błędów; rodzaj spoza pasujących mówi,
// czego brakuje.
// ZRZUTY_MAKIET=<folder> – zrzut każdej makiety (do obejrzenia).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

// Projekty: szablon projektu albo projekt z jedną sekcją specjalną / szablonem sekcji.
const PROJEKTY = [
  { nazwa: 'Książka twarda', szablon: 'ksiazka-twarda', modele: ['ksiazka_twarda'] },
  { nazwa: 'Książka miękka', szablon: 'ksiazka-miekka', modele: ['ksiazka_miekka', 'notes'] },
  { nazwa: 'Broszura', szablon: 'broszura', modele: ['ksiazka_zeszytowa'] },
  { nazwa: 'Kalendarz ścienny', szablon: 'kalendarz-scienny-plecy', modele: ['kalendarz_scienny', 'kalendarz_biurkowy'] },
  { nazwa: 'Kalendarz biurkowy', sekcja: 'kalendarz-biurkowy', modele: ['kalendarz_biurkowy', 'kalendarz_scienny'] },
  { nazwa: 'Zaproszenie', sekcja: 'zaproszenie', modele: ['kartka'] },
  { nazwa: 'Ulotka', sekcja: 'broszura-skladana', modele: ['ulotka'] },
  { nazwa: 'Koperta', specjalna: { typ: 'wykrojnik', ksztalt: 'koperta', koperta: 'C6' }, modele: ['koperta'] },
  { nazwa: 'Pudełko', specjalna: { typ: 'wykrojnik', ksztalt: 'pudelko', dlugosc_mm: 100, szerokosc_mm: 60, wysokosc_mm: 150 }, modele: ['pudelko'] },
  { nazwa: 'Trójdzielny', specjalna: { typ: 'trojdzielny' }, modele: ['trojdzielny'] },
];

test('wszystkie makiety 3D: każda się rysuje i kartkuje na prawdziwym projekcie', { timeout: 560000 }, async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  const wyniki = [];
  for (const pr of PROJEKTY) {
    await strona.evaluate(async (opis) => {
      const { zbudujProjekt } = await import('./js/szablony-projektow.js');
      const { wstawGotowaSekcje, usunPustyStart } = await import('./js/gotowe-sekcje.js');
      const P = await import('./js/projekt.js');
      const { przeliczOkladki } = await import('./js/okladka.js');
      const { otworzProjekt } = await import('./js/app/zapis.js');
      let p;
      if (opis.szablon) p = await zbudujProjekt(opis.szablon, { nazwa: opis.nazwa });
      else {
        p = P.normalizuj(P.nowyProjekt(opis.nazwa));
        if (opis.sekcja) {
          const { sekcja } = await wstawGotowaSekcje(p, opis.sekcja, { wlasnyFormat: true });
          usunPustyStart(p, sekcja);
        } else {
          const { typ, ...parametry } = opis.specjalna;
          const s = p.sekcje[0];
          s.typ = typ;
          s.specjalna = { rodzaj: typ, ...parametry };
          p.strony[0].obiekty.push({ type: 'rect', left: 5, top: 5, width: 40, height: 30, fill: '#c0392b' });
          p = P.normalizuj(p);
        }
        przeliczOkladki(p);
      }
      // Na każdej stronie coś kolorowego – żeby obraz nie był jednolity.
      for (const [i, s] of p.strony.entries()) if (!s.obiekty.length) s.obiekty.push({ type: 'rect', left: 8, top: 8, width: 30, height: 20, fill: ['#2980b9', '#27ae60', '#8e44ad'][i % 3] });
      await otworzProjekt(p);
    }, pr);
    await strona.waitForFunction((n) => window.seriodruk.stan.projekt?.nazwa === n && window.seriodruk.edytor?.wydruk, pr.nazwa);
    await strona.click('[data-akcja="podglad"]');
    await strona.waitForSelector('.podglad-strona[data-id]');
    await strona.click('[data-akcja="podglad-makieta"]');
    await strona.waitForSelector('#dlg-makieta[open]');
    const dostepne = await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).stanMakiety().modele);
    assert.deepEqual(dostepne, pr.modele, `${pr.nazwa}: pasujące rodzaje`);
    const inne = await strona.evaluate(() => [...document.querySelectorAll('#makieta-model optgroup option')].map((o) => o.value));
    if (pr.szablon === 'ksiazka-twarda') {
      assert.ok(inne.includes('kalendarz_scienny'), 'kalendarz tylko w „Nie pasuje do projektu”');
      await strona.selectOption('#makieta-model', 'kalendarz_scienny');
      await strona.waitForFunction(() => /nie pasuje do tego projektu.*13 kart/.test(document.querySelector('#makieta-uwaga').textContent));
    }
    for (const model of dostepne) {
      await strona.selectOption('#makieta-model', model);
      await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 30000 });
      const probka = () => strona.evaluate(() => {
        const c = document.querySelector('#makieta-plotno');
        const gl = c.getContext('webgl') || c.getContext('webgl2');
        const kolory = new Set();
        for (let i = 1; i < 6; i += 1) for (let j = 1; j < 6; j += 1) {
          const px = new Uint8Array(4);
          gl.readPixels(Math.round((c.width * i) / 6), Math.round((c.height * j) / 6), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          kolory.add(px.join(','));
        }
        return kolory.size;
      });
      const ileKolorow = await probka();
      // Kartkowanie: kilka razy w przód i z powrotem.
      const polozenia = [await strona.textContent('#makieta-polozenie')];
      for (let i = 0; i < 2; i += 1) {
        await strona.click('#makieta-dalej').catch(() => {});
        await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 30000 });
        polozenia.push(await strona.textContent('#makieta-polozenie'));
      }
      await strona.keyboard.press('ArrowLeft');
      await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 30000 });
      if (process.env.ZRZUTY_MAKIET) await strona.screenshot({ path: path.join(process.env.ZRZUTY_MAKIET, `${pr.nazwa.replace(/\s+/g, '-')}-${model}.png`) });
      const polozen = await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).stanMakiety().polozen);
      wyniki.push({ projekt: pr.nazwa, model, ileKolorow, polozenia: [...new Set(polozenia)].length, polozen });
    }
    await strona.click('[data-akcja="makieta-zamknij"]');
    await strona.waitForSelector('#dlg-makieta', { state: 'hidden' });
    await strona.evaluate(() => { location.hash = '#/projekty'; });
    await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  }
  for (const w of wyniki) {
    assert.ok(w.ileKolorow >= 3, `${w.projekt} / ${w.model}: obraz ma treść (${w.ileKolorow} kolorów)`);
    // Jedna karta (np. kalendarz trójdzielny) – nie ma czego kartkować.
    assert.ok(w.polozen === 0 || w.polozenia >= 2, `${w.projekt} / ${w.model}: kartkowanie zmienia położenie`);
  }
  assert.deepEqual(bledy, []);
  t.diagnostic(JSON.stringify(wyniki));
});
