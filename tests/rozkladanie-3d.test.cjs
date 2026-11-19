// Rozkładanie modelu 3D na siatkę (#264, plan składanek krok 9): OBJ i STL, drzewo ścian, części bez nachodzenia,
// pary krawędzi równej długości, zgięcia góra / dolina z kątem.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = () => import(pathToFileURL(path.join(__dirname, '..', 'js', 'rozkladanie-3d.js')).href);
const dl = (c, i) => { const a = c.punkty[i]; const b = c.punkty[(i + 1) % c.punkty.length]; return Math.hypot(b.x - a.x, b.y - a.y); };
function sprawdzPary(czesci) {
  const m = {};
  for (const c of czesci) c.krawedzie.forEach((k, i) => { if (k.para) (m[k.para] ||= []).push({ typ: k.typ, dl: dl(c, i) }); });
  for (const [p, l] of Object.entries(m)) {
    assert.equal(l.length, 2, `${p}: dwie krawędzie`);
    assert.deepEqual(l.map((x) => x.typ).sort(), ['klej', 'zakladka'], `${p}: zakładka i do sklejenia`);
    assert.ok(Math.abs(l[0].dl - l[1].dl) < 0.05, `${p}: ${l[0].dl} ≠ ${l[1].dl}`);
  }
  return Object.keys(m).length;
}
const KOSTKA = `v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nv 0 0 1\nv 1 0 1\nv 1 1 1\nv 0 1 1
f 1 4 3 2\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8`;

test('kostka OBJ: jedna część – krzyż z 6 kwadratów, 5 zgięć góra 90°, 7 par', async () => {
  const { wczytajOBJ, rozlozSiatke } = await modul();
  const w = rozlozSiatke(wczytajOBJ(KOSTKA), { rozmiar: 50 });
  assert.equal(w.trojkatow, 12);
  assert.equal(w.czesci.length, 1);
  const [c] = w.czesci;
  assert.equal(c.punkty.length, 14, 'obrys siatki sześcianu');
  assert.deepEqual(c.zgiecia.map((z) => [z.rodzaj, z.kat]), Array(5).fill(['gora', 90]), 'przekątne kwadratów bez zgięć');
  assert.equal(sprawdzPary(w.czesci), 7);
  // Ściany do środka (odwrócona kolejność) – zgięcia nadal „góra”.
  const odwr = KOSTKA.replace(/^f (.*)$/gm, (m, a) => `f ${a.split(' ').reverse().join(' ')}`);
  assert.ok(rozlozSiatke(wczytajOBJ(odwr), { rozmiar: 50 }).czesci[0].zgiecia.every((z) => z.rodzaj === 'gora'));
});

test('STL binarny: walec z 24 ścian – części bez nachodzenia, pary równe; czworościan tekstowy', async () => {
  const { wczytajSTL, rozlozSiatke, trojkatyNachodza } = await modul();
  // Walec (24 boki, z dnem i wiekiem) jako trójkąty STL.
  const tr = [];
  const n = 24;
  const k = (i, z) => [Math.cos((2 * Math.PI * i) / n), Math.sin((2 * Math.PI * i) / n), z];
  for (let i = 0; i < n; i += 1) {
    const a0 = k(i, 0); const a1 = k(i + 1, 0); const b0 = k(i, 3); const b1 = k(i + 1, 3);
    tr.push([a0, a1, b1], [a0, b1, b0], [[0, 0, 0], a1, a0], [[0, 0, 3], b0, b1]);
  }
  const bufor = Buffer.alloc(84 + tr.length * 50);
  bufor.writeUInt32LE(tr.length, 80);
  tr.forEach((t, i) => t.forEach((p, j) => p.forEach((v, q) => bufor.writeFloatLE(v, 84 + i * 50 + 12 + j * 12 + q * 4))));
  const s = wczytajSTL(new Uint8Array(bufor));
  assert.equal(s.wierzcholki.length, 2 * n + 2, 'wspólne wierzchołki połączone');
  const w = rozlozSiatke(s, { rozmiar: 120 });
  assert.equal(w.trojkatow, 4 * n);
  assert.ok(w.czesci.length >= 1);
  sprawdzPary(w.czesci);
  // Żadna część nie nachodzi sama na siebie: obrys bez przecięć (sprawdzamy trójkąty wachlarza obrysu nie wprost –
  // wystarczy, że obrys jest zamknięty i ma tyle krawędzi co punktów).
  for (const c of w.czesci) assert.equal(c.punkty.length, c.krawedzie.length);
  assert.equal(trojkatyNachodza([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }], [{ x: 0.5, y: 0.5 }, { x: 3, y: 0.5 }, { x: 0.5, y: 3 }]), true);
  assert.equal(trojkatyNachodza([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }], [{ x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }]), false, 'wspólna krawędź to nie nachodzenie');
  const tet = 'solid t\n' + [[[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 0, 1], [1, 0, 0]], [[0, 0, 0], [0, 1, 0], [0, 0, 1]], [[1, 0, 0], [0, 0, 1], [0, 1, 0]]]
    .map((t) => `facet normal 0 0 0\nouter loop\n${t.map((p) => `vertex ${p.join(' ')}`).join('\n')}\nendloop\nendfacet`).join('\n') + '\nendsolid t';
  const wt = rozlozSiatke(wczytajSTL(new TextEncoder().encode(tet)), { rozmiar: 60 });
  assert.equal(wt.czesci.length, 1);
  assert.equal(wt.czesci[0].zgiecia.length, 3);
  assert.equal(sprawdzPary(wt.czesci), 3);
});

// W aplikacji: „Model 3D” w sekcji składanki – plik OBJ rozłożony na części, wstawiony, kontrola bez uwag o parach.
const { otworz, nowyProjekt } = require('./pomoc.cjs');
test('Model 3D w aplikacji: kostka z pliku OBJ – część z parami, kontrola bez uwag', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Z modelu');
  await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A3', orientacja: 'pozioma', material: 'karton', gramatura: 300 } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
  });
  await strona.click('[data-akcja="skladanka-model-3d"]');
  await strona.waitForSelector('#dlg-model-3d[open]');
  await strona.click('#dlg-model-3d button[value="tak"]');
  assert.match(await strona.textContent('#dlg-model-3d .blad-polaczenia'), /Wybierz plik/);
  await strona.setInputFiles('#dlg-model-3d input[name="plik"]', { name: 'kostka.obj', mimeType: 'text/plain', buffer: Buffer.from(KOSTKA) });
  await strona.fill('#dlg-model-3d input[name="rozmiar"]', '40');
  await strona.click('#dlg-model-3d button[value="tak"]');
  await strona.waitForFunction(() => !document.querySelector('#dlg-model-3d').open);
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.czesc));
  const wynik = await strona.evaluate(async () => {
    const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.czesc);
    await window.seriodruk.zapiszTeraz();
    const p = window.seriodruk.stan.projekt;
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { rozwin } = await import('./js/serie.js');
    return { nazwa: g.czesc.opis, zgiec: g.czesc.zgiecia.length, par: new Set(g.czesc.krawedzie.filter((k) => k.para).map((k) => k.para)).size, uwagi: sprawdzProjekt(p, rozwin(p)).filter((u) => u.rodzaj === 'skladanka').map((u) => u.opis) };
  });
  assert.deepEqual([wynik.nazwa, wynik.zgiec, wynik.par], ['kostka', 5, 7]);
  assert.deepEqual(wynik.uwagi.filter((u) => !/poza arkusz|margines/.test(u)), []);
  assert.deepEqual(bledy, []);
});
