// Obrazy projektu: jedno miejsce na wszystkie obrazy (wstawione na strony i wgrane), okno z podglądem i użyciami,
// zaznaczanie, kopiowanie nazw, usuwanie, podmiana, zmiana nazwy; duplikaty przy wgrywaniu i wstawianiu;
// wybór z obrazów projektu; tabela rozróżnia rozszerzenia; usunięty obraz nie wraca po łączeniu z drugim urządzeniem.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, drugieUrzadzenie, zaloguj } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

// Mały PNG w danym kolorze (każdy kolor to inna treść pliku).
async function png(strona, kolor, nazwa) {
  const b64 = await strona.evaluate((k) => {
    const c = document.createElement('canvas');
    c.width = 6; c.height = 4;
    const ctx = c.getContext('2d');
    ctx.fillStyle = k; ctx.fillRect(0, 0, 6, 4);
    return c.toDataURL('image/png').split(',')[1];
  }, kolor);
  return { name: nazwa, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

const obrazy = (strona) => strona.evaluate(() => {
  const p = window.seriodruk.stan.projekt;
  const czcionki = new Set((p.czcionki || []).map((c) => c.id));
  return Object.entries(p.zasoby).filter(([id]) => !czcionki.has(id)).map(([id, z]) => ({ id, nazwa: z.nazwa }));
});
const naPlotnie = (strona) => strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'image').map((o) => o.zasob));
const powiadomienie = (strona) => strona.textContent('#powiadomienie');
const wgraj = (strona, pliki) => strona.setInputFiles('#pliki-zasoby', pliki);
const otworzOkno = async (strona) => {
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="obrazy"]');
  await strona.waitForSelector('#dlg-obrazy[open]');
};
const wpis = (strona, nazwa) => strona.locator('#obrazy-lista li', { has: strona.locator(`.obraz-nazwa:text-is("${nazwa}")`) });
const zaznacz = (strona, nazwa, mod = {}) => wpis(strona, nazwa).locator('.obraz-miniatura').click({ modifiers: mod.ctrl ? ['Control'] : [] });
const schowek = (strona) => strona.evaluate(() => window.schowekTestu);
const plikiMagazynu = (strona) => strona.evaluate(async () => (await (await import('./js/zasoby.js')).spisPlikow()).map(([k]) => k));

test('obrazy projektu: jedno miejsce, duplikaty, okno z użyciami, zaznaczanie, kopiowanie nazw, usuwanie, podmiana, zmiana nazwy', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Obrazy');
  await strona.evaluate(() => { navigator.clipboard.writeText = async (x) => { window.schowekTestu = x; }; });
  const czerwony = await png(strona, '#d00', 'czerwony.png');

  // Menu ⋯: „Obrazy projektu…” obok „Czcionki projektu…”, bez osobnego wgrywania.
  const menu = await strona.evaluate(() => [...document.querySelectorAll('#menu-wiecej [data-akcja]')].map((b) => b.dataset.akcja));
  assert.ok(!menu.includes('wgraj-obrazy'));
  assert.equal(menu[menu.indexOf('obrazy') + 1], 'czcionki');

  // Projekt bez obrazów: narzędzie „Obraz” od razu otwiera wybór pliku.
  const [plik1] = await Promise.all([strona.waitForEvent('filechooser'), strona.click('[data-akcja="dodaj-obraz"]')]);
  await plik1.setFiles(czerwony);
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'image').length === 1);
  // Ten sam plik drugi raz (inna nazwa): drugi element, ten sam obraz projektu.
  await strona.click('[data-akcja="dodaj-obraz"]');
  await strona.waitForSelector('#dlg-zrodlo-obrazu[open]');
  const [plik2] = await Promise.all([strona.waitForEvent('filechooser'), strona.click('#zrodlo-urzadzenie')]);
  await plik2.setFiles({ ...czerwony, name: 'kopia.png' });
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'image').length === 2);
  let lista = await obrazy(strona);
  assert.deepEqual(lista.map((o) => o.nazwa), ['czerwony.png']);
  const idCzerwony = lista[0].id;
  assert.deepEqual(await naPlotnie(strona), [idCzerwony, idCzerwony]);

  // Wgranie identycznej treści pod inną nazwą: komunikat, bez nowego obrazu.
  await wgraj(strona, { ...czerwony, name: 'inny.png' });
  await strona.waitForFunction(() => /już jest jako „czerwony.png”/.test(document.querySelector('#powiadomienie').textContent));
  assert.equal((await obrazy(strona)).length, 1);

  // Trzy nowe: jeden wskazany w danych, dwa nieużywane.
  await wgraj(strona, [await png(strona, '#00d', 'niebieski.png'), await png(strona, '#0a0', 'zielony.png'), await png(strona, '#999', 'szary.png')]);
  await strona.waitForFunction(() => Object.keys(window.seriodruk.stan.projekt.zasoby).length === 4);
  assert.match(await powiadomienie(strona), /Wgrano 3 obrazy/);
  await strona.evaluate(() => {
    window.seriodruk.stan.projekt.tabele.push({ id: 'tab-obrazy', nazwa: 'Zdjęcia', kolumny: ['zdjecie'], wiersze: [['Niebieski.PNG']] });
  });
  await zapisano(strona);

  // „Wybierz z obrazów projektu”: wstawia obraz, który już jest – bez kopii.
  await strona.click('[data-akcja="dodaj-obraz"]');
  await strona.waitForSelector('#dlg-zrodlo-obrazu[open]');
  await strona.click('#zrodlo-projekt');
  await strona.waitForSelector('#dlg-obrazy[open].tryb-wyboru');
  assert.ok(await strona.isDisabled('#obrazy-wybierz'));
  await zaznacz(strona, 'szary.png');
  await strona.click('#obrazy-wybierz');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'image').length === 3);
  const idSzary = (await obrazy(strona)).find((o) => o.nazwa === 'szary.png').id;
  assert.equal((await naPlotnie(strona))[2], idSzary);
  assert.equal((await obrazy(strona)).length, 4);
  await strona.evaluate(() => { const e = window.seriodruk.edytor; e.canvas.setActiveObject(e.canvas.getObjects().filter((o) => o.type === 'image')[2]); e.usun(); });

  // Okno: miniatury, pełne nazwy, wymiary, gdzie użyty.
  await otworzOkno(strona);
  assert.equal(await strona.evaluate(() => document.querySelector('#dlg-obrazy').classList.contains('tryb-wyboru')), false);
  assert.equal(await strona.locator('#obrazy-lista li').count(), 4);
  assert.equal(await strona.textContent('#obrazy-licznik'), '4');
  assert.match(await wpis(strona, 'czerwony.png').locator('.obraz-uzycie').textContent(), /strona 1/);
  assert.match(await wpis(strona, 'niebieski.png').locator('.obraz-uzycie').textContent(), /w danych \(„Zdjęcia”\)/);
  assert.equal(await wpis(strona, 'zielony.png').locator('.obraz-uzycie').textContent(), 'nieużywany');
  await strona.waitForFunction(() => /6 × 4 px/.test(document.querySelector('#obrazy-lista li .obraz-wymiary').textContent));
  assert.equal(await strona.textContent('#obrazy-usun-nieuzywane'), 'Usuń nieużywane (2)');

  // Kopiuj nazwę jednego obrazu; zaznaczenie kilku (Ctrl) i „Kopiuj nazwy” – jedna pod drugą, w kolejności kafelków.
  await wpis(strona, 'zielony.png').locator('[data-rola="kopiuj"]').click();
  assert.equal(await schowek(strona), 'zielony.png');
  assert.ok(await strona.isHidden('#obrazy-kopiuj-nazwy'));
  await zaznacz(strona, 'zielony.png');
  await zaznacz(strona, 'czerwony.png', { ctrl: true });
  await zaznacz(strona, 'szary.png', { ctrl: true });
  assert.equal(await strona.textContent('#obrazy-zaznaczone'), 'Zaznaczone: 3');
  await strona.click('#obrazy-kopiuj-nazwy');
  assert.equal(await schowek(strona), 'czerwony.png\nszary.png\nzielony.png');

  // „Usuń” przy zaznaczonych: nieużywane znikają (z magazynu i z konta), użyty zostaje – z informacją, gdzie jest.
  const idZielony = (await obrazy(strona)).find((o) => o.nazwa === 'zielony.png').id;
  assert.ok([...baza.pliki.keys()].some((k) => k.endsWith(`/${idZielony}`)), 'obraz był na koncie');
  assert.ok((await plikiMagazynu(strona)).some((k) => k.endsWith(`/${idZielony}`)), 'obraz był w magazynie');
  await strona.click('#obrazy-usun-zaznaczone');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  assert.match(await strona.textContent('#potwierdz-tytul'), /Usunąć 2 obrazy/);
  assert.match(await strona.textContent('#potwierdz-tresc'), /„czerwony.png” \(strona 1\)/);
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => document.querySelectorAll('#obrazy-lista li').length === 2);
  assert.deepEqual((await obrazy(strona)).map((o) => o.nazwa).sort(), ['czerwony.png', 'niebieski.png']);
  assert.ok((await strona.evaluate(() => window.seriodruk.stan.projekt.zasoby_usuniete)).includes(idZielony));
  assert.ok(!(await plikiMagazynu(strona)).some((k) => k.endsWith(`/${idZielony}`)), 'plik zniknął z magazynu');
  for (let i = 0; i < 40 && [...baza.pliki.keys()].some((k) => k.endsWith(`/${idZielony}`)); i += 1) await strona.waitForTimeout(100);
  assert.ok(![...baza.pliki.keys()].some((k) => k.endsWith(`/${idZielony}`)), 'plik zniknął z konta');
  assert.equal(await strona.textContent('#obrazy-zaznaczone'), 'Zaznaczone: 1', 'użyty zostaje zaznaczony');

  // Sam użyty: nie da się usunąć – jest informacja, gdzie jest użyty.
  await strona.click('#obrazy-usun-zaznaczone');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  assert.match(await strona.textContent('#potwierdz-tresc'), /strona 1/);
  await strona.click('#potwierdz-nie');
  assert.equal((await obrazy(strona)).length, 2);
  await strona.click('#obrazy-odznacz');

  // Inna treść o tej samej nazwie (wielkość liter bez znaczenia): pytanie. „Zachowaj oba” → „(2)”.
  await wgraj(strona, await png(strona, '#ee0', 'Czerwony.png'));
  await strona.waitForSelector('#dlg-obraz-duplikat[open]');
  assert.match(await strona.textContent('#duplikat-opis'), /czerwony\.png/);
  assert.ok(await strona.isHidden('#duplikat-wszystkie'), 'przy jednym pliku nie ma „dla pozostałych”');
  assert.match(await strona.textContent('#duplikat-oba'), /Czerwony \(2\)\.png/);
  await strona.click('#duplikat-oba');
  await strona.waitForFunction(() => document.querySelectorAll('#obrazy-lista li').length === 3);
  assert.ok((await obrazy(strona)).some((o) => o.nazwa === 'Czerwony (2).png'));
  // Inne rozszerzenie to inna nazwa – bez pytania.
  await wgraj(strona, await png(strona, '#0ee', 'czerwony.webp'));
  await strona.waitForFunction(() => document.querySelectorAll('#obrazy-lista li').length === 4);
  assert.equal(await strona.locator('#dlg-obraz-duplikat[open]').count(), 0);

  // „Zastąp”: nowy plik w miejscu starego – elementy na stronie przepięte, nazwa ta sama, stary obraz usunięty.
  await wgraj(strona, await png(strona, '#909', 'czerwony.png'));
  await strona.waitForSelector('#dlg-obraz-duplikat[open]');
  await strona.click('#duplikat-zastap');
  await strona.waitForFunction((stary) => !window.seriodruk.stan.projekt.zasoby[stary], idCzerwony);
  lista = await obrazy(strona);
  const nowyCzerwony = lista.find((o) => o.nazwa === 'czerwony.png').id;
  assert.notEqual(nowyCzerwony, idCzerwony);
  await strona.waitForFunction((id) => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'image' && o.zasob === id).length === 2, nowyCzerwony);
  assert.ok((await strona.evaluate(() => window.seriodruk.stan.projekt.zasoby_usuniete)).includes(idCzerwony));
  // Cofnięcie nie wraca do elementów bez pliku: historia też jest przepięta.
  const wHistorii = await strona.evaluate(async (stary) => { const { historia } = await import('./js/app/kontekst.js'); return historia.kroki.length > 0 && historia.kroki.some((k) => [...k.strony.values()].some((x) => x.includes(stary))); }, idCzerwony);
  assert.equal(wHistorii, false);

  // „Podmień plik” w oknie: obraz z danych dostaje nowy plik, nazwa (i dopasowanie do danych) zostaje.
  const idNiebieski = lista.find((o) => o.nazwa === 'niebieski.png').id;
  const [wybor] = await Promise.all([strona.waitForEvent('filechooser'), wpis(strona, 'niebieski.png').locator('[data-rola="podmien"]').click()]);
  await wybor.setFiles(await png(strona, '#0dd', 'cokolwiek.png'));
  await strona.waitForFunction((stary) => !window.seriodruk.stan.projekt.zasoby[stary], idNiebieski);
  assert.ok((await obrazy(strona)).some((o) => o.nazwa === 'niebieski.png' && o.id !== idNiebieski));
  assert.match(await wpis(strona, 'niebieski.png').locator('.obraz-uzycie').textContent(), /w danych/);

  // Zmiana nazwy kliknięciem nazwy (z kontrolą powtórzeń); obraz z danych – komórki tabeli dostają nową nazwę.
  await wpis(strona, 'Czerwony (2).png').locator('.obraz-nazwa').click();
  await strona.waitForSelector('#dlg-nazwa[open]');
  await strona.fill('#dlg-nazwa input', 'NIEBIESKI.png');
  await strona.click('#dlg-nazwa button[value="tak"]');
  await strona.waitForFunction(() => /ma już tę nazwę/.test(document.querySelector('#powiadomienie').textContent));
  await wpis(strona, 'Czerwony (2).png').locator('[data-rola="nazwa"][data-ikona]').click();
  await strona.waitForSelector('#dlg-nazwa[open]');
  await strona.fill('#dlg-nazwa input', 'żółty.png');
  await strona.click('#dlg-nazwa button[value="tak"]');
  await strona.waitForFunction(() => [...document.querySelectorAll('#obrazy-lista .obraz-nazwa')].some((e) => e.textContent === 'żółty.png'));
  await wpis(strona, 'niebieski.png').locator('.obraz-nazwa').click();
  await strona.waitForSelector('#dlg-nazwa[open]');
  await strona.fill('#dlg-nazwa input', 'morze.png');
  await strona.click('#dlg-nazwa button[value="tak"]');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  assert.match(await strona.textContent('#potwierdz-tresc'), /„Zdjęcia”/);
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.tabele.find((x) => x.id === 'tab-obrazy').wiersze[0][0] === 'morze.png');
  await strona.waitForFunction(() => [...document.querySelectorAll('#obrazy-lista .obraz-nazwa')].some((e) => e.textContent === 'morze.png'));
  assert.match(await wpis(strona, 'morze.png').locator('.obraz-uzycie').textContent(), /w danych/);

  // „Usuń nieużywane”: żółty i czerwony.webp nie są nigdzie użyte.
  assert.equal(await strona.textContent('#obrazy-usun-nieuzywane'), 'Usuń nieużywane (2)');
  await strona.click('#obrazy-usun-nieuzywane');
  await strona.waitForSelector('#dlg-potwierdz[open]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => document.querySelectorAll('#obrazy-lista li').length === 2);
  assert.deepEqual((await obrazy(strona)).map((o) => o.nazwa).sort(), ['czerwony.png', 'morze.png']);

  // „Pokaż” zamyka okno i zaznacza obraz na stronie.
  await wpis(strona, 'czerwony.png').locator('[data-rola="pokaz"]').click();
  await strona.waitForFunction(() => !document.querySelector('#dlg-obrazy').open);
  assert.equal(await strona.evaluate(() => window.seriodruk.edytor.aktywny?.type), 'image');

  // „Podmień zdjęcie” we właściwościach: wybór z obrazów projektu – element dostaje istniejący obraz.
  const idMorze = (await obrazy(strona)).find((o) => o.nazwa === 'morze.png').id;
  assert.deepEqual(await strona.evaluate(() => [...document.querySelectorAll('.akcje-obrazu button')].map((b) => b.textContent.trim())), ['Podmień zdjęcie', 'Obrazy projektu…']);
  await strona.click('.akcje-obrazu button:has-text("Podmień zdjęcie")');
  await strona.waitForSelector('#dlg-zrodlo-obrazu[open]');
  await strona.click('#zrodlo-projekt');
  await strona.waitForSelector('#dlg-obrazy[open].tryb-wyboru');
  assert.equal(await strona.textContent('#obrazy-wybierz'), 'Podmień');
  await wpis(strona, 'morze.png').locator('.obraz-miniatura').dblclick();
  await strona.waitForFunction((id) => window.seriodruk.edytor.aktywny?.zasob === id, idMorze);
  assert.equal((await obrazy(strona)).length, 2, 'bez nowej kopii');
  // „Obrazy projektu…” w panelu otwiera okno.
  await strona.click('.akcje-obrazu button:has-text("Obrazy projektu")');
  await strona.waitForSelector('#dlg-obrazy[open]:not(.tryb-wyboru)');
  await strona.click('#obrazy-zamknij');

  // Po zapisie: na koncie nie ma usuniętych obrazów, a nagrobki są.
  await zapisano(strona);
  const dane = baza.projekty[0].dane;
  assert.deepEqual(Object.values(dane.zasoby).map((z) => z.nazwa).sort(), ['czerwony.png', 'morze.png']);
  assert.ok(dane.zasoby_usuniete.includes(idZielony) && dane.zasoby_usuniete.includes(idCzerwony));
  assert.deepEqual(bledy, []);
});

test('tabela rozróżnia rozszerzenia: a.jpg i a.png to dwa obrazy, nazwa bez rozszerzenia tylko przy jednym pasującym', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Rozszerzenia');
  const w = await strona.evaluate(async () => {
    const plama = (kolor) => { const c = document.createElement('canvas'); c.width = 40; c.height = 40; const x = c.getContext('2d'); x.fillStyle = kolor; x.fillRect(0, 0, 40, 40); return c.toDataURL('image/png'); };
    const p = window.seriodruk.stan.projekt;
    p.zasoby.z_wzor = { nazwa: 'wzor.png', dataUrl: plama('#888888') };
    p.zasoby.z_jpg = { nazwa: 'las.jpg', dataUrl: plama('#ff0000') };
    p.zasoby.z_png = { nazwa: 'Las.png', dataUrl: plama('#00ff00') };
    p.zasoby.z_most = { nazwa: 'most.png', dataUrl: plama('#0000ff') };
    p.tabele.push({ id: 't1', nazwa: 'Zdjęcia', kolumny: ['plik'], wiersze: [['las.jpg'], ['LAS.PNG'], ['las'], ['most'], ['most.jpg']] });
    p.serie.push({ id: 'se1', nazwa: 'Zdjęcia', tabela: 't1', tryb: 'tabela', uklad: 'szeroki', ile: 1 });
    p.strony[0].seria = 'se1';
    p.strony[0].obiekty = [{ type: 'image', version: '5.3.0', left: 50, top: 100, width: 40, height: 40, scaleX: 1, scaleY: 1, zasob: 'z_wzor', src: 'zasob:z_wzor', pole: { kolumna: 'plik' }, id: 'o_obraz' }];
    const { rozwin } = await import('./js/serie.js');
    const { renderujCel } = await import('./js/zlozenie.js');
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    const { uzycia } = await import('./js/obrazy-projektu.js');
    const ciag = rozwin(p);
    const piksele = [];
    for (const e of ciag.egzemplarze) {
      const url = await renderujCel(p, e, { szerokoscPx: 148, spad: false, ciag });
      const img = new Image();
      await new Promise((ok) => { img.onload = ok; img.src = url; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      piksele.push([...x.getImageData(70, 120, 1, 1).data].slice(0, 3).join(','));
    }
    const uwagi = sprawdzProjekt(p, ciag).filter((u) => u.rodzaj === 'brak_obrazu').map((u) => u.opis);
    return { piksele, uwagi, dane: ['z_jpg', 'z_png', 'z_most'].map((id) => uzycia(p, id).dane.length) };
  });
  assert.equal(w.piksele[0], '255,0,0', 'las.jpg');
  assert.equal(w.piksele[1], '0,255,0', 'LAS.PNG → Las.png');
  assert.ok(!['255,0,0', '0,255,0'].includes(w.piksele[2]), '„las” pasuje do dwóch plików – znak braku');
  assert.equal(w.piksele[3], '0,0,255', '„most” – jeden pasujący plik');
  assert.notEqual(w.piksele[4], '0,0,255', '„most.jpg” to nie „most.png”');
  assert.ok(w.uwagi.some((u) => /Niejednoznaczna nazwa obrazu „las”.*„las.jpg”.*„Las.png”.*dopisz w tabeli rozszerzenie/.test(u)), w.uwagi.join(' | '));
  assert.ok(w.uwagi.some((u) => /Nie ma w projekcie obrazu „most.jpg”/.test(u)), w.uwagi.join(' | '));
  assert.deepEqual(w.dane, [1, 1, 1], 'każdy obraz jest „w danych”');
  assert.deepEqual(bledy, []);
});

test('kilka plików o powtórzonych nazwach: „tak samo dla pozostałych”', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wiele');
  await wgraj(strona, [await png(strona, '#100', 'a.png'), await png(strona, '#200', 'b.png'), await png(strona, '#300', 'c.png')]);
  await strona.waitForFunction(() => Object.keys(window.seriodruk.stan.projekt.zasoby).length === 3);
  await wgraj(strona, [await png(strona, '#400', 'a.png'), await png(strona, '#500', 'B.png'), await png(strona, '#300', 'c-kopia.png')]);
  await strona.waitForSelector('#dlg-obraz-duplikat[open]');
  assert.ok(await strona.isVisible('#duplikat-wszystkie'));
  await strona.click('#duplikat-wszystkie + span');
  await strona.click('#dlg-obraz-duplikat button[value="pomin"]');
  await strona.waitForFunction(() => /Pominięto 2/.test(document.querySelector('#powiadomienie').textContent));
  assert.match(await powiadomienie(strona), /już jest jako „c.png”/);
  assert.equal(await strona.locator('#dlg-obraz-duplikat[open]').count(), 0, 'o drugi plik nie pyta');
  assert.equal((await obrazy(strona)).length, 3);
  assert.deepEqual(bledy, []);
});

test('usunięty obraz nie wraca po łączeniu z drugim urządzeniem', async (t) => {
  const a = await otworz(t);
  const b = await drugieUrzadzenie(a);
  await zaloguj(b.strona, a.baza);
  await nowyProjekt(a.strona, 'Wspólne obrazy');
  await a.strona.click('[data-akcja="dodaj-prostokat"]');
  await wgraj(a.strona, await png(a.strona, '#123', 'zbedny.png'));
  await a.strona.waitForFunction(() => Object.keys(window.seriodruk.stan.projekt.zasoby).length === 1);
  await zapisano(a.strona);
  const [{ id }] = await obrazy(a.strona);

  await b.strona.waitForFunction(() => document.querySelectorAll('#siatka-projektow .karta-projektu').length === 1, null, { timeout: 10000 });
  await b.strona.click('.karta-projektu .otworz-projekt');
  await b.strona.waitForFunction((z) => window.seriodruk.stan.projekt?.zasoby?.[z] && window.seriodruk.edytor?.wydruk, id, { timeout: 10000 });
  await zapisano(b.strona);

  // A usuwa obraz, a B w tym samym czasie zmienia stronę – łączenie nie przywraca obrazu.
  await otworzOkno(a.strona);
  await zaznacz(a.strona, 'zbedny.png');
  await a.strona.click('#obrazy-usun-zaznaczone');
  await a.strona.click('#potwierdz-tak');
  await a.strona.waitForFunction(() => !document.querySelectorAll('#obrazy-lista li').length);
  // Przy otwartym oknie zmiany z konta czekają (jak przy każdym oknie) – zamykamy je.
  await a.strona.click('#obrazy-zamknij');
  await b.strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.type === 'rect'); o.set({ left: 33 }); o.setCoords(); e.zatwierdz(); });
  await zapisano(a.strona);
  await zapisano(b.strona);
  await b.strona.waitForFunction((z) => !window.seriodruk.stan.projekt.zasoby[z] && window.seriodruk.stan.projekt.zasoby_usuniete?.includes(z), id, { timeout: 10000 });
  await a.strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((x) => x.type === 'rect')?.left === 33, null, { timeout: 10000 });
  await zapisano(a.strona);
  await zapisano(b.strona);
  const dane = a.baza.projekty[0].dane;
  assert.equal(dane.zasoby[id], undefined, 'obrazu nie ma na koncie');
  assert.ok(dane.zasoby_usuniete.includes(id));
  assert.equal(await a.strona.evaluate((z) => Boolean(window.seriodruk.stan.projekt.zasoby[z]), id), false);
  assert.deepEqual([a.bledy, b.bledy], [[], []]);
});

test('starszy projekt z powtórzonymi obrazami: okno proponuje „Uporządkuj” – kopie scalone, zajęte nazwy z „(2)”, dane bez zmian w wyglądzie', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Stary');
  // Projekt sprzed okna obrazów: ten sam plik trzy razy (dwa razy jako „foto.jpg”, raz jako „inne.png”)
  // i inny plik też jako „foto.jpg”. Na stronie elementy wskazują kopię i ten inny plik; tabela – „inne.png”.
  await strona.evaluate(async () => {
    const plik = (k) => { const c = document.createElement('canvas'); c.width = 6; c.height = 4; const x = c.getContext('2d'); x.fillStyle = k; x.fillRect(0, 0, 6, 4); return c.toDataURL('image/png'); };
    const X = plik('#0a0');
    const Y = plik('#00a');
    const p = window.seriodruk.stan.projekt;
    Object.assign(p.zasoby, {
      z_a: { nazwa: 'foto.jpg', dataUrl: X }, z_b: { nazwa: 'foto.jpg', dataUrl: X }, z_c: { nazwa: 'foto.jpg', dataUrl: Y }, z_d: { nazwa: 'inne.png', dataUrl: X },
    });
    const obraz = (id, zasob, left) => ({ type: 'image', id, zasob, src: `zasob:${zasob}`, left, top: 20, width: 6, height: 4, scaleX: 5, scaleY: 5, originX: 'left', originY: 'top' });
    p.strony[0].obiekty.push(obraz('e1', 'z_b', 20), obraz('e2', 'z_c', 60));
    p.tabele.push({ id: 't1', nazwa: 'Dane', kolumny: ['obraz'], wiersze: [['inne.png'], ['foto.jpg']] });
    await (await import('./js/app/zapis.js')).zaladujCel();
  });
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="obrazy"]');
  await strona.waitForSelector('#dlg-obrazy[open]');
  await strona.waitForSelector('#obrazy-porzadek:not([hidden])');
  assert.match(await strona.textContent('#obrazy-porzadek-opis'), /2 kopie plików, które już są i 1 obraz o zajętej nazwie/);
  await strona.click('#obrazy-uporzadkuj');
  await strona.click('#potwierdz-tak');
  await strona.waitForSelector('#obrazy-porzadek[hidden]', { state: 'attached' });
  const stan = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    const nazwa = (id) => p.zasoby[id]?.nazwa;
    const el = Object.fromEntries(window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'image').map((o) => [o.id, o.zasob]));
    return {
      nazwy: Object.values(p.zasoby).map((z) => z.nazwa).sort(),
      e1: nazwa(el.e1), e2: nazwa(el.e2), e1zostaje: el.e1 === 'z_a',
      dane: p.tabele.find((x) => x.id === 't1').wiersze.map((w) => w[0]),
      nagrobki: [...(p.zasoby_usuniete || [])].sort(),
    };
  });
  // Został jeden „foto.jpg” (ten, który dane wskazywały), inny plik dostał „foto (2).jpg”, „inne.png” scalony.
  assert.deepEqual(stan.nazwy, ['foto (2).jpg', 'foto.jpg']);
  assert.equal(stan.e1, 'foto.jpg');
  assert.ok(stan.e1zostaje, 'kopia przepięta na obraz, który zostaje');
  assert.equal(stan.e2, 'foto (2).jpg', 'element z innym plikiem pokazuje dalej ten sam obraz');
  assert.deepEqual(stan.dane, ['foto.jpg', 'foto.jpg'], 'komórka ze scaloną kopią wskazuje obraz, który zostaje');
  assert.deepEqual(stan.nagrobki, ['z_b', 'z_c', 'z_d']);
  // Cofnięcie nie przywraca elementów wskazujących usunięte obrazy.
  await strona.click('#obrazy-zamknij');
  await strona.keyboard.press('Control+z');
  const poCofnieciu = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    return p.strony[0].obiekty.filter((o) => o.type === 'image').every((o) => p.zasoby[o.zasob]);
  });
  assert.ok(poCofnieciu);
  assert.deepEqual(bledy, []);
});

test('okno obrazów na telefonie: prawie cała szerokość, pasek zaznaczenia nad siatką, przyciski na dole widoczne', async (t) => {
  for (const widok of [{ width: 412, height: 839 }, { width: 360, height: 760 }]) {
    const { strona, bledy } = await otworz(t, { widok });
    await nowyProjekt(strona, 'Telefon');
    const pliki = [];
    for (const [k, n] of [['#d33', 'gory-zima-na-szczycie-dlugiej-nazwy.jpg'], ['#3a3', 'laka.png'], ['#33d', 'morze.png']]) pliki.push(await png(strona, k, n));
    await strona.evaluate(async () => (await import('./js/app/obrazy-okno.js')).otworzObrazy());
    await strona.setInputFiles('#pliki-zasoby', pliki);
    await strona.waitForFunction(() => document.querySelectorAll('#obrazy-lista li').length === 3);
    const w = await strona.evaluate(() => {
      const d = document.querySelector('#dlg-obrazy').getBoundingClientRect();
      const wystaja = [...document.querySelectorAll('#dlg-obrazy button')].filter((b) => b.offsetParent)
        .filter((b) => { const r = b.getBoundingClientRect(); return r.right > d.right + 1 || r.left < d.left - 1 || r.bottom > innerHeight + 1; })
        .map((b) => b.textContent.trim() || b.getAttribute('aria-label'));
      return {
        szerokosc: d.width / innerWidth,
        wystaja,
        pasekNadSiatka: document.querySelector('#obrazy-pasek').getBoundingClientRect().bottom <= document.querySelector('#obrazy-lista').getBoundingClientRect().top + 1,
        kolumny: getComputedStyle(document.querySelector('#obrazy-lista')).gridTemplateColumns.split(' ').length,
      };
    });
    assert.ok(w.szerokosc > 0.95, `okno zajmuje ${Math.round(w.szerokosc * 100)}% szerokości przy ${widok.width} px`);
    assert.deepEqual(w.wystaja, [], `przy ${widok.width} px nic nie wystaje poza okno i ekran`);
    assert.ok(w.pasekNadSiatka, 'pasek zaznaczenia nie wchodzi pod obrazy');
    assert.equal(w.kolumny, 2);
    assert.deepEqual(bledy, []);
  }
});
