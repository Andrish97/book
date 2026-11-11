// Łączenie zmian z dwóch urządzeń (js/laczenie.js): to, co zmieniono tylko po jednej stronie, przechodzi samo;
// pytanie dotyczy wyłącznie części zmienionych po obu stronach.

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt, PNG_2X2 } = require('./pomoc.cjs');

async function zaloguj(strona) {
  await strona.waitForSelector('#ekran-logowania', { state: 'visible' });
  await strona.fill('#form-logowania input[name=email]', 'anna@test.pl');
  await strona.fill('#form-logowania input[name=haslo]', 'Dobre#Haslo1');
  await strona.click('#przycisk-logowania');
  await strona.waitForSelector('#dlg-instrukcja[open]');
  await strona.click('[data-akcja="zamknij-instrukcje"]');
}

const zapisano = (strona) => strona.waitForFunction(() => document.querySelector('#stan-zapisu').textContent === 'Zapisano', null, { timeout: 15000 });
const polaczono = (strona) => strona.waitForFunction(() => document.querySelector('#powiadomienie').textContent.includes('Połączono zmiany'), null, { timeout: 15000 });

// Projekt z dwiema stronami, zapisany na koncie: na pierwszej tekst, na drugiej prostokąt. Otwarta jest druga.
async function projektNaKoncie(strona, nazwa) {
  await nowyProjekt(strona, nazwa);
  await strona.click('[data-akcja="dodaj-tekst"]');
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.waitForTimeout(3400);
  await zapisano(strona);
  return strona.evaluate(() => ({ id: window.seriodruk.stan.projekt.id, strony: window.seriodruk.stan.projekt.strony.map((s) => s.id) }));
}

// „Inne urządzenie” zapisuje na koncie: zmienia wiersze stron i/albo wiersz projektu, wersja rośnie.
function zapisZInnegoUrzadzenia(baza, idProjektu, { strony = {}, dane = {} }) {
  const p = baza.projekty.find((x) => x.id === idProjektu);
  for (const [id, zmiana] of Object.entries(strony)) {
    const klucz = `${idProjektu}/${id}`;
    baza.strony.set(klucz, zmiana(baza.strony.get(klucz)));
  }
  p.dane = { ...p.dane, ...dane };
  if (dane.nazwa) p.nazwa = dane.nazwa;
  p.wersja += 1;
  p.zmieniono = new Date().toISOString();
}

const zElementem = (nazwa, idElementu) => (s) => ({ ...s, nazwa, obiekty: [...s.obiekty, { ...s.obiekty[0], id: idElementu, left: (s.obiekty[0].left || 0) + 40 }] });

test('łączenie części projektu: zmiany po jednej stronie przechodzą same, pytanie tylko o to samo zmienione inaczej', async (t) => {
  const { strona, bledy } = await otworz(t);
  const w = await strona.evaluate(async () => {
    const { polaczProjekty, zastosujPolaczenie, postacDoPorownan, podstawaProjektu, odcisk } = await import('./js/laczenie.js');
    const { normalizuj, nowyProjekt: nowy, nowaStrona, nowaTabela } = await import('./js/projekt.js');
    const kopia = (x) => JSON.parse(JSON.stringify(x));
    // Tak oddaje dane baza: pola w kolejności długości nazwy, potem alfabetycznie.
    const jakBaza = (x) => {
      if (Array.isArray(x)) return x.map(jakBaza);
      if (!x || typeof x !== 'object') return x;
      return Object.fromEntries(Object.keys(x).sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).map((k) => [k, jakBaza(x[k])]));
    };
    const szkic = nowy('Łączenie');
    const sekcja = szkic.sekcje[0].id;
    szkic.strony = ['A', 'B', 'C', 'D'].map((n) => ({ ...nowaStrona(`Strona ${n}`, sekcja), id: n, obiekty: [{ id: `o${n}`, type: 'rect', left: 10, top: 10 }] }));
    szkic.tabele = [{ ...nowaTabela('Osoby', ['imie'], [['Ala']]), id: 'T' }];
    szkic.czcionki = [{ id: 'f1', rodzina: 'Własna', waga: 400, kursywa: false }];
    szkic.zasoby = { f1: { nazwa: 'wlasna.ttf', dataUrl: 'data:font/ttf;base64,AA==' } };
    const start = normalizuj(szkic);
    const podstawa = podstawaProjektu(start);
    const strona_ = (p, id) => p.strony.find((s) => s.id === id);
    // Liczy plan i składa wynik; zwraca to, co potem sprawdzamy.
    const polacz = (zmienMoje, zmienKonto, wybory) => {
      const moj = normalizuj(kopia(start));
      const konto = normalizuj(jakBaza(kopia(start)));
      zmienMoje(moj);
      zmienKonto(konto);
      const plan = polaczProjekty(postacDoPorownan(moj), postacDoPorownan(konto), podstawa);
      zastosujPolaczenie(moj, konto, plan, new Map(wybory || []));
      return {
        pytania: plan.konflikty.map((k) => [k.klucz, k.nazwa, k.moje, k.konto]),
        zKonta: plan.zKonta,
        kolejnosc: moj.strony.map((s) => s.id),
        lewe: Object.fromEntries(moj.strony.map((s) => [s.id, s.obiekty[0]?.left])),
        nazwa: moj.nazwa,
        wiersze: moj.tabele[0]?.wiersze.length,
        czcionki: moj.czcionki.map((c) => c.id),
        zasoby: Object.keys(moj.zasoby).sort(),
      };
    };
    const nic = () => {};
    return {
      odciskBezKolejnosci: odcisk(jakBaza(kopia(start.strony[0]))) === odcisk(start.strony[0]),
      odciskWidziZmiane: odcisk({ ...start.strony[0], nazwa: 'Inna' }) !== odcisk(start.strony[0]),
      bezZmian: polacz(nic, nic),
      rozne: polacz(
        (m) => { strona_(m, 'A').obiekty[0].left = 50; m.strony.push({ ...nowaStrona('Strona E', sekcja), id: 'E' }); },
        (k) => {
          strona_(k, 'B').obiekty[0].left = 70;
          k.strony = k.strony.filter((s) => s.id !== 'D');
          k.strony.splice(1, 0, { ...nowaStrona('Strona F', sekcja), id: 'F', obiekty: [{ id: 'oF', type: 'image', src: 'zasob:img1', left: 5 }] });
          k.zasoby.img1 = { nazwa: 'zdjecie.jpg', sciezka: 'u/p/img1' };
          k.tabele[0].wiersze.push(['Ola']);
          k.nazwa = 'Łączenie (z telefonu)';
        },
      ),
      toSamo: polacz((m) => { strona_(m, 'A').obiekty[0].left = 50; }, (k) => { strona_(k, 'A').obiekty[0].left = 50; }),
      obie: polacz((m) => { strona_(m, 'A').obiekty[0].left = 50; }, (k) => { strona_(k, 'A').obiekty[0].left = 70; strona_(k, 'B').obiekty[0].left = 70; }),
      obieKonto: polacz((m) => { strona_(m, 'A').obiekty[0].left = 50; }, (k) => { strona_(k, 'A').obiekty[0].left = 70; }, [['strony:A', 'konto']]),
      usunietaTam: polacz((m) => { strona_(m, 'C').obiekty[0].left = 50; }, (k) => { k.strony = k.strony.filter((s) => s.id !== 'C'); }),
      usunietaTamKonto: polacz((m) => { strona_(m, 'C').obiekty[0].left = 50; }, (k) => { k.strony = k.strony.filter((s) => s.id !== 'C'); }, [['strony:C', 'konto']]),
      usunietaTu: polacz((m) => { m.strony = m.strony.filter((s) => s.id !== 'C'); }, (k) => { strona_(k, 'C').obiekty[0].left = 70; }),
      usunietaTuKonto: polacz((m) => { m.strony = m.strony.filter((s) => s.id !== 'C'); }, (k) => { strona_(k, 'C').obiekty[0].left = 70; }, [['strony:C', 'konto']]),
      kolejnoscZKonta: polacz((m) => { strona_(m, 'A').obiekty[0].left = 50; }, (k) => { k.strony.reverse(); }),
    };
  });

  assert.ok(w.odciskBezKolejnosci, 'kolejność pól, którą zmienia baza, nie jest zmianą treści');
  assert.ok(w.odciskWidziZmiane);
  assert.deepEqual([w.bezZmian.pytania, w.bezZmian.zKonta], [[], 0], 'projekt, który wrócił z bazy bez zmian, niczym się nie różni');

  // Różne części: wszystko przechodzi bez pytania.
  assert.deepEqual(w.rozne.pytania, []);
  assert.equal(w.rozne.zKonta, 5, 'z konta: strona B, usunięcie D, nowa F, tabela, nazwa');
  assert.deepEqual(w.rozne.kolejnosc, ['A', 'F', 'B', 'C', 'E'], 'nowa strona z konta stoi za swoją poprzedniczką, moja nowa zostaje na końcu');
  assert.deepEqual([w.rozne.lewe.A, w.rozne.lewe.B], [50, 70], 'moja zmiana strony A i zmiana strony B z konta');
  assert.deepEqual([w.rozne.nazwa, w.rozne.wiersze], ['Łączenie (z telefonu)', 2]);
  assert.deepEqual(w.rozne.czcionki, ['f1'], 'własna czcionka projektu zostaje');
  assert.deepEqual(w.rozne.zasoby, ['f1', 'img1'], 'plik obrazu ze strony z konta dochodzi do spisu plików');

  // Ta sama zmiana po obu stronach to nie konflikt.
  assert.deepEqual([w.toSamo.pytania, w.toSamo.zKonta], [[], 0]);

  // Ta sama strona zmieniona inaczej: jedno pytanie o tę stronę; druga strona przechodzi sama.
  assert.deepEqual(w.obie.pytania, [['strony:A', 'Strona „Strona A”', 'zmieniona tutaj', 'zmieniona na koncie']]);
  assert.deepEqual([w.obie.lewe.A, w.obie.lewe.B], [50, 70], 'bez odpowiedzi zostaje wersja z tego urządzenia');
  assert.equal(w.obieKonto.lewe.A, 70, 'wybrana wersja z konta');

  // Usunięcie po jednej stronie, zmiana po drugiej: pytanie, a wybór decyduje, czy strona zostaje.
  assert.deepEqual(w.usunietaTam.pytania, [['strony:C', 'Strona „Strona C”', 'zmieniona tutaj', 'usunięta na koncie']]);
  assert.deepEqual(w.usunietaTam.kolejnosc, ['A', 'B', 'C', 'D']);
  assert.deepEqual(w.usunietaTamKonto.kolejnosc, ['A', 'B', 'D']);
  assert.deepEqual(w.usunietaTu.pytania, [['strony:C', 'Strona „Strona C”', 'usunięta tutaj', 'zmieniona na koncie']]);
  assert.deepEqual(w.usunietaTu.kolejnosc, ['A', 'B', 'D']);
  assert.deepEqual(w.usunietaTuKonto.kolejnosc, ['A', 'B', 'C', 'D']);
  assert.equal(w.usunietaTuKonto.lewe.C, 70);

  // Kolejność stron zmieniona tylko na koncie – bierzemy ją stamtąd, treść mojej strony zostaje.
  assert.deepEqual([w.kolejnoscZKonta.pytania, w.kolejnoscZKonta.kolejnosc, w.kolejnoscZKonta.lewe.A], [[], ['D', 'C', 'B', 'A'], 50]);
  assert.equal(w.kolejnoscZKonta.zKonta, 1, 'sama kolejność z konta liczy się jako zmiana do pokazania');
  assert.deepEqual(bledy, []);
});

test('dwa urządzenia zmieniają różne strony i tabelę danych: obie zmiany zostają, bez pytania', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await zaloguj(strona);
  const p = await projektNaKoncie(strona, 'Dwa urządzenia');

  // Odświeżenie karty: punkt odniesienia do łączenia leży w zapisie projektu na urządzeniu, nie w pamięci karty.
  await strona.reload();
  await strona.waitForFunction(() => window.seriodruk.stan.projekt && window.seriodruk.edytor.wydruk);
  await strona.click('#lista-stron li.strona >> nth=1 >> .miniatura');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1 && window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'rect'));

  // „Telefon” zmienił pierwszą stronę i dodał tabelę danych.
  const wersja = baza.projekty[0].wersja;
  zapisZInnegoUrzadzenia(baza, p.id, {
    strony: { [p.strony[0]]: zElementem('Okładka z telefonu', 'z-telefonu') },
    dane: { tabele: [{ id: 't-tel', nazwa: 'Z telefonu', kolumny: ['imie'], wiersze: [['Ola']] }] },
  });

  // Tutaj zmiana na drugiej stronie.
  await strona.click('[data-akcja="dodaj-elipse"]');
  await polaczono(strona);
  await zapisano(strona);
  assert.equal(await strona.locator('dialog[open]').count(), 0, 'żadnego pytania');
  assert.equal(baza.projekty[0].wersja, wersja + 2, 'zapis telefonu i zapis połączonego projektu');

  // Na koncie: strona z telefonu nietknięta, moja druga strona z elipsą, tabela z telefonu.
  const naKoncie = (id) => baza.strony.get(`${p.id}/${id}`);
  assert.deepEqual([naKoncie(p.strony[0]).nazwa, naKoncie(p.strony[0]).obiekty.length], ['Okładka z telefonu', 2]);
  assert.deepEqual(naKoncie(p.strony[1]).obiekty.map((o) => o.type.toLowerCase()).sort(), ['ellipse', 'rect']);
  assert.deepEqual(baza.projekty[0].dane.tabele.map((x) => x.nazwa), ['Z telefonu']);
  assert.deepEqual(baza.zapisy.at(-1), { strony: [p.strony[1]], wszystkie: 2 }, 'po połączeniu wysłana tylko strona zmieniona tutaj');

  // Na tym urządzeniu to samo; otwarta strona została, a cofanie zaczyna się od połączonego stanu.
  const tu = await strona.evaluate(() => {
    const { stan, edytor } = window.seriodruk;
    return {
      strony: stan.projekt.strony.map((s) => [s.nazwa, s.obiekty.length]),
      tabele: stan.projekt.tabele.map((x) => x.nazwa),
      indeks: stan.indeks,
      naPlotnie: edytor.canvas.getObjects().filter((o) => ['rect', 'ellipse'].includes(o.type)).length,
      cofnij: document.querySelector('[data-akcja="cofnij"]').disabled,
    };
  });
  assert.deepEqual(tu, { strony: [['Okładka z telefonu', 2], ['Strona 2', 2]], tabele: ['Z telefonu'], indeks: 1, naPlotnie: 2, cofnij: true });

  // Strona z telefonu otwiera się z jego elementem; kolejna zmiana zapisuje się już zwyczajnie.
  await strona.click('#lista-stron li.strona >> nth=0 >> .miniatura');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0 && window.seriodruk.edytor.canvas.getObjects().some((o) => o.id === 'z-telefonu'));
  await strona.click('[data-akcja="dodaj-linie"]');
  await strona.waitForTimeout(3400);
  await zapisano(strona);
  assert.equal(baza.projekty[0].wersja, wersja + 3);
  assert.equal(naKoncie(p.strony[0]).obiekty.length, 3);
  assert.deepEqual(baza.zapisy.at(-1), { strony: [p.strony[0]], wszystkie: 2 });
  assert.deepEqual(bledy, []);
});

test('ta sama strona zmieniona na dwóch urządzeniach: pytanie tylko o nią, wybór przy każdej stronie osobno', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await zaloguj(strona);
  const p = await projektNaKoncie(strona, 'Ta sama strona');
  const naKoncie = (id) => baza.strony.get(`${p.id}/${id}`);

  // „Telefon” zmienił obie strony i dodał tabelę; tutaj też zmieniamy obie strony.
  let wersja = baza.projekty[0].wersja;
  zapisZInnegoUrzadzenia(baza, p.id, {
    strony: { [p.strony[0]]: zElementem('Okładka z telefonu', 'tel-1'), [p.strony[1]]: zElementem('Druga z telefonu', 'tel-2') },
    dane: { tabele: [{ id: 't-tel', nazwa: 'Z telefonu', kolumny: ['imie'], wiersze: [['Ola']] }] },
  });
  await strona.click('[data-akcja="dodaj-elipse"]');
  await strona.click('#lista-stron li.strona >> nth=0 >> .miniatura');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0 && window.seriodruk.edytor.canvas.getObjects().length > 0);
  await strona.click('[data-akcja="dodaj-linie"]');

  await strona.waitForSelector('#dlg-konflikt[open]', { timeout: 15000 });
  assert.equal(baza.projekty[0].wersja, wersja + 1, 'przed decyzją nic nie zostało nadpisane');
  assert.deepEqual(await strona.$$eval('#konflikt-lista li', (l) => l.map((li) => [li.dataset.klucz, li.querySelector('strong').textContent, li.querySelector('input:checked').value])), [
    [`strony:${p.strony[0]}`, 'Strona „Strona 1”', 'moje'],
    [`strony:${p.strony[1]}`, 'Strona „Strona 2”', 'moje'],
  ], 'na liście są tylko strony zmienione w obu miejscach – tabela z telefonu przechodzi sama');
  assert.match(await strona.textContent('#konflikt-opis'), /2 części zmieniono w obu miejscach/);
  // Esc nie zamyka okna bez decyzji.
  await strona.keyboard.press('Escape');
  assert.equal(await strona.locator('#dlg-konflikt[open]').count(), 1);

  // Pierwsza strona: moja wersja; druga: wersja z konta.
  await strona.check(`#konflikt-lista li[data-klucz="strony:${p.strony[1]}"] input[value=konto]`);
  await strona.click('#konflikt-zastosuj');
  await polaczono(strona);
  await zapisano(strona);
  assert.equal(baza.projekty[0].wersja, wersja + 2);
  const stan1 = await strona.evaluate(() => window.seriodruk.stan.projekt.strony.map((s) => [s.nazwa, s.obiekty.map((o) => o.type.toLowerCase()).sort().join('+')]));
  assert.equal(stan1[0][0], 'Strona 1', 'pierwsza strona została moja');
  assert.match(stan1[0][1], /line/);
  assert.deepEqual(stan1[1], ['Druga z telefonu', 'rect+rect'], 'druga strona jest z konta – bez mojej elipsy');
  assert.equal(naKoncie(p.strony[0]).nazwa, 'Strona 1');
  assert.ok(naKoncie(p.strony[0]).obiekty.some((o) => o.type.toLowerCase() === 'line'), 'moja pierwsza strona trafiła na konto');
  assert.equal(naKoncie(p.strony[1]).nazwa, 'Druga z telefonu');
  assert.deepEqual(baza.projekty[0].dane.tabele.map((x) => x.nazwa), ['Z telefonu']);
  assert.deepEqual(baza.zapisy.at(-1).strony, [p.strony[0]], 'na konto poszła tylko strona, przy której wybrano moją wersję');

  // Drugi raz: jedna strona zmieniona w obu miejscach, „Wszędzie wersja z konta”.
  wersja = baza.projekty[0].wersja;
  const elementow = naKoncie(p.strony[0]).obiekty.length;
  zapisZInnegoUrzadzenia(baza, p.id, { strony: { [p.strony[0]]: (s) => ({ ...s, nazwa: 'Okładka – wersja z telefonu' }) } });
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.waitForSelector('#dlg-konflikt[open]', { timeout: 15000 });
  assert.equal(await strona.locator('#konflikt-lista li').count(), 1);
  assert.match(await strona.textContent('#konflikt-opis'), /Jedną część zmieniono w obu miejscach/);
  await strona.click('#konflikt-wszystko-konto');
  await strona.click('#konflikt-zastosuj');
  await strona.waitForFunction(() => window.seriodruk.stan.projekt.strony[0].nazwa === 'Okładka – wersja z telefonu');
  await zapisano(strona);
  assert.equal(baza.projekty[0].wersja, wersja + 1, 'po wybraniu wersji z konta to urządzenie ma to samo co konto – nic nie wysyła');
  assert.deepEqual(await strona.evaluate(() => { const s = window.seriodruk.stan.projekt.strony[0]; return [s.nazwa, s.obiekty.length]; }), ['Okładka – wersja z telefonu', elementow]);
  assert.deepEqual([naKoncie(p.strony[0]).nazwa, naKoncie(p.strony[0]).obiekty.length], ['Okładka – wersja z telefonu', elementow]);
  assert.deepEqual(bledy, []);
});

test('strona ze zdjęciem dodanym na innym urządzeniu: po połączeniu obraz jest w projekcie, na płótnie i w magazynie plików', async (t) => {
  const { strona, baza, bledy } = await otworz(t, { tryb: 'atrapa' });
  await zaloguj(strona);
  await nowyProjekt(strona, 'Zdjęcie z telefonu');
  await strona.setInputFiles('#plik-obraz', { name: 'moje.png', mimeType: 'image/png', buffer: PNG_2X2 });
  await strona.waitForFunction(() => window.seriodruk.edytor.canvas.getObjects().some((o) => o.type === 'image'));
  await strona.click('[data-akcja="strona-dodaj"]');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 1);
  await strona.click('[data-akcja="dodaj-prostokat"]');
  await strona.waitForTimeout(3400);
  await zapisano(strona);
  const p = await strona.evaluate(() => ({ id: window.seriodruk.stan.projekt.id, strony: window.seriodruk.stan.projekt.strony.map((s) => s.id) }));

  // „Telefon” dodał na pierwszej stronie drugie zdjęcie: plik na koncie, opis w projekcie, element na stronie.
  const sciezka = `${baza.konta[0].id}/${p.id}/img-tel`;
  baza.pliki.set(`zasoby/${sciezka}`, { typ: 'image/png', tresc: PNG_2X2 });
  zapisZInnegoUrzadzenia(baza, p.id, {
    strony: { [p.strony[0]]: (s) => ({ ...s, obiekty: [...s.obiekty, { ...s.obiekty[0], id: 'zdjecie-tel', src: 'zasob:img-tel', left: (s.obiekty[0].left || 0) + 30 }] }) },
    dane: { zasoby: { ...baza.projekty[0].dane.zasoby, 'img-tel': { nazwa: 'z-telefonu.png', typ: 'image/png', rozmiar: PNG_2X2.length, sciezka } } },
  });

  await strona.click('[data-akcja="dodaj-elipse"]');
  await polaczono(strona);
  await zapisano(strona);
  assert.equal(await strona.locator('dialog[open]').count(), 0, 'żadnego pytania');
  const tu = await strona.evaluate(async () => {
    const { dataUrlZasobu, adresZasobu } = await import('./js/zasoby.js');
    const pr = window.seriodruk.stan.projekt;
    return {
      zasoby: Object.keys(pr.zasoby).length,
      tresc: (await dataUrlZasobu(pr, 'img-tel'))?.slice(0, 14),
      adres: String(adresZasobu(pr.zasoby['img-tel'])).slice(0, 5),
      obrazy: pr.strony[0].obiekty.filter((o) => o.type === 'image').length,
    };
  });
  assert.deepEqual(tu, { zasoby: 2, tresc: 'data:image/png', adres: 'blob:', obrazy: 2 });
  assert.deepEqual(Object.values(baza.projekty[0].dane.zasoby).map((z) => Boolean(z.sciezka)), [true, true], 'oba pliki zostają w spisie na koncie');

  // Strona z telefonu rysuje oba zdjęcia.
  await strona.click('#lista-stron li.strona >> nth=0 >> .miniatura');
  await strona.waitForFunction(() => window.seriodruk.stan.indeks === 0 && window.seriodruk.edytor.canvas.getObjects().filter((o) => o.type === 'image' && o.getElement()?.naturalWidth > 0).length === 2);
  assert.deepEqual(bledy, []);
});
