// Panel Właściwości bez poziomego przepełnienia (#171): dla każdego rodzaju elementu (i strony, i wzorca)
// żaden przycisk, lista ani pole nie wychodzi poza prawą krawędź panelu – na komputerze w trzech
// szerokościach i na telefonie. Sekcje zwinięte są rozwijane, żeby sprawdzić całą zawartość.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJ0lEQVR4nGP8z8DwnwEJMDKiCjAyMDD8RwgiAyA8DGSgGQ4AAHk1Bf1ZLXjCAAAAAElFTkSuQmCC';

const RODZAJE = [
  ['strona', null],
  ['tekst', (e) => e.dodajTekst('Tekst próbny')],
  ['prostokąt', (e) => e.dodajProstokat()],
  ['elipsa', (e) => e.dodajElipse()],
  ['wielokąt', (e) => e.dodajWielokat(5, true)],
  ['linia', (e) => e.dodajLinie()],
  ['obraz', async (e, zasoby) => e.dodajObraz(window.__png, 'proba.png', zasoby)],
  ['tabela', (e) => e.dodajTabele({ wiersze: 3, kolumny: 3 })],
  ['kod QR', (e) => e.dodajKod('qr')],
  ['kod EAN', (e) => e.dodajKod('ean')],
  ['wykres', (e) => e.dodajWykres()],
  ['kalendarz', (e) => e.dodajKalendarz()],
  ['grupa', (e) => { e.dodajProstokat(); const a = e.aktywny; e.dodajElipse(); const b = e.aktywny; e.canvas.setActiveObject(new fabric.ActiveSelection([a, b], { canvas: e.canvas })); e.grupuj(); }],
  ['zaznaczenie wielu', (e) => { e.dodajProstokat(); const a = e.aktywny; e.dodajTekst('B'); const b = e.aktywny; e.canvas.setActiveObject(new fabric.ActiveSelection([a, b], { canvas: e.canvas })); e.canvas.requestRenderAll(); }],
];

// Zwraca elementy panelu, które wychodzą poza jego prawą krawędź (z opisem), i czy sam panel przewija się w poziomie.
const ucieciaPanelu = (strona) => strona.evaluate(() => {
  const p = document.querySelector('#wlasciwosci');
  const r = p.getBoundingClientRect();
  const prawa = r.right - (p.offsetWidth - p.clientWidth) + 0.5;
  const zle = [];
  for (const el of p.querySelectorAll('*')) {
    if (!el.getClientRects().length || el.closest('.wybor-lista, .kolor-okienko')) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.position === 'fixed') continue;
    const b = el.getBoundingClientRect();
    if (b.width && b.right > prawa) zle.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} „${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}” +${Math.round(b.right - prawa)}px`);
  }
  return { przewija: p.scrollWidth > p.clientWidth + 1, zle: zle.slice(0, 12) };
});

async function sprawdz(t, opcje, nazwa) {
  const { strona, bledy } = await otworz(t, opcje);
  await nowyProjekt(strona, 'Bez ucięć');
  await strona.evaluate((png) => { window.__png = png; }, PNG);
  if (opcje.telefon) await strona.evaluate(() => { document.body.dataset.panel = 'inspektor'; });
  const wynik = [];
  for (const [rodzaj, wstaw] of RODZAJE) {
    await strona.evaluate(async (r) => {
      const e = window.seriodruk.edytor;
      e.canvas.discardActiveObject();
      for (const o of [...e.canvas.getObjects()]) if (!o.zWzorca) e.canvas.remove(o);
      // eslint-disable-next-line no-new-func
      const f = r ? new Function('return ' + r)() : null;
      if (f) await f(e, window.seriodruk.stan.projekt.zasoby);
      e.canvas.requestRenderAll();
    }, wstaw ? wstaw.toString() : null);
    await strona.waitForTimeout(250);
    // Rozwinięcie wszystkich zwiniętych sekcji.
    await strona.evaluate(() => document.querySelectorAll('#wlasciwosci .zwijak[aria-expanded="false"]').forEach((z) => z.click()));
    await strona.waitForTimeout(150);
    const u = await ucieciaPanelu(strona);
    if (u.przewija || u.zle.length) wynik.push(`${nazwa} / ${rodzaj}: ${u.przewija ? 'panel przewija się w poziomie; ' : ''}${u.zle.join('; ')}`);
  }
  // Wzorzec strony.
  await strona.evaluate(async () => {
    const s = window.seriodruk;
    const w = s.stan.projekt.wzorce[0];
    if (w) await s.edytujWzorzec(w.id);
  });
  await strona.waitForTimeout(300);
  const u = await ucieciaPanelu(strona);
  if (u.przewija || u.zle.length) wynik.push(`${nazwa} / wzorzec: ${u.zle.join('; ')}`);
  assert.deepEqual(wynik, [], wynik.join('\n'));
  assert.deepEqual(bledy, []);
}

for (const w of [1000, 1280, 1440]) {
  test(`komputer ${w} px: panel Właściwości bez ucięć dla każdego rodzaju elementu`, (t) => sprawdz(t, { widok: { width: w, height: 900 } }, `${w}px`));
}
test('telefon: panel Właściwości bez ucięć dla każdego rodzaju elementu', (t) => sprawdz(t, { telefon: true }, 'telefon'));
