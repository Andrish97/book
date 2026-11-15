// Książka (#131B): spis treści, żywa pagina, przypisy dolne, odsyłacze, skorowidz – obliczenia (js/ksiazka.js)
// i w aplikacji (wstawianie, panel, podgląd, PDF).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

// Projekt: sekcja „Wstęp” (strona ze spisem), sekcja „Treść” z dwoma rozdziałami i serią stron miesięcy.
async function projektKsiazki() {
  const P = await modul('js/projekt.js');
  const p = P.nowyProjekt('Książka');
  p.style = (await modul('js/style-tekstu.js')).domyslneStyle();
  const [tytul, naglowek, tekst] = p.style;
  const wstep = p.sekcje[0];
  wstep.nazwa = 'Wstęp';
  const tresc = P.nowaSekcja('Treść', wstep.wydruk);
  p.sekcje.push(tresc);
  const t = (id, txt, styl, extra = {}) => ({ type: 'textbox', id, left: 10, top: 10, width: 100, text: txt, styl: styl?.id, fontFamily: 'Inter', fontSize: 4, styles: [], ...extra });
  p.strony = [
    { ...P.nowaStrona('Spis', wstep.id), obiekty: [t('spis', '', null, { ksiazka: { rodzaj: 'spis', poziomy: 2 } })] },
    { ...P.nowaStrona('R1', tresc.id), obiekty: [t('r1', 'Rozdział pierwszy', tytul), t('a1', 'Wstęp: koty{przypis:p1} i psy.', tekst, { top: 40, przypisy: { p1: 'Pierwszy przypis.' }, hasla: ['koty'] })] },
    { ...P.nowaStrona('R1b', tresc.id), obiekty: [t('n1', 'Podrozdział', naglowek), t('a2', 'Druga {przypis:p2} i trzecia {przypis:p3}. Koty!', tekst, { top: 40, przypisy: { p2: 'Drugi.', p3: 'Trzeci.' } })] },
    { ...P.nowaStrona('Miesiąc', tresc.id), seria: 's1', obiekty: [t('m', 'Miesiąc {nazwa}', naglowek)] },
    { ...P.nowaStrona('R2', tresc.id), obiekty: [t('r2', 'Rozdział drugi', tytul), t('a3', 'Zob. s. {s:r1}, pagina: {rozdzial} / {rozdzial:2}.', tekst, { top: 40 })] },
  ];
  p.tabele = [{ id: 't1', nazwa: 'Miesiące', kolumny: ['nazwa'], wiersze: [['styczeń'], ['luty']] }];
  p.serie = [{ id: 's1', nazwa: 'Miesiące', tabela: 't1', tryb: 'tabela' }];
  return { P, p: P.normalizuj(p) };
}

test('książka – obliczenia: nagłówki z serią, numery stron, żywa pagina, przypisy, odsyłacze, skorowidz, spis treści', async () => {
  const { p } = await projektKsiazki();
  const K = await modul('js/ksiazka.js');
  const S = await modul('js/serie.js');
  const ciag = S.rozwin(p);
  const ix = K.indeksKsiazki(p, ciag);
  assert.deepEqual(ix.naglowki.map((n) => [n.tekst, n.poziom, n.nr]), [
    ['Rozdział pierwszy', 1, 2], ['Podrozdział', 2, 3], ['Miesiąc styczeń', 2, 4], ['Miesiąc luty', 2, 5], ['Rozdział drugi', 1, 6],
  ]);
  const egz = (id) => ciag.egzemplarze.find((e) => e.strona.obiekty.some((o) => o.id === id));
  const w = (id, nazwa, zapis) => S.wartosciPol(p, egz(id), ciag)(nazwa, zapis);
  assert.equal(w('a3', 's', 'r1'), '2', 'odsyłacz do strony rozdziału');
  assert.equal(w('a3', 's', 'nie-ma'), '?');
  assert.equal(w('a3', 'rozdzial', null), 'Rozdział drugi');
  assert.equal(w('a3', 'rozdzial', '2'), '', 'nowy rozdział zeruje pagine poziomu 2');
  assert.equal(w('a2', 'rozdzial', '2'), 'Podrozdział');
  assert.equal(w('a1', 'przypis', 'p1'), '1');
  assert.equal(w('a2', 'przypis', 'p2'), '2', 'numeracja ciągła w sekcji');
  assert.equal(w('a2', 'przypis', 'p3'), '3');
  assert.deepEqual(K.przypisyStrony(p, egz('a2'), ciag), [{ numer: 2, tresc: 'Drugi.' }, { numer: 3, tresc: 'Trzeci.' }]);
  // Przypisy od nowa na każdej stronie.
  p.ksiazka = { przypisy: 'strona' };
  const c2 = S.rozwin(p);
  assert.equal(S.wartosciPol(p, c2.egzemplarze.find((e) => e.strona.id === p.strony[2].id), c2)('przypis', 'p2'), '1');
  delete p.ksiazka;
  // Skorowidz: hasło „koty” na stronach 2 i 3 (bez wielkości liter).
  assert.deepEqual([...K.indeksKsiazki(p, S.rozwin(p)).hasla.get('koty')], [2, 3]);
  assert.equal(K.trescElementu(p, { rodzaj: 'skorowidz' }), 'koty\t2, 3');
  assert.equal(K.zakresStron([9, 3, 4, 5, 7, 8]), '3–5, 7, 8, 9'.replace('7, 8, 9', '7–9'));
  // Spis treści: dwa poziomy z wcięciem i numerami stron; przeliczenie wpisuje go do elementu.
  const zmienione = K.przeliczKsiazke(p);
  assert.deepEqual(zmienione, [p.strony[0].id]);
  const spis = p.strony[0].obiekty[0];
  assert.equal(spis.text.split('\n')[0], 'Rozdział pierwszy\t2');
  assert.match(spis.text.split('\n')[1], /^  Podrozdział\t3$/);
  assert.equal(spis.text.split('\n').length, 5);
  assert.equal(spis.tabulatory[0].rodzaj, 'prawy');
  assert.equal(spis.tabulatory[0].wypelniacz, '.');
  assert.deepEqual(K.przeliczKsiazke(p), [], 'drugie przeliczenie niczego nie zmienia');
  assert.ok(K.uzywaKsiazki(p));
  // Polskie sortowanie skorowidza.
  p.strony[1].obiekty[1].hasla.push('żaba', 'Łódź', 'kot', 'ćma');
  p.strony[1].obiekty[1].text += ' Żaba, łódź, kot, ćma.';
  assert.deepEqual(K.trescElementu(p, { rodzaj: 'skorowidz' }).split('\n').map((l) => l.split('\t')[0]), ['ćma', 'kot', 'koty', 'Łódź', 'żaba']);
});
