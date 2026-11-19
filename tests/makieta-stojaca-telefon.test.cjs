// Zgłoszenie 19.11: „Podgląd 3D dalej się wywala na Androidzie i na stojąco książka wygląda brzydko i się psuje”.
// 1) Stojąca książka: zgięcie w „V” liczone z położenia kartek – stosy sztywno, przewracana kartka według swojego kąta,
//    bryła wyśrodkowana między skrajnymi kartkami (wcześniej cała książka skokowo składała się w V już przy u = 0,02); kamera po otwarciu sama
//    obraca się na wprost (obie połowy widać tak samo), po zamknięciu wraca na ¾, a gdy użytkownik obróci widok – zostaje.
// 2) Telefon: rozpoznany także w trybie „wersja na komputer” (Android podaje się wtedy za Linuksa); mniejsze limity
//    pamięci (10 stron, płótno ≤ 2,2 mln px); po nieoczekiwanym zamknięciu karty z makietą – tryb oszczędny z uwagą.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const modul = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('stojąca książka: zgięcie V z położenia kartek – bez skoku bryły przy otwieraniu i zamykaniu', async () => {
  const { kartkiModelu, scena, obwiednia } = await modul('js/makieta-3d.js');
  const k = kartkiModelu('ksiazka_twarda', { strony: 40, format: { w: 148, h: 210 }, okladka: { w: 148, h: 210 }, kartka_mm: 0.1 });
  const n = k.length;
  const glebia = (u) => { const o = obwiednia(scena('ksiazka_twarda', k, u, { ulozenie: 'stoi' })); return o.max[2] - o.min[2]; };
  // Między kolejnymi małymi krokami położenia bryła zmienia się płynnie (żadnego skoku o kilkadziesiąt mm).
  for (const [a, b] of [[0, 0.03], [0.03, 0.08], [n - 0.03, n], [n - 0.08, n - 0.03]]) {
    const r = Math.abs(glebia(a) - glebia(b));
    assert.ok(r < 15, `głębokość ${a} → ${b}: zmiana o ${r.toFixed(1)} mm`);
  }
  // Otwarta (u = 1 i dalej) – pełne V jak dotąd (ok. 110°).
  assert.ok(glebia(1) > 60 && Math.abs(glebia(1) - glebia(5)) < 15, `V po otwarciu: ${glebia(1).toFixed(0)} / ${glebia(5).toFixed(0)} mm`);
});

test('telefon rozpoznany także w trybie „wersja na komputer” i przy małej pamięci', async (t) => {
  const { strona } = await otworz(t, { widok: { width: 1200, height: 800 } });
  const w = await strona.evaluate(async () => {
    const { maloPamieci } = await import('./js/app/makieta-okno.js');
    const komputerowy = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    return [
      maloPamieci('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130.0 Mobile', {}, false),
      maloPamieci(komputerowy, { maxTouchPoints: 5 }, false), // Android w trybie komputerowym
      maloPamieci(komputerowy, { maxTouchPoints: 0, deviceMemory: 8 }, false), // zwykły komputer z Linuksem
      maloPamieci('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', { maxTouchPoints: 0, deviceMemory: 2 }, false), // mała pamięć
    ];
  });
  assert.deepEqual(w, [true, true, false, true]);
});

// Książka w miękkiej oprawie z szablonu (ok. 66 stron).
const otworzKsiazke = async (strona, nazwa) => {
  await nowyProjekt(strona, 'Start');
  await strona.evaluate(async (n) => {
    const { zbudujProjekt } = await import('./js/szablony-projektow.js');
    const p = await zbudujProjekt('ksiazka-miekka', { nazwa: n });
    await (await import('./js/app/zapis.js')).otworzProjekt(p);
  }, nazwa);
  await strona.waitForFunction((n) => window.seriodruk.stan.projekt?.nazwa === n && window.seriodruk.edytor?.wydruk, nazwa);
  await strona.evaluate(async () => {
    const W = await import('./js/app/makieta-okno.js');
    W.otworzMakiete(window.seriodruk.stan.projekt);
    document.querySelector('#makieta-model').value = 'ksiazka_miekka';
    document.querySelector('#makieta-model').dispatchEvent(new Event('change'));
  });
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 60000 });
};

test('stojąca: kamera sama na wprost po otwarciu, na ¾ po zamknięciu; obrót ręką ją zatrzymuje', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1200, height: 800 } });
  await otworzKsiazke(strona, 'Stojąca');
  const obrot = () => strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).stanMakiety().kamera.obrotY);
  const czekaj = (cel) => strona.waitForFunction(async (c) => Math.abs((await import('./js/app/makieta-okno.js')).stanMakiety().kamera.obrotY - c) < 0.01, cel, { timeout: 10000 });
  const { widokModelu, OBROT_OTWARTEJ_STOJACEJ } = await strona.evaluate(async () => { const M = await import('./js/makieta-3d.js'); return { widokModelu: M.widokModelu('ksiazka_miekka', 'stoi'), OBROT_OTWARTEJ_STOJACEJ: M.OBROT_OTWARTEJ_STOJACEJ }; });
  await strona.evaluate(async () => (await import('./js/app/makieta-okno.js')).ustawUlozenie('stoi'));
  assert.ok(Math.abs(await obrot() - widokModelu.obrotY) < 0.01, 'zamknięta – ¾');
  await strona.click('#makieta-dalej');
  await czekaj(OBROT_OTWARTEJ_STOJACEJ);
  await strona.click('#makieta-wstecz');
  await czekaj(widokModelu.obrotY);
  // Obrót palcem / myszą – kamera zostaje tam, gdzie ją ustawiono.
  const r = await strona.locator('#makieta-plotno').boundingBox();
  await strona.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await strona.mouse.down();
  await strona.mouse.move(r.x + r.width / 2 + 60, r.y + r.height / 2, { steps: 6 });
  await strona.mouse.up();
  const po = await obrot();
  await strona.click('#makieta-dalej');
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true');
  await strona.waitForTimeout(600);
  assert.ok(Math.abs(await obrot() - po) < 0.01, 'po obrocie ręką – bez samoczynnego obracania');
  assert.deepEqual(bledy, []);
});

test('telefon: mniejsze limity; po nieoczekiwanym zamknięciu karty – tryb oszczędny z uwagą', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await otworzKsiazke(strona, 'Telefon');
  const m = await strona.evaluate(async () => {
    const W = await import('./js/app/makieta-okno.js');
    for (let u = 0; u <= 30; u += 3) {
      W.ustawPolozenieMakiety(u, { natychmiast: true });
      await new Promise((ok) => { setTimeout(ok, 300); });
    }
    const c = document.querySelector('#makieta-plotno');
    return { ...W.pamiecStronMakiety(), piksele: c.width * c.height, znacznik: localStorage.getItem('makieta-otwarta') !== null };
  });
  assert.equal(m.maloPamieci, true);
  assert.equal(m.limit, 10);
  assert.ok(m.stron <= m.limit + 4, `${m.stron} stron w pamięci`);
  assert.ok(m.piksele <= 2.25e6, `płótno ${m.piksele} px`);
  assert.equal(m.znacznik, true, 'znacznik otwartej makiety');
  // Zamknięcie okna zdejmuje znacznik.
  await strona.evaluate(() => document.querySelector('[data-akcja="makieta-zamknij"]').click());
  await strona.waitForFunction(() => localStorage.getItem('makieta-otwarta') === null);
  // Karta zamknięta przez przeglądarkę (znacznik został) → następne otwarcie: tryb oszczędny i uwaga.
  await strona.evaluate(async () => {
    localStorage.setItem('makieta-otwarta', '1');
    (await import('./js/app/makieta-okno.js')).otworzMakiete(window.seriodruk.stan.projekt);
  });
  await strona.waitForFunction(() => document.querySelector('#makieta-plotno').dataset.gotowe === 'true', null, { timeout: 60000 });
  const o = await strona.evaluate(async () => ({ ...(await import('./js/app/makieta-okno.js')).pamiecStronMakiety(), uwaga: document.querySelector('#makieta-uwaga').textContent }));
  assert.equal(o.oszczedny, true);
  assert.equal(o.limit, 6);
  assert.match(o.uwaga, /zamknęła się nieoczekiwanie.*trybie oszczędnym/);
  assert.deepEqual(bledy, []);
});

// Daleki skok listą „Rozkładówka” (zgłoszenie 19.11, przy przeglądzie notesu): wcześniej makieta przewracała po kolei
// każdą kartkę po drodze – 66 stron przez ok. 36 s, wszystkie rysowane i trzymane w pamięci (telefon zamykał kartę).
// Teraz od razu kartka przed celem, przewraca się tylko ostatnia; strony pośrodku się nie wczytują.
test('daleki skok rozkładówką – bez przewracania wszystkich kartek po drodze', async (t) => {
  const { strona, bledy } = await otworz(t, { widok: { width: 1200, height: 800 } });
  await otworzKsiazke(strona, 'Skok');
  const w = await strona.evaluate(async () => {
    const W = await import('./js/app/makieta-okno.js');
    const ladowane = new Set();
    const st0 = performance.now();
    const s = document.querySelector('#makieta-rozkladowka');
    const max = W.stanMakiety().polozen;
    s.value = String(max);
    s.dispatchEvent(new Event('change'));
    while (performance.now() - st0 < 15000) {
      for (const k of W.stanMakiety().wToku) ladowane.add(k);
      if (document.querySelector('#makieta-plotno').dataset.gotowe === 'true' && W.stanMakiety().u === max) break;
      await new Promise((ok) => { setTimeout(ok, 50); });
    }
    return { czas: performance.now() - st0, u: W.stanMakiety().u, max, ladowane: [...ladowane] };
  });
  assert.equal(w.u, w.max);
  assert.ok(w.czas < 8000, `skok na koniec trwał ${Math.round(w.czas)} ms`);
  const strony = w.ladowane.filter((k) => k.startsWith('p:')).map((k) => Number(k.slice(2)));
  assert.ok(strony.every((n) => n >= w.max * 2 - 8), `wczytane tylko strony przy końcu: ${strony}`);
  assert.deepEqual(bledy, []);
});
