// Telefon (#152): pola wyboru kwadratowe (reguła „pod palec” ich nie wyciąga), okienka list i koloru
// wysuwane od dołu mają paseczek, który je zamyka (bez otwierania pola pod spodem), a wielokąt zmienia się
// gotowymi kształtami we Właściwościach → Kształt.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('telefon: kwadratowe pola wyboru, paseczek w okienkach list i koloru, kształt wielokąta we Właściwościach', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Kontrolki');
  await strona.evaluate(() => window.seriodruk.edytor.dodajWielokat(3, false));
  await strona.tap('button:has-text("Właściwości")');
  await strona.waitForSelector('.wybor-wielokata');
  // Pola wyboru we właściwościach (np. „Gwiazda”) – 18×18.
  const pola = await strona.evaluate(() => [...document.querySelectorAll('.wlasciwosci input[type=checkbox]')].map((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }).filter(([w]) => w));
  assert.ok(pola.length > 0);
  for (const p of pola) assert.deepEqual(p, [18, 18]);
  // Gotowy kształt: gwiazda 6, miejsce zostaje.
  const przed = await strona.evaluate(() => window.seriodruk.edytor.aktywny.getCenterPoint());
  await strona.locator('.wybor-wielokata [aria-label="Gwiazda 6"]').tap();
  const po = await strona.evaluate(() => { const a = window.seriodruk.edytor.aktywny; return { boki: a.boki, gwiazda: Boolean(a.gwiazda), c: a.getCenterPoint(), wcisniety: document.querySelector('.wybor-wielokata [aria-pressed="true"]')?.getAttribute('aria-label') }; });
  assert.equal(po.boki, 6);
  assert.equal(po.gwiazda, true);
  assert.equal(po.wcisniety, 'Gwiazda 6');
  assert.ok(Math.abs(po.c.x - przed.x) < 0.5 && Math.abs(po.c.y - przed.y) < 0.5);
  // Lista wyboru od dołu: paseczek u góry, stuknięcie zamyka i nie otwiera nic pod spodem.
  await strona.locator('.wlasciwosci .wybor-przycisk').first().tap();
  await strona.waitForSelector('.okienko-zaslonka > .uchwyt-okienka');
  await strona.tap('.okienko-zaslonka > .uchwyt-okienka');
  await strona.waitForTimeout(300);
  assert.equal(await strona.locator('.okienko-zaslonka').count(), 0);
  // Kolor: też z paseczkiem.
  const k = strona.locator('.wlasciwosci .kolor-przycisk').first();
  await k.scrollIntoViewIfNeeded();
  await k.tap();
  await strona.waitForSelector('.kolor-okienko.okienko-zaslonka > .uchwyt-okienka');
  await strona.tap('.okienko-zaslonka > .uchwyt-okienka');
  await strona.waitForTimeout(300);
  assert.equal(await strona.locator('.okienko-zaslonka').count(), 0);
  assert.deepEqual(bledy, []);
});

// Długa lista w okienku (zasłonce) na telefonie: cała widoczna od paseczka, nie przycięta przez okno (#165);
// wybór opcji działa.
test('telefon: długa lista wyboru w okienku nie jest ucięta od góry, wybór działa', async (t) => {
  const { strona, bledy } = await otworz(t, { telefon: true });
  await nowyProjekt(strona, 'Lista');
  await strona.evaluate(() => {
    const f = document.querySelector('#dlg-tabela form');
    const s = document.createElement('select');
    s.name = 'proba';
    for (let i = 0; i < 40; i += 1) s.add(new Option(`Opcja ${i}`, String(i)));
    f.prepend(s);
    document.querySelector('#dlg-tabela').showModal();
  });
  await strona.waitForTimeout(600);
  await strona.locator('#dlg-tabela .wybor-przycisk').first().tap();
  await strona.waitForSelector('.okienko-zaslonka > .uchwyt-okienka');
  const w = await strona.evaluate(() => {
    const o = document.querySelector('.okienko-zaslonka');
    const u = o.querySelector('.uchwyt-okienka').getBoundingClientRect();
    const r = o.getBoundingClientRect();
    const naGorze = document.elementFromPoint(u.left + u.width / 2, u.top + u.height / 2);
    return { widacUchwyt: naGorze === o.querySelector('.uchwyt-okienka'), wEkranie: r.top >= 0 && r.bottom <= innerHeight + 1 };
  });
  assert.deepEqual(w, { widacUchwyt: true, wEkranie: true });
  await strona.locator('.okienko-zaslonka .wybor-opcja', { hasText: 'Opcja 2' }).first().tap();
  await strona.waitForTimeout(300);
  assert.equal(await strona.evaluate(() => document.querySelector('#dlg-tabela select[name=proba]').value), '2');
  assert.equal(await strona.locator('.okienko-zaslonka').count(), 0);
  assert.deepEqual(bledy, []);
});
