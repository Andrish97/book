// Reszta propozycji #103 (#182): segmenty zamiast listy przycisków radiowych w oknie Serii i menu ⋯ na karcie
// obrazu w „Obrazach projektu” (rzadsze działania: zmiana nazwy, podmiana pliku, kopiowanie nazwy, usunięcie).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('Seria: „Ile razy powielić” i „Jak czytać tabelę” jako segmenty', async (t) => {
  for (const widok of [{ width: 1280, height: 850 }, { width: 360, height: 760 }]) {
    const { strona, bledy } = await otworz(t, { widok });
    await nowyProjekt(strona, 'Seria');
    await strona.evaluate(async () => {
      const { dane } = await import('./js/app/skladniki.js');
      dane.otworzSerie(dane.nowaSeria().id);
    });
    await strona.waitForSelector('#dlg-seria[open]');
    assert.equal(await strona.locator('#dlg-seria .przelacznik-segmentowy[role="radiogroup"] input[name="tryb"]').count(), 2);
    assert.equal(await strona.locator('#dlg-seria .przelacznik-segmentowy[role="radiogroup"] input[name="uklad"]').count(), 2);
    // Bez tabeli „Tyle, ile wierszy tabeli” jest niedostępne – kółko pola wyboru nie prześwituje.
    const wyl = await strona.evaluate(() => {
      const i = document.querySelector('#dlg-seria input[name="tryb"][value="tabela"]');
      return { wylaczone: i.disabled, krycie: getComputedStyle(i).opacity };
    });
    assert.equal(wyl.wylaczone, true);
    assert.equal(wyl.krycie, '0');
    assert.equal(await strona.isVisible('#seria-pole-ile'), true);
    // Napisy segmentów mieszczą się w oknie (telefon).
    const wystaja = await strona.evaluate(() => {
      const d = document.querySelector('#dlg-seria').getBoundingClientRect();
      return [...document.querySelectorAll('#dlg-seria .przelacznik-segmentowy span')].filter((s) => s.offsetParent)
        .filter((s) => { const r = s.getBoundingClientRect(); return r.left < d.left - 1 || r.right > d.right + 1; }).map((s) => s.textContent);
    });
    assert.deepEqual(wystaja, []);
    assert.deepEqual(bledy, []);
  }
});

test('Seria z tabelą: segmenty przełączają tryb i układ', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Seria z tabelą');
  await strona.evaluate(async () => {
    const { stan } = window.seriodruk;
    stan.projekt.tabele = [{ id: 't1', nazwa: 'Dni', kolumny: ['dzien'], wiersze: [['1'], ['2'], ['3']] }];
    const { dane } = await import('./js/app/skladniki.js');
    const s = dane.nowaSeria();
    s.tabela = 't1';
    dane.otworzSerie(s.id);
  });
  await strona.waitForSelector('#dlg-seria[open]');
  await strona.click('#dlg-seria label:has(input[name="tryb"][value="tabela"])');
  assert.equal(await strona.isChecked('#dlg-seria input[name="tryb"][value="tabela"]'), true);
  assert.equal(await strona.isVisible('#seria-pole-ile'), false);
  await strona.click('#dlg-seria label:has(input[name="tryb"][value="stala"])');
  assert.equal(await strona.isVisible('#seria-pole-ile'), true);
  assert.deepEqual(bledy, []);
});

test('Obrazy projektu: menu ⋯ na karcie obrazu', async (t) => {
  for (const widok of [{ width: 1280, height: 850 }, { width: 360, height: 760 }]) {
    const { strona, bledy } = await otworz(t, { widok });
    await nowyProjekt(strona, 'Obrazy');
    const pliki = [];
    for (const [k, n] of [['#d33', 'a.png'], ['#3a3', 'b.png']]) {
      const b64 = await strona.evaluate((kolor) => {
        const c = document.createElement('canvas'); c.width = 6; c.height = 4;
        const x = c.getContext('2d'); x.fillStyle = kolor; x.fillRect(0, 0, 6, 4);
        return c.toDataURL('image/png').split(',')[1];
      }, k);
      pliki.push({ name: n, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    }
    await strona.evaluate(async () => (await import('./js/app/obrazy-okno.js')).otworzObrazy());
    await strona.setInputFiles('#pliki-zasoby', pliki);
    await strona.waitForFunction(() => document.querySelectorAll('#obrazy-lista li').length === 2);
    await strona.waitForFunction(() => !document.querySelector('#dlg-obrazy').classList.contains('zaslonka-wjazd'));
    const karta = strona.locator('#obrazy-lista li', { has: strona.locator('.obraz-nazwa:text-is("b.png")') });
    // Na karcie: Kopiuj nazwę i ⋯ (Zmień nazwę i Podmień plik są w menu).
    assert.equal(await karta.locator('.obraz-akcje [data-rola="nazwa"], .obraz-akcje [data-rola="podmien"]').count(), 0);
    await karta.locator('[data-rola="wiecej"]').click();
    await strona.waitForSelector('#menu-obrazu:not([hidden])');
    // Menu leży w oknie i mieści się na ekranie.
    const m = await strona.evaluate(() => {
      const menu = document.querySelector('#menu-obrazu');
      const r = menu.getBoundingClientRect();
      const pod = document.elementFromPoint(r.left + r.width / 2, r.top + 10);
      return { wOknie: menu.closest('#dlg-obrazy') !== null, naEkranie: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, widoczne: menu.contains(pod) };
    });
    assert.deepEqual(m, { wOknie: true, naEkranie: true, widoczne: true });
    await strona.click('#menu-obrazu [data-op="usun"]');
    await strona.waitForSelector('#dlg-potwierdz[open]');
    await strona.click('#potwierdz-tak');
    await strona.waitForFunction(() => document.querySelectorAll('#obrazy-lista li').length === 1);
    assert.equal(await strona.locator('#obrazy-lista .obraz-nazwa').textContent(), 'a.png');
    assert.equal(await strona.isHidden('#menu-obrazu'), true);
    assert.deepEqual(bledy, []);
  }
});
