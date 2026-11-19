// Strona lewa ↔ prawa w rozkładówkach (zgłoszenie 19.11: „żeby układ miał prawo/lewo i sam przeskakiwał po dodaniu
// strony, a elementy same wiedziały, co i jak”, js/boki-stron.js): strona pamięta bok, dla którego ułożono elementy;
// po wstawieniu strony przed nią przechodzi na drugi bok i jej układ odbija się względem środka strony – numer przy
// zewnętrznej krawędzi zostaje przy zewnętrznej (z wyrównaniem), ramka tekstu w marginesach trafia w nowe marginesy
// (wewnętrzny 20 mm, zewnętrzny 10 mm), element ze „stałą pozycją” zostaje. Strony nieotwarte w edytorze rysują się
// na nowym boku przy składaniu (podgląd, druk); otwarta w edytorze – zapis przechodzi na nowy bok.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('wstawienie strony przenosi układ następnych stron na lustrzane miejsca', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1400, height: 900 } });
  await nowyProjekt(strona, 'Boki');
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    const s = p.sekcje[0];
    s.uklad = 'rozkladowki';
    s.wydruk.szerokosc_mm = 148; s.wydruk.wysokosc_mm = 210;
    s.wydruk.marginesy = { gora: 15, dol: 15, wewnetrzny: 20, zewnetrzny: 10 };
    for (let i = 2; i <= 4; i += 1) p.strony.push(P.nowaStrona(`S${i}`, s.id));
    // Strona 2 – lewa: numer przy zewnętrznej (lewej) krawędzi, ramka tekstu w marginesach (10..128), stały element.
    p.strony[1].obiekty = [
      { type: 'textbox', id: 'numer', left: 10, top: 195, width: 20, height: 6, text: '2', textAlign: 'left', originX: 'left', originY: 'top', fontSize: 4 },
      { type: 'textbox', id: 'tresc', left: 10, top: 15, width: 118, height: 100, text: 'Treść', textAlign: 'left', originX: 'left', originY: 'top', fontSize: 4 },
      { type: 'rect', id: 'staly', left: 5, top: 5, width: 10, height: 10, fill: '#c0392b', originX: 'left', originY: 'top', stala_pozycja: true },
    ];
    // Strona 3 – prawa: kwadrat przy zewnętrznej (prawej) krawędzi.
    p.strony[2].obiekty = [{ type: 'rect', id: 'kw', left: 128, top: 20, width: 10, height: 10, fill: '#2980b9', originX: 'left', originY: 'top' }];
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  });
  await strona.waitForFunction(() => window.seriodruk.edytor?.wydruk);
  const boki = await strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => s.bok_ukladu || null));
  assert.deepEqual(boki, ['prawa', 'lewa', 'prawa', 'lewa'], 'boki zapamiętane przy otwarciu');

  // Nowa strona przed stroną 2 – strona 2 przechodzi na prawą, strona 3 na lewą.
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const { stan } = await import('./js/app/kontekst.js');
    const p = stan.projekt;
    p.strony.splice(1, 0, P.nowaStrona('Nowa', p.sekcje[0].id));
    stan.indeks = 2; // dawna strona 2
    await window.seriodruk.przeladuj();
  });
  const w = await strona.evaluate(async () => {
    const { obiektyZSasiadem } = await import('./js/zlozenie.js');
    const { rozwin } = await import('./js/serie.js');
    const p = window.seriodruk.stan.projekt;
    const s2 = p.strony[2];
    const s3 = p.strony[3];
    const c = rozwin(p);
    const kw = obiektyZSasiadem(p, c.pierwszy.get(s3.id), c).find((o) => o.id === 'kw');
    return { bok: s2.bok_ukladu, obiekty: Object.fromEntries(s2.obiekty.map((o) => [o.id, { left: o.left, textAlign: o.textAlign }])), kw: kw.left, bok3: s3.bok_ukladu };
  });
  assert.equal(w.bok, 'prawa', 'otwarta strona przeszła na nowy bok');
  assert.deepEqual(w.obiekty.numer, { left: 118, textAlign: 'right' }, 'numer przy zewnętrznej (prawej) krawędzi, wyrównany do niej');
  assert.deepEqual(w.obiekty.tresc, { left: 20, textAlign: 'left' }, 'ramka tekstu od wewnętrznego marginesu 20 mm, szeroki tekst bez zmiany wyrównania');
  assert.equal(w.obiekty.staly.left, 5, 'stała pozycja zostaje');
  assert.equal(w.kw, 10, 'strona nieotwarta rysuje się na nowym boku: kwadrat przy zewnętrznej (lewej) krawędzi');
  assert.equal(w.bok3, 'prawa', 'strona nieotwarta – zapis bez zmian do pierwszego otwarcia');
  assert.deepEqual(bledy, []);
});
