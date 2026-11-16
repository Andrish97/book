// Skrzynka w panelu administratora (#183): filtry listy (nieprzeczytane, z załącznikami, z gwiazdką) razem
// z wyszukiwaniem; własny edytor treści (bez TinyMCE z CDN) – pogrubienie i lista z paska, link, czyszczenie
// wklejonego HTML (bez skryptów i zdarzeń), wysyłka formatowanej treści przez kolejkę.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz } = require('./pomoc.cjs');

const naEkranie = (strona, ekran) => strona.waitForFunction((e) => document.body.dataset.ekran === e, ekran, { timeout: 15000 });
const ileNaLiscie = (strona, n) => strona.waitForFunction((x) => document.querySelectorAll('#admin-watki li').length === x, n, { timeout: 15000 });

test('skrzynka: filtry listy i własny edytor wiadomości (#183)', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  // Żadnych zapytań do CDN edytora (wcześniej TinyMCE z jsDelivr).
  const cdn = [];
  strona.on('request', (r) => { if (/jsdelivr|tinymce/i.test(r.url())) cdn.push(r.url()); });

  baza.pliki.set('poczta/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cennik.pdf', { typ: 'application/pdf', tresc: Buffer.from('%PDF-1.4') });
  baza.adminPoczta.przyjmij({
    od_email: 'ola@przyklad.pl', temat: 'Cennik', tekst: 'W załączniku.',
    zalaczniki: [{ nazwa: 'cennik.pdf', typ: 'application/pdf', rozmiar: 8, klucz: 'poczta/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cennik.pdf' }],
  });
  const gwiazdkowa = baza.adminPoczta.przyjmij({ od_email: 'jan@przyklad.pl', temat: 'Ważne pytanie', tekst: 'Pytanie o termin.' });
  gwiazdkowa.gwiazdka = true;
  gwiazdkowa.przeczytany = true;
  const zwykla = baza.adminPoczta.przyjmij({ od_email: 'ewa@przyklad.pl', temat: 'Podziękowanie', tekst: 'Dziękuję!' });
  zwykla.przeczytany = true;

  baza.administratorzy.add(baza.konta[0].id);
  await strona.reload();
  await naEkranie(strona, 'projekty');
  await strona.evaluate(() => { location.hash = '#/admin'; });
  await naEkranie(strona, 'admin');
  await ileNaLiscie(strona, 3);

  // Filtry – z bazy, razem z folderem.
  const filtr = async (f, n, tekst = null) => {
    await strona.click(`#admin-filtry [data-filtr="${f}"]`);
    await ileNaLiscie(strona, n);
    if (tekst) await strona.waitForFunction((x) => document.querySelector('#admin-watki').textContent.includes(x), tekst, { timeout: 15000 });
  };
  await filtr('nieprzeczytane', 1, 'Cennik');
  assert.equal(await strona.getAttribute('#admin-filtry [data-filtr="nieprzeczytane"]', 'aria-pressed'), 'true');
  await filtr('gwiazdka', 1, 'Ważne pytanie');
  await filtr('zalaczniki', 1, 'Cennik');
  await filtr('gwiazdka', 1, 'Ważne pytanie');
  // Filtr + wyszukiwanie: nic nie pasuje – komunikat.
  await strona.fill('#admin-szukaj', 'Podziękowanie');
  await ileNaLiscie(strona, 0);
  assert.match(await strona.textContent('#admin-watki-pusto'), /ani filtra/);
  await strona.fill('#admin-szukaj', '');
  await filtr('', 3);
  // W kopiach roboczych zostaje tylko filtr „Z załącznikami”.
  await strona.click('#admin-foldery [data-folder="robocze"]');
  await strona.waitForFunction(() => document.querySelector('#admin-filtry [data-filtr="gwiazdka"]').hidden);
  assert.equal(await strona.isVisible('#admin-filtry [data-filtr="zalaczniki"]'), true);
  await strona.click('#admin-foldery [data-folder="skrzynka"]');
  await ileNaLiscie(strona, 3);

  // Nowa wiadomość: edytor z paskiem formatowania.
  await strona.click('#admin-napisz');
  const tresc = '#admin-pisz .edytor-wiadomosci-tresc';
  await strona.waitForSelector('#admin-pisz:not([hidden]) .edytor-wiadomosci-tresc');
  assert.equal(await strona.locator('#admin-pisz .edytor-wiadomosci-pasek [data-polecenie]').count() >= 10, true, 'pasek formatowania');
  await strona.fill('#admin-pisz [data-adresy="do"] input', 'ola@przyklad.pl');
  await strona.keyboard.press('Enter');
  await strona.fill('#admin-pisz-temat', 'Oferta');
  await strona.click(tresc);
  await strona.keyboard.press('Control+Home');
  await strona.keyboard.type('Ważna oferta');
  // Zaznaczenie wpisanego słowa i pogrubienie przyciskiem.
  for (let i = 0; i < 'oferta'.length; i += 1) await strona.keyboard.press('Shift+ArrowLeft');
  await strona.click('#admin-pisz [data-polecenie="pogrubienie"]');
  assert.equal(await strona.getAttribute('#admin-pisz [data-polecenie="pogrubienie"]', 'aria-pressed'), 'true');
  await strona.keyboard.press('End');
  await strona.keyboard.press('Enter');
  await strona.click('#admin-pisz [data-polecenie="lista"]');
  await strona.keyboard.type('punkt pierwszy');
  // Wklejenie HTML ze skryptem i zdarzeniem – zostaje sama treść.
  await strona.evaluate((sel) => {
    const el = document.querySelector(sel);
    const dt = new DataTransfer();
    dt.setData('text/html', '<p onclick="alert(1)">Wklejone <script>alert(2)<\/script><a href="javascript:alert(3)">zły</a> <a href="https://makietka.app">dobry</a></p>');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, tresc);
  const html = await strona.innerHTML(tresc);
  assert.match(html, /<(b|strong)>oferta<\/(b|strong)>/, 'pogrubione słowo');
  assert.match(html, /<ul>[\s\S]*<li>[\s\S]*punkt pierwszy/, 'lista punktowana');
  assert.doesNotMatch(html, /script|onclick|javascript:/i, 'wklejony HTML wyczyszczony');
  assert.match(html, /href="https:\/\/makietka\.app"/, 'bezpieczny link zostaje');

  await strona.click('#admin-form-pisz [type="submit"]');
  await strona.waitForFunction(() => document.querySelector('#admin-pisz').hidden, null, { timeout: 15000 });
  await strona.waitForFunction(() => true);
  const wyslana = await (async () => {
    for (let i = 0; i < 50; i += 1) {
      const w = baza.wyslane.find((x) => x.temat === 'Oferta');
      if (w) return w;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  })();
  assert.ok(wyslana, 'wiadomość poszła przez kolejkę');
  assert.match(wyslana.html, /<(b|strong)>oferta<\/(b|strong)>/);
  assert.doesNotMatch(wyslana.html, /script|onclick/i);
  assert.deepEqual(cdn, [], 'bez bibliotek z CDN');
  assert.deepEqual(bledy, []);
});
