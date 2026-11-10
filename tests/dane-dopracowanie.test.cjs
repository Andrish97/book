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
