// Gotowe sekcje (#166): szablony całych dokumentów jako generatory – każdy wstawia się w A4, A5, kwadracie
// i poziomo bez błędów, bez elementów poza stroną (poza tłami na spad), serie z danymi rozwijają się,
// jedno cofnięcie usuwa wstawioną sekcję, okno z miniaturami, nowy projekt z szablonu.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('gotowe sekcje: każdy szablon w 4 formatach – bez błędów, w obrębie strony, serie i wzorce działają', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Szablony');
  const wynik = await strona.evaluate(async () => {
    const G = await import('./js/gotowe-sekcje.js');
    const P = await import('./js/projekt.js');
    const { rozwin } = await import('./js/serie.js');
    const { przeliczOkladki } = await import('./js/okladka.js');
    const formaty = { A4: [210, 297], A5: [148, 210], kwadrat: [210, 210], poziomo: [297, 210] };
    const problemy = [];
    const liczby = {};
    for (const sz of G.SZABLONY_SEKCJI) {
      for (const [nazwaF, [w, h]] of Object.entries(formaty)) {
        const p = P.normalizuj(P.nowyProjekt('Test', P.normalizujWydruk({ szerokosc_mm: w, wysokosc_mm: h, spad_mm: 3, marginesy_mm: 12 })));
        p.strony[0].obiekty.push({ type: 'rect', id: 'x', left: 10, top: 10, width: 10, height: 10, fill: '#000' });
        let wst;
        try {
          wst = await G.wstawGotowaSekcje(p, sz.id, { wydruk: p.sekcje[0].wydruk, wlasnyFormat: nazwaF === 'A5', odpowiedzi: { stron: 3, rok: 2027 } });
          przeliczOkladki(p);
        } catch (e) { problemy.push(`${sz.id}/${nazwaF}: ${e.message}`); continue; }
        const n = P.normalizuj(JSON.parse(JSON.stringify(p)));
        const sek = n.sekcje.find((s) => s.id === wst.sekcja.id);
        const egz = rozwin(n).egzemplarze.filter((e) => e.strona.sekcja === sek.id && !e.pusta);
        liczby[`${sz.id}/${nazwaF}`] = egz.length;
        if (!egz.length) problemy.push(`${sz.id}/${nazwaF}: brak stron w wydruku`);
        const { szerokosc_mm: W, wysokosc_mm: H, spad_mm: spad } = sek.wydruk;
        const obiekty = [...n.strony.filter((s) => s.sekcja === sek.id).flatMap((s) => s.obiekty), ...n.wzorce.filter((x) => sek.wzorce.includes(x.id)).flatMap((x) => x.obiekty)];
        const zywe = await fabric.util.enlivenObjects(JSON.parse(JSON.stringify(obiekty)));
        zywe.forEach((o, i) => {
          o.setCoords();
          const r = o.getBoundingRect();
          const luz = obiekty[i].bez_ostrzezen ? spad + 0.6 : 0.6;
          if (r.left < -luz || r.top < -luz || r.left + r.width > W + luz || r.top + r.height > H + luz) problemy.push(`${sz.id}/${nazwaF}: „${obiekty[i].nazwa || obiekty[i].type}” poza stroną (${r.left.toFixed(1)},${r.top.toFixed(1)} ${r.width.toFixed(1)}×${r.height.toFixed(1)} na ${W}×${H})`);
        });
      }
    }
    return { problemy, liczby, ile: G.SZABLONY_SEKCJI.length, kategorie: [...new Set(G.SZABLONY_SEKCJI.map((s) => s.kategoria))] };
  });
  assert.deepEqual(wynik.problemy, []);
  assert.ok(wynik.ile >= 25, `szablonów: ${wynik.ile}`);
  assert.ok(wynik.kategorie.length >= 5);
  // Serie: dni roku 2027, 12 miesięcy (+ okładka), 52–53 tygodnie, dyplomy z 3 osób, notes 3 strony.
  assert.equal(wynik.liczby['planer-dzienny/A5'], 365);
  assert.equal(wynik.liczby['kalendarz-scienny/A4'], 13);
  assert.ok(wynik.liczby['planer-tygodniowy/A5'] >= 52);
  assert.equal(wynik.liczby['dyplom/poziomo'], 3);
  assert.equal(wynik.liczby['notes-kropki/kwadrat'], 3);
  assert.equal(wynik.liczby['rozdzial/A5'], 3);
  assert.deepEqual(bledy, []);
});

test('gotowe sekcje: okno z miniaturami, wstawienie, jedno cofnięcie, wejście z listy stron i z Biblioteki', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Okno szablonów');
  const sekcjiPrzed = await strona.evaluate(() => window.seriodruk.stan.projekt.sekcje.length);
  // Lista stron: „Gotowa” obok „Sekcja”.
  await strona.click('#stopka-strony [data-akcja="gotowe-sekcje"]');
  await strona.waitForSelector('#dlg-gotowe-sekcje[open]');
  await strona.waitForFunction(() => document.querySelectorAll('#gotowe-lista .karta-szablonu').length >= 25);
  // Miniatury rysowane prawdziwym rendererem (obraz strony).
  await strona.waitForFunction(() => document.querySelector('#gotowe-lista .karta-szablonu img[src^="data:image"]'), null, { timeout: 20000 });
  // Filtr kategorii i szukanie.
  await strona.click('#gotowe-kategorie [data-kategoria="kalendarze"]');
  const widoczne = await strona.evaluate(() => [...document.querySelectorAll('#gotowe-lista .karta-szablonu:not([hidden])')].map((k) => k.dataset.id));
  assert.ok(widoczne.length >= 3 && widoczne.every((id) => id.startsWith('kalendarz')), widoczne.join());
  await strona.click('#gotowe-kategorie [data-kategoria=""]');
  await strona.fill('#gotowe-szukaj', 'zaproszenie');
  assert.deepEqual(await strona.evaluate(() => [...document.querySelectorAll('#gotowe-lista .karta-szablonu:not([hidden])')].map((k) => k.dataset.id)), ['zaproszenie']);
  await strona.fill('#gotowe-szukaj', '');
  // Szczegóły: podgląd w formacie projektu, pytanie o rok, wstawienie.
  await strona.click('#gotowe-lista .karta-szablonu[data-id="kalendarz-scienny"]');
  await strona.waitForSelector('#gotowe-szczegoly:not([hidden])');
  await strona.waitForFunction(() => document.querySelectorAll('#gotowe-podglad img[src^="data:image"]').length >= 2, null, { timeout: 20000 });
  await strona.fill('#gotowe-pytania input[name="rok"]', '2028');
  await strona.click('#gotowe-wstaw');
  await strona.waitForSelector('#dlg-gotowe-sekcje', { state: 'hidden' });
  const po = await strona.evaluate(() => {
    const p = window.seriodruk.stan.projekt;
    const s = p.sekcje.at(-1);
    return { sekcji: p.sekcje.length, nazwa: s.nazwa, stron: p.strony.filter((x) => x.sekcja === s.id).length, tabela: p.tabele.at(-1)?.wiersze[0][0], biezaca: p.strony[window.seriodruk.stan.indeks].sekcja === s.id };
  });
  assert.equal(po.sekcji, sekcjiPrzed + 1);
  assert.equal(po.nazwa, 'Kalendarz ścienny');
  assert.equal(po.stron, 2);
  assert.equal(po.tabela, '2028-01');
  assert.ok(po.biezaca, 'edytor przechodzi do wstawionej sekcji');
  // Jedno cofnięcie usuwa całą sekcję razem z danymi.
  await strona.waitForTimeout(1200);
  await strona.click('[data-akcja="cofnij"]');
  await strona.waitForFunction((n) => window.seriodruk.stan.projekt.sekcje.length === n, sekcjiPrzed);
  assert.equal(await strona.evaluate(() => window.seriodruk.stan.projekt.tabele.length), 0);
  // Biblioteka: kategoria „Gotowe sekcje” otwiera to samo okno na wybranym szablonie.
  await strona.click('[data-akcja="biblioteka"]');
  await strona.waitForSelector('#dlg-biblioteka[open]');
  await strona.click('#kategorie-biblioteki [data-kategoria="gotowe-sekcje"]');
  await strona.click('#elementy-biblioteki [data-element="wizytowki"]');
  await strona.waitForSelector('#dlg-gotowe-sekcje[open] #gotowe-szczegoly:not([hidden])');
  assert.equal(await strona.evaluate(() => document.querySelector('#gotowe-szczegoly').dataset.id), 'wizytowki');
  assert.deepEqual(bledy, []);
});

test('nowy projekt z gotowego szablonu: galeria od razu w oknie „Nowy projekt”, potem projekt z samym szablonem (#208)', async (t) => {
  const { strona, bledy } = await otworz(t);
  await strona.locator('[data-akcja="nowy-projekt"]:visible').first().click();
  await strona.waitForSelector('#dlg-nowy[open]');
  await strona.fill('#form-nowy [name="nazwa"]', 'Mój planer');
  await strona.check('#form-nowy input[name="start"][value="szablon"]', { force: true });
  // Szablony w tym samym oknie, bez pól formatu i bez przycisku „Utwórz projekt”.
  await strona.waitForSelector('#dlg-nowy[open] #nowy-szablony #gotowe-lista .karta-szablonu');
  assert.equal(await strona.evaluate(() => document.querySelector('#dlg-gotowe-sekcje').open), false);
  assert.ok(await strona.locator('#form-nowy button[value="ok"]').isHidden());
  assert.ok(await strona.locator('#karty-formatu').isHidden());
  // Enter w szukaniu nie tworzy projektu.
  await strona.fill('#gotowe-szukaj', 'planer');
  await strona.press('#gotowe-szukaj', 'Enter');
  assert.ok(await strona.evaluate(() => document.querySelector('#dlg-nowy').open));
  // Powrót do „Pustej strony” – pola wracają, galeria znika.
  await strona.check('#form-nowy input[name="start"][value="pusty"]', { force: true });
  await strona.waitForFunction(() => document.querySelector('#nowy-szablony').hidden);
  assert.ok(await strona.locator('#form-nowy button[value="ok"]').isVisible());
  await strona.check('#form-nowy input[name="start"][value="szablon"]', { force: true });
  await strona.click('#nowy-szablony .karta-szablonu[data-id="planer-dzienny"]');
  await strona.waitForSelector('#nowy-szablony #gotowe-szczegoly:not([hidden])');
  assert.equal(await strona.textContent('#gotowe-wstaw'), 'Utwórz projekt z tym szablonem');
  await strona.click('#gotowe-wstaw');
  await strona.waitForFunction(() => !document.querySelector('#dlg-nowy').open && window.seriodruk.stan.projekt?.nazwa === 'Mój planer');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.sekcje.length === 1 && window.seriodruk.stan.projekt.sekcje[0].nazwa !== 'Główna', null, { timeout: 15000 });
  const p = await strona.evaluate(() => { const x = window.seriodruk.stan.projekt; return { nazwa: x.nazwa, sekcje: x.sekcje.map((s) => s.nazwa), stron: x.strony.length, seria: Boolean(x.strony[0].seria) }; });
  assert.deepEqual(p, { nazwa: 'Mój planer', sekcje: ['Planer dzienny (365 dni)'], stron: 1, seria: true });
  // Galeria wróciła do swojego okna – „Gotowe sekcje” w edytorze działa jak dawniej.
  assert.equal(await strona.evaluate(() => document.querySelector('#gotowe-lista').closest('dialog').id), 'dlg-gotowe-sekcje');
  assert.deepEqual(bledy, []);
});
