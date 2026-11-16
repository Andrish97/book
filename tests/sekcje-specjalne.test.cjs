// Sekcje specjalne (#177): obwoluta, ulotka składana, kalendarz z datami, kalendarz trójdzielny, wykrojniki
// (koperta, teczka, pudełko) i arkusz użytków – geometria stref, przeliczanie, święta, uwagi przed drukiem,
// okno sekcji, ostrzeżenia w edytorze i PDF (wymiary arkusza, linia wykrojnika w osobnym kolorze, użytki).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

async function projekt(stron = 100) {
  const P = await modul('js/projekt.js');
  const S = await modul('js/sekcje-specjalne.js');
  const O = await modul('js/okladka.js');
  const p = P.nowyProjekt('Książka');
  for (let i = 1; i < stron; i += 1) p.strony.push(P.nowaStrona(`S${i + 1}`, p.sekcje[0].id));
  const dodaj = (rodzaj, nazwa, param = {}) => {
    const s = P.nowaSekcja(nazwa);
    s.specjalna = { ...S.domyslnaSpecjalna(rodzaj), ...param };
    p.sekcje.push(s);
    p.strony.push(P.nowaStrona(nazwa, s.id));
    return s;
  };
  return { P, S, O, p, dodaj };
}

test('obwoluta: wymiary z twardej okładki, przeliczenie po zmianie liczby stron, elementy idą za przodem', async () => {
  const { P, S, O, p, dodaj } = await projekt(100);
  const ok = P.nowaSekcja('Okładka');
  ok.okladka = { oprawa: 'twarda', papier: { tryb: 'grubosc', grubosc_mm: 0.1 } };
  p.sekcje.unshift(ok);
  p.strony.unshift(P.nowaStrona('Okładka', ok.id));
  const ob = dodaj('obwoluta', 'Obwoluta', { skrzydelko_mm: 80 });
  O.przeliczOkladki(p);
  const w = ob.specjalna.wynik;
  const okl = ok.okladka.wynik;
  const plyta = okl.strefy.find((z) => z.rodzaj === 'przod');
  const grzbiet = okl.strefy.find((z) => z.rodzaj === 'grzbiet');
  // Środek: 100 stron = 50 kartek × 0,1 mm + 2 × tektura 2 mm = 9 mm grzbietu; płyta 148 + 3 mm naddatku.
  assert.equal(grzbiet.x2 - grzbiet.x1, 9);
  assert.equal(plyta.x2 - plyta.x1, 151);
  assert.deepEqual(w.strefy.map((z) => z.rodzaj), ['skrzydelko_l', 'zapas_l', 'tyl', 'grzbiet', 'przod', 'zapas_p', 'skrzydelko_p']);
  assert.equal(w.szerokosc, 80 + 3 + 151 + 9 + 151 + 3 + 80);
  assert.equal(w.wysokosc, 216); // wysokość płyty: 210 + 2 × 3 mm
  assert.equal(w.bigi.length, 6);
  assert.equal(ob.wydruk.szerokosc_mm, w.szerokosc);
  assert.equal(w.ksiazka.zOkladki, true);
  // Tytuł na przodzie: po dodaniu 40 stron grzbiet rośnie o 2 mm, przód (i tytuł) przesuwa się o 2 mm.
  const strona = p.strony.find((s) => s.sekcja === ob.id);
  const przod = w.strefy.find((z) => z.rodzaj === 'przod');
  strona.obiekty.push({ type: 'textbox', id: 'tytul', left: przod.x1 + 20, top: 40, width: 100, height: 20, text: 'Tytuł' });
  for (let i = 0; i < 40; i += 1) p.strony.push(P.nowaStrona(`D${i}`, p.sekcje[1].id));
  const zmienione = O.przeliczOkladki(p);
  assert.ok(zmienione.includes(ob.id));
  assert.equal(ob.specjalna.wynik.ksiazka.grzbiet, 11);
  assert.equal(ob.wydruk.szerokosc_mm, w.szerokosc + 2);
  assert.equal(strona.obiekty[0].left, przod.x1 + 20 + 2);
  // Sekcja obwoluty nie liczy się do stron środka okładki.
  assert.equal(ok.okladka.wynik.stron, 140);
  // Normalizacja zachowuje sekcję specjalną (zapis i wczytanie).
  const n = P.normalizuj(JSON.parse(JSON.stringify(p)));
  assert.equal(n.sekcje.find((s) => s.id === ob.id).specjalna.rodzaj, 'obwoluta');
  assert.equal(S.normalizujSpecjalna({ rodzaj: 'nieznany' }), null);
});

test('ulotka składana: panele zwijane węższe do środka, harmonijka równa, dwie strony z odbitymi panelami', async () => {
  const { S, O, p, dodaj } = await projekt(2);
  const u = dodaj('ulotka', 'Ulotka', { panele: 3, zlozenie: 'c', szerokosc_mm: 99, wysokosc_mm: 210, skrot_mm: 2 });
  O.przeliczOkladki(p);
  const w = u.specjalna.wynik;
  assert.deepEqual(w.panele, [99, 99, 97]);
  assert.equal(w.szerokosc, 295);
  assert.equal(p.strony.filter((s) => s.sekcja === u.id).length, 2, 'dochodzi strona wewnętrzna');
  const zew = S.wynikDlaStrony(w, 0);
  const wew = S.wynikDlaStrony(w, 1);
  assert.deepEqual(zew.strefy.map((z) => z.x2 - z.x1), [97, 99, 99]);
  assert.deepEqual(zew.strefy.map((z) => z.nazwa), ['Skrzydło do środka', 'Tył', 'Okładka']);
  assert.deepEqual(wew.strefy.map((z) => z.x2 - z.x1), [99, 99, 97]);
  assert.deepEqual(zew.bigi.map((b) => b.x1), [97, 196]);
  assert.deepEqual(wew.bigi.map((b) => b.x1), [99, 198]);
  // Harmonijka na 4: równe panele.
  u.specjalna = { ...u.specjalna, panele: 4, zlozenie: 'z', wynik: u.specjalna.wynik };
  O.przeliczOkladki(p);
  assert.deepEqual(u.specjalna.wynik.panele, [99, 99, 99, 99]);
  // Tekst na zgięciu → uwaga przed drukiem z numerem strony.
  const strona = p.strony.find((s) => s.sekcja === u.id);
  strona.obiekty.push({ type: 'textbox', id: 't', left: 80, top: 50, width: 40, height: 10, text: 'Na zgięciu' });
  const { rozwin } = await modul('js/serie.js');
  const uwagi = S.uwagiSekcjiSpecjalnych(p, rozwin(p));
  assert.equal(uwagi.length, 1);
  assert.match(uwagi[0].opis, /na zgięciu/);
});

test('kalendarz z datami: święta 2027 i 2028 (Wielkanoc, Boże Ciało), dni i tygodnie, zmiana roku przelicza dane', async () => {
  const { S, O, p, dodaj } = await projekt(1);
  const k = dodaj('kalendarz', 'Kalendarz', { rok: 2027, jednostka: 'dzien' });
  O.przeliczOkladki(p);
  const t = p.tabele.find((x) => x.id === k.specjalna.tabela);
  assert.equal(t.wiersze.length, 365);
  const kol = (n) => t.kolumny.indexOf(n);
  const dzien = (iso) => t.wiersze.find((w) => w[kol('data')] === iso);
  assert.equal(dzien('2027-03-28')[kol('swieto')], 'Wielkanoc');
  assert.equal(dzien('2027-05-27')[kol('swieto')], 'Boże Ciało');
  assert.equal(dzien('2027-03-29')[kol('wolne')], 'tak');
  assert.equal(dzien('2027-01-01')[kol('dzien_tygodnia')], 'Piątek');
  assert.equal(dzien('2027-01-04')[kol('tydzien')], '1');
  // Seria powiela pierwszą stronę sekcji.
  const seria = p.serie.find((s) => s.id === k.specjalna.seria);
  assert.equal(seria.tabela, t.id);
  assert.equal(p.strony.find((s) => s.sekcja === k.id).seria, seria.id);
  // Własna kolumna zostaje przy zmianie roku (wartości dla dat, które są w obu latach).
  t.kolumny.push('notatka');
  t.wiersze.forEach((w) => w.push(''));
  dzien('2027-03-28')[t.kolumny.length - 1] = 'x';
  k.specjalna.rok = 2028;
  O.przeliczOkladki(p);
  assert.equal(t.wiersze.length, 366, 'rok przestępny');
  assert.equal(t.wiersze.find((w) => w[0] === '2028-04-16')[kol('swieto')], 'Wielkanoc');
  assert.equal(t.wiersze.find((w) => w[0] === '2028-06-15')[kol('swieto')], 'Boże Ciało');
  assert.ok(t.kolumny.includes('notatka'));
  assert.equal(t.nazwa, 'Kalendarz 2028 – dni');
  // Miesiące i tygodnie.
  assert.equal(S.wierszeKalendarza({ rok: 2027, jednostka: 'miesiac', swieta: 'pl' }).length, 12);
  const tyg = S.wierszeKalendarza({ rok: 2027, jednostka: 'tydzien', swieta: 'pl', pierwszy: 'pn' });
  assert.ok(tyg.length >= 52 && tyg.length <= 53);
});

test('kalendarz trójdzielny, wykrojniki i arkusz użytków: strefy, bigi, perforacje, kontur cięcia, układ na arkuszu', async () => {
  const { S, O, p, dodaj } = await projekt(1);
  const t = dodaj('trojdzielny', 'Trójdzielny');
  const kop = dodaj('wykrojnik', 'Koperta', { ksztalt: 'koperta', koperta: 'DL' });
  const pud = dodaj('wykrojnik', 'Pudełko', { ksztalt: 'pudelko', dlugosc_mm: 100, szerokosc_mm: 60, wysokosc_mm: 150 });
  const tecz = dodaj('wykrojnik', 'Teczka', { ksztalt: 'teczka' });
  const ark = dodaj('arkusz', 'Wizytówki', { uzytek_szer_mm: 85, uzytek_wys_mm: 55, arkusz: 'SRA3', odstep_mm: 6, ksztalt: 'naklejka', zaokraglenie_mm: 4 });
  O.przeliczOkladki(p);
  const wt = t.specjalna.wynik;
  assert.equal(wt.szerokosc, 310);
  assert.equal(wt.wysokosc, 200 + 3 * 145 + 60);
  assert.equal(wt.bigi.length, 1);
  assert.equal(wt.perforacje.length, 3);
  assert.ok(wt.strefy.some((z) => z.rodzaj === 'okienko'));
  const wk = kop.specjalna.wynik;
  assert.deepEqual(wk.zlozona, { w: 220, h: 110 });
  assert.equal(wk.bigi.length, 4);
  assert.equal(wk.ciecie.length, 1);
  assert.ok(S.wKonturze(wk.ciecie[0], wk.szerokosc / 2, wk.wysokosc / 2), 'środek koperty w konturze');
  assert.ok(!S.wKonturze(wk.ciecie[0], 1, 1), 'róg arkusza poza konturem');
  const wp = pud.specjalna.wynik;
  assert.equal(wp.szerokosc, 15 + 2 * 100 + 2 * 60);
  assert.ok(wp.bigi.length >= 10);
  assert.ok(tecz.specjalna.wynik.naciecia.length === 2, 'nacięcia na wizytówkę');
  // Element poza wykrojnikiem → uwaga.
  const sk = p.strony.find((s) => s.sekcja === kop.id);
  sk.obiekty.push({ type: 'rect', id: 'r', left: 0, top: 0, width: 4, height: 4 });
  const { rozwin } = await modul('js/serie.js');
  assert.ok(S.uwagiSekcjiSpecjalnych(p, rozwin(p)).some((u) => /poza linią wykrojnika/.test(u.opis)));
  // Arkusz SRA3 (320 × 450) z wizytówkami 91 × 61 (ze spadem 3 mm): 3 × 6 = 18 albo 4 × 5 = 20 w poziomie.
  const wa = ark.specjalna.wynik;
  assert.equal(wa.szerokosc, 85);
  assert.equal(wa.uzytki.na_arkuszu, Math.max(wa.uzytki.kolumny * wa.uzytki.wiersze, 1));
  assert.ok(wa.uzytki.na_arkuszu >= 18, `użytków na arkuszu: ${wa.uzytki.na_arkuszu}`);
  assert.equal(wa.ciecie.length, 1, 'naklejka: kontur wykrojnika');
  assert.match(S.opisSpecjalnej(ark), /mieści się/);
});

test('aplikacja: okno sekcji tworzy ulotkę, edytor rysuje strefy i ostrzega o tekście na zgięciu, PDF ma arkusz i CutContour', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Specjalne');
  // Nowa sekcja: rodzaj „Ulotka składana”.
  await strona.evaluate(async () => (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(null));
  await strona.waitForSelector('#dlg-sekcja[open]');
  await strona.click('#dlg-sekcja .karta-typu[data-typ="ulotka"]');
  await strona.waitForSelector('#sekcja-specjalna:not([hidden])');
  assert.equal(await strona.isVisible('#sekcja-format'), false);
  assert.ok(await strona.locator('#schemat-specjalnej svg .sp-big').count() >= 4, 'schemat ma linie zgięć obu stron');
  await strona.fill('#dlg-sekcja input[name="sp_szerokosc_mm"]', '99');
  await strona.fill('#dlg-sekcja input[name="sp_wysokosc_mm"]', '210');
  await strona.click('#zapisz-sekcje');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje.some((s) => s.specjalna?.rodzaj === 'ulotka' && s.specjalna.wynik));
  const s = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    const sek = p.sekcje.find((x) => x.specjalna?.rodzaj === 'ulotka');
    return { w: sek.wydruk.szerokosc_mm, h: sek.wydruk.wysokosc_mm, stron: p.strony.filter((x) => x.sekcja === sek.id).length, wydruk: Boolean(window.seriodruk.edytor.wydruk.specjalna) };
  });
  assert.deepEqual(s, { w: 295, h: 210, stron: 2, wydruk: true });
  // Tekst na zgięciu → ostrzeżenie w edytorze.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const t = e.dodajTekst();
    t.set({ left: 80, top: 60, width: 40 });
    t.setCoords();
    e.przeliczOstrzezenia();
  });
  assert.ok(await strona.evaluate(() => window.seriodruk.edytor.ostrzezenia.some((o) => o.typ === 'na_zgieciu')));
  // Okno sekcji ponownie: rodzaj i parametry wracają.
  await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    (await import('./js/app/sekcje.js')).otworzUstawieniaSekcji(p.sekcje.find((x) => x.specjalna).id);
  });
  assert.equal(await strona.inputValue('#dlg-sekcja input[name="typ"]:checked'), 'ulotka');
  assert.equal(await strona.inputValue('#dlg-sekcja input[name="sp_szerokosc_mm"]'), '99');
  await strona.keyboard.press('Escape');
  // PDF: koperta (wymiar arkusza + CutContour) i wizytówki na arkuszu.
  const pdf = await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const S = await import('./js/sekcje-specjalne.js');
    const O = await import('./js/okladka.js');
    const p = window.seriodruk.stan.projekt;
    const kop = P.nowaSekcja('Koperta');
    kop.specjalna = { ...S.domyslnaSpecjalna('wykrojnik'), koperta: 'C6' };
    const wiz = P.nowaSekcja('Wizytówki');
    wiz.specjalna = { ...S.domyslnaSpecjalna('arkusz'), arkusz: 'A4' };
    wiz.wydruk.spad_mm = 2;
    p.sekcje.push(kop, wiz);
    p.strony.push(P.nowaStrona('Koperta', kop.id), P.nowaStrona('Wizytówka', wiz.id));
    O.przeliczOkladki(p);
    const { zlozPdf } = await import('./js/eksport.js');
    const { rozwin } = await import('./js/serie.js');
    const ciag = rozwin(p);
    const egz = ciag.egzemplarze.filter((e) => e.sekcja.id === kop.id || e.sekcja.id === wiz.id);
    const blob = await zlozPdf(p, egz, { ciag, znaki: true });
    const bajty = new Uint8Array(await blob.arrayBuffer());
    const PDFLib = window.PDFLib;
    const doc = await PDFLib.PDFDocument.load(bajty);
    const tekst = new TextDecoder('latin1').decode(await doc.save({ useObjectStreams: false }));
    const trim = doc.getPage(0).getTrimBox();
    return {
      stron: doc.getPageCount(),
      kopertaMm: [Math.round((trim.width * 25.4) / 72), Math.round((trim.height * 25.4) / 72)],
      arkuszMm: [Math.round((doc.getPage(1).getWidth() * 25.4) / 72), Math.round((doc.getPage(1).getHeight() * 25.4) / 72)],
      cut: tekst.includes('/CutContour'),
      kopertaWynik: [kop.specjalna.wynik.szerokosc, kop.specjalna.wynik.wysokosc],
      naArkuszu: wiz.specjalna.wynik.uzytki.na_arkuszu,
    };
  });
  assert.equal(pdf.stron, 2, 'koperta + jeden arkusz wizytówek');
  assert.deepEqual(pdf.kopertaMm, pdf.kopertaWynik.map(Math.round));
  assert.ok(pdf.arkuszMm.includes(210) && pdf.arkuszMm.includes(297), `arkusz A4: ${pdf.arkuszMm}`);
  assert.ok(pdf.cut, 'linia wykrojnika w kolorze CutContour');
  assert.ok(pdf.naArkuszu >= 8);
  assert.deepEqual(bledy, []);
});
