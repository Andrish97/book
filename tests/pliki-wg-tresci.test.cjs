// #438, A2: pliki podglądu linku według treści, nie według miejsca. Obraz strony ma nazwę od odcisku, opis linku
// mówi, który plik pokazać na której stronie. Przesunięta strona serii nie jest rysowana ani wysyłana drugi raz;
// dawne linki (pliki „<idStrony>.<rozszerzenie>”) działają i są używane dalej; zbędne pliki znikają po zapisie opisu.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = () => import(pathToFileURL(path.join(__dirname, '..', 'js', 'publikacja-magazyn.js')).href);

function magazynWPamieci() {
  const pliki = new Map();
  const opisy = [];
  return {
    pliki, opisy,
    czytajOpis: async (folder) => { const b = pliki.get(`${folder}/manifest.json`); return b ? JSON.parse(await b.text()) : null; },
    wyslij: async (klucz, blob) => { pliki.set(klucz, blob); if (klucz.endsWith('manifest.json')) opisy.push(JSON.parse(await blob.text())); },
    lista: async (folder) => [...pliki.keys()].filter((k) => k.startsWith(`${folder}/`)),
    usun: async (klucze) => { for (const k of klucze) pliki.delete(k); },
  };
}

const strony = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));
const rysuj = (tresc, licznik) => async (s) => { licznik.n += 1; return new Blob([`obraz:${tresc[s.id]}`], { type: 'image/webp' }); };

test('pliki według odcisku: przesunięcie serii, dawne linki, sprzątanie, bez odcisków', async () => {
  const { publikujDoMagazynu } = await modul();
  const mag = magazynWPamieci();
  const F = 'k/pr/kod';
  const opcje = { rozszerzenie: 'webp' };
  // 1) Pierwsza publikacja: 5 stron, 5 plików o nazwach od odcisków.
  let odc = { p1: 'A', p2: 'B', p3: 'C', p4: 'D', p5: 'E' };
  let l = { n: 0 };
  let w = await publikujDoMagazynu(mag, F, {}, strony(5), rysuj(odc, l), () => {}, odc, opcje);
  assert.equal(l.n, 5);
  assert.equal(w.wyslane, 5);
  const m1 = await mag.czytajOpis(F);
  assert.equal(m1.wersja, 2);
  assert.deepEqual(m1.pliki, { p1: 'o-A', p2: 'o-B', p3: 'o-C', p4: 'o-D', p5: 'o-E' });
  assert.ok(mag.pliki.has(`${F}/o-C.webp`));
  // 2) Wiersz wstawiony w serię: druga strona nowa, reszta przesunięta – rysuje się i wysyła tylko jedna.
  odc = { p1: 'A', p2: 'X', p3: 'B', p4: 'C', p5: 'D', p6: 'E' };
  l = { n: 0 };
  w = await publikujDoMagazynu(mag, F, {}, strony(6), rysuj(odc, l), () => {}, odc, opcje);
  assert.equal(l.n, 1, 'narysowana tylko nowa strona');
  assert.equal(w.wyslane, 1);
  const m2 = await mag.czytajOpis(F);
  assert.deepEqual(m2.pliki, { p1: 'o-A', p2: 'o-X', p3: 'o-B', p4: 'o-C', p5: 'o-D', p6: 'o-E' });
  assert.equal(m2.skroty.p6, m1.skroty.p5, 'przesunięta strona ma skrót swojego obrazu');
  assert.equal(m2.przygotowanie, undefined);
  // 3) Usunięcie strony: plik, którego nic nie pokazuje, znika – ale dopiero po zapisie opisu.
  odc = { p1: 'A', p2: 'B', p3: 'C', p4: 'D', p5: 'E' };
  l = { n: 0 };
  await publikujDoMagazynu(mag, F, {}, strony(5), rysuj(odc, l), () => {}, odc, opcje);
  assert.equal(l.n, 0);
  assert.ok(!mag.pliki.has(`${F}/o-X.webp`));
  assert.deepEqual([...mag.pliki.keys()].filter((k) => k.startsWith(F)).sort(), ['manifest.json', 'o-A.webp', 'o-B.webp', 'o-C.webp', 'o-D.webp', 'o-E.webp'].map((x) => `${F}/${x}`));
  // 4) Dawny link: pliki „p1.webp…”, opis bez „pliki”. Pasujące strony korzystają z dawnych plików (także przesunięte).
  const G = 'k/pr/dawny';
  const dawne = { p1: 'A', p2: 'B', p3: 'C' };
  for (const id of Object.keys(dawne)) mag.pliki.set(`${G}/${id}.webp`, new Blob([`obraz:${dawne[id]}`]));
  mag.pliki.set(`${G}/manifest.json`, new Blob([JSON.stringify({ format: 'seriodruk-podglad', wersja: 1, rozszerzenie: 'webp', skroty: { p1: 's1', p2: 's2', p3: 's3' }, tresci: dawne })]));
  odc = { p1: 'Z', p2: 'A', p3: 'B', p4: 'C' };
  l = { n: 0 };
  await publikujDoMagazynu(mag, G, {}, strony(4), rysuj(odc, l), () => {}, odc, opcje);
  assert.equal(l.n, 1);
  const m4 = await mag.czytajOpis(G);
  assert.deepEqual(m4.pliki, { p1: 'o-Z', p2: 'p1', p3: 'p2', p4: 'p3' });
  assert.deepEqual(m4.skroty, { p1: m4.skroty.p1, p2: 's1', p3: 's2', p4: 's3' });
  // 5) Opis w trakcie: strony nieprzerobione pokazują poprzednie pliki (link działa przez całą publikację).
  const pierwszy = mag.opisy.filter((m) => m.pliki?.p2 === 'p1' || m.pliki?.p1 === 'p1').at(0);
  assert.ok(pierwszy, 'opis od razu wskazuje dawne pliki');
  // 6) Bez odcisków: nazwa ze skrótu obrazu, te same obrazy – jeden plik.
  const H = 'k/pr/bez';
  l = { n: 0 };
  await publikujDoMagazynu(mag, H, {}, strony(3), rysuj({ p1: 'Q', p2: 'Q', p3: 'R' }, l), () => {}, null, opcje);
  const m6 = await mag.czytajOpis(H);
  assert.equal(l.n, 3);
  assert.equal(m6.pliki.p1, m6.pliki.p2);
  assert.match(m6.pliki.p3, /^p-[0-9a-f]{32}$/);
  assert.equal([...mag.pliki.keys()].filter((k) => k.startsWith(`${H}/`) && k.endsWith('.webp')).length, 2);
});

