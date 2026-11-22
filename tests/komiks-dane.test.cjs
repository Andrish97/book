// Komiks – geometria kadrów (#362) i dialogi z tabeli (#361): siatka z rynną, podział kadru linią (także ukośną),
// kadry na spad, kolejność czytania; dymki z wierszy scenariusza, ponowne wstawienie zmienia tylko tekst.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', 'js', p)).href);

test('kadry: siatka z rynną, podział linią prostą i ukośną, spad, kolejność czytania', async () => {
  const { siatkaKadrow, podzielKadr, naSpad, numerujKadry, elementKadru } = await modul('kadry.js');
  const obszar = { x: 10, y: 10, w: 190, h: 277 };
  const k = siatkaKadrow(obszar, [[1, 1], [1], [1, 2]], 4);
  assert.equal(k.length, 5);
  // rynna: odstęp 4 mm między kadrami w wierszu i między wierszami
  assert.equal(k[1][0].x - k[0][1].x, 4);
  assert.equal(k[2][0].y - k[0][2].y, 4);
  // proporcje 1:2 w ostatnim wierszu
  const szer = (q) => q[1].x - q[0].x;
  assert.ok(Math.abs(szer(k[4]) - 2 * szer(k[3])) < 0.05);
  // ostatni kadr kończy się na brzegu obszaru
  assert.deepEqual(k[4][2], { x: 200, y: 287 });
  // podział poziomą linią przez środek kadru: dwa kadry, rynna 4 mm między nimi
  const [g, d] = podzielKadr(k[2], { x: 0, y: 148.5 }, { x: 300, y: 148.5 }, 4);
  const yMax = (q) => Math.max(...q.map((p) => p.y)); const yMin = (q) => Math.min(...q.map((p) => p.y));
  const [gora, dol] = yMax(g) < yMax(d) ? [g, d] : [d, g];
  assert.ok(Math.abs(yMin(dol) - yMax(gora) - 4) < 0.01, 'rynna przy podziale');
  // ukośny podział daje trapezy (4 wierzchołki), linia poza kadrem – null
  const ukos = podzielKadr(k[0], { x: 10, y: 100 }, { x: 103, y: 10 }, 4);
  assert.ok(ukos && ukos.every((q) => q.length >= 3));
  assert.equal(podzielKadr(k[0], { x: 500, y: 0 }, { x: 500, y: 10 }, 4), null);
  // na spad: brzeg przy krawędzi obszaru idzie do krawędzi spadu (3 mm poza format 210×297)
  const spad = naSpad(k[0], obszar, { w: 210, h: 297 }, 3);
  assert.deepEqual(spad[0], { x: -3, y: -3 });
  // kolejność czytania niezależna od kolejności na liście
  const n = numerujKadry([k[4], k[1], k[0], k[3], k[2]]);
  assert.deepEqual(n, k);
  const el = elementKadru(k[0], 1, { id: 'k1' });
  assert.deepEqual([el.type, el.kadr_nr, el.left, el.top, el.points[0]], ['polygon', 1, 9.7, 9.7, { x: 0, y: 0 }], 'róg z połową obrysu 0,6 mm');
});

test('dialogi z tabeli: dymki na stronach według kadrów, ponowne wstawienie zmienia tylko tekst, usunięte wiersze znikają', async () => {
  const { dymkiZTabeli, kolumnyDialogu, kolumnyTekstu } = await modul('dialogi.js');
  const tabela = {
    id: 't_dialog', kolumny: ['Strona', 'Kadr', 'Postać', 'tekst_pl', 'tekst_en', 'Rodzaj'],
    wiersze: [
      ['1', '1', 'Ala', 'Gdzie jest skarb?', 'Where is the treasure?', 'mowa'],
      ['1', '1', 'Ola', 'Tutaj!', 'Here!', 'krzyk'],
      ['1', '2', '', 'Tymczasem w zamku…', 'Meanwhile in the castle…', 'narracja'],
      ['2', '1', 'Ala', 'Hmm…', 'Hmm…', 'myśl'],
      ['5', '1', 'Ala', 'Nie ma takiej strony', '', ''],
    ],
  };
  assert.deepEqual(kolumnyTekstu(tabela), ['tekst_pl', 'tekst_en']);
  assert.equal(kolumnyDialogu(tabela).tekst, 3, 'bez wyboru – pierwsza kolumna tekstu');
  const projekt = { strony: [{ id: 's1', obiekty: [] }, { id: 's2', obiekty: [{ type: 'polygon', kadr_nr: 1, left: 20, top: 30, width: 100, height: 80 }] }] };
  let n = 0;
  const opcje = { wymiaryStrony: () => ({ lewy: 15, gora: 15, szer: 180, wys: 267 }), noweId: () => `d${(n += 1)}` };
  const w1 = dymkiZTabeli(projekt, tabela, opcje);
  assert.deepEqual([w1.dodane, w1.zmienione, w1.usuniete], [4, 0, 0]);
  assert.match(w1.pominiete[0], /strony 5/);
  const s1 = projekt.strony[0].obiekty;
  assert.deepEqual(s1.map((o) => [o.text, o.dymek.rodzaj, o.nazwa]), [['Gdzie jest skarb?', 'mowa', 'Dymek – Ala'], ['Tutaj!', 'krzyk', 'Dymek – Ola'], ['Tymczasem w zamku…', 'narracja', 'Dymek']]);
  // dwa dymki jednego kadru nie stoją na sobie; kadr 2 – w dolnym pasie strony
  assert.ok(s1[1].top > s1[0].top && s1[1].left !== s1[0].left);
  assert.ok(s1[2].top > 15 + 267 / 2 - 1, 'kadr 2 z 2 – dolny pas');
  assert.equal(s1[2].dymek.ogonek, null, 'narracja bez ogonka');
  assert.equal(s1[0].wielkosc_liter, 'wielkie', 'lettering wersalikami');
  // strona 2 ma kadr 1 jako element – dymek w jego ramce
  const d2 = projekt.strony[1].obiekty.find((o) => o.dymek);
  assert.ok(d2.left >= 20 && d2.top >= 30 && d2.top < 110, 'dymek w ramce kadru');
  // użytkownik przesuwa dymek, scenariusz się zmienia: tekst nowy, miejsce zostaje
  s1[0].left = 99; s1[0].top = 77;
  tabela.wiersze[0][3] = 'Gdzie jest mapa?';
  tabela.wiersze.splice(1, 1); // wiersz Oli usunięty – numery dalszych wierszy się przesuwają
  const w2 = dymkiZTabeli(projekt, tabela, opcje);
  const po = projekt.strony[0].obiekty;
  const ala = po.find((o) => o.nazwa === 'Dymek – Ala');
  assert.equal(ala.text, 'Gdzie jest mapa?');
  assert.deepEqual([ala.left, ala.top], [99, 77], 'przesunięty dymek zostaje na miejscu');
  assert.deepEqual([w2.dodane, w2.zmienione, w2.usuniete], [0, 1, 1], 'tylko zmiana tekstu Ali i usunięcie dymka Oli');
  assert.equal(po.find((o) => o.dymek.rodzaj === 'narracja').text, 'Tymczasem w zamku…', 'narracja nie dostała cudzego tekstu');
  // wersja angielska: inna kolumna tekstu, te same dymki
  dymkiZTabeli(projekt, tabela, { ...opcje, kolumnaTekstu: 'tekst_en' });
  assert.equal(projekt.strony[0].obiekty.find((o) => o.nazwa === 'Dymek – Ala').text, 'Where is the treasure?');
  assert.throws(() => dymkiZTabeli(projekt, { id: 'x', kolumny: ['a'], wiersze: [] }, opcje), /strona|tekst/);
});

test('import stron: numer strony i kadru z nazwy pliku (#369)', async () => {
  const { miejscePliku, planImportu } = await modul('import-stron.js');
  const m = (n) => miejscePliku(n);
  assert.deepEqual(m('01.png'), { strona: 1, kadr: null });
  assert.deepEqual(m('komiks/strona 7.jpg'), { strona: 7, kadr: null });
  assert.deepEqual(m('s03-k2.png'), { strona: 3, kadr: 2 });
  assert.deepEqual(m('str3_kadr2.webp'), { strona: 3, kadr: 2 });
  assert.deepEqual(m('p03 k02.png'), { strona: 3, kadr: 2 });
  assert.equal(m('okladka.png'), null);
  assert.equal(m('03.txt'), null);
  const plan = planImportu(['10.png', 's2-k1.png', '2.png', 'x.png']);
  assert.deepEqual(plan.strony.map((x) => x.strona), [2, 10]);
  assert.deepEqual(plan.kadry, [{ nazwa: 's2-k1.png', strona: 2, kadr: 1 }]);
  assert.deepEqual(plan.pominiete, ['x.png']);
});

test('webtoon: strony pocięte na kawałki do 1280 px (#371)', async () => {
  const { kawalkiWebtoonu } = await modul('kadry.js');
  const k = kawalkiWebtoonu([1000, 1000, 500], 1280);
  assert.deepEqual(k.map((x) => x.h), [1280, 1220]);
  assert.deepEqual(k[0].czesci, [{ strona: 0, sy: 0, dy: 0, h: 1000 }, { strona: 1, sy: 0, dy: 1000, h: 280 }]);
  assert.deepEqual(k[1].czesci, [{ strona: 1, sy: 280, dy: 0, h: 720 }, { strona: 2, sy: 0, dy: 720, h: 500 }]);
});
