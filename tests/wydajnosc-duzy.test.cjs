// Wydajność na dużym projekcie (#357): projekt zbudowany na wzór prawdziwego projektu użytkownika (książka-kalendarz:
// ~480 stron z serii, tabele po 365 wierszy, 60 obrazów, strony z setkami elementów). Mierzy to, co się zacinało:
// otwarcie, zatrzymanie po zwykłej zmianie, odciski stron linku, kontrolę projektu, okno „Obrazy projektu”,
// podgląd i przełączenie języka. Każdy pomiar ma limit – gdy coś zwolni, test się wywala. Limity mają zapas
// na wolniejsze maszyny CI; wyniki trafiają do tests/.pomiary-wydajnosci.txt (CI wypisuje je w logu).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const LIMITY = {
  // pomiar lokalny 21.11.2026 w komentarzu; limit ok. 4–5 razy większy (CI bywa wolniejsze), ale dużo poniżej
  // tego, co było przed poprawkami (#343, #344: zatrzymanie po zmianie ok. 370 ms).
  otwarcie: 10000, // 2100 ms – otwarcie projektu do gotowego edytora
  zmianaNajdluzsze: 350, // 94 ms – najdłuższe zatrzymanie strony w ciągu 4 s po zwykłej zmianie
  rozwin: 300, // 3 ms – rozwinięcie serii (409 stron)
  odciski: 400, // 25 ms – odciski stron linku (co się zmieniło)
  kontrola: 800, // 41 ms – kontrola projektu
  oknoObrazowNajdluzsze: 500, // 68 ms – najdłuższe zatrzymanie po otwarciu okna „Obrazy projektu”
  podglad: 3000, // 263 ms – podgląd całego projektu do pierwszej strony
  jezyk: 1000, // 160 ms (przed #358: 670–830 ms) – przełączenie języka całego interfejsu
};

const LIMITY_TELEFON = {
  otwarcie: 15000, // 2300–3000 ms
  zmianaNajdluzsze: 700, // 150–225 ms
  rozwin: 600, // 4–15 ms
  odciski: 800, // 30–65 ms
  kontrola: 1500, // 65–85 ms
  oknoObrazowNajdluzsze: 900, // 170–245 ms
  podglad: 5000, // 400–600 ms
  jezyk: 2000, // ~420 ms
};

// Projekt budowany w przeglądarce (obrazy z płótna), na podstawie świeżego projektu aplikacji.
async function zbudujDuzy(strona) {
  return strona.evaluate(async () => {
    const p = JSON.parse(JSON.stringify(window.seriodruk.stan.projekt));
    const sekcja = p.sekcje[0].id;
    let id = 0;
    const nid = (x) => `${x}_${(id += 1)}`;
    // 60 obrazów 1200 × 800 (JPEG z płótna – różne, żeby nie dało się ich scalić)
    p.zasoby = p.zasoby || {};
    const obrazy = [];
    for (let i = 0; i < 60; i += 1) {
      const c = document.createElement('canvas');
      c.width = 1200; c.height = 800;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 1200, 800);
      gr.addColorStop(0, `hsl(${i * 6}, 60%, 50%)`); gr.addColorStop(1, `hsl(${i * 6 + 90}, 60%, 30%)`);
      g.fillStyle = gr; g.fillRect(0, 0, 1200, 800);
      for (let k = 0; k < 40; k += 1) { g.fillStyle = `hsla(${(i * 37 + k * 11) % 360}, 70%, 60%, .6)`; g.beginPath(); g.arc((k * 97) % 1200, (k * 53) % 800, 30 + (k % 7) * 10, 0, 7); g.fill(); }
      const zid = `z_duzy${i}`;
      p.zasoby[zid] = { nazwa: `zdjecie-${i}.jpg`, typ: 'image/jpeg', szer: 1200, wys: 800, dataUrl: c.toDataURL('image/jpeg', 0.8) };
      obrazy.push(zid);
    }
    // tabele: dni roku i plan (365 wierszy)
    const dni = [];
    for (let d = 0; d < 365; d += 1) dni.push([String(d + 1), ['styczeń', 'luty', 'marzec', 'kwiecień'][d % 4], `Tydzień ${Math.floor(d / 7) + 1}`, `Werset dnia ${d + 1}: ${'słowo '.repeat(12)}`]);
    p.tabele = [{ id: 't_dni', nazwa: 'Dni', kolumny: ['dzien', 'miesiac', 'tydzien', 'werset'], wiersze: dni }];
    // strona serii: dzień z polami
    const poleTekstu = (x, y, tekst, o = {}) => ({ id: nid('t'), type: 'textbox', left: x, top: y, width: 60, text: tekst, fontSize: 4, fontFamily: 'Lato', fill: '#2b3550', ...o });
    const ozdoby = (n, y0) => Array.from({ length: n }, (_, k) => (k % 3 === 0
      ? { id: nid('r'), type: 'rect', left: 10 + (k % 10) * 12, top: y0 + Math.floor(k / 10) * 8, width: 10, height: 6, fill: '#e8ecf5' }
      : k % 3 === 1 ? { id: nid('l'), type: 'line', left: 10, top: y0 + k, x1: 0, y1: 0, x2: 120, y2: 0, stroke: '#c9d1e3', strokeWidth: 0.3 }
        : { id: nid('e'), type: 'ellipse', left: 12 + (k % 10) * 12, top: y0 + Math.floor(k / 10) * 8, rx: 2, ry: 2, fill: '#7c3aed' }));
    p.serie = [{ id: 'se_dni', nazwa: 'Dni', tryb: 'tabela', tabela: 't_dni', ile: 1 }];
    const stronaSerii = { id: nid('s'), nazwa: 'Dzień', sekcja, seria: 'se_dni', obiekty: [
      poleTekstu(10, 10, '{dzien}', { fontSize: 14 }), poleTekstu(40, 12, '{miesiac}'), poleTekstu(40, 20, '{tydzien}'),
      poleTekstu(10, 40, '{werset}', { width: 120 }), ...ozdoby(60, 70)] };
    // 40 stron treści z wieloma elementami, co druga z obrazem
    const tresc = Array.from({ length: 40 }, (_, i) => ({ id: nid('s'), nazwa: `Strona ${i + 1}`, sekcja, obiekty: [
      ...Array.from({ length: 30 }, (_, k) => poleTekstu(10 + (k % 3) * 45, 10 + Math.floor(k / 3) * 14, `Akapit ${k + 1} strony ${i + 1}. ${'Tekst przykładowy do składu. '.repeat(3)}`, { width: 40, fontSize: 3 })),
      ...ozdoby(i % 5 === 0 ? 250 : 80, 160),
      ...(i % 2 === 0 ? [{ id: nid('i'), type: 'image', left: 20, top: 150, width: 1200, height: 800, scaleX: 0.08, scaleY: 0.08, zasob: obrazy[(i / 2) % obrazy.length] }] : []),
    ] }));
    // reszta obrazów na stronach galerii
    const galeria = Array.from({ length: 4 }, (_, i) => ({ id: nid('s'), nazwa: `Galeria ${i + 1}`, sekcja, obiekty: obrazy.slice(20 + i * 10, 30 + i * 10).map((z, k) => ({ id: nid('i'), type: 'image', left: 10 + (k % 2) * 70, top: 10 + Math.floor(k / 2) * 50, width: 1200, height: 800, scaleX: 0.05, scaleY: 0.05, zasob: z })) }));
    p.strony = [...tresc.slice(0, 20), stronaSerii, ...galeria, ...tresc.slice(20)];
    p.nazwa = 'Duży projekt';
    p.id = crypto.randomUUID(); // osobny projekt (ten sam identyfikator co startowy = „zmieniono w innym miejscu”)
    delete p.wersja;
    return p;
  });
}

const zapiszPomiary = (wyniki) => {
  const linia = `${new Date().toISOString()} | ${Object.entries(wyniki).map(([k, v]) => `${k} ${v}`).join(' | ')}\n`;
  try { fs.appendFileSync(path.join(__dirname, '.pomiary-wydajnosci.txt'), linia); } catch { /* bez zapisu */ }
};

async function zmierz(t, wolno, limity) {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Start');
  const p = await zbudujDuzy(strona);
  // procesor wolniejszy (jak słabszy telefon) – drugi test
  if (wolno > 1) await (await strona.context().newCDPSession(strona)).send('Emulation.setCPUThrottlingRate', { rate: wolno });
  const wyniki = {};
  // długie zadania (> 50 ms) głównego wątku
  await strona.evaluate(() => { window.__dlugie = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__dlugie.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); });
  const dlugie = () => strona.evaluate(() => { const d = window.__dlugie.slice(); window.__dlugie = []; return d; });

  let t0 = Date.now();
  await strona.evaluate(async (pr) => { await (await import('./js/app/zapis.js')).otworzProjekt(pr); }, p);
  await strona.waitForFunction(() => window.seriodruk.edytor?.wydruk && window.seriodruk.stan.projekt?.nazwa === 'Duży projekt');
  wyniki.otwarcie = Date.now() - t0;
  await strona.waitForTimeout(3000);
  await dlugie();

  Object.assign(wyniki, await strona.evaluate(async () => {
    const w = {};
    const pr = window.seriodruk.stan.projekt;
    const czas = async (n, f) => { const a = performance.now(); await f(); w[n] = Math.round(performance.now() - a); };
    const { rozwin } = await import('./js/serie.js');
    const { przygotujPublikacje } = await import('./js/publikacja-linku.js');
    const { sprawdzProjekt } = await import('./js/kontrola.js');
    let ciag;
    await czas('rozwin', () => { ciag = rozwin(pr); });
    w.stron = ciag.egzemplarze.length;
    await czas('odciski', () => przygotujPublikacje(pr));
    await czas('kontrola', () => sprawdzProjekt(pr, ciag));
    return w;
  }));
  assert.ok(wyniki.stron >= 400, `stron po rozwinięciu: ${wyniki.stron}`);

  // zwykła zmiana: nowy prostokąt – edytor nie może stanąć na dłużej
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  await strona.waitForTimeout(4000);
  wyniki.zmianaNajdluzsze = Math.max(0, ...(await dlugie()));

  await strona.evaluate(async () => { (await import('./js/app/obrazy-okno.js')).otworzObrazy(); });
  await strona.waitForSelector('#dlg-obrazy[open]');
  await strona.waitForTimeout(3000);
  wyniki.oknoObrazowNajdluzsze = Math.max(0, ...(await dlugie()));
  await strona.evaluate(() => document.querySelector('#dlg-obrazy')?.close());

  t0 = Date.now();
  await strona.click('[data-akcja="podglad"]');
  await strona.waitForFunction(() => document.querySelector('#ekran-podgladu:not([hidden]) img, #ekran-podgladu:not([hidden]) canvas, .podglad-strona img, .podglad-strona canvas'), null, { timeout: 30000 });
  wyniki.podglad = Date.now() - t0;
  await strona.keyboard.press('Escape');

  t0 = Date.now();
  await strona.evaluate(() => import('./js/jezyk.js').then((m) => m.ustawJezyk('en')));
  wyniki.jezyk = Date.now() - t0;
  await strona.evaluate(() => import('./js/jezyk.js').then((m) => m.ustawJezyk('pl')));

  zapiszPomiary({ ...(wolno > 1 ? { procesor: `${wolno}x wolniej` } : {}), ...wyniki });
  t.diagnostic(JSON.stringify(wyniki));
  for (const [k, limit] of Object.entries(limity)) assert.ok(wyniki[k] <= limit, `${k}: ${wyniki[k]} ms (limit ${limit} ms) – ${JSON.stringify(wyniki)}`);
  assert.deepEqual(bledy, []);
}

test('wydajność na dużym projekcie: otwarcie, zmiana, odciski linku, kontrola, okno obrazów, podgląd, język – w limitach', { timeout: 240000 }, (t) => zmierz(t, 1, LIMITY));

// #359: to samo przy procesorze 4 razy wolniejszym – jak na słabszym telefonie (pomiar lokalny w komentarzach).
test('wydajność na dużym projekcie jak na słabszym telefonie (procesor 4× wolniejszy) – w limitach', { timeout: 300000 }, (t) => zmierz(t, 4, LIMITY_TELEFON));

