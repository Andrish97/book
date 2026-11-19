// Linie klejenia (#285, plan składanek krok 16): klejenie nie tylko przy krawędzi – linia pomocnicza w dowolnym
// miejscu ściany (prosta, łamana, krzywa, otwarta albo zamknięta) z numerem pary; krawędź innej części przykleja się
// wzdłuż niej. Kontrola długości, instrukcja montażu (prosta – stanie pod kątem, krzywa – zawinie się).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const modul = () => import(pathToFileURL(path.join(__dirname, '..', 'js', 'skladanka.js')).href);
const prost = (w, h) => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];

test('linie klejenia: długość, prosta/krzywa, kontrola par, instrukcja, Rozetnij i Scal', async () => {
  globalThis.fabric = globalThis.fabric || {};
  const K = await modul();
  const S = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'skladanka-szablony.js')).href);
  const luk = K.punktyLuku({ x: 20, y: 40 }, { x: 50, y: 25 }, { x: 80, y: 40 }, 30);
  const baza = K.normalizujCzesc({
    nr: 'A', punkty: prost(100, 60), krawedzie: Array(4).fill({ typ: 'ciecie' }), zgiecia: [],
    linie: [{ punkty: [{ x: 30, y: 15 }, { x: 70, y: 15 }], para: '1' }, { punkty: luk, para: '2' }, { punkty: [{ x: 1, y: 1 }] }],
  });
  assert.equal(baza.linie.length, 2, 'linia z jednym punktem odrzucona');
  assert.equal(K.dlugoscLinii(baza.linie[0]), 40);
  assert.equal(K.liniaProsta(baza.linie[0]), true);
  assert.equal(K.liniaProsta(baza.linie[1]), false);
  const dlLuku = K.dlugoscLinii(baza.linie[1]);
  assert.ok(dlLuku > 60 && dlLuku < 70, `łuk ${dlLuku}`);
  assert.ok(K.odlegloscOdLinii(baza.linie[0], { x: 50, y: 16 }) - 1 < 1e-9);
  // Klapka 40 mm na prostej linii (para 1) i pasek o długości łuku na krzywej (para 2).
  const klapka = K.normalizujCzesc({ nr: 'B', punkty: prost(40, 20), krawedzie: [{ typ: 'ciecie' }, { typ: 'ciecie' }, { typ: 'zakladka', para: '1', szer: 6 }, { typ: 'ciecie' }], zgiecia: [] });
  const pasek = K.normalizujCzesc({ nr: 'C', punkty: prost(dlLuku, 15), krawedzie: [{ typ: 'ciecie' }, { typ: 'ciecie' }, { typ: 'zakladka', para: '2', szer: 6 }, { typ: 'ciecie' }], zgiecia: [] });
  const grupa = (c, id) => ({ id, type: 'group', czesc: c, left: 0, top: 0, width: 100, height: 60 });
  const arkusz = (obiekty) => [{ nr: 1, strona: { id: 's1', obiekty }, w: 1000, h: 1000, margines: 0, grubosc: 0.4 }];
  const uwagi = (obiekty) => K.uwagiSkladanki(arkusz(obiekty)).map((u) => u.opis).filter((u) => !/nachodzą/.test(u));
  assert.deepEqual(uwagi([grupa(baza, 'a'), grupa(klapka, 'b'), grupa(pasek, 'c')]), []);
  const krotki = K.normalizujCzesc({ ...klapka, punkty: prost(30, 20) });
  assert.match(uwagi([grupa(baza, 'a'), grupa(krotki, 'b'), grupa(pasek, 'c')]).join(), /Para 1: krawędź ma 30 mm, a linia klejenia 40 mm – kawałek linii zostanie bez kleju/);
  // Instrukcja montażu: prosta – stanie pod kątem, krzywa – wygnie się.
  const ins = K.instrukcjaMontazu([{ id: 's1', obiekty: [grupa(baza, 'a'), grupa(klapka, 'b'), grupa(pasek, 'c')] }]).kroki.join('\n');
  assert.match(ins, /1\. Posmaruj klejem zakładkę 1 \(część B\) i przyklej wzdłuż linii 1 na części A – doklejona część stanie pod kątem/);
  assert.match(ins, /2\. Posmaruj klejem zakładkę 2 \(część C\) i przyklej wzdłuż krzywej linii 2 na części A.*wygnie się/);
  // Pary w sekcji i kształty do podświetlenia.
  assert.deepEqual(K.paryWSekcji([{ id: 's1', obiekty: [grupa(baza, 'a')] }]).get('2').map((w) => w.opis), ['krzywa linia klejenia']);
  assert.equal(K.ksztaltyPar(baza).filter((k) => !k.zamkniety).length, 2);
  // Numerowanie szablonów przenosi pary linii; Rozetnij – linia trafia do kawałka, na którym leży.
  assert.deepEqual(S.numeruj([baza], (() => { let n = 10; return () => String((n += 1)); })())[0].linie.map((l) => l.para), ['11', '12']);
  const kawalki = K.rozetnijCzesc(baza, { x: 0, y: 50 }, { x: 100, y: 50 }, '9');
  const gora = kawalki.find((x) => Math.max(...x.punkty.map((q) => q.y)) <= 50.01);
  const dol = kawalki.find((x) => x !== gora);
  assert.deepEqual([gora.linie.map((l) => l.para), dol.linie.length], [['1', '2'], 0]);
  // Scal: linia doklejanej części przesuwa się razem z nią (kwadrat 40 × 40 z linią w x = 20 dokładany z prawej).
  const kw = (kr, linie = []) => K.normalizujCzesc({ nr: 'X', punkty: prost(40, 40), krawedzie: kr, zgiecia: [], linie });
  const c1 = kw([{ typ: 'ciecie' }, { typ: 'zakladka', para: '5', szer: 7 }, { typ: 'ciecie' }, { typ: 'ciecie' }]);
  const c2 = kw([{ typ: 'ciecie' }, { typ: 'ciecie' }, { typ: 'ciecie' }, { typ: 'klej', para: '5' }], [{ punkty: [{ x: 20, y: 5 }, { x: 20, y: 35 }], para: '7' }]);
  const sc = K.scalCzesci(c1, 1, c2, 3);
  assert.deepEqual(sc.linie.map((l) => l.punkty.map((q) => [q.x, q.y])), [[[60, 5], [60, 35]]]);
});

test('Linia klejenia w aplikacji: dwa kliknięcia, krzywa z pióra, Połącz – para bez uwag', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Linie klejenia');
  await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A4', orientacja: 'pozioma', material: 'karton', gramatura: 300, druk: 'domowy' } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
    const n = await import('./js/app/skladanka-narzedzia.js');
    const pr = (w, h) => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
    n.wstawCzesci([
      { nazwa: 'Podstawa', punkty: pr(100, 60), krawedzie: Array(4).fill({ typ: 'ciecie' }), zgiecia: [] },
      { nazwa: 'Klapka', punkty: pr(40, 20), krawedzie: Array(4).fill({ typ: 'ciecie' }), zgiecia: [] },
    ]);
  });
  // Punkt części (nr, x, y w mm części) → piksel ekranu.
  const kliknij = async (nr, x, y) => {
    const p = await strona.evaluate(async ([cz, mx, my]) => {
      const S = await import('./js/skladanka.js');
      const e = window.seriodruk.edytor;
      const g = e.canvas.getObjects().find((o) => o.czesc?.nr === cz);
      const q = S.zUkladuCzesci(g, { x: mx, y: my });
      const v = e.canvas.viewportTransform;
      const r = e.canvas.upperCanvasEl.getBoundingClientRect();
      return { x: r.left + q.x * v[0] + v[4], y: r.top + q.y * v[3] + v[5] };
    }, [nr, x, y]);
    await strona.mouse.click(p.x, p.y);
  };
  // Prosta linia klejenia w środku ściany – dwa kliknięcia (nie przy krawędziach).
  await strona.click('[data-akcja="skladanka-linia"]');
  await kliknij('A', 30, 15);
  await kliknij('A', 70, 15);
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.czesc?.nr === 'A').czesc.linie?.length === 1);
  await strona.keyboard.press('Escape');
  await strona.evaluate(async () => { (await import('./js/app/skladanka-narzedzia.js')).ustawNarzedzie(null); });
  // Krzywa z pióra (otwarta ścieżka) narysowana na części → zaznaczona → [Linia klejenia].
  await strona.evaluate(async () => {
    const S = await import('./js/skladanka.js');
    const e = window.seriodruk.edytor;
    const g = e.canvas.getObjects().find((o) => o.czesc?.nr === 'A');
    const a = S.zUkladuCzesci(g, { x: 20, y: 45 });
    const b = S.zUkladuCzesci(g, { x: 80, y: 45 });
    const sciezka = new fabric.Path(`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${a.y - 20} ${b.x} ${b.y}`, { fill: null, stroke: '#000', strokeWidth: 0.3 });
    e.canvas.add(sciezka);
    e.canvas.setActiveObject(sciezka);
  });
  await strona.click('[data-akcja="skladanka-linia"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.czesc?.nr === 'A').czesc.linie?.length === 2);
  // Połącz: dolna krawędź klapki (40 mm) → prosta linia klejenia.
  await strona.click('[data-akcja="skladanka-polacz"]');
  await kliknij('B', 20, 19.8);
  await kliknij('A', 50, 15.5);
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((o) => o.czesc?.nr === 'A').czesc.linie?.[0]?.para);
  const wynik = await strona.evaluate(async () => {
    const e = window.seriodruk.edytor;
    const A = e.canvas.getObjects().find((o) => o.czesc?.nr === 'A');
    const B = e.canvas.getObjects().find((o) => o.czesc?.nr === 'B');
    await window.seriodruk.zapiszTeraz();
    const p = window.seriodruk.stan.projekt;
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { rozwin } = await import('./js/serie.js');
    const S = await import('./js/skladanka.js');
    return {
      linie: A.czesc.linie.map((l) => [l.punkty.length > 2, Math.round(S.dlugoscLinii(l))]),
      para: [A.czesc.linie[0].para, B.czesc.krawedzie.find((k) => k.para)?.typ, B.czesc.krawedzie.find((k) => k.para)?.para],
      rysunek: A.getObjects().filter((o) => o.skladanka === 'linia').length,
      plyty: A.getObjects().filter((o) => o.uszlachetnienie === 'klej' && o.skladanka === 'linia-klej').length,
      uwagi: sprawdzProjekt(p, rozwin(p)).filter((u) => u.rodzaj === 'skladanka').map((u) => u.opis).filter((u) => !/poza arkusz|margines|nachodzą|nie ma pary/.test(u)),
      instrukcja: S.instrukcjaMontazu(p.strony.filter((s) => s.sekcja === p.sekcje[0].id), p.sekcje[0].specjalna).kroki.join('\n'),
    };
  });
  assert.deepEqual(wynik.linie.map((l) => l[0]), [false, true], 'prosta z dwóch punktów, krzywa z wielu');
  assert.equal(wynik.linie[0][1], 40);
  assert.equal(wynik.para[0], wynik.para[2]);
  assert.equal(wynik.para[1], 'zakladka');
  assert.deepEqual([wynik.rysunek, wynik.plyty], [2, 2], 'linie drukowane i na płycie Glue');
  assert.deepEqual(wynik.uwagi, []);
  assert.match(wynik.instrukcja, /przyklej wzdłuż linii \d+ na części A – doklejona część stanie pod kątem/);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'path' && !o.czesc).length), 0, 'krzywa z pióra stała się linią klejenia');
  assert.deepEqual(bledy, []);
});
