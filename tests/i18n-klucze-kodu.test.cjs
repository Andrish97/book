const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const KORZEN = path.join(__dirname, '..');
const slownik = (j) => { const t = fs.readFileSync(path.join(KORZEN, 'js', 'jezyki', 'klucze', `${j}.js`), 'utf8'); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); };

// #346: napisy kodu mają klucze (t('obszar.nazwa')) – każdy użyty klucz ma napis po polsku, angielsku i ukraińsku.
test('klucze w kodzie: każdy t(…) ma tłumaczenie w pl, en i uk', () => {
  const sl = { pl: slownik('pl'), en: slownik('en'), uk: slownik('uk') };
  const pliki = [];
  const zbierz = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (!/zewnetrzne|jezyki/.test(p)) zbierz(p); } else if (f.endsWith('.js')) pliki.push(p); } };
  zbierz(path.join(KORZEN, 'js'));
  const braki = [];
  let uzyte = 0;
  for (const p of pliki) {
    const kod = fs.readFileSync(p, 'utf8');
    const m = /import \{[^}]*\bt(?: as (\w+))?\b[^}]*\} from '[./]*jezyk\.js'/.exec(kod);
    if (!m) continue;
    const fn = m[1] || 't';
    for (const [, k] of kod.matchAll(new RegExp(`\\b${fn}\\('([A-Za-z0-9]+\\.[A-Za-z0-9]+)'`, 'g'))) {
      uzyte += 1;
      for (const j of ['pl', 'en', 'uk']) if (!sl[j][k]) braki.push(`${path.relative(KORZEN, p)}: ${k} (${j})`);
    }
  }
  assert.ok(uzyte > 1000, `kluczy w kodzie: ${uzyte}`);
  assert.deepEqual(braki, []);
});

test('klucze w kodzie: etykieta panelu z t() zmienia język bez przeładowania', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => localStorage.setItem('makietka-jezyk', 'en'));
  await strona.reload();
  await strona.waitForFunction(() => document.documentElement.lang === 'en');
  await nowyProjekt(strona, 'Keys');
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  const etykieta = (tekst) => strona.waitForSelector(`#wlasciwosci label:has-text("${tekst}")`, { timeout: 5000 });
  await etykieta('Lock position and size');
  const przelacz = async (j) => {
    await strona.evaluate((x) => import('./js/jezyk.js').then((m) => m.ustawJezyk(x)), j);
    await strona.waitForFunction((x) => document.documentElement.lang === x, j);
  };
  await przelacz('uk');
  await etykieta('Заблокувати розташування і розмір');
  await przelacz('pl');
  await etykieta('Zablokuj położenie i rozmiar');
  // Po polsku nowe okno też po polsku (t() zwraca napis polskiego słownika).
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.discardActiveObject(); e.canvas.setActiveObject(e.canvas.getObjects()[0]); e._emitujZaznaczenie(); });
  await etykieta('Zablokuj położenie i rozmiar');
  assert.deepEqual(bledy, []);
});

// #355: nazwy w Bibliotece (kształty, kategorie) i napisy w kawałkach HTML z kodu – po angielsku od startu.
test('klucze w kodzie: Biblioteka po angielsku – nazwy kształtów i kategorii', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.evaluate(() => localStorage.setItem('makietka-jezyk', 'en'));
  await strona.reload();
  await strona.waitForFunction(() => document.documentElement.lang === 'en');
  const nazwy = await strona.evaluate(async () => {
    const { KSZTALTY } = await import('./js/ksztalty-biblioteka.js');
    return KSZTALTY.filter((k) => k.id === 'trojkat' || k.id === 'romb').map((k) => [k.nazwa, k.kategoria]);
  });
  assert.deepEqual(nazwy[0], ['Triangle', 'Podstawowe'], 'nazwa po angielsku, kategoria (do porównań) bez zmian');
  assert.ok(nazwy[1][0] !== 'Romb', JSON.stringify(nazwy));
  assert.deepEqual(bledy, []);
});

// #356: odmiana w kluczach (zapis jak ICU): polski i ukraiński – trzy formy, angielski – dwie; zmienne w zdaniu.
test('klucze w kodzie: odmiana po liczbie w pl, en i uk', async (t) => {
  const { strona, bledy } = await otworz(t, { tryb: 'atrapa' });
  const wynik = await strona.evaluate(async () => {
    const { formatuj } = await import('./js/jezyk.js');
    const pl = 'Usunięto {n, plural, one {# obraz} few {# obrazy} many {# obrazów} other {# obrazu}} z „{nazwa}”.';
    const en = 'Deleted {n, plural, =0 {nothing} one {# image} other {# images}}.';
    const uk = '{n, plural, one {# сторінка} few {# сторінки} many {# сторінок} other {# сторінки}}';
    return {
      pl: [1, 2, 5, 12, 22].map((n) => formatuj(pl, { n, nazwa: 'Okładka' }, 'pl')),
      en: [0, 1, 3].map((n) => formatuj(en, { n }, 'en')),
      uk: [1, 3, 5, 21].map((n) => formatuj(uk, { n }, 'uk')),
      bezZmiennej: formatuj('Pole {imie} i {n}', { n: 2 }, 'pl'),
      // krótki zapis {n|jak 1|jak 2–4|jak 5}: grupę liczby wybiera reguła języka (21: po polsku „stron”, po ukraińsku „сторінка”)
      krotkiPl: [1, 2, 5, 21, 22, 101, 111, 1.5].map((n) => formatuj('{n|# strona|# strony|# stron}', { n }, 'pl')),
      krotkiUk: [1, 2, 5, 21, 22, 101, 111, 1.5].map((n) => formatuj('{n|# сторінка|# сторінки|# сторінок}', { n }, 'uk')),
      krotkiEn: [1, 2, 21].map((n) => formatuj('{n|# page|# pages}', { n }, 'en')),
    };
  });
  assert.deepEqual(wynik.pl, ['Usunięto 1 obraz z „Okładka”.', 'Usunięto 2 obrazy z „Okładka”.', 'Usunięto 5 obrazów z „Okładka”.', 'Usunięto 12 obrazów z „Okładka”.', 'Usunięto 22 obrazy z „Okładka”.']);
  assert.deepEqual(wynik.en, ['Deleted nothing.', 'Deleted 1 image.', 'Deleted 3 images.']);
  assert.deepEqual(wynik.uk, ['1 сторінка', '3 сторінки', '5 сторінок', '21 сторінка']);
  assert.equal(wynik.bezZmiennej, 'Pole {imie} i 2');
  assert.deepEqual(wynik.krotkiPl, ['1 strona', '2 strony', '5 stron', '21 stron', '22 strony', '101 stron', '111 stron', '1.5 strony']);
  assert.deepEqual(wynik.krotkiUk, ['1 сторінка', '2 сторінки', '5 сторінок', '21 сторінка', '22 сторінки', '101 сторінка', '111 сторінок', '1.5 сторінки']);
  assert.deepEqual(wynik.krotkiEn, ['1 page', '2 pages', '21 pages']);
  // W kodzie nie ma już ręcznej odmiany – wszystko idzie przez klucze.
  const fs = require('node:fs');
  const path = require('node:path');
  const reczna = [];
  const zbierz = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (!/zewnetrzne|jezyki/.test(p)) zbierz(p); } else if (f.endsWith('.js') && f !== 'ui.js' && /\bodmiana\(/.test(fs.readFileSync(p, 'utf8'))) reczna.push(f); } };
  zbierz(path.join(__dirname, '..', 'js'));
  assert.deepEqual(reczna, []);
  assert.deepEqual(bledy, []);
});
