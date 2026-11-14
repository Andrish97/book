// Wydajność bez zmiany wyglądu (decyzja #83): wspólny wskaźnik postępu dłuższych czynności, trwałe miniatury
// w oknie „Obrazy projektu”, pamięć warstw płótna przy pisaniu i przeciąganiu.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('wskaźnik postępu: pojawia się dopiero po chwili, liczy „i z n”, znika po końcu i po błędzie, idzie do otwartego okna, „Anuluj”', async (t) => {
  const { strona, bledy } = await otworz(t);
  const wynik = await strona.evaluate(async () => {
    const { postep, zPostepem } = await import('./js/postep.js');
    const czekaj = (ms) => new Promise((ok) => { setTimeout(ok, ms); });
    const r = {};
    // Szybka czynność – karta się nie pokazuje.
    const szybki = postep('Szybko');
    await czekaj(100);
    szybki.koniec();
    await czekaj(500);
    r.szybkiWidoczny = Boolean(document.querySelector('.postep'));
    // Dłuższa – karta z licznikiem.
    let anulowano = false;
    const p = postep('Wgrywanie obrazów…', { razem: 10, anuluj: () => { anulowano = true; } });
    await czekaj(500);
    p.krok(3);
    const karta = document.querySelector('.postep');
    r.widoczna = Boolean(karta) && karta.offsetHeight > 0;
    r.opis = karta?.querySelector('.postep-opis').textContent;
    r.licznik = karta?.querySelector('.postep-licznik').textContent;
    r.szerokosc = karta?.querySelector('.postep-wypelnienie').style.width;
    r.status = karta?.getAttribute('role');
    karta.querySelector('.postep-anuluj').click();
    r.anulowano = anulowano;
    p.koniec();
    r.poKoncu = document.querySelectorAll('.postep').length;
    // Bez licznika i z błędem: karta znika także wtedy.
    try {
      await zPostepem('Otwieranie projektu…', async () => {
        await czekaj(500);
        r.nieokreslony = document.querySelector('.postep')?.classList.contains('nieokreslony');
        throw new Error('awaria');
      });
    } catch (e) { r.blad = e.message; }
    r.poBledzie = document.querySelectorAll('.postep').length;
    // Otwarte okno modalne: karta jest w nim (inaczej okno by ją zasłoniło).
    const dlg = document.querySelector('#dlg-potwierdz');
    dlg.showModal();
    const w = postep('W oknie', { opoznienie: 0 });
    await czekaj(30);
    r.wOknie = Boolean(dlg.querySelector('.postep'));
    w.koniec();
    dlg.close();
    return r;
  });
  assert.equal(wynik.szybkiWidoczny, false, 'szybka czynność bez mrugania');
  assert.equal(wynik.widoczna, true);
  assert.equal(wynik.opis, 'Wgrywanie obrazów…');
  assert.equal(wynik.licznik, '3 z 10');
  assert.equal(wynik.szerokosc, '30%');
  assert.equal(wynik.status, 'status');
  assert.equal(wynik.anulowano, true);
  assert.equal(wynik.poKoncu, 0);
  assert.equal(wynik.nieokreslony, true);
  assert.equal(wynik.blad, 'awaria');
  assert.equal(wynik.poBledzie, 0, 'po błędzie karta znika');
  assert.equal(wynik.wOknie, true);
  assert.deepEqual(bledy, []);
});

test('okno „Obrazy projektu”: miniatura zrobiona raz zostaje na urządzeniu – po odświeżeniu strony bierze się z pamięci', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Miniatury');
  // Zdjęcie 1600×1000 – miniatura ma najwyżej 320 px.
  const b64 = await strona.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1600; c.height = 1000;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1600, 1000); g.addColorStop(0, '#c33'); g.addColorStop(1, '#33c');
    x.fillStyle = g; x.fillRect(0, 0, 1600, 1000);
    return c.toDataURL('image/png').split(',')[1];
  });
  await strona.click('#przycisk-wiecej');
  await strona.click('[data-akcja="obrazy"]');
  await strona.waitForSelector('#dlg-obrazy[open]');
  await strona.setInputFiles('#pliki-zasoby', { name: 'duze.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  const miniatura = () => strona.waitForFunction(() => {
    const img = document.querySelector('#obrazy-lista li img');
    const wymiary = img?.closest('li').querySelector('.obraz-wymiary').textContent || '';
    return img && img.naturalWidth && wymiary.includes('×') ? { w: img.naturalWidth, src: img.src.slice(0, 5), wymiary } : null;
  }, null, { timeout: 20000 }).then((h) => h.jsonValue());
  const pierwsza = await miniatura();
  assert.ok(pierwsza.w <= 320, `miniatura ma ${pierwsza.w} px`);
  assert.match(pierwsza.wymiary, /1600 × 1000 px/, 'wymiary oryginału');
  const wpisy = () => strona.evaluate(() => new Promise((ok) => {
    const r = indexedDB.open('seriodruk-miniatury');
    r.onsuccess = () => { const c = r.result.transaction('miniatury').objectStore('miniatury').count(); c.onsuccess = () => { ok(c.result); r.result.close(); }; };
  }));
  await new Promise((ok) => { setTimeout(ok, 500); });
  assert.equal(await wpisy(), 1, 'miniatura zapisana na urządzeniu');
  // Po odświeżeniu: ta sama miniatura z pamięci, bez robienia nowej.
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk?.stan?.projekt || document.body.dataset.ekran === 'projekty', null, { timeout: 20000 });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk, null, { timeout: 20000 }).catch(async () => {
    await strona.click('#lista-projektow li .miniatura-projektu, #lista-projektow li').catch(() => {});
  });
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor?.wydruk, null, { timeout: 20000 });
  const zrobione = await strona.evaluate(async () => {
    const { otworzObrazy } = await import('./js/app/obrazy-okno.js');
    const a = performance.now();
    otworzObrazy();
    await new Promise((ok) => { const s = () => { const i = document.querySelector('#obrazy-lista li img'); if (i?.naturalWidth && i.closest('li').querySelector('.obraz-wymiary').textContent.includes('×')) ok(); else setTimeout(s, 20); }; s(); });
    const img = document.querySelector('#obrazy-lista li img');
    return { ms: performance.now() - a, w: img.naturalWidth, wymiary: img.closest('li').querySelector('.obraz-wymiary').textContent };
  });
  assert.ok(zrobione.w <= 320);
  assert.match(zrobione.wymiary, /1600 × 1000 px/);
  assert.equal(await wpisy(), 1, 'bez drugiej miniatury tego samego pliku');
  assert.deepEqual(bledy, []);
});

test('pamięć warstw płótna: pisanie i przeciąganie na stronie z wieloma elementami wyglądają tak samo jak pełne rysowanie, a rysują mniej', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Warstwy');
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor;
    for (let i = 0; i < 70; i += 1) {
      const o = new fabric.Rect({ left: 10 + (i % 10) * 12, top: 15 + Math.floor(i / 10) * 25, width: 9, height: 9, fill: `hsl(${i * 5}, 70%, 50%)`, strokeWidth: 0 });
      o.id = `r${i}`;
      e.canvas.add(o);
    }
    for (let i = 0; i < 20; i += 1) {
      const o = new fabric.Textbox(`Tekst ${i}`, { left: 15 + (i % 4) * 30, top: 200 + Math.floor(i / 4) * 12, width: 28, fontSize: 4, fontFamily: 'Inter', fill: '#222', strokeWidth: 0 });
      o.id = `t${i}`;
      e.canvas.add(o);
    }
    e.canvas.requestRenderAll();
    e.canvas.fire('object:modified', { target: e.canvas.getObjects().at(-1) });
  });
  // Zapis i ewentualne ponowne wczytanie płótna (czcionki) – przed pomiarami.
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await strona.waitForTimeout(1500);
  const piksele = () => strona.evaluate(() => {
    const c = window.seriodruk.edytor.canvas;
    c.renderAll();
    const el = c.lowerCanvasEl;
    const a = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
    const e = window.seriodruk.edytor;
    const zm = e._zmieniane;
    e._zmieniane = () => null;
    c.renderAll();
    const b = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
    e._zmieniane = zm;
    let rozne = 0;
    for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > 2) rozne += 1;
    return rozne;
  });
  // Przeciąganie elementu myszą.
  const p = await strona.evaluate(() => {
    const c = window.seriodruk.edytor.canvas; const o = c.getObjects().find((x) => x.id === 'r44');
    const p = fabric.util.transformPoint(o.getCenterPoint(), c.viewportTransform); const el = c.upperCanvasEl.getBoundingClientRect();
    return { x: el.left + p.x, y: el.top + p.y };
  });
  await strona.mouse.move(p.x, p.y);
  await strona.mouse.down();
  for (let i = 1; i <= 8; i += 1) await strona.mouse.move(p.x + i * 4, p.y + i * 3);
  const wTrakcie = await strona.evaluate(() => Boolean(window.seriodruk.edytor.canvas._currentTransform));
  assert.equal(wTrakcie, true);
  assert.equal(await piksele(), 0, 'przeciąganie: obraz z pamięci warstw = pełne rysowanie');
  await strona.mouse.up();
  await strona.waitForTimeout(300);
  // Pisanie w ramce pośrodku stosu elementów.
  await strona.evaluate(() => {
    const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((x) => x.id === 't5');
    e.canvas.setActiveObject(o); o.enterEditing(); o.selectionStart = o.text.length; o.selectionEnd = o.text.length;
    // Liczymy elementy rysowane w jednej klatce.
    window.__rysowane = 0;
    for (const x of e.canvas.getObjects()) { const r = x.render.bind(x); x.render = (ctx) => { window.__rysowane += 1; r(ctx); }; }
  });
  await strona.keyboard.type(' abc');
  await strona.waitForTimeout(200);
  const rysowaneW1Klatce = await strona.evaluate(() => { window.__rysowane = 0; window.seriodruk.edytor.canvas.renderAll(); return window.__rysowane; });
  assert.ok(rysowaneW1Klatce <= 3, `w trakcie pisania jedna klatka rysuje ${rysowaneW1Klatce} el. zamiast 90`);
  assert.equal(await piksele(), 0, 'pisanie: obraz z pamięci warstw = pełne rysowanie');
  // Zmiana innego elementu w trakcie pisania (np. przelanie tekstu, element od AI) – pamięć się odświeża.
  await strona.evaluate(() => { const o = window.seriodruk.edytor.canvas.getObjects().find((x) => x.id === 'r3'); o.set({ fill: '#000000', left: o.left + 3 }); });
  assert.equal(await piksele(), 0, 'zmiana elementu spoza pisanego – widać ją od razu');
  assert.deepEqual(bledy, []);
});
