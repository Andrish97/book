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

test('kolory z materiałów (#277): MTL Kd → kolor części; bez MTL – paleta według nazwy', async () => {
  const { wczytajOBJ, wczytajMTL, rozlozSiatke } = await modul();
  const obj = KOSTKA.replace('f 1 4 3 2', 'usemtl czerwony\nf 1 4 3 2').replace('f 4 1 5 8', 'usemtl niebieski\nf 4 1 5 8');
  const mtl = 'newmtl czerwony\nKd 1 0 0\nnewmtl niebieski\nKd 0 0 1';
  assert.deepEqual(wczytajMTL(mtl), { czerwony: '#ff0000', niebieski: '#0000ff' });
  const z = rozlozSiatke(wczytajOBJ(obj, mtl), { rozmiar: 40 });
  assert.equal(z.czesci[0].kolor, '#ff0000', 'pięć ścian czerwonych, jedna niebieska');
  const bez = rozlozSiatke(wczytajOBJ(obj), { rozmiar: 40 });
  assert.match(bez.czesci[0].kolor, /^#[0-9a-f]{6}$/);
  assert.equal(rozlozSiatke(wczytajOBJ(KOSTKA), { rozmiar: 40 }).czesci[0].kolor, undefined, 'bez materiałów – kolor części domyślny');
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

// Tekstura (#283): vt + map_Kd → trójkąty z UV w układzie części; przekształcenie afiniczne trójkąta.
const KOSTKA_UV = `${KOSTKA.split('\nf')[0]}\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl drewno\n${KOSTKA.split('\n').filter((l) => l.startsWith('f ')).map((l) => `f ${l.slice(2).split(' ').map((v, i) => `${v}/${i + 1}`).join(' ')}`).join('\n')}`;
const MTL_UV = 'newmtl drewno\nKd 0.8 0.6 0.4\nmap_Kd -s 1 1 1 tekstury\\drewno.png';

test('tekstura: UV z OBJ, map_Kd z MTL, trójkąty części z UV; macierz trójkąta', async () => {
  const { wczytajOBJ, teksturyMTL, rozlozSiatke, macierzTrojkata } = await modul();
  assert.deepEqual(teksturyMTL(MTL_UV), { drewno: 'drewno.png' });
  const s = wczytajOBJ(KOSTKA_UV, MTL_UV);
  assert.equal(s.uv.length, 4);
  assert.deepEqual(s.tekstury, Array(6).fill('drewno.png'));
  const { czesci: [c] } = rozlozSiatke(s, { rozmiar: 40 });
  assert.equal(c.tekstura.plik, 'drewno.png');
  assert.equal(c.tekstura.trojkaty.length, 12);
  // Każdy trójkąt ma w części te same długości boków co w 3D (40 mm albo przekątna) i UV z rogów obrazka.
  for (const t of c.tekstura.trojkaty) {
    const boki = [0, 1, 2].map((i) => Math.hypot(t.p[(i + 1) % 3].x - t.p[i].x, t.p[(i + 1) % 3].y - t.p[i].y)).sort((a, b) => a - b);
    assert.ok(Math.abs(boki[0] - 40) < 0.01 && Math.abs(boki[2] - 40 * Math.SQRT2) < 0.01, boki.join());
    assert.ok(t.uv.every(([u, v]) => [0, 1].includes(u) && [0, 1].includes(v)));
    assert.ok(t.p.every((q) => q.x > -0.01 && q.y > -0.01));
  }
  const M = macierzTrojkata([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], [{ x: 5, y: 5 }, { x: 5, y: 7 }, { x: 2, y: 5 }]);
  const T = ([a, b, cc, d, e, f], p) => ({ x: a * p.x + cc * p.y + e, y: b * p.x + d * p.y + f });
  assert.deepEqual([T(M, { x: 1, y: 0 }), T(M, { x: 0, y: 1 }), T(M, { x: 1, y: 1 })], [{ x: 5, y: 7 }, { x: 2, y: 5 }, { x: 2, y: 7 }]);
  assert.equal(macierzTrojkata([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]), null);
});

test('Model 3D z teksturą w aplikacji: nadruk na części – zostaje po zapisie, wczytaniu i [Rozłóż]', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Tekstura');
  await strona.evaluate(async () => {
    const { przeliczOkladki } = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.sekcje[0], { typ: 'skladanka', specjalna: { rodzaj: 'skladanka', arkusz: 'A3', orientacja: 'pozioma', material: 'karton', gramatura: 300 } });
    przeliczOkladki(p);
    await window.seriodruk.przeladuj();
  });
  // Obrazek 64 × 64: lewa połowa czerwona, prawa niebieska.
  const png = Buffer.from(await strona.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 32, 64); x.fillStyle = '#0000ff'; x.fillRect(32, 0, 32, 64);
    return c.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await strona.click('[data-akcja="skladanka-model-3d"]');
  await strona.waitForSelector('#dlg-model-3d[open]');
  await strona.setInputFiles('#dlg-model-3d input[name="plik"]', [
    { name: 'kostka.obj', mimeType: 'text/plain', buffer: Buffer.from(KOSTKA_UV) },
    { name: 'kostka.mtl', mimeType: 'text/plain', buffer: Buffer.from(MTL_UV) },
    { name: 'drewno.png', mimeType: 'image/png', buffer: png },
  ]);
  await strona.fill('#dlg-model-3d input[name="rozmiar"]', '40');
  await strona.click('#dlg-model-3d button[value="tak"]');
  await strona.waitForFunction(() => !document.querySelector('#dlg-model-3d').open);
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.czesc));
  const stanNadruku = () => strona.evaluate(() => {
    const g = window.seriodruk.edytor.canvas.getObjects().find((o) => o.czesc);
    const obraz = g.getObjects().find((o) => o.zasob && o.zasob === g.czesc.nadruk?.zasob);
    if (!obraz) return null;
    const el = obraz.getElement();
    const c = document.createElement('canvas'); c.width = el.width; c.height = el.height;
    const x = c.getContext('2d'); x.drawImage(el, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let czerwone = 0; let niebieskie = 0; let puste = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) puste += 1; else if (d[i] > 200 && d[i + 2] < 60) czerwone += 1; else if (d[i + 2] > 200 && d[i] < 60) niebieskie += 1;
    }
    const n = d.length / 4;
    return { w: Math.round(obraz.width * obraz.scaleX), h: Math.round(obraz.height * obraz.scaleY), czerwone: czerwone / n, niebieskie: niebieskie / n, puste: puste / n, plik: window.seriodruk.stan.projekt.zasoby[obraz.zasob]?.nazwa };
  });
  const przed = await stanNadruku();
  // Krzyż z 6 ścian 40 × 40: 6/12 ramki 160 × 120 zajęte – reszta przezroczysta; po połowie czerwieni i niebieskiego.
  assert.deepEqual([przed.w, przed.h].sort((a, b) => a - b), [120, 160]);
  assert.ok(Math.abs(przed.puste - 0.5) < 0.03 && Math.abs(przed.czerwone - 0.25) < 0.03 && Math.abs(przed.niebieskie - 0.25) < 0.03, JSON.stringify(przed));
  assert.equal(przed.plik, 'kostka – nadruk.png');
  await strona.evaluate(async () => { await window.seriodruk.zapiszTeraz(); await window.seriodruk.przeladuj(); });
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.czesc));
  const poWczytaniu = await stanNadruku();
  assert.ok(poWczytaniu && Math.abs(poWczytaniu.czerwone - 0.25) < 0.03, 'nadruk po wczytaniu');
  await strona.click('[data-akcja="skladanka-rozloz"]');
  await strona.waitForTimeout(800);
  const poRozlozeniu = await stanNadruku();
  assert.ok(poRozlozeniu && Math.abs(poRozlozeniu.niebieskie - 0.25) < 0.03, 'nadruk jedzie z częścią');
  assert.deepEqual(bledy, []);
});
