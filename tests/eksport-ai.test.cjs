// Eksport PDF i PNG zlecany przez AI (#175): łącznik składa zlecenie (ai_zlec_eksport), otwarta aplikacja konta
// przyjmuje je na żywo, robi plik zwykłym kodem eksportu, wgrywa do „<konto>/_eksporty/” i zamyka zlecenie – łącznik
// dostaje sekret do linku pobierania. Bez otwartej aplikacji: link #/p/<projekt>/eksport/<zlecenie> robi to samo.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });

async function poczekaj(fn, ms = 40000) {
  const koniec = Date.now() + ms;
  for (;;) {
    const w = fn();
    if (w) return w;
    if (Date.now() > koniec) throw new Error('Nie doczekano się wyniku.');
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function projektZKluczem(strona, baza) {
  await nowyProjekt(strona, 'Kalendarz dla AI');
  await strona.evaluate(() => document.querySelector('.pasek-narzedzi [data-akcja="dodaj-prostokat"]').click());
  await strona.click('[data-akcja="dodaj-tekst"]');
  await zapisano(strona);
  const pid = await strona.evaluate(() => window.seriodruk.stan.projekt.id);
  const sid = await strona.evaluate(() => window.seriodruk.stan.projekt.strony[0].id);
  const konto = baza.konta[0];
  const { klucz } = baza.ai('utworz_dostep_ai', { p_projekty: [pid], p_opis: 'Claude', p_rola: 'odczyt', p_dni: 1 }, konto);
  return { pid, sid, konto, klucz };
}

test('AI zleca PDF i PNG: otwarta aplikacja robi pliki, wgrywa je na konto i zamyka zlecenia (#175)', async (t) => {
  const { strona, baza, bledy } = await otworz(t);
  const { sid, konto, klucz } = await projektZKluczem(strona, baza);
  // Klucz tylko do czytania też zleca eksport – plik nie zmienia projektu.
  const z = baza.ai('ai_zlec_eksport', { p_klucz: klucz, p_rodzaj: 'pdf', p_ustawienia: { przeznaczenie: 'ekran' } });
  assert.equal(z.stan, 'czeka', JSON.stringify(z));
  const gotowy = await poczekaj(() => { const s = baza.ai('ai_stan_eksportu', { p_klucz: klucz, p_id: z.id }); return s.stan === 'gotowe' || s.stan === 'blad' ? s : null; });
  assert.equal(gotowy.stan, 'gotowe', gotowy.blad);
  assert.ok(gotowy.sekret && gotowy.sekret.length >= 32, 'sekret do linku pobierania');
  assert.match(gotowy.nazwa, /\.pdf$/);
  assert.equal(gotowy.strony, 1);
  const plik = baza.pliki.get(`zasoby/${konto.id}/_eksporty/${z.id}.pdf`);
  assert.ok(plik, 'plik w folderze _eksporty konta');
  assert.equal(plik.tresc.subarray(0, 5).toString(), '%PDF-');
  assert.equal(gotowy.rozmiar, plik.tresc.length);
  // Przekaźnik wyda plik tylko z dobrym sekretem.
  assert.deepEqual(baza.eksport.app('eksport_do_pobrania', { p_id: z.id, p_sekret: gotowy.sekret }), { plik: `${konto.id}/_eksporty/${z.id}.pdf`, nazwa: gotowy.nazwa, typ: 'application/pdf' });
  assert.equal(baza.eksport.app('eksport_do_pobrania', { p_id: z.id, p_sekret: 'x'.repeat(64) }), null);
  // Powiadomienie z przyciskiem „Pobierz” w aplikacji.
  await strona.waitForFunction(() => /zlecony przez AI/.test(document.querySelector('#powiadomienie')?.textContent || ''));

  // PNG jednej strony.
  const zp = baza.ai('ai_zlec_eksport', { p_klucz: klucz, p_rodzaj: 'png', p_ustawienia: { strona: sid, dpi: 72 } });
  const png = await poczekaj(() => { const s = baza.ai('ai_stan_eksportu', { p_klucz: klucz, p_id: zp.id }); return s.stan === 'gotowe' || s.stan === 'blad' ? s : null; });
  assert.equal(png.stan, 'gotowe', png.blad);
  const obraz = baza.pliki.get(`zasoby/${konto.id}/_eksporty/${zp.id}.png`);
  assert.deepEqual([...obraz.tresc.subarray(1, 4)], [0x50, 0x4e, 0x47], 'plik PNG');

  // Zła strona – zlecenie kończy się błędem z opisem (AI może poprawić wywołanie).
  const zz = baza.ai('ai_zlec_eksport', { p_klucz: klucz, p_rodzaj: 'png', p_ustawienia: { strona: 'nie-ma' } });
  const zly = await poczekaj(() => { const s = baza.ai('ai_stan_eksportu', { p_klucz: klucz, p_id: zz.id }); return s.stan === 'gotowe' || s.stan === 'blad' ? s : null; });
  assert.equal(zly.stan, 'blad');
  assert.match(zly.blad, /nie ma strony/);
  assert.equal(zly.sekret, undefined);
  assert.deepEqual(bledy, []);
});

test('AI zleca PDF, gdy aplikacja jest zamknięta: zlecenie czeka, link #/p/…/eksport/… otwiera projekt i robi plik (#175)', async (t) => {
  const { strona, baza, kontekst, adres, bledy } = await otworz(t);
  const { pid, konto, klucz } = await projektZKluczem(strona, baza);
  await strona.close();
  const z = baza.ai('ai_zlec_eksport', { p_klucz: klucz, p_rodzaj: 'pdf', p_ustawienia: { zakres: 'strony', od: 1, do: 1, przeznaczenie: 'drukarnia' } });
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(baza.ai('ai_stan_eksportu', { p_klucz: klucz, p_id: z.id }).stan, 'czeka', 'nikt nie przyjął – żadna karta nie jest otwarta');

  // Użytkownik otwiera link od AI (zalogowany na tym urządzeniu).
  const druga = await kontekst.newPage();
  druga.on('pageerror', (e) => bledy.push(e.message));
  await druga.goto(`${adres}#/p/${pid}/eksport/${z.id}`);
  const s = await poczekaj(() => { const w = baza.ai('ai_stan_eksportu', { p_klucz: klucz, p_id: z.id }); return w.stan === 'gotowe' || w.stan === 'blad' ? w : null; }, 60000);
  assert.equal(s.stan, 'gotowe', s.blad);
  assert.ok(baza.pliki.get(`zasoby/${konto.id}/_eksporty/${z.id}.pdf`).tresc.subarray(0, 5).toString() === '%PDF-');
  // Projekt otwarty, adres bez części „eksport” (odświeżenie nie robi pliku drugi raz).
  await druga.waitForFunction((id) => window.seriodruk?.stan?.projekt?.id === id, pid);
  assert.equal(await druga.evaluate(() => location.hash), `#/p/${pid}`);
  // Sprzątanie po 7 dniach: plik i zlecenie znikają (aplikacja właściciela).
  baza.eksporty.find((x) => x.id === z.id).wygasa = new Date(Date.now() - 1000).toISOString();
  await druga.evaluate(async () => {
    const sb = await (await import('./js/chmura.js')).supabase();
    const { data } = await sb.rpc('wygasle_eksporty');
    const chmura = await import('./js/chmura.js');
    await chmura.r2.usun('zasoby', data.map((x) => x.plik));
    await sb.rpc('usun_eksporty', { p_ids: data.map((x) => x.id) });
  });
  assert.equal(baza.eksporty.some((x) => x.id === z.id), false);
  assert.equal(baza.pliki.has(`zasoby/${konto.id}/_eksporty/${z.id}.pdf`), false);
  assert.deepEqual(bledy, []);
});
