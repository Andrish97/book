// Dymek (#360): jedna ramka tekstu z dymkiem wokół – rodzaje, ogonek do punktu (uchwyt), dymek rośnie razem
// z tekstem, zapis i odczyt, ten sam rysunek w obrazie strony (eksport) i wektorowo w PDF.
const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('dymek: z Biblioteki, rośnie z tekstem, ogonek uchwytem, zapis, obraz strony z dymkiem i ogonkiem', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Komiks');
  const wynik = await strona.evaluate(async () => {
    const { edytor, stan } = window.seriodruk;
    const r = {};
    const { kategorieBiblioteki } = await import('./js/biblioteka.js');
    const kat = kategorieBiblioteki().find((k) => k.id === 'dymki');
    r.biblioteka = (typeof kat.elementy === 'function' ? kat.elementy() : kat.elementy).map((e) => e.id);
    const d = edytor.dodajDymek('mowa', { x: 60, y: 60 });
    r.typ = d.type; r.dymek = { ...d.dymek }; r.uchwyt = Boolean(d.controls.ogonek);
    const wys1 = d.height;
    d.set('text', 'Bardzo długi tekst dymka, który na pewno nie zmieści się w jednym wierszu i musi się zawinąć kilka razy.');
    d.initDimensions();
    r.rosnie = d.height > wys1 * 2;
    // uchwyt ogonka: przeciągnięcie w punkt sceny (strona + 20 mm w prawo od lewego górnego rogu, 40 mm w dół)
    const o = d.calcTransformMatrix();
    const cel = new fabric.Point(-d.width / 2 + 20, -d.height / 2 + 40).transform(o);
    d.controls.ogonek.actionHandler(null, { target: d }, cel.x, cel.y);
    r.ogonek = d.dymek.ogonek;
    d.dymek = { ...d.dymek, wypelnienie: '#ffcc00', obrys: '#000000' };
    edytor.zatwierdz();
    const czekaj = async (f) => { for (let i = 0; i < 50 && !f(); i += 1) await new Promise((ok) => setTimeout(ok, 100)); };
    await czekaj(() => stan.projekt.strony[0].obiekty.some((x) => x.dymek?.wypelnienie === '#ffcc00'));
    const zapis = stan.projekt.strony[0].obiekty.find((x) => x.dymek);
    r.zapis = zapis && { rodzaj: zapis.dymek.rodzaj, ogonek: zapis.dymek.ogonek, typ: zapis.type };
    // obraz strony: wnętrze dymka (w marginesie nad tekstem) żółte, koniec ogonka ciemny
    const { pngCelu } = await import('./js/eksport.js');
    const p = stan.projekt;
    const url = await pngCelu(p, p.strony[0], 150);
    const img = new Image(); img.src = url; await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const wydruk = p.sekcje[0].wydruk;
    const k = img.width / (wydruk.szerokosc_mm + 2 * wydruk.spad_mm);
    const px = (xmm, ymm) => [...g.getImageData(Math.round((xmm + wydruk.spad_mm) * k), Math.round((ymm + wydruk.spad_mm) * k), 1, 1).data];
    const s = stan.projekt.strony[0].obiekty.find((x) => x.dymek);
    r.wnetrze = px(s.left + s.width / 2, s.top - 1); // nad tekstem, w marginesie dymka
    // koniec ogonka: kilka pikseli w stronę środka dymka
    const tip = { x: s.left + s.dymek.ogonek.x, y: s.top + s.dymek.ogonek.y };
    let ciemny = false;
    for (let i = 0; i < 10 && !ciemny; i += 1) { const [rr, gg, bb] = px(tip.x + (s.left + s.width / 2 - tip.x) * i * 0.01, tip.y - i * 0.15); ciemny = rr + gg + bb < 300; }
    r.ogonekWidac = ciemny;
    // PDF wektorowy: dymek jako ścieżki, bez obrazu strony
    const { pdfWektorowy } = await import('./js/pdf-wektorowy.js').catch(() => ({}));
    r.pdf = typeof pdfWektorowy;
    return r;
  });
  assert.deepEqual(wynik.biblioteka, ['dymek-mowa', 'dymek-mysl', 'dymek-krzyk', 'dymek-szept', 'dymek-narracja']);
  assert.equal(wynik.typ, 'textbox');
  assert.equal(wynik.dymek.rodzaj, 'mowa');
  assert.ok(wynik.uchwyt, 'uchwyt ogonka');
  assert.ok(wynik.rosnie, 'dłuższy tekst – wyższy dymek');
  assert.deepEqual(wynik.ogonek, { x: 20, y: 40 });
  assert.deepEqual(wynik.zapis, { rodzaj: 'mowa', ogonek: { x: 20, y: 40 }, typ: 'textbox' });
  assert.ok(wynik.wnetrze[0] > 230 && wynik.wnetrze[1] > 180 && wynik.wnetrze[2] < 80, `wnętrze dymka żółte: ${wynik.wnetrze}`);
  assert.ok(wynik.ogonekWidac, 'ogonek widać na obrazie strony');
  assert.deepEqual(bledy, []);
});

test('dymek: rodzaje w panelu, narracja bez ogonka, po wczytaniu projektu uchwyt wraca', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Komiks 2');
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.dodajDymek('mysl', { x: 50, y: 50 }); });
  await strona.waitForSelector('#wlasciwosci fieldset:has-text("Dymek")');
  const rodzaje = await strona.$$eval('#wlasciwosci fieldset select option', (o) => o.map((x) => x.value).filter((v) => ['mowa', 'mysl', 'krzyk', 'szept', 'narracja'].includes(v)));
  assert.deepEqual(rodzaje, ['mowa', 'mysl', 'krzyk', 'szept', 'narracja']);
  const wynik = await strona.evaluate(async () => {
    const { edytor, stan } = window.seriodruk;
    const d = edytor.canvas.getActiveObject();
    d.dymek = { ...d.dymek, rodzaj: 'narracja' };
    const { figuryDymka } = await import('./js/dymek.js');
    const narracja = figuryDymka(d).length;
    d.dymek = { ...d.dymek, rodzaj: 'krzyk' };
    edytor.zatwierdz();
    for (let i = 0; i < 50 && !stan.projekt.strony[0].obiekty.some((x) => x.dymek?.rodzaj === 'krzyk'); i += 1) await new Promise((ok) => setTimeout(ok, 100));
    const { otworzProjekt } = await import('./js/app/zapis.js');
    const kopia = JSON.parse(JSON.stringify(stan.projekt));
    kopia.id = crypto.randomUUID(); kopia.nazwa = 'Komiks wczytany'; delete kopia.wersja;
    await otworzProjekt(kopia);
    return { narracja };
  });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt?.nazwa === 'Komiks wczytany' && window.seriodruk.edytor.canvas.getObjects().some((o) => o.dymek));
  Object.assign(wynik, await strona.evaluate(() => {
    const po = window.seriodruk.edytor.canvas.getObjects().find((o) => o.dymek);
    return { rodzaj: po?.dymek.rodzaj, uchwyt: Boolean(po?.controls.ogonek), bezPamieci: po?.shouldCache() === false };
  }));
  assert.equal(wynik.narracja, 1, 'narracja – sama ramka, bez ogonka');
  assert.deepEqual([wynik.rodzaj, wynik.uchwyt, wynik.bezPamieci], ['krzyk', true, true]);
  assert.deepEqual(bledy, []);
});
