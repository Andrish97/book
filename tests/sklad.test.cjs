// Skład akapitu (#131): dzielenie wyrazów, spójniki, tabulatory, inicjał, oblewanie tekstem, wdowy
// i sieroty, siatka linii bazowych, style znakowe. Układ wierszy sprawdzany na żywych obiektach edytora.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const DLUGI = 'Przedsiębiorstwo telekomunikacyjne przygotowało niezapominajkowe kalendarze z przepięknymi ilustracjami i kolorowymi zakładkami dla wszystkich czytelników w całym kraju.';

// Tekst na stronie z podanymi właściwościami; zwraca opis jego wierszy.
async function tekst(strona, wlasciwosci) {
  return strona.evaluate(async ({ w, dlugi }) => {
    const { edytor } = window.seriodruk;
    await (await import('./js/dzielenie.js')).zaladujDzielenie();
    const t = edytor.dodajTekst(w.text ?? dlugi);
    t.set({ width: 60, ...w });
    t.initDimensions();
    edytor.ulozSkladStrony({ teraz: true });
    window.__t = t;
    return {
      linie: t._textLines.map((l) => ({ tekst: l.join(''), lacznik: Boolean(l.lacznik), x0: l.x0 ?? 0, w: l.w ?? null })),
      text: t.text,
    };
  }, { w: wlasciwosci, dlugi: DLUGI });
}

test('dzielenie wyrazów: łącznik na końcu wiersza, treść bez zmian, kursor trafia w te same znaki', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Skład');
  const bez = await tekst(strona, { dziel_wyrazy: false, lamanie_akapitu: undefined });
  const z = await tekst(strona, { dziel_wyrazy: true, lamanie_akapitu: undefined });
  assert.equal(z.text, bez.text, 'treść się nie zmienia');
  assert.ok(z.linie.some((l) => l.lacznik), 'co najmniej jeden wiersz kończy się łącznikiem');
  assert.ok(!bez.linie.some((l) => l.lacznik));
  // Każdy podział w środku słowa jest w miejscu dozwolonym przez wzorce (np. „przed|się|bior|stwo”).
  for (const l of z.linie.filter((x) => x.lacznik)) assert.match(l.tekst, /\p{L}{2,}$/u);
  // Wiersze z łącznikiem nie tracą znaków: suma długości + usunięte spacje = długość tekstu.
  const zgodnosc = await strona.evaluate(() => {
    const o = window.__t;
    let i = 0;
    for (let w = 0; w < o._textLines.length; w += 1) i += o._textLines[w].length + o.missingNewlineOffset(w);
    const koniec = o.get2DCursorLocation(o.text.length);
    const z = o.get2DCursorLocation(o.text.indexOf('ilustracjami') + 3);
    return { suma: i - 1, dlugosc: o.text.length, ostatni: koniec.lineIndex === o._textLines.length - 1, znak: o._textLines[z.lineIndex][z.charIndex] };
  });
  assert.equal(zgodnosc.suma, zgodnosc.dlugosc);
  assert.ok(zgodnosc.ostatni);
  assert.equal(zgodnosc.znak, 's', 'kursor wskazuje właściwą literę także za podzielonym wierszem');
  // Węższe wiersze niż bez dzielenia: mniej wierszy albo tyle samo.
  assert.ok(z.linie.length <= bez.linie.length);
  assert.deepEqual(bledy, []);
});

test('spójniki: jednoliterowe nie zostają na końcu wiersza; wyłączone – mogą', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Spójniki');
  const text = 'Mama i tata w domu z dziećmi o świcie a potem u babci i w ogrodzie z psem w cieniu a dalej o zmroku z latarką i w ciszy.';
  for (const szer of [30, 38, 45, 52, 61]) {
    const z = await tekst(strona, { text, width: szer, spojniki: true });
    for (const l of z.linie.slice(0, -1)) assert.doesNotMatch(l.tekst, /(^|\s)[aiouwzAIOUWZ]$/u, `wiersz „${l.tekst}” (szerokość ${szer})`);
  }
  let byl = false;
  for (const szer of [30, 38, 45, 52, 61]) {
    const z = await tekst(strona, { text, width: szer, spojniki: undefined, zasady_pl: undefined });
    if (z.linie.slice(0, -1).some((l) => /\s[aiouwz]$/u.test(l.tekst))) byl = true;
  }
  assert.ok(byl, 'bez ustawienia spójnik zostaje czasem na końcu wiersza');
  assert.deepEqual(bledy, []);
});

test('tabulatory: tekst za tabulatorem w ustawionych pozycjach (lewy, prawy z kropkami, domyślny co 12,5 mm)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tabulatory');
  const wynik = await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    const o = edytor.dodajTekst('Data\tGodzina\tSala\nA\tB');
    o.set({ width: 100, tabulatory: [{ poz: 30, rodzaj: 'lewy' }, { poz: 90, rodzaj: 'prawy', wypelniacz: '.' }] });
    o.initDimensions();
    const x = (w, z) => o.__charBounds[w][z].left;
    o.getLineWidth(0); o.getLineWidth(1);
    const g = o.__charBounds[0];
    const kon = (w, z) => o.__charBounds[w][z].left + o.__charBounds[w][z].kernedWidth;
    return { godzina: x(0, 5), sala: kon(0, 16), b: x(1, 2), tab: g[4].tab?.poz };
  });
  assert.ok(Math.abs(wynik.godzina - 30) < 0.2, `„Godzina” od 30 mm (${wynik.godzina})`);
  assert.ok(Math.abs(wynik.sala - 90) < 0.3, `„Sala” kończy się na 90 mm (${wynik.sala})`);
  assert.ok(Math.abs(wynik.b - 30) < 0.2, 'drugi akapit też');
  assert.equal(wynik.tab, 30);
  // Tab w pisanym tekście wstawia znak tabulacji.
  await strona.evaluate(() => {
    const o = window.seriodruk.edytor.dodajTekst('AB');
    window.seriodruk.edytor.canvas.setActiveObject(o);
    o.enterEditing();
    o.selectionStart = 1; o.selectionEnd = 1;
    o.hiddenTextarea.selectionStart = 1; o.hiddenTextarea.selectionEnd = 1;
    window.__o = o;
  });
  await strona.keyboard.press('Tab');
  assert.equal(await strona.evaluate(() => window.__o.text), 'A\tB');
  assert.deepEqual(bledy, []);
});

test('inicjał: pierwsza litera na 3 wiersze, trzy pierwsze wiersze odsunięte, litera nie zajmuje miejsca w wierszu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Inicjał');
  const z = await tekst(strona, { inicjal: 3, width: 80 });
  assert.ok(z.linie[0].x0 > 3 && z.linie[1].x0 > 3 && z.linie[2].x0 > 3, JSON.stringify(z.linie.slice(0, 4)));
  assert.equal(z.linie[3].x0, 0);
  const geo = await strona.evaluate(() => ({ szer: window.__t.__charBounds[0][0].width, g: window.__t._inicjal }));
  assert.equal(geo.szer, 0);
  assert.equal(geo.g.litera, 'P');
  assert.ok(geo.g.rozmiar > geo.g.n, 'inicjał większy niż tekst');
  assert.deepEqual(bledy, []);
});

test('oblewanie: tekst opływa prostokąt, przeskakuje pod element; „Nie opływaj” wyłącza', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Oblewanie');
  const wynik = await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    const o = edytor.dodajTekst(`${'Słowo '.repeat(120)}koniec.`);
    o.set({ left: 20, top: 30, width: 100 });
    o.initDimensions();
    const r = edytor.dodajProstokat();
    r.set({ left: 80, top: 40, width: 40, height: 25, oblewanie: 'prostokat', oblewanie_odstep: 2 });
    r.setCoords();
    edytor.ulozSkladStrony({ teraz: true });
    const obok = o._textLines.filter((l) => l.w !== undefined).map((l) => [l.x0, l.w]);
    r.set('oblewanie', 'skok');
    edytor.ulozSkladStrony({ teraz: true });
    const skok = o._textLines.reduce((s, l) => s + (l.odstepPo || 0), 0) + (o._odstepGory || 0);
    o.set('bez_oblewania', true);
    edytor.ulozSkladStrony({ teraz: true });
    return { obok, skok, bez: o._textLines.filter((l) => l.w !== undefined).length };
  });
  assert.ok(wynik.obok.length >= 3, 'kilka wierszy obok prostokąta');
  for (const [x0, w] of wynik.obok) assert.ok(x0 === 0 && w < 60, `wiersz po lewej stronie prostokąta (${x0}, ${w})`);
  assert.ok(wynik.skok >= 25, `skok pod prostokąt (${wynik.skok} mm)`);
  assert.equal(wynik.bez, 0);
  assert.deepEqual(bledy, []);
});

test('wdowy i sieroty: akapit przecięty granicą ramek zostawia po obu stronach co najmniej 2 wiersze', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wdowy');
  const wynik = await strona.evaluate(async () => {
    const { poprawWdowy } = await import('./js/sklad.js');
    const { edytor } = window.seriodruk;
    const o = edytor.dodajTekst(`Krótki akapit.\n${'Długi akapit z wieloma słowami do łamania. '.repeat(4)}`);
    o.set({ width: 50 });
    o.initDimensions();
    const linie = o._textLines.length;
    const akapit = (i) => o._styleMap[i].line;
    o.wdowy = 2;
    // Granica po pierwszym wierszu drugiego akapitu (sierota) i przed jego ostatnim wierszem (wdowa).
    const pierwszyDrugiego = o._textLines.findIndex((_, i) => akapit(i) === 1);
    return {
      sierota: poprawWdowy(o, pierwszyDrugiego + 1), pierwszyDrugiego,
      wdowa: poprawWdowy(o, linie - 1), linie,
      bez: (() => { o.wdowy = 0; return poprawWdowy(o, linie - 1); })(),
    };
  });
  assert.equal(wynik.sierota, wynik.pierwszyDrugiego, 'pierwszy wiersz akapitu idzie razem z resztą do następnej ramki');
  assert.equal(wynik.wdowa, wynik.linie - 2, 'ostatni wiersz akapitu nie zostaje sam w następnej ramce');
  assert.equal(wynik.bez, wynik.linie - 1);
  assert.deepEqual(bledy, []);
});

test('siatka linii bazowych: wiersze tekstu z „Wyrównaj do siatki” stoją na liniach siatki sekcji', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Siatka');
  const wynik = await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    edytor.wydruk.siatka_bazowa = { odstep: 6, przesuniecie: 12 };
    const o = edytor.dodajTekst('Pierwszy wiersz\nDrugi\nTrzeci akapit');
    o.set({ top: 17.3, lineHeight: 1.1, do_siatki: true });
    edytor.ulozSkladStrony({ teraz: true });
    const bazowe = [];
    let y = o._odstepGory || 0;
    for (let i = 0; i < o._textLines.length; i += 1) {
      bazowe.push(o.top + y + o.getHeightOfLineImpl(i) * (1 - o._fontSizeFraction));
      y += o.getHeightOfLine(i);
    }
    return bazowe.map((b) => ((b - 12) % 6 + 6) % 6);
  });
  for (const r of wynik) assert.ok(r < 0.01 || r > 5.99, `linia bazowa na siatce (reszta ${r})`);
  assert.deepEqual(bledy, []);
});

test('style: skład zapisuje się w stylu akapitu; styl znakowy zmienia wszystkie fragmenty z tym stylem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Style');
  const wynik = await strona.evaluate(async () => {
    const S = await import('./js/style-tekstu.js');
    const { edytor } = window.seriodruk;
    const o = edytor.dodajTekst('Jeden dwa trzy');
    o.set({ dziel_wyrazy: true, wdowy: 3 });
    const st = S.stylZObiektu(o, 'Książka');
    const inny = edytor.dodajTekst('Inny tekst');
    S.zastosujStyl(inny, st);
    const zStylu = { dziel: inny.dziel_wyrazy, wdowy: inny.wdowy, inicjal: inny.inicjal };
    const znak = S.stylZnakowyZFragmentu({ fontWeight: 'bold', fill: '#cc0000' }, 'Wyróżnienie');
    S.zastosujStylZnakowy(o, znak, 0, 5);
    const projekt = { strony: [{ obiekty: [o.toObject()] }], wzorce: [] };
    znak.fill = '#0000ff';
    const n = S.zastosujStylZnakowyWProjekcie(projekt, znak);
    const zapis = projekt.strony[0].obiekty[0].styles;
    return { zStylu, n, kolory: zapis.map((s) => s.style.fill), id: zapis[0].style.styl_znakowy === znak.id };
  });
  assert.deepEqual(wynik.zStylu, { dziel: true, wdowy: 3, inicjal: undefined });
  assert.equal(wynik.n, 1);
  assert.ok(wynik.kolory.every((k) => k === '#0000ff'), JSON.stringify(wynik.kolory));
  assert.ok(wynik.id);
  assert.deepEqual(bledy, []);
});

test('PDF: tekst z dzieleniem, inicjałem i tabulatorami z kropkami zostaje wektorowy (bez zamiany na obraz)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'PDF');
  const wynik = await strona.evaluate(async (dlugi) => {
    const { edytor, stan } = window.seriodruk;
    await (await import('./js/dzielenie.js')).zaladujDzielenie();
    const a = edytor.dodajTekst(dlugi);
    a.set({ width: 60, dziel_wyrazy: true, inicjal: 3, textAlign: 'justify' });
    const b = edytor.dodajTekst('Styczeń\t12\nLuty\t7');
    b.set({ top: 120, width: 80, tabulatory: [{ poz: 70, rodzaj: 'prawy', wypelniacz: '.' }] });
    (await import('./js/app/zapis.js')).zapiszBiezacyCel();
    const { zlozPdf, wybierzEgzemplarze } = await import('./js/eksport.js');
    const { rozwin } = await import('./js/serie.js');
    const ciag = rozwin(stan.projekt);
    const uwagi = new Map();
    const blob = await zlozPdf(stan.projekt, wybierzEgzemplarze(ciag), { uwagi, ciag });
    return { rozmiar: blob.size, uwagi: [...uwagi] };
  }, DLUGI);
  assert.ok(wynik.rozmiar > 1000);
  assert.deepEqual(wynik.uwagi, [], 'żaden element nie trafił do PDF jako obraz');
  assert.deepEqual(bledy, []);
});

// #323: polskie zasady składu – nie łamie po skrótach, inicjałach, między liczbą a jednostką/datą, przed myślnikiem.
test('polskie zasady składu: skróty, inicjały, liczby z jednostkami i myślnik nie rozdzielone na granicy wierszy', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Zasady');
  const TEKST = 'Spotkanie zaplanowano np. na 12 maja 2027 r. w sali nr 5, a prowadzi je dr J. Kowalski – ekspert od druku, który waży 82 kg i ma 10 000 książek oraz 25 % zniżki na kolejne wydanie.';
  const { zasady, bez } = await strona.evaluate(async (tekstAkapitu) => {
    const { edytor } = window.seriodruk;
    const wyniki = { zasady: [], bez: [] };
    for (const [klucz, zasady] of [['zasady', true], ['bez', false]]) {
      for (let w = 40; w <= 110; w += 3) {
        const o = edytor.dodajTekst(tekstAkapitu);
        o.set({ width: w, fontSize: 3, zasady_pl: zasady || undefined, spojniki: zasady || undefined });
        o.initDimensions();
        wyniki[klucz].push(o._textLines.map((l) => l.join('')));
        edytor.canvas.remove(o);
      }
    }
    return wyniki;
  }, TEKST);
  const { powodWiazania } = await import('../js/zasady-skladu.js');
  const zlamania = (uklady) => uklady.flatMap((linie) => linie.slice(0, -1).map((l, i) => {
    const a = l.trim().split(/\s+/).at(-1); const b = linie[i + 1].trim().split(/\s+/)[0];
    return powodWiazania(a, b) ? `${a} | ${b}` : null;
  }).filter(Boolean));
  assert.deepEqual(zlamania(zasady), [], 'z zasadami – żadnego zakazanego złamania');
  assert.ok(zlamania(bez).length > 0, 'bez zasad – takie złamania się zdarzają (test coś sprawdza)');
  // Treść bez zmian.
  for (const linie of zasady) assert.equal(linie.join(' ').replace(/\s+/g, ' ').trim(), TEKST);
  assert.deepEqual(bledy, []);
});

// #323: poprawki znaków i ostrzeżenia o składzie niezgodnym z zasadami.
test('polskie zasady składu: „Popraw znaki” i ostrzeżenia o niezgodnościach', async (t) => {
  const { poprawkiZnakow, uwagiZnakow } = await import('../js/zasady-skladu.js');
  const zastosuj = (s) => { let w = s; for (const z of poprawkiZnakow(s)) w = w.slice(0, z.od) + z.na + w.slice(z.do); return w; };
  assert.equal(zastosuj('Powiedział "tak" - i poszedł...  Dalej ( nawias ) , koniec .'), 'Powiedział „tak” – i poszedł… Dalej (nawias), koniec.');
  assert.equal(zastosuj('Pole {imie} "zostaje"'), 'Pole {imie} „zostaje”');
  assert.deepEqual(uwagiZnakow('Dobrze – „cytat”… i tyle.'), []);
  assert.deepEqual(uwagiZnakow('Źle "cytat"...').map((u) => u.kod).sort(), ['cudzyslow', 'kropki']);

  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Uwagi');
  const wynik = await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    const o = edytor.dodajTekst('Napisał "tak" - i poszedł...');
    o.set({ width: 80, fontSize: 3 });
    o.initDimensions();
    edytor.przeliczOstrzezenia();
    const przed = (edytor.ostrzezenia || []).filter((x) => x.id === o.id && x.typ === 'sklad_pl').length;
    const ile = edytor.poprawZnaki(o);
    edytor.przeliczOstrzezenia();
    const po = (edytor.ostrzezenia || []).filter((x) => x.id === o.id && x.typ === 'sklad_pl').length;
    return { przed, ile, po, text: o.text };
  });
  assert.equal(wynik.text, 'Napisał „tak” – i poszedł…');
  assert.equal(wynik.ile, 4);
  assert.equal(wynik.po, 0, 'po poprawce bez ostrzeżeń');
  assert.deepEqual(bledy, []);
});

// #323 etap B: dzielenie wyrazów według polskich zasad – najwyżej 3 dzielone wiersze pod rząd, bez dzielenia
// ostatniego wyrazu akapitu i wyrazów od wielkiej litery, co najmniej 3 litery przeniesione.
test('polskie zasady składu: dzielenie wyrazów z ograniczeniami', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Dzielenie');
  const TEKST = 'Niezapominajkowe przedsiębiorstwa telekomunikacyjne Rzeczpospolitej przygotowywały nadzwyczajnie skomplikowane konstantynopolitańczykowianeczki oraz niebezpieczeństwa.';
  const uklady = await strona.evaluate(async (tekstAkapitu) => {
    const { edytor } = window.seriodruk;
    await (await import('./js/dzielenie.js')).zaladujDzielenie();
    const wynik = [];
    // szerokości, w których najdłuższy wyraz mieści się w wierszu (wyraz dłuższy niż wiersz dzieli się zawsze)
    for (let w = 62; w <= 100; w += 2) {
      const o = edytor.dodajTekst(tekstAkapitu);
      o.set({ width: w, fontSize: 3, dziel_wyrazy: true, zasady_pl: true, textAlign: 'justify' });
      o.initDimensions();
      wynik.push(o._textLines.map((l) => ({ t: l.join(''), l: Boolean(l.lacznik) })));
      edytor.canvas.remove(o);
    }
    return wynik;
  }, TEKST);
  for (const linie of uklady) {
    let pod = 0;
    for (let i = 0; i < linie.length; i += 1) {
      pod = linie[i].l ? pod + 1 : 0;
      assert.ok(pod <= 3, `najwyżej 3 dzielone wiersze pod rząd: ${linie.map((x) => x.t).join(' / ')}`);
      if (linie[i].l) {
        const ostatni = linie[i].t.trim().split(/\s+/).at(-1);
        assert.ok(!/^\p{Lu}/u.test(ostatni) || ostatni.length > 25, `bez dzielenia nazw własnych: ${ostatni}`);
        const dalej = linie[i + 1].t.trim().split(/\s+/)[0].replace(/[.,]$/, '');
        assert.ok(dalej.length >= 3, `co najmniej 3 litery przeniesione: ${dalej}`);
      }
    }
    assert.ok(!linie.at(-2).l || linie.at(-1).t.trim().split(/\s+/).length > 1, 'ostatni wyraz akapitu niedzielony');
  }
  assert.ok(uklady.some((linie) => linie.some((x) => x.l)), 'dzielenie w ogóle działa');
  assert.deepEqual(bledy, []);
});

// #323 etap C: tytuł nie zostaje sam na końcu ramki; krótki ostatni wiersz akapitu w uwagach.
test('polskie zasady składu: tytuł przechodzi z następnym akapitem, zawieszka w uwagach', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Tytuły');
  const wynik = await strona.evaluate(async () => {
    const { tytulZNastepnym, akapitTytulem } = await import('./js/watki.js');
    const { uwagiLamania } = await import('./js/zasady-skladu.js');
    const { edytor } = window.seriodruk;
    const tekst = `Pierwszy akapit z kilkoma słowami treści.\nRozdział drugi\n${'Treść rozdziału drugiego płynie dalej. '.repeat(3)}`;
    const o = edytor.dodajTekst(tekst);
    o.set({ width: 60, fontSize: 3, zasady_pl: true });
    const start = tekst.indexOf('Rozdział');
    o.setSelectionStyles({ fontWeight: 'bold', fontSize: 4.5 }, start, start + 'Rozdział drugi'.length);
    o.initDimensions();
    const akapit = (i) => o._styleMap[i].line;
    const poTytule = o._textLines.findIndex((_, i) => akapit(i) === 2); // pierwszy wiersz treści
    const tytulOd = o._textLines.findIndex((_, i) => akapit(i) === 1);
    const z = edytor.dodajTekst('Akapit, który kończy się bardzo krótkim wyrazem na samym końcu akapitu w.\nDrugi.');
    z.set({ width: 40, fontSize: 3, spojniki: undefined, zasady_pl: undefined });
    z.initDimensions();
    return { tytul: akapitTytulem(o, 1), zwykly: akapitTytulem(o, 0), granica: tytulZNastepnym(o, poTytule), tytulOd, poTytule, uwagi: uwagiLamania(z).map((u) => u.powod) };
  });
  assert.equal(wynik.tytul, true);
  assert.equal(wynik.zwykly, false);
  assert.equal(wynik.granica, wynik.tytulOd, 'granica ramki cofa się przed tytuł');
  assert.deepEqual(bledy, []);
});

// #323 etap D: justowanie z polskimi zasadami – odstępy mogą się lekko ścisnąć (mniej luźnych wierszy), nic nie wystaje.
test('polskie zasady składu: justowanie ściska odstępy do 20%, wiersze nie wystają', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Justowanie');
  const w = await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    const tekst = 'Polskie zasady składu pozwalają lekko ścisnąć odstępy między wyrazami w justowanym akapicie, dzięki czemu wiersze są równiejsze i nie ma w nich wielkich dziur. '.repeat(3);
    const wyniki = [];
    for (const zasady of [false, true]) {
      const o = edytor.dodajTekst(tekst);
      o.set({ width: 55, fontSize: 3, textAlign: 'justify', zasady_pl: zasady || undefined, spojniki: true });
      o.initDimensions();
      const szer = o._textLines.map((_, i) => o.getLineWidth(i));
      const maxSzer = Math.max(...o._textLines.map((l, i) => (o.isEndOfWrapping(i) ? 0 : szer[i])));
      const ostatnie = o._textLines.map((_, i) => i).filter((i) => o.isEndOfWrapping(i)).map((i) => szer[i]);
      wyniki.push({ wiersze: o._textLines.length, maxSzer, ostatnie, w: o.width });
      edytor.canvas.remove(o);
    }
    return wyniki;
  });
  const [bez, z] = w;
  assert.ok(z.wiersze <= bez.wiersze, `ściskanie nie dodaje wierszy (${z.wiersze} / ${bez.wiersze})`);
  for (const ost of z.ostatnie) assert.ok(ost <= z.w + 0.01, 'ostatni wiersz akapitu nie wystaje');
  assert.ok(z.maxSzer <= z.w + 0.05, `justowane wiersze mają szerokość ramki (${z.maxSzer.toFixed(2)} / ${z.w})`);
  assert.deepEqual(bledy, []);
});

// #326: łamanie całego akapitu naraz – równiejsze odstępy niż wiersz po wierszu, zasady dalej twarde, treść bez zmian.
test('łamanie całego akapitu: równiejsze wiersze, zasady zachowane, nic nie wystaje', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Akapit');
  const w = await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    await (await import('./js/dzielenie.js')).zaladujDzielenie();
    const tekst = 'W dawnych drukarniach zecer składał każdy wiersz z osobna, a dobry zecer patrzył też na wiersze następne, żeby w akapicie nie było dziur i rzek z odstępów. Program, który dobiera wiersze całego akapitu razem, robi to samo w ułamku sekundy i z ul. Długiej do ok. 5 km dalej – bez wyjątków.';
    const wyniki = [];
    for (const szer of [45, 52, 60, 70, 85]) {
      for (const akapit of [false, true]) {
        const o = edytor.dodajTekst(tekst);
        o.set({ width: szer, fontSize: 3, textAlign: 'justify', dziel_wyrazy: true, zasady_pl: true, spojniki: true, lamanie_akapitu: akapit || undefined });
        o.initDimensions();
        // nierówność: suma kwadratów wydłużenia odstępów (luz / suma spacji) w wierszach poza ostatnim
        let nierownosc = 0;
        let suma = 0;
        let maxSzer = 0;
        o._textLines.forEach((l, i) => {
          suma += l.length + o.missingNewlineOffset(i);
          if (o.isEndOfWrapping(i)) return;
          const tekstW = l.join('');
          const spacje = (tekstW.match(/ /g) || []).length;
          const nat = o.measureLine(i).width; // przed rozciągnięciem odstępów
          maxSzer = Math.max(maxSzer, nat);
          if (spacje) nierownosc += ((szer - nat) / (spacje * 0.75)) ** 2;
        });
        wyniki.push({
          szer, akapit, nierownosc, maxSzer, zgodne: suma - 1 === o.text.length,
          konce: o._textLines.filter((_, i) => !o.isEndOfWrapping(i)).map((l) => l.join('').trim().split(/\s+/).at(-1)),
          poczatki: o._textLines.slice(1).map((l) => l.join('').trim().split(/\s+/)[0]),
          laczniki: o._textLines.filter((l) => l.lacznik).length,
        });
        edytor.canvas.remove(o);
      }
    }
    return wyniki;
  });
  let wiersz = 0; let akapit = 0;
  for (const r of w) {
    assert.ok(r.zgodne, `treść i kursor bez zmian (${r.szer} mm, akapit: ${r.akapit})`);
    for (const k of r.konce) assert.ok(!/^(a|i|o|u|w|z|ul\.|ok\.)$/i.test(k), `zasady: „${k}” nie zostaje na końcu wiersza`);
    for (const p of r.poczatki) assert.ok(!/^[–—]/.test(p), 'myślnik nie zaczyna wiersza');
    assert.ok(r.maxSzer <= r.szer * 1.03, `wiersz nie wystaje poza ramkę ponad ścisk odstępów (${r.maxSzer.toFixed(2)} / ${r.szer})`);
    if (r.akapit) akapit += r.nierownosc; else wiersz += r.nierownosc;
  }
  assert.ok(akapit < wiersz, `odstępy równiejsze przy łamaniu akapitu (${akapit.toFixed(2)} < ${wiersz.toFixed(2)})`);
  assert.deepEqual(bledy, []);
});

// #327: wyrównanie łamów – ramki na lewej i prawej stronie rozkładówki kończą się na tej samej wysokości.
test('wyrównanie łamów: lewa i prawa ramka rozkładówki mają równą wysokość tekstu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Łamy');
  const w = await strona.evaluate(async () => {
    const { rozlej } = await import('./js/watki.js');
    const { edytor } = window.seriodruk;
    const akapit = 'Treść rozdziału płynie przez kolejne strony książki, a wiersze układają się równo jeden pod drugim. ';
    const wysokosci = (r) => { const n = r._textLines.length; let h = 0; for (let i = 0; i < n; i += 1) h += i === n - 1 ? r.getHeightOfLine(i) / r.lineHeight : r.getHeightOfLine(i); return h; };
    const uloz = (boki, n) => {
      const ramki = [0, 1, 2].map((i) => {
        const o = edytor.dodajTekst('');
        o.set({ width: 60, fontSize: 3, watek: 'w1', watek_nr: i, ramka_h: 40, zasady_pl: true, wdowy: 2 });
        return o;
      });
      ramki.forEach((o, i) => { o._bok = boki[i]; }); // po utworzeniu wszystkich (edytor ustawia bok według strony)
      // Tytuł wypada na końcu pierwszej ramki – przechodzi z następnym akapitem, więc ta ramka jest krótsza.
      const tytul = 'Rozdział drugi';
      const tekst = `${akapit.repeat(n).trim()}\n${tytul}\n${akapit.repeat(14).trim()}`;
      ramki[0].text = tekst;
      const start = tekst.indexOf(tytul);
      ramki[0].setSelectionStyles({ fontWeight: 'bold' }, start, start + tytul.length);
      ramki[0].initDimensions();
      rozlej(ramki);
      const r = { h: ramki.map(wysokosci), wiersz: ramki[0].getHeightOfLine(0), teksty: ramki.map((x) => x.text) };
      ramki.forEach((x) => edytor.canvas.remove(x));
      return r;
    };
    // długość pierwszego akapitu, przy której tytuł trafia na koniec pierwszej ramki
    let n = 1;
    for (; n < 20; n += 1) { const r = uloz([], n); if (Math.abs(r.h[0] - r.h[1]) > r.wiersz * 0.5) break; }
    const wynik = [uloz([], n), uloz(['lewa', 'prawa', 'lewa'], n)];
    return wynik;
  });
  const [bez, z] = w;
  assert.ok(Math.abs(bez.h[0] - bez.h[1]) > bez.wiersz * 0.5, `bez stron rozkładówki ramki mają różną wysokość (${bez.h.map((x) => x.toFixed(1))})`);
  assert.ok(Math.abs(z.h[0] - z.h[1]) < z.wiersz * 0.5, `lewa i prawa – równa wysokość tekstu (${z.h.map((x) => x.toFixed(1))})`);
  assert.equal(z.teksty.join('\n').replace(/\s+/g, ' '), bez.teksty.join('\n').replace(/\s+/g, ' '), 'treść ta sama, tylko inaczej rozłożona');
  assert.deepEqual(bledy, []);
});
