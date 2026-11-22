// iPhone i iPad w emulacji Chromium (#186): to, co z ręcznej listy dla iPhone'a (docs/TESTY.md) da się
// sprawdzić bez prawdziwego Safari – ekran, dotyk wieloma palcami, zasłonki od dołu, makieta 3D, wycięcie
// ekranu (bezpieczne marginesy) i klawiatura ekranowa. To nadal Chromium z nagłówkiem i wymiarami iPhone'a,
// nie silnik WebKit: rzeczy typowe tylko dla Safari (np. jego paski, gumowe przewijanie) zostają na liście ręcznej.
//
// Zrzuty ekranu (oba motywy): ZRZUTY_IPHONE=/ścieżka node --test tests/iphone-emulacja.test.cjs

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const ZRZUTY = process.env.ZRZUTY_IPHONE || '';
async function zrzut(strona, nazwa) {
  if (!ZRZUTY) return;
  fs.mkdirSync(ZRZUTY, { recursive: true });
  await strona.screenshot({ path: path.join(ZRZUTY, `${nazwa}.png`) });
}

// Palce przez protokół przeglądarki (kilka naraz – Playwright ma tylko pojedyncze stuknięcie).
async function palce(kontekst, strona) {
  const cdp = await kontekst.newCDPSession(strona);
  const dotyk = (type, pkt = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pkt.map((q, i) => ({ x: q[0], y: q[1], id: i })) });
  return {
    dotyk,
    async ciagnij(a, b, kroki = 10, przerwa = 0) {
      await dotyk('touchStart', [a]);
      for (let i = 1; i <= kroki; i += 1) {
        await dotyk('touchMove', [[a[0] + ((b[0] - a[0]) * i) / kroki, a[1] + ((b[1] - a[1]) * i) / kroki]]);
        if (przerwa) await strona.waitForTimeout(przerwa);
      }
      await dotyk('touchEnd');
    },
    async szczypnij(x, y, od, do_, kroki = 10) {
      await dotyk('touchStart', [[x - od, y], [x + od, y]]);
      for (let i = 1; i <= kroki; i += 1) {
        const d = od + ((do_ - od) * i) / kroki;
        await dotyk('touchMove', [[x - d, y], [x + d, y]]);
      }
      await dotyk('touchEnd');
    },
  };
}

// Punkt środka elementu na ekranie (w pikselach okna).
const srodekElementu = (strona) => strona.evaluate(() => {
  const e = window.seriodruk.edytor;
  const o = e.canvas.getObjects().at(-1);
  const r = e.canvas.upperCanvasEl.getBoundingClientRect();
  const c = o.getCenterPoint();
  const v = e.canvas.viewportTransform;
  return { x: r.left + v[4] + c.x * v[0], y: r.top + v[5] + c.y * v[0], left: o.left, skala: v[0] };
});

// Projekt z trzema stronami, na każdej prostokąt w innym kolorze na całą stronę (do sprawdzania mignięcia).
async function trzyStrony(strona) {
  await strona.evaluate(async () => {
    const P = await import('./js/projekt.js');
    const p = window.seriodruk.stan.projekt;
    while (p.strony.length < 3) p.strony.push(P.nowaStrona(`Strona ${p.strony.length + 1}`, p.sekcje[0].id));
  });
}

for (const urzadzenie of ['iPhone 14', 'iPhone SE']) {
  test(`${urzadzenie} (emulacja): przeciąganie palcem, szczypanie powiększa stronę (nie całą aplikację), szybki gest zmienia stronę bez mignięcia`, async (t) => {
    const { strona, kontekst, bledy } = await otworz(t, { urzadzenie });
    assert.equal(await strona.evaluate(() => document.documentElement.dataset.urzadzenie), 'telefon');
    await nowyProjekt(strona, 'iPhone');
    await trzyStrony(strona);
    const p = await palce(kontekst, strona);

    // 1. Element przeciągany palcem.
    await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
    await strona.evaluate(() => window.seriodruk.edytor.canvas.discardActiveObject());
    const a = await srodekElementu(strona);
    await p.ciagnij([a.x, a.y], [a.x + 40, a.y + 30]);
    await strona.waitForTimeout(200);
    const poRuchu = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().at(-1).left);
    assert.ok(Math.abs(poRuchu - (a.left + 40 / a.skala)) < 4, `element przesunięty palcem: ${a.left} → ${poRuchu}`);

    // 2. Dwa palce: powiększa się strona projektu, a nie cała aplikacja (skala okna przeglądarki zostaje 1).
    const przed = await strona.evaluate(() => ({ zoom: window.seriodruk.edytor.zoom, skala: visualViewport.scale }));
    const r = await strona.evaluate(() => { const b = window.seriodruk.edytor.canvas.upperCanvasEl.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.75 }; });
    await p.szczypnij(r.x, r.y, 30, 90);
    await strona.waitForTimeout(250);
    const po = await strona.evaluate(() => ({ zoom: window.seriodruk.edytor.zoom, skala: visualViewport.scale, pasek: document.querySelector('#ekran-edytora .pasek-aplikacji').getBoundingClientRect().width }));
    assert.ok(po.zoom > przed.zoom * 1.5, `strona projektu powiększona (${przed.zoom} → ${po.zoom})`);
    assert.equal(po.skala, 1, 'cała aplikacja nie powiększyła się');
    assert.equal(Math.round(po.pasek), strona.viewportSize().width, 'pasek aplikacji ma szerokość ekranu');
    await strona.evaluate(() => window.seriodruk.edytor.dopasujDoOkna());
    await strona.waitForTimeout(200);

    // 3. Szybki gest w poziomie: następna strona; w żadnej klatce płótno nie jest puste bez obrazu poprzedniej strony.
    await strona.evaluate(() => {
      window.__klatki = [];
      const zapisz = () => {
        const c = window.seriodruk.edytor.canvas;
        const g = c.lowerCanvasEl.getContext('2d');
        const w = c.lowerCanvasEl.width; const h = c.lowerCanvasEl.height;
        const px = g.getImageData(Math.round(w / 2), Math.round(h / 2), 1, 1).data;
        window.__klatki.push({ obraz: Boolean(document.querySelector('.zamrozony-obraz')), alfa: px[3], widac: c.lowerCanvasEl.getBoundingClientRect().width > 10 });
        if (window.__klatki.length < 90) requestAnimationFrame(zapisz);
      };
      requestAnimationFrame(zapisz);
    });
    const s = await strona.evaluate(() => { const b = window.seriodruk.edytor.canvas.upperCanvasEl.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.85 }; });
    await p.ciagnij([s.x + 100, s.y], [s.x - 60, s.y], 2);
    await strona.waitForFunction(() => window.__klatki.length >= 90, null, { timeout: 8000 });
    assert.equal(await strona.evaluate(() => window.seriodruk.stan.indeks), 1, 'gest w lewo – następna strona');
    const klatki = await strona.evaluate(() => window.__klatki);
    const puste = klatki.filter((k) => !k.obraz && (!k.widac || k.alfa === 0));
    assert.deepEqual(puste, [], 'żadnej klatki z pustym płótnem (mignięcie) przy zmianie strony');
    await zrzut(strona, `${urzadzenie.replace(/ /g, '-')}-edytor`);
    assert.deepEqual(bledy, []);
  });
}

test('iPhone 14 (emulacja): lista wyboru i kolor wysuwają się od dołu całe, z paseczkiem; oba motywy', async (t) => {
  const { strona, bledy } = await otworz(t, { urzadzenie: 'iPhone 14' });
  await nowyProjekt(strona, 'Zasłonki');
  await strona.evaluate(() => window.seriodruk.edytor.dodajWielokat(5, false));
  for (const motyw of ['light', 'dark']) {
    await strona.emulateMedia({ colorScheme: motyw });
    await strona.waitForFunction((m) => document.documentElement.dataset.motyw === m, motyw === 'dark' ? 'ciemny' : 'jasny');
    // Druga zakładka „Właściwości” z rzędu zamyka panel – stukamy tylko, gdy jest schowany.
    if (!await strona.isVisible('.wlasciwosci .wybor-przycisk:visible')) await strona.tap('.zakladki-mobilne [data-panel="inspektor"]');
    await strona.waitForSelector('.wlasciwosci .wybor-przycisk:visible');
    for (const [przycisk, okienko] of [['.wlasciwosci .wybor-przycisk:visible', '.wybor-lista'], ['.wlasciwosci .kolor-przycisk:visible', '.kolor-okienko']]) {
      const b = strona.locator(przycisk).first();
      await b.scrollIntoViewIfNeeded();
      await b.tap();
      await strona.waitForSelector(`${okienko}.okienko-zaslonka > .uchwyt-okienka`);
      await strona.waitForTimeout(350); // koniec wjazdu
      const w = await strona.evaluate((sel) => {
        const o = document.querySelector(`${sel}.okienko-zaslonka`);
        const r = o.getBoundingClientRect();
        const u = o.querySelector('.uchwyt-okienka').getBoundingClientRect();
        const naGorze = document.elementFromPoint(u.left + u.width / 2, u.top + u.height / 2);
        return { gora: r.top, dol: r.bottom, szer: r.width, h: innerHeight, w: innerWidth, uchwyt: naGorze === o.querySelector('.uchwyt-okienka') };
      }, okienko);
      assert.ok(w.gora >= 0 && w.dol <= w.h + 1, `${okienko} w całości na ekranie (${w.gora}–${w.dol} z ${w.h})`);
      assert.ok(Math.abs(w.dol - w.h) <= 1, `${okienko} przylega do dołu ekranu`);
      assert.ok(w.szer >= w.w - 1, `${okienko} na całą szerokość`);
      assert.ok(w.uchwyt, `${okienko}: paseczek na wierzchu`);
      await zrzut(strona, `iPhone-14-${okienko.slice(1)}-${motyw === 'dark' ? 'ciemny' : 'jasny'}`);
      await strona.tap(`${okienko}.okienko-zaslonka > .uchwyt-okienka`);
      await strona.waitForTimeout(300);
      assert.equal(await strona.locator('.okienko-zaslonka').count(), 0, `${okienko}: paseczek zamyka`);
    }
  }
  assert.deepEqual(bledy, []);
});

test('iPhone 14 (emulacja): wycięcie ekranu – pasek u góry, zakładki u dołu, zasłonki i okienka poza wycięciem i paskiem systemowym', async (t) => {
  const { strona, bledy } = await otworz(t, { urzadzenie: 'iPhone 14' });
  await nowyProjekt(strona, 'Wycięcie');
  const GORA = 47; const DOL = 34; // iPhone 14: wycięcie u góry, pasek „home” u dołu (pion)
  await strona.evaluate(([g, d]) => {
    document.documentElement.style.setProperty('--bezp-gora', `${g}px`);
    document.documentElement.style.setProperty('--bezp-dol', `${d}px`);
    window.dispatchEvent(new Event('resize'));
  }, [GORA, DOL]);
  await strona.waitForTimeout(300);
  for (const motyw of ['light', 'dark']) {
    await strona.emulateMedia({ colorScheme: motyw });
    await strona.waitForTimeout(150);
    const uklad = await strona.evaluate(() => {
      const widoczne = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent && e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect());
      return {
        gora: Math.min(...widoczne('#ekran-edytora .pasek-aplikacji button')).toString() === 'Infinity' ? null : Math.min(...widoczne('#ekran-edytora .pasek-aplikacji button').map((r) => r.top)),
        dol: Math.max(...widoczne('.zakladki-mobilne button').map((r) => r.bottom)),
        h: innerHeight,
      };
    });
    assert.ok(uklad.gora >= GORA, `przyciski paska u góry pod wycięciem (${uklad.gora} ≥ ${GORA})`);
    assert.ok(uklad.dol <= uklad.h - DOL, `zakładki nad paskiem systemowym (${uklad.dol} ≤ ${uklad.h - DOL})`);
    await zrzut(strona, `iPhone-14-wyciecie-edytor-${motyw === 'dark' ? 'ciemny' : 'jasny'}`);
  }
  // Okno jako zasłonka: przyciski nad paskiem systemowym, paseczek pod wycięciem.
  await strona.evaluate(() => document.querySelector('#dlg-kontakt').showModal());
  await strona.waitForTimeout(500);
  const okno = await strona.evaluate(() => {
    const d = document.querySelector('#dlg-kontakt');
    const r = d.getBoundingClientRect();
    const przyciski = [...d.querySelectorAll('button')].filter((b) => b.offsetParent && !b.classList.contains('uchwyt-zaslonki')).map((b) => b.getBoundingClientRect().bottom);
    return { gora: r.top, dolPrzyciskow: Math.max(...przyciski), dolOkna: r.bottom, h: innerHeight, pad: parseFloat(getComputedStyle(d).paddingBottom) };
  });
  assert.ok(okno.gora >= GORA, `zasłonka zaczyna się pod wycięciem (${okno.gora})`);
  assert.ok(okno.dolPrzyciskow <= okno.h - DOL, `przyciski okna nad paskiem systemowym (${okno.dolPrzyciskow} ≤ ${okno.h - DOL})`);
  await zrzut(strona, 'iPhone-14-wyciecie-okno-ciemny');
  await strona.evaluate(() => document.querySelector('#dlg-kontakt').close());
  // Lista wyboru (Właściwości): od dołu, opcje nad paskiem systemowym.
  await strona.evaluate(() => window.seriodruk.edytor.dodajWielokat(5, false));
  await strona.tap('.zakladki-mobilne [data-panel="inspektor"]');
  await strona.locator('.wlasciwosci .wybor-przycisk:visible').first().tap();
  await strona.waitForSelector('.okienko-zaslonka');
  await strona.waitForTimeout(350);
  const lista = await strona.evaluate(() => {
    const o = document.querySelector('.okienko-zaslonka');
    const opcje = [...o.querySelectorAll('.wybor-opcja')].map((e) => e.getBoundingClientRect());
    return { gora: o.getBoundingClientRect().top, ostatnia: opcje.at(-1)?.bottom, h: innerHeight, przewijana: o.scrollHeight > o.clientHeight, sh: o.scrollHeight, ch: o.clientHeight, st: o.scrollTop };
  });
  assert.ok(lista.gora >= GORA, `okienko listy pod wycięciem (${lista.gora})`);
  if (!lista.przewijana) assert.ok(lista.ostatnia <= lista.h - DOL, `ostatnia opcja nad paskiem systemowym (${lista.ostatnia})`);
  await zrzut(strona, 'iPhone-14-wyciecie-lista-ciemny');
  assert.deepEqual(bledy, []);
});

// Klawiatura ekranowa: na iPhonie okno układu zostaje, maleje tylko widoczny obszar (visualViewport); na
// Androidzie maleje całe okno. Oba warianty: zasłonka z polem zostaje nad klawiaturą, pole z fokusem widać.
for (const wariant of ['iOS (maleje visualViewport)', 'Android (maleje okno)']) {
  test(`iPhone 14 (emulacja): klawiatura ekranowa – ${wariant}: okno nad klawiaturą, pole z fokusem widoczne`, async (t) => {
    const { strona, bledy } = await otworz(t, { urzadzenie: 'iPhone 14' });
    await nowyProjekt(strona, 'Klawiatura');
    // Okno z polami tekstowymi: „Kontakt” – pole wiadomości jest na dole okna, tuż nad klawiaturą.
    await strona.evaluate(() => document.querySelector('#dlg-kontakt').showModal());
    await strona.waitForTimeout(500);
    await strona.locator('#kontakt-tresc').tap();
    const H = strona.viewportSize().height;
    const KLAW = 300;
    if (wariant.startsWith('iOS')) {
      await strona.evaluate(([h, k]) => {
        const vv = window.visualViewport;
        Object.defineProperty(vv, 'height', { configurable: true, get: () => h - k });
        vv.dispatchEvent(new Event('resize'));
      }, [H, KLAW]);
    } else {
      await strona.setViewportSize({ width: strona.viewportSize().width, height: H - KLAW });
    }
    await strona.waitForTimeout(400);
    const w = await strona.evaluate(() => {
      const d = document.querySelector('#dlg-kontakt');
      const a = document.activeElement.getBoundingClientRect();
      const vv = window.visualViewport;
      return {
        widocznyDol: vv.offsetTop + vv.height,
        okno: d.getBoundingClientRect().bottom,
        oknoGora: d.getBoundingClientRect().top,
        pole: [a.top, a.bottom],
        // Początek pola (tam stoi kursor) nie jest zakryty paskiem przycisków okna.
        naWierzchu: document.elementFromPoint(a.left + 20, a.top + 12) === document.activeElement,
        fokus: document.activeElement.tagName,
        klawiatura: document.documentElement.hasAttribute('data-klawiatura'),
      };
    });
    assert.match(w.fokus, /INPUT|TEXTAREA/);
    assert.ok(w.klawiatura, 'aplikacja wie, że klawiatura jest otwarta (data-klawiatura)');
    assert.ok(w.okno <= w.widocznyDol + 1, `dół okna nad klawiaturą (${w.okno} ≤ ${w.widocznyDol})`);
    assert.ok(w.oknoGora >= 0, `góra okna na ekranie (${w.oknoGora})`);
    assert.ok(w.pole[0] >= 0 && w.pole[1] <= w.widocznyDol, `pole z fokusem widoczne (${w.pole} przy widocznym dole ${w.widocznyDol})`);
    assert.ok(w.naWierzchu, 'początek pola nie jest zakryty');
    await zrzut(strona, `iPhone-14-klawiatura-${wariant.startsWith('iOS') ? 'ios' : 'android'}`);
    assert.deepEqual(bledy, []);
  });
}

for (const urzadzenie of ['iPhone 14', 'iPad Mini']) {
  test(`${urzadzenie} (emulacja): makieta 3D rysuje się, obraca palcem, drugie otwarcie i utrata kontekstu`, async (t) => {
    const { strona, kontekst, bledy } = await otworz(t, { urzadzenie });
    await nowyProjekt(strona, 'Makieta');
    await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
    await strona.click('[data-akcja="podglad"]');
    await strona.waitForSelector('.podglad-strona[data-id]');
    const rysuje = () => strona.evaluate(() => {
      const c = document.querySelector('#makieta-plotno');
      const x = document.createElement('canvas'); x.width = 40; x.height = 40;
      const g = x.getContext('2d'); g.drawImage(c, 0, 0, 40, 40);
      const d = g.getImageData(0, 0, 40, 40).data;
      let rozne = 0;
      for (let i = 4; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 30) rozne += 1;
      return { brak: !document.querySelector('#makieta-brak-3d').hidden, rozne };
    });
    const otworzMakiete = async () => {
      await strona.evaluate(() => document.querySelector('[data-akcja="podglad-makieta"]').click());
      await strona.waitForSelector('#dlg-makieta[open]');
      await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 20000 });
      await strona.waitForTimeout(300);
    };
    await otworzMakiete();
    let r = await rysuje();
    assert.equal(r.brak, false, 'jest WebGL');
    assert.ok(r.rozne > 50, `makieta narysowana (${r.rozne})`);
    await zrzut(strona, `${urzadzenie.replace(/ /g, '-')}-makieta`);
    // Obrót palcem.
    const kat = () => strona.evaluate(() => document.querySelector('#makieta-obrot')?.value);
    const przed = await kat();
    const b = await strona.locator('#makieta-plotno').boundingBox();
    const p = await palce(kontekst, strona);
    await p.ciagnij([b.x + b.width / 2 - 60, b.y + b.height / 2], [b.x + b.width / 2 + 60, b.y + b.height / 2], 10, 16);
    await strona.waitForTimeout(400);
    assert.notEqual(await kat(), przed, 'przeciągnięcie palcem obraca makietę');
    // Zamknięcie i drugie otwarcie.
    await strona.evaluate(() => document.querySelector('[data-akcja="makieta-zamknij"]').click());
    await strona.waitForSelector('#dlg-makieta', { state: 'hidden' });
    await otworzMakiete();
    r = await rysuje();
    assert.ok(!r.brak && r.rozne > 50, `drugie otwarcie rysuje (${r.rozne})`);
    // Utrata kontekstu (telefon schowany w tle) i powrót.
    await strona.evaluate(async () => {
      const ext = document.querySelector('#makieta-plotno').getContext('webgl').getExtension('WEBGL_lose_context');
      ext.loseContext();
      await new Promise((ok) => { setTimeout(ok, 200); });
      ext.restoreContext();
    });
    await strona.waitForTimeout(1500);
    r = await rysuje();
    assert.ok(!r.brak && r.rozne > 50, `po utracie kontekstu obraz wraca (${r.rozne})`);
    assert.deepEqual(bledy, []);
  });
}
