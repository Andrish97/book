// Historia cofania zapisana na urządzeniu: „Cofnij” działa także po przeładowaniu strony
// i ponownym otwarciu projektu, nie kasuje zmian z innego urządzenia i znika razem z projektem.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, drugieUrzadzenie, nowyProjekt, zaloguj } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
// Zmiana elementu jako osobny krok cofania, zapisana w przeglądarce i na koncie.
async function zmien(strona, fn, arg) {
  await strona.evaluate(fn, arg);
  await strona.waitForTimeout(1200);
  await zapisano(strona);
}
const ustawLewo = (strona, x) => zmien(strona, (v) => {
  const e = window.seriodruk.edytor;
  const o = e.canvas.getObjects().find((k) => k.type === 'rect' && !k.zWzorca);
  o.set({ left: v }); o.setCoords(); e.zatwierdz();
}, x);
const lewo = (strona) => strona.evaluate(() => window.seriodruk.edytor?.canvas.getObjects().find((k) => k.type === 'rect' && !k.zWzorca)?.left ?? null);
const cofnij = async (strona, oczekiwane) => {
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction((v) => (window.seriodruk.edytor?.canvas.getObjects().find((k) => k.type === 'rect' && !k.zWzorca)?.left ?? null) === v, oczekiwane);
};
const poPrzeladowaniu = async (strona) => {
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk.stan?.projekt && window.seriodruk.edytor?.wydruk && document.body.dataset.ekran === 'edytor', null, { timeout: 20000 });
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((k) => k.type === 'rect' && !k.zWzorca));
};
const historieNaUrzadzeniu = (strona) => strona.evaluate(() => new Promise((ok) => {
  const req = indexedDB.open('seriodruk-historia');
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('historie')) { db.close(); ok([]); return; }
    const w = db.transaction('historie', 'readonly').objectStore('historie').getAll();
    w.onsuccess = () => { db.close(); ok(w.result.map((r) => [r.projekt, r.historia.kroki.length, r.historia.i])); };
  };
}));

test('„Cofnij” działa po przeładowaniu strony: kolejne cofnięcia wracają do stanów sprzed zamknięcia; usunięcie projektu czyści historię', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Historia 1');
  await zmien(strona, () => window.seriodruk.edytor.dodajProstokat());
  for (const x of [10, 20, 30]) await ustawLewo(strona, x);
  const id = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  const zapisane = await historieNaUrzadzeniu(strona);
  assert.equal(zapisane.length, 1);
  assert.equal(zapisane[0][0], id);

  await poPrzeladowaniu(strona);
  assert.equal(await lewo(strona), 30);
  assert.equal(await strona.isDisabled('[data-akcja="cofnij"]'), false, 'po przeładowaniu jest co cofać');
  await cofnij(strona, 20);
  await cofnij(strona, 10);
  // Ponowienie też przetrwało.
  await strona.click('[data-akcja="ponow"]');
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().find((k) => k.type === 'rect' && !k.zWzorca)?.left === 20);

  // Zmiana zrobiona tuż przed zamknięciem (zanim stała się krokiem) też da się cofnąć po powrocie.
  await strona.evaluate(() => { const e = window.seriodruk.edytor; const o = e.canvas.getObjects().find((k) => k.type === 'rect' && !k.zWzorca); o.set({ left: 55 }); o.setCoords(); e.zatwierdz(); });
  await strona.evaluate(() => window.seriodruk.zapiszTeraz());
  await poPrzeladowaniu(strona);
  assert.equal(await lewo(strona), 55);
  await cofnij(strona, 20);

  // Usunięcie projektu usuwa jego historię z urządzenia.
  await strona.click('.pasek-edytora [data-akcja="do-projektow"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await strona.evaluate(async (pid) => {
    const { usunHistorie } = await import('./js/historia-zapis.js');
    // Ten sam krok co w menu karty projektu (js/app/projekty.js) – bez okna potwierdzenia.
    await usunHistorie(pid);
  }, id);
  assert.deepEqual(await historieNaUrzadzeniu(strona), []);
  assert.deepEqual(bledy, []);
});

test('usunięcie projektu z listy usuwa jego historię cofania', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Do usunięcia');
  await zmien(strona, () => window.seriodruk.edytor.dodajProstokat());
  assert.equal((await historieNaUrzadzeniu(strona)).length, 1);
  await strona.click('.pasek-edytora [data-akcja="do-projektow"]');
  await strona.waitForSelector('.karta-projektu');
  await strona.click('.karta-projektu .menu-karty');
  await strona.click('.karta-projektu [data-op="usun"]');
  await strona.click('#potwierdz-tak');
  await strona.waitForFunction(() => !document.querySelector('.karta-projektu'));
  assert.deepEqual(await historieNaUrzadzeniu(strona), []);
  assert.deepEqual(bledy, []);
});

test('zmiana z innego urządzenia zrobiona w czasie, gdy projekt był zamknięty, zostaje po cofnięciu', async (t) => {
  const a = await otworz(t);
  await nowyProjekt(a.strona, 'Historia 2');
  await zmien(a.strona, () => window.seriodruk.edytor.dodajProstokat());
  for (const x of [10, 20]) await ustawLewo(a.strona, x);
  // A zamyka projekt (wraca do listy).
  await a.strona.click('.pasek-edytora [data-akcja="do-projektow"]');
  await a.strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');

  // B dodaje elipsę.
  const b = await drugieUrzadzenie(a);
  await zaloguj(b.strona, a.baza);
  await b.strona.click('.karta-projektu .miniatura-karty, .karta-projektu');
  await b.strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((k) => k.type === 'rect' && !k.zWzorca), null, { timeout: 20000 });
  await zmien(b.strona, () => window.seriodruk.edytor.dodajElipse());

  // A otwiera projekt ponownie: elipsa jest, a cofanie zdejmuje tylko zmiany z A.
  await a.strona.click('.karta-projektu .miniatura-karty, .karta-projektu');
  await a.strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((k) => k.type === 'ellipse' && !k.zWzorca), null, { timeout: 20000 });
  assert.equal(await lewo(a.strona), 20);
  // Historia z A wróciła (projekt otworzył się z kopii na urządzeniu) i została przeliczona ze zmianą z B.
  assert.equal(await a.strona.isDisabled('[data-akcja="cofnij"]'), false, 'po powrocie jest co cofać');
  await cofnij(a.strona, 10);
  // Dalej aż do początku: prostokąt dodany na A znika, elipsa z B zostaje.
  for (let n = 0; n < 10 && !(await a.strona.isDisabled('[data-akcja="cofnij"]')); n += 1) {
    await a.strona.click('[data-akcja="cofnij"]');
    await a.strona.waitForTimeout(300);
  }
  assert.equal(await lewo(a.strona), null, 'prostokąt z A cofnięty');
  const elipsy = () => a.strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((k) => k.type === 'ellipse' && !k.zWzorca).length);
  assert.equal(await elipsy(), 1, 'elipsa z drugiego urządzenia zostaje po cofnięciu wszystkich kroków z A');
  assert.deepEqual(a.bledy, []);
  assert.deepEqual(b.bledy, []);
});

test('historia na urządzeniu: rozmiar dla projektu z 40 stronami i 80 krokami', async (t) => {
  const { strona } = await otworz(t);
  await nowyProjekt(strona, 'Duży');
  const w = await strona.evaluate(async () => {
    const { Historia } = await import('./js/historia.js');
    const p = JSON.parse(JSON.stringify(window.seriodruk.stan.projekt));
    const strona0 = p.strony[0];
    const tekst = 'Zażółć gęślą jaźń. '.repeat(20);
    p.strony = Array.from({ length: 40 }, (_, i) => ({ ...strona0, id: `s${i}`, nazwa: `Strona ${i + 1}`,
      obiekty: Array.from({ length: 12 }, (__, k) => ({ type: 'textbox', id: `o${i}_${k}`, left: 10, top: 10 + k * 15, width: 120, text: tekst, fontFamily: 'Inter', fontSize: 4, styles: [] })) }));
    const h = new Historia();
    h.zapisz(p);
    for (let k = 0; k < 90; k += 1) { p.strony[k % 40].obiekty[k % 12].left = 10 + k; h.zapisz(p); }
    const zapis = h.doZapisu();
    const projektu = JSON.stringify(p).length;
    const h2 = new Historia();
    const ok = h2.zZapisu(JSON.parse(JSON.stringify(zapis)));
    return { krokow: zapis.kroki.length, znakow: zapis.znakow, calosc: JSON.stringify(zapis).length, projektu, ok, zgodna: h2.zgodnaZ(p) };
  });
  t.diagnostic(`80 kroków, projekt ${(w.projektu / 1024).toFixed(0)} kB: historia ${(w.calosc / 1024).toFixed(0)} kB (teksty ${(w.znakow / 1024).toFixed(0)} kB)`);
  assert.equal(w.krokow, 80);
  assert.ok(w.ok && w.zgodna);
  assert.ok(w.calosc < w.projektu * 4, `historia ${w.calosc} wobec projektu ${w.projektu}`);
});

test('historia, która nie pasuje do projektu zmienionego gdzie indziej, zaczyna się od nowa – z komunikatem, bez cofania do cudzego stanu', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Historia 3');
  await zmien(strona, () => window.seriodruk.edytor.dodajProstokat());
  await ustawLewo(strona, 10);
  // Projekt zamknięty – zapisana historia już się nie zmienia.
  await strona.click('.pasek-edytora [data-akcja="do-projektow"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  // Zapisana historia udaje stan sprzed zmiany z innego urządzenia: inny ostatni krok i inny numer wersji.
  await strona.evaluate(() => new Promise((ok) => {
    const req = indexedDB.open('seriodruk-historia');
    req.onsuccess = () => {
      const db = req.result;
      const m = db.transaction('historie', 'readwrite').objectStore('historie');
      const w = m.getAll();
      w.onsuccess = () => {
        const r = w.result[0];
        r.wersja_chmury = -5;
        const h = r.historia;
        h.pula.push(h.pula[h.kroki[h.i].r].replace('Historia 3', 'Inna nazwa'));
        h.kroki[h.i].r = h.pula.length - 1;
        m.put(r).onsuccess = () => { db.close(); ok(); };
      };
    };
  }));
  await strona.click('.karta-projektu .miniatura-karty, .karta-projektu');
  await strona.waitForFunction(() => window.seriodruk.edytor?.canvas.getObjects().some((k) => k.type === 'rect' && !k.zWzorca), null, { timeout: 20000 });
  await strona.waitForFunction(() => /Historia cofania zaczyna się od nowa/.test(document.querySelector('#powiadomienie').textContent));
  assert.equal(await strona.isDisabled('[data-akcja="cofnij"]'), true, 'nie ma czego cofać');
  assert.equal(await lewo(strona), 10);
  assert.deepEqual(bledy, []);
});
