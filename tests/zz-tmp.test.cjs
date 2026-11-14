const test = require('node:test');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const S = '/tmp/claude-0/-home-user-book/c7489e9c-f7c8-52f9-8669-f2a79a7c09c7/scratchpad';

test('x', async (t) => {
  const { strona } = await otworz(t);
  await nowyProjekt(strona, 'X');
  const r = await strona.evaluate(async () => {
    const { edytor } = window.seriodruk;
    await (await import('./js/dzielenie.js')).dzielenieGotowe;
    const tekst = 'Przedsiębiorstwo telekomunikacyjne przygotowało niezapominajkowe kalendarze z przepięknymi ilustracjami i kolorowymi zakładkami dla wszystkich czytelników w całym kraju.\nDrugi akapit tekstu do sprawdzenia justowania.';
    const a = edytor.dodajTekst(tekst);
    a.set({ left: 10, top: 10, width: 60, textAlign: 'justify' });
    a.initDimensions();
    const ost = a._textLines.length - 1;
    const wynik = { zwykly: [a.getLineWidth(ost), a.width, a.__charBounds[ost].at(-1).left] };
    const b = edytor.dodajTekst(tekst);
    b.set({ left: 75, top: 10, width: 60, textAlign: 'justify', dziel_wyrazy: true, inicjal: 3, inicjal_kolor: '#b45309' });
    b.initDimensions();
    const c = edytor.dodajTekst('Styczeń\t12\nLuty\t7\nMarzec\t123');
    c.set({ left: 10, top: 90, width: 80, tabulatory: [{ poz: 70, rodzaj: 'prawy', wypelniacz: '.' }] });
    c.initDimensions();
    const d = edytor.dodajTekst(`${'Tekst opływa zdjęcie dookoła. '.repeat(14)}`);
    d.set({ left: 10, top: 120, width: 120, textAlign: 'justify', dziel_wyrazy: true });
    const e = edytor.dodajElipse ? edytor.dodajElipse() : null;
    if (e) { e.set({ left: 50, top: 125, width: 35, height: 35, rx: 17.5, ry: 17.5, oblewanie: 'ksztalt', oblewanie_odstep: 2 }); e.setCoords(); }
    edytor.ulozSkladStrony({ teraz: true });
    edytor.canvas.discardActiveObject();
    edytor.canvas.requestRenderAll();
    return wynik;
  });
  console.log('JUSTIFY', JSON.stringify(r));
  await strona.waitForTimeout(600);
  await strona.screenshot({ path: `${S}/sklad-1.png` });
});
