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
  // Grzbiet to cienka skorupa (#161): z zewnątrz okładka (okl:grzbiet), od środka papier/tektura.
  assert.ok(grzbiet.length && grzbiet.some((x) => x.tex === 'okl:grzbiet'));
  assert.ok(grzbiet.every((x) => x.p.every((p) => p[0] <= 0.05)), 'grzbiet na zewnątrz (poza zawiasami)');
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
  // Kartkowanie przyciskiem i klawiszem. Twarda oprawa bez wyklejek w projekcie ma czystą wyklejkę (#161).
  await strona.click('#makieta-dalej');
  await strona.waitForFunction(() => document.querySelector('#makieta-polozenie').textContent === 'Wyklejka');
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

// #161 (zrzuty z Androida): format bloku z najczęstszego formatu stron (wyklejka A4 poziomo nie rozciąga
// książki), wyklejki na wnętrzu okładek, twarda oprawa ze skorupą grzbietu (nie bryłą), okładka po otwarciu
// połączona grzbietem z blokiem, napis na grzbiecie nie w lustrze, spirala obejmująca cały blok.
test('makieta 3D (#161): wyklejki, proporcje bloku, grzbiet twardej oprawy, okładka połączona z blokiem, spirala', async () => {
  const { ukladStron, kartkiModelu, scena, obwiednia } = await modul('js/makieta-3d.js');
  const A5 = { w: 148, h: 210 };
  const A4p = { w: 297, h: 210 };
  const u = ukladStron([A4p, ...Array(6).fill(A5), A4p]);
  assert.deepEqual(u.format, A5, 'format bloku – najczęstszy (A5), nie pierwszej strony (wyklejka A4)');
  assert.equal(u.wpisy.length, 10, 'wyklejki A4 – po dwie połowy');
  assert.deepEqual(u.wpisy.slice(0, 2).map((x) => [x.zrodlo, x.polowa, x.w]), [[0, 'L', 148.5], [0, 'R', 148.5]]);
  assert.deepEqual(u.wpisy.slice(-2).map((x) => [x.zrodlo, x.polowa]), [[7, 'L'], [7, 'R']]);
  const okl = { w: 151, h: 216, tektura: 2.5 };
  const k = kartkiModelu('ksiazka_twarda', { strony: 10, format: u.format, okladka: okl, wnetrze: { przod: true, tyl: true }, rozmiary: u.wpisy });
  assert.equal(k[0].tyl, 'p:0', 'lewa połowa przedniej wyklejki na wnętrzu przedniej okładki');
  assert.equal(k.at(-1).przod, 'p:9', 'prawa połowa tylnej wyklejki na wnętrzu tylnej okładki');
  const srodek = k.filter((x) => !x.okladka);
  assert.ok(srodek.every((x) => x.w === 148 && x.h === 210), 'blok A5');
  assert.ok(k[0].w - 148 <= 4 && k[0].h - 210 <= 7, `okładka tylko nieco większa od bloku (${k[0].w} × ${k[0].h})`);
  // Napis na grzbiecie nie w lustrze: ta sama skrętność układu tekstury co na przodzie okładki.
  const skretnosc = (q) => {
    const [p0, p1, , p3] = q.p;
    const [t0, t1, , t3] = q.uv;
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
    const a = [t1[0] - t0[0], t1[1] - t0[1]];
    const b = [t3[0] - t0[0], t3[1] - t0[1]];
    const det = a[0] * b[1] - b[0] * a[1];
    if (Math.abs(det) < 1e-12) return 0;
    const T = e1.map((v, i) => (v * b[1] - e2[i] * a[1]) / det);
    const B = e2.map((v, i) => (v * a[0] - e1[i] * b[0]) / det);
    const c = [T[1] * B[2] - T[2] * B[1], T[2] * B[0] - T[0] * B[2], T[0] * B[1] - T[1] * B[0]];
    return Math.sign(c[0] * q.n[0] + c[1] * q.n[1] + c[2] * q.n[2]);
  };
  let q = scena('ksiazka_twarda', kartkiModelu('ksiazka_twarda', { strony: 200, format: A5, okladka: okl }), 0);
  const przodZ = q.filter((x) => x.tex === 'okl:przod' && x.n[1] > 0.9).map(skretnosc).filter(Boolean);
  const grzbietZ = q.filter((x) => x.grzbiet && x.tex === 'okl:grzbiet' && x.n[0] < -0.5).map(skretnosc).filter(Boolean);
  assert.ok(przodZ.length && grzbietZ.length);
  assert.ok(grzbietZ.every((s) => s === przodZ[0]), 'grzbiet bez lustrzanego odbicia');
  // Skorupa grzbietu: cienka, wypukła na zewnątrz, z przerwą do zaokrąglonego grzbietu bloku (składki widać).
  const sk = obwiednia(q.filter((x) => x.grzbiet));
  assert.ok(sk.min[0] < -1, 'grzbiet wypukły na zewnątrz');
  assert.ok(q.some((x) => x.tex === 'tex:skladki'), 'zaokrąglony grzbiet bloku ze składkami');
  assert.ok(q.some((x) => x.tex === 'tex:kapitalka'), 'kapitałka');
  // Strona 1: okładka leży obok, grzbiet łączy ją z blokiem (bez przerwy).
  q = scena('ksiazka_twarda', k, 1);
  const okladkaL = obwiednia(q.filter((x) => x.tex === 'okl:przod'));
  const grz = obwiednia(q.filter((x) => x.grzbiet));
  assert.ok(okladkaL.max[0] < 0.5, 'otwarta okładka po lewej');
  assert.ok(grz.min[0] <= okladkaL.max[0] + 0.5 && grz.max[0] >= -0.5, `grzbiet łączy okładkę (${okladkaL.max[0].toFixed(1)}) z blokiem (0): ${grz.min[0].toFixed(1)}..${grz.max[0].toFixed(1)}`);
  assert.ok(q.some((x) => x.tex === 'p:0'), 'wyklejka na wnętrzu otwartej okładki');
  // Spirala: pętle obejmują cały blok (średnica ≈ grubość + 3–4 mm), notes leży na drucie.
  for (const strony of [20, 400]) {
    const kn = kartkiModelu('notes', { strony, format: A5 });
    const Tn = kn.reduce((a, x) => a + x.d, 0);
    const qn = scena('notes', kn, 0);
    const drut = obwiednia(qn.filter((x) => x.mat === 'drut'));
    const blokN = obwiednia(qn.filter((x) => x.mat !== 'drut'));
    assert.ok(drut.min[1] > -0.05 && drut.min[1] < 0.2, `notes ${strony} s.: drut na stole (${drut.min[1].toFixed(2)})`);
    assert.ok(drut.max[1] > blokN.max[1] + 1 && drut.min[1] < blokN.min[1] - 1, `notes ${strony} s.: pętle obejmują blok`);
    const sr = drut.max[1] - drut.min[1];
    assert.ok(sr >= Tn + 3 && sr <= Math.max(Tn + 7, 9.5), `notes ${strony} s.: średnica pętli ${sr.toFixed(1)} przy grubości ${Tn.toFixed(1)}`);
  }
});

test('makieta 3D (#161): telefon – płótno w proporcjach widoku, okładka A5 pionowa z góry, kadr mieści całość', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Makieta');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const O = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    const srodek = p.sekcje[0];
    for (let i = 1; i < 30; i += 1) p.strony.push(P.nowaStrona(`S${i + 1}`, srodek.id));
    // Wyklejka A4 poziomo przed środkiem – jak w projekcie użytkownika.
    const wy = P.nowaSekcja('Wyklejka');
    wy.typ = 'wyklejka_przednia'; // rola sekcji tylko z jawnego typu (#177)
    wy.wydruk.szerokosc_mm = 297;
    wy.wydruk.wysokosc_mm = 210;
    p.sekcje.splice(0, 0, wy);
    p.strony.unshift(P.nowaStrona('Wyklejka', wy.id));
    const wt = P.nowaSekcja('Wyklejka tylna');
    wt.typ = 'wyklejka_tylna';
    wt.wydruk.szerokosc_mm = 297;
    wt.wydruk.wysokosc_mm = 210;
    p.sekcje.push(wt);
    p.strony.push(P.nowaStrona('Wyklejka tylna', wt.id));
    const ok = P.nowaSekcja('Okładka');
    ok.okladka = { oprawa: 'twarda' };
    p.sekcje.unshift(ok);
    const so = P.nowaStrona('Okładka', ok.id);
    so.tlo = '#0b1d6b';
    p.strony.unshift(so);
    O.przeliczOkladki(p);
  });
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForSelector('.podglad-strona[data-id]');
  await strona.click('[data-akcja="podglad-makieta"]');
  await strona.waitForFunction(() => document.querySelector('#dlg-makieta')?.open, null, { timeout: 60000 });
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 60000 });
  await strona.waitForTimeout(800);
  // Wyklejki (sekcje typu wyklejka_przednia / wyklejka_tylna, arkusze A4 przy bloku A5): nie są kartkami bloku – lewa połowa przedniej na
  // wnętrzu okładki, prawa – luźna kartka przed stroną 1; tylna odwrotnie. Wszystkie kartki w formacie bloku.
  const uklad = await strona.evaluate(async () => {
    const W = await import('./js/app/makieta-okno.js');
    const k = W.kartkiMakiety();
    const opis = async (u) => { W.ustawPolozenieMakiety(u, { natychmiast: true }); await new Promise((r) => setTimeout(r, 300)); return document.querySelector('#makieta-polozenie').textContent; };
    return {
      kartki: k.filter((x) => !x.okladka).map((x) => [x.w, x.h]),
      wnetrzeP: k[0].tyl, luznaP: k[1].przod, wnetrzeT: k.at(-1).przod,
      opisy: [await opis(1), await opis(2), await opis(k.length - 1)],
    };
  });
  assert.ok(uklad.kartki.every(([w, h]) => w === 148 && h === 210), 'kartki w formacie bloku (A5)');
  assert.ok(uklad.wnetrzeP && uklad.luznaP && uklad.wnetrzeT, 'wyklejki na wnętrzu okładek i jako luźne kartki');
  assert.deepEqual(uklad.opisy.slice(0, 2), ['Wyklejka', 'Strona 1'], 'po okładce wyklejka, potem strona 1');
  await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).ustawPolozenieMakiety(0, { natychmiast: true }));
  await strona.waitForTimeout(500);
  // Bufor płótna w proporcjach elementu (bez rozciągania przez CSS), gęstość ekranu telefonu.
  const pl = await strona.evaluate(() => { const c = document.querySelector('#makieta-plotno'); return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, dpr: devicePixelRatio }; });
  assert.ok(Math.abs(pl.w / pl.h - pl.cw / pl.ch) < 0.01, `proporcje bufora ${pl.w}×${pl.h} i widoku ${pl.cw}×${pl.ch}`);
  assert.ok(pl.w >= pl.cw * Math.min(2.5, pl.dpr) - 2, `pełna gęstość ekranu (${pl.w} px przy ${pl.cw} px × ${pl.dpr})`);
  // Kadr: wszystkie rogi obwiedni sceny w polu widzenia (kamera jak w oknie).
  const kadr = () => strona.evaluate(async () => {
    const M = await import('./js/makieta-3d.js');
    const W = await import('./js/app/makieta-okno.js');
    const s = W.stanMakiety();
    const ob = M.obwiednia(M.scena(s.model, W.kartkiMakiety(), s.cel));
    const c = document.querySelector('#makieta-plotno');
    const asp = c.width / c.height;
    const t = Math.tan((28 * Math.PI) / 360);
    const k = s.kamera;
    let max = 0;
    for (const x of [ob.min[0], ob.max[0]]) for (const y of [ob.min[1], ob.max[1]]) for (const z of [ob.min[2], ob.max[2]]) {
      const [dx, dy, dz] = [x - k.srodek[0], y - k.srodek[1], z - k.srodek[2]];
      const x1 = dx * Math.cos(k.obrotY) + dz * Math.sin(k.obrotY);
      const z1 = -dx * Math.sin(k.obrotY) + dz * Math.cos(k.obrotY);
      const y2 = dy * Math.cos(k.obrotX) - z1 * Math.sin(k.obrotX);
      const z2 = dy * Math.sin(k.obrotX) + z1 * Math.cos(k.obrotX);
      const glebia = k.odleglosc - z2;
      max = Math.max(max, Math.abs(x1 / (glebia * t * asp)), Math.abs(y2 / (glebia * t)));
    }
    return max;
  });
  for (const u of [0, 1, 8]) {
    await strona.evaluate(async (u) => (await import('./js/app/makieta-okno.js')).ustawPolozenieMakiety(u, { natychmiast: true }), u);
    await strona.waitForTimeout(500);
    await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 60000 });
    const m = await kadr();
    assert.ok(m <= 1, `położenie ${u}: całość w kadrze (${m.toFixed(2)})`);
  }
  // Z góry: zamknięta książka A5 jest pionowa (okładka ~151 × 216 mm), nie rozciągnięta w poziomie.
  await strona.evaluate(async () => { const W = await import('./js/app/makieta-okno.js'); W.ustawPolozenieMakiety(0); W.ustawKamereMakiety({ obrotX: 1.5, obrotY: 0, zoom: 1 }); });
  await strona.waitForTimeout(3000);
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 60000 });
  const r = await strona.evaluate(() => {
    const c = document.querySelector('#makieta-plotno');
    const x = document.createElement('canvas');
    x.width = c.width;
    x.height = c.height;
    const g = x.getContext('2d');
    g.drawImage(c, 0, 0);
    const d = g.getImageData(0, 0, x.width, x.height).data;
    let x0 = Infinity; let x1 = -1; let y0 = Infinity; let y1 = -1;
    for (let y = 0; y < x.height; y += 2) for (let xx = 0; xx < x.width; xx += 2) {
      const i = (y * x.width + xx) * 4;
      if (d[i + 2] > d[i] + 40 && d[i + 2] > 60) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    return { w: x1 - x0, h: y1 - y0 };
  });
  const prop = r.h / r.w;
  assert.ok(prop > 1.3 && prop < 1.6, `okładka z góry pionowa jak A5 (wys./szer. ${prop.toFixed(2)}, ${r.w}×${r.h} px)`);
  assert.deepEqual(bledy, []);
});
