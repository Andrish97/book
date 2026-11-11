const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const DLUGI = 'Pierwsze zdanie tekstu, które jest dość długie. Drugie zdanie idzie zaraz po nim i też zajmuje sporo miejsca.\nNowy akapit zaczyna się tutaj i ciągnie przez kilka wierszy, żeby było co przelewać między ramkami.\nTrzeci akapit kończy całość.';

// Ramki wątku na płótnie i w pamięci edytora (z innych stron), w kolejności czytania.
const watek = (strona) => strona.evaluate(() => {
  const e = window.seriodruk.edytor;
  const naPlotnie = e.canvas.getObjects().filter((o) => o.watek);
  const ramki = [...naPlotnie, ...e._poza.map((p) => p.o)].sort((a, b) => a.watek_nr - b.watek_nr);
  let caly = '';
  let poczatki = [];
  for (const r of ramki) { if (r.text) { caly += (caly ? (r.lacznik ?? '\n') : ''); } poczatki.push(caly.length); caly += r.text; }
  const pisze = ramki.findIndex((r) => r.isEditing);
  return {
    caly, czesci: ramki.map((r) => r.text), laczniki: ramki.map((r) => r.lacznik), pisze,
    kursor: pisze < 0 ? null : poczatki[pisze] + ramki[pisze]._text.slice(0, ramki[pisze].selectionStart).join('').length,
    lokalny: pisze < 0 ? null : ramki[pisze].selectionStart,
  };
});

test('połączone ramki: Backspace, Delete i strzałki na granicy ramek działają jak w jednym tekście', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Granica ramek');
  await strona.evaluate((tekst) => {
    const e = window.seriodruk.edytor;
    const o = e.dodajTekst(tekst);
    o.set({ left: 15, top: 20, width: 60, ramka_h: 14 });
    o.initDimensions();
    e.zatwierdz();
  }, DLUGI);
  await strona.click('.wlasciwosci button:has-text("Dodaj ramkę z ciągiem dalszym")');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.watek).length === 2);
  let w = await watek(strona);
  assert.equal(w.caly, DLUGI);
  const granica = w.czesci[0].length; // miejsce w sklejonym tekście, w którym kończy się pierwsza ramka
  assert.equal(w.laczniki[1], ' ', 'ramki dzieli spacja między słowami');

  // Strzałka w prawo na końcu pierwszej ramki przechodzi na początek drugiej; w lewo – wraca na koniec pierwszej.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const a = e.canvas.getObjects().find((o) => o.watek_nr === 0); e.canvas.setActiveObject(a); a.enterEditing(); });
  await strona.keyboard.press('Control+End');
  await strona.keyboard.press('ArrowRight');
  w = await watek(strona);
  assert.deepEqual([w.pisze, w.lokalny], [1, 0], 'pisanie przeszło na początek drugiej ramki');
  await strona.keyboard.press('ArrowLeft');
  w = await watek(strona);
  assert.deepEqual([w.pisze, w.lokalny], [0, w.czesci[0].length], 'i wróciło na koniec pierwszej');

  // Backspace na początku drugiej ramki usuwa odstęp między częściami – słowa się sklejają, kursor stoi w miejscu sklejenia.
  await strona.keyboard.press('ArrowRight');
  await strona.keyboard.press('Backspace');
  w = await watek(strona);
  const bezOdstepu = DLUGI.slice(0, granica) + DLUGI.slice(granica + 1);
  assert.equal(w.caly, bezOdstepu, 'zniknął jeden znak: odstęp na granicy ramek');
  assert.equal(w.kursor, granica, 'kursor stoi tam, gdzie usunięto znak');
  assert.ok(w.pisze >= 0, 'pisanie trwa');
  // Kolejny Backspace usuwa literę przed kursorem, wpisany znak ląduje w tym samym miejscu.
  await strona.keyboard.press('Backspace');
  w = await watek(strona);
  assert.equal(w.caly, DLUGI.slice(0, granica - 1) + DLUGI.slice(granica + 1));
  assert.equal(w.kursor, granica - 1);
  await strona.keyboard.type(`${DLUGI[granica - 1]} `);
  w = await watek(strona);
  assert.equal(w.caly, DLUGI, 'po dopisaniu usuniętych znaków tekst jest jak na początku');
  assert.equal(w.kursor, granica + 1);

  // Delete na końcu pierwszej ramki usuwa znak zza kursora: najpierw odstęp, potem pierwszą literę następnej części.
  await strona.keyboard.press('Escape');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const a = e.canvas.getObjects().find((o) => o.watek_nr === 0); e.canvas.setActiveObject(a); a.enterEditing(); });
  await strona.keyboard.press('Control+End');
  w = await watek(strona);
  const koniec = w.czesci[0].length;
  await strona.keyboard.press('Delete');
  w = await watek(strona);
  assert.equal(w.caly, DLUGI.slice(0, koniec) + DLUGI.slice(koniec + 1));
  assert.equal(w.kursor, koniec, 'kursor nie ruszył się z miejsca');
  await strona.keyboard.press('Escape');
  assert.deepEqual(bledy, []);
});

test('tekst przez strony: po przestawieniu stron tekst płynie w nowej kolejności stron; Backspace sięga do ramki na innej stronie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kolejność stron');
  const proj = () => strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => ({ nazwa: s.nazwa, ramki: s.obiekty.filter((o) => o.type === 'textbox').map((o) => ({ tekst: o.text, nr: o.watek_nr, lacznik: o.lacznik })) })));
  const caly = (strony) => strony.flatMap((s) => s.ramki).sort((a, b) => a.nr - b.nr).map((r, i) => (i ? (r.lacznik ?? '\n') : '') + r.tekst).join('');
  await strona.evaluate((tekst) => {
    const e = window.seriodruk.edytor;
    const o = e.dodajTekst(tekst);
    o.set({ left: 15, top: 20, width: 60, ramka_h: 14 });
    o.initDimensions();
    e.zatwierdz();
  }, DLUGI);
  await strona.click('.wlasciwosci button:has-text("Ciąg dalszy na następnej stronie")');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2 && window.seriodruk.stan.indeks === 1 && window.seriodruk.edytor.aktywny?.watek_nr === 1);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  let p = await proj();
  assert.deepEqual(p.map((s) => s.ramki[0].nr), [0, 1]);
  assert.equal(caly(p), DLUGI);
  const naPierwszej = p[0].ramki[0].tekst;

  // Backspace na początku ramki na drugiej stronie: znika odstęp między stronami, słowa z obu stron sklejają się w jedno.
  await strona.evaluate(() => window.seriodruk.edytor.aktywny.enterEditing());
  await strona.keyboard.press('Control+Home');
  await strona.keyboard.press('Backspace');
  // Kursor stoi w miejscu sklejenia – jeśli to miejsce jest w ramce na pierwszej stronie, aplikacja ją otwiera.
  await strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.isEditing);
  const w = await watek(strona);
  assert.equal(w.caly, DLUGI.slice(0, naPierwszej.length) + DLUGI.slice(naPierwszej.length + 1), 'zniknął odstęp między stronami');
  assert.equal(w.kursor, naPierwszej.length, 'kursor przy usuniętym znaku');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.indeks), w.pisze, 'otwarta jest strona z ramką, w której stoi kursor');
  await strona.keyboard.type(' ');
  await strona.keyboard.press('Escape');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  p = await proj();
  assert.equal(caly(p), DLUGI, 'po dopisaniu odstępu tekst jest cały');

  // Druga strona przesunięta przed pierwszą: jej ramka dostaje początek tekstu, a dawna pierwsza – ciąg dalszy.
  await strona.waitForTimeout(450); // dotychczasowe zmiany to osobny krok historii
  await strona.click('#lista-stron li.strona >> nth=1 >> .menu-miniatury');
  await strona.click('#menu-strony [data-akcja="strona-gora"]');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].nazwa === 'Strona 2');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].obiekty[0]?.watek_nr === 0);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  p = await proj();
  assert.deepEqual(p.map((s) => s.nazwa), ['Strona 2', 'Strona 1']);
  assert.deepEqual(p.map((s) => s.ramki[0].nr), [0, 1], 'numery ramek idą za kolejnością stron');
  assert.ok(p[0].ramki[0].tekst.startsWith('Pierwsze zdanie'), 'początek tekstu jest teraz na pierwszej stronie w kolejności');
  assert.ok(p[1].ramki[0].tekst.length > 0, 'ciąg dalszy płynie na następną stronę');
  assert.equal(caly(p), DLUGI, 'tekst jest cały i w tej samej kolejności czytania');
  // Płótno pokazuje nowy podział (nie nadpisuje go starą treścią przy zapisie).
  const naPlotnie = await strona.evaluate(() => { const e = window.seriodruk.edytor; const s = window.seriodruk.stan; return [s.projekt.strony[s.indeks].nazwa, e.canvas.getObjects().find((o) => o.watek).text]; });
  assert.equal(naPlotnie[1], p.find((s) => s.nazwa === naPlotnie[0]).ramki[0].tekst);
  // Cofnięcie przywraca dawną kolejność stron razem z dawnym podziałem tekstu.
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].nazwa === 'Strona 1');
  p = await proj();
  assert.deepEqual(p.map((s) => s.ramki[0].nr), [0, 1]);
  assert.equal(caly(p), DLUGI);
  assert.deepEqual(bledy, []);
});

test('tekst przez strony: kursor idzie za tekstem na następną stronę i wraca strzałkami; znaki pisane w trakcie przejścia nie giną; cofanie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kursor przez strony');
  const proj = () => strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => s.obiekty.filter((o) => o.type === 'textbox').map((o) => ({ tekst: o.text, nr: o.watek_nr, lacznik: o.lacznik }))));
  const caly = (strony) => strony.flat().sort((a, b) => a.nr - b.nr).map((r, i) => (i ? (r.lacznik ?? '\n') : '') + r.tekst).join('');
  const pisze = () => strona.waitForFunction(() => window.seriodruk.edytor.aktywny?.isEditing);
  const gdzie = async () => { await pisze(); return { ...(await watek(strona)), strona: await strona.evaluate(() => window.seriodruk.stan.indeks) }; };
  await strona.evaluate((tekst) => {
    const e = window.seriodruk.edytor;
    const o = e.dodajTekst(tekst);
    o.set({ left: 15, top: 20, width: 60, ramka_h: 14 });
    o.initDimensions();
    e.zatwierdz();
  }, DLUGI);
  await strona.click('.wlasciwosci button:has-text("Ciąg dalszy na następnej stronie")');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony.length === 2 && window.seriodruk.stan.indeks === 1 && window.seriodruk.edytor.aktywny?.watek_nr === 1);
  await strona.click('.wlasciwosci button:has-text("Poprzednia ramka: strona 1")');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0 && window.seriodruk.edytor.aktywny?.watek_nr === 0);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await strona.waitForTimeout(450); // dotychczasowe zmiany to osobny krok historii
  const n1 = (await proj())[0][0].tekst.length;

  // Pisanie na końcu ramki na pierwszej stronie: słowa, które się nie mieszczą, płyną na drugą stronę,
  // a aplikacja otwiera ją i pisanie idzie dalej – także dla znaków wciśniętych, zanim strona się wczytała.
  await strona.evaluate(() => window.seriodruk.edytor.aktywny.enterEditing());
  await strona.keyboard.press('Control+End');
  const DOPISANE = ' Dopisane zdanie, które nie mieści się już w pierwszej ramce i płynie dalej.';
  await strona.keyboard.type(DOPISANE);
  let w = await gdzie();
  const POTEM = DLUGI.slice(0, n1) + DOPISANE + DLUGI.slice(n1);
  assert.equal(w.caly, POTEM, 'żaden znak nie zginął ani się nie podwoił');
  assert.deepEqual([w.strona, w.pisze], [1, 1], 'otwarta jest druga strona, pisanie trwa w jej ramce');
  assert.equal(w.kursor, n1 + DOPISANE.length, 'kursor stoi za dopisanym tekstem');
  assert.match(await strona.textContent('#powiadomienie'), /^Tekst płynie dalej na stronie 2 /);

  // Strzałka w lewo na początku ramki wraca na pierwszą stronę (kursor na końcu jej ramki), w prawo – z powrotem.
  await strona.keyboard.press('Control+Home');
  await strona.keyboard.press('ArrowLeft');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0);
  w = await gdzie();
  assert.deepEqual([w.strona, w.pisze, w.lokalny], [0, 0, w.czesci[0].length]);
  await strona.keyboard.press('ArrowRight');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  w = await gdzie();
  assert.deepEqual([w.strona, w.pisze, w.lokalny], [1, 1, 0]);
  assert.equal(w.caly, POTEM, 'przechodzenie strzałkami niczego nie zmienia');

  // Backspace kasuje wstecz przez granicę stron; gdy kursor trafia do ramki na pierwszej stronie, aplikacja ją otwiera.
  const przed = w.kursor;
  for (let i = 0; i < 12; i += 1) { await strona.keyboard.press('Backspace'); await pisze(); }
  w = await gdzie();
  assert.equal(w.caly.length, POTEM.length - 12, 'zniknęło dokładnie dwanaście znaków');
  assert.equal(w.caly, POTEM.slice(0, w.kursor) + POTEM.slice(w.kursor + 12), 'zniknęły znaki sprzed kursora');
  assert.ok(w.kursor <= przed && w.kursor >= przed - 12, `kursor cofnął się razem z kasowaniem: ${w.kursor} / ${przed}`);
  assert.equal(w.strona, w.pisze, 'otwarta jest strona z ramką, w której stoi kursor');
  const POKASOWANIU = w.caly;
  await strona.keyboard.press('Escape');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.equal(caly(await proj()), POKASOWANIU, 'zapis ma ten sam tekst co ekran');

  // Cofanie: każdy krok to cały tekst w jednym z wcześniejszych stanów (nic w połowie), a na końcu tekst wyjściowy.
  await strona.waitForTimeout(450);
  const stany = [];
  for (let i = 0; i < 8; i += 1) {
    if (await strona.evaluate(() => document.querySelector('[data-akcja="cofnij"]').disabled)) break;
    await strona.click('[data-akcja="cofnij"]');
    await strona.waitForTimeout(250);
    stany.push(caly(await proj()));
    if (stany.at(-1) === DLUGI) break;
  }
  assert.equal(stany.at(-1), DLUGI, `cofanie wraca do tekstu wyjściowego: ${JSON.stringify(stany.map((s) => s.length))}`);
  for (const s of stany) assert.ok(s === DLUGI || (s.startsWith(DLUGI.slice(0, 40)) && s.endsWith(DLUGI.slice(-40)) && s.length >= DLUGI.length - 12 && s.length <= POTEM.length), `stan pośredni jest całym tekstem (${s.length} znaków)`);
  assert.deepEqual(bledy, []);
});

test('autodopasowanie: fragment z własnym rozmiarem czcionki maleje razem z resztą i wraca do swojego rozmiaru', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Autodopasowanie');
  const PT = 25.4 / 72;
  const stan = () => strona.evaluate(() => {
    const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'textbox');
    const zapis = o.toObject();
    return {
      rozmiar: o.fontSize, bazowy: o.rozmiar_bazowy, miesci: (o._wysokoscTresci ?? 0) <= o.ramka_h + 0.05,
      naEkranie: o.getCompleteStyleDeclaration(0, 2).fontSize, zwykly: o.getCompleteStyleDeclaration(0, 12).fontSize,
      wZapisie: zapis.styles.map((s) => [s.start, s.end, s.style.fontSize]),
    };
  });
  await strona.evaluate((pt) => {
    const e = window.seriodruk.edytor;
    const o = e.dodajTekst('Duży tytuł i dłuższy opis, który przy tej wysokości ramki nie mieści się w zadanym rozmiarze pisma i musi zmaleć.');
    o.set({ left: 15, top: 20, width: 70, fontSize: 12 * pt });
    o.setSelectionStyles({ fontSize: 24 * pt }, 0, 10); // „Duży tytuł” dwa razy większy od reszty
    o.initDimensions();
    e.zatwierdz();
  }, PT);
  await strona.check('#wlasciwosci label:has-text("Stała wysokość ramki") input');
  await strona.fill('#wlasciwosci label:has-text("Wysokość ramki") input:not([type=checkbox])', '22');
  await strona.press('#wlasciwosci label:has-text("Wysokość ramki") input:not([type=checkbox])', 'Tab');
  let s = await stan();
  assert.ok(!s.miesci, 'bez autodopasowania tekst wystaje');
  await strona.check('#wlasciwosci label:has-text("Zmniejszaj tekst") input');
  s = await stan();
  assert.ok(s.miesci, 'tekst zmieścił się w ramce');
  assert.ok(s.rozmiar < s.bazowy * 0.95, `cały tekst zmalał: ${s.rozmiar} < ${s.bazowy}`);
  const skala = s.rozmiar / s.bazowy;
  assert.ok(Math.abs(s.naEkranie - 24 * PT * skala) < 0.001, `fragment zmalał w tej samej proporcji: ${s.naEkranie} ≈ ${24 * PT * skala}`);
  assert.ok(Math.abs(s.naEkranie / s.zwykly - 2) < 0.001, 'fragment jest nadal dwa razy większy od reszty');
  assert.ok(Math.abs(s.wZapisie[0][2] - 24 * PT) < 0.001, 'w zapisie fragment trzyma rozmiar zadany (24 pt)');
  // Zmiana koloru fragmentu przy zmniejszonym tekście nie psuje jego zapisanego rozmiaru.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.aktywny; o.setSelectionStyles({ fill: '#c00000' }, 0, 4); o.initDimensions(); e.zatwierdz(); });
  s = await stan();
  assert.ok(s.wZapisie.every((x) => Math.abs(x[2] - 24 * PT) < 0.001), `rozmiar zadany fragmentu bez zmian: ${JSON.stringify(s.wZapisie)}`);
  // Wyższa ramka: tekst wraca do rozmiaru zadanego, fragment do swoich 24 pt.
  await strona.fill('#wlasciwosci label:has-text("Wysokość ramki") input:not([type=checkbox])', '120');
  await strona.press('#wlasciwosci label:has-text("Wysokość ramki") input:not([type=checkbox])', 'Tab');
  s = await stan();
  assert.ok(Math.abs(s.rozmiar - s.bazowy) < 0.001);
  assert.ok(Math.abs(s.naEkranie - 24 * PT) < 0.001, 'fragment wrócił do 24 pt');
  assert.deepEqual(bledy, []);
});

test('prowadnice: zmiany są krokami cofania; zablokowanych nie da się przesunąć myszą', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Prowadnice');
  // Położenia zaokrąglone do milimetra: przeciąganie myszą ustawia prowadnicę co 0,5 mm.
  const prowadnice = () => strona.evaluate(() => window.seriodruk.edytor.prowadnice.map((p) => [p.os, Math.round(p.poz)]));
  const krok = () => strona.waitForTimeout(450);
  const naEkranie = (x, y) => strona.evaluate(([mx, my]) => { const c = window.seriodruk.edytor.canvas; const v = c.viewportTransform; const r = c.upperCanvasEl.getBoundingClientRect(); return [r.left + mx * v[0] + v[4], r.top + my * v[3] + v[5]]; }, [x, y]);
  const przeciagnij = async (z, na) => { await strona.mouse.move(...(await naEkranie(...z))); await strona.mouse.down(); await strona.mouse.move(...(await naEkranie(...na)), { steps: 5 }); await strona.mouse.up(); };

  // Dodanie, przesunięcie i usunięcie prowadnicy – każde cofa się osobno.
  await strona.evaluate(() => window.seriodruk.edytor.dodajProwadnice('x', 40));
  await krok();
  await przeciagnij([40, 100], [60, 100]);
  await krok();
  assert.deepEqual(await prowadnice(), [['x', 60]]);
  await strona.evaluate(() => window.seriodruk.edytor.ustawProwadnice(0, null));
  await krok();
  assert.deepEqual(await prowadnice(), []);
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.edytor.prowadnice.length === 1);
  assert.deepEqual(await prowadnice(), [['x', 60]], 'cofnięte usunięcie');
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.edytor.prowadnice[0]?.poz === 40);
  assert.deepEqual(await prowadnice(), [['x', 40]], 'cofnięte przesunięcie');
  await strona.keyboard.press('Control+z');
  await strona.waitForFunction(() => window.seriodruk.edytor.prowadnice.length === 0);
  await strona.keyboard.press('Control+Shift+z');
  await strona.waitForFunction(() => window.seriodruk.edytor.prowadnice.length === 1);
  assert.deepEqual(await prowadnice(), [['x', 40]], 'ponowione dodanie');

  // Blokada z menu przy płótnie: prowadnica zostaje na miejscu, ustawienie zapisuje się w projekcie.
  await strona.click('#przycisk-widok');
  await strona.check('#widok-blokada-prowadnic');
  await strona.keyboard.press('Escape');
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.widok.blokada_prowadnic), true);
  await przeciagnij([40, 100], [70, 100]);
  assert.deepEqual(await prowadnice(), [['x', 40]], 'zablokowana prowadnica nie dała się przesunąć');
  // Liczbą nadal da się ją ustawić; po odblokowaniu znów chodzi za myszą.
  await strona.evaluate(() => window.seriodruk.edytor.ustawProwadnice(0, 50));
  assert.deepEqual(await prowadnice(), [['x', 50]]);
  await strona.click('#przycisk-widok');
  await strona.uncheck('#widok-blokada-prowadnic');
  await strona.keyboard.press('Escape');
  await przeciagnij([50, 100], [70, 100]);
  assert.deepEqual(await prowadnice(), [['x', 70]]);
  assert.deepEqual(bledy, []);
});

test('warstwy: grupę da się rozwinąć – elementy grupy z okiem i własną nazwą; tabela rozwija się osobno (komórki)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Grupa w warstwach');
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    const a = e.dodajProstokat(); a.set({ left: 20, top: 20, width: 30, height: 20, fill: '#ff0000', nazwa: 'Czerwony' }); a.setCoords();
    const b = e.dodajElipse(); b.set({ left: 60, top: 20, fill: '#0000ff' }); b.setCoords();
    e.zaznaczWszystko();
    e.grupuj();
    e.dodajTabele({ wiersze: 2, kolumny: 2 });
    e.canvas.discardActiveObject();
    e.zatwierdz();
  });
  await strona.click('#zakladki-panelu label:has-text("Warstwy")');
  const wiersze = () => strona.evaluate(() => [...document.querySelectorAll('#lista-warstw li.warstwa')].map((li) => `${li.classList.contains('w-grupie') ? '  ' : ''}${li.querySelector('.warstwa-nazwa').textContent}${li.classList.contains('ukryta') ? ' (ukryty)' : ''}${li.querySelector('.warstwa-rozwin') ? ` [${li.querySelector('.warstwa-rozwin').getAttribute('aria-expanded')}]` : ''}`));
  assert.deepEqual(await wiersze(), ['Tabela 2×2 [false]', 'Grupa [false]'], 'grupa i tabela mają przycisk rozwijania');

  await strona.click('#lista-warstw li:has-text("Grupa") .warstwa-rozwin');
  assert.deepEqual(await wiersze(), ['Tabela 2×2 [false]', 'Grupa [true]', '  Elipsa', '  Czerwony'], 'elementy grupy od wierzchu');
  // Oko przy elemencie grupy ukrywa tylko jego; zapis grupy to pamięta.
  await strona.click('#lista-warstw li.w-grupie:has-text("Elipsa") .warstwa-oko');
  assert.deepEqual(await wiersze(), ['Tabela 2×2 [false]', 'Grupa [true]', '  Elipsa (ukryty)', '  Czerwony']);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  let grupa = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.type === 'group' && !o.tabela).objects.map((o) => [o.type, o.visible !== false, o.nazwa || null]));
  assert.deepEqual(grupa, [['rect', true, 'Czerwony'], ['ellipse', false, null]]);
  // Kliknięcie wiersza elementu otwiera grupę i zaznacza ten element; własna nazwa elementu grupy.
  await strona.click('#lista-warstw li.w-grupie:has-text("Czerwony") .warstwa-nazwa');
  assert.deepEqual(await strona.evaluate(() => { const e = window.seriodruk.edytor; return [e.aktywny?.type, e.otwartaGrupa?.type]; }), ['rect', 'group']);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.nazwijWGrupie(e.otwartaGrupa.id, 1, 'Kółko'); });
  assert.deepEqual(await wiersze(), ['Tabela 2×2 [false]', 'Grupa [true]', '  Kółko (ukryty)', '  Czerwony']);
  await strona.click('#lista-warstw li.w-grupie:has-text("Kółko") .warstwa-oko');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  grupa = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.type === 'group' && !o.tabela).objects.map((o) => [o.type, o.visible !== false, o.nazwa || null]));
  assert.deepEqual(grupa, [['rect', true, 'Czerwony'], ['ellipse', true, 'Kółko']]);
  await strona.click('#lista-warstw li:has-text("Grupa") .warstwa-rozwin');
  assert.deepEqual(await wiersze(), ['Tabela 2×2 [false]', 'Grupa [false]']);
  assert.deepEqual(bledy, []);
});

test('lista rozwijana: w długiej liście pisanie zawęża pozycje do zawierających fragment, bez polskich znaków', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Szukanie na liście');
  await strona.click('[data-akcja="dodaj-tekst"]');
  const czcionka = '.wlasciwosci label:has-text("Czcionka")';
  const widoczne = () => strona.evaluate(() => [...document.querySelectorAll('.wybor-lista .wybor-opcja')].filter((el) => !el.hidden).map((el) => el.textContent));
  await strona.focus(`${czcionka} .wybor-przycisk`);
  await strona.keyboard.press('ArrowDown');
  assert.equal((await widoczne()).length, 53, 'cały zestaw i wgrywanie własnej');
  assert.ok(await strona.isHidden('.wybor-filtr'));

  // Fragment ze środka nazwy.
  await strona.keyboard.type('garam');
  assert.deepEqual(await widoczne(), ['EB Garamond', 'Cormorant Garamond']);
  assert.equal(await strona.textContent('.wybor-filtr'), 'Szukaj: garam');
  // Backspace cofa po znaku; „g” jest w wielu nazwach.
  for (let i = 0; i < 4; i += 1) await strona.keyboard.press('Backspace');
  const zG = await widoczne();
  assert.ok(zG.length > 4 && zG.includes('Great Vibes') && zG.includes('EB Garamond') && !zG.includes('Inter'), `pozycje z „g”: ${zG}`);
  // Esc czyści szukanie (lista zostaje otwarta), dopiero drugi zamyka.
  await strona.keyboard.press('Escape');
  assert.equal((await widoczne()).length, 53);
  assert.equal(await strona.locator('.wybor-lista').count(), 1);
  // Bez polskich znaków i wielkości liter: „WLASNA” znajduje „własną”.
  await strona.keyboard.type('WLASNA');
  assert.deepEqual(await widoczne(), ['+ Wgraj własną czcionkę…']);
  await strona.keyboard.press('Escape');
  // Nic nie pasuje: komunikat, Enter niczego nie wybiera.
  await strona.keyboard.type('xyz');
  assert.deepEqual(await widoczne(), []);
  assert.match(await strona.textContent('.wybor-filtr'), /nic nie pasuje/);
  await strona.keyboard.press('Enter');
  assert.equal(await strona.locator('.wybor-lista').count(), 1);
  await strona.keyboard.press('Escape');
  // Strzałki chodzą po zawężonej liście, Enter wybiera.
  await strona.keyboard.type('weat');
  assert.deepEqual(await widoczne(), ['Merriweather']);
  await strona.keyboard.press('ArrowDown');
  await strona.keyboard.press('ArrowDown');
  await strona.keyboard.press('Enter');
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny.fontFamily), 'Merriweather');
  assert.equal(await strona.locator('.wybor-lista').count(), 0);

  // Krótka lista (wyrównanie w pionie, lista punktów itp.) działa jak dotąd: bez paska szukania, litera przeskakuje do pozycji.
  const lista = '.wlasciwosci label:has-text("Lista")';
  await strona.focus(`${lista} .wybor-przycisk`);
  await strona.keyboard.press('ArrowDown');
  assert.ok((await widoczne()).length <= 8);
  assert.equal(await strona.locator('.wybor-filtr').count(), 0);
  await strona.keyboard.type('n');
  assert.equal((await widoczne()).length, await strona.locator('.wybor-lista .wybor-opcja').count(), 'krótka lista się nie zawęża');
  await strona.keyboard.press('Escape');
  assert.deepEqual(bledy, []);
});
