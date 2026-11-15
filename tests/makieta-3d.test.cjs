// Makieta 3D (#131D): kartki modeli i geometria (js/makieta-3d.js) oraz okno w podglądzie – książka
// z okładką z sekcji okładki (#119), kartkowanie, obracanie, zmiana rodzaju, kalendarz, obraz PNG.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('makieta 3D: kartki modeli i geometria w świecie (stół, ściana, biurko) – proporcje, grzbiet bez migotania, wygięte kartki', async () => {
  const { kartkiModelu, scena, obwiednia, polozenia, opisPolozenia, widokModelu, KRAWEDZ_KARTEK } = await modul('js/makieta-3d.js');
  const format = { w: 148, h: 210 };
  const bliskie = (a, b, e = 1e-6) => Math.abs(a - b) < e;
  const naStole = (q) => { const o = obwiednia(q); return o.min[1] > -0.01 && o.min[1] < 0.5; };
  // Książka miękka: okładka + 5 kartek środka (10 stron, ostatnia kartka ma tył) + tył okładki.
  const k = kartkiModelu('ksiazka_miekka', { strony: 10, format, okladka: { w: 148, h: 210 }, kartka_mm: 0.1 });
  assert.equal(k.length, 7);
  assert.equal(k[0].przod, 'okl:przod');
  assert.deepEqual([k[1].przod, k[1].tyl], ['p:0', 'p:1']);
  assert.equal(k.at(-1).tyl, 'okl:tyl');
  assert.equal(polozenia('ksiazka_miekka', k), 7);
  // Zamknięta leży na stole: przód okładki na wierzchu (y = grubość, normalna w górę), tył na spodzie.
  let q = scena('ksiazka_miekka', k, 0);
  assert.equal(q.podloze.typ, 'stol');
  assert.ok(naStole(q), 'leży na stole');
  const T = k.reduce((a, x) => a + x.d, 0);
  const przod = q.filter((x) => x.tex === 'okl:przod' && x.n[1] > 0.9);
  assert.ok(przod.length && przod.every((x) => x.p.every((p) => bliskie(p[1], T))), 'przód okładki na wierzchu');
  assert.ok(q.some((x) => x.tex === 'okl:tyl' && x.n[1] < -0.9 && x.p.every((p) => bliskie(p[1], 0))), 'tył okładki na spodzie');
  // Proporcje: przód okładki zajmuje dokładnie format strony (bez rozciągania).
  const op = obwiednia(przod);
  assert.ok(bliskie(op.max[0] - op.min[0], 148, 0.01) && bliskie(op.max[2] - op.min[2], 210, 0.01), 'przód okładki 148 × 210 mm');
  // Grzbiet z okładki: na zewnątrz zawiasu (x ≤ 0), od spodu do wierzchu; blok nie ma pod nim własnej ściany.
  const grzbiet = q.filter((x) => x.grzbiet);
  assert.ok(grzbiet.length && grzbiet.every((x) => x.tex === 'okl:grzbiet'));
  assert.ok(grzbiet.every((x) => x.p.every((p) => p[0] <= 1e-6)), 'grzbiet na zewnątrz');
  const og = obwiednia(grzbiet);
  assert.ok(bliskie(og.min[1], 0, 1e-3) && bliskie(og.max[1], T, 1e-3));
  assert.ok(!q.some((x) => x.tex === KRAWEDZ_KARTEK && x.p.every((p) => Math.abs(p[0]) < 1e-6)), 'brak ściany bloku w płaszczyźnie grzbietu (bez migotania)');
  assert.equal(opisPolozenia('ksiazka_miekka', k, 0), 'Okładka');
  // Po przewróceniu dwóch kartek widać strony 2–3; kartki przy grzbiecie są wygięte (nie płaskie deski).
  q = scena('ksiazka_miekka', k, 2);
  const tekstury = new Set(q.map((x) => x.tex));
  assert.ok(tekstury.has('p:1') && tekstury.has('p:2'));
  assert.equal(opisPolozenia('ksiazka_miekka', k, 2), 'Strony 2–3');
  const ob = obwiednia(q);
  assert.ok(ob.min[0] < -140 && ob.max[0] > 140, 'otwarta książka sięga w obie strony grzbietu');
  const prawa = obwiednia(q.filter((x) => x.tex === 'p:2'));
  assert.ok(prawa.max[1] - prawa.min[1] > 1, 'strona wygięta przy grzbiecie');
  assert.ok(q.some((x) => x.tex === 'p:2' && x.ao.some((a) => a < 0.8)), 'cień w zgięciu (AO przy grzbiecie)');
  // W trakcie przewracania kartka podnosi się nad stos (i jest wygięta).
  q = scena('ksiazka_miekka', k, 1.5);
  assert.ok(obwiednia(q).max[1] > 100, 'przewracana kartka stoi nad książką');
  // Twarda: okładka większa od środka i grubsza, grzbiet zaokrąglony (wystaje poza zawias).
  const t = kartkiModelu('ksiazka_twarda', { strony: 10, format, okladka: null });
  assert.ok(t[0].w > 148 && t[0].h > 210 && t[0].d >= 1.5);
  q = scena('ksiazka_twarda', t, 0);
  assert.ok(obwiednia(q.filter((x) => x.grzbiet)).min[0] < -0.8, 'zaokrąglony grzbiet');
  assert.ok(q.some((x) => x.mat === 'twarda'), 'tektura z połyskiem');
  // Notes: spirala z drutu, leży na stole.
  const n = kartkiModelu('notes', { strony: 10, format });
  q = scena('notes', n, 0);
  assert.ok(naStole(q) && q.some((x) => x.mat === 'drut'));
  // Kalendarz ścienny: każda strona to karta, spirala u góry, wisi przed ścianą (nic za nią).
  const c = kartkiModelu('kalendarz_scienny', { strony: 13, format: { w: 297, h: 420 } });
  assert.equal(c.length, 13);
  q = scena('kalendarz_scienny', c, 1);
  assert.ok(q.some((x) => x.tex === 'p:1'), 'druga karta na wierzchu');
  assert.ok(q.some((x) => x.mat === 'drut'), 'spirala');
  assert.equal(q.podloze.typ, 'sciana');
  assert.ok(obwiednia(q).min[2] >= q.podloze.poziom, 'nic nie wchodzi w ścianę');
  assert.ok(obwiednia(scena('kalendarz_scienny', c, 0.6)).min[2] >= q.podloze.poziom, 'także przewracana karta');
  assert.equal(opisPolozenia('kalendarz_scienny', c, 1), 'Karta 2 z 13');
  // Biurkowy stoi na blacie (y = 0) na stojaku z tektury.
  q = scena('kalendarz_biurkowy', c, 0);
  assert.ok(naStole(q) && q.some((x) => x.mat === 'tektura'));
  // Kartka: przód i tył, po obrocie tył; leży na stole w swoich proporcjach.
  const s = kartkiModelu('kartka', { strony: 2, format });
  assert.equal(polozenia('kartka', s), 1);
  assert.equal(opisPolozenia('kartka', s, 1), 'Strona 2');
  q = scena('kartka', s, 0);
  const ok = obwiednia(q.filter((x) => x.tex === 'p:0'));
  assert.ok(naStole(q) && bliskie((ok.max[0] - ok.min[0]) / (ok.max[2] - ok.min[2]), 148 / 210, 0.002));
  // Strony różnych formatów: każda kartka w swoim rozmiarze.
  const r = kartkiModelu('kalendarz_scienny', { strony: 2, format, rozmiary: [{ w: 148, h: 210 }, { w: 297, h: 210 }] });
  assert.deepEqual(r.map((x) => [x.w, x.h]), [[148, 210], [297, 210]]);
  // Widok: z góry na stół, kalendarz ścienny z przodu; granice obracania.
  assert.ok(widokModelu('ksiazka_twarda').minX > 0, 'nie zagląda pod stół');
  assert.ok(widokModelu('kalendarz_scienny').maxY < Math.PI / 2, 'nie zagląda za ścianę');
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
  // Bufor płótna w proporcjach tego, co widać – obraz nie jest rozciągnięty.
  const proporcje = await strona.evaluate(() => { const c = document.querySelector('#makieta-plotno'); const r = c.getBoundingClientRect(); return [c.width / c.height, r.width / r.height]; });
  assert.ok(Math.abs(proporcje[0] - proporcje[1]) < 0.02, `proporcje płótna ${proporcje}`);
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

// #157: drugie otwarcie makiety nie może trafić na utracony kontekst („brak WebGL” na każdym urządzeniu),
// a po utracie kontekstu (telefon w tle) obraz wraca sam.
test('makieta 3D: kolejne otwarcia i utrata kontekstu WebGL – obraz rysuje się dalej', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Makieta');
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForSelector('.podglad-strona[data-id]');
  const rysuje = () => strona.evaluate(() => {
    const c = document.querySelector('#makieta-plotno');
    const x = document.createElement('canvas'); x.width = 40; x.height = 40;
    const g = x.getContext('2d'); g.drawImage(c, 0, 0, 40, 40);
    const d = g.getImageData(0, 0, 40, 40).data;
    let rozne = 0;
    for (let i = 4; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 30) rozne += 1;
    return { brak: !document.querySelector('#makieta-brak-3d').hidden, rozne };
  });
  for (let i = 0; i < 3; i += 1) {
    await strona.evaluate(() => document.querySelector('[data-akcja="podglad-makieta"]').click());
    await strona.waitForSelector('#dlg-makieta[open]');
    await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 20000 });
    await strona.waitForTimeout(300);
    const r = await rysuje();
    assert.equal(r.brak, false, `otwarcie ${i + 1}: komunikat o braku WebGL`);
    assert.ok(r.rozne > 50, `otwarcie ${i + 1}: na płótnie jest makieta (${r.rozne})`);
    if (i < 2) {
      await strona.evaluate(() => document.querySelector('[data-akcja="makieta-zamknij"]').click());
      await strona.waitForSelector('#dlg-makieta', { state: 'hidden' });
    }
  }
  // Utrata i powrót kontekstu.
  await strona.evaluate(async () => {
    const ext = document.querySelector('#makieta-plotno').getContext('webgl').getExtension('WEBGL_lose_context');
    ext.loseContext();
    await new Promise((r) => setTimeout(r, 200));
    ext.restoreContext();
  });
  await strona.waitForTimeout(1500);
  const po = await rysuje();
  assert.equal(po.brak, false);
  assert.ok(po.rozne > 50, `po przywróceniu kontekstu makieta znów widoczna (${po.rozne})`);
  assert.deepEqual(bledy, []);
});
