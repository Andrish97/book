// Zadania od łącznika AI dla otwartej Makietki (plan H1, H4): obraz z opisu kluczem Gemini z sejfu trafia do ramki,
// link do podglądu z hasłem powstaje jak z okna Udostępnij. Klucz tylko do czytania zadań nie zleca.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
async function poczekaj(fn, ms = 30000) {
  const koniec = Date.now() + ms;
  for (;;) {
    const w = fn();
    if (w) return w;
    if (Date.now() > koniec) throw new Error('Za długo');
    await new Promise((r) => { setTimeout(r, 200); });
  }
}

test('zadania AI: obraz do ramki (Gemini z sejfu) i link do podglądu z hasłem', async (t) => {
  const { strona, kontekst, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Zadania AI');
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  const [pid, idRamki, idStrony] = await strona.evaluate(() => [window.seriodruk.stan.projekt.id, window.seriodruk.edytor.aktywny.id, window.seriodruk.stan.projekt.strony[0].id]);
  await zapisano(strona);
  const gemini = [];
  await kontekst.route('https://generativelanguage.googleapis.com/**', async (r) => {
    gemini.push(1);
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG_2X2.toString('base64') } }] } }], usageMetadata: { promptTokenCount: 60, candidatesTokenCount: 1120 } }) });
  });
  await strona.evaluate(async () => {
    const { sejfKonta } = await import('./js/app/sejf-ai.js'); const s = sejfKonta(); await s.zaloz('haslo-do-kluczy-1'); await s.ustaw('gemini', 'klucz-gemini');
  });
  const konto = baza.konta[0];
  const czyta = baza.ai('utworz_dostep_ai', { p_projekty: [pid], p_opis: 'Claude', p_rola: 'odczyt', p_dni: 1 }, konto).klucz;
  assert.match(baza.ai('ai_zlec_zadanie', { p_klucz: czyta, p_rodzaj: 'link', p_ustawienia: {} }).blad || '', /tylko do (czytania|odczytu)|czyta/i);
  const { klucz } = baza.ai('utworz_dostep_ai', { p_projekty: [pid], p_opis: 'Claude', p_rola: 'edycja', p_dni: 1 }, konto);

  // H1: obraz z opisu do ramki.
  const z = baza.ai('ai_zlec_zadanie', { p_klucz: klucz, p_rodzaj: 'obraz', p_ustawienia: { opis: 'Kot w kapeluszu', gdzie: `strona:${idStrony}`, element: idRamki } });
  assert.equal(z.stan, 'czeka', JSON.stringify(z));
  const gotowy = await poczekaj(() => { const s = baza.ai('ai_stan_eksportu', { p_klucz: klucz, p_id: z.id }); return ['gotowe', 'blad'].includes(s.stan) ? s : null; });
  assert.equal(gotowy.stan, 'gotowe', gotowy.blad);
  assert.match(gotowy.wynik.opis, /Obraz gotowy \(id [^)]+\) w elemencie/);
  assert.equal(gemini.length, 1);
  await strona.waitForFunction((id) => Boolean(window.seriodruk.edytor.canvas.getObjects().find((o) => o.id === id)?.zasob), idRamki, { timeout: 15000 });

  // H4: link do podglądu z hasłem.
  const zl = baza.ai('ai_zlec_zadanie', { p_klucz: klucz, p_rodzaj: 'link', p_ustawienia: { haslo: 'tajne-haslo' } });
  const link = await poczekaj(() => { const s = baza.ai('ai_stan_eksportu', { p_klucz: klucz, p_id: zl.id }); return ['gotowe', 'blad'].includes(s.stan) ? s : null; }, 60000);
  assert.equal(link.stan, 'gotowe', link.blad);
  assert.match(link.wynik.adres, /^http:\/\/[^/]+\/(\w{6}|.*#\/u\/)/);
  assert.equal(link.wynik.haslo, true);
  const u = await strona.evaluate(() => window.seriodruk.stan.projekt.udostepnienia?.[0]);
  assert.equal(u.ochrona.haslo, true);
  assert.ok(link.wynik.adres.endsWith(u.krotki || u.kod));
  assert.deepEqual(bledy, []);
});

test('zadania AI: dymki komiksu (H2) – karta na liście projektów otwiera projekt i stawia dymki ze scenariusza', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Komiks dla AI');
  const pid = await strona.evaluate(async () => {
    const p = window.seriodruk.stan.projekt;
    p.sekcje[0].typ = 'komiks';
    p.tabele.push({ id: 'scen', nazwa: 'Scenariusz', kolumny: ['strona', 'kadr', 'postać', 'tekst', 'rodzaj', 'opis sceny'], wiersze: [['1', '1', 'Ala', 'Cześć, Olu!', 'mowa', ''], ['1', '1', 'Ola', 'Hej!', 'krzyk', '']] });
    await window.seriodruk.przeladuj();
    await window.seriodruk.zapiszTeraz();
    return p.id;
  });
  await zapisano(strona);
  await strona.click('.pasek-edytora [data-akcja="do-projektow"]');
  await strona.waitForFunction(() => document.body.dataset.ekran === 'projekty');
  await poczekaj(() => baza.projekty.find((p) => p.id === pid)?.dane?.tabele?.length);
  const { klucz } = baza.ai('utworz_dostep_ai', { p_projekty: [pid], p_opis: 'Claude', p_rola: 'edycja', p_dni: 1 }, baza.konta[0]);
  const z = baza.ai('ai_zlec_zadanie', { p_klucz: klucz, p_rodzaj: 'dymki', p_ustawienia: {} });
  const gotowy = await poczekaj(() => { const s = baza.ai('ai_stan_eksportu', { p_klucz: klucz, p_id: z.id }); return ['gotowe', 'blad'].includes(s.stan) ? s : null; }, 60000);
  assert.equal(gotowy.stan, 'gotowe', gotowy.blad);
  assert.match(gotowy.wynik.opis, /Dymki: nowe 2/);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt?.id), pid, 'projekt otwarty');
  const teksty = await strona.evaluate(() => window.seriodruk.edytor.canvas.getObjects().filter((o) => o.dymek).map((o) => o.text));
  assert.deepEqual(teksty, ['Cześć, Olu!', 'Hej!']);
  assert.deepEqual(bledy, []);
});
