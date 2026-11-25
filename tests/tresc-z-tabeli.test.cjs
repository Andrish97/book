// #432: „Treść z tabeli” – wpis-wzór powtórzony dla każdego wiersza tabeli płynie jednym ciągiem przez ramki i strony
// (słowniczek), strony dochodzą same, a nagłówek strony pokazuje pierwszy i ostatni wpis ({pierwszy:haslo}…).

const test = require('node:test');
const assert = require('node:assert/strict');
const { otworz, nowyProjekt } = require('./pomoc.cjs');

test('treść z tabeli: wpisy płyną przez strony, nagłówek z pierwszym i ostatnim hasłem, zmiana danych układa się sama', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Słowniczek');
  const w = await strona.evaluate(async () => {
    const { stan, edytor: e } = window.seriodruk;
    const { trescZTabeli, odswiezTresciZTabel } = await import('./js/app/lista-stron.js');
    const { rozwin, wartosciPol } = await import('./js/serie.js');
    const { podstawWTekscie } = await import('./js/pola.js');
    const hasla = Array.from({ length: 40 }, (_, i) => `${String.fromCharCode(65 + Math.floor(i / 2))}hasło${i + 1}`);
    stan.projekt.tabele.push({ id: 'tslow', nazwa: 'Słowa', kolumny: ['haslo', 'opis'], wiersze: hasla.map((h) => [h, `Objaśnienie słowa ${h}, które zajmuje kilka linijek tekstu w kolumnie słowniczka.`]) });
    stan.projekt.tabele[stan.projekt.tabele.length - 1].wiersze.splice(3, 0, ['[pomiń]', 'nie drukuj']);
    const ramka = e.dodajTekst('{haslo}\n{opis}');
    ramka.set({ id: 'slownik', left: 15, top: 30, width: 80, fontSize: 4, ramka_h: 120 });
    ramka.setSelectionStyles({ fontWeight: 'bold' }, 0, '{haslo}'.length);
    const nagl = e.dodajTekst('{pierwszy:haslo} – {ostatni:haslo} ({pierwsza_litera:haslo}–{ostatnia_litera:haslo})');
    nagl.set({ id: 'naglowek', left: 15, top: 12, width: 120, fontSize: 4 });
    e.zatwierdz?.();
    await trescZTabeli(ramka, 'wlacz', 'tslow');
    for (let i = 0; i < 40 && document.querySelector('.powiadomienie')?.textContent?.includes('Dodano') !== true; i += 1) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 300));
    const p = stan.projekt;
    const ramki = p.strony.flatMap((s) => s.obiekty.filter((o) => o.type === 'textbox' && (o.id === 'slownik' || o.watek === p.strony[0].obiekty.find((x) => x.id === 'slownik')?.watek)).map((o) => ({ s, o })));
    const caly = ramki.map((r) => r.o.text).join('\n');
    const ciag = rozwin(p);
    const naglowki = ciag.egzemplarze.filter((egz) => egz.strona.obiekty.some((o) => o.watek && ramki.some((r) => r.o === o) && o.text))
      .map((egz) => podstawWTekscie(p.strony[0].obiekty.find((o) => o.id === 'naglowek').text, null, wartosciPol(p, egz, ciag)).text);
    const zrodlo = p.strony[0].obiekty.find((o) => o.id === 'slownik');
    // Zmiana danych: nowe hasło na początku – treść układa się sama.
    p.tabele.find((x) => x.id === 'tslow').wiersze.unshift(['Aaron', 'Brat Mojżesza.']);
    await odswiezTresciZTabel();
    const poZmianie = p.strony.flatMap((s) => s.obiekty.filter((o) => o.watek && o.watek === zrodlo.watek)).sort((a, b) => a.watek_nr - b.watek_nr)[0].text.slice(0, 40);
    return {
      stron: p.strony.length,
      ramek: ramki.length,
      wszystkie: hasla.every((h) => caly.includes(h)),
      pominiety: caly.includes('nie drukuj'),
      pogrubione: (zrodlo.styles || []).some((s) => s.style?.fontWeight === 'bold'),
      wzor: zrodlo.z_tabeli?.wzor?.text,
      naglowki,
      poZmianie,
      kopieZrodla: p.strony.flatMap((s) => s.obiekty).filter((o) => o.z_tabeli).length,
    };
  });
  assert.ok(w.stron > 1 && w.ramek > 1, `wpisy przeszły na kolejne strony (${w.stron} stron, ${w.ramek} ramek)`);
  assert.equal(w.wszystkie, true, 'wszystkie hasła są w tekście');
  assert.equal(w.pominiety, false, 'wiersz [pomiń] bez wpisu');
  assert.equal(w.pogrubione, true, 'formatowanie wzoru (pogrubione hasło) w wpisach');
  assert.equal(w.wzor, '{haslo}\n{opis}');
  assert.equal(w.kopieZrodla, 1, 'wzór trzymany w jednej ramce');
  assert.match(w.naglowki[0], /^Ahasło1 – \S+ \(A–[A-Z]\)$/, w.naglowki.join(' | '));
  assert.match(w.naglowki.at(-1), /– Thasło40 \(\w–T\)$/, w.naglowki.join(' | '));
  assert.ok(w.naglowki.length > 1 && w.naglowki[0] !== w.naglowki[1], 'każda strona ma swój zakres');
  assert.match(w.poZmianie, /^Aaron/, 'nowy wiersz tabeli od razu w tekście');
  assert.deepEqual(bledy, []);
});

test('treść z tabeli: wzór wraca do ramki do poprawki, „Wypełnij z tabeli” bierze nowy wzór; panel pokazuje opcję', async (t) => {
  const { strona, bledy } = await otworz(t);
  await nowyProjekt(strona, 'Wzór wpisu');
  const w = await strona.evaluate(async () => {
    const { stan, edytor: e } = window.seriodruk;
    const { trescZTabeli } = await import('./js/app/lista-stron.js');
    stan.projekt.tabele.push({ id: 'tk', nazwa: 'Krótka', kolumny: ['haslo', 'opis'], wiersze: [['Abba', 'Ojcze'], ['Amen', 'Niech tak będzie']] });
    const ramka = e.dodajTekst('{haslo} – {opis}');
    ramka.set({ id: 'k', left: 15, top: 30, width: 80, fontSize: 4, ramka_h: 60 });
    e.zatwierdz?.();
    e.zaznacz('k');
    await trescZTabeli(e.canvas.getObjects().find((o) => o.id === 'k'), 'wlacz', 'tk');
    const tekst = () => stan.projekt.strony[0].obiekty.find((o) => o.id === 'k').text;
    const wynik = { po: tekst(), panel: document.querySelector('#wlasciwosci')?.textContent.includes('Treść z tabeli') };
    await trescZTabeli(e.canvas.getObjects().find((o) => o.id === 'k'), 'edytuj');
    wynik.edycja = tekst();
    const zywa = e.canvas.getObjects().find((o) => o.id === 'k');
    zywa.set({ text: '{haslo}: {opis}.' }); zywa.initDimensions();
    e.zatwierdz?.();
    await trescZTabeli(zywa, 'wypelnij');
    wynik.nowy = tekst();
    await trescZTabeli(e.canvas.getObjects().find((o) => o.id === 'k'), 'wylacz');
    wynik.wylaczone = { tekst: tekst(), z: stan.projekt.strony[0].obiekty.find((o) => o.id === 'k').z_tabeli };
    return wynik;
  });
  assert.equal(w.po, 'Abba – Ojcze\nAmen – Niech tak będzie');
  assert.equal(w.panel, true);
  assert.equal(w.edycja, '{haslo} – {opis}');
  assert.equal(w.nowy, 'Abba: Ojcze.\nAmen: Niech tak będzie.');
  assert.deepEqual(w.wylaczone, { tekst: 'Abba: Ojcze.\nAmen: Niech tak będzie.', z: undefined });
  assert.deepEqual(bledy, []);
});
