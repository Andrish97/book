// Makieta 3D (#181): gotowe ujęcia, ustawienia sceny (otwarcie, wachlarz, egzemplarze), obwoluta, makiety sekcji
// specjalnych (ulotka, koperta, pudełko, kalendarz trójdzielny), koder GIF, zapis ujęć w projekcie (projekt.makieta),
// a w przeglądarce: ujęcia ustawiają kamerę, PNG w zadanym rozmiarze (także przezroczysty), WebM / MP4 i GIF.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);
const bliskie = (a, b, e = 0.5) => Math.abs(a - b) <= e;

// Wynik sekcji specjalnej bez projektu (geometria zależy tylko od parametrów).
async function specjalna(rodzaj, param = {}) {
  const S = await modul('js/sekcje-specjalne.js');
  const r = S.RODZAJE_SEKCJI[rodzaj];
  const p = r.normalizuj({ ...r.domyslne, ...param }, r.domyslne);
  return { ...p, wynik: r.geometria({}, {}, p) };
}

test('makieta 3D (#181): gotowe ujęcia – kamera, ułożenie, położenie i ustawienia sceny dla każdego modelu', async () => {
  const { UJECIA, ujeciaModelu, kartkiModelu } = await modul('js/makieta-3d.js');
  const k = kartkiModelu('ksiazka_twarda', { strony: 20, format: { w: 148, h: 210 } });
  // Wszystkie ujęcia z zadania są w spisie (kafelki).
  assert.deepEqual(Object.keys(UJECIA), ['przod', 'trzyCzwarte', 'zGory', 'grzbiet', 'stojaca', 'rozkladowka', 'wachlarz', 'stos', 'przodTyl', 'sciana']);
  for (const id of ujeciaModelu('ksiazka_twarda')) {
    const s = UJECIA[id].ustaw('ksiazka_twarda', k);
    for (const pole of ['obrotY', 'obrotX', 'zoom', 'fov']) assert.ok(Number.isFinite(s.kamera[pole]), `${id}: kamera.${pole}`);
    assert.ok(s.u >= 0 && s.u <= k.length, `${id}: położenie`);
  }
  assert.equal(UJECIA.zGory.ustaw('ksiazka_twarda', k).kamera.obrotX, 1.5, 'z góry – kamera prostopadle nad stołem');
  assert.equal(UJECIA.grzbiet.ustaw('ksiazka_twarda', k).ulozenie, 'stoi');
  assert.ok(UJECIA.grzbiet.ustaw('ksiazka_twarda', k).kamera.obrotY > 1, 'grzbiet – kamera z boku');
  assert.equal(UJECIA.rozkladowka.ustaw('ksiazka_twarda', k).u, Math.round(k.length / 2), 'rozkładówka w środku książki');
  assert.equal(UJECIA.wachlarz.ustaw('ksiazka_twarda', k).scena.wachlarz, 6);
  assert.deepEqual(UJECIA.stos.ustaw('ksiazka_twarda', k).scena.ilosc, { n: 3, uklad: 'stos' });
  assert.deepEqual(UJECIA.przodTyl.ustaw('ksiazka_twarda', k).scena.ilosc, { n: 2, uklad: 'przodTyl' });
  assert.equal(UJECIA.sciana.ustaw('kalendarz_scienny', k).opcje.swiatlo, 'okno', 'kalendarz na ścianie – światło z okna');
  // Ujęcia tylko tam, gdzie pasują.
  assert.ok(!ujeciaModelu('kalendarz_scienny').includes('grzbiet') && ujeciaModelu('kalendarz_scienny').includes('sciana'));
  assert.ok(!ujeciaModelu('ksiazka_miekka').includes('sciana') && ujeciaModelu('trojdzielny').includes('sciana'));
  assert.ok(!ujeciaModelu('kartka').includes('wachlarz'));
});

test('makieta 3D (#181): kąt otwarcia, wachlarz kartek, egzemplarze obok, w stosie, przód i tył', async () => {
  const { kartkiModelu, scena, obwiednia } = await modul('js/makieta-3d.js');
  const k = kartkiModelu('ksiazka_miekka', { strony: 40, format: { w: 148, h: 210 }, okladka: { w: 148, h: 210 } });
  const plasko = obwiednia(scena('ksiazka_miekka', k, 10));
  const v = obwiednia(scena('ksiazka_miekka', k, 10, { otwarcie: 100 }));
  assert.ok(v.max[0] - v.min[0] < (plasko.max[0] - plasko.min[0]) * 0.92, 'otwarcie 100° – połowy podniesione, węższa');
  assert.ok(v.max[1] > 80, 'połowy stoją w górę');
  assert.ok(v.min[1] > -0.01, 'na stole');
  // Wachlarz: więcej czworokątów (osobne kartki), wysoko nad książką.
  const zwykla = scena('ksiazka_miekka', k, 10);
  const w = scena('ksiazka_miekka', k, 10, { wachlarz: 6 });
  assert.ok(w.length > zwykla.length + 6 * 100, 'sześć kartek wachlarza');
  assert.ok(obwiednia(w).max[1] > 100, 'kartki wachlarza uniesione');
  // Egzemplarze.
  const jeden = obwiednia(scena('ksiazka_miekka', k, 0));
  const stos = obwiednia(scena('ksiazka_miekka', k, 0, { ilosc: { n: 3, uklad: 'stos' } }));
  assert.ok(bliskie(stos.max[1] - stos.min[1], 3 * (jeden.max[1] - jeden.min[1]), 0.5), 'trzy w stosie – trzy grubości');
  const obok = obwiednia(scena('ksiazka_miekka', k, 0, { ilosc: { n: 3, uklad: 'obok' } }));
  assert.ok(obok.max[0] - obok.min[0] > 3 * 148, 'trzy obok siebie');
  const pt = scena('ksiazka_miekka', k, 0, { ilosc: { n: 2, uklad: 'przodTyl' } });
  assert.ok(pt.some((q) => q.tex === 'okl:przod' && q.n[1] > 0.9) && pt.some((q) => q.tex === 'okl:tyl' && q.n[1] > 0.9), 'widać przód i tył okładki');
  assert.ok(bliskie(obwiednia(pt).min[1], 0, 0.01), 'oba leżą na stole');
});

test('makieta 3D (#181): obwoluta – tekstury obwoluty na twardej okładce, skrzydełka po wewnętrznej stronie', async () => {
  const { kartkiModelu, scena, obwiednia } = await modul('js/makieta-3d.js');
  const format = { w: 148, h: 210 };
  const okladka = { w: 151, h: 216, tektura: 2 };
  const k = kartkiModelu('ksiazka_twarda', { strony: 20, format, okladka, obwoluta: { skrzydelko_mm: 80 } });
  assert.equal(k[0].przod, 'obw:przod');
  assert.equal(k.at(-1).tyl, 'obw:tyl');
  assert.deepEqual(k[0].skrzydelko, { tex: 'obw:skrzydelko_p', w: 80, strona: -1 });
  assert.deepEqual(k.at(-1).skrzydelko, { tex: 'obw:skrzydelko_l', w: 80, strona: 1 });
  // Zamknięta: przód obwoluty na wierzchu, grzbiet z obwoluty.
  let q = scena('ksiazka_twarda', k, 0);
  assert.ok(q.some((x) => x.tex === 'obw:przod' && x.n[1] > 0.9));
  assert.ok(q.some((x) => x.grzbiet && x.tex === 'obw:grzbiet'));
  // Otwarta okładka: skrzydełko leży na wnętrzu tektury, przy przedniej krawędzi, szerokie na 80 mm.
  q = scena('ksiazka_twarda', k, 1);
  const s = q.filter((x) => x.tex === 'obw:skrzydelko_p' && Math.abs(x.n[1]) > 0.9);
  assert.ok(s.length, 'skrzydełko przodu');
  const o = obwiednia(s);
  assert.ok(bliskie(o.max[0] - o.min[0], 80, 1), `szerokość skrzydełka ${o.max[0] - o.min[0]}`);
  // Tektura pod okleiną: wierzch rozłożonej okładki to brzeg tektury (z okleiną obwoluty) – skrzydełko tuż nad nim.
  const tek = obwiednia(q.filter((x) => x.tex === 'obw:przod'));
  assert.ok(o.max[1] - tek.max[1] < 1.6 && o.max[1] - tek.max[1] > -0.1 && o.max[1] < 9, 'leży na rozłożonej okładce');
  // Bez obwoluty – okładka projektu, bez skrzydełek.
  const bez = kartkiModelu('ksiazka_twarda', { strony: 20, format, okladka });
  assert.equal(bez[0].przod, 'okl:przod');
  assert.ok(!scena('ksiazka_twarda', bez, 1).some((x) => x.tex.startsWith('obw:')));
});

test('makieta 3D (#181): sekcje specjalne – ulotka C i Z, koperta, pudełko z wykrojnika, kalendarz trójdzielny', async () => {
  const { kartkiModelu, scena, obwiednia, polozenia, opisPolozenia, widokModelu } = await modul('js/makieta-3d.js');
  const rozmiar = (q) => { const o = obwiednia(q); return o.max.map((v, i) => v - o.min[i]); };
  // Ulotka zwijana na 3: złożona – jeden panel (99 mm), okładka (zewnątrz) na wierzchu; rozłożona – cały arkusz.
  const ul = await specjalna('ulotka', { panele: 3, zlozenie: 'c' });
  let k = kartkiModelu('ulotka', { strony: 2, specjalna: ul });
  assert.deepEqual([k.length, k[0].przod, k[0].tyl, k[0].w], [1, 'p:0', 'p:1', 295]);
  assert.equal(polozenia('ulotka', k), 2);
  let q = scena('ulotka', k, 0);
  let r = rozmiar(q);
  assert.ok(r[0] < 101 && r[0] > 95, `złożona: szerokość jednego panelu (${r[0]})`);
  assert.ok(r[1] < 2, 'złożona leży płasko');
  const naWierzchu = q.filter((x) => (x.nv || [x.n])[0][1] > 0.9).reduce((a, x) => (Math.max(...x.p.map((p) => p[1])) > Math.max(...a.p.map((p) => p[1])) ? x : a));
  assert.equal(naWierzchu.tex, 'p:0', 'na wierzchu strona zewnętrzna (okładka)');
  r = rozmiar(scena('ulotka', k, 1));
  assert.ok(bliskie(r[0], 295, 1.5), `rozłożona: cały arkusz (${r[0]})`);
  q = scena('ulotka', k, 1);
  assert.equal(q.filter((x) => (x.nv || [x.n])[0][1] > 0.9 && Math.max(...x.p.map((p) => p[1])) > 0.05)[0].tex, 'p:1', 'rozłożona – środek do góry');
  assert.ok(scena('ulotka', k, 2).filter((x) => (x.nv || [x.n])[0][1] > 0.9).every((x) => x.tex === 'p:0'), 'odwrócona – zewnątrz');
  assert.equal(opisPolozenia('ulotka', k, 0), 'Złożona');
  // Harmonijka na 4.
  const z = await specjalna('ulotka', { panele: 4, zlozenie: 'z' });
  k = kartkiModelu('ulotka', { strony: 2, specjalna: z });
  assert.ok(rozmiar(scena('ulotka', k, 0))[0] < 101, 'harmonijka złożona do jednego panelu');
  assert.ok(bliskie(rozmiar(scena('ulotka', k, 1))[0], 396, 2), 'harmonijka rozłożona');
  // Koperta C6: zamknięta 162 × 114 mm, przód do góry; tył; otwarta klapa wystaje ponad kopertę.
  const ko = await specjalna('wykrojnik', { ksztalt: 'koperta', koperta: 'C6' });
  k = kartkiModelu('koperta', { strony: 1, specjalna: ko });
  r = rozmiar(scena('koperta', k, 0));
  assert.ok(bliskie(r[0], 162, 0.6) && bliskie(r[2], 114, 0.6) && r[1] < 3, `koperta zamknięta ${r}`);
  r = rozmiar(scena('koperta', k, 2));
  assert.ok(r[2] > 114 + 20 && r[1] > 10, 'otwarta klapa');
  assert.equal(opisPolozenia('koperta', k, 2), 'Tył – klapa otwarta');
  // Pudełko 100 × 60 × 150: płasko – wykrojnik; złożone – prostopadłościan.
  const pu = await specjalna('wykrojnik', { ksztalt: 'pudelko', dlugosc_mm: 100, szerokosc_mm: 60, wysokosc_mm: 150 });
  k = kartkiModelu('pudelko', { strony: 1, specjalna: pu });
  r = rozmiar(scena('pudelko', k, 0));
  assert.ok(r[1] < 1 && r[0] > 300, 'wykrojnik płasko na stole');
  r = rozmiar(scena('pudelko', k, 1));
  assert.ok(bliskie(r[0], 100, 1.5) && bliskie(r[1], 150, 1.5) && bliskie(r[2], 60, 1.5), `złożone pudełko ${r}`);
  // Trójdzielny: plecy z całego arkusza, trzy bloczki kalendariów, okienko, na ścianie.
  const tr = await specjalna('trojdzielny');
  k = kartkiModelu('trojdzielny', { strony: 1, specjalna: tr });
  q = scena('trojdzielny', k, 0);
  assert.equal(q.podloze.typ, 'sciana');
  assert.ok(obwiednia(q).min[2] >= q.podloze.poziom, 'nic nie wchodzi w ścianę');
  assert.ok(bliskie(rozmiar(q)[1], tr.wynik.wysokosc, 0.5));
  assert.ok(q.some((x) => x.tex === 'kolor:#c4161c'), 'czerwone okienko');
  assert.ok(q.filter((x) => x.tex === 'p:0' && x.n[2] > 0.9).length >= 4, 'plecy i trzy kalendaria z wydruku');
  assert.equal(widokModelu('trojdzielny').obrotX, widokModelu('kalendarz_scienny').obrotX);
});

// Minimalny dekoder GIF (pierwsza klatka) – sprawdza, że koder pisze poprawny LZW.
function dekodujGif(b) {
  const w = b[6] | (b[7] << 8);
  const h = b[8] | (b[9] << 8);
  let i = 13 + (b[10] & 0x80 ? 3 * (2 << (b[10] & 7)) : 0);
  let klatek = 0;
  let pierwsza = null;
  while (b[i] !== 0x3b) {
    if (b[i] === 0x21) { i += 2; while (b[i]) i += b[i] + 1; i += 1; continue; }
    assert.equal(b[i], 0x2c, 'opis obrazu');
    i += 10;
    const min = b[i];
    i += 1;
    const dane = [];
    while (b[i]) { for (let j = 1; j <= b[i]; j += 1) dane.push(b[i + j]); i += b[i] + 1; }
    i += 1;
    klatek += 1;
    if (pierwsza) continue;
    const czysc = 1 << min;
    let rozmiar = min + 1;
    let slownik = [];
    const reset = () => { slownik = []; for (let k = 0; k < czysc; k += 1) slownik.push([k]); slownik.push(null, null); rozmiar = min + 1; };
    reset();
    const wynik = [];
    let poz = 0;
    let poprz = null;
    const czytaj = () => { let v = 0; for (let k = 0; k < rozmiar; k += 1) { v |= ((dane[poz >> 3] >> (poz & 7)) & 1) << k; poz += 1; } return v; };
    for (;;) {
      const kod = czytaj();
      if (kod === czysc) { reset(); poprz = null; continue; }
      if (kod === czysc + 1) break;
      let wpis;
      if (kod < slownik.length && slownik[kod]) wpis = slownik[kod];
      else wpis = [...poprz, poprz[0]];
      wynik.push(...wpis);
      if (poprz) slownik.push([...poprz, wpis[0]]);
      poprz = wpis;
      if (slownik.length === 1 << rozmiar && rozmiar < 12) rozmiar += 1;
    }
    pierwsza = wynik;
  }
  return { w, h, klatek, pierwsza };
}

test('makieta 3D (#181): własny koder GIF – nagłówek, pętla, klatki, poprawne LZW (także po wyczyszczeniu słownika)', async () => {
  const { KoderGif, indeksyGif, paletaGif } = await modul('js/gif.js');
  const w = 64;
  const h = 48;
  const klatka = (f) => {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i += 1) { d[i * 4] = (i * 7 + f * 40) % 256; d[i * 4 + 1] = (i * 13) % 256; d[i * 4 + 2] = (i * 3 + f) % 256; d[i * 4 + 3] = 255; }
    return d;
  };
  const koder = new KoderGif(w, h, { opoznienie: 5 });
  for (let f = 0; f < 3; f += 1) koder.dodaj(klatka(f));
  const b = koder.zakoncz();
  assert.equal(String.fromCharCode(...b.slice(0, 6)), 'GIF89a');
  assert.equal(b.at(-1), 0x3b);
  assert.ok(new TextDecoder('latin1').decode(b).includes('NETSCAPE2.0'), 'animacja w pętli');
  const g = dekodujGif(b);
  assert.deepEqual([g.w, g.h, g.klatek], [w, h, 3]);
  // Pierwsza klatka po zdekodowaniu = indeksy palety z kodera (szum wymusza pełny słownik i jego czyszczenie).
  assert.deepEqual(g.pierwsza, [...indeksyGif(klatka(0), w, h)]);
  // Paleta: czerń i biel dokładnie.
  const p = paletaGif();
  assert.deepEqual([...p.slice(0, 3)], [0, 0, 0]);
  assert.deepEqual([...p.slice(251 * 3, 252 * 3)], [255, 255, 255]);
});

test('makieta 3D (#181): ujęcia w projekcie – normalizacja pola projekt.makieta i ustawień', async () => {
  const U = await modul('js/makieta-ustawienia.js');
  const P = await modul('js/projekt.js');
  assert.equal(U.normalizujMakiete(null), null);
  assert.equal(U.normalizujMakiete({ ujecia: [] }), null);
  const m = U.normalizujMakiete({ ujecia: [
    { id: 'a', nazwa: 'Na drewnie', model: 'ksiazka_twarda', u: 3, ulozenie: 'stoi', kamera: { obrotY: 0.4, obrotX: 0.3, zoom: 1.4, fov: 20 }, scena: { otwarcie: 120, wachlarz: 3, ilosc: { n: 3, uklad: 'stos' } }, opcje: { tlo: 'drewno', swiatlo: 'okno', barwa: 'ciepla', wykonczenie: 'blysk', papier: 'kremowy' }, obwoluta: true },
    { id: 'a', nazwa: 'x'.repeat(200), model: 'zly', kamera: { obrotX: 99 }, opcje: { tlo: 'kosmos', kolorTla: 'czerwony', silaCienia: 9 } },
    'śmieć',
  ] });
  assert.equal(m.ujecia.length, 2);
  const [a, b] = m.ujecia;
  assert.deepEqual([a.model, a.u, a.ulozenie, a.kamera.fov, a.scena.otwarcie, a.scena.wachlarz, a.scena.ilosc.uklad, a.opcje.tlo, a.opcje.barwa, a.opcje.papier, a.obwoluta],
    ['ksiazka_twarda', 3, 'stoi', 20, 120, 3, 'stos', 'drewno', 'ciepla', 'kremowy', true]);
  assert.notEqual(b.id, 'a', 'powtórzone id dostaje nowe');
  assert.equal(b.model, null);
  assert.equal(b.nazwa.length, 80);
  assert.equal(b.kamera.obrotX, 1.6);
  assert.deepEqual([b.opcje.tlo, b.opcje.kolorTla, b.opcje.silaCienia], ['studio', U.DOMYSLNE_OPCJE.kolorTla, 1.6]);
  // W projekcie: pole zostaje po normalizacji, bez ujęć znika.
  const p = P.nowyProjekt('X');
  p.makieta = { ujecia: [{ nazwa: 'Okładka', model: 'kartka', kamera: { obrotY: 0, obrotX: 1.5 } }] };
  const n = P.normalizuj(JSON.parse(JSON.stringify(p)));
  assert.equal(n.makieta.ujecia[0].nazwa, 'Okładka');
  assert.equal(n.makieta.ujecia[0].opcje.tlo, 'studio');
  assert.ok(!('makieta' in P.normalizuj({ ...p, makieta: { ujecia: [] } })));
});

test('makieta 3D (#181) w przeglądarce: ujęcia ustawiają kamerę, PNG w zadanym rozmiarze, przezroczyste tło, WebM i GIF, zapis ujęcia w projekcie', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Makieta 181');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const O = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    for (let i = 1; i < 8; i += 1) p.strony.push(P.nowaStrona(`S${i + 1}`, p.sekcje[0].id));
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
  await strona.click('[data-akcja="podglad-makieta"]');
  await strona.waitForSelector('#dlg-makieta[open]');
  const M = (f, ...a) => strona.evaluate(async ([f, a]) => (await import('./js/app/makieta-okno.js'))[f](...a), [f, a]);
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 30000 });
  // Lista „Rodzaj” (#215): tylko rodzaj pasujący do projektu (twarda okładka – książka w twardej oprawie); reszta
  // ogólnych w grupie „Nie pasuje do projektu”.
  assert.deepEqual((await M('stanMakiety')).modele, ['ksiazka_twarda']);
  assert.deepEqual(await strona.evaluate(() => [...document.querySelectorAll('#makieta-model optgroup option')].map((o) => o.value)), ['ksiazka_miekka', 'notes', 'kalendarz_scienny', 'kalendarz_biurkowy', 'kartka']);
  // Kafelki ujęć: kliknięcie ustawia kamerę i zaznacza kafelek.
  await strona.click('.makieta-ujecie[data-ujecie="zGory"]');
  let s = await M('stanMakiety');
  assert.deepEqual([s.kamera.obrotY, s.kamera.obrotX, s.kamera.fov, s.ulozenie], [0, 1.5, 24, 'lezy']);
  assert.equal(await strona.getAttribute('.makieta-ujecie[data-ujecie="zGory"]', 'aria-pressed'), 'true');
  await strona.click('.makieta-ujecie[data-ujecie="stojaca"]');
  s = await M('stanMakiety');
  assert.equal(s.ulozenie, 'stoi');
  assert.equal(await M('ustawUjecieMakiety', 'rozkladowka'), true);
  s = await M('stanMakiety');
  assert.deepEqual([s.cel, s.scena.otwarcie], [Math.round(s.kartek / 2), 172]);
  assert.equal(await M('ustawUjecieMakiety', 'sciana'), false, 'ujęcie ścienne nie pasuje do książki');
  // Suwaki pokazują kamerę.
  assert.equal(await strona.inputValue('#makieta-pochylenie'), String(Math.round((1.45 * 180) / Math.PI)));
  // Ustawienia światła i tła.
  await strona.evaluate(() => { document.querySelector('#makieta-ustawienia').open = true; });
  await strona.selectOption('#makieta-tlo', 'drewno');
  await strona.selectOption('#makieta-swiatlo', 'okno');
  s = await M('stanMakiety');
  assert.deepEqual([s.opcje.tlo, s.opcje.swiatlo], ['drewno', 'okno']);
  // PNG: internet – dłuższy bok 1600; Instagram – 1080 × 1080; przezroczyste – róg bez tła.
  const png = (o) => strona.evaluate(async (o) => {
    const b = await (await import('./js/app/makieta-okno.js')).obrazMakiety(o);
    const i = await createImageBitmap(b);
    const c = new OffscreenCanvas(i.width, i.height);
    const g = c.getContext('2d');
    g.drawImage(i, 0, 0);
    return { w: i.width, h: i.height, typ: b.type, rog: [...g.getImageData(2, 2, 1, 1).data] };
  }, o);
  let p = await png({ rozmiar: '1600' });
  assert.equal(Math.max(p.w, p.h), 1600);
  assert.equal(p.typ, 'image/png');
  assert.equal(p.rog[3], 255, 'tło nieprzezroczyste');
  p = await png({ rozmiar: 'ig' });
  assert.deepEqual([p.w, p.h], [1080, 1080]);
  p = await png({ rozmiar: 'wlasny', wlasny: 900, przezroczyste: true });
  assert.equal(Math.max(p.w, p.h), 900);
  assert.equal(p.rog[3], 0, 'przezroczyste tło');
  // Animacja: wideo (WebM albo MP4 – nagłówek) i GIF.
  const anim = (o) => strona.evaluate(async (o) => {
    const w = await (await import('./js/app/makieta-okno.js')).nagrajAnimacje(o);
    const b = new Uint8Array(await w.blob.arrayBuffer());
    return { rozszerzenie: w.rozszerzenie, typ: w.blob.type, rozmiar: b.length, poczatek: [...b.slice(0, 12)] };
  }, o);
  const wideo = await anim({ ruch: 'obrot', plik: 'wideo', klatek: 12 });
  assert.ok(wideo.rozmiar > 1000, 'wideo ma treść');
  if (wideo.rozszerzenie === 'webm') assert.deepEqual(wideo.poczatek.slice(0, 4), [0x1a, 0x45, 0xdf, 0xa3], 'nagłówek EBML (WebM)');
  else assert.equal(String.fromCharCode(...wideo.poczatek.slice(4, 8)), 'ftyp', 'nagłówek MP4');
  const gif = await anim({ ruch: 'kartkowanie', plik: 'gif', klatek: 6 });
  assert.deepEqual([gif.rozszerzenie, gif.typ, String.fromCharCode(...gif.poczatek.slice(0, 6))], ['gif', 'image/gif', 'GIF89a']);
  // Płótno wraca do rozmiaru widoku.
  const prop = await strona.evaluate(() => { const c = document.querySelector('#makieta-plotno'); return [c.width / c.height, c.clientWidth / c.clientHeight]; });
  assert.ok(Math.abs(prop[0] - prop[1]) < 0.02);
  // Zapis ujęcia w projekcie i odczyt: zmiana kamery, potem ujęcie z listy przywraca stan.
  await M('ustawUjecieMakiety', 'trzyCzwarte');
  await strona.evaluate(() => { document.querySelector('#makieta-zapisane').open = true; });
  await strona.fill('#makieta-nazwa-ujecia', 'Na drewnie');
  await strona.click('[data-akcja="makieta-zapisz-ujecie"]');
  await strona.waitForFunction(() => document.querySelectorAll('#makieta-lista-ujec li').length === 1);
  const zapisane = await strona.evaluate(() => window.seriodruk.stan.projekt.makieta);
  assert.equal(zapisane.ujecia[0].nazwa, 'Na drewnie');
  assert.equal(zapisane.ujecia[0].model, 'ksiazka_twarda');
  assert.equal(zapisane.ujecia[0].opcje.tlo, 'drewno');
  await M('ustawUjecieMakiety', 'zGory');
  await M('ustawOpcjeMakiety', { tlo: 'marmur' });
  await strona.click('#makieta-lista-ujec .nazwa-ujecia');
  s = await M('stanMakiety');
  assert.ok(Math.abs(s.kamera.obrotY - zapisane.ujecia[0].kamera.obrotY) < 1e-9 && s.opcje.tlo === 'drewno', 'ujęcie z listy przywraca kamerę i tło');
  // Ujęcie przechodzi przez zapis projektu (normalizacja).
  const poZapisie = await strona.evaluate(async () => (await import('./js/projekt.js')).normalizuj(JSON.parse(JSON.stringify(window.seriodruk.stan.projekt))).makieta.ujecia.length);
  assert.equal(poZapisie, 1);
  await strona.click('#makieta-lista-ujec [data-usun-ujecie]');
  await strona.waitForFunction(() => !document.querySelector('#makieta-lista-ujec li'));
  assert.equal(await strona.evaluate(() => 'makieta' in window.seriodruk.stan.projekt), false);
  assert.deepEqual(bledy, []);
});

test('makieta 3D (#181) w przeglądarce: lista „Rodzaj” wg sekcji – sama ulotka, obwoluta z przełącznikiem', async (t) => {
  const { otworz, nowyProjekt } = require('./pomoc.cjs');
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Ulotka');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const S = await import('./js/sekcje-specjalne.js');
    const O = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    const s = p.sekcje[0];
    s.typ = 'ulotka';
    s.specjalna = S.domyslnaSpecjalna('ulotka');
    // Nowe strony (strona otwarta w edytorze wraca z płótna przy przejściu do podglądu).
    const zew = P.nowaStrona('Zewnątrz', s.id);
    zew.tlo = '#1b6ca8';
    p.strony = [zew, P.nowaStrona('Środek', s.id)];
    O.przeliczOkladki(p);
  });
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForSelector('.podglad-strona[data-id]');
  await strona.click('[data-akcja="podglad-makieta"]');
  await strona.waitForSelector('#dlg-makieta[open]');
  const M = (f, ...a) => strona.evaluate(async ([f, a]) => (await import('./js/app/makieta-okno.js'))[f](...a), [f, a]);
  let s = await M('stanMakiety');
  assert.deepEqual([s.modele, s.model, s.polozen], [['ulotka'], 'ulotka', 2]);
  assert.deepEqual(await strona.$$eval('#makieta-model option', (o) => o.map((x) => x.value)), ['ulotka']);
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 30000 });
  // Złożona ulotka na środku kadru: niebieska okładka.
  const piksel = await strona.evaluate(() => {
    const c = document.querySelector('#makieta-plotno');
    const gl = c.getContext('webgl');
    const px = new Uint8Array(4);
    gl.readPixels(Math.round(c.width / 2), Math.round(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [...px];
  });
  assert.ok(piksel[2] > piksel[0] + 40, `okładka ulotki na wierzchu: ${piksel}`);
  await strona.click('#makieta-dalej');
  await strona.waitForFunction(() => document.querySelector('#makieta-polozenie').textContent === 'Rozłożona – środek');
  await strona.evaluate(() => document.querySelector('#dlg-makieta').close());
  // Obwoluta: książka w twardej oprawie z sekcją obwoluty – przełącznik „Pokaż obwolutę”.
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const S = await import('./js/sekcje-specjalne.js');
    const O = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    const blok = P.nowaSekcja('Blok');
    p.sekcje.push(blok);
    for (let i = 0; i < 6; i += 1) p.strony.push(P.nowaStrona(`B${i}`, blok.id));
    const ok = P.nowaSekcja('Okładka');
    ok.okladka = { oprawa: 'twarda' };
    p.sekcje.push(ok);
    p.strony.push(P.nowaStrona('Okładka', ok.id));
    const ob = P.nowaSekcja('Obwoluta');
    ob.typ = 'obwoluta';
    ob.specjalna = { ...S.domyslnaSpecjalna('obwoluta'), skrzydelko_mm: 70 };
    p.sekcje.push(ob);
    const so = P.nowaStrona('Obwoluta', ob.id);
    so.tlo = '#7a1f2b';
    p.strony.push(so);
    O.przeliczOkladki(p);
  });
  await strona.click('[data-akcja="podglad-makieta"]');
  await strona.waitForSelector('#dlg-makieta[open]');
  s = await M('stanMakiety');
  assert.ok(s.modele.includes('ulotka') && s.modele.includes('ksiazka_twarda'));
  await strona.selectOption('#makieta-model', 'ksiazka_twarda');
  assert.equal(await strona.isVisible('#makieta-obwoluta-pole'), true);
  s = await M('stanMakiety');
  assert.equal(s.obwoluta, true, 'obwoluta widoczna od razu');
  assert.equal((await M('kartkiMakiety'))[0].przod, 'obw:przod');
  await strona.click('#makieta-obwoluta-pole');
  assert.equal((await M('kartkiMakiety'))[0].przod, 'okl:przod', 'po wyłączeniu – okładka projektu');
  await strona.selectOption('#makieta-model', 'ksiazka_miekka');
  assert.equal(await strona.isVisible('#makieta-obwoluta-pole'), false, 'obwoluta tylko na twardej oprawie');
  assert.deepEqual(bledy, []);
});

// Przegląd makiet 19.11: kalendarz biurkowy bez „Stosu” (stojaki balansowały jeden na szczycie drugiego) i bez
// „Z góry” (sam grzbiet stojaka); pudełko w ujęciach przodu, ¾ i stosu – złożone, „Z góry” – płaski wykrojnik.
test('ujęcia po przeglądzie: kalendarz biurkowy bez stosu i widoku z góry, pudełko złożone', async () => {
  const { UJECIA, ujeciaModelu, kartkiModelu, polozenia } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '..', 'js/makieta-3d.js')).href);
  assert.ok(!ujeciaModelu('kalendarz_biurkowy').includes('stos'));
  assert.ok(!ujeciaModelu('kalendarz_biurkowy').includes('zGory'));
  const kp = kartkiModelu('pudelko', { strony: 1, specjalna: { wynik: { szerokosc: 300, wysokosc: 300, siatka: null } } });
  const max = polozenia('pudelko', kp);
  for (const u of ['przod', 'trzyCzwarte', 'stos']) assert.equal(UJECIA[u].ustaw('pudelko', kp).u, max, u);
  assert.equal(UJECIA.zGory.ustaw('pudelko', kp).u, 0);
});
