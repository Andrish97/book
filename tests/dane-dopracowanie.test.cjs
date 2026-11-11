const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('obraz z danych: kadr z kolumny osobno dla każdego wiersza – słowa, procenty, pusta wartość; panel, zmiana nazwy kolumny, nieznana kolumna', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Kadr z kolumny');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz, edytor } = window.seriodruk;
    const { kadrZWartosci } = await import('./js/pola.js');
    const p = stan.projekt;
    // Zdjęcie pionowe 100 × 300: góra czerwona, środek zielony, dół niebieski.
    const c = Object.assign(document.createElement('canvas'), { width: 100, height: 300 });
    const x = c.getContext('2d');
    ['#ff0000', '#00ff00', '#0000ff'].forEach((k, i) => { x.fillStyle = k; x.fillRect(0, i * 100, 100, 100); });
    const wzor = await edytor.dodajObraz(c.toDataURL('image/png'), 'pasy.png', p.zasoby);
    wzor.set({ left: 20, top: 20, scaleX: 0.6, scaleY: 0.2 }); // ramka 60 × 60 mm
    edytor.zatwierdz();
    await zapiszTeraz();
    const kadry = ['góra', 'DOL', '', '50% 100%', 'bottom', 'bzdura', '0 0', 'środek'];
    p.tabele.push({ id: 't1', nazwa: 'Dane', kolumny: ['plik', 'kadr'], wiersze: kadry.map((k) => ['pasy.png', k]) });
    p.serie.push({ id: 'se1', nazwa: 'S', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    const obraz = p.strony[0].obiekty[0];
    const { rozwin } = await import('./js/serie.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const kolory = async (pole) => {
      obraz.pole = pole;
      const ciag = rozwin(p);
      const wynik = [];
      for (const egz of ciag.egzemplarze) {
        const img = new Image();
        await new Promise(async (ok) => { img.onload = ok; img.src = await renderujCel(p, egz, { szerokoscPx: 148, spad: false, ciag }); });
        const k = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
        const y = k.getContext('2d'); y.drawImage(img, 0, 0);
        wynik.push({ '255,0,0': 'góra', '0,255,0': 'środek', '0,0,255': 'dół' }[[...y.getImageData(50, 50, 1, 1).data].slice(0, 3).join(',')]);
      }
      return wynik;
    };
    const wynik = {
      zKolumny: await kolory({ kolumna: 'plik', tryb: 'wypelnij', kadr_z: 'kadr' }),
      zKolumnyNaWzorzeDol: await kolory({ kolumna: 'plik', tryb: 'wypelnij', kadr: 'dol', kadr_z: 'kadr' }),
      wartosci: ['Góra', 'gora lewa', 'top right', ' 30% 20% ', '25', '12,5%;80', 'center', 'prawo', 'x', '10 20 30', '-5 10', ''].map((v) => kadrZWartosci(v)),
    };
    obraz.pole = { kolumna: 'plik', tryb: 'wypelnij' };
    await window.seriodruk.przeladuj();
    return wynik;
  });
  // Kwadratowa ramka pokazuje jedną trzecią pionowego zdjęcia. Pusta i niezrozumiała wartość zostawiają ustawienie wzoru.
  assert.deepEqual(w.zKolumny, ['góra', 'dół', 'środek', 'dół', 'dół', 'środek', 'góra', 'środek']);
  assert.deepEqual(w.zKolumnyNaWzorzeDol, ['góra', 'dół', 'dół', 'dół', 'dół', 'dół', 'góra', 'środek']);
  assert.deepEqual(w.wartosci, [
    { x: 0.5, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.3, y: 0.2 }, { x: 0.25, y: 0.5 }, { x: 0.125, y: 0.8 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }, null, null, null, null,
  ]);

  // Panel obrazu: „Kadr z kolumny” jest przy wypełnianiu ramki; kolumna z nazwą pliku nie jest na liście.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.zaznacz(e.canvas.getObjects().find((o) => o.type === 'image').id); });
  assert.deepEqual(await strona.locator('.wlasciwosci label:has-text("Kadr z kolumny") select option').evaluateAll((l) => l.map((o) => o.value)), ['', 'kadr']);
  await strona.selectOption('.wlasciwosci label:has-text("Kadr z kolumny") select', 'kadr');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].obiekty[0].pole), { kolumna: 'plik', tryb: 'wypelnij', kadr_z: 'kadr' });
  assert.match(await strona.textContent('.wlasciwosci'), /punkt zdjęcia w procentach od lewej i od góry/);

  // Zmiana nazwy kolumny poprawia ustawienie obrazu; kolumna, której nie ma, trafia do ostrzeżeń i do kontroli.
  const po = await strona.evaluate(async () => {
    const { stan, edytor } = window.seriodruk;
    const p = stan.projekt;
    const { zmienNazwePola } = await import('./js/tabele.js');
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const ile = zmienNazwePola(p, 'kadr', 'czesc');
    const poZmianie = { ...p.strony[0].obiekty[0].pole };
    await window.seriodruk.przeladuj();
    return {
      ile, poZmianie,
      uwagi: sprawdzProjekt(p).filter((u) => u.rodzaj === 'nieznane_pole').map((u) => u.opis.replace(/ – .*/, '')),
      ostrzezenia: edytor.ostrzezenia.filter((o) => o.typ === 'nieznane_pole').map((o) => o.pola),
    };
  });
  assert.equal(po.ile, 1);
  assert.deepEqual(po.poZmianie, { kolumna: 'plik', tryb: 'wypelnij', kadr_z: 'czesc' });
  assert.deepEqual(po.uwagi, ['Pole {czesc} nie ma skąd wziąć wartości (nie ma takiej kolumny ani pola dokumentu)']);
  assert.deepEqual(po.ostrzezenia, [['czesc']]);
  assert.deepEqual(bledy, []);
});

test('kolor z danych w wypełnieniu przejściem kolorów: pierwszy albo ostatni kolor, odcienie, całe wypełnienie; starszy zapis bez zmian; panel', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Gradient');
  const w = await strona.evaluate(async () => {
    const { stan, zapiszTeraz } = window.seriodruk;
    const p = stan.projekt;
    await zapiszTeraz();
    p.tabele.push({ id: 't1', nazwa: 'Kolory', kolumny: ['kolor'], wiersze: [['#00ff00'], ['']] });
    p.serie.push({ id: 'se1', nazwa: 'S', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    // Przejście poziome od czerwonego do niebieskiego (przystanki zapisane nie po kolei), przez ciemną czerwień w środku.
    const przejscie = () => ({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 1, y2: 0 }, colorStops: [{ offset: 1, color: '#0000ff' }, { offset: 0, color: '#ff0000' }, { offset: 0.5, color: 'rgba(128,0,0,0.5)' }] });
    const kwadrat = (id, top, kolorW) => ({ type: 'rect', version: '5.3.0', left: 20, top, width: 100, height: 20, strokeWidth: 0, fill: przejscie(), id, z_danych: { kolor: 'kolor', ...(kolorW ? { kolor_w: kolorW } : {}) } });
    p.strony[0].obiekty = [
      kwadrat('pierwszy', 10, 'pierwszy'), kwadrat('ostatni', 40, 'ostatni'), kwadrat('odcienie', 70, 'odcienie'), kwadrat('stary', 100, ''),
      { type: 'group', version: '5.3.0', left: 20, top: 130, width: 100, height: 20, id: 'grupa', z_danych: { kolor: 'kolor', kolor_w: 'pierwszy' }, objects: [
        { type: 'rect', left: -50, top: -10, width: 50, height: 20, strokeWidth: 0, fill: przejscie(), id: 'g1' },
        { type: 'rect', left: 0, top: -10, width: 50, height: 20, strokeWidth: 0, fill: '#888888', id: 'g2' },
      ] },
    ];
    await window.seriodruk.przeladuj();
    const { rozwin, wartosciPol } = await import('./js/serie.js');
    const { podstawWObiektach, przystankiZKolorem } = await import('./js/pola.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const ciag = rozwin(p);
    const kolory = (egz) => Object.fromEntries(podstawWObiektach(p.strony[0].obiekty, wartosciPol(p, egz, ciag)).map((o) => {
      const opis = (f) => (typeof f === 'string' ? f : f.colorStops.slice().sort((a, b) => a.offset - b.offset).map((s) => s.color).join(' → '));
      return [o.id, o.objects ? o.objects.map((x) => opis(x.fill)) : opis(o.fill)];
    }));
    // Obraz pierwszej strony: lewy i prawy koniec każdego paska (strona 148 mm = 444 piksele).
    const img = new Image();
    await new Promise(async (ok) => { img.onload = ok; img.src = await renderujCel(p, ciag.egzemplarze[0], { szerokoscPx: 444, spad: false, ciag }); });
    const k = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const y = k.getContext('2d'); y.drawImage(img, 0, 0);
    const piksel = (mmX, mmY) => [...y.getImageData(mmX * 3, mmY * 3, 1, 1).data].slice(0, 3);
    return {
      zKolorem: kolory(ciag.egzemplarze[0]), bezKoloru: kolory(ciag.egzemplarze[1]),
      obraz: { pierwszy: [piksel(21, 20), piksel(119, 20)], ostatni: [piksel(21, 50), piksel(119, 50)], stary: [piksel(21, 110), piksel(119, 110)] },
      jasniejsze: przystankiZKolorem([{ offset: 0, color: '#804040' }, { offset: 1, color: '#c08080' }], 'navy', 'odcienie').map((s) => s.color),
    };
  });
  assert.deepEqual(w.zKolorem, {
    pierwszy: '#00ff00 → rgba(128,0,0,0.5) → #0000ff',
    ostatni: '#ff0000 → rgba(128,0,0,0.5) → #00ff00',
    // Odcienie: pierwszy kolor to kolor z danych, środkowy jest ciemniejszy (jak we wzorze) i zachowuje przezroczystość.
    odcienie: '#00ff00 → rgba(0,128,0,0.5) → #00ff00',
    stary: '#00ff00', // bez ustawienia (starszy zapis) kolor zastępuje całe wypełnienie
    grupa: ['#00ff00 → rgba(128,0,0,0.5) → #0000ff', '#00ff00'],
  });
  // Pusta wartość zostawia wzór.
  assert.equal(w.bezKoloru.pierwszy, '#ff0000 → rgba(128,0,0,0.5) → #0000ff');
  assert.equal(w.bezKoloru.stary, '#ff0000 → rgba(128,0,0,0.5) → #0000ff');
  const blisko = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 12);
  assert.ok(blisko(w.obraz.pierwszy[0], [0, 255, 0]) && blisko(w.obraz.pierwszy[1], [0, 0, 255]), `pierwszy kolor z danych, przejście zostaje: ${JSON.stringify(w.obraz.pierwszy)}`);
  assert.ok(blisko(w.obraz.ostatni[0], [255, 0, 0]) && blisko(w.obraz.ostatni[1], [0, 255, 0]), `ostatni kolor z danych: ${JSON.stringify(w.obraz.ostatni)}`);
  assert.ok(blisko(w.obraz.stary[0], [0, 255, 0]) && blisko(w.obraz.stary[1], [0, 255, 0]), `jeden kolor: ${JSON.stringify(w.obraz.stary)}`);
  // Granat (jasność 25%) i wzór, w którym drugi kolor jest o 25 punktów jaśniejszy: wychodzi niebieski o jasności 50%.
  assert.deepEqual(w.jasniejsze, ['#000080', '#0101ff'], 'drugi kolor jest jaśniejszy o tyle, o ile we wzorze');

  // Panel: przy wypełnieniu przejściem wybranie pola od razu ustawia „pierwszy kolor”; zwykłe wypełnienie nie ma tej listy.
  await strona.evaluate(() => {
    const { stan } = window.seriodruk;
    for (const o of stan.projekt.strony[0].obiekty) delete o.z_danych;
    stan.projekt.strony[0].obiekty.push({ type: 'rect', version: '5.3.0', left: 20, top: 170, width: 30, height: 10, strokeWidth: 0, fill: '#123456', id: 'zwykly' });
    return window.seriodruk.przeladuj();
  });
  await strona.evaluate(() => window.seriodruk.edytor.zaznacz('pierwszy'));
  assert.equal(await strona.locator('.wlasciwosci label:has-text("W przejściu kolorów pole zmienia")').count(), 0);
  await strona.selectOption('.wlasciwosci label:has-text("Kolor z pola") select', 'kolor');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  const zapis = (id) => strona.evaluate((x) => window.seriodruk.stan.projekt.strony[0].obiekty.find((o) => o.id === x).z_danych, id);
  assert.deepEqual(await zapis('pierwszy'), { kolor: 'kolor', kolor_w: 'pierwszy' });
  await strona.selectOption('.wlasciwosci label:has-text("W przejściu kolorów pole zmienia") select', 'odcienie');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await zapis('pierwszy'), { kolor: 'kolor', kolor_w: 'odcienie' });
  await strona.selectOption('.wlasciwosci label:has-text("W przejściu kolorów pole zmienia") select', '');
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await zapis('pierwszy'), { kolor: 'kolor' });
  await strona.selectOption('.wlasciwosci label:has-text("Kolor z pola") select', '');
  await strona.evaluate(() => window.seriodruk.edytor.zaznacz('zwykly'));
  await strona.selectOption('.wlasciwosci label:has-text("Kolor z pola") select', 'kolor');
  assert.equal(await strona.locator('.wlasciwosci label:has-text("W przejściu kolorów pole zmienia")').count(), 0);
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  assert.deepEqual(await zapis('zwykly'), { kolor: 'kolor' });
  assert.deepEqual(bledy, []);
});
