// Bryła z rzutu (#263, plan składanek krok 11): graniastosłup i ostrosłup z dowolnego wielokąta – jedna część,
// każda para łączy dwie krawędzie tej samej długości, ściany i zgięcia się zgadzają.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = () => import(pathToFileURL(path.join(__dirname, '..', 'js', 'skladanka-szablony.js')).href);
const dl = (c, i) => { const a = c.punkty[i]; const b = c.punkty[(i + 1) % c.punkty.length]; return Math.hypot(b.x - a.x, b.y - a.y); };
function pary(c) {
  const m = {};
  c.krawedzie.forEach((k, i) => { if (k.para) (m[k.para] ||= []).push({ typ: k.typ, dl: dl(c, i) }); });
  return m;
}

test('bryła z rzutu: graniastosłup i ostrosłup z litery L i trójkąta – pary równej długości', async () => {
  const { brylaZRzutu } = await modul();
  const L = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 15 }, { x: 15, y: 15 }, { x: 15, y: 50 }, { x: 0, y: 50 }];
  const trojkat = [{ x: 0, y: 0 }, { x: 30, y: 40 }, { x: 60, y: 0 }]; // zgodnie z ruchem wskazówek – odwrócony sam
  for (const [ksztalt, nBokow] of [[L, 6], [trojkat, 3]]) {
    for (const rodzaj of ['graniastoslup', 'ostroslup']) {
      const [c] = brylaZRzutu(ksztalt, { rodzaj, wysokosc: 30 });
      assert.equal(c.punkty.length, c.krawedzie.length);
      const m = pary(c);
      const oczekiwane = rodzaj === 'graniastoslup' ? 2 * nBokow - 1 : nBokow;
      assert.equal(Object.keys(m).length, oczekiwane, `${rodzaj}, ${nBokow} boków: liczba par`);
      for (const [p, l] of Object.entries(m)) {
        assert.equal(l.length, 2, `${rodzaj}/${p}: dwie krawędzie`);
        assert.deepEqual(l.map((x) => x.typ).sort(), ['klej', 'zakladka'], `${rodzaj}/${p}: zakładka i do sklejenia`);
        assert.ok(Math.abs(l[0].dl - l[1].dl) < 0.05, `${rodzaj}/${p}: ${l[0].dl} ≠ ${l[1].dl}`);
      }
      assert.equal(c.zgiecia.length, nBokow + (rodzaj === 'graniastoslup' ? 1 : 0), 'zgięcia: boki podstawy (+ wieko)');
      assert.ok(c.punkty.every((q) => q.x >= 0 && q.y >= 0), 'część od (0, 0)');
    }
  }
  // Graniastosłup: ściany boczne mają wysokość 30 (boki sąsiednich ścian = pary s).
  const [g] = brylaZRzutu(L, { wysokosc: 30 });
  const s = Object.entries(pary(g)).filter(([p]) => p.startsWith('s')).map(([, l]) => l[0].dl);
  assert.ok(s.every((v) => Math.abs(v - 30) < 0.05));
});

// W aplikacji: „Bryła z kształtu” w sekcji składanki – kształt zamienia się w jedną część z parami, kontrola bez
// uwag o parach.
const { otworz, nowyProjekt } = require('./pomoc.cjs');
test('Bryła z kształtu: prostokąt → graniastosłup, wielokąt → ostrosłup; pary bez uwag kontroli', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Bryły');
  await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A3', orientacja: 'pozioma', material: 'karton', gramatura: 300 } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
  });
  for (const [rodzaj, wys] of [['graniastoslup', '25'], ['ostroslup', '35']]) {
    await strona.evaluate(() => { const e = window.seriodruk.edytor; e.odznacz(); const r = e.dodajProstokat(); r.set({ left: 150, top: 120, width: 50, height: 30, angle: 0 }); r.setCoords(); e.zaznacz(r.id); });
    await strona.click('[data-akcja="skladanka-bryla"]');
    await strona.waitForSelector('#dlg-bryla-skladanki[open]');
    await strona.selectOption('#dlg-bryla-skladanki select[name="rodzaj"]', rodzaj);
    await strona.fill('#dlg-bryla-skladanki input[name="wysokosc"]', wys);
    await strona.click('#dlg-bryla-skladanki button[value="tak"]');
    await strona.waitForFunction(() => !document.querySelector('#dlg-bryla-skladanki').open);
    await strona.waitForFunction((n) => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.czesc).length === n, rodzaj === 'graniastoslup' ? 1 : 2);
  }
  const wynik = await strona.evaluate(async () => {
    const czesci = window.seriodruk.edytor.canvas.getObjects().filter((o) => o.czesc);
    await window.seriodruk.zapiszTeraz();
    document.querySelector('[data-akcja="skladanka-rozloz"]').click();
    await new Promise((ok) => setTimeout(ok, 800));
    const p = window.seriodruk.stan.projekt;
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { rozwin } = await import('./js/serie.js');
    return {
      czesci: czesci.map((o) => [o.czesc.nr, o.czesc.zgiecia.length, o.czesc.krawedzie.filter((k) => k.para).length]),
      prostokatow: window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'rect' && !o.czesc).length,
      uwagi: sprawdzProjekt(p, rozwin(p)).filter((u) => u.rodzaj === 'skladanka').map((u) => u.opis),
    };
  });
  // Prostopadłościan 50 × 30 × 25: 5 zgięć, 7 par (14 krawędzi); ostrosłup: 4 zgięcia, 4 pary (8 krawędzi).
  assert.deepEqual(wynik.czesci, [['A', 5, 14], ['B', 4, 8]]);
  assert.equal(wynik.prostokatow, 0, 'kształty zamienione w części');
  assert.deepEqual(wynik.uwagi.filter((u) => !/nachodzą|poza arkusz|margines/.test(u)), [], JSON.stringify(wynik.uwagi));
  assert.deepEqual(bledy, []);
});
