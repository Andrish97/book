// Typ sekcji (#177): jawne pole `sekcja.typ` – migracja starszych projektów bez zgadywania po nazwie, wyklejki
// (geometria z bloku, strefy, zgięcie), grzbiet z wyklejkami i wkładką, numeracja tylko w bloku, kontrola
// przed drukiem, pliki PDF według ról, karty typów w oknie sekcji i jednorazowa podpowiedź dla „wyklejki” z nazwy.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

async function ksiazka(stron = 96) {
  const P = await modul('js/projekt.js');
  const S = await modul('js/sekcje-specjalne.js');
  const O = await modul('js/okladka.js');
  const { rozwin } = await modul('js/serie.js');
  const p = P.nowyProjekt('Książka');
  p.sekcje[0].nazwa = 'Blok';
  for (let i = 1; i < stron; i += 1) p.strony.push(P.nowaStrona(`S${i + 1}`, p.sekcje[0].id));
  const okl = P.nowaSekcja('Okładka');
  okl.okladka = { ...O.domyslnaOkladka(), oprawa: 'twarda' };
  p.sekcje.unshift(okl);
  p.strony.unshift(P.nowaStrona('Okładka', okl.id));
  return { P, S, O, rozwin, p, okl };
}

test('migracja: typ z parametrów (okładka, sekcja specjalna, rola), nigdy z nazwy; typ ustala parametry', async () => {
  const { P, S, p } = await ksiazka(8);
  const wyk = P.nowaSekcja('Wyklejka przednia'); // tylko nazwa – zostaje zwykła
  const wkl = P.nowaSekcja('Zdjęcia');
  wkl.rola = 'wkladka';
  wkl.papier = { gramatura: 150, rodzaj: 'kredowy_blysk' };
  const ulo = P.nowaSekcja('Coś');
  ulo.specjalna = S.domyslnaSpecjalna('ulotka');
  p.sekcje.push(wyk, wkl, ulo);
  const n = P.normalizuj(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(n.sekcje.map((s) => s.typ), ['okladka', 'zwykla', 'zwykla', 'wkladka', 'ulotka']);
  assert.equal(n.sekcje[2].specjalna, undefined, 'nazwa „Wyklejka” nie robi z sekcji wyklejki');
  assert.deepEqual(n.sekcje[3].papier, { gramatura: 150, rodzaj: 'kredowy_blysk' });
  assert.equal(n.sekcje[3].rola, undefined, 'rola wynika z typu');
  // Typ wygrywa: wyklejka tylna dostaje parametry wyklejki, okładka zmieniona na blok traci pole okladka.
  n.sekcje[2].typ = 'wyklejka_tylna';
  n.sekcje[0].typ = 'blok';
  const m = P.normalizuj(n);
  assert.equal(m.sekcje[2].specjalna.rodzaj, 'wyklejka');
  assert.equal(m.sekcje[2].specjalna.strona, 'tylna');
  assert.equal(m.sekcje[0].okladka, undefined);
  // Typ nowej okładki bez parametrów – domyślna okładka.
  m.sekcje[1].typ = 'okladka';
  assert.ok(P.normalizuj(m).sekcje[1].okladka);
  assert.equal(S.typSekcji({ nazwa: 'Wyklejka' }), 'zwykla');
});

test('wyklejki: arkusz 2× format bloku, zgięcie pośrodku, strefy; grzbiet rośnie o wyklejki i wkładkę; numery tylko w bloku', async () => {
  const { P, S, O, rozwin, p, okl } = await ksiazka(96);
  O.przeliczOkladki(p);
  const grzbietBez = okl.okladka.wynik.grzbiet;
  const nowe = S.dodajWyklejki(p);
  assert.deepEqual(nowe.map((s) => s.typ), ['wyklejka_przednia', 'wyklejka_tylna']);
  assert.deepEqual(p.sekcje.map((s) => S.typSekcji(s)), ['okladka', 'wyklejka_przednia', 'zwykla', 'wyklejka_tylna']);
  O.przeliczOkladki(p);
  const { przednia, tylna } = S.wyklejkiProjektu(p);
  const blok = p.sekcje[2].wydruk;
  const w = przednia.specjalna.wynik;
  assert.equal(w.szerokosc, 2 * blok.szerokosc_mm);
  assert.equal(w.wysokosc, blok.wysokosc_mm);
  assert.equal(przednia.wydruk.szerokosc_mm, 2 * blok.szerokosc_mm);
  assert.deepEqual(w.bigi.map((b) => [b.x1, b.x2]), [[blok.szerokosc_mm, blok.szerokosc_mm]]);
  const strefy = (wynik) => wynik.strefy.filter((z) => (z.strona ?? 0) === 0).sort((a, b) => a.x1 - b.x1).map((z) => z.rodzaj);
  assert.deepEqual(strefy(w), ['na_okladke', 'luzna']);
  assert.deepEqual(strefy(tylna.specjalna.wynik), ['luzna', 'na_okladke']);
  assert.equal(S.rolaSekcji(p, przednia), 'wyklejka');
  // Grzbiet: dwie luźne kartki wyklejek (140 g).
  const g1 = okl.okladka.wynik.grzbiet;
  assert.ok(g1 > grzbietBez, `grzbiet ${g1} > ${grzbietBez}`);
  // Wkładka: 8 stron kredy 150 g – 4 kartki dochodzą do grzbietu; wkładka nie ma numerów.
  const wkl = P.nowaSekcja('Zdjęcia');
  Object.assign(wkl, { typ: 'wkladka', papier: { gramatura: 150, rodzaj: 'kredowy_mat' } });
  p.sekcje.splice(3, 0, wkl);
  for (let i = 0; i < 8; i += 1) p.strony.push(P.nowaStrona(`F${i + 1}`, wkl.id));
  P.uporzadkujStrony(p);
  O.przeliczOkladki(p);
  const d = okl.okladka.wynik.dodatek;
  assert.equal(d.wyklejek, 2);
  assert.equal(d.wkladek, 4);
  assert.ok(okl.okladka.wynik.grzbiet > g1);
  assert.equal(okl.okladka.wynik.stron, 96, 'strony bloku bez wkładki i wyklejek');
  const ciag = rozwin(p);
  const numery = (typ) => ciag.egzemplarze.filter((e) => S.typSekcji(e.sekcja) === typ).map((e) => e.nr ?? null);
  assert.ok(numery('okladka').every((n) => n == null));
  assert.ok(numery('wyklejka_przednia').every((n) => n == null));
  assert.ok(numery('wkladka').every((n) => n == null));
  assert.deepEqual(numery('zwykla').slice(0, 3), [1, 2, 3], 'blok numerowany od 1 mimo okładki i wyklejki przed nim');
  assert.equal(numery('zwykla').at(-1), 96);
});

test('kontrola przed drukiem: twarda oprawa bez wyklejek → naprawa „wyklejki”; wyklejka przy miękkiej → uwaga', async () => {
  const { S, O, rozwin, p, okl } = await ksiazka(16);
  O.przeliczOkladki(p);
  let uwagi = S.uwagiSekcjiSpecjalnych(p, rozwin(p));
  assert.ok(uwagi.some((u) => u.naprawa === 'wyklejki' && u.idSekcji === okl.id));
  S.dodajWyklejki(p);
  O.przeliczOkladki(p);
  uwagi = S.uwagiSekcjiSpecjalnych(p, rozwin(p));
  assert.ok(!uwagi.some((u) => u.naprawa === 'wyklejki'));
  okl.okladka.oprawa = 'miekka';
  O.przeliczOkladki(p);
  uwagi = S.uwagiSekcjiSpecjalnych(p, rozwin(p));
  assert.ok(uwagi.some((u) => /nie ma okładki twardej/.test(u.opis)));
});

test('aplikacja: karty typów w oknie sekcji, wyklejka z typu, pliki PDF według ról, podpowiedź dla nazwy „wyklejka”', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Typy');
  await strona.evaluate(async () => (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(null));
  await strona.waitForSelector('#dlg-sekcja[open]');
  assert.ok(await strona.locator('#dlg-sekcja .karta-typu').count() >= 12);
  assert.equal(await strona.inputValue('#dlg-sekcja input[name="typ"]:checked'), 'zwykla');
  await strona.click('#dlg-sekcja .karta-typu[data-typ="wyklejka_tylna"]');
  await strona.waitForSelector('#sekcja-specjalna:not([hidden])');
  assert.equal(await strona.isVisible('#sekcja-format'), false);
  await strona.click('#zapisz-sekcje');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje.some((s) => s.typ === 'wyklejka_tylna' && s.specjalna?.wynik));
  const w = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    const s = p.sekcje.find((x) => x.typ === 'wyklejka_tylna');
    return { strona: s.specjalna.strona, sz: s.wydruk.szerokosc_mm, blok: p.sekcje[0].wydruk.szerokosc_mm };
  });
  assert.equal(w.strona, 'tylna');
  assert.equal(w.sz, 2 * w.blok);
  // Wkładka: pola papieru tylko dla tego typu.
  await strona.evaluate(async () => (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(null));
  await strona.waitForSelector('#dlg-sekcja[open]');
  assert.equal(await strona.isVisible('#pole-papier-wkladki'), false);
  await strona.click('#dlg-sekcja .karta-typu[data-typ="wkladka"]');
  assert.equal(await strona.isVisible('#pole-papier-wkladki'), true);
  await strona.fill('#dlg-sekcja input[name="rola_gramatura"]', '170');
  await strona.click('#zapisz-sekcje');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje.some((s) => s.typ === 'wkladka'));
  // Pliki dla drukarni: blok, wkładka i wyklejka osobno.
  const pliki = await strona.evaluate(async () => {
    const E = await import('./js/eksport.js');
    const { rozwin } = await import('./js/serie.js');
    const p = window.seriodruk.stan.projekt;
    return E.planPlikow(p, rozwin(p).egzemplarze, { podzial: 'role' }).map((x) => x.rola);
  });
  assert.deepEqual(pliki, ['wyklejka', 'blok', 'wkladka']);
  // Podpowiedź: zwykła sekcja z „wyklejka” w nazwie – tylko propozycja, typ zostaje, dopóki użytkownik nie zdecyduje.
  const id = await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const Z = await import('./js/app/zapis.js');
    const p = window.seriodruk.stan.projekt;
    const s = P.nowaSekcja('Wyklejka przednia (stara)');
    p.sekcje.push(s);
    p.strony.push(P.nowaStrona('W', s.id));
    const n = P.normalizuj(JSON.parse(JSON.stringify(p)));
    await Z.otworzProjekt(n);
    return s.id;
  });
  await strona.waitForSelector('#powiadomienie:not([hidden]) button:has-text("Ustaw typ")', { timeout: 5000 });
  assert.equal(await strona.evaluate((i) => window.seriodruk.stan.projekt.sekcje.find((s) => s.id === i).typ, id), 'zwykla');
  await strona.click('#powiadomienie button:has-text("Ustaw typ")');
  await strona.waitForFunction((i) => window.seriodruk.stan.projekt.sekcje.find((s) => s.id === i).specjalna?.wynik, id);
  assert.equal(await strona.evaluate((i) => window.seriodruk.stan.projekt.sekcje.find((s) => s.id === i).typ, id), 'wyklejka_przednia');
  // Jednorazowo: po ponownym otwarciu ta sama sekcja nie jest już proponowana.
  assert.equal(await strona.evaluate(async () => (await import('./js/app/zapis.js')).sekcjaDoPodpowiedzi(window.seriodruk.stan.projekt)), null);
  assert.deepEqual(bledy, []);
});
