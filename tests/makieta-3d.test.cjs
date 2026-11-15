// Makieta 3D (#131D): kartki modeli i geometria (js/makieta-3d.js) oraz okno w podglądzie – książka
// z okładką z sekcji okładki (#119), kartkowanie, obracanie, zmiana rodzaju, kalendarz, obraz PNG.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('makieta 3D: kartki książki z okładką, grzbiet zamkniętej książki, rozkładówka po przewróceniu, kalendarz i kartka', async () => {
  const { kartkiModelu, scena, obwiednia, polozenia, opisPolozenia } = await modul('js/makieta-3d.js');
  const format = { w: 148, h: 210 };
  // Książka miękka: okładka + 5 kartek środka (10 stron, ostatnia kartka ma tył) + tył okładki.
  const k = kartkiModelu('ksiazka_miekka', { strony: 10, format, okladka: { w: 148, h: 210 }, kartka_mm: 0.1 });
  assert.equal(k.length, 7);
  assert.equal(k[0].przod, 'okl:przod');
  assert.deepEqual([k[1].przod, k[1].tyl], ['p:0', 'p:1']);
  assert.equal(k.at(-1).tyl, 'okl:tyl');
  assert.equal(polozenia('ksiazka_miekka', k), 7);
  // Zamknięta: przód okładki na wierzchu, tył na spodzie, grzbiet z okładki na boku zawiasu.
  let q = scena('ksiazka_miekka', k, 0);
  const grubosc = 2 * 0.35 + 5 * 0.1;
  const wierzch = q.filter((x) => x.p.every((p) => Math.abs(p[2] - grubosc) < 1e-6));
  assert.ok(wierzch.some((x) => x.tex === 'okl:przod'), 'przód okładki na wierzchu');
  assert.ok(q.some((x) => x.tex === 'okl:tyl' && x.p.every((p) => Math.abs(p[2]) < 1e-6)), 'tył okładki na spodzie');
  const grzbiet = q.find((x) => x.grzbiet);
  assert.equal(grzbiet.tex, 'okl:grzbiet');
  assert.ok(grzbiet.p.every((p) => Math.abs(p[0]) < 1e-6), 'grzbiet w płaszczyźnie zawiasu');
  assert.equal(opisPolozenia('ksiazka_miekka', k, 0), 'Okładka');
  // Po przewróceniu dwóch kartek widać strony 2–3: lewa (tył kartki 1) i prawa (przód kartki 2).
  q = scena('ksiazka_miekka', k, 2);
  const tekstury = new Set(q.map((x) => x.tex));
  assert.ok(tekstury.has('p:1') && tekstury.has('p:2'));
  assert.equal(opisPolozenia('ksiazka_miekka', k, 2), 'Strony 2–3');
  const ob = obwiednia(q);
  assert.ok(ob.min[0] < -140 && ob.max[0] > 140, 'otwarta książka sięga w obie strony grzbietu');
  // W trakcie przewracania kartka podnosi się nad stos.
  q = scena('ksiazka_miekka', k, 1.5);
  assert.ok(obwiednia(q).max[2] > 100, 'przewracana kartka stoi nad książką');
  // Twarda: okładka większa od środka i grubsza.
  const t = kartkiModelu('ksiazka_twarda', { strony: 10, format, okladka: null });
  assert.ok(t[0].w > 148 && t[0].h > 210 && t[0].d >= 2);
  // Kalendarz ścienny: każda strona to karta, spirala u góry; przewrócona karta wisi z tyłu.
  const c = kartkiModelu('kalendarz_scienny', { strony: 13, format: { w: 297, h: 420 } });
  assert.equal(c.length, 13);
  q = scena('kalendarz_scienny', c, 1);
  assert.ok(q.some((x) => x.tex === 'p:1'), 'druga karta na wierzchu');
  assert.ok(q.some((x) => x.tex.startsWith('kolor:#3a3d44')), 'spirala');
  assert.equal(opisPolozenia('kalendarz_scienny', c, 1), 'Karta 2 z 13');
  // Kartka: przód i tył, po obrocie tył.
  const s = kartkiModelu('kartka', { strony: 2, format });
  assert.equal(polozenia('kartka', s), 1);
  assert.equal(opisPolozenia('kartka', s, 1), 'Strona 2');
});

test('makieta 3D w podglądzie: przycisk obok „Separacji”, książka z okładką, kartkowanie, obracanie, rodzaj, PNG', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Makieta');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const O = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    const srodek = p.sekcje[0];
    const kolory = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#f39c12', '#16a085'];
    p.strony[0].obiekty.push({ type: 'rect', left: 10, top: 10, width: 100, height: 60, fill: kolory[0] });
    for (let i = 1; i < 6; i += 1) {
      const s = P.nowaStrona(`S${i + 1}`, srodek.id);
      s.obiekty.push({ type: 'rect', left: 10, top: 10, width: 100, height: 60, fill: kolory[i] });
      p.strony.push(s);
    }
    const ok = P.nowaSekcja('Okładka');
    ok.okladka = { oprawa: 'twarda' };
    p.sekcje.unshift(ok);
    const so = P.nowaStrona('Okładka', ok.id);
    so.tlo = '#1c2541';
    p.strony.unshift(so);
    O.przeliczOkladki(p);
  });
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForSelector('.podglad-strona[data-id]');
  // Przycisk widoczny na pasku podglądu, zaraz po „Separacjach”.
  const sasiad = await strona.evaluate(() => document.querySelector('[data-akcja="podglad-separacje"]').nextElementSibling.dataset.akcja);
  assert.equal(sasiad, 'podglad-makieta');
  await strona.click('[data-akcja="podglad-makieta"]');
  await strona.waitForSelector('#dlg-makieta[open]');
  const stan = () => strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).stanMakiety());
  let s = await stan();
  assert.equal(s.renderer, true, 'WebGL działa');
  assert.equal(s.model, 'ksiazka_twarda', 'twarda oprawa z sekcji okładki');
  assert.equal(await strona.textContent('#makieta-polozenie'), 'Okładka');
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 20000 });
  // Na płótnie coś jest: granat okładki widać w środku obrazu.
  const piksel = await strona.evaluate(() => {
    const c = document.querySelector('#makieta-plotno');
    const gl = c.getContext('webgl');
    const px = new Uint8Array(4);
    gl.readPixels(Math.round(c.width / 2), Math.round(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [...px];
  });
  assert.ok(piksel[3] > 0 && piksel[2] > piksel[0], `granatowa okładka na środku: ${piksel}`);
  // Kartkowanie przyciskiem i klawiszem.
  await strona.click('#makieta-dalej');
  await strona.waitForFunction(() => document.querySelector('#makieta-polozenie').textContent === 'Strona 1');
  await strona.keyboard.press('ArrowRight');
  await strona.waitForFunction(() => document.querySelector('#makieta-polozenie').textContent === 'Strony 2–3');
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true');
  if (process.env.ZRZUT_MAKIETY) await strona.screenshot({ path: process.env.ZRZUT_MAKIETY });
  // Obracanie przeciągnięciem.
  const przed = (await stan()).kamera.obrotY;
  const r = await strona.locator('#makieta-plotno').boundingBox();
  await strona.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await strona.mouse.down();
  await strona.mouse.move(r.x + r.width / 2 + 120, r.y + r.height / 2, { steps: 6 });
  await strona.mouse.up();
  assert.ok((await stan()).kamera.obrotY > przed + 0.5, 'obrót myszą');
  // Rodzaj: kalendarz ścienny.
  await strona.selectOption('#makieta-model', 'kalendarz_scienny');
  s = await stan();
  assert.equal(s.model, 'kalendarz_scienny');
  assert.equal(s.kartek, 6);
  await strona.waitForFunction(() => /Karta 1 z 6/.test(document.querySelector('#makieta-polozenie').textContent));
  // Obraz makiety.
  const [plik] = await Promise.all([strona.waitForEvent('download'), strona.click('[data-akcja="makieta-pobierz"]')]);
  assert.match(plik.suggestedFilename(), /makieta\.png$/);
  await strona.click('[data-akcja="makieta-zamknij"]');
  await strona.waitForSelector('#dlg-makieta', { state: 'hidden' });
  assert.deepEqual(bledy, []);
});
